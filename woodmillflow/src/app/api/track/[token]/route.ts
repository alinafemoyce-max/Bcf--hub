import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { handler, jsonError, readJson } from '@/server/http';
import { getTrackedOrder, requesterAction } from '@/server/orders';
import { trackingTokenSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };

async function token(ctx: Ctx) {
  const parsed = trackingTokenSchema.safeParse((await ctx.params).token);
  return parsed.success ? parsed.data : null;
}

/** Public tracking view: only reachable with the unguessable token, and internal notes are removed. */
export const GET = handler(async (_req: NextRequest, ctx: Ctx) => {
  const t = await token(ctx);
  const order = t ? await getTrackedOrder(await getDb(), t) : null;
  return order ? NextResponse.json({ order, serverTime: new Date().toISOString() }) : jsonError('Order not found.', 404);
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), message: z.string().trim().min(2, 'Enter a reply').max(1000) }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().max(300).optional() })
]);

export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const t = await token(ctx);
  if (!t) return jsonError('Order not found.', 404);
  const body = await readJson(req, actionSchema);
  const order = await requesterAction(
    await getDb(),
    t,
    body.action === 'reply' ? { type: 'reply', message: body.message } : { type: 'cancel', reason: body.reason || undefined }
  );
  return NextResponse.json({ order });
});
