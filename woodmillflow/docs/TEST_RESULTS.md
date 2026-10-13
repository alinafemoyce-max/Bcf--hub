# WoodmillFlow: Test Results

**Run on:** 12 October 2026, development container (Linux, Node.js 22.22, Chromium 141 via Playwright 1.56)
**Commands:** see [README → Testing](../README.md#testing)

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | ✅ No errors |
| ESLint (`npm run lint`) | ✅ No errors or warnings |
| Production build (`next build`) | ✅ Compiled successfully |
| Unit + integration tests, embedded PostgreSQL (`npm test`) | ✅ 48 passed (4 files) |
| Integration tests against PostgreSQL 16 server (`TEST_DATABASE_URL=… npx vitest run tests/integration`) | ✅ 17 passed |
| End-to-end, embedded database (`npm run test:e2e`) | ✅ 11 passed |
| End-to-end against PostgreSQL 16 server (`E2E_DATABASE_URL=…`) | ✅ 10 passed, 1 skipped (the reset-screen test needs a PIN in hosted mode; reset itself ran successfully through the API before the tests) |
| `npm audit --omit=dev` (runtime dependencies) | ✅ 0 vulnerabilities |

## What is covered

**Unit tests** (`tests/unit`)

- Clock-number validation: numeric and alphanumeric rules, length limits, configurable through environment variables
- Dimension validation: required fields, minimum and maximum values, whole millimetres, decimal thickness, thickness optional only for "Other"
- Quantity validation: positive whole numbers with an upper limit
- Multi-item orders: 1–20 items, each with its own specification
- Urgent requests require a reason; the required date cannot be in the past or more than 12 months ahead; hull-reference format
- Status transition rules: main path only, no skipping or going backwards, final states, requester limits
- UK date and time formatting: DD/MM/YYYY, 24-hour HH:mm, BST and GMT changeover, midnight date rollover
- Private-demo access gate (access code, QR key, cookie)

**Integration tests** (`tests/integration`, real SQL on PostgreSQL)

- Ten seeded fictional orders across all statuses, with sample times within working hours
- Creating an order with two structured cutting items and a server timestamp
- Unique sequential references (`WM-YYYY-NNNN`)
- Idempotency: two simultaneous submissions with the same key create one order
- Unknown department rejected; operator clock numbers cannot place requests
- Operator moves an order Submitted → Accepted → In Progress → Ready → Collected, and the tracking view reflects every step
- Status history records the previous status, the new status, the time and the operator
- Invalid transitions rejected; conflicting updates from two devices detected (HTTP 409)
- Rejection and clarification require a message
- Internal operator notes and the operator's name are never included in the tracking data
- Agreed priority set by the operator and used for queue sorting
- Clarification round trip (operator asks, requester replies)
- Requester can cancel before work starts but not after
- Demo reset restores the original data

**End-to-end tests** (`e2e`, production build in Chromium)

1. **Full workflow on two devices:** iPhone-sized employee and laptop operator in separate browser sessions. Enter the employee portal → enter a fictional clock number and details → add two different items → review → submit → check the reference, today's UK date and HH:mm time → operator finds the order → checks the clock number, line and both item specifications → Accept → Start Cutting → Mark Ready → employee tracking shows Ready for Collection and the timeline → operator marks Collected (with confirmation) → tracking updates automatically → **both devices reloaded and the data persisted** → order listed under My Requests.
2. Validation messages appear for missing and invalid fields, and nothing is submitted.
3. Items can be duplicated, edited independently and removed.
4. **QR code is decoded** from the image and matches the request-form address (a network address, not `localhost`), and that address serves the form.
5. **No horizontal overflow at 375, 390 and 430 px** on the home, request, my requests, QR, poster, guide, demo, operator queue and operator order screens.
6. The operator API refuses non-operators; tracking cannot be reached by order reference; cross-site form posts are rejected.
7. Demo reset from Demo Settings requires typing RESET and restores ten orders.

## Not tested here: please check yourself

- **A physical iPhone and Safari.** The tests run Chromium at iPhone screen sizes. Before Thursday, scan the QR code with your iPhone and complete one request end to end.
- **Your own Wi-Fi or hotspot.** Network isolation depends on the network. The Personal Hotspot method is recommended.
- **A hosted Vercel deployment.** It was not deployed, because that needs your accounts. The hosted code path (a real PostgreSQL server) is covered by the PostgreSQL test runs above.
