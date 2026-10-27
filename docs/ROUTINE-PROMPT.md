# Sample agent routine: write the AgentTelecast feed

AgentTelecast only shows what is in its JSON feed (see [DATA-FORMAT.md](DATA-FORMAT.md)). The easiest way
to keep that feed fresh is a scheduled routine in one of your SI agents (any assistant that can run on a schedule and
write a file) that gathers status from your other agents and writes the file.

Below is a prompt you can paste into a new routine and adjust. It uses generic wording on purpose:
replace the bracketed parts with your own agents, schedule and file location. Nothing in it refers to a
real account.

## Before you start

- Pick where the feed file lives. The page has to be able to fetch it: for example a folder served by
  a small web server on your home network, next to `index.html`. See
  [Pointing it at your feed](DATA-FORMAT.md#pointing-it-at-your-feed).
- Pick a schedule. Every 15 to 30 minutes during the day is plenty; the page re-checks the feed every
  5 minutes.
- Decide what the board may show. The feed is shown on a TV in your home, so leave out anything you
  would not want on a shared screen (passwords, account numbers, private messages in full).

## The routine prompt

```text
Every [30 minutes, 7 AM to 11 PM], build my AgentTelecast feed and save it.

1. Collect status from my agents: [list your agents or teams here, e.g. "Inbox agent, Calendar agent,
   Social agent"] and my Cursor cloud agents. Look at the last 5 days only.

2. Write one JSON file in the AgentTelecast feed format (docs/DATA-FORMAT.md). Use these sections,
   in this order, and leave a section out if it would be empty:
   - "Waiting for you": things an agent asked me and is still waiting on, newest first.
     One item per ask: title = agent name, lead = when it asked (short, like "Mon 9:42 AM"),
     body = the ask in one or two plain sentences, status = {"label": "Needs you", "tone": "warning"}.
   - "Blockers": work that can't move until something is fixed. Same item shape;
     status tone "danger" if it has been stuck more than a day, else "warning".
   - "In progress": what each agent is doing right now. status = {"label": "Running", "tone": "accent"}.
   - "Cursor Projects": one item per cloud agent run: title = project or repo name,
     body = what it is working on, status = Running / Finished / Failed,
     fields = [["PR", "#123"], ["Last update", "..."]] when known.
   - "Scheduled jobs": one item per routine: title = routine name, body = its schedule,
     when = next run time, whenLabel = "Next run", status = Enabled or Paused.
   - "Timeline, last 5 days": one view per day (label = "Mon Mar 2", items = that day's events),
     and filters = ["Agent", <each agent name>] so I can narrow it by agent.
   - "Finished": things completed in the last 24 hours.

3. Add the top-level fields:
   - "summary": two or three plain sentences about the last 5 days.
   - "metrics": at least {"value": <count>, "label": "Waiting on you", "tone": "warning"},
     {"value": <count>, "label": "Blockers", "tone": "danger"} and
     {"value": <count>, "label": "Agents active since <time>"}.
   - "timeZone": "[your IANA time zone, e.g. Europe/Berlin]".
   - "meta": {"updatedAt": <now, ISO 8601 with offset>}.

4. Rules:
   - Plain words, no internal IDs, tokens, passwords, account numbers or full email bodies.
   - Times are short and in my time zone.
   - Keep every body under about 300 characters.
   - The output must be valid JSON. If you can, check it against docs/agenttelecast-feed.schema.json.

5. Save it to [the file the page reads, e.g. agenttelecast.json in the folder your web server shares],
   replacing the old file. Write to a temporary file first and rename it, so the board never
   reads a half-written file.

6. If collecting from an agent fails, keep that agent's items from the previous feed and add a note
   to "Blockers" saying the update failed and when.
```

## Checking the result

Run the validator against what the routine wrote:

```sh
npx ajv-cli validate --spec=draft2020 -s docs/agenttelecast-feed.schema.json -d agenttelecast.json
```

Then open the page with `?data=<url of the file>` or set it in the app's setup screen. If the feed
is broken while the page is open, the page ignores it and keeps what it is showing. If it is broken
when the page first opens, the page shows its bundled data with a short notice at the bottom. Either
way a bad run never blanks the TV.

## Tips

- Start with just "Waiting for you" and "Blockers". They drive the Overview and the first two tiles.
- Section icons and colors come from the heading words (see the table in DATA-FORMAT.md), so keep
  the headings close to the ones above or set `icon` and `tone` yourself.
- Want a different look? See "Make it your own" in the main README.
