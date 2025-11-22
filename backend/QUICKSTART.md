# ⚡ Quick Start Guide - Risk Console Backend

Get the Risk Console backend running in 3 minutes.

## 🎯 Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- OpenAI API key ([get one here](https://platform.openai.com/))
- ElevenLabs API key ([get one here](https://elevenlabs.io/))

## 🚀 Setup (First Time)

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Create Environment File

```bash
cp env_template.txt .env
```

### Step 3: Add Your API Keys

Edit `.env` and replace the placeholder values:

```bash
nano .env  # or use your favorite editor
```

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

**Optional:** Adjust risk thresholds, moving average windows, etc.

### Step 4: Run Setup & Start Server

**Option A: Using the run script (recommended)**
```bash
./run.sh
```

**Option B: Manual setup**
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create directories
mkdir -p static/audio

# Run server
python main.py
```

## ✅ Verify It's Working

### 1. Check Health Endpoint

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "event_router": true,
    "crypto_listener": true,
    "polymarket_listener": true,
    "reddit_listener": true
  },
  "connections": 0
}
```

### 2. Check Statistics

```bash
curl http://localhost:8000/stats
```

### 3. Test Interrupt (Optional)

```bash
curl -X POST http://localhost:8000/test-interrupt
```

This will trigger a test interrupt and generate a roast + audio.

## 🔌 Connect Frontend

The backend WebSocket is available at:
```
ws://localhost:8000/ws
```

Point your frontend to this URL to receive real-time risk updates and interrupts.

## 📊 What's Happening?

Once running, the backend:

1. ✅ Connects to Binance for live BTC prices
2. ✅ Monitors Polymarket prediction markets (or uses mock data)
3. ✅ Tracks Reddit sentiment (or uses mock data)
4. ✅ Calculates real-time risk scores (0-100)
5. ✅ Triggers interrupts when risk > threshold
6. ✅ Generates AI roasts using GPT-4o
7. ✅ Creates TTS audio using ElevenLabs
8. ✅ Broadcasts everything to connected frontends

## 🎛️ Configuration Quick Reference

Edit `.env` to customize:

| Setting | What it does | Default |
|---------|--------------|---------|
| `RISK_THRESHOLD` | Risk level that triggers interrupts | 75.0 |
| `INTERRUPT_COOLDOWN_SECONDS` | Time between interrupts | 60 |
| `PORT` | Server port | 8000 |

## 🐛 Troubleshooting

### "Module not found" errors
```bash
pip install -r requirements.txt
```

### WebSocket won't connect
- Check if port 8000 is already in use
- Try changing `PORT` in `.env`
- Check firewall settings

### No API responses
- Verify API keys are correct in `.env`
- Check API key permissions and billing
- Look at server logs for error messages

### Mock data being used
- This is normal if external WebSockets are unavailable
- Polymarket and Reddit will use simulated data
- Binance crypto stream should work without authentication

## 📝 Logs

Watch the console output for detailed logs:
- `🚀` - Services starting
- `✅` - Successful operations
- `📊` - Data updates
- `🚨` - Interrupt events
- `❌` - Errors

## 🛑 Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

## 📖 More Information

See `README_BACKEND.md` for:
- Complete API documentation
- Architecture details
- Production deployment guide
- Advanced configuration options

## 🎉 You're Ready!

The backend is now running and ready to:
- Stream live market data
- Calculate risk scores
- Generate AI-powered roasts
- Blast interrupts to your frontend

Connect your frontend and start monitoring risk! 🎯

