import { NextResponse, type NextRequest } from 'next/server';
import { handler, readJson, requireOperator } from '@/server/http';
import { changeStatusAsOperator } from '@/server/orders';
import { statusChangeSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { db, operatorId } = await requireOperator();
  const body = await readJson(req, statusChangeSchema);
  const order = await changeStatusAsOperator(db, (await ctx.params).id, operatorId, body);
  return NextResponse.json({ order });
});
