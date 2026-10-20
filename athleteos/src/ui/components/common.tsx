import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ChevronLeft, Minus, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { goBack } from '../router';

export function PageHeader({ title, subtitle, back, actions, className }: { title: ReactNode; subtitle?: ReactNode; back?: string | true; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 bg-background/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl', className)}>
      {back && (
        <Button variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Back" onClick={() => goBack(typeof back === 'string' ? back : '/')}>
          <ChevronLeft className="!size-6" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function StatTile({ label, value, sub, icon, className, onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3.5 text-left', onClick && 'transition-colors hover:bg-secondary active:bg-secondary', className)}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-accent">
        {icon}
        {label}
      </span>
      <span className="truncate text-xl font-bold tabular">{value}</span>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </Comp>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-secondary text-accent [&_svg]:size-6">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingScreen({ label = 'Loading your training data…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" role="status">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

/** Large +/− control for one-handed logging. Value null shows the placeholder. */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  placeholder,
  label,
  decimals = 2,
  inputMode = 'decimal',
  className,
  compact
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  placeholder?: string;
  label: string;
  decimals?: number;
  inputMode?: 'decimal' | 'numeric';
  className?: string;
  compact?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  const base = value ?? (placeholder ? Number(placeholder) || 0 : 0);
  return (
    <div className={cn('flex items-stretch overflow-hidden rounded-xl border border-input bg-background', className)}>
      <button type="button" aria-label={`Decrease ${label}`} className={cn('grid shrink-0 place-items-center text-muted-foreground active:bg-secondary', compact ? 'w-8' : 'w-11')} onClick={() => onChange(clamp(base - step))}>
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label={label}
        type="number"
        inputMode={inputMode}
        step="any"
        className={cn('w-full min-w-0 bg-transparent text-center font-bold tabular outline-none placeholder:font-normal placeholder:text-muted-foreground', compact ? 'h-10 text-base' : 'h-12 text-lg')}
        value={value ?? ''}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" aria-label={`Increase ${label}`} className={cn('grid shrink-0 place-items-center text-muted-foreground active:bg-secondary', compact ? 'w-8' : 'w-11')} onClick={() => onChange(clamp(base + step))}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Segmented single choice with large touch targets. */
export function Choice<T extends string | number>({
  value,
  options,
  onChange,
  label,
  allowClear = true,
  className,
  size = 'md'
}: {
  value: T | null | undefined;
  options: { value: T; label: ReactNode; tone?: 'good' | 'ok' | 'bad' }[];
  onChange: (v: T | null) => void;
  label: string;
  allowClear?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1.5', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active && allowClear ? null : o.value)}
            className={cn(
              'flex-1 rounded-lg border font-semibold transition-colors',
              size === 'sm' ? 'h-9 px-1 text-xs' : 'h-11 px-2 text-sm',
              active
                ? o.tone === 'bad'
                  ? 'border-danger bg-danger/15 text-danger'
                  : o.tone === 'ok'
                    ? 'border-warning bg-warning/15 text-warning'
                    : o.tone === 'good'
                      ? 'border-success bg-success/15 text-success'
                      : 'border-primary bg-primary/20 text-foreground'
                : 'border-input text-muted-foreground hover:bg-secondary'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" />
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">Your training data is stored safely on this device. Reloading usually fixes this.</p>
        <pre className="max-w-full overflow-auto rounded-xl bg-card p-3 text-left text-xs text-muted-foreground">{this.state.error.message}</pre>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.hash = '#/';
              this.setState({ error: null });
            }}
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    );
  }
}
