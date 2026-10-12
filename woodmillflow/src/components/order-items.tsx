import { FileText, Layers } from 'lucide-react';
import { CUTTING_LABELS, GRAIN_LABELS, MATERIAL_CATEGORY_LABELS } from '@/lib/domain';
import type { OrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';

function Dim({ label, value, unit = 'mm', strong }: { label: string; value: number | null; unit?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn('tabular text-ink', strong ? 'text-xl font-bold text-navy' : 'text-lg font-semibold')}>
        {value === null ? <span className="text-base font-medium text-subtle">n/a</span> : value}
        {value !== null && unit && <span className="ml-0.5 text-sm font-medium text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

/** Structured cutting specification, readable at a glance on a phone or a laptop. */
export function ItemSpecTable({ items, compact }: { items: OrderItem[]; compact?: boolean }) {
  return (
    <ol className="space-y-3" data-testid="item-specs">
      {items.map((item) => {
        const cutting = item.cuttingRequirements
          .map((c) => (c === 'other' && item.cuttingOther ? `Other: ${item.cuttingOther}` : CUTTING_LABELS[c]))
          .join(', ');
        return (
          <li key={item.id} className="rounded-lg border border-line bg-white" data-testid="item-spec">
            <div className="flex items-start justify-between gap-3 border-b border-line bg-surface/60 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded bg-navy text-xs font-bold text-white">{item.position}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{item.materialDescription}</p>
                  <p className="text-xs text-muted">{MATERIAL_CATEGORY_LABELS[item.materialCategory]}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Qty</p>
                <p className="text-xl font-bold leading-none text-navy tabular">{item.quantity}</p>
              </div>
            </div>
            <div className="space-y-3 px-4 py-3">
              <dl className="grid grid-cols-3 gap-3">
                <Dim label="Length" value={item.lengthMm} strong />
                <Dim label="Width" value={item.widthMm} strong />
                <Dim label="Thickness" value={item.thicknessMm} strong />
              </dl>
              <dl className={cn('grid gap-x-4 gap-y-2 text-sm', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">Cutting:</dt>
                  <dd className="font-medium">{cutting}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">Grain:</dt>
                  <dd className="font-medium">{item.grainDirection ? GRAIN_LABELS[item.grainDirection] : 'Not specified'}</dd>
                </div>
                {item.drawingReference && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-muted">
                      <FileText className="inline size-4" aria-hidden /> Drawing:
                    </dt>
                    <dd className="font-medium tabular">{item.drawingReference}</dd>
                  </div>
                )}
              </dl>
              {item.notes && (
                <p className="rounded-md bg-warn-50/70 px-3 py-2 text-sm text-ink">
                  <span className="font-semibold">Specification: </span>
                  {item.notes}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One-line summaries for queue cards, e.g. "3 × Birch plywood — 800 × 400 × 18 mm". */
export function ItemLines({ items, max = 2 }: { items: OrderItem[]; max?: number }) {
  return (
    <ul className="space-y-1 text-sm">
      {items.slice(0, max).map((i) => (
        <li key={i.id} className="flex min-w-0 items-baseline gap-2">
          <Layers className="size-3.5 shrink-0 translate-y-0.5 text-subtle" aria-hidden />
          <span className="min-w-0 truncate">
            <span className="font-semibold tabular">{i.quantity} ×</span> {i.materialDescription}
            <span className="text-muted tabular">
              {' '}
              — {i.lengthMm} × {i.widthMm}
              {i.thicknessMm !== null ? ` × ${i.thicknessMm}` : ''} mm
            </span>
          </span>
        </li>
      ))}
      {items.length > max && <li className="pl-5.5 text-xs font-medium text-muted">+ {items.length - max} more item{items.length - max > 1 ? 's' : ''}</li>}
    </ul>
  );
}
