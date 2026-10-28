// AgentTelecast feed loader (browser). Decides where the data comes from, in this order:
//   1. ?data=<url>  (this visit only, unless you confirm saving it; ?data=demo uses the bundled demo)
//   2. the URL saved earlier from the "Data source" panel, or from a confirmed ?data= link
//   3. window.__BB_OPTS__.feed (set at build time with build.cjs --feed)
//   4. the data baked into this page (demo data by default)
// If a feed URL fails, the baked-in data is shown with a short notice.
(function () {
  "use strict";
  var O = window.__BB_OPTS__ || {}, KEY = "agenttelecast.feed", BB = window.AgentTelecast, root = document.documentElement;
  var WEB = root.classList.contains("web"), SALT = root.getAttribute("data-version") || "";
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  // Default feed key only. The view-state key is separate and is migrated in tv.js.
  if (!ls(KEY)) { var legacyFeed = ls("botboard.feed"); if (legacyFeed) { ls(KEY, legacyFeed); ls("botboard.feed", null); } }
  var q = null; try { q = new URLSearchParams(location.search).get("data"); } catch (e) {}
  var fromQuery = q !== null;
  var queryUrl = fromQuery ? (q === "" || q === "demo" ? "" : q) : "";
  var saved = ls(KEY) || "";
  // null means "don't ask". A string, including "", is the value to store after confirm.
  var pendingSave = fromQuery && queryUrl !== saved ? queryUrl : null;
  var url = fromQuery ? queryUrl : (saved || O.feed || "");
  var current = url;

  function bust(u) { return u + (u.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now(); }
  function get(u, cb) {
    var x = new XMLHttpRequest();
    try { x.open("GET", bust(u), true); } catch (e) { return cb(e.message || "Bad URL"); }
    x.timeout = 15000;
    x.onload = function () {
      if (x.status !== 200 && !(x.status === 0 && x.responseText)) return cb("HTTP " + x.status);
      var f; try { f = JSON.parse(x.responseText); } catch (e) { return cb("Not valid JSON"); }
      cb(null, f, x.responseText);
    };
    x.onerror = function () { cb("Could not reach it (offline, wrong address, or the server does not allow cross-origin requests)"); };
    x.ontimeout = function () { cb("Timed out after 15 s"); };
    x.send();
  }
  function opts() { return { subtitle: O.subtitle, scheduledDetail: O.scheduledDetail, timeZone: O.timeZone, tzLabel: O.tzLabel, storageKey: O.storageKey, versionSalt: SALT }; }
  function apply(r) {
    window.__MODEL__ = r.M;
    root.setAttribute("data-version", r.version);
    var k = document.querySelector(".kpis"); if (k) k.innerHTML = r.kpiHtml;
    var u = document.querySelector(".asof .upd"); if (u) u.textContent = r.footLine;
    var p = document.querySelector(".brand p"); if (p) p.textContent = r.subtitle;
  }
  function start() { window.__BB_START__(); if (WEB) addSourceLink(); }

  function notice(msg) {
    var n = document.createElement("div");
    n.className = "bb-notice";
    n.setAttribute("role", "status");
    n.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;max-width:min(720px,92vw);background:#2a1d0b;color:#ffd99a;border:1px solid #6b4b14;border-radius:12px;padding:12px 18px;font:500 15px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)";
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 12000);
  }

  // ---------- "Data source" panel (browser mode only; the TV layout never shows it) ----------
  function addSourceLink() {
    var foot = document.querySelector(".foot .asof"); if (!foot) return;
    var a = document.createElement("button");
    a.type = "button"; a.className = "bb-src";
    a.style.cssText = "display:block;margin-top:8px;padding:0;background:none;border:0;color:var(--acc);font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px";
    a.textContent = "Data source: " + (current ? "your feed" : "demo data");
    a.title = current || "Bundled demo data";
    a.addEventListener("click", function (e) { e.stopPropagation(); openPanel(); });
    foot.appendChild(a);
  }
  function openPanel() {
    if (document.querySelector(".bb-panel")) return;
    var wrap = document.createElement("div");
    wrap.className = "bb-panel";
    wrap.style.cssText = "position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";
    wrap.innerHTML = '<form style="width:min(560px,100%);background:var(--panel2,#121722);color:var(--txt,#eef1f6);border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:16px;padding:22px;font:15px/1.45 Inter,system-ui,sans-serif">' +
      '<div style="font-size:20px;font-weight:700;margin-bottom:6px">Data source</div>' +
      '<div style="color:var(--txt2,#b4bccb);margin-bottom:14px">Paste the URL of an AgentTelecast JSON feed. It is saved in this browser only. Feeds on another site must allow cross-origin (CORS) requests.</div>' +
      '<input name="u" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/agenttelecast.json" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--line2,#333);background:var(--bg,#06080c);color:inherit;font:inherit">' +
      '<div class="bb-err" style="min-height:22px;margin-top:8px;color:var(--bad,#ff5c5c)"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:6px">' +
      '<button type="button" data-a="demo" style="' + btn(false) + '">Use demo data</button>' +
      '<button type="button" data-a="cancel" style="' + btn(false) + '">Cancel</button>' +
      '<button type="submit" style="' + btn(true) + '">Load</button></div></form>';
    document.body.appendChild(wrap);
    var f = wrap.querySelector("form"), inp = f.u, err = wrap.querySelector(".bb-err");
    inp.value = current || "";
    // keep the board's remote/keyboard handler from reacting while typing
    wrap.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); e.stopPropagation(); }, true);
    wrap.addEventListener("click", function (e) { e.stopPropagation(); if (e.target === wrap) close(); var a = e.target.getAttribute && e.target.getAttribute("data-a"); if (a === "cancel") close(); if (a === "demo") { ls(KEY, null); go(""); } });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var u = inp.value.trim();
      if (!u) { err.textContent = "Enter a URL, or choose Use demo data."; return; }
      try { u = new URL(u, location.href).href; } catch (x) { err.textContent = "That does not look like a URL."; return; }
      if (!/^https?:|^file:/.test(u)) { err.textContent = "Use an http:// or https:// address."; return; }
      err.style.color = "var(--txt2,#b4bccb)"; err.textContent = "Checking…";
      get(u, function (e2, feed) {
        err.style.color = "var(--bad,#ff5c5c)";
        if (e2) { err.textContent = "Could not load it: " + e2; return; }
        try { BB.build(feed, opts()); } catch (x) { err.textContent = "Loaded, but it is not an AgentTelecast feed: " + x.message; return; }
        ls(KEY, u); go(u);
      });
    });
    setTimeout(function () { inp.focus(); }, 0);
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
  }
  function btn(primary) { return "padding:10px 16px;border-radius:10px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid " + (primary ? "transparent;background:var(--acc,#4f8dff);color:#fff" : "var(--line2,#333);background:transparent;color:inherit"); }
  function go(u) {
    var s = location.search.replace(/([?&])data=[^&]*(&|$)/, "$1").replace(/[?&]$/, "");
    location.href = location.pathname + s + location.hash;
  }
  // ?data= is for this visit unless the viewer confirms. Nothing is written until then.
  function askSave(next) {
    if (document.querySelector(".bb-save")) return;
    var wrap = document.createElement("div");
    wrap.className = "bb-save";
    wrap.setAttribute("role", "presentation");
    wrap.style.cssText = "position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px";
    wrap.innerHTML = '<div role="dialog" aria-labelledby="bb-save-title" style="width:min(560px,100%);background:var(--panel2,#121722);color:var(--txt,#eef1f6);border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:16px;padding:22px;font:15px/1.45 Inter,system-ui,sans-serif">' +
      '<div id="bb-save-title" style="font-size:20px;font-weight:700;margin-bottom:6px">Save this data source?</div>' +
      '<div class="bb-save-detail" style="color:var(--txt2,#b4bccb);margin-bottom:14px;word-break:break-word"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:6px">' +
      '<button type="button" data-a="skip" style="' + btn(false) + '">Just this visit</button>' +
      '<button type="button" data-a="save" style="' + btn(true) + '"></button></div></div>';
    document.body.appendChild(wrap);
    var detail = wrap.querySelector(".bb-save-detail");
    var saveBtn = wrap.querySelector("[data-a=save]");
    if (next) {
      detail.textContent = "This link uses a data source for this visit only. Save it in this browser? " + next;
      saveBtn.textContent = "Save this data source";
    } else {
      detail.textContent = "This link uses the bundled demo for this visit only. Remove the saved data source from this browser?";
      saveBtn.textContent = "Remove saved source";
    }
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    wrap.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); e.stopPropagation(); }, true);
    wrap.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target === wrap) { close(); return; }
      var a = e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "skip") close();
      if (a === "save") { ls(KEY, next ? next : null); close(); }
    });
    setTimeout(function () { var b = wrap.querySelector("[data-a=skip]"); if (b) b.focus(); }, 0);
  }
  function maybeAsk() { if (pendingSave !== null) askSave(pendingSave); }

  // ---------- boot ----------
  if (!url) { start(); maybeAsk(); return; }
  root.style.visibility = "hidden";
  get(url, function (err, feed) {
    var r = null, why = err;
    if (!err) { try { r = BB.build(feed, opts()); } catch (e) { why = "not an AgentTelecast feed (" + e.message + ")"; } }
    if (r) apply(r);
    root.style.visibility = "";
    start();
    if (!r) notice("Could not load the data feed (" + why + "). Showing the bundled data instead.");
    else {
      window.__BB_CHECK__ = function (ver, onNew) {
        get(url, function (e, f) { if (e) return; try { var n = BB.build(f, opts()); if (n.version !== ver) onNew(); } catch (x) {} });
      };
      maybeAsk();
    }
  });
})();
