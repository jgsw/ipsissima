#!/usr/bin/env node
/* install.mjs — build Ipsissima and put exactly one copy where the OS can find it.
 *
 * WHY THIS EXISTS RATHER THAN "drag it to Applications". Building a macOS app leaves a copy in
 * `target/release/bundle/macos/`, and building a .dmg mounts a disk image containing a second
 * one. LaunchServices registers what it sees. The result is two — sometimes three — Ipsissimas
 * known to the system at once, one of them on a volume that no longer exists, and no way to tell
 * from Spotlight which is which. That happened here, and the symptom was a double-clicked
 * .argdown opening nothing at all while `open -a` worked perfectly.
 *
 * So: build, remove every other registration, install one copy, register that. Afterwards the
 * app's own About page names the version it is, which is the other half of the same problem.
 *
 *   node install.mjs            build and install to ~/Applications
 *   node install.mjs --status   say what is registered, change nothing
 *   node install.mjs --uninstall  remove every copy, and what the app left under ~/Library
 *
 * ~/Applications rather than /Applications: no administrator password, same behaviour, and it is
 * a per-user tool.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { cargoPath } from "./rust-path.mjs";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LSR = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework" +
            "/Support/lsregister";
const BUILT = path.join(HERE, "src-tauri", "target", "release", "bundle", "macos", "Ipsissima.app");
const DEST = path.join(os.homedir(), "Applications", "Ipsissima.app");
const statusOnly = process.argv.includes("--status");
const uninstall = process.argv.includes("--uninstall");
// `--uninstall --dry-run` says what would go and touches nothing. Worth having for its own
// sake -- this is the one mode here that destroys things -- and it is how the mode is tested.
const dryRun = process.argv.includes("--dry-run");

if (process.platform !== "darwin") {
  console.error("install.mjs is macOS-only. On Windows and Linux the installer produced by " +
                "`npm run build` registers the file association itself.");
  process.exit(1);
}

/** Every Ipsissima.app LaunchServices currently knows about. */
function registered() {
  let dump = "";
  try { dump = execFileSync(LSR, ["-dump"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }); }
  catch { return []; }
  const found = new Set();
  for (const line of dump.split("\n")) {
    const m = /^\s*path:\s+(\S.*Ipsissima\.app)\s*(?:\(0x[0-9a-f]+\))?\s*$/.exec(line);
    if (m) found.add(m[1].replace(/\s+\(0x[0-9a-f]+\)$/, ""));
  }
  return [...found];
}

function report(label) {
  const all = registered();
  console.log(`${label}: ${all.length} registration(s)`);
  for (const p of all)
    console.log(`   ${fs.existsSync(p) ? "  " : "!!"} ${p}${fs.existsSync(p) ? "" : "   (MISSING)"}`);
  return all;
}

/** Everything the app writes outside its own bundle. Not the reader's reconstructions: those are
 *  ordinary files wherever they chose to keep them, and an uninstaller that went looking for
 *  `.argdown` files to delete would be a different and much worse program. */
const LEFTOVERS = [
  path.join(os.homedir(), "Library", "Caches", "org.ipsissima.desktop"),
  path.join(os.homedir(), "Library", "WebKit", "org.ipsissima.desktop"),
  path.join(os.homedir(), "Library", "Preferences", "org.ipsissima.desktop.plist"),
  path.join(os.homedir(), "Library", "Saved Application State",
            "org.ipsissima.desktop.savedState"),
  path.join(os.homedir(), "Library", "HTTPStorages", "org.ipsissima.desktop")
];

if (uninstall) {
  // TO THE TRASH, NOT DELETED. An app removed by a script is an app the reader cannot get back
  // if this was a mistake, and there is no version of "uninstall" urgent enough to justify that.
  const trash = path.join(os.homedir(), ".Trash");
  let moved = 0;
  for (const app of registered()) {
    if (!fs.existsSync(app)) continue;
    // The build output is a build artifact and belongs in neither place; `tauri build` remakes it.
    if (app === BUILT) {
      console.log(`  ${dryRun ? "would delete (build artifact):" : "deleted (build artifact):"} ${app}`);
      if (!dryRun) fs.rmSync(app, { recursive: true, force: true });
      moved++; continue;
    }
    let dest = path.join(trash, path.basename(app));
    for (let n = 2; fs.existsSync(dest); n++) dest = path.join(trash, `Ipsissima ${n}.app`);
    try {
      console.log(`  ${dryRun ? "would move to Trash:" : "to Trash:"} ${app}`);
      if (!dryRun) fs.renameSync(app, dest);
      moved++;
    }
    catch (e) {
      // /Applications needs a password this script has no business asking for.
      console.log(`  could NOT remove ${app}\n            ${e.code === "EACCES" || e.code === "EPERM"
        ? "no permission — drag it to the Trash in Finder" : e.message}`);
    }
  }
  for (const l of LEFTOVERS)
    if (fs.existsSync(l)) {
      console.log(`  ${dryRun ? "would remove:" : "removed: "} ${l.replace(os.homedir(), "~")}`);
      if (!dryRun) fs.rmSync(l, { recursive: true, force: true });
    }
  if (!dryRun)
    for (const p2 of registered())
      try { execFileSync(LSR, ["-u", p2], { stdio: "ignore" }); } catch { /* already gone */ }

  console.log(moved
    ? `\n${dryRun ? "would remove" : "removed"} ${moved} cop${moved === 1 ? "y" : "ies"}.`
      + (dryRun ? " Run again without --dry-run to do it." : "")
    : "\nnothing to remove.");
  console.log("Your reconstructions are untouched — they are ordinary files and were never " +
              "kept inside the app.");
  process.exit(0);
}

if (statusOnly) {
  const all = report("registered");
  if (all.length > 1) console.log("\nMore than one. Run `node install.mjs` to collapse them to one.");
  process.exit(0);
}

// 0. A RUNNING COPY MUST GO FIRST, and this is not tidiness.
//
//    The app is single-instance, because file associations do not respect one — on Windows every
//    double-click spawns a fresh process, and without the plugin three reconstructions would give
//    three copies of Ipsissima. The cost is that `open -a Ipsissima file.argdown` against an
//    already-running copy hands the file to THAT copy and exits. So after installing a new build
//    over an old one, opening a file goes to the old binary still resident in memory: the reader
//    tests their change, sees the previous behaviour, and concludes the build did nothing.
//
//    Measured here, and it cost twenty minutes: a copy that had been running for 21 hours
//    answered a launch meant for a build two minutes old.
if (!statusOnly) {
  let running = "";
  try { running = execFileSync("/usr/bin/pgrep", ["-x", "ipsissima"], { encoding: "utf8" }).trim(); }
  catch { /* pgrep exits 1 when nothing matches, which is the ordinary case */ }
  if (running) {
    console.error("Ipsissima is running. Quitting it, so the new build is what opens next.");
    // Ask politely first — an unsaved reconstruction is the reader's work, and `quit` gives the
    // window the chance to object. Only then insist.
    try {
      execFileSync("/usr/bin/osascript",
                   ["-e", 'tell application id "org.ipsissima.desktop" to quit'],
                   { stdio: "ignore" });
    } catch { /* not scriptable, or already gone */ }
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      try { execFileSync("/usr/bin/pgrep", ["-x", "ipsissima"], { stdio: "ignore" }); }
      catch { running = ""; break; }
      execFileSync("/bin/sleep", ["0.25"]);
    }
    if (running) {
      console.error("It did not quit — it may be asking about unsaved changes. Answer that " +
                    "window, then run this again.");
      process.exit(1);
    }
  }
}

// 1. Build. The frontend is staged first, because the whole application is that page.
console.error("building…");
execFileSync("node", [path.join(HERE, "build_desktop.mjs")], { stdio: ["ignore", "ignore", "inherit"] });
execFileSync(path.join(HERE, "node_modules", ".bin", "tauri"), ["build", "--bundles", "app"],
             { cwd: HERE, stdio: ["ignore", "ignore", "inherit"],
               env: { ...process.env, PATH: cargoPath() } });
if (!fs.existsSync(BUILT)) throw new Error("the build produced no .app at " + BUILT);

// The scratch image Tauri leaves behind after bundling a .dmg registers too, and outlives the
// volume it describes.
const bundleDir = path.dirname(BUILT);
for (const f of fs.readdirSync(bundleDir))
  if (/^rw\..*\.dmg$/.test(f)) fs.rmSync(path.join(bundleDir, f), { force: true });

// 2. Install one copy, and register it.
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(BUILT, DEST, { recursive: true });
execFileSync(LSR, ["-f", "-R", DEST], { stdio: "ignore" });

// 3. DELETE the copy in target/, rather than merely unregistering it.
//    macOS registers a .app as soon as one appears on disk, and re-registers it afterwards on
//    its own — unregistering the build output simply loses a race with Spotlight, which is how
//    two Ipsissimas kept reappearing in search. A build artifact that is not on disk cannot be
//    registered, and `tauri build` recreates it whenever it is next needed.
fs.rmSync(BUILT, { recursive: true, force: true });
for (const p of registered()) {
  if (p === DEST) continue;
  try { execFileSync(LSR, ["-u", p], { stdio: "ignore" }); } catch { /* already gone */ }
}

const version = JSON.parse(fs.readFileSync(path.join(HERE, "src-tauri", "tauri.conf.json"), "utf8")).version;
console.log(`\ninstalled Ipsissima ${version} to ${DEST}`);
const all = report("registered");
if (all.length !== 1)
  console.log("\n! Expected exactly one. Run `node install.mjs --status` after a moment; " +
              "LaunchServices sometimes lags.");
