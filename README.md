# cLOCK IN

A punch clock for studying. Clock in when you lock in, get paid by the hour, and spend your pay on a better car and a nicer place to live.

## What's in it

- **Time clock**: clock in (button, Enter in the task box, or Space), with a live timer and live earnings. Clocking out prints a shift receipt.
- **Weekly payday**: shifts add to "this week's pay". Every Friday at 5 PM that week's pay becomes a paycheck you open and deposit. Change the day and time with `PAYDAY` in `js/data.js`.
- **Promotions**: total hours raise your job title and hourly rate (Intern at $15/hr, up to Chief lock-in officer at $65/hr).
- **Pittsburgh**: seven homes by neighborhood (Oakland dorm up to a Fox Chapel riverfront mansion) and six cars, all with a skyline, river, and yellow bridge behind your place. Chicago and New York show as locked "next cities".
- **Friends**: everyone on the shared page publishes their place (home, car, title, hours) and whether they're on the clock right now. Ranked by hours this week.
- **Pay page**: every shift (pending or paid) and every paycheck. Removing a shift takes its pay back out.
- **Prototype tools** (bottom of Pay): add a test shift, run payday now, add money, reset.

Your own progress is saved in each browser's `localStorage`. Friends uses the claude.ai page's shared database (see `js/social.js`); on other hosts it shows a message instead.

## Running it

It's a static site with no build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` straight from disk won't work, because ES modules need a server.)

Vercel deploys it as-is: framework preset "Other", no build command, output directory `.`.

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
| `js/social.js` | Friends backend. Swap this one file to move friends to another backend |

To add a car, add an entry to `CARS` in `js/data.js`. Its shape comes from `len`, `bodyH`, `cab`, `roofH` and the slopes. To add a home, add an entry to `HOMES` and a matching `case` in `drawHome()` in `js/art.js`.

## Ideas for later

- Taxes on each paycheck (federal, state, and Pittsburgh's local tax as deduction lines)
- A daily goal, with overtime pay at 1.5× past it
- Rent or a mortgage on the home you live in, due on payday
- Chicago and New York catalogs, unlocked by what you own in the city before
- Accounts and sync on our own backend, so saves follow you across devices
- Streaks and attendance bonuses, or docked pay for skipped days
- Furniture and interiors, pets, a neighborhood you can walk around
- A focus mode: pay pauses if you leave the tab for too long
- Installable phone app (PWA first, then native)
