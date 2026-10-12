import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand';
import { PrintButton, QrImage } from '@/components/qr';
import { resolvePublicUrl, withAccessKey } from '@/server/public-url';

export const metadata: Metadata = { title: 'Request Poster' };
export const dynamic = 'force-dynamic';

export default async function PosterPage() {
  const info = await resolvePublicUrl();
  const orderUrl = withAccessKey(`${info.baseUrl}/request`);
  return (
    <div className="min-h-dvh bg-surface py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4">
        <Link href="/qr" className="text-sm font-semibold text-marine">
          ← Back
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between bg-white px-[8%] py-[9%] text-center shadow-raised print:shadow-none">
        <Wordmark />
        <div>
          <h1 className="text-[clamp(28px,6.5vw,52px)] font-extrabold leading-[1.05] tracking-tight text-navy">
            WOODMILL MATERIAL
            <br />
            REQUESTS
          </h1>
          <p className="mt-4 text-[clamp(16px,3vw,24px)] font-medium text-ink">Scan the QR code to submit a cutting request.</p>
        </div>
        <div className="rounded-3xl border-4 border-navy p-4">
          <QrImage value={orderUrl} size={300} className="h-auto w-[min(300px,55vw)]" />
        </div>
        <div>
          <p className="text-[clamp(15px,2.6vw,21px)] italic text-marine">“Quick digital requests, straightforward order tracking.”</p>
          <p className="mt-3 break-all text-xs text-muted">{orderUrl}</p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted">
          Independent concept demonstration — fictional data. Not an official company system.
        </p>
      </article>
    </div>
  );
}
