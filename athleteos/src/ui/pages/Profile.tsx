import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, Database, Download, FileSpreadsheet, HardDrive, Info, Scale, Smartphone, Trash2, Upload, X, Dumbbell } from 'lucide-react';
import { db, repo } from '@/data';
import type { Equipment, Experience, IncrementSettings, UserProfile, Weekday } from '@/domain/types';
import { exportBackup, importBackup, parseBackup, sessionsToCSV, type BackupFile } from '@/data/backup';
import { useAppData, useProfile } from '../hooks/useAppData';
import { Choice, Field, PageHeader, SectionTitle } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { NativeSelect } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { errorMessage, useFeedback } from '../components/feedback';
import { EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS } from './Onboarding';
import { navigate } from '../router';
import { saveTextFile, readFileText } from '@/lib/files';
import { displayToKg, formatNumber, formatWeight, kgToDisplay } from '@/lib/units';
import { formatDate, startOfWeek, todayISO, trainingWeek, WEEKDAY_SHORT, isValidISODate } from '@/lib/dates';
import { newId, nowISO } from '@/lib/id';
import { cn } from '@/lib/utils';

export function ProfilePage() {
  const data = useAppData();
  const profile = useProfile();
  const { toast, confirm } = useFeedback();
  const units = profile.units;

  const save = async (patch: Partial<UserProfile>) => {
    try {
      await repo.saveProfile({ ...profile, ...patch });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Profile" subtitle={[profile.positions, EXPERIENCE_OPTIONS.find((e) => e.value === profile.experience)?.label].filter(Boolean).join(' · ')} />

      <BodyWeightCard />

      <SectionTitle>Training</SectionTitle>
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <Field label="Units">
            <Choice label="Units" allowClear={false} value={units} onChange={(v) => v && save({ units: v })} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
          </Field>
          <Field label="Training days">
            <div className="grid grid-cols-7 gap-1">
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => {
                const on = profile.trainingDays.includes(d);
                return (
                  <button
                    key={d}
                    aria-pressed={on}
                    onClick={() => save({ trainingDays: on ? profile.trainingDays.filter((x) => x !== d) : [...profile.trainingDays, d].sort() })}
                    className={cn('h-11 rounded-lg border text-xs font-bold', on ? 'border-primary bg-primary/20' : 'text-muted-foreground')}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Experience" htmlFor="pf-exp">
            <NativeSelect id="pf-exp" value={profile.experience} onChange={(e) => save({ experience: e.target.value as Experience })}>
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DebouncedText label="Position(s)" value={profile.positions ?? ''} onSave={(v) => save({ positions: v })} />
          <DebouncedText label="Injuries or limitations" multiline value={profile.injuries ?? ''} onSave={(v) => save({ injuries: v })} hint="Shown on your dashboard as a reminder." />
          <Field label={`Programme week`} hint={`Currently week ${trainingWeek(profile.programmeStartDate, data.today)} (started ${formatDate(profile.programmeStartDate, { year: true })}).`}>
            <Button
              variant="outline"
              onClick={async () => {
                if (await confirm({ title: 'Restart at week 1?', description: 'Only the week counter changes. Your history is kept.', confirmLabel: 'Restart' })) save({ programmeStartDate: startOfWeek(todayISO()) });
              }}
            >
              Restart week count
            </Button>
          </Field>
        </CardContent>
      </Card>

      <SectionTitle>Equipment & increments</SectionTitle>
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_OPTIONS.map((o) => {
              const on = profile.equipment.includes(o.value);
              return (
                <button
                  key={o.value}
                  aria-pressed={on}
                  onClick={() => save({ equipment: on ? profile.equipment.filter((e) => e !== o.value) : [...profile.equipment, o.value as Equipment] })}
                  className={cn('h-9 rounded-full border px-3 text-xs font-semibold', on ? 'border-primary bg-primary/20' : 'text-muted-foreground')}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <IncrementInputs increments={profile.increments} units={units} onSave={(inc) => save({ increments: inc })} />
          <p className="text-xs text-muted-foreground">Individual exercises can override these in the exercise library.</p>
        </CardContent>
      </Card>

      <SectionTitle>Training data</SectionTitle>
      <Card>
        <ul className="divide-y">
          <NavRow icon={<Dumbbell />} label="Enter current / starting weights" onClick={() => navigate('/profile/starting-weights')} />
          <NavRow icon={<Database />} label="Log a past workout" onClick={() => navigate('/history/new')} />
          <NavRow icon={<Dumbbell />} label="Exercise library" onClick={() => navigate('/library')} />
        </ul>
      </Card>

      <BackupSection />

      <SectionTitle>Reminders</SectionTitle>
      <Card className="p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Bell className="h-4 w-4 text-accent" /> In-app reminders
        </p>
        <p className="mt-1 text-muted-foreground">
          Today’s workout, missed sessions, exercises ready to progress, recovery days and your weekly review appear on the Dashboard whenever you open AthleteOS. Scheduled push notifications on iPhone need a server, which this offline app deliberately doesn’t use — so reminders are shown in-app instead.
        </p>
      </Card>

      <SectionTitle>Install on iPhone</SectionTitle>
      <Card className="p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-4 w-4 text-accent" /> Add to Home Screen
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
          <li>Open AthleteOS in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose “Add to Home Screen”, then “Add”.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">It then opens full-screen like an app and works offline. Data stays on this device — export a backup regularly.</p>
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card className="p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Info className="h-4 w-4 text-accent" /> AthleteOS
        </p>
        <p className="mt-1">
          Recommendations come from transparent rules applied to the training you log. They’re guidance, not guarantees, and AthleteOS doesn’t diagnose injuries or measure biological readiness. If something hurts, stop and speak to a qualified professional.
        </p>
      </Card>
      <DangerZone />
    </div>
  );
}

function NavRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-secondary [&>svg:first-child]:h-4 [&>svg:first-child]:w-4 [&>svg:first-child]:text-accent">
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </li>
  );
}

function DebouncedText({ label, value, onSave, multiline, hint }: { label: string; value: string; onSave: (v: string) => void; multiline?: boolean; hint?: string }) {
  const [v, setV] = useState(value);
  const id = useRef(`dt-${label.replace(/\W+/g, '-').toLowerCase()}`).current;
  useEffect(() => setV(value), [value]);
  const commit = () => v.trim() !== value && onSave(v.trim());
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      {multiline ? <Textarea id={id} rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} /> : <Input id={id} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />}
    </Field>
  );
}

function IncrementInputs({ increments, units, onSave }: { increments: IncrementSettings; units: 'kg' | 'lb'; onSave: (i: IncrementSettings) => void }) {
  const fields: [keyof IncrementSettings, string][] = [
    ['dumbbellKg', 'Dumbbell step'],
    ['upperKg', 'Upper body'],
    ['lowerKg', 'Lower body']
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map(([k, l]) => (
        <Field key={k} label={`${l} (${units})`} htmlFor={`inc-${k}`}>
          <Input
            id={`inc-${k}`}
            type="number"
            inputMode="decimal"
            defaultValue={formatNumber(kgToDisplay(increments[k], units), 2)}
            key={`${k}-${units}-${increments[k]}`}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0 && n <= (units === 'kg' ? 50 : 110)) onSave({ ...increments, [k]: displayToKg(n, units) });
              else e.target.value = formatNumber(kgToDisplay(increments[k], units), 2);
            }}
          />
        </Field>
      ))}
    </div>
  );
}

function BodyWeightCard() {
  const data = useAppData();
  const profile = useProfile();
  const { toast } = useFeedback();
  const [value, setValue] = useState('');
  const [date, setDate] = useState(data.today);
  const units = profile.units;
  const latest = data.body[0];

  const add = async () => {
    const n = Number(value);
    if (!value.trim() || !Number.isFinite(n)) return toast('Enter your body weight.', 'error');
    if (!isValidISODate(date) || date > data.today) return toast('Choose a valid date (not in the future).', 'error');
    try {
      const now = nowISO();
      const kg = displayToKg(n, units);
      await repo.saveBody({ id: newId(), createdAt: now, updatedAt: now, date, weightKg: kg });
      if (date >= (latest?.date ?? '')) await repo.saveProfile({ ...profile, bodyWeightKg: kg });
      setValue('');
      toast('Body weight logged');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <SectionTitle>Body weight</SectionTitle>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-baseline gap-2">
            <Scale className="h-5 w-5 self-center text-accent" />
            <span className="text-3xl font-black tabular">{latest ? formatWeight(latest.weightKg, units) : '—'}</span>
            {latest && <span className="text-xs text-muted-foreground">on {formatDate(latest.date)}</span>}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Input type="number" inputMode="decimal" placeholder={`Weight (${units})`} value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Body weight in ${units}`} />
            <Button onClick={add}>Log</Button>
            <Input type="date" max={data.today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="col-span-2" />
          </div>
          {data.body.length > 0 && (
            <ul className="mt-3 divide-y rounded-xl border">
              {data.body.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{formatDate(b.date, { year: true })}</span>
                  <span className="flex items-center gap-2 font-semibold tabular">
                    {formatWeight(b.weightKg, units)}
                    <button aria-label={`Delete entry from ${formatDate(b.date)}`} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary" onClick={() => repo.deleteBody(b.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.body.length > 1 && (
            <a href="#/progress?tab=body" className="mt-2 inline-block text-xs font-semibold text-accent">
              See body-weight chart →
            </a>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function BackupSection() {
  const data = useAppData();
  const profile = useProfile();
  const { toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const lastBackup = useRef<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`))
      .catch(() => undefined);
    repo.getMeta<string>('lastBackupAt').then((v) => {
      lastBackup.current = v ?? null;
      setLastBackupAt(v ?? null);
    });
  }, []);

  const stamp = new Date().toISOString().slice(0, 10);

  const exportJSON = async () => {
    try {
      const file = await exportBackup(db);
      const r = await saveTextFile(`athleteos-backup-${stamp}.json`, JSON.stringify(file, null, 1), 'application/json');
      if (r !== 'cancelled') {
        const now = nowISO();
        await repo.setMeta('lastBackupAt', now);
        setLastBackupAt(now);
        toast('Backup exported');
      }
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const exportCSV = async () => {
    const csv = sessionsToCSV(data.sessions, data.exerciseMap, profile.units);
    const r = await saveTextFile(`athleteos-workouts-${stamp}.csv`, csv, 'text/csv');
    if (r !== 'cancelled') toast('Workout CSV exported');
  };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseBackup(await readFileText(f)));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    try {
      const r = await importBackup(db, pending, mode);
      await repo.init();
      setPending(null);
      toast(mode === 'replace' ? `Backup restored (${r.added} records)` : `Merged: ${r.added} added, ${r.updated} updated`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const counts = pending ? `${pending.data.sessions.length} workouts, ${pending.data.body.length} body-weight entries, ${pending.data.exercises.length} exercises` : '';

  return (
    <>
      <SectionTitle>Backup & export</SectionTitle>
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm text-muted-foreground">Your data lives only on this device. Export a backup regularly and keep it in iCloud Drive or Files.</p>
          <p className="text-xs text-muted-foreground">
            Last backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never'}
          </p>
          <Button onClick={exportJSON}>
            <Download /> Export backup (JSON)
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload /> Import backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => choose(e.target.files?.[0])} aria-label="Choose backup file" />
          <Button variant="secondary" onClick={exportCSV} disabled={!data.sessions.length}>
            <FileSpreadsheet /> Export workouts (CSV)
          </Button>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            {persisted ? 'Persistent storage granted' : persisted === false ? 'Storage may be cleared by the browser if space runs low — install to Home Screen and keep backups' : 'Storage status unknown'}
            {usage && ` · ${usage}`}
          </p>
        </CardContent>
      </Card>
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import backup</DialogTitle>
            <DialogDescription>
              From {pending ? new Date(pending.exportedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}: {counts}.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => doImport('merge')}>Merge with my data</Button>
          <p className="-mt-2 text-xs text-muted-foreground">Keeps the most recently edited copy of each record.</p>
          <Button variant="destructive" onClick={() => doImport('replace')}>
            Replace all my data
          </Button>
          <p className="-mt-2 text-xs text-muted-foreground">Erases everything on this device first.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DangerZone() {
  const { confirm, toast } = useFeedback();
  const erase = async () => {
    const ok = await confirm({
      title: 'Erase all data?',
      description: 'Every workout, body-weight entry, check-in and setting on this device will be permanently deleted. Export a backup first if you might want it.',
      confirmLabel: 'Erase everything',
      destructive: true
    });
    if (!ok) return;
    try {
      await repo.clearAll();
      await repo.init();
      window.location.hash = '#/';
      window.location.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <div className="mt-8">
      <Button variant="ghost" className="w-full text-danger" onClick={erase}>
        <Trash2 /> Erase all data
      </Button>
    </div>
  );
}
