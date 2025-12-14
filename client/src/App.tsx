/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           APP.TSX - ROOT APPLICATION                          ║
 * ║                                                                               ║
 * ║  This is the main application component that serves as the entry point       ║
 * ║  for the React application. It sets up:                                       ║
 * ║                                                                               ║
 * ║    1. React Query Provider - For server state management & data fetching     ║
 * ║    2. Tooltip Provider - For accessible tooltips throughout the app          ║
 * ║    3. Toaster - For toast notifications/alerts                               ║
 * ║    4. Router - Client-side routing using Wouter                              ║
 * ║                                                                               ║
 * ║  Architecture:                                                                ║
 * ║  ┌─────────────────────────────────────────────────────────────────┐         ║
 * ║  │                    QueryClientProvider                          │         ║
 * ║  │  ┌───────────────────────────────────────────────────────────┐  │         ║
 * ║  │  │                   TooltipProvider                         │  │         ║
 * ║  │  │  ┌─────────────────────────────────────────────────────┐  │  │         ║
 * ║  │  │  │  Toaster (notifications)                            │  │  │         ║
 * ║  │  │  │  Router (page components)                           │  │  │         ║
 * ║  │  │  └─────────────────────────────────────────────────────┘  │  │         ║
 * ║  │  └───────────────────────────────────────────────────────────┘  │         ║
 * ║  └─────────────────────────────────────────────────────────────────┘         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * Wouter - Lightweight routing library (~1.5KB)
 * - Switch: Renders only the first matching Route
 * - Route: Maps URL paths to components
 * @see https://github.com/molefrog/wouter
 */
import { Switch, Route } from "wouter";

/**
 * TanStack Query (React Query) client instance
 * Pre-configured with default options for caching, retries, and stale time
 * @see ./lib/queryClient.ts for configuration
 */
import { queryClient } from "./lib/queryClient";

/**
 * QueryClientProvider - Makes React Query client available to all components
 * Provides hooks like useQuery, useMutation throughout the component tree
 */
import { QueryClientProvider } from "@tanstack/react-query";

/**
 * Toaster - Toast notification container component
 * Displays success, error, and info messages to users
 * @see https://ui.shadcn.com/docs/components/toast
 */
import { Toaster } from "@/components/ui/toaster";

/**
 * TooltipProvider - Context provider for accessible tooltips
 * Required wrapper for any components using Tooltip
 * @see https://ui.shadcn.com/docs/components/tooltip
 */
import { TooltipProvider } from "@/components/ui/tooltip";

// ============================================================================
// PAGE IMPORTS
// ============================================================================

/**
 * Page Components - Each represents a distinct view/route in the application
 * 
 * NotFound: 404 fallback page for unmatched routes
 * Home: Main chat interface with AI conversation
 * EditorPage: HTML/CSS/JS code editor with Monaco
 * PreviewPage: Live preview of editor content
 * GoogleServicesPage: Google Workspace integrations dashboard
 */
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import EditorPage from "@/pages/editor";
import PreviewPage from "@/pages/preview";
import GoogleServicesPage from "@/pages/google-services";
import HelpPage from "@/pages/help";
import MusicGenerationPage from "@/pages/music-generation";
import ExpressiveSpeechPage from "@/pages/expressive-speech";
import ImageGenerationPage from "@/pages/image-generation";
import TerminalPage from "@/pages/terminal";
import DebugPage from "@/pages/debug";
import SettingsPage from "@/pages/settings";
import PythonSandboxPage from "@/pages/python-sandbox";
import PlaywrightTestingPage from "@/pages/playwright-testing";
import WebSearchPage from "@/pages/web-search";
import KnowledgeIngestionPage from "@/pages/knowledge-ingestion";
import MarkdownPlaygroundPage from "@/pages/markdown-playground";

import { TTSProvider } from "@/contexts/tts-context";

// ============================================================================
// ROUTER COMPONENT
// ============================================================================

/**
 * Router Component
 * 
 * Defines the application's route structure using Wouter's declarative routing.
 * 
 * Route Hierarchy:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │  Path          │  Component            │  Description                      │
 * ├────────────────┼───────────────────────┼───────────────────────────────────┤
 * │  /             │  Home                 │  Main AI chat interface           │
 * │  /editor       │  EditorPage           │  Code editor (HTML/CSS/JS)        │
 * │  /preview      │  PreviewPage          │  Live preview of editor code      │
 * │  /google       │  GoogleServicesPage   │  Google Workspace dashboard       │
 * │  *             │  NotFound             │  404 fallback for unmatched URLs  │
 * └────────────────────────────────────────────────────────────────────────────┘
 * 
 * How Wouter Switch Works:
 * - Evaluates routes top-to-bottom
 * - Renders ONLY the first matching route
 * - Last Route without path acts as fallback (404)
 * 
 * @returns {JSX.Element} The rendered route based on current URL
 * 
 * @example
 * // URL: "/" renders Home component
 * // URL: "/editor" renders EditorPage component
 * // URL: "/unknown" renders NotFound component
 */
function Router() {
  return (
    <Switch>
      {/* Home Route - Main chat interface, default landing page */}
      <Route path="/" component={Home} />
      
      {/* Editor Route - Monaco-based code editor for HTML/CSS/JS */}
      <Route path="/editor" component={EditorPage} />
      
      {/* Preview Route - Live iframe preview of editor content */}
      <Route path="/preview" component={PreviewPage} />
      
      {/* Google Services Route - Google Workspace integrations dashboard */}
      <Route path="/google" component={GoogleServicesPage} />
      
      {/* Help Route - FAQ and guidance */}
      <Route path="/help" component={HelpPage} />
      
      {/* Music Generation Route - Lyria AI music generation */}
      <Route path="/music" component={MusicGenerationPage} />
      
      {/* Expressive Speech Route - Multi-speaker TTS */}
      <Route path="/speech" component={ExpressiveSpeechPage} />
      
      {/* Image Generation Route - AI image generation with canvas editor */}
      <Route path="/image" component={ImageGenerationPage} />
      
      {/* Terminal Route - Code execution terminal */}
      <Route path="/terminal" component={TerminalPage} />
      
      {/* Debug Route - Logs and database viewer */}
      <Route path="/debug" component={DebugPage} />
      
      {/* Settings Route - App configuration */}
      <Route path="/settings" component={SettingsPage} />
      
      {/* Python Sandbox Route - Python code execution */}
      <Route path="/python" component={PythonSandboxPage} />
      
      {/* Playwright Testing Route - Browser automation testing */}
      <Route path="/testing" component={PlaywrightTestingPage} />
      
      {/* Web Search Route - Web search and scraping */}
      <Route path="/search" component={WebSearchPage} />
      
      {/* Knowledge Ingestion Route - Ingest historical LLM conversations */}
      <Route path="/knowledge" component={KnowledgeIngestionPage} />

      {/* Markdown Playground Route - Demo of enhanced markdown features */}
      <Route path="/markdown" component={MarkdownPlaygroundPage} />
      
      {/* 
       * Fallback Route (404) - No path specified means it matches everything
       * Must be LAST in the Switch to only catch unmatched routes
       */}
      <Route component={NotFound} />
    </Switch>
  );
}

// ============================================================================
// APP COMPONENT (ROOT)
// ============================================================================

/**
 * App Component - Application Root
 * 
 * The top-level component that wraps the entire application with necessary
 * providers and global components. This component:
 * 
 * 1. QueryClientProvider - Enables React Query throughout the app
 *    - Provides useQuery, useMutation hooks to all children
 *    - Manages server state cache automatically
 *    - Handles background refetching and stale data
 * 
 * 2. TooltipProvider - Enables accessible tooltips
 *    - Required by Radix UI Tooltip components
 *    - Manages tooltip positioning and timing
 * 
 * 3. Toaster - Toast notification system
 *    - Displays feedback messages to users
 *    - Supports success, error, info, and warning variants
 * 
 * 4. Router - Handles page navigation
 *    - Matches URL to appropriate page component
 *    - Provides SPA (Single Page Application) experience
 * 
 * Provider Order Matters:
 * - QueryClientProvider must be outermost to provide data to all components
 * - TooltipProvider wraps content that might use tooltips
 * - Toaster is placed before Router to overlay toast messages
 * 
 * @returns {JSX.Element} The fully configured application tree
 * 
 * @example
 * // main.tsx renders this component:
 * createRoot(document.getElementById("root")!).render(<App />);
 */
function App() {
  return (
    // QueryClientProvider: Makes React Query available throughout the app
    // The client instance is imported from ./lib/queryClient.ts
    <QueryClientProvider client={queryClient}>
      
      {/* TTSProvider: Provides text-to-speech functionality with muted state */}
      <TTSProvider>
        
        {/* TooltipProvider: Enables Radix UI tooltips for child components */}
        <TooltipProvider>
          
          {/* 
           * Toaster: Global toast notification container
           * Toast messages can be triggered from anywhere using useToast hook
           */}
          <Toaster />
          
          {/* Router: Renders the appropriate page based on current URL */}
          <Router />
          
        </TooltipProvider>
      </TTSProvider>
    </QueryClientProvider>
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Export App as default for use in main.tsx
 * This is the single entry point for the React application
 */
export default App;
