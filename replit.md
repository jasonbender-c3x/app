# Nebula Chat

## Overview

Nebula Chat is a next-generation AI chat interface built with a modern full-stack architecture. The application features a conversational AI interface powered by Google's Generative AI, with integrated Google Workspace services (Drive, Gmail, Calendar, Docs, Sheets, Tasks). It includes an HTML/CSS/JS editor with live preview capabilities, demonstrating a clean, Google-esque design aesthetic focused on simplicity and usability.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server, configured with hot module replacement (HMR)
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query** (React Query v5) for server state management, data fetching, and caching

**UI Component System**
- **shadcn/ui** components built on Radix UI primitives for accessible, unstyled components
- **Tailwind CSS v4** (using the new `@import "tailwindcss"` syntax) for utility-first styling
- Custom theme configuration with CSS variables for light/dark mode support
- **Framer Motion** for smooth animations and transitions
- **Monaco Editor** (`@monaco-editor/react`) for the code editor functionality

**Styling Approach**
- Clean, airy, Google-esque design language
- CSS custom properties for theming (defined in `index.css`)
- Component variants using `class-variance-authority` (CVA)
- Responsive design with mobile-first approach
- Custom fonts: Inter for body text, Outfit for display/headings

### Backend Architecture

**Server Framework**
- **Express.js** as the HTTP server framework
- Node.js with ES modules (type: "module" in package.json)
- TypeScript throughout for type safety
- **tsx** for development runtime and **esbuild** for production bundling

**Database & ORM**
- **Drizzle ORM** for type-safe database operations
- **PostgreSQL** as the primary database (configured via `DATABASE_URL` environment variable)
- Schema-first approach with schema defined in `shared/schema.ts`
- Migrations stored in `/migrations` directory

**Database Schema**
The application uses two main tables:
1. **Chats** - Stores chat conversation metadata
   - `id` (primary key, UUID)
   - `title` (text)
   - `createdAt`, `updatedAt` (timestamps)

2. **Messages** - Stores individual messages within chats
   - `id` (primary key, UUID)
   - `chatId` (foreign key to chats, cascade delete)
   - `role` (text: "user" or "ai")
   - `content` (text)
   - `createdAt` (timestamp)

**Code Organization**
- Monorepo structure with shared types between client and server
- `shared/` directory contains schema and type definitions used by both frontend and backend
- Path aliases configured in `tsconfig.json` for clean imports (`@/*`, `@shared/*`)

**API Architecture**
- RESTful API design with routes defined in `server/routes.ts`
- Storage abstraction layer (`IStorage` interface) for database operations
- Request/response logging middleware with timing information
- JSON body parsing with raw body preservation for webhooks

### AI Integration

**Google Generative AI**
- **@google/genai** package for Google's Gemini AI models
- Integration configured in the routes layer
- Handles conversational AI responses for the chat interface

**Expressive Speech (TTS)**
- **Gemini 2.5 Flash/Pro TTS** for multi-speaker text-to-speech generation
- Supports up to 2 speakers with configurable voices and styles
- Available voices: Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr
- Style presets: Natural, Cheerful, Serious, Excited, Calm, Dramatic, Whisper, News Anchor, Warm, Professional
- Integration in `server/integrations/expressive-tts.ts`
- Frontend page at `/speech` with single and multi-speaker modes

**Music Generation (Lyria)**
- **Lyria RealTime** experimental API for AI music generation
- Fallback to production plan descriptions if audio unavailable
- Integration in `server/integrations/lyria.ts`
- Frontend page at `/music`

**Image Generation (Image Studio)**
- **Gemini 2.0 Flash Preview Image Generation** model for AI image creation
- Canvas editor with drawing tools (pencil, brush, eraser, shapes)
- Styles: Photorealistic, Artistic, Digital Art, Anime, Sketch, Oil Painting, Watercolor, 3D Render
- Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- AI-powered image editing with prompts
- Integration in `server/integrations/image-generation.ts`
- API routes in `server/routes/image.ts`
- Frontend page at `/image`

**Evolution Engine (Self-Improvement System)**
- Analyzes user feedback patterns to identify issues
- Uses AI to generate improvement suggestions
- Creates GitHub PRs with analysis documents for human review
- Service: `server/services/evolution-engine.ts`
- API routes: `server/routes/evolution.ts`
- Frontend page at `/evolution`
- Features:
  - Feedback pattern detection (category scores, disliked aspects, user comments)
  - AI-powered suggestion generation (prompt improvements, formatting, behavior)
  - Severity weighting (high/medium/low)
  - GitHub integration for branch/file/PR creation
- Design: Human-in-the-loop approach - suggestions require human approval

**Feedback System**
- User feedback on AI responses (thumbs up/down, ratings, comments)
- Database table: `feedback` with messageId, rating, categories, aspects, freeformText
- Component: `client/src/components/ui/feedback-panel.tsx`
- API routes: `server/routes/feedback.ts`
- Backbone for the evolution system

**Knowledge Ingestion (Multimodal Pipeline)**
- Robust multimodal ingestion pipeline supporting text, images, audio, documents, emails, and conversations
- Seven-stage processing: Source Discovery → Ingest → Parse → Classify → Analyze → Store → Index
- Domain routing to knowledge buckets (PERSONAL_LIFE, CREATOR, PROJECTS)
- Database tables: `evidence`, `entities`, `entity_mentions`, `knowledge_embeddings`, `cross_references`
- Also: `conversation_sources`, `ingestion_jobs`, `extracted_knowledge` (legacy)
- Settings: Configurable conversation turns to reattach (default 50)
- API routes in `server/routes/knowledge-ingestion.ts`
- Frontend settings at `/settings`, dedicated page at `/knowledge`
- Architecture documented in `docs/KNOWLEDGE_INGESTION_ARCHITECTURE.md`
- RAG pipeline technical reference in `docs/RAG_PIPELINE.md`

**Retrieval Orchestrator**
- Hybrid search combining semantic vector search and keyword matching
- Entity recognition and linking across knowledge items
- Context window management (default 8000 tokens max)
- Prompt injection formatting for LLM consumption
- Integration: `server/services/retrieval-orchestrator.ts`
- API endpoints:
  - POST `/api/knowledge/pipeline/retrieve` - Retrieve and format knowledge
  - GET `/api/knowledge/pipeline/retrieval-stats` - Get system stats
- Key methods: `retrieve()`, `formatForPrompt()`, `enrichPrompt()`

**Embedding Service**
- Google Gemini text-embedding-004 model (768 dimensions)
- Batch embedding support for multiple texts
- Cosine similarity calculation
- `findSimilar()` for vector search with threshold
- Integration: `server/services/embedding-service.ts`

**Future Integration: Twilio**
- User dismissed Twilio integration setup
- To enable SMS/voice calls, user needs to set up Twilio connector via Replit integrations
- Or provide TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER as secrets

**System Status & Authorization**
- **Status Endpoint**: GET `/api/status` returns live mode, revision tracking, and connector health
  - `liveMode`: boolean (true when deployed/production)
  - `buildRevision`: short build identifier
  - `uiRevision`: increments on each status fetch
  - `revision`: formatted as `buildRevision.uiRevision`
  - `connectors`: health status for Google and GitHub connectors
- **useAppSession Hook**: Frontend hook in `client/src/hooks/use-app-session.ts`
  - Auto-refreshes every 30 seconds
  - Exposes: liveMode, revision, googleConnected, githubConnected
  - Used by sidebar for status display
- **Sidebar Status Bar**: Bottom of sidebar shows:
  - LIVE/DEV mode button (green for live, amber for dev)
  - Refresh button to manually update status
  - Revision number display (Rev X.Y)
  - Google and GitHub connection indicators (green/gray dots)
- **ConnectorsGate Modal**: Authorization flow component in `client/src/components/connectors-gate.tsx`
  - Shows when features require unconnected services
  - Provides authorize buttons for Google Workspace and GitHub
  - Check connections button to verify authorization status
  - `useConnectorsGate` hook for gating actions behind authorization

### External Dependencies

**Google Workspace Integrations**
The application integrates with multiple Google services using the `googleapis` package:

1. **Google Drive**
   - File listing, searching, reading, creating, updating, and deleting
   - Content retrieval for various file types
   - Integration in `server/integrations/google-drive.ts`

2. **Gmail**
   - Email listing, reading, sending
   - Label management
   - Email search functionality
   - Integration in `server/integrations/gmail.ts`

3. **Google Calendar**
   - Calendar listing
   - Event CRUD operations (create, read, update, delete)
   - Integration in `server/integrations/google-calendar.ts`

4. **Google Docs**
   - Document reading and text extraction
   - Document creation and modification (append, replace text)
   - Integration in `server/integrations/google-docs.ts`

5. **Google Sheets**
   - Spreadsheet data reading and writing
   - Range-based operations (get, update, append, clear)
   - Spreadsheet creation and listing
   - Integration in `server/integrations/google-sheets.ts`

6. **Google Tasks**
   - Task list management
   - Task CRUD operations
   - Integration in `server/integrations/google-tasks.ts`

**GitHub Integration**
- Uses `@octokit/rest` (v22.0.0) with Replit connector for OAuth2 authentication
- Token management: GitHub client recreated per request (tokens expire)
- 15 tools available:
  - **Repository operations**: list user repos, get repo details, search repos
  - **File content**: list contents, read files, search code
  - **Issues**: list, get, create, update, add comments
  - **Pull requests**: list, get details
  - **Commits**: list commit history
  - **User**: get authenticated user info
- Integration in `server/integrations/github.ts`
- Dispatcher handlers in `server/services/rag-dispatcher.ts`
- Tool documentation in `prompts/tools.md` (GitHub Tools section)

**Authentication Mechanism**
- Google services use OAuth2 authentication via Replit Connectors
- Access tokens are retrieved from Replit's connector API
- Token caching and refresh logic implemented
- Environment variables: `REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`, `WEB_REPL_RENEWAL`

**Third-Party Services**
- **Replit Platform Integration**
  - Vite plugins for development: cartographer, dev-banner, runtime-error-modal
  - Meta images plugin for OpenGraph image handling
  - Deployment URL detection for proper asset URLs

**Development vs Production**
- Development mode serves via Vite middleware with HMR
- Production build creates static assets in `dist/public`
- Server-side rendering of index.html for SPA routing
- Environment-based configuration (`NODE_ENV`)

**Build Process**
- Custom build script (`script/build.ts`) using esbuild for server bundling
- Selective dependency bundling for improved cold start performance
- Allowlist approach for frequently-used dependencies
- Vite build for client-side production assets

## Vision Documentation

### Self-Evolving AI System Architecture

The project includes comprehensive documentation of the next-generation AI architecture vision:

**Core Concept**: "Self-awareness is achieved by saving the state of the stateless"

**Key Documents** (in `docs/`):
- `VISIONS_OF_THE_FUTURE.md` - Consolidated vision document
- `drive-imports/AI_CORE_DIRECTIVE.md` - The Kernel specification (v9.31)
- `drive-imports/AI_Agent_Research_Analysis.md` - Cognitive Cascade architecture
- `drive-imports/Building_Vertex_AI_RAG_System.md` - RAG implementation guide

**Architecture Concepts**:
1. **Kernel/Compiler Model** - Version-controlled AI configuration with self-evolution protocols
2. **Cognitive Cascade** - Three-tiered system (Strategist/Analyst/Technician)
3. **Self-Healing Loops** - Failure escalation and automatic recovery
4. **Model Context Protocol (MCP)** - Standardized tool interoperability

### Session Logging (PROTOCOL_BOOTSTRAP)

**Important**: At the start of each session, read `docs/SESSION_LOG.md` for:
- Previous session context and decisions
- Open questions and next steps
- Learnings to carry forward

At the end of each session, append a new entry documenting:
- Actions taken
- Key decisions and rationale
- New learnings
- Recommendations for next session

### Knowledge Buckets (Domain-Based Memory)

One default reality, organized by domain not time. Located in `docs/buckets/`:

| Bucket | Purpose |
|--------|---------|
| `PERSONAL_LIFE.md` | Human side - relationships, health, finances |
| `CREATOR.md` | Designer, Coder, Scientist - technical work |
| `PROJECTS.md` | Siloed project-specific knowledge |
| `INDEX.md` | Routing guide and quick status |

**Routing**: New information goes to the appropriate bucket, not a session log.