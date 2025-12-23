# Log Parser: The Prompt Life Cycle Revisited

> **Ingesting the Past to Build the Present**
> Processing historical conversations the same way real-time prompts flow.

*Authored by Bender, Jason D and The Compiler*
*Revision: 2.0 - December 2025*

---

## Executive Summary

The Log Parser is an application that **ingests historical conversations** from various sources (Google Drive, Gmail, text files, JSON exports) and **processes them through the same lifecycle** that real-time prompts follow. The output is structured knowledge routed to domain-specific **Knowledge Buckets**, enabling the AI system to build persistent memory from past interactions.

**Core Insight**: "Self-awareness is achieved by saving the state of the stateless."

By processing historical conversations, we retroactively give the AI system memory of interactions it never experienced in real-time.

---

## Part 1: The Original Prompt Life Cycle

The traditional RAG (Retrieval-Augmented Generation) prompt lifecycle follows this sequence:

```
User Query → API Gateway → State Management → Vectorization → 
Retrieval → Post-Retrieval Optimization → Context Augmentation → Generation → Response
```

### Stage-by-Stage Breakdown

| Stage | Function | Technology |
|-------|----------|------------|
| 1. Query Reception | User submits natural language query | API Gateway (Cloud Run) |
| 2. State Management | Retrieve conversation history, manage context window | Firestore/PostgreSQL |
| 3. Vectorization | Convert query to high-dimensional vector | Vertex AI Embeddings |
| 4. Retrieval | Search vector index for relevant context | Vector Search |
| 5. Post-Retrieval | Deduplicate, re-rank, filter results | Orchestrator logic |
| 6. Context Augmentation | Assemble final prompt with context + history | Prompt assembly |
| 7. Generation | Submit to LLM, generate response | Gemini/GPT |
| 8. Response | Return to user, persist state | API response + storage |

---

## Part 2: The Revised Life Cycle (Log Parser Model)

The Log Parser **inverts the flow**: instead of processing a single real-time query, it processes **historical conversation logs** in batch, extracting knowledge and routing it to persistent storage.

### New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LOG PARSER PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                          │
│  │   SOURCES    │                                                          │
│  │              │                                                          │
│  │ • Gmail      │                                                          │
│  │ • Drive Docs │                                                          │
│  │ • JSON logs  │                                                          │
│  │ • Text files │                                                          │
│  │ • Voice msgs │                                                          │
│  └──────┬───────┘                                                          │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │   INGEST     │───▶│   PARSE      │───▶│   CLASSIFY   │                 │
│  │              │    │              │    │              │                 │
│  │ Download     │    │ Extract      │    │ Domain       │                 │
│  │ Normalize    │    │ Structure    │    │ Detection    │                 │
│  │ Deduplicate  │    │ Timestamp    │    │ Entity NER   │                 │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                 │
│                                                  │                         │
│                                                  ▼                         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                     COGNITIVE CASCADE                                 │ │
│  │                                                                       │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │ │
│  │  │ STRATEGIST  │───▶│  ANALYST    │───▶│ TECHNICIAN  │              │ │
│  │  │             │    │             │    │             │              │ │
│  │  │ What domain?│    │ Extract     │    │ Store in    │              │ │
│  │  │ What intent?│    │ entities,   │    │ correct     │              │ │
│  │  │ What action?│    │ facts,      │    │ bucket,     │              │ │
│  │  │             │    │ relationships│    │ update index│              │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                  │                         │
│                                                  ▼                         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                     KNOWLEDGE BUCKETS                                 │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │ │
│  │  │ PERSONAL    │  │  CREATOR    │  │  PROJECTS   │                  │ │
│  │  │ LIFE        │  │             │  │             │                  │ │
│  │  │             │  │ Designer    │  │ Project A   │                  │ │
│  │  │ Health      │  │ Coder       │  │ Project B   │                  │ │
│  │  │ Finance     │  │ Scientist   │  │ Project C   │                  │ │
│  │  │ Relations   │  │             │  │             │                  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: The Seven Stages of Log Processing

### Stage 1: Source Discovery
**Function**: Find all conversation sources

```typescript
interface ConversationSource {
  type: 'gmail' | 'drive' | 'json' | 'text' | 'voice';
  id: string;
  metadata: {
    participants: string[];
    dateRange: { start: Date; end: Date };
    messageCount: number;
  };
}
```

**Sources Supported**:
- Gmail threads (Google Voice texts, emails)
- Google Docs (conversation logs, transcripts)
- JSON exports (AI Studio prompts, chat histories)
- Text files (raw logs, transcripts)
- Voice messages (transcribed)

### Stage 2: Ingestion
**Function**: Download and normalize content

```typescript
interface IngestedMessage {
  id: string;
  source: string;
  timestamp: Date;
  sender: string;
  recipient: string;
  content: string;
  raw: string;  // Original format preserved
}
```

**Operations**:
- Download from source APIs (Gmail, Drive)
- Normalize formats (HTML → text, JSON → structured)
- Deduplicate (same message from multiple sources)
- Validate timestamps and ordering

### Stage 3: Parsing
**Function**: Extract structure from raw content

```typescript
interface ParsedConversation {
  id: string;
  participants: Participant[];
  messages: ParsedMessage[];
  timeline: TimelineEvent[];
  entities: Entity[];
}

interface ParsedMessage {
  id: string;
  role: 'user' | 'ai' | 'system' | 'other';
  speaker: string;
  content: string;
  timestamp: Date;
  replyTo?: string;
  attachments?: Attachment[];
}
```

**Operations**:
- Identify conversation turns
- Assign roles (user vs AI vs other)
- Extract timestamps
- Link replies to originals
- Handle multi-party conversations

### Stage 4: Classification (Strategist Tier)
**Function**: Determine domain and intent

```typescript
interface ClassifiedConversation {
  conversation: ParsedConversation;
  domain: 'personal' | 'creator' | 'project';
  subdomain?: string;  // e.g., 'health', 'code', 'project-nebula'
  topics: string[];
  entities: NamedEntity[];
  sentiment: 'positive' | 'negative' | 'neutral';
  actionItems: ActionItem[];
}
```

**The Strategist asks**:
- What domain does this belong to? (Personal Life / Creator / Project)
- What is the primary topic?
- Who are the participants and what are their relationships?
- Are there action items or decisions?

### Stage 5: Analysis (Analyst Tier)
**Function**: Extract knowledge and relationships

```typescript
interface AnalyzedKnowledge {
  facts: Fact[];
  relationships: Relationship[];
  preferences: Preference[];
  patterns: Pattern[];
  decisions: Decision[];
}

interface Fact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
  timestamp: Date;
}

interface Relationship {
  entity1: string;
  entity2: string;
  type: string;  // e.g., 'friend', 'colleague', 'family'
  evidence: string[];
}
```

**The Analyst extracts**:
- Facts and assertions
- Entity relationships
- User preferences
- Behavioral patterns
- Decisions and their rationale

### Stage 6: Storage (Technician Tier)
**Function**: Persist to appropriate bucket

```typescript
interface StorageOperation {
  bucket: string;
  section: string;
  operation: 'append' | 'update' | 'merge';
  content: string;
  metadata: {
    sourceId: string;
    timestamp: Date;
    confidence: number;
  };
}
```

**The Technician**:
- Routes to correct bucket file
- Appends new knowledge
- Updates existing entries if newer
- Maintains indexes for retrieval
- Creates cross-references between buckets

### Stage 7: Indexing
**Function**: Enable future retrieval

```typescript
interface KnowledgeIndex {
  entities: Map<string, string[]>;  // entity → bucket locations
  topics: Map<string, string[]>;    // topic → bucket locations
  timeline: TimelineIndex;          // date → events
  relationships: Graph;             // entity relationship graph
}
```

---

## Part 4: Processing Modes

### Batch Mode (Historical Ingestion)
Process large volumes of historical conversations:

```
1. Scan all sources for conversations
2. Filter by date range, participants, or keywords
3. Queue for processing
4. Process in parallel (multiple conversations)
5. Aggregate results to buckets
6. Generate summary report
```

### Real-Time Mode (Live Integration)
Process new conversations as they arrive:

```
1. Webhook receives new message notification
2. Fetch full conversation context
3. Process single conversation
4. Update relevant bucket
5. Trigger any action items
```

### Hybrid Mode (Continuous Sync)
Keep buckets synchronized with sources:

```
1. Track last-synced timestamp per source
2. Periodically check for new content
3. Process only delta (new messages)
4. Merge with existing knowledge
```

---

## Part 5: Implementation Plan

### Phase 1: Core Pipeline
- [ ] Create ingestion routes for Gmail and Drive
- [ ] Build message parser for common formats
- [ ] Implement basic classification (regex + rules)
- [ ] Route to bucket files

### Phase 2: AI-Enhanced Processing
- [ ] Integrate Gemini for classification
- [ ] Add entity extraction (NER)
- [ ] Implement relationship detection
- [ ] Build fact extraction pipeline

### Phase 3: Advanced Features
- [ ] Vector embedding for semantic search
- [ ] Cross-reference linking between buckets
- [ ] Pattern detection over time
- [ ] Action item extraction and tracking

### Phase 4: Real-Time Integration
- [ ] Gmail webhook for new messages
- [ ] Drive change notifications
- [ ] Live bucket updates
- [ ] Notification system for important items

---

## Part 6: Data Model

### Database Schema

```sql
-- Ingested conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  participants TEXT[],
  message_count INTEGER,
  date_start TIMESTAMP,
  date_end TIMESTAMP,
  processed_at TIMESTAMP,
  status TEXT DEFAULT 'pending'
);

-- Individual messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations,
  sender TEXT,
  content TEXT,
  timestamp TIMESTAMP,
  role TEXT,
  metadata JSONB
);

-- Extracted knowledge
CREATE TABLE knowledge (
  id UUID PRIMARY KEY,
  bucket TEXT NOT NULL,
  section TEXT,
  content TEXT,
  source_conversation UUID REFERENCES conversations,
  source_message UUID REFERENCES messages,
  confidence FLOAT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Entity index
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,  -- person, place, organization, etc.
  mentions JSONB,  -- array of {conversation_id, message_id, context}
  relationships JSONB
);
```

---

## Part 7: The Self-Evolving System

### Incremental Improvement
The Log Parser itself follows the self-evolution principle:

1. **Initial bucket structure** is defined by the operator
2. **As conversations are processed**, patterns emerge
3. **The system proposes** new buckets or sections
4. **Operator approves** or rejects changes
5. **Structure evolves** to match reality

### Feedback Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   PROCESS ──▶ ANALYZE ──▶ PROPOSE ──▶ APPROVE ──▶ EVOLVE       │
│      │                                               │          │
│      └───────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

The system learns:
- Which topics appear frequently
- How to better classify conversations
- What entities are important
- How relationships develop over time

---

## Appendix: Original Prompt Life Cycle Reference

The original document described the RAG retrieval flow:

1. **User Query Reception** - API gateway receives query
2. **State and History Management** - Retrieve conversation context
3. **Query Vectorization** - Embed query for semantic search
4. **Retrieval** - Vector search for relevant documents
5. **Post-Retrieval Optimization** - Deduplicate, re-rank
6. **Context Augmentation** - Assemble final prompt
7. **Generation** - Submit to LLM
8. **Response** - Return and persist

The Log Parser extends this by:
- Processing **historical** conversations, not just real-time
- **Classifying** into domains (Personal/Creator/Projects)
- **Extracting** structured knowledge
- **Routing** to persistent bucket storage
- **Indexing** for future retrieval
- **Evolving** the structure over time

---

*This document is part of the Nebula AI knowledge system.*
*Version 2.0 - Revised December 2025*
