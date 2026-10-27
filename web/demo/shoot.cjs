// Screenshots from out/demo.html (demo data only). Output: ../screenshots/*.png. Needs Chrome or Chromium (set CHROME=/path/to/chrome).
const puppeteer = require("puppeteer-core");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const URL = "file://" + path.join(ROOT, "out", "demo.html");
const OUT = (n) => path.join(ROOT, "..", "screenshots", n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--hide-scrollbars"] });
  // --- TV (1920x1080, 10-foot UI, D-pad keys)
  const p = await b.newPage();
  p.on("pageerror", (e) => console.log("tv PAGEERROR", e.message));
  await p.setViewport({ width: 1920, height: 1080 });
  await p.goto(URL + "?tv=1"); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(800);
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await sleep(120); } await sleep(300); };
  await p.screenshot({ path: OUT("tv-overview.png") });
  await key("ArrowRight"); await sleep(300); await p.screenshot({ path: OUT("tv-overview-focus.png") });
  const ver = await p.evaluate(() => window.__MODEL__.version);
  const go = async (state) => { await p.evaluate((st) => localStorage.setItem("agenttelecast.demo.v1", JSON.stringify(st)), { version: ver, filter: "", ...state }); await p.reload(); await sleep(800); };
  await go({ sec: 1, view: 0, focus: { zone: "main", id: "c0" } }); await key("Enter"); await sleep(500);
  await p.screenshot({ path: OUT("tv-details.png") });
  await key("Escape");
  const tl = await p.$$eval(".ni", (ns) => ns.findIndex((n) => /Timeline/.test(n.textContent)));
  await go({ sec: tl, view: 1, focus: { zone: "main", id: "v1" } });
  await p.screenshot({ path: OUT("tv-timeline.png") });
  console.log("tv sections:", await p.$$eval(".ni .lbl", (ns) => ns.map((n) => n.textContent).join(" | ")));
  // bot close-up (rail brand at 4x)
  const cp = await b.newPage(); await cp.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 4 });
  await cp.goto(URL + "?tv=1"); await sleep(600);
  const box = await cp.evaluate(() => { const rs = [".brand .mark", ".brand h1", ".brand p"].map((q) => document.querySelector(q).getBoundingClientRect()); const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top)), x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom)); return { x: x0 - 20, y: y0 - 20, width: x1 - x0 + 40, height: y1 - y0 + 40 }; });
  await cp.screenshot({ path: OUT("bot-closeup.png"), clip: box });
  // --- browser desktop + phone
  const cfgs = [
    ["web-desktop", { width: 1440, height: 900 }, null],
    ["web-phone", { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"],
  ];
  for (const [name, vp, ua] of cfgs) {
    const w = await b.newPage(); if (ua) await w.setUserAgent(ua); await w.setViewport(vp);
    w.on("pageerror", (e) => console.log(name, "PAGEERROR", e.message));
    await w.goto(URL + "?tv=0"); await w.evaluate(() => localStorage.clear()); await w.reload(); await sleep(600);
    const tap = async (sel) => { const el = await w.$(sel); if (!el) return console.log(name, "missing", sel); await el.evaluate((e) => e.scrollIntoView({ block: "nearest", inline: "center" })); await sleep(150); try { if (vp.hasTouch) await el.tap(); else await el.click(); } catch (e) { console.log(name, "tap failed", sel, e.message); } await sleep(400); };
    await w.screenshot({ path: OUT(`${name}-overview.png`) });
    const sji = await w.$$eval(".ni", (ns) => ns.find((n) => /Cursor Projects/.test(n.textContent)).dataset.sec);
    await tap(`.ni[data-sec="${sji}"]`); await tap(".scroll .card.f"); await sleep(900);
    await w.screenshot({ path: OUT(`${name}-details.png`) });
    await w.keyboard.press("Escape"); await sleep(300);
    const tli = await w.$$eval(".ni", (ns) => ns.find((n) => /Timeline/.test(n.textContent)).dataset.sec);
    await tap(`.ni[data-sec="${tli}"]`); await sleep(300);
    await w.evaluate(() => window.scrollTo(0, 0)); await w.screenshot({ path: OUT(`${name}-timeline.png`) }); console.log(name, "drawer open at end:", await w.evaluate(() => document.body.classList.contains("open")));
    await w.close();
  }
  await b.close();
})();
