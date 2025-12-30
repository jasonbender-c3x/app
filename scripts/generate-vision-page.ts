import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface ExtractedIdea {
  id: string;
  title: string;
  description: string;
  category: "architecture" | "feature" | "ux" | "integration" | "vision" | "tool";
  status: "completed" | "in_progress" | "pending" | "blocked" | "rejected";
  feasibility: "easy" | "medium" | "hard" | "impossible";
  effort: "low" | "medium" | "high" | "very_high";
  source: string;
  alternative?: string;
}

async function generateComprehensiveVisionPage(): Promise<void> {
  console.log("Loading extracted ideas...");
  const allIdeas: ExtractedIdea[] = JSON.parse(
    fs.readFileSync("docs/idea-extraction/all-ideas.json", "utf-8")
  );

  const completed = allIdeas.filter(i => i.status === "completed");
  const inProgress = allIdeas.filter(i => i.status === "in_progress");
  const pending = allIdeas.filter(i => 
    i.status === "pending" && 
    i.feasibility !== "impossible" && 
    i.effort !== "very_high"
  );
  const needsAlternative = allIdeas.filter(i => 
    i.feasibility === "impossible" || i.effort === "very_high"
  );

  const architectureIdeas = pending.filter(i => i.category === "architecture");
  const featureIdeas = pending.filter(i => i.category === "feature");
  const visionIdeas = pending.filter(i => i.category === "vision");
  const integrationIdeas = pending.filter(i => i.category === "integration");
  const uxIdeas = pending.filter(i => i.category === "ux");
  const toolIdeas = pending.filter(i => i.category === "tool");

  console.log("Generating comprehensive vision page...");
  
  const prompt = `You are writing the definitive vision document for "Meowstik" - an ambitious AI project to create a self-evolving, natural language computer. This will be published as a blog post on the main website.

Write a comprehensive, inspiring, and detailed vision document (3000+ words) that covers:

1. **EXECUTIVE SUMMARY** - A compelling opening that captures the vision
2. **THE PROBLEM** - Why current AI assistants fall short
3. **OUR VISION** - The Natural Language Computer concept
4. **CORE PRINCIPLES** - What drives our architecture decisions
5. **KEY INNOVATIONS** - Detailed descriptions of:
   - Cognitive Cascade (tiered AI architecture)
   - Knowledge Buckets (domain-specific memory)
   - JIT Tool Protocol (dynamic tool injection)
   - Multi-Instance Architecture (non-blocking parallel AI processes)
   - Self-Evolution Engine (autonomous improvement)
6. **FEATURE ROADMAP** - Organized by category with brief descriptions
7. **WHAT WE'VE BUILT** - Accomplishments to date
8. **THE FUTURE** - Long-term aspirations and research directions
9. **JOIN US** - Call to action

Use the following extracted ideas to inform your writing:

=== ARCHITECTURE IDEAS (${architectureIdeas.length}) ===
${JSON.stringify(architectureIdeas, null, 2)}

=== FEATURE IDEAS (${featureIdeas.length}) ===
${JSON.stringify(featureIdeas, null, 2)}

=== VISION IDEAS (${visionIdeas.length}) ===
${JSON.stringify(visionIdeas, null, 2)}

=== INTEGRATION IDEAS (${integrationIdeas.length}) ===
${JSON.stringify(integrationIdeas, null, 2)}

=== UX IDEAS (${uxIdeas.length}) ===
${JSON.stringify(uxIdeas, null, 2)}

=== TOOL IDEAS (${toolIdeas.length}) ===
${JSON.stringify(toolIdeas, null, 2)}

=== COMPLETED FEATURES (${completed.length}) ===
${JSON.stringify(completed, null, 2)}

=== AMBITIOUS IDEAS (with alternatives) (${needsAlternative.length}) ===
${JSON.stringify(needsAlternative, null, 2)}

Write in markdown format. Use headers (##, ###), bullet points, bold text, and occasional blockquotes for emphasis. Be professional but accessible. Include specific technical details where appropriate. Make it inspiring and forward-looking.

Vision Document:`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 8192
    }
  });

  const visionDoc = result.text || "";
  
  fs.writeFileSync("docs/idea-extraction/COMPREHENSIVE_VISION.md", visionDoc);
  console.log("Saved comprehensive vision to docs/idea-extraction/COMPREHENSIVE_VISION.md");

  const pageContent = `---
title: "The Meowstik Vision"
description: "Building a Self-Evolving AI Companion - A Natural Language Computer"
---

${visionDoc}

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
*Ideas extracted: ${allIdeas.length} | Completed: ${completed.length} | In Progress: ${inProgress.length} | Pending: ${pending.length}*
`;

  fs.writeFileSync("client/src/pages/vision.tsx", `export default function VisionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <article className="prose prose-lg dark:prose-invert max-w-none">
        <h1>The Meowstik Vision</h1>
        <p className="lead">Building a Self-Evolving AI Companion</p>
        
        <div dangerouslySetInnerHTML={{ __html: \`${visionDoc.replace(/`/g, "\\`").replace(/\${/g, "\\${")}\` }} />
      </article>
    </div>
  );
}`);
  
  console.log("Created React vision page at client/src/pages/vision.tsx");

  const stats = {
    totalIdeas: allIdeas.length,
    completed: completed.length,
    inProgress: inProgress.length,
    pending: pending.length,
    needsAlternative: needsAlternative.length,
    byCategory: {
      architecture: architectureIdeas.length,
      feature: featureIdeas.length,
      vision: visionIdeas.length,
      integration: integrationIdeas.length,
      ux: uxIdeas.length,
      tool: toolIdeas.length
    },
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync("docs/idea-extraction/stats.json", JSON.stringify(stats, null, 2));
  console.log("\nStats:", JSON.stringify(stats, null, 2));
}

generateComprehensiveVisionPage().catch(console.error);
