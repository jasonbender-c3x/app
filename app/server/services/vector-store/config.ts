/**
 * =============================================================================
 * VECTOR STORE CONFIGURATION
 * =============================================================================
 * 
 * Central configuration for the modular vector store system.
 * Supports environment variables for all settings.
 * 
 * TEACHING NOTES:
 * ---------------
 * Configuration best practices:
 * 1. Use environment variables for secrets (API keys, connection strings)
 * 2. Provide sensible defaults for non-sensitive settings
 * 3. Validate configuration at startup
 * 4. Support multiple environments (dev, staging, production)
 * 
 * ENVIRONMENT VARIABLES:
 * ----------------------
 * General:
 *   VECTOR_STORE_BACKEND    - 'pgvector' | 'vertex' | 'memory' | 'pinecone'
 *   VECTOR_DIMENSION        - Embedding dimension (default: 768)
 *   VECTOR_METRIC           - 'cosine' | 'euclidean' | 'dot'
 * 
 * PostgreSQL/pgvector:
 *   DATABASE_URL            - PostgreSQL connection string
 * 
 * Vertex AI:
 *   GOOGLE_CLOUD_PROJECT    - GCP project ID
 *   GOOGLE_CLOUD_LOCATION   - Region (default: us-central1)
 *   VERTEX_RAG_CORPUS       - RAG corpus name (optional)
 * 
 * Pinecone:
 *   PINECONE_API_KEY        - Pinecone API key
 *   PINECONE_INDEX          - Index name
 *   PINECONE_ENVIRONMENT    - Environment (e.g., 'us-west1-gcp-free')
 * =============================================================================
 */

import type { VectorStoreConfig } from "./types";

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): VectorStoreConfig {
  const backend = (process.env.VECTOR_STORE_BACKEND || detectBackendFromEnv()) as VectorStoreConfig["backend"];

  return {
    backend,
    dimension: parseInt(process.env.VECTOR_DIMENSION || "768", 10),
    metric: (process.env.VECTOR_METRIC || "cosine") as VectorStoreConfig["metric"],

    // PostgreSQL/pgvector
    databaseUrl: process.env.DATABASE_URL,

    // Vertex AI
    vertexProjectId: process.env.GOOGLE_CLOUD_PROJECT,
    vertexLocation: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    vertexCorpusName: process.env.VERTEX_RAG_CORPUS,

    // Pinecone
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeIndex: process.env.PINECONE_INDEX,
  };
}

/**
 * Auto-detect backend from available environment variables
 */
function detectBackendFromEnv(): string {
  if (process.env.PINECONE_API_KEY) return "pinecone";
  if (process.env.GOOGLE_CLOUD_PROJECT) return "vertex";
  if (process.env.DATABASE_URL) return "pgvector";
  return "memory";
}

/**
 * Validate configuration for a specific backend
 */
export function validateConfig(config: VectorStoreConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Common validation
  if (config.dimension && (config.dimension < 1 || config.dimension > 4096)) {
    errors.push("Dimension must be between 1 and 4096");
  }

  // Backend-specific validation
  switch (config.backend) {
    case "pgvector":
      if (!config.databaseUrl && !process.env.DATABASE_URL) {
        errors.push("DATABASE_URL is required for pgvector backend");
      }
      break;

    case "vertex":
      if (!config.vertexProjectId && !process.env.GOOGLE_CLOUD_PROJECT) {
        errors.push("GOOGLE_CLOUD_PROJECT is required for Vertex AI backend");
      }
      break;

    case "pinecone":
      if (!config.pineconeApiKey) {
        errors.push("PINECONE_API_KEY is required for Pinecone backend");
      }
      if (!config.pineconeIndex) {
        errors.push("PINECONE_INDEX is required for Pinecone backend");
      }
      break;

    case "memory":
      // No validation needed
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print configuration summary (safe - no secrets)
 */
export function printConfigSummary(config: VectorStoreConfig): void {
  console.log("=".repeat(60));
  console.log("VECTOR STORE CONFIGURATION");
  console.log("=".repeat(60));
  console.log(`Backend:    ${config.backend}`);
  console.log(`Dimension:  ${config.dimension}`);
  console.log(`Metric:     ${config.metric}`);
  
  switch (config.backend) {
    case "pgvector":
      console.log(`Database:   ${config.databaseUrl ? "(configured)" : "(missing)"}`);
      break;
    case "vertex":
      console.log(`Project:    ${config.vertexProjectId || "(not set)"}`);
      console.log(`Location:   ${config.vertexLocation}`);
      console.log(`Corpus:     ${config.vertexCorpusName || "(auto-create)"}`);
      break;
    case "pinecone":
      console.log(`API Key:    ${config.pineconeApiKey ? "(configured)" : "(missing)"}`);
      console.log(`Index:      ${config.pineconeIndex || "(not set)"}`);
      break;
  }
  
  console.log("=".repeat(60));
}

/**
 * Example configurations for different environments
 */
export const EXAMPLE_CONFIGS = {
  // Replit deployment
  replit: {
    backend: "pgvector" as const,
    dimension: 768,
    metric: "cosine" as const,
  },

  // Google Cloud deployment
  googleCloud: {
    backend: "vertex" as const,
    dimension: 768,
    metric: "cosine" as const,
    vertexLocation: "us-central1",
  },

  // Local development
  local: {
    backend: "memory" as const,
    dimension: 768,
    metric: "cosine" as const,
  },

  // Colab notebook
  colab: {
    backend: "memory" as const,
    dimension: 768,
    metric: "cosine" as const,
  },

  // Production with Pinecone
  pinecone: {
    backend: "pinecone" as const,
    dimension: 768,
    metric: "cosine" as const,
  },
};
