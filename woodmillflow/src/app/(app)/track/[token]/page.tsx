import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { TrackingView } from '@/components/tracking-view';

export const metadata: Metadata = { title: 'Track Request', referrer: 'no-referrer' };

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <PageHeader eyebrow="Employee Portal" title="Track My Request" />
      <TrackingView token={token} />
    </>
  );
}
