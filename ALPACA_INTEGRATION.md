# Alpaca WebSocket Integration Guide

## Overview

This project is now set up to stream real-time market data from Alpaca API via FastAPI WebSocket connections.

## Architecture

```
Frontend (Next.js)
    ↓ WebSocket
FastAPI Backend
    ↓ Alpaca WebSocket API
Alpaca Markets
```

## Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your Alpaca credentials
# ALPACA_API_KEY=your_key_here
# ALPACA_SECRET_KEY=your_secret_here
```

### 2. Get Alpaca API Keys

1. Sign up at [Alpaca Markets](https://alpaca.markets/)
2. Navigate to Paper Trading dashboard
3. Generate API keys
4. Add them to `backend/.env`

### 3. Start the Backend

```bash
cd backend
python main.py
```

Backend runs on `http://localhost:8000`

### 4. Frontend Usage

The frontend is already configured with:

- WebSocket manager (`/lib/websocket.ts`)
- React hook (`/hooks/useAlpacaWebSocket.ts`)
- Data transformers (`/lib/alpacaDataTransform.ts`)
- Example component (`/components/LiveAlpacaChart.tsx`)

## Using the WebSocket in Components

### Basic Usage

```typescript
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";

function MyComponent() {
  const { subscribe, unsubscribe } = useAlpacaWebSocket({
    symbols: ["BTC", "ETH"],
    dataType: "crypto",
    onMessage: (message) => {
      if (message.type === "bar") {
        console.log("New bar:", message.data);
      }
    },
    autoConnect: true,
  });

  return <div>...</div>;
}
```

### With Live Chart

```typescript
import LiveAlpacaChart from "@/components/LiveAlpacaChart";

function TradingView() {
  return (
    <div>
      <LiveAlpacaChart symbol="BTC" dataType="crypto" />
      <LiveAlpacaChart symbol="AAPL" dataType="stocks" />
    </div>
  );
}
```

## Message Types

### Subscribe to Symbols

```typescript
subscribe(["BTC", "ETH", "SOL"]);
```

### Unsubscribe from Symbols

```typescript
unsubscribe(["BTC"]);
```

### Received Messages

**Bar Data (OHLCV):**

```typescript
{
  type: 'bar',
  data: {
    symbol: 'BTC',
    timestamp: 1700000000,
    open: 98742.31,
    high: 98850.00,
    low: 98700.00,
    close: 98800.00,
    volume: 1234567
  }
}
```

**Trade Data:**

```typescript
{
  type: 'trade',
  data: {
    symbol: 'AAPL',
    timestamp: 1700000000,
    price: 178.50,
    size: 100
  }
}
```

## Integrating Real Alpaca API

### Current Status

✅ WebSocket infrastructure ready
✅ Frontend hooks and components ready
⚠️ Backend currently sends **mock data** for testing

### To Enable Real Alpaca Data

1. Install Alpaca Python SDK (already in requirements.txt):

```bash
pip install alpaca-py
```

2. Replace the mock function in `backend/main.py`:

```python
from alpaca.data.live import StockDataStream, CryptoDataStream

# Initialize streams with your API keys
crypto_stream = CryptoDataStream(
    api_key=os.getenv("ALPACA_API_KEY"),
    secret_key=os.getenv("ALPACA_SECRET_KEY")
)

# Define handlers
async def handle_crypto_bar(bar):
    message = {
        "type": "bar",
        "data": {
            "symbol": bar.symbol,
            "timestamp": int(bar.timestamp.timestamp()),
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume
        }
    }
    await alpaca_manager.broadcast_to_subscribers("crypto", bar.symbol, message)

# Subscribe to symbols
crypto_stream.subscribe_bars(handle_crypto_bar, "BTC/USD", "ETH/USD")

# Run the stream
asyncio.create_task(crypto_stream.run())
```

## Updating Holdings Components

To use live data in your holdings detail views:

```typescript
// In CryptoHoldings.tsx, StocksHoldings.tsx, etc.
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";

// Replace hardcoded chart data with:
const { subscribe } = useAlpacaWebSocket({
  symbols: [selectedHolding.symbol],
  dataType: "crypto", // or 'stocks', 'etfs', 'options'
  onMessage: (message) => {
    if (message.type === "bar" && chartRef.current) {
      const data = transformBarToChartData(message.data);
      seriesRef.current.update(data);
    }
  },
});
```

## Testing

### 1. Test WebSocket Connection

```bash
# Terminal 1: Start backend
cd backend
python main.py

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 2. Check Connection

Navigate to any holdings page and click on a holding to see the live chart.

### 3. Monitor WebSocket

- Open browser DevTools → Network → WS tab
- You should see WebSocket connections to `ws://localhost:8000/ws/alpaca/*`
- Messages streaming every second

## Configuration

### Environment Variables

**Backend (.env):**

```bash
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
ALPACA_BASE_URL=https://paper-api.alpaca.markets
PORT=8000
HOST=0.0.0.0
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Frontend:**
WebSocket URL is configured in `/lib/websocket.ts`:

```typescript
const baseUrl = "ws://localhost:8000";
```

For production, update to your deployed backend URL.

## API Documentation

With the backend running, visit:

- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health
- **WebSocket Endpoints:**
  - `ws://localhost:8000/ws/alpaca/crypto`
  - `ws://localhost:8000/ws/alpaca/stocks`
  - `ws://localhost:8000/ws/alpaca/options`
  - `ws://localhost:8000/ws/alpaca/etfs`

## Troubleshooting

### WebSocket Won't Connect

- Ensure backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify firewall settings

### No Data Streaming

- Check if symbols are correctly subscribed
- Verify Alpaca API keys are valid
- Check backend logs for errors

### Chart Not Updating

- Ensure `seriesRef.current` exists
- Check data format matches lightweight-charts requirements
- Verify timestamp is in correct format (Unix timestamp)

## Next Steps

1. ✅ Replace mock data with real Alpaca WebSocket streams
2. ✅ Add error handling and reconnection logic
3. ✅ Implement data caching for historical data
4. ✅ Add rate limiting and connection pooling
5. ✅ Deploy backend with proper WebSocket support
