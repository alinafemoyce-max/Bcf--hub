import type { Exercise, LoadMode, SetLog, Units } from '@/domain/types';
import { formatNumber, formatWeight, loadModeLabel } from '@/lib/units';

/** Compact text for a list of sets, e.g. "30 kg × 12, 11, 10" or "1.82 s, 1.85 s". */
export function formatSets(sets: SetLog[], exercise: Exercise | undefined, loadMode: LoadMode, units: Units, opts: { onlyCompleted?: boolean } = {}): string {
  const list = opts.onlyCompleted === false ? sets : sets.filter((s) => s.completed);
  if (!list.length) return 'No sets completed';
  const type = exercise?.progressionType;
  switch (type) {
    case 'double_progression': {
      const weights = new Set(list.map((s) => s.weightKg ?? 0));
      const mode = loadMode === 'per_dumbbell' ? ` ${loadModeLabel(loadMode)}` : '';
      if (weights.size === 1) {
        const w = list[0].weightKg ?? 0;
        return `${w > 0 ? formatWeight(w, units) : 'Bodyweight'}${w > 0 ? mode : ''} × ${list.map((s) => s.reps ?? 0).join(', ')}`;
      }
      return list.map((s) => `${formatWeight(s.weightKg ?? 0, units, { unit: false })}×${s.reps ?? 0}`).join(', ') + ` ${units}${mode}`;
    }
    case 'bodyweight_reps':
      return `${list.map((s) => s.reps ?? 0).join(', ')} reps`;
    case 'timed_hold':
      return list.map((s) => `${s.durationSec ?? 0} s`).join(', ');
    case 'sprint':
    case 'agility': {
      const times = list.filter((s) => s.timeSec);
      return times.length ? times.map((s) => `${formatNumber(s.timeSec!, 2)} s`).join(', ') : `${list.length} rep${list.length === 1 ? '' : 's'} (not timed)`;
    }
    case 'jump': {
      const d = list.filter((s) => s.distanceM);
      return d.length ? d.map((s) => `${formatNumber(s.distanceM!, 2)} m`).join(', ') : `${list.length} set${list.length === 1 ? '' : 's'}`;
    }
    case 'mobility': {
      const roms = list.map((s) => s.rom).filter((x): x is number => x != null);
      const base = list[0].durationSec ? list.map((s) => `${s.durationSec} s`).join(', ') : `${list.map((s) => s.reps ?? 0).join(', ')} reps`;
      return roms.length ? `${base} · range ${formatNumber(roms.reduce((a, b) => a + b, 0) / roms.length, 1)}/5` : base;
    }
    case 'conditioning':
    default: {
      const mins = list.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60;
      return mins > 0 ? `${formatNumber(mins, 1)} min` : 'Done';
    }
  }
}
