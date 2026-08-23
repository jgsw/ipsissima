#!/usr/bin/env node
/* run_all_tests.mjs — every check, one command.
 *
 *   node app/run_all_tests.mjs
 *
 * Run this before sharing the tooling, and after any change to the renderer, the fold logic or
 * the provenance rules. Each suite is independent and each prints its own detail; this reports
 * which passed and exits non-zero if any did not.
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(HERE, "src");
const MCP = path.resolve(HERE, "..", "ipsissima-mcp");
const PYSRC = path.join(MCP, "src", "ipsissima_mcp");
const PYTESTS = path.join(MCP, "tests");

const SUITES = [
  ["fold logic (fixtures)",      "node", [path.join(BUILD, "test_argdown_live_map.js")]],
  ["edge direction (arrowheads)", "node", [path.join(BUILD, "test_edge_direction.js")]],
  ["re-seat vs edge routes",     "node", [path.join(BUILD, "test_reseat_edges.js")]],
  ["fold invariants (state space)", "node", [path.join(HERE, "test_fold_invariants.mjs"), "--steps", "1500"]],
  ["layout geometry (adversarial)", "node", [path.join(HERE, "test_layout_geometry.mjs"), "--cases", "80"]],
  ["provenance: py vs js",       "node", [path.join(HERE, "test_argdown_positions.mjs")]],
  ["source pane cleanup",        "node", [path.join(HERE, "test_source_pane.mjs")]],
  ["annotated export (docx/md)", "node", [path.join(HERE, "test_export.mjs")]],
  ["the one-file bundle",        "node", [path.join(HERE, "test_bundle.mjs")]],
  ["the desktop host adapter",   "node", [path.join(HERE, "test_host.mjs")]],
  ["the shape of the text",      "node", [path.join(HERE, "test_exposition.mjs")]],
  ["page geometry (converter)",  "python3", [path.join(PYTESTS, "test_pdf_to_source.py")]],
  ["provenance defaults",        "python3", [path.join(PYTESTS, "test_provenance_defaults.py")]],
  ["reading checks (Stern cases)", "python3", [path.join(PYTESTS, "test_reading_checks.py")]],
  ["eval harness (gold self-test)", "python3", [path.join(MCP, "eval", "eval_reconstruction.py"),
                                                "--self-test"]],
  // Last, because it is the slow one and the only one that measures how the maps LOOK.
  ["map quality vs baseline",    "node", [path.join(HERE, "map_quality.mjs")]]
];

let failed = 0;
const results = [];
for (const [name, cmd, args] of SUITES) {
  process.stdout.write(`\n${"=".repeat(72)}\n${name}\n${"=".repeat(72)}\n`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push([name, ok]);
}

console.log(`\n${"=".repeat(72)}`);
for (const [name, ok] of results) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(failed ? `\n${failed} suite(s) failed\n` : "\neverything passed\n");
process.exit(failed ? 1 : 0);
