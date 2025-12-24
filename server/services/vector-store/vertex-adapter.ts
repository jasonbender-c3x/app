/**
 * =============================================================================
 * VERTEX AI RAG ADAPTER - Google Cloud's Managed RAG Service
 * =============================================================================
 * 
 * Uses Google Cloud's Vertex AI RAG Engine for enterprise-grade vector storage.
 * Ideal for production deployments on Google Cloud Platform.
 * 
 * TEACHING NOTES:
 * ---------------
 * Vertex AI RAG Engine is a fully managed service that handles:
 * - Vector storage (backed by Cloud Spanner)
 * - Automatic chunking and embedding
 * - Grounding API for LLM responses
 * 
 * PRICING (as of 2024):
 * - RAG Engine orchestration: FREE
 * - Embeddings: Standard API rates
 * - Vector storage: Spanner pricing
 * - New users: $300 credits for 90 days
 * 
 * SETUP REQUIREMENTS:
 * 1. Google Cloud project with billing enabled
 * 2. Vertex AI API enabled
 * 3. Service account with Vertex AI permissions
 * 4. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
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

/**
 * Vertex AI RAG API response types
 */
interface VertexRagFile {
  name: string;
  displayName: string;
  createTime: string;
  updateTime: string;
}

interface VertexContext {
  sourceUri: string;
  text: string;
  score: number;
}

export class VertexAdapter implements VectorStoreAdapter {
  readonly name = "vertex";
  private config: VectorStoreConfig;
  private initialized = false;
  private corpusName: string = "";
  private baseUrl: string = "";
  private accessToken: string = "";

  constructor(config: VectorStoreConfig) {
    this.config = {
      dimension: 768,
      metric: 'cosine',
      vertexLocation: 'us-central1',
      ...config,
    };

    if (!this.config.vertexProjectId) {
      console.warn("[vertex] Warning: vertexProjectId not set - using placeholder");
    }
  }

  /**
   * Initialize connection to Vertex AI RAG Engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const projectId = this.config.vertexProjectId || process.env.GOOGLE_CLOUD_PROJECT;
    const location = this.config.vertexLocation || 'us-central1';

    if (!projectId) {
      throw new Error("[vertex] Project ID required. Set vertexProjectId in config or GOOGLE_CLOUD_PROJECT env var");
    }

    this.baseUrl = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}`;

    // Get access token from environment or ADC
    this.accessToken = await this.getAccessToken();

    // Create or get corpus
    this.corpusName = this.config.vertexCorpusName || await this.getOrCreateCorpus();

    this.initialized = true;
    console.log(`[vertex] Initialized with corpus: ${this.corpusName}`);
  }

  /**
   * Get access token for Vertex AI API
   * 
   * TEACHING NOTES:
   * ---------------
   * In production, use Application Default Credentials (ADC):
   * - On GCP: Automatic from metadata server
   * - On Colab: gcloud auth application-default login
   * - Local: GOOGLE_APPLICATION_CREDENTIALS env var
   */
  private async getAccessToken(): Promise<string> {
    // Check for explicit token
    if (process.env.GOOGLE_ACCESS_TOKEN) {
      return process.env.GOOGLE_ACCESS_TOKEN;
    }

    // Try to get token from metadata server (GCP environment)
    try {
      const response = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        { headers: { "Metadata-Flavor": "Google" } }
      );
      if (response.ok) {
        const data = await response.json() as { access_token: string };
        return data.access_token;
      }
    } catch {
      // Not on GCP, continue
    }

    // Fall back to gcloud CLI token (local development)
    try {
      const { execSync } = await import("child_process");
      const token = execSync("gcloud auth print-access-token", { encoding: "utf-8" }).trim();
      return token;
    } catch {
      throw new Error("[vertex] Unable to get access token. Run 'gcloud auth login' or set GOOGLE_ACCESS_TOKEN");
    }
  }

  /**
   * Create or get existing RAG corpus
   */
  private async getOrCreateCorpus(): Promise<string> {
    const corpusDisplayName = "meowstik-knowledge-base";

    // List existing corpora
    const listResponse = await fetch(`${this.baseUrl}/ragCorpora`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (listResponse.ok) {
      const data = await listResponse.json() as { ragCorpora?: { name: string; displayName: string }[] };
      const existing = data.ragCorpora?.find((c) => c.displayName === corpusDisplayName);
      if (existing) {
        return existing.name;
      }
    }

    // Create new corpus
    const createResponse = await fetch(`${this.baseUrl}/ragCorpora`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: corpusDisplayName,
        description: "Meowstik AI knowledge base",
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`[vertex] Failed to create corpus: ${error}`);
    }

    const corpus = await createResponse.json() as { name: string };
    return corpus.name;
  }

  /**
   * Upload a document to the RAG corpus
   * 
   * TEACHING NOTES:
   * ---------------
   * Vertex AI RAG handles chunking and embedding automatically.
   * We just upload the raw text content and it does the rest.
   */
  async upsert(doc: VectorDocument, _options?: UpsertOptions): Promise<void> {
    await this.ensureInitialized();

    // For Vertex AI, we upload as a file to the corpus
    const response = await fetch(`${this.baseUrl}/${this.corpusName}/ragFiles:import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        importRagFilesConfig: {
          ragFileChunkingConfig: {
            chunkSize: 512,
            chunkOverlap: 100,
          },
          inlineSource: {
            ragFiles: [{
              displayName: doc.id,
              description: JSON.stringify(doc.metadata || {}),
              inlineContent: {
                mimeType: "text/plain",
                data: Buffer.from(doc.content).toString("base64"),
              },
            }],
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[vertex] Upsert failed: ${error}`);
      throw new Error(`[vertex] Failed to upsert document: ${error}`);
    }
  }

  /**
   * Upload multiple documents in batch
   */
  async upsertBatch(docs: VectorDocument[], options?: UpsertOptions): Promise<void> {
    // Vertex AI batch import
    for (const doc of docs) {
      await this.upsert(doc, options);
    }
  }

  /**
   * Search the RAG corpus using the retrieveContexts API
   */
  async search(embedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const { topK = 5, threshold = 0.5 } = options;

    // Note: Vertex AI RAG uses text queries, not raw embeddings
    // We'd need to convert the embedding back to text, which isn't practical
    // Instead, this adapter is designed for text-based retrieval
    
    // For production, you'd use the retrieveContexts API with a text query
    console.warn("[vertex] search() with raw embedding not supported. Use searchByText() instead.");
    
    return [];
  }

  /**
   * Search by text query (Vertex AI's native method)
   */
  async searchByText(query: string, topK: number = 5): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const response = await fetch(`${this.baseUrl}/${this.corpusName}:retrieveContexts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { text: query },
        similarityTopK: topK,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[vertex] Search failed: ${error}`);
      return [];
    }

    const data = await response.json() as { contexts: VertexContext[] };
    
    return (data.contexts || []).map((ctx) => ({
      document: {
        id: ctx.sourceUri,
        content: ctx.text,
        embedding: [],
        metadata: {},
      },
      score: ctx.score,
    }));
  }

  /**
   * Get a document by ID (list RAG files)
   */
  async get(id: string): Promise<VectorDocument | null> {
    await this.ensureInitialized();

    const response = await fetch(`${this.baseUrl}/${this.corpusName}/ragFiles`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) return null;

    const data = await response.json() as { ragFiles?: VertexRagFile[] };
    const file = data.ragFiles?.find((f) => f.displayName === id);

    if (!file) return null;

    return {
      id: file.displayName,
      content: "", // Content not returned in list
      embedding: [],
      metadata: {},
    };
  }

  /**
   * Delete a RAG file
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    // First, find the file by display name
    const doc = await this.get(id);
    if (!doc) return;

    // Delete by resource name
    const response = await fetch(`${this.baseUrl}/${this.corpusName}/ragFiles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[vertex] Delete failed: ${error}`);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  /**
   * Count files in corpus
   */
  async count(_filter?: Record<string, unknown>): Promise<number> {
    await this.ensureInitialized();

    const response = await fetch(`${this.baseUrl}/${this.corpusName}/ragFiles`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) return 0;

    const data = await response.json() as { ragFiles?: unknown[] };
    return data.ragFiles?.length || 0;
  }

  /**
   * Check if Vertex AI is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up
   */
  async close(): Promise<void> {
    this.initialized = false;
    this.accessToken = "";
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Factory function to create a Vertex AI adapter
 */
export function createVertexAdapter(config: VectorStoreConfig): VectorStoreAdapter {
  return new VertexAdapter(config);
}
