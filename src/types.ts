// Core data model for BCF Hub. All records are stored locally in IndexedDB.

export const PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ISSUE_STATUSES = [
  'New',
  'Under Review',
  'Raised with Management',
  'Awaiting Response',
  'In Progress',
  'Resolved',
  'Closed'
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Statuses that mean the issue no longer needs active work. */
export const DONE_STATUSES: IssueStatus[] = ['Resolved', 'Closed'];
/** Statuses that mean we are waiting on management. */
export const AWAITING_STATUSES: IssueStatus[] = ['Raised with Management', 'Awaiting Response'];

export type ActivityKind =
  | 'created'
  | 'edited'
  | 'status'
  | 'response'
  | 'followup'
  | 'note'
  | 'meeting'
  | 'feedback'
  | 'archived'
  | 'restored'
  | 'resolved';

export interface HistoryEntry {
  id: string;
  at: string; // ISO timestamp
  kind: ActivityKind;
  text: string;
}

export interface Issue {
  id: string;
  ref: string; // human-readable unique ID, e.g. BCF-0007
  dateRaised: string; // YYYY-MM-DD
  title: string;
  description: string;
  department: string;
  category: string;
  priority: Priority;
  status: IssueStatus;
  managementResponse: string;
  actionOwner: string;
  nextFollowUp: string; // YYYY-MM-DD or ''
  resolutionNotes: string;
  resolvedAt?: string; // ISO timestamp when first moved to Resolved/Closed
  archived: boolean;
  sourceMeetingId?: string;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export const MEETING_TYPES = ['Pre-BCF', 'BCF'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export const MEETING_STATUSES = ['Planned', 'Completed', 'Cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export interface AgendaItem {
  id: string;
  title: string;
  issueId?: string;
  presenterNotes: string;
  managementResponse: string;
  decision: string;
  actionIssueId?: string; // tracked action created from this decision
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  dueDate: string; // YYYY-MM-DD or ''
}

export interface Meeting {
  id: string;
  type: MeetingType;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ''
  location: string;
  status: MeetingStatus;
  attendees: string; // roles only — avoid names where possible
  agenda: AgendaItem[];
  minutes: string;
  notesApproved: boolean;
  followUps: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export interface Feedback {
  id: string;
  dateReceived: string; // YYYY-MM-DD
  department: string;
  category: string;
  description: string;
  linkedIssueId?: string;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export const UPDATE_STATUSES = ['Draft', 'Approved', 'Published'] as const;
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

export interface CommsUpdate {
  id: string;
  title: string;
  body: string;
  status: UpdateStatus;
  meetingId?: string;
  publishedAt?: string;
  history: { at: string; text: string }[];
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export interface Template {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export interface WeeklyPriority {
  text: string;
  done: boolean;
}

export interface WeeklyPlan {
  id: string; // ISO date (YYYY-MM-DD) of the Monday of the week
  priorities: WeeklyPriority[]; // always 3
  notes: string;
  updatedAt: string;
  demo?: boolean;
}

export type EntityType = 'issue' | 'meeting' | 'feedback' | 'update' | 'template' | 'plan' | 'system';

export interface ActivityLog {
  id: string;
  at: string;
  entity: EntityType;
  entityId?: string;
  kind: ActivityKind;
  text: string;
  demo?: boolean;
}

export interface Settings {
  id: 'settings';
  nextIssueNumber: number;
  departments: string[];
  categories: string[];
  lastBackupAt?: string;
  demoLoadedAt?: string;
  onboarded: boolean;
}

export interface AppData {
  issues: Issue[];
  meetings: Meeting[];
  feedback: Feedback[];
  updates: CommsUpdate[];
  templates: Template[];
  plans: WeeklyPlan[];
  activity: ActivityLog[];
  settings: Settings;
}

export const DEFAULT_DEPARTMENTS = [
  'Lamination',
  'Hull & Deck Assembly',
  'Joinery',
  'Electrical',
  'Mechanical & Engineering',
  'Paint & Finishing',
  'Upholstery',
  'Stores & Logistics',
  'Design Office',
  'Training Centre'
];

export const DEFAULT_CATEGORIES = [
  'Training & Development',
  'Health & Safety',
  'Welfare & Facilities',
  'Tools & Equipment',
  'Pay, Hours & Rotas',
  'College & Off-the-Job Learning',
  'Mentoring & Support',
  'Communication',
  'Other'
];
