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
    ok(`  and its source file${sources.length === 1 ? "" : "s"} carr${sources.length === 1 ? "ies" : "y"} it too`,
       sources.length > 0 &&
       sources.every(f => LIC.test(fs.readFileSync(path.join(srcDir, f), "utf8"))),
       sources.filter(f => !LIC.test(fs.readFileSync(path.join(srcDir, f), "utf8"))).join(", ")
         || "no source/*.md at all");
  }
}

console.log(`\n${fail ? "FAILED" : "all promises hold"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
