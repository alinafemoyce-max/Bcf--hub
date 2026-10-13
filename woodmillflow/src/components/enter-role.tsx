'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { switchRole } from '@/lib/client';

/** Landing-page buttons: choose the demo role, then open that view. */
export function EnterRoleButton({ role, label, href, testId }: { role: 'employee' | 'operator'; label: string; href: string; testId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="xl"
      className="w-full"
      variant={role === 'operator' ? 'navy' : 'primary'}
      loading={busy}
      data-testid={testId}
      onClick={async () => {
        setBusy(true);
        try {
          await switchRole(role);
          router.push(href);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {label} {!busy && <ArrowRight aria-hidden />}
    </Button>
  );
}
