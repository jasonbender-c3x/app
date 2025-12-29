import { storage } from '../storage';
import { evidence, entities, entityMentions, knowledgeEmbeddings, Evidence, Entity } from '@shared/schema';
import { eq, sql, and, ilike } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { EmbeddingService } from './embedding-service';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const embeddingService = new EmbeddingService();

function getDb() {
  return storage.getDb();
}

export type SourceType = 'gmail' | 'drive' | 'upload' | 'screenshot' | 'audio' | 'chat' | 'web';
export type Modality = 'text' | 'image' | 'audio' | 'document' | 'email' | 'conversation';
export type KnowledgeBucket = 'PERSONAL_LIFE' | 'CREATOR' | 'PROJECTS';

export interface EvidenceEnvelope {
  sourceType: SourceType;
  sourceId?: string;
  sourceUrl?: string;
  modality: Modality;
  mimeType?: string;
  title?: string;
  rawContent?: string;
  extractedText?: string;
  author?: string;
  participants?: string[];
  contentDate?: Date;
}

export interface ExtractionResult {
  text: string;
  entities: Array<{
    name: string;
    type: string;
    context?: string;
  }>;
  summary?: string;
  bucket?: KnowledgeBucket;
  confidence?: number;
}

export class IngestionPipeline {
  async ingestText(envelope: EvidenceEnvelope): Promise<Evidence> {
    const wordCount = envelope.extractedText?.split(/\s+/).length || 0;
    
    const [result] = await getDb().insert(evidence).values({
      sourceType: envelope.sourceType,
      sourceId: envelope.sourceId,
      sourceUrl: envelope.sourceUrl,
      modality: envelope.modality,
      mimeType: envelope.mimeType || 'text/plain',
      title: envelope.title,
      rawContent: envelope.rawContent,
      extractedText: envelope.extractedText,
      author: envelope.author,
      participants: envelope.participants,
      contentDate: envelope.contentDate,
      wordCount,
      status: 'pending',
    }).returning();
    
    return result;
  }

  async ingestEmail(emailData: {
    id: string;
    subject: string;
    from: string;
    to: string[];
    body: string;
    date: Date;
  }): Promise<Evidence> {
    const envelope: EvidenceEnvelope = {
      sourceType: 'gmail',
      sourceId: emailData.id,
      modality: 'email',
      mimeType: 'message/rfc822',
      title: emailData.subject,
      rawContent: emailData.body,
      extractedText: emailData.body,
      author: emailData.from,
      participants: [emailData.from, ...emailData.to],
      contentDate: emailData.date,
    };
    
    return this.ingestText(envelope);
  }

  async ingestDocument(docData: {
    id: string;
    name: string;
    mimeType: string;
    content: string;
    url?: string;
  }): Promise<Evidence> {
    const envelope: EvidenceEnvelope = {
      sourceType: 'drive',
      sourceId: docData.id,
      sourceUrl: docData.url,
      modality: 'document',
      mimeType: docData.mimeType,
      title: docData.name,
      rawContent: docData.content,
      extractedText: docData.content,
    };
    
    return this.ingestText(envelope);
  }

  async ingestConversation(convData: {
    id: string;
    platform: string;
    participants: string[];
    messages: Array<{ role: string; content: string; timestamp?: Date }>;
  }): Promise<Evidence> {
    const fullText = convData.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    
    const envelope: EvidenceEnvelope = {
      sourceType: 'chat',
      sourceId: convData.id,
      modality: 'conversation',
      mimeType: 'text/plain',
      title: `${convData.platform} conversation with ${convData.participants.join(', ')}`,
      rawContent: fullText,
      extractedText: fullText,
      participants: convData.participants,
      contentDate: convData.messages[0]?.timestamp,
    };
    
    return this.ingestText(envelope);
  }

  async ingestWebContent(webData: {
    url: string;
    title: string;
    content: string;
    author?: string;
    date?: Date;
  }): Promise<Evidence> {
    const envelope: EvidenceEnvelope = {
      sourceType: 'web',
      sourceUrl: webData.url,
      modality: 'text',
      mimeType: 'text/html',
      title: webData.title,
      rawContent: webData.content,
      extractedText: webData.content,
      author: webData.author,
      contentDate: webData.date,
    };
    
    return this.ingestText(envelope);
  }

  async processEvidence(evidenceId: string): Promise<ExtractionResult> {
    const [item] = await getDb().select()
      .from(evidence)
      .where(eq(evidence.id, evidenceId));
    
    if (!item) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    await getDb().update(evidence)
      .set({ status: 'processing' })
      .where(eq(evidence.id, evidenceId));

    try {
      const result = await this.extractAndAnalyze(item);
      
      await getDb().update(evidence)
        .set({
          summary: result.summary,
          bucket: result.bucket,
          confidence: result.confidence,
          status: 'indexed',
          updatedAt: new Date(),
        })
        .where(eq(evidence.id, evidenceId));
      
      for (const entityData of result.entities) {
        await this.upsertEntity(entityData, evidenceId);
      }
      
      await this.generateEmbeddings(evidenceId, result);
      
      return result;
    } catch (error) {
      await getDb().update(evidence)
        .set({
          status: 'failed',
          processingError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(evidence.id, evidenceId));
      throw error;
    }
  }

  private async extractAndAnalyze(item: Evidence): Promise<ExtractionResult> {
    const text = item.extractedText || item.rawContent || '';
    
    if (!text.trim()) {
      return { text: '', entities: [], bucket: 'PERSONAL_LIFE', confidence: 50 };
    }

    try {
      const prompt = `Analyze this content and extract structured information.

Content:
"""
${text.slice(0, 8000)}
"""

Respond with JSON only:
{
  "summary": "2-3 sentence summary of the content",
  "bucket": "PERSONAL_LIFE" | "CREATOR" | "PROJECTS",
  "confidence": 0-100,
  "entities": [
    {"name": "Entity Name", "type": "person|place|organization|concept|project|technology", "context": "brief context"}
  ]
}

Bucket definitions:
- PERSONAL_LIFE: Personal relationships, health, finances, daily life
- CREATOR: Creative work, design, coding, scientific research
- PROJECTS: Specific project work, tasks, deadlines`;

      const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
      });
      const responseText = result.text || '';
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { text, entities: [], bucket: 'PERSONAL_LIFE', confidence: 50 };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        text,
        summary: parsed.summary,
        bucket: parsed.bucket as KnowledgeBucket,
        confidence: parsed.confidence,
        entities: parsed.entities || [],
      };
    } catch (error) {
      console.error('AI extraction failed:', error);
      return { text, entities: [], bucket: 'PERSONAL_LIFE', confidence: 30 };
    }
  }

  private async upsertEntity(
    entityData: { name: string; type: string; context?: string },
    evidenceId: string
  ): Promise<Entity> {
    const [existing] = await getDb().select()
      .from(entities)
      .where(
        and(
          ilike(entities.name, entityData.name),
          eq(entities.type, entityData.type)
        )
      );
    
    let entity: Entity;
    
    if (existing) {
      [entity] = await getDb().update(entities)
        .set({
          mentionCount: sql`${entities.mentionCount} + 1`,
          lastMentioned: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(entities.id, existing.id))
        .returning();
    } else {
      [entity] = await getDb().insert(entities)
        .values({
          name: entityData.name,
          type: entityData.type,
          mentionCount: 1,
          lastMentioned: new Date(),
        })
        .returning();
    }
    
    await getDb().insert(entityMentions).values({
      entityId: entity.id,
      evidenceId,
      mentionText: entityData.name,
      context: entityData.context,
    });
    
    return entity;
  }

  private async generateEmbeddings(
    evidenceId: string,
    result: ExtractionResult
  ): Promise<void> {
    try {
      const textToEmbed = result.summary 
        ? `${result.summary}\n\n${result.text.slice(0, 2000)}`
        : result.text.slice(0, 4000);
      
      if (!textToEmbed.trim()) return;
      
      const embeddingResult = await embeddingService.embed(textToEmbed);
      
      const [evidenceItem] = await getDb().select()
        .from(evidence)
        .where(eq(evidence.id, evidenceId));
      
      if (!evidenceItem) return;
      
      await getDb().insert(knowledgeEmbeddings).values({
        evidenceId,
        content: textToEmbed,
        embedding: embeddingResult.embedding,
        embeddingModel: 'text-embedding-004',
        dimensions: 768,
        bucket: evidenceItem.bucket,
        modality: evidenceItem.modality,
        sourceType: evidenceItem.sourceType,
      });
      
      console.log(`Generated embedding for evidence ${evidenceId}`);
    } catch (error) {
      console.error(`Failed to generate embedding for ${evidenceId}:`, error);
    }
  }

  async semanticSearch(
    query: string,
    options: {
      bucket?: KnowledgeBucket;
      modality?: string;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<Array<{ evidenceId: string; content: string; score: number }>> {
    const { limit = 10, threshold = 0.5, bucket, modality } = options;
    
    const queryEmbedding = await embeddingService.embed(query);
    
    let allEmbeddings = await getDb().select()
      .from(knowledgeEmbeddings);
    
    if (bucket) {
      allEmbeddings = allEmbeddings.filter((e) => e.bucket === bucket);
    }
    if (modality) {
      allEmbeddings = allEmbeddings.filter((e) => e.modality === modality);
    }
    
    const candidates = allEmbeddings
      .filter((e) => e.embedding && Array.isArray(e.embedding))
      .map((e) => ({
        id: e.evidenceId || '',
        content: e.content,
        embedding: e.embedding as number[],
      }));
    
    const results = embeddingService.findSimilar(
      queryEmbedding.embedding,
      candidates,
      limit,
      threshold
    );
    
    return results.map((r) => {
      const candidate = candidates.find((c) => c.id === r.id);
      return {
        evidenceId: r.id,
        content: candidate?.content || '',
        score: r.score,
      };
    });
  }

  async getRecentEvidence(limit = 20): Promise<Evidence[]> {
    return getDb().select()
      .from(evidence)
      .orderBy(sql`${evidence.createdAt} DESC`)
      .limit(limit);
  }

  async getEvidenceByBucket(bucket: KnowledgeBucket, limit = 50): Promise<Evidence[]> {
    return getDb().select()
      .from(evidence)
      .where(eq(evidence.bucket, bucket))
      .orderBy(sql`${evidence.createdAt} DESC`)
      .limit(limit);
  }

  async getEntitiesByType(type: string, limit = 50): Promise<Entity[]> {
    return getDb().select()
      .from(entities)
      .where(eq(entities.type, type))
      .orderBy(sql`${entities.mentionCount} DESC`)
      .limit(limit);
  }

  async searchEntities(query: string, limit = 20): Promise<Entity[]> {
    return getDb().select()
      .from(entities)
      .where(ilike(entities.name, `%${query}%`))
      .orderBy(sql`${entities.mentionCount} DESC`)
      .limit(limit);
  }

  async getPipelineStats(): Promise<{
    totalEvidence: number;
    byStatus: Record<string, number>;
    byBucket: Record<string, number>;
    totalEntities: number;
    recentlyProcessed: number;
  }> {
    const allEvidence = await getDb().select().from(evidence);
    const allEntities = await getDb().select().from(entities);
    
    const byStatus: Record<string, number> = {};
    const byBucket: Record<string, number> = {};
    
    for (const item of allEvidence) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      if (item.bucket) {
        byBucket[item.bucket] = (byBucket[item.bucket] || 0) + 1;
      }
    }
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentlyProcessed = allEvidence.filter(
      e => e.status === 'indexed' && e.updatedAt > oneDayAgo
    ).length;
    
    return {
      totalEvidence: allEvidence.length,
      byStatus,
      byBucket,
      totalEntities: allEntities.length,
      recentlyProcessed,
    };
  }
}

export const ingestionPipeline = new IngestionPipeline();
