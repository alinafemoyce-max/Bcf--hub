'use client';

import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { IDEA_STATUSES, type Idea, type IdeaStatus } from '@/lib/types';
import { Badge, Button, Card, cx, EmptyState, Field, Input, Notice, Select, Spinner, Textarea } from './ui';

const STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'New',
  planned: 'Planned',
  filmed: 'Filmed',
  edited: 'Edited',
  published: 'Published',
  evaluated: 'Evaluated',
  rejected: 'Rejected'
};
const STATUS_TONE: Record<IdeaStatus, 'neutral' | 'accent' | 'good' | 'warn' | 'bad'> = {
  new: 'neutral',
  planned: 'accent',
  filmed: 'accent',
  edited: 'accent',
  published: 'good',
  evaluated: 'good',
  rejected: 'bad'
};

export function IdeasBoard({ ideas, videos }: { ideas: Idea[]; videos: { id: string; title: string }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(ideas.length === 0);
  const [form, setForm] = useState({ title: '', hook: '', concept: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all' | IdeaStatus>('active');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/ideas', { method: 'POST', json: form });
      setForm({ title: '', hook: '', concept: '' });
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = ideas.filter((i) => (filter === 'all' ? true : filter === 'active' ? !['rejected', 'evaluated'].includes(i.status) : i.status === filter));

  return (
    <div className="space-y-3">
      {adding ? (
        <Card>
          <form onSubmit={add} className="space-y-3">
            <Field label="Idea title *">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={300} placeholder="e.g. Is 90hp enough for a new driver?" />
            </Field>
            <Field label="Opening hook">
              <Input value={form.hook} onChange={(e) => setForm({ ...form, hook: e.target.value })} maxLength={500} />
            </Field>
            <Field label="Concept / notes">
              <Textarea value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} maxLength={4000} />
            </Field>
            {error && <Notice tone="bad">{error}</Notice>}
            <div className="flex gap-2">
              {ideas.length > 0 && (
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              )}
              <Button type="submit" className="flex-[2]" disabled={busy}>
                {busy && <Spinner />} Save idea
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button className="w-full" onClick={() => setAdding(true)}>
          <Plus size={18} /> New idea
        </Button>
      )}

      {ideas.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-[12.5px]">
          {(['active', 'all', ...IDEA_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cx('shrink-0 rounded-full border px-3 py-1.5', filter === s ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line text-ink-3')}
            >
              {s === 'active' ? 'In progress' : s === 'all' ? 'All' : STATUS_LABEL[s]} ({ideas.filter((i) => (s === 'all' ? true : s === 'active' ? !['rejected', 'evaluated'].includes(i.status) : i.status === s)).length})
            </button>
          ))}
        </div>
      )}

      {ideas.length === 0 && !adding && <EmptyState title="No ideas saved">Save ideas here and move them through planned → filmed → published.</EmptyState>}
      {shown.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} videos={videos} />
      ))}
    </div>
  );
}

function IdeaCard({ idea, videos }: { idea: Idea; videos: { id: string; title: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState(idea.rejection_reason ?? '');

  async function patch(p: Partial<Idea>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/ideas/${idea.id}`, { method: 'PATCH', json: p });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const linked = videos.find((v) => v.id === idea.video_id);
  return (
    <Card className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-snug font-semibold">{idea.title}</h3>
          {idea.hook && <p className="mt-1 text-[13.5px] text-ink-2">Hook: “{idea.hook}”</p>}
          {idea.concept && <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink-3">{idea.concept}</p>}
        </div>
        <Badge tone={STATUS_TONE[idea.status]}>{STATUS_LABEL[idea.status]}</Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select value={idea.status} onChange={(e) => patch({ status: e.target.value as IdeaStatus })} disabled={busy} aria-label="Status">
          {IDEA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <button
          aria-label="Delete idea"
          className="grid size-11 place-items-center rounded-xl text-ink-3 hover:text-bad"
          onClick={async () => {
            if (!confirm('Delete this idea?')) return;
            await api(`/api/ideas/${idea.id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
            router.refresh();
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {['published', 'evaluated'].includes(idea.status) && (
        <div>
          {linked ? (
            <p className="text-[13px] text-ink-2">
              Published as <Link href={`/videos/${linked.id}`} className="text-accent">{linked.title}</Link>
            </p>
          ) : (
            <Select value="" onChange={(e) => e.target.value && patch({ video_id: e.target.value })} aria-label="Link to the published video">
              <option value="">Link to the published video…</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title.slice(0, 70)}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
      {idea.status === 'rejected' && (
        <div className="flex gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was it rejected?" />
          <Button variant="secondary" onClick={() => patch({ rejection_reason: reason })} disabled={busy || reason === (idea.rejection_reason ?? '')}>
            Save
          </Button>
        </div>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
  );
}
