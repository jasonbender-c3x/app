/**
 * useVoiceRecording Hook
 * 
 * Records audio from microphone and provides base64 encoded data.
 * Used with silence detection for Mode A auto-send.
 */

import { useState, useRef, useCallback } from "react";

export interface VoiceRecordingState {
  isRecording: boolean;
  audioData: string | null; // Base64 encoded audio
  duration: number; // Recording duration in ms
}

export function useVoiceRecording() {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    audioData: null,
    duration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        setState(prev => ({
          ...prev,
          isRecording: false,
          audioData: base64,
          duration: Date.now() - startTimeRef.current,
        }));
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState(prev => ({ ...prev, isRecording: true, audioData: null }));
    } catch (error) {
      console.error("[VoiceRecording] Failed to start:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const clearRecording = useCallback(() => {
    setState(prev => ({ ...prev, audioData: null, duration: 0 }));
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
