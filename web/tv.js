(function () {
  "use strict";
  var M = window.__MODEL__;
  var KEY = M.storageKey || "agenttelecast.v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var I = M.icons;
  var WEB = document.documentElement.classList.contains("web");
  var root = document.documentElement;
  var icon = function (n) { return '<svg class="i" viewBox="0 0 24 24">' + (I[n] || I.dot) + "</svg>"; };

  // ---------- state ----------
  var st = { sec: 0, view: 0, filter: "", focus: null, open: false, pendingReload: false };
  // Restore place after a reload. Same version: trust saved indexes. Different version (data changed):
  // re-resolve section/view by label, keep the filter only if that value still exists, and let boot
  // re-find the focused card by its content fingerprint. Anything that no longer exists falls back.
  try {
    // Default view-state key only. A custom --storage-key is not migrated.
    if (KEY === "agenttelecast.v1" && !localStorage.getItem(KEY)) {
      var legacyView = localStorage.getItem("botboard.v1");
      if (legacyView) {
        localStorage.setItem(KEY, legacyView);
        localStorage.removeItem("botboard.v1");
      }
    }
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.version === M.version) { st.sec = saved.sec | 0; st.view = saved.view | 0; st.filter = saved.filter || ""; st.restore = saved.focus; }
    else if (saved) {
      var si = -1;
      if (saved.secLabel) M.nav.forEach(function (n, i) { if (si < 0 && n.label === saved.secLabel) si = i; });
      if (si < 0 && !saved.secLabel) si = saved.sec | 0;
      if (si >= 0 && si < M.nav.length) {
        st.sec = si;
        var ss = M.nav[si], vi = 0;
        if (ss.views && ss.views.length) {
          vi = -1;
          if (saved.viewLabel != null) ss.views.forEach(function (v, i) { if (vi < 0 && v.label === saved.viewLabel) vi = i; });
          if (vi < 0) vi = (saved.view | 0) < ss.views.length && saved.viewLabel == null ? saved.view | 0 : 0;
        }
        st.view = vi;
        if (saved.filter && ss.filters && ss.filters.length) {
          var base0 = ss.views ? ss.views[vi].items : ss.items || [];
          if (base0.some(function (it) { return it.title === saved.filter; })) st.filter = saved.filter;
        }
        if (vi === (saved.view | 0) || saved.viewLabel != null) st.restore = saved.focus;
        st.restoreFp = saved.fp || null;
      }
    }
  } catch (e) {}
  var lastMain = {};
  function save() {
    try {
      var s = M.nav[st.sec] || {};
      localStorage.setItem(KEY, JSON.stringify({ version: M.version, sec: st.sec, view: st.view, filter: st.filter, focus: focusKey(cur),
        secLabel: s.label, viewLabel: s.views && s.views[st.view] ? s.views[st.view].label : null, fp: fingerprint(cur) }));
    } catch (e) {}
  }
  // Content identity of a focused card/row (indexes shift when data changes; titles + time do not).
  function fpPart(el, sel) { var x = el.querySelector(sel); return x ? x.textContent.trim() : ""; }
  function fingerprint(el) {
    if (!el || el.getAttribute("data-zone") !== "main" || !el.hasAttribute("data-idx")) return null;
    return { g: el.getAttribute("data-g"), t: fpPart(el, ".ctitle") || fpPart(el, ".rb"), l: fpPart(el, ".clead") || fpPart(el, ".rt"), b: fpPart(el, ".cbody") || fpPart(el, ".rx") };
  }
  function findByFingerprint(fp) {
    if (!fp || !fp.t) return null;
    var els = $$('.f[data-zone="main"][data-idx]').filter(function (e) { return e.getAttribute("data-g") === fp.g; }), m;
    var tiers = [function (f) { return f.t === fp.t && f.l === fp.l && f.b === fp.b; }, function (f) { return f.t === fp.t && f.l === fp.l; }, function (f) { return f.t === fp.t; }];
    for (var k = 0; k < tiers.length; k++) {
      m = els.filter(function (e) { return tiers[k](fingerprint(e)); });
      if (m.length === 1 || (m.length > 1 && k < 2)) return m[0];
    }
    return null;
  }
  function focusKey(el) { if (!el) return null; return { zone: el.getAttribute("data-zone"), id: el.getAttribute("data-id") }; }

  // ---------- data helpers ----------
  function secData(i) { return M.nav[i]; }
  function itemsOf(s) {
    var items = s.views ? s.views[Math.min(st.view, s.views.length - 1)].items : s.items || [];
    if (st.filter && s.filters && s.filters.length) items = items.filter(function (it) { return it.title === st.filter; });
    return items;
  }

  // ---------- rendering ----------
  function renderNav() {
    $(".nav-in").innerHTML = M.nav.map(function (s, i) {
      var n = s.kind === "overview" ? "" : s.kind === "text" ? "" : (s.views ? s.views[0].items.length : s.items.length);
      return '<div class="ni f t-' + s.tone + (i === st.sec ? " sel" : "") + '" data-zone="nav" data-id="nav' + i + '" data-sec="' + i + '">' + icon(s.icon) + '<span class="lbl">' + esc(s.label) + '</span><span class="cnt">' + n + "</span></div>";
    }).join("");
  }
  function card(it, sec, idx) {
    var tone = it.status ? it.status.tone : sec.tone;
    var h = '<div class="card f t-' + tone + '" data-zone="main" data-id="c' + idx + '" data-idx="' + idx + '">';
    h += '<div class="ct"><span class="ctitle">' + esc(it.title || it.body) + "</span>" + (it.status ? '<span class="pill t-' + it.status.tone + '">' + esc(it.status.label) + "</span>" : "") + "</div>";
    if (it.lead) h += '<div class="clead">' + esc(it.lead) + "</div>";
    if (it.title && it.body) h += '<div class="cbody">' + esc(it.body) + "</div>";
    if (it.sub) h += '<div class="csub">' + esc(it.sub) + "</div>";
    if (it.when) h += '<div class="when">' + icon("clock") + esc(it.when) + "</div>";
    return h + "</div>";
  }
  function row(it, idx) {
    var parts = (it.lead || "").split(" · ");
    var time = parts.length > 1 ? parts.slice(1).join(" · ") : parts[0];
    return '<div class="row f" data-zone="main" data-id="c' + idx + '" data-idx="' + idx + '"><span class="rt">' + esc(time) + '</span><span class="rb">' + esc(it.title) + '</span><span class="rx">' + esc(it.body) + "</span></div>";
  }
  function renderMain() {
    var s = secData(st.sec);
    var h = '<div class="sh"><h2>' + esc(s.heading) + "</h2>";
    var items = s.kind === "list" ? itemsOf(s) : [];
    if (s.kind === "list") h += '<span class="n">' + items.length + (items.length === 1 ? " item" : " items") + "</span>";
    h += "</div>";
    if (s.caption) h += '<p class="cap">' + esc(s.caption) + "</p>";
    if (s.views || (s.filters && s.filters.length)) {
      h += '<div class="chips">';
      if (s.views) s.views.forEach(function (v, i) { h += '<div class="chip f' + (i === st.view ? " on" : "") + '" data-zone="main" data-id="v' + i + '" data-view="' + i + '">' + esc(v.label) + ' <span class="c">' + v.count + "</span></div>"; });
      if (s.filters && s.filters.length) h += '<div class="chip filter f' + (st.filter ? " on" : "") + '" data-zone="main" data-id="flt" data-filter="1">' + icon("filter") + esc(s.filters[0]) + ": " + esc(st.filter || "All") + "</div>";
      h += "</div>";
    }
    (s.notes || []).forEach(function (n) { h += '<div class="note">' + icon("info") + "<div>" + (n.lead ? "<b>" + esc(n.lead) + "</b> " : "") + esc(n.text) + "</div></div>"; });
    h += '<div class="scroll"><div class="sc-in">';
    if (s.kind === "overview") {
      h += '<div class="ov"><div class="card f wide t-accent" data-zone="main" data-id="sum" data-text="summary"><div class="ct"><span class="ctitle">Summary</span><span class="pill t-accent">' + esc(M.asOfShort) + '</span></div><div class="summary" style="margin-top:12px">' + esc(M.summary) + "</div></div>";
      s.groups.forEach(function (g, gi) {
        h += '<div style="--o:' + (gi * 1000) + '"><div class="ovh" style="color:var(--' + (g.tone === "danger" ? "bad" : g.tone === "warning" ? "warn" : "acc") + ')">' + icon(g.icon) + esc(g.label) + "</div></div>";
      });
      var maxN = Math.max.apply(null, s.groups.map(function (g) { return g.items.length; }));
      for (var r = 0; r < maxN; r++) s.groups.forEach(function (g, gi) {
        var it = g.items[r];
        h += it ? card(it, { tone: g.tone }, gi * 100 + r).replace('data-idx="' + (gi * 100 + r) + '"', 'style="--o:' + (gi * 1000 + r + 1) + '" data-g="' + gi + '" data-idx="' + r + '"') : "<div></div>";
      });
      h += "</div>";
    } else if (s.kind === "text") {
      h += '<div class="card f t-neutral" data-zone="main" data-id="txt" data-text="sec"><div class="textcard">' + esc(s.text) + "</div></div>";
    } else if (!items.length) {
      h += '<div class="empty">Nothing here right now.</div>';
    } else if (s.layout === "rows") {
      h += '<div class="list">';
      var lastDay = null;
      items.forEach(function (it, i) {
        var day = (it.lead || "").split(" · ")[0];
        if (day !== lastDay) { h += '<div class="dayhdr">' + esc(day) + "</div>"; lastDay = day; }
        h += row(it, i);
      });
      h += "</div>";
    } else {
      h += '<div class="grid">' + items.map(function (it, i) { return card(it, s, i); }).join("") + "</div>";
      if (s.text) h += '<div class="card f t-neutral" data-zone="main" data-id="txt" data-text="sec" style="margin-top:20px"><div class="cbody" style="margin-top:0">' + esc(s.text) + "</div></div>";
    }
    h += "</div></div>";
    $(".content").innerHTML = h;
    sc = 0;
  }
  function selectSection(i, keepView) {
    if (i === st.sec && keepView) return;
    st.sec = i; if (!keepView) { st.view = 0; st.filter = ""; }
    $$(".ni").forEach(function (n) { n.classList.toggle("sel", +n.getAttribute("data-sec") === i); });
    renderMain(); save();
  }

  // ---------- focus engine ----------
  var cur = null, sc = 0;
  function setFocus(el, noScroll) {
    if (!el) return;
    if (cur) cur.classList.remove("focus");
    cur = el; el.classList.add("focus");
    var z = el.getAttribute("data-zone");
    if (z === "main") lastMain[st.sec] = el.getAttribute("data-id");
    if (z === "nav") { var i = +el.getAttribute("data-sec"); if (i !== st.sec) selectSection(i); keepNavVisible(el); }
    if (z === "main" && !noScroll) keepVisible(el);
    if (z === "drawer") keepOptVisible(el);
    save();
  }
  function keepVisible(el) {
    var box = $(".scroll"), inner = $(".sc-in");
    if (!box || !inner.contains(el)) return;
    if (WEB) { nativeNearest(box, el, 70); return; }
    var bh = box.clientHeight;
    var top = el.getBoundingClientRect().top - inner.getBoundingClientRect().top;
    var h = el.offsetHeight, pad = 90;
    var max = Math.max(0, inner.scrollHeight - bh);
    if (top - sc < pad) sc = Math.max(0, top - pad);
    else if (top + h - sc > bh - pad) sc = Math.min(max, top + h - bh + pad);
    if (top < 40) sc = 0;
    inner.style.transform = "translateY(" + -sc + "px)";
    box.className = sc > 0 ? "scroll scrolled" : "scroll";
  }
  function nativeNearest(box, el, pad) {
    var b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < b.top + pad) box.scrollTop -= (b.top + pad - r.top);
    else if (r.bottom > b.bottom - pad) box.scrollTop += (r.bottom - b.bottom + pad);
    if (r.left < b.left) box.scrollLeft -= (b.left - r.left + 16);
    else if (r.right > b.right) box.scrollLeft += (r.right - b.right + 16);
  }
  var nsc = 0;
  function keepNavVisible(el) {
    if (WEB) { nativeNearest($(".nav"), el, 8); return; }
    var box = $(".nav"), inner = $(".nav-in");
    var top = el.offsetTop, h = el.offsetHeight, bh = box.clientHeight;
    if (top - nsc < 0) nsc = top; else if (top + h - nsc > bh) nsc = top + h - bh;
    inner.style.transform = "translateY(" + -nsc + "px)";
  }
  var dsc = 0;
  function keepOptVisible(el) {
    if (WEB) { var bx = $(".dbody"); if (bx) nativeNearest(bx, el, 20); return; }
    var box = $(".dbody"), inner = $(".db-in");
    var top = el.getBoundingClientRect().top - inner.getBoundingClientRect().top, h = el.offsetHeight, bh = box.clientHeight;
    if (top - dsc < 30) dsc = Math.max(0, top - 30); else if (top + h - dsc > bh - 30) dsc = top + h - bh + 30;
    inner.style.transform = "translateY(" + -dsc + "px)";
  }
  function zoneEls(z) { return $$('.f[data-zone="' + z + '"]').filter(function (e) { return e.offsetParent !== null || z === "drawer"; }); }
  function nearest(from, dir, list) {
    var a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bs = 1e9;
    list.forEach(function (e) {
      if (e === from) return;
      var b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2, p, o;
      if (dir === "down") { p = b.top - a.bottom; if (by <= ay + 4) return; o = Math.abs(bx - ax); }
      else if (dir === "up") { p = a.top - b.bottom; if (by >= ay - 4) return; o = Math.abs(bx - ax); }
      else if (dir === "right") { p = b.left - a.right; if (bx <= ax + 4) return; o = Math.abs(by - ay); }
      else { p = a.left - b.right; if (bx >= ax - 4) return; o = Math.abs(by - ay); }
      var s = Math.max(p, -20) + o * 2.2;
      if (s < bs) { bs = s; best = e; }
    });
    return best;
  }
  function firstMain() {
    var id = lastMain[st.sec], el = id && $('.f[data-zone="main"][data-id="' + id + '"]');
    return el || $('.f[data-zone="main"].card, .f[data-zone="main"].row') || $('.f[data-zone="main"]');
  }
  function navEl() { return $('.ni[data-sec="' + st.sec + '"]'); }
  function move(dir) {
    if (!cur) return setFocus(navEl());
    var z = cur.getAttribute("data-zone");
    if (st.open) {
      if (z === "drawer") { var t = nearest(cur, dir, zoneEls("drawer")); if (t) setFocus(t); return; }
      if (dir === "up" || dir === "down") return scrollDrawer(dir === "down" ? 1 : -1);
      return stepDrawer(dir === "right" ? 1 : -1);
    }
    if (z === "rf") { if (dir === "up") setFocus(zoneEls("nav").pop()); else if (dir === "right") setFocus(firstMain() || $(".kpi.f")); return; }
    var t2 = nearest(cur, dir, zoneEls(z));
    if (z === "nav") { if (dir === "right") return setFocus(firstMain() || $(".kpi.f")); if (t2 && dir !== "left") setFocus(t2); else if (!t2 && dir === "down" && zoneEls("rf").length) setFocus(zoneEls("rf")[0]); return; }
    if (t2) return setFocus(t2);
    if (dir === "left") return setFocus(navEl());
    if (z === "main" && dir === "up") return setFocus(nearest(cur, "up", zoneEls("kpi")) || $(".kpi.f"));
    if (z === "kpi" && dir === "down") return setFocus(firstMain());
  }
  function page(n) {
    if (st.open) return scrollDrawer(n * 4);
    if (!cur || cur.getAttribute("data-zone") !== "main") return;
    var els = $$('.f[data-zone="main"][data-idx]'), i = els.indexOf(cur);
    if (i < 0) return setFocus(els[0]);
    setFocus(els[Math.max(0, Math.min(els.length - 1, i + n * 6))]);
  }

  // ---------- drawer ----------
  var dItem = null;
  function openDrawer(html) {
    $(".drawer").innerHTML = html; dsc = 0; st.open = true; document.body.classList.add("open");
  }
  function closeDrawer() {
    st.open = false; document.body.classList.remove("open");
    if (st.ret) { var r = st.ret; st.ret = null; var el = $('.f[data-id="' + r + '"]'); setFocus(el || firstMain()); }
    if (st.pendingReload) doReload();
  }
  function foot(extra) {
    if (WEB) return '<div class="dfoot">' + (dItem && dItem.list.length > 1 && !st.picker ? '<button class="db" data-act="prev">' + icon("left") + 'Previous</button><button class="db" data-act="next">Next' + icon("right") + "</button>" : "") + '<span class="esc"><span class="key">Esc</span>Close</span></div>';
    return '<div class="dfoot"><span><span class="key">Back</span>Close</span>' + extra + "</div>";
  }
  function itemList() {
    var s = secData(st.sec);
    if (s.kind === "overview") return null;
    return itemsOf(s);
  }
  function showItem(el) {
    var s = secData(st.sec), it, list, idx = +el.getAttribute("data-idx"), g = el.getAttribute("data-g");
    if (el.getAttribute("data-text")) {
      var txt = el.getAttribute("data-text") === "summary" ? { title: "Summary", body: M.summary, fields: [["Sources", M.sources.join("\n")]] } : { title: s.heading, body: s.text, fields: [] };
      dItem = { list: [txt], idx: 0, sec: s }; st.ret = el.getAttribute("data-id"); return drawItem();
    }
    list = g != null ? s.groups[+g].items : itemList();
    dItem = { list: list, idx: idx, sec: g != null ? s.groups[+g] : s, group: g };
    st.ret = el.getAttribute("data-id");
    drawItem();
  }
  function drawItem() {
    var it = dItem.list[dItem.idx], s = dItem.sec;
    var shown = [it.title, it.body, it.sub, it.when, it.lead];
    var fields = (it.fields || []).filter(function (f) { return shown.indexOf(f[1]) < 0 && (it.lead || "").split(" · ").indexOf(f[1]) < 0 && (!it.status || f[1] !== it.status.label); });
    var h = '<div class="dh">' + closeBtn() + '<div class="kick">' + icon(s.icon || "dot") + esc(s.label || s.heading) + (dItem.list.length > 1 ? '<span class="pos">' + (dItem.idx + 1) + " of " + dItem.list.length + "</span>" : "") + "</div>";
    h += '<div class="dtitle">' + esc(it.title || "Details") + "</div>";
    var meta = [];
    if (it.status) meta.push('<span class="pill t-' + it.status.tone + '">' + esc(it.status.label) + "</span>");
    if (it.lead) meta.push("<span>" + esc(it.lead) + "</span>");
    if (it.when) meta.push("<span>" + (it.whenLabel ? esc(it.whenLabel) + ": " : "") + esc(it.when) + "</span>");
    if (meta.length) h += '<div class="dmeta">' + meta.join('<span style="color:var(--mut)">·</span>') + "</div>";
    h += '</div><div class="dbody"><div class="db-in"><div class="dtext">' + esc(it.body) + "</div>";
    if (it.sub) h += '<div class="dsub">' + esc(it.sub) + "</div>";
    if (fields.length) h += '<dl class="fields">' + fields.map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") + "</dl>";
    h += "</div></div>" + foot('<span><span class="key">▲▼</span>Scroll</span>' + (dItem.list.length > 1 ? '<span><span class="key">◀▶</span>Previous / next</span>' : ""));
    openDrawer(h);
  }
  function stepDrawer(d) {
    if (!dItem || st.picker) return;
    var n = dItem.idx + d; if (n < 0 || n >= dItem.list.length) return;
    dItem.idx = n; drawItem();
    if (dItem.group == null) { var el = $('.f[data-zone="main"][data-idx="' + n + '"]'); if (el) { if (cur) cur.classList.remove("focus"); cur = el; el.classList.add("focus"); keepVisible(el); st.ret = el.getAttribute("data-id"); } }
  }
  function scrollDrawer(d) {
    var box = $(".dbody"), inner = $(".db-in"); if (!box) return;
    if (WEB) { box.scrollTop += d * 140; return; }
    var max = Math.max(0, inner.scrollHeight - box.clientHeight);
    dsc = Math.max(0, Math.min(max, dsc + d * 140)); inner.style.transform = "translateY(" + -dsc + "px)";
  }
  function closeBtn() { return '<button class="dx" data-act="close" aria-label="Close">' + icon("x") + "</button>"; }
  function openPicker() {
    var s = secData(st.sec), col = s.filters[0];
    var base = s.views ? s.views[st.view].items : s.items, counts = {};
    base.forEach(function (it) { counts[it.title] = (counts[it.title] || 0) + 1; });
    var opts = [["", "All", base.length]].concat(Object.keys(counts).sort().map(function (k) { return [k, k, counts[k]]; }));
    var h = '<div class="dh">' + closeBtn() + '<div class="kick">' + icon("filter") + "Filter " + esc(s.heading) + '</div><div class="dtitle">Choose ' + esc(col.toLowerCase()) + '</div></div><div class="dbody"><div class="db-in"><div class="opts">';
    h += opts.map(function (o, i) { return '<div class="opt f' + (o[0] === st.filter ? " cur" : "") + '" data-zone="drawer" data-id="o' + i + '" data-val="' + esc(o[0]) + '"><span>' + esc(o[1]) + '</span><span class="c">' + o[2] + "</span></div>"; }).join("");
    h += "</div></div></div>" + foot('<span><span class="key">OK</span>Apply</span>');
    st.ret = "flt"; st.picker = true; dItem = null; openDrawer(h);
    setFocus($(".opt.cur") || $(".opt"));
  }
  function openRefresh() {
    var m = rfMinutes(), saved = rfSaved() != null;
    var h = '<div class="dh">' + closeBtn() + '<div class="kick">' + icon("repeat") + 'Data refresh</div><div class="dtitle">Look for new data</div>' +
      '<div class="dmeta"><span>' + (APP ? "Saved in the app. Also in its Settings (press Menu or hold OK)." : "Saved in this browser.") + (saved ? "" : " Now using the " + (rfValid(M.refreshMinutes) != null ? "feed's" : "default") + " setting.") + "</span></div>" +
      '</div><div class="dbody"><div class="db-in">' + (M.updateNote ? '<div class="note">' + icon("info") + "<div><b>From the data owner:</b> " + esc(M.updateNote) + "</div></div>" : "") + '<div class="opts">';
    h += RF_OPTS.map(function (o, i) { return '<div class="opt f' + (o === m ? " cur" : "") + '" data-zone="drawer" data-id="r' + i + '" data-val="' + o + '"><span>' + (o === 0 ? "Off" : o === 60 ? "Every hour" : o === 1 ? "Every minute" : "Every " + o + " minutes") + "</span>" + (o === m ? '<span class="c">Current</span>' : "") + "</div>"; }).join("");
    h += "</div></div></div>" + foot('<span><span class="key">OK</span>Choose</span>');
    st.ret = "rf"; st.picker = "rf"; dItem = null; openDrawer(h);
    setFocus($(".opt.cur") || $(".opt"));
  }

  // ---------- actions ----------
  function ok() {
    if (!cur) return;
    var z = cur.getAttribute("data-zone");
    if (z === "nav") return setFocus(firstMain());
    if (z === "kpi") { var t = cur.getAttribute("data-target"); if (t !== "") { var ti = +t; selectSection(ti); var ne = navEl(); $$(".ni").forEach(function (n) { n.classList.toggle("sel", n === ne); }); keepNavVisible(ne); setFocus(firstMain()); } return; }
    if (z === "drawer" && st.picker === "rf") { rfSave(+cur.getAttribute("data-val")); st.picker = false; applyRefresh(); closeDrawer(); return; }
    if (z === "drawer") { st.filter = cur.getAttribute("data-val"); st.picker = false; renderMain(); closeDrawer(); return; }
    if (z === "rf") return openRefresh();
    if (cur.hasAttribute("data-view")) { st.view = +cur.getAttribute("data-view"); st.filter = ""; renderMain(); setFocus($('.f[data-id="v' + st.view + '"]')); return; }
    if (cur.hasAttribute("data-filter")) return openPicker();
    showItem(cur);
  }
  function back() {
    if (st.open) { st.picker = false; closeDrawer(); return true; }
    if (cur && cur.getAttribute("data-zone") !== "nav") { setFocus(navEl()); return true; }
    return false;
  }
  window.kioskBack = back;                      // called by the Android app before its double-Back exit
  window.kioskManagesReload = true;             // the app skips its own blind reload
  window.kioskRefreshChanged = function () { applyRefresh(); };   // the app calls this after its Settings change

  document.addEventListener("keydown", function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
    var k = e.key, c = e.keyCode, handled = true;
    if (WEB && /^Arrow|^Page/.test(k || "")) root.classList.remove("mouse");
    if (k === "ArrowUp" || c === 38) move("up");
    else if (k === "ArrowDown" || c === 40) move("down");
    else if (k === "ArrowLeft" || c === 37) move("left");
    else if (k === "ArrowRight" || c === 39) move("right");
    else if (k === "Enter" || k === " " || c === 13 || c === 23) ok();
    else if (k === "Escape" || k === "Backspace" || k === "GoBack" || k === "BrowserBack" || c === 27 || c === 8) back();
    else if (k === "PageDown" || k === "MediaFastForward" || k === "ChannelDown" || c === 34) page(1);
    else if (k === "PageUp" || k === "MediaRewind" || k === "ChannelUp" || c === 33) page(-1);
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ---------- mouse / touch (regular browsers) ----------
  function onPointer() { if (WEB) root.classList.add("mouse"); }
  document.addEventListener("mousedown", onPointer, true);
  document.addEventListener("touchstart", onPointer, { capture: true, passive: true });
  document.addEventListener("click", function (e) {
    var t = e.target;
    var act = t.closest && t.closest("[data-act]");
    if (act) {
      var a = act.getAttribute("data-act");
      if (a === "close") back(); else if (a === "prev") stepDrawer(-1); else if (a === "next") stepDrawer(1);
      e.preventDefault(); return;
    }
    if (t.closest && t.closest(".scrim")) { back(); return; }
    var el = t.closest && t.closest(".f");
    if (!el) return;
    var z = el.getAttribute("data-zone");
    if (st.open && z !== "drawer") { back(); return; }
    if (z === "nav") { setFocus(el, true); if (WEB) { var b = $(".scroll"); if (b) b.scrollTop = 0; } return; }
    setFocus(el, true);
    ok();
  });
  window.addEventListener("popstate", function () {});

  // ---------- mascot blink at random moments ----------
  (function () {
    var lid = $(".gbot .blink"), rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!lid || rm) return;
    function blink() {
      lid.classList.remove("b"); void lid.getBBox; lid.offsetWidth; lid.classList.add("b");
      var again = Math.random() < 0.22;
      setTimeout(function () { lid.classList.remove("b"); if (again) setTimeout(function () { lid.classList.add("b"); setTimeout(function () { lid.classList.remove("b"); }, 220); }, 140); }, 220);
      setTimeout(blink, 2600 + Math.random() * 4200);
    }
    setTimeout(blink, 1500 + Math.random() * 2000);
  })();

  // ---------- clock + refresh ----------
  function tick() {
    var d = new Date(), o = { timeZone: M.tz || "America/Los_Angeles" };
    try {
      $(".clock").textContent = d.toLocaleTimeString("en-US", { timeZone: o.timeZone, hour: "numeric", minute: "2-digit" });
      $(".date").textContent = d.toLocaleDateString("en-US", { timeZone: o.timeZone, weekday: "long", month: "long", day: "numeric" }) + (M.tzLabel ? " · " + M.tzLabel : "");
    } catch (e) {}
  }
  function doReload() { save(); location.reload(); }
  function checkUpdate() {
    if (window.__BB_CHECK__) return window.__BB_CHECK__(M.version, function () { if (st.open) st.pendingReload = true; else doReload(); });
    var x = new XMLHttpRequest();
    x.open("GET", location.pathname + "?v=" + Date.now(), true);
    x.timeout = 15000;
    x.onload = function () {
      if (x.status !== 200) return;
      var m = /data-version="([^"]+)"/.exec(x.responseText);
      if (m && m[1] !== M.version) { if (st.open) st.pendingReload = true; else doReload(); }
    };
    x.send();
  }

  // ---------- data refresh interval ----------
  // Priority: the viewer's saved choice (?refresh= sets it), then the feed's meta.refreshMinutes, then 5.
  // Inside the Android app the choice is stored by the app (AgentTelecastApp), so its Settings match.
  var RF_KEY = "agenttelecast.refresh", RF_OPTS = [0, 1, 5, 15, 30, 60], APP = window.AgentTelecastApp || null, rfTimer = null;
  function rfValid(v) { var n = v === "off" ? 0 : parseInt(v, 10); return RF_OPTS.indexOf(n) >= 0 ? n : null; }
  function rfSaved() { try { return rfValid(APP ? APP.getRefreshMinutes() : localStorage.getItem(RF_KEY)); } catch (e) { return null; } }
  function rfSave(v) { try { if (APP) APP.setRefreshMinutes(v); else localStorage.setItem(RF_KEY, String(v)); } catch (e) {} }
  function rfMinutes() { var s = rfSaved(); if (s != null) return s; var f = rfValid(M.refreshMinutes); return f != null ? f : 5; }
  function rfText(m) { return m === 0 ? "Auto-refresh off" : m === 60 ? "Looks for new data every hour" : m === 1 ? "Looks for new data every minute" : "Looks for new data every " + m + " min"; }
  function applyRefresh() {
    var m = rfMinutes(), b = $(".rf");
    if (b) b.textContent = rfText(m);
    if (rfTimer) clearInterval(rfTimer);
    rfTimer = m ? setInterval(checkUpdate, m * 60 * 1000) : null;
  }
  function renderNote() {
    var b = $(".rf"), n = $(".rnote");
    if (!M.updateNote) { if (n) n.parentNode.removeChild(n); return; }
    if (!n && b) { n = document.createElement("span"); n.className = "rnote"; b.parentNode.insertBefore(n, b.nextSibling); }
    if (n) n.textContent = M.updateNote;
  }
  try { var qr = new URLSearchParams(location.search).get("refresh"); if (qr != null && rfValid(qr) != null) rfSave(rfValid(qr)); } catch (e) {}

  // ---------- boot ----------
  renderNav(); renderMain();
  var start = null;
  if (st.restore && st.restore.zone === "nav") start = navEl();
  else if (st.restoreFp) start = findByFingerprint(st.restoreFp);
  else if (st.restore && st.restore.id && st.restore.zone !== "drawer") start = $('.f[data-zone="' + st.restore.zone + '"][data-id="' + st.restore.id + '"]');
  if (!start && st.restoreFp && st.restore && st.restore.zone === "main") start = $('.f[data-zone="main"][data-id="' + st.restore.id + '"]');
  if (!start && st.restoreFp) start = firstMain();
  setFocus(start || navEl());
  if (WEB) { root.classList.add("mouse"); var sb = $(".scroll"); if (sb && start && start.getAttribute("data-zone") === "main") nativeNearest(sb, start, 70); }
  tick(); setInterval(tick, 10000);
  renderNote(); applyRefresh();
})();
