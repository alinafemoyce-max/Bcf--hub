'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { toLocalInput } from '@/lib/format';
import { localToUtc, parseCount } from '@/lib/parse';
import { Button, Field, Input, Notice, Spinner } from './ui';

export function AccountForm() {
  const router = useRouter();
  const [followers, setFollowers] = useState('');
  const [totalLikes, setTotalLikes] = useState('');
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const f = followers.trim() ? parseCount(followers) : null;
    const l = totalLikes.trim() ? parseCount(totalLikes) : null;
    if (followers.trim() && !f) return setError('Followers must be a number.');
    if (totalLikes.trim() && !l) return setError('Total likes must be a number.');
    if (!f && !l) return setError('Enter at least one number.');
    const [d, t] = when.split('T');
    setBusy(true);
    try {
      await api('/api/account-snapshots', {
        method: 'POST',
        json: {
          captured_at: localToUtc(d, t).toISOString(),
          followers: f?.value ?? null,
          total_likes: l?.value ?? null,
          approximate_fields: [f?.approximate && 'followers', l?.approximate && 'total_likes'].filter(Boolean)
        }
      });
      setFollowers('');
      setTotalLikes('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Followers" hint="As shown on your profile">
          <Input value={followers} onChange={(e) => setFollowers(e.target.value)} inputMode="decimal" placeholder="e.g. 1,520" />
        </Field>
        <Field label="Total likes" hint="Optional">
          <Input value={totalLikes} onChange={(e) => setTotalLikes(e.target.value)} inputMode="decimal" placeholder="e.g. 48.2K" />
        </Field>
      </div>
      <Field label="Recorded at (UK time)">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </Field>
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Spinner />} Save snapshot
      </Button>
    </form>
  );
}

export function DeleteAccountSnapshot({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      aria-label="Delete"
      className="grid size-9 place-items-center rounded-lg text-ink-3 hover:text-bad"
      onClick={async () => {
        if (!confirm('Delete this account snapshot?')) return;
        try {
          await api(`/api/account-snapshots/${id}`, { method: 'DELETE' });
          router.refresh();
        } catch (e) {
          alert((e as Error).message);
        }
      }}
    >
      <Trash2 size={15} />
    </button>
  );
}
