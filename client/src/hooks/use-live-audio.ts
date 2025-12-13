/**
 * =============================================================================
 * USE LIVE AUDIO HOOK
 * =============================================================================
 * 
 * React hook for real-time audio streaming via Gemini Live API.
 * Connects to the WebSocket server and plays audio chunks as they arrive.
 * 
 * Features:
 * - WebSocket connection management with auto-reconnect
 * - Web Audio API for 24kHz PCM audio playback
 * - Audio queue for smooth, gap-free playback
 * - Configurable voice selection
 */

import { useRef, useState, useCallback, useEffect } from "react";

export interface UseLiveAudioOptions {
  voice?: string;
  systemInstruction?: string;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
}

export interface UseLiveAudioReturn {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  isConnected: boolean;
  isPlaying: boolean;
  error: string | null;
}

const SAMPLE_RATE = 24000;

export function useLiveAudio(options: UseLiveAudioOptions = {}): UseLiveAudioReturn {
  const {
    voice = "Kore",
    systemInstruction,
    onError,
    onConnected,
    onDisconnected,
    onAudioStart,
    onAudioEnd,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playNextBuffer = useCallback(() => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      if (isPlayingRef.current) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        onAudioEnd?.();
      }
      return;
    }

    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);
    
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
    
    source.onended = () => {
      playNextBuffer();
    };
  }, [onAudioEnd]);

  const queueAudioData = useCallback(async (pcmData: ArrayBuffer) => {
    if (!audioContextRef.current) {
      console.error("[Live Audio] No AudioContext available");
      return;
    }

    console.log("[Live Audio] Received audio chunk:", pcmData.byteLength, "bytes");

    try {
      const int16Array = new Int16Array(pcmData);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Array);

      audioQueueRef.current.push(audioBuffer);

      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        onAudioStart?.();
        nextPlayTimeRef.current = audioContextRef.current.currentTime;
        playNextBuffer();
      }
    } catch (err) {
      console.error("[Live Audio] Error processing audio:", err);
    }
  }, [onAudioStart, playNextBuffer]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/live`;
    
    console.log("[Live Audio] Connecting to", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    
    // Resume AudioContext to handle browser autoplay policy
    // Most browsers require user interaction before audio can play
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().then(() => {
        console.log("[Live Audio] AudioContext resumed successfully");
      }).catch((err) => {
        console.error("[Live Audio] Failed to resume AudioContext:", err);
      });
    }

    ws.onopen = () => {
      console.log("[Live Audio] WebSocket connected, sending connect message");
      ws.send(JSON.stringify({ 
        type: "connect", 
        voice,
        systemInstruction 
      }));
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        queueAudioData(arrayBuffer);
      } else if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case "connected":
              console.log("[Live Audio] Session connected:", message.sessionId);
              setIsConnected(true);
              setError(null);
              onConnected?.();
              break;
              
            case "end":
              console.log("[Live Audio] Audio stream ended");
              break;
              
            case "error":
              console.error("[Live Audio] Error:", message.message);
              setError(message.message);
              onError?.(message.message);
              break;
          }
        } catch (e) {
          console.error("[Live Audio] Failed to parse message:", e);
        }
      }
    };

    ws.onerror = (event) => {
      console.error("[Live Audio] WebSocket error:", event);
      setError("Connection error");
      onError?.("Connection error");
    };

    ws.onclose = () => {
      console.log("[Live Audio] WebSocket closed");
      setIsConnected(false);
      onDisconnected?.();
      wsRef.current = null;
    };
  }, [voice, systemInstruction, onConnected, onDisconnected, onError, queueAudioData]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioQueueRef.current = [];
    setIsConnected(false);
    setIsPlaying(false);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[Live Audio] Cannot send message: not connected");
      return;
    }
    
    console.log("[Live Audio] Sending message:", text.substring(0, 50));
    wsRef.current.send(JSON.stringify({ type: "message", text }));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    isPlaying,
    error,
  };
}
