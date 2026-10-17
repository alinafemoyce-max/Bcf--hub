'use client';

import { Archive, ArchiveRestore, Pencil, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import type { Video } from '@/lib/types';
import { Button, Notice } from './ui';

export function VideoActions({ video }: { video: Video }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/videos/${video.id}`, { method: 'PATCH', json: { tracking_status: video.tracking_status === 'archived' ? 'active' : 'archived' } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this video and all of its snapshots? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api(`/api/videos/${video.id}`, { method: 'DELETE' });
      router.push('/videos');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/import?video=${video.id}`}
          className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-medium text-white"
        >
          <Upload size={17} /> Upload analytics screenshot
        </Link>
        <Link href={`/videos/${video.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface-2 text-[14px]">
          <Pencil size={16} /> Edit details
        </Link>
        <Button variant="secondary" onClick={toggleArchive} disabled={busy} className="text-[14px]">
          {video.tracking_status === 'archived' ? (
            <>
              <ArchiveRestore size={16} /> Resume tracking
            </>
          ) : (
            <>
              <Archive size={16} /> Stop tracking
            </>
          )}
        </Button>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <button onClick={remove} disabled={busy} className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] text-bad/90 hover:text-bad">
        <Trash2 size={14} /> Delete video
      </button>
    </div>
  );
}
