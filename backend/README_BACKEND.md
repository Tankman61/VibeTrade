# Risk Console Backend

Real-time risk monitoring system with AI-powered interrupts.

## 🏗️ Architecture

This backend is built with **FastAPI** and **asyncio** to handle real-time data streams and WebSocket communications.

### Components

```
backend/
├── main.py                 # FastAPI application & server entry point
├── config.py              # Configuration management
├── ws_manager.py          # WebSocket manager for frontend communication
│
├── logic/                 # Core business logic
│   ├── risk_engine.py     # Risk calculation engine
│   ├── normalizer.py      # Risk score normalization
│   └── event_router.py    # Central event coordinator
│
├── ingest/                # Data ingestion from external sources
│   ├── crypto_listener.py    # Binance crypto price stream
│   ├── polymarket_listener.py # Polymarket prediction markets
│   └── reddit_listener.py     # Reddit sentiment stream
│
└── ai/                    # AI integrations
    ├── generate_roast.py  # OpenAI GPT-4o roast generation
    └── generate_voice.py  # ElevenLabs TTS voice generation
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
- `OPENAI_API_KEY` - Get from https://platform.openai.com/
- `ELEVENLABS_API_KEY` - Get from https://elevenlabs.io/

### 3. Run the Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on `http://localhost:8000`

## 📡 Data Flow

```
External WebSockets → Listeners → Event Router → Risk Engine
                                                     ↓
                                              Normalizer
                                                     ↓
                                            WebSocket Manager
                                                     ↓
                                               Frontend

When Risk > Threshold:
    Risk Engine → Event Router → AI Services → WebSocket Manager → Frontend
                                  (Roast + Voice)
```

## 🔌 API Endpoints

### WebSocket

- `ws://localhost:8000/ws` - Main WebSocket endpoint for frontend

### HTTP

- `GET /` - API information
- `GET /health` - Health check and service status
- `GET /stats` - Current system statistics
- `GET /config` - Configuration information (safe values only)
- `POST /test-interrupt` - Manually trigger an interrupt (testing only)

## 📨 WebSocket Message Format

### Messages TO Frontend

#### Risk Score Update
```json
{
  "type": "RISK_SCORE",
  "payload": {
    "score": 75.5
  }
}
```

#### Interrupt Event
```json
{
  "type": "INTERRUPT",
  "payload": {
    "roast": "Risk at 85%? Congratulations, you've achieved peak market chaos.",
    "audio_url": "/audio/roast_abc123.mp3",
    "risk_score": 85.2
  }
}
```

#### Alert
```json
{
  "type": "ALERT",
  "payload": {
    "alert_type": "warning",
    "message": "Risk threshold exceeded"
  }
}
```

#### Data Update
```json
{
  "type": "DATA_UPDATE",
  "payload": {
    "source": "crypto",
    "data": {
      "symbol": "BTCUSDT",
      "price": 43250.50
    }
  }
}
```

### Messages FROM Frontend

#### Get Status
```json
{
  "type": "GET_STATUS",
  "payload": {}
}
```

#### Get Statistics
```json
{
  "type": "GET_STATISTICS",
  "payload": {}
}
```

#### Force Interrupt (Testing)
```json
{
  "type": "FORCE_INTERRUPT",
  "payload": {}
}
```

## ⚙️ Configuration

### Environment Variables

All configuration is done through environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o | Required |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS | Required |
| `RISK_THRESHOLD` | Risk score threshold for interrupts | 75.0 |
| `INTERRUPT_COOLDOWN_SECONDS` | Cooldown between interrupts | 60 |
| `CRYPTO_MA_WINDOW` | Moving average window for crypto | 20 |
| `POLYMARKET_MA_WINDOW` | Moving average window for Polymarket | 10 |
| `REDDIT_MA_WINDOW` | Moving average window for Reddit | 15 |
| `HOST` | Server host | 0.0.0.0 |
| `PORT` | Server port | 8000 |

## 🧪 Testing

### Test Individual Components

Each listener can be tested independently:

```bash
python -m ingest.crypto_listener
python -m ingest.polymarket_listener
python -m ingest.reddit_listener
```

### Test AI Services

```bash
python -m ai.generate_roast
python -m ai.generate_voice
```

### Test Full System

1. Start the server: `python main.py`
2. Check health: `curl http://localhost:8000/health`
3. Trigger test interrupt: `curl -X POST http://localhost:8000/test-interrupt`

## 🎯 Risk Engine Details

### Risk Calculation

The risk engine combines multiple factors:

1. **Crypto Volatility** - Standard deviation of price changes
2. **Polymarket Extremity** - How close probabilities are to 0 or 1
3. **Reddit Sentiment** - Negative sentiment indicates higher risk
4. **Cross-correlation** - Multiple signals amplify risk

### Normalization

Raw risk metrics are normalized to 0-100 scale using:
- Adaptive min-max normalization
- Historical tracking (100 data points)
- Dynamic range adjustment

### Interrupt Triggers

An interrupt is triggered when:
1. Risk score exceeds threshold (default: 75)
2. Cooldown period has passed (default: 60 seconds)

## 🔊 Audio Generation

Generated audio files are stored in `static/audio/` and served at `/audio/{filename}`.

Audio is cached based on text hash to avoid regenerating identical roasts.

## 🐛 Troubleshooting

### WebSocket Connections Failing

- Check that external WebSocket URLs are accessible
- Listeners will fall back to mock data if connections fail
- Check logs for connection errors

### No Audio Generated

- Verify `ELEVENLABS_API_KEY` is set correctly
- Check `static/audio/` directory exists and is writable
- System will fall back to a default audio URL if generation fails

### High CPU Usage

- Reduce moving average windows in config
- Increase listener update intervals
- Check for WebSocket reconnection loops

## 📝 Logs

The backend logs all activity to stdout. Log levels:

- `INFO` - Normal operation
- `WARNING` - Recoverable issues
- `ERROR` - Failures and exceptions
- `DEBUG` - Detailed data flow (set in code)

## 🚀 Production Deployment

### Recommended Setup

1. Use a process manager (systemd, supervisor, or PM2)
2. Set up reverse proxy (nginx, Caddy)
3. Enable HTTPS
4. Configure CORS for specific origins
5. Set up monitoring and alerts
6. Use environment-specific `.env` files
7. Enable log aggregation

### Example systemd Service

```ini
[Unit]
Description=Risk Console Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/risk-console/backend
Environment=PATH=/opt/risk-console/venv/bin
ExecStart=/opt/risk-console/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📄 License

See project root for license information.

