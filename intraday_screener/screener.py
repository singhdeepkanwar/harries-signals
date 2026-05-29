#!/usr/bin/env python3
"""
Intraday Open=Low / Open=High Screener for Nifty 200
=====================================================

Runs automatically at Indian market open. After the first 5-minute candle:

  Pattern A (Open = Low):  Bullish — stock opened at its low and moved up.
                           Alert when price breaks ABOVE 5-min high.

  Pattern B (Open = High): Bearish — stock opened at its high and moved down.
                           Alert when price breaks BELOW 5-min low.

Usage:
  python screener.py                  # Auto-start, wait for 9:20 AM IST
  python screener.py --now            # Run scan immediately (for testing after market hours)
  python screener.py --test           # Scan only, print results, no monitoring
  python screener.py --daemon         # Run as daemon, auto-starts every trading day at 9:15 AM
  python screener.py                  # Exact match: Open == Low or Open == High

Environment variables:
  TELEGRAM_TOKEN    — Bot token from @BotFather
  TELEGRAM_CHAT_ID  — Your chat/group ID
"""

import os
import csv
import sys
import time
import logging
import asyncio
import argparse
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

import yfinance as yf
import pandas as pd
import httpx

# ── DB path (shared with FastAPI backend) ──
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
DB_PATH = os.path.join(BACKEND_DIR, "trading.db")

# ─── Configuration ───────────────────────────────────────────────────────────

IST = ZoneInfo("Asia/Kolkata")

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

MONITOR_INTERVAL = 2  # seconds between price checks

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NIFTY200_CSV = os.path.join(SCRIPT_DIR, "nifty200.csv")

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("screener")

# ─── Telegram ────────────────────────────────────────────────────────────────

async def _send_telegram(message: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        log.warning("Telegram not configured (set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID)")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                log.info("Telegram alert sent")
            else:
                log.error(f"Telegram error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log.error(f"Telegram send failed: {e}")


def notify(message: str):
    """Send message to Telegram, splitting if too long (4096 char limit)."""
    chunks = []
    if len(message) <= 4000:
        chunks = [message]
    else:
        lines = message.split("\n")
        chunk = ""
        for line in lines:
            if len(chunk) + len(line) + 1 > 4000:
                chunks.append(chunk)
                chunk = line + "\n"
            else:
                chunk += line + "\n"
        if chunk.strip():
            chunks.append(chunk)

    for c in chunks:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_send_telegram(c))
        except RuntimeError:
            asyncio.run(_send_telegram(c))


# ─── Stock List ──────────────────────────────────────────────────────────────

def load_symbols() -> list[str]:
    symbols = []
    with open(NIFTY200_CSV, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sym = row["Symbol"].strip()
            if sym and not sym.startswith("#"):
                symbols.append(sym)
    log.info(f"Loaded {len(symbols)} symbols from {os.path.basename(NIFTY200_CSV)}")
    return symbols


# ─── Data Fetching ───────────────────────────────────────────────────────────

def fetch_first_5min_candles(symbols: list[str]) -> dict:
    """
    Fetch 5-min candles and extract the FIRST candle of the most recent trading day.
    Uses period="5d" so it works both during and after market hours.
    Returns {symbol: {open, high, low, close, volume, date}}.
    """
    candles = {}
    chunk_size = 40

    for i in range(0, len(symbols), chunk_size):
        chunk = symbols[i : i + chunk_size]
        tickers_str = " ".join(chunk)

        try:
            data = yf.download(
                tickers_str,
                interval="5m",
                period="5d",
                progress=False,
                group_by="ticker",
            )

            if data.empty:
                continue

            for sym in chunk:
                try:
                    sym_data = data if len(chunk) == 1 else data[sym]
                    sym_data = sym_data.dropna(subset=["Open"])
                    if sym_data.empty:
                        continue

                    idx = sym_data.index
                    if idx.tz is None:
                        idx = idx.tz_localize("UTC").tz_convert(IST)
                    else:
                        idx = idx.tz_convert(IST)
                    sym_data.index = idx

                    last_date = idx[-1].date()
                    day_data = sym_data[sym_data.index.date == last_date]
                    if day_data.empty:
                        continue

                    first = day_data.iloc[0]
                    o, h, l, c = (
                        float(first["Open"]),
                        float(first["High"]),
                        float(first["Low"]),
                        float(first["Close"]),
                    )
                    v = int(first["Volume"]) if first["Volume"] > 0 else 0
                    if o <= 0:
                        continue

                    candles[sym] = {
                        "open": o,
                        "high": h,
                        "low": l,
                        "close": c,
                        "volume": v,
                        "date": str(last_date),
                    }
                except (KeyError, IndexError):
                    continue

        except Exception as e:
            log.error(f"Fetch error for chunk {i // chunk_size + 1}: {e}")

        time.sleep(0.5)

    log.info(f"Fetched first 5-min candle for {len(candles)}/{len(symbols)} stocks")
    return candles


def fetch_current_data(symbols: list[str]) -> dict:
    """Fetch latest price, day high/low, and cumulative volume."""
    result = {}
    if not symbols:
        return result

    chunk_size = 40
    for i in range(0, len(symbols), chunk_size):
        chunk = symbols[i : i + chunk_size]
        tickers_str = " ".join(chunk)
        try:
            data = yf.download(
                tickers_str,
                interval="1m",
                period="1d",
                progress=False,
                group_by="ticker",
            )
            if data.empty:
                continue

            for sym in chunk:
                try:
                    sym_data = data if len(chunk) == 1 else data[sym]
                    if sym_data.empty:
                        continue

                    latest = sym_data.iloc[-1]
                    result[sym] = {
                        "price": float(latest["Close"]),
                        "day_high": float(sym_data["High"].max()),
                        "day_low": float(sym_data["Low"].min()),
                        "volume": int(sym_data["Volume"].sum()),
                        "vwap": round(
                            float(
                                (sym_data["Close"] * sym_data["Volume"]).sum()
                                / max(sym_data["Volume"].sum(), 1)
                            ),
                            2,
                        ),
                        "num_candles": len(sym_data),
                    }
                except (KeyError, IndexError):
                    continue

        except Exception as e:
            log.error(f"Price fetch error: {e}")

        time.sleep(0.3)

    return result


def fetch_oi_data(symbols: list[str]) -> dict:
    """
    Fetch open interest from options chain for F&O stocks.
    Not all stocks have F&O — returns data only for those that do.
    """
    oi = {}
    for sym in symbols:
        try:
            ticker = yf.Ticker(sym)
            exps = ticker.options
            if not exps:
                continue
            chain = ticker.option_chain(exps[0])
            calls_oi = int(chain.calls["openInterest"].fillna(0).sum())
            puts_oi = int(chain.puts["openInterest"].fillna(0).sum())
            if calls_oi + puts_oi == 0:
                continue
            oi[sym] = {
                "calls_oi": calls_oi,
                "puts_oi": puts_oi,
                "total_oi": calls_oi + puts_oi,
                "pcr": round(puts_oi / calls_oi, 2) if calls_oi > 0 else 0,
            }
        except Exception:
            continue
    log.info(f"OI data fetched for {len(oi)} F&O stocks")
    return oi


# ─── DB Storage ─────────────────────────────────────────────────────────────

def save_scans_to_db(pattern_a: dict, pattern_b: dict):
    """Write today's scan results into the shared trading.db."""
    try:
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        today = date.today().isoformat()
        now = datetime.utcnow().isoformat()

        # Clear today's existing scans (re-scan safe)
        cur.execute("DELETE FROM intraday_scans WHERE scan_date = ?", (today,))

        rows = []
        for sym, c in pattern_a.items():
            rows.append((today, now, sym, "OPEN_EQ_LOW", "BUY",
                         c["open"], c["high"], c["low"], c["close"],
                         c["high"], c["volume"], "WATCHING"))
        for sym, c in pattern_b.items():
            rows.append((today, now, sym, "OPEN_EQ_HIGH", "SELL",
                         c["open"], c["high"], c["low"], c["close"],
                         c["low"], c["volume"], "WATCHING"))

        cur.executemany("""
            INSERT INTO intraday_scans
              (scan_date, scan_time, symbol, pattern, direction,
               open_price, high_price, low_price, close_price,
               trigger_price, volume, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, rows)
        conn.commit()
        conn.close()
        log.info(f"Saved {len(rows)} scan rows to DB")
    except Exception as e:
        log.error(f"DB save_scans error: {e}")


def save_alert_to_db(sym: str, direction: str, pattern: str,
                     trigger: float, price: float, pct: float,
                     vol: int, vwap: float, day_high: float, day_low: float):
    try:
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        today = date.today().isoformat()
        now = datetime.utcnow().isoformat()

        cur.execute("""
            INSERT INTO intraday_alerts
              (alert_date, alert_time, symbol, direction, pattern,
               trigger_price, cmp, pct_move, volume, vwap, day_high, day_low)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (today, now, sym, direction, pattern,
              trigger, price, pct, vol, vwap, day_high, day_low))

        # Mark scan row as triggered
        cur.execute("""
            UPDATE intraday_scans SET status='TRIGGERED'
            WHERE scan_date=? AND symbol=? AND direction=?
        """, (today, sym, direction))

        conn.commit()
        conn.close()
    except Exception as e:
        log.error(f"DB save_alert error: {e}")


# ─── Pattern Detection ──────────────────────────────────────────────────────

def identify_patterns(candles: dict) -> tuple[dict, dict]:
    """
    Pattern A (Open == Low):  bullish — opened at the bottom, moved up
    Pattern B (Open == High): bearish — opened at the top, moved down
    Exact match only — no tolerance.
    """
    pattern_a = {}
    pattern_b = {}

    for sym, c in candles.items():
        if c["open"] == c["low"]:
            pattern_a[sym] = c

        if c["open"] == c["high"]:
            pattern_b[sym] = c

    log.info(
        f"Patterns found — Open=Low (A): {len(pattern_a)} | Open=High (B): {len(pattern_b)}"
    )
    return pattern_a, pattern_b


# ─── Formatting ──────────────────────────────────────────────────────────────

def fmt_sym(sym: str) -> str:
    return sym.replace(".NS", "")


def fmt_num(n: int) -> str:
    if n >= 10_000_000:
        return f"{n / 10_000_000:.1f}Cr"
    if n >= 100_000:
        return f"{n / 100_000:.1f}L"
    if n >= 1000:
        return f"{n / 1000:.1f}K"
    return str(n)


def build_scan_message(pattern_a: dict, pattern_b: dict, oi: dict) -> str:
    now = datetime.now(IST)
    msg = f"<b>INTRADAY SCREENER — {now.strftime('%d %b %Y')}</b>\n"
    msg += f"Scan at {now.strftime('%H:%M IST')}\n\n"

    if pattern_a:
        msg += f"<b>OPEN = LOW  (Bullish) — {len(pattern_a)} stocks</b>\n"
        msg += "<i>Alert when price breaks above 5-min high</i>\n\n"
        for sym, c in sorted(pattern_a.items(), key=lambda x: x[1]["volume"], reverse=True):
            oi_str = ""
            if sym in oi:
                oi_str = f"  OI:{fmt_num(oi[sym]['total_oi'])} PCR:{oi[sym]['pcr']}"
            rng = c["high"] - c["low"]
            rng_pct = (rng / c["open"]) * 100
            msg += (
                f"<code>{fmt_sym(sym):>14}</code>  "
                f"O:{c['open']:.2f} H:{c['high']:.2f} L:{c['low']:.2f}  "
                f"Rng:{rng_pct:.1f}%  Vol:{fmt_num(c['volume'])}{oi_str}\n"
            )
        msg += "\n"

    if pattern_b:
        msg += f"<b>OPEN = HIGH (Bearish) — {len(pattern_b)} stocks</b>\n"
        msg += "<i>Alert when price breaks below 5-min low</i>\n\n"
        for sym, c in sorted(pattern_b.items(), key=lambda x: x[1]["volume"], reverse=True):
            oi_str = ""
            if sym in oi:
                oi_str = f"  OI:{fmt_num(oi[sym]['total_oi'])} PCR:{oi[sym]['pcr']}"
            rng = c["high"] - c["low"]
            rng_pct = (rng / c["open"]) * 100
            msg += (
                f"<code>{fmt_sym(sym):>14}</code>  "
                f"O:{c['open']:.2f} H:{c['high']:.2f} L:{c['low']:.2f}  "
                f"Rng:{rng_pct:.1f}%  Vol:{fmt_num(c['volume'])}{oi_str}\n"
            )

    return msg


# ─── Main Screener Loop ─────────────────────────────────────────────────────

def run_screener(skip_wait: bool = False):
    log.info("=" * 60)
    log.info("  INTRADAY OPEN=LOW / OPEN=HIGH SCREENER")
    log.info("=" * 60)

    symbols = load_symbols()

    # ── Wait for first 5-min candle to complete (9:20 AM IST) ──
    if not skip_wait:
        now = datetime.now(IST)
        target = now.replace(hour=9, minute=20, second=10, microsecond=0)
        if now < target:
            wait = (target - now).total_seconds()
            log.info(f"Waiting {wait:.0f}s for 9:20 AM IST (first 5-min candle)...")
            time.sleep(wait)
        elif now.hour >= 15 and now.minute >= 30:
            log.warning("Market is closed. Use --now to scan with the latest trading day's data.")
            return

    # ── Fetch first 5-min candle for all stocks ──
    log.info("Fetching first 5-minute candles for Nifty 200...")
    candles = fetch_first_5min_candles(symbols)

    if not candles:
        log.error("No candle data — check market hours or network")
        return

    # ── Identify patterns ──
    pattern_a, pattern_b = identify_patterns(candles)

    if not pattern_a and not pattern_b:
        log.info("No patterns found today")
        notify("No Open=Low or Open=High patterns found today.")
        return

    # ── Fetch OI for watchlist ──
    watchlist = list(set(list(pattern_a.keys()) + list(pattern_b.keys())))
    log.info(f"Fetching OI for {len(watchlist)} watchlist stocks...")
    oi = fetch_oi_data(watchlist)

    # ── Save to DB ──
    save_scans_to_db(pattern_a, pattern_b)

    # ── Send initial scan result ──
    scan_msg = build_scan_message(pattern_a, pattern_b, oi)
    notify(scan_msg)

    # Print to console too
    print(f"\n{'='*70}")
    print(f"  Open=Low  (A — Bullish):  {len(pattern_a)} stocks")
    print(f"  Open=High (B — Bearish):  {len(pattern_b)} stocks")
    print(f"{'='*70}")

    if pattern_a:
        print("\n  OPEN = LOW (watching for break above 5-min high):")
        for sym, c in sorted(pattern_a.items(), key=lambda x: x[1]["volume"], reverse=True):
            oi_str = f"  OI:{fmt_num(oi[sym]['total_oi'])}" if sym in oi else ""
            print(
                f"    {fmt_sym(sym):>14}  O:{c['open']:>10.2f}  H:{c['high']:>10.2f}  "
                f"L:{c['low']:>10.2f}  Vol:{c['volume']:>10,}{oi_str}"
            )

    if pattern_b:
        print("\n  OPEN = HIGH (watching for break below 5-min low):")
        for sym, c in sorted(pattern_b.items(), key=lambda x: x[1]["volume"], reverse=True):
            oi_str = f"  OI:{fmt_num(oi[sym]['total_oi'])}" if sym in oi else ""
            print(
                f"    {fmt_sym(sym):>14}  O:{c['open']:>10.2f}  H:{c['high']:>10.2f}  "
                f"L:{c['low']:>10.2f}  Vol:{c['volume']:>10,}{oi_str}"
            )

    # ── Monitor for breakouts / breakdowns ──
    alerted = set()
    market_close = datetime.now(IST).replace(hour=15, minute=30, second=0)

    if skip_wait and datetime.now(IST) > market_close:
        log.info("Market closed — skipping live monitoring (use during market hours)")
        return

    log.info(f"\nMonitoring {len(watchlist)} stocks every {MONITOR_INTERVAL}s until 3:30 PM...")

    while datetime.now(IST) < market_close:
        time.sleep(MONITOR_INTERVAL)
        now = datetime.now(IST)

        pending = [s for s in watchlist if s not in alerted]
        if not pending:
            log.info("All watchlist stocks have triggered — done")
            break

        current = fetch_current_data(pending)

        for sym in pending:
            if sym not in current:
                continue

            price = current[sym]["price"]
            vol = current[sym]["volume"]
            vwap = current[sym]["vwap"]
            day_high = current[sym]["day_high"]
            day_low = current[sym]["day_low"]

            # Pattern A: price breaks above 5-min high → bullish breakout
            if sym in pattern_a and sym not in alerted:
                trigger = pattern_a[sym]["high"]
                if price > trigger:
                    alerted.add(sym)
                    c = pattern_a[sym]
                    pct = ((price - c["open"]) / c["open"]) * 100
                    oi_line = ""
                    if sym in oi:
                        oi_line = f"\n  OI: {fmt_num(oi[sym]['total_oi'])} | PCR: {oi[sym]['pcr']}"

                    alert = (
                        f"<b>{fmt_sym(sym)}</b>  BUY\n\n"
                        f"  CMP: {price:.2f} ({pct:+.2f}%)\n"
                        f"  5min: O:{c['open']:.2f} H:{c['high']:.2f} L:{c['low']:.2f}\n"
                        f"  Trigger: break above {trigger:.2f}\n"
                        f"  Day H/L: {day_high:.2f} / {day_low:.2f}\n"
                        f"  Volume: {fmt_num(vol)} | VWAP: {vwap:.2f}{oi_line}\n"
                        f"  {now.strftime('%H:%M:%S IST')}"
                    )
                    notify(alert)
                    save_alert_to_db(sym, "BUY", "OPEN_EQ_LOW", trigger, price, pct, vol, vwap, day_high, day_low)
                    log.info(f"BREAKOUT: {fmt_sym(sym)} at {price:.2f} > {trigger:.2f}")

            # Pattern B: price breaks below 5-min low → bearish breakdown
            if sym in pattern_b and sym not in alerted:
                trigger = pattern_b[sym]["low"]
                if price < trigger:
                    alerted.add(sym)
                    c = pattern_b[sym]
                    pct = ((price - c["open"]) / c["open"]) * 100
                    oi_line = ""
                    if sym in oi:
                        oi_line = f"\n  OI: {fmt_num(oi[sym]['total_oi'])} | PCR: {oi[sym]['pcr']}"

                    alert = (
                        f"<b>{fmt_sym(sym)}</b>  SELL\n\n"
                        f"  CMP: {price:.2f} ({pct:+.2f}%)\n"
                        f"  5min: O:{c['open']:.2f} H:{c['high']:.2f} L:{c['low']:.2f}\n"
                        f"  Trigger: break below {trigger:.2f}\n"
                        f"  Day H/L: {day_high:.2f} / {day_low:.2f}\n"
                        f"  Volume: {fmt_num(vol)} | VWAP: {vwap:.2f}{oi_line}\n"
                        f"  {now.strftime('%H:%M:%S IST')}"
                    )
                    notify(alert)
                    save_alert_to_db(sym, "SELL", "OPEN_EQ_HIGH", trigger, price, pct, vol, vwap, day_high, day_low)
                    log.info(f"BREAKDOWN: {fmt_sym(sym)} at {price:.2f} < {trigger:.2f}")

        triggered_now = len([s for s in pending if s in alerted])
        log.info(
            f"[{now.strftime('%H:%M')}] Watching {len(pending) - triggered_now} | "
            f"Triggered today: {len(alerted)}"
        )

    # ── End-of-day summary ──
    a_triggered = len(alerted & set(pattern_a.keys()))
    b_triggered = len(alerted & set(pattern_b.keys()))
    summary = (
        f"<b>END OF DAY SUMMARY</b>\n\n"
        f"Open=Low  stocks: {len(pattern_a)} found, {a_triggered} broke out\n"
        f"Open=High stocks: {len(pattern_b)} found, {b_triggered} broke down\n"
        f"Total alerts: {len(alerted)}"
    )
    notify(summary)
    log.info("Market closed — screener stopped")


# ─── Daemon Mode (auto-start daily) ─────────────────────────────────────────

def run_daemon():
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = BlockingScheduler(timezone=IST)

    scheduler.add_job(
        run_screener,
        CronTrigger(day_of_week="mon-fri", hour=9, minute=14, timezone=IST),
        id="intraday_screener",
        name="Intraday Open=Low/High Screener",
        misfire_grace_time=300,
    )

    log.info("Daemon started — screener will auto-run at 9:14 AM IST on trading days")
    log.info("Press Ctrl+C to stop")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Daemon stopped")


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Intraday Open=Low / Open=High Screener for Nifty 200",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python screener.py                  Wait for 9:20 AM, then scan + monitor
  python screener.py --now            Scan immediately with today's data
  python screener.py --test           Scan only, no monitoring
  python screener.py --daemon         Auto-run every trading day at 9:14 AM
Environment:
  TELEGRAM_TOKEN     Telegram bot token
  TELEGRAM_CHAT_ID   Telegram chat ID for alerts
        """,
    )
    parser.add_argument("--now", action="store_true", help="Scan immediately, don't wait for 9:20 AM")
    parser.add_argument("--test", action="store_true", help="Scan and print only, no monitoring or alerts")
    parser.add_argument("--daemon", action="store_true", help="Run as daemon with daily auto-start")

    args = parser.parse_args()

    if args.daemon:
        run_daemon()
        return

    if args.test:
        symbols = load_symbols()
        candles = fetch_first_5min_candles(symbols)

        if not candles:
            print("No data fetched — is the market open today?")
            return

        pattern_a, pattern_b = identify_patterns(candles)

        print(f"\n{'='*70}")
        print(f"  Match: Exact (Open == Low / Open == High)")
        print(f"  Open=Low  (Bullish):  {len(pattern_a)} stocks")
        print(f"  Open=High (Bearish):  {len(pattern_b)} stocks")
        print(f"{'='*70}")

        if pattern_a:
            print("\n  OPEN = LOW (Bullish — break above 5-min high):")
            print(f"  {'Symbol':>14}  {'Open':>10}  {'High':>10}  {'Low':>10}  {'Close':>10}  {'Volume':>12}")
            print(f"  {'-'*14}  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*12}")
            for sym, c in sorted(pattern_a.items(), key=lambda x: x[1]["volume"], reverse=True):
                print(
                    f"  {fmt_sym(sym):>14}  {c['open']:>10.2f}  {c['high']:>10.2f}  "
                    f"{c['low']:>10.2f}  {c['close']:>10.2f}  {c['volume']:>12,}"
                )

        if pattern_b:
            print("\n  OPEN = HIGH (Bearish — break below 5-min low):")
            print(f"  {'Symbol':>14}  {'Open':>10}  {'High':>10}  {'Low':>10}  {'Close':>10}  {'Volume':>12}")
            print(f"  {'-'*14}  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*12}")
            for sym, c in sorted(pattern_b.items(), key=lambda x: x[1]["volume"], reverse=True):
                print(
                    f"  {fmt_sym(sym):>14}  {c['open']:>10.2f}  {c['high']:>10.2f}  "
                    f"{c['low']:>10.2f}  {c['close']:>10.2f}  {c['volume']:>12,}"
                )

        return

    run_screener(skip_wait=args.now)


if __name__ == "__main__":
    main()
