import { z } from 'zod';
import { CLOCK_NUMBER_RULE, type ClockNumberRule } from './config';
import {
  CUTTING_REQUIREMENTS,
  DIMENSION_LIMITS,
  GRAIN_DIRECTIONS,
  MATERIAL_CATEGORIES,
  MAX_ITEMS_PER_ORDER,
  OPERATOR_PRIORITIES,
  ORDER_STATUSES,
  REQUESTED_PRIORITIES,
  thicknessRequired
} from './domain';
import { ukCalendarDate } from './format';

/** Removes control characters (except newlines/tabs) that have no place in a cutting request. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (value: string) => value.replace(CONTROL_CHARS, '').trim();

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value;

const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max, `Keep this under ${max} characters`));
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && clean(v) === '' ? undefined : v),
    text(max).optional()
  );

export function clockNumberSchema(rule: ClockNumberRule = CLOCK_NUMBER_RULE) {
  const range = rule.minLength === rule.maxLength ? `${rule.minLength}` : `${rule.minLength}–${rule.maxLength}`;
  const message =
    rule.format === 'numeric'
      ? `Clock number must be ${range} digits`
      : `Clock number must be ${range} letters or numbers`;
  const pattern = rule.format === 'numeric' ? /^[0-9]+$/ : /^[A-Z0-9]+$/;
  return z
    .string({ error: 'Enter your clock number' })
    .transform((v) => clean(v).replace(/\s+/g, '').toUpperCase())
    .pipe(
      z
        .string()
        .min(1, 'Enter your clock number')
        .refine((v) => v.length >= rule.minLength && v.length <= rule.maxLength && pattern.test(v), message)
    );
}

function measurement(label: string, limits: { min: number; max: number }, opts: { integer: boolean }) {
  let schema = z
    .number({ error: `Enter the ${label}` })
    .min(limits.min, `${capitalise(label)} must be at least ${limits.min}${label === 'quantity' ? '' : ' mm'}`)
    .max(limits.max, `${capitalise(label)} must be ${limits.max}${label === 'quantity' ? '' : ' mm'} or less`);
  if (opts.integer) schema = schema.int(label === 'quantity' ? 'Quantity must be a whole number' : 'Use whole millimetres');
  return z.preprocess((v) => {
    const e = emptyToUndefined(v);
    return e === undefined ? undefined : Number(e);
  }, schema);
}

function optionalMeasurement(label: string, limits: { min: number; max: number }) {
  return z.preprocess((v) => {
    const e = emptyToUndefined(v);
    return e === undefined ? undefined : Number(e);
  }, z.number({ error: `Enter a valid ${label}` }).min(limits.min, `${capitalise(label)} must be at least ${limits.min} mm`).max(limits.max, `${capitalise(label)} must be ${limits.max} mm or less`).optional());
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const lengthSchema = measurement('length', DIMENSION_LIMITS.length, { integer: true });
export const widthSchema = measurement('width', DIMENSION_LIMITS.width, { integer: true });
export const quantitySchema = measurement('quantity', DIMENSION_LIMITS.quantity, { integer: true });
export const thicknessSchema = optionalMeasurement('thickness', DIMENSION_LIMITS.thickness);

export const orderItemSchema = z
  .object({
    materialCategory: z.enum(MATERIAL_CATEGORIES, { error: 'Choose a material category' }),
    materialDescription: text(120).pipe(z.string().min(2, 'Describe the material')),
    thicknessMm: thicknessSchema,
    lengthMm: lengthSchema,
    widthMm: widthSchema,
    quantity: quantitySchema,
    grainDirection: z.preprocess(emptyToUndefined, z.enum(GRAIN_DIRECTIONS).optional()),
    cuttingRequirements: z
      .array(z.enum(CUTTING_REQUIREMENTS))
      .min(1, 'Choose at least one cutting or machining requirement')
      .transform((list) => Array.from(new Set(list))),
    cuttingOther: optionalText(120),
    drawingReference: optionalText(60),
    notes: optionalText(1000)
  })
  .superRefine((item, ctx) => {
    if (thicknessRequired(item.materialCategory) && item.thicknessMm === undefined) {
      ctx.addIssue({ code: 'custom', path: ['thicknessMm'], message: 'Enter the thickness' });
    }
    if (item.cuttingRequirements.includes('other') && !item.cuttingOther) {
      ctx.addIssue({ code: 'custom', path: ['cuttingOther'], message: 'Describe the other requirement' });
    }
  });

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function orderSchema(options: { today?: string; clockRule?: ClockNumberRule } = {}) {
  return z
    .object({
      clockNumber: clockNumberSchema(options.clockRule),
      employeeName: text(80).pipe(z.string().min(2, 'Enter your name')),
      departmentId: z.preprocess(
        (v) => Number(emptyToUndefined(v) ?? Number.NaN),
        z.number({ error: 'Choose your department or shed' }).int().positive('Choose your department or shed')
      ),
      productionLineId: z.preprocess(
        (v) => Number(emptyToUndefined(v) ?? Number.NaN),
        z.number({ error: 'Choose the production line' }).int().positive('Choose the production line')
      ),
      hullReference: z.preprocess(
        (v) => (typeof v === 'string' && clean(v) === '' ? undefined : v),
        text(40)
          .pipe(z.string().regex(/^[A-Za-z0-9 ./#-]+$/, 'Use letters, numbers, spaces and - / . # only'))
          .optional()
      ),
      dateRequired: z.preprocess(
        emptyToUndefined,
        z.string().regex(isoDate, 'Choose a valid date').optional()
      ),
      requestedPriority: z.enum(REQUESTED_PRIORITIES).default('normal'),
      urgentReason: optionalText(300),
      notes: optionalText(1000),
      items: z
        .array(orderItemSchema)
        .min(1, 'Add at least one cutting item')
        .max(MAX_ITEMS_PER_ORDER, `An order can contain up to ${MAX_ITEMS_PER_ORDER} items`)
    })
    .superRefine((order, ctx) => {
      if (order.requestedPriority === 'urgent' && (!order.urgentReason || order.urgentReason.length < 5)) {
        ctx.addIssue({ code: 'custom', path: ['urgentReason'], message: 'Briefly explain why this is urgent' });
      }
      if (order.dateRequired) {
        const today = options.today ?? ukCalendarDate();
        const parsed = new Date(`${order.dateRequired}T12:00:00Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== order.dateRequired) {
          ctx.addIssue({ code: 'custom', path: ['dateRequired'], message: 'Choose a valid date' });
        } else if (order.dateRequired < today) {
          ctx.addIssue({ code: 'custom', path: ['dateRequired'], message: 'The date required cannot be in the past' });
        } else {
          const limit = new Date(`${today}T12:00:00Z`);
          limit.setUTCFullYear(limit.getUTCFullYear() + 1);
          if (parsed > limit) {
            ctx.addIssue({ code: 'custom', path: ['dateRequired'], message: 'Choose a date within the next 12 months' });
          }
        }
      }
    });
}

export type OrderInput = z.input<ReturnType<typeof orderSchema>>;
export type OrderData = z.output<ReturnType<typeof orderSchema>>;
export type OrderItemData = z.output<typeof orderItemSchema>;

/** Body accepted by POST /api/orders: the order plus a client-generated idempotency key. */
export const idempotencyKeySchema = z
  .string({ error: 'Missing idempotency key' })
  .regex(/^[A-Za-z0-9_-]{16,80}$/, 'Invalid idempotency key');

export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  expectedStatus: z.enum(ORDER_STATUSES),
  comment: optionalText(1000),
  commentInternal: z.boolean().default(false)
});

export const prioritySchema = z.object({ priority: z.enum(OPERATOR_PRIORITIES) });

export const requesterReplySchema = z.object({
  message: text(1000).pipe(z.string().min(2, 'Enter a reply'))
});

export const requesterCancelSchema = z.object({
  reason: optionalText(300)
});

export const trackingTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);

/** Flattens Zod issues into { "items.0.lengthMm": "message" } for API responses. */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
