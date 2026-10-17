import Link from 'next/link';
import { ImportUploader } from '@/components/ImportUploader';
import { ScreenshotDelete } from '@/components/ScreenshotDelete';
import { Badge, Card, CardTitle, PageTitle } from '@/components/ui';
import { isAiConfigured } from '@/lib/ai/config';
import { requirePageAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db';
import { ago, date } from '@/lib/format';
import { listScreenshots } from '@/lib/repo/screenshots';
import { getVideo } from '@/lib/repo/videos';

export const metadata = { title: 'Import' };

const KIND_LABEL = { video_list: 'Post list', video_analytics: 'Video analytics', account_overview: 'Account overview' } as const;

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ video?: string }> }) {
  await requirePageAuth();
  const { video: videoId } = await searchParams;
  const db = await getDb();
  const [all, target] = await Promise.all([listScreenshots(db, { limit: 60 }), videoId ? getVideo(db, videoId) : null]);
  const pending = all.filter((s) => s.status !== 'confirmed');
  const done = all.filter((s) => s.status === 'confirmed').slice(0, 15);
  const now = new Date();

  return (
    <>
      <PageTitle title="Import" sub="Add TikTok Studio screenshots. Nothing is saved until you confirm it." />
      <ImportUploader aiConfigured={isAiConfigured()} targetVideo={target ? { id: target.id, title: target.title } : null} />

      {pending.length > 0 && (
        <Card className="mt-5">
          <CardTitle action={<Badge tone="warn">{pending.length}</Badge>}>Waiting for review</CardTitle>
          <ul className="divide-y divide-line">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2.5">
                <Link href={`/import/${s.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[14px]">{s.original_filename ?? 'Screenshot'}</div>
                  <div className="text-[12px] text-ink-3">
                    {KIND_LABEL[s.kind]} · uploaded {ago(s.uploaded_at, now)} ·{' '}
                    {s.status === 'extracted' ? `${s.extraction?.videos.length ?? 0} entries read` : s.status === 'failed' ? 'AI could not read it' : 'not read yet'}
                  </div>
                </Link>
                <ScreenshotDelete id={s.id} createdVideos={0} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {done.length > 0 && (
        <Card className="mt-4">
          <CardTitle sub="Deleting an import removes the snapshots it created.">Recent imports</CardTitle>
          <ul className="divide-y divide-line">
            {done.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px]">{s.original_filename ?? 'Screenshot'}</div>
                  <div className="text-[12px] text-ink-3">
                    {KIND_LABEL[s.kind]} · data from {date(s.observed_at, { withTime: true })} ·{' '}
                    {s.result_summary
                      ? `${s.result_summary.createdVideoIds.length} new, ${s.result_summary.snapshotsAdded} snapshots${s.result_summary.duplicatesSkipped ? `, ${s.result_summary.duplicatesSkipped} duplicates skipped` : ''}${s.result_summary.accountSnapshotAdded ? ', account snapshot' : ''}`
                      : 'imported'}
                    {s.has_image ? ' · image kept' : ''}
                  </div>
                </div>
                <ScreenshotDelete id={s.id} createdVideos={s.result_summary?.createdVideoIds.length ?? 0} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <CardTitle>Tips for accurate imports</CardTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-2">
          <li>In TikTok Studio, open your posts list and take overlapping screenshots while scrolling. Overlaps are matched, not duplicated.</li>
          <li>Take screenshots on the day you import them where possible: the screenshot date is used as the date of the numbers.</li>
          <li>For new videos, screenshot the post’s analytics at about 24 hours, 72 hours, 7 days and 30 days.</li>
          <li>Screenshot images are deleted after you confirm an import (change this in Settings).</li>
        </ul>
      </Card>
    </>
  );
}
