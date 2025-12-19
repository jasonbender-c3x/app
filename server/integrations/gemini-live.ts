/**
 * =============================================================================
 * GEMINI LIVE API INTEGRATION
 * =============================================================================
 * 
 * Real-time streaming audio using Gemini Live API via WebSockets.
 * Provides low-latency voice responses with audio streaming as it's generated.
 * 
 * @see https://ai.google.dev/gemini-api/docs/live
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { EventEmitter } from "events";

export interface LiveSessionConfig {
  voice?: string;
  systemInstruction?: string;
}

export interface LiveSession {
  id: string;
  session: any;
  isConnected: boolean;
  emitter: EventEmitter;
}

const AVAILABLE_VOICES = [
  "Kore", "Puck", "Charon", "Fenrir", "Aoede", 
  "Leda", "Orus", "Zephyr"
];

export function getAvailableVoices(): string[] {
  return AVAILABLE_VOICES;
}

/**
 * Create a new Live API session for real-time audio streaming
 */
export async function createLiveSession(
  sessionId: string,
  config: LiveSessionConfig = {}
): Promise<LiveSession> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const emitter = new EventEmitter();
  
  console.log(`[Live API] Creating session ${sessionId} with voice: ${config.voice || "Kore"}`);
  
  try {
    const session = await ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: config.voice || "Kore" 
            }
          }
        },
        systemInstruction: config.systemInstruction || 
          "You are Meowstic, a helpful AI assistant. Respond naturally and conversationally.",
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false
          }
        }
      },
      callbacks: {
        onopen: () => {
          console.log(`[Live API] Session ${sessionId} connected`);
          emitter.emit("connected");
        },
        onmessage: (message: any) => {
          try {
            console.log("[Live API] Raw message received:", JSON.stringify(message).substring(0, 500));
            const serverContent = message.serverContent;
            if (serverContent?.modelTurn?.parts) {
              for (const part of serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const audioBuffer = Buffer.from(part.inlineData.data, "base64");
                  console.log(`[Live API] Received audio chunk: ${audioBuffer.length} bytes`);
                  emitter.emit("audio", audioBuffer);
                }
              }
            }
            if (serverContent?.turnComplete) {
              console.log(`[Live API] Turn complete for session ${sessionId}`);
              emitter.emit("turnComplete");
            }
          } catch (err) {
            console.error(`[Live API] Error processing message:`, err);
          }
        },
        onerror: (error: any) => {
          console.error(`[Live API] Session error:`, error);
          emitter.emit("error", error);
        },
        onclose: (event: any) => {
          console.log(`[Live API] Session ${sessionId} CLOSED!`);
          console.log(`[Live API] Close event details:`, JSON.stringify(event, null, 2));
          if (event) {
            console.log(`[Live API] Close code: ${event.code}, reason: ${event.reason}`);
          }
          emitter.emit("close", event);
        }
      }
    });
    
    console.log(`[Live API] Session ${sessionId} created successfully`);
    
    return {
      id: sessionId,
      session,
      isConnected: true,
      emitter
    };
  } catch (error: any) {
    console.error(`[Live API] Failed to create session:`, error);
    throw new Error(`Failed to connect to Live API: ${error.message}`);
  }
}

/**
 * Send a text message and receive audio responses via emitter
 * Audio chunks will be emitted via liveSession.emitter.on('audio', callback)
 */
export async function sendTextMessage(
  liveSession: LiveSession,
  text: string
): Promise<void> {
  if (!liveSession.isConnected || !liveSession.session) {
    throw new Error("Session is not connected");
  }

  console.log(`[Live API] Sending message to session ${liveSession.id}: "${text.substring(0, 50)}..."`);
  
  try {
    // Use proper content format for the Gemini Live API
    // turns must be an array of content objects with role and parts
    await liveSession.session.sendClientContent({
      turns: [
        {
          role: "user",
          parts: [{ text: text }]
        }
      ],
      turnComplete: true
    });
    console.log(`[Live API] Message sent successfully`);
  } catch (error: any) {
    console.error(`[Live API] Error sending message:`, error);
    throw error;
  }
}

/**
 * Close a Live API session
 */
export async function closeLiveSession(liveSession: LiveSession): Promise<void> {
  if (liveSession.session) {
    try {
      await liveSession.session.close();
      liveSession.isConnected = false;
      liveSession.emitter.removeAllListeners();
      console.log(`[Live API] Session ${liveSession.id} closed`);
    } catch (error: any) {
      console.error(`[Live API] Error closing session:`, error);
    }
  }
}

/**
 * Send activity start signal (user started speaking)
 */
export async function sendActivityStart(liveSession: LiveSession): Promise<void> {
  if (!liveSession.isConnected) {
    throw new Error("Session is not connected");
  }
  
  try {
    console.log("[Live API] Sending activityStart signal");
    await liveSession.session.sendRealtimeInput({ activityStart: {} });
  } catch (error: any) {
    console.error("[Live API] Error sending activityStart:", error.message);
    throw error;
  }
}

/**
 * Send activity end signal (user stopped speaking)
 */
export async function sendActivityEnd(liveSession: LiveSession): Promise<void> {
  if (!liveSession.isConnected) {
    throw new Error("Session is not connected");
  }
  
  try {
    console.log("[Live API] Sending activityEnd signal");
    await liveSession.session.sendRealtimeInput({ activityEnd: {} });
  } catch (error: any) {
    console.error("[Live API] Error sending activityEnd:", error.message);
    throw error;
  }
}

/**
 * Send audio input to the Live API session
 */
export async function sendAudioInput(
  liveSession: LiveSession,
  audioData: Buffer
): Promise<void> {
  if (!liveSession.isConnected) {
    console.error("[Live API] Cannot send audio - session not connected");
    throw new Error("Session is not connected");
  }

  const base64Audio = audioData.toString("base64");
  
  try {
    await liveSession.session.sendRealtimeInput({
      mediaChunks: [{
        mimeType: "audio/pcm;rate=16000",
        data: base64Audio
      }]
    });
  } catch (error: any) {
    console.error("[Live API] Error sending audio input:", error.message);
    throw error;
  }
}
