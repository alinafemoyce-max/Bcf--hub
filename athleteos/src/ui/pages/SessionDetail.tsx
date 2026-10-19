import { useLiveQuery } from 'dexie-react-hooks';
import { History, MoreVertical, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { repo } from '@/data';
import { useAppData } from '../hooks/useAppData';
import { EmptyState, PageHeader, SectionTitle } from '../components/common';
import { SessionReport } from '../components/SessionReport';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { formatDate } from '@/lib/dates';

export function SessionDetail({ id }: { id: string }) {
  const data = useAppData();
  const { toast, confirm } = useFeedback();
  const session = data.sessions.find((s) => s.id === id);
  const revisions = useLiveQuery(() => repo.listRevisions(id), [id]) ?? [];

  if (!session) {
    return (
      <div>
        <PageHeader title="Workout" back="/history" />
        <EmptyState title="Workout not found" body="It may have been deleted." />
      </div>
    );
  }
  if (session.status === 'in_progress') {
    return (
      <div>
        <PageHeader title={session.name} back="/history" />
        <EmptyState title="This workout is still in progress" action={<Button onClick={() => navigate('/train/live')}>Resume workout</Button>} />
      </div>
    );
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this workout?',
      description: 'It will be removed from your history, charts and personal records. Recommendations will be recalculated.',
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!ok) return;
    await repo.deleteSession(id);
    toast('Workout deleted');
    navigate('/history', { replace: true });
  };

  const restore = async (revisionId: string, label: string) => {
    const ok = await confirm({ title: `Restore ${label}?`, description: 'The current version is kept in the edit history, so you can switch back.', confirmLabel: 'Restore' });
    if (!ok) return;
    try {
      await repo.restoreRevision(revisionId);
      toast('Version restored');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title={session.name}
        subtitle={formatDate(session.date, { weekday: true, year: true })}
        back="/history"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workout options">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/history/${id}/edit`)}>
                <Pencil /> Edit workout
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={remove}>
                <Trash2 /> Delete workout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {session.source === 'manual' && <Badge variant="secondary">Entered manually</Badge>}
        {session.revision > 0 && <Badge variant="outline">Edited {session.revision}×</Badge>}
      </div>
      <SessionReport session={session} />
      {session.notes && (
        <>
          <SectionTitle>Session notes</SectionTitle>
          <Card className="whitespace-pre-wrap p-4 text-sm">{session.notes}</Card>
        </>
      )}
      <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate(`/history/${id}/edit`)}>
        <Pencil /> Edit workout
      </Button>

      {revisions.length > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Edit history
            </span>
          </SectionTitle>
          <Card>
            <ul className="divide-y">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Version {r.revision + 1}</p>
                    <p className="text-xs text-muted-foreground">Replaced {new Date(r.savedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restore(r.id, `version ${r.revision + 1}`)}>
                    <RotateCcw /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">Every edit keeps a copy of the previous version. Charts, records and recommendations always use the current version.</p>
        </>
      )}
    </div>
  );
}
