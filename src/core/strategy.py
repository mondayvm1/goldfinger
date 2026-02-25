"""Strategy engine for Kalshi 15-minute crypto prediction markets.

Prices binary options using a log-normal model (Black-Scholes d2 term)
and finds mispriced contracts vs the market.

Enhanced with EMA-20 trend confluence, asymmetric R/R filtering,
confidence scoring, and data-driven filters from 44-trade history analysis.
"""

from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timezone

from scipy.stats import norm

from ..models import Market, Side, TradeRecommendation

logger = logging.getLogger(__name__)

# ── Data-driven constants (from 44-trade statistical analysis) ──────────

# Annualized volatility estimates
DEFAULT_VOL = {"BTC": 0.60, "ETH": 0.70, "SOL": 1.10}

# Minimum edge (dollars) to recommend a trade
MIN_EDGE = 0.05

# Max contract price — sweet spot is $0.04-$0.25 but allow up to $0.35 for
# more opportunities. Above $0.35 the R/R drops below 2:1.
MAX_PRICE = 0.35

# Minimum reward/risk ratio
MIN_REWARD_RISK = 2.0

# Confidence score threshold (0-100)
MIN_CONFIDENCE = 50

# Time window sweet spot (minutes) — best results in this range
TIME_SWEET_SPOT = (5.0, 12.0)

# EMA period
EMA_PERIOD = 20

# Kelly fractions by asset (from optimal Kelly analysis):
#   BTC optimal=31%, using 20%. ETH optimal=12%, using 10%.
KELLY_BY_ASSET = {"BTC": 0.20, "ETH": 0.10}
KELLY_DEFAULT = 0.10

# Kelly for NO side — conservative until we have proven track record
KELLY_NO = {"BTC": 0.10, "ETH": 0.10}

# Assets to scan — SOL has negative Kelly (-7.6%), losing money
ENABLED_ASSETS = {"BTC", "ETH"}


# ── Pricing model (unchanged) ──────────────────────────────────────────

def fair_value_binary(spot: float, strike: float, minutes_left: float, vol: float) -> float:
    """Compute fair value of a binary "above strike" option.

    Uses the Black-Scholes d2 term:
        d2 = (ln(S/K) - 0.5 * sigma^2 * T) / (sigma * sqrt(T))
        P(above) = N(d2)
    """
    if minutes_left <= 0:
        return 1.0 if spot >= strike else 0.0

    if strike <= 0 or spot <= 0:
        return 0.5

    T = minutes_left / (365.25 * 24 * 60)  # years
    sqrt_T = math.sqrt(T)

    if sqrt_T * vol < 1e-10:
        return 1.0 if spot >= strike else 0.0

    d2 = (math.log(spot / strike) - 0.5 * vol**2 * T) / (vol * sqrt_T)
    return float(norm.cdf(d2))


# ── EMA + trend ────────────────────────────────────────────────────────

def compute_ema(candles: list[dict], period: int = EMA_PERIOD) -> float | None:
    """Compute EMA on close prices from CryptoCompare candle data.

    Args:
        candles: List of candle dicts with 'close' key, oldest first.
        period: EMA period (default 20).

    Returns:
        Current EMA value, or None if insufficient data.
    """
    closes = [c.get("close", 0) for c in candles if c.get("close")]
    if len(closes) < period:
        return None

    multiplier = 2.0 / (period + 1)
    ema = sum(closes[:period]) / period  # seed with SMA
    for price in closes[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def trend_direction(spot: float, ema: float | None) -> str:
    """Determine trend direction from spot vs EMA.

    Returns: 'bullish', 'bearish', or 'neutral'.
    Uses 0.15% buffer so small fluctuations count as neutral, not bearish.
    """
    if ema is None:
        return "neutral"
    pct_diff = (spot - ema) / ema
    if pct_diff > 0.0015:   # clearly above EMA
        return "bullish"
    elif pct_diff < -0.0015:  # clearly below EMA
        return "bearish"
    return "neutral"


# ── Risk/reward + confidence ───────────────────────────────────────────

def reward_risk_ratio(price: float) -> float:
    """Reward/risk for a binary option at given price.

    YES at $0.10: win $0.90, risk $0.10 → 9:1
    YES at $0.25: win $0.75, risk $0.25 → 3:1
    """
    if price <= 0 or price >= 1.0:
        return 0.0
    return (1.0 - price) / price


def compute_confidence(
    edge: float,
    trend: str,
    rr: float,
    minutes_left: float,
    side: Side = Side.YES,
) -> int:
    """Score a trade opportunity 0-100.

    Components:
      Edge size:      0-30 pts
      EMA alignment:  0-25 pts  (side-aware: YES+bullish or NO+bearish = aligned)
      Risk/reward:    0-20 pts
      Time window:    0-15 pts
    """
    score = 0

    # Edge (0-30): edge 0.05 = 10pts, 0.15+ = 30pts
    score += min(30, int(edge / 0.005))

    # EMA alignment (0-25) — direction-aware
    aligned = (
        (side == Side.YES and trend == "bullish") or
        (side == Side.NO and trend == "bearish")
    )
    if aligned:
        score += 25
    elif trend == "neutral":
        score += 10
    # against trend: 0 pts

    # Risk/reward (0-20)
    if rr >= 10:
        score += 20
    elif rr >= 5:
        score += 15
    elif rr >= 3:
        score += 10
    elif rr >= 2:
        score += 5

    # Time window (0-15)
    if TIME_SWEET_SPOT[0] <= minutes_left <= TIME_SWEET_SPOT[1]:
        score += 15
    elif 3.0 <= minutes_left < TIME_SWEET_SPOT[0]:
        score += 8
    elif TIME_SWEET_SPOT[1] < minutes_left <= 14.0:
        score += 10

    return max(0, min(100, score))


# ── Market parsing helpers ─────────────────────────────────────────────

def parse_ticker_strike(ticker: str) -> float | None:
    """Extract strike price from a KXBTC15M ticker."""
    match = re.search(r"(\d{3,6}(?:\.\d+)?)", ticker)
    if match:
        return float(match.group(1))
    return None


def extract_strike_from_market(market: Market) -> float | None:
    """Extract the strike price from a market's question/title or raw data."""
    raw = market.raw
    for field in ("floor_strike", "strike_price", "floor_value"):
        if raw.get(field) is not None:
            try:
                return float(raw[field])
            except (ValueError, TypeError):
                pass

    text = market.question or ""
    patterns = [
        r"\$?([\d,]+(?:\.\d+)?)\s*\?",
        r"above\s+\$?([\d,]+(?:\.\d+)?)",
        r"below\s+\$?([\d,]+(?:\.\d+)?)",
        r"between\s+\$?([\d,]+).*?\$?([\d,]+)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = m.group(1).replace(",", "")
            try:
                return float(val)
            except ValueError:
                pass

    sub = raw.get("yes_sub_title", "")
    m = re.search(r"\$?([\d,]+(?:\.\d+)?)", sub)
    if m:
        val = m.group(1).replace(",", "")
        try:
            return float(val)
        except ValueError:
            pass

    return None


def detect_direction(market: Market) -> str:
    """Detect if market is 'above' or 'below' type. Default: 'above'."""
    text = (market.question or "").lower()
    if "below" in text or "under" in text or "less than" in text:
        return "below"
    return "above"


def detect_asset(market: Market) -> str:
    """Detect asset from market ticker or question."""
    ticker = market.market_id.upper()
    if "BTC" in ticker or "BITCOIN" in ticker:
        return "BTC"
    if "ETH" in ticker or "ETHEREUM" in ticker:
        return "ETH"
    if "SOL" in ticker or "SOLANA" in ticker:
        return "SOL"
    q = (market.question or "").upper()
    if "BTC" in q or "BITCOIN" in q:
        return "BTC"
    if "ETH" in q or "ETHEREUM" in q:
        return "ETH"
    if "SOL" in q or "SOLANA" in q:
        return "SOL"
    return "BTC"


def minutes_until(close_time: datetime | None) -> float:
    """Minutes from now until close_time."""
    if close_time is None:
        return 15.0
    now = datetime.now(timezone.utc)
    if close_time.tzinfo is None:
        close_time = close_time.replace(tzinfo=timezone.utc)
    delta = (close_time - now).total_seconds() / 60
    return max(delta, 0.0)


# ── Main strategy ──────────────────────────────────────────────────────

def find_opportunities(
    markets: list[Market],
    spot_prices: dict[str, float],
    balance: float = 0.0,
    ema_data: dict[str, float | None] | None = None,
) -> list[TradeRecommendation]:
    """Scan markets for trend-aligned trades.

    EMA-20 trend determines trade direction (confluence filter):
      Bullish (spot > EMA) → BUY YES  (price rising toward strike)
      Bearish (spot < EMA) → BUY NO   (price falling from strike)
      Neutral              → BUY YES  (default, proven historical edge)

    Filters:
    1. Asset filter:  BTC + ETH only (SOL has negative Kelly)
    2. Price cap:     Max $0.35 (R/R must be ≥ 2:1)
    3. EMA trend:     Determines YES vs NO side
    4. Confidence:    Score 0-100, reject below 50
    5. Per-ticker:    Max 1 recommendation per market
    """
    recs: list[TradeRecommendation] = []

    for market in markets:
        asset = detect_asset(market)

        # Gate 1: Asset filter
        if asset not in ENABLED_ASSETS:
            continue

        spot = spot_prices.get(asset)
        if spot is None:
            continue

        strike = extract_strike_from_market(market)
        if strike is None:
            logger.debug(f"Skipping {market.market_id}: can't extract strike")
            continue

        mins_left = minutes_until(market.close_time)
        if mins_left < 2.0:
            continue  # too close to resolution

        vol = DEFAULT_VOL.get(asset, 0.65)
        direction = detect_direction(market)

        # Fair value of YES side
        fv_yes = fair_value_binary(spot, strike, mins_left, vol)
        if direction == "below":
            fv_yes = 1.0 - fv_yes
        fv_no = 1.0 - fv_yes

        # Determine trend from EMA
        ema_val = (ema_data or {}).get(asset)
        trend = trend_direction(spot, ema_val)

        raw = market.raw

        # ── Pick side based on trend confluence ──
        if trend == "bearish":
            # BEARISH → evaluate NO side (trade with the downtrend)
            trade_side = Side.NO
            fair_value = fv_no

            # Get NO ask price
            no_ask_raw = raw.get("no_ask_dollars") or raw.get("no_ask")
            trade_price = _to_float(no_ask_raw)

            # Fallback: NO ask ≈ 1 - YES bid
            if trade_price is None or trade_price > 1.0:
                yes_bid_raw = raw.get("yes_bid_dollars") or raw.get("yes_bid")
                yes_bid = _to_float(yes_bid_raw)
                if yes_bid is not None and 0 < yes_bid < 1.0:
                    trade_price = round(1.0 - yes_bid, 4)
                elif market.yes_price is not None and 0 < market.yes_price < 1.0:
                    trade_price = round(1.0 - market.yes_price, 4)

            # Convert from cents if needed
            if trade_price is not None and trade_price > 1.0:
                trade_price = trade_price / 100.0

            kelly_frac = KELLY_NO.get(asset, KELLY_DEFAULT)
            side_label = "NO"
            trend_emoji = "↓"
        else:
            # BULLISH or NEUTRAL → evaluate YES side
            trade_side = Side.YES
            fair_value = fv_yes

            yes_ask_raw = raw.get("yes_ask_dollars") or raw.get("yes_ask")
            trade_price = _to_float(yes_ask_raw) or market.yes_price

            kelly_frac = KELLY_BY_ASSET.get(asset, KELLY_DEFAULT)
            side_label = "YES"
            trend_emoji = "↑" if trend == "bullish" else "→"

        # ── Apply universal filters ──
        if trade_price is None or trade_price <= 0:
            continue

        # Gate 2: Price cap
        if trade_price > MAX_PRICE:
            continue

        # Gate 3: Edge
        edge = fair_value - trade_price
        if edge < MIN_EDGE:
            continue

        # Gate 4: R/R filter
        rr = reward_risk_ratio(trade_price)
        if rr < MIN_REWARD_RISK:
            continue

        # Gate 5: Confidence scoring (side-aware)
        confidence = compute_confidence(edge, trend, rr, mins_left, side=trade_side)
        if confidence < MIN_CONFIDENCE:
            continue

        # Position sizing
        count = position_size(edge, balance, trade_price, kelly_frac)

        recs.append(TradeRecommendation(
            ticker=market.market_id,
            side=trade_side,
            price=trade_price,
            count=count,
            edge=round(edge, 4),
            fair_value=round(fair_value, 4),
            minutes_left=round(mins_left, 1),
            strike=strike,
            spot=spot,
            reason=(
                f"BUY {side_label}: fair={fair_value:.2%} vs ask={trade_price:.2%}, "
                f"edge={edge:.2%}. {asset} ${spot:,.0f} {trend_emoji} strike "
                f"${strike:,.0f}, {mins_left:.0f}min left"
            ),
            confidence=confidence,
            trend=trend,
            rr_ratio=round(rr, 1),
            ema=ema_val,
            asset=asset,
        ))

    # Per-ticker dedup: keep highest confidence per ticker
    best_per_ticker: dict[str, TradeRecommendation] = {}
    for rec in recs:
        existing = best_per_ticker.get(rec.ticker)
        if existing is None or rec.confidence > existing.confidence:
            best_per_ticker[rec.ticker] = rec
    recs = list(best_per_ticker.values())

    # Sort by confidence descending, then edge
    recs.sort(key=lambda r: (r.confidence, r.edge), reverse=True)
    return recs


def position_size(
    edge: float, balance: float, price: float, kelly_fraction: float = KELLY_DEFAULT
) -> int:
    """Position sizing using asset-specific fractional Kelly.

    BTC uses 20% Kelly (optimal 31%), ETH uses 10% Kelly (optimal 12%).
    """
    if balance <= 0 or price <= 0 or price >= 1.0:
        return 1

    odds = (1.0 - price) / price
    kelly = edge / (price * odds) if odds > 0 else 0
    fraction = kelly * kelly_fraction
    dollars = balance * fraction
    count = max(1, int(dollars / price))
    return count


def _to_float(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None
