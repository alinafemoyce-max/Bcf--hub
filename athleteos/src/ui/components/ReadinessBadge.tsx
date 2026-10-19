import { CircleCheck, CircleHelp, TriangleAlert, OctagonAlert } from 'lucide-react';
import type { ReadinessLevel } from '@/domain/readiness';
import { cn } from '@/lib/utils';

const META: Record<ReadinessLevel, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  green: { label: 'Good to train', cls: 'text-success', Icon: CircleCheck },
  amber: { label: 'Take it lighter', cls: 'text-warning', Icon: TriangleAlert },
  red: { label: 'Rest advised', cls: 'text-danger', Icon: OctagonAlert },
  unknown: { label: 'No check-in', cls: 'text-muted-foreground', Icon: CircleHelp }
};

/** Status is always icon + label, never colour alone. */
export function ReadinessBadge({ level, className }: { level: ReadinessLevel; className?: string }) {
  const { label, cls, Icon } = META[level];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-base font-bold', cls, className)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
