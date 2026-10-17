import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children, ...rest }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-[var(--radius-card)] border border-line bg-surface p-4', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action, sub }: { children: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong disabled:bg-surface-3 disabled:text-ink-3',
  secondary: 'bg-surface-2 text-ink border border-line-strong hover:bg-surface-3 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad/12 text-bad border border-bad/30 hover:bg-bad/20'
};
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium transition-colors active:scale-[0.98] disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Button({ variant = 'primary', className, ...rest }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={cx(base, variants[variant], className)} {...rest} />;
}

export function LinkButton({ variant = 'primary', className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...rest} />;
}

type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-soft text-accent-strong',
  good: 'bg-good/12 text-good',
  warn: 'bg-warn/12 text-warn',
  bad: 'bg-bad/12 text-bad'
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function Stat({ label, value, sub, approximate }: { label: string; value: ReactNode; sub?: ReactNode; approximate?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface px-3.5 py-3">
      <div className="truncate text-[12.5px] text-ink-3">{label}</div>
      <div className="tnum mt-1 truncate text-[22px] font-semibold tracking-tight text-ink">
        {approximate && <span className="mr-0.5 text-ink-3">≈</span>}
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12px] leading-snug text-ink-3">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-3">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
      {error && <span className="mt-1 block text-[12px] text-bad">{error}</span>}
    </label>
  );
}

const control =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60';

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx(control, 'min-h-11', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cx(control, 'min-h-24', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cx(control, 'min-h-11 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: CHEVRON }} {...rest}>
      {children}
    </select>
  );
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23808792' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-hidden />;
}

export function Notice({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const border: Record<Tone, string> = {
    neutral: 'border-line bg-surface-2 text-ink-2',
    accent: 'border-accent/30 bg-accent-soft text-ink',
    good: 'border-good/30 bg-good/10 text-ink',
    warn: 'border-warn/30 bg-warn/10 text-ink',
    bad: 'border-bad/30 bg-bad/10 text-ink'
  };
  return <div className={cx('rounded-xl border px-3.5 py-3 text-[13.5px] leading-relaxed', border[tone], className)}>{children}</div>;
}

export function PageTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Thumb({ src, alt, size = 44 }: { src: string | null; alt: string; size?: number }) {
  const style = { width: size, height: Math.round(size * 1.33) };
  if (!src) return <div className="shrink-0 rounded-lg bg-surface-3" style={style} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="shrink-0 rounded-lg object-cover" style={style} />;
}
