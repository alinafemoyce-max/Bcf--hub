import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, MAIN_PATH, ORDER_STATUSES, TERMINAL_STATUSES } from '@/lib/domain';
import { formatCalendarDate, formatUkDate, formatUkDateTime, formatUkTime, ukCalendarDate } from '@/lib/format';

describe('status transitions', () => {
  it('allows the operator to follow the main path step by step', () => {
    for (let i = 0; i < MAIN_PATH.length - 1; i++) {
      expect(canTransition(MAIN_PATH[i], MAIN_PATH[i + 1], 'operator')).toBe(true);
    }
  });
  it('does not allow skipping steps or going backwards', () => {
    expect(canTransition('submitted', 'in_progress', 'operator')).toBe(false);
    expect(canTransition('submitted', 'ready', 'operator')).toBe(false);
    expect(canTransition('accepted', 'collected', 'operator')).toBe(false);
    expect(canTransition('ready', 'in_progress', 'operator')).toBe(false);
    expect(canTransition('in_progress', 'accepted', 'operator')).toBe(false);
  });
  it('treats collected, rejected and cancelled as final', () => {
    for (const s of TERMINAL_STATUSES) {
      expect(allowedTransitions(s, 'operator')).toEqual([]);
      expect(allowedTransitions(s, 'requester')).toEqual([]);
    }
  });
  it('limits requesters to replying to clarification or cancelling before work starts', () => {
    expect(allowedTransitions('submitted', 'requester')).toEqual(['cancelled']);
    expect(allowedTransitions('clarification_required', 'requester').sort()).toEqual(['cancelled', 'submitted']);
    for (const s of ['accepted', 'in_progress', 'ready'] as const) expect(allowedTransitions(s, 'requester')).toEqual([]);
    expect(canTransition('submitted', 'accepted', 'requester')).toBe(false);
  });
  it('has a rule for every status', () => {
    for (const s of ORDER_STATUSES) expect(Array.isArray(allowedTransitions(s, 'operator'))).toBe(true);
  });
});

describe('UK date and time formatting', () => {
  it('formats dates as DD/MM/YYYY and times as 24-hour HH:mm', () => {
    expect(formatUkDate('2026-01-05T09:07:00Z')).toBe('05/01/2026');
    expect(formatUkTime('2026-01-05T21:07:00Z')).toBe('21:07');
  });
  it('converts UTC to British Summer Time', () => {
    // 12 October 2026 is BST (UTC+1)
    expect(formatUkDateTime('2026-10-12T09:42:00Z')).toBe('12/10/2026 10:42');
    expect(formatUkDateTime('2026-10-12T23:30:00Z')).toBe('13/10/2026 00:30');
  });
  it('uses GMT after the clocks go back', () => {
    // Clocks go back at 01:00 UTC on 25 October 2026
    expect(formatUkTime('2026-10-25T00:30:00Z')).toBe('01:30');
    expect(formatUkTime('2026-10-25T01:30:00Z')).toBe('01:30');
    expect(formatUkTime('2026-12-01T10:42:00Z')).toBe('10:42');
  });
  it('gives the UK calendar date for "today" comparisons', () => {
    expect(ukCalendarDate('2026-10-12T23:30:00Z')).toBe('2026-10-13');
    expect(ukCalendarDate('2026-12-31T23:30:00Z')).toBe('2026-12-31');
  });
  it('formats stored calendar dates without time-zone shifts', () => {
    expect(formatCalendarDate('2026-10-15')).toBe('15/10/2026');
  });
});
