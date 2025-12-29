/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      PREVIEW.TSX - LIVE CODE PREVIEW PAGE                     ║
 * ║                                                                               ║
 * ║  Renders the HTML/CSS/JS code from the editor in a sandboxed iframe.         ║
 * ║  Provides responsive viewport simulation and fullscreen mode.                 ║
 * ║                                                                               ║
 * ║  Features:                                                                    ║
 * ║    - Live preview of editor content                                           ║
 * ║    - Responsive viewport simulation (mobile, tablet, desktop)                 ║
 * ║    - Fullscreen mode for distraction-free viewing                            ║
 * ║    - Refresh button to reload latest saved code                              ║
 * ║    - Sandboxed iframe for security                                            ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Header: [← Back] Preview    [📱 💻 🖥️] [🔄 Refresh] [⬜ Fullscreen]   │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │                                                                        │  ║
 * ║  │     ┌──────────────────────────────────────────────────────────┐      │  ║
 * ║  │     │                                                          │      │  ║
 * ║  │     │              Iframe Preview Window                       │      │  ║
 * ║  │     │         (Responsive width based on viewport)             │      │  ║
 * ║  │     │                                                          │      │  ║
 * ║  │     └──────────────────────────────────────────────────────────┘      │  ║
 * ║  │                                                                        │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │ Footer: Mobile View (375px) [only shown for non-desktop viewports]     │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage preview state (code, fullscreen, viewport)
 * - useEffect: Load code and write to iframe
 * - useRef: Reference to iframe element for content manipulation
 */
import { useState, useEffect, useRef } from "react";

/**
 * UI Components from shadcn/ui
 * - Button: Consistent styled buttons
 */
import { Button } from "@/components/ui/button";

/**
 * Wouter Link - Navigation back to editor
 */
import { Link } from "wouter";

/**
 * Lucide Icons
 * - ArrowLeft: Back navigation icon
 * - RefreshCw: Refresh/reload icon
 * - Maximize2/Minimize2: Fullscreen toggle icons
 * - Smartphone: Mobile viewport icon
 * - Tablet: Tablet viewport icon
 * - Monitor: Desktop viewport icon
 */
import { ArrowLeft, RefreshCw, Maximize2, Minimize2, Smartphone, Tablet, Monitor } from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * ViewportSize - Supported viewport simulation modes
 * Used for responsive design testing
 */
type ViewportSize = "mobile" | "tablet" | "desktop";

// ============================================================================
// VIEWPORT CONFIGURATION
// ============================================================================

/**
 * Viewport size definitions
 * 
 * Maps viewport type to width and display label.
 * Desktop uses "100%" to fill available space.
 * 
 * Standard breakpoints:
 * - Mobile: 375px (iPhone size)
 * - Tablet: 768px (iPad portrait)
 * - Desktop: 100% (full width)
 */
const viewportSizes = {
  mobile: { width: 375, label: "Mobile" },
  tablet: { width: 768, label: "Tablet" },
  desktop: { width: "100%", label: "Desktop" },
};

// ============================================================================
// PREVIEW PAGE COMPONENT
// ============================================================================

/**
 * PreviewPage Component - Live Code Preview
 * 
 * Displays the HTML/CSS/JS code from the editor in a sandboxed iframe,
 * allowing users to see their code rendered in real-time.
 * 
 * How It Works:
 * 1. Loads code from localStorage (key: "nebula-editor-code")
 * 2. Writes code to iframe using document.write()
 * 3. Allows viewport resizing to test responsive design
 * 4. Supports fullscreen mode for larger preview
 * 
 * Security:
 * - iframe uses sandbox="allow-scripts allow-same-origin"
 * - Scripts can run but in isolated context
 * - Protects main app from malicious user code
 * 
 * State Management:
 * - code: HTML/CSS/JS content to render
 * - isFullscreen: Fullscreen mode toggle
 * - viewport: Current viewport simulation (mobile/tablet/desktop)
 * 
 * @returns {JSX.Element} The preview page
 */
export default function PreviewPage() {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * HTML/CSS/JS code to render in the iframe
   * Loaded from localStorage on mount
   */
  const [code, setCode] = useState("");

  /**
   * Fullscreen mode state
   * When true, preview takes full viewport height
   */
  const [isFullscreen, setIsFullscreen] = useState(false);

  /**
   * Current viewport simulation mode
   * Controls the width of the preview iframe
   */
  const [viewport, setViewport] = useState<ViewportSize>("desktop");

  /**
   * Reference to the iframe element
   * Used to write content directly to iframe document
   */
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  /**
   * Effect: Load code from localStorage on mount
   * 
   * Retrieves the saved code from the editor and stores
   * it in state for rendering.
   */
  useEffect(() => {
    const saved = localStorage.getItem("nebula-editor-code");
    if (saved) {
      setCode(saved);
    }
  }, []);

  /**
   * Effect: Write code to iframe when code changes
   * 
   * Uses document.write() to inject the HTML content directly
   * into the iframe's document. This approach:
   * - Allows full HTML documents (with <!DOCTYPE>, <html>, etc.)
   * - Enables inline CSS and JavaScript execution
   * - Provides immediate rendering without network requests
   * 
   * Note: We access contentDocument or contentWindow.document
   * as fallback for cross-browser compatibility.
   */
  useEffect(() => {
    if (iframeRef.current && code) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();        // Open document for writing
        doc.write(code);   // Write HTML content
        doc.close();       // Close document (triggers rendering)
      }
    }
  }, [code]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Refresh the preview with latest saved code
   * 
   * Reloads code from localStorage and updates the state,
   * which triggers the useEffect to re-render the iframe.
   */
  const handleRefresh = () => {
    const saved = localStorage.getItem("nebula-editor-code");
    if (saved) {
      setCode(saved);
    }
  };

  /**
   * Toggle fullscreen mode
   * 
   * Switches between normal and fullscreen preview modes.
   * In fullscreen, the preview takes the entire viewport.
   */
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  /**
   * Get the current viewport width as CSS value
   * 
   * Returns the width based on selected viewport:
   * - Mobile: "375px"
   * - Tablet: "768px"
   * - Desktop: "100%"
   * 
   * @returns {string} CSS width value
   */
  const getViewportWidth = () => {
    const size = viewportSizes[viewport];
    return typeof size.width === "number" ? `${size.width}px` : size.width;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={`flex flex-col h-screen bg-background ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* 
       * Header Bar
       * Contains navigation, viewport controls, and action buttons
       */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card/50 backdrop-blur-md">
        
        {/* Left Section: Back Button + Title */}
        <div className="flex items-center gap-3">
          {/* Back to Editor button */}
          <Link href="/editor">
            <Button variant="ghost" size="icon" data-testid="button-back-editor">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="font-display font-semibold text-lg">Preview</span>
        </div>

        {/* Right Section: Viewport Controls + Actions */}
        <div className="flex items-center gap-2">
          
          {/* 
           * Viewport Selector
           * Button group to switch between mobile, tablet, and desktop views
           */}
          <div className="flex items-center border rounded-lg p-1 bg-secondary/30">
            {/* Mobile Viewport Button */}
            <Button
              variant={viewport === "mobile" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport("mobile")}
              data-testid="button-viewport-mobile"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            
            {/* Tablet Viewport Button */}
            <Button
              variant={viewport === "tablet" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport("tablet")}
              data-testid="button-viewport-tablet"
            >
              <Tablet className="h-4 w-4" />
            </Button>
            
            {/* Desktop Viewport Button */}
            <Button
              variant={viewport === "desktop" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport("desktop")}
              data-testid="button-viewport-desktop"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>

          {/* Refresh Button - Reloads latest saved code */}
          <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          {/* Fullscreen Toggle Button */}
          <Button variant="outline" size="icon" onClick={toggleFullscreen} data-testid="button-fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* 
       * Preview Container
       * Centered area with background pattern
       * Contains the resizable preview window
       */}
      <div className="flex-1 overflow-auto bg-secondary/20 p-4 flex justify-center">
        
        {/* 
         * Preview Window
         * White background with shadow to simulate browser window
         * Width controlled by viewport state
         */}
        <div
          className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
          style={{
            width: getViewportWidth(),
            maxWidth: "100%",
            height: isFullscreen ? "calc(100vh - 64px)" : "calc(100vh - 120px)",
          }}
        >
          {code ? (
            // =================================================================
            // IFRAME PREVIEW
            // Renders the HTML/CSS/JS code in sandboxed environment
            // =================================================================
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
              data-testid="iframe-preview"
            />
          ) : (
            // =================================================================
            // EMPTY STATE
            // Shown when no code has been saved in the editor
            // =================================================================
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">No code to preview</p>
                <Link href="/editor">
                  <Button variant="outline" data-testid="button-go-editor">
                    Go to Editor
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 
       * Footer - Viewport Size Indicator
       * Only shown when not in desktop mode
       * Displays the current simulated viewport dimensions
       */}
      {viewport !== "desktop" && (
        <div className="text-center py-2 text-sm text-muted-foreground border-t">
          {viewportSizes[viewport].label} View ({viewportSizes[viewport].width}px)
        </div>
      )}
    </div>
  );
}
