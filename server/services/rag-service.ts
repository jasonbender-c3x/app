/**
 * =============================================================================
 * NEBULA CHAT - RAG SERVICE
 * =============================================================================
 * 
 * Retrieval Augmented Generation service that:
 * 1. Ingests documents (chunk + embed + store)
 * 2. Retrieves relevant chunks for queries
 * 3. Augments prompts with retrieved context
 * 
 * PIPELINE:
 * ---------
 * Upload → Chunk → Embed → Store
 * Query → Embed → Search → Retrieve → Augment Prompt
 * =============================================================================
 */

import { storage } from "../storage";
import { chunkingService, type ChunkingOptions } from "./chunking-service";
import { embeddingService } from "./embedding-service";
import type { DocumentChunk, Attachment } from "@shared/schema";

export interface IngestResult {
  documentId: string;
  chunksCreated: number;
  success: boolean;
  error?: string;
}

export interface RetrievalResult {
  chunks: DocumentChunk[];
  scores: number[];
}

export interface RAGContext {
  relevantChunks: string[];
  sources: { documentId: string; filename: string; chunkIndex: number }[];
}

export class RAGService {
  /**
   * Ingest a document: chunk, embed, and store
   */
  async ingestDocument(
    content: string,
    attachmentId: string,
    filename: string,
    mimeType?: string,
    options?: ChunkingOptions
  ): Promise<IngestResult> {
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const extractedText = chunkingService.extractText(content, mimeType);

      const chunks = await chunkingService.chunkDocument(
        extractedText,
        documentId,
        filename,
        mimeType,
        options
      );

      if (chunks.length === 0) {
        return {
          documentId,
          chunksCreated: 0,
          success: false,
          error: "No chunks generated from document",
        };
      }

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);

      for (let i = 0; i < chunks.length; i++) {
        await storage.createDocumentChunk({
          documentId,
          attachmentId,
          chunkIndex: chunks[i].metadata.chunkIndex,
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: chunks[i].metadata,
        });
      }

      console.log(`Ingested document ${filename}: ${chunks.length} chunks created`);

      return {
        documentId,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      console.error("Document ingestion error:", error);
      return {
        documentId,
        chunksCreated: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Retrieve relevant chunks for a query
   */
  async retrieve(
    query: string,
    topK: number = 5,
    threshold: number = 0.5
  ): Promise<RetrievalResult> {
    try {
      const queryEmbedding = await embeddingService.embed(query);

      const allChunks = await storage.getAllDocumentChunks();

      if (allChunks.length === 0) {
        return { chunks: [], scores: [] };
      }

      const candidates = allChunks
        .filter((c) => {
          if (!c.embedding) return false;
          // Handle both array and object with values property
          if (Array.isArray(c.embedding)) return true;
          if (typeof c.embedding === 'object' && 'values' in c.embedding && Array.isArray((c.embedding as any).values)) return true;
          return false;
        })
        .map((c) => {
          // Extract embedding array, handling both formats
          let embedding: number[];
          if (Array.isArray(c.embedding)) {
            embedding = c.embedding as number[];
          } else {
            embedding = (c.embedding as any).values;
          }
          return { id: c.id, embedding };
        });

      const similar = embeddingService.findSimilar(
        queryEmbedding.embedding,
        candidates,
        topK,
        threshold
      );

      const chunks: DocumentChunk[] = [];
      const scores: number[] = [];

      for (const match of similar) {
        const chunk = allChunks.find((c) => c.id === match.id);
        if (chunk) {
          chunks.push(chunk);
          scores.push(match.score);
        }
      }

      return { chunks, scores };
    } catch (error) {
      console.error("Retrieval error:", error);
      return { chunks: [], scores: [] };
    }
  }

  /**
   * Build RAG context from retrieved chunks
   */
  async buildContext(query: string, topK: number = 5): Promise<RAGContext> {
    const { chunks, scores } = await this.retrieve(query, topK);

    const relevantChunks = chunks.map((c, i) => {
      const meta = c.metadata as { filename?: string } | null;
      const filename = meta?.filename || "unknown";
      return `[Source: ${filename}, Score: ${scores[i].toFixed(2)}]\n${c.content}`;
    });

    const sources = chunks.map((c) => {
      const meta = c.metadata as { filename?: string } | null;
      return {
        documentId: c.documentId,
        filename: meta?.filename || "unknown",
        chunkIndex: c.chunkIndex,
      };
    });

    return { relevantChunks, sources };
  }

  /**
   * Format RAG context as a string for prompt augmentation
   */
  formatContextForPrompt(context: RAGContext): string {
    if (context.relevantChunks.length === 0) {
      return "";
    }

    return `
## Retrieved Document Context

The following excerpts from uploaded documents may be relevant to this query:

${context.relevantChunks.join("\n\n---\n\n")}

Use this context to provide accurate, grounded responses. Cite sources when appropriate.
`;
  }

  /**
   * Process attachment for RAG ingestion
   */
  async processAttachment(attachment: Attachment): Promise<IngestResult | null> {
    if (!attachment.content) {
      return null;
    }

    if (attachment.type !== "file") {
      return null;
    }

    const mimeType = attachment.mimeType || "";

    // Handle PDF files - extract text from base64 content
    if (mimeType === "application/pdf") {
      try {
        console.log(`Processing PDF file: ${attachment.filename}`);
        const extractedText = await chunkingService.extractPdfText(attachment.content);
        
        if (!extractedText || extractedText.trim().length === 0) {
          console.log(`No text extracted from PDF: ${attachment.filename}`);
          return null;
        }

        return this.ingestDocument(
          extractedText,
          attachment.id,
          attachment.filename,
          mimeType
        );
      } catch (error) {
        console.error(`Failed to process PDF ${attachment.filename}:`, error);
        return {
          documentId: `doc-${Date.now()}`,
          chunksCreated: 0,
          success: false,
          error: error instanceof Error ? error.message : "PDF extraction failed",
        };
      }
    }

    // Check if mime type supports text extraction
    if (!chunkingService.supportsTextExtraction(mimeType)) {
      console.log(`Skipping unsupported file type: ${attachment.filename} (${mimeType})`);
      return null;
    }

    return this.ingestDocument(
      attachment.content,
      attachment.id,
      attachment.filename,
      mimeType || undefined
    );
  }
}

export const ragService = new RAGService();
