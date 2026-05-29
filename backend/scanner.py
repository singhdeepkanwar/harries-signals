import pandas as pd
import yfinance as yf
import os
import time
import logging
from datetime import datetime, date, timedelta
from pathlib import Path
from indicators import (
    calculate_rsi, calculate_macd, calculate_ema, calculate_volume_ratio,
    detect_consolidation, detect_downtrend, detect_bullish_divergence,
    detect_double_bottom, volume_trend_analysis,
)

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
CSV_PATH = Path(__file__).parent / "nifty500.csv"


def load_nifty500_symbols() -> list[str]:
    df = pd.read_csv(CSV_PATH)
    col = df.columns[0]
    symbols = df[col].tolist()
    # Ensure .NS suffix
    return [s if s.endswith(".NS") else f"{s}.NS" for s in symbols]


def fetch_stock_data(symbol: str, period: str = "1y") -> pd.DataFrame | None:
    cache_file = CACHE_DIR / f"{symbol.replace('.', '_')}.parquet"

    if cache_file.exists():
        mod_time = datetime.fromtimestamp(cache_file.stat().st_mtime)
        if datetime.now() - mod_time < timedelta(days=1):
            try:
                return pd.read_parquet(cache_file)
            except Exception:
                pass

    try:
        df = yf.download(symbol, period=period, progress=False, auto_adjust=True)
        if df is not None and len(df) > 0:
            # Flatten MultiIndex columns if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            df.to_parquet(cache_file)
            return df
    except Exception as e:
        logger.warning(f"Failed to fetch {symbol}: {e}")

    return None


def batch_fetch_stocks(symbols: list[str], period: str = "1y", progress_callback=None) -> dict:
    """Fetch data for multiple stocks with caching and rate limiting."""
    results = {}
    total = len(symbols)

    # Check cache first
    uncached = []
    for symbol in symbols:
        cache_file = CACHE_DIR / f"{symbol.replace('.', '_')}.parquet"
        if cache_file.exists():
            mod_time = datetime.fromtimestamp(cache_file.stat().st_mtime)
            if datetime.now() - mod_time < timedelta(days=1):
                try:
                    results[symbol] = pd.read_parquet(cache_file)
                    continue
                except Exception:
                    pass
        uncached.append(symbol)

    if uncached:
        # Batch download in groups of 20
        batch_size = 20
        for i in range(0, len(uncached), batch_size):
            batch = uncached[i:i + batch_size]
            try:
                data = yf.download(batch, period=period, progress=False,
                                   auto_adjust=True, group_by="ticker", threads=True)

                if data is not None and len(data) > 0:
                    for symbol in batch:
                        try:
                            if len(batch) == 1:
                                sdf = data.copy()
                                if isinstance(sdf.columns, pd.MultiIndex):
                                    sdf.columns = sdf.columns.get_level_values(0)
                            else:
                                sdf = data[symbol].copy()
                            sdf = sdf.dropna(how="all")
                            if len(sdf) > 0:
                                results[symbol] = sdf
                                cache_file = CACHE_DIR / f"{symbol.replace('.', '_')}.parquet"
                                sdf.to_parquet(cache_file)
                        except Exception as e:
                            logger.warning(f"Error processing {symbol}: {e}")
            except Exception as e:
                logger.warning(f"Batch download failed: {e}")

            if progress_callback:
                done = len(results)
                progress_callback(done, total)

            time.sleep(0.5)

    return results


def scan_breakout(df: pd.DataFrame, symbol: str) -> dict | None:
    """Strategy 1: Momentum/Breakout Scanner."""
    try:
        if len(df) < 250:
            return None

        display_symbol = symbol.replace(".NS", "")
        close = df["Close"]
        today_close = close.iloc[-1]

        # Filter 1: Within 10% of 52-week high
        high_52w = df["High"].iloc[-252:].max()
        if today_close < high_52w * 0.90:
            return None

        # Filter 2: Above 50 EMA and 200 EMA
        ema_50 = calculate_ema(df, 50)
        ema_200 = calculate_ema(df, 200)
        if ema_50 is None or ema_200 is None or len(ema_50) == 0 or len(ema_200) == 0:
            return None
        if today_close < ema_50.iloc[-1] or today_close < ema_200.iloc[-1]:
            return None

        # Filter 3: Consolidation detection (wider range allowed)
        consolidation = detect_consolidation(df, min_days=5, max_days=30, max_range_pct=12.0)
        if not consolidation["detected"]:
            return None

        cons_high = consolidation["high"]
        cons_low = consolidation["low"]

        # Filter 4: Breakout, retest, or approaching breakout (within 2%)
        entry_type = None
        if today_close > cons_high:
            entry_type = "BREAKOUT"
        elif today_close >= cons_high * 0.98:
            # Near breakout level or retesting
            entry_type = "RETEST"
        else:
            # Check for retest in last 5 days
            for i in range(-5, 0):
                if len(df) + i >= 0:
                    if df["High"].iloc[i] >= cons_high * 0.98 and close.iloc[i] >= cons_high * 0.97:
                        entry_type = "RETEST"
                        break

        if entry_type is None:
            return None

        # Confirmation scoring (0-4)
        score = 0

        # RSI confirmation: RSI > 50 and rising
        rsi = calculate_rsi(df)
        rsi_val = rsi.iloc[-1] if len(rsi) > 0 else 0
        if len(rsi) >= 4 and rsi_val > 50 and rsi.iloc[-1] > rsi.iloc[-4]:
            score += 1

        # MACD confirmation
        macd_df = calculate_macd(df)
        macd_signal_str = "NONE"
        if macd_df is not None and len(macd_df) > 0:
            macd_cols = list(macd_df.columns)
            # Columns are: MACD_12_26_9, MACDs_12_26_9, MACDh_12_26_9
            ml = macd_df[macd_cols[0]]  # MACD line
            sl = macd_df[macd_cols[1]]  # Signal line
            for i in range(-5, 0):
                if len(ml) + i > 0 and len(ml) + i - 1 >= 0:
                    if ml.iloc[i] > sl.iloc[i] and ml.iloc[i - 1] <= sl.iloc[i - 1]:
                        macd_signal_str = "BULLISH_CROSS"
                        score += 1
                        break
            if macd_signal_str == "NONE" and len(ml) > 0 and len(sl) > 0:
                if ml.iloc[-1] > sl.iloc[-1]:
                    macd_signal_str = "ABOVE"
                    score += 1  # MACD above signal is also bullish

        # Volume confirmation: any day in last 3 had above-average volume
        vol_ratio = calculate_volume_ratio(df)
        # Also check last 3 days for volume spike
        avg_vol_20 = df["Volume"].iloc[-21:-1].mean()
        max_recent_vol = df["Volume"].iloc[-3:].max()
        best_vol_ratio = max_recent_vol / avg_vol_20 if avg_vol_20 > 0 else 0
        if best_vol_ratio > 1.3:
            score += 1
            vol_ratio = round(best_vol_ratio, 2)

        # Price above 20 EMA (short-term strength)
        ema_20 = calculate_ema(df, 20)
        if len(ema_20) > 0 and today_close > ema_20.iloc[-1]:
            score += 1

        if score < 2:
            return None

        # Calculate targets
        cons_height = cons_high - cons_low
        entry_price = round(today_close, 2)
        stop_loss = round(cons_low, 2)
        target_1 = round(cons_high + cons_height, 2)

        # Target 2: next resistance - highest high in last 6 months above breakout
        six_month = df["High"].iloc[-126:]
        highs_above = six_month[six_month > cons_high]
        target_2 = round(highs_above.max(), 2) if len(highs_above) > 0 else round(target_1 * 1.05, 2)
        if target_2 <= target_1:
            target_2 = round(target_1 * 1.05, 2)

        risk_pct = round((entry_price - stop_loss) / entry_price * 100, 2) if entry_price > 0 else 0

        return {
            "symbol": display_symbol,
            "strategy": "BREAKOUT",
            "entry_type": entry_type,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "target_1": target_1,
            "target_2": target_2,
            "risk_percent": risk_pct,
            "confirmation_score": score,
            "rsi": round(rsi_val, 2),
            "macd_signal": macd_signal_str,
            "volume_ratio": round(vol_ratio, 2),
            "consolidation_days": consolidation["days"],
            "date": date.today().isoformat(),
        }

    except Exception as e:
        logger.warning(f"Breakout scan error for {symbol}: {e}")
        return None


def scan_reversal(df: pd.DataFrame, symbol: str) -> dict | None:
    """Strategy 2: Reversal/CHoCH Scanner."""
    try:
        if len(df) < 250:
            return None

        display_symbol = symbol.replace(".NS", "")
        close = df["Close"]
        today_close = close.iloc[-1]

        # Filter: Price above 50
        if today_close < 50:
            return None

        # Filter: Average daily volume > 5 lakh (500,000)
        avg_vol = df["Volume"].iloc[-20:].mean()
        if avg_vol < 500000:
            return None

        # Detect downtrend
        downtrend = detect_downtrend(df)
        if not downtrend["detected"]:
            return None

        last_swing_low = downtrend.get("last_swing_low")
        last_lower_high = downtrend.get("last_lower_high")

        if not last_swing_low or not last_lower_high:
            return None

        choch_level = last_lower_high[1]

        # CHoCH confirmation: today's close > last lower high
        if today_close <= choch_level:
            return None

        # Volume check: any of the last 5 days had above-average volume
        avg_vol_20 = df["Volume"].iloc[-21:-1].mean()
        max_recent_vol = df["Volume"].iloc[-5:].max()
        vol_ratio = max_recent_vol / avg_vol_20 if avg_vol_20 > 0 else 0
        if vol_ratio < 1.0:
            return None

        # Entry type
        entry_type = "AGGRESSIVE" if today_close > choch_level * 1.02 else "CONSERVATIVE"

        # Confirmation scoring (0-5, need >= 2)
        score = 0

        # 1. Bullish RSI divergence
        rsi = calculate_rsi(df)
        divergence = detect_bullish_divergence(df, rsi) if len(rsi) > 0 else False
        if divergence:
            score += 1

        # 2. MACD histogram turned positive
        macd_df = calculate_macd(df)
        if macd_df is not None and len(macd_df) > 0:
            hist_col = [c for c in macd_df.columns if "h" in c.lower() and "MACD" in c]
            if hist_col:
                hist = macd_df[hist_col[0]]
                for i in range(-3, 0):
                    if len(hist) + i > 0 and len(hist) + i - 1 >= 0:
                        if hist.iloc[i] > 0 and hist.iloc[i - 1] <= 0:
                            score += 1
                            break

        # 3. Price held above 20 EMA for 3+ consecutive days
        ema_20 = calculate_ema(df, 20)
        if len(ema_20) >= 3:
            above_ema = all(close.iloc[-j] > ema_20.iloc[-j] for j in range(1, 4))
            if above_ema:
                score += 1

        # 4. Double bottom pattern
        if detect_double_bottom(df):
            score += 1

        # 5. Volume trend (declining on red, expanding on green)
        if volume_trend_analysis(df):
            score += 1

        if score < 2:
            return None

        # Calculate targets
        entry_price = round(today_close, 2)
        stop_loss = round(last_swing_low[1], 2)

        # Target 1: previous resistance in downtrend
        swing_highs = downtrend.get("swing_highs", [])
        resistances = [sh[1] for sh in swing_highs if sh[1] > today_close]
        target_1 = round(min(resistances), 2) if resistances else round(entry_price * 1.10, 2)

        # Target 2: origin of downtrend
        origin_high = downtrend.get("origin_high")
        target_2 = round(origin_high, 2) if origin_high else round(entry_price * 1.20, 2)

        risk_pct = round((entry_price - stop_loss) / entry_price * 100, 2) if entry_price > 0 else 0

        rsi_val = round(rsi.iloc[-1], 2) if len(rsi) > 0 else 0

        return {
            "symbol": display_symbol,
            "strategy": "REVERSAL",
            "entry_type": entry_type,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "target_1": target_1,
            "target_2": target_2,
            "risk_percent": risk_pct,
            "confirmation_score": score,
            "choch_level": round(choch_level, 2),
            "divergence_detected": divergence,
            "downtrend_duration_days": downtrend["duration_days"],
            "rsi": rsi_val,
            "volume_ratio": round(vol_ratio, 2),
            "date": date.today().isoformat(),
        }

    except Exception as e:
        logger.warning(f"Reversal scan error for {symbol}: {e}")
        return None


# Global scan state
scan_state = {
    "running": False,
    "progress": 0,
    "total": 0,
    "current_symbol": "",
    "results": [],
    "last_scan": None,
}


def run_full_scan(db_session=None):
    """Run both strategies on all Nifty 500 stocks."""
    from models import Setup

    scan_state["running"] = True
    scan_state["results"] = []

    symbols = load_nifty500_symbols()
    scan_state["total"] = len(symbols)
    scan_state["progress"] = 0

    def update_progress(done, total):
        scan_state["progress"] = done

    # Batch fetch all data
    stock_data = batch_fetch_stocks(symbols, progress_callback=update_progress)

    setups = []
    for i, symbol in enumerate(symbols):
        scan_state["current_symbol"] = symbol.replace(".NS", "")
        scan_state["progress"] = i + 1

        df = stock_data.get(symbol)
        if df is None or len(df) < 250:
            continue

        # Run both strategies
        breakout = scan_breakout(df, symbol)
        if breakout:
            setups.append(breakout)

        reversal = scan_reversal(df, symbol)
        if reversal:
            setups.append(reversal)

    # Save to DB if session provided
    if db_session:
        for setup_data in setups:
            setup = Setup(
                symbol=setup_data["symbol"],
                strategy=setup_data["strategy"],
                entry_type=setup_data["entry_type"],
                entry_price=setup_data["entry_price"],
                stop_loss=setup_data["stop_loss"],
                target_1=setup_data["target_1"],
                target_2=setup_data["target_2"],
                risk_percent=setup_data["risk_percent"],
                confirmation_score=setup_data["confirmation_score"],
                rsi=setup_data.get("rsi"),
                macd_signal=setup_data.get("macd_signal"),
                volume_ratio=setup_data.get("volume_ratio"),
                consolidation_days=setup_data.get("consolidation_days"),
                choch_level=setup_data.get("choch_level"),
                divergence_detected=setup_data.get("divergence_detected"),
                downtrend_duration_days=setup_data.get("downtrend_duration_days"),
                scan_date=date.today(),
                status="ACTIVE",
            )
            db_session.add(setup)
        db_session.commit()

    scan_state["results"] = setups
    scan_state["running"] = False
    scan_state["last_scan"] = datetime.now().isoformat()

    return setups
