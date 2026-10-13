import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckSquare, HelpCircle, LifeBuoy } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Presentation Guide' };

const STEPS: { time: string; title: string; device: string; doThis: string[]; say: string }[] = [
  {
    time: '0:00 – 0:30',
    title: 'Introduce the problem',
    device: 'Laptop — home page',
    doThis: ['Show the WoodmillFlow home page.'],
    say:
      'Cutting requests to the woodmill are currently made on paper forms. After talking to a woodmill operator, I wanted to explore whether a simple digital request could make requests more consistent and make job status easier to see. This is an independent concept using fictional data — I’d value your view on whether it is worth exploring.'
  },
  {
    time: '0:30 – 1:15',
    title: 'Show the employee experience',
    device: 'iPhone',
    doThis: [
      'Scan the QR code on the laptop screen (or poster) with the iPhone camera.',
      'Tap “Use demo profile (Alex Taylor)”.',
      'Item 1: Plywood → Birch plywood → 18 mm, 800 × 400, quantity 3.',
      'Tap “Add Another Item”. Item 2: MDF → Moisture-resistant MDF → 12 mm, 600 × 250, quantity 2.',
      'Tap “Review Request”, then “Submit Woodmill Request”.'
    ],
    say:
      'The employee scans a code in the workshop, fills in a structured form — each piece has its own material, dimensions and quantity — and gets an order reference immediately. The date and time are recorded automatically.'
  },
  {
    time: '1:15 – 2:00',
    title: 'Show the woodmill operator experience',
    device: 'Laptop — Work Queue',
    doThis: [
      'Switch to “Woodmill Operator” (top right). A “New request received” notice appears within a few seconds.',
      'Click the “New Requests” summary card to show only new orders.',
      'Open the new order: point out clock number, line, every item and its measurements.',
      'Click “Accept Request”, then “Start Cutting”, then “Mark Ready for Collection”.'
    ],
    say:
      'The operator sees every request in one queue, sorted by priority and age. Each status change is saved with a time and who made it, so there is a record of every job.'
  },
  {
    time: '2:00 – 2:30',
    title: 'Return to the employee',
    device: 'iPhone — tracking page',
    doThis: [
      'Tap “Track My Request” on the iPhone (or it is already open). The status shows Ready for Collection.',
      'Back on the laptop, click “Mark Collected” to close the job.'
    ],
    say: 'Instead of walking over or phoning to ask whether materials are ready, the employee can check the status on their phone.'
  },
  {
    time: '2:30 – 3:00',
    title: 'Discuss feasibility',
    device: 'Conversation',
    doThis: ['Return to the home page or close the laptop lid.'],
    say:
      'This is only a concept — it is not approved and not connected to any company systems. I would really value your view on whether something like this is worthwhile, and whether an existing platform we already use, such as Power Apps, SharePoint or our manufacturing software, could do this better than custom software. If it is worth exploring, could a small authorised pilot be an option?'
  }
];

const QUESTIONS = [
  'Do we already have a system that could handle woodmill requests?',
  'Would Microsoft Power Apps, Power Automate, SharePoint or Microsoft Lists be the right place for this?',
  'What would IT need to see before a small pilot could be considered?',
  'How do people on the shop floor usually get access to digital tools?',
  'Who else should I speak to — for example the woodmill supervisor or production management?'
];

const CHECKLIST = [
  'Laptop charged; iPhone charged; phone screen auto-lock set to “Never” for the demo.',
  'App running and the home page opens on both laptop and iPhone.',
  'QR code scanned once on the iPhone to confirm it opens the request form.',
  'Demo data reset (Demo Settings → Reset demo data) so the queue starts from the ten sample orders.',
  'Laptop browser on the Work Queue in the Woodmill Operator role, ready to switch to.',
  'Notifications silenced on both devices.'
];

export default function GuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Demonstration"
        title="Three-Minute Presentation Guide"
        description="A suggested running order for the IT discussion. Keep the language neutral: these are ideas to test, not proven savings."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card>
                <CardContent className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-marine">Step {i + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-muted tabular">{s.time}</p>
                    <p className="mt-1 text-xs text-subtle">{s.device}</p>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-navy">{s.title}</h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink">
                      {s.doThis.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    <blockquote className="mt-3 border-l-4 border-accent bg-marine-50/60 px-4 py-2.5 text-[15px] italic text-ink">
                      “{s.say}”
                    </blockquote>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="size-5 text-marine" aria-hidden /> Before you start
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-ink">
                {CHECKLIST.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-marine" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm">
                <Link href="/demo" className="font-semibold text-marine hover:underline">
                  Open Demo Settings →
                </Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="size-5 text-marine" aria-hidden /> Questions to ask
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-ink">
                {QUESTIONS.map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-marine" aria-hidden />
                    {q}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="size-5 text-marine" aria-hidden /> If the phone cannot connect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-ink">
              <p>Run the whole demonstration on the laptop instead:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Submit the request in the Employee role.</li>
                <li>Switch to Woodmill Operator and process it.</li>
                <li>Open “My Requests” to show the employee’s updated status.</li>
              </ol>
              <p className="text-muted">The workflow and stored data are identical; only the second device is missing.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
