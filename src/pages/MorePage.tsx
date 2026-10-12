import { useData } from '../state/store';
import { Link } from '../state/router';
import { PageHeader } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { formatDate } from '../lib/dates';

export function MorePage() {
  const { feedback, settings } = useData();
  const unlinked = feedback.filter((f) => !f.linkedIssueId).length;
  const items: { to: string; icon: IconName; title: string; text: string; badge?: string }[] = [
    { to: '/feedback', icon: 'chat', title: 'Apprentice feedback', text: 'Log feedback, spot repeated concerns', badge: unlinked ? `${unlinked} unlinked` : undefined },
    { to: '/planner', icon: 'planner', title: 'Weekly planner', text: 'Follow-ups, priorities and weekly summary' },
    { to: '/reports', icon: 'chart', title: 'Reports', text: 'Categories, departments, resolution time, print/PDF' },
    { to: '/updates?tab=templates', icon: 'template', title: 'Message templates', text: 'Reusable text for Teams updates' },
    { to: '/settings', icon: 'settings', title: 'Data & backup', text: settings.lastBackupAt ? `Last backup ${formatDate(settings.lastBackupAt.slice(0, 10))}` : 'No backup yet — export one regularly' },
    { to: '/about', icon: 'shield', title: 'Privacy, security & approval', text: 'How data is handled and what’s needed before real use' }
  ];
  return (
    <div className="page">
      <PageHeader title="More" large subtitle="Tools and settings" />
      <div className="list menu">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="row menu-row">
            <span className="menu-icon">
              <Icon name={i.icon} size={20} />
            </span>
            <div className="row-main">
              <p className="row-title">
                {i.title} {i.badge && <span className="badge badge-amber">{i.badge}</span>}
              </p>
              <p className="row-meta">{i.text}</p>
            </div>
            <Icon name="chevronRight" size={18} className="row-chevron" />
          </Link>
        ))}
      </div>
      <p className="footnote">
        BCF Hub v1.0 · Personal prototype built by an apprentice representative.
        <br />
        Not an official or endorsed Sunseeker International system.
      </p>
    </div>
  );
}
