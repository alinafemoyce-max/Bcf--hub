'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Factory, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { switchRole } from '@/lib/client';
import { DEMO_OPERATOR } from '@/lib/config';

/** Shown when the operator view is opened without the operator demo role. */
export function OperatorRoleGate({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!demoMode) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex gap-4">
          <ShieldAlert className="size-8 shrink-0 text-danger" aria-hidden />
          <div>
            <h2 className="font-semibold text-navy">Operator sign-in required</h2>
            <p className="mt-1 text-sm text-muted">Demo mode is switched off and enterprise sign-in has not been configured.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-marine-50 text-marine">
          <Factory className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-navy">Woodmill operator view</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          In this demonstration you can switch to the fictional operator, {DEMO_OPERATOR.name}, without a password. A real
          system would require company sign-in.
        </p>
        <Button
          size="xl"
          className="mt-6 w-full sm:w-auto"
          loading={busy}
          data-testid="continue-as-operator"
          onClick={async () => {
            setBusy(true);
            try {
              await switchRole('operator');
              router.refresh();
            } catch (e) {
              toast.error((e as Error).message);
              setBusy(false);
            }
          }}
        >
          Continue as {DEMO_OPERATOR.name} (demo)
        </Button>
      </CardContent>
    </Card>
  );
}
