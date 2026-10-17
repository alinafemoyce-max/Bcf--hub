'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { toLocalInput } from '@/lib/format';
import { localToUtc, parseCount, parseDuration, parsePercent } from '@/lib/parse';
import { Button, Field, Input, Notice, Spinner, Textarea } from './ui';

const COUNT_FIELDS = [
  ['views', 'Views'],
  ['likes', 'Likes'],
  ['comments', 'Comments'],
  ['shares', 'Shares'],
  ['saves', 'Saves'],
  ['new_followers', 'New followers']
] as const;

/** Manual entry of a dated metrics snapshot. Accepts TikTok-style values such as 12.3K. */
export function SnapshotForm({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({ captured: toLocalInput(new Date().toISOString()) });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const body: Record<string, unknown> = {};
    const approximate: string[] = [];
    for (const [k, label] of COUNT_FIELDS) {
      const raw = values[k]?.trim();
      if (!raw) continue;
      const parsed = parseCount(raw.replace(/^\+/, ''));
      if (!parsed) return setError(`${label}: “${raw}” is not a number`);
      body[k] = parsed.value;
      if (parsed.approximate) approximate.push(k);
    }
    if (values.avg?.trim()) {
      const s = parseDuration(/^\d+(\.\d+)?$/.test(values.avg.trim()) ? `${values.avg}s` : values.avg);
      if (s == null) return setError('Average watch time: use seconds, e.g. 8.2');
      body.avg_watch_time_seconds = s;
    }
    if (values.completion?.trim()) {
      const p = parsePercent(values.completion.includes('%') ? values.completion : `${values.completion}%`);
      if (p == null) return setError('Completion rate must be a percentage between 0 and 100');
      body.completion_rate = p;
    }
    if (values.retention?.trim()) body.retention = values.retention.trim();
    if (values.notes?.trim()) body.notes = values.notes.trim();
    if (!values.captured) return setError('Enter when these numbers were recorded');
    const [d, t] = values.captured.split('T');
    body.captured_at = localToUtc(d, t).toISOString();
    body.captured_at_source = 'user';
    body.approximate_fields = approximate;
    setBusy(true);
    try {
      const res = await api<{ snapshot: unknown; duplicateOf: unknown }>(`/api/videos/${videoId}/snapshots`, { method: 'POST', json: body });
      if (res.duplicateOf) {
        setNotice('Not added: an identical snapshot from within 6 hours already exists.');
      } else {
        setValues({ captured: toLocalInput(new Date().toISOString()) });
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Plus size={17} /> Add metrics manually
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line-strong bg-surface-2 p-3">
      <Field label="Recorded at (UK time)" hint="When you looked at these numbers. Each entry becomes a new dated snapshot.">
        <Input type="datetime-local" value={values.captured ?? ''} onChange={set('captured')} required />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        {COUNT_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}>
            <Input value={values[k] ?? ''} onChange={set(k)} inputMode="decimal" placeholder="—" autoComplete="off" />
          </Field>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Avg watch time (s)">
          <Input value={values.avg ?? ''} onChange={set('avg')} inputMode="decimal" placeholder="e.g. 8.2" />
        </Field>
        <Field label="Watched full video (%)">
          <Input value={values.completion ?? ''} onChange={set('completion')} inputMode="decimal" placeholder="e.g. 18.5" />
        </Field>
      </div>
      <Field label="Retention notes">
        <Textarea value={values.retention ?? ''} onChange={set('retention')} className="min-h-16" placeholder="e.g. big drop at 0:03" />
      </Field>
      <p className="text-[12px] text-ink-3">You can type values exactly as TikTok shows them, e.g. 12.3K. Rounded values are marked as approximate.</p>
      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone="warn">{notice}</Notice>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={busy} className="flex-[2]">
          {busy && <Spinner />} Save snapshot
        </Button>
      </div>
    </form>
  );
}

export function DeleteSnapshotButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      aria-label="Delete snapshot"
      disabled={busy}
      className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-bad"
      onClick={async () => {
        if (!confirm('Delete this snapshot?')) return;
        setBusy(true);
        try {
          await api(`/api/snapshots/${id}`, { method: 'DELETE' });
          router.refresh();
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
