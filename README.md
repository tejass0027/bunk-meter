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

### Note on updates not showing up

This app works offline, which means phones may keep showing a cached
older version for a little while after you push an update. If a classmate
says they don't see your latest change, have them close the app fully and
reopen it, or clear the site's data in Chrome — that fetches the fresh
version.
