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
import { createRequire } from "module";
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

// THE ICON SET IS GENERATED, and a fresh clone does not have it. Only icons/source.png is
// tracked (see .gitignore); `tauri::generate_context!` opens icons/32x32.png at macro
// expansion, so on a machine that has never run `tauri icon` the build dies inside a proc
// macro — "failed to open icon" — before compiling a line of Rust. The release workflow found
// this on the first tag ever cut; this is the same fix for everyone else's first build. Run
// through tauri.mjs, which knows `icon` is image processing and demands no cargo for it.
const ICONS = path.join(HERE, "src-tauri", "icons");
if (!fs.existsSync(path.join(ICONS, "32x32.png"))) {
  // NOT WHEN THE CLI ISN'T HERE. rebuild_viewers.mjs stages through this script on machines
  // that never ran `npm install` in desktop/ — the web build's whole point is needing none of
  // this — and staging must not start failing for them over an icon set only `tauri build`
  // reads. Whoever lacks the CLI cannot reach the proc-macro panic either: tauri.mjs dies on
  // the same missing module first, and its error names the fix.
  let haveCli = true;
  try { createRequire(import.meta.url).resolve("@tauri-apps/cli/tauri.js"); }
  catch { haveCli = false; }
  if (haveCli) {
    console.error("  regenerating the platform icon set from icons/source.png…");
    execFileSync(process.execPath,
                 [path.join(HERE, "tauri.mjs"), "icon", "src-tauri/icons/source.png",
                  "-o", "src-tauri/icons"],
                 { stdio: ["ignore", "ignore", "inherit"] });
    // The android/ and ios/ trees the CLI insists on writing go straight back out. There are no
    // mobile targets, and they are the one output .gitignore does not cover — `icons/*.png` does
    // not reach into subdirectories, so leaving them puts thirty-five untracked files in git status.
    for (const mobile of ["android", "ios"])
      fs.rmSync(path.join(ICONS, mobile), { recursive: true, force: true });
  } else {
    console.error("  icon set not regenerated — no @tauri-apps/cli here (`npm install` in " +
                  "desktop/ first); only `tauri build` needs it");
  }
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
