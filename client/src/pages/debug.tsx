import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Bug, Database, Terminal, RefreshCw, Trash2, ChevronLeft, ChevronRight, Table2, Brain, Clock, Wrench, Eye, Code, MessageSquare, Settings, FileText, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [llmDetailTab, setLLMDetailTab] = useState<"prompt" | "system" | "output">("prompt");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    userMessage: true,
    systemPrompt: true,
    history: false,
    response: true,
    rawResponse: false,
    toolCalls: false,
    toolResults: false,
    attachments: false
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <span>LLM Interaction</span>
                <span className="text-sm font-normal text-muted-foreground">
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
          
          {selectedLLM && llmViewMode === "raw" ? (
            <ScrollArea className="flex-1 h-[80vh]">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(JSON.stringify(selectedLLM, null, 2), 'raw-json')}
                  data-testid="button-copy-raw"
                >
                  {copiedId === 'raw-json' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
                <pre className="p-4 bg-[#1e1e1e] rounded-lg text-xs text-[#d4d4d4] font-mono whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedLLM, null, 2)}
                </pre>
              </div>
            </ScrollArea>
          ) : selectedLLM && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Metadata Bar */}
              <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-secondary/20 border border-border mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="font-mono text-sm text-primary">{selectedLLM.model}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-mono text-sm">{formatDuration(selectedLLM.durationMs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Chat ID</p>
                  <p className="font-mono text-xs truncate" title={selectedLLM.chatId}>{selectedLLM.chatId.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Message ID</p>
                  <p className="font-mono text-xs truncate" title={selectedLLM.messageId}>{selectedLLM.messageId.slice(0, 8)}...</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <Tabs value={llmDetailTab} onValueChange={(v) => setLLMDetailTab(v as typeof llmDetailTab)} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="prompt" className="flex items-center gap-2" data-testid="tab-llm-prompt">
                    <MessageSquare className="h-4 w-4" />
                    Prompt
                  </TabsTrigger>
                  <TabsTrigger value="system" className="flex items-center gap-2" data-testid="tab-llm-system">
                    <Settings className="h-4 w-4" />
                    System
                  </TabsTrigger>
                  <TabsTrigger value="output" className="flex items-center gap-2" data-testid="tab-llm-output">
                    <FileText className="h-4 w-4" />
                    Output
                  </TabsTrigger>
                </TabsList>

                {/* Prompt Tab */}
                <TabsContent value="prompt" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-[55vh]">
                    <div className="space-y-4 pr-4">
                      {/* User Message - Full */}
                      <Collapsible open={expandedSections.userMessage} onOpenChange={() => toggleSection('userMessage')}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">USER</span>
                            <span className="text-sm font-medium">Message</span>
                            <span className="text-xs text-muted-foreground">({selectedLLM.userMessage?.length || 0} chars)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedLLM.userMessage || '', 'user-msg'); }}
                            >
                              {copiedId === 'user-msg' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                            {expandedSections.userMessage ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                            <pre className="text-sm whitespace-pre-wrap text-[#e0e0e0] font-mono leading-relaxed">
                              {selectedLLM.userMessage || <span className="text-[#666] italic">(No user message)</span>}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Conversation History - Full */}
                      {selectedLLM.conversationHistory.length > 0 && (
                        <Collapsible open={expandedSections.history} onOpenChange={() => toggleSection('history')}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/40 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Conversation History</span>
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{selectedLLM.conversationHistory.length} messages</span>
                            </div>
                            {expandedSections.history ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-2 mt-2 p-3 rounded-lg bg-secondary/10 border border-border">
                              {selectedLLM.conversationHistory.map((msg, idx) => (
                                <div key={idx} className="p-3 rounded bg-[#1e1e1e] border border-[#333]">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                      {msg.role.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{msg.content.length} chars</span>
                                  </div>
                                  <pre className="text-sm text-[#c5c5c5] whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</pre>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Attachments */}
                      {selectedLLM.attachments.length > 0 && (
                        <Collapsible open={expandedSections.attachments} onOpenChange={() => toggleSection('attachments')}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/40 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Attachments</span>
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{selectedLLM.attachments.length}</span>
                            </div>
                            {expandedSections.attachments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="flex flex-wrap gap-2 mt-2 p-3">
                              {selectedLLM.attachments.map((att, idx) => (
                                <span key={idx} className="px-3 py-1.5 rounded-full bg-secondary border border-border text-xs">
                                  {att.filename || att.type} ({att.mimeType})
                                </span>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* System Tab */}
                <TabsContent value="system" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-[55vh]">
                    <div className="space-y-4 pr-4">
                      <Collapsible open={expandedSections.systemPrompt} onOpenChange={() => toggleSection('systemPrompt')}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/15 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-semibold">SYSTEM</span>
                            <span className="text-sm font-medium">Prompt</span>
                            <span className="text-xs text-muted-foreground">({selectedLLM.systemPrompt?.length || 0} chars)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedLLM.systemPrompt || '', 'system-prompt'); }}
                            >
                              {copiedId === 'system-prompt' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                            {expandedSections.systemPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                            <pre className="text-sm font-mono whitespace-pre-wrap text-[#c5c5c5] leading-relaxed">{selectedLLM.systemPrompt}</pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Output Tab */}
                <TabsContent value="output" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-[55vh]">
                    <div className="space-y-4 pr-4">
                      {/* Clean Response */}
                      <Collapsible open={expandedSections.response} onOpenChange={() => toggleSection('response')}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/15 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-semibold">AI</span>
                            <span className="text-sm font-medium">Response (Clean)</span>
                            <span className="text-xs text-muted-foreground">({selectedLLM.cleanContent?.length || 0} chars)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedLLM.cleanContent || '', 'clean-response'); }}
                            >
                              {copiedId === 'clean-response' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                            {expandedSections.response ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                            <pre className="text-sm whitespace-pre-wrap text-[#e0e0e0] font-mono leading-relaxed">
                              {selectedLLM.cleanContent || <span className="text-[#666] italic">(empty)</span>}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Raw Response */}
                      <Collapsible open={expandedSections.rawResponse} onOpenChange={() => toggleSection('rawResponse')}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-500/10 border border-gray-500/30 hover:bg-gray-500/15 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 text-xs font-semibold">RAW</span>
                            <span className="text-sm font-medium">Response</span>
                            <span className="text-xs text-muted-foreground">({selectedLLM.rawResponse?.length || 0} chars)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(selectedLLM.rawResponse || '', 'raw-response'); }}
                            >
                              {copiedId === 'raw-response' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                            {expandedSections.rawResponse ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                            <pre className="text-sm font-mono whitespace-pre-wrap text-[#b0b0b0] leading-relaxed">{selectedLLM.rawResponse}</pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Tool Calls */}
                      {selectedLLM.parsedToolCalls.length > 0 && (
                        <Collapsible open={expandedSections.toolCalls} onOpenChange={() => toggleSection('toolCalls')}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-amber-400" />
                              <span className="text-sm font-medium">Parsed Tool Calls</span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">{selectedLLM.parsedToolCalls.length}</span>
                            </div>
                            {expandedSections.toolCalls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 mt-2 rounded-lg bg-[#1e1e1e] border border-border">
                              <pre className="text-xs font-mono whitespace-pre-wrap text-amber-200">
                                {JSON.stringify(selectedLLM.parsedToolCalls, null, 2)}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Tool Results */}
                      {selectedLLM.toolResults.length > 0 && (
                        <Collapsible open={expandedSections.toolResults} onOpenChange={() => toggleSection('toolResults')}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-amber-400" />
                              <span className="text-sm font-medium">Tool Results</span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">{selectedLLM.toolResults.length}</span>
                            </div>
                            {expandedSections.toolResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-2 mt-2">
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
                                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                                      {typeof result.result === 'string' ? result.result : JSON.stringify(result.result as object, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
