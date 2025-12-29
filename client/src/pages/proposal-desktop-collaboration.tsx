import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Monitor, 
  Globe, 
  Cpu, 
  Eye, 
  MousePointer2, 
  Keyboard, 
  Volume2, 
  Mic,
  Cloud,
  Laptop,
  ArrowRight,
  CheckCircle2,
  Circle,
  Zap,
  Brain,
  User,
  Server
} from "lucide-react";
import { Link } from "wouter";

export default function ProposalDesktopCollaborationPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3 bg-card sticky top-0 z-10">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Feature Proposal: AI Desktop Collaboration</h1>
          <p className="text-sm text-muted-foreground">TeamViewer-style AI collaboration for remote desktops</p>
        </div>
        <div className="ml-auto">
          <Link href="/collaborate">
            <Button data-testid="button-try-it">
              Try It <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Overview</h2>
          <p className="text-muted-foreground leading-relaxed">
            AI Desktop Collaboration enables the LLM to see and interact with a computer screen in real-time, 
            just like a human operator would with TeamViewer. This creates a powerful paradigm where the AI 
            can assist with any task that involves a graphical interface - from software development to 
            design work to data entry.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <Globe className="h-8 w-8 text-blue-500 mb-2" />
                <CardTitle className="text-lg">Headless Browser</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Spawn a cloud browser that both user and AI can see and control. 
                  No installation required.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <Monitor className="h-8 w-8 text-purple-500 mb-2" />
                <CardTitle className="text-lg">Full Desktop</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Connect your Windows, Mac, or Linux computer. 
                  AI can see everything and help with any application.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <Brain className="h-8 w-8 text-green-500 mb-2" />
                <CardTitle className="text-lg">AI Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Gemini Vision processes screen frames, understands UI elements, 
                  and can take autonomous actions.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">System Architecture</h2>
          
          <Card className="bg-slate-950 text-slate-100">
            <CardContent className="p-6">
              <pre className="text-xs font-mono whitespace-pre overflow-x-auto">
{`┌────────────────────────────────────────────────────────────────────────────────┐
│                        AI DESKTOP COLLABORATION SYSTEM                          │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐         ┌─────────────────────┐         ┌─────────────────┐   │
│  │   USER'S    │         │    MEOWSTIK CLOUD   │         │   GEMINI AI     │   │
│  │  COMPUTER   │         │       RELAY         │         │   (VISION)      │   │
│  └─────────────┘         └─────────────────────┘         └─────────────────┘   │
│        │                          │                              │             │
│        │                          │                              │             │
│  ┌─────▼─────┐             ┌──────▼──────┐               ┌───────▼───────┐    │
│  │  Desktop  │─────WS─────►│   Relay     │───Frames────►│  Vision API   │    │
│  │   Agent   │             │  Service    │               │   (batch)     │    │
│  │           │◄────WS──────│             │◄──Commands───│               │    │
│  └───────────┘             └─────────────┘               └───────────────┘    │
│        │                          │                                            │
│        │                          │                                            │
│  ┌─────▼─────┐             ┌──────▼──────┐                                     │
│  │  Screen   │             │   Browser   │                                     │
│  │  Capture  │             │   Viewer    │                                     │
│  │  + Input  │             │   (User)    │                                     │
│  └───────────┘             └─────────────┘                                     │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘`}
              </pre>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Data Flow</h2>
          
          <Tabs defaultValue="video">
            <TabsList>
              <TabsTrigger value="video">Video Stream</TabsTrigger>
              <TabsTrigger value="input">Input Events</TabsTrigger>
              <TabsTrigger value="audio">Audio (Bidirectional)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="video">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-2 rounded">
                        <Monitor className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Desktop</span>
                      </div>
                      <ArrowRight className="text-muted-foreground" />
                      <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-2 rounded">
                        <Laptop className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Agent</span>
                      </div>
                      <ArrowRight className="text-muted-foreground" />
                      <div className="flex items-center gap-2 bg-green-500/10 px-3 py-2 rounded">
                        <Cloud className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Relay</span>
                      </div>
                      <ArrowRight className="text-muted-foreground" />
                      <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-2 rounded">
                        <Eye className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">Vision API</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Screen frames are captured at 10 FPS, compressed as JPEG, streamed via WebSocket to the relay, 
                      then batched and sent to Gemini Vision for AI understanding. The same frames are also forwarded 
                      to the user's browser for monitoring.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="input">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-2 rounded">
                        <User className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">User Input</span>
                      </div>
                      <span className="text-muted-foreground">+</span>
                      <div className="flex items-center gap-2 bg-green-500/10 px-3 py-2 rounded">
                        <Brain className="h-5 w-5 text-green-500" />
                        <span className="font-medium">AI Commands</span>
                      </div>
                      <ArrowRight className="text-muted-foreground" />
                      <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-2 rounded">
                        <Server className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">Relay</span>
                      </div>
                      <ArrowRight className="text-muted-foreground" />
                      <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-2 rounded">
                        <MousePointer2 className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Agent</span>
                      </div>
                      <ArrowRight className="text-muted-foreground" />
                      <div className="flex items-center gap-2 bg-red-500/10 px-3 py-2 rounded">
                        <Keyboard className="h-5 w-5 text-red-500" />
                        <span className="font-medium">Desktop</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Both user and AI can send input events. Control modes (User/Shared/AI) determine whose 
                      inputs are accepted. The relay routes events to the agent, which injects them as real 
                      mouse/keyboard actions using robotjs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="audio">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Volume2 className="h-4 w-4" /> Desktop → User
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          System audio from the desktop is captured and streamed to the user's browser, 
                          so they can hear what's happening on the remote machine.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Mic className="h-4 w-4" /> AI TTS → Desktop
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          When the AI speaks (via TTS), the audio can be played on the desktop's speakers, 
                          enabling voice-guided assistance.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Implementation Roadmap</h2>
          
          <div className="space-y-3">
            {[
              { status: "done", label: "Create /collaborate hub page with mode selection" },
              { status: "done", label: "Build Desktop Agent package structure" },
              { status: "done", label: "Create Desktop Relay Service" },
              { status: "current", label: "Wire WebSocket endpoints into Express routes" },
              { status: "pending", label: "Integrate noVNC viewer for headless browser" },
              { status: "pending", label: "Complete screen capture with screenshot-desktop" },
              { status: "pending", label: "Add robotjs input injection" },
              { status: "pending", label: "Implement Gemini Vision fan-out" },
              { status: "pending", label: "Add bidirectional audio pipeline" },
              { status: "pending", label: "Polish control handoff UX" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                {item.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : item.status === "current" ? (
                  <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className={item.status === "done" ? "text-muted-foreground" : ""}>
                  {item.label}
                </span>
                {item.status === "done" && (
                  <Badge variant="secondary" className="ml-auto">Done</Badge>
                )}
                {item.status === "current" && (
                  <Badge className="ml-auto">In Progress</Badge>
                )}
              </div>
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Use Cases</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🖥️ Remote Tech Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI can see your screen and guide you through troubleshooting steps, 
                  or take control to fix issues directly.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🎨 Design Assistance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI watches as you work in Figma or Photoshop, offering suggestions 
                  and even making edits when requested.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📊 Data Entry Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Point AI at a spreadsheet or form, describe what needs to be done, 
                  and watch it fill in data automatically.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🧪 Software Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI can navigate applications, test user flows, and report issues 
                  by seeing and interacting like a real user.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="flex justify-center pt-8">
          <Link href="/collaborate">
            <Button size="lg" data-testid="button-launch">
              <Zap className="h-5 w-5 mr-2" />
              Launch AI Desktop Collaboration
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
