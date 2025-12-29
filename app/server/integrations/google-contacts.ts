/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GOOGLE CONTACTS INTEGRATION MODULE                     ║
 * ║                   Meowstik - People API Service                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides integration with Google People API for contact operations.
 * It enables the application to list, search, read, and create contacts.
 * 
 * AVAILABLE OPERATIONS:
 * - listContacts: List contacts from the user's address book
 * - searchContacts: Search contacts by name or email
 * - getContact: Get full contact details by resource name
 * - createContact: Create a new contact
 * - updateContact: Update an existing contact
 * 
 * @module google-contacts
 * @requires googleapis - Google APIs Node.js client library
 * @see https://developers.google.com/people/api/rest
 */

import { google, people_v1 } from 'googleapis';
import { getAuthenticatedClient } from './google-auth';

export async function getPeopleClient(): Promise<people_v1.People> {
  const auth = await getAuthenticatedClient();
  return google.people({ version: 'v1', auth });
}

export interface ContactInfo {
  resourceName: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  emails: string[];
  phoneNumbers: string[];
  organizations: { name?: string; title?: string }[];
  photoUrl?: string;
}

function parseContact(person: people_v1.Schema$Person): ContactInfo {
  const names = person.names || [];
  const emails = person.emailAddresses || [];
  const phones = person.phoneNumbers || [];
  const orgs = person.organizations || [];
  const photos = person.photos || [];

  return {
    resourceName: person.resourceName || '',
    displayName: names[0]?.displayName || emails[0]?.value || 'Unknown',
    givenName: names[0]?.givenName || undefined,
    familyName: names[0]?.familyName || undefined,
    emails: emails.map(e => e.value || '').filter(Boolean),
    phoneNumbers: phones.map(p => p.value || '').filter(Boolean),
    organizations: orgs.map(o => ({
      name: o.name || undefined,
      title: o.title || undefined,
    })),
    photoUrl: photos[0]?.url || undefined,
  };
}

export async function listContacts(pageSize = 100, pageToken?: string): Promise<{
  contacts: ContactInfo[];
  nextPageToken?: string;
  totalItems?: number;
}> {
  const people = await getPeopleClient();

  const response = await people.people.connections.list({
    resourceName: 'people/me',
    pageSize,
    pageToken,
    personFields: 'names,emailAddresses,phoneNumbers,organizations,photos',
    sortOrder: 'LAST_NAME_ASCENDING',
  });

  const connections = response.data.connections || [];

  return {
    contacts: connections.map(parseContact),
    nextPageToken: response.data.nextPageToken || undefined,
    totalItems: response.data.totalItems || undefined,
  };
}

export async function searchContacts(query: string, pageSize = 30): Promise<ContactInfo[]> {
  const people = await getPeopleClient();

  const response = await people.people.searchContacts({
    query,
    pageSize,
    readMask: 'names,emailAddresses,phoneNumbers,organizations,photos',
  });

  const results = response.data.results || [];
  return results
    .filter(r => r.person)
    .map(r => parseContact(r.person!));
}

export async function getContact(resourceName: string): Promise<ContactInfo | null> {
  const people = await getPeopleClient();

  try {
    const response = await people.people.get({
      resourceName,
      personFields: 'names,emailAddresses,phoneNumbers,organizations,photos,addresses,birthdays,biographies',
    });

    if (!response.data) return null;
    return parseContact(response.data);
  } catch (error) {
    console.error('[Contacts] Error getting contact:', error);
    return null;
  }
}

export interface CreateContactInput {
  givenName: string;
  familyName?: string;
  email?: string;
  phoneNumber?: string;
  organization?: string;
  title?: string;
}

export async function createContact(input: CreateContactInput): Promise<ContactInfo | null> {
  const people = await getPeopleClient();

  const personData: people_v1.Schema$Person = {
    names: [{
      givenName: input.givenName,
      familyName: input.familyName,
    }],
  };

  if (input.email) {
    personData.emailAddresses = [{ value: input.email }];
  }

  if (input.phoneNumber) {
    personData.phoneNumbers = [{ value: input.phoneNumber }];
  }

  if (input.organization || input.title) {
    personData.organizations = [{
      name: input.organization,
      title: input.title,
    }];
  }

  try {
    const response = await people.people.createContact({
      requestBody: personData,
      personFields: 'names,emailAddresses,phoneNumbers,organizations,photos',
    });

    if (!response.data) return null;
    return parseContact(response.data);
  } catch (error) {
    console.error('[Contacts] Error creating contact:', error);
    throw error;
  }
}

export async function updateContact(
  resourceName: string,
  input: Partial<CreateContactInput>,
  etag?: string
): Promise<ContactInfo | null> {
  const people = await getPeopleClient();

  const existingResponse = await people.people.get({
    resourceName,
    personFields: 'names,emailAddresses,phoneNumbers,organizations,metadata',
  });

  const existing = existingResponse.data;
  if (!existing) return null;

  const updateFields: string[] = [];

  if (input.givenName || input.familyName) {
    existing.names = [{
      givenName: input.givenName || existing.names?.[0]?.givenName,
      familyName: input.familyName || existing.names?.[0]?.familyName,
    }];
    updateFields.push('names');
  }

  if (input.email) {
    existing.emailAddresses = [{ value: input.email }];
    updateFields.push('emailAddresses');
  }

  if (input.phoneNumber) {
    existing.phoneNumbers = [{ value: input.phoneNumber }];
    updateFields.push('phoneNumbers');
  }

  if (input.organization || input.title) {
    existing.organizations = [{
      name: input.organization,
      title: input.title,
    }];
    updateFields.push('organizations');
  }

  try {
    const response = await people.people.updateContact({
      resourceName,
      updatePersonFields: updateFields.join(','),
      requestBody: existing,
      personFields: 'names,emailAddresses,phoneNumbers,organizations,photos',
    });

    if (!response.data) return null;
    return parseContact(response.data);
  } catch (error) {
    console.error('[Contacts] Error updating contact:', error);
    throw error;
  }
}

export async function deleteContact(resourceName: string): Promise<boolean> {
  const people = await getPeopleClient();

  try {
    await people.people.deleteContact({
      resourceName,
    });
    return true;
  } catch (error) {
    console.error('[Contacts] Error deleting contact:', error);
    return false;
  }
}
