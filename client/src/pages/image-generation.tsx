import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft, 
  Loader2, 
  Download, 
  Trash2, 
  Pencil, 
  Eraser, 
  Square, 
  Circle, 
  Type,
  Undo2,
  Redo2,
  Sparkles,
  Image as ImageIcon,
  Paintbrush,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Tool = "select" | "pencil" | "eraser" | "rectangle" | "circle" | "text" | "brush";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type Style = "photorealistic" | "artistic" | "digital-art" | "anime" | "sketch" | "oil-painting" | "watercolor" | "3d-render";

interface HistoryState {
  imageData: string | null;
}

const STYLES: { value: Style; label: string }[] = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "artistic", label: "Artistic" },
  { value: "digital-art", label: "Digital Art" },
  { value: "anime", label: "Anime" },
  { value: "sketch", label: "Sketch" },
  { value: "oil-painting", label: "Oil Painting" },
  { value: "watercolor", label: "Watercolor" },
  { value: "3d-render", label: "3D Render" },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string; width: number; height: number }[] = [
  { value: "1:1", label: "Square (1:1)", width: 1024, height: 1024 },
  { value: "16:9", label: "Landscape (16:9)", width: 1792, height: 1024 },
  { value: "9:16", label: "Portrait (9:16)", width: 1024, height: 1792 },
  { value: "4:3", label: "Standard (4:3)", width: 1365, height: 1024 },
  { value: "3:4", label: "Tall (3:4)", width: 1024, height: 1365 },
];

const COLORS = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#ff8800", "#8800ff",
  "#888888", "#444444", "#884400", "#008844", "#004488"
];

export default function ImageGenerationPage() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [style, setStyle] = useState<Style>("photorealistic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [zoom, setZoom] = useState(1);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const getCanvasDimensions = useCallback(() => {
    const ratio = ASPECT_RATIOS.find(r => r.value === aspectRatio);
    return ratio ? { width: ratio.width, height: ratio.height } : { width: 512, height: 512 };
  }, [aspectRatio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = getCanvasDimensions();
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      
      if (generatedImage) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = generatedImage;
      }
    }
    
    saveToHistory();
  }, [aspectRatio]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ imageData });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    const newIndex = historyIndex - 1;
    const state = history[newIndex];
    if (state?.imageData) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = state.imageData;
      }
    }
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    const state = history[newIndex];
    if (state?.imageData) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = state.imageData;
      }
    }
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "select") return;
    
    const pos = getMousePos(e);
    setIsDrawing(true);
    setLastPos(pos);

    if (tool === "rectangle" || tool === "circle") {
      const canvas = canvasRef.current;
      if (canvas) {
        const tempData = canvas.toDataURL();
        setHistory(prev => [...prev.slice(0, historyIndex + 1), { imageData: tempData }]);
      }
    }
  }, [tool, getMousePos, historyIndex]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPos) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pos = getMousePos(e);

    if (tool === "pencil" || tool === "brush") {
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === "brush" ? brushSize * 2 : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === "eraser") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = brushSize * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    setLastPos(pos);
  }, [isDrawing, lastPos, tool, color, brushSize, getMousePos]);

  const stopDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx && lastPos) {
      const pos = getMousePos(e);
      
      if (tool === "rectangle") {
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.strokeRect(lastPos.x, lastPos.y, pos.x - lastPos.x, pos.y - lastPos.y);
      } else if (tool === "circle") {
        const radiusX = Math.abs(pos.x - lastPos.x) / 2;
        const radiusY = Math.abs(pos.y - lastPos.y) / 2;
        const centerX = Math.min(lastPos.x, pos.x) + radiusX;
        const centerY = Math.min(lastPos.y, pos.y) + radiusY;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    setIsDrawing(false);
    setLastPos(null);
    saveToHistory();
  }, [isDrawing, lastPos, tool, color, brushSize, getMousePos, saveToHistory]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setGeneratedImage(null);
      saveToHistory();
    }
  }, [saveToHistory]);

  const generateImage = useCallback(async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a prompt to generate an image.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negativePrompt: negativePrompt || undefined,
          aspectRatio,
          style,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && data.image?.dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          saveToHistory();
        };
        img.src = data.image.dataUrl;
        setGeneratedImage(data.image.dataUrl);
      }

      toast({
        title: "Image generated",
        description: "Your image has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, negativePrompt, aspectRatio, style, toast, saveToHistory]);

  const editWithAI = useCallback(async () => {
    if (!editPrompt.trim()) {
      toast({
        title: "Edit prompt required",
        description: "Please describe how you want to edit the image.",
        variant: "destructive",
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsEditing(true);
    try {
      const tempCanvas = document.createElement("canvas");
      const maxDim = 1024;
      let width = canvas.width;
      let height = canvas.height;
      
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0, width, height);
      }
      
      const imageData = tempCanvas.toDataURL("image/jpeg", 0.85);
      const base64 = imageData.split(",")[1];

      const response = await fetch("/api/image/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: "image/jpeg",
          editPrompt,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to edit image");
      }

      const ctx = canvas.getContext("2d");
      if (ctx && data.image?.dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          saveToHistory();
        };
        img.src = data.image.dataUrl;
        setGeneratedImage(data.image.dataUrl);
      }

      toast({
        title: "Image edited",
        description: "Your edits have been applied.",
      });
      setEditPrompt("");
    } catch (error) {
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Failed to edit image",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  }, [editPrompt, toast, saveToHistory]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `nebula-image-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();

  return (
    <div className="min-h-screen bg-background" data-testid="page-image-generation">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Image Studio</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_350px] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Canvas</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={undo}
                      disabled={historyIndex <= 0}
                      data-testid="button-undo"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1}
                      data-testid="button-redo"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                      data-testid="button-zoom-out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-10 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                      data-testid="button-zoom-in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={clearCanvas}
                      data-testid="button-clear"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={downloadImage}
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex flex-col gap-2 p-2 bg-muted rounded-lg">
                    <Button
                      variant={tool === "select" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool("select")}
                      title="Select"
                      data-testid="tool-select"
                    >
                      <Move className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "pencil" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool("pencil")}
                      title="Pencil"
                      data-testid="tool-pencil"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "brush" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool("brush")}
                      title="Brush"
                      data-testid="tool-brush"
                    >
                      <Paintbrush className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "eraser" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool("eraser")}
                      title="Eraser"
                      data-testid="tool-eraser"
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "rectangle" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool("rectangle")}
                      title="Rectangle"
                      data-testid="tool-rectangle"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "circle" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setTool("circle")}
                      title="Circle"
                      data-testid="tool-circle"
                    >
                      <Circle className="h-4 w-4" />
                    </Button>
                    
                    <div className="border-t my-2" />
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Size</Label>
                      <Slider
                        value={[brushSize]}
                        onValueChange={([v]) => setBrushSize(v)}
                        min={1}
                        max={50}
                        step={1}
                        className="w-full"
                        data-testid="slider-brush-size"
                      />
                    </div>
                    
                    <div className="border-t my-2" />
                    
                    <div className="grid grid-cols-3 gap-1">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          className={cn(
                            "w-6 h-6 rounded border-2 transition-all",
                            color === c ? "border-primary scale-110" : "border-transparent"
                          )}
                          style={{ backgroundColor: c }}
                          onClick={() => setColor(c)}
                          data-testid={`color-${c.slice(1)}`}
                        />
                      ))}
                    </div>
                    
                    <Input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full h-8 p-0 border-0"
                      data-testid="input-color-picker"
                    />
                  </div>
                  
                  <div 
                    ref={containerRef}
                    className="flex-1 flex items-center justify-center bg-muted/50 rounded-lg overflow-auto p-4"
                  >
                    <canvas
                      ref={canvasRef}
                      width={canvasWidth}
                      height={canvasHeight}
                      className="bg-white shadow-lg cursor-crosshair"
                      style={{ 
                        transform: `scale(${zoom})`,
                        transformOrigin: "center center",
                        maxWidth: "100%",
                        height: "auto"
                      }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      data-testid="canvas-main"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Edit
                </CardTitle>
                <CardDescription>
                  Describe changes you want to make to the current canvas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="e.g., Add a sunset sky in the background..."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="flex-1"
                    rows={2}
                    data-testid="input-edit-prompt"
                  />
                  <Button 
                    onClick={editWithAI}
                    disabled={isEditing || !editPrompt.trim()}
                    data-testid="button-edit-ai"
                  >
                    {isEditing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate Image
                </CardTitle>
                <CardDescription>
                  Create images from text descriptions using AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the image you want to create..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    data-testid="input-prompt"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="negative-prompt">Negative Prompt (Optional)</Label>
                  <Input
                    id="negative-prompt"
                    placeholder="Things to avoid in the image..."
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    data-testid="input-negative-prompt"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
                    <SelectTrigger data-testid="select-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                    <SelectTrigger data-testid="select-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_RATIOS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={generateImage}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Image
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Canvas Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span>{canvasWidth} x {canvasHeight}px</span>
                </div>
                <div className="flex justify-between">
                  <span>Aspect Ratio:</span>
                  <span>{aspectRatio}</span>
                </div>
                <div className="flex justify-between">
                  <span>History:</span>
                  <span>{historyIndex + 1} / {history.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
