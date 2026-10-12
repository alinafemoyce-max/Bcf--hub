// Backup export / import. Backups are plain JSON files saved to the device — no cloud upload.
import {
  ISSUE_STATUSES,
  MEETING_STATUSES,
  MEETING_TYPES,
  PRIORITIES,
  UPDATE_STATUSES,
  type AppData,
  type CommsUpdate,
  type Feedback,
  type Issue,
  type Meeting,
  type Settings,
  type Template,
  type WeeklyPlan,
  type ActivityLog
} from '../types';
import { defaultSettings } from './db';
import { isValidISODate } from '../lib/dates';
import { uid } from '../lib/ids';

export const BACKUP_APP = 'bcf-hub';
export const BACKUP_SCHEMA = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
}

export function createBackup(data: AppData): BackupFile {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA, exportedAt: new Date().toISOString(), data };
}

export class BackupError extends Error {}

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const date = (v: unknown, fallback = ''): string => (typeof v === 'string' && isValidISODate(v) ? v : fallback);
const ts = (v: unknown): string => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

function needId(r: Rec, what: string): string {
  if (typeof r.id !== 'string' || !r.id) throw new BackupError(`A ${what} record is missing its ID.`);
  return r.id;
}

function normaliseIssue(r: Rec): Issue {
  return {
    id: needId(r, 'issue'),
    ref: str(r.ref, 'BCF-????'),
    dateRaised: date(r.dateRaised, new Date().toISOString().slice(0, 10)),
    title: str(r.title, 'Untitled issue'),
    description: str(r.description),
    department: str(r.department),
    category: str(r.category),
    priority: oneOf(r.priority, PRIORITIES, 'Medium'),
    status: oneOf(r.status, ISSUE_STATUSES, 'New'),
    managementResponse: str(r.managementResponse),
    actionOwner: str(r.actionOwner),
    nextFollowUp: date(r.nextFollowUp),
    resolutionNotes: str(r.resolutionNotes),
    resolvedAt: optStr(r.resolvedAt),
    archived: r.archived === true,
    sourceMeetingId: optStr(r.sourceMeetingId),
    history: arr(r.history).filter(isObj).map((h) => ({
      id: str(h.id, uid()),
      at: ts(h.at),
      kind: (str(h.kind, 'note') as Issue['history'][number]['kind']),
      text: str(h.text)
    })),
    createdAt: ts(r.createdAt),
    updatedAt: ts(r.updatedAt),
    demo: r.demo === true || undefined
  };
}

function normaliseMeeting(r: Rec): Meeting {
  return {
    id: needId(r, 'meeting'),
    type: oneOf(r.type, MEETING_TYPES, 'BCF'),
    title: str(r.title, 'Meeting'),
    date: date(r.date, new Date().toISOString().slice(0, 10)),
    time: str(r.time),
    location: str(r.location),
    status: oneOf(r.status, MEETING_STATUSES, 'Planned'),
    attendees: str(r.attendees),
    agenda: arr(r.agenda).filter(isObj).map((a) => ({
      id: str(a.id, uid()),
      title: str(a.title),
      issueId: optStr(a.issueId),
      presenterNotes: str(a.presenterNotes),
      managementResponse: str(a.managementResponse),
      decision: str(a.decision),
      actionIssueId: optStr(a.actionIssueId)
    })),
    minutes: str(r.minutes),
    notesApproved: r.notesApproved === true,
    followUps: arr(r.followUps).filter(isObj).map((f) => ({
      id: str(f.id, uid()),
      text: str(f.text),
      done: f.done === true,
      dueDate: date(f.dueDate)
    })),
    createdAt: ts(r.createdAt),
    updatedAt: ts(r.updatedAt),
    demo: r.demo === true || undefined
  };
}

function normaliseFeedback(r: Rec): Feedback {
  return {
    id: needId(r, 'feedback'),
    dateReceived: date(r.dateReceived, new Date().toISOString().slice(0, 10)),
    department: str(r.department),
    category: str(r.category),
    description: str(r.description),
    linkedIssueId: optStr(r.linkedIssueId),
    createdAt: ts(r.createdAt),
    updatedAt: ts(r.updatedAt),
    demo: r.demo === true || undefined
  };
}

function normaliseUpdate(r: Rec): CommsUpdate {
  return {
    id: needId(r, 'update'),
    title: str(r.title, 'Update'),
    body: str(r.body),
    status: oneOf(r.status, UPDATE_STATUSES, 'Draft'),
    meetingId: optStr(r.meetingId),
    publishedAt: optStr(r.publishedAt),
    history: arr(r.history).filter(isObj).map((h) => ({ at: ts(h.at), text: str(h.text) })),
    createdAt: ts(r.createdAt),
    updatedAt: ts(r.updatedAt),
    demo: r.demo === true || undefined
  };
}

function normaliseTemplate(r: Rec): Template {
  return { id: needId(r, 'template'), name: str(r.name, 'Template'), body: str(r.body), createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt), demo: r.demo === true || undefined };
}

function normalisePlan(r: Rec): WeeklyPlan {
  const pr = arr(r.priorities).filter(isObj).slice(0, 3).map((p) => ({ text: str(p.text), done: p.done === true }));
  while (pr.length < 3) pr.push({ text: '', done: false });
  return { id: date(needId(r, 'weekly plan'), '1970-01-05'), priorities: pr, notes: str(r.notes), updatedAt: ts(r.updatedAt), demo: r.demo === true || undefined };
}

function normaliseActivity(r: Rec): ActivityLog {
  return {
    id: needId(r, 'activity'),
    at: ts(r.at),
    entity: str(r.entity, 'system') as ActivityLog['entity'],
    entityId: optStr(r.entityId),
    kind: str(r.kind, 'note') as ActivityLog['kind'],
    text: str(r.text),
    demo: r.demo === true || undefined
  };
}

function normaliseSettings(r: unknown, issues: Issue[]): Settings {
  const d = defaultSettings();
  if (!isObj(r)) return d;
  const strList = (v: unknown, fb: string[]) => {
    const l = arr(v).filter((x): x is string => typeof x === 'string' && !!x.trim());
    return l.length ? l : fb;
  };
  const maxRef = issues.reduce((m, i) => Math.max(m, Number(i.ref.replace(/\D/g, '')) || 0), 0);
  return {
    id: 'settings',
    nextIssueNumber: Math.max(typeof r.nextIssueNumber === 'number' ? r.nextIssueNumber : 1, maxRef + 1),
    departments: strList(r.departments, d.departments),
    categories: strList(r.categories, d.categories),
    lastBackupAt: optStr(r.lastBackupAt),
    demoLoadedAt: optStr(r.demoLoadedAt),
    onboarded: true
  };
}

/** Parses and validates a backup file. Throws BackupError with a user-friendly message on failure. */
export function parseBackup(text: string): AppData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not valid JSON. Choose a BCF Hub backup (.json) file.');
  }
  if (!isObj(json) || json.app !== BACKUP_APP || !isObj(json.data)) {
    throw new BackupError('This file is not a BCF Hub backup.');
  }
  if (typeof json.schemaVersion !== 'number' || json.schemaVersion > BACKUP_SCHEMA) {
    throw new BackupError('This backup was made by a newer version of BCF Hub and cannot be imported here.');
  }
  const d = json.data;
  const each = <T,>(v: unknown, fn: (r: Rec) => T) => arr(v).filter(isObj).map(fn);
  const issues = each(d.issues, normaliseIssue);
  const ids = new Set(issues.map((i) => i.id));
  if (ids.size !== issues.length) throw new BackupError('The backup contains duplicate issue IDs.');
  return {
    issues,
    meetings: each(d.meetings, normaliseMeeting),
    feedback: each(d.feedback, normaliseFeedback),
    updates: each(d.updates, normaliseUpdate),
    templates: each(d.templates, normaliseTemplate),
    plans: each(d.plans, normalisePlan),
    activity: each(d.activity, normaliseActivity),
    settings: normaliseSettings(d.settings, issues)
  };
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `bcf-hub-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}
