import { NextRequest, NextResponse } from "next/server";

// ElevenLabs API key
const ELEVENLABS_API_KEY = "sk_b70135eab11abc00daa9e8aa1a51965aeef9b2ca3c57df70";
const VOICE_ID = "ocZQ262SsZb9RIxcQBOj"; // Trial voice ID

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    console.log(`Generating speech with Flicker voice for text: ${text.substring(0, 50)}...`);
    console.log(`Using API key: ${ELEVENLABS_API_KEY.substring(0, 10)}...`);

    // First, test the API key by checking user info
    try {
      const testResponse = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      });
      console.log("API Key test status:", testResponse.status);
      if (testResponse.ok) {
        const userData = await testResponse.json();
        console.log("API Key valid! User:", userData.subscription?.tier || "unknown");
      } else {
        const errorText = await testResponse.text();
        console.error("API Key validation failed:", testResponse.status, errorText);
      }
    } catch (testError) {
      console.error("API Key test error:", testError);
    }

    // Use ElevenLabs V2 (Turbo) with alignment data for lip sync
    const requestBody = {
      text,
      model_id: "eleven_turbo_v2", // V2 Turbo model
    };

    console.log("Calling ElevenLabs V2 Turbo with alignment data");

    // Get V2 Turbo audio with alignment/viseme data
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("V2 API error:", response.status, errorText);
      return NextResponse.json(
        { error: `V2 API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    // Get response with audio + alignment data
    const data = await response.json();
    
    console.log("V2 audio generated with alignment:", {
      hasAudio: !!data.audio_base64,
      hasAlignment: !!data.alignment,
      alignmentKeys: data.alignment ? Object.keys(data.alignment) : []
    });

    // Return V2 audio with viseme/phoneme alignment data
    return NextResponse.json({
      audio: data.audio_base64,
      alignment: data.alignment, // Contains character/word/phoneme timing
    });
  } catch (error) {
    console.error("Error in TTS API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
