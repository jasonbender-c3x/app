import { Router, Request, Response, NextFunction } from "express";
import { searchWeb, scrapeUrl, searchAndScrape } from "../integrations/web-scraper";

const router = Router();

router.post("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, maxResults = 10 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "Query is required and must be a string" 
      });
    }
    
    const result = await searchWeb(query, maxResults);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/scrape", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "URL is required and must be a string" 
      });
    }
    
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid URL format" 
      });
    }
    
    const result = await scrapeUrl(url);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/search-and-scrape", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, maxResults = 5, scrapeFirst = 3 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "Query is required and must be a string" 
      });
    }
    
    const result = await searchAndScrape(query, maxResults, scrapeFirst);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
