/**
 * =============================================================================
 * WORKER POOL SERVICE
 * =============================================================================
 * 
 * Manages a pool of AgentWorkers for parallel job processing.
 * Features:
 * - Spawns and manages multiple workers
 * - Health checks with auto-restart
 * - Load balancing across workers
 * - Graceful shutdown
 */

import { getDb } from "../db";
import { agentWorkers, type AgentWorker } from "@shared/schema";
import { eq, lt, sql } from "drizzle-orm";
import AgentWorkerService, { createAgentWorker, type WorkerConfig } from "./agent-worker";

export interface PoolConfig {
  minWorkers: number;
  maxWorkers: number;
  healthCheckIntervalMs: number;
  unhealthyThresholdMs: number;
  maxConsecutiveFailures: number;
}

const DEFAULT_POOL_CONFIG: PoolConfig = {
  minWorkers: 2,
  maxWorkers: 5,
  healthCheckIntervalMs: 60000,
  unhealthyThresholdMs: 120000,
  maxConsecutiveFailures: 5,
};

class WorkerPoolService {
  private workers: Map<string, AgentWorkerService> = new Map();
  private config: PoolConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.isRunning) return;

    console.log(`[WorkerPool] Initializing with ${this.config.minWorkers} workers...`);

    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.spawnWorker(`worker-${i + 1}`);
    }

    this.startHealthChecks();
    this.isRunning = true;

    console.log(`[WorkerPool] Initialized with ${this.workers.size} workers`);
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const shutdownPromises = Array.from(this.workers.values()).map(w => w.shutdown());
    await Promise.all(shutdownPromises);
    
    this.workers.clear();
    console.log("[WorkerPool] Shutdown complete");
  }

  private async spawnWorker(name: string, config?: Partial<WorkerConfig>): Promise<string | null> {
    if (this.workers.size >= this.config.maxWorkers) {
      console.warn("[WorkerPool] Max workers reached, cannot spawn more");
      return null;
    }

    try {
      const worker = createAgentWorker({
        name,
        model: "gemini-2.5-flash",
        ...config,
      });

      const workerId = await worker.initialize();
      this.workers.set(workerId, worker);

      console.log(`[WorkerPool] Spawned worker ${workerId} (${name})`);
      return workerId;

    } catch (error) {
      console.error(`[WorkerPool] Failed to spawn worker ${name}:`, error);
      return null;
    }
  }

  private async removeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.shutdown();
      this.workers.delete(workerId);
      console.log(`[WorkerPool] Removed worker ${workerId}`);
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    const unhealthyThreshold = new Date(Date.now() - this.config.unhealthyThresholdMs);

    const unhealthyWorkers = await getDb().select()
      .from(agentWorkers)
      .where(lt(agentWorkers.lastHeartbeat, unhealthyThreshold));

    for (const unhealthy of unhealthyWorkers) {
      console.warn(`[WorkerPool] Worker ${unhealthy.id} is unhealthy (last heartbeat: ${unhealthy.lastHeartbeat})`);
      
      if (this.workers.has(unhealthy.id)) {
        await this.removeWorker(unhealthy.id);
      }

      await getDb().update(agentWorkers)
        .set({ status: "offline" })
        .where(eq(agentWorkers.id, unhealthy.id));
    }

    const failedWorkers = await getDb().select()
      .from(agentWorkers)
      .where(sql`${agentWorkers.consecutiveFailures} >= ${this.config.maxConsecutiveFailures}`);

    for (const failed of failedWorkers) {
      console.warn(`[WorkerPool] Worker ${failed.id} has ${failed.consecutiveFailures} consecutive failures, restarting...`);
      
      if (this.workers.has(failed.id)) {
        await this.removeWorker(failed.id);
      }

      await getDb().update(agentWorkers)
        .set({ status: "offline", consecutiveFailures: 0 })
        .where(eq(agentWorkers.id, failed.id));
    }

    const activeCount = this.workers.size;
    if (activeCount < this.config.minWorkers) {
      const toSpawn = this.config.minWorkers - activeCount;
      console.log(`[WorkerPool] Spawning ${toSpawn} replacement workers...`);
      
      for (let i = 0; i < toSpawn; i++) {
        await this.spawnWorker(`worker-replacement-${Date.now()}-${i}`);
      }
    }
  }

  async getIdleWorker(): Promise<AgentWorkerService | null> {
    for (const worker of Array.from(this.workers.values())) {
      const status = await worker.getWorkerStatus();
      if (status?.status === "idle") {
        return worker;
      }
    }
    return null;
  }

  async scaleUp(): Promise<string | null> {
    if (this.workers.size >= this.config.maxWorkers) {
      return null;
    }
    return this.spawnWorker(`worker-scaled-${Date.now()}`);
  }

  async scaleDown(): Promise<boolean> {
    if (this.workers.size <= this.config.minWorkers) {
      return false;
    }

    for (const [workerId, worker] of Array.from(this.workers.entries())) {
      const status = await worker.getWorkerStatus();
      if (status?.status === "idle") {
        await this.removeWorker(workerId);
        return true;
      }
    }

    return false;
  }

  async getPoolStats(): Promise<{
    activeWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    totalJobsProcessed: number;
    totalTokensUsed: number;
  }> {
    const workers = await getDb().select()
      .from(agentWorkers)
      .where(sql`${agentWorkers.status} != 'offline'`);

    return {
      activeWorkers: workers.length,
      idleWorkers: workers.filter(w => w.status === "idle").length,
      busyWorkers: workers.filter(w => w.status === "busy").length,
      totalJobsProcessed: workers.reduce((sum, w) => sum + (w.totalJobsProcessed ?? 0), 0),
      totalTokensUsed: workers.reduce((sum, w) => sum + (w.totalTokensUsed ?? 0), 0),
    };
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const workerPool = new WorkerPoolService();
export default workerPool;
