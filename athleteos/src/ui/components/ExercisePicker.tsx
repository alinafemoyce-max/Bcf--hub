import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import type { Exercise, ID } from '@/domain/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { MUSCLE_LABELS } from '@/domain/analytics';
import { PROGRESSION_LABELS } from './labels';
import { Button } from './ui/button';

export function ExercisePicker({
  open,
  onOpenChange,
  exercises,
  onPick,
  title = 'Choose exercise',
  description,
  excludeIds = []
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exercises: Exercise[];
  onPick: (e: Exercise) => void;
  title?: string;
  description?: string;
  excludeIds?: ID[];
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return exercises
      .filter((e) => !e.deletedAt && !excludeIds.includes(e.id))
      .filter((e) => !t || e.name.toLowerCase().includes(t) || e.primaryMuscles.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(t)) || e.equipment.some((x) => x.includes(t)));
  }, [q, exercises, excludeIds]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[85dvh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder="Search by name, muscle or equipment" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
        </div>
        <ul className="-mx-2 flex-1 overflow-y-auto">
          {list.map((e) => (
            <li key={e.id}>
              <button
                className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left hover:bg-secondary"
                onClick={() => {
                  onPick(e);
                  onOpenChange(false);
                  setQ('');
                }}
              >
                <span className="font-semibold">{e.name}</span>
                <span className="text-xs text-muted-foreground">
                  {e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {PROGRESSION_LABELS[e.progressionType]}
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No exercises match “{q}”.</li>}
        </ul>
        <Button variant="outline" asChild>
          <a href="#/library/new">
            <Plus /> Create a custom exercise
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
