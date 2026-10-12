// Application state: everything is loaded from IndexedDB into memory once, and every change is
// written back to IndexedDB before the in-memory state is updated.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityLog, AppData, CommsUpdate, Feedback, Issue, Meeting, Settings, Template, UpdateStatus, WeeklyPlan } from '../types';
import { defaultSettings, deleteRecord, loadAll, putRecord, putSettings, replaceAll, requestPersistence, writeBatch, type StoreName } from '../db/db';
import { buildDemoData } from '../db/seed';
import { applyIssueChanges, historyEntry, truncate } from '../lib/issueOps';
import { formatIssueRef, nowISO, uid } from '../lib/ids';
import { todayISO } from '../lib/dates';
import type { IssueDraft } from '../lib/validation';

interface Actions {
  createIssue(draft: IssueDraft, opts?: { source?: string; sourceMeetingId?: string; feedbackIds?: string[] }): Promise<Issue>;
  updateIssue(id: string, patch: Partial<IssueDraft>, source?: string): Promise<Issue>;
  addIssueNote(id: string, text: string): Promise<void>;
  setIssueArchived(id: string, archived: boolean): Promise<void>;
  deleteIssue(id: string): Promise<void>;
  saveMeeting(m: Meeting): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  saveFeedback(f: Feedback): Promise<Feedback>;
  deleteFeedback(id: string): Promise<void>;
  linkFeedback(feedbackId: string, issueId: string | undefined): Promise<void>;
  saveUpdate(u: CommsUpdate, historyText?: string): Promise<CommsUpdate>;
  setUpdateStatus(id: string, status: UpdateStatus): Promise<void>;
  deleteUpdate(id: string): Promise<void>;
  saveTemplate(t: Template): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
  savePlan(p: WeeklyPlan): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  loadDemo(): Promise<void>;
  clearDemo(): Promise<void>;
  eraseAll(): Promise<void>;
  importData(data: AppData): Promise<void>;
}

interface StoreValue {
  data: AppData;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

const emptyData = (): AppData => ({ issues: [], meetings: [], feedback: [], updates: [], templates: [], plans: [], activity: [], settings: defaultSettings() });

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A ref mirrors state so async actions always read the latest data.
  const ref = useRef<AppData>(emptyData());

  const commit = useCallback((next: AppData) => {
    ref.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    loadAll()
      .then((d) => {
        commit(d);
        requestPersistence();
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [commit]);

  const actions = useMemo<Actions>(() => {
    const logEntry = (entity: ActivityLog['entity'], entityId: string | undefined, kind: ActivityLog['kind'], text: string, demo?: boolean): ActivityLog => ({
      id: uid(), at: nowISO(), entity, entityId, kind, text, demo
    });
    const withLog = (d: AppData, entry: ActivityLog): AppData => ({ ...d, activity: [entry, ...d.activity] });
    const find = <K extends 'issues' | 'meetings' | 'feedback' | 'updates' | 'templates'>(k: K, id: string) => {
      const item = (ref.current[k] as { id: string }[]).find((x) => x.id === id);
      if (!item) throw new Error('That record no longer exists. It may have been deleted.');
      return item as AppData[K][number];
    };

    async function persistIssue(issue: Issue, entry?: ActivityLog) {
      await writeBatch([{ store: 'issues', put: issue }, ...(entry ? [{ store: 'activity' as const, put: entry }] : [])]);
      let d: AppData = { ...ref.current, issues: upsert(ref.current.issues, issue) };
      if (entry) d = withLog(d, entry);
      commit(d);
    }

    return {
      async createIssue(draft, opts = {}) {
        const s = ref.current.settings;
        const at = nowISO();
        const ref_ = formatIssueRef(s.nextIssueNumber);
        const issue: Issue = {
          ...draft,
          title: draft.title.trim(),
          description: draft.description.trim(),
          id: uid(),
          ref: ref_,
          archived: false,
          sourceMeetingId: opts.sourceMeetingId,
          resolvedAt: draft.status === 'Resolved' || draft.status === 'Closed' ? at : undefined,
          history: [historyEntry('created', opts.source ? `Issue created ${opts.source}` : 'Issue created', at)],
          createdAt: at,
          updatedAt: at
        };
        const linked = (opts.feedbackIds ?? []).map((fid) => ({ ...find('feedback', fid), linkedIssueId: issue.id, updatedAt: at }));
        if (linked.length) issue.history.push(historyEntry('feedback', `${linked.length} feedback item${linked.length > 1 ? 's' : ''} linked`, at));
        const settings: Settings = { ...s, nextIssueNumber: s.nextIssueNumber + 1 };
        const entry = logEntry('issue', issue.id, 'created', `${ref_} raised: ${truncate(issue.title, 60)}`);
        await writeBatch([
          { store: 'issues', put: issue },
          { store: 'activity', put: entry },
          ...linked.map((f) => ({ store: 'feedback' as const, put: f }))
        ]);
        await putSettings(settings);
        let fb = ref.current.feedback;
        for (const f of linked) fb = upsert(fb, f);
        commit(withLog({ ...ref.current, issues: [...ref.current.issues, issue], feedback: fb, settings }, entry));
        return issue;
      },

      async updateIssue(id, patch, source) {
        const old = find('issues', id);
        const next = applyIssueChanges(old, patch, nowISO(), source);
        const newEntries = next.history.slice(old.history.length);
        const statusEntry = newEntries.find((h) => h.kind === 'status' || h.kind === 'resolved');
        const respEntry = newEntries.find((h) => h.kind === 'response');
        const main = statusEntry ?? respEntry ?? newEntries[0];
        const entry = main ? logEntry('issue', id, main.kind, `${next.ref}: ${truncate(main.text, 90)}`, old.demo) : undefined;
        await persistIssue(next, entry);
        return next;
      },

      async addIssueNote(id, text) {
        const old = find('issues', id);
        const at = nowISO();
        const next: Issue = { ...old, updatedAt: at, history: [...old.history, historyEntry('note', text.trim(), at)] };
        await persistIssue(next, logEntry('issue', id, 'note', `${old.ref}: note added`, old.demo));
      },

      async setIssueArchived(id, archived) {
        const old = find('issues', id);
        const at = nowISO();
        const kind = archived ? 'archived' : 'restored';
        const next: Issue = { ...old, archived, updatedAt: at, history: [...old.history, historyEntry(kind, archived ? 'Issue archived' : 'Issue restored from archive', at)] };
        await persistIssue(next, logEntry('issue', id, kind, `${old.ref} ${archived ? 'archived' : 'restored'}`, old.demo));
      },

      async deleteIssue(id) {
        const old = find('issues', id);
        const at = nowISO();
        const fb = ref.current.feedback.filter((f) => f.linkedIssueId === id).map((f) => ({ ...f, linkedIssueId: undefined, updatedAt: at }));
        const entry = logEntry('issue', undefined, 'edited', `${old.ref} deleted`);
        await writeBatch([{ store: 'issues', del: id }, { store: 'activity', put: entry }, ...fb.map((f) => ({ store: 'feedback' as const, put: f }))]);
        let feedback = ref.current.feedback;
        for (const f of fb) feedback = upsert(feedback, f);
        commit(withLog({ ...ref.current, issues: ref.current.issues.filter((i) => i.id !== id), feedback }, entry));
      },

      async saveMeeting(m) {
        const existing = ref.current.meetings.find((x) => x.id === m.id);
        const next = { ...m, updatedAt: nowISO() };
        let entry: ActivityLog | undefined;
        if (!existing) entry = logEntry('meeting', m.id, 'meeting', `${m.type} meeting scheduled for ${m.date}`);
        else if (existing.status !== m.status) entry = logEntry('meeting', m.id, 'meeting', `${m.title} marked ${m.status.toLowerCase()}`, m.demo);
        await writeBatch([{ store: 'meetings', put: next }, ...(entry ? [{ store: 'activity' as const, put: entry }] : [])]);
        let d: AppData = { ...ref.current, meetings: upsert(ref.current.meetings, next) };
        if (entry) d = withLog(d, entry);
        commit(d);
        return next;
      },

      async deleteMeeting(id) {
        const m = find('meetings', id);
        const at = nowISO();
        const ups = ref.current.updates.filter((u) => u.meetingId === id).map((u) => ({ ...u, meetingId: undefined, updatedAt: at }));
        const entry = logEntry('meeting', undefined, 'edited', `${m.title} (${m.date}) deleted`);
        await writeBatch([{ store: 'meetings', del: id }, { store: 'activity', put: entry }, ...ups.map((u) => ({ store: 'updates' as const, put: u }))]);
        let updates = ref.current.updates;
        for (const u of ups) updates = upsert(updates, u);
        commit(withLog({ ...ref.current, meetings: ref.current.meetings.filter((x) => x.id !== id), updates }, entry));
      },

      async saveFeedback(f) {
        const isNew = !ref.current.feedback.some((x) => x.id === f.id);
        const next = { ...f, description: f.description.trim(), updatedAt: nowISO() };
        const entry = isNew ? logEntry('feedback', f.id, 'feedback', `Feedback logged — ${f.category} (${f.department})`) : undefined;
        await writeBatch([{ store: 'feedback', put: next }, ...(entry ? [{ store: 'activity' as const, put: entry }] : [])]);
        let d: AppData = { ...ref.current, feedback: upsert(ref.current.feedback, next) };
        if (entry) d = withLog(d, entry);
        commit(d);
        return next;
      },

      async deleteFeedback(id) {
        await deleteRecord('feedback', id);
        commit({ ...ref.current, feedback: ref.current.feedback.filter((f) => f.id !== id) });
      },

      async linkFeedback(feedbackId, issueId) {
        const f = find('feedback', feedbackId);
        const at = nowISO();
        const nextF: Feedback = { ...f, linkedIssueId: issueId, updatedAt: at };
        const ops: { store: StoreName; put: unknown }[] = [{ store: 'feedback', put: nextF }];
        let issues = ref.current.issues;
        if (issueId) {
          const iss = find('issues', issueId);
          const nextI: Issue = { ...iss, updatedAt: at, history: [...iss.history, historyEntry('feedback', `Linked feedback (${f.department}): “${truncate(f.description, 100)}”`, at)] };
          ops.push({ store: 'issues', put: nextI });
          issues = upsert(issues, nextI);
        }
        await writeBatch(ops);
        commit({ ...ref.current, feedback: upsert(ref.current.feedback, nextF), issues });
      },

      async saveUpdate(u, historyText) {
        const isNew = !ref.current.updates.some((x) => x.id === u.id);
        const at = nowISO();
        const text = historyText ?? (isNew ? 'Draft created' : 'Edited');
        const next: CommsUpdate = { ...u, updatedAt: at, history: [...u.history, { at, text }] };
        const entry = isNew ? logEntry('update', u.id, 'created', `Update drafted: ${truncate(u.title, 60)}`) : undefined;
        await writeBatch([{ store: 'updates', put: next }, ...(entry ? [{ store: 'activity' as const, put: entry }] : [])]);
        let d: AppData = { ...ref.current, updates: upsert(ref.current.updates, next) };
        if (entry) d = withLog(d, entry);
        commit(d);
        return next;
      },

      async setUpdateStatus(id, status) {
        const u = find('updates', id);
        if (u.status === status) return;
        const at = nowISO();
        const next: CommsUpdate = {
          ...u,
          status,
          publishedAt: status === 'Published' ? at : u.publishedAt && status !== 'Draft' ? u.publishedAt : undefined,
          updatedAt: at,
          history: [...u.history, { at, text: `Marked ${status.toLowerCase()}` }]
        };
        const entry = logEntry('update', id, 'status', `Update “${truncate(u.title, 50)}” marked ${status.toLowerCase()}`, u.demo);
        await writeBatch([{ store: 'updates', put: next }, { store: 'activity', put: entry }]);
        commit(withLog({ ...ref.current, updates: upsert(ref.current.updates, next) }, entry));
      },

      async deleteUpdate(id) {
        await deleteRecord('updates', id);
        commit({ ...ref.current, updates: ref.current.updates.filter((u) => u.id !== id) });
      },

      async saveTemplate(t) {
        const next = { ...t, updatedAt: nowISO() };
        await putRecord('templates', next);
        commit({ ...ref.current, templates: upsert(ref.current.templates, next) });
        return next;
      },

      async deleteTemplate(id) {
        await deleteRecord('templates', id);
        commit({ ...ref.current, templates: ref.current.templates.filter((t) => t.id !== id) });
      },

      async savePlan(p) {
        const next = { ...p, updatedAt: nowISO() };
        await putRecord('plans', next);
        commit({ ...ref.current, plans: upsert(ref.current.plans, next) });
      },

      async updateSettings(patch) {
        const next = { ...ref.current.settings, ...patch, id: 'settings' as const };
        await putSettings(next);
        commit({ ...ref.current, settings: next });
      },

      async loadDemo() {
        const base = stripDemo(ref.current);
        const { data: demo, nextIssueNumber } = buildDemoData(todayISO(), base.settings.nextIssueNumber);
        const next: AppData = {
          issues: [...base.issues, ...demo.issues],
          meetings: [...base.meetings, ...demo.meetings],
          feedback: [...base.feedback, ...demo.feedback],
          updates: [...base.updates, ...demo.updates],
          templates: [...base.templates, ...demo.templates],
          // Don't overwrite a weekly plan the user has already written.
          plans: [...base.plans, ...demo.plans.filter((p) => !base.plans.some((b) => b.id === p.id))],
          activity: [...demo.activity, ...base.activity].sort((a, b) => b.at.localeCompare(a.at)),
          settings: { ...base.settings, nextIssueNumber, demoLoadedAt: nowISO(), onboarded: true }
        };
        await replaceAll(next);
        commit(next);
      },

      async clearDemo() {
        const next = stripDemo(ref.current);
        await replaceAll(next);
        commit(next);
      },

      async eraseAll() {
        const next: AppData = { ...emptyData(), settings: { ...defaultSettings(), departments: ref.current.settings.departments, categories: ref.current.settings.categories, onboarded: true } };
        await replaceAll(next);
        commit(next);
      },

      async importData(d) {
        await replaceAll(d);
        commit(d);
      }
    };
  }, [commit]);

  if (loadError) {
    return (
      <div className="fatal" role="alert">
        <h1>BCF Hub couldn’t open its local database</h1>
        <p>{loadError}</p>
        <p>This can happen in private browsing mode or if site storage is blocked. Try a normal Safari window, or check Settings › Safari › Advanced › Website Data.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="splash" aria-busy="true">
        <div className="splash-mark">BCF</div>
      </div>
    );
  }
  return <StoreContext.Provider value={{ data, actions }}>{children}</StoreContext.Provider>;
}

/** Removes demo records; also unlinks references from real records to demo ones. */
export function stripDemo(d: AppData): AppData {
  const demoIssueIds = new Set(d.issues.filter((i) => i.demo).map((i) => i.id));
  const demoMeetingIds = new Set(d.meetings.filter((m) => m.demo).map((m) => m.id));
  return {
    issues: d.issues.filter((i) => !i.demo).map((i) => (i.sourceMeetingId && demoMeetingIds.has(i.sourceMeetingId) ? { ...i, sourceMeetingId: undefined } : i)),
    meetings: d.meetings
      .filter((m) => !m.demo)
      .map((m) => ({
        ...m,
        agenda: m.agenda.map((a) => ({
          ...a,
          issueId: a.issueId && demoIssueIds.has(a.issueId) ? undefined : a.issueId,
          actionIssueId: a.actionIssueId && demoIssueIds.has(a.actionIssueId) ? undefined : a.actionIssueId
        }))
      })),
    feedback: d.feedback.filter((f) => !f.demo).map((f) => (f.linkedIssueId && demoIssueIds.has(f.linkedIssueId) ? { ...f, linkedIssueId: undefined } : f)),
    updates: d.updates.filter((u) => !u.demo).map((u) => (u.meetingId && demoMeetingIds.has(u.meetingId) ? { ...u, meetingId: undefined } : u)),
    templates: d.templates.filter((t) => !t.demo),
    plans: d.plans.filter((p) => !p.demo),
    activity: d.activity.filter((a) => !a.demo),
    settings: { ...d.settings, demoLoadedAt: undefined }
  };
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

export function useData(): AppData {
  return useStore().data;
}

export function useActions(): Actions {
  return useStore().actions;
}

export function hasDemoData(d: AppData): boolean {
  return d.issues.some((i) => i.demo) || d.meetings.some((m) => m.demo) || d.feedback.some((f) => f.demo) || d.updates.some((u) => u.demo);
}
