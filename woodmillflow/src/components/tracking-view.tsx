'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import { AlertTriangle, Ban, HelpCircle, MessageSquare, PackageCheck, RefreshCw, Send, XCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form';
import { StatusBadge } from '@/components/status';
import { StatusTimeline } from '@/components/timeline';
import { ItemSpecTable } from '@/components/order-items';
import { Meta, MetaGrid, RequiredDate, SubmittedAt } from '@/components/order-meta';
import { api, ApiError, fetcher, saveToken } from '@/lib/client';
import { COLLECTION_POINT } from '@/lib/config';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/domain';
import { formatUkDateTime, formatUkTime, relativeTime } from '@/lib/format';
import type { TrackedOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

type Res = { order: TrackedOrder; serverTime: string };

export function TrackingView({ token }: { token: string }) {
  const { data, error, isValidating, mutate } = useSWR<Res>(`/api/track/${token}`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    onSuccess: () => saveToken(token)
  });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (error && !data) {
    const notFound = (error as ApiError).status === 404;
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="text-center">
          <XCircle className="mx-auto size-10 text-subtle" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-navy">{notFound ? 'Order not found' : 'Unable to load this order'}</h2>
          <p className="mt-1 text-sm text-muted">
            {notFound
              ? 'This tracking link is not valid. It may have been mistyped, or the demonstration data has been reset.'
              : (error as Error).message}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {!notFound && <Button onClick={() => mutate()}>Try again</Button>}
            <Link href="/requests" className={buttonVariants({ variant: 'secondary' })}>
              My requests
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <TrackingSkeleton />;
  const o = data.order;
  const last = o.history.at(-1);
  const lastMessage = [...o.history].reverse().find((h) => h.comment && h.changedByRole === 'operator');
  const messages = o.history.filter((h) => h.comment);

  const refresh = async () => {
    await mutate();
    setLastChecked(new Date());
  };

  const sendReply = async () => {
    if (reply.trim().length < 2) return setReplyError('Enter a reply');
    setBusy(true);
    try {
      const res = await api<{ order: TrackedOrder }>(`/api/track/${token}`, { body: { action: 'reply', message: reply } });
      await mutate({ order: res.order, serverTime: new Date().toISOString() }, { revalidate: false });
      setReply('');
      setReplyError(undefined);
      toast.success('Reply sent to the woodmill');
    } catch (e) {
      toast.error((e as Error).message);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await api<{ order: TrackedOrder }>(`/api/track/${token}`, { body: { action: 'cancel' } });
      await mutate({ order: res.order, serverTime: new Date().toISOString() }, { revalidate: false });
      setCancelOpen(false);
      toast.success('Request cancelled');
    } catch (e) {
      toast.error((e as Error).message);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 space-y-5">
        {/* Status header */}
        <Card className="overflow-hidden">
          <div className="bg-navy px-5 py-5 text-white sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Order reference</p>
                <p className="text-[26px] font-bold tracking-tight tabular" data-testid="tracking-reference">
                  {o.reference}
                </p>
              </div>
              <StatusBadge status={o.status} size="lg" className="ring-white/30" />
            </div>
            <p className="mt-3 text-sm text-white/70" data-testid="tracking-status-text">
              Current status: <span className="font-semibold text-white">{STATUS_LABELS[o.status]}</span>
              {last && (
                <>
                  {' '}· updated {formatUkDateTime(last.changedAt)} ({relativeTime(last.changedAt, new Date(data.serverTime))})
                </>
              )}
            </p>
          </div>

          {o.status === 'ready' && (
            <Banner tone="ok" icon={PackageCheck} title="Ready for collection" testId="ready-banner">
              Your materials are ready. Please collect them from {COLLECTION_POINT} and quote <strong>{o.reference}</strong>.
              {lastMessage?.newStatus === 'ready' && lastMessage.comment && <span className="mt-1 block">Woodmill note: “{lastMessage.comment}”</span>}
            </Banner>
          )}
          {o.status === 'clarification_required' && (
            <Banner tone="warn" icon={HelpCircle} title="The woodmill has a question">
              {lastMessage?.comment ?? 'Please contact the woodmill.'}
            </Banner>
          )}
          {o.status === 'rejected' && (
            <Banner tone="danger" icon={AlertTriangle} title="This request was not accepted">
              {lastMessage?.comment}
            </Banner>
          )}
          {o.status === 'cancelled' && (
            <Banner tone="muted" icon={Ban} title="This request was cancelled">
              {last?.comment}
            </Banner>
          )}

          {o.status === 'clarification_required' && (
            <div className="space-y-3 border-t border-line px-5 py-4 sm:px-6">
              <Field label="Reply to the woodmill" htmlFor="reply" error={replyError}>
                <Textarea id="reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder="Type your answer…" />
              </Field>
              <Button onClick={sendReply} loading={busy}>
                <Send aria-hidden /> Send reply
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className={cn('size-2 rounded-full', error ? 'bg-danger' : 'bg-ok')} aria-hidden />
              {error ? 'Connection problem — retrying' : 'Updates automatically every few seconds'}
              {lastChecked && <span className="tabular">· checked {formatUkTime(lastChecked)}</span>}
            </p>
            <Button variant="secondary" size="sm" onClick={refresh} data-testid="refresh-tracking">
              <RefreshCw className={cn(isValidating && 'animate-spin')} aria-hidden /> Refresh
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <MetaGrid>
              <Meta label="Requested by">{o.requesterName}</Meta>
              <Meta label="Clock number">
                <span className="tabular">{o.requesterClock}</span>
              </Meta>
              <Meta label="Department">{o.department}</Meta>
              <Meta label="Production line">{o.productionLine}</Meta>
              <Meta label="Hull reference">{o.hullReference ?? <span className="font-normal text-subtle">—</span>}</Meta>
              <Meta label="Submitted">
                <SubmittedAt value={o.submittedAt} />
              </Meta>
              <Meta label="Date required">
                <RequiredDate value={o.dateRequired} />
              </Meta>
              <Meta label="Priority">
                {o.approvedPriority ? PRIORITY_LABELS[o.approvedPriority] : 'Not yet set by woodmill'}
                {o.requestedPriority === 'urgent' && <span className="block text-xs font-normal text-muted">You requested: Urgent</span>}
              </Meta>
            </MetaGrid>
            {o.notes && (
              <div className="rounded-lg border border-line bg-surface px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Additional instructions</p>
                <p className="mt-1 whitespace-pre-wrap">{o.notes}</p>
              </div>
            )}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-navy">Cutting items ({o.items.length})</h3>
              <ItemSpecTable items={o.items} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5 lg:sticky lg:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline status={o.status} history={o.history} />
          </CardContent>
        </Card>

        {messages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-[18px] text-marine" aria-hidden /> Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {messages.map((m) => (
                  <li key={m.id} className={cn('rounded-lg px-3.5 py-2.5 text-sm', m.changedByRole === 'operator' ? 'bg-marine-50' : 'bg-surface')}>
                    <p className="text-xs font-semibold text-muted">
                      {m.changedByRole === 'operator' ? 'Woodmill' : 'You'} · <span className="tabular">{formatUkDateTime(m.changedAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-ink">{m.comment}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {(o.status === 'submitted' || o.status === 'clarification_required') && (
          <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
            <Ban aria-hidden /> Cancel this request
          </Button>
        )}
        <Link href="/requests" className={cn(buttonVariants({ variant: 'secondary' }), 'w-full')}>
          View all my requests
        </Link>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title="Cancel this request?" description={`${o.reference} will be withdrawn from the woodmill queue. This cannot be undone.`}>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep request
            </Button>
            <Button variant="dangerSolid" onClick={cancel} loading={busy}>
              Cancel request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  testId
}: {
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  icon: typeof Ban;
  title: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex gap-3 px-5 py-4 sm:px-6',
        tone === 'ok' && 'bg-ok-50 text-ok',
        tone === 'warn' && 'bg-warn-50 text-warn',
        tone === 'danger' && 'bg-danger-50 text-danger',
        tone === 'muted' && 'bg-surface text-muted'
      )}
    >
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="text-sm text-ink">
        <p className="text-[15px] font-semibold text-current">{title}</p>
        {children && <p className="mt-0.5">{children}</p>}
      </div>
    </div>
  );
}

function TrackingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-5" aria-label="Loading order">
      <div className="h-36 rounded-xl bg-white shadow-card" />
      <div className="h-80 rounded-xl bg-white shadow-card" />
    </div>
  );
}
