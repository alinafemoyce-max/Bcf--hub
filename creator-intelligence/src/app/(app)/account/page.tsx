import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { AccountForm, DeleteAccountSnapshot } from '@/components/AccountForm';
import { TimeLineChart } from '@/components/charts';
import { Badge, Card, CardTitle, PageTitle } from '@/components/ui';
import { requirePageAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db';
import { compact, date, full } from '@/lib/format';
import { listAccountSnapshots } from '@/lib/repo/account';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  await requirePageAuth();
  const snapshots = await listAccountSnapshots(await getDb());
  const followers = snapshots.filter((s) => s.followers != null);
  return (
    <>
      <Link href="/" className="-ml-1 mb-3 inline-flex items-center gap-0.5 text-[14px] text-ink-3 hover:text-ink">
        <ChevronLeft size={18} /> Home
      </Link>
      <PageTitle title="Account" sub="Account-level data: followers and TikTok’s period totals. Kept separate from video metrics." />
      <Card>
        <CardTitle sub="Add one now and then; growth is calculated between dated snapshots.">Record follower count</CardTitle>
        <AccountForm />
        <p className="mt-3 text-[12.5px] text-ink-3">
          Or upload an <Link href="/import" className="text-accent">account overview screenshot</Link> to capture TikTok’s period totals too.
        </p>
      </Card>
      {followers.length >= 2 && (
        <Card className="mt-4">
          <CardTitle>Followers over time</CardTitle>
          <TimeLineChart label="Followers" data={followers.map((s) => ({ t: s.captured_at, value: s.followers! }))} />
        </Card>
      )}
      <Card className="mt-4">
        <CardTitle>History ({snapshots.length})</CardTitle>
        {snapshots.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">No account snapshots yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...snapshots].reverse().map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px]">
                    <span className="font-medium">{date(s.captured_at, { withTime: true })}</span>
                    <Badge>{s.source === 'screenshot' ? 'Screenshot' : 'Manual'}</Badge>
                  </div>
                  <div className="tnum mt-0.5 text-[12.5px] text-ink-2">
                    {[
                      s.followers != null && `${full(s.followers)} followers`,
                      s.total_likes != null && `${compact(s.total_likes)} total likes`,
                      s.period_views != null && `${compact(s.period_views)} views (${s.period_label ?? 'period'})`,
                      s.period_followers_change != null && `${s.period_followers_change >= 0 ? '+' : ''}${full(s.period_followers_change)} net followers`
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <DeleteAccountSnapshot id={s.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
