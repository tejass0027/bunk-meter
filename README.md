# Bunk Meter

## What is this?

Bunk Meter is a simple web app that tells college students exactly how many
classes they can safely skip — or how many they need to attend in a row —
to hit their attendance target (usually 75%, but you can change it).

It's built with plain HTML, CSS and JavaScript — no frameworks, no build
tools, nothing to install to work on it. It's also a PWA (Progressive Web
App), meaning you can install it on your phone's home screen like a real
app, and it keeps working even with no internet connection. There's no
login and no server: every subject and count you enter is saved privately
on your own device (`localStorage`), so it's yours alone unless you export
and share the backup file yourself.

## What it does

- **Add, rename, and delete subjects** — one card per subject.
- **Big "Attended" / "Missed" buttons** on each card to log a class in one
  tap, plus an "Undo last" button if you tap the wrong one.
- **Manual count editing** — set attended/total directly, useful if you're
  joining mid-semester and already have a running count.
- **Per-subject stats**: attendance %, a color status (green/yellow/red
  against your target), and a message telling you either how many classes
  you can still skip, or how many you must attend in a row to reach target.
- **Overall attendance %** across all subjects, shown at the top.
- **Settings**: change your target percentage (default 75%), and a
  "Reset all data" button (asks for confirmation first).
- **Export / Import as a JSON file** — back up your data or move it to a
  new phone.
- **Installable & offline-capable** — add it to your home screen from
  Chrome on Android; it keeps working without signal.

## What each file does

```
attendence/
├── index.html          The page itself: header, subject cards, all the
│                        modals (add subject, edit counts, settings,
│                        confirm dialog). No logic here — just structure.
├── css/
│   └── styles.css      All styling: colors (incl. dark mode), card layout,
│                        buttons, modals. Colors are CSS variables at the
│                        top, so it's easy to reskin.
├── js/
│   └── app.js           All the app's behavior lives here:
│                          - loads/saves your data to localStorage
│                          - the attendance math (%, skip/attend targets)
│                          - draws the subject cards on screen
│                          - handles every button tap
├── manifest.json        Tells the browser this is an installable app
│                        (name, icons, colors). Required for "Add to
│                        Home Screen" on Android.
├── sw.js                 The "service worker" — a background script that
│                        caches the app's files so it still opens without
│                        internet. This is what makes it a real PWA.
├── icons/                App icons in the sizes Android/Chrome expect.
├── scripts/make_icons.py Script that generated the icons (optional, only
│                        needed if you want to redesign them).
└── README.md            This file.
```

There is no build step. You never need to compile or bundle anything —
editing any of these files and reloading the page is enough.

## How the attendance math works

For each subject, with `target` as a fraction (75% → 0.75):

- **Attendance %** = attended ÷ total
- **Color**:
  - 🟢 green — at least 5 percentage points above target
  - 🟡 yellow — within 5 percentage points of target (either side)
  - 🔴 red — more than 5 points below target
- **If at/above target** — classes you can still skip:
  `floor((attended − target × total) ÷ target)`
- **If below target** — classes you must attend in a row to reach target:
  `ceil((target × total − attended) ÷ (1 − target))`

Verified examples (see "Testing" below):
- 30 attended / 36 total at 75% target → **"You can skip 4 more classes"**
- 20 attended / 30 total at 75% target → **"Attend the next 10 classes in a row to reach target"**

Edge cases handled: 0 classes held (shows "No classes recorded yet" instead
of dividing by zero), target set to 100% (skip/attend math would divide by
zero, so it's special-cased), and accidental subject deletion (asks for
confirmation first).

## Running it locally

Because the app registers a service worker, it needs to be served over
`http://` — opening `index.html` directly with `file://` will mostly work
(the attendance features are fine), but the offline/install features won't.
Easiest way to serve it locally:

**Option A — Python (already on most machines):**
```bash
cd "path/to/attendence"
python -m http.server 8000
```
Then open `http://localhost:8000` in Chrome.

**Option B — VS Code:** install the "Live Server" extension, right-click
`index.html`, choose "Open with Live Server".

To install it like an app on your Android phone: open the site in Chrome,
tap the ⋮ menu, choose **"Add to Home screen" / "Install app"**.

## Testing the math (already verified)

```
30 / 36 classes @ 75% target → "You can skip 4 more classes"      ✅
20 / 30 classes @ 75% target → "Attend the next 10 classes ..."   ✅
```
I also tested: adding/renaming/deleting subjects, undo, manual count
editing, the settings target change, export/import, reset-all-data, the
0-classes and 100%-target edge cases, and confirmed the service worker
caches all app files for offline use.

## Deploying for free on GitHub Pages

This puts your app on a public URL like
`https://tejass0027.github.io/bunk-meter/` that you can share with
classmates. Takes about 5 minutes.

1. **Create a GitHub repository.**
   - Go to https://github.com/new while signed in as `tejass0027`.
   - Repository name: `bunk-meter` (or anything you like).
   - Keep it **Public** (GitHub Pages needs a public repo on the free plan).
   - Don't add a README/gitignore/license — this project already has files.
   - Click **Create repository**.

2. **Push this project to it.** In a terminal, inside this project folder:
   ```bash
   git remote add origin https://github.com/tejass0027/bunk-meter.git
   git branch -M main
   git push -u origin main
   ```
   (This repo is already initialized and committed for you — see below.)

3. **Turn on GitHub Pages.**
   - On GitHub, open your new repo → **Settings** → **Pages** (left sidebar).
   - Under "Build and deployment" → **Source**, choose **Deploy from a branch**.
   - Branch: `main`, folder: `/ (root)`. Click **Save**.

4. **Wait ~1 minute, then visit your link.**
   - GitHub shows the URL at the top of the Pages settings once it's live:
     `https://tejass0027.github.io/bunk-meter/`
   - Share that link with classmates — they can open it in Chrome on
     Android and tap "Add to Home screen" to install it.

5. **Future updates:** whenever you change a file, run:
   ```bash
   git add -A
   git commit -m "describe what you changed"
   git push
   ```
   GitHub Pages redeploys automatically within a minute or two.

### Note on the service worker cache

`sw.js` has a `CACHE_NAME` constant (currently `bunkmeter-cache-v1`). If you
push an update and classmates don't see the change, it's because their
phone is still serving the old cached files. Bump the version number (e.g.
`bunkmeter-cache-v2`) whenever you deploy a real update — that forces
everyone's browser to fetch the new files.
