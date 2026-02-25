"""Interactive HFT dashboard with one-click trading.

Serves the dashboard + API endpoints for scanning and executing trades.
No terminal needed — scan and trade directly from the browser.

Usage:
    python -m src.dashboard
    python -m src.dashboard --port 8050
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from pathlib import Path
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

SPREADS_DIR = Path("data/spreads")
SCANS_DIR = Path("data/scans")
PNL_DIR = Path("data/pnl")
TRADES_FILE = PNL_DIR / "trades.json"


# ── Data loaders ─────────────────────────────────────────────

def _load_trades() -> list[dict]:
    if not TRADES_FILE.exists():
        return []
    try:
        with open(TRADES_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception):
        return []


# ── API: scan for opportunities ──────────────────────────────

def _run_scan(assets: list[str] | None = None, settle: bool = True) -> dict:
    """Run the HFT scanner and return results as dict.

    Args:
        assets: Which assets to scan (default: ENABLED_ASSETS).
        settle: If True, sync orders and check settlements (heavier).
                If False, skip those steps (lighter, for auto-scan).
    """
    from .exchanges.kalshi import KalshiClient
    from .core.strategy import find_opportunities, compute_ema, ENABLED_ASSETS
    from .data.pnl import sync_orders_from_exchange, update_settled_trades, load_trades

    # Only scan assets with positive expectancy
    if assets is None:
        assets = list(ENABLED_ASSETS)

    async def _scan():
        client = KalshiClient.from_env()
        async with client:
            balance = await client.get_balance()
            positions = await client.get_positions()

            # Only do heavy settlement work on full scans
            if settle:
                # Sync orders from Kalshi into local trade log
                try:
                    orders = await client.get_open_orders()
                    synced = sync_orders_from_exchange(orders)
                    if synced:
                        logger.info(f"Synced {synced} orders from Kalshi")
                except Exception as e:
                    logger.warning(f"Order sync failed: {e}")

                # Check for settled trades
                try:
                    trades = load_trades()
                    unsettled_tickers = {t.ticker for t in trades if t.pnl is None}
                    market_results = {}
                    for ticker in unsettled_tickers:
                        try:
                            mdata = await client._get(f'/markets/{ticker}')
                            market = mdata.get('market', mdata)
                            result = market.get('result', '')
                            if result in ('yes', 'no'):
                                market_results[ticker] = result
                        except Exception:
                            pass
                    if market_results:
                        settled = update_settled_trades(market_results)
                        if settled:
                            logger.info(f"Updated {settled} settled trades")
                except Exception as e:
                    logger.warning(f"Settlement check failed: {e}")

            # Fetch markets (3 expiry windows for wider aperture)
            all_markets = []
            for asset in assets:
                try:
                    markets = await client.get_15min_markets(asset, max_windows=3)
                    all_markets.extend(markets)
                except Exception as e:
                    logger.warning(f"{asset} markets failed: {e}")

            spot_prices = {}
            try:
                spot_prices = await client.get_spot_prices(assets)
            except Exception as e:
                logger.warning(f"Spot prices failed: {e}")

            # Fetch 1-min candles for EMA-20
            ema_data = {}
            for asset in assets:
                try:
                    candles = await client.get_candles(asset, limit=24)
                    ema_data[asset] = compute_ema(candles)
                    if ema_data[asset]:
                        logger.info(f"EMA-20 {asset}: ${ema_data[asset]:,.2f}")
                except Exception as e:
                    logger.warning(f"Candles for {asset} failed: {e}")
                    ema_data[asset] = None

            recs = []
            if all_markets and spot_prices:
                recs = find_opportunities(
                    all_markets, spot_prices, balance, ema_data=ema_data
                )

            return {
                "balance": balance,
                "positions": len(positions),
                "markets": len(all_markets),
                "spot_prices": {k: round(v, 2) for k, v in spot_prices.items()},
                "ema_data": {
                    k: round(v, 2) if v else None
                    for k, v in ema_data.items()
                },
                "recommendations": [
                    {
                        "ticker": r.ticker,
                        "side": r.side.value,
                        "price": r.price,
                        "count": r.count,
                        "edge": r.edge,
                        "fair_value": r.fair_value,
                        "minutes_left": r.minutes_left,
                        "strike": r.strike,
                        "spot": r.spot,
                        "reason": r.reason,
                        "confidence": r.confidence,
                        "trend": r.trend,
                        "rr_ratio": r.rr_ratio,
                        "ema": r.ema,
                        "asset": r.asset,
                    }
                    for r in recs
                ],
            }

    return asyncio.run(_scan())


def _run_trade(ticker: str, side: str, price: float, count: int) -> dict:
    """Execute a single trade and return result."""
    from .exchanges.kalshi import KalshiClient
    from .models import OrderStatus, Side, TradeRecord
    from .data.pnl import log_trade

    async def _trade():
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
                timestamp=datetime.utcnow().isoformat(),
                status=OrderStatus.FILLED if status_str in ("executed", "filled") else OrderStatus.PENDING,
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

    try:
        return asyncio.run(_trade())
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── HTML builder ─────────────────────────────────────────────

def _build_html() -> str:
    trades = _load_trades()

    # PnL stats
    realized_pnl = 0.0
    wins = 0
    losses = 0
    for t in trades:
        pnl = t.get("pnl")
        if pnl is not None:
            realized_pnl += pnl
            if pnl > 0:
                wins += 1
            elif pnl < 0:
                losses += 1
    settled = wins + losses
    win_rate = (wins / settled * 100) if settled > 0 else 0
    pnl_color = "#00ff88" if realized_pnl >= 0 else "#ff4444"

    # Trade history rows
    trade_rows = ""
    for t in reversed(trades[-30:]):
        side_color = "#00ff88" if t.get("side") == "yes" else "#ff4444"
        pnl_val = t.get("pnl")
        pnl_display = f"${pnl_val:+.4f}" if pnl_val is not None else "pending"
        pnl_style = "#00ff88" if pnl_val and pnl_val > 0 else "#ff4444" if pnl_val and pnl_val < 0 else "#888"
        trade_rows += f"""<tr>
            <td>{t.get('timestamp', '')[:19]}</td>
            <td>{t.get('ticker', '')}</td>
            <td style="color:{side_color}">{t.get('side', '').upper()}</td>
            <td>${t.get('price', 0):.2f}</td>
            <td>{t.get('count', 0)}</td>
            <td>${t.get('fee', 0):.4f}</td>
            <td style="color:{pnl_style}">{pnl_display}</td>
            <td>{t.get('status', '')}</td>
        </tr>"""
    if not trade_rows:
        trade_rows = '<tr><td colspan="8" style="text-align:center;color:#666">No trades yet</td></tr>'

    # Chart data
    chart_labels = []
    chart_cum_pnl = []
    chart_trade_pnl = []
    cum = 0.0
    for t in trades:
        chart_labels.append(t.get("timestamp", "")[:16])
        pnl_val = t.get("pnl")
        if pnl_val is not None:
            cum += pnl_val
            chart_trade_pnl.append(round(pnl_val, 4))
        else:
            chart_trade_pnl.append(0)
        chart_cum_pnl.append(round(cum, 4))

    return f"""<!DOCTYPE html>
<html>
<head>
    <title>HFT Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; }}
        h1 {{ color: #00ff88; margin-bottom: 4px; font-size: 1.6rem; }}
        .subtitle {{ color: #666; margin-bottom: 20px; font-size: 0.85rem; }}
        h2 {{ color: #00aaff; margin: 20px 0 10px; font-size: 1.2rem; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }}
        .stat-card {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 14px 16px; }}
        .stat-card .value {{ font-size: 1.5em; font-weight: bold; color: #00ff88; }}
        .stat-card .label {{ color: #888; font-size: 0.8em; }}
        .table-wrap {{ overflow-x: auto; margin-bottom: 24px; border: 1px solid #222; border-radius: 8px; }}
        table {{ min-width: 600px; width: 100%; border-collapse: collapse; font-size: 0.82rem; }}
        th {{ background: #1a1a1a; color: #00ff88; text-align: left; padding: 10px 12px; border-bottom: 2px solid #333; white-space: nowrap; }}
        td {{ padding: 8px 12px; border-bottom: 1px solid #1a1a1a; }}
        tr:hover {{ background: #151515; }}
        .chart-container {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 24px; position: relative; height: 260px; }}

        /* Scanner section */
        .scan-bar {{ display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }}
        .btn {{ padding: 10px 24px; border: none; border-radius: 6px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }}
        .btn:disabled {{ opacity: 0.5; cursor: not-allowed; }}
        .btn-scan {{ background: #00ff88; color: #000; }}
        .btn-scan:hover:not(:disabled) {{ background: #00cc6a; }}
        .btn-buy {{ background: #00ff88; color: #000; padding: 6px 16px; font-size: 0.8rem; }}
        .btn-buy:hover:not(:disabled) {{ background: #00cc6a; }}
        .btn-skip {{ background: #333; color: #888; padding: 6px 16px; font-size: 0.8rem; }}
        .btn-skip:hover {{ background: #444; }}
        .scan-status {{ color: #888; font-size: 0.85rem; }}
        #scan-results {{ margin-bottom: 24px; }}
        .opp-card {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }}
        .opp-info {{ flex: 1; min-width: 300px; }}
        .opp-ticker {{ font-size: 1.1em; font-weight: bold; color: #fff; }}
        .opp-detail {{ color: #888; font-size: 0.85rem; margin-top: 4px; }}
        .opp-edge {{ color: #00ff88; font-weight: bold; font-size: 1.1em; }}
        .opp-actions {{ display: flex; gap: 8px; }}
        .trade-result {{ padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }}
        .trade-success {{ background: rgba(0,255,136,0.15); color: #00ff88; }}
        .trade-fail {{ background: rgba(255,68,68,0.15); color: #ff4444; }}
    </style>
</head>
<body>
    <h1>Prediction Market HFT</h1>
    <p class="subtitle">Kalshi 15-Min Crypto Markets</p>

    <!-- Scanner -->
    <h2>Scanner</h2>
    <div class="scan-bar">
        <button class="btn btn-scan" id="scanBtn">Scan for Opportunities</button>
        <button class="btn" id="autoScanBtn" style="background:#333;color:#888;">Auto-Scan: OFF</button>
        <span class="scan-status" id="scanStatus"></span>
    </div>
    <div id="scan-results"></div>

    <!-- PnL -->
    <h2>Trading PnL</h2>
    <div class="stats">
        <div class="stat-card">
            <div class="value" style="color:{pnl_color}">${realized_pnl:+.2f}</div>
            <div class="label">Realized PnL</div>
        </div>
        <div class="stat-card">
            <div class="value">{len(trades)}</div>
            <div class="label">Total Trades</div>
        </div>
        <div class="stat-card">
            <div class="value">{wins}W / {losses}L</div>
            <div class="label">Win / Loss</div>
        </div>
        <div class="stat-card">
            <div class="value">{win_rate:.0f}%</div>
            <div class="label">Win Rate</div>
        </div>
    </div>

    <div class="chart-container">
        <canvas id="pnlChart"></canvas>
    </div>

    <!-- Trade History -->
    <h2>Trade History</h2>
    <div class="table-wrap">
    <table>
        <tr><th>Time</th><th>Ticker</th><th>Side</th><th>Price</th><th>Qty</th><th>Fee</th><th>PnL</th><th>Status</th></tr>
        {trade_rows}
    </table>
    </div>

    <script>
    // ── Chart (wrapped in try/catch so it can't kill the rest of the page) ──
    try {{
        const labels = {json.dumps(chart_labels)};
        const cumPnl = {json.dumps(chart_cum_pnl)};
        const tradePnl = {json.dumps(chart_trade_pnl)};
        const ctx = document.getElementById('pnlChart');
        if (ctx && labels.length > 0 && typeof Chart !== 'undefined') {{
            new Chart(ctx, {{
                type: 'bar',
                data: {{
                    labels: labels.map(l => l.slice(11) || l),
                    datasets: [
                        {{ label: 'Cumulative PnL ($)', data: cumPnl, type: 'line', borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#00ff88', yAxisID: 'y', order: 0 }},
                        {{ label: 'Trade PnL ($)', data: tradePnl, backgroundColor: tradePnl.map(v => v >= 0 ? 'rgba(0,255,136,0.6)' : 'rgba(255,68,68,0.6)'), borderColor: tradePnl.map(v => v >= 0 ? '#00ff88' : '#ff4444'), borderWidth: 1, yAxisID: 'y', order: 1 }}
                    ]
                }},
                options: {{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {{ legend: {{ labels: {{ color: '#888' }} }} }},
                    scales: {{
                        x: {{ ticks: {{ color: '#666' }}, grid: {{ color: 'rgba(255,255,255,0.05)' }} }},
                        y: {{ ticks: {{ color: '#888', callback: v => '$' + v.toFixed(2) }}, grid: {{ color: 'rgba(255,255,255,0.08)' }} }}
                    }}
                }}
            }});
        }} else if (ctx) {{
            ctx.parentElement.innerHTML = '<p style="color:#555;text-align:center;padding:80px 0;">Chart appears after your first trade</p>';
        }}
    }} catch(chartErr) {{ console.warn('Chart init error:', chartErr); }}

    // ── Scanner ──
    var scanRecs = [];

    // Use event delegation — clicks on BUY/Skip buttons bubble up here
    document.getElementById('scan-results').addEventListener('click', function(e) {{
        var btn = e.target;
        if (btn.classList.contains('btn-buy')) {{
            var idx = parseInt(btn.getAttribute('data-idx'));
            executeTrade(idx);
        }} else if (btn.classList.contains('btn-skip')) {{
            var idx = parseInt(btn.getAttribute('data-idx'));
            skipTrade(idx);
        }}
    }});

    document.getElementById('scanBtn').addEventListener('click', function() {{ runScan(false); }});

    // ── Auto-scan ──
    var autoScanTimer = null;
    var autoScanCountdownTimer = null;
    var AUTO_SCAN_INTERVAL = 45;  // seconds
    var countdownLeft = 0;
    var isScanning = false;

    document.getElementById('autoScanBtn').addEventListener('click', toggleAutoScan);

    function toggleAutoScan() {{
        var btn = document.getElementById('autoScanBtn');
        if (autoScanTimer) {{
            // Turn OFF
            clearInterval(autoScanTimer);
            clearInterval(autoScanCountdownTimer);
            autoScanTimer = null;
            autoScanCountdownTimer = null;
            btn.style.background = '#333';
            btn.style.color = '#888';
            btn.textContent = 'Auto-Scan: OFF';
        }} else {{
            // Turn ON — scan immediately, then every N seconds
            btn.style.background = '#00aaff';
            btn.style.color = '#000';
            btn.textContent = 'Auto-Scan: ON (' + AUTO_SCAN_INTERVAL + 's)';
            runScan(true);  // light scan
            countdownLeft = AUTO_SCAN_INTERVAL;
            autoScanTimer = setInterval(function() {{
                runScan(true);
                countdownLeft = AUTO_SCAN_INTERVAL;
            }}, AUTO_SCAN_INTERVAL * 1000);
            autoScanCountdownTimer = setInterval(function() {{
                countdownLeft--;
                if (countdownLeft > 0 && !isScanning) {{
                    btn.textContent = 'Auto-Scan: ON (' + countdownLeft + 's)';
                }}
            }}, 1000);
        }}
    }}

    function playAlert() {{
        try {{
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
            setTimeout(function() {{
                var osc2 = ctx.createOscillator();
                var gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 1100;
                gain2.gain.value = 0.3;
                osc2.start();
                osc2.stop(ctx.currentTime + 0.15);
            }}, 180);
        }} catch(e) {{}}
    }}

    function runScan(light) {{
        if (isScanning) return;
        isScanning = true;
        var btn = document.getElementById('scanBtn');
        var status = document.getElementById('scanStatus');
        var results = document.getElementById('scan-results');

        btn.disabled = true;
        btn.textContent = 'Scanning...';
        status.textContent = 'Fetching markets & spot prices...';
        results.innerHTML = '';
        scanRecs = [];

        var url = light ? '/api/scan?settle=0' : '/api/scan';
        fetch(url).then(function(resp) {{
            return resp.json();
        }}).then(function(data) {{
            // Status bar with balance, spots, and EMA values
            var spotsStr = Object.entries(data.spot_prices).map(function(e) {{ return e[0] + ' $' + Number(e[1]).toLocaleString(); }}).join(', ');
            var emaStr = '';
            if (data.ema_data) {{
                emaStr = ' | EMA: ' + Object.entries(data.ema_data).map(function(e) {{
                    return e[0] + (e[1] ? ' $' + Number(e[1]).toLocaleString() : ' N/A');
                }}).join(', ');
            }}
            status.textContent = 'Balance: $' + data.balance.toFixed(2) + ' | ' + data.markets + ' markets | ' + spotsStr + emaStr;

            if (data.recommendations.length === 0) {{
                results.innerHTML = '<div style="color:#666;padding:20px;text-align:center;background:#1a1a1a;border-radius:8px;">No high-probability trades right now. Scanning BTC/ETH: YES when bullish, NO when bearish (EMA-20 confluence). Try again in a few minutes.</div>';
            }} else {{
                scanRecs = data.recommendations;
                for (var i = 0; i < data.recommendations.length; i++) {{
                    var rec = data.recommendations[i];
                    var trendArrow = rec.trend === 'bullish' ? '\u2191' : rec.trend === 'bearish' ? '\u2193' : '\u2192';
                    var trendColor = rec.trend === 'bullish' ? '#00ff88' : rec.trend === 'bearish' ? '#ff4444' : '#888';
                    var confColor = rec.confidence >= 80 ? '#00ff88' : rec.confidence >= 60 ? '#ffaa00' : '#ff4444';
                    var confBorder = rec.confidence >= 80 ? '#00ff88' : rec.confidence >= 60 ? '#ffaa00' : '#333';

                    var sideUpper = rec.side.toUpperCase();
                    var sideColor = rec.side === 'yes' ? '#00ff88' : '#ff6644';
                    var buyBtnColor = rec.side === 'yes' ? 'background:#00ff88;color:#000' : 'background:#ff6644;color:#000';

                    var card = document.createElement('div');
                    card.className = 'opp-card';
                    card.id = 'opp-' + i;
                    card.style.borderColor = confBorder;
                    card.innerHTML = '<div class="opp-info">'
                        + '<div class="opp-ticker">'
                        + '<span style="color:' + confColor + ';font-weight:bold;font-size:1.4em;margin-right:8px">' + rec.confidence + '</span>'
                        + rec.asset + ' '
                        + '<span style="color:' + trendColor + ';font-size:1.2em">' + trendArrow + '</span>'
                        + ' <span style="color:#666;font-size:0.8em">' + rec.ticker + '</span>'
                        + '</div>'
                        + '<div class="opp-detail">'
                        + '<span style="color:' + sideColor + ';font-weight:bold">' + sideUpper + '</span> '
                        + rec.count + 'x @ <strong>$' + rec.price.toFixed(2) + '</strong>'
                        + ' | Fair: $' + rec.fair_value.toFixed(2)
                        + ' | <span class="opp-edge">Edge: +$' + rec.edge.toFixed(2) + '</span>'
                        + ' | <strong>R/R: ' + rec.rr_ratio.toFixed(1) + ':1</strong>'
                        + ' | ' + rec.minutes_left.toFixed(0) + 'min left'
                        + '</div>'
                        + '<div class="opp-detail" style="color:#666;font-size:0.8em">' + rec.reason + '</div>'
                        + '</div>'
                        + '<div class="opp-actions" id="opp-actions-' + i + '">'
                        + '<button class="btn btn-buy" data-idx="' + i + '" style="' + buyBtnColor + '">BUY ' + sideUpper + '</button>'
                        + '<button class="btn btn-skip" data-idx="' + i + '">Skip</button>'
                        + '</div>';
                    results.appendChild(card);
                }}
                // Alert when auto-scan finds opportunities
                if (light && data.recommendations.length > 0) {{
                    playAlert();
                    document.title = '\u26a0 ' + data.recommendations.length + ' TRADE(S) FOUND';
                    setTimeout(function() {{ document.title = 'HFT Dashboard'; }}, 10000);
                }}
            }}
        }}).catch(function(e) {{
            status.textContent = 'Scan failed: ' + e.message;
        }}).finally(function() {{
            isScanning = false;
            btn.disabled = false;
            btn.textContent = 'Scan for Opportunities';
        }});
    }}

    function executeTrade(index) {{
        var rec = scanRecs[index];
        if (!rec) {{ alert('No trade data. Re-scan first.'); return; }}
        var actions = document.getElementById('opp-actions-' + index);
        actions.innerHTML = '<span style="color:#ffaa00;font-weight:bold">Placing order...</span>';

        fetch('/api/trade', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json' }},
            body: JSON.stringify({{ ticker: rec.ticker, side: rec.side, price: rec.price, count: rec.count }})
        }}).then(function(resp) {{
            return resp.json();
        }}).then(function(data) {{
            if (data.success) {{
                actions.innerHTML = '<span class="trade-result trade-success">Order placed! ' + data.order_id.slice(0,8) + '... (' + data.status + ')</span>';
                setTimeout(function() {{ location.reload(); }}, 2000);
            }} else {{
                actions.innerHTML = '<span class="trade-result trade-fail">Failed: ' + data.error + '</span>';
            }}
        }}).catch(function(e) {{
            actions.innerHTML = '<span class="trade-result trade-fail">Error: ' + e.message + '</span>';
        }});
    }}

    function skipTrade(index) {{
        var card = document.getElementById('opp-' + index);
        card.style.opacity = '0.4';
        var actions = document.getElementById('opp-actions-' + index);
        actions.innerHTML = '<span style="color:#666">Skipped</span>';
    }}
    </script>
</body>
</html>"""


# ── HTTP Handler ─────────────────────────────────────────────

class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self._respond(200, "text/html", _build_html())
        elif self.path == "/api/scan" or self.path.startswith("/api/scan?"):
            try:
                qs = parse_qs(urlparse(self.path).query)
                settle = qs.get("settle", ["1"])[0] != "0"
                data = _run_scan(settle=settle)
                self._respond(200, "application/json", json.dumps(data))
            except Exception as e:
                self._respond(500, "application/json", json.dumps({"error": str(e)}))
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/trade":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            try:
                data = _run_trade(
                    ticker=body["ticker"],
                    side=body["side"],
                    price=body["price"],
                    count=body["count"],
                )
                self._respond(200, "application/json", json.dumps(data))
            except Exception as e:
                self._respond(500, "application/json", json.dumps({"success": False, "error": str(e)}))
        else:
            self.send_error(404)

    def _respond(self, code: int, content_type: str, body: str):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, format, *args):
        logger.debug(format, *args)


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    parser = argparse.ArgumentParser(description="HFT Dashboard")
    parser.add_argument("--port", type=int, default=8050)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    SPREADS_DIR.mkdir(parents=True, exist_ok=True)
    SCANS_DIR.mkdir(parents=True, exist_ok=True)
    PNL_DIR.mkdir(parents=True, exist_ok=True)

    server = ThreadedHTTPServer((args.host, args.port), DashboardHandler)
    print(f"Dashboard running at http://localhost:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
