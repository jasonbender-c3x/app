/**
 * Twilio Integration
 * 
 * Provides SMS sending/receiving and voice call capabilities.
 * Configured via environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN  
 * - TWILIO_PHONE_NUMBER
 */

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  
  if (!client) {
    client = twilio(accountSid, authToken);
  }
  
  return client;
}

export function isConfigured(): boolean {
  return !!(accountSid && authToken && twilioPhoneNumber);
}

export function getPhoneNumber(): string | undefined {
  return twilioPhoneNumber;
}

/**
 * Send an SMS message
 */
export async function sendSMS(to: string, body: string): Promise<{
  sid: string;
  status: string;
  to: string;
  from: string;
}> {
  if (!twilioPhoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER not configured");
  }

  const message = await getClient().messages.create({
    body,
    from: twilioPhoneNumber,
    to,
  });

  return {
    sid: message.sid,
    status: message.status,
    to: message.to,
    from: message.from,
  };
}

/**
 * Send an MMS message with media
 */
export async function sendMMS(to: string, body: string, mediaUrl: string): Promise<{
  sid: string;
  status: string;
  to: string;
  from: string;
}> {
  if (!twilioPhoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER not configured");
  }

  const message = await getClient().messages.create({
    body,
    from: twilioPhoneNumber,
    to,
    mediaUrl: [mediaUrl],
  });

  return {
    sid: message.sid,
    status: message.status,
    to: message.to,
    from: message.from,
  };
}

/**
 * Get message history
 */
export async function getMessages(limit: number = 20): Promise<Array<{
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: string;
  dateSent: Date | null;
}>> {
  const messages = await getClient().messages.list({ limit });

  return messages.map(msg => ({
    sid: msg.sid,
    from: msg.from,
    to: msg.to,
    body: msg.body,
    status: msg.status,
    direction: msg.direction,
    dateSent: msg.dateSent,
  }));
}

/**
 * Get a specific message by SID
 */
export async function getMessage(sid: string): Promise<{
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: string;
  dateSent: Date | null;
  errorCode: number | null;
  errorMessage: string | null;
}> {
  const msg = await getClient().messages(sid).fetch();

  return {
    sid: msg.sid,
    from: msg.from,
    to: msg.to,
    body: msg.body,
    status: msg.status,
    direction: msg.direction,
    dateSent: msg.dateSent,
    errorCode: msg.errorCode,
    errorMessage: msg.errorMessage,
  };
}

/**
 * Make an outbound voice call
 */
export async function makeCall(to: string, twimlUrl: string): Promise<{
  sid: string;
  status: string;
  to: string;
  from: string;
}> {
  if (!twilioPhoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER not configured");
  }

  const call = await getClient().calls.create({
    url: twimlUrl,
    from: twilioPhoneNumber,
    to,
  });

  return {
    sid: call.sid,
    status: call.status,
    to: call.to,
    from: call.from,
  };
}

/**
 * Make a call with TwiML directly (using say)
 */
export async function makeCallWithMessage(to: string, message: string): Promise<{
  sid: string;
  status: string;
  to: string;
  from: string;
}> {
  if (!twilioPhoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER not configured");
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(message)}</Say>
</Response>`;

  const call = await getClient().calls.create({
    twiml,
    from: twilioPhoneNumber,
    to,
  });

  return {
    sid: call.sid,
    status: call.status,
    to: call.to,
    from: call.from,
  };
}

/**
 * Get call history
 */
export async function getCalls(limit: number = 20): Promise<Array<{
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration: string;
  startTime: Date | null;
  endTime: Date | null;
}>> {
  const calls = await getClient().calls.list({ limit });

  return calls.map(call => ({
    sid: call.sid,
    from: call.from,
    to: call.to,
    status: call.status,
    direction: call.direction,
    duration: call.duration,
    startTime: call.startTime,
    endTime: call.endTime,
  }));
}

/**
 * Get account balance
 */
export async function getBalance(): Promise<{
  balance: string;
  currency: string;
}> {
  const balance = await getClient().balance.fetch();
  
  return {
    balance: balance.balance,
    currency: balance.currency,
  };
}

/**
 * Validate Twilio webhook signature
 */
export function validateWebhookSignature(
  signature: string, 
  url: string, 
  params: Record<string, string>
): boolean {
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN not configured");
  }
  
  return twilio.validateRequest(authToken, signature, url, params);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default {
  isConfigured,
  getPhoneNumber,
  sendSMS,
  sendMMS,
  getMessages,
  getMessage,
  makeCall,
  makeCallWithMessage,
  getCalls,
  getBalance,
  validateWebhookSignature,
};
