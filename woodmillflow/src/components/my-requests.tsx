'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, ClipboardPlus, Inbox } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status';
import { ItemLines } from '@/components/order-items';
import { api, savedTokens } from '@/lib/client';
import { formatUkDate, formatUkTime, relativeTime } from '@/lib/format';
import type { TrackedOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

type Res = { orders: (TrackedOrder & { trackingToken: string })[]; serverTime: string };

export function MyRequests({ demoEmployee }: { demoEmployee: boolean }) {
  // Tokens are read from this device's storage inside the fetcher (client-only).
  const { data, error } = useSWR<Res>('/api/my-requests', () => api<Res>('/api/my-requests', { body: { tokens: savedTokens() } }), {
    refreshInterval: 8000
  });

  if (error) return <p className="text-danger">{(error as Error).message}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-white shadow-card" />;

  if (!data.orders.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Inbox className="mx-auto size-10 text-subtle" aria-hidden />
          <h2 className="mt-3 font-semibold text-navy">No requests on this device yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Requests you submit from this phone or computer appear here.
            {!demoEmployee && ' Switch to the Employee demo role to see Alex Taylor’s sample requests.'}
          </p>
          <Link href="/request" className={cn(buttonVariants({ size: 'lg' }), 'mt-5')}>
            <ClipboardPlus aria-hidden /> New Request
          </Link>
        </CardContent>
      </Card>
    );
  }

  const now = new Date(data.serverTime);
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="my-requests">
      {data.orders.map((o) => (
        <li key={o.trackingToken}>
          <Link
            href={`/track/${o.trackingToken}`}
            className="group block rounded-xl border border-line bg-white p-4 shadow-card transition-colors hover:border-marine/50 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold tracking-tight text-navy tabular">{o.reference}</p>
                <p className="text-sm text-muted tabular">
                  {formatUkDate(o.submittedAt)} at {formatUkTime(o.submittedAt)} · {o.productionLine}
                </p>
              </div>
              <StatusBadge status={o.status} size="sm" />
            </div>
            <div className="mt-3">
              <ItemLines items={o.items} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="text-muted">Updated {relativeTime(o.updatedAt, now)}</span>
              <span className="flex items-center gap-1 font-semibold text-marine">
                Track <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
