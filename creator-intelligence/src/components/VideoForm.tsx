'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { toLocalInput } from '@/lib/format';
import { localToUtc, parseDuration, toLocalParts } from '@/lib/parse';
import { CATEGORIES, FORMATS, HOOK_STYLES, type Video } from '@/lib/types';
import { Button, Card, Field, Input, Notice, Select, Spinner, Textarea } from './ui';

type Tri = '' | 'yes' | 'no';
const toTri = (v: boolean | null | undefined): Tri => (v == null ? '' : v ? 'yes' : 'no');
const fromTri = (v: Tri) => (v === '' ? null : v === 'yes');

function formatDuration(s: number | null) {
  if (s == null) return '';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VideoForm({ video }: { video?: Video }) {
  const router = useRouter();
  const local = video?.published_at ? toLocalInput(video.published_at) : '';
  const [f, setF] = useState({
    title: video?.title ?? '',
    tiktok_url: video?.tiktok_url ?? '',
    date: local.slice(0, 10),
    time: video?.published_at_precision === 'datetime' ? local.slice(11, 16) : '',
    duration: formatDuration(video?.duration_seconds ?? null),
    category: video?.category ?? '',
    topic: video?.topic ?? '',
    hook: video?.hook ?? '',
    hook_style: video?.hook_style ?? '',
    caption: video?.caption ?? '',
    hashtags: (video?.hashtags ?? []).map((h) => `#${h}`).join(' '),
    format: video?.format ?? '',
    on_camera: toTri(video?.on_camera),
    voiceover: toTri(video?.voiceover),
    shows_own_car: toTri(video?.shows_own_car),
    notes: video?.notes ?? '',
    record_type: video?.record_type ?? 'tracked'
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const duration = f.duration.trim() ? parseDuration(f.duration.includes(':') || /[a-z]/i.test(f.duration) ? f.duration : `${f.duration}s`) : null;
    if (f.duration.trim() && duration == null) return setError('Duration: use minutes:seconds, e.g. 0:45');
    const published_at = f.date ? localToUtc(f.date, f.time || '12:00').toISOString() : null;
    const body = {
      title: f.title,
      tiktok_url: f.tiktok_url,
      published_at,
      published_at_precision: f.date ? (f.time ? 'datetime' : 'date') : 'unknown',
      duration_seconds: duration == null ? null : Math.round(duration),
      category: f.category,
      topic: f.topic,
      hook: f.hook,
      hook_style: f.hook_style,
      caption: f.caption,
      hashtags: f.hashtags.split(/[\s,]+/).filter(Boolean),
      format: f.format,
      on_camera: fromTri(f.on_camera),
      voiceover: fromTri(f.voiceover),
      shows_own_car: fromTri(f.shows_own_car),
      notes: f.notes,
      record_type: f.record_type
    };
    setBusy(true);
    try {
      const res = video
        ? await api<{ video: Video }>(`/api/videos/${video.id}`, { method: 'PATCH', json: body })
        : await api<{ video: Video }>('/api/videos', { method: 'POST', json: body });
      router.push(`/videos/${res.video.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const today = toLocalParts(new Date()).date;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="Title *" hint="The caption or title as it appears on TikTok.">
          <Input value={f.title} onChange={set('title')} required maxLength={500} />
        </Field>
        <Field label="TikTok link" hint="Optional, but it makes duplicate detection certain.">
          <Input value={f.tiktok_url} onChange={set('tiktok_url')} inputMode="url" placeholder="https://www.tiktok.com/@you/video/…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Published date">
            <Input type="date" value={f.date} max={today} onChange={set('date')} />
          </Field>
          <Field label="Time (UK)" hint="Leave empty if unknown">
            <Input type="time" value={f.time} onChange={set('time')} disabled={!f.date} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration" hint="e.g. 0:45">
            <Input value={f.duration} onChange={set('duration')} inputMode="numeric" placeholder="m:ss" />
          </Field>
          <Field label="Record type">
            <Select value={f.record_type} onChange={set('record_type')}>
              <option value="tracked">Tracked (new upload)</option>
              <option value="historical_basic">Historical basic</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-[15px] font-semibold">Content</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={f.category} onChange={set('category')}>
              <option value="">Not set</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Format">
            <Select value={f.format} onChange={set('format')}>
              <option value="">Not set</option>
              {FORMATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Topic" hint="e.g. “Horsepower for first cars”, “Corsa vs Fiesta”">
          <Input value={f.topic} onChange={set('topic')} maxLength={200} />
        </Field>
        <Field label="Hook" hint="The first line said or shown.">
          <Textarea value={f.hook} onChange={set('hook')} maxLength={500} className="min-h-16" />
        </Field>
        <Field label="Hook style">
          <Select value={f.hook_style} onChange={set('hook_style')}>
            <option value="">Not set</option>
            {HOOK_STYLES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Caption">
          <Textarea value={f.caption} onChange={set('caption')} maxLength={4000} />
        </Field>
        <Field label="Hashtags" hint="Separated by spaces">
          <Input value={f.hashtags} onChange={set('hashtags')} autoCapitalize="none" autoCorrect="off" placeholder="#firstcar #carTok" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['on_camera', 'On camera'],
              ['voiceover', 'Voiceover'],
              ['shows_own_car', 'Own car']
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <Select value={f[k]} onChange={set(k)}>
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </Field>
          ))}
        </div>
        <Field label="Notes">
          <Textarea value={f.notes} onChange={set('notes')} maxLength={4000} />
        </Field>
      </Card>

      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={busy} className="flex-[2]">
          {busy && <Spinner />} {video ? 'Save changes' : 'Add video'}
        </Button>
      </div>
    </form>
  );
}
