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

/* ------------------------------------------------------------------ export without a manuscript
 *
 * A reconstruction that cites no manuscript at all still draws a map, and a self-contained copy
 * of that map is still the thing somebody wants to send — but until 4 Sep 2026 the Export button
 * answered only to `msAvailable()`, so File ▸ Export did nothing on such a map, silently (found
 * on Betz's censorship example, whose `source:` fields are the Argdown guide's labels, not
 * files). The fixture is synthetic for the same reason the private corpus is private. What is
 * promised: the button shows, the page export is live, the bundle entry is disabled with its
 * remedy rather than absent, and the exported page renders on its own.
 *
 * SHOWN ABLE TO FAIL, 4 Sep 2026: reverting the gate to its old `msAvailable()`-only form fails
 * the button check (and the two after it, guardedly); hard-coding the menu's `bundleable` to
 * true fails the disabled-entry check. The download is driven with `showSaveFilePicker` removed,
 * so `saveBlob` takes the <a download> route a headless browser can witness.
 */
const NO_MS_FIXTURE = [
  "===", "title: A map with no manuscript", "===", "",
  "[Alpha]: The first claim, standing on its own without any manuscript behind it.", "",
  "<One>: An argument for Alpha.", "",
  "(1) The first premise of the only argument here.",
  "(2) If the first premise holds, Alpha holds.",
  "----",
  "(3) [Alpha]", "",
].join("\n");

async function exportChecks(browser) {
  const out = path.join(tmp, "export-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "export: the standalone builds", String(e.message || e).slice(0, 200));
    return;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(String(e.message || e)));
  await page.goto("file://" + out);
  await page.evaluate(() => {
    try { localStorage.setItem("ipsissima.walkthrough.v1", "seen"); } catch (e) { void e; }
    try { localStorage.setItem("ipsissima.key.v1", JSON.stringify({ state: "seen" })); } catch (e) { void e; }
    delete window.showSaveFilePicker;
  });
  await page.evaluate(text => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], "no-manuscript.argdown"));
    document.dispatchEvent(new DragEvent("drop",
      { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, NO_MS_FIXTURE);
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  const nodesHere = await page.evaluate(() => document.querySelectorAll(".alm-n").length);

  const offered = await page.evaluate(() => !document.getElementById("expbtn").hidden);
  check(offered, "a map with no manuscript still offers Export");

  if (offered) {
    // The desktop menu's own gesture: a JS click on the button, seen or not.
    await page.evaluate(() => document.getElementById("expbtn").click());
    await page.waitForSelector("#ctx:not([hidden])", { timeout: 4000 }).catch(() => {});
    const entries = await page.evaluate(() =>
      [...document.querySelectorAll("#ctx button")].map(b =>
        ({ text: b.textContent, disabled: b.disabled })));
    const pageEntry = entries.find(e => /web page/i.test(e.text));
    const bundleEntry = entries.find(e => /\.argdown/i.test(e.text));
    check(!!pageEntry && !pageEntry.disabled, "its menu offers the page export, live",
          JSON.stringify(entries).slice(0, 200));
    check(!!bundleEntry && bundleEntry.disabled && /open the folder/i.test(bundleEntry.text),
          "while the bundle entry is disabled with its remedy, not absent",
          JSON.stringify(bundleEntry));

    if (pageEntry && !pageEntry.disabled) {
      const dl = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
      await page.click("#ctx button:not([disabled])");
      const got = await dl;
      check(!!got, "clicking it produces the file", "no download arrived");
      if (got) {
        const saved = path.join(tmp, "no-manuscript-export.html");
        await got.saveAs(saved);
        const p2 = await ctx.newPage();
        const errs2 = [];
        p2.on("pageerror", e => errs2.push(String(e.message || e)));
        await p2.goto("file://" + saved);
        let nodesThere = 0;
        try {
          await p2.waitForSelector(".alm-n", { timeout: 20000 });
          nodesThere = await p2.evaluate(() => document.querySelectorAll(".alm-n").length);
        } catch (e) { void e; }
        check(nodesThere === nodesHere && errs2.length === 0,
              "and the exported page renders the same map on its own",
              `nodes ${nodesThere}/${nodesHere} errors=${errs2.join(" | ")}`);
      }
    }

    // THE MAP'S OWN DOOR (4 Sep 2026): the Notes tab hides on a map with no marks, so the
    // browser page reaches Export from the right-click menu instead — and the export menu
    // stays where the reader right-clicked rather than leaping to the hidden button's corner.
    // SHOWN ABLE TO FAIL: dropping the entry's `$("expbtn").click()` fails the opens-check
    // (and the stays-put check after it, guardedly); dropping its `ctxPlace(...)` re-place
    // sends the menu to the clamped corner and fails the stays-put check alone.
    await page.click(".alm-n", { button: "right" });
    await page.waitForSelector("#ctx:not([hidden])", { timeout: 4000 }).catch(() => {});
    const before = await page.evaluate(() => {
      const c = document.getElementById("ctx");
      const b = [...c.querySelectorAll("button")].find(x => /^Export…$/.test(x.textContent));
      const pos = { left: c.style.left, top: c.style.top, entry: !!b };
      if (b) b.click();
      return pos;
    });
    const after = await page.evaluate(() => {
      const c = document.getElementById("ctx");
      return { open: !c.hidden,
               title: (c.querySelector(".ctxhead") || {}).textContent || "",
               page: [...c.querySelectorAll("button")].some(x => /web page/i.test(x.textContent)),
               left: c.style.left, top: c.style.top };
    });
    check(before.entry && after.open && after.title === "Export" && after.page,
          "the map's right-click menu opens the export menu",
          JSON.stringify({ before, after }).slice(0, 200));
    if (before.entry && after.open)
      check(after.left === before.left && after.top === before.top,
            "which stays where the reader right-clicked",
            `${before.left},${before.top} -> ${after.left},${after.top}`);
    await page.keyboard.press("Escape").catch(() => {});
  }
  check(pageErrors.length === 0, "the export session raises no error", pageErrors.join(" | "));
  await ctx.close();
}

/* ------------------------------------------------------------------ a phone's screen
 *
 * Reported from Android (Chrome and Firefox both, 4 Sep 2026): pinch-to-zoom did nothing —
 * touch-action:none suppressed the browser's zoom and the map had only written the wheel's —
 * and the footer plus the map bar spent a tenth of a small screen on chrome. What is promised
 * now: a pinch zooms the map both ways, driven here as the REAL gesture through CDP's touch
 * synthesis rather than as dispatched events; the footer yields its rows at phone width, its
 * facts recallable in the Help statistics; and the bar folds to a chip whose choice is
 * remembered. SHOWN ABLE TO FAIL, 4 Sep 2026: stubbing the pinch pointermove fails both zoom
 * checks; dropping the footer's media rule fails the footer check; dropping the template's
 * barFolded wiring fails the remembered-fold check.
 */
async function mobileChecks(browser) {
  const miller = built.find(m => /miller/i.test(m.name));
  if (!miller) { check(false, "mobile: a manuscript map exists", "no Miller sample built"); return; }
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(String(e.message || e)));
  await page.goto("file://" + miller.html);
  await page.evaluate(() => {
    try { localStorage.setItem("ipsissima.walkthrough.v1", "seen"); } catch (e) { void e; }
    try { localStorage.setItem("ipsissima.key.v1", JSON.stringify({ state: "seen" })); } catch (e) { void e; }
    try { localStorage.removeItem("ipsissima.mapbar.v1"); } catch (e) { void e; }
  });
  await page.reload();
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  await page.waitForTimeout(600);

  check(await page.evaluate(() =>
          getComputedStyle(document.getElementById("stats").closest("footer")).display === "none"),
        "the footer yields its rows at phone width");
  check(await page.evaluate(() =>
          /exposition: /.test(document.getElementById("helpstats").textContent)),
        "while its exposition verdict is recallable in the Help statistics");

  const scaleOf = () => page.evaluate(() => {
    const m = /scale\(([\d.]+)\)/.exec(
      document.querySelector(".alm-viewport").style.transform || "");
    return m ? +m[1] : null;
  });
  const k0 = await scaleOf();
  const cdp = await ctx.newCDPSession(page);
  // gestureSourceType is forced to "touch": left to the platform default, headless Chromium
  // synthesizes ctrl+wheel instead, and the check then exercises the WHEEL handler — which is
  // exactly what its first mutation run proved, by passing with the pinch handler stubbed.
  await cdp.send("Input.synthesizePinchGesture",
    { x: 187, y: 380, scaleFactor: 2.0, relativeSpeed: 300, gestureSourceType: "touch" });
  await page.waitForTimeout(300);
  const k1 = await scaleOf();
  await cdp.send("Input.synthesizePinchGesture",
    { x: 187, y: 380, scaleFactor: 0.5, relativeSpeed: 300, gestureSourceType: "touch" });
  await page.waitForTimeout(300);
  const k2 = await scaleOf();
  check(k0 != null && k1 != null && k1 > k0 * 1.15, "a pinch spread zooms the map in",
        `k ${k0} -> ${k1}`);
  check(k2 != null && k1 != null && k2 < k1 * 0.85, "and a pinch closed zooms it back out",
        `k ${k1} -> ${k2}`);

  const barState = () => page.evaluate(() => ({
    bar: !document.querySelector(".alm-bar").hidden,
    chip: !document.querySelector(".alm-barchip").hidden,
    store: (() => { try { return localStorage.getItem("ipsissima.mapbar.v1"); }
                    catch (e) { return null; } })(),
  }));
  await page.tap(".alm-barfold").catch(() => {});
  const folded = await barState();
  check(!folded.bar && folded.chip && folded.store === "folded",
        "the bar folds to a chip and the choice is recorded", JSON.stringify(folded));
  await page.reload();
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  await page.waitForTimeout(400);
  const kept = await barState();
  check(!kept.bar && kept.chip, "a folded bar stays folded on the next load",
        JSON.stringify(kept));
  await page.tap(".alm-barchip").catch(() => {});
  const back = await barState();
  check(back.bar && !back.chip && back.store === "open",
        "and the chip brings it back, recorded too", JSON.stringify(back));

  check(pageErrors.length === 0, "the phone session raises no error", pageErrors.join(" | "));
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
/* ---------------------------------------------------------- the text's provenance chip */
/* A map may declare that the text it reads was machine-generated (front matter
 * `text-provenance: generated`), and the reader must meet that declaration beside the
 * title — a checked-quotation border otherwise lends the manuscript the look of an
 * authored source (docs/values/SECOND-THOUGHTS.md). Driven as a reader would drive it:
 * two real drops, one declaring and one not, because a chip that never hides is as wrong
 * as one that never shows. */
async function genTextChecks(browser) {
  const out = path.join(tmp, "gentext-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "text-provenance: the standalone builds", String(e.message || e).slice(0, 200));
    return;
  }
  const declared = [
    "===",
    "title: A generated-text reading",
    "text-provenance: generated",
    "===",
    "",
    "[a]: A claim.",
    "    + [b]: Its reason.",
    ""
  ].join("\n");
  const plain = declared.split("\n").filter(l => !/^text-provenance/.test(l)).join("\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.goto("file://" + out);
  const drop = (text, name) => page.evaluate(({ t, n }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([t], n));
    document.dispatchEvent(new DragEvent("drop",
      { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { t: text, n: name });
  await drop(declared, "gen.argdown");
  await page.waitForFunction(() =>
    document.getElementById("fname").textContent === "gen.argdown", { timeout: 20000 });
  const shown = await page.evaluate(() => {
    const c = document.getElementById("gentext");
    return { hidden: c.hidden, text: c.textContent };
  });
  check(!shown.hidden && shown.text === "AI-written text",
        "a declared text-provenance shows beside the title", JSON.stringify(shown));
  await drop(plain, "plain.argdown");
  await page.waitForFunction(() =>
    document.getElementById("fname").textContent === "plain.argdown", { timeout: 20000 });
  const gone = await page.evaluate(() => document.getElementById("gentext").hidden);
  check(gone === true, "and an undeclared one shows nothing", String(gone));
  await ctx.close();
}

/* ------------------------------------------------------------ the go-to-source gesture */
/* The two-promises doctrine (docs/NAVIGATION.md): the go-to gesture opens the Manuscript
 * where there is one, and on a map that reads no text it says so instead of demanding a
 * folder that never existed. Driven by real double-clicks on the painted node, because a
 * synthetic event would skip the path under test. */
async function navChecks(browser) {
  const miller = built.find(m => /miller/i.test(m.name));
  const out = path.join(tmp, "nav-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "nav: the standalone builds", String(e.message || e).slice(0, 200));
    return;
  }
  const sourceless = [
    "[a]: A claim of a debate map.",
    "    + [b]: Its reason.",
    ""
  ].join("\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.goto("file://" + out);
  const drop = (files) => page.evaluate((fl) => {
    const dt = new DataTransfer();
    for (const f of fl) dt.items.add(new File([f.t], f.n));
    document.dispatchEvent(new DragEvent("drop",
      { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, files);

  await drop([{ t: sourceless, n: "debate.argdown" }]);
  await page.waitForFunction(() =>
    document.getElementById("fname").textContent === "debate.argdown", { timeout: 20000 });
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  const box = await page.locator(".alm-n").first().boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  const said = await page.evaluate(() => ({
    shown: document.getElementById("err").classList.contains("show"),
    text: document.getElementById("errmsg").textContent,
    ms: document.getElementById("ms").hidden
  }));
  check(said.shown && /reads no text/.test(said.text) && said.ms,
        "on a sourceless map the go-to gesture says so, and summons nothing",
        JSON.stringify(said));

  if (miller) {
    const ad = fs.readFileSync(miller.argdown, "utf8");
    const srcDir = path.join(miller.root, "source");
    const srcName = fs.readdirSync(srcDir).find(f => f.endsWith(".md"));
    const src = fs.readFileSync(path.join(srcDir, srcName), "utf8");
    await drop([{ t: ad, n: path.basename(miller.argdown) }, { t: src, n: srcName }]);
    await page.waitForFunction((want) =>
      document.getElementById("fname").textContent === want,
      path.basename(miller.argdown), { timeout: 20000 });
    await page.waitForSelector(".alm-n", { timeout: 20000 });
    const before = await page.evaluate(() => document.getElementById("ms").hidden);
    const b2 = await page.locator(".alm-n").first().boundingBox();
    await page.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2);
    const after = await page.evaluate(() => document.getElementById("ms").hidden);
    check(before === true && after === false,
          "on a reading it opens the Manuscript, which is the thing asked for",
          `before=${before} after=${after}`);
  } else {
    check(false, "nav: a qualifying reading exists", "no Miller sample built");
  }
  await ctx.close();
}

/* ------------------------------------------------------------------ title completion */
/* Reuse of a defined title is how Argdown expresses structure, and the editor now offers the
 * titles the last good parse knows when `[` is typed. Driven as a writer would drive it:
 * start a reconstruction from the cold panel, click into the editor, type — and the list
 * that appears must contain a title the skeleton defines. */
async function editorChecks(browser) {
  const out = path.join(tmp, "editor-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "--editor", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "completion: the editor build builds", String(e.message || e).slice(0, 200));
    return;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.goto("file://" + out);
  await page.click("#picknew");
  await page.waitForSelector(".cm-content", { timeout: 20000 });
  // SETUP BY API, BEHAVIOUR BY KEYBOARD: the caret is placed at the document's end through
  // the editor's own published handle (Ctrl+End is not a macOS binding, and a click lands
  // wherever the skeleton happens to wrap), and everything under test — the typing, the
  // auto-close, the completion — is real keys.
  await page.evaluate(() => {
    const ed = window.__ARGDOWN_EDITOR__;
    ed.view.dispatch({ selection: { anchor: ed.view.state.doc.length },
                       scrollIntoView: true });
    ed.view.contentDOM.focus();
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("+ [", { delay: 40 });
  let offered = [];
  try {
    await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 4000 });
    offered = await page.evaluate(() =>
      [...document.querySelectorAll(".cm-tooltip-autocomplete .cm-completionLabel")]
        .map(e => e.textContent));
  } catch { /* asserted below */ }
  check(offered.includes("main-claim"),
        "typing [ offers the titles the map defines",
        "offered: " + (offered.join(", ") || "nothing"));
  // And the bracket auto-closed around the caret while the list was up.
  const around = await page.evaluate(() => {
    const s = window.__ARGDOWN_EDITOR__.view.state;
    const p = s.selection.main.head;
    return s.doc.sliceString(Math.max(0, p - 1), p + 1);
  });
  check(around === "[]", "and the [ closed itself behind the caret", JSON.stringify(around));
  await ctx.close();
}

/* ------------------------------------------------------------------ selection-to-claim */
/* The provenance is written by the machine that can see it (docs/EDITOR-PLAN.md §2): select
 * words in the Manuscript, click once, and a claim arrives with fidelity: quotation, the
 * source recorded verbatim behind its escapes, and the title selected for renaming. Driven
 * by a real mouse drag, which also holds the guard the measurement demanded: a drag that
 * selects must not light claims or move the camera. */
async function quoteChecks(browser) {
  const miller = built.find(m => /miller/i.test(m.name));
  if (!miller) { check(false, "quote: a qualifying reading exists", "no Miller sample built"); return; }
  const out = path.join(tmp, "quote-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "--editor", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "quote: the editor build builds", String(e.message || e).slice(0, 200));
    return;
  }
  const ad = fs.readFileSync(miller.argdown, "utf8");
  const srcDir = path.join(miller.root, "source");
  const srcName = fs.readdirSync(srcDir).find(f => f.endsWith(".md"));
  const src = fs.readFileSync(path.join(srcDir, srcName), "utf8");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.goto("file://" + out);
  await page.evaluate(({ a, aName, s, sName }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([a], aName));
    dt.items.add(new File([s], sName));
    document.dispatchEvent(new DragEvent("drop",
      { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { a: ad, aName: path.basename(miller.argdown), s: src, sName: srcName });
  await page.waitForSelector(".alm-n", { timeout: 20000 });
  await page.click('button[data-p="text"]');
  await page.waitForSelector("#mstext [data-l]", { timeout: 20000 });
  const para = await page.locator("#mstext [data-l]").first().boundingBox();
  const y = para.y + Math.min(10, para.height / 2);
  await page.mouse.move(para.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(para.x + Math.min(260, para.width * 0.6), y, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => ({
    sel: String(getSelection()).length,
    btn: document.getElementById("msquote").hidden,
    note: document.getElementById("msnote").textContent
  }));
  check(afterDrag.sel > 3 && afterDrag.btn === false,
        "dragging over the text offers Quote this passage", JSON.stringify(afterDrag));
  check(afterDrag.note === "",
        "  and the selecting drag lit nothing — a drag that selects is not a click that asks",
        JSON.stringify(afterDrag.note));
  const before = await page.evaluate(() =>
    window.__ARGDOWN_EDITOR__.view.state.doc.length);
  await page.click("#msquote");
  const got = await page.evaluate(() => {
    const v = window.__ARGDOWN_EDITOR__.view;
    return { tail: v.state.doc.sliceString(Math.max(0, v.state.doc.length - 400)),
             grew: v.state.doc.length,
             renaming: v.state.doc.sliceString(v.state.selection.main.from,
                                               v.state.selection.main.to) };
  });
  check(got.grew > before && /fidelity: "quotation"/.test(got.tail) &&
        /source: "\\"/.test(got.tail),
        "one click writes the claim with its provenance filled in",
        got.tail.slice(-160));
  check(got.renaming.length > 0 && got.tail.includes("[" + got.renaming + "]"),
        "  and the title arrives selected, ready to be renamed",
        JSON.stringify(got.renaming));

  // THE OTHER DOOR: a paraphrase's text is the reader's judgement, so the machine writes
  // only the provenance and hands the caret to the placeholder — what arrives selected is
  // the human's half, not the title.
  const para2 = await page.locator("#mstext [data-l]").nth(1).boundingBox();
  const y2 = para2.y + Math.min(10, para2.height / 2);
  await page.mouse.move(para2.x + 4, y2);
  await page.mouse.down();
  await page.mouse.move(para2.x + Math.min(220, para2.width * 0.5), y2, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector("#mspara:not([hidden])", { timeout: 4000 });
  await page.click("#mspara");
  const p = await page.evaluate(() => {
    const v = window.__ARGDOWN_EDITOR__.view;
    return { tail: v.state.doc.sliceString(Math.max(0, v.state.doc.length - 400)),
             selected: v.state.doc.sliceString(v.state.selection.main.from,
                                               v.state.selection.main.to) };
  });
  check(/fidelity: "paraphrase"/.test(p.tail) && /source: "\\"/.test(p.tail),
        "Paraphrase it writes the provenance and not the reader's words",
        p.tail.slice(-160));
  check(p.selected === "The passage, said in your own words.",
        "  and the placeholder text arrives selected — the human's half, not the title",
        JSON.stringify(p.selected));
  await ctx.close();
}

/* ------------------------------------------------------------------ the guided mode */
/* Start from a text (docs/EDITOR-PLAN.md §3): the paste door, then five steps with
 * selection-to-claim as the only gesture. Driven as a reader would drive it — the door
 * filled and clicked, the selections made with a real mouse drag — and the file the steps
 * produce must carry what the design promises: the policy block written first, the premise
 * wired to the conclusion the reader chose, the imputation with its warrant. */
async function guidedChecks(browser) {
  const out = path.join(tmp, "guided-standalone.html");
  try {
    execFileSync("node", [BUILDER, "--standalone", "--editor", "-o", out], { stdio: "pipe" });
  } catch (e) {
    check(false, "guided: the editor build builds", String(e.message || e).slice(0, 200));
    return;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.goto("file://" + out);
  await page.click("#picknewtext");
  await page.fill("#pastetext",
    "Every citizen deserves a vote at sixteen. Young people already work and pay taxes.\n\n" +
    "Those who bear the burdens of law ought to have a say in making it.");
  await page.fill("#pastewho", "A. Sample, The Franchise Question, 2020");
  await page.click("#pastebegin");
  await page.waitForSelector("#mstext [data-l]", { timeout: 20000 });
  const opened = await page.evaluate(() => ({
    step: document.getElementById("guidecard").dataset.step,
    ms: !document.getElementById("ms").hidden,
    bundle: !document.getElementById("adbundle").hidden,
    abs: !document.getElementById("abs").hidden,
    doc: window.__ARGDOWN_EDITOR__.view.state.doc.sliceString(0, 220)
  }));
  check(opened.step === "1" && opened.ms && opened.bundle,
        "the paste door opens the text, the bundle, and the guide's first step",
        JSON.stringify({ step: opened.step, ms: opened.ms, bundle: opened.bundle }));
  check(opened.abs, "  and whose-text-this-is is offered as orientation", String(opened.abs));
  check(/reconstruction:/.test(opened.doc) && /defaults:/.test(opened.doc),
        "  and the reading-policy block was written first", opened.doc.slice(0, 90));

  const dragOver = async (idx, w) => {
    const para = await page.locator("#mstext [data-l]").nth(idx).boundingBox();
    const y = para.y + Math.min(10, para.height / 2);
    await page.mouse.move(para.x + 4, y);
    await page.mouse.down();
    await page.mouse.move(para.x + Math.min(w, para.width * 0.6), y, { steps: 8 });
    await page.mouse.up();
    await page.waitForSelector("#msquote:not([hidden])", { timeout: 4000 });
    await page.click("#msquote");
  };
  await dragOver(0, 240);
  const s2 = await page.evaluate(() => ({
    step: document.getElementById("guidecard").dataset.step,
    tail: window.__ARGDOWN_EDITOR__.view.state.doc.sliceString(
      Math.max(0, window.__ARGDOWN_EDITOR__.view.state.doc.length - 200))
  }));
  check(s2.step === "2" && /fidelity: "quotation"/.test(s2.tail),
        "the conclusion advances the guide", JSON.stringify(s2.step));
  await dragOver(1, 220);
  const wired = await page.evaluate(() =>
    /\+> \[/.test(window.__ARGDOWN_EDITOR__.view.state.doc.toString()));
  check(wired, "  and a premise arrives already connected to it", String(wired));

  await page.click("#guidebtns button.primary");   // -> 3, the evidence
  await page.click("#guidebtns button.primary");   // -> 4, the unspoken
  await page.click("#guidebtns button.primary");   // Yes — add one
  const imp = await page.evaluate(() => {
    const v = window.__ARGDOWN_EDITOR__.view;
    return { doc: v.state.doc.toString(),
             sel: v.state.doc.sliceString(v.state.selection.main.from,
                                          v.state.selection.main.to) };
  });
  check(/warrant: "enthymeme"/.test(imp.doc) &&
        imp.sel === "The premise the argument needs and the text never states.",
        "the unspoken assumption arrives as an imputation, its text handed to the reader",
        JSON.stringify(imp.sel));
  await page.click("#guidebtns button.primary");   // Finish -> 5
  const five = await page.evaluate(() =>
    document.getElementById("guidecard").dataset.step);
  check(five === "5", "  and the last step turns to the policy block", five);
  await page.click("#guidebtns button:not(.primary)");   // Done
  const gone = await page.evaluate(() => document.getElementById("guidecard").hidden);
  check(gone === true, "  Done puts the guide away", String(gone));
  await ctx.close();
}

await keyChecks(browser);
await genTextChecks(browser);
await navChecks(browser);
await editorChecks(browser);
await quoteChecks(browser);
await guidedChecks(browser);
await exportChecks(browser);
await mobileChecks(browser);
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
