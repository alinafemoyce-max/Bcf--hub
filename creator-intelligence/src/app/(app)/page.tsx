import { Camera, Info, Upload, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { TimeLineChart, TrendChart } from '@/components/charts';
import { RangeFilter } from '@/components/RangeFilter';
import { Badge, Card, CardTitle, Stat } from '@/components/ui';
import { VideoRow } from '@/components/VideoRow';
import { requirePageAuth } from '@/lib/auth/server';
import { buildUpdateQueue } from '@/lib/checkpoints';
import { loadLibrary } from '@/lib/data';
import { getDb } from '@/lib/db';
import { ago, compact, date, full, pct } from '@/lib/format';
import { computeDashboard, ENGAGEMENT_DEFINITION, groupSnapshots, resolveRange } from '@/lib/metrics';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requirePageAuth();
  const sp = await searchParams;
  const db = await getDb();
  const { videos, snapshots, accountSnapshots } = await loadLibrary(db);
  const now = new Date();
  const { key, range } = resolveRange(sp.range, now, sp.from, sp.to);
  const d = computeDashboard({ videos, snapshots, accountSnapshots, range });
  const queue = buildUpdateQueue(videos, groupSnapshots(snapshots), now);

  if (!videos.length && !accountSnapshots.length) {
    return (
      <>
        <h1 className="mb-1 text-[26px] font-bold tracking-tight">Welcome</h1>
        <p className="mb-5 text-[14px] text-ink-3">No data yet. Everything on the dashboard comes from what you import, so start here:</p>
        <div className="space-y-3">
          <StepCard n={1} title="Import your past videos" href="/import" icon={<Upload size={18} />}>
            Upload screenshots of your TikTok Studio post list. One screenshot can contain many videos.
          </StepCard>
          <StepCard n={2} title="Record your follower count" href="/account" icon={<Users size={18} />}>
            Add today’s followers (or an account overview screenshot) so growth can be measured from now on.
          </StepCard>
          <StepCard n={3} title="Track each new upload" href="/videos/new" icon={<Camera size={18} />}>
            Add new videos when you post, then upload analytics screenshots at 24 hours, 72 hours, 7 days and 30 days.
          </StepCard>
        </div>
      </>
    );
  }

  const rangeLabel =
    key === 'all' ? 'All time' : key === 'custom' ? `${date(d.range.start)} – ${date(d.range.end)}` : `Last ${key.replace('d', '')} days`;

  return (
    <>
      <Suspense>
        <RangeFilter current={key} from={sp.from} to={sp.to} />
      </Suspense>

      <section className="animate-in mb-4">
        <div className="text-[13px] text-ink-3">{rangeLabel} · videos published in this period</div>
        <div className="tnum mt-1 text-[48px] leading-none font-bold tracking-tight">
          {d.totals.views.n ? (
            <>
              {d.totals.views.approximate && <span className="text-ink-3">≈</span>}
              {compact(d.totals.views.sum)}
            </>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </div>
        <div className="mt-1.5 text-[13px] leading-snug text-ink-3">
          Lifetime views of {d.videosPublished} {d.videosPublished === 1 ? 'video' : 'videos'} as of their latest snapshots
          {d.totals.views.n < d.videosPublished && ` (${d.videosPublished - d.totals.views.n} without view data)`}.
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Videos published" value={full(d.videosPublished)} sub={d.undatedVideos ? `${d.undatedVideos} undated not counted` : undefined} />
        <Stat label="Median views / video" value={compact(d.medianViews)} sub={d.viewsN ? `Average ${compact(d.averageViews)}` : 'No view data'} />
        <Stat
          label="Views gained"
          value={d.viewsGained ? compact(d.viewsGained.value) : '—'}
          sub={
            d.viewsGained
              ? `From snapshots of ${d.viewsGained.videosCounted} ${d.viewsGained.videosCounted === 1 ? 'video' : 'videos'}${d.viewsGained.videosWithoutBaseline ? `, ${d.viewsGained.videosWithoutBaseline} lack a start snapshot` : ''}`
              : 'Pick a date range'
          }
        />
        <Stat label="Engagement rate" value={pct(d.engagement.rate)} sub={d.engagement.n ? `${d.engagement.n} ${d.engagement.n === 1 ? 'video' : 'videos'} with full data` : 'Needs likes, comments & shares'} />
        <Stat
          label="Followers"
          value={full(d.followers.latest)}
          sub={
            d.followers.change != null ? (
              <span className={d.followers.change >= 0 ? 'text-good' : 'text-bad'}>
                {d.followers.change >= 0 ? '+' : ''}
                {full(d.followers.change)} since {date(d.followers.baselineAt, { withYear: false })}
              </span>
            ) : d.followers.latest != null ? (
              `as of ${date(d.followers.latestAt, { withYear: false })}`
            ) : (
              <Link href="/account" className="text-accent">
                Add follower count
              </Link>
            )
          }
        />
        <Stat label="Likes" value={compact(d.totals.likes.n ? d.totals.likes.sum : null)} approximate={d.totals.likes.approximate} sub={coverage(d.totals.likes.n, d.videosPublished)} />
        <Stat label="Comments" value={compact(d.totals.comments.n ? d.totals.comments.sum : null)} approximate={d.totals.comments.approximate} sub={coverage(d.totals.comments.n, d.videosPublished)} />
        <Stat label="Shares" value={compact(d.totals.shares.n ? d.totals.shares.sum : null)} approximate={d.totals.shares.approximate} sub={coverage(d.totals.shares.n, d.videosPublished)} />
        <Stat label="Saves" value={compact(d.totals.saves.n ? d.totals.saves.sum : null)} approximate={d.totals.saves.approximate} sub={coverage(d.totals.saves.n, d.videosPublished)} />
        <Stat
          label="Latest data"
          value={<span className="text-[17px]">{d.latestSnapshotAt ? ago(d.latestSnapshotAt, now) : '—'}</span>}
          sub={d.latestSnapshotAt ? date(d.latestSnapshotAt) : 'No snapshots yet'}
        />
      </div>

      <details className="mt-2 rounded-xl px-1 text-[12.5px] text-ink-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5">
          <Info size={14} /> How these numbers are calculated
        </summary>
        <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
          <li>Totals are lifetime numbers of the videos published in the selected period, taken from each video’s latest snapshot on or before the period end. They are not “views earned during the period”.</li>
          <li>“Views gained” compares each video’s snapshot at the end of the period with its snapshot at the start (or zero if it was published during the period). Videos without a start snapshot are left out.</li>
          <li>{ENGAGEMENT_DEFINITION}</li>
          <li>“≈” means TikTok showed a rounded figure (e.g. 12.3K).</li>
        </ul>
      </details>

      {queue.length > 0 && (
        <Card className="mt-4 border-accent/30">
          <CardTitle sub="Based on publish times. TikTok isn’t connected, so these are reminders, not live alerts." action={<Badge tone="accent">{queue.length}</Badge>}>
            Screenshots to collect
          </CardTitle>
          <ul className="divide-y divide-line">
            {queue.slice(0, 6).map(({ video, review }) => (
              <li key={video.id}>
                <Link href={`/import?video=${video.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="line-clamp-1 text-[14px] text-ink">{video.title}</span>
                  <Badge tone={review.status === 'due' ? 'warn' : 'neutral'}>
                    {review.checkpoint!.label} {review.status === 'due' ? 'due now' : `from ${date(review.windowStart, { withYear: false, withTime: true })}`}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <CardTitle sub="Each bar is one video, in the order published.">Performance trend</CardTitle>
        {d.trend.length >= 2 ? (
          <TrendChart data={d.trend} />
        ) : (
          <p className="py-6 text-center text-[13.5px] text-ink-3">Needs at least two dated videos with view counts in this period.</p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle sub="By latest views">Best performing</CardTitle>
          {d.best.length ? d.best.map((p) => <VideoRow key={p.video.id} video={p.video} views={p.views} viewsApproximate={p.viewsApproximate} />) : <Muted>No view data in this period.</Muted>}
        </Card>
        <Card>
          <CardTitle sub="Videos at least 3 days old">Lowest performing</CardTitle>
          {d.worst.length ? d.worst.map((p) => <VideoRow key={p.video.id} video={p.video} views={p.views} viewsApproximate={p.viewsApproximate} />) : <Muted>Not enough videos yet.</Muted>}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle sub="Median views of videos published in the period. Small groups are not reliable evidence.">By content category</CardTitle>
        {d.byCategory.length ? <CategoryBars rows={d.byCategory} /> : <Muted>No videos in this period.</Muted>}
      </Card>

      {d.followers.snapshots.length >= 2 && (
        <Card className="mt-4">
          <CardTitle sub="Account-level, from your follower snapshots">Followers</CardTitle>
          <TimeLineChart label="Followers" data={d.followers.snapshots.map((s) => ({ t: s.t, value: s.followers }))} />
        </Card>
      )}

      {d.tiktokReported && (
        <Card className="mt-4">
          <CardTitle sub={`Account-level totals as reported by TikTok on ${date(d.tiktokReported.captured_at)}`}>
            TikTok Studio: {d.tiktokReported.period_label ?? 'reported period'}
          </CardTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Video views" value={compact(d.tiktokReported.period_views)} approximate={d.tiktokReported.approximate_fields.includes('period_views')} />
            <Stat label="Profile views" value={compact(d.tiktokReported.period_profile_views)} />
            <Stat label="Likes" value={compact(d.tiktokReported.period_likes)} />
            <Stat label="Net followers" value={d.tiktokReported.period_followers_change == null ? '—' : `${d.tiktokReported.period_followers_change >= 0 ? '+' : ''}${full(d.tiktokReported.period_followers_change)}`} />
          </div>
        </Card>
      )}
    </>
  );
}

function coverage(n: number, total: number) {
  if (!total) return undefined;
  if (n === 0) return 'Not captured yet';
  return n < total ? `From ${n} of ${total} videos` : `All ${total} videos`;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-[13.5px] text-ink-3">{children}</p>;
}

function CategoryBars({ rows }: { rows: { category: string; count: number; medianViews: number | null; withViews: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.medianViews ?? 0));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.category}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="truncate text-ink">{r.category}</span>
            <span className="tnum shrink-0 text-ink-2">
              {compact(r.medianViews)} <span className="text-ink-3">· {r.count} {r.count === 1 ? 'video' : 'videos'}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-accent-soft">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(2, ((r.medianViews ?? 0) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StepCard({ n, title, href, icon, children }: { n: number; title: string; href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="block">
      <Card className="flex gap-3 transition-colors hover:border-line-strong">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</div>
        <div>
          <div className="text-[12px] font-medium text-ink-3">Step {n}</div>
          <div className="text-[15px] font-semibold">{title}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{children}</p>
        </div>
      </Card>
    </Link>
  );
}

export const metadata = { title: 'Home' };
