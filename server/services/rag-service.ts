/**
 * =============================================================================
 * MEOWSTIK - RAG SERVICE
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
import { getVectorStore, type VectorStoreAdapter, type VectorDocument } from "./vector-store";
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
  private vectorStore: VectorStoreAdapter | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the vector store adapter (lazy initialization)
   * This is called automatically on first use.
   */
  private async ensureInitialized(): Promise<VectorStoreAdapter> {
    if (this.vectorStore) {
      return this.vectorStore;
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          this.vectorStore = await getVectorStore();
          console.log(`[RAG] Vector store initialized: ${this.vectorStore.name}`);
        } catch (error) {
          console.error("[RAG] Failed to initialize vector store:", error);
          throw error;
        }
      })();
    }

    await this.initPromise;
    return this.vectorStore!;
  }

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

      // Initialize vector store for semantic search
      const vectorStore = await this.ensureInitialized();

      // Prepare vector documents for batch upsert
      const vectorDocs: VectorDocument[] = [];

      for (let i = 0; i < chunks.length; i++) {
        // Store in PostgreSQL for persistence
        const savedChunk = await storage.createDocumentChunk({
          documentId,
          attachmentId,
          chunkIndex: chunks[i].metadata.chunkIndex,
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: chunks[i].metadata,
        });

        // Prepare for vector store (semantic search)
        vectorDocs.push({
          id: savedChunk.id.toString(),
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: {
            ...chunks[i].metadata,
            documentId,
            attachmentId,
            chunkIndex: chunks[i].metadata.chunkIndex,
            source: "document",
          },
        });
      }

      // Batch upsert to vector store for efficient semantic search
      if (vectorDocs.length > 0) {
        await vectorStore.upsertBatch(vectorDocs);
        console.log(`[RAG] Upserted ${vectorDocs.length} chunks to vector store`);
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
   * Retrieve relevant chunks for a query using the vector store
   * 
   * TEACHING NOTES:
   * ---------------
   * This method now uses the modular vector store for efficient semantic search.
   * The vector store uses optimized algorithms (IVFFlat, HNSW, etc.) instead
   * of brute-force comparison of all chunks.
   */
  async retrieve(
    query: string,
    topK: number = 5,
    threshold: number = 0.5
  ): Promise<RetrievalResult> {
    try {
      // Get embedding for the query
      const queryEmbedding = await embeddingService.embed(query);

      // Use vector store for efficient similarity search
      const vectorStore = await this.ensureInitialized();
      
      const searchResults = await vectorStore.search(queryEmbedding.embedding, {
        topK,
        threshold,
      });

      // If vector store returns no results, try legacy fallback
      // This handles cases where vector store index is sparse or threshold is high
      if (searchResults.length === 0) {
        console.log("[RAG] Vector store returned no results, trying legacy fallback");
        return this.retrieveLegacy(query, topK, threshold);
      }

      // Fetch full chunk data from PostgreSQL using the IDs from vector store
      const chunks: DocumentChunk[] = [];
      const scores: number[] = [];

      // Cache the chunk list to avoid fetching multiple times
      const chunkList = await storage.getAllDocumentChunks();
      
      for (const result of searchResults) {
        // Try to fetch full chunk from storage using document.id
        const chunkIdStr = result.document.id;
        const chunk = chunkList.find(c => String(c.id) === chunkIdStr);
        if (chunk) {
          chunks.push(chunk);
          scores.push(result.score);
        }
      }

      return { chunks, scores };
    } catch (error) {
      console.error("Retrieval error:", error);
      // Fallback to legacy method if vector store fails
      return this.retrieveLegacy(query, topK, threshold);
    }
  }

  /**
   * Legacy retrieval method (loads all chunks - less efficient)
   * Used as fallback if vector store is unavailable
   */
  private async retrieveLegacy(
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
          if (Array.isArray(c.embedding)) return true;
          if (typeof c.embedding === 'object' && 'values' in c.embedding && Array.isArray((c.embedding as any).values)) return true;
          return false;
        })
        .map((c) => {
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
      console.error("Legacy retrieval error:", error);
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

  /**
   * Ingest a conversation message for RAG recall
   * This allows the AI to remember important facts from earlier in conversations
   * 
   * @param userId - Optional user ID for authenticated users. Guest messages use "guest" bucket.
   */
  async ingestMessage(
    content: string,
    chatId: string,
    messageId: string,
    role: "user" | "ai",
    timestamp?: Date,
    userId?: string | null
  ): Promise<IngestResult | null> {
    // Skip very short messages (less than 20 chars) - not worth indexing
    if (!content || content.trim().length < 20) {
      return null;
    }

    // Skip messages that are just greetings or acknowledgments
    const trivialPatterns = /^(hi|hello|hey|thanks|ok|okay|yes|no|sure|got it|understood)[\s.!?]*$/i;
    if (trivialPatterns.test(content.trim())) {
      return null;
    }

    const documentId = `msg-${chatId}-${messageId}`;
    const filename = `conversation-${role}-${messageId}`;

    try {
      // Use sentence-based chunking for conversation messages
      const chunks = await chunkingService.chunkDocument(
        content,
        documentId,
        filename,
        "text/plain",
        { strategy: "sentence", maxChunkSize: 500, overlap: 50 }
      );

      if (chunks.length === 0) {
        return null;
      }

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);

      // Initialize vector store for semantic search
      const vectorStore = await this.ensureInitialized();

      // Prepare vector documents for batch upsert
      const vectorDocs: VectorDocument[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkMetadata = {
          ...chunks[i].metadata,
          chatId,
          messageId,
          role,
          timestamp: timestamp?.toISOString() || new Date().toISOString(),
          type: "conversation",
          userId: userId || "guest",
          isVerified: !!userId,
          source: "conversation",
        };

        // Store in PostgreSQL for persistence
        // Note: attachmentId is null for message-based chunks (not from file attachments)
        const savedChunk = await storage.createDocumentChunk({
          documentId,
          attachmentId: null,
          chunkIndex: chunks[i].metadata.chunkIndex,
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: chunkMetadata,
        });

        // Prepare for vector store (semantic search)
        vectorDocs.push({
          id: savedChunk.id.toString(),
          content: chunks[i].content,
          embedding: embeddings[i].embedding,
          metadata: chunkMetadata,
        });
      }

      // Batch upsert to vector store for efficient semantic search
      if (vectorDocs.length > 0) {
        await vectorStore.upsertBatch(vectorDocs);
      }

      console.log(`[RAG] Ingested ${role} message ${messageId}: ${chunks.length} chunks (vector store: ${vectorStore.name})`);

      return {
        documentId,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      console.error(`[RAG] Message ingestion error for ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Build conversation context by retrieving relevant past messages
   * 
   * @param userId - Optional user ID. If provided, only retrieves verified user data.
   *                 If null/undefined, retrieves only guest bucket data.
   */
  async buildConversationContext(query: string, chatId?: string, topK: number = 5, userId?: string | null): Promise<RAGContext> {
    const { chunks, scores } = await this.retrieve(query, topK * 2, 0.4);

    // Pair chunks with their scores and filter to conversation chunks from the same chat
    const pairedChunks = chunks.map((chunk, index) => ({
      chunk,
      score: scores[index],
    }));

    // Filter to conversation chunks - CRITICAL: scope by userId to prevent cross-user data leakage
    const conversationPairs = pairedChunks.filter(({ chunk }) => {
      const meta = chunk.metadata as { type?: string; chatId?: string; userId?: string } | null;
      const isConversation = meta?.type === "conversation";
      const isSameChat = !chatId || meta?.chatId === chatId;
      
      // Data isolation: only return chunks belonging to the same user
      // Authenticated users only see their own verified data
      // Guests only see guest bucket data (and only from same chat)
      const chunkUserId = meta?.userId || "guest";
      const requestUserId = userId || "guest";
      const isSameUser = chunkUserId === requestUserId;
      
      return isConversation && isSameChat && isSameUser;
    }).slice(0, topK);

    const relevantChunks = conversationPairs.map(({ chunk, score }) => {
      const meta = chunk.metadata as { role?: string; chatId?: string; timestamp?: string } | null;
      const role = meta?.role || "unknown";
      const time = meta?.timestamp ? new Date(meta.timestamp).toLocaleDateString() : "";
      return `[Previous ${role} message${time ? ` from ${time}` : ""}, relevance: ${score.toFixed(2)}]\n${chunk.content}`;
    });

    const sources = conversationPairs.map(({ chunk }) => {
      const meta = chunk.metadata as { chatId?: string; messageId?: string } | null;
      return {
        documentId: chunk.documentId,
        filename: `message-${meta?.messageId || "unknown"}`,
        chunkIndex: chunk.chunkIndex,
      };
    });

    return { relevantChunks, sources };
  }

  /**
   * Format conversation context for prompt augmentation
   */
  formatConversationContextForPrompt(context: RAGContext): string {
    if (context.relevantChunks.length === 0) {
      return "";
    }

    return `
## Recalled Conversation History

The following excerpts from earlier in our conversations may be relevant:

${context.relevantChunks.join("\n\n---\n\n")}

Use this recalled context to maintain continuity and remember important facts the user has shared.
`;
  }
}

export const ragService = new RAGService();
