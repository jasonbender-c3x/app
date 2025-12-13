import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppSession } from "@/hooks/use-app-session";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface ConnectorStatus {
  name: string;
  connected: boolean;
  error?: string;
}

interface ConnectorsGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredConnectors?: ("google" | "github")[];
  onAllConnected?: () => void;
}

export function ConnectorsGate({
  open,
  onOpenChange,
  requiredConnectors = ["google"],
  onAllConnected
}: ConnectorsGateProps) {
  const { googleConnected, githubConnected, refresh, isLoading } = useAppSession();
  const [authorizeUrls, setAuthorizeUrls] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);

  const connectorLabels: Record<string, string> = {
    google: "Google Workspace",
    github: "GitHub"
  };

  const connectorDescriptions: Record<string, string> = {
    google: "Access Gmail, Drive, Calendar, Docs, Sheets, and Tasks",
    github: "Access repositories, issues, and pull requests"
  };

  const isConnected = (name: string) => {
    if (name === "google") return googleConnected;
    if (name === "github") return githubConnected;
    return false;
  };

  const allConnected = requiredConnectors.every(isConnected);

  useEffect(() => {
    if (allConnected && onAllConnected) {
      onAllConnected();
      onOpenChange(false);
    }
  }, [allConnected, onAllConnected, onOpenChange]);

  useEffect(() => {
    async function fetchAuthorizeUrls() {
      const urls: Record<string, string> = {};
      for (const connector of requiredConnectors) {
        try {
          const connectorName = connector === "google" ? "google-drive" : "github";
          const response = await fetch(`/api/status/connectors/${connectorName}/authorize-url`);
          if (response.ok) {
            const data = await response.json();
            urls[connector] = data.authorizeUrl;
          }
        } catch (error) {
          console.error(`Failed to get authorize URL for ${connector}:`, error);
        }
      }
      setAuthorizeUrls(urls);
    }
    
    if (open) {
      fetchAuthorizeUrls();
    }
  }, [open, requiredConnectors]);

  const handleCheckConnection = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  const handleAuthorize = (connector: string) => {
    const url = authorizeUrls[connector];
    if (url) {
      window.open(url, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-connectors-gate">
        <DialogHeader>
          <DialogTitle>Connect Your Services</DialogTitle>
          <DialogDescription>
            To use this feature, please connect the following services.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {requiredConnectors.map((connector) => {
            const connected = isConnected(connector);
            
            return (
              <div
                key={connector}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                data-testid={`connector-status-${connector}`}
              >
                <div className="mt-0.5">
                  {connected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">{connectorLabels[connector]}</div>
                  <div className="text-sm text-muted-foreground">
                    {connectorDescriptions[connector]}
                  </div>
                  {connected ? (
                    <div className="text-sm text-green-600">Connected</div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleAuthorize(connector)}
                      data-testid={`button-authorize-${connector}`}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Authorize {connectorLabels[connector]}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleCheckConnection}
            disabled={checking || isLoading}
            data-testid="button-check-connections"
          >
            {(checking || isLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Check Connections
          </Button>
          
          {allConnected ? (
            <Button onClick={() => onOpenChange(false)} data-testid="button-continue">
              Continue
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-skip">
              Skip for Now
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useConnectorsGate() {
  const [showGate, setShowGate] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [requiredConnectors, setRequiredConnectors] = useState<("google" | "github")[]>(["google"]);
  const { googleConnected, githubConnected } = useAppSession();

  const requireConnectors = (
    connectors: ("google" | "github")[],
    action: () => void
  ) => {
    const needsAuth = connectors.some((c) => {
      if (c === "google") return !googleConnected;
      if (c === "github") return !githubConnected;
      return false;
    });

    if (needsAuth) {
      setRequiredConnectors(connectors);
      setPendingAction(() => action);
      setShowGate(true);
    } else {
      action();
    }
  };

  const handleAllConnected = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return {
    showGate,
    setShowGate,
    requiredConnectors,
    requireConnectors,
    handleAllConnected,
    ConnectorsGateModal: () => (
      <ConnectorsGate
        open={showGate}
        onOpenChange={setShowGate}
        requiredConnectors={requiredConnectors}
        onAllConnected={handleAllConnected}
      />
    )
  };
}
