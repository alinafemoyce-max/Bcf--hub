import { Icon } from './Icon';
import { Sheet, useToast } from './ui';
import { copyText, shareMessage, shareOrCopy } from '../lib/share';

/** Always shows exactly what will be shared before anything leaves the device. */
export function ShareSheet({ open, onClose, title, text, url, note }: { open: boolean; onClose: () => void; title: string; text: string; url?: string; note?: string }) {
  const toast = useToast();
  const preview = [text, url].filter(Boolean).join('\n\n');
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        <p className="small muted">{note ?? 'This is exactly what will be shared. It contains no personal details from your answers.'}</p>
        <div className="preview-box">{preview}</div>
        <button
          className="btn btn-primary btn-block"
          onClick={async () => {
            const r = await shareOrCopy({ title, text, url });
            const m = shareMessage(r);
            if (m) toast(m);
            if (r !== 'cancelled' && r !== 'failed') onClose();
          }}
        >
          <Icon name="share" /> Share
        </button>
        <button
          className="btn btn-secondary btn-block"
          onClick={async () => {
            const ok = await copyText(url ?? preview);
            toast(ok ? 'Copied to clipboard' : 'Couldn’t copy – press and hold the text above to copy it');
            if (ok) onClose();
          }}
        >
          <Icon name="copy" /> {url ? 'Copy link only' : 'Copy text'}
        </button>
      </div>
    </Sheet>
  );
}
