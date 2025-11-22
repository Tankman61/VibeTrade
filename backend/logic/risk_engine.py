"""
Risk Engine - Core risk calculation and interrupt detection.
Consumes data from multiple sources and produces normalized risk scores.
"""
import time
import asyncio
from collections import deque
from typing import Dict, Optional, Callable
from datetime import datetime
import logging

from logic.normalizer import RiskNormalizer
from config import config

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Main risk calculation engine.
    Maintains internal state from multiple data sources and computes risk scores.
    """
    
    def __init__(self, interrupt_callback: Optional[Callable] = None):
        """
        Initialize the risk engine.
        
        Args:
            interrupt_callback: Async function to call when risk exceeds threshold
        """
        # Data storage
        self.crypto_prices = deque(maxlen=config.CRYPTO_MA_WINDOW)
        self.polymarket_probs = deque(maxlen=config.POLYMARKET_MA_WINDOW)
        self.reddit_sentiments = deque(maxlen=config.REDDIT_MA_WINDOW)
        
        # State tracking
        self.current_risk_score: float = 0.0
        self.last_interrupt_time: float = 0.0
        self.interrupt_callback = interrupt_callback
        
        # Normalizer
        self.normalizer = RiskNormalizer(history_size=100)
        
        # Volatility tracking
        self.crypto_volatility: float = 0.0
        self.polymarket_volatility: float = 0.0
        
        # Statistics
        self.total_updates: int = 0
        self.interrupt_count: int = 0
        
        logger.info("🎰 Risk Engine initialized")
    
    async def ingest_crypto_price(self, price: float):
        """
        Ingest a new crypto spot price.
        
        Args:
            price: Current spot price (e.g., BTC price in USD)
        """
        self.crypto_prices.append(price)
        self.total_updates += 1
        
        # Calculate volatility
        if len(self.crypto_prices) >= 2:
            self.crypto_volatility = self._calculate_volatility(list(self.crypto_prices))
        
        logger.debug(f"💰 Crypto price: ${price:.2f}, volatility: {self.crypto_volatility:.4f}")
        
        # Trigger risk calculation
        await self._calculate_and_emit_risk()
    
    async def ingest_polymarket_probability(self, probability: float):
        """
        Ingest a new Polymarket probability.
        
        Args:
            probability: Market probability (0.0 to 1.0)
        """
        self.polymarket_probs.append(probability)
        self.total_updates += 1
        
        # Calculate volatility
        if len(self.polymarket_probs) >= 2:
            self.polymarket_volatility = self._calculate_volatility(list(self.polymarket_probs))
        
        logger.debug(f"📊 Polymarket prob: {probability:.3f}, volatility: {self.polymarket_volatility:.4f}")
        
        # Trigger risk calculation
        await self._calculate_and_emit_risk()
    
    async def ingest_reddit_sentiment(self, sentiment: float):
        """
        Ingest a new Reddit sentiment score.
        
        Args:
            sentiment: Sentiment score (-1.0 to 1.0, where -1 is negative, +1 is positive)
        """
        self.reddit_sentiments.append(sentiment)
        self.total_updates += 1
        
        logger.debug(f"💬 Reddit sentiment: {sentiment:.3f}")
        
        # Trigger risk calculation
        await self._calculate_and_emit_risk()
    
    async def _calculate_and_emit_risk(self):
        """
        Calculate the current risk score and emit it.
        Triggers interrupt if threshold is exceeded.
        """
        # Calculate raw risk metric
        raw_risk = self._calculate_raw_risk()
        
        # Normalize to 0-100
        self.current_risk_score = self.normalizer.normalize(raw_risk)
        
        logger.debug(f"📈 Raw risk: {raw_risk:.4f}, Normalized: {self.current_risk_score:.2f}")
        
        # Check for interrupt condition
        await self._check_interrupt()
    
    def _calculate_raw_risk(self) -> float:
        """
        Calculate the raw risk metric from all data sources.
        
        Returns:
            Raw risk value (will be normalized later)
        """
        risk_components = []
        
        # Component 1: Crypto volatility risk
        if self.crypto_volatility > 0:
            crypto_risk = self.crypto_volatility * 10  # Scale up volatility
            risk_components.append(crypto_risk)
        
        # Component 2: Polymarket probability risk
        # Higher volatility = higher risk, extreme probabilities (close to 0 or 1) = higher risk
        if self.polymarket_probs:
            latest_prob = self.polymarket_probs[-1]
            # Distance from 0.5 indicates certainty/extremity
            prob_extremity = abs(latest_prob - 0.5) * 2  # 0 to 1
            prob_risk = (prob_extremity + self.polymarket_volatility) * 0.5
            risk_components.append(prob_risk)
        
        # Component 3: Reddit sentiment risk
        # Extreme negative sentiment = high risk
        if self.reddit_sentiments:
            latest_sentiment = self.reddit_sentiments[-1]
            # Convert sentiment to risk: -1 (very negative) = high risk
            sentiment_risk = (1.0 - latest_sentiment) / 2.0  # 0 to 1
            
            # Check for sentiment volatility (rapid mood swings = risk)
            if len(self.reddit_sentiments) >= 2:
                sentiment_volatility = self._calculate_volatility(list(self.reddit_sentiments))
                sentiment_risk += sentiment_volatility
            
            risk_components.append(sentiment_risk)
        
        # Component 4: Cross-correlation risk
        # If all signals are alarming simultaneously, multiply risk
        if len(risk_components) >= 2:
            correlation_multiplier = 1.0 + (len(risk_components) * 0.1)
            raw_risk = sum(risk_components) * correlation_multiplier
        else:
            raw_risk = sum(risk_components) if risk_components else 0.0
        
        return raw_risk
    
    def _calculate_volatility(self, values: list) -> float:
        """
        Calculate volatility (standard deviation of percentage changes).
        
        Args:
            values: List of numeric values
            
        Returns:
            Volatility measure
        """
        if len(values) < 2:
            return 0.0
        
        # Calculate percentage changes
        changes = []
        for i in range(1, len(values)):
            if values[i-1] != 0:
                pct_change = abs((values[i] - values[i-1]) / values[i-1])
                changes.append(pct_change)
        
        if not changes:
            return 0.0
        
        # Calculate standard deviation
        mean = sum(changes) / len(changes)
        variance = sum((x - mean) ** 2 for x in changes) / len(changes)
        return variance ** 0.5
    
    async def _check_interrupt(self):
        """
        Check if an interrupt should be triggered based on risk score.
        Respects cooldown period.
        """
        current_time = time.time()
        time_since_last = current_time - self.last_interrupt_time
        
        # Check if risk exceeds threshold and cooldown has passed
        if (self.current_risk_score >= config.RISK_THRESHOLD and 
            time_since_last >= config.INTERRUPT_COOLDOWN_SECONDS):
            
            logger.warning(f"🚨 INTERRUPT TRIGGERED! Risk: {self.current_risk_score:.2f}")
            
            self.last_interrupt_time = current_time
            self.interrupt_count += 1
            
            # Call the interrupt callback
            if self.interrupt_callback:
                await self.interrupt_callback(self.current_risk_score, self._get_context())
    
    def _get_context(self) -> Dict:
        """
        Get current context for AI roast generation.
        
        Returns:
            Dictionary with current market context
        """
        context = {
            "risk_score": self.current_risk_score,
            "timestamp": datetime.now().isoformat(),
        }
        
        if self.crypto_prices:
            context["crypto_price"] = self.crypto_prices[-1]
            context["crypto_volatility"] = self.crypto_volatility
        
        if self.polymarket_probs:
            context["polymarket_probability"] = self.polymarket_probs[-1]
            context["polymarket_volatility"] = self.polymarket_volatility
        
        if self.reddit_sentiments:
            context["reddit_sentiment"] = self.reddit_sentiments[-1]
        
        return context
    
    def get_current_score(self) -> float:
        """Get the current risk score."""
        return self.current_risk_score
    
    def get_statistics(self) -> Dict:
        """Get engine statistics."""
        return {
            "current_risk_score": self.current_risk_score,
            "total_updates": self.total_updates,
            "interrupt_count": self.interrupt_count,
            "crypto_data_points": len(self.crypto_prices),
            "polymarket_data_points": len(self.polymarket_probs),
            "reddit_data_points": len(self.reddit_sentiments),
            "crypto_volatility": self.crypto_volatility,
            "polymarket_volatility": self.polymarket_volatility,
            "normalizer_stats": self.normalizer.get_statistics()
        }

