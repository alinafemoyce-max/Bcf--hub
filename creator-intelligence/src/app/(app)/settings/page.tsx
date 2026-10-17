import { CheckCircle2, Circle, CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { DataActions, KeepScreenshotsToggle, LogoutButton } from '@/components/SettingsActions';
import { Card, CardTitle, PageTitle } from '@/components/ui';
import { AI_LIMITS, aiUsageSummary } from '@/lib/ai/config';
import { requirePageAuth } from '@/lib/auth/server';
import { configStatus } from '@/lib/config';
import { getDb } from '@/lib/db';
import { full } from '@/lib/format';
import { getSettings } from '@/lib/repo/settings';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requirePageAuth();
  const db = await getDb();
  const config = configStatus();
  const [settings, usage, images] = await Promise.all([
    getSettings(db),
    aiUsageSummary(db),
    db.query<{ n: number }>("select count(*)::int as n from screenshots where image_data is not null and status = 'confirmed'")
  ]);

  const rows = [
    { ok: config.database !== 'missing', label: 'Database', value: config.database === 'postgres' ? 'Postgres (DATABASE_URL)' : config.database === 'local' ? 'Local development database' : 'Not configured' },
    { ok: config.password, label: 'Sign-in password', value: config.password ? 'Set (APP_PASSWORD)' : 'Missing' },
    { ok: config.ai, optional: true, label: 'Claude screenshot reader', value: config.ai ? `Connected · ${config.model}` : 'Not set up (optional). The free on-phone reader and manual entry still work.' }
  ];

  return (
    <>
      <PageTitle title="Settings" />
      <Card>
        <CardTitle>Configuration</CardTitle>
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start gap-2.5">
              {r.ok ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" />
              ) : 'optional' in r ? (
                <Circle size={18} className="mt-0.5 shrink-0 text-ink-3" />
              ) : (
                <CircleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
              )}
              <div>
                <div className="text-[14px] font-medium">{r.label}</div>
                <div className="text-[12.5px] text-ink-3">{r.value}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-3">
          AI requests in the last 24 hours: {usage?.today ?? 0} of {AI_LIMITS.perDay}
          {usage?.failed ? ` (${usage.failed} failed)` : ''} · {full(usage?.input_tokens)} input / {full(usage?.output_tokens)} output tokens.
        </p>
      </Card>

      <Card className="mt-4">
        <CardTitle>Account data</CardTitle>
        <Link href="/account" className="flex min-h-11 items-center justify-between rounded-xl bg-surface-2 px-3.5 text-[14px]">
          Followers and account snapshots <span className="text-ink-3">›</span>
        </Link>
      </Card>

      <Card className="mt-4 space-y-4">
        <CardTitle>Privacy and data</CardTitle>
        <KeepScreenshotsToggle initial={settings.keepScreenshots} />
        <DataActions storedImages={images[0]?.n ?? 0} />
      </Card>

      <Card className="mt-4">
        <CardTitle>Add to Home Screen</CardTitle>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          In Safari, tap the Share button, then <span className="font-medium text-ink">Add to Home Screen</span>. The app opens full screen and stays signed in for 30 days.
        </p>
      </Card>

      <Card className="mt-4">
        <CardTitle>What this app can and can’t know</CardTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>TikTok is not connected. Every number comes from screenshots you import or values you type.</li>
          <li>Numbers TikTok rounds (12.3K) are stored as approximate and marked with ≈.</li>
          <li>The app never fills in missing metrics. Blank means “not captured”.</li>
        </ul>
      </Card>

      <div className="mt-4">
        <LogoutButton />
      </div>
      <p className="mt-4 text-center text-[11.5px] text-ink-3">AJM Creator Intelligence · Phase 1</p>
    </>
  );
}
