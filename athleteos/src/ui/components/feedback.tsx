import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './ui/alert-dialog';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
interface FeedbackApi {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setDialog(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-2xl border bg-popover/95 px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur animate-in fade-in-0 slide-in-from-top-2',
              t.kind === 'error' && 'border-danger/50'
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <AlertDialog open={!!dialog} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogTitle>{dialog?.title}</AlertDialogTitle>
          {dialog?.description && <AlertDialogDescription>{dialog.description}</AlertDialogDescription>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel onClick={() => close(false)}>{dialog?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction destructive={dialog?.destructive} onClick={() => close(true)}>
              {dialog?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedback outside FeedbackProvider');
  return v;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}
