import { ArrowDown, ArrowUp, Equal, Info, Pause, Sparkles, TrendingUp, TriangleAlert, Moon } from 'lucide-react';
import type { Recommendation } from '@/domain/overload';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/dates';

function look(rec: Recommendation) {
  switch (rec.action) {
    case 'increase_load':
    case 'increase_reps':
    case 'increase_duration':
    case 'add_set':
    case 'progress_difficulty':
      return { Icon: rec.action === 'increase_load' ? ArrowUp : TrendingUp, cls: 'border-success/40 bg-success/10', icon: 'text-success', label: 'Progress' };
    case 'decrease_load':
      return { Icon: ArrowDown, cls: 'border-warning/40 bg-warning/10', icon: 'text-warning', label: 'Reduce' };
    case 'rest':
      return { Icon: Moon, cls: 'border-danger/40 bg-danger/10', icon: 'text-danger', label: 'Rest advised' };
    case 'baseline':
      return { Icon: Sparkles, cls: 'border-primary/40 bg-primary/10', icon: 'text-accent', label: 'First session' };
    case 'hold_quality':
      return { Icon: Pause, cls: 'border-primary/30 bg-primary/5', icon: 'text-accent', label: 'Quality focus' };
    case 'complete':
      return { Icon: Info, cls: 'border-border bg-secondary/40', icon: 'text-muted-foreground', label: 'Warm-up' };
    default:
      return { Icon: Equal, cls: 'border-primary/30 bg-primary/5', icon: 'text-accent', label: 'Maintain' };
  }
}

export function RecommendationCard({ rec, compact, className }: { rec: Recommendation; compact?: boolean; className?: string }) {
  const { Icon, cls, icon, label } = look(rec);
  const plateau = rec.flags.includes('plateau');
  return (
    <div className={cn('rounded-xl border p-3', cls, className)}>
      <div className="flex gap-2.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
            {plateau && <span className="ml-2 text-warning">· Plateau</span>}
          </p>
          <p className="text-sm font-semibold leading-snug">{rec.headline}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/80">Why: </span>
            {rec.reason}
          </p>
          {!compact && rec.details.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {rec.details.map((d) => (
                <li key={d} className="flex gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                  {d}
                </li>
              ))}
            </ul>
          )}
          {!compact && rec.basedOn && <p className="mt-1.5 text-[11px] text-muted-foreground">Based on your session on {formatDate(rec.basedOn.date, { weekday: true })}.</p>}
        </div>
      </div>
    </div>
  );
}
