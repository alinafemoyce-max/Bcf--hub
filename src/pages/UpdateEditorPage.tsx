import { useState } from 'react';
import { useActions, useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { DemoBadge, EmptyState, PageHeader, Section, Sheet, TextArea, TextField, UpdateStatusBadge } from '../components/ui';
import { Icon } from '../components/Icon';
import { TemplateSheet } from './UpdatesPage';
import { UPDATE_STATUSES, type CommsUpdate, type UpdateStatus } from '../types';
import { copyText } from '../lib/clipboard';
import { formatDate, formatDateTime } from '../lib/dates';
import { nowISO, uid } from '../lib/ids';
import { hasErrors, personalDataWarnings, validateUpdate, type Errors } from '../lib/validation';
import { listJoin } from '../lib/issueOps';

const placeholders = (s: string) => [...new Set(s.match(/\{[^{}\n]{1,40}\}/g) ?? [])];

export function UpdateEditorPage({ id }: { id?: string }) {
  const { updates, templates, meetings } = useData();
  const actions = useActions();
  const router = useRouter();
  const { toast, run, runFor, confirm } = useNotify();
  const existing = id ? updates.find((u) => u.id === id) : undefined;

  const [draft, setDraft] = useState<CommsUpdate>(() => {
    if (existing) return existing;
    const t = templates.find((x) => x.id === router.query.get('template'));
    return { id: uid(), title: t ? t.name : '', body: t ? t.body : '', status: 'Draft', history: [], createdAt: nowISO(), updatedAt: nowISO() };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [tplOpen, setTplOpen] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);

  if (id && !existing) {
    return (
      <div className="page">
        <PageHeader title="Update" back="/updates" />
        <EmptyState icon="megaphone" title="Update not found" text="It may have been deleted." />
      </div>
    );
  }

  const isNew = !existing;
  const dirty = isNew ? !!(draft.title || draft.body) : draft.title !== existing!.title || draft.body !== existing!.body;
  const holes = placeholders(draft.body);
  const pii = personalDataWarnings(draft.body);
  const meeting = draft.meetingId ? meetings.find((m) => m.id === draft.meetingId) : undefined;
  const current = existing ?? draft;

  const save = async (silent = false) => {
    const e = validateUpdate(draft);
    setErrors(e);
    if (hasErrors(e)) return null;
    // Editing approved/published text sends it back to draft so it is re-approved.
    const resetStatus = !isNew && existing!.status !== 'Draft' && existing!.body !== draft.body;
    const next = { ...draft, title: draft.title.trim(), status: resetStatus ? ('Draft' as const) : draft.status, history: existing?.history ?? [] };
    const saved = await runFor(() => actions.saveUpdate(next, isNew ? 'Draft created' : resetStatus ? 'Text edited — returned to draft for re-approval' : 'Edited'), silent ? undefined : 'Update saved');
    if (saved) {
      setDraft(saved);
      if (isNew) router.navigate(`/updates/${saved.id}`, { replace: true });
    }
    return saved;
  };

  const setStatus = async (s: UpdateStatus) => {
    if (s === current.status) return;
    if (dirty) {
      const saved = await save(true);
      if (!saved) return;
    } else if (isNew) return toast('Save the draft first.', 'info');
    if (s !== 'Draft' && holes.length) {
      return toast(`Fill in the placeholders first: ${holes.join(', ')}`, 'error');
    }
    if (s === 'Published') {
      const yes = await confirm({ title: 'Mark as published?', message: 'Only mark this as published after you have posted it in the Teams channel yourself. BCF Hub does not post anything.', confirmLabel: 'Mark published' });
      if (!yes) return;
    }
    if (await run(() => actions.setUpdateStatus(draft.id, s), `Marked ${s.toLowerCase()}`)) setDraft((d) => ({ ...d, status: s }));
  };

  const copy = async () => {
    if (holes.length) toast(`Heads up: still contains ${holes.join(', ')}`, 'info');
    try {
      await copyText(draft.body);
      if (!holes.length) toast('Copied — paste it into the Teams channel', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete update?', message: 'This update and its history will be deleted.', confirmLabel: 'Delete', danger: true }))) return;
    if (await run(() => actions.deleteUpdate(draft.id), 'Update deleted')) router.navigate('/updates', { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title={isNew ? 'New update' : 'Update'}
        back="/updates"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => save()} disabled={!dirty}>
            Save
          </button>
        }
      />
      <div className="form">
        {!isNew && (
          <div className="row-meta">
            <UpdateStatusBadge status={current.status} />
            {current.publishedAt && current.status === 'Published' && <span>Published {formatDate(current.publishedAt.slice(0, 10))}</span>}
            <DemoBadge show={!!current.demo} />
          </div>
        )}
        {meeting && (
          <Link to={`/meetings/${meeting.id}`} className="info-note link-note">
            <Icon name="calendar" size={16} /> Generated from {meeting.title} · {formatDate(meeting.date)}
          </Link>
        )}

        <TextField label="Title (for your reference)" required value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} error={errors.title} maxLength={120} />
        <TextArea label="Message" required value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} error={errors.body} rows={12} hint={`${draft.body.length} characters`} />
        {holes.length > 0 && (
          <p className="inline-warning" role="status">
            Fill in before posting: {holes.join(', ')}
          </p>
        )}
        {pii.length > 0 && (
          <p className="inline-warning" role="status">
            This message looks like it contains {listJoin(pii)}. Remove personal details before posting to a channel.
          </p>
        )}

        <div className="btn-row wrap">
          <button className="btn btn-secondary btn-sm" onClick={() => setTplOpen(true)} disabled={!templates.length}>
            <Icon name="template" size={16} /> Insert template
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSaveTpl(true)} disabled={!draft.body.trim()}>
            <Icon name="download" size={16} /> Save as template
          </button>
          <button className="btn btn-primary btn-sm" onClick={copy} disabled={!draft.body.trim()}>
            <Icon name="copy" size={16} /> Copy text
          </button>
        </div>

        {!isNew && (
          <Section title="Status">
            <div className="status-flow" role="radiogroup" aria-label="Update status">
              {UPDATE_STATUSES.map((s, i) => (
                <button key={s} role="radio" aria-checked={current.status === s} className={`flow-step ${current.status === s ? 'active' : ''} ${UPDATE_STATUSES.indexOf(current.status) > i ? 'passed' : ''}`} onClick={() => setStatus(s)}>
                  <span className="flow-num">{i + 1}</span>
                  {s}
                </button>
              ))}
            </div>
            <p className="small muted">Draft → approved by the right person → published by you in Teams. Editing approved text returns it to draft.</p>
          </Section>
        )}

        {!isNew && current.history.length > 0 && (
          <Section title="History">
            <ol className="timeline">
              {[...current.history].reverse().map((h, i) => (
                <li key={i} className="tl">
                  <span className="tl-icon">
                    <Icon name="clock" size={14} />
                  </span>
                  <div>
                    <p className="tl-text">{h.text}</p>
                    <p className="tl-time">{formatDateTime(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {!isNew && (
          <div className="danger-zone">
            <button className="btn btn-danger-ghost" onClick={remove}>
              <Icon name="trash" size={18} /> Delete update
            </button>
          </div>
        )}
      </div>

      <Sheet open={tplOpen} onClose={() => setTplOpen(false)} title="Insert template">
        <ul className="pick-list">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                className="pick"
                onClick={() => {
                  setDraft((d) => ({ ...d, title: d.title || t.name, body: d.body.trim() ? `${d.body.trimEnd()}\n\n${t.body}` : t.body }));
                  setTplOpen(false);
                }}
              >
                <span className="pick-body">
                  <span className="row-title">{t.name}</span>
                  <span className="row-preview">{t.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {draft.body.trim() && <p className="small muted">The template is added below your existing text.</p>}
      </Sheet>

      {saveTpl && (
        <TemplateSheet
          template={{ id: uid(), name: draft.title, body: draft.body, createdAt: nowISO(), updatedAt: nowISO() }}
          isNew
          onClose={() => setSaveTpl(false)}
          onSave={async (t) => {
            if (await run(() => actions.saveTemplate(t), 'Saved as template')) setSaveTpl(false);
          }}
        />
      )}
    </div>
  );
}
