"""Scan orchestration — wraps strategy engine for the web layer.

Calls the exchange client, fetches markets/prices/candles,
runs the strategy, and returns RAW recommendations + stats.

This module does NOT sanitize output — that's firewall.py's job.
All functions are async-native for use inside FastAPI's event loop.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from ..exchanges.kalshi import KalshiClient
from ..core.strategy import find_opportunities, compute_ema, ENABLED_ASSETS
from ..data.pnl import (
    sync_orders_from_exchange,
    update_settled_trades,
    load_trades,
    log_trade,
)
from ..models import OrderStatus, Side, TradeRecommendation, TradeRecord

logger = logging.getLogger(__name__)

PNL_DIR = Path("data/pnl")


async def run_scan(
    assets: list[str] | None = None,
    settle: bool = True,
) -> dict:
    """Run the HFT scanner and return raw results.

    Args:
        assets: Which assets to scan (default: ENABLED_ASSETS).
        settle: If True, sync orders and check settlements (heavier).
                If False, skip those steps (lighter, for auto-scan).

    Returns:
        dict with keys: balance, positions, markets, recommendations (raw),
        total_trades, realized_pnl, wins, losses.
    """
    PNL_DIR.mkdir(parents=True, exist_ok=True)

    if assets is None:
        assets = list(ENABLED_ASSETS)

    client = KalshiClient.from_env()
    async with client:
        balance = await client.get_balance()
        positions = await client.get_positions()

        # Only do heavy settlement work on full scans
        if settle:
            try:
                orders = await client.get_open_orders()
                synced = sync_orders_from_exchange(orders)
                if synced:
                    logger.info(f"Synced {synced} orders from Kalshi")
            except Exception as e:
                logger.warning(f"Order sync failed: {e}")

            try:
                trades = load_trades()
                unsettled_tickers = {
                    t.ticker for t in trades if t.pnl is None
                }
                market_results = {}
                for ticker in unsettled_tickers:
                    try:
                        mdata = await client._get(f"/markets/{ticker}")
                        market = mdata.get("market", mdata)
                        result = market.get("result", "")
                        if result in ("yes", "no"):
                            market_results[ticker] = result
                    except Exception:
                        pass
                if market_results:
                    settled_count = update_settled_trades(market_results)
                    if settled_count:
                        logger.info(
                            f"Updated {settled_count} settled trades"
                        )
            except Exception as e:
                logger.warning(f"Settlement check failed: {e}")

        # Fetch markets (3 expiry windows)
        all_markets = []
        for asset in assets:
            try:
                markets = await client.get_15min_markets(
                    asset, max_windows=3
                )
                all_markets.extend(markets)
            except Exception as e:
                logger.warning(f"{asset} markets failed: {e}")

        # Spot prices
        spot_prices = {}
        try:
            spot_prices = await client.get_spot_prices(assets)
        except Exception as e:
            logger.warning(f"Spot prices failed: {e}")

        # 1-min candles for EMA-20
        ema_data = {}
        for asset in assets:
            try:
                candles = await client.get_candles(asset, limit=24)
                ema_data[asset] = compute_ema(candles)
            except Exception as e:
                logger.warning(f"Candles for {asset} failed: {e}")
                ema_data[asset] = None

        # Run strategy
        recs: list[TradeRecommendation] = []
        if all_markets and spot_prices:
            recs = find_opportunities(
                all_markets, spot_prices, balance, ema_data=ema_data
            )

        # PnL stats
        all_trades = load_trades()
        realized_pnl = 0.0
        wins = 0
        losses = 0
        for t in all_trades:
            if t.pnl is not None:
                realized_pnl += t.pnl
                if t.pnl > 0:
                    wins += 1
                elif t.pnl < 0:
                    losses += 1

        return {
            "balance": balance,
            "positions": len(positions),
            "markets": len(all_markets),
            "recommendations": recs,  # Raw — firewall sanitizes later
            "total_trades": len(all_trades),
            "realized_pnl": realized_pnl,
            "wins": wins,
            "losses": losses,
            "scanning": assets,
        }


async def run_trade(ticker: str, side: str, price: float, count: int) -> dict:
    """Execute a single trade and return result."""
    try:
        client = KalshiClient.from_env()
        async with client:
            price_cents = max(1, min(99, int(round(price * 100))))
            order = await client.create_order(
                ticker=ticker,
                side=side,
                price_cents=price_cents,
                count=count,
                order_type="limit",
                action="buy",
            )

            order_id = order.get("order_id", order.get("id", "unknown"))
            status_str = order.get("status", "pending").lower()
            fee = KalshiClient.estimate_fee(price, count)

            record = TradeRecord(
                id=order_id,
                ticker=ticker,
                side=Side(side),
                price=price,
                count=count,
                fee=fee,
                timestamp=datetime.now(timezone.utc).isoformat(),
                status=(
                    OrderStatus.FILLED
                    if status_str in ("executed", "filled")
                    else OrderStatus.PENDING
                ),
            )
            log_trade(record)

            return {
                "success": True,
                "order_id": order_id,
                "status": status_str,
                "ticker": ticker,
                "side": side,
                "price": price,
                "count": count,
                "fee": fee,
            }

    except Exception as e:
        return {"success": False, "error": str(e)}
