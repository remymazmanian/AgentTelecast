# AgentTelecast data format

AgentTelecast draws everything from one JSON document, the **feed**. You can bake a feed into the page
at build time (`node build.cjs my-feed.json`) or have the page fetch it while it runs (see
[Pointing it at your feed](#pointing-it-at-your-feed)).

- JSON Schema: [`agenttelecast-feed.schema.json`](agenttelecast-feed.schema.json) (draft 2020-12)
- A small complete example: [`example-feed.json`](example-feed.json)
- The full demo feed used for the screenshots: [`../web/demo/demo-data.json`](../web/demo/demo-data.json)

All example data in this repo is made up.

## The short version

```json
{
  "summary": "Six agents handled 150 events over the last five days.",
  "metrics": [{ "value": "12", "label": "Waiting on you", "tone": "warning" }],
  "sections": [
    {
      "heading": "Waiting for you",
      "items": [{ "title": "Inbox", "lead": "Mon 9:42 AM", "body": "Approve the reply to the venue." }]
    }
  ],
  "meta": { "updatedAt": "2026-03-02T18:05:00Z" }
}
```

Only `sections` is required, and each section only needs a `heading`. Everything else is optional.
Unknown fields are ignored, so you can keep your own bookkeeping in the same file.

## Top level

| Field | Type | What it does |
|---|---|---|
| `sections` | array of [Section](#section) | **Required.** One entry per sidebar section. |
| `summary` | string | Paragraph on the Overview "Summary" card. |
| `metrics` | array of [Metric](#metric) | Headline numbers, used for some KPI tiles. |
| `sources` | array of strings | Where the data came from. Shown when you open the Summary card. |
| `subtitle` | string | Small line under "AgentTelecast" in the sidebar. |
| `timeZone` | string | IANA zone for the clock and "Data as of", e.g. `Europe/Berlin`. Default: the viewer's zone. |
| `timeZoneLabel` | string | Short label after times, e.g. `CET`. Default: worked out from `timeZone`. `""` hides it. |
| `scheduledDetail` | string | Caption on the "Scheduled jobs" tile. Default `Agent routines`. |
| `title` | string | Informational. |
| `meta.updatedAt` | string (ISO 8601 date-time) | When the data was produced. Shown as "Data as of". |

## Metric

| Field | Type | Notes |
|---|---|---|
| `value` | string or number | The big number. |
| `label` | string | What it counts. |
| `detail` | string | Small caption under the number. |
| `tone` | [Tone](#tones) | `warning` or `danger` colors the tile. |

## Section

| Field | Type | What it does |
|---|---|---|
| `heading` | string | **Required.** The text before the first comma becomes the sidebar label (`"Older asks, status unclear"` shows as "Older asks"). |
| `caption` | string | One line under the section title. |
| `items` | array of [Item](#item) | The cards. Sections with `views` or more than 60 items use compact rows instead of cards. |
| `views` | array of `{label, count?, items}` | Tabs inside the section (for example one per day). The first view is the default. |
| `filters` | array of strings | If present, adds a filter chip that narrows items by `title` (for example by agent). The first entry is the chip's name. |
| `notes` | array of `{tone, lead, text}` | Small info lines above the items. |
| `text` | string | Free text. Shown as a text card when the section has no items. |
| `icon` | string | Overrides the icon. One of `hourglass alert activity branch calendar list check repeat cpu archive moon grid users bot clock filter info pulse dot`. |
| `tone` | [Tone](#tones) | Overrides the section color. |
| `order` | number | Overrides the sort position (lower comes first). |
| `cols`, `parent` | | Informational, not shown. |

### How headings pick an icon, color and position

Sections are matched by their heading (case-insensitive, first match wins). Set `icon`, `tone` or
`order` on the section to override.

| Heading contains | Icon | Tone | Order |
|---|---|---|---|
| waiting | hourglass | warning | 1 |
| blocker | alert | danger | 2 |
| in progress | activity | accent | 3 |
| project | branch | accent | 4 |
| scheduled / jobs | calendar | accent | 5 |
| timeline | list | neutral | 6 |
| finished / done | check | success | 7 |
| routine | repeat | neutral | 8 |
| agent | cpu | neutral | 9 |
| older / unclear | archive | neutral | 10 |
| quiet | moon | neutral | 11 |
| anything else | dot | neutral | 50 |

## Item

| Field | Type | What it does |
|---|---|---|
| `title` | string | Card title, usually the agent or project name. |
| `lead` | string | Small line under the title (a time, a date, a short context). |
| `body` | string | Main text. Long text is clipped on the card and shown in full in the details drawer. |
| `status` | `{label, tone}` or `null` | Colored pill in the card corner, e.g. `{"label": "Needs you", "tone": "warning"}`. |
| `when` | string | Time with a clock icon, e.g. a next run. |
| `whenLabel` | string | Label for `when` in the details drawer, e.g. `Next run`. |
| `sub` | string | Second line under the body. |
| `fields` | array of `[key, value]` | Extra details in the drawer. Values already shown elsewhere on the card are skipped. |

## Tones

`accent` (blue), `success` (green), `warning` (amber), `danger` (red), `neutral` (gray).
Anything else is treated as `neutral`.

## KPI tiles

The row of tiles at the top is built like this, in order, and a tile is skipped when its source is missing:

1. **Waiting** — the metric whose label contains "waiting".
2. **Blockers** — the metric whose label contains "blocker".
3. **In progress** — the number of items in the section whose heading starts with "In progress".
4. **Cursor Projects** — the number of items in the section whose heading contains "Cursor project".
5. **Scheduled jobs** — the number of items in the section whose heading contains "Scheduled jobs".
6. **Agents active** — the metric whose label contains "agents active". A label that contains "bots active" still becomes this tile, so older feeds keep working. Extra words in the label (for example "since 6 AM") move into the caption. The short title stays "Agents active" or "Bots active", matching the feed.

The Overview page shows the summary plus the first four items of the "waiting" and "blocker" sections.

## Pointing it at your feed

Use one of these:

- **At build time:** `node build.cjs path/to/feed.json dist/index.html` bakes the data into one HTML file.
- **Fetched at runtime:** `node build.cjs --feed https://example.com/agenttelecast.json` builds a page that loads
  that URL every time it opens and looks there for new data every 5 minutes. The baked data is the fallback.
- **In a browser, without rebuilding:** open the page with `?data=<url>`, for example
  `index.html?data=https://example.com/agenttelecast.json`. That address is used for this visit only, unless you
  confirm **Save this data source?**. `?data=demo` shows the bundled demo for this visit, and does not clear a
  saved address unless you confirm. The **Data source** link at the bottom of the sidebar (browser layout only)
  saves the address you enter.

When the page fetches a feed from a different site, that server has to allow cross-origin requests
(send `Access-Control-Allow-Origin`). Serving the page and the feed from the same place avoids that.

If a feed can't be loaded or isn't valid, the page shows the baked data and a short notice at the bottom.

## Checking a feed

Any JSON Schema validator works, for example:

```sh
npx ajv-cli validate --spec=draft2020 -s docs/agenttelecast-feed.schema.json -d my-feed.json
```

Or build it, which fails with a readable message on a broken feed:

```sh
node web/build.cjs my-feed.json /tmp/check.html
```
