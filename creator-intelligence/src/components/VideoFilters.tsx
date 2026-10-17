'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CATEGORIES, FORMATS, HOOK_STYLES } from '@/lib/types';
import { cx, Input, Select, Spinner } from './ui';

const FILTER_KEYS = ['category', 'format', 'hook', 'type', 'from', 'to', 'perf', 'dur', 'status'];

export function VideoFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;
  const [open, setOpen] = useState(activeCount > 0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const sel = (key: string, label: string, options: readonly (string | [string, string])[]) => (
    <label className="text-[12px] text-ink-3">
      {label}
      <Select className="mt-1" value={params.get(key) ?? ''} onChange={(e) => update({ [key]: e.target.value || null })}>
        <option value="">Any</option>
        {options.map((o) => {
          const [value, text] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </Select>
    </label>
  );

  return (
    <div className="mb-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <Input
            type="search"
            value={q}
            placeholder="Search titles, topics, hooks"
            className="pl-9"
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => update({ q: v.trim() || null }), 300);
            }}
          />
        </div>
        <button
          onClick={() => setOpen(!open)}
          className={cx('relative grid size-11 place-items-center rounded-xl border', open ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface-2 text-ink-2')}
          aria-expanded={open}
          aria-label="Filters"
        >
          {pending ? <Spinner /> : <SlidersHorizontal size={18} />}
          {activeCount > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">{activeCount}</span>}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 text-[12.5px]">
        <span className="shrink-0 text-ink-3">Sort</span>
        {(
          [
            ['', 'Newest'],
            ['oldest', 'Oldest'],
            ['views', 'Most views'],
            ['least', 'Fewest views'],
            ['engagement', 'Engagement']
          ] as const
        ).map(([value, label]) => {
          const active = (params.get('sort') ?? '') === value;
          return (
            <button
              key={value}
              onClick={() => update({ sort: value || null })}
              className={cx('shrink-0 rounded-full border px-3 py-1.5', active ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line text-ink-3')}
            >
              {label}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2.5 rounded-2xl border border-line bg-surface p-3">
          {sel('category', 'Category', [...CATEGORIES, ['none', 'Uncategorised']])}
          {sel('format', 'Format', FORMATS)}
          {sel('hook', 'Hook style', HOOK_STYLES)}
          {sel('type', 'Record type', [
            ['tracked', 'Tracked'],
            ['historical_basic', 'Historical basic']
          ])}
          {sel('perf', 'Performance', [
            ['top', 'Top 25% by views'],
            ['above', 'Above median'],
            ['below', 'Below median'],
            ['bottom', 'Bottom 25%'],
            ['none', 'No view data']
          ])}
          {sel('dur', 'Duration', [
            ['short', 'Under 15s'],
            ['mid', '15–30s'],
            ['long', '30–60s'],
            ['xl', 'Over 60s'],
            ['unknown', 'Unknown']
          ])}
          <label className="text-[12px] text-ink-3">
            Published from
            <Input type="date" className="mt-1" value={params.get('from') ?? ''} onChange={(e) => update({ from: e.target.value || null })} />
          </label>
          <label className="text-[12px] text-ink-3">
            Published to
            <Input type="date" className="mt-1" value={params.get('to') ?? ''} onChange={(e) => update({ to: e.target.value || null })} />
          </label>
          {sel('status', 'Tracking', [
            ['active', 'Active'],
            ['archived', 'Archived']
          ])}
          <div className="flex items-end">
            <button
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] text-ink-2 hover:bg-surface-2"
              onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}
            >
              <X size={15} /> Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
