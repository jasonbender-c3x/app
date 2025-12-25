/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     WEB SEARCH INTEGRATION MODULE                          ║
 * ║                   Meowstik - Google Custom Search                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides web search capabilities using Google Custom Search API.
 * It enables the application to search the web and return relevant results.
 * 
 * AVAILABLE OPERATIONS:
 * - search: Perform a web search and return results with snippets
 * 
 * @module web-search
 * @requires GOOGLE_API_KEY - Environment variable for API authentication
 * @requires GOOGLE_CSE_ID - Custom Search Engine ID
 * @see https://developers.google.com/custom-search/v1/overview
 */

export interface WebSearchResult {
  success: boolean;
  content: string;
  citations: string[];
  model: string;
  error?: string;
}

export interface SearchItem {
  title: string;
  link: string;
  snippet: string;
}

export interface WebSearchOptions {
  query: string;
  maxTokens?: number;
  searchRecency?: "day" | "week" | "month" | "year";
  domains?: string[];
}

const GOOGLE_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * Perform a web search using Google Custom Search API
 * 
 * @param options - Search options including query and filters
 * @returns Search result with content and citations
 */
export async function webSearch(options: WebSearchOptions): Promise<WebSearchResult> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cseId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "google-custom-search",
      error: "GOOGLE_SEARCH_API_KEY is not configured. Please add it to your environment secrets."
    };
  }

  if (!cseId) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "google-custom-search",
      error: "GOOGLE_SEARCH_ENGINE_ID is not configured. Please add it to your environment secrets."
    };
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: cseId,
      q: options.query,
      num: "10"
    });

    // Add date restriction based on recency filter
    if (options.searchRecency) {
      const dateRestrict = getDateRestrict(options.searchRecency);
      if (dateRestrict) {
        params.append("dateRestrict", dateRestrict);
      }
    }

    // Add site search if domains specified
    if (options.domains && options.domains.length > 0) {
      const siteSearch = options.domains.join(" OR site:");
      params.set("q", `site:${siteSearch} ${options.query}`);
    }

    const response = await fetch(`${GOOGLE_SEARCH_API_URL}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        content: "",
        citations: [],
        model: "google-custom-search",
        error: `Google Search API error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json() as {
      items?: Array<{
        title: string;
        link: string;
        snippet: string;
      }>;
      searchInformation?: {
        totalResults: string;
        formattedTotalResults: string;
      };
    };

    const items = data.items || [];
    
    if (items.length === 0) {
      return {
        success: true,
        content: "No results found for your search query.",
        citations: [],
        model: "google-custom-search"
      };
    }

    // Format results into readable content
    const content = formatResults(items);
    const citations = items.map(item => item.link);

    return {
      success: true,
      content,
      citations,
      model: "google-custom-search"
    };
  } catch (error: any) {
    return {
      success: false,
      content: "",
      citations: [],
      model: "google-custom-search",
      error: `Web search failed: ${error.message}`
    };
  }
}

/**
 * Convert recency filter to Google's dateRestrict parameter
 */
function getDateRestrict(recency: "day" | "week" | "month" | "year"): string {
  switch (recency) {
    case "day":
      return "d1";
    case "week":
      return "w1";
    case "month":
      return "m1";
    case "year":
      return "y1";
    default:
      return "";
  }
}

/**
 * Format search results into readable content
 */
function formatResults(items: Array<{ title: string; link: string; snippet: string }>): string {
  let content = `Found ${items.length} results:\n\n`;
  
  items.forEach((item, index) => {
    content += `**${index + 1}. ${item.title}**\n`;
    content += `${item.snippet}\n`;
    content += `[${item.link}](${item.link})\n\n`;
  });

  return content.trim();
}

/**
 * Format search results for display in chat
 * 
 * @param result - The search result to format
 * @returns Formatted string with content and citations
 */
export function formatSearchResult(result: WebSearchResult): string {
  if (!result.success) {
    return `Search Error: ${result.error}`;
  }

  return result.content;
}
