import { useMemo } from 'react';
import { Activity, Bell, CalendarDays, ChevronRight, Dumbbell, Flame, HeartPulse, Play, Scale, ShieldAlert, Trophy, TrendingUp, X, CheckCircle2, Moon } from 'lucide-react';
import { repo } from '@/data';
import { useAppData, useProfile } from '../hooks/useAppData';
import { activeSession, latestBodyWeight, nextWorkout, readinessFor, readyForOverload, scheduledFor, todaysCheck } from '../hooks/derived';
import { buildReminders } from '@/domain/reminders';
import { computePersonalRecords, consistencyPercent, headlinePRs, musclesTrainedRecently, MUSCLE_LABELS, plannedDaysPerWeek, recentWeeks } from '@/domain/analytics';
import { formatDate, formatShortDate, trainingWeek, WEEKDAY_NAMES, weekdayOf, addDays, toISODate } from '@/lib/dates';
import { formatVolume, formatWeight } from '@/lib/units';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { EmptyState, SectionTitle, StatTile } from '../components/common';
import { ReadinessBadge } from '../components/ReadinessBadge';
import { PRLabel } from '../components/PRLabel';
import { Link, navigate } from '../router';
import { cn } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function Dashboard() {
  const data = useAppData();
  const profile = useProfile();
  const { today, sessions, templates, exerciseMap } = data;
  const units = profile.units;

  const live = activeSession(data);
  const todays = scheduledFor(data, today);
  const doneToday = sessions.find((s) => s.status === 'completed' && s.date === today);
  const next = nextWorkout(data, !doneToday);
  const check = todaysCheck(data);
  const readiness = readinessFor(check);
  const planned = plannedDaysPerWeek(templates, profile.trainingDays);
  const weeks = useMemo(() => recentWeeks(sessions, today, 8, planned), [sessions, today, planned]);
  const thisWeek = weeks[weeks.length - 1];
  const consistency = consistencyPercent(sessions, today, 4, templates, profile.trainingDays, profile.onboardedAt ? toISODate(new Date(profile.onboardedAt)) : null);
  const ready = useMemo(() => readyForOverload(data), [data]);
  const prs = useMemo(() => headlinePRs(computePersonalRecords(sessions, exerciseMap)).sort((a, b) => b.date.localeCompare(a.date)), [sessions, exerciseMap]);
  const muscles = useMemo(() => musclesTrainedRecently(sessions, exerciseMap, today, 7), [sessions, exerciseMap, today]);
  const bw = latestBodyWeight(data);
  const reminders = buildReminders({ today, templates, sessions, trainingDays: profile.trainingDays, readyForOverload: ready.map((r) => ({ exerciseId: r.exerciseId, name: r.name })), dismissed: data.dismissed });
  const week = trainingWeek(profile.programmeStartDate, today);

  const dismiss = async (key: string) => {
    // Keep the dismissal list small: drop entries older than two weeks.
    const cutoff = addDays(today, -14);
    const kept = Object.fromEntries(Object.entries(data.dismissed).filter(([, d]) => d >= cutoff));
    await repo.setMeta('reminders.dismissed', { ...kept, [key]: today });
  };

  const hero = live ? (
    <HeroCard
      eyebrow="In progress"
      title={live.name}
      body="Your sets are saved as you go. Pick up where you left off."
      action={
        <Button size="lg" className="w-full" onClick={() => navigate('/train/live')}>
          <Play className="fill-current" /> Resume workout
        </Button>
      }
    />
  ) : doneToday ? (
    <HeroCard
      eyebrow={`Done today · ${WEEKDAY_NAMES[weekdayOf(today)]}`}
      title={`${doneToday.name} complete`}
      body={next ? `Next up: ${next.template.name} on ${WEEKDAY_NAMES[weekdayOf(next.date)]}.` : 'Nice work. Recover well.'}
      icon={<CheckCircle2 className="h-5 w-5 text-success" />}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => navigate(`/train/summary/${doneToday.id}`)}>
            View summary
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/train')}>
            Another workout
          </Button>
        </div>
      }
    />
  ) : todays ? (
    <HeroCard
      eyebrow={`Today · ${WEEKDAY_NAMES[weekdayOf(today)]}`}
      title={todays.name}
      body={`${todays.exercises.length} exercises${todays.description ? ` — ${todays.description}` : ''}`}
      action={
        <Button size="lg" className="w-full text-lg" onClick={() => navigate(`/train/start/${todays.id}`)}>
          <Play className="fill-current" /> Start Workout
        </Button>
      }
    />
  ) : (
    <HeroCard
      eyebrow={`Today · ${WEEKDAY_NAMES[weekdayOf(today)]}`}
      title="Recovery day"
      body="Rest, or keep it light with an easy walk or gentle mobility."
      icon={<Moon className="h-5 w-5 text-accent" />}
      action={
        <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate('/train')}>
          <Play /> Start Workout
        </Button>
      }
    />
  );

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(today, { weekday: true })}</p>
          <h1 className="text-3xl font-black tracking-tight">{greeting()}</h1>
        </div>
        <Badge variant="default" className="mb-1 h-7 px-3 text-sm">
          Week {week}
        </Badge>
      </div>

      {hero}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <StatTile icon={<CalendarDays />} label="This week" value={`${thisWeek.completed} / ${planned}`} sub="workouts completed" onClick={() => navigate('/history')} />
        <StatTile icon={<Dumbbell />} label="Weekly volume" value={thisWeek.volumeKg > 0 ? formatVolume(thisWeek.volumeKg, units) : '—'} sub="weight × reps lifted" onClick={() => navigate('/progress')} />
        <StatTile icon={<Scale />} label="Body weight" value={bw ? formatWeight(bw.kg, units) : '—'} sub={bw?.date ? `logged ${formatShortDate(bw.date)}` : 'tap to log'} onClick={() => navigate('/profile')} />
        <StatTile
          icon={<HeartPulse />}
          label="Recovery"
          value={<ReadinessBadge level={readiness.level} />}
          sub={check ? readiness.headline : 'check in before training'}
          onClick={() => navigate(live ? '/train/live' : todays ? `/train/start/${todays.id}` : '/train')}
        />
      </div>

      {profile.injuries && (
        <div className="mt-3 flex gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">Remember:</span> {profile.injuries}
          </p>
        </div>
      )}

      {reminders.length > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" /> In-app reminders
            </span>
          </SectionTitle>
          <ul className="flex flex-col gap-2">
            {reminders.map((r) => (
              <li key={r.key} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.body}</p>
                </div>
                {r.href && (
                  <Button size="sm" variant="secondary" asChild>
                    <a href={r.href}>{r.actionLabel ?? 'Open'}</a>
                  </Button>
                )}
                {r.kind !== 'in_progress' && (
                  <button aria-label={`Dismiss reminder: ${r.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary" onClick={() => dismiss(r.key)}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle action={<Link to="/progress" className="text-xs font-semibold text-accent">Details</Link>}>Weekly consistency</SectionTitle>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black tabular">{consistency == null ? '—' : `${consistency}%`}</p>
            <p className="text-right text-xs text-muted-foreground">of planned sessions done
              <br />
              last 4 weeks</p>
          </div>
          <WeekBars weeks={weeks} />
        </CardContent>
      </Card>

      <SectionTitle action={ready.length > 0 && <Badge variant="success">{ready.length} ready</Badge>}>Ready for progressive overload</SectionTitle>
      {ready.length === 0 ? (
        <EmptyState
          icon={<TrendingUp />}
          title={sessions.some((s) => s.status === 'completed') ? 'Nothing ready yet' : 'No training logged yet'}
          body={sessions.some((s) => s.status === 'completed') ? 'Hit the top of your rep range on every set with good technique and an exercise will appear here.' : 'Log a workout (or enter your current weights) and AthleteOS will tell you when to increase.'}
          action={
            !sessions.length && (
              <Button variant="secondary" onClick={() => navigate('/profile/starting-weights')}>
                Enter current weights
              </Button>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ready.map((r) => (
            <li key={r.exerciseId}>
              <a href={`#/library/${r.exerciseId}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-secondary">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.rec.headline}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{r.rec.reason}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Muscle groups trained · last 7 days</SectionTitle>
      {muscles.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">No workouts in the last 7 days.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {muscles.map((m) => (
            <span key={m.muscle} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', m.daysAgo <= 1 ? 'border-primary/50 bg-primary/15' : 'bg-card')}>
              {MUSCLE_LABELS[m.muscle]} <span className="font-normal text-muted-foreground">· {m.daysAgo === 0 ? 'today' : m.daysAgo === 1 ? 'yesterday' : `${m.daysAgo}d ago`}</span>
            </span>
          ))}
        </div>
      )}

      <SectionTitle action={prs.length > 0 && <Link to="/progress?tab=records" className="text-xs font-semibold text-accent">All records</Link>}>Personal records</SectionTitle>
      {prs.length === 0 ? (
        <EmptyState icon={<Trophy />} title="No records yet" body="Your heaviest lifts, best estimated 1RMs, fastest sprints and longest jumps will appear here." />
      ) : (
        <Card>
          <ul className="divide-y">
            {prs.slice(0, 5).map((p) => (
              <li key={`${p.exerciseId}-${p.kind}-${p.loadMode}-${p.distanceM}`} className="flex items-center gap-3 px-4 py-3">
                <Trophy className="h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{exerciseMap.get(p.exerciseId)?.name ?? 'Exercise'}</p>
                  <p className="text-xs text-muted-foreground">
                    <PRLabel pr={p} units={units} />
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatShortDate(p.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {next && (
        <>
          <SectionTitle>Next workout</SectionTitle>
          <button onClick={() => navigate(`/train/template/${next.template.id}`)} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-secondary">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-accent">
              {next.template.focus === 'speed' ? <Flame className="h-5 w-5" /> : next.template.focus === 'mobility' ? <Activity className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{next.template.name}</p>
              <p className="text-sm text-muted-foreground">
                {next.date === today ? 'Today' : WEEKDAY_NAMES[weekdayOf(next.date)]} · {next.template.exercises.length} exercises
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </>
      )}
      <p className="mt-8 text-center text-xs text-muted-foreground">Recommendations are guidance, not guarantees.</p>
    </div>
  );
}

function HeroCard({ eyebrow, title, body, action, icon }: { eyebrow: string; title: string; body: string; action: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/25 via-card to-card">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
      <CardHeader className="relative">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-accent">
          {icon}
          {eyebrow}
        </p>
        <CardTitle className="text-2xl font-black">{title}</CardTitle>
        <p className="line-clamp-2 text-sm text-muted-foreground">{body}</p>
      </CardHeader>
      <CardContent className="relative pt-2">{action}</CardContent>
    </Card>
  );
}

function WeekBars({ weeks }: { weeks: { weekStart: string; completed: number; planned: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.completed, w.planned)));
  return (
    <div className="mt-4">
      <div className="flex h-20 items-end gap-1.5" role="img" aria-label={`Workouts per week, last ${weeks.length} weeks: ${weeks.map((w) => w.completed).join(', ')}`}>
        {weeks.map((w) => {
          return (
            <div key={w.weekStart} className="flex h-full flex-1 flex-col justify-end" title={`Week of ${formatShortDate(w.weekStart)}: ${w.completed} of ${w.planned}`}>
              {w.completed > 0 ? (
                <div className="w-full rounded-t-[4px]" style={{ height: `${(w.completed / max) * 100}%`, background: 'var(--chart-1)' }} />
              ) : (
                <div className="h-0.5 w-full rounded-full bg-border" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted-foreground">
        {weeks.map((w, i) => (
          <span key={w.weekStart} className={cn('flex-1 text-center tabular', i === weeks.length - 1 && 'font-bold text-foreground')}>
            {i === weeks.length - 1 ? 'Now' : w.completed}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Workouts per week, last {weeks.length} weeks</p>
    </div>
  );
}
