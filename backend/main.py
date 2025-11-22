"""
Main FastAPI Application for Risk Console Backend
Coordinates all services and provides WebSocket endpoints.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn

from config import config
from ws_manager import ws_manager
from logic.event_router import event_router
from ingest.crypto_listener import CryptoListener
from ingest.polymarket_listener import PolymarketListener
from ingest.reddit_listener import RedditListener

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global listener instances
crypto_listener = None
polymarket_listener = None
reddit_listener = None

# Background tasks
background_tasks = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for FastAPI.
    Starts all services on startup and cleans up on shutdown.
    """
    logger.info("🚀 Starting Risk Console Backend...")
    
    # Validate configuration
    config.validate()
    
    # Start event router
    await event_router.start()
    
    # Initialize listeners with callbacks that route to event router
    global crypto_listener, polymarket_listener, reddit_listener
    
    crypto_listener = CryptoListener(
        callback=lambda price, symbol: event_router.route_crypto_data(price, symbol)
    )
    
    polymarket_listener = PolymarketListener(
        callback=lambda prob, market_id: event_router.route_polymarket_data(prob, market_id)
    )
    
    reddit_listener = RedditListener(
        callback=lambda sentiment, source: event_router.route_reddit_data(sentiment, source)
    )
    
    # Start all listeners as background tasks
    task1 = asyncio.create_task(crypto_listener.start())
    task2 = asyncio.create_task(polymarket_listener.start())
    task3 = asyncio.create_task(reddit_listener.start())
    
    background_tasks.add(task1)
    background_tasks.add(task2)
    background_tasks.add(task3)
    
    logger.info("✅ All services started successfully")
    
    yield  # Application runs
    
    # Shutdown
    logger.info("🛑 Shutting down Risk Console Backend...")
    
    # Stop all listeners
    if crypto_listener:
        await crypto_listener.stop()
    if polymarket_listener:
        await polymarket_listener.stop()
    if reddit_listener:
        await reddit_listener.stop()
    
    # Stop event router
    await event_router.stop()
    
    # Cancel background tasks
    for task in background_tasks:
        task.cancel()
    
    logger.info("👋 Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Risk Console API",
    description="Real-time risk monitoring and interrupt system",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio
import os
if not os.path.exists("static/audio"):
    os.makedirs("static/audio", exist_ok=True)

app.mount("/audio", StaticFiles(directory="static/audio"), name="audio")


# ==================== WebSocket Endpoint ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for frontend connections.
    Handles bidirectional communication with clients.
    """
    await ws_manager.connect(websocket)
    
    try:
        # Send initial status
        stats = event_router.get_statistics()
        await ws_manager.send_personal_message(
            {
                "type": "CONNECTED",
                "payload": {
                    "message": "Connected to Risk Console",
                    "statistics": stats
                }
            },
            websocket
        )
        
        # Listen for messages from client
        while True:
            data = await websocket.receive_json()
            await handle_client_message(data, websocket)
            
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await ws_manager.disconnect(websocket)


async def handle_client_message(data: Dict[str, Any], websocket: WebSocket):
    """
    Handle incoming messages from frontend clients.
    
    Args:
        data: Message data from client
        websocket: Client WebSocket connection
    """
    message_type = data.get("type")
    payload = data.get("payload", {})
    
    logger.info(f"📨 Received message: {message_type}")
    
    if message_type == "GET_STATUS":
        # Send current system status
        await event_router.broadcast_status()
        
    elif message_type == "FORCE_INTERRUPT":
        # Manually trigger an interrupt for testing
        await event_router.force_interrupt()
        
    elif message_type == "GET_STATISTICS":
        # Send statistics to requesting client
        stats = event_router.get_statistics()
        await ws_manager.send_personal_message(
            {
                "type": "STATISTICS",
                "payload": stats
            },
            websocket
        )
        
    else:
        logger.warning(f"Unknown message type: {message_type}")


# ==================== HTTP Endpoints ====================

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Risk Console API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "websocket": "/ws",
            "health": "/health",
            "statistics": "/stats",
            "test_interrupt": "/test-interrupt"
        }
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    Returns current system health status.
    """
    return {
        "status": "healthy",
        "services": {
            "event_router": event_router.is_running,
            "crypto_listener": crypto_listener.is_running if crypto_listener else False,
            "polymarket_listener": polymarket_listener.is_running if polymarket_listener else False,
            "reddit_listener": reddit_listener.is_running if reddit_listener else False,
        },
        "connections": ws_manager.get_connection_count()
    }


@app.get("/stats")
async def get_statistics():
    """
    Get current system statistics.
    Returns risk engine statistics and performance metrics.
    """
    stats = event_router.get_statistics()
    return {
        "statistics": stats,
        "active_connections": ws_manager.get_connection_count()
    }


@app.post("/test-interrupt")
async def test_interrupt():
    """
    Manually trigger an interrupt for testing purposes.
    Only use in development/testing environments.
    """
    try:
        await event_router.force_interrupt()
        return {
            "status": "success",
            "message": "Interrupt triggered successfully"
        }
    except Exception as e:
        logger.error(f"Failed to trigger interrupt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/config")
async def get_config():
    """
    Get current configuration (safe values only).
    Does not expose API keys or sensitive data.
    """
    return {
        "risk_threshold": config.RISK_THRESHOLD,
        "interrupt_cooldown": config.INTERRUPT_COOLDOWN_SECONDS,
        "crypto_ma_window": config.CRYPTO_MA_WINDOW,
        "polymarket_ma_window": config.POLYMARKET_MA_WINDOW,
        "reddit_ma_window": config.REDDIT_MA_WINDOW,
        "openai_model": config.OPENAI_MODEL,
        "has_openai_key": bool(config.OPENAI_API_KEY),
        "has_elevenlabs_key": bool(config.ELEVENLABS_API_KEY)
    }


# ==================== Error Handlers ====================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc)
        }
    )


# ==================== Main Entry Point ====================

def main():
    """
    Main entry point for the application.
    Runs the FastAPI server with Uvicorn.
    """
    logger.info(f"🌐 Starting server on {config.HOST}:{config.PORT}")
    
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,  # Set to True for development
        log_level="info",
        access_log=True
    )


if __name__ == "__main__":
    main()

