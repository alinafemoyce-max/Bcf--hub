import type { Sector } from '../data/catalog';

// ── National Careers Service profile (shape written by scripts/fetch_ncs.py) ──
export type Block = { p: string } | { ul: string[] };
export interface NcsRoute {
  id: string;
  title: string;
  content: Block[];
  requirements: string[];
}
export interface NcsProfile {
  slug: string;
  title: string;
  altTitles: string;
  summary: string;
  salary: { starter: string | null; experienced: string | null };
  hours: string | null;
  pattern: string | null;
  routesIntro: string[];
  routes: NcsRoute[];
  info: { h: string; items: string[] }[];
  skills: string[];
  restrictions: string[];
  tasks: string[];
  environment: string[];
  progression: string[];
  related: string[];
}
export interface NcsData {
  retrieved: string;
  source: string;
  licence: string;
  profiles: Record<string, NcsProfile>;
}

// ── User profile from onboarding (every answer is optional) ──
export type StatusId = 'school' | 'college' | 'apprentice' | 'employed' | 'self-employed' | 'looking' | 'changing';
export type QualId =
  | 'gcse-em'
  | 'gcse'
  | 'functional'
  | 'l2'
  | 'l3'
  | 'alevels'
  | 'tlevel'
  | 'app2'
  | 'app3'
  | 'app4'
  | 'access'
  | 'hnc'
  | 'degree'
  | 'postgrad'
  | 'cards';
export type QualState = 'done' | 'studying';
export type ExperienceId = 'none' | 'lt1' | '1to2' | '3to5' | '5plus';
export type InterestId = 'leadership' | 'business' | 'specialist' | 'earnings' | 'change' | 'education' | 'unsure';

export interface Profile {
  status?: StatusId;
  /** what the user typed for their job, course or apprenticeship */
  role?: string;
  /** the career in our dataset that best matches `role`, if any */
  roleSlug?: string | null;
  industry?: Sector | 'none';
  quals: Partial<Record<QualId, QualState>>;
  qualOther?: string;
  experience?: ExperienceId;
  interests: InterestId[];
}

export type QuizAnswers = Record<string, string[]>;

export interface AppState {
  v: 1;
  profile: Profile | null;
  saved: string[];
  /** action-plan items ticked off, per career */
  plans: Record<string, string[]>;
  quiz: QuizAnswers | null;
}
