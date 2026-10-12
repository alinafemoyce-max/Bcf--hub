import { useEffect, useMemo, useState } from 'react';
import { useActions, useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { DemoBadge, EmptyState, PageHeader, SearchBox, Section, SelectField, Sheet, StatusBadge, TextArea, TextField } from '../components/ui';
import { Icon } from '../components/Icon';
import { SheetButtons } from './IssueDetailPage';
import { matchesSearch } from './IssuesPage';
import type { Feedback } from '../types';
import { formatDate, todayISO } from '../lib/dates';
import { nowISO, uid } from '../lib/ids';
import { findSimilarFeedback, repeatedConcerns } from '../lib/metrics';
import { hasErrors, personalDataWarnings, validateFeedback, type Errors } from '../lib/validation';
import { listJoin, truncate } from '../lib/issueOps';

type LinkFilter = 'all' | 'unlinked' | 'linked';

export function FeedbackPage() {
  const { feedback, issues, settings } = useData();
  const actions = useActions();
  const router = useRouter();
  const { run, confirm } = useNotify();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [cat, setCat] = useState('');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [editing, setEditing] = useState<Feedback | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  // Deep links: ?new=1 opens the form, ?open=<id> opens a record.
  useEffect(() => {
    if (router.query.get('new') === '1') {
      setEditing(blankFeedback());
      router.navigate('/feedback', { replace: true });
    }
    const o = router.query.get('open');
    if (o) {
      setOpenId(o);
      router.navigate('/feedback', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const concerns = useMemo(() => repeatedConcerns(feedback), [feedback]);
  const list = useMemo(
    () =>
      feedback
        .filter(
          (f) =>
            (!dept || f.department === dept) &&
            (!cat || f.category === cat) &&
            (linkFilter === 'all' || (linkFilter === 'linked' ? !!f.linkedIssueId : !f.linkedIssueId)) &&
            (!q.trim() || `${f.description} ${f.department} ${f.category}`.toLowerCase().includes(q.trim().toLowerCase()))
        )
        .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived) || b.createdAt.localeCompare(a.createdAt)),
    [feedback, dept, cat, linkFilter, q]
  );
  const departments = [...new Set([...settings.departments, ...feedback.map((f) => f.department)])].filter(Boolean);
  const categories = [...new Set([...settings.categories, ...feedback.map((f) => f.category)])].filter(Boolean);
  const opened = openId ? feedback.find((f) => f.id === openId) : undefined;
  const issueRef = (id?: string) => (id ? issues.find((i) => i.id === id) : undefined);
  const unlinkedCount = feedback.filter((f) => !f.linkedIssueId).length;

  return (
    <div className="page">
      <PageHeader
        title="Feedback"
        back="/more"
        actions={
          <button className="icon-btn icon-btn-primary" onClick={() => setEditing(blankFeedback())} aria-label="Log feedback">
            <Icon name="plus" size={22} />
          </button>
        }
      />
      <div className="page-intro">
        <h1>Apprentice feedback</h1>
        <p className="muted">Record the concern, not the person. No names or personal details are needed.</p>
      </div>

      <Section title="Repeated concerns" id="repeated">
        <p className="small muted pad-x">Two or more similar pieces of feedback in the last 90 days.</p>
        {concerns.length ? (
          <div className="concern-list">
            {concerns.map((c) => {
              const linkedIds = [...new Set(c.items.map((f) => f.linkedIssueId).filter(Boolean))] as string[];
              const unlinked = c.items.filter((f) => !f.linkedIssueId);
              const issue = linkedIds.length === 1 ? issueRef(linkedIds[0]) : undefined;
              return (
                <div key={c.key} className="concern card">
                  <div className="concern-head">
                    <span className="concern-count">{c.items.length}×</span>
                    <div>
                      <p className="row-title">{c.category}</p>
                      <p className="small muted">{c.department ?? `Across ${[...new Set(c.items.map((i) => i.department))].join(', ')}`}</p>
                    </div>
                  </div>
                  <p className="small quote">“{truncate(c.items[0].description, 110)}”</p>
                  <div className="concern-foot">
                    {issue ? (
                      <Link to={`/issues/${issue.id}`} className="linked-issue">
                        <Icon name="link" size={13} /> {issue.ref} <StatusBadge status={issue.status} />
                      </Link>
                    ) : linkedIds.length > 1 ? (
                      <span className="small muted">Linked to {linkedIds.length} issues</span>
                    ) : (
                      <span className="small muted">Not tracked yet</span>
                    )}
                    {unlinked.length > 0 &&
                      (issue ? (
                        <button className="text-btn" onClick={() => run(async () => { for (const f of unlinked) await actions.linkFeedback(f.id, issue.id); }, `Linked ${unlinked.length} to ${issue.ref}`)}>
                          Link {unlinked.length} more
                        </button>
                      ) : (
                        <button className="text-btn" onClick={() => router.navigate(`/issues/new?feedback=${unlinked.map((f) => f.id).join(',')}`)}>
                          Create issue
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted small pad-x">No repeated concerns detected.</p>
        )}
      </Section>

      <Section title={`Feedback log (${feedback.length})`}>
        <SearchBox value={q} onChange={setQ} placeholder="Search feedback" />
        <div className="grid-2 filters-inline">
          <SelectField label="Department" value={dept} onChange={setDept} options={departments} placeholder="All" />
          <SelectField label="Category" value={cat} onChange={setCat} options={categories} placeholder="All" />
        </div>
        <div className="chips">
          {(
            [
              ['all', 'All'],
              ['unlinked', `Not linked ${unlinkedCount}`],
              ['linked', 'Linked to issue']
            ] as [LinkFilter, string][]
          ).map(([v, l]) => (
            <button key={v} className={`chip ${linkFilter === v ? 'chip-active' : ''}`} onClick={() => setLinkFilter(v)} aria-pressed={linkFilter === v}>
              {l}
            </button>
          ))}
        </div>
        {list.length ? (
          <div className="list">
            {list.map((f) => {
              const iss = issueRef(f.linkedIssueId);
              return (
                <button key={f.id} className="row as-button" onClick={() => setOpenId(f.id)}>
                  <div className="row-main">
                    <div className="row-meta">
                      {formatDate(f.dateReceived, { year: false })} · {f.department}
                      <DemoBadge show={!!f.demo} />
                    </div>
                    <p className="row-text">{f.description}</p>
                    <div className="row-badges">
                      <span className="tag">{f.category}</span>
                      {iss ? (
                        <span className="tag tag-link">
                          <Icon name="link" size={12} /> {iss.ref}
                        </span>
                      ) : (
                        <span className="tag tag-muted">Not linked</span>
                      )}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={18} className="row-chevron" />
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="chat" title={feedback.length ? 'Nothing matches' : 'No feedback logged'} text={feedback.length ? 'Try clearing filters.' : 'Log feedback as you receive it from apprentices.'} />
        )}
      </Section>

      {/* Detail sheet */}
      <Sheet open={!!opened && !editing && !linking} onClose={() => setOpenId(null)} title="Feedback">
        {opened && (
          <>
            <div className="row-meta">
              {formatDate(opened.dateReceived, { weekday: true })} · {opened.department} <DemoBadge show={!!opened.demo} />
            </div>
            <span className="tag">{opened.category}</span>
            <p className="quote">{opened.description}</p>
            {issueRef(opened.linkedIssueId) ? (
              <div className="linked-box">
                <p className="label-xs">Linked issue</p>
                <Link to={`/issues/${opened.linkedIssueId}`} className="linked-issue">
                  {issueRef(opened.linkedIssueId)!.ref} · {issueRef(opened.linkedIssueId)!.title}
                </Link>
                <button className="text-btn danger" onClick={() => run(() => actions.linkFeedback(opened.id, undefined), 'Unlinked')}>
                  Unlink
                </button>
              </div>
            ) : (
              <div className="btn-col">
                <button className="btn btn-primary" onClick={() => router.navigate(`/issues/new?feedback=${opened.id}`)}>
                  <Icon name="plus" size={18} /> Convert to new issue
                </button>
                <button className="btn btn-secondary" onClick={() => setLinking(opened.id)}>
                  <Icon name="link" size={18} /> Link to existing issue
                </button>
              </div>
            )}
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => setEditing(opened)}>
                <Icon name="edit" size={16} /> Edit
              </button>
              <button
                className="btn btn-danger-ghost"
                onClick={async () => {
                  if (await confirm({ title: 'Delete feedback?', message: 'This feedback record will be permanently deleted.', confirmLabel: 'Delete', danger: true })) {
                    if (await run(() => actions.deleteFeedback(opened.id), 'Feedback deleted')) setOpenId(null);
                  }
                }}
              >
                <Icon name="trash" size={16} /> Delete
              </button>
            </div>
          </>
        )}
      </Sheet>

      {linking && (
        <LinkIssueSheet
          onClose={() => setLinking(null)}
          onPick={async (issueId) => {
            if (await run(() => actions.linkFeedback(linking, issueId), 'Feedback linked')) setLinking(null);
          }}
        />
      )}

      {editing && (
        <FeedbackFormSheet
          initial={editing}
          isNew={!feedback.some((f) => f.id === editing.id)}
          onClose={() => setEditing(null)}
          onSaved={(f) => {
            setEditing(null);
            setOpenId(f.id);
          }}
        />
      )}
    </div>
  );
}

function blankFeedback(): Feedback {
  return { id: uid(), dateReceived: todayISO(), department: '', category: '', description: '', createdAt: nowISO(), updatedAt: nowISO() };
}

function FeedbackFormSheet({ initial, isNew, onClose, onSaved }: { initial: Feedback; isNew: boolean; onClose: () => void; onSaved: (f: Feedback) => void }) {
  const { feedback, issues, settings } = useData();
  const actions = useActions();
  const { runFor } = useNotify();
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const similar = useMemo(() => (d.description.trim().length >= 12 ? findSimilarFeedback(d, feedback).slice(0, 3) : []), [d, feedback]);
  const suggestedIssue = similar.map((s) => issues.find((i) => i.id === s.linkedIssueId)).find((i) => i && !i.archived);
  const pii = personalDataWarnings(d.description);
  const departments = [...new Set([...settings.departments, d.department].filter(Boolean))];
  const categories = [...new Set([...settings.categories, d.category].filter(Boolean))];

  const submit = async (linkTo?: string) => {
    const e = validateFeedback(d);
    setErrors(e);
    if (hasErrors(e)) return;
    const saved = await runFor(async () => {
      const f = await actions.saveFeedback(d);
      if (linkTo) await actions.linkFeedback(f.id, linkTo);
      return f;
    }, linkTo ? 'Feedback saved and linked' : isNew ? 'Feedback logged' : 'Feedback updated');
    if (saved) onSaved(saved);
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Log feedback' : 'Edit feedback'} footer={<SheetButtons onCancel={onClose} onSave={() => submit()} saveLabel={isNew ? 'Save' : 'Save changes'} />}>
      <div className="grid-2">
        <SelectField label="Department or shed" required value={d.department} onChange={(v) => setD({ ...d, department: v })} options={departments} placeholder="Select…" error={errors.department} />
        <SelectField label="Category" required value={d.category} onChange={(v) => setD({ ...d, category: v })} options={categories} placeholder="Select…" error={errors.category} />
      </div>
      <TextArea label="What was raised?" required value={d.description} onChange={(v) => setD({ ...d, description: v })} error={errors.description} rows={4} maxLength={2000} hint="Describe the concern without names or details that could identify someone." />
      {pii.length > 0 && <p className="inline-warning">This looks like it contains {listJoin(pii)}. Please remove it.</p>}
      <TextField label="Date received" type="date" required value={d.dateReceived} onChange={(v) => setD({ ...d, dateReceived: v })} error={errors.dateReceived} max={todayISO()} />
      {similar.length > 0 && (
        <div className="similar">
          <p className="label-xs">
            <Icon name="repeat" size={13} /> Similar feedback already recorded
          </p>
          <ul>
            {similar.map((s) => (
              <li key={s.id} className="small">
                “{truncate(s.description, 90)}” <span className="muted">· {s.department}, {formatDate(s.dateReceived, { year: false })}</span>
              </li>
            ))}
          </ul>
          {suggestedIssue && !d.linkedIssueId && (
            <button className="btn btn-secondary btn-sm" onClick={() => submit(suggestedIssue.id)}>
              <Icon name="link" size={15} /> Save &amp; link to {suggestedIssue.ref}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function LinkIssueSheet({ onClose, onPick }: { onClose: () => void; onPick: (issueId: string) => void }) {
  const { issues } = useData();
  const [q, setQ] = useState('');
  const list = issues
    .filter((i) => !i.archived && matchesSearch(i, q.trim()))
    .sort((a, b) => Number(['Resolved', 'Closed'].includes(a.status)) - Number(['Resolved', 'Closed'].includes(b.status)) || b.dateRaised.localeCompare(a.dateRaised));
  return (
    <Sheet open onClose={onClose} title="Link to issue">
      <SearchBox value={q} onChange={setQ} placeholder="Search issues" />
      {list.length ? (
        <ul className="pick-list">
          {list.map((i) => (
            <li key={i.id}>
              <button className="pick" onClick={() => onPick(i.id)}>
                <span className="pick-body">
                  <span className="row-meta">
                    {i.ref} · {i.department}
                  </span>
                  <span className="row-title">{i.title}</span>
                  <StatusBadge status={i.status} />
                </span>
                <Icon name="link" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No issues found.</p>
      )}
    </Sheet>
  );
}
