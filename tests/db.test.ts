import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadAll, putRecord, replaceAll, writeBatch, defaultSettings } from '../src/db/db';
import { buildDemoData } from '../src/db/seed';

describe('IndexedDB persistence', () => {
  it('starts empty with default settings', async () => {
    const d = await loadAll();
    expect(d.issues).toEqual([]);
    expect(d.settings.nextIssueNumber).toBe(1);
  });
  it('replaces all data and reloads it', async () => {
    const { data } = buildDemoData('2026-10-14', 1);
    await replaceAll({ ...data, settings: { ...defaultSettings(), nextIssueNumber: 13 } });
    const d = await loadAll();
    expect(d.issues).toHaveLength(data.issues.length);
    expect(d.meetings).toHaveLength(data.meetings.length);
    expect(d.settings.nextIssueNumber).toBe(13);
  });
  it('writes and deletes in a single batch', async () => {
    const d0 = await loadAll();
    const target = d0.issues[0];
    await writeBatch([
      { store: 'issues', put: { ...target, title: 'Changed' } },
      { store: 'feedback', del: d0.feedback[0].id }
    ]);
    const d1 = await loadAll();
    expect(d1.issues.find((i) => i.id === target.id)!.title).toBe('Changed');
    expect(d1.feedback).toHaveLength(d0.feedback.length - 1);
  });
  it('upserts single records', async () => {
    const d0 = await loadAll();
    await putRecord('templates', { id: 't-new', name: 'N', body: 'B', createdAt: '', updatedAt: '' });
    expect((await loadAll()).templates).toHaveLength(d0.templates.length + 1);
  });
});
