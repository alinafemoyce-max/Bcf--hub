import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import type { MuscleGroup, ProgressionType } from '@/domain/types';
import { useAppData } from '../hooks/useAppData';
import { EmptyState, PageHeader } from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { MUSCLE_LABELS } from '@/domain/analytics';
import { EQUIPMENT_LABELS, PROGRESSION_LABELS } from '../components/labels';
import { navigate } from '../router';

export function LibraryPage() {
  const data = useAppData();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | ''>('');
  const [type, setType] = useState<ProgressionType | ''>('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.exercises.filter((e) => {
      if (muscle && !e.primaryMuscles.includes(muscle) && !e.secondaryMuscles.includes(muscle)) return false;
      if (type && e.progressionType !== type) return false;
      if (!t) return true;
      return (
        e.name.toLowerCase().includes(t) ||
        e.primaryMuscles.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(t)) ||
        e.equipment.some((x) => EQUIPMENT_LABELS[x].toLowerCase().includes(t))
      );
    });
  }, [data.exercises, q, muscle, type]);

  return (
    <div>
      <PageHeader
        title="Exercise library"
        subtitle={`${data.exercises.length} exercises`}
        back="/train"
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/library/new')}>
            <Plus /> Custom
          </Button>
        }
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search name, muscle or equipment" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NativeSelect aria-label="Filter by muscle" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | '')}>
          <option value="">All muscles</option>
          {Object.entries(MUSCLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value as ProgressionType | '')}>
          <option value="">All types</option>
          {Object.entries(PROGRESSION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((e) => (
          <li key={e.id}>
            <a href={`#/library/${e.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 hover:bg-secondary">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{e.name}</span>
                  {e.isCustom && <Badge variant="secondary">Custom</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {e.equipment.map((x) => EQUIPMENT_LABELS[x]).join(', ')}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <EmptyState icon={<Search />} title="No exercises found" body="Try another search, or create a custom exercise." action={<Button onClick={() => navigate('/library/new')}>Create exercise</Button>} />
      )}
    </div>
  );
}
