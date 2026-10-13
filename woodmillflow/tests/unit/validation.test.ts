import { describe, expect, it } from 'vitest';
import { clockNumberSchema, orderItemSchema, orderSchema } from '@/lib/validation';
import { resolveClockNumberRule } from '@/lib/config';
import { sampleOrder } from '../helpers';

const schema = orderSchema({ today: '2026-10-14' });
const item = sampleOrder().items[0];

describe('clock number validation (configurable rule)', () => {
  const numeric = clockNumberSchema({ format: 'numeric', minLength: 4, maxLength: 8 });
  it('accepts numbers within the configured length', () => {
    expect(numeric.parse('123456')).toBe('123456');
    expect(numeric.parse(' 1234 ')).toBe('1234');
  });
  it('rejects too short, too long, letters and empty values', () => {
    for (const bad of ['', '123', '123456789', '12A456', '12-345']) {
      expect(numeric.safeParse(bad).success, bad).toBe(false);
    }
  });
  it('supports an alphanumeric rule, normalised to upper case', () => {
    const alpha = clockNumberSchema({ format: 'alphanumeric', minLength: 5, maxLength: 6 });
    expect(alpha.parse('ab123')).toBe('AB123');
    expect(alpha.safeParse('ab-12').success).toBe(false);
  });
  it('reads the rule from environment variables with safe defaults', () => {
    expect(resolveClockNumberRule({})).toEqual({ format: 'numeric', minLength: 4, maxLength: 8 });
    expect(
      resolveClockNumberRule({
        NEXT_PUBLIC_CLOCK_NUMBER_FORMAT: 'alphanumeric',
        NEXT_PUBLIC_CLOCK_NUMBER_MIN_LENGTH: '6',
        NEXT_PUBLIC_CLOCK_NUMBER_MAX_LENGTH: '3'
      })
    ).toEqual({ format: 'alphanumeric', minLength: 6, maxLength: 6 });
  });
});

describe('dimension and quantity validation', () => {
  const check = (patch: Record<string, unknown>) => orderItemSchema.safeParse({ ...item, ...patch });
  it('converts form strings into numbers', () => {
    const r = orderItemSchema.parse(item);
    expect(r).toMatchObject({ thicknessMm: 18, lengthMm: 800, widthMm: 400, quantity: 3 });
  });
  it('requires length, width and quantity', () => {
    expect(check({ lengthMm: '' }).success).toBe(false);
    expect(check({ widthMm: '' }).success).toBe(false);
    expect(check({ quantity: '' }).success).toBe(false);
  });
  it('rejects zero, negative, out-of-range and non-numeric measurements', () => {
    for (const lengthMm of ['0', '-5', '6001', 'abc', '80.5']) expect(check({ lengthMm }).success, lengthMm).toBe(false);
    for (const widthMm of ['0', '3001']) expect(check({ widthMm }).success, widthMm).toBe(false);
    for (const thicknessMm of ['0', '201', 'x']) expect(check({ thicknessMm }).success, thicknessMm).toBe(false);
  });
  it('allows decimal thickness such as laminate sheet', () => {
    expect(check({ materialCategory: 'laminate', thicknessMm: '0.8' }).success).toBe(true);
  });
  it('requires positive whole-number quantities', () => {
    for (const quantity of ['0', '-1', '2.5', '501']) expect(check({ quantity }).success, quantity).toBe(false);
    expect(check({ quantity: '12' }).success).toBe(true);
  });
  it('requires thickness except for the "Other" category', () => {
    expect(check({ thicknessMm: '' }).success).toBe(false);
    expect(check({ materialCategory: 'other', materialDescription: 'Foam core', thicknessMm: '' }).success).toBe(true);
  });
  it('requires at least one cutting requirement, and a description for "Other"', () => {
    expect(check({ cuttingRequirements: [] }).success).toBe(false);
    expect(check({ cuttingRequirements: ['other'], cuttingOther: '' }).success).toBe(false);
    expect(check({ cuttingRequirements: ['other'], cuttingOther: '45° bevel' }).success).toBe(true);
  });
});

describe('order validation', () => {
  it('accepts a multi-item order with different specifications', () => {
    const r = schema.parse(sampleOrder());
    expect(r.items).toHaveLength(2);
    expect(r.items[0].lengthMm).not.toBe(r.items[1].lengthMm);
    expect(r.items[1].cuttingRequirements).toEqual(['straight_cut', 'drilling']);
  });
  it('requires at least one item and at most twenty', () => {
    expect(schema.safeParse(sampleOrder({ items: [] })).success).toBe(false);
    expect(schema.safeParse(sampleOrder({ items: Array(21).fill(item) })).success).toBe(false);
  });
  it('requires a reason when urgent is requested', () => {
    expect(schema.safeParse(sampleOrder({ requestedPriority: 'urgent', urgentReason: '' })).success).toBe(false);
    expect(schema.safeParse(sampleOrder({ requestedPriority: 'urgent', urgentReason: 'Needed for fit-out today' })).success).toBe(true);
  });
  it('rejects a required date in the past or more than a year ahead', () => {
    expect(schema.safeParse(sampleOrder({ dateRequired: '2026-10-13' })).success).toBe(false);
    expect(schema.safeParse(sampleOrder({ dateRequired: '2026-10-14' })).success).toBe(true);
    expect(schema.safeParse(sampleOrder({ dateRequired: '2027-10-15' })).success).toBe(false);
    expect(schema.safeParse(sampleOrder({ dateRequired: '2026-02-30' })).success).toBe(false);
  });
  it('limits hull reference length and characters', () => {
    expect(schema.safeParse(sampleOrder({ hullReference: 'M68-DEMO-07' })).success).toBe(true);
    expect(schema.safeParse(sampleOrder({ hullReference: 'x'.repeat(41) })).success).toBe(false);
    expect(schema.safeParse(sampleOrder({ hullReference: '<script>' })).success).toBe(false);
  });
  it('requires department and production line', () => {
    expect(schema.safeParse(sampleOrder({ departmentId: '' })).success).toBe(false);
    expect(schema.safeParse(sampleOrder({ productionLineId: '' })).success).toBe(false);
  });
});
