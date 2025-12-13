/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                       SIDEBAR.TSX - CHAT HISTORY SIDEBAR                      ║
 * ║                                                                               ║
 * ║  A collapsible sidebar component that displays chat history organized by      ║
 * ║  time periods (Today, Yesterday, Previous 7 Days, Older). Provides:           ║
 * ║                                                                               ║
 * ║    - Mobile-responsive slide-in/out behavior                                  ║
 * ║    - Chat session navigation and selection                                    ║
 * ║    - New chat creation button                                                 ║
 * ║    - Footer with settings and help links                                      ║
 * ║                                                                               ║
 * ║  Layout Structure:                                                            ║
 * ║  ┌────────────────────────────┐                                               ║
 * ║  │ [X]  🌌 Nebula             │  ← Header with logo                           ║
 * ║  ├────────────────────────────┤                                               ║
 * ║  │ [+] New chat               │  ← New chat button                            ║
 * ║  ├────────────────────────────┤                                               ║
 * ║  │ Today                      │                                               ║
 * ║  │   💬 Chat title 1          │  ← Grouped by time period                     ║
 * ║  │   💬 Chat title 2          │                                               ║
 * ║  │ Yesterday                  │                                               ║
 * ║  │   💬 Chat title 3          │                                               ║
 * ║  │ ...                        │                                               ║
 * ║  ├────────────────────────────┤                                               ║
 * ║  │ [?] Help & FAQ             │                                               ║
 * ║  │ [⏱] Activity               │  ← Footer actions                             ║
 * ║  │ [⚙] Settings               │                                               ║
 * ║  │ 🟢 Kyiv, Ukraine   v2.4.0  │  ← Status indicator                          ║
 * ║  └────────────────────────────┘                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage component state (currently unused, using props)
 */
import { useState } from "react";

/**
 * Utility for conditional class names
 */
import { cn } from "@/lib/utils";

/**
 * UI Components from shadcn/ui
 * - Button: Styled buttons for actions and chat selection
 * - ScrollArea: Custom scrollable container for chat list
 */
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Lucide Icons for UI elements
 * - Plus: New chat button
 * - MessageSquare: Chat item icon
 * - Settings: Settings menu item
 * - HelpCircle: Help menu item
 * - Menu: Mobile menu toggle (unused)
 * - X: Close sidebar button
 * - History: Activity menu item
 * - Sparkles: AI branding (unused)
 */
import { 
  Plus, 
  MessageSquare, 
  Settings, 
  HelpCircle, 
  Menu, 
  X,
  History,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Bug,
  Terminal,
  Code,
  Music,
  Mic,
  Image,
  Cloud,
  FileCode,
  TestTube,
  Globe,
  Radio,
  RefreshCw
} from "lucide-react";

import { useAppSession } from "@/hooks/use-app-session";

import { Link, useLocation } from "wouter";

/**
 * Nebula logo image asset
 */
import logo from "@assets/generated_images/cute_cat_logo_icon.png";

/**
 * Chat type from shared schema
 */
import type { Chat } from "@shared/schema";

/**
 * date-fns utility for relative time formatting
 */
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the Sidebar component
 * 
 * @property {boolean} isOpen - Whether sidebar is visible (mobile only)
 * @property {(open: boolean) => void} setIsOpen - Toggle sidebar visibility
 * @property {() => void} onNewChat - Callback to create a new chat
 * @property {Chat[]} chats - Array of chat sessions to display
 * @property {string | null} currentChatId - ID of currently selected chat
 * @property {(chatId: string) => void} onChatSelect - Callback when chat is selected
 */
interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onNewChat: () => void;
  chats: Chat[];
  currentChatId: string | null;
  onChatSelect: (chatId: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

/**
 * Sidebar Component - Chat History Navigation
 * 
 * A responsive sidebar that provides navigation through chat history.
 * On mobile, it slides in from the left with a backdrop overlay.
 * On desktop (lg breakpoint), it's always visible.
 * 
 * Features:
 * - Time-based grouping (Today, Yesterday, Previous 7 Days, Older)
 * - Active chat highlighting
 * - Smooth slide-in animation for mobile
 * - Scrollable chat list with custom scrollbar
 * - Footer with help, activity, and settings
 * 
 * @param {SidebarProps} props - Component properties
 * @returns {JSX.Element} The sidebar component
 * 
 * @example
 * <Sidebar
 *   isOpen={isSidebarOpen}
 *   setIsOpen={setIsSidebarOpen}
 *   onNewChat={handleNewChat}
 *   chats={chatList}
 *   currentChatId={activeChat}
 *   onChatSelect={handleChatSelect}
 * />
 */
export function Sidebar({ isOpen, setIsOpen, onNewChat, chats, currentChatId, onChatSelect, isCollapsed, setIsCollapsed }: SidebarProps) {
  const [location] = useLocation();
  const { liveMode, revision, uiRevision, refresh, isLoading, googleConnected, githubConnected } = useAppSession();
  
  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle chat item click
   * Selects the chat and closes the sidebar on mobile
   * 
   * @param {string} chatId - ID of the clicked chat
   */
  const handleChatClick = (chatId: string) => {
    onChatSelect(chatId);
    setIsOpen(false); // Close sidebar on mobile after selection
  };

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  /**
   * Group chats by time period
   * 
   * Categorizes chats into 4 groups based on their updatedAt timestamp:
   * - Today: Updated within last 24 hours
   * - Yesterday: Updated 24-48 hours ago
   * - Previous 7 Days: Updated 2-7 days ago
   * - Older: Updated more than 7 days ago
   * 
   * @returns {Object} Object with arrays for each time period
   */
  const groupChatsByDate = () => {
    const now = new Date();
    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const previous7Days: Chat[] = [];
    const older: Chat[] = [];

    // Iterate through all chats and categorize by age
    (chats || []).forEach((chat) => {
      const chatDate = new Date(chat.updatedAt);
      const diffInMs = now.getTime() - chatDate.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);
      const diffInDays = diffInHours / 24;

      // Categorize based on time difference
      if (diffInHours < 24) {
        today.push(chat);
      } else if (diffInDays < 2) {
        yesterday.push(chat);
      } else if (diffInDays < 7) {
        previous7Days.push(chat);
      } else {
        older.push(chat);
      }
    });

    return { today, yesterday, previous7Days, older };
  };

  // Group chats for rendering
  const { today, yesterday, previous7Days, older } = groupChatsByDate();

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <>
      {/* 
       * Mobile Overlay Backdrop
       * Semi-transparent background that closes sidebar when clicked
       * Only visible on mobile (hidden on lg+)
       */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden",
          isOpen ? "block" : "hidden"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* 
       * Sidebar Container
       * Fixed position on mobile, static on desktop
       * Slides in/out on mobile with transform animation
       * Collapsible on desktop (w-72 expanded, w-16 collapsed)
       */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-secondary/30 border-r border-border backdrop-blur-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "lg:w-16" : "w-72"
        )}
      >
        {/* 
         * Header Section
         * Contains close button (mobile), logo/branding, and collapse toggle (desktop)
         */}
        <div className={cn("p-4 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {/* Close button - only visible on mobile */}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
          
          {/* Logo and Brand Name */}
          <div className={cn("flex items-center gap-3", isCollapsed ? "px-0" : "px-2")}>
             <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg" />
             {!isCollapsed && <span className="font-display font-semibold text-lg tracking-tight">Meowstic</span>}
          </div>
          
          {/* Collapse toggle button - only visible on desktop */}
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("hidden lg:flex", isCollapsed && "absolute right-2 top-4")}
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-testid="button-collapse-sidebar"
          >
            {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>

        {/* 
         * New Chat Button
         * Prominently displayed action to create a new conversation
         */}
        <div className={cn("mb-4", isCollapsed ? "px-2" : "px-4")}>
          <Button 
            onClick={onNewChat}
            className={cn(
              "rounded-full bg-secondary/50 text-foreground hover:bg-secondary border border-transparent hover:border-border/50 shadow-none transition-all",
              isCollapsed ? "w-12 h-12 p-0 justify-center" : "w-full justify-start gap-3 h-12"
            )}
            variant="secondary"
            data-testid="button-new-chat"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
            {!isCollapsed && <span className="font-medium">New discussion</span>}
          </Button>
        </div>

        {/* 
         * Chat History List (Scrollable)
         * Grouped by time period with section headers
         * Hidden when collapsed on desktop
         */}
        <ScrollArea className={cn("flex-1", isCollapsed ? "px-2" : "px-4")}>
          <div className="space-y-6 py-2">
            
            {/* TODAY section */}
            {today.length > 0 && (
              <div>
                {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2">Today</h3>}
                <div className="space-y-1">
                  {today.map((chat) => (
                    <Button
                      key={chat.id}
                      data-testid={`button-chat-${chat.id}`}
                      variant="ghost"
                      onClick={() => handleChatClick(chat.id)}
                      title={isCollapsed ? chat.title : undefined}
                      className={cn(
                        "font-normal text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg overflow-hidden",
                        isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3 h-9 px-2",
                        currentChatId === chat.id && "bg-secondary/50 text-foreground"
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{chat.title}</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {/* YESTERDAY section */}
            {yesterday.length > 0 && (
              <div>
                {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2">Yesterday</h3>}
                <div className="space-y-1">
                  {yesterday.map((chat) => (
                    <Button
                      key={chat.id}
                      data-testid={`button-chat-${chat.id}`}
                      variant="ghost"
                      onClick={() => handleChatClick(chat.id)}
                      title={isCollapsed ? chat.title : undefined}
                      className={cn(
                        "font-normal text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg overflow-hidden",
                        isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3 h-9 px-2",
                        currentChatId === chat.id && "bg-secondary/50 text-foreground"
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{chat.title}</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIOUS 7 DAYS section */}
            {previous7Days.length > 0 && (
              <div>
                {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2">Previous 7 Days</h3>}
                <div className="space-y-1">
                  {previous7Days.map((chat) => (
                    <Button
                      key={chat.id}
                      data-testid={`button-chat-${chat.id}`}
                      variant="ghost"
                      onClick={() => handleChatClick(chat.id)}
                      title={isCollapsed ? chat.title : undefined}
                      className={cn(
                        "font-normal text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg overflow-hidden",
                        isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3 h-9 px-2",
                        currentChatId === chat.id && "bg-secondary/50 text-foreground"
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{chat.title}</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* OLDER section */}
            {older.length > 0 && (
              <div>
                {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2">Older</h3>}
                <div className="space-y-1">
                  {older.map((chat) => (
                    <Button
                      key={chat.id}
                      data-testid={`button-chat-${chat.id}`}
                      variant="ghost"
                      onClick={() => handleChatClick(chat.id)}
                      title={isCollapsed ? chat.title : undefined}
                      className={cn(
                        "font-normal text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg overflow-hidden",
                        isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3 h-9 px-2",
                        currentChatId === chat.id && "bg-secondary/50 text-foreground"
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{chat.title}</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 
         * Footer Section
         * Contains action buttons and status information
         * Scrollable to accommodate all tools on small screens
         */}
        <ScrollArea className="mt-auto border-t border-border/50 max-h-[50vh]">
        <div className={cn("space-y-1", isCollapsed ? "p-2" : "p-4")}>
          {/* AI Studio Section Header */}
          {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-2">AI Studio</h3>}
          
          {/* Image Studio Button */}
          <Link href="/image">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/image" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Image Studio" : undefined}
              data-testid="button-image"
            >
              <Image className="h-4 w-4" />
              {!isCollapsed && "Image Studio"}
            </Button>
          </Link>
          
          {/* Music Generation Button */}
          <Link href="/music">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/music" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Music Generation" : undefined}
              data-testid="button-music"
            >
              <Music className="h-4 w-4" />
              {!isCollapsed && "Music Generation"}
            </Button>
          </Link>
          
          {/* Speech Generation Button */}
          <Link href="/speech">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/speech" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Speech Generation" : undefined}
              data-testid="button-speech"
            >
              <Mic className="h-4 w-4" />
              {!isCollapsed && "Speech Generation"}
            </Button>
          </Link>
          
          {/* Google Services Button */}
          <Link href="/google">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/google" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Google Services" : undefined}
              data-testid="button-google"
            >
              <Cloud className="h-4 w-4" />
              {!isCollapsed && "Google Services"}
            </Button>
          </Link>
          
          {/* Tools Section Header */}
          {!isCollapsed && <h3 className="text-xs font-semibold text-muted-foreground mb-2 mt-4 px-2">Tools</h3>}
          
          {/* Python Sandbox Button */}
          <Link href="/python">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/python" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Python Sandbox" : undefined}
              data-testid="button-python"
            >
              <FileCode className="h-4 w-4" />
              {!isCollapsed && "Python Sandbox"}
            </Button>
          </Link>
          
          {/* Playwright Testing Button */}
          <Link href="/testing">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/testing" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Playwright Testing" : undefined}
              data-testid="button-testing"
            >
              <TestTube className="h-4 w-4" />
              {!isCollapsed && "Playwright Testing"}
            </Button>
          </Link>
          
          {/* Web Search Button */}
          <Link href="/search">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/search" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Web Search" : undefined}
              data-testid="button-web-search"
            >
              <Globe className="h-4 w-4" />
              {!isCollapsed && "Web Search"}
            </Button>
          </Link>
          
          {/* Help & FAQ Button */}
          <Link href="/help">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/help" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Help & FAQ" : undefined}
              data-testid="button-help"
            >
              <HelpCircle className="h-4 w-4" />
              {!isCollapsed && "Help & FAQ"}
            </Button>
          </Link>
          
          {/* Editor Button */}
          <Link href="/editor">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/editor" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Editor" : undefined}
              data-testid="button-editor"
            >
              <Code className="h-4 w-4" />
              {!isCollapsed && "Editor"}
            </Button>
          </Link>
          
          {/* Terminal Button */}
          <Link href="/terminal">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/terminal" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Terminal" : undefined}
              data-testid="button-terminal"
            >
              <Terminal className="h-4 w-4" />
              {!isCollapsed && "Terminal"}
            </Button>
          </Link>
          
          {/* Debug Button (was Activity) */}
          <Link href="/debug">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/debug" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Debug" : undefined}
              data-testid="button-debug"
            >
              <Bug className="h-4 w-4" />
              {!isCollapsed && "Debug"}
            </Button>
          </Link>
          
          {/* Settings Button */}
          <Link href="/settings">
            <Button 
              variant="ghost" 
              className={cn(
                "font-normal text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-12 h-9 p-0 justify-center" : "w-full justify-start gap-3",
                location === "/settings" && "bg-secondary/50 text-foreground"
              )}
              title={isCollapsed ? "Settings" : undefined}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4" />
              {!isCollapsed && "Settings"}
            </Button>
          </Link>
          
        </div>
        </ScrollArea>
        
        {/* Status Bar - ALWAYS VISIBLE at bottom, outside ScrollArea */}
        <div className={cn("border-t border-border/50 shrink-0", isCollapsed ? "p-2" : "p-4")}>
          {!isCollapsed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs gap-1.5",
                    liveMode 
                      ? "text-green-500 hover:text-green-400" 
                      : "text-amber-500 hover:text-amber-400"
                  )}
                  onClick={refresh}
                  disabled={isLoading}
                  data-testid="button-live-mode"
                  title={liveMode ? "Live Mode - Connected to production" : "Dev Mode - Local development"}
                >
                  <Radio className={cn("h-3 w-3", isLoading && "animate-pulse")} />
                  {liveMode ? "LIVE" : "DEV"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={refresh}
                  disabled={isLoading}
                  data-testid="button-refresh-status"
                  title="Refresh status"
                >
                  <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                </Button>
                <span className="text-xs text-muted-foreground/70 ml-auto font-mono" data-testid="text-revision">
                  Rev {revision}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full",
                    googleConnected 
                      ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" 
                      : "bg-gray-400"
                  )}
                  title={googleConnected ? "Google Connected" : "Google Not Connected"}
                />
                <span className="text-muted-foreground/60">Google</span>
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full ml-2",
                    githubConnected 
                      ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" 
                      : "bg-gray-400"
                  )}
                  title={githubConnected ? "GitHub Connected" : "GitHub Not Connected"}
                />
                <span className="text-muted-foreground/60">GitHub</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex flex-col items-center">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-8 h-8 p-0",
                  liveMode ? "text-green-500" : "text-amber-500"
                )}
                onClick={refresh}
                disabled={isLoading}
                data-testid="button-live-mode-collapsed"
                title={liveMode ? `LIVE Rev ${revision}` : `DEV Rev ${revision}`}
              >
                <Radio className={cn("h-4 w-4", isLoading && "animate-pulse")} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
