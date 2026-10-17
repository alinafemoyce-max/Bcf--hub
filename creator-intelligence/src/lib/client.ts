// Browser helper for calling the app's JSON API with consistent error handling.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body
    });
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data?.code === 'unauthorised') {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status, data?.code, data?.details);
  return data as T;
}
