"""
ElevenLabs Integration for Text-to-Speech generation.
Converts roast messages into audio files.
"""
import asyncio
import logging
import os
import hashlib
from typing import Optional
from elevenlabs import AsyncElevenLabs
from elevenlabs import VoiceSettings

from config import config

logger = logging.getLogger(__name__)

# Initialize ElevenLabs client
elevenlabs_client = AsyncElevenLabs(
    api_key=config.ELEVENLABS_API_KEY
) if config.ELEVENLABS_API_KEY else None


async def generate_voice(text: str, use_cache: bool = True) -> str:
    """
    Generate voice audio from text using ElevenLabs.
    
    Args:
        text: Text to convert to speech
        use_cache: Whether to use cached audio if available
        
    Returns:
        URL or path to the generated audio file
    """
    if not elevenlabs_client:
        logger.warning("⚠️  ElevenLabs client not initialized, using fallback audio")
        return _get_fallback_audio_url()
    
    try:
        # Check cache first
        if use_cache:
            cached_url = _get_cached_audio(text)
            if cached_url:
                logger.info(f"📦 Using cached audio for text")
                return cached_url
        
        logger.info("🎙️  Generating voice with ElevenLabs...")
        
        # Generate audio using ElevenLabs
        audio_generator = await elevenlabs_client.text_to_speech.convert(
            voice_id=config.ELEVENLABS_VOICE_ID,
            optimize_streaming_latency="0",
            output_format="mp3_44100_128",
            text=text,
            model_id="eleven_turbo_v2_5",  # Fast, high-quality model
            voice_settings=VoiceSettings(
                stability=0.5,
                similarity_boost=0.75,
                style=0.5,
                use_speaker_boost=True,
            ),
        )
        
        # Save audio to file
        audio_path = await _save_audio_stream(audio_generator, text)
        
        logger.info(f"✅ Generated voice audio: {audio_path}")
        
        # Return URL (in production, this would be a CDN URL)
        # For now, return a local path that the frontend can access
        return f"/audio/{os.path.basename(audio_path)}"
        
    except Exception as e:
        logger.error(f"❌ Error generating voice: {e}")
        return _get_fallback_audio_url()


async def _save_audio_stream(audio_generator, text: str) -> str:
    """
    Save audio stream to a file.
    
    Args:
        audio_generator: Async generator of audio bytes
        text: Original text (for naming)
        
    Returns:
        Path to saved audio file
    """
    # Create audio directory if it doesn't exist
    audio_dir = "static/audio"
    os.makedirs(audio_dir, exist_ok=True)
    
    # Generate unique filename based on text hash
    text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
    filename = f"roast_{text_hash}.mp3"
    filepath = os.path.join(audio_dir, filename)
    
    # Write audio chunks to file
    with open(filepath, "wb") as f:
        async for chunk in audio_generator:
            if chunk:
                f.write(chunk)
    
    logger.info(f"💾 Saved audio to {filepath}")
    return filepath


def _get_cached_audio(text: str) -> Optional[str]:
    """
    Check if audio for this text is already cached.
    
    Args:
        text: Text to check cache for
        
    Returns:
        URL to cached audio or None
    """
    audio_dir = "static/audio"
    text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
    filename = f"roast_{text_hash}.mp3"
    filepath = os.path.join(audio_dir, filename)
    
    if os.path.exists(filepath):
        return f"/audio/{filename}"
    
    return None


def _get_fallback_audio_url() -> str:
    """
    Get a fallback audio URL when ElevenLabs is unavailable.
    
    Returns:
        URL to fallback audio file
    """
    # Return a pre-generated demo audio file
    # You would create this file manually or use a default TTS
    fallback_url = "/audio/fallback_roast.mp3"
    logger.info(f"📢 Using fallback audio: {fallback_url}")
    return fallback_url


async def create_fallback_audio():
    """
    Create a fallback audio file for demo purposes.
    This should be run once during setup.
    """
    if not elevenlabs_client:
        logger.error("Cannot create fallback audio without ElevenLabs API key")
        return
    
    fallback_text = "Risk levels are critically high. Time to reassess your strategy."
    
    try:
        audio_generator = await elevenlabs_client.text_to_speech.convert(
            voice_id=config.ELEVENLABS_VOICE_ID,
            text=fallback_text,
            model_id="eleven_turbo_v2_5",
        )
        
        audio_dir = "static/audio"
        os.makedirs(audio_dir, exist_ok=True)
        filepath = os.path.join(audio_dir, "fallback_roast.mp3")
        
        with open(filepath, "wb") as f:
            async for chunk in audio_generator:
                if chunk:
                    f.write(chunk)
        
        logger.info(f"✅ Created fallback audio: {filepath}")
        
    except Exception as e:
        logger.error(f"❌ Error creating fallback audio: {e}")


async def test_generate_voice():
    """Test function for voice generation."""
    test_text = "Risk at 85%? Congratulations, you've achieved peak market chaos."
    audio_url = await generate_voice(test_text)
    print(f"Generated audio URL: {audio_url}")


if __name__ == "__main__":
    # Test the voice generator
    asyncio.run(test_generate_voice())

