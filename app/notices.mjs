/** Third-party licence notices, assembled from what a build ACTUALLY bundled.
 *
 *  WHY THIS EXISTS. Every bundle this project makes is minified with `legalComments: "none"`,
 *  which strips the `@license` banners out — and MIT, BSD and Apache-2.0 all ask for their
 *  notice to travel with the copy. The single self-contained HTML file IS the distribution;
 *  there is no node_modules beside it for a recipient to consult. So the notices are put back,
 *  deliberately and in one place, instead of scattered through minified output.
 *
 *  THE LIST IS MEASURED, NOT WRITTEN. esbuild's metafile records every input file that reached
 *  a bundle; the packages are read out of that, and their licence texts out of the packages
 *  themselves. The same rule as the About page's dependency list: this cannot claim what the
 *  build does not carry, and it cannot silently omit what it does.
 *
 *  Deduplicated by licence TEXT, not by licence name: the lodash.* satellites all ship the one
 *  lodash licence, and the Apache-2.0 text is identical wherever it appears, so packages
 *  sharing a byte-identical text are listed together above one copy of it. Texts that differ
 *  only in the copyright line stay separate — the copyright line is the point.
 */
import fs from "fs";
import path from "path";

/** Package names (npm spelling, scope included) whose files reached a bundle. */
export function packagesFromMetafile(metafile, into) {
  const out = into || new Set();
  for (const f of Object.keys(metafile.inputs || {})) {
    const m = f.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (m) out.add(m[1]);
  }
  return out;
}

const LICENCE_FILES = [
  "LICENSE", "LICENSE.md", "LICENSE.txt", "LICENSE.markdown", "LICENSE-MIT",
  "LICENCE", "LICENCE.md", "LICENCE.txt",
  "license", "license.md", "license.txt", "License", "License.md"
];

function readLicenceFile(dir) {
  for (const name of LICENCE_FILES) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  }
  return null;
}

/** One entry per package: what it is, what it declares, and the text it ships. */
function packageEntry(name, nodeModulesDir) {
  const dir = path.join(nodeModulesDir, name);
  let version = "", declared = "";
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    version = pj.version || "";
    declared = typeof pj.license === "string" ? pj.license
             : pj.license && pj.license.type ? pj.license.type : "";
  } catch { /* listed anyway: absence of a manifest is itself worth seeing in the output */ }
  const text = readLicenceFile(dir);
  return { label: (name + " " + version).trim(), declared, text };
}

/** The assembled notices, as plain text.
 *
 *  @param {Set<string>|string[]} packages  npm package names that reached the bundle
 *  @param {string} nodeModulesDir          where to read them from
 *  @param {{label:string, declared?:string, text:string}[]} [extras]
 *         notices the metafile cannot see: a vendored font, a package inlined inside another
 *         package's own prebundle. Listed first, because each is here by explicit argument.
 *  @param {string} [heading]               what the copy these notices travel in IS
 */
export function noticesText(packages, nodeModulesDir, extras, heading) {
  const lines = [];
  lines.push("THIRD-PARTY NOTICES");
  lines.push("");
  lines.push(heading ||
    "This file bundles the packages below. Each remains under its own licence, " +
    "reproduced here so that the notice travels with every copy.");

  const rule = (t) =>
    "-".repeat(Math.min(72, Math.max(...t.split("\n").map((l) => l.length))));
  const block = (label, text) => {
    lines.push(""); lines.push(""); lines.push(label); lines.push(rule(label));
    lines.push(""); lines.push(text);
  };

  for (const e of extras || []) {
    block(e.label + (e.declared ? " — " + e.declared : ""), e.text.trim());
  }

  // Group by byte-identical licence text (whitespace normalised), so one shared text is
  // printed once under every package that ships it.
  const groups = new Map();  // normalised text -> { labels: [], text }
  const missing = [];
  const names = [...packages].sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const e = packageEntry(name, nodeModulesDir);
    if (!e.text) { missing.push(e); continue; }
    const key = e.text.replace(/\s+/g, " ");
    if (!groups.has(key)) groups.set(key, { labels: [], text: e.text });
    groups.get(key).labels.push(e.label + (e.declared ? " — " + e.declared : ""));
  }
  for (const g of groups.values()) {
    block(g.labels.join("\n"), g.text);
  }

  // A package that declares a licence but ships no text still gets named: silence here would
  // be the same gap this file exists to close.
  if (missing.length) {
    lines.push(""); lines.push("");
    lines.push("Declared but shipped without a licence file in the package:");
    for (const e of missing)
      lines.push("  " + e.label + " — " + (e.declared || "no licence declared"));
  }

  lines.push("");
  return lines.join("\n");
}
