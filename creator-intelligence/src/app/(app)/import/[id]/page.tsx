import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReviewForm } from '@/components/ReviewForm';
import { Notice } from '@/components/ui';
import { isAiConfigured } from '@/lib/ai/config';
import { requirePageAuth } from '@/lib/auth/server';
import { getDb } from '@/lib/db';
import { date } from '@/lib/format';
import { findContentDuplicates, getScreenshot, listScreenshots } from '@/lib/repo/screenshots';
import { listMatchCandidates } from '@/lib/repo/videos';

export const metadata = { title: 'Review import' };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAuth();
  const { id } = await params;
  const db = await getDb();
  const shot = await getScreenshot(db, id);
  if (!shot) notFound();
  const [candidates, duplicates, pending] = await Promise.all([listMatchCandidates(db), findContentDuplicates(db, shot), listScreenshots(db, { pendingOnly: true })]);
  const nextId = pending.find((p) => p.id !== shot.id)?.id ?? null;

  return (
    <>
      <Link href="/import" className="-ml-1 mb-3 inline-flex items-center gap-0.5 text-[14px] text-ink-3 hover:text-ink">
        <ChevronLeft size={18} /> Import
      </Link>
      <h1 className="text-[24px] font-bold tracking-tight">Review import</h1>
      <p className="mt-1 mb-4 text-[14px] text-ink-3">Check every value against the screenshot. Fix anything that is wrong, then save.</p>
      {shot.status === 'confirmed' ? (
        <Notice tone="good">
          This screenshot was imported on {date(shot.confirmed_at, { withTime: true })}. To redo it, delete it from the Import page and upload it again.
        </Notice>
      ) : (
        <ReviewForm
          screenshot={shot}
          candidates={candidates}
          contentDuplicates={duplicates.map((d) => ({ id: d.id, uploadedAt: d.uploaded_at, status: d.status }))}
          aiConfigured={isAiConfigured()}
          nextId={nextId}
        />
      )}
    </>
  );
}
