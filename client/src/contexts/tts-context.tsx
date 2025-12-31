/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     TTS-CONTEXT.TSX - TEXT-TO-SPEECH CONTEXT                  ║
 * ║                                                                               ║
 * ║  Provides app-wide text-to-speech functionality with:                         ║
 * ║    - Verbosity mode (mute/quiet/verbose/experimental)                         ║
 * ║    - Speak function using Google Gemini TTS                                   ║
 * ║    - Persistent verbosity preference in localStorage                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

/**
 * Verbosity Modes:
 * - mute: Silent - no speech output at all
 * - quiet: Only speak "say" tool output (HD audio)
 * - verbose: Speak full chat responses (browser TTS for text, HD for say tool)
 * - experimental: Multi-voice TTS (future - different voices per speaker)
 */
export type VerbosityMode = "mute" | "quiet" | "verbose" | "experimental";

interface TTSContextValue {
  verbosityMode: VerbosityMode;
  setVerbosityMode: (mode: VerbosityMode) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  isUsingBrowserTTS: boolean;
  shouldPlayHDAudio: () => boolean;
  shouldPlayBrowserTTS: () => boolean;
  unlockAudio: () => Promise<void>;
  isAudioUnlocked: boolean;
  playTestTone: () => Promise<boolean>;
}

const TTSContext = createContext<TTSContextValue | undefined>(undefined);

const TTS_STORAGE_KEY = "nebula-tts-muted";
const VERBOSITY_STORAGE_KEY = "meowstik-verbosity-mode";

export function TTSProvider({ children }: { children: ReactNode }) {
  const [verbosityMode, setVerbosityModeState] = useState<VerbosityMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VERBOSITY_STORAGE_KEY);
      if (saved && ["mute", "quiet", "verbose", "experimental"].includes(saved)) {
        return saved as VerbosityMode;
      }
    }
    return "verbose"; // Default: speak full chat responses
  });
  
  const [isMuted, setIsMutedState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TTS_STORAGE_KEY);
      return saved === "true";
    }
    return false;
  });
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUsingBrowserTTS, setIsUsingBrowserTTS] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const isSupported = true;

  // Unlock audio context (required for browser autoplay policy)
  const unlockAudio = useCallback(async () => {
    if (isAudioUnlocked) return;
    
    try {
      // Create a silent audio context and play it
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
        await ctx.resume();
        console.log("[TTS] Audio context unlocked");
      }
      
      // Also try playing a silent Audio element
      const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      silentAudio.volume = 0.01;
      await silentAudio.play().catch(() => {});
      silentAudio.pause();
      
      setIsAudioUnlocked(true);
      console.log("[TTS] Audio unlocked successfully");
    } catch (err) {
      console.warn("[TTS] Failed to unlock audio:", err);
    }
  }, [isAudioUnlocked]);

  // Play a test tone to verify audio works
  const playTestTone = useCallback(async (): Promise<boolean> => {
    try {
      // First unlock audio
      await unlockAudio();
      
      // Create a simple beep using Web Audio API
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn("[TTS] AudioContext not supported");
        return false;
      }
      
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.stop(ctx.currentTime + 0.3);
      
      console.log("[TTS] Test tone played successfully");
      return true;
    } catch (err) {
      console.error("[TTS] Failed to play test tone:", err);
      return false;
    }
  }, [unlockAudio]);

  useEffect(() => {
    localStorage.setItem(TTS_STORAGE_KEY, String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem(VERBOSITY_STORAGE_KEY, verbosityMode);
  }, [verbosityMode]);

  // On mount: sync mute state with verbosity mode to clear any stale legacy mute flags
  useEffect(() => {
    if (verbosityMode !== "mute" && isMuted) {
      // User previously had mute enabled, but now using a non-mute mode
      // Clear the mute flag so audio can play
      setIsMutedState(false);
    } else if (verbosityMode === "mute" && !isMuted) {
      // Mute mode should always be muted
      setIsMutedState(true);
    }
  }, []); // Only run on mount

  const stopSpeaking = useCallback(() => {
    // Stop audio element playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop browser TTS if active
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsUsingBrowserTTS(false);
  }, []);

  const setVerbosityMode = useCallback((mode: VerbosityMode) => {
    setVerbosityModeState(mode);
    
    // Sync mute state with verbosity mode:
    // - Mute mode = muted (no audio)
    // - All other modes = unmuted (audio allowed based on mode rules)
    if (mode === "mute") {
      setIsMutedState(true);
      // Stop any active speech when switching to mute
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
    } else {
      // Clear the legacy mute flag for non-mute modes
      setIsMutedState(false);
    }
  }, []);

  // Helper: Should HD audio from "say" tool be played?
  // Play in: quiet, verbose, experimental (NOT in mute)
  const shouldPlayHDAudio = useCallback(() => {
    return !isMuted && verbosityMode !== "mute";
  }, [isMuted, verbosityMode]);

  // Helper: Should browser TTS speak the chat response?
  // Only in verbose and experimental modes (NOT in mute or quiet)
  const shouldPlayBrowserTTS = useCallback(() => {
    return !isMuted && (verbosityMode === "verbose" || verbosityMode === "experimental");
  }, [isMuted, verbosityMode]);

  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    if (muted) {
      stopSpeaking();
    }
  }, [stopSpeaking]);

  const toggleMuted = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted, setIsMuted]);

  const speakWithBrowserTTS = useCallback((cleanText: string) => {
    if (!("speechSynthesis" in window)) {
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
      return;
    }
    
    setIsUsingBrowserTTS(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = "en-US";
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsUsingBrowserTTS(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string) => {
    console.log("[TTS Context] speak() called, isMuted:", isMuted, "verbosityMode:", verbosityMode);
    if (isMuted) {
      console.log("[TTS Context] Skipping - muted");
      return;
    }
    
    stopSpeaking();
    
    const cleanText = text
      .replace(/```\w*\n?/g, "")
      .replace(/```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[_~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();
    
    if (!cleanText) {
      console.log("[TTS Context] No text to speak after cleaning");
      return;
    }
    
    console.log("[TTS Context] Speaking:", cleanText.substring(0, 50) + "...");
    speakWithBrowserTTS(cleanText);
  }, [isMuted, verbosityMode, stopSpeaking, speakWithBrowserTTS]);

  return (
    <TTSContext.Provider
      value={{
        verbosityMode,
        setVerbosityMode,
        isMuted,
        setIsMuted,
        toggleMuted,
        speak,
        stopSpeaking,
        isSpeaking,
        isSupported,
        isUsingBrowserTTS,
        shouldPlayHDAudio,
        shouldPlayBrowserTTS,
        unlockAudio,
        isAudioUnlocked,
        playTestTone
      }}
    >
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error("useTTS must be used within a TTSProvider");
  }
  return context;
}
