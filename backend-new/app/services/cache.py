"""
In-memory TTL cache and shared lock state.
Replaces Supabase reads for market data endpoints when DB is unavailable.
"""
import time
import logging
from typing import Any, Optional, Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Simple TTL cache
# ---------------------------------------------------------------------------

_cache: Dict[str, Dict[str, Any]] = {}


def cache_get(key: str) -> Optional[Any]:
    """Return cached value if it exists and hasn't expired, else None."""
    entry = _cache.get(key)
    if entry is None:
        return None
    if time.time() > entry["expires_at"]:
        del _cache[key]
        return None
    return entry["value"]


def cache_set(key: str, value: Any, ttl_seconds: int = 60) -> None:
    """Store a value in the cache with a TTL."""
    _cache[key] = {
        "value": value,
        "expires_at": time.time() + ttl_seconds,
    }


# ---------------------------------------------------------------------------
# In-memory portfolio lock state  (replaces Supabase portfolio table)
# ---------------------------------------------------------------------------

_lock_state: Dict[str, Any] = {
    "is_locked": False,
    "lock_reason": None,
    "lock_expires_at": None,
}


def get_lock_state() -> Dict[str, Any]:
    """Return the current lock state, auto-unlocking if expired."""
    expires = _lock_state.get("lock_expires_at")
    if _lock_state["is_locked"] and expires:
        if isinstance(expires, str):
            try:
                expiry = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                if datetime.utcnow() > expiry.replace(tzinfo=None):
                    set_lock_state(False, None, None)
            except (ValueError, AttributeError):
                pass
        elif isinstance(expires, datetime):
            if datetime.utcnow() > expires.replace(tzinfo=None):
                set_lock_state(False, None, None)
    return _lock_state.copy()


def set_lock_state(
    is_locked: bool,
    lock_reason: Optional[str],
    lock_expires_at: Optional[str],
) -> None:
    """Update the in-memory lock state."""
    _lock_state["is_locked"] = is_locked
    _lock_state["lock_reason"] = lock_reason
    _lock_state["lock_expires_at"] = lock_expires_at
    logger.info(f"Lock state updated: locked={is_locked}, reason={lock_reason}")
