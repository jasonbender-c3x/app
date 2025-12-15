/**
 * =============================================================================
 * GEMINI 2.5 EXPRESSIVE TEXT-TO-SPEECH INTEGRATION
 * =============================================================================
 * 
 * Multi-speaker expressive TTS using Gemini 2.5 Flash/Pro TTS models.
 * Supports up to 2 speakers with full control over tone, emotion, and style.
 * 
 * @see https://ai.google.dev/gemini-api/docs/speech-generation
 */

import { GoogleGenAI } from "@google/genai";
import ffmpeg from "fluent-ffmpeg";
import { Readable, PassThrough } from "stream";
import { promisify } from "util";

export interface Speaker {
  name: string;
  voice: string;
  style?: string;
}

export interface TTSRequest {
  text: string;
  speakers: Speaker[];
  model?: "flash" | "pro";
}

export interface TTSResponse {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  duration?: number;
  error?: string;
}

const AVAILABLE_VOICES = [
  "Kore", "Puck", "Charon", "Fenrir", "Aoede", 
  "Leda", "Orus", "Zephyr"
];

export function getAvailableVoices(): string[] {
  return AVAILABLE_VOICES;
}

async function convertPcmToMp3(pcmBase64: string, sampleRate: number = 24000): Promise<string> {
  return new Promise((resolve, reject) => {
    const pcmBuffer = Buffer.from(pcmBase64, "base64");
    const inputStream = new Readable();
    inputStream.push(pcmBuffer);
    inputStream.push(null);

    const chunks: Buffer[] = [];
    const outputStream = new PassThrough();
    let resolved = false;
    
    const finish = () => {
      if (!resolved) {
        resolved = true;
        const mp3Buffer = Buffer.concat(chunks);
        if (mp3Buffer.length > 0) {
          resolve(mp3Buffer.toString("base64"));
        } else {
          reject(new Error("FFmpeg produced no output"));
        }
      }
    };
    
    outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    outputStream.on("end", finish);
    outputStream.on("close", finish);
    outputStream.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    const command = ffmpeg(inputStream)
      .inputFormat("s16le")
      .inputOptions([`-ar ${sampleRate}`, "-ac 1"])
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .on("end", () => {
        console.log("[TTS] FFmpeg conversion complete");
        finish();
      })
      .on("error", (err: Error) => {
        console.error("[TTS] FFmpeg conversion error:", err);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    
    command.pipe(outputStream, { end: true });
  });
}

export async function generateMultiSpeakerAudio(request: TTSRequest): Promise<TTSResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured"
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    
    const modelName = request.model === "pro" 
      ? "gemini-2.5-pro-preview-tts" 
      : "gemini-2.5-flash-preview-tts";

    console.log(`[TTS] Generating audio with ${modelName} for ${request.speakers.length} speaker(s)`);

    let speechConfig: any;
    
    if (request.speakers.length > 1) {
      speechConfig = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: request.speakers.map(speaker => ({
            speaker: speaker.name,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: speaker.voice || "Kore"
              }
            }
          }))
        }
      };
    } else {
      speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: request.speakers[0]?.voice || "Kore"
          }
        }
      };
    }

    const response = await client.models.generateContent({
      model: modelName,
      contents: [{
        role: "user",
        parts: [{ text: request.text }]
      }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig
      }
    } as any);

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    if (part && 'inlineData' in part && part.inlineData?.data) {
      console.log("[TTS] Audio generated successfully, converting to MP3...");
      
      try {
        const mp3Base64 = await convertPcmToMp3(part.inlineData.data);
        console.log("[TTS] MP3 conversion complete");
        return {
          success: true,
          audioBase64: mp3Base64,
          mimeType: "audio/mpeg",
          duration: 30
        };
      } catch (conversionError) {
        console.warn("[TTS] MP3 conversion failed, returning original format:", conversionError);
        return {
          success: true,
          audioBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "audio/wav",
          duration: 30
        };
      }
    }

    const textContent = response.text;
    if (textContent) {
      console.log("[TTS] Model returned text instead of audio - TTS model may not be available");
      return {
        success: false,
        error: "The TTS model returned text instead of audio. The Gemini 2.5 TTS preview may require specific API access. Please check: https://ai.google.dev/gemini-api/docs/speech-generation"
      };
    }

    return {
      success: false,
      error: "No audio data in response. The TTS model may not be available for your API key."
    };

  } catch (error: any) {
    console.error("[TTS] Generation error:", error);
    
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes("not found") || errorMessage.includes("404")) {
      return {
        success: false,
        error: "TTS model not available. The Gemini 2.5 TTS preview models (gemini-2.5-flash-preview-tts) may require additional API access. Visit: https://ai.google.dev/gemini-api/docs/speech-generation"
      };
    }
    
    if (errorMessage.includes("INVALID_ARGUMENT") || errorMessage.includes("400")) {
      return {
        success: false,
        error: `Invalid request to TTS API: ${errorMessage}. Ensure speaker names match dialogue format (e.g., "Speaker1: text").`
      };
    }
    
    return {
      success: false,
      error: `TTS generation failed: ${errorMessage}`
    };
  }
}

export async function generateSingleSpeakerAudio(
  text: string, 
  voice: string = "Kore",
  style?: string
): Promise<TTSResponse> {
  const styledText = style ? `${style}: ${text}` : text;
  
  return generateMultiSpeakerAudio({
    text: styledText,
    speakers: [{ name: "Speaker", voice }],
    model: "flash"
  });
}
