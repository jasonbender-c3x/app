/**
 * =============================================================================
 * AGENT ATTRIBUTION USAGE EXAMPLES
 * =============================================================================
 * 
 * This file provides code examples for using the agent attribution system
 * in various parts of the application.
 * =============================================================================
 */

import { storage } from "../server/storage";
import * as github from "../server/integrations/github";

// =============================================================================
// Example 1: Creating a GitHub Issue with Agent Attribution
// =============================================================================

export async function exampleCreateIssueWithAgent() {
  // Get the agent (e.g., Agentia Compiler)
  const agent = await storage.getAgentByName("Agentia Compiler");
  if (!agent) {
    throw new Error("Agent not found");
  }

  // Create agent author object
  const agentAuthor: github.AgentAuthor = {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  };

  // Create issue with agent attribution
  const issue = await github.createIssueWithAgent(
    "jasonbender-c3x",
    "app",
    "Automated Issue: System Health Check",
    agentAuthor,
    "This issue was created automatically to report system health metrics.",
    ["automation", "monitoring"]
  );

  // Log the activity
  await storage.logAgentActivity({
    agentId: agent.id,
    activityType: "issue",
    platform: "github",
    resourceType: "issue",
    resourceId: issue.number.toString(),
    resourceUrl: issue.htmlUrl,
    action: "create",
    title: issue.title,
    success: true
  });

  return issue;
}

// =============================================================================
// Example 2: Creating a Commit with Agent Attribution
// =============================================================================

export async function exampleCreateCommitWithAgent() {
  const agent = await storage.getAgentByName("Agentia Compiler");
  if (!agent) {
    throw new Error("Agent not found");
  }

  const agentAuthor: github.AgentAuthor = {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  };

  // Create a file with agent-attributed commit
  const result = await github.createOrUpdateFileWithAgent(
    "jasonbender-c3x",
    "app",
    "docs/automated/status-report.md",
    "# System Status\n\nAll systems operational.",
    "docs: Update automated status report",
    "main",
    agentAuthor
  );

  // Log the activity
  await storage.logAgentActivity({
    agentId: agent.id,
    activityType: "commit",
    platform: "github",
    resourceType: "repository",
    resourceId: result.commitSha,
    resourceUrl: result.commitUrl,
    action: "create",
    title: "Update automated status report",
    metadata: { path: result.path, branch: "main" },
    success: true
  });

  return result;
}

// =============================================================================
// Example 3: Creating a PR with Agent Attribution
// =============================================================================

export async function exampleCreatePRWithAgent() {
  const agent = await storage.getAgentByName("Agentia Compiler");
  if (!agent) {
    throw new Error("Agent not found");
  }

  const agentAuthor: github.AgentAuthor = {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  };

  // First, create a branch
  const branchName = `automation/update-${Date.now()}`;
  await github.createBranch("jasonbender-c3x", "app", branchName);

  // Then create a file in that branch
  await github.createOrUpdateFileWithAgent(
    "jasonbender-c3x",
    "app",
    "docs/updates/latest.md",
    "# Latest Updates\n\nSystem updated successfully.",
    "docs: Add latest updates",
    branchName,
    agentAuthor
  );

  // Finally, create the PR
  const pr = await github.createPullRequestWithAgent(
    "jasonbender-c3x",
    "app",
    "[Automation] System Updates",
    "Automated system updates from the monitoring agent.",
    branchName,
    agentAuthor
  );

  // Log the activity
  await storage.logAgentActivity({
    agentId: agent.id,
    activityType: "pr",
    platform: "github",
    resourceType: "pull_request",
    resourceId: pr.number.toString(),
    resourceUrl: pr.htmlUrl,
    action: "create",
    title: pr.title,
    metadata: { branch: branchName },
    success: true
  });

  return pr;
}

// =============================================================================
// Example 4: Using Different Agents Based on Context
// =============================================================================

export async function exampleMultiAgentUsage(operationType: "privileged" | "guest") {
  // Select agent based on operation type
  const agentName = operationType === "privileged" 
    ? "Agentia Compiler" 
    : "Guest Agent";
  
  const agent = await storage.getAgentByName(agentName);
  if (!agent) {
    throw new Error(`Agent ${agentName} not found`);
  }

  // Check permissions
  if (operationType === "privileged" && agent.permissionLevel !== "full") {
    throw new Error("Insufficient permissions for privileged operation");
  }

  const agentAuthor: github.AgentAuthor = {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  };

  // Perform operation with appropriate agent
  // ... GitHub operations here ...

  return { agent: agentName, permissions: agent.permissionLevel };
}

// =============================================================================
// Example 5: Adding Comments with Agent Attribution
// =============================================================================

export async function exampleAddCommentWithAgent(issueNumber: number) {
  const agent = await storage.getAgentByName("Agentia Compiler");
  if (!agent) {
    throw new Error("Agent not found");
  }

  const agentAuthor: github.AgentAuthor = {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  };

  // Add a comment to an issue or PR
  const comment = await github.addCommentWithAgent(
    "jasonbender-c3x",
    "app",
    issueNumber,
    "Automated health check completed. All systems operational.",
    agentAuthor
  );

  // Log the activity
  await storage.logAgentActivity({
    agentId: agent.id,
    activityType: "comment",
    platform: "github",
    resourceType: "issue",
    resourceId: issueNumber.toString(),
    resourceUrl: comment.htmlUrl,
    action: "create",
    title: "Add health check comment",
    success: true
  });

  return comment;
}

// =============================================================================
// Example 6: Querying Agent Activity
// =============================================================================

export async function exampleQueryAgentActivity() {
  // Get all agents
  const agents = await storage.getAgentIdentities();
  console.log(`Total agents: ${agents.length}`);

  // Get recent activity across all agents
  const recentActivity = await storage.getRecentAgentActivity(10);
  console.log(`Recent activities: ${recentActivity.length}`);

  // Get activity for a specific agent
  const compilerAgent = await storage.getAgentByName("Agentia Compiler");
  if (compilerAgent) {
    const compilerActivity = await storage.getAgentActivity(compilerAgent.id, 20);
    console.log(`Compiler activities: ${compilerActivity.length}`);
  }

  return {
    totalAgents: agents.length,
    recentActivities: recentActivity,
    enabledAgents: agents.filter(a => a.enabled).length
  };
}

// =============================================================================
// Example 7: Creating Custom Agents
// =============================================================================

export async function exampleCreateCustomAgent() {
  // Create a specialized agent for a specific task
  const customAgent = await storage.createAgentIdentity({
    name: "DocBot",
    email: "docbot@agentia.dev",
    displayName: "Documentation Bot",
    agentType: "specialized",
    permissionLevel: "limited",
    description: "Specialized agent for documentation updates and maintenance",
    githubSignature: "📚 Automated by Documentation Bot",
    enabled: true
  });

  console.log(`Created custom agent: ${customAgent.displayName}`);
  
  return customAgent;
}

// =============================================================================
// Example 8: Error Handling with Activity Logging
// =============================================================================

export async function exampleErrorHandling() {
  const agent = await storage.getAgentByName("Agentia Compiler");
  if (!agent) {
    throw new Error("Agent not found");
  }

  try {
    // Attempt GitHub operation
    const agentAuthor: github.AgentAuthor = {
      name: agent.displayName,
      email: agent.email,
      signature: agent.githubSignature
    };

    const issue = await github.createIssueWithAgent(
      "jasonbender-c3x",
      "app",
      "Test Issue",
      agentAuthor,
      "Test issue body"
    );

    // Log success
    await storage.logAgentActivity({
      agentId: agent.id,
      activityType: "issue",
      platform: "github",
      resourceType: "issue",
      resourceId: issue.number.toString(),
      resourceUrl: issue.htmlUrl,
      action: "create",
      title: issue.title,
      success: true
    });

    return issue;
  } catch (error) {
    // Log failure
    await storage.logAgentActivity({
      agentId: agent.id,
      activityType: "issue",
      platform: "github",
      resourceType: "issue",
      action: "create",
      title: "Test Issue",
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

// =============================================================================
// Example 9: Helper Function to Get Agent Author
// =============================================================================

export async function getAgentAuthor(
  agentName: string = "Agentia Compiler"
): Promise<github.AgentAuthor> {
  const agent = await storage.getAgentByName(agentName);
  
  if (!agent) {
    // Fallback to default
    return {
      name: "Agentia Compiler",
      email: "compiler@agentia.dev",
      signature: "🤖 Automated action by Agentia Compiler"
    };
  }

  return {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature || undefined
  };
}
