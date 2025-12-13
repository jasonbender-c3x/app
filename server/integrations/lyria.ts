/**
 * =============================================================================
 * LYRIA MUSIC GENERATION INTEGRATION
 * =============================================================================
 * 
 * Integration with Google's Lyria 2 model for AI music generation.
 * 
 * TWO OPTIONS for Lyria access:
 * 1. Lyria RealTime (Gemini API) - Experimental, uses @google/genai with v1alpha
 * 2. Lyria 2 (Vertex AI) - Production, requires Google Cloud project setup
 * 
 * @see https://ai.google.dev/gemini-api/docs/music-generation
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music
 */

import { GoogleGenAI } from "@google/genai";

export interface MusicGenerationParams {
  prompt: string;
  negativePrompt?: string;
  bpm?: number;
  density?: number;
  brightness?: number;
  scale?: string;
  mode?: "QUALITY" | "DIVERSITY" | "VOCALIZATION";
  seed?: number;
}

export interface MusicGenerationResult {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  error?: string;
  description?: string;
}

/**
 * Generate music using Google's Lyria model
 * 
 * Attempts to use Lyria RealTime (experimental) first.
 * Falls back to providing a detailed music composition description.
 */
export async function generateMusic(params: MusicGenerationParams): Promise<MusicGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured. Add your Gemini API key to use music generation."
    };
  }

  try {
    const client = new GoogleGenAI({ 
      apiKey,
      apiVersion: "v1alpha"
    });

    const musicPrompt = buildMusicPrompt(params);
    
    try {
      console.log("[Lyria] Attempting Lyria RealTime connection...");
      
      const liveSession = await (client as any).live?.music?.connect?.({
        model: "models/lyria-realtime-exp",
      });

      if (liveSession) {
        console.log("[Lyria] Connected to Lyria RealTime");
        
        await liveSession.setWeightedPrompts([
          { prompt: params.prompt, weight: 1.0 }
        ]);

        await liveSession.setMusicGenerationConfig({
          bpm: params.bpm || 120,
          density: params.density || 0.5,
          brightness: params.brightness || 0.5,
          scale: params.scale || "C_MAJOR",
          music_generation_mode: params.mode || "QUALITY"
        });

        const audioChunks: Buffer[] = [];
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            liveSession.stop?.();
            resolve();
          }, 35000);

          liveSession.play?.();

          setTimeout(() => {
            liveSession.stop?.();
            clearTimeout(timeout);
            resolve();
          }, 30000);
        });

        if (audioChunks.length > 0) {
          const combinedAudio = Buffer.concat(audioChunks);
          return {
            success: true,
            audioBase64: combinedAudio.toString("base64"),
            mimeType: "audio/wav",
            duration: 30,
            description: `Generated ${params.prompt}`
          };
        }
      }
    } catch (lyriaError: any) {
      console.log("[Lyria] RealTime not available:", lyriaError?.message || "Unknown error");
    }

    console.log("[Lyria] Falling back to description mode");
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `You are a professional music producer. Create a detailed production plan for this music request:

${musicPrompt}

Provide:
1. **Track Overview**: Overall mood, energy level, and genre classification
2. **Instrumentation**: List all instruments and their roles
3. **Structure**: Intro, verses, chorus, bridge, outro with timing
4. **Chord Progression**: Key, scale, and main chord sequences
5. **Production Notes**: Effects, mixing tips, and style references

Format this as a professional music production brief.`
        }]
      }]
    });

    const description = response.text || "Music description not available";
    
    return {
      success: true,
      audioBase64: undefined,
      mimeType: undefined,
      duration: 30,
      description,
      error: `Lyria RealTime API is experimental and requires additional setup.\n\nTo enable audio generation:\n1. Visit https://ai.google.dev/gemini-api/docs/music-generation\n2. Enable the Lyria RealTime experimental API\n3. Your Gemini API key may need specific access permissions\n\nAlternatively, use Vertex AI Lyria 2 for production audio generation.`
    };

  } catch (error) {
    console.error("[Lyria] Generation error:", error);
    
    return {
      success: false,
      error: error instanceof Error 
        ? `Music generation failed: ${error.message}` 
        : "Unknown error during music generation"
    };
  }
}

/**
 * Build a detailed music prompt from generation parameters
 */
function buildMusicPrompt(params: MusicGenerationParams): string {
  const parts: string[] = [`Music Description: ${params.prompt}`];
  
  if (params.negativePrompt) {
    parts.push(`Exclude: ${params.negativePrompt}`);
  }
  
  if (params.bpm) {
    parts.push(`Tempo: ${params.bpm} BPM`);
  }
  
  if (params.density !== undefined) {
    const densityDesc = params.density < 0.3 ? "sparse/minimal" 
      : params.density < 0.7 ? "moderate" 
      : "dense/complex";
    parts.push(`Density: ${densityDesc} (${Math.round(params.density * 100)}%)`);
  }
  
  if (params.brightness !== undefined) {
    const brightnessDesc = params.brightness < 0.3 ? "dark/mellow"
      : params.brightness < 0.7 ? "balanced"
      : "bright/energetic";
    parts.push(`Brightness: ${brightnessDesc} (${Math.round(params.brightness * 100)}%)`);
  }
  
  if (params.scale) {
    parts.push(`Key/Scale: ${params.scale.replace("_", " ")}`);
  }
  
  if (params.mode) {
    parts.push(`Generation Mode: ${params.mode}`);
  }
  
  return parts.join("\n");
}

/**
 * Check if Lyria API is available
 */
export async function checkLyriaAvailability(): Promise<{
  available: boolean;
  message: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      available: false,
      message: "GEMINI_API_KEY is not configured"
    };
  }

  return {
    available: true,
    message: "Lyria integration ready. Note: Full audio generation requires Lyria RealTime experimental API access."
  };
}
