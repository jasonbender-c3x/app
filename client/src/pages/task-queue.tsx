import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  ListTodo, 
  RefreshCw, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trash2, 
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Power,
  PowerOff,
  Hand,
  Send,
  Zap,
  GitBranch
} from "lucide-react";
import { Link } from "wouter";

interface QueuedTask {
  id: string;
  parentId: string | null;
  chatId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  priority: number;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  estimatedDuration: number | null;
  actualDuration: number | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  executionMode?: string;
  condition?: string | null;
  waitingForInput?: boolean;
  inputPrompt?: string | null;
  dependencies?: string[] | null;
  workflowId?: string | null;
}

interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

interface ExecutorStatus {
  isRunning: boolean;
  isPaused: boolean;
  activeTaskCount: number;
  pendingTaskCount: number;
  stats: QueueStats;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: <Clock className="w-3 h-3" />, label: "Pending" },
  running: { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Running" },
  completed: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle className="w-3 h-3" />, label: "Completed" },
  failed: { color: "bg-red-500/10 text-red-600 border-red-500/20", icon: <XCircle className="w-3 h-3" />, label: "Failed" },
  cancelled: { color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: <XCircle className="w-3 h-3" />, label: "Cancelled" },
  waiting_input: { color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: <Hand className="w-3 h-3" />, label: "Waiting Input" },
};

const taskTypeConfig: Record<string, { color: string; label: string }> = {
  research: { color: "bg-purple-500/10 text-purple-600", label: "Research" },
  action: { color: "bg-blue-500/10 text-blue-600", label: "Action" },
  analysis: { color: "bg-cyan-500/10 text-cyan-600", label: "Analysis" },
  synthesis: { color: "bg-green-500/10 text-green-600", label: "Synthesis" },
  fetch: { color: "bg-orange-500/10 text-orange-600", label: "Fetch" },
  transform: { color: "bg-pink-500/10 text-pink-600", label: "Transform" },
  validate: { color: "bg-yellow-500/10 text-yellow-600", label: "Validate" },
  notify: { color: "bg-indigo-500/10 text-indigo-600", label: "Notify" },
};

export default function TaskQueuePage() {
  const [tasks, setTasks] = useState<QueuedTask[]>([]);
  const [waitingTasks, setWaitingTasks] = useState<QueuedTask[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, running: 0, completed: 0, failed: 0 });
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputTask, setInputTask] = useState<QueuedTask | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    taskType: "action",
    priority: 0,
  });

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") {
        params.set("status", filterStatus);
      }
      const response = await fetch(`/api/queue?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/queue/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  const loadExecutorStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/orchestration/executor/status");
      if (response.ok) {
        const data = await response.json();
        setExecutorStatus(data);
      }
    } catch (error) {
      console.error("Failed to load executor status:", error);
    }
  }, []);

  const loadWaitingTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/orchestration/tasks/waiting");
      if (response.ok) {
        const data = await response.json();
        setWaitingTasks(data);
      }
    } catch (error) {
      console.error("Failed to load waiting tasks:", error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadStats();
    loadExecutorStatus();
    loadWaitingTasks();
  }, [loadTasks, loadStats, loadExecutorStatus, loadWaitingTasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTasks();
      loadStats();
      loadExecutorStatus();
      loadWaitingTasks();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTasks, loadStats, loadExecutorStatus, loadWaitingTasks]);

  const toggleExecutor = async () => {
    try {
      const endpoint = executorStatus?.isRunning ? "stop" : "start";
      await fetch(`/api/orchestration/executor/${endpoint}`, { method: "POST" });
      loadExecutorStatus();
    } catch (error) {
      console.error("Failed to toggle executor:", error);
    }
  };

  const toggleExecutorPause = async () => {
    try {
      const endpoint = executorStatus?.isPaused ? "resume" : "pause";
      await fetch(`/api/orchestration/executor/${endpoint}`, { method: "POST" });
      loadExecutorStatus();
    } catch (error) {
      console.error("Failed to pause/resume executor:", error);
    }
  };

  const startTask = async (id: string) => {
    try {
      await fetch(`/api/queue/${id}/start`, { method: "POST" });
      loadTasks();
      loadStats();
    } catch (error) {
      console.error("Failed to start task:", error);
    }
  };

  const cancelTask = async (id: string) => {
    try {
      await fetch(`/api/queue/${id}/cancel`, { method: "POST" });
      loadTasks();
      loadStats();
    } catch (error) {
      console.error("Failed to cancel task:", error);
    }
  };

  const interruptTask = async (id: string) => {
    try {
      await fetch(`/api/orchestration/tasks/${id}/interrupt`, { method: "POST" });
      loadTasks();
      loadStats();
    } catch (error) {
      console.error("Failed to interrupt task:", error);
    }
  };

  const prioritizeTask = async (id: string) => {
    try {
      await fetch(`/api/orchestration/tasks/${id}/prioritize`, { method: "POST" });
      loadTasks();
    } catch (error) {
      console.error("Failed to prioritize task:", error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/queue/${id}`, { method: "DELETE" });
      loadTasks();
      loadStats();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const createTask = async () => {
    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      if (response.ok) {
        setIsCreateOpen(false);
        setNewTask({ title: "", description: "", taskType: "action", priority: 0 });
        loadTasks();
        loadStats();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const provideInput = async () => {
    if (!inputTask) return;
    try {
      await fetch(`/api/orchestration/tasks/${inputTask.id}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputValue }),
      });
      setIsInputOpen(false);
      setInputTask(null);
      setInputValue("");
      loadTasks();
      loadWaitingTasks();
    } catch (error) {
      console.error("Failed to provide input:", error);
    }
  };

  const openInputDialog = (task: QueuedTask) => {
    setInputTask(task);
    setInputValue("");
    setIsInputOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background" data-testid="task-queue-page">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListTodo className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Task Queue</h1>
                <p className="text-sm text-muted-foreground">AI batch processing queue</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadTasks(); loadStats(); loadExecutorStatus(); loadWaitingTasks(); }}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                data-testid="button-create-task"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Power className="w-5 h-5" />
                  Executor Control
                </CardTitle>
                <CardDescription>Manage the workflow execution engine</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {executorStatus && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${executorStatus.isRunning ? (executorStatus.isPaused ? "bg-yellow-500" : "bg-green-500 animate-pulse") : "bg-gray-400"}`} />
                      <span className="text-sm font-medium">
                        {executorStatus.isRunning ? (executorStatus.isPaused ? "Paused" : "Running") : "Stopped"}
                      </span>
                    </div>
                    <Button
                      variant={executorStatus.isPaused ? "default" : "outline"}
                      size="sm"
                      onClick={toggleExecutorPause}
                      disabled={!executorStatus.isRunning}
                      data-testid="button-pause-resume"
                    >
                      {executorStatus.isPaused ? (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      variant={executorStatus.isRunning ? "destructive" : "default"}
                      size="sm"
                      onClick={toggleExecutor}
                      data-testid="button-start-stop"
                    >
                      {executorStatus.isRunning ? (
                        <>
                          <PowerOff className="w-4 h-4 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Power className="w-4 h-4 mr-1" />
                          Start
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {waitingTasks.length > 0 && (
          <Card className="border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Hand className="w-5 h-5" />
                Tasks Waiting for Input ({waitingTasks.length})
              </CardTitle>
              <CardDescription>These tasks are paused and waiting for your input to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {waitingTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg bg-purple-500/5">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.inputPrompt && (
                        <p className="text-sm text-muted-foreground">{task.inputPrompt}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openInputDialog(task)}
                      data-testid={`button-provide-input-${task.id}`}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Provide Input
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-yellow-500/20" data-testid="stat-pending">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20" data-testid="stat-running">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Running</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
                </div>
                <Loader2 className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20" data-testid="stat-completed">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/20" data-testid="stat-failed">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Queued tasks for AI processing</CardDescription>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40" data-testid="select-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ListTodo className="w-12 h-12 mb-4 opacity-50" />
                  <p>No tasks in queue</p>
                  <p className="text-sm">Create a task or ask the AI to generate one</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => {
                    const effectiveStatus = task.waitingForInput ? "waiting_input" : task.status;
                    const statusInfo = statusConfig[effectiveStatus] || statusConfig.pending;
                    const typeInfo = taskTypeConfig[task.taskType] || { color: "bg-gray-500/10 text-gray-600", label: task.taskType };
                    const isExpanded = expandedTasks.has(task.id);

                    return (
                      <div
                        key={task.id}
                        className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        data-testid={`task-item-${task.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleExpand(task.id)}
                            className="mt-1 p-0.5 hover:bg-muted rounded"
                            data-testid={`button-expand-${task.id}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium truncate">{task.title}</span>
                              <Badge variant="outline" className={statusInfo.color}>
                                {statusInfo.icon}
                                <span className="ml-1">{statusInfo.label}</span>
                              </Badge>
                              <Badge variant="secondary" className={typeInfo.color}>
                                {typeInfo.label}
                              </Badge>
                              {task.priority > 0 && (
                                <Badge variant="outline">Priority: {task.priority}</Badge>
                              )}
                              {task.executionMode && task.executionMode !== "sequential" && (
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600">
                                  {task.executionMode}
                                </Badge>
                              )}
                              {task.parentId && (
                                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600">
                                  <GitBranch className="w-3 h-3 mr-1" />
                                  Subtask
                                </Badge>
                              )}
                              {task.workflowId && (
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                                  Workflow
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {task.description}
                              </p>
                            )}
                            {task.condition && (
                              <p className="text-xs text-purple-600 mt-1">
                                Condition: {task.condition}
                              </p>
                            )}
                            {isExpanded && (
                              <div className="mt-3 space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-muted-foreground">Created:</span>{" "}
                                    {formatDate(task.createdAt)}
                                  </div>
                                  {task.startedAt && (
                                    <div>
                                      <span className="text-muted-foreground">Started:</span>{" "}
                                      {formatDate(task.startedAt)}
                                    </div>
                                  )}
                                  {task.completedAt && (
                                    <div>
                                      <span className="text-muted-foreground">Completed:</span>{" "}
                                      {formatDate(task.completedAt)}
                                    </div>
                                  )}
                                  {task.actualDuration && (
                                    <div>
                                      <span className="text-muted-foreground">Duration:</span>{" "}
                                      {formatDuration(task.actualDuration)}
                                    </div>
                                  )}
                                </div>
                                {task.dependencies && task.dependencies.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Dependencies:</span>
                                    {task.dependencies.map((dep, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {dep.slice(0, 8)}...
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {task.error && (
                                  <div className="p-2 bg-red-500/10 rounded text-red-600 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{task.error}</span>
                                  </div>
                                )}
                                {task.input && (
                                  <div>
                                    <span className="text-muted-foreground">Input:</span>
                                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                      {JSON.stringify(task.input, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {task.output && (
                                  <div>
                                    <span className="text-muted-foreground">Output:</span>
                                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                      {JSON.stringify(task.output, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {task.waitingForInput && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openInputDialog(task)}
                                title="Provide input"
                                className="text-purple-600"
                                data-testid={`button-input-${task.id}`}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {task.status === "pending" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startTask(task.id)}
                                  title="Start task"
                                  data-testid={`button-start-${task.id}`}
                                >
                                  <Play className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => prioritizeTask(task.id)}
                                  title="Prioritize (run next)"
                                  data-testid={`button-prioritize-${task.id}`}
                                >
                                  <Zap className="w-4 h-4 text-yellow-600" />
                                </Button>
                              </>
                            )}
                            {task.status === "running" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => interruptTask(task.id)}
                                title="Interrupt task"
                                data-testid={`button-interrupt-${task.id}`}
                              >
                                <XCircle className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                            {(task.status === "pending" || task.status === "running") && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => cancelTask(task.id)}
                                title="Cancel task"
                                data-testid={`button-cancel-${task.id}`}
                              >
                                <Pause className="w-4 h-4 text-yellow-600" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteTask(task.id)}
                              title="Delete task"
                              data-testid={`button-delete-${task.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a task to the processing queue</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newTask.title}
                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description (optional)"
                data-testid="input-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={newTask.taskType}
                  onValueChange={value => setNewTask(prev => ({ ...prev, taskType: value }))}
                >
                  <SelectTrigger data-testid="select-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="synthesis">Synthesis</SelectItem>
                    <SelectItem value="fetch">Fetch</SelectItem>
                    <SelectItem value="transform">Transform</SelectItem>
                    <SelectItem value="validate">Validate</SelectItem>
                    <SelectItem value="notify">Notify</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={newTask.priority}
                  onChange={e => setNewTask(prev => ({ ...prev, priority: parseInt(e.target.value, 10) || 0 }))}
                  min={0}
                  max={100}
                  data-testid="input-task-priority"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTask} disabled={!newTask.title} data-testid="button-submit-task">
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInputOpen} onOpenChange={setIsInputOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Input</DialogTitle>
            <DialogDescription>
              {inputTask?.inputPrompt || `The task "${inputTask?.title}" is waiting for your input to continue.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Response</Label>
              <Textarea
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Enter your input..."
                rows={4}
                data-testid="input-user-response"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInputOpen(false)}>
              Cancel
            </Button>
            <Button onClick={provideInput} disabled={!inputValue.trim()} data-testid="button-submit-input">
              <Send className="w-4 h-4 mr-2" />
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
