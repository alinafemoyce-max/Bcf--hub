import type {
  BodyRegion,
  Equipment,
  Exercise,
  LoadMode,
  MuscleGroup,
  Prescription,
  ProgressionType,
  TemplateExercise,
  Weekday,
  WorkoutFocus,
  WorkoutTemplate
} from '@/domain/types';
import { newId } from '@/lib/id';

/** A search link always resolves to current demonstration videos, unlike a single video that can be removed. */
export function demoSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise technique`)}`;
}

interface ExerciseSeed {
  key: string;
  name: string;
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  equipment: Equipment[];
  instructions: string[];
  mistakes: string[];
  rest: number;
  type: ProgressionType;
  region: BodyRegion;
  load: LoadMode;
  e1rm?: boolean;
  unilateral?: boolean;
}

export const EXERCISE_SEEDS: ExerciseSeed[] = [
  // ── Warm-ups, cardio and cool-downs ────────────────────────────────────────
  {
    key: 'stationary_bike',
    name: 'Stationary bike',
    primary: ['cardio'],
    secondary: ['quads'],
    equipment: ['bike'],
    instructions: ['Set the saddle so your knee is slightly bent at the bottom of the pedal stroke.', 'Ride at an easy, conversational pace.', 'Gradually raise cadence over the final minute.'],
    mistakes: ['Going too hard — this is a warm-up, not a workout.', 'Saddle too low, which strains the knees.'],
    rest: 0,
    type: 'conditioning',
    region: 'full',
    load: 'none'
  },
  {
    key: 'dynamic_warmup',
    name: 'Dynamic warm-up',
    primary: ['cardio'],
    secondary: ['hip_flexors', 'hamstrings', 'glutes'],
    equipment: ['bodyweight'],
    instructions: ['Light jog or skipping for 2 minutes.', 'Leg swings (front-to-back and side-to-side), walking knee hugs, lunges with a reach, inchworms.', 'Finish with 2–3 build-up jumps or pogo hops before plyometrics.'],
    mistakes: ['Holding long static stretches before explosive work.', 'Rushing through it.'],
    rest: 0,
    type: 'conditioning',
    region: 'full',
    load: 'none'
  },
  {
    key: 'running_warmup',
    name: 'Dynamic running warm-up',
    primary: ['cardio'],
    secondary: ['hip_flexors', 'hamstrings', 'calves'],
    equipment: ['field'],
    instructions: ['Easy jog, then A-skips, B-skips, high knees, butt kicks and carioca over 10–20 m.', 'Leg swings and walking hamstring sweeps.', 'Finish with 2–3 progressive build-ups to about 80% speed.'],
    mistakes: ['Sprinting at full speed before the build-ups.', 'Skipping the hamstring prep — the most common sprint injury site.'],
    rest: 0,
    type: 'conditioning',
    region: 'full',
    load: 'none'
  },
  {
    key: 'easy_walk',
    name: 'Easy walk',
    primary: ['cardio'],
    equipment: ['bodyweight'],
    instructions: ['Walk at a relaxed pace.', 'Breathe through the nose if you can — it should feel restorative.'],
    mistakes: ['Turning recovery into hard conditioning.'],
    rest: 0,
    type: 'conditioning',
    region: 'full',
    load: 'none'
  },
  {
    key: 'walking_cooldown',
    name: 'Walking cooldown',
    primary: ['cardio'],
    equipment: ['field'],
    instructions: ['Walk easily and let your breathing settle.', 'Add gentle calf and hip flexor stretches at the end if you like.'],
    mistakes: ['Skipping it straight after maximal sprints.'],
    rest: 0,
    type: 'conditioning',
    region: 'full',
    load: 'none'
  },

  // ── Lower body ─────────────────────────────────────────────────────────────
  {
    key: 'goblet_squat',
    name: 'Goblet squat',
    primary: ['quads', 'glutes'],
    secondary: ['adductors', 'core'],
    equipment: ['dumbbell', 'kettlebell'],
    instructions: ['Hold one dumbbell vertically at your chest, elbows under the weight.', 'Feet about shoulder-width, toes slightly out.', 'Sit down between your heels with a tall chest; knees track over toes.', 'Drive up through the whole foot.'],
    mistakes: ['Heels lifting off the floor.', 'Knees caving inward.', 'Chest collapsing forward at the bottom.'],
    rest: 120,
    type: 'double_progression',
    region: 'lower',
    load: 'total',
    e1rm: true
  },
  {
    key: 'walking_lunge',
    name: 'Walking lunges',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'adductors', 'core'],
    equipment: ['dumbbell', 'bodyweight'],
    instructions: ['Hold a dumbbell in each hand (or none to start).', 'Step forward and lower until both knees are about 90°.', 'Drive through the front heel and step through into the next rep.'],
    mistakes: ['Short steps that push the front knee far forward.', 'Back knee slamming the floor.', 'Torso leaning or twisting.'],
    rest: 90,
    type: 'double_progression',
    region: 'lower',
    load: 'per_dumbbell',
    unilateral: true
  },
  {
    key: 'standing_calf_raise',
    name: 'Standing calf raises',
    primary: ['calves'],
    secondary: ['ankles'],
    equipment: ['bodyweight', 'dumbbell', 'machine'],
    instructions: ['Stand on the edge of a step with heels hanging.', 'Lower slowly into a full stretch.', 'Rise as high as possible onto the big toe and pause for one second.'],
    mistakes: ['Bouncing out of the bottom.', 'Half range of motion.'],
    rest: 60,
    type: 'double_progression',
    region: 'lower',
    load: 'total'
  },
  {
    key: 'romanian_deadlift',
    name: 'Romanian deadlift',
    primary: ['hamstrings', 'glutes'],
    secondary: ['upper_back', 'forearms', 'core'],
    equipment: ['barbell', 'dumbbell'],
    instructions: ['Stand tall holding the weight in front of your thighs.', 'Soften the knees, then push the hips back while the weight slides down your legs.', 'Keep a neutral spine; stop when you feel a strong hamstring stretch (usually mid-shin).', 'Drive the hips forward to stand.'],
    mistakes: ['Rounding the lower back.', 'Turning it into a squat by bending the knees too much.', 'Letting the weight drift away from the legs.'],
    rest: 120,
    type: 'double_progression',
    region: 'lower',
    load: 'total',
    e1rm: true
  },
  {
    key: 'step_up',
    name: 'Step-ups',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    equipment: ['box', 'dumbbell'],
    instructions: ['Use a box roughly knee height.', 'Place the whole foot on the box and drive up through that leg.', 'Minimise push-off from the back foot; lower under control.'],
    mistakes: ['Pushing off the back leg.', 'Knee caving in on the working leg.'],
    rest: 90,
    type: 'double_progression',
    region: 'lower',
    load: 'per_dumbbell',
    unilateral: true
  },
  {
    key: 'hamstring_curl',
    name: 'Hamstring curls',
    primary: ['hamstrings'],
    secondary: ['calves'],
    equipment: ['machine'],
    instructions: ['Align your knee with the machine pivot.', 'Curl the pad towards your glutes, pause, and lower slowly over 2–3 seconds.'],
    mistakes: ['Hips lifting off the pad.', 'Dropping the weight on the way down.'],
    rest: 75,
    type: 'double_progression',
    region: 'lower',
    load: 'total'
  },
  {
    key: 'bulgarian_split_squat',
    name: 'Bulgarian split squat',
    primary: ['quads', 'glutes'],
    secondary: ['adductors', 'hamstrings'],
    equipment: ['dumbbell', 'bench'],
    instructions: ['Rear foot on a bench, front foot far enough forward that you can descend vertically.', 'Lower until the back knee nearly touches the floor.', 'Drive through the front foot.'],
    mistakes: ['Front foot too close to the bench.', 'Losing balance by rushing.'],
    rest: 90,
    type: 'double_progression',
    region: 'lower',
    load: 'per_dumbbell',
    unilateral: true
  },
  {
    key: 'hip_thrust',
    name: 'Hip thrust',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    equipment: ['barbell', 'bench'],
    instructions: ['Upper back on a bench, bar over the hips (use a pad).', 'Drive the hips up until the torso is parallel to the floor, chin tucked.', 'Squeeze the glutes for one second at the top.'],
    mistakes: ['Over-arching the lower back at the top.', 'Feet too far away so the hamstrings take over.'],
    rest: 120,
    type: 'double_progression',
    region: 'lower',
    load: 'total',
    e1rm: true
  },
  {
    key: 'leg_press',
    name: 'Leg press',
    primary: ['quads', 'glutes'],
    secondary: ['adductors'],
    equipment: ['machine'],
    instructions: ['Feet shoulder-width in the middle of the platform.', 'Lower until the knees are about 90° without the lower back peeling off the pad.', 'Press up without locking the knees hard.'],
    mistakes: ['Lower back rounding off the seat.', 'Bouncing at the bottom.'],
    rest: 120,
    type: 'double_progression',
    region: 'lower',
    load: 'total',
    e1rm: true
  },
  {
    key: 'nordic_curl',
    name: 'Nordic hamstring curl',
    primary: ['hamstrings'],
    equipment: ['bodyweight'],
    instructions: ['Kneel with ankles anchored.', 'Lower your body forward as slowly as you can, keeping hips extended.', 'Catch yourself with your hands and push back up.'],
    mistakes: ['Bending at the hips.', 'Doing too many too soon — expect strong soreness at first.'],
    rest: 120,
    type: 'bodyweight_reps',
    region: 'lower',
    load: 'bodyweight'
  },

  // ── Upper body ─────────────────────────────────────────────────────────────
  {
    key: 'db_bench_press',
    name: 'Dumbbell bench press',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    equipment: ['dumbbell', 'bench'],
    instructions: ['Lie on a flat bench, feet planted, shoulder blades pulled back and down.', 'Lower the dumbbells to the sides of your chest, elbows about 45° from the body.', 'Press up and slightly in.'],
    mistakes: ['Flaring elbows to 90°.', 'Bouncing the dumbbells off the chest.', 'Hips lifting off the bench.'],
    rest: 120,
    type: 'double_progression',
    region: 'upper',
    load: 'per_dumbbell',
    e1rm: true
  },
  {
    key: 'seated_cable_row',
    name: 'Seated cable row',
    primary: ['upper_back', 'lats'],
    secondary: ['biceps', 'forearms'],
    equipment: ['cable'],
    instructions: ['Sit tall with knees slightly bent.', 'Pull the handle to your lower ribs, squeezing the shoulder blades together.', 'Return slowly until the arms are straight and the shoulder blades protract.'],
    mistakes: ['Rocking the torso to swing the weight.', 'Shrugging the shoulders up.'],
    rest: 90,
    type: 'double_progression',
    region: 'upper',
    load: 'total',
    e1rm: true
  },
  {
    key: 'lat_pulldown',
    name: 'Lat pulldown',
    primary: ['lats'],
    secondary: ['biceps', 'upper_back'],
    equipment: ['cable'],
    instructions: ['Grip slightly wider than shoulders, thighs locked under the pad.', 'Lean back slightly and pull the bar to the top of your chest.', 'Control the bar back up until the arms are straight.'],
    mistakes: ['Pulling behind the neck.', 'Leaning far back and turning it into a row.', 'Letting the weight yank the arms up.'],
    rest: 90,
    type: 'double_progression',
    region: 'upper',
    load: 'total',
    e1rm: true
  },
  {
    key: 'db_shoulder_press',
    name: 'Dumbbell shoulder press',
    primary: ['shoulders'],
    secondary: ['triceps', 'upper_back'],
    equipment: ['dumbbell', 'bench'],
    instructions: ['Sit upright with the dumbbells at shoulder height, palms forward or slightly in.', 'Press overhead until the arms are straight, without arching the lower back.', 'Lower under control to ear level.'],
    mistakes: ['Excessive lower-back arch.', 'Cutting the range short.'],
    rest: 120,
    type: 'double_progression',
    region: 'upper',
    load: 'per_dumbbell',
    e1rm: true
  },
  {
    key: 'db_biceps_curl',
    name: 'Dumbbell biceps curls',
    primary: ['biceps'],
    secondary: ['forearms'],
    equipment: ['dumbbell'],
    instructions: ['Stand tall, elbows pinned to your sides.', 'Curl the dumbbells up while turning palms up.', 'Lower slowly to full extension.'],
    mistakes: ['Swinging the torso.', 'Elbows drifting forward.'],
    rest: 60,
    type: 'double_progression',
    region: 'upper',
    load: 'per_dumbbell'
  },
  {
    key: 'triceps_pushdown',
    name: 'Triceps cable pushdown',
    primary: ['triceps'],
    equipment: ['cable'],
    instructions: ['Stand close to the cable with elbows at your sides.', 'Push down until the arms are straight, pause, and return to about 90°.'],
    mistakes: ['Elbows moving forward and back.', 'Leaning over the weight.'],
    rest: 60,
    type: 'double_progression',
    region: 'upper',
    load: 'total'
  },
  {
    key: 'push_up',
    name: 'Push-up',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders', 'core'],
    equipment: ['bodyweight'],
    instructions: ['Hands slightly wider than shoulders, body in a straight line.', 'Lower until the chest is just above the floor.', 'Push up while keeping the hips in line.'],
    mistakes: ['Hips sagging.', 'Elbows flared to 90°.'],
    rest: 75,
    type: 'bodyweight_reps',
    region: 'upper',
    load: 'bodyweight'
  },
  {
    key: 'pull_up',
    name: 'Pull-up',
    primary: ['lats'],
    secondary: ['biceps', 'upper_back', 'core'],
    equipment: ['bodyweight'],
    instructions: ['Hang with straight arms, hands just outside shoulder width.', 'Pull until your chin clears the bar, leading with the chest.', 'Lower all the way under control.'],
    mistakes: ['Kipping or swinging.', 'Half reps.'],
    rest: 120,
    type: 'bodyweight_reps',
    region: 'upper',
    load: 'bodyweight'
  },
  {
    key: 'one_arm_db_row',
    name: 'One-arm dumbbell row',
    primary: ['lats', 'upper_back'],
    secondary: ['biceps'],
    equipment: ['dumbbell', 'bench'],
    instructions: ['One hand and knee on a bench, back flat.', 'Row the dumbbell towards your hip.', 'Lower to a full stretch.'],
    mistakes: ['Twisting the torso to lift.', 'Shrugging instead of rowing.'],
    rest: 90,
    type: 'double_progression',
    region: 'upper',
    load: 'per_dumbbell',
    unilateral: true
  },
  {
    key: 'incline_db_press',
    name: 'Incline dumbbell press',
    primary: ['chest', 'shoulders'],
    secondary: ['triceps'],
    equipment: ['dumbbell', 'bench'],
    instructions: ['Set the bench to 30–45°.', 'Lower the dumbbells to the upper chest.', 'Press up and slightly in.'],
    mistakes: ['Bench too steep, turning it into a shoulder press.'],
    rest: 120,
    type: 'double_progression',
    region: 'upper',
    load: 'per_dumbbell',
    e1rm: true
  },
  {
    key: 'face_pull',
    name: 'Face pull',
    primary: ['shoulders', 'upper_back'],
    equipment: ['cable'],
    instructions: ['Rope at face height.', 'Pull towards your forehead, elbows high, rotating the hands back.', 'Pause and return slowly.'],
    mistakes: ['Using too much weight and leaning back.'],
    rest: 60,
    type: 'double_progression',
    region: 'upper',
    load: 'total'
  },

  // ── Core ───────────────────────────────────────────────────────────────────
  {
    key: 'dead_bug',
    name: 'Dead bugs',
    primary: ['core'],
    secondary: ['hip_flexors'],
    equipment: ['bodyweight'],
    instructions: ['Lie on your back, arms up, hips and knees at 90°.', 'Press your lower back into the floor.', 'Slowly extend the opposite arm and leg, breathe out, and return.'],
    mistakes: ['Lower back arching off the floor.', 'Moving too fast.'],
    rest: 45,
    type: 'bodyweight_reps',
    region: 'core',
    load: 'bodyweight'
  },
  {
    key: 'side_plank',
    name: 'Side plank',
    primary: ['obliques', 'core'],
    secondary: ['shoulders', 'glutes'],
    equipment: ['bodyweight'],
    instructions: ['Elbow under shoulder, body in a straight line from head to feet.', 'Lift the hips and hold, breathing steadily.'],
    mistakes: ['Hips sagging or piking.', 'Shoulder shrugged into the ear.'],
    rest: 30,
    type: 'timed_hold',
    region: 'core',
    load: 'bodyweight'
  },
  {
    key: 'pallof_press',
    name: 'Pallof press',
    primary: ['core', 'obliques'],
    equipment: ['cable', 'band'],
    instructions: ['Stand side-on to a cable at chest height, feet shoulder-width.', 'Press the handle straight out from your chest and resist the rotation.', 'Pause for 2 seconds, then bring it back.'],
    mistakes: ['Letting the torso rotate.', 'Using a load you cannot control.'],
    rest: 45,
    type: 'double_progression',
    region: 'core',
    load: 'total'
  },
  {
    key: 'plank',
    name: 'Plank',
    primary: ['core'],
    secondary: ['shoulders'],
    equipment: ['bodyweight'],
    instructions: ['Forearms under shoulders, body straight.', 'Squeeze glutes and brace the stomach.'],
    mistakes: ['Hips sagging.'],
    rest: 45,
    type: 'timed_hold',
    region: 'core',
    load: 'bodyweight'
  },

  // ── Mobility ───────────────────────────────────────────────────────────────
  {
    key: 'cat_cow',
    name: 'Cat–Cow',
    primary: ['spine'],
    secondary: ['core'],
    equipment: ['bodyweight'],
    instructions: ['On hands and knees, hands under shoulders.', 'Slowly round the spine towards the ceiling, then let it sink while lifting the chest.', 'Move with your breath, one segment at a time.'],
    mistakes: ['Rushing.', 'Only moving at the neck or lower back.'],
    rest: 20,
    type: 'mobility',
    region: 'core',
    load: 'none'
  },
  {
    key: 'hip_90_90',
    name: '90/90 hip switches',
    primary: ['hip_flexors', 'glutes'],
    secondary: ['adductors'],
    equipment: ['bodyweight'],
    instructions: ['Sit with both knees bent at 90°, one leg in front and one to the side.', 'Rotate both knees to the other side without using your hands if you can.', 'Stay tall through the spine.'],
    mistakes: ['Forcing range with your hands.', 'Collapsing the chest.'],
    rest: 20,
    type: 'mobility',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'hip_flexor_stretch',
    name: 'Hip flexor stretch',
    primary: ['hip_flexors'],
    secondary: ['quads'],
    equipment: ['bodyweight'],
    instructions: ['Half-kneeling, back knee on a pad.', 'Squeeze the glute of the back leg and tuck the pelvis slightly.', 'Shift forward gently until you feel a stretch at the front of the hip.'],
    mistakes: ['Arching the lower back instead of tucking the pelvis.', 'Bouncing.'],
    rest: 15,
    type: 'mobility',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'worlds_greatest_stretch',
    name: 'World’s Greatest Stretch',
    primary: ['hip_flexors', 'spine'],
    secondary: ['hamstrings', 'glutes'],
    equipment: ['bodyweight'],
    instructions: ['Step into a long lunge, hands inside the front foot.', 'Drop the elbow towards the instep, then rotate and reach to the ceiling.', 'Return the hand, straighten the front leg for a hamstring stretch, and switch.'],
    mistakes: ['Short lunge with no hip stretch.', 'Rotating only the arm, not the upper back.'],
    rest: 20,
    type: 'mobility',
    region: 'full',
    load: 'none'
  },
  {
    key: 'ankle_mobility',
    name: 'Ankle mobility (knee-to-wall)',
    primary: ['ankles'],
    secondary: ['calves'],
    equipment: ['bodyweight'],
    instructions: ['Half-kneel facing a wall, front toes a few centimetres from it.', 'Drive the knee forward over the toes to touch the wall without the heel lifting.', 'Move the foot back as range improves.'],
    mistakes: ['Heel lifting.', 'Knee collapsing inward.'],
    rest: 15,
    type: 'mobility',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'couch_stretch',
    name: 'Couch stretch',
    primary: ['hip_flexors', 'quads'],
    equipment: ['bench'],
    instructions: ['Back knee in the corner of a wall or bench, shin up the surface.', 'Front foot planted, squeeze the back glute and stay tall.'],
    mistakes: ['Arching the lower back.'],
    rest: 15,
    type: 'mobility',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'thoracic_rotation',
    name: 'Open-book thoracic rotation',
    primary: ['spine'],
    secondary: ['shoulders'],
    equipment: ['bodyweight'],
    instructions: ['Lie on your side, knees bent to 90°, arms straight in front.', 'Open the top arm across your body, following it with your eyes.', 'Keep the knees together on the floor.'],
    mistakes: ['Knees lifting as you rotate.'],
    rest: 15,
    type: 'mobility',
    region: 'upper',
    load: 'none'
  },

  // ── Speed, agility and power ───────────────────────────────────────────────
  {
    key: 'broad_jump',
    name: 'Broad jumps',
    primary: ['glutes', 'quads'],
    secondary: ['hamstrings', 'calves'],
    equipment: ['bodyweight'],
    instructions: ['Feet hip-width, swing the arms back and load the hips.', 'Explode forward and up, extending hips, knees and ankles.', 'Land softly on both feet, knees over toes, and stick the landing for a second.', 'Reset fully between reps. Log your best distance for each set.'],
    mistakes: ['Landing stiff-legged or with knees caving.', 'Chaining reps without a reset.', 'Continuing when distance drops — that is fatigue, not training.'],
    rest: 90,
    type: 'jump',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'box_jump',
    name: 'Box jump',
    primary: ['glutes', 'quads'],
    secondary: ['calves'],
    equipment: ['box'],
    instructions: ['Stand close to a stable box.', 'Swing and jump, landing softly in a quarter squat.', 'Step down — don’t jump down.'],
    mistakes: ['Box too high, landing in a deep squat.'],
    rest: 90,
    type: 'jump',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'sprint_10m',
    name: 'Acceleration sprint — 10 m',
    primary: ['quads', 'glutes', 'hamstrings'],
    secondary: ['calves', 'hip_flexors'],
    equipment: ['field', 'cones'],
    instructions: ['Start from a two-point (receiver) stance.', 'Push hard into the ground with a forward lean; drive the arms.', 'Walk back and rest fully. Log the time if you’re timing it.'],
    mistakes: ['Standing up too early.', 'Short rest — every rep should be near-maximal quality.'],
    rest: 90,
    type: 'sprint',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'sprint_20m',
    name: 'Acceleration sprint — 20 m',
    primary: ['quads', 'glutes', 'hamstrings'],
    secondary: ['calves', 'hip_flexors'],
    equipment: ['field', 'cones'],
    instructions: ['Two-point stance.', 'Gradually rise from the forward lean over the first 10 m.', 'Rest fully between reps (about 2 minutes).'],
    mistakes: ['Overstriding.', 'Tensing the shoulders and face.'],
    rest: 120,
    type: 'sprint',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'lateral_shuffle',
    name: 'Lateral shuffles',
    primary: ['adductors', 'glutes'],
    secondary: ['quads', 'calves'],
    equipment: ['field', 'cones'],
    instructions: ['Athletic stance, hips low, chest up.', 'Push off the trailing leg without clicking the heels together.', 'Shuffle 10 m one way, then 10 m back facing the same direction.'],
    mistakes: ['Standing up tall.', 'Crossing the feet.'],
    rest: 60,
    type: 'agility',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'backpedal_to_sprint',
    name: 'Backpedal-to-sprint transition',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    equipment: ['field', 'cones'],
    instructions: ['Backpedal 5 m with hips low and weight over the balls of the feet.', 'On a cue (or cone), plant, open the hips and sprint forward 10 m.', 'Treat each rep as a full-quality effort.'],
    mistakes: ['Raising up during the backpedal.', 'Taking extra false steps on the transition.'],
    rest: 90,
    type: 'agility',
    region: 'lower',
    load: 'none'
  },
  {
    key: 'shuttle_5_10_5',
    name: '5–10–5 shuttle',
    primary: ['quads', 'glutes', 'adductors'],
    secondary: ['calves', 'hamstrings'],
    equipment: ['field', 'cones'],
    instructions: ['Three cones 5 m apart; start at the middle.', 'Sprint 5 m to one side and touch the line, 10 m to the far side and touch, then 5 m back through the middle.', 'Rest fully (2–3 minutes). Log the time if you have it.'],
    mistakes: ['Rounding the cuts instead of planting.', 'Not touching the line.'],
    rest: 150,
    type: 'agility',
    region: 'lower',
    load: 'none'
  }
];

export function buildExercise(seed: ExerciseSeed, now: string): Exercise {
  return {
    id: `bi_${seed.key}`,
    builtinKey: seed.key,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: seed.name,
    primaryMuscles: seed.primary,
    secondaryMuscles: seed.secondary ?? [],
    equipment: seed.equipment,
    instructions: seed.instructions,
    commonMistakes: seed.mistakes,
    restSeconds: seed.rest,
    progressionType: seed.type,
    bodyRegion: seed.region,
    defaultLoadMode: seed.load,
    demoUrl: demoSearchUrl(seed.name),
    incrementKg: null,
    e1rmSuitable: !!seed.e1rm,
    unilateral: !!seed.unilateral,
    isCustom: false
  };
}

export function builtinExercises(now: string): Exercise[] {
  return EXERCISE_SEEDS.map((s) => buildExercise(s, now));
}

export const exId = (key: string) => `bi_${key}`;

// ── Default weekly programme ────────────────────────────────────────────────

const reps = (sets: number, min: number, max = min, extra: Partial<Prescription> = {}): Prescription => ({ sets, repsMin: min, repsMax: max, ...extra });
const mins = (min: number, max = min, extra: Partial<Prescription> = {}): Prescription => ({
  sets: 1,
  durationSec: min * 60,
  durationMaxSec: max !== min ? max * 60 : null,
  ...extra
});
const secs = (sets: number, s: number, extra: Partial<Prescription> = {}): Prescription => ({ sets, durationSec: s, ...extra });

interface TemplateSeed {
  key: string;
  name: string;
  focus: WorkoutFocus;
  day: Weekday;
  description: string;
  items: [string, Prescription][];
}

export const PROGRAMME_SEEDS: TemplateSeed[] = [
  {
    key: 'mon',
    name: 'Full Body',
    focus: 'full_body',
    day: 1,
    description: 'Rebuild general strength across the whole body.',
    items: [
      ['stationary_bike', mins(5, 8)],
      ['goblet_squat', reps(3, 10)],
      ['walking_lunge', reps(3, 10, 10, { perSide: true })],
      ['standing_calf_raise', reps(3, 15)],
      ['db_bench_press', reps(3, 10, 12)],
      ['seated_cable_row', reps(3, 10, 12)],
      ['lat_pulldown', reps(3, 10, 12)]
    ]
  },
  {
    key: 'tue',
    name: 'Mobility',
    focus: 'mobility',
    day: 2,
    description: 'Restore hip, ankle and spine range of motion. Move comfortably — never force a stretch.',
    items: [
      ['cat_cow', reps(2, 10)],
      ['hip_90_90', reps(2, 10)],
      ['hip_flexor_stretch', secs(2, 30, { perSide: true })],
      ['worlds_greatest_stretch', reps(2, 5, 5, { perSide: true })],
      ['ankle_mobility', reps(2, 10, 10, { perSide: true })],
      ['dead_bug', reps(3, 10, 10, { perSide: true })],
      ['easy_walk', mins(10, 10, { optional: true })]
    ]
  },
  {
    key: 'wed',
    name: 'Upper Body',
    focus: 'upper',
    day: 3,
    description: 'Pressing and pulling strength for blocking, catching and contesting the ball.',
    items: [
      ['stationary_bike', mins(5)],
      ['db_bench_press', reps(3, 8, 12)],
      ['lat_pulldown', reps(3, 8, 12)],
      ['seated_cable_row', reps(3, 10, 12)],
      ['db_shoulder_press', reps(3, 8, 10)],
      ['db_biceps_curl', reps(3, 10, 12)],
      ['triceps_pushdown', reps(3, 10, 12)],
      ['side_plank', secs(2, 30, { perSide: true })]
    ]
  },
  {
    key: 'thu',
    name: 'Lower Body',
    focus: 'lower',
    day: 4,
    description: 'Explosive power first, then strength. Jumps are about quality, not fatigue.',
    items: [
      ['dynamic_warmup', mins(8)],
      ['broad_jump', reps(3, 3)],
      ['goblet_squat', reps(3, 8, 10)],
      ['romanian_deadlift', reps(3, 8, 10)],
      ['step_up', reps(3, 8, 8, { perSide: true })],
      ['hamstring_curl', reps(3, 10, 12)],
      ['standing_calf_raise', reps(3, 12, 15)],
      ['pallof_press', reps(2, 10, 10, { perSide: true })]
    ]
  },
  {
    key: 'fri',
    name: 'Speed & Agility',
    focus: 'speed',
    day: 5,
    description: 'Acceleration and change of direction for WR and DB play. Full rest between every rep.',
    items: [
      ['running_warmup', mins(8, 10)],
      ['sprint_10m', { sets: 4, distanceM: 10 }],
      ['sprint_20m', { sets: 3, distanceM: 20 }],
      ['lateral_shuffle', { sets: 3, distanceM: 10, perSide: true }],
      ['backpedal_to_sprint', { sets: 4, repsMin: 1, repsMax: 1 }],
      ['shuttle_5_10_5', { sets: 3, repsMin: 1, repsMax: 1 }],
      ['walking_cooldown', mins(5)]
    ]
  }
];

export function buildTemplate(seed: TemplateSeed, now: string): WorkoutTemplate {
  const exercises: TemplateExercise[] = seed.items.map(([key, prescription]) => ({ id: newId(), exerciseId: exId(key), prescription }));
  return {
    id: `tpl_${seed.key}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: seed.name,
    focus: seed.focus,
    dayOfWeek: seed.day,
    description: seed.description,
    exercises
  };
}

export function defaultProgramme(now: string): WorkoutTemplate[] {
  return PROGRAMME_SEEDS.map((s) => buildTemplate(s, now));
}
