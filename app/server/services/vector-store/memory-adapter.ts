/**
 * =============================================================================
 * IN-MEMORY ADAPTER - Testing & Development
 * =============================================================================
 * 
 * A simple in-memory vector store for testing, development, and Colab notebooks.
 * No external dependencies required.
 * 
 * TEACHING NOTES:
 * ---------------
 * This adapter demonstrates the core concepts of vector search:
 * - Storing vectors in a simple Map
 * - Computing cosine similarity manually
 * - Filtering and ranking results
 * 
 * WHEN TO USE:
 * - Unit testing without a database
 * - Google Colab notebooks
 * - Local development without PostgreSQL
 * - Learning how vector search works
 * 
 * LIMITATIONS:
 * - Data is lost when the process exits
 * - Linear scan for search (slow for large datasets)
 * - No persistence
 * =============================================================================
 */

import type {
  VectorStoreAdapter,
  VectorStoreConfig,
  VectorDocument,
  SearchResult,
  SearchOptions,
  UpsertOptions,
} from "./types";

export class MemoryAdapter implements VectorStoreAdapter {
  readonly name = "memory";
  private config: VectorStoreConfig;
  private documents: Map<string, VectorDocument> = new Map();

  constructor(config: VectorStoreConfig) {
    this.config = {
      dimension: 768,
      metric: 'cosine',
      ...config,
    };
  }

  /**
   * Initialize (no-op for in-memory)
   */
  async initialize(): Promise<void> {
    console.log("[memory] In-memory vector store initialized");
  }

  /**
   * Store a document
   */
  async upsert(doc: VectorDocument, _options?: UpsertOptions): Promise<void> {
    this.documents.set(doc.id, { ...doc });
  }

  /**
   * Store multiple documents
   */
  async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
    for (const doc of docs) {
      await this.upsert(doc, options);
    }
  }

  /**
   * Search for similar documents
   * 
   * TEACHING NOTES:
   * ---------------
   * This is a brute-force linear scan - we compute similarity with every
   * document. For small datasets this is fine, but for large datasets
   * (>10,000 docs) you need approximate nearest neighbor (ANN) algorithms
   * like IVF, HNSW, or product quantization.
   */
  async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      topK = 5,
      threshold = 0.5,
      filter,
      includeEmbeddings = false,
    } = options;

    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      // Apply metadata filter
      if (filter && !this.matchesFilter(doc.metadata || {}, filter)) {
        continue;
      }

      const score = this.cosineSimilarity(embedding, doc.embedding);

      if (score >= threshold) {
        results.push({
          document: {
            ...doc,
            embedding: includeEmbeddings ? doc.embedding : [],
          },
          score,
        });
      }
    }

    // Sort by score (descending) and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get a document by ID
   */
  async get(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null;
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  /**
   * Delete multiple documents
   */
  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }

  /**
   * Count documents
   */
  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!filter) return this.documents.size;

    let count = 0;
    for (const doc of this.documents.values()) {
      if (this.matchesFilter(doc.metadata || {}, filter)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Health check (always healthy for in-memory)
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }

  /**
   * Clear all documents and close
   */
  async close(): Promise<void> {
    this.documents.clear();
  }

  // -------------------------------------------------------------------------
  // Helper Methods - These are educational implementations
  // -------------------------------------------------------------------------

  /**
   * Compute cosine similarity between two vectors
   * 
   * TEACHING NOTES:
   * ---------------
   * Cosine similarity measures the angle between two vectors:
   * 
   *   similarity = (A · B) / (||A|| × ||B||)
   * 
   * Where:
   *   A · B = dot product (sum of element-wise products)
   *   ||A|| = magnitude (square root of sum of squares)
   * 
   * Result is between -1 and 1:
   *   1 = identical direction (very similar)
   *   0 = perpendicular (unrelated)
   *  -1 = opposite direction (opposite meaning)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitudeA = Math.sqrt(normA);
    const magnitudeB = Math.sqrt(normB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Check if metadata matches filter criteria
   * 
   * Simple equality matching - for production you'd want
   * more operators like $gt, $contains, etc.
   */
  private matchesFilter(
    metadata: Record<string, unknown>,
    filter: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Export all documents (useful for debugging/persistence)
   */
  exportAll(): VectorDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Import documents from an export
   */
  importAll(docs: VectorDocument[]): void {
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }
  }
}

/**
 * Factory function to create an in-memory adapter
 */
export function createMemoryAdapter(config: VectorStoreConfig): VectorStoreAdapter {
  return new MemoryAdapter(config);
}
