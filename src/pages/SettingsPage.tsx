import { useEffect, useRef, useState } from 'react';
import { hasDemoData, useActions, useData } from '../state/store';
import { useNotify } from '../components/notify';
import { useExport } from '../components/FileExport';
import { Card, PageHeader, Section, Sheet, TextField } from '../components/ui';
import { Icon } from '../components/Icon';
import { SheetButtons } from './IssueDetailPage';
import { BackupError, backupFileName, createBackup, parseBackup } from '../db/backup';
import { daysBetween, formatDate, formatDateTime, todayISO } from '../lib/dates';
import { requestPersistence } from '../db/db';
import { IS_PREVIEW } from '../lib/env';
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS, type AppData } from '../types';

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function SettingsPage() {
  const data = useData();
  const actions = useActions();
  const { run, confirm, toast } = useNotify();
  const { exportFile } = useExport();
  const fileInput = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const [listEdit, setListEdit] = useState<'departments' | 'categories' | null>(null);
  const demo = hasDemoData(data);
  const lastBackup = data.settings.lastBackupAt;
  const backupAge = lastBackup ? daysBetween(lastBackup.slice(0, 10), todayISO()) : null;

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`))
      .catch(() => undefined);
  }, []);

  const counts: [string, number][] = [
    ['Issues', data.issues.length],
    ['Meetings', data.meetings.length],
    ['Feedback', data.feedback.length],
    ['Updates', data.updates.length],
    ['Templates', data.templates.length]
  ];

  const exportBackup = async () => {
    const ok = await exportFile(async () => {
      const json = JSON.stringify(createBackup(data), null, 2);
      return { blob: new Blob([json], { type: 'application/json' }), filename: backupFileName() };
    }, 'Backup');
    if (ok) await actions.updateSettings({ lastBackupAt: new Date().toISOString() });
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast('That file is too large to be a BCF Hub backup.', 'error');
    let parsed: AppData;
    try {
      parsed = parseBackup(await file.text());
    } catch (e) {
      return toast(e instanceof BackupError ? e.message : 'Could not read that file.', 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
    const yes = await confirm({
      title: 'Restore this backup?',
      message: (
        <>
          <p>
            The backup contains {parsed.issues.length} issues, {parsed.meetings.length} meetings, {parsed.feedback.length} feedback records and {parsed.updates.length} updates.
          </p>
          <p>
            <strong>Everything currently in BCF Hub on this device will be replaced.</strong> Export a backup first if you might need the current data.
          </p>
        </>
      ),
      confirmLabel: 'Replace and restore',
      danger: true
    });
    if (yes) await run(() => actions.importData(parsed), 'Backup restored');
  };

  const eraseAll = async () => {
    const yes = await confirm({
      title: 'Erase all data?',
      message: 'This permanently deletes every issue, meeting, feedback record, update, template and plan on this device. It cannot be undone unless you have a backup.',
      confirmLabel: 'Erase everything',
      danger: true
    });
    if (yes) await run(() => actions.eraseAll(), 'All data erased');
  };

  return (
    <div className="page">
      <PageHeader title="Data & backup" back="/more" />

      <Section title="Stored on this device">
        <Card>
          <div className="count-grid">
            {counts.map(([l, n]) => (
              <div key={l}>
                <strong>{n}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <ul className="status-list">
            <li>
              <Icon name={isStandalone() ? 'check' : 'info'} size={16} /> {isStandalone() ? 'Running as a Home Screen app' : 'Running in the browser — add to Home Screen for best reliability'}
            </li>
            <li>
              <Icon name={persisted ? 'check' : 'info'} size={16} />
              {persisted === null ? 'Persistent storage status unavailable' : persisted ? 'Storage marked persistent' : 'Storage may be cleared by the browser if space runs low'}
              {persisted === false && (
                <button className="text-btn" onClick={async () => setPersisted(await requestPersistence())}>
                  Request
                </button>
              )}
            </li>
            {usage && (
              <li>
                <Icon name="info" size={16} /> {usage}
              </li>
            )}
          </ul>
        </Card>
      </Section>

      <Section title="Backup">
        <Card>
          <p className={`small ${backupAge === null || backupAge > 7 ? 'text-warning' : 'muted'}`}>
            {lastBackup ? `Last exported ${formatDateTime(lastBackup)}${backupAge! > 7 ? ` — ${backupAge} days ago` : ''}` : 'You haven’t exported a backup yet.'}
          </p>
          <p className="small muted">Backups are JSON files saved to your device (e.g. the Files app). They aren’t encrypted, so store them somewhere private and don’t upload them to shared or public locations.</p>
          <div className="btn-col">
            {IS_PREVIEW ? (
              <p className="small text-warning">This preview can’t save files. Install the full version (see the README) to export backups.</p>
            ) : (
              <button className="btn btn-primary" onClick={exportBackup}>
                <Icon name="download" size={18} /> Export backup
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={18} /> Restore from backup…
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => onImportFile(e.target.files?.[0])} />
          </div>
        </Card>
      </Section>

      <Section title="Demo data">
        <Card>
          <p className="small muted">Fictional records for exploring or demonstrating the app. They’re labelled “Demo” and can be removed without affecting your own records.</p>
          {data.settings.demoLoadedAt && demo && <p className="small muted">Loaded {formatDate(data.settings.demoLoadedAt.slice(0, 10))}.</p>}
          <div className="btn-col">
            <button
              className="btn btn-secondary"
              onClick={async () => {
                if (demo && !(await confirm({ title: 'Reload demo data?', message: 'Existing demo records will be replaced with a fresh set dated around today. Your own records are kept.', confirmLabel: 'Reload' }))) return;
                run(() => actions.loadDemo(), 'Demo data loaded');
              }}
            >
              {demo ? 'Reload demo data' : 'Load demo data'}
            </button>
            <button
              className="btn btn-danger-ghost"
              disabled={!demo}
              onClick={async () => {
                if (await confirm({ title: 'Clear demo data?', message: 'All records labelled “Demo” will be removed. Your own records are kept.', confirmLabel: 'Clear demo data', danger: true })) run(() => actions.clearDemo(), 'Demo data cleared');
              }}
            >
              Clear all demo data
            </button>
          </div>
        </Card>
      </Section>

      <Section title="Lists">
        <div className="list">
          <button className="row as-button" onClick={() => setListEdit('departments')}>
            <div className="row-main">
              <p className="row-title">Departments & sheds</p>
              <p className="row-meta">{data.settings.departments.length} options</p>
            </div>
            <Icon name="chevronRight" size={18} className="row-chevron" />
          </button>
          <button className="row as-button" onClick={() => setListEdit('categories')}>
            <div className="row-main">
              <p className="row-title">Categories</p>
              <p className="row-meta">{data.settings.categories.length} options</p>
            </div>
            <Icon name="chevronRight" size={18} className="row-chevron" />
          </button>
        </div>
      </Section>

      <Section title="Danger zone">
        <Card>
          <button className="btn btn-danger full" onClick={eraseAll}>
            <Icon name="trash" size={18} /> Erase all data on this device
          </button>
        </Card>
      </Section>

      {listEdit && <ListEditor kind={listEdit} onClose={() => setListEdit(null)} />}
    </div>
  );
}

function ListEditor({ kind, onClose }: { kind: 'departments' | 'categories'; onClose: () => void }) {
  const { settings, issues, feedback } = useData();
  const actions = useActions();
  const { run } = useNotify();
  const [items, setItems] = useState<string[]>(settings[kind]);
  const [adding, setAdding] = useState('');
  const [err, setErr] = useState('');
  const field = kind === 'departments' ? 'department' : 'category';
  const used = (v: string) => issues.some((i) => i[field] === v) || feedback.some((f) => f[field] === v);

  const add = () => {
    const v = adding.trim();
    if (!v) return;
    if (v.length > 60) return setErr('Keep names to 60 characters or fewer.');
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) return setErr('That option already exists.');
    setItems([...items, v]);
    setAdding('');
    setErr('');
  };
  const save = async () => {
    if (!items.length) return setErr('Keep at least one option.');
    if (await run(() => actions.updateSettings({ [kind]: items }), 'List saved')) onClose();
  };
  const move = (i: number, d: -1 | 1) => {
    const a = items.slice();
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setItems(a);
  };

  return (
    <Sheet open onClose={onClose} title={kind === 'departments' ? 'Departments & sheds' : 'Categories'} footer={<SheetButtons onCancel={onClose} onSave={save} />}>
      <ul className="edit-list">
        {items.map((it, i) => (
          <li key={it}>
            <span className="truncate">{it}</span>
            {used(it) && <span className="small muted">in use</span>}
            <button className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${it} up`}>
              <Icon name="arrowUp" size={15} />
            </button>
            <button className="icon-btn sm" onClick={() => setItems(items.filter((x) => x !== it))} aria-label={`Remove ${it}`}>
              <Icon name="close" size={15} />
            </button>
          </li>
        ))}
      </ul>
      <div className="add-row">
        <TextField label="Add option" value={adding} onChange={setAdding} error={err} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button className="btn btn-secondary" onClick={add}>
          Add
        </button>
      </div>
      <p className="small muted">Removing an option doesn’t change existing records.</p>
      <button className="text-btn" onClick={() => setItems(kind === 'departments' ? [...DEFAULT_DEPARTMENTS] : [...DEFAULT_CATEGORIES])}>
        Restore defaults
      </button>
    </Sheet>
  );
}
