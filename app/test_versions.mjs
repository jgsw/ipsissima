/** One release, one version number — stated in six files that nothing keeps in step.
 *
 *  WHY THIS MATTERS MORE ONCE UPDATES START. A version is not decoration here: it is what the
 *  About box reports when somebody files a bug, what an installer compares to decide whether it
 *  is replacing or downgrading, and what the .mcpb manifest tells Claude Desktop it is offering.
 *  Six places is five chances to bump some and not others, and every one of the resulting
 *  failures is quiet — an app that reports 0.1.0 while being 0.2.0 works perfectly and misleads
 *  the one person trying to reproduce a fault.
 *
 *  The tag is deliberately NOT checked. It does not exist yet when the version is bumped, and a
 *  test that fails until you have tagged is a test people learn to ignore.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const found = {
  // THE ONE THE READER SEES. `app/VERSION` is what the build stamps into the page and what the
  // About box reports, and it was missed when this test was first written — which the 0.1.1
  // release then demonstrated by shipping a page that called itself 0.1.0. A test that checks
  // five of six places is a test that says everything agrees when it does not.
  "app/VERSION":                           read("app/VERSION").trim(),
  "app/desktop/package.json":              JSON.parse(read("app/desktop/package.json")).version,
  "app/desktop/src-tauri/tauri.conf.json": JSON.parse(read("app/desktop/src-tauri/tauri.conf.json")).version,
  "app/desktop/src-tauri/Cargo.toml":      (read("app/desktop/src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m) || [])[1],
  "ipsissima-mcp/manifest.json":           JSON.parse(read("ipsissima-mcp/manifest.json")).version,
  "ipsissima-mcp/pyproject.toml":          (read("ipsissima-mcp/pyproject.toml").match(/^version\s*=\s*"([^"]+)"/m) || [])[1]
};

let fails = 0;
const versions = [...new Set(Object.values(found))];
for (const [f, v] of Object.entries(found)) {
  const ok = v && v === versions[0] && versions.length === 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${f.padEnd(40)} ${v || "(not found)"}`);
  if (!ok) fails++;
}

if (versions.length !== 1)
  console.log(`\n  ${versions.length} different versions in play: ${versions.join(", ")}` +
              "\n  A release is one version. Bump them all, or none.");

// Semver, because the updater story and the .mcpb manifest both assume it.
const bad = Object.entries(found).filter(([, v]) => v && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v));
for (const [f, v] of bad) { console.log(`  FAIL  ${f}: ${v} is not a semantic version`); fails++; }

console.log(fails ? `\n${fails} failure(s)`
                  : `\nall ${Object.keys(found).length} agree on ${versions[0]}`);
process.exit(fails ? 1 : 0);
