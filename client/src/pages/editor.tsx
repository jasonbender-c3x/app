/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      EDITOR.TSX - CODE EDITOR PAGE                            ║
 * ║                                                                               ║
 * ║  A full-featured code editor powered by Monaco Editor (same as VS Code).     ║
 * ║  Supports multiple open files in tabs with:                                   ║
 * ║                                                                               ║
 * ║    - Syntax highlighting and code completion                                  ║
 * ║    - Light/dark theme toggle                                                  ║
 * ║    - Multi-file tab support for collaborative editing                         ║
 * ║    - LLM integration for loading code into specific tabs                      ║
 * ║    - Local storage persistence                                                ║
 * ║    - Live preview integration                                                 ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Header: [Menu] Meowstik Editor    [Language] [Theme] [Save] [Preview]  │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │ Tabs: [file1.js] [file2.ts] [untitled.html] [+]                        │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │                     Monaco Editor (Full Height)                        │  ║
 * ║  │    1 │ <!DOCTYPE html>                                                 │  ║
 * ║  │    2 │ <html lang="en">                                                │  ║
 * ║  │   ...│                                                                 │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Play, Eye, Save, Menu, FileCode, Moon, Sun, X, Plus } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a single open file in the editor
 */
interface EditorFile {
  id: string;
  filename: string;
  code: string;
  language: string;
  isSaved: boolean;
}

// ============================================================================
// DEFAULT CODE TEMPLATE
// ============================================================================

const defaultCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      color: white;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    p { font-size: 1.2rem; opacity: 0.9; }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 2rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <h1>Welcome to Meowstik Editor</h1>
  <p>Start editing to see changes in the preview!</p>
  <div class="card">
    <h2>Getting Started</h2>
    <p>This is a live HTML/CSS/JS editor. Your changes will appear in the preview instantly.</p>
  </div>
</body>
</html>`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Infer language from filename extension
 */
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'sh': 'shell',
    'bash': 'shell',
  };
  return langMap[ext] || 'plaintext';
}

/**
 * Generate unique ID for a new file
 */
function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty file
 */
function createNewFile(filename: string = 'untitled.html', code: string = '', language?: string): EditorFile {
  return {
    id: generateFileId(),
    filename,
    code: code || defaultCode,
    language: language || getLanguageFromFilename(filename),
    isSaved: code ? false : true,
  };
}

// ============================================================================
// EDITOR PAGE COMPONENT
// ============================================================================

export default function EditorPage() {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Array of open files (tabs)
   */
  const [files, setFiles] = useState<EditorFile[]>(() => [createNewFile()]);

  /**
   * Currently active file ID
   */
  const [activeFileId, setActiveFileId] = useState<string>(() => files[0]?.id || '');

  /**
   * Editor theme - Monaco's built-in themes
   */
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  /**
   * Get the currently active file
   */
  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  /**
   * Effect: Load saved files from localStorage on mount
   * Also checks for LLM-loaded code (takes priority)
   */
  useEffect(() => {
    // Check for LLM-loaded code first (priority)
    const llmCode = localStorage.getItem("meowstik-editor-llm-code");
    const llmLanguage = localStorage.getItem("meowstik-editor-llm-language");
    const llmFilename = localStorage.getItem("meowstik-editor-llm-filename");
    
    if (llmCode) {
      const filename = llmFilename || `untitled.${llmLanguage || 'txt'}`;
      const newFile = createNewFile(filename, llmCode, llmLanguage || undefined);
      newFile.isSaved = false;
      
      setFiles(prev => {
        // Check if a file with this filename already exists
        const existingIndex = prev.findIndex(f => f.filename === filename);
        if (existingIndex >= 0) {
          const existingFile = prev[existingIndex];
          const updated = [...prev];
          
          // If existing file has unsaved changes, create a backup first
          if (!existingFile.isSaved) {
            const bakFilename = `${existingFile.filename}~bak`;
            // Clone the file directly to preserve exact content (even empty strings)
            const bakFile: EditorFile = {
              id: `file-${Date.now()}-bak`,
              filename: bakFilename,
              code: existingFile.code, // Preserve exact content
              language: existingFile.language,
              isSaved: true // Backup is considered saved
            };
            updated.push(bakFile);
            console.log(`[Editor] Created backup: ${bakFilename}`);
          }
          
          // Update existing file and focus it
          updated[existingIndex] = { ...existingFile, code: llmCode, isSaved: false };
          setActiveFileId(updated[existingIndex].id); // Use existing file's ID
          return updated;
        }
        // Add new file and focus it
        setActiveFileId(newFile.id);
        return [...prev, newFile];
      });
      
      // Clear after loading
      localStorage.removeItem("meowstik-editor-llm-code");
      localStorage.removeItem("meowstik-editor-llm-language");
      localStorage.removeItem("meowstik-editor-llm-filename");
    } else {
      // Fall back to user-saved files
      const savedFiles = localStorage.getItem("meowstik-editor-files");
      const savedActiveId = localStorage.getItem("meowstik-editor-active");
      if (savedFiles) {
        try {
          const parsed = JSON.parse(savedFiles) as EditorFile[];
          if (parsed.length > 0) {
            setFiles(parsed);
            if (savedActiveId && parsed.some(f => f.id === savedActiveId)) {
              setActiveFileId(savedActiveId);
            } else {
              setActiveFileId(parsed[0].id);
            }
          }
        } catch (e) {
          console.error('Failed to parse saved files:', e);
        }
      }
    }
  }, []);
  
  /**
   * Effect: Listen for LLM code loads via storage events
   * Allows the chat to send code to the editor in real-time
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "meowstik-editor-llm-code" && e.newValue) {
        const llmLanguage = localStorage.getItem("meowstik-editor-llm-language");
        const llmFilename = localStorage.getItem("meowstik-editor-llm-filename");
        
        const filename = llmFilename || `untitled.${llmLanguage || 'txt'}`;
        const newFile = createNewFile(filename, e.newValue, llmLanguage || undefined);
        newFile.isSaved = false;
        
        setFiles(prev => {
          // Check if a file with this filename already exists
          const existingIndex = prev.findIndex(f => f.filename === filename);
          if (existingIndex >= 0) {
            const existingFile = prev[existingIndex];
            const updated = [...prev];
            
            // If existing file has unsaved changes, create a backup first
            if (!existingFile.isSaved) {
              const bakFilename = `${existingFile.filename}~bak`;
              // Clone the file directly to preserve exact content (even empty strings)
              const bakFile: EditorFile = {
                id: `file-${Date.now()}-bak`,
                filename: bakFilename,
                code: existingFile.code, // Preserve exact content
                language: existingFile.language,
                isSaved: true // Backup is considered saved
              };
              updated.push(bakFile);
              console.log(`[Editor] Created backup: ${bakFilename}`);
            }
            
            // Update existing file and focus it
            updated[existingIndex] = { ...existingFile, code: e.newValue!, isSaved: false };
            setActiveFileId(updated[existingIndex].id); // Use existing file's ID
            return updated;
          }
          // Add new file and focus it
          setActiveFileId(newFile.id);
          return [...prev, newFile];
        });
        
        // Clear after loading
        localStorage.removeItem("meowstik-editor-llm-code");
        localStorage.removeItem("meowstik-editor-llm-language");
        localStorage.removeItem("meowstik-editor-llm-filename");
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle editor content changes
   */
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined && activeFileId) {
      setFiles(prev => prev.map(f => 
        f.id === activeFileId ? { ...f, code: value, isSaved: false } : f
      ));
    }
  }, [activeFileId]);

  /**
   * Handle language change for active file
   */
  const handleLanguageChange = useCallback((lang: string) => {
    if (activeFileId) {
      setFiles(prev => prev.map(f =>
        f.id === activeFileId ? { ...f, language: lang } : f
      ));
    }
  }, [activeFileId]);

  /**
   * Save all files to localStorage
   */
  const handleSave = useCallback(() => {
    setFiles(prev => {
      const updated = prev.map(f => ({ ...f, isSaved: true }));
      localStorage.setItem("meowstik-editor-files", JSON.stringify(updated));
      localStorage.setItem("meowstik-editor-active", activeFileId);
      // Also save the active file's code for preview
      const active = updated.find(f => f.id === activeFileId);
      if (active) {
        localStorage.setItem("nebula-editor-code", active.code);
      }
      return updated;
    });
  }, [activeFileId]);

  /**
   * Add a new empty file tab
   */
  const handleNewFile = useCallback(() => {
    const count = files.filter(f => f.filename.startsWith('untitled')).length;
    const newFile = createNewFile(`untitled${count > 0 ? count + 1 : ''}.html`);
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, [files]);

  /**
   * Close a file tab
   */
  const handleCloseFile = useCallback((fileId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger tab switch
    setFiles(prev => {
      if (prev.length === 1) {
        // Don't close the last tab, just reset it
        return [createNewFile()];
      }
      const filtered = prev.filter(f => f.id !== fileId);
      // If we're closing the active tab, switch to another
      if (fileId === activeFileId) {
        const closedIndex = prev.findIndex(f => f.id === fileId);
        const newActiveIndex = Math.max(0, closedIndex - 1);
        setActiveFileId(filtered[newActiveIndex]?.id || filtered[0].id);
      }
      return filtered;
    });
  }, [activeFileId]);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setTheme(theme === "vs-dark" ? "light" : "vs-dark");
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header Bar - Compact version for maximum editor space */}
      <header className="flex items-center justify-between px-3 py-2 border-b bg-card/50 backdrop-blur-md">
        
        {/* Left Section: Navigation + Branding */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-home">
              <Menu className="h-5 w-5" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm hidden sm:inline">Meowstik Editor</span>
          </div>
        </div>

        {/* Right Section: Tools and Actions */}
        <div className="flex items-center gap-2">
          
          {/* Language Selector */}
          <Select value={activeFile?.language || 'html'} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-28 h-8 text-xs" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="shell">Shell</SelectItem>
            </SelectContent>
          </Select>

          {/* Theme Toggle Button */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} data-testid="button-theme">
            {theme === "vs-dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Save Button */}
          <Button variant="outline" size="sm" className="h-8" onClick={handleSave} data-testid="button-save">
            <Save className="h-3 w-3 mr-1" />
            {files.every(f => f.isSaved) ? "Saved" : "Save"}
          </Button>

          {/* Preview Button */}
          <Link href="/preview">
            <Button size="sm" className="h-8 bg-primary hover:bg-primary/90" data-testid="button-preview">
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
          </Link>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
        <div className="flex items-center min-w-0">
          {files.map(file => (
            <button
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`
                group flex items-center gap-2 px-3 py-1.5 text-sm border-r border-border
                transition-colors min-w-0 max-w-[180px]
                ${file.id === activeFileId 
                  ? 'bg-background text-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }
              `}
              data-testid={`tab-${file.filename}`}
            >
              <span className="truncate flex items-center gap-1">
                {!file.isSaved && <span className="text-primary">●</span>}
                {file.filename}
              </span>
              <button
                onClick={(e) => handleCloseFile(file.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded p-0.5 transition-opacity"
                data-testid={`close-${file.filename}`}
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
        
        {/* New Tab Button */}
        <button
          onClick={handleNewFile}
          className="flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          data-testid="button-new-tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={activeFile?.language || 'html'}
          value={activeFile?.code || ''}
          theme={theme}
          onChange={handleEditorChange}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: true },
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            lineNumbers: "on",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  );
}
