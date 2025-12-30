/**
 * =============================================================================
 * CRON SCHEDULER SERVICE
 * =============================================================================
 * 
 * Manages scheduled task execution based on cron expressions.
 * 
 * Features:
 * - Parse and evaluate cron expressions
 * - Calculate next run times
 * - Create tasks from schedule templates
 * - Handle timezone conversions
 * - Track consecutive failures
 */

import { storage } from "../storage";
import { type Schedule } from "@shared/schema";
import { workflowExecutor } from "./workflow-executor";

// Cron field positions
const MINUTE = 0;
const HOUR = 1;
const DAY_OF_MONTH = 2;
const MONTH = 3;
const DAY_OF_WEEK = 4;

class CronScheduler {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private pollIntervalMs = 60000; // Check every minute
  
  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[CronScheduler] Started");
    
    // Initialize next run times for all enabled schedules
    await this.initializeSchedules();
    
    this.poll();
  }
  
  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    console.log("[CronScheduler] Stopped");
  }
  
  /**
   * Initialize next run times for schedules that don't have them
   */
  private async initializeSchedules() {
    const schedules = await storage.getSchedules({ enabled: true });
    
    for (const schedule of schedules) {
      if (!schedule.nextRunAt) {
        const nextRun = this.getNextRunTime(schedule.cronExpression);
        await storage.updateSchedule(schedule.id, { nextRunAt: nextRun });
      }
    }
  }
  
  /**
   * Main polling loop
   */
  private async poll() {
    if (!this.isRunning) return;
    
    try {
      await this.processDueSchedules();
    } catch (error) {
      console.error("[CronScheduler] Poll error:", error);
    }
    
    this.pollInterval = setTimeout(() => this.poll(), this.pollIntervalMs);
  }
  
  /**
   * Process schedules that are due to run
   */
  private async processDueSchedules() {
    const dueSchedules = await storage.getDueSchedules();
    
    for (const schedule of dueSchedules) {
      try {
        await this.runSchedule(schedule);
        
        // Calculate next run time
        const nextRun = this.getNextRunTime(schedule.cronExpression);
        
        await storage.updateSchedule(schedule.id, {
          lastRunAt: new Date(),
          nextRunAt: nextRun,
          runCount: (schedule.runCount || 0) + 1,
          consecutiveFailures: 0,
          lastError: undefined
        });
        
        console.log(`[CronScheduler] Ran schedule: ${schedule.name}, next run: ${nextRun}`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const failures = (schedule.consecutiveFailures || 0) + 1;
        
        // Disable schedule if too many consecutive failures
        const shouldDisable = failures >= (schedule.maxConsecutiveFailures || 3);
        
        await storage.updateSchedule(schedule.id, {
          lastError: errorMessage,
          consecutiveFailures: failures,
          enabled: !shouldDisable,
          nextRunAt: shouldDisable ? undefined : this.getNextRunTime(schedule.cronExpression)
        });
        
        console.error(`[CronScheduler] Schedule ${schedule.name} failed (${failures}x):`, errorMessage);
        
        if (shouldDisable) {
          console.warn(`[CronScheduler] Disabled schedule ${schedule.name} after ${failures} consecutive failures`);
        }
      }
    }
  }
  
  /**
   * Run a schedule - create task(s) from its template
   */
  private async runSchedule(schedule: Schedule) {
    // If schedule has a workflow, instantiate it
    if (schedule.workflowId) {
      const workflow = await storage.getWorkflowById(schedule.workflowId);
      if (workflow) {
        const steps = workflow.steps as Array<{
          title: string;
          description?: string;
          taskType: string;
          priority?: number;
        }>;
        
        // Use the new job system via workflowExecutor
        await workflowExecutor.submitWorkflow(
          workflow.name,
          steps.map((step, idx) => ({
            title: step.title,
            description: step.description,
            taskType: step.taskType || "action",
            priority: step.priority ?? (steps.length - idx),
            input: { scheduledBy: schedule.id, scheduleName: schedule.name }
          })),
          "sequential"
        );
        
        return;
      }
    }
    
    // Create task from template using the new job system
    const template = schedule.taskTemplate as {
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
      input?: Record<string, unknown>;
    };
    
    await workflowExecutor.submitTask({
      title: template.title,
      description: template.description,
      taskType: template.taskType || "action",
      priority: template.priority || 5,
      input: {
        ...template.input,
        scheduledBy: schedule.id,
        scheduleName: schedule.name,
        scheduledAt: new Date().toISOString()
      }
    });
  }
  
  /**
   * Parse a cron expression and get the next run time
   * Format: minute hour day-of-month month day-of-week
   * Example: "0 9 * * 1" = Every Monday at 9:00 AM
   */
  getNextRunTime(cronExpression: string): Date {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    // Add 1 minute to ensure we're looking at future times
    next.setMinutes(next.getMinutes() + 1);
    
    // Try to find next matching time (limit iterations to prevent infinite loops)
    for (let attempts = 0; attempts < 366 * 24 * 60; attempts++) {
      if (this.matchesCron(next, parts)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }
    
    throw new Error(`Could not calculate next run time for: ${cronExpression}`);
  }
  
  /**
   * Check if a date matches a cron expression
   */
  private matchesCron(date: Date, parts: string[]): boolean {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const dayOfWeek = date.getDay(); // 0 = Sunday
    
    return (
      this.matchesField(parts[MINUTE], minute, 0, 59) &&
      this.matchesField(parts[HOUR], hour, 0, 23) &&
      this.matchesField(parts[DAY_OF_MONTH], dayOfMonth, 1, 31) &&
      this.matchesField(parts[MONTH], month, 1, 12) &&
      this.matchesField(parts[DAY_OF_WEEK], dayOfWeek, 0, 6)
    );
  }
  
  /**
   * Check if a value matches a cron field
   * Supports: asterisk, specific values, ranges, steps, lists
   */
  private matchesField(field: string, value: number, min: number, max: number): boolean {
    if (field === "*") return true;
    
    // Handle step values (*/5)
    if (field.startsWith("*/")) {
      const step = parseInt(field.slice(2));
      return value % step === 0;
    }
    
    // Handle ranges (1-5)
    if (field.includes("-")) {
      const [start, end] = field.split("-").map(Number);
      return value >= start && value <= end;
    }
    
    // Handle lists (1,3,5)
    if (field.includes(",")) {
      const values = field.split(",").map(Number);
      return values.includes(value);
    }
    
    // Specific value
    return parseInt(field) === value;
  }
  
  /**
   * Validate a cron expression
   */
  isValidCronExpression(expression: string): { valid: boolean; error?: string } {
    const parts = expression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      return { valid: false, error: "Cron expression must have 5 fields: minute hour day-of-month month day-of-week" };
    }
    
    const fieldNames = ["minute", "hour", "day-of-month", "month", "day-of-week"];
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
    
    for (let i = 0; i < 5; i++) {
      const field = parts[i];
      const [min, max] = ranges[i];
      
      if (field === "*") continue;
      
      if (field.startsWith("*/")) {
        const step = parseInt(field.slice(2));
        if (isNaN(step) || step <= 0) {
          return { valid: false, error: `Invalid step value in ${fieldNames[i]}: ${field}` };
        }
        continue;
      }
      
      // Extract all numbers from the field
      const numbers = field.split(/[-,]/).map(Number);
      for (const num of numbers) {
        if (isNaN(num) || num < min || num > max) {
          return { valid: false, error: `Invalid value in ${fieldNames[i]}: ${num} (must be ${min}-${max})` };
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Get human-readable description of a cron expression
   */
  describeCronExpression(expression: string): string {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return "Invalid expression";
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Common patterns
    if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return "Every hour at minute 0";
    }
    
    if (minute === "0" && hour === "0" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
      return "Every day at midnight";
    }
    
    if (minute === "0" && hour === "9" && dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
      return "Weekdays at 9:00 AM";
    }
    
    if (minute === "0" && hour === "9" && dayOfMonth === "*" && month === "*" && dayOfWeek === "1") {
      return "Every Monday at 9:00 AM";
    }
    
    // Generic description
    let desc = "";
    
    if (minute === "*" && hour === "*") {
      desc = "Every minute";
    } else if (minute === "*") {
      desc = `Every minute of hour ${hour}`;
    } else if (hour === "*") {
      desc = `Every hour at minute ${minute}`;
    } else {
      desc = `At ${hour}:${minute.padStart(2, "0")}`;
    }
    
    if (dayOfWeek !== "*") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      if (dayOfWeek.includes("-")) {
        const [start, end] = dayOfWeek.split("-").map(Number);
        desc += ` ${days[start]} to ${days[end]}`;
      } else if (dayOfWeek.includes(",")) {
        const dayNums = dayOfWeek.split(",").map(Number);
        desc += ` on ${dayNums.map(d => days[d]).join(", ")}`;
      } else {
        desc += ` on ${days[parseInt(dayOfWeek)]}`;
      }
    }
    
    if (dayOfMonth !== "*") {
      desc += ` on day ${dayOfMonth}`;
    }
    
    if (month !== "*") {
      const months = ["", "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
      if (month.includes(",")) {
        const monthNums = month.split(",").map(Number);
        desc += ` in ${monthNums.map(m => months[m]).join(", ")}`;
      } else {
        desc += ` in ${months[parseInt(month)]}`;
      }
    }
    
    return desc;
  }
}

// Export singleton
export const cronScheduler = new CronScheduler();
