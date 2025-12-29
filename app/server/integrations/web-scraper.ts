/**
 * Web Scraping and Search Integration
 * 
 * This module provides web scraping capabilities using DuckDuckGo HTML search
 * and content extraction from web pages.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

export interface WebSearchResponse {
  success: boolean;
  results: SearchResult[];
  error?: string;
}

export interface ScrapedPageResponse {
  success: boolean;
  data: ScrapeResult;
  error?: string;
}

/**
 * Search the web using DuckDuckGo HTML
 * This is a free alternative that doesn't require API keys
 */
export async function searchWeb(query: string, maxResults: number = 10): Promise<WebSearchResponse> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      return {
        success: false,
        results: [],
        error: `Search request failed with status ${response.status}`
      };
    }

    const html = await response.text();
    const results = parseSearchResults(html, maxResults);
    
    return {
      success: true,
      results
    };
  } catch (error: any) {
    return {
      success: false,
      results: [],
      error: `Search failed: ${error.message}`
    };
  }
}

/**
 * Parse search results from DuckDuckGo HTML
 */
function parseSearchResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  
  // Match result blocks - DuckDuckGo uses result__a for links
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
  
  // Alternative parsing approach - find result divs
  const resultBlockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  
  let match;
  let snippetMatches: string[] = [];
  
  // Extract snippets
  while ((match = snippetRegex.exec(html)) !== null && snippetMatches.length < maxResults) {
    const snippet = cleanHtml(match[1]);
    snippetMatches.push(snippet);
  }
  
  // Extract links and titles
  let linkIndex = 0;
  while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
    let url = match[1];
    const title = cleanHtml(match[2]);
    
    // DuckDuckGo wraps URLs in their redirect - extract actual URL
    if (url.includes('uddg=')) {
      const urlMatch = url.match(/uddg=([^&]+)/);
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
      }
    }
    
    // Skip ad links and internal DuckDuckGo links
    if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
      results.push({
        title: title || 'Untitled',
        url: url,
        snippet: snippetMatches[linkIndex] || ''
      });
    }
    linkIndex++;
  }
  
  // If the above regex didn't work well, try a simpler approach
  if (results.length === 0) {
    // Try to find URLs with href patterns
    const simpleUrlRegex = /href="(https?:\/\/[^"]+)"/gi;
    const seenUrls = new Set<string>();
    
    while ((match = simpleUrlRegex.exec(html)) !== null && results.length < maxResults) {
      let url = match[1];
      
      // Handle DuckDuckGo redirect URLs
      if (url.includes('uddg=')) {
        const urlMatch = url.match(/uddg=([^&]+)/);
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1]);
        }
      }
      
      // Skip internal links and duplicates
      if (url.startsWith('http') && 
          !url.includes('duckduckgo.com') && 
          !seenUrls.has(url)) {
        seenUrls.add(url);
        results.push({
          title: extractDomainName(url),
          url: url,
          snippet: ''
        });
      }
    }
  }
  
  return results;
}

/**
 * Clean HTML tags from text
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract domain name from URL for fallback title
 */
function extractDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Scrape content from a URL
 */
export async function scrapeUrl(url: string): Promise<ScrapedPageResponse> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!response.ok) {
      return {
        success: false,
        data: {
          url,
          title: '',
          content: '',
          success: false,
          error: `Failed to fetch: ${response.status} ${response.statusText}`
        },
        error: `Failed to fetch: ${response.status}`
      };
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Only process HTML content
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        success: false,
        data: {
          url,
          title: '',
          content: '',
          success: false,
          error: 'URL does not return HTML content'
        },
        error: 'Not an HTML page'
      };
    }

    const html = await response.text();
    const { title, content } = extractContent(html);
    
    return {
      success: true,
      data: {
        url,
        title,
        content,
        success: true
      }
    };
  } catch (error: any) {
    const errorMessage = error.name === 'TimeoutError' 
      ? 'Request timed out after 15 seconds'
      : error.message;
      
    return {
      success: false,
      data: {
        url,
        title: '',
        content: '',
        success: false,
        error: errorMessage
      },
      error: errorMessage
    };
  }
}

/**
 * Extract meaningful content from HTML
 */
function extractContent(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? cleanHtml(titleMatch[1]) : 'Untitled';
  
  // Remove script and style tags
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Try to extract main content areas
  const mainContentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  let mainContent = '';
  for (const pattern of mainContentPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      mainContent = matches.join('\n');
      break;
    }
  }
  
  // If no main content found, use body
  if (!mainContent) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    mainContent = bodyMatch ? bodyMatch[1] : content;
  }
  
  // Extract paragraphs and headings for cleaner content
  const paragraphs: string[] = [];
  
  // Get headings
  const headingRegex = /<h[1-6][^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/h[1-6]>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(mainContent)) !== null) {
    const text = cleanHtml(headingMatch[1]).trim();
    if (text.length > 5) {
      paragraphs.push(`## ${text}`);
    }
  }
  
  // Get paragraphs
  const pRegex = /<p[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(mainContent)) !== null) {
    const text = cleanHtml(pMatch[1]).trim();
    if (text.length > 20) { // Skip very short paragraphs
      paragraphs.push(text);
    }
  }
  
  // Get list items
  const liRegex = /<li[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(mainContent)) !== null) {
    const text = cleanHtml(liMatch[1]).trim();
    if (text.length > 10) {
      paragraphs.push(`• ${text}`);
    }
  }
  
  // If we got paragraphs, use them; otherwise fall back to cleaned full content
  if (paragraphs.length > 0) {
    return {
      title,
      content: paragraphs.join('\n\n').slice(0, 50000) // Limit to 50k chars
    };
  }
  
  // Fallback: clean all HTML and extract text
  const cleanedContent = cleanHtml(mainContent)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000);
  
  return {
    title,
    content: cleanedContent
  };
}

/**
 * Search and scrape - combines search with content extraction
 */
export async function searchAndScrape(
  query: string, 
  maxResults: number = 5,
  scrapeFirst: number = 3
): Promise<{
  success: boolean;
  searchResults: SearchResult[];
  scrapedContent: ScrapeResult[];
  error?: string;
}> {
  // First, search
  const searchResponse = await searchWeb(query, maxResults);
  
  if (!searchResponse.success) {
    return {
      success: false,
      searchResults: [],
      scrapedContent: [],
      error: searchResponse.error
    };
  }
  
  // Then scrape the top results
  const urlsToScrape = searchResponse.results.slice(0, scrapeFirst);
  const scrapedContent: ScrapeResult[] = [];
  
  // Scrape in parallel with concurrency limit
  const scrapePromises = urlsToScrape.map(async (result) => {
    const scraped = await scrapeUrl(result.url);
    return {
      url: result.url,
      title: scraped.data.title || result.title,
      content: scraped.data.content,
      success: scraped.success,
      error: scraped.error
    };
  });
  
  const results = await Promise.allSettled(scrapePromises);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      scrapedContent.push(result.value);
    }
  }
  
  return {
    success: true,
    searchResults: searchResponse.results,
    scrapedContent
  };
}
