import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search, Globe, ExternalLink, Loader2, FileText, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

interface SearchState {
  status: "idle" | "searching" | "complete" | "error";
  results: SearchResult[];
  scrapedContent: ScrapeResult[];
  error: string | null;
}

export default function WebSearchPage() {
  const [query, setQuery] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "idle",
    results: [],
    scrapedContent: [],
    error: null
  });
  const [selectedResult, setSelectedResult] = useState<ScrapeResult | null>(null);
  const [scrapingUrl, setScrapingUrl] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setSearchState({
      status: "searching",
      results: [],
      scrapedContent: [],
      error: null
    });
    setSelectedResult(null);

    try {
      const response = await fetch("/api/web/search-and-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          maxResults: 10,
          scrapeFirst: 3
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Search failed");
      }

      setSearchState({
        status: "complete",
        results: data.searchResults || [],
        scrapedContent: data.scrapedContent || [],
        error: null
      });

      if (data.scrapedContent && data.scrapedContent.length > 0 && data.scrapedContent[0].success) {
        setSelectedResult(data.scrapedContent[0]);
      }
    } catch (error) {
      setSearchState({
        status: "error",
        results: [],
        scrapedContent: [],
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  }, [query]);

  const handleScrapeUrl = useCallback(async () => {
    if (!scrapeUrl.trim()) return;

    setScrapingUrl(scrapeUrl);

    try {
      const response = await fetch("/api/web/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to scrape URL");
      }

      setSelectedResult(data.data);
    } catch (error) {
      setSelectedResult({
        url: scrapeUrl,
        title: "",
        content: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setScrapingUrl(null);
    }
  }, [scrapeUrl]);

  const handleResultClick = useCallback(async (result: SearchResult) => {
    const existingScrape = searchState.scrapedContent.find(s => s.url === result.url);
    if (existingScrape) {
      setSelectedResult(existingScrape);
      return;
    }

    setScrapingUrl(result.url);

    try {
      const response = await fetch("/api/web/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url })
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setSelectedResult(data.data);
        setSearchState(prev => ({
          ...prev,
          scrapedContent: [...prev.scrapedContent, data.data]
        }));
      } else {
        setSelectedResult({
          url: result.url,
          title: result.title,
          content: "",
          success: false,
          error: data.error || "Failed to scrape content"
        });
      }
    } catch (error) {
      setSelectedResult({
        url: result.url,
        title: result.title,
        content: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setScrapingUrl(null);
    }
  }, [searchState.scrapedContent]);

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-web-search">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Web Search</h1>
          </div>
          <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
            Search & Extract Content
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="search" data-testid="tab-search">
              <Search className="h-4 w-4 mr-2" />
              Search Web
            </TabsTrigger>
            <TabsTrigger value="scrape" data-testid="tab-scrape">
              <FileText className="h-4 w-4 mr-2" />
              Scrape URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Web Search
                </CardTitle>
                <CardDescription>
                  Search the web and extract content from results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter your search query..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, handleSearch)}
                    className="flex-1"
                    data-testid="input-search-query"
                  />
                  <Button 
                    onClick={handleSearch}
                    disabled={!query.trim() || searchState.status === "searching"}
                    data-testid="button-search"
                  >
                    {searchState.status === "searching" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {searchState.status === "error" && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span data-testid="text-search-error">{searchState.error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {searchState.results.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Search Results</CardTitle>
                    <CardDescription>
                      {searchState.results.length} results found
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {searchState.results.map((result, index) => (
                          <div
                            key={index}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                              selectedResult?.url === result.url && "border-primary bg-primary/5",
                              scrapingUrl === result.url && "opacity-50"
                            )}
                            onClick={() => handleResultClick(result)}
                            data-testid={`card-result-${index}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-sm truncate" data-testid={`text-result-title-${index}`}>
                                  {result.title}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {result.url}
                                </p>
                                {result.snippet && (
                                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                    {result.snippet}
                                  </p>
                                )}
                              </div>
                              {scrapingUrl === result.url ? (
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              ) : (
                                <a 
                                  href={result.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Extracted Content</CardTitle>
                    <CardDescription>
                      {selectedResult ? selectedResult.title || "Content preview" : "Click a result to view content"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      {selectedResult ? (
                        selectedResult.success ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {selectedResult.content && selectedResult.content.length > 20000 && (
                              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mb-2">
                                Content truncated to first 20,000 characters for display
                              </p>
                            )}
                            <pre className="whitespace-pre-wrap text-sm font-sans" data-testid="text-scraped-content">
                              {selectedResult.content ? selectedResult.content.slice(0, 20000) : "No content extracted"}
                            </pre>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mb-2" />
                            <p className="text-sm" data-testid="text-scrape-error">{selectedResult.error || "Failed to extract content"}</p>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2" />
                          <p className="text-sm">Select a search result to view its content</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scrape" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Scrape URL
                </CardTitle>
                <CardDescription>
                  Extract content from a specific webpage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter URL to scrape (e.g., https://example.com)"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, handleScrapeUrl)}
                    className="flex-1"
                    data-testid="input-scrape-url"
                  />
                  <Button 
                    onClick={handleScrapeUrl}
                    disabled={!scrapeUrl.trim() || scrapingUrl !== null}
                    data-testid="button-scrape"
                  >
                    {scrapingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="ml-2">Extract</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedResult.title || "Extracted Content"}</CardTitle>
                  <CardDescription className="truncate">
                    {selectedResult.url}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {selectedResult.success ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {selectedResult.content && selectedResult.content.length > 20000 && (
                          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mb-2">
                            Content truncated to first 20,000 characters for display
                          </p>
                        )}
                        <pre className="whitespace-pre-wrap text-sm font-sans" data-testid="text-url-content">
                          {selectedResult.content ? selectedResult.content.slice(0, 20000) : "No content extracted"}
                        </pre>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
                        <p className="text-sm" data-testid="text-url-error">{selectedResult.error || "Failed to extract content"}</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
