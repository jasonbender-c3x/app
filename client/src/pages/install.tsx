import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Chrome, 
  Monitor, 
  Download, 
  ExternalLink, 
  Check, 
  Copy,
  Terminal,
  Apple,
  Laptop
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function InstallPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="install-page">
      <header className="border-b">
        <div className="container py-6">
          <div className="flex items-center gap-4">
            <Link href="/landing">
              <Button variant="ghost" size="sm" data-testid="button-back">
                ← Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Install Meowstik Tools</h1>
              <p className="text-muted-foreground">Browser extension and desktop agent</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="extension" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="extension" className="gap-2" data-testid="tab-extension">
              <Chrome className="h-4 w-4" />
              Browser Extension
            </TabsTrigger>
            <TabsTrigger value="desktop" className="gap-2" data-testid="tab-desktop">
              <Monitor className="h-4 w-4" />
              Desktop Agent
            </TabsTrigger>
          </TabsList>

          {/* Browser Extension Tab */}
          <TabsContent value="extension">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Chrome className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle>Meowstik AI Assistant</CardTitle>
                      <CardDescription>Chrome browser extension</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">v1.0.0</Badge>
                    <Badge variant="outline">Chrome</Badge>
                    <Badge variant="outline">Edge</Badge>
                    <Badge variant="outline">Brave</Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Add AI assistance to any webpage. Chat with AI, capture screens, 
                    and analyze page content directly from your browser.
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Features:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Popup chat interface
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Screen capture sharing
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Page content analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Right-click context menu
                      </li>
                    </ul>
                  </div>

                  <Separator />

                  <Button className="w-full gap-2" data-testid="button-download-extension">
                    <Download className="h-4 w-4" />
                    Download Extension (.zip)
                  </Button>
                  
                  <Link href="/docs/install-browser-extension">
                    <Button variant="outline" className="w-full gap-2" data-testid="button-extension-docs">
                      <ExternalLink className="h-4 w-4" />
                      View Installation Guide
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Installation Steps</CardTitle>
                  <CardDescription>Load the extension in developer mode</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <ol className="space-y-4 text-sm">
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                        <div>
                          <p className="font-medium">Download the extension</p>
                          <p className="text-muted-foreground">Click the download button and extract the ZIP file</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                        <div>
                          <p className="font-medium">Open Chrome Extensions</p>
                          <p className="text-muted-foreground">Navigate to chrome://extensions in your browser</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                        <div>
                          <p className="font-medium">Enable Developer Mode</p>
                          <p className="text-muted-foreground">Toggle the switch in the top right corner</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">4</span>
                        <div>
                          <p className="font-medium">Load Unpacked</p>
                          <p className="text-muted-foreground">Click "Load unpacked" and select the extracted folder</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">5</span>
                        <div>
                          <p className="font-medium">Pin the Extension</p>
                          <p className="text-muted-foreground">Click the puzzle icon and pin Meowstik for easy access</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">6</span>
                        <div>
                          <p className="font-medium">Connect to Meowstik</p>
                          <p className="text-muted-foreground">Open the extension and enter your authentication token</p>
                        </div>
                      </li>
                    </ol>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Desktop Agent Tab */}
          <TabsContent value="desktop">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Monitor className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle>Meowstik Desktop Agent</CardTitle>
                      <CardDescription>Full desktop control for AI collaboration</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">v1.0.0</Badge>
                    <Badge variant="outline">Windows</Badge>
                    <Badge variant="outline">macOS</Badge>
                    <Badge variant="outline">Linux</Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Enable AI control of your entire desktop. Screen capture, mouse control, 
                    and keyboard input for hands-free collaboration.
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Features:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Real-time screen streaming
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Mouse and keyboard control
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Works with any application
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Secure WebSocket connection
                      </li>
                    </ul>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="flex-col h-auto py-3" data-testid="button-download-windows">
                      <Laptop className="h-5 w-5 mb-1" />
                      <span className="text-xs">Windows</span>
                    </Button>
                    <Button variant="outline" className="flex-col h-auto py-3" data-testid="button-download-macos">
                      <Apple className="h-5 w-5 mb-1" />
                      <span className="text-xs">macOS</span>
                    </Button>
                    <Button variant="outline" className="flex-col h-auto py-3" data-testid="button-download-linux">
                      <Terminal className="h-5 w-5 mb-1" />
                      <span className="text-xs">Linux</span>
                    </Button>
                  </div>
                  
                  <Link href="/docs/install-desktop-agent">
                    <Button variant="outline" className="w-full gap-2" data-testid="button-desktop-docs">
                      <ExternalLink className="h-4 w-4" />
                      View Installation Guide
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Install (npm)</CardTitle>
                  <CardDescription>Install via npm or run with npx</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Global Install:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted p-3 rounded text-sm font-mono">
                        npm install -g meowstik-agent
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard("npm install -g meowstik-agent", "npm")}
                        data-testid="button-copy-npm"
                      >
                        {copiedCommand === "npm" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Run with npx (no install):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
                        npx meowstik-agent --token TOKEN
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard("npx meowstik-agent --token YOUR_TOKEN --server wss://your-app.replit.app", "npx")}
                        data-testid="button-copy-npx"
                      >
                        {copiedCommand === "npx" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Requirements:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Node.js 18 or higher</li>
                      <li>• Build tools for robotjs (see docs)</li>
                      <li>• Screen recording permission (macOS)</li>
                      <li>• Accessibility permission (macOS)</li>
                    </ul>
                  </div>

                  <Separator />

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Get Your Session Token</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Start a desktop session in Meowstik to get your token
                    </p>
                    <Link href="/collaborate">
                      <Button size="sm" className="w-full gap-2" data-testid="button-start-session">
                        Start Desktop Session
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
