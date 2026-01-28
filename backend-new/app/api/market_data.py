"""
Market data endpoints — live-fetch mode (no Supabase required)
GET /api/risk-monitor - Get full risk monitor data
GET /api/polymarket - Get Polymarket feed
GET /api/reddit - Get Reddit sentiment feed
GET /api/sentiment - Get aggregated sentiment stats
"""
import logging
from fastapi import APIRouter, Query
from typing import Optional

from app.services.cache import cache_get, cache_set
from app.services.finnhub import get_btc_data, finnhub_service
from app.services.polymarket import get_polymarket_client
from app.services.reddit import get_reddit_client

logger = logging.getLogger(__name__)

router = APIRouter()

# Hardcoded crypto watchlist tickers (replaces Supabase watchlist table)
WATCHLIST_TICKERS = ["BTC", "ETH", "SOL", "DOGE", "XRP", "ADA"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_reddit_posts_cached():
    """Fetch Reddit posts with 120s TTL cache (Reddit rate-limits aggressively)."""
    cached = cache_get("reddit_posts")
    if cached is not None:
        return cached

    client = get_reddit_client()
    try:
        raw_posts = await client.fetch_posts(limit_per_sub=10)
    except Exception as e:
        logger.error(f"Reddit fetch failed: {e}")
        raw_posts = []

    posts = []
    for p in raw_posts:
        posts.append({
            "text": p.get("title", ""),
            "username": p.get("username", ""),
            "subreddit": p.get("subreddit", ""),
            "sentiment": p.get("sentiment", "neutral"),
            "posted_ago": p.get("posted_ago", ""),
            "url": p.get("url", "https://reddit.com"),
        })

    cache_set("reddit_posts", posts, ttl_seconds=120)
    return posts


def _compute_sentiment_stats(posts):
    """Compute aggregated sentiment from a list of posts."""
    bullish = sum(1 for p in posts if p.get("sentiment") == "bullish")
    bearish = sum(1 for p in posts if p.get("sentiment") == "bearish")
    return {
        "bullish": bullish,
        "bearish": bearish,
        "score": bullish - bearish,
        "volume": str(len(posts)),
    }


def _calculate_risk_score(sentiment_score: int, price_change: float, polymarket_avg_odds: float) -> int:
    """
    Calculate risk_score using weighted formula (mirrors monitor worker):
    - Sentiment component: 30%
    - Technical component: 30%
    - Polymarket component: 40%
    """
    # Sentiment component (30%)
    if sentiment_score < -10:
        sentiment_component = 90
    elif sentiment_score < -5:
        sentiment_component = 70
    elif sentiment_score < 0:
        sentiment_component = 50
    elif sentiment_score < 5:
        sentiment_component = 30
    else:
        sentiment_component = 10

    # Technical component (30%)
    if price_change <= -5:
        technical_component = 100
    elif price_change <= -3:
        technical_component = 80
    elif price_change <= -1:
        technical_component = 60
    elif price_change < 0:
        technical_component = 40
    elif price_change < 3:
        technical_component = 20
    else:
        technical_component = 10

    # Polymarket component (40%)
    divergence = abs(polymarket_avg_odds - 0.5)
    if divergence > 0.35:
        polymarket_component = 90
    elif divergence > 0.25:
        polymarket_component = 70
    elif divergence > 0.15:
        polymarket_component = 50
    else:
        polymarket_component = 30

    if polymarket_avg_odds < 0.3:
        polymarket_component = min(100, polymarket_component + 20)

    risk_score = int(
        sentiment_component * 0.3
        + technical_component * 0.3
        + polymarket_component * 0.4
    )
    return max(0, min(100, risk_score))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/risk-monitor")
async def get_risk_monitor():
    """
    Get full risk monitor data including market overview and watchlist.
    Fetches live data from Finnhub, Reddit, and Polymarket (cached 30s).
    """
    cached = cache_get("risk_monitor")
    if cached is not None:
        return cached

    # BTC price from Finnhub
    try:
        btc_data = await get_btc_data()
    except Exception as e:
        logger.warning(f"BTC data unavailable: {e}")
        btc_data = {
            "btc_price": 0,
            "price_change_24h": 0,
            "volume_24h": "$0",
            "price_high_24h": 0,
            "price_low_24h": 0,
        }

    # Sentiment from cached Reddit posts
    posts = await _fetch_reddit_posts_cached()
    sentiment_stats = _compute_sentiment_stats(posts)

    # Polymarket average odds
    try:
        pm_client = get_polymarket_client()
        pm_avg_odds = await pm_client.get_average_odds()
    except Exception as e:
        logger.warning(f"Polymarket odds unavailable: {e}")
        pm_avg_odds = 0.5

    # Risk score
    risk_score = _calculate_risk_score(
        sentiment_score=sentiment_stats["score"],
        price_change=btc_data.get("price_change_24h", 0),
        polymarket_avg_odds=pm_avg_odds,
    )

    if risk_score < 40:
        risk_level = "Low"
    elif risk_score < 70:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Hype level (derived from bullish sentiment proportion)
    total_posts = max(len(posts), 1)
    hype_score = int((sentiment_stats["bullish"] / total_posts) * 100)
    if hype_score < 40:
        hype_level = "Low"
    elif hype_score < 70:
        hype_level = "Medium"
    else:
        hype_level = "High"

    # Watchlist — live prices from Finnhub
    watchlist = []
    for ticker in WATCHLIST_TICKERS:
        price = finnhub_service.get_price(ticker)
        # We don't have 24h change from Finnhub websocket, so show 0
        change_str = "+0.0%"
        watchlist.append({"ticker": f"{ticker}/USD", "change": change_str})

    result = {
        "risk_level": {
            "score": risk_score,
            "level": risk_level,
            "summary": f"Risk computed from live data — sentiment={sentiment_stats['score']}, polymarket_odds={pm_avg_odds:.2f}",
        },
        "hype_level": {"score": hype_score, "level": hype_level},
        "market_overview": {
            "btc_price": btc_data.get("btc_price", 0),
            "price_change_24h": btc_data.get("price_change_24h", 0),
            "volume_24h": btc_data.get("volume_24h", "$0"),
            "price_range_24h": {
                "low": btc_data.get("price_low_24h", 0),
                "high": btc_data.get("price_high_24h", 0),
            },
        },
        "technical": {"rsi": 0, "macd": 0},
        "watchlist": watchlist,
    }

    cache_set("risk_monitor", result, ttl_seconds=30)
    return result


@router.get("/polymarket")
async def get_polymarket():
    """Get Polymarket prediction markets (cached 60s)."""
    cached = cache_get("polymarket")
    if cached is not None:
        return cached

    client = get_polymarket_client()
    try:
        raw_markets = await client.fetch_btc_markets(limit=10)
    except Exception as e:
        logger.error(f"Polymarket fetch failed: {e}")
        raw_markets = []

    markets = []
    for m in raw_markets:
        markets.append({
            "question": m.get("title", ""),
            "probability": int(float(m.get("odds", 0.5)) * 100),
            "change": m.get("change") or "+0%",
            "volume": m.get("volume") or "0",
            "url": m.get("url") or "https://polymarket.com",
        })

    cache_set("polymarket", markets, ttl_seconds=60)
    return markets


@router.get("/reddit")
async def get_reddit(subreddit: Optional[str] = Query("All", description="Filter by subreddit")):
    """Get Reddit posts with optional subreddit filter (cached 120s)."""
    posts = await _fetch_reddit_posts_cached()

    if subreddit and subreddit != "All":
        posts = [p for p in posts if p.get("subreddit") == subreddit or p.get("subreddit") == f"r/{subreddit}"]

    return posts


@router.get("/sentiment")
async def get_sentiment():
    """Get aggregated sentiment stats computed from live Reddit data."""
    posts = await _fetch_reddit_posts_cached()
    return _compute_sentiment_stats(posts)
