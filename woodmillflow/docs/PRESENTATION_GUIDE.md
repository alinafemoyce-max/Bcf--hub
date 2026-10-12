# WoodmillFlow: Three-Minute Presentation Guide

For the discussion with the IT Director, Thursday 15 October 2026. The same guide is in the app under **Presentation Guide**.

Keep the language neutral. The benefits are **ideas to test, not proven results**.

---

## Before you start (about 10 minutes before)

- [ ] Laptop and iPhone charged. On the iPhone, set Settings → Display & Brightness → Auto-Lock → **Never** for the demo.
- [ ] iPhone **Personal Hotspot** on, and the laptop joined to it. Alternatively, put both on the same Wi-Fi.
- [ ] `npm run demo` running on the laptop. Note the `iPhone:` address it prints.
- [ ] On the iPhone, scan the QR code once to confirm it opens the request form, then go back to the home page.
- [ ] On the laptop, go to **Demo Settings → Reset demo data** so the queue shows the ten sample orders with fresh times.
- [ ] Laptop browser on the **home page**, full screen, zoomed so it is easy to read from across a table.
- [ ] Notifications silenced on both devices.

---

## Running order

### Step 1: Introduce the problem (0:00 – 0:30) · Laptop, home page

> "Cutting requests to the woodmill are currently made on paper forms. After talking to a woodmill operator, I wanted to explore whether a simple digital request could make requests more consistent and make job status easier to see. This is an independent concept using fictional data. I'd value your view on whether it's worth exploring."

### Step 2: Show the employee experience (0:30 – 1:15) · iPhone

1. Scan the QR code on the laptop screen (or the printed poster) with the iPhone camera, and tap the link.
2. Tap **Use demo profile (Alex Taylor)**.
3. **Item 1:** Plywood → Birch plywood → tap **18** → Length **800**, Width **400** → Quantity **3**.
4. Tap **Add Another Item**. **Item 2:** MDF → Moisture-resistant MDF → tap **12** → **600** × **250** → Quantity **2**.
5. Tap **Review Request** → **Submit Woodmill Request**.

> "The employee scans a code in the workshop and fills in a structured form. Each piece has its own material, dimensions and quantity. They get an order reference straight away, and the date and time are recorded automatically."

### Step 3: Show the woodmill operator experience (1:15 – 2:00) · Laptop

1. Click **Woodmill Operator** (top right). A "New request received" notice appears within a few seconds.
2. Click the **New Requests** card, then click the new order.
3. Point out the clock number, production line, and each item's measurements.
4. Click **Accept Request** → **Start Cutting** → **Mark Ready for Collection**.

> "The operator sees every request in one queue, sorted by priority and age. Each status change is saved with the time and who made it, so there's a record of every job."

### Step 4: Return to the employee (2:00 – 2:30) · iPhone, then laptop

1. On the iPhone, tap **Track My Request**. It shows **Ready for Collection** (the page refreshes itself every few seconds).
2. On the laptop, click **Mark Collected** → confirm. The iPhone timeline completes.

> "Instead of walking over or phoning to ask whether materials are ready, the employee can check the status on their phone."

### Step 5: Discuss feasibility (2:30 – 3:00) · Conversation

> "This is only a concept. It isn't approved and isn't connected to any company systems. I'd really value your view on whether something like this is worthwhile, and whether a platform we already use, such as Power Apps, SharePoint or our manufacturing software, could do it better than custom software. If it is worth exploring, could a small authorised pilot be an option?"

---

## Questions you could ask

- Do we already have a system that could handle woodmill requests?
- Would Power Apps, Power Automate, SharePoint or Microsoft Lists be the right place for this?
- What would IT need to see before a small pilot could be considered?
- How do people on the shop floor usually get access to digital tools?
- Who else should I speak to, for example the woodmill supervisor or production management?

## If something goes wrong

- **The iPhone cannot connect:** run the whole demo on the laptop. Submit as Employee, switch to Woodmill Operator and process the order, then open **My Requests** to show the updated status.
- **Something looks wrong in the data:** go to Demo Settings → Reset demo data.
- **The app is not running:** in the terminal, run `npm run demo:start`.

## Likely questions and honest answers

| Question | Answer |
| --- | --- |
| "Is this secure?" | "It's a demo with fictional data. It already uses unguessable tracking links, validates everything on the server and keeps operator notes private. A real version would need company sign-in, IT-approved hosting and a security review." |
| "How much time would it save?" | "I don't know yet. That's what a pilot would measure, for example time to submit, incomplete requests and status enquiries." |
| "Why not use Power Apps?" | "That may well be the better route. I built this to show the workflow, not to suggest custom software is the answer." |
| "Who would support it?" | "That's a question for IT. It's one reason I wanted your view before going further." |
