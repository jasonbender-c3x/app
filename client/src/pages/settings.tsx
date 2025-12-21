import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Settings, Palette, Mic, Brain, Bell, Shield, Link2, Check, ExternalLink, Loader2, Database, FileText } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AppSettings {
  model: string;
  theme: string;
  voiceEnabled: boolean;
  ttsMode: "api" | "browser";
  ttsVoice: string;
  ttsSpeed: number;
  ttsPitch: number;
  notifications: boolean;
  saveHistory: boolean;
  streamResponses: boolean;
  knowledgeConversationTurns: number;
  knowledgeAutoIngest: boolean;
}

const defaultSettings: AppSettings = {
  model: "gemini-3.0-pro",
  theme: "system",
  voiceEnabled: true,
  ttsMode: "api",
  ttsVoice: "Kore",
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  notifications: true,
  saveHistory: true,
  streamResponses: true,
  knowledgeConversationTurns: 50,
  knowledgeAutoIngest: false
};

const API_VOICES = [
  { value: "Kore", label: "Kore - Clear Female" },
  { value: "Puck", label: "Puck - Warm Male" },
  { value: "Charon", label: "Charon - Deep Male" },
  { value: "Fenrir", label: "Fenrir - Strong Male" },
  { value: "Aoede", label: "Aoede - Melodic Female" },
  { value: "Leda", label: "Leda - Soft Female" },
  { value: "Orus", label: "Orus - Authoritative Male" },
  { value: "Zephyr", label: "Zephyr - Gentle Neutral" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: authStatus, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/google/status'],
    queryFn: async () => {
      const res = await fetch('/api/auth/google/status');
      return res.json() as Promise<{ authenticated: boolean; hasTokens: boolean }>;
    },
    refetchInterval: 5000,
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/google/revoke', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/google/status'] });
    },
  });

  const handleConnectGoogle = () => {
    window.open('/api/auth/google', '_blank');
  };

  const handleDisconnectGoogle = () => {
    revokeMutation.mutate();
  };

  useEffect(() => {
    const stored = localStorage.getItem('meowstic-settings');
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('meowstic-settings', JSON.stringify(newSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const models = [
    { id: "gemini-3.0-pro", name: "Gemini 3.0 Pro", description: "Latest flagship with state-of-the-art reasoning" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Advanced reasoning and analysis" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast and efficient with great quality" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Quick responses, great for chat" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Settings</h1>
          </div>
          {saved && (
            <span className="text-sm text-green-500 animate-in fade-in">
              Settings saved
            </span>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-8">
            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">AI Model</h2>
              </div>
              
              <div className="space-y-4">
                <Label htmlFor="model-select">Select AI Model</Label>
                <Select 
                  value={settings.model} 
                  onValueChange={(value) => updateSetting('model', value)}
                >
                  <SelectTrigger id="model-select" data-testid="select-model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-muted-foreground">{model.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose the AI model that powers your conversations. Different models offer varying levels of speed and capability.
                </p>
              </div>
            </section>

            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Appearance</h2>
              </div>
              
              <div className="space-y-4">
                <Label htmlFor="theme-select">Theme</Label>
                <Select 
                  value={settings.theme} 
                  onValueChange={(value) => updateSetting('theme', value)}
                >
                  <SelectTrigger id="theme-select" data-testid="select-theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System Default</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Mic className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Voice & Audio</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="voice-toggle" className="font-medium">Text-to-Speech</Label>
                    <p className="text-sm text-muted-foreground">Read AI responses aloud</p>
                  </div>
                  <Switch 
                    id="voice-toggle"
                    checked={settings.voiceEnabled}
                    onCheckedChange={(checked) => updateSetting('voiceEnabled', checked)}
                    data-testid="switch-voice"
                  />
                </div>

                {settings.voiceEnabled && (
                  <>
                    <div className="space-y-3">
                      <Label htmlFor="tts-mode">TTS Mode</Label>
                      <Select 
                        value={settings.ttsMode} 
                        onValueChange={(value: "api" | "browser") => updateSetting('ttsMode', value)}
                      >
                        <SelectTrigger id="tts-mode" data-testid="select-tts-mode">
                          <SelectValue placeholder="Select TTS mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="api">
                            <div>
                              <div className="font-medium">Gemini API</div>
                              <div className="text-xs text-muted-foreground">High-quality, expressive voices</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="browser">
                            <div>
                              <div className="font-medium">Browser (Fallback)</div>
                              <div className="text-xs text-muted-foreground">Uses your device's built-in voices</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        API mode uses Gemini TTS for natural speech. Browser mode works offline as a fallback.
                      </p>
                    </div>

                    {settings.ttsMode === "api" && (
                      <div className="space-y-3">
                        <Label htmlFor="tts-voice">Voice</Label>
                        <Select 
                          value={settings.ttsVoice} 
                          onValueChange={(value) => updateSetting('ttsVoice', value)}
                        >
                          <SelectTrigger id="tts-voice" data-testid="select-tts-voice">
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {API_VOICES.map((voice) => (
                              <SelectItem key={voice.value} value={voice.value}>
                                {voice.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label htmlFor="tts-speed">Speed</Label>
                        <span className="text-sm text-muted-foreground">{settings.ttsSpeed.toFixed(1)}x</span>
                      </div>
                      <Slider
                        id="tts-speed"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={[settings.ttsSpeed]}
                        onValueChange={([value]) => updateSetting('ttsSpeed', value)}
                        data-testid="slider-tts-speed"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label htmlFor="tts-pitch">Pitch</Label>
                        <span className="text-sm text-muted-foreground">{settings.ttsPitch.toFixed(1)}</span>
                      </div>
                      <Slider
                        id="tts-pitch"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={[settings.ttsPitch]}
                        onValueChange={([value]) => updateSetting('ttsPitch', value)}
                        data-testid="slider-tts-pitch"
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Notifications</h2>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications-toggle" className="font-medium">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">Get notified about important updates</p>
                </div>
                <Switch 
                  id="notifications-toggle"
                  checked={settings.notifications}
                  onCheckedChange={(checked) => updateSetting('notifications', checked)}
                  data-testid="switch-notifications"
                />
              </div>
            </section>

            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Privacy & Data</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="history-toggle" className="font-medium">Save Chat History</Label>
                    <p className="text-sm text-muted-foreground">Keep your conversation history</p>
                  </div>
                  <Switch 
                    id="history-toggle"
                    checked={settings.saveHistory}
                    onCheckedChange={(checked) => updateSetting('saveHistory', checked)}
                    data-testid="switch-history"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="stream-toggle" className="font-medium">Stream Responses</Label>
                    <p className="text-sm text-muted-foreground">See AI responses as they're generated</p>
                  </div>
                  <Switch 
                    id="stream-toggle"
                    checked={settings.streamResponses}
                    onCheckedChange={(checked) => updateSetting('streamResponses', checked)}
                    data-testid="switch-stream"
                  />
                </div>
              </div>
            </section>

            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Connected Accounts</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <Label className="font-medium">Google Account</Label>
                      <p className="text-sm text-muted-foreground">
                        {authLoading ? 'Checking...' : authStatus?.authenticated ? 'Connected - Gmail, Calendar, Drive, Docs, Sheets, Tasks' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  
                  {authLoading ? (
                    <Button variant="outline" size="sm" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : authStatus?.authenticated ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDisconnectGoogle}
                      disabled={revokeMutation.isPending}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      data-testid="button-disconnect-google"
                    >
                      {revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleConnectGoogle}
                      className="gap-2"
                      data-testid="button-connect-google"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Connect
                    </Button>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Connect your Google account to enable access to Gmail, Calendar, Drive, Docs, Sheets, and Tasks directly from the chat.
                </p>
              </div>
            </section>

            <section className="p-6 rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Knowledge Ingestion</h2>
              </div>
              
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Ingest historical conversations from Gmail and Drive, processing them to build persistent memory across all your AI interactions.
                </p>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="conversation-turns">Conversation Turns to Reattach</Label>
                    <span className="text-sm text-muted-foreground font-mono">{settings.knowledgeConversationTurns}</span>
                  </div>
                  <Slider
                    id="conversation-turns"
                    min={10}
                    max={200}
                    step={10}
                    value={[settings.knowledgeConversationTurns]}
                    onValueChange={([value]) => updateSetting('knowledgeConversationTurns', value)}
                    data-testid="slider-conversation-turns"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of conversation turns to include when reattaching context. Higher values provide more context but use more tokens.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-ingest" className="font-medium">Auto-Ingest New Conversations</Label>
                    <p className="text-sm text-muted-foreground">Automatically process new LLM conversations</p>
                  </div>
                  <Switch 
                    id="auto-ingest"
                    checked={settings.knowledgeAutoIngest}
                    onCheckedChange={(checked) => updateSetting('knowledgeAutoIngest', checked)}
                    data-testid="switch-auto-ingest"
                  />
                </div>

                <Link href="/knowledge">
                  <Button variant="outline" className="w-full gap-2" data-testid="button-open-knowledge">
                    <FileText className="h-4 w-4" />
                    Open Knowledge Ingestion
                  </Button>
                </Link>
              </div>
            </section>

            <div className="p-6 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10">
              <h2 className="text-lg font-semibold mb-2">About Meowstik</h2>
              <p className="text-muted-foreground text-sm mb-3">
                Meowstik is a purrfect AI assistant powered by Google's Gemini models, with integrated Google Workspace services. Always curious, always helpful!
              </p>
              <p className="text-xs text-muted-foreground">Version 9.lives</p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
