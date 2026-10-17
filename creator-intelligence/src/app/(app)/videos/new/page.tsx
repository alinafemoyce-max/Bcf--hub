import { PageTitle } from '@/components/ui';
import { VideoForm } from '@/components/VideoForm';
import { requirePageAuth } from '@/lib/auth/server';

export const metadata = { title: 'Add video' };

export default async function NewVideoPage() {
  await requirePageAuth();
  return (
    <>
      <PageTitle title="Add video" sub="Track a new upload. Add metrics afterwards from screenshots or by hand." />
      <VideoForm />
    </>
  );
}
