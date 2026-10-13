import { formatCalendarDate, formatUkDate, formatUkTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MetaGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3', className)}>{children}</dl>;
}

export function Meta({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-medium text-ink">{children}</dd>
    </div>
  );
}

export function SubmittedAt({ value }: { value: string }) {
  return (
    <span className="tabular">
      {formatUkDate(value)} <span className="text-muted">at</span> {formatUkTime(value)}
    </span>
  );
}

export function RequiredDate({ value }: { value: string | null }) {
  return value ? <span className="tabular">{formatCalendarDate(value)}</span> : <span className="font-normal text-subtle">Not specified</span>;
}
