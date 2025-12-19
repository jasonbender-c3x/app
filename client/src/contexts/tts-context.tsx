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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
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
      .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[_~]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();
    
    if (!cleanText) return;
    
    setIsSpeaking(true);
    
    try {
      const response = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          speakers: [{ name: "narrator", voice: "Kore" }]
        })
      });
      
      if (!response.ok) {
        console.warn("Gemini TTS unavailable, using browser TTS");
        speakWithBrowserTTS(cleanText);
        return;
      }
      
      const data = await response.json();
      
      if (!data.success || !data.audioBase64) {
        console.warn("Gemini TTS failed, using browser TTS:", data.error);
        speakWithBrowserTTS(cleanText);
        return;
      }
      
      console.log("[TTS] Creating audio from base64, mimeType:", data.mimeType);
      const audio = new Audio(`data:${data.mimeType || "audio/mp3"};base64,${data.audioBase64}`);
      audioRef.current = audio;
      
      audio.onended = () => {
        console.log("[TTS] Audio playback ended");
        setIsSpeaking(false);
        audioRef.current = null;
      };
      
      audio.onerror = (e) => {
        console.error("[TTS] Audio playback error:", e);
        setIsSpeaking(false);
        audioRef.current = null;
      };
      
      try {
        await audio.play();
        console.log("[TTS] Audio playback started successfully");
      } catch (playError) {
        console.error("[TTS] Failed to play audio:", playError);
        speakWithBrowserTTS(cleanText);
      }
    } catch (error) {
      console.warn("TTS API error, using browser TTS:", error);
      speakWithBrowserTTS(cleanText);
    }
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
