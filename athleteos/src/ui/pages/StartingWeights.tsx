import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { repo } from '@/data';
import type { Exercise, LoadMode, Prescription, SessionExercise, WorkoutSession } from '@/domain/types';
import { useAppData, useProfile } from '../hooks/useAppData';
import { Field, PageHeader, Choice } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { addDays, isValidISODate } from '@/lib/dates';
import { displayToKg } from '@/lib/units';
import { newId, nowISO } from '@/lib/id';
import { prescriptionText } from '../components/labels';

interface Row {
  weight: string;
  reps: string;
  sets: string;
  loadMode: LoadMode;
}

/**
 * Quick entry of what you currently lift, saved as one manually entered workout so the
 * overload engine has a real starting point. Nothing is invented: only what you type is stored.
 */
export function StartingWeights() {
  const data = useAppData();
  const profile = useProfile();
  const { toast } = useFeedback();
  const [date, setDate] = useState(addDays(data.today, -1));
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: { ex: Exercise; p: Prescription }[] = [];
    for (const t of data.templates)
      for (const te of t.exercises) {
        const ex = data.exerciseMap.get(te.exerciseId);
        if (!ex || ex.deletedAt || seen.has(ex.id) || ex.progressionType !== 'double_progression') continue;
        seen.add(ex.id);
        out.push({ ex, p: te.prescription });
      }
    return out;
  }, [data.templates, data.exerciseMap]);

  const [rows, setRows] = useState<Record<string, Row>>({});
  const row = (ex: Exercise, p: Prescription): Row => rows[ex.id] ?? { weight: '', reps: String(p.repsMin ?? p.repsMax ?? ''), sets: String(p.sets), loadMode: ex.defaultLoadMode };
  const set = (ex: Exercise, p: Prescription, patch: Partial<Row>) => setRows({ ...rows, [ex.id]: { ...row(ex, p), ...patch } });

  const filled = items.filter(({ ex }) => rows[ex.id]?.weight.trim());

  const save = async () => {
    if (!isValidISODate(date) || date > data.today) return toast('Choose a valid date (today or earlier).', 'error');
    const exercises: SessionExercise[] = [];
    for (const { ex, p } of filled) {
      const r = row(ex, p);
      const w = Number(r.weight);
      const reps = Number(r.reps);
      const sets = Number(r.sets);
      if (!Number.isFinite(w) || w < 0) return toast(`Check the weight for ${ex.name}.`, 'error');
      if (!Number.isInteger(reps) || reps < 1 || reps > 100) return toast(`Check the reps for ${ex.name}.`, 'error');
      if (!Number.isInteger(sets) || sets < 1 || sets > 10) return toast(`Check the sets for ${ex.name}.`, 'error');
      const kg = displayToKg(w, profile.units);
      exercises.push({
        id: newId(),
        exerciseId: ex.id,
        prescription: { ...p },
        loadMode: r.loadMode,
        sets: Array.from({ length: sets }, () => ({ id: newId(), weightKg: kg, reps, completed: true, rir: null, technique: null })),
        notes: 'Entered as a starting weight'
      });
    }
    if (!exercises.length) return toast('Enter at least one weight.', 'error');
    setSaving(true);
    try {
      const now = nowISO();
      const startedAt = new Date(`${date}T12:00:00`).toISOString();
      const session: WorkoutSession = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        templateId: null,
        name: 'Starting weights',
        focus: 'custom',
        date,
        startedAt,
        endedAt: startedAt,
        durationMin: null,
        status: 'completed',
        source: 'manual',
        exercises,
        notes: 'Current working weights entered manually.',
        revision: 0
      };
      await repo.saveSession(session);
      toast(`Saved ${exercises.length} starting weight${exercises.length === 1 ? '' : 's'}`);
      navigate('/', { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Current weights" back="/profile" />
      <p className="text-sm text-muted-foreground">
        Enter the weight and reps you most recently managed for each lift. Leave anything blank you’re unsure about — AthleteOS will help you find a starting weight in your first session instead. This is saved as one manually entered workout, which you can edit or delete in History.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">For a full past session with different reps per set, use History → Log past.</p>
      <Field label="When did you last lift these?" htmlFor="sw-date" className="mt-4">
        <Input id="sw-date" type="date" max={data.today} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="mt-4 flex flex-col gap-2.5">
        {items.map(({ ex, p }) => {
          const r = row(ex, p);
          const dumbbell = ex.equipment.includes('dumbbell') || ex.equipment.includes('kettlebell');
          return (
            <Card key={ex.id} className="p-3">
              <p className="font-semibold">{ex.name}</p>
              <p className="text-xs text-muted-foreground">Programme target {prescriptionText(p)}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Field label={`Weight (${profile.units})`} htmlFor={`w-${ex.id}`}>
                  <Input id={`w-${ex.id}`} type="number" inputMode="decimal" value={r.weight} placeholder="—" onChange={(e) => set(ex, p, { weight: e.target.value })} />
                </Field>
                <Field label="Reps" htmlFor={`r-${ex.id}`}>
                  <Input id={`r-${ex.id}`} type="number" inputMode="numeric" value={r.reps} onChange={(e) => set(ex, p, { reps: e.target.value })} />
                </Field>
                <Field label="Sets" htmlFor={`s-${ex.id}`}>
                  <Input id={`s-${ex.id}`} type="number" inputMode="numeric" value={r.sets} onChange={(e) => set(ex, p, { sets: e.target.value })} />
                </Field>
              </div>
              {dumbbell && (
                <div className="mt-2">
                  <Choice<LoadMode>
                    size="sm"
                    allowClear={false}
                    label={`${ex.name} weight is`}
                    value={r.loadMode}
                    onChange={(v) => v && set(ex, p, { loadMode: v })}
                    options={[
                      { value: 'per_dumbbell', label: 'Per dumbbell' },
                      { value: 'total', label: 'Total' }
                    ]}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-4 rounded-2xl bg-background/80 py-2 backdrop-blur">
        <Button size="lg" className="w-full" disabled={saving || filled.length === 0} onClick={save}>
          <Save /> Save {filled.length || ''} weight{filled.length === 1 ? '' : 's'}
        </Button>
      </div>
      <Button variant="ghost" className="mt-1 w-full" onClick={() => navigate('/')}>
        Skip for now
      </Button>
    </div>
  );
}
