import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CloudOff, MoreVertical, Plus, StickyNote, Timer, Trash2, Flag } from 'lucide-react';
import { repo } from '@/data';
import type { Exercise, SessionExercise, WorkoutSession } from '@/domain/types';
import { buildSessionExercise, finishSession, sessionProgress } from '@/domain/session';
import { useAppData, useProfile } from '../hooks/useAppData';
import { activeSession, readinessFor } from '../hooks/derived';
import { EmptyState } from '../components/common';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { SessionExerciseCard } from '../components/SessionExerciseCard';
import { ExercisePicker } from '../components/ExercisePicker';
import { PrescriptionDialog } from '../components/PrescriptionDialog';
import { ReadinessBadge } from '../components/ReadinessBadge';
import { RestTimer } from '../components/RestTimer';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { formatDuration } from '@/lib/dates';
import { moveItem, defaultPrescription } from './TemplateEditor';
import { useNow } from '../hooks/useNow';

/**
 * Keeps a local working copy of a session and writes every change straight to IndexedDB (in order),
 * so closing the app mid-workout never loses a set.
 */
export function useSessionDraft(initial: WorkoutSession | undefined, save: (s: WorkoutSession) => Promise<unknown>) {
  const [draft, setDraft] = useState<WorkoutSession | undefined>(initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const closed = useRef(false);
  // The latest version, so several changes from one tap (e.g. tick a set + start the rest timer)
  // each build on the previous one instead of on a stale render.
  const latest = useRef<WorkoutSession | undefined>(initial);
  useEffect(() => {
    if (!draft && initial) {
      latest.current = initial;
      setDraft(initial);
    }
  }, [initial, draft]);
  const update = useCallback(
    (change: (prev: WorkoutSession) => WorkoutSession) => {
      if (closed.current || !latest.current) return;
      const next = change(latest.current);
      latest.current = next;
      setDraft(next);
      queue.current = queue.current
        .then(() => save(next))
        .then(() => setSaveError(null))
        .catch((e: unknown) => setSaveError(errorMessage(e)));
    },
    [save]
  );
  const flush = () => queue.current;
  /** Wait for pending writes, then ignore further edits (the session was finished or discarded). */
  const close = async () => {
    await queue.current;
    closed.current = true;
  };
  const reopen = () => {
    closed.current = false;
  };
  return { draft, update, saveError, flush, close, reopen };
}

export function LiveWorkout() {
  const data = useAppData();
  const profile = useProfile();
  const { toast, confirm } = useFeedback();
  const stored = activeSession(data);
  const { draft: session, update, saveError, close, reopen } = useSessionDraft(stored, (s) => repo.saveSession(s));
  const now = useNow(1000);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; index: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  if (!session || session.status !== 'in_progress') {
    return (
      <div className="pt-24">
        <EmptyState
          icon={<Timer />}
          title="No workout in progress"
          body="Start one from the Train tab."
          action={<Button onClick={() => navigate('/train')}>Go to Train</Button>}
        />
      </div>
    );
  }

  const check = session.recoveryCheckId ? data.recovery.find((r) => r.id === session.recoveryCheckId) : undefined;
  const readiness = check ? readinessFor(check) : null;
  const { done, total } = sessionProgress(session);
  const elapsed = (now - Date.parse(session.startedAt)) / 1000;

  const setItems = (exercises: SessionExercise[]) => update((s) => ({ ...s, exercises }));
  const setItem = (i: number, se: SessionExercise) =>
    update((s) => {
      const items = s.exercises.slice();
      items[i] = se;
      return { ...s, exercises: items };
    });

  const pick = async (e: Exercise) => {
    if (!picker) return;
    if (picker.mode === 'add') {
      setItems([...session.exercises, buildSessionExercise(e, defaultPrescription(e), { sessions: data.sessions, profile, readiness })]);
      return;
    }
    const old = session.exercises[picker.index];
    if (old.sets.some((s) => s.completed)) {
      const ok = await confirm({ title: 'Replace this exercise?', description: 'Sets already logged for it in this workout will be removed.', confirmLabel: 'Replace', destructive: true });
      if (!ok) return;
    }
    const oldEx = data.exerciseMap.get(old.exerciseId);
    const p = oldEx?.progressionType === e.progressionType ? old.prescription : defaultPrescription(e);
    const items = session.exercises.slice();
    items[picker.index] = buildSessionExercise(e, p, { sessions: data.sessions, profile, readiness });
    setItems(items);
  };

  const remove = async (i: number) => {
    const se = session.exercises[i];
    if (se.sets.some((s) => s.completed)) {
      const ok = await confirm({ title: 'Remove this exercise?', description: 'Its logged sets will be removed from this workout.', confirmLabel: 'Remove', destructive: true });
      if (!ok) return;
    }
    setItems(session.exercises.filter((_, j) => j !== i));
  };

  const finish = async () => {
    const remaining = total - done;
    if (done === 0) {
      const ok = await confirm({
        title: 'No sets completed',
        description: 'Finish anyway? The workout will be saved with nothing logged. To throw it away instead, use Discard.',
        confirmLabel: 'Finish anyway'
      });
      if (!ok) return;
    } else if (remaining > 0) {
      const ok = await confirm({
        title: `Finish with ${remaining} set${remaining === 1 ? '' : 's'} not ticked?`,
        description: 'Unticked sets are kept as “not done” and never count towards your progress or recommendations.',
        confirmLabel: 'Finish workout'
      });
      if (!ok) return;
    }
    setFinishing(true);
    try {
      await close();
      const finished = finishSession(session, new Date().toISOString());
      await repo.saveSession(finished);
      navigate(`/train/summary/${session.id}`, { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
      reopen();
      setFinishing(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({ title: 'Discard this workout?', description: 'All sets logged in this workout will be deleted.', confirmLabel: 'Discard', destructive: true });
    if (!ok) return;
    await close();
    await repo.deleteSession(session.id);
    toast('Workout discarded', 'info');
    navigate('/', { replace: true });
  };

  const startRest = (seconds: number) => update((s) => ({ ...s, restEndsAt: new Date(Date.now() + seconds * 1000).toISOString() }));
  const editingItem = editing != null ? session.exercises[editing] : null;

  return (
    <div>
      <header className="sticky top-0 z-30 -mx-4 mb-3 bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">{session.name}</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground tabular">
              <Timer className="h-3.5 w-3.5" /> {formatDuration(elapsed)} · {done}/{total} sets
              {saveError ? (
                <span className="flex items-center gap-1 text-danger">
                  <CloudOff className="h-3.5 w-3.5" /> Not saved
                </span>
              ) : (
                <span className="flex items-center gap-1 text-success">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workout options">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPicker({ mode: 'add' })}>
                <Plus /> Add exercise
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setNotesOpen(true)}>
                <StickyNote /> Session notes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={discard}>
                <Trash2 /> Discard workout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={finish} disabled={finishing}>
            <Flag /> Finish
          </Button>
        </div>
        <Progress value={total ? (done / total) * 100 : 0} className="mt-2 h-1.5" aria-label="Workout progress" />
      </header>

      {saveError && <p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">Couldn’t save your last change: {saveError}</p>}

      {readiness && readiness.level !== 'green' && readiness.level !== 'unknown' && (
        <div className="mb-3 rounded-2xl border bg-card p-3 text-sm">
          <ReadinessBadge level={readiness.level} className="text-sm" />
          <p className="mt-1 text-muted-foreground">{readiness.overridden ? 'You chose to train as normal. Stop anything that causes pain.' : readiness.headline + '. Recommendations below are adjusted.'}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {session.exercises.map((se, i) => (
          <SessionExerciseCard
            key={se.id}
            session={session}
            item={se}
            index={i}
            count={session.exercises.length}
            mode="live"
            readiness={readiness}
            onChange={(next) => setItem(i, next)}
            onMove={(dir) => update((s) => ({ ...s, exercises: moveItem(s.exercises, i, i + dir) }))}
            onReplace={() => setPicker({ mode: 'replace', index: i })}
            onEditTarget={() => setEditing(i)}
            onRemove={() => remove(i)}
            onSetCompleted={startRest}
          />
        ))}
        {session.exercises.length === 0 && <EmptyState title="Empty workout" body="Add exercises to start logging." />}
      </div>
      <Button variant="outline" className="mt-3 w-full" onClick={() => setPicker({ mode: 'add' })}>
        <Plus /> Add exercise
      </Button>
      <Button size="lg" className="mt-3 w-full" onClick={finish} disabled={finishing}>
        <Flag /> Finish workout
      </Button>

      <RestTimer endsAt={session.restEndsAt ?? null} onChange={(endsAt) => update((s) => ({ ...s, restEndsAt: endsAt }))} />

      <ExercisePicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} exercises={data.exercises} onPick={pick} title={picker?.mode === 'replace' ? 'Replace exercise' : 'Add exercise'} />
      <PrescriptionDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        exercise={editingItem ? data.exerciseMap.get(editingItem.exerciseId) : undefined}
        value={editingItem?.prescription ?? { sets: 3 }}
        onSave={(p) => editing != null && setItem(editing, { ...session.exercises[editing], prescription: p })}
      />
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session notes</DialogTitle>
          </DialogHeader>
          <Textarea rows={5} value={session.notes ?? ''} onChange={(e) => {
              const notes = e.target.value;
              update((s) => ({ ...s, notes }));
            }} placeholder="How did it feel? Anything to remember next time?" aria-label="Session notes" />
          <DialogFooter>
            <Button onClick={() => setNotesOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
