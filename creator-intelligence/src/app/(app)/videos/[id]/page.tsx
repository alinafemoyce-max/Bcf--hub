import { ChevronLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TimeLineChart } from '@/components/charts';
import { DeleteSnapshotButton, SnapshotForm } from '@/components/SnapshotForm';
import { Badge, Card, CardTitle, Stat, Thumb } from '@/components/ui';
import { VideoActions } from '@/components/VideoActions';
import { VideoRow } from '@/components/VideoRow';
import { requirePageAuth } from '@/lib/auth/server';
import { checkpointValues, nextReview } from '@/lib/checkpoints';
import { getDb } from '@/lib/db';
import { compact, date, full, hoursLabel, pct, published, RECORD_TYPE_LABEL, seconds } from '@/lib/format';
import { relatedVideos } from '@/lib/library';
import { engagementOf, groupSnapshots, videoPerformance } from '@/lib/metrics';
import { getVideo, listSnapshots, listVideos } from '@/lib/repo/videos';
import type { Snapshot } from '@/lib/types';

export const metadata = { title: 'Video' };

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAuth();
  const { id } = await params;
  const db = await getDb();
  const video = await getVideo(db, id);
  if (!video) notFound();
  const [allSnapshots, all] = await Promise.all([listSnapshots(db), listVideos(db)]);
  const byVideo = groupSnapshots(allSnapshots);
  const snapshots = byVideo.get(id) ?? [];
  const now = new Date();
  const perf = videoPerformance(video, snapshots, now);
  const latestDetailed = [...snapshots].reverse().find((s) => s.completeness === 'detailed') ?? null;
  const checkpoints = checkpointValues(video, snapshots);
  const review = nextReview(video, snapshots, now);
  const related = relatedVideos(video, all);
  const viewSeries = snapshots.filter((s) => s.views != null).map((s) => ({ t: s.captured_at, value: s.views! }));
  const approx = (s: Snapshot | null, k: string) => (s?.approximate_fields.includes(k) ? '≈' : '');

  return (
    <>
      <Link href="/videos" className="-ml-1 mb-3 inline-flex items-center gap-0.5 text-[14px] text-ink-3 hover:text-ink">
        <ChevronLeft size={18} /> Videos
      </Link>
      <div className="mb-4 flex gap-3">
        <Thumb src={video.thumbnail_data} alt="" size={64} />
        <div className="min-w-0">
          <h1 className="text-[19px] leading-snug font-bold tracking-tight">
            {video.title}
            {video.title_truncated && <span className="text-ink-3">…</span>}
          </h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={video.record_type === 'tracked' ? 'accent' : 'neutral'}>{RECORD_TYPE_LABEL[video.record_type]}</Badge>
            {video.tracking_status === 'archived' && <Badge>Not tracking</Badge>}
            {video.title_truncated && <Badge tone="warn">Title truncated in screenshot</Badge>}
          </div>
          <div className="mt-1.5 text-[13px] text-ink-3">
            {published(video.published_at, video.published_at_precision)}
            {video.duration_seconds != null && ` · ${seconds(video.duration_seconds)}`}
            {video.tiktok_url && (
              <>
                {' · '}
                <a href={video.tiktok_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent">
                  TikTok <ExternalLink size={12} />
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {video.record_type === 'historical_basic' && (
        <p className="mb-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-ink-3">
          Imported from a post-list screenshot, so it usually has views only. Upload this video’s analytics screen to add detail.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Views" value={compact(perf.views)} approximate={perf.viewsApproximate} />
        <Stat label="Likes" value={compact(perf.likes)} />
        <Stat label="Comments" value={compact(perf.comments)} />
        <Stat label="Shares" value={compact(perf.shares)} />
        <Stat label="Saves" value={compact(perf.saves)} />
        <Stat label="Engagement" value={pct(perf.engagement)} />
        <Stat label="Avg watch" value={seconds(latestDetailed?.avg_watch_time_seconds)} />
        <Stat label="Full watch" value={latestDetailed?.completion_rate != null ? `${latestDetailed.completion_rate}%` : '—'} />
        <Stat label="New followers" value={full(latestDetailed?.new_followers)} />
      </div>
      <p className="mt-1.5 text-[12px] text-ink-3">
        Latest values from snapshots{perf.asOf ? ` (newest ${date(perf.asOf, { withTime: true })})` : ''}. Engagement = (likes + comments + shares) ÷ views from the same snapshot.
      </p>

      <div className="mt-4">
        <VideoActions video={video} />
      </div>

      <Card className="mt-4">
        <CardTitle
          sub={video.published_at_precision === 'datetime' ? 'Closest snapshot to each point after publishing' : 'Publish time is only known to the day, so ages are approximate (±12h)'}
          action={
            review.status === 'due' ? (
              <Badge tone="warn">{review.checkpoint!.label} due</Badge>
            ) : review.status === 'upcoming' ? (
              <Badge>Next: {review.checkpoint!.label}</Badge>
            ) : review.status === 'complete' ? (
              <Badge tone="good">Tracking complete</Badge>
            ) : review.status === 'needs_publish_date' ? (
              <Badge tone="warn">Add publish date</Badge>
            ) : null
          }
        >
          Checkpoints
        </CardTitle>
        <div className="grid grid-cols-4 gap-2 text-center">
          {checkpoints.map((c) => (
            <div key={c.def.key} className="rounded-xl bg-surface-2 px-1 py-2.5">
              <div className="text-[11.5px] text-ink-3">{c.def.key}</div>
              <div className="tnum mt-0.5 text-[16px] font-semibold">{c.snapshot ? `${approx(c.snapshot, 'views')}${compact(c.snapshot.views)}` : '—'}</div>
              <div className="text-[11px] text-ink-3">{c.ageHours != null ? `at ${c.approximateAge ? '~' : ''}${hoursLabel(c.ageHours)}` : 'no data'}</div>
            </div>
          ))}
        </div>
        {review.missed.length > 0 && <p className="mt-2 text-[12px] text-ink-3">Missed windows: {review.missed.join(', ')}. These can’t be recovered, which is fine.</p>}
      </Card>

      {viewSeries.length >= 2 && (
        <Card className="mt-4">
          <CardTitle sub="Each point is a dated snapshot">Views over time</CardTitle>
          <TimeLineChart label="Views" data={viewSeries} />
        </Card>
      )}

      <Card className="mt-4">
        <CardTitle sub="Every observation is kept; nothing is overwritten.">Snapshot history ({snapshots.length})</CardTitle>
        {snapshots.length === 0 && <p className="mb-3 text-[13.5px] text-ink-3">No metrics recorded yet.</p>}
        <ul className="mb-3 divide-y divide-line">
          {[...snapshots].reverse().map((s) => (
            <li key={s.id} className="flex items-start gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span className="font-medium text-ink">{date(s.captured_at, { withTime: true })}</span>
                  <Badge>{s.source === 'screenshot' ? 'Screenshot' : s.source === 'manual' ? 'Manual' : 'API'}</Badge>
                  {s.completeness === 'detailed' && <Badge tone="accent">Detailed</Badge>}
                </div>
                <div className="tnum mt-1 text-[12.5px] leading-relaxed text-ink-2">
                  {[
                    s.views != null && `${approx(s, 'views')}${full(s.views)} views`,
                    s.likes != null && `${approx(s, 'likes')}${full(s.likes)} likes`,
                    s.comments != null && `${full(s.comments)} comments`,
                    s.shares != null && `${full(s.shares)} shares`,
                    s.saves != null && `${full(s.saves)} saves`,
                    s.avg_watch_time_seconds != null && `${seconds(s.avg_watch_time_seconds)} avg watch`,
                    s.completion_rate != null && `${s.completion_rate}% full watch`,
                    s.new_followers != null && `${full(s.new_followers)} new followers`,
                    engagementOf(s) != null && `${pct(engagementOf(s))} engagement`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {s.traffic_sources?.length ? (
                  <div className="mt-1 text-[12px] text-ink-3">Traffic: {s.traffic_sources.map((t) => `${t.source} ${t.percent}%`).join(', ')}</div>
                ) : null}
                {retentionNote(s) && <div className="mt-1 text-[12px] text-ink-3">Retention: {retentionNote(s)}</div>}
                {s.notes && <div className="mt-1 text-[12px] text-ink-3">{s.notes}</div>}
              </div>
              <DeleteSnapshotButton id={s.id} />
            </li>
          ))}
        </ul>
        <SnapshotForm videoId={video.id} />
      </Card>

      <Card className="mt-4">
        <CardTitle action={<Link href={`/videos/${video.id}/edit`} className="text-[13px] text-accent">Edit</Link>}>Content details</CardTitle>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
          {(
            [
              ['Category', video.category],
              ['Topic', video.topic],
              ['Format', video.format],
              ['Hook', video.hook],
              ['Hook style', video.hook_style],
              ['On camera', yn(video.on_camera)],
              ['Voiceover', yn(video.voiceover)],
              ['Own car', yn(video.shows_own_car)],
              ['Hashtags', video.hashtags.length ? video.hashtags.map((h) => `#${h}`).join(' ') : null],
              ['Caption', video.caption],
              ['Notes', video.notes]
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className={v ? 'break-words text-ink' : 'text-ink-3'}>{v || 'Not set'}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {related.length > 0 && (
        <Card className="mt-4">
          <CardTitle sub="Shares the topic or key title words (text similarity only)">Related videos</CardTitle>
          {related.map(({ video: v }) => {
            const p = videoPerformance(v, byVideo.get(v.id), now);
            return <VideoRow key={v.id} video={v} views={p.views} viewsApproximate={p.viewsApproximate} />;
          })}
        </Card>
      )}
    </>
  );
}

function yn(v: boolean | null) {
  return v == null ? null : v ? 'Yes' : 'No';
}

function retentionNote(s: Snapshot): string | null {
  const r = s.retention as { notes?: string } | null;
  return r && typeof r === 'object' && typeof r.notes === 'string' ? r.notes : null;
}
