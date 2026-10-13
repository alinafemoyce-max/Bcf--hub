import { randomBytes } from 'node:crypto';
import type { Database, Queryable } from './db';
import {
  canTransition,
  COMMENT_REQUIRED,
  ORDER_STATUSES,
  STATUS_LABELS,
  type Actor,
  type OperatorPriority,
  type OrderStatus
} from '@/lib/domain';
import { ORDER_REFERENCE_PREFIX } from '@/lib/config';
import { ukCalendarDate } from '@/lib/format';
import type { OrderData } from '@/lib/validation';
import type {
  CreatedOrder,
  HistoryEntry,
  OperatorOrder,
  OrderItem,
  ReferenceData,
  StatusCounts,
  TrackedOrder
} from '@/lib/types';

/** Errors with a user-facing message and HTTP status, raised by the order service. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
  }
}

const ISO = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const ORDER_COLUMNS = `
  o.id, o.reference, o.status, ${ISO('o.submitted_at')} AS submitted_at, ${ISO('o.updated_at')} AS updated_at,
  to_char(o.date_required, 'YYYY-MM-DD') AS date_required, o.requested_priority, o.urgent_reason,
  o.approved_priority, o.requester_name, o.requester_clock, d.name AS department, pl.name AS production_line,
  o.hull_reference, o.notes, o.tracking_token`;

const ORDER_FROM = `
  FROM orders o
  JOIN departments d ON d.id = o.department_id
  JOIN production_lines pl ON pl.id = o.production_line_id`;

interface OrderRow {
  id: string;
  reference: string;
  status: OrderStatus;
  submitted_at: string;
  updated_at: string;
  date_required: string | null;
  requested_priority: 'normal' | 'urgent';
  urgent_reason: string | null;
  approved_priority: OperatorPriority | null;
  requester_name: string;
  requester_clock: string;
  department: string;
  production_line: string;
  hull_reference: string | null;
  notes: string | null;
  tracking_token: string;
}

interface ItemRow {
  id: string;
  order_id: string;
  position: number;
  material_category: OrderItem['materialCategory'];
  material_description: string;
  thickness_mm: number | null;
  length_mm: number;
  width_mm: number;
  quantity: number;
  grain_direction: OrderItem['grainDirection'];
  cutting_requirements: OrderItem['cuttingRequirements'];
  cutting_other: string | null;
  drawing_reference: string | null;
  notes: string | null;
}

interface HistoryRow {
  id: string;
  order_id: string;
  event_type: 'status' | 'priority';
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_at: string;
  changed_by: string;
  changed_by_role: 'employee' | 'operator';
  comment: string | null;
  comment_internal: boolean;
}

function mapItem(r: ItemRow): OrderItem {
  return {
    id: r.id,
    position: r.position,
    materialCategory: r.material_category,
    materialDescription: r.material_description,
    thicknessMm: r.thickness_mm === null ? null : Number(r.thickness_mm),
    lengthMm: Number(r.length_mm),
    widthMm: Number(r.width_mm),
    quantity: Number(r.quantity),
    grainDirection: r.grain_direction,
    cuttingRequirements: r.cutting_requirements,
    cuttingOther: r.cutting_other,
    drawingReference: r.drawing_reference,
    notes: r.notes
  };
}

function mapHistory(r: HistoryRow): HistoryEntry {
  return {
    id: String(r.id),
    eventType: r.event_type,
    previousStatus: r.previous_status,
    newStatus: r.new_status,
    changedAt: r.changed_at,
    changedBy: r.changed_by,
    changedByRole: r.changed_by_role,
    comment: r.comment,
    commentInternal: r.comment_internal
  };
}

async function loadItems(db: Queryable, orderIds: string[]): Promise<Map<string, OrderItem[]>> {
  const map = new Map<string, OrderItem[]>();
  if (!orderIds.length) return map;
  const rows = await db.query<ItemRow>(
    `SELECT id, order_id, position, material_category, material_description, thickness_mm::float8 AS thickness_mm,
            length_mm, width_mm, quantity, grain_direction, cutting_requirements, cutting_other, drawing_reference, notes
       FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY order_id, position`,
    [orderIds]
  );
  for (const r of rows) {
    const list = map.get(r.order_id) ?? [];
    list.push(mapItem(r));
    map.set(r.order_id, list);
  }
  return map;
}

async function loadHistory(db: Queryable, orderId: string): Promise<HistoryEntry[]> {
  const rows = await db.query<HistoryRow>(
    `SELECT h.id::text AS id, h.order_id, h.event_type, h.previous_status, h.new_status, ${ISO('h.changed_at')} AS changed_at,
            u.name AS changed_by, u.role AS changed_by_role, h.comment, h.comment_internal
       FROM status_history h JOIN users u ON u.id = h.changed_by
      WHERE h.order_id = $1 ORDER BY h.changed_at, h.id`,
    [orderId]
  );
  return rows.map(mapHistory);
}

function mapOrder(r: OrderRow, items: OrderItem[], history: HistoryEntry[]): OperatorOrder {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
    dateRequired: r.date_required,
    requestedPriority: r.requested_priority,
    urgentReason: r.urgent_reason,
    approvedPriority: r.approved_priority,
    requesterName: r.requester_name,
    requesterClock: r.requester_clock,
    department: r.department,
    productionLine: r.production_line,
    hullReference: r.hull_reference,
    notes: r.notes,
    trackingToken: r.tracking_token,
    items,
    history
  };
}

/** Strips everything the requester should not see: internal notes and the operator's identity. */
export function toTrackedOrder(order: OperatorOrder): TrackedOrder {
  return {
    reference: order.reference,
    status: order.status,
    submittedAt: order.submittedAt,
    updatedAt: order.updatedAt,
    dateRequired: order.dateRequired,
    requestedPriority: order.requestedPriority,
    urgentReason: order.urgentReason,
    approvedPriority: order.approvedPriority,
    requesterName: order.requesterName,
    requesterClock: order.requesterClock,
    department: order.department,
    productionLine: order.productionLine,
    hullReference: order.hullReference,
    notes: order.notes,
    items: order.items,
    history: order.history
      .filter((h) => h.eventType === 'status')
      .map((h) => ({
        ...h,
        changedBy: h.changedByRole === 'operator' ? 'Woodmill' : h.changedBy,
        comment: h.commentInternal ? null : h.comment,
        commentInternal: false
      }))
  };
}

export async function getReferenceData(db: Queryable): Promise<ReferenceData> {
  const [departments, productionLines] = await Promise.all([
    db.query<{ id: number; name: string }>('SELECT id, name FROM departments WHERE active ORDER BY sort_order, name'),
    db.query<{ id: number; name: string }>('SELECT id, name FROM production_lines WHERE active ORDER BY sort_order, name')
  ]);
  return { departments, productionLines };
}

const newTrackingToken = () => randomBytes(24).toString('base64url');

function isUniqueViolation(err: unknown, constraintFragment: string): boolean {
  const e = err as { code?: string; constraint?: string; constraint_name?: string; message?: string };
  const constraint = e.constraint ?? e.constraint_name ?? e.message ?? '';
  return e.code === '23505' && constraint.includes(constraintFragment);
}

async function findByIdempotencyKey(db: Queryable, key: string): Promise<CreatedOrder | null> {
  const [row] = await db.query<{ reference: string; status: OrderStatus; submitted_at: string; tracking_token: string }>(
    `SELECT reference, status, ${ISO('submitted_at')} AS submitted_at, tracking_token FROM orders WHERE idempotency_key = $1`,
    [key]
  );
  return row
    ? { reference: row.reference, status: row.status, submittedAt: row.submitted_at, trackingToken: row.tracking_token }
    : null;
}

/**
 * Creates an order and all its cutting items in one transaction. The submission time and order
 * reference are generated by the database server. Repeating a request with the same idempotency
 * key returns the original order instead of creating a duplicate.
 */
export async function createOrder(
  db: Database,
  data: OrderData,
  idempotencyKey: string,
  now: Date = new Date()
): Promise<{ order: CreatedOrder; created: boolean }> {
  const existing = await findByIdempotencyKey(db, idempotencyKey);
  if (existing) return { order: existing, created: false };

  try {
    const order = await db.transaction(async (tx) => {
      const [dept] = await tx.query<{ id: number }>('SELECT id FROM departments WHERE id = $1 AND active', [data.departmentId]);
      if (!dept) throw new ServiceError('Please choose a valid department.', 422, { departmentId: 'Choose your department or shed' });
      const [line] = await tx.query<{ id: number }>('SELECT id FROM production_lines WHERE id = $1 AND active', [data.productionLineId]);
      if (!line) throw new ServiceError('Please choose a valid production line.', 422, { productionLineId: 'Choose the production line' });

      const [user] = await tx.query<{ id: string }>(
        `INSERT INTO users (clock_number, name, role, department_id) VALUES ($1, $2, 'employee', $3)
         ON CONFLICT (clock_number) DO UPDATE SET name = EXCLUDED.name, department_id = EXCLUDED.department_id
           WHERE users.role = 'employee'
         RETURNING id`,
        [data.clockNumber, data.employeeName, data.departmentId]
      );
      if (!user) {
        throw new ServiceError('This clock number belongs to a woodmill operator account.', 422, {
          clockNumber: 'This clock number cannot be used for requests'
        });
      }

      const year = Number(ukCalendarDate(now).slice(0, 4));
      const [seq] = await tx.query<{ last_value: number }>(
        `INSERT INTO order_sequences (year, last_value) VALUES ($1, 1)
         ON CONFLICT (year) DO UPDATE SET last_value = order_sequences.last_value + 1
         RETURNING last_value`,
        [year]
      );
      const reference = `${ORDER_REFERENCE_PREFIX}-${year}-${String(seq.last_value).padStart(4, '0')}`;

      const [row] = await tx.query<{ id: string; submitted_at: string; tracking_token: string }>(
        `INSERT INTO orders (reference, requester_id, requester_name, requester_clock, department_id, production_line_id,
           hull_reference, date_required, requested_priority, urgent_reason, notes, tracking_token, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, ${ISO('submitted_at')} AS submitted_at, tracking_token`,
        [
          reference, user.id, data.employeeName, data.clockNumber, data.departmentId, data.productionLineId,
          data.hullReference ?? null, data.dateRequired ?? null, data.requestedPriority,
          data.requestedPriority === 'urgent' ? data.urgentReason ?? null : null,
          data.notes ?? null, newTrackingToken(), idempotencyKey
        ]
      );

      for (const [i, item] of data.items.entries()) {
        await tx.query(
          `INSERT INTO order_items (order_id, position, material_category, material_description, thickness_mm, length_mm,
             width_mm, quantity, grain_direction, cutting_requirements, cutting_other, drawing_reference, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            row.id, i + 1, item.materialCategory, item.materialDescription, item.thicknessMm ?? null, item.lengthMm,
            item.widthMm, item.quantity, item.grainDirection ?? null, item.cuttingRequirements,
            item.cuttingRequirements.includes('other') ? item.cuttingOther ?? null : null,
            item.drawingReference ?? null, item.notes ?? null
          ]
        );
      }

      await tx.query(
        `INSERT INTO status_history (order_id, previous_status, new_status, changed_at, changed_by)
         SELECT id, NULL, 'submitted', submitted_at, requester_id FROM orders WHERE id = $1`,
        [row.id]
      );

      return { reference, status: 'submitted' as const, submittedAt: row.submitted_at, trackingToken: row.tracking_token };
    });
    return { order, created: true };
  } catch (err) {
    // Two identical submissions raced each other: return the one that won.
    if (isUniqueViolation(err, 'idempotency')) {
      const winner = await findByIdempotencyKey(db, idempotencyKey);
      if (winner) return { order: winner, created: false };
    }
    throw err;
  }
}

export interface OrderFilters {
  status?: OrderStatus[];
  search?: string;
}

/** Operator queue: agreed priority first (unset counts as normal), then oldest submission first. */
export async function listOrders(db: Queryable, filters: OrderFilters = {}): Promise<OperatorOrder[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.status?.length) {
    params.push(filters.status);
    where.push(`o.status = ANY($${params.length}::text[])`);
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const p = `$${params.length}`;
    where.push(`(o.reference ILIKE ${p} OR o.requester_name ILIKE ${p} OR o.requester_clock ILIKE ${p}
      OR d.name ILIKE ${p} OR pl.name ILIKE ${p} OR o.hull_reference ILIKE ${p}
      OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.material_description ILIKE ${p}))`);
  }
  const rows = await db.query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} ${ORDER_FROM}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY CASE COALESCE(o.approved_priority, 'normal') WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
              o.submitted_at ASC
     LIMIT 500`,
    params
  );
  const items = await loadItems(db, rows.map((r) => r.id));
  return rows.map((r) => mapOrder(r, items.get(r.id) ?? [], []));
}

export async function getOrderById(db: Queryable, id: string): Promise<OperatorOrder | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.query<OrderRow>(`SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.id = $1`, [id]);
  if (!row) return null;
  const [items, history] = await Promise.all([loadItems(db, [row.id]), loadHistory(db, row.id)]);
  return mapOrder(row, items.get(row.id) ?? [], history);
}

export async function getOrderByToken(db: Queryable, token: string): Promise<OperatorOrder | null> {
  const [row] = await db.query<OrderRow>(`SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.tracking_token = $1`, [token]);
  if (!row) return null;
  const [items, history] = await Promise.all([loadItems(db, [row.id]), loadHistory(db, row.id)]);
  return mapOrder(row, items.get(row.id) ?? [], history);
}

export async function getTrackedOrder(db: Queryable, token: string): Promise<TrackedOrder | null> {
  const order = await getOrderByToken(db, token);
  return order ? toTrackedOrder(order) : null;
}

/** Lightweight summaries for the "My requests" list, looked up by tracking tokens held on the device. */
export async function getTrackedSummaries(db: Queryable, tokens: string[]): Promise<(TrackedOrder & { trackingToken: string })[]> {
  if (!tokens.length) return [];
  const rows = await db.query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.tracking_token = ANY($1::text[]) ORDER BY o.submitted_at DESC`,
    [tokens.slice(0, 50)]
  );
  const items = await loadItems(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...toTrackedOrder(mapOrder(r, items.get(r.id) ?? [], [])), trackingToken: r.tracking_token }));
}

/** Tracking tokens of the fictional demo employee's orders (demo mode only). */
export async function getTokensForClock(db: Queryable, clockNumber: string): Promise<string[]> {
  const rows = await db.query<{ tracking_token: string }>(
    'SELECT tracking_token FROM orders WHERE requester_clock = $1 ORDER BY submitted_at DESC LIMIT 50',
    [clockNumber]
  );
  return rows.map((r) => r.tracking_token);
}

export async function getUserIdByClock(db: Queryable, clockNumber: string): Promise<string | null> {
  const [row] = await db.query<{ id: string }>('SELECT id FROM users WHERE clock_number = $1', [clockNumber]);
  return row?.id ?? null;
}

interface StatusChange {
  to: OrderStatus;
  expectedStatus: OrderStatus;
  actor: Actor;
  actorUserId: string;
  comment?: string;
  commentInternal?: boolean;
}

/**
 * Applies a status change if the workflow allows it. `expectedStatus` guards against two people
 * updating the same order at once (for example the laptop and the iPhone): the update only
 * succeeds if the order is still in the status the user was looking at.
 */
async function applyStatusChange(db: Database, where: { id?: string; token?: string }, change: StatusChange) {
  return db.transaction(async (tx) => {
    const [current] = await tx.query<{ id: string; status: OrderStatus }>(
      `SELECT id, status FROM orders WHERE ${where.id ? 'id = $1' : 'tracking_token = $1'} FOR UPDATE`,
      [where.id ?? where.token]
    );
    if (!current) throw new ServiceError('Order not found.', 404);
    if (current.status !== change.expectedStatus) {
      throw new ServiceError(
        `This order is now "${STATUS_LABELS[current.status]}" — it was updated elsewhere. The latest details have been loaded.`,
        409
      );
    }
    if (!canTransition(current.status, change.to, change.actor)) {
      throw new ServiceError(
        `An order that is "${STATUS_LABELS[current.status]}" cannot be changed to "${STATUS_LABELS[change.to]}".`,
        422
      );
    }
    if (COMMENT_REQUIRED.includes(change.to) && !change.comment) {
      throw new ServiceError('Please add a message explaining this change.', 422, { comment: 'A message is required' });
    }
    const internal = change.actor === 'operator' && !COMMENT_REQUIRED.includes(change.to) ? Boolean(change.commentInternal) : false;
    await tx.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1', [current.id, change.to]);
    await tx.query(
      `INSERT INTO status_history (order_id, previous_status, new_status, changed_by, comment, comment_internal)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [current.id, current.status, change.to, change.actorUserId, change.comment ?? null, internal]
    );
    return current.id;
  });
}

export async function changeStatusAsOperator(
  db: Database,
  orderId: string,
  operatorUserId: string,
  input: { status: OrderStatus; expectedStatus: OrderStatus; comment?: string; commentInternal?: boolean }
): Promise<OperatorOrder> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new ServiceError('Order not found.', 404);
  await applyStatusChange(db, { id: orderId }, {
    to: input.status,
    expectedStatus: input.expectedStatus,
    actor: 'operator',
    actorUserId: operatorUserId,
    comment: input.comment,
    commentInternal: input.commentInternal
  });
  return (await getOrderById(db, orderId))!;
}

/** Requester actions via the tracking link: answer a clarification or cancel before work starts. */
export async function requesterAction(
  db: Database,
  token: string,
  action: { type: 'reply'; message: string } | { type: 'cancel'; reason?: string }
): Promise<TrackedOrder> {
  const order = await getOrderByToken(db, token);
  if (!order) throw new ServiceError('Order not found.', 404);
  const [requester] = await db.query<{ id: string }>('SELECT requester_id AS id FROM orders WHERE id = $1', [order.id]);
  if (action.type === 'reply') {
    if (order.status !== 'clarification_required') {
      throw new ServiceError('The woodmill has not asked a question about this order.', 422);
    }
    await applyStatusChange(db, { token }, {
      to: 'submitted', expectedStatus: 'clarification_required', actor: 'requester', actorUserId: requester.id, comment: action.message
    });
  } else {
    await applyStatusChange(db, { token }, {
      to: 'cancelled', expectedStatus: order.status, actor: 'requester', actorUserId: requester.id,
      comment: action.reason || 'Cancelled by the requester.'
    });
  }
  return (await getTrackedOrder(db, token))!;
}

export async function setApprovedPriority(
  db: Database,
  orderId: string,
  operatorUserId: string,
  priority: OperatorPriority
): Promise<OperatorOrder> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new ServiceError('Order not found.', 404);
  await db.transaction(async (tx) => {
    const [current] = await tx.query<{ status: OrderStatus; approved_priority: OperatorPriority | null }>(
      'SELECT status, approved_priority FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (!current) throw new ServiceError('Order not found.', 404);
    if (['collected', 'rejected', 'cancelled'].includes(current.status)) {
      throw new ServiceError('Priority cannot be changed on a closed order.', 422);
    }
    if (current.approved_priority === priority) return;
    await tx.query('UPDATE orders SET approved_priority = $2, updated_at = now() WHERE id = $1', [orderId, priority]);
    await tx.query(
      `INSERT INTO status_history (order_id, event_type, previous_status, new_status, changed_by, comment, comment_internal)
       VALUES ($1, 'priority', $2, $2, $3, $4, TRUE)`,
      [orderId, current.status, operatorUserId, `Priority set to ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`]
    );
  });
  return (await getOrderById(db, orderId))!;
}

export async function getStatusCounts(db: Queryable, now: Date = new Date()): Promise<StatusCounts> {
  const rows = await db.query<{ status: OrderStatus; count: number }>(
    'SELECT status, count(*)::int AS count FROM orders GROUP BY status'
  );
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of rows) counts[r.status] = Number(r.count);
  const [today] = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM orders
      WHERE status = 'collected' AND (updated_at AT TIME ZONE 'Europe/London')::date = $1::date`,
    [ukCalendarDate(now)]
  );
  return { counts, completedToday: Number(today?.count ?? 0) };
}

/** Most recently submitted order — lets the dashboard announce new arrivals. */
export async function getNewestOrder(db: Queryable): Promise<{ id: string; reference: string } | null> {
  const [row] = await db.query<{ id: string; reference: string }>(
    'SELECT id, reference FROM orders ORDER BY submitted_at DESC, reference DESC LIMIT 1'
  );
  return row ?? null;
}
