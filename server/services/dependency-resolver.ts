/**
 * =============================================================================
 * DEPENDENCY RESOLVER SERVICE
 * =============================================================================
 * 
 * DAG-based dependency resolution for job orchestration.
 * Features:
 * - Topological sorting of jobs
 * - Cycle detection
 * - Dependency chain analysis
 * - Ready-to-run job identification
 */

import { getDb } from "../db";
import { agentJobs, jobResults, type AgentJob } from "@shared/schema";
import { eq, inArray, and } from "drizzle-orm";

export interface DependencyGraph {
  nodes: Map<string, AgentJob>;
  edges: Map<string, Set<string>>; // jobId -> set of jobs that depend on it
  reverseEdges: Map<string, Set<string>>; // jobId -> set of jobs it depends on
}

export interface ResolutionResult {
  readyJobs: AgentJob[];
  blockedJobs: AgentJob[];
  failedDeps: { jobId: string; failedDependencies: string[] }[];
  cycles: string[][];
}

class DependencyResolverService {
  async buildGraph(jobIds?: string[]): Promise<DependencyGraph> {
    let jobs: AgentJob[];
    
    if (jobIds && jobIds.length > 0) {
      jobs = await getDb().select()
        .from(agentJobs)
        .where(inArray(agentJobs.id, jobIds));
    } else {
      jobs = await getDb().select()
        .from(agentJobs)
        .where(inArray(agentJobs.status, ["pending", "queued", "running"]));
    }

    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
    };

    for (const job of jobs) {
      graph.nodes.set(job.id, job);
      graph.edges.set(job.id, new Set());
      graph.reverseEdges.set(job.id, new Set());
    }

    for (const job of jobs) {
      const deps = job.dependencies ?? [];
      for (const depId of deps) {
        graph.reverseEdges.get(job.id)?.add(depId);
        
        if (graph.edges.has(depId)) {
          graph.edges.get(depId)?.add(job.id);
        }
      }
    }

    return graph;
  }

  async resolve(pendingJobs?: AgentJob[]): Promise<ResolutionResult> {
    // Include both pending and queued jobs to handle the full workflow
    const jobs = pendingJobs ?? await getDb().select()
      .from(agentJobs)
      .where(inArray(agentJobs.status, ["pending", "queued"]));

    const readyJobs: AgentJob[] = [];
    const blockedJobs: AgentJob[] = [];
    const failedDeps: { jobId: string; failedDependencies: string[] }[] = [];

    for (const job of jobs) {
      const deps = job.dependencies ?? [];
      
      if (deps.length === 0) {
        readyJobs.push(job);
        continue;
      }

      const depStatuses = await getDb().select()
        .from(agentJobs)
        .where(inArray(agentJobs.id, deps));

      const statusMap = new Map(depStatuses.map(d => [d.id, d.status]));

      const failedDepIds = deps.filter(id => statusMap.get(id) === "failed");
      if (failedDepIds.length > 0) {
        failedDeps.push({ jobId: job.id, failedDependencies: failedDepIds });
        continue;
      }

      const allComplete = deps.every(id => statusMap.get(id) === "completed");
      if (allComplete) {
        readyJobs.push(job);
      } else {
        blockedJobs.push(job);
      }
    }

    const cycles = await this.detectCycles(jobs);

    return { readyJobs, blockedJobs, failedDeps, cycles };
  }

  private async detectCycles(jobs: AgentJob[]): Promise<string[][]> {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    const dfs = (jobId: string, path: string[]): boolean => {
      visited.add(jobId);
      recStack.add(jobId);

      const job = jobMap.get(jobId);
      if (!job) return false;

      for (const depId of job.dependencies ?? []) {
        if (!visited.has(depId)) {
          if (dfs(depId, [...path, depId])) {
            return true;
          }
        } else if (recStack.has(depId)) {
          const cycleStart = path.indexOf(depId);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          } else {
            cycles.push([...path, depId]);
          }
          return true;
        }
      }

      recStack.delete(jobId);
      return false;
    };

    for (const job of jobs) {
      if (!visited.has(job.id)) {
        dfs(job.id, [job.id]);
      }
    }

    return cycles;
  }

  async topologicalSort(jobs: AgentJob[]): Promise<AgentJob[]> {
    const sorted: AgentJob[] = [];
    const visited = new Set<string>();
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    const visit = (jobId: string) => {
      if (visited.has(jobId)) return;
      visited.add(jobId);

      const job = jobMap.get(jobId);
      if (!job) return;

      for (const depId of job.dependencies ?? []) {
        visit(depId);
      }

      sorted.push(job);
    };

    for (const job of jobs) {
      visit(job.id);
    }

    return sorted;
  }

  async getDependencyChain(jobId: string): Promise<AgentJob[]> {
    const chain: AgentJob[] = [];
    const visited = new Set<string>();

    const traverse = async (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const [job] = await getDb().select()
        .from(agentJobs)
        .where(eq(agentJobs.id, id));

      if (!job) return;

      for (const depId of job.dependencies ?? []) {
        await traverse(depId);
      }

      chain.push(job);
    };

    await traverse(jobId);
    return chain;
  }

  async getDependents(jobId: string): Promise<AgentJob[]> {
    const allJobs = await getDb().select()
      .from(agentJobs)
      .where(inArray(agentJobs.status, ["pending", "queued"]));

    return allJobs.filter(j => (j.dependencies ?? []).includes(jobId));
  }

  async aggregateResults(parentJobId: string): Promise<{
    results: Record<string, unknown>;
    allSuccess: boolean;
    errors: string[];
  }> {
    const childJobs = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.parentJobId, parentJobId));

    const childResults = await getDb().select()
      .from(jobResults)
      .where(inArray(jobResults.jobId, childJobs.map(j => j.id)));

    const resultsMap = new Map(childResults.map(r => [r.jobId, r]));

    const results: Record<string, unknown> = {};
    const errors: string[] = [];
    let allSuccess = true;

    for (const job of childJobs) {
      const result = resultsMap.get(job.id);
      if (result) {
        results[job.id] = result.output;
        if (!result.success) {
          allSuccess = false;
          if (result.error) {
            errors.push(`${job.name}: ${result.error}`);
          }
        }
      }
    }

    return { results, allSuccess, errors };
  }
}

export const dependencyResolver = new DependencyResolverService();
export default dependencyResolver;
