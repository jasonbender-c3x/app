/**
 * =============================================================================
 * MEOWSTIK - CODEBASE ANALYSIS AGENT
 * =============================================================================
 * 
 * Autonomous agent that crawls a codebase, extracts code entities (functions,
 * classes, variables), ingests files into RAG, and generates documentation.
 * 
 * PIPELINE:
 * ---------
 * 1. Recursive file discovery
 * 2. Code entity extraction (AST-lite parsing)
 * 3. RAG ingestion for semantic search
 * 4. Glossary generation
 * 5. Documentation synthesis
 * =============================================================================
 */

import * as fs from "fs";
import * as path from "path";
import { ragService } from "./rag-service";
import { embeddingService } from "./embedding-service";

// Supported file extensions for code analysis
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".css", ".scss", ".less", ".html", ".vue", ".svelte",
  ".json", ".yaml", ".yml", ".toml", ".md", ".mdx",
  ".sql", ".sh", ".bash", ".zsh",
]);

// Directories to skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".cache", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", ".idea", ".vscode",
  "coverage", ".nyc_output", "tmp", ".tmp",
]);

export interface CodeEntity {
  name: string;
  type: "function" | "class" | "interface" | "type" | "const" | "variable" | "export" | "import";
  file: string;
  line: number;
  signature?: string;
  description?: string;
}

export interface FileAnalysis {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  entities: CodeEntity[];
  imports: string[];
  exports: string[];
  lineCount: number;
}

export interface AnalysisProgress {
  phase: "discovery" | "extraction" | "ingestion" | "glossary" | "documentation" | "complete";
  filesDiscovered: number;
  filesProcessed: number;
  entitiesFound: number;
  chunksIngested: number;
  currentFile?: string;
  errors: string[];
}

export interface AnalysisResult {
  rootPath: string;
  totalFiles: number;
  totalEntities: number;
  totalChunks: number;
  files: FileAnalysis[];
  glossary: Map<string, CodeEntity[]>;
  documentation: string;
  errors: string[];
  duration: number;
}

export class CodebaseAnalyzer {
  private progress: AnalysisProgress = {
    phase: "discovery",
    filesDiscovered: 0,
    filesProcessed: 0,
    entitiesFound: 0,
    chunksIngested: 0,
    errors: [],
  };

  private progressCallback?: (progress: AnalysisProgress) => void;

  /**
   * Set a callback to receive progress updates
   */
  onProgress(callback: (progress: AnalysisProgress) => void): void {
    this.progressCallback = callback;
  }

  private updateProgress(updates: Partial<AnalysisProgress>): void {
    this.progress = { ...this.progress, ...updates };
    this.progressCallback?.(this.progress);
  }

  /**
   * Analyze an entire codebase
   */
  async analyzeCodebase(rootPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const files: FileAnalysis[] = [];
    const glossary = new Map<string, CodeEntity[]>();
    const errors: string[] = [];

    try {
      // Phase 1: File Discovery
      this.updateProgress({ phase: "discovery" });
      const filePaths = await this.discoverFiles(rootPath);
      this.updateProgress({ filesDiscovered: filePaths.length });

      // Phase 2: Entity Extraction
      this.updateProgress({ phase: "extraction" });
      for (const filePath of filePaths) {
        try {
          this.updateProgress({ currentFile: filePath });
          const analysis = await this.analyzeFile(filePath, rootPath);
          files.push(analysis);

          // Add entities to glossary
          for (const entity of analysis.entities) {
            const existing = glossary.get(entity.name) || [];
            existing.push(entity);
            glossary.set(entity.name, existing);
          }

          this.updateProgress({
            filesProcessed: this.progress.filesProcessed + 1,
            entitiesFound: this.progress.entitiesFound + analysis.entities.length,
          });
        } catch (err) {
          const errorMsg = `Error analyzing ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errorMsg);
          this.updateProgress({ errors: [...this.progress.errors, errorMsg] });
        }
      }

      // Phase 3: RAG Ingestion
      this.updateProgress({ phase: "ingestion" });
      let totalChunks = 0;
      for (const file of files) {
        try {
          const result = await this.ingestFile(file);
          if (result) {
            totalChunks += result.chunksCreated;
            this.updateProgress({ chunksIngested: totalChunks });
          }
        } catch (err) {
          const errorMsg = `Error ingesting ${file.relativePath}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errorMsg);
        }
      }

      // Phase 4: Glossary Generation
      this.updateProgress({ phase: "glossary" });
      // Glossary is already built during extraction

      // Phase 5: Documentation Generation
      this.updateProgress({ phase: "documentation" });
      const documentation = this.generateDocumentation(rootPath, files, glossary);

      this.updateProgress({ phase: "complete" });

      return {
        rootPath,
        totalFiles: files.length,
        totalEntities: this.progress.entitiesFound,
        totalChunks: totalChunks,
        files,
        glossary,
        documentation,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const errorMsg = `Fatal error: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(errorMsg);
      return {
        rootPath,
        totalFiles: files.length,
        totalEntities: this.progress.entitiesFound,
        totalChunks: this.progress.chunksIngested,
        files,
        glossary,
        documentation: "",
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Recursively discover all code files
   */
  private async discoverFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          const subFiles = await this.discoverFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Analyze a single file for code entities
   */
  private async analyzeFile(filePath: string, rootPath: string): Promise<FileAnalysis> {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const relativePath = path.relative(rootPath, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const lines = content.split("\n");

    const entities: CodeEntity[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    // TypeScript/JavaScript analysis
    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      this.extractTsJsEntities(content, lines, relativePath, entities, imports, exports);
    }
    // Python analysis
    else if (ext === ".py") {
      this.extractPythonEntities(content, lines, relativePath, entities, imports, exports);
    }
    // Generic extraction for other file types
    else {
      this.extractGenericEntities(content, lines, relativePath, ext, entities);
    }

    return {
      path: filePath,
      relativePath,
      extension: ext,
      size: content.length,
      entities,
      imports,
      exports,
      lineCount: lines.length,
    };
  }

  /**
   * Extract entities from TypeScript/JavaScript files
   */
  private extractTsJsEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[],
    imports: string[],
    exports: string[]
  ): void {
    // Function patterns
    const functionPatterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/gm,
      /(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
    ];

    // Class pattern
    const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/gm;

    // Interface pattern
    const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?/gm;

    // Type pattern
    const typePattern = /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=/gm;

    // Const/let/var exports
    const constPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/gm;

    // Import pattern
    const importPattern = /import\s+(?:{[^}]+}|[\w*]+(?:\s+as\s+\w+)?|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/gm;

    // Export pattern
    const exportPattern = /export\s+(?:default\s+)?(?:{([^}]+)}|(\w+))/gm;

    // Process each pattern
    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (name && !this.isCommonKeyword(name)) {
          const line = this.getLineNumber(content, match.index);
          entities.push({
            name,
            type: "function",
            file,
            line,
            signature: this.extractSignature(lines[line - 1] || ""),
          });
        }
      }
    }

    let match;

    // Classes
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "class",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    // Interfaces
    while ((match = interfacePattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "interface",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    // Types
    while ((match = typePattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "type",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    // Imports
    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Exports
    while ((match = exportPattern.exec(content)) !== null) {
      const exportedItems = match[1] || match[2];
      if (exportedItems) {
        exports.push(...exportedItems.split(",").map(s => s.trim()));
      }
    }
  }

  /**
   * Extract entities from Python files
   */
  private extractPythonEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[],
    imports: string[],
    exports: string[]
  ): void {
    // Function pattern
    const funcPattern = /^(?:async\s+)?def\s+(\w+)\s*\(/gm;

    // Class pattern
    const classPattern = /^class\s+(\w+)(?:\([^)]*\))?:/gm;

    // Import patterns
    const importPattern = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;

    let match;

    while ((match = funcPattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "function",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    while ((match = classPattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "class",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }
  }

  /**
   * Generic entity extraction for other file types
   */
  private extractGenericEntities(
    content: string,
    lines: string[],
    file: string,
    ext: string,
    entities: CodeEntity[]
  ): void {
    // For markdown, extract headers
    if (ext === ".md" || ext === ".mdx") {
      const headerPattern = /^(#{1,6})\s+(.+)$/gm;
      let match;
      while ((match = headerPattern.exec(content)) !== null) {
        entities.push({
          name: match[2].trim(),
          type: "export", // Using export as "section"
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // For JSON/YAML, extract top-level keys
    if (ext === ".json") {
      try {
        const obj = JSON.parse(content);
        Object.keys(obj).forEach((key, index) => {
          entities.push({
            name: key,
            type: "const",
            file,
            line: 1,
          });
        });
      } catch {}
    }
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split("\n").length;
  }

  /**
   * Extract function signature from line
   */
  private extractSignature(line: string): string {
    // Clean up and truncate
    const sig = line.trim().replace(/\{.*$/, "").trim();
    return sig.length > 100 ? sig.substring(0, 100) + "..." : sig;
  }

  /**
   * Check if name is a common JS/TS keyword to skip
   */
  private isCommonKeyword(name: string): boolean {
    const keywords = new Set([
      "if", "else", "for", "while", "do", "switch", "case", "break",
      "continue", "return", "throw", "try", "catch", "finally",
      "new", "delete", "typeof", "void", "this", "super",
      "true", "false", "null", "undefined", "NaN", "Infinity",
    ]);
    return keywords.has(name);
  }

  /**
   * Ingest a file into RAG for semantic search
   */
  private async ingestFile(file: FileAnalysis): Promise<{ chunksCreated: number } | null> {
    try {
      const content = await fs.promises.readFile(file.path, "utf-8");
      
      // Create a structured document for ingestion
      const structuredContent = this.createStructuredContent(file, content);
      
      const result = await ragService.ingestDocument(
        structuredContent,
        `codebase-${file.relativePath.replace(/[/\\]/g, "-")}`,
        file.relativePath,
        this.getMimeType(file.extension)
      );

      return { chunksCreated: result.chunksCreated };
    } catch (err) {
      console.error(`Failed to ingest ${file.relativePath}:`, err);
      return null;
    }
  }

  /**
   * Create structured content with entity metadata for better RAG
   */
  private createStructuredContent(file: FileAnalysis, rawContent: string): string {
    const entitySummary = file.entities.length > 0
      ? `\n\n## Code Entities\n${file.entities.map(e => `- ${e.type}: ${e.name} (line ${e.line})`).join("\n")}`
      : "";

    const importSummary = file.imports.length > 0
      ? `\n\n## Dependencies\n${file.imports.map(i => `- ${i}`).join("\n")}`
      : "";

    return `# File: ${file.relativePath}
Extension: ${file.extension}
Lines: ${file.lineCount}
${entitySummary}
${importSummary}

## Source Code
\`\`\`${file.extension.replace(".", "")}
${rawContent}
\`\`\``;
  }

  /**
   * Get MIME type for file extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      ".ts": "text/typescript",
      ".tsx": "text/typescript",
      ".js": "text/javascript",
      ".jsx": "text/javascript",
      ".py": "text/x-python",
      ".json": "application/json",
      ".md": "text/markdown",
      ".html": "text/html",
      ".css": "text/css",
      ".sql": "text/sql",
      ".yaml": "text/yaml",
      ".yml": "text/yaml",
    };
    return mimeTypes[ext] || "text/plain";
  }

  /**
   * Generate comprehensive documentation from analysis
   */
  private generateDocumentation(
    rootPath: string,
    files: FileAnalysis[],
    glossary: Map<string, CodeEntity[]>
  ): string {
    const totalEntities = Array.from(glossary.values()).reduce((sum, arr) => sum + arr.length, 0);

    // Group files by directory
    const byDir = new Map<string, FileAnalysis[]>();
    for (const file of files) {
      const dir = path.dirname(file.relativePath) || ".";
      const existing = byDir.get(dir) || [];
      existing.push(file);
      byDir.set(dir, existing);
    }

    // Build documentation
    let doc = `# Codebase Analysis Report

## Summary
- **Root Path:** ${rootPath}
- **Total Files:** ${files.length}
- **Total Code Entities:** ${totalEntities}
- **Unique Entity Names:** ${glossary.size}

## Directory Structure

`;

    // Add directory breakdown
    const sortedDirs = Array.from(byDir.keys()).sort();
    for (const dir of sortedDirs) {
      const dirFiles = byDir.get(dir)!;
      const entityCount = dirFiles.reduce((sum, f) => sum + f.entities.length, 0);
      doc += `### ${dir}/\n`;
      doc += `- ${dirFiles.length} files, ${entityCount} entities\n`;
      for (const f of dirFiles) {
        doc += `  - \`${path.basename(f.relativePath)}\` (${f.entities.length} entities)\n`;
      }
      doc += "\n";
    }

    // Add glossary of entities
    doc += `## Entity Glossary

`;

    const sortedEntities = Array.from(glossary.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 100); // Top 100 entities

    for (const [name, occurrences] of sortedEntities) {
      const types = Array.from(new Set(occurrences.map(o => o.type))).join(", ");
      const locations = occurrences.map(o => `${o.file}:${o.line}`).join(", ");
      doc += `### ${name}\n`;
      doc += `- **Type(s):** ${types}\n`;
      doc += `- **Locations:** ${locations}\n\n`;
    }

    return doc;
  }

  /**
   * Get current progress
   */
  getProgress(): AnalysisProgress {
    return { ...this.progress };
  }
}

export const codebaseAnalyzer = new CodebaseAnalyzer();
