// Minimal hash router. Hash URLs work on any static host and inside an iOS Home Screen web app.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MouseEvent } from 'react';

interface Route {
  path: string; // e.g. /issues/abc
  query: URLSearchParams;
}

interface RouterValue extends Route {
  navigate(to: string, opts?: { replace?: boolean }): void;
  back(fallback?: string): void;
}

const RouterContext = createContext<RouterValue | null>(null);

function readHash(): Route {
  const raw = decodeURI(window.location.hash.replace(/^#/, '')) || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(qs) };
}

// In-memory stack of visited paths, so "Back" only uses browser history for in-app pages.
const stack: string[] = [];

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(readHash);
  useEffect(() => {
    if (!stack.length) stack.push(readHash().path);
    const on = () => {
      const r = readHash();
      if (stack.length > 1 && stack[stack.length - 2] === r.path) stack.pop();
      else stack.push(r.path);
      setRoute(r);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const navigate = useCallback((to: string, opts: { replace?: boolean } = {}) => {
    const target = `#${to}`;
    if (opts.replace) {
      try {
        history.replaceState(history.state, '', target);
      } catch {
        location.replace(target); // some sandboxed frames refuse replaceState
      }
      const r = readHash();
      stack[stack.length - 1] = r.path;
      setRoute(r);
    } else if (window.location.hash !== target) {
      window.location.hash = to;
    }
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(
    (fallback = '/') => {
      if (stack.length > 1) history.back();
      else navigate(fallback, { replace: true });
    },
    [navigate]
  );

  return <RouterContext.Provider value={{ ...route, navigate, back }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const v = useContext(RouterContext);
  if (!v) throw new Error('useRouter must be used inside RouterProvider');
  return v;
}

/** Matches '/issues/:id' style patterns. Returns params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, ariaLabel, current }: { to: string; children: ReactNode; className?: string; ariaLabel?: string; current?: boolean }) {
  const { navigate } = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={`#${to}`} onClick={onClick} className={className} aria-label={ariaLabel} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  );
}
