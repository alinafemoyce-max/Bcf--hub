import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { OperatorDashboard } from '@/components/operator/dashboard';
import { OperatorRoleGate } from '@/components/role-gate';
import { getDemoRole, isDemoMode } from '@/server/session';
import { DEMO_OPERATOR } from '@/lib/config';

export const metadata: Metadata = { title: 'Woodmill Work Queue' };
export const dynamic = 'force-dynamic';

export default async function OperatorPage() {
  const role = await getDemoRole();
  if (role !== 'operator') return <OperatorRoleGate demoMode={isDemoMode()} />;
  return (
    <>
      <PageHeader
        eyebrow="Woodmill Operator"
        title="Work Queue"
        description={`Incoming cutting requests for the woodmill. Signed in (demo) as ${DEMO_OPERATOR.name}.`}
      />
      <Suspense>
        <OperatorDashboard />
      </Suspense>
    </>
  );
}
