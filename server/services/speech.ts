/**
 * =============================================================================
 * NEBULA CHAT - SPEECH SERVICE
 * =============================================================================
 * 
 * Provides speech-to-text transcription using multiple backends:
 * 1. Primary: Google Gemini audio transcription (backend)
 * 2. Fallback: Browser Web Speech API (frontend, handled by client)
 * 
 * The service accepts audio data (base64 encoded) and returns transcribed text.
 * It uses the Gemini model's audio understanding capabilities for transcription.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                              CLIENT                                      │
 * │  ┌───────────────────┐    ┌────────────────────────────────────────────┐│
 * │  │ Record Audio      │───►│ Web Speech API (Primary - Real-time)       ││
 * │  └───────────────────┘    └────────────────────────────────────────────┘│
 * │          │                                                               │
 * │          ▼ (if Web Speech fails or for file upload)                     │
 * │  ┌───────────────────────────────────────────────────────────────────┐  │
 * │  │ Send audio blob to backend                                        │  │
 * │  └───────────────────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                              SERVER                                      │
 * │  ┌───────────────────────────────────────────────────────────────────┐  │
 * │  │ Speech Service: Gemini Audio Transcription                        │  │
 * │  │ - Accepts: base64 audio, mimeType                                 │  │
 * │  │ - Returns: transcribed text                                       │  │
 * │  └───────────────────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────────┘
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";

const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit for audio uploads

/**
 * Speech transcription request parameters
 */
export interface TranscriptionRequest {
  audioBase64: string;
  mimeType: string;
  language?: string;
}

/**
 * Speech transcription response
 */
export interface TranscriptionResponse {
  transcript: string;
  confidence?: number;
  source: "gemini" | "fallback";
  error?: string;
}

/**
 * Service availability status
 */
export interface ServiceStatus {
  available: boolean;
  reason?: string;
}

/**
 * SpeechService
 * 
 * Handles audio-to-text transcription using Gemini's multimodal capabilities.
 * Falls back gracefully if transcription fails.
 */
export class SpeechService {
  private genAI: GoogleGenAI | null = null;
  private isAvailable: boolean = false;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.isAvailable = true;
    } else {
      console.warn("[SpeechService] GEMINI_API_KEY not found - transcription will rely on frontend");
    }
  }

  /**
   * Check if the backend transcription service is available
   */
  getServiceStatus(): ServiceStatus {
    return {
      available: this.isAvailable,
      reason: this.isAvailable ? undefined : "GEMINI_API_KEY not configured"
    };
  }

  /**
   * Validate audio data before processing
   */
  private validateAudioData(audioBase64: string, mimeType: string): string | null {
    const audioSize = Buffer.from(audioBase64, "base64").length;
    
    if (audioSize > MAX_AUDIO_SIZE_BYTES) {
      return `Audio file too large: ${(audioSize / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB limit`;
    }

    const supportedMimeTypes = ["audio/webm", "audio/mp3", "audio/wav", "audio/ogg", "audio/mpeg"];
    if (!supportedMimeTypes.some(t => mimeType.startsWith(t.split("/")[0]))) {
      return `Unsupported audio format: ${mimeType}`;
    }

    return null;
  }

  /**
   * Transcribe audio using Gemini's audio understanding
   * 
   * @param request - Audio data and metadata
   * @returns Transcription result
   */
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    if (!this.isAvailable || !this.genAI) {
      return {
        transcript: "",
        source: "fallback",
        error: "Backend transcription not available - use browser Web Speech API"
      };
    }

    const validationError = this.validateAudioData(request.audioBase64, request.mimeType);
    if (validationError) {
      return {
        transcript: "",
        source: "fallback",
        error: validationError
      };
    }

    try {
      const prompt = request.language 
        ? `Transcribe this audio exactly as spoken. The language is ${request.language}. Output only the transcribed text, nothing else.`
        : `Transcribe this audio exactly as spoken. Output only the transcribed text, nothing else.`;

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: request.mimeType,
                data: request.audioBase64
              }
            }
          ]
        }]
      });

      const text = response.text || "";
      
      return {
        transcript: text.trim(),
        source: "gemini",
        confidence: 0.95
      };
    } catch (error: any) {
      console.error("[SpeechService] Transcription error:", error.message);
      return {
        transcript: "",
        source: "fallback",
        error: error.message || "Transcription failed"
      };
    }
  }

  /**
   * Transcribe audio from a URL or file path
   * Useful for transcribing attached audio files
   */
  async transcribeFromUrl(url: string, mimeType: string): Promise<TranscriptionResponse> {
    if (!this.isAvailable || !this.genAI) {
      return {
        transcript: "",
        source: "fallback",
        error: "Backend transcription not available"
      };
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return this.transcribe({
        audioBase64: base64,
        mimeType: mimeType
      });
    } catch (error: any) {
      return {
        transcript: "",
        source: "fallback",
        error: error.message || "Failed to fetch audio"
      };
    }
  }
}

export const speechService = new SpeechService();
