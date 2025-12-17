/**
 * Feedback Page (Simplified)
 * 
 * Simple interface for:
 * 1. Submitting feedback with comment + thumbs up/down
 * 2. Viewing pending feedback
 * 3. Creating GitHub PRs from feedback
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  ThumbsUp, 
  ThumbsDown, 
  GitPullRequest, 
  Loader2, 
  ExternalLink,
  CheckCircle,
  MessageSquare,
  Send,
  ArrowLeft
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface Feedback {
  id: string;
  messageId: string;
  rating: "positive" | "negative";
  freeformText?: string;
  createdAt: string;
  submittedAt?: string;
}

interface Repo {
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
}

export default function EvolutionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [selectedFeedback, setSelectedFeedback] = useState<Set<string>>(new Set());

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ["/api/feedback"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/feedback?limit=50");
      return res.json();
    }
  });

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

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: { rating: string; freeformText: string }) => {
      const res = await apiRequest("POST", "/api/feedback", {
        ...data,
        messageId: `manual-${Date.now()}`
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback submitted!", description: "Thank you for your feedback." });
      setComment("");
      setRating(null);
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    }
  });

  const createPRMutation = useMutation({
    mutationFn: async (data: { owner: string; repo: string; feedbackIds: string[] }) => {
      const res = await apiRequest("POST", "/api/evolution/create-feedback-pr", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "PR Created!",
          description: (
            <div className="flex items-center gap-2">
              <span>Pull request #{data.prNumber} created.</span>
              <a href={data.prUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                View PR
              </a>
            </div>
          )
        });
        setSelectedFeedback(new Set());
        queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
        queryClient.invalidateQueries({ queryKey: ["/api/feedback/stats"] });
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create PR", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmitFeedback = () => {
    if (!rating) {
      toast({ title: "Select a rating", description: "Please use thumbs up or down", variant: "destructive" });
      return;
    }
    if (!comment.trim()) {
      toast({ title: "Add a comment", description: "Please describe your feedback", variant: "destructive" });
      return;
    }
    submitFeedbackMutation.mutate({ rating, freeformText: comment.trim() });
  };

  const handleCreatePR = () => {
    if (!selectedRepo) {
      toast({ title: "Select a repository", variant: "destructive" });
      return;
    }
    if (selectedFeedback.size === 0) {
      toast({ title: "Select feedback items", description: "Check at least one feedback item", variant: "destructive" });
      return;
    }
    const [owner, repo] = selectedRepo.split("/");
    createPRMutation.mutate({ owner, repo, feedbackIds: Array.from(selectedFeedback) });
  };

  const toggleFeedbackSelection = (id: string) => {
    const newSet = new Set(selectedFeedback);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFeedback(newSet);
  };

  const feedback = feedbackData?.feedback as Feedback[] | undefined;
  const repos = reposData?.repos as Repo[] | undefined;
  const stats = statsData?.stats;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
                <MessageSquare className="h-8 w-8 text-purple-500" />
                Feedback
              </h1>
              <p className="text-muted-foreground mt-1">
                Share your thoughts and help improve Meowstic
              </p>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-total">{stats?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-positive">{stats?.positive || 0}</p>
                  <p className="text-sm text-muted-foreground">Positive</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600" data-testid="text-negative">{stats?.negative || 0}</p>
                  <p className="text-sm text-muted-foreground">Negative</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submit Feedback Card */}
          <Card>
            <CardHeader>
              <CardTitle>Submit Feedback</CardTitle>
              <CardDescription>Share what's working or what could be better</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 justify-center">
                <Button
                  variant={rating === "positive" ? "default" : "outline"}
                  size="lg"
                  onClick={() => setRating("positive")}
                  className={`gap-2 ${rating === "positive" ? "bg-green-600 hover:bg-green-700" : ""}`}
                  data-testid="button-thumbs-up"
                >
                  <ThumbsUp className="h-5 w-5" />
                  Thumbs Up
                </Button>
                <Button
                  variant={rating === "negative" ? "default" : "outline"}
                  size="lg"
                  onClick={() => setRating("negative")}
                  className={`gap-2 ${rating === "negative" ? "bg-red-600 hover:bg-red-700" : ""}`}
                  data-testid="button-thumbs-down"
                >
                  <ThumbsDown className="h-5 w-5" />
                  Thumbs Down
                </Button>
              </div>
              <Textarea
                placeholder="Tell us what you think... What's working well? What could be improved?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                data-testid="input-comment"
              />
              <Button
                onClick={handleSubmitFeedback}
                disabled={submitFeedbackMutation.isPending || !rating || !comment.trim()}
                className="w-full gap-2"
                data-testid="button-submit-feedback"
              >
                {submitFeedbackMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Feedback
              </Button>
            </CardContent>
          </Card>

          {/* Feedback List + PR Creation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitPullRequest className="h-5 w-5 text-blue-500" />
                Create GitHub PR
              </CardTitle>
              <CardDescription>
                Select feedback items to bundle into a pull request for review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Repo Selection */}
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
                  disabled={!selectedRepo || selectedFeedback.size === 0 || createPRMutation.isPending}
                  className="gap-2"
                  data-testid="button-create-pr"
                >
                  {createPRMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitPullRequest className="h-4 w-4" />
                  )}
                  Create PR ({selectedFeedback.size})
                </Button>
              </div>

              {/* Feedback List */}
              <ScrollArea className="h-64 rounded-md border">
                {feedbackLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !feedback?.length ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No feedback yet
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {feedback.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFeedback.has(item.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleFeedbackSelection(item.id)}
                        data-testid={`feedback-item-${item.id}`}
                      >
                        <Checkbox
                          checked={selectedFeedback.has(item.id)}
                          onCheckedChange={() => toggleFeedbackSelection(item.id)}
                          data-testid={`checkbox-feedback-${item.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.rating === "positive" ? "default" : "destructive"}>
                              {item.rating === "positive" ? (
                                <ThumbsUp className="h-3 w-3 mr-1" />
                              ) : (
                                <ThumbsDown className="h-3 w-3 mr-1" />
                              )}
                              {item.rating}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {item.freeformText && (
                            <p className="text-sm line-clamp-2">{item.freeformText}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* PR Success */}
              {createPRMutation.data?.prUrl && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-700 dark:text-green-300">PR created successfully!</span>
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
        </div>
      </div>
    </div>
  );
}
