# cLOCK IN

A punch clock for studying. Clock in when you lock in, get paid by the hour, and spend your pay on a better car and a nicer place to live.

## What's in it

- **Time clock**: clock in (button, Enter in the task box, or Space), with a live timer and live earnings. Clocking out prints a shift receipt.
- **Weekly payday**: shifts add to "this week's pay". Every Friday at 5 PM that week's pay becomes a paycheck you open and deposit. Change the day and time with `PAYDAY` in `js/data.js`.
- **Promotions**: total hours raise your job title and hourly rate (Intern at $15/hr, up to Chief lock-in officer at $65/hr).
- **Pittsburgh**: seven homes by neighborhood (Oakland dorm up to a Fox Chapel riverfront mansion) and six cars, all with a skyline, river, and yellow bridge behind your place. Chicago and New York show as locked "next cities".
- **Friends**: start a crew or join one with a 6-character code or invite link. Everyone in the crew sees each other's places, hours this week, and who's on the clock right now (with what they're working on).
- **Pay page**: every shift (pending or paid) and every paycheck. Removing a shift takes its pay back out.
- **Prototype tools** (bottom of Pay): add a test shift, run payday now, add money, reset.

Your own progress is saved in each browser's `localStorage`. Friends goes through a small serverless function, `api/crew.js`, which stores each crew as one JSON file in a private Vercel Blob store. Your browser keeps a random player id and secret token; only that token can change your card.

## Running it

The pages are static with no build step. Friends needs the API, so the easiest way to run everything locally is the Vercel CLI:

```sh
npm install
npx vercel link     # once, pick the clock_in project
npx vercel env pull # gets BLOB_READ_WRITE_TOKEN into .env.local
npx vercel dev      # http://localhost:3000
```

Without the API, any static server works for everything except Friends (`python3 -m http.server 8000`). Opening `index.html` straight from disk won't work, because ES modules need a server.

Tests for the crew logic: `npm test`.

Vercel deploys on every push to `main`: framework preset "Other", no build command. The `BLOB_READ_WRITE_TOKEN` environment variable is already set on the project.

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
| `js/social.js` | Friends client: crew codes, player id, calls to `/api/crew` |
| `api/crew.js` | The serverless function for crews (create, join, update, leave, read) |
| `api/_lib/crew.js` | Crew rules, separate from storage so it's testable |
| `api/_lib/blob-store.js` | Reads and writes crews in Vercel Blob, with ETag checks so simultaneous updates don't clobber each other |

To add a car, add an entry to `CARS` in `js/data.js`. Its shape comes from `len`, `bodyH`, `cab`, `roofH` and the slopes. To add a home, add an entry to `HOMES` and a matching `case` in `drawHome()` in `js/art.js`.

## Ideas for later

- Taxes on each paycheck (federal, state, and Pittsburgh's local tax as deduction lines)
- A daily goal, with overtime pay at 1.5× past it
- Rent or a mortgage on the home you live in, due on payday
- Chicago and New York catalogs, unlocked by what you own in the city before
- Accounts, so your save follows you across devices (the player id/token is the start of this)
- Streaks and attendance bonuses, or docked pay for skipped days
- Furniture and interiors, pets, a neighborhood you can walk around
- A focus mode: pay pauses if you leave the tab for too long
- Installable phone app (PWA first, then native)
