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
const ACCOUNTS = path.join(REPO, "fixtures", "suppose", "accounts.argdown");
const DENIAL = path.join(REPO, "fixtures", "suppose", "denial.argdown");
const TRILEMMA = path.join(REPO, "fixtures", "suppose", "trilemma.argdown");
const ACTORS = path.join(REPO, "fixtures", "suppose", "actors.argdown");
const TEACHING = path.join(REPO, "teaching", "causal-junctions.argdown");
const A = require("./src/argdown-accounts.js");
const MV = require("./src/argdown-mechanism.js");

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

/* THE TABLE AS THE NEXT FORM (James's go, 18 Oct 2026; the think piece's follow-up, "structures to do
 * things with"): accounts against evidence, sets that cannot all hold, and in the Mechanism view what
 * the starting states do, who carries the chain, and a chain with nothing to draw. */
console.log("\naccounts against evidence, and what cannot all hold");
{
  const ga = graphOf(ACCOUNTS);
  const sets = A.accountSets(ga);
  // Mutation: let a reason that attacks the rival pair with it as an account -> three sets.
  check(sets.length === 1 && same(sets[0].accounts.map(x => x.label), ["Price explains the fall", "Habit explains the fall"]),
        "the text's account and the rival it reports make one set; a reason against the rival is a row, not an account", JSON.stringify(sets.map(x => x.accounts.map(y => y.label))));
  const kind = l => (sets[0].rows.find(x => x.label === l) || {}).kind;
  // Mutation: count any reason bearing on two accounts as telling them apart -> "alike" becomes "apart".
  check(kind("Sales fell where prices rose") === "apart" && kind("Sales fell after the levy") === "alike" &&
        kind("A trial found prices rose") === "one" && kind("Surveys show no change of taste") === "one",
        "a row tells the accounts apart only where it bears on two differently; alike where the same; one only where the text is silent on the other",
        JSON.stringify(sets[0].rows.map(x => [x.label, x.kind])));
  // A RIVAL THAT IS ONLY A DENIAL (19 Oct 2026). Mutation: make denies() always false -> no denial found.
  const gd = A.accountSets(graphOf(DENIAL));
  check(gd.length === 1 && gd[0].allDenials && gd[0].accounts[1].denial && !sets[0].allDenials && !sets[0].accounts[1].denial,
        "a rival that only denies the text's claim is marked a denial; a rival account is not", JSON.stringify(gd.map(x => x.accounts)));
  // Mutation: drop the shared-word condition -> "Strikebreakers..." pairs with any negated title.
  check(A.denies("Competition theory fails", "Competition theory") && A.denies("The proof was perfectly rigorous", "The proof was not conclusive") &&
        !A.denies("Strikebreakers because excluded", "Excluded because strikebreakers") && !A.denies("Education is not enough", "Prices explain the fall") &&
        !A.denies("Fees do not raise use", "Free nets were not used less"),
        "a denial is one title negated and a content word shared; two accounts, or two unrelated claims, are not");
  const gt = graphOf(TRILEMMA);
  const inc = A.inconsistentSets(gt);
  // Mutation: drop `inconsistentOf` from toGraph -> no set.
  check(inc.length === 1 && inc[0].name === "the levy trilemma" && inc[0].members.length === 3,
        "claims marked `inconsistent:` with one name make one set that cannot all hold", JSON.stringify(inc));
  const pairs = A.inconsistentSets(g).filter(x => !x.declared);
  check(pairs.length >= 1 && pairs.every(x => x.members.length === 2), "a contradictory pair the map draws is a set of two, without any mark");
}
console.log("\nthe Mechanism view: nothing to draw, the starting states, who carries the chain");
{
  const MJ = MV.model(graphOf(TEACHING));
  const chain = id => MV.chainModel(MJ, id);
  // Mutation: let `plainChain` refuse any chain with a finding -> the line's own composed route stops it.
  check(!!MV.plainChain(chain("mediation"), MV.follows(chain("mediation"))), "a chain that is one short line is set out in words");
  check(!MV.plainChain(chain("joint"), MV.follows(chain("joint"))) && !MV.plainChain(chain("fork"), MV.follows(chain("fork"))),
        "a joint cause or a fork is not a line, and is drawn");
  const J = MV.conditionsTable(chain("joint")), C = MV.conditionsTable(chain("collider"));
  // Mutation: keep every sufficient set, not the least -> spark+oxygen and more; or drop `jointly` from the starts -> null.
  check(J && same(J.needs.fire.sets, [["spark", "oxygen"]]) && !J.trivial, "the joint cause: the fire needs the spark and oxygen together", JSON.stringify(J && J.needs));
  check(C && C.trivial && same(C.needs.fame.sets, [["talent"], ["looks"]]), "the collider: either cause alone brings fame, and the table says so in a line");
  const MA = MV.model(graphOf(ACTORS));
  const ax = MV.actorOff(MA, ["heads"]);
  // Mutation: fail a state any of whose actors is idle -> the shared agreement fails too.
  check(same(ax.fail.sort(), ["hire", "smaller"]) && same(ax.shared, ["deal"]),
        "an actor doing nothing stops what it alone carries, and leaves a state it shares standing", JSON.stringify(ax));
  check(MV.suppose(MA, { fail: ax.fail }).lost.includes("smaller"), "and the outcome it carries is no longer brought about");
  check(same(MV.chainActors(MA).sort(), ["heads", "ministry", "unions"]) && MV.chainActors(MJ).length === 0,
        "the actor supposition is offered only where two actors or more carry the chain");
}

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
  // The Reader is built here, not taken from the repository root: that copy is gitignored, so
  // CI has none, and a local one may be older than the code under test.
  const reader = path.join(tmp, "reader.html");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), "--standalone", "-o", reader], { stdio: "pipe" });
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
    // AFTER THE ANSWER, ONE QUESTION ABOUT IT (the Purpose episode; ruled 20 Oct 2026, "B1"): here the
    // reader expected Main to go and the map keeps it. Mutations: drop guessReflectHTML from the banner
    // -> no question; light the claim alone in guessHolders -> Alone is not lit; leave the standing
    // line on while the guess is shown -> two questions at once.
    check(/You expected ‹Main› to go, but the map keeps it\. What still holds it up\?/.test(sumT) &&
          !(await page.locator("#supp .reflect").count()),
          "the banner asks about the one place the reader and the map parted, and the card's own line steps aside", sumT);
    await page.locator("#suppbar button[data-guess-held]").click();
    await page.waitForTimeout(300);
    const heldLit = await page.evaluate(() => [...document.querySelectorAll("#map g.alm-n.is-lit")]
      .map(g => [...g.querySelectorAll(".alm-title")].map(t => t.textContent.trim()).join(" ")).sort());
    check(heldLit.includes("Main") && heldLit.includes("Alone") && !heldLit.includes("Linked"),
          "Show what holds it up lights the claim and what still supports it, not what lost its support", JSON.stringify(heldLit));
    await page.locator("#suppbar button[data-guess-done]").click();
    await page.waitForTimeout(150);
    check(await page.locator("#map g.alm-n .alm-guess").count() === 0 && (await faded()).includes(id("Linked")),
          "Done takes the marks away and the supposition stays");
    // AND WITHOUT A GUESS, ONE STANDING LINE BACK TO THE TEXT ("B2"). Mutation: drop it -> none.
    check(/Did any of these surprise you\? Pick one and ask whether the text gives it a reason this map does not draw\./
            .test(await page.locator("#supp .reflect").innerText().catch(() => "")),
          "with no guess on show, What follows ends on one question that sends the reader back to the text");
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
    await page.addInitScript(() => { try { localStorage.setItem("ipsissima.walkthrough.v1", "seen"); localStorage.setItem("ipsissima.questionfirst.v1", "off"); } catch (e) {} });
    await page.goto("file://" + reader);
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

    // WEIGH THE ACCOUNTS, A PANEL AND A FOURTH WAY INTO STUDY (James, 18 Oct 2026).
    const build = (src, name) => { const out = path.join(tmp, name); execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), src, "-o", out], { stdio: "pipe" }); return out; };
    await page.goto("file://" + build(ACCOUNTS, "accounts.html"));
    await page.waitForTimeout(800);
    // Mutation: drop weighMenu from ctxShow -> the item is not offered.
    await box("Price explains the fall").click({ button: "right" });
    check(await page.locator('#ctx [data-weigh-menu="weigh"]').count() === 1, "right-click on an account offers Weigh the accounts");
    await page.locator('#ctx [data-weigh-menu="weigh"]').click();
    await page.waitForTimeout(200);
    if (await page.locator("#weigh [data-weigh-show]").count()) { await page.locator("#weigh [data-weigh-show]").click(); await page.waitForTimeout(150); }
    const wt = await page.locator("#weigh").innerText();
    check(/1 of the 4 reasons tells the accounts apart/.test(wt) && /In 2 rows the text says nothing about one account/.test(wt),
          "the panel says which reasons tell the accounts apart, and where the text is silent on one", wt.slice(0, 300));
    const row = await page.evaluate(() => [...document.querySelectorAll("#weigh tr[data-weigh-row]")].find(r => /where prices rose/.test(r.textContent)).getAttribute("data-weigh-row"));
    await page.locator(`#weigh [data-weigh-test="${row}"]`).click();
    await page.locator('#weigh [data-weigh-answer="needed:no"]').click();
    await page.locator('#weigh [data-weigh-answer="enough:yes"]').click();
    await page.waitForTimeout(100);
    const tv = await page.locator("#weigh .verdict").last().innerText();
    // Mutation: swap the two questions in the naming -> "a test to pass".
    check(/On your reading, a clincher/.test(tv) && /recorded against ‹Habit explains the fall›/.test(tv),
          "What kind of test? names the reader's reading in plain words, beside what the map records", tv);
    await page.locator(`#weigh [data-weigh-false="${row}"]`).click();
    await page.waitForTimeout(250);
    check(/Sales fell where prices rose› is false/.test(await page.locator("#suppbar").innerText()), "Suppose false from a row is an ordinary supposition, in the banner");
    await page.locator("#suppbar [data-supp-clear]").click();
    await page.locator("#weigh [data-weigh-close]").click();
    await page.waitForTimeout(150);
    await page.locator('#map [data-act="study"]').click();
    await page.waitForTimeout(250);
    // Mutation: drop the fourth button from studyOpening -> it is missing.
    check(await page.locator('#studybody [data-study="accounts"]').count() === 1, "Study offers Weigh the accounts as a fourth way in, where the map has accounts");
    await page.locator('#studybody [data-study="accounts"]').click();
    await page.locator('#studybody [data-study="acc-lean:1"]').click();
    await page.waitForTimeout(250);
    check(await page.locator("#weigh [data-weigh-show]").count() === 1 && /·/.test(await page.locator("#weigh table").innerText()),
          "after the reader leans one way, the panel opens with its cells hidden, for a guess first");
    await page.locator("#weigh tr[data-weigh-row]").filter({ hasText: "where prices rose" }).click();
    await page.locator("#weigh [data-weigh-show]").click();
    await page.waitForTimeout(150);
    check(/You marked 1; 1 of them does/.test(await page.locator("#weigh .verdict").first().innerText()) &&
          /blank for one account/.test(await page.locator("#studybody").innerText()), "Show sets the guess beside the map's answer, and the card moves on to the blank cells");
    await page.locator('#studybody [data-study="acc-done"]').click();
    check(/At the start you leaned to B/.test(await page.locator("#studybody").innerText()), "and closes by asking whether the first leaning survived");
    await page.locator('#studybody [data-study="end"]').click();
    await page.waitForTimeout(100);
    check(await page.locator("#weigh").isHidden(), "ending Study closes the panel it opened");

    // A DENIAL IS SAID, AND THE TABLE FOLDED (19 Oct 2026).
    await page.goto("file://" + build(DENIAL, "denial.html"));
    await page.waitForTimeout(800);
    await box("Fees do not raise use").click({ button: "right" });
    await page.locator('#ctx [data-weigh-menu="weigh"]').click();
    await page.waitForTimeout(200);
    const dv = await page.locator("#weigh").innerText();
    // Mutation: drop the denial line from weighAccountsHTML -> no "reads as the denial".
    check(/A reads as the denial of B/.test(dv) && /nothing here for the reasons to tell apart/.test(dv) &&
          await page.locator("#weigh details.weigh-anyway").count() === 1 && !(await page.locator("#weigh table").isVisible()),
          "where the rival is only a denial, the panel says so and folds the table", dv.slice(0, 300));
    await page.locator("#weigh details.weigh-anyway summary").click();
    check(await page.locator("#weigh table").isVisible(), "and the reasons can still be set out on request");
    await page.locator("#weigh [data-weigh-close]").click();
    await page.locator('#map [data-act="study"]').click();
    await page.waitForTimeout(250);
    // Mutation: use weighSets in studyOpening -> the button is offered.
    check(await page.locator('#studybody [data-study="accounts"]').count() === 0, "and Study does not offer a bare denial as accounts to weigh");
    await page.locator('#studybody [data-study="end"]').first().click().catch(() => {});

    // WHICH WOULD YOU GIVE UP?
    await page.goto("file://" + build(TRILEMMA, "trilemma.html"));
    await page.waitForTimeout(800);
    await box("The levy is high").click();
    await page.waitForTimeout(150);
    await page.locator("#whatif").click();
    await page.locator("#ctx button", { hasText: "cannot all hold" }).click();
    await page.waitForTimeout(200);
    if (await page.locator("#weigh [data-weigh-show]").count()) { await page.locator("#weigh [data-weigh-show]").click(); await page.waitForTimeout(150); }
    const gv = await page.locator("#weigh").innerText();
    // Mutation: sort by claims lost before main claims -> still the yield; sort descending -> the levy.
    check(/Least costly to give up, by the map: ‹The yield is large›/.test(gv) && /2 claims lose support, 1 main/.test(gv),
          "a set that cannot all hold, from What if…?: what giving up each costs, and the least", gv.slice(0, 300));

    // THE MECHANISM VIEW.
    await page.goto("file://" + build(TEACHING, "teaching.html"));
    await page.waitForTimeout(800);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(300);
    await page.locator("#mech select[data-chain]").selectOption("mediation");
    await page.waitForTimeout(250);
    // Mutation: drop `stage.hidden = true` -> the chart is drawn as well.
    check(await page.locator(".amech-words").isVisible() && await page.locator("#mech .amech-stage").isHidden() &&
          /raises “Lung cancer”/.test(await page.locator(".amech-words").innerText()), "a chain that is one short line opens in words, step by step");
    await page.locator("[data-draw-line]").click();
    await page.waitForTimeout(250);
    check(await page.locator(".amech-words").count() === 0 && await page.locator("#mech .amech-stage").isVisible(), "Draw it draws it");
    await page.locator("#mech select[data-chain]").selectOption("joint");
    await page.waitForTimeout(250);
    await page.locator("[data-cond-show]").click();
    await page.waitForTimeout(150);
    check(/needs “A spark” and “Oxygen is present”, together/.test(await page.locator(".amech-side").innerText()), "the panel says what the outcome needs of the starting states");
    await page.locator('[data-cond-start="oxygen"]').click();
    await page.waitForTimeout(250);
    check(/Oxygen is present” does not happen/.test(await page.locator("#suppbar").innerText()), "switching a start off is a supposition, in the one banner");
    await page.locator("#suppbar [data-supp-clear]").click();
    await page.goto("file://" + build(ACTORS, "actors.html"));
    await page.waitForTimeout(800);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(300);
    await page.locator('#mech .st[data-state="hire"]').click({ button: "right" });
    await page.locator('#ctx [data-supp-menu="actor"]').click();
    await page.waitForTimeout(250);
    const aside = await page.locator(".amech-side").innerText();
    check(/Head teachers” does nothing/.test(await page.locator("#suppbar").innerText()) && /Classes are smaller” is no longer brought about/.test(aside) &&
          /staffing agreement” is carried with others too/.test(aside), "suppose an actor does nothing: what it alone carries stops, a shared state stands and is named", aside.slice(0, 300));
    // THE MECHANISM PANEL'S STANDING LINE (the Purpose episode; ruled 20 Oct 2026, "B2", as in Reasons).
    // Mutation: drop it from expHTML -> none.
    check(/Did any of these surprise you\? Pick one and ask whether the text names a route to it that this chain does not draw\./.test(aside),
          "with no guess, the chain's panel ends on one question that sends the reader back to the text");

    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${fails ? fails + " of " + checks + " checks failed" : "all " + checks + " checks passed"}`);
process.exit(fails ? 1 : 0);
