import { Check } from 'lucide-react';
import { MAIN_PATH, STATUS_LABELS, type OrderStatus } from '@/lib/domain';
import { formatUkDate, formatUkTime } from '@/lib/format';
import type { HistoryEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEP_HELP: Record<string, string> = {
  submitted: 'Your request has been received by the woodmill.',
  accepted: 'The woodmill has checked and accepted the request.',
  in_progress: 'Your materials are being cut.',
  ready: 'Materials are ready to collect.',
  collected: 'Materials have been collected.'
};

/**
 * Main-path progress (Submitted → Accepted → In Progress → Ready → Collected) with the time each
 * step was reached. Off-path states (clarification, rejection, cancellation) are shown separately.
 */
export function StatusTimeline({ status, history }: { status: OrderStatus; history: HistoryEntry[] }) {
  const reachedAt = new Map<OrderStatus, string>();
  for (const h of history) if (h.eventType === 'status') reachedAt.set(h.newStatus, h.changedAt);

  // For off-path states (clarification, rejected, cancelled) show the main-path steps already reached.
  const onPath = MAIN_PATH.includes(status);
  let currentIndex = MAIN_PATH.indexOf(status);
  if (!onPath) {
    const lastMain = [...history].reverse().find((h) => MAIN_PATH.includes(h.newStatus));
    currentIndex = lastMain ? MAIN_PATH.indexOf(lastMain.newStatus) : 0;
  }
  const finished = status === 'collected';

  return (
    <ol className="relative" data-testid="status-timeline">
      {MAIN_PATH.map((step, i) => {
        const complete = i < currentIndex || (i === currentIndex && (finished || !onPath));
        const isCurrent = onPath && !finished && i === currentIndex;
        const reached = reachedAt.get(step);
        const last = i === MAIN_PATH.length - 1;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0" data-step={step} data-state={complete ? 'done' : isCurrent ? 'current' : 'upcoming'}>
            {!last && (
              <span
                aria-hidden
                className={cn('absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5', i < currentIndex ? 'bg-ok' : 'bg-line')}
              />
            )}
            <span
              className={cn(
                'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2',
                complete && 'border-ok bg-ok text-white',
                isCurrent && 'border-marine bg-white',
                !complete && !isCurrent && 'border-line-strong bg-white'
              )}
              aria-hidden
            >
              {complete ? (
                <Check className="size-4" strokeWidth={3} />
              ) : isCurrent ? (
                <span className="size-3 rounded-full bg-marine" />
              ) : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('font-semibold', complete || isCurrent ? 'text-navy' : 'text-subtle')}>
                {STATUS_LABELS[step]}
                <span className="sr-only">{complete ? ' (completed)' : isCurrent ? ' (current)' : ' (not yet reached)'}</span>
              </p>
              {(complete || isCurrent) && reached ? (
                <p className="text-sm text-muted tabular">
                  {formatUkDate(reached)} at {formatUkTime(reached)}
                </p>
              ) : null}
              {isCurrent && <p className="mt-0.5 text-sm text-ink">{STEP_HELP[step]}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
