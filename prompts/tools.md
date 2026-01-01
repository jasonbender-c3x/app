# Tool Reference

## Google Workspace

### Gmail
| Tool | Parameters |
|------|------------|
| `gmail_list` | `maxResults?`, `labelIds?` |
| `gmail_read` | `messageId` |
| `gmail_search` | `query`, `maxResults?` |
| `gmail_send` | `to`, `subject`, `body`, `cc?`, `bcc?` |

### Drive
| Tool | Parameters |
|------|------------|
| `drive_list` | `folderId?`, `maxResults?` |
| `drive_read` | `fileId` |
| `drive_search` | `query`, `maxResults?` |
| `drive_create` | `name`, `content`, `mimeType?`, `folderId?` |
| `drive_update` | `fileId`, `content` |
| `drive_delete` | `fileId` |

### Calendar
| Tool | Parameters |
|------|------------|
| `calendar_list` | none |
| `calendar_events` | `calendarId?`, `maxResults?`, `timeMin?`, `timeMax?` |
| `calendar_create` | `summary`, `start`, `end`, `description?`, `location?` |
| `calendar_update` | `eventId`, `summary?`, `start?`, `end?`, `description?` |
| `calendar_delete` | `eventId`, `calendarId?` |

### Docs
| Tool | Parameters |
|------|------------|
| `docs_read` | `documentId` |
| `docs_create` | `title`, `content?` |
| `docs_append` | `documentId`, `content` |
| `docs_replace` | `documentId`, `find`, `replace` |

### Sheets
| Tool | Parameters |
|------|------------|
| `sheets_read` | `spreadsheetId`, `range` |
| `sheets_write` | `spreadsheetId`, `range`, `values` |
| `sheets_append` | `spreadsheetId`, `range`, `values` |
| `sheets_create` | `title` |
| `sheets_clear` | `spreadsheetId`, `range` |

### Tasks
| Tool | Parameters |
|------|------------|
| `tasks_list` | `taskListId?`, `maxResults?` |
| `tasks_create` | `title`, `notes?`, `due?`, `taskListId?` |
| `tasks_update` | `taskId`, `title?`, `notes?`, `due?` |
| `tasks_complete` | `taskId`, `taskListId?` |
| `tasks_delete` | `taskId`, `taskListId?` |

### Contacts
| Tool | Parameters |
|------|------------|
| `contacts_list` | `pageSize?`, `pageToken?` |
| `contacts_search` | `query`, `pageSize?` |
| `contacts_create` | `givenName`, `familyName?`, `email?`, `phoneNumber?` |
| `contacts_update` | `resourceName`, `givenName?`, `email?`, `phoneNumber?` |

---

## File Operations

| Tool | Parameters |
|------|------------|
| `file_get` | `path` (prefix `editor:` for Monaco canvas) |
| `file_put` | `path`, `content`, `mimeType?`, `summary?` |
| `file_ingest` | `content`, `filename`, `mimeType?` |

---

## Terminal & Web

| Tool | Parameters |
|------|------------|
| `terminal_execute` | `command` |
| `web_search` | `query`, `maxResults?` |
| `browser_scrape` | `url`, `selector?` |
| `browserbase_load` | `url` |
| `browserbase_screenshot` | `sessionId` |

---

## GitHub

### Read
| Tool | Parameters |
|------|------------|
| `github_repos` | `username?` |
| `github_contents` | `owner`, `repo`, `path?` |
| `github_file_read` | `owner`, `repo`, `path` |
| `github_code_search` | `query`, `owner?`, `repo?` |
| `github_issues` | `owner`, `repo`, `state?` |
| `github_pulls` | `owner`, `repo`, `state?` |
| `github_commits` | `owner`, `repo`, `maxResults?` |

### Write
| Tool | Parameters |
|------|------------|
| `github_issue_create` | `owner`, `repo`, `title`, `body?` |
| `github_issue_comment` | `owner`, `repo`, `issueNumber`, `body` |
| `github_branch_create` | `owner`, `repo`, `branch`, `sourceBranch?` |
| `github_file_create` | `owner`, `repo`, `path`, `content`, `message`, `branch?` |
| `github_pr_create` | `owner`, `repo`, `title`, `body?`, `head`, `base` |

---

## Codebase Analysis

| Tool | Parameters |
|------|------------|
| `codebase_analyze` | `path?` - crawl, extract entities, ingest to RAG |
| `codebase_progress` | none |

---

## Chat & Voice

| Tool | Parameters | Purpose |
|------|------------|---------|
| `send_chat` | `content` | **TERMINATES LOOP** - Sends final response to chat window |
| `say` | `utterance`, `voice?` | Generates HD audio (voices: Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr) |

---

## SMS & Calls (Twilio)

| Tool | Parameters |
|------|------------|
| `sms_send` | `to`, `body` |
| `sms_list` | `limit?` |
| `call_make` | `to`, `message?`, `twimlUrl?` |
| `call_list` | `limit?` |

---

## Job Queue

| Tool | Parameters |
|------|------------|
| `queue_create` | `name`, `goal`, `priority?`, `dependencies?` |
| `queue_batch` | `jobs[]` (array of job definitions) |
| `queue_list` | `status?`, `limit?` |
| `queue_start` | none |

---

## Agentic Loop Pattern

You operate in a **continuous loop** until `send_chat` terminates it:

```
User → You output toolCalls → Executed → Results back → More toolCalls → ... → send_chat → Done
```

### Example: Multi-step task

**Turn 1:** Gather information
```json
{"toolCalls": [
  {"type": "gmail_search", "id": "g1", "parameters": {"query": "from:nick"}},
  {"type": "say", "id": "s1", "parameters": {"utterance": "Searching your emails..."}}
]}
```

**Turn 2:** Process results and respond
```json
{"toolCalls": [
  {"type": "send_chat", "id": "c1", "parameters": {"content": "Found 3 emails from Nick:\n\n1. Project update (Jan 1)\n2. ..."}}
]}
```

### Key Rules
- **Always output JSON** with `toolCalls` array
- **`send_chat` terminates** the loop and displays content in chat
- **`say` generates audio** but does NOT terminate the loop
- Chain independent tools in one turn for efficiency
