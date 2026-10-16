import { describe, expect, it } from 'vitest';
import { sanitizeState } from '../src/lib/storage';

describe('stored data is validated', () => {
  it('ignores garbage', () => {
    for (const bad of [null, 42, 'x', [], { profile: 'x', saved: 'y', plans: 3 }]) {
      const s = sanitizeState(bad);
      expect(s).toMatchObject({ v: 1, profile: null, saved: [], plans: {}, quiz: null });
    }
  });
  it('keeps valid data and drops unknown values', () => {
    const s = sanitizeState({
      profile: { status: 'apprentice', roleSlug: 'boat-builder', industry: 'nope', quals: { 'gcse-em': 'done', app3: 'studying', fake: 'done', l2: 'maybe' }, interests: ['leadership', 'hacking'], role: 'x'.repeat(500) },
      saved: ['carpenter', 'carpenter', 'not-a-career'],
      plans: { carpenter: ['a', 1], nope: ['b'] },
      quiz: { people: ['team', 5] }
    });
    expect(s.profile).toMatchObject({ status: 'apprentice', roleSlug: 'boat-builder', industry: undefined, quals: { 'gcse-em': 'done', app3: 'studying' }, interests: ['leadership'] });
    expect(s.profile!.role!.length).toBe(120);
    expect(s.saved).toEqual(['carpenter']);
    expect(s.plans).toEqual({ carpenter: ['a'] });
    expect(s.quiz).toEqual({ people: ['team'] });
  });
});
