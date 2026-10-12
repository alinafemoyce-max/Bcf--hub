import * as React from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-lg border border-line-strong bg-white px-3.5 text-base text-ink placeholder:text-subtle shadow-[inset_0_1px_1px_rgb(16_36_58/0.04)] transition-colors focus:border-marine focus:outline-none focus:ring-3 focus:ring-accent/25 disabled:bg-surface disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { suffix?: string }>(
  ({ className, suffix, ...props }, ref) =>
    suffix ? (
      <div className="relative">
        <input ref={ref} className={cn(control, 'h-12 pr-12', className)} {...props} />
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-medium text-muted">
          {suffix}
        </span>
      </div>
    ) : (
      <input ref={ref} className={cn(control, 'h-12', className)} {...props} />
    )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, 'min-h-24 py-3 leading-relaxed', className)} {...props} />
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-12 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
);
Select.displayName = 'Select';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
  className
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-subtle">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-danger" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Large touch-friendly choice chips (single or multiple selection). */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  multiple,
  name,
  invalid,
  columns,
  allowDeselect
}: {
  options: { value: T; label: string }[];
  value: T | T[] | undefined | '';
  onChange: (value: T | T[] | '') => void;
  multiple?: boolean;
  name: string;
  invalid?: boolean;
  columns?: string;
  allowDeselect?: boolean;
}) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={name}
      aria-invalid={invalid || undefined}
      className={cn('grid gap-2', columns ?? 'grid-cols-2 sm:grid-cols-3')}
    >
      {options.map((o) => {
        const isOn = selected(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={isOn}
            onClick={() => {
              if (multiple) {
                const list = Array.isArray(value) ? value : [];
                onChange(isOn ? list.filter((v) => v !== o.value) : [...list, o.value]);
              } else {
                onChange(isOn && allowDeselect ? '' : o.value);
              }
            }}
            className={cn(
              'flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-[15px] font-medium transition-colors',
              isOn
                ? 'border-marine bg-marine-50 text-navy ring-1 ring-marine'
                : 'border-line-strong bg-white text-ink hover:border-subtle',
              invalid && !isOn && 'border-danger/60'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-5 shrink-0 place-items-center border',
                multiple ? 'rounded-[5px]' : 'rounded-full',
                isOn ? 'border-marine bg-marine text-white' : 'border-line-strong bg-white'
              )}
            >
              {isOn && (multiple ? <Check /> : <span className="size-2 rounded-full bg-white" />)}
            </span>
            <span className="min-w-0 leading-tight">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
