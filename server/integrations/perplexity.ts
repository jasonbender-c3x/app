/**
 * Perplexity API Integration
 * AI-powered search with real-time web access and citations
 * Docs: https://docs.perplexity.ai/
 */

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface PerplexitySearchParams {
  query: string;
  model?: string;
  systemPrompt?: string;
  returnCitations?: boolean;
  searchRecency?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Search using Perplexity's Sonar models
 * Returns AI-generated answer with citations from the web
 */
export async function perplexitySearch(params: PerplexitySearchParams): Promise<{
  answer: string;
  citations: string[];
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured. Please add it to your secrets.');
  }

  const messages: PerplexityMessage[] = [];
  
  if (params.systemPrompt) {
    messages.push({
      role: 'system',
      content: params.systemPrompt,
    });
  }
  
  messages.push({
    role: 'user',
    content: params.query,
  });

  const requestBody: Record<string, unknown> = {
    model: params.model || 'sonar',
    messages,
    return_citations: params.returnCitations ?? true,
  };

  if (params.searchRecency) {
    requestBody.search_recency_filter = params.searchRecency;
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${error}`);
  }

  const data: PerplexityResponse = await response.json();

  return {
    answer: data.choices[0]?.message?.content || 'No answer generated',
    citations: data.citations || [],
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
    },
  };
}

/**
 * Quick question - optimized for simple factual queries
 * Best for questions like "Is X true?", "What is Y?", "Who is Z?"
 */
export async function perplexityQuickAnswer(query: string): Promise<{
  answer: string;
  citations: string[];
}> {
  const result = await perplexitySearch({
    query,
    model: 'sonar',
    systemPrompt: 'Be concise and direct. Answer the question in 1-3 sentences if possible. Always cite your sources.',
    returnCitations: true,
  });

  return {
    answer: result.answer,
    citations: result.citations,
  };
}

/**
 * Deep research - thorough search for complex questions
 * Uses the more capable sonar-pro model
 */
export async function perplexityDeepResearch(query: string): Promise<{
  answer: string;
  citations: string[];
  usage: { promptTokens: number; completionTokens: number };
}> {
  const result = await perplexitySearch({
    query,
    model: 'sonar-pro',
    systemPrompt: `You are a thorough research assistant. Provide comprehensive, well-structured answers with:
- Key facts and findings
- Multiple perspectives if relevant
- Clear citations for all claims
- A summary at the end`,
    returnCitations: true,
  });

  return result;
}

/**
 * Real-time news search - for current events and breaking news
 */
export async function perplexityNews(query: string, recency: 'hour' | 'day' | 'week' = 'day'): Promise<{
  answer: string;
  citations: string[];
}> {
  const result = await perplexitySearch({
    query,
    model: 'sonar',
    systemPrompt: 'Focus on the most recent and relevant news. Include dates when available. Be factual and cite sources.',
    returnCitations: true,
    searchRecency: recency,
  });

  return {
    answer: result.answer,
    citations: result.citations,
  };
}
