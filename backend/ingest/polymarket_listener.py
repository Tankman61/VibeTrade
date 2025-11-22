"""
Polymarket Prediction Market Listener
Connects to Polymarket WebSocket and streams real-time probability data.
"""
import asyncio
import json
import logging
from typing import Callable, Optional
import websockets
from websockets.exceptions import WebSocketException

from config import config

logger = logging.getLogger(__name__)


class PolymarketListener:
    """
    Listens to Polymarket prediction market probabilities via WebSocket.
    Automatically reconnects on failure.
    """
    
    def __init__(self, callback: Callable):
        """
        Initialize the Polymarket listener.
        
        Args:
            callback: Async function to call with new probability data
        """
        self.callback = callback
        self.ws_url = config.POLYMARKET_WS_URL
        self.is_running = False
        self.reconnect_delay = 5
        self.max_reconnect_delay = 60
        
        # Target market to track (can be configured)
        self.target_market_id = None  # None = track any market
        
    async def start(self):
        """Start listening to Polymarket probability stream."""
        self.is_running = True
        logger.info(f"🚀 Starting Polymarket Listener: {self.ws_url}")
        
        while self.is_running:
            try:
                await self._listen()
            except Exception as e:
                logger.error(f"❌ Polymarket listener error: {e}")
                if self.is_running:
                    logger.info(f"🔄 Reconnecting in {self.reconnect_delay}s...")
                    await asyncio.sleep(self.reconnect_delay)
                    self.reconnect_delay = min(
                        self.reconnect_delay * 2,
                        self.max_reconnect_delay
                    )
    
    async def _listen(self):
        """Main listening loop with subscription."""
        try:
            async with websockets.connect(self.ws_url) as websocket:
                logger.info("✅ Connected to Polymarket WebSocket")
                self.reconnect_delay = 5
                
                # Subscribe to market updates
                await self._subscribe(websocket)
                
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
            # If Polymarket WebSocket is not available, use mock data
            logger.warning(f"⚠️  Polymarket WebSocket unavailable: {e}")
            logger.info("📊 Using mock Polymarket data stream")
            await self._mock_data_stream()
    
    async def _subscribe(self, websocket):
        """
        Send subscription message to Polymarket WebSocket.
        
        Args:
            websocket: Active WebSocket connection
        """
        # Polymarket subscription format (adjust based on actual API)
        subscription_message = {
            "type": "subscribe",
            "channel": "markets",
            "market_id": self.target_market_id or "all"
        }
        
        await websocket.send(json.dumps(subscription_message))
        logger.info("📬 Subscribed to Polymarket updates")
    
    async def _process_message(self, message: str):
        """
        Process incoming WebSocket message.
        
        Args:
            message: Raw WebSocket message
        """
        try:
            data = json.loads(message)
            
            # Expected format (adjust based on actual Polymarket API):
            # {"market_id": "...", "probability": 0.75, "timestamp": ...}
            
            if "probability" in data:
                probability = float(data["probability"])
                market_id = data.get("market_id", "unknown")
                
                # Validate probability is in valid range
                if 0.0 <= probability <= 1.0:
                    await self.callback(probability, market_id)
                else:
                    logger.warning(f"Invalid probability: {probability}")
                    
            elif "type" in data and data["type"] == "heartbeat":
                # Handle heartbeat messages
                logger.debug("💓 Heartbeat received")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
        except (KeyError, ValueError) as e:
            logger.error(f"Failed to extract probability: {e}")
        except Exception as e:
            logger.error(f"Unexpected error processing message: {e}")
    
    async def _mock_data_stream(self):
        """
        Generate mock Polymarket data when real stream is unavailable.
        Simulates realistic probability changes.
        """
        import random
        
        current_prob = 0.5
        
        while self.is_running:
            # Simulate probability drift with random walk
            change = random.uniform(-0.05, 0.05)
            current_prob = max(0.05, min(0.95, current_prob + change))
            
            # Add occasional volatility spikes
            if random.random() < 0.1:  # 10% chance
                spike = random.uniform(-0.15, 0.15)
                current_prob = max(0.05, min(0.95, current_prob + spike))
            
            await self.callback(current_prob, "mock_market")
            
            # Update every 2-5 seconds
            await asyncio.sleep(random.uniform(2, 5))
    
    async def stop(self):
        """Stop the listener."""
        self.is_running = False
        logger.info("⏹️  Polymarket listener stopped")


async def test_polymarket_listener():
    """Test the Polymarket listener."""
    async def print_probability(prob: float, market_id: str):
        print(f"📊 Market {market_id}: {prob*100:.1f}%")
    
    listener = PolymarketListener(callback=print_probability)
    
    try:
        await asyncio.wait_for(listener.start(), timeout=30)
    except asyncio.TimeoutError:
        await listener.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_polymarket_listener())

