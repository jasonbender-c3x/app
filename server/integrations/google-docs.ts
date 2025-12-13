/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GOOGLE DOCS INTEGRATION MODULE                         ║
 * ║                  Nebula Chat - Document Service                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Google Docs API v1 for document operations.
 * It enables the application to read, create, and modify Google Docs documents.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  DOCUMENT STRUCTURE                                                         │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   ┌─────────────────────────────────────────────────────────────┐          │
 * │   │  Google Doc                                                  │          │
 * │   ├─────────────────────────────────────────────────────────────┤          │
 * │   │  - documentId: Unique identifier                            │          │
 * │   │  - title: Document title                                    │          │
 * │   │  - body: Document body containing:                          │          │
 * │   │      └── content[]: Array of structural elements            │          │
 * │   │            └── paragraph:                                   │          │
 * │   │                  └── elements[]:                            │          │
 * │   │                        └── textRun: { content: "text" }     │          │
 * │   └─────────────────────────────────────────────────────────────┘          │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * TEXT INDEXING:
 * Google Docs uses a 1-based character index for positioning text.
 * The index starts at 1 and includes all characters (including newlines).
 * When inserting text, you specify the index where the text should appear.
 * 
 * AVAILABLE OPERATIONS:
 * - listDocuments: List user's Google Docs (uses Drive API)
 * - getDocument: Get full document structure
 * - getDocumentText: Extract plain text content
 * - createDocument: Create a new empty document
 * - appendText: Add text to end of document
 * - replaceText: Find and replace text
 * 
 * @module google-docs
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/docs/api/reference/rest
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google APIs client library.
 * Provides access to all Google API services including Docs and Drive.
 */
import { google } from 'googleapis';
import { getAuthenticatedClient, isAuthenticated } from './google-auth';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CLIENT FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a fresh Google Docs API client with current credentials.
 * Uses custom OAuth2 authentication via google-auth module.
 * 
 * @async
 * @returns {Promise<docs_v1.Docs>} Authenticated Docs API client
 * @throws {Error} If not authenticated with Google
 * 
 * @example
 * const docs = await getUncachableGoogleDocsClient();
 * const doc = await docs.documents.get({ documentId: 'abc123' });
 */
export async function getUncachableGoogleDocsClient() {
  const auth = await getAuthenticatedClient();
  return google.docs({ version: 'v1', auth });
}

/**
 * Creates a Google Drive client for listing documents.
 * Uses custom OAuth2 authentication via google-auth module.
 * 
 * @private
 * @async
 * @returns {Promise<drive_v3.Drive>} Authenticated Drive API client
 */
async function getDriveClient() {
  const auth = await getAuthenticatedClient();
  return google.drive({ version: 'v3', auth });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: DOCUMENT RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves the full structure of a Google Doc.
 * 
 * Returns the complete document including:
 * - documentId: Unique identifier
 * - title: Document title
 * - body: Content structure with paragraphs, tables, etc.
 * - namedStyles: Style definitions
 * - revisionId: Current revision
 * 
 * @async
 * @param {string} documentId - Google Docs document ID
 * @returns {Promise<docs_v1.Schema$Document>} Full document object
 * @throws {Error} If document not found or access denied
 * 
 * @example
 * const doc = await getDocument('1abc123def456');
 * console.log(doc.title);
 */
export async function getDocument(documentId: string) {
  const docs = await getUncachableGoogleDocsClient();
  
  const response = await docs.documents.get({
    documentId
  });
  
  return response.data;
}

/**
 * Extracts plain text content from a Google Doc.
 * 
 * This function traverses the document structure and extracts
 * all text content from paragraphs, concatenating into a single string.
 * 
 * DOCUMENT STRUCTURE TRAVERSAL:
 * document.body.content[] -> paragraph.elements[] -> textRun.content
 * 
 * @async
 * @param {string} documentId - Google Docs document ID
 * @returns {Promise<{documentId: string, title: string, text: string}>} 
 *   Document metadata and extracted text
 * 
 * @example
 * const { title, text } = await getDocumentText('1abc123');
 * console.log('Document:', title);
 * console.log('Content:', text);
 */
export async function getDocumentText(documentId: string) {
  // First get the full document structure
  const doc = await getDocument(documentId);
  let text = '';
  
  // Traverse document body content
  if (doc.body?.content) {
    for (const element of doc.body.content) {
      // Check if element is a paragraph
      if (element.paragraph?.elements) {
        // Extract text from each text run in the paragraph
        for (const el of element.paragraph.elements) {
          if (el.textRun?.content) {
            text += el.textRun.content;
          }
        }
      }
    }
  }
  
  return { documentId: doc.documentId, title: doc.title, text };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: DOCUMENT CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a new Google Doc with the specified title.
 * 
 * The document is created empty. Use appendText to add content.
 * 
 * @async
 * @param {string} title - Title for the new document
 * @returns {Promise<docs_v1.Schema$Document>} Created document object
 * 
 * @example
 * const doc = await createDocument('My New Document');
 * console.log('Created:', doc.documentId);
 */
export async function createDocument(title: string) {
  const docs = await getUncachableGoogleDocsClient();
  
  const response = await docs.documents.create({
    requestBody: {
      title
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: DOCUMENT MODIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Appends text to the end of a document.
 * 
 * This function:
 * 1. Gets the current document to find the end index
 * 2. Inserts text at position (endIndex - 1)
 * 
 * INDEX CALCULATION:
 * - endIndex is the position after the last character
 * - We insert at (endIndex - 1) to place text before the final newline
 * - Google Docs always has at least one character (the trailing newline)
 * 
 * @async
 * @param {string} documentId - Document to append to
 * @param {string} text - Text to append
 * @returns {Promise<docs_v1.Schema$BatchUpdateDocumentResponse>} Update response
 * 
 * @example
 * await appendText('1abc123', '\n\nNew paragraph added at the end.');
 */
export async function appendText(documentId: string, text: string) {
  const docs = await getUncachableGoogleDocsClient();
  
  // Get current document to find the end position
  const doc = await docs.documents.get({ documentId });
  
  // Get the end index from the last content element
  // Default to 1 if document is empty
  const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;
  
  // Insert text at the end (just before the final newline character)
  const response = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        insertText: {
          location: {
            index: endIndex - 1  // Insert before the trailing newline
          },
          text
        }
      }]
    }
  });
  
  return response.data;
}

/**
 * Finds and replaces all occurrences of text in a document.
 * 
 * Uses case-sensitive matching. Replaces ALL occurrences of the
 * search text throughout the entire document.
 * 
 * @async
 * @param {string} documentId - Document to modify
 * @param {string} oldText - Text to find
 * @param {string} newText - Replacement text (can be empty to delete)
 * @returns {Promise<docs_v1.Schema$BatchUpdateDocumentResponse>} Update response
 * 
 * @example
 * // Replace all occurrences
 * await replaceText('1abc123', 'DRAFT', 'FINAL');
 * 
 * @example
 * // Delete text by replacing with empty string
 * await replaceText('1abc123', '[REMOVE THIS]', '');
 */
export async function replaceText(documentId: string, oldText: string, newText: string) {
  const docs = await getUncachableGoogleDocsClient();
  
  const response = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{
        replaceAllText: {
          containsText: {
            text: oldText,
            matchCase: true  // Case-sensitive matching
          },
          replaceText: newText
        }
      }]
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: DOCUMENT LISTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists Google Docs accessible to the user.
 * 
 * Uses the Google Drive API with a MIME type filter to find
 * only Google Docs documents.
 * 
 * GOOGLE DOCS MIME TYPE:
 * 'application/vnd.google-apps.document'
 * 
 * @async
 * @returns {Promise<drive_v3.Schema$File[]>} Array of document metadata
 *   - id: Document ID
 *   - name: Document title
 *   - modifiedTime: Last modification time
 *   - webViewLink: URL to open in Google Docs
 * 
 * @example
 * const docs = await listDocuments();
 * docs.forEach(doc => console.log(doc.name, doc.webViewLink));
 */
export async function listDocuments() {
  // Use Drive API to list files filtered by MIME type
  const drive = await getDriveClient();
  
  const response = await drive.files.list({
    // Filter to only Google Docs documents
    q: "mimeType='application/vnd.google-apps.document'",
    // Specify which fields to return
    fields: 'files(id, name, modifiedTime, webViewLink)',
    // Sort by most recently modified
    orderBy: 'modifiedTime desc',
    // Limit results
    pageSize: 20
  });
  
  return response.data.files || [];
}
