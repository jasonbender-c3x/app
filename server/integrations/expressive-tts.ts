/**
 * =============================================================================
 * GOOGLE CLOUD TEXT-TO-SPEECH INTEGRATION
 * =============================================================================
 * 
 * High-quality TTS using Google Cloud Text-to-Speech API.
 * Free tier: 1M characters/month (vs Gemini TTS's 100/day limit)
 * 
 * Supports two authentication methods:
 * 1. Service Account (preferred): Set GOOGLE_APPLICATION_CREDENTIALS env var
 * 2. OAuth2: Falls back to user OAuth tokens if no service account
 * 
 * @see https://cloud.google.com/text-to-speech/docs
 */

import { google, Auth } from "googleapis";
import { getAuthenticatedClient, isAuthenticated } from "./google-auth";
import * as fs from "fs";
import * as path from "path";

export interface TTSResponse {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  error?: string;
}

const AVAILABLE_VOICES: Record<string, { languageCode: string; name: string; ssmlGender: string }> = {
  "Kore": { languageCode: "en-US", name: "en-US-Neural2-C", ssmlGender: "FEMALE" },
  "Puck": { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
  "Charon": { languageCode: "en-US", name: "en-US-Neural2-A", ssmlGender: "MALE" },
  "Fenrir": { languageCode: "en-US", name: "en-US-Neural2-J", ssmlGender: "MALE" },
  "Aoede": { languageCode: "en-US", name: "en-US-Neural2-E", ssmlGender: "FEMALE" },
  "Leda": { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
  "Orus": { languageCode: "en-US", name: "en-US-Neural2-I", ssmlGender: "MALE" },
  "Zephyr": { languageCode: "en-US", name: "en-US-Neural2-H", ssmlGender: "FEMALE" },
};

let serviceAccountAuth: Auth.GoogleAuth | null = null;

function getServiceAccountAuth(): Auth.GoogleAuth | null {
  if (serviceAccountAuth) return serviceAccountAuth;
  
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) return null;
  
  const resolvedPath = path.resolve(credentialsPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[TTS] Service account file not found: ${resolvedPath}`);
    return null;
  }
  
  try {
    serviceAccountAuth = new google.auth.GoogleAuth({
      keyFile: resolvedPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    console.log('[TTS] Loaded service account credentials');
    return serviceAccountAuth;
  } catch (error) {
    console.error('[TTS] Failed to load service account:', error);
    return null;
  }
}

export function getAvailableVoices(): string[] {
  return Object.keys(AVAILABLE_VOICES);
}

export async function generateSingleSpeakerAudio(
  text: string, 
  voice: string = "Kore",
  maxRetries: number = 2
): Promise<TTSResponse> {
  const serviceAuth = getServiceAccountAuth();
  const hasOAuth = await isAuthenticated();
  
  if (!serviceAuth && !hasOAuth) {
    return {
      success: false,
      error: "Google authentication not available. Please connect your Google account or configure service account credentials."
    };
  }

  const voiceConfig = AVAILABLE_VOICES[voice] || AVAILABLE_VOICES["Kore"];
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[TTS] Retry attempt ${attempt}/${maxRetries}`);
        await new Promise(r => setTimeout(r, 500 * attempt));
      }

      const authMethod = serviceAuth ? "service account" : "OAuth";
      console.log(`[TTS] Generating audio with Google Cloud TTS (${authMethod}), voice: ${voiceConfig.name}`);

      const auth = serviceAuth || await getAuthenticatedClient();
      const tts = google.texttospeech({ version: "v1", auth: auth as any });
      
      const response = await tts.text.synthesize({
        requestBody: {
          input: { text },
          voice: {
            languageCode: voiceConfig.languageCode,
            name: voiceConfig.name,
            ssmlGender: voiceConfig.ssmlGender as any
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0,
            effectsProfileId: ["headphone-class-device"]
          }
        }
      });

      const audioContent = response.data.audioContent;
      
      if (audioContent) {
        console.log("[TTS] Audio generated successfully");
        return {
          success: true,
          audioBase64: typeof audioContent === 'string' ? audioContent : Buffer.from(audioContent).toString('base64'),
          mimeType: "audio/mpeg",
          duration: Math.ceil(text.length / 15)
        };
      }

      return {
        success: false,
        error: "No audio data in response"
      };

    } catch (error: any) {
      lastError = error;
      const errorStr = error.message || String(error);
      
      if (errorStr.includes("403") || errorStr.includes("PERMISSION_DENIED") || 
          errorStr.includes("insufficient") || errorStr.includes("scope")) {
        console.error("[TTS] Permission denied - likely missing cloud-platform scope:", errorStr);
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.name,
          attempt,
          scopeIssue: true
        }, {
          model: "google-cloud-tts-neural2"
        });
        
        return {
          success: false,
          error: "TTS requires Cloud Platform permissions. Please re-authorize your Google account to enable text-to-speech."
        };
      }
      
      const isRetryable = errorStr.includes("500") || 
                         errorStr.includes("INTERNAL") || 
                         errorStr.includes("503") ||
                         errorStr.includes("UNAVAILABLE") ||
                         errorStr.includes("429");
      
      if (!isRetryable || attempt === maxRetries) {
        console.error("[TTS] Generation error:", errorStr);
        
        const { logLLMError } = await import("../services/llm-error-buffer");
        logLLMError("tts", "generateSingleSpeakerAudio", error, {
          textLength: text.length,
          voice: voiceConfig.name,
          attempt
        }, {
          model: "google-cloud-tts-neural2"
        });
        
        return {
          success: false,
          error: `TTS generation failed: ${errorStr}`
        };
      }
      
      console.warn(`[TTS] Transient error, will retry: ${errorStr}`);
    }
  }

  return {
    success: false,
    error: `TTS generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`
  };
}

export async function generateMultiSpeakerAudio(request: { text: string; speakers: Array<{ voice?: string }>; model?: string }): Promise<TTSResponse> {
  const voice = request.speakers[0]?.voice || "Kore";
  return generateSingleSpeakerAudio(request.text, voice);
}
