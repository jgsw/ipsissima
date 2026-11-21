/* Where to look, and the appraisal beside the map (19 Nov 2026).
 *
 *   node app/test_diagnostics.mjs
 *
 * James's rulings on the appraisal plan: the computed diagnostics are offered unasked, as a trial; and
 * (profile 1.28) the appraisal is a report beside the map, `<map>.appraisal.md`, shown in its own pane
 * with links into the map. What is held here:
 *
 *  - THE DIAGNOSTICS say what they should on a small map built to have one of each, and never count
 *    the appraisal layer: adding appraisal claims changes nothing they report.
 *  - ONE COST MEASURE: the module's costRank is exactly Study's, as it stood before it moved, on
 *    every sample map -- so "what most rests on" in Where to look and the costliest claim in Study
 *    cannot disagree.
 *  - IN THE PAGE (Chromium; required on CI): a map opened with its report offers the Appraisal pane,
 *    whose links light a claim, select a step or a state in the Mechanism view, open a table and turn
 *    the text to a page, and grey a title the map lacks; Save's bundle carries the report; appraisal
 *    claims written into a map are tinted, not hatched, and kept apart in Weigh; Where to look is on
 *    the bar with its count, and every item goes somewhere in every view.
 */
import { argdown } from "@argdown/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { toGraph, RUN } from "./argdown-graph.mjs";
import { settle } from "./browser_settle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
const deps = { suppose: require("./src/argdown-suppose.js"), accounts: require("./src/argdown-accounts.js"),
               mechanism: require("./src/argdown-mechanism.js"), tables: require("./src/argdown-tables.js") };
const D = require("./src/argdown-diagnostics.js");

let failed = 0;
function check(ok, label) { console.log((ok ? "   ok   " : "   FAIL ") + label); if (!ok) failed++; }
const graphOf = text => toGraph(argdown.run({ input: text, ...RUN }));

/* ---- 1. one of each ------------------------------------------------------------------------- */
const MAP = `===
title: One of each
frames:
    explains:
        kind: account
        label: "What explains it"
        values:
            a: {claim: "Account A"}
            b: {claim: "Account B"}
===

# The case {isGroup: true}

[Main]: The main claim.
    <+ <The argument>

<The argument>

(1) [Stated]: A stated premise.
(2) [Supplied]: A premise the text does not state. {fidelity: "imputation", warrant: "enthymeme"}
-----
(3) [Main]

[Main]
    <- [Granted]: A point the author grants. #conceded
    <- [Raised]: An objection the text voices. #contested
    <- [Raised and met]: Another objection. #contested
        <- [The answer]: The author's answer.

[Stated]
    <+ [Sub]: Support for the stated premise.

[Account A]: One account.
    <+ [Only for A]: A reason for A alone.

[Account B]: Another account. #reported
    <- [Only against B]: A reason against B alone.

[One]: One of a trilemma. {inconsistent: trio}
    +> [Sub]

[Two]: Two of a trilemma. {inconsistent: trio}
    +> [Sub]

[Three]: Three of a trilemma. {inconsistent: trio}
    +> [Sub]
`;
console.log("the diagnostics, on a map with one of each");
const g = graphOf(MAP), out = D.diagnose(g, { deps });
const by = c => out.filter(x => x.check === c);
check(by("unstated").length === 1 && /Supplied/.test(by("unstated")[0].says), "a premise the reconstruction supplied");
check(by("conceded").length === 1 && /Granted/.test(by("conceded")[0].says), "a concession with no reply");
check(by("objection").length === 1 && /Raised›/.test(by("objection")[0].says), "an objection with no reply, and not the one answered");
check(by("inconsistent").length === 1 && by("inconsistent")[0].ids.length === 3, "a set marked as not all holding");
check(by("not-told-apart").length === 1, "declared rival accounts no reason bears on differently");
check(by("not-told-apart")[0].table === "account:explains", "which opens their table");
check(by("rests-on").length === 0 && by("summary").length === 0,
      "load is not itself an item: a linchpin is not a weakness (James, 19 Nov 2026)");
check(out.every(x => typeof x.says === "string" && !/fails|weak|wrong|flaw/i.test(x.says)),
      "every line a fact about the map, none a verdict");

console.log("\nsteps named by the claim that states them, as the map titles it");
const chainG = graphOf(fs.readFileSync(path.join(REPO, "ipsissima-mcp", "tests", "mechanism", "chain.argdown"), "utf8"));
const co = D.diagnose(chainG, { deps });
const stepItems = co.filter(x => /^asserted|^hedged/.test(x.check));
check(stepItems.length > 0 && stepItems.every(x => x.says.startsWith("‹" + x.titles[0] + "›") && x.steps[0] === x.titles[0]),
      "each step leads with its claim's title, and can be shown as a step");
check(co.filter(x => x.check === "gap").every(x => x.states && x.states.length && /“/.test(x.says)),
      "a gap names its state, in the state's own marks, and can be shown");

console.log("\nranked by what rests on them, three shown, the rest on request");
const MAP2 = '[Main]: The main claim.\n    <+ [Leaf]: A reason for it.\n        <+ [Root]: A reason for the reason.\n\n' +
  '[Root]\n    <- [G1]: First grant, against the root. #conceded\n    <- [G2]: Second grant, against the root. #conceded\n\n' +
  '[Leaf]\n    <- [G3]: Third grant, against the leaf. #conceded\n\n' +
  '[Main]\n    <- [G4]: Fourth grant, against the main claim. #conceded\n';
const o2 = D.diagnose(graphOf(MAP2), { deps }), g2 = o2.filter(x => x.group === "unanswered");
check(g2[0].check === "summary" && /^4 concessions/.test(g2[0].says), "a group of four opens with its count");
check(/G4/.test(g2[1].says), "what is aimed at the main claim comes first");
// Supposing [Root] false takes [Leaf] and [Main] with it; supposing [Leaf] false, only [Main].
check(/G1/.test(g2[2].says) && /G2/.test(g2[3].says) && /G3/.test(g2[4].says),
      "then what is aimed at the claim more rests on, ties in the text's order");
check(g2.filter(x => x.check !== "summary" && !x.more).length === 3 && g2.filter(x => x.more).length === 1,
      "three shown, one held back");

console.log("\nthe appraisal is never counted");
const withAppraisal = MAP + `
# Appraisal {isGroup: true}

[Stated]
    <- [Doubt]: The stated premise is doubtful. #appraisal {fidelity: "imputation", warrant: "x"}
[Granted]
    <- [Answer for them]: A reply the author could make. #appraisal {fidelity: "imputation", warrant: "x"}
`;
const out2 = D.diagnose(graphOf(withAppraisal), { deps });
check(JSON.stringify(out2.map(x => [x.check, x.says])) === JSON.stringify(out.map(x => [x.check, x.says])),
      "the same list with appraisal claims added, an appraisal reply to a concession included");
console.log("\non every sample: no dead ends, and every summarised group shows three");
for (const dir of fs.readdirSync(path.join(REPO, "samples")).filter(d => fs.statSync(path.join(REPO, "samples", d)).isDirectory())) {
  const f = fs.readdirSync(path.join(REPO, "samples", dir)).find(x => x.endsWith(".argdown"));
  if (!f) continue;
  const o = D.diagnose(graphOf(fs.readFileSync(path.join(REPO, "samples", dir, f), "utf8")), { deps });
  const capped = o.filter(x => x.check === "summary").every(sm => o.filter(x => x.group === sm.group && x.check !== "summary" && !x.more).length === 3);
  check(!o.some(x => /leads nowhere/.test(x.says)) && capped, dir + ": " + o.filter(x => !x.more).length + " shown of " + o.length);
}

/* ---- 1b. no mechanism, no mechanism items ---------------------------------------------------- */
// Reported on Moore 1939 (21 Nov 2026): a map that says `depth: none` was told its chain had "no
// stated cause to run from" and "nothing says what the chain is for". The checker already says
// only "considered, not mapped" there; Where to look now says nothing about a mechanism at all.
// The control is a chain with states and no roles, where those two lines are the right report.
console.log("\nno mechanism, nothing about one");
const ARG = `
[Main]: A conclusion.
    <+ <Why>

<Why>

(1) [P]: A premise.
-----
(2) [Main]
`;
const mechOf = fm => D.diagnose(graphOf(`===\ntitle: T\n${fm}===\n${ARG}`), { deps }).filter(x => x.kind === "mechanism");
const none = mechOf(`mechanism:\n    depth: none\n    depth_reason: "No causal chain."\n`);
check(none.length === 0, "`depth: none`: no mechanism item" + (none.length ? " -- got: " + none.map(x => x.says).join(" | ") : ""));
const empty = mechOf(`mechanism:\n    question: "How?"\n`);
check(empty.length === 0, "a block with no state and no step: no mechanism item" + (empty.length ? " -- got: " + empty.map(x => x.says).join(" | ") : ""));
const unroled = mechOf(`mechanism:\n    states:\n        a: {label: "A"}\n        b: {label: "B"}\n`);
check(unroled.some(x => /no stated cause/.test(x.says)) && unroled.some(x => /what the chain is for/.test(x.says)),
      "and a chain with states but no roles still hears both");

/* ---- 2. one cost measure -------------------------------------------------------------------- */
// Study's cost, exactly as it stood in the page before it moved into the module (18 Nov 2026).
function legacyRank(G) {
  const nodes = (G.nodes || []).filter(n => (n.tags || []).indexOf("appraisal") < 0);
  const byId = {}; nodes.forEach(n => { byId[n.id] = n; });
  const outSup = {}, inSup = {};
  (G.edges || []).forEach(e => { if (e.type !== "support" || !byId[e.from] || !byId[e.to]) return; outSup[e.from] = true; inSup[e.to] = true; });
  const mains = {};
  nodes.forEach(n => { if (n.kind === "statement" && inSup[n.id] && !outSup[n.id]) mains[n.id] = true; });
  (G.contentions || []).forEach(id => { if (id) mains[id] = true; });
  const res = [];
  nodes.forEach(n => {
    if (n.kind !== "statement" || mains[n.id]) return;
    const r = deps.suppose.suppose(G, { "false": [n.id], holds: [], cut: [], choice: {}, keep: [] }, { appraisal: false });
    const lost = r.lost.filter(x => x.indexOf("#") < 0), lm = lost.filter(x => mains[x]);
    res.push({ id: n.id, lost: lost.length, mains: lm.length });
  });
  res.sort((a, b) => b.mains - a.mains || b.lost - a.lost || String(byId[a.id].label).localeCompare(String(byId[b.id].label)));
  return res;
}
console.log("\nStudy's cost measure, moved into the module unchanged");
const samples = path.join(REPO, "samples");
for (const dir of fs.readdirSync(samples).filter(d => fs.statSync(path.join(samples, d)).isDirectory())) {
  const f = fs.readdirSync(path.join(samples, dir)).find(x => x.endsWith(".argdown"));
  if (!f) continue;
  const G = graphOf(fs.readFileSync(path.join(samples, dir, f), "utf8"));
  const a = D.costRank(G, { deps }).map(x => [x.id, x.lost, x.mains]), b = legacyRank(G).map(x => [x.id, x.lost, x.mains]);
  check(JSON.stringify(a) === JSON.stringify(b), dir + ": " + a.length + " claims ranked alike");
}

/* ---- 3. in the page ------------------------------------------------------------------------- */
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); } catch { chromium = null; }
// BUILT HERE, FROM THE CURRENT SOURCE, as test_appraisal_layer.mjs builds its viewer: a page built
// beforehand may be stale, and on CI there is none (the page half was skipped there, 19 Nov 2026).
let PAGE = null;
if (chromium) {
  PAGE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "diagnostics-")), "Ipsissima.html");
  const { execFileSync } = await import("node:child_process");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), "--standalone", "--editor", "-o", PAGE], { stdio: "pipe" });
}
if (!chromium) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("\nFAIL: Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("\nin the page: skipped (no Chromium)");
} else {
  console.log("\nin the page");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("file://" + PAGE);
    await settle(page, 600);
    // DROPPED, as a reader drops files: a drop event carrying them, through the page's own handler.
    const open = (files) => page.evaluate((fs_) => {
      const dt = new DataTransfer();
      fs_.forEach(f => dt.items.add(new File([f.text], f.path)));
      document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, files);
    // A MAP WITH ITS REPORT, AND A TEXT WITH PAGES. The map also carries two appraisal claims of its
    // own (still legal), for the tint and for Weigh.
    const MAPX = MAP.replace("title: One of each", "title: One of each\ndefaults:\n    chapter: \"source/t.md\"") + '\n# Appraisal {isGroup: true}\n\n' +
      '[Stated]\n    <- [Doubt]: The stated premise is doubtful. #appraisal {fidelity: "imputation", warrant: "x"}\n\n' +
      '[Account A]\n    <- [A is doubtful]: The appraiser\'s reason against A. #appraisal {fidelity: "imputation", warrant: "x"}\n';
    const SRC = "<!-- p.1 begins here -->\nThe first page of the text.\n\n<!-- p.2 begins here -->\nThe second page of the text.\n";
    const REPORT = "# Appraisal\n\nThe argument rests on \u2039Stated\u203a, which the text never defends (p. 2).\n\n" +
      "The rival accounts are set out in [the accounts](#table:explains).\n\nAnd \u2039No such claim\u203a is named in error.\n";
    await open([{ path: "one.argdown", text: MAPX }, { path: "one.appraisal.md", text: REPORT }, { path: "t.md", text: SRC }]);
    await settle(page, 900);
    // The walkthrough offers itself on a first map; a reader closes it.
    for (let k = 0; k < 3 && await page.locator("#walk").isVisible(); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
    const state = () => page.evaluate(() => /** @type {any} */ (window).__APPRAISAL_STATE__());
    check((await state()).report === "one.appraisal.md", "the report is opened with the map");
    const apBtn = page.locator('#panes [data-p="appraisal"]');
    check(await apBtn.isVisible(), "and the Appraisal pane is offered");
    await apBtn.click();
    await settle(page, 400);
    check(await page.locator("#appr").isVisible() && /never defends/.test(await page.locator("#apprbody").innerText()), "a click opens the report");
    await page.locator("#apprbody a.apl", { hasText: "Stated" }).first().click();
    await settle(page, 500);
    check(await page.locator("#map .is-lit").count() >= 1, "a \u2039title\u203a lights its claim on the map");
    check(await page.locator("#apprbody a.apl.missing", { hasText: "No such claim" }).count() === 1, "a title the map lacks is greyed");
    await page.locator("#apprbody a.apl", { hasText: "p. 2" }).click();
    await settle(page, 500);
    check(await page.locator("#ms").isVisible() && /second page/.test(await page.locator("#ms .hit").first().innerText().catch(() => "")),
          "a page opens the text at that page");
    await page.locator("#apprbody a.apl", { hasText: "the accounts" }).click();
    await settle(page, 400);
    check(await page.locator("#tables").isVisible(), "a table link opens the table");
    if (await page.locator("#tables").isVisible()) await page.locator('#tables [data-tables-close]').click();
    check((await state()).bundle.includes("one.appraisal.md"), "a saved bundle carries the report");
    await page.locator('#appr [data-close="appraisal"]').click();
    await page.waitForTimeout(200);

    // APPRAISAL CLAIMS IN A MAP: tinted, not hatched, and kept apart in Weigh.
    const appraisalDrawn = () => page.locator("#map .alm-n.alm-appraisal").count();
    check(await appraisalDrawn() === 0, "appraisal claims in a map are not drawn until asked for");
    const aBtn = page.locator('#map .alm-bar [data-act="appraisal"]');
    // The switch lives in the Display menu (as in test_appraisal_layer.mjs).
    await page.click('#map .alm-bar [data-act="display"]');
    await aBtn.click();
    await settle(page, 500);
    check(await appraisalDrawn() > 0, "switched on, they are drawn");
    const fill = await page.locator("#map .alm-n.alm-appraisal .alm-box").first().evaluate(e => getComputedStyle(e).fill);
    check(!/url\(/.test(fill), "tinted, not hatched", fill);
    if (!(await page.locator('#map [data-act="weigh"]').isVisible())) await page.keyboard.press("Escape");
    await page.click('#map [data-act="weigh"]');
    await page.waitForTimeout(400);
    const weigh = await page.locator("#weigh").innerText();
    check(/A is doubtful/.test(weigh) && /the appraisal, not the text/.test(weigh), "Weigh lists the appraisal's reason, marked as the appraisal's");
    const aAgainst = await page.locator("#weigh table.grid tr.acc", { hasText: "Account A" }).locator("xpath=following-sibling::tr[1]/td[2]").innerText();
    check(/The text gives none/.test(aAgainst) && /A is doubtful/.test(aAgainst), "and the text's empty cell stays the text's");
    await page.click('#map [data-act="weigh"]');
    await page.waitForTimeout(200);
    if (!(await aBtn.isVisible())) await page.click('#map .alm-bar [data-act="display"]');
    await aBtn.click();
    await settle(page, 300);
    await page.keyboard.press("Escape");

    const look = page.locator('#map [data-act="look"]');
    check(await look.isVisible(), "Where to look is on the bar, unasked");
    check(/Where to look \(\d+\)/.test(await look.textContent()), "with its count");
    await look.click();
    await settle(page, 300);
    check(await page.locator("#look").isVisible(), "a click opens the panel");
    const items = page.locator("#look li button:not(.none)");
    check(await items.count() > 0, "listing items with claims to show");
    const txt = await page.locator("#look").innerText();
    check(/Supplied/.test(txt) && /Granted/.test(txt) && !/Doubt/.test(txt), "the map's thin places, never the appraisal's");
    await page.locator("#look li button", { hasText: "Granted" }).click();
    await settle(page, 700);
    check(await page.locator("#look li button.on").count() === 1, "a click on an item marks it");
    const pr = await page.locator("#look").evaluate(e => e.getBoundingClientRect().right);
    const lit = await page.locator("#map .is-lit").first().evaluate(e => e.getBoundingClientRect().left);
    check(lit >= pr, "in Reasons, the claim it lights is shown right of the open panel", JSON.stringify({ pr, lit }));
    await look.click();
    await page.waitForTimeout(200);
    check(await page.locator("#look").isHidden(), "and the bar button closes it");

    // A COMPARISON OPENS ITS TABLE (19 Nov 2026: comparisons did nothing on a click).
    await look.click();
    await settle(page, 300);
    await page.locator("#look li button", { hasText: "What explains it" }).click();
    await settle(page, 400);
    check(await page.locator("#tables").isVisible(), "a comparison opens its table");
    await page.keyboard.press("Escape");
    if (await page.locator("#tables").isVisible()) await page.locator('#tables [data-tables-close]').click();

    // IN THE MECHANISM VIEW, a step is shown as a step, a gap as its state, and an item about the
    // argument goes back to the Reasons view (19 Nov 2026: in Mechanism nothing happened).
    const chainText = fs.readFileSync(path.join(REPO, "ipsissima-mcp", "tests", "mechanism", "chain.argdown"), "utf8");
    const chainReport = "The step \u2039Work helps\nreintegration\u203a is only asserted, and [reintegration](#state:reint) is where it ends.\n";
    await open([{ path: "chain.argdown", text: chainText }, { path: "chain.appraisal.md", text: chainReport }]);
    await settle(page, 900);
    // Opened in Reasons, where its button is, and kept open into the Mechanism view.
    await look.click();
    await settle(page, 300);
    await page.click("#mechbtn");
    await settle(page, 800);
    check(await page.locator("#look").isVisible(), "Where to look stays open in the Mechanism view");
    await page.locator("#look li button", { hasText: "Work helps reintegration" }).click();
    await settle(page, 500);
    check(await page.locator("#mech path.sel").count() === 1, "a step's item selects its arrow in the drawing");
    // ROOM FOR THE PANEL (20 Nov 2026): the drawing is laid out to its right, so what is selected is
    // not under it.
    const lookRight = await page.locator("#look").evaluate(e => e.getBoundingClientRect().right);
    const stageLeft = await page.locator("#mech .amech-stage").evaluate(e => e.getBoundingClientRect().left);
    const selLeft = await page.locator("#mech path.sel").evaluate(e => e.getBoundingClientRect().left);
    check(stageLeft >= lookRight && selLeft >= lookRight, "in Mechanism, the drawing starts right of the open panel",
          JSON.stringify({ lookRight, stageLeft, selLeft }));
    // A gap's state is one no drawn step touches, so it cannot be selected: the page says so.
    await page.locator("#look li button", { hasText: "More community orders" }).click();
    await settle(page, 500);
    check(await page.locator("#mech").isVisible() && /More community orders\u201d is not drawn/.test(await page.locator("body").innerText()),
          "a gap's state that is not drawn is said to be not drawn");
    await page.locator("#look li button", { hasText: "Orders go to the less risky" }).click();
    await settle(page, 700);
    check(await page.locator("#mech").isHidden(), "an item about the argument goes to the Reasons view");
    const tip = await page.locator("#look li button", { hasText: "Orders go to the less risky" }).getAttribute("title");
    check(/Orders go to the less risky›: \S/.test(tip || ""), "and its hover gives the claim's own words");
    await page.locator("#look [data-look-close]").click();
    await page.waitForTimeout(200);
    // THE REPORT IN THE MECHANISM VIEW: a claim that states a step selects the step; a state, the state.
    await page.click("#mechbtn");
    await settle(page, 700);
    await page.locator('#panes [data-p="appraisal"]').click();
    await settle(page, 400);
    // Broken across a line of the report's source, and still one link.
    await page.locator("#apprbody a.apl", { hasText: "Work helps" }).click();
    await settle(page, 500);
    check(await page.locator("#mech").isVisible() && await page.locator("#mech path.sel").count() === 1, "in Mechanism, a report's claim link selects its step");
    await page.locator("#apprbody a.apl", { hasText: "reintegration" }).last().click();
    await settle(page, 500);
    // A selected state opens the drawing's side panel on it (select({state}): no arrow is marked).
    check(await page.locator("#mech path.sel").count() === 0 && /reintegrates/i.test(await page.locator("#mech .amech-side").innerText()),
          "and a state link selects the state");
    await page.locator('#appr [data-close="appraisal"]').click();
    await page.click('#views [data-v="reasons"], button:has-text("Reasons")');
    await settle(page, 400);

    // A GROUP OF FOUR: three shown, the fourth on request.
    await open([{ path: "four.argdown", text: MAP2 }]);
    await settle(page, 800);
    check(/Where to look \(3\)/.test(await look.textContent()), "the count is what is shown before \u2018show more\u2019");
    await look.click();
    await settle(page, 300);
    check(!/G3/.test(await page.locator("#look").innerText()), "the lightest of four is held back");
    await page.locator("#look button.more", { hasText: "Show 1 more" }).click();
    await page.waitForTimeout(200);
    check(/G3/.test(await page.locator("#look").innerText()), "and shown on request");
    await page.locator("#look button.more", { hasText: "Show fewer" }).click();
    await page.waitForTimeout(200);
    check(!/G3/.test(await page.locator("#look").innerText()), "and put back");
    await look.click();

    await open([{ path: "three.argdown", text: MAP }]);
    await settle(page, 700);
    check((await state()).report === null && await page.locator('#panes [data-p="appraisal"]').isHidden(), "a map opened alone has no Appraisal pane");
    check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  } finally { await browser.close(); }
}

console.log(failed ? `\n${failed} FAILED` : "\nall diagnostics checks pass");
process.exit(failed ? 1 : 0);
