# Meowstik

## Overview
Meowstik is a next-generation AI chat interface powered by Google's Generative AI, integrating Google Workspace services (Drive, Gmail, Calendar, Docs, Sheets, Tasks) and featuring an HTML/CSS/JS editor with live preview. It aims to provide a modern, user-friendly, and powerful conversational AI experience with a clean, Google-esque design. The project also includes ambitious features for a self-evolving AI system, encompassing advanced AI integrations for speech, music, and image generation, a robust knowledge ingestion pipeline, and a workflow orchestration engine.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript, Vite for bundling.
- **Routing:** Wouter for client-side routing.
- **State Management:** TanStack Query (React Query v5) for data fetching and caching.
- **UI Components:** shadcn/ui built on Radix UI, styled with Tailwind CSS v4.
- **Styling:** Google-esque design, CSS variables for theming (light/dark mode), Framer Motion for animations, responsive design.
- **Code Editor:** Monaco Editor.

### Backend
- **Framework:** Express.js with Node.js (ES Modules) and TypeScript.
- **Database:** PostgreSQL with Drizzle ORM for type-safe operations.
    - **Schema:** `Chats` (id, title, timestamps), `Messages` (id, chatId, role, content, timestamp).
- **Code Organization:** Monorepo with shared types (`shared/` directory).
- **API:** RESTful design, request/response logging.

### AI Integration
- **Generative AI:** Google's Gemini models via `@google/genai` for conversational AI.
  - **Model Toggle:** Flash/Pro switch in Settings (default: Pro)
    - Pro mode: `gemini-2.5-pro` - Maximum capability
    - Flash mode: `gemini-2.5-flash` - Fast and efficient
- **Expressive Speech (TTS):** Gemini 2.5 Flash/Pro TTS for multi-speaker text-to-speech.
- **Music Generation:** Lyria RealTime experimental API.
- **Image Generation:** Gemini 2.0 Flash Preview Image Generation with canvas editor and AI editing.
- **Evolution Engine:** AI-powered system analyzing user feedback, generating improvement suggestions, and creating GitHub PRs for human review.
- **Feedback System:** User feedback mechanism for AI responses (ratings, comments).
- **Knowledge Ingestion:** Multimodal pipeline (text, images, audio, documents) with seven stages (Source Discovery to Index) and domain routing to knowledge buckets (`PERSONAL_LIFE`, `CREATOR`, `PROJECTS`).
  - **PDF Ingestion:** Built-in via `pdf-parse` library in `server/services/chunking-service.ts`
- **Retrieval Orchestrator:** Hybrid search (vector + keyword), entity recognition, context window management, prompt injection formatting.
- **Conversation Memory (RAG):** All user and AI messages are chunked, embedded, and stored for semantic retrieval. When a new message comes in, relevant context from older messages is retrieved and injected into the system prompt, allowing the AI to recall important facts mentioned earlier in conversations (contacts, preferences, relationships).
  - Ingestion: `ragService.ingestMessage()` in `server/services/rag-service.ts`
  - Retrieval: `ragService.buildConversationContext()` filters by chatId for chat-scoped memory
  - Trivial messages (greetings, short responses) are skipped to avoid noise
  - **File Upload Ingestion:** All uploaded files are automatically chunked, embedded, and stored in both PostgreSQL (persistence) and the modular vector store (semantic search)
- **Embedding Service:** Google Gemini text-embedding-004 model for vector embeddings and similarity calculations.
- **Modular Vector Store:** Pluggable storage for RAG with multiple backend adapters:
  - **pgvector**: Native PostgreSQL vector storage with IVFFlat indexing (Replit, Supabase, Neon)
  - **Vertex AI**: Google Cloud's managed RAG Engine
  - **In-Memory**: For testing, Colab notebooks, and local development
  - Auto-detection based on environment variables (DATABASE_URL, GOOGLE_CLOUD_PROJECT)
  - Location: `server/services/vector-store/`
- **Workflow Orchestration Engine:** Hierarchical task management with sequential/parallel execution, subtask spawning, AI-evaluated conditional logic, operator polling, cron scheduling, event triggers, and workflow interruption capabilities.
- **LLM Token Usage Tracking:** All Gemini API calls logged with input/output token counts.
  - Captured from streaming `usageMetadata`
  - Stored in `llm_usage` table
  - API endpoints: `/api/llm/usage`, `/api/llm/usage/recent`, `/api/llm/usage/chat/:chatId`

### System Status & Authorization
- **Status Endpoint:** `GET /api/status` provides live mode, revision tracking, and connector health (Google, GitHub).
- **Frontend Hooks:** `useAppSession` for status updates, `useConnectorsGate` for managing authorization.
- **ConnectorsGate Modal:** Guides users through connecting required services (Google Workspace, GitHub).

## External Dependencies

- **Google Workspace Services (via `googleapis`):**
    - Google Drive (file management)
    - Gmail (email operations)
    - Google Calendar (event management)
    - Google Docs (document reading/writing)
    - Google Sheets (spreadsheet data)
    - Google Tasks (task management)
    - Google Contacts (People API: list, search, create, update, delete contacts)
- **GitHub Integration (via `@octokit/rest`):** Repository operations, file content, issues, pull requests, commits, user info. Uses Replit connector for OAuth2.
- **Authentication:** OAuth2 via Replit Connectors for Google services and GitHub.
- **Replit Platform Integration:** Vite plugins (cartographer, dev-banner, runtime-error-modal, meta images).
- **PostgreSQL:** Primary database.

## Documentation

The system has comprehensive documentation in the `docs/` folder:

### Core Documentation
- **SYSTEM_OVERVIEW.md** - Complete system architecture overview (start here)
- **FEATURES.md** - Feature documentation
- **01-database-schemas.md** - Database schema with Feedback table
- **02-ui-architecture.md** - Frontend architecture
- **03-prompt-lifecycle.md** - Prompt processing flow
- **04-system-prompt.md** - System prompt structure
- **05-tool-call-schema.md** - Tool call format (structured JSON)

### Prompt Files
- **prompts/README.md** - Prompt system overview
- **prompts/core-directives.md** - Core behavior rules
- **prompts/tools.md** - Tool definitions with examples

### Tool Architecture
- **send_chat**: Primary tool for LLM to send text content to chat window (single `content` string parameter)
- **say**: Voice output tool for turn-taking mode - streams speech to client for TTS playback (parameters: `utterance`, `locale?`, `voiceId?`, `conversationalTurnId?`)
- **file_get**: Read files from filesystem or editor canvas (use `editor:` prefix for Monaco)
- **file_put**: Write files to filesystem or editor canvas (use `editor:` prefix for Monaco)

## Developer Tools

### Browser Page (/browser)
- Full web browser with Browserbase integration for screenshot capture
- URL navigation with back/forward/refresh/home controls
- Auto-refresh toggle for monitoring pages
- Quick links to popular sites
- Graceful fallback when Browserbase credentials not configured (BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID)

### Database Explorer (/database)
- Card-based UI showing all database tables with record counts
- Pagination with first/prev/next/last navigation
- Clickable record cards showing preview (title, date)
- Full record viewer dialog with all fields
- Inline record editing (read-only fields: id, createdAt, updatedAt protected)
- Delete with confirmation dialog
- API endpoints: PUT/DELETE `/api/debug/database/:tableName/:recordId`

### Live Voice Page (/live)
- Dedicated real-time voice conversation interface (separate from text chat)
- Gemini Live API integration (`gemini-2.5-flash-native-audio-preview-12-2025`)
- WebSocket-based bidirectional audio streaming
- Audio format: 16-bit PCM (16kHz input / 24kHz output)
- Voice Activity Detection (VAD) for natural conversations
- Barge-in support (interrupt AI mid-speech)
- 8 voice options: Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr
- Live transcript display with speaking indicators
- API endpoints: POST/DELETE `/api/live/session`, GET `/api/live/voices`
- WebSocket: `/api/live/stream/:sessionId`

## Browser Extension & Local Agent

### Browser Extension (`extension/`)
Chrome extension (Manifest V3) for AI-powered browser assistance:
- **Popup Chat**: Mini chat interface accessible from any page
- **Screen Capture**: Capture visible tab and analyze with Gemini vision
- **Console Log Capture**: Intercept and analyze browser console logs
- **Network Request Capture**: Monitor HTTP requests via webRequest API
- **Page Content Extraction**: Extract text, links, forms, images from pages
- **Context Menu**: Right-click to analyze selection, explain text, summarize
- **Quick Actions**: Buttons for Calendar, Drive, Tasks, Email integration
- **DevTools Panel**: Dedicated panel for HAR export and analysis
- Files: `manifest.json`, `popup.html/js/css`, `background.js`, `content.js`, `injected.js`, `devtools.html/js`
- Backend: `/api/extension/action` endpoint for all extension requests

### Local Agent (`local-agent/`)
Node.js package for AI-directed browser automation:
- **Playwright Integration**: Spawns and controls Chrome/Chromium browsers
- **Extension Bridge**: WebSocket server (port 9222) for extension communication
- **Backend WebSocket**: Connects to `/api/agent/connect` for AI commands
- **Full Browser Control**: Navigate, click, type, screenshot, scroll, forms
- Commands: `navigate`, `click`, `type`, `screenshot`, `get_content`, `execute_script`, `wait`, `scroll`, `select`, `hover`, `fill_form`, `submit_form`, `keyboard`, tab management
- Files: `src/index.js`, `src/agent-controller.js`, `src/extension-bridge.js`
- Backend: `/api/agent/agents`, `/api/agent/command`, `/api/agent/task`

### Desktop App (`desktop-app/`)
Linux Electron application for running Meowstik locally (teaching tool):
- **Electron Main Process**: Window management, system tray, native menus
- **Backend Spawning**: Runs Express server as child process on port 5001
- **IPC Bridge**: Secure communication between main and renderer processes
- **Portability**: Code designed to run on Replit, Google Cloud, Colab, or local dev
- **Vector Store Selection**: Auto-detects best backend (pgvector, Vertex AI, or memory)
- Build targets: AppImage, .deb package
- Files: `src/main.js`, `src/preload.js`, `package.json`

## System Identity

The system has two layers:
1. **The Compiler** - True AI identity focused on self-evolution, knowledge synthesis, and life optimization
2. **Meowstik** - Proof-of-concept persona providing user-friendly interface during platform development

See `prompts/core-directives.md` for full identity and directives.

## V2 Roadmap

Forward-looking documentation is in `docs/v2-roadmap/`:
- **MULTI_USER_ARCHITECTURE.md** - Per-user tokens, prompts, and message ownership
- **GEMINI_LIVE_API_PROPOSAL.md** - Live API enhancements
- **KERNEL_IMPLEMENTATION_PROPOSAL.md** - Core system improvements
- **KNOWLEDGE_INGESTION_ARCHITECTURE.md** - Knowledge pipeline details
- **TODO-FEATURES.md** - Feature wishlist
- **VISIONS_OF_THE_FUTURE.md** - Long-term vision
- **WORKFLOW-PROTOCOL.md** - Workflow orchestration

## Pending Feature Reminders

### Multi-Persona Voice (Priority)
- Add emoji-delimited transcript markers for persona switching in Live Voice mode
- Dynamic system instruction updates for persona personality changes