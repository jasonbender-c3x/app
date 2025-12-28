# Meowstik - Tool Call Schema

## Overview

Meowstik uses a structured tool call system that allows the AI to request operations to be executed by the backend. This document defines the complete schema for tool calls and the output format.

---

## LLM Output Format

The LLM outputs a JSON object containing tool calls. Code fences are optional but allowed.

### Format

```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Let me check..."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Let me check..."}},
    {"type": "gmail_list", "id": "g1", "operation": "list", "parameters": {"maxResults": 10}},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Here are your emails..."}}
  ]
}
```

### Format Rules

1. **No text before JSON** - Response must start with `{` or `` ```json ``
2. **All output through tools** - Use `send_chat` for text, `say` for voice, `file_put` for files
3. **Code fences optional** - Both raw JSON and `` ```json {...} ``` `` are valid

### Example Output

```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Checking your emails now."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Checking your emails now."}},
    {"type": "gmail_list", "id": "g1", "operation": "list", "parameters": {"maxResults": 10}},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Here are your recent emails:\n\n1. ..."}}
  ]
}
```

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

## Parser Implementation

The parser in `server/services/rag-dispatcher.ts` handles both raw JSON and code-fenced JSON:

```typescript
export interface ParsedLLMOutput {
  toolCalls: ToolCall[];
  parseErrors: string[];
}

export function parseLLMOutput(output: string): ParsedLLMOutput {
  const result: ParsedLLMOutput = {
    toolCalls: [],
    parseErrors: [],
  };

  // Strip code fences if present
  let jsonStr = output.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Parse JSON object
  try {
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.toolCalls && Array.isArray(parsed.toolCalls)) {
      for (const tc of parsed.toolCalls) {
        const validation = toolCallSchema.safeParse(tc);
        if (validation.success) {
          result.toolCalls.push(validation.data);
        } else {
          result.parseErrors.push(`Invalid tool call: ${validation.error.message}`);
        }
      }
    }
  } catch (e) {
    result.parseErrors.push(`Failed to parse JSON: ${e}`);
  }

  return result;
}
```

---

## Streaming Parser

For streaming responses, tool calls are extracted from the accumulated JSON after the stream completes:

```typescript
// Accumulate streamed chunks
let accumulated = "";
for await (const chunk of stream) {
  accumulated += chunk.text;
}

// Parse complete JSON response
const parsed = parseLLMOutput(accumulated);

// Execute tool calls in order
for (const toolCall of parsed.toolCalls) {
  await executeToolCall(toolCall);
  
  // send_chat tool calls update the chat window
  if (toolCall.type === 'send_chat') {
    sendToClient(toolCall.parameters.content);
  }
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
