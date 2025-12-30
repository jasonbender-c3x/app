/**
 * Twilio API Routes
 * 
 * Routes for SMS, voice calls, and webhook handling
 */

import { Router, Request, Response } from "express";
import * as twilioIntegration from "../integrations/twilio";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;

const router = Router();

/**
 * Check Twilio configuration status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const configured = twilioIntegration.isConfigured();
    const phoneNumber = twilioIntegration.getPhoneNumber();
    
    if (!configured) {
      return res.json({ 
        configured: false, 
        message: "Twilio credentials not configured" 
      });
    }

    const balance = await twilioIntegration.getBalance();
    
    res.json({
      configured: true,
      phoneNumber,
      balance: balance.balance,
      currency: balance.currency,
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to check Twilio status" 
    });
  }
});

/**
 * Send SMS
 */
router.post("/sms/send", async (req: Request, res: Response) => {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: "Missing 'to' or 'body' field" });
    }

    const result = await twilioIntegration.sendSMS(to, body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to send SMS" 
    });
  }
});

/**
 * Send MMS with media
 */
router.post("/mms/send", async (req: Request, res: Response) => {
  try {
    const { to, body, mediaUrl } = req.body;

    if (!to || !body || !mediaUrl) {
      return res.status(400).json({ error: "Missing 'to', 'body', or 'mediaUrl' field" });
    }

    const result = await twilioIntegration.sendMMS(to, body, mediaUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to send MMS" 
    });
  }
});

/**
 * Get message history
 */
router.get("/messages", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await twilioIntegration.getMessages(limit);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get messages" 
    });
  }
});

/**
 * Get specific message
 */
router.get("/messages/:sid", async (req: Request, res: Response) => {
  try {
    const { sid } = req.params;
    const message = await twilioIntegration.getMessage(sid);
    res.json(message);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get message" 
    });
  }
});

/**
 * Make a voice call with a message
 */
router.post("/call", async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: "Missing 'to' or 'message' field" });
    }

    const result = await twilioIntegration.makeCallWithMessage(to, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to make call" 
    });
  }
});

/**
 * Get call history
 */
router.get("/calls", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const calls = await twilioIntegration.getCalls(limit);
    res.json(calls);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get calls" 
    });
  }
});

/**
 * Webhook for incoming SMS
 */
router.post("/webhook/sms", async (req: Request, res: Response) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    console.log(`[Twilio] Incoming SMS from ${From}: ${Body}`);
    
    // Create a TwiML response
    const twiml = new MessagingResponse();
    twiml.message("Thanks for your message! The AI is processing your request.");
    
    // TODO: Forward message to AI for processing
    // This would integrate with the chat system
    
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio] SMS webhook error:", error);
    res.status(500).send("Error processing SMS");
  }
});

/**
 * Webhook for incoming voice calls
 */
router.post("/webhook/voice", async (req: Request, res: Response) => {
  try {
    const { From, CallSid } = req.body;
    
    console.log(`[Twilio] Incoming call from ${From}, SID: ${CallSid}`);
    
    // Create a TwiML response
    const twiml = new VoiceResponse();
    
    // Greet the caller
    twiml.say({ voice: "Polly.Joanna" }, 
      "Hello! Welcome to Meowstik AI. Please hold while I connect you to our AI assistant."
    );
    
    // TODO: Connect to AI voice assistant via WebSocket stream
    // For now, just play a message and hang up
    twiml.say({ voice: "Polly.Joanna" },
      "The AI voice assistant feature is coming soon. Thank you for calling!"
    );
    
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("[Twilio] Voice webhook error:", error);
    res.status(500).send("Error processing call");
  }
});

/**
 * Webhook for call status updates
 */
router.post("/webhook/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`[Twilio] Call ${CallSid} status: ${CallStatus}, duration: ${CallDuration}s`);
    
    res.sendStatus(200);
  } catch (error) {
    console.error("[Twilio] Status webhook error:", error);
    res.status(500).send("Error processing status");
  }
});

export default router;
