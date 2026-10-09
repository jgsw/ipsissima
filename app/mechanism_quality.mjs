#!/usr/bin/env node
/* SPDX-License-Identifier: MIT */
/* mechanism_quality.mjs — hold the Mechanism chart to its rules, on every chain of every map.
 *
 *   node app/mechanism_quality.mjs                 # fixtures and public samples: table, breaches, baseline
 *   node app/mechanism_quality.mjs --dir FOLDER    # any folder of maps as well (the private research corpus)
 *   node app/mechanism_quality.mjs --baseline      # record the soft numbers as they are now
 *   node app/mechanism_quality.mjs --list          # every hard breach, not just the count
 *
 * The rules are docs/MECHANISM-LAYOUT.md. Each map is drawn every way a reader can draw it: each
 * chain, and every chain together; the text's own boxes and every state, where it has boxes; as it
 * opens and folded to its ends; and with every cut label opened. `audit` in
 * src/argdown-mechanism.js measures each picture from the geometry the drawing draws.
 *
 * Hard breaches fail the run. Soft numbers are compared with mechanism-quality-baseline.json and
 * fail it only when materially worse; re-record with --baseline after a deliberate change.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const MV = createRequire(import.meta.url)(path.join(HERE, "src", "argdown-mechanism.js"));
const BASELINE = path.join(HERE, "mechanism-quality-baseline.json");
const argv = process.argv.slice(2);
const dirs = [path.join(REPO, "ipsissima-mcp", "tests", "mechanism"), path.join(REPO, "samples")];
for (let i = 0; i < argv.length; i++) if (argv[i] === "--dir") dirs.push(path.resolve(argv[++i]));

const SKIP = new Set(["node_modules", "Old versions", ".argument-history", "gap-tests", "mechanism-trials", "mechanism-spike", "diagrams"]);
function findMaps(dir) {
  const out = [];
  const walk = d => {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); }
      else if (e.name.endsWith(".argdown")) out.push(path.join(d, e.name));
    }
  };
  walk(dir);
  return out.sort();
}

/** Every way a reader can draw this map's chain, as [name, model, layout options]. */
function pictures(FULL) {
  const out = [];
  const chains = (FULL.chains || []).map(c => c.id);
  // THE CHAINS THAT MEET, together: the whole map where they all meet, each group of them otherwise
  // (James's principle, 8 Oct 2026). A chain that meets none is drawn only on its own.
  const groups = chains.length ? MV.chainGroups(FULL).filter(g => g.length > 1) : [];
  const together = groups.length === 1 && groups[0].length === chains.length ? [["every chain", FULL]]
    : groups.map(g => ["together: " + g.join("+"), MV.groupModel(FULL, g)]);
  const bases = chains.length ? [...chains.map(id => [id, MV.chainModel(FULL, id)]), ...together] : [["", FULL]];
  const hasWholes = FULL.profile.wholes.length > 0;
  for (const [cname, base] of bases) {
    for (const boxes of hasWholes ? [true, false] : [false]) {
      // The text's own boxes are compartments (9 Oct 2026): the parts drawn inside their wholes.
      const M = base;
      const spec = MV.markSpec(FULL, M), marks = spec.marks, centres = spec.centres, compartments = boxes;
      const tag = [cname, boxes ? "boxes" : ""].filter(Boolean).join(", ");
      out.push([tag || "the chain", M, { marks, centres, compartments }]);
      const toEnds = MV.foldable(M, "text");
      const hasEnds = M.ids.some(v => /intervention|condition/.test(JSON.stringify(M.states[v].role || ""))) &&
                      M.ids.some(v => /outcome/.test(JSON.stringify(M.states[v].role || "")));
      if (toEnds.length && hasEnds)
        out.push([(tag ? tag + ", " : "") + "to its ends", M, { marks, centres, compartments, ends: true, folded: Object.fromEntries(toEnds.map(v => [v, true])) }]);
      // Nested as the map declares (its `within:` tree), or as a chain where it declares nothing.
      const NS = MV.nestingOf(M.ordering);
      if (M.levels.length > 1 && NS.offer) out.push([(tag ? tag + ", " : "") + "levels nested", M, { marks, centres, compartments, nest: NS.spec }]);
      const G0 = MV.layout(M, { marks, centres, compartments });
      const cut = Object.keys(G0.nodes).filter(v => G0.nodes[v].more);
      if (cut.length) out.push([(tag ? tag + ", " : "") + "labels opened", M, { marks, centres, compartments, open: Object.fromEntries(cut.map(v => [v, true])) }]);
      if (cut.length || G0.edges.some(e => e.chip.whole)) out.push([(tag ? tag + ", " : "") + "labels full", M, { marks, centres, compartments, full: true }]);
    }
  }
  return out;
}

const rows = [], breaches = [];
for (const dir of dirs) for (const file of findMaps(dir)) {
  let graph;
  try { graph = toGraph(argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN })); } catch { continue; }
  const FULL = MV.model(graph);
  if (!FULL) continue;
  const name = path.basename(file, ".argdown");
  const tot = { hard: 0, chipCrossings: 0, crossings: 0, detours: 0, pictures: 0 };
  for (const [pname, M, o] of pictures(FULL)) {
    let G, A;
    try { G = MV.layout(M, { ...o, boundary: !!(M.reasoning && M.reasoning.boundary) }); A = MV.audit(G); }
    catch (e) { breaches.push({ map: name, picture: pname, rule: "!", what: "threw: " + e.message }); tot.hard++; continue; }
    tot.pictures++;
    tot.hard += A.hard.length;
    for (const k of ["chipCrossings", "crossings", "detours"]) tot[k] += A.soft[k];
    for (const h of A.hard) breaches.push({ map: name, picture: pname, rule: h.rule, what: h.what });
  }
  rows.push({ name, ...tot });
}

const pad = (s, n) => String(s).slice(0, n).padEnd(n);
console.log(pad("map", 44) + pad("pictures", 10) + pad("hard", 7) + pad("M6 lines", 10) + pad("M7 cross", 10) + "M8 detours");
for (const r of rows) console.log(pad(r.name, 44) + pad(r.pictures, 10) + pad(r.hard, 7) + pad(r.chipCrossings, 10) + pad(r.crossings, 10) + r.detours);
const byRule = {};
for (const b of breaches) byRule[b.rule] = (byRule[b.rule] || 0) + 1;
console.log("\nhard breaches: " + breaches.length + (breaches.length ? " — " + Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(", ") : ""));
if (argv.includes("--list") || breaches.length <= 40)
  for (const b of breaches) console.log(`  ${b.rule}  ${b.map} [${b.picture}]: ${b.what}`);

const soft = Object.fromEntries(rows.map(r => [r.name, { chipCrossings: r.chipCrossings, crossings: r.crossings, detours: r.detours }]));
let worse = [];
if (argv.includes("--baseline")) {
  const old = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};
  fs.writeFileSync(BASELINE, JSON.stringify(Object.assign(old, soft), null, 1) + "\n");
  console.log("\nbaseline recorded for " + rows.length + " maps");
} else if (fs.existsSync(BASELINE)) {
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  for (const r of rows) {
    const b = base[r.name];
    if (!b) continue;
    for (const k of ["chipCrossings", "crossings", "detours"])
      if (r[k] > b[k] * 1.1 + 2) worse.push(`${r.name}: ${k} ${b[k]} -> ${r[k]}`);
  }
  console.log(worse.length ? "\nworse than the baseline:\n  " + worse.join("\n  ") : "\nno soft number worse than the baseline");
}
process.exit(breaches.length || worse.length ? 1 : 0);
