import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { repo } from '@/data';
import type { Exercise, Prescription, SessionExercise, WorkoutSession } from '@/domain/types';
import { prefillSets } from '@/domain/session';
import { useAppData } from '../hooks/useAppData';
import { EmptyState, Field, PageHeader, SectionTitle } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { NativeSelect } from '../components/ui/select';
import { SessionExerciseCard } from '../components/SessionExerciseCard';
import { ExercisePicker } from '../components/ExercisePicker';
import { PrescriptionDialog } from '../components/PrescriptionDialog';
import { errorMessage, useFeedback } from '../components/feedback';
import { goBack, navigate } from '../router';
import { isValidISODate } from '@/lib/dates';
import { newId, nowISO } from '@/lib/id';
import { defaultPrescription, moveItem } from './TemplateEditor';

/** Logged-after-the-fact exercise: sets start ticked, because the work was done. */
function manualExercise(ex: Exercise, p: Prescription): SessionExercise {
  return {
    id: newId(),
    exerciseId: ex.id,
    prescription: { ...p },
    loadMode: ex.defaultLoadMode,
    sets: prefillSets(ex, p, null).map((s) => ({ ...s, completed: true }))
  };
}

const startOfDayISO = (date: string) => new Date(`${date}T12:00:00`).toISOString();

/** Edit a past workout, or enter one manually (id = null). */
export function SessionEditor({ id }: { id: string | null }) {
  const data = useAppData();
  const { toast, confirm } = useFeedback();
  const existing = id ? data.sessions.find((s) => s.id === id) : undefined;
  const [draft, setDraft] = useState<WorkoutSession | null>(null);
  const [duration, setDuration] = useState('');
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; index: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft) return;
    if (existing) {
      setDraft(structuredClone(existing));
      const mins = existing.durationMin ?? (existing.endedAt ? Math.round((Date.parse(existing.endedAt) - Date.parse(existing.startedAt)) / 60000) : null);
      setDuration(mins != null && mins > 0 ? String(mins) : '');
    } else if (!id) {
      const now = nowISO();
      setDraft({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        templateId: null,
        name: 'Past workout',
        focus: 'custom',
        date: data.today,
        startedAt: startOfDayISO(data.today),
        endedAt: null,
        status: 'completed',
        source: 'manual',
        exercises: [],
        notes: '',
        revision: 0
      });
    }
  }, [existing, id, draft, data.today]);

  if (!draft) {
    return (
      <div>
        <PageHeader title="Edit workout" back="/history" />
        <EmptyState title="Workout not found" />
      </div>
    );
  }

  const isNew = !id;
  const update = (patch: Partial<WorkoutSession>) => setDraft({ ...draft, ...patch });
  const setItems = (exercises: SessionExercise[]) => update({ exercises });
  const setItem = (i: number, se: SessionExercise) => {
    const items = draft.exercises.slice();
    items[i] = se;
    setItems(items);
  };

  const applyTemplate = async (templateId: string) => {
    const t = data.templates.find((x) => x.id === templateId);
    if (!t) return;
    if (draft.exercises.length) {
      const ok = await confirm({ title: `Load “${t.name}”?`, description: 'This replaces the exercises you’ve added so far.', confirmLabel: 'Load workout' });
      if (!ok) return;
    }
    const items = t.exercises.flatMap((te) => {
      const ex = data.exerciseMap.get(te.exerciseId);
      return ex && !ex.deletedAt ? [manualExercise(ex, te.prescription)] : [];
    });
    update({ templateId: t.id, name: t.name, focus: t.focus, exercises: items });
  };

  const pick = (e: Exercise) => {
    if (!picker) return;
    if (picker.mode === 'add') setItems([...draft.exercises, manualExercise(e, defaultPrescription(e))]);
    else {
      const items = draft.exercises.slice();
      const old = items[picker.index];
      const keep = data.exerciseMap.get(old.exerciseId)?.progressionType === e.progressionType;
      items[picker.index] = keep ? { ...old, exerciseId: e.id, loadMode: e.defaultLoadMode } : manualExercise(e, defaultPrescription(e));
      setItems(items);
    }
  };

  const save = async () => {
    if (!isValidISODate(draft.date)) return toast('Choose a valid date.', 'error');
    if (draft.date > data.today) return toast('The date can’t be in the future.', 'error');
    const mins = duration.trim() === '' ? null : Number(duration);
    if (mins != null && (!Number.isFinite(mins) || mins < 0 || mins > 600)) return toast('Duration must be 0–600 minutes.', 'error');
    const missingLoad = draft.exercises.find((se) => {
      const ex = data.exerciseMap.get(se.exerciseId);
      return !se.skipped && ex?.progressionType === 'double_progression' && ex.defaultLoadMode !== 'bodyweight' && se.sets.some((s) => s.completed && s.weightKg == null);
    });
    if (missingLoad) {
      const name = data.exerciseMap.get(missingLoad.exerciseId)?.name;
      const ok = await confirm({
        title: `No weight entered for ${name}`,
        description: 'Ticked sets without a weight are treated as bodyweight. Save anyway?',
        confirmLabel: 'Save anyway'
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const sameDay = existing && existing.date === draft.date;
      const startedAt = sameDay ? draft.startedAt : startOfDayISO(draft.date);
      const endedAt = mins != null ? new Date(Date.parse(startedAt) + mins * 60000).toISOString() : sameDay ? draft.endedAt : startedAt;
      const next: WorkoutSession = { ...draft, startedAt, endedAt, durationMin: mins, status: 'completed' };
      if (isNew) await repo.saveSession(next);
      else await repo.editCompletedSession(next);
      toast(isNew ? 'Workout added to history' : 'Changes saved — previous version kept');
      navigate(`/history/${draft.id}`, { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  const editingItem = editing != null ? draft.exercises[editing] : null;

  return (
    <div>
      <PageHeader title={isNew ? 'Log past workout' : 'Edit workout'} back={isNew ? '/history' : `/history/${draft.id}`} />
      {!isNew && <p className="mb-3 rounded-xl border bg-card p-3 text-xs text-muted-foreground">Saving keeps a copy of the current version in the edit history. Records, charts and recommendations update automatically.</p>}
      <div className="flex flex-col gap-3">
        {isNew && (
          <Field label="Start from a programme workout (optional)" htmlFor="se-tpl">
            <NativeSelect id="se-tpl" value={draft.templateId ?? ''} onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
              <option value="">Choose…</option>
              {data.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Name" htmlFor="se-name">
          <Input id="se-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="se-date">
            <Input id="se-date" type="date" max={data.today} value={draft.date} onChange={(e) => update({ date: e.target.value })} />
          </Field>
          <Field label="Duration (min)" htmlFor="se-dur">
            <Input id="se-dur" type="number" inputMode="numeric" value={duration} placeholder="optional" onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="se-notes">
          <Textarea id="se-notes" rows={2} value={draft.notes ?? ''} onChange={(e) => update({ notes: e.target.value })} />
        </Field>
      </div>

      <SectionTitle>Exercises</SectionTitle>
      <div className="flex flex-col gap-3">
        {draft.exercises.map((se, i) => (
          <SessionExerciseCard
            key={se.id}
            session={draft}
            item={se}
            index={i}
            count={draft.exercises.length}
            mode="edit"
            readiness={null}
            onChange={(next) => setItem(i, next)}
            onMove={(dir) => setItems(moveItem(draft.exercises, i, i + dir))}
            onReplace={() => setPicker({ mode: 'replace', index: i })}
            onEditTarget={() => setEditing(i)}
            onRemove={() => setItems(draft.exercises.filter((_, j) => j !== i))}
          />
        ))}
        {draft.exercises.length === 0 && <EmptyState title="No exercises" body={isNew ? 'Load a programme workout above or add exercises one by one.' : 'Add the exercises you did.'} />}
      </div>
      <Button variant="outline" className="mt-3 w-full" onClick={() => setPicker({ mode: 'add' })}>
        <Plus /> Add exercise
      </Button>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-6 flex gap-2 rounded-2xl bg-background/80 py-2 backdrop-blur">
        <Button variant="outline" size="lg" onClick={() => goBack('/history')}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1" disabled={saving || !draft.name.trim()} onClick={save}>
          <Save /> {isNew ? 'Save workout' : 'Save changes'}
        </Button>
      </div>

      <ExercisePicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} exercises={data.exercises} onPick={pick} />
      <PrescriptionDialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        exercise={editingItem ? data.exerciseMap.get(editingItem.exerciseId) : undefined}
        value={editingItem?.prescription ?? { sets: 3 }}
        onSave={(p) => editing != null && setItem(editing, { ...draft.exercises[editing], prescription: p })}
      />
    </div>
  );
}
