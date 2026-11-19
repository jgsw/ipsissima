/* Where to look, and the appraisal beside the map (19 Nov 2026).
 *
 *   node app/test_diagnostics.mjs
 *
 * James's rulings on the appraisal plan: the appraisal goes in a sibling file beside the map, and
 * the computed diagnostics are offered unasked, as a trial. What is held here:
 *
 *  - THE DIAGNOSTICS say what they should on a small map built to have one of each, and never count
 *    the appraisal layer: adding appraisal claims changes nothing they report.
 *  - ONE COST MEASURE: the module's costRank is exactly Study's, as it stood before it moved, on
 *    every sample map -- so "what most rests on" in Where to look and the costliest claim in Study
 *    cannot disagree.
 *  - IN THE PAGE (Chromium; skipped where it is not installed): a map opened with its sibling
 *    draws the appraisal only when switched on; Save's bundle carries the sibling; Where to look is
 *    on the bar with its count, opens on a click, and marks an item's claims on a click; and a
 *    sibling that will not parse leaves the map drawn, with a message naming the appraisal.
 */
import { argdown } from "@argdown/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { toGraph, RUN, joinAppraisal } from "./argdown-graph.mjs";

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
check(by("rests-on").length >= 1, "what most rests on");
check(out.every(x => typeof x.says === "string" && !/fails|weak|wrong|flaw/i.test(x.says)),
      "every line a fact about the map, none a verdict");

console.log("\nthe appraisal is never counted");
const withAppraisal = MAP + `
# Appraisal {isGroup: true}

[Stated]
    <- [Doubt]: The stated premise is doubtful. #appraisal {fidelity: "imputation", warrant: "x", appraises: {role: criticism, aim: argument}}
[Granted]
    <- [Answer for them]: A reply the author could make. #appraisal {fidelity: "imputation", warrant: "x", appraises: {role: reply, aim: argument}}
`;
const out2 = D.diagnose(graphOf(withAppraisal), { deps });
check(JSON.stringify(out2.map(x => [x.check, x.says])) === JSON.stringify(out.map(x => [x.check, x.says])),
      "the same list with appraisal claims added, an appraisal reply to a concession included");
const sibling = `===
map: "x.argdown"
===

[Stated]
    <- [Doubt]: The stated premise is doubtful. #appraisal {fidelity: "imputation", warrant: "x"}
`;
check(graphOf(joinAppraisal(MAP, sibling).text).nodes.some(n => n.label === "Doubt" && n.tags.includes("appraisal")),
      "a joined sibling's claim reaches the graph as an appraisal claim");

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
  const f = fs.readdirSync(path.join(samples, dir)).find(x => x.endsWith(".argdown") && !x.endsWith(".appraisal.argdown"));
  if (!f) continue;
  const G = graphOf(fs.readFileSync(path.join(samples, dir, f), "utf8"));
  const a = D.costRank(G, { deps }).map(x => [x.id, x.lost, x.mains]), b = legacyRank(G).map(x => [x.id, x.lost, x.mains]);
  check(JSON.stringify(a) === JSON.stringify(b), dir + ": " + a.length + " claims ranked alike");
}

/* ---- 3. in the page ------------------------------------------------------------------------- */
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); } catch { chromium = null; }
const PAGE = path.join(REPO, "Ipsissima.html");
if (!chromium || !fs.existsSync(PAGE)) {
  console.log("\nin the page: skipped (" + (!chromium ? "no Chromium" : "no built Ipsissima.html; run npm run build") + ")");
} else {
  console.log("\nin the page");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("file://" + PAGE);
    await page.waitForTimeout(600);
    // DROPPED, as a reader drops files: a drop event carrying them, through the page's own handler.
    const open = (files) => page.evaluate((fs_) => {
      const dt = new DataTransfer();
      fs_.forEach(f => dt.items.add(new File([f.text], f.path)));
      document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, files);
    const SIB = `===
map: "one.argdown"
===

[Stated]
    <- [Doubt]: The stated premise is doubtful. #appraisal {fidelity: "imputation", warrant: "x", appraises: {role: criticism, aim: argument}}

[Account A]
    <- [A is doubtful]: The appraiser's reason against A. #appraisal {fidelity: "imputation", warrant: "x", appraises: {role: criticism, aim: comparison}}
`;
    await open([{ path: "one.argdown", text: MAP }, { path: "one.appraisal.argdown", text: SIB }]);
    await page.waitForTimeout(900);
    // The walkthrough offers itself on a first map; a reader closes it.
    for (let k = 0; k < 3 && await page.locator("#walk").isVisible(); k++) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
    const appraisalDrawn = () => page.locator("#map .alm-n.alm-appraisal").count();
    const state = () => page.evaluate(() => /** @type {any} */ (window).__APPRAISAL_STATE__());
    check((await state()).sibling === "one.appraisal.argdown", "the sibling is opened with the map");
    check(await appraisalDrawn() === 0, "and not drawn until asked for");
    const aBtn = page.locator('#map .alm-bar [data-act="appraisal"]');
    check(await aBtn.count() === 1, "the appraisal switch is offered");
    // The switch lives in the Display menu (as in test_appraisal_layer.mjs).
    await page.click('#map .alm-bar [data-act="display"]');
    await aBtn.click();
    await page.waitForTimeout(500);
    check(await appraisalDrawn() > 0, "switched on, the sibling's claim is drawn as appraisal");
    // THE APPRAISAL'S WEIGHING, BESIDE THE TEXT'S: in Weigh, marked, and never filling the text's cell.
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
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    check((await state()).bundle.includes("one.appraisal.argdown"), "a saved bundle carries the sibling");

    const look = page.locator('#map [data-act="look"]');
    check(await look.isVisible(), "Where to look is on the bar, unasked");
    check(/Where to look \(\d+\)/.test(await look.textContent()), "with its count");
    await look.click();
    await page.waitForTimeout(300);
    check(await page.locator("#look").isVisible(), "a click opens the panel");
    const items = page.locator("#look li button:not(.none)");
    check(await items.count() > 0, "listing items with claims to show");
    const txt = await page.locator("#look").innerText();
    check(/Supplied/.test(txt) && /Granted/.test(txt) && !/Doubt/.test(txt), "the map's thin places, never the appraisal's");
    await page.locator("#look li button", { hasText: "Granted" }).click();
    await page.waitForTimeout(400);
    check(await page.locator("#look li button.on").count() === 1, "a click on an item marks it");
    await look.click();
    await page.waitForTimeout(200);
    check(await page.locator("#look").isHidden(), "and the bar button closes it");

    // A missing comma: the YAML fault Argdown would otherwise swallow, dropping what follows.
    await open([{ path: "two.argdown", text: MAP },
                { path: "two.appraisal.argdown", text: '[Stated]\n    <- [Bad]: x. #appraisal {fidelity: "imputation" warrant: "x"}\n' }]);
    await page.waitForTimeout(900);
    check(!!(await state()).error, "the appraisal's fault is caught");
    check(await page.locator("#map .alm-n").count() > 0, "a sibling that will not parse leaves the map drawn");
    check(/appraisal beside this map/.test(await page.locator("body").innerText()), "and says the appraisal could not be read");

    await open([{ path: "three.argdown", text: MAP }]);
    await page.waitForTimeout(700);
    check((await state()).sibling === null, "a map opened alone has no appraisal");
    check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  } finally { await browser.close(); }
}

console.log(failed ? `\n${failed} FAILED` : "\nall diagnostics checks pass");
process.exit(failed ? 1 : 0);
