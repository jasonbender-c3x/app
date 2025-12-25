/**
 * Tavily API Integration
 * Deep research and Q&A search optimized for AI agents
 * Docs: https://docs.tavily.com/
 */

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  response_time: number;
}

interface TavilySearchParams {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
}

/**
 * Search the web using Tavily API
 * Returns structured results optimized for RAG and AI agents
 */
export async function tavilySearch(params: TavilySearchParams): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured. Please add it to your secrets.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: params.query,
      search_depth: params.searchDepth || 'basic',
      max_results: params.maxResults || 5,
      include_answer: params.includeAnswer ?? true,
      include_domains: params.includeDomains || [],
      exclude_domains: params.excludeDomains || [],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Quick Q&A search - returns a direct answer with sources
 * Best for simple factual questions
 */
export async function tavilyQnA(query: string): Promise<{ answer: string; sources: TavilySearchResult[] }> {
  const result = await tavilySearch({
    query,
    includeAnswer: true,
    searchDepth: 'basic',
    maxResults: 3,
  });

  return {
    answer: result.answer || 'No direct answer found. See sources for more information.',
    sources: result.results,
  };
}

/**
 * Deep research - more thorough search with more results
 * Best for complex research questions
 */
export async function tavilyDeepResearch(query: string, maxResults: number = 10): Promise<TavilySearchResponse> {
  return await tavilySearch({
    query,
    searchDepth: 'advanced',
    maxResults,
    includeAnswer: true,
  });
}

/**
 * Get search context for RAG - returns condensed content for LLM context
 */
export async function tavilyGetContext(query: string, maxTokens: number = 4000): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured. Please add it to your secrets.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: 5,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${error}`);
  }

  const data: TavilySearchResponse = await response.json();
  
  let context = '';
  if (data.answer) {
    context += `Answer: ${data.answer}\n\n`;
  }
  
  context += 'Sources:\n';
  for (const result of data.results) {
    context += `- ${result.title}: ${result.content.slice(0, 500)}...\n  URL: ${result.url}\n\n`;
  }

  return context.slice(0, maxTokens * 4);
}
