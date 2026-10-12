'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  BookOpen,
  ClipboardList,
  ClipboardPlus,
  Factory,
  Home,
  Menu,
  QrCode,
  Settings2,
  type LucideIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { DemoNotice, Wordmark } from './brand';
import { Dialog, DialogContent } from './ui/dialog';
import { cn } from '@/lib/utils';
import { switchRole } from '@/lib/client';
import { DEMO_EMPLOYEE, DEMO_OPERATOR } from '@/lib/config';

export type ShellRole = 'employee' | 'operator' | null;

interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
}

const NAV: { heading: string; items: NavItem[] }[] = [
  { heading: '', items: [{ href: '/', label: 'Home', icon: Home }] },
  {
    heading: 'Employee',
    items: [
      { href: '/request', label: 'New Request', short: 'Request', icon: ClipboardPlus },
      { href: '/requests', label: 'My Requests', short: 'My requests', icon: ClipboardList }
    ]
  },
  { heading: 'Woodmill', items: [{ href: '/operator', label: 'Work Queue', short: 'Queue', icon: Factory }] },
  {
    heading: 'Demonstration',
    items: [
      { href: '/qr', label: 'QR Code & Poster', icon: QrCode },
      { href: '/guide', label: 'Presentation Guide', icon: BookOpen },
      { href: '/demo', label: 'Demo Settings', icon: Settings2 }
    ]
  }
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/request') return pathname === '/request';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RoleSwitch({ role, compact, onSwitched }: { role: ShellRole; compact?: boolean; onSwitched?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const change = (next: 'employee' | 'operator') => {
    if (next === role) return;
    start(async () => {
      try {
        await switchRole(next);
        toast.success(next === 'operator' ? `Now viewing as ${DEMO_OPERATOR.name} (Woodmill Operator)` : `Now viewing as ${DEMO_EMPLOYEE.name} (Employee)`);
        onSwitched?.();
        router.push(next === 'operator' ? '/operator' : '/request');
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };
  return (
    <div
      role="radiogroup"
      aria-label="Demo role"
      className={cn('inline-flex rounded-lg bg-surface p-1 ring-1 ring-line', pending && 'opacity-60', compact ? 'w-full' : '')}
    >
      {(['employee', 'operator'] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={role === r}
          disabled={pending}
          data-testid={`role-${r}`}
          onClick={() => change(r)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors',
            compact && 'py-2.5 text-sm',
            role === r ? 'bg-white text-navy shadow-card ring-1 ring-line' : 'text-muted hover:text-ink'
          )}
        >
          {r === 'employee' ? 'Employee' : 'Woodmill Operator'}
        </button>
      ))}
    </div>
  );
}

function RoleIdentity({ role }: { role: ShellRole }) {
  if (!role) return <span className="text-sm text-muted">Choose a demo role</span>;
  const who = role === 'operator' ? DEMO_OPERATOR : DEMO_EMPLOYEE;
  const sub = role === 'operator' ? DEMO_OPERATOR.role : `Clock ${DEMO_EMPLOYEE.clockNumber} · ${DEMO_EMPLOYEE.department}`;
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-full bg-navy text-[13px] font-bold text-white">
        {who.name.split(' ').map((p) => p[0]).join('')}
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-ink">{who.name}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </span>
  );
}

export function AppShell({ role, children }: { role: ShellRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const focusMode = pathname === '/request';

  const bottom: NavItem[] = [
    { href: '/request', label: 'Request', icon: ClipboardPlus },
    { href: '/requests', label: 'My requests', icon: ClipboardList },
    { href: '/operator', label: 'Queue', icon: Factory }
  ];

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy text-white lg:flex">
        <Link href="/" className="flex h-16 items-center px-5">
          <Wordmark inverted />
        </Link>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV.map((group) => (
            <div key={group.heading || 'root'}>
              {group.heading && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{group.heading}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] font-medium transition-colors',
                          active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <item.icon className={cn('size-[18px]', active ? 'text-accent' : '')} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs leading-relaxed text-white/50">
          Independent concept demonstration using fictional data. Not an official Sunseeker system.
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16">
          <Link href="/" className="lg:hidden" aria-label="WoodmillFlow home">
            <Wordmark />
          </Link>
          <div className="hidden lg:block">
            <DemoNotice />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-4 md:flex">
              <RoleIdentity role={role} />
              <RoleSwitch role={role} />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-11 place-items-center rounded-lg text-ink hover:bg-surface md:hidden"
              aria-label="Open menu"
              data-testid="mobile-menu"
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
        <div className="border-t border-line bg-warn-50/60 px-3 py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.02em] text-warn lg:hidden">
          Independent Concept Demonstration — Fictional Data
        </div>
      </header>

      <main className={cn('mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-8', focusMode ? 'pb-28' : 'pb-28 lg:pb-10')}>
        {children}
      </main>

      {/* Mobile bottom navigation */}
      {!focusMode && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-safe lg:hidden" aria-label="Quick">
          <ul className="grid grid-cols-4">
            {bottom.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-16 flex-col items-center justify-center gap-1 text-[11.5px] font-semibold',
                      active ? 'text-marine' : 'text-muted'
                    )}
                  >
                    <item.icon className="size-6" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11.5px] font-semibold text-muted"
              >
                <Menu className="size-6" aria-hidden />
                More
              </button>
            </li>
          </ul>
        </nav>
      )}

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent title="WoodmillFlow" description="Independent concept demonstration — fictional data">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Demo role</p>
              <RoleIdentity role={role} />
              <RoleSwitch role={role} compact onSwitched={() => setMenuOpen(false)} />
            </div>
            <nav className="grid gap-1" aria-label="Menu">
              {NAV.flatMap((g) => g.items).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium',
                    isActive(pathname, item.href) ? 'bg-marine-50 text-navy' : 'text-ink hover:bg-surface'
                  )}
                >
                  <item.icon className="size-5 text-marine" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
