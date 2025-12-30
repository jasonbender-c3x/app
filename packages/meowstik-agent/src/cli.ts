#!/usr/bin/env node

import { Command } from "commander";
import { DesktopAgent } from "./agent.js";

const program = new Command();

program
  .name("meowstik-agent")
  .description("Meowstik Desktop Agent - AI-powered desktop collaboration")
  .version("1.0.0");

program
  .option("-t, --token <token>", "Session token for authentication")
  .option("-s, --server <url>", "Server URL (default: wss://your-app.replit.app)")
  .option("-f, --fps <number>", "Frames per second for screen capture (default: 2)", "2")
  .option("-q, --quality <number>", "JPEG quality 1-100 (default: 60)", "60")
  .option("--no-audio", "Disable audio capture")
  .option("--no-input", "Disable input injection (view only)")
  .action(async (options) => {
    if (!options.token) {
      console.error("Error: Session token is required. Use --token <token>");
      process.exit(1);
    }

    const serverUrl = options.server || process.env.MEOWSTIK_SERVER_URL;
    if (!serverUrl) {
      console.error("Error: Server URL is required. Use --server <url> or set MEOWSTIK_SERVER_URL");
      process.exit(1);
    }

    console.log("🐱 Meowstik Desktop Agent");
    console.log("=========================");
    console.log(`Server: ${serverUrl}`);
    console.log(`FPS: ${options.fps}`);
    console.log(`Quality: ${options.quality}%`);
    console.log(`Audio: ${options.audio ? "enabled" : "disabled"}`);
    console.log(`Input: ${options.input ? "enabled" : "disabled"}`);
    console.log("");

    const agent = new DesktopAgent({
      token: options.token,
      serverUrl,
      fps: parseInt(options.fps, 10),
      quality: parseInt(options.quality, 10),
      enableAudio: options.audio,
      enableInput: options.input,
    });

    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await agent.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await agent.disconnect();
      process.exit(0);
    });

    try {
      await agent.connect();
    } catch (error) {
      console.error("Failed to connect:", error);
      process.exit(1);
    }
  });

program.parse();
