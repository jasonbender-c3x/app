/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                     USE-VOICE.TS - VOICE I/O HOOK                             ║
 * ║                                                                               ║
 * ║  A comprehensive React hook for voice input (speech-to-text) and             ║
 * ║  voice output (text-to-speech) using the Web Speech API.                     ║
 * ║                                                                               ║
 * ║  Features:                                                                    ║
 * ║    - Speech Recognition (STT): Convert spoken words to text                  ║
 * ║    - Speech Synthesis (TTS): Convert text to spoken audio                    ║
 * ║    - Real-time interim results during recognition                            ║
 * ║    - Configurable voice, rate, pitch, and volume                             ║
 * ║    - Browser compatibility detection                                          ║
 * ║                                                                               ║
 * ║  Browser Support:                                                             ║
 * ║    ✓ Chrome, Edge (best support)                                             ║
 * ║    △ Firefox, Safari (partial support)                                        ║
 * ║    ✗ Some mobile browsers                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Track recognition/synthesis state
 * - useCallback: Memoize event handlers
 * - useRef: Store recognition/utterance instances
 * - useEffect: Setup/cleanup speech recognition
 */
import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Configuration options for voice recognition
 * 
 * @property {string} [lang='en-US'] - Recognition language (BCP 47 format)
 * @property {boolean} [continuous=false] - Keep listening after results
 * @property {boolean} [interimResults=true] - Show results before finalized
 */
interface VoiceOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

/**
 * Return type of the useVoice hook
 * Contains all state and control functions for voice I/O
 */
interface UseVoiceReturn {
  /** Whether speech recognition is currently active */
  isListening: boolean;
  
  /** Final transcribed text (accumulated) */
  transcript: string;
  
  /** Current interim (non-final) transcription */
  interimTranscript: string;
  
  /** Whether Web Speech API is available */
  isSupported: boolean;
  
  /** Start speech recognition (optionally append to existing transcript) */
  startListening: (appendMode?: boolean) => void;
  
  /** Stop speech recognition */
  stopListening: () => void;
  
  /** Speak text aloud */
  speak: (text: string, options?: SpeakOptions) => void;
  
  /** Stop current speech */
  stopSpeaking: () => void;
  
  /** Whether currently speaking */
  isSpeaking: boolean;
  
  /** Any error that occurred */
  error: string | null;
}

/**
 * Options for text-to-speech synthesis
 * 
 * @property {number} [rate=1] - Speech rate (0.1 to 10)
 * @property {number} [pitch=1] - Pitch (0 to 2)
 * @property {number} [volume=1] - Volume (0 to 1)
 * @property {SpeechSynthesisVoice} [voice] - Specific voice to use
 * @property {string} [lang] - Override language
 */
interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
  lang?: string;
}

// ============================================================================
// USE VOICE HOOK
// ============================================================================

/**
 * useVoice - Voice Input/Output Hook
 * 
 * Provides a complete interface for speech recognition (STT) and
 * speech synthesis (TTS) using the Web Speech API.
 * 
 * Speech Recognition Flow:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  User speaks → SpeechRecognition API → onresult event          │
 * │                      ↓                                          │
 * │  interimTranscript (real-time) → transcript (final)            │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Speech Synthesis Flow:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  speak(text) → SpeechSynthesisUtterance → Audio output         │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * @param {VoiceOptions} options - Configuration options
 * @returns {UseVoiceReturn} Voice state and control functions
 * 
 * @example
 * function VoiceInput() {
 *   const { isListening, transcript, startListening, stopListening, speak } = useVoice();
 *   
 *   return (
 *     <div>
 *       <button onClick={isListening ? stopListening : startListening}>
 *         {isListening ? 'Stop' : 'Start'} Listening
 *       </button>
 *       <p>Transcript: {transcript}</p>
 *       <button onClick={() => speak('Hello world!')}>Speak</button>
 *     </div>
 *   );
 * }
 */
export function useVoice(options: VoiceOptions = {}): UseVoiceReturn {
  // Destructure options with defaults
  const { lang = 'en-US', continuous = false, interimResults = true } = options;
  
  // ===========================================================================
  // STATE
  // ===========================================================================
  
  /** Whether speech recognition is active */
  const [isListening, setIsListening] = useState(false);
  
  /** Accumulated final transcript */
  const [transcript, setTranscript] = useState('');
  
  /** Current interim (partial) transcript */
  const [interimTranscript, setInterimTranscript] = useState('');
  
  /** Whether text-to-speech is active */
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  /** Error message if any */
  const [error, setError] = useState<string | null>(null);
  
  // ===========================================================================
  // REFS
  // ===========================================================================
  
  /** Reference to SpeechRecognition instance */
  const recognitionRef = useRef<any>(null);
  
  /** Reference to SpeechSynthesisUtterance instance */
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ===========================================================================
  // BROWSER SUPPORT CHECK
  // ===========================================================================
  
  /**
   * Check if Web Speech API is available
   * Supports both standard and webkit-prefixed versions
   */
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // ===========================================================================
  // SPEECH RECOGNITION SETUP
  // ===========================================================================
  
  /**
   * Effect: Initialize SpeechRecognition instance
   * Sets up event handlers and configures recognition settings
   */
  useEffect(() => {
    // Skip if not supported
    if (!isSupported) return;

    // Get the SpeechRecognition constructor (with webkit fallback)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configure recognition settings
    recognition.lang = lang;                    // Language for recognition
    recognition.continuous = continuous;        // Keep listening after results
    recognition.interimResults = interimResults; // Show partial results

    /**
     * Handle recognition start
     * Called when the service has started capturing audio
     */
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    /**
     * Handle recognition end
     * Called when the service has disconnected
     */
    recognition.onend = () => {
      setIsListening(false);
    };

    /**
     * Handle recognition errors
     * @param {SpeechRecognitionErrorEvent} event - Error event
     */
    recognition.onerror = (event: any) => {
      const friendlyMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone access in your browser settings.',
        'no-speech': 'No speech detected. Please speak into your microphone.',
        'audio-capture': 'No microphone found. Please connect a microphone.',
        'network': 'Network error. Please check your connection.',
        'aborted': 'Speech recognition was aborted.',
        'service-not-allowed': 'Speech recognition service is not available in this browser.',
      };
      setError(friendlyMessages[event.error] || `Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    /**
     * Handle recognition results
     * Called when the service returns a result
     * @param {SpeechRecognitionEvent} event - Result event
     */
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';

      // Process all results from the current event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Final result - add to accumulated transcript
          finalTranscript += result[0].transcript;
        } else {
          // Interim result - temporary, may change
          interim += result[0].transcript;
        }
      }

      // Update state with results
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    // Store reference for control functions
    recognitionRef.current = recognition;

    // Cleanup: Abort recognition on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [lang, continuous, interimResults, isSupported]);

  // ===========================================================================
  // SPEECH RECOGNITION CONTROLS
  // ===========================================================================
  
  /**
   * Start speech recognition
   * If appendMode is true, keeps existing transcript and appends new speech
   * Otherwise, clears previous transcript and begins fresh
   */
  const startListening = useCallback((appendMode: boolean = false) => {
    if (!recognitionRef.current) return;
    
    // Reset state - only clear transcript if not in append mode
    if (!appendMode) {
      setTranscript('');
    }
    setInterimTranscript('');
    setError(null);
    
    // Start listening
    try {
      recognitionRef.current.start();
    } catch (e) {
      setError('Failed to start speech recognition');
    }
  }, []);

  /**
   * Stop speech recognition
   * Ends the current listening session
   */
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  // ===========================================================================
  // SPEECH SYNTHESIS CONTROLS
  // ===========================================================================
  
  /**
   * Speak text using text-to-speech
   * 
   * @param {string} text - Text to speak
   * @param {SpeakOptions} speakOptions - Speech configuration
   */
  const speak = useCallback((text: string, speakOptions: SpeakOptions = {}) => {
    // Check for speech synthesis support
    if (!('speechSynthesis' in window)) {
      setError('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Create utterance with text
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply options with defaults
    utterance.rate = speakOptions.rate ?? 1;      // Speed (0.1-10)
    utterance.pitch = speakOptions.pitch ?? 1;    // Pitch (0-2)
    utterance.volume = speakOptions.volume ?? 1;  // Volume (0-1)
    utterance.lang = speakOptions.lang ?? lang;   // Language
    
    // Apply specific voice if provided
    if (speakOptions.voice) {
      utterance.voice = speakOptions.voice;
    }

    // Event handlers
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      setError(event.error);
      setIsSpeaking(false);
    };

    // Store reference and speak
    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [lang]);

  /**
   * Stop current speech synthesis
   */
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // ===========================================================================
  // RETURN HOOK VALUES
  // ===========================================================================
  
  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSpeaking,
    error
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get available speech synthesis voices
 * 
 * Returns a Promise because voices may not be immediately available.
 * Some browsers load voices asynchronously.
 * 
 * @returns {Promise<SpeechSynthesisVoice[]>} Array of available voices
 * 
 * @example
 * const voices = await getVoices();
 * const englishVoices = voices.filter(v => v.lang.startsWith('en'));
 */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    // Try to get voices immediately
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // If no voices, wait for them to load
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

// ============================================================================
// TYPE DECLARATIONS
// ============================================================================

/**
 * Extend Window interface to include webkit-prefixed SpeechRecognition
 * Required for TypeScript compatibility with Safari/older Chrome
 */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
