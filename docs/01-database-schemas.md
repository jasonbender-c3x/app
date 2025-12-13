# Nebula Chat - Database Schema Documentation

## Overview

Nebula Chat uses PostgreSQL with Drizzle ORM for data persistence. The schema is designed around a conversational AI interface with support for multimodal inputs, tool execution, and audit logging.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│     chats       │
├─────────────────┤         ┌──────────────────┐
│ id (PK)         │◄────────│     messages     │
│ title           │         ├──────────────────┤
│ createdAt       │         │ id (PK)          │
│ updatedAt       │         │ chatId (FK)      │─────────┐
└─────────────────┘         │ role             │         │
        │                   │ content          │         │
        │                   │ createdAt        │         │
        │                   └──────────────────┘         │
        │                           │                    │
        ▼                           ▼                    │
┌─────────────────┐         ┌──────────────────┐         │
│     drafts      │         │   attachments    │         │
├─────────────────┤         ├──────────────────┤         │
│ id (PK)         │         │ id (PK)          │         │
│ chatId (FK)     │         │ messageId (FK)   │─────────┘
│ textContent     │         │ draftId          │
│ voiceTranscript │         │ type             │
│ status          │         │ filename         │
│ createdAt       │         │ mimeType         │
│ updatedAt       │         │ content          │
└─────────────────┘         │ createdAt        │
                            └──────────────────┘
                                    │
┌─────────────────┐         ┌──────────────────┐
│   toolTasks     │         │ executionLogs    │
├─────────────────┤         ├──────────────────┤
│ id (PK)         │◄────────│ id (PK)          │
│ messageId (FK)  │         │ taskId (FK)      │
│ taskType        │         │ action           │
│ payload         │         │ input            │
│ status          │         │ output           │
│ result          │         │ exitCode         │
│ error           │         │ duration         │
│ executedAt      │         │ createdAt        │
│ createdAt       │         └──────────────────┘
└─────────────────┘
```

---

## 1. Chats Table

**Purpose**: Stores metadata for chat conversations between the user and Nebula AI.

### Schema Definition

```typescript
export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (UUID) | Primary key, auto-generated UUID for globally unique identification |
| `title` | TEXT | Human-readable title displayed in the sidebar |
| `createdAt` | TIMESTAMP | When the chat was created |
| `updatedAt` | TIMESTAMP | When the chat was last modified |

### Relationships

- **One-to-Many with Messages**: A chat has many messages
- **One-to-Many with Drafts**: A chat can have multiple drafts (only one active at a time)

### Use Cases

- Creating new chat sessions
- Listing chats in the sidebar
- Sorting by most recent activity (`updatedAt`)

---

## 2. Messages Table

**Purpose**: Stores individual messages within chat conversations.

### Schema Definition

```typescript
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (UUID) | Primary key |
| `chatId` | VARCHAR (FK) | Reference to parent chat |
| `role` | TEXT | Message sender: `"user"` or `"ai"` |
| `content` | TEXT | Message content (supports Markdown) |
| `createdAt` | TIMESTAMP | When the message was created |

### Cascade Behavior

- **ON DELETE CASCADE**: When a chat is deleted, all its messages are automatically deleted

### Use Cases

- Storing conversation history
- Building context for AI responses
- Displaying chat timeline

---

## 3. Attachments Table

**Purpose**: Stores files, screenshots, and voice transcripts associated with messages or drafts.

### Schema Definition

```typescript
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id")
    .references(() => messages.id, { onDelete: "cascade" }),
  draftId: varchar("draft_id"),
  type: text("type").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  size: text("size"),
  content: text("content"),
  path: text("path"),
  permissions: text("permissions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (UUID) | Primary key |
| `messageId` | VARCHAR (FK) | Reference to parent message (nullable) |
| `draftId` | VARCHAR | Reference to draft (not a formal FK) |
| `type` | TEXT | Attachment type: `"file"`, `"screenshot"`, `"voice_transcript"` |
| `filename` | TEXT | Original or generated filename |
| `mimeType` | TEXT | MIME type (e.g., `"image/png"`) |
| `size` | TEXT | File size in bytes (stored as string) |
| `content` | TEXT | Base64-encoded content or plain text |
| `path` | TEXT | File path for created files |
| `permissions` | TEXT | Unix permission string (e.g., `"755"`) |
| `createdAt` | TIMESTAMP | When attachment was created |

### Attachment Types

1. **file**: User-uploaded documents, images, spreadsheets
2. **screenshot**: Screen captures via the capture button
3. **voice_transcript**: Transcribed audio from voice input

---

## 4. Drafts Table

**Purpose**: Stores in-progress message drafts before submission.

### Schema Definition

```typescript
export const drafts = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  textContent: text("text_content").default(""),
  voiceTranscript: text("voice_transcript").default(""),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (UUID) | Primary key |
| `chatId` | VARCHAR (FK) | Reference to parent chat |
| `textContent` | TEXT | User-typed text content |
| `voiceTranscript` | TEXT | Accumulated voice transcription |
| `status` | TEXT | Draft status: `"active"`, `"submitted"`, `"cancelled"` |
| `createdAt` | TIMESTAMP | When draft was created |
| `updatedAt` | TIMESTAMP | When draft was last modified |

### Draft Lifecycle

```
┌──────────┐    Submit    ┌───────────┐
│  active  │─────────────►│ submitted │
└──────────┘              └───────────┘
      │
      │ Abandon
      ▼
┌───────────┐
│ cancelled │
└───────────┘
```

---

## 5. Tool Tasks Table

**Purpose**: Stores tool operations requested by the AI for execution.

### Schema Definition

```typescript
export const toolTasks = pgTable("tool_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id")
    .references(() => messages.id, { onDelete: "cascade" })
    .notNull(),
  taskType: text("task_type").notNull(),
  payload: text("payload").notNull(),
  status: text("status").default("pending").notNull(),
  result: text("result"),
  error: text("error"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (UUID) | Primary key |
| `messageId` | VARCHAR (FK) | Reference to triggering message |
| `taskType` | TEXT | Tool type (see Tool Types below) |
| `payload` | TEXT | JSON-encoded task parameters |
| `status` | TEXT | Execution status |
| `result` | TEXT | JSON-encoded execution result |
| `error` | TEXT | Error message if failed |
| `executedAt` | TIMESTAMP | When task was executed |
| `createdAt` | TIMESTAMP | When task was created |

### Tool Types

| Type | Description |
|------|-------------|
| `api_call` | External API requests |
| `file_create` | Create new text file |
| `file_replace` | Replace existing file |
| `file_append` | Append to existing file |
| `binary_create` | Create binary file from base64 |
| `search` | Search operations |
| `autoexec` | Execute script (disabled by default) |

### Task Status Flow

```
┌─────────┐    Start    ┌─────────┐    Success    ┌───────────┐
│ pending │────────────►│ running │──────────────►│ completed │
└─────────┘             └─────────┘               └───────────┘
                              │
                              │ Error
                              ▼
                        ┌──────────┐
                        │  failed  │
                        └──────────┘
```

---

## 6. Execution Logs Table

**Purpose**: Audit trail for all tool executions, especially security-sensitive operations.

### Schema Definition

```typescript
export const executionLogs = pgTable("execution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .references(() => toolTasks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  input: text("input"),
  output: text("output"),
  exitCode: text("exit_code"),
  duration: text("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (UUID) | Primary key |
| `taskId` | VARCHAR (FK) | Reference to tool task (nullable) |
| `action` | TEXT | Action performed (e.g., `"autoexec_start"`) |
| `input` | TEXT | JSON-encoded input parameters |
| `output` | TEXT | JSON-encoded output/result |
| `exitCode` | TEXT | Exit code for script executions |
| `duration` | TEXT | Execution time in milliseconds |
| `createdAt` | TIMESTAMP | When log was created |

### Logged Actions

- `autoexec_start`: Autoexec script started
- `autoexec_complete`: Autoexec script completed successfully
- `autoexec_error`: Autoexec script failed

---

## Zod Validation Schemas

Each table has corresponding Zod schemas for input validation:

```typescript
// Chat validation
export const insertChatSchema = createInsertSchema(chats).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

// Message validation
export const insertMessageSchema = createInsertSchema(messages).omit({ 
  id: true, createdAt: true 
});

// Attachment validation
export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true, createdAt: true
});

// Draft validation
export const insertDraftSchema = createInsertSchema(drafts).omit({
  id: true, createdAt: true, updatedAt: true
});

// Tool task validation
export const insertToolTaskSchema = createInsertSchema(toolTasks).omit({
  id: true, createdAt: true, executedAt: true
});

// Execution log validation
export const insertExecutionLogSchema = createInsertSchema(executionLogs).omit({
  id: true, createdAt: true
});
```

---

## TypeScript Types

Export types for use throughout the application:

```typescript
// Insert types (for creating records)
export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type InsertToolTask = z.infer<typeof insertToolTaskSchema>;
export type InsertExecutionLog = z.infer<typeof insertExecutionLogSchema>;

// Select types (for reading records)
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type ToolTask = typeof toolTasks.$inferSelect;
export type ExecutionLog = typeof executionLogs.$inferSelect;
```
