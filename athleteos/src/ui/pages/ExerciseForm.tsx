import { useEffect, useState } from 'react';
import { repo } from '@/data';
import type { BodyRegion, Equipment, Exercise, LoadMode, MuscleGroup, ProgressionType } from '@/domain/types';
import { validateExercise } from '@/domain/validation';
import { MUSCLE_LABELS } from '@/domain/analytics';
import { demoSearchUrl } from '@/data/seed';
import { useAppData, useProfile } from '../hooks/useAppData';
import { EmptyState, Field, PageHeader } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { NativeSelect } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { errorMessage, useFeedback } from '../components/feedback';
import { EQUIPMENT_LABELS, LOAD_MODE_LABELS, PROGRESSION_LABELS } from '../components/labels';
import { navigate } from '../router';
import { newId, nowISO } from '@/lib/id';
import { displayToKg, formatNumber, kgToDisplay } from '@/lib/units';
import { cn } from '@/lib/utils';

function MultiChips<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map(([k, l]) => {
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            className={cn('h-9 rounded-full border px-3 text-xs font-semibold', on ? 'border-primary bg-primary/20' : 'text-muted-foreground')}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function ExerciseForm({ id }: { id: string | null }) {
  const data = useAppData();
  const profile = useProfile();
  const { toast } = useFeedback();
  const existing = id ? data.exerciseMap.get(id) : undefined;
  const [draft, setDraft] = useState<Exercise | null>(null);
  const [instructions, setInstructions] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [increment, setIncrement] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (draft) return;
    if (existing) {
      setDraft(structuredClone(existing));
      setInstructions(existing.instructions.join('\n'));
      setMistakes(existing.commonMistakes.join('\n'));
      setIncrement(existing.incrementKg ? formatNumber(kgToDisplay(existing.incrementKg, profile.units), 2) : '');
    } else if (!id) {
      const now = nowISO();
      setDraft({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: '',
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: ['dumbbell'],
        instructions: [],
        commonMistakes: [],
        restSeconds: 90,
        progressionType: 'double_progression',
        bodyRegion: 'upper',
        defaultLoadMode: 'total',
        demoUrl: '',
        incrementKg: null,
        e1rmSuitable: false,
        unilateral: false,
        isCustom: true
      });
    }
  }, [existing, id, draft, profile.units]);

  if (!draft) {
    return (
      <div>
        <PageHeader title="Exercise" back="/library" />
        <EmptyState title="Exercise not found" />
      </div>
    );
  }
  const update = (patch: Partial<Exercise>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    const inc = increment.trim() === '' ? null : displayToKg(Number(increment), profile.units);
    const next: Exercise = {
      ...draft,
      name: draft.name.trim(),
      instructions: lines(instructions),
      commonMistakes: lines(mistakes),
      incrementKg: inc,
      demoUrl: draft.demoUrl?.trim() || (draft.name.trim() ? demoSearchUrl(draft.name.trim()) : '')
    };
    const issues = validateExercise(next);
    if (data.exercises.some((e) => e.id !== next.id && e.name.toLowerCase() === next.name.toLowerCase())) issues.push('An exercise with that name already exists.');
    setErrors(issues);
    if (issues.length) return;
    try {
      await repo.saveExercise(next);
      toast(id ? 'Exercise updated' : 'Exercise created');
      navigate(`/library/${next.id}`, { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <PageHeader title={id ? 'Edit exercise' : 'New exercise'} back={id ? `/library/${id}` : '/library'} />
      {existing && !existing.isCustom && <p className="mb-3 rounded-xl border bg-card p-3 text-xs text-muted-foreground">This is a built-in exercise. Your changes apply to future recommendations; past workouts aren’t affected.</p>}
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="ex-name">
          <Input id="ex-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Trap bar deadlift" />
        </Field>
        <Field label="Progression type" htmlFor="ex-type" hint="Decides how AthleteOS recommends progress.">
          <NativeSelect id="ex-type" value={draft.progressionType} onChange={(e) => update({ progressionType: e.target.value as ProgressionType })}>
            {Object.entries(PROGRESSION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Body region" htmlFor="ex-region">
            <NativeSelect id="ex-region" value={draft.bodyRegion} onChange={(e) => update({ bodyRegion: e.target.value as BodyRegion })}>
              <option value="upper">Upper body</option>
              <option value="lower">Lower body</option>
              <option value="core">Core</option>
              <option value="full">Full body</option>
            </NativeSelect>
          </Field>
          <Field label="Weight logged as" htmlFor="ex-load">
            <NativeSelect id="ex-load" value={draft.defaultLoadMode} onChange={(e) => update({ defaultLoadMode: e.target.value as LoadMode })}>
              {Object.entries(LOAD_MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Rest (seconds)" htmlFor="ex-rest">
            <Input id="ex-rest" type="number" inputMode="numeric" value={draft.restSeconds} onChange={(e) => update({ restSeconds: Number(e.target.value) })} />
          </Field>
          <Field label={`Increase step (${profile.units})`} htmlFor="ex-inc" hint="Blank = use profile default">
            <Input id="ex-inc" type="number" inputMode="decimal" value={increment} onChange={(e) => setIncrement(e.target.value)} placeholder="default" />
          </Field>
        </div>
        <Field label="Primary muscles">
          <MultiChips label="Primary muscles" options={Object.entries(MUSCLE_LABELS) as [MuscleGroup, string][]} value={draft.primaryMuscles} onChange={(v) => update({ primaryMuscles: v })} />
        </Field>
        <Field label="Secondary muscles">
          <MultiChips label="Secondary muscles" options={Object.entries(MUSCLE_LABELS) as [MuscleGroup, string][]} value={draft.secondaryMuscles} onChange={(v) => update({ secondaryMuscles: v })} />
        </Field>
        <Field label="Equipment">
          <MultiChips label="Equipment" options={Object.entries(EQUIPMENT_LABELS) as [Equipment, string][]} value={draft.equipment} onChange={(v) => update({ equipment: v })} />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="text-sm">Unilateral (one side at a time)</span>
          <Switch checked={draft.unilateral} onCheckedChange={(v) => update({ unilateral: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="text-sm">
            Show estimated 1RM
            <span className="block text-xs text-muted-foreground">For compound lifts in low–moderate rep ranges.</span>
          </span>
          <Switch checked={draft.e1rmSuitable} onCheckedChange={(v) => update({ e1rmSuitable: v })} />
        </label>
        <Field label="Technique instructions (one per line)" htmlFor="ex-instr">
          <Textarea id="ex-instr" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <Field label="Common mistakes (one per line)" htmlFor="ex-mist">
          <Textarea id="ex-mist" rows={3} value={mistakes} onChange={(e) => setMistakes(e.target.value)} />
        </Field>
        <Field label="Demonstration link" htmlFor="ex-url" hint="Leave blank to use a video search link.">
          <Input id="ex-url" type="url" inputMode="url" value={draft.demoUrl ?? ''} onChange={(e) => update({ demoUrl: e.target.value })} placeholder="https://" />
        </Field>
        {errors.length > 0 && (
          <ul className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <Button size="lg" onClick={save}>
          {id ? 'Save changes' : 'Create exercise'}
        </Button>
      </div>
    </div>
  );
}
