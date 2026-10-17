'use client';

import { useState } from 'react';
import { Button, Input, Notice, Spinner } from '@/components/ui';
import { api } from '@/lib/client';

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', json: { password } });
      window.location.href = next;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Password</span>
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
      </label>
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" className="w-full" disabled={busy || !password}>
        {busy && <Spinner />} Sign in
      </Button>
      <p className="pt-2 text-center text-[12.5px] text-ink-3">You stay signed in on this device for 30 days.</p>
    </form>
  );
}
