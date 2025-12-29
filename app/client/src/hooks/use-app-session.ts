import { useState, useEffect, useCallback } from "react";

interface ConnectorHealth {
  connected: boolean;
  error?: string;
}

interface AppSessionStatus {
  liveMode: boolean;
  buildRevision: string;
  uiRevision: number;
  revision: string;
  environment: string;
  connectors: {
    google: ConnectorHealth;
    github: ConnectorHealth;
  };
  timestamp: string;
}

interface UseAppSessionReturn {
  status: AppSessionStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  liveMode: boolean;
  revision: string;
  uiRevision: number;
  googleConnected: boolean;
  githubConnected: boolean;
}

const DEFAULT_STATUS: AppSessionStatus = {
  liveMode: false,
  buildRevision: "dev",
  uiRevision: 0,
  revision: "dev.0",
  environment: "development",
  connectors: {
    google: { connected: false },
    github: { connected: false }
  },
  timestamp: new Date().toISOString()
};

export function useAppSession(): UseAppSessionReturn {
  const [status, setStatus] = useState<AppSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/status");
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status");
      setStatus(DEFAULT_STATUS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
    liveMode: status?.liveMode ?? false,
    revision: status?.revision ?? "dev.0",
    uiRevision: status?.uiRevision ?? 0,
    googleConnected: status?.connectors.google.connected ?? false,
    githubConnected: status?.connectors.github.connected ?? false
  };
}
