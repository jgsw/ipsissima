/* test_page_parity.mjs — the exported page is the same program as the Reader.
 *
 * WHAT WENT WRONG, and why a test rather than a fix. A page is assembled from two directions:
 * `build_argdown_viewer.mjs` does it in Node from files on disk, and the page does it in a
 * browser from the scripts already inlined in itself, so that a reconstruction can be sent as
 * one file. Each kept its own list of what a page is made of. They disagreed by two entries —
 * HELP and STAMP — and the disagreement was invisible from either side.
 *
 * The cost was not two missing scripts. `help.md` carries four elements the RENDERER writes
 * into, so `statsLine` threw on `$("helpstats")` and took the rest of `render` with it: no Notes
 * tab, no relation key, and `setArrangement` never called, so the Exposition button did nothing.
 * Four bug reports, one cause, and nothing on screen or in any test said so.
 *
 * `argdown-page.js` now holds the list once and the page carries everything it has apart from an
 * argued-for drop-list. This checks the properties that made the old arrangement dangerous:
 *
 *   1. the template and the section list agree
 *   2. nothing small and load-bearing is on the drop-list
 *   3. a simulated export really does carry the sections a Reader has
 *   4. every element the program writes into exists SOMEWHERE, and the ones that exist only
 *      inside help.md are counted — that count is the argument for HELP never being dropped
 *   5. the file a new reconstruction starts from parses
 *
 * No build step and no artifact: the template is filled with stub scripts, and the page's own
 * export selection is run over the result. Both routes use the shared module, so simulating them
 * is running them.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import vm from "vm";
import { argdown } from "@argdown/node";
import { toGraph, RUN, metadataProblems, parseProblems } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PAGE = require(path.join(HERE, "src", "argdown-page.js"));
const yaml = require("js-yaml");

let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok && detail != null) console.log(`        ${detail}`);
};

const TEMPLATE = fs.readFileSync(path.join(HERE, "argdown-viewer.template.html"), "utf8");
const HELP_MD = fs.readFileSync(path.join(HERE, "help.md"), "utf8");
const ABOUT_MD = fs.readFileSync(path.join(HERE, "about.md"), "utf8");

console.log("the template and the section list agree");
{
  const wrong = PAGE.checkTemplate(TEMPLATE);
  check("every INLINE marker is a known part, and every part has a marker",
        wrong.length === 0, wrong.join("\n        "));
}

console.log("the drop-list is only the heavy bundles");
{
  // THE LIST IS SHORT ON PURPOSE. Each entry costs an exported page a capability, so each has to
  // be worth a hundred kilobytes or more. Anything else being droppable is how HELP went missing.
  const allowed = ["PARSER", "EDITOR", "EXPORTER", "SHELL"];
  check("nothing has been added without being argued for here",
        PAGE.EXPORT_DROPS.every(k => allowed.includes(k)),
        `drops: ${PAGE.EXPORT_DROPS.join(", ")}`);
  for (const must of ["LIVEMAP_DEPS", "PAYLOAD", "HELP", "STAMP"])
    check(`  ${must} is never dropped`, !PAGE.EXPORT_DROPS.includes(must));
}

/* A page as the builder writes one, with each section's script stubbed. The stub carries its own
 * name so what comes out the other end can be identified; nothing here executes. */
function buildStub(parts) {
  const filled = {};
  for (const k of parts)
    filled[k] = `<script data-part="${k}">\n/* ${k} */ window.__PART_${k}__ = true;\n</script>\n`;
  const r = PAGE.fill(TEMPLATE, filled);
  if (r.missing.length) throw new Error("stub named a part with no marker: " + r.missing);
  return r.html;
}

/** The page's own export, run outside a browser: read this page's `data-part` scripts, ask which
 *  a copy carries, and substitute a fresh payload. Line for line what `exportPage` does. */
function simulateExport(html) {
  const have = [];
  for (const m of html.matchAll(/<script data-part="([A-Z_]+)">/g))
    if (!have.includes(m[1])) have.push(m[1]);
  const want = PAGE.exportParts(have);
  const parts = {};
  for (const k of Object.keys(want))
    parts[k] = want[k]
      ? [...html.matchAll(new RegExp(`<script data-part="${k}">[\\s\\S]*?<\\/script>`, "g"))]
          .map(m => m[0]).join("\n")
      : "";
  parts.PAYLOAD = '<script data-part="PAYLOAD">\nwindow.__ARGDOWN_PAYLOAD__ = {};\n</script>\n';
  return { html: PAGE.fill(html, parts).html, carried: have.filter(k => want[k]) };
}

console.log("what a Reader exports still is a Reader");
{
  // The Viewer: every section a `--standalone` build has, and no editor.
  const reader = buildStub(["LIVEMAP_DEPS", "PARSER", "EXPORTER", "SHELL", "STAMP", "HELP"]);
  const out = simulateExport(reader);
  check("the copy carries the help text", out.carried.includes("HELP"));
  check("  and the build stamp, so About can say which build this is",
        out.carried.includes("STAMP"));
  check("  and what draws the map", out.carried.includes("LIVEMAP_DEPS"));
  check("  and leaves the parser behind, because the graph is baked in",
        !out.carried.includes("PARSER"));
  check("exactly one payload is written",
        (out.html.match(/window\.__ARGDOWN_PAYLOAD__ = /g) || []).length === 1);
  check("no marker is left unfilled",
        !/<!--\s*INLINE:[A-Z_]+\s*-->/.test(out.html),
        (out.html.match(/<!--\s*INLINE:[A-Z_]+\s*-->/g) || []).join(", "));

  // The workbench exports the same page. It was once able to export a second, heavier kind with
  // CodeMirror inside; that was withdrawn, and this is what says so.
  const bench = buildStub(["LIVEMAP_DEPS", "PARSER", "EDITOR", "EXPORTER", "SHELL", "STAMP", "HELP"]);
  const out2 = simulateExport(bench);
  check("the workbench exports the same kind of page, not a copy of itself",
        !out2.carried.includes("EDITOR") && !out2.carried.includes("SHELL"));
  check("  and it too carries the help text and the stamp",
        out2.carried.includes("HELP") && out2.carried.includes("STAMP"));

  // A page built with no HELP at all is what the bug produced. Stated as a test so that the
  // shape of the failure is on the record rather than only in a comment.
  const broken = buildStub(["LIVEMAP_DEPS", "STAMP"]);
  check("a build with no HELP is detectable — this is the shape the bug had",
        !/window\.__HELP_MD__/.test(simulateExport(broken).html.split("<script")[0]));
}

console.log("every element the program writes into exists");
{
  // Ids the page's own script reaches for. `$("x")` is the page's helper; getElementById is used
  // in a few places directly. String literals only — a computed id cannot be checked from here.
  // The program's own script block. Found by a `<script>` alone on its own line, NOT by
  // `lastIndexOf("<script>")`: that matched the words "inside a `<script> body" in a comment
  // halfway down the file, so the scan started in the middle of the program and reported that
  // none of the help elements were referenced at all — a green test asserting nothing.
  const at = TEMPLATE.lastIndexOf("\n<script>\n");
  if (at < 0) throw new Error("the template has no main <script> block on a line of its own");
  const script = TEMPLATE.slice(at);
  const referenced = new Set();
  for (const m of script.matchAll(/\$\("([A-Za-z][\w-]*)"\)/g)) referenced.add(m[1]);
  for (const m of script.matchAll(/getElementById\("([A-Za-z][\w-]*)"\)/g)) referenced.add(m[1]);

  const idsIn = (text) => {
    const out = new Set();
    for (const m of text.matchAll(/\bid="([A-Za-z][\w-]*)"/g)) out.add(m[1]);
    return out;
  };
  const inTemplate = idsIn(TEMPLATE.slice(0, at));
  const inHelp = idsIn(HELP_MD);
  const inAbout = idsIn(ABOUT_MD);

  const missing = [...referenced].filter(
    id => !inTemplate.has(id) && !inHelp.has(id) && !inAbout.has(id));
  check("no id is reached for that nothing defines",
        missing.length === 0, missing.join(", "));

  // THE COUNT THAT MAKES HELP LOAD-BEARING. These elements exist only because help.md ships. A
  // page without it does not merely lack a help panel: the first write to one of these throws,
  // and everything after it in `render` is skipped.
  const onlyInProse = [...referenced].filter(
    id => !inTemplate.has(id) && (inHelp.has(id) || inAbout.has(id)));
  console.log(`        ${onlyInProse.length} of them live in help.md/about.md: ` +
              onlyInProse.sort().join(", "));
  check("there are such elements, so HELP is load-bearing and not decoration",
        onlyInProse.length > 0);
  check("  therefore an exported page carries HELP", !PAGE.EXPORT_DROPS.includes("HELP"));
}

/* THE WALKTHROUGH IS NOT A PART, AND THAT IS THE POINT.
 *
 * It lives in the template's own script rather than behind an `INLINE:` marker, so it cannot be
 * on the drop-list and travels into every page built from this template — the Reader, a built
 * map, an exported copy. What differs between those is only whether it STARTS on its own, which
 * is a runtime question about `__ARGDOWN_PAYLOAD__` and is checked here as one.
 *
 * The parse check is the cheap one and the one worth having. `tsc --noEmit` reads the .js files
 * under src/; nothing reads the several thousand lines of JavaScript inside this HTML file, so
 * an unbalanced brace in it is a page that opens to a blank map and says nothing.
 */
console.log("the walkthrough travels, and starts itself only in the workbench");
{
  const at = TEMPLATE.lastIndexOf("\n<script>\n");
  const script = TEMPLATE.slice(at).replace(/^\n<script>\n/, "").replace(/<\/script>[\s\S]*$/, "");
  let parsed = true, why = "";
  try { new vm.Script(script); } catch (e) { parsed = false; why = String(e && e.message || e); }
  check("the template's own script parses", parsed, why);

  const reader = buildStub(["LIVEMAP_DEPS", "PARSER", "EXPORTER", "SHELL", "STAMP", "HELP"]);
  const out = simulateExport(reader).html;
  check("an exported page still has the walkthrough's card",
        /id="walkcard"/.test(out) && /id="walkspot"/.test(out));
  check("  and the code that runs it", /function startWalkthrough\b/.test(out));
  check("  and offers it from the Help, which is where it says it will be",
        /Take the walkthrough/.test(out) && /Take the walkthrough/.test(HELP_MD));
  check("  but does not greet a reader who was sent one reconstruction",
        /if \(window\.__ARGDOWN_PAYLOAD__\) return;/.test(out));
  check("  and never lets a refused localStorage stop the page opening",
        /catch \(e\) \{ return \{ ok: false \}; \}/.test(out));
}

/* THE METADATA CHECK MUST AGREE WITH ARGDOWN, IN BOTH DIRECTIONS.
 *
 * It exists because Argdown will not report a broken `{…}`: it drops every claim after the fault
 * and returns success. So a block it accepts and the check rejects is a good map refused, and a
 * block it drops and the check accepts is the silence the check was written to break. Both have
 * happened.
 *
 * TWO STYLES ARE VALID AND THEY ARE EACH OTHER'S ERRORS. `{…}` with content on the brace line is
 * a YAML FLOW mapping and needs commas; a brace standing alone on its line makes the interior
 * ordinary BLOCK YAML, where a comma is a syntax error. Written with the other's punctuation,
 * either style yields nothing from Argdown while looking perfectly reasonable.
 *
 * The check used to parse every block as flow, so it called 138 blocks broken on a valid
 * book-length map and refused to draw it. Fixing that by trying flow and falling back to block
 * would have been worse than the bug: a brace-alone block WITH commas is valid flow YAML and
 * Argdown drops it, so the fallback would have waved through exactly the file this is for.
 *
 * Hence the pairing below: for each case, what the check says and what Argdown does, asserted to
 * agree. A case where they differ is a bug whichever way round it is.
 */
console.log("the metadata check agrees with the parser");
{
  const cases = [
    ["flow, wrapping across lines — the samples' style",
     `[A]: c. {fidelity: "quotation", pinpoint: "[32]",\n     note: "x"}\n`],
    ["a brace alone on its line, no commas — also valid",
     `[A]: c.\n    {\n    chapter: "x.md"\n    fidelity: "quotation"\n    }\n`],
    ["a brace alone WITH commas — valid flow YAML, and argdown drops it",
     `[A]: c.\n    {\n    chapter: "x.md",\n    fidelity: "quotation"\n    }\n`],
    ["flow wrapping without a comma",
     `[A]: c. {fidelity: "quotation"\n     note: "x"}\n`],
    ["flow missing a comma",       `[A]: c. {chapter: "x.md" fidelity: "q"}\n`],
    ["an unterminated string",     `[A]: c. {chapter: "x.md, fidelity: "q"}\n`],
    ["a duplicated key",           `[A]: c.\n    {\n    chapter: "a"\n    chapter: "b"\n    }\n`]
  ];
  for (const [name, src] of cases) {
    const reported = metadataProblems(src, yaml.load).length > 0;
    const res = await argdown.runAsync({ input: src, ...RUN });
    const dropped = Object.keys(res.statements || {}).length === 0;
    // `check` takes a CONDITION and a detail, not a got/want pair. The agreement is the
    // condition; the detail says which way round they disagreed.
    check(`  ${name}`, reported === dropped,
          `check ${reported ? "reports" : "accepts"} it, argdown ${dropped ? "drops" : "reads"} it`);
  }
}

console.log("the file a new reconstruction starts from");
{
  const starter = fs.readFileSync(path.join(HERE, "new-reconstruction.argdown"), "utf8");
  const bad = metadataProblems(starter, yaml.load);
  check("its metadata blocks are well formed", bad.length === 0, JSON.stringify(bad));
  const res = await argdown.runAsync({ input: starter, ...RUN });
  const broke = parseProblems(res, starter);
  check("  it parses", broke.length === 0, JSON.stringify(broke));
  const g = res.map ? toGraph(res) : { nodes: [], edges: [] };
  check("  and draws a map, so the first thing a new reader sees is not an empty page",
        g.nodes.length >= 3 && g.edges.length >= 2,
        `${g.nodes.length} nodes, ${g.edges.length} edges`);
  // It is a teaching file as much as a starting point: someone typing over it should have met
  // the vocabulary the borders use. Cheap to assert, and it would have gone stale silently.
  const fid = new Set(g.nodes.map(n => n.fidelity));
  check("  and shows what the borders mean, by using more than one of them",
        fid.size >= 3, [...fid].join(", "));
}

console.log(fails ? `\n${fails} check(s) failed\n` : "\nall passed\n");
process.exit(fails ? 1 : 0);
