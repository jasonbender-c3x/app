# Meowstik AI Coding Instructions

## Big Picture Architecture
Meowstik is a full-stack AI assistant platform with deep integrations.
- **Frontend**: React (Vite) + Tailwind CSS + Radix UI. Routing via `wouter`.
- **Backend**: Express.js server. Database is PostgreSQL managed by Drizzle ORM.
- **AI Core**: Google Gemini (`@google/genai`). Responses are streamed via Server-Sent Events (SSE).
- **Integrations**: Google Workspace (`googleapis`), GitHub (`@octokit/rest`), and Gemini Live.
- **Evolution System**: Feedback-driven self-improvement via GitHub PRs (`server/services/evolution-engine.ts`).

## Key Files & Directories
- `shared/schema.ts`: **Source of truth** for database tables and Zod validation schemas.
- `server/storage.ts`: Database abstraction layer using the **Repository Pattern**. Use the `storage` singleton.
- `server/routes/`: Modular API route handlers (e.g., `drive.ts`, `gmail.ts`, `evolution.ts`).
- `server/services/prompt-composer.ts`: Assembles system prompts from modular markdown files in `prompts/`.
- `client/src/pages/preview.tsx`: Sandboxed iframe logic for live code preview.
- `client/src/components/ui/`: Shadcn UI components.

## Project Conventions
- **Database First**: Always update `shared/schema.ts` first when changing data models. Use `npm run db:push` to apply.
- **API Validation**: Use Zod schemas from `shared/schema.ts` with `req.body` in Express routes.
- **Frontend State**: Use TanStack Query (`useQuery`, `useMutation`) for all server interactions.
- **AI Streaming**: Implement SSE using `res.setHeader("Content-Type", "text/event-stream")`.
- **Prompts**: Do not hardcode system prompts. Edit the markdown files in `prompts/` (e.g., `core-directives.md`).
- **Error Handling**: Wrap API routes in try/catch and use the `errorHandler` middleware.

## Developer Workflows
- **Development**: `npm run dev` starts the full-stack environment.
- **Database Sync**: `npm run db:push` after modifying `shared/schema.ts`.
- **Type Checking**: `npm run check` to run `tsc`.
- **Build**: `npm run build` generates the production bundle via `script/build.ts`.

## Common Patterns
- **Repository Pattern**: All DB access must go through `IStorage` interface in `server/storage.ts`.
- **Modular Routing**: Register new feature routers in `server/routes/index.ts`.
- **Zod Integration**:
  ```typescript
  const result = insertChatSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error });
  ```
- **SSE Implementation**:
  ```typescript
  res.setHeader("Content-Type", "text/event-stream");
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  ```
