import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from database import get_db
from models import TelegramMessage

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "8942449178:AAFCI6YpAFtFetd_AfON7UfTRGcgXOYQ9CU")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "-5101756848")


class SendMessageRequest(BaseModel):
    text: str


@router.post("/send")
async def send_message(body: SendMessageRequest, db: Session = Depends(get_db)):
    if not body.text.strip():
        raise HTTPException(400, "Message cannot be empty")

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": body.text, "parse_mode": "HTML"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
        ok = resp.status_code == 200
    except Exception as e:
        ok = False

    log = TelegramMessage(text=body.text, status="sent" if ok else "failed")
    db.add(log)
    db.commit()

    if not ok:
        raise HTTPException(502, "Failed to send Telegram message")

    return {"ok": True, "message": "Sent to group"}


@router.get("/messages")
def get_messages(limit: int = 30, db: Session = Depends(get_db)):
    msgs = db.query(TelegramMessage).order_by(desc(TelegramMessage.sent_at)).limit(limit).all()
    return {
        "messages": [
            {
                "id": m.id,
                "text": m.text,
                "status": m.status,
                "sent_at": m.sent_at.strftime("%d %b %H:%M") if m.sent_at else None,
            }
            for m in msgs
        ]
    }
