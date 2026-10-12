import { randomBytes } from 'node:crypto';
import type { Queryable } from './db';
import { DEMO_EMPLOYEE, DEMO_OPERATOR } from '@/lib/config';
import type { CuttingRequirement, GrainDirection, MaterialCategory, OperatorPriority, OrderStatus } from '@/lib/domain';
import { ukCalendarDate } from '@/lib/format';

/** All seed content is fictional demonstration data. */

export const DEPARTMENTS = ['Shed 1', 'Shed 2', 'Shed 3', 'Joinery Shop', 'Prototype Workshop'];
export const PRODUCTION_LINES = ['Manhattan 68', 'Solent 50', 'Purbeck 74', 'Studland 42', 'Stock & General'];

const EMPLOYEES = [
  { name: DEMO_EMPLOYEE.name, clock: DEMO_EMPLOYEE.clockNumber, dept: DEMO_EMPLOYEE.department },
  { name: 'Priya Shah', clock: '318842', dept: 'Shed 1' },
  { name: 'Jordan Hughes', clock: '204518', dept: 'Shed 3' },
  { name: 'Chris Bennett', clock: '410275', dept: 'Joinery Shop' },
  { name: 'Morgan Ellis', clock: '507193', dept: 'Shed 2' },
  { name: 'Taylor Reid', clock: '611024', dept: 'Prototype Workshop' }
];

interface SeedItem {
  category: MaterialCategory;
  description: string;
  thickness: number | null;
  length: number;
  width: number;
  qty: number;
  grain?: GrainDirection;
  cutting: CuttingRequirement[];
  drawing?: string;
  notes?: string;
}

interface SeedOrder {
  seq: number;
  clock: string;
  dept: string;
  line: string;
  hull?: string;
  minutesAgo: number;
  requiredInDays?: number;
  requested?: 'urgent';
  urgentReason?: string;
  approved?: OperatorPriority;
  notes?: string;
  items: SeedItem[];
  /** Status changes after submission: [status, minutes after submission, comment?, internal?] */
  history: [OrderStatus, number, string?, boolean?][];
}

const DAY = 600; // one working day (07:00–17:00)

const ORDERS: SeedOrder[] = [
  {
    seq: 9, clock: '318842', dept: 'Shed 1', line: 'Solent 50', hull: 'S50-DEMO-03', minutesAgo: 3 * DAY + 200,
    approved: 'normal',
    items: [{ category: 'plywood', description: 'Birch plywood', thickness: 12, length: 1200, width: 600, qty: 4, grain: 'lengthways', cutting: ['straight_cut'] }],
    history: [['accepted', 22], ['in_progress', 95], ['ready', 170, 'Four panels on the collection rack, labelled with the order reference.'], ['collected', 255]]
  },
  {
    seq: 10, clock: '410275', dept: 'Joinery Shop', line: 'Purbeck 74', minutesAgo: 2 * DAY + 310,
    approved: 'normal', notes: 'Oak strips for locker trims.',
    items: [
      { category: 'hardwood', description: 'Oak', thickness: 27, length: 2100, width: 140, qty: 6, grain: 'lengthways', cutting: ['straight_cut'] },
      { category: 'veneered_board', description: 'Teak-faced plywood', thickness: 6, length: 900, width: 450, qty: 2, grain: 'lengthways', cutting: ['shaped_cut'], drawing: 'DRG-DEMO-0412' }
    ],
    history: [['accepted', 35], ['in_progress', 140], ['ready', 300], ['collected', 420]]
  },
  {
    seq: 11, clock: '204518', dept: 'Shed 3', line: 'Studland 42', minutesAgo: DAY + 380,
    items: [{ category: 'mdf', description: 'Standard MDF', thickness: 18, length: 2100, width: 140, qty: 6, grain: 'not_applicable', cutting: ['straight_cut'] }],
    history: [['rejected', 30, 'This duplicates a request already cut for Shed 3 yesterday. Please contact the woodmill if more are needed.']]
  },
  {
    seq: 12, clock: '507193', dept: 'Shed 2', line: 'Manhattan 68', hull: 'M68-DEMO-11', minutesAgo: DAY + 120,
    approved: 'normal',
    items: [{ category: 'mdf', description: 'Moisture-resistant MDF', thickness: 18, length: 1800, width: 500, qty: 2, grain: 'not_applicable', cutting: ['straight_cut', 'drilling'], notes: 'Four 8 mm holes per panel, 50 mm in from each corner.' }],
    history: [['accepted', 40], ['in_progress', 300], ['ready', 420, 'Ready on the collection rack.']]
  },
  {
    seq: 13, clock: '611024', dept: 'Prototype Workshop', line: 'Stock & General', minutesAgo: 6 * 60,
    approved: 'high',
    items: [{ category: 'laminate', description: 'Compact laminate panel', thickness: 12, length: 600, width: 400, qty: 3, grain: 'not_applicable', cutting: ['straight_cut', 'routing'], drawing: 'DRG-DEMO-0533', notes: '3 mm radius on all external corners.' }],
    history: [['accepted', 20], ['in_progress', 210, 'Routing after the current sheet run.', true]]
  },
  {
    seq: 14, clock: DEMO_EMPLOYEE.clockNumber, dept: DEMO_EMPLOYEE.department, line: DEMO_EMPLOYEE.productionLine, hull: 'M68-DEMO-07', minutesAgo: 4 * 60 + 10,
    approved: 'normal', requiredInDays: 1,
    items: [{ category: 'plywood', description: 'Marine plywood', thickness: 9, length: 1500, width: 700, qty: 2, grain: 'lengthways', cutting: ['straight_cut'] }],
    history: [['accepted', 30], ['in_progress', 150]]
  },
  {
    seq: 15, clock: '318842', dept: 'Shed 1', line: 'Solent 50', minutesAgo: 3 * 60,
    approved: 'normal', requiredInDays: 2,
    items: [{ category: 'hardwood', description: 'Sapele', thickness: 20, length: 1200, width: 95, qty: 8, grain: 'lengthways', cutting: ['straight_cut'] }],
    history: [['accepted', 45]]
  },
  {
    seq: 16, clock: '204518', dept: 'Shed 3', line: 'Studland 42', hull: 'S42-DEMO-02', minutesAgo: 2 * 60,
    items: [{ category: 'plywood', description: 'Lightweight poplar plywood', thickness: 15, length: 1100, width: 540, qty: 2, grain: 'widthways', cutting: ['straight_cut', 'shaped_cut'], drawing: 'DRG-DEMO-0388' }],
    history: [['clarification_required', 25, 'Drawing DRG-DEMO-0388 shows a 450 mm width but the request says 540 mm. Which is correct?']]
  },
  {
    seq: 17, clock: '410275', dept: 'Joinery Shop', line: 'Purbeck 74', minutesAgo: 40,
    requested: 'urgent', urgentReason: 'Panel needed for deck locker fit-out this afternoon.', requiredInDays: 0,
    items: [{ category: 'veneered_board', description: 'Oak-faced board', thickness: 18, length: 1000, width: 450, qty: 1, grain: 'lengthways', cutting: ['straight_cut'] }],
    history: []
  },
  {
    seq: 18, clock: DEMO_EMPLOYEE.clockNumber, dept: DEMO_EMPLOYEE.department, line: DEMO_EMPLOYEE.productionLine, minutesAgo: 15,
    notes: 'Please confirm the dimensions before cutting.',
    items: [
      { category: 'plywood', description: 'Birch plywood', thickness: 18, length: 800, width: 400, qty: 3, grain: 'lengthways', cutting: ['straight_cut'] },
      { category: 'mdf', description: 'Moisture-resistant MDF', thickness: 12, length: 600, width: 250, qty: 2, grain: 'not_applicable', cutting: ['straight_cut'] }
    ],
    history: []
  }
];

const SEQUENCE_AFTER_SEED = 18;

const token = () => randomBytes(24).toString('base64url');

const ukParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });

/** Woodmill working hours for sample data: Monday–Friday, 07:00–17:00 UK time. */
function isWorkingMinute(d: Date): boolean {
  const parts = ukParts.formatToParts(d);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return weekday !== 'Sat' && weekday !== 'Sun' && hour >= 7 && hour < 17;
}

/**
 * Moves a time backwards (negative) or forwards by a number of working minutes, so sample orders
 * look like they were placed and processed during a working day whenever the demo is reset.
 */
function shiftWorking(from: Date, minutes: number, limit?: Date): Date {
  const step = minutes < 0 ? -60000 : 60000;
  let remaining = Math.abs(minutes);
  let t = from.getTime();
  while (remaining > 0) {
    t += step;
    if (limit && t >= limit.getTime()) return new Date(limit.getTime() - 60000);
    if (isWorkingMinute(new Date(t))) remaining--;
  }
  return new Date(t);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inserts reference data and the fictional sample orders. Expects empty tables. */
export async function seed(db: Queryable, now: Date = new Date()): Promise<void> {
  for (const [i, name] of DEPARTMENTS.entries()) {
    await db.query('INSERT INTO departments (name, sort_order) VALUES ($1, $2)', [name, i]);
  }
  for (const [i, name] of PRODUCTION_LINES.entries()) {
    await db.query('INSERT INTO production_lines (name, sort_order) VALUES ($1, $2)', [name, i]);
  }
  const deptId = new Map(
    (await db.query<{ id: number; name: string }>('SELECT id, name FROM departments')).map((r) => [r.name, r.id])
  );
  const lineId = new Map(
    (await db.query<{ id: number; name: string }>('SELECT id, name FROM production_lines')).map((r) => [r.name, r.id])
  );

  const userId = new Map<string, string>();
  for (const e of EMPLOYEES) {
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO users (clock_number, name, role, department_id) VALUES ($1, $2, 'employee', $3) RETURNING id`,
      [e.clock, e.name, deptId.get(e.dept)]
    );
    userId.set(e.clock, row.id);
  }
  const [operator] = await db.query<{ id: string }>(
    `INSERT INTO users (clock_number, name, role) VALUES ($1, $2, 'operator') RETURNING id`,
    [DEMO_OPERATOR.clockNumber, DEMO_OPERATOR.name]
  );

  const year = Number(ukCalendarDate(now).slice(0, 4));
  const today = ukCalendarDate(now);

  for (const o of ORDERS) {
    const submittedAt = shiftWorking(now, -o.minutesAgo);
    const at = (minutesAfter: number) => shiftWorking(submittedAt, minutesAfter, now);
    const employee = EMPLOYEES.find((e) => e.clock === o.clock)!;
    const statuses = o.history.map((h) => h[0]);
    const status: OrderStatus = statuses.at(-1) ?? 'submitted';
    const updatedAt = o.history.length ? at(o.history.at(-1)![1]) : submittedAt;
    const [order] = await db.query<{ id: string }>(
      `INSERT INTO orders (reference, requester_id, requester_name, requester_clock, department_id, production_line_id,
         hull_reference, date_required, submitted_at, updated_at, status, requested_priority, urgent_reason,
         approved_priority, notes, tracking_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        `WM-${year}-${String(o.seq).padStart(4, '0')}`,
        userId.get(o.clock), employee.name, o.clock, deptId.get(o.dept), lineId.get(o.line),
        o.hull ?? null,
        o.requiredInDays === undefined ? null : addDays(today, o.requiredInDays),
        submittedAt.toISOString(), updatedAt.toISOString(), status,
        o.requested ?? 'normal', o.urgentReason ?? null, o.approved ?? null, o.notes ?? null, token()
      ]
    );
    for (const [i, item] of o.items.entries()) {
      await db.query(
        `INSERT INTO order_items (order_id, position, material_category, material_description, thickness_mm, length_mm,
           width_mm, quantity, grain_direction, cutting_requirements, drawing_reference, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [order.id, i + 1, item.category, item.description, item.thickness, item.length, item.width, item.qty,
          item.grain ?? null, item.cutting, item.drawing ?? null, item.notes ?? null]
      );
    }
    await db.query(
      `INSERT INTO status_history (order_id, previous_status, new_status, changed_at, changed_by)
       VALUES ($1, NULL, 'submitted', $2, $3)`,
      [order.id, submittedAt.toISOString(), userId.get(o.clock)]
    );
    let previous: OrderStatus = 'submitted';
    for (const [next, minutes, comment, internal] of o.history) {
      await db.query(
        `INSERT INTO status_history (order_id, previous_status, new_status, changed_at, changed_by, comment, comment_internal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, previous, next, at(minutes).toISOString(), operator.id,
          comment ?? null, internal ?? false]
      );
      previous = next;
    }
  }
  await db.query(
    `INSERT INTO order_sequences (year, last_value) VALUES ($1, $2)
     ON CONFLICT (year) DO UPDATE SET last_value = GREATEST(order_sequences.last_value, EXCLUDED.last_value)`,
    [year, SEQUENCE_AFTER_SEED]
  );
}

const SEED_LOCK = 72_640_215;

export async function seedIfEmpty(db: { transaction: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T> }) {
  await db.transaction(async (tx) => {
    // Serialises concurrent first starts (for example several serverless instances).
    await tx.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK]);
    const [{ count }] = await tx.query<{ count: number }>('SELECT count(*)::int AS count FROM departments');
    if (count === 0) await seed(tx);
  });
}

/** Deletes every order and user and restores the original fictional data, atomically. */
export async function resetDemoData(db: { transaction: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T> }, now = new Date()) {
  await db.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK]);
    await tx.query(
      'TRUNCATE status_history, order_items, orders, users, order_sequences, departments, production_lines RESTART IDENTITY CASCADE'
    );
    await seed(tx, now);
  });
}
