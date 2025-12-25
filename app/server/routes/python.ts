import { Router } from "express";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

const router = Router();

const executePythonSchema = z.object({
  code: z.string().min(1, "Code is required").max(50000, "Code too long")
});

const TEMP_DIR = path.join(process.cwd(), ".local", "python");
const OUTPUT_FILE = path.join(process.cwd(), ".local", "python-output.txt");

function ensureDirs() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function appendToOutputFile(content: string) {
  ensureDirs();
  const timestamp = new Date().toISOString();
  const entry = `\n[${timestamp}]\n${content}\n`;
  fs.appendFileSync(OUTPUT_FILE, entry);
}

router.post("/execute", async (req, res) => {
  try {
    const parseResult = executePythonSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }

    const code = parseResult.data.code;
    
    ensureDirs();
    
    const scriptFile = path.join(TEMP_DIR, `script_${Date.now()}.py`);
    fs.writeFileSync(scriptFile, code);

    console.log(`[Python] Executing script: ${scriptFile}`);
    appendToOutputFile(`# Python Script\n${code}`);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      const proc = spawn("python3", [scriptFile], {
        cwd: process.cwd(),
        env: { ...process.env },
        timeout: 30000
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
        fs.unlink(scriptFile, () => {});
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      proc.on("error", (err) => {
        fs.unlink(scriptFile, () => {});
        resolve({ stdout: "", stderr: err.message, exitCode: 1 });
      });
    });

    if (result.stdout) {
      appendToOutputFile(`[OUTPUT]\n${result.stdout}`);
    }
    if (result.stderr) {
      appendToOutputFile(`[ERROR]\n${result.stderr}`);
    }

    console.log(`[Python] Exit code: ${result.exitCode}`);

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    });
  } catch (error) {
    console.error("[Python] Error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    appendToOutputFile(`[ERROR] ${errorMsg}`);
    res.status(500).json({ error: errorMsg });
  }
});

router.get("/output", (_req, res) => {
  try {
    ensureDirs();
    
    if (!fs.existsSync(OUTPUT_FILE)) {
      return res.json({ content: "", path: OUTPUT_FILE });
    }

    const content = fs.readFileSync(OUTPUT_FILE, "utf-8");
    res.json({ content, path: OUTPUT_FILE });
  } catch (error) {
    console.error("[Python] Error reading output:", error);
    res.status(500).json({ error: "Failed to read output file" });
  }
});

router.delete("/output", (_req, res) => {
  try {
    ensureDirs();
    
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Python] Error clearing output:", error);
    res.status(500).json({ error: "Failed to clear output file" });
  }
});

export default router;
