// Tiny hash router: works on any static host and inside a Home Screen web app.
import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(to: string) {
  const next = to.startsWith('#') ? to : `#${to}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

// Number of in-app navigations, so "Back" never leaves the app.
let depth = 0;
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => depth++);

/** Go back within the app if possible, otherwise to a sensible parent screen. */
export function back(fallback = '/') {
  if (depth > 0) {
    depth -= 2; // the hashchange fired by history.back() adds one back
    window.history.back();
  } else go(fallback);
}

/** The public link to the app itself (never contains anything personal). */
export function appUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}
