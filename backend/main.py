from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import threading
import logging

from database import get_db, init_db
from models import Setup, Trade, Config
from scanner import run_full_scan, scan_state
from position_sizing import calculate_position
from scheduler import start_scheduler, stop_scheduler
from alerts import test_telegram, send_telegram_alert
from intraday_router import router as intraday_router
from telegram_router import router as telegram_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    init_db()
    _seed_defaults()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="NSE Trading System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intraday_router)
app.include_router(telegram_router)


# --- Pydantic Schemas ---

class TradeCreate(BaseModel):
    symbol: str
    strategy: str
    entry_date: date
    entry_price: float
    quantity: int
    stop_loss: float
    target_1: float
    target_2: float
    capital_deployed: float
    risk_amount: float
    followed_plan: bool = True
    notes: Optional[str] = None
    is_paper_trade: bool = False


class TradeUpdate(BaseModel):
    exit_date: Optional[date] = None
    exit_price: Optional[float] = None
    exit_type: Optional[str] = None
    notes: Optional[str] = None
    followed_plan: Optional[bool] = None


class ConfigUpdate(BaseModel):
    configs: dict[str, str]


class PositionRequest(BaseModel):
    capital: float
    risk_percent: float
    entry_price: float
    stop_loss: float
    target_1: Optional[float] = None
    target_2: Optional[float] = None


def _seed_defaults():
    db = next(get_db())
    defaults = {
        "capital": "500000",
        "risk_percent": "1.0",
        "max_trades_per_month": "10",
        "telegram_token": "",
        "telegram_chat_id": "",
        "index_filter": "NIFTY500",
        "paper_trade_mode": "false",
    }
    for key, value in defaults.items():
        existing = db.query(Config).filter(Config.key == key).first()
        if not existing:
            db.add(Config(key=key, value=value))
    db.commit()
    db.close()


# --- Setup Routes ---

@app.get("/api/setups/today")
def get_today_setups(db: Session = Depends(get_db)):
    setups = db.query(Setup).filter(Setup.scan_date == date.today()).all()
    return setups


@app.get("/api/setups/history")
def get_setup_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    strategy: Optional[str] = None,
    min_score: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Setup)
    if start_date:
        query = query.filter(Setup.scan_date >= date.fromisoformat(start_date))
    if end_date:
        query = query.filter(Setup.scan_date <= date.fromisoformat(end_date))
    if strategy:
        query = query.filter(Setup.strategy == strategy)
    if min_score is not None:
        query = query.filter(Setup.confirmation_score >= min_score)
    return query.order_by(Setup.scan_date.desc()).all()


# --- Scan Routes ---

@app.post("/api/scan/trigger")
def trigger_scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if scan_state["running"]:
        return {"message": "Scan already in progress", "status": "running"}

    def run_scan():
        from database import SessionLocal
        session = SessionLocal()
        try:
            run_full_scan(db_session=session)
        finally:
            session.close()

    thread = threading.Thread(target=run_scan, daemon=True)
    thread.start()

    return {"message": "Scan triggered", "status": "started"}


@app.get("/api/scan/status")
def get_scan_status():
    return {
        "running": scan_state["running"],
        "progress": scan_state["progress"],
        "total": scan_state["total"],
        "current_symbol": scan_state["current_symbol"],
        "last_scan": scan_state["last_scan"],
        "results_count": len(scan_state["results"]),
    }


# --- Trade Routes ---

@app.get("/api/trades")
def get_trades(db: Session = Depends(get_db)):
    return db.query(Trade).order_by(Trade.entry_date.desc()).all()


@app.post("/api/trades")
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    db_trade = Trade(**trade.model_dump())
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return db_trade


@app.put("/api/trades/{trade_id}")
def update_trade(trade_id: int, trade_update: TradeUpdate, db: Session = Depends(get_db)):
    db_trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not db_trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    update_data = trade_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_trade, key, value)

    # Auto-calculate PnL on exit
    if db_trade.exit_price and db_trade.entry_price and db_trade.quantity:
        db_trade.pnl = round((db_trade.exit_price - db_trade.entry_price) * db_trade.quantity, 2)
        db_trade.pnl_percent = round(
            (db_trade.exit_price - db_trade.entry_price) / db_trade.entry_price * 100, 2
        )

    db.commit()
    db.refresh(db_trade)
    return db_trade


# --- Analytics Routes ---

@app.get("/api/analytics/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    trades = db.query(Trade).filter(Trade.exit_price.isnot(None)).all()

    if not trades:
        return {
            "total_trades": 0, "win_rate": 0, "avg_rr": 0, "profit_factor": 0,
            "best_trade": 0, "worst_trade": 0, "current_streak": 0,
            "plan_followed_pct": 0, "total_pnl": 0,
            "open_trades": db.query(Trade).filter(Trade.exit_price.is_(None)).count(),
        }

    wins = [t for t in trades if t.pnl and t.pnl > 0]
    losses = [t for t in trades if t.pnl and t.pnl < 0]

    total_pnl = sum(t.pnl for t in trades if t.pnl)
    win_rate = len(wins) / len(trades) * 100 if trades else 0

    gross_profit = sum(t.pnl for t in wins) if wins else 0
    gross_loss = abs(sum(t.pnl for t in losses)) if losses else 1
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

    pnls = [t.pnl for t in trades if t.pnl]
    best_trade = max(pnls) if pnls else 0
    worst_trade = min(pnls) if pnls else 0

    # Calculate RR
    rrs = []
    for t in trades:
        if t.pnl and t.entry_price and t.stop_loss:
            risk = abs(t.entry_price - t.stop_loss) * t.quantity
            if risk > 0:
                rrs.append(t.pnl / risk)
    avg_rr = sum(rrs) / len(rrs) if rrs else 0

    # Current streak
    sorted_trades = sorted(trades, key=lambda t: t.exit_date or date.min)
    streak = 0
    for t in reversed(sorted_trades):
        if t.pnl and t.pnl > 0:
            streak += 1
        elif t.pnl and t.pnl < 0:
            streak -= 1
            break
        else:
            break

    all_trades = db.query(Trade).all()
    plan_followed = sum(1 for t in all_trades if t.followed_plan) / len(all_trades) * 100 if all_trades else 0

    return {
        "total_trades": len(trades),
        "win_rate": round(win_rate, 1),
        "avg_rr": round(avg_rr, 2),
        "profit_factor": round(profit_factor, 2),
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
        "current_streak": streak,
        "plan_followed_pct": round(plan_followed, 1),
        "total_pnl": round(total_pnl, 2),
        "open_trades": db.query(Trade).filter(Trade.exit_price.is_(None)).count(),
    }


@app.get("/api/analytics/equity")
def get_equity_curve(db: Session = Depends(get_db)):
    trades = (
        db.query(Trade)
        .filter(Trade.exit_price.isnot(None))
        .order_by(Trade.exit_date)
        .all()
    )

    cumulative = 0
    curve = []
    for t in trades:
        if t.pnl:
            cumulative += t.pnl
            curve.append({
                "date": t.exit_date.isoformat() if t.exit_date else "",
                "pnl": round(t.pnl, 2),
                "cumulative": round(cumulative, 2),
                "symbol": t.symbol,
                "strategy": t.strategy,
            })
    return curve


@app.get("/api/analytics/monthly")
def get_monthly_pnl(db: Session = Depends(get_db)):
    trades = (
        db.query(Trade)
        .filter(Trade.exit_price.isnot(None))
        .order_by(Trade.exit_date)
        .all()
    )

    monthly = {}
    for t in trades:
        if t.exit_date and t.pnl:
            key = t.exit_date.strftime("%Y-%m")
            monthly[key] = monthly.get(key, 0) + t.pnl

    return [{"month": k, "pnl": round(v, 2)} for k, v in sorted(monthly.items())]


@app.get("/api/analytics/by-strategy")
def get_strategy_analytics(db: Session = Depends(get_db)):
    trades = db.query(Trade).filter(Trade.exit_price.isnot(None)).all()

    result = {}
    for strategy in ["BREAKOUT", "REVERSAL"]:
        strades = [t for t in trades if t.strategy == strategy]
        wins = [t for t in strades if t.pnl and t.pnl > 0]
        losses = [t for t in strades if t.pnl and t.pnl < 0]
        total_pnl = sum(t.pnl for t in strades if t.pnl)

        result[strategy] = {
            "total": len(strades),
            "wins": len(wins),
            "losses": len(losses),
            "total_pnl": round(total_pnl, 2),
            "win_rate": round(len(wins) / len(strades) * 100, 1) if strades else 0,
        }
    return result


# --- Position Sizing ---

@app.post("/api/position/calculate")
def calculate_pos(req: PositionRequest):
    result = calculate_position(
        req.capital, req.risk_percent, req.entry_price, req.stop_loss,
        req.target_1, req.target_2,
    )
    if not result:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    return result


# --- Config Routes ---

@app.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    configs = db.query(Config).all()
    return {c.key: c.value for c in configs}


@app.post("/api/config")
def update_config(config_update: ConfigUpdate, db: Session = Depends(get_db)):
    for key, value in config_update.configs.items():
        existing = db.query(Config).filter(Config.key == key).first()
        if existing:
            existing.value = value
        else:
            db.add(Config(key=key, value=value))
    db.commit()
    return {"message": "Config updated"}


@app.post("/api/config/test-telegram")
async def test_telegram_config(db: Session = Depends(get_db)):
    token = db.query(Config).filter(Config.key == "telegram_token").first()
    chat_id = db.query(Config).filter(Config.key == "telegram_chat_id").first()

    if not token or not chat_id or not token.value or not chat_id.value:
        raise HTTPException(status_code=400, detail="Telegram not configured")

    success = await test_telegram(token.value, chat_id.value)
    return {"success": success}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
