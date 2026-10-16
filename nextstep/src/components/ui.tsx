import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SECTORS, sectorShort } from '../data/catalog';
import { career } from '../lib/data';
import { back, go } from '../state/router';
import { useStore } from '../state/store';
import { BrandMark, Icon } from './Icon';

// ── Top bar ─────────────────────────────────────────────────────────────────
export function TopBar({ title, backTo, right, brand }: { title?: string; backTo?: string; right?: ReactNode; brand?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
      <div className="topbar-inner">
        <div className="topbar-slot">
          {brand ? (
            <a className="brand" href="#/" aria-label="NextStep home">
              <BrandMark />
              <span>NextStep</span>
            </a>
          ) : backTo !== undefined ? (
            <button className="icon-btn" onClick={() => back(backTo)} aria-label="Back">
              <Icon name="back" />
            </button>
          ) : null}
        </div>
        <h1 className="topbar-title">{brand ? '' : title}</h1>
        <div className="topbar-slot right">{right}</div>
      </div>
    </header>
  );
}

// ── Tab bar ─────────────────────────────────────────────────────────────────
const TABS = [
  { href: '/paths', label: 'My paths', icon: 'compass', match: ['paths', 'career', 'plan', 'start'] },
  { href: '/explore', label: 'Explore', icon: 'search', match: ['explore', 'discover', 'compare'] },
  { href: '/map', label: 'Map', icon: 'map', match: ['map'] },
  { href: '/saved', label: 'Saved', icon: 'star', match: ['saved'] },
  { href: '/about', label: 'More', icon: 'more', match: ['about'] }
];
export function TabBar({ section }: { section: string }) {
  return (
    <nav className="tabbar no-print" aria-label="Main">
      {TABS.map((t) => {
        const on = t.match.includes(section);
        return (
          <a key={t.href} className={`tab${on ? ' on' : ''}`} href={`#${t.href}`} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────
export const Verified = ({ children = 'Checked source' }: { children?: ReactNode }) => <span className="badge badge-verified">{children}</span>;
export const Typical = ({ children = 'Typical route' }: { children?: ReactNode }) => <span className="badge badge-typical">{children}</span>;
export const Idea = ({ children = 'Suggestion' }: { children?: ReactNode }) => <span className="badge badge-idea">{children}</span>;

export function Notice({ children, tone, icon = 'info' }: { children: ReactNode; tone?: 'amber'; icon?: string }) {
  return (
    <div className={`notice${tone ? ` ${tone}` : ''}`} role="note">
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export const sectorEmoji = (id: string) => SECTORS.find((s) => s.id === id)?.emoji ?? '✨';

// ── Career card ─────────────────────────────────────────────────────────────
export function CareerCard({ slug, reason, tag, compact }: { slug: string; reason?: string; tag?: ReactNode; compact?: boolean }) {
  const c = career(slug);
  if (!c) return null;
  return (
    <a className="card ccard" href={`#/career/${slug}`}>
      <div className="ccard-top">
        <div className="ccard-emoji" aria-hidden="true">
          {sectorEmoji(c.cat.sector)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ccard-title">{c.title}</div>
          <div className="ccard-meta" style={{ marginTop: 4 }}>
            <span className="pill">{sectorShort(c.cat.sector)}</span>
            {tag}
          </div>
        </div>
        <SaveButton slug={slug} small />
      </div>
      {!compact && <p className="ccard-reason">{reason ?? c.summary}</p>}
    </a>
  );
}

export function SaveButton({ slug, small }: { slug: string; small?: boolean }) {
  const { state, toggleSaved } = useStore();
  const toast = useToast();
  const saved = state.saved.includes(slug);
  const title = career(slug)?.title ?? 'career';
  return (
    <button
      className={`icon-btn${saved ? ' accent' : ''}`}
      style={small ? { marginRight: -8, marginTop: -6 } : undefined}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggleSaved(slug);
        toast(added ? 'Saved to your shortlist' : 'Removed from saved');
      }}
    >
      <Icon name="star" filled={saved} />
    </button>
  );
}

// ── Option (onboarding / questionnaire) ─────────────────────────────────────
export function Option({ on, onClick, title, hint, emoji, multi }: { on: boolean; onClick: () => void; title: string; hint?: string; emoji?: string; multi?: boolean }) {
  return (
    <button type="button" className={`option${on ? ' on' : ''}`} onClick={onClick} role={multi ? 'checkbox' : 'radio'} aria-checked={on}>
      {emoji && (
        <span className="option-emoji" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="option-text">
        <span className="option-title">{title}</span>
        {hint && <span className="option-hint">{hint}</span>}
      </span>
      <span className="option-check" aria-hidden="true">
        <Icon name="check" />
      </span>
    </button>
  );
}

// ── Bottom sheet ────────────────────────────────────────────────────────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="h2" style={{ flex: 1 }}>
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const show = useCallback((text: string) => setMsg({ text, key: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="sr-only">
        {msg?.text}
      </div>
      {msg && (
        <div className="toast" key={msg.key} aria-hidden="true">
          {msg.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ── Links ───────────────────────────────────────────────────────────────────
export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function LinkButton({ to, children, kind = 'secondary', block, small }: { to: string; children: ReactNode; kind?: 'primary' | 'secondary' | 'ghost'; block?: boolean; small?: boolean }) {
  return (
    <a className={`btn btn-${kind}${block ? ' btn-block' : ''}${small ? ' btn-sm' : ''}`} href={`#${to}`} onClick={(e) => (e.preventDefault(), go(to))}>
      {children}
    </a>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden="true">
        {emoji}
      </div>
      <p className="h3" style={{ color: 'var(--text)', marginBottom: 6 }}>
        {title}
      </p>
      {children}
    </div>
  );
}
