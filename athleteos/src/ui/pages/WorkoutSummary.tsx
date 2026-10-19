import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { repo } from '@/data';
import { useAppData } from '../hooks/useAppData';
import { recommendationFor } from '../hooks/derived';
import { EmptyState, PageHeader, SectionTitle } from '../components/common';
import { SessionReport } from '../components/SessionReport';
import { RecommendationCard } from '../components/RecommendationCard';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { formatDate } from '@/lib/dates';

export function WorkoutSummary({ id }: { id: string }) {
  const data = useAppData();
  const { toast } = useFeedback();
  const session = data.sessions.find((s) => s.id === id);
  const [notes, setNotes] = useState<string | null>(null);

  const nextTime = useMemo(() => {
    if (!session) return [];
    return session.exercises
      .filter((se) => !se.skipped && se.sets.some((s) => s.completed))
      .map((se) => ({ se, ex: data.exerciseMap.get(se.exerciseId) }))
      .filter(({ ex }) => ex && ex.progressionType !== 'conditioning')
      .map(({ se, ex }) => ({ id: se.id, name: ex!.name, rec: recommendationFor(data, ex!, se.prescription, se.loadMode) }));
  }, [session, data]);

  if (!session) {
    return (
      <div>
        <PageHeader title="Summary" back="/" />
        <EmptyState title="Workout not found" />
      </div>
    );
  }

  const saveNotes = async () => {
    try {
      await repo.editCompletedSession({ ...session, notes: notes ?? '' });
      setNotes(null);
      toast('Notes saved');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Workout complete" subtitle={`${session.name} · ${formatDate(session.date, { weekday: true })}`} />
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />
        <p className="text-sm">Saved to your history. Here’s what you did and what to aim for next time.</p>
      </div>
      <SessionReport session={session} />

      {nextTime.length > 0 && (
        <>
          <SectionTitle>Next time</SectionTitle>
          <div className="flex flex-col gap-2">
            {nextTime.map((n) => (
              <div key={n.id}>
                <p className="mb-1 text-sm font-semibold">{n.name}</p>
                <RecommendationCard rec={n.rec} compact />
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Session notes</SectionTitle>
      <Textarea rows={3} value={notes ?? session.notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Anything to remember?" aria-label="Session notes" />
      {notes != null && notes !== (session.notes ?? '') && (
        <Button variant="secondary" className="mt-2 w-full" onClick={saveNotes}>
          Save notes
        </Button>
      )}
      <Button size="lg" className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>
        Done
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">Recommendations are guidance, not guarantees.</p>
    </div>
  );
}
