import { lazy, Suspense, useEffect, useState } from 'react';
import { repo } from '@/data';
import { AppDataProvider, useAppData } from '@/ui/hooks/useAppData';
import { FeedbackProvider } from '@/ui/components/feedback';
import { ErrorBoundary, LoadingScreen, EmptyState } from '@/ui/components/common';
import { BottomNav } from '@/ui/components/BottomNav';
import { useRoute, Link } from '@/ui/router';
import { Dashboard } from '@/ui/pages/Dashboard';
import { TrainPage } from '@/ui/pages/Train';
import { TemplateEditor } from '@/ui/pages/TemplateEditor';
import { StartWorkout } from '@/ui/pages/StartWorkout';
import { LiveWorkout } from '@/ui/pages/LiveWorkout';
import { WorkoutSummary } from '@/ui/pages/WorkoutSummary';
import { HistoryPage } from '@/ui/pages/History';
import { SessionDetail } from '@/ui/pages/SessionDetail';
import { SessionEditor } from '@/ui/pages/SessionEditor';
import { LibraryPage } from '@/ui/pages/Library';
import { ExerciseDetail } from '@/ui/pages/ExerciseDetail';
import { ExerciseForm } from '@/ui/pages/ExerciseForm';
import { ProfilePage } from '@/ui/pages/Profile';
import { StartingWeights } from '@/ui/pages/StartingWeights';
import { WeeklyReviewPage } from '@/ui/pages/WeeklyReview';
import { Onboarding } from '@/ui/pages/Onboarding';
import { Button } from '@/ui/components/ui/button';
import { SearchX } from 'lucide-react';

// Charts (Recharts) are only needed on the Progress screen, so load them on demand.
const ProgressPage = lazy(() => import('@/ui/pages/Progress'));

function Routes() {
  const { segments } = useRoute();
  const [a, b, c] = segments;
  switch (a) {
    case undefined:
      return <Dashboard />;
    case 'train':
      if (b === 'template' && c) return <TemplateEditor id={c} />;
      if (b === 'start' && c) return <StartWorkout templateId={c} />;
      if (b === 'live') return <LiveWorkout />;
      if (b === 'summary' && c) return <WorkoutSummary id={c} />;
      return <TrainPage />;
    case 'progress':
      return (
        <Suspense fallback={<LoadingScreen label="Loading charts…" />}>
          <ProgressPage />
        </Suspense>
      );
    case 'history':
      if (b === 'new') return <SessionEditor id={null} />;
      if (b && c === 'edit') return <SessionEditor id={b} />;
      if (b) return <SessionDetail id={b} />;
      return <HistoryPage />;
    case 'library':
      if (b === 'new') return <ExerciseForm id={null} />;
      if (b && c === 'edit') return <ExerciseForm id={b} />;
      if (b) return <ExerciseDetail id={b} />;
      return <LibraryPage />;
    case 'profile':
      if (b === 'starting-weights') return <StartingWeights />;
      return <ProfilePage />;
    case 'review':
      return <WeeklyReviewPage week={b} />;
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="pt-24">
      <EmptyState
        icon={<SearchX />}
        title="Page not found"
        action={
          <Button asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}

function Shell() {
  const data = useAppData();
  const { segments } = useRoute();
  if (!data.profile?.onboardedAt) return <Onboarding />;
  const hideNav = segments[0] === 'train' && segments[1] === 'live';
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <main className={hideNav ? 'px-4 pb-40' : 'px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]'}>
        <Routes />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  useEffect(() => {
    repo
      .init()
      .then(() => setState('ready'))
      .catch((e: unknown) => setState(e instanceof Error ? e : new Error(String(e))));
    // Ask the browser not to evict training data under storage pressure.
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  if (state === 'loading') return <LoadingScreen />;
  if (state instanceof Error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-bold">Storage unavailable</h1>
        <p className="text-sm text-muted-foreground">
          AthleteOS couldn’t open its on-device database. Private browsing can block storage — open the app in a normal tab, or add it to your Home Screen.
        </p>
        <pre className="overflow-auto rounded-xl bg-card p-3 text-left text-xs text-muted-foreground">{state.message}</pre>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }
  return (
    <ErrorBoundary>
      <FeedbackProvider>
        <AppDataProvider fallback={<LoadingScreen />}>
          <Shell />
        </AppDataProvider>
      </FeedbackProvider>
    </ErrorBoundary>
  );
}
