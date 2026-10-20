import type { PersonalRecord, Units } from '@/domain/types';
import { formatWeight, formatNumber, loadModeLabel } from '@/lib/units';

export function prText(pr: PersonalRecord, units: Units): string {
  const mode = pr.loadMode === 'per_dumbbell' ? ` ${loadModeLabel(pr.loadMode)}` : '';
  switch (pr.kind) {
    case 'heaviest_weight':
      return `Heaviest: ${formatWeight(pr.value, units)}${mode} × ${pr.reps}`;
    case 'best_e1rm':
      return `Best est. 1RM: ${formatWeight(pr.value, units)}${mode} (${formatWeight(pr.weightKg, units)} × ${pr.reps})`;
    case 'most_reps_at_weight':
      return `Most reps at ${formatWeight(pr.weightKg, units)}${mode}: ${pr.value}`;
    case 'most_reps':
      return `Most reps in a set: ${pr.value}`;
    case 'longest_hold':
      return `Longest hold: ${pr.value} s`;
    case 'fastest_time':
      return `Fastest: ${formatNumber(pr.value, 2)} s${pr.distanceM ? ` over ${pr.distanceM} m` : ''}`;
    case 'longest_jump':
      return `Longest: ${formatNumber(pr.value, 2)} m`;
  }
}

export function PRLabel({ pr, units }: { pr: PersonalRecord; units: Units }) {
  return <>{prText(pr, units)}</>;
}
