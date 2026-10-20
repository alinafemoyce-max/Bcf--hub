import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, MoreVertical, Pencil, Play, Plus, Replace, Trash2 } from 'lucide-react';
import { repo } from '@/data';
import type { Exercise, Prescription, TemplateExercise, Weekday, WorkoutFocus, WorkoutTemplate } from '@/domain/types';
import { useAppData } from '../hooks/useAppData';
import { EmptyState, Field, PageHeader, SectionTitle } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { NativeSelect } from '../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { ExercisePicker } from '../components/ExercisePicker';
import { PrescriptionDialog } from '../components/PrescriptionDialog';
import { errorMessage, useFeedback } from '../components/feedback';
import { FOCUS_LABELS, prescriptionText } from '../components/labels';
import { goBack, navigate } from '../router';
import { WEEKDAY_NAMES } from '@/lib/dates';
import { newId, nowISO } from '@/lib/id';

export function defaultPrescription(e: Exercise): Prescription {
  switch (e.progressionType) {
    case 'double_progression':
      return { sets: 3, repsMin: 8, repsMax: 12, perSide: e.unilateral };
    case 'bodyweight_reps':
      return { sets: 3, repsMin: 10, repsMax: 10, perSide: e.unilateral };
    case 'timed_hold':
      return { sets: 2, durationSec: 30 };
    case 'mobility':
      return { sets: 2, repsMin: 10, repsMax: 10 };
    case 'sprint':
      return { sets: 4, distanceM: 10 };
    case 'agility':
      return { sets: 3, repsMin: 1, repsMax: 1 };
    case 'jump':
      return { sets: 3, repsMin: 3, repsMax: 3 };
    default:
      return { sets: 1, durationSec: 300 };
  }
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function TemplateEditor({ id }: { id: string }) {
  const data = useAppData();
  const { toast, confirm } = useFeedback();
  const existing = data.templates.find((t) => t.id === id);
  const isNew = id === 'new';
  const [draft, setDraft] = useState<WorkoutTemplate | null>(null);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; index: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (draft) return;
    if (existing) setDraft(structuredClone(existing));
    else if (isNew) {
      const now = nowISO();
      setDraft({ id: newId(), createdAt: now, updatedAt: now, deletedAt: null, name: 'New workout', focus: 'custom', dayOfWeek: null, exercises: [], description: '' });
    }
  }, [existing, isNew, draft]);

  if (!draft) {
    return (
      <div>
        <PageHeader title="Workout" back="/train" />
        <EmptyState title="Workout not found" body="It may have been deleted." />
      </div>
    );
  }

  const update = (patch: Partial<WorkoutTemplate>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  const setItems = (exercises: TemplateExercise[]) => update({ exercises });

  const save = async (thenStart = false) => {
    try {
      const clash = draft.dayOfWeek != null ? data.templates.find((t) => t.id !== draft.id && t.dayOfWeek === draft.dayOfWeek) : undefined;
      if (clash) {
        const ok = await confirm({
          title: `${WEEKDAY_NAMES[draft.dayOfWeek!]} already has “${clash.name}”`,
          description: `Move “${clash.name}” to unscheduled so “${draft.name}” is ${WEEKDAY_NAMES[draft.dayOfWeek!]}’s workout?`,
          confirmLabel: 'Move it'
        });
        if (!ok) return;
        await repo.saveTemplate({ ...clash, dayOfWeek: null });
      }
      await repo.saveTemplate(draft);
      setDirty(false);
      toast('Workout saved');
      if (thenStart) navigate(`/train/start/${draft.id}`);
      else if (isNew) navigate(`/train/template/${draft.id}`, { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Delete “${draft.name}”?`, description: 'Past workouts logged from it stay in your history.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    await repo.deleteTemplate(draft.id);
    toast('Workout deleted');
    navigate('/train', { replace: true });
  };

  const pick = (e: Exercise) => {
    if (!picker) return;
    if (picker.mode === 'add') setItems([...draft.exercises, { id: newId(), exerciseId: e.id, prescription: defaultPrescription(e) }]);
    else {
      const items = draft.exercises.slice();
      const old = items[picker.index];
      const oldEx = data.exerciseMap.get(old.exerciseId);
      // Keep the target when replacing with a similar exercise; otherwise use sensible defaults.
      const keep = oldEx?.progressionType === e.progressionType;
      items[picker.index] = { ...old, exerciseId: e.id, prescription: keep ? old.prescription : defaultPrescription(e) };
      setItems(items);
    }
  };

  const editingItem = editing != null ? draft.exercises[editing] : null;

  return (
    <div>
      <PageHeader
        title={isNew ? 'New workout' : 'Edit workout'}
        back="/train"
        actions={
          !isNew && (
            <Button variant="ghost" size="icon" aria-label="Delete workout" onClick={remove}>
              <Trash2 className="text-danger" />
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3">
        <Field label="Name" htmlFor="tpl-name">
          <Input id="tpl-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day" htmlFor="tpl-day">
            <NativeSelect id="tpl-day" value={draft.dayOfWeek ?? ''} onChange={(e) => update({ dayOfWeek: e.target.value ? (Number(e.target.value) as Weekday) : null })}>
              <option value="">Unscheduled</option>
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES[d]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Focus" htmlFor="tpl-focus">
            <NativeSelect id="tpl-focus" value={draft.focus} onChange={(e) => update({ focus: e.target.value as WorkoutFocus })}>
              {Object.entries(FOCUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Description" htmlFor="tpl-desc">
          <Textarea id="tpl-desc" rows={2} value={draft.description ?? ''} onChange={(e) => update({ description: e.target.value })} />
        </Field>
      </div>

      <SectionTitle>Exercises · {draft.exercises.length}</SectionTitle>
      {draft.exercises.length === 0 ? (
        <EmptyState title="No exercises yet" body="Add exercises from the library." />
      ) : (
        <ol className="flex flex-col gap-2">
          {draft.exercises.map((te, i) => {
            const ex = data.exerciseMap.get(te.exerciseId);
            return (
              <li key={te.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-3">
                <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground tabular">{i + 1}</span>
                <button className="min-w-0 flex-1 py-1 text-left" onClick={() => setEditing(i)}>
                  <p className="truncate font-semibold">{ex?.name ?? 'Missing exercise'}</p>
                  <p className="text-sm text-muted-foreground">
                    {prescriptionText(te.prescription)}
                    {te.prescription.optional && ' · optional'}
                  </p>
                </button>
                <div className="flex shrink-0 flex-col">
                  <button aria-label={`Move ${ex?.name} up`} disabled={i === 0} className="grid h-8 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-30" onClick={() => setItems(moveItem(draft.exercises, i, i - 1))}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`Move ${ex?.name} down`}
                    disabled={i === draft.exercises.length - 1}
                    className="grid h-8 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-30"
                    onClick={() => setItems(moveItem(draft.exercises, i, i + 1))}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Options for ${ex?.name}`}>
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(i)}>
                      <Pencil /> Edit sets & reps
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setPicker({ mode: 'replace', index: i })}>
                      <Replace /> Replace exercise
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setItems(draft.exercises.filter((_, j) => j !== i))}>
                      <Trash2 /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ol>
      )}
      <Button variant="outline" className="mt-3 w-full" onClick={() => setPicker({ mode: 'add' })}>
        <Plus /> Add exercise
      </Button>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-6 flex gap-2 rounded-2xl bg-background/80 py-2 backdrop-blur">
        <Button className="flex-1" size="lg" disabled={!dirty && !isNew} onClick={() => save(false)}>
          Save
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={draft.exercises.length === 0 || data.sessions.some((s) => s.status === 'in_progress')}
          onClick={() => (dirty || isNew ? save(true) : navigate(`/train/start/${draft.id}`))}
        >
          <Play className="fill-current" /> Start
        </Button>
      </div>
      {dirty && (
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => goBack('/train')}>
          Discard changes
        </Button>
      )}

      <ExercisePicker
        open={!!picker}
        onOpenChange={(o) => !o && setPicker(null)}
        exercises={data.exercises}
        onPick={pick}
        title={picker?.mode === 'replace' ? 'Replace exercise' : 'Add exercise'}
        description={picker?.mode === 'replace' ? 'History for each exercise is kept separately — variations are never compared directly.' : undefined}
      />
      <PrescriptionDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        exercise={editingItem ? data.exerciseMap.get(editingItem.exerciseId) : undefined}
        value={editingItem?.prescription ?? { sets: 3 }}
        onSave={(p) => {
          if (editing == null) return;
          const items = draft.exercises.slice();
          items[editing] = { ...items[editing], prescription: p };
          setItems(items);
        }}
      />
    </div>
  );
}
