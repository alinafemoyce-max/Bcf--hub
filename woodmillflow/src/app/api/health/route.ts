import { NextResponse } from 'next/server';
import { getDb, storageDescription } from '@/server/db';
import { handler } from '@/server/http';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const db = await getDb();
  const [{ orders }] = await db.query<{ orders: number }>('SELECT count(*)::int AS orders FROM orders');
  return NextResponse.json({ ok: true, storage: storageDescription(db.kind), orders, serverTime: new Date().toISOString() });
});
