import { Settings } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-xl" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="AJM Creator Intelligence home">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-[11px] font-black tracking-tight text-white">AJM</span>
          <span className="text-[14px] font-semibold tracking-tight text-ink">Creator Intelligence</span>
        </Link>
        <Link href="/settings" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label="Settings">
          <Settings size={20} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
