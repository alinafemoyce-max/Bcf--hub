// Cautious duplicate matching between an imported entry and existing video records.
// Identity is certain only with a TikTok video id; otherwise titles (possibly truncated) and
// publication dates give a confidence score, and the user confirms anything that is not clear.

import type { MatchCandidate } from './types';

export type MatchLevel = 'exact_id' | 'likely' | 'possible';

export interface MatchResult {
  candidate: MatchCandidate;
  score: number;
  level: MatchLevel;
  reasons: string[];
}

export interface MatchQuery {
  title: string | null;
  titleTruncated?: boolean;
  tiktokVideoId?: string | null;
  /** UTC ISO instant of the visible publication date, if known. */
  publishedAt?: string | null;
}

const STOPWORDS = new Set(
  'a an the and or but of to in on for with is it this that my your you i me be are was at as by from so if do'.split(' ')
);

export function normaliseTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\.\.\.|…)\s*(more)?\s*$/u, '')
    .replace(/[#@]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(title: string): string[] {
  return normaliseTitle(title)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t));
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const compact = s.replace(/\s+/g, ' ');
  for (let i = 0; i < compact.length - 1; i++) {
    const g = compact.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const [g, n] of A) {
    overlap += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * overlap) / total : 0;
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Title similarity that respects truncation: when either title was cut off, a prefix match of a
 * reasonable length counts as strong evidence, because the visible text is all we have.
 */
export function titleSimilarity(a: string, b: string, aTruncated = false, bTruncated = false): number {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const [shorter, longer, shorterTruncated] = na.length <= nb.length ? [na, nb, aTruncated] : [nb, na, bTruncated];
  if ((shorterTruncated || aTruncated || bTruncated) && longer.startsWith(shorter)) {
    return shorter.length >= 20 ? 0.97 : shorter.length >= 12 ? 0.85 : 0.6;
  }
  const dice = diceSimilarity(na, nb);
  const jac = jaccard(titleTokens(na), titleTokens(nb));
  return Math.max(dice, jac);
}

const DAY = 86_400_000;

export function scoreMatch(query: MatchQuery, candidate: MatchCandidate): MatchResult | null {
  const reasons: string[] = [];
  if (query.tiktokVideoId && candidate.tiktok_video_id) {
    if (query.tiktokVideoId === candidate.tiktok_video_id) {
      return { candidate, score: 1, level: 'exact_id', reasons: ['Same TikTok video ID'] };
    }
    return null; // two different ids are two different videos
  }
  if (!query.title) return null;
  let score = titleSimilarity(query.title, candidate.title, query.titleTruncated, candidate.title_truncated);
  if (score >= 0.999) reasons.push('Identical title');
  else if (score >= 0.85) reasons.push('Very similar title');
  else if (score >= 0.6) reasons.push('Similar title');
  else return null;

  if (query.publishedAt && candidate.published_at) {
    const diffDays = Math.abs(new Date(query.publishedAt).getTime() - new Date(candidate.published_at).getTime()) / DAY;
    if (diffDays <= 1.5) {
      score = Math.min(1, score + 0.05);
      reasons.push('Same publication date');
    } else if (diffDays <= 3) {
      reasons.push(`Publication dates ${Math.round(diffDays)} days apart`);
    } else {
      score *= 0.6;
      reasons.push(`Publication dates ${Math.round(diffDays)} days apart`);
    }
  } else {
    reasons.push('Publication date not available to compare');
  }
  const level: MatchLevel | null = score >= 0.9 ? 'likely' : score >= 0.6 ? 'possible' : null;
  if (!level) return null;
  return { candidate, score: Math.round(score * 100) / 100, level, reasons };
}

/** Ranked possible matches for an imported entry (best first, at most `limit`). */
export function findMatches(query: MatchQuery, candidates: MatchCandidate[], limit = 3): MatchResult[] {
  return candidates
    .map((c) => scoreMatch(query, c))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Fingerprint of a screenshot's visible content, used to spot the same screen uploaded twice. */
export function contentFingerprint(entries: { title?: string | null; views?: string | null; published?: string | null }[]): string | null {
  const parts = entries
    .map((e) => `${normaliseTitle(e.title ?? '')}|${(e.views ?? '').replace(/\s/g, '').toLowerCase()}|${(e.published ?? '').trim().toLowerCase()}`)
    .filter((p) => p !== '||');
  if (!parts.length) return null;
  return parts.sort().join('\n');
}
