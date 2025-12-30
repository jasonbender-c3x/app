/**
 * =============================================================================
 * TRIGGER SERVICE
 * =============================================================================
 * 
 * Monitors various event sources and triggers workflows/tasks when patterns match.
 * 
 * Supported trigger types:
 * - email: Monitor Gmail for matching emails
 * - sms: Monitor incoming SMS (Twilio)
 * - prompt_keyword: Watch for keywords in user prompts
 * - webhook: External HTTP triggers
 * - manual: User-initiated triggers
 */

import { storage } from "../storage";
import { type Trigger, TriggerTypes } from "@shared/schema";
import { workflowExecutor } from "./workflow-executor";

class TriggerService {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private pollIntervalMs = 30000; // Check every 30 seconds
  private lastEmailCheck = new Date();
  
  /**
   * Start monitoring triggers
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[TriggerService] Started");
    this.poll();
  }
  
  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    console.log("[TriggerService] Stopped");
  }
  
  /**
   * Main polling loop for event sources
   */
  private async poll() {
    if (!this.isRunning) return;
    
    try {
      await this.checkEmailTriggers();
      // SMS triggers would be handled via webhook from Twilio
    } catch (error) {
      console.error("[TriggerService] Poll error:", error);
    }
    
    this.pollInterval = setTimeout(() => this.poll(), this.pollIntervalMs);
  }
  
  /**
   * Check Gmail for emails matching trigger patterns
   */
  private async checkEmailTriggers() {
    const emailTriggers = await storage.getTriggersByType(TriggerTypes.EMAIL);
    if (emailTriggers.length === 0) return;
    
    try {
      // Dynamic import of Gmail integration
      const gmail = await import("../integrations/gmail");
      
      // Get recent emails since last check
      const emails = await gmail.listEmails(20);
      
      for (const email of emails) {
        for (const trigger of emailTriggers) {
          if (this.matchesEmailTrigger({ 
            from: email.from, 
            subject: email.subject, 
            snippet: email.snippet ?? undefined 
          }, trigger)) {
            await this.fireTrigger(trigger, {
              source: "email",
              emailId: email.id,
              from: email.from,
              subject: email.subject,
              snippet: email.snippet
            });
          }
        }
      }
      
      this.lastEmailCheck = new Date();
    } catch (error) {
      // Gmail might not be connected
      console.debug("[TriggerService] Email check skipped:", error instanceof Error ? error.message : "Not connected");
    }
  }
  
  /**
   * Check if an email matches a trigger's patterns
   */
  private matchesEmailTrigger(email: { from?: string; subject?: string; snippet?: string }, trigger: Trigger): boolean {
    // Check sender filter
    if (trigger.senderFilter && email.from) {
      const senderRegex = new RegExp(trigger.senderFilter, "i");
      if (!senderRegex.test(email.from)) return false;
    }
    
    // Check subject filter
    if (trigger.subjectFilter && email.subject) {
      const subjectRegex = new RegExp(trigger.subjectFilter, "i");
      if (!subjectRegex.test(email.subject)) return false;
    }
    
    // Check content pattern
    if (trigger.pattern) {
      const contentRegex = new RegExp(trigger.pattern, "i");
      const content = `${email.subject || ""} ${email.snippet || ""}`;
      if (!contentRegex.test(content)) return false;
    }
    
    return true;
  }
  
  /**
   * Check if a user prompt matches any keyword triggers
   */
  async checkPromptTriggers(prompt: string): Promise<Trigger[]> {
    const keywordTriggers = await storage.getTriggersByType(TriggerTypes.PROMPT_KEYWORD);
    const matchedTriggers: Trigger[] = [];
    
    for (const trigger of keywordTriggers) {
      if (trigger.pattern) {
        const pattern = new RegExp(trigger.pattern, "i");
        if (pattern.test(prompt)) {
          matchedTriggers.push(trigger);
          await this.fireTrigger(trigger, {
            source: "prompt",
            prompt,
            matchedPattern: trigger.pattern
          });
        }
      }
    }
    
    return matchedTriggers;
  }
  
  /**
   * Handle webhook trigger
   */
  async handleWebhook(triggerId: string, payload: unknown, secret?: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const trigger = await storage.getTriggerById(triggerId);
    
    if (!trigger) {
      return { success: false, error: "Trigger not found" };
    }
    
    if (!trigger.enabled) {
      return { success: false, error: "Trigger is disabled" };
    }
    
    // Validate secret if configured
    if (trigger.webhookSecret && trigger.webhookSecret !== secret) {
      return { success: false, error: "Invalid webhook secret" };
    }
    
    const result = await this.fireTrigger(trigger, {
      source: "webhook",
      payload
    });
    
    return { success: true, taskId: result?.id };
  }
  
  /**
   * Fire a trigger - create task(s) from the trigger's template
   */
  async fireTrigger(trigger: Trigger, context: Record<string, unknown>): Promise<{ id: string } | null> {
    console.log(`[TriggerService] Firing trigger: ${trigger.name}`);
    
    // Update trigger stats
    await storage.updateTrigger(trigger.id, {
      lastTriggeredAt: new Date(),
      triggerCount: (trigger.triggerCount || 0) + 1
    });
    
    // If trigger has a workflow, instantiate it
    if (trigger.workflowId) {
      const workflow = await storage.getWorkflowById(trigger.workflowId);
      if (workflow) {
        // Create tasks from workflow steps using the new job system
        const steps = workflow.steps as Array<{
          title: string;
          description?: string;
          taskType: string;
          priority?: number;
        }>;
        
        const job = await workflowExecutor.submitWorkflow(
          workflow.name,
          steps.map((step, idx) => ({
            title: step.title,
            description: step.description,
            taskType: step.taskType || "action",
            priority: step.priority ?? (steps.length - idx),
            input: context
          })),
          "sequential"
        );
        
        return { id: job.id };
      }
    }
    
    // If trigger has a task template, create task from it using the new job system
    if (trigger.taskTemplate) {
      const template = trigger.taskTemplate as {
        title: string;
        description?: string;
        taskType: string;
        priority?: number;
      };
      
      const job = await workflowExecutor.submitTask({
        title: template.title.replace(/\{\{(\w+)\}\}/g, (_, key) => String(context[key] || "")),
        description: template.description,
        taskType: template.taskType || "action",
        priority: trigger.priority || template.priority || 5,
        input: context
      });
      
      return { id: job.id };
    }
    
    return null;
  }
  
  /**
   * Manually fire a trigger
   */
  async manualTrigger(triggerId: string, input?: Record<string, unknown>): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const trigger = await storage.getTriggerById(triggerId);
    
    if (!trigger) {
      return { success: false, error: "Trigger not found" };
    }
    
    const result = await this.fireTrigger(trigger, {
      source: "manual",
      ...input
    });
    
    return { success: true, taskId: result?.id };
  }
}

// Export singleton
export const triggerService = new TriggerService();
