"""
Market Data WebSocket Manager
Handles WebSocket connections from frontend and broadcasts live price updates
"""
import asyncio
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
import json

from app.services.finnhub import finnhub_service
# Note: Alpaca is only used for trading, not market data display

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections and symbol subscriptions for each data type"""
    
    def __init__(self):
        # Active connections per data type: { "crypto": {websocket1, websocket2}, "stocks": {...} }
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "crypto": set(),
            "stocks": set(),
            "etfs": set(),
            "options": set()
        }
        
        # Track which symbols each connection is interested in
        # { websocket: {"BTC", "ETH"} }
        self.connection_symbols: Dict[WebSocket, Set[str]] = {}
        
    async def connect(self, websocket: WebSocket, data_type: str):
        """Accept new WebSocket connection"""
        try:
            await websocket.accept()
            self.active_connections[data_type].add(websocket)
            self.connection_symbols[websocket] = set()
        except Exception as e:
            logger.error(f"❌ Failed to accept {data_type} WebSocket connection: {e}", exc_info=True)
            raise
        
    def disconnect(self, websocket: WebSocket, data_type: str):
        """Remove WebSocket connection"""
        self.active_connections[data_type].discard(websocket)
        self.connection_symbols.pop(websocket, None)
        
    async def subscribe(self, websocket: WebSocket, data_type: str, symbols: list[str]):
        """Subscribe a connection to specific symbols - BITCOIN ONLY"""
        
        if websocket not in self.connection_symbols:
            self.connection_symbols[websocket] = set()
        
        # Filter to only allow Bitcoin/BTC symbols
        bitcoin_symbols = []
        for s in symbols:
            clean_s = s.replace("/USD", "").replace("USD", "").replace("/", "").upper()
            # Only allow BTC or Bitcoin
            if clean_s in ["BTC", "BITCOIN"]:
                bitcoin_symbols.append("BTC")
        
        if not bitcoin_symbols:
            bitcoin_symbols = ["BTC"]
        
        # Normalize to BTC only
        normalized_symbols = ["BTC"]
        self.connection_symbols[websocket].update(normalized_symbols)
        
        # Subscribe to Finnhub for Bitcoin only
        if data_type == "crypto":
            await finnhub_service.subscribe_crypto(["BTC"])
        elif data_type in ["stocks", "etfs", "options"]:
            # Use Finnhub for stocks/etfs/options display too
            # Note: Alpaca is only used for actual trading execution
            await finnhub_service.subscribe_stocks(["BTC"])
        
        # Send confirmation
        await websocket.send_json({
            "type": "subscribed",
            "symbols": ["BTC"]
        })
        
    async def unsubscribe(self, websocket: WebSocket, symbols: list[str]):
        """Unsubscribe a connection from specific symbols"""
        if websocket in self.connection_symbols:
            self.connection_symbols[websocket].difference_update(symbols)
            
    async def broadcast_to_subscribers(self, data_type: str, symbol: str, message: dict):
        """Broadcast message to all connections subscribed to this symbol"""
        disconnected = set()
        
        # Log every message for debugging
        logger.info(f"🌐 Broadcasting {data_type} message for symbol '{symbol}' to {len(self.active_connections[data_type])} connections")
        
        # Normalize the incoming symbol for comparison
        # BTCUSD -> BTC, BTC/USD -> BTC, BTC -> BTC
        def normalize_symbol(s: str) -> str:
            # Remove /USD first, then remove USD suffix, then remove any remaining /
            normalized = s.replace("/USD", "").replace("/", "")
            # Remove USD suffix if present (e.g., BTCUSD -> BTC)
            if normalized.endswith("USD"):
                normalized = normalized[:-3]
            return normalized.upper()
        
        normalized_incoming = normalize_symbol(symbol)
        
        messages_sent = 0
        for websocket in self.active_connections[data_type]:
            # Check if this connection is subscribed to this symbol
            subscribed_symbols = self.connection_symbols.get(websocket, set())
            
            # Check if any subscribed symbol matches (normalized)
            should_send = False
            for sub_symbol in subscribed_symbols:
                normalized_sub = normalize_symbol(sub_symbol)
                if normalized_incoming == normalized_sub:
                    should_send = True
                    break
            
            # Also check direct match
            if not should_send:
                should_send = symbol in subscribed_symbols or normalized_incoming in subscribed_symbols
            
            if should_send:
                try:
                    await websocket.send_json(message)
                    messages_sent += 1
                except Exception as e:
                    logger.error(f"❌ Error sending to WebSocket: {e}")
                    disconnected.add(websocket)
                    
        if messages_sent > 0:
            logger.debug(f"📊 Broadcast '{symbol}' to {messages_sent}/{len(self.active_connections[data_type])} connection(s)")
        
        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws, data_type)


# Global connection manager
manager = ConnectionManager()


# Register callback with market data services to broadcast price updates
async def broadcast_price_update(data_type: str, symbol: str, message: dict):
    """Callback for market data services to broadcast price updates"""
    logger.debug(f"📡 Broadcasting {data_type} update for '{symbol}' to {len(manager.active_connections[data_type])} connection(s)")
    await manager.broadcast_to_subscribers(data_type, symbol, message)


# WebSocket endpoints for each data type
@router.websocket("/ws/alpaca/crypto")
async def websocket_crypto(websocket: WebSocket):
    """WebSocket endpoint for crypto price streaming"""
    try:
        await manager.connect(websocket, "crypto")
        
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to crypto price stream"
        })
        
        while True:
            try:
                # Receive messages from frontend
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("action") == "subscribe":
                    symbols = message.get("symbols", [])
                    await manager.subscribe(websocket, "crypto", symbols)
                    
                elif message.get("action") == "unsubscribe":
                    symbols = message.get("symbols", [])
                    await manager.unsubscribe(websocket, symbols)
                else:
                    logger.warning(f"Unknown action received: {message.get('action')}")
                    
            except WebSocketDisconnect:
                # Client disconnected normally - break out of loop
                break
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse WebSocket message: {e}, data: {data}")
            except RuntimeError as e:
                # Handle "Cannot call receive once disconnect message received" error
                if "disconnect" in str(e).lower():
                    break
                else:
                    logger.error(f"RuntimeError in WebSocket: {e}", exc_info=True)
                    break
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}", exc_info=True)
                # Don't break on other errors, continue listening
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"❌ Crypto WebSocket error: {e}", exc_info=True)
    finally:
        # Always clean up connection
        try:
            manager.disconnect(websocket, "crypto")
        except:
            pass


@router.websocket("/ws/alpaca/stocks")
async def websocket_stocks(websocket: WebSocket):
    """WebSocket endpoint for stock price streaming"""
    try:
        await manager.connect(websocket, "stocks")
        
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to stocks price stream"
        })
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("action") == "subscribe":
                    symbols = message.get("symbols", [])
                    await manager.subscribe(websocket, "stocks", symbols)
                    
                elif message.get("action") == "unsubscribe":
                    symbols = message.get("symbols", [])
                    await manager.unsubscribe(websocket, symbols)
                else:
                    logger.warning(f"Unknown action received: {message.get('action')}")
                    
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                if "disconnect" in str(e).lower():
                    break
                else:
                    logger.error(f"RuntimeError in WebSocket: {e}", exc_info=True)
                    break
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse WebSocket message: {e}")
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}", exc_info=True)
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"❌ Stocks WebSocket error: {e}", exc_info=True)
    finally:
        try:
            manager.disconnect(websocket, "stocks")
        except:
            pass


@router.websocket("/ws/alpaca/etfs")
async def websocket_etfs(websocket: WebSocket):
    """WebSocket endpoint for ETF price streaming"""
    try:
        await manager.connect(websocket, "etfs")
        
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to ETFs price stream"
        })
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("action") == "subscribe":
                    symbols = message.get("symbols", [])
                    # ETFs use stock data
                    await manager.subscribe(websocket, "stocks", symbols)
                    
                elif message.get("action") == "unsubscribe":
                    symbols = message.get("symbols", [])
                    await manager.unsubscribe(websocket, symbols)
                else:
                    logger.warning(f"Unknown action received: {message.get('action')}")
                    
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                if "disconnect" in str(e).lower():
                    break
                else:
                    logger.error(f"RuntimeError in WebSocket: {e}", exc_info=True)
                    break
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse WebSocket message: {e}")
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}", exc_info=True)
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"❌ ETFs WebSocket error: {e}", exc_info=True)
    finally:
        try:
            manager.disconnect(websocket, "etfs")
        except:
            pass


@router.websocket("/ws/alpaca/options")
async def websocket_options(websocket: WebSocket):
    """WebSocket endpoint for options price streaming"""
    try:
        await manager.connect(websocket, "options")
        
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to options price stream"
        })
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("action") == "subscribe":
                    symbols = message.get("symbols", [])
                    # Options use stock data
                    await manager.subscribe(websocket, "stocks", symbols)
                    
                elif message.get("action") == "unsubscribe":
                    symbols = message.get("symbols", [])
                    await manager.unsubscribe(websocket, symbols)
                else:
                    logger.warning(f"Unknown action received: {message.get('action')}")
                    
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                if "disconnect" in str(e).lower():
                    break
                else:
                    logger.error(f"RuntimeError in WebSocket: {e}", exc_info=True)
                    break
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse WebSocket message: {e}")
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}", exc_info=True)
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"❌ Options WebSocket error: {e}", exc_info=True)
    finally:
        try:
            manager.disconnect(websocket, "options")
        except:
            pass


# REST endpoint to get current prices
@router.get("/api/prices")
async def get_current_prices():
    """Get all current prices from memory (Finnhub for display)"""
    return {
        "prices": finnhub_service.get_all_prices()
    }


@router.get("/api/prices/{symbol}")
async def get_symbol_price(symbol: str):
    """Get current price for a specific symbol (from Finnhub)"""
    symbol_upper = symbol.upper()
    price = finnhub_service.get_price(symbol_upper)
    
    if price is None:
        return {"error": "Symbol not found or not subscribed"}, 404
    return {
        "symbol": symbol_upper,
        "price": price
    }
