/**
 * =============================================================================
 * MODULAR VECTOR STORE - TYPE DEFINITIONS
 * =============================================================================
 * 
 * This module defines the interfaces for a pluggable vector storage system.
 * Supports multiple backends: pgvector, Vertex AI RAG, in-memory, and more.
 * 
 * TEACHING NOTES:
 * ---------------
 * Vector stores are specialized databases for storing and searching vectors
 * (arrays of numbers representing text/images semantically).
 * 
 * Key concepts:
 * - Embedding: Converting text to a vector of numbers
 * - Similarity: Finding vectors "close" to a query vector
 * - Cosine similarity: Measures angle between vectors (1 = identical)
 * =============================================================================
 */

/**
 * Configuration for different vector store backends
 */
export interface VectorStoreConfig {
  /** Which backend to use: 'pgvector' | 'vertex' | 'memory' | 'pinecone' */
  backend: 'pgvector' | 'vertex' | 'memory' | 'pinecone';
  
  /** Database connection string (for pgvector) */
  databaseUrl?: string;
  
  /** Vertex AI project ID (for vertex backend) */
  vertexProjectId?: string;
  
  /** Vertex AI location (for vertex backend) */
  vertexLocation?: string;
  
  /** Vertex AI RAG corpus name (for vertex backend) */
  vertexCorpusName?: string;
  
  /** Pinecone API key (for pinecone backend) */
  pineconeApiKey?: string;
  
  /** Pinecone index name (for pinecone backend) */
  pineconeIndex?: string;
  
  /** Embedding dimension (default: 768 for Gemini) */
  dimension?: number;
  
  /** Similarity metric: 'cosine' | 'euclidean' | 'dot' */
  metric?: 'cosine' | 'euclidean' | 'dot';
}

/**
 * A document chunk with its embedding and metadata
 */
export interface VectorDocument {
  /** Unique identifier */
  id: string;
  
  /** The text content that was embedded */
  content: string;
  
  /** The vector embedding (array of floats) */
  embedding: number[];
  
  /** Arbitrary metadata for filtering */
  metadata?: Record<string, unknown>;
}

/**
 * Result from a similarity search
 */
export interface SearchResult {
  /** The matching document */
  document: VectorDocument;
  
  /** Similarity score (0-1 for cosine, higher = more similar) */
  score: number;
}

/**
 * Options for similarity search
 */
export interface SearchOptions {
  /** Number of results to return (default: 5) */
  topK?: number;
  
  /** Minimum similarity threshold (default: 0.5) */
  threshold?: number;
  
  /** Metadata filter (key-value pairs must match) */
  filter?: Record<string, unknown>;
  
  /** Include the embedding vectors in results */
  includeEmbeddings?: boolean;
}

/**
 * Options for upserting documents
 */
export interface UpsertOptions {
  /** Namespace/collection to store in */
  namespace?: string;
  
  /** Overwrite existing documents with same ID */
  overwrite?: boolean;
}

/**
 * The main interface that all vector store adapters must implement
 * 
 * TEACHING NOTES:
 * ---------------
 * This is an adapter pattern - we define a common interface that multiple
 * backends can implement. This allows switching between pgvector, Vertex AI,
 * or any other vector store without changing application code.
 */
export interface VectorStoreAdapter {
  /** Human-readable name of this adapter */
  readonly name: string;
  
  /**
   * Initialize the adapter (create tables, connect, etc.)
   * Call this before using the adapter.
   */
  initialize(): Promise<void>;
  
  /**
   * Store a document with its embedding
   * @param doc - The document to store
   * @param options - Storage options
   */
  upsert(doc: VectorDocument, options?: UpsertOptions): Promise<void>;
  
  /**
   * Store multiple documents in batch
   * @param docs - The documents to store
   * @param options - Storage options
   */
  upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void>;
  
  /**
   * Search for similar documents
   * @param embedding - The query embedding vector
   * @param options - Search options
   */
  search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Get a document by ID
   * @param id - The document ID
   */
  get(id: string): Promise<VectorDocument | null>;
  
  /**
   * Delete a document by ID
   * @param id - The document ID
   */
  delete(id: string): Promise<void>;
  
  /**
   * Delete multiple documents by IDs
   * @param ids - The document IDs
   */
  deleteBatch(ids: string[]): Promise<void>;
  
  /**
   * Count total documents
   * @param filter - Optional metadata filter
   */
  count(filter?: Record<string, unknown>): Promise<number>;
  
  /**
   * Check if the adapter is healthy/connected
   */
  healthCheck(): Promise<boolean>;
  
  /**
   * Clean up resources (close connections, etc.)
   */
  close(): Promise<void>;
}

/**
 * Factory function type for creating adapters
 */
export type VectorStoreFactory = (config: VectorStoreConfig) => VectorStoreAdapter;

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Partial<VectorStoreConfig> = {
  backend: 'pgvector',
  dimension: 768,
  metric: 'cosine',
};
