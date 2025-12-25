# Exhibit: LLM to Canvas Integration Analysis

This document captures the analysis of how to connect the LLM chat to the Monaco editor canvas.

---

## Current State Analysis

Based on codebase search, **there's currently no direct connection** between the LLM and the Monaco editor. They're separate features right now:

**Current Setup:**
- The editor loads/saves code from **localStorage** only
- The LLM chat operates independently
- No mechanism exists for the AI to push code to the editor

**How it could work (if implemented):**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User asks:    │     │   LLM generates │     │  Editor updates │
│ "Write HTML for │ ──▶ │   code in       │ ──▶ │  with new code  │
│  a landing page"│     │   response      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Implementation options:**

1. **Tool-based approach**: Add a `canvas_write` tool the LLM can call
   ```json
   {
     "tool": "canvas_write",
     "params": { "code": "<html>...</html>", "language": "html" }
   }
   ```

2. **State sharing**: Use React context or global state to share editor content between chat and editor pages

3. **URL-based**: Pass code via URL params or a shared ID

4. **WebSocket**: Real-time sync between chat responses and editor

---

## Approaches: LLM → Canvas Integration - Pros & Cons

### 1. Tool-Based Approach (`canvas_write` tool)

| Pros | Cons |
|------|------|
| Fits existing tool architecture | Requires adding new tool to prompt |
| LLM has explicit control over when to write | Only works for intentional code outputs |
| Can include language detection | One-way only (LLM → editor) |
| Easy to log and debug | User must switch to editor page to see result |
| Can validate code before writing | |

**Best for:** Structured code generation tasks

---

### 2. State Sharing (React Context / Global State)

| Pros | Cons |
|------|------|
| Real-time sync between pages | More complex state management |
| Two-way communication possible | Can cause unexpected updates |
| Works across all components | Harder to debug state changes |
| Natural React pattern | Requires refactoring existing code |
| Can show editor inline in chat | Memory overhead for large code |

**Best for:** Tight integration, inline code previews

---

### 3. URL-Based (Query Params / Shared ID)

| Pros | Cons |
|------|------|
| Simple to implement | Limited by URL length (~2000 chars) |
| Works with page navigation | Not real-time |
| Stateless, easy to share | Requires encoding/decoding |
| Can bookmark code states | Clunky for large code blocks |
| No complex state needed | Only works on navigation |

**Best for:** Small snippets, shareable links

---

### 4. WebSocket (Real-time Sync)

| Pros | Cons |
|------|------|
| True real-time updates | Most complex to implement |
| Bi-directional communication | Requires WebSocket server setup |
| Can stream code as LLM generates | Connection management overhead |
| Works across browser tabs | More infrastructure to maintain |
| Best user experience | Overkill for simple use cases |

**Best for:** Collaborative editing, live coding demos

---

## Recommendation

| Use Case | Best Approach |
|----------|---------------|
| **Simple "generate code" requests** | Tool-based |
| **Show code preview in chat** | State sharing |
| **Share code snippets via link** | URL-based |
| **Live coding assistant** | WebSocket |

For Meowstik, the recommended approach is **Tool-based + State sharing combo**:
- Tool gives LLM explicit control
- State sharing lets you show inline preview in chat
- No WebSocket complexity needed

---

*Document created: December 8, 2025*
