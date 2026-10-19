import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, History as HistoryIcon, Plus, Search, Trophy, X } from 'lucide-react';
import { useAppData, useProfile } from '../hooks/useAppData';
import { headlinePRs, personalRecordEvents, sessionDurationMin, sessionVolume, completedSetCount } from '@/domain/analytics';
import { EmptyState, PageHeader } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { navigate } from '../router';
import { addDays, daysBetween, formatDate, formatMinutes, monthLabel, startOfWeek, toISODate, WEEKDAY_SHORT } from '@/lib/dates';
import { formatVolume } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { Weekday } from '@/domain/types';

export function HistoryPage() {
  const data = useAppData();
  const profile = useProfile();
  const [q, setQ] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const t = new Date();
  const [month, setMonth] = useState({ y: t.getFullYear(), m: t.getMonth() });

  const completed = useMemo(() => data.sessions.filter((s) => s.status === 'completed'), [data.sessions]);
  const prCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of headlinePRs(personalRecordEvents(data.sessions, data.exerciseMap))) m.set(p.sessionId, (m.get(p.sessionId) ?? 0) + 1);
    return m;
  }, [data.sessions, data.exerciseMap]);
  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of completed) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    return m;
  }, [completed]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return completed.filter((s) => {
      if (day && s.date !== day) return false;
      if (!term) return true;
      if (s.name.toLowerCase().includes(term) || (s.notes ?? '').toLowerCase().includes(term) || s.date.includes(term)) return true;
      return s.exercises.some((se) => (data.exerciseMap.get(se.exerciseId)?.name ?? '').toLowerCase().includes(term) || (se.notes ?? '').toLowerCase().includes(term));
    });
  }, [completed, q, day, data.exerciseMap]);

  // Calendar grid: Monday-first weeks covering the month.
  const first = toISODate(new Date(month.y, month.m, 1));
  const gridStart = startOfWeek(first);
  const last = toISODate(new Date(month.y, month.m + 1, 0));
  const weeks = Math.ceil((daysBetween(gridStart, last) + 1) / 7);
  const shown: string[] = [];
  for (let d = gridStart; shown.length < weeks * 7; d = addDays(d, 1)) shown.push(d);
  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setDay(null);
  };

  return (
    <div>
      <PageHeader
        title="History"
        subtitle={`${completed.length} workout${completed.length === 1 ? '' : 's'} logged`}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/history/new')}>
            <Plus /> Log past
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <p className="font-semibold">{monthLabel(month.y, month.m)}</p>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
            <span key={d}>{WEEKDAY_SHORT[d].slice(0, 2)}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {shown.map((d) => {
            const inMonth = Number(d.slice(5, 7)) - 1 === month.m;
            const n = byDate.get(d) ?? 0;
            const selected = day === d;
            const isToday = d === data.today;
            return (
              <button
                key={d}
                disabled={n === 0}
                onClick={() => setDay(selected ? null : d)}
                aria-label={`${formatDate(d, { weekday: true })}${n ? `, ${n} workout${n > 1 ? 's' : ''}` : ', no workouts'}`}
                aria-pressed={selected}
                className={cn(
                  'relative grid aspect-square place-items-center rounded-lg text-sm tabular',
                  !inMonth && 'opacity-30',
                  n > 0 ? 'bg-primary/25 font-bold text-foreground' : 'text-muted-foreground',
                  selected && 'bg-primary text-primary-foreground',
                  isToday && !selected && 'ring-2 ring-accent/70'
                )}
              >
                {Number(d.slice(8))}
                {n > 1 && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search workouts, exercises or notes" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search history" />
      </div>
      {day && (
        <button className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold" onClick={() => setDay(null)}>
          {formatDate(day, { weekday: true })} <X className="h-3 w-3" />
        </button>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((s) => {
          const dur = sessionDurationMin(s);
          const vol = sessionVolume(s);
          const prs = prCount.get(s.id) ?? 0;
          return (
            <li key={s.id}>
              <a href={`#/history/${s.id}`} className="block rounded-2xl border bg-card p-4 hover:bg-secondary">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">{formatDate(s.date, { weekday: true, year: true })}</p>
                    <p className="truncate text-lg font-bold">{s.name}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {prs > 0 && (
                      <Badge variant="warning">
                        <Trophy /> {prs}
                      </Badge>
                    )}
                    {s.source === 'manual' && <Badge variant="secondary">Manual</Badge>}
                  </div>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  {dur != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {formatMinutes(dur)}
                    </span>
                  )}
                  {vol > 0 && (
                    <span className="flex items-center gap-1">
                      <Dumbbell className="h-3.5 w-3.5" /> {formatVolume(vol, profile.units)}
                    </span>
                  )}
                  <span>{completedSetCount(s)} sets</span>
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {s.exercises
                    .filter((se) => !se.skipped && se.sets.some((x) => x.completed))
                    .map((se) => data.exerciseMap.get(se.exerciseId)?.name)
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </a>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && (
        <div className="mt-3">
          {completed.length === 0 ? (
            <EmptyState
              icon={<HistoryIcon />}
              title="No workouts yet"
              body="Finished workouts appear here. You can also log past workouts to give AthleteOS a starting point."
              action={<Button onClick={() => navigate('/history/new')}>Log a past workout</Button>}
            />
          ) : (
            <EmptyState icon={<Search />} title="No matching workouts" body="Try a different search or clear the date filter." />
          )}
        </div>
      )}
    </div>
  );
}
