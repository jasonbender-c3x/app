import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Bug, Database, Terminal, RefreshCw, Trash2, ChevronLeft, ChevronRight, X, Table2 } from "lucide-react";
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

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("logs");
  
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadLogs();
    loadDatabaseInfo();
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

  // Prettify log message - convert escaped characters and format JSON
  const formatLogMessage = (message: string) => {
    // Replace escaped newlines with actual newlines
    let formatted = message
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '')
      .replace(/\\"/g, '"');
    
    // Try to detect and pretty-print JSON in the message
    const jsonMatch = formatted.match(/ :: ([\s\S]+)$/);
    if (jsonMatch) {
      const prefix = formatted.slice(0, formatted.indexOf(' :: '));
      const jsonPart = jsonMatch[1];
      try {
        const parsed = JSON.parse(jsonPart);
        const prettyJson = JSON.stringify(parsed, null, 2);
        return { prefix, json: prettyJson };
      } catch {
        // Not valid JSON, return as-is
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
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="logs" className="flex items-center gap-2" data-testid="tab-logs">
              <Terminal className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2" data-testid="tab-database">
              <Database className="h-4 w-4" />
              Database
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
        </Tabs>
      </div>

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
    </div>
  );
}
