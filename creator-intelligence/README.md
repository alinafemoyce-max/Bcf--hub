# AJM Creator Intelligence

A private, mobile-first web app for tracking TikTok performance and making evidence-based content decisions. Built for an automotive creator: first-car advice, used-car picks, reviews, hot takes, ownership stories and POV driving.

**Status: Phase 1 (functional foundation) is complete.** The AI Strategist, idea generator and idea checker are Phase 2. See the [roadmap](#roadmap).

---

## What works now (Phase 1)

| Area | What it does |
| --- | --- |
| **Sign-in** | Single-owner password sign-in. Signed, httpOnly session cookie (30 days). Failed attempts are rate-limited. Every page and API route checks the session. |
| **Home** | Dashboard with 7D / 30D / 90D / All / Custom ranges. Shows video totals, median and average views, views gained (from dated snapshots), engagement rate, followers and growth, a performance trend chart, best and lowest performers, performance by category, follower chart and TikTok-reported account totals. Has an empty state that walks you through setup. |
| **Videos** | Searchable library. Filter by category, format, hook style, record type, publish date, performance quartile, duration and tracking status. Sort by date, views or engagement. Highlights topics you have covered more than once. |
| **Video detail** | Latest metrics, 24h / 72h / 7d / 30d checkpoints, views over time, full snapshot history (nothing is overwritten), traffic sources, content details, related videos, archive / stop tracking, delete. |
| **Manual entry** | Add or edit videos with every field in the brief (hook, format, on camera, voiceover, own car, hashtags, and more). Add dated metric snapshots by hand. You can type values as TikTok shows them, e.g. `12.3K`. |
| **Import** | Upload many screenshots at once from your photo library. Three kinds: **post list** (many videos per screenshot → historical basic records), **single video analytics** (detailed snapshot), **account overview** (followers and period totals). Choose who reads them: **Claude** (most accurate, tiny cost) or the **free on-phone reader** (no cost, text recognition runs on your iPhone, less accurate). You review and correct every value before anything is saved. |
| **Duplicate handling** | Same file uploaded twice → detected by hash. Same screen saved as a different file → flagged by content fingerprint. A video that appears in several screenshots → matched (TikTok ID when visible, otherwise title + date similarity, with truncated titles handled) and stored as a new dated snapshot instead of a new video. Uncertain matches require your choice. |
| **Update queue** | “Screenshots to collect” on Home: which tracked videos are due a 24h / 72h / 7d / 30d screenshot. It stops after 30 days, and archived videos are skipped. |
| **Account** | Follower snapshots (manual or from screenshots). Account-level data is stored separately from video data. |
| **Ideas** | Manual idea backlog with statuses New → Planned → Filmed → Edited → Published → Evaluated / Rejected. You can link a published idea to its video and record why an idea was rejected. |
| **Settings** | Configuration status, AI usage, keep/delete screenshot images, delete stored images, JSON export, delete all data, sign out. |

### Data integrity rules the app follows

- **Nothing is invented.** If a value isn’t visible it stays blank. If the AI call fails, you see the error and can type the values yourself. No made-up analysis is shown.
- **Rounded figures are flagged.** `12.3K` is stored as 12,300 and marked approximate (shown as ≈).
- **Account vs video analytics are separate.** Dashboard totals are labelled as *lifetime views of videos published in the period* (as of their latest snapshots). *Views gained* is calculated only from dated snapshots on either side of the period, and the dashboard says how many videos it could include.
- **Engagement rate** = (likes + comments + shares) ÷ views, from the same snapshot. Only videos with all four values are included, and the overall figure is weighted by views. Saves are excluded because they are often missing.
- **Provenance.** Every screenshot-based snapshot records which screenshot it came from and when the numbers were captured (from the file’s metadata, or what you entered). Deleting an import deletes the snapshots it created.
- **Screenshot privacy.** By default the image is deleted as soon as you confirm the import. Only the hash, the extracted text and the provenance are kept.

---

## Deploy it (from your iPhone, about 15 minutes)

You need **GitHub** (you have it) and **Vercel** (hosting + database, free plan). An **Anthropic** account is optional: it only powers the Claude screenshot reader. Everything below works in Safari.

### Running it for free

Vercel’s Hobby plan and Neon’s free database plan cost nothing for a personal app like this. Without an Anthropic key, the app still works fully: use the **free on-phone reader** for screenshots, or type numbers in. The only paid part is Claude, and only if you choose to use it.

| Screenshot reader | Cost | Accuracy |
| --- | --- | --- |
| Free on-phone reader (Tesseract) | £0 | Reads text well, but can’t tell which number is which, so you check and fix more |
| Claude, `claude-haiku-5-5` (default) | well under 1p per screenshot | Good; understands the layout |
| Claude, `claude-sonnet-5-5` | about 3p per screenshot | Better on dense or unusual screens |
| Claude, `claude-opus-5-5` | about 3–8p per screenshot | Most careful |

Claude costs are approximate. Settings shows how many AI requests you’ve made, and there is a daily limit (default 150). A Claude.ai subscription does not include API usage; the API is billed separately.

### 1. (Optional) Get an Anthropic API key

1. Go to <https://console.anthropic.com>, sign up, and add a small amount of credit (Billing).
2. **API keys → Create key**. Copy it (it starts with `sk-ant-`). You’ll paste it into Vercel in step 2.

### 2. Create the Vercel project

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. Import the **Bcf--hub** repository (grant Vercel access to it if asked).
3. On the configure screen, set **Root Directory** to `creator-intelligence`. The framework is detected as Next.js automatically.
4. Open **Environment Variables** and add:
   - `APP_PASSWORD`: the password you’ll sign in with. Make it long.
   - `ANTHROPIC_API_KEY`: the key from step 1 (skip it to use only the free reader).
5. Click **Deploy**. The first deployment will show a **“Finish setting up”** screen because there is no database yet. This is expected.

### 3. Add the database

1. In the Vercel project, open **Storage → Create Database → Neon (Serverless Postgres)** and follow the prompts (the free plan is enough). Connect it to this project for all environments.
2. This adds `DATABASE_URL` automatically.
3. Go to **Deployments**, open the latest one, and choose **⋯ → Redeploy**.

The app creates its tables automatically on first use.

> Prefer Supabase? Create a project, then go to **Connect → Transaction pooler** and copy the URI (port 6543, with your database password filled in). Paste it as `DATABASE_URL` in Vercel.

### 4. Use it

1. Open the deployment URL (e.g. `https://ajm-creator-intelligence.vercel.app`) and sign in.
2. In Safari, tap **Share → Add to Home Screen**.
3. Start on Home: import your post-list screenshots, record your follower count, and add new uploads as you post.

**Which branch deploys?** Vercel’s production URL follows the repository’s default branch (`main`). Until this work is merged into `main`, Vercel builds it as a *preview* deployment. Preview URLs require you to be signed in to Vercel, so merge to `main` (or change the production branch in **Settings → Git**) to get a clean production URL.

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | Yes | Sign-in password. Changing it signs out every device. |
| `DATABASE_URL` | Yes (production) | Postgres connection string. Neon sets it automatically. |
| `ANTHROPIC_API_KEY` | For Claude | Enables the Claude screenshot reader. Without it, use the free on-phone reader or manual entry. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-haiku-5-5` (cheapest). Use `claude-sonnet-5-5` or `claude-opus-5-5` for more careful reading. |
| `AI_DAILY_LIMIT` | No | Maximum AI requests in 24 hours (default 150). |
| `SESSION_SECRET` | No | Explicit session signing key (16+ characters). |

Secrets are only read on the server. None of them is sent to the browser.

---

## How it works

```
iPhone Safari / Home Screen app
        │  HTTPS, session cookie
        ▼
Next.js 16 on Vercel ── proxy.ts (auth gate + CSRF origin check)
  ├─ Server components: pages read the database directly
  ├─ Route handlers /api/*: validated writes (zod), uploads, export
  └─ /api/screenshots/[id]/extract ──► Claude API (vision, structured output)
        │
        ▼
Postgres (Neon or Supabase)
  videos · video_snapshots · account_snapshots · screenshots · ideas · app_settings · ai_usage · login_attempts
```

- **Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Recharts, `postgres` driver, Anthropic TypeScript SDK, zod.
- **Screenshot pipeline:** the browser hashes the original file (SHA-256), reads its capture date from metadata where available, resizes it, and uploads it. With the **free reader**, Tesseract (self-hosted under `/ocr`, about 7 MB downloaded once) recognises the text on the phone and `src/lib/ocr-parse.ts` turns the lines into entries, flagging every value for checking. The server validates the real file type from its bytes, stores the image temporarily, and asks Claude to **transcribe the visible text only** into a strict JSON schema. Numbers and dates are converted by deterministic, tested code (`src/lib/parse.ts`), not by the model. You then review and confirm, and the save runs in one database transaction.
- **AI safeguards:** server-side calls only, per-minute and per-day limits, usage logged in `ai_usage`, typed error handling, and server-side model fallback if a request is declined (on models that support it; Haiku doesn’t).
- **Future TikTok API:** videos have `tiktok_video_id` and a `source` field. Snapshots and account snapshots accept `source = 'tiktok_api'`, so an authorised integration can write into the same tables later.

### Project layout

```
creator-intelligence/
├── src/
│   ├── proxy.ts                 auth gate for every page and API route
│   ├── app/(app)/               Home, Videos, Import, Strategist, Ideas, Account, Settings
│   ├── app/api/                 route handlers (auth, videos, snapshots, screenshots, ideas, export…)
│   ├── components/              UI primitives, charts, forms, import review
│   └── lib/
│       ├── db/                  driver wrapper (Postgres / embedded PGlite) and migrations
│       ├── repo/                data access: videos, screenshots (import transaction), account, ideas, settings
│       ├── extraction/          Claude vision call, output schema, service
│       ├── parse.ts             “12.3K”, “3d ago”, “0:45”, UK dates → values
│       ├── matching.ts          duplicate / same-video matching
│       ├── metrics.ts           dashboard calculations
│       ├── checkpoints.ts       24h/72h/7d/30d checkpoints and update queue
│       ├── ocr-parse.ts         free on-phone reader: text lines → entries
│       ├── review.ts            transcription ↔ editable review entries ↔ confirm payload
│       └── library.ts           search, filters, repeated topics
├── tests/                       Vitest unit + database integration tests
└── scripts/e2e.mjs              end-to-end test in Chromium at iPhone size
```

---

## Development

```bash
cd creator-intelligence
npm install
cp .env.example .env.local      # set APP_PASSWORD (ANTHROPIC_API_KEY optional)
npm run dev                     # http://localhost:3000, uses an embedded database in ./.data
```

Without `DATABASE_URL`, development uses **PGlite** (Postgres compiled to WebAssembly), so no database server is needed.

### Tests

```bash
npm test                                                        # unit + integration tests (embedded Postgres)
TEST_DATABASE_URL=postgres://user:pass@host/db npm test         # same tests against a real Postgres server
npm run build && npm run e2e                                    # end-to-end in Chromium at iPhone size
```

The tests cover metric and date parsing, duplicate matching, dashboard maths (including views gained and engagement edge cases), checkpoints and the update queue, auth tokens, the full screenshot import transaction (create, match, duplicate snapshot skipping, conflicts, rollback, deletion), and AI extraction with a mocked client (success, refusal, API errors, malformed output, limits). The end-to-end script runs the real production server and the real Anthropic SDK against a local stand-in for the API, so no key is needed and no AI cost is incurred. GitHub Actions runs the unit and integration tests on every push that touches this folder (`.github/workflows/creator-intelligence.yml`).

---

## Roadmap

**Phase 2: AI intelligence**
- AI Strategist chat with server-side tools that query your real videos, snapshots and experiments. Answers separate observed evidence, possible explanations, recommended actions and how to test them.
- Content classification (category, topic, hook style, format), stored separately from what you confirm.
- Repetition analysis: exact repeat vs new hook vs new format vs deliberate follow-up vs new concept.
- Pre-upload idea checker and idea generator, linked to the Ideas backlog.

**Phase 3: Advanced strategy**
- Experiment tracking with hypotheses, success metrics and confidence levels.
- Stored weekly AI reviews.
- Richer charts and historical import improvements.
- Transcript and video-file analysis where practical.

## Known limitations

- TikTok isn’t connected, so the app only knows what you import. Reminders in the update queue come from publish times, not live view changes.
- Post-list screenshots usually show views only. Engagement needs single-video analytics screenshots or manual entry.
- AI screenshot reading can make mistakes, which is why every value is reviewed before saving. Thumbnail crops are approximate, and you can switch off any wrong crop.
- Single user by design: whoever knows `APP_PASSWORD` can see the data, so keep it private and strong.
