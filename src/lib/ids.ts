export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatIssueRef(n: number): string {
  return `BCF-${String(n).padStart(4, '0')}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
