import { useState } from 'react';
import { useActions, useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { Card, DemoBadge, EmptyState, OverdueBadge, PageHeader, PriorityBadge, Section, Sheet, StatusBadge, TextArea, TextField } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { ISSUE_STATUSES, type HistoryEntry, type IssueStatus } from '../types';
import { addDays, formatDate, formatDateTime, relativeDay, todayISO } from '../lib/dates';
import { isOverdue, overdueDays } from '../lib/metrics';

const HISTORY_ICON: Record<HistoryEntry['kind'], IconName> = {
  created: 'plus',
  edited: 'edit',
  status: 'flag',
  response: 'chat',
  followup: 'clock',
  note: 'note',
  meeting: 'calendar',
  feedback: 'link',
  archived: 'archive',
  restored: 'archive',
  resolved: 'check'
};

type SheetKind = null | 'status' | 'response' | 'followup' | 'note';

export function IssueDetailPage({ id }: { id: string }) {
  const { issues, feedback, meetings } = useData();
  const actions = useActions();
  const router = useRouter();
  const { run, confirm } = useNotify();
  const issue = issues.find((i) => i.id === id);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [newStatus, setNewStatus] = useState<IssueStatus>('New');
  const [resolution, setResolution] = useState('');
  const [response, setResponse] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  if (!issue) {
    return (
      <div className="page">
        <PageHeader title="Issue" back="/issues" />
        <EmptyState icon="issues" title="Issue not found" text="It may have been deleted." action={<Link to="/issues" className="btn btn-secondary">Back to issues</Link>} />
      </div>
    );
  }

  const linkedFeedback = feedback.filter((f) => f.linkedIssueId === issue.id);
  const discussedIn = meetings.filter((m) => m.agenda.some((a) => a.issueId === issue.id || a.actionIssueId === issue.id)).sort((a, b) => b.date.localeCompare(a.date));
  const sourceMeeting = issue.sourceMeetingId ? meetings.find((m) => m.id === issue.sourceMeetingId) : undefined;
  const overdue = isOverdue(issue);
  const done = issue.status === 'Resolved' || issue.status === 'Closed';

  const open = (k: SheetKind) => {
    setErr('');
    if (k === 'status') {
      setNewStatus(issue.status);
      setResolution(issue.resolutionNotes);
    }
    if (k === 'response') setResponse(issue.managementResponse);
    if (k === 'followup') setFollowUp(issue.nextFollowUp || addDays(todayISO(), 7));
    if (k === 'note') setNote('');
    setSheet(k);
  };
  const close = () => setSheet(null);

  const saveStatus = async () => {
    const toDone = newStatus === 'Resolved' || newStatus === 'Closed';
    if (toDone && !resolution.trim()) return setErr('Add resolution notes before marking this issue resolved or closed.');
    const ok = await run(() => actions.updateIssue(issue.id, { status: newStatus, resolutionNotes: resolution, ...(toDone ? { nextFollowUp: '' } : {}) }), 'Status updated');
    if (ok) close();
  };
  const saveResponse = async () => {
    const patch: { managementResponse: string; status?: IssueStatus } = { managementResponse: response };
    // A recorded response moves an issue that was waiting on management into progress.
    if (response.trim() && (issue.status === 'Awaiting Response' || issue.status === 'Raised with Management')) patch.status = 'In Progress';
    const ok = await run(() => actions.updateIssue(issue.id, patch), patch.status ? 'Response recorded · status set to In Progress' : 'Response saved');
    if (ok) close();
  };
  const saveFollowUp = async (value: string) => {
    if (value && value < issue.dateRaised) return setErr('Follow-up cannot be before the date raised.');
    const ok = await run(() => actions.updateIssue(issue.id, { nextFollowUp: value }), value ? `Follow-up set for ${formatDate(value)}` : 'Follow-up removed');
    if (ok) close();
  };
  const saveNote = async () => {
    if (!note.trim()) return setErr('Write a note first.');
    const ok = await run(() => actions.addIssueNote(issue.id, note), 'Note added');
    if (ok) close();
  };
  const archive = async () => {
    await run(() => actions.setIssueArchived(issue.id, !issue.archived), issue.archived ? 'Issue restored' : 'Issue archived');
  };
  const remove = async () => {
    const yes = await confirm({ title: `Delete ${issue.ref}?`, message: 'This permanently deletes the issue and its history. Archiving keeps it for reports instead.', confirmLabel: 'Delete', danger: true });
    if (!yes) return;
    await run(() => actions.deleteIssue(issue.id), 'Issue deleted');
    router.navigate('/issues', { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title={issue.ref}
        back="/issues"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.navigate(`/issues/${issue.id}/edit`)}>
            <Icon name="edit" size={16} /> Edit
          </button>
        }
      />

      <div className="detail-hero">
        <div className="row-meta">
          <span className="ref">{issue.ref}</span>
          <span className="dot-sep">·</span>
          <span>Raised {formatDate(issue.dateRaised)}</span>
          <DemoBadge show={!!issue.demo} />
          {issue.archived && <span className="badge badge-muted">Archived</span>}
        </div>
        <h2 className="detail-title">{issue.title}</h2>
        <div className="row-badges">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {overdue && <OverdueBadge days={overdueDays(issue)} />}
        </div>
      </div>

      {overdue && (
        <div className="alert alert-critical" role="status">
          <Icon name="alert" size={18} />
          <div>
            <strong>Follow-up overdue.</strong> Was due {formatDate(issue.nextFollowUp)}. Chase {issue.actionOwner || 'the action owner'} or set a new date.
          </div>
        </div>
      )}

      <div className="quick-actions" role="group" aria-label="Issue actions">
        <button className="qa" onClick={() => open('status')}>
          <Icon name="flag" /> Status
        </button>
        <button className="qa" onClick={() => open('response')}>
          <Icon name="chat" /> Response
        </button>
        <button className="qa" onClick={() => open('followup')} disabled={done}>
          <Icon name="clock" /> Follow-up
        </button>
        <button className="qa" onClick={() => open('note')}>
          <Icon name="note" /> Note
        </button>
      </div>

      <Card>
        <dl className="kv">
          <div>
            <dt>Department / shed</dt>
            <dd>{issue.department || '—'}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{issue.category || '—'}</dd>
          </div>
          <div>
            <dt>Action owner</dt>
            <dd>{issue.actionOwner || <span className="muted">Not assigned</span>}</dd>
          </div>
          <div>
            <dt>Next follow-up</dt>
            <dd className={overdue ? 'text-critical' : ''}>{done ? <span className="muted">Not needed</span> : issue.nextFollowUp ? `${formatDate(issue.nextFollowUp, { weekday: true })} · ${relativeDay(issue.nextFollowUp)}` : <span className="muted">Not set</span>}</dd>
          </div>
          {issue.resolvedAt && done && (
            <div>
              <dt>Resolved</dt>
              <dd>{formatDate(issue.resolvedAt.slice(0, 10))}</dd>
            </div>
          )}
          {sourceMeeting && (
            <div>
              <dt>Created from</dt>
              <dd>
                <Link to={`/meetings/${sourceMeeting.id}`} className="text-link">
                  {sourceMeeting.title} · {formatDate(sourceMeeting.date)}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <Section title="Description">
        <Card>
          <p className="prose">{issue.description}</p>
        </Card>
      </Section>

      <Section title="Management response" action={<button className="text-btn" onClick={() => open('response')}>{issue.managementResponse ? 'Update' : 'Record'}</button>}>
        <Card>{issue.managementResponse ? <p className="prose">{issue.managementResponse}</p> : <p className="muted">No response recorded yet.</p>}</Card>
      </Section>

      {(issue.resolutionNotes || done) && (
        <Section title="Resolution notes">
          <Card>{issue.resolutionNotes ? <p className="prose">{issue.resolutionNotes}</p> : <p className="muted">None recorded.</p>}</Card>
        </Section>
      )}

      <Section title={`Linked feedback (${linkedFeedback.length})`} action={<Link to="/feedback" className="text-btn">Feedback log</Link>}>
        {linkedFeedback.length ? (
          <div className="list">
            {linkedFeedback.map((f) => (
              <Link key={f.id} to={`/feedback?open=${f.id}`} className="row">
                <div className="row-main">
                  <div className="row-meta">
                    {formatDate(f.dateReceived)} · {f.department}
                  </div>
                  <p className="row-text">“{f.description}”</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted small pad-x">No feedback linked. Link feedback from the Feedback log.</p>
        )}
      </Section>

      {discussedIn.length > 0 && (
        <Section title="Discussed in meetings">
          <div className="list">
            {discussedIn.map((m) => (
              <Link key={m.id} to={`/meetings/${m.id}`} className="row">
                <div className="row-main">
                  <div className="row-meta">
                    {m.type} · {formatDate(m.date)}
                  </div>
                  <p className="row-title">{m.title}</p>
                </div>
                <Icon name="chevronRight" size={18} className="row-chevron" />
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Activity history">
        <ol className="timeline">
          {[...issue.history].reverse().map((h) => (
            <li key={h.id} className={`tl tl-${h.kind}`}>
              <span className="tl-icon">
                <Icon name={HISTORY_ICON[h.kind] ?? 'info'} size={14} />
              </span>
              <div>
                <p className="tl-text">{h.text}</p>
                <p className="tl-time">{formatDateTime(h.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <div className="danger-zone">
        <button className="btn btn-secondary" onClick={archive}>
          <Icon name="archive" size={18} /> {issue.archived ? 'Restore from archive' : 'Archive issue'}
        </button>
        <button className="btn btn-danger-ghost" onClick={remove}>
          <Icon name="trash" size={18} /> Delete
        </button>
      </div>

      {/* --- Sheets --- */}
      <Sheet open={sheet === 'status'} onClose={close} title="Change status" footer={<SheetButtons onCancel={close} onSave={saveStatus} />}>
        <div className="status-picker" role="radiogroup" aria-label="Status">
          {ISSUE_STATUSES.map((s) => (
            <button key={s} role="radio" aria-checked={newStatus === s} className={`status-opt ${newStatus === s ? 'selected' : ''}`} onClick={() => setNewStatus(s)}>
              <StatusBadge status={s} />
              {newStatus === s && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
        {(newStatus === 'Resolved' || newStatus === 'Closed') && (
          <TextArea label="Resolution notes" required value={resolution} onChange={setResolution} rows={3} error={err} hint="What was done, and has it been confirmed with apprentices?" />
        )}
      </Sheet>

      <Sheet open={sheet === 'response'} onClose={close} title="Management response" footer={<SheetButtons onCancel={close} onSave={saveResponse} />}>
        <TextArea label="Response from management" value={response} onChange={setResponse} rows={5} hint="Record the response as given. It will be timestamped in the activity history." />
        {(issue.status === 'Awaiting Response' || issue.status === 'Raised with Management') && response.trim() && <p className="info-note">Saving will move the status to “In Progress”.</p>}
      </Sheet>

      <Sheet open={sheet === 'followup'} onClose={close} title="Next follow-up" footer={<SheetButtons onCancel={close} onSave={() => saveFollowUp(followUp)} />}>
        <div className="chips">
          {[
            ['Tomorrow', 1],
            ['In 3 days', 3],
            ['In 1 week', 7],
            ['In 2 weeks', 14]
          ].map(([l, d]) => (
            <button key={l} className={`chip ${followUp === addDays(todayISO(), d as number) ? 'chip-active' : ''}`} onClick={() => setFollowUp(addDays(todayISO(), d as number))}>
              {l}
            </button>
          ))}
        </div>
        <TextField label="Follow-up date" type="date" value={followUp} onChange={setFollowUp} error={err} />
        {issue.nextFollowUp && (
          <button className="text-btn danger" onClick={() => saveFollowUp('')}>
            Remove follow-up date
          </button>
        )}
      </Sheet>

      <Sheet open={sheet === 'note'} onClose={close} title="Add note" footer={<SheetButtons onCancel={close} onSave={saveNote} saveLabel="Add note" />}>
        <TextArea label="Note" value={note} onChange={setNote} rows={4} error={err} hint="e.g. “Chased by email”, “Spoke to supervisor”. Avoid names." />
      </Sheet>
    </div>
  );
}

export function SheetButtons({ onCancel, onSave, saveLabel = 'Save', disabled }: { onCancel: () => void; onSave: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <div className="btn-row">
      <button className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
      <button className="btn btn-primary" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </button>
    </div>
  );
}

