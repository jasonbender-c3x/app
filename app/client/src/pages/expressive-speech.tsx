import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mic, Play, Square, Download, Loader2, Volume2, Users, MessageSquare, Plus, Trash2, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Speaker {
  id: string;
  name: string;
  voice: string;
  style: string;
}

interface ConversationLine {
  id: string;
  speakerId: string;
  text: string;
}

interface GenerationState {
  status: "idle" | "generating" | "complete" | "error";
  audioUrl: string | null;
  error: string | null;
}

const AVAILABLE_VOICES = [
  { value: "Kore", label: "Kore - Clear Female" },
  { value: "Puck", label: "Puck - Warm Male" },
  { value: "Charon", label: "Charon - Deep Male" },
  { value: "Fenrir", label: "Fenrir - Strong Male" },
  { value: "Aoede", label: "Aoede - Melodic Female" },
  { value: "Leda", label: "Leda - Soft Female" },
  { value: "Orus", label: "Orus - Authoritative Male" },
  { value: "Zephyr", label: "Zephyr - Gentle Neutral" },
];

const STYLE_PRESETS = [
  { value: "natural", label: "Natural" },
  { value: "Say cheerfully", label: "Cheerful" },
  { value: "Say seriously", label: "Serious" },
  { value: "Say excitedly", label: "Excited" },
  { value: "Say calmly", label: "Calm" },
  { value: "Say dramatically", label: "Dramatic" },
  { value: "Whisper", label: "Whisper" },
  { value: "Say like a news anchor", label: "News Anchor" },
  { value: "Say warmly", label: "Warm" },
  { value: "Say professionally", label: "Professional" },
];

const STATUS_TIPS = [
  "Did you know? Use speaker names like 'Host:' for natural dialogue",
  "Tip: Try different voice combinations for variety",
  "Try 'Whisper' style for intimate speech effects",
  "Need drama? Use the 'Dramatic' style preset",
  "Want cheerful audio? Apply the 'Cheerful' style",
  "Keep lines concise for the best quality results",
];

function StatusBarTip() {
  const [index, setIndex] = useState(0);
  
  const nextTip = useCallback(() => {
    setIndex((prev) => (prev + 1) % STATUS_TIPS.length);
  }, []);

  return (
    <button 
      onClick={nextTip}
      className="text-left hover:text-foreground transition-colors cursor-pointer"
      data-testid="button-status-tip"
    >
      {STATUS_TIPS[index]}
    </button>
  );
}

export default function ExpressiveSpeechPage() {
  const [mode, setMode] = useState<"single" | "multi">("multi");
  
  const [singleText, setSingleText] = useState("Hello! Welcome to Nebula Chat's expressive speech synthesis.");
  const [singleVoice, setSingleVoice] = useState("Kore");
  const [singleStyle, setSingleStyle] = useState("natural");
  
  const [speakers, setSpeakers] = useState<Speaker[]>([
    { id: "1", name: "Host", voice: "Kore", style: "natural" },
    { id: "2", name: "Guest", voice: "Puck", style: "natural" }
  ]);
  
  const [conversation, setConversation] = useState<ConversationLine[]>([
    { id: "1", speakerId: "1", text: "Welcome to our podcast! Today we're discussing AI and the future." },
    { id: "2", speakerId: "2", text: "Thanks for having me! I'm excited to dive into this topic." },
    { id: "3", speakerId: "1", text: "Let's start with the basics. What got you interested in AI?" },
    { id: "4", speakerId: "2", text: "It all started when I first experimented with language models. The potential was immediately clear." }
  ]);

  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
    audioUrl: null,
    error: null
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  const addSpeaker = useCallback(() => {
    if (speakers.length >= 2) return;
    const newId = String(Date.now());
    setSpeakers(prev => [...prev, {
      id: newId,
      name: `Speaker ${prev.length + 1}`,
      voice: AVAILABLE_VOICES[prev.length % AVAILABLE_VOICES.length].value,
      style: "natural"
    }]);
  }, [speakers.length]);

  const removeSpeaker = useCallback((id: string) => {
    if (speakers.length <= 1) return;
    setSpeakers(prev => prev.filter(s => s.id !== id));
    setConversation(prev => prev.filter(line => line.speakerId !== id));
  }, [speakers.length]);

  const updateSpeaker = useCallback((id: string, field: keyof Speaker, value: string) => {
    setSpeakers(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  }, []);

  const addLine = useCallback(() => {
    const lastLine = conversation[conversation.length - 1];
    const nextSpeakerId = lastLine 
      ? speakers.find(s => s.id !== lastLine.speakerId)?.id || speakers[0].id
      : speakers[0].id;
    
    setConversation(prev => [...prev, {
      id: String(Date.now()),
      speakerId: nextSpeakerId,
      text: ""
    }]);
  }, [conversation, speakers]);

  const updateLine = useCallback((id: string, field: keyof ConversationLine, value: string) => {
    setConversation(prev => prev.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  }, []);

  const removeLine = useCallback((id: string) => {
    setConversation(prev => prev.filter(line => line.id !== id));
  }, []);

  const buildConversationText = useCallback(() => {
    return conversation
      .filter(line => line.text.trim())
      .map(line => {
        const speaker = speakers.find(s => s.id === line.speakerId);
        return `${speaker?.name || "Speaker"}: ${line.text}`;
      })
      .join("\n");
  }, [conversation, speakers]);

  const generateAudio = useCallback(async () => {
    setGeneration({
      status: "generating",
      audioUrl: null,
      error: null
    });

    try {
      let requestBody;
      
      if (mode === "single") {
        const effectiveStyle = singleStyle !== "natural" ? singleStyle : "";
        const styledText = effectiveStyle ? `${effectiveStyle}: ${singleText}` : singleText;
        requestBody = {
          text: styledText,
          speakers: [{ name: "Speaker", voice: singleVoice, style: effectiveStyle }]
        };
      } else {
        const conversationText = buildConversationText();
        if (!conversationText.trim()) {
          throw new Error("Please add some dialogue lines");
        }
        requestBody = {
          text: conversationText,
          speakers: speakers.map(s => ({
            name: s.name,
            voice: s.voice,
            style: s.style !== "natural" ? s.style : ""
          }))
        };
      }

      const response = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate audio");
      }

      const data = await response.json();
      
      if (data.audioBase64) {
        const mimeType = data.mimeType || "audio/mpeg";
        const audioBlob = base64ToBlob(data.audioBase64, mimeType);
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setGeneration({
          status: "complete",
          audioUrl,
          error: null
        });
      } else {
        throw new Error(data.error || "No audio generated");
      }
    } catch (error) {
      setGeneration({
        status: "error",
        audioUrl: null,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }, [mode, singleText, singleVoice, singleStyle, speakers, buildConversationText]);

  const downloadAudio = useCallback(() => {
    if (!generation.audioUrl) return;
    
    const link = document.createElement("a");
    link.href = generation.audioUrl;
    link.download = `expressive-speech-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generation.audioUrl]);

  return (
    <div className="min-h-screen bg-background" data-testid="page-expressive-speech">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Expressive Speech</h1>
          </div>
          <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
            Gemini 2.5 TTS
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "multi")} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2" data-testid="tab-single">
              <Volume2 className="h-4 w-4" />
              Single Voice
            </TabsTrigger>
            <TabsTrigger value="multi" className="flex items-center gap-2" data-testid="tab-multi">
              <Users className="h-4 w-4" />
              Multi-Speaker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Single Voice Generation</CardTitle>
                <CardDescription>
                  Generate expressive speech with one voice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="single-text">Text to Speak</Label>
                  <Textarea
                    id="single-text"
                    placeholder="Enter the text you want to convert to speech..."
                    value={singleText}
                    onChange={(e) => setSingleText(e.target.value)}
                    rows={4}
                    data-testid="input-single-text"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={singleVoice} onValueChange={setSingleVoice}>
                      <SelectTrigger data-testid="select-single-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_VOICES.map((v) => (
                          <SelectItem key={v.value} value={v.value}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Style</Label>
                    <Select value={singleStyle} onValueChange={setSingleStyle}>
                      <SelectTrigger data-testid="select-single-style">
                        <SelectValue placeholder="Natural" />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_PRESETS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="multi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Speakers</span>
                  {speakers.length < 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSpeaker}
                      data-testid="button-add-speaker"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Speaker
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure up to 2 speakers for your conversation (Gemini 2.5 TTS limit)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {speakers.map((speaker, index) => (
                  <div key={speaker.id} className="flex gap-3 items-start p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={speaker.name}
                          onChange={(e) => updateSpeaker(speaker.id, "name", e.target.value)}
                          placeholder="Speaker name"
                          data-testid={`input-speaker-name-${index}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Voice</Label>
                        <Select 
                          value={speaker.voice} 
                          onValueChange={(v) => updateSpeaker(speaker.id, "voice", v)}
                        >
                          <SelectTrigger data-testid={`select-speaker-voice-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_VOICES.map((v) => (
                              <SelectItem key={v.value} value={v.value}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Style</Label>
                        <Select 
                          value={speaker.style} 
                          onValueChange={(v) => updateSpeaker(speaker.id, "style", v)}
                        >
                          <SelectTrigger data-testid={`select-speaker-style-${index}`}>
                            <SelectValue placeholder="Natural" />
                          </SelectTrigger>
                          <SelectContent>
                            {STYLE_PRESETS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {speakers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeSpeaker(speaker.id)}
                        data-testid={`button-remove-speaker-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Conversation
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    data-testid="button-add-line"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </CardTitle>
                <CardDescription>
                  Write dialogue for each speaker
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {conversation.map((line, index) => {
                  const speaker = speakers.find(s => s.id === line.speakerId);
                  return (
                    <div key={line.id} className="flex gap-3 items-start">
                      <Select
                        value={line.speakerId}
                        onValueChange={(v) => updateLine(line.id, "speakerId", v)}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-line-speaker-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {speakers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={line.text}
                        onChange={(e) => updateLine(line.id, "text", e.target.value)}
                        placeholder={`${speaker?.name || "Speaker"}'s line...`}
                        className="flex-1"
                        data-testid={`input-line-text-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.id)}
                        data-testid={`button-remove-line-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                
                {conversation.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No dialogue lines yet. Click "Add Line" to start your conversation.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4">
                {generation.status === "generating" ? (
                  <Button size="lg" disabled data-testid="button-generating">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating...
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={generateAudio}
                    disabled={mode === "single" ? !singleText.trim() : conversation.length === 0}
                    data-testid="button-generate"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Generate Speech
                  </Button>
                )}
              </div>

              {generation.status === "generating" && (
                <div className="w-full max-w-md space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Processing with Gemini 2.5...</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 animate-pulse"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}

              {generation.status === "error" && (
                <div className="text-destructive text-center p-4 bg-destructive/10 rounded-lg max-w-md" data-testid="text-error">
                  {generation.error}
                </div>
              )}

              {generation.status === "complete" && generation.audioUrl && (
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Volume2 className="h-5 w-5" />
                    <span className="font-medium">Speech Generated!</span>
                  </div>
                  
                  <audio
                    ref={audioRef}
                    src={generation.audioUrl}
                    controls
                    className="w-full"
                    data-testid="audio-player"
                  />
                  
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={downloadAudio}
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Audio
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </main>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t z-50">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
            <StatusBarTip />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Format: MP3 (compressed)</span>
          </div>
        </div>
      </div>
      <div className="h-12" /> {/* Spacer for fixed status bar */}
    </div>
  );
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

