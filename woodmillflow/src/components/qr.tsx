'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, ClipboardCopy, Download, ExternalLink, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from './ui/button';
import { copyText } from '@/lib/client';
import { cn } from '@/lib/utils';

const QR_OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 1, color: { dark: '#10243A', light: '#FFFFFF' } };

export function QrImage({ value, size = 240, className, label }: { value: string; size?: number; className?: string; label?: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { ...QR_OPTIONS, width: size * 2 }).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
  }, [value, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt={label ?? `QR code linking to ${value}`} className={cn('block', className)} data-testid="qr-image" data-qr-value={value} />
  ) : (
    <div style={{ width: size, height: size }} className={cn('animate-pulse rounded bg-surface', className)} aria-hidden />
  );
}

export function QrActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const download = async () => {
    const data = await QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1200, margin: 2 });
    const a = document.createElement('a');
    a.href = data;
    a.download = 'woodmillflow-request-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="secondary" size="lg" onClick={download}>
        <Download aria-hidden /> Download PNG
      </Button>
      <a href="/poster" target="_blank" rel="noopener" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
        <Printer aria-hidden /> Print poster
      </a>
      <Button
        variant="secondary"
        size="lg"
        onClick={async () => {
          if (await copyText(url)) {
            setCopied(true);
            toast.success('Ordering link copied');
            setTimeout(() => setCopied(false), 2000);
          } else toast.error('Copy is not available here — select the link instead.');
        }}
      >
        {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />} Copy link
      </Button>
      <a href={url} target="_blank" rel="noopener" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
        <ExternalLink aria-hidden /> Open link
      </a>
    </div>
  );
}

export function PrintButton() {
  return (
    <Button size="lg" onClick={() => window.print()} className="no-print">
      <Printer aria-hidden /> Print poster
    </Button>
  );
}
