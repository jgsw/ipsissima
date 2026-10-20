// The text's comparisons as tables (a trial, 20 Oct 2026; ipsissima-mcp docs/tabulation-pass.md).
//
//     node app/test_tables.mjs
//
// The planted fixtures in fixtures/frames/ carry their answers in their headers, written before the
// code: the definition's coin guess meets the rule and is not a good guess; the card guess leaves a
// cell empty; the weather and coin guesses differ in the verdict and in nothing else stated...
// and the grant is better than the fee on every count the text ranks. Declared accounts come first, and
// the derived ones sit beside them unless they repeat a declared account (James's ruling, 20 Oct 2026).
import { argdown } from "@argdown/core";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
require("./src/argdown-validity.js");
const { toGraph, RUN } = await import("./argdown-graph.mjs");
const T = require("./src/argdown-tables.js");
const A = require("./src/argdown-accounts.js");
const graphOf = f => toGraph(argdown.run({ input: fs.readFileSync(path.join(REPO, "fixtures", f), "utf8"), ...RUN }));

let fails = 0;
const check = (ok, name, got) => { if (!ok) fails++; console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || got === undefined ? "" : "\n          got " + got}`); };

console.log("the definition and its counterexample");
{
  const g = graphOf("frames/definition.argdown");
  check(g.frames && g.frames.frames.length === 4 && g.frames.cells.length === 8,
        "the graph carries the frames and the eight cells the claims state", JSON.stringify(g.frames && g.frames.cells.length));
  const [t] = T.caseTables(g);
  check(t && t.rows.length === 3 && t.columns.map(c => c.id).join() === "informed,right,good",
        "one case table: the cases as rows, the dimensions as columns and the verdict last", t && t.columns.map(c => c.id).join());
  // Mutation: count a cell as filled when it has no claim -> 0 empty.
  check(t.empty.length === 1 && t.empty[0].row === "C" && t.empty[0].column === "informed",
        "the cell the text leaves empty is named, and never filled", JSON.stringify(t.empty));
  check(t.cells.C.good.values[0] === "no" && t.cells.C.right.claims[0].title === "The card guess was right",
        "one claim may state two cells", JSON.stringify(t.cells.C));
  // Mutation: let a row with an empty dimension be compared -> B/C appear.
  check(t.apart.length === 0, "no pair is set apart where a dimension is unstated or two differ", JSON.stringify(t.apart));
  // Mutation: test `!meets` only -> the coin guess is not found.
  check(t.againstRule.length === 1 && t.againstRule[0].row === "B" && t.againstRule[0].meets && t.againstRule[0].got === "no",
        "the row that meets the stated rule and gets another verdict is the counterexample", JSON.stringify(t.againstRule));
  // A row that differs from another in one stated dimension only.
  const g2 = graphOf("frames/definition.argdown");
  g2.frames.cells.push({ title: "x", id: null, text: "", kind: "claim", coords: { case: "C", informed: "no" } });
  const [t2] = T.caseTables(g2);
  // Mutation: require diff.length === 2 -> none.
  const ac = t2.apart.find(p => p.a === "A" && p.b === "C"), bc = t2.apart.find(p => p.a === "B" && p.b === "C");
  check(t2.apart.length === 2 && ac && ac.dimension === "informed" && ac.verdicts[0].differ && bc && !bc.verdicts[0].differ,
        "two rows alike in every stated dimension but one are set apart, with whether the verdict differs too", JSON.stringify(t2.apart));
  // Mutation: drop the alike branch -> none.
  check(t.alike.length === 1 && t.alike[0].a === "A" && t.alike[0].b === "B" && t.alike[0].values.join() === "yes,no",
        "two rows alike in every stated dimension and given different verdicts are named", JSON.stringify(t.alike));
}

console.log("options, criteria and two accounts");
{
  const g = graphOf("frames/options.argdown");
  const [t] = T.caseTables(g);
  // Mutation: compare ranks the wrong way -> the grant is worse.
  check(t.dominated.length === 1 && t.dominated[0].worse === "fee" && t.dominated[0].better === "grant",
        "a case worse on every count the text ranks is named, and nothing is totalled", JSON.stringify(t.dominated));
  check(t.dominated[0].on.join() === "reach,cost", "  and the counts it is worse on are named", JSON.stringify(t.dominated[0]));
  check(t.empty.filter(e => e.row === "lottery").length === 2, "the option the text never weighs is two empty cells");
  const sets = A.accountSets(g);
  // Mutation: drop the declaredSets branch -> the derived pairing finds "Reading moved online" attacking the claim.
  // Mutation: drop the repeat filter -> the derived pairing of "Fund it by grant" with "Reading moved online" comes back.
  check(sets.length === 1 && sets[0].declared && sets[0].accounts.map(a => a.label).join() === "Shorter hours cut visits,Reading moved online",
        "declared accounts come first, the text's own first, and a derived set that repeats one of them is dropped", JSON.stringify(sets.map(s => s.accounts.map(a => a.label))));
  const row = sets[0].rows.find(r => r.label === "Visits fell on the closed evenings");
  check(row && row.kind === "apart", "and a finding drawn for one and against the other tells them apart", JSON.stringify(row));
}

console.log("declared accounts beside the derived ones");
{
  // Mutation: return the declared sets alone -> one set.
  const g = graphOf("frames/studies.argdown");
  const lab = id => g.nodes.find(n => n.id === id).label;
  const sets = A.accountSets(g).map(s => [!!s.declared, s.accounts.map(a => lab(a.id)).join(" | "), s.rows.length]);
  check(JSON.stringify(sets) === JSON.stringify([[true, "More practice helped | More attention helped", 4],
                                                  [false, "Reading improved in the east | The east scores were a fluke", 0],
                                                  [false, "The reports disagree | The reports agree", 3]]),
        "a rival outside the declared accounts is still weighed, beside them and after", JSON.stringify(sets));
}

console.log("an account set's rows grouped by case");
{
  // Two findings of one study, each bearing on one account, are one row that tells them apart.
  const g = graphOf("frames/options.argdown");
  const byTitle = t => g.nodes.find(n => n.label === t).id;
  g.frames.frames.push({ id: "site", kind: "case", label: "Site", values: [{ id: "north", label: "North branch" }] });
  const set = A.accountSets(g)[0];
  const ev = byTitle("Visits fell on the closed evenings");
  // Plant a second finding of the same site, for one account only, by hand.
  set.rows = [{ id: ev, label: "x", cells: { [set.accounts[0].id]: "for" }, kind: "one" },
              { id: "n-other", label: "y", cells: { [set.accounts[1].id]: "against" }, kind: "one" }];
  g.frames.cells.push({ title: "x", id: ev, text: "", kind: "claim", coords: { site: "north" } },
                      { title: "y", id: "n-other", text: "", kind: "claim", coords: { site: "north" } });
  const groups = T.accountRowsByCase(g, set);
  // Mutation: key groups by row id -> two groups of kind "one".
  check(groups.length === 1 && groups[0].label === "North branch" && groups[0].kind === "apart" && groups[0].rows.length === 2,
        "two one-account rows from one case are one row that tells the accounts apart", JSON.stringify(groups));
}

console.log("a map with no frames");
{
  const g = graphOf("suppose/accounts.argdown");
  check(g.frames === null && T.caseTables(g).length === 0 && T.crossTables(g).length === 0,
        "has no tables, and its accounts are still derived as before", String(g.frames));
  check(A.accountSets(g).length === 1 && !A.accountSets(g)[0].declared, "  (the derived set, unchanged)");
}

console.log("cases crossed with cases");
{
  const g = graphOf("frames/options.argdown");
  g.frames.frames.push({ id: "year", kind: "case", label: "Year", values: [{ id: "y1", label: "2024" }, { id: "y2", label: "2025" }] });
  g.frames.cells.push({ title: "A grant reaches everyone", id: null, text: "", kind: "claim", coords: { option: "grant", year: "y1", reach: "everyone" } });
  const [x] = T.crossTables(g);
  check(x && x.rowsFrame === "option" && x.columnsFrame === "year" && x.filled === 1 && x.size === 6 &&
        x.cells.grant.y1[0].values.reach === "everyone",
        "a claim naming two case frames sits where they cross, with its other values beside it", JSON.stringify(x && x.cells));
}

/* ------------------------------------------------------------ the panel, under real clicks */
// Step 6 of "Tables by design" (James's ruling, 20 Oct 2026): the Tables panel, beside Study, on a map
// that declares frames. Each check names the mutation it was run against.
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); }
catch (e) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("\nFAIL — Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("\nSKIPPED the browser half — Playwright's Chromium is not installed here.");
  chromium = null;
}
if (chromium) {
  console.log("\nthe Tables panel, driven with real clicks");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tables-"));
  const build = (f, name) => { const out = path.join(tmp, name); execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), path.join(REPO, "fixtures", f), "-o", out], { stdio: "pipe" }); return out; };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const box = label => page.locator("#map g.alm-n").filter({ has: page.locator(".alm-title", { hasText: new RegExp("^" + label + "$") }) }).first();
    // THE WHOLE TITLE, every line of it. A title that wraps is drawn as one .alm-title per line, and
    // where it wraps depends on the fonts: CI's Linux fonts wrapped "West attention made no
    // difference" after "no", and the first line alone failed a check that passed on a Mac.
    const lit = () => page.evaluate(() => [...document.querySelectorAll("#map g.alm-n.is-lit")]
      .map(g => [...g.querySelectorAll(".alm-title")].map(t => t.textContent.trim()).join(" ")).sort());
    const tablesBtn = page.locator('#map [data-act="tables"]');
    const open = async file => { await page.goto("file://" + file); await page.waitForTimeout(900); };

    // A MAP WITH NO FRAMES has no Tables button. Mutation: never hide it in tablesSync -> it shows.
    await open(build("suppose/accounts.argdown", "accounts.html"));
    check(await page.locator('#map [data-act="study"]').isVisible() && !(await tablesBtn.isVisible()), "a map that declares no frames offers no Tables");

    // THE DEFINITION: the button beside Study, and the table with the moves the text makes.
    const def = build("frames/definition.argdown", "definition.html");
    await open(def);
    // Mutation: drop onTables from the live map's options -> no button.
    check(await tablesBtn.isVisible(), "a map that declares frames offers Tables beside Study");
    await tablesBtn.click();
    await page.waitForTimeout(250);
    const t0 = await page.locator("#tables").innerText();
    // Mutation: put the verdict column first -> the header order fails.
    const heads = await page.$$eval("#tables thead th", ths => ths.map(t => t.textContent));
    check(await page.locator("#tables").isVisible() && heads.join("|") === "|made on evidence|turned out right|a good guess" &&
          (await tablesBtn.getAttribute("aria-pressed")) === "true",
          "the panel opens on the cases as rows, the respects as columns and the verdict last, and the button is lit", heads.join("|"));
    // Mutation: fill an empty cell with a dash -> its text is not empty.
    const silent = await page.$$eval("#tables td.silent", tds => tds.map(t => t.textContent));
    check(silent.length === 1 && silent[0] === "" && /silent in 1/.test(t0), "the one cell the text leaves empty is shown empty, as its silence", JSON.stringify(silent));
    // Mutation: drop the againstRule lines -> no "meets the rule".
    check(/The coin guess meets the rule of ‹The definition› \(if made on evidence: yes and turned out right: yes, then a good guess: yes\), and is given no\./.test(t0) &&
          /The weather guess and The coin guess are alike in every respect the text states/.test(t0),
          "the panel names the case against the stated rule, and the two alike in all but the verdict", t0.slice(0, 600));
    // CLICKING A VALUE goes to the claim that states it. Mutation: drop the data-tables-go handler -> nothing lit.
    await page.locator('#tables tr[data-tables-row="B"] td').nth(2).locator(".go").click();
    await page.waitForTimeout(300);
    check(JSON.stringify(await lit()) === JSON.stringify(["The coin guess was not good"]), "clicking a value lights the claim that states it", JSON.stringify(await lit()));
    // A CASE clicked lights every claim about it. Mutation: light the first cell's claim only -> one.
    await page.locator('#tables tr[data-tables-row="B"] th').click();
    await page.waitForTimeout(300);
    check(JSON.stringify(await lit()) === JSON.stringify(["The coin guess was informed", "The coin guess was not good", "The coin guess was right"]),
          "clicking a case lights every claim the text makes about it", JSON.stringify(await lit()));
    // The button is a switch. Mutation: tablesToggle always opens -> still visible.
    await tablesBtn.click();
    await page.waitForTimeout(200);
    check(await page.locator("#tables").isHidden() && (await tablesBtn.getAttribute("aria-pressed")) === "false" && (await lit()).length === 0,
          "pressing Tables again closes the panel and puts out the lights");

    // THE RIGHT-CLICK MENU, on a claim that sits in a table and on one that does not.
    // Mutation: drop tablesMenu from ctxShow -> no entry.
    await box("The definition fails").click({ button: "right" });
    const offFail = await page.locator('#ctx [data-tables-menu]').count();
    await page.keyboard.press("Escape");
    await box("The card guess was right").click({ button: "right" });
    check(offFail === 0 && await page.locator('#ctx [data-tables-menu="tables"]').count() === 1, "right-click offers Set out in a table on a claim in a table, and only there");
    await page.locator('#ctx [data-tables-menu="tables"]').click();
    await page.waitForTimeout(250);
    // Mutation: drop `here` from tablesGo -> no cell marked.
    const here = await page.$$eval("#tables .go.here", gs => gs.map(g => g.textContent));
    check(JSON.stringify(here) === JSON.stringify(["yes", "no"]), "and the panel marks the cells that claim states (one claim, two cells)", JSON.stringify(here));
    await page.locator("#tables [data-tables-close]").click();

    // GUESS FIRST hides the values and the moves until Show. Mutation: render values while !shown -> the guess check fails.
    await box("The definition").click({ button: "right" });
    await page.locator('#ctx button[data-supp-menu="guessfirst"]').click();
    await page.waitForTimeout(150);
    await tablesBtn.click();
    await page.waitForTimeout(250);
    const g0 = await page.locator("#tables").innerText();
    check(await page.locator("#tables td.hid").count() === 9 && await page.locator("#tables td.silent").count() === 0 && await page.locator("#tables .go").count() === 0 &&
          await page.locator("#tables ul.moves").count() === 0 && /Which case goes against the rule/.test(g0),
          "with Guess first on, every cell is hidden, the empty one too, and the panel asks which case goes against the rule", g0.slice(0, 400));
    // Mutation: count picks against the wrong move -> 0 of them.
    await page.locator('#tables tr[data-tables-row="B"] th').click();
    await page.locator('#tables tr[data-tables-row="C"] th').click();
    await page.waitForTimeout(100);
    check(/Marked: 2/.test(await page.locator("#tables").innerText()), "clicking cases marks them as the guess");
    await page.locator("#tables [data-tables-show]").click();
    await page.waitForTimeout(200);
    const g1 = await page.locator("#tables").innerText();
    check(/You marked 2; 1 of them goes against the rule\./.test(g1) && await page.locator("#tables td.silent").count() === 1 && await page.locator("#tables ul.moves li").count() === 2,
          "Show sets the guess beside the table's answer, with the values and the moves", g1.slice(0, 500));
    await page.locator("#tables [data-tables-close]").click();
    await box("The definition").click({ button: "right" });
    await page.locator('#ctx button[data-supp-menu="guessfirst"]').click();

    // OPTIONS: a case worse on every ranked count, and a declared account set.
    await open(build("frames/options.argdown", "options.html"));
    await tablesBtn.click();
    await page.waitForTimeout(250);
    const o0 = await page.locator("#tables").innerText();
    // Mutation: drop the dominated lines -> no "no better than".
    check(/A membership fee is no better than A council grant on any count the text ranks \(who it reaches, cost to the council\), and worse on at least one\. Nothing is totalled\./.test(o0) &&
          await page.locator("#tables td.silent").count() === 2, "the option worse on every ranked count is named, nothing totalled, and the unweighed option left empty", o0.slice(0, 500));
    const opts = await page.$$eval("#tables select option", os => os.map(o => o.textContent));
    check(JSON.stringify(opts) === JSON.stringify(["Ways to fund the library", "Why visits fell (accounts)"]), "the declared account set is a table of its own", JSON.stringify(opts));
    await page.locator("#tables select").selectOption("1");
    await page.waitForTimeout(200);
    check(/1 of the 1 rows tells the accounts apart/.test(await page.locator("#tables").innerText()), "the account set's reason tells the two accounts apart");
    // Mutation: drop the data-tables-weigh handler -> weigh stays shut.
    await page.locator("#tables [data-tables-weigh]").click();
    await page.waitForTimeout(250);
    check(await page.locator("#tables").isHidden() && /Weigh the accounts/.test(await page.locator("#weigh").innerText()), "Weigh these accounts hands the set to the weigh panel");
    await page.locator("#weigh [data-weigh-close]").click();

    // STUDIES: findings grouped by the study they are about, a cross table, and a cell with two values.
    await open(build("frames/studies.argdown", "studies.html"));
    await tablesBtn.click();
    await page.waitForTimeout(250);
    const s0 = await page.locator("#tables").innerText();
    // Mutation: hide a two-valued cell's second value -> one value shown.
    check(/practice \/ luck/.test(s0) && await page.locator("#tables td.two").count() === 1 &&
          /The west study is given 2 values for the story it tells against \(practice, luck\)\. Does the text say both\?/.test(s0),
          "a cell given two values shows both, as the text gives them, and asks whether the text says both", s0.slice(0, 600));
    await page.locator("#tables select").selectOption({ label: "The studies × What the text asks of them" });
    await page.waitForTimeout(200);
    check(/The text fills 3 of the 4 cells/.test(await page.locator("#tables").innerText()) && await page.locator("#tables td.silent").count() === 1,
          "the studies crossed with the questions: three cells filled, the fourth left empty");
    await page.locator("#tables select").selectOption({ label: "Why the scheme helped (accounts)" });
    await page.waitForTimeout(200);
    const a0 = await page.locator("#tables").innerText();
    // Mutation: list the account set's rows ungrouped -> four rows, none apart.
    check(await page.locator("#tables tbody tr").count() === 2 && /1 of the 2 rows tells the accounts apart\. 2 rows gather the findings of one case/.test(a0) &&
          /The west study[\s\S]*tells them apart/.test(a0) && /The east study[\s\S]*bears on both alike/.test(a0),
          "the account set's findings are grouped by study: the west, one for and one against, tells the accounts apart", a0.slice(0, 600));
    // Clicking a study lights its findings. Mutation: light the group's first row only -> one.
    await page.locator('#tables tr[data-tables-row="g1"] th').click({ position: { x: 10, y: 8 } });
    await page.waitForTimeout(300);
    check(JSON.stringify(await lit()) === JSON.stringify(["West attention made no difference", "West practice counted"]), "clicking a study lights every finding of it", JSON.stringify(await lit()));
    await page.locator("#tables [data-tables-close]").click();
    // THE DERIVED SETS BESIDE THE DECLARED ONE (James's ruling, 20 Oct 2026). The weigh panel offers a
    // rival outside the declared accounts, even one no reason bears on; Study offers only those with reasons.
    await box("The east scores were a fluke").click({ button: "right" });
    check(await page.locator('#ctx [data-weigh-menu="weigh"]').count() === 1, "a rival outside the declared accounts is still offered to weigh");
    await page.keyboard.press("Escape");
    await page.locator('#map [data-act="study"]').click();
    await page.waitForTimeout(250);
    await page.locator('#studybody button[data-study="accounts"]').click();
    await page.waitForTimeout(250);
    const st = await page.locator("#studybody").innerText();
    // Mutation: drop the rows filter from studyAccountSets -> three sets, the fluke among them.
    check(/sets 2 of its claims against rival accounts/.test(st) && /‹More practice helped›/.test(st) && /‹The reports disagree›/.test(st) && !/Reading improved in the east/.test(st),
          "Study offers the declared set and the derived one with reasons, and not a pair no reason bears on", st.slice(0, 400));
    await page.locator('#studybody button[data-study="end"]').first().click();
    await page.waitForTimeout(250);

    // THE BAR: WAYS TO QUESTION FIRST, DISPLAY GATHERED (the Purpose episode, ruled 20 Oct 2026).
    const order = await page.evaluate(() => [...document.querySelectorAll(
      '#map .alm-bar [data-act="study"], #map .alm-bar [data-act="weigh"], #map .alm-bar [data-role="depth"], ' +
      '#map .alm-bar [data-act="display"], #map .alm-bar [data-role="claims"]')]
      .map(e => e.dataset.act || e.dataset.role));
    // Mutation: put the claims group back ahead of the Display button -> the order breaks.
    check(order.join(" ") === "study weigh depth display claims",
          "the bar runs: Study and Weigh, then how much, then Display holding the display switches", order.join(" "));
    const pop = page.locator("#map .alm-bar .alm-dpop");
    // Mutation: draw the menu open -> visible at load.
    check(await pop.isHidden(), "Display opens closed: the display switches are one press away");
    await page.locator('#map [data-act="display"]').click();
    await page.waitForTimeout(150);
    check(await pop.isVisible() && await page.locator('#map .alm-bar [data-act="spine"][data-on="1"]').isVisible(),
          "pressing Display shows its switches");
    await page.locator('#map .alm-bar [data-act="text"][data-full="1"]').click();
    await page.waitForTimeout(250);
    // Mutation: close the menu on any click inside the bar -> a second choice needs a second press.
    check(await pop.isVisible(), "a choice inside Display leaves it open for the next");
    await page.locator('#map .alm-bar [data-act="text"][data-full="0"]').click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    check(await pop.isHidden(), "Esc closes it");
    const weighBtn = page.locator('#map [data-act="weigh"]');
    // Mutation: leave weighSync's `hidden` unset -> the button never shows.
    check(await weighBtn.isVisible(), "Weigh is offered on a map with accounts to weigh");
    await weighBtn.click();
    await page.waitForTimeout(300);
    const weighText = await page.locator("#weigh").innerText().catch(() => "");
    check(await page.locator("#weigh").isVisible() && !/gives no reason/.test(weighText) &&
          await weighBtn.evaluate(b => b.classList.contains("on")),
          "Weigh opens the panel on a set a reason bears on, and is lit", weighText.slice(0, 200));
    await weighBtn.click();
    await page.waitForTimeout(200);
    check(await page.locator("#weigh").isHidden() && !(await weighBtn.evaluate(b => b.classList.contains("on"))),
          "pressed again, it closes the panel");

    // ON BATES, THE FIRST SET IS ONE NO REASON BEARS ON, so opening set 0 opened on "the map gives no
    // reason" -- found on screen, 20 Oct 2026. Mutation: open set 0 in weighToggle -> this fails
    // (the fixture above cannot tell, its first set having reasons).
    const batesDir = path.join(REPO, "samples", "Bates et al 2012 - The Price is Wrong");
    const batesMap = fs.readdirSync(batesDir).find(f => f.endsWith(".argdown"));
    const batesOut = path.join(tmp, "bates.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), path.join(batesDir, batesMap), "-o", batesOut], { stdio: "pipe" });
    await open(batesOut);
    await weighBtn.click();
    await page.waitForTimeout(400);
    const batesWeigh = await page.locator("#weigh").innerText().catch(() => "");
    check(/Weigh the accounts/.test(batesWeigh) && !/gives no reason/.test(batesWeigh),
          "on Bates too, Weigh opens on a set a reason bears on, past the first set, which has none",
          batesWeigh.slice(0, 200));

    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
console.log("all table checks passed");
