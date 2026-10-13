import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { handler, readJson, requireOperator } from '@/server/http';
import { createOrder, getNewestOrder, getStatusCounts, listOrders } from '@/server/orders';
import { idempotencyKeySchema, orderSchema } from '@/lib/validation';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/domain';

export const dynamic = 'force-dynamic';

/** Submit a new cutting request. Validation runs again here regardless of the browser. */
export const POST = handler(async (req: NextRequest) => {
  const body = await readJson(req, z.object({ idempotencyKey: idempotencyKeySchema, order: z.unknown() }));
  const data = orderSchema().parse(body.order);
  const { order, created } = await createOrder(await getDb(), data, body.idempotencyKey);
  return NextResponse.json({ order, created }, { status: created ? 201 : 200 });
});

/** Operator work queue. */
export const GET = handler(async (req: NextRequest) => {
  const { db } = await requireOperator();
  const params = req.nextUrl.searchParams;
  const status = (params.get('status') ?? '')
    .split(',')
    .filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s));
  const search = (params.get('q') ?? '').slice(0, 80);
  const [orders, summary, newest] = await Promise.all([
    listOrders(db, { status, search }),
    getStatusCounts(db),
    getNewestOrder(db)
  ]);
  return NextResponse.json({ orders, summary, newest, serverTime: new Date().toISOString() });
});
