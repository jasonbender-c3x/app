# Modular Vector Store System

A pluggable vector storage system supporting multiple backends for Retrieval-Augmented Generation (RAG).

## 🎯 Overview

This module provides a unified interface for storing and searching vector embeddings across different backends:

| Backend | Best For | Free Tier |
|---------|----------|-----------|
| **pgvector** | Replit, Supabase, Neon | Included with PostgreSQL |
| **Vertex AI** | Google Cloud, Enterprise | $300 credits for 90 days |
| **In-Memory** | Testing, Colab, Learning | Always free |
| **Pinecone** | Managed cloud (planned) | 100K vectors free |

## 🚀 Quick Start

```typescript
import { createVectorStore, getDefaultConfig } from './server/services/vector-store';

// Auto-detect best backend based on environment
const store = createVectorStore();
await store.initialize();

// Store a document with its embedding
await store.upsert({
  id: 'doc-1',
  content: 'The quick brown fox jumps over the lazy dog',
  embedding: [0.1, 0.2, 0.3, ...], // 768-dim vector from Gemini
  metadata: { category: 'example', source: 'test' }
});

// Search for similar documents
const results = await store.search(queryEmbedding, {
  topK: 5,
  threshold: 0.5,
  filter: { category: 'example' }
});

console.log(results);
// [{ document: {...}, score: 0.92 }, ...]
```

## 📦 Installation

The vector store is part of the Meowstik project. No additional installation needed.

For pgvector (PostgreSQL), ensure the extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 🔧 Configuration

### Environment Variables

```bash
# General
VECTOR_STORE_BACKEND=pgvector    # pgvector | vertex | memory | pinecone
VECTOR_DIMENSION=768             # Gemini: 768, OpenAI: 1536/3072
VECTOR_METRIC=cosine             # cosine | euclidean | dot

# PostgreSQL/pgvector
DATABASE_URL=postgresql://...

# Vertex AI
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_RAG_CORPUS=my-corpus      # Optional, auto-created if not set

# Pinecone (planned)
PINECONE_API_KEY=pk-...
PINECONE_INDEX=my-index
```

### Programmatic Configuration

```typescript
import { createVectorStore } from './server/services/vector-store';

// Explicit configuration
const store = createVectorStore({
  backend: 'pgvector',
  dimension: 768,
  metric: 'cosine',
  databaseUrl: process.env.DATABASE_URL,
});
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              VectorStoreAdapter Interface                    │
│  • upsert(doc)        • search(embedding)                   │
│  • upsertBatch(docs)  • get(id)                             │
│  • delete(id)         • count()                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │pgvector │ │ Vertex  │ │ Memory  │
     │ Adapter │ │ Adapter │ │ Adapter │
     └────┬────┘ └────┬────┘ └────┬────┘
          │           │           │
          ▼           ▼           ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │PostgreSQL│ │Google   │ │ JS Map  │
     │+pgvector│ │Cloud RAG│ │(no-deps)│
     └─────────┘ └─────────┘ └─────────┘
```

## 📚 API Reference

### VectorStoreAdapter Interface

```typescript
interface VectorStoreAdapter {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // Write Operations
  upsert(doc: VectorDocument, options?: UpsertOptions): Promise<void>;
  upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void>;
  delete(id: string): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;

  // Read Operations
  get(id: string): Promise<VectorDocument | null>;
  search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
```

### VectorDocument

```typescript
interface VectorDocument {
  id: string;                           // Unique identifier
  content: string;                      // The text that was embedded
  embedding: number[];                  // Vector (768 dims for Gemini)
  metadata?: Record<string, unknown>;   // Arbitrary metadata for filtering
}
```

### SearchOptions

```typescript
interface SearchOptions {
  topK?: number;                        // Number of results (default: 5)
  threshold?: number;                   // Min similarity (default: 0.5)
  filter?: Record<string, unknown>;     // Metadata filter
  includeEmbeddings?: boolean;          // Include vectors in results
}
```

## 🎓 Teaching Examples

### Example 1: Basic RAG Pipeline

```typescript
import { createVectorStore } from './server/services/vector-store';
import { embeddingService } from './server/services/embedding-service';

// 1. Initialize the store
const store = createVectorStore({ backend: 'memory' });
await store.initialize();

// 2. Ingest documents
const documents = [
  'Python is a programming language',
  'JavaScript runs in the browser',
  'PostgreSQL is a relational database',
];

for (let i = 0; i < documents.length; i++) {
  const embedding = await embeddingService.embed(documents[i]);
  await store.upsert({
    id: `doc-${i}`,
    content: documents[i],
    embedding: embedding.embedding,
    metadata: { index: i },
  });
}

// 3. Query
const query = 'What language is used for web development?';
const queryEmbedding = await embeddingService.embed(query);
const results = await store.search(queryEmbedding.embedding, { topK: 2 });

console.log('Query:', query);
console.log('Top matches:', results.map(r => ({
  content: r.document.content,
  score: r.score.toFixed(3),
})));
// Expected: JavaScript runs in the browser (highest similarity)
```

### Example 2: Running in Google Colab

```python
# In Colab, you can use the memory adapter directly

# First, install dependencies
!npm install

# Then run the example
import subprocess
result = subprocess.run(['npx', 'tsx', 'examples/vector-store-demo.ts'], capture_output=True)
print(result.stdout.decode())
```

### Example 3: Switching Backends at Runtime

```typescript
// Development: Use in-memory for fast iteration
const devStore = createVectorStore({ backend: 'memory' });

// Testing: Use pgvector with test database
const testStore = createVectorStore({
  backend: 'pgvector',
  databaseUrl: process.env.TEST_DATABASE_URL,
});

// Production: Use Vertex AI for managed infrastructure
const prodStore = createVectorStore({
  backend: 'vertex',
  vertexProjectId: process.env.GOOGLE_CLOUD_PROJECT,
});
```

## 🔍 Backend-Specific Notes

### pgvector

- Uses PostgreSQL's native vector type
- IVFFlat index for fast similarity search
- Best for: Production on Replit, Supabase, Neon
- Distance operators: `<=>` (cosine), `<->` (L2), `<#>` (inner product)

### Vertex AI RAG

- Fully managed by Google Cloud
- Automatic chunking and embedding
- Best for: Enterprise, GCP deployments
- Note: Uses text-based retrieval, not raw embeddings

### In-Memory

- Simple Map-based storage
- No external dependencies
- Best for: Testing, learning, Colab notebooks
- Limitation: Data lost on process exit

## 🤝 Contributing

To add a new backend adapter:

1. Implement the `VectorStoreAdapter` interface
2. Create a factory function (`createMyAdapter`)
3. Add to the factory switch in `index.ts`
4. Add environment variable support in `config.ts`
5. Write tests and documentation

## 📄 License

MIT - Part of the Meowstik project
