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
const SEVERAL = path.join(REPO, "fixtures", "suppose", "several.argdown");

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
  const shtml = path.join(tmp, "several.html");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), SEVERAL, "-o", shtml], { stdio: "pipe" });
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
    const bannerT = await page.locator("#suppbar").innerText();
    check(await page.locator("#supp").isVisible() && /What follows/.test(side) && /Supposing/.test(bannerT) && /‹Obj› holds, as an objection/.test(bannerT) &&
          /‹P1› is false: rebutted by ‹Obj›/.test(side) &&
          /The text answers ‹Obj› with ‹Reply›/.test(side) && out.includes(id("P1")) && out.includes(id("Linked")) && !out.includes(id("Main")),
          "a right-click supposes the objection holds: the panel says what it costs, and what lost its support fades", JSON.stringify(out) + " " + side.slice(0, 300));

    // Undo from the banner. Mutation: drop the undo handler -> it stays.
    await page.locator('#suppbar button[data-supp-undo="holds"]').click();
    await page.waitForTimeout(200);
    check(await page.locator("#supp").isHidden() && await page.locator("#suppbar").isHidden() && (await faded()).length === 0, "Undo takes it back, and the map is whole again");

    // WHAT IF...? BESIDE THE CLAIM IN HAND (18 Oct 2026): a plain click offers the suppositions a reader
    // would otherwise need right-click to find. Mutation: drop onSelect -> the button never shows.
    await box("P2").click();
    await page.waitForTimeout(150);
    check(await page.locator("#whatif").isVisible(), "a click on a claim offers What if…? beside it");
    await page.locator("#whatif").click();
    await page.locator('#ctx button[data-supp-menu="false"]').click();
    await page.waitForTimeout(250);
    check((await faded()).includes(id("P2")) && /‹P2› is false/.test(await page.locator("#suppbar").innerText()),
          "and its menu supposes the claim false, as right-click does");
    await page.mouse.click(5, 300);
    await page.waitForTimeout(100);
    check(await page.locator("#whatif").isHidden(), "the button goes at the next press elsewhere");
    await page.locator('#suppbar button[data-supp-clear]').click();
    await page.waitForTimeout(200);

    // GUESS FIRST, THEN SEE (James, 18 Oct 2026: the map's answer drawn beside the reader's marks).
    // Mutations: show the whole fade while guessing -> Linked fades before Show; drop guessPick from
    // whatIfShow -> nothing is marked; mark hits as misses -> the tags disagree.
    await box("P1").click({ button: "right" });
    await page.locator('#ctx button[data-supp-menu="guessfirst"]').click();
    await menu("P1", "false");
    const g0 = await faded();
    check(/Before you look/.test(await page.locator("#suppbar").innerText()) && g0.includes(id("P1")) && !g0.includes(id("Linked")) &&
          await page.locator("#supp").isHidden(),
          "with Guess first on, a supposition asks for a guess and shows only what was supposed", JSON.stringify(g0));
    await box("Linked").click();
    await box("Main").click();
    await page.waitForTimeout(150);
    check(/Marked: 2/.test(await page.locator("#suppbar").innerText()) && await page.locator("#map g.alm-n .alm-guess-guess").count() === 2,
          "a click on a claim marks it as a guess, and does nothing else");
    await page.locator("#suppbar button[data-guess-show]").click();
    await page.waitForTimeout(250);
    const tagOf = label => box(label).locator(".alm-guess").getAttribute("class");
    const sumT = await page.locator("#suppbar").innerText();
    check(/alm-guess-hit/.test(await tagOf("Linked")) && /alm-guess-miss/.test(await tagOf("Main")) && (await faded()).includes(id("Linked")) &&
          /You marked 2\. 1 of them loses the map’s support/.test(sumT),
          "Show draws the map's answer beside the marks: the one it agrees with, the one it keeps", sumT);
    await page.locator("#suppbar button[data-guess-done]").click();
    await page.waitForTimeout(150);
    check(await page.locator("#map g.alm-n .alm-guess").count() === 0 && (await faded()).includes(id("Linked")),
          "Done takes the marks away and the supposition stays");
    await page.locator("#suppbar input[data-guess-on]").click();
    await page.locator('#suppbar button[data-supp-clear]').click();
    await page.waitForTimeout(200);

    // WHICH CLAIM WOULD COST THE MOST? (James, 18 Oct 2026): a guess, then the map's own answer, by
    // supposing each claim false in turn. On the planted map Rule and Fact each take four claims' support,
    // a main claim (Wrong) among them; P1 takes Linked's only. Mutations: rank by claims lost alone ->
    // the same here, so also: drop the main-claim tier -> Rule and Fact still lead, but sort by label
    // the other way -> the order changes; drop studyCostPick -> no guess is recorded.
    await page.locator('#map [data-act="study"]').click();
    await page.waitForTimeout(250);
    await page.locator('#studybody button[data-study="cost"]').click();
    await page.waitForTimeout(500);
    await box("P1").click();
    await page.waitForTimeout(150);
    check(/Your guess: ‹P1›/.test(await page.locator("#studybody").innerText()), "the challenge takes a click on a claim as the guess");
    await page.locator('#studybody button[data-study="cost-show"]').click();
    await page.waitForTimeout(250);
    const costT = await page.locator("#studybody").innerText();
    const order = [...costT.matchAll(/^‹([^›]+)›: \d+ claims? loses?/gm)].map(m => m[1]);
    check(same(order, ["Fact", "Rule", "A"]) && /‹Fact›: 4 claims lose the map’s support, a main claim among them/.test(costT) &&
          /Your guess, ‹P1›: 1 claim loses the map’s support — \d+ of \d+\./.test(costT),
          "Show ranks the claims by what supposing each false costs, and sets the guess beside them", costT);
    await page.locator('#studybody button[data-study="cost-suppose-top"]').click();
    await page.waitForTimeout(250);
    check(/‹Fact› is false/.test(await page.locator("#suppbar").innerText()), "and offers to suppose the costliest false");
    await page.locator("#suppbar button[data-guess-skip]").click().catch(() => {});
    await page.locator('#suppbar button[data-supp-clear]').click();
    await page.locator('#studybody button[data-study="end"]').first().click();
    await page.waitForTimeout(200);

    // The attack on a whole argument asks which part. Mutation: drop the choice handler -> nothing fades.
    await menu("Whole", "holds");
    await page.locator('#supp button[data-supp-choice="step"]').click();
    await page.waitForTimeout(200);
    check((await faded()).includes(id("Linked")) && !(await faded()).includes(id("P1")), "an attack on a whole argument asks which part it denies, and cutting the step fades the argument");
    await page.locator('#suppbar button[data-supp-clear]').click();
    await page.waitForTimeout(200);

    // STUDY ON MY OWN (James, 18 Oct 2026; Lang's Predicting): the card opens on what the reader
    // already thinks, then one argument at a time -- its premises given, where they lead held back --
    // with hints asked for and the answer on Show; an objection is met as a fork, tried by supposing
    // it holds, with a guess first. Mutations: show the conclusion before Show -> the first check
    // fails; drop the hint ladder -> no hint; drop the fork -> no supposition is offered.
    await page.goto("file://" + mhtml);
    await page.waitForTimeout(800);
    await page.locator('#map [data-act="study"]').click();
    await page.waitForTimeout(300);
    const open0 = await page.locator("#studybody").innerText();
    check(/What do you already think about it/.test(open0) && await page.locator('#studybody button[data-study="own"]').count() === 1 &&
          await page.locator('#studybody button[data-study="others"]').count() === 1,
          "Study opens by asking what the reader already thinks, and offers On my own and With others", open0.slice(0, 200));
    await page.locator('#studybody button[data-study="own"]').click();
    await page.waitForTimeout(250);
    const u1 = await page.locator("#studybody").innerText();
    check(/starts from:|offered as reasons/.test(u1) && /Before you look: what do you think/.test(u1) && !/The map:/.test(u1),
          "on my own, a card gives an argument's premises and asks where they lead, without saying", u1.slice(0, 300));
    await page.locator('#studybody button[data-study="hint"]').click();
    await page.waitForTimeout(100);
    await page.locator('#studybody button[data-study="hint"]').click();
    await page.waitForTimeout(100);
    const u1h = await page.locator("#studybody").innerText();
    check((u1h.match(/Hint:/g) || []).length === 2 && /the map calls it ‹/.test(u1h) && await page.locator('#studybody button[data-study="hint"]').count() === 0,
          "hints come one at a time, as asked for, the second naming the conclusion", u1h.slice(-300));
    await page.locator('#studybody button[data-study="show"]').click();
    await page.waitForTimeout(300);
    const u1s = await page.locator("#studybody").innerText();
    const litNow = await page.evaluate(() => [...document.querySelectorAll("#map g.alm-n.is-lit .alm-title")].map(t => t.textContent));
    check(/^The map: ‹/m.test(u1s) && litNow.length > 0, "Show gives the map's conclusion and lights it", JSON.stringify(litNow));
    // On to the fork: Moore's map has an objection.
    let sawFork = false;
    for (let k = 0; k < 12 && !sawFork; k++) {
      await page.locator('#studybody button[data-study="next"]').first().click();
      await page.waitForTimeout(200);
      sawFork = await page.locator('#studybody button[data-study="fork-suppose"]').count() > 0;
    }
    check(sawFork && /speaks against/.test(await page.locator("#studybody").innerText()), "an objection is met as a fork, with a supposition to try");
    if (sawFork) {
      await page.locator('#studybody button[data-study="fork-suppose"]').click();
      await page.waitForTimeout(250);
      check(/Before you look/.test(await page.locator("#suppbar").innerText()) && /holds, as an objection/.test(await page.locator("#suppbar").innerText()),
            "trying it supposes the objection holds, and in Study the reader guesses first");
      await page.locator("#suppbar button[data-guess-skip]").click();
      await page.locator('#suppbar button[data-supp-clear]').click();
      await page.waitForTimeout(150);
    }
    await page.locator('#studybody button[data-study="finish"]').first().click();
    await page.waitForTimeout(150);
    check(/which claim would you most want to deny/i.test(await page.locator("#studybody").innerText()),
          "finishing ends on a supposition to try, and on what the reader thought at the start");
    await page.locator('#studybody button[data-study="end"]').click();
    await page.waitForTimeout(150);
    // Study from here: the arguments beneath one claim only.
    await box("The proof proves nothing").click({ button: "right" });
    await page.locator('#ctx button[data-study-from]').click();
    await page.waitForTimeout(250);
    const fromT = await page.locator("#studyhint").innerText();
    check(await page.locator("#studycard").isVisible() && /^1 of \d+$/.test(fromT) && +fromT.split(" of ")[1] < 6,
          "Study from here works through only the arguments beneath that claim", fromT);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    // A CLAIM THAT STATES TWO STEPS, supposed false in Reasons: at least one step does not run, and the
    // Mechanism panel asks which (18 Oct 2026). Mutations: push every step of the claim -> both arrows
    // fade and no question is asked; drop the choice handler -> nothing fades.
    await page.goto("file://" + shtml);
    await page.waitForTimeout(800);
    await menu("Two effects", "false");
    check(/in Mechanism, one of its 2 steps does not run/.test(await page.locator("#suppbar").innerText()),
          "the banner says one of the claim's two steps stops, not which", await page.locator("#suppbar").innerText());
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(500);
    const cutOf = k => page.locator(`#mech svg g[data-edge="${k}"]:not(.chip).cut`).count();
    check(/Which do you suppose\?/.test(await page.locator("#mech .amech-side").innerText()) &&
          await page.locator("#mech .amech-side button[data-exp-choose]").count() === 2 && await cutOf("gap>queue") === 0 && await cutOf("gap>private") === 0,
          "the Mechanism panel asks which of the two steps does not run, and fades neither until told");
    await page.locator('#mech .amech-side button[data-exp-choose][data-to="queue"]').click();
    await page.waitForTimeout(300);
    check(await cutOf("gap>queue") > 0 && await cutOf("gap>private") === 0 && /the step you chose does not run/.test(await page.locator("#suppbar").innerText()),
          "the chosen step fades, the other runs, and the banner says it is the one chosen");
    await page.locator('#suppbar button[data-supp-clear]').click();
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
    await page.locator('#suppbar button[data-supp-clear]').click();
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

    // A NEW FILE STARTS WITH NOTHING SUPPOSED (James, 18 Oct 2026: the list carried over into the next
    // file). In the Reader, where a second file is opened by dropping it, a supposition is made and a
    // guess left half done; then a file is dropped. Mutation: drop suppReset from render -> the banner
    // and the marks survive.
    const dropFile = async (file) => {
      await page.evaluate(([t, n]) => {
        const dt = new DataTransfer();
        dt.items.add(new File([t], n));
        document.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      }, [fs.readFileSync(file, "utf8"), path.basename(file)]);
      await page.waitForFunction(n => document.getElementById("fname").dataset.file === n, path.basename(file), { timeout: 20000 });
      await page.waitForTimeout(1200);
    };
    // The Reader offers its tour to a first-time reader: marked seen, as for a returning one.
    await page.addInitScript(() => { try { localStorage.setItem("ipsissima.walkthrough.v1", "seen"); } catch (e) {} });
    await page.goto("file://" + path.join(REPO, "Ipsissima Reader.html"));
    await page.waitForTimeout(800);
    await dropFile(PLANTED);
    await box("Main").click({ button: "right" });
    await page.locator('#ctx button[data-supp-menu="guessfirst"]').click();
    await menu("Main", "false");
    await box("Wrong").click();
    await page.waitForTimeout(150);
    const midGuess = await page.locator("#map g.alm-n .alm-guess").count();
    await dropFile(MOOREAN);
    check(midGuess === 1 && await page.locator("#suppbar").isHidden() && (await faded()).length === 0 && await page.locator("#map g.alm-n .alm-guess").count() === 0,
          "opening another file clears every supposition and any guess in progress", "marks before: " + midGuess);
    await box("Moore's proof").click({ button: "right" });
    await page.locator('#ctx button[data-supp-menu="guessfirst"]').click();

    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${fails ? fails + " of " + checks + " checks failed" : "all " + checks + " checks passed"}`);
process.exit(fails ? 1 : 0);
