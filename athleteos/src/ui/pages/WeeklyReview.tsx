import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, CalendarCheck, Trophy, Moon, Battery, Activity } from 'lucide-react';
import { weeklyReview } from '@/domain/reminders';
import { useAppData, useProfile } from '../hooks/useAppData';
import { EmptyState, PageHeader, SectionTitle, StatTile } from '../components/common';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { prText } from '../components/PRLabel';
import { navigate } from '../router';
import { addDays, formatDate, formatMinutes, isValidISODate, startOfWeek, WEEKDAY_NAMES, weekdayOf } from '@/lib/dates';
import { formatVolume } from '@/lib/units';
import { sessionVolume } from '@/domain/analytics';

export function WeeklyReviewPage({ week }: { week?: string }) {
  const data = useAppData();
  const profile = useProfile();
  const weekStart = week && isValidISODate(week) ? startOfWeek(week) : startOfWeek(addDays(data.today, -7));
  const review = useMemo(
    () => weeklyReview(data.sessions, data.exerciseMap, data.templates, profile.trainingDays, data.recovery, weekStart),
    [data.sessions, data.exerciseMap, data.templates, profile.trainingDays, data.recovery, weekStart]
  );
  const units = profile.units;
  const end = addDays(weekStart, 6);
  const canNext = addDays(weekStart, 7) <= data.today;

  return (
    <div>
      <PageHeader title="Weekly review" subtitle={`${formatDate(weekStart)} – ${formatDate(end, { year: true })}`} back="/" />
      <div className="mb-3 flex justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/review/${addDays(weekStart, -7)}`, { replace: true })}>
          <ChevronLeft /> Previous week
        </Button>
        <Button variant="ghost" size="sm" disabled={!canNext} onClick={() => navigate(`/review/${addDays(weekStart, 7)}`, { replace: true })}>
          Next week <ChevronRight />
        </Button>
      </div>
      {review.sessions.length === 0 ? (
        <EmptyState icon={<CalendarCheck />} title="No workouts this week" body="Rest weeks happen. Pick it back up with your next scheduled session." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile icon={<CalendarCheck />} label="Workouts" value={`${review.completed} / ${review.planned}`} sub="completed / planned" />
            <StatTile
              icon={<Dumbbell />}
              label="Volume"
              value={review.volumeKg > 0 ? formatVolume(review.volumeKg, units) : '—'}
              sub={review.volumeChangePct == null ? 'no previous week to compare' : `${review.volumeChangePct >= 0 ? '+' : ''}${review.volumeChangePct}% vs previous week`}
            />
            <StatTile icon={<Clock />} label="Training time" value={review.minutes ? formatMinutes(review.minutes) : '—'} />
            <StatTile icon={<Trophy />} label="Personal records" value={review.prs.length} />
          </div>

          {review.missedDays.length > 0 && (
            <p className="mt-3 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm">
              Missed: {review.missedDays.map((d) => WEEKDAY_NAMES[weekdayOf(d)]).join(', ')}. Consistency beats perfection — no need to make sessions up.
            </p>
          )}

          {(review.avgSleep != null || review.avgEnergy != null || review.avgSoreness != null) && (
            <>
              <SectionTitle>Recovery averages</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                <StatTile icon={<Moon />} label="Sleep" value={review.avgSleep != null ? `${review.avgSleep} h` : '—'} />
                <StatTile icon={<Battery />} label="Energy" value={review.avgEnergy != null ? `${review.avgEnergy}/5` : '—'} />
                <StatTile icon={<Activity />} label="Soreness" value={review.avgSoreness != null ? `${review.avgSoreness}/5` : '—'} />
              </div>
              {review.avgSleep != null && review.avgSleep < 7 && <p className="mt-2 text-xs text-muted-foreground">Average sleep was under 7 hours. More sleep is one of the simplest ways to recover and progress faster.</p>}
            </>
          )}

          {review.prs.length > 0 && (
            <>
              <SectionTitle>New records</SectionTitle>
              <Card>
                <ul className="divide-y">
                  {review.prs.map((p) => (
                    <li key={`${p.exerciseId}-${p.kind}-${p.sessionId}-${p.loadMode}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <Trophy className="h-4 w-4 shrink-0 text-warning" />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{data.exerciseMap.get(p.exerciseId)?.name}</span> — {prText(p, units)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          <SectionTitle>Workouts</SectionTitle>
          <Card>
            <ul className="divide-y">
              {review.sessions
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((s) => (
                  <li key={s.id}>
                    <a href={`#/history/${s.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-secondary">
                      <span>
                        <span className="font-semibold">{s.name}</span> <span className="text-muted-foreground">· {formatDate(s.date, { weekday: true })}</span>
                      </span>
                      <span className="text-muted-foreground">{sessionVolume(s) > 0 ? formatVolume(sessionVolume(s), units) : ''}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
