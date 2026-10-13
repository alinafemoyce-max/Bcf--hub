import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/server/db';
import {
  changeStatusAsOperator,
  createOrder,
  getOrderById,
  getStatusCounts,
  getTrackedOrder,
  getUserIdByClock,
  listOrders,
  requesterAction,
  ServiceError,
  setApprovedPriority
} from '@/server/orders';
import { resetDemoData } from '@/server/seed';
import { freshDatabase, key, parseOrder, sampleOrder } from '../helpers';

let db: Database;
let operatorId: string;

beforeAll(async () => {
  db = await freshDatabase();
  operatorId = (await getUserIdByClock(db, '900101'))!;
});
afterAll(async () => db?.close());

async function submit(overrides = {}) {
  return createOrder(db, parseOrder(sampleOrder(overrides)), key());
}

describe('seeded demonstration data', () => {
  it('contains ten fictional orders in a range of statuses', async () => {
    const orders = await listOrders(db);
    expect(orders).toHaveLength(10);
    const statuses = new Set(orders.map((o) => o.status));
    for (const s of ['submitted', 'accepted', 'in_progress', 'ready', 'collected', 'clarification_required', 'rejected']) {
      expect(statuses.has(s as never)).toBe(true);
    }
    expect(orders.every((o) => /^WM-\d{4}-\d{4}$/.test(o.reference))).toBe(true);
  });
});

describe('creating orders', () => {
  it('saves an order with multiple structured cutting items and a server timestamp', async () => {
    const before = Date.now();
    const { order, created } = await submit();
    expect(created).toBe(true);
    expect(order.status).toBe('submitted');
    expect(order.reference).toMatch(/^WM-\d{4}-0019$/);
    expect(order.trackingToken.length).toBeGreaterThanOrEqual(32);
    const submitted = new Date(order.submittedAt).getTime();
    expect(submitted).toBeGreaterThanOrEqual(before - 5000);
    expect(submitted).toBeLessThanOrEqual(Date.now() + 5000);

    const tracked = (await getTrackedOrder(db, order.trackingToken))!;
    expect(tracked.items).toHaveLength(2);
    expect(tracked.items[0]).toMatchObject({
      position: 1, materialCategory: 'plywood', materialDescription: 'Birch plywood', thicknessMm: 18,
      lengthMm: 800, widthMm: 400, quantity: 3, grainDirection: 'lengthways', cuttingRequirements: ['straight_cut']
    });
    expect(tracked.items[1]).toMatchObject({
      materialCategory: 'mdf', thicknessMm: 12, lengthMm: 600, widthMm: 250, quantity: 2,
      cuttingRequirements: ['straight_cut', 'drilling'], drawingReference: 'DRG-TEST-1', notes: 'Two 8 mm holes'
    });
    expect(tracked.requesterClock).toBe('123456');
    expect(tracked.department).toBe('Shed 2');
    expect(tracked.productionLine).toBe('Manhattan 68');
    expect(tracked.history.map((h) => h.newStatus)).toEqual(['submitted']);
  });

  it('generates unique sequential references', async () => {
    const a = await submit();
    const b = await submit();
    const [x, y] = [a.order.reference, b.order.reference].map((r) => Number(r.slice(-4)));
    expect(y).toBe(x + 1);
  });

  it('is idempotent: repeating a submission returns the original order', async () => {
    const k = key();
    const data = parseOrder(sampleOrder());
    const [first, second] = await Promise.all([createOrder(db, data, k), createOrder(db, data, k)]);
    expect(first.order.reference).toBe(second.order.reference);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
    const third = await createOrder(db, data, k);
    expect(third.created).toBe(false);
    expect(third.order.reference).toBe(first.order.reference);
  });

  it('rejects an unknown department', async () => {
    await expect(createOrder(db, parseOrder(sampleOrder({ departmentId: 999 })), key())).rejects.toBeInstanceOf(ServiceError);
  });

  it('will not let a request use an operator clock number', async () => {
    await expect(createOrder(db, parseOrder(sampleOrder({ clockNumber: '900101' })), key())).rejects.toThrow(/operator/);
  });
});

describe('operator workflow', () => {
  it('moves an order through the full path and the tracking view reflects every update', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;

    let current = await changeStatusAsOperator(db, id, operatorId, { status: 'accepted', expectedStatus: 'submitted' });
    expect(current.status).toBe('accepted');
    expect((await getTrackedOrder(db, order.trackingToken))!.status).toBe('accepted');

    current = await changeStatusAsOperator(db, id, operatorId, { status: 'in_progress', expectedStatus: 'accepted' });
    expect((await getTrackedOrder(db, order.trackingToken))!.status).toBe('in_progress');

    current = await changeStatusAsOperator(db, id, operatorId, {
      status: 'ready', expectedStatus: 'in_progress', comment: 'On the rack', commentInternal: false
    });
    const tracked = (await getTrackedOrder(db, order.trackingToken))!;
    expect(tracked.status).toBe('ready');
    expect(tracked.history.at(-1)!.comment).toBe('On the rack');

    current = await changeStatusAsOperator(db, id, operatorId, { status: 'collected', expectedStatus: 'ready' });
    expect(current.status).toBe('collected');
    expect(current.history.map((h) => h.newStatus)).toEqual(['submitted', 'accepted', 'in_progress', 'ready', 'collected']);
    expect(current.history.slice(1).every((h) => h.changedBy === 'Sam Morgan')).toBe(true);
    for (let i = 1; i < current.history.length; i++) {
      expect(current.history[i].previousStatus).toBe(current.history[i - 1].newStatus);
    }
  });

  it('rejects invalid transitions', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;
    await expect(
      changeStatusAsOperator(db, id, operatorId, { status: 'ready', expectedStatus: 'submitted' })
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      changeStatusAsOperator(db, id, operatorId, { status: 'collected', expectedStatus: 'submitted' })
    ).rejects.toThrow(/cannot be changed/);
    expect((await getOrderById(db, id))!.status).toBe('submitted');
  });

  it('detects conflicting updates from another device', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;
    await changeStatusAsOperator(db, id, operatorId, { status: 'accepted', expectedStatus: 'submitted' });
    await expect(
      changeStatusAsOperator(db, id, operatorId, { status: 'accepted', expectedStatus: 'submitted' })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('requires a message for rejection and clarification', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;
    await expect(
      changeStatusAsOperator(db, id, operatorId, { status: 'rejected', expectedStatus: 'submitted' })
    ).rejects.toThrow(/message/);
  });

  it('hides internal operator notes from the tracking view', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;
    await changeStatusAsOperator(db, id, operatorId, {
      status: 'accepted', expectedStatus: 'submitted', comment: 'Internal: use offcut stock', commentInternal: true
    });
    await setApprovedPriority(db, id, operatorId, 'high');
    const operatorView = (await getOrderById(db, id))!;
    expect(operatorView.history.some((h) => h.comment === 'Internal: use offcut stock')).toBe(true);
    const tracked = (await getTrackedOrder(db, order.trackingToken))!;
    expect(JSON.stringify(tracked)).not.toContain('offcut');
    expect(JSON.stringify(tracked)).not.toContain('Sam Morgan');
    expect(tracked.history.every((h) => h.eventType === 'status')).toBe(true);
    expect('trackingToken' in tracked).toBe(false);
  });

  it('lets the operator set priority and sorts the queue by it', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;
    await setApprovedPriority(db, id, operatorId, 'urgent');
    const queue = await listOrders(db, { status: ['submitted', 'accepted'] });
    expect(queue[0].approvedPriority).toBe('urgent');
  });

  it('supports the clarification round trip with the requester', async () => {
    const { order } = await submit();
    const id = (await listOrders(db, { search: order.reference }))[0].id;
    await changeStatusAsOperator(db, id, operatorId, {
      status: 'clarification_required', expectedStatus: 'submitted', comment: 'Is 800 mm the finished length?'
    });
    const replied = await requesterAction(db, order.trackingToken, { type: 'reply', message: 'Yes, finished length.' });
    expect(replied.status).toBe('submitted');
    expect(replied.history.map((h) => h.comment).filter(Boolean)).toEqual([
      'Is 800 mm the finished length?',
      'Yes, finished length.'
    ]);
  });

  it('lets the requester cancel before work starts but not after', async () => {
    const a = await submit();
    expect((await requesterAction(db, a.order.trackingToken, { type: 'cancel' })).status).toBe('cancelled');
    const b = await submit();
    const id = (await listOrders(db, { search: b.order.reference }))[0].id;
    await changeStatusAsOperator(db, id, operatorId, { status: 'accepted', expectedStatus: 'submitted' });
    await expect(requesterAction(db, b.order.trackingToken, { type: 'cancel' })).rejects.toThrow(/cannot be changed/);
  });

  it('counts orders by status and filters by search', async () => {
    const counts = await getStatusCounts(db);
    expect(counts.counts.submitted).toBeGreaterThan(0);
    const results = await listOrders(db, { search: 'Sapele' });
    expect(results.map((o) => o.items[0].materialDescription)).toContain('Sapele');
  });
});

describe('demo reset', () => {
  it('restores the original ten orders', async () => {
    await resetDemoData(db);
    const orders = await listOrders(db);
    expect(orders).toHaveLength(10);
    const { order } = await submit();
    expect(order.reference.endsWith('0019')).toBe(true);
  });
});

describe('sample data timing', () => {
  it('places sample activity within working hours (Mon–Fri 07:00–17:00 UK)', async () => {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
    const rows = await db.query<{ changed_at: Date | string }>('SELECT changed_at FROM status_history');
    for (const r of rows) {
      const parts = fmt.formatToParts(new Date(r.changed_at));
      const hour = Number(parts.find((p) => p.type === 'hour')!.value);
      const weekday = parts.find((p) => p.type === 'weekday')!.value;
      const created = new Date(r.changed_at).getTime() > Date.now() - 5 * 60000; // orders created by these tests
      if (!created) {
        expect(['Sat', 'Sun']).not.toContain(weekday);
        expect(hour).toBeGreaterThanOrEqual(7);
        expect(hour).toBeLessThan(17);
      }
    }
  });
});
