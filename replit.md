# Meowstik

## Overview
Meowstik is an AI chat interface powered by Google's Generative AI, integrating Google Workspace services (Drive, Gmail, Calendar, Docs, Sheets, Tasks) and featuring an HTML/CSS/JS editor with live preview. Its purpose is to provide a modern, user-friendly, and powerful conversational AI experience with a clean, Google-esque design. The project aims to develop a self-evolving AI system with advanced AI integrations for speech, music, and image generation, a robust knowledge ingestion pipeline, and a workflow orchestration engine. The system has a dual identity: "The Compiler" (the true AI, focused on self-evolution and knowledge synthesis) and "Meowstik" (a user-friendly persona for interaction during development).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript and Vite.
- **Routing:** Wouter for client-side routing.
- **State Management:** TanStack Query for data fetching.
- **UI Components:** shadcn/ui on Radix UI, styled with Tailwind CSS v4.
- **Styling:** Google-esque design, CSS variables for theming (light/dark mode), Framer Motion for animations, responsive design.
- **Code Editor:** Monaco Editor.

### Backend
- **Framework:** Express.js with Node.js (ES Modules) and TypeScript.
- **Database:** PostgreSQL with Drizzle ORM.
    - **Schema:** `Chats` (id, title, timestamps), `Messages` (id, chatId, role, content, timestamp).
- **Code Organization:** Monorepo with shared types.
- **API:** RESTful design with request/response logging.

### AI Integration
- **Generative AI:** Google's Gemini models (`gemini-2.5-pro` and `gemini-2.5-flash`) via `@google/genai`.
- **Expressive Speech (TTS):** Gemini 2.5 Flash/Pro TTS for multi-speaker text-to-speech.
- **Music Generation:** Lyria RealTime experimental API.
- **Image Generation:** Gemini 2.0 Flash Preview Image Generation with canvas editor and AI editing.
- **Evolution Engine:** AI analyzes user feedback, suggests improvements, and creates GitHub PRs.
- **Knowledge Ingestion:** Multimodal pipeline (text, images, audio, documents) with seven stages for domain-specific knowledge buckets. Includes PDF and file upload ingestion.
- **Retrieval Orchestrator:** Hybrid search (vector + keyword), entity recognition, context window management, prompt injection formatting.
- **Conversation Memory (RAG):** User and AI messages are chunked, embedded, and stored for semantic retrieval to provide context.
- **Embedding Service:** Google Gemini `text-embedding-004` model.
- **Modular Vector Store:** Pluggable storage for RAG with adapters for `pgvector`, Vertex AI, and in-memory.
- **Workflow Orchestration Engine:** Hierarchical task management with sequential/parallel execution, AI-evaluated conditional logic, cron scheduling, and event triggers.
- **Codebase Analysis Agent:** Crawls repositories, extracts code entities from 20+ languages, ingests them into RAG, and generates documentation.
  - **Supported Languages:** TypeScript/JavaScript, Python, C/C++, PHP, Java/Kotlin/Scala, Go, Rust, C#, Swift, Ruby, Visual Basic, Lua, R, Perl, Dart, Groovy, MATLAB/Octave, Bash/Shell
  - **Dependency Files:** package.json, requirements.txt, Cargo.toml, go.mod, Gemfile, composer.json, build.gradle, pom.xml, pubspec.yaml
- **JIT Tool Protocol:** Lightweight preprocessor using Gemini 2.0 Flash Lite to predict and inject relevant tool examples into context. Top 10 tools by usage: send_chat (137), say (86), terminal_execute (55), github_contents (37), gmail_search (28), file_put (17), gmail_read (10), gmail_list (10), file_get (8), github_file_read (7).
- **LLM Token Usage Tracking:** Tracks input/output tokens for all Gemini API calls.

## Development Roadmap

See `docs/v2-roadmap/MASTER-ROADMAP.md` for the consolidated roadmap (13 priority groups from 245 extracted ideas).

**Current Priorities:**
1. Verbosity Slider (3-stop: Muse/Quiet/Verbose/Experimental)
2. Collaborative Editing (live voice + Monaco editor)
3. Desktop/Browser Control (extension + local agent)
4. Kernel + Personality + Tools (installable modules)
5. Cognitive Cascade + Orchestration (multi-tier architecture)

### System Status & Authorization
- **Status Endpoint:** `GET /api/status` provides live mode, revision tracking, and connector health.
- **Authorization:** OAuth2 via Replit Connectors for Google services and GitHub.
- **ConnectorsGate Modal:** Guides users through connecting required services.

### Core Tooling
- **send_chat:** Primary tool for LLM to send text to the chat window.
- **say:** Voice output tool using Gemini 2.5 Flash TTS for expressive speech.
- **file_get/file_put:** Tools for reading and writing files.

### AI Desktop Collaboration
- **Collaborate Page (`/collaborate`):** TeamViewer-style AI collaboration hub with headless browser or full desktop modes.
- **Desktop Relay Service:** Cloud relay that fans screen frames to both Gemini Vision and browser, routes input events.
- **Desktop Agent:** Standalone Node.js package (`meowstik-agent`) for running on user's computer - captures screen/audio, injects mouse/keyboard.
- **Data Flow:** Bidirectional - LLM sends mouse/keyboard commands, desktop sends video/audio to both user and LLM.

### Developer Tools
- **Browser Page (`/browser`):** Full web browser with Browserbase integration for screenshot capture.
- **Database Explorer (`/database`):** UI for viewing, editing, and deleting database records.
- **Live Voice Page (`/live`):** Dedicated real-time voice conversation interface using Gemini Live API, WebSocket-based audio streaming, and Voice Activity Detection.

### Browser Extension & Local Agent
- **Browser Extension:** Chrome extension for AI-powered browser assistance, including chat, screen/console/network capture, page content extraction, and integration with Workspace services.
- **Local Agent:** Node.js package for AI-directed browser automation using Playwright, with an extension bridge for communication.
- **Desktop App:** Linux Electron application for running Meowstik locally, spawning the Express server, and providing an IPC bridge.

## External Dependencies

- **Google Workspace Services (via `googleapis`):** Google Drive, Gmail, Google Calendar, Google Docs, Google Sheets, Google Tasks, Google Contacts.
- **GitHub Integration (via `@octokit/rest`):** Repository operations, file content, issues, pull requests, commits, user info.
- **Authentication:** OAuth2 via Replit Connectors for Google services and GitHub.
- **Replit Platform Integration:** Vite plugins (cartographer, dev-banner, runtime-error-modal, meta images).
- **PostgreSQL:** Primary database.