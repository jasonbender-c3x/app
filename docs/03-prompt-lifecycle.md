# Meowstik - The Life of a Prompt

## Overview

This document traces the complete journey of a user's input from spoken words to processed AI output, detailing every system component involved in the transformation.

---

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER LAYER                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  1. VOICE INPUT              2. TEXT INPUT           3. ATTACHMENTS     ││
│  │  ┌─────────────┐             ┌─────────────┐         ┌─────────────┐   ││
│  │  │ 🎤 Speak    │             │ ⌨️ Type     │         │ 📎 Upload   │   ││
│  │  │ "Hello..."  │             │ text...     │         │ 📸 Capture  │   ││
│  │  └─────────────┘             └─────────────┘         └─────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  4. SPEECH RECOGNITION          5. INPUT COMPOSITION                    ││
│  │  ┌─────────────────────┐        ┌────────────────────────────────────┐ ││
│  │  │ Web Speech API      │───────►│ InputArea Component                │ ││
│  │  │ - Start/Stop        │        │ - Text + Transcript                │ ││
│  │  │ - Interim results   │        │ - Attachments array                │ ││
│  │  │ - Final transcript  │        │ - Submit handler                   │ ││
│  │  └─────────────────────┘        └────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTP POST /api/chat
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVER LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  6. PROMPT COMPOSER             7. AI MODEL                             ││
│  │  ┌─────────────────────┐        ┌────────────────────────────────────┐ ││
│  │  │ PromptComposer      │───────►│ Google Gemini                      │ ││
│  │  │ - System prompt     │        │ - Process multimodal input         │ ││
│  │  │ - User message      │        │ - Generate structured response     │ ││
│  │  │ - Attachments       │        │ - Tool calls + Chat content        │ ││
│  │  │ - History context   │        └────────────────────────────────────┘ ││
│  │  └─────────────────────┘                        │                       ││
│  │                                                 ▼                       ││
│  │  8. RAG DISPATCHER              9. STORAGE                              ││
│  │  ┌─────────────────────┐        ┌────────────────────────────────────┐ ││
│  │  │ Execute tools       │───────►│ PostgreSQL + Drizzle ORM           │ ││
│  │  │ - API calls         │        │ - Save messages                    │ ││
│  │  │ - File operations   │        │ - Log executions                   │ ││
│  │  │ - Parse output      │        │ - Store attachments                │ ││
│  │  └─────────────────────┘        └────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTP Response
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RENDER LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  10. MESSAGE DISPLAY                                                    ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ Message Component                                                  │ ││
│  │  │ - Render markdown content                                          │ ││
│  │  │ - Display tool results                                             │ ││
│  │  │ - Show file operations                                             │ ││
│  │  │ - Handle errors gracefully                                         │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Voice Capture

### Web Speech API Recognition

When the user clicks the microphone button, the `useVoice` hook activates browser speech recognition:

```typescript
// Initialize recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.lang = 'en-US';        // Language
recognition.continuous = true;      // Keep listening
recognition.interimResults = true;  // Show partial results

// Start listening
recognition.start();
```

### Real-time Transcription

The recognition fires events as speech is detected:

```typescript
recognition.onresult = (event) => {
  let finalTranscript = '';
  let interim = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result.isFinal) {
      // Final result - confident transcription
      finalTranscript += result[0].transcript;
    } else {
      // Interim result - may change
      interim += result[0].transcript;
    }
  }

  // Update state
  setTranscript(prev => prev + finalTranscript);
  setInterimTranscript(interim);
};
```

### Append Mode

If the user has already typed text, new speech is appended:

```typescript
const startListening = (appendMode: boolean = false) => {
  if (!appendMode) {
    setTranscript('');  // Clear only if not appending
  }
  recognition.start();
};
```

---

## Phase 2: Input Composition

### Multimodal Input Collection

The InputArea component aggregates all input types:

```typescript
interface Attachment {
  id: string;
  filename: string;
  type: "file" | "screenshot";
  mimeType: string;
  size: number;
  preview?: string;
  dataUrl: string;  // Base64 encoded content
}

const [input, setInput] = useState("");           // Text input
const [attachments, setAttachments] = useState<Attachment[]>([]);
```

### Screen Capture Process

```typescript
const handleScreenCapture = async () => {
  // Request screen access
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "monitor" }
  });
  
  // Create video element to capture frame
  const video = document.createElement("video");
  video.srcObject = stream;
  await video.play();
  
  // Draw to canvas
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  
  // Convert to base64
  const dataUrl = canvas.toDataURL("image/png");
  
  // Stop stream
  stream.getTracks().forEach(track => track.stop());
  
  // Create attachment
  const attachment: Attachment = {
    id: `screenshot-${Date.now()}`,
    filename: `screenshot-${Date.now()}.png`,
    type: "screenshot",
    mimeType: "image/png",
    size: blob.size,
    dataUrl,
    preview: dataUrl
  };
  
  setAttachments(prev => [...prev, attachment]);
};
```

### Submit Handler

```typescript
const handleSend = () => {
  const hasContent = input.trim() || attachments.length > 0;
  if (hasContent && !isLoading) {
    onSend(input, attachments);
    setInput("");
    setAttachments([]);
  }
};
```

---

## Phase 3: Backend Speech Service (Optional)

If the Web Speech API fails or for audio file transcription, the backend Speech Service provides a fallback:

```typescript
// server/services/speech.ts
export class SpeechService {
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    const response = await this.genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe this audio exactly as spoken." },
          {
            inlineData: {
              mimeType: request.mimeType,
              data: request.audioBase64
            }
          }
        ]
      }]
    });

    return {
      transcript: response.text.trim(),
      source: "gemini",
      confidence: 0.95
    };
  }
}
```

---

## Phase 4: Prompt Composition

### The PromptComposer Service

The PromptComposer assembles all inputs into a structured prompt:

```typescript
// server/services/prompt-composer.ts
export interface ComposedPrompt {
  systemPrompt: string;       // AI behavior instructions
  userMessage: string;        // Combined text + voice
  attachments: ComposedAttachment[];
  conversationHistory: ConversationTurn[];
  metadata: PromptMetadata;
}
```

### Building the User Message

```typescript
private buildUserMessage(textContent: string, voiceTranscript: string): string {
  const parts: string[] = [];
  
  if (textContent.trim()) {
    parts.push(textContent.trim());
  }
  
  if (voiceTranscript.trim()) {
    if (parts.length > 0) {
      parts.push(" " + voiceTranscript.trim());
    } else {
      parts.push(voiceTranscript.trim());
    }
  }
  
  return parts.join("");
}
```

### Processing Attachments

```typescript
private async processAttachments(attachments: Attachment[]): Promise<ComposedAttachment[]> {
  return attachments.map(attachment => ({
    type: attachment.type as "file" | "screenshot" | "voice_transcript",
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    content: attachment.content || "",
    isBase64: this.isBinaryMimeType(attachment.mimeType || "")
  }));
}
```

### Building Conversation Context

```typescript
private buildHistory(messages: Message[]): ConversationTurn[] {
  // Last 10 messages for context
  return messages.slice(-10).map(msg => ({
    role: msg.role as "user" | "ai",
    content: msg.content,
    timestamp: msg.createdAt
  }));
}
```

---

## Phase 5: AI Processing

### Sending to Gemini

The composed prompt is sent to Google's Gemini model:

```typescript
const response = await genAI.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        { text: composedPrompt.systemPrompt },
        { text: composedPrompt.userMessage },
        // Inline attachments as base64
        ...composedPrompt.attachments.map(a => ({
          inlineData: {
            mimeType: a.mimeType,
            data: a.content
          }
        }))
      ]
    }
  ]
});
```

### Expected Response Structure

The LLM returns a structured response with tool calls:

```typescript
interface StructuredLLMResponse {
  toolCalls: ToolCall[];        // Operations to execute (send_chat, say, file_put, etc.)
  metadata?: {
    processingTime: number;
    modelUsed: string;
    tokenCount: number;
  };
}
```

**All output goes through tool calls:**
- `send_chat` → Display text in chat
- `say` → Voice output
- `file_put` → Create/update files
- `terminal_execute` → Run commands

---

## Phase 6: RAG Dispatch

### Validation and Execution

The RAGDispatcher validates and executes the structured response:

```typescript
// server/services/rag-dispatcher.ts
async dispatch(response: unknown, messageId: string): Promise<DispatchResult> {
  // Validate schema
  const parseResult = structuredLLMResponseSchema.safeParse(response);
  if (!parseResult.success) {
    return { success: false, errors: [parseResult.error.message] };
  }

  const structured = parseResult.data;

  // Execute tool calls (including file_put for file operations)
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
    errors
  };
}
```

### Tool Execution

```typescript
private async executeToolCall(toolCall: ToolCall, messageId: string): Promise<ToolExecutionResult> {
  switch (toolCall.type) {
    case "api_call":
      return await this.executeApiCall(toolCall);
    case "search":
      return await this.executeSearch(toolCall);
    case "file_ingest":
    case "file_upload":
      return await this.executeFileOperation(toolCall);
    default:
      return { message: `Custom tool: ${toolCall.type}` };
  }
}
```

### File Creation

```typescript
private async processTextFile(fileOp: FileOperation): Promise<string> {
  const content = fileOp.encoding === "base64" 
    ? Buffer.from(fileOp.content, "base64").toString("utf8")
    : fileOp.content;

  const sanitizedPath = this.sanitizePath(fileOp.path, fileOp.filename);
  const fullPath = path.join(this.workspaceDir, sanitizedPath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");

  return sanitizedPath;
}
```

---

## Phase 7: Storage and Persistence

### Saving Messages

```typescript
// Store user message
await storage.addMessage({
  chatId: chatId,
  role: "user",
  content: userMessage
});

// Store AI response
await storage.addMessage({
  chatId: chatId,
  role: "ai",
  content: dispatchResult.chatContent
});
```

### Logging Tool Execution

```typescript
await storage.createToolTask({
  messageId,
  taskType: toolCall.type,
  payload: JSON.stringify(toolCall),
  status: "completed",
  result: JSON.stringify(result)
});

await storage.createExecutionLog({
  taskId: taskId,
  action: "tool_execution",
  input: JSON.stringify(toolCall.parameters),
  output: JSON.stringify(result),
  duration: executionTime.toString()
});
```

---

## Phase 8: Response Rendering

### Message Component

The Message component renders the AI response with structured content:

```typescript
// client/src/components/chat/message.tsx
export function Message({ message }: MessageProps) {
  return (
    <div className="message">
      {/* Markdown content */}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {message.content}
      </ReactMarkdown>

      {/* Tool call results */}
      {message.metadata?.toolResults?.map(result => (
        <ToolResultCard key={result.toolId} result={result} />
      ))}

      {/* File operations */}
      {message.metadata?.filesCreated?.map(file => (
        <FileCreatedCard key={file} path={file} />
      ))}

      {/* Errors */}
      {message.metadata?.errors?.map((error, i) => (
        <ErrorCard key={i} error={error} />
      ))}
    </div>
  );
}
```

---

## Timeline Summary

| Step | Component | Duration |
|------|-----------|----------|
| 1 | Voice capture | Real-time |
| 2 | Text/attachment collection | User-driven |
| 3 | Submit to server | ~50ms |
| 4 | Prompt composition | ~10ms |
| 5 | AI processing | 1-10 seconds |
| 6 | Tool execution | Variable |
| 7 | Storage persistence | ~20ms |
| 8 | Response rendering | ~10ms |

**Total latency**: Typically 2-15 seconds depending on AI model and tool complexity.
