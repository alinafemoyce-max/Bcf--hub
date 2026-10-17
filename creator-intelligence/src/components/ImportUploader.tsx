'use client';

import { CheckCircle2, CircleAlert, Copy, ImagePlus, LayoutList, LineChart, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { prepareImage, readCaptureDate, sha256Hex } from '@/lib/image-client';
import { ocrStatusLabel, recognizeImage } from '@/lib/ocr-client';
import { ocrToExtraction } from '@/lib/ocr-parse';
import type { ScreenshotKind } from '@/lib/types';
import { Button, cx, Notice, Spinner } from './ui';

type ItemState = 'preparing' | 'uploading' | 'extracting' | 'reading' | 'ready' | 'duplicate' | 'failed' | 'needs_manual';
export type Reader = 'claude' | 'free';
const READER_KEY = 'ajm-reader';

interface Item {
  key: string;
  name: string;
  state: ItemState;
  screenshotId?: string;
  message?: string;
  entries?: number;
  progress?: string;
}

const KINDS: { kind: ScreenshotKind; title: string; desc: string; icon: React.ReactNode }[] = [
  { kind: 'video_list', title: 'Post list', desc: 'TikTok Studio list of your videos. Creates historical basic records.', icon: <LayoutList size={18} /> },
  { kind: 'video_analytics', title: 'One video’s analytics', desc: 'A single post’s analytics screen. Adds a dated, detailed snapshot.', icon: <LineChart size={18} /> },
  { kind: 'account_overview', title: 'Account overview', desc: 'Followers and period totals for your whole account.', icon: <Users size={18} /> }
];

export function ImportUploader({ aiConfigured, targetVideo }: { aiConfigured: boolean; targetVideo: { id: string; title: string } | null }) {
  const router = useRouter();
  const [kind, setKind] = useState<ScreenshotKind>(targetVideo ? 'video_analytics' : 'video_list');
  const [items, setItems] = useState<Item[]>([]);
  const [reader, setReader] = useState<Reader>(aiConfigured ? 'claude' : 'free');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(READER_KEY);
      if (saved === 'free' || (saved === 'claude' && aiConfigured)) setReader(saved);
    } catch {
      // storage unavailable (private mode); keep the default
    }
  }, [aiConfigured]);
  const chooseReader = (r: Reader) => {
    setReader(r);
    try {
      localStorage.setItem(READER_KEY, r);
    } catch {
      // ignore
    }
  };
  const [running, setRunning] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function processFiles(files: FileList) {
    const batch = [...files].slice(0, 20).map((f, i) => ({ file: f, key: `${Date.now()}-${i}` }));
    setItems((list) => [...batch.map(({ file, key }) => ({ key, name: file.name || 'Screenshot', state: 'preparing' as ItemState })), ...list]);
    setRunning(true);
    // One at a time: keeps memory low on iPhone and respects AI rate limits.
    for (const { file, key } of batch) {
      try {
        const buffer = await file.arrayBuffer();
        const [hash, prepared] = await Promise.all([sha256Hex(buffer), prepareImage(file)]);
        const captured = readCaptureDate(buffer);
        patch(key, { state: 'uploading' });
        const form = new FormData();
        form.set('file', prepared.blob, file.name || 'screenshot.jpg');
        form.set('kind', kind);
        form.set('originalSha256', hash);
        form.set('width', String(prepared.width));
        form.set('height', String(prepared.height));
        if (captured) {
          form.set('observedAt', captured);
          form.set('observedAtSource', 'file_metadata');
        }
        if (targetVideo && kind === 'video_analytics') form.set('targetVideoId', targetVideo.id);
        const up = await api<{ screenshot: { id: string; status: string }; duplicate: boolean }>('/api/screenshots', { method: 'POST', body: form });
        if (up.duplicate) {
          patch(key, {
            state: 'duplicate',
            screenshotId: up.screenshot.id,
            message: up.screenshot.status === 'confirmed' ? 'Already imported earlier. Nothing new was added.' : 'Already uploaded and waiting for review.'
          });
          continue;
        }
        const screenshotId = up.screenshot.id;
        if (reader === 'free') {
          patch(key, { state: 'reading', screenshotId, progress: 'Starting the reader' });
          try {
            const ocr = await recognizeImage(file, (status, p) =>
              patch(key, { progress: ocrStatusLabel(status, p) })
            ).catch(() => recognizeImage(prepared.blob));
            const extraction = ocrToExtraction(kind, ocr.lines, { width: ocr.width, height: ocr.height }, new Date());
            const saved = await api<{ screenshot: { entries: number } }>(`/api/screenshots/${screenshotId}/ocr`, { method: 'POST', json: extraction });
            patch(key, { state: 'ready', entries: saved.screenshot.entries });
          } catch (err) {
            patch(key, { state: 'needs_manual', message: (err as Error).message });
          }
          continue;
        }
        if (!aiConfigured) {
          patch(key, { state: 'needs_manual', screenshotId, message: 'AI is not configured, so enter the numbers by hand.' });
          continue;
        }
        patch(key, { state: 'extracting', screenshotId });
        try {
          const ex = await api<{ screenshot: { entries: number } }>(`/api/screenshots/${screenshotId}/extract`, { method: 'POST' });
          patch(key, { state: 'ready', entries: ex.screenshot.entries });
        } catch (err) {
          patch(key, { state: 'needs_manual', message: (err as Error).message });
        }
      } catch (err) {
        patch(key, { state: 'failed', message: err instanceof ApiError || err instanceof Error ? err.message : 'Upload failed' });
      }
    }
    setRunning(false);
    router.refresh();
  }

  const reviewable = items.filter((i) => (i.state === 'ready' || i.state === 'needs_manual') && i.screenshotId);

  return (
    <div className="space-y-4">
      {targetVideo && (
        <Notice tone="accent">
          Adding analytics for <span className="font-semibold">{targetVideo.title}</span>. The screenshot becomes a new dated snapshot; earlier snapshots are kept.
        </Notice>
      )}
      <div className="grid gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            onClick={() => setKind(k.kind)}
            aria-pressed={kind === k.kind}
            className={cx(
              'flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors',
              kind === k.kind ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', kind === k.kind ? 'bg-accent text-white' : 'bg-surface-3 text-ink-2')}>{k.icon}</span>
            <span>
              <span className="block text-[15px] font-semibold">{k.title}</span>
              <span className="block text-[13px] leading-snug text-ink-3">{k.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-medium text-ink-2">Who reads the screenshot?</div>
        <div className="flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label="Screenshot reader">
          {(
            [
              ['claude', 'Claude AI', aiConfigured ? 'Most accurate · tiny cost' : 'Needs API key'],
              ['free', 'Free (on phone)', 'No cost · less accurate']
            ] as const
          ).map(([value, label, sub]) => (
            <button
              key={value}
              role="radio"
              aria-checked={reader === value}
              disabled={value === 'claude' && !aiConfigured}
              onClick={() => chooseReader(value)}
              className={cx('flex-1 rounded-lg px-2 py-2 text-center transition-colors disabled:opacity-40', reader === value ? 'bg-surface-3 text-ink' : 'text-ink-3')}
            >
              <span className="block text-[13.5px] font-medium">{label}</span>
              <span className="block text-[11.5px] text-ink-3">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button className="w-full" onClick={() => input.current?.click()} disabled={running}>
        {running ? <Spinner /> : <ImagePlus size={18} />} {running ? 'Processing…' : 'Choose screenshots'}
      </Button>
      <p className="-mt-2 text-center text-[12px] text-ink-3">
        Up to 20 at a time. You check everything before it is saved.{' '}
        {reader === 'free' ? 'The free reader runs on this phone; the first use downloads about 7 MB.' : 'Claude reads each one on the server.'}
      </p>

      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 px-3.5 py-3">
              <StateIcon state={i.state} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px]">{i.name}</div>
                <div className="text-[12.5px] leading-snug text-ink-3">
                  {i.state === 'preparing' && 'Preparing…'}
                  {i.state === 'uploading' && 'Uploading…'}
                  {i.state === 'extracting' && 'Reading with Claude (can take ~30s)…'}
                  {i.state === 'reading' && `${i.progress ?? 'Reading'}…`}
                  {i.state === 'ready' && `${i.entries ?? 0} ${i.entries === 1 ? 'entry' : 'entries'} found. Ready to review.`}
                  {(i.state === 'duplicate' || i.state === 'failed' || i.state === 'needs_manual') && i.message}
                </div>
              </div>
              {i.screenshotId && (i.state === 'ready' || i.state === 'needs_manual' || (i.state === 'duplicate' && !i.message?.startsWith('Already imported'))) && (
                <Link href={`/import/${i.screenshotId}`} className="shrink-0 rounded-lg bg-surface-3 px-3 py-1.5 text-[13px] font-medium">
                  Review
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {!running && reviewable.length > 0 && (
        <Button className="w-full" onClick={() => router.push(`/import/${reviewable[reviewable.length - 1].screenshotId}`)}>
          Start reviewing ({reviewable.length})
        </Button>
      )}
    </div>
  );
}

function StateIcon({ state }: { state: ItemState }) {
  if (state === 'ready') return <CheckCircle2 size={20} className="shrink-0 text-good" />;
  if (state === 'duplicate') return <Copy size={20} className="shrink-0 text-warn" />;
  if (state === 'failed' || state === 'needs_manual') return <CircleAlert size={20} className={cx('shrink-0', state === 'failed' ? 'text-bad' : 'text-warn')} />;
  return <Spinner className="size-5 shrink-0 text-accent" />;
}
