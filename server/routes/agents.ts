/**
 * =============================================================================
 * AGENT IDENTITY ROUTES
 * =============================================================================
 * 
 * API endpoints for managing agent identities and viewing agent activity logs.
 * 
 * Routes:
 * - GET    /api/agents              - List all agents
 * - GET    /api/agents/:id          - Get agent by ID
 * - POST   /api/agents              - Create new agent
 * - PATCH  /api/agents/:id          - Update agent
 * - GET    /api/agents/:id/activity - Get activity logs for agent
 * - GET    /api/agents/activity     - Get recent activity across all agents
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertAgentIdentitySchema, insertAgentActivityLogSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/agents
 * List all agent identities
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const enabledOnly = req.query.enabled === 'true';
    
    const agents = enabledOnly 
      ? await storage.getEnabledAgents()
      : await storage.getAgentIdentities();
    
    res.json({ agents });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents', message: error.message });
  }
});

/**
 * GET /api/agents/:id
 * Get a specific agent by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agent = await storage.getAgentById(id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({ agent });
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent', message: error.message });
  }
});

/**
 * POST /api/agents
 * Create a new agent identity
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const result = insertAgentIdentitySchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid agent data', 
        details: result.error.errors 
      });
    }
    
    // Check if agent with same name already exists
    const existing = await storage.getAgentByName(result.data.name);
    if (existing) {
      return res.status(409).json({ 
        error: 'Agent with this name already exists' 
      });
    }
    
    const agent = await storage.createAgentIdentity(result.data);
    res.status(201).json({ agent });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent', message: error.message });
  }
});

/**
 * PATCH /api/agents/:id
 * Update an agent identity
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const existing = await storage.getAgentById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Validate update data (partial schema)
    const result = insertAgentIdentitySchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid update data', 
        details: result.error.errors 
      });
    }
    
    const agent = await storage.updateAgentIdentity(id, result.data);
    res.json({ agent });
  } catch (error: any) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent', message: error.message });
  }
});

/**
 * GET /api/agents/:id/activity
 * Get activity logs for a specific agent
 */
router.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    // Check if agent exists
    const agent = await storage.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const activities = await storage.getAgentActivity(id, limit);
    res.json({ agent, activities });
  } catch (error: any) {
    console.error('Error fetching agent activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity', message: error.message });
  }
});

/**
 * GET /api/agents/activity/recent
 * Get recent activity across all agents
 */
router.get('/activity/recent', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await storage.getRecentAgentActivity(limit);
    res.json({ activities });
  } catch (error: any) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity', message: error.message });
  }
});

/**
 * POST /api/agents/:id/activity
 * Log a new activity for an agent (typically used by internal services)
 */
router.post('/:id/activity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const agent = await storage.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const result = insertAgentActivityLogSchema.safeParse({
      ...req.body,
      agentId: id
    });
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid activity data', 
        details: result.error.errors 
      });
    }
    
    const activity = await storage.logAgentActivity(result.data);
    res.status(201).json({ activity });
  } catch (error: any) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity', message: error.message });
  }
});

export default router;
