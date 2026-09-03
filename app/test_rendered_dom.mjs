/* What the renderer actually PAINTS, checked in a real browser.
 *
 * WHY THIS EXISTS. Between 31 August and 1 September 2026 eighteen defects were introduced and
 * fixed in the renderer and this suite's other twenty three instruments caught none of them.
 * Eight reached the author, who found them by clicking around a map. They were not subtle:
 * arrows starting in mid-air, an edge drawn through the middle of a box, seven claims whose text
 * was cut off in the box and available nowhere, a control that could not be clicked.
 *
 * None of them were reachable from here before, because every other instrument stops at the DOM.
 * `reduceFold` is pure and exhausted; `layoutByText` is pure and adversarially fuzzed; `frameFor`
 * is pure and unit-tested. All three can be right while the picture is wrong, and on this project
 * they repeatedly were. `test_layout_geometry.mjs` says so in its own header: "Two things it does
 * not cover, honestly: real font metrics, and the visual result. Those still want a browser."
 *
 * This is that browser. It asserts about RENDERED geometry -- `getBoundingClientRect`, not the
 * layout's own numbers -- and about what a pointer would actually hit, which is the class of
 * fault that synthesised events are blind to.
 *
 *   node app/test_rendered_dom.mjs [--maps N] [--keep]
 *
 * See docs/QA-PLAN.md for the defect-by-defect case, and for what is deliberately not here.
 *
 * EVERY INVARIANT HERE HAS BEEN MUTATION-TESTED: break the thing it checks, watch it fail,
 * restore it. The note beside each one names the mutation. That rule exists because the first
 * `test_fold_camera.mjs` passed on the day it was written while asserting nothing at all.
 */
/* SKIPPED, NOT FAILED, where the browser is not installed. A checkout that has run `npm ci` but
 * not `npx playwright install chromium` should still get the other twenty three suites rather
 * than one red line it cannot act on. Anything else that goes wrong is a failure. */
let chromium;
try {
  ({ chromium } = await import("playwright"));
  await chromium.executablePath();
} catch (e) {
  const why = String((e && e.message) || e).split("\n")[0];
  if (process.env.IPS_REQUIRE_BROWSER) {
    console.log("FAIL — Playwright's Chromium is required here and is not installed.");
    console.log("  " + why);
    process.exit(1);
  }
  console.log("SKIPPED — Playwright's Chromium is not installed here.");
  console.log("  npx playwright install chromium     (once, ~150MB)");
  console.log("  " + why);
  process.exit(0);
}
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const BUILDER = path.join(HERE, "build_argdown_viewer.mjs");

const argv = process.argv.slice(2);
const LIMIT = Number((argv[argv.indexOf("--maps") + 1] || 0)) || 99;
const KEEP = argv.includes("--keep");
const CORPUS = argv.includes("--corpus") ? argv[argv.indexOf("--corpus") + 1] : null;
const SELFTEST = !argv.includes("--no-selftest");
let didSelftest = false, proved = 0;

let fails = 0, checks = 0;
const failures = [];
function check(ok, what, detail) {
  checks++;
  if (!ok) { fails++; failures.push(detail ? `${what}\n         ${detail}` : what); }
}

/* ------------------------------------------------------------------ the maps under test */

/** Every sample with a manuscript beside it, built fresh so the renderer under test is the one
 *  in the working tree rather than whatever was last committed to a `(map).html`.
 *
 *  `--corpus DIR` points this somewhere else. The public samples are seven careful maps and they
 *  are not a sample of what people write: the private corpus has book-length reconstructions,
 *  Argdown's own demo files, and maps made by other tools. Run against those before believing a
 *  green suite means much. Any directory holding `.argdown` files, at any depth, will do. */
function corpus() {
  const out = [];
  const base = CORPUS || path.join(REPO, "samples");
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".argdown"))
        out.push({ name: path.basename(e.name, ".argdown").slice(0, 24),
                   argdown: full, root: dir });
    }
  };
  walk(base);
  return out.slice(0, LIMIT);
}

/* ------------------------------------------------------------------ the invariants
 *
 * Written as one function evaluated in the page, returning a list of complaints. In the page
 * rather than out here because every one of them is a question about rendered geometry, and
 * shipping rectangles across the bridge one element at a time is both slower and easier to get
 * subtly wrong than asking the page.
 */
const INVARIANTS = function () {
  const bad = [];
  const say = (rule, detail) => bad.push({ rule, detail });
  const rect = el => el.getBoundingClientRect();
  const area = r => Math.max(0, r.width) * Math.max(0, r.height);

  const boxes = [...document.querySelectorAll(".alm-n")];

  /* NO TWO CLAIMS OVERLAP. Mutation: subtract 40 from the row gap in `layoutByText`.
   * Overlap is measured on the drawn rectangles, so it catches a box that grew after layout --
   * which is exactly what a font metric does and what the pure geometry suite cannot see. */
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = rect(boxes[i]), b = rect(boxes[j]);
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1 && area(a) && area(b)) {
        const nm = e => (e.querySelector(".alm-title") || {}).textContent || "?";
        say("no two claims overlap",
            `"${nm(boxes[i])}" and "${nm(boxes[j])}" overlap by ${Math.round(ox)}x${Math.round(oy)}px`);
        i = boxes.length; break;                 // one report per state is enough to act on
      }
    }
  }

  /* A CLAIM CUT OFF IN THE BOX CAN BE READ SOMEWHERE. Defect: `n.full` was read in three places
   * and set in none, so seven claims on the Miller map were clipped mid-sentence with the rest
   * available nowhere. Mutation: delete the `s.clipped` branch of the tooltip. */
  for (const b of boxes) {
    const more = b.querySelector(".alm-more");
    if (!more) continue;                        // not clipped, or a structure control
    const drawn = [...b.querySelectorAll(".alm-text")].map(t => t.textContent).join(" ").trim();
    if (!drawn) continue;
    const t = [...b.children].find(c => c.tagName === "title");
    const tip = t ? t.textContent : "";
    const openable = getComputedStyle(more).pointerEvents !== "none";
    // Clipped is: the tooltip's first block extends the drawn text. If it does not, the "more"
    // control must be there to open it, or the words are simply unreachable.
    const carried = tip && tip.split("\n\n")[0].startsWith(drawn.slice(0, 25));
    if (!carried && !openable)
      say("a clipped claim can be read",
          `"${(b.querySelector(".alm-title") || {}).textContent}" is cut off with no way to the rest`);
  }

  /* HOVER TEXT ADDS SOMETHING. The design rule, made executable: a tooltip that repeats the box
   * under the pointer teaches the reader that tooltips are not worth opening. Mutation: put
   * `n.detail` back at the front of the tooltip unconditionally. */
  for (const b of boxes) {
    const t = [...b.children].find(c => c.tagName === "title");
    if (!t) continue;
    const tip = (t.textContent || "").trim();
    if (!tip) continue;
    const drawn = [...b.querySelectorAll("text")].map(x => x.textContent).join(" ")
      .replace(/\s+/g, " ").replace(/…/g, "").trim().toLowerCase();
    const blocks = tip.split("\n\n").map(s => s.trim()).filter(Boolean);
    // WHOLE BLOCKS, not their first forty characters. A clipped claim's tooltip carries the FULL
    // sentence while the box draws a PREFIX of it, so comparing openings called every one of
    // those a repeat -- 78 failures across the private corpus, none of them real, and none
    // visible on the public one because those maps carry provenance that added a second block.
    // A block repeats the box only if the box already contains ALL of it.
    const adds = blocks.some(bl => !drawn.includes(bl.replace(/\s+/g, " ").trim().toLowerCase()));
    if (!adds && drawn)
      say("a tooltip says something the box does not",
          `"${(b.querySelector(".alm-title") || {}).textContent}" repeats itself: ${tip.slice(0, 60)}`);
  }

  /* A DRAWN CONTROL CAN BE PRESSED. Two defects: shrinking a band's hit rectangle to free the
   * drag silently took the right-click with it, and the ⊞ control did nothing when clicked.
   * `elementFromPoint` is the only honest test -- it asks what the pointer would actually land
   * on, through whatever is stacked above. Mutation: add `pointer-events:none` to `.alm-explode`. */
  const CONTROLS = [".alm-toggle", ".alm-explode", ".alm-verdict", ".alm-more", ".alm-gfold"];
  for (const sel of CONTROLS) {
    for (const c of document.querySelectorAll(sel)) {
      const r = rect(c);
      if (!area(r)) continue;
      if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || hit === c || c.contains(hit) || hit.closest(sel) === c) continue;
      // THE APP'S OWN CHROME IS ALLOWED TO SIT OVER THE MAP. The bar, the footer and the panels
      // are fixed to the pane and the map slides under them; a control beneath one is not
      // unreachable, it is scrolled. Six findings on the first run were all this, and scoping it
      // out is the difference between an instrument and a thing everyone learns to ignore.
      if (hit.closest(".alm-bar, header, footer, #expl, #about, #ctx, #help, .panel, #walk"))
        continue;
      say("a drawn control is the thing under its own centre",
          `${sel} is covered by <${hit.tagName.toLowerCase()} class="${
            hit.getAttribute("class")}">`);
    }
  }

  /* THE MAIN CLAIM IS ON SCREEN. Already an invariant of the fold suite, but in LAYOUT
   * coordinates; a correct layout framed from the wrong place puts it off the pane anyway, which
   * is what the camera defects did. Mutation: add 2000 to the y of `frameFor`'s translation. */
  if (boxes.length) {
    const anyOn = boxes.some(b => {
      const r = rect(b);
      return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    });
    if (!anyOn) say("something is on screen", `${boxes.length} boxes, none within the pane`);
  }

  return bad;
};

/* ------------------------------------------------------------------ the explode panel */

const PANEL_INVARIANTS = function () {
  const bad = [];
  const say = (rule, detail) => bad.push({ rule, detail });
  const wrap = document.querySelector("#explbody .xwrap");
  if (!wrap) return bad;
  const wr = wrap.getBoundingClientRect();
  const boxes = [...wrap.querySelectorAll(".xstep,.xconcl")].map(b => {
    const r = b.getBoundingClientRect();
    return { t: r.top - wr.top, b: r.bottom - wr.top, l: r.left - wr.left, r: r.right - wr.left };
  });
  const segs = [];
  for (const p of wrap.querySelectorAll(".xedges path")) {
    if (p.closest("defs")) continue;
    const n = (p.getAttribute("d") || "").match(/-?[\d.]+/g);
    if (!n || n.length < 4) continue;
    const v = n.map(Number);
    for (let i = 0; i + 3 < v.length; i += 2) segs.push([v[i], v[i + 1], v[i + 2], v[i + 3]]);
  }

  /* EVERY EDGE STARTS AND ENDS ON A BOX. Defect: the compact view drew its edges from the ROW's
   * bounds while a conclusion box is centred in a row a taller step box sizes, so every downward
   * arrow began in mid-air. Mutation: add 12 to `r.leaves`. */
  const near = (v, xs) => Math.min(...xs.map(x => Math.abs(x - v)));
  const tops = boxes.map(b => b.t), bots = boxes.map(b => b.b),
        lefts = boxes.map(b => b.l), rights = boxes.map(b => b.r);
  if (boxes.length && segs.length) {
    const first = segs[0], last = segs[segs.length - 1];
    void first; void last;
    for (const p of wrap.querySelectorAll(".xedges path")) {
      if (p.closest("defs")) continue;
      const v = ((p.getAttribute("d") || "").match(/-?[\d.]+/g) || []).map(Number);
      if (v.length < 4) continue;
      const horiz = Math.abs(v[1] - v[v.length - 1]) < 0.5;
      const startGap = horiz ? near(v[0], rights) : near(v[1], bots);
      const endGap = horiz ? near(v[v.length - 2], lefts) : near(v[v.length - 1], tops);
      if (startGap > 1.5 || endGap > 1.5)
        say("an edge starts and ends on a box",
            `gaps ${startGap.toFixed(1)}px / ${endGap.toFixed(1)}px on ${p.getAttribute("d")}`);
    }
  }

  /* AND PASSES THROUGH NONE. Defect: the elbow's horizontal run defaulted to halfway between the
   * boxes, which in the compact view is INSIDE the step box beside it -- the edge was drawn
   * straight through "checked: the conclusion follows" as a strikethrough. The endpoint check
   * above was green while this was wrong, which is why both exist.
   * Mutation: restore the `via == null` default in `explElbow`. */
  for (const [x1, y1, x2, y2] of segs) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    for (const b of boxes)
      if (mx > b.l + 1 && mx < b.r - 1 && my > b.t + 1 && my < b.b - 1)
        say("no edge is drawn through a box", `segment (${x1},${y1})-(${x2},${y2})`);
  }

  /* A PANEL SCROLLS ONE WAY. Defect: the available width was computed as the body's clientWidth
   * minus a GUESSED 24px of padding when the padding is 32, so every box was 8px over.
   * Mutation: subtract 24 from the body's clientWidth again instead of measuring the wrap. */
  const body = document.getElementById("explbody");
  if (body.scrollWidth > body.clientWidth + 1)
    say("the panel does not scroll sideways",
        `scrollWidth ${body.scrollWidth} > clientWidth ${body.clientWidth}`);

  return bad;
};

/* ------------------------------------------------------------------ proving the instrument
 *
 * A HARNESS THAT HAS NEVER FAILED IS WORTH NOTHING, and this project has already paid for that
 * lesson once: the first `test_fold_camera.mjs` passed on the day it was written because it
 * looked its sections up in `vis.nodes`, where an open section is not, so every assertion was
 * about `undefined` and every one of them held.
 *
 * So the mutations are not a thing somebody did once and wrote down. `--selftest` injects each
 * defect into a real page and requires the matching invariant to report it. An invariant that
 * cannot be made to fail is a bug in this file, and says so in the same output as everything
 * else.
 */
const MUTATIONS = [
  /* A CLONE IN THE SAME PLACE, rather than moving a box on top of another: appending a second
   * translate to an `.alm-n` changes the style string and moves nothing, so the first version of
   * this mutation reported the invariant as broken when the MUTATION was. Measured with a probe
   * before believing it -- which is the same rule as everything else here. */
  { rule: "no two claims overlap", where: "map", how: () => {
      const b = [...document.querySelectorAll(".alm-n")];
      if (!b.length) return false;
      const twin = b[0].cloneNode(true);
      twin.classList.add("mutant");
      b[0].parentNode.appendChild(twin);
      window.__undo.push(() => twin.remove());
      return true; } },

  { rule: "a clipped claim can be read", where: "map", how: () => {
      const b = [...document.querySelectorAll(".alm-n")].find(x => x.querySelector(".alm-more"));
      if (!b) return false;
      const t = [...b.children].find(c => c.tagName === "title");
      const was = t ? t.textContent : null;
      if (t) t.textContent = "";                       // the dead `n.full`, in one line
      const m = b.querySelector(".alm-more");
      m.style.pointerEvents = "none";
      window.__undo.push(() => { if (t) t.textContent = was; m.style.pointerEvents = ""; });
      return true; } },

  { rule: "a tooltip says something the box does not", where: "map", how: () => {
      const b = [...document.querySelectorAll(".alm-n")]
        .find(x => [...x.children].some(c => c.tagName === "title"));
      if (!b) return false;
      const t = [...b.children].find(c => c.tagName === "title");
      const was = t.textContent;
      t.textContent = [...b.querySelectorAll("text")].map(x => x.textContent).join(" ");
      window.__undo.push(() => { t.textContent = was; });
      return true; } },

  { rule: "a drawn control is the thing under its own centre", where: "map", how: () => {
      const c = document.querySelector(".alm-toggle, .alm-explode, .alm-more");
      if (!c) return false;
      const r = c.getBoundingClientRect();
      const d = document.createElement("div");
      d.className = "mutant";
      d.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;` +
                        `width:${r.width + 8}px;height:${r.height + 8}px;z-index:99999`;
      document.body.appendChild(d);
      window.__undo.push(() => d.remove());
      return true; } },

  { rule: "an edge starts and ends on a box", where: "panel", how: () => {
      const p = document.querySelector("#explbody .xedges path:not(defs path)");
      if (!p) return false;
      const v = (p.getAttribute("d").match(/-?[\d.]+/g) || []).map(Number);
      if (v.length < 4) return false;
      const was = p.getAttribute("d");
      v[1] += 14;                                       // the arrow starts in mid-air again
      p.setAttribute("d", "M" + v[0] + "," + v[1] +
        v.slice(2).reduce((a, n, i) => a + (i % 2 ? "," + n : " L" + n), ""));
      window.__undo.push(() => p.setAttribute("d", was));
      return true; } },

  { rule: "no edge is drawn through a box", where: "panel", how: () => {
      const p = document.querySelector("#explbody .xedges path:not(defs path)");
      const b = document.querySelector("#explbody .xstep");
      if (!p || !b) return false;
      const w = document.querySelector("#explbody .xwrap").getBoundingClientRect();
      const r = b.getBoundingClientRect();
      const cx = r.left - w.left + r.width / 2, cy = r.top - w.top + r.height / 2;
      const was = p.getAttribute("d");
      p.setAttribute("d", `M${cx - 40},${cy} L${cx + 40},${cy}`);
      window.__undo.push(() => p.setAttribute("d", was));
      return true; } },

  { rule: "the panel does not scroll sideways", where: "panel", how: () => {
      const b = document.querySelector("#explbody .xstep");
      if (!b) return false;
      // WIDE ENOUGH TO BE SURE. +300px did not overflow the compact layout, whose boxes are half
      // the panel each, so the mutation passed and the invariant looked untested. Measured off
      // the wrap so it overflows whatever the layout is.
      const was = b.style.width;
      const w = document.querySelector("#explbody .xwrap").clientWidth;
      b.style.width = (w + 400) + "px";
      window.__undo.push(() => { b.style.width = was; });
      return true; } },
];

/* UNDONE IN PLACE, NOT RELOADED. The first version put the page back by reloading it and then
 * rebuilding the state each mutation needed -- correct, and it took 310 of the suite's 330
 * seconds [measured]. Every mutation here is a small, recorded DOM change, so each one carries
 * its own inverse and the page never has to be built twice. 310s -> under a second.
 *
 * The state rebuilding is what the reload was really for: after a reload the map is back at its
 * opening view, where most of these have nothing to break, and the first version silently ran
 * two of seven and reported itself satisfied. That is why `proved` is counted and printed. */
async function selftest(page, where, evaluator) {
  await page.evaluate(() => { window.__undo = []; });
  for (const m of MUTATIONS.filter(x => x.where === where)) {
    const applied = await page.evaluate(m.how);
    if (!applied) continue;                    // this page has nothing to break; try the next
    const found = await page.evaluate(evaluator);
    const caught = found.some(f => f.rule === m.rule);
    proved++;
    check(caught, `MUTATION caught: ${m.rule}`,
          caught ? "" : "the invariant held with the defect present, so it is not testing it");
    await page.evaluate(() => {
      while (window.__undo.length) window.__undo.pop()();
    });
    // A `tagged` mutation adds boxes the renderer did not draw; undoing removes them, and the
    // page is already in the state this pass needs, so nothing else has to be rebuilt.
  }
}

/* ------------------------------------------------------------------ driving a page */

async function settle(page) {
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  await page.waitForTimeout(400);
}

/** The walkthrough offers itself on a first visit and would sit over everything — and the key
 *  card would sit over a corner. Neither self-offers in the payload pages this harness builds,
 *  but a fresh headless profile is exactly the state in which they would if that ever changed,
 *  so both flags are seeded and both overlays hidden: the invariants below are about the map. */
async function dismissWalkthrough(page) {
  await page.evaluate(() => {
    try { localStorage.setItem("ipsissima.walkthrough.v1", "declined"); } catch (e) { void e; }
    try { localStorage.setItem("ipsissima.key.v1", "seen"); } catch (e) { void e; }
    const w = document.getElementById("walk");
    if (w && !w.hidden) w.hidden = true;
    const k = document.getElementById("keycard");
    if (k && !k.hidden) k.hidden = true;
  });
}

/** The untagged chip, which only exists on a map that uses hashtags at all. */
async function clickUntagged(page) {
  return page.evaluate(() => {
    const b = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".alm-bar button[data-untagged]"));
    if (!b) return false;
    b.click();
    return true;
  });
}

async function clickBarButton(page, label) {
  return page.evaluate(t => {
    const b = [...document.querySelectorAll(".alm-bar button")]
      .find(x => x.textContent.trim() === t);
    if (b) { b.click(); return true; }
    return false;
  }, label);
}

async function runState(page, map, state, scheme) {
  const found = await page.evaluate(INVARIANTS);
  for (const f of found)
    check(false, `${f.rule} — ${map} [${state}, ${scheme}]`, f.detail);
  if (!found.length) check(true, `${map} [${state}, ${scheme}]`);
}

async function openPanel(page) {
  const ok = await page.evaluate(() => {
    const c = [...document.querySelectorAll(".alm-explode")][0];
    if (!c) return false;
    c.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  });
  if (ok) await page.waitForTimeout(250);
  return ok;
}

async function runPanel(page, map, scheme) {
  const opened = await openPanel(page);
  if (!opened) return 0;
  let n = 0;
  for (const mode of ["stair", "compact"]) {
    await page.evaluate(m => {
      document.getElementById(m === "compact" ? "xmcompact" : "xmstair").click();
    }, mode);
    await page.waitForTimeout(250);
    const found = await page.evaluate(PANEL_INVARIANTS);
    for (const f of found)
      check(false, `${f.rule} — ${map} [panel/${mode}, ${scheme}]`, f.detail);
    if (!found.length) check(true, `${map} [panel/${mode}, ${scheme}]`);
    n++;
  }
  await page.evaluate(() => { document.getElementById("explclose").click(); });
  return n;
}

/* ------------------------------------------------------------------ the facet filter
 *
 * NOTHING VARIED THE FACETS BEFORE THIS. The fold invariants pass `facets: null` throughout, so
 * the whole filter -- and the empty-map path it can reach -- had no coverage at all, which is how
 * `untagged` came to be built on top of a latent fault in `render`.
 *
 * ASSERTED AS A CHANGE, not as a property of one picture. The obvious form -- "with untagged off,
 * everything drawn carries a hashtag" -- cannot be written honestly: the contention stays on
 * screen deliberately, and the DOM cannot say which box is the contention, since nodes carry
 * `data-id` and edges carry no identity at all. A first attempt guessed "at most one untagged box
 * survives" and failed on Akhlaghi, which has two contentions. Guessing a threshold would have
 * made an instrument nobody could trust.
 *
 * What IS exact: every claim it removes must be untagged, no untagged claim may appear, the
 * untagged count never grows, and something must still be drawn. Those hold on any map. The one
 * conditional -- that a map drawing three or more untagged claims must lose some -- is explained
 * where it is written.
 *
 * PROVED AGAINST THE REAL DEFECT, not a synthetic one: replace the `S.untagged` term in
 * `facetOk` with `true` -- which is the bug this control exists to fix, an untagged claim passing
 * whatever is switched off -- and this reports "switching untagged off removes something" on
 * every map that uses hashtags, in both colour schemes.
 */
async function facetFilter(page, map, scheme) {
  /* ITS OWN STATE, established here rather than inherited. The first version measured whatever
   * the map happened to be left in, which differed between the two colour passes -- the
   * self-test reloads, and after a reload the sections are folded again -- so it compared five
   * folded blocks in one pass and open claims in the other and disagreed with itself. A check
   * that depends on what ran before it is a check that will report the order of the suite. */
  await page.reload();
  await settle(page);
  await dismissWalkthrough(page);
  if (!(await clickBarButton(page, "open"))) return;
  await page.waitForTimeout(1200);

  const drawn = () => page.evaluate(() => {
    const kinds = b => (b.getAttribute("class") || "").match(/alm-k-[a-z-]+/g) || [];
    return [...document.querySelectorAll(".alm-n")].map(b => ({
      id: b.getAttribute("data-id"), tagged: kinds(b).length > 1 }));
  });

  const before = await drawn();
  if (!(await clickUntagged(page))) return;      // this map uses no hashtags at all
  await page.waitForTimeout(1000);
  const after = await drawn();

  const wasThere = new Set(before.map(x => x.id));
  const stillThere = new Set(after.map(x => x.id));
  const appeared = after.filter(x => !wasThere.has(x.id));
  const gone = before.filter(x => !stillThere.has(x.id));

  /* CLAIMS MAY APPEAR, and the first version of this check was wrong to forbid it. Removing the
   * untagged claims shortens chains and unstrands components, so the walk seeds TAGGED claims
   * that were buried below the depth limit -- nine of them on Akhlaghi. That is the control
   * doing what it is for: showing the tagged claims, including the ones you could not see.
   * What must never appear is an UNTAGGED claim, which would mean the filter let one back in. */
  const bareAppeared = appeared.filter(x => !x.tagged);
  check(bareAppeared.length === 0,
        `no untagged claim appears when untagged is switched off — ${map} [${scheme}]`,
        `${bareAppeared.length} untagged claim(s) appeared, e.g. ${
          bareAppeared.length ? bareAppeared[0].id : ""}`);
  /* IT REMOVES SOMETHING ONLY IF THERE WAS SOMETHING TO REMOVE, which the private corpus had to
   * teach this check. Williams tags heavily -- 55 tagged claims across eight hashtags, seven
   * untagged in the whole file and none of them drawn at this state -- so the switch correctly
   * did nothing, and an unconditional assertion called that a defect on two maps.
   *
   * THE ONE THRESHOLD IN THIS FILE, and it is here because the contention is exempt and the DOM
   * cannot say which box is the contention. Two untagged boxes surviving may be two contentions,
   * which is the case on Miller and on Akhlaghi. More than that and the switch has plainly not
   * done its work. A map drawing three or more untagged claims must lose some of them. */
  const bareBefore = before.filter(x => !x.tagged).length;
  const bareAfter = after.filter(x => !x.tagged).length;
  check(bareAfter <= bareBefore, `the untagged count never grows — ${map} [${scheme}]`,
        `${bareBefore} untagged drawn before, ${bareAfter} after`);
  if (bareBefore > 2)
    check(bareAfter < bareBefore, `switching untagged off removes something — ${map} [${scheme}]`,
          `${bareBefore} untagged claims drawn, and the switch removed none of them`);
  const taggedGone = gone.filter(x => x.tagged);
  check(taggedGone.length === 0, `it removes only untagged claims — ${map} [${scheme}]`,
        `${taggedGone.length} tagged claim(s) went too, e.g. ${
          taggedGone.length ? taggedGone[0].id : ""}`);

  /* AND THE APEX STAYS. Asked for after the first cut let it go: on Miller, whose contention
   * carries no tag, that left twenty-two claims and nothing at their head, which reads as a
   * fault rather than as a filter. A map that drew claims before must still draw some. */
  check(after.length > 0, `the map is not emptied by the switch alone — ${map} [${scheme}]`,
        "nothing is drawn with untagged off, so the contention did not survive");

  await clickUntagged(page);
  await page.waitForTimeout(800);
}

/* ------------------------------------------------------------------ one real gesture
 *
 * `elementFromPoint` asks what the pointer WOULD hit. This asks the browser to actually send the
 * events, which is a different question and the one that four of the fortnight's defects turned
 * on: a dispatched `contextmenu` never passes through `pointerdown`, and a dispatched `click`
 * never passes through a drag.
 *
 * Deliberately one check, on the gesture that has broken twice. The rest of instrument B is in
 * docs/QA-PLAN.md and can wait until a gesture defect escapes again.
 */
async function foldByHeader(page, map, scheme) {
  const before = await page.evaluate(() => document.querySelectorAll(".alm-n").length);
  const strip = await page.evaluate(() => {
    const f = [...document.querySelectorAll(".alm-gfold")]
      .find(x => { const r = x.getBoundingClientRect();
                   return r.width > 40 && r.top > 60 && r.bottom < innerHeight - 120; });
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!strip) return;
  await page.mouse.click(strip.x, strip.y);          // a real press and release
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => document.querySelectorAll(".alm-n").length);
  check(after !== before,
        `a real click on a section header folds it — ${map} [${scheme}]`,
        `claims on screen unchanged at ${before}; the click reached something else`);
}

/* ------------------------------------------------------------------ the key card
 *
 * The key self-offers only in the WORKBENCH (the payload pages above never show it), so it is
 * checked in a standalone build with a qualifying map dropped in — Miller, whose fidelity
 * borders, undercuts and tags clear the three-encodings gate without a manuscript. The three
 * promises come straight from its design (ipsissima-mcp docs/viewer.md): it appears once,
 * dismissing it moves nothing and is remembered, and the assembled key lives on under How to
 * use. The drop is dispatched as a real DataTransfer through the page's own drop handler —
 * the data path, which is what these checks are about; the drop gesture itself is the OS's.
 *
 * SHOWN ABLE TO FAIL, 3 Sep 2026: raising the encodings gate to `< 9` fails the first check
 * (the card never appears); stubbing `keyRemember` to a no-op fails the remembered-dismissal
 * check and the never-again check after it; stubbing `keyKept` to false fails the
 * kept-card-returns-folded check; stubbing `openKeyCard` to a bare return fails both doorbell
 * checks — and on its first run crashed the harness instead, which is why those two clicks
 * are guarded. A harness that has never failed is worth nothing.
 */
async function keyChecks(browser) {
  const miller = built.find(m => /miller/i.test(m.name));
  if (!miller) { check(false, "the key: a qualifying map exists", "no Miller sample built"); return; }
  const out = path.join(tmp, "key-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "the key: the standalone builds", String(e.message || e).slice(0, 200));
    return;
  }
  const ad = fs.readFileSync(miller.argdown, "utf8");
  const srcDir = path.join(miller.root, "source");
  const srcName = fs.readdirSync(srcDir).find(f => f.endsWith(".md"));
  const src = srcName ? fs.readFileSync(path.join(srcDir, srcName), "utf8") : "";

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  // The workbench session is held to the same no-network promise as the built maps above.
  const leaks = [];
  page.on("request", r => { if (!r.url().startsWith("file:")) leaks.push(r.url()); });
  await page.goto("file://" + out);
  // The walkthrough is settled and the key unseen — the exact state the offer waits for.
  await page.evaluate(() => {
    try { localStorage.setItem("ipsissima.walkthrough.v1", "seen"); } catch (e) { void e; }
    try { localStorage.removeItem("ipsissima.key.v1"); } catch (e) { void e; }
  });
  const drop = () => page.evaluate(({ a, aName, s, sName }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([a], aName));
    if (s) dt.items.add(new File([s], sName));
    document.dispatchEvent(new DragEvent("drop",
      { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { a: ad, aName: path.basename(miller.argdown), s: src, sName: srcName || "" });

  await drop();
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  let appeared = true;
  try { await page.waitForSelector("#keycard:not([hidden])", { timeout: 4000 }); }
  catch { appeared = false; }
  check(appeared, "the key offers itself on a qualifying map, once the walkthrough is settled");

  if (appeared) {
    const rectOf = () => page.evaluate(() => {
      const n = document.querySelector(".alm-n");
      const r = n ? n.getBoundingClientRect() : null;
      return r ? [r.left, r.top, r.width, r.height].join(",") : "none";
    });
    const stored = () => page.evaluate(() => {
      try { return localStorage.getItem("ipsissima.key.v1"); } catch (e) { return null; }
    });

    // THE FOLD IS A STANDING CHOICE. Minimise folds the card to its header and records
    // "kept"; a kept card returns, folded, on the next map opened; its header opens it back
    // out; and the × retires the whole arrangement to "seen".
    await page.click("#keymin");
    const min = await page.evaluate(() => ({
      hidden: document.getElementById("keycard").hidden,
      folded: document.getElementById("keycard").classList.contains("min"),
      body: document.getElementById("keybody").hidden,
    }));
    check(!min.hidden && min.folded && min.body && await stored() === "kept",
          "minimise folds the card to its header and records the choice",
          JSON.stringify(min) + " store=" + await stored());
    await page.reload();
    await drop();
    await page.waitForSelector(".alm-n", { timeout: 20000 });
    await page.waitForSelector("#keycard:not([hidden])", { timeout: 4000 })
      .catch(() => {});
    const kept = await page.evaluate(() => ({
      hidden: document.getElementById("keycard").hidden,
      folded: document.getElementById("keycard").classList.contains("min"),
    }));
    check(!kept.hidden && kept.folded, "a kept card returns folded on the next map",
          JSON.stringify(kept));
    await page.click("#keycard header b");
    const opened = await page.evaluate(() =>
      !document.getElementById("keycard").classList.contains("min"));
    check(opened, "and its header opens it back out");

    const withCard = await rectOf();
    const pos = await page.evaluate(() =>
      getComputedStyle(document.getElementById("keycard")).position);
    await page.click("#keyclose");
    const dismissed = await page.evaluate(() => document.getElementById("keycard").hidden);
    check(pos === "absolute" && dismissed && await rectOf() === withCard,
          "the key floats, and one click removes it without moving anything",
          `position=${pos}`);
    check(await stored() === "seen", "the dismissal is remembered — kept retired too",
          String(await stored()));

    await page.reload();
    await drop();
    await page.waitForSelector(".alm-n", { timeout: 20000 });
    await page.waitForTimeout(1400);
    const again = await page.evaluate(() => document.getElementById("keycard").hidden);
    check(again === true, "and it never offers itself again");
    const inHelp = await page.evaluate(() => {
      const k = document.getElementById("helpkeypane");
      return !!(k && k.innerHTML.length > 80);
    });
    check(inHelp, "while the assembled key lives on under How to use");

    // THE PAGE'S OWN DOORBELLS (docs/PARITY-PLAN.md): a dismissed key can be refloated from
    // its help topic, and from the map's right-click menu — so the card's reopenable form is
    // not a desktop privilege. Both are driven as the reader would drive them.
    await page.click("#helpbtn");
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("#helptoc button")]
        .find(x => x.textContent.trim() === "The key");
      if (b) b.click();
    });
    // Short timeouts and a guarded dismissal, so a broken doorbell is REPORTED as the two
    // failures it is rather than crashing the harness on the follow-up click — which is what
    // the openKeyCard-stub mutation did on its first run.
    await page.click("#keyfloat", { timeout: 4000 }).catch(() => {});
    let floated = await page.evaluate(() => ({
      card: !document.getElementById("keycard").hidden,
      help: document.getElementById("help").classList.contains("show"),
    }));
    check(floated.card && !floated.help,
          "the help topic's button floats a dismissed key, and closes the panel",
          JSON.stringify(floated));
    if (floated.card) await page.click("#keyclose");
    else await page.evaluate(() => {
      const h = document.getElementById("help");
      if (h) h.classList.remove("show");
    });

    await page.click(".alm-n", { button: "right" });
    await page.waitForSelector("#ctx:not([hidden])", { timeout: 4000 }).catch(() => {});
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("#ctx button")]
        .find(x => x.textContent.trim() === "Show the key");
      if (b) b.click();
    });
    const viaCtx = await page.evaluate(() => !document.getElementById("keycard").hidden);
    check(viaCtx, "and so does the map's right-click menu");
  }
  check(leaks.length === 0, "the workbench session makes no network request",
        leaks.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ------------------------------------------------------------------ main */

const maps = corpus();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ips-qa-"));
const t0 = Date.now();

console.log(`building ${maps.length} viewers`);
const built = [];
for (const m of maps) {
  const out = path.join(tmp, m.name + ".html");
  try {
    execFileSync("node", [BUILDER, m.argdown, "-o", out, "--source-root", m.root], { stdio: "pipe" });
    built.push({ ...m, html: out });
  } catch (e) {
    check(false, `${m.name}: the viewer builds`, String(e.message || e).slice(0, 200));
  }
}
const tBuild = Date.now() - t0;

const browser = await chromium.launch();
let panels = 0;
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e)));
  // THE FLATTEST PROMISE IN THE README, asserted at runtime rather than by grep: the page
  // "makes no network request of any kind, ever, under any circumstances". A real browser
  // records every request a session attempts, so a whole driven session — folds, panels,
  // filters, exports — is held to leaving nothing but file: requests. This is the promises
  // lint's first row (docs/values/AUTOMATION.md 4.1), living here because it needs the
  // browser. SHOWN ABLE TO FAIL, 3 Sep 2026: an in-page fetch("https://example.com/x")
  // lands in `leaks` and fails the map it ran on.
  const leaks = [];
  page.on("request", r => { if (!r.url().startsWith("file:")) leaks.push(r.url()); });
  for (const m of built) {
    errors.length = 0;
    leaks.length = 0;
    await page.goto("file://" + m.html);
    await settle(page);
    await dismissWalkthrough(page);

    // THREE STATES, all of them things a reader does with the bar. Deliberately not the whole
    // fold space: that is `test_fold_invariants.mjs`'s job and it does it far more cheaply
    // without a browser. What is wanted here is a few real pictures, painted.
    await runState(page, m.name, "opening", scheme);

    if (await clickBarButton(page, "open")) {
      await page.waitForTimeout(900);
      await runState(page, m.name, "sections open", scheme);
      panels += await runPanel(page, m.name, scheme);

      // ONCE, on the first map that can host it: prove every invariant can fail.
      if (SELFTEST && !didSelftest) {
        didSelftest = true;
        await selftest(page, "map", INVARIANTS);
        if (await openPanel(page)) await selftest(page, "panel", PANEL_INVARIANTS);
        await page.evaluate(() => {
          const x = document.getElementById("explclose"); if (x) x.click();
        });
        await page.reload(); await settle(page); await dismissWalkthrough(page);
      }
    }
    await foldByHeader(page, m.name, scheme);

    await facetFilter(page, m.name, scheme);

    if (await clickBarButton(page, "full")) {
      await page.waitForTimeout(900);
      await runState(page, m.name, "claims full", scheme);
    }

    // A PAGE THAT THREW IS NOT A PAGE THAT PASSED, however green its geometry.
    check(errors.length === 0, `${m.name} raises no error [${scheme}]`, errors.join(" | "));
    check(leaks.length === 0, `${m.name} makes no network request [${scheme}]`,
          leaks.slice(0, 3).join(" | "));
  }
  await ctx.close();
}
await keyChecks(browser);
await browser.close();
if (!KEEP) fs.rmSync(tmp, { recursive: true, force: true });

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n${built.length} maps, ${panels} panels, both colour schemes, ` +
            `${proved} invariants proved able to fail — ${checks} checks in ${secs}s ` +
            `(${(tBuild / 1000).toFixed(1)}s of it building)`);
if (fails) {
  console.log(`\n${fails} FAILED:`);
  for (const f of failures) console.log("  FAIL  " + f);
  process.exit(1);
}
console.log("all rendered invariants held");
