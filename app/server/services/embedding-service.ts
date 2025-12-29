/**
 * =============================================================================
 * NEBULA CHAT - EMBEDDING SERVICE
 * =============================================================================
 * 
 * Generates vector embeddings for text using Google's Gemini embedding model.
 * Used for semantic search in the RAG pipeline.
 * 
 * EMBEDDING MODEL:
 * - Uses Gemini's text-embedding model
 * - Produces 768-dimensional vectors
 * - Optimized for semantic similarity search
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSION = 768;

export interface EmbeddingResult {
  embedding: number[];
  tokenCount?: number;
}

export class EmbeddingService {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const client = this.getClient();

    try {
      const result = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
      });

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error("No embedding returned from API");
      }

      return {
        embedding: result.embeddings[0].values || [],
      };
    } catch (error) {
      console.error("Embedding error:", error);
      
      // Log to error buffer
      const { logLLMError } = await import("./llm-error-buffer");
      logLLMError("embedding", "embed", error, {
        textLength: text.length
      }, {
        model: EMBEDDING_MODEL
      });
      
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      try {
        const result = await this.embed(text);
        results.push(result);
      } catch (error) {
        console.error(`Failed to embed text: ${text.substring(0, 50)}...`);
        results.push({ embedding: new Array(EMBEDDING_DIMENSION).fill(0) });
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar vectors from a list
   */
  findSimilar(
    queryEmbedding: number[],
    candidates: { id: string; embedding: number[] }[],
    topK: number = 5,
    threshold: number = 0.5
  ): { id: string; score: number }[] {
    const scored = candidates
      .map((c) => ({
        id: c.id,
        score: this.cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .filter((c) => c.score >= threshold)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }
}

export const embeddingService = new EmbeddingService();
