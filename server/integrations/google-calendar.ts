/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   GOOGLE CALENDAR INTEGRATION MODULE                      ║
 * ║                   Nebula Chat - Calendar Service                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Google Calendar API v3 for managing
 * calendar events. It enables the application to list calendars, view events,
 * and perform full CRUD operations on calendar entries.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  EVENT STRUCTURE                                                            │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   ┌─────────────────────────────────────────────────────────────┐          │
 * │   │  Calendar Event                                             │          │
 * │   ├─────────────────────────────────────────────────────────────┤          │
 * │   │  - id: Unique event identifier                              │          │
 * │   │  - summary: Event title/name                                │          │
 * │   │  - description: Detailed description                        │          │
 * │   │  - location: Where the event takes place                    │          │
 * │   │  - start: { dateTime, date, timeZone }                      │          │
 * │   │  - end: { dateTime, date, timeZone }                        │          │
 * │   │  - attendees: List of participants                          │          │
 * │   │  - reminders: Notification settings                         │          │
 * │   └─────────────────────────────────────────────────────────────┘          │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * DATE/TIME FORMATS:
 * - dateTime: ISO 8601 format for timed events (e.g., "2025-01-15T10:00:00-05:00")
 * - date: Date-only for all-day events (e.g., "2025-01-15")
 * - timeZone: IANA timezone identifier (e.g., "America/New_York")
 * 
 * AVAILABLE OPERATIONS:
 * - listCalendars: Get all accessible calendars
 * - listEvents: Get events within a time range
 * - getEvent: Get a specific event by ID
 * - createEvent: Create a new calendar event
 * - updateEvent: Modify an existing event
 * - deleteEvent: Remove an event
 * 
 * @module google-calendar
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/calendar/api/v3/reference
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Google APIs client library.
 * Provides access to all Google API services including Calendar.
 */
import { google } from 'googleapis';
import { getAuthenticatedClient, isAuthenticated } from './google-auth';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CLIENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a fresh Google Calendar API client with current credentials.
 * Uses custom OAuth2 authentication via google-auth module.
 * 
 * @async
 * @returns {Promise<calendar_v3.Calendar>} Authenticated Calendar API client
 * @throws {Error} If not authenticated with Google
 * 
 * @example
 * const calendar = await getUncachableGoogleCalendarClient();
 * const events = await calendar.events.list({ calendarId: 'primary' });
 */
export async function getUncachableGoogleCalendarClient() {
  const auth = await getAuthenticatedClient();
  return google.calendar({ version: 'v3', auth });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: CALENDAR LISTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists all calendars accessible to the authenticated user.
 * 
 * Returns both owned calendars and calendars shared with the user.
 * Each calendar includes:
 * - id: Calendar identifier (use in other API calls)
 * - summary: Calendar name/title
 * - primary: Boolean indicating if this is the user's primary calendar
 * - accessRole: User's access level (owner, writer, reader)
 * 
 * @async
 * @returns {Promise<calendar_v3.Schema$CalendarListEntry[]>} Array of calendar entries
 * 
 * @example
 * const calendars = await listCalendars();
 * const primary = calendars.find(c => c.primary);
 * console.log('Primary calendar:', primary.summary);
 */
export async function listCalendars() {
  const calendar = await getUncachableGoogleCalendarClient();
  
  const response = await calendar.calendarList.list();
  
  return response.data.items || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EVENT LISTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lists events from a specific calendar within a time range.
 * 
 * Returns events sorted by start time. By default, only returns
 * events starting from the current time (upcoming events).
 * 
 * SPECIAL CALENDAR IDs:
 * - 'primary': User's primary calendar
 * - Email address: Specific calendar by owner email
 * - Calendar ID: Unique calendar identifier
 * 
 * @async
 * @param {string} [calendarId='primary'] - Calendar to query
 * @param {string} [timeMin] - Start of time range (ISO 8601), defaults to now
 * @param {string} [timeMax] - End of time range (ISO 8601)
 * @param {number} [maxResults=20] - Maximum events to return
 * @returns {Promise<calendar_v3.Schema$Event[]>} Array of event objects
 * 
 * @example
 * // Get next 20 events from primary calendar
 * const events = await listEvents();
 * 
 * @example
 * // Get events for a specific week
 * const events = await listEvents(
 *   'primary',
 *   '2025-01-01T00:00:00Z',
 *   '2025-01-07T23:59:59Z',
 *   100
 * );
 */
export async function listEvents(calendarId = 'primary', timeMin?: string, timeMax?: string, maxResults = 20) {
  const calendar = await getUncachableGoogleCalendarClient();
  
  // Default timeMin to current time if not specified
  const now = new Date().toISOString();
  
  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin || now,     // Start time (default: now)
    timeMax,                      // End time (optional)
    maxResults,
    singleEvents: true,           // Expand recurring events into instances
    orderBy: 'startTime'          // Sort by start time
  });
  
  return response.data.items || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EVENT RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieves a specific event by its ID.
 * 
 * Returns the full event object including all details.
 * 
 * @async
 * @param {string} calendarId - Calendar containing the event
 * @param {string} eventId - Unique event identifier
 * @returns {Promise<calendar_v3.Schema$Event>} Full event object
 * @throws {Error} If event not found
 * 
 * @example
 * const event = await getEvent('primary', 'abc123xyz');
 * console.log(event.summary, event.start);
 */
export async function getEvent(calendarId: string, eventId: string) {
  const calendar = await getUncachableGoogleCalendarClient();
  
  const response = await calendar.events.get({
    calendarId,
    eventId
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EVENT CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a new calendar event.
 * 
 * START/END TIME FORMATS:
 * For timed events, use dateTime:
 *   { dateTime: '2025-01-15T10:00:00-05:00', timeZone: 'America/New_York' }
 * 
 * For all-day events, use date:
 *   { date: '2025-01-15' }
 * 
 * @async
 * @param {string} calendarId - Calendar to add event to
 * @param {string} summary - Event title
 * @param {Object} start - Event start time
 * @param {string} [start.dateTime] - Start datetime (ISO 8601)
 * @param {string} [start.date] - Start date for all-day events
 * @param {string} [start.timeZone] - Timezone identifier
 * @param {Object} end - Event end time (same format as start)
 * @param {string} [description] - Event description
 * @param {string} [location] - Event location
 * @returns {Promise<calendar_v3.Schema$Event>} Created event object
 * 
 * @example
 * // Create a timed event
 * const event = await createEvent(
 *   'primary',
 *   'Team Meeting',
 *   { dateTime: '2025-01-15T10:00:00-05:00' },
 *   { dateTime: '2025-01-15T11:00:00-05:00' },
 *   'Weekly sync meeting',
 *   'Conference Room A'
 * );
 * 
 * @example
 * // Create an all-day event
 * const holiday = await createEvent(
 *   'primary',
 *   'Company Holiday',
 *   { date: '2025-12-25' },
 *   { date: '2025-12-26' }
 * );
 */
export async function createEvent(
  calendarId: string,
  summary: string,
  start: { dateTime?: string; date?: string; timeZone?: string },
  end: { dateTime?: string; date?: string; timeZone?: string },
  description?: string,
  location?: string
) {
  const calendar = await getUncachableGoogleCalendarClient();
  
  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,       // Event title
      description,   // Detailed description
      location,      // Where the event takes place
      start,         // Start time object
      end            // End time object
    }
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EVENT MODIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updates an existing calendar event.
 * 
 * Uses PATCH semantics - only provided fields are updated.
 * Omitted fields retain their current values.
 * 
 * @async
 * @param {string} calendarId - Calendar containing the event
 * @param {string} eventId - Event to update
 * @param {Object} updates - Fields to update
 * @param {string} [updates.summary] - New event title
 * @param {string} [updates.description] - New description
 * @param {string} [updates.location] - New location
 * @param {Object} [updates.start] - New start time
 * @param {Object} [updates.end] - New end time
 * @returns {Promise<calendar_v3.Schema$Event>} Updated event object
 * 
 * @example
 * // Update event title and location
 * const updated = await updateEvent('primary', 'abc123', {
 *   summary: 'Updated Meeting Title',
 *   location: 'New Conference Room'
 * });
 */
export async function updateEvent(
  calendarId: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
  }
) {
  const calendar = await getUncachableGoogleCalendarClient();
  
  // Use patch for partial updates (only updates provided fields)
  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updates
  });
  
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION: EVENT DELETION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deletes an event from a calendar.
 * 
 * This permanently removes the event. For recurring events,
 * only the specific instance is deleted unless it's the parent event.
 * 
 * @async
 * @param {string} calendarId - Calendar containing the event
 * @param {string} eventId - Event to delete
 * @returns {Promise<{success: boolean}>} Success indicator
 * @throws {Error} If event not found or deletion fails
 * 
 * @example
 * const result = await deleteEvent('primary', 'abc123xyz');
 * // result = { success: true }
 */
export async function deleteEvent(calendarId: string, eventId: string) {
  const calendar = await getUncachableGoogleCalendarClient();
  
  // Delete operation returns no content on success
  await calendar.events.delete({
    calendarId,
    eventId
  });
  
  return { success: true };
}
