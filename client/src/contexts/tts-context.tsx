/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     TTS-CONTEXT.TSX - TEXT-TO-SPEECH CONTEXT                  ║
 * ║                                                                               ║
 * ║  Provides app-wide text-to-speech functionality with:                         ║
 * ║    - Spoken/Muted toggle state                                                ║
 * ║    - Speak function using Google Gemini TTS                                   ║
 * ║    - Persistent muted preference in localStorage                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

interface TTSContextValue {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  isUsingBrowserTTS: boolean;
}

const TTSContext = createContext<TTSContextValue | undefined>(undefined);

const TTS_STORAGE_KEY = "nebula-tts-muted";

export function TTSProvider({ children }: { children: ReactNode }) {
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
        isMuted,
        setIsMuted,
        toggleMuted,
        speak,
        stopSpeaking,
        isSpeaking,
        isSupported,
        isUsingBrowserTTS
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
