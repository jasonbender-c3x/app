/**
 * =============================================================================
 * NEBULA CHAT - DATABASE STORAGE LAYER
 * =============================================================================
 * 
 * This file implements the data access layer for the Meowstik application.
 * It provides a clean abstraction between the business logic (routes) and
 * the underlying PostgreSQL database using Drizzle ORM.
 * 
 * ARCHITECTURE PATTERN: Repository Pattern
 * -----------------------------------------
 * The storage layer follows the Repository pattern, which:
 * - Encapsulates all database operations in a single place
 * - Makes the codebase easier to test (can mock the storage interface)
 * - Allows swapping database implementations without changing business logic
 * - Provides a clean API for CRUD operations on chats and messages
 * 
 * CONNECTION MANAGEMENT:
 * ----------------------
 * Uses pg (node-postgres) connection pooling for efficient database connections.
 * The pool automatically manages connection lifecycle, reusing connections
 * and handling timeouts appropriately.
 * 
 * EXPORTS:
 * --------
 * - IStorage: Interface defining all available storage operations
 * - DrizzleStorage: PostgreSQL implementation using Drizzle ORM
 * - storage: Singleton instance of DrizzleStorage for app-wide use
 * =============================================================================
 */

import { 
  type Chat, 
  type InsertChat, 
  type Message, 
  type InsertMessage,
  type Attachment,
  type InsertAttachment,
  type Draft,
  type InsertDraft,
  type ToolTask,
  type InsertToolTask,
  type ExecutionLog,
  type InsertExecutionLog,
  type DocumentChunk,
  type InsertDocumentChunk,
  type GoogleOAuthTokens,
  type InsertGoogleOAuthTokens,
  type User,
  type UpsertUser,
  type Feedback,
  type InsertFeedback,
  type QueuedTask,
  type InsertQueuedTask,
  type Schedule,
  type InsertSchedule,
  type Trigger,
  type InsertTrigger,
  type Workflow,
  type InsertWorkflow,
  type ExecutorState,
  type LlmUsage,
  type InsertLlmUsage,
  type AgentIdentity,
  type InsertAgentIdentity,
  type AgentActivityLog,
  type InsertAgentActivityLog,
  chats,
  messages,
  attachments,
  drafts,
  toolTasks,
  executionLogs,
  documentChunks,
  googleOAuthTokens,
  users,
  feedback,
  queuedTasks,
  schedules,
  triggers,
  workflows,
  executorState,
  llmUsage,
  agentIdentities,
  agentActivityLog
} from "@shared/schema";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, desc, and, lte, lt, or, sql, isNull, isNotNull, inArray, arrayContains } from "drizzle-orm";
import { Pool } from "pg";

/**
 * Retry an async operation with exponential backoff
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Initial delay in ms (default: 1000)
 * @returns The result of the operation
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Database operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Transaction context type for Drizzle operations
 * Used when running multiple operations atomically
 */
export type TransactionContext = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

/**
 * STORAGE INTERFACE
 * -----------------
 * Defines the contract for all storage operations in the application.
 * Any storage implementation (PostgreSQL, in-memory, etc.) must implement
 * all methods defined in this interface.
 * 
 * This interface makes it easy to:
 * - Write unit tests with mock implementations
 * - Switch to different databases if needed
 * - Understand what operations are available at a glance
 * 
 * METHODS:
 * --------
 * Chat Operations:
 * - createChat(): Create a new chat conversation
 * - getChats(): Retrieve all chats, ordered by most recently updated
 * - getChatById(): Get a specific chat by its UUID
 * - updateChatTitle(): Change the title of an existing chat
 * 
 * Message Operations:
 * - addMessage(): Add a new message to a chat
 * - getMessagesByChatId(): Get all messages for a specific chat
 */
export interface IStorage {
  /**
   * Creates a new chat conversation
   * @param chat - The chat data (title required)
   * @returns The created chat with auto-generated id and timestamps
   */
  createChat(chat: InsertChat): Promise<Chat>;
  
  /**
   * Retrieves all chats from the database
   * @returns Array of all chats, sorted by updatedAt descending (newest first)
   */
  getChats(): Promise<Chat[]>;
  
  /**
   * Finds a specific chat by its unique identifier
   * @param id - The UUID of the chat to find
   * @returns The chat if found, undefined otherwise
   */
  getChatById(id: string): Promise<Chat | undefined>;
  
  /**
   * Updates the title of an existing chat
   * Also updates the updatedAt timestamp
   * @param id - The UUID of the chat to update
   * @param title - The new title for the chat
   */
  updateChatTitle(id: string, title: string): Promise<void>;
  
  /**
   * Adds a new message to a chat conversation
   * Also updates the parent chat's updatedAt timestamp
   * @param message - The message data (chatId, role, content required)
   * @returns The created message with auto-generated id and timestamp
   */
  addMessage(message: InsertMessage): Promise<Message>;
  
  /**
   * Retrieves messages belonging to a specific chat with optional pagination
   * @param chatId - The UUID of the chat
   * @param options - Optional pagination: limit (max messages), before (cursor for older messages)
   * @returns Array of messages, sorted by createdAt ascending (oldest first)
   */
  getMessagesByChatId(chatId: string, options?: { limit?: number; before?: string }): Promise<Message[]>;
  
  /**
   * Retrieves the most recent user messages across all chats
   * @param limit - Maximum number of messages to retrieve
   * @returns Array of user messages, sorted by createdAt descending (newest first)
   */
  getRecentUserMessages(limit: number): Promise<Message[]>;

  /**
   * Updates the metadata field of a message
   * @param messageId - The UUID of the message
   * @param metadata - The metadata object (stored as JSONB)
   */
  updateMessageMetadata(messageId: string, metadata: unknown): Promise<void>;

  /**
   * Retrieves a specific message by its ID
   * @param id - The UUID of the message
   * @returns The message if found, undefined otherwise
   */
  getMessageById(id: string): Promise<Message | undefined>;

  // =========================================================================
  // ATTACHMENT OPERATIONS
  // =========================================================================
  
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  getAttachmentsByMessageId(messageId: string): Promise<Attachment[]>;
  getAttachmentsByDraftId(draftId: string): Promise<Attachment[]>;
  deleteAttachment(id: string): Promise<void>;

  // =========================================================================
  // DRAFT OPERATIONS
  // =========================================================================
  
  createDraft(draft: InsertDraft): Promise<Draft>;
  getDraftById(id: string): Promise<Draft | undefined>;
  getActiveDraftByChat(chatId: string): Promise<Draft | undefined>;
  updateDraft(id: string, updates: Partial<InsertDraft>): Promise<Draft>;
  submitDraft(id: string): Promise<Draft>;

  // =========================================================================
  // TOOL TASK OPERATIONS
  // =========================================================================
  
  createToolTask(task: InsertToolTask): Promise<ToolTask>;
  getToolTasksByMessage(messageId: string): Promise<ToolTask[]>;
  updateToolTaskStatus(id: string, status: string, result?: unknown, error?: string): Promise<ToolTask>;

  // =========================================================================
  // EXECUTION LOG OPERATIONS
  // =========================================================================
  
  createExecutionLog(log: InsertExecutionLog): Promise<ExecutionLog>;
  getExecutionLogsByTask(taskId: string): Promise<ExecutionLog[]>;

  // =========================================================================
  // DOCUMENT CHUNK OPERATIONS (RAG)
  // =========================================================================
  
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  getDocumentChunksByDocumentId(documentId: string): Promise<DocumentChunk[]>;
  getDocumentChunksByAttachmentId(attachmentId: string): Promise<DocumentChunk[]>;
  getAllDocumentChunks(): Promise<DocumentChunk[]>;
  deleteDocumentChunksByDocumentId(documentId: string): Promise<void>;

  // =========================================================================
  // GOOGLE OAUTH TOKEN OPERATIONS
  // =========================================================================
  
  saveGoogleTokens(tokens: InsertGoogleOAuthTokens): Promise<GoogleOAuthTokens>;
  getGoogleTokens(): Promise<GoogleOAuthTokens | undefined>;
  deleteGoogleTokens(): Promise<void>;

  // =========================================================================
  // DEBUG OPERATIONS
  // =========================================================================
  
  getDebugDatabaseInfo(): Promise<Array<{ name: string; rowCount: number; columns: string[] }>>;
  getDebugLogs(limit?: number): Promise<ExecutionLog[]>;
  getTableData(tableName: string, limit?: number, offset?: number): Promise<{ rows: unknown[]; total: number }>;
  updateTableRecord(tableName: string, recordId: string, data: Record<string, unknown>): Promise<boolean>;
  deleteTableRecord(tableName: string, recordId: string): Promise<boolean>;

  // =========================================================================
  // USER OPERATIONS (Required for Replit Auth)
  // =========================================================================
  
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // =========================================================================
  // FEEDBACK OPERATIONS
  // =========================================================================
  
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getFeedback(limit?: number, status?: 'all' | 'pending' | 'submitted'): Promise<Feedback[]>;
  getFeedbackStats(): Promise<{ total: number; positive: number; negative: number; withComments: number }>;
  markFeedbackSubmitted(ids: string[]): Promise<void>;

  // =========================================================================
  // LLM USAGE TRACKING OPERATIONS
  // =========================================================================
  
  logLlmUsage(data: InsertLlmUsage): Promise<LlmUsage>;
  getLlmUsageStats(): Promise<{ 
    totalCalls: number; 
    totalPromptTokens: number; 
    totalCompletionTokens: number;
    totalTokens: number;
    averageLatencyMs: number;
  }>;
  getLlmUsageByChat(chatId: string): Promise<LlmUsage[]>;
  getRecentLlmUsage(limit?: number): Promise<LlmUsage[]>;

  // =========================================================================
  // QUEUED TASK OPERATIONS (AI batch processing queue)
  // =========================================================================
  
  createQueuedTask(task: InsertQueuedTask): Promise<QueuedTask>;
  createQueuedTasks(tasks: InsertQueuedTask[]): Promise<QueuedTask[]>;
  getQueuedTasks(options?: { status?: string; chatId?: string; limit?: number }): Promise<QueuedTask[]>;
  getQueuedTaskById(id: string): Promise<QueuedTask | undefined>;
  getQueuedTasksByParentId(parentId: string): Promise<QueuedTask[]>;
  updateQueuedTask(id: string, updates: Partial<InsertQueuedTask> & { status?: string; output?: unknown; error?: string; startedAt?: Date; completedAt?: Date; actualDuration?: number }): Promise<QueuedTask>;
  deleteQueuedTask(id: string): Promise<void>;
  getNextPendingTask(): Promise<QueuedTask | undefined>;
  getQueueStats(): Promise<{ pending: number; running: number; completed: number; failed: number }>;
  getTasksWaitingForInput(): Promise<QueuedTask[]>;
  getTasksByDependency(dependencyId: string): Promise<QueuedTask[]>;
  getReadyTasks(limit?: number): Promise<QueuedTask[]>;

  // =========================================================================
  // SCHEDULE OPERATIONS (Cron jobs)
  // =========================================================================
  
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getSchedules(options?: { enabled?: boolean }): Promise<Schedule[]>;
  getScheduleById(id: string): Promise<Schedule | undefined>;
  updateSchedule(id: string, updates: Partial<InsertSchedule> & { lastRunAt?: Date; nextRunAt?: Date; runCount?: number; lastError?: string; consecutiveFailures?: number }): Promise<Schedule>;
  deleteSchedule(id: string): Promise<void>;
  getDueSchedules(): Promise<Schedule[]>;

  // =========================================================================
  // TRIGGER OPERATIONS (Event-driven execution)
  // =========================================================================
  
  createTrigger(trigger: InsertTrigger): Promise<Trigger>;
  getTriggers(options?: { enabled?: boolean; triggerType?: string }): Promise<Trigger[]>;
  getTriggerById(id: string): Promise<Trigger | undefined>;
  getTriggersByType(type: string): Promise<Trigger[]>;
  updateTrigger(id: string, updates: Partial<InsertTrigger> & { lastTriggeredAt?: Date; triggerCount?: number }): Promise<Trigger>;
  deleteTrigger(id: string): Promise<void>;

  // =========================================================================
  // WORKFLOW OPERATIONS (Reusable workflow definitions)
  // =========================================================================
  
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  getWorkflows(options?: { enabled?: boolean }): Promise<Workflow[]>;
  getWorkflowById(id: string): Promise<Workflow | undefined>;
  updateWorkflow(id: string, updates: Partial<InsertWorkflow>): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;

  // =========================================================================
  // EXECUTOR STATE OPERATIONS
  // =========================================================================
  
  getExecutorState(): Promise<ExecutorState | undefined>;
  updateExecutorState(updates: Partial<ExecutorState>): Promise<ExecutorState>;
  initializeExecutorState(): Promise<ExecutorState>;

  // =========================================================================
  // TRANSACTION SUPPORT
  // =========================================================================
  
  /**
   * Executes multiple database operations atomically within a transaction.
   * If any operation fails, all changes are rolled back.
   * 
   * @param fn - Function receiving transaction context to execute operations
   * @returns The result of the transaction function
   * 
   * @example
   * const result = await storage.transaction(async (tx) => {
   *   const message = await storage.addMessageTx(tx, messageData);
   *   await storage.createAttachmentTx(tx, { messageId: message.id, ... });
   *   return message;
   * });
   */
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  /**
   * Adds a message within an existing transaction context
   */
  addMessageTx(tx: TransactionContext, message: InsertMessage): Promise<Message>;

  /**
   * Creates an attachment within an existing transaction context
   */
  createAttachmentTx(tx: TransactionContext, attachment: InsertAttachment): Promise<Attachment>;

  /**
   * Creates a tool task within an existing transaction context
   */
  createToolTaskTx(tx: TransactionContext, task: InsertToolTask): Promise<ToolTask>;

  /**
   * Creates a message with attachments and tool tasks atomically
   * All operations succeed or fail together
   */
  createMessageWithRelations(
    message: InsertMessage,
    attachments?: InsertAttachment[],
    toolTasks?: InsertToolTask[]
  ): Promise<{ message: Message; attachments: Attachment[]; toolTasks: ToolTask[] }>;

  // =========================================================================
  // AGENT IDENTITY OPERATIONS
  // =========================================================================
  
  /**
   * Creates a new agent identity
   * @param agent - The agent identity data
   * @returns The created agent with auto-generated id and timestamps
   */
  createAgentIdentity(agent: InsertAgentIdentity): Promise<AgentIdentity>;
  
  /**
   * Retrieves all agent identities
   * @returns Array of all agents
   */
  getAgentIdentities(): Promise<AgentIdentity[]>;
  
  /**
   * Retrieves enabled agent identities only
   * @returns Array of enabled agents
   */
  getEnabledAgents(): Promise<AgentIdentity[]>;
  
  /**
   * Finds a specific agent by ID
   * @param id - The UUID of the agent
   * @returns The agent if found, undefined otherwise
   */
  getAgentById(id: string): Promise<AgentIdentity | undefined>;
  
  /**
   * Finds a specific agent by name
   * @param name - The unique name of the agent
   * @returns The agent if found, undefined otherwise
   */
  getAgentByName(name: string): Promise<AgentIdentity | undefined>;
  
  /**
   * Updates an agent identity
   * @param id - The UUID of the agent
   * @param updates - Partial agent data to update
   * @returns The updated agent
   */
  updateAgentIdentity(id: string, updates: Partial<InsertAgentIdentity>): Promise<AgentIdentity>;
  
  /**
   * Logs an agent activity
   * @param activity - The activity log data
   * @returns The created activity log entry
   */
  logAgentActivity(activity: InsertAgentActivityLog): Promise<AgentActivityLog>;
  
  /**
   * Retrieves activity logs for a specific agent
   * @param agentId - The UUID of the agent
   * @param limit - Maximum number of logs to retrieve
   * @returns Array of activity logs, sorted by createdAt descending
   */
  getAgentActivity(agentId: string, limit?: number): Promise<AgentActivityLog[]>;
  
  /**
   * Retrieves recent agent activities across all agents
   * @param limit - Maximum number of logs to retrieve
   * @returns Array of activity logs with agent info, sorted by createdAt descending
   */
  getRecentAgentActivity(limit?: number): Promise<(AgentActivityLog & { agent: AgentIdentity })[]>;
}

/**
 * DRIZZLE STORAGE IMPLEMENTATION
 * ------------------------------
 * PostgreSQL implementation of the IStorage interface using Drizzle ORM.
 * 
 * This class:
 * - Manages a connection pool to the PostgreSQL database
 * - Translates TypeScript operations into SQL queries via Drizzle
 * - Handles the relationship between chats and messages
 * - Ensures data consistency (e.g., updating chat timestamps on new messages)
 * 
 * DRIZZLE ORM BENEFITS:
 * - Type-safe queries derived from schema definitions
 * - Automatic SQL generation with proper escaping
 * - Clean, readable query syntax
 * - Excellent TypeScript integration
 */
export class DrizzleStorage implements IStorage {
  /**
   * Drizzle database instance connected to PostgreSQL
   * Created lazily on first database operation
   */
  private db: NodePgDatabase | null = null;
  
  /**
   * PostgreSQL connection pool
   * Configured with retry-friendly settings for handling temporary unavailability
   */
  private pool: Pool | null = null;

  /**
   * Creates a new DrizzleStorage instance
   * 
   * Uses lazy initialization - the actual database connection is only
   * established when the first query is made. This prevents the application
   * from crashing on startup if the database is temporarily unavailable.
   */
  constructor() {
    // Lazy initialization - connection pool is created on first use
  }
  
  /**
   * Gets or creates the database connection with lazy initialization
   * Includes retry logic for handling temporary database unavailability
   * Made public for use by services that need direct database access
   */
  public getDb(): NodePgDatabase {
    if (!this.db) {
      // Create a connection pool to PostgreSQL with resilient settings
      // Pool handles connections: opens on demand, reuses, closes when idle
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
      });
      
      // Handle pool errors gracefully to prevent crash
      this.pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err.message);
      });
      
      // Initialize Drizzle ORM with the connection pool
      this.db = drizzle(this.pool);
    }
    return this.db;
  }

  /**
   * Creates a new chat conversation in the database
   * 
   * Uses Drizzle's insert().values().returning() pattern to:
   * 1. Insert the chat record with provided title
   * 2. Let PostgreSQL auto-generate the id, createdAt, and updatedAt
   * 3. Return the complete record including generated values
   * 
   * @param chat - Object containing the chat title
   * @returns The complete Chat object with all fields populated
   * 
   * @example
   * const chat = await storage.createChat({ title: "New Conversation" });
   * console.log(chat.id); // UUID like "a1b2c3d4-..."
   */
  async createChat(chat: InsertChat): Promise<Chat> {
    // Insert and return the created record in a single database round-trip
    const [newChat] = await this.getDb().insert(chats).values(chat).returning();
    return newChat;
  }

  /**
   * Retrieves all chat conversations from the database
   * 
   * Orders by updatedAt descending so the most recently active chats
   * appear first in the sidebar. This gives users quick access to
   * conversations they're actively using.
   * 
   * @returns Array of all Chat objects, sorted by most recent activity
   * 
   * @example
   * const allChats = await storage.getChats();
   * allChats.forEach(chat => console.log(chat.title));
   */
  async getChats(): Promise<Chat[]> {
    // Select all chats, newest activity first
    return await this.getDb().select().from(chats).orderBy(desc(chats.updatedAt));
  }

  /**
   * Finds a specific chat by its unique identifier
   * 
   * Uses eq() for exact matching on the primary key.
   * Returns undefined if no chat exists with the given ID.
   * 
   * @param id - The UUID of the chat to find
   * @returns The Chat if found, undefined otherwise
   * 
   * @example
   * const chat = await storage.getChatById("a1b2c3d4-...");
   * if (chat) {
   *   console.log(`Found: ${chat.title}`);
   * }
   */
  async getChatById(id: string): Promise<Chat | undefined> {
    // Destructure the first (and only) result, or undefined if not found
    const [chat] = await this.getDb().select().from(chats).where(eq(chats.id, id));
    return chat;
  }

  /**
   * Updates the title of an existing chat
   * 
   * Also updates the updatedAt timestamp to reflect the modification.
   * This is useful when the user renames a conversation.
   * 
   * @param id - The UUID of the chat to update
   * @param title - The new title for the chat
   * 
   * @example
   * await storage.updateChatTitle("a1b2c3d4-...", "Renamed Chat");
   */
  async updateChatTitle(id: string, title: string): Promise<void> {
    await this.getDb()
      .update(chats)
      .set({ 
        title,                    // Set the new title
        updatedAt: new Date()     // Update the modification timestamp
      })
      .where(eq(chats.id, id));   // Only update the matching chat
  }

  /**
   * Adds a new message to a chat conversation
   * 
   * This method does two things atomically within a transaction:
   * 1. Inserts the new message into the messages table
   * 2. Updates the parent chat's updatedAt timestamp
   * 
   * The second step ensures that the chat list stays properly sorted
   * with recently active conversations at the top.
   * 
   * @param message - Object containing chatId, role ("user" or "ai"), and content
   * @returns The complete Message object with auto-generated id and timestamp
   * 
   * @example
   * const msg = await storage.addMessage({
   *   chatId: "chat-uuid",
   *   role: "user",
   *   content: "Hello, how are you?"
   * });
   */
  async addMessage(message: InsertMessage): Promise<Message> {
    // Use transaction to ensure both operations succeed or fail together
    return await this.getDb().transaction(async (tx) => {
      // Step 1: Insert the message and get the complete record back
      const [newMessage] = await tx.insert(messages).values(message).returning();
      
      // Step 2: Update the parent chat's timestamp to reflect new activity
      await tx
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, message.chatId));
      
      return newMessage;
    });
  }

  /**
   * Retrieves messages belonging to a specific chat with optional pagination
   * 
   * Orders by createdAt ascending (oldest first) so messages
   * display in chronological order in the chat view.
   * 
   * @param chatId - The UUID of the chat whose messages to retrieve
   * @param options - Optional pagination: limit (max messages), before (cursor for older messages)
   * @returns Array of Message objects, sorted chronologically
   * 
   * @example
   * // Get last 20 messages
   * const messages = await storage.getMessagesByChatId("chat-uuid", { limit: 20 });
   * 
   * // Get 20 messages before a specific message (for loading older history)
   * const older = await storage.getMessagesByChatId("chat-uuid", { limit: 20, before: "msg-uuid" });
   */
  async getMessagesByChatId(chatId: string, options?: { limit?: number; before?: string }): Promise<Message[]> {
    const { limit, before } = options || {};
    
    // Build query with optional cursor-based pagination
    let query = this.getDb()
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt)); // Newest first for limit, we'll reverse later
    
    // If 'before' cursor provided, get messages older than that message
    if (before) {
      const cursorMessage = await this.getMessageById(before);
      if (cursorMessage) {
        query = this.getDb()
          .select()
          .from(messages)
          .where(and(
            eq(messages.chatId, chatId),
            lt(messages.createdAt, cursorMessage.createdAt)
          ))
          .orderBy(desc(messages.createdAt));
      }
    }
    
    // Apply limit if provided (get N most recent, or N before cursor)
    const result = limit 
      ? await query.limit(limit)
      : await query;
    
    // Reverse to chronological order (oldest first) for display
    return result.reverse();
  }

  /**
   * Updates the metadata field of a specific message
   * Used for async operations like autoexec that complete after the message is created
   */
  async updateMessageMetadata(messageId: string, metadata: unknown): Promise<void> {
    await this.getDb()
      .update(messages)
      .set({ metadata })
      .where(eq(messages.id, messageId));
  }

  /**
   * Retrieves a specific message by its ID
   */
  async getMessageById(id: string): Promise<Message | undefined> {
    const [message] = await this.getDb().select().from(messages).where(eq(messages.id, id));
    return message;
  }

  /**
   * Retrieves the most recent user messages across all chats
   * Used for scanning messages for embedded feedback
   */
  async getRecentUserMessages(limit: number): Promise<Message[]> {
    return await this.getDb()
      .select()
      .from(messages)
      .where(eq(messages.role, "user"))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  // =========================================================================
  // ATTACHMENT OPERATIONS IMPLEMENTATION
  // =========================================================================

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await this.getDb().insert(attachments).values(attachment).returning();
    return newAttachment;
  }

  async getAttachmentsByMessageId(messageId: string): Promise<Attachment[]> {
    return await this.getDb()
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, messageId))
      .orderBy(attachments.createdAt);
  }

  async getAttachmentsByDraftId(draftId: string): Promise<Attachment[]> {
    return await this.getDb()
      .select()
      .from(attachments)
      .where(eq(attachments.draftId, draftId))
      .orderBy(attachments.createdAt);
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.getDb().delete(attachments).where(eq(attachments.id, id));
  }

  // =========================================================================
  // DRAFT OPERATIONS IMPLEMENTATION
  // =========================================================================

  async createDraft(draft: InsertDraft): Promise<Draft> {
    const [newDraft] = await this.getDb().insert(drafts).values(draft).returning();
    return newDraft;
  }

  async getDraftById(id: string): Promise<Draft | undefined> {
    const [draft] = await this.getDb().select().from(drafts).where(eq(drafts.id, id));
    return draft;
  }

  async getActiveDraftByChat(chatId: string): Promise<Draft | undefined> {
    const [draft] = await this.getDb()
      .select()
      .from(drafts)
      .where(and(eq(drafts.chatId, chatId), eq(drafts.status, "active")));
    return draft;
  }

  async updateDraft(id: string, updates: Partial<InsertDraft>): Promise<Draft> {
    const [updated] = await this.getDb()
      .update(drafts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(drafts.id, id))
      .returning();
    return updated;
  }

  async submitDraft(id: string): Promise<Draft> {
    const [submitted] = await this.getDb()
      .update(drafts)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(drafts.id, id))
      .returning();
    return submitted;
  }

  // =========================================================================
  // TOOL TASK OPERATIONS IMPLEMENTATION
  // =========================================================================

  async createToolTask(task: InsertToolTask): Promise<ToolTask> {
    const [newTask] = await this.getDb().insert(toolTasks).values(task).returning();
    return newTask;
  }

  async getToolTasksByMessage(messageId: string): Promise<ToolTask[]> {
    return await this.getDb()
      .select()
      .from(toolTasks)
      .where(eq(toolTasks.messageId, messageId))
      .orderBy(toolTasks.createdAt);
  }

  async updateToolTaskStatus(
    id: string, 
    status: string, 
    result?: unknown, 
    error?: string
  ): Promise<ToolTask> {
    const updates: Record<string, unknown> = { status };
    if (result !== undefined) updates.result = result;
    if (error !== undefined) updates.error = error;
    if (status === "completed" || status === "failed") {
      updates.executedAt = new Date();
    }
    
    const [updated] = await this.getDb()
      .update(toolTasks)
      .set(updates)
      .where(eq(toolTasks.id, id))
      .returning();
    return updated;
  }

  // =========================================================================
  // EXECUTION LOG OPERATIONS IMPLEMENTATION
  // =========================================================================

  async createExecutionLog(log: InsertExecutionLog): Promise<ExecutionLog> {
    const [newLog] = await this.getDb().insert(executionLogs).values(log).returning();
    return newLog;
  }

  async getExecutionLogsByTask(taskId: string): Promise<ExecutionLog[]> {
    return await this.getDb()
      .select()
      .from(executionLogs)
      .where(eq(executionLogs.taskId, taskId))
      .orderBy(executionLogs.createdAt);
  }

  // =========================================================================
  // DOCUMENT CHUNK OPERATIONS IMPLEMENTATION (RAG)
  // =========================================================================

  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [newChunk] = await this.getDb().insert(documentChunks).values(chunk).returning();
    return newChunk;
  }

  async getDocumentChunksByDocumentId(documentId: string): Promise<DocumentChunk[]> {
    return await this.getDb()
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(documentChunks.chunkIndex);
  }

  async getDocumentChunksByAttachmentId(attachmentId: string): Promise<DocumentChunk[]> {
    return await this.getDb()
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.attachmentId, attachmentId))
      .orderBy(documentChunks.chunkIndex);
  }

  async getAllDocumentChunks(): Promise<DocumentChunk[]> {
    return await this.getDb()
      .select()
      .from(documentChunks)
      .orderBy(documentChunks.createdAt);
  }

  async deleteDocumentChunksByDocumentId(documentId: string): Promise<void> {
    await this.getDb().delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  }

  // =========================================================================
  // GOOGLE OAUTH TOKEN OPERATIONS IMPLEMENTATION
  // =========================================================================

  async saveGoogleTokens(tokens: InsertGoogleOAuthTokens): Promise<GoogleOAuthTokens> {
    const existing = await this.getGoogleTokens();
    if (existing) {
      const [updated] = await this.getDb()
        .update(googleOAuthTokens)
        .set({ ...tokens, updatedAt: new Date() })
        .where(eq(googleOAuthTokens.id, "default"))
        .returning();
      return updated;
    }
    const [newTokens] = await this.getDb()
      .insert(googleOAuthTokens)
      .values({ ...tokens, id: "default" })
      .returning();
    return newTokens;
  }

  async getGoogleTokens(): Promise<GoogleOAuthTokens | undefined> {
    const [tokens] = await this.getDb()
      .select()
      .from(googleOAuthTokens)
      .where(eq(googleOAuthTokens.id, "default"));
    return tokens;
  }

  async deleteGoogleTokens(): Promise<void> {
    await this.getDb().delete(googleOAuthTokens).where(eq(googleOAuthTokens.id, "default"));
  }

  // =========================================================================
  // DEBUG OPERATIONS IMPLEMENTATION
  // =========================================================================

  async getDebugDatabaseInfo(): Promise<Array<{ name: string; rowCount: number; columns: string[] }>> {
    const [chatRows, messageRows, attachmentRows, draftRows, taskRows, logRows, chunkRows, tokenRows] = await Promise.all([
      this.getDb().select().from(chats),
      this.getDb().select().from(messages),
      this.getDb().select().from(attachments),
      this.getDb().select().from(drafts),
      this.getDb().select().from(toolTasks),
      this.getDb().select().from(executionLogs),
      this.getDb().select().from(documentChunks),
      this.getDb().select().from(googleOAuthTokens),
    ]);

    return [
      { name: "chats", rowCount: chatRows.length, columns: ["id", "title", "createdAt", "updatedAt"] },
      { name: "messages", rowCount: messageRows.length, columns: ["id", "chatId", "role", "content", "createdAt", "metadata"] },
      { name: "attachments", rowCount: attachmentRows.length, columns: ["id", "messageId", "filename", "mimeType", "size", "storagePath", "createdAt"] },
      { name: "drafts", rowCount: draftRows.length, columns: ["id", "type", "title", "content", "recipient", "status", "createdAt", "updatedAt"] },
      { name: "tool_tasks", rowCount: taskRows.length, columns: ["id", "messageId", "toolName", "toolInput", "status", "result", "error", "createdAt", "completedAt"] },
      { name: "execution_logs", rowCount: logRows.length, columns: ["id", "taskId", "level", "message", "details", "createdAt"] },
      { name: "document_chunks", rowCount: chunkRows.length, columns: ["id", "attachmentId", "documentId", "content", "chunkIndex", "metadata", "createdAt"] },
      { name: "google_oauth_tokens", rowCount: tokenRows.length, columns: ["id", "accessToken", "refreshToken", "expiryDate", "tokenType", "scope", "createdAt", "updatedAt"] },
    ];
  }

  async getDebugLogs(limit: number = 50): Promise<ExecutionLog[]> {
    return await this.getDb()
      .select()
      .from(executionLogs)
      .orderBy(desc(executionLogs.createdAt))
      .limit(limit);
  }

  async getTableData(tableName: string, limit: number = 50, offset: number = 0): Promise<{ rows: unknown[]; total: number }> {
    const tableMap: Record<string, any> = {
      chats,
      messages,
      attachments,
      drafts,
      tool_tasks: toolTasks,
      execution_logs: executionLogs,
      document_chunks: documentChunks,
      google_oauth_tokens: googleOAuthTokens,
    };

    const table = tableMap[tableName];
    if (!table) {
      return { rows: [], total: 0 };
    }

    const allRows = await this.getDb().select().from(table);
    const total = allRows.length;
    const rows = allRows.slice(offset, offset + limit);

    return { rows, total };
  }

  async updateTableRecord(tableName: string, recordId: string, data: Record<string, unknown>): Promise<boolean> {
    const tableMap: Record<string, any> = {
      chats,
      messages,
      attachments,
      drafts,
      tool_tasks: toolTasks,
      execution_logs: executionLogs,
      document_chunks: documentChunks,
    };

    const table = tableMap[tableName];
    if (!table) {
      return false;
    }

    const { id, createdAt, updatedAt, ...updateData } = data;
    
    await this.getDb()
      .update(table)
      .set(updateData)
      .where(eq(table.id, recordId));

    return true;
  }

  async deleteTableRecord(tableName: string, recordId: string): Promise<boolean> {
    const tableMap: Record<string, any> = {
      chats,
      messages,
      attachments,
      drafts,
      tool_tasks: toolTasks,
      execution_logs: executionLogs,
      document_chunks: documentChunks,
    };

    const table = tableMap[tableName];
    if (!table) {
      return false;
    }

    await this.getDb()
      .delete(table)
      .where(eq(table.id, recordId));

    return true;
  }

  // =========================================================================
  // TRANSACTION SUPPORT IMPLEMENTATION
  // =========================================================================

  /**
   * Executes operations atomically within a database transaction.
   * If any operation throws, all changes are rolled back automatically.
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return await this.getDb().transaction(fn);
  }

  /**
   * Adds a message within an existing transaction context.
   * Use this when you need to create a message as part of a larger atomic operation.
   */
  async addMessageTx(tx: TransactionContext, message: InsertMessage): Promise<Message> {
    const [newMessage] = await tx.insert(messages).values(message).returning();
    await tx
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, message.chatId));
    return newMessage;
  }

  /**
   * Creates an attachment within an existing transaction context.
   */
  async createAttachmentTx(tx: TransactionContext, attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await tx.insert(attachments).values(attachment).returning();
    return newAttachment;
  }

  /**
   * Creates a tool task within an existing transaction context.
   */
  async createToolTaskTx(tx: TransactionContext, task: InsertToolTask): Promise<ToolTask> {
    const [newTask] = await tx.insert(toolTasks).values(task).returning();
    return newTask;
  }

  /**
   * Creates a message with its related attachments and tool tasks atomically.
   * All operations succeed together or all are rolled back.
   * 
   * This is the preferred method when creating a message that has associated
   * attachments or tool tasks, ensuring data consistency.
   */
  async createMessageWithRelations(
    message: InsertMessage,
    attachmentData?: InsertAttachment[],
    toolTaskData?: InsertToolTask[]
  ): Promise<{ message: Message; attachments: Attachment[]; toolTasks: ToolTask[] }> {
    return await this.transaction(async (tx) => {
      // Create the message first
      const newMessage = await this.addMessageTx(tx, message);
      
      // Create attachments with the message ID
      const createdAttachments: Attachment[] = [];
      if (attachmentData && attachmentData.length > 0) {
        for (const att of attachmentData) {
          const created = await this.createAttachmentTx(tx, {
            ...att,
            messageId: newMessage.id
          });
          createdAttachments.push(created);
        }
      }
      
      // Create tool tasks with the message ID
      const createdTasks: ToolTask[] = [];
      if (toolTaskData && toolTaskData.length > 0) {
        for (const task of toolTaskData) {
          const created = await this.createToolTaskTx(tx, {
            ...task,
            messageId: newMessage.id
          });
          createdTasks.push(created);
        }
      }
      
      return {
        message: newMessage,
        attachments: createdAttachments,
        toolTasks: createdTasks
      };
    });
  }

  // =========================================================================
  // USER OPERATIONS (Required for Replit Auth)
  // =========================================================================

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.getDb().select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.getDb()
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // =========================================================================
  // FEEDBACK OPERATIONS IMPLEMENTATION
  // =========================================================================

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await this.getDb().insert(feedback).values(data).returning();
    return newFeedback;
  }

  async getFeedback(limit: number = 50, status: 'all' | 'pending' | 'submitted' = 'all'): Promise<Feedback[]> {
    let query = this.getDb()
      .select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt))
      .limit(limit);
    
    if (status === 'pending') {
      query = query.where(isNull(feedback.submittedAt)) as typeof query;
    } else if (status === 'submitted') {
      query = query.where(isNotNull(feedback.submittedAt)) as typeof query;
    }
    
    return await query;
  }

  async getFeedbackStats(): Promise<{ total: number; positive: number; negative: number; withComments: number }> {
    const allFeedback = await this.getDb().select().from(feedback);
    return {
      total: allFeedback.length,
      positive: allFeedback.filter(f => f.rating === "positive").length,
      negative: allFeedback.filter(f => f.rating === "negative").length,
      withComments: allFeedback.filter(f => f.freeformText).length,
    };
  }

  async markFeedbackSubmitted(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.getDb()
      .update(feedback)
      .set({ submittedAt: new Date() })
      .where(inArray(feedback.id, ids));
  }

  // =========================================================================
  // LLM USAGE TRACKING IMPLEMENTATION
  // =========================================================================

  async logLlmUsage(data: InsertLlmUsage): Promise<LlmUsage> {
    const [usage] = await this.getDb().insert(llmUsage).values(data).returning();
    return usage;
  }

  async getLlmUsageStats(): Promise<{
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    averageLatencyMs: number;
  }> {
    const result = await this.getDb()
      .select({
        totalCalls: sql<number>`COUNT(*)::int`,
        totalPromptTokens: sql<number>`COALESCE(SUM(${llmUsage.promptTokens}), 0)::int`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${llmUsage.completionTokens}), 0)::int`,
        totalTokens: sql<number>`COALESCE(SUM(${llmUsage.totalTokens}), 0)::int`,
        averageLatencyMs: sql<number>`COALESCE(AVG(${llmUsage.durationMs}), 0)::int`,
      })
      .from(llmUsage);
    
    return result[0] || {
      totalCalls: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
    };
  }

  async getLlmUsageByChat(chatId: string): Promise<LlmUsage[]> {
    return await this.getDb()
      .select()
      .from(llmUsage)
      .where(eq(llmUsage.chatId, chatId))
      .orderBy(desc(llmUsage.createdAt));
  }

  async getRecentLlmUsage(limit: number = 50): Promise<LlmUsage[]> {
    return await this.getDb()
      .select()
      .from(llmUsage)
      .orderBy(desc(llmUsage.createdAt))
      .limit(limit);
  }

  // =========================================================================
  // QUEUED TASK OPERATIONS IMPLEMENTATION
  // =========================================================================

  async createQueuedTask(task: InsertQueuedTask): Promise<QueuedTask> {
    const [newTask] = await this.getDb().insert(queuedTasks).values(task).returning();
    return newTask;
  }

  async createQueuedTasks(tasks: InsertQueuedTask[]): Promise<QueuedTask[]> {
    if (tasks.length === 0) return [];
    return await this.getDb().insert(queuedTasks).values(tasks).returning();
  }

  async getQueuedTasks(options?: { status?: string; chatId?: string; limit?: number }): Promise<QueuedTask[]> {
    let query = this.getDb().select().from(queuedTasks);
    
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(queuedTasks.status, options.status));
    }
    if (options?.chatId) {
      conditions.push(eq(queuedTasks.chatId, options.chatId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    query = query.orderBy(desc(queuedTasks.priority), queuedTasks.createdAt) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    
    return await query;
  }

  async getQueuedTaskById(id: string): Promise<QueuedTask | undefined> {
    const [task] = await this.getDb().select().from(queuedTasks).where(eq(queuedTasks.id, id));
    return task;
  }

  async getQueuedTasksByParentId(parentId: string): Promise<QueuedTask[]> {
    return await this.getDb()
      .select()
      .from(queuedTasks)
      .where(eq(queuedTasks.parentId, parentId))
      .orderBy(queuedTasks.priority, queuedTasks.createdAt);
  }

  async updateQueuedTask(
    id: string, 
    updates: Partial<InsertQueuedTask> & { 
      status?: string; 
      output?: unknown; 
      error?: string; 
      startedAt?: Date; 
      completedAt?: Date;
      actualDuration?: number;
    }
  ): Promise<QueuedTask> {
    const [updatedTask] = await this.getDb()
      .update(queuedTasks)
      .set(updates)
      .where(eq(queuedTasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteQueuedTask(id: string): Promise<void> {
    await this.getDb().delete(queuedTasks).where(eq(queuedTasks.id, id));
  }

  async getNextPendingTask(): Promise<QueuedTask | undefined> {
    const [task] = await this.getDb()
      .select()
      .from(queuedTasks)
      .where(eq(queuedTasks.status, "pending"))
      .orderBy(desc(queuedTasks.priority), queuedTasks.createdAt)
      .limit(1);
    return task;
  }

  async getQueueStats(): Promise<{ pending: number; running: number; completed: number; failed: number }> {
    const allTasks = await this.getDb().select().from(queuedTasks);
    return {
      pending: allTasks.filter(t => t.status === "pending").length,
      running: allTasks.filter(t => t.status === "running").length,
      completed: allTasks.filter(t => t.status === "completed").length,
      failed: allTasks.filter(t => t.status === "failed").length,
    };
  }

  async getTasksWaitingForInput(): Promise<QueuedTask[]> {
    return this.getDb()
      .select()
      .from(queuedTasks)
      .where(eq(queuedTasks.waitingForInput, true));
  }

  async getTasksByDependency(dependencyId: string): Promise<QueuedTask[]> {
    return this.getDb()
      .select()
      .from(queuedTasks)
      .where(arrayContains(queuedTasks.dependencies, [dependencyId]));
  }

  async getReadyTasks(limit: number = 10): Promise<QueuedTask[]> {
    const pending = await this.getDb()
      .select()
      .from(queuedTasks)
      .where(
        and(
          eq(queuedTasks.status, "pending"),
          eq(queuedTasks.waitingForInput, false),
          or(
            isNull(queuedTasks.dependencies),
            sql`array_length(${queuedTasks.dependencies}, 1) IS NULL OR array_length(${queuedTasks.dependencies}, 1) = 0`
          )
        )
      )
      .orderBy(desc(queuedTasks.priority), queuedTasks.createdAt)
      .limit(limit);
    
    return pending;
  }

  // =========================================================================
  // SCHEDULE OPERATIONS
  // =========================================================================

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [created] = await this.getDb().insert(schedules).values(schedule).returning();
    return created;
  }

  async getSchedules(options?: { enabled?: boolean }): Promise<Schedule[]> {
    let query = this.getDb().select().from(schedules);
    if (options?.enabled !== undefined) {
      query = query.where(eq(schedules.enabled, options.enabled)) as typeof query;
    }
    return query.orderBy(schedules.name);
  }

  async getScheduleById(id: string): Promise<Schedule | undefined> {
    const [schedule] = await this.getDb()
      .select()
      .from(schedules)
      .where(eq(schedules.id, id));
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<InsertSchedule> & { lastRunAt?: Date; nextRunAt?: Date; runCount?: number; lastError?: string; consecutiveFailures?: number }): Promise<Schedule> {
    const [updated] = await this.getDb()
      .update(schedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schedules.id, id))
      .returning();
    return updated;
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.getDb().delete(schedules).where(eq(schedules.id, id));
  }

  async getDueSchedules(): Promise<Schedule[]> {
    return this.getDb()
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.enabled, true),
          lte(schedules.nextRunAt, new Date())
        )
      );
  }

  // =========================================================================
  // TRIGGER OPERATIONS
  // =========================================================================

  async createTrigger(trigger: InsertTrigger): Promise<Trigger> {
    const [created] = await this.getDb().insert(triggers).values(trigger).returning();
    return created;
  }

  async getTriggers(options?: { enabled?: boolean; triggerType?: string }): Promise<Trigger[]> {
    const conditions = [];
    if (options?.enabled !== undefined) {
      conditions.push(eq(triggers.enabled, options.enabled));
    }
    if (options?.triggerType) {
      conditions.push(eq(triggers.triggerType, options.triggerType));
    }
    
    let query = this.getDb().select().from(triggers);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return query.orderBy(triggers.name);
  }

  async getTriggerById(id: string): Promise<Trigger | undefined> {
    const [trigger] = await this.getDb()
      .select()
      .from(triggers)
      .where(eq(triggers.id, id));
    return trigger;
  }

  async getTriggersByType(type: string): Promise<Trigger[]> {
    return this.getDb()
      .select()
      .from(triggers)
      .where(and(eq(triggers.triggerType, type), eq(triggers.enabled, true)));
  }

  async updateTrigger(id: string, updates: Partial<InsertTrigger> & { lastTriggeredAt?: Date; triggerCount?: number }): Promise<Trigger> {
    const [updated] = await this.getDb()
      .update(triggers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(triggers.id, id))
      .returning();
    return updated;
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.getDb().delete(triggers).where(eq(triggers.id, id));
  }

  // =========================================================================
  // WORKFLOW OPERATIONS
  // =========================================================================

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [created] = await this.getDb().insert(workflows).values(workflow).returning();
    return created;
  }

  async getWorkflows(options?: { enabled?: boolean }): Promise<Workflow[]> {
    let query = this.getDb().select().from(workflows);
    if (options?.enabled !== undefined) {
      query = query.where(eq(workflows.enabled, options.enabled)) as typeof query;
    }
    return query.orderBy(workflows.name);
  }

  async getWorkflowById(id: string): Promise<Workflow | undefined> {
    const [workflow] = await this.getDb()
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return workflow;
  }

  async updateWorkflow(id: string, updates: Partial<InsertWorkflow>): Promise<Workflow> {
    const [updated] = await this.getDb()
      .update(workflows)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.getDb().delete(workflows).where(eq(workflows.id, id));
  }

  // =========================================================================
  // EXECUTOR STATE OPERATIONS
  // =========================================================================

  async getExecutorState(): Promise<ExecutorState | undefined> {
    const [state] = await this.getDb()
      .select()
      .from(executorState)
      .where(eq(executorState.id, "singleton"));
    return state;
  }

  async updateExecutorState(updates: Partial<ExecutorState>): Promise<ExecutorState> {
    const [updated] = await this.getDb()
      .update(executorState)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(executorState.id, "singleton"))
      .returning();
    return updated;
  }

  async initializeExecutorState(): Promise<ExecutorState> {
    const existing = await this.getExecutorState();
    if (existing) return existing;
    
    const [created] = await this.getDb()
      .insert(executorState)
      .values({ id: "singleton" })
      .returning();
    return created;
  }

  // =========================================================================
  // AGENT IDENTITY OPERATIONS
  // =========================================================================

  async createAgentIdentity(agent: InsertAgentIdentity): Promise<AgentIdentity> {
    const [created] = await this.getDb()
      .insert(agentIdentities)
      .values(agent)
      .returning();
    return created;
  }

  async getAgentIdentities(): Promise<AgentIdentity[]> {
    return this.getDb()
      .select()
      .from(agentIdentities)
      .orderBy(agentIdentities.name);
  }

  async getEnabledAgents(): Promise<AgentIdentity[]> {
    return this.getDb()
      .select()
      .from(agentIdentities)
      .where(eq(agentIdentities.enabled, true))
      .orderBy(agentIdentities.name);
  }

  async getAgentById(id: string): Promise<AgentIdentity | undefined> {
    const [agent] = await this.getDb()
      .select()
      .from(agentIdentities)
      .where(eq(agentIdentities.id, id));
    return agent;
  }

  async getAgentByName(name: string): Promise<AgentIdentity | undefined> {
    const [agent] = await this.getDb()
      .select()
      .from(agentIdentities)
      .where(eq(agentIdentities.name, name));
    return agent;
  }

  async updateAgentIdentity(id: string, updates: Partial<InsertAgentIdentity>): Promise<AgentIdentity> {
    const [updated] = await this.getDb()
      .update(agentIdentities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agentIdentities.id, id))
      .returning();
    return updated;
  }

  async logAgentActivity(activity: InsertAgentActivityLog): Promise<AgentActivityLog> {
    const [created] = await this.getDb()
      .insert(agentActivityLog)
      .values(activity)
      .returning();
    return created;
  }

  async getAgentActivity(agentId: string, limit = 50): Promise<AgentActivityLog[]> {
    return this.getDb()
      .select()
      .from(agentActivityLog)
      .where(eq(agentActivityLog.agentId, agentId))
      .orderBy(desc(agentActivityLog.createdAt))
      .limit(limit);
  }

  async getRecentAgentActivity(limit = 50): Promise<(AgentActivityLog & { agent: AgentIdentity })[]> {
    const activities = await this.getDb()
      .select()
      .from(agentActivityLog)
      .innerJoin(agentIdentities, eq(agentActivityLog.agentId, agentIdentities.id))
      .orderBy(desc(agentActivityLog.createdAt))
      .limit(limit);
    
    return activities.map(({ agent_activity_log, agent_identities }) => ({
      ...agent_activity_log,
      agent: agent_identities
    }));
  }
}

/**
 * SINGLETON STORAGE INSTANCE
 * --------------------------
 * A single shared instance of DrizzleStorage used throughout the application.
 * 
 * This ensures:
 * - Only one connection pool is created
 * - All parts of the app share the same database connection
 * - Consistent behavior across all API routes
 * 
 * Import this instance in your route handlers:
 * ```typescript
 * import { storage } from "./storage";
 * const chats = await storage.getChats();
 * ```
 */
export const storage = new DrizzleStorage();

/**
 * Direct database access for routes that need raw Drizzle queries.
 * Use sparingly - prefer storage methods when available.
 */
let _dbInstance: NodePgDatabase | null = null;
export function getDb(): NodePgDatabase {
  if (!_dbInstance) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err.message);
    });
    _dbInstance = drizzle(pool);
  }
  return _dbInstance;
}
