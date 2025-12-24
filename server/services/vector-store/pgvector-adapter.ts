/**
 * =============================================================================
 * PGVECTOR ADAPTER - PostgreSQL Vector Storage
 * =============================================================================
 * 
 * Uses the pgvector extension for native vector operations in PostgreSQL.
 * This is the recommended adapter for production use on Replit/cloud.
 * 
 * TEACHING NOTES:
 * ---------------
 * pgvector adds vector types to PostgreSQL:
 * - vector(768) - A column type for storing 768-dimension vectors
 * - <=> operator - Cosine distance (1 - similarity)
 * - <-> operator - Euclidean (L2) distance
 * - <#> operator - Negative inner product
 * 
 * WHY PGVECTOR?
 * - Uses your existing PostgreSQL database
 * - No additional services needed
 * - Excellent free tier on Replit/Supabase/Neon
 * - ACID transactions with your other data
 * =============================================================================
 */

import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import type {
  VectorStoreAdapter,
  VectorStoreConfig,
  VectorDocument,
  SearchResult,
  SearchOptions,
  UpsertOptions,
} from "./types";

export class PgVectorAdapter implements VectorStoreAdapter {
  readonly name = "pgvector";
  private config: VectorStoreConfig;
  private initialized = false;
  private tableName = "vector_store";

  constructor(config: VectorStoreConfig) {
    this.config = {
      dimension: 768,
      metric: 'cosine',
      ...config,
    };
  }

  /**
   * Initialize pgvector extension and create tables
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Enable pgvector extension (already done via SQL, but safe to repeat)
      await getDb().execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

      // Create the vector store table with native vector column
      await getDb().execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(this.tableName)} (
          id VARCHAR PRIMARY KEY,
          content TEXT NOT NULL,
          embedding vector(${sql.raw(String(this.config.dimension))}),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create an index for faster similarity search
      // Using IVFFlat index for better performance on larger datasets
      await getDb().execute(sql`
        CREATE INDEX IF NOT EXISTS ${sql.identifier(`${this.tableName}_embedding_idx`)}
        ON ${sql.identifier(this.tableName)}
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `).catch(() => {
        // Index creation may fail if not enough rows - that's okay
        console.log("[pgvector] Note: Index creation deferred until more data is added");
      });

      this.initialized = true;
      console.log("[pgvector] Adapter initialized successfully");
    } catch (error) {
      console.error("[pgvector] Initialization error:", error);
      throw error;
    }
  }

  /**
   * Store or update a single document
   */
  async upsert(doc: VectorDocument, _options?: UpsertOptions): Promise<void> {
    await this.ensureInitialized();

    const embeddingStr = `[${doc.embedding.join(",")}]`;

    await getDb().execute(sql`
      INSERT INTO ${sql.identifier(this.tableName)} (id, content, embedding, metadata, updated_at)
      VALUES (
        ${doc.id},
        ${doc.content},
        ${embeddingStr}::vector,
        ${JSON.stringify(doc.metadata || {})}::jsonb,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `);
  }

  /**
   * Store multiple documents in batch
   */
  async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
    await this.ensureInitialized();

    // Use a transaction for atomic batch insert
    for (const doc of docs) {
      await this.upsert(doc, options);
    }
  }

  /**
   * Search for similar documents using cosine similarity
   * 
   * TEACHING NOTES:
   * ---------------
   * The <=> operator returns cosine DISTANCE (1 - similarity)
   * So we calculate similarity as: 1 - distance
   * Lower distance = more similar
   */
  async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const {
      topK = 5,
      threshold = 0.5,
      filter,
      includeEmbeddings = false,
    } = options;

    const embeddingStr = `[${embedding.join(",")}]`;

    // Build the query with optional metadata filter
    let filterClause = sql``;
    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter).map(
        ([key, value]) => sql`metadata->>${key} = ${String(value)}`
      );
      filterClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    }

    const results = await getDb().execute(sql`
      SELECT 
        id,
        content,
        ${includeEmbeddings ? sql`embedding::text,` : sql``}
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM ${sql.identifier(this.tableName)}
      ${filterClause}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `);

    // Filter by threshold and format results
    return (results.rows as any[])
      .filter((row) => row.similarity >= threshold)
      .map((row) => ({
        document: {
          id: row.id,
          content: row.content,
          embedding: includeEmbeddings ? this.parseEmbedding(row.embedding) : [],
          metadata: row.metadata || {},
        },
        score: row.similarity,
      }));
  }

  /**
   * Get a document by ID
   */
  async get(id: string): Promise<VectorDocument | null> {
    await this.ensureInitialized();

    const results = await getDb().execute(sql`
      SELECT id, content, embedding::text, metadata
      FROM ${sql.identifier(this.tableName)}
      WHERE id = ${id}
    `);

    if (results.rows.length === 0) return null;

    const row = results.rows[0] as any;
    return {
      id: row.id,
      content: row.content,
      embedding: this.parseEmbedding(row.embedding),
      metadata: row.metadata || {},
    };
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    await getDb().execute(sql`
      DELETE FROM ${sql.identifier(this.tableName)}
      WHERE id = ${id}
    `);
  }

  /**
   * Delete multiple documents
   */
  async deleteBatch(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    if (ids.length === 0) return;

    await getDb().execute(sql`
      DELETE FROM ${sql.identifier(this.tableName)}
      WHERE id = ANY(${ids})
    `);
  }

  /**
   * Count documents with optional filter
   */
  async count(filter?: Record<string, unknown>): Promise<number> {
    await this.ensureInitialized();

    let filterClause = sql``;
    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter).map(
        ([key, value]) => sql`metadata->>${key} = ${String(value)}`
      );
      filterClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    }

    const results = await getDb().execute(sql`
      SELECT COUNT(*) as count
      FROM ${sql.identifier(this.tableName)}
      ${filterClause}
    `);

    return parseInt((results.rows[0] as any).count, 10);
  }

  /**
   * Check if pgvector is available and working
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await getDb().execute(sql`
        SELECT 1 as ok, extversion 
        FROM pg_extension 
        WHERE extname = 'vector'
      `);
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Close any connections (no-op for pgvector, uses shared db pool)
   */
  async close(): Promise<void> {
    this.initialized = false;
  }

  // Helper to ensure adapter is initialized
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Helper to parse vector string to array
  private parseEmbedding(embeddingStr: string): number[] {
    if (!embeddingStr) return [];
    try {
      // pgvector returns format like "[0.1,0.2,0.3]"
      return JSON.parse(embeddingStr.replace(/^\[/, "[").replace(/\]$/, "]"));
    } catch {
      return [];
    }
  }
}

/**
 * Factory function to create a pgvector adapter
 */
export function createPgVectorAdapter(config: VectorStoreConfig): VectorStoreAdapter {
  return new PgVectorAdapter(config);
}
