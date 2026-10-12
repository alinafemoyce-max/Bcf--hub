import { ISSUE_STATUSES, MEETING_STATUSES, MEETING_TYPES, PRIORITIES, UPDATE_STATUSES } from '../types';
import type { Feedback, Issue, Meeting, CommsUpdate, Template } from '../types';
import { isValidISODate } from './dates';

export type Errors = Record<string, string>;

const LIMITS = { title: 120, long: 5000 };

function required(errors: Errors, key: string, value: string, label: string) {
  if (!value || !value.trim()) errors[key] = `${label} is required.`;
}

function maxLen(errors: Errors, key: string, value: string, max: number, label: string) {
  if (value && value.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
}

function optionalDate(errors: Errors, key: string, value: string, label: string) {
  if (value && !isValidISODate(value)) errors[key] = `${label} is not a valid date.`;
}

export type IssueDraft = Pick<
  Issue,
  'title' | 'description' | 'department' | 'category' | 'priority' | 'status' | 'managementResponse' | 'actionOwner' | 'nextFollowUp' | 'resolutionNotes' | 'dateRaised'
>;

export function validateIssue(d: IssueDraft): Errors {
  const e: Errors = {};
  required(e, 'title', d.title, 'Title');
  if (!e.title && d.title.trim().length < 3) e.title = 'Title should be at least 3 characters.';
  maxLen(e, 'title', d.title, LIMITS.title, 'Title');
  required(e, 'description', d.description, 'Description');
  maxLen(e, 'description', d.description, LIMITS.long, 'Description');
  required(e, 'department', d.department, 'Department or shed');
  required(e, 'category', d.category, 'Category');
  if (!PRIORITIES.includes(d.priority)) e.priority = 'Choose a priority.';
  if (!ISSUE_STATUSES.includes(d.status)) e.status = 'Choose a status.';
  required(e, 'dateRaised', d.dateRaised, 'Date raised');
  optionalDate(e, 'dateRaised', d.dateRaised, 'Date raised');
  optionalDate(e, 'nextFollowUp', d.nextFollowUp, 'Follow-up date');
  if (!e.nextFollowUp && !e.dateRaised && d.nextFollowUp && d.nextFollowUp < d.dateRaised)
    e.nextFollowUp = 'Follow-up date cannot be before the date raised.';
  maxLen(e, 'managementResponse', d.managementResponse, LIMITS.long, 'Management response');
  maxLen(e, 'resolutionNotes', d.resolutionNotes, LIMITS.long, 'Resolution notes');
  maxLen(e, 'actionOwner', d.actionOwner, 120, 'Action owner');
  if ((d.status === 'Resolved' || d.status === 'Closed') && !d.resolutionNotes.trim())
    e.resolutionNotes = 'Add resolution notes before marking this issue resolved or closed.';
  return e;
}

export function validateMeeting(d: Pick<Meeting, 'title' | 'date' | 'time' | 'type' | 'status' | 'location'>): Errors {
  const e: Errors = {};
  required(e, 'title', d.title, 'Title');
  maxLen(e, 'title', d.title, LIMITS.title, 'Title');
  required(e, 'date', d.date, 'Date');
  optionalDate(e, 'date', d.date, 'Date');
  if (d.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)) e.time = 'Time must be HH:MM.';
  if (!MEETING_TYPES.includes(d.type)) e.type = 'Choose a meeting type.';
  if (!MEETING_STATUSES.includes(d.status)) e.status = 'Choose a status.';
  maxLen(e, 'location', d.location, 120, 'Location');
  return e;
}

export function validateFeedback(d: Pick<Feedback, 'dateReceived' | 'department' | 'category' | 'description'>): Errors {
  const e: Errors = {};
  required(e, 'department', d.department, 'Department or shed');
  required(e, 'category', d.category, 'Category');
  required(e, 'description', d.description, 'Description');
  if (!e.description && d.description.trim().length < 5) e.description = 'Add a little more detail.';
  maxLen(e, 'description', d.description, 2000, 'Description');
  required(e, 'dateReceived', d.dateReceived, 'Date received');
  optionalDate(e, 'dateReceived', d.dateReceived, 'Date received');
  return e;
}

export function validateUpdate(d: Pick<CommsUpdate, 'title' | 'body' | 'status'>): Errors {
  const e: Errors = {};
  required(e, 'title', d.title, 'Title');
  maxLen(e, 'title', d.title, LIMITS.title, 'Title');
  required(e, 'body', d.body, 'Message');
  maxLen(e, 'body', d.body, 10000, 'Message');
  if (!UPDATE_STATUSES.includes(d.status)) e.status = 'Choose a status.';
  return e;
}

export function validateTemplate(d: Pick<Template, 'name' | 'body'>): Errors {
  const e: Errors = {};
  required(e, 'name', d.name, 'Template name');
  maxLen(e, 'name', d.name, 80, 'Template name');
  required(e, 'body', d.body, 'Template text');
  maxLen(e, 'body', d.body, 10000, 'Template text');
  return e;
}

/**
 * Light-touch check for personal details that should not be stored (emails, phone numbers,
 * employee/clock numbers). Returns human-readable warnings; never blocks saving on its own.
 */
export function personalDataWarnings(text: string): string[] {
  const w: string[] = [];
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) w.push('an email address');
  if (/(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/.test(text) || /\b\d{5}\s?\d{6}\b/.test(text)) w.push('a phone number');
  if (/\b(clock|employee|staff|payroll)\s*(no\.?|number|#|id)\s*:?\s*\w+/i.test(text)) w.push('an employee or clock number');
  return w;
}

export function hasErrors(e: Errors): boolean {
  return Object.keys(e).length > 0;
}
