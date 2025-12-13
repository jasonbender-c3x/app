import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Play, Trash2, Download, Copy, Check, Code } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";

interface OutputLine {
  id: string;
  type: "stdout" | "stderr" | "system";
  content: string;
}

const DEFAULT_CODE = `# Python Sandbox - Write and execute Python code
# Output will appear in the panel below

print("Hello from Python!")

# Example: Calculate fibonacci numbers
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Print first 10 fibonacci numbers
for i in range(10):
    print(f"Fibonacci({i}) = {fibonacci(i)}")
`;

export default function PythonSandboxPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const addOutput = useCallback((type: OutputLine["type"], content: string) => {
    setOutput(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content
    }]);
  }, []);

  const runCode = async () => {
    if (isRunning || !code.trim()) return;

    setIsRunning(true);
    setOutput([{ id: "running", type: "system", content: "Running Python..." }]);

    try {
      const response = await fetch("/api/python/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      setOutput([]);
      
      if (data.stdout) {
        addOutput("stdout", data.stdout);
      }
      if (data.stderr) {
        addOutput("stderr", data.stderr);
      }
      if (data.error) {
        addOutput("stderr", `Error: ${data.error}`);
      }
      if (!data.stdout && !data.stderr && !data.error) {
        addOutput("system", "(Code executed with no output)");
      }
    } catch (error) {
      setOutput([{
        id: "error",
        type: "stderr",
        content: `Failed to execute: ${error instanceof Error ? error.message : "Unknown error"}`
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLineColor = (type: OutputLine["type"]) => {
    switch (type) {
      case "stdout": return "text-gray-300";
      case "stderr": return "text-red-400";
      case "system": return "text-yellow-400";
      default: return "text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1 flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Code className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Python Sandbox</h1>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <p className="text-muted-foreground text-sm">
            Write and execute Python code. Perfect for quick scripts and experiments.
          </p>
          <div className="flex gap-2">
            <Button 
              variant="default"
              size="sm" 
              onClick={runCode}
              disabled={isRunning}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-run-python"
            >
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? "Running..." : "Run"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyCode}
              data-testid="button-copy-code"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadCode}
              data-testid="button-download-code"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-rows-[1fr_auto] gap-4 min-h-[600px]">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-[#888] text-xs ml-2 font-mono">script.py</span>
            </div>
            <Editor
              height="400px"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                wordWrap: "on"
              }}
              data-testid="editor-python"
            />
          </div>

          <div className="rounded-lg border border-border bg-[#1e1e1e] overflow-hidden h-[200px]">
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
              <span className="text-[#888] text-xs font-mono">Output</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearOutput}
                className="h-6 px-2 text-xs"
                data-testid="button-clear-output"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            <ScrollArea className="h-[160px]">
              <div 
                ref={outputRef}
                className="p-4 font-mono text-sm"
                data-testid="python-output-area"
              >
                {output.length === 0 ? (
                  <span className="text-muted-foreground">Click "Run" to execute your Python code...</span>
                ) : (
                  output.map((line) => (
                    <div 
                      key={line.id} 
                      className={cn("py-0.5 whitespace-pre-wrap break-all", getLineColor(line.type))}
                    >
                      {line.content}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>Tips: Use Ctrl/Cmd + Enter to run code. Standard Python libraries are available.</p>
        </div>
      </div>
    </div>
  );
}
