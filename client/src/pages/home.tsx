/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        HOME.TSX - MAIN CHAT INTERFACE                         ║
 * ║                                                                               ║
 * ║  The primary view of Nebula Chat, featuring an AI-powered conversational      ║
 * ║  interface with real-time streaming responses. This component handles:        ║
 * ║                                                                               ║
 * ║    1. Chat session management (create, select, load)                          ║
 * ║    2. Message sending with streaming AI responses (Server-Sent Events)        ║
 * ║    3. Welcome screen with quick-start prompt suggestions                      ║
 * ║    4. Collapsible sidebar for chat history navigation                         ║
 * ║    5. Responsive design for mobile and desktop                                ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Sidebar (collapsible)  │  Main Content Area                            │  ║
 * ║  │ ┌──────────────────┐   │  ┌──────────────────────────────────────────┐ │  ║
 * ║  │ │ Chat History     │   │  │ Chat Messages (scrollable)               │ │  ║
 * ║  │ │ - Chat 1         │   │  │ or Welcome Screen (when empty)           │ │  ║
 * ║  │ │ - Chat 2         │   │  └──────────────────────────────────────────┘ │  ║
 * ║  │ │ ...              │   │  ┌──────────────────────────────────────────┐ │  ║
 * ║  │ └──────────────────┘   │  │ Input Area (fixed at bottom)             │ │  ║
 * ║  └────────────────────────┴──┴──────────────────────────────────────────┴─┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage component state (messages, loading, sidebar visibility)
 * - useRef: Reference to scroll container for auto-scroll behavior
 * - useEffect: Side effects for data loading and scroll behavior
 */
import { useState, useRef, useEffect } from "react";

/**
 * Custom Components
 * - Sidebar: Collapsible chat history panel with navigation
 * - ChatMessage: Individual message bubble (user or AI)
 * - ChatInputArea: Text input with send button and voice input
 */
import { Sidebar } from "@/components/chat/sidebar";
import { ChatMessage } from "@/components/chat/message";
import { ChatInputArea } from "@/components/chat/input-area";

/**
 * UI Components from shadcn/ui
 * - Button: Consistent styled button component
 */
import { Button } from "@/components/ui/button";

/**
 * Lucide Icons - Used for visual elements
 * - Menu: Hamburger menu icon for mobile sidebar toggle
 * - Sparkles: Icon for creative/AI prompt suggestion
 * - Compass: Icon for travel/exploration prompt
 * - Lightbulb: Icon for brainstorming prompt
 * - Code2: Icon for coding/debug prompt
 */
import { Menu, Sparkles, Compass, Lightbulb, Code2, Volume2, VolumeX, ChevronLeft, ChevronRight, PawPrint, Moon, Fish, Heart, Zap, BookOpen, Radio } from "lucide-react";

/**
 * Framer Motion - Animation library
 * - motion: Animated component wrapper
 * - AnimatePresence: Handles enter/exit animations
 */
import { motion, AnimatePresence } from "framer-motion";

/**
 * Nebula Logo - Custom generated AI-themed logo
 */
import logo from "@assets/generated_images/cute_cat_logo_icon.png";

/**
 * Type Imports from shared schema
 * - Chat: Chat session metadata (id, title, timestamps)
 * - Message: Individual message (id, chatId, role, content, timestamp)
 */
import type { Chat, Message } from "@shared/schema";

import { useTTS } from "@/contexts/tts-context";
import { useLiveAudio } from "@/hooks/use-live-audio";

/**
 * Attachment type for files and screenshots from input area
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

// ============================================================================
// HOME COMPONENT
// ============================================================================

/**
 * Home Component - Main Chat Interface
 * 
 * This is the primary page of Nebula Chat, providing a full-featured
 * conversational AI interface. It manages the complete chat lifecycle:
 * 
 * State Management:
 * - isSidebarOpen: Controls mobile sidebar visibility
 * - messages: Array of messages in the current chat
 * - isLoading: True while waiting for AI response
 * - chats: List of all chat sessions for sidebar
 * - currentChatId: ID of the active chat session
 * 
 * Data Flow:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  User Input → handleSendMessage() → POST /api/chats/:id/messages│
 * │      ↓                                                          │
 * │  Add temp message to UI (optimistic update)                     │
 * │      ↓                                                          │
 * │  Stream AI response (SSE) → Update UI in real-time             │
 * │      ↓                                                          │
 * │  On complete → Reload messages with real IDs                   │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * @returns {JSX.Element} The complete home page with chat interface
 */
export default function Home() {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Sidebar visibility state
   * On mobile: controlled by menu button, slides in/out
   * On desktop: always visible (lg:block in CSS)
   */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /**
   * Sidebar collapsed state (desktop only)
   * When true, sidebar shows only icons
   */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  /**
   * Messages array for the current chat session
   * Each message has: id, chatId, role ('user' | 'ai'), content, createdAt
   */
  const [messages, setMessages] = useState<Message[]>([]);

  /**
   * Loading state - true while waiting for AI response
   * Used to show "thinking" animation and disable input
   */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * All chat sessions for sidebar display
   * Loaded on mount and updated when chats are created
   */
  const [chats, setChats] = useState<Chat[]>([]);

  /**
   * Currently selected chat ID
   * null = no chat selected (show welcome screen)
   */
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  /**
   * Scroll anchor reference
   * Used to auto-scroll to bottom when new messages arrive
   */
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Text-to-Speech hook for reading AI responses aloud
   */
  const { isMuted, toggleMuted, speak, isSpeaking, stopSpeaking, isSupported: isTTSSupported, isUsingBrowserTTS } = useTTS();

  /**
   * Live Mode state - when enabled, uses real-time streaming audio
   */
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  /**
   * Live Audio hook for real-time streaming audio via Gemini Live API
   */
  const liveAudio = useLiveAudio({
    voice: "Kore",
    onError: (error) => console.error("[Live Audio] Error:", error),
    onConnected: () => console.log("[Live Audio] Connected"),
    onDisconnected: () => console.log("[Live Audio] Disconnected"),
  });

  // ===========================================================================
  // EFFECTS (Side Effects)
  // ===========================================================================

  /**
   * Effect: Connect/disconnect Live Audio when Live Mode is toggled
   * Note: We use refs for liveAudio methods to avoid re-running on every render
   */
  const liveAudioRef = useRef(liveAudio);
  liveAudioRef.current = liveAudio;
  
  useEffect(() => {
    const audio = liveAudioRef.current;
    if (isLiveMode && !audio.isConnected) {
      audio.connect();
    } else if (!isLiveMode && audio.isConnected) {
      audio.disconnect();
    }
  }, [isLiveMode]);

  /**
   * Effect: Load all chats on component mount
   * Fetches the chat history for the sidebar
   */
  useEffect(() => {
    loadChats(true); // Auto-select default chat on initial load
  }, []);

  /**
   * Effect: Load messages when switching chats
   * Triggers when currentChatId changes to a non-null value
   */
  useEffect(() => {
    if (currentChatId) {
      loadChatMessages(currentChatId);
    }
  }, [currentChatId]);

  /**
   * Effect: Auto-scroll to bottom
   * Triggers when messages array changes or loading state changes
   * Provides smooth scrolling experience during conversation
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // ===========================================================================
  // DATA FETCHING FUNCTIONS
  // ===========================================================================

  /**
   * Fetch all chat sessions from the server
   * 
   * Endpoint: GET /api/chats
   * Updates the chats state with the list of all chat sessions
   * 
   * @example
   * await loadChats();
   * // chats state now contains: [{ id: '1', title: 'Chat 1', ... }, ...]
   */
  const loadChats = async (autoSelect = false) => {
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        // Auto-select the first chat (Default) on initial load
        if (autoSelect && data.length > 0 && !currentChatId) {
          setCurrentChatId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  /**
   * Fetch messages for a specific chat session
   * 
   * Endpoint: GET /api/chats/:chatId
   * Updates the messages state with the chat's message history
   * 
   * @param {string} chatId - The ID of the chat to load messages for
   * 
   * @example
   * await loadChatMessages('abc-123');
   * // messages state now contains all messages from that chat
   */
  const loadChatMessages = async (chatId: string): Promise<Message[] | undefined> => {
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        // Metadata is already parsed from JSONB column - just pass through
        const messagesWithMetadata = (data.messages || []).map((msg: any) => ({
          ...msg,
          metadata: msg.metadata || undefined
        }));
        setMessages(messagesWithMetadata);
        return messagesWithMetadata;
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
    return undefined;
  };

  // ===========================================================================
  // MESSAGE HANDLING
  // ===========================================================================

  /**
   * Send a message and handle streaming AI response
   * 
   * This function implements the complete message sending flow:
   * 1. Create a new chat if none exists
   * 2. Add user message to UI immediately (optimistic update)
   * 3. POST to /api/chats/:id/messages
   * 4. Read Server-Sent Events (SSE) stream for AI response
   * 5. Update UI in real-time as tokens arrive
   * 6. Reload final messages when stream completes
   * 
   * Streaming Response Format (SSE):
   * data: {"text": "partial token"}
   * data: {"text": "more text"}
   * data: {"done": true}
   * 
   * @param {string} content - The message content to send
   * @param {Attachment[]} attachments - Optional file/screenshot attachments
   * 
   * @example
   * handleSendMessage("What is the capital of France?", []);
   * // UI shows user message immediately
   * // AI response streams in token by token
   */
  const handleSendMessage = async (content: string, attachments: Attachment[] = []) => {
    try {
      let chatId = currentChatId;

      // Step 1: Create a new chat if none selected
      if (!chatId) {
        const newChatId = await handleNewChat();
        if (!newChatId) {
          console.error('Failed to create chat');
          return;
        }
        chatId = newChatId;
      }

      // Step 2: Add user message to UI immediately (optimistic update)
      // Uses temp ID that will be replaced after server confirms
      const tempUserMessage = {
        id: `temp-${Date.now()}`,
        chatId: chatId,
        role: "user",
        content,
        createdAt: new Date(),
        metadata: null,
      } as Message;
      setMessages((prev) => [...prev, tempUserMessage]);
      setIsLoading(true);

      // Step 2.5: If Live Mode is enabled, send user's message directly to Live API
      // This generates audio response in real-time while text response streams
      if (isLiveMode && liveAudio.isConnected) {
        liveAudio.sendMessage(content);
      }

      // Step 3: Send message to backend with optional attachments
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          attachments: attachments.map(a => ({
            filename: a.filename,
            type: a.type,
            mimeType: a.mimeType,
            size: a.size,
            dataUrl: a.dataUrl
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Step 4: Handle streaming response (Server-Sent Events)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }

      // Accumulate AI response as tokens stream in
      let aiMessageContent = '';
      let buffer = '';
      let streamMetadata: any = null;

      // Read the stream until done
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode bytes to text and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Parse complete lines (SSE format: "data: {...}\n")
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        // Process each complete line
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)); // Remove "data: " prefix
              
              // Step 5: Update UI as tokens arrive
              if (data.text) {
                // If replace flag is set, replace content entirely (for structured responses)
                if (data.replace) {
                  aiMessageContent = data.text;
                } else {
                  aiMessageContent += data.text;
                }
                // Replace temporary AI message with updated content
                setMessages((prev) => {
                  const filtered = prev.filter(m => !m.id.startsWith('temp-ai-'));
                  return [
                    ...filtered,
                    {
                      id: `temp-ai-${Date.now()}`,
                      chatId: chatId,
                      role: "ai",
                      content: aiMessageContent,
                      createdAt: new Date(),
                    } as Message
                  ];
                });
              }

              // Handle metadata event (tool results, file ops, autoexec)
              if (data.metadata) {
                streamMetadata = data.metadata;
                // Update the temp message with metadata
                setMessages((prev) => {
                  const filtered = prev.filter(m => !m.id.startsWith('temp-ai-'));
                  return [
                    ...filtered,
                    {
                      id: `temp-ai-${Date.now()}`,
                      chatId: chatId,
                      role: "ai",
                      content: aiMessageContent,
                      createdAt: new Date(),
                      metadata: streamMetadata,
                    } as Message & { metadata?: any }
                  ];
                });
              }

              // Step 6: Stream complete - reload final messages and speak response
              if (data.done) {
                setIsLoading(false);
                // Speak the AI response using TTS (only if NOT in Live Mode)
                // Live Mode already sent user's input to Live API at step 2.5
                if (aiMessageContent && !isLiveMode) {
                  speak(aiMessageContent);
                }
                // Get actual stored messages with real IDs
                const updatedMessages = await loadChatMessages(chatId);
                // Update chat list (timestamps changed)
                await loadChats();
                
                // Step 7: Handle async autoexec - poll for result and trigger follow-up
                if (data.pendingAutoexec) {
                  // Find the AI message with pending autoexec
                  const aiMessage = updatedMessages?.find(
                    (m: Message) => m.role === 'ai' && m.metadata
                  );
                  if (aiMessage) {
                    pollForAutoexecResult(chatId, aiMessage.id);
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  /**
   * Poll for autoexec result and send follow-up message to LLM
   * 
   * When an autoexec command is executed asynchronously, this function
   * polls the message metadata until the autoexec result is available,
   * then sends the result as a new user message to get LLM feedback.
   */
  const pollForAutoexecResult = async (chatId: string, messageId: string) => {
    const maxAttempts = 30; // 30 seconds max
    const pollInterval = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/messages/${messageId}/metadata`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.hasAutoexecResult) {
            // Autoexec completed - reload messages to show terminal output
            await loadChatMessages(chatId);
            
            // Send the result to the LLM as a follow-up message
            const autoexec = data.metadata.autoexecResult;
            const followUpContent = `[Terminal Output]\nCommand: ${autoexec.command}\nExit Code: ${autoexec.exitCode}\nOutput:\n\`\`\`\n${autoexec.output || "(no output)"}\n\`\`\`\n\nPlease review the terminal output and respond accordingly.`;
            
            // Send the follow-up message
            await handleSendMessage(followUpContent, []);
            return;
          }
        }
      } catch (error) {
        console.error('Error polling for autoexec result:', error);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    console.warn('Autoexec polling timed out');
  };

  // ===========================================================================
  // CHAT MANAGEMENT
  // ===========================================================================

  /**
   * Create a new chat session
   * 
   * Endpoint: POST /api/chats
   * Creates a new empty chat and sets it as the current chat
   * 
   * @returns {Promise<string | null>} The new chat ID, or null if creation failed
   * 
   * @example
   * const chatId = await handleNewChat();
   * if (chatId) {
   *   console.log('New chat created:', chatId);
   * }
   */
  const handleNewChat = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Discussion' }),
      });

      if (response.ok) {
        const newChat = await response.json();
        setCurrentChatId(newChat.id);
        setMessages([]); // Clear messages for new chat
        setChats((prev) => [newChat, ...prev]); // Add to top of list
        setIsSidebarOpen(false); // Close sidebar on mobile
        return newChat.id;
      }
      return null;
    } catch (error) {
      console.error('Failed to create new chat:', error);
      return null;
    }
  };

  /**
   * Handle chat selection from sidebar
   * Updates the current chat ID, triggering message load via useEffect
   * 
   * @param {string} chatId - The ID of the chat to select
   */
  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* 
       * Sidebar Component
       * - Shows chat history
       * - Allows creating new chats
       * - Collapsible on mobile (controlled by isSidebarOpen)
       */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        onNewChat={handleNewChat}
        chats={chats}
        currentChatId={currentChatId}
        onChatSelect={handleChatSelect}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* 
         * Mobile Header
         * Only visible on screens smaller than lg breakpoint
         * Contains hamburger menu to open sidebar
         */}
        <div className="flex items-center justify-between p-4 lg:hidden sticky top-0 bg-background/80 backdrop-blur-md z-30">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            <span className="ml-3 font-display font-semibold text-lg">Meowstic</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Mobile Live Mode Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`rounded-full h-11 w-11 ${isLiveMode ? 'ring-2 ring-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]' : ''}`}
              data-testid="button-live-mode-toggle-mobile"
              title={isLiveMode ? "Disable live streaming audio" : "Enable live streaming audio"}
            >
              <Radio className={`h-6 w-6 ${isLiveMode ? 'text-green-400' : 'text-muted-foreground'}`} />
            </Button>
            {/* Mobile TTS Toggle - only shown if browser supports TTS */}
            {isTTSSupported && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  toggleMuted();
                }}
                className={`rounded-full h-11 w-11 ${isUsingBrowserTTS && isSpeaking ? 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.6)]' : ''}`}
                data-testid="button-tts-toggle-mobile"
                title={isMuted ? "Enable voice" : "Mute voice"}
              >
                {isMuted ? (
                  <VolumeX className="h-7 w-7 text-muted-foreground" />
                ) : (
                  <Volume2 className={`h-7 w-7 ${isUsingBrowserTTS && isSpeaking ? 'text-yellow-400' : 'text-primary'}`} />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 
         * Desktop Header Controls
         * Positioned in top-right corner on large screens
         * Contains TTS toggle and user avatar
         */}
        <div className="hidden lg:flex absolute top-4 right-4 z-30 gap-2 items-center">
            {/* Live Mode Toggle Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`rounded-full h-11 w-11 ${isLiveMode ? 'ring-2 ring-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]' : ''}`}
              data-testid="button-live-mode-toggle"
              title={isLiveMode ? "Disable live streaming audio (currently on)" : "Enable live streaming audio for real-time voice"}
            >
              <Radio className={`h-6 w-6 ${isLiveMode ? 'text-green-400' : 'text-muted-foreground'}`} />
            </Button>
            {/* TTS Toggle Button - only shown if browser supports TTS */}
            {isTTSSupported && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  toggleMuted();
                }}
                className={`rounded-full h-11 w-11 ${isUsingBrowserTTS && isSpeaking ? 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.6)]' : ''}`}
                data-testid="button-tts-toggle"
                title={isMuted ? "Enable voice (click to hear AI responses)" : "Mute voice"}
              >
                {isMuted ? (
                  <VolumeX className="h-7 w-7 text-muted-foreground" />
                ) : (
                  <Volume2 className={`h-7 w-7 ${isUsingBrowserTTS && isSpeaking ? 'text-yellow-400' : 'text-primary'}`} />
                )}
              </Button>
            )}
            
            {/* User Avatar */}
            <Button variant="ghost" size="sm" className="rounded-full">
                <span className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">JD</span>
            </Button>
        </div>

        {/* 
         * Chat Area (Scrollable)
         * Contains either:
         * - Welcome screen (when no messages)
         * - Message list (when chat has messages)
         */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            // =================================================================
            // WELCOME SCREEN (Empty State)
            // Shown when no messages exist in current chat
            // =================================================================
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
               {/* Cat Logo with glow effect */}
               <div className="mb-8 relative">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
                  <img src={logo} alt="Meowstic Logo" className="w-24 h-24 rounded-2xl relative z-10 shadow-2xl shadow-primary/20" data-testid="img-logo" />
               </div>
               
              {/* Welcome Heading */}
              <h1 className="text-4xl md:text-5xl font-display font-medium text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/60 mb-3 text-center tracking-tight" data-testid="text-welcome-title">
                Meow there! 🐱
              </h1>
              
              {/* Subtitle */}
              <h2 className="text-2xl md:text-3xl font-display font-light text-muted-foreground mb-12 text-center" data-testid="text-welcome-subtitle">
                What can this curious cat help you with?
              </h2>

              {/* 
               * Cat-Themed Quick Start Carousel
               * Animated card carousel with cat-themed prompts
               * Click cards to send prompts, use arrows to navigate
               */}
              <CatCardCarousel onSendMessage={handleSendMessage} />
            </div>
          ) : (
            // =================================================================
            // MESSAGES LIST
            // Renders all messages in the current chat
            // =================================================================
            <div className="flex flex-col gap-2 py-6 min-h-full">
              {/* Render each message using ChatMessage component */}
              {messages.map((msg, index) => {
                // For AI messages, find the previous user message as promptSnapshot
                let promptSnapshot: string | undefined;
                if (msg.role === 'ai' && index > 0) {
                  for (let i = index - 1; i >= 0; i--) {
                    if (messages[i].role === 'user') {
                      promptSnapshot = messages[i].content;
                      break;
                    }
                  }
                }
                
                return (
                  <ChatMessage 
                    key={msg.id} 
                    id={msg.id}
                    chatId={currentChatId || undefined}
                    role={msg.role as "user" | "ai"} 
                    content={msg.content} 
                    metadata={(msg as any).metadata}
                    createdAt={msg.createdAt}
                    promptSnapshot={promptSnapshot}
                  />
                );
              })}
              
              {/* 
               * AI Thinking Indicator
               * Shows animated "thinking" state while waiting for response
               */}
              {isLoading && (
                <ChatMessage role="ai" content="" isThinking={true} />
              )}
              
              {/* Scroll anchor - auto-scroll target */}
              <div ref={scrollRef} className="h-4" />
            </div>
          )}
        </div>

        {/* 
         * Input Area (Fixed at bottom)
         * Contains text input, send button, and optional voice input
         * Gradient fade effect at top blends with chat area
         */}
        <div className="w-full bg-gradient-to-t from-background via-background to-transparent pt-10 pb-6 px-4 z-20">
          <ChatInputArea 
            onSend={handleSendMessage} 
            isLoading={isLoading}
            promptHistory={messages.filter(m => m.role === 'user').map(m => m.content)}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CAT CARD CAROUSEL COMPONENT
// ============================================================================

/**
 * Cat-themed cards data for the carousel
 */
const CAT_CARDS = [
  { icon: Compass, color: "text-blue-500", bg: "bg-blue-500/10", text: "Find a cozy spot", subtext: "for the purrfect nap", prompt: "Help me find the perfect cozy spot for a relaxing afternoon nap" },
  { icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-500/10", text: "Brainstorm", subtext: "clever cat pun names", prompt: "Brainstorm clever cat pun names for a new pet or project" },
  { icon: Code2, color: "text-purple-500", bg: "bg-purple-500/10", text: "Hunt bugs", subtext: "like a cat stalking prey", prompt: "Help me hunt down and catch bugs in my code like a skilled cat" },
  { icon: Sparkles, color: "text-pink-500", bg: "bg-pink-500/10", text: "Write a poem", subtext: "about magnificent cats", prompt: "Write a poem celebrating the grace and mystery of cats" },
  { icon: PawPrint, color: "text-orange-500", bg: "bg-orange-500/10", text: "Leave your mark", subtext: "on a creative project", prompt: "Help me leave my creative mark on a new project" },
  { icon: Moon, color: "text-indigo-500", bg: "bg-indigo-500/10", text: "Midnight musings", subtext: "for night owl thinkers", prompt: "Share some midnight musings for a night owl like me" },
  { icon: Fish, color: "text-cyan-500", bg: "bg-cyan-500/10", text: "Catch ideas", subtext: "like fish in a stream", prompt: "Help me catch fresh ideas like a cat fishing" },
  { icon: Heart, color: "text-red-500", bg: "bg-red-500/10", text: "Show some love", subtext: "with a heartfelt message", prompt: "Help me write a heartfelt message" },
  { icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10", text: "Quick reflexes", subtext: "for fast solutions", prompt: "I need quick, cat-like reflexes to solve a problem fast" },
  { icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10", text: "Curious cat", subtext: "learns something new", prompt: "Teach me something interesting" },
];

/**
 * CatCardCarousel - Animated carousel of cat-themed prompt cards
 * 
 * Features:
 * - 10 cat-themed cards with different icons/colors
 * - Shows 4 cards at a time (2 on mobile)
 * - Prev/next arrows to navigate
 * - Slide animation using Framer Motion
 * - Dot indicators at the bottom
 */
function CatCardCarousel({ onSendMessage }: { onSendMessage: (content: string, attachments?: any[]) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardsPerPage = 4;
  const totalPages = Math.ceil(CAT_CARDS.length / cardsPerPage);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  const visibleCards = CAT_CARDS.slice(
    currentIndex * cardsPerPage,
    currentIndex * cardsPerPage + cardsPerPage
  );

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="absolute -left-12 top-1/2 -translate-y-1/2 z-10 hidden lg:flex hover:bg-secondary/60"
        data-testid="carousel-prev"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="absolute -right-12 top-1/2 -translate-y-1/2 z-10 hidden lg:flex hover:bg-secondary/60"
        data-testid="carousel-next"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Cards Container */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {visibleCards.map((card, idx) => {
              const IconComponent = card.icon;
              return (
                <button
                  key={`${currentIndex}-${idx}`}
                  onClick={() => onSendMessage(card.prompt, [])}
                  data-testid={`cat-card-${currentIndex * cardsPerPage + idx}`}
                  className="flex flex-col items-start p-4 h-40 bg-secondary/30 hover:bg-secondary/60 border border-transparent hover:border-primary/10 rounded-2xl transition-all duration-200 text-left group relative overflow-hidden"
                >
                  <div className={`mb-auto p-2 ${card.bg} rounded-full shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div className="mt-4">
                    <div className="font-medium text-foreground">{card.text}</div>
                    <div className="text-sm text-muted-foreground opacity-80">{card.subtext}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile Navigation */}
      <div className="flex lg:hidden justify-center gap-2 mt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          className="hover:bg-secondary/60"
          data-testid="carousel-prev-mobile"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="hover:bg-secondary/60"
          data-testid="carousel-next-mobile"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dot Indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            data-testid={`carousel-dot-${idx}`}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              idx === currentIndex
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CARD BUTTON COMPONENT
// ============================================================================

/**
 * CardButton - Clickable prompt suggestion card
 * 
 * Used on the welcome screen to provide quick-start prompts.
 * Features an icon, main text, and subtext, with hover effects.
 * 
 * Visual Design:
 * ┌──────────────────────┐
 * │ ┌────┐               │
 * │ │ 🧭 │               │  ← Icon in circular container
 * │ └────┘               │
 * │                      │
 * │ Plan a trip          │  ← Main text (bold)
 * │ to see the Northern  │  ← Subtext (muted)
 * │ Lights               │
 * └──────────────────────┘
 * 
 * @param {object} props - Component properties
 * @param {React.ReactNode} props.icon - Icon element (Lucide icon)
 * @param {string} props.text - Main text label
 * @param {string} props.subtext - Secondary descriptive text
 * @param {() => void} props.onClick - Click handler (sends prompt)
 * @param {string} props.testId - data-testid for testing
 * 
 * @returns {JSX.Element} Styled button card
 * 
 * @example
 * <CardButton
 *   icon={<Compass className="w-6 h-6 text-blue-500" />}
 *   text="Plan a trip"
 *   subtext="to see the Northern Lights"
 *   onClick={() => handleSendMessage("Plan a trip...")}
 *   testId="button-prompt-trip"
 * />
 */
function CardButton({ icon, text, subtext, onClick, testId }: { icon: React.ReactNode, text: string, subtext: string, onClick: () => void, testId: string }) {
    return (
        <button 
            onClick={onClick}
            data-testid={testId}
            className="flex flex-col items-start p-4 h-40 bg-secondary/30 hover:bg-secondary/60 border border-transparent hover:border-primary/10 rounded-2xl transition-all duration-200 text-left group relative overflow-hidden"
        >
            {/* Icon container with hover scale effect */}
            <div className="mb-auto p-2 bg-background rounded-full shadow-sm group-hover:scale-110 transition-transform duration-200">
                {icon}
            </div>
            
            {/* Text content */}
            <div className="mt-4">
                <div className="font-medium text-foreground">{text}</div>
                <div className="text-sm text-muted-foreground opacity-80">{subtext}</div>
            </div>
        </button>
    )
}
