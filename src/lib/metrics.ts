// Pure calculations over recorded data. Nothing here invents numbers: every metric is derived
// from issues, meetings, feedback and updates that actually exist in the local database.

import {
  AWAITING_STATUSES,
  DONE_STATUSES,
  type ActivityLog,
  type CommsUpdate,
  type Feedback,
  type Issue,
  type Meeting
} from '../types';
import { addDays, daysBetween, endOfWeek, inRange, monthKey, startOfWeek, todayISO } from './dates';

export const isDone = (i: Issue) => DONE_STATUSES.includes(i.status);
export const isActive = (i: Issue) => !i.archived && !isDone(i);
export const isAwaiting = (i: Issue) => !i.archived && AWAITING_STATUSES.includes(i.status);
export const isOverdue = (i: Issue, today = todayISO()) =>
  isActive(i) && !!i.nextFollowUp && i.nextFollowUp < today;
export const isDueBetween = (i: Issue, from: string, to: string) =>
  isActive(i) && !!i.nextFollowUp && inRange(i.nextFollowUp, from, to);

export function overdueDays(i: Issue, today = todayISO()): number {
  return i.nextFollowUp ? Math.max(0, daysBetween(i.nextFollowUp, today)) : 0;
}

const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 } as const;

export function comparePriority(a: Issue, b: Issue): number {
  return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
}

export interface DashboardStats {
  active: number;
  awaiting: number;
  overdue: number;
  resolved: number;
}

export function dashboardStats(issues: Issue[], today = todayISO()): DashboardStats {
  return {
    active: issues.filter(isActive).length,
    awaiting: issues.filter(isAwaiting).length,
    overdue: issues.filter((i) => isOverdue(i, today)).length,
    resolved: issues.filter(isDone).length
  };
}

export function upcomingMeetings(meetings: Meeting[], today = todayISO()): Meeting[] {
  return meetings
    .filter((m) => m.status === 'Planned' && m.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export interface PriorityAction {
  key: string;
  tone: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  to: string;
}

/** Actions needing attention this week, most urgent first. */
export function priorityActions(
  issues: Issue[],
  meetings: Meeting[],
  updates: CommsUpdate[],
  today = todayISO()
): PriorityAction[] {
  const weekEnd = endOfWeek(today);
  const out: PriorityAction[] = [];

  const overdue = issues.filter((i) => isOverdue(i, today)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp) || comparePriority(a, b));
  for (const i of overdue) {
    const d = overdueDays(i, today);
    out.push({ key: `o-${i.id}`, tone: 'critical', title: i.title, detail: `${i.ref} · Follow-up overdue by ${d} day${d === 1 ? '' : 's'}`, to: `/issues/${i.id}` });
  }

  const dueSoon = issues
    .filter((i) => isDueBetween(i, today, weekEnd))
    .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp) || comparePriority(a, b));
  for (const i of dueSoon) {
    out.push({ key: `d-${i.id}`, tone: 'warning', title: i.title, detail: `${i.ref} · Follow up ${i.nextFollowUp === today ? 'today' : 'this week'}`, to: `/issues/${i.id}` });
  }

  for (const m of meetings.filter((m) => m.status === 'Planned' && inRange(m.date, today, weekEnd))) {
    out.push({ key: `m-${m.id}`, tone: 'info', title: `Prepare for ${m.title}`, detail: `${m.type} meeting · ${m.agenda.length} agenda item${m.agenda.length === 1 ? '' : 's'}`, to: `/meetings/${m.id}` });
  }

  for (const m of meetings) {
    const open = m.followUps.filter((f) => !f.done && f.dueDate && f.dueDate <= weekEnd);
    for (const f of open) {
      out.push({ key: `f-${f.id}`, tone: f.dueDate < today ? 'critical' : 'warning', title: f.text, detail: `Meeting follow-up · ${m.title}`, to: `/meetings/${m.id}` });
    }
  }

  const highNew = issues.filter((i) => !i.archived && i.priority === 'High' && (i.status === 'New' || i.status === 'Under Review'));
  for (const i of highNew) {
    if (out.some((o) => o.key.endsWith(i.id))) continue;
    out.push({ key: `h-${i.id}`, tone: 'warning', title: i.title, detail: `${i.ref} · High priority, not yet raised with management`, to: `/issues/${i.id}` });
  }

  for (const u of updates.filter((u) => u.status === 'Approved')) {
    out.push({ key: `u-${u.id}`, tone: 'info', title: `Publish: ${u.title}`, detail: 'Approved update ready to post in Teams', to: `/updates/${u.id}` });
  }
  return out;
}

// ---------------------------------------------------------------- Reporting

export interface CountRow {
  label: string;
  count: number;
}

export function countBy(issues: Issue[], key: 'category' | 'department' | 'status' | 'priority'): CountRow[] {
  const map = new Map<string, number>();
  for (const i of issues) map.set(i[key], (map.get(i[key]) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Days from date raised to resolution, for issues where a resolution date was recorded. */
export function resolutionDays(i: Issue): number | null {
  if (!isDone(i) || !i.resolvedAt) return null;
  return Math.max(0, daysBetween(i.dateRaised, i.resolvedAt.slice(0, 10)));
}

export function averageResolutionDays(issues: Issue[]): { average: number | null; sample: number } {
  const values = issues.map(resolutionDays).filter((d): d is number => d !== null);
  if (!values.length) return { average: null, sample: 0 };
  return { average: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10, sample: values.length };
}

export interface MonthRow {
  month: string; // YYYY-MM
  raised: number;
  resolved: number;
  feedback: number;
  meetings: number;
  published: number;
}

export function monthlySummary(
  issues: Issue[],
  feedback: Feedback[],
  meetings: Meeting[],
  updates: CommsUpdate[],
  months = 6,
  today = todayISO()
): MonthRow[] {
  const keys: string[] = [];
  const [y, m] = today.split('-').map(Number);
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(y, m - 1 - k, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys.map((month) => ({
    month,
    raised: issues.filter((i) => monthKey(i.dateRaised) === month).length,
    resolved: issues.filter((i) => i.resolvedAt && isDone(i) && monthKey(i.resolvedAt.slice(0, 10)) === month).length,
    feedback: feedback.filter((f) => monthKey(f.dateReceived) === month).length,
    meetings: meetings.filter((mt) => mt.status === 'Completed' && monthKey(mt.date) === month).length,
    published: updates.filter((u) => u.status === 'Published' && u.publishedAt && monthKey(u.publishedAt.slice(0, 10)) === month).length
  }));
}

// ---------------------------------------------------------------- Feedback analysis

const STOPWORDS = new Set(
  'a an the and or but if of to in on at for with from by is are was were be been being it its this that these those there their they them we our us you your i me my not no yes so as than then too very can could would should will just about into over under more most some any all have has had do does did get got still also only when which who what where why how'.split(' ')
);

export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
  );
}

export function similarity(a: string, b: string): number {
  const A = keywords(a);
  const B = keywords(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Feedback items that look similar to the given text (same category or strong keyword overlap). */
export function findSimilarFeedback(
  draft: { description: string; category: string; department: string; id?: string },
  all: Feedback[],
  threshold = 0.2
): Feedback[] {
  return all
    .filter((f) => f.id !== draft.id)
    .map((f) => {
      let score = similarity(draft.description, f.description);
      if (draft.category && f.category === draft.category) score += 0.1;
      if (draft.department && f.department === draft.department) score += 0.05;
      return { f, score };
    })
    .filter((x) => x.score >= threshold && similarity(draft.description, x.f.description) > 0.05)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
}

export interface RepeatedConcern {
  key: string;
  category: string;
  department: string | null; // null = spans several departments
  items: Feedback[];
}

/**
 * Groups feedback in the look-back window by category; a group is a repeated concern when two or more
 * items share the category and either the same department or overlapping keywords.
 */
export function repeatedConcerns(all: Feedback[], lookbackDays = 90, today = todayISO()): RepeatedConcern[] {
  const since = addDays(today, -lookbackDays);
  const recent = all.filter((f) => f.dateReceived >= since);
  const out: RepeatedConcern[] = [];
  const byCat = new Map<string, Feedback[]>();
  for (const f of recent) byCat.set(f.category, [...(byCat.get(f.category) ?? []), f]);

  for (const [category, items] of byCat) {
    if (items.length < 2) continue;
    const byDept = new Map<string, Feedback[]>();
    for (const f of items) byDept.set(f.department, [...(byDept.get(f.department) ?? []), f]);
    const used = new Set<string>();
    for (const [department, group] of byDept) {
      if (group.length >= 2) {
        out.push({ key: `${category}|${department}`, category, department, items: group });
        group.forEach((g) => used.add(g.id));
      }
    }
    // Cross-department clusters with overlapping wording.
    const rest = items.filter((f) => !used.has(f.id));
    const seen = new Set<string>();
    for (const f of rest) {
      if (seen.has(f.id)) continue;
      const cluster = [f, ...rest.filter((g) => g.id !== f.id && !seen.has(g.id) && similarity(f.description, g.description) >= 0.15)];
      if (cluster.length >= 2) {
        cluster.forEach((c) => seen.add(c.id));
        out.push({ key: `${category}|*|${f.id}`, category, department: null, items: cluster });
      }
    }
  }
  return out.sort((a, b) => b.items.length - a.items.length);
}

// ---------------------------------------------------------------- Weekly summary

export interface WeekSummary {
  from: string;
  to: string;
  raised: number;
  responsesRecorded: number;
  resolved: number;
  meetingsHeld: number;
  feedbackLogged: number;
  updatesPublished: number;
  followUpsDue: number;
  followUpsOverdue: number;
}

export function weekSummary(
  weekStart: string,
  data: { issues: Issue[]; meetings: Meeting[]; feedback: Feedback[]; updates: CommsUpdate[]; activity: ActivityLog[] },
  today = todayISO()
): WeekSummary {
  const from = startOfWeek(weekStart);
  const to = addDays(from, 6);
  const inWeek = (ts?: string) => !!ts && inRange(ts.slice(0, 10), from, to);
  return {
    from,
    to,
    raised: data.issues.filter((i) => inRange(i.dateRaised, from, to)).length,
    responsesRecorded: data.issues.reduce((n, i) => n + i.history.filter((h) => h.kind === 'response' && inWeek(h.at)).length, 0),
    resolved: data.issues.filter((i) => isDone(i) && inWeek(i.resolvedAt)).length,
    meetingsHeld: data.meetings.filter((m) => m.status === 'Completed' && inRange(m.date, from, to)).length,
    feedbackLogged: data.feedback.filter((f) => inRange(f.dateReceived, from, to)).length,
    updatesPublished: data.updates.filter((u) => u.status === 'Published' && inWeek(u.publishedAt)).length,
    followUpsDue: data.issues.filter((i) => isDueBetween(i, from, to)).length,
    followUpsOverdue: data.issues.filter((i) => isOverdue(i, today)).length
  };
}
