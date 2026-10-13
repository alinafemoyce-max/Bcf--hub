import Link from 'next/link';
import { BookOpen, ClipboardList, Factory, PackageCheck, QrCode, ScanLine, Send, Settings2, ShieldCheck } from 'lucide-react';
import { DemoNotice, Wordmark } from '@/components/brand';
import { EnterRoleButton } from '@/components/enter-role';
import { QrImage } from '@/components/qr';
import { resolvePublicUrl, withAccessKey } from '@/server/public-url';

export const dynamic = 'force-dynamic';

const STEPS = [
  { icon: ScanLine, title: 'Scan', text: 'An employee scans the workshop QR code with their phone.' },
  { icon: Send, title: 'Request', text: 'They complete a structured cutting request and submit it.' },
  { icon: Factory, title: 'Process', text: 'The woodmill reviews, accepts and updates the job in one queue.' },
  { icon: PackageCheck, title: 'Collect', text: 'The employee sees when materials are ready and collects them.' }
];

export default async function LandingPage() {
  const info = await resolvePublicUrl();
  const orderUrl = withAccessKey(`${info.baseUrl}/request`);
  return (
    <div className="min-h-dvh bg-surface">
      {/* Hero */}
      <div className="bg-navy text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Wordmark inverted />
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link href="/guide" className="hidden rounded-lg px-3 py-2 text-white/75 hover:bg-white/5 hover:text-white sm:inline-flex">
              Presentation guide
            </Link>
            <Link href="/qr" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-white/75 hover:bg-white/5 hover:text-white">
              <QrCode className="size-4" aria-hidden /> QR code
            </Link>
          </nav>
        </header>
        <section className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pt-14">
          <DemoNotice inverted />
          <h1 className="mt-5 text-[40px] font-bold leading-[1.05] tracking-tight sm:text-6xl">WoodmillFlow</h1>
          <p className="mt-3 text-xl font-medium text-accent sm:text-2xl">A Simpler Way to Manage Woodmill Requests</p>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/75 sm:text-lg">
            An interactive concept exploring how digital ordering could improve material requests, work visibility and
            communication between production teams and the woodmill.
          </p>
        </section>
      </div>

      <main className="mx-auto -mt-20 max-w-6xl px-4 pb-14 sm:px-6">
        {/* Role cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <RoleCard
            icon={ClipboardList}
            eyebrow="For production employees"
            title="Employee Portal"
            text="Create and track woodmill cutting requests."
            action={<EnterRoleButton role="employee" label="Submit a Request" href="/request" testId="enter-employee" />}
            footer={`Demo identity: Alex Taylor · clock no. 123456 · Shed 2`}
          />
          <RoleCard
            icon={Factory}
            eyebrow="For the woodmill"
            title="Woodmill Operator"
            text="Manage incoming cutting jobs and update their progress."
            action={<EnterRoleButton role="operator" label="Open Work Queue" href="/operator" testId="enter-operator" />}
            footer="Demo identity: Sam Morgan · Woodmill Operator"
          />
        </div>

        {/* Workflow + QR */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7" aria-labelledby="how">
            <h2 id="how" className="text-lg font-semibold text-navy">
              The proposed workflow
            </h2>
            <p className="mt-1 text-sm text-muted">Replacing the paper request form with a shared digital work queue.</p>
            <ol className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-marine-50 text-marine">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-subtle">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-navy">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 rounded-lg bg-surface px-4 py-3 text-sm text-ink">
              Status path: <span className="font-semibold">Submitted → Accepted → In Progress → Ready for Collection → Collected</span>
            </p>
          </section>

          <section className="flex flex-col items-center rounded-2xl border border-line bg-white p-5 text-center shadow-card sm:p-7" aria-labelledby="qr">
            <h2 id="qr" className="text-lg font-semibold text-navy">
              Try it on your phone
            </h2>
            <p className="mt-1 text-sm text-muted">Scan to open the request form.</p>
            <div className="mt-4 rounded-xl border border-line p-3">
              <QrImage value={orderUrl} size={170} />
            </div>
            <Link href="/qr" className="mt-4 text-sm font-semibold text-marine hover:underline">
              Full-size QR code & poster
            </Link>
          </section>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <QuickLink href="/guide" icon={BookOpen} title="Presentation guide" text="Three-minute walkthrough" />
          <QuickLink href="/demo" icon={Settings2} title="Demo settings" text="Switch roles or reset data" />
          <QuickLink href="/demo#about" icon={ShieldCheck} title="About this prototype" text="Scope, data and security" />
        </div>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
          <p className="font-semibold text-ink">Independent concept demonstration — fictional data only.</p>
          <p className="mt-1">
            WoodmillFlow is a personal proof of concept. It is not an official or approved Sunseeker International system, is not
            connected to any company systems, and contains no real employee, production or order data.
          </p>
        </div>
      </footer>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  eyebrow,
  title,
  text,
  action,
  footer
}: {
  icon: typeof Factory;
  eyebrow: string;
  title: string;
  text: string;
  action: React.ReactNode;
  footer: string;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-raised sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-navy text-white">
          <Icon className="size-7" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-marine">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-navy">{title}</h2>
          <p className="mt-1.5 text-[15px] text-muted">{text}</p>
        </div>
      </div>
      <div className="mt-6">{action}</div>
      <p className="mt-3 text-center text-xs text-subtle">{footer}</p>
    </section>
  );
}

function QuickLink({ href, icon: Icon, title, text }: { href: string; icon: typeof Factory; title: string; text: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-card transition-colors hover:border-marine/40">
      <Icon className="size-5 text-marine" aria-hidden />
      <span>
        <span className="block text-sm font-semibold text-navy">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
    </Link>
  );
}
