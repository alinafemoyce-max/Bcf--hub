'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cx, Input, Spinner } from './ui';

const OPTIONS = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' }
];

export function RangeFilter({ current, from, to }: { current: string; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [showCustom, setShowCustom] = useState(current === 'custom');
  const [f, setF] = useState(from ?? '');
  const [t, setT] = useState(to ?? '');

  function go(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Date range">
          {OPTIONS.map((o) => {
            const active = o.key === 'custom' ? showCustom || current === 'custom' : current === o.key && !showCustom;
            return (
              <button
                key={o.key}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (o.key === 'custom') setShowCustom(true);
                  else {
                    setShowCustom(false);
                    go({ range: o.key, from: null, to: null });
                  }
                }}
                className={cx('h-9 flex-1 rounded-lg text-[13px] font-medium transition-colors', active ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2')}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {pending && <Spinner className="text-ink-3" />}
      </div>
      {showCustom && (
        <form
          className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (f) go({ range: 'custom', from: f, to: t || null });
          }}
        >
          <label className="text-[12px] text-ink-3">
            From
            <Input type="date" value={f} onChange={(e) => setF(e.target.value)} required className="mt-1" />
          </label>
          <label className="text-[12px] text-ink-3">
            To
            <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="mt-1" />
          </label>
          <button type="submit" className="h-11 rounded-xl bg-accent px-4 text-[14px] font-medium text-white">
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
