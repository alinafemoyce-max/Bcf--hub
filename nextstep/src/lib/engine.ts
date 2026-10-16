// The rule-based career pathway engine. No AI service or network calls: suggestions come from the curated
// progression links in catalog.ts, NCS "related careers", shared NCS skills and the user's own answers.
import { CATALOG, type Sector, type Tag } from '../data/catalog';
import { allSlugs, career, salaryNumber, skillKeys, skillLabel, type Career } from './data';
import { INTERESTS } from './options';
import { quizTagWeights } from './quiz';
import type { Profile, QualId, QuizAnswers } from './types';

// ── 1. Matching what the user typed to a career ─────────────────────────────

const STOP = new Set(
  'a an the and of in at for to on as my i im am with level lvl apprentice apprenticeship apprenticeships trainee junior senior student course diploma nvq btec studying currently working work job role year advanced intermediate higher l1 l2 l3 l4 l5 l6 1 2 3 4 5 6 7 uk'.split(' ')
);
export const norm = (t: string) => t.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (t: string) => norm(t).split(' ').filter((w) => w && !STOP.has(w));
const similar = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 6) === b.slice(0, 6));

export function matchRole(text: string, limit = 5): { slug: string; score: number }[] {
  const q = norm(text);
  if (q.length < 2) return [];
  const qTokens = tokens(text);
  const out: { slug: string; score: number }[] = [];
  for (const slug of allSlugs()) {
    const c = career(slug)!;
    const phrases = [c.title, ...c.altTitles.split(','), ...(c.cat.kw ?? [])].map(norm).filter(Boolean);
    let best = 0;
    for (const p of phrases) {
      let s = 0;
      if (q === p) s = 100;
      else if (` ${q} `.includes(` ${p} `)) s = 40 + Math.min(p.length, 30);
      else if (q.length >= 3 && p.startsWith(q)) s = 30 + q.length;
      const pTokens = p.split(' ').filter((w) => !STOP.has(w));
      const hits = qTokens.filter((t) => pTokens.some((w) => similar(t, w))).length;
      if (hits && pTokens.length) s = Math.max(s, 22 * (hits / Math.max(pTokens.length, qTokens.length)) + 12 * hits);
      best = Math.max(best, s);
    }
    if (best >= 20) out.push({ slug, score: Math.round(best) });
  }
  return out.sort((a, b) => b.score - a.score || career(a.slug)!.cat.level - career(b.slug)!.cat.level).slice(0, limit);
}

// ── 2. The career graph ─────────────────────────────────────────────────────

/** Cross-sector roles that shouldn't act as a shortcut between unrelated industries. */
const GENERIC = new Set(['supervisor']);

export type EdgeKind = 'up' | 'side' | 'related';
interface Edge {
  to: string;
  kind: EdgeKind;
  w: number;
}

let graph: Map<string, Edge[]> | null = null;

function buildGraph() {
  const g = new Map<string, Edge[]>();
  const add = (from: string, to: string, kind: EdgeKind, w: number) => {
    if (from === to || !CATALOG[to] || !career(to)) return;
    const list = g.get(from) ?? [];
    const existing = list.find((e) => e.to === to);
    if (existing) {
      if (w < existing.w) Object.assign(existing, { kind, w });
    } else list.push({ to, kind, w });
    g.set(from, list);
  };
  for (const slug of allSlugs()) {
    const cat = CATALOG[slug];
    cat.up?.forEach((to) => add(slug, to, 'up', 1));
    cat.side?.forEach((to) => {
      add(slug, to, 'side', 1.3);
      add(to, slug, 'side', 1.3);
    });
    career(slug)!.related.forEach((to) => {
      add(slug, to, 'related', 1.7);
      add(to, slug, 'related', 1.7);
    });
  }
  return g;
}

export function edges(slug: string): Edge[] {
  if (!graph) graph = buildGraph();
  return graph.get(slug) ?? [];
}

/** Lowest-cost route between two careers through the graph (never goes down a level by more than one). */
export type Route = { slug: string; kind: EdgeKind | 'start' }[] & { cost: number };

/** Routes costing more than this are too indirect to present as a realistic sequence. */
export const MAX_ROUTE_COST = 4.2;

export function shortestPath(from: string, to: string, avoid: Set<string> = new Set()): Route | null {
  if (!career(from) || !career(to)) return null;
  if (from === to) return Object.assign([{ slug: from, kind: 'start' as const }], { cost: 0 });
  const origin = CATALOG[from].sector;
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { from: string; kind: EdgeKind }>();
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    let d = Infinity;
    for (const n of open) if ((dist.get(n) ?? Infinity) < d) [cur, d] = [n, dist.get(n)!];
    open.delete(cur);
    if (cur === to) break;
    let hops = 0;
    for (let p = cur; prev.has(p); p = prev.get(p)!.from) hops++;
    if (hops >= 4) continue;
    for (const e of edges(cur)) {
      if (avoid.has(e.to) && e.to !== to) continue;
      if (CATALOG[e.to].level < CATALOG[cur].level - 1) continue;
      // Changing industry costs a little more, and generic roles (e.g. supervisor) are not a free bridge.
      let w = e.w;
      if (CATALOG[e.to].sector !== CATALOG[cur].sector) w += 0.4;
      if (GENERIC.has(cur) && CATALOG[e.to].sector !== origin) w += 1.5;
      const nd = d + w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, { from: cur, kind: e.kind });
        open.add(e.to);
      }
    }
  }
  if (!prev.has(to)) return null;
  const path: { slug: string; kind: EdgeKind | 'start' }[] = [];
  for (let p = to; p !== from; p = prev.get(p)!.from) path.unshift({ slug: p, kind: prev.get(p)!.kind });
  path.unshift({ slug: from, kind: 'start' });
  return Object.assign(path, { cost: dist.get(to)! });
}

/** The best route, but only if it is direct enough to be a realistic suggestion. */
export function realisticPath(from: string | null | undefined, to: string): Route | null {
  if (!from) return null;
  const p = shortestPath(from, to);
  return p && p.cost <= MAX_ROUTE_COST ? p : null;
}

/** Up to `k` different routes: the best one, then the best route through each other first step. */
export function alternativeRoutes(from: string, to: string, k = 3) {
  const best = realisticPath(from, to);
  if (!best) return [];
  const routes: Route[] = [best];
  const candidates: Route[] = [];
  for (const e of edges(from)) {
    if (e.to === to || e.to === best[1]?.slug) continue;
    if (CATALOG[e.to].level < CATALOG[from].level - 1) continue;
    const rest = shortestPath(e.to, to, new Set([from]));
    if (!rest || rest.length > 4) continue;
    const cost = rest.cost + e.w + (CATALOG[e.to].sector !== CATALOG[from].sector ? 0.4 : 0);
    if (cost <= MAX_ROUTE_COST + 1) candidates.push(Object.assign([{ slug: from, kind: 'start' as const }, { slug: e.to, kind: e.kind }, ...rest.slice(1)], { cost }));
  }
  candidates.sort((a, b) => a.cost - b.cost);
  for (const c of candidates) {
    if (routes.length >= k) break;
    const key = c.map((s) => s.slug).join('>');
    if (!routes.some((r) => r.map((s) => s.slug).join('>') === key)) routes.push(c);
  }
  return routes;
}

// ── 3. Skills ───────────────────────────────────────────────────────────────

export function compareSkills(fromSlug: string | null | undefined, toSlug: string) {
  const from = new Set(skillKeys(career(fromSlug)));
  const to = skillKeys(career(toSlug));
  return {
    shared: to.filter((k) => from.has(k)).map(skillLabel),
    develop: to.filter((k) => !from.has(k)).map(skillLabel),
    all: to.map(skillLabel),
    hasStart: from.size > 0
  };
}

// ── 4. Personal relevance ───────────────────────────────────────────────────

export const mentionsSelfEmployment = (c: Career) => /own business|self[- ]employ|freelance|own company|set up your own|start your own|open your own/i.test(c.progression.join(' '));
const hasDegreeRoute = (c: Career) => c.routes.some((r) => r.id === 'University') || /degree apprenticeship|higher apprenticeship|level [4-7]/i.test(JSON.stringify(c.routes));

function relevance(profile: Profile | null, c: Career, quiz: QuizAnswers | null): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const ints = new Set(profile?.interests ?? []);
  const tags = new Set<Tag>(c.cat.tags);
  const lbl = (id: string) => INTERESTS.find((i) => i.id === id)!.label.toLowerCase();
  if (ints.has('leadership') && tags.has('lead')) {
    score += 3;
    reasons.push(`Involves leading people or operations – you said you're interested in ${lbl('leadership')}.`);
  }
  if (ints.has('business') && mentionsSelfEmployment(c)) {
    score += 2.5;
    reasons.push('The National Careers Service mentions self-employment or running your own business as an option.');
  }
  if (ints.has('specialist') && !tags.has('lead') && (tags.has('tech') || tags.has('analytical') || tags.has('hands')) && c.cat.level >= 2) {
    score += 2;
    reasons.push('A specialist, skills-based role – you said you’re interested in technical specialisation.');
  }
  const exp = salaryNumber(c.salary.experienced);
  if (ints.has('earnings') && exp && exp >= 35000) {
    score += exp >= 45000 ? 3 : 2;
    reasons.push(`NCS gives a typical experienced salary of ${c.salary.experienced} a year (pay varies by employer and area).`);
  }
  if (ints.has('education') && hasDegreeRoute(c)) {
    score += 1.5;
    reasons.push('Has higher-level study routes, such as a degree or higher apprenticeship.');
  }
  if (quiz) {
    const w = quizTagWeights(quiz);
    const fit = c.cat.tags.reduce((s, t) => s + (w[t] ?? 0), 0);
    score += Math.max(-2, Math.min(4, fit * 0.6));
    const top = c.cat.tags.filter((t) => (w[t] ?? 0) >= 2).slice(0, 2);
    if (top.length) reasons.push(`Fits your questionnaire answers (${top.map(tagPhrase).join(', ')}).`);
  }
  return { score, reasons };
}

export const TAG_PHRASES: Partial<Record<Tag, string>> = {
  people: 'working with people',
  team: 'working in a team',
  solo: 'working independently',
  hands: 'practical, hands-on work',
  desk: 'desk-based work',
  creative: 'creative tasks',
  analytical: 'analytical tasks',
  lead: 'leading others',
  tech: 'technology',
  care: 'helping people directly',
  business: 'business and commerce',
  active: 'being active',
  workshop: 'workshop settings',
  site: 'site or outdoor work',
  office: 'office settings',
  clinical: 'health and care settings',
  venue: 'shops, venues and hospitality',
  classroom: 'schools and training',
  road: 'being on the road'
};
const tagPhrase = (t: Tag) => TAG_PHRASES[t] ?? t;

// ── 5. Pathway suggestions ──────────────────────────────────────────────────

export interface Suggestion {
  slug: string;
  score: number;
  reasons: string[];
  via?: string[];
}

export interface Pathways {
  start: Career | null;
  /** how the starting point was found */
  basis: 'role' | 'industry' | 'interests';
  /** used when we couldn't match the user's current role */
  base: Career | null;
  starting: Suggestion[];
  upward: Suggestion[];
  sideways: Suggestion[];
  cross: Suggestion[];
  business: Suggestion[];
}

export function buildPathways(profile: Profile | null, quiz: QuizAnswers | null): Pathways {
  const start = career(profile?.roleSlug);
  const industry = profile?.industry && profile.industry !== 'none' ? (profile.industry as Sector) : null;
  const sector: Sector | null = start && !GENERIC.has(start.slug) ? start.cat.sector : industry;
  const early = !profile?.experience || profile.experience === 'none' || profile.experience === 'lt1';
  const rel = (c: Career) => relevance(profile, c, quiz);

  // Starting points (when no current role matched, or as extra ideas for students and job seekers)
  let starting: Suggestion[] = [];
  if (!start) {
    const pool = allSlugs()
      .map((s) => career(s)!)
      .filter((c) => c.cat.level <= 2 && (!sector || c.cat.sector === sector));
    starting = pool
      .map((c) => {
        const r = rel(c);
        return { slug: c.slug, score: r.score + (c.cat.level === 1 && early ? 0.5 : 0), reasons: r.reasons };
      })
      .sort((a, b) => b.score - a.score || career(a.slug)!.title.localeCompare(career(b.slug)!.title))
      .slice(0, sector ? 8 : 10);
  }

  const base = start ?? (sector && starting[0] ? career(starting[0].slug) : null);
  const empty: Pathways = { start, basis: start ? 'role' : sector ? 'industry' : 'interests', base, starting, upward: [], sideways: [], cross: [], business: [] };
  if (!base) {
    empty.business = businessIdeas(profile, quiz, null, sector);
    return empty;
  }

  // Upward: follow "up" links up to three steps
  const upward: Suggestion[] = [];
  const seen = new Set([base.slug]);
  let frontier: { slug: string; via: string[] }[] = [{ slug: base.slug, via: [] }];
  for (let depth = 1; depth <= 3 && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const f of frontier) {
      let ups = CATALOG[f.slug].up ?? [];
      if (GENERIC.has(f.slug) && sector) {
        const inSector = ups.filter((u) => CATALOG[u].sector === sector);
        ups = inSector.length ? inSector : ups.slice(0, 2);
      }
      for (const u of ups) {
        if (seen.has(u) || !career(u)) continue;
        seen.add(u);
        const c = career(u)!;
        const r = rel(c);
        const reasons =
          depth === 1
            ? [`A common next step up from ${base.title.toLowerCase()} with experience and further training.`, ...r.reasons]
            : [`A longer-term goal – reached via ${f.via.concat(f.slug === base.slug ? [] : [f.slug]).map((s) => career(s)!.title.toLowerCase()).join(', then ')}.`, ...r.reasons];
        upward.push({ slug: u, score: 10 - depth * 2 + r.score, reasons, via: f.slug === base.slug ? f.via : [...f.via, f.slug] });
        next.push({ slug: u, via: f.slug === base.slug ? f.via : [...f.via, f.slug] });
      }
    }
    frontier = next;
  }
  upward.sort((a, b) => b.score - a.score);

  // Sideways: related roles in the same sector at a similar level
  const baseSkills = new Set(skillKeys(base));
  const sharedCount = (c: Career) => skillKeys(c).filter((k) => baseSkills.has(k)).length;
  const upSet = new Set(upward.map((u) => u.slug));
  const sideCandidates = new Set<string>();
  edges(base.slug).forEach((e) => e.kind !== 'up' && sideCandidates.add(e.to));
  allSlugs().forEach((s) => {
    const c = CATALOG[s];
    const overlap = c.tags.filter((t) => base.cat.tags.includes(t)).length;
    if (c.sector === base.cat.sector && Math.abs(c.level - base.cat.level) <= 1 && overlap >= 2) sideCandidates.add(s);
  });
  const sideways: Suggestion[] = [];
  for (const s of sideCandidates) {
    const c = career(s);
    if (!c || s === base.slug || upSet.has(s)) continue;
    if (c.cat.sector !== base.cat.sector && !GENERIC.has(base.slug)) continue;
    if (c.cat.level > base.cat.level + 1) continue;
    const r = rel(c);
    const n = sharedCount(c);
    const direct = (CATALOG[base.slug].side ?? []).includes(s) || (c.cat.side ?? []).includes(base.slug);
    sideways.push({
      slug: s,
      score: (direct ? 4 : 2) + n * 0.6 + r.score,
      reasons: [n ? `Uses ${n} of the same skills as ${base.title.toLowerCase()}.` : `Closely related to ${base.title.toLowerCase()}.`, ...r.reasons]
    });
  }
  sideways.sort((a, b) => b.score - a.score);

  // Cross-industry: other sectors, similar level, shared skills and work style
  const changeBonus = profile?.interests.includes('change') ? 1 : 0;
  const cross: Suggestion[] = [];
  for (const s of allSlugs()) {
    const c = career(s)!;
    if (c.cat.sector === base.cat.sector || s === base.slug || upSet.has(s) || sideways.some((x) => x.slug === s)) continue;
    if (c.cat.level > base.cat.level + 1 || c.cat.level < Math.min(base.cat.level - 1, 2)) continue;
    const n = sharedCount(c);
    const tagOverlap = c.cat.tags.filter((t) => base.cat.tags.includes(t)).length / new Set([...c.cat.tags, ...base.cat.tags]).size;
    const linked = edges(base.slug).some((e) => e.to === s);
    const ncsRelated = base.related.includes(s) || c.related.includes(base.slug);
    const r = rel(c);
    const score = n * 0.8 + tagOverlap * 5 + (linked ? 3 : 0) + r.score + changeBonus;
    if (n < 2 && !linked) continue;
    const reasons = [
      ncsRelated
        ? `The National Careers Service lists it as a related career to ${base.title.toLowerCase()}${n ? `, and it uses ${n} of the same skills` : ''}.`
        : `Uses ${n} of the same skills as ${base.title.toLowerCase()}, in a different industry.`,
      ...r.reasons
    ];
    cross.push({ slug: s, score, reasons });
  }
  cross.sort((a, b) => b.score - a.score);

  return {
    ...empty,
    upward: upward.slice(0, 6),
    sideways: sideways.slice(0, 6),
    cross: cross.slice(0, 6),
    business: businessIdeas(profile, quiz, base, sector)
  };
}

function businessIdeas(profile: Profile | null, quiz: QuizAnswers | null, base: Career | null, sector: Sector | null): Suggestion[] {
  return allSlugs()
    .map((s) => career(s)!)
    .filter(mentionsSelfEmployment)
    .map((c) => {
      const r = relevance(profile, c, quiz);
      let score = r.score;
      if (base && c.slug === base.slug) score += 8;
      if (base && edges(base.slug).some((e) => e.to === c.slug)) score += 4;
      if (sector && c.cat.sector === sector) score += 3;
      if (base && c.cat.level > base.cat.level + 2) score -= 4;
      return { slug: c.slug, score, reasons: ['The National Careers Service mentions self-employment or running your own business for this career.'] };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ── 6. Steps towards a chosen career ────────────────────────────────────────

export interface Step {
  slug?: string;
  title: string;
  kind: 'start' | EdgeKind | 'train' | 'target';
  note: string;
}

/** Plain-English note for one move along a route. */
export function stepNote(kind: string, from: string | undefined, to: string): string {
  const up = from && CATALOG[from] ? CATALOG[to].level > CATALOG[from].level : false;
  if (kind === 'up') return 'A step up – usually after gaining experience, often with extra training or qualifications.';
  if (up) return 'A related role at a higher level – usually needs further training or study.';
  if (kind === 'side') return 'A move across that builds on skills you will already be using.';
  return 'A related role the National Careers Service links to the previous one.';
}

const routePhrase = (c: Career) => {
  const r = c.routesIntro.slice(0, 4);
  return r.length ? r.join(', ').replace(/, ([^,]*)$/, ' or $1') : 'a recognised training route';
};

export function careerSteps(profile: Profile | null, targetSlug: string, startOverride?: string | null): Step[] {
  const target = career(targetSlug);
  if (!target) return [];
  const startSlug = startOverride !== undefined ? startOverride : profile?.roleSlug;
  const start = career(startSlug);
  const stepFor = (slug: string, kind: Step['kind'], prev?: string): Step => ({ slug, title: career(slug)!.title, kind, note: stepNote(kind, prev, slug) });
  if (start && start.slug === target.slug) return [{ slug: start.slug, title: start.title, kind: 'start', note: 'This is where you are now.' }];
  const path = start ? realisticPath(start.slug, target.slug) : null;
  if (path) {
    return path.map((p, i) =>
      i === 0
        ? { slug: p.slug, title: career(p.slug)!.title, kind: 'start', note: 'Where you are now.' }
        : { ...stepFor(p.slug, p.kind as EdgeKind, path[i - 1].slug), kind: i === path.length - 1 ? 'target' : (p.kind as EdgeKind) }
    );
  }
  // No direct route: retrain or start at an entry role that leads to the target
  const steps: Step[] = [];
  if (start) steps.push({ slug: start.slug, title: start.title, kind: 'start', note: 'Where you are now. Your transferable skills come with you.' });
  else steps.push({ title: 'Where you are now', kind: 'start', note: 'Your current studies, work or life experience.' });
  const entry =
    target.cat.level >= 3
      ? allSlugs()
          .filter((s) => CATALOG[s].level <= 2 && CATALOG[s].sector === target.cat.sector)
          .map((s) => ({ s, p: realisticPath(s, target.slug) }))
          .filter((x) => x.p && x.p.length <= 3)
          .sort((a, b) => a.p!.cost - b.p!.cost)[0]
      : undefined;
  steps.push({ title: 'Get a way in', kind: 'train', note: `The National Careers Service lists these routes in: ${routePhrase(target)}.` });
  if (entry?.p) {
    entry.p.slice(0, -1).forEach((p, i) => steps.push({ ...stepFor(p.slug, p.kind as EdgeKind, entry.p![i - 1]?.slug), kind: i === 0 ? 'side' : (p.kind as EdgeKind), note: i === 0 ? 'One possible entry-level role in this field.' : stepFor(p.slug, p.kind as EdgeKind, entry.p![i - 1].slug).note }));
  }
  steps.push({ slug: target.slug, title: target.title, kind: 'target', note: 'Your goal.' });
  return steps;
}

// ── 7. Why a career might suit the user ─────────────────────────────────────

export function whySuits(profile: Profile | null, slug: string, quiz: QuizAnswers | null): string[] {
  const c = career(slug);
  if (!c) return [];
  const out: string[] = [];
  const start = career(profile?.roleSlug);
  if (start && start.slug !== slug) {
    const path = realisticPath(start.slug, slug);
    if (path && path.length === 2) out.push(`It connects directly to your current role or course (${start.title.toLowerCase()}).`);
    else if (path && path.length <= 4) out.push(`It can be reached from ${start.title.toLowerCase()} in ${path.length - 1} steps.`);
    const { shared } = compareSkills(start.slug, slug);
    if (shared.length) out.push(`It uses ${shared.length} skills you'll already be developing as ${aOrAn(start.title.toLowerCase())}: ${shared.slice(0, 3).join(', ').toLowerCase()}.`);
  }
  const r = relevance(profile, c, quiz);
  out.push(...r.reasons);
  const q = qualNotes(profile, slug).filter((n) => n.state);
  if (q.some((n) => n.state === 'have')) out.push('You told us you have qualifications that appear in a typical entry route.');
  else if (q.some((n) => n.state === 'working')) out.push('You are working towards qualifications that appear in a typical entry route.');
  return [...new Set(out)];
}

export const aOrAn = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

// ── 8. Rough check of qualifications against NCS entry requirements ─────────

const REQ_MAP: [RegExp, QualId[]][] = [
  [/GCSE/i, ['gcse-em', 'gcse']],
  [/\bA levels?\b/i, ['alevels']],
  [/T Level/i, ['tlevel']],
  [/access to higher education/i, ['access']],
  [/\bHNC|HND|foundation degree/i, ['hnc']],
  [/\bdegree\b/i, ['degree', 'postgrad']],
  [/level 3 (diploma|qualification|course)|level 3\b/i, ['l3', 'alevels', 'tlevel', 'app3', 'access']],
  [/level 2 (diploma|qualification|course)|level 2\b/i, ['l2', 'app2', 'l3', 'alevels', 'tlevel', 'app3']],
  [/level 1\b/i, ['functional', 'l2', 'gcse-em', 'gcse']]
];

export function qualNotes(profile: Profile | null, slug: string) {
  const c = career(slug);
  if (!c) return [];
  const quals = profile?.quals ?? {};
  const out: { route: string; req: string; state: 'have' | 'working' | null }[] = [];
  for (const r of c.routes) {
    for (const req of r.requirements) {
      if (/^entry requirements for these courses vary/i.test(req)) {
        out.push({ route: r.title, req, state: null });
        continue;
      }
      const needed = req.replace(/\s+for (a|an|the) [^,]*$/i, '').replace(/,? or equivalent/i, '');
      let state: 'have' | 'working' | null = null;
      for (const [re, ids] of REQ_MAP) {
        if (!re.test(needed)) continue;
        if (ids.some((id) => quals[id] === 'done')) state = 'have';
        else if (ids.some((id) => quals[id] === 'studying')) state = state ?? 'working';
        break;
      }
      out.push({ route: r.title, req, state });
    }
  }
  return out;
}
