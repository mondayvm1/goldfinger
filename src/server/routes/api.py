"""API routes — all data passes through the firewall before leaving."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from ..scanner import run_scan, run_trade
from ..firewall import sanitize_recommendations, sanitize_stats

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/scan")
async def scan(settle: int = Query(1, description="1=full scan, 0=light scan")):
    """Scan for trading signals.

    Returns sanitized signals — no strategy internals exposed.
    """
    try:
        raw = await run_scan(settle=bool(settle))

        # Pass through THE WALL
        signals = sanitize_recommendations(raw["recommendations"])
        stats = sanitize_stats(
            balance=raw["balance"],
            total_trades=raw["total_trades"],
            realized_pnl=raw["realized_pnl"],
            wins=raw["wins"],
            losses=raw["losses"],
            open_positions=raw["positions"],
        )

        return {
            "signals": signals,
            "stats": stats,
            "scanning": raw["scanning"],
        }

    except Exception as e:
        logger.error(f"Scan failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Scan failed. Check server logs."},
        )


@router.post("/trade")
async def trade(payload: dict):
    """Execute a trade.

    Expects: { ticker, side, price, count }
    """
    try:
        ticker = payload["ticker"]
        side = payload["side"]
        price = float(payload["price"])
        count = int(payload["count"])

        result = await run_trade(
            ticker=ticker,
            side=side,
            price=price,
            count=count,
        )

        return result

    except KeyError as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": f"Missing field: {e}"},
        )
    except Exception as e:
        logger.error(f"Trade failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)},
        )
