/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      EDITOR.TSX - CODE EDITOR PAGE                            ║
 * ║                                                                               ║
 * ║  A full-featured code editor powered by Monaco Editor (same as VS Code).     ║
 * ║  Supports HTML, CSS, JavaScript, TypeScript, JSON, and Markdown with:        ║
 * ║                                                                               ║
 * ║    - Syntax highlighting and code completion                                  ║
 * ║    - Light/dark theme toggle                                                  ║
 * ║    - Local storage persistence                                                ║
 * ║    - Live preview integration                                                 ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Header: [Menu] Nebula Editor    [Language] [Theme] [Save] [Preview]    │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │                                                                        │  ║
 * ║  │                     Monaco Editor (Full Height)                        │  ║
 * ║  │                                                                        │  ║
 * ║  │    1 │ <!DOCTYPE html>                                                 │  ║
 * ║  │    2 │ <html lang="en">                                                │  ║
 * ║  │    3 │ <head>                                                          │  ║
 * ║  │   ...│                                                                 │  ║
 * ║  │                                                                        │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage editor state (code, language, theme, save status)
 * - useEffect: Load saved code from localStorage on mount
 */
import { useState, useEffect } from "react";

/**
 * Monaco Editor - VS Code's editor component for React
 * Provides full code editing capabilities with syntax highlighting,
 * IntelliSense, and many other features
 * @see https://github.com/suren-atoyan/monaco-react
 */
import Editor from "@monaco-editor/react";

/**
 * UI Components from shadcn/ui
 * - Button: Consistent styled buttons
 * - Select: Dropdown for language selection
 */
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Wouter Link - For navigation back to home and to preview
 */
import { Link } from "wouter";

/**
 * Lucide Icons
 * - Play: For run/execute actions (unused currently)
 * - Eye: Preview button icon
 * - Save: Save button icon
 * - Menu: Navigation menu icon
 * - FileCode: Editor branding icon
 * - Moon/Sun: Theme toggle icons
 */
import { Play, Eye, Save, Menu, FileCode, Moon, Sun } from "lucide-react";

// ============================================================================
// DEFAULT CODE TEMPLATE
// ============================================================================

/**
 * Default HTML/CSS template shown when editor is first opened
 * 
 * This template demonstrates:
 * - Modern HTML5 structure
 * - CSS with system fonts and gradients
 * - Glassmorphism card effect (backdrop-filter blur)
 * - Responsive layout with max-width
 * 
 * Users can modify this or replace it entirely with their own code.
 */
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
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.2rem;
      opacity: 0.9;
    }
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
// EDITOR PAGE COMPONENT
// ============================================================================

/**
 * EditorPage Component - Code Editor Interface
 * 
 * A full-screen code editor built on Monaco Editor, providing a
 * VS Code-like editing experience in the browser.
 * 
 * Features:
 * - Multi-language support (HTML, CSS, JS, TS, JSON, Markdown)
 * - Light/dark theme toggle
 * - Auto-save to localStorage
 * - Preview integration (opens in separate page)
 * - Professional editor settings (minimap, line numbers, etc.)
 * 
 * State Management:
 * - code: Current editor content
 * - language: Selected programming language
 * - theme: "vs-dark" or "light"
 * - isSaved: Tracks if current code matches localStorage
 * 
 * Data Persistence:
 * - Uses localStorage with key "nebula-editor-code"
 * - Code is automatically loaded on mount
 * - Manual save with Save button
 * 
 * @returns {JSX.Element} The editor page
 */
export default function EditorPage() {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Current editor content
   * Initialized with defaultCode template, then overwritten
   * by localStorage value if available
   */
  const [code, setCode] = useState(defaultCode);

  /**
   * Selected programming language for syntax highlighting
   * Supported: html, css, javascript, typescript, json, markdown
   */
  const [language, setLanguage] = useState("html");

  /**
   * Editor theme - Monaco's built-in themes
   * - "vs-dark": Dark theme (default)
   * - "light": Light theme
   */
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  /**
   * Save status indicator
   * - true: Current code matches localStorage
   * - false: Unsaved changes exist
   */
  const [isSaved, setIsSaved] = useState(true);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  /**
   * Effect: Load saved code from localStorage on mount
   * 
   * Checks localStorage for previously saved code and loads it
   * into the editor, preserving user's work across sessions.
   */
  useEffect(() => {
    const saved = localStorage.getItem("nebula-editor-code");
    if (saved) {
      setCode(saved);
    }
  }, []);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle editor content changes
   * 
   * Called by Monaco Editor whenever the content changes.
   * Updates the code state and marks as unsaved.
   * 
   * @param {string | undefined} value - New editor content
   */
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setIsSaved(false); // Mark as unsaved on any change
    }
  };

  /**
   * Save code to localStorage
   * 
   * Persists the current editor content to localStorage
   * and updates the save status indicator.
   */
  const handleSave = () => {
    localStorage.setItem("nebula-editor-code", code);
    setIsSaved(true);
  };

  /**
   * Toggle between light and dark themes
   * 
   * Switches Monaco's theme between "vs-dark" and "light"
   */
  const toggleTheme = () => {
    setTheme(theme === "vs-dark" ? "light" : "vs-dark");
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 
       * Header Bar
       * Contains navigation, branding, and action buttons
       * Fixed at top with blur effect
       */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card/50 backdrop-blur-md">
        
        {/* Left Section: Navigation + Branding */}
        <div className="flex items-center gap-3">
          {/* Back to Home button */}
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-home">
              <Menu className="h-5 w-5" />
            </Button>
          </Link>
          
          {/* Editor Branding */}
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold text-lg">Meowstik Editor</span>
          </div>
        </div>

        {/* Right Section: Tools and Actions */}
        <div className="flex items-center gap-2">
          
          {/* 
           * Language Selector
           * Dropdown to choose syntax highlighting mode
           */}
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-32" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="markdown">Markdown</SelectItem>
            </SelectContent>
          </Select>

          {/* Theme Toggle Button */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme">
            {theme === "vs-dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Save Button - Shows "Saved" or "Save" based on status */}
          <Button variant="outline" size="sm" onClick={handleSave} data-testid="button-save">
            <Save className="h-4 w-4 mr-2" />
            {isSaved ? "Saved" : "Save"}
          </Button>

          {/* Preview Button - Opens preview page */}
          <Link href="/preview">
            <Button size="sm" className="bg-primary hover:bg-primary/90" data-testid="button-preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </Link>
        </div>
      </header>

      {/* 
       * Monaco Editor Container
       * Takes remaining height after header
       * 
       * Editor Options:
       * - fontSize: 14px for readability
       * - fontFamily: JetBrains Mono or Fira Code (monospace)
       * - minimap: Enabled for code overview
       * - padding: 16px top padding
       * - scrollBeyondLastLine: Disabled (no extra scroll)
       * - wordWrap: Enabled for long lines
       * - automaticLayout: Responds to container size changes
       * - lineNumbers: Enabled
       * - renderWhitespace: Shows spaces on selection
       * - bracketPairColorization: Colored matching brackets
       */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={code}
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
