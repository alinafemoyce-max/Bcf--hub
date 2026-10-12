import type { Issue } from '../types';
import { Link } from '../state/router';
import { DemoBadge, OverdueBadge, PriorityBadge, StatusBadge } from './ui';
import { isOverdue, overdueDays } from '../lib/metrics';
import { relativeDay } from '../lib/dates';
import { Icon } from './Icon';

export function IssueRow({ issue }: { issue: Issue }) {
  const overdue = isOverdue(issue);
  return (
    <Link to={`/issues/${issue.id}`} className={`row issue-row ${overdue ? 'is-overdue' : ''}`}>
      <div className="row-main">
        <div className="row-meta">
          <span className="ref">{issue.ref}</span>
          <span className="dot-sep">·</span>
          <span className="truncate">{issue.department}</span>
          <DemoBadge show={!!issue.demo} />
          {issue.archived && <span className="badge badge-muted">Archived</span>}
        </div>
        <p className="row-title">{issue.title}</p>
        <div className="row-badges">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {overdue ? (
            <OverdueBadge days={overdueDays(issue)} />
          ) : (
            issue.nextFollowUp &&
            !['Resolved', 'Closed'].includes(issue.status) && (
              <span className="row-date">
                <Icon name="clock" size={13} /> {relativeDay(issue.nextFollowUp)}
              </span>
            )
          )}
        </div>
      </div>
      <Icon name="chevronRight" size={18} className="row-chevron" />
    </Link>
  );
}
