import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSilenceDetection } from "@/hooks/use-silence-detection";
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
  Brain,
  Radio,
  Timer,
  AudioLines
} from "lucide-react";
import { Link } from "wouter";

interface Message {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
}

type CollabMode = "mode_a" | "mode_b"; // Mode A: Turn-based, Mode B: Real-time

interface SessionState {
  connected: boolean;
  mode: "headless" | "desktop" | null;
  collabMode: CollabMode;
  controlling: "user" | "ai" | "shared";
  audioEnabled: boolean;
  aiVisionEnabled: boolean;
  sessionId: string | null;
  token: string | null;
  agentConnected: boolean;
  silenceDuration: number; // ms before auto-send
  isAiTurn: boolean; // For Mode A turn tracking
  autoMicReactivate: boolean; // Mic reactivates after AI turn
}

export default function CollaboratePage() {
  const { toast } = useToast();
  const [session, setSession] = useState<SessionState>({
    connected: false,
    mode: null,
    collabMode: "mode_a",
    controlling: "shared",
    audioEnabled: true,
    aiVisionEnabled: true,
    sessionId: null,
    token: null,
    agentConnected: false,
    silenceDuration: 2000,
    isAiTurn: false,
    autoMicReactivate: true,
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
  const wsRef = useRef<WebSocket | null>(null);
  
  // Ref to track latest autoMicReactivate value (avoids stale closure issue)
  const autoMicReactivateRef = useRef(session.autoMicReactivate);
  useEffect(() => {
    autoMicReactivateRef.current = session.autoMicReactivate;
  }, [session.autoMicReactivate]);
  
  // Handle silence detection for Mode A auto-send
  const handleSilenceDetected = useCallback(() => {
    if (session.collabMode === "mode_a" && isMicOn && !session.isAiTurn) {
      // Auto-send voice input after silence
      toast({ title: "Silence detected", description: "Sending your message..." });
      setIsMicOn(false);
      setSession(prev => ({ ...prev, isAiTurn: true }));
      
      // Simulate AI response and turn completion (placeholder until backend turn protocol)
      setTimeout(() => {
        const aiMsg: Message = {
          id: Date.now().toString(),
          role: "ai",
          content: "I heard you. Let me process that and take action on your screen...",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
        
        // After AI turn, reactivate mic if enabled (use ref for latest value)
        setTimeout(() => {
          setSession(prev => ({ ...prev, isAiTurn: false }));
          if (autoMicReactivateRef.current) {
            setIsMicOn(true);
            toast({ title: "Your turn", description: "Microphone reactivated" });
          }
        }, 2000);
      }, 1500);
    }
  }, [session.collabMode, session.isAiTurn, isMicOn, toast]);
  
  const {
    isListening,
    isSpeaking,
    silenceProgress,
    audioLevel,
    startListening,
    stopListening,
    resetSilenceTimer,
  } = useSilenceDetection(handleSilenceDetected, {
    silenceDuration: session.silenceDuration,
    enabled: session.collabMode === "mode_a" && isMicOn && !session.isAiTurn,
  });
  
  // Effect to start/stop listening when mic toggles
  useEffect(() => {
    if (isMicOn && session.collabMode === "mode_a") {
      startListening();
    } else {
      stopListening();
    }
  }, [isMicOn, session.collabMode, startListening, stopListening]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createSession = async (): Promise<{ sessionId: string; token: string } | null> => {
    try {
      const response = await fetch("/api/desktop/sessions", { method: "POST" });
      if (!response.ok) throw new Error("Failed to create session");
      const data = await response.json();
      return { sessionId: data.sessionId, token: data.token };
    } catch (error) {
      console.error("Failed to create session:", error);
      toast({ title: "Failed to create session", variant: "destructive" });
      return null;
    }
  };

  const connectWebSocket = (sessionId: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/desktop/browser/${sessionId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Collaborate] WebSocket connected");
      setSession(prev => ({ ...prev, connected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case "session_status":
            setSession(prev => ({
              ...prev,
              agentConnected: message.data.agentConnected,
              controlling: message.data.controlling,
              aiVisionEnabled: message.data.aiVisionEnabled,
              audioEnabled: message.data.audioEnabled,
            }));
            break;
          case "agent_connected":
            setSession(prev => ({ ...prev, agentConnected: true }));
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: "system",
              content: `Desktop agent connected: ${message.data?.systemInfo?.hostname || "Unknown"} (${message.data?.systemInfo?.platform || "Unknown"})`,
              timestamp: new Date(),
            }]);
            break;
          case "agent_disconnected":
            setSession(prev => ({ ...prev, agentConnected: false }));
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: "system",
              content: "Desktop agent disconnected.",
              timestamp: new Date(),
            }]);
            break;
          case "frame":
            const frameData = message.data as { width: number; height: number; data: string };
            if (canvasRef.current && frameData.data) {
              const ctx = canvasRef.current.getContext("2d");
              if (ctx) {
                const img = new Image();
                img.onload = () => {
                  if (canvasRef.current) {
                    canvasRef.current.width = frameData.width || img.width;
                    canvasRef.current.height = frameData.height || img.height;
                    ctx.drawImage(img, 0, 0);
                  }
                };
                img.src = `data:image/png;base64,${frameData.data}`;
              }
            }
            break;
          case "control_changed":
            setSession(prev => ({ ...prev, controlling: message.data.controlling }));
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[Collaborate] WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("[Collaborate] WebSocket error:", error);
    };
  };

  const startHeadlessBrowser = async () => {
    toast({ title: "Starting headless browser...", description: "Creating session" });
    
    const sessionData = await createSession();
    if (!sessionData) return;

    setSession(prev => ({ 
      ...prev, 
      mode: "headless",
      sessionId: sessionData.sessionId,
      token: sessionData.token,
    }));
    
    connectWebSocket(sessionData.sessionId);
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "system",
      content: "Headless browser session created. The AI can now see and interact with the browser. You can monitor the screen and chat with the AI.",
      timestamp: new Date(),
    }]);
  };

  const connectDesktop = async () => {
    toast({ title: "Creating desktop session...", description: "Generating session token" });
    
    const sessionData = await createSession();
    if (!sessionData) return;

    setSession(prev => ({ 
      ...prev, 
      mode: "desktop",
      sessionId: sessionData.sessionId,
      token: sessionData.token,
    }));
    
    connectWebSocket(sessionData.sessionId);
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "system",
      content: `Desktop session created. Run this command on your computer to connect:\n\nnpx meowstik-agent --token ${sessionData.token}`,
      timestamp: new Date(),
    }]);
  };

  const disconnect = async () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (session.sessionId) {
      try {
        await fetch(`/api/desktop/sessions/${session.sessionId}`, { method: "DELETE" });
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    }
    
    setSession({ 
      connected: false, 
      mode: null, 
      collabMode: "mode_a",
      controlling: "shared", 
      audioEnabled: true, 
      aiVisionEnabled: true,
      sessionId: null,
      token: null,
      agentConnected: false,
      silenceDuration: 2000,
      isAiTurn: false,
      autoMicReactivate: true,
    });
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
              <div className="p-3 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">AI Assistant</span>
                  </div>
                  {session.isAiTurn && (
                    <Badge variant="secondary" className="animate-pulse">
                      <Cpu className="h-3 w-3 mr-1" />
                      AI Turn
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-1">
                  <Button
                    variant={session.collabMode === "mode_a" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setSession(prev => ({ ...prev, collabMode: "mode_a" }))}
                    data-testid="button-mode-a"
                  >
                    <Timer className="h-3 w-3 mr-1" />
                    Mode A: Turn-Based
                  </Button>
                  <Button
                    variant={session.collabMode === "mode_b" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setSession(prev => ({ ...prev, collabMode: "mode_b" }))}
                    data-testid="button-mode-b"
                  >
                    <Radio className="h-3 w-3 mr-1" />
                    Mode B: Real-Time
                  </Button>
                </div>
                
                {session.collabMode === "mode_a" && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Silence timeout</span>
                      <span>{(session.silenceDuration / 1000).toFixed(1)}s</span>
                    </div>
                    <Slider
                      value={[session.silenceDuration]}
                      onValueChange={([v]) => setSession(prev => ({ ...prev, silenceDuration: v }))}
                      min={500}
                      max={5000}
                      step={250}
                      className="w-full"
                      data-testid="slider-silence-duration"
                    />
                    <div className="flex items-center gap-2">
                      <Switch
                        id="autoMic"
                        checked={session.autoMicReactivate}
                        onCheckedChange={(v) => setSession(prev => ({ ...prev, autoMicReactivate: v }))}
                        data-testid="switch-auto-mic"
                      />
                      <Label htmlFor="autoMic" className="text-xs">Auto-reactivate mic after AI</Label>
                    </div>
                  </div>
                )}
                
                {session.collabMode === "mode_b" && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <Radio className="h-4 w-4" />
                        <span className="font-medium">2-Way Real-Time Mode</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        AI sees your desktop at 1 FPS and can control mouse/keyboard. Speak naturally for hands-free operation.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="aiControl"
                        checked={session.controlling === "ai" || session.controlling === "shared"}
                        onCheckedChange={(v) => setSession(prev => ({ 
                          ...prev, 
                          controlling: v ? "shared" : "user" 
                        }))}
                        data-testid="switch-ai-control"
                      />
                      <Label htmlFor="aiControl" className="text-xs">Allow AI control</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="continuousVoice"
                        checked={true}
                        disabled
                        data-testid="switch-continuous-voice"
                      />
                      <Label htmlFor="continuousVoice" className="text-xs text-muted-foreground">
                        Continuous voice (always on)
                      </Label>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="p-2 bg-muted rounded">
                        <Eye className="h-4 w-4 mx-auto mb-1" />
                        <span className="text-[10px]">1 FPS Vision</span>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <MousePointer2 className="h-4 w-4 mx-auto mb-1" />
                        <span className="text-[10px]">Mouse</span>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <Keyboard className="h-4 w-4 mx-auto mb-1" />
                        <span className="text-[10px]">Keyboard</span>
                      </div>
                    </div>
                  </div>
                )}
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
                {session.collabMode === "mode_a" && isMicOn && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
                        <span className="text-muted-foreground">
                          {isSpeaking ? "Listening..." : "Silence detected"}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {Math.round(silenceProgress * 100)}%
                      </span>
                    </div>
                    <Progress value={silenceProgress * 100} className="h-1" />
                    <div className="flex items-center gap-1">
                      <AudioLines className="h-3 w-3 text-muted-foreground" />
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-100" 
                          style={{ width: `${Math.min(audioLevel * 500, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant={isMicOn ? "default" : "outline"} 
                    size="icon"
                    onClick={() => setIsMicOn(!isMicOn)}
                    disabled={session.isAiTurn}
                    data-testid="button-mic"
                  >
                    {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  <Input 
                    placeholder="Tell the AI what to do..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    disabled={session.isAiTurn && session.collabMode === "mode_a"}
                    data-testid="input-message"
                  />
                  <Button 
                    size="icon" 
                    onClick={sendMessage} 
                    disabled={session.isAiTurn && session.collabMode === "mode_a"}
                    data-testid="button-send"
                  >
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
