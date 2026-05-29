from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date
from datetime import datetime, date
from database import Base


class Setup(Base):
    __tablename__ = "setups"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    strategy = Column(String)  # BREAKOUT or REVERSAL
    entry_type = Column(String)  # BREAKOUT/RETEST or AGGRESSIVE/CONSERVATIVE
    entry_price = Column(Float)
    stop_loss = Column(Float)
    target_1 = Column(Float)
    target_2 = Column(Float)
    risk_percent = Column(Float)
    confirmation_score = Column(Integer)
    rsi = Column(Float, nullable=True)
    macd_signal = Column(String, nullable=True)
    volume_ratio = Column(Float, nullable=True)
    consolidation_days = Column(Integer, nullable=True)
    choch_level = Column(Float, nullable=True)
    divergence_detected = Column(Boolean, nullable=True)
    downtrend_duration_days = Column(Integer, nullable=True)
    scan_date = Column(Date, default=date.today)
    status = Column(String, default="ACTIVE")  # ACTIVE/TRIGGERED/EXPIRED
    created_at = Column(DateTime, default=datetime.utcnow)


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    strategy = Column(String)
    entry_date = Column(Date)
    entry_price = Column(Float)
    quantity = Column(Integer)
    stop_loss = Column(Float)
    target_1 = Column(Float)
    target_2 = Column(Float)
    capital_deployed = Column(Float)
    risk_amount = Column(Float)
    exit_date = Column(Date, nullable=True)
    exit_price = Column(Float, nullable=True)
    exit_type = Column(String, nullable=True)  # SL/TARGET1/TARGET2/MANUAL
    pnl = Column(Float, nullable=True)
    pnl_percent = Column(Float, nullable=True)
    followed_plan = Column(Boolean, default=True)
    notes = Column(String, nullable=True)
    is_paper_trade = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Config(Base):
    __tablename__ = "config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)


class IntradayScan(Base):
    """Stores the Open=Low / Open=High stocks found each day."""
    __tablename__ = "intraday_scans"

    id = Column(Integer, primary_key=True, index=True)
    scan_date = Column(Date, index=True, default=date.today)
    scan_time = Column(DateTime, default=datetime.utcnow)
    symbol = Column(String, index=True)
    pattern = Column(String)          # "OPEN_EQ_LOW" or "OPEN_EQ_HIGH"
    direction = Column(String)        # "BUY" or "SELL"
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    trigger_price = Column(Float)     # high for BUY, low for SELL
    volume = Column(Integer)
    status = Column(String, default="WATCHING")  # WATCHING / TRIGGERED / EXPIRED


class IntradayAlert(Base):
    """Stores fired BUY/SELL alerts."""
    __tablename__ = "intraday_alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_date = Column(Date, index=True, default=date.today)
    alert_time = Column(DateTime, default=datetime.utcnow)
    symbol = Column(String, index=True)
    direction = Column(String)        # "BUY" or "SELL"
    pattern = Column(String)
    trigger_price = Column(Float)
    cmp = Column(Float)
    pct_move = Column(Float)
    volume = Column(Integer)
    vwap = Column(Float, nullable=True)
    day_high = Column(Float, nullable=True)
    day_low = Column(Float, nullable=True)


class TelegramMessage(Base):
    """Log of messages sent from the web UI."""
    __tablename__ = "telegram_messages"

    id = Column(Integer, primary_key=True, index=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    text = Column(String)
    sent_by = Column(String, default="web")
    status = Column(String, default="sent")  # sent / failed
