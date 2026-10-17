import { Card } from './ui';

export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <Card className="mt-6">
      <h1 className="text-lg font-semibold">Finish setting up the app</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">These environment variables are missing in your hosting settings:</p>
      <ul className="mt-3 space-y-1.5">
        {missing.map((m) => (
          <li key={m} className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink">
            {m}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-3">Add them (see “Deploy” in the README), then redeploy. No data has been lost.</p>
    </Card>
  );
}
