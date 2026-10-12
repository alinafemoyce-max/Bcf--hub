import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronsUp,
  CircleDot,
  Hammer,
  HelpCircle,
  Inbox,
  type LucideIcon,
  Minus,
  PackageCheck,
  ThumbsUp,
  XCircle
} from 'lucide-react';
import { PRIORITY_LABELS, STATUS_LABELS, type OperatorPriority, type OrderStatus } from '@/lib/domain';
import { cn } from '@/lib/utils';

export const STATUS_STYLE: Record<OrderStatus, { icon: LucideIcon; className: string; dot: string }> = {
  submitted: { icon: Inbox, className: 'bg-marine-50 text-marine-700 ring-marine/25', dot: 'bg-marine' },
  clarification_required: { icon: HelpCircle, className: 'bg-warn-50 text-warn ring-warn/30', dot: 'bg-warn' },
  accepted: { icon: ThumbsUp, className: 'bg-violet-50 text-violet ring-violet/25', dot: 'bg-violet' },
  in_progress: { icon: Hammer, className: 'bg-navy text-white ring-navy', dot: 'bg-navy' },
  ready: { icon: PackageCheck, className: 'bg-ok-50 text-ok ring-ok/30', dot: 'bg-ok' },
  collected: { icon: CheckCircle2, className: 'bg-surface text-muted ring-line-strong', dot: 'bg-subtle' },
  rejected: { icon: XCircle, className: 'bg-danger-50 text-danger ring-danger/25', dot: 'bg-danger' },
  cancelled: { icon: Ban, className: 'bg-surface text-muted ring-line-strong', dot: 'bg-subtle' }
};

export function StatusBadge({ status, size = 'md', className }: { status: OrderStatus; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset',
        size === 'sm' && 'px-2 py-0.5 text-xs [&_svg]:size-3.5',
        size === 'md' && 'px-2.5 py-1 text-[13px] [&_svg]:size-4',
        size === 'lg' && 'px-3.5 py-1.5 text-[15px] [&_svg]:size-[18px]',
        s.className,
        className
      )}
    >
      <Icon aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<OperatorPriority, { icon: LucideIcon; className: string }> = {
  urgent: { icon: AlertTriangle, className: 'bg-danger text-white ring-danger' },
  high: { icon: ChevronsUp, className: 'bg-warn-50 text-warn ring-warn/40' },
  normal: { icon: Minus, className: 'bg-white text-muted ring-line-strong' }
};

/** Priority uses an icon and a word as well as colour, so it is distinguishable without colour. */
export function PriorityBadge({ priority, className }: { priority: OperatorPriority; className?: string }) {
  const p = PRIORITY_STYLE[priority];
  const Icon = p.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ring-inset [&_svg]:size-3.5',
        p.className,
        className
      )}
    >
      <Icon aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function RequestedUrgentFlag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-danger/50 px-2 py-0.5 text-xs font-semibold text-danger">
      <CircleDot className="size-3.5" aria-hidden />
      Requested urgent
    </span>
  );
}
