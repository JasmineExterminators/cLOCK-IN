# cLOCK IN

A punch clock for studying. Clock in when you lock in, get paid by the hour, and spend your pay on a better car and a nicer place to live.

## What's in it

- **Time clock**: clock in (button, Enter in the task box, or Space), with a live timer and live earnings. Clocking out prints a shift receipt.
- **Water cooler run**: while you're on the clock, take a 5-minute break. The timer pauses (breaks aren't paid), a countdown shows how long you have left, and when time's up you get a chime, a notification if the tab is in the background, and a nudge to lock back in. Your crew sees you're at the water cooler.
- **Weekly payday**: shifts add to "this week's pay". Every Friday at 5 PM that week's pay becomes a paycheck you open and deposit. Change the day and time with `PAYDAY` in `js/data.js`.
- **Promotions**: total hours raise your job title and hourly rate (Intern at $15/hr, up to Chief lock-in officer at $65/hr).
- **Pittsburgh**: eleven homes by neighborhood, from a shared-bedroom dorm through a suite, a studio dorm and a shared apartment, up to a Fox Chapel riverfront mansion, and eight cars (up to the red Vela supercars), all with a skyline, river, and yellow bridge behind your place. Chicago and New York show as locked "next cities".
- **Accounts**: sign up with email and password and your progress is saved to the cloud after every change, so it follows you to your phone or a new laptop. Without an account the app still works, saved only in that browser.
- **Friends**: start or join crews with a 6-character code or invite link (needs an account). You can be in up to 10 crews, each with a name any member can change, and switch between them with tabs. Everyone in a crew sees each other's places, hours this week, and who's on the clock right now (with what they're working on).
- **Living costs**: every home has daily utilities (from $2/day in a dorm double to $110/day in the mansion) and every pet has daily care. They come off each paycheck as deduction lines, so a paycheck can be negative and so can your balance.
- **Furniture and pets**: buy furniture (plants up to a couch) and pets (fish, bunny, cat, and six dogs: a shelter dog, dachshund, corgi, poodle, husky and golden retriever; bigger dogs cost more a day) in the Shop. Switch your place between Outside and Inside to see your room furnished, with your pets in it. Pets also show in your yard on crew cards.
- **Milestones**: post a big assignment to your crew. At least two people suggest what it's worth (at least one of them not you); the bonus is the average. Mark it done (honor system) and the bonus lands on your next paycheck, shows on the Pay page as "(name) bonus", and your crew can congratulate you.
- **Reports**: think a crewmate's shift looks wrong (say they fell asleep on the clock)? Report it with a fair length. The crew votes; a majority (at least two people) upholds it, or the person can accept it. Upheld reports cut the shift and its pay. Whoever filed a report can retract it while it's still open, and the reported person can post their side of the story for the crew to read before voting.
- **Payday emails**: every Friday around 5 PM Eastern, anyone with pay waiting gets an email with their paycheck amount. Turn it off, or send yourself a test, from the Pay page.
- **Pay page**: your bank balance up top (with this week's pay, next payday and lifetime pay), then every shift and every paycheck. Edit a shift's start and end (or nudge it 15 or 30 minutes longer or shorter) and its pay follows, even on a paycheck already issued; edited shifts are marked for your crew. While you're on the clock, "Edit start time" fixes a late clock-in. Removing a shift takes its pay back out.
- **Prototype tools** (bottom of Pay): add a test shift, run payday now, add money, reset.

## Where data lives

The database is Supabase (Postgres), connected to the Vercel project through the Vercel Marketplace, which sets `POSTGRES_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

- **Accounts** are Supabase Auth users. The browser never talks to Supabase directly. It calls `/api/auth`, which creates the user (no confirmation email) or signs in and returns a session token.
- **Saves**: one row per user in `saves`, holding the whole game state as JSON with a version number. Two devices can't silently overwrite each other: a stale write gets the newer save back, the browser merges it (any shifts only one side has are kept) and tries again.
- **Crews**: `crews` (code and name) and `crew_members`, one row per person per crew holding the card friends see (name, home, car, pets, hours, recent shifts, clocked-in status). One update refreshes your card in every crew you're in.
- **Milestones and reports**: `milestones`, `milestone_votes` and `milestone_congrats`; `reports` and `report_votes`. The rules are in `api/_lib/board.js`. Bonuses and upheld cuts are applied to your save by your own browser the next time it loads the crew.
- Every browser also keeps a copy in `localStorage`, so the app works offline and syncs when it's back.
- The tables are created automatically on first use (`api/_lib/schema.js`). Row-level security is on with no policies, so nothing is readable through Supabase's public API; only the serverless functions, using the service key, touch the data.

**Payday emails** go out through a Gmail account using an app password. A Vercel cron job (`vercel.json`) calls `/api/payday` every Friday at 22:00 UTC (5 PM EST, 6 PM EDT). It reads each save, adds up pay that hasn't been deposited, and records each send in `payday_emails` so nobody gets the same payday twice. Settings in Vercel:

- `GMAIL_USER`: the Gmail address the emails come from
- `GMAIL_APP_PASSWORD`: an app password for that account (Google Account, Security, 2-Step Verification, App passwords)
- `CRON_SECRET`: any long random string; Vercel sends it with the cron call so nobody else can trigger the job

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

Tests for the server logic (auth, saves, crews, milestones and reports, payday emails): `npm test`.

Vercel deploys on every push to `main`: framework preset "Other", no build command.

## Where things live

| File | What it does |
| --- | --- |
| `index.html` | Page structure for all four views |
| `styles.css` | All styling and the design tokens (colors at the top) |
| `js/app.js` | State, clock in/out, rendering, shop logic |
| `js/data.js` | Ranks, pay rates, the shop catalog (homes with utilities, cars, furniture, pets). Rebalance the economy here |
| `js/art.js` | Procedural pixel art for cars, homes, and the scene |
| `js/room.js` | The inside view: room, furniture, pets, and shop tiles |
| `js/pixel.js` | Tiny pixel buffer and isometric box rasterizer |
| `js/glyphs.js` | The dot-matrix font used for the timer and logo |
| `js/cloud.js` | Sign-in session, calls to the API, and merging two saves |
| `js/social.js` | Friends client: crew codes and calls to `/api/crew` |
| `js/board.js` | Milestones and reports on the Friends page |
| `api/auth.js` | Sign up, sign in, refresh a session |
| `api/save.js` | Read and write your cloud save |
| `api/crew.js` | Crews: create, join, update, leave, read |
| `api/payday.js` | The Friday payday-email job, and test emails |
| `api/board.js` | Milestones (suggest, complete, congratulate) and reports (file, vote, accept, retract, respond) |
| `api/_lib/*.js` | The rules for each (`auth`, `save`, `crew`, `board`), kept separate from storage so they're testable, plus `payday.js` (paycheck math and the email), `mailer.js` (Gmail), `db.js` (Postgres queries) and `schema.js` (tables) |

To add a car, add an entry to `CARS` in `js/data.js`. Its shape comes from `len`, `bodyH`, `cab`, `roofH` and the slopes. To add a home, add an entry to `HOMES` and a matching `case` in `drawHome()` in `js/art.js`.

## Ideas for later

- Taxes on each paycheck (federal, state, and Pittsburgh's local tax as deduction lines)
- A daily goal, with overtime pay at 1.5× past it
- Chicago and New York catalogs, unlocked by what you own in the city before
- Password reset by email (needs an email sender set up in Supabase)
- Streaks and attendance bonuses, or docked pay for skipped days
- A neighborhood you can walk around
- A focus mode: pay pauses if you leave the tab for too long
- Installable phone app (PWA first, then native)
