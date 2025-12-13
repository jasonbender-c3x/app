/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    INPUT-AREA.TSX - CHAT INPUT COMPONENT                      ║
 * ║                                                                               ║
 * ║  A modern, Google-style chat input component with:                            ║
 * ║    - Auto-resizing textarea that grows with content                           ║
 * ║    - Action buttons for attachments and voice input                           ║
 * ║    - Animated send button with loading state                                  ║
 * ║    - Keyboard shortcut support (Enter to send)                                ║
 * ║                                                                               ║
 * ║  Visual Layout:                                                               ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │  Ask Nebula anything...                                                │  ║
 * ║  │  [user input text here]                                                │  ║
 * ║  │  ──────────────────────────────────────────────────────────────────── │  ║
 * ║  │  [🖼️] [📎] [🎤]                                              [➤ Send] │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ║  ︎                                                                             ║
 * ║  Nebula may display inaccurate info...                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage input text state
 * - useRef: Reference to textarea for auto-resize
 * - useEffect: Handle auto-resize on input change
 */
import { useState, useRef, useEffect } from "react";

/**
 * UI Components from shadcn/ui
 * - Button: Styled action buttons
 * - Textarea: Multi-line text input (unused - using native textarea)
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Lucide Icons
 * - Mic/MicOff: Voice input button (toggle)
 * - Image: Image attachment button
 * - Send: Send message button
 * - Paperclip: File attachment button
 * - Sparkles: Loading/AI thinking indicator
 * - Monitor: Screen capture button
 * - X: Remove attachment button
 */
import { Mic, MicOff, Image, Send, Paperclip, Sparkles, Monitor, X, Camera } from "lucide-react";

/**
 * Voice hook for speech-to-text functionality
 */
import { useVoice } from "@/hooks/use-voice";

/**
 * Toast notifications for user feedback
 */
import { useToast } from "@/hooks/use-toast";

/**
 * Framer Motion for animations
 * - motion: Animated component wrapper
 * - AnimatePresence: Handles component enter/exit animations
 */
import { motion, AnimatePresence } from "framer-motion";

/**
 * Utility for conditional class names
 */
import { cn } from "@/lib/utils";

// ============================================================================
// IMAGE COMPRESSION UTILITY
// ============================================================================

/**
 * Compress an image using Canvas API
 * Resizes large images and converts to JPEG at specified quality
 * 
 * @param dataUrl - The original image data URL
 * @param maxWidth - Maximum width (default 2048px)
 * @param maxHeight - Maximum height (default 2048px)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Promise with compressed data URL and new size
 */
async function compressImage(
  dataUrl: string,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.8
): Promise<{ dataUrl: string; size: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      
      // Calculate approximate size from base64
      const base64Length = compressedDataUrl.split(",")[1]?.length || 0;
      const size = Math.round((base64Length * 3) / 4);
      
      resolve({
        dataUrl: compressedDataUrl,
        size,
        mimeType: "image/jpeg"
      });
    };
    
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Attachment type for files and screenshots
 */
interface Attachment {
  id: string;
  filename: string;
  type: "file" | "screenshot";
  mimeType: string;
  size: number;
  preview?: string;
  dataUrl: string;
}

/**
 * Props for the ChatInputArea component
 * 
 * @property {(message: string, attachments: Attachment[]) => void} onSend - Callback when user sends a message
 * @property {boolean} isLoading - Whether AI is processing (disables input)
 * @property {string[]} promptHistory - Array of previous user prompts for up-arrow navigation
 */
interface InputAreaProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  promptHistory?: string[];
}

// ============================================================================
// CHAT INPUT AREA COMPONENT
// ============================================================================

/**
 * ChatInputArea Component - Message Input Interface
 * 
 * A sophisticated input component for the chat interface that provides:
 * 
 * Features:
 * - Auto-resizing textarea (grows up to 200px)
 * - Enter to send (Shift+Enter for newline)
 * - Placeholder action buttons (image, file, voice)
 * - Animated send button with loading state
 * - Disabled state during AI response
 * 
 * Auto-Resize Logic:
 * 1. Reset height to "auto" to get true scrollHeight
 * 2. Set height to scrollHeight (actual content height)
 * 3. CSS max-height prevents infinite growth
 * 
 * @param {InputAreaProps} props - Component properties
 * @returns {JSX.Element} The chat input area
 * 
 * @example
 * <ChatInputArea
 *   onSend={(message) => handleSendMessage(message)}
 *   isLoading={isWaitingForAI}
 * />
 */
export function ChatInputArea({ onSend, isLoading, promptHistory = [] }: InputAreaProps) {
  // ===========================================================================
  // STATE & REFS
  // ===========================================================================

  /**
   * Current input text value
   * Cleared after successful send
   */
  const [input, setInput] = useState("");

  /**
   * Ghost text state - when user presses up arrow, shows previous prompt greyed out
   * User must press Tab to activate (make editable)
   */
  const [ghostText, setGhostText] = useState<string | null>(null);

  /**
   * History navigation index - tracks position in prompt history
   * -1 means not navigating history
   */
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * Reference to textarea element for height manipulation
   * Used for auto-resize functionality
   */
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Reference to hidden file input for file uploads
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Attachments state - stores files and screenshots to be sent with message
   */
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  /**
   * Cursor position when STT button was clicked
   * Used to insert transcribed text at the correct position
   */
  const cursorPositionRef = useRef<number | null>(null);

  /**
   * Voice-to-text hook for speech recognition
   */
  const { 
    isListening, 
    transcript, 
    interimTranscript,
    isSupported: isVoiceSupported, 
    startListening, 
    stopListening,
    error: voiceError 
  } = useVoice({ continuous: true, interimResults: true });

  /**
   * Toast notifications
   */
  const { toast } = useToast();

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  /**
   * Effect: Auto-resize textarea based on content
   * 
   * How it works:
   * 1. Reset height to "auto" to allow shrinking
   * 2. Read scrollHeight (actual content height)
   * 3. Set height to scrollHeight
   * 4. CSS max-height (200px) prevents unlimited growth
   * 
   * Triggers on every input change for responsive resizing.
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  /**
   * Effect: Update input with voice transcript
   * Inserts the recognized speech at the saved cursor position
   */
  useEffect(() => {
    if (transcript) {
      setInput(prev => {
        const pos = cursorPositionRef.current;
        if (pos !== null && pos <= prev.length) {
          // Insert at cursor position
          return prev.slice(0, pos) + transcript + prev.slice(pos);
        }
        // Fallback: append to end
        return prev + transcript;
      });
      // Update cursor position to end of inserted text
      if (cursorPositionRef.current !== null) {
        cursorPositionRef.current += transcript.length;
      }
    }
  }, [transcript]);

  /**
   * Effect: Show voice errors
   */
  useEffect(() => {
    if (voiceError) {
      toast({
        title: "Voice Error",
        description: voiceError,
        variant: "destructive"
      });
    }
  }, [voiceError, toast]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle send button click or Enter key
   * 
   * Validates input is not empty and not currently loading,
   * then calls the onSend callback and resets the input.
   */
  const handleSend = () => {
    // Only send if there's content (text or attachments) and not loading
    const hasContent = input.trim() || attachments.length > 0;
    if (hasContent && !isLoading) {
      onSend(input, attachments);
      setInput("");
      setAttachments([]);
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  /**
   * Handle screenshot + send button click
   * Captures a screenshot and sends it with the current message
   */
  const handleScreenshotSend = async () => {
    if (isLoading) return;
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints
      });
      
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const rawDataUrl = canvas.toDataURL("image/png");
        stream.getTracks().forEach(track => track.stop());
        
        let finalDataUrl = rawDataUrl;
        let finalSize = 0;
        let finalMimeType = "image/png";
        
        try {
          const compressed = await compressImage(rawDataUrl);
          finalDataUrl = compressed.dataUrl;
          finalSize = compressed.size;
          finalMimeType = compressed.mimeType;
        } catch (error) {
          console.error("Screenshot compression failed:", error);
          const response = await fetch(rawDataUrl);
          const blob = await response.blob();
          finalSize = blob.size;
        }
        
        const filename = `screenshot-${Date.now()}.jpg`;
        const screenshotAttachment: Attachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename,
          type: "screenshot",
          mimeType: finalMimeType,
          size: finalSize,
          dataUrl: finalDataUrl,
          preview: finalDataUrl
        };
        
        const allAttachments = [...attachments, screenshotAttachment];
        onSend(input, allAttachments);
        setInput("");
        setAttachments([]);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({
          title: "Capture Failed",
          description: "Unable to capture screen. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  /**
   * Remove an attachment by ID
   */
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  /**
   * Handle file selection from file input
   * Compresses images before adding as attachments
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      const isImage = file.type.startsWith("image/");
      
      let finalDataUrl = dataUrl;
      let finalSize = file.size;
      let finalMimeType = file.type;
      
      // Compress images to reduce size
      if (isImage) {
        try {
          const compressed = await compressImage(dataUrl);
          finalDataUrl = compressed.dataUrl;
          finalSize = compressed.size;
          finalMimeType = compressed.mimeType;
        } catch (error) {
          console.error("Image compression failed, using original:", error);
        }
      }
      
      const attachment: Attachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        type: "file",
        mimeType: finalMimeType,
        size: finalSize,
        dataUrl: finalDataUrl,
        preview: isImage ? finalDataUrl : undefined
      };
      
      setAttachments(prev => [...prev, attachment]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Handle keyboard events in textarea
   * 
   * Implements:
   * - Enter: Send message (default)
   * - Shift+Enter: Insert newline (browser default)
   * - ArrowUp: Navigate to previous prompt (shows as ghost text)
   * - ArrowDown: Navigate to next prompt in history
   * - Tab: Activate ghost text (make it editable)
   * - Escape: Clear ghost text
   * 
   * @param {React.KeyboardEvent} e - Keyboard event
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Up arrow - navigate to previous prompt
    if (e.key === "ArrowUp" && !input.trim() && promptHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? promptHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setGhostText(promptHistory[newIndex]);
      return;
    }

    // Down arrow - navigate forward in history or clear
    if (e.key === "ArrowDown" && ghostText !== null) {
      e.preventDefault();
      if (historyIndex < promptHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setGhostText(promptHistory[newIndex]);
      } else {
        // At the end, clear ghost text
        setGhostText(null);
        setHistoryIndex(-1);
      }
      return;
    }

    // Tab - activate ghost text
    if (e.key === "Tab" && ghostText !== null) {
      e.preventDefault();
      setInput(ghostText);
      setGhostText(null);
      setHistoryIndex(-1);
      return;
    }

    // Escape - clear ghost text
    if (e.key === "Escape" && ghostText !== null) {
      e.preventDefault();
      setGhostText(null);
      setHistoryIndex(-1);
      return;
    }
  };

  /**
   * Handle Tab button click - same as pressing Tab key
   */
  const handleTabClick = () => {
    if (ghostText !== null) {
      setInput(ghostText);
      setGhostText(null);
      setHistoryIndex(-1);
      textareaRef.current?.focus();
    }
  };

  /**
   * Toggle voice-to-text listening
   * Starts or stops speech recognition based on current state
   * Saves cursor position to insert transcribed text at that location
   */
  const handleMicClick = () => {
    if (!isVoiceSupported) {
      toast({
        title: "Not Supported",
        description: "Voice input is not supported in your browser",
        variant: "destructive"
      });
      return;
    }
    
    if (isListening) {
      stopListening();
      cursorPositionRef.current = null;
    } else {
      // Save cursor position before starting
      const cursorPos = textareaRef.current?.selectionStart ?? input.length;
      cursorPositionRef.current = cursorPos;
      
      // Use append mode to preserve existing transcript in hook
      const hasExistingText = input.trim().length > 0;
      startListening(hasExistingText);
    }
  };

  /**
   * Capture screen and add as attachment
   * Uses the Screen Capture API to capture the user's screen
   * Compresses the screenshot before adding
   */
  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints
      });
      
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        const rawDataUrl = canvas.toDataURL("image/png");
        
        stream.getTracks().forEach(track => track.stop());
        
        // Compress the screenshot
        let finalDataUrl = rawDataUrl;
        let finalSize = 0;
        let finalMimeType = "image/png";
        
        try {
          const compressed = await compressImage(rawDataUrl);
          finalDataUrl = compressed.dataUrl;
          finalSize = compressed.size;
          finalMimeType = compressed.mimeType;
        } catch (error) {
          console.error("Screenshot compression failed, using original:", error);
          const response = await fetch(rawDataUrl);
          const blob = await response.blob();
          finalSize = blob.size;
        }
        
        const filename = `screenshot-${Date.now()}.jpg`;
        const attachment: Attachment = {
          id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename,
          type: "screenshot",
          mimeType: finalMimeType,
          size: finalSize,
          dataUrl: finalDataUrl,
          preview: finalDataUrl
        };
        
        setAttachments(prev => [...prev, attachment]);
        
        toast({
          title: "Screenshot Attached",
          description: "Your screenshot has been added to the message"
        });
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({
          title: "Capture Failed",
          description: "Unable to capture screen. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  const hasContent = input.trim() || attachments.length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Hidden file input for file uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.json,.csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
        data-testid="input-file-upload"
      />

      {/* 
       * Input Container
       * Rounded card with subtle border and focus effects
       * Changes appearance when focused (border, shadow, background)
       */}
      <div className="relative group rounded-3xl bg-secondary/50 border border-transparent focus-within:border-primary/20 focus-within:bg-background focus-within:shadow-xl focus-within:shadow-primary/5 transition-all duration-300">
        
        {/* Attachment Preview Area */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pt-3 flex flex-wrap gap-2"
            >
              {attachments.map((attachment) => (
                <motion.div
                  key={attachment.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group/attachment"
                  data-testid={`attachment-preview-${attachment.id}`}
                >
                  {attachment.preview ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={attachment.preview}
                        alt={attachment.filename}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/attachment:opacity-100 transition-opacity"
                        data-testid={`button-remove-attachment-${attachment.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[100px]">{attachment.filename}</span>
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="w-5 h-5 rounded-full hover:bg-destructive/10 flex items-center justify-center"
                        data-testid={`button-remove-attachment-${attachment.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea Container - Padding around the input */}
        <div className="px-4 pt-4 pb-14 relative">
            {/* Ghost Text Overlay - Shows previous prompt when navigating history */}
            <AnimatePresence>
              {ghostText !== null && !input && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 px-4 pt-4 pb-14 pointer-events-none"
                >
                  <div className="text-base text-muted-foreground/50 whitespace-pre-wrap break-words">
                    {ghostText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 
             * Native Textarea Element
             * Using native for better control over resize behavior
             * Styled to be invisible (transparent background, no border)
             */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Clear ghost text when user starts typing
                if (ghostText !== null) {
                  setGhostText(null);
                  setHistoryIndex(-1);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={ghostText !== null ? "" : "Ask Meowstic anything..."}
              className="w-full bg-transparent border-none resize-none outline-none text-base max-h-[200px] min-h-[24px] placeholder:text-muted-foreground relative z-10"
              rows={1}
              data-testid="input-chat-message"
            />
        </div>

        {/* 
         * Bottom Action Bar
         * Positioned absolutely at bottom of input container
         * Contains attachment buttons (left) and send button (right)
         */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            {/* Left Side: Action Buttons */}
            <div className="flex gap-1 items-center">
              {/* Tab Button - Lights up when ghost text is active */}
              <AnimatePresence>
                {ghostText !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: "auto" }}
                    exit={{ opacity: 0, scale: 0.8, width: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTabClick}
                      className="h-7 px-2 rounded-md bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all font-mono text-xs font-medium"
                      data-testid="button-tab-activate"
                    >
                      Tab ↵
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Screen Capture Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleScreenCapture}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-screen-capture"
              >
                <Monitor className="h-5 w-5" />
              </Button>
              
              {/* File Attachment Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-file-attach"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              
              {/* Voice Input Button - toggles speech-to-text */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleMicClick}
                className={cn(
                  "h-9 w-9 rounded-full transition-colors",
                  isListening 
                    ? "text-red-500 bg-red-100 hover:bg-red-200 animate-pulse" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                data-testid="button-voice-input"
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </div>

            {/* Button group for send actions */}
            <div className="flex gap-2">
              {/* 
               * Screenshot + Send Button
               * Captures screenshot and sends with message
               */}
              <Button 
                onClick={handleScreenshotSend}
                disabled={isLoading}
                size="icon"
                className="h-9 w-9 rounded-full transition-all duration-300 bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600"
                data-testid="button-screenshot-send"
                title="Capture screenshot and send"
              >
                {isLoading ? (
                  <Sparkles className="h-5 w-5 animate-pulse" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>

              {/* 
               * Send Button
               * Changes appearance based on:
               * - No content: Muted/disabled style
               * - Has content: Primary color with shadow
               * - Loading: Shows animated sparkles icon
               */}
              <Button 
                onClick={handleSend}
                disabled={!hasContent || isLoading}
                size="icon"
                className={cn(
                    "h-9 w-9 rounded-full transition-all duration-300",
                    hasContent 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90" 
                    : "bg-muted text-muted-foreground"
                )}
                data-testid="button-send"
              >
                {isLoading ? (
                    <Sparkles className="h-5 w-5 animate-pulse" />
                ) : (
                    <Send className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            </div>
        </div>
      </div>
      
      {/* 
       * Developer Status Message
       * Shows system status and connection info
       * Centered below the input area
       */}
      <div className="text-center mt-3 text-xs text-muted-foreground flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Connected
        </span>
        <span className="text-muted-foreground/50">•</span>
        <span>Gemini 2.0 Flash</span>
        <span className="text-muted-foreground/50">•</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
