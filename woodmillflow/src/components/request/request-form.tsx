'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FormProvider, useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Hash,
  Link2,
  Plus,
  Send,
  UserRound
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, SectionLabel } from '@/components/ui/card';
import { ChoiceChips, Field, Input, Select, Textarea } from '@/components/ui/form';
import { StatusBadge } from '@/components/status';
import { ItemSpecTable } from '@/components/order-items';
import { ItemCard } from './item-card';
import { emptyItem, emptyOrder, type FormValues } from './types';
import { api, ApiError, copyText, randomKey, saveToken } from '@/lib/client';
import { CLOCK_NUMBER_RULE, DEMO_EMPLOYEE } from '@/lib/config';
import { MAX_ITEMS_PER_ORDER } from '@/lib/domain';
import { formatCalendarDate, formatUkDate, formatUkTime, ukCalendarDate } from '@/lib/format';
import { orderSchema, type OrderData } from '@/lib/validation';
import type { CreatedOrder, OrderItem, ReferenceData } from '@/lib/types';
import { cn } from '@/lib/utils';

type Step = 'edit' | 'review' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'edit', label: 'Request details' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Submitted' }
];

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="mb-6 flex items-center gap-2 text-[13px] font-semibold sm:gap-3" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2 sm:gap-3" aria-current={i === current ? 'step' : undefined}>
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full text-xs',
              i < current && 'bg-ok text-white',
              i === current && 'bg-marine text-white',
              i > current && 'bg-white text-subtle ring-1 ring-line-strong'
            )}
          >
            {i < current ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={cn(i === current ? 'text-navy' : 'text-muted', i !== current && 'hidden sm:inline')}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-line-strong sm:w-10" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** Converts validated form data to the item shape used by the shared specification table. */
function toPreviewItems(data: OrderData): OrderItem[] {
  return data.items.map((i, idx) => ({
    id: String(idx),
    position: idx + 1,
    materialCategory: i.materialCategory,
    materialDescription: i.materialDescription,
    thicknessMm: i.thicknessMm ?? null,
    lengthMm: i.lengthMm,
    widthMm: i.widthMm,
    quantity: i.quantity,
    grainDirection: i.grainDirection ?? null,
    cuttingRequirements: i.cuttingRequirements,
    cuttingOther: i.cuttingOther ?? null,
    drawingReference: i.drawingReference ?? null,
    notes: i.notes ?? null
  }));
}

export function RequestForm({ reference }: { reference: ReferenceData }) {
  const schema = useMemo(() => orderSchema(), []);
  const methods = useForm<FormValues, unknown, OrderData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues, unknown, OrderData>,
    defaultValues: { clockNumber: '', employeeName: '', departmentId: '', productionLineId: '', ...emptyOrder() },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true
  });
  const { control, register, handleSubmit, formState, setValue, getValues, setError, reset } = methods;
  const { fields, append, insert, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });
  const priority = useWatch({ control, name: 'requestedPriority' });

  const [step, setStep] = useState<Step>('edit');
  const [validated, setValidated] = useState<OrderData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const pieces = (items ?? []).reduce((sum, i) => sum + (Number.parseInt(i.quantity, 10) || 0), 0);
  const deptName = (id: string | number) => reference.departments.find((d) => String(d.id) === String(id))?.name ?? '—';
  const lineName = (id: string | number) => reference.productionLines.find((d) => String(d.id) === String(id))?.name ?? '—';
  const today = ukCalendarDate();
  const scrollTop = () => requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const useDemoProfile = () => {
    const dept = reference.departments.find((d) => d.name === DEMO_EMPLOYEE.department);
    const line = reference.productionLines.find((l) => l.name === DEMO_EMPLOYEE.productionLine);
    setValue('clockNumber', DEMO_EMPLOYEE.clockNumber, { shouldValidate: formState.isSubmitted });
    setValue('employeeName', DEMO_EMPLOYEE.name, { shouldValidate: formState.isSubmitted });
    if (dept) setValue('departmentId', String(dept.id), { shouldValidate: formState.isSubmitted });
    if (line) setValue('productionLineId', String(line.id), { shouldValidate: formState.isSubmitted });
  };

  const onReview = handleSubmit(
    (data) => {
      setValidated(data);
      setIdempotencyKey(randomKey());
      setStep('review');
      scrollTop();
    },
    (errors) => {
      const count = Object.keys(errors).filter((k) => k !== 'items').length + (errors.items?.length ? 1 : 0);
      toast.error(count > 1 ? 'Please check the highlighted fields.' : 'Please check the highlighted field.');
    }
  );

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await api<{ order: CreatedOrder }>('/api/orders', {
        body: { idempotencyKey, order: getValues() }
      });
      saveToken(res.order.trackingToken);
      setCreated(res.order);
      setStep('done');
      scrollTop();
    } catch (e) {
      const err = e as ApiError;
      if (err.fieldErrors) {
        setStep('edit');
        for (const [path, message] of Object.entries(err.fieldErrors)) {
          setError(path as keyof FormValues, { type: 'server', message });
        }
      }
      // The same idempotency key is reused on retry, so a repeated tap cannot create a duplicate.
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    const keep = getValues();
    reset({
      clockNumber: keep.clockNumber,
      employeeName: keep.employeeName,
      departmentId: keep.departmentId,
      productionLineId: keep.productionLineId,
      ...emptyOrder()
    });
    setCreated(null);
    setValidated(null);
    setStep('edit');
    scrollTop();
  };

  return (
    <div>
      <Stepper step={step} />

      {step === 'done' && created && <Success order={created} onAnother={startAnother} />}

      {step === 'review' && validated && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-5">
            <Card>
              <CardContent className="space-y-5">
                <SectionLabel title="Check your request" description="Make sure the measurements are correct before you submit." />
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Summary label="Clock number" value={validated.clockNumber} mono />
                  <Summary label="Employee name" value={validated.employeeName} />
                  <Summary label="Department / shed" value={deptName(validated.departmentId)} />
                  <Summary label="Production line" value={lineName(validated.productionLineId)} />
                  <Summary label="Boat / hull reference" value={validated.hullReference ?? 'Not provided'} muted={!validated.hullReference} />
                  <Summary
                    label="Date required"
                    value={validated.dateRequired ? formatCalendarDate(validated.dateRequired) : 'Not specified'}
                    muted={!validated.dateRequired}
                  />
                  <Summary
                    label="Requested priority"
                    value={validated.requestedPriority === 'urgent' ? 'Urgent' : 'Normal'}
                    className="col-span-2 sm:col-span-1"
                  />
                  {validated.requestedPriority === 'urgent' && (
                    <Summary label="Reason for urgency" value={validated.urgentReason ?? ''} className="col-span-2" />
                  )}
                </dl>
                {validated.notes && (
                  <div className="rounded-lg border border-line bg-surface px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Additional instructions</p>
                    <p className="mt-1 whitespace-pre-wrap text-[15px]">{validated.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="mb-4 flex items-center justify-between">
                  <SectionLabel title={`Cutting items (${validated.items.length})`} />
                  <span className="text-sm font-medium text-muted tabular">
                    {validated.items.reduce((s, i) => s + i.quantity, 0)} pieces in total
                  </span>
                </div>
                <ItemSpecTable items={toPreviewItems(validated)} />
              </CardContent>
            </Card>
          </div>
          <ActionPanel>
            <p className="hidden text-sm text-muted lg:block">
              The order reference, date and time are recorded by the server when you submit.
            </p>
            <Button size="xl" className="w-full" onClick={submit} loading={submitting} data-testid="submit-request">
              {!submitting && <Send aria-hidden />}
              {submitting ? 'Submitting…' : 'Submit Woodmill Request'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={submitting}
              onClick={() => {
                setStep('edit');
                scrollTop();
              }}
            >
              <ArrowLeft aria-hidden /> Back to Edit
            </Button>
          </ActionPanel>
        </div>
      )}

      <FormProvider {...methods}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onReview();
          }}
          noValidate
          className={cn('grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start', step !== 'edit' && 'hidden')}
        >
          <div className="min-w-0 space-y-6">
            {/* SECTION A */}
            <Card>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionLabel letter="A" title="Employee information" description="Who is requesting the material." />
                  <Button variant="subtle" size="sm" onClick={useDemoProfile} data-testid="use-demo-profile">
                    <UserRound aria-hidden /> Use demo profile ({DEMO_EMPLOYEE.name})
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Clock number"
                    htmlFor="clockNumber"
                    error={formState.errors.clockNumber?.message}
                    hint={`Fictional numbers only in this demo (${CLOCK_NUMBER_RULE.minLength}–${CLOCK_NUMBER_RULE.maxLength} ${CLOCK_NUMBER_RULE.format === 'numeric' ? 'digits' : 'characters'}).`}
                  >
                    <Input
                      id="clockNumber"
                      inputMode={CLOCK_NUMBER_RULE.format === 'numeric' ? 'numeric' : 'text'}
                      pattern={CLOCK_NUMBER_RULE.format === 'numeric' ? '[0-9]*' : undefined}
                      autoComplete="off"
                      autoCapitalize="characters"
                      maxLength={CLOCK_NUMBER_RULE.maxLength + 2}
                      placeholder="e.g. 123456"
                      className="tabular"
                      aria-invalid={Boolean(formState.errors.clockNumber)}
                      {...register('clockNumber')}
                    />
                  </Field>
                  <Field label="Employee name" htmlFor="employeeName" error={formState.errors.employeeName?.message}>
                    <Input
                      id="employeeName"
                      autoComplete="off"
                      autoCapitalize="words"
                      placeholder="First and last name"
                      aria-invalid={Boolean(formState.errors.employeeName)}
                      {...register('employeeName')}
                    />
                  </Field>
                  <Field label="Department / shed" htmlFor="departmentId" error={formState.errors.departmentId?.message}>
                    <Select id="departmentId" aria-invalid={Boolean(formState.errors.departmentId)} {...register('departmentId')}>
                      <option value="">Select department…</option>
                      {reference.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Production line" htmlFor="productionLineId" error={formState.errors.productionLineId?.message}>
                    <Select id="productionLineId" aria-invalid={Boolean(formState.errors.productionLineId)} {...register('productionLineId')}>
                      <option value="">Select production line…</option>
                      {reference.productionLines.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Boat / hull reference"
                    htmlFor="hullReference"
                    optional
                    error={formState.errors.hullReference?.message}
                    className="sm:col-span-2"
                  >
                    <Input id="hullReference" autoComplete="off" autoCapitalize="characters" maxLength={40} placeholder="e.g. M68-DEMO-07" {...register('hullReference')} />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* SECTION B */}
            <Card>
              <CardContent className="space-y-5">
                <SectionLabel letter="B" title="Order information" description="When it is needed and how urgent it is." />
                <div className="grid gap-3 rounded-lg bg-surface p-3.5 sm:grid-cols-2">
                  <AutoField icon={Hash} label="Order reference" value="Assigned when you submit" />
                  <AutoField icon={CalendarClock} label="Date & time submitted" value="Recorded automatically (UK time)" />
                </div>
                <Field
                  label="Date required"
                  htmlFor="dateRequired"
                  optional
                  error={formState.errors.dateRequired?.message}
                  hint="Helps the woodmill plan. It is not a guaranteed completion date."
                >
                  <Input id="dateRequired" type="date" min={today} className="sm:max-w-60" {...register('dateRequired')} />
                </Field>
                <Field label="Priority request" hint="The woodmill operator sets the final priority.">
                  <ChoiceChips
                    name="Priority request"
                    options={[
                      { value: 'normal', label: 'Normal' },
                      { value: 'urgent', label: 'Urgent' }
                    ]}
                    value={priority}
                    columns="grid-cols-2 sm:max-w-sm"
                    onChange={(v) => setValue('requestedPriority', (v || 'normal') as FormValues['requestedPriority'])}
                  />
                </Field>
                {priority === 'urgent' && (
                  <Field label="Why is this urgent?" htmlFor="urgentReason" error={formState.errors.urgentReason?.message}>
                    <Textarea
                      id="urgentReason"
                      rows={2}
                      className="min-h-12"
                      maxLength={300}
                      placeholder="e.g. Needed to complete a fit-out stage today"
                      aria-invalid={Boolean(formState.errors.urgentReason)}
                      {...register('urgentReason')}
                    />
                  </Field>
                )}
                <Field label="Additional instructions" htmlFor="notes" optional error={formState.errors.notes?.message}>
                  <Textarea id="notes" rows={3} maxLength={1000} placeholder="Anything the woodmill should know about the whole order" {...register('notes')} />
                </Field>
              </CardContent>
            </Card>

            {/* SECTION C */}
            <div className="space-y-4">
              <div className="px-1">
                <SectionLabel
                  letter="C"
                  title="Material specifications"
                  description="Add one item for each different size or material. Each item has its own dimensions and quantity."
                />
              </div>
              {typeof formState.errors.items?.message === 'string' && (
                <p className="text-sm text-danger" role="alert">
                  {formState.errors.items.message}
                </p>
              )}
              {fields.map((f, i) => (
                <ItemCard
                  key={f.id}
                  index={i}
                  total={fields.length}
                  onDuplicate={() => {
                    if (fields.length >= MAX_ITEMS_PER_ORDER) return toast.error(`Up to ${MAX_ITEMS_PER_ORDER} items per order.`);
                    insert(i + 1, { ...getValues(`items.${i}`), cuttingRequirements: [...getValues(`items.${i}.cuttingRequirements`)] });
                    toast.success(`Item ${i + 1} duplicated — adjust the copy as needed.`);
                  }}
                  onRemove={() => remove(i)}
                />
              ))}
              <Button
                variant="secondary"
                size="lg"
                className="w-full border-dashed"
                data-testid="add-item"
                disabled={fields.length >= MAX_ITEMS_PER_ORDER}
                onClick={() => append(emptyItem())}
              >
                <Plus aria-hidden /> Add Another Item
              </Button>
            </div>
          </div>

          <ActionPanel sticky>
            <div className="flex items-center justify-between lg:block">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">This request</p>
                <p className="text-[15px] font-semibold text-navy tabular" data-testid="item-count">
                  {fields.length} {fields.length === 1 ? 'item' : 'items'} · {pieces} {pieces === 1 ? 'piece' : 'pieces'}
                </p>
              </div>
              <p className="mt-3 hidden text-sm text-muted lg:block">
                You can check everything on the next screen before it is sent to the woodmill.
              </p>
            </div>
            <Button type="submit" size="xl" className="w-full" data-testid="review-request">
              Review Request <ArrowRight aria-hidden />
            </Button>
          </ActionPanel>
        </form>
      </FormProvider>
    </div>
  );
}

function ActionPanel({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  // Phone: fixed action bar at the bottom of the screen. Laptop: side panel next to the form.
  return (
    <aside
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_-12px_rgb(16_36_58/0.25)] backdrop-blur',
        'lg:static lg:z-auto lg:rounded-xl lg:border lg:bg-white lg:p-6 lg:shadow-card lg:backdrop-blur-none',
        sticky && 'lg:sticky lg:top-24'
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-2 lg:max-w-none lg:gap-3">{children}</div>
    </aside>
  );
}

function AutoField({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-white text-marine ring-1 ring-line">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="text-sm text-ink">{value}</p>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  mono,
  muted,
  className
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-[15px] font-medium', mono && 'tabular', muted && 'font-normal text-subtle')}>{value}</dd>
    </div>
  );
}

function Success({ order, onAnother }: { order: CreatedOrder; onAnother: () => void }) {
  const trackingPath = `/track/${order.trackingToken}`;
  const trackingUrl = typeof window === 'undefined' ? trackingPath : `${window.location.origin}${trackingPath}`;
  const copy = async (text: string, what: string) => {
    if (await copyText(text)) toast.success(`${what} copied`);
    else toast.error('Copy is not available here — select the text instead.');
  };
  return (
    <Card className="mx-auto max-w-2xl overflow-hidden" data-testid="submission-success">
      <div className="bg-navy px-6 py-7 text-center text-white sm:px-8">
        <CheckCircle2 className="mx-auto size-12 text-[#6fd3a2]" aria-hidden />
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Request Submitted Successfully</h2>
        <p className="mt-1.5 text-white/70">The woodmill can now see your request in its work queue.</p>
      </div>
      <CardContent className="space-y-6 sm:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Order reference</p>
          <p className="mt-1 text-[34px] font-bold tracking-tight text-navy tabular" data-testid="order-reference">
            {order.reference}
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line text-center">
          <div className="px-2 py-3">
            <dt className="text-xs font-semibold text-muted">Date</dt>
            <dd className="mt-0.5 font-semibold tabular" data-testid="submitted-date">{formatUkDate(order.submittedAt)}</dd>
          </div>
          <div className="px-2 py-3">
            <dt className="text-xs font-semibold text-muted">Time</dt>
            <dd className="mt-0.5 font-semibold tabular" data-testid="submitted-time">{formatUkTime(order.submittedAt)}</dd>
          </div>
          <div className="flex flex-col items-center px-2 py-3">
            <dt className="text-xs font-semibold text-muted">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={order.status} size="sm" />
            </dd>
          </div>
        </dl>
        <div className="rounded-lg bg-surface p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Link2 className="size-3.5" aria-hidden /> Your private tracking link
          </p>
          <p className="mt-1 break-all text-sm text-ink" data-testid="tracking-url">{trackingUrl}</p>
          <p className="mt-1 text-xs text-muted">Saved on this device under “My requests”. Anyone with this link can view the order status.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href={trackingPath} className={cn(buttonVariants({ size: 'lg' }), 'w-full')} data-testid="track-request">
            Track My Request
          </Link>
          <Button variant="secondary" size="lg" className="w-full" onClick={onAnother}>
            <Plus aria-hidden /> Submit Another
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => copy(order.reference, 'Order reference')}>
            <ClipboardCopy aria-hidden /> Copy Reference
          </Button>
        </div>
        <button
          type="button"
          className="mx-auto block text-sm font-medium text-marine underline-offset-2 hover:underline"
          onClick={() => copy(trackingUrl, 'Tracking link')}
        >
          Copy tracking link
        </button>
      </CardContent>
    </Card>
  );
}
