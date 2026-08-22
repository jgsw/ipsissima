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
 *
 * ~/Applications rather than /Applications: no administrator password, same behaviour, and it is
 * a per-user tool.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LSR = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework" +
            "/Support/lsregister";
const BUILT = path.join(HERE, "src-tauri", "target", "release", "bundle", "macos", "Ipsissima.app");
const DEST = path.join(os.homedir(), "Applications", "Ipsissima.app");
const statusOnly = process.argv.includes("--status");

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

if (statusOnly) {
  const all = report("registered");
  if (all.length > 1) console.log("\nMore than one. Run `node install.mjs` to collapse them to one.");
  process.exit(0);
}

/** PATH with a Rust toolchain on it, wherever this machine keeps one.
 *
 *  Homebrew's `rustup` is KEG-ONLY: it installs to /opt/homebrew/opt/rustup/bin and is
 *  deliberately not linked, so `cargo` is missing from a plain shell and `tauri build` fails
 *  with "program not found" on a machine that has Rust perfectly well installed. Both the usual
 *  locations are added when they exist, and nothing is assumed about which one a reader has. */
function cargoPath() {
  const extra = [path.join(os.homedir(), ".cargo", "bin"),
                 "/opt/homebrew/opt/rustup/bin",
                 "/usr/local/opt/rustup/bin"].filter(p => fs.existsSync(p));
  return [...extra, process.env.PATH].join(path.delimiter);
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
