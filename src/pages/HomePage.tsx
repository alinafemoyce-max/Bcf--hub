import { useMemo } from 'react';
import { hasDemoData, useActions, useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { Card, EmptyState, Section, Stat } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { dashboardStats, priorityActions, upcomingMeetings } from '../lib/metrics';
import { daysBetween, formatDate, timeAgo, todayISO } from '../lib/dates';
import type { ActivityLog, Meeting } from '../types';
import { IS_PREVIEW } from '../lib/env';

const ACTIVITY_ICON: Record<ActivityLog['entity'], IconName> = {
  issue: 'issues',
  meeting: 'calendar',
  feedback: 'chat',
  update: 'megaphone',
  template: 'template',
  plan: 'planner',
  system: 'settings'
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function activityLink(a: ActivityLog): string | null {
  if (!a.entityId) return null;
  switch (a.entity) {
    case 'issue':
      return `/issues/${a.entityId}`;
    case 'meeting':
      return `/meetings/${a.entityId}`;
    case 'update':
      return `/updates/${a.entityId}`;
    case 'feedback':
      return `/feedback?open=${a.entityId}`;
    default:
      return null;
  }
}

export function HomePage() {
  const data = useData();
  const actions = useActions();
  const router = useRouter();
  const { run } = useNotify();
  const today = todayISO();
  const stats = useMemo(() => dashboardStats(data.issues, today), [data.issues, today]);
  const upcoming = useMemo(() => upcomingMeetings(data.meetings, today), [data.meetings, today]);
  const nextBcf = upcoming.find((m) => m.type === 'BCF');
  const nextPre = upcoming.find((m) => m.type === 'Pre-BCF');
  const prio = useMemo(() => priorityActions(data.issues, data.meetings, data.updates, today), [data.issues, data.meetings, data.updates, today]);
  const recent = data.activity.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const demo = hasDemoData(data);
  const isEmpty = !data.issues.length && !data.meetings.length && !data.feedback.length && !data.updates.length;

  return (
    <div className="page home">
      <header className="home-hero">
        <p className="eyebrow">
          {greeting()} · {formatDate(today, { weekday: true })}
        </p>
        <h1 className="brand">
          BCF <span>Hub</span>
        </h1>
        <p className="page-subtitle">Apprentice representative workspace</p>
      </header>

      {IS_PREVIEW && (
        <div className="banner banner-preview" role="note">
          <Icon name="info" size={18} />
          <p>
            <strong>Preview version.</strong> Your data stays in this browser only. PDFs, backups, printing and offline use need the installed version.
          </p>
        </div>
      )}

      {demo && (
        <div className="banner banner-demo" role="note">
          <Icon name="info" size={18} />
          <p>
            You’re viewing <strong>fictional demo data</strong>. Clear it any time in <Link to="/settings" className="text-link">Data &amp; backup</Link>.
          </p>
        </div>
      )}

      {isEmpty && !data.settings.onboarded && (
        <Card className="welcome">
          <h2>Welcome to BCF Hub</h2>
          <p>Track apprentice issues, prepare BCF meetings, follow up on management responses and draft updates for Teams — all stored privately on this device.</p>
          <div className="btn-col">
            <button className="btn btn-primary" onClick={() => run(() => actions.loadDemo(), 'Demo data loaded')}>
              Explore with demo data
            </button>
            <button className="btn btn-secondary" onClick={() => run(() => actions.updateSettings({ onboarded: true }))}>
              Start with a blank workspace
            </button>
          </div>
          <p className="small muted">Demo data is fictional and clearly labelled. Personal prototype — not an official Sunseeker system.</p>
        </Card>
      )}

      <div className="stats-grid">
        <Stat label="Active issues" value={stats.active} icon="issues" onClick={() => router.navigate('/issues')} />
        <Stat label="Awaiting management" value={stats.awaiting} icon="clock" tone={stats.awaiting ? 'amber' : undefined} onClick={() => router.navigate('/issues?view=awaiting')} />
        <Stat label="Overdue follow-ups" value={stats.overdue} icon="alert" tone={stats.overdue ? 'critical' : undefined} onClick={() => router.navigate('/issues?view=overdue')} />
        <Stat label="Resolved" value={stats.resolved} icon="check" tone="green" onClick={() => router.navigate('/issues?view=resolved')} />
      </div>

      <Section title="Upcoming BCF meeting" action={<Link to="/meetings" className="text-btn">Calendar</Link>}>
        {nextBcf ? <MeetingHero meeting={nextBcf} /> : <EmptyMeeting />}
        {nextPre && (
          <Link to={`/meetings/${nextPre.id}`} className="row compact-row">
            <span className="row-icon">
              <Icon name="users" size={18} />
            </span>
            <div className="row-main">
              <p className="row-title">Pre-BCF · {formatDate(nextPre.date, { weekday: true, year: false })}{nextPre.time && ` · ${nextPre.time}`}</p>
              <p className="row-meta">{countdown(nextPre.date, today)} · {nextPre.agenda.length} agenda items</p>
            </div>
            <Icon name="chevronRight" size={18} className="row-chevron" />
          </Link>
        )}
      </Section>

      <Section title="Priority actions this week" action={<Link to="/planner" className="text-btn">Planner</Link>}>
        {prio.length ? (
          <div className="list">
            {prio.slice(0, 6).map((p) => (
              <Link key={p.key} to={p.to} className={`row action-row tone-${p.tone}`}>
                <span className="action-dot" aria-hidden="true" />
                <div className="row-main">
                  <p className="row-title">{p.title}</p>
                  <p className="row-meta">{p.detail}</p>
                </div>
                <Icon name="chevronRight" size={18} className="row-chevron" />
              </Link>
            ))}
            {prio.length > 6 && (
              <Link to="/planner" className="row more-row">
                +{prio.length - 6} more in the weekly planner
              </Link>
            )}
          </div>
        ) : (
          <EmptyState icon="check" title="Nothing urgent this week" text="No overdue or due follow-ups, meetings or approved updates waiting." />
        )}
      </Section>

      <Section title="Quick actions">
        <div className="quick-grid">
          <button className="quick" onClick={() => router.navigate('/feedback?new=1')}>
            <Icon name="chat" /> Log feedback
          </button>
          <button className="quick" onClick={() => router.navigate('/issues/new')}>
            <Icon name="plus" /> New issue
          </button>
          <button className="quick" onClick={() => router.navigate('/meetings/new')}>
            <Icon name="calendar" /> Plan meeting
          </button>
          <button className="quick" onClick={() => router.navigate('/updates/new')}>
            <Icon name="megaphone" /> Draft update
          </button>
        </div>
      </Section>

      <Section title="Recent activity">
        {recent.length ? (
          <ol className="activity">
            {recent.map((a) => {
              const to = activityLink(a);
              const inner = (
                <>
                  <span className="activity-icon">
                    <Icon name={ACTIVITY_ICON[a.entity] ?? 'info'} size={15} />
                  </span>
                  <span className="activity-text">{a.text}</span>
                  <time className="activity-time" dateTime={a.at}>
                    {timeAgo(a.at)}
                  </time>
                </>
              );
              const exists = to && entityExists(data, a);
              return <li key={a.id}>{exists ? <Link to={to} className="activity-item">{inner}</Link> : <div className="activity-item">{inner}</div>}</li>;
            })}
          </ol>
        ) : (
          <p className="muted small pad-x">Activity will appear here as you work.</p>
        )}
      </Section>

      <p className="footnote">Personal prototype · Not an official Sunseeker International system · Data stays on this device</p>
    </div>
  );
}

function entityExists(d: ReturnType<typeof useData>, a: ActivityLog): boolean {
  const lists = { issue: d.issues, meeting: d.meetings, update: d.updates, feedback: d.feedback } as Record<string, { id: string }[]>;
  return !!lists[a.entity]?.some((x) => x.id === a.entityId);
}

function countdown(date: string, today: string): string {
  const d = daysBetween(today, date);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
}

function MeetingHero({ meeting }: { meeting: Meeting }) {
  const today = todayISO();
  const linked = meeting.agenda.filter((a) => a.issueId).length;
  return (
    <Link to={`/meetings/${meeting.id}`} className="meeting-hero">
      <div className="mh-date" aria-hidden="true">
        <span className="mh-month">{formatDate(meeting.date).split(' ')[1]}</span>
        <span className="mh-day">{Number(meeting.date.slice(8, 10))}</span>
      </div>
      <div className="mh-body">
        <p className="mh-countdown">{countdown(meeting.date, today)}</p>
        <p className="mh-title">{meeting.title}</p>
        <p className="mh-meta">
          {formatDate(meeting.date, { weekday: true, year: false })}
          {meeting.time && ` · ${meeting.time}`}
          {meeting.location && ` · ${meeting.location}`}
        </p>
        <p className="mh-meta">
          {meeting.agenda.length} agenda item{meeting.agenda.length === 1 ? '' : 's'} · {linked} linked issue{linked === 1 ? '' : 's'}
        </p>
      </div>
      <Icon name="chevronRight" size={20} className="row-chevron" />
    </Link>
  );
}

function EmptyMeeting() {
  return (
    <Card className="empty-inline">
      <p className="muted">No BCF meeting scheduled.</p>
      <Link to="/meetings/new?type=BCF" className="btn btn-secondary btn-sm">
        <Icon name="plus" size={16} /> Schedule BCF
      </Link>
    </Card>
  );
}
