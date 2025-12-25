/**
 * Browser Scraper Integration
 * 
 * Playwright-based browser scraping for JavaScript-heavy sites
 * that require full browser rendering to extract content.
 */

import { chromium, Browser, Page } from "playwright";

export interface BrowserScrapeResult {
  success: boolean;
  url: string;
  title: string;
  content: string;
  error?: string;
}

export interface BrowserSearchResult {
  success: boolean;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  error?: string;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

/**
 * Scrape a URL using a real browser (Playwright)
 * Best for JavaScript-heavy sites that need rendering
 */
export async function browserScrape(url: string, timeout: number = 30000): Promise<BrowserScrapeResult> {
  let page: Page | null = null;
  
  try {
    const browserInstance = await getBrowser();
    const context = await browserInstance.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    await page.goto(url, { 
      timeout, 
      waitUntil: 'networkidle' 
    });
    
    await page.waitForTimeout(1000);
    
    const title = await page.title();
    
    const content = await page.evaluate(() => {
      const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 
        'aside', 'iframe', 'noscript', '.ad', '.advertisement',
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
      ];
      
      removeSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.remove());
      });
      
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.post', '.article'];
      let mainContent: Element | null = null;
      
      for (const selector of mainSelectors) {
        mainContent = document.querySelector(selector);
        if (mainContent) break;
      }
      
      const source = mainContent || document.body;
      
      const paragraphs: string[] = [];
      
      source.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        const text = (el as HTMLElement).innerText.trim();
        if (text.length > 5) {
          paragraphs.push(`## ${text}`);
        }
      });
      
      source.querySelectorAll('p').forEach(el => {
        const text = (el as HTMLElement).innerText.trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });
      
      source.querySelectorAll('li').forEach(el => {
        const text = (el as HTMLElement).innerText.trim();
        if (text.length > 10) {
          paragraphs.push(`• ${text}`);
        }
      });
      
      if (paragraphs.length > 0) {
        return paragraphs.join('\n\n').slice(0, 50000);
      }
      
      return source.textContent?.replace(/\s+/g, ' ').trim().slice(0, 50000) || '';
    });
    
    await context.close();
    
    return {
      success: true,
      url,
      title,
      content
    };
  } catch (error: any) {
    return {
      success: false,
      url,
      title: '',
      content: '',
      error: error.message
    };
  }
}

/**
 * Perform a DuckDuckGo search using Playwright
 * Useful for when the HTML scraper doesn't work well
 */
export async function browserSearch(query: string, maxResults: number = 10): Promise<BrowserSearchResult> {
  let page: Page | null = null;
  
  try {
    const browserInstance = await getBrowser();
    const context = await browserInstance.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { timeout: 30000, waitUntil: 'networkidle' });
    
    await page.waitForTimeout(2000);
    
    const results = await page.evaluate((max: number) => {
      const items: Array<{ title: string; url: string; snippet: string }> = [];
      
      const links = document.querySelectorAll('a[data-testid="result-title-a"]');
      const snippets = document.querySelectorAll('[data-result="snippet"]');
      
      links.forEach((link, index) => {
        if (items.length >= max) return;
        
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href;
        const title = anchor.textContent?.trim() || '';
        
        if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) {
          items.push({
            title: title || 'Untitled',
            url: href,
            snippet: (snippets[index] as HTMLElement)?.innerText?.trim() || ''
          });
        }
      });
      
      if (items.length === 0) {
        const allLinks = document.querySelectorAll('a[href^="http"]');
        const seenUrls = new Set<string>();
        
        allLinks.forEach(link => {
          if (items.length >= max) return;
          
          const anchor = link as HTMLAnchorElement;
          const href = anchor.href;
          
          if (href && 
              !href.includes('duckduckgo.com') && 
              !seenUrls.has(href)) {
            seenUrls.add(href);
            items.push({
              title: anchor.textContent?.trim() || new URL(href).hostname,
              url: href,
              snippet: ''
            });
          }
        });
      }
      
      return items;
    }, maxResults);
    
    await context.close();
    
    return {
      success: true,
      results
    };
  } catch (error: any) {
    return {
      success: false,
      results: [],
      error: error.message
    };
  }
}

/**
 * Close the browser instance (for cleanup)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
