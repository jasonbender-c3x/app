/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     TTS-CONTEXT.TSX - TEXT-TO-SPEECH CONTEXT                  ║
 * ║                                                                               ║
 * ║  Provides app-wide text-to-speech functionality with:                         ║
 * ║    - Verbosity mode (muse/quiet/verbose/experimental)                         ║
 * ║    - Speak function using Google Gemini TTS                                   ║
 * ║    - Persistent verbosity preference in localStorage                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

/**
 * Verbosity Modes:
 * - muse: Silent - no speech output at all
 * - quiet: Only speak "say" tool output (HD audio)
 * - verbose: Speak full chat responses (browser TTS for text, HD for say tool)
 * - experimental: Multi-voice TTS (future - different voices per speaker)
 */
export type VerbosityMode = "muse" | "quiet" | "verbose" | "experimental";

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
}

const TTSContext = createContext<TTSContextValue | undefined>(undefined);

const TTS_STORAGE_KEY = "nebula-tts-muted";
const VERBOSITY_STORAGE_KEY = "meowstik-verbosity-mode";

export function TTSProvider({ children }: { children: ReactNode }) {
  const [verbosityMode, setVerbosityModeState] = useState<VerbosityMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VERBOSITY_STORAGE_KEY);
      if (saved && ["muse", "quiet", "verbose", "experimental"].includes(saved)) {
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const isSupported = true;

  useEffect(() => {
    localStorage.setItem(TTS_STORAGE_KEY, String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem(VERBOSITY_STORAGE_KEY, verbosityMode);
  }, [verbosityMode]);

  // On mount: sync mute state with verbosity mode to clear any stale legacy mute flags
  useEffect(() => {
    if (verbosityMode !== "muse" && isMuted) {
      // User previously had mute enabled, but now using a non-muse mode
      // Clear the mute flag so audio can play
      setIsMutedState(false);
    } else if (verbosityMode === "muse" && !isMuted) {
      // Muse mode should always be muted
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
    // - Muse mode = muted (no audio)
    // - All other modes = unmuted (audio allowed based on mode rules)
    if (mode === "muse") {
      setIsMutedState(true);
      // Stop any active speech when switching to muse
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
      // Clear the legacy mute flag for non-muse modes
      setIsMutedState(false);
    }
  }, []);

  // Helper: Should HD audio from "say" tool be played?
  // Play in: quiet, verbose, experimental (NOT in muse)
  const shouldPlayHDAudio = useCallback(() => {
    return !isMuted && verbosityMode !== "muse";
  }, [isMuted, verbosityMode]);

  // Helper: Should browser TTS speak the chat response?
  // Only in verbose and experimental modes (NOT in muse or quiet)
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
    if (isMuted) return;
    
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
      console.log("[TTS] No text to speak after cleaning");
      return;
    }
    
    console.log("[TTS] Speaking:", cleanText.substring(0, 50) + "...");
    speakWithBrowserTTS(cleanText);
  }, [isMuted, stopSpeaking, speakWithBrowserTTS]);

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
        shouldPlayBrowserTTS
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
