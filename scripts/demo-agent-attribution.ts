/**
 * =============================================================================
 * AGENT ATTRIBUTION DEMONSTRATION
 * =============================================================================
 * 
 * This script demonstrates the agent attribution system by:
 * 1. Listing all available agents
 * 2. Creating a test commit with agent attribution
 * 3. Creating a test PR with agent signature
 * 4. Showing activity logs
 * 
 * Usage:
 *   tsx scripts/demo-agent-attribution.ts
 * 
 * Prerequisites:
 * - Database must be seeded with agents (run: npm run seed:agents)
 * - GitHub OAuth must be configured
 * - Set TARGET_REPO environment variable (default: jasonbender-c3x/app)
 * =============================================================================
 */

import { storage } from "../server/storage";
import * as github from "../server/integrations/github";

const TARGET_REPO = process.env.TARGET_REPO || "jasonbender-c3x/app";
const [owner, repo] = TARGET_REPO.split("/");

async function demonstrateAgentAttribution() {
  console.log("🎭 Agent Attribution System Demonstration\n");
  console.log("=".repeat(70) + "\n");

  // ============================================================================
  // STEP 1: List Available Agents
  // ============================================================================
  console.log("📋 Step 1: Listing Available Agents\n");
  
  try {
    const agents = await storage.getAgentIdentities();
    console.log(`Found ${agents.length} agents in the system:\n`);
    
    for (const agent of agents) {
      const status = agent.enabled ? "🟢 Enabled " : "🔴 Disabled";
      console.log(`${status} | ${agent.displayName}`);
      console.log(`           Email: ${agent.email}`);
      console.log(`           Type: ${agent.agentType} | Permissions: ${agent.permissionLevel}`);
      console.log(`           Signature: ${agent.githubSignature || "None"}`);
      console.log();
    }
  } catch (error) {
    console.error("❌ Error listing agents:", error);
    console.log("\n💡 Tip: Run 'npm run seed:agents' to initialize the agent system\n");
    process.exit(1);
  }

  // ============================================================================
  // STEP 2: Get the Compiler Agent
  // ============================================================================
  console.log("=".repeat(70) + "\n");
  console.log("🤖 Step 2: Getting Agentia Compiler Agent\n");
  
  let compilerAgent;
  try {
    compilerAgent = await storage.getAgentByName("Agentia Compiler");
    if (!compilerAgent) {
      console.error("❌ Agentia Compiler not found in database");
      console.log("💡 Run 'npm run seed:agents' to initialize agents\n");
      process.exit(1);
    }
    
    console.log(`✅ Found agent: ${compilerAgent.displayName}`);
    console.log(`   ID: ${compilerAgent.id}`);
    console.log(`   Email: ${compilerAgent.email}`);
    console.log(`   Type: ${compilerAgent.agentType}`);
    console.log(`   Permissions: ${compilerAgent.permissionLevel}`);
    console.log();
  } catch (error) {
    console.error("❌ Error fetching agent:", error);
    process.exit(1);
  }

  // ============================================================================
  // STEP 3: Demonstrate Attribution (Dry Run)
  // ============================================================================
  console.log("=".repeat(70) + "\n");
  console.log("📝 Step 3: Agent Attribution Examples\n");
  
  console.log("This is a demonstration of how agent attribution works.\n");
  console.log("To actually create commits/PRs, set CREATE_DEMO_PR=true\n");
  
  const agentAuthor: github.AgentAuthor = {
    name: compilerAgent.displayName,
    email: compilerAgent.email,
    signature: compilerAgent.githubSignature || undefined
  };
  
  console.log("Agent Author Configuration:");
  console.log(JSON.stringify(agentAuthor, null, 2));
  console.log();
  
  // Show what would be created
  console.log("Example Commit Attribution:");
  console.log("---------------------------");
  console.log(`Author: ${agentAuthor.name} <${agentAuthor.email}>`);
  console.log(`Committer: [Authenticated User from OAuth]`);
  console.log(`Message: Demo commit\n${agentAuthor.signature || ""}`);
  console.log();
  
  console.log("Example PR Attribution:");
  console.log("----------------------");
  console.log(`Title: [Demo] Agent Attribution Test`);
  console.log(`Body:`);
  console.log(`  This is a demo PR created by the agent attribution system.`);
  console.log(``);
  console.log(`  ---`);
  console.log(`  *Created by: **${agentAuthor.name}** (${agentAuthor.email})*`);
  console.log();

  // ============================================================================
  // STEP 4: Show Activity Logs
  // ============================================================================
  console.log("=".repeat(70) + "\n");
  console.log("📊 Step 4: Recent Agent Activity\n");
  
  try {
    const recentActivity = await storage.getRecentAgentActivity(10);
    
    if (recentActivity.length === 0) {
      console.log("No activity logs found yet.\n");
      console.log("Activity logs are created when agents perform GitHub operations.");
    } else {
      console.log(`Showing last ${recentActivity.length} activities:\n`);
      
      for (const activity of recentActivity) {
        const statusIcon = activity.success ? "✅" : "❌";
        console.log(`${statusIcon} ${activity.agent.displayName}`);
        console.log(`   Action: ${activity.action} ${activity.activityType} on ${activity.platform}`);
        console.log(`   Resource: ${activity.resourceType} #${activity.resourceId || "N/A"}`);
        if (activity.resourceUrl) {
          console.log(`   URL: ${activity.resourceUrl}`);
        }
        console.log(`   Time: ${activity.createdAt}`);
        console.log();
      }
    }
  } catch (error) {
    console.error("❌ Error fetching activity:", error);
  }

  // ============================================================================
  // STEP 5: Optional - Create Demo PR
  // ============================================================================
  if (process.env.CREATE_DEMO_PR === "true") {
    console.log("=".repeat(70) + "\n");
    console.log("🚀 Step 5: Creating Demo PR (Optional)\n");
    console.log("⚠️  This will create a real PR in the repository!\n");
    
    try {
      // Create a unique branch name
      const timestamp = Date.now();
      const branchName = `demo/agent-attribution-${timestamp}`;
      const fileName = `docs/demo/agent-attribution-test-${timestamp}.md`;
      
      console.log(`Creating branch: ${branchName}`);
      await github.createBranch(owner, repo, branchName);
      console.log("✅ Branch created\n");
      
      const fileContent = `# Agent Attribution Test

This file was created by the Agent Attribution demonstration script.

**Agent:** ${agentAuthor.name}
**Email:** ${agentAuthor.email}
**Timestamp:** ${new Date().toISOString()}

## Purpose

This demonstrates that commits can be attributed to specific agents
while still being authenticated by the primary user's OAuth credentials.

## How It Works

1. **Authentication**: Uses primary user's GitHub OAuth token
2. **Attribution**: Commit author is set to the agent's identity
3. **Auditing**: Action is logged in the agent_activity_log table

---
${agentAuthor.signature || ""}
`;
      
      console.log(`Creating file: ${fileName}`);
      const fileResult = await github.createOrUpdateFileWithAgent(
        owner,
        repo,
        fileName,
        fileContent,
        `docs: Add agent attribution test file`,
        branchName,
        agentAuthor
      );
      console.log(`✅ File created: ${fileResult.htmlUrl}\n`);
      
      console.log("Creating pull request...");
      const prResult = await github.createPullRequestWithAgent(
        owner,
        repo,
        `[Demo] Agent Attribution Test - ${new Date().toISOString().split('T')[0]}`,
        `## Agent Attribution Test

This PR demonstrates the agent attribution system.

### Test Details
- **Agent**: ${agentAuthor.name}
- **Branch**: ${branchName}
- **File**: ${fileName}
- **Timestamp**: ${new Date().toISOString()}

### What to Check
1. **Commit Author**: Should show "${agentAuthor.name} <${agentAuthor.email}>"
2. **PR Footer**: Should include agent attribution signature
3. **Activity Log**: Should have an entry for this PR creation

You can safely close this PR after reviewing.`,
        branchName,
        agentAuthor
      );
      
      console.log(`✅ Pull request created!`);
      console.log(`   PR #${prResult.number}: ${prResult.htmlUrl}\n`);
      
      // Log the activity
      await storage.logAgentActivity({
        agentId: compilerAgent.id,
        activityType: 'pr',
        platform: 'github',
        resourceType: 'pull_request',
        resourceId: prResult.number.toString(),
        resourceUrl: prResult.htmlUrl,
        action: 'create',
        title: prResult.title,
        metadata: { demo: true, branch: branchName, file: fileName },
        success: true
      });
      
      console.log("✅ Activity logged to database\n");
      console.log("🎉 Demo PR created successfully!");
      console.log(`\n👀 View the PR: ${prResult.htmlUrl}`);
      console.log(`\n📝 Check the commit to see agent attribution in action!`);
      
    } catch (error) {
      console.error("❌ Error creating demo PR:", error);
      
      // Log the failure
      try {
        await storage.logAgentActivity({
          agentId: compilerAgent.id,
          activityType: 'pr',
          platform: 'github',
          resourceType: 'pull_request',
          action: 'create',
          title: 'Demo PR (failed)',
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      } catch (logError) {
        console.error("Failed to log error activity:", logError);
      }
    }
  } else {
    console.log("=".repeat(70) + "\n");
    console.log("💡 To create a live demo PR, run:\n");
    console.log("   CREATE_DEMO_PR=true tsx scripts/demo-agent-attribution.ts\n");
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("=".repeat(70) + "\n");
  console.log("✨ Demonstration Complete!\n");
  console.log("Key Takeaways:");
  console.log("1. Agents have unique identities (name, email, signature)");
  console.log("2. Git commits show agent as author, OAuth user as committer");
  console.log("3. PRs and issues include agent signature in description");
  console.log("4. All actions are logged for audit trail");
  console.log("5. Multiple agents can be configured for different purposes");
  console.log("\n📚 See docs/AGENT_ATTRIBUTION.md for complete documentation\n");
}

// Run the demonstration
demonstrateAgentAttribution()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Demonstration failed:", error);
    process.exit(1);
  });
