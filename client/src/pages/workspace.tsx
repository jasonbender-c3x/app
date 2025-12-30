/**
 * WORKSPACE - Integrated Chat, Editor, and Preview Layout
 * 
 * A unified workspace combining:
 * - Chat panel (left, adjustable from 1/3 screen)
 * - Monaco code editor (center)
 * - Live preview pane (right)
 * 
 * All panels are resizable using react-resizable-panels.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Send, 
  Play, 
  Moon, 
  Sun, 
  Plus, 
  X, 
  Save,
  Code2,
  MessageSquare,
  Eye,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileCode,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "@shared/schema";
import logo from "@assets/generated_images/cute_cat_logo_icon.png";

interface EditorFile {
  id: string;
  filename: string;
  code: string;
  language: string;
  isSaved: boolean;
}

const defaultHtmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      color: white;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    p { font-size: 1.2rem; opacity: 0.9; }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 2rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <h1>Welcome to Meowstik Workspace</h1>
  <p>Chat with AI on the left, code in the center, see live preview on the right!</p>
  <div class="card">
    <h2>Getting Started</h2>
    <p>This is a live HTML/CSS/JS editor. Your changes will appear in the preview instantly.</p>
  </div>
</body>
</html>`;

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'html': 'html', 'htm': 'html',
    'css': 'css', 'scss': 'scss', 'less': 'less',
    'js': 'javascript', 'jsx': 'javascript',
    'ts': 'typescript', 'tsx': 'typescript',
    'json': 'json', 'py': 'python',
    'md': 'markdown', 'xml': 'xml',
  };
  return languageMap[ext] || 'plaintext';
}

export default function WorkspacePage() {
  const [isDark, setIsDark] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  
  const [files, setFiles] = useState<EditorFile[]>([
    { id: "1", filename: "index.html", code: defaultHtmlCode, language: "html", isSaved: true }
  ]);
  const [activeFileId, setActiveFileId] = useState("1");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const createOrGetChat = async () => {
      try {
        const response = await fetch("/api/chats", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Workspace Chat" })
        });
        if (response.ok) {
          const chat = await response.json();
          setCurrentChatId(chat.id.toString());
          setChatError(null);
        } else {
          setChatError("Failed to create chat session");
        }
      } catch (error) {
        console.error("Failed to create chat:", error);
        setChatError("Failed to connect to chat service");
      }
    };
    createOrGetChat();
  }, []);

  const activeFile = files.find(f => f.id === activeFileId);
  const theme = isDark ? "vs-dark" : "vs-light";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    updatePreview();
  }, [files]);

  const updatePreview = useCallback(() => {
    if (!iframeRef.current) return;
    
    const htmlFile = files.find(f => f.language === 'html');
    if (htmlFile) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlFile.code);
        doc.close();
      }
    }
  }, [files]);

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !activeFile) return;
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, code: value, isSaved: false } : f
    ));
  };

  const addNewFile = () => {
    const newId = Date.now().toString();
    const newFile: EditorFile = {
      id: newId,
      filename: `untitled-${files.length + 1}.html`,
      code: "<!-- New file -->",
      language: "html",
      isSaved: false,
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newId);
  };

  const closeFile = (fileId: string) => {
    if (files.length === 1) return;
    const newFiles = files.filter(f => f.id !== fileId);
    setFiles(newFiles);
    if (activeFileId === fileId) {
      setActiveFileId(newFiles[0].id);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentChatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      chatId: currentChatId,
      role: "user",
      content: inputMessage.trim(),
      createdAt: new Date(),
      metadata: null,
      geminiContent: null,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: inputMessage.trim(),
          context: `User is working in the code editor. Current file: ${activeFile?.filename || 'none'}. Code:\n${activeFile?.code?.slice(0, 1000) || 'empty'}`
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        chatId: currentChatId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        metadata: null,
        geminiContent: null,
      };
      setMessages(prev => [...prev, aiMessage]);

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullContent += parsed.text;
                setMessages(prev => prev.map(m => 
                  m.id === aiMessage.id ? { ...m, content: fullContent } : m
                ));
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'dark bg-zinc-950' : 'bg-white'}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <img src={logo} alt="Meowstik" className="h-6 w-6" />
          <span className="font-semibold text-sm">Meowstik Workspace</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatExpanded(!chatExpanded)}
            data-testid="button-toggle-chat"
          >
            <MessageSquare className={`h-4 w-4 ${chatExpanded ? 'text-primary' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewExpanded(!previewExpanded)}
            data-testid="button-toggle-preview"
          >
            <Eye className={`h-4 w-4 ${previewExpanded ? 'text-primary' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            data-testid="button-theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={updatePreview}
            data-testid="button-refresh-preview"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <AnimatePresence>
          {chatExpanded && (
            <>
              <ResizablePanel 
                defaultSize={33} 
                minSize={20} 
                maxSize={50}
                className="flex flex-col"
              >
                <div className="flex-1 flex flex-col border-r">
                  <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">Chat</span>
                  </div>
                  
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-3">
                      {chatError ? (
                        <div className="text-center text-destructive text-sm py-8">
                          <p>{chatError}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setChatError(null);
                              fetch("/api/chats", { 
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ title: "Workspace Chat" })
                              })
                                .then(res => res.json())
                                .then(chat => setCurrentChatId(chat.id.toString()))
                                .catch(() => setChatError("Failed to connect"));
                            }}
                            data-testid="button-retry-chat"
                          >
                            Retry
                          </Button>
                        </div>
                      ) : !currentChatId ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          <div className="animate-pulse">Connecting...</div>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          <p>Start a conversation with the AI.</p>
                          <p className="mt-2">Ask questions about your code or request changes.</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-3 rounded-lg text-sm ${
                              msg.role === "user" 
                                ? "bg-primary/10 ml-4" 
                                : "bg-muted mr-4"
                            }`}
                          >
                            <div className="font-medium text-xs text-muted-foreground mb-1">
                              {msg.role === "user" ? "You" : "AI"}
                            </div>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </motion.div>
                        ))
                      )}
                      {isLoading && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <div className="animate-pulse">●</div>
                          <span>AI is thinking...</span>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t">
                    <div className="flex gap-2">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Ask about code..."
                        className="flex-1"
                        data-testid="input-chat"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button 
                        size="icon" 
                        onClick={handleSendMessage}
                        disabled={isLoading || !currentChatId || !!chatError}
                        data-testid="button-send-chat"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
        </AnimatePresence>

        <ResizablePanel defaultSize={chatExpanded && previewExpanded ? 34 : chatExpanded || previewExpanded ? 50 : 100} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30 overflow-x-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-t text-sm cursor-pointer transition-colors ${
                    activeFileId === file.id
                      ? "bg-background border-b-2 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setActiveFileId(file.id)}
                  data-testid={`tab-file-${file.id}`}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span className={!file.isSaved ? "italic" : ""}>
                    {file.filename}
                    {!file.isSaved && " *"}
                  </span>
                  {files.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(file.id);
                      }}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                      data-testid={`button-close-file-${file.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={addNewFile}
                data-testid="button-add-file"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language={activeFile?.language || 'html'}
                value={activeFile?.code || ''}
                theme={theme}
                onChange={handleEditorChange}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: true },
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                }}
              />
            </div>
          </div>
        </ResizablePanel>

        <AnimatePresence>
          {previewExpanded && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel 
                defaultSize={33} 
                minSize={20} 
                maxSize={50}
                className="flex flex-col"
              >
                <div className="h-full flex flex-col border-l">
                  <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">Preview</span>
                  </div>
                  
                  <div className="flex-1 bg-white">
                    <iframe
                      ref={iframeRef}
                      className="w-full h-full border-0"
                      title="Preview"
                      sandbox="allow-scripts"
                      data-testid="iframe-preview"
                    />
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </AnimatePresence>
      </ResizablePanelGroup>
    </div>
  );
}
