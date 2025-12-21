# Meowstik - Tool Call Schema

## Overview

Meowstik uses a structured tool call system that allows the AI to request operations to be executed by the backend. This document defines the complete schema for tool calls and the output format.

---

## LLM Output Format: Scissors Cat Delimiter

The LLM uses a simple, unmistakable delimiter format:

```
[TOOL CALLS JSON ARRAY]

✂️🐱

[MARKDOWN CONTENT FOR CHAT]
```

### Format Rules

1. **Tool Calls First**: If the LLM needs to execute tools, it outputs a JSON array of tool call objects at the very start (NO markdown code fences around JSON)
2. **Scissors Cat Delimiter**: The unmistakable separator `✂️🐱` separates tool calls from markdown
3. **Markdown Last**: Everything after the delimiter is markdown content for the chat window

### Example Output

```
[
  {
    "type": "gmail_list",
    "id": "gmail-001",
    "operation": "List recent emails",
    "parameters": { "maxResults": 10 }
  }
]

✂️🐱

Let me check your recent emails...
```

### No Tool Calls

When no tools are needed, the LLM can output markdown directly:

```
[]

✂️🐱

Here's your answer...
```

Or simply respond with plain markdown (the parser handles this gracefully).

---

## Schema Definitions

All schemas are defined in `shared/schema.ts` using Zod for runtime validation.

### Tool Call Schema

```typescript
export const toolCallSchema = z.object({
  id: z.string(),
  type: z.enum([
    // Core operations
    "api_call", "file_ingest", "file_upload", "search", "web_search", "custom",
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
  ]),
  operation: z.string(),
  parameters: z.record(z.unknown()),
  priority: z.number().optional().default(0),
});

export type ToolCall = z.infer<typeof toolCallSchema>;
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the tool call |
| `type` | enum | Yes | Type of operation to perform |
| `operation` | string | Yes | Human-readable description of the operation |
| `parameters` | object | Yes | Operation-specific parameters |
| `priority` | number | No | Execution priority (higher = first) |

---

## Tool Types Reference

### Gmail Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `gmail_list` | List emails | `maxResults`, `labelIds` |
| `gmail_read` | Read specific email | `messageId` |
| `gmail_send` | Send email | `to`, `subject`, `body` |
| `gmail_search` | Search emails | `query`, `maxResults` |

### Google Drive Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `drive_list` | List files | `folderId`, `maxResults` |
| `drive_read` | Read file content | `fileId` |
| `drive_create` | Create file | `name`, `content`, `mimeType` |
| `drive_update` | Update file | `fileId`, `content` |
| `drive_delete` | Delete file | `fileId` |
| `drive_search` | Search files | `query`, `maxResults` |

### Google Calendar Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `calendar_list` | List calendars | - |
| `calendar_events` | List events | `calendarId`, `timeMin`, `timeMax` |
| `calendar_create` | Create event | `summary`, `start`, `end` |
| `calendar_update` | Update event | `eventId`, `summary` |
| `calendar_delete` | Delete event | `eventId` |

### Google Docs Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `docs_read` | Read document | `documentId` |
| `docs_create` | Create document | `title`, `text` |
| `docs_append` | Append text | `documentId`, `text` |
| `docs_replace` | Find/replace | `documentId`, `findText`, `replaceText` |

### Google Sheets Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `sheets_read` | Read spreadsheet | `spreadsheetId`, `range` |
| `sheets_write` | Write to cells | `spreadsheetId`, `range`, `values` |
| `sheets_append` | Append rows | `spreadsheetId`, `range`, `values` |
| `sheets_create` | Create spreadsheet | `title` |
| `sheets_clear` | Clear range | `spreadsheetId`, `range` |

### Google Tasks Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `tasks_list` | List tasks | `taskListId` |
| `tasks_get` | Get task | `taskListId`, `taskId` |
| `tasks_create` | Create task | `taskListId`, `title`, `notes` |
| `tasks_update` | Update task | `taskListId`, `taskId`, `title` |
| `tasks_complete` | Complete task | `taskListId`, `taskId` |
| `tasks_delete` | Delete task | `taskListId`, `taskId` |

### Other Operations

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `web_search` | Web search | `query`, `maxTokens` |
| `terminal_execute` | Execute command | `command`, `timeout` |
| `api_call` | HTTP request | `url`, `method`, `headers`, `body` |
| `search` | Document search | `query`, `scope`, `limit` |

---

## Delimiter Constant

```typescript
export const SCISSORS_CAT_DELIMITER = "✂️🐱" as const;
```

---

## Parser Implementation

The `parseLLMOutput` function in `shared/schema.ts` handles parsing:

```typescript
export interface ParsedLLMOutput {
  toolCalls: ToolCall[];
  markdown: string;
  parseErrors: string[];
}

export function parseLLMOutput(output: string): ParsedLLMOutput {
  const result: ParsedLLMOutput = {
    toolCalls: [],
    markdown: "",
    parseErrors: [],
  };

  const delimiterIndex = output.indexOf(SCISSORS_CAT_DELIMITER);
  
  if (delimiterIndex === -1) {
    // No delimiter found - treat as pure markdown
    result.markdown = output.trim();
    return result;
  }

  // Split at delimiter
  const toolCallsSection = output.substring(0, delimiterIndex).trim();
  const markdownSection = output.substring(delimiterIndex + SCISSORS_CAT_DELIMITER.length).trim();

  result.markdown = markdownSection;

  // Parse tool calls JSON
  if (toolCallsSection) {
    try {
      const parsed = JSON.parse(toolCallsSection);
      const toolCallsArray = Array.isArray(parsed) ? parsed : [parsed];
      
      for (const tc of toolCallsArray) {
        const validation = toolCallSchema.safeParse(tc);
        if (validation.success) {
          result.toolCalls.push(validation.data);
        } else {
          result.parseErrors.push(`Invalid tool call: ${validation.error.message}`);
        }
      }
    } catch (e) {
      result.parseErrors.push(`Failed to parse tool calls JSON: ${e}`);
    }
  }

  return result;
}
```

---

## Streaming Parser

For streaming responses, `server/services/delimiter-parser.ts` provides a stateful parser:

```typescript
import { DelimiterParser } from "./services/delimiter-parser";

const parser = new DelimiterParser();

for await (const chunk of stream) {
  const result = parser.processChunk(chunk.text);
  
  // Stream markdown to client immediately
  if (result.proseToStream) {
    sendToClient(result.proseToStream);
  }
  
  // Execute any completed tool calls
  for (const toolCall of result.completedToolCalls) {
    await executeToolCall(toolCall);
  }
}

// Flush remaining content
const final = parser.flush();
if (final.proseToStream) {
  sendToClient(final.proseToStream);
}
```

---

## Security Considerations

### Tool Call Validation

All tool calls are validated against the Zod schema before execution:

```typescript
const validation = toolCallSchema.safeParse(toolCall);
if (!validation.success) {
  console.error("Invalid tool call:", validation.error);
  return;
}
```

### Path Sanitization

File operations sanitize paths to prevent directory traversal:

```typescript
private sanitizePath(filePath: string, filename: string): string {
  const cleanPath = filePath.replace(/\.\./g, "").replace(/^\/+/, "");
  const cleanFilename = path.basename(filename);
  return path.join(cleanPath, cleanFilename);
}
```

### Autoexec Disabled

Script execution is disabled by default:

```typescript
const AUTOEXEC_DISABLED = true;
```
