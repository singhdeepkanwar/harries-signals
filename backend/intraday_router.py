from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import date, datetime, timedelta
from database import get_db
from models import IntradayScan, IntradayAlert

router = APIRouter(prefix="/api/intraday", tags=["intraday"])


@router.get("/today")
def get_today_scan(db: Session = Depends(get_db)):
    today = date.today()
    scans = db.query(IntradayScan).filter(IntradayScan.scan_date == today).all()
    alerts = db.query(IntradayAlert).filter(IntradayAlert.alert_date == today).all()

    buy_candidates = [s for s in scans if s.direction == "BUY"]
    sell_candidates = [s for s in scans if s.direction == "SELL"]

    return {
        "date": str(today),
        "scan_time": scans[0].scan_time.strftime("%H:%M IST") if scans else None,
        "total_scanned": len(scans),
        "buy_count": len(buy_candidates),
        "sell_count": len(sell_candidates),
        "alerts_fired": len(alerts),
        "buy_candidates": [_fmt_scan(s) for s in sorted(buy_candidates, key=lambda x: x.volume or 0, reverse=True)],
        "sell_candidates": [_fmt_scan(s) for s in sorted(sell_candidates, key=lambda x: x.volume or 0, reverse=True)],
        "alerts": [_fmt_alert(a) for a in alerts],
    }


@router.get("/history")
def get_history(days: int = 10, db: Session = Depends(get_db)):
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(IntradayScan.scan_date,
                 IntradayScan.direction,
                 IntradayScan.status)
        .filter(IntradayScan.scan_date >= since)
        .all()
    )
    alerts = (
        db.query(IntradayAlert.alert_date, IntradayAlert.direction)
        .filter(IntradayAlert.alert_date >= since)
        .all()
    )

    # Group by date
    by_date = {}
    for r in rows:
        d = str(r.scan_date)
        if d not in by_date:
            by_date[d] = {"date": d, "buy": 0, "sell": 0, "triggered": 0}
        if r.direction == "BUY":
            by_date[d]["buy"] += 1
        else:
            by_date[d]["sell"] += 1
        if r.status == "TRIGGERED":
            by_date[d]["triggered"] += 1

    for a in alerts:
        d = str(a.alert_date)
        if d in by_date:
            pass  # already counted above

    return {"history": sorted(by_date.values(), key=lambda x: x["date"], reverse=True)}


@router.get("/alerts/today")
def get_today_alerts(db: Session = Depends(get_db)):
    today = date.today()
    alerts = db.query(IntradayAlert).filter(IntradayAlert.alert_date == today).order_by(desc(IntradayAlert.alert_time)).all()
    return {"alerts": [_fmt_alert(a) for a in alerts]}


# ── helpers ──

def _fmt_scan(s: IntradayScan) -> dict:
    rng = s.high_price - s.low_price
    rng_pct = round((rng / s.open_price) * 100, 2) if s.open_price else 0
    return {
        "id": s.id,
        "symbol": s.symbol,
        "direction": s.direction,
        "pattern": s.pattern,
        "open": s.open_price,
        "high": s.high_price,
        "low": s.low_price,
        "close": s.close_price,
        "trigger": s.trigger_price,
        "range_pct": rng_pct,
        "volume": s.volume,
        "status": s.status,
    }


def _fmt_alert(a: IntradayAlert) -> dict:
    return {
        "id": a.id,
        "symbol": a.symbol,
        "direction": a.direction,
        "cmp": a.cmp,
        "pct_move": a.pct_move,
        "trigger": a.trigger_price,
        "volume": a.volume,
        "vwap": a.vwap,
        "day_high": a.day_high,
        "day_low": a.day_low,
        "time": a.alert_time.strftime("%H:%M:%S") if a.alert_time else None,
    }
