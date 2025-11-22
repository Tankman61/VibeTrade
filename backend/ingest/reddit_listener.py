"""
Reddit Sentiment Listener
Connects to a sentiment analysis stream and monitors social sentiment.
"""
import asyncio
import json
import logging
from typing import Callable, Optional
import websockets
from websockets.exceptions import WebSocketException

from config import config

logger = logging.getLogger(__name__)


class RedditListener:
    """
    Listens to Reddit sentiment scores via WebSocket.
    Automatically reconnects on failure.
    """
    
    def __init__(self, callback: Callable):
        """
        Initialize the Reddit listener.
        
        Args:
            callback: Async function to call with new sentiment data
        """
        self.callback = callback
        self.ws_url = config.REDDIT_WS_URL
        self.is_running = False
        self.reconnect_delay = 5
        self.max_reconnect_delay = 60
        
    async def start(self):
        """Start listening to Reddit sentiment stream."""
        self.is_running = True
        logger.info(f"🚀 Starting Reddit Listener: {self.ws_url}")
        
        while self.is_running:
            try:
                await self._listen()
            except Exception as e:
                logger.error(f"❌ Reddit listener error: {e}")
                if self.is_running:
                    logger.info(f"🔄 Reconnecting in {self.reconnect_delay}s...")
                    await asyncio.sleep(self.reconnect_delay)
                    self.reconnect_delay = min(
                        self.reconnect_delay * 2,
                        self.max_reconnect_delay
                    )
    
    async def _listen(self):
        """Main listening loop."""
        try:
            async with websockets.connect(self.ws_url) as websocket:
                logger.info("✅ Connected to Reddit Sentiment WebSocket")
                self.reconnect_delay = 5
                
                while self.is_running:
                    try:
                        message = await asyncio.wait_for(
                            websocket.recv(),
                            timeout=30.0
                        )
                        await self._process_message(message)
                        
                    except asyncio.TimeoutError:
                        await websocket.ping()
                        continue
                    except WebSocketException as e:
                        logger.error(f"WebSocket error: {e}")
                        break
                        
        except Exception as e:
            # If real sentiment stream is not available, use mock data
            logger.warning(f"⚠️  Reddit sentiment WebSocket unavailable: {e}")
            logger.info("💬 Using mock Reddit sentiment data stream")
            await self._mock_data_stream()
    
    async def _process_message(self, message: str):
        """
        Process incoming WebSocket message.
        
        Args:
            message: Raw WebSocket message
        """
        try:
            data = json.loads(message)
            
            # Expected format:
            # {"sentiment": 0.75, "source": "reddit", "subreddit": "...", "timestamp": ...}
            
            if "sentiment" in data:
                sentiment = float(data["sentiment"])
                source = data.get("source", "reddit")
                
                # Validate sentiment is in valid range (-1 to 1)
                if -1.0 <= sentiment <= 1.0:
                    await self.callback(sentiment, source)
                else:
                    logger.warning(f"Invalid sentiment: {sentiment}")
                    
            elif "score" in data:
                # Alternative format with 'score' field
                score = float(data["score"])
                source = data.get("source", "reddit")
                
                # Normalize score if needed (e.g., 0-100 to -1 to 1)
                if 0 <= score <= 100:
                    sentiment = (score - 50) / 50  # Convert to -1 to 1
                else:
                    sentiment = score
                
                if -1.0 <= sentiment <= 1.0:
                    await self.callback(sentiment, source)
                    
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
        except (KeyError, ValueError) as e:
            logger.error(f"Failed to extract sentiment: {e}")
        except Exception as e:
            logger.error(f"Unexpected error processing message: {e}")
    
    async def _mock_data_stream(self):
        """
        Generate mock Reddit sentiment data when real stream is unavailable.
        Simulates realistic sentiment fluctuations.
        """
        import random
        
        current_sentiment = 0.1  # Start slightly positive
        
        while self.is_running:
            # Simulate sentiment drift with random walk
            change = random.uniform(-0.1, 0.1)
            current_sentiment = max(-1.0, min(1.0, current_sentiment + change))
            
            # Add occasional sentiment shifts (news events, viral posts, etc.)
            if random.random() < 0.15:  # 15% chance of significant shift
                shift = random.uniform(-0.3, 0.3)
                current_sentiment = max(-1.0, min(1.0, current_sentiment + shift))
            
            # Bias slightly toward negative (Reddit tends to be more critical)
            if random.random() < 0.3:  # 30% chance of negative bias
                current_sentiment -= 0.05
                current_sentiment = max(-1.0, current_sentiment)
            
            await self.callback(current_sentiment, "mock_reddit")
            
            # Update every 3-7 seconds
            await asyncio.sleep(random.uniform(3, 7))
    
    async def stop(self):
        """Stop the listener."""
        self.is_running = False
        logger.info("⏹️  Reddit listener stopped")


async def test_reddit_listener():
    """Test the Reddit listener."""
    async def print_sentiment(sentiment: float, source: str):
        emoji = "😊" if sentiment > 0.3 else "😐" if sentiment > -0.3 else "😞"
        print(f"{emoji} {source}: {sentiment:+.2f}")
    
    listener = RedditListener(callback=print_sentiment)
    
    try:
        await asyncio.wait_for(listener.start(), timeout=30)
    except asyncio.TimeoutError:
        await listener.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_reddit_listener())

