/**
 * =============================================================================
 * MODULAR VECTOR STORE - Main Entry Point
 * =============================================================================
 * 
 * This module provides a unified interface for vector storage across different
 * backends. Use this to switch between pgvector, Vertex AI, or in-memory
 * storage based on your deployment environment.
 * 
 * TEACHING NOTES:
 * ---------------
 * This is the Factory Pattern + Strategy Pattern combined:
 * - Factory: createVectorStore() creates the right adapter based on config
 * - Strategy: All adapters implement the same interface, so code works the same
 * 
 * USAGE:
 * ```typescript
 * import { createVectorStore, getDefaultConfig } from './vector-store';
 * 
 * // Auto-detect best backend based on environment
 * const store = await createVectorStore(getDefaultConfig());
 * await store.initialize();
 * 
 * // Or specify explicitly
 * const pgStore = await createVectorStore({ backend: 'pgvector' });
 * const memStore = await createVectorStore({ backend: 'memory' });
 * const vertexStore = await createVectorStore({ backend: 'vertex', vertexProjectId: '...' });
 * ```
 * =============================================================================
 */

// Export types
export type {
  VectorStoreConfig,
  VectorDocument,
  SearchResult,
  SearchOptions,
  UpsertOptions,
  VectorStoreAdapter,
  VectorStoreFactory,
} from "./types";

export { DEFAULT_CONFIG } from "./types";

// Import adapters
import { createPgVectorAdapter } from "./pgvector-adapter";
import { createMemoryAdapter } from "./memory-adapter";
import { createVertexAdapter } from "./vertex-adapter";
import type { VectorStoreConfig, VectorStoreAdapter } from "./types";

/**
 * Detect the best available backend based on environment
 * 
 * TEACHING NOTES:
 * ---------------
 * This function checks what's available and picks the best option:
 * 1. If DATABASE_URL is set → use pgvector (production/Replit)
 * 2. If GOOGLE_CLOUD_PROJECT is set → use Vertex AI
 * 3. Otherwise → use in-memory (development/testing)
 * 
 * Note: Credentials validation happens at adapter initialization time,
 * not during backend selection. This allows graceful error handling.
 */
export function detectBackend(): VectorStoreConfig["backend"] {
  // Check for PostgreSQL (Replit, Supabase, etc.)
  if (process.env.DATABASE_URL) {
    return "pgvector";
  }

  // Check for Google Cloud project (Vertex AI)
  // Credentials are validated later during adapter initialization
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return "vertex";
  }

  // Fallback to in-memory
  return "memory";
}

/**
 * Get default configuration based on environment
 */
export function getDefaultConfig(): VectorStoreConfig {
  const backend = detectBackend();

  const config: VectorStoreConfig = {
    backend,
    dimension: 768, // Gemini text-embedding-004
    metric: "cosine",
  };

  // Add backend-specific config from environment
  switch (backend) {
    case "pgvector":
      config.databaseUrl = process.env.DATABASE_URL;
      break;

    case "vertex":
      config.vertexProjectId = process.env.GOOGLE_CLOUD_PROJECT;
      config.vertexLocation = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
      config.vertexCorpusName = process.env.VERTEX_RAG_CORPUS;
      break;

    case "pinecone":
      config.pineconeApiKey = process.env.PINECONE_API_KEY;
      config.pineconeIndex = process.env.PINECONE_INDEX;
      break;
  }

  return config;
}

/**
 * Create a vector store adapter based on configuration
 * 
 * TEACHING NOTES:
 * ---------------
 * This is the main factory function. It creates the right adapter
 * based on the config.backend value. All adapters implement the
 * same interface, so you can use them interchangeably.
 */
export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStoreAdapter {
  const fullConfig: VectorStoreConfig = {
    ...getDefaultConfig(),
    ...config,
  };

  console.log(`[vector-store] Creating ${fullConfig.backend} adapter`);

  switch (fullConfig.backend) {
    case "pgvector":
      return createPgVectorAdapter(fullConfig);

    case "vertex":
      return createVertexAdapter(fullConfig);

    case "memory":
      return createMemoryAdapter(fullConfig);

    case "pinecone":
      // TODO: Implement Pinecone adapter
      console.warn("[vector-store] Pinecone adapter not yet implemented, using memory");
      return createMemoryAdapter(fullConfig);

    default:
      throw new Error(`Unknown vector store backend: ${fullConfig.backend}`);
  }
}

// Singleton instance for the default vector store
let defaultStore: VectorStoreAdapter | null = null;

/**
 * Get or create the default vector store instance
 * 
 * TEACHING NOTES:
 * ---------------
 * This provides a singleton pattern for convenience.
 * Most apps only need one vector store, so this avoids
 * creating multiple instances.
 */
export async function getVectorStore(): Promise<VectorStoreAdapter> {
  if (!defaultStore) {
    defaultStore = createVectorStore();
    await defaultStore.initialize();
  }
  return defaultStore;
}

/**
 * Reset the default store (useful for testing)
 */
export async function resetVectorStore(): Promise<void> {
  if (defaultStore) {
    await defaultStore.close();
    defaultStore = null;
  }
}

/**
 * Health check for the vector store
 */
export async function checkVectorStoreHealth(): Promise<{
  healthy: boolean;
  backend: string;
  details?: string;
}> {
  try {
    const store = await getVectorStore();
    const healthy = await store.healthCheck();
    return {
      healthy,
      backend: store.name,
      details: healthy ? "Connected" : "Connection failed",
    };
  } catch (error) {
    return {
      healthy: false,
      backend: "unknown",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Re-export adapter factories for direct use
export { createPgVectorAdapter } from "./pgvector-adapter";
export { createMemoryAdapter, MemoryAdapter } from "./memory-adapter";
export { createVertexAdapter, VertexAdapter } from "./vertex-adapter";
