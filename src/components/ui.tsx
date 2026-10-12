import { useEffect, useId, useRef, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { useRouter } from '../state/router';
import type { IssueStatus, Priority, UpdateStatus, MeetingStatus } from '../types';

// ---------------------------------------------------------------- Layout

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  large
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string; // fallback route for the back button
  actions?: ReactNode;
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <header className={`page-header ${large ? 'page-header-large' : ''}`}>
      <div className="page-header-bar">
        {back !== undefined ? (
          <button className="icon-btn back-btn" onClick={() => router.back(back)} aria-label="Back">
            <Icon name="chevronLeft" size={22} />
          </button>
        ) : (
          <span className="header-spacer" />
        )}
        {!large && <h1 className="page-title-small">{title}</h1>}
        <div className="header-actions">{actions}</div>
      </div>
      {large && (
        <div className="page-header-large-title">
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

export function Section({ title, action, children, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      {(title || action) && (
        <div className="section-head">
          {title && <h2 id={id}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Badges

const STATUS_TONE: Record<IssueStatus, string> = {
  New: 'neutral',
  'Under Review': 'violet',
  'Raised with Management': 'blue',
  'Awaiting Response': 'amber',
  'In Progress': 'cyan',
  Resolved: 'green',
  Closed: 'muted'
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  return <span className={`badge badge-${STATUS_TONE[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`prio prio-${priority.toLowerCase()}`}>
      <span className="prio-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {priority}
    </span>
  );
}

const UPDATE_TONE: Record<UpdateStatus, string> = { Draft: 'neutral', Approved: 'blue', Published: 'green' };
export function UpdateStatusBadge({ status }: { status: UpdateStatus }) {
  return <span className={`badge badge-${UPDATE_TONE[status]}`}>{status}</span>;
}

const MEETING_TONE: Record<MeetingStatus, string> = { Planned: 'blue', Completed: 'green', Cancelled: 'muted' };
export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <span className={`badge badge-${MEETING_TONE[status]}`}>{status}</span>;
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="badge badge-demo" title="Fictional demonstration data">
      Demo
    </span>
  );
}

export function OverdueBadge({ days }: { days: number }) {
  return (
    <span className="badge badge-red">
      <Icon name="alert" size={12} /> Overdue{days > 0 ? ` ${days}d` : ''}
    </span>
  );
}

// ---------------------------------------------------------------- Form fields

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : '';
  const errId = error ? `${id}-err` : '';
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children(id, describedBy)}
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-msg" id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
};

export function TextField({ label, value, onChange, error, hint, required, ...rest }: InputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(id, d) => (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={d} aria-required={required} {...rest} />
      )}
    </FieldShell>
  );
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
};

export function TextArea({ label, value, onChange, error, hint, required, rows = 4, ...rest }: AreaProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(id, d) => (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={d} aria-required={required} {...rest} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  required,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(id, d) => (
        <div className="select-wrap">
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={d} aria-required={required}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => {
              const v = typeof o === 'string' ? o : o.value;
              const l = typeof o === 'string' ? o : o.label;
              return (
                <option key={v} value={v}>
                  {l}
                </option>
              );
            })}
          </select>
          <Icon name="chevronDown" size={16} className="select-chevron" />
        </div>
      )}
    </FieldShell>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Icon name="search" size={18} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} enterKeyHint="search" />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Sheet (modal)

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} tabIndex={-1}>
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Stat({ label, value, tone, icon, onClick, sub }: { label: string; value: ReactNode; tone?: string; icon: IconName; onClick?: () => void; sub?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat stat-${tone ?? 'default'}`} onClick={onClick}>
      <span className="stat-icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
      {onClick && <Icon name="chevronRight" size={16} className="stat-chevron" />}
    </Tag>
  );
}
