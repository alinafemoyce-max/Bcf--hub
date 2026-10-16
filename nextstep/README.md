# NextStep — Your future starts here

A mobile-first, UK-focused career discovery and progression web app. People answer six optional questions (or an interests questionnaire if they're unsure) and get realistic upward, sideways and cross-industry pathways, career details, interactive career maps, comparisons and tickable action plans.

> **Status: prototype.** Suggestions are illustrative. NextStep is not professional careers guidance.

Once published it lives at **https://alinafemoyce-max.github.io/Bcf--hub/nextstep/** (served from the same GitHub Pages site as BCF Hub).

## What's in it

| Area | What it does |
| --- | --- |
| **Onboarding** | Six skippable questions: status, current job/course/apprenticeship (matched to a career as you type), industry, qualifications (each marked *completed* or *studying now* — never assumed), experience, interests. |
| **My paths** | Upward progression, sideways moves and cross-industry options, plus self-employment and further-education routes. Falls back to industry starting points or interests when a role can't be matched. |
| **Career pages** | What the role involves, why it might suit you, transferable skills and skills to develop, requirements, qualifications and entry routes (with a rough check against your qualifications), illustrative steps from your current role, NCS progression, pay and hours. |
| **Career map** | A tap-to-explore map around your current role (step up / move across / other industries), re-centre on any role, return to your starting position, and up to three alternative routes plus a training route to any goal. |
| **Compare** | Two careers side by side. |
| **Action plans** | This month, skills, qualifications to research, experience, people to speak to, milestones. Tick items off; share, copy or print/save as PDF. |
| **Interests questionnaire** | Eight questions for undecided users, suggesting career areas. Clearly labelled as not a validated test. |
| **Saved / More** | Shortlist, plans in progress, share the app link, Home Screen install, privacy explanation, reset. |

### Information labels

- **Checked source** (green) — from a National Careers Service job profile or a regulator's website, checked on 16 October 2026.
- **Typical route** (blue) — common ways in; requirements vary.
- **Suggestion / Illustrative** (amber) — NextStep's own rule-based ideas. Never guaranteed promotions, salaries or vacancies.

## Data

- `src/data/ncs.json` — 141 job profiles from the **National Careers Service**, fetched by `scripts/fetch_ncs.py` and used under the **Open Government Licence v3.0**. The app never calls NCS at runtime.
- `src/data/catalog.ts` — NextStep's curation: sector, level, interest tags, search keywords and progression links (informed by each NCS "career path and progression" section).
- `src/data/sources.ts` — hand-checked legal/regulatory requirements (NMC, HCPC, FCA, QTS, Driver CPC, …) with source links, plus official GOV.UK links.

To refresh the career data: `pip install beautifulsoup4 && npm run refresh-data`. Add a career by adding its NCS slug to `src/data/slugs.json` and an entry to `catalog.ts`, then refresh. The unit tests check the two stay in step.

## Privacy

No accounts, analytics, cookies or third-party requests (strict Content Security Policy). Everything is stored in the browser's `localStorage` on that device only and does not sync. Shared links contain only a career id; the share sheet always previews exactly what will be sent. Stored data is validated on load, so corrupted data can't break the app.

## How suggestions work

A transparent rule-based engine (`src/lib/engine.ts`) — no AI service. It matches typed job titles to careers, walks a graph of progression and related-career links, compares NCS skill lists, and weights results by the user's interests and questionnaire answers. Live AI would need a paid API and a server to keep the key secret, so it isn't included.

## Development

Node 20+.

```bash
cd nextstep
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: dataset integrity, matching, pathways, routes, qualifications, plans, privacy, storage
npm run build      # production build in dist/
npx vite preview --port 4174 &
npm run e2e -- ./e2e-shots   # end-to-end checks at iPhone SE size (set CHROMIUM_PATH if needed)
```

Tech: React 18, TypeScript, Vite, `vite-plugin-pwa` (installable, works offline), system fonts only, hash routing (works on any static host).

## Deployment

`.github/workflows/deploy.yml` (repo root) tests and builds BCF Hub and NextStep on every push to `main`, and publishes NextStep into the `nextstep/` folder of the GitHub Pages site.
