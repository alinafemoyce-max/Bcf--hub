// Builds a practical action plan for a chosen career from the NCS profile and the user's situation.
// The plan never includes the user's own profile details, so it is safe to print or share.
import { VERIFIED, LINKS, ncsUrl } from '../data/sources';
import { career } from './data';
import { careerSteps, compareSkills } from './engine';
import type { Profile } from './types';

export interface PlanItem {
  id: string;
  text: string;
  detail?: string;
  link?: { label: string; url: string };
  verified?: boolean;
}
export interface PlanSection {
  id: 'month' | 'skills' | 'quals' | 'experience' | 'people' | 'milestones';
  title: string;
  intro: string;
  items: PlanItem[];
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const item = (section: string, text: string, extra: Omit<PlanItem, 'id' | 'text'> = {}): PlanItem => ({ id: `${section}-${hash(text)}`, text, ...extra });

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function buildPlan(profile: Profile | null, slug: string): PlanSection[] {
  const c = career(slug);
  if (!c) return [];
  const status = profile?.status;
  const inWork = status === 'employed' || status === 'apprentice' || status === 'self-employed';
  const studying = status === 'school' || status === 'college';
  const title = c.title.toLowerCase();
  const routeIds = new Set(c.routes.map((r) => r.id.toLowerCase()));
  const skills = compareSkills(profile?.roleSlug, slug);
  const steps = careerSteps(profile, slug);

  // This month
  const month: PlanItem[] = [
    item('month', `Read the full National Careers Service profile for ${title}`, { link: { label: 'Open NCS profile', url: ncsUrl(slug) } })
  ];
  if (routeIds.has('apprenticeship')) {
    month.push(item('month', `Search for ${title} apprenticeships and note the entry requirements`, { link: LINKS.apprenticeships }));
  }
  if (inWork) month.push(item('month', `Ask your manager or supervisor whether your organisation has roles like ${title}, and what the route looks like there`));
  if (studying) month.push(item('month', `Book a chat with your careers adviser or tutor about becoming ${aOrAn(title)}`));
  if (!inWork && !studying) month.push(item('month', 'Book a free chat with a National Careers Service adviser', { link: LINKS.ncsAdvice }));
  if (skills.shared.length) {
    month.push(item('month', `Write down two real examples that show your ${lc(skills.shared[0])}`, { detail: 'Concrete examples make CVs, applications and interviews much stronger.' }));
  }
  month.push(item('month', `Update your CV to highlight the skills ${title}s use`));

  // Skills to develop
  const develop = (skills.hasStart ? skills.develop : skills.all).slice(0, 5);
  const skillItems = develop.map((s) =>
    item('skills', s, { detail: 'Look for chances to practise this in your current job or course, a short course or volunteering.' })
  );

  // Qualifications to research
  const quals: PlanItem[] = (VERIFIED[slug] ?? []).map((v) => item('quals', v.text, { verified: true, link: { label: v.source, url: v.url } }));
  for (const r of c.routes) {
    const lists = r.content.filter((b): b is { ul: string[] } => 'ul' in b).flatMap((b) => b.ul);
    if (r.id === 'Apprenticeship' && lists.length) {
      quals.push(item('quals', `Research apprenticeships such as: ${lists.slice(0, 4).join(', ')}`, { link: LINKS.standards }));
    } else if (r.id === 'College' && lists.length) {
      quals.push(item('quals', `Research college courses such as: ${lists.slice(0, 4).join(', ')}`, { link: LINKS.feCourses }));
    } else if (r.id === 'University') {
      quals.push(item('quals', `Research university courses${lists.length ? ` such as: ${lists.slice(0, 3).join(', ')}` : ''}`, { link: LINKS.ucas }));
    }
  }
  if (quals.length) quals.push(item('quals', 'Check exact entry requirements with each course provider or employer – they vary'));

  // Work experience
  const experience: PlanItem[] = [];
  for (const r of c.routes) {
    if (r.id === 'volunteering' || r.id === 'work') {
      const txt = r.content.map((b) => ('p' in b ? b.p : b.ul.join('; '))).join(' ');
      experience.push(item('experience', txt.length > 220 ? `${txt.slice(0, 217).trim()}…` : txt, { detail: 'From the National Careers Service profile.' }));
    }
  }
  experience.push(item('experience', `Ask to shadow or talk to someone working as ${aOrAn(title)} for a day`));
  if (c.cat.tags.includes('care') || c.cat.tags.includes('classroom')) experience.push(item('experience', 'Look for volunteering with a charity, school, club or care service', { link: LINKS.volunteering }));
  else experience.push(item('experience', 'Look for a work experience placement, part-time role or project that uses the same skills'));

  // People to speak to
  const people: PlanItem[] = [item('people', `Someone who works as ${aOrAn(title)} – ask how they got started and what they’d do differently`)];
  if (inWork) people.push(item('people', 'Your line manager, supervisor or apprenticeship training provider'));
  if (studying) people.push(item('people', 'Your tutor or school / college careers leader'));
  people.push(item('people', 'A National Careers Service adviser (free in England)', { link: LINKS.ncsAdvice }));
  const bodies = c.info.find((i) => /professional and industry bodies|further information/i.test(i.h));
  if (bodies?.items[0]) people.push(item('people', `Organisations the NCS suggests: ${bodies.items[0].replace(/^You (can|could) find out more[^.]*? from (the )?/i, '')}`));

  // Milestones (skip "where you are now" so no personal details appear)
  const milestones = steps
    .filter((s) => s.kind !== 'start')
    .map((s) => item('milestones', s.kind === 'train' ? 'Start a recognised route in – course, apprenticeship or entry-level job' : s.kind === 'target' ? `Become ${aOrAn(s.title.toLowerCase())}` : `Move into a role as ${aOrAn(s.title.toLowerCase())}`, { detail: s.note }));

  return [
    { id: 'month', title: 'This month', intro: 'Small, practical actions to get started.', items: month },
    { id: 'skills', title: 'Skills to develop', intro: skills.hasStart ? 'Skills this role uses that aren’t in your current role’s profile.' : 'Key skills the National Careers Service lists for this role.', items: skillItems },
    { id: 'quals', title: 'Qualifications to research', intro: 'Typical routes – research these rather than assuming you need them all.', items: quals },
    { id: 'experience', title: 'Relevant experience', intro: 'Ways to build experience and show you’re serious.', items: experience },
    { id: 'people', title: 'People to speak to', intro: 'Conversations are often the fastest way to learn.', items: people },
    { id: 'milestones', title: 'Longer-term milestones', intro: 'An illustrative sequence – real timelines vary.', items: milestones }
  ].filter((s) => s.items.length) as PlanSection[];
}

const aOrAn = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

/** Plain-text version for sharing or copying. Contains no personal profile details. */
export function planText(slug: string, sections: PlanSection[], done: Set<string>): string {
  const c = career(slug);
  if (!c) return '';
  const lines = [`NextStep action plan: ${c.title}`, ''];
  for (const s of sections) {
    lines.push(s.title.toUpperCase());
    for (const i of s.items) lines.push(`${done.has(i.id) ? '[x]' : '[ ]'} ${i.text}${i.link ? ` (${i.link.url})` : ''}`);
    lines.push('');
  }
  lines.push('Career information: National Careers Service, Open Government Licence v3.0.');
  return lines.join('\n');
}
