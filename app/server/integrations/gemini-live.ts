/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GEMINI LIVE API INTEGRATION                            ║
 * ║              Real-time Voice Conversation with Gemini 2.5                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides real-time bidirectional audio streaming with Gemini's
 * native audio model. Features:
 * 
 * - WebSocket-based audio streaming (low latency ~100ms)
 * - Voice Activity Detection (VAD) for natural conversations
 * - Barge-in support (user can interrupt AI mid-speech)
 * - Multi-speaker support via persona switching
 * - Transcript streaming alongside audio
 * 
 * Model: gemini-2.5-flash-native-audio-preview-12-2025
 * Audio Format: 16-bit PCM, 16kHz input / 24kHz output
 */

import { GoogleGenAI, Modality } from "@google/genai";

export interface LiveSessionConfig {
  systemInstruction?: string;
  voiceName?: string;
  language?: string;
}

export interface LiveSession {
  id: string;
  session: any;
  isActive: boolean;
  createdAt: Date;
}

const activeSessions = new Map<string, LiveSession>();

const DEFAULT_SYSTEM_INSTRUCTION = `You are Meowstik, a helpful and friendly AI assistant. 
You are having a real-time voice conversation. Be concise and natural in your responses.
Respond conversationally as if speaking to a friend. Avoid long lists or overly formal language.`;

const DEFAULT_VOICE = "Kore";

/**
 * Create a new Gemini Live session
 */
export async function createLiveSession(
  sessionId: string,
  config: LiveSessionConfig = {}
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured"
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const sessionConfig = {
      responseModalities: [Modality.AUDIO, Modality.TEXT],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: config.voiceName || DEFAULT_VOICE
          }
        }
      },
      systemInstruction: config.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION
    };

    const session = await (ai as any).live.connect({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      config: sessionConfig
    });

    activeSessions.set(sessionId, {
      id: sessionId,
      session,
      isActive: true,
      createdAt: new Date()
    });

    console.log(`[Gemini Live] Created session: ${sessionId}`);
    
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to create session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create live session"
    };
  }
}

/**
 * Send audio data to the live session
 */
export async function sendAudio(
  sessionId: string,
  audioData: Buffer | string,
  mimeType: string = "audio/pcm"
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    const data = typeof audioData === "string" ? audioData : audioData.toString("base64");
    
    await liveSession.session.send({
      data,
      mimeType
    });

    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to send audio:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send audio"
    };
  }
}

/**
 * Send text message to the live session
 */
export async function sendText(
  sessionId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    await liveSession.session.send({ text });
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to send text:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send text"
    };
  }
}

/**
 * Generator function to receive responses from the live session
 */
export async function* receiveResponses(
  sessionId: string
): AsyncGenerator<{
  type: "audio" | "text" | "transcript" | "end";
  data?: string;
  text?: string;
}> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    yield { type: "end" };
    return;
  }

  try {
    for await (const response of liveSession.session) {
      if (response.data) {
        yield { type: "audio", data: response.data };
      }
      if (response.text) {
        yield { type: "text", text: response.text };
      }
      if (response.serverContent?.modelTurn?.parts) {
        for (const part of response.serverContent.modelTurn.parts) {
          if (part.inlineData) {
            yield { type: "audio", data: part.inlineData.data };
          }
          if (part.text) {
            yield { type: "transcript", text: part.text };
          }
        }
      }
    }
  } catch (error) {
    console.error("[Gemini Live] Error receiving responses:", error);
  }
  
  yield { type: "end" };
}

/**
 * Interrupt the current response (barge-in)
 */
export async function interrupt(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    if (liveSession.session.interrupt) {
      await liveSession.session.interrupt();
    }
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to interrupt:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to interrupt"
    };
  }
}

/**
 * Update the session's system instruction (for persona switching)
 */
export async function updateSystemInstruction(
  sessionId: string,
  systemInstruction: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession || !liveSession.isActive) {
    return { success: false, error: "Session not found or inactive" };
  }

  try {
    await liveSession.session.send({
      system_instruction: systemInstruction
    });
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to update system instruction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update system instruction"
    };
  }
}

/**
 * Close a live session
 */
export async function closeLiveSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const liveSession = activeSessions.get(sessionId);
  
  if (!liveSession) {
    return { success: false, error: "Session not found" };
  }

  try {
    if (liveSession.session.close) {
      await liveSession.session.close();
    }
    liveSession.isActive = false;
    activeSessions.delete(sessionId);
    
    console.log(`[Gemini Live] Closed session: ${sessionId}`);
    
    return { success: true };
  } catch (error) {
    console.error("[Gemini Live] Failed to close session:", error);
    activeSessions.delete(sessionId);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to close session"
    };
  }
}

/**
 * Get session info
 */
export function getSessionInfo(sessionId: string): LiveSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Get all active session IDs
 */
export function getActiveSessions(): string[] {
  return Array.from(activeSessions.keys());
}

/**
 * Available voices for Gemini TTS
 */
export const AVAILABLE_VOICES = [
  { value: "Kore", label: "Kore - Clear Female", gender: "female" },
  { value: "Puck", label: "Puck - Warm Male", gender: "male" },
  { value: "Charon", label: "Charon - Deep Male", gender: "male" },
  { value: "Fenrir", label: "Fenrir - Strong Male", gender: "male" },
  { value: "Aoede", label: "Aoede - Melodic Female", gender: "female" },
  { value: "Leda", label: "Leda - Soft Female", gender: "female" },
  { value: "Orus", label: "Orus - Authoritative Male", gender: "male" },
  { value: "Zephyr", label: "Zephyr - Gentle Neutral", gender: "neutral" },
] as const;
