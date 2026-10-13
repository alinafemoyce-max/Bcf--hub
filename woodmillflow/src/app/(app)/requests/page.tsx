import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardPlus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { MyRequests } from '@/components/my-requests';
import { buttonVariants } from '@/components/ui/button';
import { getDemoRole } from '@/server/session';

export const metadata: Metadata = { title: 'My Requests' };
export const dynamic = 'force-dynamic';

export default async function MyRequestsPage() {
  const role = await getDemoRole();
  return (
    <>
      <PageHeader
        eyebrow="Employee Portal"
        title="My Requests"
        description="Requests submitted from this device, with their latest status from the woodmill."
        actions={
          <Link href="/request" className={buttonVariants()}>
            <ClipboardPlus aria-hidden /> New Request
          </Link>
        }
      />
      <MyRequests demoEmployee={role === 'employee'} />
    </>
  );
}
