import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { handler, jsonError, readJson } from '@/server/http';
import { resetDemoData } from '@/server/seed';
import { isDemoMode } from '@/server/session';

export const dynamic = 'force-dynamic';

function pinMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Restores the original fictional orders. Requires typing RESET. When the database is a hosted
 * server, DEMO_RESET_PIN must also be configured and supplied.
 */
export const POST = handler(async (req: NextRequest) => {
  if (!isDemoMode()) return jsonError('Demo reset is disabled outside demo mode.', 403);
  const body = await readJson(req, z.object({ confirm: z.string(), pin: z.string().max(64).optional() }));
  if (body.confirm.trim().toUpperCase() !== 'RESET') {
    return jsonError('Type RESET to confirm.', 422, { confirm: 'Type RESET to confirm' });
  }
  const db = await getDb();
  const pin = process.env.DEMO_RESET_PIN;
  if (pin) {
    if (!pinMatches(body.pin ?? '', pin)) return jsonError('Incorrect reset PIN.', 403, { pin: 'Incorrect PIN' });
  } else if (db.kind === 'postgres') {
    return jsonError('Set DEMO_RESET_PIN on the server to enable resetting a hosted demo.', 403);
  }
  await resetDemoData(db);
  return NextResponse.json({ ok: true });
});
