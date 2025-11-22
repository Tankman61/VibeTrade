"""
Crypto Spot Price Listener
Connects to Binance WebSocket and streams real-time BTC price data.
"""
import asyncio
import json
import logging
from typing import Callable, Optional
import websockets
from websockets.exceptions import WebSocketException

from config import config

logger = logging.getLogger(__name__)


class CryptoListener:
    """
    Listens to crypto spot prices via WebSocket.
    Automatically reconnects on failure.
    """
    
    def __init__(self, callback: Callable):
        """
        Initialize the crypto listener.
        
        Args:
            callback: Async function to call with new price data
        """
        self.callback = callback
        self.ws_url = config.CRYPTO_WS_URL
        self.is_running = False
        self.reconnect_delay = 5  # seconds
        self.max_reconnect_delay = 60
        
    async def start(self):
        """Start listening to crypto price stream."""
        self.is_running = True
        logger.info(f"🚀 Starting Crypto Listener: {self.ws_url}")
        
        while self.is_running:
            try:
                await self._listen()
            except Exception as e:
                logger.error(f"❌ Crypto listener error: {e}")
                if self.is_running:
                    logger.info(f"🔄 Reconnecting in {self.reconnect_delay}s...")
                    await asyncio.sleep(self.reconnect_delay)
                    # Exponential backoff
                    self.reconnect_delay = min(
                        self.reconnect_delay * 2,
                        self.max_reconnect_delay
                    )
    
    async def _listen(self):
        """Main listening loop."""
        async with websockets.connect(self.ws_url) as websocket:
            logger.info("✅ Connected to Binance WebSocket")
            self.reconnect_delay = 5  # Reset reconnect delay on successful connection
            
            while self.is_running:
                try:
                    # Receive message
                    message = await asyncio.wait_for(
                        websocket.recv(),
                        timeout=30.0
                    )
                    
                    # Parse and process
                    await self._process_message(message)
                    
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    await websocket.ping()
                    continue
                    
                except WebSocketException as e:
                    logger.error(f"WebSocket error: {e}")
                    break
    
    async def _process_message(self, message: str):
        """
        Process incoming WebSocket message.
        
        Args:
            message: Raw WebSocket message
        """
        try:
            data = json.loads(message)
            
            # Binance trade stream format:
            # {"e":"trade","E":1234567890,"s":"BTCUSDT","t":12345,"p":"43250.50","q":"0.001","b":88,"a":50,"T":1234567890,"m":true,"M":true}
            
            if "p" in data:  # 'p' is the price field
                price = float(data["p"])
                symbol = data.get("s", "BTCUSDT")
                
                # Call the callback with the price
                await self.callback(price, symbol)
                
            elif "error" in data:
                logger.error(f"API error: {data['error']}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
        except (KeyError, ValueError) as e:
            logger.error(f"Failed to extract price: {e}")
        except Exception as e:
            logger.error(f"Unexpected error processing message: {e}")
    
    async def stop(self):
        """Stop the listener."""
        self.is_running = False
        logger.info("⏹️  Crypto listener stopped")


async def test_crypto_listener():
    """Test the crypto listener."""
    async def print_price(price: float, symbol: str):
        print(f"💰 {symbol}: ${price:.2f}")
    
    listener = CryptoListener(callback=print_price)
    
    try:
        await asyncio.wait_for(listener.start(), timeout=30)
    except asyncio.TimeoutError:
        await listener.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_crypto_listener())

