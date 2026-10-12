import { useEffect, useMemo, useState } from 'react';
import { useActions, useData } from '../state/store';
import { Link } from '../state/router';
import { useNotify } from '../components/notify';
import { Card, PageHeader, Section, TextArea, UpdateStatusBadge } from '../components/ui';
import { IssueRow } from '../components/IssueRow';
import { Icon } from '../components/Icon';
import { MeetingRow } from './MeetingsPage';
import type { WeeklyPlan } from '../types';
import { addDays, daysBetween, formatDate, inRange, startOfWeek, todayISO } from '../lib/dates';
import { isAwaiting, isDueBetween, isOverdue, weekSummary } from '../lib/metrics';
import { weekSummaryText } from '../lib/summary';
import { copyText } from '../lib/clipboard';

const emptyPlan = (id: string): WeeklyPlan => ({ id, priorities: [0, 1, 2].map(() => ({ text: '', done: false })), notes: '', updatedAt: '' });

export function PlannerPage() {
  const data = useData();
  const actions = useActions();
  const { run, toast } = useNotify();
  const today = todayISO();
  const thisWeek = startOfWeek(today);
  const [week, setWeek] = useState(thisWeek);
  const weekEnd = addDays(week, 6);
  const isCurrent = week === thisWeek;
  const stored = data.plans.find((p) => p.id === week);
  const [plan, setPlan] = useState<WeeklyPlan>(stored ?? emptyPlan(week));

  useEffect(() => {
    setPlan(data.plans.find((p) => p.id === week) ?? emptyPlan(week));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  const dirty = JSON.stringify({ p: plan.priorities, n: plan.notes }) !== JSON.stringify({ p: (stored ?? emptyPlan(week)).priorities, n: (stored ?? emptyPlan(week)).notes });
  const savePlan = (p: WeeklyPlan, msg?: string) => run(() => actions.savePlan({ ...p, demo: stored?.demo }), msg);

  const followUps = useMemo(
    () =>
      data.issues
        .filter((i) => isDueBetween(i, week, weekEnd) || (isCurrent && isOverdue(i, today)))
        .sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)),
    [data.issues, week, weekEnd, isCurrent, today]
  );
  const meetings = data.meetings
    .filter((m) => m.status !== 'Cancelled' && inRange(m.date, week, addDays(weekEnd, 7)))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const awaiting = data.issues.filter(isAwaiting).sort((a, b) => a.dateRaised.localeCompare(b.dateRaised));
  const toCommunicate = data.updates.filter((u) => u.status !== 'Published').sort((a, b) => (a.status === 'Approved' ? -1 : 1) - (b.status === 'Approved' ? -1 : 1));
  const checklist = data.meetings.flatMap((m) => m.followUps.filter((f) => !f.done && f.dueDate && f.dueDate <= weekEnd).map((f) => ({ f, m })));
  const summary = weekSummary(week, data, today);
  const prDone = plan.priorities.filter((p) => p.text.trim() && p.done).length;
  const prSet = plan.priorities.filter((p) => p.text.trim()).length;

  const copySummary = async () => {
    try {
      await copyText(weekSummaryText(summary, plan.priorities));
      toast('Weekly summary copied', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Weekly planner" back="/more" />
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">
          <Icon name="chevronLeft" />
        </button>
        <div className="week-label" aria-live="polite">
          <strong>{isCurrent ? 'This week' : daysBetween(thisWeek, week) === 7 ? 'Next week' : daysBetween(thisWeek, week) === -7 ? 'Last week' : 'Week of'}</strong>
          <span>
            {formatDate(week, { year: false })} – {formatDate(weekEnd)}
          </span>
        </div>
        <button className="icon-btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">
          <Icon name="chevronRight" />
        </button>
      </div>
      {!isCurrent && (
        <button className="text-btn center-block" onClick={() => setWeek(thisWeek)}>
          Back to this week
        </button>
      )}

      <Section title="Three priorities" action={<span className="small muted">{prSet ? `${prDone}/${prSet} done` : ''}</span>}>
        <Card className="priorities">
          {plan.priorities.map((p, i) => (
            <div key={i} className={`priority ${p.done ? 'done' : ''}`}>
              <button
                role="checkbox"
                aria-checked={p.done}
                aria-label={`Mark priority ${i + 1} done`}
                className={`checkbox ${p.done ? 'on' : ''}`}
                disabled={!p.text.trim()}
                onClick={() => {
                  const next = { ...plan, priorities: plan.priorities.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) };
                  setPlan(next);
                  savePlan(next);
                }}
              >
                {p.done && <Icon name="check" size={14} />}
              </button>
              <input
                aria-label={`Priority ${i + 1}`}
                placeholder={`Priority ${i + 1}`}
                value={p.text}
                maxLength={140}
                onChange={(e) => setPlan({ ...plan, priorities: plan.priorities.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
            </div>
          ))}
          <TextArea label="Notes for the week" value={plan.notes} onChange={(v) => setPlan({ ...plan, notes: v })} rows={2} />
          <div className="btn-row end">
            {dirty && <span className="small muted">Unsaved</span>}
            <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => savePlan(plan, 'Plan saved')}>
              Save plan
            </button>
          </div>
        </Card>
      </Section>

      <Section title={`Issues requiring follow-up (${followUps.length})`}>
        {followUps.length ? (
          <div className="list">
            {followUps.map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </div>
        ) : (
          <p className="muted small pad-x">No follow-ups due {isCurrent ? 'this week' : 'in this week'}.</p>
        )}
      </Section>

      {checklist.length > 0 && (
        <Section title={`Meeting follow-ups (${checklist.length})`}>
          <div className="list">
            {checklist.map(({ f, m }) => (
              <Link key={f.id} to={`/meetings/${m.id}`} className={`row action-row tone-${f.dueDate < today ? 'critical' : 'warning'}`}>
                <span className="action-dot" aria-hidden="true" />
                <div className="row-main">
                  <p className="row-title">{f.text}</p>
                  <p className="row-meta">
                    {f.dueDate < today ? 'Overdue' : 'Due'} {formatDate(f.dueDate, { year: false })} · {m.title}
                  </p>
                </div>
                <Icon name="chevronRight" size={18} className="row-chevron" />
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Upcoming meetings" action={<Link to="/meetings" className="text-btn">Calendar</Link>}>
        {meetings.length ? (
          <div className="list">
            {meetings.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <p className="muted small pad-x">No meetings this week or next.</p>
        )}
      </Section>

      <Section title={`Outstanding management responses (${awaiting.length})`}>
        {awaiting.length ? (
          <div className="list">
            {awaiting.map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </div>
        ) : (
          <p className="muted small pad-x">Nothing is waiting on management.</p>
        )}
      </Section>

      <Section title={`Updates to communicate (${toCommunicate.length})`} action={<Link to="/updates" className="text-btn">All updates</Link>}>
        {toCommunicate.length ? (
          <div className="list">
            {toCommunicate.map((u) => (
              <Link key={u.id} to={`/updates/${u.id}`} className="row">
                <div className="row-main">
                  <div className="row-meta">
                    <UpdateStatusBadge status={u.status} />
                    {u.status === 'Approved' && <span>Ready to post</span>}
                  </div>
                  <p className="row-title">{u.title}</p>
                </div>
                <Icon name="chevronRight" size={18} className="row-chevron" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted small pad-x">No drafts or approved updates waiting.</p>
        )}
      </Section>

      <Section title="Weekly progress summary" action={<button className="text-btn" onClick={copySummary}><Icon name="copy" size={15} /> Copy</button>}>
        <div className="summary-grid card">
          <SummaryCell label="Issues raised" value={summary.raised} />
          <SummaryCell label="Responses recorded" value={summary.responsesRecorded} />
          <SummaryCell label="Resolved / closed" value={summary.resolved} />
          <SummaryCell label="Feedback logged" value={summary.feedbackLogged} />
          <SummaryCell label="Meetings held" value={summary.meetingsHeld} />
          <SummaryCell label="Updates published" value={summary.updatesPublished} />
          <SummaryCell label="Follow-ups due" value={summary.followUpsDue} />
          <SummaryCell label="Overdue now" value={summary.followUpsOverdue} tone={summary.followUpsOverdue ? 'critical' : undefined} />
          <SummaryCell label="Priorities done" value={prSet ? `${prDone}/${prSet}` : '—'} />
        </div>
        <p className="small muted pad-x">Counts are taken from records dated within this week.</p>
      </Section>
    </div>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={`summary-cell ${tone ? `tone-${tone}` : ''}`}>
      <span className="summary-value">{value}</span>
      <span className="summary-label">{label}</span>
    </div>
  );
}
