/**
 * Evolution Engine Page
 * 
 * Provides interface for analyzing feedback patterns and generating
 * GitHub PRs with AI-driven improvement suggestions.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  GitPullRequest, 
  AlertTriangle, 
  TrendingUp, 
  Loader2, 
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { MainLayout } from "@/components/layout/main-layout";

interface FeedbackPattern {
  category: string;
  issue: string;
  frequency: number;
  severity: "low" | "medium" | "high";
  examples: Array<{ prompt: string; response: string; feedback: string }>;
}

interface ImprovementSuggestion {
  title: string;
  description: string;
  category: string;
  targetFile?: string;
  proposedChanges?: string;
  rationale: string;
  priority: number;
}

interface EvolutionReport {
  id: string;
  analyzedAt: string;
  feedbackCount: number;
  patterns: FeedbackPattern[];
  suggestions: ImprovementSuggestion[];
  summary: string;
}

interface Repo {
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
}

export default function EvolutionPage() {
  const { toast } = useToast();
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  const { data: statsData } = useQuery({
    queryKey: ["/api/feedback/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/feedback/stats");
      return res.json();
    }
  });

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ["/api/evolution/repos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/evolution/repos");
      return res.json();
    }
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/evolution/analyze");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.report) {
        toast({
          title: "Analysis Complete",
          description: `Found ${data.report.patterns.length} patterns and ${data.report.suggestions.length} suggestions.`
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze feedback",
        variant: "destructive"
      });
    }
  });

  const createPRMutation = useMutation({
    mutationFn: async (repo: { owner: string; repo: string }) => {
      const res = await apiRequest("POST", "/api/evolution/create-pr", repo);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "PR Created!",
          description: (
            <div className="flex items-center gap-2">
              <span>Pull request #{data.prNumber} created.</span>
              <a 
                href={data.prUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                View PR
              </a>
            </div>
          )
        });
      } else {
        toast({
          title: "PR Creation Failed",
          description: data.error,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "PR Creation Failed",
        description: error.message || "Could not create pull request",
        variant: "destructive"
      });
    }
  });

  const report = analyzeMutation.data?.report as EvolutionReport | undefined;
  const repos = reposData?.repos as Repo[] | undefined;
  const stats = statsData?.stats;

  const handleCreatePR = () => {
    if (!selectedRepo) {
      toast({ title: "Select a repository", variant: "destructive" });
      return;
    }
    const [owner, repo] = selectedRepo.split("/");
    createPRMutation.mutate({ owner, repo });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getPriorityStars = (priority: number) => {
    return "★".repeat(priority) + "☆".repeat(5 - priority);
  };

  return (
    <MainLayout>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
                <Brain className="h-8 w-8 text-purple-500" />
                Evolution Engine
              </h1>
              <p className="text-muted-foreground mt-1">
                Analyze feedback patterns and generate AI-driven improvements
              </p>
            </div>
            <Button 
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              size="lg"
              data-testid="button-analyze"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Analyze Feedback
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Feedback</p>
                    <p className="text-2xl font-bold" data-testid="text-total-feedback">{stats?.total || 0}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Positive</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-positive">{stats?.positive || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Negative</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-negative">{stats?.negative || 0}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">With Comments</p>
                    <p className="text-2xl font-bold" data-testid="text-with-comments">{stats?.withComments || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {report && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Detected Patterns
                  </CardTitle>
                  <CardDescription>{report.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  {report.patterns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No significant patterns detected. Collect more feedback.
                    </p>
                  ) : (
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {report.patterns.map((pattern, idx) => (
                          <div 
                            key={idx} 
                            className="p-3 rounded-lg border bg-card"
                            data-testid={`pattern-${idx}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{pattern.issue}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={getSeverityColor(pattern.severity) as any}>
                                  {pattern.severity}
                                </Badge>
                                <Badge variant="outline">{pattern.frequency}x</Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Category: {pattern.category}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Improvement Suggestions
                  </CardTitle>
                  <CardDescription>
                    AI-generated recommendations based on feedback analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {report.suggestions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No suggestions generated. More feedback data may be needed.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {report.suggestions.map((suggestion, idx) => (
                        <div 
                          key={idx}
                          className="p-4 rounded-lg border bg-card"
                          data-testid={`suggestion-${idx}`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{suggestion.title}</h4>
                              <Badge variant="secondary" className="mt-1">
                                {suggestion.category}
                              </Badge>
                            </div>
                            <span className="text-amber-500 font-mono text-sm">
                              {getPriorityStars(suggestion.priority)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {suggestion.description}
                          </p>
                          {suggestion.targetFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Target: <code>{suggestion.targetFile}</code>
                            </p>
                          )}
                          <Separator className="my-2" />
                          <p className="text-xs text-muted-foreground">
                            <strong>Rationale:</strong> {suggestion.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {report.suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitPullRequest className="h-5 w-5 text-blue-500" />
                      Create Evolution PR
                    </CardTitle>
                    <CardDescription>
                      Generate a pull request with the improvement suggestions for human review
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium">Target Repository</label>
                        <Select
                          value={selectedRepo}
                          onValueChange={setSelectedRepo}
                          disabled={reposLoading}
                        >
                          <SelectTrigger data-testid="select-repo">
                            <SelectValue placeholder="Select a repository..." />
                          </SelectTrigger>
                          <SelectContent>
                            {repos?.map((repo) => (
                              <SelectItem key={repo.fullName} value={repo.fullName}>
                                {repo.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={handleCreatePR}
                        disabled={!selectedRepo || createPRMutation.isPending}
                        className="gap-2"
                        data-testid="button-create-pr"
                      >
                        {createPRMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <GitPullRequest className="h-4 w-4" />
                            Create PR
                          </>
                        )}
                      </Button>
                    </div>
                    {createPRMutation.data?.prUrl && (
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 dark:text-green-300">
                          PR created successfully!
                        </span>
                        <a 
                          href={createPRMutation.data.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1 text-blue-600 hover:underline"
                          data-testid="link-pr"
                        >
                          View PR <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!report && !analyzeMutation.isPending && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Brain className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Analysis Yet</h3>
                <p className="text-muted-foreground text-center max-w-md mt-2">
                  Click "Analyze Feedback" to scan your feedback data for patterns
                  and generate improvement suggestions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
