import { useEffect, type ReactNode } from 'react';
import { matchPath, useRouter, Link } from './state/router';
import { Icon, type IconName } from './components/Icon';
import { HomePage } from './pages/HomePage';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { IssueFormPage } from './pages/IssueFormPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { MeetingFormPage } from './pages/MeetingFormPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { UpdateEditorPage } from './pages/UpdateEditorPage';
import { MorePage } from './pages/MorePage';
import { FeedbackPage } from './pages/FeedbackPage';
import { PlannerPage } from './pages/PlannerPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { EmptyState, PageHeader } from './components/ui';

type RouteDef = [pattern: string, render: (p: Record<string, string>) => ReactNode, tab: Tab];
type Tab = 'home' | 'issues' | 'meetings' | 'updates' | 'more';

const ROUTES: RouteDef[] = [
  ['/', () => <HomePage />, 'home'],
  ['/issues', () => <IssuesPage />, 'issues'],
  ['/issues/new', () => <IssueFormPage />, 'issues'],
  ['/issues/:id', (p) => <IssueDetailPage id={p.id} />, 'issues'],
  ['/issues/:id/edit', (p) => <IssueFormPage id={p.id} />, 'issues'],
  ['/meetings', () => <MeetingsPage />, 'meetings'],
  ['/meetings/new', () => <MeetingFormPage />, 'meetings'],
  ['/meetings/:id', (p) => <MeetingDetailPage id={p.id} />, 'meetings'],
  ['/meetings/:id/edit', (p) => <MeetingFormPage id={p.id} />, 'meetings'],
  ['/updates', () => <UpdatesPage />, 'updates'],
  ['/updates/new', () => <UpdateEditorPage />, 'updates'],
  ['/updates/:id', (p) => <UpdateEditorPage id={p.id} />, 'updates'],
  ['/more', () => <MorePage />, 'more'],
  ['/feedback', () => <FeedbackPage />, 'more'],
  ['/planner', () => <PlannerPage />, 'more'],
  ['/reports', () => <ReportsPage />, 'more'],
  ['/settings', () => <SettingsPage />, 'more'],
  ['/about', () => <AboutPage />, 'more']
];

const TABS: { tab: Tab; to: string; label: string; icon: IconName }[] = [
  { tab: 'home', to: '/', label: 'Home', icon: 'home' },
  { tab: 'issues', to: '/issues', label: 'Issues', icon: 'issues' },
  { tab: 'meetings', to: '/meetings', label: 'Meetings', icon: 'calendar' },
  { tab: 'updates', to: '/updates', label: 'Updates', icon: 'megaphone' },
  { tab: 'more', to: '/more', label: 'More', icon: 'more' }
];

export function App() {
  const { path } = useRouter();
  let content: ReactNode = null;
  let tab: Tab = 'home';
  for (const [pattern, render, t] of ROUTES) {
    const params = matchPath(pattern, path);
    if (params) {
      content = render(params);
      tab = t;
      break;
    }
  }
  if (!content) {
    content = (
      <div className="page">
        <PageHeader title="Not found" back="/" />
        <EmptyState icon="info" title="Page not found" action={<Link to="/" className="btn btn-secondary">Go home</Link>} />
      </div>
    );
  }

  useEffect(() => {
    const titles: Record<Tab, string> = { home: 'Home', issues: 'Issues', meetings: 'Meetings', updates: 'Updates', more: 'More' };
    document.title = `${titles[tab]} · BCF Hub`;
  }, [tab]);

  return (
    <div className="app">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <main id="main" tabIndex={-1} key={path} className="main">
        {content}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.tab} to={t.to} className={`tab ${tab === t.tab ? 'active' : ''}`} current={tab === t.tab}>
            <Icon name={t.icon} size={23} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
