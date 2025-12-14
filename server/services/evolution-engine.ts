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
    const branchName = `evolution/${report.id}`;
    
    await github.createBranch(targetRepo.owner, targetRepo.repo, branchName);

    const evolutionDoc = generateEvolutionDocument(report);
    
    await github.createOrUpdateFile(
      targetRepo.owner,
      targetRepo.repo,
      `docs/evolution/${report.id}.md`,
      evolutionDoc,
      `[Evolution] Add analysis report ${report.id}`,
      branchName
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

    const pr = await github.createPullRequest(
      targetRepo.owner,
      targetRepo.repo,
      `[Evolution] ${report.suggestions[0].title}`,
      prBody,
      branchName
    );

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
