/**
 * =============================================================================
 * GEMINI 2.5 TEXT-TO-SPEECH INTEGRATION
 * =============================================================================
 * 
 * Single-speaker TTS using Gemini 2.5 Flash TTS model.
 * 
 * @see https://ai.google.dev/gemini-api/docs/speech-generation
 */

import { GoogleGenAI } from "@google/genai";
import ffmpeg from "fluent-ffmpeg";
import { Readable, PassThrough } from "stream";

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
      .outputOptions(["-timeout", "120"])
      .on("end", () => {
        finish();
      })
      .on("error", (err: Error) => {
        console.error("[TTS] FFmpeg conversion error:", err.message);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    
    command.pipe(outputStream, { end: false });
  });
}

export async function generateSingleSpeakerAudio(
  text: string, 
  voice: string = "Kore"
): Promise<TTSResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured"
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const modelName = "gemini-2.5-flash-preview-tts";

    console.log(`[TTS] Generating audio with ${modelName}, voice: ${voice}`);

    const response = await client.models.generateContent({
      model: modelName,
      contents: [{
        role: "user",
        parts: [{ text }]
      }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    } as any);

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    if (part && 'inlineData' in part && part.inlineData?.data) {
      console.log("[TTS] Audio generated, converting to MP3...");
      
      try {
        const mp3Base64 = await convertPcmToMp3(part.inlineData.data);
        return {
          success: true,
          audioBase64: mp3Base64,
          mimeType: "audio/mpeg",
          duration: 30
        };
      } catch (conversionError) {
        console.warn("[TTS] MP3 conversion failed, returning raw audio");
        return {
          success: true,
          audioBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "audio/wav",
          duration: 30
        };
      }
    }

    return {
      success: false,
      error: "No audio data in response"
    };

  } catch (error: any) {
    console.error("[TTS] Generation error:", error.message);
    
    const { logLLMError } = await import("../services/llm-error-buffer");
    logLLMError("tts", "generateSingleSpeakerAudio", error, {
      textLength: text.length,
      voice
    }, {
      model: "gemini-2.5-flash-preview-tts"
    });
    
    return {
      success: false,
      error: `TTS generation failed: ${error.message}`
    };
  }
}

// Legacy export for compatibility
export async function generateMultiSpeakerAudio(request: { text: string; speakers: Array<{ voice?: string }>; model?: string }): Promise<TTSResponse> {
  const voice = request.speakers[0]?.voice || "Kore";
  return generateSingleSpeakerAudio(request.text, voice);
}
