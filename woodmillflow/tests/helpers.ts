import { createPgliteDatabase, createPostgresDatabase, type Database } from '@/server/db';
import { migrate } from '@/server/schema';
import { seedIfEmpty } from '@/server/seed';
import type { OrderInput } from '@/lib/validation';
import { orderSchema } from '@/lib/validation';
import { randomBytes } from 'node:crypto';

/** Fresh in-memory PostgreSQL (PGlite), or a real server when TEST_DATABASE_URL is set. */
export async function freshDatabase(): Promise<Database> {
  const url = process.env.TEST_DATABASE_URL;
  const db = url ? await createPostgresDatabase(url) : await createPgliteDatabase();
  if (url) {
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
  }
  await migrate(db);
  await seedIfEmpty(db);
  return db;
}

export const key = () => randomBytes(16).toString('hex');

export function sampleOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    clockNumber: '123456',
    employeeName: 'Alex Taylor',
    departmentId: 2,
    productionLineId: 1,
    hullReference: '',
    dateRequired: '',
    requestedPriority: 'normal',
    urgentReason: '',
    notes: 'Please confirm the dimensions before cutting.',
    items: [
      {
        materialCategory: 'plywood', materialDescription: 'Birch plywood', thicknessMm: '18', lengthMm: '800',
        widthMm: '400', quantity: '3', grainDirection: 'lengthways', cuttingRequirements: ['straight_cut'],
        cuttingOther: '', drawingReference: '', notes: ''
      },
      {
        materialCategory: 'mdf', materialDescription: 'Moisture-resistant MDF', thicknessMm: '12', lengthMm: '600',
        widthMm: '250', quantity: '2', grainDirection: 'not_applicable', cuttingRequirements: ['straight_cut', 'drilling'],
        cuttingOther: '', drawingReference: 'DRG-TEST-1', notes: 'Two 8 mm holes'
      }
    ],
    ...overrides
  };
}

export function parseOrder(input: OrderInput) {
  return orderSchema({ today: '2026-10-14' }).parse(input);
}
