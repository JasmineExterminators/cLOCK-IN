# cLOCK IN

A punch clock for studying. Clock in when you lock in, get paid by the hour, and spend your pay on a better car and a nicer place to live.

## What's in it

- **Time clock**: clock in (button, Enter in the task box, or Space), with a live timer and live earnings. Clocking out prints a shift receipt.
- **Weekly payday**: shifts add to "this week's pay". Every Friday at 5 PM that week's pay becomes a paycheck you open and deposit. Change the day and time with `PAYDAY` in `js/data.js`.
- **Promotions**: total hours raise your job title and hourly rate (Intern at $15/hr, up to Chief lock-in officer at $65/hr).
- **Pittsburgh**: seven homes by neighborhood (Oakland dorm up to a Fox Chapel riverfront mansion) and six cars, all with a skyline, river, and yellow bridge behind your place. Chicago and New York show as locked "next cities".
- **Accounts**: sign up with email and password and your progress is saved to the cloud after every change, so it follows you to your phone or a new laptop. Without an account the app still works, saved only in that browser.
- **Friends**: start a crew or join one with a 6-character code or invite link (needs an account). Everyone in the crew sees each other's places, hours this week, and who's on the clock right now (with what they're working on).
- **Pay page**: every shift (pending or paid) and every paycheck. Removing a shift takes its pay back out.
- **Prototype tools** (bottom of Pay): add a test shift, run payday now, add money, reset.

## Where data lives

The database is Supabase (Postgres), connected to the Vercel project through the Vercel Marketplace, which sets `POSTGRES_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

- **Accounts** are Supabase Auth users. The browser never talks to Supabase directly. It calls `/api/auth`, which creates the user (no confirmation email) or signs in and returns a session token.
- **Saves**: one row per user in `saves`, holding the whole game state as JSON with a version number. Two devices can't silently overwrite each other: a stale write gets the newer save back, the browser merges it (any shifts only one side has are kept) and tries again.
- **Crews**: `crews` and `crew_members`, one row per member holding the card friends see (name, home, car, hours, clocked-in status).
- Every browser also keeps a copy in `localStorage`, so the app works offline and syncs when it's back.
- The tables are created automatically on first use (`api/_lib/schema.js`). Row-level security is on with no policies, so nothing is readable through Supabase's public API; only the serverless functions, using the service key, touch the data.

Free-tier note: Supabase pauses a free project after 7 days with no activity. Your data stays; un-pause it from the Supabase dashboard.

## Running it

The pages are static with no build step. Friends needs the API, so the easiest way to run everything locally is the Vercel CLI:

```sh
npm install
npx vercel link     # once, pick the clock_in project
npx vercel env pull # gets the Supabase keys into .env.local
npx vercel dev      # http://localhost:3000
```

Without the API, any static server works for everything except accounts and Friends (`python3 -m http.server 8000`). Opening `index.html` straight from disk won't work, because ES modules need a server.

Tests for the server logic (auth, saves, crews): `npm test`.

Vercel deploys on every push to `main`: framework preset "Other", no build command.

## Where things live

| File | What it does |
| --- | --- |
| `index.html` | Page structure for all four views |
| `styles.css` | All styling and the design tokens (colors at the top) |
| `js/app.js` | State, clock in/out, rendering, shop logic |
| `js/data.js` | Ranks, pay rates, and the shop catalog. Rebalance the economy here |
| `js/art.js` | Procedural pixel art for cars, homes, and the scene |
| `js/pixel.js` | Tiny pixel buffer and isometric box rasterizer |
| `js/glyphs.js` | The dot-matrix font used for the timer and logo |
| `js/cloud.js` | Sign-in session, calls to the API, and merging two saves |
| `js/social.js` | Friends client: crew codes and calls to `/api/crew` |
| `api/auth.js` | Sign up, sign in, refresh a session |
| `api/save.js` | Read and write your cloud save |
| `api/crew.js` | Crews: create, join, update, leave, read |
| `api/_lib/*.js` | The rules for each (`auth`, `save`, `crew`), kept separate from storage so they're testable, plus `db.js` (Postgres queries) and `schema.js` (tables) |

To add a car, add an entry to `CARS` in `js/data.js`. Its shape comes from `len`, `bodyH`, `cab`, `roofH` and the slopes. To add a home, add an entry to `HOMES` and a matching `case` in `drawHome()` in `js/art.js`.

## Ideas for later

- Taxes on each paycheck (federal, state, and Pittsburgh's local tax as deduction lines)
- A daily goal, with overtime pay at 1.5× past it
- Rent or a mortgage on the home you live in, due on payday
- Chicago and New York catalogs, unlocked by what you own in the city before
- Password reset by email (needs an email sender set up in Supabase)
- Streaks and attendance bonuses, or docked pay for skipped days
- Furniture and interiors, pets, a neighborhood you can walk around
- A focus mode: pay pauses if you leave the tab for too long
- Installable phone app (PWA first, then native)
