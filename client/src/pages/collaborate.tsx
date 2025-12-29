import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Monitor, 
  Globe, 
  MousePointer2, 
  Keyboard, 
  Volume2, 
  VolumeX,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Settings,
  Play,
  Square,
  RefreshCw,
  Download,
  Upload,
  Cpu,
  User,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Laptop,
  Smartphone,
  ArrowLeft,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Lock,
  Unlock,
  Zap,
  Brain
} from "lucide-react";
import { Link } from "wouter";

interface Message {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
}

interface SessionState {
  connected: boolean;
  mode: "headless" | "desktop" | null;
  controlling: "user" | "ai" | "shared";
  audioEnabled: boolean;
  aiVisionEnabled: boolean;
}

export default function CollaboratePage() {
  const { toast } = useToast();
  const [session, setSession] = useState<SessionState>({
    connected: false,
    mode: null,
    controlling: "shared",
    audioEnabled: true,
    aiVisionEnabled: true,
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "system",
      content: "Welcome to AI Desktop Collaboration. Connect to a headless browser or your desktop to get started.",
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [desktopHost, setDesktopHost] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startHeadlessBrowser = async () => {
    toast({ title: "Starting headless browser...", description: "Connecting to Browserbase" });
    
    setSession(prev => ({ ...prev, connected: true, mode: "headless" }));
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "system",
      content: "Headless browser started. The AI can now see and interact with the browser. You can monitor the screen and chat with the AI.",
      timestamp: new Date(),
    }]);
  };

  const connectDesktop = async () => {
    if (!desktopHost) {
      toast({ title: "Enter desktop agent address", variant: "destructive" });
      return;
    }
    
    toast({ title: "Connecting to desktop...", description: `Connecting to ${desktopHost}` });
    
    setSession(prev => ({ ...prev, connected: true, mode: "desktop" }));
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "system",
      content: `Connected to desktop at ${desktopHost}. Both you and the AI can see and control the desktop. Audio is being shared.`,
      timestamp: new Date(),
    }]);
  };

  const disconnect = () => {
    setSession({ connected: false, mode: null, controlling: "shared", audioEnabled: true, aiVisionEnabled: true });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "system",
      content: "Disconnected from session.",
      timestamp: new Date(),
    }]);
  };

  const sendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage("");

    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "I can see the screen. Let me help you with that task. I'll click on the button now...",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  const copyAgentCommand = () => {
    navigator.clipboard.writeText("npx meowstik-agent --token YOUR_SESSION_TOKEN");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">AI Desktop Collaboration</h1>
          </div>
          {session.connected && (
            <Badge variant={session.mode === "headless" ? "secondary" : "default"} className="ml-2">
              {session.mode === "headless" ? (
                <><Globe className="h-3 w-3 mr-1" /> Headless Browser</>
              ) : (
                <><Monitor className="h-3 w-3 mr-1" /> Desktop</>
              )}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {session.connected && (
            <>
              <Badge variant="outline" className="gap-1">
                <Wifi className="h-3 w-3 text-green-500" />
                Connected
              </Badge>
              <Button variant="destructive" size="sm" onClick={disconnect} data-testid="button-disconnect">
                <Square className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {!session.connected ? (
          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="max-w-4xl w-full space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Connect to a Screen</h2>
                <p className="text-muted-foreground">
                  Choose how you want the AI to see and interact with a computer
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="hover:border-primary transition-colors cursor-pointer" onClick={startHeadlessBrowser} data-testid="card-headless-browser">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-500" />
                      Headless Browser
                    </CardTitle>
                    <CardDescription>
                      Spawn a cloud browser that both you and AI can see and control
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>No installation required</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Powered by Browserbase</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>View via VNC in browser</span>
                      </div>
                    </div>
                    <Button className="w-full" data-testid="button-start-headless">
                      <Play className="h-4 w-4 mr-2" />
                      Start Browser Session
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:border-primary transition-colors" data-testid="card-desktop">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-purple-500" />
                      Your Desktop
                    </CardTitle>
                    <CardDescription>
                      Connect to your Windows, Mac, or Linux computer
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Full desktop access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Shared audio + video</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>TeamViewer-style collaboration</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Desktop Agent Address</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="192.168.1.100:9000"
                          value={desktopHost}
                          onChange={(e) => setDesktopHost(e.target.value)}
                          data-testid="input-desktop-host"
                        />
                        <Button onClick={connectDesktop} data-testid="button-connect-desktop">
                          <Zap className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">First time? Install the agent:</Label>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono truncate">
                          npx meowstik-agent --token YOUR_TOKEN
                        </code>
                        <Button variant="outline" size="icon" onClick={copyAgentCommand} data-testid="button-copy-agent">
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Data Flow Architecture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────────┐
│                    BIDIRECTIONAL DATA FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER ──text/voice──► LLM ──mouse/keyboard──► DESKTOP           │
│    ▲                    ▲                         │              │
│    │                    │                         │              │
│    └──text/TTS──────────┘                         │              │
│                                                   │              │
│                    ┌──────────────────────────────┘              │
│                    ▼                                             │
│              VIDEO + AUDIO                                       │
│                    │                                             │
│           ┌───────┴───────┐                                      │
│           ▼               ▼                                      │
│         USER            LLM                                      │
│       (monitor)       (vision)                                   │
└─────────────────────────────────────────────────────────────────┘`}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col bg-black relative">
              <div className="absolute top-2 left-2 z-10 flex gap-2">
                <Badge variant="secondary" className="bg-black/70 text-white">
                  <Eye className="h-3 w-3 mr-1" />
                  AI Vision: {session.aiVisionEnabled ? "ON" : "OFF"}
                </Badge>
                <Badge variant="secondary" className="bg-black/70 text-white">
                  {session.controlling === "user" ? (
                    <><User className="h-3 w-3 mr-1" /> You Control</>
                  ) : session.controlling === "ai" ? (
                    <><Cpu className="h-3 w-3 mr-1" /> AI Controls</>
                  ) : (
                    <><Unlock className="h-3 w-3 mr-1" /> Shared Control</>
                  )}
                </Badge>
              </div>

              <div className="absolute top-2 right-2 z-10 flex gap-2">
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 bg-black/70"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  data-testid="button-fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full h-full max-w-[1280px] max-h-[720px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 flex items-center justify-center">
                  <div className="text-center text-slate-400 space-y-4">
                    <Monitor className="h-16 w-16 mx-auto opacity-50" />
                    <p className="text-sm">
                      {session.mode === "headless" 
                        ? "Headless browser framebuffer will appear here" 
                        : "Desktop framebuffer will appear here"}
                    </p>
                    <p className="text-xs opacity-60">
                      VNC/WebRTC stream loading...
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-black/90 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="audio" 
                      checked={session.audioEnabled}
                      onCheckedChange={(v) => setSession(prev => ({ ...prev, audioEnabled: v }))}
                    />
                    <Label htmlFor="audio" className="text-white text-sm flex items-center gap-1">
                      {session.audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      Audio
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="aiVision" 
                      checked={session.aiVisionEnabled}
                      onCheckedChange={(v) => setSession(prev => ({ ...prev, aiVisionEnabled: v }))}
                    />
                    <Label htmlFor="aiVision" className="text-white text-sm flex items-center gap-1">
                      {session.aiVisionEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      AI Vision
                    </Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={session.controlling === "user" ? "default" : "secondary"} 
                    size="sm"
                    onClick={() => setSession(prev => ({ ...prev, controlling: "user" }))}
                    data-testid="button-control-user"
                  >
                    <User className="h-4 w-4 mr-1" />
                    You
                  </Button>
                  <Button 
                    variant={session.controlling === "shared" ? "default" : "secondary"} 
                    size="sm"
                    onClick={() => setSession(prev => ({ ...prev, controlling: "shared" }))}
                    data-testid="button-control-shared"
                  >
                    <Unlock className="h-4 w-4 mr-1" />
                    Shared
                  </Button>
                  <Button 
                    variant={session.controlling === "ai" ? "default" : "secondary"} 
                    size="sm"
                    onClick={() => setSession(prev => ({ ...prev, controlling: "ai" }))}
                    data-testid="button-control-ai"
                  >
                    <Cpu className="h-4 w-4 mr-1" />
                    AI
                  </Button>
                </div>
              </div>
            </div>

            <div className="w-80 border-l flex flex-col bg-card">
              <div className="p-3 border-b flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">AI Assistant</span>
              </div>
              
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-3 py-2 rounded-lg max-w-[90%] text-sm ${
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground" 
                          : msg.role === "ai"
                          ? "bg-muted"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-3 border-t space-y-2">
                <div className="flex gap-2">
                  <Button 
                    variant={isMicOn ? "default" : "outline"} 
                    size="icon"
                    onClick={() => setIsMicOn(!isMicOn)}
                    data-testid="button-mic"
                  >
                    {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  <Input 
                    placeholder="Tell the AI what to do..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    data-testid="input-message"
                  />
                  <Button size="icon" onClick={sendMessage} data-testid="button-send">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
