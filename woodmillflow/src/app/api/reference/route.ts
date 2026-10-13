import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { handler } from '@/server/http';
import { getReferenceData } from '@/server/orders';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => NextResponse.json(await getReferenceData(await getDb())));
