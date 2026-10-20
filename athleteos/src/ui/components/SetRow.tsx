import { Check } from 'lucide-react';
import type { Exercise, SetLog, TechniqueQuality, Units } from '@/domain/types';
import { Choice, Stepper } from './common';
import { displayToKg, kgToDisplay, roundForDisplay } from '@/lib/units';
import { cn } from '@/lib/utils';

const TECHNIQUE: { value: TechniqueQuality; label: string; tone: 'good' | 'ok' | 'bad' }[] = [
  { value: 'good', label: 'Good', tone: 'good' },
  { value: 'ok', label: 'OK', tone: 'ok' },
  { value: 'poor', label: 'Poor', tone: 'bad' }
];
const RIR = [0, 1, 2, 3, 4].map((v) => ({ value: v, label: v === 4 ? '4+' : String(v) }));
const RATING = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

export interface SetRowProps {
  index: number;
  set: SetLog;
  exercise: Exercise;
  units: Units;
  /** Weight step in kg. */
  weightStepKg: number;
  target: { reps?: number | null; durationSec?: number | null };
  onChange: (patch: Partial<SetLog>) => void;
  onToggle: () => void;
  disabled?: boolean;
}

/** One set: big inputs on the first line, quick-tap quality ratings on the second. */
export function SetRow({ index, set, exercise, units, weightStepKg, target, onChange, onToggle, disabled }: SetRowProps) {
  const t = exercise.progressionType;
  const label = `Set ${index + 1}`;
  const weightDisplay = set.weightKg == null ? null : roundForDisplay(kgToDisplay(set.weightKg, units), units);
  const stepDisplay = Math.max(units === 'kg' ? 0.25 : 0.5, roundForDisplay(kgToDisplay(weightStepKg, units), units));

  let inputs: React.ReactNode;
  let quality: React.ReactNode = null;
  switch (t) {
    case 'double_progression':
      inputs = (
        <>
          <Stepper compact label={`${label} weight (${units})`} value={weightDisplay} step={stepDisplay} max={units === 'kg' ? 500 : 1100} placeholder={units} onChange={(v) => onChange({ weightKg: v == null ? null : displayToKg(v, units) })} />
          <Stepper compact label={`${label} reps`} value={set.reps} step={1} max={200} decimals={0} inputMode="numeric" placeholder={target.reps ? String(target.reps) : 'reps'} onChange={(v) => onChange({ reps: v })} />
        </>
      );
      quality = (
        <>
          <QualityRow label="RIR" hint="Reps in reserve">
            <Choice size="sm" label={`${label} reps in reserve`} value={set.rir ?? null} options={RIR} onChange={(v) => onChange({ rir: v })} />
          </QualityRow>
          <QualityRow label="Form">
            <Choice size="sm" label={`${label} technique`} value={set.technique ?? null} options={TECHNIQUE} onChange={(v) => onChange({ technique: v })} />
          </QualityRow>
        </>
      );
      break;
    case 'bodyweight_reps':
      inputs = (
        <Stepper compact className="col-span-2" label={`${label} reps`} value={set.reps} step={1} max={200} decimals={0} inputMode="numeric" placeholder={target.reps ? String(target.reps) : 'reps'} onChange={(v) => onChange({ reps: v })} />
      );
      quality = (
        <>
          <QualityRow label="RIR">
            <Choice size="sm" label={`${label} reps in reserve`} value={set.rir ?? null} options={RIR} onChange={(v) => onChange({ rir: v })} />
          </QualityRow>
          <QualityRow label="Control">
            <Choice size="sm" label={`${label} control`} value={set.technique ?? null} options={TECHNIQUE} onChange={(v) => onChange({ technique: v })} />
          </QualityRow>
        </>
      );
      break;
    case 'timed_hold':
      inputs = (
        <Stepper compact className="col-span-2" label={`${label} seconds`} value={set.durationSec} step={5} max={600} decimals={0} inputMode="numeric" placeholder="sec" onChange={(v) => onChange({ durationSec: v })} />
      );
      quality = (
        <QualityRow label="Position">
          <Choice size="sm" label={`${label} position quality`} value={set.technique ?? null} options={TECHNIQUE} onChange={(v) => onChange({ technique: v })} />
        </QualityRow>
      );
      break;
    case 'mobility':
      inputs =
        set.durationSec != null || (!set.reps && target.durationSec) ? (
          <Stepper compact className="col-span-2" label={`${label} seconds`} value={set.durationSec} step={5} max={600} decimals={0} inputMode="numeric" placeholder="sec" onChange={(v) => onChange({ durationSec: v })} />
        ) : (
          <Stepper compact className="col-span-2" label={`${label} reps`} value={set.reps} step={1} max={100} decimals={0} inputMode="numeric" placeholder="reps" onChange={(v) => onChange({ reps: v })} />
        );
      quality = (
        <>
          <QualityRow label="Range" hint="1 limited – 5 full & easy">
            <Choice size="sm" label={`${label} comfortable range of motion`} value={set.rom ?? null} options={RATING} onChange={(v) => onChange({ rom: v })} />
          </QualityRow>
          <QualityRow label="Control">
            <Choice size="sm" label={`${label} control`} value={set.control ?? null} options={RATING} onChange={(v) => onChange({ control: v })} />
          </QualityRow>
        </>
      );
      break;
    case 'sprint':
    case 'agility':
      inputs = (
        <>
          <Stepper compact label={`${label} time (seconds)`} value={set.timeSec} step={0.01} max={120} decimals={2} placeholder="time s" onChange={(v) => onChange({ timeSec: v })} />
          <Stepper compact label={`${label} distance (m)`} value={set.distanceM} step={5} max={400} decimals={1} placeholder="m" onChange={(v) => onChange({ distanceM: v })} />
        </>
      );
      quality =
        set.restSec != null ? (
          <p className="col-span-full text-xs text-muted-foreground">Rest before this rep: {Math.round(set.restSec)} s</p>
        ) : null;
      break;
    case 'jump':
      inputs = (
        <>
          <Stepper compact label={`${label} best distance (m)`} value={set.distanceM} step={0.05} max={5} decimals={2} placeholder="best m" onChange={(v) => onChange({ distanceM: v })} />
          <Stepper compact label={`${label} reps`} value={set.reps} step={1} max={20} decimals={0} inputMode="numeric" placeholder="reps" onChange={(v) => onChange({ reps: v })} />
        </>
      );
      quality = (
        <QualityRow label="Landing">
          <Choice size="sm" label={`${label} landing quality`} value={set.technique ?? null} options={TECHNIQUE} onChange={(v) => onChange({ technique: v })} />
        </QualityRow>
      );
      break;
    default:
      inputs = (
        <Stepper
          compact
          className="col-span-2"
          label={`${label} minutes`}
          value={set.durationSec == null ? null : Math.round((set.durationSec / 60) * 10) / 10}
          step={1}
          max={180}
          decimals={1}
          placeholder="min"
          onChange={(v) => onChange({ durationSec: v == null ? null : Math.round(v * 60) })}
        />
      );
  }

  return (
    <div className={cn('rounded-xl border p-2 transition-colors', set.completed ? 'border-success/40 bg-success/[0.07]' : 'bg-background/40')}>
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground tabular" aria-hidden>
          {index + 1}
        </span>
        <div className={cn('grid min-w-0 flex-1 gap-1.5', t === 'double_progression' ? 'grid-cols-[3fr_2fr]' : 'grid-cols-2')}>{inputs}</div>
        <button
          type="button"
          role="checkbox"
          aria-checked={set.completed}
          aria-label={`${label} completed`}
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition-colors',
            set.completed ? 'border-success bg-success text-background' : 'border-input text-muted-foreground hover:border-primary'
          )}
        >
          <Check className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>
      {quality && <div className="mt-2 grid gap-1.5 pl-7">{quality}</div>}
    </div>
  );
}

function QualityRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" title={hint}>
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
