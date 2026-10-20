// AthleteOS data model.
//
// Every stored record carries a string id, ISO timestamps and an optional soft-delete marker, so the
// same shapes can later be mirrored to a cloud database (e.g. Supabase) with last-write-wins sync.
// All loads are stored in kilograms; the UI converts to pounds for display when the user prefers.

export type ID = string;
export type ISODate = string; // YYYY-MM-DD (local calendar date)
export type ISODateTime = string; // full ISO timestamp

export interface BaseRecord {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Soft-delete tombstone, kept so a future sync can propagate deletions. */
  deletedAt?: ISODateTime | null;
}

export type Units = 'kg' | 'lb';
export type Experience = 'beginner' | 'returning' | 'intermediate' | 'advanced';

/** 1 = Monday … 7 = Sunday (ISO weekday). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MuscleGroup =
  | 'chest'
  | 'lats'
  | 'upper_back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'hip_flexors'
  | 'adductors'
  | 'spine'
  | 'ankles'
  | 'cardio';

export type Equipment =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bench'
  | 'bike'
  | 'box'
  | 'band'
  | 'cones'
  | 'field';

/**
 * How an exercise progresses. The overload engine dispatches on this:
 * - double_progression: loaded strength work — add reps within a range, then add load.
 * - bodyweight_reps:    add reps, then a harder variation.
 * - timed_hold:         add seconds (planks, holds).
 * - mobility:           track comfortable range of motion and control; never "load" it.
 * - sprint:             track times, distance and rest; quality over volume.
 * - jump:               track distance and landing quality; low reps, full recovery.
 * - agility:            timed change-of-direction drills.
 * - conditioning:       warm-ups, cool-downs and easy cardio — completion only.
 */
export type ProgressionType =
  | 'double_progression'
  | 'bodyweight_reps'
  | 'timed_hold'
  | 'mobility'
  | 'sprint'
  | 'jump'
  | 'agility'
  | 'conditioning';

export type BodyRegion = 'upper' | 'lower' | 'core' | 'full';

/** How the logged weight should be read. */
export type LoadMode = 'total' | 'per_dumbbell' | 'bodyweight' | 'none';

export interface Exercise extends BaseRecord {
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  instructions: string[];
  commonMistakes: string[];
  /** Recommended rest between sets, seconds. */
  restSeconds: number;
  progressionType: ProgressionType;
  bodyRegion: BodyRegion;
  /** Default way the weight is logged for this exercise. */
  defaultLoadMode: LoadMode;
  /** Instructional link (opens in a new tab). */
  demoUrl?: string;
  /** Overrides the profile's increment for this exercise, kg. */
  incrementKg?: number | null;
  /** Whether an estimated one-rep max is meaningful (compound lifts in low/moderate rep ranges). */
  e1rmSuitable: boolean;
  /** Unilateral work prescribed "per leg / per side". */
  unilateral: boolean;
  isCustom: boolean;
  /** Built-in exercises have a stable key so the library can be updated by migrations. */
  builtinKey?: string;
}

/** The target for one exercise inside a workout. */
export interface Prescription {
  sets: number;
  repsMin?: number | null;
  repsMax?: number | null;
  /** Target duration per set, seconds (holds, stretches, warm-ups). */
  durationSec?: number | null;
  /** Upper bound for a duration range (e.g. warm-up 5–8 minutes). */
  durationMaxSec?: number | null;
  distanceM?: number | null;
  /** Reps/time are per side or per leg. */
  perSide?: boolean;
  restSeconds?: number | null;
  optional?: boolean;
  note?: string;
}

export interface TemplateExercise {
  id: ID;
  exerciseId: ID;
  prescription: Prescription;
}

export type WorkoutFocus = 'full_body' | 'mobility' | 'upper' | 'lower' | 'speed' | 'recovery' | 'custom';

export interface WorkoutTemplate extends BaseRecord {
  name: string;
  focus: WorkoutFocus;
  /** Scheduled weekday, or null for an unscheduled workout. */
  dayOfWeek: Weekday | null;
  exercises: TemplateExercise[];
  description?: string;
}

export type TechniqueQuality = 'good' | 'ok' | 'poor';

/** One logged set. Fields used depend on the exercise's progression type. */
export interface SetLog {
  id: ID;
  /** Load in kg as entered (read according to the session exercise's loadMode). */
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  /** Sprint / shuttle time, seconds. */
  timeSec?: number | null;
  /** Rest actually taken before this set, seconds. */
  restSec?: number | null;
  /** Reps in reserve (0 = failure). */
  rir?: number | null;
  /** Technique quality; for jumps this is landing quality. */
  technique?: TechniqueQuality | null;
  /** Mobility: comfortable range of motion, 1 (very limited) – 5 (full, easy). */
  rom?: number | null;
  /** Mobility: control through the range, 1–5. */
  control?: number | null;
  completed: boolean;
  completedAt?: ISODateTime | null;
}

export interface SessionExercise {
  id: ID;
  exerciseId: ID;
  /** Snapshot of the target at the time of the session (templates may change later). */
  prescription: Prescription;
  loadMode: LoadMode;
  sets: SetLog[];
  notes?: string;
  skipped?: boolean;
  /** Recommendation shown when the session started, kept for the record. */
  recommendationText?: string;
}

export type SessionStatus = 'in_progress' | 'completed';

export interface WorkoutSession extends BaseRecord {
  templateId?: ID | null;
  name: string;
  focus: WorkoutFocus;
  date: ISODate;
  startedAt: ISODateTime;
  endedAt?: ISODateTime | null;
  /** Duration override for manually entered sessions, minutes. */
  durationMin?: number | null;
  status: SessionStatus;
  source: 'live' | 'manual';
  exercises: SessionExercise[];
  notes?: string;
  recoveryCheckId?: ID | null;
  /** Rest timer end, so a running timer survives an app reload. */
  restEndsAt?: ISODateTime | null;
  /** Incremented on every edit after completion. */
  revision: number;
}

/** Snapshot of a session before an edit, so historical changes are auditable and reversible. */
export interface SessionRevision {
  id: ID;
  sessionId: ID;
  revision: number;
  savedAt: ISODateTime;
  snapshot: WorkoutSession;
}

export type PainLevel = 'none' | 'mild' | 'moderate' | 'sharp';

export interface RecoveryCheck extends BaseRecord {
  date: ISODate;
  sessionId?: ID | null;
  sleepHours?: number | null;
  /** 1 (very low) – 5 (very high). */
  energy?: number | null;
  /** 1 (none) – 5 (very sore). */
  soreness?: number | null;
  /** 1 (very low) – 5 (very high). */
  motivation?: number | null;
  pain: PainLevel;
  painNotes?: string;
  illness: boolean;
  /** The user chose to train normally despite a caution. */
  overridden: boolean;
}

export interface BodyMeasurement extends BaseRecord {
  date: ISODate;
  weightKg: number;
  notes?: string;
}

export type PRKind = 'heaviest_weight' | 'best_e1rm' | 'most_reps_at_weight' | 'fastest_time' | 'longest_jump' | 'longest_hold' | 'most_reps';

/** Derived (never hand-entered) personal record. Recomputed from history, so edits can't corrupt it. */
export interface PersonalRecord {
  exerciseId: ID;
  kind: PRKind;
  value: number;
  /** Supporting context, e.g. the load for a rep PR or the distance for a sprint. */
  weightKg?: number | null;
  reps?: number | null;
  distanceM?: number | null;
  loadMode: LoadMode;
  sessionId: ID;
  date: ISODate;
}

export interface IncrementSettings {
  /** Machines, cables and barbells for upper-body lifts. */
  upperKg: number;
  /** Machines, cables and barbells for lower-body lifts. */
  lowerKg: number;
  /** Smallest jump between dumbbells/kettlebells in your gym (per dumbbell). */
  dumbbellKg: number;
}

export interface UserProfile extends BaseRecord {
  name?: string;
  bodyWeightKg?: number | null;
  experience: Experience;
  equipment: Equipment[];
  injuries?: string;
  units: Units;
  trainingDays: Weekday[];
  positions?: string;
  increments: IncrementSettings;
  /** Monday of week 1 of the programme. */
  programmeStartDate: ISODate;
  onboardedAt?: ISODateTime | null;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}
