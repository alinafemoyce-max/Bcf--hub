import { IdeasBoard } from '@/components/IdeasBoard';
import { Notice, PageTitle } from '@/components/ui';
import { requirePageAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db';
import { listIdeas } from '@/lib/repo/ideas';
import { listVideos } from '@/lib/repo/videos';

export const metadata = { title: 'Ideas' };

export default async function IdeasPage() {
  await requirePageAuth();
  const db = await getDb();
  const [ideas, videos] = await Promise.all([listIdeas(db), listVideos(db)]);
  return (
    <>
      <PageTitle title="Ideas" sub="Your content backlog, from first thought to evaluated result." />
      <Notice className="mb-4">
        AI idea generation and the pre-upload idea checker arrive in Phase 2. They will compare ideas against your saved videos. For now, save and track ideas by hand.
      </Notice>
      <IdeasBoard ideas={ideas} videos={videos.map((v) => ({ id: v.id, title: v.title }))} />
    </>
  );
}
