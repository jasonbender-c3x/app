import { storage } from '../storage';
import { evidence, entities, entityMentions, knowledgeEmbeddings, crossReferences, Evidence, Entity } from '@shared/schema';
import { eq, sql, ilike, desc, or } from 'drizzle-orm';
import { ingestionPipeline, KnowledgeBucket } from './ingestion-pipeline';
import { EmbeddingService } from './embedding-service';

const embeddingService = new EmbeddingService();

function getDb() {
  return storage.getDb();
}

export interface RetrievalContext {
  query: string;
  buckets?: KnowledgeBucket[];
  maxTokens?: number;
  includeEntities?: boolean;
  includeCrossRefs?: boolean;
}

export interface RetrievedItem {
  type: 'evidence' | 'entity' | 'cross_ref';
  id: string;
  content: string;
  score: number;
  bucket?: string;
  modality?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
  items: RetrievedItem[];
  totalTokensUsed: number;
  queryEmbeddingTime: number;
  searchTime: number;
}

export class RetrievalOrchestrator {
  private readonly MAX_CONTEXT_TOKENS = 8000;
  private readonly CHARS_PER_TOKEN = 4;

  async retrieve(context: RetrievalContext): Promise<RetrievalResult> {
    const startTime = Date.now();
    const items: RetrievedItem[] = [];
    const maxTokens = context.maxTokens || this.MAX_CONTEXT_TOKENS;

    const semanticStartTime = Date.now();
    const semanticResults = await ingestionPipeline.semanticSearch(context.query, {
      limit: 20,
      threshold: 0.4,
      bucket: context.buckets?.[0],
    });
    const semanticTime = Date.now() - semanticStartTime;

    for (const result of semanticResults) {
      items.push({
        type: 'evidence',
        id: result.evidenceId,
        content: result.content,
        score: result.score,
      });
    }

    const keywordResults = await this.keywordSearch(context.query, 10, context.buckets);
    for (const result of keywordResults) {
      if (!items.find(i => i.id === result.id)) {
        items.push(result);
      }
    }

    if (context.includeEntities !== false) {
      const entityResults = await this.findRelatedEntities(context.query, 5);
      items.push(...entityResults);
    }

    if (context.includeCrossRefs) {
      const crossRefResults = await this.findCrossReferences(items.map(i => i.id), 5);
      items.push(...crossRefResults);
    }

    items.sort((a, b) => b.score - a.score);

    let totalChars = 0;
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    const filteredItems: RetrievedItem[] = [];

    for (const item of items) {
      const itemChars = item.content.length;
      if (totalChars + itemChars <= maxChars) {
        filteredItems.push(item);
        totalChars += itemChars;
      }
    }

    return {
      items: filteredItems,
      totalTokensUsed: Math.ceil(totalChars / this.CHARS_PER_TOKEN),
      queryEmbeddingTime: semanticTime,
      searchTime: Date.now() - startTime,
    };
  }

  private async keywordSearch(query: string, limit: number, buckets?: KnowledgeBucket[]): Promise<RetrievedItem[]> {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    if (keywords.length === 0) return [];

    const results: RetrievedItem[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      let matches = await getDb().select()
        .from(evidence)
        .where(
          or(
            ilike(evidence.title, `%${keyword}%`),
            ilike(evidence.extractedText, `%${keyword}%`),
            ilike(evidence.summary, `%${keyword}%`)
          )
        )
        .limit(limit * 2);

      if (buckets && buckets.length > 0) {
        matches = matches.filter(m => m.bucket && buckets.includes(m.bucket as KnowledgeBucket));
      }

      for (const match of matches) {
        if (!results.find(r => r.id === match.id)) {
          const content = match.summary || match.extractedText || match.title || '';
          results.push({
            type: 'evidence',
            id: match.id,
            content: content.slice(0, 1000),
            score: 0.3,
            bucket: match.bucket || undefined,
            modality: match.modality,
          });
        }
      }
    }

    return results.slice(0, limit);
  }

  private async findCrossReferences(itemIds: string[], limit: number): Promise<RetrievedItem[]> {
    if (itemIds.length === 0) return [];
    
    const results: RetrievedItem[] = [];
    
    for (const sourceId of itemIds.slice(0, 3)) {
      const refs = await getDb().select()
        .from(crossReferences)
        .where(eq(crossReferences.sourceId, sourceId))
        .limit(limit);
      
      for (const ref of refs) {
        if (ref.targetType === 'evidence' && ref.targetId) {
          const [targetEvidence] = await getDb().select()
            .from(evidence)
            .where(eq(evidence.id, ref.targetId));
          
          if (targetEvidence && !results.find(r => r.id === targetEvidence.id)) {
            const content = targetEvidence.summary || targetEvidence.extractedText || '';
            results.push({
              type: 'cross_ref',
              id: targetEvidence.id,
              content: `[Related: ${ref.relationshipType}] ${content.slice(0, 500)}`,
              score: (ref.strength || 50) / 200,
              bucket: targetEvidence.bucket || undefined,
              metadata: {
                relationshipType: ref.relationshipType,
                reason: ref.reason,
              },
            });
          }
        }
      }
    }
    
    return results.slice(0, limit);
  }

  private async findRelatedEntities(query: string, limit: number): Promise<RetrievedItem[]> {
    const entityMatches = await ingestionPipeline.searchEntities(query, limit);
    
    return entityMatches.map(entity => ({
      type: 'entity' as const,
      id: entity.id,
      content: `[ENTITY: ${entity.type}] ${entity.name}${entity.description ? `: ${entity.description}` : ''}`,
      score: 0.25,
      metadata: {
        entityType: entity.type,
        mentionCount: entity.mentionCount,
      },
    }));
  }

  formatForPrompt(result: RetrievalResult): string {
    if (result.items.length === 0) {
      return '';
    }

    const sections: string[] = [];

    const evidenceItems = result.items.filter(i => i.type === 'evidence');
    if (evidenceItems.length > 0) {
      sections.push('## Relevant Knowledge\n');
      for (const item of evidenceItems) {
        const bucketTag = item.bucket ? `[${item.bucket}] ` : '';
        sections.push(`${bucketTag}${item.content}\n`);
      }
    }

    const entityItems = result.items.filter(i => i.type === 'entity');
    if (entityItems.length > 0) {
      sections.push('\n## Known Entities\n');
      for (const item of entityItems) {
        sections.push(`- ${item.content}\n`);
      }
    }

    return sections.join('');
  }

  async enrichPrompt(userMessage: string, systemContext: string = ''): Promise<string> {
    const retrievalResult = await this.retrieve({
      query: userMessage,
      maxTokens: 4000,
      includeEntities: true,
    });

    const knowledgeContext = this.formatForPrompt(retrievalResult);

    if (!knowledgeContext) {
      return systemContext;
    }

    return `${systemContext}\n\n<retrieved_knowledge>\n${knowledgeContext}\n</retrieved_knowledge>`;
  }

  async getStats(): Promise<{
    totalEmbeddings: number;
    totalEvidence: number;
    totalEntities: number;
    bucketDistribution: Record<string, number>;
  }> {
    const embeddings = await getDb().select().from(knowledgeEmbeddings);
    const allEvidence = await getDb().select().from(evidence);
    const allEntities = await getDb().select().from(entities);

    const bucketDistribution: Record<string, number> = {};
    for (const e of allEvidence) {
      if (e.bucket) {
        bucketDistribution[e.bucket] = (bucketDistribution[e.bucket] || 0) + 1;
      }
    }

    return {
      totalEmbeddings: embeddings.length,
      totalEvidence: allEvidence.length,
      totalEntities: allEntities.length,
      bucketDistribution,
    };
  }
}

export const retrievalOrchestrator = new RetrievalOrchestrator();
