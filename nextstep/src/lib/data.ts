// Access to the career dataset. The NCS data (≈0.5 MB) is loaded as a separate chunk after the first screen
// renders, so the app opens quickly.
import { CATALOG, type CatalogEntry } from '../data/catalog';
import type { NcsData, NcsProfile } from './types';

let data: NcsData | null = null;

export function setData(d: NcsData) {
  data = d;
}

export async function loadData(): Promise<NcsData> {
  if (data) return data;
  const mod = await import('../data/ncs.json');
  data = (mod.default ?? mod) as unknown as NcsData;
  return data;
}

export const dataReady = () => data !== null;
export const retrievedOn = () => data?.retrieved ?? '';

export interface Career extends NcsProfile {
  cat: CatalogEntry;
}

const cache = new Map<string, Career>();

export function career(slug: string | null | undefined): Career | null {
  if (!slug || !data) return null;
  const hit = cache.get(slug);
  if (hit) return hit;
  const p = data.profiles[slug];
  const cat = CATALOG[slug];
  if (!p || !cat) return null;
  const c = { ...p, title: p.title.trim(), cat };
  cache.set(slug, c);
  return c;
}

export const allSlugs = () => Object.keys(CATALOG).filter((s) => data?.profiles[s]);
export const allCareers = () => allSlugs().map((s) => career(s)!) as Career[];

/** "£24,000" → 24000 */
export function salaryNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Skills: NCS uses a shared vocabulary, so skills can be compared across careers ──

const SKILL_LABELS: Record<string, string> = {
  'to be thorough and pay attention to detail': 'Attention to detail',
  'the ability to work well with others': 'Teamwork',
  'excellent verbal communication skills': 'Spoken communication',
  'excellent written communication skills': 'Written communication',
  'customer service skills': 'Customer service',
  'computer skills': 'Using computers and software',
  'basic computer skills': 'Basic computer and device skills',
  'to be flexible and open to change': 'Flexibility',
  'patience and the ability to remain calm in stressful situations': 'Staying calm under pressure',
  'the ability to remain calm and work under pressure': 'Staying calm under pressure',
  'maths knowledge': 'Maths',
  'the ability to use your initiative': 'Using your initiative',
  'business management skills': 'Business management',
  'sensitivity and understanding': 'Sensitivity and understanding',
  'the ability to accept criticism and work well under pressure': 'Taking feedback and working under pressure',
  'analytical thinking skills': 'Analytical thinking',
  'administration skills': 'Administration',
  'the ability to work well with your hands': 'Practical, hands-on skills',
  'leadership skills': 'Leadership',
  'knowledge of engineering science and technology': 'Engineering knowledge',
  'design skills and knowledge': 'Design',
  'knowledge of building and construction': 'Building and construction knowledge',
  'the ability to organise your time and workload': 'Organising your time and workload',
  'complex problem-solving skills': 'Complex problem solving',
  'problem-solving skills': 'Problem solving',
  'to have a thorough understanding of computer systems and applications': 'Understanding computer systems',
  'the ability to work on your own': 'Working independently',
  'persistence and determination': 'Persistence and determination',
  'the ability to think clearly using logic and reasoning': 'Logical thinking',
  'the ability to sell products and services': 'Selling',
  'the ability to use, repair and maintain machines and tools': 'Using and maintaining tools and machines',
  'active listening skills': 'Active listening',
  'the ability to operate and control equipment': 'Operating equipment',
  'the ability to monitor your own performance and that of your colleagues': 'Reviewing your own and others’ work',
  'knowledge of public safety and security': 'Public safety and security',
  'the ability to use your judgement and make decisions': 'Judgement and decision-making',
  'thinking and reasoning skills': 'Thinking and reasoning',
  'knowledge of manufacturing production and processes': 'Manufacturing processes',
  'knowledge of teaching and the ability to design courses': 'Teaching and course design',
  'the ability to understand people’s reactions': 'Understanding people’s reactions',
  'the ability to motivate and manage staff': 'Motivating and managing people',
  'knowledge of psychology': 'Psychology',
  'concentration skills': 'Concentration',
  'the ability to come up with new ways of doing things': 'Coming up with new ideas',
  'a desire to help people': 'Wanting to help people',
  'counselling skills including active listening and a non-judgemental approach': 'Counselling and non-judgemental listening',
  'to enjoy working with other people': 'Enjoying working with people',
  'the ability to analyse quality or performance': 'Analysing quality or performance',
  'the ability to create the best conditions for learning or teaching new things': 'Creating good conditions for learning',
  'knowledge of transport methods, costs and benefits': 'Transport and logistics knowledge',
  'physical fitness and endurance': 'Physical fitness',
  'knowledge of physics': 'Physics',
  'observation and recording skills': 'Observing and recording',
  'practical skills for repairing and maintaining equipment': 'Repairing and maintaining equipment',
  'knowledge of computer operating systems, hardware and software': 'Computer hardware and software',
  'knowledge of english language': 'English language',
  'knowledge of human resources and employment law': 'HR and employment law',
  'a good memory': 'A good memory',
  'knowledge of food production methods': 'Food production methods',
  'the ability to write computer programs': 'Programming',
  'persuading and negotiating skills': 'Persuading and negotiating',
  'persuading skills': 'Persuading and negotiating',
  'negotiation skills': 'Persuading and negotiating',
  'knowledge of economics and accounting': 'Economics and accounting',
  'knowledge of accounting methods': 'Economics and accounting',
  'ambition and a desire to succeed': 'Ambition'
};

/** Reduce an NCS skill phrase to a comparable key ("… for sharing ideas" and wording variants removed). */
export function skillKey(raw: string): string {
  let s = raw.toLowerCase().replace(/'/g, '’').trim();
  s = s.replace(/ (for|to understand|when|while) .*$/, '');
  if (/use a computer and the main software packages/.test(s)) return 'computer skills';
  if (/basic tasks on a computer/.test(s)) return 'basic computer skills';
  if (/^(maths skills|knowledge of maths|maths knowledge)/.test(s)) return 'maths knowledge';
  if (/^knowledge of (teaching|training)/.test(s)) return 'knowledge of teaching and the ability to design courses';
  if (/^the ability to teach/.test(s)) return 'knowledge of teaching and the ability to design courses';
  if (/^knowledge of (healthcare|medicine|patient)/.test(s)) return 'knowledge of medicine and healthcare';
  if (/^physical skills/.test(s)) return 'physical fitness and endurance';
  if (/^the ability to (repair machines|make decisions about tools)/.test(s)) return 'the ability to use, repair and maintain machines and tools';
  if (/^the ability to work well with your hands/.test(s)) return 'the ability to work well with your hands';
  if (/^the ability to monitor your own performance/.test(s)) return 'the ability to monitor your own performance and that of your colleagues';
  if (/^knowledge of (vehicle and )?public safety/.test(s)) return 'knowledge of public safety and security';
  if (/^knowledge of psychology/.test(s)) return 'knowledge of psychology';
  if (/^knowledge of economics/.test(s)) return 'knowledge of economics and accounting';
  return s;
}

export function skillLabel(key: string): string {
  if (SKILL_LABELS[key]) return SKILL_LABELS[key];
  if (key === 'knowledge of medicine and healthcare') return 'Healthcare and medical knowledge';
  let s = key.replace(/^the ability to /, '').replace(/^to be able to /, '').replace(/^to be /, 'being ');
  s = s.replace(/^knowledge of /, 'knowledge of ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function skillKeys(c: Career | null): string[] {
  if (!c) return [];
  return [...new Set(c.skills.map(skillKey))];
}
