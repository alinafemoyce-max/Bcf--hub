import { AppShell } from '@/components/app-shell';
import { getDemoRole } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getDemoRole();
  return <AppShell role={role}>{children}</AppShell>;
}
