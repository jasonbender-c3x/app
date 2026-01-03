/**
 * =============================================================================
 * NEBULA CHAT - DATABASE SCHEMA DEFINITIONS
 * =============================================================================
 * 
 * This file defines the complete data model for the Meowstik application.
 * It uses Drizzle ORM to define PostgreSQL table schemas and generates
 * TypeScript types for type-safe database operations throughout the app.
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * The application uses a simple two-table relational model:
 * 
 *   ┌──────────────┐       ┌──────────────────┐
 *   │    chats     │       │     messages     │
 *   ├──────────────┤       ├──────────────────┤
 *   │ id (PK)      │◄──────│ chatId (FK)      │
 *   │ title        │       │ id (PK)          │
 *   │ createdAt    │       │ role             │
 *   │ updatedAt    │       │ content          │
 *   └──────────────┘       │ createdAt        │
 *                          └──────────────────┘
 * 
 * RELATIONSHIP:
 * - One Chat has many Messages (1:N relationship)
 * - Messages are cascade deleted when their parent Chat is deleted
 * 
 * EXPORTS:
 * --------
 * - chats: Drizzle table definition for chat conversations
 * - messages: Drizzle table definition for individual messages
 * - insertChatSchema: Zod validation schema for creating new chats
 * - insertMessageSchema: Zod validation schema for creating new messages
 * - InsertChat: TypeScript type for chat insert operations
 * - InsertMessage: TypeScript type for message insert operations
 * - Chat: TypeScript type for a chat record from the database
 * - Message: TypeScript type for a message record from the database
 * =============================================================================
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, bigint, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============================================================================
// REPLIT AUTH TABLES
// (IMPORTANT) These tables are mandatory for Replit Auth, don't drop them.
// =============================================================================

/**
 * SESSION STORAGE TABLE
 * Required for Replit Auth - stores user sessions
 */
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

/**
 * USER STORAGE TABLE
 * Required for Replit Auth - stores user profiles
 */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

/**
 * CHATS TABLE
 * -----------
 * Stores metadata for each chat conversation in the application.
 * 
 * A chat represents a complete conversation session between the user
 * and the AI assistant. Each chat can contain multiple messages.
 * 
 * COLUMNS:
 * - id: Unique identifier (UUID) generated automatically by PostgreSQL
 * - title: Display name for the chat, shown in the sidebar
 * - createdAt: Timestamp when the chat was first created
 * - updatedAt: Timestamp when the chat was last modified (new message added)
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * const newChat = await storage.createChat({ title: "My New Chat" });
 * const allChats = await storage.getChats(); // Returns Chat[]
 * ```
 */
export const chats = pgTable("chats", {
  /**
   * Primary key - Auto-generated UUID using PostgreSQL's gen_random_uuid()
   * UUIDs are used instead of sequential integers for:
   * - Better security (IDs are not guessable)
   * - Easier data migration and replication
   * - No collision issues in distributed systems
   */
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  /**
   * Human-readable title for the chat conversation
   * Displayed in the sidebar navigation and chat header
   * Cannot be null - every chat must have a title
   */
  title: text("title").notNull(),
  
  /**
   * Timestamp when this chat was first created
   * Automatically set by PostgreSQL using defaultNow()
   * Used for sorting chats chronologically
   */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  /**
   * Timestamp when this chat was last updated
   * Updated whenever a new message is added to the chat
   * Used for sorting chats by "most recent activity"
   */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * MESSAGES TABLE
 * --------------
 * Stores individual messages within chat conversations.
 * 
 * Each message belongs to exactly one chat (enforced by foreign key).
 * Messages can be from either the user or the AI assistant.
 * 
 * COLUMNS:
 * - id: Unique identifier (UUID) for the message
 * - chatId: Foreign key linking to the parent chat
 * - role: Who sent the message ("user" or "ai")
 * - content: The actual text content of the message (supports markdown)
 * - createdAt: When the message was sent
 * 
 * CASCADE DELETE:
 * When a chat is deleted, all its messages are automatically deleted too.
 * This ensures no orphaned messages exist in the database.
 * 
 * USAGE EXAMPLE:
 * ```typescript
 * await storage.addMessage({
 *   chatId: "chat-uuid",
 *   role: "user",
 *   content: "Hello, AI!"
 * });
 * ```
 */
export const messages = pgTable("messages", {
  /**
   * Primary key - Auto-generated UUID for each message
   * Ensures globally unique identification of every message
   */
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  /**
   * Foreign key reference to the parent chat
   * - Links each message to its conversation
   * - CASCADE DELETE: Messages are deleted when their chat is deleted
   * - NOT NULL: Every message must belong to a chat
   */
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  
  /**
   * Identifies the sender of the message
   * Valid values:
   * - "user": Message sent by the human user
   * - "ai": Message generated by the AI assistant
   * Used for styling and conversation history reconstruction
   */
  role: text("role").notNull(),
  
  /**
   * The actual text content of the message
   * Supports markdown formatting for rich text display
   * Can be any length (PostgreSQL text type has no practical limit)
   */
  content: text("content").notNull(),
  
  /**
   * Timestamp when this message was created/sent
   * Used for chronological ordering of messages within a chat
   */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  /**
   * Optional JSON metadata for AI messages
   * Stores tool results, file operations, autoexec results, etc.
   */
  metadata: jsonb("metadata"),
  
  /**
   * Full Gemini API content object for model responses
   * Stores the complete Content object including thought_signature
   * This preserves the model's reasoning state for multi-turn function calling
   * See: https://cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
   */
  geminiContent: jsonb("gemini_content"),
});

/**
 * ZOD VALIDATION SCHEMAS
 * ----------------------
 * These schemas are used to validate incoming data before database insertion.
 * They automatically derive validation rules from the Drizzle table definitions.
 * 
 * The .omit() method removes auto-generated fields that should not be
 * provided by the client (like id and timestamps).
 */

/**
 * Schema for validating new chat creation requests
 * Excludes: id (auto-generated), createdAt/updatedAt (auto-set)
 * Requires: title
 */
export const insertChatSchema = createInsertSchema(chats).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

/**
 * Schema for validating new message creation requests
 * Excludes: id (auto-generated), createdAt (auto-set)
 * Requires: chatId, role, content
 */
export const insertMessageSchema = createInsertSchema(messages).omit({ 
  id: true, 
  createdAt: true 
});

/**
 * TYPESCRIPT TYPES
 * ----------------
 * These types are derived from the schemas and used throughout the application
 * to ensure type safety when working with chat and message data.
 */

/**
 * Type for creating a new chat - only includes fields the client should provide
 * Example: { title: "New Conversation" }
 */
export type InsertChat = z.infer<typeof insertChatSchema>;

/**
 * Type for creating a new message - only includes fields the client should provide
 * Example: { chatId: "uuid", role: "user", content: "Hello" }
 */
export type InsertMessage = z.infer<typeof insertMessageSchema>;

/**
 * Complete Chat type as returned from the database
 * Includes all fields: id, title, createdAt, updatedAt
 */
export type Chat = typeof chats.$inferSelect;

/**
 * Complete Message type as returned from the database
 * Includes all fields: id, chatId, role, content, createdAt
 */
export type Message = typeof messages.$inferSelect;

// =============================================================================
// ATTACHMENT SYSTEM
// =============================================================================
/**
 * ATTACHMENTS TABLE
 * -----------------
 * Stores file attachments, screenshots, and voice transcripts associated with messages.
 * 
 * Attachment types:
 * - "file": User-uploaded files (documents, images, etc.)
 * - "screenshot": Screen captures taken via the capture button
 * - "voice_transcript": Transcribed voice input text
 * 
 * Binary data is stored as base64 for simplicity and portability.
 */
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  draftId: varchar("draft_id").references(() => drafts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "file" | "screenshot" | "voice_transcript"
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  size: bigint("size", { mode: "number" }), // File size in bytes
  content: text("content"), // Base64 encoded content or text
  path: text("path"), // Optional file path for created files
  permissions: text("permissions"), // Unix permission string (e.g., "755")
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// =============================================================================
// DRAFT PROMPTS SYSTEM
// =============================================================================
/**
 * DRAFTS TABLE
 * ------------
 * Stores in-progress message drafts before they are submitted.
 * 
 * A draft contains:
 * - The user's typed text input
 * - References to attached files and screenshots
 * - Voice transcript accumulations
 * 
 * When submitted, the draft is assembled into a complete prompt
 * and sent to the RAG backend.
 */
export const drafts = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  textContent: text("text_content").default(""),
  voiceTranscript: text("voice_transcript").default(""),
  status: text("status").default("active").notNull(), // "active" | "submitted" | "cancelled"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDraftSchema = createInsertSchema(drafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof drafts.$inferSelect;

// =============================================================================
// TOOL TASKS SYSTEM
// =============================================================================
/**
 * TOOL TASKS TABLE
 * ----------------
 * Stores individual tool operations to be executed by the system.
 * 
 * Tool types:
 * - "api_call": External API requests
 * - "file_create": Create new text file
 * - "file_replace": Replace existing file content
 * - "file_append": Append to existing file
 * - "binary_create": Create binary file from base64
 * - "search": Search operations
 * - "autoexec": Execute script with elevated permissions
 * 
 * Execution status tracks the lifecycle of each task.
 */
export const toolTasks = pgTable("tool_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  taskType: text("task_type").notNull(),
  payload: jsonb("payload").notNull(), // Task parameters as JSONB
  status: text("status").default("pending").notNull(), // "pending" | "running" | "completed" | "failed"
  result: jsonb("result"), // Execution result as JSONB
  error: text("error"), // Error message if failed
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertToolTaskSchema = createInsertSchema(toolTasks).omit({
  id: true,
  createdAt: true,
  executedAt: true,
});
export type InsertToolTask = z.infer<typeof insertToolTaskSchema>;
export type ToolTask = typeof toolTasks.$inferSelect;

// =============================================================================
// EXECUTION LOGS SYSTEM
// =============================================================================
/**
 * EXECUTION LOGS TABLE
 * --------------------
 * Audit trail for all tool executions, especially important for
 * security-sensitive operations like autoexec scripts.
 */
export const executionLogs = pgTable("execution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => toolTasks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  input: jsonb("input"), // Input parameters as JSONB
  output: jsonb("output"), // Output/result as JSONB
  exitCode: text("exit_code"),
  duration: text("duration"), // Execution time in milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExecutionLogSchema = createInsertSchema(executionLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertExecutionLog = z.infer<typeof insertExecutionLogSchema>;
export type ExecutionLog = typeof executionLogs.$inferSelect;

// =============================================================================
// FEEDBACK SYSTEM - User feedback on AI responses for evolution
// =============================================================================
/**
 * FEEDBACK TABLE
 * --------------
 * Stores user feedback on AI responses. This is the backbone for the evolution
 * system - feedback is analyzed to generate improvements via GitHub PRs.
 */
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  rating: varchar("rating", { length: 20 }), // "positive" | "negative" | null
  categories: jsonb("categories"), // { accuracy, helpfulness, clarity, completeness }
  likedAspects: text("liked_aspects").array(),
  dislikedAspects: text("disliked_aspects").array(),
  freeformText: text("freeform_text"),
  promptSnapshot: text("prompt_snapshot"), // Full prompt at time of response
  responseSnapshot: text("response_snapshot"), // Full AI response
  kernelId: varchar("kernel_id"), // Reference to kernel version used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"), // Set when feedback is submitted to GitHub PR
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// =============================================================================
// LLM USAGE TRACKING - Token usage logging for all LLM calls
// =============================================================================
/**
 * LLM_USAGE TABLE
 * ---------------
 * Logs every LLM API call with token counts for monitoring and cost tracking.
 * Captures input tokens, output tokens, model used, and timing information.
 */
export const llmUsage = pgTable("llm_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  model: text("model").notNull(), // e.g., "gemini-2.0-flash-exp"
  promptTokens: integer("prompt_tokens").notNull(), // Input tokens
  completionTokens: integer("completion_tokens").notNull(), // Output tokens
  totalTokens: integer("total_tokens").notNull(), // Total tokens
  durationMs: integer("duration_ms"), // Request duration in milliseconds
  metadata: jsonb("metadata"), // Additional metadata (e.g., thoughtsTokenCount for thinking models)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLlmUsageSchema = createInsertSchema(llmUsage).omit({
  id: true,
  createdAt: true,
});
export type InsertLlmUsage = z.infer<typeof insertLlmUsageSchema>;
export type LlmUsage = typeof llmUsage.$inferSelect;

// =============================================================================
// STRUCTURED LLM OUTPUT SCHEMAS
// =============================================================================
/**
 * These Zod schemas define the expected structure of LLM responses.
 * The LLM must return output conforming to these schemas for proper
 * processing by the RAG dispatcher.
 */

/**
 * All available tool types for the LLM to use
 */
export const ToolTypes = {
  // Core operations
  API_CALL: "api_call",
  FILE_INGEST: "file_ingest", 
  FILE_UPLOAD: "file_upload",
  SEARCH: "search",
  WEB_SEARCH: "web_search",
  GOOGLE_SEARCH: "google_search",
  DUCKDUCKGO_SEARCH: "duckduckgo_search",
  BROWSER_SCRAPE: "browser_scrape",
  CUSTOM: "custom",
  
  // Gmail operations
  GMAIL_LIST: "gmail_list",
  GMAIL_READ: "gmail_read",
  GMAIL_SEND: "gmail_send",
  GMAIL_SEARCH: "gmail_search",
  
  // Google Drive operations
  DRIVE_LIST: "drive_list",
  DRIVE_READ: "drive_read",
  DRIVE_CREATE: "drive_create",
  DRIVE_UPDATE: "drive_update",
  DRIVE_DELETE: "drive_delete",
  DRIVE_SEARCH: "drive_search",
  
  // Google Calendar operations
  CALENDAR_LIST: "calendar_list",
  CALENDAR_EVENTS: "calendar_events",
  CALENDAR_CREATE: "calendar_create",
  CALENDAR_UPDATE: "calendar_update",
  CALENDAR_DELETE: "calendar_delete",
  
  // Google Docs operations
  DOCS_READ: "docs_read",
  DOCS_CREATE: "docs_create",
  DOCS_APPEND: "docs_append",
  DOCS_REPLACE: "docs_replace",
  
  // Google Sheets operations
  SHEETS_READ: "sheets_read",
  SHEETS_WRITE: "sheets_write",
  SHEETS_APPEND: "sheets_append",
  SHEETS_CREATE: "sheets_create",
  SHEETS_CLEAR: "sheets_clear",
  
  // Google Tasks operations
  TASKS_LIST: "tasks_list",
  TASKS_GET: "tasks_get",
  TASKS_CREATE: "tasks_create",
  TASKS_UPDATE: "tasks_update",
  TASKS_COMPLETE: "tasks_complete",
  TASKS_DELETE: "tasks_delete",
  
  // Terminal operations
  TERMINAL_EXECUTE: "terminal_execute",
  
  // Tavily deep research
  TAVILY_SEARCH: "tavily_search",
  TAVILY_QNA: "tavily_qna",
  TAVILY_RESEARCH: "tavily_research",
  
  // Perplexity AI search
  PERPLEXITY_SEARCH: "perplexity_search",
  PERPLEXITY_QUICK: "perplexity_quick",
  PERPLEXITY_RESEARCH: "perplexity_research",
  PERPLEXITY_NEWS: "perplexity_news",
  
  // Browserbase operations
  BROWSERBASE_LOAD: "browserbase_load",
  BROWSERBASE_SCREENSHOT: "browserbase_screenshot",
  BROWSERBASE_ACTION: "browserbase_action",
  
  // GitHub operations
  GITHUB_REPOS: "github_repos",
  GITHUB_REPO_GET: "github_repo_get",
  GITHUB_REPO_SEARCH: "github_repo_search",
  GITHUB_CONTENTS: "github_contents",
  GITHUB_FILE_READ: "github_file_read",
  GITHUB_CODE_SEARCH: "github_code_search",
  GITHUB_ISSUES: "github_issues",
  GITHUB_ISSUE_GET: "github_issue_get",
  GITHUB_ISSUE_CREATE: "github_issue_create",
  GITHUB_ISSUE_UPDATE: "github_issue_update",
  GITHUB_ISSUE_COMMENT: "github_issue_comment",
  GITHUB_PULLS: "github_pulls",
  GITHUB_PULL_GET: "github_pull_get",
  GITHUB_COMMITS: "github_commits",
  GITHUB_USER: "github_user",
  
  // Queue operations (AI batch processing)
  QUEUE_CREATE: "queue_create",
  QUEUE_BATCH: "queue_batch",
  QUEUE_LIST: "queue_list",
  QUEUE_START: "queue_start",
  
  // Debug operations
  DEBUG_ECHO: "debug_echo",
  
  // Chat output - primary tool for sending content to chat window
  SEND_CHAT: "send_chat",
  
  // Voice output - tool for sending speech in turn-taking voice mode
  SAY: "say",
  
  // File operations
  FILE_GET: "file_get",
  FILE_PUT: "file_put",
  
  // Twilio SMS/Voice operations
  SMS_SEND: "sms_send",
  SMS_LIST: "sms_list",
  CALL_MAKE: "call_make",
  CALL_LIST: "call_list",
  
  // Google Contacts operations
  CONTACTS_LIST: "contacts_list",
  CONTACTS_SEARCH: "contacts_search",
  CONTACTS_GET: "contacts_get",
  CONTACTS_CREATE: "contacts_create",
  CONTACTS_UPDATE: "contacts_update",
  CONTACTS_DELETE: "contacts_delete",
} as const;

export type ToolType = typeof ToolTypes[keyof typeof ToolTypes];

/**
 * Tool Call Schema
 * Represents a single operation to be executed
 */
export const toolCallSchema = z.object({
  id: z.string(),
  type: z.enum([
    // Core
    "api_call", "file_ingest", "search", "web_search", "custom",
    // Chat output - primary tool for sending content to chat window
    "send_chat",
    // Voice output - tool for sending speech in turn-taking voice mode
    "say",
    // File operations
    "file_get", "file_put",
    // Search & Scraping
    "google_search", "duckduckgo_search", "browser_scrape",
    // Gmail
    "gmail_list", "gmail_read", "gmail_send", "gmail_search",
    // Drive
    "drive_list", "drive_read", "drive_create", "drive_update", "drive_delete", "drive_search",
    // Calendar
    "calendar_list", "calendar_events", "calendar_create", "calendar_update", "calendar_delete",
    // Docs
    "docs_read", "docs_create", "docs_append", "docs_replace",
    // Sheets
    "sheets_read", "sheets_write", "sheets_append", "sheets_create", "sheets_clear",
    // Tasks
    "tasks_list", "tasks_get", "tasks_create", "tasks_update", "tasks_complete", "tasks_delete",
    // Terminal
    "terminal_execute",
    // Tavily deep research
    "tavily_search", "tavily_qna", "tavily_research",
    // Perplexity AI search
    "perplexity_search", "perplexity_quick", "perplexity_research", "perplexity_news",
    // Browserbase
    "browserbase_load", "browserbase_screenshot", "browserbase_action",
    // GitHub
    "github_repos", "github_repo_get", "github_repo_search", "github_contents", 
    "github_file_read", "github_code_search", "github_issues", "github_issue_get",
    "github_issue_create", "github_issue_update", "github_issue_comment",
    "github_pulls", "github_pull_get", "github_commits", "github_user",
    // Queue (AI batch processing)
    "queue_create", "queue_batch", "queue_list", "queue_start",
    // Debug
    "debug_echo",
    // Contacts
    "contacts_list", "contacts_search", "contacts_get", "contacts_create", "contacts_update", "contacts_delete",
    // Twilio SMS/Voice
    "sms_send", "sms_list", "call_make", "call_list",
  ]),
  operation: z.string(),
  parameters: z.record(z.unknown()),
  priority: z.number().optional().default(0),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

// =============================================================================
// CHAT OUTPUT PARAMETER SCHEMA
// =============================================================================

/**
 * Send Chat Parameters
 * The primary tool for sending content to the chat window
 * All chat output should go through this tool
 */
export const sendChatParamsSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
});
export type SendChatParams = z.infer<typeof sendChatParamsSchema>;

// =============================================================================
// VOICE OUTPUT PARAMETER SCHEMA
// =============================================================================

/**
 * Available voice options for expressive speech synthesis
 * Each voice has unique characteristics suitable for different use cases
 */
export const SayVoiceIds = [
  "Kore",    // Default female voice - warm and professional
  "Puck",    // Energetic and playful
  "Charon",  // Deep and authoritative
  "Fenrir",  // Bold and dramatic
  "Aoede",   // Melodic and soothing
  "Leda",    // Clear and articulate
  "Orus",    // Calm and measured
  "Zephyr",  // Light and airy
] as const;
export type SayVoiceId = typeof SayVoiceIds[number];

/**
 * Speaking style options that affect how the text is delivered
 * These modify the emotional tone and delivery of the speech
 */
export const SayStyles = [
  "natural",              // Default conversational tone
  "Say cheerfully",       // Upbeat and positive
  "Say seriously",        // Formal and grave
  "Say excitedly",        // High energy and enthusiastic
  "Say calmly",           // Relaxed and soothing
  "Say dramatically",     // Theatrical with emphasis
  "Whisper",              // Soft and quiet
  "Say like a news anchor", // Professional broadcast style
  "Say warmly",           // Friendly and inviting
  "Say professionally",   // Business-appropriate tone
] as const;
export type SayStyle = typeof SayStyles[number];

/**
 * Say Parameters
 * Voice output tool for turn-taking mode with expressive speech synthesis
 * Uses Gemini 2.5 Flash TTS for high-quality audio generation
 */
export const sayParamsSchema = z.object({
  /** The text content to be spoken aloud */
  utterance: z.string().min(1, "Utterance cannot be empty"),
  
  /** Voice to use for speech synthesis (default: "Kore") */
  voiceId: z.enum(SayVoiceIds).optional().default("Kore"),
  
  /** Speaking style that affects emotional tone and delivery (default: "natural") */
  style: z.enum(SayStyles).optional().default("natural"),
  
  /** Language/region code for pronunciation (default: "en-US") */
  locale: z.string().optional().default("en-US"),
  
  /** Turn ID for tracking multi-turn voice conversations */
  conversationalTurnId: z.string().optional(),
});
export type SayParams = z.infer<typeof sayParamsSchema>;

/**
 * File Get Parameters
 * Read a file from filesystem or editor canvas
 */
export const fileGetParamsSchema = z.object({
  path: z.string().min(1, "Path is required"),
  encoding: z.enum(["utf8", "base64"]).optional().default("utf8"),
});
export type FileGetParams = z.infer<typeof fileGetParamsSchema>;

/**
 * File Put Parameters
 * Write/create a file to filesystem or editor canvas
 */
export const filePutParamsSchema = z.object({
  path: z.string().min(1, "Path is required"),
  content: z.string(),
  mimeType: z.string().optional(),
  permissions: z.string().optional().default("644"),
  summary: z.string().optional(),
});
export type FilePutParams = z.infer<typeof filePutParamsSchema>;

// =============================================================================
// GOOGLE WORKSPACE PARAMETER SCHEMAS
// =============================================================================

/** Gmail send parameters */
export const gmailSendParamsSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
});
export type GmailSendParams = z.infer<typeof gmailSendParamsSchema>;

/** Gmail search parameters */
export const gmailSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
});
export type GmailSearchParams = z.infer<typeof gmailSearchParamsSchema>;

/** Drive file parameters */
export const driveFileParamsSchema = z.object({
  fileId: z.string().optional(),
  name: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string().optional(),
  folderId: z.string().optional(),
});
export type DriveFileParams = z.infer<typeof driveFileParamsSchema>;

/** Drive search parameters */
export const driveSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
});
export type DriveSearchParams = z.infer<typeof driveSearchParamsSchema>;

/** Calendar event parameters */
export const calendarEventParamsSchema = z.object({
  calendarId: z.string().optional().default("primary"),
  eventId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(), // ISO datetime
  end: z.string().optional(), // ISO datetime
  attendees: z.array(z.string().email()).optional(),
  location: z.string().optional(),
});
export type CalendarEventParams = z.infer<typeof calendarEventParamsSchema>;

/** Docs operation parameters */
export const docsParamsSchema = z.object({
  documentId: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  findText: z.string().optional(),
  replaceText: z.string().optional(),
});
export type DocsParams = z.infer<typeof docsParamsSchema>;

/** Sheets operation parameters */
export const sheetsParamsSchema = z.object({
  spreadsheetId: z.string().optional(),
  title: z.string().optional(),
  range: z.string().optional(),
  values: z.array(z.array(z.unknown())).optional(),
});
export type SheetsParams = z.infer<typeof sheetsParamsSchema>;

/** Tasks operation parameters */
export const tasksParamsSchema = z.object({
  taskListId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  due: z.string().optional(), // ISO date
});
export type TasksParams = z.infer<typeof tasksParamsSchema>;

// =============================================================================
// WEB SEARCH PARAMETER SCHEMA
// =============================================================================

/** Web search parameters using Google Custom Search API */
export const webSearchParamsSchema = z.object({
  query: z.string(),
  maxTokens: z.number().optional().default(1024),
  searchRecency: z.enum(["day", "week", "month", "year"]).optional(),
  domains: z.array(z.string()).optional(),
});
export type WebSearchParams = z.infer<typeof webSearchParamsSchema>;

/** Google Custom Search parameters (fast, requires API key) */
export const googleSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
  searchRecency: z.enum(["day", "week", "month", "year"]).optional(),
  domains: z.array(z.string()).optional(),
});
export type GoogleSearchParams = z.infer<typeof googleSearchParamsSchema>;

/** DuckDuckGo search parameters (free, no API key needed) */
export const duckduckgoSearchParamsSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional().default(10),
});
export type DuckDuckGoSearchParams = z.infer<typeof duckduckgoSearchParamsSchema>;

/** Browser scrape parameters (Playwright-based for JS-heavy sites) */
export const browserScrapeParamsSchema = z.object({
  url: z.string().url(),
  timeout: z.number().optional().default(30000),
});
export type BrowserScrapeParams = z.infer<typeof browserScrapeParamsSchema>;

/**
 * File Operation Schema
 * Defines a file to be created, replaced, or appended
 * 
 * PROTOCOL:
 * - mimeType: Indicates file type (e.g. "text/javascript", "text/plain")
 * - path: File location; if starts with "editor:" → save to Monaco editor canvas
 * - filename.ext: Full filename with extension
 * - permissions: Unix-style permissions (octal string, e.g. "644")
 * - summary: Short description of file purpose/changes
 * - content: File content
 * - encoding: How content is encoded (utf8 or base64)
 */
export const fileOperationSchema = z.object({
  action: z.enum(["create", "replace", "append"]),
  filename: z.string(),
  path: z.string(),
  mimeType: z.string().optional(),
  permissions: z.string().optional().default("644"),
  summary: z.string().optional(),
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
});
export type FileOperation = z.infer<typeof fileOperationSchema>;

/**
 * Binary File Operation Schema
 * For creating binary files from base64 encoded content
 * 
 * PROTOCOL:
 * - mimeType: Required for binary files (e.g. "image/png", "application/pdf")
 * - path: File location; if starts with "editor:" → save to Monaco editor canvas
 * - filename.ext: Full filename with extension
 * - permissions: Unix-style permissions (octal string, e.g. "644")
 * - summary: Short description of file purpose/changes
 * - base64Content: Binary content as base64 string
 */
export const binaryFileOperationSchema = z.object({
  action: z.enum(["create", "replace"]),
  filename: z.string(),
  path: z.string(),
  mimeType: z.string(),
  permissions: z.string().optional().default("644"),
  summary: z.string().optional(),
  base64Content: z.string(),
});
export type BinaryFileOperation = z.infer<typeof binaryFileOperationSchema>;

/**
 * Autoexec Script Schema
 * Special file that can be executed with elevated permissions
 */
export const autoexecSchema = z.object({
  filename: z.literal("autoexec.666"),
  content: z.string(),
  requiresSudo: z.boolean().default(false),
  sshTarget: z.string().optional(),
  timeout: z.number().optional().default(30000),
});
export type AutoexecScript = z.infer<typeof autoexecSchema>;

/**
 * Complete Structured LLM Response Schema
 * LLM returns toolCalls array - all output goes through tools (send_chat, say, file_put, etc.)
 */
export const structuredLLMResponseSchema = z.object({
  toolCalls: z.array(toolCallSchema).optional().default([]),
  metadata: z.object({
    processingTime: z.number().optional(),
    modelUsed: z.string().optional(),
    tokenCount: z.number().optional(),
  }).optional(),
});
export type StructuredLLMResponse = z.infer<typeof structuredLLMResponseSchema>;

// =============================================================================
// DOCUMENT CHUNKS SYSTEM (RAG)
// =============================================================================
/**
 * DOCUMENT CHUNKS TABLE
 * ---------------------
 * Stores chunked documents with their vector embeddings for semantic search.
 * Used in the RAG (Retrieval Augmented Generation) pipeline.
 * 
 * When a document is uploaded:
 * 1. It's split into semantic chunks (paragraphs, sections)
 * 2. Each chunk is embedded using Gemini's embedding model
 * 3. Chunks are stored with their embeddings for later retrieval
 * 4. On query, relevant chunks are found via vector similarity search
 */
export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  attachmentId: varchar("attachment_id").references(() => attachments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;

// =============================================================================
// GOOGLE OAUTH TOKENS
// =============================================================================
/**
 * GOOGLE OAUTH TOKENS TABLE
 * -------------------------
 * Stores Google OAuth2 tokens for persistent authentication.
 * Uses a singleton pattern (id = 'default') for single-user app.
 */
export const googleOAuthTokens = pgTable("google_oauth_tokens", {
  id: varchar("id").primaryKey().default("default"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiryDate: bigint("expiry_date", { mode: "number" }),
  tokenType: text("token_type"),
  scope: text("scope"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGoogleOAuthTokensSchema = createInsertSchema(googleOAuthTokens).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertGoogleOAuthTokens = z.infer<typeof insertGoogleOAuthTokensSchema>;
export type GoogleOAuthTokens = typeof googleOAuthTokens.$inferSelect;

/**
 * Message role enum for type safety
 */
export const MessageRole = {
  USER: "user",
  AI: "ai",
} as const;
export type MessageRoleType = typeof MessageRole[keyof typeof MessageRole];

/**
 * Helper function to generate a chat filename with timestamp
 */
export function generateChatFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `Chat-${timestamp}.txt`;
}

// =============================================================================
// RESPONSE PARSING HELPERS
// =============================================================================

/**
 * Extract JSON from LLM response that may contain markdown code blocks
 */
export function extractJsonFromResponse(response: string): string | null {
  // Try to find JSON in code blocks first
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  
  // Try to find raw JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return null;
}

/**
 * Parse structured LLM response with fallback for plain text
 */
export function parseStructuredResponse(response: string): StructuredLLMResponse | null {
  const jsonStr = extractJsonFromResponse(response);
  if (!jsonStr) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    const result = structuredLLMResponseSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.error("Schema validation failed:", JSON.stringify(result.error.errors, null, 2));
    
    // Try to extract toolCalls even if full validation fails
    if (Array.isArray(parsed?.toolCalls)) {
      console.log("Extracting toolCalls from partially valid response");
      return {
        toolCalls: parsed.toolCalls,
      };
    }
    
    return null;
  } catch (e) {
    console.error("JSON parse error:", e);
    return null;
  }
}

/**
 * Create a fallback structured response when LLM returns plain text
 * Plain text is converted to a send_chat tool call
 */
export function createFallbackResponse(plainText: string): StructuredLLMResponse {
  return {
    toolCalls: [{
      id: "fallback_chat",
      type: "send_chat" as const,
      operation: "respond",
      parameters: { content: plainText },
      priority: 0,
    }],
  };
}

/**
 * Check if response appears to be structured JSON
 */
export function isStructuredResponse(response: string): boolean {
  const trimmed = response.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("```json") ||
    trimmed.includes('"toolCalls"')
  );
}

// =============================================================================
// LOG PARSER TABLES
// =============================================================================

export const conversationSources = pgTable("conversation_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  participants: text("participants").array(),
  messageCount: integer("message_count").default(0),
  dateStart: timestamp("date_start"),
  dateEnd: timestamp("date_end"),
  status: text("status").default("pending").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSourceSchema = createInsertSchema(conversationSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConversationSource = z.infer<typeof insertConversationSourceSchema>;
export type ConversationSource = typeof conversationSources.$inferSelect;

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").references(() => conversationSources.id, { onDelete: "cascade" }),
  sourceName: text("source_name").notNull(),
  status: text("status").default("pending").notNull(),
  progress: integer("progress").default(0),
  messagesProcessed: integer("messages_processed").default(0),
  totalMessages: integer("total_messages").default(0),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIngestionJobSchema = createInsertSchema(ingestionJobs).omit({
  id: true,
  createdAt: true,
});
export type InsertIngestionJob = z.infer<typeof insertIngestionJobSchema>;
export type IngestionJob = typeof ingestionJobs.$inferSelect;

export const extractedKnowledge = pgTable("extracted_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").references(() => conversationSources.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").references(() => ingestionJobs.id, { onDelete: "cascade" }),
  bucket: text("bucket").notNull(),
  section: text("section"),
  content: text("content").notNull(),
  confidence: integer("confidence").default(100),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExtractedKnowledgeSchema = createInsertSchema(extractedKnowledge).omit({
  id: true,
  createdAt: true,
});
export type InsertExtractedKnowledge = z.infer<typeof insertExtractedKnowledgeSchema>;
export type ExtractedKnowledge = typeof extractedKnowledge.$inferSelect;

// =============================================================================
// KNOWLEDGE PIPELINE TABLES (Multimodal Ingestion/Retrieval)
// =============================================================================

/**
 * EVIDENCE TABLE
 * Normalized multimodal input envelope - the common format for all ingested content
 * Supports: text, images, audio, documents, emails, conversations
 */
export const evidence = pgTable("evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Source tracking
  sourceType: text("source_type").notNull(), // gmail, drive, upload, screenshot, audio, chat
  sourceId: text("source_id"), // External ID from source system
  sourceUrl: text("source_url"), // Original URL/path if available
  
  // Content modality
  modality: text("modality").notNull(), // text, image, audio, document, email, conversation
  mimeType: text("mime_type"),
  
  // Normalized content
  title: text("title"),
  rawContent: text("raw_content"), // Original content (text or base64)
  extractedText: text("extracted_text"), // Text extracted from any modality (OCR, ASR, etc.)
  summary: text("summary"), // AI-generated summary
  
  // Metadata
  author: text("author"),
  participants: text("participants").array(),
  language: text("language").default("en"),
  wordCount: integer("word_count"),
  
  // Temporal
  contentDate: timestamp("content_date"), // When the content was originally created
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // Processing status
  status: text("status").default("pending").notNull(), // pending, processing, indexed, failed
  processingError: text("processing_error"),
  
  // Domain routing
  bucket: text("bucket"), // PERSONAL_LIFE, CREATOR, PROJECTS
  confidence: integer("confidence").default(0), // Routing confidence 0-100
});

export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Evidence = typeof evidence.$inferSelect;

/**
 * ENTITIES TABLE
 * Recognized entities extracted from content (people, places, concepts, etc.)
 */
export const entities = pgTable("entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Entity identification
  name: text("name").notNull(), // Canonical name
  type: text("type").notNull(), // person, place, organization, concept, project, technology
  aliases: text("aliases").array(), // Alternative names/spellings
  
  // Description and context
  description: text("description"),
  
  // Linking
  externalIds: jsonb("external_ids"), // {linkedin: "...", github: "...", etc.}
  
  // Statistics
  mentionCount: integer("mention_count").default(0),
  lastMentioned: timestamp("last_mentioned"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEntitySchema = createInsertSchema(entities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;

/**
 * ENTITY_MENTIONS TABLE
 * Links entities to the evidence/knowledge where they appear
 */
export const entityMentions = pgTable("entity_mentions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  entityId: varchar("entity_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  evidenceId: varchar("evidence_id").references(() => evidence.id, { onDelete: "cascade" }),
  knowledgeId: varchar("knowledge_id").references(() => extractedKnowledge.id, { onDelete: "cascade" }),
  
  // Context
  mentionText: text("mention_text"), // The exact text that matched
  context: text("context"), // Surrounding text for context
  sentiment: text("sentiment"), // positive, negative, neutral
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEntityMentionSchema = createInsertSchema(entityMentions).omit({
  id: true,
  createdAt: true,
});
export type InsertEntityMention = z.infer<typeof insertEntityMentionSchema>;
export type EntityMention = typeof entityMentions.$inferSelect;

/**
 * KNOWLEDGE_EMBEDDINGS TABLE
 * Vector embeddings for semantic search (pgvector compatible)
 */
export const knowledgeEmbeddings = pgTable("knowledge_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to source
  evidenceId: varchar("evidence_id").references(() => evidence.id, { onDelete: "cascade" }),
  knowledgeId: varchar("knowledge_id").references(() => extractedKnowledge.id, { onDelete: "cascade" }),
  chunkId: varchar("chunk_id").references(() => documentChunks.id, { onDelete: "cascade" }),
  
  // The text that was embedded
  content: text("content").notNull(),
  
  // Vector embedding stored as JSON array (can migrate to pgvector later)
  embedding: jsonb("embedding"),
  embeddingModel: text("embedding_model").default("text-embedding-004"),
  dimensions: integer("dimensions").default(768),
  
  // Metadata for filtering
  bucket: text("bucket"),
  modality: text("modality"),
  sourceType: text("source_type"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKnowledgeEmbeddingSchema = createInsertSchema(knowledgeEmbeddings).omit({
  id: true,
  createdAt: true,
});
export type InsertKnowledgeEmbedding = z.infer<typeof insertKnowledgeEmbeddingSchema>;
export type KnowledgeEmbedding = typeof knowledgeEmbeddings.$inferSelect;

/**
 * CROSS_REFERENCES TABLE
 * Links between related knowledge items across buckets
 */
export const crossReferences = pgTable("cross_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Source and target
  sourceType: text("source_type").notNull(), // evidence, knowledge, entity
  sourceId: varchar("source_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  
  // Relationship
  relationshipType: text("relationship_type").notNull(), // related_to, derived_from, mentions, etc.
  strength: integer("strength").default(50), // 0-100
  
  // Context
  reason: text("reason"), // Why this link exists
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCrossReferenceSchema = createInsertSchema(crossReferences).omit({
  id: true,
  createdAt: true,
});
export type InsertCrossReference = z.infer<typeof insertCrossReferenceSchema>;
export type CrossReference = typeof crossReferences.$inferSelect;

// =============================================================================
// KERNEL SYSTEM (Self-Evolving AI Persistent Memory)
// =============================================================================

/**
 * KERNELS TABLE
 * -------------
 * The Kernel is a version-controlled AI configuration that stores the model's
 * personality, directives, and learned behaviors. This is the heart of the
 * self-evolving AI system described in the vision documentation.
 * 
 * Key concept: "Self-awareness is achieved by saving the state of the stateless"
 * 
 * Each kernel version captures:
 * - Core directives (what the AI should always do)
 * - Personality traits (how the AI should communicate)
 * - Learned behaviors (patterns discovered through interaction)
 * - User preferences (remembered from past sessions)
 * 
 * The kernel is injected into the system prompt at the start of each session,
 * allowing the AI to maintain continuity across conversations.
 */
export const kernels = pgTable("kernels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Versioning
  version: text("version").notNull(), // Semantic version like "9.31"
  parentId: varchar("parent_id"), // Previous kernel ID for evolution tracking (self-reference)
  
  // User association (each user can have their own kernel)
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Content sections (stored as markdown text)
  coreDirectives: text("core_directives").notNull(), // The immutable core rules
  personality: text("personality"), // Communication style and traits
  learnedBehaviors: text("learned_behaviors"), // Patterns discovered through interaction
  userPreferences: text("user_preferences"), // Remembered user preferences
  
  // Structured data (for programmatic access)
  toolConfig: jsonb("tool_config"), // Which tools are enabled/disabled
  bucketWeights: jsonb("bucket_weights"), // Priority weights for knowledge buckets
  
  // Status
  status: text("status").default("active").notNull(), // active, archived, draft
  
  // Evolution tracking
  evolutionReason: text("evolution_reason"), // Why this version was created
  changeLog: text("change_log"), // Human-readable changes from parent
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKernelSchema = createInsertSchema(kernels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKernel = z.infer<typeof insertKernelSchema>;
export type Kernel = typeof kernels.$inferSelect;

/**
 * KERNEL_EVOLUTIONS TABLE
 * -----------------------
 * Tracks individual learning events that may lead to kernel updates.
 * Each evolution represents a detected pattern or insight that the AI
 * learned during a conversation.
 * 
 * Evolutions are queued and reviewed before being incorporated into
 * the next kernel version, ensuring controlled evolution.
 */
export const kernelEvolutions = pgTable("kernel_evolutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to kernel and conversation
  kernelId: varchar("kernel_id").references(() => kernels.id, { onDelete: "cascade" }).notNull(),
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  
  // Evolution details
  evolutionType: text("evolution_type").notNull(), // preference, pattern, correction, insight
  targetSection: text("target_section").notNull(), // coreDirectives, personality, learnedBehaviors, userPreferences
  
  // Content
  observation: text("observation").notNull(), // What was observed
  proposedChange: text("proposed_change").notNull(), // Suggested update to kernel
  rationale: text("rationale"), // Why this change is beneficial
  
  // Review status
  status: text("status").default("pending").notNull(), // pending, approved, rejected, applied
  reviewedAt: timestamp("reviewed_at"),
  appliedToVersion: varchar("applied_to_version"), // Which kernel version incorporated this
  
  // Confidence
  confidence: integer("confidence").default(50), // 0-100
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKernelEvolutionSchema = createInsertSchema(kernelEvolutions).omit({
  id: true,
  createdAt: true,
});
export type InsertKernelEvolution = z.infer<typeof insertKernelEvolutionSchema>;
export type KernelEvolution = typeof kernelEvolutions.$inferSelect;

// =============================================================================
// TASK QUEUE SYSTEM - AI batch processing queue
// =============================================================================
/**
 * QUEUED TASKS TABLE
 * ------------------
 * Stores tasks that the AI has prepared for batch execution.
 * 
 * When a user requests complex work (like "research topic X"), the AI
 * generates a list of subtasks that get queued here for processing.
 * 
 * Task lifecycle: pending -> running -> completed/failed/cancelled
 * 
 * Tasks can have parent-child relationships for hierarchical execution.
 */
export const queuedTasks = pgTable("queued_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Optional parent task for hierarchical task trees
  parentId: varchar("parent_id").references((): any => queuedTasks.id, { onDelete: "cascade" }),
  
  // Link to chat where task was created
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(), // research, action, analysis, synthesis, etc.
  
  // Priority for queue ordering (higher = more urgent)
  priority: integer("priority").default(0).notNull(),
  
  // Execution status
  status: text("status").default("pending").notNull(), // pending, running, completed, failed, cancelled
  
  // Input/output data
  input: jsonb("input"), // Task parameters and context
  output: jsonb("output"), // Result after execution
  error: text("error"), // Error message if failed
  
  // Execution mode and flow control
  executionMode: text("execution_mode").default("sequential").notNull(), // sequential, parallel
  condition: text("condition"), // Natural language condition for if/then logic
  conditionResult: boolean("condition_result"), // Result of condition evaluation
  dependencies: text("dependencies").array(), // Array of task IDs that must complete first
  
  // Operator interaction
  waitingForInput: boolean("waiting_for_input").default(false).notNull(),
  inputPrompt: text("input_prompt"), // What to ask the operator
  operatorInput: text("operator_input"), // Response from operator
  
  // Workflow reference
  workflowId: varchar("workflow_id"), // Links to a workflow definition
  
  // Metadata
  estimatedDuration: integer("estimated_duration"), // Estimated seconds to complete
  actualDuration: integer("actual_duration"), // Actual seconds taken
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertQueuedTaskSchema = createInsertSchema(queuedTasks).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertQueuedTask = z.infer<typeof insertQueuedTaskSchema>;
export type QueuedTask = typeof queuedTasks.$inferSelect;

/**
 * Task type constants
 */
export const TaskTypes = {
  RESEARCH: "research",      // Deep dive into a topic
  ACTION: "action",          // Execute a specific action
  ANALYSIS: "analysis",      // Analyze data or content
  SYNTHESIS: "synthesis",    // Combine information into output
  FETCH: "fetch",           // Retrieve data from a source
  TRANSFORM: "transform",    // Convert data format
  VALIDATE: "validate",      // Verify or check something
  NOTIFY: "notify",          // Send notification or message
} as const;

export type TaskType = typeof TaskTypes[keyof typeof TaskTypes];

/**
 * Task status constants
 */
export const TaskStatuses = {
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  WAITING_INPUT: "waiting_input",
  WAITING_DEPENDENCY: "waiting_dependency",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type TaskStatus = typeof TaskStatuses[keyof typeof TaskStatuses];

/**
 * Execution mode constants
 */
export const ExecutionModes = {
  SEQUENTIAL: "sequential",
  PARALLEL: "parallel",
} as const;

export type ExecutionMode = typeof ExecutionModes[keyof typeof ExecutionModes];

// ============================================================================
// SCHEDULES - Cron jobs and scheduled task execution
// ============================================================================

export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Schedule identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Cron expression (e.g., "0 9 * * 1" = every Monday at 9am)
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  
  // What to execute
  taskTemplate: jsonb("task_template").notNull(), // Task definition to create when triggered
  workflowId: varchar("workflow_id"), // Or link to a workflow
  
  // State
  enabled: boolean("enabled").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runCount: integer("run_count").default(0).notNull(),
  
  // Error handling
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  maxConsecutiveFailures: integer("max_consecutive_failures").default(3),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
  nextRunAt: true,
  runCount: true,
  consecutiveFailures: true,
  lastError: true,
});
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;

// ============================================================================
// TRIGGERS - Event-driven task execution
// ============================================================================

export const triggers = pgTable("triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Trigger identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Trigger type and configuration
  triggerType: text("trigger_type").notNull(), // email, sms, prompt_keyword, webhook, manual
  
  // Pattern matching (depends on trigger type)
  pattern: text("pattern"), // Regex or keyword pattern
  senderFilter: text("sender_filter"), // For email/SMS: filter by sender
  subjectFilter: text("subject_filter"), // For email: filter by subject
  
  // What to execute
  taskTemplate: jsonb("task_template"), // Task definition to create when triggered
  workflowId: varchar("workflow_id"), // Or link to a workflow
  priority: integer("priority").default(5).notNull(), // Priority for triggered tasks
  
  // Webhook-specific
  webhookSecret: text("webhook_secret"), // For validating webhook calls
  
  // State
  enabled: boolean("enabled").default(true).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTriggerSchema = createInsertSchema(triggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
  triggerCount: true,
});
export type InsertTrigger = z.infer<typeof insertTriggerSchema>;
export type Trigger = typeof triggers.$inferSelect;

/**
 * Trigger type constants
 */
export const TriggerTypes = {
  EMAIL: "email",           // Triggered by incoming email
  SMS: "sms",               // Triggered by incoming SMS (Twilio)
  PROMPT_KEYWORD: "prompt_keyword", // Triggered by keyword in user prompt
  WEBHOOK: "webhook",       // Triggered by external HTTP request
  MANUAL: "manual",         // Triggered manually by user
} as const;

export type TriggerType = typeof TriggerTypes[keyof typeof TriggerTypes];

// ============================================================================
// WORKFLOWS - Reusable workflow definitions
// ============================================================================

export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Workflow identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Workflow definition
  steps: jsonb("steps").notNull(), // Array of step definitions
  
  // Execution settings
  defaultExecutionMode: text("default_execution_mode").default("sequential").notNull(),
  maxParallelTasks: integer("max_parallel_tasks").default(3),
  timeoutSeconds: integer("timeout_seconds").default(3600), // 1 hour default
  
  // State
  enabled: boolean("enabled").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// ============================================================================
// EXECUTOR STATE - Track executor status
// ============================================================================

export const executorState = pgTable("executor_state", {
  id: varchar("id").primaryKey().default("singleton"), // Only one row
  
  // Executor status
  status: text("status").default("stopped").notNull(), // running, stopped, paused
  
  // Current execution
  currentTaskId: varchar("current_task_id"),
  runningTaskIds: text("running_task_ids").array(), // For parallel execution
  
  // Statistics
  tasksProcessed: integer("tasks_processed").default(0).notNull(),
  tasksFailed: integer("tasks_failed").default(0).notNull(),
  lastActivityAt: timestamp("last_activity_at"),
  
  // Settings
  maxParallelTasks: integer("max_parallel_tasks").default(3),
  pollIntervalMs: integer("poll_interval_ms").default(5000),
  
  // Timestamps
  startedAt: timestamp("started_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ExecutorState = typeof executorState.$inferSelect;

// ============================================================================
// COLLABORATIVE EDITING - Real-time collaborative sessions
// ============================================================================

/**
 * COLLABORATIVE SESSIONS TABLE
 * ----------------------------
 * Stores active collaborative editing sessions where multiple participants
 * (users and AI) can edit files together in real-time.
 */
export const collaborativeSessions = pgTable("collaborative_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Session identity
  name: text("name").notNull(),
  description: text("description"),
  
  // Owner/host of the session
  hostUserId: varchar("host_user_id").references(() => users.id),
  
  // Files being edited in this session
  files: jsonb("files").notNull().default([]), // Array of {path, content, language}
  
  // Session settings
  isVoiceEnabled: boolean("is_voice_enabled").default(true).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  maxParticipants: integer("max_participants").default(5),
  
  // State
  status: text("status").default("active").notNull(), // active, paused, ended
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const insertCollaborativeSessionSchema = createInsertSchema(collaborativeSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  endedAt: true,
});
export type InsertCollaborativeSession = z.infer<typeof insertCollaborativeSessionSchema>;
export type CollaborativeSession = typeof collaborativeSessions.$inferSelect;

/**
 * SESSION PARTICIPANTS TABLE
 * --------------------------
 * Tracks who is currently participating in a collaborative session.
 */
export const sessionParticipants = pgTable("session_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  sessionId: varchar("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Participant identity (for AI or anonymous users)
  participantType: text("participant_type").default("user").notNull(), // user, ai, guest
  displayName: text("display_name").notNull(),
  avatarColor: text("avatar_color").default("#4285f4"),
  
  // Permissions
  canEdit: boolean("can_edit").default(true).notNull(),
  canVoice: boolean("can_voice").default(true).notNull(),
  
  // Current state
  isActive: boolean("is_active").default(true).notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  
  // Timestamps
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
});

export const insertSessionParticipantSchema = createInsertSchema(sessionParticipants).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
});
export type InsertSessionParticipant = z.infer<typeof insertSessionParticipantSchema>;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;

/**
 * CURSOR POSITIONS TABLE
 * ----------------------
 * Stores real-time cursor positions for each participant in a session.
 * Updated frequently via WebSocket, periodically persisted.
 */
export const cursorPositions = pgTable("cursor_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  sessionId: varchar("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  participantId: varchar("participant_id").references(() => sessionParticipants.id, { onDelete: "cascade" }).notNull(),
  
  // File context
  filePath: text("file_path").notNull(),
  
  // Cursor position
  line: integer("line").notNull(),
  column: integer("column").notNull(),
  
  // Selection (if any)
  selectionStartLine: integer("selection_start_line"),
  selectionStartColumn: integer("selection_start_column"),
  selectionEndLine: integer("selection_end_line"),
  selectionEndColumn: integer("selection_end_column"),
  
  // Timestamps
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CursorPosition = typeof cursorPositions.$inferSelect;

/**
 * EDIT OPERATIONS TABLE
 * ---------------------
 * Stores edit operations for conflict resolution (OT/CRDT).
 * Each operation represents a change to the document.
 */
export const editOperations = pgTable("edit_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  sessionId: varchar("session_id").references(() => collaborativeSessions.id, { onDelete: "cascade" }).notNull(),
  participantId: varchar("participant_id").references(() => sessionParticipants.id).notNull(),
  
  // File context
  filePath: text("file_path").notNull(),
  
  // Operation details
  operationType: text("operation_type").notNull(), // insert, delete, replace
  position: integer("position").notNull(), // Character position in document
  length: integer("length"), // For delete/replace: number of chars affected
  text: text("text"), // For insert/replace: the text to insert
  
  // Versioning for OT
  baseVersion: integer("base_version").notNull(),
  resultVersion: integer("result_version").notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_edit_ops_session").on(table.sessionId),
  index("idx_edit_ops_version").on(table.sessionId, table.baseVersion),
]);

export type EditOperation = typeof editOperations.$inferSelect;

// =============================================================================
// JOB ORCHESTRATION TABLES
// For multi-worker agent job processing with DAG dependencies
// =============================================================================

/**
 * AGENT JOBS TABLE
 * -----------------
 * Tracks jobs submitted to the orchestration system.
 * Supports DAG-based dependencies, priority queues, and parallel execution.
 */
export const agentJobs = pgTable("agent_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Job identification
  name: text("name").notNull(),
  type: text("type").notNull(), // 'prompt', 'tool', 'composite', 'workflow'
  
  // Priority (0 = highest, 10 = lowest)
  priority: integer("priority").default(5).notNull(),
  
  // Parent job (for hierarchical/composite jobs)
  parentJobId: varchar("parent_job_id").references((): any => agentJobs.id, { onDelete: "cascade" }),
  
  // Dependencies (array of job IDs that must complete before this job runs)
  dependencies: text("dependencies").array().default([]),
  
  // Execution mode
  executionMode: text("execution_mode").default("sequential").notNull(), // 'sequential', 'parallel', 'batch'
  
  // Job payload (prompt, tool args, etc.)
  payload: jsonb("payload").notNull(),
  
  // Status tracking
  status: text("status").default("pending").notNull(), // 'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'
  
  // Assignment
  workerId: varchar("worker_id"),
  
  // Retry configuration
  maxRetries: integer("max_retries").default(3),
  retryCount: integer("retry_count").default(0),
  
  // Timeout (milliseconds)
  timeout: integer("timeout").default(300000), // 5 minutes default
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  cronExpression: text("cron_expression"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // User association
  userId: varchar("user_id"),
}, (table) => [
  index("idx_agent_jobs_status").on(table.status),
  index("idx_agent_jobs_priority").on(table.priority),
  index("idx_agent_jobs_parent").on(table.parentJobId),
  index("idx_agent_jobs_scheduled").on(table.scheduledFor),
]);

export const insertAgentJobSchema = createInsertSchema(agentJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertAgentJob = z.infer<typeof insertAgentJobSchema>;
export type AgentJob = typeof agentJobs.$inferSelect;

/**
 * JOB RESULTS TABLE
 * ------------------
 * Stores outputs from completed jobs.
 * Supports structured results, streaming data, and aggregation.
 */
export const jobResults = pgTable("job_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Job reference
  jobId: varchar("job_id").references(() => agentJobs.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Result data
  success: boolean("success").notNull(),
  output: jsonb("output"), // Structured result data
  error: text("error"), // Error message if failed
  
  // Token usage tracking
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  
  // Execution metrics
  durationMs: integer("duration_ms"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_job_results_job").on(table.jobId),
]);

export const insertJobResultSchema = createInsertSchema(jobResults).omit({
  id: true,
  createdAt: true,
});
export type InsertJobResult = z.infer<typeof insertJobResultSchema>;
export type JobResult = typeof jobResults.$inferSelect;

/**
 * AGENT WORKERS TABLE
 * --------------------
 * Tracks active workers in the pool.
 * Used for health checks, load balancing, and auto-restart.
 */
export const agentWorkers = pgTable("agent_workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Worker identification
  name: text("name").notNull(),
  type: text("type").default("gemini").notNull(), // 'gemini', 'custom'
  
  // Status
  status: text("status").default("idle").notNull(), // 'idle', 'busy', 'offline', 'error'
  
  // Current job
  currentJobId: varchar("current_job_id").references(() => agentJobs.id),
  
  // Capacity
  maxConcurrency: integer("max_concurrency").default(1),
  activeJobs: integer("active_jobs").default(0),
  
  // Health tracking
  lastHeartbeat: timestamp("last_heartbeat").defaultNow().notNull(),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  // Metrics
  totalJobsProcessed: integer("total_jobs_processed").default(0),
  totalTokensUsed: bigint("total_tokens_used", { mode: "number" }).default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_workers_status").on(table.status),
  index("idx_agent_workers_heartbeat").on(table.lastHeartbeat),
]);

export const insertAgentWorkerSchema = createInsertSchema(agentWorkers).omit({
  id: true,
  createdAt: true,
  lastHeartbeat: true,
});
export type InsertAgentWorker = z.infer<typeof insertAgentWorkerSchema>;
export type AgentWorker = typeof agentWorkers.$inferSelect;

// =============================================================================
// AGENT IDENTITY SYSTEM
// For per-agent attribution of GitHub/Google Workspace actions
// =============================================================================

/**
 * AGENT IDENTITIES TABLE
 * ----------------------
 * Stores distinct agent identities for attribution of automated actions.
 * Each agent has its own identity that can be used to sign commits, PRs,
 * issues, and other automated operations.
 * 
 * While actions are authenticated using the primary user's API key,
 * the author/creator is attributed to the specific agent.
 */
export const agentIdentities = pgTable("agent_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent identification
  name: text("name").notNull().unique(), // e.g., "Agentia Compiler"
  email: text("email").notNull(), // Git commit email, e.g., "compiler@agentia.dev"
  username: text("username"), // Optional GitHub username if dedicated account exists
  
  // Agent type and permissions
  agentType: text("agent_type").notNull(), // 'compiler', 'guest', 'specialized'
  permissionLevel: text("permission_level").default("full").notNull(), // 'full', 'limited', 'readonly'
  
  // Display information
  displayName: text("display_name").notNull(), // Human-readable name
  avatarUrl: text("avatar_url"), // Optional avatar image URL
  description: text("description"), // Agent's purpose/role
  
  // Configuration
  githubSignature: text("github_signature"), // Signature added to commits/PRs
  enabled: boolean("enabled").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAgentIdentitySchema = createInsertSchema(agentIdentities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentIdentity = z.infer<typeof insertAgentIdentitySchema>;
export type AgentIdentity = typeof agentIdentities.$inferSelect;

/**
 * AGENT ACTIVITY LOG TABLE
 * -------------------------
 * Audit trail of all actions performed by agents.
 * Tracks GitHub commits, PRs, issues, and Google Workspace operations.
 */
export const agentActivityLog = pgTable("agent_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent reference
  agentId: varchar("agent_id").references(() => agentIdentities.id, { onDelete: "cascade" }).notNull(),
  
  // Activity details
  activityType: text("activity_type").notNull(), // 'commit', 'pr', 'issue', 'email', 'doc_edit', etc.
  platform: text("platform").notNull(), // 'github', 'gmail', 'drive', 'calendar', etc.
  
  // Resource identification
  resourceType: text("resource_type"), // 'repository', 'issue', 'pull_request', 'email', 'document'
  resourceId: text("resource_id"), // External ID (PR number, commit SHA, email ID, etc.)
  resourceUrl: text("resource_url"), // Direct link to the resource
  
  // Action details
  action: text("action").notNull(), // 'create', 'update', 'delete', 'comment'
  title: text("title"), // Brief description of the action
  metadata: jsonb("metadata"), // Additional context (commit message, PR body, etc.)
  
  // Result
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_activity_agent").on(table.agentId),
  index("idx_agent_activity_type").on(table.activityType),
  index("idx_agent_activity_platform").on(table.platform),
]);

export const insertAgentActivityLogSchema = createInsertSchema(agentActivityLog).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentActivityLog = z.infer<typeof insertAgentActivityLogSchema>;
export type AgentActivityLog = typeof agentActivityLog.$inferSelect;

/**
 * Agent type constants
 */
export const AgentTypes = {
  COMPILER: "compiler",     // Main AI agent with full permissions
  GUEST: "guest",           // Guest user agent with limited permissions
  SPECIALIZED: "specialized" // Specialized agents for specific tasks
} as const;

export type AgentType = typeof AgentTypes[keyof typeof AgentTypes];

/**
 * Permission level constants
 */
export const PermissionLevels = {
  FULL: "full",       // Full access to all operations
  LIMITED: "limited", // Limited access (read + basic write)
  READONLY: "readonly" // Read-only access
} as const;

export type PermissionLevel = typeof PermissionLevels[keyof typeof PermissionLevels];
