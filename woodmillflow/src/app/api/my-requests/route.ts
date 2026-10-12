import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { handler, readJson } from '@/server/http';
import { getTokensForClock, getTrackedSummaries } from '@/server/orders';
import { getDemoRole } from '@/server/session';
import { trackingTokenSchema } from '@/lib/validation';
import { DEMO_EMPLOYEE } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * "My requests": orders whose tracking links are saved on this device. In demo mode the fictional
 * demo employee (Alex Taylor) also sees their seeded sample orders.
 */
export const POST = handler(async (req: NextRequest) => {
  const { tokens } = await readJson(req, z.object({ tokens: z.array(trackingTokenSchema).max(50) }));
  const db = await getDb();
  const all = new Set(tokens);
  if ((await getDemoRole()) === 'employee') {
    for (const t of await getTokensForClock(db, DEMO_EMPLOYEE.clockNumber)) all.add(t);
  }
  const orders = await getTrackedSummaries(db, [...all]);
  return NextResponse.json({ orders, serverTime: new Date().toISOString() });
});
