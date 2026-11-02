/* test_seats.mjs — the seats: one order per map, chosen once to cross less.
 *
 *   node app/test_seats.mjs
 *
 * WHAT THE SEATS PROMISE (see `seatsOf` in argdown-live-map.js):
 *
 *   one order     computed once per map and the same in every view, so folding removes
 *                 neighbours and never reshuffles them;
 *   only moves    a seat is the .argdown's own line number, given to another claim of the same
 *                 section and row: nothing leaves its section, and nothing else is renumbered;
 *   premises      an argument's premises keep their order among themselves;
 *   no worse      on every sample, no level of the depth ladder crosses more than it did in
 *                 written order, and the samples as a whole cross less;
 *   host-blind    seating the same file twice gives the same seats.
 *
 * "In written order" is measured by laying the same view out with every seat taken away, which
 * is exactly what the renderer did before seats existed.
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

let fails = 0;
function check(name, ok, detail) {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

const graphOf = src => toGraph(argdown.run({ input: src, ...RUN }));
const open = depth => ({ collapsedGroups: new Set(), collapsedNodes: new Set(),
                         expandedNodes: new Set(), depth, facets: null });
const size = n => ({ width: Math.max(90, Math.min(190, 8 + (n.label || "").length * 5.5)),
                     height: 54 + Math.floor((n.label || "").length / 34) * 12 });

/** Crossings in one view, with its seats or without them. */
function crossings(graph, state, seated) {
  const vis = M.filterGraph(graph, state);
  if (!vis.nodes.length) return 0;
  if (!seated) for (const n of vis.nodes) n.seat = null;
  const sizes = new Map(vis.nodes.map(n => [n.id, size(n)]));
  const g = M.layoutByArgument(vis, sizes);
  const geo = M.edgeGeometry(g, vis, sizes), paths = [];
  for (const e of g.edges()) {
    const p = geo.get(`${e.v} ${e.w} ${e.name}`);
    if (p && p.length > 1) paths.push(p);
  }
  let c = 0;
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++) if (M.pathsCross(paths[i], paths[j])) c++;
  return c;
}

/** Left-to-right order of claims sharing a section and a row, as drawn. */
function rowOrders(graph, state) {
  const vis = M.filterGraph(graph, state);
  const sizes = new Map(vis.nodes.map(n => [n.id, size(n)]));
  const g = M.layoutByArgument(vis, sizes);
  const rows = new Map();
  for (const n of vis.nodes) {
    if (n.kind === "group") continue;
    const k = (n.group || "") + "@" + Math.round(g.node(n.id).y);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(n.id);
  }
  for (const list of rows.values()) list.sort((a, b) => g.node(a).x - g.node(b).x);
  return [...rows.values()];
}

// ---------------------------------------------------------------- a map built to need a reseat
//
// Two findings written in one order, pointing at two claims written in the other: in written
// order their lines cross; seated, they do not.
const CROSSED = `
# The section

[A]: Claim A.

[B]: Claim B.

[Second finding]: For B.
    +> [B]

[First finding]: For A.
    +> [A]
`;
console.log("a map built to need a reseat");
{
  const g = graphOf(CROSSED);
  check("written order crosses", crossings(g, open(null), false) > 0);
  check("seated, it does not", crossings(g, open(null), true) === 0,
        "crossings " + crossings(g, open(null), true));
}

// ---------------------------------------------------------------- premises keep their order
//
// The premises of one argument point at the same conclusion, so the barycentre cannot tell
// them apart -- unless their own reasons pull them opposite ways, which these do.
const PREMISES = `
# The section

[X]: Claim X.

[Y]: Claim Y.

<Arg>

(1) [P one]: First premise.
(2) [P two]: Second premise.
----
(3) [Conclusion]: The conclusion.

[P one]
    <+ [For P one]: Reason.
        <+ [Y]
[P two]
    <+ [For P two]: Reason.
        <+ [X]
`;
console.log("premises keep their order");
{
  const g = graphOf(PREMISES);
  const seats = M.seatsOf(g);
  const id = t => g.nodes.find(n => n.label === t).id;
  check("premise (1) is seated before premise (2)", seats.get(id("P one")) < seats.get(id("P two")));
}

// ---------------------------------------------------------------- the samples
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".argdown")) files.push(p);
  }
})(path.join(HERE, "..", "samples"));
files.sort();

console.log("the samples");
let before = 0, after = 0;
for (const file of files) {
  const name = path.basename(file, ".argdown");
  const src = fs.readFileSync(file, "utf8");
  const g = graphOf(src);
  const seats = M.seatsOf(g);

  // One order: two filterings, or any fold state, read the same seats -- the same object.
  const tops = (g.groups || []).filter(x => !x.parent).map(x => x.id);
  const folded = Object.assign(open(null), { collapsedGroups: new Set(tops.slice(0, 1)) });
  const seen = new Map();
  let same = true;
  for (const st of [open(null), open(1), open(2), folded])
    for (const n of M.filterGraph(g, st).nodes) {
      if (n.seat == null) continue;
      if (seen.has(n.id) && seen.get(n.id) !== n.seat) same = false;
      seen.set(n.id, n.seat);
    }
  check(`${name}: every view reads one set of seats`, same && M.seatsOf(g) === seats);

  // The order in any view is a projection of one order: claims sharing a section and a row are
  // drawn by [section, seat], whatever is folded -- the seat standing in for the written line.
  const key = new Map(g.nodes.map(n => [n.id, [n.order ?? Infinity,
                                              seats.get(n.id) ?? n.docLine ?? Infinity]]));
  const less = (a, b) => key.get(a)[0] - key.get(b)[0] || key.get(a)[1] - key.get(b)[1];
  let projected = true;
  for (const st of [open(null), open(1), open(2), open(3), folded])
    for (const list of rowOrders(g, st)) {
      const known = list.filter(id => key.has(id));
      for (let i = 1; i < known.length; i++) if (less(known[i - 1], known[i]) > 0) projected = false;
    }
  check(`${name}: folding never reshuffles row-mates`, projected);

  // Only moves within a section: the seats are the written line numbers, permuted.
  const byGroup = new Map();
  for (const n of g.nodes) {
    if (n.docLine == null) continue;
    const k = n.group || "";
    if (!byGroup.has(k)) byGroup.set(k, [[], []]);
    byGroup.get(k)[0].push(n.docLine);
    byGroup.get(k)[1].push(seats.get(n.id));
  }
  let permuted = true;
  for (const [a, b] of byGroup.values())
    if (JSON.stringify(a.sort((x, y) => x - y)) !== JSON.stringify(b.sort((x, y) => x - y))) permuted = false;
  check(`${name}: seats are its own line numbers, within each section`, permuted);

  // Premises: no two premises of one argument change places.
  let premises = true;
  const byArg = new Map();
  for (const e of g.edges) if (e.line != null) {
    if (!byArg.has(e.to)) byArg.set(e.to, []);
    byArg.get(e.to).push(e.from);
  }
  const line = new Map(g.nodes.map(n => [n.id, n.docLine]));
  for (const ps of byArg.values())
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        if (line.get(a) == null || line.get(b) == null) continue;
        if ((line.get(a) - line.get(b)) * (seats.get(a) - seats.get(b)) < 0) premises = false;
      }
  check(`${name}: premises keep their order`, premises);

  // No worse at any level.
  const worse = [];
  for (const d of [1, 2, 3, null]) {
    const w = crossings(g, open(d), false), s = crossings(g, open(d), true);
    before += w; after += s;
    if (s > w) worse.push(`depth ${d}: ${w} -> ${s}`);
  }
  check(`${name}: no level crosses more`, !worse.length, worse.join(", "));

  // Host-blind: the same file, built again, seats the same way.
  const again = M.seatsOf(graphOf(src));
  check(`${name}: seating is deterministic`,
        [...seats].every(([id, s]) => again.get(id) === s));
}
check(`the samples cross less in all (${before} -> ${after})`, after < before);

console.log(fails ? `\n${fails} FAILED` : "\nall seat checks pass");
process.exit(fails ? 1 : 0);
