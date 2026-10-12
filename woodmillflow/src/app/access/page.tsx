'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api } from '@/lib/client';

export default function AccessPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-6 shadow-raised"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/api/access', { body: { code } });
            const next = new URLSearchParams(window.location.search).get('next') ?? '/';
            window.location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <Wordmark />
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <Lock className="size-5 text-marine" aria-hidden /> Private demonstration
          </h1>
          <p className="mt-1 text-sm text-muted">Enter the access code you were given.</p>
        </div>
        <Field label="Access code" htmlFor="code" error={error}>
          <Input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Continue
        </Button>
        <p className="text-xs text-muted">Independent concept demonstration — fictional data.</p>
      </form>
    </div>
  );
}
