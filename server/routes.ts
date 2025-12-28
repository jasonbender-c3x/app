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
      const composedPrompt = await promptComposer.compose({
        textContent: req.body.content || "",
        voiceTranscript: "",
        attachments: savedAttachments,
        history: chatMessages,
        chatId: req.params.id,
        userId: userId, // Pass userId for data isolation in RAG context
      });

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

      const result = await genAI.models.generateContentStream({
        model: modelMode,
        // Pass the composed system prompt via systemInstruction parameter
        config: {
          systemInstruction: composedPrompt.systemPrompt,
        },
        // Include full history plus the new user message with text and media
        contents: [...history, { role: "user", parts: userParts }],
      });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: Stream AI response and parse structured JSON
      // ─────────────────────────────────────────────────────────────────────

      // Helper to strip markdown code fences from JSON responses
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
        return result.trim();
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

      // Dual-path streaming with incremental JSON detection and timeout guard
      // Buffer only until we can confirm valid structured response or fallback to streaming
      let braceDepth = 0;
      let bracketDepth = 0;
      let inString = false;
      let escapeNext = false;
      let mightBeJson = false;
      let confirmedPlainText = false;
      let confirmedStructured = false;
      let bufferedContent = "";
      let bufferStartTime = 0;
      let parsedResponse: { toolCalls?: ToolCall[]; afterRag?: { chatContent?: string } } | null = null;
      let hasCodeFence = false; // Track if response uses code fences
      const MAX_JSON_BUFFER = 16384; // Max bytes to buffer before forcing plain text mode (16KB for structured)
      const MAX_BUFFER_TIME_MS = 10000; // Max time to buffer (10s - structured responses can be large)
      
      for await (const chunk of result) {
        const text = chunk.text || "";
        fullResponse += text;

        // Capture usage metadata from the final chunk
        if (chunk.usageMetadata) {
          usageMetadata = chunk.usageMetadata;
        }

        if (!text) continue;

        // Already confirmed as plain text - stream directly
        if (confirmedPlainText) {
          cleanContentForStorage += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
          continue;
        }

        // Already confirmed as structured JSON - just buffer
        if (confirmedStructured) {
          continue;
        }

        // Buffer content and track JSON structure
        bufferedContent += text;
        
        // Check first non-whitespace character to detect potential JSON
        // Handle markdown code fences (```json...```)
        if (!mightBeJson && bufferedContent.trim().length > 0) {
          const trimmed = bufferedContent.trim();
          const firstChar = trimmed[0];
          
          // Check for code fence or direct JSON
          if (firstChar === "{" || firstChar === "[") {
            mightBeJson = true;
            bufferStartTime = Date.now();
            braceDepth = firstChar === "{" ? 1 : 0;
            bracketDepth = firstChar === "[" ? 1 : 0;
          } else if (trimmed.startsWith("```")) {
            // Markdown code fence detected - wait for complete JSON inside
            mightBeJson = true;
            hasCodeFence = true;
            bufferStartTime = Date.now();
            console.log("[Routes] Detected code fence wrapper, buffering for structured response");
            // Don't track depth yet - we'll parse when we see closing fence
          } else {
            // Definitely not JSON - flush buffer and stream
            confirmedPlainText = true;
            cleanContentForStorage += bufferedContent;
            res.write(`data: ${JSON.stringify({ text: bufferedContent })}\n\n`);
            continue;
          }
        }

        // Track brace/bracket depth for JSON detection (skip first char already counted)
        const startIdx = mightBeJson && bufferedContent.length === text.length ? 1 : 0;
        for (let i = startIdx; i < text.length; i++) {
          const char = text[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === "\\") {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === "{") braceDepth++;
            else if (char === "}") braceDepth--;
            else if (char === "[") bracketDepth++;
            else if (char === "]") bracketDepth--;
          }
        }

        // When depth returns to zero, try to validate as structured response
        // Also check for closing code fence which indicates complete JSON block
        const hasClosingFence = bufferedContent.trim().endsWith("```");
        if (mightBeJson && ((braceDepth === 0 && bracketDepth === 0 && !inString) || hasClosingFence)) {
          try {
            const stripped = stripCodeFences(bufferedContent);
            const jsonData = JSON.parse(stripped);
            const validation = structuredLLMResponseSchema.safeParse(jsonData);
            if (validation.success && validation.data.toolCalls && validation.data.toolCalls.length > 0) {
              parsedResponse = validation.data;
              confirmedStructured = true;
              console.log(`[Routes] Parsed structured response with ${validation.data.toolCalls.length} tool calls`);
              continue;
            }
          } catch (e) {
            // Parse failed - not valid JSON (may still be incomplete)
            if (hasClosingFence) {
              console.log("[Routes] Code fence closed but JSON parse failed, flushing as text");
              // Code fence closed but invalid JSON - flush as plain text
              confirmedPlainText = true;
              cleanContentForStorage += bufferedContent;
              res.write(`data: ${JSON.stringify({ text: bufferedContent })}\n\n`);
              continue;
            }
            // For code fences, continue buffering until closing fence
            if (hasCodeFence) {
              continue;
            }
          }
          
          // Not a valid structured response (and not code fence) - flush buffer and stream
          confirmedPlainText = true;
          cleanContentForStorage += bufferedContent;
          res.write(`data: ${JSON.stringify({ text: bufferedContent })}\n\n`);
          continue;
        }

        // Timeout guard: if buffering too long without confirmation, flush and stream
        // Skip timeout for code-fenced responses - wait for closing fence
        if (mightBeJson && !hasCodeFence && (Date.now() - bufferStartTime) > MAX_BUFFER_TIME_MS) {
          console.log("[Routes] Buffer timeout reached, flushing as plain text");
          confirmedPlainText = true;
          cleanContentForStorage += bufferedContent;
          res.write(`data: ${JSON.stringify({ text: bufferedContent })}\n\n`);
          continue;
        }

        // Check if buffer exceeded - force plain text mode
        if (bufferedContent.length > MAX_JSON_BUFFER) {
          confirmedPlainText = true;
          cleanContentForStorage += bufferedContent;
          res.write(`data: ${JSON.stringify({ text: bufferedContent })}\n\n`);
          continue;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5b: Handle end of stream - execute tools or flush remaining buffer
      // ─────────────────────────────────────────────────────────────────────

      // If stream ended while still buffering, try to parse as JSON
      if (mightBeJson && !confirmedPlainText && !confirmedStructured) {
        try {
          const stripped = stripCodeFences(fullResponse);
          const jsonData = JSON.parse(stripped);
          const validation = structuredLLMResponseSchema.safeParse(jsonData);
          if (validation.success && validation.data.toolCalls && validation.data.toolCalls.length > 0) {
            parsedResponse = validation.data;
            confirmedStructured = true;
            console.log(`[Routes] End-of-stream parsed ${validation.data.toolCalls.length} tool calls`);
          }
        } catch (e) {
          console.log("[Routes] Response looked like JSON but failed to parse, streaming as text");
        }

        // If not valid structured response, flush the content
        if (!confirmedStructured) {
          cleanContentForStorage = fullResponse;
          res.write(`data: ${JSON.stringify({ text: fullResponse })}\n\n`);
        }
      }

      // Execute tool calls if we have a valid structured response
      if (confirmedStructured && parsedResponse) {
        for (const toolCall of parsedResponse.toolCalls!) {
          console.log(`[Routes] Executing tool call: ${toolCall.type} (${toolCall.id})`);
          try {
            const toolResult = await ragDispatcher.executeToolCall(toolCall, savedMessage.id);
            toolResults.push({
              toolId: toolResult.toolId,
              type: toolResult.type,
              success: toolResult.success,
              result: toolResult.result,
              error: toolResult.error,
            });

            // If this is send_chat, extract content for display
            if (toolCall.type === "send_chat" && toolResult.success && toolResult.result) {
              const chatResult = toolResult.result as { content?: string };
              if (chatResult.content) {
                cleanContentForStorage += chatResult.content;
                res.write(`data: ${JSON.stringify({ text: chatResult.content })}\n\n`);
              }
            }

            // If this is say, stream the audio for playback
            if (toolCall.type === "say" && toolResult.success && toolResult.result) {
              const sayResult = toolResult.result as { 
                utterance?: string; 
                locale?: string; 
                voiceId?: string;
                style?: string;
                audioGenerated?: boolean;
                audioBase64?: string;
                mimeType?: string;
                duration?: number;
                error?: string;
              };
              if (sayResult.utterance) {
                // Store utterance as content for the message
                cleanContentForStorage += sayResult.utterance;
                // Stream speech event to client with audio data if generated
                res.write(`data: ${JSON.stringify({ 
                  speech: {
                    utterance: sayResult.utterance,
                    locale: sayResult.locale || "en-US",
                    voiceId: sayResult.voiceId,
                    style: sayResult.style,
                    audioGenerated: sayResult.audioGenerated,
                    audioBase64: sayResult.audioBase64,
                    mimeType: sayResult.mimeType,
                    duration: sayResult.duration,
                    error: sayResult.error,
                  }
                })}\n\n`);
              }
            }

            // Send tool result to client (for non-output tools)
            if (toolCall.type !== "send_chat" && toolCall.type !== "say") {
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
            }
          } catch (err: any) {
            console.error(`[Routes] Tool execution error:`, err);
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

        // Also check afterRag.chatContent for backward compatibility
        if (parsedResponse.afterRag?.chatContent) {
          cleanContentForStorage += parsedResponse.afterRag.chatContent;
          res.write(`data: ${JSON.stringify({ text: parsedResponse.afterRag.chatContent })}\n\n`);
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
          systemPrompt: composedPrompt.systemPrompt,
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
