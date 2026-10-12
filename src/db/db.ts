// IndexedDB persistence. All data stays on this device; nothing is sent over the network.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActivityLog, AppData, CommsUpdate, Feedback, Issue, Meeting, Settings, Template, WeeklyPlan } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS } from '../types';

export interface BcfDB extends DBSchema {
  issues: { key: string; value: Issue };
  meetings: { key: string; value: Meeting };
  feedback: { key: string; value: Feedback };
  updates: { key: string; value: CommsUpdate };
  templates: { key: string; value: Template };
  plans: { key: string; value: WeeklyPlan };
  activity: { key: string; value: ActivityLog };
  settings: { key: string; value: Settings };
}

export type StoreName = 'issues' | 'meetings' | 'feedback' | 'updates' | 'templates' | 'plans' | 'activity';
export const STORES: StoreName[] = ['issues', 'meetings', 'feedback', 'updates', 'templates', 'plans', 'activity'];

export const DB_NAME = 'bcf-hub';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BcfDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<BcfDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BcfDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const s of [...STORES, 'settings'] as const) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      },
      blocking() {
        // Another tab wants to upgrade — release our connection.
        dbPromise?.then((d) => d.close());
        dbPromise = null;
      }
    });
  }
  return dbPromise;
}

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    nextIssueNumber: 1,
    departments: [...DEFAULT_DEPARTMENTS],
    categories: [...DEFAULT_CATEGORIES],
    onboarded: false
  };
}

export async function loadAll(): Promise<AppData> {
  const db = await getDB();
  const [issues, meetings, feedback, updates, templates, plans, activity, settings] = await Promise.all([
    db.getAll('issues'),
    db.getAll('meetings'),
    db.getAll('feedback'),
    db.getAll('updates'),
    db.getAll('templates'),
    db.getAll('plans'),
    db.getAll('activity'),
    db.get('settings', 'settings')
  ]);
  return { issues, meetings, feedback, updates, templates, plans, activity, settings: settings ?? defaultSettings() };
}

type StoreValue<S extends StoreName> = BcfDB[S]['value'];

export async function putRecord<S extends StoreName>(store: S, value: StoreValue<S>): Promise<void> {
  const db = await getDB();
  await db.put(store, value as never);
}

export async function deleteRecord(store: StoreName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
}

export async function putSettings(s: Settings): Promise<void> {
  const db = await getDB();
  await db.put('settings', s);
}

/** Writes several records across stores in one transaction (all succeed or none do). */
export async function writeBatch(ops: { store: StoreName; put?: unknown; del?: string }[]): Promise<void> {
  if (!ops.length) return;
  const db = await getDB();
  const names = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(names, 'readwrite');
  for (const o of ops) {
    const st = tx.objectStore(o.store);
    if (o.put) st.put(o.put as never);
    if (o.del) st.delete(o.del);
  }
  await tx.done;
}

/** Replaces the entire database contents (used by import, demo reset and erase). */
export async function replaceAll(data: AppData): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([...STORES, 'settings'], 'readwrite');
  for (const s of STORES) {
    const st = tx.objectStore(s);
    await st.clear();
    for (const rec of data[s] as { id: string }[]) st.put(rec as never);
  }
  tx.objectStore('settings').put(data.settings);
  await tx.done;
}

/** Asks the browser not to evict local data under storage pressure (best effort). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* not supported */
  }
  return false;
}
