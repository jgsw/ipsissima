#!/usr/bin/env node
/* run_all_tests.mjs — every check, one command.
 *
 *   node app/run_all_tests.mjs [--jobs N] [--shard K/N | --list-shards N]
 *
 * Run this before sharing the tooling, and after any change to the renderer, the fold logic or
 * the provenance rules. Each suite is independent and each prints its own detail; this reports
 * which passed and exits non-zero if any did not.
 *
 * SIDE BY SIDE, NOT ONE AFTER ANOTHER (21 Nov 2026). Run in series the suites took 22 minutes on
 * CI and 18 here, most of it one process waiting while the machine's other cores did nothing
 * (docs/TEST-SPEED-AUDIT.md). They now run `--jobs` at a time, by default one per core, the
 * slowest started first. Nothing about what is checked changed. Each suite's output is held until
 * it finishes, and the blocks are printed in this file's order, so the log reads as it always
 * did. `--jobs 1` is the old serial run, for when two suites are suspected of interfering.
 *
 * WHAT MAKES THAT SAFE is that every suite writes only into a temporary folder of its own. The
 * one that did not (the shim test rebuilt the committed parser in place) was changed to build
 * aside. A new suite that writes into the checkout breaks this, so: write into os.tmpdir().
 */
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(HERE, "src");
const MCP = path.resolve(HERE, "..", "ipsissima-mcp");
const PYSRC = path.join(MCP, "src", "ipsissima_mcp");
const PYTESTS = path.join(MCP, "tests");
// The converters' own tests, which moved with them into Unpetrify (Nov 2026).
const UNPTESTS = path.resolve(HERE, "..", "unpetrify", "tests");

/* THE PROJECT'S OWN INTERPRETER WHERE THERE IS ONE. A Homebrew or system Python refuses
 * `pip install` outright (PEP 668), so the MCP server's dependencies live in a venv — and a
 * suite that shells out to bare `python3` would then report the server's tests as skipped on
 * the very machine where they were meant to run. Falls back to `python3` so a checkout with no
 * venv still runs everything that does not need one. */
const VENV = path.resolve(HERE, "..", ".venv", "bin", "python3");
const PY = fs.existsSync(VENV) ? VENV : "python3";

const TSC = path.join(HERE, "node_modules", ".bin", "tsc");

/** @type {[string, string, string[]][]} */
const SUITES = [
  // FIRST, because it is two seconds and it reads every shipped file. `checkJs` over the
  // existing JavaScript, no build step and no emit — see app/tsconfig.json for why it is not a
  // rewrite. It found two names exported twice from the renderer on its first run.
  ["types (tsc --noEmit over the JS)", TSC, ["-p", HERE]],
  ["fold logic (fixtures)",      "node", [path.join(BUILD, "test_argdown_live_map.js")]],
  ["edge direction (arrowheads)", "node", [path.join(BUILD, "test_edge_direction.js")]],
  ["fold invariants (state space)", "node", [path.join(HERE, "test_fold_invariants.mjs"), "--steps", "1500"]],
  ["fold state identifier (round-trip)", "node", [path.join(HERE, "test_fold_state_id.mjs")]],
  // The CAMERA on a fold, which every other fold test here is silent about: a section that ends
  // up off the top of the pane is a correct layout drawn from the wrong place.
  ["the camera holds what was pressed", "node", [path.join(HERE, "test_fold_camera.mjs")]],
  // WHAT THE RENDERER ACTUALLY PAINTS, in a real browser. Every other suite here stops at the
  // DOM, and a fortnight of defects lived on the far side of it -- see docs/QA-PLAN.md. Skipped
  // with a word rather than a failure where Playwright is not installed, so a checkout that has
  // not run `npx playwright install chromium` still runs everything else.
  // FOUR PROCESSES, one suite: on its own it was longer than everything else together once the
  // suites ran side by side. See `--part` in the file.
  ["the rendered map (browser): light, and the self-test", "node", [path.join(HERE, "test_rendered_dom.mjs"), "--part", "light"]],
  ["the rendered map (browser): dark", "node", [path.join(HERE, "test_rendered_dom.mjs"), "--part", "dark"]],
  ["the rendered map (browser): feature checks, 1 of 2", "node", [path.join(HERE, "test_rendered_dom.mjs"), "--part", "checks1"]],
  ["the rendered map (browser): feature checks, 2 of 2", "node", [path.join(HERE, "test_rendered_dom.mjs"), "--part", "checks2"]],
  ["the mechanism arrangement", "node", [path.join(HERE, "test_mechanism_view.mjs")]],
  ["suppositions and contraposition", "node", [path.join(HERE, "test_suppose.mjs")]],
  ["the text's comparisons as tables", "node", [path.join(HERE, "test_tables.mjs")]],
  // THE MECHANISM VOCABULARY IN THE EDITOR: its checks are mechanism.py's local rules, ported, and
  // held to the checker word for word on every fixture and sample with a mechanism.
  ["the editor checks a mechanism as the checker does", "node", [path.join(HERE, "test_mechanism_lint.mjs")]],
  // THE CHART'S LAYOUT RULES (docs/MECHANISM-LAYOUT.md): no hard breach on any picture of any
  // fixture or public sample, and no soft number materially worse than its baseline.
  ["the mechanism chart keeps its rules", "node", [path.join(HERE, "mechanism_quality.mjs")]],
  ["the author's diagram as an answer key", "node", [path.join(HERE, "test_diagram_compare.mjs")]],
  // F8, designed against the misreading (admitted 27 Sep 2026): the faults the clarity audit
  // found on screen -- help that vanished with the map, an id printed where a name belonged, a
  // bar that dropped every word -- each held by a real-input check.
  ["designed against the misreading", "node", [path.join(HERE, "test_clarity.mjs")]],
  // AND THE WORDS THAT TEACH IT: menu paths as the menus spell them, glyphs as the page draws
  // them, and the retired names (app/vocabulary.json) kept retired.
  ["the teaching text says what is there", "node", [path.join(HERE, "test_teaching_text.mjs")]],
  ["the appraisal, off until asked", "node", [path.join(HERE, "test_appraisal_layer.mjs")]],
  // 19 Nov 2026: the appraisal beside the map, and Where to look (offered unasked, as a trial).
  ["where to look, and the appraisal beside the map", "node", [path.join(HERE, "test_diagnostics.mjs")]],
  // 20 Nov 2026, the tablet audit: what a mouse does, a finger can do -- by real touch input.
  ["on a phone and an upright iPad", "node", [path.join(HERE, "test_touch.mjs")]],
  // AND WHAT IT WRITES OUT, read back by a parser and a renderer that did not write it. Three of
  // the four export defects were invisible in the browser that made the file.
  ["the exports, read back", "node", [path.join(HERE, "test_export_artifacts.mjs")]],
  // A FIELD READ BY THE RENDERER AND WRITTEN BY NOTHING. `n.full` was one for eleven months and
  // cost seven claims their hover text the day something depended on it alone.
  ["the two sides agree about names", "node", [path.join(HERE, "test_dead_fields.mjs")]],
  ["fold, every small map",      "node", [path.join(HERE, "test_fold_exhaustive.mjs"), "4"]],
  ["layout geometry (adversarial)", "node", [path.join(HERE, "test_layout_geometry.mjs"), "--cases", "80"]],
  // THE SEATS: one order per map, chosen once to cross less -- the same in every view, premises
  // in their order, and no level of the depth ladder crossing more than written order did.
  ["the seats cross less, and only once", "node", [path.join(HERE, "test_seats.mjs")]],
  // WHERE A LINE MEETS ITS BOX: off the rounded corners, never flat along its own border (21 Nov
  // 2026, a hook reported on Prescott-Couch). The painted half is in the rendered-map suite.
  ["a line meets its box on a face, not a corner", "node", [path.join(HERE, "test_line_ends.mjs")]],
  ["provenance: py vs js",       "node", [path.join(HERE, "test_argdown_positions.mjs")]],
  // The SECOND py/js pair. One decision procedure written twice will drift, so both halves run
  // the same hand-written vectors and any divergence fails here. See docs/VALIDITY-PLAN.md.
  ["named rules: the js half",   "node", [path.join(HERE, "test_validity.mjs")]],
  ["source pane cleanup",        "node", [path.join(HERE, "test_source_pane.mjs")]],
  ["folding the provenance",     "node", [path.join(HERE, "test_provenance_fold.mjs")]],
  // The parser shipped inside the Python package, against the real CLI it stands in for.
  ["the bundled Argdown parser", "node", [path.join(HERE, "test_argdown_shim.mjs")]],
  // Five files state the version and nothing keeps them in step.
  ["one release, one version", "node", [path.join(HERE, "test_versions.mjs")]],
  ["the promises hold",        "node", [path.join(HERE, "test_promises.mjs")]],
  // The Reader and the page it EXPORTS must be the same program. They came apart once, by two
  // entries in a list that existed twice, and four separate faults were reported before the
  // one cause was found. See the header of test_page_parity.mjs.
  ["the exported page is the Reader", "node", [path.join(HERE, "test_page_parity.mjs")]],
  ["annotated export (docx/md)", "node", [path.join(HERE, "test_export.mjs")]],
  ["the one-file bundle",        "node", [path.join(HERE, "test_bundle.mjs")]],
  ["how the parser fails",       "node", [path.join(HERE, "test_parse_failure.mjs")]],
  ["relation colours",           "node", [path.join(HERE, "test_relation_colours.mjs")]],
  ["the words survive the label mode", "node", [path.join(HERE, "test_label_modes.mjs")]],
  ["the private corpus",         "node", [path.join(HERE, "test_private_corpus.mjs")]],
  ["the documented examples",    "node", [path.join(HERE, "test_cheatsheet.mjs")]],
  ["the desktop host adapter",   "node", [path.join(HERE, "test_host.mjs")]],
  ["an external edit to the file", "node", [path.join(HERE, "test_external_edit.mjs")]],
  ["the shape of the text",      "node", [path.join(HERE, "test_exposition.mjs")]],
  ["what holds the argument up", "node", [path.join(HERE, "test_spine.mjs")]],
  ["page geometry (converter)",  PY, [path.join(UNPTESTS, "test_pdf_to_source.py")]],
  // A line-numbered review copy, a typeset proof, a page of maths: text lost or welded silently.
  ["review copies and proofs",   PY, [path.join(UNPTESTS, "test_review_copies.py")]],
  ["what ingest refuses to write", PY, [path.join(UNPTESTS, "test_ingest.py")]],
  ["a damaged scan, collated",   PY, [path.join(UNPTESTS, "test_collate.py")]],
  ["the publisher's own structure", PY, [path.join(UNPTESTS, "test_structured_source.py")]],
  ["a book split into its chapters", PY, [path.join(PYTESTS, "test_split_manuscript.py")]],
  ["named rules: the python half", PY, [path.join(PYTESTS, "test_validity.py")]],
  ["provenance defaults",        PY, [path.join(PYTESTS, "test_provenance_defaults.py")]],
  // An echo drawn where the text never says it points at words nobody wrote; one read as a
  // quotation moves the claim to wherever it is echoed. Both halves are held here.
  ["echoes: verified, and proposed", PY, [path.join(PYTESTS, "test_echoes.py")]],
  ["exposition: what of the text's order is thin", PY, [path.join(PYTESTS, "test_exposition.py")]],
  ["pinpoints: the page the words are on", PY, [path.join(PYTESTS, "test_pinpoints.py")]],
  ["reading checks (Stern cases)", PY, [path.join(PYTESTS, "test_reading_checks.py")]],
  // A duplicated key or a missing comma in a `{…}` block made Argdown drop the rest of the map
  // and the checker say "parses OK"; it must be a fault at its line.
  ["metadata Argdown would drop", PY, [path.join(PYTESTS, "test_metadata.py")]],
  ["the text's comparisons: frames and about (checker)", PY, [path.join(PYTESTS, "test_frames.py")]],
  ["the mechanism and the appraisal", PY, [path.join(PYTESTS, "test_mechanism.py")]],
  ["the profile holds to the code",   PY, [path.join(PYTESTS, "test_profile.py")]],
  ["the served method holds to the registry", PY, [path.join(PYTESTS, "test_method_docs.py")]],
  ["the appraisal report: quotations, links, routes (checker)", PY, [path.join(PYTESTS, "test_appraisal.py")]],
  // The same file, the same report: two hash seeds once reshuffled every tie in the census.
  ["the census, run twice",      PY, [path.join(PYTESTS, "test_census_deterministic.py")]],
  ["two readings, compared",     PY, [path.join(PYTESTS, "test_compare.py")]],
  ["the MCP server's contract", PY, [path.join(PYTESTS, "test_server.py")]],
  // That the server can be INSTALLED, not just run from here — every path that assumes a source
  // checkout works fine for us and for nobody else.
  ["the package carries what it serves", PY, [path.join(PYTESTS, "test_installable.py")]],
  // Unpetrify may be imported by Ipsissima and never the reverse -- what keeps it a package of
  // its own -- and it has a command, a server and a wheel of its own to hold to.
  ["unpetrify stands alone",     PY, [path.join(UNPTESTS, "test_standalone.py")]],
  ["unpetrify: command and server", PY, [path.join(UNPTESTS, "test_server.py")]],
  ["unpetrify: the package installs", PY, [path.join(UNPTESTS, "test_installable.py")]],
  ["reading Zotero safely",      PY, [path.join(PYTESTS, "test_zotero.py")]],
  ["the copies Zotero holds",    PY, [path.join(PYTESTS, "test_zotero_store.py")]],
  ["eval harness (gold self-test)", PY, [path.join(MCP, "eval", "eval_reconstruction.py"),
                                                "--self-test"]],
  ["the PDF probe",              PY, [path.join(MCP, "eval", "probe_pdf.py"), "--self-test"]],
  // The comparison only: a full run converts every PDF twice and is for a person to read.
  ["extraction regression (self-test)", PY, [path.join(MCP, "eval", "extraction_regression.py"), "--self-test"]],
  // The public fixtures against their approved outputs and their expectations: what a converter
  // change does to the five PDFs anyone can check, judged FIXED or BROKE. See docs/CORPUS.md.
  ["extraction regression (public fixtures)", PY, [path.join(MCP, "eval", "extraction_regression.py"), "--public"]],
  // Last, because it is the slow one and the only one that measures how the maps LOOK.
  ["map quality vs baseline",    "node", [path.join(HERE, "map_quality.mjs")]]
];

const argv = process.argv.slice(2);
const jobsAt = argv.indexOf("--jobs");
const JOBS = Math.max(1, Number(jobsAt >= 0 ? argv[jobsAt + 1] : process.env.IPS_TEST_JOBS) ||
                         (os.availableParallelism ? os.availableParallelism() : os.cpus().length));

/* HOW LONG EACH SUITE TAKES, in seconds, as measured on CI four at a time (run 44915561735, 21
 * Nov 2026); anything not named counts as 5. It decides two things, and only those: the slowest
 * start first -- started last, a long suite would begin after everything else had finished -- and
 * how `--shard` divides the list. A stale number costs minutes, never a check: whatever the
 * weights say, every suite lands in exactly one shard. */
const WEIGHT = new Map([
  ["fold invariants (state space)", 252],
  ["the mechanism and the appraisal", 195],
  ["the rendered map (browser): light, and the self-test", 177],
  ["the rendered map (browser): dark", 159],
  ["the rendered map (browser): feature checks, 1 of 2", 137],
  ["the rendered map (browser): feature checks, 2 of 2", 126],
  ["suppositions and contraposition", 118],
  ["the mechanism arrangement", 118],
  ["provenance: py vs js", 101],
  ["designed against the misreading", 96],
  ["the bundled Argdown parser", 67],
  ["the census, run twice", 50],
  ["fold state identifier (round-trip)", 47],
  ["the text's comparisons as tables", 44],
  ["the text's comparisons: frames and about (checker)", 41],
  ["extraction regression (public fixtures)", 29],
  ["reading checks (Stern cases)", 27],
  ["where to look, and the appraisal beside the map", 27],
  ["the MCP server's contract", 26],
  ["the served method holds to the registry", 25],
  ["on a phone and an upright iPad", 25],
  ["the editor checks a mechanism as the checker does", 19],
  ["map quality vs baseline", 14],
  ["the exports, read back", 12],
]);
const weight = name => WEIGHT.get(name) ?? 5;
/** Suite indices, heaviest first; ties keep this file's order. */
const BY_WEIGHT = SUITES.map((s, i) => i).sort((a, b) => weight(SUITES[b][0]) - weight(SUITES[a][0]) || a - b);

/* `--shard K/N`: RUN ONLY THE K-TH OF N PARTS, so CI can give each part a machine of its own
 * (.github/workflows/tests.yml). The parts are computed here, from this one list -- heaviest
 * first, each to whichever part has least so far -- so the N parts always cover every suite
 * exactly once, whatever N is and whatever is added. Nothing outside this file names a suite.
 * `--list-shards N` prints the division without running anything. */
function shardOf(n) {
  const load = new Array(n).fill(0), of = new Array(SUITES.length);
  for (const i of BY_WEIGHT) {
    let k = 0;
    for (let j = 1; j < n; j++) if (load[j] < load[k]) k = j;
    of[i] = k; load[k] += weight(SUITES[i][0]);
  }
  return { of, load };
}
const listAt = argv.indexOf("--list-shards");
if (listAt >= 0) {
  const n = Number(argv[listAt + 1]);
  const { of, load } = shardOf(n);
  for (let k = 0; k < n; k++) {
    console.log(`shard ${k + 1}/${n}, about ${load[k]}s:`);
    SUITES.forEach(([name], i) => { if (of[i] === k) console.log(`  ${name}`); });
  }
  process.exit(0);
}
const shardAt = argv.indexOf("--shard");
let SHARD = null;
if (shardAt >= 0) {
  const m = /^(\d+)\/(\d+)$/.exec(argv[shardAt + 1] || "");
  const k = m ? Number(m[1]) : 0, n = m ? Number(m[2]) : 0;
  if (!m || n < 1 || k < 1 || k > n) {
    console.log(`--shard wants K/N with 1 <= K <= N, e.g. --shard 2/3; got ${argv[shardAt + 1]}`);
    process.exit(2);
  }
  SHARD = { k, n, of: shardOf(n).of };
}
/** The suites this run is to run, as indices into SUITES. */
const MINE = SUITES.map((s, i) => i).filter(i => !SHARD || SHARD.of[i] === SHARD.k - 1);

/* NOTHING A TEST RUN DOES BELONGS IN THE CHECKER'S LEDGER. ~/.ipsissima/check-log.jsonl exists to
 * show which mistakes a reconstruction makes in a real fix loop; on 21 Nov 2026 21,859 of its
 * 54,343 lines were one test fixture. Forced off, not defaulted: a path set for real work in
 * the shell would otherwise collect the tests too. */
const ENV = { ...process.env, IPSISSIMA_CHECK_LOG: "off" };

/** Run one suite to completion, holding its output.
 *  @returns {Promise<{ok: boolean, out: string, secs: number}>} */
function runSuite(cmd, args) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const chunks = [];
    let child;
    try {
      child = spawn(cmd, args, { env: ENV, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolve({ ok: false, out: `could not start: ${e.message}\n`, secs: 0 });
      return;
    }
    child.stdout.on("data", c => chunks.push(c));
    child.stderr.on("data", c => chunks.push(c));
    child.on("error", e => chunks.push(Buffer.from(`could not start: ${e.message}\n`)));
    child.on("close", (code, signal) => resolve({
      ok: code === 0,
      out: Buffer.concat(chunks).toString("utf8") + (signal ? `\nkilled by ${signal}\n` : ""),
      secs: (Date.now() - t0) / 1000
    }));
  });
}

/** @type {({ok: boolean, out: string, secs: number}|undefined)[]} */
const done = new Array(SUITES.length);
let printed = 0;
/** Print every finished block that has no unfinished block before it. */
function flush() {
  while (printed < MINE.length && done[MINE[printed]]) {
    const i = MINE[printed];
    process.stdout.write(`\n${"=".repeat(72)}\n${SUITES[i][0]}\n${"=".repeat(72)}\n${done[i].out}`);
    printed++;
  }
}

const t0 = Date.now();
const queue = BY_WEIGHT.filter(i => MINE.includes(i));
const which = SHARD ? `shard ${SHARD.k} of ${SHARD.n}: ${MINE.length} of ${SUITES.length} suites` : `${SUITES.length} suites`;
console.log(`${which}, ${JOBS} at a time`);
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
  while (queue.length) {
    const i = queue.shift();
    const [, cmd, args] = SUITES[i];
    done[i] = await runSuite(cmd, args);
    flush();
  }
}));
flush();

const failed = MINE.filter(i => !done[i].ok).length;
console.log(`\n${"=".repeat(72)}`);
for (const i of MINE)
  console.log(`  ${done[i].ok ? "PASS" : "FAIL"}  ${SUITES[i][0]}  (${done[i].secs.toFixed(1)}s)`);
console.log(`\n${failed ? `${failed} suite(s) failed` : "everything passed"} ` +
            `in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${which}, ${JOBS} at a time\n`);
process.exit(failed ? 1 : 0);
