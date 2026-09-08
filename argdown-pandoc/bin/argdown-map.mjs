#!/usr/bin/env node
/* argdown-map — render an .argdown file to a standalone SVG, PNG, or PDF, drawn by the
 * Ipsissima viewer's own layout code at a chosen fold state. The LaTeX user's route:
 *
 *   argdown-map paper.argdown -o figures/map.pdf --fold "ipsfold1 map=6b2c91e4 view=arg depth=2"
 *   \includegraphics[width=\textwidth]{figures/map.pdf}
 *
 * USAGE
 *   argdown-map <input.argdown> [-o out.svg|out.png|out.pdf] [options]
 *
 * OPTIONS
 *   -o, --out FILE     output path; the extension picks the format (default: input.svg)
 *   --fold "ipsfold1…" a fold state identifier copied from the Ipsissima App; checked
 *                      against the map's fingerprint, so the wrong file fails loudly
 *   --depth N          depth rung (ignored when --fold is given)
 *   --folded g1,g2     fold these sections (ignored when --fold is given)
 *   --claims short     clip long claims as the App does on screen (default: full text,
 *                      because a picture has no "more" to click)
 *   --scale N          PNG only: device pixels per CSS pixel (default 2)
 *
 * Needs Playwright's Chromium:  npm install playwright && npx playwright install chromium
 */
import fs from "node:fs";
import path from "node:path";
import { buildGraph, foldOptions, renderSvg, svgToPng, svgToPdf, closeBrowser }
  from "../lib/render.mjs";

function usage(code) {
  const text = fs.readFileSync(new URL(import.meta.url), "utf8");
  process.stderr.write(text.split("*/")[0].split("\n").slice(1)
    .map(l => l.replace(/^ \*( |$)/, "")).join("\n") + "\n");
  process.exit(code);
}

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("-h") || argv.includes("--help")) usage(argv.length ? 0 : 1);

let input = null, out = null;
const attrs = {};
let scale = 2;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    if (i + 1 >= argv.length) { process.stderr.write(a + " needs a value\n"); process.exit(1); }
    return argv[++i];
  };
  if (a === "-o" || a === "--out") out = next();
  else if (a === "--fold") attrs.fold = next();
  else if (a === "--depth") attrs.depth = next();
  else if (a === "--folded") attrs.folded = next();
  else if (a === "--claims") attrs.claims = next();
  else if (a === "--scale") scale = Number(next()) || 2;
  else if (a.startsWith("-")) { process.stderr.write("unknown option " + a + "\n"); usage(1); }
  else if (!input) input = a;
  else { process.stderr.write("only one input file\n"); process.exit(1); }
}
if (!input) usage(1);
if (!fs.existsSync(input)) {
  process.stderr.write("cannot find " + input + "\n");
  process.exit(1);
}
if (!out) out = input.replace(/\.(argdown|ad)$/i, "") + ".svg";
const ext = path.extname(out).toLowerCase();
if (![".svg", ".png", ".pdf"].includes(ext)) {
  process.stderr.write("the output extension picks the format: .svg, .png, or .pdf\n");
  process.exit(1);
}

try {
  const graph = await buildGraph(fs.readFileSync(input, "utf8"));
  const opts = Object.assign(
    { allText: attrs.claims !== "short" }, foldOptions(graph, attrs));
  const svg = await renderSvg(graph, opts);
  if (ext === ".svg") fs.writeFileSync(out, svg);
  else if (ext === ".png") fs.writeFileSync(out, await svgToPng(svg, scale));
  else fs.writeFileSync(out, await svgToPdf(svg));
  process.stderr.write("wrote " + out + "\n");
} catch (err) {
  process.stderr.write("argdown-map: " +
    String(err && err.message || err).replace(/\x1b\[[0-9;]*m/g, "") + "\n");
  process.exitCode = 1;
} finally {
  await closeBrowser();
}
