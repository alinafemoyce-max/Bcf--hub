'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ChevronRight, Clock, Inbox, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/form';
import { PriorityBadge, RequestedUrgentFlag, STATUS_STYLE, StatusBadge } from '@/components/status';
import { ItemLines } from '@/components/order-items';
import { OrderDetail } from './order-detail';
import { fetcher } from '@/lib/client';
import { OPEN_STATUSES, type OrderStatus } from '@/lib/domain';
import { formatUkDate, formatUkTime, relativeTime } from '@/lib/format';
import type { OperatorOrder, StatusCounts } from '@/lib/types';
import { cn } from '@/lib/utils';

type Res = {
  orders: OperatorOrder[];
  summary: StatusCounts;
  newest: { id: string; reference: string } | null;
  serverTime: string;
};

const FILTERS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'active', label: 'All active', statuses: OPEN_STATUSES },
  { key: 'new', label: 'New', statuses: ['submitted'] },
  { key: 'clarification', label: 'Clarification', statuses: ['clarification_required'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { key: 'in_progress', label: 'In progress', statuses: ['in_progress'] },
  { key: 'ready', label: 'Ready', statuses: ['ready'] },
  { key: 'completed', label: 'Completed', statuses: ['collected'] },
  { key: 'closed', label: 'Rejected / cancelled', statuses: ['rejected', 'cancelled'] },
  { key: 'all', label: 'All orders', statuses: [] }
];

const CARDS: { key: string; label: string; status: OrderStatus }[] = [
  { key: 'new', label: 'New Requests', status: 'submitted' },
  { key: 'clarification', label: 'Awaiting Clarification', status: 'clarification_required' },
  { key: 'accepted', label: 'Accepted', status: 'accepted' },
  { key: 'in_progress', label: 'In Progress', status: 'in_progress' },
  { key: 'ready', label: 'Ready for Collection', status: 'ready' },
  { key: 'completed', label: 'Completed', status: 'collected' }
];

const DESKTOP_QUERY = '(min-width: 1024px)';

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );
}

export function OperatorDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const isDesktop = useIsDesktop();
  const [filter, setFilter] = useState(params.get('filter') ?? 'active');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [chosenId, setSelectedId] = useState<string | null>(params.get('order'));
  const [highlight, setHighlight] = useState<string | null>(null);
  const newestSeen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? OPEN_STATUSES;
  const url = `/api/orders?status=${statuses.join(',')}&q=${encodeURIComponent(debounced)}`;
  const { data, error, mutate } = useSWR<Res>(url, fetcher, { refreshInterval: 4000, keepPreviousData: true });

  // Announce orders that arrive while the dashboard is open.
  useEffect(() => {
    if (!data) return;
    const newest = data.newest?.id ?? null;
    if (newestSeen.current !== undefined && newest && newest !== newestSeen.current) {
      toast.info(`New request received: ${data.newest!.reference}`, { duration: 8000 });
      setHighlight(newest);
      setTimeout(() => setHighlight(null), 10000);
    }
    newestSeen.current = newest;
  }, [data]);

  const orders = useMemo(() => data?.orders ?? [], [data]);
  // On a laptop, show the first order when none is chosen so the detail panel is never empty.
  const selectedId = chosenId ?? (isDesktop ? (orders[0]?.id ?? null) : null);
  const selectedIndex = orders.findIndex((o) => o.id === selectedId);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const q = new URLSearchParams(window.location.search);
      if (id) q.set('order', id);
      else q.delete('order');
      router.replace(`/operator${q.toString() ? `?${q}` : ''}`, { scroll: false });
    },
    [router]
  );

  const chooseFilter = (key: string) => {
    setFilter(key);
    const q = new URLSearchParams(window.location.search);
    q.set('filter', key);
    router.replace(`/operator?${q}`, { scroll: false });
  };

  const counts = data?.summary.counts;
  const now = data ? new Date(data.serverTime) : new Date();

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {CARDS.map((c) => {
          const Icon = STATUS_STYLE[c.status].icon;
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => chooseFilter(active ? 'active' : c.key)}
              aria-pressed={active}
              data-testid={`summary-${c.status}`}
              className={cn(
                'rounded-xl border bg-white p-4 text-left shadow-card transition-colors',
                active ? 'border-marine ring-1 ring-marine' : 'border-line hover:border-line-strong'
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-semibold leading-tight text-muted">{c.label}</span>
                <Icon className="size-[18px] shrink-0 text-subtle" aria-hidden />
              </span>
              <span className="mt-2 block text-[30px] font-bold leading-none tracking-tight text-navy tabular" data-testid={`count-${c.status}`}>
                {counts ? counts[c.status] : '–'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:items-start">
        {/* Queue */}
        <section aria-label="Order queue" className="min-w-0 space-y-3">
          <div className="space-y-3 rounded-xl border border-line bg-white p-3 shadow-card">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, name, clock no., material…"
                className="pl-11"
                aria-label="Search orders"
                data-testid="queue-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter by status">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => chooseFilter(f.key)}
                  className={cn(
                    'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                    filter === f.key ? 'bg-navy text-white' : 'bg-surface text-muted hover:text-ink'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-muted">
            <span>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} · sorted by priority, then oldest first
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', error ? 'bg-danger' : 'bg-ok')} aria-hidden />
              {error ? 'Reconnecting…' : 'Live'}
            </span>
          </div>

          {!data && !error && <div className="h-64 animate-pulse rounded-xl bg-white shadow-card" />}
          {error && !data && <p className="rounded-xl bg-white p-5 text-sm text-danger shadow-card">{(error as Error).message}</p>}
          {data && !orders.length && (
            <div className="rounded-xl border border-dashed border-line-strong bg-white p-10 text-center">
              <Inbox className="mx-auto size-8 text-subtle" aria-hidden />
              <p className="mt-2 font-semibold text-navy">No orders here</p>
              <p className="text-sm text-muted">{debounced ? 'Try a different search.' : 'Nothing in this view right now.'}</p>
            </div>
          )}

          <ul className="space-y-2.5" data-testid="queue">
            {orders.map((o, i) => {
              const selected = isDesktop && o.id === selectedId;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[17px] font-bold tracking-tight text-navy tabular">{o.reference}</span>
                        {o.approvedPriority && o.approvedPriority !== 'normal' && <PriorityBadge priority={o.approvedPriority} />}
                        {!o.approvedPriority && o.requestedPriority === 'urgent' && <RequestedUrgentFlag />}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink">
                        <span className="font-semibold">{o.requesterName}</span>{' '}
                        <span className="text-muted tabular">· {o.requesterClock}</span>
                      </p>
                    </div>
                    <StatusBadge status={o.status} size="sm" />
                  </div>
                  <p className="mt-1 truncate text-[13px] text-muted">
                    {o.department} · {o.productionLine}
                  </p>
                  <div className="mt-2.5">
                    <ItemLines items={o.items} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[13px]">
                    <span className="flex items-center gap-1.5 text-muted tabular">
                      <Clock className="size-3.5" aria-hidden />
                      {formatUkDate(o.submittedAt)} {formatUkTime(o.submittedAt)}
                      <span className="hidden sm:inline">· {relativeTime(o.submittedAt, now)}</span>
                    </span>
                    <span className="flex items-center gap-0.5 font-semibold text-marine">
                      {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                      <span className="ml-2 inline-flex items-center rounded-md bg-marine px-2.5 py-1 text-xs text-white lg:hidden">
                        View Order <ChevronRight className="size-3.5" aria-hidden />
                      </span>
                    </span>
                  </div>
                </>
              );
              const cls = cn(
                'block w-full rounded-xl border bg-white p-4 text-left shadow-card transition-colors',
                selected ? 'border-marine ring-2 ring-marine/60' : 'border-line hover:border-line-strong',
                highlight === o.id && 'ring-2 ring-accent'
              );
              return (
                <li key={o.id} data-testid="queue-item" data-reference={o.reference} data-status={o.status} data-index={i}>
                  {isDesktop ? (
                    <button type="button" className={cls} onClick={() => select(o.id)} aria-current={selected || undefined}>
                      {content}
                    </button>
                  ) : (
                    <Link href={`/operator/orders/${o.id}`} className={cls}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Detail panel (laptop) */}
        <section aria-label="Order details" className="hidden min-w-0 lg:block">
          {isDesktop && selectedId ? (
            <OrderDetail
              key={selectedId}
              orderId={selectedId}
              initial={orders.find((o) => o.id === selectedId)}
              onChanged={() => mutate()}
              onPrev={selectedIndex > 0 ? () => select(orders[selectedIndex - 1].id) : undefined}
              onNext={selectedIndex >= 0 && selectedIndex < orders.length - 1 ? () => select(orders[selectedIndex + 1].id) : undefined}
            />
          ) : (
            <div className="grid h-80 place-items-center rounded-xl border border-dashed border-line-strong bg-white text-sm text-muted">
              Select an order to view its cutting specification.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
