# 1% Better — 31 Day Habit Tracker

Vanilla JS + Bootstrap 5 + Chart.js. All data is stored in IndexedDB on your device. Installable PWA that works offline.

## Run

Service workers need `http://localhost` or HTTPS, so don't open `index.html` by double-clicking.

```
cd one-percent-better
python -m http.server 8000
```

Open http://localhost:8000. The first load needs internet to fetch Bootstrap, Chart.js and the Inter font; after that they are cached and the app works offline.

## Install

- Chrome / Edge (desktop): install icon in the address bar.
- Android Chrome: menu → Install app.
- iPhone Safari: Share → Add to Home Screen.

To publish, upload the folder to any static host over HTTPS (GitHub Pages, Netlify, Cloudflare Pages).

## Structure

```
index.html            page shell: navigation, six pages, habit modal
css/style.css         theme (white/black/blue), dark mode, layout
js/db.js              IndexedDB wrapper
js/app.js             state, streaks, charts, sleep, journal, backup, reminders
sw.js                 offline cache (bump CACHE when you change files)
manifest.webmanifest  install metadata
icons/                app icons
```

## Notes

- Backup: Settings → Export JSON backup / Import JSON backup. Imports are validated and ask before replacing anything.
- Monthly PDF: Settings → Monthly PDF report, then choose "Save as PDF" in the print dialog.
- Streaks: a day counts when completion meets the daily target (Settings). Today never breaks a streak before it ends.
- Reminders fire while the app is open. Background push needs a server.
- Cloud sync (Firebase) is not included; data stays in this browser.
