import type { Exercise, ID, ISODate, PersonalRecord, RecoveryCheck, Weekday, WorkoutSession, WorkoutTemplate } from './types';
import { addDays, startOfWeek, weekdayOf, WEEKDAY_NAMES } from '@/lib/dates';
import { completedSessions, personalRecordEvents, headlinePRs, sessionsInRange, sessionVolume, plannedDaysPerWeek } from './analytics';

// In-app reminders. iPhone web apps can't receive scheduled push notifications without a server,
// so AthleteOS shows these inside the app whenever it is opened.

export type ReminderKind = 'in_progress' | 'today_workout' | 'missed' | 'overload' | 'recovery_day' | 'weekly_review';

export interface Reminder {
  key: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** Hash route the reminder's action opens. */
  href?: string;
  actionLabel?: string;
}

export interface ReminderInput {
  today: ISODate;
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  trainingDays: Weekday[];
  readyForOverload: { exerciseId: ID; name: string }[];
  dismissed: Record<string, ISODate>;
}

export function templateForDay(templates: WorkoutTemplate[], day: Weekday, trainingDays: Weekday[]): WorkoutTemplate | undefined {
  if (trainingDays.length && !trainingDays.includes(day)) return undefined;
  return templates.find((t) => !t.deletedAt && t.dayOfWeek === day);
}

export function buildReminders(input: ReminderInput): Reminder[] {
  const { today, templates, sessions, trainingDays } = input;
  const out: Reminder[] = [];
  const done = new Set(completedSessions(sessions).map((s) => s.date));
  const active = sessions.find((s) => !s.deletedAt && s.status === 'in_progress');
  const dow = weekdayOf(today);

  if (active) {
    out.push({
      key: `in_progress:${active.id}`,
      kind: 'in_progress',
      title: 'Workout in progress',
      body: `${active.name} was started and not finished. Your sets are saved — pick up where you left off.`,
      href: '#/train/live',
      actionLabel: 'Resume'
    });
  }

  const todays = templateForDay(templates, dow, trainingDays);
  if (todays && !done.has(today) && !active) {
    out.push({
      key: `today:${today}`,
      kind: 'today_workout',
      title: `Today: ${todays.name}`,
      body: `${todays.exercises.length} exercises scheduled for ${WEEKDAY_NAMES[dow]}.`,
      href: `#/train/start/${todays.id}`,
      actionLabel: 'Start'
    });
  }

  // Missed sessions earlier this week.
  const monday = startOfWeek(today);
  for (let d = monday; d < today; d = addDays(d, 1)) {
    const t = templateForDay(templates, weekdayOf(d), trainingDays);
    if (t && !done.has(d)) {
      out.push({
        key: `missed:${d}`,
        kind: 'missed',
        title: `Missed: ${WEEKDAY_NAMES[weekdayOf(d)]} — ${t.name}`,
        body: 'No need to double up. Carry on with today’s plan, or do this session on a rest day if you feel fresh.',
        href: `#/train/start/${t.id}`,
        actionLabel: 'Do it now'
      });
    }
  }

  if (input.readyForOverload.length) {
    const names = input.readyForOverload.map((r) => r.name);
    out.push({
      key: `overload:${today}:${names.length}`,
      kind: 'overload',
      title: `${names.length} exercise${names.length === 1 ? '' : 's'} ready to progress`,
      body: names.slice(0, 4).join(', ') + (names.length > 4 ? ` and ${names.length - 4} more` : '') + '.',
      href: '#/progress',
      actionLabel: 'View'
    });
  }

  if (!todays) {
    out.push({
      key: `recovery:${today}`,
      kind: 'recovery_day',
      title: 'Recovery day',
      body: 'Rest, or keep it light: an easy walk, gentle mobility, good food and sleep. Recovery is when you adapt.',
      href: '#/train',
      actionLabel: 'Mobility'
    });
  }

  // Weekly review: available over the weekend and on Monday for the week just finished.
  const reviewWeek = dow >= 6 ? monday : dow === 1 ? addDays(monday, -7) : null;
  if (reviewWeek && sessionsInRange(sessions, reviewWeek, addDays(reviewWeek, 6)).length > 0) {
    out.push({
      key: `review:${reviewWeek}`,
      kind: 'weekly_review',
      title: 'Weekly performance review',
      body: 'See what you completed, your volume and any personal records from the week.',
      href: `#/review/${reviewWeek}`,
      actionLabel: 'Open'
    });
  }

  return out.filter((r) => !input.dismissed[r.key]);
}

export interface WeeklyReview {
  weekStart: ISODate;
  completed: number;
  planned: number;
  missedDays: ISODate[];
  volumeKg: number;
  prevVolumeKg: number;
  volumeChangePct: number | null;
  minutes: number;
  prs: PersonalRecord[];
  avgSleep: number | null;
  avgEnergy: number | null;
  avgSoreness: number | null;
  sessions: WorkoutSession[];
}

export function weeklyReview(
  sessions: WorkoutSession[],
  exercises: Map<ID, Exercise>,
  templates: WorkoutTemplate[],
  trainingDays: Weekday[],
  recovery: RecoveryCheck[],
  weekStart: ISODate
): WeeklyReview {
  const end = addDays(weekStart, 6);
  const inWeek = sessionsInRange(sessions, weekStart, end);
  const prev = sessionsInRange(sessions, addDays(weekStart, -7), addDays(weekStart, -1));
  const volumeKg = inWeek.reduce((s, x) => s + sessionVolume(x), 0);
  const prevVolumeKg = prev.reduce((s, x) => s + sessionVolume(x), 0);
  const doneDays = new Set(inWeek.map((s) => s.date));
  const missedDays: ISODate[] = [];
  for (let d = weekStart; d <= end; d = addDays(d, 1)) if (templateForDay(templates, weekdayOf(d), trainingDays) && !doneDays.has(d)) missedDays.push(d);
  const prs = headlinePRs(personalRecordEvents(sessions, exercises)).filter((p) => p.date >= weekStart && p.date <= end);
  const checks = recovery.filter((r) => !r.deletedAt && r.date >= weekStart && r.date <= end);
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === 'number');
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const minutes = inWeek.reduce((sum, s) => {
    if (typeof s.durationMin === 'number') return sum + s.durationMin;
    if (!s.endedAt) return sum;
    return sum + Math.max(0, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000));
  }, 0);
  return {
    weekStart,
    completed: doneDays.size,
    planned: plannedDaysPerWeek(templates, trainingDays),
    missedDays,
    volumeKg,
    prevVolumeKg,
    volumeChangePct: prevVolumeKg > 0 ? Math.round(((volumeKg - prevVolumeKg) / prevVolumeKg) * 100) : null,
    minutes,
    prs,
    avgSleep: mean(checks.map((c) => c.sleepHours)),
    avgEnergy: mean(checks.map((c) => c.energy)),
    avgSoreness: mean(checks.map((c) => c.soreness)),
    sessions: inWeek
  };
}
