// Builds plain-text Teams updates from approved meeting notes. Text only — nothing is posted anywhere.
import type { Issue, Meeting } from '../types';
import type { WeekSummary } from './metrics';
import { formatDate } from './dates';

export function meetingSummaryText(m: Meeting, issues: Issue[]): string {
  const lines: string[] = [];
  const label = m.type === 'BCF' ? 'Business Communication Forum' : 'Pre-BCF reps meeting';
  lines.push(`Hi all,`, '', `Here’s a summary from the ${label} on ${formatDate(m.date, { weekday: true, year: false })}:`, '');
  const items = m.agenda.filter((a) => a.managementResponse.trim() || a.decision.trim());
  if (!items.length) lines.push('• No outcomes were recorded for this meeting.');
  for (const a of items) {
    const issue = a.issueId ? issues.find((i) => i.id === a.issueId) : undefined;
    const area = issue?.department ? ` (${issue.department})` : '';
    lines.push(`• ${a.title}${area}`);
    if (a.managementResponse.trim()) lines.push(`   Response: ${a.managementResponse.trim()}`);
    if (a.decision.trim()) lines.push(`   Outcome: ${a.decision.trim()}`);
    const action = a.actionIssueId ? issues.find((i) => i.id === a.actionIssueId) : undefined;
    if (action?.nextFollowUp) lines.push(`   We’ll follow this up by ${formatDate(action.nextFollowUp, { year: false })}.`);
    lines.push('');
  }
  const open = m.followUps.filter((f) => !f.done);
  if (open.length) {
    lines.push('Next steps from the reps:');
    for (const f of open) lines.push(`• ${f.text}${f.dueDate ? ` (by ${formatDate(f.dueDate, { year: false })})` : ''}`);
    lines.push('');
  }
  lines.push('If you have feedback for the next forum, message any of the apprentice reps. Please don’t share names or personal details in the channel.');
  return lines.join('\n');
}

export function weekSummaryText(s: WeekSummary, priorities: { text: string; done: boolean }[]): string {
  const p = priorities.filter((x) => x.text.trim());
  return [
    `Weekly rep summary · ${formatDate(s.from, { year: false })} – ${formatDate(s.to)}`,
    '',
    `• Issues raised: ${s.raised}`,
    `• Management responses recorded: ${s.responsesRecorded}`,
    `• Issues resolved/closed: ${s.resolved}`,
    `• Feedback logged: ${s.feedbackLogged}`,
    `• Meetings held: ${s.meetingsHeld}`,
    `• Updates published: ${s.updatesPublished}`,
    `• Follow-ups due this week: ${s.followUpsDue} · overdue now: ${s.followUpsOverdue}`,
    '',
    p.length ? `Priorities (${p.filter((x) => x.done).length}/${p.length} done):` : 'No priorities set.',
    ...p.map((x) => `${x.done ? '✓' : '○'} ${x.text}`)
  ].join('\n');
}
