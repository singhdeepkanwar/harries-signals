import httpx
import logging

logger = logging.getLogger(__name__)


async def send_telegram_alert(token: str, chat_id: str, setups: list[dict]):
    """Send Telegram alert with scan results."""
    if not token or not chat_id:
        return False

    breakouts = [s for s in setups if s["strategy"] == "BREAKOUT"]
    reversals = [s for s in setups if s["strategy"] == "REVERSAL"]

    message = f"*NSE Scan Results*\n"
    message += f"Breakout Setups: {len(breakouts)}\n"
    message += f"Reversal Setups: {len(reversals)}\n\n"

    # Top 3 by confirmation score
    top = sorted(setups, key=lambda x: x["confirmation_score"], reverse=True)[:3]
    if top:
        message += "*Top Setups:*\n"
        for s in top:
            message += (
                f"  {s['symbol']} ({s['strategy']}) - "
                f"Entry: {s['entry_price']}, SL: {s['stop_loss']}, "
                f"Score: {s['confirmation_score']}\n"
            )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Telegram alert failed: {e}")
        return False


async def test_telegram(token: str, chat_id: str) -> bool:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": "Trading System connected!", "parse_mode": "Markdown"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            return response.status_code == 200
    except Exception:
        return False
