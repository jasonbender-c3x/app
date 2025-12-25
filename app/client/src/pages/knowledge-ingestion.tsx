import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Database, Mail, FileText, RefreshCw, Play, CheckCircle2, Clock, AlertCircle, Loader2, Search } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";

interface ConversationSource {
  id: string;
  type: "gmail" | "drive";
  title: string;
  participants: string[];
  messageCount: number;
  dateStart: string;
  dateEnd: string;
  status: "pending" | "processing" | "completed" | "failed";
}

interface IngestionJob {
  id: string;
  source: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  messagesProcessed: number;
  totalMessages: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export default function KnowledgeIngestionPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("sources");
  const queryClient = useQueryClient();

  const { data: sources, isLoading: sourcesLoading, refetch: refetchSources } = useQuery({
    queryKey: ['/api/knowledge/sources'],
    queryFn: async () => {
      const res = await fetch('/api/knowledge/sources');
      if (!res.ok) return [];
      return res.json() as Promise<ConversationSource[]>;
    },
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/knowledge/jobs'],
    queryFn: async () => {
      const res = await fetch('/api/knowledge/jobs');
      if (!res.ok) return [];
      return res.json() as Promise<IngestionJob[]>;
    },
    refetchInterval: 2000,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/knowledge/scan', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/sources'] });
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await fetch(`/api/knowledge/ingest/${sourceId}`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/jobs'] });
    },
  });

  const ingestAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/knowledge/ingest-all', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/jobs'] });
    },
  });

  const filteredSources = sources?.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing": 
      case "running": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "processing": 
      case "running": return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back-settings">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Log Parser</h1>
              <p className="text-sm text-muted-foreground">Ingest historical LLM conversations</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            data-testid="button-scan-sources"
          >
            {scanMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Scan Sources
          </Button>
          <Button 
            onClick={() => ingestAllMutation.mutate()}
            disabled={ingestAllMutation.isPending || !sources?.length}
            data-testid="button-ingest-all"
          >
            {ingestAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Ingest All
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sources" data-testid="tab-sources">
              <FileText className="h-4 w-4 mr-2" />
              Sources ({sources?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs">
              <Database className="h-4 w-4 mr-2" />
              Jobs ({jobs?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations by title or participant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-sources"
              />
            </div>

            <ScrollArea className="h-[calc(100vh-350px)]">
              {sourcesLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSources.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Database className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Conversation Sources Found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click "Scan Sources" to find LLM conversations in your Gmail and Drive.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => scanMutation.mutate()}
                      disabled={scanMutation.isPending}
                    >
                      {scanMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Scan Now
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredSources.map((source) => (
                    <Card key={source.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {source.type === "gmail" ? (
                              <Mail className="h-5 w-5 text-red-500" />
                            ) : (
                              <FileText className="h-5 w-5 text-blue-500" />
                            )}
                            <div>
                              <CardTitle className="text-base">{source.title}</CardTitle>
                              <CardDescription>
                                {source.participants.join(", ")}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(source.status)}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => ingestMutation.mutate(source.id)}
                              disabled={ingestMutation.isPending || source.status === "completed"}
                              data-testid={`button-ingest-${source.id}`}
                            >
                              {ingestMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{source.messageCount} messages</span>
                          <span>|</span>
                          <span>{new Date(source.dateStart).toLocaleDateString()} - {new Date(source.dateEnd).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {jobsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !jobs?.length ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Ingestion Jobs</h3>
                    <p className="text-sm text-muted-foreground">
                      Start ingesting conversations to see processing jobs here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {jobs.map((job) => (
                    <Card key={job.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(job.status)}
                            <div>
                              <CardTitle className="text-base">{job.source}</CardTitle>
                              <CardDescription>
                                {job.messagesProcessed} / {job.totalMessages} messages processed
                              </CardDescription>
                            </div>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Progress value={job.progress} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{job.progress}% complete</span>
                          {job.startedAt && (
                            <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>
                          )}
                        </div>
                        {job.error && (
                          <p className="text-sm text-red-500">{job.error}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="mt-8 p-4 rounded-lg border border-border bg-secondary/20">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong>Scan</strong> - Find LLM conversations in Gmail (AI Studio, Gemini) and Drive docs</li>
            <li><strong>Ingest</strong> - Download and parse conversation content</li>
            <li><strong>Process</strong> - Extract knowledge using the Cognitive Cascade (Strategist → Analyst → Technician)</li>
            <li><strong>Store</strong> - Route extracted knowledge to appropriate buckets (Personal/Creator/Projects)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
