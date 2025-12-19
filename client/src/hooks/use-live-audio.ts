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
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isConnected: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  error: string | null;
}

const SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000; // Gemini input requirement

/**
 * Downsample Float32 audio buffer to Int16 PCM at target sample rate
 */
function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Int16Array {
  if (inputRate === outputRate) {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return result;
  }
  
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Int16Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const index = Math.round(i * ratio);
    const s = Math.max(-1, Math.min(1, buffer[index]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  
  return result;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

  // Playback Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Recording Input Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Auto-reconnect refs
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 2000;
  
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear audio queue and stop current playback (barge-in)
  const clearAudioQueue = useCallback(() => {
    console.log("[Live Audio] Clearing audio queue (barge-in)");
    audioQueueRef.current = [];
    
    // Stop currently playing source
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      activeSourceRef.current = null;
    }
    
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      onAudioEnd?.();
    }
    
    nextPlayTimeRef.current = 0;
  }, [onAudioEnd]);

  const playNextBuffer = useCallback(() => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      if (isPlayingRef.current) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        onAudioEnd?.();
      }
      activeSourceRef.current = null;
      return;
    }

    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    activeSourceRef.current = source;
    
    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);
    
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
    
    source.onended = () => {
      activeSourceRef.current = null;
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

    // Enable auto-reconnect when connecting
    shouldReconnectRef.current = true;
    
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
      // Reset reconnect counter on successful connection
      reconnectAttemptsRef.current = 0;
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
              
            case "session_closed":
              console.warn("[Live Audio] Gemini session closed:", message.message);
              setIsConnected(false);
              setError("Voice session ended. Please reconnect.");
              onError?.("Voice session ended. Please reconnect.");
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
      
      // Auto-reconnect logic
      if (shouldReconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff
        console.log(`[Live Audio] Attempting reconnect ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnectRef.current) {
            connect();
          }
        }, delay);
      } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error("[Live Audio] Max reconnect attempts reached");
        setError("Connection lost. Please reconnect manually.");
        onError?.("Connection lost. Please reconnect manually.");
      }
    };
  }, [voice, systemInstruction, onConnected, onDisconnected, onError, queueAudioData]);

  // ---------------------------------------------------------------------------
  // RECORDING LOGIC
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[Live Audio] Cannot record: not connected");
      setError("Not connected to live API");
      return;
    }

    // Barge-in: clear any playing audio when user starts speaking
    clearAudioQueue();

    try {
      console.log("[Live Audio] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      mediaStreamRef.current = stream;
      inputContextRef.current = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      
      sourceRef.current = inputContextRef.current.createMediaStreamSource(stream);
      
      // ScriptProcessorNode is deprecated but still widely supported
      // AudioWorklet would be more modern but requires more setup
      const bufferSize = 4096;
      processorRef.current = inputContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = downsampleBuffer(inputData, inputContextRef.current!.sampleRate, INPUT_SAMPLE_RATE);
        const base64Audio = arrayBufferToBase64(pcmData.buffer);
        
        wsRef.current.send(JSON.stringify({ 
          type: "audio", 
          data: base64Audio 
        }));
      };
      
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(inputContextRef.current.destination);
      
      setIsRecording(true);
      console.log("[Live Audio] Recording started");
    } catch (err) {
      console.error("[Live Audio] Failed to start recording:", err);
      setError("Failed to access microphone");
      onError?.("Failed to access microphone");
    }
  }, [onError, clearAudioQueue]);

  const stopRecording = useCallback(() => {
    console.log("[Live Audio] Stopping recording...");
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    
    setIsRecording(false);
    console.log("[Live Audio] Recording stopped");
  }, []);

  const disconnect = useCallback(() => {
    // Disable auto-reconnect on intentional disconnect
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    
    stopRecording();
    
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
  }, [stopRecording]);

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
      // Clear reconnect timeout on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    startRecording,
    stopRecording,
    isConnected,
    isPlaying,
    isRecording,
    error,
  };
}
