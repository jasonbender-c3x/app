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
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".scala",
  ".c", ".h", ".cpp", ".hpp", ".cc", ".hh",  // C/C++ support
  ".cs",  // C# support
  ".php", ".phtml",  // PHP support
  ".swift",  // Swift support
  ".vb", ".vbs", ".bas",  // Visual Basic support
  ".lua",  // Lua support
  ".r", ".R",  // R support
  ".pl", ".pm",  // Perl support
  ".dart",  // Dart/Flutter support
  ".groovy", ".gradle",  // Groovy support
  ".m", ".mat",  // MATLAB/Octave support
  ".css", ".scss", ".less", ".html", ".vue", ".svelte",
  ".json", ".yaml", ".yml", ".toml", ".md", ".mdx",
  ".sql", ".sh", ".bash", ".zsh",
]);

// Dependency/library manifest files
const DEPENDENCY_FILES = new Set([
  "package.json", "package-lock.json",  // npm/Node.js
  "requirements.txt", "Pipfile", "pyproject.toml", "setup.py",  // Python
  "Cargo.toml", "Cargo.lock",  // Rust
  "go.mod", "go.sum",  // Go
  "Gemfile", "Gemfile.lock",  // Ruby
  "composer.json", "composer.lock",  // PHP
  "build.gradle", "build.gradle.kts", "pom.xml",  // Java/Kotlin
  "Package.swift",  // Swift
  "pubspec.yaml",  // Dart/Flutter
  "*.csproj", "*.fsproj", "packages.config",  // .NET
]);

// Directories to skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".cache", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", ".idea", ".vscode",
  "coverage", ".nyc_output", "tmp", ".tmp",
]);

export interface CodeEntity {
  name: string;
  type: "function" | "class" | "interface" | "type" | "const" | "variable" | "export" | "import" | "struct" | "typedef" | "macro" | "enum";
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
   * @param rootPath - Root directory to analyze
   * @param skipIngestion - Skip RAG ingestion (useful for external codebases without DB attachments)
   */
  async analyzeCodebase(rootPath: string, skipIngestion = false): Promise<AnalysisResult> {
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

      // Phase 3: RAG Ingestion (skip for external codebases)
      let totalChunks = 0;
      if (!skipIngestion) {
        this.updateProgress({ phase: "ingestion" });
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
    // C/C++ analysis
    else if ([".c", ".h", ".cpp", ".hpp", ".cc", ".hh"].includes(ext)) {
      this.extractCEntities(content, lines, relativePath, entities, imports);
    }
    // Bash/Shell analysis
    else if ([".sh", ".bash", ".zsh"].includes(ext)) {
      this.extractBashEntities(content, lines, relativePath, entities);
    }
    // PHP analysis
    else if ([".php", ".phtml"].includes(ext)) {
      this.extractPhpEntities(content, lines, relativePath, entities);
    }
    // Java/Kotlin analysis
    else if ([".java", ".kt", ".scala"].includes(ext)) {
      this.extractJavaEntities(content, lines, relativePath, entities);
    }
    // Go analysis
    else if (ext === ".go") {
      this.extractGoEntities(content, lines, relativePath, entities);
    }
    // Ruby analysis
    else if (ext === ".rb") {
      this.extractRubyEntities(content, lines, relativePath, entities);
    }
    // Rust analysis
    else if (ext === ".rs") {
      this.extractRustEntities(content, lines, relativePath, entities);
    }
    // C# analysis
    else if (ext === ".cs") {
      this.extractCSharpEntities(content, lines, relativePath, entities);
    }
    // Swift analysis
    else if (ext === ".swift") {
      this.extractSwiftEntities(content, lines, relativePath, entities);
    }
    // Visual Basic analysis
    else if ([".vb", ".vbs", ".bas"].includes(ext)) {
      this.extractVBEntities(content, lines, relativePath, entities);
    }
    // Lua analysis
    else if (ext === ".lua") {
      this.extractLuaEntities(content, lines, relativePath, entities);
    }
    // R analysis
    else if ([".r", ".R"].includes(ext)) {
      this.extractREntities(content, lines, relativePath, entities);
    }
    // Perl analysis
    else if ([".pl", ".pm"].includes(ext)) {
      this.extractPerlEntities(content, lines, relativePath, entities);
    }
    // Dart analysis
    else if (ext === ".dart") {
      this.extractDartEntities(content, lines, relativePath, entities);
    }
    // Groovy analysis
    else if ([".groovy", ".gradle"].includes(ext)) {
      this.extractGroovyEntities(content, lines, relativePath, entities);
    }
    // MATLAB/Octave analysis
    else if ([".m", ".mat"].includes(ext)) {
      this.extractMatlabEntities(content, lines, relativePath, entities);
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
   * Check if a position in the content is inside a comment (single-line // or block)
   */
  private isInsideComment(content: string, pos: number): boolean {
    // Check for single-line comment: find start of line, look for //
    let lineStart = pos;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart--;
    const lineToPos = content.slice(lineStart, pos);
    if (lineToPos.includes('//')) return true;
    
    // Check for multi-line comment: look back for /* without closing */
    const beforePos = content.slice(0, pos);
    const lastBlockStart = beforePos.lastIndexOf('/*');
    if (lastBlockStart !== -1) {
      const lastBlockEnd = beforePos.lastIndexOf('*/');
      if (lastBlockEnd < lastBlockStart) return true; // Inside /* ... */
    }
    return false;
  }

  /**
   * Extract struct names with brace-balanced requires clause support.
   * Uses a tokenizer approach to handle arbitrary nesting depth.
   */
  private extractCStructs(
    content: string,
    file: string,
    entities: CodeEntity[]
  ): void {
    // Find all struct keyword positions (not preceded by "enum ")
    const structKeyword = /(?<!enum\s)\bstruct\b/g;
    let structMatch;
    
    while ((structMatch = structKeyword.exec(content)) !== null) {
      // Skip structs in comments
      if (this.isInsideComment(content, structMatch.index)) continue;
      
      const startIdx = structMatch.index + 6; // After "struct"
      let idx = startIdx;
      
      // Skip whitespace and attributes before name
      while (idx < content.length) {
        // Skip whitespace
        while (idx < content.length && /\s/.test(content[idx])) idx++;
        
        // Skip C++11 [[...]] attributes with brace balancing
        if (content.slice(idx, idx + 2) === '[[') {
          let bracketDepth = 0;
          while (idx < content.length) {
            if (content[idx] === '[') bracketDepth++;
            if (content[idx] === ']') bracketDepth--;
            idx++;
            if (bracketDepth === 0) break;
          }
          continue;
        }
        
        // Skip __attribute__((...))
        if (content.slice(idx).startsWith('__attribute__')) {
          idx += 13; // Skip "__attribute__"
          while (idx < content.length && /\s/.test(content[idx])) idx++;
          if (content.slice(idx, idx + 2) === '((') {
            let parenDepth = 0;
            while (idx < content.length) {
              if (content[idx] === '(') parenDepth++;
              if (content[idx] === ')') parenDepth--;
              idx++;
              if (parenDepth === 0) break;
            }
          }
          continue;
        }
        
        // Skip alignas(...), __declspec(...), __packed, __aligned(...)
        const skipPatterns = [/^alignas\s*\([^)]*\)/, /^__declspec\s*\([^)]*(?:\([^)]*\)[^)]*)*\)/, /^__packed/, /^__aligned\s*\([^)]*\)/];
        let skipped = false;
        for (const pat of skipPatterns) {
          const m = content.slice(idx).match(pat);
          if (m) {
            idx += m[0].length;
            skipped = true;
            break;
          }
        }
        if (skipped) continue;
        
        break; // No more attributes to skip
      }
      
      // Now we should be at the struct name
      const nameMatch = content.slice(idx).match(/^(\w+)/);
      if (!nameMatch) continue;
      const structName = nameMatch[1];
      if (this.isCKeyword(structName)) continue;
      idx += structName.length;
      
      // Skip specifiers, attributes, inheritance, and requires clause until we find struct body {
      // We need to track if we're inside a requires clause (brace-balanced) vs finding the body
      let braceDepth = 0;
      let foundBody = false;
      while (idx < content.length && !foundBody) {
        // Skip whitespace
        while (idx < content.length && /\s/.test(content[idx])) idx++;
        if (idx >= content.length) break;
        
        const ch = content[idx];
        
        // Check for "requires" keyword - skip its clause with brace balancing
        if (content.slice(idx).match(/^requires\b/)) {
          idx += 8; // Skip "requires"
          // Skip whitespace
          while (idx < content.length && /\s/.test(content[idx])) idx++;
          
          // If followed by {, balance the requires clause braces (compound requirement)
          if (content[idx] === '{') {
            let reqBraceDepth = 0;
            while (idx < content.length) {
              if (content[idx] === '{') reqBraceDepth++;
              if (content[idx] === '}') reqBraceDepth--;
              idx++;
              if (reqBraceDepth === 0) break;
            }
          } else if (content.slice(idx).match(/^requires\b/)) {
            // "requires requires { ... }" pattern - skip both requires and balance braces
            idx += 8; // Skip second "requires"
            while (idx < content.length && /\s/.test(content[idx])) idx++;
            if (content[idx] === '{') {
              let reqBraceDepth = 0;
              while (idx < content.length) {
                if (content[idx] === '{') reqBraceDepth++;
                if (content[idx] === '}') reqBraceDepth--;
                idx++;
                if (reqBraceDepth === 0) break;
              }
            }
          }
          // For simple requires (requires Concept<T>), the { after it is the struct body
          // so we just continue to let the main loop handle it
          continue;
        }
        
        if (ch === '{') {
          if (braceDepth === 0) {
            foundBody = true;
            break;
          }
          braceDepth++;
        } else if (ch === '}') {
          braceDepth--;
        } else if (ch === ';' && braceDepth === 0) {
          // Forward declaration or requires-only (no body)
          break;
        }
        idx++;
      }
      
      if (foundBody) {
        entities.push({
          name: structName,
          type: "struct",
          file,
          line: this.getLineNumber(content, structMatch.index),
        });
      }
    }
  }

  /**
   * Extract entities from PHP files
   */
  private extractPhpEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function pattern: function name(...) or public/private/protected function name(...)
    const functionPattern = /(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(/gm;
    
    // Class pattern: class Name or abstract class Name
    const classPattern = /(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/gm;
    
    // Interface pattern
    const interfacePattern = /interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?/gm;
    
    // Trait pattern
    const traitPattern = /trait\s+(\w+)/gm;

    let match;

    // Extract functions
    while ((match = functionPattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "function",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    // Extract classes
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "class",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    // Extract interfaces
    while ((match = interfacePattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "interface",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }

    // Extract traits (as classes for now)
    while ((match = traitPattern.exec(content)) !== null) {
      entities.push({
        name: match[1],
        type: "class",
        file,
        line: this.getLineNumber(content, match.index),
      });
    }
  }

  /**
   * Extract entities from Java/Kotlin/Scala files
   */
  private extractJavaEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Class pattern
    const classPattern = /(?:public|private|protected)?\s*(?:abstract|final|static)?\s*class\s+(\w+)/gm;
    // Interface pattern
    const interfacePattern = /(?:public|private|protected)?\s*interface\s+(\w+)/gm;
    // Method pattern
    const methodPattern = /(?:public|private|protected)?\s*(?:static|final|abstract|synchronized)?\s*(?:<[\w<>,\s]+>\s+)?(?:\w+(?:<[\w<>,\s?]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/gm;
    // Enum pattern
    const enumPattern = /(?:public|private|protected)?\s*enum\s+(\w+)/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = interfacePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "interface", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = methodPattern.exec(content)) !== null) {
      if (!["if", "while", "for", "switch", "catch"].includes(match[1])) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = enumPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "enum", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Go files
   */
  private extractGoEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function pattern: func name(...) or func (receiver) name(...)
    const funcPattern = /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/gm;
    // Type/struct pattern: type Name struct/interface
    const typePattern = /type\s+(\w+)\s+(?:struct|interface)/gm;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = typePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "struct", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Ruby files
   */
  private extractRubyEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Class pattern
    const classPattern = /class\s+(\w+)(?:\s*<\s*\w+)?/gm;
    // Module pattern
    const modulePattern = /module\s+(\w+)/gm;
    // Method pattern: def name or def self.name
    const methodPattern = /def\s+(?:self\.)?(\w+[?!=]?)/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = modulePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = methodPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Rust files
   */
  private extractRustEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function pattern: fn name or pub fn name
    const fnPattern = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm;
    // Struct pattern
    const structPattern = /(?:pub\s+)?struct\s+(\w+)/gm;
    // Enum pattern
    const enumPattern = /(?:pub\s+)?enum\s+(\w+)/gm;
    // Trait pattern
    const traitPattern = /(?:pub\s+)?trait\s+(\w+)/gm;
    // Impl pattern
    const implPattern = /impl(?:<[^>]+>)?\s+(?:(\w+)\s+for\s+)?(\w+)/gm;

    let match;
    while ((match = fnPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = structPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "struct", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = enumPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "enum", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = traitPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "interface", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from C# files
   */
  private extractCSharpEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Class pattern
    const classPattern = /(?:public|private|protected|internal)?\s*(?:abstract|sealed|static|partial)?\s*class\s+(\w+)/gm;
    // Interface pattern
    const interfacePattern = /(?:public|private|protected|internal)?\s*interface\s+(\w+)/gm;
    // Struct pattern
    const structPattern = /(?:public|private|protected|internal)?\s*(?:readonly)?\s*struct\s+(\w+)/gm;
    // Method pattern
    const methodPattern = /(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract|async)?\s*(?:\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:where\s+[\w:\s,]+)?\s*\{/gm;
    // Enum pattern
    const enumPattern = /(?:public|private|protected|internal)?\s*enum\s+(\w+)/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = interfacePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "interface", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = structPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "struct", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = methodPattern.exec(content)) !== null) {
      if (!["if", "while", "for", "switch", "catch", "using", "lock"].includes(match[1])) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = enumPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "enum", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Swift files
   */
  private extractSwiftEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Class pattern
    const classPattern = /(?:public|private|internal|open|fileprivate)?\s*(?:final)?\s*class\s+(\w+)/gm;
    // Struct pattern
    const structPattern = /(?:public|private|internal|fileprivate)?\s*struct\s+(\w+)/gm;
    // Protocol pattern
    const protocolPattern = /(?:public|private|internal|fileprivate)?\s*protocol\s+(\w+)/gm;
    // Enum pattern
    const enumPattern = /(?:public|private|internal|fileprivate)?\s*enum\s+(\w+)/gm;
    // Function pattern
    const funcPattern = /(?:public|private|internal|open|fileprivate)?\s*(?:static|class|override)?\s*func\s+(\w+)/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = structPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "struct", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = protocolPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "interface", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = enumPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "enum", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = funcPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Visual Basic files
   */
  private extractVBEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // VB keywords to skip
    const vbKeywords = new Set(["public", "private", "friend", "protected", "end", "new", "get", "set", "let"]);
    
    // Class pattern - require Class keyword
    const classPattern = /\bClass\s+(\w+)/gim;
    // Module pattern
    const modulePattern = /\bModule\s+(\w+)/gim;
    // Interface pattern
    const interfacePattern = /\bInterface\s+(\w+)/gim;
    // Sub pattern
    const subPattern = /\bSub\s+(\w+)/gim;
    // Function pattern
    const funcPattern = /\bFunction\s+(\w+)/gim;
    // Property pattern
    const propPattern = /\bProperty\s+(\w+)/gim;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      if (!vbKeywords.has(match[1].toLowerCase())) {
        entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = modulePattern.exec(content)) !== null) {
      if (!vbKeywords.has(match[1].toLowerCase())) {
        entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = interfacePattern.exec(content)) !== null) {
      if (!vbKeywords.has(match[1].toLowerCase())) {
        entities.push({ name: match[1], type: "interface", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = subPattern.exec(content)) !== null) {
      if (!vbKeywords.has(match[1].toLowerCase())) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = funcPattern.exec(content)) !== null) {
      if (!vbKeywords.has(match[1].toLowerCase())) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = propPattern.exec(content)) !== null) {
      if (!vbKeywords.has(match[1].toLowerCase())) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
  }

  /**
   * Extract entities from Lua files
   */
  private extractLuaEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function patterns: function name() or local function name() or name = function()
    const funcPattern = /(?:local\s+)?function\s+(\w+(?:\.\w+)*)\s*\(/gm;
    const assignFuncPattern = /(\w+(?:\.\w+)*)\s*=\s*function\s*\(/gm;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = assignFuncPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from R files
   */
  private extractREntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function pattern: name <- function(...) or name = function(...)
    const funcPattern = /(\w+)\s*(?:<-|=)\s*function\s*\(/gm;
    // S4 class pattern: setClass("Name", ...)
    const classPattern = /setClass\s*\(\s*["'](\w+)["']/gm;
    // S3 method pattern: name.class <- function
    const methodPattern = /(\w+\.\w+)\s*(?:<-|=)\s*function\s*\(/gm;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Perl files
   */
  private extractPerlEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Subroutine pattern: sub name { or sub name :attr {
    const subPattern = /\bsub\s+(\w+)/gm;
    // Package pattern: package Name;
    const packagePattern = /\bpackage\s+([\w:]+)/gm;

    let match;
    while ((match = subPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = packagePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Dart files
   */
  private extractDartEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Class pattern
    const classPattern = /(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?(?:\s+with\s+[\w,\s]+)?/gm;
    // Mixin pattern
    const mixinPattern = /mixin\s+(\w+)(?:\s+on\s+[\w,\s]+)?/gm;
    // Extension pattern
    const extensionPattern = /extension\s+(\w+)\s+on/gm;
    // Enum pattern
    const enumPattern = /enum\s+(\w+)/gm;
    // Function pattern (top-level and methods)
    const funcPattern = /(?:static\s+)?(?:Future|Stream|void|int|double|String|bool|dynamic|var|\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:async\s*)?[{=]/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = mixinPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = extensionPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = enumPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "enum", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = funcPattern.exec(content)) !== null) {
      if (!["if", "while", "for", "switch", "catch"].includes(match[1])) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
  }

  /**
   * Extract entities from Groovy files
   */
  private extractGroovyEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Class pattern
    const classPattern = /(?:public|private|protected)?\s*(?:abstract)?\s*class\s+(\w+)/gm;
    // Interface pattern
    const interfacePattern = /(?:public|private|protected)?\s*interface\s+(\w+)/gm;
    // Trait pattern
    const traitPattern = /trait\s+(\w+)/gm;
    // Method pattern: def name(...) or ReturnType name(...)
    const methodPattern = /(?:def|void|int|String|boolean|Object|\w+)\s+(\w+)\s*\([^)]*\)\s*\{/gm;
    // Closure assignment: def name = { ... }
    const closurePattern = /(?:def|final)\s+(\w+)\s*=\s*\{/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = interfacePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "interface", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = traitPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = methodPattern.exec(content)) !== null) {
      if (!["if", "while", "for", "switch", "catch"].includes(match[1])) {
        entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
      }
    }
    while ((match = closurePattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from MATLAB/Octave files
   */
  private extractMatlabEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function pattern: function [outputs] = name(inputs) or function name(inputs)
    const funcPattern = /\bfunction\s+(?:\[[^\]]*\]\s*=\s*)?(\w+)\s*\(/gm;
    // Classdef pattern: classdef Name
    const classPattern = /\bclassdef\s+(?:\([^)]*\)\s+)?(\w+)/gm;

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "function", file, line: this.getLineNumber(content, match.index) });
    }
    while ((match = classPattern.exec(content)) !== null) {
      entities.push({ name: match[1], type: "class", file, line: this.getLineNumber(content, match.index) });
    }
  }

  /**
   * Extract entities from Bash/Shell files
   */
  private extractBashEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[]
  ): void {
    // Function patterns for Bash:
    // 1. function name() { ... }
    // 2. function name { ... }
    // 3. name() { ... }
    const functionPatterns = [
      /^\s*function\s+(\w+)\s*\(\s*\)/gm,
      /^\s*function\s+(\w+)\s*\{/gm,
      /^\s*(\w+)\s*\(\s*\)\s*\{/gm,
    ];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        // Skip common shell keywords that might match
        if (!["if", "while", "for", "until", "case", "select"].includes(name)) {
          entities.push({
            name,
            type: "function",
            file,
            line: this.getLineNumber(content, match.index),
          });
        }
      }
    }

    // Deduplicate by name (same function might match multiple patterns)
    const seen = new Set<string>();
    const uniqueEntities: CodeEntity[] = [];
    for (const entity of entities) {
      if (!seen.has(entity.name)) {
        seen.add(entity.name);
        uniqueEntities.push(entity);
      }
    }
    entities.length = 0;
    entities.push(...uniqueEntities);
  }

  /**
   * Extract entities from C/C++ files
   */
  private extractCEntities(
    content: string,
    lines: string[],
    file: string,
    entities: CodeEntity[],
    imports: string[]
  ): void {
    // Typedef struct with body: captures comma-separated aliases
    const typedefStructBodyPattern = /\btypedef\s+struct\s*(?:\w+\s*)?\{[\s\S]*?\}\s*([\w\s,*]+)\s*;/gm;
    // Forward typedef: typedef struct foo bar_t; or typedef struct foo *bar_ptr;
    const typedefForwardStructPattern = /\btypedef\s+(?:const\s+)?(?:volatile\s+)?struct\s+\w+\s*\**\s*(?:const\s+)?(\w+)\s*;/gm;

    // Typedef pattern - for simple type aliases (not struct/enum/union with braces)
    const typedefPattern = /\btypedef\s+(?!struct|enum|union)[\w\s\*]+\s+(\w+)\s*;/gm;

    // Enum pattern: enum [class|struct] name { - supports C++11 scoped enums
    const enumPattern = /\benum\s+(?:class\s+|struct\s+)?(\w+)\s*(?::\s*\w+)?\s*\{/gm;
    // Typedef enum with body: captures comma-separated aliases
    const typedefEnumBodyPattern = /\btypedef\s+enum\s*(?:\w+\s*)?\{[\s\S]*?\}\s*([\w\s,*]+)\s*;/gm;
    // Forward typedef: typedef enum foo bar_e; or typedef enum foo *bar_ptr;
    const typedefForwardEnumPattern = /\btypedef\s+(?:const\s+)?(?:volatile\s+)?enum\s+\w+\s*\**\s*(?:const\s+)?(\w+)\s*;/gm;

    // Union patterns
    const typedefUnionBodyPattern = /\btypedef\s+union\s*(?:\w+\s*)?\{[\s\S]*?\}\s*([\w\s,*]+)\s*;/gm;
    const typedefForwardUnionPattern = /\btypedef\s+(?:const\s+)?(?:volatile\s+)?union\s+\w+\s*\**\s*(?:const\s+)?(\w+)\s*;/gm;

    // Macro pattern: #define NAME (value or function-like), but skip guards
    const macroPattern = /^\s*#define\s+(\w+)(?:\([^)]*\))?(?:\s+|$)/gm;

    // Include pattern: #include <file.h> or #include "file.h"
    const includePattern = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;

    let match;

    // Track seen function names to deduplicate declarations/definitions
    const seenFunctions = new Set<string>();

    // Extract functions using balanced parentheses approach
    this.extractCFunctions(content, file, entities, seenFunctions);

    // Extract structs using brace-balanced tokenizer (handles arbitrary requires clause nesting)
    this.extractCStructs(content, file, entities);

    // Extract typedef structs with comma-separated aliases
    while ((match = typedefStructBodyPattern.exec(content)) !== null) {
      const aliasesPart = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      this.parseTypedefAliases(aliasesPart, file, lineNum, entities);
    }

    // Extract forward typedef structs (typedef struct foo bar_t; or typedef struct foo *bar_ptr;)
    while ((match = typedefForwardStructPattern.exec(content)) !== null) {
      const aliasName = match[1];
      if (aliasName && !this.isCKeyword(aliasName)) {
        entities.push({
          name: aliasName,
          type: "typedef",
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // Extract typedefs (non-struct) - filter out keywords
    while ((match = typedefPattern.exec(content)) !== null) {
      const name = match[1];
      if (name && !this.isCKeyword(name)) {
        entities.push({
          name,
          type: "typedef",
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // Extract enums (including C++11 enum class/struct, skip if name is a keyword)
    while ((match = enumPattern.exec(content)) !== null) {
      const name = match[1];
      if (name && !this.isCKeyword(name)) {
        entities.push({
          name,
          type: "enum",
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // Extract typedef enums with comma-separated aliases
    while ((match = typedefEnumBodyPattern.exec(content)) !== null) {
      const aliasesPart = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      this.parseTypedefAliases(aliasesPart, file, lineNum, entities, "enum");
    }

    // Extract forward typedef enums (typedef enum foo bar_e; or typedef enum foo *bar_ptr;)
    while ((match = typedefForwardEnumPattern.exec(content)) !== null) {
      const aliasName = match[1];
      if (aliasName && !this.isCKeyword(aliasName)) {
        entities.push({
          name: aliasName,
          type: "typedef",
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // Extract typedef unions with comma-separated aliases
    while ((match = typedefUnionBodyPattern.exec(content)) !== null) {
      const aliasesPart = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      this.parseTypedefAliases(aliasesPart, file, lineNum, entities);
    }

    // Extract forward typedef unions (typedef union foo bar_u; or typedef union foo *bar_ptr;)
    while ((match = typedefForwardUnionPattern.exec(content)) !== null) {
      const aliasName = match[1];
      if (aliasName && !this.isCKeyword(aliasName)) {
        entities.push({
          name: aliasName,
          type: "typedef",
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // Extract macros - improved guard detection
    while ((match = macroPattern.exec(content)) !== null) {
      const name = match[1];
      // Skip include guards and internal macros
      if (name && !this.isIncludeGuard(name, file)) {
        entities.push({
          name,
          type: "macro",
          file,
          line: this.getLineNumber(content, match.index),
        });
      }
    }

    // Extract includes
    while ((match = includePattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  /**
   * Extract C/C++ functions handling nested parentheses and multi-line declarations
   */
  private extractCFunctions(
    content: string,
    file: string,
    entities: CodeEntity[],
    seenFunctions: Set<string>
  ): void {
    const lines = content.split('\n');
    
    // Track brace depth to ignore struct/union/enum members
    let braceDepth = 0;
    // Stack of brace depths where struct/union/enum bodies start
    const structBraceStack: number[] = [];
    let pendingStructStart = false; // Saw struct/union/enum, waiting for {
    let pendingDeclaration = "";
    let pendingStartLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Track struct/union/enum depth - including when { is on a separate line
      // Matches: struct foo, struct __attribute__((packed)) foo, struct foo __attribute__((packed)), etc.
      // Allow attributes before and/or after the name
      const attrPattern = '(?:__attribute__\\s*\\(\\([^)]*\\)\\)\\s*|alignas\\s*\\([^)]*\\)\\s*|__packed\\s*|__aligned\\s*\\([^)]*\\)\\s*|__declspec\\s*\\([^)]*\\)\\s*)*';
      // Pattern allows: struct [attrs] [name] [attrs] [: base] [attrs] [{]
      const structDeclRegex = new RegExp(`\\b(struct|union|enum)\\s+${attrPattern}(?:class\\s+|struct\\s+)?(?:\\w+)?\\s*${attrPattern}(?:\\s*:\\s*\\w+)?\\s*${attrPattern}$`);
      const structDeclWithBraceRegex = new RegExp(`\\b(struct|union|enum)\\s+${attrPattern}(?:class\\s+|struct\\s+)?(?:\\w+)?\\s*${attrPattern}(?:\\s*:\\s*\\w+)?\\s*${attrPattern}\\{`);
      const structDecl = structDeclRegex.test(trimmed);
      const structDeclWithBrace = structDeclWithBraceRegex.test(trimmed);
      
      if (structDeclWithBrace) {
        // struct foo { on same line - push to stack after brace is counted
        pendingStructStart = true;
      } else if (structDecl) {
        // struct foo (brace on next line)
        pendingStructStart = true;
      }
      
      // Count braces
      for (const char of line) {
        if (char === '{') {
          braceDepth++;
          if (pendingStructStart) {
            structBraceStack.push(braceDepth);
            pendingStructStart = false;
          }
        }
        if (char === '}') {
          // Check if we're exiting a struct/union/enum
          if (structBraceStack.length > 0 && braceDepth === structBraceStack[structBraceStack.length - 1]) {
            structBraceStack.pop();
          }
          braceDepth--;
        }
      }
      
      // Skip preprocessor, comments, and lines inside struct/union bodies
      if (trimmed.startsWith('#') || trimmed.startsWith('//') || 
          trimmed.startsWith('/*') || trimmed.startsWith('*') ||
          trimmed === '' || trimmed === '{' || trimmed === '}') continue;
      
      // Skip struct/union member declarations (function pointers inside structs)
      // Check if we're inside ANY struct body in the stack
      const insideStruct = structBraceStack.some(startDepth => braceDepth >= startDepth);
      if (insideStruct) continue;
      
      // Accumulate potential multi-line declarations
      // A declaration might span lines like: static int\nfoo(void);
      if (pendingDeclaration) {
        pendingDeclaration += " " + trimmed;
      } else {
        // Start new potential declaration
        pendingDeclaration = trimmed;
        pendingStartLine = i;
      }
      
      // Check if we have a complete function declaration/definition
      // Look for identifier followed by ( ... ) and then { or ;
      const hasOpenParen = pendingDeclaration.includes('(');
      if (!hasOpenParen) {
        // If line doesn't end with common type parts, reset
        if (!trimmed.match(/[\w*]$/) || trimmed.endsWith(';') || trimmed.endsWith('{') || trimmed.endsWith('}')) {
          pendingDeclaration = "";
        }
        continue;
      }
      
      // Count parentheses
      let parenCount = 0;
      for (const char of pendingDeclaration) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
      }
      
      // If parentheses aren't balanced, continue accumulating
      if (parenCount !== 0) continue;
      
      // Check if it ends with { or ;
      const declaration = pendingDeclaration;
      const rest = declaration.substring(declaration.lastIndexOf(')') + 1).trim();
      const isFunctionEnd = rest.match(/^(const|override|final|noexcept|throw)?\s*[\{;]/);
      
      if (isFunctionEnd) {
        // Extract function name: identifier immediately before first (
        // Handle: void foo(...), int *bar(...), uint32_t\nmyfunc(...)
        const beforeParen = declaration.substring(0, declaration.indexOf('('));
        const funcMatch = beforeParen.match(/(\w+)\s*$/);
        
        if (funcMatch) {
          const funcName = funcMatch[1];
          if (funcName && !this.isCKeyword(funcName) && !seenFunctions.has(funcName + file)) {
            seenFunctions.add(funcName + file);
            entities.push({
              name: funcName,
              type: "function",
              file,
              line: pendingStartLine + 1,
              signature: this.extractSignature(declaration.replace(/\{.*$/, '').replace(/;$/, '').trim()),
            });
          }
        }
      }
      
      pendingDeclaration = "";
    }
  }

  /**
   * Parse comma-separated typedef aliases: "Foo_t, *FooPtr, **FooPtrPtr"
   */
  private parseTypedefAliases(
    aliasesPart: string,
    file: string,
    line: number,
    entities: CodeEntity[],
    entityType: "typedef" | "enum" = "typedef"
  ): void {
    // Split by comma, extract identifier from each
    const aliases = aliasesPart.split(',');
    for (const alias of aliases) {
      // Extract the identifier (last word, ignoring * pointers)
      const match = alias.trim().match(/\*?\s*(\w+)\s*$/);
      if (match && match[1] && !this.isCKeyword(match[1])) {
        entities.push({
          name: match[1],
          type: entityType,
          file,
          line,
        });
      }
    }
  }

  /**
   * Check if name is a common C keyword/type to skip
   */
  private isCKeyword(name: string): boolean {
    const keywords = new Set([
      // Control flow
      "if", "else", "for", "while", "do", "switch", "case", "break",
      "continue", "return", "goto", "default",
      // Operators
      "sizeof", "typeof", "alignof", "offsetof",
      // Basic types
      "void", "int", "char", "short", "long", "float", "double",
      // Type qualifiers
      "signed", "unsigned", "const", "static", "extern", "inline",
      "volatile", "register", "auto", "restrict", "_Atomic",
      // Compound types
      "struct", "union", "enum", "typedef",
      // Boolean
      "bool", "_Bool", "true", "false",
      // NULL and special
      "NULL", "nullptr",
      // Fixed-width integers
      "int8_t", "int16_t", "int32_t", "int64_t",
      "uint8_t", "uint16_t", "uint32_t", "uint64_t",
      // Size types
      "size_t", "ssize_t", "ptrdiff_t", "intptr_t", "uintptr_t",
      // Common embedded types
      "u8", "u16", "u32", "u64", "s8", "s16", "s32", "s64",
      "UINT8", "UINT16", "UINT32", "UINT64", "INT8", "INT16", "INT32", "INT64",
    ]);
    return keywords.has(name);
  }

  /**
   * Check if macro name is likely an include guard
   */
  private isIncludeGuard(name: string, file: string): boolean {
    // Leading underscores - common guard pattern
    if (name.startsWith("__")) return true;
    
    // Common guard suffixes
    if (name.endsWith("_H") || name.endsWith("_H_") || name.endsWith("_H__")) return true;
    if (name.endsWith("_HPP") || name.endsWith("_HPP_") || name.endsWith("_HPP__")) return true;
    if (name.endsWith("_INCLUDED") || name.endsWith("_INCLUDED_")) return true;
    if (name.endsWith("_HH") || name.endsWith("_HH_")) return true;
    
    // Only match filename-based guards if they exactly match the pattern: FILENAME_H
    // Extract just the filename without path (e.g., "gpio.h" -> "GPIO")
    const fileName = file.split(/[\/\\]/).pop() || "";
    const baseNameOnly = fileName.replace(/\.[ch](?:pp|h)?$/i, "").toUpperCase().replace(/[^A-Z0-9]/g, "_");
    
    // Only match if it's exactly FILENAME_H or __FILENAME_H__ pattern
    const exactGuard = baseNameOnly + "_H";
    const exactGuardUnderscore = "__" + baseNameOnly + "_H__";
    if (name.toUpperCase() === exactGuard || name.toUpperCase() === exactGuardUnderscore) return true;
    
    return false;
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
