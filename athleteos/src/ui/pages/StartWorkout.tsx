import { useEffect, useMemo, useState } from 'react';
import { Moon, Play, ShieldAlert } from 'lucide-react';
import { repo } from '@/data';
import type { PainLevel, RecoveryCheck } from '@/domain/types';
import { assessReadiness } from '@/domain/readiness';
import { createSession } from '@/domain/session';
import { useAppData, useProfile } from '../hooks/useAppData';
import { activeSession, todaysCheck } from '../hooks/derived';
import { Choice, EmptyState, Field, PageHeader, Stepper } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { ReadinessBadge } from '../components/ReadinessBadge';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { newId, nowISO } from '@/lib/id';
import { cn } from '@/lib/utils';

const scale = (low: string, high: string) =>
  [1, 2, 3, 4, 5].map((v) => ({ value: v, label: v === 1 ? `1 ${low}` : v === 5 ? `5 ${high}` : String(v) }));

export function StartWorkout({ templateId }: { templateId: string }) {
  const data = useAppData();
  const profile = useProfile();
  const { toast } = useFeedback();
  const template = templateId === 'blank' ? null : data.templates.find((t) => t.id === templateId);
  const live = activeSession(data);
  const existing = todaysCheck(data);

  const [sleep, setSleep] = useState<number | null>(existing?.sleepHours ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [soreness, setSoreness] = useState<number | null>(existing?.soreness ?? null);
  const [motivation, setMotivation] = useState<number | null>(existing?.motivation ?? null);
  const [pain, setPain] = useState<PainLevel>(existing?.pain ?? 'none');
  const [painNotes, setPainNotes] = useState(existing?.painNotes ?? '');
  const [illness, setIllness] = useState(existing?.illness ?? false);
  const [overridden, setOverridden] = useState(existing?.overridden ?? false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (live) navigate('/train/live', { replace: true });
  }, [live]);

  const assessment = useMemo(
    () => assessReadiness({ sleepHours: sleep, energy, soreness, motivation, pain, painNotes, illness, overridden }),
    [sleep, energy, soreness, motivation, pain, painNotes, illness, overridden]
  );

  if (templateId !== 'blank' && !template) {
    return (
      <div>
        <PageHeader title="Start workout" back="/train" />
        <EmptyState title="Workout not found" />
      </div>
    );
  }

  async function start(withCheck: boolean) {
    setBusy(true);
    try {
      const now = nowISO();
      let check: RecoveryCheck | null = null;
      if (withCheck) {
        check = {
          id: existing?.id ?? newId(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          date: data.today,
          sleepHours: sleep,
          energy,
          soreness,
          motivation,
          pain,
          painNotes: painNotes.trim(),
          illness,
          overridden
        };
      }
      const readiness = withCheck ? assessment : null;
      const session = createSession({
        template: template ?? null,
        name: template ? undefined : 'Workout',
        date: data.today,
        now,
        exercises: data.exerciseMap,
        sessions: data.sessions,
        profile,
        readiness,
        recoveryCheckId: check?.id ?? null
      });
      if (check) await repo.saveRecovery({ ...check, sessionId: session.id });
      await repo.saveSession(session);
      navigate('/train/live', { replace: true });
    } catch (e) {
      toast(errorMessage(e), 'error');
      setBusy(false);
    }
  }

  const caution = assessment.level === 'amber' || assessment.level === 'red';

  return (
    <div>
      <PageHeader title="Check-in" subtitle={template ? `Before ${template.name}` : 'Before your workout'} back="/train" />
      <p className="mb-4 text-sm text-muted-foreground">Takes 10 seconds. Your answers tailor today’s recommendations. Leave anything blank you’d rather not answer.</p>

      <div className="flex flex-col gap-5">
        <Field label="Sleep last night (hours)">
          <Stepper label="Sleep hours" value={sleep} onChange={setSleep} step={0.5} min={0} max={16} placeholder="—" decimals={1} />
        </Field>
        <Field label="Energy">
          <Choice label="Energy" value={energy} onChange={setEnergy} options={scale('low', 'high')} />
        </Field>
        <Field label="Muscle soreness">
          <Choice label="Muscle soreness" value={soreness} onChange={setSoreness} options={scale('none', 'very')} />
        </Field>
        <Field label="Motivation">
          <Choice label="Motivation" value={motivation} onChange={setMotivation} options={scale('low', 'high')} />
        </Field>
        <Field label="Any pain or injury concerns?">
          <Choice
            label="Pain"
            allowClear={false}
            value={pain}
            onChange={(v) => v && setPain(v)}
            options={[
              { value: 'none', label: 'None', tone: 'good' },
              { value: 'mild', label: 'Mild', tone: 'ok' },
              { value: 'moderate', label: 'Moderate', tone: 'ok' },
              { value: 'sharp', label: 'Sharp', tone: 'bad' }
            ]}
          />
        </Field>
        {pain !== 'none' && (
          <Field label="Where / what?" htmlFor="pain-notes">
            <Input id="pain-notes" value={painNotes} onChange={(e) => setPainNotes(e.target.value)} placeholder="e.g. right knee on squats" />
          </Field>
        )}
        <label className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <span>
            <span className="block font-medium">Feeling ill?</span>
            <span className="text-xs text-muted-foreground">Fever, flu, stomach bug, etc.</span>
          </span>
          <Switch checked={illness} onCheckedChange={setIllness} aria-label="Feeling ill" />
        </label>
      </div>

      <div
        className={cn(
          'mt-5 rounded-2xl border p-4',
          assessment.level === 'red' ? 'border-danger/50 bg-danger/10' : assessment.level === 'amber' ? 'border-warning/50 bg-warning/10' : 'bg-card'
        )}
        aria-live="polite"
      >
        <ReadinessBadge level={assessment.level} />
        <p className="mt-1 font-semibold">{assessment.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{assessment.message}</p>
        {assessment.reasons.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {assessment.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {assessment.suggestions.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {assessment.suggestions.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        )}
        {caution && (
          <label className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-sm">
              {assessment.level === 'red' ? 'I understand — I’ll train lightly and avoid anything painful' : 'Override — train as normal today'}
            </span>
            <Switch checked={overridden} onCheckedChange={setOverridden} aria-label="Override recommendation" />
          </label>
        )}
        {assessment.level === 'red' && (
          <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Even with an override, AthleteOS won’t recommend increasing loads today.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {assessment.level === 'red' && !overridden ? (
          <Button size="lg" variant="secondary" onClick={() => navigate('/')}>
            <Moon /> Rest today
          </Button>
        ) : (
          <Button size="lg" disabled={busy} onClick={() => start(true)}>
            <Play className="fill-current" /> Start workout
          </Button>
        )}
        {!(assessment.level === 'red' && !overridden) && (
          <Button variant="ghost" disabled={busy} onClick={() => start(false)}>
            Skip check-in and start
          </Button>
        )}
      </div>
    </div>
  );
}
