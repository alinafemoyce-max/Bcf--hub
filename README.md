# BCF Hub

A mobile-first Progressive Web App for an apprentice representative. Use it to track apprentice issues, prepare Pre-BCF and Business Communication Forum (BCF) meetings, record management responses, follow up on actions and draft updates for the apprentice Microsoft Teams channel.

> **Status: personal prototype.** BCF Hub is not an authorised, official or endorsed Sunseeker International system. Use the built-in fictional demo data until the approvals listed under [Before real workplace use](#before-real-workplace-use) are in place.

> **Other apps in this repository:** [`nextstep/`](nextstep/) (career exploration) and [`creator-intelligence/`](creator-intelligence/) (AJM Creator Intelligence, a TikTok analytics app deployed separately on Vercel; see its README).

---

## Features

| Area | What it does |
| --- | --- |
| **Home** | Shows counts of active issues, issues awaiting management, overdue follow-ups and resolved issues. Each card opens the matching list. Also shows the next BCF and Pre-BCF meetings, this week's priority actions, quick actions and recent activity. |
| **Issues** | Add, edit, search, filter, sort, archive, restore and delete issues. Each issue gets a unique ID (`BCF-0001`). Issues are fully validated. Follow-ups that pass their date are flagged as overdue automatically. Every issue has a detail page with quick status, response, follow-up and note actions, linked feedback, the meetings where it was discussed, and a complete activity history. |
| **Meetings** | Covers Pre-BCF and formal BCF meetings. Includes a month calendar and an agenda builder: add existing issues or your own items, and reorder them. For each item you can record management responses and decisions, and push a response back to the linked issue. You can convert a decision into a tracked action. Each meeting has minutes, a notes-approved switch, a follow-up checklist, and PDF export of the agenda and minutes. |
| **Updates** | Draft messages for the apprentice Teams channel. Includes templates with `{placeholders}`, a meeting summary generator (approved notes only), copy-to-clipboard, a Draft → Approved → Published workflow and per-update history. **Nothing is ever posted automatically.** |
| **Feedback** (More) | Record apprentice feedback by shed or department and category, with no personal details. Warns when text looks like it contains an email address, phone number or employee number. Similar feedback is flagged as you type, and repeated concerns are detected over a 90-day window. Feedback can be linked to an existing issue or converted into a new one, singly or as a group. |
| **Weekly planner** (More) | Three priorities for the week. Lists follow-ups due or overdue, meeting checklist items, upcoming meetings, outstanding management responses and updates waiting to go out. Includes a weekly progress summary you can copy. |
| **Reports** (More) | Issues by category, by department and by status; open versus resolved; overdue actions; average resolution time; a monthly activity table. Everything is calculated only from recorded data. You can print the page or export a PDF report. |
| **Data & backup** (More) | Export and restore JSON backups (validated before import), load or clear the demo data, edit the department and category lists, erase all data, and see the storage status. |
| **Privacy & security** (More) | Explains in the app how data is handled and what approval is needed before real use. |

### Technical summary

- **React 18 + TypeScript + Vite 6.** Routing is a small built-in hash router, so the app works on any static host and inside an iPhone Home Screen app.
- **Local-first storage in IndexedDB** (via `idb`). No server, accounts, analytics or third-party requests. The app asks the browser to keep its storage persistent.
- **Installable PWA** (`vite-plugin-pwa` / Workbox). All app files are precached, so the app works fully offline once loaded.
- **PDFs are generated on the device** with `jsPDF`, which is only loaded when needed. On iPhone the Share sheet opens so you can save the PDF to Files or AirDrop it.
- **Strict Content Security Policy** in production builds. Only system fonts are used, with no font downloads.
- **No paid APIs** and no runtime network dependencies.

### Project structure

```
bcf-hub/
├── index.html               iOS meta tags, manifest link
├── vite.config.ts           PWA manifest, service worker, CSP injection, test config
├── public/                  icons, _headers (hosting security headers), robots.txt
├── scripts/
│   ├── e2e.mjs              end-to-end smoke test (Chromium at iPhone size)
│   └── make-icons.mjs       renders PNG icons from the SVG
├── tests/                   Vitest unit tests (logic + IndexedDB)
└── src/
    ├── main.tsx, App.tsx    providers, routes, bottom navigation
    ├── types.ts             data model
    ├── db/                  IndexedDB access, backup import/export, demo data
    ├── state/               app store (in-memory mirror of IndexedDB), hash router
    ├── lib/                 dates, metrics, validation, issue history, PDF, summaries, clipboard
    ├── components/          UI primitives, sheets, toasts/confirm, file export, icons
    ├── pages/               one file per screen
    └── styles/global.css    design tokens and all styling (including print)
```

---

## Running locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd bcf-hub
npm install
npm run dev          # development server on http://localhost:5173
```

Other commands:

```bash
npm test             # unit tests (34 tests: metrics, validation, history, backup, demo data, IndexedDB)
npm run build        # type-check and build the production app into dist/
npm run preview      # serve the production build on http://localhost:4173

# End-to-end test (needs a Chromium; set CHROMIUM_PATH if Playwright can't find one)
npm run build && npx vite preview --port 4173 &
npm run e2e -- ./e2e-shots    # 33 checks + screenshots
```

When BCF Hub first opens, choose **Explore with demo data** or **Start with a blank workspace**. Demo data can be loaded or cleared at any time from **More › Data & backup**.

---

## Testing on your iPhone

### Option A: same Wi-Fi network (quick look)

1. On your computer, run `npm run dev`. The terminal shows a **Network** address, for example `http://192.168.1.20:5173`.
2. On the iPhone, connect to the **same Wi-Fi** and open that address in Safari.
3. Everything works except offline mode and full Home Screen installation. Service workers need HTTPS, and a local `http://` address isn't secure. Use this option for trying the screens and workflows.

If the page doesn't load, check that your computer's firewall allows incoming connections to Node on port 5173.

### Option B: private HTTPS deployment (full PWA)

To test offline use and Home Screen installation, the app must be served over **HTTPS**. See [Secure deployment](#secure-deployment) below.

### Option C: claude.ai preview (no setup)

`npm run build:preview` builds a single-file version (`dist-preview/bcf-hub.html`) that can be hosted as a private claude.ai Artifact. Open the link on your phone while signed in to claude.ai. The preview hides features that host doesn't allow: PDF export, backup export, printing and offline use. Data entered there stays in that browser only.

### Installing on the Home Screen

1. Open the HTTPS address in **Safari** (not Chrome or an in-app browser).
2. Tap **Share** (the square with an arrow) and choose **Add to Home Screen**. Keep the name "BCF Hub" and tap **Add**.
3. Open BCF Hub from the new icon. It runs full-screen, respects the notch and Home indicator, and works offline after its first load.

Things to know on iPhone:

- **The Home Screen app and Safari tabs keep separate data.** Pick one, ideally the Home Screen app, and use it consistently. Use **Export backup** and **Restore** to move data between them or to a new phone.
- Safari can clear website data for sites that aren't used for a while. Home Screen apps are much less affected, but **export a backup regularly**. The Data & backup screen shows when you last did.
- Clearing Safari's website data, or deleting the Home Screen icon, deletes the app's data.
- Backups and PDFs open the iOS Share sheet. Choose **Save to Files** to keep them on the device.

---

## Secure deployment

BCF Hub is a static site: the `dist/` folder contains only HTML, JavaScript, CSS and icons. **No data is ever stored on the server.** Each person's records stay in their own browser. Hosting the app therefore publishes the code and the fictional demo data, but no real records.

1. Build: `npm run build`.
2. Upload `dist/` to a static HTTPS host. Good free options:
   - **Cloudflare Pages** or **Netlify**: drag and drop `dist/`, or connect a private Git repository. Both read `dist/_headers`, which adds HSTS, `frame-ancestors 'none'`, `nosniff`, a no-referrer policy and `noindex`.
   - **GitHub Pages** also works. Because asset paths are relative, it can be served from a sub-folder. It ignores `_headers`, but the CSP is still applied through the meta tag.
3. Optional hardening:
   - Put the site behind access control (for example Cloudflare Access). This stops other people even loading the app.
   - Use an unremarkable URL. Don't use the company name or logo without permission.
   - `robots.txt` and `X-Robots-Tag` already ask search engines not to index the site.
4. **Don't** commit backups, exported PDFs or any real workplace information to a repository. Don't upload them to the host either.

Updates: when a new version is deployed, the service worker fetches it in the background, and it is used the next time the app is opened.

---

## Security and company data

- Use **fictional demo data** during development and demonstrations. Every demo record carries a **Demo** label and can be removed with one tap.
- Don't record names, clock numbers or contact details. Don't record identifiable complaints, grievance or health information, internal minutes, or confidential business details.
- Local data is **not encrypted by the app**. Its protection relies on the iPhone passcode or Face ID and the device's built-in encryption. Backup files are plain JSON, so keep them private.
- There are no third-party analytics, fonts or APIs, and the strict CSP prevents connections to other sites. The end-to-end test confirms that no external requests are made.

### Before real workplace use

Before BCF Hub, or anything like it, is used with real information, the following would be needed. The same checklist is in the app under **More › Privacy, security & approval**.

1. **Sponsor approval:** agreement from the apprenticeship or HR lead and the BCF chair that a digital tool can be used for representative work, and on what terms.
2. **IT and information security review:** including whether a personal device and a self-hosted web app are acceptable at all.
3. **Data protection (UK GDPR):** a Data Protection Impact Assessment, a lawful basis for processing, a retention schedule, and a privacy notice telling apprentices how their feedback is recorded.
4. **An approved platform:** real use would most likely move to a company-managed platform (for example Microsoft 365 / SharePoint / Power Apps) with company sign-in, rather than browser storage.
5. **Access control:** company single sign-on, role-based access for other reps, and removal of access when a rep steps down.
6. **Device security:** a managed or approved device, passcode or Face ID, encryption, and a plan for a lost phone.
7. **Encrypted backups** stored in an approved, access-controlled location.
8. **Audit trail and retention:** a deletion process for closed issues and old feedback.
9. **Communications sign-off:** agreement on who approves Teams updates before they are posted.
10. **Permission to use the company name or branding:** none is used in this prototype.

---

## Known limitations and unfinished features

These are listed honestly so nobody is surprised:

- **Not yet tested on a physical iPhone.** Automated testing used Chromium at iPhone screen size (390 × 844, touch). Check the Safari-specific behaviour on a real device before relying on it: the Share sheet for PDFs and backups, date pickers, safe-area spacing and Home Screen install.
- **Single device and single user.** There is no sync, no sharing with other reps and no sign-in. Moving data between devices means export and restore.
- **Overdue follow-ups are only flagged inside the app.** There are no push notifications or reminders.
- **Meetings aren't added to the iPhone calendar.** There is no `.ics` export yet.
- **No encryption at rest beyond the device's own,** and backups are unencrypted JSON.
- **Repeated-concern detection is simple:** it uses shared category, shed and keyword overlap, so it can miss some reworded concerns or group unrelated ones.
- **PDFs use the built-in Helvetica font.** Emoji and characters outside Western European text are removed from PDFs (the copied Teams text keeps them).
- **No undo.** Deletes and data replacement ask for confirmation first.
- **The report period filter applies to the date issues were raised.** The monthly table always shows the most recent 3 or 6 months.
- **The "last backup" date is recorded when the backup file is prepared,** not when iOS confirms it was saved.
- **Accessibility:** forms are labelled, keyboard and focus handling and reduced-motion support are built in, and colours were checked for contrast and colour-blind separation. A full VoiceOver audit has not been done.
- **Not translated:** the app is in British English only.
