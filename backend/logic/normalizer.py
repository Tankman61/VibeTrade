"""
Normalizer module for converting raw risk metrics into 0-100 scores.
Uses statistical normalization techniques.
"""
import math
from typing import List, Optional
from collections import deque


class RiskNormalizer:
    """
    Normalizes raw risk values into a 0-100 scale.
    Uses adaptive min-max normalization with historical tracking.
    """
    
    def __init__(self, history_size: int = 100):
        """
        Initialize the normalizer.
        
        Args:
            history_size: Number of historical values to track for normalization
        """
        self.history: deque = deque(maxlen=history_size)
        self.min_value: Optional[float] = None
        self.max_value: Optional[float] = None
    
    def normalize(self, raw_value: float) -> float:
        """
        Normalize a raw risk value to 0-100 scale.
        
        Args:
            raw_value: Raw risk metric from the risk engine
            
        Returns:
            Normalized score between 0 and 100
        """
        # Add to history
        self.history.append(raw_value)
        
        # Update min/max
        if self.min_value is None or raw_value < self.min_value:
            self.min_value = raw_value
        if self.max_value is None or raw_value > self.max_value:
            self.max_value = raw_value
        
        # If we don't have enough data, use simple scaling
        if len(self.history) < 5:
            return self._simple_normalize(raw_value)
        
        # Use adaptive min-max normalization
        return self._adaptive_normalize(raw_value)
    
    def _simple_normalize(self, value: float) -> float:
        """
        Simple normalization for when we don't have enough history.
        Assumes raw values are roughly in 0-1 range.
        """
        normalized = value * 100
        return self._clamp(normalized, 0, 100)
    
    def _adaptive_normalize(self, value: float) -> float:
        """
        Adaptive min-max normalization using historical data.
        """
        # Calculate dynamic min/max from recent history
        recent_values = list(self.history)
        dynamic_min = min(recent_values)
        dynamic_max = max(recent_values)
        
        # Add some padding to avoid extremes
        range_padding = (dynamic_max - dynamic_min) * 0.1
        dynamic_min -= range_padding
        dynamic_max += range_padding
        
        # Normalize to 0-100
        if dynamic_max - dynamic_min < 0.0001:  # Avoid division by zero
            return 50.0  # Return middle value if no variance
        
        normalized = ((value - dynamic_min) / (dynamic_max - dynamic_min)) * 100
        return self._clamp(normalized, 0, 100)
    
    def normalize_zscore(self, raw_value: float) -> float:
        """
        Alternative normalization using z-score.
        Maps standard deviations to 0-100 scale.
        
        Args:
            raw_value: Raw risk metric
            
        Returns:
            Normalized score between 0 and 100
        """
        if len(self.history) < 2:
            return self._simple_normalize(raw_value)
        
        # Calculate mean and standard deviation
        values = list(self.history)
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std_dev = math.sqrt(variance) if variance > 0 else 1.0
        
        # Calculate z-score
        z_score = (raw_value - mean) / std_dev
        
        # Map z-score to 0-100 (±3 std devs covers ~99.7% of data)
        # z-score of -3 → 0, z-score of 0 → 50, z-score of +3 → 100
        normalized = (z_score + 3) * (100 / 6)
        return self._clamp(normalized, 0, 100)
    
    @staticmethod
    def _clamp(value: float, min_val: float, max_val: float) -> float:
        """Clamp a value between min and max."""
        return max(min_val, min(max_val, value))
    
    def reset(self):
        """Reset the normalizer's history."""
        self.history.clear()
        self.min_value = None
        self.max_value = None
    
    def get_statistics(self) -> dict:
        """Get current normalization statistics."""
        if not self.history:
            return {
                "history_size": 0,
                "min": None,
                "max": None,
                "mean": None
            }
        
        values = list(self.history)
        return {
            "history_size": len(values),
            "min": min(values),
            "max": max(values),
            "mean": sum(values) / len(values)
        }

