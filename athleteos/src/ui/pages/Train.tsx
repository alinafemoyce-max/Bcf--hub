import { BookOpen, ChevronRight, MoreVertical, Pencil, Play, Plus, RotateCcw, Zap } from 'lucide-react';
import { repo } from '@/data';
import { useAppData, useProfile } from '../hooks/useAppData';
import { activeSession } from '../hooks/derived';
import { PageHeader, SectionTitle } from '../components/common';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { errorMessage, useFeedback } from '../components/feedback';
import { navigate } from '../router';
import { WEEKDAY_NAMES, weekdayOf } from '@/lib/dates';
import { FOCUS_LABELS } from '../components/labels';
import { cn } from '@/lib/utils';

export function TrainPage() {
  const data = useAppData();
  const profile = useProfile();
  const { toast, confirm } = useFeedback();
  const live = activeSession(data);
  const todayDow = weekdayOf(data.today);
  const doneToday = new Set(data.sessions.filter((s) => s.status === 'completed' && s.date === data.today).map((s) => s.templateId));

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset the weekly programme?',
      description: 'All workouts return to the original Monday–Friday plan. Your workout history is not affected.',
      confirmLabel: 'Reset programme',
      destructive: true
    });
    if (!ok) return;
    try {
      await repo.resetProgramme();
      toast('Programme reset');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Train"
        subtitle="Your weekly programme"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Programme options">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate('/train/template/new')}>
                <Plus /> New workout
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/library')}>
                <BookOpen /> Exercise library
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={reset}>
                <RotateCcw /> Reset to default programme
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {live && (
        <Button size="lg" className="mb-3 w-full" onClick={() => navigate('/train/live')}>
          <Play className="fill-current" /> Resume {live.name}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-12" onClick={() => navigate('/train/start/blank')} disabled={!!live}>
          <Zap /> Empty workout
        </Button>
        <Button variant="secondary" className="h-12" onClick={() => navigate('/library')}>
          <BookOpen /> Exercises
        </Button>
      </div>

      <SectionTitle>Weekly schedule</SectionTitle>
      <ul className="flex flex-col gap-2.5">
        {data.templates.map((t) => {
          const isToday = t.dayOfWeek === todayDow;
          const trainingDay = t.dayOfWeek != null && profile.trainingDays.includes(t.dayOfWeek);
          return (
            <li key={t.id} className={cn('rounded-2xl border bg-card', isToday && 'border-primary/50')}>
              <button className="flex w-full items-center gap-3 p-4 pb-2 text-left" onClick={() => navigate(`/train/template/${t.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t.dayOfWeek ? WEEKDAY_NAMES[t.dayOfWeek] : 'Unscheduled'}
                    {isToday && <Badge>Today</Badge>}
                    {doneToday.has(t.id) && <Badge variant="success">Done</Badge>}
                    {t.dayOfWeek && !trainingDay && <Badge variant="outline">Not a training day</Badge>}
                  </p>
                  <p className="mt-0.5 text-lg font-bold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {FOCUS_LABELS[t.focus]} · {t.exercises.length} exercises
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
              <div className="flex gap-2 p-4 pt-2">
                <Button className="flex-1" variant={isToday ? 'default' : 'secondary'} disabled={!!live || t.exercises.length === 0} onClick={() => navigate(`/train/start/${t.id}`)}>
                  <Play className="fill-current" /> Start
                </Button>
                <Button variant="outline" onClick={() => navigate(`/train/template/${t.id}`)} aria-label={`Edit ${t.name}`}>
                  <Pencil /> Edit
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="mt-3 w-full" onClick={() => navigate('/train/template/new')}>
        <Plus /> New workout
      </Button>
      <p className="mt-6 text-center text-xs text-muted-foreground">Saturday and Sunday are for rest or optional light recovery.</p>
    </div>
  );
}
