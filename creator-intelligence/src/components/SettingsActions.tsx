'use client';

import { Download, ImageOff, LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Button, Input, Notice, Spinner } from './ui';

export function KeepScreenshotsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-[14px] font-medium">Keep screenshot images</span>
        <span className="block text-[12.5px] leading-snug text-ink-3">Off: images are deleted once you confirm an import. The extracted data and its source are kept either way.</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-3 transition-colors before:block before:size-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-accent checked:before:translate-x-[22px]"
        checked={on}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.checked;
          setOn(next);
          setBusy(true);
          try {
            await api('/api/settings', { method: 'PATCH', json: { keepScreenshots: next } });
          } catch (err) {
            setOn(!next);
            alert((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

export function DataActions({ storedImages }: { storedImages: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <a href="/api/export" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface-2 text-[15px] font-medium">
        <Download size={17} /> Export all data (JSON)
      </a>
      <Button
        variant="secondary"
        className="w-full"
        disabled={busy !== null || storedImages === 0}
        onClick={async () => {
          if (!confirm(`Delete ${storedImages} stored screenshot image(s)? Extracted data is kept.`)) return;
          setBusy('purge');
          try {
            const r = await api<{ purged: number }>('/api/settings/purge-images', { method: 'POST' });
            setMsg(`Deleted ${r.purged} image(s).`);
            router.refresh();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === 'purge' ? <Spinner /> : <ImageOff size={17} />} Delete stored images ({storedImages})
      </Button>
      {msg && <Notice>{msg}</Notice>}
      <div className="rounded-2xl border border-bad/30 p-3">
        <div className="text-[14px] font-medium text-bad">Delete all data</div>
        <p className="mt-1 text-[12.5px] text-ink-3">Removes every video, snapshot, screenshot, idea and account record. Export first. Type DELETE to confirm.</p>
        <div className="mt-2 flex gap-2">
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
          <Button
            variant="danger"
            disabled={confirmText !== 'DELETE' || busy !== null}
            onClick={async () => {
              setBusy('delete');
              try {
                await api('/api/settings/delete-all', { method: 'POST', json: { confirm: 'DELETE' } });
                setConfirmText('');
                setMsg('All data deleted.');
                router.refresh();
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'delete' ? <Spinner /> : <Trash2 size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LogoutButton() {
  return (
    <Button
      variant="secondary"
      className="w-full"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      }}
    >
      <LogOut size={17} /> Sign out
    </Button>
  );
}
