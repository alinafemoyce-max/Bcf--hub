# AthleteOS

A mobile-first, offline training log and progressive overload coach for American football players, built around a preloaded Monday–Friday programme for a wide receiver / defensive back.

Once published, it lives at **https://alinafemoyce-max.github.io/Bcf--hub/athleteos/**. It's served from the same GitHub Pages site as BCF Hub.

> Recommendations are guidance, not guarantees. AthleteOS doesn't diagnose injuries or measure biological readiness.

## Features

| Area | What it does |
| --- | --- |
| **Onboarding** | Asks for body weight, units (kg/lb), experience, equipment, gym weight increments, injuries and training days. Then offers to record what you currently lift. |
| **Dashboard** | Shows today's workout with a large **Start Workout** button, the training week, workouts done this week, body weight, weekly volume, recovery status, injury reminder and in-app reminders. Also shows weekly consistency, exercises ready for overload (each with its reason), muscle groups trained in the last 7 days, personal records and the next workout. |
| **Train** | Holds the weekly programme. Every workout can be renamed, rescheduled, reordered (up/down), and have exercises edited (sets, reps, time, distance, rest, per side, optional), replaced, added or removed. You can also start an empty workout or reset to the default plan. |
| **Check-in** | Before each workout it asks about sleep, energy, soreness, motivation, pain (none/mild/moderate/sharp) and illness. A live assessment shows what it means. You can override a caution, but sharp pain or illness never leads to "push through" advice. Every question is optional. |
| **Live workout** | Each exercise shows its target, last comparable performance, today's recommendation with **why**, and technique tips with a demonstration link. Set rows have large ± steppers for weight and reps, plus RIR (0–4+), technique (Good/OK/Poor) and a complete tick. You can switch dumbbell weights between **per dumbbell** and **total**, add notes, and add, remove, skip, reorder or replace exercises. The rest timer survives a reload. Every change is saved to IndexedDB immediately. |
| **Progress** | Has 7D/30D/90D/All ranges. Charts cover weight lifted, reps achieved, estimated 1RM (suitable lifts only), per-exercise volume, mobility range/control, sprint and shuttle times, broad-jump distances, body weight, workout frequency, weekly volume, consistency and personal records. Every chart has a table view. |
| **History** | A month calendar and a search over workouts, exercises and notes. Each session shows date, duration, sets/reps/loads, notes, PRs set at the time, volume and the recovery check-in. You can edit or delete a session, and every edit keeps a restorable revision. You can also log past workouts manually. |
| **Exercise library** | 40+ exercises, each with muscles, equipment, technique steps, common mistakes, rest period, progression type and a demonstration link. It's searchable and filterable, and you can add custom exercises. |
| **Profile** | Body-weight log, units, training days, experience, equipment, increments, injuries, programme week, JSON backup export/import (merge or replace), CSV workout export, storage status and erase-all. |
| **Weekly review** | Shows sessions done versus planned, missed days, volume compared with the previous week, training time, PRs and recovery averages. |

## Architecture

```
athleteos/
├── src/
│   ├── domain/            Pure, framework-free logic (unit-tested)
│   │   ├── types.ts         Typed data model
│   │   ├── overload.ts      Progressive overload engine
│   │   ├── readiness.ts     Check-in → readiness guidance
│   │   ├── analytics.ts     Volume, PRs, e1RM, series, consistency, muscle recency
│   │   ├── reminders.ts     In-app reminders and weekly review
│   │   ├── session.ts       Creating/pre-filling/finishing workouts
│   │   └── validation.ts    Guards every write
│   ├── data/              Persistence boundary
│   │   ├── db.ts            Dexie (IndexedDB) schema + versioned migrations
│   │   ├── repository.ts    AthleteRepository interface + Dexie implementation
│   │   ├── backup.ts        JSON export/import (validated, versioned) and CSV export
│   │   └── seed.ts          Built-in exercise library and default programme
│   ├── ui/
│   │   ├── components/ui/   shadcn/ui components (Radix + Tailwind + cva)
│   │   ├── components/      App components (set rows, rest timer, charts, pickers…)
│   │   ├── hooks/           Live IndexedDB queries (dexie-react-hooks) and derived data
│   │   ├── pages/           One file per screen
│   │   └── router.tsx       Hash router (works on any static host and as a Home Screen app)
│   └── lib/               Dates, units, ids, file saving
├── tests/                 Vitest: engine, repository/persistence, analytics
└── scripts/e2e.mjs        End-to-end test in Chromium at iPhone SE size
```

**Stack:** React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui (Radix), Lucide icons, Recharts (lazy-loaded on the Progress screen), Dexie on IndexedDB and `vite-plugin-pwa`. It uses no paid APIs and makes no third-party requests, and production builds have a strict Content Security Policy.

**Ready for Supabase later.** Screens and training logic only talk to the `AthleteRepository` interface. Every record has a UUID, `createdAt`, `updatedAt` and a soft-delete `deletedAt` tombstone. Backup "merge" already uses the last-write-wins rule a sync would use. A `SupabaseRepository` (with row-level security on a `user_id` column) can implement the same interface, or wrap the local one as an offline cache.

### Data model (`src/domain/types.ts`)

- **Exercise**: muscles, equipment, instructions, mistakes, rest, `progressionType`, body region, default load mode, demo link, optional increment override, e1RM suitability.
- **WorkoutTemplate**: name, focus and weekday, plus ordered `TemplateExercise` items, each with a **Prescription** (sets, rep range, duration, distance, per side, rest, optional).
- **WorkoutSession**: date, start/end, status (`in_progress`/`completed`), source (`live`/`manual`), notes, check-in link, rest-timer end and `revision`. It contains **SessionExercise** items, each with a prescription snapshot, load mode, notes and skipped flag. Each of those holds **SetLog** records stored separately per set: weight (kg), reps, duration, distance, time, rest, RIR, technique, range of motion, control, completed and timestamp.
- **SessionRevision**: snapshot of a session before each edit.
- **RecoveryCheck**: sleep, energy, soreness, motivation, pain level and notes, illness and override.
- **BodyMeasurement**: date and weight.
- **UserProfile**: units, increments, training days, equipment, experience, injuries and programme start.
- **PersonalRecord**: always derived from history, never stored, so edits and deletions can't corrupt it.

All loads are stored in kilograms and converted for display. Per-dumbbell and total loads are never compared with each other, and each exercise is its own series, so variations are never compared directly.

**Migrations** (`src/data/db.ts`): v1 is the initial schema. v2 adds session revision history and the `revision` counter. v3 adds a status/date index and normalises recovery records. Backup files are versioned too, and older formats are upgraded on import.

## The progressive overload engine (`src/domain/overload.ts`)

The engine is deterministic: the same history always gives the same answer. It compares today's target with the **most recent comparable session**, meaning the same exercise and the same load mode, and only completed sets count. Every recommendation includes a headline, a **reason** and caveats.

**Strength (double progression):**
1. **No history:** gives a baseline. Pick a load you can lift for the rep range with 2–3 reps in reserve.
2. **Not every prescribed set completed** at the working load: maintain.
3. **Missed the minimum reps:**
   - A single small miss (for example, the final set 1–2 reps short): maintain. *"Maintain 12 kg for dumbbell biceps curls. Your final set dropped below the target rep range."*
   - A significant miss reduces the load by about 10%, rounded to your increment and at least one increment. A significant miss means 2+ sets short, any set 3+ reps short, the first set short, a second session in a row short, or a miss combined with poor technique.
4. **Technique rated poor** on any set: never increase, however many reps or how much volume.
5. **Top of the range on every set:**
   - If any set went to failure (0 RIR), repeat the load once more.
   - Otherwise increase by the **smallest practical increment**: dumbbells 2 kg per dumbbell, upper-body machines/cables/barbell 2.5 kg, lower body 5 kg. All of these are editable, and each exercise can override them. *"Increase lat pulldown from 30 kg to 32.5 kg next session. You completed all 3 sets at 12 reps with good technique and 2 reps in reserve."*
   - If RIR or technique wasn't logged, it still increases, with a caveat.
6. **Otherwise** stay at the load and add reps until the top of the range.
7. **Plateau:** 3 comparable sessions at the same load with no rep progress and never reaching the top. The engine flags it and suggests checking sleep, rest periods and weekly volume before changing the programme.

**Other progression types:**
- **Bodyweight:** add 2 reps per set; after target + 6, move to a harder variation.
- **Timed holds:** add 5 s up to 60 s, then a harder variation.
- **Mobility:** never loaded. Tracks comfortable range and control (1–5) and their trends.
- **Sprints and agility:** times, distance, rest (recorded automatically between ticks) and consistency.
  - If the slowest rep is more than 5% slower than the best, that's fatigue: no extra volume and no faster targets.
  - One extra rep is suggested only after two consistent sessions (within 3%) with full rest.
- **Jumps:** distance and landing quality. Poor landings or more than 7% distance drop-off mean quality focus. Volume never increases.
- **Check-in adjustments:**
  - Amber (elevated soreness/fatigue, short sleep, moderate pain) holds every increase unless you override it.
  - Red (sharp pain or illness) advises rest or very light work, even if you override it.

## Running locally

You need Node.js 20 or newer.

```bash
cd athleteos
npm install
npm run dev          # http://localhost:5173 (also on your local network via --host)
npm test             # 74 unit tests: engine, failed sets, plateaus, increments, missing recovery data,
                     # incomplete workouts, historical edits, persistence after reload, migrations, backups
npm run build        # production build in dist/
npx vite preview --port 4174 &
npm run e2e -- ./e2e-shots   # 14 end-to-end checks in Chromium at iPhone SE size (set CHROMIUM_PATH if needed)
```

## Installing on your iPhone

1. Open the app's web address in **Safari**. Use the GitHub Pages URL above once it's deployed. For a local test, run `npm run dev` and open `http://<your-computer's-IP>:5173` on the same Wi-Fi; Home Screen install and offline mode need the HTTPS deployed version.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. AthleteOS now opens full screen from its icon and works offline.

## Backing up your training data

Your data is stored **only on the device** in IndexedDB. There's no account or server.

- **Profile → Export backup (JSON)** saves everything: workouts with every set, edit history, check-ins, body weight, exercises, programme and settings. On iPhone the Share sheet opens, so choose **Save to Files** (e.g. iCloud Drive).
- **Profile → Import backup** restores a backup. **Merge** keeps the newest copy of each record; **Replace** wipes the device first. Backups are validated before anything is written.
- **Profile → Export workouts (CSV)** gives one row per set in your units, for spreadsheets.

Export a backup regularly. Safari can clear website data for sites you haven't opened for a long time, and adding the app to your Home Screen makes that much less likely.
