# Meowstik AI Coding Instructions

## Big Picture Architecture
Meowstik is a full-stack AI assistant platform.
- **Frontend**: React (Vite) + Tailwind CSS + Radix UI. Routing via `wouter`.
- **Backend**: Express.js server. Database is PostgreSQL managed by Drizzle ORM.
- **AI Core**: Google Gemini (`@google/genai`). Responses are streamed via Server-Sent Events (SSE).
- **Integrations**: Deep Google Workspace integration (`googleapis`) and GitHub automation.
- **Evolution System**: User feedback flows into a GitHub PR creation workflow for self-improvement.

## Key Files & Directories
- `shared/schema.ts`: **Source of truth** for database tables and Zod validation schemas.
- `server/storage.ts`: Database abstraction layer. Use the `storage` instance for all DB operations.
- `server/routes/`: Modular API route handlers (e.g., `drive.ts`, `gmail.ts`).
- `server/services/prompt-composer.ts`: Assembles system prompts from `prompts/*.md`.
- `client/src/pages/home.tsx`: Main chat interface.
- `client/src/components/ui/`: Shadcn UI components.
- `desktop-app/`: Electron-based desktop wrapper.
- `extension/`: Chrome extension for browser integration.

## Project Conventions
- **Database**: Always update `shared/schema.ts` first when changing data models. Use `npm run db:push` to apply changes.
- **API Validation**: Use Zod schemas from `shared/schema.ts` with `req.body` in Express routes.
- **Frontend State**: Use TanStack Query (`useQuery`, `useMutation`) for all server interactions.
- **Styling**: Use Tailwind CSS utility classes. Follow the design system in `client/src/index.css`.
- **Prompts**: Do not hardcode system prompts. Edit the markdown files in `prompts/` instead.
- **Error Handling**: Wrap API routes in try/catch and use the `errorHandler` middleware.

## Developer Workflows
- **Development**: Run `npm run dev` to start the full-stack environment.
- **Database Sync**: Run `npm run db:push` after modifying `shared/schema.ts`.
- **Build**: Run `npm run build` to generate the production bundle.

## Common Patterns
- **Streaming AI**: See `server/routes.ts` for SSE implementation using `res.setHeader("Content-Type", "text/event-stream")`.
- **Tool Use**: AI tools are defined in `server/services/prompt-composer.ts` and implemented in `server/integrations/`.
- **Live Preview**: Code execution happens in a sandboxed iframe; see `client/src/pages/preview.tsx`.
