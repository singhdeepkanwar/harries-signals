#!/bin/bash
# Intraday Screener — daily runner for cron
# Runs at 9:14 AM IST, scans at 9:20, monitors until 3:30 PM

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/../backend/venv/bin/python"
LOG="$SCRIPT_DIR/screener.log"

# ── Telegram credentials (fill these in) ──
export TELEGRAM_TOKEN="8942449178:AAFCI6YpAFtFetd_AfON7UfTRGcgXOYQ9CU"
export TELEGRAM_CHAT_ID="-5101756848"

# Run screener, append to log
echo "────────────────────────────────────────" >> "$LOG"
echo "$(date '+%Y-%m-%d %H:%M:%S') Starting screener" >> "$LOG"
"$VENV" "$SCRIPT_DIR/screener.py" >> "$LOG" 2>&1
echo "$(date '+%Y-%m-%d %H:%M:%S') Screener finished" >> "$LOG"
