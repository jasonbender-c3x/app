/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    MESSAGE.TSX - CHAT MESSAGE COMPONENT                       ║
 * ║                                                                               ║
 * ║  Renders individual chat messages with distinct styling for user vs AI.       ║
 * ║  Features markdown rendering, animations, and action buttons for AI messages. ║
 * ║                                                                               ║
 * ║  User Message Layout:                                                         ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │  [U]  You                                                              │  ║
 * ║  │       User's message content here...                                   │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ║                                                                               ║
 * ║  AI Message Layout:                                                           ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │  [✨]  Nebula AI  [Model 2.0]                                          │  ║
 * ║  │        AI response with **markdown** support...                        │  ║
 * ║  │        - Lists, code blocks, etc.                                      │  ║
 * ║  │        ────────────────────────────────────────────────────            │  ║
 * ║  │        [📋] [🔄]                                      [👍] [👎]        │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * Framer Motion for smooth message animations
 * - motion: Creates animated versions of HTML elements
 */
import { motion } from "framer-motion";

/**
 * Utility for conditional class names
 */
import { cn } from "@/lib/utils";

/**
 * ReactMarkdown - Renders markdown content as React components
 * Used for AI responses which may contain formatting
 * @see https://github.com/remarkjs/react-markdown
 */
import ReactMarkdown from "react-markdown";

/**
 * remark-gfm - GitHub Flavored Markdown plugin
 * Adds support for: tables, strikethrough, task lists, URLs
 */
import remarkGfm from "remark-gfm";

/**
 * Lucide Icons for action buttons
 * - Copy: Copy message to clipboard
 * - ThumbsUp/Down: Feedback buttons
 * - RefreshCw: Regenerate response
 * - File/FileCode: File operation indicators
 * - Wrench: Tool execution indicator
 * - CheckCircle/XCircle: Success/error status
 */
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, File, FileCode, Wrench, CheckCircle2, XCircle, Loader2, Terminal, Mail, Calendar } from "lucide-react";

/**
 * Button component from shadcn/ui
 */
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Tool execution result for display
 */
interface ToolResult {
  toolId: string;
  type: string;
  success: boolean;
  error?: string;
  duration?: number;
}

/**
 * File operation result for display
 */
interface FileResult {
  filename: string;
  path: string;
  action: "created" | "modified";
}

/**
 * Autoexec execution result
 */
interface AutoexecResult {
  command: string;
  output: string;
  exitCode: number;
  success: boolean;
  duration?: number;
}

/**
 * Structured message metadata
 */
interface MessageMetadata {
  toolResults?: ToolResult[];
  filesCreated?: string[];
  filesModified?: string[];
  errors?: string[];
  processingTime?: number;
  autoexecResult?: AutoexecResult;
}

/**
 * Props for the ChatMessage component
 * 
 * @property {"user" | "ai"} role - Who sent the message (affects styling)
 * @property {string} content - The message text (supports markdown for AI)
 * @property {boolean} [isThinking] - Whether to show thinking animation (AI only)
 * @property {MessageMetadata} [metadata] - Optional structured metadata for AI responses
 */
interface MessageProps {
  role: "user" | "ai";
  content: string;
  isThinking?: boolean;
  metadata?: MessageMetadata;
  createdAt?: Date | string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Strip tool call blocks from message content
 * The backend format is: [JSON tool calls]\n\n✂️🐱\n\nmarkdown content
 * This function removes everything up to and including the delimiter,
 * keeping only the clean markdown content for display.
 * Also handles legacy JSON patterns for backwards compatibility.
 */
function stripToolCalls(content: string): string {
  // Primary: Remove everything up to and including the ✂️🐱 delimiter
  // Backend format is: [JSON tool calls]\n\n✂️🐱\n\nmarkdown content
  const delimiterIndex = content.indexOf('✂️🐱');
  let cleaned = delimiterIndex !== -1 
    ? content.substring(delimiterIndex + '✂️🐱'.length).trim()
    : content;
  
  // Legacy: Remove delimited tool call blocks (🐱✂️ ... ✂️🐱)
  const delimiterPattern = /🐱✂️[\s\S]*?✂️🐱/g;
  cleaned = cleaned.replace(delimiterPattern, '');
  
  // Known tool type prefixes for targeted matching
  const toolTypePattern = '(?:github_|gmail_|calendar_|drive_|docs_|sheets_|tasks_|terminal_|tavily_|perplexity_|browserbase_|api_call|search|web_search|google_search|duckduckgo_search|browser_scrape|file_ingest|file_upload)[\\w_]*';
  
  // Remove code blocks containing tool call arrays (identified by known tool types)
  cleaned = cleaned.replace(new RegExp('```(?:json|tool_code|tool|)?\\s*\\n?\\s*\\[\\s*\\{[\\s\\S]*?"type"\\s*:\\s*"' + toolTypePattern + '"[\\s\\S]*?\\}\\s*\\]\\s*\\n?```', 'gi'), '');
  
  // Remove standalone JSON arrays containing tool calls (identified by known tool types)
  cleaned = cleaned.replace(new RegExp('\\[\\s*\\{[\\s\\S]*?"type"\\s*:\\s*"' + toolTypePattern + '"[\\s\\S]*?\\}\\s*\\]', 'gi'), '');
  
  // Remove malformed/partial JSON arrays that look like failed tool call cleanup
  cleaned = cleaned.replace(/\[\s*\n?\s*\}\s*\]/gi, '');
  
  // Remove any code blocks that contain tool-like JSON objects
  const anyCodeBlockWithJson = /```(?:json|tool_code|tool|)?\s*\n?\s*\{[\s\S]*?"type"\s*:[\s\S]*?\}\s*\n?```/gi;
  cleaned = cleaned.replace(anyCodeBlockWithJson, '');
  
  // Remove empty or near-empty tool_code blocks (```tool_code\n\n```)
  const emptyToolCodeBlock = /```tool_code\s*\n?\s*```/gi;
  cleaned = cleaned.replace(emptyToolCodeBlock, '');
  
  // Remove any empty code blocks regardless of label
  const emptyCodeBlock = /```(?:json|tool_code|tool|)?\s*```/gi;
  cleaned = cleaned.replace(emptyCodeBlock, '');
  
  // Remove partial code blocks that might be incomplete
  const partialCodeBlock = /```(?:json|tool_code|tool|)?\s*\n?\s*\{[\s\S]*$/gi;
  cleaned = cleaned.replace(partialCodeBlock, '');
  
  // Remove unfenced tool_code with JSON (tool_code: {...} or tool_code {...})
  const unfencedToolCode = /tool_code\s*[:=]?\s*\{[^}]*\}/gi;
  cleaned = cleaned.replace(unfencedToolCode, '');
  
  // Remove standalone JSON objects that look like tool calls
  const jsonToolPattern = /\{\s*"type"\s*:\s*"[\w_]+"\s*,[\s\S]*?\}/gi;
  cleaned = cleaned.replace(jsonToolPattern, '');
  
  // Remove partial JSON fragments (common with streaming)
  const partialJsonPattern = /\{\s*"(?:type|id|operation|parameters|command|max_results)"[\s\S]*$/gi;
  cleaned = cleaned.replace(partialJsonPattern, '');
  
  // Remove orphaned JSON-like keys that may leak (e.g., "operation": "...", "parameters": {})
  const orphanedJsonKeys = /"(?:operation|parameters|id|type)"\s*:\s*(?:"[^"]*"|\{[^}]*\})/gi;
  cleaned = cleaned.replace(orphanedJsonKeys, '');
  
  // Remove orphaned delimiters and backticks
  cleaned = cleaned.replace(/🐱✂️/g, '').replace(/✂️🐱/g, '');
  cleaned = cleaned.replace(/```(?:json|tool_code|tool|)?$/g, '');
  cleaned = cleaned.replace(/^```/gm, '');
  
  // Remove any remaining "tool_code" text that got left behind
  cleaned = cleaned.replace(/\btool_code\b/gi, '');
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}

// ============================================================================
// CHAT MESSAGE COMPONENT
// ============================================================================

/**
 * ChatMessage Component - Individual Message Bubble
 * 
 * Renders a single message in the chat interface with:
 * - Different avatars for user vs AI
 * - Fade-in animation on mount
 * - Markdown rendering for AI responses
 * - "Thinking" animation for loading state
 * - Action buttons for AI messages (copy, regenerate, feedback)
 * 
 * Animation:
 * - initial: Invisible and shifted down 10px
 * - animate: Fade in and slide up
 * - transition: 0.3s smooth easing
 * 
 * @param {MessageProps} props - Component properties
 * @returns {JSX.Element} The styled message bubble
 * 
 * @example
 * // User message
 * <ChatMessage role="user" content="Hello, how are you?" />
 * 
 * // AI message with markdown
 * <ChatMessage role="ai" content="I'm doing **great**! How can I help?" />
 * 
 * // AI thinking state
 * <ChatMessage role="ai" content="" isThinking={true} />
 */
function formatTimestamp(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const dayNum = d.getDate();
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dayName}, ${monthName} ${dayNum} ${year}  ${hh}.${min}.${ss}`;
}

export function ChatMessage({ role, content, isThinking, metadata, createdAt }: MessageProps) {
  const hasToolResults = !!(metadata?.toolResults?.length);
  const hasFileOps = !!(metadata?.filesCreated?.length) || !!(metadata?.filesModified?.length);
  const hasErrors = !!(metadata?.errors?.length);
  
  return (
    // Animated container with fade-in and slide-up effect
    <motion.div
      initial={{ opacity: 0, y: 10 }}    // Start invisible, 10px below
      animate={{ opacity: 1, y: 0 }}      // Animate to visible, original position
      transition={{ duration: 0.3 }}       // 300ms smooth animation
      className={cn(
        "flex w-full gap-4 p-4 md:p-6 max-w-4xl mx-auto",
        // Currently both have transparent background (can be differentiated)
        role === "user" ? "bg-transparent" : "bg-transparent"
      )}
    >
      {/* 
       * Avatar Section
       * Different design for user vs AI:
       * - User: Simple gray circle with "U"
       * - AI: Gradient purple circle with sparkle SVG
       */}
      <div className="flex-shrink-0 mt-1">
        {role === "user" ? (
          // User Avatar - Simple muted circle
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            U
          </div>
        ) : (
          // AI Avatar - Gradient with sparkle icon
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
            {/* Custom sparkles SVG icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5"
            >
              {/* Three sparkle shapes of different sizes */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* 
       * Message Content Section
       * Contains: sender name, model badge, message content, action buttons
       */}
      <div className="flex-1 space-y-2 overflow-hidden">
        {/* Header: Sender name and timestamp */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sender Name */}
          <span className="text-sm font-semibold">
            {role === "user" ? "You" : "Meowstic"}
          </span>
          
          {/* Timestamp (AI only) - Same font/size as Meowstic */}
          {role === "ai" && createdAt && (
            <span className="text-sm font-semibold text-muted-foreground">
              {formatTimestamp(createdAt)}
            </span>
          )}
        </div>

        {/* 
         * Message Body
         * Shows either:
         * - Thinking animation (3 pulsing dots)
         * - Rendered markdown content
         */}
        {isThinking ? (
          // =================================================================
          // THINKING ANIMATION
          // Three dots that pulse in sequence
          // =================================================================
          <div className="flex gap-1 items-center h-6">
            {/* Dot 1 - No delay */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0 }}
              className="w-2 h-2 bg-primary/40 rounded-full"
            />
            {/* Dot 2 - 0.2s delay */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
              className="w-2 h-2 bg-primary/40 rounded-full"
            />
            {/* Dot 3 - 0.4s delay */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
              className="w-2 h-2 bg-primary/40 rounded-full"
            />
          </div>
        ) : (
          // =================================================================
          // MARKDOWN CONTENT
          // Renders the message with full markdown support
          // =================================================================
          <div className="prose prose-neutral dark:prose-invert max-w-none markdown-content text-base leading-7 text-foreground/90">
            {/* 
             * ReactMarkdown with GitHub Flavored Markdown
             * Supports: headings, lists, code blocks, tables, links, etc.
             * Custom components override p to preserve newlines as <br/> elements
             */}
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Preserve newlines within paragraphs by converting \n to <br/>
                p: ({ children }) => {
                  // Process children to convert string content with newlines
                  const processedChildren = Array.isArray(children) 
                    ? children.flatMap((child, idx) => {
                        if (typeof child === 'string' && child.includes('\n')) {
                          return child.split('\n').flatMap((part, i, arr) => 
                            i < arr.length - 1 ? [part, <br key={`br-${idx}-${i}`} />] : [part]
                          );
                        }
                        return child;
                      })
                    : typeof children === 'string' && children.includes('\n')
                      ? children.split('\n').flatMap((part, i, arr) => 
                          i < arr.length - 1 ? [part, <br key={`br-${i}`} />] : [part]
                        )
                      : children;
                  return <p>{processedChildren}</p>;
                }
              }}
            >
              {stripToolCalls(content)}
            </ReactMarkdown>
          </div>
        )}

        {role === "ai" && !isThinking && metadata && (hasToolResults || hasFileOps || hasErrors) && (
          <div className="mt-3 space-y-2">
            {hasToolResults && metadata.toolResults && (
              <div className="flex flex-wrap gap-2">
                {metadata.toolResults.map((tool, idx) => (
                  <div
                    key={`${tool.toolId}-${idx}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                      tool.success 
                        ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    )}
                    data-testid={`tool-result-${tool.toolId}`}
                  >
                    <Wrench className="h-3 w-3" />
                    <span>{tool.type}</span>
                    {tool.success ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {tool.duration && (
                      <span className="text-muted-foreground">({tool.duration}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {hasFileOps && metadata && (
              <div className="flex flex-wrap gap-2">
                {metadata.filesCreated?.map((file, idx) => (
                  <div
                    key={`created-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    data-testid={`file-created-${idx}`}
                  >
                    <FileCode className="h-3 w-3" />
                    <span>Created: {file}</span>
                  </div>
                ))}
                {metadata.filesModified?.map((file, idx) => (
                  <div
                    key={`modified-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    data-testid={`file-modified-${idx}`}
                  >
                    <File className="h-3 w-3" />
                    <span>Modified: {file}</span>
                  </div>
                ))}
              </div>
            )}

            {hasErrors && metadata && metadata.errors && (
              <div className="space-y-1">
                {metadata.errors.map((error, idx) => (
                  <div
                    key={`error-${idx}`}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-md text-xs bg-red-500/10 text-red-600 dark:text-red-400"
                    data-testid={`error-${idx}`}
                  >
                    <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {role === "ai" && !isThinking && metadata?.autoexecResult && (
          <div className="mt-4" data-testid="terminal-output">
            <div className="rounded-lg border border-neutral-700 bg-neutral-900 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border-b border-neutral-700">
                <Terminal className="h-4 w-4 text-green-400" />
                <span className="text-xs font-medium text-neutral-300">Terminal</span>
                <div className="flex-1" />
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  metadata.autoexecResult.success 
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-red-500/20 text-red-400"
                )}>
                  {metadata.autoexecResult.success ? "Exit 0" : `Exit ${metadata.autoexecResult.exitCode}`}
                </span>
                {metadata.autoexecResult.duration && (
                  <span className="text-xs text-neutral-500">{metadata.autoexecResult.duration}ms</span>
                )}
              </div>
              <div className="p-3 font-mono text-sm">
                <div className="text-green-400 mb-2">
                  $ {metadata.autoexecResult.command}
                </div>
                <pre className="text-neutral-300 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                  {metadata.autoexecResult.output || "(no output)"}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 
         * Action Buttons (AI messages only, not during thinking)
         * Provides interaction options for the AI response
         */}
        {role === "ai" && !isThinking && (
          <div className="flex gap-2 mt-4 pt-2">
            {/* Copy to Clipboard Button */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Copy className="h-4 w-4" />
            </Button>
            
            {/* Regenerate Response Button */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            {/* Spacer to push feedback buttons to right */}
            <div className="flex-1" />
            
            {/* Thumbs Up - Positive Feedback */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <ThumbsUp className="h-4 w-4" />
            </Button>
            
            {/* Thumbs Down - Negative Feedback */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
