#!/usr/bin/env node
// Builds a standalone AgentTelecast page (one HTML file, no server code needed).
// Usage: node build.cjs [feed.json] [out.html] [--feed URL] [--freeze-clock ISO-TIME]
//        [--storage-key NAME] [--public-url ABSOLUTE-URL] [--demo]
//   feed.json        data baked into the page; default demo/demo-data.json
//   out.html         default dist/index.html
//   --feed URL       the page loads this JSON feed at runtime (baked data is the fallback)
//   --freeze-clock   pin the on-screen clock (used for screenshots)
//   --storage-key    view-state localStorage key (default agenttelecast.v1). A custom key is not migrated.
//   --public-url     absolute http(s) URL of this page. Opt-in share tags for a public demo.
//                    og:image is share-1200x630.png next to that URL. noindex stays; no canonical.
//   --demo           so `node build.cjs --demo --public-url <url>` works. Demo data is already the default.
const fs = require("fs");
const path = require("path");
const BB = require("./lib/board.js");
const args = process.argv.slice(2), pos = [], flags = {};
const BOOL_FLAGS = new Set(["demo"]);
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const name = args[i].slice(2);
    if (BOOL_FLAGS.has(name)) flags[name] = true;
    else {
      const v = args[++i];
      if (v == null || v.startsWith("--")) { console.error("missing value for --" + name); process.exit(2); }
      flags[name] = v;
    }
  } else pos.push(args[i]);
}
const feedPath = path.resolve(pos[0] || path.join(__dirname, "demo", "demo-data.json"));
const outPath = path.resolve(pos[1] || path.join(__dirname, "dist", "index.html"));
const rd = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");

const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
const font = fs.readFileSync(path.join(__dirname, "assets", "inter-sub.woff")).toString("base64");
const css = rd("tv.css").replace("__FONT__", font).replace(/\/\*[\s\S]*?\*\//g, "");
let tvjs = rd("tv.js");
if (flags["freeze-clock"]) {
  const t = new Date(flags["freeze-clock"]);
  if (isNaN(t)) { console.error("bad --freeze-clock time"); process.exit(2); }
  const anchor = "var d = new Date(), o =";
  if (!tvjs.includes(anchor)) { console.error("clock anchor missing in tv.js"); process.exit(1); }
  tvjs = tvjs.replace(anchor, `var d = new Date(${JSON.stringify(t.toISOString())}), o =`);
}
const boardjs = rd("lib/board.js"), loaderjs = rd("lib/loader.js");
const opts = { storageKey: flags["storage-key"] || "agenttelecast.v1" };
opts.versionSalt = BB.hash(JSON.stringify([tvjs, css, boardjs, loaderjs]));
let publicUrl = "";
let shareImage = "";
if (flags["public-url"]) {
  publicUrl = String(flags["public-url"]).trim();
  if (!/^https?:\/\//i.test(publicUrl)) { console.error("--public-url must be an absolute http or https URL"); process.exit(2); }
  const dir = publicUrl.endsWith("/") ? publicUrl : publicUrl + "/";
  shareImage = new URL("share-1200x630.png", dir).href;
}
const r = BB.build(feed, opts);
const html = BB.page(r, { css, tvjs, boardjs, loaderjs }, { loader: true, loaderOpts: { feed: flags.feed || "", storageKey: opts.storageKey }, publicUrl, shareImage });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`wrote ${path.relative(process.cwd(), outPath)} (${(html.length / 1024).toFixed(0)} KB), version ${r.version}, data as of ${r.asOf}, ${r.sections} sections, ${r.kpis.length} KPI tiles`);
