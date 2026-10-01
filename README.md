# ABL User Guide

A short, interactive guide that shows prospective customers, beta testers, aircraft owners and
avionics shops how ABL works with their aircraft: what they will do, what ABL asks, what ABL does,
what they will see, and what to do with their USB drives.

It is **not** an ABL simulator and is not connected to anything. There is no backend, no login,
no Jeppesen connection and no ABL device. The ABL screens and browser-portal pages shown are real
renders of the current v8.2 software made with example data (see *Screen images* below).

## What the visitor sees

1. **Start** — "ABL USER GUIDE · See how ABL works with your aircraft", a demonstration notice and
   **Start Guide**.
2. **Three questions** — How many aircraft? (One / Two) · What avionics? (IFD400 / IFD500 /
   IFD500 + IFD400 / Multiple IFDs) · Electronic Charts? (Yes / No; not asked for a single IFD400).
3. **Your setup** — each aircraft with its avionics, chart coverage and USB drives.
4. **The workflow** — 11 to 13 steps. Each has a one-line summary for skimming, **What you'll see on
   the ABL** (real 800×480 screens), and expandable *What you do*, *What ABL does*, *Why this matters*
   and, where both exist, *On the ABL · In your browser*:
   Two ways to set up (touchscreen vs the ABL's local browser portal) → Wi-Fi → Jeppesen sign-in →
   select aircraft → avionics → Electronic Charts coverage (if used) → USBs → (two aircraft) aircraft
   stay separate → ABL checks for databases → ABL prepares the USB → SAFE TO REMOVE → put the USB in
   the avionics → getting the next cycle early (LOAD NXT).
5. **Your configuration** — the summary plus a quick reference of the messages ABL can show
   (meaning and what to do).

Navigation: **← Back**, **Next →**, **Step X of N**, **Start over**. Back never loses the answers;
Start over clears them. The answers live only in the page address (for example
`#/guide/2/mixed/charts/4`), so a step can be bookmarked or shared.

## Representative setups

| Answers | Guide shows |
|---|---|
| One aircraft, IFD500 | N247AP · IFD500 · USB A |
| One aircraft, IFD400 | N247AP · IFD400 · USB A (no chart coverage) |
| One aircraft, IFD500 + IFD400 | N247AP · IFD500 + IFD400 · USB A |
| One aircraft, Multiple IFDs | N247AP · 2 × IFD500 · USB A, USB B |
| Two aircraft, any avionics | N247AP · IFD500 · USB A, and N81JN with the chosen avionics and its own USB(s) |

With Electronic Charts, N247AP uses Southwest coverage and N81JN Northeast (examples).
N247AP and N81JN are the owner's aircraft, used as example registrations only.

## What is and is not claimed

The content follows the current ABL v8.2 behaviour: USBs belong to aircraft; with one aircraft any
suitable USB belongs to it (no assignment), with several aircraft ABL asks once which aircraft owns
each new USB; every USB gets the aircraft's whole package; the installed IFD count does not limit
USBs; READY / SAFE TO REMOVE only after verification; the next cycle is loaded early only when the
customer chooses LOAD NXT; ABL never guesses cycles from the calendar.

Each setup states its validation status:

- **Physically verified:** one IFD500-series aircraft with one USB (an ABL-prepared USB loaded
  NavData, Obstacles and Electronic Charts into an Avidyne IFD550).
- **Still in physical validation (stated in the guide):** IFD400 loading of the ABL-prepared USB,
  several USBs inserted at once, and physical two-aircraft use (covered by ABL's automated tests).

Database cycles (2610 / 2611) are examples, not live availability. No passwords are shown or stored.

## Touchscreen vs browser portal

The guide states only what the current product provides. The browser portal is the ABL's own local
web page (MENU → SETTINGS → WEB SETUP shows its address); it works on the same network only, needs no
password there, and is not reachable from the Internet.

| Task | On the ABL | In your browser |
|---|---|---|
| Wi-Fi | SETTINGS → NETWORK | Yes |
| Jeppesen sign-in / account | SETTINGS → JEPPESEN | Yes — CONNECTED, Change Account, REAUTHENTICATION REQUIRED |
| Aircraft and installed avionics | SETTINGS → AIRCRAFT | Yes — including service choice |
| Electronic Charts coverage | Regions (MENU → CHART COVERAGE) | Regions, states, map area, minimum runway; per aircraft; no password while CONNECTED |
| Assign a USB to an aircraft | MENU → USB / MEDIA → MANAGE USB | No (can clear an aircraft's USB assignments) |
| Name / format a USB | MENU → USB / MEDIA | No |
| LOAD NXT | Tap NXT NAV | No |

## LOAD NXT

The guide's LOAD NXT step explains CURRENT vs NXT, the NXT NAV words (NOT YET AVAILABLE, LOAD NXT,
CACHING, READY TO LOAD) and EFFECTIVE, with a dated example (2610 released Sep 30, effective Oct 1).
It states that loading early never makes a cycle effective early, that LOAD NXT covers NavData and
Obstacles only (Electronic Charts are not part of that choice), that it is optional and
touchscreen-only, and that with two aircraft it applies to every automatically managed aircraft —
all as in the current updater and dashboard code.

## Screen images

`src/assets/abl/` (22 images) and `src/assets/portal/` (6 images) are generated by
`python3 scripts/render-screens.py` from the current repository code:

- ABL screens: the v8.2 WAVESHARE_800 renderer at native 800×480.
- Browser portal: the current setup portal captured in headless Chrome.

Only example data is used (N247AP, N81JN, cycles 2609/2610, addresses such as http://abl.local and
192.168.1.50, account pilot@example.com). Re-run the script after UI changes, review the images, and
commit them; the published guide never needs the repository. The script needs Python 3 with Pillow
and Chrome/Chromium.

## Project layout

```
docs/abl-user-guide/
  src/                 the site (copied unchanged to dist/)
    index.html
    styles.css
    js/model.js        setups, steps and message reference (no DOM)
    js/app.js          rendering and navigation
    assets/            icon and the N247AP pixel-art scene
  scripts/build.mjs    production build + portability checks
  scripts/render-screens.py  regenerates the ABL / portal images from the product code
  scripts/preview.mjs  local preview under /abl/user-guide/
  tests/*.test.mjs     unit tests (model, build output)
  tests/browser/       headless-Chrome self-test (phone, tablet, desktop)
```

No npm packages are used; Node.js 20 or newer is the only requirement.

## Commands

Run from `docs/abl-user-guide/`:

| Task | Command |
|---|---|
| Build for production | `npm run build` |
| Preview locally | `npm run preview`, then open http://127.0.0.1:4173/abl/user-guide/ |
| Unit tests | `npm run test:unit` |
| Browser tests | `npm run test:browser` (needs Google Chrome or Chromium; set `CHROME=/path` if not found) |
| Everything | `npm test` |

The production output is **`docs/abl-user-guide/dist/`**. The build copies `src/` to `dist/` and
fails if any file references an absolute path, `localhost`, a `file://` URL, this Mac or an external
`http(s)` resource. `dist/index.html` can also be opened directly from disk.

## Deploying to the METAR LightWorks website

1. `cd docs/abl-user-guide && npm test` (builds and tests).
2. Upload the **contents** of `dist/` to `/abl/user-guide/` on the web host, keeping the folder
   structure:
   ```
   /abl/user-guide/index.html
   /abl/user-guide/styles.css
   /abl/user-guide/js/model.js
   /abl/user-guide/js/app.js
   /abl/user-guide/assets/icon.svg
   /abl/user-guide/assets/n247ap-scene.png
   ```
3. Open `https://metarlightworks.com/abl/user-guide/`.

All paths are relative, so the same files also work at the site root or in any other folder. No
server configuration, rewrites or runtime are needed.

## Tests

- **Unit** (`tests/model.test.mjs`): only N247AP/N81JN are used; every answer combination gives 11–13
  steps with summary / *you / ABL / why*; the touchscreen-vs-browser table claims only supported tasks;
  chart coverage is per aircraft with no password while CONNECTED; LOAD NXT distinguishes available /
  ready to load / effective and never claims early effectiveness; one aircraft needs no USB assignment; two aircraft get USB SETUP
  REQUIRED and the separation step; IFD400 gets no chart coverage; mixed and multiple-IFD
  explanations; validation notes; no password, percentage or live-availability claims; message
  reference.
- **Build output** (`tests/dist.test.mjs`): exact file list, relative references, no external requests.
- **Browser** (`tests/browser/`): the real built page in headless Chrome at phone, tablet and desktop
  sizes walks every representative setup end to end and checks step numbering, Back/Next/Start over,
  the question logic, the expandable sections, the real screen images and captions, the two-ways
  table, the LOAD NXT explanation, no horizontal scrolling and touch targets of at least 44 px. (Headless Chrome on macOS cannot go below 500 px wide; 375 px was
  checked by hand.)

## Limitations

- The images show representative screens, not every ABL screen.
- The guide shows representative setups, not every possible installation. Vantage and EX500 are not
  covered (automatic writing for them is not enabled in ABL).
- Avidyne's procedure for loading the USB into the IFD is referenced, not reproduced.
