#!/usr/bin/env node
/* Copies the renderer out of app/ into vendor/, so the published package is self-contained
 * while the repo keeps ONE copy of the truth. Run by `npm run sync-vendor` and automatically
 * by `prepack`, and the copies are committed — a fresh clone works without running anything.
 *
 * The header stamped on each copy says where it came from and that it is not the file to
 * edit. If app/ is missing (an unpacked npm tarball), this is a no-op: the tarball already
 * carries the copies it was packed with.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..", "app");
// The two classic scripts become .cjs: this package is "type": "module", and require() of
// a .js under it would be treated as ESM — the IIFE's `module.exports` would silently never
// run. The content is untouched; the same bytes are also inlined into pages as <script>.
const FILES = [
  ["argdown-graph.mjs", "argdown-graph.mjs"],
  [path.join("src", "argdown-live-map.js"), "argdown-live-map.cjs"],
  [path.join("src", "argdown-staircase.js"), "argdown-staircase.cjs"],
];

if (!fs.existsSync(APP)) {
  console.log("sync-vendor: no ../app here (unpacked tarball?) — keeping the vendored copies as they are.");
  process.exit(0);
}

fs.mkdirSync(path.join(HERE, "vendor"), { recursive: true });
for (const [src, dst] of FILES) {
  const from = path.join(APP, src);
  const text = fs.readFileSync(from, "utf8");
  const stamp = dst.endsWith(".mjs")
    ? `// VENDORED COPY of app/${src.replace(/\\/g, "/")} — edit the original, then \`npm run sync-vendor\`.\n`
    : `/* VENDORED COPY of app/${src.replace(/\\/g, "/")} — edit the original, then \`npm run sync-vendor\`. */\n`;
  fs.writeFileSync(path.join(HERE, "vendor", dst), stamp + text);
  console.log("  vendored", dst);
}
