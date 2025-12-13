import { Router } from "express";
import * as fs from "fs";
import * as path from "path";

const router = Router();

let uiRevision = 0;
const BUILD_REVISION = process.env.REPL_SLUG ? Date.now().toString(36).slice(-4) : "dev";

async function checkConnectorHealth(connectorName: string): Promise<{
  connected: boolean;
  error?: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname || !xReplitToken) {
    return { connected: false, error: "Connector environment not configured" };
  }

  try {
    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=false&connector_names=${connectorName}`,
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );
    
    const data = await response.json();
    const connection = data.items?.[0];
    
    if (connection && connection.settings) {
      return { connected: true };
    }
    
    return { connected: false, error: "Not authorized" };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : "Connection check failed" 
    };
  }
}

router.get("/", async (req, res) => {
  uiRevision++;
  
  const isProduction = process.env.NODE_ENV === "production";
  const isDeployed = !!process.env.WEB_REPL_RENEWAL;
  
  const [googleHealth, githubHealth] = await Promise.all([
    checkConnectorHealth("google-drive"),
    checkConnectorHealth("github")
  ]);

  res.json({
    liveMode: isDeployed || isProduction,
    buildRevision: BUILD_REVISION,
    uiRevision,
    revision: `${BUILD_REVISION}.${uiRevision}`,
    environment: isDeployed ? "production" : "development",
    connectors: {
      google: googleHealth,
      github: githubHealth
    },
    timestamp: new Date().toISOString()
  });
});

router.get("/connectors", async (req, res) => {
  const connectors = ["google-drive", "google-mail", "google-calendar", "github"];
  
  const results = await Promise.all(
    connectors.map(async (name) => ({
      name,
      ...await checkConnectorHealth(name)
    }))
  );

  res.json({
    connectors: results,
    timestamp: new Date().toISOString()
  });
});

router.get("/connectors/:name/authorize-url", async (req, res) => {
  const { name } = req.params;
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    return res.status(500).json({ error: "Connectors not configured" });
  }

  const replSlug = process.env.REPL_SLUG || "nebula-chat";
  const replOwner = process.env.REPL_OWNER || "user";
  
  res.json({
    authorizeUrl: `https://replit.com/@${replOwner}/${replSlug}?connector=${name}`,
    connectorName: name
  });
});

export default router;
