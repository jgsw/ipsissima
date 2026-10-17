/* The reader's suppositions in Reasons, and contraposition (argdown-suppose.js; James's go,
 * 17 Oct 2026). The first half runs the pure module on two planted maps; the second drives the
 * page with real clicks: a right-click on a claim, the menu, the panel, the staircase.
 *
 *   node app/test_suppose.mjs
 */
import { argdown } from "@argdown/core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
require("./src/argdown-validity.js");
const { toGraph, RUN } = await import("./argdown-graph.mjs");
const S = require("./src/argdown-suppose.js");
const PLANTED = path.join(REPO, "fixtures", "suppose", "planted.argdown");
const MOOREAN = path.join(REPO, "fixtures", "suppose", "moorean.argdown");

let fails = 0, checks = 0;
function check(ok, what, detail) {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok || detail == null ? "" : `\n          ${detail}`));
  if (!ok) fails++;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const graphOf = file => toGraph(argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN }));

/* ------------------------------------------------------------ the module */
console.log("what a supposition costs, read off the map's own support");
const g = graphOf(PLANTED);
const id = l => g.nodes.find(n => n.label === l).id;
const labels = ids => ids.map(x => (g.nodes.find(n => n.id === x) || {}).label || x).sort();
const run = sup => S.suppose(g, sup);

// A linked argument needs every premise; a convergent reason survives on its own. Mutation: let a
// statement hold on any one premise of a linked argument -> Linked survives.
let r = run({ false: [id("P1")] });
check(same(labels(r.lost), ["Linked"]) && same(labels(r.denied), ["P1"]),
      "denying one premise takes the linked argument, and its conclusion keeps its other reason", JSON.stringify(labels(r.lost)));
r = run({ false: [id("P1"), id("P3")] });
check(same(labels(r.lost), ["Alone", "Linked", "Main"]), "deny a premise of each reason and the conclusion loses its support", JSON.stringify(labels(r.lost)));
// Nothing happens at baseline: attacks do nothing until the reader turns them on.
r = run({});
check(r.lost.length === 0 && r.denied.length === 0, "with no supposition no attack has force, and nothing is lost");
// An objection supposed to hold denies what it attacks; the text's reply to it is named. Mutation:
// drop the reply list -> none named.
r = run({ holds: [id("Obj")] });
check(same(labels(r.denied), ["P1"]) && r.why[id("P1")].by === "rebuttal" && same(r.replies.map(x => x.label), ["Reply"]) && same(labels(r.lost), ["Linked"]),
      "suppose an objection holds: what it attacks is denied, and the text's reply to it is named, not resolved", JSON.stringify([labels(r.denied), r.replies]));
// An undercut cuts the step, and leaves the premises standing. Mutation: deny the premises instead.
r = run({ holds: [id("Under")] });
check(same(labels(r.lost), ["Alone"]) && !r.denied.includes(id("P3")), "suppose an undercut holds: the step is cut, its premise stands", JSON.stringify(labels(r.lost)));
// An attack on a whole argument waits for the reader's choice. Mutation: treat it as an undercut.
r = run({ holds: [id("Whole")] });
check(r.lost.length === 0 && r.waiting.length === 1 && same(r.waiting[0].premises, [1, 2]),
      "an attack on a whole argument does nothing until the reader says what it denies", JSON.stringify(r.waiting));
r = run({ holds: [id("Whole")], choice: { [id("Whole") + ">" + id("Linked")]: "premise:2" } });
check(same(labels(r.denied), ["P2"]) && same(labels(r.lost), ["Linked"]), "and denies the premise the reader names", JSON.stringify(labels(r.denied)));
r = run({ holds: [id("Whole")], choice: { [id("Whole") + ">" + id("Linked")]: "step" } });
check(r.denied.length === 0 && same(labels(r.lost), ["Linked"]), "or cuts the step", JSON.stringify(labels(r.lost)));
// A contradictory pair: one held, the other false; one false, the other held.
r = run({ holds: [id("Rival")] });
check(same(labels(r.denied), ["P3"]) && same(labels(r.lost), ["Alone"]), "suppose one of a contradictory pair holds: the other is false");
r = run({ false: [id("P3")] });
check(r.held.includes(id("Rival")) && r.why[id("Rival")].by === "contradictory", "and suppose one false: the other holds");
// Denying a conclusion does not take the argument for it. Mutation: let argGoes read the conclusion's denial.
r = run({ false: [id("Formal")] });
check(!r.lost.includes(id("Checked")) && same(labels(r.lost), ["Affirming", "Wrong"]),
      "denying a conclusion leaves its argument going through, and takes what rested on the conclusion", JSON.stringify(labels(r.lost)));
// Which supposition took each one's support.
r = run({ false: [id("P1"), id("Formal")] });
check(same(labels(r.owing[id("Linked")]), ["P1"]) && same(labels(r.owing[id("Wrong")]), ["Formal"]), "each loss names the supposition that took it", JSON.stringify(r.owing));
// The appraisal is the reconstructor's: left out unless asked for.
check(S.index(g).byId[id("Main")] && Object.keys(S.index({ nodes: [{ id: "a", kind: "statement", label: "A", tags: ["appraisal"] }], edges: [] }).byId).length === 0,
      "the reconstructor's appraisal is left out unless the page shows it");

console.log("\ndeny the conclusion: what must give");
// Conductive steps: the step itself is among what may give. Mutation: drop orStep -> [].
let D = S.deny(g, id("Main"), [id("P1")]);
check(D.reasons.length === 2 && same(D.reasons.map(x => [x.all, x.orStep]), [["conductive", [0]], ["conductive", [0]]]) &&
      same(D.reasons[0].forced.map(x => x.title), ["P2"]) && same(labels(D.reasons[0].objections), ["Whole"]) && same(labels(D.reasons[1].objections), ["Under"]),
      "on a conductive step every reason must fail, a premise or the step, and the map's objections to the step are named", JSON.stringify(D.reasons.map(x => [x.all, x.orStep, x.forced && x.forced.map(f => f.title)])));
// A named deductive step: keep all but one and the last is forced; keep all and there is no room.
D = S.deny(g, id("Named"), [id("A")]);
check(D.reasons[0].all === "named" && !D.reasons[0].orStep.length && same(D.reasons[0].forced.map(x => x.title), ["If A then B"]),
      "on a step naming a deductive rule, keeping all but one premise forces the last", JSON.stringify(D.reasons[0]));
check(S.deny(g, id("Named"), [id("A"), id("If A then B")]).reasons[0].contradiction, "and keeping every premise while denying the conclusion is a contradiction");
// Formalized and valid: decided. Mutation: drop the satisfiability test -> no formal forced.
D = S.deny(g, id("Formal"), [id("Rule")]);
check(D.reasons[0].all === "valid" && same(D.reasons[0].formal.forced.map(x => x.title), ["Fact"]) && same(D.reasons[0].formal.minimal.map(m => m.map(x => x.title)), [["Fact"]]),
      "on formalized valid steps the page decides which premise is forced, and the least to give up", JSON.stringify(D.reasons[0].formal));
D = S.deny(g, id("Formal"), []);
check(same(D.reasons[0].formal.minimal.map(m => m.map(x => x.title)), [["Rule"], ["Fact"]]), "with nothing kept, either premise alone may go");
// Invalid as formalized: denying forces nothing.
D = S.deny(g, id("Wrong"), []);
check(D.reasons[0].all === "invalid" && D.reasons[0].formal === null, "an invalid step forces nothing", JSON.stringify(D.reasons[0].all));
// A claim with no support: nothing to give.
check(S.deny(g, id("P1"), []).none, "a basic premise has no reason to give up");

console.log("\nthe teaching map: one person's modus ponens");
const m = graphOf(MOOREAN);
const mid = l => m.nodes.find(n => n.label === l).id;
D = S.deny(m, mid("The sceptic's argument"), [mid("Moore cannot prove it"), mid("Knowledge needed")]);
check(same(D.reasons[0].formal.forced.map(x => x.title), ["No proof, no knowledge"]) && same(D.reasons[0].forced.map(x => x.title), ["No proof, no knowledge"]),
      "deny the sceptic's conclusion, keep what Moore grants, and the first premise must go: Moore's answer", JSON.stringify(D.reasons[0].formal));
D = S.deny(m, mid("Moore's proof"), [mid("Hands are external")]);
check(same(D.reasons[0].forced.map(x => x.title), ["Here are two hands"]), "deny Moore's conclusion, keep what hands are, and his premiss must go: the idealist's move");
r = S.suppose(m, { holds: [mid("Knowledge without proof")] });
check(r.denied.includes(mid("No proof, no knowledge")) && r.lost.includes(mid("The proof proves nothing")),
      "suppose Moore's answer holds: the sceptic's premise is denied, and the sceptic's conclusion loses its support");

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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suppose-"));
  const html = path.join(tmp, "planted.html"), mhtml = path.join(tmp, "moorean.html");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), PLANTED, "-o", html], { stdio: "pipe" });
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), MOOREAN, "-o", mhtml], { stdio: "pipe" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const box = label => page.locator("#map g.alm-n").filter({ has: page.locator(".alm-title", { hasText: new RegExp("^" + label + "$") }) }).first();
    const menu = async (label, key) => {
      await box(label).click({ button: "right" });
      await page.locator(`#ctx button[data-supp-menu="${key}"]`).click();
      await page.waitForTimeout(250);
    };
    const faded = () => page.evaluate(() => [...document.querySelectorAll("#map g.alm-n.is-supposed-out")].map(g => g.getAttribute("data-id")));
    await page.goto("file://" + html);
    await page.waitForTimeout(800);
    check(await page.locator("#supp").isHidden(), "the panel is not shown until the reader supposes something");

    // Mutation: drop the menu items -> the click times out; drop setSupposition -> nothing fades.
    await menu("Obj", "holds");
    const side = await page.locator("#supp").innerText();
    const out = await faded();
    check(await page.locator("#supp").isVisible() && /Your suppositions/.test(side) && /‹P1› is false: rebutted by ‹Obj›/.test(side) &&
          /The text answers ‹Obj› with ‹Reply›/.test(side) && out.includes(id("P1")) && out.includes(id("Linked")) && !out.includes(id("Main")),
          "a right-click supposes the objection holds: the panel says what it costs, and what lost its support fades", JSON.stringify(out) + " " + side.slice(0, 300));

    // Undo from the panel. Mutation: drop the undo handler -> it stays.
    await page.locator('#supp button[data-supp-undo="holds"]').click();
    await page.waitForTimeout(200);
    check(await page.locator("#supp").isHidden() && (await faded()).length === 0, "Undo takes it back, and the map is whole again");

    // The attack on a whole argument asks which part. Mutation: drop the choice handler -> nothing fades.
    await menu("Whole", "holds");
    await page.locator('#supp button[data-supp-choice="step"]').click();
    await page.waitForTimeout(200);
    check((await faded()).includes(id("Linked")) && !(await faded()).includes(id("P1")), "an attack on a whole argument asks which part it denies, and cutting the step fades the argument");
    await page.locator('#supp button[data-supp-clear]').click();
    await page.waitForTimeout(200);

    // DENY THE CONCLUSION from the staircase, and keep a premise. Mutation: drop the keep handler -> nothing is forced.
    await page.goto("file://" + mhtml);
    await page.waitForTimeout(800);
    await box("The sceptic's argument").click({ button: "right" });
    await page.locator('#ctx button[data-supp-menu="deny"]').click();
    await page.waitForTimeout(250);
    await page.locator('#supp button[data-supp-keep="s:Moore cannot prove it"]').click();
    await page.waitForTimeout(150);
    await page.locator('#supp button[data-supp-keep="s:Knowledge needed"]').click();
    await page.waitForTimeout(150);
    const deny = await page.locator("#supp").innerText();
    check(/For ‹The proof proves nothing› to be false/i.test(deny) && /commits you to denying \(1\) ‹No proof, no knowledge›/.test(deny) &&
          /Decided from the formalizations/.test(deny),
          "deny the sceptic's conclusion, keep what Moore grants: the panel forces the first premise, decided from the formalizations", deny.slice(-500));
    await page.locator('#supp button[data-supp-clear]').click();
    await page.waitForTimeout(200);
    // The staircase's own button. Mutation: drop #xdeny's handler -> no panel.
    const opener = box("Moore's proof").locator(".alm-explode").first();
    if (await opener.count()) {
      await opener.click();
      await page.waitForTimeout(400);
      await page.locator("#xdeny").click();
      await page.waitForTimeout(300);
      check(await page.locator("#expl").isHidden() && /For ‹External things exist› to be false/i.test(await page.locator("#supp").innerText()),
            "the staircase's Deny the conclusion closes it and opens what must give");
    } else check(false, "the staircase opener is found on Moore's proof");

    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${fails ? fails + " of " + checks + " checks failed" : "all " + checks + " checks passed"}`);
process.exit(fails ? 1 : 0);
