#!/usr/bin/env node
/* Smoke test: the filter produces a live HTML page and a static docx figure, and the CLI
 * writes all three formats — using the vendored renderer, the way a user's install would.
 * Needs pandoc on PATH and Playwright's Chromium (a dev dependency here).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "argdown-pandoc-test-"));
let failures = 0;
const ok = (cond, msg) => {
  console.log((cond ? "  ok    " : "  FAIL  ") + msg);
  if (!cond) failures++;
};

const MAP = `[Main claim]: The thing argued for.
    + [Support]: A reason in its favour.
        + [Deeper]: A reason for the reason.
    - [Objection]: A reason against.`;

const doc = path.join(tmp, "doc.md");
fs.writeFileSync(doc, "# Test\n\n```{.argdown-map caption=\"A map\"}\n" + MAP + "\n```\n" +
  "\n```argdown\n[Source]: stays source.\n```\n");
const adFile = path.join(tmp, "map.argdown");
fs.writeFileSync(adFile, MAP);

let pandoc = true;
try { execFileSync("pandoc", ["--version"], { stdio: "ignore" }); }
catch { pandoc = false; console.log("  skip  pandoc not on PATH — filter checks skipped"); }

const FILTER = path.join(PKG, "bin", "argdown-pandoc.mjs");
if (pandoc) {
  const html = path.join(tmp, "out.html");
  execFileSync("pandoc", [doc, "-s", "--embed-resources", "--filter", FILTER, "-o", html],
               { cwd: tmp });
  const page = fs.readFileSync(html, "utf8");
  ok(page.includes("argdown-live-data"), "html: the live map's data rides in the page");
  ok(page.includes("ArgdownLiveMap"), "html: the renderer is inlined");
  ok(page.includes("ArgdownStaircase"), "html: the explode panel's engine is inlined");
  ok(!/\bclass="argdown"/.test(page), "html: the bare argdown block was retagged");

  const docx = path.join(tmp, "out.docx");
  execFileSync("pandoc", [doc, "--filter", FILTER, "-o", docx], { cwd: tmp });
  ok(fs.statSync(docx).size > 5000, "docx: a document with an embedded figure came out");

  // A fold state for the wrong map must fail the export, loudly.
  const bad = path.join(tmp, "bad.md");
  fs.writeFileSync(bad, "```{.argdown-map fold=\"ipsfold1 map=deadbeef view=arg\"}\n" +
                        MAP + "\n```\n");
  let failed = false, msg = "";
  try { execFileSync("pandoc", [bad, "--filter", FILTER, "-o", path.join(tmp, "bad.html")],
                     { cwd: tmp, stderr: "pipe" }); }
  catch (e) { failed = true; msg = String(e.stderr || ""); }
  ok(failed && msg.includes("different map"),
     "a fold state for the wrong map fails the export with the reason");
}

const CLI = path.join(PKG, "bin", "argdown-map.mjs");
for (const ext of ["svg", "png", "pdf"]) {
  const out = path.join(tmp, "map." + ext);
  execFileSync(process.execPath, [CLI, adFile, "-o", out], { cwd: tmp });
  ok(fs.existsSync(out) && fs.statSync(out).size > 500, "cli: wrote a " + ext);
}
const svg = fs.readFileSync(path.join(tmp, "map.svg"), "utf8");
ok(svg.includes("Main claim") && svg.startsWith("<svg"),
   "cli: the SVG is standalone and carries the claims");

fs.rmSync(tmp, { recursive: true, force: true });
if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("smoke test: everything a fresh install should do, done");
