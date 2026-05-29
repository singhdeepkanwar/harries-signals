import pandas as pd


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    if len(df) < period + 1:
        return pd.Series(dtype=float)
    close = df["Close"]
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    if len(df) < slow + signal:
        return pd.DataFrame()
    close = df["Close"]
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return pd.DataFrame({
        f"MACD_{fast}_{slow}_{signal}": macd_line,
        f"MACDs_{fast}_{slow}_{signal}": signal_line,
        f"MACDh_{fast}_{slow}_{signal}": histogram,
    })


def calculate_ema(df: pd.DataFrame, period: int) -> pd.Series:
    if len(df) < period:
        return pd.Series(dtype=float)
    return df["Close"].ewm(span=period, adjust=False).mean()


def calculate_volume_ratio(df: pd.DataFrame, period: int = 20) -> float:
    if len(df) < period + 1:
        return 0.0
    avg_volume = df["Volume"].iloc[-(period + 1):-1].mean()
    if avg_volume == 0:
        return 0.0
    return df["Volume"].iloc[-1] / avg_volume


def detect_consolidation(df: pd.DataFrame, min_days: int = 7, max_days: int = 20, max_range_pct: float = 8.0):
    """Detect consolidation in the last min_days to max_days candles."""
    for lookback in range(max_days, min_days - 1, -1):
        if len(df) < lookback:
            continue
        window = df.iloc[-lookback:]
        high = window["High"].max()
        low = window["Low"].min()
        lowest_close = window["Close"].min()
        if lowest_close == 0:
            continue
        range_pct = ((high - low) / lowest_close) * 100
        if range_pct < max_range_pct:
            return {
                "detected": True,
                "days": lookback,
                "high": high,
                "low": low,
                "range_pct": round(range_pct, 2),
            }
    return {"detected": False}


def detect_downtrend(df: pd.DataFrame, months: int = 6):
    """Detect downtrend with at least 2 lower highs and 2 lower lows in last N months."""
    trading_days = months * 21
    if len(df) < trading_days:
        return {"detected": False}

    window = df.iloc[-trading_days:]

    # Find swing highs and lows using 5-day pivots
    swing_highs = []
    swing_lows = []
    pivot_range = 5

    for i in range(pivot_range, len(window) - pivot_range):
        high_val = window["High"].iloc[i]
        low_val = window["Low"].iloc[i]

        is_swing_high = all(
            high_val >= window["High"].iloc[i - j] and high_val >= window["High"].iloc[i + j]
            for j in range(1, pivot_range + 1)
        )
        is_swing_low = all(
            low_val <= window["Low"].iloc[i - j] and low_val <= window["Low"].iloc[i + j]
            for j in range(1, pivot_range + 1)
        )

        if is_swing_high:
            swing_highs.append((i, high_val))
        if is_swing_low:
            swing_lows.append((i, low_val))

    # Check for at least 2 lower highs
    lower_highs = 0
    for i in range(1, len(swing_highs)):
        if swing_highs[i][1] < swing_highs[i - 1][1]:
            lower_highs += 1

    # Check for at least 2 lower lows
    lower_lows = 0
    for i in range(1, len(swing_lows)):
        if swing_lows[i][1] < swing_lows[i - 1][1]:
            lower_lows += 1

    if lower_highs >= 2 and lower_lows >= 2:
        duration = len(window)
        # Find the most recent lower high before the most recent swing low
        last_swing_low = swing_lows[-1] if swing_lows else None
        last_lower_high = None
        if last_swing_low and swing_highs:
            for sh in reversed(swing_highs):
                if sh[0] < last_swing_low[0]:
                    last_lower_high = sh
                    break

        return {
            "detected": True,
            "duration_days": duration,
            "swing_highs": swing_highs,
            "swing_lows": swing_lows,
            "last_swing_low": last_swing_low,
            "last_lower_high": last_lower_high,
            "origin_high": max(swing_highs, key=lambda x: x[1])[1] if swing_highs else None,
        }

    return {"detected": False}


def detect_bullish_divergence(df: pd.DataFrame, rsi: pd.Series, lookback: int = 30) -> bool:
    """Detect bullish RSI divergence: price lower low but RSI higher low."""
    if len(df) < lookback or len(rsi) < lookback:
        return False

    price_window = df["Close"].iloc[-lookback:]
    rsi_window = rsi.iloc[-lookback:]

    # Find two lows in price
    mid = lookback // 2
    first_half_low_idx = price_window.iloc[:mid].idxmin()
    second_half_low_idx = price_window.iloc[mid:].idxmin()

    if first_half_low_idx == second_half_low_idx:
        return False

    price_low_1 = price_window.loc[first_half_low_idx]
    price_low_2 = price_window.loc[second_half_low_idx]

    if first_half_low_idx not in rsi_window.index or second_half_low_idx not in rsi_window.index:
        return False

    rsi_low_1 = rsi_window.loc[first_half_low_idx]
    rsi_low_2 = rsi_window.loc[second_half_low_idx]

    # Price made lower low but RSI made higher low
    return price_low_2 < price_low_1 and rsi_low_2 > rsi_low_1


def detect_double_bottom(df: pd.DataFrame, lookback: int = 30, tolerance_pct: float = 3.0,
                         min_gap: int = 10, max_gap: int = 30) -> bool:
    """Detect double bottom pattern."""
    if len(df) < lookback:
        return False

    window = df.iloc[-lookback:]

    # Find swing lows
    swing_lows = []
    for i in range(2, len(window) - 2):
        low = window["Low"].iloc[i]
        if (low <= window["Low"].iloc[i - 1] and low <= window["Low"].iloc[i - 2] and
                low <= window["Low"].iloc[i + 1] and low <= window["Low"].iloc[i + 2]):
            swing_lows.append((i, low))

    # Check pairs of swing lows
    for i in range(len(swing_lows)):
        for j in range(i + 1, len(swing_lows)):
            gap = swing_lows[j][0] - swing_lows[i][0]
            if min_gap <= gap <= max_gap:
                diff_pct = abs(swing_lows[j][1] - swing_lows[i][1]) / swing_lows[i][1] * 100
                if diff_pct <= tolerance_pct:
                    return True
    return False


def volume_trend_analysis(df: pd.DataFrame, lookback: int = 10) -> bool:
    """Check if volume is declining on red days and expanding on green days."""
    if len(df) < lookback:
        return False

    window = df.iloc[-lookback:]
    red_volumes = []
    green_volumes = []

    for i in range(len(window)):
        if window["Close"].iloc[i] < window["Open"].iloc[i]:
            red_volumes.append(window["Volume"].iloc[i])
        else:
            green_volumes.append(window["Volume"].iloc[i])

    if len(red_volumes) < 2 or len(green_volumes) < 2:
        return False

    # Check if average green volume > average red volume
    avg_green = sum(green_volumes) / len(green_volumes)
    avg_red = sum(red_volumes) / len(red_volumes)

    return avg_green > avg_red * 1.2
