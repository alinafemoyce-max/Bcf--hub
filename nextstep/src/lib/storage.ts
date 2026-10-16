// Browser-local persistence. Everything stays on this device: nothing is sent anywhere.
// All reads are validated, so a corrupted or tampered value can never crash the app.
import { CATALOG, SECTORS } from '../data/catalog';
import { EXPERIENCE, INTERESTS, QUALS, STATUSES } from './options';
import type { AppState, Profile, QuizAnswers } from './types';

export const STORAGE_KEY = 'nextstep:v1';

export const emptyState = (): AppState => ({ v: 1, profile: null, saved: [], plans: {}, quiz: null });

let available: boolean | null = null;

/** False in some private-browsing modes or when site data is blocked. */
export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const k = '__nextstep_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const oneOf = (list: { id: string }[], v: unknown) => (isStr(v) && list.some((x) => x.id === v) ? v : undefined);
const text = (v: unknown, max = 120) => (isStr(v) ? v.slice(0, max) : undefined);
const careerSlug = (v: unknown) => (isStr(v) && v in CATALOG ? v : undefined);

export function sanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const quals: Profile['quals'] = {};
  if (r.quals && typeof r.quals === 'object') {
    for (const [k, v] of Object.entries(r.quals as Record<string, unknown>)) {
      if (QUALS.some((q) => q.id === k) && (v === 'done' || v === 'studying')) quals[k as keyof Profile['quals']] = v;
    }
  }
  const industry = r.industry === 'none' ? 'none' : oneOf(SECTORS, r.industry);
  return {
    status: oneOf(STATUSES, r.status) as Profile['status'],
    role: text(r.role),
    roleSlug: careerSlug(r.roleSlug) ?? null,
    industry: industry as Profile['industry'],
    quals,
    qualOther: text(r.qualOther),
    experience: oneOf(EXPERIENCE, r.experience) as Profile['experience'],
    interests: Array.isArray(r.interests) ? (r.interests.filter((i) => oneOf(INTERESTS, i)) as Profile['interests']) : []
  };
}

function sanitizeQuiz(raw: unknown): QuizAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: QuizAnswers = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k.slice(0, 40)] = v.filter(isStr).map((s) => s.slice(0, 40)).slice(0, 10);
  }
  return out;
}

export function sanitizeState(raw: unknown): AppState {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  s.profile = sanitizeProfile(r.profile);
  if (Array.isArray(r.saved)) s.saved = [...new Set(r.saved.filter((x) => careerSlug(x)))] as string[];
  if (r.plans && typeof r.plans === 'object') {
    for (const [k, v] of Object.entries(r.plans as Record<string, unknown>)) {
      if (careerSlug(k) && Array.isArray(v)) s.plans[k] = v.filter(isStr).map((x) => x.slice(0, 80)).slice(0, 200);
    }
  }
  s.quiz = sanitizeQuiz(r.quiz);
  return s;
}

export function loadState(): AppState {
  if (!storageAvailable()) return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored */
  }
}
