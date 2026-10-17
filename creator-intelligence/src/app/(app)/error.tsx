'use client';

import { Button, Card } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mt-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        This page could not be loaded. Your saved data is not affected. Try again; if it keeps happening, check the server logs in
        your hosting dashboard (for example, the database may be unreachable).
      </p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-ink-3">Reference: {error.digest}</p>}
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </Card>
  );
}
