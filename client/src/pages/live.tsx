/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         LIVE VOICE CONVERSATION PAGE                       ║
 * ║                    Real-time Audio Streaming with Gemini                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Radio,
  Waves,
  Settings2,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TranscriptEntry {
  id: string;
  speaker: "user" | "ai";
  text: string;
  timestamp: Date;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

const VOICES = [
  { value: "Kore", label: "Kore - Clear Female" },
  { value: "Puck", label: "Puck - Warm Male" },
  { value: "Charon", label: "Charon - Deep Male" },
  { value: "Fenrir", label: "Fenrir - Strong Male" },
  { value: "Aoede", label: "Aoede - Melodic Female" },
  { value: "Leda", label: "Leda - Soft Female" },
  { value: "Orus", label: "Orus - Authoritative Male" },
  { value: "Zephyr", label: "Zephyr - Gentle Neutral" },
];

export default function LivePage() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);

  const addTranscriptEntry = useCallback((speaker: "user" | "ai", text: string) => {
    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      speaker,
      text,
      timestamp: new Date(),
    };
    setTranscript(prev => [...prev, entry]);
  }, []);

  const connect = useCallback(async () => {
    setConnectionState("connecting");
    setError(null);

    try {
      const sessionId = crypto.randomUUID();
      sessionIdRef.current = sessionId;

      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          voiceName: selectedVoice,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create session");
      }

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live/stream/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Live] WebSocket connected");
        setConnectionState("connected");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "audio") {
            playAudioChunk(message.data);
            setIsSpeaking(true);
          } else if (message.type === "transcript") {
            addTranscriptEntry("ai", message.text);
            setIsSpeaking(false);
          } else if (message.type === "text") {
            setInterimText(message.text);
          } else if (message.type === "end") {
            setIsSpeaking(false);
          } else if (message.type === "error") {
            setError(message.error);
          }
        } catch (err) {
          console.error("[Live] Failed to parse message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[Live] WebSocket error:", err);
        setError("Connection error");
        setConnectionState("error");
      };

      ws.onclose = () => {
        console.log("[Live] WebSocket closed");
        if (connectionState === "connected") {
          setConnectionState("disconnected");
        }
      };

    } catch (err) {
      console.error("[Live] Failed to connect:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setConnectionState("error");
    }
  }, [selectedVoice, addTranscriptEntry, connectionState]);

  const disconnect = useCallback(async () => {
    stopListening();
    
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    
    audioQueueRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    audioQueueRef.current = [];
    
    if (playbackContextRef.current) {
      try { playbackContextRef.current.close(); } catch {}
      playbackContextRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (sessionIdRef.current) {
      try {
        await fetch(`/api/live/session/${sessionIdRef.current}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("[Live] Failed to close session:", err);
      }
      sessionIdRef.current = null;
    }

    setConnectionState("disconnected");
    setIsListening(false);
    setIsSpeaking(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(async () => {
    if (connectionState !== "connected") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      // Load the AudioWorklet processor
      try {
        await audioContextRef.current.audioWorklet.addModule("/audio-processor.js");
      } catch (e) {
        console.error("Failed to load audio processor worklet:", e);
        throw new Error("Failed to initialize audio processor");
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContextRef.current, "audio-processor");

      workletNode.port.onmessage = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // event.data is the ArrayBuffer containing Int16 PCM data
        const pcmBuffer = event.data;
        const uint8Array = new Uint8Array(pcmBuffer);
        
        // Convert to base64 for transmission
        let binaryString = "";
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binaryString);
        
        wsRef.current.send(JSON.stringify({
          type: "audio",
          data: base64,
          mimeType: "audio/pcm",
        }));
      };

      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);

      setIsListening(true);
    } catch (err) {
      console.error("[Live] Failed to start listening:", err);
      setError("Microphone access denied");
    }
  }, [connectionState]);

  const stopListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
  }, []);

  const playAudioChunk = useCallback((base64Data: string) => {
    if (isMuted) return;

    try {
      if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      const audioContext = playbackContextRef.current;

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);

      const int16Array = new Int16Array(bytes.buffer);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
      
      source.onended = () => {
        const index = audioQueueRef.current.indexOf(source);
        if (index > -1) {
          audioQueueRef.current.splice(index, 1);
        }
      };
      audioQueueRef.current.push(source);

      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
      speakingTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false);
      }, 500);
    } catch (err) {
      console.error("[Live] Failed to play audio:", err);
    }
  }, [isMuted]);

  const handleBargeIn = useCallback(() => {
    audioQueueRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    audioQueueRef.current = [];
    
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Live Voice</h1>
            </div>
            <Badge
              variant={
                connectionState === "connected"
                  ? "default"
                  : connectionState === "connecting"
                  ? "secondary"
                  : connectionState === "error"
                  ? "destructive"
                  : "outline"
              }
              className="ml-2"
              data-testid="badge-connection-state"
            >
              {connectionState === "connected" && (
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
              )}
              {connectionState}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-settings"
            >
              <Settings2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              data-testid="button-mute"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col gap-4 max-w-3xl">
        {showSettings && connectionState === "disconnected" && (
          <Card className="animate-in fade-in slide-in-from-top-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Voice Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">AI Voice</label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger data-testid="select-voice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICES.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          {voice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="py-3 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="flex-1 flex flex-col min-h-[400px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Waves className="h-4 w-4" />
              Conversation
            </CardTitle>
            <CardDescription>
              {connectionState === "disconnected"
                ? "Connect to start a voice conversation"
                : connectionState === "connected"
                ? isListening
                  ? "Listening..."
                  : "Press the mic button to speak"
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
              {transcript.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-center p-8">
                  <div>
                    <Radio className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Your conversation will appear here</p>
                    <p className="text-sm mt-1">Connect and start speaking to begin</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {transcript.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex gap-3",
                        entry.speaker === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2",
                          entry.speaker === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                        data-testid={`transcript-${entry.speaker}-${entry.id}`}
                      >
                        <p className="text-sm">{entry.text}</p>
                        <span className="text-xs opacity-60 mt-1 block">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {interimText && (
                    <div className="flex gap-3 justify-start">
                      <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-muted/50 border border-dashed">
                        <p className="text-sm text-muted-foreground italic">{interimText}</p>
                      </div>
                    </div>
                  )}
                  {isSpeaking && (
                    <div className="flex gap-3 justify-start">
                      <div className="rounded-2xl px-4 py-2 bg-muted flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Speaking...</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleBargeIn}
                          className="h-6 px-2 text-xs"
                          data-testid="button-barge-in"
                        >
                          Interrupt
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-4 py-4">
          {connectionState === "disconnected" || connectionState === "error" ? (
            <Button
              size="lg"
              className="rounded-full h-16 w-16"
              onClick={connect}
              data-testid="button-connect"
            >
              <Phone className="h-6 w-6" />
            </Button>
          ) : connectionState === "connecting" ? (
            <Button
              size="lg"
              className="rounded-full h-16 w-16"
              disabled
            >
              <Loader2 className="h-6 w-6 animate-spin" />
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant={isListening ? "default" : "outline"}
                className={cn(
                  "rounded-full h-16 w-16 transition-all",
                  isListening && "ring-4 ring-primary/30 animate-pulse"
                )}
                onClick={isListening ? stopListening : startListening}
                data-testid="button-mic"
              >
                {isListening ? (
                  <Mic className="h-6 w-6" />
                ) : (
                  <MicOff className="h-6 w-6" />
                )}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full h-16 w-16"
                onClick={disconnect}
                data-testid="button-disconnect"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {connectionState === "connected" && isListening
            ? "Speak naturally. The AI can hear you in real-time."
            : connectionState === "connected"
            ? "Tap the microphone to start speaking"
            : "Tap the phone button to connect"}
        </p>
      </main>
    </div>
  );
}
