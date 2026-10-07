# TripSplit

Track shared trip expenses with friends and see who owes whom. Mobile-first, no backend, no sign-up: everything is stored in your browser.

## Features
- Multiple trips (name + optional dates), switch between them from the header
- People management; removal is blocked for anyone used in an expense
- Optional per-person **profile photo**, **UPI ID** and **Payment QR** (set in the People editor)
- Fast expense entry from the floating **+** button: amount, description (quick chips), optional category (free text with suggestions), paid by, date/time
- Every export (shared text, CSVs, map and story images) carries a "Made with TripSplit" watermark
- Checkbox split with Select all / Deselect all and a live "Split among N people, ₹X each" preview
- Custom split with exact amounts per person (must add up to the total)
- Optional **bill / receipt** per expense: take a photo or upload an image/PDF, view it from the log
- Expense log (newest first) with person and date filters, edit and delete with confirmation
- Summary: total paid, share, and net per person (green = gets back, red = owes), total expenditure, and a Settle Up plan with the fewest transfers
- **Pay** button on each settle-up row in Balances: shows the recipient's Payment QR (tap to enlarge), "Open UPI app" (prefilled ₹ amount + UPI ID), copy UPI ID, and Mark as paid / unpaid
- **Journey** tab:
  - *Trail map*: a clean route-poster map. A dark road with a dashed lane winds through circular stop markers that show only the amount and who paid, grouped into DAY bands, from START to a FINISH marker with the trip total. Play / scrubber / 1x–2x replay drives a car along the road; tap a stop for per-person shares; **Share as story** saves a 9:16 PNG.
  - *Money map*: everyone on one circle (bigger circle = paid more, green/red ring = gets back/owes) with arrows for the settle-up payments or all pairwise debts. Tap a person to focus on what they pay and receive; save the map as a PNG.
- Export summary / log as CSV, copy or share a WhatsApp-ready text summary
- Currency symbol setting, dark mode
- Optional **AI sticker classifier** for trail stops: the dev server exposes a `/api/classify` proxy that reads `ANTHROPIC_API_KEY` from `.env.local` (server-side only, never shipped in client code). Without it the app works offline using keyword-based stickers.

## Setup
Requires Node.js 20+.

```bash
npm install
npm run dev       # start dev server at http://localhost:5173
npm test          # run unit tests once
npm run build     # production build into dist/
npm run preview   # serve the production build
```

## Project structure
```
src/
  components/   UI (App shell, expenses, bills, people, summary, trips, settings, ui primitives)
  hooks/        app state (context + reducer), theme, toast, receipt loading
  storage/      localStorage state persistence, IndexedDB bill storage
  utils/        pure logic: money, splits, balances, settlement, export, dates, image
  test/         Vitest unit tests
```

## How the maths works
- Money is stored as integer minor units (paise/cents), so there is no floating-point drift.
- Equal splits give the leftover paise one each to the first people in the list, so shares always add up to the expense and all net balances sum to exactly zero.
- Settle Up finds the true minimum number of transfers (bitmask DP over zero-sum groups) for up to 15 people with non-zero balances, and falls back to a greedy largest-debtor/largest-creditor match beyond that.

## Data storage
- Trips, people and expenses are saved to `localStorage` (key `tripsplit:v1`) on every change.
- Profile photos and Payment QR images are stored inline with the person in `localStorage` (QR images downscaled to max 720px JPEG).
- Bill photos/PDFs are saved in IndexedDB (database `tripsplit`) because localStorage only holds ~5 MB. Photos are downscaled to max 1600px JPEG (~150–300 KB).
- Data lives only on this device and browser. Clearing site data removes it, so export a CSV before you do. CSV exports note whether a bill is attached, but do not include the files.

## Accounts, sharing and deployment (Supabase)
With Supabase configured, people sign in with Google. A trip owner adds friends' Gmail addresses in **Trips → Edit trip → Shared with**, and everyone sees and edits the same trip live. Without Supabase config the app runs local-only, as before.

Security is enforced server-side by Row Level Security policies: only verified Google accounts listed in a trip's `member_emails` can read or write it, only the owner can change members or delete the trip, and every column is type- and size-checked. `firebase.json` sets a strict Content-Security-Policy and other security headers. Bill photos are not uploaded; they stay on the device that attached them.

One-time setup:
1. Create a project at https://supabase.com/dashboard/projects and note the **Project URL** and **anon public** key from **Settings → API**.
2. **Authentication → Providers →** enable **Google**, add your OAuth client ID and secret from Google Cloud Console (https://console.cloud.google.com/apis/credentials), and add your site URL under **Authorized redirect URIs**.
3. Run the SQL in `supabase/schema.sql` in the **SQL Editor** to create the tables and RLS policies.
4. Copy `.env.example` to `.env.local` and paste the Project URL and anon key.
5. `npm run build` then deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
6. After deploying, add your production URL under **Authentication → URL Configuration → Site URL** and **Redirect URLs**.
7. (Optional) Enable **Realtime** for the `trips`, `expenses` and `media` tables in **Database → Replication** for live updates.
