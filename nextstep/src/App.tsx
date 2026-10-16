import { Component, useEffect, useState, type ReactNode } from 'react';
import { Empty, TabBar, ToastProvider, TopBar } from './components/ui';
import { dataReady, loadData } from './lib/data';
import AboutPage from './pages/AboutPage';
import CareerPage from './pages/CareerPage';
import ComparePage from './pages/ComparePage';
import DiscoverPage from './pages/DiscoverPage';
import ExplorePage from './pages/ExplorePage';
import MapPage from './pages/MapPage';
import Onboarding from './pages/Onboarding';
import Paths from './pages/Paths';
import PlanPage from './pages/PlanPage';
import SavedPage from './pages/SavedPage';
import Welcome from './pages/Welcome';
import { useRoute, type Route } from './state/router';
import { StoreProvider } from './state/store';

function Screen({ route }: { route: Route }) {
  const [section, id] = route.parts;
  switch (section) {
    case undefined:
      return <Welcome />;
    case 'start':
      return <Onboarding route={route} />;
    case 'paths':
      return <Paths />;
    case 'career':
      return <CareerPage key={id} slug={id ?? ''} />;
    case 'plan':
      return <PlanPage key={id} slug={id ?? ''} />;
    case 'map':
      return <MapPage key={route.path} route={route} />;
    case 'compare':
      return <ComparePage route={route} />;
    case 'discover':
      return <DiscoverPage route={route} />;
    case 'explore':
      return <ExplorePage />;
    case 'saved':
      return <SavedPage />;
    case 'about':
      return <AboutPage />;
    default:
      return (
        <>
          <TopBar title="Not found" backTo="/" />
          <main className="page">
            <Empty emoji="🧭" title="This page doesn’t exist">
              <a className="btn btn-primary" href="#/">
                Go to the start
              </a>
            </Empty>
          </main>
        </>
      );
  }
}

const NO_TABS = new Set([undefined, 'start']);

function Shell() {
  const route = useRoute();
  const [ready, setReady] = useState(dataReady());
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready)
      loadData()
        .then(() => setReady(true))
        .catch(() => setFailed(true));
  }, [ready]);
  const section = route.parts[0];
  const discoverQuestions = section === 'discover' && route.parts[1] !== 'results';
  const needsData = section !== undefined;

  let body: ReactNode;
  if (failed) body = <LoadError />;
  else if (needsData && !ready)
    body = (
      <div className="loading" role="status">
        <div className="spinner" />
        <span className="sr-only">Loading careers…</span>
      </div>
    );
  else body = <Screen route={route} />;

  return (
    <div className="app">
      {body}
      {!NO_TABS.has(section) && !discoverQuestions && <TabBar section={section ?? ''} />}
    </div>
  );
}

function LoadError() {
  return (
    <main className="page">
      <Empty emoji="📡" title="Couldn’t load career information">
        <p className="muted" style={{ marginBottom: 16 }}>
          Check your connection and try again.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </Empty>
    </main>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page">
        <Empty emoji="🛠️" title="Something went wrong">
          <p className="muted" style={{ marginBottom: 16 }}>
            Sorry – please try again. Your saved progress is still on this device.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            Back to the start
          </button>
        </Empty>
      </main>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
}
