"""
Event Router - Central coordinator for all data and events.
Acts as the "brain stem" connecting all components.
"""
import asyncio
import logging
from typing import Dict, Any

from logic.risk_engine import RiskEngine
from ws_manager import ws_manager
from ai.generate_roast import generate_roast
from ai.generate_voice import generate_voice

logger = logging.getLogger(__name__)


class EventRouter:
    """
    Central event routing and coordination system.
    Connects data sources → risk engine → WebSocket manager → AI services.
    """
    
    def __init__(self):
        """Initialize the event router with a risk engine."""
        # Create risk engine with interrupt callback
        self.risk_engine = RiskEngine(interrupt_callback=self._handle_interrupt)
        self.is_running = False
        
        logger.info("🧠 Event Router initialized")
    
    async def start(self):
        """Start the event router."""
        self.is_running = True
        logger.info("▶️  Event Router started")
    
    async def stop(self):
        """Stop the event router."""
        self.is_running = False
        logger.info("⏹️  Event Router stopped")
    
    # ==================== Data Ingestion Methods ====================
    
    async def route_crypto_data(self, price: float, symbol: str = "BTC"):
        """
        Route crypto price data to the risk engine.
        
        Args:
            price: Spot price
            symbol: Trading symbol
        """
        if not self.is_running:
            return
        
        logger.debug(f"🔀 Routing crypto data: {symbol} = ${price:.2f}")
        
        # Send to risk engine
        await self.risk_engine.ingest_crypto_price(price)
        
        # Emit updated risk score to frontend
        await self._emit_risk_score()
        
        # Optionally broadcast raw data update
        await ws_manager.broadcast_data_update("crypto", {
            "symbol": symbol,
            "price": price
        })
    
    async def route_polymarket_data(self, probability: float, market_id: str = "unknown"):
        """
        Route Polymarket probability data to the risk engine.
        
        Args:
            probability: Market probability (0.0 to 1.0)
            market_id: Market identifier
        """
        if not self.is_running:
            return
        
        logger.debug(f"🔀 Routing Polymarket data: {market_id} = {probability:.3f}")
        
        # Send to risk engine
        await self.risk_engine.ingest_polymarket_probability(probability)
        
        # Emit updated risk score to frontend
        await self._emit_risk_score()
        
        # Optionally broadcast raw data update
        await ws_manager.broadcast_data_update("polymarket", {
            "market_id": market_id,
            "probability": probability
        })
    
    async def route_reddit_data(self, sentiment: float, source: str = "reddit"):
        """
        Route Reddit sentiment data to the risk engine.
        
        Args:
            sentiment: Sentiment score (-1.0 to 1.0)
            source: Source identifier
        """
        if not self.is_running:
            return
        
        logger.debug(f"🔀 Routing Reddit data: {source} = {sentiment:.3f}")
        
        # Send to risk engine
        await self.risk_engine.ingest_reddit_sentiment(sentiment)
        
        # Emit updated risk score to frontend
        await self._emit_risk_score()
        
        # Optionally broadcast raw data update
        await ws_manager.broadcast_data_update("reddit", {
            "source": source,
            "sentiment": sentiment
        })
    
    # ==================== Risk Score Broadcasting ====================
    
    async def _emit_risk_score(self):
        """Emit the current risk score to all connected clients."""
        current_score = self.risk_engine.get_current_score()
        await ws_manager.broadcast_risk_score(current_score)
    
    # ==================== Interrupt Handling ====================
    
    async def _handle_interrupt(self, risk_score: float, context: Dict[str, Any]):
        """
        Handle an interrupt event triggered by the risk engine.
        Generates roast and voice, then broadcasts to frontend.
        
        Args:
            risk_score: Current risk score that triggered the interrupt
            context: Market context for AI generation
        """
        logger.warning(f"🚨 Handling interrupt event (risk: {risk_score:.2f})")
        
        try:
            # Generate roast message using OpenAI
            roast = await generate_roast(risk_score, context)
            logger.info(f"💬 Generated roast: {roast}")
            
            # Generate voice audio URL using ElevenLabs
            audio_url = await generate_voice(roast)
            logger.info(f"🔊 Generated audio: {audio_url}")
            
            # Broadcast interrupt event to frontend
            await ws_manager.broadcast_interrupt(
                roast=roast,
                audio_url=audio_url,
                risk_score=risk_score
            )
            
            # Also send an alert
            await ws_manager.broadcast_alert(
                alert_type="interrupt",
                message_text=f"Risk threshold exceeded: {risk_score:.1f}/100"
            )
            
        except Exception as e:
            logger.error(f"❌ Error handling interrupt: {e}")
            # Send error alert to frontend
            await ws_manager.broadcast_alert(
                alert_type="error",
                message_text=f"Failed to generate interrupt content: {str(e)}"
            )
    
    # ==================== Manual Controls ====================
    
    async def force_interrupt(self):
        """Manually trigger an interrupt for testing."""
        logger.info("🎬 Forcing interrupt for testing")
        current_score = self.risk_engine.get_current_score()
        context = self.risk_engine._get_context()
        await self._handle_interrupt(current_score, context)
    
    async def broadcast_status(self):
        """Broadcast current system status to all clients."""
        stats = self.risk_engine.get_statistics()
        await ws_manager.broadcast({
            "type": "STATUS",
            "payload": {
                "is_running": self.is_running,
                "statistics": stats,
                "connections": ws_manager.get_connection_count()
            }
        })
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get current statistics from the risk engine."""
        return self.risk_engine.get_statistics()


# Global singleton instance
event_router = EventRouter()

