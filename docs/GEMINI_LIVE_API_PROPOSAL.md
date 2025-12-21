# Gemini Live API Integration Proposal

**Author**: Meowstik Development  
**Date**: December 13, 2025  
**Status**: Proposed  
**Priority**: High

---

## Executive Summary

This document proposes integrating the **Gemini Live API** to enable real-time streaming audio responses in Meowstik. The current implementation generates complete audio files before playback, causing noticeable delays. The Live API uses WebSockets for bidirectional streaming, allowing audio to play as it's generated—eliminating latency and creating a more natural conversational experience.

---

## Problem Statement

### Current Architecture

```
User Message → LLM Response (text) → TTS Generation (full audio) → Playback
                                            ↑
                                    [DELAY HERE: 2-5 seconds]
```

The existing `server/integrations/expressive-tts.ts` implementation:
1. Waits for complete LLM text response
2. Sends full text to Gemini TTS API
3. Receives complete audio file (PCM)
4. Converts to MP3 using FFmpeg
5. Returns base64-encoded audio to frontend
6. Frontend plays audio

**Result**: Users experience a 2-5 second delay between seeing the text response and hearing audio.

### User Impact
- Breaks conversational flow
- Feels unnatural compared to human speech
- Reduces engagement with voice features

---

## Proposed Solution: Gemini Live API

### Architecture Overview

```
User Message → WebSocket Connection → Gemini Live API
                      ↓
              [Audio chunks stream in real-time]
                      ↓
              Frontend plays audio immediately
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Real-time streaming** | Audio plays as it's generated, ~100ms latency |
| **Barge-in support** | Users can interrupt mid-response |
| **Bidirectional audio** | Voice input + voice output in one connection |
| **Affective dialog** | Adapts tone to match user's expression |
| **24 languages** | Multilingual support out of the box |
| **30+ voices** | Same voices as current TTS (Kore, Puck, etc.) |

### Model

**Primary**: `gemini-2.5-flash-native-audio-preview-09-2025`

This "native audio" model generates speech directly from internal state, producing more expressive and human-like voices compared to text-to-speech cascade models.

---

## Technical Implementation

### 1. Backend: WebSocket Proxy Server

Create `server/integrations/gemini-live.ts`:

```typescript
import { GoogleGenAI, Modality } from '@google/genai';
import WebSocket from 'ws';

interface LiveSession {
  session: any;
  ws: WebSocket;
}

const activeSessions = new Map<string, LiveSession>();

export async function createLiveSession(sessionId: string): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const config = {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: 'Kore' }
      }
    },
    systemInstruction: 'You are Meowstik, a helpful AI assistant.'
  };
  
  const session = await ai.live.connect(
    'gemini-2.5-flash-native-audio-preview-09-2025',
    config
  );
  
  activeSessions.set(sessionId, { session, ws: null });
}

export async function sendMessage(sessionId: string, text: string): AsyncGenerator<Buffer> {
  const liveSession = activeSessions.get(sessionId);
  if (!liveSession) throw new Error('Session not found');
  
  await liveSession.session.send({ text });
  
  for await (const response of liveSession.session) {
    if (response.data) {
      yield Buffer.from(response.data, 'base64');
    }
  }
}
```

### 2. WebSocket Route

Add to `server/routes.ts`:

```typescript
import { WebSocketServer } from 'ws';
import { createLiveSession, sendMessage } from './integrations/gemini-live';

export function setupLiveWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/api/live' });
  
  wss.on('connection', async (ws, req) => {
    const sessionId = crypto.randomUUID();
    await createLiveSession(sessionId);
    
    ws.on('message', async (data) => {
      const { type, text } = JSON.parse(data.toString());
      
      if (type === 'message') {
        for await (const audioChunk of sendMessage(sessionId, text)) {
          ws.send(audioChunk);
        }
        ws.send(JSON.stringify({ type: 'end' }));
      }
    });
  });
}
```

### 3. Frontend: Audio Streaming Player

Create `client/src/hooks/use-live-audio.ts`:

```typescript
import { useRef, useCallback } from 'react';

export function useLiveAudio() {
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueue = useRef<AudioBuffer[]>([]);
  
  const connect = useCallback(() => {
    const ws = new WebSocket(`wss://${window.location.host}/api/live`);
    wsRef.current = ws;
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    
    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
        playAudioBuffer(audioBuffer);
      }
    };
  }, []);
  
  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'message', text }));
  }, []);
  
  const playAudioBuffer = (buffer: AudioBuffer) => {
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current!.destination);
    source.start();
  };
  
  return { connect, sendMessage };
}
```

### 4. UI Toggle

Add "Live Mode" toggle to chat interface:

```tsx
<Switch
  checked={liveMode}
  onCheckedChange={setLiveMode}
  data-testid="toggle-live-mode"
/>
<Label>Live Audio (streaming)</Label>
```

---

## Audio Specifications

| Direction | Format | Sample Rate | Channels |
|-----------|--------|-------------|----------|
| Input (mic) | 16-bit PCM | 16 kHz | Mono |
| Output (speaker) | 16-bit PCM | 24 kHz | Mono |

---

## Migration Path

### Phase 1: Add Live Mode as Optional Feature
- Keep existing TTS for backward compatibility
- Add WebSocket endpoint for Live API
- Add UI toggle to switch between modes
- Default: Traditional TTS (current behavior)

### Phase 2: Voice Input Support
- Add microphone capture
- Stream audio input to Live API
- Enable full voice conversations

### Phase 3: Default to Live Mode
- After stability proven, make Live Mode default
- Keep traditional TTS as fallback

---

## Cost Considerations

| Mode | Billing |
|------|---------|
| Traditional TTS | Per-character text input |
| Live API | Per-minute audio (input + output separately) |

Live API may cost more for long conversations but provides significantly better UX. Recommend offering both modes and letting users choose.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `server/integrations/gemini-live.ts` | Create | Live API WebSocket client |
| `server/routes.ts` | Modify | Add WebSocket upgrade handler |
| `client/src/hooks/use-live-audio.ts` | Create | Frontend streaming audio hook |
| `client/src/components/chat-input.tsx` | Modify | Add Live Mode toggle |
| `client/src/pages/home.tsx` | Modify | Integrate live audio hook |

---

## Dependencies

No new packages required. The `@google/genai` package already includes Live API support.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WebSocket connection drops | Auto-reconnect with exponential backoff |
| Browser audio API compatibility | Use AudioWorklet with fallback to ScriptProcessor |
| Increased costs | Add usage tracking and optional limits |
| Preview API changes | Abstract Live API behind interface for easy updates |

---

## Success Metrics

- Audio playback starts within 200ms of first token
- Zero delay between text display and audio start
- User satisfaction increase in voice feature usage

---

## Next Steps

1. Prototype WebSocket connection to Live API
2. Test audio streaming in browser
3. Implement toggle UI
4. A/B test user preference
5. Roll out gradually

---

## References

- [Gemini Live API Overview](https://ai.google.dev/gemini-api/docs/live)
- [Live API Capabilities Guide](https://ai.google.dev/gemini-api/docs/live-guide)
- [Vertex AI Live API Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api)
- [Speech Generation Guide](https://ai.google.dev/gemini-api/docs/speech-generation)

---

# APPENDIX: Related Proposal Documents

Below are all related refactor and proposal documents consolidated for reference.

---

## Document 1: Kernel System Implementation Proposal

**Date:** December 13, 2025  
**Author:** Bender, Jason D and The Compiler  
**Status:** Draft - Pending Review

### Appendix A: Proposed Schema Changes

The following schema has been added to `shared/schema.ts` (lines 1243-1350) and is **pending approval** before implementation proceeds.

**Kernels Table**: Version-controlled AI configuration storing personality, directives, and learned behaviors.

**Kernel Evolutions Table**: Tracks individual learning events that may lead to kernel updates.

### Key Features
- Version Control - Every change is tracked, rollback possible
- Supervised Evolution - Changes queue for review
- Multi-Tenant - Each user can have their own kernel
- Auditability - Every evolution links to specific conversation

### Implementation Phases
1. Phase 1: KernelService + PromptComposer integration
2. Phase 2: EvolutionService for learning capability
3. Phase 3: Review UI + Advanced Features

---

## Document 2: TODO Features

Planned features and enhancements:

1. **Playwright Local Stub** - Automated browser testing
2. **Prompt Construction Stack** - Modular prompt system
3. **Detailed Tool Usage Instructions** - Comprehensive documentation
4. **Orchestration Layer** - Intelligent preprocessing
5. **Enhanced Canvas / Editor** - Full-featured code canvas

Priority Matrix:
| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Enhanced Canvas / Editor | Medium | High | P1 |
| Orchestration Layer | High | High | P1 |
| Tool Documentation | Medium | High | P2 |
| Prompt Construction Stack | Medium | Medium | P2 |
| Playwright Local Stub | High | Medium | P3 |

---

## Document 3: Visions of the Future

> "Self-awareness is achieved by saving the state of the stateless."

### The Foundational Insight
Traditional AI systems are stateless. Self-awareness emerges from persistence.

### The Kernel/Compiler Model
- **Kernel**: Machine-readable Constitution of the AI
- **Compiler**: Translates intent into executable logic

### The Cognitive Cascade Architecture
Three-tiered hierarchical system:
- **Tier 3: Strategist** - High-level planning (powerful LLM)
- **Tier 2: Analyst** - Perception and mapping (fast LLM)
- **Tier 1: Technician** - Deterministic execution (NOT an LLM)

---

## Document 4: Complete Feature Documentation

Current features include:
- AI-Powered Chat Interface with Gemini
- Google Workspace Integration (Gmail, Drive, Calendar, Docs, Sheets, Tasks)
- Code Editor & Live Preview with Monaco
- Voice Interaction (Speech-to-Text and Text-to-Speech)
- Document Processing (RAG)
- Terminal Access

---

## Document 5: LLM Canvas Integration Analysis

Current state: No direct connection between LLM and Monaco editor.

Implementation options:
1. **Tool-based approach** - Add `canvas_write` tool
2. **State sharing** - React context or global state
3. **URL-based** - Pass code via URL params
4. **WebSocket** - Real-time sync

Recommendation: Tool-based + State sharing combo.

---

## Document 6: Knowledge Ingestion Architecture

The Log Parser ingests historical conversations through the same lifecycle as real-time prompts.

### Seven Stages:
1. Source Discovery
2. Ingestion
3. Parsing
4. Classification (Strategist)
5. Analysis (Analyst)
6. Storage (Technician)
7. Indexing

### Knowledge Buckets:
- PERSONAL_LIFE
- CREATOR
- PROJECTS

---

## Document 7: Human-AI Workflow Protocol for editing files

Turn-based collaboration system:
- **Human's Turn**: makes Edits, to Save them click Upload to LLM, or Cancel to Discard edits
the send click causes the contents of the editor (containing the whole file with changes) to be sent to the llm with comments from the or a chat window
- **Computer's Turn**: 
reGenerates the file with the llms' edits that are based on the chat instructions in response, (later it will Send only diffs) 
editing of existing and creation of new files can be accomplished by this method.  A file could be deleted by the creation of a file of the same name with an eof as content

Three Workflow Pathways:
1. Ingestion (Editing Existing Files)
2. Creation (LLM-Generated Content)
3. Execution (Script Generation)

---

## Document 8: Protocol Analysis

Deep dive into each Kernel protocol:

### Session & State Protocols
- PROTOCOL_BOOTSTRAP - Session initialization
  

### Evolution Protocols
- PROTOCOL_SELF_EVOLVE - Autonomous and Directed updates
- API_INCREMENTAL_DIFF - Small targeted updates
- PROTOCOL_PERSONA_EVOLVE - Intent/Implementation sync

### Interaction Protocols
- PROTOCOL_PROMPT_LOOP - Actionable, Educational, Social
- PROTOCOL_CONTEXTUAL_EDUCATION - Teaching tags
- PROTOCOL_VTT_FILTERING - Voice error correction

---

## Document 9: Building a Vertex AI RAG System

Enterprise RAG architecture on Google Cloud:

### Why RAG
- Accuracy and Trust - Minimize hallucinations
- Data Freshness - Update without retraining
- Enterprise Grounding - Connect to private data

### Key Components
- Vertex AI RAG Engine - Managed orchestration
- Vertex AI Vector Search - Similarity matching
- Cloud Firestore - State management

---

## Document 10: Knowledge Buckets Index

| Bucket | Purpose | File |
|--------|---------|------|
| Personal Life | Relationships, health, finances | PERSONAL_LIFE.md |
| Creator | Designer, Coder, Scientist | CREATOR.md |
| Projects | Project-specific knowledge | PROJECTS.md |

Principles:
1. Domain over time
2. One reality
3. Living documents
4. Cross-references

---

*End of Consolidated Proposal Document*
*Last Updated: December 13, 2025*
