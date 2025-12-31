/**
 * useSilenceDetection Hook
 * 
 * Detects silence in audio input for auto-send functionality in Mode A.
 * - Monitors audio levels from MediaStream
 * - Triggers callback after configurable silence duration
 * - Provides visual feedback for audio levels
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface SilenceDetectionOptions {
  silenceThreshold?: number; // Audio level below this is considered silence (0-1)
  silenceDuration?: number; // Ms of silence before triggering callback
  sampleInterval?: number; // How often to sample audio (ms)
  enabled?: boolean;
}

export interface SilenceDetectionState {
  isListening: boolean;
  isSpeaking: boolean;
  silenceProgress: number; // 0-1, how close to triggering
  audioLevel: number; // Current audio level 0-1
}

export function useSilenceDetection(
  onSilenceDetected: () => void,
  options: SilenceDetectionOptions = {}
) {
  const {
    silenceThreshold = 0.02,
    silenceDuration = 2000,
    sampleInterval = 100,
    enabled = true,
  } = options;

  const [state, setState] = useState<SilenceDetectionState>({
    isListening: false,
    isSpeaking: false,
    silenceProgress: 0,
    audioLevel: 0,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const callbackTriggeredRef = useRef(false);

  const startListening = useCallback(async () => {
    if (streamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      callbackTriggeredRef.current = false;
      silenceStartRef.current = null;

      setState(prev => ({ ...prev, isListening: true }));

      const checkAudioLevel = () => {
        if (!analyzerRef.current || !enabled) {
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
          return;
        }

        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
        analyzerRef.current.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const normalizedLevel = average / 255;

        const isSpeaking = normalizedLevel > silenceThreshold;
        const now = Date.now();

        if (isSpeaking) {
          // Reset silence timer when speaking
          silenceStartRef.current = null;
          callbackTriggeredRef.current = false;
          setState(prev => ({
            ...prev,
            isSpeaking: true,
            silenceProgress: 0,
            audioLevel: normalizedLevel,
          }));
        } else {
          // Track silence duration
          if (!silenceStartRef.current) {
            silenceStartRef.current = now;
          }

          const silenceTime = now - silenceStartRef.current;
          const progress = Math.min(silenceTime / silenceDuration, 1);

          setState(prev => ({
            ...prev,
            isSpeaking: false,
            silenceProgress: progress,
            audioLevel: normalizedLevel,
          }));

          // Trigger callback when silence duration reached
          if (silenceTime >= silenceDuration && !callbackTriggeredRef.current) {
            callbackTriggeredRef.current = true;
            onSilenceDetected();
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      console.error("[SilenceDetection] Failed to start:", error);
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, [enabled, silenceThreshold, silenceDuration, onSilenceDetected]);

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyzerRef.current = null;
    silenceStartRef.current = null;
    callbackTriggeredRef.current = false;

    setState({
      isListening: false,
      isSpeaking: false,
      silenceProgress: 0,
      audioLevel: 0,
    });
  }, []);

  const resetSilenceTimer = useCallback(() => {
    silenceStartRef.current = null;
    callbackTriggeredRef.current = false;
    setState(prev => ({ ...prev, silenceProgress: 0 }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    resetSilenceTimer,
  };
}
