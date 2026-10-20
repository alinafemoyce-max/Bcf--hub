import { useMemo } from 'react';
import { Clock, Dumbbell, HeartPulse, ListChecks, Trophy } from 'lucide-react';
import type { WorkoutSession } from '@/domain/types';
import { completedSetCount, prsSetInSession, sessionDurationMin, sessionVolume } from '@/domain/analytics';
import { useAppData, useProfile } from '../hooks/useAppData';
import { readinessFor } from '../hooks/derived';
import { StatTile, SectionTitle } from './common';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ReadinessBadge } from './ReadinessBadge';
import { formatSets } from './setFormat';
import { prText } from './PRLabel';
import { prescriptionText } from './labels';
import { formatMinutes } from '@/lib/dates';
import { formatVolume } from '@/lib/units';

export function SessionReport({ session }: { session: WorkoutSession }) {
  const data = useAppData();
  const profile = useProfile();
  const units = profile.units;
  const prs = useMemo(() => prsSetInSession(data.sessions, session.id, data.exerciseMap), [data.sessions, session.id, data.exerciseMap]);
  const check = session.recoveryCheckId ? data.recovery.find((r) => r.id === session.recoveryCheckId) : data.recovery.find((r) => r.sessionId === session.id);
  const readiness = check ? readinessFor(check) : null;
  const duration = sessionDurationMin(session);
  const volume = sessionVolume(session);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile icon={<Clock />} label="Duration" value={duration != null ? formatMinutes(duration) : '—'} />
        <StatTile icon={<Dumbbell />} label="Volume" value={volume > 0 ? formatVolume(volume, units) : '—'} />
        <StatTile icon={<ListChecks />} label="Sets completed" value={completedSetCount(session)} />
        <StatTile icon={<Trophy />} label="Personal records" value={prs.length} />
      </div>

      {prs.length > 0 && (
        <>
          <SectionTitle>New personal records</SectionTitle>
          <Card className="border-warning/30">
            <ul className="divide-y">
              {prs.map((p) => (
                <li key={`${p.exerciseId}-${p.kind}-${p.loadMode}`} className="flex items-center gap-3 px-4 py-3">
                  <Trophy className="h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-semibold">{data.exerciseMap.get(p.exerciseId)?.name}</p>
                    <p className="text-xs text-muted-foreground">{prText(p, units)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>Recovery check-in</SectionTitle>
      <Card className="p-4">
        {check && readiness ? (
          <>
            <ReadinessBadge level={readiness.level} className="text-sm" />
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>Sleep {check.sleepHours ?? '—'} h</span>
              <span>Energy {check.energy ?? '—'}/5</span>
              <span>Soreness {check.soreness ?? '—'}/5</span>
              <span>Motivation {check.motivation ?? '—'}/5</span>
              {check.pain !== 'none' && <span>Pain: {check.pain}{check.painNotes ? ` (${check.painNotes})` : ''}</span>}
              {check.illness && <span>Feeling ill</span>}
              {check.overridden && <span>Recommendation overridden</span>}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartPulse className="h-4 w-4" /> No check-in recorded for this workout.
          </p>
        )}
      </Card>

      <SectionTitle>Exercises</SectionTitle>
      <Card>
        <ul className="divide-y">
          {session.exercises.map((se) => {
            const ex = data.exerciseMap.get(se.exerciseId);
            const done = se.sets.filter((s) => s.completed).length;
            return (
              <li key={se.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{ex?.name ?? 'Deleted exercise'}</p>
                  {se.skipped ? <Badge variant="outline">Skipped</Badge> : <Badge variant={done >= se.sets.length ? 'success' : 'secondary'}>{done}/{se.sets.length}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Target {prescriptionText(se.prescription)}</p>
                {!se.skipped && done > 0 && <p className="mt-1 text-sm">{formatSets(se.sets, ex, se.loadMode, units)}</p>}
                {!se.skipped && done > 0 && ex?.progressionType === 'double_progression' && se.sets.some((s) => s.completed && (s.rir != null || s.technique)) && (
                  <p className="text-xs text-muted-foreground">
                    {se.sets
                      .filter((s) => s.completed)
                      .map((s, i) => `S${i + 1}: ${s.rir != null ? `${s.rir} RIR` : '–'}${s.technique ? `, ${s.technique}` : ''}`)
                      .join(' · ')}
                  </p>
                )}
                {se.notes && <p className="mt-1 text-xs italic text-muted-foreground">“{se.notes}”</p>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
