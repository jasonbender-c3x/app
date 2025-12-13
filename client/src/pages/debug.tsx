import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Bug, Database, Terminal, RefreshCw, Trash2, ChevronLeft, ChevronRight, Table2, Brain, Clock, Wrench, Eye, Code } from "lucide-react";
import { Link } from "wouter";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  details?: string;
}

interface TableInfo {
  name: string;
  rowCount: number;
  columns: string[];
}

interface TableData {
  rows: Record<string, unknown>[];
  total: number;
}

interface LLMInteraction {
  id: string;
  timestamp: string;
  chatId: string;
  messageId: string;
  systemPrompt: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  attachments: Array<{ type: string; filename?: string; mimeType?: string }>;
  rawResponse: string;
  parsedToolCalls: unknown[];
  cleanContent: string;
  toolResults: Array<{ toolId: string; type: string; success: boolean; result?: unknown; error?: string }>;
  model: string;
  durationMs: number;
  tokenEstimate?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [llmInteractions, setLLMInteractions] = useState<LLMInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("logs");
  
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const pageSize = 20;

  const [selectedLLM, setSelectedLLM] = useState<LLMInteraction | null>(null);
  const [llmViewMode, setLLMViewMode] = useState<"beautified" | "raw">("beautified");

  useEffect(() => {
    loadLogs();
    loadDatabaseInfo();
    loadLLMInteractions();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable.name, tablePage);
    }
  }, [selectedTable, tablePage]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/debug/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (activeTab !== 'logs') return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadDatabaseInfo = async () => {
    try {
      const response = await fetch('/api/debug/database');
      if (response.ok) {
        const data = await response.json();
        setTables(data);
      }
    } catch (error) {
      console.error('Failed to load database info:', error);
      setTables([]);
    }
  };

  const loadLLMInteractions = async () => {
    try {
      const response = await fetch('/api/debug/llm');
      if (response.ok) {
        const data = await response.json();
        setLLMInteractions(data);
      }
    } catch (error) {
      console.error('Failed to load LLM interactions:', error);
      setLLMInteractions([]);
    }
  };

  const clearLLMInteractions = async () => {
    try {
      await fetch('/api/debug/llm', { method: 'DELETE' });
      setLLMInteractions([]);
    } catch (error) {
      console.error('Failed to clear LLM interactions:', error);
    }
  };

  const loadTableData = async (tableName: string, page: number) => {
    setTableLoading(true);
    try {
      const offset = page * pageSize;
      const response = await fetch(`/api/debug/database/${tableName}?limit=${pageSize}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setTableData(data);
      }
    } catch (error) {
      console.error('Failed to load table data:', error);
      setTableData(null);
    }
    setTableLoading(false);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleTableClick = (table: TableInfo) => {
    setSelectedTable(table);
    setTablePage(0);
    setTableData(null);
  };

  const closeTableModal = () => {
    setSelectedTable(null);
    setTableData(null);
    setTablePage(0);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'debug': return 'text-blue-400';
      default: return 'text-green-400';
    }
  };

  const formatLogMessage = (message: string) => {
    let formatted = message
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '')
      .replace(/\\"/g, '"');
    
    const jsonMatch = formatted.match(/ :: ([\s\S]+)$/);
    if (jsonMatch) {
      const prefix = formatted.slice(0, formatted.indexOf(' :: '));
      const jsonPart = jsonMatch[1];
      try {
        const parsed = JSON.parse(jsonPart);
        const prettyJson = JSON.stringify(parsed, null, 2);
        return { prefix, json: prettyJson };
      } catch {
        return { prefix: formatted, json: null };
      }
    }
    
    return { prefix: formatted, json: null };
  };

  const formatLogTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const truncateText = (text: string, maxLen: number) => {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Bug className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Debug Console</h1>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="logs" className="flex items-center gap-2" data-testid="tab-logs">
              <Terminal className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2" data-testid="tab-database">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex items-center gap-2" data-testid="tab-llm">
              <Brain className="h-4 w-4" />
              LLM Prompts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">Server console output</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadLogs}
                  disabled={isLoading}
                  data-testid="button-refresh-logs"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearLogs}
                  data-testid="button-clear-logs"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-[#1e1e1e] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-[#888] text-xs ml-2 font-mono">server console</span>
              </div>
              <ScrollArea className="h-[500px]">
                <div className="p-4 font-mono text-sm leading-relaxed">
                  {logs.length === 0 ? (
                    <p className="text-[#666]">No logs to display. Interact with the app to generate logs.</p>
                  ) : (
                    logs.map((log) => {
                      const { prefix, json } = formatLogMessage(log.message);
                      return (
                        <div 
                          key={log.id} 
                          className="py-2 hover:bg-[#2a2a2a] px-2 -mx-2 rounded border-b border-[#333]"
                          data-testid={`log-entry-${log.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-[#666] shrink-0">{formatLogTime(log.timestamp)}</span>
                            <span className={`shrink-0 ${getLevelColor(log.level)}`}>[{log.level.toUpperCase()}]</span>
                            <span className="text-[#d4d4d4] whitespace-pre-wrap break-all">{prefix}</span>
                          </div>
                          {json && (
                            <pre className="mt-2 p-3 bg-[#1a1a1a] rounded border border-[#333] text-xs text-[#9cdcfe] whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">{json}</pre>
                          )}
                          {log.details && (
                            <pre className="mt-2 text-xs text-[#888] whitespace-pre-wrap">{log.details}</pre>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">Click a table to view its data</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDatabaseInfo}
                data-testid="button-refresh-database"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tables.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No database tables found</p>
                </div>
              ) : (
                tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => handleTableClick(table)}
                    className="p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 hover:border-primary/50 transition-all cursor-pointer text-left group"
                    data-testid={`table-link-${table.name}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
                        <Table2 className="h-4 w-4" />
                        {table.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {table.rowCount} rows
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {table.columns.slice(0, 4).map((column) => (
                        <span 
                          key={column} 
                          className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono"
                        >
                          {column}
                        </span>
                      ))}
                      {table.columns.length > 4 && (
                        <span className="px-1.5 py-0.5 text-muted-foreground text-xs">
                          +{table.columns.length - 4} more
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="llm" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">Recent LLM interactions (last 50)</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadLLMInteractions}
                  data-testid="button-refresh-llm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearLLMInteractions}
                  data-testid="button-clear-llm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {llmInteractions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground rounded-lg border border-border bg-secondary/20">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No LLM interactions recorded yet</p>
                  <p className="text-sm mt-2">Send a message to start capturing prompts</p>
                </div>
              ) : (
                llmInteractions.map((interaction) => (
                  <button
                    key={interaction.id}
                    onClick={() => setSelectedLLM(interaction)}
                    className="w-full p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 hover:border-primary/50 transition-all cursor-pointer text-left group"
                    data-testid={`llm-entry-${interaction.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground">
                            {formatLogTime(interaction.timestamp)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono">
                            {interaction.model}
                          </span>
                        </div>
                        <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                          {truncateText(interaction.userMessage, 100)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {truncateText(interaction.cleanContent, 80)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(interaction.durationMs)}
                        </div>
                        {interaction.toolResults.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-400">
                            <Wrench className="h-3 w-3" />
                            {interaction.toolResults.length} tools
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Table Data Modal */}
      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && closeTableModal()}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" />
              {selectedTable?.name}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedTable?.rowCount} total rows)
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {tableLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tableData && tableData.rows.length > 0 ? (
              <ScrollArea className="h-[60vh]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-data-view">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        {selectedTable?.columns.map((col) => (
                          <th 
                            key={col} 
                            className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className="border-b border-border/50 hover:bg-muted/50"
                          data-testid={`table-row-${idx}`}
                        >
                          {selectedTable?.columns.map((col) => (
                            <td 
                              key={col} 
                              className="px-3 py-2 font-mono text-xs max-w-[300px] truncate"
                              title={formatCellValue(row[col])}
                            >
                              {formatCellValue(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No data in this table</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {tablePage + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTablePage(p => Math.max(0, p - 1))}
                  disabled={tablePage === 0 || tableLoading}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={tablePage >= totalPages - 1 || tableLoading}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* LLM Interaction Detail Modal */}
      <Dialog open={!!selectedLLM} onOpenChange={(open) => !open && setSelectedLLM(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                LLM Interaction
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {selectedLLM && formatLogTime(selectedLLM.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={llmViewMode === "beautified" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLLMViewMode("beautified")}
                  data-testid="button-view-beautified"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Beautified
                </Button>
                <Button
                  variant={llmViewMode === "raw" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLLMViewMode("raw")}
                  data-testid="button-view-raw"
                >
                  <Code className="h-4 w-4 mr-1" />
                  Raw JSON
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 h-[70vh]">
            {selectedLLM && llmViewMode === "raw" ? (
              <pre className="p-4 bg-[#1e1e1e] rounded-lg text-xs text-[#d4d4d4] font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(selectedLLM, null, 2)}
              </pre>
            ) : selectedLLM && (
              <div className="space-y-6 p-2">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/20 border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="font-mono text-sm">{selectedLLM.model}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-mono text-sm">{formatDuration(selectedLLM.durationMs)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chat ID</p>
                    <p className="font-mono text-xs truncate">{selectedLLM.chatId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Message ID</p>
                    <p className="font-mono text-xs truncate">{selectedLLM.messageId}</p>
                  </div>
                </div>

                {/* User Message */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">USER</span>
                    Message
                  </h3>
                  <div className="p-4 rounded-lg bg-[#1e1e1e] border border-border">
                    <p className="text-sm whitespace-pre-wrap">{selectedLLM.userMessage}</p>
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">SYSTEM</span>
                    Prompt
                  </h3>
                  <div className="p-4 rounded-lg bg-[#1e1e1e] border border-border max-h-[300px] overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{selectedLLM.systemPrompt}</pre>
                  </div>
                </div>

                {/* Conversation History */}
                {selectedLLM.conversationHistory.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Conversation History ({selectedLLM.conversationHistory.length} messages)
                    </h3>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 rounded-lg bg-secondary/10 border border-border">
                      {selectedLLM.conversationHistory.map((msg, idx) => (
                        <div key={idx} className="p-2 rounded bg-[#1e1e1e] text-xs">
                          <span className={`font-semibold ${msg.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                            {msg.role.toUpperCase()}:
                          </span>
                          <span className="ml-2 text-muted-foreground">{truncateText(msg.content, 200)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Response */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">AI</span>
                    Response (Clean)
                  </h3>
                  <div className="p-4 rounded-lg bg-[#1e1e1e] border border-border max-h-[300px] overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{selectedLLM.cleanContent || '(empty)'}</p>
                  </div>
                </div>

                {/* Raw Response */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 text-xs">RAW</span>
                    Response
                  </h3>
                  <div className="p-4 rounded-lg bg-[#1e1e1e] border border-border max-h-[200px] overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{selectedLLM.rawResponse}</pre>
                  </div>
                </div>

                {/* Tool Calls */}
                {selectedLLM.parsedToolCalls.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-amber-400" />
                      Parsed Tool Calls ({selectedLLM.parsedToolCalls.length})
                    </h3>
                    <div className="p-4 rounded-lg bg-[#1e1e1e] border border-border max-h-[200px] overflow-y-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-amber-200">
                        {JSON.stringify(selectedLLM.parsedToolCalls, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Tool Results */}
                {selectedLLM.toolResults.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-amber-400" />
                      Tool Results ({selectedLLM.toolResults.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedLLM.toolResults.map((result, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${result.success ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs">{result.type}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {result.success ? 'SUCCESS' : 'FAILED'}
                            </span>
                          </div>
                          {result.error && (
                            <p className="text-xs text-red-400 mb-2">{result.error}</p>
                          )}
                          {result.result && (
                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                              {typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {selectedLLM.attachments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Attachments ({selectedLLM.attachments.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedLLM.attachments.map((att, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full bg-secondary text-xs">
                          {att.filename || att.type} ({att.mimeType})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
