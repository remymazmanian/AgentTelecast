# Changelog

## Unreleased

- How often the page looks for new data is now your choice: Off, 1, 5, 15 or 30 minutes, or every
  hour. Select the footer line with the remote (or click it) to change it. The choice is saved in the
  browser, or in the app, where Settings and the setup screen offer the same choices. `?refresh=` in
  the address sets it too.
- The footer now says what it actually does and follows your choice: "Looks for new data every 15 min",
  "Looks for new data every hour" or "Auto-refresh off". It used to say "Checks for updates every
  5 min", which sounded like the data itself changed that often.
- Feeds can suggest a default with `meta.refreshMinutes`, and add a footer line such as
  "Updated hourly, 9 AM–6 PM" with `meta.updateNote`.
- Android: the free-form "Auto-reload every N minutes" box is replaced by the same choices. An older
  saved number is moved to the closest choice.

## 1.0.0 — Initial public release

- Web page: one self-contained HTML file with a TV layout (1920×1080, remote-friendly) and a
  browser layout for desktop and phone.
- Data comes from one JSON feed. Bake it in at build time, or fetch it at runtime with `--feed`,
  `?data=` or the **Data source** link. If a feed can't be loaded, the bundled data is shown with a notice.
- Feed format documented in `docs/DATA-FORMAT.md`, with a JSON Schema and an example feed.
- Sample agent routine prompt that writes the feed: `docs/ROUTINE-PROMPT.md`.
- Android TV app: full-screen page with remote control, first-run setup screen (type a URL, Test,
  Save, or Try demo), Settings on hold-OK or MENU, auto-reload and text zoom, and recovery when the
  page's renderer stops.
- Demo data (all made up) and screenshots.
