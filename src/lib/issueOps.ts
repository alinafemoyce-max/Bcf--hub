// Pure helpers that apply edits to issues and record a complete activity history.
import { DONE_STATUSES, type HistoryEntry, type Issue } from '../types';
import { formatDate } from './dates';
import { uid } from './ids';
import type { IssueDraft } from './validation';

export function historyEntry(kind: HistoryEntry['kind'], text: string, at: string): HistoryEntry {
  return { id: uid(), at, kind, text };
}

const FIELD_LABELS: Partial<Record<keyof IssueDraft, string>> = {
  title: 'title',
  description: 'description',
  department: 'department',
  category: 'category',
  priority: 'priority',
  actionOwner: 'action owner',
  resolutionNotes: 'resolution notes',
  dateRaised: 'date raised'
};

/**
 * Returns a new issue with the patch applied and history entries describing every change.
 * Status changes, management responses and follow-up dates get their own entries; other field
 * edits are summarised in one "edited" entry.
 */
export function applyIssueChanges(issue: Issue, patch: Partial<IssueDraft>, at: string, source?: string): Issue {
  const entries: HistoryEntry[] = [];
  const suffix = source ? ` (${source})` : '';
  const next: Issue = { ...issue, ...patch, updatedAt: at };

  if (patch.status !== undefined && patch.status !== issue.status) {
    entries.push(historyEntry(DONE_STATUSES.includes(patch.status) ? 'resolved' : 'status', `Status changed from ${issue.status} to ${patch.status}${suffix}`, at));
    if (DONE_STATUSES.includes(patch.status) && !issue.resolvedAt) next.resolvedAt = at;
    if (!DONE_STATUSES.includes(patch.status)) next.resolvedAt = undefined;
  }
  if (patch.managementResponse !== undefined && patch.managementResponse.trim() !== issue.managementResponse.trim()) {
    entries.push(historyEntry('response', patch.managementResponse.trim() ? `Management response recorded${suffix}: “${truncate(patch.managementResponse.trim(), 160)}”` : `Management response cleared${suffix}`, at));
  }
  if (patch.nextFollowUp !== undefined && patch.nextFollowUp !== issue.nextFollowUp) {
    entries.push(historyEntry('followup', patch.nextFollowUp ? `Next follow-up set to ${formatDate(patch.nextFollowUp)}${suffix}` : `Follow-up date removed${suffix}`, at));
  }
  const changed = (Object.keys(FIELD_LABELS) as (keyof IssueDraft)[]).filter(
    (k) => patch[k] !== undefined && String(patch[k]).trim() !== String(issue[k]).trim()
  );
  if (changed.length) {
    entries.push(historyEntry('edited', `Updated ${listJoin(changed.map((k) => FIELD_LABELS[k]!))}${suffix}`, at));
  }
  next.history = [...issue.history, ...entries];
  return next;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
