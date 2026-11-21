#!/usr/bin/env node
/* test_line_ends.mjs — where a line meets its box: never on a rounded corner, never along a border.
 *
 *   node app/test_line_ends.mjs
 *
 * WHY THIS EXISTS. The layout clips a line to its box's RECTANGLE, but the box is drawn with corners
 * rounded at 7, so a line clipped at a corner stops in the quarter-circle the rounding cuts away.
 * Reported from use on Prescott-Couch (21 Nov 2026): the line out of "The commitments interconnect"
 * ended short of the box, in a hook. Measured in a browser, 123 of the 2,350 drawn line ends on the
 * samples sat on a corner. `offCorner` moves such an end CORNER_CLEAR along a face; and an end whose
 * first leg runs flat along its own box's border -- a route rebuilt round a taller neighbour -- to
 * the side it heads for. See its header for why each face, measured both ways.
 *
 * Here: the rule's cases one by one, then every sample at several depths, folded and open, through
 * the same `edgeGeometry` the page draws with. The painted map is held to the same rule in
 * test_rendered_dom.mjs, after the relays this cannot see.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require(path.join(HERE, "src", "argdown-live-map.js"));
const C = M.CORNER_CLEAR;

let fails = 0;
function check(name, ok, detail) {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}
const same = (p, q) => !!p && !!q && Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;

/* ---- 1. the rule, case by case ---- */
console.log("the rule");
// A box 200 x 80 centred on (100, 40): left 0, right 200, top 0, bottom 80.
const box = { x: 100, y: 40 }, size = { width: 200, height: 80 };
let r = M.offCorner({ x: 0, y: 0 }, { x: -150, y: -60 }, box, size);
check("an end on the top-left corner, heading up past the top, moves along the top",
      r && same(r.end, { x: C, y: 0 }) && r.next === null, JSON.stringify(r));
r = M.offCorner({ x: 0, y: 0 }, { x: -12, y: 0 }, box, size);
check("an end on the corner whose first leg is a flat stub leaves from the side, the stub with it",
      r && same(r.end, { x: 0, y: C }) && same(r.next, { x: -12, y: C }), JSON.stringify(r));
r = M.offCorner({ x: 40, y: 0 }, { x: -12, y: 0 }, box, size);
check("an end mid-top whose first leg runs along the top and off the side leaves from that side",
      r && same(r.end, { x: 0, y: C }) && same(r.next, { x: -12, y: C }), JSON.stringify(r));
r = M.offCorner({ x: 200, y: 80 }, { x: 260, y: 130 }, box, size);
check("the bottom-right corner, heading on below, moves along the bottom",
      r && same(r.end, { x: 200 - C, y: 80 }), JSON.stringify(r));
r = M.offCorner({ x: 8, y: 80 }, { x: 8, y: 160 }, box, size);
check("an arrival seated 8 from the corner is already clear of it, and stays", r === null, JSON.stringify(r));
r = M.offCorner({ x: 0, y: 0 }, { x: 50, y: 40 }, box, size);
check("a line that runs back into its box is left alone", r === null, JSON.stringify(r));
r = M.offCorner({ x: 0, y: 0 }, { x: -150, y: 10 }, { x: 100, y: 15 }, { width: 200, height: 30 });
check("a box too short to clear a corner on its side takes the side's middle",
      r && same(r.end, { x: 0, y: 15 }), JSON.stringify(r));
r = M.offCorner({ x: 100, y: -40 }, { x: 0, y: -100 }, box, size);
check("an end nowhere near the box is not this rule's business", r === null, JSON.stringify(r));

/* ---- 2. every sample ---- */
console.log("\nthe samples, through edgeGeometry");
const graphOf = src => toGraph(argdown.run({ input: src, ...RUN }));
const sizeOf = n => ({ width: Math.max(90, Math.min(190, 8 + (n.label || "").length * 5.5)),
                       height: 54 + Math.floor((n.label || "").length / 34) * 12 });
/** Where an end sits on its box: on the corner's curve, or leaving flat along a border. */
function fault(end, next, b, s) {
  const l = b.x - s.width / 2, r = b.x + s.width / 2, t = b.y - s.height / 2, bt = b.y + s.height / 2;
  if (end.x < l - 2 || end.x > r + 2 || end.y < t - 2 || end.y > bt + 2) return null;
  const dx = Math.min(Math.abs(end.x - l), Math.abs(end.x - r)), dy = Math.min(Math.abs(end.y - t), Math.abs(end.y - bt));
  if (dx < 8 && dy < 8) return "on a corner";
  if (dy < 1 && Math.abs(next.y - end.y) < 1 && (next.x < l - 1 || next.x > r + 1)) return "along its border";
  if (dx < 1 && Math.abs(next.x - end.x) < 1 && (next.y < t - 1 || next.y > bt + 1)) return "along its border";
  return null;
}
const root = path.join(HERE, "..", "samples");
let ends = 0, rawFaults = 0;
for (const dir of fs.readdirSync(root).filter(d => fs.statSync(path.join(root, d)).isDirectory())) {
  const f = fs.readdirSync(path.join(root, dir)).find(x => x.endsWith(".argdown"));
  if (!f) continue;
  const graph = graphOf(fs.readFileSync(path.join(root, dir, f), "utf8"));
  const tops = (graph.groups || []).filter(g => !g.parent).map(g => g.id);
  const bad = [];
  for (const depth of [null, 1, 2]) for (const folded of [false, true]) {
    const vis = M.filterGraph(graph, { collapsedGroups: new Set(folded ? tops : []), collapsedNodes: new Set(),
                                       expandedNodes: new Set(), depth, facets: null });
    if (!vis.nodes.length) continue;
    const sizes = new Map(vis.nodes.map(n => [n.id, sizeOf(n)]));
    const g = M.layoutByArgument(vis, sizes), geo = M.edgeGeometry(g, vis, sizes);
    for (const e of g.edges()) {
      const raw = (g.edge(e) || {}).points || [], p = geo.get(`${e.v} ${e.w} ${e.name}`) || [];
      for (const [pts, count] of [[raw, false], [p, true]]) {
        if (pts.length < 2) continue;
        const n = pts.length;
        for (const [end, next, id] of [[pts[0], pts[1], e.v], [pts[n - 1], pts[n - 2], e.w]]) {
          const b = g.node(id), s = sizes.get(id);
          if (!b || !s) continue;
          const why = fault(end, next, b, s);
          if (!count) { if (why) rawFaults++; continue; }
          ends++;
          if (why) bad.push(`${id} ${why} at (${end.x.toFixed(1)}, ${end.y.toFixed(1)})` +
                            ` [depth ${depth}, ${folded ? "folded" : "open"}]`);
        }
      }
    }
  }
  check(`${dir.split(" ")[0]}: no line ends on a corner or along a border`, !bad.length,
        bad.slice(0, 3).join("; "));
}
// THE INSTRUMENT CAN SEE THE FAULT: dagre's own routes, before any of this, do end on corners.
check(`and the check can fail: dagre's raw routes put ${rawFaults} end(s) where none is allowed`, rawFaults > 0);
console.log(`\n${ends} line ends checked`);
if (!ends) { console.log("NOTHING WAS CHECKED"); process.exit(1); }
process.exit(fails ? 1 : 0);
