/**
 * Central configuration for the WoodmillFlow concept demonstration.
 *
 * Nothing here reflects a real Sunseeker format or system. In particular the clock-number
 * rule is a placeholder that can be changed with environment variables without code changes.
 */

export type ClockNumberFormat = 'numeric' | 'alphanumeric';

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ClockNumberRule {
  format: ClockNumberFormat;
  minLength: number;
  maxLength: number;
}

export function resolveClockNumberRule(env: Record<string, string | undefined>): ClockNumberRule {
  const format: ClockNumberFormat = env.NEXT_PUBLIC_CLOCK_NUMBER_FORMAT === 'alphanumeric' ? 'alphanumeric' : 'numeric';
  const minLength = intFromEnv(env.NEXT_PUBLIC_CLOCK_NUMBER_MIN_LENGTH, 4);
  const maxLength = Math.max(minLength, intFromEnv(env.NEXT_PUBLIC_CLOCK_NUMBER_MAX_LENGTH, 8));
  return { format, minLength, maxLength };
}

// NEXT_PUBLIC_* values are inlined at build time so the browser and server share one rule.
export const CLOCK_NUMBER_RULE: ClockNumberRule = resolveClockNumberRule({
  NEXT_PUBLIC_CLOCK_NUMBER_FORMAT: process.env.NEXT_PUBLIC_CLOCK_NUMBER_FORMAT,
  NEXT_PUBLIC_CLOCK_NUMBER_MIN_LENGTH: process.env.NEXT_PUBLIC_CLOCK_NUMBER_MIN_LENGTH,
  NEXT_PUBLIC_CLOCK_NUMBER_MAX_LENGTH: process.env.NEXT_PUBLIC_CLOCK_NUMBER_MAX_LENGTH
});

/** All dates and times are displayed in UK local time; timestamps are stored in UTC. */
export const DISPLAY_TIME_ZONE = 'Europe/London';

export const ORDER_REFERENCE_PREFIX = 'WM';

/** Fictional demonstration identities. */
export const DEMO_EMPLOYEE = {
  name: 'Alex Taylor',
  clockNumber: '123456',
  department: 'Shed 2',
  productionLine: 'Manhattan 68'
} as const;

export const DEMO_OPERATOR = {
  name: 'Sam Morgan',
  clockNumber: '900101',
  role: 'Woodmill Operator'
} as const;

export const COLLECTION_POINT = 'the woodmill collection point';
