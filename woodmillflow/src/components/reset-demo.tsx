'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import { Field, Input } from './ui/form';
import { api, ApiError } from '@/lib/client';

export function ResetDemo({ pinRequired, available, unavailableReason }: { pinRequired: boolean; available: boolean; unavailableReason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    setErrors({});
    try {
      await api('/api/demo/reset', { body: { confirm, pin: pin || undefined } });
      toast.success('Demo data restored to the original ten sample orders');
      setOpen(false);
      setConfirm('');
      setPin('');
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setErrors(err.fieldErrors ?? {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="danger" size="lg" onClick={() => setOpen(true)} disabled={!available} data-testid="open-reset">
        <RotateCcw aria-hidden /> Reset demo data
      </Button>
      {!available && unavailableReason && <p className="mt-2 text-sm text-muted">{unavailableReason}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Reset demonstration data?"
          description="All orders, including any submitted during this session, are deleted and the original fictional sample orders are restored."
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              reset();
            }}
          >
            <Field label="Type RESET to confirm" htmlFor="confirm-reset" error={errors.confirm}>
              <Input id="confirm-reset" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" data-testid="reset-confirm" />
            </Field>
            {pinRequired && (
              <Field label="Reset PIN" htmlFor="reset-pin" error={errors.pin} hint="Set by DEMO_RESET_PIN on the server.">
                <Input id="reset-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" />
              </Field>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="dangerSolid" loading={busy} disabled={confirm.trim().toUpperCase() !== 'RESET'} data-testid="reset-submit">
                Reset demo data
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
