/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GOOGLE DRIVE INTEGRATION MODULE                        ║
 * ║                   Nebula Chat - File Storage Service                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Google Drive API v3 for file operations.
 * It enables the application to list, create, read, update, and delete files
 * stored in the user's Google Drive.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  AUTHENTICATION FLOW                                                        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   ┌─────────────┐    ┌────────────────────┐    ┌───────────────────┐       │
 * │   │   Replit    │───▶│  Connector API     │───▶│  OAuth2 Access    │       │
 * │   │  Identity   │    │  (Token Retrieval) │    │     Token         │       │
 * │   └─────────────┘    └────────────────────┘    └───────────────────┘       │
 * │                                                          │                 │
 * │                                                          ▼                 │
 * │                                               ┌───────────────────┐        │
 * │                                               │  Google Drive API │        │
 * │                                               │    (v3 Client)    │        │
 * │                                               └───────────────────┘        │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * AVAILABLE OPERATIONS:
 * - listDriveFiles: List files with optional query filter
 * - getDriveFile: Get file metadata by ID
 * - getDriveFileContent: Download file content as text
 * - createDriveFile: Create a new file with content
 * - updateDriveFile: Update an existing file's content
 * - deleteDriveFile: Permanently delete a file
 * - searchDriveFiles: Search files by name or content
 * 
 * TOKEN CACHING:
 * The module implements token caching to avoid unnecessary API calls.
 * Tokens are cached in memory and refreshed when expired.
 * 
 * @module google-drive
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/drive/api/v3/reference
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google APIs client library.
 * Provides access to all Google API services including Drive.
 */
import { google } from 'googleapis';
import { getAuthenticatedClient, isAuthenticated } from './google-auth';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a fresh Google Drive API client with current credentials.
 * Uses custom OAuth2 authentication via google-auth module.
 * 
 * @async
 * @returns {Promise<drive_v3.Drive>} Authenticated Google Drive API client
 * @throws {Error} If not authenticated with Google
 * 
 * @example
 * const drive = await getUncachableGoogleDriveClient();
 * const files = await drive.files.list({ pageSize: 10 });
 */
export async function getUncachableGoogleDriveClient() {
  const auth = await getAuthenticatedClient();
  return google.drive({ version: 'v3', auth });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: FILE LISTING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists files from the user's Google Drive.
 * 
 * Returns files sorted by modification time (most recent first).
 * Can be filtered using Google Drive query syntax.
 * 
 * QUERY SYNTAX EXAMPLES:
 * - "mimeType='application/pdf'" - Only PDF files
 * - "name contains 'report'" - Files with 'report' in name
 * - "modifiedTime > '2023-01-01'" - Modified after date
 * - "trashed = false" - Exclude trashed files
 * 
 * @async
 * @param {string} [query] - Optional Google Drive query filter
 * @param {number} [pageSize=20] - Maximum number of files to return
 * @returns {Promise<drive_v3.Schema$File[]>} Array of file metadata objects
 * 
 * @example
 * // List recent 20 files
 * const files = await listDriveFiles();
 * 
 * @example
 * // List only PDF files
 * const pdfs = await listDriveFiles("mimeType='application/pdf'", 50);
 * 
 * @see https://developers.google.com/drive/api/v3/search-files
 */
export async function listDriveFiles(query?: string, pageSize = 20) {
  // Get authenticated Drive client
  const drive = await getUncachableGoogleDriveClient();
  
  // Execute files.list API call
  const response = await drive.files.list({
    pageSize,  // Limit number of results
    // Specify which fields to return (reduces response size)
    fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink)',
    q: query || undefined,  // Optional query filter
    orderBy: 'modifiedTime desc'  // Sort by most recently modified
  });
  
  // Return files array or empty array if none found
  return response.data.files || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: FILE METADATA OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves metadata for a specific file by ID.
 * 
 * Returns detailed file information including:
 * - id: Unique file identifier
 * - name: File name
 * - mimeType: File MIME type
 * - modifiedTime: Last modification timestamp
 * - size: File size in bytes
 * - webViewLink: URL to view file in browser
 * - iconLink: URL to file type icon
 * - description: User-provided description
 * 
 * @async
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<drive_v3.Schema$File>} File metadata object
 * @throws {Error} If file not found or access denied
 * 
 * @example
 * const file = await getDriveFile('1abc123def456');
 * console.log(file.name, file.mimeType);
 */
export async function getDriveFile(fileId: string) {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.get({
    fileId,
    // Specify which metadata fields to return
    fields: 'id, name, mimeType, modifiedTime, size, webViewLink, iconLink, description'
  });
  
  return response.data;
}

/**
 * Downloads the content of a file as text.
 * 
 * This function uses the 'alt=media' parameter to download
 * the actual file content instead of metadata.
 * 
 * NOTE: This only works reliably for text-based files.
 * Binary files (images, PDFs) would need different handling.
 * 
 * @async
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<string>} File content as text
 * @throws {Error} If file not found or access denied
 * 
 * @example
 * const content = await getDriveFileContent('1abc123def456');
 * console.log(content); // File text content
 */
export async function getDriveFileContent(fileId: string) {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.get({
    fileId,
    alt: 'media'  // Download content instead of metadata
  }, { responseType: 'text' });  // Parse response as text
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: FILE MODIFICATION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a new file in Google Drive.
 * 
 * The file is created with the specified name, content, and MIME type.
 * Returns metadata for the newly created file.
 * 
 * COMMON MIME TYPES:
 * - 'text/plain' - Plain text files (.txt)
 * - 'text/html' - HTML files
 * - 'application/json' - JSON files
 * - 'text/csv' - CSV files
 * 
 * @async
 * @param {string} name - Name for the new file (including extension)
 * @param {string} content - File content as string
 * @param {string} [mimeType='text/plain'] - MIME type of the content
 * @returns {Promise<drive_v3.Schema$File>} Created file metadata
 * @throws {Error} If creation fails
 * 
 * @example
 * const file = await createDriveFile('notes.txt', 'Hello World!');
 * console.log('Created file:', file.id);
 * 
 * @example
 * const jsonFile = await createDriveFile(
 *   'config.json',
 *   JSON.stringify({ key: 'value' }),
 *   'application/json'
 * );
 */
export async function createDriveFile(name: string, content: string, mimeType: string = 'text/plain') {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.create({
    // File metadata
    requestBody: {
      name,
      mimeType
    },
    // File content
    media: {
      mimeType,
      body: content
    },
    // Fields to return in response
    fields: 'id, name, mimeType, webViewLink'
  });
  
  return response.data;
}

/**
 * Updates the content of an existing file.
 * 
 * This replaces the entire file content with new content.
 * The file's metadata (name, parent folder) is preserved.
 * 
 * @async
 * @param {string} fileId - Google Drive file ID to update
 * @param {string} content - New file content
 * @param {string} [mimeType='text/plain'] - MIME type of the new content
 * @returns {Promise<drive_v3.Schema$File>} Updated file metadata
 * @throws {Error} If file not found or update fails
 * 
 * @example
 * const updated = await updateDriveFile('1abc123', 'New content');
 * console.log('Updated at:', updated.modifiedTime);
 */
export async function updateDriveFile(fileId: string, content: string, mimeType: string = 'text/plain') {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.update({
    fileId,
    // New file content
    media: {
      mimeType,
      body: content
    },
    // Fields to return in response
    fields: 'id, name, mimeType, modifiedTime, webViewLink'
  });
  
  return response.data;
}

/**
 * Permanently deletes a file from Google Drive.
 * 
 * WARNING: This is a permanent deletion, not moving to trash.
 * The file cannot be recovered after deletion.
 * 
 * @async
 * @param {string} fileId - Google Drive file ID to delete
 * @returns {Promise<{success: boolean}>} Success indicator
 * @throws {Error} If file not found or deletion fails
 * 
 * @example
 * const result = await deleteDriveFile('1abc123');
 * // result = { success: true }
 */
export async function deleteDriveFile(fileId: string) {
  const drive = await getUncachableGoogleDriveClient();
  
  // Delete operation returns no content on success
  await drive.files.delete({ fileId });
  
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: SEARCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Searches for files by name or content.
 * 
 * This is a convenience wrapper around listDriveFiles that
 * constructs the appropriate search query.
 * 
 * The search looks for:
 * - Files with the search term in their name
 * - Files with the search term in their full text content
 * 
 * @async
 * @param {string} searchTerm - Text to search for
 * @returns {Promise<drive_v3.Schema$File[]>} Array of matching files
 * 
 * @example
 * const results = await searchDriveFiles('project');
 * // Returns files with 'project' in name or content
 */
export async function searchDriveFiles(searchTerm: string) {
  // Build query using Drive query syntax
  // 'name contains' searches file names
  // 'fullText contains' searches file content
  const query = `name contains '${searchTerm}' or fullText contains '${searchTerm}'`;
  
  // Delegate to listDriveFiles with the constructed query
  return listDriveFiles(query);
}
