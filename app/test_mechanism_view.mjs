/* The Mechanism arrangement: one set of rules in two languages, and a page that keeps its word.
 *
 *   node app/test_mechanism_view.mjs
 *
 * TWO IMPLEMENTATIONS, ONE ANSWER. The chain's rules live in ipsissima-mcp's mechanism.py (the
 * checker's census) and are ported to src/argdown-mechanism.js (the page's drawing). Two copies of
 * a rule drift; the positions module learned that, and test_argdown_positions.mjs exists to police
 * it. So the first half runs both on the same planted file and requires the same profile, field
 * for field.
 *
 * THE PAGE'S PROMISES, KEPT UNDER REAL CLICKS. The second half builds a viewer and drives it with
 * Playwright's real input -- never dispatched events, which skip the very path under test. It holds
 * the page to what the rescoped design promised: the arrangement offered only for a map with a
 * chain; the appraisal off until asked for, and off meaning OFF everywhere, the panel included;
 * switching a layer moving nothing else; a chip opening its own arrow even where another arrow's
 * hit stroke runs over it (the defect the first real-click drive found); and a claim reaching its
 * passage. Skipped, not failed, where Chromium is not installed, as test_rendered_dom does.
 *
 * Each browser invariant was mutation-tested when written: the note beside it names the mutation.
 */
import { argdown } from "@argdown/core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
const MV = require("./src/argdown-mechanism.js");
const FIXTURE = path.join(REPO, "ipsissima-mcp", "tests", "mechanism");
const CHAIN = path.join(FIXTURE, "chain.argdown");
const VENV = path.join(REPO, "ipsissima-mcp", ".venv", "bin", "python");
const PY = fs.existsSync(VENV) ? VENV : "python3";

let fails = 0, checks = 0;
function check(ok, what, detail) {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok || detail == null ? "" : `\n          ${detail}`));
  if (!ok) fails++;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const graphOf = file => toGraph(argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN }));
graphOf.fromText = text => toGraph(argdown.run({ input: text, ...RUN }));

/* ------------------------------------------------------------ one answer in two languages */
console.log("the page's model and the checker's census agree");
const G = graphOf(CHAIN);
const M = MV.model(G);
const py = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                        CHAIN, "--format", "json"], { encoding: "utf8" })).shape.chain;
for (const k of Object.keys(py)) {
  if (k === "question") continue;
  const js = k === "gaps" ? M.profile.gaps.map(g => g.message) : M.profile[k];
  check(same(js, py[k]), `\`${k}\` is the same in both`, `python ${JSON.stringify(py[k])}\n          js     ${JSON.stringify(js)}`);
}
// AND ON EVERY SAMPLE THAT DECLARES A CHAIN. The planted fixture has no premise-conclusion
// structure, and the J-PAL sample showed what that hid: a step on an intermediary conclusion is
// argued for (its premises infer it), which the checker counted and the page, reading only drawn
// edges, did not -- "1 argued" beside the census's "2" (26 Sep 2026).
const SAMPLES = path.join(REPO, "samples"), SAMPLE_LAYOUTS = [];
for (const dir of fs.readdirSync(SAMPLES)) {
  const d = path.join(SAMPLES, dir);
  if (!fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d).filter(f => f.endsWith(".argdown"))) {
    const file = path.join(d, f);
    if (!/^mechanism:/m.test(fs.readFileSync(file, "utf8"))) continue;
    const pyS = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                             file, "--format", "json"], { encoding: "utf8" })).shape.chain;
    const MS = MV.model(graphOf(file));
    const differ = Object.keys(pyS).filter(k => k !== "question" &&
      !same(k === "gaps" ? MS.profile.gaps.map(g => g.message) : MS.profile[k], pyS[k]));
    check(differ.length === 0, `${dir.slice(0, 40)}: the page and the checker agree on its chain`,
          differ.map(k => `${k}: python ${JSON.stringify(pyS[k])} js ${JSON.stringify(MS.profile[k])}`).join("\n          "));
    SAMPLE_LAYOUTS.push([dir, MV.layout(MS)]);
  }
}
// Every appraisal claim in the fixture is wired to something, so the case is planted here: a claim
// with a step and no relation, which Argdown's map selection drops from the drawn nodes.
const lone = toGraph(argdown.run({ input: fs.readFileSync(CHAIN, "utf8") + `
[Nobody asked the judges]: Nobody asked the judges what would move them. #appraisal
    {fidelity: "imputation", warrant: "a missing first link", causes: {from: policy, to: order, sign: "+"}}
`, ...RUN }));
check(!lone.nodes.some(n => n.label === "Nobody asked the judges") &&
      MV.model(lone).steps.some(s => s.claim.title === "Nobody asked the judges"),
      "a claim the map never draws still reaches the chain (read from the parser, not the nodes)");

console.log("\nthe layout");
const L = MV.layout(M);
check(same(L, MV.layout(MV.model(graphOf(CHAIN)))), "is a pure function of the chain: the same file lays out the same");
const laneOf = {}; L.lanes.forEach(l => { laneOf[l.level] = l; });
const inLane = Object.entries(L.nodes).every(([id, p]) => {
  const lv = (M.actors[M.states[id].actor] || {}).level, ln = laneOf[lv];
  return ln && p.y >= ln.y && p.y + p.h <= ln.y + ln.h;
});
check(inLane, "every state sits inside its own level's band");
check(L.edges.every(e => L.nodes[e.from] && L.nodes[e.to]), "every arrow has both ends laid out");
check(Object.keys(L.nodes).includes("risk"), "the appraisal's own states are laid out too, so switching the layer moves nothing");
check(L.edges.some(e => e.back), "a loop is laid out as a loop (a back edge), not unrolled");

// NOTHING SITS ON ANYTHING. The first build put chips under arrowheads and on one another, and ran
// the actors' names under the first column's boxes (J-PAL sample, 26 Sep 2026). Mutation: set
// CHIP_DY to [0] -> the J-PAL sample's chips collide; drop HEAD from the node y -> boxes cover
// the lane heads.
function clashes(L) {
  const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                       Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const chips = L.edges.map(e => ({ x: e.chip.x - e.chip.w / 2, y: e.chip.y - e.chip.h / 2, w: e.chip.w, h: e.chip.h }));
  const boxes = Object.values(L.nodes);
  const heads = L.edges.filter(e => e.stub).map(e => { const [x, y] = e.curve[3];
    return e.back ? { x: x - 7, y: y - 14, w: 14, h: 14 } : { x, y: y - 6, w: 12, h: 12 }; });
  let n = 0;
  chips.forEach((c, i) => { if (boxes.some(b => ov(c, b)) || heads.some(h => ov(c, h)) ||
                                chips.some((d, j) => j !== i && ov(c, d))) n++; });
  const laneOf = {}; L.lanes.forEach(l => { laneOf[l.y] = l; });
  const underHead = Object.values(L.nodes).filter(p => !L.lanes.some(l => p.y >= l.y + 24 && p.y + p.h <= l.y + l.h)).length;
  return { chips: n, underHead };
}
check(same(clashes(L), { chips: 0, underHead: 0 }), "no chip sits on a box, an arrowhead or another chip, and no box on a lane's heading",
      JSON.stringify(clashes(L)));
check(L.edges.every(e => e.kind === "null" ? !e.stub : !!e.stub),
      "every arrow but a null's ends on a short solid stub carrying its head");

// A TRIAL-SHAPED CHAIN, planted: an intervention one lane up, fanning to four stacked states that
// each act on one outcome, and two findings of opposite sign on one step. It is the shape of the
// FAST falls trial (26 Sep 2026), where the first drawing bundled the fan and said "mixed".
const FAN = graphOf.fromText(`===
title: "Fan"
mechanism:
    question: "How would the programme reduce falls?"
    actors:
        team: {label: "Therapists", level: meso}
        person: {label: "Stroke survivor", level: micro}
    states:
        prog: {label: "Programme", actor: team, role: intervention}
        a: {label: "Exercise", actor: person}
        b: {label: "Home safety", actor: person}
        c: {label: "Balance", actor: person}
        d: {label: "Mobility", actor: person}
        falls: {label: "Falls", actor: person, role: outcome}
===

[Ends]: The programme is worth offering.
` + ["a", "b", "c", "d"].map(x => `
[P${x}]: The programme changes ${x}. {causes: {from: prog, to: ${x}, sign: "+", basis: study}}
    +> [Ends]

[${x}F]: Change in ${x} lowers falls. {causes: {from: ${x}, to: falls, sign: "-", basis: asserted}}
    +> [Ends]
`).join("") + `
[Exercise raised falls]: An earlier trial found exercise raised falls. {causes: {from: a, to: falls, sign: "+", basis: study}}
    +> [Ends]
`);
const FL = MV.layout(MV.model(FAN));
// Mutation: drop the sign from the group key -> one "mixed" arrow.
check(FL.edges.length === 9, "the planted fan is read whole: nine arrows", FL.edges.length);
check(same(FL.edges.filter(e => e.from === "a" && e.to === "falls").map(e => e.chip.label).sort(), ["lowers", "raises"]),
      "two findings of opposite sign on one step are two arrows, each saying which way",
      JSON.stringify(FL.edges.filter(e => e.from === "a" && e.to === "falls").map(e => e.chip.label)));
// NO ARROW RUNS THROUGH A BOX it does not start or end at. Mutation: drop the `blocked` test ->
// the stacked states' arrows to the outcome leave from their tops and run up through the boxes
// above them; drop the bottom ports altogether -> passes, but the next check fails.
const through = L2 => L2.edges.filter(e => {
  const P = e.curve;
  for (let i = 1; i < 40; i++) {
    const t = i / 40, u = 1 - t, x = u*u*u*P[0][0] + 3*u*u*t*P[1][0] + 3*u*t*t*P[2][0] + t*t*t*P[3][0],
          y = u*u*u*P[0][1] + 3*u*u*t*P[1][1] + 3*u*t*t*P[2][1] + t*t*t*P[3][1];
    if (Object.entries(L2.nodes).some(([id, n]) => id !== e.from && id !== e.to &&
        x > n.x + 2 && x < n.x + n.w - 2 && y > n.y + 2 && y < n.y + n.h - 2)) return true;
  }
  return false;
}).map(e => e.from + ">" + e.to);
check(same(through(FL), []), "no arrow in the fan runs through a box it does not start or end at", JSON.stringify(through(FL)));
// Mutation: drop the bottom ports -> every arrow leaves the intervention's right side.
check(FL.edges.filter(e => e.from === "prog").every(e => e.curve[0][1] === FL.nodes.prog.y + FL.box.h),
      "an intervention fanning to states in the lane below leaves from its bottom edge, one point each");
check(same(clashes(FL), { chips: 0, underHead: 0 }), "and nothing in it sits on anything", JSON.stringify(clashes(FL)));

for (const [dir, SL] of SAMPLE_LAYOUTS)
  check(same(clashes(SL), { chips: 0, underHead: 0 }), `${dir.slice(0, 40)}: nothing sits on anything`, JSON.stringify(clashes(SL)));

console.log("\na map with no chain");
const plain = graphOf(path.join(REPO, "samples", "Darwin 1859 - Natural selection", "darwin-natural-selection.argdown"));
check(plain.mechanism === null, "carries no mechanism");
check(MV.model(plain) === null, "and the page builds no model");

/* ------------------------------------------------------------ the page, under real clicks */
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); }
catch (e) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("\nFAIL — Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("\nSKIPPED the browser half — Playwright's Chromium is not installed here.");
  chromium = null;
}
if (chromium) {
  console.log("\nthe page, driven with real clicks");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mechanism-view-"));
  const withChain = path.join(tmp, "chain.html"), without = path.join(tmp, "plain.html");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), CHAIN, "--source-root", FIXTURE, "-o", withChain], { stdio: "pipe" });
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"),
    path.join(REPO, "samples", "Darwin 1859 - Natural selection", "darwin-natural-selection.argdown"), "-o", without], { stdio: "pipe" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));

    await page.goto("file://" + without);
    await page.waitForTimeout(500);
    // Mutation: drop the `mechOffer` call from render -> the button is never offered here either,
    // and the next check (on the chain) fails instead. Drop the `!has` test -> this one fails.
    check(await page.locator("#mechbtn").isHidden(), "a map with no chain is not offered the arrangement");

    await page.goto("file://" + withChain);
    await page.waitForTimeout(700);
    check(await page.locator("#mechbtn").isVisible(), "a map with a chain is offered it");
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(300);
    check(await page.locator("#mech").isVisible() && await page.locator("#map").isHidden(),
          "choosing it shows the chain in place of the map");

    const drawnAppraisal = () => page.evaluate(() => document.querySelectorAll('#mech svg [data-layer="appraisal"]').length);
    const textBoxes = () => page.evaluate(() => [...document.querySelectorAll('#mech svg .st[data-layer="text"]')].map(g => g.getAttribute("transform")));
    // Mutation: start `layers.appraisal` true -> fails.
    check(await drawnAppraisal() === 0, "the appraisal is off by default: nothing of it is drawn");
    // Three appraisal claims carry steps; the fourth supports one of them and asserts none, so it is
// nothing this view could show. The control counts what IT hides.
check(/3 hidden/.test(await page.locator(".amech-tog.appr").innerText()),
      "but its control says how many additions it is hiding");
    check(await page.locator(".amech-banner").isHidden(), "and no banner is shown");
    const before = await textBoxes();

    await page.locator(".amech-tog.appr input").click();
    await page.waitForTimeout(150);
    check(await drawnAppraisal() > 0 && await page.locator(".amech-banner").isVisible(),
          "switched on, the appraisal is drawn under a standing banner");
    // Mutation: call `layout` inside `apply` over the visible steps only -> the boxes move.
    check(same(before, await textBoxes()), "switching the layer moves none of the text's own states");

    // The appraisal's view of a text step is named in the panel only while the layer is on.
    const clickChip = async (layer, edge) => page.locator(`#mech .chip[data-layer="${layer}"][data-edge="${edge}"][data-kind="step"]`).first().click();

    // A NULL FINDING AND A SELECTION LINK ARE DRAWN APART from the causal step between the same
    // states. Mutation: drop `kindOf(s)` from the layout's group key -> the null and the selection
    // fold into the "-" arrow and these fail.
    // textContent, not innerText: Playwright's innerText reads nothing from SVG text.
    const chipText = kind => page.evaluate(k => {
      const e = document.querySelector(`#mech .chip[data-layer="text"][data-edge="order>reoff"][data-kind="${k}"] text`);
      return e ? e.textContent : ""; }, kind);
    check((await chipText("step")).startsWith("lowers"), "the text's own step is drawn as its step, in words", await chipText("step"));
    check(/^no effect/.test(await chipText("null")), "the text's null finding is drawn apart, saying so", await chipText("null"));
    check(/selection/.test(await chipText("selection")), "and the selection link apart again", await chipText("selection"));
    check(await page.evaluate(() => { const p = document.querySelector('#mech g[data-kind="null"] path.ed'); return p && !p.getAttribute("marker-end"); }),
          "a null finding carries no arrowhead: nothing is brought about");
    await clickChip("text", "order>reoff");
    await page.waitForTimeout(150);
    check(/appraisal on this step/i.test(await page.locator(".amech-side").innerText()),
          "on, the panel names the appraisal of the step");
    await page.locator(".amech-tog.appr input").click();
    await page.waitForTimeout(150);
    // Mutation: drop the `layers.appraisal ?` guard before appraisalNotes -> fails.
    const sideOff = await page.locator(".amech-side").innerText();
    check(!/appraisal/i.test(sideOff), "off again, the panel says nothing of it", sideOff.slice(0, 200));
    check(await drawnAppraisal() === 0, "and nothing of it is drawn");

    // THE CHIP OPENS ITS OWN ARROW. The rival view runs beside the text's step order -> reoff, and
    // its hit stroke lay over the text's chip. Mutation: draw chips into the edge group (gE)
    // instead of the chip layer (gC) -> the click lands on the rival arrow, or times out.
    await page.locator(".amech-side button[data-back]").click().catch(() => {});
    await clickChip("text", "order>reoff");
    await page.waitForTimeout(150);
    const side = await page.locator(".amech-side").innerText();
    check(/Fewer reoffend after orders/.test(side) && !/Prison deters/.test(side),
          "the text's chip opens the text's arrow, not the rival beside it", side.slice(0, 200));

    await page.locator(".amech-side button[data-claim]").first().click();
    await page.waitForTimeout(600);
    const marked = await page.evaluate(() => {
      const m = document.querySelector("#mstext mark, #mstext .hl, #mstext [class*=hit]");
      return m ? m.textContent : "";
    });
    check(/Fewer people reoffend/.test(marked), "a claim reaches its passage in the manuscript", marked.slice(0, 120));

    // THE HEAD RIDES A SOLID STUB. Mutation: put marker-end back on the dashed path -> fails.
    check(await page.evaluate(() => { const g = document.querySelector('#mech g[data-layer="rival"][data-kind="step"]');
            const main = g && g.querySelector("path.ed:not(.stub)"), stub = g && g.querySelector("path.stub");
            return !!(stub && stub.getAttribute("marker-end") && !stub.getAttribute("stroke-dasharray") && !main.getAttribute("marker-end")); }),
          "a dashed arrow's head sits on a short solid stub, not wherever the dashes end");

    // FOCUS. Choosing a state fades every step not on a path through it. Mutation: make
    // applyFocus a no-op -> nothing is faded.
    await page.locator(".amech-side button[data-back]").click().catch(() => {});
    await page.locator('#mech .st[data-state="work"]').click();
    await page.waitForTimeout(150);
    const lit = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")).sort());
    check(same(lit, ["order>work", "work>reint"]), "choosing a state leaves only the paths through it", JSON.stringify(lit));
    check(/only the paths through this state/.test(await page.locator(".amech-side").innerText()), "and the panel says so");
    await page.locator(".amech-side button[data-back]").click();
    await page.waitForTimeout(150);
    check(await page.evaluate(() => document.querySelectorAll("#mech svg .dim").length) === 0, "and the whole chain comes back");

    // ONLY WHAT THE TEXT TESTED. Mutation: drop the `show` test from `visible` -> nothing changes.
    const nEdges = () => page.evaluate(() => document.querySelectorAll("#mech svg g[data-edge]:not(.chip)").length);
    const all = await nEdges();
    await page.locator("#mech select[data-show]").selectOption("tested");
    await page.waitForTimeout(150);
    const tested = await nEdges();
    check(tested > 0 && tested < all, "showing only what the text tested hides the asserted steps", `${all} -> ${tested}`);
    await page.locator("#mech select[data-show]").selectOption("all");
    await page.waitForTimeout(150);
    check(await nEdges() === all, "and every step returns");

    await page.locator('#view [data-v="reasons"]').click();
    await page.waitForTimeout(300);
    check(await page.locator("#map").isVisible() && await page.locator("#mech").isHidden(),
          "Reasons brings the map back");

    // THE ABSTRACT'S FOLD DOES NOT COVER THE QUESTION. The J-PAL sample carries an abstract; the
    // fixture does not. Mutation: drop the #stage:has(#abs) rule from the template -> fails.
    const jpal = path.join(tmp, "jpal.html"), JS = path.join(REPO, "samples", "Bates et al 2012 - The Price is Wrong");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), path.join(JS, "bates-2012-price-is-wrong.argdown"),
                          "--source-root", JS, "-o", jpal], { stdio: "pipe" });
    await page.goto("file://" + jpal);
    await page.waitForTimeout(700);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const gap = await page.evaluate(() => {
      const q = document.querySelector("#mech .amech-q"), b = document.querySelector("#absbtn");
      return b && q && b.offsetParent ? q.getBoundingClientRect().left - b.getBoundingClientRect().right : null; });
    check(gap !== null && gap >= 0, "the Abstract fold leaves the question uncovered", String(gap));
    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(fails ? `\n${fails} of ${checks} checks failed` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
