/* The reconstructor's appraisal in Reasons and Exposition: off until asked for, never the text's.
 *
 *   node app/test_appraisal_layer.mjs
 *
 * Phase D of the mechanism view (ruled 26 Sep 2026). Claims tagged #appraisal are the
 * reconstructor's own reading of the text against the world. The Mechanism arrangement already
 * hid them until asked; this holds the argument map to the same promise, and the page to ONE switch
 * across all three arrangements:
 *
 *   - an appraisal claim is never a contention, so it is never crowned, and spine and depth are
 *     measured towards the author's theses alone;
 *   - it is off by default: not drawn, not a hashtag chip, not in the margins;
 *   - switched on, it is drawn hatched under a standing banner, and a switch made in one
 *     arrangement holds in the others;
 *   - the fold-state identifier carries it, and only when it is on.
 *
 * The browser half drives a built viewer with real clicks and is skipped, not failed, where
 * Chromium is not installed. Each browser check was mutation-tested when written.
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
const LM = require(path.join(HERE, "src", "argdown-live-map.js"));
const FIXTURE = path.join(REPO, "ipsissima-mcp", "tests", "mechanism");
const CHAIN = path.join(FIXTURE, "chain.argdown");

let fails = 0, checks = 0;
function check(ok, what, detail) {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok || detail == null ? "" : `\n          ${detail}`));
  if (!ok) fails++;
}

/* ------------------------------------------------------------------ the pure half */
console.log("the argument map's own measures");
const G = toGraph(argdown.run({ input: fs.readFileSync(CHAIN, "utf8"), ...RUN }));
const byLabel = l => G.nodes.find(n => n.label === l);
const ix = LM.index(G);
// "Risk scores make themselves true" is supported by another appraisal claim and supports nothing
// itself: without the rule it is a root, and a root is a contention.
check(!ix.isContention(byLabel("Risk scores make themselves true").id),
      "an appraisal claim that supports nothing is not a contention");
check(ix.isContention(byLabel("Recommend").id), "the author's recommendation is");

const visible = st => new Set(LM.filterGraph(G, st).nodes.map(n => n.id));
const apprIds = G.nodes.filter(n => (n.tags || []).includes("appraisal")).map(n => n.id);
check(apprIds.length === 4, "the fixture draws four appraisal claims", apprIds.length);
check(apprIds.every(id => !visible({}).has(id)), "by default none of them is drawn");
check(apprIds.every(id => visible({ appraisal: true }).has(id)), "switched on, all of them are");
check(apprIds.every(id => visible({ appraisal: true, facets: new Set(["reported"]) }).has(id)),
      "and a hashtag filter does not hide them: they answer to their own switch");

const enc = LM.encodeFoldState(G, { appraisal: true });
check(/appraisal=1/.test(enc), "the fold-state identifier records the switch when it is on");
check(!/appraisal/.test(LM.encodeFoldState(G, {})), "and says nothing of it when it is off");
check(LM.decodeFoldState(G, enc).appraisal === true, "and reads it back");

/* ------------------------------------------------------------------ the page */
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); }
catch (e) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("\nFAIL — Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("\nSKIPPED the browser half — Playwright's Chromium is not installed here.");
}
if (chromium) {
  console.log("\nthe page, driven with real clicks");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-layer-"));
  // A note on an appraisal claim, so the margins have something they must not show.
  fs.cpSync(FIXTURE, tmp, { recursive: true });
  const file = path.join(tmp, "chain.argdown");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(
    'warrant: "closes the loop the brief leaves open",',
    'warrant: "closes the loop the brief leaves open", note: "APPRAISAL-NOTE: the brief never says this.",'));
  const out = path.join(tmp, "view.html");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), file, "--source-root", tmp, "-o", out], { stdio: "pipe" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("file://" + out);
    await page.waitForTimeout(800);
    // Open everything, so that a hidden appraisal claim is hidden by the switch and not by a fold.
    const openAll = async () => {
      await page.evaluate(() => { /** @type {any} */ const L = window; });
      const btn = page.locator('.alm-bar [data-act="sections"][data-open="1"]');
      if (await btn.count() && await btn.first().isVisible()) await btn.first().click();
    };
    await openAll();
    const drawn = () => page.locator("#map .alm-n.alm-appraisal").count();
    const aBtn = page.locator('#map .alm-bar [data-act="appraisal"]');

    // Mutation: default `appraisal` true in createLiveMap's options -> fails.
    check(await drawn() === 0, "Reasons opens with no appraisal claim drawn");
    // Mutation: drop the isAppraisal filter from facetValues -> an `appraisal` chip returns.
    check(await page.locator('#map .alm-bar [data-facet="appraisal"]').count() === 0,
          "and no `appraisal` hashtag chip");
    check(/not in the text · 4 hidden/.test(await aBtn.innerText()), "its own switch says how many are hidden",
          await aBtn.innerText().catch(() => ""));
    check(await page.locator("#map .alm-appr-banner").isHidden(), "no banner while it is off");

    // The only note in this map is an appraisal claim's, so while it is off there is nothing in
    // the margins and the Notes button is not offered at all. Mutation: drop the APPRAISAL_ON guard
    // in `marginalia` -> the button is offered.
    const notesBtn = page.locator('#panes [data-p="notes"]');
    check(await notesBtn.isHidden(), "the margins hold nothing of it: Notes is not even offered");

    await aBtn.click();
    await page.waitForTimeout(500);
    check(await drawn() > 0, "switched on, appraisal claims are drawn");
    check(await page.locator("#map .alm-appr-banner").isVisible(), "under a standing banner");
    // Mutation: drop the button re-offer in setAppraisalOn -> Notes stays hidden.
    check(await notesBtn.isVisible(), "and Notes is offered, now that the margins hold its note");
    await notesBtn.click();
    await page.waitForTimeout(300);
    check(/APPRAISAL-NOTE/.test(await page.locator("body").innerText()), "which the margins list");
    // AND THE BANNER SAYS WHERE IT IS EXPLAINED (clarity plan 5.2). Mutation: build the banner
    // without its link (or without `helpLinks` from the page) -> no way from it to the answer.
    const topic = () => page.evaluate(() => {
      const pg = document.querySelector("#help .helppage.show");
      return document.getElementById("help").classList.contains("show") && pg ? pg.dataset.title : null;
    });
    await page.locator("#map .alm-appr-banner .alm-helplink").click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    check(await topic() === "The reconstructor's appraisal",
          "the banner's link opens the page that explains the appraisal", String(await topic()));
    await page.keyboard.press("Escape");

    // ONE SWITCH, THREE ARRANGEMENTS. Mutation: drop `appraisal: APPRAISAL_ON` from the create
    // options in mechEnsure -> Mechanism opens with it off.
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(300);
    check(await page.locator(".amech-banner").isVisible(), "Mechanism opens with the appraisal still on");
    await page.locator(".amech-banner .amech-helplink").click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    check(await topic() === "The reconstructor's appraisal", "and Mechanism's banner links there too",
          String(await topic()));
    await page.keyboard.press("Escape");
    await page.locator(".amech-tog.appr").click();
    await page.waitForTimeout(200);
    await page.locator('#view [data-v="reasons"]').click();
    await page.waitForTimeout(500);
    // Mutation: drop `appraisal: APPRAISAL_ON` from setArrangement's setState -> still drawn.
    check(await drawn() === 0, "switched off in Mechanism, it is off back in Reasons");
    check(!/APPRAISAL-NOTE/.test(await page.locator("body").innerText()) && await notesBtn.isHidden(),
          "and gone from the margins again, the Notes pane with it");
    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(fails ? `\n${fails} of ${checks} checks failed` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
