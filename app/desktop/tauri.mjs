#!/usr/bin/env node
/** The Tauri CLI, run with a PATH that has Rust on it.
 *
 *  `npm run build` is what the README tells a reader to type, and on a machine whose Rust came
 *  from Homebrew it failed — rustup is keg-only, so `cargo` is not on a plain PATH. The fix
 *  already existed in install.mjs and was not reachable from npm. This is the shim that makes
 *  the documented command the working one.
 *
 *  Arguments are passed straight through: `node tauri.mjs build`, `node tauri.mjs dev`.
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { cargoPath, haveCargo } from "./rust-path.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

if (!haveCargo()) {
  console.error(
    "\nNo Rust toolchain found, so the desktop application cannot be built.\n\n" +
    "  macOS:  brew install rustup && rustup-init\n" +
    "  or:     https://rustup.rs\n\n" +
    "Homebrew's rustup is keg-only — it does not put `cargo` on your PATH, and this script\n" +
    "looks in /opt/homebrew/opt/rustup/bin for it. If yours is somewhere else, add it to PATH.\n\n" +
    "The web build needs none of this: `node ../rebuild_viewers.mjs` gives you Ipsissima.html.\n");
  process.exit(1);
}

const r = spawnSync(path.join(HERE, "node_modules", ".bin", "tauri"), process.argv.slice(2), {
  cwd: HERE, stdio: "inherit",
  env: { ...process.env, PATH: cargoPath() },
});
process.exit(r.status == null ? 1 : r.status);
