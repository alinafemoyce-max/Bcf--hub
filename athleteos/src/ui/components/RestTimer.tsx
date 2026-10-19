import { useEffect, useRef } from 'react';
import { Timer, SkipForward } from 'lucide-react';
import { useNow } from '../hooks/useNow';
import { formatDuration } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * Rest countdown docked at the bottom of the screen. The end time lives in the saved session,
 * so the timer keeps counting if the app is closed and reopened.
 */
export function RestTimer({ endsAt, onChange }: { endsAt: string | null; onChange: (endsAt: string | null) => void }) {
  const now = useNow(250);
  const buzzed = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const end = endsAt ? Date.parse(endsAt) : null;
  const remaining = end != null ? Math.ceil((end - now) / 1000) : null;
  const finished = remaining != null && remaining <= 0;

  useEffect(() => {
    if (!finished || !endsAt) return;
    if (buzzed.current !== endsAt) {
      buzzed.current = endsAt;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* vibration isn't available on iPhone */
      }
    }
    const id = window.setTimeout(() => onChangeRef.current(null), 4000);
    return () => window.clearTimeout(id);
  }, [finished, endsAt]);

  if (end == null || remaining == null || remaining < -5) return null;
  const doneResting = remaining <= 0;
  const adjust = (delta: number) => onChange(new Date(Math.max(Date.now() + 1000, end + delta * 1000)).toISOString());

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" role="timer" aria-live={doneResting ? 'assertive' : 'off'}>
      <div className={cn('mx-auto flex max-w-xl items-center gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl', doneResting ? 'border-success/60 bg-success/20' : 'border-primary/40 bg-popover/95')}>
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
          <Timer className={cn('h-5 w-5 shrink-0', doneResting ? 'text-success' : 'text-accent')} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{doneResting ? 'Rest complete' : 'Rest'}</p>
            <p className="text-2xl font-black tabular leading-none">{doneResting ? 'Go!' : formatDuration(remaining)}</p>
          </div>
        </div>
        {!doneResting && (
          <>
            <button className="h-11 rounded-xl px-3 text-sm font-bold text-muted-foreground hover:bg-secondary" onClick={() => adjust(-15)} aria-label="Subtract 15 seconds">
              −15
            </button>
            <button className="h-11 rounded-xl px-3 text-sm font-bold text-muted-foreground hover:bg-secondary" onClick={() => adjust(15)} aria-label="Add 15 seconds">
              +15
            </button>
          </>
        )}
        <button className="flex h-11 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-bold" onClick={() => onChange(null)}>
          <SkipForward className="h-4 w-4" /> {doneResting ? 'Close' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
