'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Spinner } from './ui';

/** Deletes a screenshot and every snapshot it produced (optionally the videos it created). */
export function ScreenshotDelete({ id, createdVideos, onDone }: { id: string; createdVideos: number; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      aria-label="Delete screenshot and its data"
      disabled={busy}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-bad"
      onClick={async () => {
        if (!confirm('Delete this screenshot and every snapshot that came from it?')) return;
        const alsoVideos = createdVideos > 0 && confirm(`It also created ${createdVideos} video record(s). Delete those too (only if they have no other data)?`);
        setBusy(true);
        try {
          await api(`/api/screenshots/${id}${alsoVideos ? '?deleteVideos=1' : ''}`, { method: 'DELETE' });
          if (onDone) onDone();
          else router.refresh();
        } catch (e) {
          alert((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Trash2 size={15} />}
    </button>
  );
}
