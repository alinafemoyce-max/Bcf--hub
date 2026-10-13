# Woodmill Orders: hosted iPhone demo

**Live link:** https://claude.ai/artifact/Dr7RVM9SrFytkjcFEHijo5

`woodmill-orders.html` is a single-page, phone-first version of the woodmill ordering concept. It is published as a claude.ai Artifact, which gives it:

- an HTTPS address that works in Safari on iPhone, and
- a shared database, so orders placed on the phone appear on the laptop dashboard and the reverse.

## Open it on your iPhone

1. Open the link in **Safari** on your iPhone and sign in to claude.ai with the same account you use for Claude. You can also open the link in the **Claude app**.
2. To add it to your Home Screen, tap **Share → Add to Home Screen**. It then opens like an app. It still needs a signal and a claude.ai sign-in.
3. On the laptop, open the same link and go to **Woodmill → Open in Demo Operator Mode**.

The link is **private to your claude.ai account**. Other people cannot open it until you share it from the page's **Share** menu. Even when shared, only people in your claude.ai organisation (or people invited as editors) can place orders or change statuses. Anyone else can only view.

## What it does

- **Place an Order:** four steps.
  1. Your clock number and department. These are remembered on the device, so later orders take seconds.
  2. A colour-coded material card: Plywood (blue), MDF (green), Solid Timber (amber), Veneered Board (purple), Other (grey).
  3. Type, thickness, length and width in mm, quantity, and instructions.
  4. A check screen, then **Submit Order**.

  You then see **Order Submitted Successfully** with the reference, date and time (UK format, Europe/London) and **View My Order**.
- **My Orders:** search by clock number or order reference. Each order shows its status (Pending, In Progress, Ready for Collection, Collected), with an icon as well as a colour, and a timeline. It updates by itself, and there is a Refresh button.
- **Woodmill Dashboard (Demo Operator Mode):** large cards showing the reference, clock number, department, material and type, length, width, thickness, quantity, instructions, and submission date and time. One large button moves each order to its next step. There are filters, active orders appear above completed ones, a notice shows when a new order arrives, and **Move back** fixes mistakes.
- **QR code:** opens the order form directly (`#order`). **Save poster** gives an A4 SVG you can print.
- **Demo tools → Reset demo orders:** restores the seven sample orders (all marked DEMO) from the `config/demo` template in the database.

## Testing

`node hosted/tests/workflow.test.mjs` (run from the `woodmillflow` folder) drives the page in Chromium. It uses an employee session at iPhone size and a separate operator session, sharing one stand-in database whose documents are read-only, like the real one. It runs the full order → My Orders → dashboard → status-change → refresh scenario, plus error handling and width checks.

## Settings

Material categories, types and thicknesses, departments, the clock-number rule and the dimension limits are listed at the top of the script in `woodmill-orders.html`, in the **SETTINGS** block. Edit them there and republish.

## Limits of this hosted demo (be open about these)

- There is no real sign-in. **Demo Operator Mode is not access control.** A real system would need company sign-in and operator-only permissions enforced on the server.
- The submission time comes from the submitting device's clock.
- Order references are random five-digit numbers (`WM-12345`). The page checks for clashes before saving, but they are not sequential.
- It needs claude.ai to be online and signed in. It does not work offline, and it is not a full installable PWA (Home Screen opens the claude.ai link).
- It has been tested in Chromium at 320, 375, 390 and 430 px widths, with a stand-in for the shared database. It has **not** been tested on a physical iPhone. Check it on your phone before presenting.

For a fuller version with its own server, database, operator workflow and automated tests, see the Next.js app in the parent `woodmillflow/` folder.
