/**
 * Google OAuth2 Authentication Routes
 */

import { Router, Request, Response } from 'express';
import { getAuthUrl, handleCallback, isAuthenticated, revokeAccess, getTokens, initializeFromDatabase } from '../integrations/google-auth';

const router = Router();

router.get('/google', (req: Request, res: Response) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  try {
    await handleCallback(code);
    res.redirect('/?auth=success');
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect('/?auth=error');
  }
});

router.get('/google/status', async (req: Request, res: Response) => {
  const authenticated = await isAuthenticated();
  const tokens = await getTokens();
  res.json({ 
    authenticated,
    hasTokens: tokens !== null
  });
});

router.post('/google/revoke', async (req: Request, res: Response) => {
  await revokeAccess();
  res.json({ success: true });
});

export default router;
