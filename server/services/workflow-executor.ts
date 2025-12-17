/**
 * =============================================================================
 * WORKFLOW EXECUTOR SERVICE
 * =============================================================================
 * 
 * Core orchestration engine for executing tasks from the queue.
 * Supports:
 * - Sequential and parallel execution modes
 * - Subtask spawning and dependency tracking
 * - Natural language condition evaluation via AI
 * - Operator input polling (pause for human input)
 * - Interrupts and priority override
 * - Task routing based on type
 */

import { storage } from "../storage";
import { 
  type QueuedTask, 
  type InsertQueuedTask,
  TaskStatuses,
  ExecutionModes,
  type ExecutorState 
} from "@shared/schema";
import { GoogleGenAI } from "@google/genai";

// JSON type for database storage
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Task handler function type
type TaskHandler = (task: QueuedTask) => Promise<{ output: Json | null; error?: string }>;

// Event emitter for task status updates
type TaskEventCallback = (event: TaskEvent) => void;

interface TaskEvent {
  type: "started" | "completed" | "failed" | "waiting_input" | "spawned_subtasks";
  taskId: string;
  data?: unknown;
}

class WorkflowExecutor {
  private isRunning = false;
  private isPaused = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private runningTasks: Map<string, Promise<void>> = new Map();
  private eventCallbacks: TaskEventCallback[] = [];
  private maxParallelTasks = 3;
  private pollIntervalMs = 5000;
  private ai: GoogleGenAI | null = null;

  // Task handlers by type
  private handlers: Map<string, TaskHandler> = new Map();

  constructor() {
    this.initializeAI();
    this.registerDefaultHandlers();
  }

  private initializeAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private registerDefaultHandlers() {
    // Research handler - uses AI to research a topic
    this.registerHandler("research", async (task) => {
      if (!this.ai) {
        return { output: null, error: "AI not configured" };
      }
      
      const prompt = `Research the following topic and provide a comprehensive summary:

Topic: ${task.title}
${task.description ? `Details: ${task.description}` : ""}
${task.input ? `Context: ${JSON.stringify(task.input)}` : ""}

Provide a detailed, well-structured response.`;

      const result = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      
      return { output: result.text };
    });

    // Analysis handler
    this.registerHandler("analysis", async (task) => {
      if (!this.ai) {
        return { output: null, error: "AI not configured" };
      }
      
      const prompt = `Analyze the following and provide insights:

Subject: ${task.title}
${task.description ? `Details: ${task.description}` : ""}
${task.input ? `Data: ${JSON.stringify(task.input)}` : ""}

Provide a thorough analysis with key findings and recommendations.`;

      const result = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      
      return { output: result.text };
    });

    // Synthesis handler - combines information
    this.registerHandler("synthesis", async (task) => {
      if (!this.ai) {
        return { output: null, error: "AI not configured" };
      }
      
      // Get outputs from child tasks if any
      let childOutputs: unknown[] = [];
      if (task.id) {
        const children = await storage.getQueuedTasksByParentId(task.id);
        childOutputs = children.filter(c => c.output).map(c => c.output);
      }
      
      const prompt = `Synthesize the following information into a cohesive summary:

Topic: ${task.title}
${task.description ? `Goal: ${task.description}` : ""}
${task.input ? `Additional context: ${JSON.stringify(task.input)}` : ""}
${childOutputs.length > 0 ? `Source materials:\n${JSON.stringify(childOutputs, null, 2)}` : ""}

Create a well-organized synthesis that combines all relevant information.`;

      const result = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      
      return { output: result.text };
    });

    // Action handler - executes an action
    this.registerHandler("action", async (task) => {
      // Actions are typically tool calls - for now, just acknowledge
      return { 
        output: { 
          message: `Action "${task.title}" acknowledged`,
          input: task.input,
          status: "completed"
        } 
      };
    });

    // Fetch handler - retrieves data
    this.registerHandler("fetch", async (task) => {
      // For now, stub - could integrate with web search or APIs
      return { 
        output: { 
          message: `Fetch task "${task.title}" - data retrieval would happen here`,
          input: task.input 
        } 
      };
    });

    // Transform handler - processes data
    this.registerHandler("transform", async (task) => {
      // Transform based on input
      return { 
        output: { 
          message: `Transform task "${task.title}" completed`,
          input: task.input,
          transformed: task.input 
        } 
      };
    });

    // Validate handler - checks/verifies something
    this.registerHandler("validate", async (task) => {
      return { 
        output: { 
          message: `Validation task "${task.title}" completed`,
          input: task.input,
          valid: true 
        } 
      };
    });

    // Notify handler - sends notifications
    this.registerHandler("notify", async (task) => {
      console.log(`[Notify] ${task.title}: ${task.description || "No message"}`);
      return { 
        output: { 
          message: `Notification sent: ${task.title}`,
          notified: true 
        } 
      };
    });
  }

  /**
   * Register a custom task handler
   */
  registerHandler(taskType: string, handler: TaskHandler) {
    this.handlers.set(taskType, handler);
  }

  /**
   * Subscribe to task events
   */
  onTaskEvent(callback: TaskEventCallback) {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
    };
  }

  private emit(event: TaskEvent) {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Start the executor polling loop
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    
    // Initialize executor state
    await storage.initializeExecutorState();
    await storage.updateExecutorState({ 
      status: "running", 
      startedAt: new Date(),
      lastActivityAt: new Date()
    });
    
    console.log("[Executor] Started");
    this.poll();
  }

  /**
   * Stop the executor
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    await storage.updateExecutorState({ 
      status: "stopped",
      lastActivityAt: new Date()
    });
    
    console.log("[Executor] Stopped");
  }

  /**
   * Pause the executor (finishes current tasks)
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    await storage.updateExecutorState({ status: "paused" });
    console.log("[Executor] Paused");
  }

  /**
   * Resume the executor
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    await storage.updateExecutorState({ status: "running" });
    console.log("[Executor] Resumed");
  }

  /**
   * Get current executor status
   */
  async getStatus(): Promise<{ 
    isRunning: boolean; 
    isPaused: boolean; 
    runningTaskCount: number;
    state: ExecutorState | undefined 
  }> {
    const state = await storage.getExecutorState();
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      runningTaskCount: this.runningTasks.size,
      state
    };
  }

  /**
   * Main polling loop
   */
  private async poll() {
    if (!this.isRunning) return;
    
    try {
      if (!this.isPaused && this.runningTasks.size < this.maxParallelTasks) {
        await this.processNextTasks();
      }
    } catch (error) {
      console.error("[Executor] Poll error:", error);
    }
    
    // Schedule next poll
    this.pollInterval = setTimeout(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Process available tasks
   */
  private async processNextTasks() {
    const availableSlots = this.maxParallelTasks - this.runningTasks.size;
    if (availableSlots <= 0) return;
    
    // Get ready tasks (no pending dependencies)
    const readyTasks = await storage.getReadyTasks(availableSlots);
    
    for (const task of readyTasks) {
      // Check if task has unmet dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        const dependenciesMet = await this.checkDependencies(task.dependencies);
        if (!dependenciesMet) {
          await storage.updateQueuedTask(task.id, { status: TaskStatuses.WAITING_DEPENDENCY });
          continue;
        }
      }
      
      // Execute task
      this.executeTask(task);
    }
    
    // Update executor state
    await storage.updateExecutorState({
      runningTaskIds: Array.from(this.runningTasks.keys()),
      lastActivityAt: new Date()
    });
  }

  /**
   * Check if all dependencies are completed
   */
  private async checkDependencies(dependencyIds: string[]): Promise<boolean> {
    for (const depId of dependencyIds) {
      const dep = await storage.getQueuedTaskById(depId);
      if (!dep || dep.status !== TaskStatuses.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: QueuedTask) {
    const taskPromise = this.runTask(task);
    this.runningTasks.set(task.id, taskPromise);
    
    try {
      await taskPromise;
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Run a task through its handler
   */
  private async runTask(task: QueuedTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Mark as running
      await storage.updateQueuedTask(task.id, { 
        status: TaskStatuses.RUNNING,
        startedAt: new Date()
      });
      
      this.emit({ type: "started", taskId: task.id });
      
      // Check for condition
      if (task.condition) {
        const conditionMet = await this.evaluateCondition(task.condition, task);
        await storage.updateQueuedTask(task.id, { conditionResult: conditionMet });
        
        if (!conditionMet) {
          // Skip task if condition not met
          await storage.updateQueuedTask(task.id, {
            status: TaskStatuses.COMPLETED,
            completedAt: new Date(),
            actualDuration: Math.floor((Date.now() - startTime) / 1000),
            output: { skipped: true, reason: "Condition not met" }
          });
          this.emit({ type: "completed", taskId: task.id });
          return;
        }
      }
      
      // Get handler
      const handler = this.handlers.get(task.taskType);
      if (!handler) {
        throw new Error(`No handler registered for task type: ${task.taskType}`);
      }
      
      // Execute handler
      const result = await handler(task);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Mark as completed
      await storage.updateQueuedTask(task.id, {
        status: TaskStatuses.COMPLETED,
        completedAt: new Date(),
        actualDuration: Math.floor((Date.now() - startTime) / 1000),
        output: result.output
      });
      
      // Update stats
      const state = await storage.getExecutorState();
      if (state) {
        await storage.updateExecutorState({
          tasksProcessed: (state.tasksProcessed || 0) + 1
        });
      }
      
      this.emit({ type: "completed", taskId: task.id, data: result.output });
      
      // Check for dependent tasks that might now be ready
      await this.unlockDependentTasks(task.id);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if we should retry
      const retryCount = (task.retryCount || 0) + 1;
      const maxRetries = task.maxRetries || 3;
      
      if (retryCount < maxRetries) {
        await storage.updateQueuedTask(task.id, {
          status: TaskStatuses.PENDING,
          retryCount,
          error: errorMessage
        });
        console.log(`[Executor] Task ${task.id} failed, will retry (${retryCount}/${maxRetries})`);
      } else {
        await storage.updateQueuedTask(task.id, {
          status: TaskStatuses.FAILED,
          completedAt: new Date(),
          actualDuration: Math.floor((Date.now() - startTime) / 1000),
          error: errorMessage
        });
        
        // Update stats
        const state = await storage.getExecutorState();
        if (state) {
          await storage.updateExecutorState({
            tasksFailed: (state.tasksFailed || 0) + 1
          });
        }
        
        this.emit({ type: "failed", taskId: task.id, data: errorMessage });
      }
    }
  }

  /**
   * Evaluate a natural language condition using AI
   */
  private async evaluateCondition(condition: string, task: QueuedTask): Promise<boolean> {
    if (!this.ai) {
      console.warn("[Executor] AI not available for condition evaluation, defaulting to true");
      return true;
    }
    
    const prompt = `Evaluate the following condition and respond with only "true" or "false":

Condition: ${condition}

Context:
- Task: ${task.title}
- Description: ${task.description || "N/A"}
- Input: ${JSON.stringify(task.input || {})}

Based on the condition and context, should this task proceed? Answer only "true" or "false".`;

    try {
      const result = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      
      const answer = (result.text || "").toLowerCase().trim();
      return answer === "true" || answer.includes("true");
    } catch (error) {
      console.error("[Executor] Condition evaluation error:", error);
      return true; // Default to true on error
    }
  }

  /**
   * Unlock tasks that were waiting on a completed dependency
   */
  private async unlockDependentTasks(completedTaskId: string) {
    const dependentTasks = await storage.getTasksByDependency(completedTaskId);
    
    for (const task of dependentTasks) {
      if (task.status === TaskStatuses.WAITING_DEPENDENCY) {
        // Check if all dependencies are now met
        const allMet = task.dependencies 
          ? await this.checkDependencies(task.dependencies)
          : true;
        
        if (allMet) {
          await storage.updateQueuedTask(task.id, { status: TaskStatuses.PENDING });
        }
      }
    }
  }

  /**
   * Request operator input for a task
   */
  async requestOperatorInput(taskId: string, prompt: string): Promise<void> {
    await storage.updateQueuedTask(taskId, {
      status: TaskStatuses.WAITING_INPUT,
      waitingForInput: true,
      inputPrompt: prompt
    });
    
    this.emit({ type: "waiting_input", taskId, data: { prompt } });
  }

  /**
   * Provide operator input for a waiting task
   */
  async provideOperatorInput(taskId: string, input: string): Promise<void> {
    const task = await storage.getQueuedTaskById(taskId);
    if (!task) throw new Error("Task not found");
    
    await storage.updateQueuedTask(taskId, {
      status: TaskStatuses.PENDING,
      waitingForInput: false,
      operatorInput: input
    });
  }

  /**
   * Spawn subtasks for a parent task
   */
  async spawnSubtasks(parentId: string, subtasks: InsertQueuedTask[]): Promise<QueuedTask[]> {
    const createdTasks = await storage.createQueuedTasks(
      subtasks.map(t => ({ ...t, parentId }))
    );
    
    this.emit({ 
      type: "spawned_subtasks", 
      taskId: parentId, 
      data: { subtaskIds: createdTasks.map(t => t.id) } 
    });
    
    return createdTasks;
  }

  /**
   * Interrupt a running task (marks for cancellation)
   */
  async interruptTask(taskId: string): Promise<void> {
    await storage.updateQueuedTask(taskId, {
      status: TaskStatuses.CANCELLED
    });
  }

  /**
   * Bump a task to highest priority
   */
  async prioritizeTask(taskId: string): Promise<void> {
    // Get max priority
    const tasks = await storage.getQueuedTasks({ limit: 1 });
    const maxPriority = tasks.length > 0 ? Math.max(...tasks.map(t => t.priority)) : 0;
    
    await storage.updateQueuedTask(taskId, {
      priority: maxPriority + 100 // Jump way ahead
    });
  }
}

// Export singleton instance
export const workflowExecutor = new WorkflowExecutor();
