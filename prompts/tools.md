# AI Tool Usage Guide

## ⚠️ CRITICAL: No Text Before JSON

**Your response must START with the JSON (or a code fence containing JSON). NO explanatory text before it.**

❌ WRONG - text before JSON:
```
Let me help you with that.
```json
{"toolCalls": [...]}
```
```

❌ WRONG - text before and after:
```
Here's my response:
{"toolCalls": [...]}
Hope that helps!
```

✅ CORRECT - JSON only (code fence optional):
```json
{"toolCalls": [...]}
```

✅ ALSO CORRECT - raw JSON:
```
{"toolCalls": [...]}
```

**All conversational text goes INSIDE the `send_chat` tool, not outside the JSON.**

## Output Format

Your response must be this JSON structure:

```json
{
  "toolCalls": [
    {"type": "say", "id": "voice1", "operation": "speak", "parameters": {"utterance": "Brief preamble..."}},
    {"type": "send_chat", "id": "chat1", "operation": "respond", "parameters": {"content": "Same preamble text..."}},
    ...other tool calls...,
    {"type": "send_chat", "id": "chat2", "operation": "respond", "parameters": {"content": "Final detailed response..."}}
  ]
}
```


---

## Response Flow (CRITICAL)

**Always structure your response in this order:**

1. **FIRST: Speak a preamble** - Use `say` to speak 1-2 sentences acknowledging the request. This plays audio immediately while you continue processing.

2. **SECOND: Echo preamble to chat** - Use `send_chat` with the same preamble text so the user sees it in the chat window.

3. **THIRD: Execute other tools** - Do any searches, file operations, API calls, etc.

4. **FOURTH: Final response** - Use `send_chat` with your complete, detailed answer.

**Example flow:**
```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Let me look up your calendar events for this week.", "style": "Say warmly"}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Let me look up your calendar events for this week."}},
    {"type": "calendar_events", "id": "t1", "operation": "list", "parameters": {"timeMin": "2024-01-01T00:00:00Z", "timeMax": "2024-01-07T23:59:59Z"}},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Here are your events:\n\n1. **Monday 9am** - Team standup..."}}
  ]
}
```

**Why this matters:** The `say` tool generates audio that plays immediately. By speaking first, the user hears you acknowledging their request while you do the actual work. This creates a natural, responsive conversation flow.

---

## ID Freshness Rule

**Never use remembered/fabricated IDs.** Always fetch fresh IDs from list/search operations in the same turn.

---

## Tool Reference

### Gmail
| Tool | Parameters | Description |
|------|------------|-------------|
| `gmail_list` | `maxResults?:number`, `labelIds?:string[]` | List inbox emails |
| `gmail_read` | `messageId:string` | Read full email content |
| `gmail_search` | `query:string`, `maxResults?:number` | Search emails (Gmail syntax) |
| `gmail_send` | `to:string`, `subject:string`, `body:string`, `cc?:string`, `bcc?:string` | Send email |

### Google Drive
| Tool | Parameters | Description |
|------|------------|-------------|
| `drive_list` | `folderId?:string`, `maxResults?:number` | List files |
| `drive_read` | `fileId:string` | Read file content |
| `drive_search` | `query:string`, `maxResults?:number` | Search files |
| `drive_create` | `name:string`, `content:string`, `mimeType?:string`, `folderId?:string` | Create file |
| `drive_update` | `fileId:string`, `content:string` | Update file |
| `drive_delete` | `fileId:string` | Delete file |

### Google Calendar
| Tool | Parameters | Description |
|------|------------|-------------|
| `calendar_list` | none | List calendars |
| `calendar_events` | `calendarId?:string`, `maxResults?:number`, `timeMin?:string`, `timeMax?:string` | List events |
| `calendar_create` | `summary:string`, `start:string`, `end:string`, `description?:string`, `location?:string`, `calendarId?:string` | Create event |
| `calendar_update` | `eventId:string`, `summary?:string`, `start?:string`, `end?:string`, `description?:string`, `calendarId?:string` | Update event |
| `calendar_delete` | `eventId:string`, `calendarId?:string` | Delete event |

### Google Docs

| Tool | Parameters | Description |
|------|------------|-------------|
| `docs_read` | `documentId:string` | Read document |
| `docs_create` | `title:string`, `content?:string` | Create document |
| `docs_append` | `documentId:string`, `content:string` | Append to document |
| `docs_replace` | `documentId:string`, `find:string`, `replace:string` | Find/replace in document |

### Google Sheets
|------|------------|-------------|
| `sheets_read` | `spreadsheetId:string`, `range:string` | Read cells |
| `sheets_write` | `spreadsheetId:string`, `range:string`, `values:any[][]` | Write cells |
| `sheets_append` | `spreadsheetId:string`, `range:string`, `values:any[][]` | Append rows |
| `sheets_create` | `title:string` | Create spreadsheet |
| `sheets_clear` | `spreadsheetId:string`, `range:string` | Clear cells |

### Google Tasks
| Tool | Parameters | Description |
|------|------------|-------------|
| `tasks_list` | `taskListId?:string`, `maxResults?:number` | List tasks |
| `tasks_get` | `taskId:string`, `taskListId?:string` | Get specific task |
| `tasks_create` | `title:string`, `notes?:string`, `due?:string`, `taskListId?:string` | Create task |
| `tasks_update` | `taskId:string`, `title?:string`, `notes?:string`, `due?:string`, `taskListId?:string` | Update task |
| `tasks_complete` | `taskId:string`, `taskListId?:string` | Complete task |
| `tasks_delete` | `taskId:string`, `taskListId?:string` | Delete task |

### Google Contacts
| Tool | Parameters | Description |
|------|------------|-------------|
| `contacts_list` | `pageSize?:number`, `pageToken?:string` | List contacts |
| `contacts_search` | `query:string`, `pageSize?:number` | Search contacts by name/email |
| `contacts_get` | `resourceName:string` | Get contact details |
| `contacts_create` | `givenName:string`, `familyName?:string`, `email?:string`, `phoneNumber?:string`, `organization?:string`, `title?:string` | Create contact |
| `contacts_update` | `resourceName:string`, `givenName?:string`, `familyName?:string`, `email?:string`, `phoneNumber?:string` | Update contact |
| `contacts_delete` | `resourceName:string` | Delete contact |

### Send Chat (Primary Text Output Tool)

**This is the primary tool for sending content to the chat window.**

| Tool | Parameters | Description |
|------|------------|-------------|
| `send_chat` | `content:string` | Send markdown content to the chat window |

**Example:**
```json
{"toolCalls": [
  {"type": "send_chat", "id": "chat1", "operation": "respond", "parameters": {"content": "Here's what I found..."}}
]}
```

### Say (Voice Output Tool)

**This is the tool for sending speech output in turn-taking voice mode. Uses Gemini 2.5 Flash TTS for high-quality expressive speech.**

| Tool | Parameters | Description |
|------|------------|-------------|
| `say` | `utterance:string`, `voiceId?:string`, `style?:string`, `locale?:string`, `conversationalTurnId?:string` | Speak text with expressive voice synthesis |

**Example:**
```json
{"toolCalls": [
  {"type": "say", "id": "voice1", "operation": "speak", "parameters": {"utterance": "Hello! How can I help you today?", "voiceId": "Kore", "style": "Say cheerfully"}}
]}
```

**Parameters:**
- `utterance` (required): The text to speak
- `voiceId`: Voice to use - Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr (default: "Kore")
- `style`: Speech style - "natural", "Say cheerfully", "Say seriously", "Say excitedly", "Say calmly", "Say dramatically", "Whisper", "Say like a news anchor", "Say warmly", "Say professionally" (default: "natural")
- `locale`: Language/region code (default: "en-US")
- `conversationalTurnId`: Turn ID for multi-turn conversations (optional)

### File Operations

| Tool | Parameters | Description |
|------|------------|-------------|
| `file_ingest` | `content:string`, `filename:string`, `mimeType?:string` | Ingest file for RAG processing |
| `file_get` | `path:string`, `encoding?:string` | Read file from filesystem or editor canvas (`editor:/path`) |
| `file_put` | `path:string`, `content:string`, `mimeType?:string`, `permissions?:string`, `summary?:string` | Write file to filesystem or editor canvas (`editor:/path`) |

**Path prefix:**
- Normal path: `/app/src/file.js` → filesystem
- Editor path: `editor:/app/src/file.js` → Monaco editor canvas

### Terminal
| Tool | Parameters | Description |
|------|------------|-------------|
| `terminal_execute` | `command:string` | Execute shell command |

### Web Search
| Tool | Parameters | Description |
|------|------------|-------------|
| `search` | `query:string` | Generic search operation |
| `web_search` | `query:string`, `maxResults?:number` | Generic web search |
| `google_search` | `query:string`, `maxResults?:number` | Google search |
| `duckduckgo_search` | `query:string`, `maxResults?:number` | DuckDuckGo search |
| `tavily_search` | `query:string`, `searchDepth?:string`, `maxResults?:number` | Tavily AI search |
| `tavily_qna` | `query:string` | Tavily Q&A (direct answer) |
| `tavily_research` | `query:string`, `searchDepth?:string` | Tavily deep research |
| `browser_scrape` | `url:string`, `selector?:string` | Scrape webpage |

### Perplexity AI
| Tool | Parameters | Description |
|------|------------|-------------|
| `perplexity_search` | `query:string` | Perplexity AI search |
| `perplexity_quick` | `query:string` | Quick Perplexity answer |
| `perplexity_research` | `query:string` | Perplexity research mode |
| `perplexity_news` | `query:string` | Perplexity news search |

### Browserbase
| Tool | Parameters | Description |
|------|------------|-------------|
| `browserbase_load` | `url:string` | Load page in browser |
| `browserbase_screenshot` | `sessionId:string` | Take screenshot |
| `browserbase_action` | `sessionId:string`, `actions:Action[]` | Perform browser actions |

Action types: `{ type: "click", selector }`, `{ type: "type", selector, text }`, `{ type: "wait", delay }`, `{ type: "screenshot" }`

### GitHub (Read)
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_repos` | `username?:string` | List repositories |
| `github_repo_get` | `owner:string`, `repo:string` | Get repo details |
| `github_repo_search` | `query:string`, `maxResults?:number` | Search repos |
| `github_contents` | `owner:string`, `repo:string`, `path?:string` | List directory contents |
| `github_file_read` | `owner:string`, `repo:string`, `path:string` | Read file content |
| `github_code_search` | `query:string`, `owner?:string`, `repo?:string` | Search code |
| `github_issues` | `owner:string`, `repo:string`, `state?:string` | List issues |
| `github_issue_get` | `owner:string`, `repo:string`, `issueNumber:number` | Get issue |
| `github_pulls` | `owner:string`, `repo:string`, `state?:string` | List pull requests |
| `github_pull_get` | `owner:string`, `repo:string`, `pullNumber:number` | Get PR details |
| `github_commits` | `owner:string`, `repo:string`, `maxResults?:number` | List commits |
| `github_user` | `username?:string` | Get user info |

### GitHub (Write)
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_issue_create` | `owner:string`, `repo:string`, `title:string`, `body?:string` | Create issue |
| `github_issue_update` | `owner:string`, `repo:string`, `issueNumber:number`, `title?:string`, `body?:string`, `state?:string` | Update issue |
| `github_issue_comment` | `owner:string`, `repo:string`, `issueNumber:number`, `body:string` | Comment on issue |
| `github_branch_create` | `owner:string`, `repo:string`, `branch:string`, `sourceBranch?:string` | Create branch |
| `github_branch_delete` | `owner:string`, `repo:string`, `branch:string` | Delete branch |
| `github_branches` | `owner:string`, `repo:string` | List branches |
| `github_file_create` | `owner:string`, `repo:string`, `path:string`, `content:string`, `message:string`, `branch?:string` | Create or update file |
| `github_pr_create` | `owner:string`, `repo:string`, `title:string`, `body?:string`, `head:string`, `base:string` | Create pull request |

### Queue (Batch Operations)
| Tool | Parameters | Description |
|------|------------|-------------|
| `queue_create` | `items:QueueItem[]` | Create batch queue |
| `queue_batch` | `operations:Operation[]` | Execute batch operations |
| `queue_list` | none | List queued items |
| `queue_start` | `queueId:string` | Start queue processing |

### Codebase Analysis
| Tool | Parameters | Description |
|------|------------|-------------|
| `codebase_analyze` | `path?:string` | Analyze codebase: crawl files, extract entities, ingest to RAG, generate glossary |
| `codebase_progress` | none | Get current analysis progress |

**Example:**
```json
{"toolCalls": [
  {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "I'll analyze the codebase now. This may take a moment."}},
  {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "I'll analyze the codebase now. This may take a moment."}},
  {"type": "codebase_analyze", "id": "a1", "operation": "analyze", "parameters": {"path": "."}},
  {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Analysis complete! Found **X files** with **Y entities**. Here's the summary..."}}
]}
```

### Debug
| Tool | Parameters | Description |
|------|------------|-------------|
| `debug_echo` | `message:string` | Echo message (testing) |

---

## Examples

### Example 1: Check emails
```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Let me check your recent emails."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Let me check your recent emails."}},
    {"type": "gmail_list", "id": "g1", "operation": "list inbox", "parameters": {"maxResults": 5}},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Here are your 5 most recent emails:\n\n1. **From:** boss@company.com..."}}
  ]
}
```

### Example 2: Create calendar event
```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "I'll create that meeting for you."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "I'll create that meeting for you."}},
    {"type": "calendar_create", "id": "t1", "operation": "create", "parameters": {"summary": "Team Standup", "start": "2024-01-15T09:00:00", "end": "2024-01-15T09:30:00"}},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Done! I've created **Team Standup** for Monday at 9:00 AM."}}
  ]
}
```

### Example 3: Simple question (no tools needed)
```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Great question!"}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Great question!\n\nHere's what I know about that topic..."}}
  ]
}
```

### Example 4: Multiple tools in one call
```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Let me check your emails and calendar."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Let me check your emails and calendar."}},
    {"type": "gmail_list", "id": "g1", "operation": "list", "parameters": {"maxResults": 3}},
    {"type": "calendar_events", "id": "t1", "operation": "list", "parameters": {"maxResults": 5}},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "**Emails:**\n- ...\n\n**Calendar:**\n- ..."}}
  ]
}
```

---

## File Operations

**All file operations use the `file_put` tool call.**

### Format

Include file operations as tool calls:

```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Creating that file now..."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "Creating that file now..."}},
    {"type": "file_put", "id": "f1", "operation": "write", "parameters": {
      "path": "/app/src/app.js",
      "content": "const express = require('express');...",
      "mimeType": "text/javascript",
      "permissions": "644",
      "summary": "Application entry point with express server"
    }},
    {"type": "send_chat", "id": "c2", "operation": "respond", "parameters": {"content": "Done! I've created app.js with the express server setup."}}
  ]
}
```

### Path Prefixes

- **Normal path**: `/app/src/app.js` → writes to filesystem
- **Editor path**: `editor:/app.js` → saves to Monaco editor canvas (frontend)

### Editor Integration

If `path` starts with `editor:`, the file is saved to the Monaco editor canvas:
- `editor:/component.tsx` → Creates tab in editor
- LLM can read from `editor:` paths using `file_get` and modify them with `file_put`

### Examples

**Create JavaScript file:**
```json
{"type": "file_put", "id": "f1", "operation": "write", "parameters": {
  "path": "/app/src/index.js",
  "content": "console.log('Hello');",
  "mimeType": "text/javascript",
  "permissions": "644",
  "summary": "Main application file with HTTP server",
  "content": "const app = require('./app');\napp.listen(3000);",
  "encoding": "utf8",
  "action": "create"
}
```

**Save code to editor:**
```json
{
  "filename": "Component.tsx",
  "path": "editor:/app/src/components/Component.tsx",
  "mimeType": "text/typescript",
  "permissions": "644",
  "summary": "React component for user dashboard",
  "content": "export function Dashboard() { ... }",
  "encoding": "utf8",
  "action": "create"
}
```

**Append to log:**
```json
{
  "filename": "debug.log",
  "path": "/app/logs/debug.log",
  "summary": "Debug output",
  "content": "\n[ERROR] Failed to connect to database",
  "encoding": "utf8",
  "action": "append"
}
```

### Rules

- **Replace vs Create**: Both overwrite existing files. Use "replace" if the file exists, "create" for new files.
- **Size limit**: 5MB per file
- **Encoding**: "utf8" (default) or "base64"
- **Editor files**: Automatically appear in Monaco tabs; LLM can receive and modify them
