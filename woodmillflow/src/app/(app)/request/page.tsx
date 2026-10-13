import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { RequestForm } from '@/components/request/request-form';
import { DatabaseUnavailable } from '@/components/db-error';
import { getDb } from '@/server/db';
import { getReferenceData } from '@/server/orders';

export const metadata: Metadata = { title: 'New Woodmill Request' };
export const dynamic = 'force-dynamic';

export default async function RequestPage() {
  let reference;
  try {
    reference = await getReferenceData(await getDb());
  } catch (e) {
    return <DatabaseUnavailable message={(e as Error).message} />;
  }
  return (
    <>
      <PageHeader
        eyebrow="Employee Portal"
        title="New Woodmill Request"
        description="Request timber or sheet material cut to size. Add as many items as you need."
      />
      <RequestForm reference={reference} />
    </>
  );
}
