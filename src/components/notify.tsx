// Toast messages and promise-based confirmation dialogs.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Sheet } from './ui';
import { Icon } from './Icon';

type Tone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface NotifyValue {
  toast(text: string, tone?: Tone): void;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  /** Runs an async action, showing a success toast or a readable error. Resolves true on success. */
  run(fn: () => Promise<unknown>, success?: string): Promise<boolean>;
  /** Like run, but resolves with the action's result (or undefined on failure). */
  runFor<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined>;
}

const Ctx = createContext<NotifyValue | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((text: string, tone: Tone = 'success') => {
    const id = ++counter.current;
    setToasts((t) => [...t.filter((x) => x.tone === 'error').slice(-1), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2800);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })), []);

  const runFor = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (success) toast(success, 'success');
        return r;
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : 'Something went wrong.';
        toast(/quota/i.test(msg) ? 'Device storage is full. Export a backup and free some space.' : `Couldn’t save: ${msg}`, 'error');
        return undefined;
      }
    },
    [toast]
  );

  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      let ok = false;
      await runFor(async () => {
        await fn();
        ok = true;
      }, success);
      return ok;
    },
    [runFor]
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm, run, runFor }}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'check'} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <Sheet
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        footer={
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => close(false)}>
              Cancel
            </button>
            <button className={`btn ${dialog?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {dialog?.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        }
      >
        <div className="confirm-msg">{dialog?.message}</div>
      </Sheet>
    </Ctx.Provider>
  );
}

export function useNotify(): NotifyValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotify must be inside NotifyProvider');
  return v;
}
