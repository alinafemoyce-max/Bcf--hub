import { useMemo } from 'react';
import { ExternalLink, Pencil, Trash2, Trophy } from 'lucide-react';
import { repo } from '@/data';
import { exerciseHistory } from '@/domain/overload';
import { computePersonalRecords, headlinePRs, MUSCLE_LABELS } from '@/domain/analytics';
import { useAppData, useProfile } from '../hooks/useAppData';
import { recommendationFor } from '../hooks/derived';
import { EmptyState, PageHeader, SectionTitle } from '../components/common';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { RecommendationCard } from '../components/RecommendationCard';
import { EQUIPMENT_LABELS, LOAD_MODE_LABELS, PROGRESSION_LABELS, prescriptionText } from '../components/labels';
import { formatSets } from '../components/setFormat';
import { prText } from '../components/PRLabel';
import { useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { formatDate } from '@/lib/dates';
import { formatWeight } from '@/lib/units';
import { incrementFor } from '@/domain/overload';
import { defaultPrescription } from './TemplateEditor';

export function ExerciseDetail({ id }: { id: string }) {
  const data = useAppData();
  const profile = useProfile();
  const { confirm, toast } = useFeedback();
  const exercise = data.exerciseMap.get(id);
  const history = useMemo(() => (exercise ? exerciseHistory(data.sessions, exercise.id) : []), [data.sessions, exercise]);
  const prs = useMemo(() => (exercise ? headlinePRs(computePersonalRecords(data.sessions, data.exerciseMap)).filter((p) => p.exerciseId === exercise.id) : []), [data.sessions, data.exerciseMap, exercise]);
  const programmeUse = data.templates.flatMap((t) => t.exercises.filter((te) => te.exerciseId === id).map((te) => ({ t, te })));

  if (!exercise || exercise.deletedAt) {
    return (
      <div>
        <PageHeader title="Exercise" back="/library" />
        <EmptyState title="Exercise not found" />
      </div>
    );
  }
  const prescription = programmeUse[0]?.te.prescription ?? defaultPrescription(exercise);
  const loadMode = history[0]?.loadMode ?? exercise.defaultLoadMode;
  const rec = recommendationFor(data, exercise, prescription, loadMode);

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${exercise.name}”?`,
      description: 'It will be removed from your programme. Past workouts that used it keep their records.',
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!ok) return;
    await repo.deleteExercise(exercise.id);
    toast('Exercise deleted');
    navigate('/library', { replace: true });
  };

  return (
    <div>
      <PageHeader
        title={exercise.name}
        back="/library"
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Edit exercise" onClick={() => navigate(`/library/${id}/edit`)}>
              <Pencil />
            </Button>
            {exercise.isCustom && (
              <Button variant="ghost" size="icon" aria-label="Delete exercise" onClick={remove}>
                <Trash2 className="text-danger" />
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        <Badge>{PROGRESSION_LABELS[exercise.progressionType]}</Badge>
        {exercise.isCustom && <Badge variant="secondary">Custom</Badge>}
        {exercise.unilateral && <Badge variant="outline">Unilateral</Badge>}
      </div>

      <Card className="mt-3">
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
          <Info label="Primary muscles" value={exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} />
          <Info label="Secondary muscles" value={exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ') || '—'} />
          <Info label="Equipment" value={exercise.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')} />
          <Info label="Recommended rest" value={exercise.restSeconds ? `${exercise.restSeconds} s` : '—'} />
          <Info label="Logged as" value={LOAD_MODE_LABELS[exercise.defaultLoadMode]} />
          {exercise.progressionType === 'double_progression' && <Info label="Increase step" value={formatWeight(incrementFor(exercise, loadMode, profile.increments), profile.units)} />}
        </CardContent>
      </Card>

      {exercise.demoUrl && (
        <Button variant="secondary" className="mt-3 w-full" asChild>
          <a href={exercise.demoUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink /> Watch demonstrations
          </a>
        </Button>
      )}

      {exercise.progressionType !== 'conditioning' && (
        <>
          <SectionTitle>Recommendation</SectionTitle>
          <RecommendationCard rec={rec} />
          {programmeUse.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Using the {programmeUse[0].t.name} target ({prescriptionText(prescription)}).</p>}
        </>
      )}

      <SectionTitle>Technique</SectionTitle>
      <ol className="list-inside list-decimal space-y-1.5 rounded-2xl border bg-card p-4 text-sm">
        {exercise.instructions.map((s) => (
          <li key={s}>{s}</li>
        ))}
        {exercise.instructions.length === 0 && <li className="list-none text-muted-foreground">No instructions added.</li>}
      </ol>
      {exercise.commonMistakes.length > 0 && (
        <>
          <SectionTitle>Common mistakes</SectionTitle>
          <ul className="space-y-1.5 rounded-2xl border bg-card p-4 text-sm">
            {exercise.commonMistakes.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-danger">✕</span> {s}
              </li>
            ))}
          </ul>
        </>
      )}

      {prs.length > 0 && (
        <>
          <SectionTitle>Records</SectionTitle>
          <ul className="space-y-1.5 rounded-2xl border bg-card p-4 text-sm">
            {prs.map((p) => (
              <li key={`${p.kind}-${p.loadMode}-${p.distanceM}`} className="flex gap-2">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {prText(p, profile.units)} <span className="ml-auto text-xs text-muted-foreground">{formatDate(p.date)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Recent sessions</SectionTitle>
      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Not logged yet.</p>
      ) : (
        <Card>
          <ul className="divide-y">
            {history.slice(0, 10).map((h) => (
              <li key={`${h.sessionId}-${h.timestamp}`}>
                <a href={`#/history/${h.sessionId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary">
                  <span className="text-sm">{formatSets(h.sets, exercise, h.loadMode, profile.units)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(h.date)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
