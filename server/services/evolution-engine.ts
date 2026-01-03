/**
 * =============================================================================
 * EVOLUTION ENGINE
 * =============================================================================
 * 
 * Analyzes user feedback to identify patterns and generate code improvements.
 * Creates GitHub PRs for human review of suggested changes.
 * 
 * FLOW:
 * 1. Collect feedback from database
 * 2. Analyze patterns (common issues, low-rated responses)
 * 3. Use AI to generate improvement suggestions
 * 4. Create a GitHub PR with proposed changes
 * =============================================================================
 */

import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { Feedback } from "@shared/schema";
import * as github from "../integrations/github";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Get the default agent for Evolution Engine operations
 * This is "Agentia Compiler" with full permissions
 */
async function getEvolutionAgent(): Promise<github.AgentAuthor> {
  try {
    const agent = await storage.getAgentByName("Agentia Compiler");
    if (agent) {
      return {
        name: agent.displayName,
        email: agent.email,
        signature: agent.githubSignature || undefined
      };
    }
  } catch (error) {
    console.warn("Agent not found in database, using default:", error);
  }
  
  // Fallback to default agent
  return {
    name: "Agentia Compiler",
    email: "compiler@agentia.dev",
    signature: "🤖 Automated action by Agentia Compiler"
  };
}

export interface FeedbackPattern {
  category: string;
  issue: string;
  frequency: number;
  examples: Array<{
    prompt: string;
    response: string;
    feedback: string;
  }>;
  severity: "low" | "medium" | "high";
}

export interface ImprovementSuggestion {
  title: string;
  description: string;
  category: string;
  targetFile?: string;
  proposedChanges?: string;
  rationale: string;
  priority: number;
}

export interface EvolutionReport {
  id: string;
  analyzedAt: string;
  feedbackCount: number;
  patterns: FeedbackPattern[];
  suggestions: ImprovementSuggestion[];
  summary: string;
}

export interface PRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

export async function analyzeFeedbackPatterns(): Promise<FeedbackPattern[]> {
  const feedbackEntries = await storage.getFeedback(100);
  
  if (feedbackEntries.length === 0) {
    return [];
  }

  const negativeFeedback = feedbackEntries.filter(f => f.rating === "negative");
  const feedbackWithText = feedbackEntries.filter(f => f.freeformText);
  
  const categoryIssues: Record<string, { count: number; examples: typeof feedbackEntries }> = {};
  
  for (const fb of negativeFeedback) {
    const categories = fb.categories as Record<string, number> | null;
    if (categories) {
      for (const [cat, score] of Object.entries(categories)) {
        if (typeof score === "number" && score <= 2) {
          if (!categoryIssues[cat]) {
            categoryIssues[cat] = { count: 0, examples: [] };
          }
          categoryIssues[cat].count++;
          if (categoryIssues[cat].examples.length < 3) {
            categoryIssues[cat].examples.push(fb);
          }
        }
      }
    }
  }

  const aspectIssues: Record<string, number> = {};
  for (const fb of negativeFeedback) {
    if (fb.dislikedAspects) {
      for (const aspect of fb.dislikedAspects) {
        aspectIssues[aspect] = (aspectIssues[aspect] || 0) + 1;
      }
    }
  }

  const patterns: FeedbackPattern[] = [];

  for (const [category, data] of Object.entries(categoryIssues)) {
    if (data.count >= 2) {
      patterns.push({
        category: "category_score",
        issue: `Low ${category} scores`,
        frequency: data.count,
        examples: data.examples.slice(0, 3).map(fb => ({
          prompt: fb.promptSnapshot || "",
          response: fb.responseSnapshot || "",
          feedback: fb.freeformText || ""
        })),
        severity: data.count >= 5 ? "high" : data.count >= 3 ? "medium" : "low"
      });
    }
  }

  for (const [aspect, count] of Object.entries(aspectIssues)) {
    if (count >= 2) {
      const examples = negativeFeedback
        .filter(fb => fb.dislikedAspects?.includes(aspect))
        .slice(0, 3);
      
      patterns.push({
        category: "disliked_aspect",
        issue: aspect,
        frequency: count,
        examples: examples.map(fb => ({
          prompt: fb.promptSnapshot || "",
          response: fb.responseSnapshot || "",
          feedback: fb.freeformText || ""
        })),
        severity: count >= 5 ? "high" : count >= 3 ? "medium" : "low"
      });
    }
  }

  if (feedbackWithText.length > 0) {
    const textFeedback = feedbackWithText
      .filter(fb => fb.rating === "negative")
      .slice(0, 5);
    
    if (textFeedback.length > 0) {
      patterns.push({
        category: "user_comments",
        issue: "Direct user complaints",
        frequency: textFeedback.length,
        examples: textFeedback.map(fb => ({
          prompt: fb.promptSnapshot || "",
          response: fb.responseSnapshot || "",
          feedback: fb.freeformText || ""
        })),
        severity: textFeedback.length >= 3 ? "high" : "medium"
      });
    }
  }

  return patterns.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity] || b.frequency - a.frequency;
  });
}

export async function generateImprovementSuggestions(
  patterns: FeedbackPattern[]
): Promise<ImprovementSuggestion[]> {
  if (patterns.length === 0) {
    return [];
  }

  const prompt = `You are an AI system improvement analyst. Analyze the following feedback patterns and suggest concrete improvements.

## Feedback Patterns:
${JSON.stringify(patterns, null, 2)}

## Instructions:
Based on these patterns, generate specific, actionable improvement suggestions. Focus on:
1. System prompt improvements
2. Response formatting changes
3. Knowledge gaps to address
4. Behavioral adjustments

Return a JSON array of suggestions with this structure:
[
  {
    "title": "Short descriptive title",
    "description": "Detailed description of the improvement",
    "category": "prompt_improvement|formatting|knowledge|behavior",
    "targetFile": "Optional: specific file to modify (e.g., prompts/system.md)",
    "proposedChanges": "Optional: specific text/code changes",
    "rationale": "Why this improvement addresses the feedback",
    "priority": 1-5 (5 = highest)
  }
]

Generate 2-5 suggestions based on the patterns.`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = result.text || "";
    const suggestions = JSON.parse(text) as ImprovementSuggestion[];
    return suggestions.sort((a, b) => b.priority - a.priority);
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return [];
  }
}

export async function generateEvolutionReport(): Promise<EvolutionReport> {
  const patterns = await analyzeFeedbackPatterns();
  const suggestions = await generateImprovementSuggestions(patterns);
  const stats = await storage.getFeedbackStats();

  let summary = "";
  if (patterns.length === 0) {
    summary = "No significant patterns detected in the feedback. Continue collecting data.";
  } else {
    const highPriority = patterns.filter(p => p.severity === "high").length;
    const topIssues = patterns.slice(0, 3).map(p => p.issue).join(", ");
    summary = `Analyzed ${stats.total} feedback entries. Found ${patterns.length} patterns (${highPriority} high severity). Top issues: ${topIssues}`;
  }

  return {
    id: `evo-${Date.now()}`,
    analyzedAt: new Date().toISOString(),
    feedbackCount: stats.total,
    patterns,
    suggestions,
    summary
  };
}

export async function createEvolutionPR(
  report: EvolutionReport,
  targetRepo: { owner: string; repo: string }
): Promise<PRResult> {
  if (report.suggestions.length === 0) {
    return { success: false, error: "No suggestions to create PR from" };
  }

  try {
    const agent = await getEvolutionAgent();
    const branchName = `evolution/${report.id}`;
    
    await github.createBranch(targetRepo.owner, targetRepo.repo, branchName);

    const evolutionDoc = generateEvolutionDocument(report);
    
    // Use agent-attributed file creation
    await github.createOrUpdateFileWithAgent(
      targetRepo.owner,
      targetRepo.repo,
      `docs/evolution/${report.id}.md`,
      evolutionDoc,
      `[Evolution] Add analysis report ${report.id}`,
      branchName,
      agent
    );

    const prBody = `## AI Evolution Report

This PR was automatically generated by the Evolution Engine based on user feedback analysis.

### Summary
${report.summary}

### Patterns Detected
${report.patterns.map(p => `- **${p.issue}** (${p.severity} severity, ${p.frequency} occurrences)`).join('\n')}

### Suggested Improvements
${report.suggestions.map((s, i) => `${i + 1}. **${s.title}** (Priority: ${s.priority}/5)\n   ${s.description}`).join('\n\n')}

### Action Required
Please review the suggestions and:
1. Approve changes that align with the product vision
2. Close if the suggestions aren't appropriate
3. Leave comments for refinements

---
*Generated by Evolution Engine on ${report.analyzedAt}*
*Based on ${report.feedbackCount} feedback entries*`;

    // Use agent-attributed PR creation
    const pr = await github.createPullRequestWithAgent(
      targetRepo.owner,
      targetRepo.repo,
      `[Evolution] ${report.suggestions[0].title}`,
      prBody,
      branchName,
      agent
    );

    // Log the activity
    try {
      const agentIdentity = await storage.getAgentByName("Agentia Compiler");
      if (agentIdentity) {
        await storage.logAgentActivity({
          agentId: agentIdentity.id,
          activityType: 'pr',
          platform: 'github',
          resourceType: 'pull_request',
          resourceId: pr.number.toString(),
          resourceUrl: pr.htmlUrl,
          action: 'create',
          title: pr.title,
          metadata: { reportId: report.id, suggestions: report.suggestions.length },
          success: true
        });
      }
    } catch (logError) {
      console.warn("Failed to log agent activity:", logError);
    }

    return {
      success: true,
      prUrl: pr.htmlUrl,
      prNumber: pr.number
    };
  } catch (error: any) {
    console.error("Error creating evolution PR:", error);
    return {
      success: false,
      error: error.message || "Failed to create PR"
    };
  }
}

function generateEvolutionDocument(report: EvolutionReport): string {
  return `# Evolution Report: ${report.id}

Generated: ${report.analyzedAt}
Feedback Analyzed: ${report.feedbackCount}

## Summary
${report.summary}

## Detected Patterns

${report.patterns.map(p => `### ${p.issue}
- **Category:** ${p.category}
- **Severity:** ${p.severity}
- **Frequency:** ${p.frequency} occurrences

**Examples:**
${p.examples.slice(0, 2).map((ex, i) => `
#### Example ${i + 1}
- **User Prompt:** ${ex.prompt?.substring(0, 200) || "N/A"}...
- **AI Response:** ${ex.response?.substring(0, 200) || "N/A"}...
- **Feedback:** ${ex.feedback || "No comment"}
`).join('\n')}
`).join('\n')}

## Improvement Suggestions

${report.suggestions.map((s, i) => `### ${i + 1}. ${s.title}
- **Priority:** ${s.priority}/5
- **Category:** ${s.category}
${s.targetFile ? `- **Target File:** ${s.targetFile}` : ''}

**Description:**
${s.description}

**Rationale:**
${s.rationale}

${s.proposedChanges ? `**Proposed Changes:**
\`\`\`
${s.proposedChanges}
\`\`\`
` : ''}
`).join('\n')}

---
*This document was automatically generated by the Evolution Engine.*
`;
}

// =============================================================================
// MESSAGE SCANNING FOR FEEDBACK
// =============================================================================

export interface MessageScanResult {
  success: boolean;
  messagesScanned: number;
  feedbackFound: Array<{
    messageContent: string;
    feedbackType: "bug" | "complaint" | "suggestion" | "praise";
    summary: string;
    severity?: "low" | "medium" | "high";
  }>;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

/**
 * Scans user messages for embedded feedback and creates a PR if issues are found
 */
export async function scanMessagesForFeedback(
  messages: Array<{ id: string; content: string; createdAt: Date | null }>,
  repo: { owner: string; repo: string }
): Promise<MessageScanResult> {
  if (messages.length === 0) {
    return {
      success: true,
      messagesScanned: 0,
      feedbackFound: []
    };
  }

  // Use AI to analyze messages for feedback signals
  const messagesText = messages.map((m, i) => 
    `Message ${i + 1} (${m.createdAt?.toISOString() || 'unknown'}): ${m.content}`
  ).join("\n\n");

  const analysisPrompt = `Analyze the following user messages for any feedback about the AI assistant. 
Look for:
- Bug reports or error mentions
- Complaints about behavior, responses, or features
- Suggestions for improvements
- Praise or positive feedback

For each piece of feedback found, classify it and summarize it.

Messages:
${messagesText}

Respond with a JSON array of feedback items found. If no feedback is found, return an empty array.
Format:
[
  {
    "messageContent": "brief excerpt of relevant message",
    "feedbackType": "bug" | "complaint" | "suggestion" | "praise",
    "summary": "concise summary of the feedback",
    "severity": "low" | "medium" | "high" (for bugs/complaints only)
  }
]

Only include actual feedback - ignore regular questions or chat.`;

  try {
    const model = genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: analysisPrompt
    });

    const result = await model;
    const responseText = result.text || "";
    
    // Parse the JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let feedbackFound: MessageScanResult["feedbackFound"] = [];
    
    if (jsonMatch) {
      try {
        feedbackFound = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn("Failed to parse feedback JSON, treating as no feedback found");
      }
    }

    // Filter to only actionable feedback (bugs, complaints, suggestions)
    const actionableFeedback = feedbackFound.filter(
      f => f.feedbackType !== "praise"
    );

    if (actionableFeedback.length === 0) {
      return {
        success: true,
        messagesScanned: messages.length,
        feedbackFound
      };
    }

    // Create a PR with the findings
    const agent = await getEvolutionAgent();
    const branchName = `evolution/message-scan-${Date.now()}`;
    const fileName = `docs/evolution/message-scan-${new Date().toISOString().split('T')[0]}.md`;
    
    const fileContent = generateMessageScanReport(messages.length, feedbackFound, actionableFeedback);

    // Create branch
    const branchResult = await github.createBranch(repo.owner, repo.repo, branchName);
    if (!branchResult) {
      return {
        success: false,
        messagesScanned: messages.length,
        feedbackFound,
        error: "Failed to create branch"
      };
    }

    // Create file with agent attribution
    const fileResult = await github.createOrUpdateFileWithAgent(
      repo.owner,
      repo.repo,
      fileName,
      fileContent,
      `docs: Add message scan feedback report - ${new Date().toISOString().split('T')[0]}`,
      branchName,
      agent
    );

    if (!fileResult) {
      return {
        success: false,
        messagesScanned: messages.length,
        feedbackFound,
        error: "Failed to create file"
      };
    }

    // Create PR with agent attribution
    const prResult = await github.createPullRequestWithAgent(
      repo.owner,
      repo.repo,
      `[Evolution] Message Scan Feedback - ${new Date().toISOString().split('T')[0]}`,
      `## Message Scan Report

This PR contains feedback extracted from ${messages.length} recent user messages.

### Findings Summary
- **Total feedback items:** ${feedbackFound.length}
- **Actionable items:** ${actionableFeedback.length}

### Feedback Breakdown
${actionableFeedback.map(f => `- **${f.feedbackType.toUpperCase()}**: ${f.summary}${f.severity ? ` (${f.severity})` : ''}`).join('\n')}

---
*Generated by Evolution Engine - Message Scanner*`,
      branchName,
      agent
    );

    if (prResult && prResult.htmlUrl) {
      return {
        success: true,
        messagesScanned: messages.length,
        feedbackFound,
        prUrl: prResult.htmlUrl,
        prNumber: prResult.number
      };
    }

    return {
      success: true,
      messagesScanned: messages.length,
      feedbackFound,
      error: "PR created but URL not returned"
    };

  } catch (error: any) {
    console.error("Error scanning messages:", error);
    return {
      success: false,
      messagesScanned: messages.length,
      feedbackFound: [],
      error: error.message || "Failed to analyze messages"
    };
  }
}

function generateMessageScanReport(
  totalMessages: number,
  allFeedback: MessageScanResult["feedbackFound"],
  actionableFeedback: MessageScanResult["feedbackFound"]
): string {
  return `# Message Scan Feedback Report

**Generated:** ${new Date().toISOString()}
**Messages Analyzed:** ${totalMessages}
**Total Feedback Items:** ${allFeedback.length}
**Actionable Items:** ${actionableFeedback.length}

## Summary

This report contains feedback extracted from user chat messages by the Evolution Engine's message scanner.

## Actionable Feedback

${actionableFeedback.length === 0 ? '*No actionable feedback found.*' : actionableFeedback.map((f, i) => `
### ${i + 1}. ${f.feedbackType.toUpperCase()}${f.severity ? ` (${f.severity})` : ''}

**Summary:** ${f.summary}

**Message Excerpt:**
> ${f.messageContent}
`).join('\n')}

## All Feedback (Including Praise)

${allFeedback.map((f, i) => `${i + 1}. **${f.feedbackType}**: ${f.summary}`).join('\n')}

---
*This report was automatically generated by the Evolution Engine Message Scanner.*
`;
}
