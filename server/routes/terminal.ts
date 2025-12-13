import { Router } from "express";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

const router = Router();

const executeCommandSchema = z.object({
  command: z.string().min(1, "Command is required").max(10000, "Command too long")
});

const OUTPUT_FILE = path.join(process.cwd(), ".local", "terminal-output.txt");

function ensureOutputDir() {
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendToOutputFile(content: string) {
  ensureOutputDir();
  const timestamp = new Date().toISOString();
  const entry = `\n[${timestamp}]\n${content}\n`;
  fs.appendFileSync(OUTPUT_FILE, entry);
}

router.post("/execute", async (req, res) => {
  try {
    const parseResult = executeCommandSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }

    const trimmedCommand = parseResult.data.command.trim();
    if (!trimmedCommand) {
      return res.status(400).json({ error: "Command cannot be empty" });
    }

    console.log(`[Terminal] Executing: ${trimmedCommand}`);
    appendToOutputFile(`$ ${trimmedCommand}`);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      const proc = spawn("bash", ["-c", trimmedCommand], {
        cwd: process.cwd(),
        env: { ...process.env },
        timeout: 120000
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      proc.on("error", (err) => {
        resolve({ stdout: "", stderr: err.message, exitCode: 1 });
      });
    });

    if (result.stdout) {
      appendToOutputFile(result.stdout);
    }
    if (result.stderr) {
      appendToOutputFile(`[STDERR] ${result.stderr}`);
    }

    console.log(`[Terminal] Exit code: ${result.exitCode}`);

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    });
  } catch (error) {
    console.error("[Terminal] Error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    appendToOutputFile(`[ERROR] ${errorMsg}`);
    res.status(500).json({ error: errorMsg });
  }
});

router.get("/output", (_req, res) => {
  try {
    ensureOutputDir();
    
    if (!fs.existsSync(OUTPUT_FILE)) {
      return res.json({ content: "", path: OUTPUT_FILE });
    }

    const content = fs.readFileSync(OUTPUT_FILE, "utf-8");
    res.json({ content, path: OUTPUT_FILE });
  } catch (error) {
    console.error("[Terminal] Error reading output:", error);
    res.status(500).json({ error: "Failed to read output file" });
  }
});

router.delete("/output", (_req, res) => {
  try {
    ensureOutputDir();
    
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Terminal] Error clearing output:", error);
    res.status(500).json({ error: "Failed to clear output file" });
  }
});

export default router;
