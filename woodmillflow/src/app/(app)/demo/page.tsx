import type { Metadata } from 'next';
import { Database, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleSwitch } from '@/components/app-shell';
import { ResetDemo } from '@/components/reset-demo';
import { getDb, storageDescription } from '@/server/db';
import { getDemoRole, isDemoMode } from '@/server/session';
import { DEMO_EMPLOYEE, DEMO_OPERATOR } from '@/lib/config';
import { formatUkDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Demo Settings' };
export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  const role = await getDemoRole();
  const demo = isDemoMode();
  let storage = 'Unavailable';
  let orderCount: number | null = null;
  let kind: 'pglite' | 'postgres' | null = null;
  try {
    const db = await getDb();
    kind = db.kind;
    storage = storageDescription(db.kind);
    const [row] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM orders');
    orderCount = row.n;
  } catch (e) {
    storage = (e as Error).message;
  }
  const pinSet = Boolean(process.env.DEMO_RESET_PIN);
  const resetAvailable = demo && kind !== null && (pinSet || kind === 'pglite');

  return (
    <>
      <PageHeader eyebrow="Demonstration" title="Demo Settings" description="Controls for presenting the concept. None of these exist in a production system." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-marine" aria-hidden /> Demo role
              </CardTitle>
              <CardDescription>Switch between the two fictional users without a password.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <RoleSwitch role={role} compact />
            <ul className="space-y-1.5 text-sm text-muted">
              <li>
                <span className="font-semibold text-ink">Employee:</span> {DEMO_EMPLOYEE.name}, clock no. {DEMO_EMPLOYEE.clockNumber},{' '}
                {DEMO_EMPLOYEE.department}, {DEMO_EMPLOYEE.productionLine}
              </li>
              <li>
                <span className="font-semibold text-ink">Operator:</span> {DEMO_OPERATOR.name}, {DEMO_OPERATOR.role}
              </li>
            </ul>
            <p className="rounded-lg bg-warn-50 px-3.5 py-2.5 text-sm text-ink">
              This switch is a demonstration convenience, not sign-in. With <code className="font-semibold">DEMO_MODE=false</code> it is
              disabled and operator functions refuse access until enterprise authentication is added.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-5 text-marine" aria-hidden /> Data
              </CardTitle>
              <CardDescription>Orders are stored on the server, so every connected device sees the same data.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-muted">Storage</dt>
                <dd className="text-ink" data-testid="storage">{storage}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="font-semibold text-muted">Orders stored</dt>
                  <dd className="text-ink tabular" data-testid="order-count">{orderCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Server time (UK)</dt>
                  <dd className="text-ink tabular">{formatUkDateTime(new Date())}</dd>
                </div>
              </div>
            </dl>
            <ResetDemo
              pinRequired={pinSet}
              available={resetAvailable}
              unavailableReason={
                !demo ? 'Reset is disabled outside demo mode.' : kind === 'postgres' && !pinSet ? 'Set DEMO_RESET_PIN on the server to enable reset for a hosted database.' : undefined
              }
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" id="about">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-marine" aria-hidden /> About this prototype
              </CardTitle>
              <CardDescription>Scope, data handling and what a real pilot would need.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 text-sm leading-relaxed text-ink md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-navy">What this is</h3>
              <p>
                An independent proof of concept created by an apprentice to support a conversation with IT. It is not approved
                for operational use and is not connected to any company system.
              </p>
              <h3 className="pt-2 font-semibold text-navy">Data</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>All names, clock numbers, production lines and orders are fictional.</li>
                <li>Clock-number format is a configurable placeholder, not a real company format.</li>
                <li>Times are stored in UTC and shown in UK time.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-navy">Safeguards already in the concept</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>All submissions are validated again on the server.</li>
                <li>Tracking links use random, unguessable tokens — not order numbers.</li>
                <li>Operator internal notes are never sent to the tracking page.</li>
                <li>Status changes follow fixed rules and are recorded in a history log.</li>
                <li>Duplicate submissions are prevented (idempotency key).</li>
              </ul>
              <h3 className="pt-2 font-semibold text-navy">Needed before any real pilot</h3>
              <p>
                Company sign-in (for example Microsoft Entra ID), role permissions, an IT-approved hosting environment, a data
                retention policy, audit requirements and a security review — or use of an existing company platform instead.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
