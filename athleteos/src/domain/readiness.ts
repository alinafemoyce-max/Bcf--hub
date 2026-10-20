import type { RecoveryCheck } from './types';

// Readiness guidance from the pre-workout check-in. This is a simple, transparent rule set based on
// what the athlete reports. It does not diagnose anything or measure biological readiness.

export type ReadinessLevel = 'green' | 'amber' | 'red' | 'unknown';

export interface ReadinessAssessment {
  level: ReadinessLevel;
  headline: string;
  message: string;
  /** The specific inputs that drove the assessment. */
  reasons: string[];
  /** Practical adjustments for today. */
  suggestions: string[];
  /** Whether the overload engine may recommend load/volume increases today. */
  allowIncrease: boolean;
  overridden: boolean;
}

export type ReadinessInput = Pick<RecoveryCheck, 'sleepHours' | 'energy' | 'soreness' | 'motivation' | 'pain' | 'illness' | 'overridden' | 'painNotes'>;

const has = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function assessReadiness(check: Partial<ReadinessInput> | null | undefined): ReadinessAssessment {
  const c = check ?? {};
  const overridden = !!c.overridden;
  const pain = c.pain ?? 'none';
  const anyAnswer = has(c.sleepHours) || has(c.energy) || has(c.soreness) || has(c.motivation) || pain !== 'none' || !!c.illness;

  if (!anyAnswer) {
    return {
      level: 'unknown',
      headline: 'No check-in recorded',
      message: 'Recommendations are based on your training history only. A quick check-in helps tailor today’s session.',
      reasons: [],
      suggestions: [],
      allowIncrease: true,
      overridden
    };
  }

  // Safety first: illness or sharp pain always means "don't push", whatever else was reported.
  if (c.illness || pain === 'sharp') {
    const reasons: string[] = [];
    if (c.illness) reasons.push('You reported feeling unwell.');
    if (pain === 'sharp') reasons.push(`You reported sharp pain${c.painNotes ? ` (${c.painNotes.trim()})` : ''}.`);
    return {
      level: 'red',
      headline: 'Rest or keep it very light today',
      message:
        'Don’t train through sharp pain or illness. Skip anything that causes pain and consider resting today. ' +
        'If pain is severe, persists or gets worse, speak to a doctor or physiotherapist. AthleteOS cannot assess injuries.',
      reasons,
      suggestions: ['Skip exercises that cause pain.', 'Do not increase any loads today.', 'Gentle mobility or a walk only if it feels completely comfortable.'],
      allowIncrease: false,
      overridden
    };
  }

  const reasons: string[] = [];
  let flags = 0;
  if (has(c.sleepHours) && c.sleepHours < 6) {
    flags++;
    reasons.push(`Short sleep (${c.sleepHours} h).`);
  }
  if (has(c.energy) && c.energy <= 2) {
    flags++;
    reasons.push(`Low energy (${c.energy}/5).`);
  }
  if (has(c.soreness) && c.soreness >= 4) {
    flags++;
    reasons.push(`High muscle soreness (${c.soreness}/5).`);
  }
  if (has(c.motivation) && c.motivation <= 2) {
    flags++;
    reasons.push(`Low motivation (${c.motivation}/5).`);
  }
  if (pain === 'moderate') {
    flags += 2;
    reasons.push(`Moderate pain${c.painNotes ? ` (${c.painNotes.trim()})` : ''}.`);
  }
  const severe = (has(c.soreness) && c.soreness >= 5) || (has(c.energy) && c.energy <= 1);

  if (flags >= 2 || severe) {
    return {
      level: 'amber',
      headline: 'Consider a lighter session today',
      message: overridden
        ? 'You chose to train as normal. Keep technique strict and stop any exercise that causes pain.'
        : 'Your reported recovery markers are elevated. Keep loads the same as last time rather than increasing, and reduce volume if needed.',
      reasons,
      suggestions: [
        'Repeat last session’s loads — no increases today.',
        'Drop one set from accessory exercises if you feel flat.',
        'Keep sprints and jumps short and high quality; stop when they slow down.',
        ...(pain === 'moderate' ? ['Skip or modify any exercise that aggravates the pain.'] : [])
      ],
      allowIncrease: overridden,
      overridden
    };
  }

  const notes: string[] = [];
  if (pain === 'mild') notes.push('Stop any exercise that makes the discomfort worse.');
  return {
    level: 'green',
    headline: flags === 1 ? 'Good to train — keep an eye on one marker' : 'Good to train',
    message:
      flags === 1
        ? 'One marker is a little off. Train as planned, but stick to the recommended increments and listen to your body.'
        : 'Your check-in looks good. Train as planned.',
    reasons: pain === 'mild' ? [...reasons, `Mild discomfort${c.painNotes ? ` (${c.painNotes.trim()})` : ''}.`] : reasons,
    suggestions: notes,
    allowIncrease: true,
    overridden
  };
}
