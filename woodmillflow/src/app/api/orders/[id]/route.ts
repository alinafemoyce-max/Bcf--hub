import { NextResponse, type NextRequest } from 'next/server';
import { handler, jsonError, requireOperator } from '@/server/http';
import { getOrderById } from '@/server/orders';

export const dynamic = 'force-dynamic';

export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { db } = await requireOperator();
  const order = await getOrderById(db, (await ctx.params).id);
  return order ? NextResponse.json({ order }) : jsonError('Order not found.', 404);
});
