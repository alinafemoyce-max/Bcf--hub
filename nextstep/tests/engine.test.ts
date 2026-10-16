import { describe, expect, it } from 'vitest';
import './setup';
import { CATALOG } from '../src/data/catalog';
import { VERIFIED } from '../src/data/sources';
import { allSlugs, career, skillKey } from '../src/lib/data';
import { alternativeRoutes, buildPathways, careerSteps, compareSkills, matchRole, qualNotes, realisticPath, whySuits } from '../src/lib/engine';
import { buildPlan, planText } from '../src/lib/plan';
import { QUIZ, quizResults } from '../src/lib/quiz';
import slugs from '../src/data/slugs.json';
import type { Profile } from '../src/lib/types';

const P = (o: Partial<Profile> = {}): Profile => ({ quals: {}, interests: [], ...o });

describe('dataset', () => {
  it('has an NCS profile for every catalogue entry and the scraper slug list matches', () => {
    expect(Object.keys(CATALOG).sort()).toEqual([...slugs].sort());
    for (const s of Object.keys(CATALOG)) {
      const c = career(s);
      expect(c, s).not.toBeNull();
      expect(c!.summary.length, s).toBeGreaterThan(20);
      expect(c!.tasks.length, s).toBeGreaterThan(0);
      expect(c!.skills.length, s).toBeGreaterThan(0);
    }
  });
  it('only links to careers that exist', () => {
    for (const [s, e] of Object.entries(CATALOG)) {
      for (const t of [...(e.up ?? []), ...(e.side ?? [])]) expect(CATALOG[t], `${s} → ${t}`).toBeDefined();
      expect(e.up ?? [], s).not.toContain(s);
    }
    for (const s of Object.keys(VERIFIED)) expect(CATALOG[s], s).toBeDefined();
  });
  it('covers the required industries', () => {
    const sectors = new Set(Object.values(CATALOG).map((e) => e.sector));
    for (const s of ['manufacturing', 'construction', 'engineering', 'digital', 'health', 'business', 'finance', 'retail', 'hospitality', 'education', 'transport']) expect(sectors.has(s as never), s).toBe(true);
  });
  it('normalises skill wording so careers can be compared', () => {
    expect(skillKey('excellent verbal communication skills for sharing ideas')).toBe('excellent verbal communication skills');
    expect(skillKey('to be able to use a computer and the main software packages competently')).toBe(skillKey('to be able to use a computer and the main software packages confidently'));
  });
});

describe('matching what people type', () => {
  it.each([
    ['laminator', 'boat-builder'],
    ['Level 3 carpentry and joinery', 'carpenter'],
    ['warehouse operative', 'warehouse-worker'],
    ['health and social care', 'healthcare-assistant'],
    ['business admin apprenticeship', 'admin-assistant'],
    ['HGV driver', 'large-goods-vehicle-driver'],
    ['cyber security', 'it-security-co-ordinator'],
    ['team leader', 'supervisor']
  ])('%s → %s', (text, slug) => expect(matchRole(text)[0]?.slug).toBe(slug));
  it('returns nothing for empty or unrelated input', () => {
    expect(matchRole('')).toEqual([]);
    expect(matchRole('zzqx')).toEqual([]);
  });
});

describe('pathways', () => {
  const apprentice = P({ status: 'apprentice', roleSlug: 'boat-builder', interests: ['leadership'], experience: '1to2' });
  it('gives upward, sideways and cross-industry options without duplicates', () => {
    const pw = buildPathways(apprentice, null);
    expect(pw.upward.length).toBeGreaterThan(1);
    expect(pw.sideways.length).toBeGreaterThan(1);
    expect(pw.cross.length).toBeGreaterThan(1);
    const all = [...pw.upward, ...pw.sideways, ...pw.cross].map((s) => s.slug);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('boat-builder');
    for (const s of pw.cross) expect(CATALOG[s.slug].sector).not.toBe('manufacturing');
    for (const s of pw.upward) expect(s.reasons.length).toBeGreaterThan(0);
  });
  it('works for every career as a starting point', () => {
    for (const s of allSlugs()) {
      const pw = buildPathways(P({ roleSlug: s }), null);
      expect(pw.start?.slug).toBe(s);
    }
  });
  it('falls back to industry starting points when the role is unknown', () => {
    const pw = buildPathways(P({ status: 'college', role: 'something unusual', industry: 'hospitality' }), null);
    expect(pw.basis).toBe('industry');
    expect(pw.starting.length).toBeGreaterThan(0);
    for (const s of pw.starting) expect(CATALOG[s.slug].sector).toBe('hospitality');
  });
  it('handles users with no clear direction', () => {
    const pw = buildPathways(P({ interests: ['unsure'] }), null);
    expect(pw.basis).toBe('interests');
    expect(pw.starting.length).toBeGreaterThan(0);
    expect(pw.upward).toEqual([]);
  });
  it('handles an empty profile', () => {
    expect(() => buildPathways(null, null)).not.toThrow();
  });
});

describe('routes and steps', () => {
  it('finds realistic routes and rejects far-fetched ones', () => {
    expect(realisticPath('carpenter', 'construction-manager')?.map((s) => s.slug)).toEqual(['carpenter', 'construction-manager']);
    expect(realisticPath('boat-builder', 'nurse')).toBeNull();
  });
  it('offers alternative routes with different first steps', () => {
    const routes = alternativeRoutes('boat-builder', 'production-manager-manufacturing-');
    expect(routes.length).toBeGreaterThan(1);
    expect(new Set(routes.map((r) => r[1].slug)).size).toBe(routes.length);
    for (const r of routes) {
      expect(r[0].slug).toBe('boat-builder');
      expect(r[r.length - 1].slug).toBe('production-manager-manufacturing-');
    }
  });
  it('uses a training route when there is no close link', () => {
    const steps = careerSteps(P({ roleSlug: 'boat-builder' }), 'nurse');
    expect(steps[0].kind).toBe('start');
    expect(steps.some((s) => s.kind === 'train')).toBe(true);
    expect(steps[steps.length - 1]).toMatchObject({ slug: 'nurse', kind: 'target' });
  });
  it('compares skills between careers', () => {
    const r = compareSkills('boat-builder', 'marine-engineering-technician');
    expect(r.shared.length).toBeGreaterThan(0);
    expect(r.develop.length).toBeGreaterThan(0);
    expect(compareSkills(null, 'chef').hasStart).toBe(false);
  });
});

describe('qualifications', () => {
  it('never treats a qualification being studied as achieved', () => {
    const studying = qualNotes(P({ quals: { 'gcse-em': 'studying' } }), 'boat-builder').filter((n) => /GCSE/.test(n.req));
    expect(studying.length).toBeGreaterThan(0);
    for (const n of studying) expect(n.state).toBe('working');
    const done = qualNotes(P({ quals: { 'gcse-em': 'done' } }), 'boat-builder').filter((n) => /GCSE/.test(n.req));
    for (const n of done) expect(n.state).toBe('have');
  });
  it('explains why a career might suit someone', () => {
    const why = whySuits(P({ roleSlug: 'boat-builder', interests: ['leadership'] }), 'supervisor', null);
    expect(why.join(' ')).toMatch(/boat builder/);
    expect(why.join(' ')).toMatch(/leadership/);
  });
});

describe('action plans', () => {
  it('builds all six sections for a typical career', () => {
    const plan = buildPlan(P({ status: 'apprentice', roleSlug: 'boat-builder' }), 'marine-engineering-technician');
    expect(plan.map((s) => s.id)).toEqual(['month', 'skills', 'quals', 'experience', 'people', 'milestones']);
    const ids = plan.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('builds a plan for every career', () => {
    for (const s of allSlugs()) expect(buildPlan(null, s).length, s).toBeGreaterThan(3);
  });
  it('keeps personal details out of shared plan text', () => {
    const profile = P({ status: 'employed', role: 'Laminator at Acme Yachts', roleSlug: 'boat-builder', qualOther: 'Secret course' });
    const text = planText('supervisor', buildPlan(profile, 'supervisor'), new Set());
    expect(text).not.toMatch(/Acme|Laminator|Secret|boat builder/i);
    expect(text).toMatch(/Supervisor/);
  });
});

describe('interests questionnaire', () => {
  it('points practical, workshop-loving answers at practical sectors', () => {
    const r = quizResults({ people: ['team'], hands: ['make'], thinking: ['neither'], lead: ['no'], tech: ['avoid'], care: ['no'], money: ['fair'], place: ['workshop', 'site'] });
    expect(['manufacturing', 'construction', 'engineering']).toContain(r[0].sector);
  });
  it('points caring, people-focused answers at health, education or public services', () => {
    const r = quizResults({ people: ['lots'], hands: ['mix'], thinking: ['neither'], lead: ['maybe'], tech: ['avoid'], care: ['very'], money: ['other'], place: ['clinical', 'classroom'] });
    expect(['health', 'education', 'public']).toContain(r[0].sector);
  });
  it('every option has a unique id within its question', () => {
    for (const q of QUIZ) expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
  });
});
