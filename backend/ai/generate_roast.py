"""
OpenAI GPT-4o Integration for generating roast messages.
Generates witty, context-aware roasts based on market conditions.
"""
import asyncio
import logging
from typing import Dict, Any
import openai
from openai import AsyncOpenAI

from config import config

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=config.OPENAI_API_KEY) if config.OPENAI_API_KEY else None


async def generate_roast(risk_score: float, context: Dict[str, Any]) -> str:
    """
    Generate a roast message using OpenAI GPT-4o.
    
    Args:
        risk_score: Current risk score (0-100)
        context: Market context including crypto prices, sentiment, etc.
        
    Returns:
        Generated roast message as a string
    """
    if not client:
        logger.warning("⚠️  OpenAI client not initialized, using fallback roast")
        return _generate_fallback_roast(risk_score, context)
    
    try:
        # Build context-aware prompt
        prompt = _build_roast_prompt(risk_score, context)
        
        logger.info("🤖 Generating roast with OpenAI GPT-4o...")
        
        # Call OpenAI API
        response = await client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a sarcastic, witty AI risk analyst with a dark sense of humor. "
                        "Your job is to deliver short, punchy roasts (1-2 sentences) when market risk gets too high. "
                        "Be clever, reference the actual market data, and make it sting a little. "
                        "Keep it professional but entertaining. No profanity."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=100,
            temperature=0.9,  # High creativity
            presence_penalty=0.6,
            frequency_penalty=0.3
        )
        
        roast = response.choices[0].message.content.strip()
        logger.info(f"✅ Generated roast: {roast}")
        
        return roast
        
    except openai.APIError as e:
        logger.error(f"❌ OpenAI API error: {e}")
        return _generate_fallback_roast(risk_score, context)
    except Exception as e:
        logger.error(f"❌ Unexpected error generating roast: {e}")
        return _generate_fallback_roast(risk_score, context)


def _build_roast_prompt(risk_score: float, context: Dict[str, Any]) -> str:
    """
    Build a context-aware prompt for the roast generation.
    
    Args:
        risk_score: Current risk score
        context: Market context data
        
    Returns:
        Formatted prompt string
    """
    prompt_parts = [
        f"The market risk just hit {risk_score:.1f}/100. Time to roast the situation."
    ]
    
    # Add crypto context
    if "crypto_price" in context:
        price = context["crypto_price"]
        volatility = context.get("crypto_volatility", 0)
        prompt_parts.append(
            f"Bitcoin is at ${price:.2f} with {volatility*100:.1f}% volatility."
        )
    
    # Add Polymarket context
    if "polymarket_probability" in context:
        prob = context["polymarket_probability"]
        prompt_parts.append(
            f"Polymarket prediction probability is {prob*100:.1f}%."
        )
    
    # Add Reddit sentiment context
    if "reddit_sentiment" in context:
        sentiment = context["reddit_sentiment"]
        sentiment_label = "extremely negative" if sentiment < -0.5 else "negative" if sentiment < 0 else "positive"
        prompt_parts.append(
            f"Reddit sentiment is {sentiment_label} ({sentiment:.2f})."
        )
    
    prompt_parts.append("Deliver a witty, cutting roast about this situation:")
    
    return " ".join(prompt_parts)


def _generate_fallback_roast(risk_score: float, context: Dict[str, Any]) -> str:
    """
    Generate a fallback roast when OpenAI is unavailable.
    
    Args:
        risk_score: Current risk score
        context: Market context
        
    Returns:
        Fallback roast message
    """
    fallback_roasts = [
        f"Risk at {risk_score:.0f}%? Congratulations, you've achieved peak market chaos. 🎉",
        f"With risk this high ({risk_score:.0f}%), even your portfolio is having an existential crisis.",
        f"Risk score: {risk_score:.0f}/100. The market isn't volatile, you're just not ready for this level of chaos.",
        f"Your risk tolerance called—it wants a restraining order. ({risk_score:.0f}% risk)",
        f"At {risk_score:.0f}% risk, this is basically financial skydiving without a parachute.",
        f"Risk level: {risk_score:.0f}/100. Time to panic? Nah, you passed that point 20 points ago.",
        f"The market is at {risk_score:.0f}% risk. Your stop-losses are writing their wills.",
    ]
    
    # Choose based on risk score to add variety
    index = int(risk_score) % len(fallback_roasts)
    roast = fallback_roasts[index]
    
    logger.info(f"📝 Using fallback roast: {roast}")
    return roast


async def test_generate_roast():
    """Test function for roast generation."""
    test_context = {
        "risk_score": 85.5,
        "crypto_price": 43250.50,
        "crypto_volatility": 0.05,
        "polymarket_probability": 0.75,
        "reddit_sentiment": -0.6
    }
    
    roast = await generate_roast(85.5, test_context)
    print(f"Generated roast: {roast}")


if __name__ == "__main__":
    # Test the roast generator
    asyncio.run(test_generate_roast())

