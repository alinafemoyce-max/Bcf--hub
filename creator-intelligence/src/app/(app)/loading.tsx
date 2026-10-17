export default function Loading() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="h-56 rounded-[var(--radius-card)] bg-surface" />
    </div>
  );
}
