import { appUrl } from '../state/router';
import { career } from './data';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older Safari: fall back to a temporary textarea.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Uses the iPhone share sheet when available, otherwise copies to the clipboard. */
export async function shareOrCopy(data: { title: string; text: string; url?: string }): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText([data.text, data.url].filter(Boolean).join('\n\n'))) ? 'copied' : 'failed';
}

/** Public link to a career page – contains only the career's id, never anything from the user's profile. */
export const careerLink = (slug: string) => `${appUrl()}#/career/${encodeURIComponent(slug)}`;

/** A shareable summary of a career that contains no personal details. */
export function careerShareText(slug: string): string {
  const c = career(slug);
  if (!c) return '';
  const routes = c.routesIntro.length ? `\nWays in: ${c.routesIntro.join('; ')}.` : '';
  return `${c.title} — explored with NextStep\n${c.summary}${routes}`;
}

export const shareMessage = (r: ShareResult) =>
  r === 'shared' ? 'Shared' : r === 'copied' ? 'Copied to clipboard' : r === 'cancelled' ? '' : 'Sharing isn’t available here – try copying the link';
