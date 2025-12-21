# RAG Pipeline: Document & Chat Ingestion, Chunking, Vectorization, Storage, and Retrieval

> **Technical Reference for the Meowstik Knowledge System**
> Revision: 1.0 - December 2025

---

## Overview

This document explains how Meowstik processes documents and chat messages through its Retrieval-Augmented Generation (RAG) pipeline. The system ingests content, breaks it into chunks, converts those chunks to vectors, stores them in the database, and retrieves relevant knowledge to augment AI prompts.

---

## The Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RAG PIPELINE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐          │
│  │  INGEST   │───▶│   CHUNK   │───▶│ VECTORIZE │───▶│   STORE   │          │
│  │           │    │           │    │           │    │           │          │
│  │ Documents │    │ Split     │    │ Embed via │    │ PostgreSQL│          │
│  │ Messages  │    │ Content   │    │ Gemini    │    │ + Vectors │          │
│  │ Emails    │    │           │    │           │    │           │          │
│  └───────────┘    └───────────┘    └───────────┘    └───────────┘          │
│                                                                              │
│         ┌────────────────────────────────────────────────────┐              │
│         │                    RETRIEVAL                        │              │
│         │                                                     │              │
│         │  ┌───────────┐    ┌───────────┐    ┌───────────┐  │              │
│         │  │   QUERY   │───▶│  SEARCH   │───▶│  AUGMENT  │  │              │
│         │  │           │    │           │    │           │  │              │
│         │  │ User msg  │    │ Semantic  │    │ Inject to │  │              │
│         │  │ embedding │    │ + Keyword │    │ prompt    │  │              │
│         │  └───────────┘    └───────────┘    └───────────┘  │              │
│         └────────────────────────────────────────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Ingestion

**Purpose**: Accept content from various sources and prepare it for processing.

**Supported Sources**:
- Uploaded documents (PDF, TXT, JSON, Markdown)
- Chat messages from conversation history
- Google Drive files
- Gmail emails
- Voice transcriptions

**Code Location**: `server/services/rag-service.ts`

```typescript
async ingestDocument(
  content: string,
  attachmentId: string,
  filename: string,
  mimeType?: string,
  options?: ChunkingOptions
): Promise<IngestResult>
```

**Key Operations**:
1. Receive raw content
2. Extract text based on MIME type
3. Generate unique document ID
4. Pass to chunking service

**Text Extraction**:
- Plain text: Direct passthrough
- PDF: Extracted via `pdf-parse` library
- JSON: Pretty-printed for readability
- HTML: Converted to plain text

---

## Stage 2: Chunking

**Purpose**: Break large documents into smaller, semantically meaningful pieces.

**Code Location**: `server/services/chunking-service.ts`

### Chunking Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `paragraph` | Split on double newlines | Articles, documentation |
| `sentence` | Split on sentence boundaries | Conversations, Q&A |
| `fixed` | Split at fixed character count | Large uniform documents |
| `semantic` | Split on topic changes | Mixed content |

### Configuration Options

```typescript
interface ChunkingOptions {
  strategy: 'paragraph' | 'sentence' | 'fixed' | 'semantic';
  maxChunkSize: number;   // Maximum characters per chunk (default: 1000)
  minChunkSize: number;   // Minimum characters per chunk (default: 100)
  overlap: number;        // Characters of overlap between chunks (default: 50)
}
```

### Chunk Metadata

Each chunk includes metadata for tracing:

```typescript
interface ChunkMetadata {
  documentId: string;      // Parent document ID
  filename: string;        // Original filename
  mimeType: string;        // Content type
  chunkIndex: number;      // Position in sequence
  totalChunks: number;     // Total chunks from document
  startOffset: number;     // Character offset in source
  endOffset: number;       // End position in source
  strategy: string;        // Chunking strategy used
}
```

---

## Stage 3: Vectorization (Embedding)

**Purpose**: Convert text chunks into numerical vectors for semantic similarity search.

**Code Location**: `server/services/embedding-service.ts`

### Embedding Model

- **Model**: Google Gemini `text-embedding-004`
- **Dimensions**: 768
- **Optimization**: Semantic similarity search

### Key Methods

```typescript
// Single text embedding
async embed(text: string): Promise<EmbeddingResult>

// Batch embedding for multiple chunks
async embedBatch(texts: string[]): Promise<EmbeddingResult[]>

// Calculate similarity between vectors
cosineSimilarity(a: number[], b: number[]): number

// Find most similar vectors
findSimilar(
  queryEmbedding: number[],
  candidates: { id: string; embedding: number[] }[],
  topK: number,
  threshold: number
): { id: string; score: number }[]
```

### Embedding Result

```typescript
interface EmbeddingResult {
  embedding: number[];  // 768-dimensional vector
  tokenCount?: number;  // Tokens consumed
}
```

---

## Stage 4: Storage

**Purpose**: Persist chunks and their embeddings for later retrieval.

**Code Location**: `server/storage.ts`, `shared/schema.ts`

### Database Schema

```sql
-- Document chunks with embeddings
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id TEXT NOT NULL,
  attachment_id TEXT,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding REAL[],      -- 768-dimensional vector
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Evidence table (for ingestion pipeline)
CREATE TABLE evidence (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT,
  modality TEXT,        -- text, image, audio, email, etc.
  bucket TEXT,          -- PERSONAL_LIFE, CREATOR, PROJECTS
  title TEXT,
  extracted_text TEXT,
  summary TEXT,
  metadata JSONB,
  created_at TIMESTAMP
);

-- Knowledge embeddings
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY,
  evidence_id UUID REFERENCES evidence,
  chunk_index INTEGER,
  embedding REAL[],
  chunk_text TEXT,
  created_at TIMESTAMP
);

-- Named entities
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,           -- person, place, organization, concept
  description TEXT,
  mention_count INTEGER,
  last_mentioned TIMESTAMP
);

-- Entity mentions linking
CREATE TABLE entity_mentions (
  id UUID PRIMARY KEY,
  entity_id UUID REFERENCES entities,
  evidence_id UUID REFERENCES evidence,
  context TEXT,
  created_at TIMESTAMP
);

-- Cross-references between items
CREATE TABLE cross_references (
  id UUID PRIMARY KEY,
  source_id TEXT,
  source_type TEXT,
  target_id TEXT,
  target_type TEXT,
  relationship_type TEXT,
  reason TEXT,
  strength INTEGER
);
```

### Storage Interface

```typescript
// Create a new document chunk
createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;

// Retrieve chunks by document
getDocumentChunksByDocumentId(documentId: string): Promise<DocumentChunk[]>;

// Retrieve all chunks for similarity search
getAllDocumentChunks(): Promise<DocumentChunk[]>;
```

---

## Stage 5: Retrieval

**Purpose**: Find relevant stored knowledge when a user asks a question.

**Code Location**: `server/services/retrieval-orchestrator.ts`

### Hybrid Search Strategy

The system uses **hybrid search** combining:

1. **Semantic Search** (Vector similarity)
   - Embed the user's query
   - Compare against stored embeddings
   - Return chunks above similarity threshold

2. **Keyword Search** (Text matching)
   - Extract keywords from query
   - Search title, content, and summary fields
   - Catch items that semantic search might miss

3. **Entity Search**
   - Find named entities related to the query
   - Include entity descriptions in context

### Retrieval Parameters

```typescript
interface RetrievalContext {
  query: string;              // User's question
  buckets?: KnowledgeBucket[];// Filter by domain
  maxTokens?: number;         // Context window limit (default: 8000)
  includeEntities?: boolean;  // Include entity information
  includeCrossRefs?: boolean; // Include related items
}
```

### Similarity Threshold

- **Default threshold**: 0.5 (50% similarity)
- **TopK results**: 5-20 most similar chunks
- Items below threshold are excluded

### Cosine Similarity Formula

```
similarity = (A · B) / (||A|| × ||B||)
```

Where A is the query vector and B is the stored chunk vector.

---

## Stage 6: Prompt Augmentation

**Purpose**: Inject retrieved knowledge into the AI prompt stack.

**Code Location**: `server/services/retrieval-orchestrator.ts`

### enrichPrompt Method

```typescript
async enrichPrompt(userMessage: string, systemContext: string = ''): Promise<string> {
  // 1. Retrieve relevant knowledge
  const retrievalResult = await this.retrieve({
    query: userMessage,
    maxTokens: 4000,
    includeEntities: true,
  });

  // 2. Format for prompt injection
  const knowledgeContext = this.formatForPrompt(retrievalResult);

  // 3. Return augmented context
  return `${systemContext}\n\n<retrieved_knowledge>\n${knowledgeContext}\n</retrieved_knowledge>`;
}
```

### formatForPrompt Method

```typescript
formatForPrompt(result: RetrievalResult): string {
  const sections: string[] = [];

  // Evidence items (document chunks)
  const evidenceItems = result.items.filter(i => i.type === 'evidence');
  if (evidenceItems.length > 0) {
    sections.push('## Relevant Knowledge\n');
    for (const item of evidenceItems) {
      const bucketTag = item.bucket ? `[${item.bucket}] ` : '';
      sections.push(`${bucketTag}${item.content}\n`);
    }
  }

  // Entity items
  const entityItems = result.items.filter(i => i.type === 'entity');
  if (entityItems.length > 0) {
    sections.push('\n## Known Entities\n');
    for (const item of entityItems) {
      sections.push(`- ${item.content}\n`);
    }
  }

  return sections.join('');
}
```

### Final Prompt Structure

```
[System Instructions]

<retrieved_knowledge>
## Relevant Knowledge
[PERSONAL_LIFE] User mentioned they have a dog named Max in previous conversation.
[CREATOR] User is working on a React application with TypeScript.

## Known Entities
- [ENTITY: person] Max: User's pet dog
- [ENTITY: project] Meowstik: Current project being developed
</retrieved_knowledge>

[User Message]
```

---

## Knowledge Buckets

Knowledge is organized into domain-specific buckets:

| Bucket | Domain | Examples |
|--------|--------|----------|
| `PERSONAL_LIFE` | Human aspects | Health, relationships, finances |
| `CREATOR` | Technical work | Code, design, research |
| `PROJECTS` | Specific projects | Project-specific knowledge |

---

## Context Window Management

**Maximum Context Tokens**: 8000 (configurable)

**Characters per Token**: ~4 (approximation)

The retrieval orchestrator automatically:
1. Sorts results by relevance score
2. Adds items until token limit reached
3. Truncates low-scoring items if necessary

---

## Performance Metrics

The retrieval system tracks:

```typescript
interface RetrievalResult {
  items: RetrievedItem[];
  totalTokensUsed: number;     // Tokens consumed by context
  queryEmbeddingTime: number;  // Ms to embed query
  searchTime: number;          // Total retrieval time
}
```

---

## API Endpoints

### Document Ingestion

```
POST /api/knowledge/pipeline/ingest
Content-Type: application/json

{
  "content": "Document text content...",
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "options": {
    "strategy": "paragraph",
    "maxChunkSize": 1000
  }
}
```

### Retrieval

```
POST /api/knowledge/pipeline/retrieve
Content-Type: application/json

{
  "query": "What do you know about my project?",
  "maxTokens": 4000,
  "includeEntities": true
}
```

### System Stats

```
GET /api/knowledge/pipeline/retrieval-stats

Response:
{
  "totalEmbeddings": 150,
  "totalEvidence": 45,
  "totalEntities": 23,
  "bucketDistribution": {
    "PERSONAL_LIFE": 10,
    "CREATOR": 25,
    "PROJECTS": 10
  }
}
```

---

## Service Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      RAG SERVICE                              │
│                                                               │
│  ┌─────────────────┐    ┌─────────────────┐                  │
│  │ Chunking        │    │ Embedding       │                  │
│  │ Service         │    │ Service         │                  │
│  │                 │    │                 │                  │
│  │ • chunkDocument │    │ • embed()       │                  │
│  │ • extractText   │    │ • embedBatch()  │                  │
│  │ • extractPdf    │    │ • findSimilar() │                  │
│  └────────┬────────┘    └────────┬────────┘                  │
│           │                      │                            │
│           └──────────┬───────────┘                            │
│                      ▼                                        │
│           ┌─────────────────┐                                 │
│           │ Retrieval       │                                 │
│           │ Orchestrator    │                                 │
│           │                 │                                 │
│           │ • retrieve()    │                                 │
│           │ • enrichPrompt()│                                 │
│           │ • formatForPrompt() │                             │
│           └────────┬────────┘                                 │
│                    │                                          │
│                    ▼                                          │
│           ┌─────────────────┐                                 │
│           │ Storage Layer   │                                 │
│           │ (PostgreSQL)    │                                 │
│           │                 │                                 │
│           │ • document_chunks│                                │
│           │ • evidence      │                                 │
│           │ • entities      │                                 │
│           │ • embeddings    │                                 │
│           └─────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## File Locations

| Component | File Path |
|-----------|-----------|
| RAG Service | `server/services/rag-service.ts` |
| Chunking Service | `server/services/chunking-service.ts` |
| Embedding Service | `server/services/embedding-service.ts` |
| Retrieval Orchestrator | `server/services/retrieval-orchestrator.ts` |
| Ingestion Pipeline | `server/services/ingestion-pipeline.ts` |
| Storage Interface | `server/storage.ts` |
| Database Schema | `shared/schema.ts` |
| Knowledge Routes | `server/routes/knowledge-ingestion.ts` |

---

## Related Documentation

- [Knowledge Ingestion Architecture](./KNOWLEDGE_INGESTION_ARCHITECTURE.md) - Historical conversation processing
- [Knowledge Buckets](./buckets/INDEX.md) - Domain organization guide
- [Session Log](./SESSION_LOG.md) - Development history

---

*This document is part of the Nebula AI knowledge system.*
*Version 1.0 - December 2025*
