/* Designed against the misreading: the page keeps the promises F8 makes of it.
 *
 *   node app/test_clarity.mjs
 *
 * F8 (docs/values/INVENTORY.md, admitted 27 Sep 2026): understandable to a reader motivated to
 * work it out is the first waypoint, not the finish -- the finished interface anticipates the
 * obvious ways of misreading it and designs them out. The clarity audit of the same day
 * (Clarity audit/, in the author's private folder) found each fault below on screen; every check
 * here drives the built page with Playwright's real input and holds the fix.
 *
 * Each browser check was mutation-tested when written: the note beside it names the mutation
 * that makes it fail. Skipped, not failed, where Chromium is not installed, as the other
 * browser suites are.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const BUILDER = path.join(HERE, "build_argdown_viewer.mjs");
const TEMPLATE = fs.readFileSync(path.join(HERE, "argdown-viewer.template.html"), "utf8");
const LIB_RS = fs.readFileSync(path.join(HERE, "desktop", "src-tauri", "src", "lib.rs"), "utf8");

let fails = 0, checks = 0;
function check(ok, what, detail) {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok || detail == null ? "" : `\n          ${detail}`));
  if (!ok) fails++;
}

/* ------------------------------------------------------------ what the files say */
console.log("the menus reach every arrangement");
// Mutation: drop the View ▸ Mechanism item from lib.rs -> fails.
check(/item\("view-mechanism", "Mechanism", Some\("CmdOrCtrl\+3"\)\)/.test(LIB_RS),
      "View ▸ Mechanism exists, on Cmd-3");
// Mutation: drop the page's handler -> the menu item rings a doorbell nobody answers.
check(/"view-mechanism":\s*function/.test(TEMPLATE), "and the page answers it");

console.log("\none meaning to a mark (F5, and F8(a) beyond the map)");
const LM_SRC = fs.readFileSync(path.join(HERE, "src", "argdown-live-map.js"), "utf8");
{
  // THE DASH ON A CLAIM'S BORDER, by the class that sets it. One pattern, one meaning.
  const dashes = {};
  for (const m of LM_SRC.matchAll(/\.alm-n\.([\w-]+) \.alm-box\{[^}]*stroke-dasharray:([\d. ]+)[;}]/g))
    (dashes[m[2].trim()] = dashes[m[2].trim()] || []).push(m[1]);
  // KNOWN, AND OWED: the audit's finding that `4 3` means compression, a folded section, a
  // survey claim and the appraisal. Ruled D7 (27 Sep 2026); plan item 3.3 gives each its own
  // mark and empties this list. The second check below fails the day it is fixed and the list
  // is not, so the debt cannot outlive itself.
  // Emptied the same day: D7 gave the folded section a pile, the appraisal a hatch, and took
  // the #survey and #opponent restylings away. A future debt goes here, dated, with its ruling.
  const KNOWN = {};
  const shared = Object.entries(dashes).filter(([d, cls]) => cls.length > 1 &&
    JSON.stringify([...cls].sort()) !== JSON.stringify([...(KNOWN[d] || [])].sort()));
  check(Object.keys(dashes).length >= 4, "the claim-border dashes were read", JSON.stringify(dashes));
  // Mutation: give #survey the paraphrase's `6 2` -> two meanings on one pattern, not in KNOWN.
  check(shared.length === 0, "no dash pattern on a claim's border means two things (beyond the known debt)",
        JSON.stringify(shared));
  check(Object.entries(KNOWN).every(([d, cls]) => JSON.stringify([...(dashes[d] || [])].sort()) ===
                                                  JSON.stringify([...cls].sort())),
        "the known debt is still exactly as recorded (fix it, and empty the list)", JSON.stringify(dashes));
  // THE BORDER'S WEIGHT, set by fidelity and nothing else: the base rule and the `alm-f-` rules.
  const weights = [...LM_SRC.matchAll(/([^{}\n]*\.alm-box)\{[^}]*stroke-width:/g)].map(m => m[1].trim())
    .filter(sel => !/^\.alm-n \.alm-box$/.test(sel) && !/\.alm-f-[\w-]+ \.alm-box$/.test(sel));
  // Mutation: restore `.alm-n:hover .alm-box{stroke-width:2.5}`, or the folded state's
  // `.alm-n.is-collapsed .alm-box{stroke-width:2}` -> named here. (A rendered check on a folded
  // quotation was tried and found vacuous: no sample shows one at the state it reached.)
  check(weights.length === 0, "only fidelity sets a claim border's weight", weights.join(" | "));
}
{
  // THE HEADER'S ICONS: two buttons drawn alike read as one thing when the labels go.
  const header = TEMPLATE.slice(TEMPLATE.indexOf("<header>"), TEMPLATE.indexOf("</header>"));
  const icons = {};
  for (const m of header.matchAll(/<button[^>]*?(?:id="([\w-]+)"|data-[vp]="([\w-]+)")[^>]*>\s*<svg[^>]*>([\s\S]*?)<\/svg>/g))
    (icons[m[3].replace(/\s+/g, "")] = icons[m[3].replace(/\s+/g, "")] || []).push(m[1] || m[2]);
  const twins = Object.values(icons).filter(v => v.length > 1).map(v => v.sort().join("="));
  // Emptied the same day (plan item 3.4): Reasons had drawn Map's tree, and Exposition
  // Manuscript's lined page. A future debt goes here, dated, with its ruling.
  const KNOWN_TWINS = [];
  check(Object.keys(icons).length >= 10, "the header's icons were read", String(Object.keys(icons).length));
  check(twins.filter(t => !KNOWN_TWINS.includes(t)).length === 0,
        "no two header buttons share a drawing (beyond the known debt)", twins.join(", "));
  check(KNOWN_TWINS.every(t => twins.includes(t)), "the known debt is still exactly as recorded", twins.join(", "));
}

/* ------------------------------------------------------------ the page, under real input */
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); }
catch (e) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("\nFAIL — Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("\nSKIPPED the browser half — Playwright's Chromium is not installed here.");
  chromium = null;
}

/** WCAG contrast of two computed colours, alpha ignored (these are opaque by construction). */
function contrast(a, b) {
  const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = c => {
    const v = rgb(c).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

if (chromium) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clarity-"));
  const build = (out, args) => { execFileSync("node", [BUILDER, ...args, "-o", out], { stdio: "pipe" }); return out; };
  const sample = (dir, file) => path.join(REPO, "samples", dir, file);
  const MILLER = "Miller 2019 - Prorogation of Parliament", BATES = "Bates et al 2012 - The Price is Wrong";
  const miller = build(path.join(tmp, "miller.html"),
    [sample(MILLER, "miller-2019-uksc-41.argdown"), "--source-root", path.join(REPO, "samples", MILLER)]);
  const bates = build(path.join(tmp, "bates.html"),
    [sample(BATES, "bates-2012-price-is-wrong.argdown"), "--source-root", path.join(REPO, "samples", BATES)]);
  const editor = build(path.join(tmp, "editor.html"), ["--standalone", "--editor"]);
  const reader = build(path.join(tmp, "reader.html"), ["--standalone"]);
  const millerTour = build(path.join(tmp, "miller-tour.html"),
    [sample(MILLER, "miller-2019-uksc-41.argdown"), "--source-root", path.join(REPO, "samples", MILLER),
     "--walkthrough"]);

  const browser = await chromium.launch();
  /** A returning reader: the tour and the key have been seen, so neither covers what is tested. */
  const open = async (file, opts = {}) => {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 },
                                           colorScheme: opts.scheme || "light",
                                           isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
    await ctx.addInitScript(([keyNew, tour]) => {
      try { if (!tour) localStorage.setItem("ipsissima.walkthrough.v1", "seen");
            if (!keyNew) localStorage.setItem("ipsissima.key.v1", "seen"); } catch (e) { void e; }
    }, [!!opts.keyNew, !!opts.tour]);
    const page = await ctx.newPage();
    page.on("dialog", d => d.accept());
    await page.goto("file://" + file);
    await page.waitForTimeout(900);
    return page;
  };
  const drop = (page, name, text) => page.evaluate(({ t, n }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([t], n));
    document.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { t: text, n: name });
  /** The map's main claims, found the way the map finds them, from the file itself. */
  const LM = createRequire(import.meta.url)("./src/argdown-live-map.js");
  const mainsOf = file => {
    const g = toGraph(argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN }));
    const ix = LM.index(g);
    return g.nodes.filter(n => ix.isContention(n.id)).map(n => n.id);
  };
  /** What the opening screen shows: each main claim's box, whether it is on the map and clear
   *  of the key card, the zoom, and the rung the ladder reads. */
  const opening = (page, ids) => page.evaluate(ids => {
    const m = document.getElementById("map").getBoundingClientRect();
    const k = document.getElementById("keycard");
    const kr = k.hidden || !k.offsetParent ? null : k.getBoundingClientRect();
    const vp = [...document.querySelectorAll("#map *")].find(e => /scale\(/.test(e.style.transform || ""));
    const zoom = vp ? +vp.style.transform.replace(/.*scale\(([^)]*)\).*/, "$1") : 0;
    const boxes = ids.map(id => {
      const e = document.querySelector(`#map .alm-n[data-id="${CSS.escape(id)}"]`);
      if (!e) return { id, drawn: false };
      const r = e.getBoundingClientRect();
      const inMap = r.left >= m.left - 1 && r.right <= m.right + 1 && r.top >= m.top - 1 && r.bottom <= m.bottom + 1;
      const underKey = !!kr && r.right > kr.left && r.left < kr.right && r.bottom > kr.top && r.top < kr.bottom;
      return { id, drawn: true, inMap, underKey };
    });
    const claimsUnderKey = !kr ? 0 : [...document.querySelectorAll("#map .alm-n, #map .alm-g")].filter(e => {
      const r = e.getBoundingClientRect();
      return r.right > kr.left && r.left < kr.right && r.bottom > kr.top && r.top < kr.bottom;
    }).length;
    return { zoom, boxes, claimsUnderKey, key: !!kr,
             rung: (document.querySelector("#map .alm-rung") || {}).textContent };
  }, ids);
  const layoutItem = async (page, hint) => {
    await page.click("#laybtn");
    await page.waitForTimeout(200);
    await page.locator("#ctx button").filter({ hasText: hint }).first().click();
    await page.waitForTimeout(700);
  };

  try {
    console.log("\nwhat belongs to the window shows whichever panes are open");
    {
      const page = await open(miller);
      await layoutItem(page, "no map");
      check(await page.locator("#map").isHidden(), "Layout ▸ Check puts the map away");
      await page.click("#helpbtn");
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const h = document.getElementById("help").getBoundingClientRect();
        const top = document.elementFromPoint(h.left + h.width / 2, h.top + 80);
        return { w: h.width, h: h.height, onTop: !!(top && top.closest("#help")) };
      });
      // Mutation: move #help back inside #stage -> the panel measures 0×0 with the map away.
      check(r.w > 200 && r.h > 200 && r.onTop, "How to use opens, and is on top, with the map away",
            JSON.stringify(r));
      const z = await page.evaluate(() => {
        const zi = id => +getComputedStyle(document.getElementById(id)).zIndex || 0;
        return { err: zi("err"), dialogs: Math.max(zi("cdlg"), zi("about"), zi("pastedoor"), zi("expl"), zi("upd")),
                 inStage: document.getElementById("stage").contains(document.getElementById("err")) };
      });
      // Mutation: put #err back at z-index 9 -> an error raised in the comment dialog is under it.
      check(z.err > z.dialogs && !z.inStage, "a message sits above every dialog, outside the map's column",
            JSON.stringify(z));
      await page.context().close();
    }

    console.log("\nthe title bar names the map, and the map's declarations sit with its abstract");
    {
      const page = await open(bates);
      const t = await page.evaluate(() => ({ text: document.getElementById("fname").textContent,
                                              hover: document.getElementById("fname").title }));
      // Mutation: write NAME into the header again -> the file name shows, not the title.
      check(/The Price is Wrong/.test(t.text) && !/\.argdown$/.test(t.text) && /\.argdown/.test(t.hover),
            "the header shows the map's title, and the file's name on hover", JSON.stringify(t));
      const where = await page.evaluate(() => ({
        inHeader: !!document.querySelector("body > header #mapprov"),
        inStrip: !!document.querySelector("#orient #mapprov"),
        shown: !document.getElementById("mapprov").hidden }));
      // Mutation: put the chips back in the header markup -> fails.
      check(where.inStrip && !where.inHeader && where.shown,
            "'machine-written map' is in the orientation strip, not the title bar", JSON.stringify(where));
      await page.click("#mapprov");
      await page.waitForTimeout(400);
      const topic = await page.evaluate(() => {
        const pg = document.querySelector("#help .helppage.show");
        return { open: document.getElementById("help").classList.contains("show"),
                 title: pg && pg.dataset.title };
      });
      // Mutation: drop the chip's onclick -> no topic opens.
      check(topic.open && topic.title === "What a map says about itself", "and a click on it opens the topic that explains it",
            JSON.stringify(topic));
      await page.context().close();
    }

    console.log("\nthe bar keeps its words as long as it can, and How to use always");
    for (const [w, h, mobile, want] of [[1280, 800, false, "labels"], [390, 844, true, "reachable"]]) {
      const page = await open(bates, { viewport: { width: w, height: h }, mobile });
      const r = await page.evaluate(() => {
        const vw = window.innerWidth, out = [];
        document.querySelectorAll("body > header button").forEach(b => {
          if (b.hidden || getComputedStyle(b).display === "none" || !b.offsetParent) return;
          const sp = b.querySelector("span"), rc = b.getBoundingClientRect();
          out.push({ id: b.id || b.dataset.v || b.dataset.p, off: rc.right > vw + 1,
                     label: !!sp && getComputedStyle(sp).display !== "none" });
        });
        return out;
      });
      if (want === "labels") {
        const views = r.filter(b => ["reasons", "textbtn", "mechbtn", "map", "argdown", "notes", "text"].includes(b.id));
        // Mutation: make fitHeader add every stage at once -> all labels go at 1280.
        check(views.length >= 7 && views.every(b => b.label),
              `at ${w}px the arrangement and pane buttons keep their words (Bates, three arrangements)`,
              JSON.stringify(r));
      } else {
        // Mutation: drop the `crowded` stage and restore the chips to the header -> How to use
        // and the right-hand buttons run off the screen.
        check(r.some(b => b.id === "helpbtn") && r.every(b => !b.off),
              `at ${w}px every control on the bar is on the screen, How to use included`, JSON.stringify(r));
      }
      await page.context().close();
    }

    console.log("\nevery control says what it does, briefly, and says more than its label");
    {
      // THE WALKTHROUGH'S PROMISE, KEPT: "every control on screen says what it does if you rest
      // on it". The audit counted about seventy controls with no tooltip, ten a paragraph long.
      // Held here on every surface a reader meets on a rich map -- the title bar, the strip, the
      // map's bar in all three arrangements, the panes' headers -- and the opening panel.
      const audit = page => page.evaluate(() => {
        const out = [];
        const vis = e => e.offsetParent !== null && getComputedStyle(e).visibility !== "hidden";
        document.querySelectorAll(["body > header button", "#orient button", "#map .alm-bar button",
          "#map .alm-bar input", "#side header button", "#side header select", "#mech button",
          "#mech select", "#mech input", "#drop button"].join(",")).forEach(e => {
          if (!vis(e)) return;
          const label = (e.innerText || "").trim().replace(/\s+/g, " ");
          const own = e.getAttribute("title") || e.getAttribute("aria-label") || "";
          const tip = (own || (e.closest("label") && e.closest("label").getAttribute("title")) || "").trim();
          const words = tip ? tip.split(/\s+/).length : 0;
          const bad = !tip ? "no tooltip" : words > 30 ? words + " words"
                    : label && tip.toLowerCase() === label.toLowerCase() ? "repeats its label" : "";
          out.push(bad ? `${e.id || e.dataset.act || e.dataset.p || e.dataset.v || e.dataset.facet || e.tagName} (${label.slice(0, 20)}): ${bad}` : "");
        });
        return out;
      });
      const page = await open(bates);
      const found = [];
      found.push(...await audit(page));
      await page.click('#panes [data-p="text"]');
      await page.click("#textbtn");
      await page.waitForTimeout(900);
      found.push(...await audit(page));
      await page.click("#mechbtn");
      await page.waitForTimeout(900);
      found.push(...await audit(page));
      await page.context().close();
      const cold = await open(editor);
      found.push(...await audit(cold));
      await cold.context().close();
      const faults = found.filter(Boolean);
      check(found.length >= 60, "the audit saw the controls (a check that sees nothing passes everything)",
            String(found.length));
      // Mutation: drop the title from the SECTIONS buttons, or restore the 58-word Contents
      // tooltip -> named here.
      check(faults.length === 0, "no control is silent, long-winded, or an echo of its label",
            [...new Set(faults)].join("\n          "));
    }

    console.log("\nstudy mode names what it points at, as drawn, and its button is a switch");
    {
      const page = await open(miller);
      const btn = page.locator('#map [data-act="study"]');
      await btn.click();
      await page.waitForTimeout(700);
      const s = await page.evaluate(() => {
        const el = document.querySelector("#map .alm-toggle.is-closed text");
        return { body: document.getElementById("studybody").innerText,
                 on: document.querySelector('#map [data-act="study"]').classList.contains("on") };
      });
      // Mutation: print el.dataset.id again -> "group:s1" appears.
      check(!/group:|lane:/.test(s.body), "the card never prints an internal id", s.body.slice(0, 120));
      // Mutation: restore "the ⊞ badge" -> fails.
      check(!/⊞/.test(s.body) && /press \+\d+ under it/.test(s.body),
            "it names the badge as the map draws it (+N), not the staircase glyph", s.body.slice(0, 200));
      // Mutation: drop syncStudyButton from startStudy and onMapState -> never lit.
      check(s.on, "the study button shows as on while studying");
      await btn.click();
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        card: document.getElementById("studycard").hidden,
        on: document.querySelector('#map [data-act="study"]').classList.contains("on") }));
      // Mutation: wire onStudy back to startStudy -> the second press does nothing.
      check(after.card && !after.on, "and pressing it again ends the mode", JSON.stringify(after));
      await page.context().close();
    }

    console.log("\nadvice fits the map it is given on");
    {
      const page = await open(editor);
      await drop(page, "debate.argdown", [
        "===", "title: Should cities ban cars?", "===", "",
        "[Ban]: City centres should ban private cars.",
        "    + [Air]: Cars are the main source of urban air pollution.",
        "    - [Trade]: Shops depend on customers who drive.", ""].join("\n"));
      await page.waitForSelector("#map .alm-n", { timeout: 20000 });
      await page.waitForTimeout(1200);
      const box = await page.locator("#map .alm-n").first().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
      await page.waitForTimeout(300);
      const menu = await page.evaluate(() => document.getElementById("ctx").innerText);
      // Mutation: restore the old `.why` line -> "Drop the folder" on a map that reads no text.
      check(/reads no text/.test(menu) && !/folder/i.test(menu),
            "on a map that reads no text, the menu says so and sends nobody for a folder", menu);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      // A CLAIM MARKED CURRENT KEEPS ITS FIDELITY'S WEIGHT: these claims record no fidelity, so
      // their border is the plain 1.5. Mutation: restore `stroke-width:2.4` on .is-lit -> a lit
      // plain claim draws with (nearly) a quotation's weight.
      const plain = page.locator("#map .alm-n").nth(1);
      const pb = await plain.boundingBox();
      await page.mouse.click(pb.x + pb.width / 2, pb.y + 12);
      await page.waitForTimeout(300);
      const lit = await plain.evaluate(n => ({ lit: n.classList.contains("is-lit"),
                                                w: getComputedStyle(n.querySelector(".alm-box")).strokeWidth }));
      check(lit.lit && lit.w === "1.5px", "a claim marked current keeps its own border weight", JSON.stringify(lit));
      await page.context().close();
    }

    console.log("\nthe opening panel offers only doors this build has, with nothing between them");
    for (const [file, name, starts] of [[reader, "the Reader", false], [editor, "Ipsissima", true]]) {
      const page = await open(file);
      const r = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("#drop p.doors")];
        return {
          stray: rows.some(p => [...p.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())),
          start: rows[1] ? getComputedStyle(rows[1]).display !== "none" : false,
          names: [...document.querySelectorAll("#drop p.doors button")].filter(b => !b.hidden).map(b => b.textContent)
        };
      });
      // Mutation: put the middle dots back between the doors -> the Reader shows stray dots.
      check(!r.stray, `${name}: no separators left standing between the doors`, JSON.stringify(r));
      check(r.start === starts, `${name}: the start row is ${starts ? "offered" : "absent"}`, JSON.stringify(r));
      if (starts)
        // The web panel says what the application's File menu says (F8(a)).
        check(["Open a file…", "Open a folder…", "New reconstruction", "New debate map", "New from text…"]
                .every(n => r.names.includes(n)), "and the doors carry the File menu's names", JSON.stringify(r.names));
      await page.context().close();
    }

    console.log("\nFit fits the arrangement on screen");
    {
      const page = await open(bates);
      await page.click("#mechbtn");
      await page.waitForTimeout(800);
      await page.click("#fitbtn");
      await page.waitForTimeout(300);
      // Mutation: wire #fitbtn back to LIVE.fit -> the chart is untouched.
      check(await page.locator('#mech [data-fit]').textContent() === "Actual size",
            "in Mechanism, the header's Fit fits the chart");
      await page.context().close();
    }

    console.log("\na large map opens on its argument, at a size that can be read (D11)");
    {
      // THE MEASURED FAULT: nine of the ten samples opened on section blocks alone, no claim on
      // the screen; and with the main claim's section opened, Bates fitted at the 0.5 floor.
      const page = await open(bates);
      const o = await opening(page, mainsOf(sample(BATES, "bates-2012-price-is-wrong.argdown")));
      // Mutation: fold every top section again (drop the contentionSections filter) -> no main
      // claim is drawn.
      check(o.boxes.length > 0 && o.boxes.every(b => b.drawn && b.inMap),
            "Bates opens with every main claim on the screen", JSON.stringify(o.boxes));
      // Mutation: drop `readableScale` from the opening mount -> the map fits at 0.5.
      check(o.zoom >= 0.65, "and at a zoom where a claim's words can be read", String(o.zoom));
      // THE SWITCH TELLS THE TRUTH ABOUT A MIXED MAP (D15). The map opened with its main claim's
      // section open and the rest folded: neither half of "sections" is true of it.
      const sw = await page.evaluate(() => ({
        folded: document.querySelector('#map [data-act="sections"][data-open="0"]').classList.contains("on"),
        open: document.querySelector('#map [data-act="sections"][data-open="1"]').classList.contains("on"),
        says: document.querySelector('#map [data-role="sections"] b').title }));
      // Mutation: light "Folded" whenever any section is folded -> it is lit over the open section.
      check(!sw.folded && !sw.open && /\d+ of \d+ sections folded/.test(sw.says),
            "the sections switch lights neither half over a map that is partly folded, and says how much",
            JSON.stringify(sw));
      await page.click('#map [data-act="sections"][data-open="0"]');
      await page.waitForTimeout(700);
      check(await page.locator('#map [data-act="sections"][data-open="0"]').evaluate(b => b.classList.contains("on")),
            "and lights Folded once every section is");
      await page.context().close();
    }
    {
      // A LINK TO A FOLDED CLAIM, on a map still as it opened (profile 1.17's questions panel,
      // and the Argdown pane's links, take the same road). The opening had come down a rung to be
      // readable; unfolding for the claim re-rendered, the framing chose that rung again, and the
      // claim went back under its fold -- nothing lit, and nothing moved.
      const src = fs.readFileSync(sample(BATES, "bates-2012-price-is-wrong.argdown"), "utf8")
        .replace(/^title: (.*)$/m, '$&\nquestions:\n    time: {text: "Does deliberation matter?"}')
        .replace(/(\[Stockpilers stop taking more bottles\]: [^\n]*\n    \{)/,
                 '$1question: {id: time, move: answers}, ')
        // and one the argument map does not draw (it only feeds the mechanism): named, not linked
        .replace(/(\[Deliberation may matter only under time pressure\]: [^\n]*\n    \{)/,
                 '$1question: {id: time, move: answers}, ');
      const qfile = path.join(tmp, "bates-questions.argdown");
      fs.writeFileSync(qfile, src);
      const sid = toGraph(argdown.run({ input: src, ...RUN })).nodes
        .find(n => n.label === "Stockpilers stop taking more bottles").id;
      const page = await open(build(path.join(tmp, "bates-q.html"),
                                    [qfile, "--source-root", path.join(REPO, "samples", BATES)]));
      const before = await page.evaluate(() =>
        document.querySelectorAll("#map .alm-n").length);
      await page.click("#qchip");
      await page.waitForTimeout(300);
      const link = page.locator("#absbody button", { hasText: "Stockpilers stop taking more bottles" });
      check(await link.count() === 1, "the questions pill lists the question and the claim that answers it");
      // Mutation: link every move -> a button that goes nowhere.
      check(await page.locator("#absbody button", { hasText: "Deliberation may matter" }).count() === 0 &&
            /Deliberation may matter only under time pressure\] \(not on the map\)/.test(
              await page.locator("#absbody").textContent()),
            "a claim the argument map does not draw is named, not linked");
      const wasDrawn = await page.evaluate(id => !!document.querySelector(
        `#map .alm-n[data-id="${CSS.escape(id)}"]`), sid);
      await link.click();
      await page.waitForTimeout(1500);
      const r = await page.evaluate(id => {
        const m = document.getElementById("map").getBoundingClientRect();
        const e = document.querySelector(`#map .alm-n[data-id="${CSS.escape(id)}"]`);
        if (!e) return { drawn: false };
        const b = e.getBoundingClientRect();
        const vp = [...document.querySelectorAll("#map *")].find(x => /scale\(/.test(x.style.transform || ""));
        return { drawn: true, panel: !document.getElementById("abspanel").hidden,
                 inMap: b.left >= m.left && b.right <= m.right && b.top >= m.top && b.bottom <= m.bottom,
                 zoom: vp ? +vp.style.transform.replace(/.*scale\(([^)]*)\).*/, "$1") : 0 };
      }, sid);
      check(!wasDrawn && before > 0, "the claim starts out folded away", String(wasDrawn));
      check(r.drawn && r.inMap && !r.panel,
            "following it from the questions panel unfolds it onto the screen and closes the panel",
            JSON.stringify(r));
      // Mutation: drop `userMoved = true` from reveal -> the unfolded map is refitted to the floor.
      check(r.zoom >= 0.65, "at a zoom its words can be read, not the whole map refitted", String(r.zoom));
      // Mutation: drop readerActed() from reveal -> opening a pane re-draws the map, the framing
      // takes the rung again, and the claim goes back under its fold.
      await page.click('#panes [data-p="text"]');
      await page.waitForTimeout(1200);
      check(await page.evaluate(id => !!document.querySelector(`#map .alm-n[data-id="${CSS.escape(id)}"]`), sid),
            "and it stays unfolded when a pane opens beside the map");
      await page.context().close();
    }
    {
      // A FIRST-TIME READER, on the page anyone can open: the key offers itself 700ms after the
      // map, over its right side. The map must be framed for it from the start, not re-laid
      // underneath when it arrives.
      const AKH = "Akhlaghi 2023 - Transformative experience and revelatory autonomy";
      const file = sample(AKH, "akhlaghi-revelatory-autonomy.argdown");
      const page = await open(reader, { keyNew: true });
      await drop(page, path.basename(file), fs.readFileSync(file, "utf8"));
      await page.waitForSelector("#map .alm-n", { timeout: 30000 });
      await page.waitForTimeout(300);
      const early = await opening(page, mainsOf(file));
      await page.waitForTimeout(1800);
      const late = await opening(page, mainsOf(file));
      check(late.key, "the key offered itself", JSON.stringify(late));
      // Mutation: drop the right inset from the framing -> sections sit under the key.
      check(late.claimsUnderKey === 0 && late.boxes.every(b => b.drawn && b.inMap && !b.underKey),
            "no claim or section is under the key card", JSON.stringify(late));
      // Mutation: never set KEY_COMING -> the map opens a rung higher and drops when the key comes.
      check(early.rung === late.rung && Math.abs(early.zoom - late.zoom) < 0.01,
            "and the map did not re-lay itself when the key arrived",
            `${early.rung} @${early.zoom} -> ${late.rung} @${late.zoom}`);
      await page.context().close();
    }

    console.log("\na mark for each thing, and each state shows itself (Phase 3 and 4)");
    {
      const page = await open(miller);
      // D7: A FOLDED SECTION IS A PILE. Its dashed border was the compression's and the survey's
      // and the appraisal's; now a second outline behind the box says "more in here".
      const pile = await page.evaluate(() => {
        const g = document.querySelector("#map .alm-n.alm-k-group");
        return g && { stack: !!g.querySelector(".alm-stack"),
                      dash: getComputedStyle(g.querySelector(".alm-box")).strokeDasharray };
      });
      // Mutation: stop drawing the .alm-stack rect -> a folded section is a lone box.
      check(!!pile && pile.stack && pile.dash === "none", "a folded section is drawn as a pile, with no dash",
            JSON.stringify(pile));
      // A SWITCH THAT HIDES CLAIMS SAYS HOW MANY (MESSAGES.md rule 12).
      await page.click("#map .alm-bar [data-untagged]");
      await page.waitForTimeout(800);
      const hid = await page.evaluate(() => { const e = document.querySelector("#map .alm-hid");
                                              return e && !e.hidden ? e.textContent : ""; });
      // Mutation: keep .alm-hid hidden -> the bar says nothing of what the switch took away.
      check(/^\d+ claims? hidden by switches$/.test(hid), "a switch that hides claims says how many", hid);
      // D5: "Read along" IS the following layout, so choosing it follows.
      await layoutItem(page, "Read along");
      // Mutation: drop `follow: true` from the Read along layout -> the switch stays off.
      check(await page.locator("#msfollow").getAttribute("aria-pressed") === "true",
            "Layout ▸ Read along turns the Manuscript's Follow on");
      await page.context().close();
    }
    {
      const page = await open(bates);
      await page.click("#mechbtn");
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const mech = document.getElementById("mech").getBoundingClientRect();
        const bar = document.querySelector("#mech .amech-bar"), r = bar && bar.getBoundingClientRect();
        return { bar: !!r, atFoot: !!r && r.top > mech.top + mech.height / 2,
                 legend: [...document.querySelectorAll("#mech h3")].some(h => h.textContent === "Legend"),
                 key: [...document.querySelectorAll("#mech h3")].some(h => h.textContent === "Key") };
      });
      // Mutation: put .amech-bar back above the chart -> fails. (D10: one place for an
      // arrangement's controls, the foot.)
      check(m.bar && m.atFoot, "Mechanism's controls sit in a bar at the foot, where the map's do", JSON.stringify(m));
      // Mutation: rename the heading back to Key -> two things called "the key".
      check(m.legend && !m.key, "and its panel's legend is called Legend", JSON.stringify(m));
      await page.click("#helpbtn");
      await page.waitForTimeout(300);
      await page.locator("#helptoc button", { hasText: /^The key$/ }).click();
      await page.waitForTimeout(200);
      await page.click("#keyfloat");
      await page.waitForTimeout(400);
      const k = await page.evaluate(() => ({ card: !document.getElementById("keycard").hidden,
                                              note: document.getElementById("err").textContent }));
      // Mutation: drop openKeyCard's Mechanism branch -> the argument map's key floats over
      // a chart whose lines mean other things.
      check(!k.card && /legend/i.test(k.note), "asking for the key in Mechanism points to its legend instead",
            JSON.stringify(k));
      await page.context().close();
    }
    {
      const page = await open(editor);
      await page.locator("#drop button", { hasText: "New from text…" }).first().click();
      await page.fill("#pastetext", "The first paragraph argues one thing because of another.\n\nThe second concludes.");
      await page.click("#pastebegin");
      await page.waitForTimeout(1400);
      const st = await page.evaluate(() => {
        const bar = document.querySelector("#map .alm-bar");
        return { guide: !document.getElementById("guidecard").hidden,
                 claims: document.querySelectorAll("#map .alm-n").length,
                 bar: bar ? getComputedStyle(bar).display : "absent" };
      });
      // Mutation: drop `#map.empty .alm-bar{display:none}` -> "everything 0" and "load-bearing
      // 0" over a map with nothing on it (the audit's guided step 1).
      check(st.guide && st.claims === 0 && st.bar === "none",
            "a guided start's empty map shows no controls for claims it does not have yet", JSON.stringify(st));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      // Mutation: drop the guide's rung from the Esc ladder -> Esc does nothing to it.
      check(await page.locator("#guidecard").isHidden(), "Esc ends the guide, as its × does");
      await page.context().close();
    }
    {
      const page = await open(editor);
      await page.click("#picknew");
      await page.waitForSelector(".cm-content", { timeout: 20000 });
      await page.waitForTimeout(600);
      const before = await page.locator("#dirtymark").isVisible();
      await page.click(".cm-content");
      await page.keyboard.press("End");
      await page.keyboard.type("\n[Another]: a claim");
      await page.waitForTimeout(1200);
      const after = await page.locator("#dirtymark").isVisible();
      // Mutation: never unhide #dirtymark -> an edited map looks exactly like a saved one.
      check(!before && after, "an unsaved edit shows beside the title, and a fresh skeleton does not",
            `before ${before}, after ${after}`);
      await page.context().close();
    }

    console.log("\nHow to use answers a question, from where the question arises (Phase 5)");
    const shownTopic = page => page.evaluate(() => {
      const pg = document.querySelector("#help .helppage.show");
      return document.getElementById("help").classList.contains("show") && pg ? pg.dataset.title : null;
    });
    {
      const page = await open(miller);
      await page.click("#helpbtn");
      await page.fill("#helpq", "dashed border");
      await page.waitForTimeout(150);
      const first = await page.locator("#helpresults button b").first().textContent();
      // Mutation: score the search words as body text, not with the title -> the page that
      // DRAWS its dashes, and never names them, drops down the list.
      check(first === "How close to the author's words?",
            "a search finds the page by the reader's word, even one the page never uses", first);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(250);
      const mark = await page.evaluate(() => (document.querySelector("#help mark.helphit") || {}).textContent);
      check(await shownTopic(page) === "How close to the author's words?" && !!mark,
            "and Enter opens it at the words it matched", `${await shownTopic(page)} / ${mark}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      await page.click("#helpbtn");
      await page.waitForTimeout(200);
      // Mutation: setHelp opens on the contents every time -> the reader starts over.
      check(await shownTopic(page) === "How close to the author's words?",
            "closed on a topic, How to use reopens on it");
      const m = await page.locator("#map").boundingBox();
      await page.mouse.click(m.x + 40, m.y + m.height - 140);
      await page.waitForTimeout(250);
      // Mutation: drop the #stage exemption -> a press on the map puts the panel away.
      check(await shownTopic(page) === "How close to the author's words?",
            "and stays open while the reader tries it on the map");
      await page.click("#helpback");
      await page.fill("#helpq", "zzqqxx");
      await page.waitForTimeout(150);
      check(await page.locator("#helpnone").isVisible(), "a search that finds nothing says so");
      await page.fill("#helpq", "");
      await page.keyboard.press("Escape");

      // DEEP LINKS: the questions asked by pointing.
      await page.click("#map .alm-n:not(.alm-k-group) .alm-box", { button: "right" });
      await page.locator("#ctx button", { hasText: "What does this mean?" }).click();
      await page.waitForTimeout(300);
      const rows = await page.evaluate(() => [document.querySelectorAll("#help .helppage.show .srow").length,
                                              document.querySelectorAll("#help .helppage.show .srow svg").length]);
      // Mutation: stop drawing the rows -> the page is words with nothing to point at.
      check(await shownTopic(page) === "What's on the screen?" && rows[0] >= 15 && rows[0] === rows[1],
            "right-click ▸ What does this mean? opens the page that draws every mark", JSON.stringify(rows));
      await page.keyboard.press("Escape");
      await page.click("#map .alm-n:not(.alm-k-group) .alm-box", { button: "right" });
      await page.locator("#ctx button", { hasText: "Show the key" }).click();
      await page.waitForTimeout(250);
      await page.locator("#keycard h4 button").first().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(250);
      // Mutation: the key's headings as plain text again -> "explained in full under How to use".
      check(await shownTopic(page) === "How close to the author's words?",
            "a heading on the key opens the page that explains it");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.locator("#map .alm-explode").first().click();
      await page.waitForSelector("#expl:not([hidden])", { timeout: 5000 });
      await page.locator("#explfoot .helplink").click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(250);
      // Mutation: drop the footer's link -> the staircase has no way to its explanation.
      check(await shownTopic(page) === "Following a long argument",
            "the staircase's footer opens the page on reading it");
      await page.context().close();
    }
    {
      // A MESSAGE SAYS WHERE THE LONGER ANSWER IS: a lone file, asked for its passage.
      const page = await open(reader);
      const f = sample(MILLER, "miller-2019-uksc-41.argdown");
      await drop(page, path.basename(f), fs.readFileSync(f, "utf8"));
      await page.waitForSelector("#map .alm-n", { timeout: 30000 });
      await page.waitForTimeout(600);
      await page.locator("#map .alm-n:not(.alm-k-group) .alm-box").first().dblclick();
      await page.waitForTimeout(300);
      const link = page.locator("#err .helplink");
      const has = await link.count();
      if (has) { await link.click(); await page.waitForTimeout(250); }
      // Mutation: drop the help option from the passage message -> no link.
      check(has === 1 && await shownTopic(page) === "Opening a map, and where its text is found",
            "a message about a missing text links to the page on where text is found",
            `${has} link(s), then ${await shownTopic(page)}`);
      // ONE HELP, TWO BUILDS: the Reader is not told how to do what it cannot.
      const titles = await page.evaluate(() => [...document.querySelectorAll("#helptoc button[data-page]")].map(b => b.textContent));
      const writing = await page.evaluate(() => {
        const pg = [...document.querySelectorAll("#help .helppage")].find(p => p.dataset.title === "Comments and notes");
        return pg ? /Writing a comment/.test(pg.textContent) : null;
      });
      // Mutation: keep every page in every build -> Saving and undoing appears in the Reader.
      check(!titles.includes("Saving and undoing") && !titles.includes("Quoting and paraphrasing from the text") &&
            titles.includes("Comments and notes") && writing === false,
            "the Reader's help leaves out editing, a topic or a passage at a time", JSON.stringify({ n: titles.length, writing }));
      await page.context().close();
    }
    {
      const page = await open(editor);
      const titles = await page.evaluate(() => [...document.querySelectorAll("#helptoc button[data-page]")].map(b => b.textContent));
      check(titles.includes("Saving and undoing") && titles.includes("Quoting and paraphrasing from the text"),
            "and the editor's keeps it", String(titles.length));
      await page.context().close();
    }
    {
      // D12: THE SITE'S SAMPLES OFFER THE TOUR; a map built to be sent stays quiet.
      const tourOn = async file => {
        const page = await open(file, { tour: true });
        await page.waitForTimeout(1200);
        const on = await page.locator("#walk").isVisible();
        await page.context().close();
        return on;
      };
      // Mutation: ignore __IPS_WALKTHROUGH__ in the gate -> the sample builds stay silent.
      check(await tourOn(millerTour), "a sample built with --walkthrough offers the walkthrough");
      // Mutation: drop the payload gate -> every map sent to someone starts touring.
      check(!(await tourOn(miller)), "a map built without it does not");
    }

    console.log("\nthe border's weight is fidelity's, and nothing else writes it");
    {
      const page = await open(miller);
      await page.click('#map [data-act="sections"][data-open="1"]');
      await page.waitForTimeout(900);
      // A PARAPHRASE, whose weight is the plain 1.5: a hover that wrote the quotation's 2.5 onto
      // every box -- the fault as found -- shows here and would not on a quotation.
      const q = page.locator("#map .alm-n.alm-f-paraphrase").first();
      const width = () => q.evaluate(n => getComputedStyle(n.querySelector(".alm-box")).strokeWidth);
      const before = await width();
      const qb = await q.boundingBox();
      await page.mouse.move(qb.x + qb.width / 2, qb.y + 10);
      await page.waitForTimeout(250);
      const hovered = await width();
      // Mutation: restore `.alm-n:hover .alm-box{stroke-width:2.5}` -> the paraphrase thickens.
      check(before === "1.5px" && hovered === before, "a paraphrase keeps its weight under the pointer",
            `${before} -> ${hovered}`);
      await page.context().close();
    }

    console.log("\nthe dark theme is legible");
    {
      const page = await open(miller, { scheme: "dark" });
      const c = await page.evaluate(() => {
        const box = document.querySelector("#map .alm-n .alm-box");
        const on = document.querySelector("header .seg button.on");
        const cs = e => getComputedStyle(e);
        return { stroke: cs(box).stroke, fill: cs(box).fill, onFg: cs(on).color, onBg: cs(on).backgroundColor };
      });
      // Mutation: drop --alm-node-line's dark value -> 2.5:1.
      check(contrast(c.stroke, c.fill) >= 3, "a claim's border stands out from its box (3:1 or more)",
            `${c.stroke} on ${c.fill}: ${contrast(c.stroke, c.fill).toFixed(2)}`);
      // Mutation: set --on-accent back to #fff in dark -> 2.4:1.
      check(contrast(c.onFg, c.onBg) >= 4.5, "a pressed button's words read against it (4.5:1 or more)",
            `${c.onFg} on ${c.onBg}: ${contrast(c.onFg, c.onBg).toFixed(2)}`);
      await page.context().close();
    }
    {
      const page = await open(editor, { scheme: "dark" });
      await page.click("#picknew");
      await page.waitForSelector(".cm-gutters", { timeout: 20000 });
      await page.waitForTimeout(600);
      const g = await page.evaluate(() => ({ gutter: getComputedStyle(document.querySelector(".cm-gutters")).backgroundColor,
                                              page: getComputedStyle(document.body).backgroundColor }));
      // Mutation: drop the editor's chrome theme and darkTheme compartment -> a light gutter strip.
      check(contrast(g.gutter, g.page) < 1.5, "the editor's gutter is dark on the dark page", JSON.stringify(g));
      await page.context().close();
    }
  } finally {
    await browser.close();
  }
}

console.log(`\n${fails ? "FAILED" : "all passed"} — ${checks - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
