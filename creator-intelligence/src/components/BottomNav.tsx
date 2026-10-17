'use client';

import { Home, Lightbulb, Sparkles, Upload, Video } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from './ui';

const ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/videos', label: 'Videos', icon: Video },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/strategist', label: 'Strategist', icon: Sparkles },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb }
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx('flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
              >
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-accent' : undefined} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
