import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { VideoForm } from '@/components/VideoForm';
import { requirePageAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db';
import { getVideo } from '@/lib/repo/videos';

export const metadata = { title: 'Edit video' };

export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAuth();
  const { id } = await params;
  const video = await getVideo(await getDb(), id);
  if (!video) notFound();
  return (
    <>
      <PageTitle title="Edit video" />
      <VideoForm video={video} />
    </>
  );
}
