import { configStatus } from '@/lib/config';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const config = configStatus();
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="mb-8">
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent text-[15px] font-black text-white">AJM</div>
        <h1 className="text-[28px] font-bold tracking-tight">Creator Intelligence</h1>
        <p className="mt-1 text-[15px] text-ink-3">Your TikTok performance, analysed.</p>
      </div>
      {!config.password || config.database === 'missing' ? (
        <div className="rounded-2xl border border-warn/30 bg-warn/10 p-4 text-[14px] leading-relaxed">
          <p className="font-semibold">Setup needed</p>
          <p className="mt-1 text-ink-2">
            Add {[!config.password && 'APP_PASSWORD', config.database === 'missing' && 'DATABASE_URL'].filter(Boolean).join(' and ')} to the
            hosting environment variables, then redeploy. The README explains each step.
          </p>
        </div>
      ) : (
        <LoginForm next={safeNext} />
      )}
    </main>
  );
}
