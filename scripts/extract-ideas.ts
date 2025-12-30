import { GoogleGenAI } from "@google/genai";
import { getDb } from "../server/db";
import { messages } from "../shared/schema";
import { asc } from "drizzle-orm";
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

async function extractIdeasFromText(text: string, source: string): Promise<ExtractedIdea[]> {
  const prompt = `Analyze the following conversation text and extract all feature ideas, architectural concepts, and vision items.

For each idea found, provide:
- id: A short unique identifier (snake_case)
- title: Brief title (5-10 words)
- description: 1-2 sentence description
- category: One of: architecture, feature, ux, integration, vision, tool
- status: One of: completed, in_progress, pending, blocked, rejected (guess based on context)
- feasibility: One of: easy, medium, hard, impossible
- effort: One of: low, medium, high, very_high
- source: "${source}"
- alternative: If impossible/very_high effort, suggest a simpler alternative

Only extract substantive ideas, skip test messages, greetings, and troubleshooting chatter.

Return as JSON array. If no ideas found, return empty array [].

TEXT:
${text}

JSON:`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const response = result.text || "";
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Error extracting ideas:", error);
  }
  return [];
}

async function processMessages() {
  console.log("Fetching all messages from database...");
  
  const db = getDb();
  const allMessages = await db.select()
    .from(messages)
    .orderBy(asc(messages.createdAt));
  
  console.log(`Found ${allMessages.length} messages`);
  
  const userMessages = allMessages.filter(m => m.role === "user" && m.content && m.content.trim().length > 20);
  console.log(`Filtering to ${userMessages.length} substantive user messages`);
  
  const batchSize = 20;
  const allIdeas: ExtractedIdea[] = [];
  
  for (let i = 0; i < userMessages.length; i += batchSize) {
    const batch = userMessages.slice(i, i + batchSize);
    const batchText = batch.map(m => `[${m.createdAt}] ${m.content}`).join("\n\n");
    
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(userMessages.length / batchSize)}...`);
    
    const ideas = await extractIdeasFromText(batchText, `chat_messages_batch_${i / batchSize + 1}`);
    allIdeas.push(...ideas);
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return allIdeas;
}

async function processDocuments() {
  console.log("Processing vision documents...");
  
  const docs = [
    "docs/v2-roadmap/VISIONS_OF_THE_FUTURE.md",
    "docs/v2-roadmap/KNOWLEDGE_INGESTION_ARCHITECTURE.md",
    "docs/drive-imports/AI_CORE_DIRECTIVE.md",
    "docs/drive-imports/AI_Agent_Research_Analysis.md"
  ];
  
  const allIdeas: ExtractedIdea[] = [];
  
  for (const docPath of docs) {
    try {
      const content = fs.readFileSync(docPath, "utf-8");
      console.log(`Processing ${docPath}...`);
      
      const chunks = content.match(/[\s\S]{1,8000}/g) || [];
      for (let i = 0; i < chunks.length; i++) {
        const ideas = await extractIdeasFromText(chunks[i], docPath);
        allIdeas.push(...ideas);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error reading ${docPath}:`, error);
    }
  }
  
  return allIdeas;
}

function deduplicateIdeas(ideas: ExtractedIdea[]): ExtractedIdea[] {
  const seen = new Map<string, ExtractedIdea>();
  
  for (const idea of ideas) {
    const key = idea.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.set(key, idea);
    }
  }
  
  return Array.from(seen.values());
}

function categorizeIdeas(ideas: ExtractedIdea[]) {
  return {
    completed: ideas.filter(i => i.status === "completed"),
    inProgress: ideas.filter(i => i.status === "in_progress"),
    pending: ideas.filter(i => i.status === "pending" && i.feasibility !== "impossible" && i.effort !== "very_high"),
    needsAlternative: ideas.filter(i => i.feasibility === "impossible" || i.effort === "very_high"),
    rejected: ideas.filter(i => i.status === "rejected" || i.status === "blocked")
  };
}

async function generateBlogPost(ideas: ExtractedIdea[]): Promise<string> {
  const categorized = categorizeIdeas(ideas);
  
  const prompt = `Create a compelling, professional blog post titled "The Vision: Building a Self-Evolving AI Companion" based on these extracted ideas.

The blog should:
1. Open with an engaging hook about the future of AI
2. Explain the core vision: A Natural Language Computer with persistent memory and self-evolution
3. Describe the key architectural innovations (Cognitive Cascade, Knowledge Buckets, etc.)
4. List the major features in development
5. Acknowledge what's been accomplished
6. End with a forward-looking conclusion

COMPLETED FEATURES (${categorized.completed.length}):
${JSON.stringify(categorized.completed, null, 2)}

IN PROGRESS (${categorized.inProgress.length}):
${JSON.stringify(categorized.inProgress, null, 2)}

PLANNED FEATURES (${categorized.pending.length}):
${JSON.stringify(categorized.pending, null, 2)}

Write in a professional but accessible tone. Use markdown formatting with headers, bullet points, and emphasis. Make it suitable for a tech blog on a landing page.

Blog post:`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  return result.text || "";
}

async function main() {
  console.log("=== Meowstik Idea Extraction Pipeline ===\n");
  
  const messageIdeas = await processMessages();
  console.log(`\nExtracted ${messageIdeas.length} ideas from messages`);
  
  const docIdeas = await processDocuments();
  console.log(`\nExtracted ${docIdeas.length} ideas from documents`);
  
  const allIdeas = [...messageIdeas, ...docIdeas];
  console.log(`\nTotal raw ideas: ${allIdeas.length}`);
  
  const dedupedIdeas = deduplicateIdeas(allIdeas);
  console.log(`After deduplication: ${dedupedIdeas.length}`);
  
  fs.writeFileSync("docs/idea-extraction/all-ideas.json", JSON.stringify(dedupedIdeas, null, 2));
  console.log("\nSaved ideas to docs/idea-extraction/all-ideas.json");
  
  const categorized = categorizeIdeas(dedupedIdeas);
  console.log(`\n=== Categorization ===`);
  console.log(`Completed: ${categorized.completed.length}`);
  console.log(`In Progress: ${categorized.inProgress.length}`);
  console.log(`Pending: ${categorized.pending.length}`);
  console.log(`Needs Alternative: ${categorized.needsAlternative.length}`);
  console.log(`Rejected: ${categorized.rejected.length}`);
  
  console.log("\nGenerating blog post...");
  const blogPost = await generateBlogPost(dedupedIdeas);
  
  fs.writeFileSync("docs/idea-extraction/VISION_BLOG_POST.md", blogPost);
  console.log("Saved blog post to docs/idea-extraction/VISION_BLOG_POST.md");
  
  console.log("\n=== Pipeline Complete ===");
}

main().catch(console.error);
