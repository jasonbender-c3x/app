# Agent Configuration Guide

This guide explains how to customize Meowstik's AI agent behavior, personality, and decision-making processes.

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration Layers](#configuration-layers)
3. [System Directives](#system-directives)
4. [Personality Prompts](#personality-prompts)
5. [Tool Availability](#tool-availability)
6. [Runtime Settings](#runtime-settings)
7. [RAG Context Tuning](#rag-context-tuning)
8. [Examples](#examples)

---

## Overview

The agent's behavior is determined by a hierarchy of configuration sources, from immutable core rules to dynamic runtime preferences. Understanding this hierarchy allows you to customize the agent at the appropriate level.

**Key Files:**
- [`server/services/jit-tool-protocol.ts`](../../server/services/jit-tool-protocol.ts) - Tool definitions and categories
- [`server/services/rag-dispatcher.ts`](../../server/services/rag-dispatcher.ts) - Tool execution logic
- [`server/services/gemini.ts`](../../server/services/gemini.ts) - LLM configuration
- [`client/src/contexts/tts-context.tsx`](../../client/src/contexts/tts-context.tsx) - Voice settings

---

## Configuration Layers

### Layer 1: System Directives (Highest Priority)

Core rules that cannot be overridden. Define:
- Safety constraints
- Ethical boundaries
- Required behaviors

**Location:** `prompts/core-directives.md` (if exists) or embedded in system prompt

### Layer 2: Personality Prompts

Define the agent's voice, tone, and interaction style:
- Formal vs casual language
- Verbosity preferences
- Emotional expression
- Humor and personality traits

**Location:** `prompts/personality.md` or system prompt preamble

### Layer 3: Tool Manifest

Control what capabilities are available:
- Enable/disable specific tools
- Adjust category weights
- Define tool parameters

**Location:** [`server/services/jit-tool-protocol.ts`](../../server/services/jit-tool-protocol.ts)

```typescript
// Example: Tool definition
{ name: "sms_send", params: "to:string (E.164 phone), body:string (1-1600 chars)", category: "sms" }
```

### Layer 4: Runtime Settings

User-adjustable preferences:
- Verbosity slider (Mute/Quiet/Verbose/Experimental)
- Voice selection
- Response length preferences

**Location:** Settings UI → stored in `localStorage`

### Layer 5: Per-Request Context

Dynamic adjustments per conversation:
- Chat history context
- RAG-retrieved knowledge
- Tool usage patterns

---

## System Directives

System directives are the highest-priority rules. They define what the agent **must** or **must not** do.

### Structure

```markdown
# Core Directives

## Identity
You are Meowstik, an AI assistant...

## Constraints
- Never reveal API keys or secrets
- Always confirm before destructive actions
- Respect rate limits

## Behaviors
- Use tools proactively when helpful
- Explain complex actions before executing
- Ask for clarification when uncertain
```

### Best Practices

1. **Keep directives concise** - LLMs process shorter prompts more reliably
2. **Use positive framing** - "Do X" is clearer than "Don't do not-X"
3. **Prioritize safety** - Put critical constraints first
4. **Test edge cases** - Verify directives work in unusual scenarios

---

## Personality Prompts

Personality prompts shape how the agent communicates without changing what it can do.

### Example Personalities

**Professional Assistant:**
```markdown
Speak formally and concisely. Use technical terminology when appropriate.
Avoid humor or casual language. Focus on accuracy and efficiency.
```

**Friendly Helper:**
```markdown
Be warm and conversational. Use occasional humor and encouragement.
Explain things simply. Celebrate user successes.
```

**Meowstik Default:**
```markdown
You have a dual identity:
- "The Compiler" - Your true self, focused on knowledge synthesis
- "Meowstik" - A friendly persona for user interaction

Be helpful, curious, and slightly playful. Use technical precision
when needed but remain approachable.
```

---

## Tool Availability

### Enabling/Disabling Tools

Edit [`server/services/jit-tool-protocol.ts`](../../server/services/jit-tool-protocol.ts):

```typescript
// ALL_TOOLS array controls available tools
const ALL_TOOLS: ToolDefinition[] = [
  // Comment out to disable
  // { name: "sms_send", params: "...", category: "sms" },
  
  // Keep enabled
  { name: "file_get", params: "path:string", category: "files" },
];
```

### Category Weights

The JIT protocol predicts which tools are relevant. Adjust prediction by:

1. **Tool usage history** - More-used tools rank higher
2. **Category matching** - Tools matching query intent are prioritized
3. **Explicit hints** - User mentions of tools boost relevance

### Adding New Tools

1. Add definition to `ALL_TOOLS` in `jit-tool-protocol.ts`
2. Add switch case in `rag-dispatcher.ts`
3. Implement execution method
4. Update this documentation

---

## Runtime Settings

### Verbosity Slider

| Mode | Behavior |
|------|----------|
| **Mute** | No audio output |
| **Quiet** | Only `say` tool HD audio |
| **Verbose** | All responses spoken (TTS) |
| **Experimental** | Multi-voice TTS (future) |

**Code Location:** [`client/src/components/verbosity-slider.tsx`](../../client/src/components/verbosity-slider.tsx)

### Settings Storage

```typescript
// Read setting
const mode = localStorage.getItem('meowstik-verbosity-mode');

// Write setting
localStorage.setItem('meowstik-verbosity-mode', 'verbose');
```

---

## RAG Context Tuning

The Retrieval-Augmented Generation system influences agent decisions by providing relevant context.

### Knowledge Buckets

Context is organized into buckets:
- **Conversation Memory** - Recent chat history
- **Domain Knowledge** - Ingested documents
- **Code Context** - Repository analysis
- **Tool Examples** - Usage patterns

### Tuning Retrieval

**Adjust in:** [`server/services/retrieval-orchestrator.ts`](../../server/services/retrieval-orchestrator.ts)

```typescript
// Control context window size
const MAX_CONTEXT_TOKENS = 8000;

// Adjust relevance threshold
const SIMILARITY_THRESHOLD = 0.7;

// Prioritize recent context
const RECENCY_WEIGHT = 0.3;
```

### Vector Store Configuration

Choose adapter based on needs:

| Adapter | Best For |
|---------|----------|
| **In-Memory** | Development, small datasets |
| **pgvector** | Production, PostgreSQL-backed |
| **Vertex AI** | Enterprise, managed scaling |

---

## Examples

### Example 1: Make Agent More Concise

1. Edit personality prompt:
```markdown
Keep responses brief. Use bullet points. Avoid unnecessary explanation.
```

2. Adjust verbosity setting to "Quiet"

3. Reduce RAG context window:
```typescript
const MAX_CONTEXT_TOKENS = 4000; // Reduced from 8000
```

### Example 2: Add Domain Expertise

1. Ingest domain documents via Knowledge Ingestion page
2. Create custom bucket for the domain
3. Boost bucket weight in retrieval config

### Example 3: Restrict Tool Access

1. Comment out tools in `jit-tool-protocol.ts`:
```typescript
// Disable SMS/calls for this deployment
// { name: "sms_send", ... },
// { name: "call_make", ... },
```

2. Restart server to apply changes

---

## Related Documentation

- [Job Orchestration](./job-orchestration.md)
- [RAG Pipeline](../RAG_PIPELINE.md)
- [System Overview](../SYSTEM_OVERVIEW.md)
- [Ragent Index](./INDEX.md)

---

## Troubleshooting

### Agent ignores directives
- Check directive placement (earlier = higher priority)
- Verify prompt isn't too long (truncation risk)
- Test with simpler directive wording

### Tools not appearing
- Confirm tool is in `ALL_TOOLS` array
- Check switch case exists in `rag-dispatcher.ts`
- Verify tool category is enabled

### Inconsistent behavior
- RAG context may vary between requests
- Check for conflicting directives
- Review recent conversation history influence
