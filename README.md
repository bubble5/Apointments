# ID Pickup Appointments

A small Next.js app for booking ID-pickup appointments. Students enter their
reg number, phone, and email; the app assigns the next available slot across
2–3 tellers (5-minute slots by default) and writes the booking to a Google
Sheet. Confirmation shows an appointment number, date, time, and teller.

## How scheduling works

- Business hours, number of tellers, teller names, and slot length are all
  configured via environment variables (see `.env.example`).
- Appointments are handed out in order: the app counts how many bookings
  already exist for a day, then fills tellers "in parallel" (slot 1 goes to
  Teller 1/2/3 at the same time, slot 2 goes to Teller 1/2/3 at the next
  time, and so on). When a day is full it automatically rolls over to the
  next working day (weekends skipped by default).
- Appointment numbers look like `MKUR-20260713-001`.
- The same reg number, phone number, or email can only hold **one appointment
  per day**. Trying to book a second one for the same day returns an error
  naming the field that conflicted along with the existing appointment's
  number, time, and teller. Booking a *different* day is always allowed.

## 1. Set up the Google Sheet

1. Create a new Google Sheet (or use an existing one) and copy its ID from
   the URL: `https://docs.google.com/spreadsheets/d/THIS_PART/edit`.
2. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or reuse one), enable the **Google Sheets API**, then create a
   **Service Account**. Generate a JSON key for it — this downloads a
   `.json` file.
3. Open your Google Sheet, click **Share**, and share it with the service
   account's email address (the `client_email` value inside the JSON file)
   as an **Editor**.
4. The app will automatically create a tab named `Appointments` (or whatever
   you set `GOOGLE_SHEET_NAME` to) and add the header row the first time it
   runs — you don't need to pre-format anything.

**Credentials**: paste the *entire contents* of the downloaded `.json` file
as one env var, `GOOGLE_SERVICE_ACCOUNT_JSON`. This is the recommended
method — since it's already valid JSON, there's no risk of mangling the
private key's `\n` escape sequences by hand. See `.env.example` for the
exact format. (The old two-variable method,
`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`, still works as a
fallback if you already have those set somewhere, but isn't necessary for
new setups.)

## 2. Configure environment variables

Copy `.env.example` to `.env.local` for local development and fill in:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_NAME=Appointments

NUM_TELLERS=3
TELLER_NAMES=Teller 1,Teller 2,Teller 3
SLOT_MINUTES=5
BUSINESS_START=08:00
BUSINESS_END=17:00
SKIP_WEEKENDS=true
ORG_NAME=Mount Kigali University Rwanda
```

Notes:
- `GOOGLE_PRIVATE_KEY` must keep its `\n` sequences literally — most
  platforms (including Vercel) let you paste it as one line and it works
  fine because the code converts `\n` back into real newlines.
- Set `NUM_TELLERS=2` and adjust `TELLER_NAMES` if you only have 2 tellers
  on a given day.

## 3. Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## 4. Deploy to Vercel

1. Push this project to a GitHub repo.
2. In [Vercel](https://vercel.com/new), import the repo.
3. Under **Environment Variables**, add all the variables listed above
   (same names, no quotes needed around the private key in the Vercel UI —
   just paste it including the `\n` sequences).
4. Deploy. Vercel will detect the Next.js app automatically.

## API routes

- `POST /api/book` — body `{ regNumber, phone, email }`, returns
  `{ appointmentNumber, date, time, teller }`.
- `GET /api/lookup?appointmentNumber=MKUR-20260713-001` — returns the stored
  appointment if you want to build a "check my appointment" page later.

## Customizing

- **Design**: all styling lives in `app/globals.css` (ticket/stub visual
  theme) and `app/page.js`.
- **Scheduling rules**: `lib/scheduling.js` — this is where you'd add things
  like lunch breaks, per-teller specialization, or blackout dates.
- **Sheet columns**: `lib/sheets.js` — the `HEADER` array controls the
  spreadsheet columns.
