#!/usr/bin/env node
/* rebuild_viewers.mjs — rebuild every built map, or say which ones are stale.
 *
 *   node app/rebuild_viewers.mjs [--check]
 *
 * WHY THIS EXISTS. A per-file viewer BAKES THE RENDERER IN at build time, so every one of them
 * goes stale the moment `argdown-live-map.js` changes, and says nothing about it: the page opens,
 * the map draws, and it draws the old way. After the arrowhead fix I rebuilt the maps I happened
 * to be looking at — the three in `Argdown samples/` and the standalone — and missed three
 * others, including the author's own book. The instruction "rebuild every viewer" was already
 * written down; what was missing was any way to enumerate them.
 *
 * So this looks for them rather than remembering them: every `.argdown` under the search roots
 * that has a built `(map).html` beside it, plus the standalone. `--source-root` is ALWAYS
 * passed, because without it the Manuscript view is silently absent.
 *
 * The book's `_structure.html` used to be rebuilt here too. It is retired: the argument map and
 * this renderer between them do everything it did, and its one remaining contribution — word
 * counts per file and per section — is now computed by the builder and drawn on the bands of
 * the by-position view, where it sits beside the claims it is a count of.
 *
 * `--check` reports staleness and changes nothing; use it before sharing anything.
 *
 * WHAT IT REBUILDS BY DEFAULT CHANGED 22 Aug 2026. Testing now happens in the desktop app, which
 * opens .argdown files and folders directly, so the per-file `(map).html` artifacts no longer
 * need regenerating on every change — rebuilding eleven of them to look at one was most of the
 * wall-clock time of a change to the renderer.
 *
 *   (no flags)   the two standalone builds, and the desktop app's staged frontend
 *   --maps       the per-file sample maps as well
 *   --check      report staleness of everything, rebuild nothing
 *
 * `--check` still covers the per-file maps, because the reason they were enumerated in the first
 * place has not gone away: a stale one opens, draws, and says nothing.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const RENDERER = path.join(HERE, "src", "argdown-live-map.js");
// EVERY INPUT THAT GETS BAKED IN, not just the renderer. A built map carries the template and
// the shared modules as well, and a change to any of them stales it exactly as a renderer change
// does -- silently, because the page still opens and still draws. Adding bundle support to the
// template made all of them stale and `--check` said they were fresh, which is the same failure
// this script was written to stop, one level up.
const INPUTS = [RENDERER,
                path.join(HERE, "argdown-viewer.template.html"),
                path.join(HERE, "src", "argdown-positions.js"),
                path.join(HERE, "src", "argdown-bundle.js"),
                path.join(HERE, "src", "argdown-exposition.js")];
const BUILDER = path.join(HERE, "build_argdown_viewer.mjs");

// Where reconstructions live. The published samples, plus whatever private corpus the user
// points at: set IPSISSIMA_CORPUS to a folder of your own reconstructions and they are rebuilt
// alongside. Test fixtures are excluded by directory, not by name: `t/` and `test/` hold
// single-construct files that have no viewer and never should.
const ROOTS = [path.join(REPO, "samples"),
               ...(process.env.IPSISSIMA_CORPUS ? [process.env.IPSISSIMA_CORPUS] : [])];
const SKIP = new Set(["node_modules", "Old versions", ".argument-history", "t", "test", "dot"]);

const check = process.argv.includes("--check");
const withMaps = process.argv.includes("--maps");
const rendered = Math.max(...INPUTS.map(f => fs.statSync(f).mtimeMs));

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith(".argdown")) out.push(path.join(dir, e.name));
  }
  return out;
}

const jobs = [];
for (const root of ROOTS) {
  for (const src of walk(root)) {
    const built = path.join(path.dirname(src),
                            path.basename(src, ".argdown") + " (map).html");
    if (!fs.existsSync(built)) continue;           // never built one; not this tool's business
    // ALWAYS PASS `--source-root`. This used to be conditional on a `_quarto.yml` sitting
    // beside the source — and when project files became OPTIONAL, every folder without one
    // silently lost its Manuscript view and its source-backed features on the next rebuild. Three
    // of the seven sample maps were stripped that way, and nothing said so: the build reported
    // success, and the tabs were simply gone from the page.
    //
    // The builder now derives reading order itself when no project file is present, and handles
    // missing sources by reporting how many claims could not be placed. So there is nothing
    // left for this script to decide, and deciding it was the bug.
    jobs.push({ src, built, sourceRoot: path.dirname(src) });
  }
}

let stale = 0;
for (const j of jobs) {
  const old = fs.statSync(j.built).mtimeMs < rendered;
  if (old) stale++;
  const label = old ? "STALE" : "fresh";
  if (check) {
    console.log(`  ${label}  ${path.basename(j.built)}`);
    continue;
  }
  if (!withMaps) continue;          // pass --maps to regenerate these
  const args = [BUILDER, j.src, ...(j.sourceRoot ? ["--source-root", j.sourceRoot] : [])];
  try {
    execFileSync("node", args, { stdio: "pipe" });
    console.log(`  rebuilt  ${path.basename(j.built)}`);
  } catch (e) {
    console.log(`  FAILED   ${path.basename(j.built)}\n           ${String(e.stderr || e).trim().split("\n")[0]}`);
  }
}

// The standalone bundles the renderer through esbuild.
if (!check) {
  execFileSync("node", [BUILDER, "--standalone"], { stdio: "pipe" });
  console.log("  rebuilt  Ipsissima Reader.html (standalone)");
  // The editing build is the same template and the same renderer with CodeMirror added, so it
  // goes stale for exactly the same reasons and has to be rebuilt alongside.
  execFileSync("node", [BUILDER, "--standalone", "--editor",
                        "-o", path.join(REPO, "Ipsissima.html")], { stdio: "pipe" });
  console.log("  rebuilt  Ipsissima.html (standalone + editor)");
  // The desktop app's frontend is the same page again, staged where Tauri reads it. Staging is
  // cheap and keeps `npm run build` in desktop/ from ever compiling an older page than this one.
  try {
    execFileSync("node", [path.join(HERE, "desktop", "build_desktop.mjs")], { stdio: "pipe" });
    console.log("  staged   desktop/dist/index.html (run `npm run build` in desktop/ to package)");
  } catch (e) {
    console.log("  SKIPPED  desktop/dist — " + String(e.stderr || e).trim().split("\n")[0]);
  }
  const n = (withMaps ? jobs.length : 0) + 2;
  console.log(`\n${n} built artifact(s) now carry the current renderer` +
              (withMaps ? "." : `; ${jobs.length} per-file map(s) left alone (--maps to include them).`));
} else {
  console.log(`\n${stale} of ${jobs.length} per-file viewer(s) are older than what built them.`);
  process.exit(stale ? 1 : 0);
}
