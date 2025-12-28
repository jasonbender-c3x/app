# LLM Output Processing Pipeline

This document explains in detail what happens to the output from the LLM, from generation through every parsing step to final display.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LLM OUTPUT PROCESSING PIPELINE                           │
│                                                                                  │
│  User Input                                                                      │
│      │                                                                           │
│      ▼                                                                           │
│  ┌──────────────────┐                                                            │
│  │ Prompt Composer  │  ← Loads prompts/tools.md, core-directives.md, etc.        │
│  └────────┬─────────┘                                                            │
│           ▼                                                                      │
│  ┌──────────────────┐                                                            │
│  │  Gemini API      │  ← generateContentStream()                                 │
│  └────────┬─────────┘                                                            │
│           │                                                                      │
│           ▼  (Streaming)                                                         │
│  ┌──────────────────┐                                                            │
│  │  SSE Stream      │  ← data: {"text": "chunk"}\n\n                             │
│  └────────┬─────────┘                                                            │
│           │                                                                      │
│           ▼                                                                      │
│  ┌──────────────────┐                                                            │
│  │ Frontend Parser  │  ← ReadableStream reader                                   │
│  └────────┬─────────┘                                                            │
│           │                                                                      │
│           ▼                                                                      │
│  ┌──────────────────┐                                                            │
│  │ stripToolCalls() │  ← Remove tool JSON from display                           │
│  └────────┬─────────┘                                                            │
│           │                                                                      │
│           ▼                                                                      │
│  ┌──────────────────┐                                                            │
│  │ ReactMarkdown    │  ← Render final content                                    │
│  └──────────────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Prompt Composition (Backend)

**File:** `server/services/prompt-composer.ts`

Before the LLM generates a response, the system prompt is assembled from modular files:

```typescript
// Prompt files are loaded from the prompts/ directory
const promptsDir = path.join(process.cwd(), "prompts");

this.coreDirectives = fs.readFileSync(
  path.join(promptsDir, "core-directives.md"), "utf-8"
);
this.personality = fs.readFileSync(
  path.join(promptsDir, "personality.md"), "utf-8"
);
this.tools = fs.readFileSync(
  path.join(promptsDir, "tools.md"), "utf-8"
);
```

The `tools.md` file contains definitions for all available tools including:
- Gmail tools (gmail_list, gmail_send, etc.)
- Drive tools (drive_list, drive_read, etc.)
- Calendar tools (calendar_list, calendar_events, etc.)
- **Terminal tool (terminal_execute)** - for executing shell commands

### System Prompt Assembly

```typescript
private buildSystemPrompt(attachments, ragContext): string {
  const parts: string[] = [
    this.coreDirectives,   // Core behavior rules
    this.personality,      // Character/communication style
    this.tools            // Tool definitions (including terminal_execute)
  ];

  // Add RAG context if available
  if (ragContext && ragContext.trim()) {
    parts.push(`## Retrieved Knowledge Context\n${ragContext}`);
  }

  // Add contextual instructions for attachments
  if (attachments.some(a => a.type === "screenshot")) {
    parts.push(`## Current Context: Screenshots\n...`);
  }

  return parts.join("\n\n");
}
```

---

## Step 2: LLM API Call (Backend)

**File:** `server/routes.ts`

The Gemini API is called with streaming enabled:

```typescript
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Call with streaming
const result = await genAI.models.generateContentStream({
  model: "gemini-2.0-flash-exp",
  config: {
    systemInstruction: composedPrompt.systemPrompt,  // Contains tool definitions
  },
  contents: [...history, { role: "user", parts: userParts }],
});
```

---

## Step 3: Server-Sent Events (SSE) Streaming (Backend → Frontend)

**File:** `server/routes.ts`

The backend streams the response using SSE format:

```typescript
// Set SSE headers
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

let fullResponse = "";

// Stream chunks to client
for await (const chunk of result) {
  const text = chunk.text || "";
  fullResponse += text;
  
  // Send each chunk as SSE event
  if (text) {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  }
}

// Send completion signal
res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
res.end();
```

### SSE Format Example

```
data: {"text":"I'll help you "}

data: {"text":"list the files"}

data: {"text":" in the current directory."}

data: {"text":"\n\n```json\n{\"type\": \"terminal_execute\"..."}

data: {"done":true}

```

---

## Step 4: Frontend Stream Processing

**File:** `client/src/pages/home.tsx`

The frontend reads the SSE stream using a `ReadableStream` reader:

```typescript
const handleSendMessage = async (content: string, attachments: Attachment[] = []) => {
  // POST to API endpoint
  const response = await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, attachments }),
  });

  // Get stream reader
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  let aiMessageContent = '';
  let buffer = '';

  // Read stream chunks
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode bytes to text
    buffer += decoder.decode(value, { stream: true });
    
    // Parse SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';  // Keep incomplete line

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));  // Remove "data: " prefix
        
        if (data.text) {
          aiMessageContent += data.text;  // Accumulate response
          
          // Update UI with partial response
          setMessages((prev) => {
            const filtered = prev.filter(m => !m.id.startsWith('temp-ai-'));
            return [...filtered, {
              id: `temp-ai-${Date.now()}`,
              role: "ai",
              content: aiMessageContent,  // Full accumulated content
              createdAt: new Date(),
            }];
          });
        }
        
        if (data.done) {
          setIsLoading(false);
          // Reload final messages from server
          await loadChatMessages(chatId);
        }
      }
    }
  }
};
```

### Key Parsing Steps:

1. **Read chunk**: `reader.read()` returns raw bytes
2. **Decode**: `TextDecoder.decode()` converts bytes to string
3. **Buffer management**: Incomplete lines kept in buffer
4. **Line splitting**: `buffer.split('\n')` separates SSE events
5. **JSON parsing**: `JSON.parse(line.slice(6))` extracts data
6. **Accumulation**: Text appended to `aiMessageContent`

---

## Step 5: Tool Call Stripping (Frontend Display)

**File:** `client/src/components/chat/message.tsx`

Before displaying, tool call JSON is stripped from the content:

```typescript
function stripToolCalls(content: string): string {
  // Remove JSON code blocks that look like tool calls
  const toolCallPattern = /```json\s*\n?\s*\{[^}]*"type"\s*:\s*"(terminal_execute|gmail_|drive_|calendar_|docs_|sheets_|tasks_|api_call|web_search|search)[^}]*\}\s*\n?```/gi;
  let cleaned = content.replace(toolCallPattern, '');
  
  // Remove inline JSON tool calls without code blocks
  const inlineToolPattern = /\{[^{}]*"type"\s*:\s*"(terminal_execute|gmail_|drive_|calendar_|docs_|sheets_|tasks_|api_call|web_search|search)[^{}]*"id"\s*:[^{}]*\}/gi;
  cleaned = cleaned.replace(inlineToolPattern, '');
  
  // Remove preamble phrases like "I'll use the terminal tool"
  cleaned = cleaned.replace(/I('ll| will) (use|execute|run) the \w+ tool[^.]*\.\s*/gi, '');
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}
```

### Example: Before and After Stripping

**Before (raw LLM output):**
```
I'll use the terminal_execute tool to list the files.

```json
{
  "type": "terminal_execute",
  "id": "exec_001",
  "parameters": {
    "command": "ls -la"
  }
}
```

Here are the files in the current directory...
```

**After (displayed to user):**
```
Here are the files in the current directory...
```

---

## Step 6: Markdown Rendering

**File:** `client/src/components/chat/message.tsx`

Finally, the cleaned content is rendered using ReactMarkdown:

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatMessage({ role, content, isThinking, metadata }: MessageProps) {
  return (
    <div className="prose prose-neutral dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {stripToolCalls(content)}  {/* Tool calls stripped before rendering */}
      </ReactMarkdown>
    </div>
  );
}
```

### What ReactMarkdown Handles:

- **Headers**: `# H1`, `## H2`, etc.
- **Bold/Italic**: `**bold**`, `*italic*`
- **Code blocks**: ` ```language ... ``` `
- **Lists**: `- item`, `1. item`
- **Links**: `[text](url)`
- **Tables** (via remark-gfm)
- **Task lists** (via remark-gfm)

---

## Step 7: Metadata Display

**File:** `client/src/components/chat/message.tsx`

If the message has metadata (tool results, file operations), it's displayed as badges:

```typescript
{role === "ai" && metadata && (hasToolResults || hasFileOps || hasErrors) && (
  <div className="mt-3 space-y-2">
    {/* Tool execution results */}
    {metadata.toolResults?.map((tool) => (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
        tool.success 
          ? "bg-green-500/10 text-green-600" 
          : "bg-red-500/10 text-red-600"
      )}>
        <Wrench className="h-3 w-3" />
        <span>{tool.type}</span>  {/* e.g., "terminal_execute" */}
        {tool.success ? <CheckCircle2 /> : <XCircle />}
        <span>({tool.duration}ms)</span>
      </div>
    ))}
    
    {/* File operations */}
    {metadata.filesCreated?.map((file) => (
      <div className="bg-blue-500/10 text-blue-600">
        <FileCode /> Created: {file}
      </div>
    ))}
  </div>
)}
```

---

## Complete Data Flow Example

### 1. User sends: "List files in current directory"

### 2. Prompt Composer builds system prompt with:
```
# Available Tools
...
## Terminal Tool
- **terminal_execute**: Execute a shell command
...
```

### 3. LLM responds (streamed):
```
I'll list the files for you.

```json
{
  "type": "terminal_execute",
  "id": "exec_001",
  "parameters": {
    "command": "ls -la"
  }
}
```

Here are the files...
```

### 4. Backend streams as SSE:
```
data: {"text":"I'll list the files for you.\n\n"}

data: {"text":"```json\n{\"type\": \"terminal_execute\"..."}

data: {"text":"Here are the files..."}

data: {"done":true}

```

### 5. Frontend accumulates:
```typescript
aiMessageContent = "I'll list the files for you.\n\n```json\n{\"type\": \"terminal_execute\"...```\n\nHere are the files..."
```

### 6. stripToolCalls() removes JSON:
```typescript
stripToolCalls(aiMessageContent)
// Returns: "Here are the files..."
```

### 7. ReactMarkdown renders clean output:
```
Here are the files...
```

---

## Tool Execution Flow (Structured Responses)

When the LLM outputs a structured response with tool calls, the RAG Dispatcher handles execution:

**File:** `server/services/rag-dispatcher.ts`

```typescript
async dispatch(response: unknown, messageId: string): Promise<DispatchResult> {
  // Parse with Zod schema
  const parseResult = structuredLLMResponseSchema.safeParse(response);
  
  if (!parseResult.success) {
    return { success: false, errors: [parseResult.error.message] };
  }

  const structured = parseResult.data;

  // Execute each tool call
  for (const toolCall of structured.toolCalls) {
    const result = await this.executeToolCall(toolCall, messageId);
    toolResults.push(result);
  }

  // Extract chat content from send_chat tool results
  const chatContent = toolResults
    .filter(r => r.type === 'send_chat')
    .map(r => r.result?.content)
    .join('\n\n');

  return {
    success: errors.length === 0,
    chatContent,
    toolResults,
  };
}
```

### Terminal Execution Handler:

```typescript
private async executeTerminal(toolCall: ToolCall): Promise<unknown> {
  const params = toolCall.parameters as { command: string };
  
  const { stdout, stderr } = await execAsync(params.command, {
    cwd: this.workspaceDir,
    timeout: 30000,
  });

  // Log to file for AI reference
  const logPath = path.join(this.workspaceDir, '.local', 'terminal-output.txt');
  await fs.appendFile(logPath, `[${timestamp}] $ ${params.command}\n${stdout}\n`);

  return {
    success: true,
    command: params.command,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}
```

---

## Schema Definitions

**File:** `shared/schema.ts`

### Tool Call Schema:

```typescript
export const toolCallSchema = z.object({
  id: z.string(),
  type: z.enum([
    "api_call", "file_ingest", "file_upload", "search", "web_search", "custom",
    "gmail_list", "gmail_read", "gmail_send", "gmail_search",
    "drive_list", "drive_read", "drive_create", "drive_update", "drive_delete",
    "calendar_list", "calendar_events", "calendar_create",
    "docs_read", "docs_create", "docs_append", "docs_replace",
    "sheets_read", "sheets_write", "sheets_append", "sheets_create",
    "tasks_list", "tasks_get", "tasks_create", "tasks_update", "tasks_delete",
    "terminal_execute",  // Shell command execution
  ]),
  operation: z.string(),
  parameters: z.record(z.unknown()),
  priority: z.number().optional().default(0),
});
```

### Structured LLM Response Schema:

```typescript
export const structuredLLMResponseSchema = z.object({
  toolCalls: z.array(toolCallSchema).optional().default([]),
  
  metadata: z.object({
    processingTime: z.number().optional(),
    modelUsed: z.string().optional(),
    tokenCount: z.number().optional(),
  }).optional(),
});
```

**All output goes through tool calls:**
- `send_chat` → Display text in chat
- `say` → Voice output  
- `file_put` → Create/update files
- `terminal_execute` → Run commands

---

## Summary

| Step | Location | Function |
|------|----------|----------|
| 1. Prompt Assembly | `prompt-composer.ts` | Load and combine system prompts |
| 2. API Call | `routes.ts` | Call Gemini with streaming |
| 3. SSE Streaming | `routes.ts` → HTTP | Format as `data: {...}\n\n` |
| 4. Stream Parsing | `home.tsx` | Decode, buffer, parse JSON |
| 5. Tool Stripping | `message.tsx` | Remove JSON tool calls |
| 6. Markdown Render | `message.tsx` | ReactMarkdown + remark-gfm |
| 7. Metadata Display | `message.tsx` | Show badges for tool results |
