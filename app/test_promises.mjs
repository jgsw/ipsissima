#!/usr/bin/env node
/* test_promises.mjs — promises made in prose, held by a lint.
 *
 * The suite already holds the values' checkable facts wherever a defect taught it to
 * (docs/values/AUTOMATION.md §3 is the census). What it did not hold was promises made in
 * DOCUMENTS, whose breakage no test noticed because prose is nobody's fixture — and in one week
 * two such drifts stood for days: a CI allowance that outlived the failure it forgave, and a
 * README that denied a tool the server ships (docs/values/TENSIONS.md, T2 and T3). Every row
 * here is a FACT with a pedigree, `!`-shaped: the lint never opines, and anything that is a
 * judgement about the values stays with people (AUTOMATION.md §2).
 *
 * The rows that need other machinery live where the machinery is, and are named here so this
 * file is the index: the no-network promise is asserted at RUNTIME in test_rendered_dom.mjs
 * (a browser records every request a session makes), and the MCP README's probe-count sentence
 * is checked against the live server in ipsissima-mcp/tests/test_server.py.
 *
 * SHOWN ABLE TO FAIL, 3 Sep 2026: adding `continue-on-error` to the workflow fails the pairing
 * row; setting app/package.json license to GPL fails the boundary row; and the samples row
 * failed for real before it ever passed — its calibration run found the Miller source file
 * carrying no licence note at all, against the samples README's own rule, and the file was
 * fixed rather than the row weakened.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const read = rel => fs.readFileSync(path.join(REPO, rel), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/* ---- a CI allowance and its KNOWN-ISSUES twin arrive and leave together ----------------
 * The T2 drift: the fold-invariants failure was fixed on 29 Aug and the workflow forgave it
 * until 3 Sep — a hole, since any new failure of that suite would have turned the build green.
 * The rule both files now state: a defect that ships failing is named in KNOWN-ISSUES.md AND
 * allowed explicitly in the workflow, and both come out the day it is fixed. Either half
 * without the other is the drift. (`continue-on-error` anywhere in the workflow counts as
 * allowance machinery on purpose: if one is ever added for some other reason, this row forces
 * the pairing to be argued rather than assumed.) */
console.log("\nthe CI allowance and its twin");
{
  const wf = read(".github/workflows/tests.yml");
  const ki = read("KNOWN-ISSUES.md");
  const wfAllows = /continue-on-error|known failure allowed|expected='/.test(wf);
  const kiExpects = /expected to fail/i.test(ki);
  ok("the workflow forgives nothing KNOWN-ISSUES does not name",
     !wfAllows || kiExpects,
     "tests.yml carries allowance machinery and KNOWN-ISSUES.md names no expected failure");
  ok("  and KNOWN-ISSUES names nothing the workflow does not allow",
     !kiExpects || wfAllows,
     "KNOWN-ISSUES.md says a suite is expected to fail and tests.yml would fail the build on it");
}

/* ---- the licence boundary is deliberate, and stays where it was drawn ------------------
 * The app is MIT so its layout work can flow back to Argdown; the Python keeps
 * GPL-3.0-or-later because PyMuPDF leaves no honest alternative (docs/LICENCE-AUDIT.md). The
 * boundary is the author's standing decision, and the likeliest way to lose it is a
 * well-intentioned harmonisation. Three files state it; this row keeps them stating it. */
console.log("\nthe licence boundary");
{
  const appPkg = JSON.parse(read("app/package.json"));
  ok("the app declares MIT", appPkg.license === "MIT", `app/package.json says ${appPkg.license}`);
  ok("the root LICENSE is the MIT text", /^MIT License/.test(read("LICENSE")));
  const py = read("ipsissima-mcp/pyproject.toml");
  ok("the Python declares GPL-3.0-or-later", /GPL-3\.0-or-later/.test(py));
  ok("  and carries the GPL text beside it",
     /GNU GENERAL PUBLIC LICENSE/.test(read("ipsissima-mcp/LICENSE")));
}

/* ---- every sample names its licence, in the README and in the source file itself -------
 * The samples directory's one rule (samples/README.md): only texts that may be redistributed,
 * with the licence named in the folder's README AND in the source file — because a
 * reconstruction can travel as a single file, at which point the source file is the only
 * thing carrying the attribution. Whole-file search, since a converted article may carry its
 * publisher's own notice mid-file rather than a block at the top. */
console.log("\nthe samples name their licences");
{
  const LIC = /licen[cs]e|public domain|creative commons|cc.?by|open justice|open government/i;
  const root = path.join(REPO, "samples");
  for (const dir of fs.readdirSync(root)) {
    const d = path.join(root, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    const readme = path.join(d, "README.md");
    ok(`${dir.slice(0, 40)}: the README names a licence`,
       fs.existsSync(readme) && LIC.test(fs.readFileSync(readme, "utf8")));
    const srcDir = path.join(d, "source");
    const sources = fs.existsSync(srcDir)
      ? fs.readdirSync(srcDir).filter(f => f.endsWith(".md")) : [];
    if (sources.length) {
      ok(`  and its source file${sources.length === 1 ? "" : "s"} carr${sources.length === 1 ? "ies" : "y"} it too`,
         sources.every(f => LIC.test(fs.readFileSync(path.join(srcDir, f), "utf8"))),
         sources.filter(f => !LIC.test(fs.readFileSync(path.join(srcDir, f), "utf8"))).join(", "));
    } else {
      // A SURVEY SAMPLE HAS NO SOURCE TEXT — a debate map reads no document
      // (docs/values/SECOND-THOUGHTS.md) — so the .argdown itself is the file that travels
      // alone, and the rule attaches to it: the licence rides in every file that can leave
      // by itself. A reading sample that has simply lost its sources still fails here,
      // because its .argdown names no licence for a text it does not carry.
      const maps = fs.readdirSync(d).filter(f => f.endsWith(".argdown"));
      ok(`  and its .argdown carries it too (no source text: a survey sample)`,
         maps.length > 0 &&
         maps.every(f => LIC.test(fs.readFileSync(path.join(d, f), "utf8"))),
         maps.filter(f => !LIC.test(fs.readFileSync(path.join(d, f), "utf8"))).join(", ")
           || "no .argdown at all");
    }
  }
}

/* ---- every menu id and every handler id name each other -------------------------------
 * The doctrine, stated where the menu is wired: the menu rings the same doorbells as the
 * buttons, and no menu item has behaviour of its own. `Show the Key` shipped menu-only on
 * 3 Sep and the author met the gap in the HTML version (docs/PARITY-PLAN.md) — the pedigree.
 * The mechanical half held here: the menu ids in lib.rs and the handler ids in the template's
 * onMenu map are the same set, both ways. The judgement half — that each handler's control is
 * actually VISIBLE on the page — stays with people (docs/values/AUTOMATION.md §2).
 *
 * NO_PAGE_DOORBELL documents the ids allowed to lack an on-page control; adding an id there
 * is how a menu-only function argues for itself in this file rather than shipping by drift,
 * and each entry must still be a real menu id, so the list cannot quietly rot.
 *
 * SHOWN ABLE TO FAIL, 3 Sep 2026: a phantom `item("phantom", …)` appended to lib.rs fails the
 * has-a-handler direction, and deleting the `"key"` handler line from the template fails it
 * the other way round. */
console.log("\nthe menus ring doorbells the page has");
{
  const NO_PAGE_DOORBELL = new Set([
    "check-updates",   // deliberate: the request lives in Rust so the page's no-network
                       // claim stays absolute (C1); the onMenu block names it as the one
                       // menu item that is not a second doorbell
  ]);
  const rust = read("app/desktop/src-tauri/src/lib.rs");
  const menuIds = new Set([...rust.matchAll(/item\("([a-z][a-z-]*)",/g)].map(m => m[1]));
  const tpl = read("app/argdown-viewer.template.html");
  const start = tpl.indexOf("HOST.onMenu(function");
  const mapSrc = tpl.slice(start, tpl.indexOf("})[id]", start));
  const handlerIds = new Set([...mapSrc.matchAll(/^\s*"([a-z][a-z-]*)":/gm)].map(m => m[1]));
  ok("both lists were found and are not trivial",
     menuIds.size > 10 && handlerIds.size > 10 && start > 0,
     `menu ${menuIds.size}, handlers ${handlerIds.size}`);
  const unhandled = [...menuIds].filter(id => !handlerIds.has(id));
  const unrung = [...handlerIds].filter(id => !menuIds.has(id));
  ok("every menu id has a handler in the page", unhandled.length === 0, unhandled.join(", "));
  ok("  and every handler answers a menu id", unrung.length === 0, unrung.join(", "));
  const rotted = [...NO_PAGE_DOORBELL].filter(id => !menuIds.has(id));
  ok("  the exception list names only real menu ids", rotted.length === 0, rotted.join(", "));
}

/* ---- the mission says the same thing everywhere it is said ------------------------------
 * The mission sentence was restated at the Purpose checkpoint (docs/values/PURPOSE.md, 20 Oct
 * 2026), and the audit found it copied into nine files with nothing holding the copies together
 * (E10). Every surface that states the mission states this sentence; the four that introduce
 * Ipsissima at length carry the line beneath it too; and the retired sentence survives only in
 * the records that tell its history (the values documents, brand/README.md, docs/NOTES.md).
 * Whitespace and case are folded, because the sentence is wrapped in prose and begins one
 * file's sentence mid-way ("Ipsissima makes complex reasoning clear…"). SHOWN ABLE TO FAIL,
 * 20 Oct 2026: putting the retired sentence back in app/about.md fails the first and third rows. */
console.log("\nthe mission, said once");
{
  const fold = t => t.replace(/\s+/g, " ").toLowerCase();
  const MISSION = "complex reasoning clear through maps you can check and question";
  const BENEATH = "the argument and its reasons, the order the text tells them in, what it says " +
                  "happens, and the tables of what it compares — each one a way into the text";
  const RETIRED = "complex reasoning intelligible through maps";
  const STATES = ["README.md", "site/index.md", "site/_config.yml", "app/package.json",
                  "app/help.md", "app/about.md", "app/desktop/src-tauri/tauri.conf.json",
                  "brand/README.md", "docs/NOTES.md", "docs/values/THEORY.md",
                  "ipsissima-mcp/README.md"];
  const INTRODUCES = ["README.md", "site/index.md", "app/help.md", "app/about.md"];
  const HISTORY = new Set(["brand/README.md", "docs/NOTES.md", "docs/values/THEORY.md"]);
  const missing = STATES.filter(f => !fold(read(f)).includes(MISSION));
  ok("every surface that states the mission states this sentence", missing.length === 0,
     missing.join(", "));
  const noLine = INTRODUCES.filter(f => !fold(read(f)).includes(BENEATH));
  ok("  and the four introductions carry the line beneath it", noLine.length === 0,
     noLine.join(", "));
  const stale = STATES.filter(f => !HISTORY.has(f) && fold(read(f)).includes(RETIRED));
  ok("  the retired sentence survives only where its history is told", stale.length === 0,
     stale.join(", "));
}

console.log(`\n${fail ? "FAILED" : "all promises hold"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
