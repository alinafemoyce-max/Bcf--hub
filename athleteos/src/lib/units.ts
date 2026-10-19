import type { LoadMode, Units } from '@/domain/types';

export const LB_PER_KG = 2.2046226218;

export function kgToDisplay(kg: number, units: Units): number {
  return units === 'kg' ? kg : kg * LB_PER_KG;
}

export function displayToKg(value: number, units: Units): number {
  return units === 'kg' ? value : value / LB_PER_KG;
}

/** Rounds to a sensible display precision (0.25 kg / 0.5 lb), trimming trailing zeros. */
export function roundForDisplay(value: number, units: Units): number {
  const step = units === 'kg' ? 0.25 : 0.5;
  return Math.round(value / step) * step;
}

export function formatNumber(n: number, maxDecimals = 2): string {
  return Number(n.toFixed(maxDecimals)).toString();
}

export function formatWeight(kg: number | null | undefined, units: Units, opts: { unit?: boolean } = {}): string {
  if (kg == null || Number.isNaN(kg)) return '—';
  const v = formatNumber(roundForDisplay(kgToDisplay(kg, units), units));
  return opts.unit === false ? v : `${v} ${units}`;
}

export function loadModeLabel(mode: LoadMode): string {
  switch (mode) {
    case 'per_dumbbell':
      return 'per dumbbell';
    case 'total':
      return 'total';
    case 'bodyweight':
      return 'bodyweight';
    default:
      return '';
  }
}

/** Large volumes (kg) shown compactly, e.g. 12 450 kg → "12.5 t". */
export function formatVolume(kg: number, units: Units): string {
  const v = kgToDisplay(kg, units);
  if (units === 'kg' && v >= 10_000) return `${formatNumber(v / 1000, 1)} t`;
  if (v >= 10_000) return `${formatNumber(v / 1000, 1)}k ${units}`;
  return `${Math.round(v).toLocaleString('en-GB')} ${units}`;
}
