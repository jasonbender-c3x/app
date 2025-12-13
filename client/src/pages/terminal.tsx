import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Terminal as TerminalIcon, Play, Trash2, RefreshCw, Download, StopCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "system";
  content: string;
  timestamp: Date;
}

export default function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome to Nebula Terminal. Type commands below or let the AI execute code.",
      timestamp: new Date()
    }
  ]);
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = (type: TerminalLine["type"], content: string) => {
    const newLine: TerminalLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date()
    };
    setLines(prev => [...prev, newLine]);
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsExecuting(true);
    addLine("command", `$ ${cmd}`);
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommand("");

    try {
      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd })
      });

      const data = await response.json();

      if (data.stdout) {
        addLine("output", data.stdout);
      }
      if (data.stderr) {
        addLine("error", data.stderr);
      }
      if (data.error) {
        addLine("error", `Error: ${data.error}`);
      }
      if (!data.stdout && !data.stderr && !data.error) {
        addLine("system", "(Command completed with no output)");
      }
    } catch (error) {
      addLine("error", `Failed to execute command: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isExecuting) {
      executeCommand(command);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    } else if (e.key === "c" && e.ctrlKey) {
      addLine("system", "^C");
      setCommand("");
    }
  };

  const clearTerminal = () => {
    setLines([{
      id: "cleared",
      type: "system",
      content: "Terminal cleared.",
      timestamp: new Date()
    }]);
  };

  const downloadOutput = async () => {
    try {
      const response = await fetch("/api/terminal/output");
      const data = await response.json();
      
      const blob = new Blob([data.content || "No output saved"], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "terminal-output.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addLine("error", "Failed to download output file");
    }
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command": return "text-cyan-400";
      case "output": return "text-gray-300";
      case "error": return "text-red-400";
      case "system": return "text-yellow-400";
      default: return "text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-1 flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <TerminalIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Code Execution Terminal</h1>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="text-muted-foreground text-sm">
            Execute shell commands. Output is saved for AI reference.
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadOutput}
              data-testid="button-download-output"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Output
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearTerminal}
              data-testid="button-clear-terminal"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-border bg-[#1e1e1e] overflow-hidden flex flex-col min-h-[500px]">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-[#888] text-xs ml-2 font-mono">bash - code execution</span>
            {isExecuting && (
              <div className="ml-auto flex items-center gap-2 text-yellow-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-xs">Executing...</span>
              </div>
            )}
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            onClick={() => inputRef.current?.focus()}
            data-testid="terminal-output-area"
          >
            {lines.map((line) => (
              <div 
                key={line.id} 
                className={cn("py-0.5 whitespace-pre-wrap break-all", getLineColor(line.type))}
                data-testid={`terminal-line-${line.id}`}
              >
                {line.content}
              </div>
            ))}
            
            <div className="flex items-center py-0.5">
              <span className="text-green-400 mr-2">$</span>
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isExecuting}
                className="flex-1 bg-transparent border-none outline-none text-gray-300 font-mono"
                placeholder={isExecuting ? "Executing..." : "Enter command..."}
                autoComplete="off"
                spellCheck={false}
                data-testid="input-terminal-command"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>Tips: Use arrow keys for command history. Ctrl+C to cancel input. Output is automatically saved for AI access.</p>
        </div>
      </div>
    </div>
  );
}
