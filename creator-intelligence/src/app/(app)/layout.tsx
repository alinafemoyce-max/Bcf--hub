import { BottomNav } from '@/components/BottomNav';
import { Header } from '@/components/Header';
import { SetupRequired } from '@/components/SetupRequired';
import { configStatus } from '@/lib/config';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const config = configStatus();
  const missing = [config.database === 'missing' && 'DATABASE_URL', !config.password && 'APP_PASSWORD'].filter(Boolean) as string[];
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-5" style={{ paddingBottom: 'calc(5.5rem + var(--safe-bottom))' }}>
        {missing.length ? <SetupRequired missing={missing} /> : children}
      </main>
      <BottomNav />
    </div>
  );
}
