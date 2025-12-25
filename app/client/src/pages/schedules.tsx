import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Calendar, 
  RefreshCw, 
  Play, 
  Pause, 
  Clock, 
  Trash2, 
  Plus,
  Zap,
  Webhook,
  Mail,
  MessageSquare,
  Search,
  Settings2,
  AlertCircle,
  CheckCircle,
  Power,
  PowerOff,
  Timer,
  Loader2,
  Edit2,
  MoreVertical
} from "lucide-react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  cronExpression: string;
  workflowId: string | null;
  taskTemplate: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  consecutiveFailures: number;
  lastError: string | null;
  createdAt: string;
}

interface Trigger {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  config: Record<string, unknown>;
  workflowId: string | null;
  taskTemplate: Record<string, unknown>;
  enabled: boolean;
  lastFiredAt: string | null;
  fireCount: number;
  createdAt: string;
}

interface ExecutorStatus {
  isRunning: boolean;
  isPaused: boolean;
  activeTaskCount: number;
  pendingTaskCount: number;
  stats: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
}

const triggerTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  email: { color: "bg-blue-500/10 text-blue-600", icon: <Mail className="w-4 h-4" />, label: "Email" },
  sms: { color: "bg-green-500/10 text-green-600", icon: <MessageSquare className="w-4 h-4" />, label: "SMS" },
  keyword: { color: "bg-purple-500/10 text-purple-600", icon: <Search className="w-4 h-4" />, label: "Keyword" },
  webhook: { color: "bg-orange-500/10 text-orange-600", icon: <Webhook className="w-4 h-4" />, label: "Webhook" },
};

const commonCronExpressions = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
  { label: "First day of month", value: "0 0 1 * *" },
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("schedules");
  
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [isCreateTriggerOpen, setIsCreateTriggerOpen] = useState(false);
  
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    description: "",
    cronExpression: "0 * * * *",
    taskTitle: "",
    taskType: "action",
    taskPriority: 5,
  });
  
  const [newTrigger, setNewTrigger] = useState({
    name: "",
    description: "",
    triggerType: "keyword",
    taskTitle: "",
    taskType: "action",
    taskPriority: 5,
    keywords: "",
    senderEmail: "",
    senderPhone: "",
    webhookSecret: "",
  });

  const loadSchedules = useCallback(async () => {
    try {
      const response = await fetch("/api/orchestration/schedules");
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error("Failed to load schedules:", error);
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      const response = await fetch("/api/orchestration/triggers");
      if (response.ok) {
        const data = await response.json();
        setTriggers(data);
      }
    } catch (error) {
      console.error("Failed to load triggers:", error);
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

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadSchedules(), loadTriggers(), loadExecutorStatus()]);
    setIsLoading(false);
  }, [loadSchedules, loadTriggers, loadExecutorStatus]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadExecutorStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadExecutorStatus]);

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

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/orchestration/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      loadSchedules();
    } catch (error) {
      console.error("Failed to toggle schedule:", error);
    }
  };

  const runScheduleNow = async (id: string) => {
    try {
      await fetch(`/api/orchestration/schedules/${id}/run`, { method: "POST" });
      loadSchedules();
    } catch (error) {
      console.error("Failed to run schedule:", error);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await fetch(`/api/orchestration/schedules/${id}`, { method: "DELETE" });
      loadSchedules();
    } catch (error) {
      console.error("Failed to delete schedule:", error);
    }
  };

  const toggleTrigger = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/orchestration/triggers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      loadTriggers();
    } catch (error) {
      console.error("Failed to toggle trigger:", error);
    }
  };

  const fireTriggerNow = async (id: string) => {
    try {
      await fetch(`/api/orchestration/triggers/${id}/fire`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
      });
      loadTriggers();
    } catch (error) {
      console.error("Failed to fire trigger:", error);
    }
  };

  const deleteTrigger = async (id: string) => {
    try {
      await fetch(`/api/orchestration/triggers/${id}`, { method: "DELETE" });
      loadTriggers();
    } catch (error) {
      console.error("Failed to delete trigger:", error);
    }
  };

  const createSchedule = async () => {
    try {
      const response = await fetch("/api/orchestration/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSchedule.name,
          description: newSchedule.description || null,
          cronExpression: newSchedule.cronExpression,
          taskTemplate: {
            title: newSchedule.taskTitle,
            taskType: newSchedule.taskType,
            priority: newSchedule.taskPriority,
          },
          enabled: true,
        }),
      });
      if (response.ok) {
        setIsCreateScheduleOpen(false);
        setNewSchedule({
          name: "",
          description: "",
          cronExpression: "0 * * * *",
          taskTitle: "",
          taskType: "action",
          taskPriority: 5,
        });
        loadSchedules();
      }
    } catch (error) {
      console.error("Failed to create schedule:", error);
    }
  };

  const createTrigger = async () => {
    try {
      const config: Record<string, unknown> = {};
      if (newTrigger.triggerType === "keyword") {
        config.keywords = newTrigger.keywords.split(",").map(k => k.trim());
      } else if (newTrigger.triggerType === "email") {
        config.senderEmail = newTrigger.senderEmail;
      } else if (newTrigger.triggerType === "sms") {
        config.senderPhone = newTrigger.senderPhone;
      } else if (newTrigger.triggerType === "webhook") {
        config.secret = newTrigger.webhookSecret;
      }

      const response = await fetch("/api/orchestration/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTrigger.name,
          description: newTrigger.description || null,
          triggerType: newTrigger.triggerType,
          config,
          taskTemplate: {
            title: newTrigger.taskTitle,
            taskType: newTrigger.taskType,
            priority: newTrigger.taskPriority,
          },
          enabled: true,
        }),
      });
      if (response.ok) {
        setIsCreateTriggerOpen(false);
        setNewTrigger({
          name: "",
          description: "",
          triggerType: "keyword",
          taskTitle: "",
          taskType: "action",
          taskPriority: 5,
          keywords: "",
          senderEmail: "",
          senderPhone: "",
          webhookSecret: "",
        });
        loadTriggers();
      }
    } catch (error) {
      console.error("Failed to create trigger:", error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const formatTimeUntil = (dateString: string | null) => {
    if (!dateString) return "Not scheduled";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs < 0) return "Overdue";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Schedules & Triggers</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAll}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Executor Control
                </CardTitle>
                <CardDescription>Manage the workflow execution engine</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {executorStatus && (
                  <>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{executorStatus.stats?.pending ?? 0}</span> pending
                      <span className="mx-2">|</span>
                      <span className="font-medium">{executorStatus.stats?.running ?? 0}</span> running
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
          <CardContent>
            {executorStatus && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${executorStatus.isRunning ? (executorStatus.isPaused ? "bg-yellow-500" : "bg-green-500") : "bg-gray-400"}`} />
                  <span className="text-sm font-medium">
                    {executorStatus.isRunning ? (executorStatus.isPaused ? "Paused" : "Running") : "Stopped"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-green-600">{executorStatus.stats?.completed ?? 0}</span> completed
                  <span className="mx-2">|</span>
                  <span className="font-medium text-red-600">{executorStatus.stats?.failed ?? 0}</span> failed
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedules" data-testid="tab-schedules">
              <Clock className="w-4 h-4 mr-2" />
              Schedules ({schedules.length})
            </TabsTrigger>
            <TabsTrigger value="triggers" data-testid="tab-triggers">
              <Zap className="w-4 h-4 mr-2" />
              Triggers ({triggers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Recurring jobs that run on a schedule
              </p>
              <Button onClick={() => setIsCreateScheduleOpen(true)} data-testid="button-create-schedule">
                <Plus className="w-4 h-4 mr-2" />
                New Schedule
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-3">
                {schedules.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Timer className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No schedules configured</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Create a schedule to run tasks automatically
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  schedules.map((schedule) => (
                    <Card key={schedule.id} className={!schedule.enabled ? "opacity-60" : ""} data-testid={`card-schedule-${schedule.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium">{schedule.name}</h3>
                              {schedule.consecutiveFailures > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {schedule.consecutiveFailures} failures
                                </Badge>
                              )}
                            </div>
                            {schedule.description && (
                              <p className="text-sm text-muted-foreground mb-2">{schedule.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{schedule.cronExpression}</code>
                              </div>
                              <div className="flex items-center gap-1">
                                <Timer className="w-3.5 h-3.5" />
                                Next: {formatTimeUntil(schedule.nextRunAt)}
                              </div>
                              <div>
                                Runs: {schedule.runCount}
                              </div>
                            </div>
                            {schedule.lastError && (
                              <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {schedule.lastError}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={schedule.enabled}
                              onCheckedChange={(checked) => toggleSchedule(schedule.id, checked)}
                              data-testid={`switch-schedule-${schedule.id}`}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => runScheduleNow(schedule.id)}>
                                  <Play className="w-4 h-4 mr-2" />
                                  Run Now
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => deleteSchedule(schedule.id)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="triggers" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Event-driven automation based on conditions
              </p>
              <Button onClick={() => setIsCreateTriggerOpen(true)} data-testid="button-create-trigger">
                <Plus className="w-4 h-4 mr-2" />
                New Trigger
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-3">
                {triggers.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Zap className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No triggers configured</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Create a trigger to respond to events automatically
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  triggers.map((trigger) => {
                    const typeConfig = triggerTypeConfig[trigger.triggerType] || triggerTypeConfig.keyword;
                    return (
                      <Card key={trigger.id} className={!trigger.enabled ? "opacity-60" : ""} data-testid={`card-trigger-${trigger.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`p-1.5 rounded ${typeConfig.color}`}>
                                  {typeConfig.icon}
                                </div>
                                <h3 className="font-medium">{trigger.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {typeConfig.label}
                                </Badge>
                              </div>
                              {trigger.description && (
                                <p className="text-sm text-muted-foreground mb-2">{trigger.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <div>
                                  Fired: {trigger.fireCount} times
                                </div>
                                {trigger.lastFiredAt && (
                                  <div>
                                    Last: {formatDate(trigger.lastFiredAt)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={trigger.enabled}
                                onCheckedChange={(checked) => toggleTrigger(trigger.id, checked)}
                                data-testid={`switch-trigger-${trigger.id}`}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => fireTriggerNow(trigger.id)}>
                                    <Zap className="w-4 h-4 mr-2" />
                                    Fire Now
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deleteTrigger(trigger.id)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isCreateScheduleOpen} onOpenChange={setIsCreateScheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring job that runs on a cron schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                placeholder="Daily report generation"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                data-testid="input-schedule-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What this schedule does..."
                value={newSchedule.description}
                onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                data-testid="input-schedule-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Cron Expression</Label>
              <Select
                value={newSchedule.cronExpression}
                onValueChange={(value) => setNewSchedule({ ...newSchedule, cronExpression: value })}
              >
                <SelectTrigger data-testid="select-cron-expression">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commonCronExpressions.map((expr) => (
                    <SelectItem key={expr.value} value={expr.value}>
                      {expr.label} ({expr.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input
                placeholder="Generate daily report"
                value={newSchedule.taskTitle}
                onChange={(e) => setNewSchedule({ ...newSchedule, taskTitle: e.target.value })}
                data-testid="input-schedule-task-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select
                  value={newSchedule.taskType}
                  onValueChange={(value) => setNewSchedule({ ...newSchedule, taskType: value })}
                >
                  <SelectTrigger data-testid="select-schedule-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="synthesis">Synthesis</SelectItem>
                    <SelectItem value="notify">Notify</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority (1-10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={newSchedule.taskPriority}
                  onChange={(e) => setNewSchedule({ ...newSchedule, taskPriority: parseInt(e.target.value) || 5 })}
                  data-testid="input-schedule-priority"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateScheduleOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createSchedule}
              disabled={!newSchedule.name || !newSchedule.taskTitle}
              data-testid="button-submit-schedule"
            >
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTriggerOpen} onOpenChange={setIsCreateTriggerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Trigger</DialogTitle>
            <DialogDescription>
              Set up an event-driven trigger that fires automatically
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trigger Name</Label>
              <Input
                placeholder="Boss email alert"
                value={newTrigger.name}
                onChange={(e) => setNewTrigger({ ...newTrigger, name: e.target.value })}
                data-testid="input-trigger-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What this trigger responds to..."
                value={newTrigger.description}
                onChange={(e) => setNewTrigger({ ...newTrigger, description: e.target.value })}
                data-testid="input-trigger-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select
                value={newTrigger.triggerType}
                onValueChange={(value) => setNewTrigger({ ...newTrigger, triggerType: value })}
              >
                <SelectTrigger data-testid="select-trigger-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Keyword in Chat
                    </div>
                  </SelectItem>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email from Sender
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      SMS from Number
                    </div>
                  </SelectItem>
                  <SelectItem value="webhook">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4" />
                      Webhook
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newTrigger.triggerType === "keyword" && (
              <div className="space-y-2">
                <Label>Keywords (comma-separated)</Label>
                <Input
                  placeholder="sudo, urgent, asap"
                  value={newTrigger.keywords}
                  onChange={(e) => setNewTrigger({ ...newTrigger, keywords: e.target.value })}
                  data-testid="input-trigger-keywords"
                />
              </div>
            )}

            {newTrigger.triggerType === "email" && (
              <div className="space-y-2">
                <Label>Sender Email (or domain)</Label>
                <Input
                  placeholder="boss@company.com or @company.com"
                  value={newTrigger.senderEmail}
                  onChange={(e) => setNewTrigger({ ...newTrigger, senderEmail: e.target.value })}
                  data-testid="input-trigger-sender-email"
                />
              </div>
            )}

            {newTrigger.triggerType === "sms" && (
              <div className="space-y-2">
                <Label>Sender Phone Number</Label>
                <Input
                  placeholder="+1234567890"
                  value={newTrigger.senderPhone}
                  onChange={(e) => setNewTrigger({ ...newTrigger, senderPhone: e.target.value })}
                  data-testid="input-trigger-sender-phone"
                />
              </div>
            )}

            {newTrigger.triggerType === "webhook" && (
              <div className="space-y-2">
                <Label>Webhook Secret (optional)</Label>
                <Input
                  placeholder="secret-key-for-validation"
                  value={newTrigger.webhookSecret}
                  onChange={(e) => setNewTrigger({ ...newTrigger, webhookSecret: e.target.value })}
                  data-testid="input-trigger-webhook-secret"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input
                placeholder="Handle urgent request"
                value={newTrigger.taskTitle}
                onChange={(e) => setNewTrigger({ ...newTrigger, taskTitle: e.target.value })}
                data-testid="input-trigger-task-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select
                  value={newTrigger.taskType}
                  onValueChange={(value) => setNewTrigger({ ...newTrigger, taskType: value })}
                >
                  <SelectTrigger data-testid="select-trigger-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="synthesis">Synthesis</SelectItem>
                    <SelectItem value="notify">Notify</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority (1-10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={newTrigger.taskPriority}
                  onChange={(e) => setNewTrigger({ ...newTrigger, taskPriority: parseInt(e.target.value) || 5 })}
                  data-testid="input-trigger-priority"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTriggerOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createTrigger}
              disabled={!newTrigger.name || !newTrigger.taskTitle}
              data-testid="button-submit-trigger"
            >
              Create Trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
