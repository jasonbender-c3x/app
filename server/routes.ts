/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        API ROUTES CONFIGURATION                           ║
 * ║                     Meowstik - Express Route Handlers                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * This file defines all HTTP API endpoints for the Meowstik application.
 * The routes are organized into several logical groups:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  ROUTE CATEGORIES                                                           │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  1. Chat Routes (/api/chats)      - Core chat/message CRUD + AI streaming  │
 * │  2. Drive Routes (/api/drive)     - Google Drive file operations           │
 * │  3. Gmail Routes (/api/gmail)     - Email listing, sending, searching      │
 * │  4. Calendar Routes (/api/calendar) - Calendar events management           │
 * │  5. Docs Routes (/api/docs)       - Google Docs operations                 │
 * │  6. Sheets Routes (/api/sheets)   - Google Sheets operations               │
 * │  7. Tasks Routes (/api/tasks)     - Google Tasks management                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * REQUEST/RESPONSE FLOW:
 * ┌────────────┐    ┌─────────────────┐    ┌───────────────────┐
 * │   Client   │───▶│  Express Route  │───▶│  Storage/Service  │
 * │  Request   │    │   (Validation)  │    │   (Integration)   │
 * └────────────┘    └─────────────────┘    └───────────────────┘
 *                            │                       │
 *                            ▼                       ▼
 *                   ┌─────────────────┐    ┌───────────────────┐
 *                   │   JSON Response │◀───│   Database/API    │
 *                   │   (or SSE)      │    │   (PostgreSQL/    │
 *                   └─────────────────┘    │    Google APIs)   │
 *                                          └───────────────────┘
 *
 * ERROR HANDLING STRATEGY:
 * - All routes wrapped in try/catch blocks
 * - 400 errors for validation failures (bad input)
 * - 404 errors for resource not found
 * - 500 errors for server/integration failures
 * - Detailed error logging to console for debugging
 *
 * @module routes
 * @requires express - HTTP server framework
 * @requires storage - Database abstraction layer
 * @requires @google/genai - Google Gemini AI SDK
 * @requires ./integrations/* - Google Workspace service integrations
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Express type for the application instance.
 * Used for registering route handlers (app.get, app.post, etc.)
 */
import type { Express } from "express";

/**
 * HTTP server creation utility and Server type.
 * The httpServer is passed through and returned to enable WebSocket attachment later.
 */
import { createServer, type Server } from "http";

/**
 * Storage abstraction layer for database operations.
 * Provides type-safe CRUD methods for chats and messages.
 */
import { storage } from "./storage";

/**
 * RAG service for processing document attachments.
 * Chunks and vectorizes documents for retrieval augmented generation.
 */
import { ragService } from "./services/rag-service";

/**
 * Zod validation schemas for request body validation.
 * - insertChatSchema: Validates chat creation requests
 * - insertMessageSchema: Validates message creation requests
 */
import { insertChatSchema, insertMessageSchema } from "@shared/schema";

/**
 * Google Generative AI SDK for Gemini model interactions.
 * Provides streaming text generation capabilities.
 */
import { GoogleGenAI } from "@google/genai";

/**
 * Prompt Composer for building system prompts from modular components.
 * Assembles core directives, personality, tools, and RAG context.
 */
import { promptComposer } from "./services/prompt-composer";
import { ragDispatcher } from "./services/rag-dispatcher";
import { structuredLLMResponseSchema, type ToolCall } from "@shared/schema";

import { createApiRouter } from "./routes/index";

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: AI CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google Generative AI client instance.
 *
 * Configured with GEMINI_API_KEY from environment variables.
 * This client is used for all AI chat interactions in the application.
 *
 * The '!' operator asserts that GEMINI_API_KEY is defined (non-null assertion).
 * The key should be set in the environment or the application will fail.
 *
 * @see https://ai.google.dev/tutorials/node_quickstart
 */
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registers all API routes on the Express application.
 *
 * This function is called during server startup and attaches all route handlers
 * to the Express app instance. It receives the HTTP server to allow for
 * potential WebSocket server attachment later.
 *
 * @param httpServer - The HTTP server instance (passed through for WebSocket support)
 * @param app - The Express application instance to register routes on
 * @returns Promise<Server> - The same HTTP server instance (enables chaining)
 *
 * @example
 * // In server/index.ts:
 * const httpServer = createServer(app);
 * await registerRoutes(httpServer, app);
 * httpServer.listen(5000);
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ══════════════════════════════════}��══════════════════════════════════════
  // REPLIT AUTH SETUP
  // Sets up session management and OAuth flow with Replit as the identity provider
  // ═════════════════════════════════════════════════════════════════════════
  const { setupAuth, isAuthenticated } = await import("./replitAuth");
  await setupAuth(app);

  // Auth user endpoint - returns the current user's profile
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHAT API ROUTES
  // Base path: /api/chats
  //
  // These routes handle the core chat functionality:
  // - Creating new chat conversations
  // - Listing all chats for the user
  // - Getting chat details with message history
  // - Updating chat titles
  // - Sending messages and receiving AI responses (streaming)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/chats
   * Create a new chat conversation.
   *
   * Request Body:
   * - title: string (optional) - The title for the new chat
   *
   * Response: Created Chat object
   * - id: string (UUID)
   * - title: string
   * - createdAt: timestamp
   * - updatedAt: timestamp
   *
   * @route POST /api/chats
   * @returns {Chat} 200 - The newly created chat
   * @returns {Error} 400 - Invalid request body
   */
  app.post("/api/chats", async (req, res) => {
    try {
      // Validate request body against Zod schema
      // This ensures type safety and proper data structure
      const validatedData = insertChatSchema.parse(req.body);

      // Create chat in database via storage layer
      const chat = await storage.createChat(validatedData);

      // Return created chat as JSON response
      res.json(chat);
    } catch (error) {
      // Validation errors or database errors return 400 Bad Request
      console.error("[POST /api/chats] Error creating chat:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  /**
   * GET /api/chats
   * Retrieve all chat conversations.
   *
   * Returns chats ordered by most recently updated first.
   *
   * @route GET /api/chats
   * @returns {Chat[]} 200 - Array of all chat objects
   * @returns {Error} 500 - Server error fetching chats
   */
  app.get("/api/chats", async (req, res) => {
    try {
      // Fetch all chats from storage layer
      const chats = await storage.getChats();
      res.json(chats);
    } catch (error) {
      console.error("[GET /api/chats] Error fetching chats:", error);
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  });

  /**
   * GET /api/chats/:id
   * Get a specific chat with its recent message history (paginated).
   *
   * Path Parameters:
   * - id: string (UUID) - The chat ID to retrieve
   *
   * Query Parameters:
   * - limit: number (optional) - Max messages to return (default: 30)
   * - before: string (optional) - Message ID cursor for loading older messages
   *
   * Response:
   * - chat: Chat object with metadata
   * - messages: Array of Message objects (most recent, chronologically ordered)
   * - hasMore: boolean indicating if older messages exist
   *
   * @route GET /api/chats/:id
   * @param {string} id - Chat UUID
   * @returns {Object} 200 - { chat: Chat, messages: Message[], hasMore: boolean }
   * @returns {Error} 404 - Chat not found
   * @returns {Error} 500 - Server error
   */
  app.get("/api/chats/:id", async (req, res) => {
    try {
      // First, fetch the chat metadata
      const chat = await storage.getChatById(req.params.id);

      // Return 404 if chat doesn't exist
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Parse pagination params (default: last 30 messages)
      const limit = parseInt(req.query.limit as string) || 30;
      const before = req.query.before as string | undefined;
      
      // Fetch paginated messages (+1 to check if more exist)
      const messages = await storage.getMessagesByChatId(req.params.id, { 
        limit: limit + 1, 
        before 
      });
      
      // Check if there are more messages to load
      const hasMore = messages.length > limit;
      const returnMessages = hasMore ? messages.slice(1) : messages; // Remove oldest if over limit

      // Return chat metadata, paginated messages, and hasMore flag
      res.json({ chat, messages: returnMessages, hasMore });
    } catch (error) {
      console.error(
        `[GET /api/chats/${req.params.id}] Error fetching chat:`,
        error,
      );
      res.status(500).json({ error: "Failed to fetch chat" });
    }
  });
  
  /**
   * GET /api/chats/:id/messages
   * Get paginated messages for a chat (for loading older history).
   *
   * Query Parameters:
   * - limit: number (optional) - Max messages to return (default: 30)
   * - before: string (required) - Message ID cursor for loading older messages
   *
   * @route GET /api/chats/:id/messages
   * @returns {Object} 200 - { messages: Message[], hasMore: boolean }
   */
  app.get("/api/chats/:id/messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const before = req.query.before as string;
      
      if (!before) {
        return res.status(400).json({ error: "before cursor required" });
      }
      
      // Fetch messages before cursor (+1 to check if more exist)
      const messages = await storage.getMessagesByChatId(req.params.id, { 
        limit: limit + 1, 
        before 
      });
      
      const hasMore = messages.length > limit;
      const returnMessages = hasMore ? messages.slice(1) : messages;
      
      res.json({ messages: returnMessages, hasMore });
    } catch (error) {
      console.error(`[GET /api/chats/${req.params.id}/messages] Error:`, error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  /**
   * PATCH /api/chats/:id
   * Update a chat's title.
   *
   * Path Parameters:
   * - id: string (UUID) - The chat ID to update
   *
   * Request Body:
   * - title: string (required) - New title for the chat
   *
   * @route PATCH /api/chats/:id
   * @param {string} id - Chat UUID
   * @returns {Object} 200 - { success: true }
   * @returns {Error} 400 - Title is required
   * @returns {Error} 500 - Server error
   */
  app.patch("/api/chats/:id", async (req, res) => {
    try {
      // Extract title from request body
      const { title } = req.body;

      // Validate that title is provided
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      // Update chat title in database
      await storage.updateChatTitle(req.params.id, title);

      res.json({ success: true });
    } catch (error) {
      console.error(
        `[PATCH /api/chats/${req.params.id}] Error updating chat:`,
        error,
      );
      res.status(500).json({ error: "Failed to update chat" });
    }
  });

  /**
   * POST /api/chats/:id/messages
   * Send a message and receive streaming AI response.
   *
   * This is the core AI chat endpoint. It:
   * 1. Saves the user's message to the database
   * 2. Builds conversation history for context
   * 3. Streams AI response using Server-Sent Events (SSE)
   * 4. Saves the complete AI response to database
   *
   * STREAMING PROTOCOL (Server-Sent Events):
   * - Content-Type: text/event-stream
   * - Each chunk: data: {"text": "..."}\n\n
   * - Final event: data: {"done": true}\n\n
   *
   * Path Parameters:
   * - id: string (UUID) - Chat ID to add message to
   *
   * Request Body:
   * - content: string (required) - The user's message text
   *
   * @route POST /api/chats/:id/messages
   * @param {string} id - Chat UUID
   * @returns {Stream} 200 - SSE stream of AI response chunks
   * @returns {Error} 500 - Streaming/AI error
   */
  app.post("/api/chats/:id/messages", async (req, res) => {
    const startTime = Date.now();
    try {
      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Validate and save user's message
      // ─────────────────────────────────────────────────────────────────────

      // Validate message structure with Zod schema
      // Note: content defaults to empty string to support image-only messages
      const userMessage = insertMessageSchema.parse({
        chatId: req.params.id, // From URL parameter
        role: "user", // Messages from this endpoint are always user messages
        content: req.body.content || "",
      });

      // Persist user message to database and get the saved message with ID
      const savedMessage = await storage.addMessage(userMessage);

      // Ingest user message for RAG recall (async, don't block)
      // Pass userId for data isolation - guests use "guest" bucket
      const userId = (req as any).user?.claims?.sub || null;
      ragService
        .ingestMessage(
          userMessage.content,
          req.params.id,
          savedMessage.id,
          "user",
          undefined,
          userId,
        )
        .catch((error) => {
          console.error(
            `[RAG] Failed to ingest user message ${savedMessage.id}:`,
            error,
          );
        });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1.5: Process and save any attachments
      // ─────────────────────────────────────────────────────────────────────

      const reqAttachments = Array.isArray(req.body.attachments)
        ? req.body.attachments
        : [];
      for (const att of reqAttachments) {
        // Determine content: prefer explicit content field, fallback to dataUrl
        let content = att.content || "";

        // If no direct content but dataUrl exists, extract content
        if (!content && att.dataUrl) {
          const dataUrl = att.dataUrl;
          if (dataUrl.includes(",")) {
            const base64Part = dataUrl.split(",")[1];
            const isTextFile =
              att.mimeType?.startsWith("text/") ||
              att.mimeType === "application/json" ||
              att.mimeType === "application/xml" ||
              att.mimeType === "application/javascript";

            if (isTextFile) {
              // Decode base64 for text files to store readable content
              try {
                content = Buffer.from(base64Part, "base64").toString("utf-8");
              } catch {
                content = base64Part;
              }
            } else {
              // Store base64 for binary files (images, audio, etc.)
              content = base64Part;
            }
          }
        }

        // Sanitize content to remove null bytes that PostgreSQL text columns can't store
        // Null bytes (0x00) cause "invalid byte sequence for encoding UTF8" errors
        const sanitizedContent = content.replace(/\x00/g, "");

        // Save attachment to database
        let savedAttachment;
        try {
          savedAttachment = await storage.createAttachment({
            messageId: savedMessage.id,
            type: att.type || "file",
            filename: att.filename || "unnamed",
            mimeType: att.mimeType,
            size: att.size,
            content: sanitizedContent,
          });
        } catch (attachmentError) {
          console.error(
            `Failed to save attachment ${att.filename}:`,
            attachmentError,
          );
          // Continue processing without this attachment rather than failing the whole message
          continue;
        }

        // Process for RAG (chunking and vectorization) asynchronously
        // Only text-based files will be ingested
        ragService.processAttachment(savedAttachment).catch((error) => {
          console.error(`RAG processing failed for ${att.filename}:`, error);
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Build conversation history for AI context
      // ─────────────────────────────────────────────────────────────────────
      
      // OPTIMIZATION: Only fetch a small recent window for immediate context.
      // RAG (in PromptComposer) handles retrieving relevant older context.
      // This prevents loading massive tool outputs that bloat token usage.
      const RECENT_WINDOW = 4; // Last 4 messages for conversational flow
      const MAX_CONTENT_LENGTH = 2000; // Truncate long messages
      
      // Fetch only recent messages (not all history)
      const chatMessages = await storage.getMessagesByChatId(req.params.id, { 
        limit: RECENT_WINDOW + 1 // +1 because we exclude the current message
      });

      // IMPORTANT: Exclude the current message we just saved, since we'll add it separately
      // This prevents the user's message from being sent to the AI twice
      const previousMessages = chatMessages.filter(
        (msg) => msg.id !== savedMessage.id,
      );

      // Transform to Gemini API format with content truncation:
      // - "user" role stays as "user"
      // - "ai" role becomes "model" (Gemini terminology)
      // - Truncate long messages to prevent token overflow from tool outputs
      // - Include tool results from the most recent AI message for continuity
      const history = previousMessages.map((msg, index) => {
        let content = msg.content;
        
        // For the most recent AI message, include tool results from metadata
        // This ensures tool output is available for the next user prompt
        const isLastAiMessage = msg.role === "ai" && 
          index === previousMessages.length - 1;
        const metadata = msg.metadata as { toolResults?: Array<{ type: string; result: unknown; success: boolean }> } | null;
        
        if (isLastAiMessage && metadata?.toolResults?.length) {
          // Append tool results to the most recent AI message (up to 5000 chars per tool)
          const toolSummary = metadata.toolResults
            .filter(tr => tr.success)
            .map(tr => `[Tool ${tr.type} returned: ${JSON.stringify(tr.result).slice(0, 5000)}]`)
            .join("\n");
          content = content + "\n\n" + toolSummary;
        } else if (content.length > MAX_CONTENT_LENGTH) {
          // Truncate older messages if too long
          content = content.slice(0, MAX_CONTENT_LENGTH) + "\n...[truncated for context]";
        }
        
        return {
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: content }],
        };
      });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Configure SSE (Server-Sent Events) headers
      // ─────────────────────────────────────────────────────────────────────

      // These headers tell the browser to expect a continuous stream
      res.setHeader("Content-Type", "text/event-stream"); // SSE MIME type
      res.setHeader("Cache-Control", "no-cache"); // Don't cache the stream
      res.setHeader("Connection", "keep-alive"); // Keep connection open

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3.5: Compose system prompt using PromptComposer
      // ─────────────────────────────────────────────────────────────────────

      // Get saved attachments for this message
      const savedAttachments = await storage.getAttachmentsByMessageId(
        savedMessage.id,
      );

      // Use PromptComposer to build the complete system prompt with:
      // - Core directives from prompts/core-directives.md
      // - Personality from prompts/personality.md
      // - Tools from prompts/tools.md
      // - RAG context from relevant document chunks
      // - Contextual instructions based on attachments
      // Get verbosity mode from client (mute, quiet, verbose, experimental)
      const verbosityMode = req.body.verbosityMode || "mute";
      const useVoice = verbosityMode !== "mute";
      
      const composedPrompt = await promptComposer.compose({
        textContent: req.body.content || "",
        voiceTranscript: "",
        attachments: savedAttachments,
        history: chatMessages,
        chatId: req.params.id,
        userId: userId, // Pass userId for data isolation in RAG context
      });
      
      // Add voice instructions if voice mode is enabled
      let finalSystemPrompt = composedPrompt.systemPrompt;
      if (useVoice) {
        const voiceInstruction = `
## VOICE MODE ENABLED
The user has voice output enabled. You MUST use the \`say\` tool to speak your responses.
- Use \`say\` with your response text BEFORE calling \`send_chat\`
- Both tools can be called in the same turn
- Example: {"toolCalls": [{"type": "say", "id": "s1", "parameters": {"utterance": "Here's what I found..."}}, {"type": "send_chat", "id": "c1", "parameters": {"content": "Here's what I found..."}}]}
`;
        finalSystemPrompt = voiceInstruction + "\n\n" + finalSystemPrompt;
      }
      
      // Replace composedPrompt.systemPrompt with our modified version
      const modifiedPrompt = { ...composedPrompt, systemPrompt: finalSystemPrompt };

      console.log(
        `System prompt composed: ${composedPrompt.systemPrompt.length} chars, ${composedPrompt.attachments.length} attachments`,
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: Call Gemini AI with streaming and system instruction
      // ─────────────────────────────────────────────────────────────────────

      // Build parts array for the current user message (text + any images)
      const userParts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      // Add the text content
      if (req.body.content) {
        userParts.push({ text: req.body.content });
      }

      // Add all attachments for multimodal input
      for (const att of reqAttachments) {
        if (att.dataUrl && att.mimeType) {
          // Extract base64 data from dataUrl
          const base64Match = att.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            userParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: base64Match[1],
              },
            });
          }
        }
      }

      // Fallback if no content was added
      if (userParts.length === 0) {
        userParts.push({ text: "" });
      }

      // Determine model based on user preference: "pro" = gemini-2.5-pro, "flash" = gemini-2.5-flash
      const modelMode =
        req.body.model === "flash"
          ? "gemini-2.5-flash"
          : "gemini-2.5-pro";
      console.log(
        `[Routes] Using model: ${modelMode} (mode: ${req.body.model || "pro"})`,
      );
      
      // Log the user message for debugging
      const userMsgText = req.body.content || "";
      console.log(`\n${"=".repeat(60)}`);
      console.log(`[LLM] USER MESSAGE:`);
      console.log(`${"─".repeat(60)}`);
      console.log(userMsgText.slice(0, 500) + (userMsgText.length > 500 ? "..." : ""));
      console.log(`${"=".repeat(60)}\n`);

      const result = await genAI.models.generateContentStream({
        model: modelMode,
        // Pass the composed system prompt via systemInstruction parameter
        config: {
          systemInstruction: modifiedPrompt.systemPrompt,
        },
        // Include full history plus the new user message with text and media
        contents: [...history, { role: "user", parts: userParts }],
      });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: Stream AI response and parse structured JSON
      // ─────────────────────────────────────────────────────────────────────

      // Helper to strip markdown code fences and extract JSON from response
      // Robust parser that handles LLM adding text before JSON
      const stripCodeFences = (text: string): string => {
        let result = text.trim();
        
        // Strip opening fence (```json, ```JSON, ``` etc.)
        const openFenceMatch = result.match(/^```(?:json|JSON)?\s*\n?/);
        if (openFenceMatch) {
          result = result.slice(openFenceMatch[0].length);
        }
        // Strip closing fence
        const closeFenceMatch = result.match(/\n?```\s*$/);
        if (closeFenceMatch) {
          result = result.slice(0, -closeFenceMatch[0].length);
        }
        result = result.trim();
        
        // If it already starts with { or [, return as-is
        if (result.startsWith('{') || result.startsWith('[')) {
          return result;
        }
        
        // LLM sometimes adds conversational text before JSON - find the JSON start
        const firstBrace = result.indexOf('{');
        const firstBracket = result.indexOf('[');
        
        let jsonStart = -1;
        if (firstBrace !== -1 && firstBracket !== -1) {
          jsonStart = Math.min(firstBrace, firstBracket);
        } else if (firstBrace !== -1) {
          jsonStart = firstBrace;
        } else if (firstBracket !== -1) {
          jsonStart = firstBracket;
        }
        
        if (jsonStart > 0) {
          console.log(`[Routes] Stripped ${jsonStart} chars of preamble before JSON`);
          result = result.substring(jsonStart);
        }
        
        return result;
      };

      let fullResponse = "";
      let cleanContentForStorage = "";
      const toolResults: Array<{
        toolId: string;
        type: string;
        success: boolean;
        result?: unknown;
        error?: string;
      }> = [];
      let usageMetadata:
        | {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          }
        | undefined;

      // Simplified streaming: Stream text with minimal tail buffer to suppress tool JSON
      // New format: Text first, then optional {"toolCalls": [...]} at end
      // Strategy: Keep small tail buffer, flush text minus tail, suppress tool JSON
      let parsedResponse: { toolCalls?: ToolCall[] } | null = null;
      let tailBuffer = ""; // Small tail buffer to catch start of tool JSON
      const TAIL_SIZE = 20; // Only need to catch '{"toolCalls"' which is 13 chars
      const JSON_MARKER = '{"toolCalls"';
      let foundJsonMarker = false;
      
      for await (const chunk of result) {
        const text = chunk.text || "";
        fullResponse += text;

        // Capture usage metadata from the final chunk
        if (chunk.usageMetadata) {
          usageMetadata = chunk.usageMetadata;
        }

        if (!text) continue;

        // If we already found JSON marker, buffer everything (don't stream)
        if (foundJsonMarker) {
          tailBuffer += text;
          continue;
        }

        // Add to tail buffer
        tailBuffer += text;
        
        // Check for JSON marker in buffer
        const markerIndex = tailBuffer.indexOf(JSON_MARKER);
        if (markerIndex >= 0) {
          // Found tool JSON - stream text before marker, hold the rest
          foundJsonMarker = true;
          const textToStream = tailBuffer.substring(0, markerIndex);
          if (textToStream.length > 0) {
            cleanContentForStorage += textToStream;
            res.write(`data: ${JSON.stringify({ text: textToStream })}\n\n`);
          }
          tailBuffer = tailBuffer.substring(markerIndex);
          continue;
        }
        
        // No marker found - flush all but tail portion
        if (tailBuffer.length > TAIL_SIZE) {
          const flushLength = tailBuffer.length - TAIL_SIZE;
          const textToStream = tailBuffer.substring(0, flushLength);
          cleanContentForStorage += textToStream;
          res.write(`data: ${JSON.stringify({ text: textToStream })}\n\n`);
          tailBuffer = tailBuffer.substring(flushLength);
        }
      }
      
      // Process remaining tail buffer (normal case - no JSON marker found)
      if (tailBuffer.length > 0 && !foundJsonMarker) {
        // No JSON found - stream remaining buffer (including whitespace)
        cleanContentForStorage += tailBuffer;
        res.write(`data: ${JSON.stringify({ text: tailBuffer })}\n\n`);
        tailBuffer = "";
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5b: Extract JSON tools from end of response
      // ─────────────────────────────────────────────────────────────────────

      // Try to extract JSON tool block from end of full response
      const jsonMatch = fullResponse.match(/\{[\s\S]*"toolCalls"[\s\S]*\}$/);
      let toolsExtracted = false;
      
      if (jsonMatch) {
        try {
          const stripped = stripCodeFences(jsonMatch[0]);
          const jsonData = JSON.parse(stripped);
          const validation = structuredLLMResponseSchema.safeParse(jsonData);
          if (validation.success && validation.data.toolCalls && validation.data.toolCalls.length > 0) {
            parsedResponse = validation.data;
            toolsExtracted = true;
            // Update stored content to exclude JSON block (preserve all whitespace)
            cleanContentForStorage = fullResponse.substring(0, fullResponse.lastIndexOf(jsonMatch[0]));
            // Send cleanup event to remove JSON from display
            res.write(`data: ${JSON.stringify({ finalContent: cleanContentForStorage })}\n\n`);
            console.log(`[Routes] Extracted ${validation.data.toolCalls.length} tool calls from response`);
          }
        } catch (e) {
          console.log("[Routes] Found JSON-like block but failed to parse");
        }
      }
      
      // If we withheld content but didn't extract valid tools, recover natural text
      // Strategy: JSON-grammar scan - find first char that cannot be JSON and stream from there
      if (foundJsonMarker && !toolsExtracted && tailBuffer.length > 0) {
        console.log("[Routes] Processing malformed JSON block:", tailBuffer.length, "chars");
        
        const afterMarker = tailBuffer.substring(JSON_MARKER.length);
        
        // findFirstNonJsonIndex: Find prose after JSON structure ends
        // Buffer starts after '{"toolCalls"' so we expect ': [...]' or ': [...]}' followed by optional prose
        // We're inside the toolCalls object, so depth starts at 1
        const findFirstNonJsonIndex = (buffer: string): number => {
          let i = 0;
          let depth = 1; // We're already inside {"toolCalls" so start at depth 1
          let inString = false;
          
          // Skip leading colon and whitespace (the ': ' after "toolCalls")
          while (i < buffer.length && (buffer[i] === ':' || /\s/.test(buffer[i]))) {
            i++;
          }
          
          while (i < buffer.length) {
            const c = buffer[i];
            
            // Track string state
            if (c === '"' && (i === 0 || buffer[i - 1] !== '\\')) {
              inString = !inString;
              i++;
              continue;
            }
            
            if (inString) {
              i++;
              continue;
            }
            
            // Track nesting depth
            if (c === '{' || c === '[') {
              depth++;
              i++;
              continue;
            }
            
            if (c === '}' || c === ']') {
              depth--;
              i++;
              // After closing the entire toolCalls block (depth 0), everything following is prose
              if (depth <= 0) {
                // Skip any trailing whitespace to find start of prose
                while (i < buffer.length && /\s/.test(buffer[i])) i++;
                return i < buffer.length ? i : -1;
              }
              continue;
            }
            
            // Inside JSON structure - skip valid JSON content
            if (depth > 0) {
              // Skip structural chars, whitespace, colons, commas
              if (':,'.includes(c) || /\s/.test(c)) {
                i++;
                continue;
              }
              // Skip numbers
              if ('-0123456789'.includes(c)) {
                while (i < buffer.length && /[-+0-9.eE]/.test(buffer[i])) i++;
                continue;
              }
              // Skip literals
              if (buffer.substring(i, i + 4) === 'true') { i += 4; continue; }
              if (buffer.substring(i, i + 5) === 'false') { i += 5; continue; }
              if (buffer.substring(i, i + 4) === 'null') { i += 4; continue; }
            }
            
            // Outside JSON structure or unrecognized - this is prose
            return i;
          }
          
          return -1; // Entire buffer consumed (incomplete or complete JSON, no prose)
        }
        
        const proseStart = findFirstNonJsonIndex(afterMarker);
        
        // Stream recovered text if we found prose (preserve ALL content including whitespace)
        if (proseStart >= 0 && proseStart < afterMarker.length) {
          const recoveredText = afterMarker.substring(proseStart);
          if (recoveredText.length > 0) {
            cleanContentForStorage += recoveredText;
            res.write(`data: ${JSON.stringify({ text: recoveredText })}\n\n`);
            console.log("[Routes] Recovered text from malformed JSON:", recoveredText.length, "chars");
          }
        } else {
          // No recoverable prose - this is pure/incomplete JSON, discard silently
          console.log("[Routes] No prose found in malformed block, discarding JSON");
        }
        
        tailBuffer = ""; // Clear buffer
      }

      // Detect error patterns in markdown format - treat as uncaught exception
      const errorPatterns = [
        /^#+\s*Error/im,                          // # Error, ## Error, etc.
        /^Error:/im,                              // Error: message
        /I apologize.*error/i,                    // "I apologize" + error
        /I cannot.*because/i,                     // "I cannot" + reason
        /failed to (parse|process|execute)/i,    // failed to X
        /exception occurred/i,                   // exception occurred
        /unexpected (error|exception)/i,         // unexpected error/exception
        /internal error/i,                       // internal error
      ];
      
      const responseText = cleanContentForStorage || fullResponse;
      const isErrorResponse = errorPatterns.some(pattern => pattern.test(responseText));
      
      if (isErrorResponse && !parsedResponse) {
        console.error(`[Routes] UNCAUGHT EXCEPTION: AI returned error in markdown format`);
        console.error(`[Routes] Response: ${responseText.substring(0, 500)}`);
        
        // Send error event to client
        res.write(`data: ${JSON.stringify({ 
          error: true, 
          errorType: "ai_error_response",
          message: "The AI encountered an error and could not complete the request",
          details: responseText.substring(0, 1000)
        })}\n\n`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // AGENTIC LOOP: Execute tools repeatedly until send_chat terminates
      // ─────────────────────────────────────────────────────────────────────
      
      let loopIteration = 0;
      const MAX_LOOP_ITERATIONS = 10; // Safety limit to prevent infinite loops
      let sendChatContent: string | null = null;
      let agenticHistory = [...history, { role: "user", parts: userParts }];
      
      // Helper function to execute tools and return results
      const executeToolsAndGetResults = async (
        toolCalls: ToolCall[],
        messageId: string
      ): Promise<{ results: typeof toolResults; sendChatContent: string | null }> => {
        const results: typeof toolResults = [];
        let chatContent: string | null = null;
        
        for (const toolCall of toolCalls) {
          console.log(`[Routes] Executing tool call: ${toolCall.type} (${toolCall.id})`);
          try {
            const toolResult = await ragDispatcher.executeToolCall(toolCall, messageId);
            results.push({
              toolId: toolResult.toolId,
              type: toolResult.type,
              success: toolResult.success,
              result: toolResult.result,
              error: toolResult.error,
            });

            // Send tool result to client
            res.write(
              `data: ${JSON.stringify({
                toolResult: {
                  id: toolCall.id,
                  type: toolCall.type,
                  success: toolResult.success,
                  result: toolResult.result,
                  error: toolResult.error,
                },
              })}\n\n`,
            );
            
            // Check for send_chat - this terminates the agentic loop
            if (toolCall.type === "send_chat" && toolResult.success) {
              const sendChatResult = toolResult.result as { content?: string };
              if (sendChatResult?.content) {
                chatContent = sendChatResult.content;
                // Stream the send_chat content to the client
                res.write(`data: ${JSON.stringify({ text: sendChatResult.content })}\n\n`);
              }
            }
            
            // Special handling for say tool - send speech event for HD audio playback
            if (toolCall.type === "say" && toolResult.success) {
              const sayResult = toolResult.result as { 
                audioBase64?: string; 
                mimeType?: string; 
                duration?: number;
                utterance?: string;
              };
              if (sayResult?.audioBase64) {
                console.log(`[Routes] Sending speech event for HD audio, length: ${sayResult.audioBase64.length}`);
                res.write(
                  `data: ${JSON.stringify({
                    speech: {
                      utterance: sayResult.utterance || "",
                      audioGenerated: true,
                      audioBase64: sayResult.audioBase64,
                      mimeType: sayResult.mimeType || "audio/mpeg",
                      duration: sayResult.duration,
                    },
                  })}\n\n`,
                );
              } else {
                console.log(`[Routes] say tool succeeded but no audioBase64 in result`);
              }
            }
          } catch (err: any) {
            console.error(`[Routes] Tool execution error:`, err);
            results.push({
              toolId: toolCall.id,
              type: toolCall.type,
              success: false,
              error: err.message,
            });
            res.write(
              `data: ${JSON.stringify({
                toolResult: {
                  id: toolCall.id,
                  type: toolCall.type,
                  success: false,
                  error: err.message,
                },
              })}\n\n`,
            );
          }
        }
        
        return { results, sendChatContent: chatContent };
      };
      
      // Execute initial tool calls if we parsed any
      if (parsedResponse && parsedResponse.toolCalls && parsedResponse.toolCalls.length > 0) {
        // Log all tool calls for debugging
        console.log(`\n${"=".repeat(60)}`);
        console.log(`[LLM] AI RESPONSE (Turn ${loopIteration}) - ${parsedResponse.toolCalls.length} TOOL CALLS:`);
        console.log(`${"─".repeat(60)}`);
        for (const tc of parsedResponse.toolCalls) {
          console.log(`  • ${tc.type} (${tc.id})`);
        }
        console.log(`${"=".repeat(60)}\n`);
        
        // Execute tools
        const execResult = await executeToolsAndGetResults(parsedResponse.toolCalls, savedMessage.id);
        toolResults.push(...execResult.results);
        sendChatContent = execResult.sendChatContent;
        
        // Add model response to agentic history
        agenticHistory.push({ role: "model", parts: [{ text: fullResponse }] });
        
        // AGENTIC LOOP: Continue if send_chat was NOT called
        while (!sendChatContent && loopIteration < MAX_LOOP_ITERATIONS) {
          loopIteration++;
          console.log(`\n${"═".repeat(60)}`);
          console.log(`[AGENTIC LOOP] Turn ${loopIteration} - Feeding tool results back to LLM`);
          console.log(`${"═".repeat(60)}\n`);
          
          // Build tool results message for the LLM (compact, strip large binary data)
          const lastToolCount = parsedResponse?.toolCalls?.length || 0;
          const toolResultsText = toolResults
            .slice(-lastToolCount) // Only include results from last turn
            .map(r => {
              // Strip large binary data from results before sending back to LLM
              let resultSummary: unknown = r.result;
              if (typeof r.result === "object" && r.result !== null) {
                const res = r.result as Record<string, unknown>;
                // Remove known large binary fields to save tokens
                const sanitized = { ...res };
                if ("audioBase64" in sanitized) {
                  sanitized.audioBase64 = "[audio generated]";
                }
                if ("base64" in sanitized) {
                  sanitized.base64 = "[binary data]";
                }
                if ("screenshot" in sanitized && typeof sanitized.screenshot === "string" && (sanitized.screenshot as string).length > 100) {
                  sanitized.screenshot = "[screenshot captured]";
                }
                if ("content" in sanitized && typeof sanitized.content === "string" && (sanitized.content as string).length > 2000) {
                  sanitized.content = (sanitized.content as string).substring(0, 2000) + "... [truncated]";
                }
                resultSummary = sanitized;
              }
              // Compact output format
              const summary = r.success ? JSON.stringify(resultSummary) : `ERROR: ${r.error}`;
              return `• ${r.type}: ${summary.length > 500 ? summary.substring(0, 500) + "..." : summary}`;
            })
            .join("\n");
          
          // Add tool results as a "model" response followed by concise tool feedback
          // Use function-call result format that LLMs understand better
          agenticHistory.push({
            role: "model",
            parts: [{ text: `{"toolCalls": ${JSON.stringify(parsedResponse?.toolCalls || [])}}` }]
          });
          agenticHistory.push({
            role: "user", 
            parts: [{ text: `Tool results:\n${toolResultsText}\n\nContinue with more tools or call send_chat to respond.` }]
          });
          
          // Call LLM again
          const loopResult = await genAI.models.generateContentStream({
            model: modelMode,
            config: { systemInstruction: modifiedPrompt.systemPrompt },
            contents: agenticHistory,
          });
          
          // Parse the response
          let loopResponse = "";
          let loopParsedResponse: { toolCalls?: ToolCall[] } | null = null;
          
          for await (const chunk of loopResult) {
            const text = chunk.text || "";
            loopResponse += text;
            if (chunk.usageMetadata) {
              usageMetadata = chunk.usageMetadata;
            }
          }
          
          fullResponse += `\n\n[Turn ${loopIteration}]\n${loopResponse}`;
          
          // Try to parse tool calls from response
          const jsonMatch = loopResponse.match(/\{"toolCalls"\s*:\s*\[[\s\S]*\]\s*\}/);
          if (jsonMatch) {
            try {
              loopParsedResponse = JSON.parse(stripCodeFences(jsonMatch[0]));
            } catch (e) {
              console.error(`[AGENTIC LOOP] Failed to parse tool JSON:`, e);
            }
          }
          
          if (loopParsedResponse?.toolCalls && loopParsedResponse.toolCalls.length > 0) {
            console.log(`[AGENTIC LOOP] Turn ${loopIteration} - ${loopParsedResponse.toolCalls.length} tool calls`);
            for (const tc of loopParsedResponse.toolCalls) {
              console.log(`  • ${tc.type} (${tc.id})`);
            }
            
            // Execute tools
            const loopExecResult = await executeToolsAndGetResults(loopParsedResponse.toolCalls, savedMessage.id);
            toolResults.push(...loopExecResult.results);
            sendChatContent = loopExecResult.sendChatContent;
            
            // Update history for next iteration
            agenticHistory.push({ role: "model", parts: [{ text: loopResponse }] });
            parsedResponse = loopParsedResponse;
          } else {
            // No tool calls - LLM responded with plain text, treat as implicit send_chat
            console.log(`[AGENTIC LOOP] Turn ${loopIteration} - No tool calls, treating as implicit send_chat`);
            sendChatContent = loopResponse.replace(/\{"toolCalls"[\s\S]*$/, "").trim();
            if (sendChatContent) {
              res.write(`data: ${JSON.stringify({ text: sendChatContent })}\n\n`);
            }
            break;
          }
        }
        
        if (loopIteration >= MAX_LOOP_ITERATIONS && !sendChatContent) {
          console.warn(`[AGENTIC LOOP] Hit max iterations (${MAX_LOOP_ITERATIONS}), forcing termination`);
          sendChatContent = "[Loop limit reached - response truncated]";
          res.write(`data: ${JSON.stringify({ text: sendChatContent })}\n\n`);
        }
        
        // Update cleanContentForStorage with send_chat content if available
        if (sendChatContent) {
          cleanContentForStorage = sendChatContent;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 6: Save AI response with clean content
      // ─────────────────────────────────────────────────────────────────────

      // Clean up the accumulated prose-only content
      // Remove any residual tool_code blocks, empty code blocks, and cleanup
      let finalContent = cleanContentForStorage
        // Remove code blocks containing tool call arrays (identified by known tool types)

      // Prepare Gemini content for storage (keep original for multi-turn context)
      // Always use the accumulated fullResponse to ensure complete content is stored
      const geminiContentToStore = {
        role: "model",
        parts: [{ text: fullResponse }],
      };

      // Include tool results in message metadata if any tools were executed
      const messageMetadata =
        toolResults.length > 0 ? { toolResults } : undefined;

      const endTime = Date.now();

      const savedAiMessage = await storage.addMessage({
        chatId: req.params.id,
        role: "ai",
        content: finalContent, // Store clean prose content (no tool JSON)
        geminiContent: geminiContentToStore,
        metadata: messageMetadata,
      });

      // Ingest AI response for RAG recall (async, don't block)
      // Use same userId from earlier in the request for consistency
      ragService
        .ingestMessage(
          finalContent,
          req.params.id,
          savedAiMessage.id,
          "ai",
          undefined,
          userId,
        )
        .catch((error) => {
          console.error(
            `[RAG] Failed to ingest AI message ${savedAiMessage.id}:`,
            error,
          );
        });

      // Log to LLM debug buffer for debugging
      try {
        const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
        llmDebugBuffer.add({
          chatId: req.params.id,
          messageId: savedMessage.id,
          systemPrompt: modifiedPrompt.systemPrompt,
          userMessage: composedPrompt.userMessage,
          conversationHistory: chatMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          attachments: composedPrompt.attachments.map((a) => ({
            type: a.type,
            filename: a.filename,
            mimeType: a.mimeType,
          })),
          rawResponse: fullResponse,
          parsedToolCalls: parsedResponse?.toolCalls || [],
          cleanContent: finalContent,
          toolResults,
          model: modelMode,
          durationMs: endTime - (startTime || endTime),
        });
      } catch (logError) {
        console.error("Failed to log LLM interaction:", logError);
      }

      // Log LLM token usage to database
      try {
        if (usageMetadata && usageMetadata.promptTokenCount !== undefined) {
          await storage.logLlmUsage({
            chatId: req.params.id,
            messageId: savedMessage.id,
            model: modelMode,
            promptTokens: usageMetadata.promptTokenCount || 0,
            completionTokens: usageMetadata.candidatesTokenCount || 0,
            totalTokens: usageMetadata.totalTokenCount || 0,
            durationMs: endTime - startTime,
            metadata: usageMetadata,
          });
          console.log(
            `[Token Usage] Chat ${req.params.id}: ${usageMetadata.promptTokenCount} in, ${usageMetadata.candidatesTokenCount} out, ${usageMetadata.totalTokenCount} total`,
          );
        }
      } catch (usageError) {
        console.error("Failed to log LLM token usage:", usageError);
      }

      // Send completion event with tool results summary and close the stream
      res.write(
        `data: ${JSON.stringify({
          done: true,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
        })}\n\n`,
      );
      res.end();
    } catch (error) {
      // Log error for debugging
      console.error("Error in message streaming:", error);

      // Check if headers were already sent (streaming started)
      if (res.headersSent) {
        // Send error via SSE and end stream gracefully
        try {
          res.write(
            `data: ${JSON.stringify({ error: "An error occurred while processing your message" })}\n\n`,
          );
          res.end();
        } catch (e) {
          // Stream may already be closed, just log and continue
          console.error("Failed to send error via stream:", e);
        }
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // MESSAGE METADATA POLLING
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/messages/:id/metadata
   * Poll for message metadata (used for async autoexec results).
   *
   * @route GET /api/messages/:id/metadata
   * @param {string} id - Message UUID
   * @returns {Object} 200 - { metadata: object, hasAutoexecResult: boolean }
   * @returns {Error} 404 - Message not found
   */
  app.get("/api/messages/:id/metadata", async (req, res) => {
    try {
      const message = await storage.getMessageById(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      const metadata = message.metadata as Record<string, unknown> | null;
      res.json({
        metadata,
        hasAutoexecResult: !!(
          metadata &&
          "autoexecResult" in metadata &&
          metadata.autoexecResult
        ),
      });
    } catch (error) {
      console.error("Error fetching message metadata:", error);
      res.status(500).json({ error: "Failed to fetch message metadata" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // DEBUG ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.get("/api/debug/logs", async (_req, res) => {
    try {
      const { logBuffer } = await import("./services/log-buffer");
      const logs = logBuffer.getLogs(50);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/debug/database", async (_req, res) => {
    try {
      const tables = await storage.getDebugDatabaseInfo();
      res.json(tables);
    } catch (error) {
      console.error("Error fetching database info:", error);
      res.status(500).json({ error: "Failed to fetch database info" });
    }
  });

  app.get("/api/debug/database/:tableName", async (req, res) => {
    try {
      const { tableName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const data = await storage.getTableData(tableName, limit, offset);
      res.json(data);
    } catch (error) {
      console.error("Error fetching table data:", error);
      res.status(500).json({ error: "Failed to fetch table data" });
    }
  });

  app.put("/api/debug/database/:tableName/:recordId", async (req, res) => {
    try {
      const { tableName, recordId } = req.params;
      const success = await storage.updateTableRecord(
        tableName,
        recordId,
        req.body,
      );
      if (!success) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating record:", error);
      res.status(500).json({ error: "Failed to update record" });
    }
  });

  app.delete("/api/debug/database/:tableName/:recordId", async (req, res) => {
    try {
      const { tableName, recordId } = req.params;
      const success = await storage.deleteTableRecord(tableName, recordId);
      if (!success) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting record:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  // LLM Debug endpoints - view prompts and responses
  app.get("/api/debug/llm", async (req, res) => {
    try {
      const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
      const limit = parseInt(req.query.limit as string) || 20;
      const interactions = llmDebugBuffer.getAll(limit);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching LLM debug data:", error);
      res.status(500).json({ error: "Failed to fetch LLM debug data" });
    }
  });

  app.get("/api/debug/llm/:id", async (req, res) => {
    try {
      const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
      const interaction = llmDebugBuffer.getById(req.params.id);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(interaction);
    } catch (error) {
      console.error("Error fetching LLM interaction:", error);
      res.status(500).json({ error: "Failed to fetch LLM interaction" });
    }
  });

  app.delete("/api/debug/llm", async (_req, res) => {
    try {
      const { llmDebugBuffer } = await import("./services/llm-debug-buffer");
      llmDebugBuffer.clear();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing LLM debug data:", error);
      res.status(500).json({ error: "Failed to clear LLM debug data" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LLM TOKEN USAGE ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/llm/usage
   * Get LLM token usage statistics
   */
  app.get("/api/llm/usage", async (_req, res) => {
    try {
      const stats = await storage.getLlmUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching LLM usage stats:", error);
      res.status(500).json({ error: "Failed to fetch LLM usage statistics" });
    }
  });

  /**
   * GET /api/llm/usage/recent
   * Get recent LLM usage records
   */
  app.get("/api/llm/usage/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const usage = await storage.getRecentLlmUsage(limit);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching recent LLM usage:", error);
      res.status(500).json({ error: "Failed to fetch recent LLM usage" });
    }
  });

  /**
   * GET /api/llm/usage/chat/:chatId
   * Get LLM usage for a specific chat
   */
  app.get("/api/llm/usage/chat/:chatId", async (req, res) => {
    try {
      const usage = await storage.getLlmUsageByChat(req.params.chatId);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching chat LLM usage:", error);
      res.status(500).json({ error: "Failed to fetch chat LLM usage" });
    }
  });

  // LLM Error Log endpoints
  app.get("/api/debug/errors", async (req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      const limit = parseInt(req.query.limit as string) || 50;
      const service = req.query.service as string | undefined;

      if (service) {
        const errors = llmErrorBuffer.getByService(service as any, limit);
        res.json(errors);
      } else {
        const errors = llmErrorBuffer.getAll(limit);
        res.json(errors);
      }
    } catch (error) {
      console.error("Error fetching LLM errors:", error);
      res.status(500).json({ error: "Failed to fetch LLM errors" });
    }
  });

  app.get("/api/debug/errors/summary", async (_req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      const summary = llmErrorBuffer.getSummaryForAnalysis();
      res.json({ summary, count: llmErrorBuffer.getCount() });
    } catch (error) {
      console.error("Error fetching error summary:", error);
      res.status(500).json({ error: "Failed to fetch error summary" });
    }
  });

  app.post("/api/debug/errors/analyze", async (req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      const { GoogleGenAI } = await import("@google/genai");

      const summary = llmErrorBuffer.getSummaryForAnalysis();

      if (llmErrorBuffer.getCount() === 0) {
        return res.json({
          analysis: "No errors to analyze. The error log is empty.",
          errorCount: 0,
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      }

      const genAI = new GoogleGenAI({ apiKey });

      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a debugging assistant. Analyze these LLM-related errors and provide:
1. A summary of the most common issues
2. Potential root causes
3. Suggested fixes or workarounds
4. Priority ranking (which errors to fix first)

Be concise but thorough. Format your response in markdown.

${summary}`,
              },
            ],
          },
        ],
      });

      const analysis = response.text || "Unable to generate analysis";

      res.json({
        analysis,
        errorCount: llmErrorBuffer.getCount(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error analyzing errors:", error);
      res.status(500).json({ error: "Failed to analyze errors" });
    }
  });

  app.delete("/api/debug/errors", async (_req, res) => {
    try {
      const { llmErrorBuffer } = await import("./services/llm-error-buffer");
      llmErrorBuffer.clear();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing LLM errors:", error);
      res.status(500).json({ error: "Failed to clear LLM errors" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // JIT TOOL PROTOCOL ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.post("/api/jit/predict", async (req, res) => {
    try {
      const { jitToolProtocol } = await import("./services/jit-tool-protocol");
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Missing 'query' parameter" });
      }

      const prediction = await jitToolProtocol.predictTools(query);
      res.json({ success: true, prediction });
    } catch (error) {
      console.error("JIT prediction error:", error);
      res.status(500).json({ error: "Failed to predict tools" });
    }
  });

  app.post("/api/jit/context", async (req, res) => {
    try {
      const { jitToolProtocol } = await import("./services/jit-tool-protocol");
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Missing 'query' parameter" });
      }

      const result = await jitToolProtocol.getOptimizedToolContext(query);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("JIT context error:", error);
      res.status(500).json({ error: "Failed to get tool context" });
    }
  });

  app.get("/api/jit/examples", async (_req, res) => {
    try {
      const { jitToolProtocol } = await import("./services/jit-tool-protocol");
      const allTools = jitToolProtocol.getAllTools();
      const manifest = jitToolProtocol.getFullManifest();
      res.json({ success: true, allTools, manifest });
    } catch (error) {
      console.error("JIT examples error:", error);
      res.status(500).json({ error: "Failed to get examples" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CODEBASE ANALYSIS ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.post("/api/codebase/analyze", async (req, res) => {
    try {
      const { codebaseAnalyzer } = await import("./services/codebase-analyzer");
      const { path: rootPath = ".", skipIngestion } = req.body;

      // Skip RAG ingestion for external codebases (paths outside the project)
      const isExternal = rootPath.startsWith("/tmp") || rootPath.startsWith("/home") || rootPath.includes("github");
      const shouldSkipIngestion = skipIngestion === true || isExternal;

      // Start analysis (may take time for large codebases)
      const result = await codebaseAnalyzer.analyzeCodebase(rootPath, shouldSkipIngestion);

      // Convert Map to object for JSON serialization
      const glossaryObj: Record<string, any[]> = {};
      result.glossary.forEach((value, key) => {
        glossaryObj[key] = value;
      });

      res.json({
        success: true,
        rootPath: result.rootPath,
        totalFiles: result.totalFiles,
        totalEntities: result.totalEntities,
        totalChunks: result.totalChunks,
        duration: result.duration,
        errors: result.errors,
        files: result.files.map(f => ({
          path: f.relativePath,
          extension: f.extension,
          lineCount: f.lineCount,
          entityCount: f.entities.length,
        })),
        glossary: glossaryObj,
        documentation: result.documentation,
      });
    } catch (error) {
      console.error("Error analyzing codebase:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze codebase",
      });
    }
  });

  app.get("/api/codebase/progress", async (_req, res) => {
    try {
      const { codebaseAnalyzer } = await import("./services/codebase-analyzer");
      const progress = codebaseAnalyzer.getProgress();
      res.json({ success: true, progress });
    } catch (error) {
      console.error("Error getting analysis progress:", error);
      res.status(500).json({ success: false, error: "Failed to get progress" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BROWSER ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════

  app.post("/api/browser/load", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res
          .status(400)
          .json({ success: false, error: "URL is required" });
      }

      if (
        !process.env.BROWSERBASE_API_KEY ||
        !process.env.BROWSERBASE_PROJECT_ID
      ) {
        return res.status(503).json({
          success: false,
          error:
            "Browserbase is not configured. Please add BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID to your environment variables.",
          needsConfig: true,
        });
      }

      const browserbase = await import("./integrations/browserbase");

      const result = await browserbase.takeScreenshot(url, { fullPage: false });
      const screenshotBase64 = result.screenshot.toString("base64");
      const screenshotUrl = `data:image/png;base64,${screenshotBase64}`;

      const pageResult = await browserbase.loadPage(url, { textOnly: false });

      res.json({
        success: true,
        sessionId: result.sessionId,
        url,
        title: pageResult.title || url,
        screenshotUrl,
      });
    } catch (error) {
      console.error("Error loading page in browser:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to load page",
      });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LIVE VOICE CONVERSATION ENDPOINTS
  // Moved to server/routes/live.ts
  // ═════════════════════════════════════════════════════════════════════════

  // ═════════════════════════════════════════════════════════════════════════
  // DOCUMENTATION API
  // Serves markdown documentation files from the docs/ directory
  // ═════════════════════════════════════════════════════════════════════════

  app.get("/api/documentation/:path(*)", async (req, res) => {
    try {
      const docPath = req.params.path;
      const fs = await import("fs/promises");
      const path = await import("path");
      
      // Security: Only allow .md files from docs directory
      if (!docPath.endsWith(".md")) {
        return res.status(400).json({ error: "Only .md files allowed" });
      }
      
      const fullPath = path.join(process.cwd(), "docs", docPath);
      
      // Security: Prevent directory traversal
      const resolvedPath = path.resolve(fullPath);
      const docsDir = path.resolve(process.cwd(), "docs");
      if (!resolvedPath.startsWith(docsDir)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const content = await fs.readFile(fullPath, "utf-8");
      res.type("text/plain").send(content);
    } catch (error) {
      console.error("Error reading doc file:", error);
      res.status(404).json({ error: "Document not found" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // MODULAR API ROUTERS
  // The following routes are organized into separate modules:
  // - /api/drive - Google Drive file operations
  // - /api/gmail - Gmail operations
  // - /api/calendar - Google Calendar operations
  // - /api/docs - Google Docs operations
  // - /api/sheets - Google Sheets operations
  // - /api/tasks - Google Tasks operations
  // - /api/speech - Speech transcription
  // - /api/drafts - Draft management
  // - /api/attachments - Attachment management
  // ═════════════════════════════════════════════════════════════════════════

  app.use("/api", createApiRouter());

  // ═════════════════════════════════════════════════════════════════════════
  // Return the HTTP server instance
  // This allows the caller to attach WebSocket servers or start listening
  // ═════════════════════════════════════════════════════════════════════════

  return httpServer;
}
