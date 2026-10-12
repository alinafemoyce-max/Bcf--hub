'use client';

/** Browser helpers that also work over plain http:// on a local network (no secure context). */

export function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy approach
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store'
    });
  } catch {
    throw new ApiError('Cannot reach the WoodmillFlow server. Check the connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fieldErrors);
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

/** Tracking links for requests submitted from this device (a convenience, not the order database). */
const MY_KEY = 'woodmillflow.myRequests';

export function savedTokens(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function saveToken(token: string) {
  try {
    const list = [token, ...savedTokens().filter((t) => t !== token)].slice(0, 50);
    localStorage.setItem(MY_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private browsing) — the tracking link still works
  }
}

export async function switchRole(role: 'employee' | 'operator') {
  await api('/api/demo/role', { body: { role } });
}
