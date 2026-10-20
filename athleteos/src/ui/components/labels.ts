import type { Equipment, LoadMode, Prescription, ProgressionType, WorkoutFocus } from '@/domain/types';

export const PROGRESSION_LABELS: Record<ProgressionType, string> = {
  double_progression: 'Strength (double progression)',
  bodyweight_reps: 'Bodyweight reps',
  timed_hold: 'Timed hold',
  mobility: 'Mobility',
  sprint: 'Sprint',
  jump: 'Jump / plyometric',
  agility: 'Agility drill',
  conditioning: 'Warm-up / cardio'
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bodyweight: 'Bodyweight',
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bench: 'Bench',
  bike: 'Bike',
  box: 'Box / step',
  band: 'Band',
  cones: 'Cones',
  field: 'Field / track'
};

export const LOAD_MODE_LABELS: Record<LoadMode, string> = {
  total: 'Total load',
  per_dumbbell: 'Per dumbbell',
  bodyweight: 'Bodyweight (+ added load)',
  none: 'No load'
};

export const FOCUS_LABELS: Record<WorkoutFocus, string> = {
  full_body: 'Full body',
  mobility: 'Mobility',
  upper: 'Upper body',
  lower: 'Lower body',
  speed: 'Speed & agility',
  recovery: 'Recovery',
  custom: 'Custom'
};

const fmtDur = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : s >= 60 ? `${Math.round((s / 60) * 10) / 10} min` : `${s} s`);

/** "3 × 10–12", "2 × 30 s each side", "5–8 min", "4 × 10 m" */
export function prescriptionText(p: Prescription): string {
  const side = p.perSide ? (p.durationSec ? ' each side' : ' per side') : '';
  if (p.durationSec && !p.repsMin && !p.repsMax) {
    const dur = p.durationMaxSec && p.durationMaxSec !== p.durationSec ? `${fmtDur(p.durationSec).replace(/ min$/, '')}–${fmtDur(p.durationMaxSec)}` : fmtDur(p.durationSec);
    return p.sets > 1 ? `${p.sets} × ${dur}${side}` : `${dur}${side}`;
  }
  if (p.distanceM) return `${p.sets} × ${p.distanceM} m${p.perSide ? ' each direction' : ''}`;
  if (p.repsMin || p.repsMax) {
    const lo = p.repsMin ?? p.repsMax;
    const hi = p.repsMax ?? p.repsMin;
    if (lo === 1 && hi === 1) return `${p.sets} reps`;
    return `${p.sets} × ${lo === hi ? lo : `${lo}–${hi}`}${side}`;
  }
  return `${p.sets} set${p.sets === 1 ? '' : 's'}`;
}
