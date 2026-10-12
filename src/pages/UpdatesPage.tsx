import { useMemo, useState } from 'react';
import { useActions, useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { DemoBadge, EmptyState, PageHeader, Segmented, Sheet, TextArea, TextField, UpdateStatusBadge } from '../components/ui';
import { Icon } from '../components/Icon';
import { SheetButtons } from './IssueDetailPage';
import { UPDATE_STATUSES, type Template, type UpdateStatus } from '../types';
import { copyText } from '../lib/clipboard';
import { formatDate, timeAgo } from '../lib/dates';
import { nowISO, uid } from '../lib/ids';
import { meetingSummaryText } from '../lib/summary';
import { hasErrors, validateTemplate, type Errors } from '../lib/validation';

type Tab = 'updates' | 'templates';

export function UpdatesPage() {
  const { updates, templates, meetings, issues } = useData();
  const actions = useActions();
  const router = useRouter();
  const { toast, run, runFor, confirm } = useNotify();
  const tab: Tab = router.query.get('tab') === 'templates' ? 'templates' : 'updates';
  const [status, setStatus] = useState<'all' | UpdateStatus>('all');
  const [genOpen, setGenOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const list = useMemo(
    () => updates.filter((u) => status === 'all' || u.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [updates, status]
  );
  const approvedMeetings = meetings.filter((m) => m.notesApproved).sort((a, b) => b.date.localeCompare(a.date));
  const counts = Object.fromEntries(UPDATE_STATUSES.map((s) => [s, updates.filter((u) => u.status === s).length])) as Record<UpdateStatus, number>;

  const copy = async (text: string) => {
    try {
      await copyText(text);
      toast('Copied — paste it into the Teams channel', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const generate = async (meetingId: string) => {
    const m = meetings.find((x) => x.id === meetingId)!;
    const u = await runFor(
      () =>
        actions.saveUpdate(
          { id: uid(), title: `${m.type === 'BCF' ? 'BCF' : 'Pre-BCF'} summary — ${formatDate(m.date, { year: false })}`, body: meetingSummaryText(m, issues), status: 'Draft', meetingId: m.id, history: [], createdAt: nowISO(), updatedAt: nowISO() },
          'Draft generated from approved meeting notes'
        ),
      'Summary draft created'
    );
    if (u) router.navigate(`/updates/${u.id}`);
  };

  return (
    <div className="page">
      <PageHeader
        title="Updates"
        large
        subtitle="Draft and track messages for the apprentice Teams channel"
        actions={
          tab === 'updates' ? (
            <button className="icon-btn icon-btn-primary" onClick={() => router.navigate('/updates/new')} aria-label="New update">
              <Icon name="plus" size={22} />
            </button>
          ) : (
            <button className="icon-btn icon-btn-primary" onClick={() => setEditing({ id: uid(), name: '', body: '', createdAt: nowISO(), updatedAt: nowISO() })} aria-label="New template">
              <Icon name="plus" size={22} />
            </button>
          )
        }
      />
      <Segmented
        label="Communications"
        value={tab}
        onChange={(t) => router.navigate(t === 'templates' ? '/updates?tab=templates' : '/updates', { replace: true })}
        options={[
          { value: 'updates', label: 'Updates', count: updates.length },
          { value: 'templates', label: 'Templates', count: templates.length }
        ]}
      />

      {tab === 'updates' ? (
        <>
          <button className="gen-card" onClick={() => setGenOpen(true)}>
            <span className="gen-icon">
              <Icon name="megaphone" />
            </span>
            <span>
              <strong>Meeting summary generator</strong>
              <span className="small muted">Create a draft from approved meeting notes</span>
            </span>
            <Icon name="chevronRight" size={18} className="row-chevron" />
          </button>
          <div className="chips">
            <button className={`chip ${status === 'all' ? 'chip-active' : ''}`} onClick={() => setStatus('all')} aria-pressed={status === 'all'}>
              All {updates.length}
            </button>
            {UPDATE_STATUSES.map((s) => (
              <button key={s} className={`chip ${status === s ? 'chip-active' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
                {s} {counts[s]}
              </button>
            ))}
          </div>
          {list.length ? (
            <div className="list">
              {list.map((u) => (
                <div key={u.id} className="row update-row">
                  <Link to={`/updates/${u.id}`} className="row-main">
                    <div className="row-meta">
                      <UpdateStatusBadge status={u.status} />
                      <span>{u.status === 'Published' && u.publishedAt ? `Published ${formatDate(u.publishedAt.slice(0, 10))}` : `Edited ${timeAgo(u.updatedAt)}`}</span>
                      <DemoBadge show={!!u.demo} />
                    </div>
                    <p className="row-title">{u.title}</p>
                    <p className="row-preview">{u.body}</p>
                  </Link>
                  <button className="icon-btn" onClick={() => copy(u.body)} aria-label={`Copy “${u.title}”`}>
                    <Icon name="copy" size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="megaphone" title={status === 'all' ? 'No updates yet' : `No ${status.toLowerCase()} updates`} text="Draft an update, start from a template, or generate one from approved meeting notes." />
          )}
          <p className="footnote">BCF Hub never posts to Teams. Copy approved text and post it yourself.</p>
        </>
      ) : (
        <>
          {templates.length ? (
            <div className="list">
              {templates
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <div key={t.id} className="row template-row">
                    <button className="row-main as-button" onClick={() => setEditing(t)} aria-label={`Edit template ${t.name}`}>
                      <div className="row-meta">
                        <Icon name="template" size={14} /> Template <DemoBadge show={!!t.demo} />
                      </div>
                      <p className="row-title">{t.name}</p>
                      <p className="row-preview">{t.body}</p>
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => router.navigate(`/updates/new?template=${t.id}`)}>
                      Use
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState icon="template" title="No templates" text="Save reusable messages, like feedback reminders. Use {placeholders} for parts you fill in each time." />
          )}
        </>
      )}

      <Sheet open={genOpen} onClose={() => setGenOpen(false)} title="Generate from meeting">
        {approvedMeetings.length ? (
          <ul className="pick-list">
            {approvedMeetings.map((m) => (
              <li key={m.id}>
                <button className="pick" onClick={() => { setGenOpen(false); generate(m.id); }}>
                  <span className="pick-body">
                    <span className="row-meta">
                      {m.type} · {formatDate(m.date)}
                    </span>
                    <span className="row-title">{m.title}</span>
                    <span className="small muted">{m.agenda.filter((a) => a.decision || a.managementResponse).length} recorded outcomes</span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No meetings have approved notes yet. Open a meeting, record outcomes, then switch on “Notes approved”.</p>
        )}
      </Sheet>

      {editing && (
        <TemplateSheet
          template={editing}
          isNew={!templates.some((t) => t.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (t) => {
            if (await run(() => actions.saveTemplate(t), 'Template saved')) setEditing(null);
          }}
          onDelete={async () => {
            if (await confirm({ title: 'Delete template?', message: `“${editing.name}” will be deleted. Updates already written from it are kept.`, confirmLabel: 'Delete', danger: true })) {
              if (await run(() => actions.deleteTemplate(editing.id), 'Template deleted')) setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

export function TemplateSheet({ template, isNew, onClose, onSave, onDelete }: { template: Template; isNew: boolean; onClose: () => void; onSave: (t: Template) => void; onDelete?: () => void }) {
  const [d, setD] = useState(template);
  const [errors, setErrors] = useState<Errors>({});
  const submit = () => {
    const e = validateTemplate(d);
    setErrors(e);
    if (!hasErrors(e)) onSave({ ...d, name: d.name.trim() });
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'New template' : 'Edit template'} footer={<SheetButtons onCancel={onClose} onSave={submit} />}>
      <TextField label="Template name" required value={d.name} onChange={(v) => setD({ ...d, name: v })} error={errors.name} maxLength={80} />
      <TextArea label="Template text" required value={d.body} onChange={(v) => setD({ ...d, body: v })} error={errors.body} rows={8} hint="Use {curly brackets} for parts to fill in, e.g. {date}." />
      {!isNew && onDelete && (
        <button className="text-btn danger" onClick={onDelete}>
          <Icon name="trash" size={15} /> Delete template
        </button>
      )}
    </Sheet>
  );
}
