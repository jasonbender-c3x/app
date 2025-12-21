/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   GOOGLE SHEETS INTEGRATION MODULE                        ║
 * ║                  Meowstik - Spreadsheet Service                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Google Sheets API v4 for spreadsheet
 * operations. It enables the application to read, write, and manage data
 * in Google Sheets spreadsheets.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SPREADSHEET STRUCTURE                                                      │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   ┌─────────────────────────────────────────────────────────────┐          │
 * │   │  Spreadsheet                                                 │          │
 * │   │  └── spreadsheetId: Unique identifier                       │          │
 * │   │  └── properties: { title: "My Spreadsheet" }                │          │
 * │   │  └── sheets[]:                                              │          │
 * │   │        └── Sheet                                            │          │
 * │   │              └── properties: { sheetId, title, index }      │          │
 * │   │              └── data (cells organized in rows/columns)     │          │
 * │   └─────────────────────────────────────────────────────────────┘          │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * A1 NOTATION:
 * Ranges are specified using A1 notation:
 * - "Sheet1!A1" - Single cell A1 in Sheet1
 * - "Sheet1!A1:D10" - Range from A1 to D10 in Sheet1
 * - "Sheet1!A:A" - Entire column A in Sheet1
 * - "Sheet1!1:1" - Entire row 1 in Sheet1
 * - "Sheet1" - All data in Sheet1
 * - "A1:D10" - Range in the first sheet (sheet name optional)
 * 
 * AVAILABLE OPERATIONS:
 * - listSpreadsheets: List user's spreadsheets (uses Drive API)
 * - getSpreadsheet: Get spreadsheet metadata and structure
 * - getSheetValues: Read cell values from a range
 * - updateSheetValues: Write values to a range
 * - appendSheetValues: Append rows after existing data
 * - createSpreadsheet: Create a new spreadsheet
 * - clearSheetRange: Clear values in a range
 * 
 * @module google-sheets
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/sheets/api/reference/rest
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google APIs client library.
 * Provides access to all Google API services including Sheets and Drive.
 */
import { google } from 'googleapis';
import { getAuthenticatedClient, isAuthenticated } from './google-auth';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CLIENT FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a fresh Google Sheets API client with current credentials.
 * Uses custom OAuth2 authentication via google-auth module.
 * 
 * @async
 * @returns {Promise<sheets_v4.Sheets>} Authenticated Sheets API client
 * @throws {Error} If not authenticated with Google
 * 
 * @example
 * const sheets = await getUncachableGoogleSheetsClient();
 * const data = await sheets.spreadsheets.values.get({
 *   spreadsheetId: 'abc123',
 *   range: 'Sheet1!A1:D10'
 * });
 */
export async function getUncachableGoogleSheetsClient() {
  const auth = await getAuthenticatedClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Creates a Google Drive client for listing spreadsheets.
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
// SECTION: SPREADSHEET METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves metadata and structure of a spreadsheet.
 * 
 * Returns information about the spreadsheet including:
 * - spreadsheetId: Unique identifier
 * - properties: { title, locale, timeZone }
 * - sheets: Array of sheet metadata (names, IDs, dimensions)
 * 
 * @async
 * @param {string} spreadsheetId - Google Sheets spreadsheet ID
 * @returns {Promise<sheets_v4.Schema$Spreadsheet>} Spreadsheet metadata
 * @throws {Error} If spreadsheet not found or access denied
 * 
 * @example
 * const spreadsheet = await getSpreadsheet('1abc123def456');
 * console.log('Title:', spreadsheet.properties?.title);
 * console.log('Sheets:', spreadsheet.sheets?.map(s => s.properties?.title));
 */
export async function getSpreadsheet(spreadsheetId: string) {
  const sheets = await getUncachableGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: VALUE READING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reads cell values from a specified range.
 * 
 * Returns a 2D array where each inner array represents a row,
 * and each element represents a cell value.
 * 
 * @async
 * @param {string} spreadsheetId - Spreadsheet to read from
 * @param {string} range - A1 notation range (e.g., "Sheet1!A1:D10")
 * @returns {Promise<any[][]>} 2D array of cell values
 * 
 * @example
 * const values = await getSheetValues('1abc123', 'Sheet1!A1:D10');
 * // values = [
 * //   ['Name', 'Age', 'City', 'Country'],
 * //   ['Alice', '30', 'NYC', 'USA'],
 * //   ['Bob', '25', 'London', 'UK']
 * // ]
 */
export async function getSheetValues(spreadsheetId: string, range: string) {
  const sheets = await getUncachableGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  
  // Return values array or empty array if no data
  return response.data.values || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: VALUE WRITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates cell values in a specified range.
 * 
 * Overwrites existing values in the specified range.
 * The values array should match the dimensions of the range.
 * 
 * VALUE INPUT OPTIONS:
 * - USER_ENTERED: Parse values as if typed by user (e.g., "=SUM(A1:A10)")
 * - RAW: Store values as-is without parsing
 * 
 * @async
 * @param {string} spreadsheetId - Spreadsheet to update
 * @param {string} range - A1 notation range
 * @param {any[][]} values - 2D array of values to write
 * @returns {Promise<sheets_v4.Schema$UpdateValuesResponse>} Update response
 * 
 * @example
 * await updateSheetValues('1abc123', 'Sheet1!A1:B2', [
 *   ['Header 1', 'Header 2'],
 *   ['Value 1', 'Value 2']
 * ]);
 */
export async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const sheets = await getUncachableGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',  // Parse values like user input
    requestBody: {
      values
    }
  });
  
  return response.data;
}

/**
 * Appends rows after existing data in a sheet.
 * 
 * The new rows are added after the last row with data.
 * This is useful for adding records to a data table.
 * 
 * INSERT DATA OPTION:
 * - INSERT_ROWS: Insert new rows for the data
 * - OVERWRITE: Overwrite existing data
 * 
 * @async
 * @param {string} spreadsheetId - Spreadsheet to append to
 * @param {string} range - A1 notation range (determines columns)
 * @param {any[][]} values - 2D array of rows to append
 * @returns {Promise<sheets_v4.Schema$AppendValuesResponse>} Append response
 * 
 * @example
 * // Append two new rows to the data table
 * await appendSheetValues('1abc123', 'Sheet1!A:D', [
 *   ['Charlie', '35', 'Paris', 'France'],
 *   ['Diana', '28', 'Tokyo', 'Japan']
 * ]);
 */
export async function appendSheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const sheets = await getUncachableGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',  // Parse values like user input
    insertDataOption: 'INSERT_ROWS',   // Insert new rows (don't overwrite)
    requestBody: {
      values
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: SPREADSHEET CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a new Google Sheets spreadsheet.
 * 
 * Can optionally specify initial sheet names. If not provided,
 * creates a single sheet named "Sheet1".
 * 
 * @async
 * @param {string} title - Spreadsheet title
 * @param {string[]} [sheetTitles] - Optional array of sheet names to create
 * @returns {Promise<sheets_v4.Schema$Spreadsheet>} Created spreadsheet
 * 
 * @example
 * // Create spreadsheet with default sheet
 * const spreadsheet = await createSpreadsheet('Sales Report');
 * 
 * @example
 * // Create spreadsheet with multiple sheets
 * const spreadsheet = await createSpreadsheet('Budget 2025', [
 *   'Q1', 'Q2', 'Q3', 'Q4', 'Summary'
 * ]);
 */
export async function createSpreadsheet(title: string, sheetTitles?: string[]) {
  const sheets = await getUncachableGoogleSheetsClient();
  
  // Build sheets array from provided titles or default to Sheet1
  const sheetsList = sheetTitles?.map(title => ({
    properties: { title }
  })) || [{ properties: { title: 'Sheet1' } }];
  
  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },  // Spreadsheet title
      sheets: sheetsList      // Initial sheets
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: SPREADSHEET LISTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists Google Sheets spreadsheets accessible to the user.
 * 
 * Uses the Google Drive API with a MIME type filter to find
 * only Google Sheets files.
 * 
 * GOOGLE SHEETS MIME TYPE:
 * 'application/vnd.google-apps.spreadsheet'
 * 
 * @async
 * @returns {Promise<drive_v3.Schema$File[]>} Array of spreadsheet metadata
 *   - id: Spreadsheet ID
 *   - name: Spreadsheet title
 *   - modifiedTime: Last modification time
 *   - webViewLink: URL to open in Google Sheets
 * 
 * @example
 * const spreadsheets = await listSpreadsheets();
 * spreadsheets.forEach(s => console.log(s.name, s.webViewLink));
 */
export async function listSpreadsheets() {
  // Use Drive API to list files filtered by MIME type
  const drive = await getDriveClient();
  
  const response = await drive.files.list({
    // Filter to only Google Sheets spreadsheets
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    // Specify which fields to return
    fields: 'files(id, name, modifiedTime, webViewLink)',
    // Sort by most recently modified
    orderBy: 'modifiedTime desc',
    // Limit results
    pageSize: 20
  });
  
  return response.data.files || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: VALUE CLEARING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clears all values in a specified range.
 * 
 * The cells remain in the sheet but their values are removed.
 * Formatting is preserved.
 * 
 * @async
 * @param {string} spreadsheetId - Spreadsheet to clear
 * @param {string} range - A1 notation range to clear
 * @returns {Promise<sheets_v4.Schema$ClearValuesResponse>} Clear response
 * 
 * @example
 * // Clear all data in a range
 * await clearSheetRange('1abc123', 'Sheet1!A2:D100');
 */
export async function clearSheetRange(spreadsheetId: string, range: string) {
  const sheets = await getUncachableGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range
  });
  
  return response.data;
}
