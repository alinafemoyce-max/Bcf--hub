// Delivers generated files (PDFs, backups) to the user. On iPhone the share sheet is opened from a
// direct tap, which Safari requires; elsewhere a normal download is used.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Sheet } from './ui';
import { Icon } from './Icon';
import { useNotify } from './notify';

export interface ExportFile {
  blob: Blob;
  filename: string;
}

interface ExportValue {
  /** Runs a builder, then offers the resulting file to share/save. */
  exportFile(build: () => Promise<ExportFile>, label?: string): Promise<boolean>;
}

const Ctx = createContext<ExportValue | null>(null);

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function ExportProvider({ children }: { children: ReactNode }) {
  const { toast } = useNotify();
  const [ready, setReady] = useState<{ file: File; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportFile = useCallback(
    async (build: () => Promise<ExportFile>, label = 'File') => {
      setBusy(true);
      try {
        const { blob, filename } = await build();
        const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        setReady({ file, label });
        return true;
      } catch (e) {
        console.error(e);
        toast(`Couldn’t create the ${label.toLowerCase()}. ${e instanceof Error ? e.message : ''}`, 'error');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  const share = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: [ready.file], title: ready.file.name });
      setReady(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // user closed the share sheet
      downloadBlob(ready.file, ready.file.name);
      setReady(null);
    }
  };

  const download = () => {
    if (!ready) return;
    downloadBlob(ready.file, ready.file.name);
    toast(`${ready.label} saved`, 'success');
    setReady(null);
  };

  const shareable = ready ? canShareFile(ready.file) : false;

  return (
    <Ctx.Provider value={{ exportFile }}>
      {children}
      {busy && (
        <div className="busy" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" /> Preparing…
        </div>
      )}
      <Sheet open={!!ready} onClose={() => setReady(null)} title={`${ready?.label ?? 'File'} ready`}>
        <div className="file-ready">
          <span className="file-icon">
            <Icon name="file" size={26} />
          </span>
          <div>
            <p className="file-name">{ready?.file.name}</p>
            <p className="muted small">{ready ? `${Math.max(1, Math.round(ready.file.size / 1024))} KB · created on this device` : ''}</p>
          </div>
        </div>
        <div className="btn-col">
          {shareable && (
            <button className="btn btn-primary" onClick={share}>
              <Icon name="upload" size={18} /> Share or save to Files
            </button>
          )}
          <button className={`btn ${shareable ? 'btn-secondary' : 'btn-primary'}`} onClick={download}>
            <Icon name="download" size={18} /> Download
          </button>
        </div>
        <p className="small muted">Only share with people authorised to see this information.</p>
      </Sheet>
    </Ctx.Provider>
  );
}

export function useExport(): ExportValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useExport must be inside ExportProvider');
  return v;
}
