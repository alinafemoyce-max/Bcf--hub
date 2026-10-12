import { describe, expect, it } from 'vitest';
import type { Feedback, Issue } from '../src/types';
import { addDays, daysBetween, startOfWeek, isValidISODate } from '../src/lib/dates';
import {
  averageResolutionDays,
  countBy,
  dashboardStats,
  findSimilarFeedback,
  isOverdue,
  monthlySummary,
  priorityActions,
  repeatedConcerns,
  weekSummary
} from '../src/lib/metrics';
import { personalDataWarnings, validateFeedback, validateIssue } from '../src/lib/validation';
import { applyIssueChanges } from '../src/lib/issueOps';
import { buildDemoData } from '../src/db/seed';
import { stripDemo } from '../src/state/store';
import { createBackup, parseBackup, BackupError } from '../src/db/backup';
import { defaultSettings } from '../src/db/db';
import { meetingSummaryText } from '../src/lib/summary';
import { pdfText } from '../src/lib/pdf';

const TODAY = '2026-10-14'; // a Wednesday

function issue(p: Partial<Issue> = {}): Issue {
  return {
    id: Math.random().toString(36).slice(2),
    ref: 'BCF-0001',
    dateRaised: '2026-10-01',
    title: 'Test issue',
    description: 'Something',
    department: 'Joinery',
    category: 'Health & Safety',
    priority: 'Medium',
    status: 'New',
    managementResponse: '',
    actionOwner: '',
    nextFollowUp: '',
    resolutionNotes: '',
    archived: false,
    history: [],
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...p
  };
}

function fb(p: Partial<Feedback>): Feedback {
  return { id: Math.random().toString(36).slice(2), dateReceived: TODAY, department: 'Joinery', category: 'Tools & Equipment', description: '', createdAt: '', updatedAt: '', ...p };
}

describe('dates', () => {
  it('handles week boundaries Monday-first', () => {
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
  });
  it('adds days across months and computes differences', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(daysBetween('2026-10-01', '2026-10-14')).toBe(13);
  });
  it('validates ISO dates', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('28/02/2026')).toBe(false);
  });
});

describe('overdue and dashboard metrics', () => {
  it('flags follow-ups before today on active issues only', () => {
    expect(isOverdue(issue({ nextFollowUp: '2026-10-13' }), TODAY)).toBe(true);
    expect(isOverdue(issue({ nextFollowUp: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(issue({ nextFollowUp: '2026-10-13', status: 'Resolved' }), TODAY)).toBe(false);
    expect(isOverdue(issue({ nextFollowUp: '2026-10-13', archived: true }), TODAY)).toBe(false);
    expect(isOverdue(issue({ nextFollowUp: '' }), TODAY)).toBe(false);
  });
  it('counts dashboard figures from records', () => {
    const list = [
      issue({ status: 'New' }),
      issue({ status: 'Awaiting Response', nextFollowUp: '2026-10-01' }),
      issue({ status: 'Raised with Management' }),
      issue({ status: 'Resolved' }),
      issue({ status: 'Closed', archived: true }),
      issue({ status: 'In Progress', archived: true })
    ];
    expect(dashboardStats(list, TODAY)).toEqual({ active: 3, awaiting: 2, overdue: 1, resolved: 2 });
  });
  it('orders priority actions with overdue first', () => {
    const a = priorityActions(
      [issue({ id: 'due', nextFollowUp: '2026-10-16', title: 'Due' }), issue({ id: 'late', nextFollowUp: '2026-10-10', title: 'Late' })],
      [],
      [],
      TODAY
    );
    expect(a.map((x) => x.title)).toEqual(['Late', 'Due']);
    expect(a[0].tone).toBe('critical');
  });
});

describe('reporting', () => {
  it('averages resolution time only over issues with a recorded resolution date', () => {
    const list = [
      issue({ status: 'Resolved', dateRaised: '2026-10-01', resolvedAt: '2026-10-11T10:00:00.000Z' }),
      issue({ status: 'Closed', dateRaised: '2026-10-01', resolvedAt: '2026-10-05T10:00:00.000Z' }),
      issue({ status: 'Resolved' }), // no resolvedAt — excluded
      issue({ status: 'In Progress' })
    ];
    expect(averageResolutionDays(list)).toEqual({ average: 7, sample: 2 });
    expect(averageResolutionDays([issue()])).toEqual({ average: null, sample: 0 });
  });
  it('counts by category, highest first', () => {
    const rows = countBy([issue({ category: 'A' }), issue({ category: 'B' }), issue({ category: 'B' })], 'category');
    expect(rows).toEqual([
      { label: 'B', count: 2 },
      { label: 'A', count: 1 }
    ]);
  });
  it('builds monthly rows for the requested window', () => {
    const rows = monthlySummary([issue({ dateRaised: '2026-09-03' }), issue({ dateRaised: '2026-10-02' })], [], [], [], 3, TODAY);
    expect(rows.map((r) => r.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(rows.map((r) => r.raised)).toEqual([0, 1, 1]);
  });
  it('summarises a week', () => {
    const s = weekSummary(TODAY, { issues: [issue({ dateRaised: '2026-10-13' }), issue({ dateRaised: '2026-10-05' })], meetings: [], feedback: [fb({ dateReceived: '2026-10-12' })], updates: [], activity: [] }, TODAY);
    expect(s.from).toBe('2026-10-12');
    expect(s.raised).toBe(1);
    expect(s.feedbackLogged).toBe(1);
  });
});

describe('feedback analysis', () => {
  it('detects repeated concerns in the same department', () => {
    const items = [fb({ description: 'Torque wrench away again' }), fb({ description: 'Waiting for torque wrench' }), fb({ category: 'Other', description: 'x y z' })];
    const r = repeatedConcerns(items, 90, TODAY);
    expect(r).toHaveLength(1);
    expect(r[0].items).toHaveLength(2);
  });
  it('detects similar wording across departments', () => {
    const items = [fb({ department: 'A', description: 'Microwave queue at lunch is too long' }), fb({ department: 'B', description: 'Long queue for the microwave at lunch' })];
    expect(repeatedConcerns(items, 90, TODAY)[0].department).toBeNull();
  });
  it('ignores feedback outside the look-back window', () => {
    const items = [fb({ dateReceived: '2026-01-01' }), fb({ dateReceived: '2026-01-02' })];
    expect(repeatedConcerns(items, 90, TODAY)).toHaveLength(0);
  });
  it('finds similar feedback for a draft', () => {
    const all = [fb({ id: 'a', description: 'Glove dispenser empty after lunch in resin area' }), fb({ id: 'b', description: 'Canteen prices went up' })];
    const sim = findSimilarFeedback({ description: 'The glove dispenser is empty again', category: 'Tools & Equipment', department: 'Joinery' }, all);
    expect(sim.map((s) => s.id)).toEqual(['a']);
  });
});

describe('validation', () => {
  const base = { title: 'Valid title', description: 'd', department: 'Joinery', category: 'Other', priority: 'Low' as const, status: 'New' as const, managementResponse: '', actionOwner: '', nextFollowUp: '', resolutionNotes: '', dateRaised: '2026-10-01' };
  it('accepts a valid issue', () => {
    expect(validateIssue(base)).toEqual({});
  });
  it('requires fields and resolution notes when resolving', () => {
    const e = validateIssue({ ...base, title: '', department: '', status: 'Resolved' });
    expect(Object.keys(e).sort()).toEqual(['department', 'resolutionNotes', 'title']);
  });
  it('rejects follow-up before date raised and invalid dates', () => {
    expect(validateIssue({ ...base, nextFollowUp: '2026-09-01' }).nextFollowUp).toMatch(/before/);
    expect(validateIssue({ ...base, dateRaised: '2026-13-01' }).dateRaised).toBeTruthy();
  });
  it('validates feedback', () => {
    expect(Object.keys(validateFeedback({ dateReceived: TODAY, department: '', category: '', description: 'hi' }))).toEqual(['department', 'category', 'description']);
  });
  it('warns about personal data', () => {
    expect(personalDataWarnings('email jo.bloggs@example.com')).toContain('an email address');
    expect(personalDataWarnings('call 07700 900123')).toContain('a phone number');
    expect(personalDataWarnings('clock number 4471')).toContain('an employee or clock number');
    expect(personalDataWarnings('Gloves run out after lunch')).toEqual([]);
  });
});

describe('issue history', () => {
  it('records status, response, follow-up and field changes', () => {
    const before = issue();
    const after = applyIssueChanges(before, { status: 'Resolved', managementResponse: 'Fixed', nextFollowUp: '2026-10-20', priority: 'High', resolutionNotes: 'Done' }, '2026-10-14T10:00:00.000Z', 'at BCF');
    const kinds = after.history.map((h) => h.kind);
    expect(kinds).toEqual(['resolved', 'response', 'followup', 'edited']);
    expect(after.resolvedAt).toBe('2026-10-14T10:00:00.000Z');
    expect(after.history[0].text).toContain('(at BCF)');
    expect(after.history[3].text).toBe('Updated priority and resolution notes (at BCF)');
  });
  it('clears resolvedAt when an issue is reopened and adds nothing when unchanged', () => {
    const resolved = issue({ status: 'Resolved', resolvedAt: '2026-10-10T00:00:00.000Z' });
    expect(applyIssueChanges(resolved, { status: 'In Progress' }, 'x').resolvedAt).toBeUndefined();
    expect(applyIssueChanges(resolved, { title: 'Test issue' }, 'x').history).toHaveLength(0);
  });
});

describe('demo data', () => {
  const { data, nextIssueNumber } = buildDemoData(TODAY, 5);
  it('labels every record as demo and numbers issues uniquely', () => {
    expect([...data.issues, ...data.meetings, ...data.feedback, ...data.updates, ...data.templates, ...data.plans].every((r) => r.demo)).toBe(true);
    const refs = data.issues.map((i) => i.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs[0]).toBe('BCF-0005');
    expect(nextIssueNumber).toBe(5 + data.issues.length);
  });
  it('produces valid issues and links', () => {
    for (const i of data.issues) expect(validateIssue(i)).toEqual({});
    const ids = new Set(data.issues.map((i) => i.id));
    for (const f of data.feedback) if (f.linkedIssueId) expect(ids.has(f.linkedIssueId)).toBe(true);
  });
  it('is removed by stripDemo without touching real records', () => {
    const real = issue({ id: 'real', ref: 'BCF-0001' });
    const realFb = fb({ id: 'rf', linkedIssueId: data.issues[0].id });
    const all = { ...data, issues: [...data.issues, real], feedback: [...data.feedback, realFb], settings: defaultSettings() };
    const s = stripDemo(all);
    expect(s.issues.map((i) => i.id)).toEqual(['real']);
    expect(s.feedback).toHaveLength(1);
    expect(s.feedback[0].linkedIssueId).toBeUndefined(); // dangling link to demo issue removed
    expect(s.meetings).toHaveLength(0);
    expect(s.activity).toHaveLength(0);
  });
  it('generates a meeting summary from approved notes', () => {
    const bcf = data.meetings.find((m) => m.type === 'BCF' && m.status === 'Completed')!;
    const text = meetingSummaryText(bcf, data.issues);
    expect(text).toContain('Business Communication Forum');
    expect(text).toContain('Response: Stores team');
    expect(text).toContain('Chase Planning lead');
  });
});

describe('backup', () => {
  const { data } = buildDemoData(TODAY, 1);
  const full = { ...data, settings: { ...defaultSettings(), nextIssueNumber: 13 } };
  it('round-trips through JSON', () => {
    const restored = parseBackup(JSON.stringify(createBackup(full)));
    expect(restored.issues).toHaveLength(full.issues.length);
    expect(restored.issues[0]).toEqual(JSON.parse(JSON.stringify(full.issues[0])));
    expect(restored.meetings[1].agenda.length).toBe(full.meetings[1].agenda.length);
    expect(restored.settings.nextIssueNumber).toBe(13);
  });
  it('rejects files that are not BCF Hub backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a BCF Hub backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'bcf-hub', schemaVersion: 99, data: {} }))).toThrow(/newer version/);
  });
  it('repairs bad field values and keeps issue numbering ahead of existing refs', () => {
    const r = parseBackup(JSON.stringify({ app: 'bcf-hub', schemaVersion: 1, data: { issues: [{ id: 'x', ref: 'BCF-0042', priority: 'Urgent', status: 'Weird', nextFollowUp: 'soon' }], settings: { nextIssueNumber: 3 } } }));
    expect(r.issues[0].priority).toBe('Medium');
    expect(r.issues[0].status).toBe('New');
    expect(r.issues[0].nextFollowUp).toBe('');
    expect(r.settings.nextIssueNumber).toBe(43);
  });
  it('rejects records without IDs', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'bcf-hub', schemaVersion: 1, data: { issues: [{ title: 'no id' }] } }))).toThrow(/missing its ID/);
  });
});

describe('pdf text', () => {
  it('converts typographic characters and strips emoji', () => {
    expect(pdfText('Hi all 👋 “quoted” – ok…')).toBe('Hi all "quoted" - ok...');
  });
});
