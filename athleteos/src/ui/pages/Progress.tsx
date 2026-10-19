import { useMemo, useState } from 'react';
import { CalendarCheck, ChartLine, Trophy } from 'lucide-react';
import type { Exercise, ID, LoadMode } from '@/domain/types';
import { completedSessions, computePersonalRecords, consistencyPercent, exerciseSeries, headlinePRs, loggedLoadModes, plannedDaysPerWeek, recentWeeks } from '@/domain/analytics';
import { useAppData, useProfile } from '../hooks/useAppData';
import { recommendationFor } from '../hooks/derived';
import { Choice, EmptyState, PageHeader, StatTile } from '../components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { NativeSelect } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { ChartCard, type ChartPoint } from '../components/ChartCard';
import { RecommendationCard } from '../components/RecommendationCard';
import { prText } from '../components/PRLabel';
import { LOAD_MODE_LABELS } from '../components/labels';
import { useRoute } from '../router';
import { addDays, daysBetween, formatDate, formatShortDate, startOfWeek, toISODate } from '@/lib/dates';
import { formatNumber, kgToDisplay } from '@/lib/units';
import { defaultPrescription } from './TemplateEditor';

type Range = '7' | '30' | '90' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: 'all', label: 'All' }
];

export default function ProgressPage() {
  const data = useAppData();
  const profile = useProfile();
  const { query } = useRoute();
  const units = profile.units;
  const [range, setRange] = useState<Range>('30');
  const [tab, setTab] = useState(query.get('tab') ?? 'lifts');
  const from = range === 'all' ? undefined : addDays(data.today, -(Number(range) - 1));
  const sessions = data.sessions;
  const done = useMemo(() => completedSessions(sessions), [sessions]);

  const logged = useMemo(() => {
    const ids = new Set<ID>();
    for (const s of done) for (const se of s.exercises) if (!se.skipped && se.sets.some((x) => x.completed)) ids.add(se.exerciseId);
    return [...ids].map((id) => data.exerciseMap.get(id)).filter((e): e is Exercise => !!e).sort((a, b) => a.name.localeCompare(b.name));
  }, [done, data.exerciseMap]);
  const lifts = logged.filter((e) => ['double_progression', 'bodyweight_reps', 'timed_hold', 'mobility'].includes(e.progressionType));
  const speed = logged.filter((e) => e.progressionType === 'sprint' || e.progressionType === 'agility');
  const jumps = logged.filter((e) => e.progressionType === 'jump');

  if (done.length === 0 && data.body.length === 0) {
    return (
      <div>
        <PageHeader title="Progress" />
        <EmptyState icon={<ChartLine />} title="No training data yet" body="Charts appear once you’ve completed a workout. Nothing here is estimated or made up — every point comes from a set you logged." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Progress" subtitle="Every point is a set you logged" />
      <Choice label="Time range" allowClear={false} value={range} onChange={(v) => v && setRange(v)} options={RANGES} className="mb-3" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-scrollbar justify-start overflow-x-auto">
          <TabsTrigger value="lifts">Lifts</TabsTrigger>
          <TabsTrigger value="speed">Speed</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="records">PRs</TabsTrigger>
        </TabsList>
        <TabsContent value="lifts">
          <LiftCharts exercises={lifts} from={from} />
        </TabsContent>
        <TabsContent value="speed" className="flex flex-col gap-3">
          <SpeedCharts sprintExercises={speed} jumpExercises={jumps} from={from} />
        </TabsContent>
        <TabsContent value="training">
          <TrainingCharts range={range} />
        </TabsContent>
        <TabsContent value="body">
          <ChartCard
            title={`Body weight (${units})`}
            data={data.body
              .filter((b) => !from || b.date >= from)
              .slice()
              .reverse()
              .map((b) => ({ x: b.date, y: Math.round(kgToDisplay(b.weightKg, units) * 10) / 10 }))}
            format={(v) => `${formatNumber(v, 1)} ${units}`}
            empty="Log your body weight in Profile to see the trend."
          />
        </TabsContent>
        <TabsContent value="records">
          <RecordsList />
        </TabsContent>
      </Tabs>
      <p className="mt-6 text-center text-xs text-muted-foreground">Each exercise and loading method is charted separately — variations are never compared directly.</p>
    </div>
  );
}

function LiftCharts({ exercises, from }: { exercises: Exercise[]; from?: string }) {
  const data = useAppData();
  const profile = useProfile();
  const units = profile.units;
  const [id, setId] = useState<ID | ''>(() => exercises.find((e) => e.builtinKey === 'lat_pulldown')?.id ?? exercises[0]?.id ?? '');
  const exercise = exercises.find((e) => e.id === id) ?? exercises[0];
  const modes = useMemo(() => (exercise ? loggedLoadModes(data.sessions, exercise.id) : []), [data.sessions, exercise]);
  const [modeChoice, setMode] = useState<LoadMode | null>(null);
  const mode = modeChoice && modes.includes(modeChoice) ? modeChoice : modes[0];
  const series = useMemo(() => (exercise && mode ? exerciseSeries(data.sessions, exercise, mode, from) : []), [data.sessions, exercise, mode, from]);

  if (!exercise || !mode) return <EmptyState icon={<ChartLine />} title="No lifts logged yet" body="Complete a strength workout to see weight, reps and estimated 1RM over time." />;

  const prescription = data.templates.flatMap((t) => t.exercises).find((te) => te.exerciseId === exercise.id)?.prescription ?? defaultPrescription(exercise);
  const rec = recommendationFor(data, exercise, prescription, mode);
  const w = (kg: number) => Math.round(kgToDisplay(kg, units) * 100) / 100;
  const modeNote = mode === 'per_dumbbell' ? ' · per dumbbell' : '';
  const pt = (f: (p: (typeof series)[number]) => number | null): ChartPoint[] => series.map((p) => ({ x: p.date, y: f(p) }));

  return (
    <div className="flex flex-col gap-3">
      <NativeSelect aria-label="Exercise" value={exercise.id} onChange={(e) => setId(e.target.value)}>
        {exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </NativeSelect>
      {modes.length > 1 && (
        <Choice
          label="Loading method"
          allowClear={false}
          value={mode}
          onChange={(v) => v && setMode(v)}
          options={modes.map((m) => ({ value: m, label: LOAD_MODE_LABELS[m] }))}
        />
      )}
      <RecommendationCard rec={rec} />
      {exercise.progressionType === 'double_progression' && (
        <>
          <ChartCard title={`Weight lifted (${units}${modeNote})`} description="Heaviest completed set per session" data={pt((p) => (p.topWeightKg != null ? w(p.topWeightKg) : null))} format={(v) => `${formatNumber(v)} ${units}`} empty="No loaded sets in this period." />
          <ChartCard title="Repetitions achieved" description="Total reps across completed sets" kind="bar" data={pt((p) => p.totalReps)} format={(v) => `${v} reps`} />
          {exercise.e1rmSuitable && (
            <ChartCard
              title={`Estimated 1RM (${units}${modeNote})`}
              description="Epley formula, sets of 12 reps or fewer. An estimate, not a test."
              data={pt((p) => (p.e1rmKg != null ? w(p.e1rmKg) : null))}
              format={(v) => `${formatNumber(v, 1)} ${units}`}
              empty="Needs sets of 1–12 reps with a load."
            />
          )}
          <ChartCard title={`Volume (${units})`} description="Weight × reps for this exercise" kind="bar" data={pt((p) => (p.volumeKg > 0 ? Math.round(kgToDisplay(p.volumeKg, units)) : null))} format={(v) => `${Math.round(v).toLocaleString('en-GB')} ${units}`} />
        </>
      )}
      {exercise.progressionType === 'bodyweight_reps' && <ChartCard title="Best set (reps)" data={pt((p) => p.bestReps)} format={(v) => `${v} reps`} />}
      {exercise.progressionType === 'timed_hold' && <ChartCard title="Longest hold (s)" data={pt((p) => p.bestDurationSec)} format={(v) => `${v} s`} />}
      {exercise.progressionType === 'mobility' && (
        <>
          <ChartCard title="Comfortable range of motion (1–5)" data={pt((p) => p.avgRom)} format={(v) => `${formatNumber(v, 1)} / 5`} empty="Rate range after each set to track it." />
          <ChartCard title="Control (1–5)" data={pt((p) => p.avgControl)} format={(v) => `${formatNumber(v, 1)} / 5`} empty="Rate control after each set to track it." />
        </>
      )}
    </div>
  );
}

function SpeedCharts({ sprintExercises, jumpExercises, from }: { sprintExercises: Exercise[]; jumpExercises: Exercise[]; from?: string }) {
  const data = useAppData();
  if (!sprintExercises.length && !jumpExercises.length)
    return <EmptyState icon={<ChartLine />} title="No speed or jump data yet" body="Time your sprints and log broad-jump distances to see them here." />;
  return (
    <>
      {sprintExercises.map((ex) => {
        const s = exerciseSeries(data.sessions, ex, 'none', from);
        return (
          <ChartCard
            key={ex.id}
            title={`${ex.name} — best time`}
            description="Lower is faster"
            lowerIsBetter
            data={s.map((p) => ({ x: p.date, y: p.bestTimeSec }))}
            format={(v) => `${formatNumber(v, 2)} s`}
            empty="No timed reps in this period."
          />
        );
      })}
      {jumpExercises.map((ex) => {
        const s = exerciseSeries(data.sessions, ex, 'none', from);
        return <ChartCard key={ex.id} title={`${ex.name} — best distance`} description="Jumps with poor landings are excluded" data={s.map((p) => ({ x: p.date, y: p.bestDistanceM }))} format={(v) => `${formatNumber(v, 2)} m`} empty="No distances logged in this period." />;
      })}
    </>
  );
}

function TrainingCharts({ range }: { range: Range }) {
  const data = useAppData();
  const profile = useProfile();
  const units = profile.units;
  const done = completedSessions(data.sessions);
  const first = done.reduce<string | null>((m, s) => (!m || s.date < m ? s.date : m), null);
  const weeksCount = range === 'all' ? (first ? Math.max(1, Math.ceil((daysBetween(startOfWeek(first), data.today) + 1) / 7)) : 1) : Math.max(1, Math.ceil(Number(range) / 7));
  const planned = plannedDaysPerWeek(data.templates, profile.trainingDays);
  const weeks = recentWeeks(data.sessions, data.today, Math.min(weeksCount, 104), planned);
  const consistency = consistencyPercent(data.sessions, data.today, Math.min(weeksCount, 104), data.templates, profile.trainingDays, profile.onboardedAt ? toISODate(new Date(profile.onboardedAt)) : null);
  const totalSessions = weeks.reduce((s, w) => s + w.completed, 0);
  const label = (x: string) => `w/c ${formatShortDate(x)}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile icon={<CalendarCheck />} label="Consistency" value={consistency == null ? '—' : `${consistency}%`} sub="of planned sessions" />
        <StatTile icon={<ChartLine />} label="Workouts" value={totalSessions} sub={`in ${weeks.length} week${weeks.length === 1 ? '' : 's'}`} />
      </div>
      <ChartCard
        title="Workout frequency"
        description="Training days per week"
        kind="bar"
        data={weeks.map((w) => ({ x: w.weekStart, y: w.completed }))}
        xFormat={(x) => formatShortDate(x)}
        format={(v) => `${v} workout${v === 1 ? '' : 's'}`}
        reference={planned ? { y: planned, label: `Plan: ${planned}` } : undefined}
      />
      <ChartCard
        title={`Weekly lifting volume (${units})`}
        description="Weight × reps, all lifts"
        kind="bar"
        data={weeks.map((w) => ({ x: w.weekStart, y: w.volumeKg > 0 ? Math.round(kgToDisplay(w.volumeKg, units)) : 0 }))}
        xFormat={(x) => formatShortDate(x)}
        format={(v) => `${Math.round(v).toLocaleString('en-GB')} ${units}`}
      />
      <Card className="p-4 text-xs text-muted-foreground">Weeks start on Monday. {label(weeks[weeks.length - 1].weekStart)} is the current week.</Card>
    </div>
  );
}

function RecordsList() {
  const data = useAppData();
  const profile = useProfile();
  const prs = useMemo(() => headlinePRs(computePersonalRecords(data.sessions, data.exerciseMap)), [data.sessions, data.exerciseMap]);
  if (!prs.length) return <EmptyState icon={<Trophy />} title="No personal records yet" body="Records are calculated from your completed workouts and update automatically if you edit history." />;
  const groups = new Map<ID, typeof prs>();
  for (const p of prs) groups.set(p.exerciseId, [...(groups.get(p.exerciseId) ?? []), p]);
  return (
    <div className="flex flex-col gap-2">
      {[...groups.entries()]
        .sort((a, b) => (data.exerciseMap.get(a[0])?.name ?? '').localeCompare(data.exerciseMap.get(b[0])?.name ?? ''))
        .map(([exId, list]) => (
          <Card key={exId} className="p-4">
            <a href={`#/library/${exId}`} className="font-semibold">
              {data.exerciseMap.get(exId)?.name}
            </a>
            <ul className="mt-1 space-y-1">
              {list.map((p) => (
                <li key={`${p.kind}-${p.loadMode}-${p.distanceM}`} className="flex items-start justify-between gap-2 text-sm">
                  <span className="flex gap-1.5">
                    <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    {prText(p, profile.units)}
                  </span>
                  <a href={`#/history/${p.sessionId}`} className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline">
                    {formatDate(p.date)}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      <p className="text-xs text-muted-foreground">Per-dumbbell and total loads are recorded separately.</p>
    </div>
  );
}
