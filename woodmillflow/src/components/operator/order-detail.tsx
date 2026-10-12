'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Hammer,
  HelpCircle,
  Lock,
  PackageCheck,
  ThumbsUp,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form';
import { PriorityBadge, RequestedUrgentFlag, StatusBadge } from '@/components/status';
import { ItemSpecTable } from '@/components/order-items';
import { Meta, MetaGrid, RequiredDate, SubmittedAt } from '@/components/order-meta';
import { api, ApiError, fetcher } from '@/lib/client';
import { OPERATOR_PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, type OperatorPriority, type OrderStatus } from '@/lib/domain';
import { formatUkDateTime, relativeTime } from '@/lib/format';
import type { OperatorOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Action {
  to: OrderStatus;
  label: string;
  icon: LucideIcon;
  variant: 'primary' | 'success' | 'secondary' | 'danger';
  /** 'message' = dialog with a required message; 'confirm' = simple confirmation dialog. */
  dialog?: 'message' | 'confirm';
  dialogTitle?: string;
  dialogText?: string;
}

const ACTIONS: Partial<Record<OrderStatus, Action[]>> = {
  submitted: [
    { to: 'accepted', label: 'Accept Request', icon: ThumbsUp, variant: 'primary' },
    { to: 'clarification_required', label: 'Request Clarification', icon: HelpCircle, variant: 'secondary', dialog: 'message', dialogTitle: 'Request clarification', dialogText: 'Your question is shown to the requester on their tracking page.' },
    { to: 'rejected', label: 'Reject Request', icon: XCircle, variant: 'danger', dialog: 'message', dialogTitle: 'Reject this request?', dialogText: 'The requester will see your reason. This cannot be undone.' }
  ],
  clarification_required: [
    { to: 'accepted', label: 'Accept Request', icon: ThumbsUp, variant: 'primary' },
    { to: 'rejected', label: 'Reject Request', icon: XCircle, variant: 'danger', dialog: 'message', dialogTitle: 'Reject this request?', dialogText: 'The requester will see your reason. This cannot be undone.' }
  ],
  accepted: [
    { to: 'in_progress', label: 'Start Cutting', icon: Hammer, variant: 'primary' },
    { to: 'clarification_required', label: 'Request Clarification', icon: HelpCircle, variant: 'secondary', dialog: 'message', dialogTitle: 'Request clarification', dialogText: 'Your question is shown to the requester on their tracking page.' },
    { to: 'cancelled', label: 'Cancel Order', icon: Ban, variant: 'danger', dialog: 'message', dialogTitle: 'Cancel this order?', dialogText: 'The requester will see your reason. This cannot be undone.' }
  ],
  in_progress: [
    { to: 'ready', label: 'Mark Ready for Collection', icon: PackageCheck, variant: 'success' },
    { to: 'clarification_required', label: 'Request Clarification', icon: HelpCircle, variant: 'secondary', dialog: 'message', dialogTitle: 'Request clarification', dialogText: 'Your question is shown to the requester on their tracking page.' },
    { to: 'cancelled', label: 'Cancel Order', icon: Ban, variant: 'danger', dialog: 'message', dialogTitle: 'Cancel this order?', dialogText: 'The requester will see your reason. This cannot be undone.' }
  ],
  ready: [
    { to: 'collected', label: 'Mark Collected', icon: CheckCircle2, variant: 'primary', dialog: 'confirm', dialogTitle: 'Mark as collected?', dialogText: 'Confirm the requester has picked up the materials. This closes the order.' }
  ]
};

type Res = { order: OperatorOrder };

export function OrderDetail({
  orderId,
  initial,
  onChanged,
  onPrev,
  onNext
}: {
  orderId: string;
  initial?: OperatorOrder;
  onChanged?: (order: OperatorOrder) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { data, error, mutate } = useSWR<Res>(`/api/orders/${orderId}`, fetcher, {
    refreshInterval: 5000,
    fallbackData: initial ? { order: initial } : undefined,
    revalidateOnMount: true
  });
  const [comment, setComment] = useState('');
  const [shareComment, setShareComment] = useState(true);
  const [pending, setPending] = useState<OrderStatus | 'priority' | null>(null);
  const [dialog, setDialog] = useState<Action | null>(null);
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogError, setDialogError] = useState<string>();

  if (error && !data) {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted">
          {(error as ApiError).status === 404 ? 'This order no longer exists (the demo may have been reset).' : (error as Error).message}
        </CardContent>
      </Card>
    );
  }
  if (!data) return <div className="h-96 animate-pulse rounded-xl bg-white shadow-card" />;
  const o = data!.order;
  const closed = ['collected', 'rejected', 'cancelled'].includes(o.status);
  const actions = ACTIONS[o.status] ?? [];
  const [primary, ...secondary] = actions;

  const apply = async (action: Action, message?: string) => {
    setPending(action.to);
    try {
      const text = message ?? (comment.trim() || undefined);
      const res = await api<Res>(`/api/orders/${o.id}/status`, {
        body: {
          status: action.to,
          expectedStatus: o.status,
          comment: text,
          commentInternal: message ? false : !shareComment
        }
      });
      await mutate(res, { revalidate: false });
      onChanged?.(res.order);
      setComment('');
      setDialog(null);
      setDialogMessage('');
      toast.success(`${o.reference} → ${STATUS_LABELS[action.to]}`);
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors?.comment) setDialogError(err.fieldErrors.comment);
      toast.error(err.message);
      if (err.status === 409) {
        setDialog(null);
        const fresh = await mutate();
        if (fresh) onChanged?.(fresh.order);
      }
    } finally {
      setPending(null);
    }
  };

  const trigger = (action: Action) => {
    if (action.dialog) {
      setDialog(action);
      setDialogMessage(action.dialog === 'message' ? comment : '');
      setDialogError(undefined);
    } else {
      apply(action);
    }
  };

  const setPriority = async (priority: OperatorPriority) => {
    setPending('priority');
    try {
      const res = await api<Res>(`/api/orders/${o.id}/priority`, { body: { priority } });
      await mutate(res, { revalidate: false });
      onChanged?.(res.order);
      toast.success(`Priority set to ${PRIORITY_LABELS[priority]}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const pieces = o.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-4" data-testid="order-detail" data-order-status={o.status}>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-navy tabular" data-testid="detail-reference">
                {o.reference}
              </h2>
              {o.approvedPriority && o.approvedPriority !== 'normal' && <PriorityBadge priority={o.approvedPriority} />}
              {o.requestedPriority === 'urgent' && !o.approvedPriority && <RequestedUrgentFlag />}
            </div>
            <p className="mt-0.5 text-sm text-muted">
              Updated {relativeTime(o.updatedAt)} · {o.items.length} {o.items.length === 1 ? 'item' : 'items'}, {pieces} pieces
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={o.status} size="lg" />
            {(onPrev || onNext) && (
              <div className="hidden items-center gap-1 lg:flex">
                <Button variant="ghost" size="icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous order">
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" size="icon" onClick={onNext} disabled={!onNext} aria-label="Next order">
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4 border-b border-line bg-surface/70 px-5 py-4 sm:px-6">
          {closed ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock className="size-4" aria-hidden /> This order is closed ({STATUS_LABELS[o.status]}). No further actions are available.
            </p>
          ) : (
            <>
              {o.status === 'clarification_required' && (
                <p className="rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn">
                  Waiting for the requester to reply. You can still accept or reject the request.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {primary && (
                  <Button
                    size="xl"
                    variant={primary.variant}
                    className="sm:min-w-64"
                    onClick={() => trigger(primary)}
                    loading={pending === primary.to}
                    disabled={pending !== null}
                    data-testid={`action-${primary.to}`}
                  >
                    {pending !== primary.to && <primary.icon aria-hidden />}
                    {primary.label}
                    {!primary.dialog && <ArrowRight className="ml-auto sm:ml-1" aria-hidden />}
                  </Button>
                )}
                {secondary.map((a) => (
                  <Button
                    key={a.to}
                    size="xl"
                    variant={a.variant}
                    onClick={() => trigger(a)}
                    disabled={pending !== null}
                    data-testid={`action-${a.to}`}
                  >
                    <a.icon aria-hidden />
                    {a.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <Field label="Operator comment" htmlFor={`comment-${o.id}`} optional>
                  <Textarea
                    id={`comment-${o.id}`}
                    rows={2}
                    className="min-h-12 bg-white"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={1000}
                    placeholder="Saved with the next status update"
                  />
                </Field>
                <label className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={shareComment}
                    onChange={(e) => setShareComment(e.target.checked)}
                    className="size-5 accent-[#176B9A]"
                  />
                  Visible to requester
                </label>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm font-semibold text-ink">Agreed priority</span>
            <div role="radiogroup" aria-label="Agreed priority" className="inline-flex rounded-lg bg-white p-1 ring-1 ring-line">
              {OPERATOR_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={o.approvedPriority === p}
                  disabled={closed || pending !== null}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'min-h-10 rounded-md px-3.5 text-sm font-semibold transition-colors disabled:opacity-50',
                    o.approvedPriority === p
                      ? p === 'urgent'
                        ? 'bg-danger text-white'
                        : p === 'high'
                          ? 'bg-warn text-white'
                          : 'bg-navy text-white'
                      : 'text-muted hover:text-ink'
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            {!o.approvedPriority && <span className="text-xs text-muted">Not yet set — queue treats it as Normal.</span>}
          </div>
          {o.requestedPriority === 'urgent' && (
            <p className="text-sm text-ink">
              <span className="font-semibold text-danger">Requester asked for urgent:</span> {o.urgentReason}
            </p>
          )}
        </div>

        <CardContent className="space-y-5">
          <MetaGrid>
            <Meta label="Requester">{o.requesterName}</Meta>
            <Meta label="Clock number">
              <span className="tabular" data-testid="detail-clock">{o.requesterClock}</span>
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
          </MetaGrid>
          {o.notes && (
            <div className="rounded-lg border border-warn/30 bg-warn-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-warn">Instructions from requester</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink">{o.notes}</p>
            </div>
          )}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-navy">Cutting items ({o.items.length})</h3>
            <ItemSpecTable items={o.items} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold text-navy">Status history</h3>
          <ol className="space-y-3" data-testid="history">
            {[...o.history].reverse().map((h) => (
              <li key={h.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-marine" aria-hidden />
                <div className="min-w-0">
                  <p className="text-ink">
                    {h.eventType === 'priority' ? (
                      <span className="font-semibold">{h.comment}</span>
                    ) : (
                      <>
                        <span className="font-semibold">{STATUS_LABELS[h.newStatus]}</span>
                        {h.previousStatus && <span className="text-muted"> (from {STATUS_LABELS[h.previousStatus]})</span>}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted tabular">
                    {formatUkDateTime(h.changedAt)} · {h.changedBy}
                    {h.changedByRole === 'employee' ? ' (requester)' : ''}
                  </p>
                  {h.eventType === 'status' && h.comment && (
                    <p className="mt-1 rounded-md bg-surface px-2.5 py-1.5 text-ink">
                      {h.commentInternal && (
                        <span className="mr-1.5 rounded bg-navy px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Internal
                        </span>
                      )}
                      {h.comment}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        {dialog && (
          <DialogContent title={dialog.dialogTitle ?? dialog.label} description={`${o.reference} · ${o.requesterName}. ${dialog.dialogText ?? ''}`}>
            {dialog.dialog === 'message' && (
              <Field label="Message to requester" htmlFor="dialog-message" error={dialogError}>
                <Textarea
                  id="dialog-message"
                  rows={4}
                  autoFocus
                  value={dialogMessage}
                  maxLength={1000}
                  onChange={(e) => setDialogMessage(e.target.value)}
                  placeholder={dialog.to === 'clarification_required' ? 'e.g. Is 800 mm the finished length?' : 'Reason'}
                />
              </Field>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" size="lg" onClick={() => setDialog(null)}>
                Go back
              </Button>
              <Button
                size="lg"
                variant={dialog.to === 'rejected' || dialog.to === 'cancelled' ? 'dangerSolid' : 'primary'}
                loading={pending === dialog.to}
                data-testid="dialog-confirm"
                onClick={() => {
                  if (dialog.dialog === 'message') {
                    if (dialogMessage.trim().length < 2) return setDialogError('Please enter a message');
                    apply(dialog, dialogMessage.trim());
                  } else {
                    apply(dialog);
                  }
                }}
              >
                {dialog.label}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
