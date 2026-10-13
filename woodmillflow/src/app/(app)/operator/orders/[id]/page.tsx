import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OrderDetail } from '@/components/operator/order-detail';
import { OperatorRoleGate } from '@/components/role-gate';
import { getDemoRole, isDemoMode } from '@/server/session';

export const metadata: Metadata = { title: 'Order Details' };
export const dynamic = 'force-dynamic';

export default async function OperatorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await getDemoRole();
  if (role !== 'operator') return <OperatorRoleGate demoMode={isDemoMode()} />;
  const { id } = await params;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/operator" className="mb-4 inline-flex h-11 items-center gap-2 text-sm font-semibold text-marine">
        <ArrowLeft className="size-4" aria-hidden /> Back to work queue
      </Link>
      <OrderDetail orderId={id} />
    </div>
  );
}
