#!/usr/bin/env node
/* test_touch.mjs — the viewer on a phone and an upright iPad, driven by real touch input.
 *
 * The tablet audit (20 Nov 2026) found that a finger could not do what a mouse does:
 *   - a claim's menu, and its passage, were right-click and shift-click only, and iOS fires no
 *     contextmenu at all;
 *   - a drag that started on a claim did not pan;
 *   - the question chip widened a phone's page, so the whole window slid sideways;
 *   - panels and menus ran off the right edge;
 *   - a pinch in the Mechanism view zoomed the page, not the chart;
 *   - the Mechanism question ran over the drawing on a short screen.
 * Each is held here by the input a finger makes: Chromium's own touch events (CDP
 * Input.dispatchTouchEvent), which the browser turns into pointer, touch and click events itself.
 * Synthetic events dispatched from the page would skip that path, which is the path under test.
 *
 * The page is built here from the current source, with a sample that has a text, a chain, tables
 * and rival accounts (Wilson 2023).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
let failed = 0;
function check(ok, label) { console.log((ok ? "   ok   " : "   FAIL ") + label); if (!ok) failed++; }

let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); } catch { chromium = null; }
if (!chromium) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("FAIL: Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("touch: skipped (no Chromium)");
  process.exit(0);
}

const W = path.join(REPO, "samples", "Wilson 2023 - What makes a health system good");
const PAGE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "touch-")), "wilson.html");
execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), path.join(W, "wilson-2023-health-system-good.argdown"),
  "--source-root", W, "-o", PAGE], { stdio: "pipe" });

const browser = await chromium.launch();
const wait = ms => new Promise(r => setTimeout(r, ms));

/** A page at this size that believes it is a touch device, with a CDP session for real touches. */
async function device(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("file://" + PAGE);
  await wait(800);
  // The question card asks first; answer it the way a reader would.
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.offsetWidth && /Show me the map/.test(x.textContent)); if (b) b.click(); });
  await wait(1500);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  return { ctx, page, errors, touch };
}
/** The middle of the largest claim box on screen. */
const claimAt = page => page.evaluate(() => {
  const bs = [...document.querySelectorAll("#map .alm-n")].map(b => b.getBoundingClientRect())
    .filter(r => r.width > 40 && r.top > 120 && r.bottom < innerHeight - 80).sort((a, b) => b.width * b.height - a.width * a.height);
  const r = bs[0]; return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 30)), top: r.top, left: r.left } : null;
});
const shown = (page, id) => page.evaluate(i => { const e = document.getElementById(i); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; }, id);

try {
  /* ---- a phone ---------------------------------------------------------------------------- */
  console.log("\na phone, 375 x 812");
  {
    const { ctx, page, errors, touch } = await device(375, 812);
    const width = await page.evaluate(() => ({ iw: innerWidth, sw: document.documentElement.scrollWidth }));
    check(width.iw === 375 && width.sw <= 375, "the page is no wider than the screen (" + width.iw + ", content " + width.sw + "): nothing slides sideways");
    const heights = await page.evaluate(() => [...document.querySelectorAll("body > header button")].filter(b => b.offsetWidth).map(b => b.getBoundingClientRect().height));
    check(heights.length > 0 && Math.min(...heights) >= 34, "the toolbar's buttons are finger-sized (smallest " + Math.round(Math.min(...heights)) + "px)");

    let c = await claimAt(page);
    check(!!c, "a claim is on screen to touch");
    // A TAP: the strip comes up above the claim.
    await touch("touchStart", [[c.x, c.y]]); await wait(60); await touch("touchEnd", []); await wait(400);
    check(await shown(page, "tapmore"), "a tap on a claim offers ⋯, the claim's menu");
    check(await shown(page, "tapgo"), "and Passage, on a map with its text");
    await page.evaluate(() => document.getElementById("tapmore").scrollIntoView());
    const more = await page.evaluate(() => { const r = document.getElementById("tapmore").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await touch("touchStart", [[more.x, more.y]]); await wait(60); await touch("touchEnd", []); await wait(300);
    check(await shown(page, "ctx"), "⋯ opens the claim's menu");
    check(await page.evaluate(() => /Go to source/.test(document.getElementById("ctx").textContent)), "which offers the passage, as right-click does");
    await page.keyboard.press("Escape"); await wait(200);
    await page.evaluate(() => { const m = document.getElementById("ctx"); if (m) m.hidden = true; });

    // A HOLD: the same menu, with no button to find first.
    c = await claimAt(page);
    await touch("touchStart", [[c.x, c.y]]); await wait(800); await touch("touchEnd", []); await wait(300);
    check(await shown(page, "ctx"), "holding a finger on a claim opens its menu (iOS fires no contextmenu)");
    await page.evaluate(() => { document.getElementById("ctx").hidden = true; });

    // A DRAG FROM A CLAIM pans, and opens nothing.
    c = await claimAt(page);
    await touch("touchStart", [[c.x, c.y]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[c.x + i * 8, c.y + i * 12]]); await wait(20); }
    await touch("touchEnd", []); await wait(400);
    const moved = await page.evaluate(([x0, y0]) => {
      const bs = [...document.querySelectorAll("#map .alm-n")].map(b => b.getBoundingClientRect()).filter(r => r.width > 40);
      return bs.some(r => Math.abs(r.left - x0 - 48) < 3 && Math.abs(r.top - y0 - 72) < 3);
    }, [c.left, c.top]);
    check(moved, "a drag that starts on a claim moves the map with the finger");
    check(!(await shown(page, "ctx")), "and opens no menu");

    // A HELD BUTTON SAYS WHAT IT DOES, and is not pressed.
    const help = await page.evaluate(() => { const r = document.getElementById("helpbtn").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await touch("touchStart", [[help.x, help.y]]); await wait(700); await touch("touchEnd", []); await wait(300);
    check(await shown(page, "holdtip"), "holding a toolbar button shows what it does");
    check(!(await page.evaluate(() => document.getElementById("help").classList.contains("show"))), "and does not press it");

    // THE PANELS ARE SHEETS on the screen.
    for (const [btn, id] of [["Tables", "tables"], ["Weigh", "weigh"], ["Where to look", "look"]]) {
      await page.evaluate(b => [...document.querySelectorAll(".alm-bar button")].find(x => x.textContent.trim().startsWith(b)).click(), btn);
      await wait(400);
      const r = await page.evaluate(i => { const e = document.getElementById(i), r = e.getBoundingClientRect(); return { l: r.left, r: r.right, sw: e.scrollWidth, cw: e.clientWidth }; }, id);
      check(r.l >= 0 && r.r <= 375, btn + " lies within the screen (" + Math.round(r.l) + "–" + Math.round(r.r) + ")");
      if (id === "weigh") check(r.sw <= r.cw + 1, "and Weigh's columns fit inside it (" + r.sw + " in " + r.cw + ")");
    }
    // The Layout menu stays on screen.
    await page.evaluate(() => { document.querySelectorAll("#tables,#weigh,#look").forEach(e => { e.hidden = true; }); });
    await page.evaluate(() => { const b = document.getElementById("laybtn"); (b.offsetWidth ? b : document.getElementById("morebtn")).click(); });
    await wait(300);
    const menu = await page.evaluate(() => { const r = document.getElementById("ctx").getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom }; });
    check(menu.l >= 0 && menu.r <= 375 && menu.b <= 812, "the toolbar's menu lies within the screen");
    // From it, the Mechanism view.
    let item = await page.evaluate(() => !![...document.querySelectorAll("#ctx button")].find(b => /^\s*Mechanism/.test(b.textContent)));
    if (!item) { await page.evaluate(() => [...document.querySelectorAll("#ctx button")].find(b => /Layout/.test(b.textContent)).click()); await wait(300); }
    await page.evaluate(() => [...document.querySelectorAll("#ctx button")].find(b => /^\s*Mechanism/.test(b.textContent)).click());
    await wait(1200);
    const mech = await page.evaluate(() => {
      const h = document.querySelector("#mech .amech-head"), q = h && h.querySelector(".amech-q"), st = document.querySelector("#mech .amech-stage");
      return { qBottom: q ? q.getBoundingClientRect().bottom : 0, stageTop: st.getBoundingClientRect().top, stageH: st.getBoundingClientRect().height,
               zoom: (document.querySelector('#mech [data-zoom="1"]') || {}).textContent, sw: document.documentElement.scrollWidth };
    });
    check(mech.qBottom <= mech.stageTop + 1, "the chain's question ends above the drawing (" + Math.round(mech.qBottom) + " ≤ " + Math.round(mech.stageTop) + ")");
    check(mech.stageH >= 280, "and the drawing keeps most of the screen (" + Math.round(mech.stageH) + "px)");
    check(mech.sw <= 375, "the chain's controls stay within the screen");
    // A PINCH zooms the chart.
    const cx = 180, cy = Math.round(mech.stageTop + 120);
    const scale0 = await page.evaluate(() => visualViewport.scale);
    await touch("touchStart", [[cx - 30, cy], [cx + 30, cy]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[cx - 30 - i * 8, cy], [cx + 30 + i * 8, cy]]); await wait(20); }
    await touch("touchEnd", []); await wait(300);
    const after = await page.evaluate(() => ({ zoom: (document.querySelector('#mech [data-zoom="1"]') || {}).textContent, scale: visualViewport.scale }));
    check(parseInt(after.zoom, 10) > parseInt(mech.zoom, 10), "a pinch zooms the chart (" + mech.zoom + " → " + after.zoom + ")");
    check(after.scale === scale0, "and not the page");
    check(!errors.length, "no page errors" + (errors.length ? ": " + errors[0] : ""));
    await ctx.close();
  }

  /* ---- an iPad held upright ------------------------------------------------------------------ */
  console.log("\nan iPad upright, 768 x 1024");
  {
    const { ctx, page, errors } = await device(768, 1024);
    check(await page.evaluate(() => getComputedStyle(document.getElementById("side")).display === "none" || document.getElementById("side").hidden),
      "one pane at a time");
    await page.evaluate(() => document.querySelector('[data-act="look"]').click());
    await wait(800);
    const map = await page.evaluate(() => {
      const bs = [...document.querySelectorAll("#map .alm-n")].map(b => b.getBoundingClientRect()).filter(r => r.width > 20);
      return { left: Math.min(...bs.map(r => r.left)), look: document.getElementById("look").getBoundingClientRect().right };
    });
    check(map.left < map.look, "an open panel lies over the map rather than squeezing it into a strip");
    check(!errors.length, "no page errors" + (errors.length ? ": " + errors[0] : ""));
    await ctx.close();
  }
} finally { await browser.close(); }

console.log(failed ? "\n" + failed + " FAILED" : "\nall ok");
process.exit(failed ? 1 : 0);
