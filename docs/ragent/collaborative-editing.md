# Collaborative Editing

> Real-time AI collaboration with voice, code, and browser control

---

## Overview

Collaborative Editing combines **live 2-way voice conversation** with either **code editing** (Monaco) or **browser automation** (Playwright/computer_use). The AI becomes an active participant rather than a turn-based responder.

---

## Two Modes of Operation

### Mode A: Code Collaboration

| Component | Description | Status |
|-----------|-------------|--------|
| [Live Voice](/live) | Gemini Live API with WebSocket streaming | ✅ Exists |
| [Monaco Editor](/workspace) | Syntax highlighting, IntelliSense | ✅ Exists |
| [Preview Pane](/workspace) | Live HTML/CSS/JS preview | ✅ Exists |
| Turn-Based Protocol | OT conflict resolution | 🔧 In Progress |
| Cursor Sharing | See AI's cursor position | 📋 Planned |

**Data Flow:**
```
User Voice ──► Gemini Live ──► AI Response
     │                              │
     ▼                              ▼
Monaco Editor ◄──── WebSocket ────► Server State
     │                              │
     ▼                              ▼
Live Preview ◄──── File Sync ─────► AI Edits
```

**Key Files:**
- [`server/websocket-collab.ts`](/docs/02-ui-architecture) — Turn state management
- [`client/src/hooks/use-collaborative-editing.ts`](/docs/02-ui-architecture) — Editor guards
- [`server/services/collab-integration.ts`](/docs/02-ui-architecture) — WebSocket wiring

---

### Mode B: Browser Collaboration

| Component | Description | Status |
|-----------|-------------|--------|
| [Live Voice](/live) | Gemini Live API | ✅ Exists |
| [Browser Page](/browser) | Browserbase + Playwright | ✅ Exists |
| [Collaborate Page](/collaborate) | TeamViewer-style hub | ✅ Exists |
| Desktop Relay | Cloud relay for frames | 📋 Planned |
| Desktop Agent | Local screen capture + input | 📋 Planned |

**Data Flow:**
```
User Voice ──► Gemini Live ──► AI Commands
     │                              │
     ▼                              ▼
Screen View ◄─── WebSocket ───► Playwright Actions
     │                              │
     ▼                              ▼
User Observes ◄── Frame Stream ──► AI Vision Analysis
```

**Key Files:**
- [`server/routes/browser.ts`](/docs/02-ui-architecture) — Screenshot + navigation
- [`packages/meowstik-agent/`](/docs/SYSTEM_OVERVIEW) — Desktop agent package
- [`packages/extension/`](/docs/SYSTEM_OVERVIEW) — Chrome extension

---

## Architecture Layers

### Layer 1: Voice Channel (Shared)

Both modes use [Gemini Live API](/live) for real-time conversation:

```typescript
// WebSocket connection to Gemini
const ws = new WebSocket(GEMINI_LIVE_ENDPOINT);
ws.send(JSON.stringify({ audio: base64AudioChunk }));
ws.onmessage = (e) => playAudioResponse(e.data);
```

See: [Verbosity Slider](./agent-configuration.md#verbosity-slider) for audio output modes.

---

### Layer 2: Editing Protocol (Code Mode)

**Operational Transform (OT)** for conflict resolution:

1. User edit → local apply → send operation to server
2. Server validates against current state
3. Server broadcasts transformed operation to all clients
4. AI receives, applies, responds with own operations

**Turn-Based Control:**

| State | User Can Edit | AI Can Edit |
|-------|---------------|-------------|
| `user_turn` | ✅ Yes | ❌ No |
| `ai_turn` | ❌ No | ✅ Yes |
| `paused` | ❌ No | ❌ No |

Guards in `use-collaborative-editing.ts`:
- `isEditingAllowed(turn, role)` — Check permission
- `getEditorOptions(turn)` — Set readOnly flag
- `updateEditorReadOnly(editor, turn)` — Runtime toggle

---

### Layer 3: Browser Protocol (Browser Mode)

**Playwright Actions via WebSocket:**

```typescript
// AI sends action
{ type: 'click', selector: '#submit-btn' }
{ type: 'type', selector: 'input[name=email]', text: 'user@example.com' }
{ type: 'navigate', url: 'https://example.com' }
{ type: 'screenshot' } // Returns base64 image for AI vision
```

**AI Vision Loop:**
1. Capture screenshot → send to Gemini Vision
2. AI analyzes UI → decides next action
3. Execute Playwright command → capture result
4. Repeat until task complete

---

## Integration Points

### With Job Orchestration

Complex collaborative tasks can spawn [background jobs](./job-orchestration.md):

```typescript
// User: "Refactor this entire file"
// AI creates job DAG:
{
  "tasks": [
    { "id": "analyze", "action": "analyze_code" },
    { "id": "plan", "depends": ["analyze"] },
    { "id": "refactor", "depends": ["plan"] },
    { "id": "test", "depends": ["refactor"] }
  ]
}
```

---

### With RAG Context

Collaborative sessions pull context from [RAG Pipeline](/docs/RAG_PIPELINE):

- Previous conversation chunks (semantic similarity)
- Codebase analysis (function signatures, imports)
- Domain knowledge (ingested documents)

---

## UI Pages

| Page | Route | Purpose |
|------|-------|---------|
| [Live Voice](/live) | `/live` | Voice-only conversation |
| [Workspace](/workspace) | `/workspace` | Monaco + chat + preview |
| [Browser](/browser) | `/browser` | Browserbase automation |
| [Collaborate](/collaborate) | `/collaborate` | Desktop collaboration hub |

---

## Implementation Status

| Feature | Status | Next Steps |
|---------|--------|------------|
| Gemini Live WebSocket | ✅ Complete | — |
| Monaco Editor Integration | ✅ Complete | — |
| Turn-Based Protocol | 🔧 In Progress | Wire to frontend |
| OT Conflict Resolution | 🔧 In Progress | Test edge cases |
| Cursor Sharing UI | 📋 Planned | Add cursor overlay |
| Desktop Agent | 📋 Planned | Build Electron wrapper |
| Chrome Extension | 🔧 Partial | Add collab features |

---

## Related Documentation

- [Agent Configuration](./agent-configuration.md) — Behavior & voice settings
- [Job Orchestration](./job-orchestration.md) — Background task processing
- [System Overview](/docs/SYSTEM_OVERVIEW) — Full architecture
- [UI Architecture](/docs/02-ui-architecture) — Frontend components
- [Ragent Index](./INDEX.md) — All agent documentation

---

## Quick Start

**Code Collaboration:**
1. Go to [/workspace](/workspace)
2. Open a file in Monaco editor
3. Start voice with the microphone button
4. Say "Let's edit this together"

**Browser Collaboration:**
1. Go to [/collaborate](/collaborate)
2. Connect to Browserbase or start Desktop Agent
3. Start voice conversation
4. Say "Navigate to [URL] and click [button]"
