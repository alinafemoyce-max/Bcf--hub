import { useMemo, useState } from 'react';
import { useActions, useData } from '../state/store';
import { useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { PageHeader, SelectField, TextArea, TextField, EmptyState } from '../components/ui';
import { ISSUE_STATUSES, PRIORITIES, type Issue } from '../types';
import { hasErrors, personalDataWarnings, validateIssue, type Errors, type IssueDraft } from '../lib/validation';
import { addDays, todayISO } from '../lib/dates';
import { listJoin } from '../lib/issueOps';

export function blankIssueDraft(): IssueDraft {
  return {
    title: '',
    description: '',
    department: '',
    category: '',
    priority: 'Medium',
    status: 'New',
    managementResponse: '',
    actionOwner: '',
    nextFollowUp: addDays(todayISO(), 7),
    resolutionNotes: '',
    dateRaised: todayISO()
  };
}

export function draftFromIssue(i: Issue): IssueDraft {
  const { title, description, department, category, priority, status, managementResponse, actionOwner, nextFollowUp, resolutionNotes, dateRaised } = i;
  return { title, description, department, category, priority, status, managementResponse, actionOwner, nextFollowUp, resolutionNotes, dateRaised };
}

export function IssueFields({ draft, setDraft, errors, compact }: { draft: IssueDraft; setDraft: (d: IssueDraft) => void; errors: Errors; compact?: boolean }) {
  const { settings } = useData();
  const set = <K extends keyof IssueDraft>(k: K, v: IssueDraft[K]) => setDraft({ ...draft, [k]: v });
  const departments = useMemo(() => [...new Set([...settings.departments, draft.department].filter(Boolean))], [settings.departments, draft.department]);
  const categories = useMemo(() => [...new Set([...settings.categories, draft.category].filter(Boolean))], [settings.categories, draft.category]);
  const pii = personalDataWarnings(`${draft.title} ${draft.description} ${draft.managementResponse} ${draft.resolutionNotes}`);
  const done = draft.status === 'Resolved' || draft.status === 'Closed';

  return (
    <>
      <TextField label="Issue title" required value={draft.title} onChange={(v) => set('title', v)} error={errors.title} maxLength={120} placeholder="e.g. Glove dispenser empty by mid-afternoon" autoComplete="off" />
      <TextArea
        label="Description"
        required
        value={draft.description}
        onChange={(v) => set('description', v)}
        error={errors.description}
        rows={compact ? 3 : 4}
        hint="Describe the issue, not the person. Avoid names and identifying details."
      />
      {pii.length > 0 && (
        <p className="inline-warning" role="status">
          This text looks like it contains {listJoin(pii)}. Remove personal details unless they are essential.
        </p>
      )}
      <div className="grid-2">
        <SelectField label="Department or shed" required value={draft.department} onChange={(v) => set('department', v)} options={departments} placeholder="Select…" error={errors.department} />
        <SelectField label="Category" required value={draft.category} onChange={(v) => set('category', v)} options={categories} placeholder="Select…" error={errors.category} />
      </div>
      <div className="grid-2">
        <SelectField label="Priority" value={draft.priority} onChange={(v) => set('priority', v as IssueDraft['priority'])} options={PRIORITIES} error={errors.priority} />
        <SelectField label="Status" value={draft.status} onChange={(v) => set('status', v as IssueDraft['status'])} options={ISSUE_STATUSES} error={errors.status} />
      </div>
      <div className="grid-2">
        <TextField label="Date raised" required type="date" value={draft.dateRaised} onChange={(v) => set('dateRaised', v)} error={errors.dateRaised} max={todayISO()} />
        <TextField label="Next follow-up" type="date" value={draft.nextFollowUp} onChange={(v) => set('nextFollowUp', v)} error={errors.nextFollowUp} hint={done ? 'Not tracked once resolved.' : undefined} />
      </div>
      <TextField label="Action owner / responsible role" value={draft.actionOwner} onChange={(v) => set('actionOwner', v)} error={errors.actionOwner} placeholder="e.g. Training Manager" hint="Use a role rather than a person’s name where possible." autoComplete="off" />
      {!compact && <TextArea label="Management response" value={draft.managementResponse} onChange={(v) => set('managementResponse', v)} error={errors.managementResponse} rows={3} />}
      {(!compact || done) && (
        <TextArea label="Resolution notes" value={draft.resolutionNotes} onChange={(v) => set('resolutionNotes', v)} error={errors.resolutionNotes} rows={3} required={done} hint="Required when marking an issue Resolved or Closed." />
      )}
    </>
  );
}

export function IssueFormPage({ id }: { id?: string }) {
  const data = useData();
  const actions = useActions();
  const router = useRouter();
  const { runFor } = useNotify();
  const existing = id ? data.issues.find((i) => i.id === id) : undefined;
  const feedbackIds = !id ? (router.query.get('feedback') ?? '').split(',').filter(Boolean) : [];
  const fromFeedback = data.feedback.filter((f) => feedbackIds.includes(f.id)).sort((a, b) => a.dateReceived.localeCompare(b.dateReceived));

  const [draft, setDraft] = useState<IssueDraft>(() => {
    if (existing) return draftFromIssue(existing);
    const d = blankIssueDraft();
    if (fromFeedback.length === 1) {
      d.department = fromFeedback[0].department;
      d.category = fromFeedback[0].category;
      d.description = fromFeedback[0].description;
    } else if (fromFeedback.length > 1) {
      const depts = [...new Set(fromFeedback.map((f) => f.department))];
      d.department = depts.length === 1 ? depts[0] : '';
      d.category = fromFeedback[0].category;
      d.description = `Raised ${fromFeedback.length} times in apprentice feedback${depts.length > 1 ? ` across ${depts.join(', ')}` : ''}:\n${fromFeedback.map((f) => `- ${f.description}`).join('\n')}`;
    }
    return d;
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  if (id && !existing) {
    return (
      <div className="page">
        <PageHeader title="Issue" back="/issues" />
        <EmptyState icon="issues" title="Issue not found" text="It may have been deleted." />
      </div>
    );
  }

  const save = async () => {
    const d: IssueDraft = { ...draft, nextFollowUp: draft.status === 'Resolved' || draft.status === 'Closed' ? '' : draft.nextFollowUp };
    const e = validateIssue(d);
    setErrors(e);
    if (hasErrors(e)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.field-error input, .field-error textarea, .field-error select')?.focus());
      return;
    }
    setSaving(true);
    const result = await runFor<Issue>(
      () => (existing ? actions.updateIssue(existing.id, d) : actions.createIssue(d, fromFeedback.length ? { source: 'from apprentice feedback', feedbackIds: fromFeedback.map((f) => f.id) } : {})),
      existing ? 'Issue updated' : 'Issue created'
    );
    setSaving(false);
    if (result) router.navigate(`/issues/${result.id}`, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title={existing ? `Edit ${existing.ref}` : 'New issue'}
        back={existing ? `/issues/${existing.id}` : '/issues'}
        actions={
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {fromFeedback.length > 0 && <p className="info-note">Creating an issue from {fromFeedback.length > 1 ? `${fromFeedback.length} pieces of` : ''} apprentice feedback. The feedback will be linked automatically.</p>}
        {hasErrors(errors) && (
          <p className="form-error" role="alert">
            Please fix {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? 's' : ''} highlighted below.
          </p>
        )}
        <IssueFields draft={draft} setDraft={setDraft} errors={errors} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => router.back(existing ? `/issues/${existing.id}` : '/issues')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {existing ? 'Save changes' : 'Create issue'}
          </button>
        </div>
      </form>
    </div>
  );
}
