import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Trash2, Camera, MousePointer, Type, Eye, Code, Globe, X } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TestResult {
  id: string;
  command: string;
  success: boolean;
  message: string;
  result?: unknown;
  timestamp: Date;
}

interface CommandTemplate {
  name: string;
  icon: React.ReactNode;
  endpoint: string;
  fields: { name: string; label: string; placeholder: string; required?: boolean }[];
}

const COMMANDS: CommandTemplate[] = [
  {
    name: "Navigate",
    icon: <Globe className="h-4 w-4" />,
    endpoint: "/api/playwright/navigate",
    fields: [{ name: "url", label: "URL", placeholder: "https://example.com", required: true }]
  },
  {
    name: "Click",
    icon: <MousePointer className="h-4 w-4" />,
    endpoint: "/api/playwright/click",
    fields: [{ name: "selector", label: "Selector", placeholder: "#button, .class, [data-testid='btn']", required: true }]
  },
  {
    name: "Type",
    icon: <Type className="h-4 w-4" />,
    endpoint: "/api/playwright/type",
    fields: [
      { name: "selector", label: "Selector", placeholder: "#input, .form-field", required: true },
      { name: "text", label: "Text", placeholder: "Text to type", required: true }
    ]
  },
  {
    name: "Screenshot",
    icon: <Camera className="h-4 w-4" />,
    endpoint: "/api/playwright/screenshot",
    fields: []
  },
  {
    name: "Wait",
    icon: <Eye className="h-4 w-4" />,
    endpoint: "/api/playwright/wait",
    fields: [{ name: "selector", label: "Selector", placeholder: "#element", required: true }]
  },
  {
    name: "Get Text",
    icon: <Type className="h-4 w-4" />,
    endpoint: "/api/playwright/getText",
    fields: [{ name: "selector", label: "Selector", placeholder: "#element", required: true }]
  },
  {
    name: "Evaluate",
    icon: <Code className="h-4 w-4" />,
    endpoint: "/api/playwright/evaluate",
    fields: [{ name: "script", label: "JavaScript", placeholder: "document.title", required: true }]
  }
];

export default function PlaywrightTestingPage() {
  const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
  const [isHeadless, setIsHeadless] = useState(true);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState(COMMANDS[0]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const addResult = useCallback((command: string, success: boolean, message: string, result?: unknown) => {
    setResults(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      command,
      success,
      message,
      result,
      timestamp: new Date()
    }]);
  }, []);

  const executeCommand = async () => {
    if (isRunning) return;

    for (const field of selectedCommand.fields) {
      if (field.required && !formData[field.name]) {
        addResult(selectedCommand.name, false, `${field.label} is required`, null);
        return;
      }
    }

    setIsRunning(true);

    try {
      const body: Record<string, unknown> = { sessionId };
      
      if (selectedCommand.name === "Navigate") {
        body.headless = isHeadless;
      }
      
      for (const field of selectedCommand.fields) {
        body[field.name] = formData[field.name];
      }

      const response = await fetch(selectedCommand.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.success && data.result?.base64) {
        setScreenshot(data.result.base64);
      }

      addResult(selectedCommand.name, data.success, data.message || data.error, data.result);
    } catch (error) {
      addResult(selectedCommand.name, false, error instanceof Error ? error.message : "Command failed", null);
    } finally {
      setIsRunning(false);
    }
  };

  const closeSession = async () => {
    try {
      await fetch("/api/playwright/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      setSessionId(`session_${Date.now()}`);
      setScreenshot(null);
      addResult("Close Session", true, "Session closed", null);
    } catch (error) {
      addResult("Close Session", false, "Failed to close session", null);
    }
  };

  const clearResults = () => {
    setResults([]);
    setScreenshot(null);
  };

  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
    }
  }, [results]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1 flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Play className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Playwright Testing</h1>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="text-muted-foreground text-sm">
            Automated browser testing with Playwright. Session: <code className="bg-secondary px-2 py-0.5 rounded">{sessionId.slice(0, 20)}...</code>
          </p>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 mr-4">
              <Switch
                id="headless"
                checked={isHeadless}
                onCheckedChange={setIsHeadless}
                data-testid="switch-headless"
              />
              <Label htmlFor="headless" className="text-sm">Headless</Label>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={closeSession}
              data-testid="button-close-session"
            >
              <X className="h-4 w-4 mr-2" />
              Close Session
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearResults}
              data-testid="button-clear-results"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-4">Commands</h3>
              
              <Tabs value={selectedCommand.name} onValueChange={(v) => {
                const cmd = COMMANDS.find(c => c.name === v);
                if (cmd) {
                  setSelectedCommand(cmd);
                  setFormData({});
                }
              }}>
                <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full mb-4">
                  {COMMANDS.map(cmd => (
                    <TabsTrigger key={cmd.name} value={cmd.name} className="text-xs">
                      {cmd.icon}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {COMMANDS.map(cmd => (
                  <TabsContent key={cmd.name} value={cmd.name} className="space-y-3">
                    <h4 className="font-medium text-sm">{cmd.name}</h4>
                    {cmd.fields.map(field => (
                      <div key={field.name}>
                        <Label htmlFor={field.name} className="text-xs">{field.label}</Label>
                        <Input
                          id={field.name}
                          placeholder={field.placeholder}
                          value={formData[field.name] || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                          className="mt-1"
                          data-testid={`input-${field.name}`}
                        />
                      </div>
                    ))}
                    {cmd.fields.length === 0 && (
                      <p className="text-sm text-muted-foreground">No additional parameters required.</p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>

              <Button
                onClick={executeCommand}
                disabled={isRunning}
                className="w-full mt-4"
                data-testid="button-execute-command"
              >
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? "Running..." : `Execute ${selectedCommand.name}`}
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-[#1e1e1e] overflow-hidden flex-1 min-h-[300px]">
              <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
                <span className="text-[#888] text-xs font-mono">Results</span>
                <span className="text-[#888] text-xs">{results.length} commands</span>
              </div>
              <ScrollArea className="h-[300px]">
                <div ref={resultsRef} className="p-4 font-mono text-sm space-y-2" data-testid="results-area">
                  {results.length === 0 ? (
                    <span className="text-muted-foreground">Execute a command to see results...</span>
                  ) : (
                    results.map((result) => (
                      <div key={result.id} className={cn(
                        "p-2 rounded border-l-2",
                        result.success ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
                      )}>
                        <div className="flex items-center gap-2">
                          <span className={result.success ? "text-green-400" : "text-red-400"}>
                            {result.success ? "✓" : "✗"}
                          </span>
                          <span className="font-semibold">{result.command}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {result.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs mt-1 text-gray-400">{result.message}</p>
                        {result.result && typeof result.result === "object" && !("base64" in (result.result as Record<string, unknown>)) && (
                          <pre className="text-xs mt-1 text-gray-500 overflow-x-auto">
                            {JSON.stringify(result.result, null, 2) as string}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
              <span className="text-[#888] text-xs font-mono">Screenshot Preview</span>
            </div>
            <div className="p-4 flex items-center justify-center min-h-[500px] bg-[#1a1a1a]">
              {screenshot ? (
                <img 
                  src={screenshot} 
                  alt="Browser screenshot" 
                  className="max-w-full max-h-[500px] rounded border border-border shadow-lg"
                  data-testid="screenshot-preview"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No screenshot yet</p>
                  <p className="text-xs">Navigate to a page and take a screenshot</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>Tips: Start with Navigate to open a page. Use CSS selectors or data-testid attributes for interactions. Screenshots are captured in PNG format.</p>
        </div>
      </div>
    </div>
  );
}
