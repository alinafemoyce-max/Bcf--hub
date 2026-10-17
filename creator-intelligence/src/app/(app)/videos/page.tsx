import { Plus } from 'lucide-react';
import { Suspense } from 'react';
import { EmptyState, LinkButton, PageTitle } from '@/components/ui';
import { VideoFilters } from '@/components/VideoFilters';
import { VideoRow } from '@/components/VideoRow';
import { requirePageAuth } from '@/lib/auth/server';
import { loadLibrary } from '@/lib/data';
import { getDb } from '@/lib/db';
import { pct } from '@/lib/format';
import { filterLibrary, repeatedTopics, type LibraryQuery } from '@/lib/library';
import { groupSnapshots } from '@/lib/metrics';

export const metadata = { title: 'Videos' };

export default async function VideosPage({ searchParams }: { searchParams: Promise<LibraryQuery> }) {
  await requirePageAuth();
  const query = await searchParams;
  const db = await getDb();
  const { videos, snapshots } = await loadLibrary(db);
  const rows = filterLibrary(videos, groupSnapshots(snapshots), query, new Date());
  const repeats = repeatedTopics(videos);

  return (
    <>
      <PageTitle
        title="Videos"
        sub={`${videos.length} in your library`}
        action={
          <LinkButton href="/videos/new" className="px-3">
            <Plus size={18} /> Add
          </LinkButton>
        }
      />
      {videos.length === 0 ? (
        <EmptyState title="No videos yet" action={<LinkButton href="/import">Import screenshots</LinkButton>}>
          Import screenshots of your TikTok Studio post list, or add a video manually.
        </EmptyState>
      ) : (
        <>
          <Suspense>
            <VideoFilters />
          </Suspense>
          {repeats.length > 0 && !Object.values(query).some(Boolean) && (
            <div className="mb-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-2">
              <span className="font-medium text-ink">Topics covered more than once: </span>
              {repeats
                .slice(0, 4)
                .map((g) => `${g.label} (${g.videos.length})`)
                .join(' · ')}
            </div>
          )}
          <div className="mb-2 text-[12.5px] text-ink-3">
            {rows.length} {rows.length === 1 ? 'result' : 'results'}
          </div>
          {rows.length ? (
            <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface px-3">
              {rows.map((r) => (
                <VideoRow
                  key={r.video.id}
                  video={r.video}
                  views={r.views}
                  viewsApproximate={r.viewsApproximate}
                  meta={
                    <>
                      {r.engagement != null && <span>· {pct(r.engagement)} eng.</span>}
                      {r.video.tracking_status === 'archived' && <span>· archived</span>}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No matches">Try a different search or clear the filters.</EmptyState>
          )}
        </>
      )}
    </>
  );
}
