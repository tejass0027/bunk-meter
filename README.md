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
   (This part is already done — the app is live at the link above.)

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

### Note on updates not showing up

This app works offline, which means phones may keep showing a cached
older version for a little while after you push an update. If a classmate
says they don't see your latest change, have them close the app fully and
reopen it, or clear the site's data in Chrome — that fetches the fresh
version.
