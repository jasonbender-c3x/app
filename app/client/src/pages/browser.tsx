import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Globe, 
  ExternalLink, 
  Loader2, 
  RefreshCw, 
  ArrowRight,
  Home,
  X,
  Image,
  Play,
  Pause
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface BrowserSession {
  sessionId: string;
  url: string;
  screenshotUrl: string | null;
  isLoading: boolean;
  title: string;
  error: string | null;
  needsConfig?: boolean;
}

interface NavigationHistory {
  back: string[];
  forward: string[];
  current: string;
}

export default function BrowserPage() {
  const [urlInput, setUrlInput] = useState("https://www.google.com");
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [history, setHistory] = useState<NavigationHistory>({
    back: [],
    forward: [],
    current: ""
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const normalizeUrl = (url: string): string => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  };

  const loadPage = useCallback(async (url: string, addToHistory: boolean = true) => {
    const normalizedUrl = normalizeUrl(url);
    setIsNavigating(true);
    setUrlInput(normalizedUrl);

    setSession(prev => prev ? { ...prev, isLoading: true, error: null } : {
      sessionId: "",
      url: normalizedUrl,
      screenshotUrl: null,
      isLoading: true,
      title: "Loading...",
      error: null
    });

    try {
      const response = await fetch("/api/browser/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load page");
      }

      if (addToHistory && history.current && history.current !== normalizedUrl) {
        setHistory(prev => ({
          back: [...prev.back, prev.current],
          forward: [],
          current: normalizedUrl
        }));
      } else if (!history.current) {
        setHistory(prev => ({ ...prev, current: normalizedUrl }));
      }

      setSession({
        sessionId: data.sessionId,
        url: normalizedUrl,
        screenshotUrl: data.screenshotUrl || null,
        isLoading: false,
        title: data.title || normalizedUrl,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const needsConfig = errorMessage.includes("not configured");
      setSession(prev => ({
        sessionId: prev?.sessionId || "",
        url: normalizedUrl,
        screenshotUrl: null,
        isLoading: false,
        title: "Error",
        error: errorMessage,
        needsConfig
      }));
    } finally {
      setIsNavigating(false);
    }
  }, [history.current]);

  const handleNavigate = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (urlInput.trim()) {
      loadPage(urlInput.trim());
    }
  };

  const handleBack = () => {
    if (history.back.length > 0) {
      const previousUrl = history.back[history.back.length - 1];
      setHistory(prev => ({
        back: prev.back.slice(0, -1),
        forward: [prev.current, ...prev.forward],
        current: previousUrl
      }));
      loadPage(previousUrl, false);
    }
  };

  const handleForward = () => {
    if (history.forward.length > 0) {
      const nextUrl = history.forward[0];
      setHistory(prev => ({
        back: [...prev.back, prev.current],
        forward: prev.forward.slice(1),
        current: nextUrl
      }));
      loadPage(nextUrl, false);
    }
  };

  const handleRefresh = () => {
    if (session?.url) {
      loadPage(session.url, false);
    }
  };

  const handleHome = () => {
    loadPage("https://www.google.com");
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  useEffect(() => {
    if (autoRefresh && session?.url) {
      refreshIntervalRef.current = setInterval(() => {
        handleRefresh();
      }, 5000);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, session?.url]);

  const quickLinks = [
    { name: "Google", url: "https://www.google.com" },
    { name: "GitHub", url: "https://github.com" },
    { name: "Wikipedia", url: "https://www.wikipedia.org" },
    { name: "Reddit", url: "https://www.reddit.com" },
    { name: "HackerNews", url: "https://news.ycombinator.com" },
    { name: "Stack Overflow", url: "https://stackoverflow.com" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="browser-page">
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Web Browser
          </h1>
        </div>
      </header>

      <div className="border-b bg-muted/30 px-4 py-2">
        <form onSubmit={handleNavigate} className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleBack}
              disabled={history.back.length === 0 || isNavigating}
              data-testid="button-nav-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleForward}
              disabled={history.forward.length === 0 || isNavigating}
              data-testid="button-nav-forward"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={!session?.url || isNavigating}
              data-testid="button-refresh"
            >
              {isNavigating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleHome}
              disabled={isNavigating}
              data-testid="button-home"
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="pl-10 pr-10"
              data-testid="input-url"
            />
            {urlInput && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setUrlInput("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <Button type="submit" disabled={isNavigating} data-testid="button-go">
            {isNavigating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
          </Button>

          <Button
            type="button"
            variant={autoRefresh ? "default" : "outline"}
            size="icon"
            onClick={toggleAutoRefresh}
            title={autoRefresh ? "Stop auto-refresh" : "Start auto-refresh (5s)"}
            data-testid="button-auto-refresh"
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      <div className="flex-1 flex flex-col">
        {!session ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="w-full max-w-2xl">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                  <Globe className="h-8 w-8 text-primary" />
                  Headed Browser
                </CardTitle>
                <p className="text-muted-foreground">
                  Enter a URL above to browse the web with screenshots
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {quickLinks.map((link) => (
                    <Button
                      key={link.url}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-1"
                      onClick={() => loadPage(link.url)}
                      data-testid={`button-quicklink-${link.name.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <Globe className="h-5 w-5" />
                      <span className="text-xs">{link.name}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {session.isLoading && (
              <div className="h-1 bg-muted overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full" />
              </div>
            )}

            {session.error ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Card className={cn("w-full max-w-md", session.needsConfig ? "border-amber-500" : "border-destructive")}>
                  <CardContent className="pt-6 text-center">
                    <div className={cn(
                      "inline-flex items-center justify-center w-12 h-12 rounded-full mb-4",
                      session.needsConfig ? "bg-amber-500/10" : "bg-destructive/10"
                    )}>
                      {session.needsConfig ? (
                        <Globe className="h-6 w-6 text-amber-500" />
                      ) : (
                        <X className="h-6 w-6 text-destructive" />
                      )}
                    </div>
                    <h3 className="font-semibold mb-2">
                      {session.needsConfig ? "Browser Not Configured" : "Failed to load page"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">{session.error}</p>
                    {session.needsConfig ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          The browser requires Browserbase API credentials to capture screenshots.
                        </p>
                        <a
                          href="https://www.browserbase.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Get Browserbase API keys
                        </a>
                      </div>
                    ) : (
                      <Button onClick={() => loadPage(session.url, false)} data-testid="button-retry">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : session.screenshotUrl ? (
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <div className="relative bg-card border rounded-lg overflow-hidden shadow-lg">
                    <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      </div>
                      <span className="text-sm font-medium truncate flex-1">{session.title}</span>
                      <a
                        href={session.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open in new tab
                      </a>
                    </div>
                    <img
                      src={session.screenshotUrl}
                      alt={`Screenshot of ${session.url}`}
                      className="w-full h-auto"
                      data-testid="img-screenshot"
                    />
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No screenshot available</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
