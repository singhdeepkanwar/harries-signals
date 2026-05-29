# NSE Swing Trading System

A full-stack NSE swing trading automation system that scans Nifty 500 stocks nightly using two strategies: **Momentum/Breakout** and **Reversal/CHoCH (Change of Character)**.

## Architecture

```
Backend (Python/FastAPI)          Frontend (React/Vite)
├── Scanner Engine                ├── Dashboard
│   ├── Breakout Strategy         ├── Setups Browser
│   └── Reversal Strategy         ├── Trade Journal
├── Technical Indicators          ├── Analytics & Charts
│   ├── RSI, MACD, EMA            └── Settings
│   └── Pattern Detection
├── Position Sizing
├── SQLite Database
├── APScheduler (4:30 PM IST)
└── Telegram Alerts (optional)
```

## Quick Start

### Backend

```bash
cd trading-system/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
python main.py
# or: uvicorn main:app --reload --port 8000
```

The backend runs on `http://localhost:8000`.

### Frontend

```bash
cd trading-system/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

## Strategies

### Strategy 1: Momentum/Breakout

Finds stocks near 52-week highs breaking out of consolidation zones.

**Filters:**
- Price within 3% of 52-week high
- Above 50 EMA and 200 EMA
- Consolidation detected (7-20 days, <8% range)
- Breakout above consolidation high or successful retest

**Confirmation Score (0-3, need 2+):**
- RSI(14) > 60 and rising
- MACD bullish crossover in last 3 days
- Volume > 1.5x 20-day average

### Strategy 2: Reversal/CHoCH

Finds stocks in confirmed downtrends showing Change of Character.

**Filters:**
- Confirmed downtrend (2+ lower highs, 2+ lower lows)
- Average volume > 5 lakh shares
- Price above Rs 50
- CHoCH: close above most recent lower high
- CHoCH candle volume > 1.2x average

**Confirmation Score (0-5, need 3+):**
- Bullish RSI divergence
- MACD histogram turned positive
- Price held above 20 EMA for 3+ days
- Double bottom pattern
- Volume expanding on green days

## Nifty 500 Stock List

The file `backend/nifty500.csv` contains ~170 major Nifty 500 stocks. Format:

```csv
Symbol,Company Name
RELIANCE.NS,Reliance Industries
TCS.NS,Tata Consultancy Services
```

To add more stocks, append rows with the `.NS` suffix for yfinance compatibility.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setups/today` | Today's scanned setups |
| GET | `/api/setups/history` | Past setups (filterable) |
| POST | `/api/scan/trigger` | Manually trigger a scan |
| GET | `/api/scan/status` | Scan progress |
| GET | `/api/trades` | All journal entries |
| POST | `/api/trades` | Log a new trade |
| PUT | `/api/trades/{id}` | Update trade (add exit) |
| POST | `/api/position/calculate` | Calculate position size |
| GET | `/api/analytics/summary` | Performance stats |
| GET | `/api/analytics/equity` | Equity curve data |
| GET | `/api/analytics/monthly` | Monthly P&L |
| GET | `/api/analytics/by-strategy` | Strategy comparison |
| GET | `/api/config` | Get settings |
| POST | `/api/config` | Update settings |
| POST | `/api/config/test-telegram` | Test Telegram connection |

### Manually Trigger a Scan

```bash
curl -X POST http://localhost:8000/api/scan/trigger
```

Check progress:
```bash
curl http://localhost:8000/api/scan/status
```

## Telegram Alerts (Optional)

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get your Chat ID via [@userinfobot](https://t.me/userinfobot)
3. Enter both in Settings page
4. Click "Test Connection" to verify

Alerts are sent automatically after each nightly scan with the count of setups found and top 3 by confirmation score.

## Scheduler

The scanner runs automatically at **4:30 PM IST, Monday-Friday** (after market close). Results are saved to the database and appear on the Dashboard.

## Data Caching

Downloaded OHLCV data is cached as Parquet files in `backend/cache/`. Files older than 1 day are automatically refreshed. This makes repeated scans during development fast.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite
- **Data:** yfinance (free, no API key needed)
- **Indicators:** Pure pandas (RSI, MACD, EMA)
- **Frontend:** React, Tailwind CSS, Recharts, Lucide Icons
- **Scheduler:** APScheduler
