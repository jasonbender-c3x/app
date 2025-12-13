/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       GMAIL INTEGRATION MODULE                            ║
 * ║                    Nebula Chat - Email Service                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Gmail API v1 for email operations.
 * It enables the application to list, read, send, and search emails
 * in the user's Gmail account.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  EMAIL STRUCTURE                                                            │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   ┌─────────────────────────────────────────────────────────────┐          │
 * │   │  Email Message                                              │          │
 * │   ├─────────────────────────────────────────────────────────────┤          │
 * │   │  Headers:                                                   │          │
 * │   │    - From: sender@example.com                               │          │
 * │   │    - To: recipient@example.com                              │          │
 * │   │    - Subject: Email subject line                            │          │
 * │   │    - Date: Fri, 01 Jan 2025 12:00:00 GMT                    │          │
 * │   ├─────────────────────────────────────────────────────────────┤          │
 * │   │  Body:                                                      │          │
 * │   │    Plain text or HTML content                               │          │
 * │   │    (Base64 encoded in API)                                  │          │
 * │   └─────────────────────────────────────────────────────────────┘          │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * AVAILABLE OPERATIONS:
 * - listEmails: List recent emails from inbox
 * - getEmail: Get full email content by ID
 * - sendEmail: Compose and send a new email
 * - getLabels: List all Gmail labels
 * - searchEmails: Search emails using Gmail query syntax
 * 
 * @module gmail
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/gmail/api/reference/rest
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google APIs client library.
 * Provides access to all Google API services including Gmail.
 */
import { google } from 'googleapis';
import { getAuthenticatedClient } from './google-auth';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a fresh Gmail API client with current credentials.
 * Uses custom OAuth2 authentication via google-auth module with gmail.readonly scope.
 * 
 * @async
 * @returns {Promise<gmail_v1.Gmail>} Authenticated Gmail API client
 * @throws {Error} If not authenticated with Google
 */
export async function getUncachableGmailClient() {
  const auth = await getAuthenticatedClient();
  return google.gmail({ version: 'v1', auth });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EMAIL LISTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists recent emails from the user's mailbox.
 * 
 * This function performs two API calls per email:
 * 1. First lists message IDs matching the criteria
 * 2. Then fetches metadata for each message
 * 
 * The emails are enriched with header information for display.
 * 
 * @async
 * @param {number} [maxResults=20] - Maximum number of emails to return
 * @param {string[]} [labelIds=['INBOX']] - Labels to filter by
 * @returns {Promise<Object[]>} Array of email summary objects
 * 
 * @example
 * // List 20 recent inbox emails
 * const emails = await listEmails();
 * 
 * @example
 * // List 50 emails from SENT folder
 * const sent = await listEmails(50, ['SENT']);
 */
export async function listEmails(maxResults = 20, labelIds = ['INBOX']) {
  const gmail = await getUncachableGmailClient();
  
  // Step 1: Get list of message IDs
  const response = await gmail.users.messages.list({
    userId: 'me',  // 'me' refers to the authenticated user
    maxResults,
    labelIds  // Filter by label (INBOX, SENT, etc.)
  });
  
  // Return empty array if no messages found
  if (!response.data.messages) {
    return [];
  }

  // Step 2: Fetch metadata for each message in parallel
  // This enriches each message with header information
  const emails = await Promise.all(
    response.data.messages.map(async (msg) => {
      // Get message with metadata format (headers only, no body)
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',  // Fetch only metadata, not full content
        metadataHeaders: ['From', 'To', 'Subject', 'Date']  // Specific headers to include
      });
      
      // Helper function to extract header values
      const headers = email.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
      
      // Return normalized email object
      return {
        id: msg.id,
        threadId: msg.threadId,        // Thread ID for conversation grouping
        snippet: email.data.snippet,    // Preview text snippet
        from: getHeader('From'),        // Sender
        to: getHeader('To'),            // Recipient(s)
        subject: getHeader('Subject'),  // Subject line
        date: getHeader('Date'),        // Send date
        labelIds: email.data.labelIds   // Applied labels
      };
    })
  );
  
  return emails;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EMAIL READING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves the full content of a specific email.
 * 
 * This function fetches the complete email including:
 * - All headers
 * - Full body content (decoded from Base64)
 * 
 * BODY EXTRACTION LOGIC:
 * Gmail stores email bodies in different locations depending on the message:
 * 1. Simple emails: Body in payload.body.data
 * 2. Multipart emails: Body in payload.parts[].body.data
 * 
 * @async
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Full email object with decoded body
 * @throws {Error} If message not found
 * 
 * @example
 * const email = await getEmail('18abc123def');
 * console.log(email.subject, email.body);
 */
export async function getEmail(messageId: string) {
  const gmail = await getUncachableGmailClient();
  
  // Fetch full message content
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'  // Get complete message with body
  });
  
  // Extract headers
  const headers = response.data.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
  
  // ─────────────────────────────────────────────────────────────────────────
  // Decode email body from Base64
  // Gmail stores body content as Base64-encoded strings
  // ─────────────────────────────────────────────────────────────────────────
  let body = '';
  
  // Case 1: Simple email with body directly in payload
  if (response.data.payload?.body?.data) {
    body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
  } 
  // Case 2: Multipart email with body in parts array
  else if (response.data.payload?.parts) {
    // Find the text/plain or text/html part
    const textPart = response.data.payload.parts.find(
      p => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }
  
  // Return normalized email object with decoded body
  return {
    id: response.data.id,
    threadId: response.data.threadId,
    snippet: response.data.snippet,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body,  // Decoded body content
    labelIds: response.data.labelIds
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EMAIL SENDING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sends a new email.
 * 
 * This function constructs a raw email message in RFC 2822 format,
 * encodes it in Base64, and sends it via the Gmail API.
 * 
 * MESSAGE FORMAT:
 * The email is constructed as a multi-line string with:
 * - MIME headers (Content-Type, MIME-Version)
 * - Address headers (To)
 * - Subject header
 * - Empty line separator
 * - Body content
 * 
 * BASE64 URL-SAFE ENCODING:
 * Gmail requires URL-safe Base64 encoding:
 * - '+' replaced with '-'
 * - '/' replaced with '_'
 * - Trailing '=' padding removed
 * 
 * @async
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} body - Email body (can be HTML)
 * @returns {Promise<gmail_v1.Schema$Message>} Sent message data
 * @throws {Error} If send fails
 * 
 * @example
 * const result = await sendEmail(
 *   'recipient@example.com',
 *   'Hello!',
 *   '<h1>Welcome!</h1><p>This is a test email.</p>'
 * );
 */
export async function sendEmail(to: string, subject: string, body: string) {
  const gmail = await getUncachableGmailClient();
  
  // ─────────────────────────────────────────────────────────────────────────
  // Construct RFC 2822 format email message
  // ─────────────────────────────────────────────────────────────────────────
  const message = [
    'Content-Type: text/html; charset=utf-8',  // Supports HTML content
    'MIME-Version: 1.0',                        // MIME version header
    `To: ${to}`,                                // Recipient
    `Subject: ${subject}`,                      // Subject line
    '',                                         // Empty line before body
    body                                        // Email body content
  ].join('\n');
  
  // ─────────────────────────────────────────────────────────────────────────
  // Encode message as URL-safe Base64
  // Gmail API requires this specific encoding format
  // ─────────────────────────────────────────────────────────────────────────
  const encodedMessage = Buffer.from(message)
    .toString('base64')              // Standard Base64
    .replace(/\+/g, '-')             // Replace + with -
    .replace(/\//g, '_')             // Replace / with _
    .replace(/=+$/, '');             // Remove trailing padding
  
  // Send the email via Gmail API
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage  // Base64-encoded message
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: LABEL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves all labels from the user's Gmail account.
 * 
 * Labels are used to categorize and organize emails.
 * Includes both system labels (INBOX, SENT, SPAM) and user-created labels.
 * 
 * @async
 * @returns {Promise<gmail_v1.Schema$Label[]>} Array of label objects
 * 
 * @example
 * const labels = await getLabels();
 * labels.forEach(label => console.log(label.name));
 */
export async function getLabels() {
  const gmail = await getUncachableGmailClient();
  
  const response = await gmail.users.labels.list({
    userId: 'me'
  });
  
  return response.data.labels || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EMAIL SEARCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Searches emails using Gmail query syntax.
 * 
 * GMAIL QUERY SYNTAX EXAMPLES:
 * - from:example@gmail.com - Emails from specific sender
 * - to:me - Emails sent to you
 * - subject:meeting - Emails with 'meeting' in subject
 * - is:unread - Unread emails
 * - has:attachment - Emails with attachments
 * - after:2024/01/01 - Emails after date
 * - larger:10M - Emails larger than 10MB
 * - "exact phrase" - Emails containing exact phrase
 * 
 * Multiple operators can be combined:
 * - from:boss@work.com is:unread has:attachment
 * 
 * @async
 * @param {string} query - Gmail search query
 * @param {number} [maxResults=20] - Maximum results to return
 * @returns {Promise<Object[]>} Array of matching email summaries
 * 
 * @example
 * // Find unread emails from a specific sender
 * const emails = await searchEmails('from:newsletter@company.com is:unread');
 * 
 * @see https://support.google.com/mail/answer/7190
 */
export async function searchEmails(query: string, maxResults = 20) {
  const gmail = await getUncachableGmailClient();
  
  // Search for messages matching the query
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,      // Gmail search query
    maxResults
  });
  
  // Return empty array if no messages found
  if (!response.data.messages) {
    return [];
  }

  // Fetch metadata for each matching message
  // Same enrichment logic as listEmails
  const emails = await Promise.all(
    response.data.messages.map(async (msg) => {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      });
      
      const headers = email.data.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';
      
      return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: email.data.snippet,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        labelIds: email.data.labelIds
      };
    })
  );
  
  return emails;
}
