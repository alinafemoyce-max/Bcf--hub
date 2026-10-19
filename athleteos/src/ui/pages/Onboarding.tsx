import { useState } from 'react';
import { ArrowRight, Check, Zap } from 'lucide-react';
import { repo } from '@/data';
import { defaultProfile } from '@/data/repository';
import type { Equipment, Experience, Units, Weekday } from '@/domain/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Choice, Field } from '../components/common';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { displayToKg, formatNumber, kgToDisplay } from '@/lib/units';
import { WEEKDAY_SHORT, todayISO, startOfWeek } from '@/lib/dates';
import { newId, nowISO } from '@/lib/id';
import { cn } from '@/lib/utils';

export const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'barbell', label: 'Barbell & plates' },
  { value: 'cable', label: 'Cable machine' },
  { value: 'machine', label: 'Resistance machines' },
  { value: 'kettlebell', label: 'Kettlebells' },
  { value: 'bench', label: 'Bench' },
  { value: 'bike', label: 'Stationary bike' },
  { value: 'box', label: 'Plyo box / step' },
  { value: 'band', label: 'Resistance bands' },
  { value: 'field', label: 'Field / track' },
  { value: 'cones', label: 'Cones' },
  { value: 'bodyweight', label: 'Bodyweight only' }
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string }[] = [
  { value: 'beginner', label: 'New to lifting', hint: 'Less than 6 months of structured training.' },
  { value: 'returning', label: 'Returning', hint: 'Trained before, coming back after a break.' },
  { value: 'intermediate', label: 'Intermediate', hint: '1–3 years of consistent training.' },
  { value: 'advanced', label: 'Advanced', hint: '3+ years, comfortable with heavy compound lifts.' }
];

const STEPS = 6;

export function Onboarding() {
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<Units>('kg');
  const [weight, setWeight] = useState('');
  const [experience, setExperience] = useState<Experience>('returning');
  const [positions, setPositions] = useState('Wide receiver / defensive back');
  const [equipment, setEquipment] = useState<Equipment[]>(defaultProfile().equipment);
  const [injuries, setInjuries] = useState('');
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [inc, setInc] = useState(defaultProfile().increments);
  const [saving, setSaving] = useState(false);

  const weightNum = weight.trim() === '' ? null : Number(weight);
  const weightKg = weightNum != null && Number.isFinite(weightNum) ? displayToKg(weightNum, units) : null;
  const weightError = weightKg != null && (weightKg < 30 || weightKg > 250) ? 'That doesn’t look right — check the number and units.' : null;

  async function finish(next: string) {
    setSaving(true);
    try {
      const now = nowISO();
      await repo.saveProfile({
        ...defaultProfile(now),
        units,
        bodyWeightKg: weightKg,
        experience,
        positions: positions.trim(),
        equipment,
        injuries: injuries.trim(),
        trainingDays: [...days].sort(),
        increments: inc,
        programmeStartDate: startOfWeek(todayISO()),
        onboardedAt: now
      });
      if (weightKg) await repo.saveBody({ id: newId(), createdAt: now, updatedAt: now, date: todayISO(), weightKg, notes: 'Starting weight' });
      navigate(next, { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
      setSaving(false);
    }
  }

  const incField = (key: keyof typeof inc, label: string, hint: string) => (
    <Field label={label} hint={hint} htmlFor={`inc-${key}`}>
      <div className="relative">
        <Input
          id={`inc-${key}`}
          type="number"
          inputMode="decimal"
          step="any"
          value={formatNumber(kgToDisplay(inc[key], units), 2)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) setInc({ ...inc, [key]: displayToKg(v, units) });
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{units}</span>
      </div>
    </Field>
  );

  const canNext = step !== 1 || !weightError;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      {step > 0 && <Progress value={(step / (STEPS - 1)) * 100} className="mb-6 h-1.5" aria-label={`Step ${step} of ${STEPS - 1}`} />}
      <div className="flex-1">
        {step === 0 && (
          <div className="flex flex-col gap-5 pt-10">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary shadow-[0_0_40px_-6px_hsl(var(--primary))]">
              <Zap className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-black tracking-tight">
              Athlete<span className="text-accent">OS</span>
            </h1>
            <p className="text-lg text-muted-foreground">Your football training log and progressive overload coach. Track every set, see real progress, and know exactly when to add weight.</p>
            <ul className="flex flex-col gap-2 text-sm">
              {['Mon–Fri programme for WR / DB, preloaded and fully editable', 'Every recommendation explains why', 'Works offline. Your data stays on this device.'].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
              AthleteOS gives training guidance, not medical advice. If you have pain or an injury, speak to a qualified professional.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold">Body weight & units</h2>
            <Field label="Preferred units">
              <Choice label="Units" allowClear={false} value={units} onChange={(v) => v && setUnits(v)} options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} />
            </Field>
            <Field label={`Body weight (${units})`} htmlFor="bw" hint="Optional — you can log it later in Profile." error={weightError}>
              <Input id="bw" type="number" inputMode="decimal" placeholder={units === 'kg' ? 'e.g. 70' : 'e.g. 154'} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Training experience</h2>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Training experience">
              {EXPERIENCE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  role="radio"
                  aria-checked={experience === o.value}
                  onClick={() => setExperience(o.value)}
                  className={cn('rounded-2xl border p-4 text-left transition-colors', experience === o.value ? 'border-primary bg-primary/15' : 'hover:bg-secondary')}
                >
                  <div className="font-semibold">{o.label}</div>
                  <div className="text-sm text-muted-foreground">{o.hint}</div>
                </button>
              ))}
            </div>
            <Field label="Position(s)" htmlFor="pos">
              <Input id="pos" value={positions} onChange={(e) => setPositions(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Available equipment</h2>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((o) => {
                const on = equipment.includes(o.value);
                return (
                  <button
                    key={o.value}
                    aria-pressed={on}
                    onClick={() => setEquipment(on ? equipment.filter((e) => e !== o.value) : [...equipment, o.value])}
                    className={cn('h-11 rounded-full border px-4 text-sm font-semibold', on ? 'border-primary bg-primary/20' : 'text-muted-foreground')}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">Weight increments — the smallest jumps your gym allows. Used when recommending increases.</p>
            {incField('dumbbellKg', 'Dumbbell step (per dumbbell)', 'e.g. 12 kg → 14 kg is a 2 kg step.')}
            {incField('upperKg', 'Upper-body machines / cables / barbell', 'Typical: 1–2.5 kg.')}
            {incField('lowerKg', 'Lower-body machines / barbell', 'Typical: 2.5–5 kg.')}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Injuries or limitations</h2>
            <p className="text-sm text-muted-foreground">Anything to keep in mind — old injuries, tight areas, movements that bother you. This is shown on your dashboard and during workouts as a reminder.</p>
            <Textarea rows={5} placeholder="e.g. Left ankle sprain last season — fine now but a bit stiff." value={injuries} onChange={(e) => setInjuries(e.target.value)} aria-label="Injuries or limitations" />
            <p className="text-xs text-muted-foreground">AthleteOS does not assess injuries. If something hurts, get it checked by a physio or doctor.</p>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Training days</h2>
            <p className="text-sm text-muted-foreground">Your programme is preloaded for Monday to Friday, with weekends for recovery. Choose the days you normally train.</p>
            <div className="grid grid-cols-7 gap-1.5">
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    aria-pressed={on}
                    onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    className={cn('h-14 rounded-xl border text-sm font-bold', on ? 'border-primary bg-primary/20' : 'text-muted-foreground')}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border bg-card p-4 text-sm">
              <p className="font-semibold">Your week</p>
              <ul className="mt-2 grid gap-1 text-muted-foreground">
                <li>Mon — Full Body</li>
                <li>Tue — Mobility</li>
                <li>Wed — Upper Body</li>
                <li>Thu — Lower Body & power</li>
                <li>Fri — Speed & Agility</li>
                <li>Sat/Sun — Rest or light recovery</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Every workout and exercise can be edited, reordered or replaced from the Train tab.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {step < STEPS - 1 ? (
          <>
            <Button size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {step === 0 ? 'Get started' : 'Continue'} <ArrowRight />
            </Button>
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </>
        ) : (
          <>
            <Button size="lg" disabled={saving} onClick={() => finish('/profile/starting-weights')}>
              Enter my current weights <ArrowRight />
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => finish('/')}>
              Skip — go to dashboard
            </Button>
            <p className="text-center text-xs text-muted-foreground">Entering what you currently lift lets AthleteOS suggest weights from your very first session.</p>
          </>
        )}
      </div>
    </div>
  );
}
