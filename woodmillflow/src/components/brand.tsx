import { cn } from '@/lib/utils';

/** WoodmillFlow mark: stacked boards with a cutting line. Original artwork — no company branding. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#10243A" />
      <rect x="7" y="9" width="18" height="3.2" rx="1" fill="#2B91C9" />
      <rect x="7" y="14.4" width="18" height="3.2" rx="1" fill="#FFFFFF" opacity="0.92" />
      <rect x="7" y="19.8" width="18" height="3.2" rx="1" fill="#FFFFFF" opacity="0.6" />
      <path d="M20 6.5v19" stroke="#2B91C9" strokeWidth="1.4" strokeDasharray="2 1.6" />
    </svg>
  );
}

export function Wordmark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-[17px] font-bold tracking-tight', inverted ? 'text-white' : 'text-navy')}>
        Woodmill<span className={inverted ? 'text-accent' : 'text-marine'}>Flow</span>
      </span>
    </span>
  );
}

export function DemoNotice({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]',
        inverted ? 'bg-white/10 text-white/80 ring-1 ring-white/15' : 'bg-warn-50 text-warn ring-1 ring-warn/25',
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', inverted ? 'bg-accent' : 'bg-warn')} aria-hidden />
      Independent Concept Demonstration — Fictional Data
    </span>
  );
}
