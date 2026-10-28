# Changelog

## Unreleased

- Footer wording: "Checks for updates every 5 min" now reads "Looks for new data every 5 min".
  The old line made it sound like the board itself updates that often. It only re-checks the
  data feed, which may change much less often.

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
