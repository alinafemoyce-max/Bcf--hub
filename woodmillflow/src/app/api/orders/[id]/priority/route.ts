import { NextResponse, type NextRequest } from 'next/server';
import { handler, readJson, requireOperator } from '@/server/http';
import { setApprovedPriority } from '@/server/orders';
import { prioritySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { db, operatorId } = await requireOperator();
  const { priority } = await readJson(req, prioritySchema);
  const order = await setApprovedPriority(db, (await ctx.params).id, operatorId, priority);
  return NextResponse.json({ order });
});
