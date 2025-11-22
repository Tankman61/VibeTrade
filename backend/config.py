"""
Configuration management for the Risk Console backend.
Loads all API keys and WebSocket URLs from environment variables.
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Central configuration class for all backend services."""
    
    # API Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    
    # External WebSocket URLs
    CRYPTO_WS_URL: str = os.getenv(
        "CRYPTO_WS_URL", 
        "wss://stream.binance.com:9443/ws/btcusdt@trade"
    )
    POLYMARKET_WS_URL: str = os.getenv(
        "POLYMARKET_WS_URL",
        "wss://ws-subscriptions-clob.polymarket.com/ws/market"
    )
    REDDIT_WS_URL: str = os.getenv(
        "REDDIT_WS_URL",
        "wss://reddit-sentiment-stream.example.com/ws"  # Mock URL
    )
    
    # Risk Engine Settings
    RISK_THRESHOLD: float = float(os.getenv("RISK_THRESHOLD", "75.0"))
    INTERRUPT_COOLDOWN_SECONDS: int = int(os.getenv("INTERRUPT_COOLDOWN_SECONDS", "60"))
    
    # Moving Average Windows
    CRYPTO_MA_WINDOW: int = int(os.getenv("CRYPTO_MA_WINDOW", "20"))
    POLYMARKET_MA_WINDOW: int = int(os.getenv("POLYMARKET_MA_WINDOW", "10"))
    REDDIT_MA_WINDOW: int = int(os.getenv("REDDIT_MA_WINDOW", "15"))
    
    # Server Settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # ElevenLabs Voice Settings
    ELEVENLABS_VOICE_ID: str = os.getenv(
        "ELEVENLABS_VOICE_ID", 
        "21m00Tcm4TlvDq8ikWAM"  # Default voice
    )
    
    # OpenAI Model
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    
    @classmethod
    def validate(cls) -> bool:
        """Validate that required configuration is present."""
        if not cls.OPENAI_API_KEY:
            print("⚠️  Warning: OPENAI_API_KEY not set")
        if not cls.ELEVENLABS_API_KEY:
            print("⚠️  Warning: ELEVENLABS_API_KEY not set")
        return True


# Create a singleton instance
config = Config()

