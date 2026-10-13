import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: { default: 'WoodmillFlow — Digital Material Requests & Job Tracking', template: '%s · WoodmillFlow' },
  description:
    'Independent concept demonstration: digital woodmill cutting requests and job tracking. Fictional data only; not an official company system.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'WoodmillFlow', statusBarStyle: 'default' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#10243A'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
      </body>
    </html>
  );
}
