/** PATH with a Rust toolchain on it, wherever this machine keeps one.
 *
 *  Homebrew's `rustup` is KEG-ONLY: it installs to /opt/homebrew/opt/rustup/bin and is
 *  deliberately not linked, so `cargo` is missing from a plain shell and `tauri build` fails
 *  with "failed to run `cargo metadata`… No such file or directory" on a machine that has Rust
 *  perfectly well installed. Both the usual locations are added when they exist, and nothing is
 *  assumed about which one a reader has.
 *
 *  ONE COPY, TWO CALLERS. `install.mjs` worked around this and `npm run build` did not — so the
 *  command the README gives failed on the very machine the other command succeeded on. That is
 *  the sort of difference that reads as "the build is broken" to someone who has just cloned it.
 */
import fs from "fs";
import os from "os";
import path from "path";

export function cargoPath() {
  const extra = [path.join(os.homedir(), ".cargo", "bin"),
                 "/opt/homebrew/opt/rustup/bin",
                 "/usr/local/opt/rustup/bin"].filter(p => fs.existsSync(p));
  return [...extra, process.env.PATH].join(path.delimiter);
}

/** True when a `cargo` can actually be found on that PATH. Checked before a build rather than
 *  after twenty seconds of frontend bundling, and reported as the one thing to install. */
export function haveCargo() {
  const dirs = cargoPath().split(path.delimiter);
  return dirs.some(d => {
    try { return fs.existsSync(path.join(d, "cargo")); } catch { return false; }
  });
}
