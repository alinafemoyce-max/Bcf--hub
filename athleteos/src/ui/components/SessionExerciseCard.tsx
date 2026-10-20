import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, History, Info, MoreVertical, Pencil, Plus, Replace, SkipForward, StickyNote, Trash2, Undo2, Minus } from 'lucide-react';
import type { LoadMode, SessionExercise, SetLog, WorkoutSession } from '@/domain/types';
import type { ReadinessAssessment } from '@/domain/readiness';
import { comparableHistory, exerciseHistory, incrementFor } from '@/domain/overload';
import { prefillSet } from '@/domain/session';
import { useAppData, useProfile } from '../hooks/useAppData';
import { recommendationFor } from '../hooks/derived';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Choice } from './common';
import { SetRow } from './SetRow';
import { RecommendationCard } from './RecommendationCard';
import { formatSets } from './setFormat';
import { prescriptionText } from './labels';
import { formatShortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface SessionExerciseCardProps {
  session: WorkoutSession;
  item: SessionExercise;
  index: number;
  count: number;
  mode: 'live' | 'edit';
  readiness: ReadinessAssessment | null;
  onChange: (next: SessionExercise) => void;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  onEditTarget: () => void;
  onRemove: () => void;
  /** Live mode: a set was just ticked off (starts the rest timer). */
  onSetCompleted?: (restSeconds: number) => void;
}

export function SessionExerciseCard({ session, item, index, count, mode, readiness, onChange, onMove, onReplace, onEditTarget, onRemove, onSetCompleted }: SessionExerciseCardProps) {
  const data = useAppData();
  const profile = useProfile();
  const exercise = data.exerciseMap.get(item.exerciseId);
  const allDone = item.sets.length > 0 && item.sets.every((s) => s.completed);
  const [open, setOpen] = useState(mode === 'edit' || !allDone);
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const [showHowTo, setShowHowTo] = useState(false);

  const previous = useMemo(() => {
    if (!exercise) return null;
    const h = comparableHistory(
      exerciseHistory(data.sessions, exercise.id, { excludeSessionId: session.id }).filter((e) => e.date <= session.date),
      item.loadMode
    );
    return h[0] ?? null;
  }, [data.sessions, exercise, session.id, session.date, item.loadMode]);

  const rec = useMemo(
    () => (exercise && mode === 'live' ? recommendationFor(data, exercise, item.prescription, item.loadMode, { readiness, excludeSessionId: session.id }) : null),
    [data, exercise, item.prescription, item.loadMode, readiness, session.id, mode]
  );

  if (!exercise) {
    return (
      <div className="rounded-2xl border border-danger/40 bg-card p-4 text-sm">
        This exercise no longer exists in your library.{' '}
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    );
  }

  const units = profile.units;
  const step = incrementFor(exercise, item.loadMode, profile.increments);
  const rest = item.prescription.restSeconds ?? exercise.restSeconds;
  const done = item.sets.filter((s) => s.completed).length;
  const canToggleLoad = exercise.progressionType === 'double_progression' && exercise.equipment.some((e) => e === 'dumbbell' || e === 'kettlebell');

  const setSets = (sets: SetLog[]) => onChange({ ...item, sets });

  const changeSet = (i: number, patch: Partial<SetLog>) => {
    const sets = item.sets.slice();
    const before = sets[i];
    sets[i] = { ...before, ...patch };
    // Changing the load on one set carries forward to later sets that still had the old load.
    if ('weightKg' in patch) {
      for (let j = i + 1; j < sets.length; j++) if (!sets[j].completed && sets[j].weightKg === before.weightKg) sets[j] = { ...sets[j], weightKg: patch.weightKg };
    }
    setSets(sets);
  };

  const toggle = (i: number) => {
    const s = item.sets[i];
    const now = new Date().toISOString();
    if (s.completed) return changeSet(i, { completed: false, completedAt: null });
    const patch: Partial<SetLog> = { completed: true, completedAt: now };
    if (mode === 'live') {
      // Record the rest actually taken since the previous set of this exercise (used for sprints/jumps).
      const prev = [...item.sets.slice(0, i)].reverse().find((x) => x.completed && x.completedAt);
      if (prev?.completedAt) {
        const secs = (Date.parse(now) - Date.parse(prev.completedAt)) / 1000;
        if (secs > 0 && secs < 1800) patch.restSec = Math.round(secs);
      }
    }
    changeSet(i, patch);
    if (mode === 'live' && onSetCompleted && rest > 0 && i < item.sets.length - 1) onSetCompleted(rest);
    else if (mode === 'live' && onSetCompleted && rest > 0 && i === item.sets.length - 1 && index < count - 1) onSetCompleted(rest);
  };

  const addSet = () => setSets([...item.sets, prefillSet(exercise, item.prescription, rec, item.sets[item.sets.length - 1])]);
  const removeLastSet = () => item.sets.length > 1 && setSets(item.sets.slice(0, -1));

  return (
    <section aria-labelledby={`ex-${item.id}`} className={cn('rounded-2xl border bg-card', item.skipped && 'opacity-60', allDone && !open && 'border-success/30')}>
      <div className="flex items-start gap-2 p-3 pb-2">
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {index + 1} of {count}
            {item.prescription.optional && ' · optional'}
          </p>
          <h3 id={`ex-${item.id}`} className="flex items-center gap-1.5 text-lg font-bold leading-tight">
            {exercise.name}
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </h3>
          <p className="text-sm text-muted-foreground">
            Target {prescriptionText(item.prescription)}
            {rest > 0 && ` · rest ${rest >= 60 ? `${Math.round((rest / 60) * 10) / 10} min` : `${rest} s`}`}
          </p>
        </button>
        <div className="flex items-center gap-1">
          {item.skipped ? <Badge variant="outline">Skipped</Badge> : <Badge variant={allDone ? 'success' : 'secondary'}>{done}/{item.sets.length}</Badge>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Options for ${exercise.name}`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setShowHowTo(true)}>
                <Info /> Technique tips
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowNotes(true)}>
                <StickyNote /> Add note
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEditTarget}>
                <Pencil /> Edit target
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onReplace}>
                <Replace /> Replace exercise
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
                <ArrowUp /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}>
                <ArrowDown /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange({ ...item, skipped: !item.skipped })}>
                {item.skipped ? <Undo2 /> : <SkipForward />} {item.skipped ? 'Un-skip' : 'Skip exercise'}
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={onRemove}>
                <Trash2 /> Remove from workout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {open && !item.skipped && (
        <div className="flex flex-col gap-2.5 px-3 pb-3">
          {previous && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5 shrink-0" />
              <span>
                Last ({formatShortDate(previous.date)}): <span className="font-semibold text-foreground">{formatSets(previous.sets, exercise, previous.loadMode, units)}</span>
              </span>
            </p>
          )}
          {rec && <RecommendationCard rec={rec} />}
          {item.prescription.note && <p className="text-xs text-accent">Coach note: {item.prescription.note}</p>}

          {showHowTo && (
            <div className="rounded-xl border bg-background/50 p-3 text-sm">
              <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                {exercise.instructions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {exercise.demoUrl && (
                <a href={exercise.demoUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  <ExternalLink className="h-4 w-4" /> Watch demonstrations
                </a>
              )}
              <button className="mt-2 block text-xs text-muted-foreground underline" onClick={() => setShowHowTo(false)}>
                Hide tips
              </button>
            </div>
          )}

          {canToggleLoad && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Weight is</span>
              <Choice<LoadMode>
                size="sm"
                className="flex-1"
                allowClear={false}
                label="How the weight is logged"
                value={item.loadMode}
                onChange={(v) => v && onChange({ ...item, loadMode: v })}
                options={[
                  { value: 'per_dumbbell', label: 'Per dumbbell' },
                  { value: 'total', label: 'Total' }
                ]}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {item.sets.map((s, i) => (
              <SetRow
                key={s.id}
                index={i}
                set={s}
                exercise={exercise}
                units={units}
                weightStepKg={step}
                target={{ reps: rec?.targetReps ?? item.prescription.repsMax ?? item.prescription.repsMin, durationSec: item.prescription.durationSec }}
                onChange={(patch) => changeSet(i, patch)}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={addSet}>
              <Plus /> Add set
            </Button>
            <Button variant="ghost" size="sm" disabled={item.sets.length <= 1} onClick={removeLastSet} aria-label="Remove last set">
              <Minus /> Remove set
            </Button>
          </div>
          {showNotes && (
            <Textarea rows={2} placeholder={`Notes for ${exercise.name.toLowerCase()} (e.g. seat height, cues, how it felt)`} value={item.notes ?? ''} onChange={(e) => onChange({ ...item, notes: e.target.value })} aria-label={`Notes for ${exercise.name}`} />
          )}
        </div>
      )}
      {!open && done > 0 && !item.skipped && <p className="px-3 pb-3 text-sm text-muted-foreground">{formatSets(item.sets, exercise, item.loadMode, units)}</p>}
    </section>
  );
}
