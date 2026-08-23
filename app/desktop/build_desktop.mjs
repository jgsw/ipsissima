#!/usr/bin/env node
/* build_desktop.mjs — put the application into the shell.
 *
 * THE APP IS THE HTML FILE. Everything Ipsissima does lives in the single self-contained page
 * that `build_argdown_viewer.mjs --standalone --editor` produces; the Tauri crate beside this is
 * a window and an "open with" handler. So the desktop build is not a separate build: it is the
 * same build, copied into `dist/` where Tauri expects a frontend.
 *
 * Doing it this way rather than pointing `frontendDist` straight at the workspace root is worth
 * the copy. Tauri hashes and packages whatever is in `frontendDist`; aiming that at a directory
 * holding the author's papers would sweep them into the .app.
 *
 *   node build_desktop.mjs            rebuild the page, then stage it
 *   node build_desktop.mjs --stage    stage whatever was built last, without rebuilding
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const BUILDER = path.join(TOOLS, "build_argdown_viewer.mjs");
const DIST = path.join(HERE, "dist");
const PAGE = path.join(DIST, "index.html");

const stageOnly = process.argv.includes("--stage");

fs.mkdirSync(DIST, { recursive: true });

if (!stageOnly) {
  // Built straight into dist, so the staged page cannot drift from the one just compiled — and
  // so a failed build leaves the previous dist untouched rather than half-written.
  execFileSync("node", [BUILDER, "--standalone", "--editor", "-o", PAGE],
               { stdio: ["ignore", "ignore", "inherit"] });
} else if (!fs.existsSync(PAGE)) {
  console.error("nothing staged yet — run without --stage first");
  process.exit(1);
}

// ONE VERSION NUMBER, kept in one file. The page reads `argdown-tools/VERSION` at build time
// for its About panel; the app bundle reads tauri.conf.json. Syncing them here means the version
// the About page reports and the version the installer stamps cannot disagree — which they
// silently would, and the About page exists precisely to answer "which build is this".
const VERSION = fs.readFileSync(path.join(TOOLS, "VERSION"), "utf8").trim();
const confPath = path.join(HERE, "src-tauri", "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
if (conf.version !== VERSION) {
  conf.version = VERSION;
  fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
  console.error(`  tauri.conf.json version synced to ${VERSION}`);
}

const kb = Math.round(fs.statSync(PAGE).size / 1024);
const html = fs.readFileSync(PAGE, "utf8");

// THE CHECKS THAT MATTER, run here because the failure they catch is silent: a shell whose
// frontend loads but cannot reach the host looks exactly like a working app until someone
// presses Save. Each of these has to be in the page for the desktop build to be worth shipping.
// Matched on the builder's own section labels rather than on `window.X =`: these modules
// publish through the IIFE's `global` parameter, so the literal `window.ArgdownHost` never
// appears in the file and checking for it fails on a page that is perfectly correct.
const need = [
  ["the host adapter", /<!-- argdown-host\.js -->/],
  ["the bundle format", /<!-- argdown-bundle\.js -->/],
  ["the editor", /data-part="EDITOR"/],
  ["the parser", /data-part="PARSER"/],
  ["the page template, for exporting a copy", /data-part="SHELL"/]
];
const missing = need.filter(([, re]) => !(/** @type {RegExp} */ (re)).test(html))
                    .map(([what]) => what);
if (missing.length) {
  console.error(`  the staged page is missing: ${missing.join(", ")}`);
  console.error("  the desktop shell would open and then fail at the first file operation.");
  process.exit(1);
}

console.error(`staged dist/index.html (${kb} KB) — host adapter, parser, editor and exporter all present`);
