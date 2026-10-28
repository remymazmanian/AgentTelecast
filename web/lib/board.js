// AgentTelecast page builder. Pure functions, no dependencies: runs in Node (build scripts) and in the
// browser (loading a JSON feed at runtime). Feed format: docs/DATA-FORMAT.md.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AgentTelecast = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var ICONS = {
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    bot: '<path d="M12 4.6V7"/><circle cx="12" cy="3.4" r="1.3"/><rect x="4" y="7" width="16" height="12.5" rx="4"/><circle cx="9.2" cy="12.6" r="1.35" fill="currentColor" stroke="none"/><circle cx="14.8" cy="12.6" r="1.35" fill="currentColor" stroke="none"/><path d="M10 16.3h4M2 11.5v3.5M22 11.5v3.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2v3.5a5 5 0 0 0 10 0V2M7 22v-3.5a5 5 0 0 1 10 0V22"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    check: '<circle cx="12" cy="12" r="9.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3.5 2"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    branch: '<circle cx="6" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 7.5v9M18 10.5c0 4-4 5-9.5 6.5"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    archive: '<rect x="2.5" y="3.5" width="19" height="5" rx="1.5"/><path d="M4.5 8.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    filter: '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/>',
    pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
  };
  var TONES = ["accent", "success", "warning", "danger", "neutral"];
  // Section look-up by heading: icon, tone and display priority (lower = higher in the menu).
  var RULES = [
    [/waiting/i, "hourglass", "warning", 1], [/blocker/i, "alert", "danger", 2], [/in progress/i, "activity", "accent", 3],
    [/cursor project|project/i, "branch", "accent", 4], [/scheduled|jobs/i, "calendar", "accent", 5], [/timeline/i, "list", "neutral", 6],
    [/finished|done/i, "check", "success", 7], [/teammate routine|routine/i, "repeat", "neutral", 8], [/agent/i, "cpu", "neutral", 9],
    [/older|unclear/i, "archive", "neutral", 10], [/quiet/i, "moon", "neutral", 11],
  ];
  function rule(h) { for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(h)) return RULES[i]; return [null, "dot", "neutral", 50]; }
  function short(h) { return h.split(",")[0].trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ic(n) { return '<svg class="i" viewBox="0 0 24 24">' + (ICONS[n] || ICONS.dot) + "</svg>"; }
  function assign(a) { for (var i = 1; i < arguments.length; i++) { var b = arguments[i]; if (b) for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; } return a; }
  // 53-bit string hash (cyrb53), returned as 12 hex chars. Used for the page version when none is given.
  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    var n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return ("000000000000" + n.toString(16)).slice(-12);
  }
  // Data refresh interval in minutes. 0 = off. Anything else in a feed is ignored.
  var REFRESH = [0, 1, 5, 15, 30, 60], REFRESH_DEFAULT = 5;
  function refreshMin(v) { var n = v === "off" ? 0 : parseInt(v, 10); return REFRESH.indexOf(n) >= 0 ? n : null; }
  function refreshText(m) { return m === 0 ? "Auto-refresh off" : m === 60 ? "Looks for new data every hour" : m === 1 ? "Looks for new data every minute" : "Looks for new data every " + m + " min"; }
  function tzShort(tz, d) {
    try {
      var p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(d || new Date());
      for (var i = 0; i < p.length; i++) if (p[i].type === "timeZoneName") return p[i].value.replace(/^(P|M|C|E)[SD]T$/, "$1T");
    } catch (e) {}
    return "";
  }

  // Validates the feed loosely and fills defaults. Throws Error with a readable message on bad input.
  function normalize(feed) {
    if (!feed || typeof feed !== "object" || Array.isArray(feed)) throw new Error("Feed must be a JSON object");
    if (!Array.isArray(feed.sections)) throw new Error('Feed is missing "sections" (array)');
    var str = function (v) { return v == null ? "" : String(v); };
    var item = function (it, where) {
      if (!it || typeof it !== "object") throw new Error(where + ": each item must be an object");
      var o = { title: str(it.title), lead: str(it.lead), body: str(it.body), status: null, fields: [] };
      if (it.status && typeof it.status === "object" && it.status.label) o.status = { label: str(it.status.label), tone: TONES.indexOf(it.status.tone) >= 0 ? it.status.tone : "neutral" };
      if (Array.isArray(it.fields)) o.fields = it.fields.filter(function (f) { return Array.isArray(f) && f.length >= 2; }).map(function (f) { return [str(f[0]), str(f[1])]; });
      if (it.when) o.when = str(it.when);
      if (it.whenLabel) o.whenLabel = str(it.whenLabel);
      if (it.sub) o.sub = str(it.sub);
      return o;
    };
    var sections = feed.sections.map(function (s, i) {
      if (!s || typeof s !== "object" || !s.heading) throw new Error("sections[" + i + '] needs a "heading"');
      var where = "sections[" + i + "] (" + s.heading + ")";
      var o = { heading: str(s.heading), caption: str(s.caption), notes: [], text: str(s.text), items: (s.items || []).map(function (it) { return item(it, where); }), cols: Array.isArray(s.cols) ? s.cols.map(str) : [], filters: Array.isArray(s.filters) ? s.filters.map(str) : [] };
      if (Array.isArray(s.notes)) o.notes = s.notes.map(function (n) { return { tone: n && n.tone ? str(n.tone) : "neutral", lead: str(n && n.lead), text: str(n && n.text) }; });
      if (Array.isArray(s.views) && s.views.length) {
        o.views = s.views.map(function (v) { var its = (v.items || []).map(function (it) { return item(it, where); }); return { label: str(v.label), count: v.count != null ? Number(v.count) : its.length, items: its }; });
        if (!o.items.length) o.items = o.views[0].items;
      }
      if (s.parent) o.parent = str(s.parent);
      if (s.icon) o.icon = str(s.icon);
      if (TONES.indexOf(s.tone) >= 0) o.tone = s.tone;
      if (s.order != null && isFinite(s.order)) o.order = Number(s.order);
      return o;
    });
    var metrics = (Array.isArray(feed.metrics) ? feed.metrics : []).map(function (m) { return { value: str(m.value), label: str(m.label), detail: str(m.detail), tone: m.tone ? str(m.tone) : undefined }; });
    return assign({}, feed, { summary: str(feed.summary), sources: Array.isArray(feed.sources) ? feed.sources.map(str) : [], metrics: metrics, sections: sections, meta: feed.meta && typeof feed.meta === "object" ? feed.meta : {} });
  }

  // Builds everything the page needs from a feed. opts: subtitle, scheduledDetail, timeZone, tzLabel,
  // storageKey, version (else hashed from the feed + opts.versionSalt).
  function build(feedIn, opts) {
    opts = opts || {};
    var model = normalize(feedIn), meta = model.meta;
    var tz = opts.timeZone || model.timeZone || meta.timeZone || (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
    var updated = meta.updatedAt ? new Date(meta.updatedAt) : null;
    if (updated && isNaN(updated.getTime())) updated = null;
    var tzLabel = opts.tzLabel != null ? opts.tzLabel : model.timeZoneLabel != null ? String(model.timeZoneLabel) : tzShort(tz, updated);
    var sfx = tzLabel ? " " + tzLabel : "";
    var fmt = function (d, o) { return new Intl.DateTimeFormat("en-US", assign({ timeZone: tz }, o)).format(d); };
    var asOf = updated ? fmt(updated, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + sfx : "unknown";
    var asOfShort = updated ? "As of " + fmt(updated, { hour: "numeric", minute: "2-digit" }) + sfx : "";

    var secs = model.sections.map(function (s, i) {
      var r = rule(s.heading);
      var kind = s.items.length || s.views ? "list" : s.text ? "text" : "list";
      var n = s.views ? s.views[0].items.length : s.items.length;
      var prio = (s.order != null ? s.order : r[3]) * 100 + i;
      return assign({}, s, { label: short(s.heading), icon: s.icon && ICONS[s.icon] ? s.icon : r[1], tone: s.tone || r[2], prio: prio, kind: kind, layout: s.views || n > 60 ? "rows" : "cards" });
    }).sort(function (a, b) { return a.prio - b.prio; });
    secs.forEach(function (s) { delete s.order; });

    var find = function (re) { for (var i = 0; i < secs.length; i++) if (re.test(secs[i].heading)) return secs[i]; return null; };
    var groups = [find(/waiting/i), find(/blocker/i)].filter(Boolean).map(function (s) { return { label: s.label, icon: s.icon, tone: s.tone, items: s.items.slice(0, 4) }; });
    var nav = [{ heading: "Overview", label: "Overview", icon: "grid", tone: "accent", kind: "overview", groups: groups, caption: "" }].concat(secs);
    var navIdx = function (re) { for (var i = 0; i < nav.length; i++) if (re.test(nav[i].heading)) return i; return -1; };

    // KPI tiles: feed metrics first, then counts taken from the feed's own lists.
    var kpis = [];
    var mFind = function (re) { for (var i = 0; i < model.metrics.length; i++) if (re.test(model.metrics[i].label)) return model.metrics[i]; return null; };
    var addMetric = function (re, icon, tone, target) { var m = mFind(re); if (m) kpis.push({ label: m.label.replace(/ on you$/i, ""), value: m.value, detail: m.detail || "", icon: icon, tone: m.tone === "danger" ? "danger" : m.tone === "warning" ? "warning" : tone, target: target }); };
    var addCount = function (re, label, icon, tone, detail) { var i = navIdx(re); if (i > 0) kpis.push({ label: label, value: String(nav[i].items.length), detail: detail, icon: icon, tone: tone, target: i }); };
    addMetric(/waiting/i, "hourglass", "warning", navIdx(/waiting/i));
    addMetric(/blocker/i, "alert", "danger", navIdx(/blocker/i));
    addCount(/^in progress/i, "In progress", "activity", "accent", "Open work items");
    addCount(/cursor project/i, "Cursor Projects", "branch", "accent", "Cloud agents listed");
    addCount(/scheduled jobs/i, "Scheduled jobs", "calendar", "neutral", opts.scheduledDetail || model.scheduledDetail || "Agent routines");
    addMetric(/agents active|bots active/i, "users", "success", -1);
    kpis.forEach(function (k) { if (k.label.length > 18 && /agents active|bots active/i.test(k.label)) { var word = /bots active/i.test(k.label) ? "Bots active" : "Agents active"; k.detail = k.label.replace(/^(agents|bots) active\s*/i, "").replace(/^since/i, "Since") + (k.detail ? " · " + k.detail : ""); k.label = word; } });

    var version = opts.version || hash(JSON.stringify([feedIn, opts.versionSalt || ""]));
    var note = String(meta.updateNote || meta.nextUpdate || "").trim().slice(0, 120);
    var M = { version: version, summary: model.summary, sources: model.sources, asOf: asOf, asOfShort: asOfShort, nav: nav, icons: ICONS, tz: tz, tzLabel: tzLabel, storageKey: opts.storageKey || "agenttelecast.v1", refreshMinutes: refreshMin(meta.refreshMinutes), updateNote: note };
    var kpiHtml = kpis.map(function (k, i) { return '<div class="kpi t-' + k.tone + (k.target > 0 ? " f" : "") + '" data-zone="kpi" data-id="k' + i + '" data-target="' + (k.target > 0 ? k.target : "") + '"><div class="kl">' + ic(k.icon) + esc(k.label) + '</div><div class="kv">' + esc(k.value) + '</div><div class="kd">' + esc(k.detail) + "</div></div>"; }).join("");
    var subtitle = opts.subtitle != null ? opts.subtitle : model.subtitle != null ? String(model.subtitle) : "";
    return { M: M, kpis: kpis, kpiHtml: kpiHtml, asOf: asOf, version: version, subtitle: subtitle, sections: nav.length };
  }

  // Footer refresh line. The page script swaps in the viewer's saved choice when it starts.
  function footRefresh(M) {
    var m = M.refreshMinutes != null ? M.refreshMinutes : REFRESH_DEFAULT;
    return '<button type="button" class="rf f" data-zone="rf" data-id="rf">' + esc(refreshText(m)) + "</button>" + (M.updateNote ? '<span class="rnote">' + esc(M.updateNote) + "</span>" : "");
  }

  // Full HTML page. assets: { css (font already inlined), tvjs, boardjs (this file, for the feed loader),
  // fallbackFeed (object; bundled so a feed URL that fails still shows something) }.
  function page(r, assets, opts) {
    opts = opts || {};
    var data = JSON.stringify(r.M).replace(/</g, "\\u003c");
    // Inline scripts must never contain a literal closing script tag, or the browser ends the block early.
    var js = function (t) { return String(t).replace(/<\/(script)/gi, "<\\/$1"); };
    var loader = opts.loader ? "<script>" + js(assets.boardjs) + "<\/script><script>window.__BB_OPTS__=" + JSON.stringify(opts.loaderOpts || {}).replace(/</g, "\\u003c") + ";<\/script><script>" + js(assets.loaderjs) + "<\/script>" : "<script>window.__BB_START__();<\/script>";
    var csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'self\' http: https: file:; base-uri \'none\'; form-action \'none\'">';
    var head = '<meta name="robots" content="noindex,nofollow"><title>AgentTelecast</title>';
    // Share tags are opt-in (--public-url) for a public demo. Every build stays noindex, with no canonical.
    if (opts.publicUrl) {
      var shareTitle = "AgentTelecast demo: dashboard for your SI agents";
      var shareDesc = "Demo board with sample data. AgentTelecast is an open-source dashboard for SI agents, built for the TV remote. Runs in any browser or on Android TV.";
      var shareAlt = "AgentTelecast dashboard on a TV with the tagline: open-source dashboard for your SI agents, built for the TV remote";
      head = '<meta name="robots" content="noindex,nofollow"><title>' + esc(shareTitle) + "</title>" +
        '<meta name="description" content="' + esc(shareDesc) + '">' +
        '<meta property="og:type" content="website">' +
        '<meta property="og:site_name" content="AgentTelecast">' +
        '<meta property="og:title" content="' + esc(shareTitle) + '">' +
        '<meta property="og:description" content="' + esc(shareDesc) + '">' +
        '<meta property="og:url" content="' + esc(opts.publicUrl) + '">' +
        '<meta property="og:image" content="' + esc(opts.shareImage || "") + '">' +
        '<meta property="og:image:width" content="1200">' +
        '<meta property="og:image:height" content="630">' +
        '<meta property="og:image:alt" content="' + esc(shareAlt) + '">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '<meta name="twitter:site" content="@remymazmanian">' +
        '<meta name="twitter:title" content="' + esc(shareTitle) + '">' +
        '<meta name="twitter:description" content="' + esc(shareDesc) + '">';
    }
    return '<!doctype html><html lang="en" data-version="' + r.version + '"><head><meta charset="utf-8"><meta name="viewport" content="width=1920">\n' +
      csp + "\n" +
      '<script>(function(){var u=navigator.userAgent,q=location.search;var tv=/[?&]tv=1/.test(q)||(!/[?&]tv=0/.test(q)&&/AgentTelecastTV|Android TV|SHIELD|AFT[A-Z]|BRAVIA|GoogleTV/i.test(u));if(tv){document.documentElement.className="tv"}else{document.documentElement.className="web";var m=document.querySelector("meta[name=viewport]");m.setAttribute("content","width=device-width, initial-scale=1, viewport-fit=cover")}})()<\/script>\n' +
      head + '<style>' + assets.css + "</style></head>\n<body>\n" +
      '<aside class="rail">\n  <div class="brand"><div class="mark"><svg class="gbot" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 11V7" stroke="#8fb4ff" stroke-width="2.2" stroke-linecap="round"/><circle cx="24" cy="5.6" r="2.6" fill="#4f8dff"/><rect x="4.6" y="21" width="3.6" height="9" rx="1.8" fill="#8fb4ff"/><rect x="39.8" y="21" width="3.6" height="9" rx="1.8" fill="#8fb4ff"/><rect x="8" y="11" width="32" height="29" rx="9" fill="#4f8dff"/><rect x="12" y="17" width="24" height="13.5" rx="5" fill="#0b1020"/><g class="look"><g class="blink"><circle cx="19" cy="23.75" r="2.7" fill="#7cf0d6"/><circle cx="29" cy="23.75" r="2.7" fill="#7cf0d6"/></g></g><rect x="19" y="33.6" width="10" height="2.4" rx="1.2" fill="#0b1020" opacity=".55"/></svg></div><div><h1>AgentTelecast</h1><p>' + esc(r.subtitle) + "</p></div></div>\n" +
      '  <nav class="nav"><div class="nav-in"></div></nav>\n' +
      '  <div class="foot"><div class="clock"></div><div class="date"></div><div class="asof"><span class="live"></span>Data as of <b>' + esc(r.asOf) + "</b><br>" + footRefresh(r.M) + "</div></div>\n</aside>\n" +
      '<main class="main"><div class="kpis">' + r.kpiHtml + '</div><div class="content" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></main>\n' +
      '<div class="scrim"></div><aside class="drawer"></aside>\n' +
      "<script>window.__MODEL__=" + data + ";window.__BB_START__=function(){" + js(assets.tvjs) + "};<\/script>" + loader + "\n</body></html>";
  }

  return { ICONS: ICONS, RULES: RULES, REFRESH: REFRESH, normalize: normalize, build: build, page: page, hash: hash, esc: esc, refreshText: refreshText };
});
