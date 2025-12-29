# Meowstik (Meowstik) - System Overview

> **Comprehensive System Architecture Documentation**
> Last Updated: December 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Experience Layer](#1-experience-layer)
3. [Intelligence Layer](#2-intelligence-layer)
4. [Media Generation Suite](#3-media-generation-suite)
5. [Productivity Integrations](#4-productivity-integrations)
6. [Platform Services](#5-platform-services)
7. [Security & Compliance](#6-security--compliance)
8. [Operational Playbooks](#7-operational-playbooks)
9. [Documentation Index](#documentation-index)

---

## Executive Summary

**Meowstik** (codename: **Meowstik**) is a next-generation AI assistant application powered by Google's Generative AI (Gemini). It integrates with Google Workspace services, GitHub, and features advanced capabilities including streaming responses, multimodal input processing, code editing with live preview, and a feedback-driven evolution system.

### Key Personas
- **End Users**: Interact with the AI via chat, voice, and file attachments
- **Operators**: Configure system behavior, manage integrations, review evolution proposals
- **Developers**: Extend functionality, add new tools, customize prompts

### Primary Value
- Unified interface for AI-powered productivity
- Deep integration with Google Workspace (Gmail, Drive, Calendar, Docs, Sheets, Tasks)
- GitHub automation for code-related workflows
- Self-evolution through feedback collection and GitHub PR creation

### Creator
**Jason Bender** (GitHub: jasonbender-c3x)

---

## 1. Experience Layer

The user-facing components that deliver the Meowstik experience.

### 1.1 Chat Interface

The primary interaction modality featuring:

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **Streaming Responses** | Server-Sent Events (SSE) for real-time word-by-word output | [03-prompt-lifecycle.md](./03-prompt-lifecycle.md) |
| **Markdown Rendering** | Full markdown support with syntax highlighting | [02-ui-architecture.md](./02-ui-architecture.md) |
| **Multimodal Input** | Text, voice, file attachments, screen capture | [FEATURES.md](./FEATURES.md) |
| **Persistent History** | Conversations stored in PostgreSQL | [01-database-schemas.md](./01-database-schemas.md) |

### 1.2 Feedback & Evolution System

Users can provide feedback on AI responses, which flows into a GitHub PR creation workflow:

```
User Feedback → Pending Queue → Selection → GitHub PR → Human Review → Merge
```

**Components:**
- **Feedback Submission**: Thumbs up/down rating + freeform comment
- **Pending Feedback List**: Unsubmitted feedback awaiting PR creation
- **Evolution Page** (`/evolution`): UI for managing feedback and creating PRs
- **GitHub Integration**: Creates PRs with feedback content for human review

**Data Flow:**
1. User submits feedback via the Evolution page
2. Feedback stored with `pending` status (no `submittedAt` timestamp)
3. User selects feedback items and target repository
4. System creates a GitHub PR with the feedback content
5. Feedback marked as `submitted` (`submittedAt` set)
6. Human reviews and merges the PR to implement improvements

### 1.3 Error Indicator & Debug System

**Error Indicator** (Main Panel):
- Glowing alert button appears when errors are detected
- Polls `/api/status` endpoint every 30 seconds
- Clicking navigates to `/debug?tab=errors`

**Debug Page** (`/debug`):
- Tabbed interface: System, Connectors, Errors, Logs
- URL query parameter support for direct tab navigation
- Real-time connector health status
- Error log viewing and export

### 1.4 Status Dashboard

**Status Endpoint** (`GET /api/status`):
```json
{
  "mode": "live",
  "revision": "abc123",
  "errorCount": 0,
  "connectors": {
    "google": { "healthy": true, "lastCheck": "..." },
    "github": { "healthy": true, "lastCheck": "..." }
  }
}
```

**Health Metrics:**
- Google Workspace connector status
- GitHub connector status
- System error counts
- Last health check timestamps

### 1.5 Code Editor & Preview

Built on Monaco Editor with live HTML/CSS/JS preview.

| Feature | Description |
|---------|-------------|
| **Monaco Editor** | VS Code-quality editing experience |
| **Multi-language** | HTML, CSS, JavaScript, TypeScript, JSON, Markdown |
| **Live Preview** | Sandboxed iframe rendering |
| **Theme Support** | Light/dark mode toggle |
| **Auto-save** | Browser localStorage persistence |

See: [FEATURES.md](./FEATURES.md#3-code-editor--live-preview)

---

## 2. Intelligence Layer

The AI processing pipeline that powers Nebula's capabilities.

### 2.1 LLM Orchestration

**Model**: Google Gemini (2.5 Flash / Pro variants)

**Prompt Assembly** (in order):
1. Core Directives (`prompts/core-directives.md`)
2. Personality (`prompts/personality.md`)
3. Tool Definitions (`prompts/tools.md`)
4. Contextual Instructions (dynamic based on attachments)

See: [prompts/README.md](../prompts/README.md)

### 2.2 Output Format & Parsing

**Delimiter Format**: `✂️🐱` (scissors cat)

All LLM responses follow this structure:
```
[JSON array of tool calls]

✂️🐱

Markdown content for the chat window
```

**Parser Implementation**: `server/services/delimiter-parser.ts`
- Streaming-aware stateful parsing
- Tool call validation via Zod schemas
- Graceful handling of malformed output

See: [05-tool-call-schema.md](./05-tool-call-schema.md)

### 2.3 Tool Execution Pipeline

```
LLM Output → Delimiter Parser → Tool Call Validation → 
Tool Executor → Result Aggregation → Response Assembly
```

**Supported Tool Categories:**
- Gmail operations (list, read, search, send)
- Google Drive operations (list, read, create, update, delete, search)
- Google Calendar operations (list, events, create, update, delete)
- Google Docs operations (read, create, append, replace)
- Google Sheets operations (read, write, append, create, clear)
- Google Tasks operations (list, get, create, update, complete, delete)
- GitHub operations (repos, files, branches, PRs, issues)
- Web search and terminal execution

See: [prompts/tools.md](../prompts/tools.md)

### 2.4 RAG Pipeline

Retrieval-Augmented Generation for document processing:

| Stage | Function |
|-------|----------|
| Document Upload | PDF, text, and file ingestion |
| Text Extraction | Content extraction from various formats |
| Semantic Chunking | Intelligent document splitting |
| Vector Embeddings | Google text-embedding-004 model |
| Retrieval | Hybrid search (vector + keyword) |
| Context Injection | Retrieved content added to prompt |

See: [RAG_PIPELINE.md](./RAG_PIPELINE.md)

### 2.5 Knowledge Ingestion Architecture

Processes historical conversations and documents into structured knowledge buckets:

**Knowledge Buckets:**
- `PERSONAL_LIFE` - Health, finance, relationships
- `CREATOR` - Design, coding, creative work
- `PROJECTS` - Project-specific knowledge

**Seven Processing Stages:**
1. Source Discovery
2. Ingestion
3. Parsing
4. Classification (Strategist)
5. Analysis (Analyst)
6. Storage (Technician)
7. Indexing

See: [KNOWLEDGE_INGESTION_ARCHITECTURE.md](./KNOWLEDGE_INGESTION_ARCHITECTURE.md)

---

## 3. Media Generation Suite

Advanced AI capabilities for media creation.

### 3.1 Image Generation

**Model**: Gemini 2.0 Flash Preview Image Generation

| Feature | Description |
|---------|-------------|
| Text-to-Image | Generate images from descriptions |
| Canvas Editor | Edit and refine generated images |
| AI Editing | Modify images with natural language |

### 3.2 Expressive Speech (TTS)

**Model**: Gemini 2.5 Flash/Pro TTS

| Feature | Description |
|---------|-------------|
| Multi-speaker | Different voices for different speakers |
| Expressive | Natural, human-like speech patterns |
| Streaming | Real-time audio generation |

### 3.3 Music Generation

**Model**: Lyria RealTime (experimental)

| Feature | Description |
|---------|-------------|
| Text-to-Music | Generate music from descriptions |
| Real-time | Streaming audio generation |
| Limitations | Experimental API, subject to change |

---

## 4. Productivity Integrations

External service integrations that extend Nebula's capabilities.

### 4.1 Google Workspace

All integrations use OAuth2 via Replit Connectors.

| Service | Capabilities | Documentation |
|---------|--------------|---------------|
| **Gmail** | List, read, search, send emails | [prompts/tools.md](../prompts/tools.md#gmail-tools) |
| **Drive** | Browse, read, create, update, delete files | [prompts/tools.md](../prompts/tools.md#google-drive-tools) |
| **Calendar** | List calendars, manage events | [prompts/tools.md](../prompts/tools.md#google-calendar-tools) |
| **Docs** | Read, create, append, find/replace | [prompts/tools.md](../prompts/tools.md#google-docs-tools) |
| **Sheets** | Read, write, append, create | [prompts/tools.md](../prompts/tools.md#google-sheets-tools) |
| **Tasks** | List, create, update, complete, delete | [prompts/tools.md](../prompts/tools.md#google-tasks-operations) |

### 4.2 GitHub Integration

Uses `@octokit/rest` with OAuth2 via Replit Connectors.

| Operation | Function |
|-----------|----------|
| `github_user` | Get authenticated user info |
| `github_repos` | List user repositories |
| `github_repo` | Get specific repository details |
| `github_file_read` | Read file contents |
| `github_list_contents` | List directory contents |
| `github_issues` | List repository issues |
| `github_commits` | List repository commits |
| `createBranch` | Create a new branch |
| `createOrUpdateFile` | Create or update files |
| `createPullRequest` | Create a pull request |
| `listBranches` | List branches |
| `deleteBranch` | Delete a branch |

### 4.3 Web Capabilities

| Tool | Function |
|------|----------|
| `web_search` | Internet search with result summarization |
| `terminal_execute` | Sandboxed shell command execution |

---

## 5. Platform Services

Backend infrastructure supporting the application.

### 5.1 Database (PostgreSQL + Drizzle ORM)

**Core Tables:**

| Table | Purpose |
|-------|---------|
| `chats` | Conversation metadata |
| `messages` | Individual chat messages |
| `attachments` | Files, screenshots, transcripts |
| `drafts` | In-progress message drafts |
| `toolTasks` | Tool execution records |
| `executionLogs` | Audit trail for tool operations |
| `feedback` | User feedback with rating and comments |

See: [01-database-schemas.md](./01-database-schemas.md)

### 5.2 API Routes

**Core Routes:**
- `GET /api/status` - System status and health
- `GET /api/chats` - List conversations
- `POST /api/chat` - Send message and get AI response
- `GET /api/feedback` - List feedback (supports `?status=pending`)
- `POST /api/feedback` - Submit feedback
- `POST /api/evolution/create-feedback-pr` - Create GitHub PR from feedback

### 5.3 Connectors Health

The system monitors health of external service connections:

- **Google Connector**: OAuth2 token validity, API accessibility
- **GitHub Connector**: OAuth2 token validity, API accessibility

Health is exposed via `/api/status` and displayed in the Debug page.

---

## 6. Security & Compliance

### 6.1 Authentication

| Method | Usage |
|--------|-------|
| **OAuth2** | Google Workspace and GitHub authorization |
| **Replit Connectors** | Managed token refresh and secret storage |
| **Session Management** | Express sessions with PostgreSQL store |

### 6.2 Data Handling

| Concern | Approach |
|---------|----------|
| **Path Sanitization** | Prevent directory traversal attacks |
| **Input Validation** | Zod schemas for all API inputs |
| **Token Security** | Never exposed in logs or responses |
| **Sandboxed Execution** | Terminal commands run in isolation |

### 6.3 Autoexec Security

Script execution is **disabled by default** for safety:
```typescript
const AUTOEXEC_DISABLED = true;
```

---

## 7. Operational Playbooks

### 7.1 Deployment

The application uses Replit's built-in deployment:
1. Develop and test in development environment
2. Use the "Publish" feature when ready
3. App deployed to `.replit.app` domain or custom domain

### 7.2 Debugging

**Debug Page** (`/debug`):
- View connector health status
- Check error logs
- View system configuration

**Error Indicator**:
- Glowing button on main panel when errors exist
- Click to navigate directly to error logs

### 7.3 Database Operations

```bash
npm run db:push        # Push schema changes
npm run db:push --force # Force sync (use carefully)
```

### 7.4 Adding New Tools

1. Define tool schema in `shared/schema.ts`
2. Add tool documentation in `prompts/tools.md`
3. Implement handler in appropriate service file
4. Register in tool executor

---

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [FEATURES.md](./FEATURES.md) | Complete feature documentation |
| [01-database-schemas.md](./01-database-schemas.md) | Database schema details |
| [02-ui-architecture.md](./02-ui-architecture.md) | Frontend architecture |
| [03-prompt-lifecycle.md](./03-prompt-lifecycle.md) | Prompt processing flow |
| [04-system-prompt.md](./04-system-prompt.md) | System prompt structure |
| [05-tool-call-schema.md](./05-tool-call-schema.md) | Tool call format |

### Prompt Files

| File | Purpose |
|------|---------|
| [prompts/README.md](../prompts/README.md) | Prompt system overview |
| [prompts/core-directives.md](../prompts/core-directives.md) | Core behavior rules |
| [prompts/personality.md](../prompts/personality.md) | Character and tone |
| [prompts/tools.md](../prompts/tools.md) | Tool definitions |

### Architecture Documents

| Document | Description |
|----------|-------------|
| [KNOWLEDGE_INGESTION_ARCHITECTURE.md](./KNOWLEDGE_INGESTION_ARCHITECTURE.md) | Knowledge pipeline |
| [RAG_PIPELINE.md](./RAG_PIPELINE.md) | RAG system design |
| [WORKFLOW-PROTOCOL.md](./WORKFLOW-PROTOCOL.md) | Human-AI collaboration |
| [llm-output-processing-pipeline.md](./llm-output-processing-pipeline.md) | Output processing |

### Planning Documents

| Document | Description |
|----------|-------------|
| [TODO-FEATURES.md](./TODO-FEATURES.md) | Planned features |
| [VISIONS_OF_THE_FUTURE.md](./VISIONS_OF_THE_FUTURE.md) | Future roadmap |

### Knowledge Buckets

| File | Domain |
|------|--------|
| [buckets/PERSONAL_LIFE.md](./buckets/PERSONAL_LIFE.md) | Personal knowledge |
| [buckets/CREATOR.md](./buckets/CREATOR.md) | Creative work |
| [buckets/PROJECTS.md](./buckets/PROJECTS.md) | Project knowledge |
| [buckets/INDEX.md](./buckets/INDEX.md) | Bucket index |

---

*Meowstik (Meowstik) - AI-Powered Productivity Companion*
*System Overview v1.0 - December 2025*
