/**
 * =============================================================================
 * NEBULA CHAT - DOCUMENT CHUNKING SERVICE
 * =============================================================================
 * 
 * Splits documents into semantic chunks for RAG processing.
 * Supports various document types and chunking strategies.
 * 
 * CHUNKING STRATEGIES:
 * - Paragraph-based: Split on double newlines
 * - Sentence-based: Split on sentence boundaries
 * - Fixed-size: Split into fixed token counts with overlap
 * - Semantic: Split on topic boundaries (more advanced)
 * =============================================================================
 */

// pdf-parse is loaded dynamically in extractPdfText to handle ESM/CJS compatibility

export interface ChunkMetadata {
  documentId: string;
  filename: string;
  mimeType?: string;
  chunkIndex: number;
  totalChunks: number;
  startOffset: number;
  endOffset: number;
  strategy: ChunkingStrategy;
}

export interface DocumentChunkResult {
  content: string;
  metadata: ChunkMetadata;
}

export type ChunkingStrategy = "paragraph" | "sentence" | "fixed" | "semantic";

export interface ChunkingOptions {
  strategy?: ChunkingStrategy;
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  strategy: "paragraph",
  maxChunkSize: 1000,
  minChunkSize: 100,
  overlap: 50,
};

export class ChunkingService {
  /**
   * Chunk a document into semantic pieces
   */
  async chunkDocument(
    content: string,
    documentId: string,
    filename: string,
    mimeType?: string,
    options: ChunkingOptions = {}
  ): Promise<DocumentChunkResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    let rawChunks: string[];

    switch (opts.strategy) {
      case "paragraph":
        rawChunks = this.chunkByParagraph(content, opts);
        break;
      case "sentence":
        rawChunks = this.chunkBySentence(content, opts);
        break;
      case "fixed":
        rawChunks = this.chunkByFixedSize(content, opts);
        break;
      case "semantic":
        rawChunks = this.chunkSemantically(content, opts);
        break;
      default:
        rawChunks = this.chunkByParagraph(content, opts);
    }

    const chunks: DocumentChunkResult[] = [];
    let currentOffset = 0;

    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const startOffset = content.indexOf(chunk, currentOffset);
      const endOffset = startOffset + chunk.length;

      chunks.push({
        content: chunk.trim(),
        metadata: {
          documentId,
          filename,
          mimeType,
          chunkIndex: i,
          totalChunks: rawChunks.length,
          startOffset,
          endOffset,
          strategy: opts.strategy,
        },
      });

      currentOffset = endOffset;
    }

    return chunks.filter((c) => c.content.length >= opts.minChunkSize);
  }

  /**
   * Split by paragraphs (double newlines)
   */
  private chunkByParagraph(
    content: string,
    opts: Required<ChunkingOptions>
  ): string[] {
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim());
    return this.mergeSmallChunks(paragraphs, opts);
  }

  /**
   * Split by sentences
   */
  private chunkBySentence(
    content: string,
    opts: Required<ChunkingOptions>
  ): string[] {
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim());
    return this.mergeSmallChunks(sentences, opts);
  }

  /**
   * Split by fixed character count with overlap
   */
  private chunkByFixedSize(
    content: string,
    opts: Required<ChunkingOptions>
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + opts.maxChunkSize, content.length);

      if (end < content.length) {
        const lastSpace = content.lastIndexOf(" ", end);
        if (lastSpace > start + opts.minChunkSize) {
          end = lastSpace;
        }
      }

      chunks.push(content.slice(start, end));
      start = end - opts.overlap;
      if (start < 0) start = 0;
    }

    return chunks;
  }

  /**
   * Semantic chunking based on topic shifts
   * Uses markdown headers and topic indicators
   */
  private chunkSemantically(
    content: string,
    opts: Required<ChunkingOptions>
  ): string[] {
    const headerPattern = /^#{1,6}\s+.+$/gm;
    const parts = content.split(headerPattern);
    const headers = content.match(headerPattern) || [];

    const chunks: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      let chunk = parts[i].trim();
      if (i < headers.length) {
        chunk = headers[i] + "\n\n" + chunk;
      }
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    return this.mergeSmallChunks(chunks, opts);
  }

  /**
   * Merge chunks that are too small
   */
  private mergeSmallChunks(
    chunks: string[],
    opts: Required<ChunkingOptions>
  ): string[] {
    const merged: string[] = [];
    let current = "";

    for (const chunk of chunks) {
      if (current.length + chunk.length <= opts.maxChunkSize) {
        current = current ? current + "\n\n" + chunk : chunk;
      } else {
        if (current) {
          merged.push(current);
        }
        current = chunk;
      }
    }

    if (current) {
      merged.push(current);
    }

    return merged;
  }

  /**
   * Extract text from various document types
   */
  extractText(content: string, mimeType?: string): string {
    if (!mimeType) return content;

    if (mimeType.startsWith("text/")) {
      return content;
    }

    if (mimeType === "application/json") {
      try {
        const obj = JSON.parse(content);
        return JSON.stringify(obj, null, 2);
      } catch {
        return content;
      }
    }

    return content;
  }

  /**
   * Extract text from PDF documents
   * @param base64Content - Base64 encoded PDF content
   * @returns Extracted text from the PDF
   */
  async extractPdfText(base64Content: string): Promise<string> {
    try {
      const buffer = Buffer.from(base64Content, "base64");
      // Use dynamic import for pdf-parse which handles ESM/CJS compatibility
      const pdfParse = await import("pdf-parse");
      const parser = pdfParse.default || pdfParse;
      const data = await parser(buffer);
      return data.text;
    } catch (error) {
      console.error("PDF extraction error:", error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Check if a mime type supports text extraction
   */
  supportsTextExtraction(mimeType: string): boolean {
    const supportedTypes = [
      "text/",
      "application/json",
      "application/xml",
      "application/javascript",
      "application/pdf",
    ];
    return supportedTypes.some(prefix => mimeType.startsWith(prefix));
  }
}

export const chunkingService = new ChunkingService();
