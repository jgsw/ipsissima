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
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { cargoPath, haveCargo } from "./rust-path.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The subcommands that actually invoke the Rust compiler.
 *
 *  NOT EVERYTHING NEEDS CARGO, and gating the lot behind it broke the release: the workflow
 *  generates the icon set with `tauri icon`, which is image processing and touches no Rust at
 *  all, and it was refused on a runner whose only fault was that this script could not see the
 *  toolchain. Refuse late and only for the commands that would really fail.
 */
const NEEDS_RUST = new Set(["build", "dev", "android", "ios", "bundle"]);
const sub = process.argv.slice(2).find(a => !a.startsWith("-"));

if (NEEDS_RUST.has(sub) && !haveCargo()) {
  console.error(
    "\nNo Rust toolchain found, so the desktop application cannot be built.\n\n" +
    "  macOS:  brew install rustup && rustup-init\n" +
    "  or:     https://rustup.rs\n\n" +
    "Homebrew's rustup is keg-only — it does not put `cargo` on your PATH, and this script\n" +
    "looks in /opt/homebrew/opt/rustup/bin for it. If yours is somewhere else, add it to PATH.\n\n" +
    "The web build needs none of this: `node ../rebuild_viewers.mjs` gives you Ipsissima.html.\n");
  process.exit(1);
}

// THE CLI'S OWN JS, not the `.bin` shim, and for the same reason the frontend build stopped
// using one: `node_modules/.bin/tauri` does not exist on Windows -- npm writes `tauri.cmd`
// there -- and Node will not `spawnSync` a `.cmd` anyway since the CVE-2024-27980 hardening.
// `@tauri-apps/cli` ships `tauri.js` as its bin, so running that with this same Node is the
// one spelling that means the same thing on all three platforms.
const cli = createRequire(import.meta.url).resolve("@tauri-apps/cli/tauri.js");
const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: HERE, stdio: "inherit",
  env: { ...process.env, PATH: cargoPath() },
});
process.exit(r.status == null ? 1 : r.status);
