import { get } from 'lodash';

// Define the structure of a single instruction in our plan.
export interface Instruction {
  type: string;
  id: string;
  operation: string;
  parameters: Record<string, any>;
}

// A Tool is an async function that performs an action.
export type ToolFunction = (params: Record<string, any>) => Promise<any>;

// The 'Registers' or working memory for a single execution plan.
// It holds the results of completed instructions.
class ExecutionContext {
  private results: Map<string, any> = new Map();

  setResult(instructionId: string, result: any) {
    this.results.set(instructionId, result);
    console.log(`[Context] Stored result for '${instructionId}':`, result);
  }

  // Resolves a dependency path like "$find_email.output.messages[0].id"
  resolvePath(path: string): any {
    if (typeof path !== 'string' || !path.startsWith('$')) {
      return path; // Not a dependency path, return as is.
    }

    const cleanPath = path.substring(1); // Remove '$'
    const [instructionId, ...rest] = cleanPath.split('.');
    const resultObject = this.results.get(instructionId);

    if (!resultObject) {
      throw new Error(`Dependency Error: No result found for instruction ID '${instructionId}'`);
    }

    // Use lodash.get for safe deep property access (e.g., 'output.messages[0].id')
    const resolvedValue = get(resultObject, rest.join('.'));
    console.log(`[Context] Resolved path '${path}' to value:`, resolvedValue);
    return resolvedValue;
  }
}

/**
 * The Natural Language CPU (NL-CPU).
 * It takes an execution plan (an array of instructions) and executes it sequentially,
 * handling data dependencies between steps.
 */
export class NLCpu {
  private toolRegistry: Map<string, ToolFunction> = new Map();

  constructor() {}

  // Register a tool (e.g., 'gmail_search') with its actual function.
  registerTool(name: string, func: ToolFunction) {
    this.toolRegistry.set(name, func);
  }

  // The main execution loop.
  async executePlan(plan: Instruction[]): Promise<any> {
    console.log('--- [NL-CPU] Starting Execution Plan ---');
    const context = new ExecutionContext();

    for (const instruction of plan) {
      console.log(`\n[Fetch]   Instruction: ${instruction.id} (${instruction.type})`);

      // --- DECODE STAGE ---
      const resolvedParams: Record<string, any> = {};
      for (const key in instruction.parameters) {
        resolvedParams[key] = context.resolvePath(instruction.parameters[key]);
      }
      console.log(`[Decode]  Resolved Parameters:`, resolvedParams);

      // --- EXECUTE STAGE ---
      const tool = this.toolRegistry.get(instruction.type);
      if (!tool) {
        throw new Error(`Execution Error: Tool '${instruction.type}' not registered.`);
      }

      try {
        const result = await tool(resolvedParams);
        console.log(`[Execute] Succeeded.`);
        // --- WRITE-BACK STAGE (to our context) ---
        context.setResult(instruction.id, result);
      } catch (error) {
        console.error(`[Execute] FAILED for instruction '${instruction.id}'.`, error);
        throw error; // Halt execution on failure
      }
    }

    console.log('\n--- [NL-CPU] Execution Plan Finished ---');
    // Optionally return the final result or the full context
    return context.resolvePath(`$${plan[plan.length-1].id}.output`);
  }
}
