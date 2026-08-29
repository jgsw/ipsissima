#!/usr/bin/env node
/* test_layout_geometry.mjs — the exposition layout must produce a drawable picture, for any
 * Argdown file, not just the two on this machine.
 *
 * WHY. `test_fold_invariants.mjs` covers WHICH nodes are visible. This covers WHERE they go:
 * boxes that overlap, columns out of order, edges anchored to nothing, NaN coordinates, a
 * gutter rule on the wrong side. None of that is caught by "does it parse".
 *
 * HOW IT RUNS WITHOUT A BROWSER. `layoutByText` is pure — its only DOM-shaped input is a map of
 * node id to {width, height}, which the renderer fills by measuring real text. Here that is
 * supplied deterministically, so the geometry is reproducible and the arithmetic is what gets
 * tested. Font metrics are not the thing that has ever been wrong.
 *
 * ADVERSARIAL BY DEFAULT. The generator below builds the shapes a shared tool will actually
 * meet from other people's files: empty maps, one node, no edges, nothing but a cycle,
 * self-loops, duplicate ids, dangling edges, groups whose parent does not exist, group cycles,
 * every claim in the gutter, one enormous label, and seeded random graphs. Each is run through
 * the whole pipeline — filter, layout, geometry — and must not throw and must not produce a
 * picture that breaks the invariants.
 *
 *   node test_layout_geometry.mjs [--cases N] [--seed N]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/node";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { filterGraph, layoutByText, membersOfGroup, reduceFold, sanitiseGraph,
        hiddenSpans, drawnPolyline, boxesOf, junctionGeometry,
        junctionFeet, pcsRows, premiseHull } =
  require(path.join(HERE, "src", "argdown-live-map.js"));
const POS = require(path.join(HERE, "src", "argdown-positions.js"));

/** Attach manuscript positions the way build_argdown_viewer.mjs does. Without this the real
 *  maps reach the layout with no positions at all, every claim lands in the no-position lane,
 *  and the exposition layout is never actually exercised — which is how it was being tested
 *  until the shape of the output gave it away. */
function withPositions(graph, file) {
  const root = path.dirname(file);
  const quarto = path.join(root, "_quarto.yml");
  if (!fs.existsSync(quarto)) return graph;
  const sources = {};
  for (const n of graph.nodes) {
    if (!n.chapter || n.chapter in sources) continue;
    const f = path.join(root, n.chapter);
    sources[n.chapter] = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  }
  const { byId } = POS.positions(graph.nodes, sources, fs.readFileSync(quarto, "utf8"));
  for (const n of graph.nodes) if (byId[n.id]) n.pos = byId[n.id];
  return graph;
}

// The parser writes plugin errors straight to stderr for input it cannot model -- an empty
// file, for instance -- rather than throwing, and the `logger` option on runAsync does not
// reach them. That is not a failure, but it buries the report, so parsing happens with stderr
// muted and the verdict is taken from the return value. Worth knowing if you embed the parser:
// a file that "produces no map" reports itself only to the console.
async function parseQuietly(input) {
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;
  try { return await argdown.runAsync({ input, ...RUN }); }
  finally { process.stderr.write = write; }
}

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const CASES = arg("--cases", 120);
const SEED = arg("--seed", 20260818);

let failures = 0, cases = 0, layouts = 0, fellBack = 0;
const fail = (where, msg) => { failures++; console.log(`   FAIL  ${where}\n         ${msg}`); };

/* ---------------------------------------------------------------- sizing stub */

/** What the renderer would measure, made deterministic. Deliberately varied — equal-sized
 *  boxes would hide any bug that depends on width. */
function sizesFor(vis) {
  const m = new Map();
  for (const n of vis.nodes) {
    const label = String(n.label || n.id || "");
    const detail = String(n.detail || "");
    const w = Math.max(60, Math.min(190, 8 + label.length * 6));
    const lines = Math.min(4, 1 + Math.ceil(detail.length / 34));
    m.set(n.id, { width: w + 20, height: 22 + lines * 16 + (n.expandable ? 15 : 0),
                  title: { lines: [label], width: w }, body: { lines: [], width: 0 },
                  clipped: false, expandable: !!n.expandable });
  }
  return m;
}

/* ---------------------------------------------------------------- invariants */

const num = v => typeof v === "number" && Number.isFinite(v);

function checkGeometry(name, graph, vis, g) {
  const where = n => `${name}: ${n}`;
  const boxes = [];
  for (const n of vis.nodes) {
    const p = g.node(n.id);
    if (!p) { fail(where("every visible node is placed"), `${n.id} has no position`); return; }
    if (!num(p.x) || !num(p.y) || !num(p.width) || !num(p.height))
      return fail(where("positions are finite"), `${n.id} -> ${JSON.stringify(p)}`);
    if (p.width <= 0 || p.height <= 0)
      return fail(where("boxes have positive extent"), `${n.id} is ${p.width}x${p.height}`);
    boxes.push({ id: n.id, ...p, pos: n.pos || null });
  }

  // 1. No two node boxes overlap. The layout stacks within a cell and bands across, so any
  //    overlap means a cell height or column width was computed short.
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x + a.width / 2, b.x + b.width / 2) -
                 Math.max(a.x - a.width / 2, b.x - b.width / 2);
      const oy = Math.min(a.y + a.height / 2, b.y + b.height / 2) -
                 Math.max(a.y - a.height / 2, b.y - b.height / 2);
      if (ox > 0.5 && oy > 0.5)
        return fail(where("no two boxes overlap"),
                    `${a.id} and ${b.id} overlap by ${ox.toFixed(1)}x${oy.toFixed(1)}`);
    }
  }

  // 2. READING ORDER follows the manuscript. The lanes wrap like prose, so this is not "x
  //    increases" — a claim can start a new row further left, exactly as a word does. Reading
  //    the map the way you read a page (down the rows, left to right within one) must give the
  //    order of the text.
  //
  //    Band on COLUMNS, not on claims. Several claims share one position and stack vertically
  //    inside a single column, so banding individual boxes by y splits one column across
  //    several apparent rows and reports order violations that are not there.
  {
    const cols = new Map();
    for (const b of boxes) {
      if (!b.pos || b.pos.line == null) continue;
      const k = b.pos.chapterIndex + ":" + b.pos.line;
      const c = cols.get(k) || { k, ci: b.pos.chapterIndex, line: b.pos.line,
                                 top: Infinity, left: Infinity };
      c.top = Math.min(c.top, b.y - b.height / 2);
      c.left = Math.min(c.left, b.x - b.width / 2);
      cols.set(k, c);
    }
    const inOrder = [...cols.values()].sort((p, q) => p.ci - q.ci || p.line - q.line);
    const rows = [];
    for (const c of [...cols.values()].sort((p, q) => p.top - q.top)) {
      const row = rows.find(r => Math.abs(r.top - c.top) < 20);
      if (row) row.items.push(c); else rows.push({ top: c.top, items: [c] });
    }
    rows.sort((p, q) => p.top - q.top);
    const rowOf = new Map();
    rows.forEach((r, i) => r.items.forEach(c => rowOf.set(c.k, i)));
    for (let i = 1; i < inOrder.length; i++) {
      const prev = inOrder[i - 1], cur = inOrder[i];
      const rp = rowOf.get(prev.k), rc = rowOf.get(cur.k);
      if (rc < rp)
        return fail(where("reading order follows the text"),
                    `ch${cur.ci}:${cur.line} is on an earlier row than ch${prev.ci}:${prev.line}`);
      if (rc === rp && cur.left < prev.left - 0.5)
        return fail(where("reading order follows the text"),
                    `ch${cur.ci}:${cur.line} is left of ch${prev.ci}:${prev.line} on one row`);
    }
  }

  // 3. The no-position lane sits BELOW everything that has a position, so a reader scrolling
  //    the chapters in order meets it at the end rather than finding it interleaved.
  const unplaced = boxes.filter(b => !b.pos), placedB = boxes.filter(b => b.pos);
  if (unplaced.length && placedB.length) {
    const lowestPlaced = Math.max(...placedB.map(b => b.y + b.height / 2));
    const highestUnplaced = Math.min(...unplaced.map(b => b.y - b.height / 2));
    if (highestUnplaced < lowestPlaced - 0.5)
      return fail(where("unplaced claims come last"),
                  `an unplaced claim starts at y=${highestUnplaced.toFixed(0)}, above the ` +
                  `last placed one at y=${lowestPlaced.toFixed(0)}`);
  }

  // 4. Chapter bands: real boxes, no two overlapping horizontally, each containing its nodes.
  const bands = (g.expoGroups || []).map(gr => ({ gr, p: g.node(gr.id) })).filter(x => x.p);
  for (const { gr, p } of bands)
    if (!num(p.x) || !num(p.width) || p.width <= 0)
      return fail(where("bands have real extent"), `${gr.id} -> ${JSON.stringify(p)}`);
  // Lanes stack DOWN the page now, so they must not overlap vertically.
  const sorted = bands.slice().sort((a, b) => (a.p.y - a.p.height / 2) - (b.p.y - b.p.height / 2));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].p, cur = sorted[i].p;
    if (cur.y - cur.height / 2 < prev.y + prev.height / 2 - 0.5)
      return fail(where("chapter lanes do not overlap"),
                  `${sorted[i - 1].gr.label} overlaps ${sorted[i].gr.label}`);
  }

  // 5. Edges: at least two finite points, and both ends touching the boxes they join.
  for (const e of g.edges()) {
    const d = g.edge(e);
    if (!d || !d.points || d.points.length < 2)
      return fail(where("edges have a path"), `${e.v} -> ${e.w}`);
    if (d.points.some(pt => !num(pt.x) || !num(pt.y)))
      return fail(where("edge points are finite"), `${e.v} -> ${e.w}`);
    const a = g.node(e.v), b = g.node(e.w);
    if (!a || !b) return fail(where("edges join placed nodes"), `${e.v} -> ${e.w}`);
    const near = (pt, box) =>
      Math.abs(pt.x - box.x) <= box.width / 2 + 3.5 && Math.abs(pt.y - box.y) <= box.height / 2 + 3.5;
    if (!near(d.points[0], a))
      return fail(where("an edge starts on its source"), `${e.v} -> ${e.w}`);
    if (!near(d.points[d.points.length - 1], b))
      return fail(where("an edge ends on its target"), `${e.v} -> ${e.w}`);
  }

  // 5b. No edge takes a wildly longer route than the straight line between its ends.
  //
  // This is not about dagre, whose own routing stays within 1.3x on every real map here. It is
  // about the document-order re-seat, which moves blocks sideways AFTER routing and then shears
  // the edge points to follow. On a block that moved a long way the shear used to leave the
  // interior points somewhere that was never on a route between anything, and the line went out
  // to one side and curved all the way back: 3.0x, 3.8x and 4.1x on the three sample maps.
  for (const e of g.edges()) {
    const d = g.edge(e);
    if (!d || !d.points || d.points.length < 3) continue;
    const p = d.points, end = p[p.length - 1];
    const straight = Math.hypot(end.x - p[0].x, end.y - p[0].y);
    if (straight <= 1) continue;
    const len = p.slice(1).reduce((s2, q, i) => s2 + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0);
    if (len / straight > 2.2)
      return fail(where("no edge doubles back on itself"),
                  `${e.v} -> ${e.w} is ${(len / straight).toFixed(1)}x the direct distance`);
  }

  // 6. The reported canvas covers what was drawn.
  const gl = g.graph();
  if (!num(gl.width) || !num(gl.height) || gl.width <= 0 || gl.height <= 0)
    return fail(where("canvas has a real size"), JSON.stringify(gl));
  for (const b of boxes) {
    if (b.x + b.width / 2 > gl.width + 0.5 || b.y + b.height / 2 > gl.height + 0.5)
      return fail(where("the canvas contains every box"),
                  `${b.id} runs past ${gl.width}x${gl.height}`);
    if (b.x - b.width / 2 < -0.5 || b.y - b.height / 2 < -0.5)
      return fail(where("no box sits at negative coordinates"), b.id);
  }
}

/* ---------------------------------------------------------------- awkward inputs */

const pos = (ci, line, chapter, inBook = true) =>
  ({ chapterIndex: ci, line, chapter: chapter || `c${ci}.md`, inBook, precision: "paragraph" });

function fixtures() {
  const out = [];
  const add = (name, graph) => out.push({ name, graph });

  add("empty", { nodes: [], edges: [], groups: [] });
  add("one node, no position", { nodes: [{ id: "a", label: "A" }], edges: [], groups: [] });
  add("one node, positioned",
      { nodes: [{ id: "a", label: "A", pos: pos(0, 1) }], edges: [], groups: [] });
  add("no edges at all", {
    nodes: [0, 1, 2, 3].map(i => ({ id: "n" + i, label: "N" + i, pos: pos(0, i + 1) })),
    edges: [], groups: [] });
  add("everything in the gutter", {
    nodes: [0, 1, 2].map(i => ({ id: "n" + i, label: "N" + i })),
    edges: [{ from: "n1", to: "n0", type: "support" }], groups: [] });
  add("a pure cycle", {
    nodes: [{ id: "a", label: "A", pos: pos(0, 1) }, { id: "b", label: "B", pos: pos(0, 2) }],
    edges: [{ from: "a", to: "b", type: "support" }, { from: "b", to: "a", type: "attack" }],
    groups: [] });
  add("a self-loop", {
    nodes: [{ id: "a", label: "A", pos: pos(0, 1) }],
    edges: [{ from: "a", to: "a", type: "support" }], groups: [] });
  add("dangling edge", {
    nodes: [{ id: "a", label: "A", pos: pos(0, 1) }],
    edges: [{ from: "a", to: "ghost", type: "support" }], groups: [] });
  add("duplicate node ids", {
    nodes: [{ id: "a", label: "A", pos: pos(0, 1) }, { id: "a", label: "A again", pos: pos(0, 2) }],
    edges: [], groups: [] });
  add("group with a missing parent", {
    nodes: [{ id: "a", label: "A", group: "g1", pos: pos(0, 1) }],
    edges: [], groups: [{ id: "g1", label: "G1", parent: "nope" }] });
  add("group cycle", {
    nodes: [{ id: "a", label: "A", group: "g1", pos: pos(0, 1) }],
    edges: [], groups: [{ id: "g1", label: "G1", parent: "g2" }, { id: "g2", label: "G2", parent: "g1" }] });
  add("node in a group that does not exist", {
    nodes: [{ id: "a", label: "A", group: "ghost", pos: pos(0, 1) }], edges: [], groups: [] });
  add("one enormous label", {
    nodes: [{ id: "a", label: "x".repeat(4000), detail: "y".repeat(9000), pos: pos(0, 1) },
            { id: "b", label: "B", pos: pos(0, 2) }],
    edges: [{ from: "b", to: "a", type: "support" }], groups: [] });
  add("unicode and rtl labels", {
    nodes: [{ id: "a", label: "مرحبا بالعالم", pos: pos(0, 1) },
            { id: "b", label: "日本語のラベル", pos: pos(0, 2) },
            { id: "c", label: "🙂🙂🙂", pos: pos(1, 1) }],
    edges: [{ from: "b", to: "a", type: "support" }, { from: "c", to: "a", type: "attack" }],
    groups: [] });
  add("chapters out of order in the data", {
    nodes: [{ id: "a", label: "A", pos: pos(3, 90) }, { id: "b", label: "B", pos: pos(0, 5) },
            { id: "c", label: "C", pos: pos(1, 5) }],
    edges: [{ from: "a", to: "b", type: "support" }, { from: "c", to: "b", type: "support" }],
    groups: [] });
  add("same line, many claims", {
    nodes: Array.from({ length: 14 }, (_, i) => ({ id: "n" + i, label: "N" + i, pos: pos(0, 7) })),
    edges: Array.from({ length: 13 }, (_, i) => ({ from: "n" + (i + 1), to: "n0", type: "support" })),
    groups: [] });
  add("mixed placed and unplaced", {
    nodes: [{ id: "a", label: "A", pos: pos(0, 1) }, { id: "b", label: "B" },
            { id: "c", label: "C", pos: pos(2, 4) }, { id: "d", label: "D" }],
    edges: [{ from: "b", to: "a", type: "support" }, { from: "c", to: "a", type: "support" },
            { from: "d", to: "c", type: "attack" }], groups: [] });
  add("out-of-book chapter", {
    nodes: [{ id: "a", label: "A", pos: pos(0, 1) },
            { id: "b", label: "B", pos: pos(9, 2, "stray.md", false) }],
    edges: [{ from: "b", to: "a", type: "support" }], groups: [] });
  add("null-ish fields", {
    nodes: [{ id: "a", label: null, detail: null, pos: pos(0, 1) },
            { id: "b", label: "B", detail: undefined, pos: pos(0, 2) }],
    edges: [{ from: "b", to: "a", type: null }], groups: [] });
  return out;
}

function randomGraph(rand, i) {
  const n = 1 + Math.floor(rand() * 26);
  const nGroups = Math.floor(rand() * 4);
  const groups = Array.from({ length: nGroups }, (_, k) => ({
    id: "g" + k, label: "Group " + k,
    parent: k > 0 && rand() < 0.4 ? "g" + Math.floor(rand() * k) : null }));
  const nodes = Array.from({ length: n }, (_, k) => {
    const node = { id: "n" + k, label: "claim " + k, detail: "d".repeat(Math.floor(rand() * 90)) };
    if (nGroups && rand() < 0.75) node.group = "g" + Math.floor(rand() * nGroups);
    if (rand() < 0.85) node.pos = pos(Math.floor(rand() * 5), 1 + Math.floor(rand() * 40));
    return node;
  });
  const edges = [];
  for (let k = 1; k < n; k++) {
    if (rand() < 0.15) continue;                       // leave some orphans
    const to = "n" + Math.floor(rand() * k);
    edges.push({ from: "n" + k, to,
                 type: rand() < 0.75 ? "support" : (rand() < 0.5 ? "attack" : "undercut") });
  }
  if (rand() < 0.15 && n > 2)                          // occasionally close a cycle
    edges.push({ from: "n0", to: "n" + (n - 1), type: "support" });
  return { name: `random #${i} (${n} nodes, ${nGroups} groups)`, graph: { nodes, edges, groups } };
}

function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/* ---------------------------------------------------------------- the run */

/** The "by argument" layout, built exactly as createLiveMap builds it.
 *
 *  This path was NOT covered until an overlap in it reached the author: eleven pairs of claims
 *  drawn on top of each other on the Williams map, because the document-order re-seat shifts
 *  whole blocks sideways after dagre has finished and blocks are banded by vertical overlap.
 *  A harness that only knew about the exposition layout could not have found it.
 */
function layoutByArgumentSafe(vis, sizes) {
  try { return API.layoutByArgument(vis, sizes, { ranksep: 46, nodesep: 22 }); }
  catch (e) { return null; }              // nothing to check on a layout that refused
}

/** The geometry checks that apply to BOTH arrangements. The text-order ones (reading order,
 *  lanes, the no-position lane) are meaningless for the by-argument layout, so they are skipped there. */
function checkShared(name, vis, g) {
  const boxes = [];
  for (const n of vis.nodes) {
    const p = g.node(n.id);
    if (!p) return fail(`${name}: every visible node is placed`, `${n.id} has no position`);
    if (!num(p.x) || !num(p.y) || !num(p.width) || !num(p.height))
      return fail(`${name}: positions are finite`, `${n.id} -> ${JSON.stringify(p)}`);
    boxes.push({ id: n.id, ...p });
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x + a.width / 2, b.x + b.width / 2) -
                 Math.max(a.x - a.width / 2, b.x - b.width / 2);
      const oy = Math.min(a.y + a.height / 2, b.y + b.height / 2) -
                 Math.max(a.y - a.height / 2, b.y - b.height / 2);
      if (ox > 0.5 && oy > 0.5)
        return fail(`${name}: no two boxes overlap`,
                    `${a.id} and ${b.id} overlap by ${ox.toFixed(1)}x${oy.toFixed(1)}`);
    }
}

/** One case, through the whole pipeline, in several fold states. */
function exercise(name, raw) {
  // Through the same door the renderer uses: createLiveMap sanitises before it draws, so a
  // harness that skipped it would be testing a graph no viewer ever sees.
  let graph;
  try { graph = sanitiseGraph(raw).graph; }
  catch (e) { return fail(name, "sanitiseGraph threw: " + (e && e.message)); }
  cases++;
  const tops = (graph.groups || []).filter(g => !g.parent).map(g => g.id);
  const states = [
    { collapsedGroups: new Set(), collapsedNodes: new Set(), expandedNodes: new Set(),
      groupFolded: new Map(), depth: null, facets: null },
    { collapsedGroups: new Set(tops), collapsedNodes: new Set(), expandedNodes: new Set(),
      groupFolded: new Map(), depth: null, facets: null },
    { collapsedGroups: new Set(), collapsedNodes: new Set(), expandedNodes: new Set(),
      groupFolded: new Map(), depth: 1, facets: null }
  ];
  for (const [i, st] of states.entries()) {
    let vis, g;
    try {
      vis = filterGraph(graph, st);
      if (!vis.nodes.length) continue;                 // nothing to draw is not a defect
      g = layoutByText(vis, sizesFor(vis));
    } catch (e) {
      fail(`${name} [state ${i}]`, "threw: " + (e && e.stack || e).toString().split("\n")[0]);
      continue;
    }
    layouts++;
    checkGeometry(`${name} [state ${i}]`, graph, vis, g);
    // ...and the other arrangement, which shares the map but not the layout.
    const byArg = layoutByArgumentSafe(vis, sizesFor(vis));
    if (byArg) { layouts++; checkShared(`${name} [state ${i}] by argument`, vis, byArg); }
    else fellBack++;
  }
}

console.log("\nawkward and adversarial inputs");
for (const { name, graph } of fixtures()) exercise(name, graph);

console.log(`\n${CASES} generated graphs (seed ${SEED})`);
{
  const rand = rng(SEED);
  for (let i = 0; i < CASES; i++) {
    const { name, graph } = randomGraph(rand, i);
    exercise(name, graph);
  }
}

/* ------------------------------------------------ real Argdown source, deliberately awkward
 *
 * The graphs above are hand-built. This runs actual .argdown TEXT through the real parser and
 * the real adapter, because that is the path someone else's file takes. A file may legitimately
 * fail to parse -- that is the CLI's job to report -- but nothing here may throw from our code,
 * hang, or produce a graph the layout cannot draw.
 */
const SOURCES = {
  "empty file": "",
  "only whitespace": "\n\n   \n",
  "only a comment": "// nothing here at all\n",
  "only frontmatter": "===\ntitle: nothing\n===\n",
  "one bare statement": "[a]: A claim.\n",
  "statement with no text": "[a]:\n",
  "two statements, no relations": "[a]: One.\n\n[b]: Two.\n",
  "self-supporting claim": "[a]: A.\n    + [a]\n",
  "mutual support": "[a]: A.\n    + [b]: B.\n\n[b]\n    + [a]\n",
  "deep chain": Array.from({ length: 120 }, (_, i) =>
      `${"    ".repeat(Math.min(i, 30))}${i ? "+ " : ""}[n${i}]: Claim ${i}.`).join("\n") + "\n",
  "wide fan": "[root]: Root.\n" +
      Array.from({ length: 200 }, (_, i) => `    + [n${i}]: Claim ${i}.`).join("\n") + "\n",
  "heading with a shortcode": "# III.A. A section\n\n[a]: A claim.\n",
  "group heading": "# Part {isGroup: true}\n\n[a]: A.\n    + [b]: B.\n",
  "nested groups": "# Outer {isGroup: true}\n\n## Inner {isGroup: true}\n\n[a]: A.\n    + [b]: B.\n",
  "pcs without a conclusion": "<Arg>: Gloss.\n\n(1) [p]: A premise.\n",
  "pcs with intermediary": "<Arg>: Gloss.\n\n(1) [p1]: P1.\n(2) [p2]: P2.\n-----\n(3) [c1]: C1.\n(4) [p3]: P3.\n-----\n(5) [c2]: C2.\n",
  "undercut and contradiction": "[a]: A.\n    + <Arg>: G.\n\n<Arg>\n    _ [u]: Undercut.\n\n[a]\n    >< [c]: Contradiction.\n",
  "unicode ids and text": "[مرحبا]: نص عربي هنا.\n    + [日本]: 日本語のテキスト。\n",
  "emoji": "[a]: 🙂 A claim with emoji 🎉.\n    + [b]: 🔥\n",
  "very long statement": "[a]: " + "word ".repeat(3000) + "\n",
  "metadata everywhere": '[a]: A. {chapter: "x.md", section: "S", fidelity: "imputation"}\n    + [b]: B. {chapter: "x.md", section: "S"}\n',
  "tags": "[a]: A. #core\n    + [b]: B. #objection #ignored\n",
  "duplicate definition": "[a]: First text.\n\n[a]: Second text.\n"
};

let noMap = 0, drew = 0, unparsed = 0, empty = 0;
console.log("\nreal Argdown source, deliberately awkward");
for (const [name, src] of Object.entries(SOURCES)) {
  let res;
  try {
    res = await parseQuietly(src);
  } catch (e) {
    // A parse failure is a legitimate answer for malformed input; a crash is not.
    const m = String(e && e.message || e);
    if (/argdown|parse|syntax|expect/i.test(m)) { cases++; unparsed++; continue; }
    fail(`source: ${name}`, "parser threw something that is not a parse error: " + m);
    continue;
  }
  if (!res || !res.map) { cases++; noMap++; continue; }   // nothing to model is fine
  let graph;
  try { graph = toGraph(res); }
  catch (e) { fail(`source: ${name}`, "toGraph threw: " + (e && e.message)); continue; }
  graph.nodes.length ? drew++ : empty++;
  exercise(`source: ${name}`, graph);
}
console.log(`   ${Object.keys(SOURCES).length} sources: ${drew} drew a map, ${empty} parsed to an `
            + `empty map, ${noMap} modelled nothing, ${unparsed} refused to parse`);
console.log("   none crashed, none hung");

/* ---- the hidden-line rule: which stretches of an edge disappear behind a node ----
 *
 *  This decides a VISUAL CLAIM — "the line you can see emerging here started somewhere else" —
 *  so a wrong answer misinforms rather than merely looking odd. The pruning check is the one
 *  that matters most: `hiddenSpans` throws away boxes outside the edge's bounding box before
 *  testing, and an over-eager prune would silently stop reporting real crossings.
 */
console.log("\nthe hidden-line rule");
{
  const box = (id, x0, y0, x1, y1) => ({ id, x0, y0, x1, y1 });
  const line = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y1 }];
  const say = (ok, what) => { cases++; if (!ok) failures++;
    console.log(`   ${ok ? "ok  " : "FAIL"}  ${what}`); };

  say(hiddenSpans(line(0, 0, 0, 200), [box("a", -20, 300, 20, 340)], 10).length === 0,
      "a line that passes nowhere near a node is reported clear");
  const through = hiddenSpans([{x:0,y:0},{x:0,y:80},{x:0,y:120},{x:0,y:200}],
                              [box("a", -20, 70, 20, 130)], 10);
  say(through.length === 1 && through[0].every(p => p.y >= 70 && p.y <= 130),
      "a line crossing one node yields one run, wholly inside it");
  say(hiddenSpans([{x:0,y:0},{x:0,y:40},{x:0,y:60},{x:0,y:120},{x:0,y:140},{x:0,y:200}],
                  [box("a", -9, 30, 9, 70), box("b", -9, 110, 9, 150)], 10).length === 2,
      "two nodes in the way yield two separate runs");
  say(hiddenSpans([{x:0,y:0},{x:0,y:99},{x:0,y:101},{x:0,y:200}],
                  [box("a", -9, 98, 9, 102)], 10).length === 0,
      "a line grazing a corner is not marked — that needs no explaining");

  // A three-point edge is PAINTED as a quadratic that cuts well inside its middle point, so the
  // polyline and the drawn curve disagree about what they cross. Getting this wrong would mark
  // boxes the line misses and miss boxes it crosses.
  const bowed = [{x:0,y:0},{x:120,y:100},{x:0,y:200}];
  const curve = drawnPolyline(bowed, 28);
  const atMid = curve[Math.floor(curve.length / 2)];
  say(atMid.x > 20 && atMid.x < bowed[1].x,
      `the painted curve is sampled, not the polyline (midpoint x=${atMid.x.toFixed(0)}, ` +
      `not ${bowed[1].x})`);

  // Pruning must not change the answer. Brute force over a scatter of boxes, against the real one.
  let rng = 12345; const rand = () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296;
  let mismatched = 0;
  for (let t = 0; t < 200; t++) {
    const pts = drawnPolyline([{x: rand()*400, y: rand()*400},
                               {x: rand()*400, y: rand()*400},
                               {x: rand()*400, y: rand()*400}], 28);
    const boxes = [];
    for (let b = 0; b < 12; b++) {
      const x = rand()*380, y = rand()*380;
      boxes.push(box("b" + b, x, y, x + 20 + rand()*60, y + 20 + rand()*40));
    }
    const fast = hiddenSpans(pts, boxes, 0).length;
    // The same rule with NOTHING pruned. It has to densify identically, or it is testing the
    // sampling rather than the pruning — which is what it did at first, and reported a failure
    // in the code when the fault was in the reference.
    const STEP = 7, dense = [];
    for (let i = 0; i < pts.length; i++) {
      if (i) {
        const a = pts[i - 1], b = pts[i];
        const steps = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / STEP);
        for (let k = 1; k <= steps; k++)
          dense.push({ x: a.x + (b.x - a.x) * k / (steps + 1),
                       y: a.y + (b.y - a.y) * k / (steps + 1) });
      }
      dense.push(pts[i]);
    }
    const inside = p => boxes.some(b => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1);
    let slow = 0, run = false;
    for (const p of dense) { const i = inside(p); if (i && !run) slow++; run = i; }
    if (fast !== slow) mismatched++;
  }
  say(mismatched === 0, `pruning by bounding box changes no answer (200 random cases)`);
}

/* ---- the bar that gathers the linked premises of one inference step -------------------
 *
 *  This one draws a CLAIM about the argument — that these premises stand or fall together —
 *  so a bar in the wrong place or at the wrong angle misreports the reconstruction rather than
 *  merely looking untidy. Both faults below were real: a first version took its direction from
 *  the box's centre, which tilted the bar on any wide box, and placed the junction on the fold
 *  badge, which swallowed the arrowhead.
 */
console.log("\nlinked-premise junctions");
{
  const say = (ok, what) => { cases++; if (!ok) failures++;
    console.log(`   ${ok ? "ok  " : "FAIL"}  ${what}`); };
  const box = { x: 200, y: 150, width: 120, height: 46 };
  const below = [{ x: 150, y: 185 }, { x: 200, y: 185 }, { x: 245, y: 185 }];
  const horiz = g => Math.abs(g.bar[1].y - g.bar[0].y) < 1e-9;
  const vert  = g => Math.abs(g.bar[1].x - g.bar[0].x) < 1e-9;

  say(junctionGeometry(box, [below[0]], 20) === null,
      "a step with one visible premise gets no bar — nothing to gather");
  say(junctionGeometry(box, [], 20) === null && junctionGeometry(null, below, 20) === null,
      "no arrivals, or no target, is not a junction");

  const b = junctionGeometry(box, below, 20);
  say(horiz(b), "premises from below put the bar SQUARE across the face, not at the angle they arrive");
  say(b.j.y > b.tip.y && Math.abs(b.j.x - b.tip.x) < 1e-9,
      "the junction sits outside the box, straight out from where the arrow lands");
  say(Math.abs((b.bar[1].x - b.bar[0].x) * (b.tip.x - b.j.x) +
               (b.bar[1].y - b.bar[0].y) * (b.tip.y - b.j.y)) < 1e-9,
      "the bar is perpendicular to the arrow leaving it");

  // A mean arrival a few pixels off-centre used to swing the bar by fifteen degrees.
  const skew = junctionGeometry(box, [{ x: 120, y: 185 }, { x: 130, y: 185 }, { x: 300, y: 185 }], 20);
  say(horiz(skew), "an off-centre spread of premises does not tilt the bar");

  say(vert(junctionGeometry(box, [{ x: 60, y: 148 }, { x: 60, y: 158 }], 20)),
      "premises from the side put the bar on the side face");

  const clear = junctionGeometry(box, below, 20, 13);
  say(Math.abs(clear.tip.x - box.x) >= 13,
      "with a fold badge on the face, the junction slides clear of it");
  say(horiz(clear), "and is still square");
  // Compared against the un-nudged junction, not against the face centre: `boundary` does not
  // put the tip dead centre in the first place, so "did not move" is the thing to assert.
  const tiny = { x: 200, y: 150, width: 24, height: 46 };
  const narrow = junctionGeometry(tiny, below, 20, 13);
  const asIs = junctionGeometry(tiny, below, 20, 0);
  say(Math.abs(narrow.tip.x - asIs.tip.x) < 1e-9,
      "on a box too narrow to slide along, it stays put rather than hanging off the edge");

  /* WHERE EACH MEMBER LANDS ON THE BAR.
   *
   * The defect these hold against: every member used to be moved to the junction POINT, so a
   * premise well to the side ran almost parallel to the bar and its last units lay along it --
   * the two strokes merged and there was no visible join. Seen at 7x on the supported-premise
   * fixture. What must be true now is that the feet are distinct, ordered, on the bar, and
   * approached from outside it.
   */
  const feet = junctionFeet(b, below, 12);
  say(feet.length === below.length, "every member of a junction gets a foot");
  const distinct = new Set(feet.map(f => f.land.x.toFixed(4) + "," + f.land.y.toFixed(4)));
  say(distinct.size === feet.length,
      "the feet are DISTINCT -- members meet the bar at their own places, not all at one point");
  // On the bar's line, and never past its ends.
  const onBar = feet.every(f => Math.abs(f.land.y - b.j.y) < 1e-6 &&
                                f.land.x >= Math.min(b.bar[0].x, b.bar[1].x) - 1e-6 &&
                                f.land.x <= Math.max(b.bar[0].x, b.bar[1].x) + 1e-6);
  say(onBar, "every foot sits ON the bar, between its ends");
  const span = Math.max(...feet.map(f => f.land.x)) - Math.min(...feet.map(f => f.land.x));
  say(span < Math.abs(b.bar[1].x - b.bar[0].x) - 1e-6,
      "and inset from them, so the bar overhangs its outermost member");
  // Ordered: a member further along the bar's direction lands further along it. A bar that
  // braided its own premises would say the drawing could not tell them apart.
  say(feet[0].land.x < feet[1].land.x && feet[1].land.x < feet[2].land.x,
      "the feet keep the order the premises arrive in -- the members do not cross");
  // The lift is outside the bar, square to it: that is what makes the approach perpendicular.
  say(feet.every(f => f.lift.y > f.land.y && Math.abs(f.lift.x - f.land.x) < 1e-6),
      "each member turns onto the bar SQUARE to it, from outside");
  say(junctionFeet(null, below) .length === 0 && junctionFeet(b, []).length === 0,
      "no junction, or no arrivals, is no feet");
}

console.log("\nthe premise-conclusion structure");
{
  const say = (ok, what) => { cases++; if (!ok) failures++;
    console.log(`   ${ok ? "ok  " : "FAIL"}  ${what}`); };

  /* WHICH LINES THE ARGUMENT'S OWN BOX HAS TO DRAW.
   *
   * The defect: an untitled premise is not selected into the map, so it became no node, no arrow
   * and no trace -- an argument on five premises of which one was bracketed drew with ONE arrow
   * and the map said it had one reason. `pcsRows` is what puts the missing lines back.
   */
  const pcs = [
    { n: 1, role: "premise", title: "A", text: "titled premise", step: 0, drawn: true },
    { n: 2, role: "premise", title: null, text: "bare premise", step: 0, drawn: false },
    { n: 3, role: "main-conclusion", title: null, text: "so this", step: 0, drawn: false,
      rule: "Modus ponens", uses: [1, 2] }
  ];
  const rows = pcsRows(pcs);
  say(rows.length === 2, "a line with a box of its own is not drawn twice");
  say(rows[0].n === 2 && rows[1].n === 3,
      "the numbers are the FILE'S -- a drawn line leaves a gap, it does not renumber the rest");
  say(rows[1].bar === true && rows[1].rule === "Modus ponens",
      "a conclusion carries the inference bar and the rule that licenses it");
  say(rows[0].bar === false && rows[0].rule === null,
      "a premise carries neither");
  say(pcsRows(null).length === 0 && pcsRows([]).length === 0,
      "an argument with no structure asks for no rows");
  say(pcsRows([{ n: 1, role: "premise", text: "x", step: 0, drawn: true }]).length === 0,
      "and one whose every line is drawn asks for none either");

  /* THE ENCLOSURE, which must never gather a claim that is not a premise of the step. */
  const P = (x, y) => ({ x, y, width: 80, height: 40 });
  const asBox = b => ({ id: "o", x0: b.x - b.width / 2, x1: b.x + b.width / 2,
                        y0: b.y - b.height / 2, y1: b.y + b.height / 2 });
  const two = [P(100, 300), P(220, 300)];
  const hull = premiseHull(two, []);
  say(!!hull, "two premises side by side get an enclosure");
  say(hull.x < 60 && hull.x + hull.width > 260 && hull.y < 280,
      "and it encloses both of them, with room to spare");
  say(premiseHull([P(100, 300)], []) === null,
      "one premise is not a group -- nothing to enclose");
  // The refusal. A stranger sitting between two premises must veto the enclosure: drawing it
  // would say that claim is one of the premises.
  say(premiseHull(two, [asBox(P(160, 300))]) === null,
      "an enclosure that would swallow another claim is REFUSED, not drawn");
  say(premiseHull(two, [asBox(P(160, 900))]) !== null,
      "a claim well clear of it does not veto anything");
}

console.log("\nthe real maps");
/** Every .argdown under IPSISSIMA_CORPUS, if one is set. */
function corpusFiles() {
  const root = process.env.IPSISSIMA_CORPUS;
  if (!root || !fs.existsSync(root)) return [];
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || ["node_modules", "Old versions", "t", "test"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".argdown")) out.push([e.name.replace(/\.argdown$/, ""), p]);
    }
  };
  walk(root);
  return out;
}

/* THE REAL MAPS. Two published samples: the long multi-section one and a short one, which is
 * the range these invariants are hardest on. Point IPSISSIMA_CORPUS at a folder of your own
 * reconstructions and every .argdown under it is checked too — the suite is deliberately
 * stronger on a machine that has more to check. */
const FILES = [
  ["Wilson", path.join(HERE, "..", "samples",
     "Wilson 2026 - Williams Dewey and the Nature of Value Inquiry", "wilson-williams-dewey.argdown")],
  ["Carroll", path.join(HERE, "..", "samples",
     "Carroll 1895 - What the Tortoise said to Achilles", "carroll-tortoise-achilles.argdown")],
  ...corpusFiles()
];
for (const [name, file] of FILES) {
  if (!fs.existsSync(file)) { console.log(`   ${name}: not on this machine, skipped`); continue; }
  const graph = withPositions(toGraph(await parseQuietly(fs.readFileSync(file, "utf8"))), file);
  exercise(name, graph);
  // and after a few real interactions, since geometry is recomputed on every render
  const tops = graph.groups.filter(g => !g.parent).map(g => g.id);
  let st = { collapsedGroups: new Set(tops), collapsedNodes: new Set(), expandedNodes: new Set(),
             groupFolded: new Map(), depth: null, facets: null };
  for (const gid of graph.groups.slice(0, 6).map(g => g.id)) {
    st = reduceFold(graph, st, { type: "toggleGroup", id: gid }, filterGraph(graph, st), {});
    const vis = filterGraph(graph, st);
    if (vis.nodes.length) checkGeometry(`${name} after opening ${gid}`, graph, vis,
                                        layoutByText(vis, sizesFor(vis)));
  }
}

console.log(`\n${cases} graphs, ${layouts} layouts checked` +
            (fellBack ? ` (${fellBack} shapes the layout refused)` : ""));
if (!layouts) { console.log("NOTHING WAS CHECKED — the harness is not exercising anything"); process.exit(1); }
console.log(failures ? `${failures} geometry failure(s)\n` : "all geometry invariants held\n");
process.exit(failures ? 1 : 0);
