import { useEffect, useMemo, useState } from 'react';
import { useActions, useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { useExport } from '../components/FileExport';
import { Card, DemoBadge, EmptyState, MeetingStatusBadge, PageHeader, SearchBox, Section, SelectField, Sheet, StatusBadge, TextArea, TextField } from '../components/ui';
import { Icon } from '../components/Icon';
import { SheetButtons } from './IssueDetailPage';
import { IssueFields } from './IssueFormPage';
import { ISSUE_STATUSES, type AgendaItem, type ChecklistItem, type IssueStatus, type Meeting } from '../types';
import { addDays, formatDate, todayISO } from '../lib/dates';
import { nowISO, uid } from '../lib/ids';
import { isActive } from '../lib/metrics';
import { buildAgendaPdf, buildMinutesPdf, loadPdfLibs } from '../lib/pdf';
import { meetingSummaryText } from '../lib/summary';
import { hasErrors, validateIssue, type Errors, type IssueDraft } from '../lib/validation';
import { truncate } from '../lib/issueOps';
import { IS_PREVIEW } from '../lib/env';
import { matchesSearch } from './IssuesPage';

type SheetState =
  | null
  | { kind: 'item'; item: AgendaItem; isNew: boolean }
  | { kind: 'pick' }
  | { kind: 'apply'; item: AgendaItem }
  | { kind: 'action'; item: AgendaItem }
  | { kind: 'followup' };

export function MeetingDetailPage({ id }: { id: string }) {
  const { meetings, issues } = useData();
  const actions = useActions();
  const router = useRouter();
  const { run, runFor, confirm } = useNotify();
  const { exportFile } = useExport();
  const meeting = meetings.find((m) => m.id === id);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [minutes, setMinutes] = useState(meeting?.minutes ?? '');

  useEffect(() => {
    if (!IS_PREVIEW) loadPdfLibs().catch(() => undefined); // warm the PDF library so exports are quick
  }, []);
  useEffect(() => {
    setMinutes(meeting?.minutes ?? '');
    // Only reset when switching meetings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  if (!meeting) {
    return (
      <div className="page">
        <PageHeader title="Meeting" back="/meetings" />
        <EmptyState icon="calendar" title="Meeting not found" text="It may have been deleted." />
      </div>
    );
  }

  const save = (patch: Partial<Meeting>, msg?: string) => run(() => actions.saveMeeting({ ...meeting, ...patch }), msg);
  const issueById = (iid?: string) => (iid ? issues.find((i) => i.id === iid) : undefined);
  const minutesDirty = minutes !== meeting.minutes;
  const openFollowUps = meeting.followUps.filter((f) => !f.done).length;

  const moveItem = (idx: number, dir: -1 | 1) => {
    const a = meeting.agenda.slice();
    const j = idx + dir;
    if (j < 0 || j >= a.length) return;
    [a[idx], a[j]] = [a[j], a[idx]];
    save({ agenda: a });
  };
  const removeItem = async (item: AgendaItem) => {
    const yes = await confirm({ title: 'Remove agenda item?', message: `“${item.title}” will be removed from this meeting. Linked issues are not affected.`, confirmLabel: 'Remove', danger: true });
    if (yes) save({ agenda: meeting.agenda.filter((x) => x.id !== item.id) }, 'Agenda item removed');
  };

  const toggleApproved = async () => {
    if (!meeting.notesApproved) {
      const yes = await confirm({
        title: 'Mark notes as approved?',
        message: 'Only do this once the chair or management has agreed the notes. Approved notes can be used to generate a Teams summary.',
        confirmLabel: 'Mark approved'
      });
      if (!yes) return;
    }
    save({ notesApproved: !meeting.notesApproved }, meeting.notesApproved ? 'Approval removed' : 'Notes marked approved');
  };

  const generateSummary = async () => {
    const body = meetingSummaryText(meeting, issues);
    const u = await runFor(
      () =>
        actions.saveUpdate({
          id: uid(),
          title: `${meeting.type === 'BCF' ? 'BCF' : 'Pre-BCF'} summary — ${formatDate(meeting.date, { year: false })}`,
          body,
          status: 'Draft',
          meetingId: meeting.id,
          history: [],
          createdAt: nowISO(),
          updatedAt: nowISO()
        }, 'Draft generated from approved meeting notes'),
      'Summary draft created'
    );
    if (u) router.navigate(`/updates/${u.id}`);
  };

  const removeMeeting = async () => {
    const yes = await confirm({ title: 'Delete meeting?', message: 'The agenda, minutes and checklist for this meeting will be deleted. Issues and tracked actions are kept.', confirmLabel: 'Delete', danger: true });
    if (!yes) return;
    if (await run(() => actions.deleteMeeting(meeting.id), 'Meeting deleted')) router.navigate('/meetings', { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title={meeting.type === 'BCF' ? 'BCF meeting' : 'Pre-BCF meeting'}
        back="/meetings"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.navigate(`/meetings/${meeting.id}/edit`)}>
            <Icon name="edit" size={16} /> Edit
          </button>
        }
      />

      <div className="detail-hero">
        <div className="row-meta">
          <span className={`type-tag ${meeting.type === 'BCF' ? 'bcf' : 'pre'}`}>{meeting.type}</span>
          <MeetingStatusBadge status={meeting.status} />
          <DemoBadge show={!!meeting.demo} />
        </div>
        <h2 className="detail-title">{meeting.title}</h2>
        <p className="muted">
          {formatDate(meeting.date, { weekday: true })}
          {meeting.time && ` · ${meeting.time}`}
          {meeting.location && ` · ${meeting.location}`}
        </p>
        {meeting.attendees && <p className="small muted">Attendees: {meeting.attendees}</p>}
      </div>

      <div className="btn-row wrap">
        {meeting.status === 'Planned' && (
          <button className="btn btn-secondary btn-sm" onClick={() => save({ status: 'Completed' }, 'Meeting marked completed')}>
            <Icon name="check" size={16} /> Mark completed
          </button>
        )}
        {!IS_PREVIEW && (
        <>
        <button className="btn btn-secondary btn-sm" onClick={() => exportFile(() => buildAgendaPdf(meeting, issues), 'Agenda PDF')}>
          <Icon name="file" size={16} /> Agenda PDF
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => exportFile(() => buildMinutesPdf(meeting, issues), 'Minutes PDF')}>
          <Icon name="file" size={16} /> Minutes PDF
        </button>
        </>
        )}
      </div>

      {/* ------------------------------------------------ Agenda */}
      <Section title={`Agenda (${meeting.agenda.length})`}>
        {meeting.agenda.length === 0 && <p className="muted small pad-x">Build the agenda by adding tracked issues or your own items.</p>}
        <ol className="agenda">
          {meeting.agenda.map((a, idx) => {
            const issue = issueById(a.issueId);
            const action = issueById(a.actionIssueId);
            return (
              <li key={a.id} className="agenda-item card">
                <div className="agenda-head">
                  <span className="agenda-num">{idx + 1}</span>
                  <div className="agenda-title">
                    <p className="row-title">{a.title}</p>
                    {issue ? (
                      <Link to={`/issues/${issue.id}`} className="linked-issue">
                        <Icon name="link" size={13} /> {issue.ref} · <StatusBadge status={issue.status} />
                      </Link>
                    ) : a.issueId ? (
                      <span className="small muted">Linked issue was deleted</span>
                    ) : null}
                  </div>
                  <div className="agenda-move">
                    <button className="icon-btn sm" onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label={`Move “${a.title}” up`}>
                      <Icon name="arrowUp" size={16} />
                    </button>
                    <button className="icon-btn sm" onClick={() => moveItem(idx, 1)} disabled={idx === meeting.agenda.length - 1} aria-label={`Move “${a.title}” down`}>
                      <Icon name="arrowDown" size={16} />
                    </button>
                  </div>
                </div>
                {a.presenterNotes && <AgendaField label="Rep notes" text={a.presenterNotes} />}
                <AgendaField label="Management response" text={a.managementResponse} empty="Not recorded" />
                <AgendaField label="Decision / outcome" text={a.decision} empty="Not recorded" />
                {action && (
                  <Link to={`/issues/${action.id}`} className="action-link">
                    <Icon name="flag" size={14} /> Tracked action {action.ref} · {action.status}
                  </Link>
                )}
                <div className="agenda-actions">
                  <button className="text-btn" onClick={() => setSheet({ kind: 'item', item: a, isNew: false })}>
                    <Icon name="edit" size={15} /> Record
                  </button>
                  {issue && a.managementResponse.trim() && issue.managementResponse.trim() !== a.managementResponse.trim() && (
                    <button className="text-btn" onClick={() => setSheet({ kind: 'apply', item: a })}>
                      <Icon name="chat" size={15} /> Update issue
                    </button>
                  )}
                  {a.decision.trim() && !action && (
                    <button className="text-btn" onClick={() => setSheet({ kind: 'action', item: a })}>
                      <Icon name="flag" size={15} /> Create action
                    </button>
                  )}
                  <button className="text-btn danger" onClick={() => removeItem(a)}>
                    <Icon name="trash" size={15} /> Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={() => setSheet({ kind: 'pick' })}>
            <Icon name="issues" size={18} /> Add issues
          </button>
          <button className="btn btn-secondary" onClick={() => setSheet({ kind: 'item', isNew: true, item: { id: uid(), title: '', presenterNotes: '', managementResponse: '', decision: '' } })}>
            <Icon name="plus" size={18} /> Custom item
          </button>
        </div>
      </Section>

      {/* ------------------------------------------------ Minutes */}
      <Section title="Minutes & notes">
        <Card>
          <TextArea label="General minutes" value={minutes} onChange={setMinutes} rows={5} hint="Overall notes. Record responses and decisions against each agenda item above." />
          <div className="btn-row end">
            {minutesDirty && <span className="small muted">Unsaved changes</span>}
            <button className="btn btn-primary btn-sm" disabled={!minutesDirty} onClick={() => save({ minutes }, 'Minutes saved')}>
              Save minutes
            </button>
          </div>
          <div className="switch-row">
            <div>
              <p className="row-title">Notes approved</p>
              <p className="small muted">Approved notes can be turned into a Teams summary.</p>
            </div>
            <button role="switch" aria-checked={meeting.notesApproved} className={`switch ${meeting.notesApproved ? 'on' : ''}`} onClick={toggleApproved} aria-label="Notes approved">
              <span />
            </button>
          </div>
          <button className="btn btn-primary full" disabled={!meeting.notesApproved || minutesDirty} onClick={generateSummary}>
            <Icon name="megaphone" size={18} /> Generate Teams summary
          </button>
          {!meeting.notesApproved && <p className="small muted center">Mark the notes approved to enable the summary generator.</p>}
        </Card>
      </Section>

      {/* ------------------------------------------------ Follow-up checklist */}
      <Section title={`Follow-up checklist${meeting.followUps.length ? ` (${openFollowUps} open)` : ''}`} action={<button className="text-btn" onClick={() => setSheet({ kind: 'followup' })}><Icon name="plus" size={15} /> Add</button>}>
        {meeting.followUps.length ? (
          <ul className="checklist card">
            {meeting.followUps.map((f) => (
              <ChecklistRow
                key={f.id}
                item={f}
                onToggle={() => save({ followUps: meeting.followUps.map((x) => (x.id === f.id ? { ...x, done: !x.done } : x)) })}
                onDelete={() => save({ followUps: meeting.followUps.filter((x) => x.id !== f.id) }, 'Follow-up removed')}
              />
            ))}
          </ul>
        ) : (
          <p className="muted small pad-x">No follow-ups yet. Add things you need to do after the meeting.</p>
        )}
      </Section>

      <div className="danger-zone">
        <button className="btn btn-danger-ghost" onClick={removeMeeting}>
          <Icon name="trash" size={18} /> Delete meeting
        </button>
      </div>

      {sheet?.kind === 'item' && (
        <AgendaItemSheet
          item={sheet.item}
          isNew={sheet.isNew}
          onClose={() => setSheet(null)}
          onSave={async (item) => {
            const agenda = sheet.isNew ? [...meeting.agenda, item] : meeting.agenda.map((x) => (x.id === item.id ? item : x));
            if (await save({ agenda }, sheet.isNew ? 'Item added' : 'Agenda item saved')) setSheet(null);
          }}
        />
      )}
      {sheet?.kind === 'pick' && (
        <IssuePickerSheet
          meeting={meeting}
          onClose={() => setSheet(null)}
          onAdd={async (ids) => {
            const items: AgendaItem[] = ids.map((iid) => {
              const i = issueById(iid)!;
              return { id: uid(), title: i.title, issueId: i.id, presenterNotes: '', managementResponse: '', decision: '' };
            });
            if (await save({ agenda: [...meeting.agenda, ...items] }, `${items.length} issue${items.length > 1 ? 's' : ''} added to agenda`)) setSheet(null);
          }}
        />
      )}
      {sheet?.kind === 'apply' && <ApplyResponseSheet meeting={meeting} item={sheet.item} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'action' && <CreateActionSheet meeting={meeting} item={sheet.item} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'followup' && (
        <FollowUpSheet
          onClose={() => setSheet(null)}
          onSave={async (f) => {
            if (await save({ followUps: [...meeting.followUps, f] }, 'Follow-up added')) setSheet(null);
          }}
        />
      )}
    </div>
  );
}

function AgendaField({ label, text, empty }: { label: string; text: string; empty?: string }) {
  return (
    <div className="agenda-field">
      <p className="label-xs">{label}</p>
      {text ? <p className="prose small">{text}</p> : <p className="small muted">{empty ?? '—'}</p>}
    </div>
  );
}

function ChecklistRow({ item, onToggle, onDelete }: { item: ChecklistItem; onToggle: () => void; onDelete: () => void }) {
  const overdue = !item.done && item.dueDate && item.dueDate < todayISO();
  return (
    <li className={`check-row ${item.done ? 'done' : ''}`}>
      <button role="checkbox" aria-checked={item.done} className={`checkbox ${item.done ? 'on' : ''}`} onClick={onToggle} aria-label={item.text}>
        {item.done && <Icon name="check" size={14} />}
      </button>
      <div className="check-text">
        <p>{item.text}</p>
        {item.dueDate && <p className={`small ${overdue ? 'text-critical' : 'muted'}`}>{overdue ? 'Overdue · ' : 'Due '}{formatDate(item.dueDate, { weekday: true, year: false })}</p>}
      </div>
      <button className="icon-btn sm" onClick={onDelete} aria-label={`Delete “${item.text}”`}>
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}

function AgendaItemSheet({ item, isNew, onClose, onSave }: { item: AgendaItem; isNew: boolean; onClose: () => void; onSave: (i: AgendaItem) => void }) {
  const [d, setD] = useState(item);
  const [err, setErr] = useState('');
  const submit = () => {
    if (!d.title.trim()) return setErr('Give the agenda item a title.');
    onSave({ ...d, title: d.title.trim() });
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add agenda item' : 'Agenda item'} footer={<SheetButtons onCancel={onClose} onSave={submit} />}>
      <TextField label="Title" required value={d.title} onChange={(v) => setD({ ...d, title: v })} error={err} maxLength={120} />
      <TextArea label="Rep notes / talking points" value={d.presenterNotes} onChange={(v) => setD({ ...d, presenterNotes: v })} rows={3} />
      <TextArea label="Management response" value={d.managementResponse} onChange={(v) => setD({ ...d, managementResponse: v })} rows={3} />
      <TextArea label="Decision / outcome" value={d.decision} onChange={(v) => setD({ ...d, decision: v })} rows={3} hint="Decisions can be converted into tracked actions." />
    </Sheet>
  );
}

function IssuePickerSheet({ meeting, onClose, onAdd }: { meeting: Meeting; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const { issues } = useData();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const onAgenda = new Set(meeting.agenda.map((a) => a.issueId).filter(Boolean));
  const candidates = useMemo(
    () => issues.filter((i) => isActive(i) && !onAgenda.has(i.id) && matchesSearch(i, q.trim())).sort((a, b) => (a.priority === 'High' ? -1 : 0) - (b.priority === 'High' ? -1 : 0) || b.dateRaised.localeCompare(a.dateRaised)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [issues, q, meeting.agenda]
  );
  const toggle = (iid: string) => setPicked((p) => (p.includes(iid) ? p.filter((x) => x !== iid) : [...p, iid]));
  return (
    <Sheet open onClose={onClose} title="Add issues to agenda" footer={<SheetButtons onCancel={onClose} onSave={() => onAdd(picked)} saveLabel={picked.length ? `Add ${picked.length}` : 'Add'} disabled={!picked.length} />}>
      <SearchBox value={q} onChange={setQ} placeholder="Search active issues" />
      {candidates.length ? (
        <ul className="pick-list">
          {candidates.map((i) => (
            <li key={i.id}>
              <button role="checkbox" aria-checked={picked.includes(i.id)} className={`pick ${picked.includes(i.id) ? 'on' : ''}`} onClick={() => toggle(i.id)}>
                <span className={`checkbox ${picked.includes(i.id) ? 'on' : ''}`}>{picked.includes(i.id) && <Icon name="check" size={14} />}</span>
                <span className="pick-body">
                  <span className="row-meta">
                    {i.ref} · {i.department} · {i.priority}
                  </span>
                  <span className="row-title">{i.title}</span>
                  <StatusBadge status={i.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No active issues {q ? 'match your search' : 'left to add'}.</p>
      )}
    </Sheet>
  );
}

function ApplyResponseSheet({ meeting, item, onClose }: { meeting: Meeting; item: AgendaItem; onClose: () => void }) {
  const { issues } = useData();
  const actions = useActions();
  const { run } = useNotify();
  const issue = issues.find((i) => i.id === item.issueId)!;
  const [status, setStatus] = useState<IssueStatus>(issue.status === 'Awaiting Response' || issue.status === 'Raised with Management' || issue.status === 'New' || issue.status === 'Under Review' ? 'In Progress' : issue.status);
  const [followUp, setFollowUp] = useState(issue.nextFollowUp && issue.nextFollowUp >= todayISO() ? issue.nextFollowUp : addDays(todayISO(), 14));
  const [err, setErr] = useState('');
  const done = status === 'Resolved' || status === 'Closed';
  const submit = async () => {
    if (done && !issue.resolutionNotes.trim()) return setErr('This issue has no resolution notes. Open the issue to resolve it with notes.');
    const ok = await run(
      () => actions.updateIssue(issue.id, { managementResponse: item.managementResponse, status, nextFollowUp: done ? '' : followUp }, `at ${meeting.type} on ${formatDate(meeting.date)}`),
      `${issue.ref} updated`
    );
    if (ok) onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Update ${issue.ref}`} footer={<SheetButtons onCancel={onClose} onSave={submit} saveLabel="Update issue" />}>
      <p className="label-xs">Response to record</p>
      <p className="quote">{item.managementResponse}</p>
      <SelectField label="Set status" value={status} onChange={(v) => setStatus(v as IssueStatus)} options={ISSUE_STATUSES} error={err} />
      {!done && <TextField label="Next follow-up" type="date" value={followUp} onChange={setFollowUp} />}
      <p className="small muted">This is added to the issue’s activity history with a reference to this meeting.</p>
    </Sheet>
  );
}

function CreateActionSheet({ meeting, item, onClose }: { meeting: Meeting; item: AgendaItem; onClose: () => void }) {
  const { issues } = useData();
  const actions = useActions();
  const { runFor } = useNotify();
  const linked = issues.find((i) => i.id === item.issueId);
  const [draft, setDraft] = useState<IssueDraft>({
    title: truncate(`Action: ${item.decision.trim().split('\n')[0]}`, 120),
    description: `Decision at ${meeting.title} (${formatDate(meeting.date)}): ${item.decision.trim()}${item.managementResponse.trim() ? `\n\nManagement response: ${item.managementResponse.trim()}` : ''}\n\nAgenda item: ${item.title}${linked ? ` (${linked.ref})` : ''}`,
    department: linked?.department ?? '',
    category: linked?.category ?? '',
    priority: linked?.priority ?? 'Medium',
    status: 'In Progress',
    managementResponse: item.managementResponse,
    actionOwner: '',
    nextFollowUp: addDays(todayISO(), 14),
    resolutionNotes: '',
    dateRaised: meeting.date <= todayISO() ? meeting.date : todayISO()
  });
  const [errors, setErrors] = useState<Errors>({});
  const submit = async () => {
    const e = validateIssue(draft);
    setErrors(e);
    if (hasErrors(e)) return;
    const created = await runFor(async () => {
      const iss = await actions.createIssue(draft, { source: `from ${meeting.type} decision (${formatDate(meeting.date)})`, sourceMeetingId: meeting.id });
      await actions.saveMeeting({ ...meeting, agenda: meeting.agenda.map((a) => (a.id === item.id ? { ...a, actionIssueId: iss.id } : a)) });
      return iss;
    }, 'Tracked action created');
    if (created) onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Create tracked action" footer={<SheetButtons onCancel={onClose} onSave={submit} saveLabel="Create action" />}>
      <p className="small muted">The decision becomes a tracked issue with its own follow-up date, owner and history.</p>
      <IssueFields draft={draft} setDraft={setDraft} errors={errors} compact />
    </Sheet>
  );
}

function FollowUpSheet({ onClose, onSave }: { onClose: () => void; onSave: (f: ChecklistItem) => void }) {
  const [text, setText] = useState('');
  const [due, setDue] = useState(addDays(todayISO(), 7));
  const [err, setErr] = useState('');
  return (
    <Sheet
      open
      onClose={onClose}
      title="Add follow-up"
      footer={
        <SheetButtons
          onCancel={onClose}
          onSave={() => (text.trim() ? onSave({ id: uid(), text: text.trim(), done: false, dueDate: due }) : setErr('Describe the follow-up.'))}
          saveLabel="Add"
        />
      }
    >
      <TextField label="Follow-up" required value={text} onChange={setText} error={err} placeholder="e.g. Post summary in Teams" maxLength={160} />
      <TextField label="Due date" type="date" value={due} onChange={setDue} />
    </Sheet>
  );
}
