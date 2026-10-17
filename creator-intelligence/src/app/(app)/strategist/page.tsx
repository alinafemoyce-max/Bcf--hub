import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardTitle, Notice, PageTitle } from '@/components/ui';
import { isAiConfigured } from '@/lib/ai/config';
import { requirePageAuth } from '@/lib/auth/server';
import { loadLibrary } from '@/lib/data';
import { getDb } from '@/lib/db';

export const metadata = { title: 'AI Strategist' };

export default async function StrategistPage() {
  await requirePageAuth();
  const { videos, snapshots, accountSnapshots } = await loadLibrary(await getDb());
  const categorised = videos.filter((v) => v.category).length;
  const withHooks = videos.filter((v) => v.hook).length;
  const detailed = new Set(snapshots.filter((s) => s.completeness === 'detailed').map((s) => s.video_id)).size;
  const checks = [
    { ok: isAiConfigured(), label: 'Claude API key configured', hint: 'The strategist needs ANTHROPIC_API_KEY (pay-as-you-go; the cheap Haiku model is the default)' },
    { ok: videos.length >= 10, label: `At least 10 videos in your library (${videos.length})`, hint: 'Import your post list screenshots' },
    { ok: categorised >= Math.min(10, videos.length) && categorised > 0, label: `Videos have categories (${categorised}/${videos.length})`, hint: 'Edit videos to add category, topic and hook' },
    { ok: withHooks >= 5, label: `Hooks recorded (${withHooks})`, hint: 'Hooks let the strategist compare openings' },
    { ok: detailed >= 3, label: `Detailed analytics for some videos (${detailed})`, hint: 'Upload single-video analytics screenshots' },
    { ok: accountSnapshots.length >= 2, label: `Follower snapshots (${accountSnapshots.length})`, hint: 'Record followers regularly to measure growth' }
  ];
  return (
    <>
      <PageTitle title="AI Strategist" sub="Ask questions about your real data. Coming in Phase 2." />
      <Notice tone="accent" className="mb-4">
        The strategist is being built next. It will read your saved videos, snapshots and experiments through secure server-side queries, and separate observed
        evidence, possible explanations, recommended actions and how to test them. It will say when there is not enough data.
      </Notice>
      <Card>
        <CardTitle sub="The better this data, the more useful the analysis will be.">Getting your data ready</CardTitle>
        <ul className="space-y-3">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-2.5">
              {c.ok ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-good" /> : <Circle size={19} className="mt-0.5 shrink-0 text-ink-3" />}
              <div>
                <div className="text-[14px]">{c.label}</div>
                {!c.ok && <div className="text-[12.5px] text-ink-3">{c.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
