import { Router } from "express";
import { searchEmails, getEmail } from "../integrations/gmail";
import { listDriveFiles, getDriveFileContent } from "../integrations/google-drive";
import { storage } from "../storage";
import { conversationSources, ingestionJobs, extractedKnowledge, evidence, entities, entityMentions } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { ingestionPipeline } from "../services/ingestion-pipeline";
import { retrievalOrchestrator } from "../services/retrieval-orchestrator";

function getDb() {
  return storage.getDb();
}

const router = Router();

router.get("/sources", async (req, res) => {
  try {
    const db = getDb();
    const sources = await db.select().from(conversationSources).orderBy(desc(conversationSources.createdAt));
    res.json(sources.map(s => ({
      id: s.id,
      type: s.sourceType,
      title: s.title,
      participants: s.participants || [],
      messageCount: s.messageCount || 0,
      dateStart: s.dateStart?.toISOString() || new Date().toISOString(),
      dateEnd: s.dateEnd?.toISOString() || new Date().toISOString(),
      status: s.status
    })));
  } catch (error: any) {
    console.error("Error fetching sources:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/jobs", async (req, res) => {
  try {
    const db = getDb();
    const jobs = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(50);
    res.json(jobs.map(j => ({
      id: j.id,
      source: j.sourceName,
      status: j.status,
      progress: j.progress || 0,
      messagesProcessed: j.messagesProcessed || 0,
      totalMessages: j.totalMessages || 0,
      startedAt: j.startedAt?.toISOString(),
      completedAt: j.completedAt?.toISOString(),
      error: j.error
    })));
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/scan", async (req, res) => {
  try {
    const db = getDb();
    let sourcesFound = 0;
    
    const gmailSearches = [
      "from:gemini",
      "from:aistudio",
      "from:txt.voice.google.com",
      "subject:AI conversation"
    ];
    
    for (const query of gmailSearches) {
      try {
        const emails = await searchEmails(query, 30);
        for (const email of emails) {
          if (!email.id) continue;
          
          const existing = await db.select().from(conversationSources)
            .where(eq(conversationSources.sourceId, email.id)).limit(1);
          
          if (existing.length === 0) {
            await db.insert(conversationSources).values({
              sourceType: "gmail",
              sourceId: email.id,
              title: email.subject || "Untitled Email",
              participants: [email.from || "unknown"],
              messageCount: 1,
              dateStart: email.date ? new Date(email.date) : new Date(),
              dateEnd: email.date ? new Date(email.date) : new Date(),
              status: "pending"
            });
            sourcesFound++;
          }
        }
      } catch (err) {
        console.log(`Gmail search "${query}" failed:`, err);
      }
    }
    
    const driveSearches = [
      "name contains 'conversation'",
      "name contains 'chat'",
      "name contains 'message-export'",
      "fullText contains 'Gemini'"
    ];
    
    for (const query of driveSearches) {
      try {
        const files = await listDriveFiles(query, 30);
        for (const file of files) {
          if (!file.id) continue;
          
          const existing = await db.select().from(conversationSources)
            .where(eq(conversationSources.sourceId, file.id)).limit(1);
          
          if (existing.length === 0) {
            await db.insert(conversationSources).values({
              sourceType: "drive",
              sourceId: file.id,
              title: file.name || "Untitled Document",
              participants: ["LLM Conversation"],
              messageCount: 0,
              dateStart: file.createdTime ? new Date(file.createdTime) : new Date(),
              dateEnd: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
              status: "pending"
            });
            sourcesFound++;
          }
        }
      } catch (err) {
        console.log(`Drive search "${query}" failed:`, err);
      }
    }
    
    const allSources = await db.select().from(conversationSources).orderBy(desc(conversationSources.createdAt));
    
    res.json({ 
      success: true, 
      newSourcesFound: sourcesFound,
      totalSources: allSources.length,
      sources: allSources.map(s => ({
        id: s.id,
        type: s.sourceType,
        title: s.title,
        participants: s.participants || [],
        messageCount: s.messageCount || 0,
        dateStart: s.dateStart?.toISOString() || new Date().toISOString(),
        dateEnd: s.dateEnd?.toISOString() || new Date().toISOString(),
        status: s.status
      }))
    });
  } catch (error: any) {
    console.error("Error scanning sources:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/ingest/:sourceId", async (req, res) => {
  try {
    const db = getDb();
    const { sourceId } = req.params;
    
    const sources = await db.select().from(conversationSources)
      .where(eq(conversationSources.id, sourceId)).limit(1);
    
    if (sources.length === 0) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    const source = sources[0];
    
    const [job] = await db.insert(ingestionJobs).values({
      sourceId: source.id,
      sourceName: source.title,
      status: "running",
      progress: 0,
      messagesProcessed: 0,
      totalMessages: source.messageCount || 10,
      startedAt: new Date()
    }).returning();
    
    await db.update(conversationSources)
      .set({ status: "processing" })
      .where(eq(conversationSources.id, sourceId));
    
    processIngestionJob(job.id, source).catch(async (err) => {
      console.error("Ingestion job failed:", err);
      await db.update(ingestionJobs)
        .set({ status: "failed", error: err.message })
        .where(eq(ingestionJobs.id, job.id));
      await db.update(conversationSources)
        .set({ status: "failed" })
        .where(eq(conversationSources.id, sourceId));
    });
    
    res.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("Error starting ingestion:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/ingest-all", async (req, res) => {
  try {
    const db = getDb();
    const pendingSources = await db.select().from(conversationSources)
      .where(eq(conversationSources.status, "pending"))
      .limit(10);
    
    const jobIds: string[] = [];
    
    for (const source of pendingSources) {
      const [job] = await db.insert(ingestionJobs).values({
        sourceId: source.id,
        sourceName: source.title,
        status: "pending",
        progress: 0,
        messagesProcessed: 0,
        totalMessages: source.messageCount || 10,
        startedAt: new Date()
      }).returning();
      
      jobIds.push(job.id);
      
      processIngestionJob(job.id, source).catch(async (err) => {
        console.error("Ingestion job failed:", err);
        await db.update(ingestionJobs)
          .set({ status: "failed", error: err.message })
          .where(eq(ingestionJobs.id, job.id));
        await db.update(conversationSources)
          .set({ status: "failed" })
          .where(eq(conversationSources.id, source.id));
      });
    }
    
    res.json({ success: true, jobsStarted: jobIds.length, jobIds });
  } catch (error: any) {
    console.error("Error starting batch ingestion:", error);
    res.status(500).json({ error: error.message });
  }
});

async function processIngestionJob(jobId: string, source: typeof conversationSources.$inferSelect) {
  const db = getDb();
  await db.update(ingestionJobs)
    .set({ status: "running" })
    .where(eq(ingestionJobs.id, jobId));
  
  try {
    let content = "";
    
    if (source.sourceType === "gmail") {
      try {
        const email = await getEmail(source.sourceId);
        content = email?.body || email?.snippet || "";
      } catch (err) {
        console.log("Failed to fetch email:", err);
        content = "";
      }
    } else {
      try {
        const fileContent = await getDriveFileContent(source.sourceId);
        content = (fileContent as any)?.text || (fileContent as any)?.content || "";
      } catch (err) {
        console.log("Failed to fetch drive file:", err);
        content = "";
      }
    }
    
    await db.update(conversationSources)
      .set({ content })
      .where(eq(conversationSources.id, source.id));
    
    const messages = parseConversationContent(content);
    const totalMessages = messages.length || 1;
    
    await db.update(ingestionJobs)
      .set({ totalMessages })
      .where(eq(ingestionJobs.id, jobId));
    
    for (let i = 0; i < messages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const bucket = classifyToBucket(messages[i].content);
      
      await db.insert(extractedKnowledge).values({
        sourceId: source.id,
        jobId,
        bucket: bucket.bucket,
        section: bucket.section,
        content: messages[i].content,
        confidence: 80,
        metadata: { role: messages[i].role, index: i }
      });
      
      await db.update(ingestionJobs)
        .set({ 
          messagesProcessed: i + 1,
          progress: Math.round(((i + 1) / totalMessages) * 100)
        })
        .where(eq(ingestionJobs.id, jobId));
    }
    
    await writeToBucket(source.id, jobId);
    
    await db.update(ingestionJobs)
      .set({ 
        status: "completed", 
        completedAt: new Date(),
        progress: 100 
      })
      .where(eq(ingestionJobs.id, jobId));
    
    await db.update(conversationSources)
      .set({ 
        status: "completed",
        messageCount: totalMessages
      })
      .where(eq(conversationSources.id, source.id));
    
    console.log(`Ingestion completed: ${source.title} (${messages.length} messages)`);
    
  } catch (error: any) {
    await db.update(ingestionJobs)
      .set({ status: "failed", error: error.message })
      .where(eq(ingestionJobs.id, jobId));
    await db.update(conversationSources)
      .set({ status: "failed" })
      .where(eq(conversationSources.id, source.id));
    throw error;
  }
}

interface ParsedMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

function parseConversationContent(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  
  if (!content || content.trim().length === 0) {
    return [{ role: "user", content: "Empty content", timestamp: new Date() }];
  }
  
  const lines = content.split("\n");
  let currentRole: "user" | "assistant" = "user";
  let currentContent = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const userMatch = trimmed.match(/^(User|Human|Me|You said|Jason|J):/i);
    const aiMatch = trimmed.match(/^(Assistant|AI|Gemini|Claude|GPT|Model|Response):/i);
    
    if (userMatch) {
      if (currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
      currentRole = "user";
      currentContent = trimmed.replace(userMatch[0], "").trim();
    } else if (aiMatch) {
      if (currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
      currentRole = "assistant";
      currentContent = trimmed.replace(aiMatch[0], "").trim();
    } else {
      currentContent += " " + trimmed;
    }
  }
  
  if (currentContent.trim()) {
    messages.push({ role: currentRole, content: currentContent.trim() });
  }
  
  if (messages.length === 0) {
    messages.push({ role: "user", content: content.substring(0, 1000), timestamp: new Date() });
  }
  
  return messages;
}

function classifyToBucket(content: string): { bucket: string; section: string } {
  const lowerContent = content.toLowerCase();
  
  const techKeywords = ["code", "programming", "api", "function", "class", "database", "server", "frontend", "backend", "javascript", "python", "typescript"];
  const personalKeywords = ["family", "health", "finance", "relationship", "personal", "home", "life"];
  const projectKeywords = ["project", "task", "deadline", "milestone", "feature", "bug", "sprint"];
  
  if (techKeywords.some(kw => lowerContent.includes(kw))) {
    return { bucket: "CREATOR", section: "technical" };
  }
  if (personalKeywords.some(kw => lowerContent.includes(kw))) {
    return { bucket: "PERSONAL_LIFE", section: "general" };
  }
  if (projectKeywords.some(kw => lowerContent.includes(kw))) {
    return { bucket: "PROJECTS", section: "general" };
  }
  
  return { bucket: "CREATOR", section: "general" };
}

async function writeToBucket(sourceId: string, jobId: string) {
  try {
    const db = getDb();
    const knowledge = await db.select().from(extractedKnowledge)
      .where(eq(extractedKnowledge.jobId, jobId));
    
    const bucketDir = path.join(process.cwd(), "docs", "buckets");
    
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }
    
    const byBucket: Record<string, typeof knowledge> = {};
    for (const k of knowledge) {
      if (!byBucket[k.bucket]) byBucket[k.bucket] = [];
      byBucket[k.bucket].push(k);
    }
    
    for (const [bucket, items] of Object.entries(byBucket)) {
      const filePath = path.join(bucketDir, `${bucket}.md`);
      
      let existingContent = "";
      if (fs.existsSync(filePath)) {
        existingContent = fs.readFileSync(filePath, "utf-8");
      } else {
        existingContent = `# ${bucket}\n\nKnowledge bucket for ${bucket.toLowerCase().replace("_", " ")} related information.\n\n---\n\n`;
      }
      
      const newSection = `## Ingested from source ${sourceId}\n*Processed: ${new Date().toISOString()}*\n\n${items.map(i => `- ${i.content.substring(0, 200)}${i.content.length > 200 ? '...' : ''}`).join("\n")}\n\n---\n\n`;
      
      fs.writeFileSync(filePath, existingContent + newSection);
      console.log(`Updated bucket: ${filePath}`);
    }
  } catch (error) {
    console.error("Error writing to bucket:", error);
  }
}

router.get("/pipeline/stats", async (req, res) => {
  try {
    const stats = await ingestionPipeline.getPipelineStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching pipeline stats:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pipeline/evidence", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const bucket = req.query.bucket as string;
    
    let items;
    if (bucket) {
      items = await ingestionPipeline.getEvidenceByBucket(bucket as any, limit);
    } else {
      items = await ingestionPipeline.getRecentEvidence(limit);
    }
    
    res.json(items);
  } catch (error: any) {
    console.error("Error fetching evidence:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pipeline/entities", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string;
    const query = req.query.q as string;
    
    let items;
    if (query) {
      items = await ingestionPipeline.searchEntities(query, limit);
    } else if (type) {
      items = await ingestionPipeline.getEntitiesByType(type, limit);
    } else {
      const db = getDb();
      items = await db.select().from(entities).orderBy(desc(entities.mentionCount)).limit(limit);
    }
    
    res.json(items);
  } catch (error: any) {
    console.error("Error fetching entities:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pipeline/ingest/text", async (req, res) => {
  try {
    const { content, title, sourceType = 'upload' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    
    const result = await ingestionPipeline.ingestText({
      sourceType,
      modality: 'text',
      title: title || 'Manual text input',
      rawContent: content,
      extractedText: content,
    });
    
    res.json({ success: true, evidenceId: result.id });
  } catch (error: any) {
    console.error("Error ingesting text:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pipeline/process/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ingestionPipeline.processEvidence(id);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("Error processing evidence:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pipeline/search", async (req, res) => {
  try {
    const { query, bucket, modality, limit = 10, threshold = 0.5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }
    
    const results = await ingestionPipeline.semanticSearch(query, {
      bucket,
      modality,
      limit,
      threshold,
    });
    
    res.json({ results });
  } catch (error: any) {
    console.error("Error searching knowledge:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pipeline/retrieve", async (req, res) => {
  try {
    const { query, maxTokens, includeEntities } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }
    
    const result = await retrievalOrchestrator.retrieve({
      query,
      maxTokens,
      includeEntities,
    });
    
    const formatted = retrievalOrchestrator.formatForPrompt(result);
    
    res.json({
      items: result.items,
      formatted,
      stats: {
        totalTokensUsed: result.totalTokensUsed,
        searchTime: result.searchTime,
        queryEmbeddingTime: result.queryEmbeddingTime,
      }
    });
  } catch (error: any) {
    console.error("Error retrieving knowledge:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pipeline/retrieval-stats", async (req, res) => {
  try {
    const stats = await retrievalOrchestrator.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching retrieval stats:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
