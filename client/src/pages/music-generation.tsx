import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Music, Play, Square, Download, Loader2, Volume2, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface GenerationState {
  status: "idle" | "generating" | "complete" | "error";
  progress: number;
  audioUrl: string | null;
  error: string | null;
  description: string | null;
  setupInstructions: string | null;
}

const SCALES = [
  "C_MAJOR", "C_MINOR", "D_MAJOR", "D_MINOR", "E_MAJOR", "E_MINOR",
  "F_MAJOR", "F_MINOR", "G_MAJOR", "G_MINOR", "A_MAJOR", "A_MINOR",
  "B_MAJOR", "B_MINOR"
];

const MUSIC_MODES = [
  { value: "QUALITY", label: "Quality - Best audio fidelity" },
  { value: "DIVERSITY", label: "Diversity - More variation" },
  { value: "VOCALIZATION", label: "Vocalization - Vocal sounds" }
];

export default function MusicGenerationPage() {
  const [prompt, setPrompt] = useState("A calm ambient electronic track with soft synths");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [bpm, setBpm] = useState([120]);
  const [density, setDensity] = useState([0.5]);
  const [brightness, setBrightness] = useState([0.5]);
  const [scale, setScale] = useState("C_MAJOR");
  const [mode, setMode] = useState("QUALITY");
  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
    progress: 0,
    audioUrl: null,
    error: null,
    description: null,
    setupInstructions: null
  });
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const generateMusic = useCallback(async () => {
    if (!prompt.trim()) return;

    setGeneration({
      status: "generating",
      progress: 0,
      audioUrl: null,
      error: null,
      description: null,
      setupInstructions: null
    });

    try {
      const response = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          bpm: bpm[0],
          density: density[0],
          brightness: brightness[0],
          scale,
          mode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate music");
      }

      const data = await response.json();
      
      if (data.audioBase64) {
        const audioBlob = base64ToBlob(data.audioBase64, "audio/wav");
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setGeneration({
          status: "complete",
          progress: 100,
          audioUrl,
          error: null,
          description: data.description || null,
          setupInstructions: null
        });
      } else if (data.description) {
        setGeneration({
          status: "complete",
          progress: 100,
          audioUrl: null,
          error: null,
          description: data.description,
          setupInstructions: data.setupInstructions || null
        });
      } else {
        throw new Error("No audio or description received");
      }
    } catch (error) {
      setGeneration({
        status: "error",
        progress: 0,
        audioUrl: null,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        description: null,
        setupInstructions: null
      });
    }
  }, [prompt, negativePrompt, bpm, density, brightness, scale, mode]);

  const stopGeneration = useCallback(() => {
    setGeneration(prev => ({
      ...prev,
      status: "idle",
      progress: 0
    }));
  }, []);

  const downloadAudio = useCallback(() => {
    if (!generation.audioUrl) return;
    
    const link = document.createElement("a");
    link.href = generation.audioUrl;
    link.download = `lyria-music-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generation.audioUrl]);

  return (
    <div className="min-h-screen bg-background" data-testid="page-music-generation">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Music Generation</h1>
          </div>
          <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
            Powered by Google Lyria
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Prompt
              </CardTitle>
              <CardDescription>
                Describe the music you want to create
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Music Description</Label>
                <Input
                  id="prompt"
                  placeholder="A calm acoustic folk song with gentle guitar..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  data-testid="input-prompt"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="negative-prompt">Negative Prompt (Optional)</Label>
                <Input
                  id="negative-prompt"
                  placeholder="drums, electric guitar, loud..."
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  data-testid="input-negative-prompt"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>
                Fine-tune your music output
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>BPM (Tempo)</Label>
                  <span className="text-sm text-muted-foreground">{bpm[0]}</span>
                </div>
                <Slider
                  value={bpm}
                  onValueChange={setBpm}
                  min={60}
                  max={180}
                  step={1}
                  data-testid="slider-bpm"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Density</Label>
                  <span className="text-sm text-muted-foreground">{Math.round(density[0] * 100)}%</span>
                </div>
                <Slider
                  value={density}
                  onValueChange={setDensity}
                  min={0}
                  max={1}
                  step={0.1}
                  data-testid="slider-density"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Brightness</Label>
                  <span className="text-sm text-muted-foreground">{Math.round(brightness[0] * 100)}%</span>
                </div>
                <Slider
                  value={brightness}
                  onValueChange={setBrightness}
                  min={0}
                  max={1}
                  step={0.1}
                  data-testid="slider-brightness"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scale</Label>
                  <Select value={scale} onValueChange={setScale}>
                    <SelectTrigger data-testid="select-scale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCALES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger data-testid="select-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4">
                {generation.status === "generating" ? (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={stopGeneration}
                    data-testid="button-stop"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={generateMusic}
                    disabled={!prompt.trim()}
                    data-testid="button-generate"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Generate Music
                  </Button>
                )}
              </div>

              {generation.status === "generating" && (
                <div className="w-full max-w-md space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Generating...</span>
                    <span>This may take 30-60 seconds</span>
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
                <div className="text-destructive text-center p-4 bg-destructive/10 rounded-lg" data-testid="text-error">
                  {generation.error}
                </div>
              )}

              {generation.status === "complete" && generation.audioUrl && (
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Volume2 className="h-5 w-5" />
                    <span className="font-medium">Music Generated!</span>
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
                      Download WAV
                    </Button>
                  </div>
                </div>
              )}

              {generation.status === "complete" && !generation.audioUrl && generation.description && (
                <div className="w-full space-y-4" data-testid="section-description">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Sparkles className="h-5 w-5" />
                    <span className="font-medium">Music Production Plan Generated</span>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                      {generation.description}
                    </pre>
                  </div>

                  {generation.setupInstructions && (
                    <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg text-sm">
                      <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                        Audio Generation Setup Required
                      </h4>
                      <pre className="whitespace-pre-wrap text-muted-foreground font-sans text-xs">
                        {generation.setupInstructions}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <h3 className="font-medium text-foreground mb-2">Tips for better results:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Be specific about instruments, mood, and genre</li>
            <li>Use negative prompts to exclude unwanted elements</li>
            <li>Lower density for minimal, ambient tracks</li>
            <li>Higher brightness for brighter, more energetic sounds</li>
          </ul>
        </div>
      </main>
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
