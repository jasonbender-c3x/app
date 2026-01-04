/**
 * =============================================================================
 * SEED AGENT IDENTITIES
 * =============================================================================
 * 
 * This script seeds the database with default agent identities.
 * Run this after the database schema is pushed to initialize the agent system.
 * 
 * Usage:
 *   npm run seed:agents
 *   or
 *   tsx scripts/seed-agents.ts
 * =============================================================================
 */

import { storage } from "../server/storage";

const DEFAULT_AGENTS = [
  {
    name: "Agentia Compiler",
    email: "compiler@agentia.dev",
    displayName: "Agentia Compiler",
    agentType: "compiler" as const,
    permissionLevel: "full" as const,
    description: "The primary AI agent with full system permissions. Handles code generation, analysis, and autonomous operations.",
    githubSignature: "🤖 Automated action by Agentia Compiler",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=compiler",
    enabled: true
  },
  {
    name: "Guest Agent",
    email: "guest@agentia.dev",
    displayName: "Guest Agent",
    agentType: "guest" as const,
    permissionLevel: "limited" as const,
    description: "Limited-access agent for guest users. Can perform basic read and write operations but cannot execute privileged actions.",
    githubSignature: "👤 Guest Agent Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=guest",
    enabled: true
  },
  {
    name: "Agent-2",
    email: "agent2@agentia.dev",
    displayName: "Agent 2",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 2 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent2",
    enabled: false
  },
  {
    name: "Agent-3",
    email: "agent3@agentia.dev",
    displayName: "Agent 3",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 3 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent3",
    enabled: false
  },
  {
    name: "Agent-4",
    email: "agent4@agentia.dev",
    displayName: "Agent 4",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 4 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent4",
    enabled: false
  },
  {
    name: "Agent-5",
    email: "agent5@agentia.dev",
    displayName: "Agent 5",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 5 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent5",
    enabled: false
  },
  {
    name: "Agent-6",
    email: "agent6@agentia.dev",
    displayName: "Agent 6",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 6 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent6",
    enabled: false
  },
  {
    name: "Agent-7",
    email: "agent7@agentia.dev",
    displayName: "Agent 7",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 7 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent7",
    enabled: false
  },
  {
    name: "Agent-8",
    email: "agent8@agentia.dev",
    displayName: "Agent 8",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 8 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent8",
    enabled: false
  },
  {
    name: "Agent-9",
    email: "agent9@agentia.dev",
    displayName: "Agent 9",
    agentType: "specialized" as const,
    permissionLevel: "full" as const,
    description: "Reserved for future specialized agent implementation.",
    githubSignature: "🔧 Agent 9 Action",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=agent9",
    enabled: false
  }
];

async function seedAgents() {
  console.log("🌱 Seeding agent identities...\n");
  
  try {
    // Check existing agents
    const existingAgents = await storage.getAgentIdentities();
    console.log(`Found ${existingAgents.length} existing agents in database.\n`);
    
    let created = 0;
    let skipped = 0;
    let updated = 0;
    
    for (const agentData of DEFAULT_AGENTS) {
      const existing = existingAgents.find(a => a.name === agentData.name);
      
      if (existing) {
        console.log(`⏭️  Agent "${agentData.name}" already exists, skipping...`);
        skipped++;
      } else {
        const agent = await storage.createAgentIdentity(agentData);
        console.log(`✅ Created agent: ${agent.displayName} (${agent.email})`);
        created++;
      }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📝 Total: ${created + skipped}`);
    console.log("=".repeat(60) + "\n");
    
    console.log("✨ Agent identity seeding complete!\n");
    
    // Display all agents
    const allAgents = await storage.getAgentIdentities();
    console.log("📋 Current agents:");
    for (const agent of allAgents) {
      const status = agent.enabled ? "🟢 Enabled" : "🔴 Disabled";
      console.log(`   ${status} | ${agent.displayName} (${agent.agentType}) - ${agent.permissionLevel}`);
    }
    
  } catch (error) {
    console.error("❌ Error seeding agents:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the seeding
seedAgents();
