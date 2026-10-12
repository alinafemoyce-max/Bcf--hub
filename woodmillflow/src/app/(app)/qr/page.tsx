import type { Metadata } from 'next';
import { AlertTriangle, Smartphone, Wifi } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrActions, QrImage } from '@/components/qr';
import { resolvePublicUrl, withAccessKey } from '@/server/public-url';

export const metadata: Metadata = { title: 'QR Code & Poster' };
export const dynamic = 'force-dynamic';

export default async function QrPage() {
  const info = await resolvePublicUrl();
  const orderUrl = withAccessKey(`${info.baseUrl}/request`);
  return (
    <>
      <PageHeader
        eyebrow="Demonstration"
        title="QR Code & Poster"
        description="Scanning this code opens the employee request form. In a workshop it would be displayed on a poster near the work area."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardContent className="space-y-5">
            <div className="mx-auto w-fit rounded-2xl border border-line bg-white p-4">
              <QrImage value={orderUrl} size={280} />
            </div>
            <div className="rounded-lg bg-surface px-3.5 py-3">
              <p className="text-xs font-semibold text-muted">Ordering link</p>
              <p className="mt-0.5 break-all font-medium text-ink" data-testid="order-url">
                {orderUrl}
              </p>
            </div>
            <QrActions url={orderUrl} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          {info.warning && (
            <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn-50 p-4 text-sm text-ink">
              <AlertTriangle className="size-5 shrink-0 text-warn" aria-hidden />
              <p>{info.warning}</p>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-5 text-marine" aria-hidden /> Test it with an iPhone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-[15px] text-ink marker:font-semibold marker:text-marine">
                <li>Open the iPhone Camera app and point it at the code.</li>
                <li>Tap the yellow link banner that appears.</li>
                <li>Safari opens the WoodmillFlow request form.</li>
              </ol>
              <p className="mt-4 text-sm text-muted">
                Address source:{' '}
                <span className="font-medium text-ink">
                  {info.source === 'configured' && 'configured public address (APP_URL)'}
                  {info.source === 'current' && 'the address this page was opened with'}
                  {info.source === 'lan' && 'this computer’s local network address'}
                  {info.source === 'localhost' && 'localhost (phones cannot reach this)'}
                </span>
              </p>
            </CardContent>
          </Card>
          {(info.source === 'lan' || info.source === 'current') && info.lanAddresses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="size-5 text-marine" aria-hidden /> Laptop-hosted demonstration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-ink">
                <p>The phone must be on the same network as this computer. A reliable option is the iPhone’s Personal Hotspot:</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>On the iPhone: Settings → Personal Hotspot → Allow Others to Join.</li>
                  <li>Connect the laptop to the iPhone’s hotspot Wi-Fi.</li>
                  <li>Reload this page and scan the code again.</li>
                </ol>
                <p className="text-muted">
                  Network addresses found: <span className="font-medium text-ink tabular">{info.lanAddresses.join(', ')}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
