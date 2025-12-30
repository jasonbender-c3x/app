/**
 * Agent Settings Page - Configure AI agent behavior, tools, and preferences
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Bot, 
  Zap, 
  MessageSquare, 
  Settings2, 
  Wrench,
  Brain,
  Volume2,
  FileText,
  Mail,
  Phone,
  Calendar,
  GitBranch,
  Globe,
  Database,
  Terminal,
  BookOpen
} from "lucide-react";

// Tool categories with their tools
const toolCategories = [
  {
    id: "communication",
    name: "Communication",
    icon: MessageSquare,
    description: "Chat, voice, and messaging tools",
    tools: [
      { id: "send_chat", name: "Send Chat", description: "Send messages in the chat", enabled: true },
      { id: "say", name: "Voice Output", description: "Text-to-speech with HD audio", enabled: true },
      { id: "sms_send", name: "Send SMS", description: "Send SMS messages via Twilio", enabled: true },
      { id: "sms_list", name: "List SMS", description: "View recent SMS messages", enabled: true },
      { id: "call_make", name: "Make Call", description: "Make voice calls via Twilio", enabled: true },
      { id: "call_list", name: "List Calls", description: "View recent call history", enabled: true },
    ]
  },
  {
    id: "files",
    name: "Files",
    icon: FileText,
    description: "File operations and management",
    tools: [
      { id: "file_get", name: "Read File", description: "Read file contents", enabled: true },
      { id: "file_put", name: "Write File", description: "Write to files", enabled: true },
      { id: "file_list", name: "List Files", description: "List directory contents", enabled: true },
      { id: "file_delete", name: "Delete File", description: "Delete files", enabled: true },
    ]
  },
  {
    id: "email",
    name: "Email",
    icon: Mail,
    description: "Gmail integration",
    tools: [
      { id: "gmail_list", name: "List Emails", description: "View inbox messages", enabled: true },
      { id: "gmail_read", name: "Read Email", description: "Read email content", enabled: true },
      { id: "gmail_send", name: "Send Email", description: "Compose and send emails", enabled: true },
      { id: "gmail_search", name: "Search Emails", description: "Search inbox", enabled: true },
    ]
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: Calendar,
    description: "Google Calendar integration",
    tools: [
      { id: "calendar_list", name: "List Calendars", description: "View available calendars", enabled: true },
      { id: "calendar_events", name: "List Events", description: "View calendar events", enabled: true },
      { id: "calendar_create", name: "Create Event", description: "Create new events", enabled: true },
    ]
  },
  {
    id: "github",
    name: "GitHub",
    icon: GitBranch,
    description: "GitHub repository operations",
    tools: [
      { id: "github_repos", name: "List Repos", description: "View repositories", enabled: true },
      { id: "github_contents", name: "Browse Files", description: "Browse repo contents", enabled: true },
      { id: "github_issues", name: "Issues", description: "View and manage issues", enabled: true },
      { id: "github_prs", name: "Pull Requests", description: "View and manage PRs", enabled: true },
    ]
  },
  {
    id: "browser",
    name: "Browser",
    icon: Globe,
    description: "Web browsing and automation",
    tools: [
      { id: "browser_navigate", name: "Navigate", description: "Navigate to URLs", enabled: true },
      { id: "browser_screenshot", name: "Screenshot", description: "Capture screenshots", enabled: true },
      { id: "browser_click", name: "Click", description: "Click elements", enabled: true },
      { id: "browser_type", name: "Type", description: "Enter text", enabled: true },
    ]
  },
  {
    id: "terminal",
    name: "Terminal",
    icon: Terminal,
    description: "Command line access",
    tools: [
      { id: "terminal_execute", name: "Execute", description: "Run shell commands", enabled: true },
      { id: "terminal_read", name: "Read Output", description: "Read terminal output", enabled: true },
    ]
  },
];

// Personality presets
const personalityPresets = [
  { id: "professional", name: "Professional", description: "Formal, concise, technical" },
  { id: "friendly", name: "Friendly Helper", description: "Warm, conversational, encouraging" },
  { id: "meowstik", name: "Meowstik (Default)", description: "Curious, playful, precise" },
  { id: "minimal", name: "Minimal", description: "Brief responses, bullet points" },
];

export default function AgentSettingsPage() {
  const [activeTab, setActiveTab] = useState("behavior");
  const [personality, setPersonality] = useState("meowstik");
  const [responseLength, setResponseLength] = useState([50]);
  const [proactivity, setProactivity] = useState([70]);
  const [toolSettings, setToolSettings] = useState<Record<string, boolean>>({});
  const [categoryEnabled, setCategoryEnabled] = useState<Record<string, boolean>>({});

  // Initialize tool settings
  useEffect(() => {
    const initialTools: Record<string, boolean> = {};
    const initialCategories: Record<string, boolean> = {};
    
    toolCategories.forEach(cat => {
      initialCategories[cat.id] = true;
      cat.tools.forEach(tool => {
        initialTools[tool.id] = tool.enabled;
      });
    });
    
    setToolSettings(initialTools);
    setCategoryEnabled(initialCategories);
  }, []);

  const toggleTool = (toolId: string) => {
    setToolSettings(prev => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const toggleCategory = (categoryId: string) => {
    const newValue = !categoryEnabled[categoryId];
    setCategoryEnabled(prev => ({ ...prev, [categoryId]: newValue }));
    
    // Toggle all tools in category
    const category = toolCategories.find(c => c.id === categoryId);
    if (category) {
      const updates: Record<string, boolean> = {};
      category.tools.forEach(tool => {
        updates[tool.id] = newValue;
      });
      setToolSettings(prev => ({ ...prev, ...updates }));
    }
  };

  const enabledToolCount = Object.values(toolSettings).filter(Boolean).length;
  const totalToolCount = Object.keys(toolSettings).length;

  return (
    <div className="min-h-screen bg-background" data-testid="agent-settings-page">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Agent Settings</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/docs/agent-configuration">
              <Button variant="outline" size="sm" className="gap-2" data-testid="link-docs">
                <BookOpen className="h-4 w-4" />
                Documentation
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="behavior" className="gap-2" data-testid="tab-behavior">
              <Brain className="h-4 w-4" />
              Behavior
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2" data-testid="tab-tools">
              <Wrench className="h-4 w-4" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="voice" className="gap-2" data-testid="tab-voice">
              <Volume2 className="h-4 w-4" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2" data-testid="tab-advanced">
              <Settings2 className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Behavior Tab */}
          <TabsContent value="behavior">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Personality */}
              <Card>
                <CardHeader>
                  <CardTitle>Personality</CardTitle>
                  <CardDescription>Choose how the agent communicates</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {personalityPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                        personality === preset.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setPersonality(preset.id)}
                      data-testid={`personality-${preset.id}`}
                    >
                      <div>
                        <p className="font-medium">{preset.name}</p>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                      {personality === preset.id && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Response Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Response Settings</CardTitle>
                  <CardDescription>Fine-tune response behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Response Length</label>
                      <span className="text-sm text-muted-foreground">
                        {responseLength[0] < 30 ? "Concise" : responseLength[0] < 70 ? "Balanced" : "Detailed"}
                      </span>
                    </div>
                    <Slider
                      value={responseLength}
                      onValueChange={setResponseLength}
                      max={100}
                      step={1}
                      data-testid="slider-response-length"
                    />
                    <p className="text-xs text-muted-foreground">
                      Controls how verbose responses should be
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Proactivity</label>
                      <span className="text-sm text-muted-foreground">
                        {proactivity[0] < 30 ? "Ask First" : proactivity[0] < 70 ? "Balanced" : "Take Action"}
                      </span>
                    </div>
                    <Slider
                      value={proactivity}
                      onValueChange={setProactivity}
                      max={100}
                      step={1}
                      data-testid="slider-proactivity"
                    />
                    <p className="text-xs text-muted-foreground">
                      How much the agent should act vs. ask for confirmation
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Available Tools</CardTitle>
                    <CardDescription>
                      Enable or disable agent capabilities ({enabledToolCount}/{totalToolCount} enabled)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-6">
                    {toolCategories.map((category) => {
                      const Icon = category.icon;
                      const enabledInCategory = category.tools.filter(t => toolSettings[t.id]).length;
                      
                      return (
                        <div key={category.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h3 className="font-medium">{category.name}</h3>
                                <p className="text-sm text-muted-foreground">{category.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {enabledInCategory}/{category.tools.length}
                              </span>
                              <Switch
                                checked={categoryEnabled[category.id]}
                                onCheckedChange={() => toggleCategory(category.id)}
                                data-testid={`switch-category-${category.id}`}
                              />
                            </div>
                          </div>
                          
                          <div className="grid gap-2 pl-8">
                            {category.tools.map((tool) => (
                              <div
                                key={tool.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              >
                                <div>
                                  <p className="text-sm font-medium">{tool.name}</p>
                                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                                </div>
                                <Switch
                                  checked={toolSettings[tool.id] ?? true}
                                  onCheckedChange={() => toggleTool(tool.id)}
                                  data-testid={`switch-tool-${tool.id}`}
                                />
                              </div>
                            ))}
                          </div>
                          
                          <Separator />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice">
            <Card>
              <CardHeader>
                <CardTitle>Voice Settings</CardTitle>
                <CardDescription>Configure text-to-speech and audio output</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Voice settings are managed through the Verbosity Slider in the chat header.
                    <br /><br />
                    <strong>Modes:</strong>
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                    <li><strong>Mute:</strong> No audio output</li>
                    <li><strong>Quiet:</strong> Only play HD audio from voice commands</li>
                    <li><strong>Verbose:</strong> Speak all chat responses</li>
                    <li><strong>Experimental:</strong> Multi-voice TTS (coming soon)</li>
                  </ul>
                </div>
                
                <Link href="/">
                  <Button variant="outline" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Go to Chat to Adjust Voice
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Context & Memory</CardTitle>
                  <CardDescription>RAG and retrieval settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Conversation Memory</p>
                      <p className="text-sm text-muted-foreground">Remember previous conversations</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-conversation-memory" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Domain Knowledge</p>
                      <p className="text-sm text-muted-foreground">Use ingested documents for context</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-domain-knowledge" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Code Context</p>
                      <p className="text-sm text-muted-foreground">Include repository analysis</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-code-context" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Job Processing</CardTitle>
                  <CardDescription>Workflow and orchestration settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Parallel Execution</p>
                      <p className="text-sm text-muted-foreground">Run independent tasks simultaneously</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-parallel-execution" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Retry Failed Jobs</p>
                      <p className="text-sm text-muted-foreground">Automatically retry on failure</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-retry" />
                  </div>
                  <Separator />
                  <Link href="/docs/job-orchestration">
                    <Button variant="outline" className="w-full gap-2">
                      <Database className="h-4 w-4" />
                      View Orchestration Documentation
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
