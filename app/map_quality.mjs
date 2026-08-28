#!/usr/bin/env node
/* map_quality.mjs — measure how a map LOOKS, on every real map, at every depth level.
 *
 *   node app/map_quality.mjs            # table + baseline check
 *   node app/map_quality.mjs --baseline # record current numbers
 *   node "app/map_quality.mjs --map NAME" # one map only
 *   node "app/map_quality.mjs --render DIR" # SVGs to look at
 *
 * WHY THIS EXISTS. Every layout defect in this renderer was found by the author looking at a
 * picture, and only then measured: arrowheads hidden under fold badges, corners turned inside
 * twenty units, lines detouring three times the direct distance, arrivals crossing beneath a
 * node, and lines bulging out and back after their arrival point moved. Each was fixed and given
 * a regression test, so each cannot come back -- but none of them was CAUGHT by anything, and
 * the next one of the same family would not be either.
 *
 * These are aesthetic faults with objective correlates. This measures the correlates. It is not
 * pass/fail by nature: `bendMedian` is not a bug at 4 and a bug at 5. So it prints a table, and
 * compares against a recorded baseline, and complains when something gets materially worse.
 * Deliberate improvements are recorded by re-running with --baseline.
 *
 * IT MEASURES WHAT IS DRAWN. The points come from `edgeGeometry` in argdown-live-map.js, the
 * same function the renderer draws from. Earlier metrics re-derived the geometry by hand and
 * disagreed with the picture: one filtered arrivals differently from the code and reported zero
 * crossings on a map that plainly had them, which nearly shipped as "fixed".
 *
 * EVERY DEPTH LEVEL, because the layout is rebuilt for each one and a fault can live in exactly
 * one. The detours the author noticed at "+ detail" were absent from the default view.
 *
 * AND IT CAN DRAW. `--render DIR` writes an SVG per map, cropped to its busiest node -- the one
 * with the most arrivals, which is where crowding shows first. Numbers are not enough on their
 * own: the crossing metric that reported zero on a visibly crossed map was caught by looking at
 * the picture and disbelieving the number. Measure, change, measure, then LOOK.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dagre from "@dagrejs/dagre";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";
import { createRequire } from "module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const API = createRequire(import.meta.url)(path.join(HERE, "src", "argdown-live-map.js"));
const BASELINE = path.join(HERE, "map-quality-baseline.json");
const SKIP = new Set(["node_modules", "Old versions", ".argument-history", "t", "test", "dot"]);

function findMaps() {
  // The published samples, and any private corpus the user names — see rebuild_viewers.mjs.
  const roots = [path.join(REPO, "samples"),
                 ...(process.env.IPSISSIMA_CORPUS ? [process.env.IPSISSIMA_CORPUS] : [])];
  const out = [];
  const walk = dir => {
    let es = [];
    try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); }
      else if (e.name.endsWith(".argdown")) out.push(path.join(dir, e.name));
    }
  };
  roots.forEach(walk);
  return out.sort();
}

// The renderer measures real text; here the width is estimated from the label. That makes the
// numbers comparable run to run, which is what a baseline needs, and is why they are not the
// same as any particular browser's.
const size = n => ({ width: Math.max(90, Math.min(190, 8 + (n.label || "").length * 5.5)),
                     height: 54 + Math.floor((n.label || "").length / 34) * 12 });

function layoutAt(graph, depth, foldSections) {
  const S = { collapsedGroups: foldSections ? new Set((graph.groups || []).map(gr => gr.id))
                                            : new Set(),
              collapsedNodes: new Set(), expandedNodes: new Set(),
              depth, facets: null };
  const vis = API.filterGraph(graph, S);
  if (!vis.nodes.length) return null;
  const sizes = new Map(vis.nodes.map(n => [n.id, size(n)]));
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({ rankdir: "BT", ranksep: 46, nodesep: 22, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of vis.nodes) g.setNode(n.id, size(n));
  for (const gr of vis.groups) g.setNode(gr.id, {});
  for (const gr of vis.groups) if (gr.parent) g.setParent(gr.id, gr.parent);
  for (const n of vis.nodes) if (n.group) g.setParent(n.id, n.group);
  for (const e of vis.edges) g.setEdge(e.from, e.to, {}, e.type);
  try { dagre.layout(g); } catch { return null; }
  API.seatInDocumentOrder(g, vis, true);
  return { g, vis, sizes, geometry: API.edgeGeometry(g, vis, sizes) };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLen = p => p.slice(1).reduce((s, q, i) => s + dist(q, p[i]), 0);
const bowOf = p => {
  if (p.length < 3) return 0;
  const a = p[0], b = p[p.length - 1], len = dist(a, b) || 1;
  let m = 0;
  for (let i = 1; i < p.length - 1; i++)
    m = Math.max(m, Math.abs((b.x - a.x) * (a.y - p[i].y) - (a.x - p[i].x) * (b.y - a.y)) / len);
  return m;
};
const segInt = (p1, p2, p3, p4) => {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
};

/** Every metric is the objective trace of something that was once wrong and was noticed by eye. */
function measure(L) {
  const { g, vis, sizes, geometry } = L;
  const boxes = API.boxesOf(g, vis);
  const paths = [], byTarget = new Map(), bySource = new Map();
  let hiddenArrowheads = 0, overshoot = 0, detourWorst = 0, avoidableBend = 0;
  const bows = [];

  for (const e of g.edges()) {
    const key = `${e.v} ${e.w} ${e.name}`;
    const p = geometry.get(key);
    if (!p || p.length < 2) continue;
    paths.push(p);
    const end = p[p.length - 1], box = g.node(e.w), s = sizes.get(e.w), src = g.node(e.v);

    // 1. Can the arrowhead be seen? It is drawn at the last point; the fold badge is a filled
    //    circle at the bottom centre, painted after the edges.
    //
    //    ONLY WHERE A BADGE IS ACTUALLY DRAWN. This used to compute the badge position for every
    //    node and count an arrowhead near it as hidden, which was accidentally right while
    //    `expandable` meant "has children at all" -- nearly every node had one. Once the badge
    //    was drawn only where it does something, this went on counting arrowheads that nothing
    //    was hiding, and reported a correctness regression on maps whose drawing had not
    //    changed. `badgeCentres` in the renderer has always filtered on `expandable`; this is
    //    the same rule, said once more, and the two must agree.
    const target = vis.nodes.find(n => n.id === e.w);
    if (box && s && target && target.expandable) {
      const badge = { x: box.x, y: box.y + s.height / 2 };
      if (dist(end, badge) < API.BADGE_R) hiddenArrowheads++;
    }
    // 2. Do two arrivals at one node cross beneath it?
    if (box && s && src && end.y >= box.y - 1 && Math.abs(end.x - box.x) <= s.width / 2 + 3) {
      if (!byTarget.has(e.w)) byTarget.set(e.w, []);
      byTarget.get(e.w).push({ fromX: src.x, atX: end.x });
    }
    // 2b. And do two edges LEAVING one node cross each other just above it? The mirror of the
    //     question above, and it went unasked until the author saw it on the opening view.
    const start = p[0], sbox = g.node(e.v), ss = sizes.get(e.v), tgt = g.node(e.w);
    if (sbox && ss && tgt && start.y <= sbox.y + 1 && Math.abs(start.x - sbox.x) <= ss.width / 2 + 3) {
      if (!bySource.has(e.v)) bySource.set(e.v, []);
      bySource.get(e.v).push({ toX: tgt.x, atX: start.x });
    }
    // 3. How far does the line wander sideways of its own two ends?
    const lo = Math.min(p[0].x, end.x), hi = Math.max(p[0].x, end.x);
    for (let i = 1; i < p.length - 1; i++)
      overshoot = Math.max(overshoot, lo - p[i].x, p[i].x - hi);
    // 4. How much longer is it than the direct route?
    const straight = dist(p[0], end);
    if (straight > 1) detourWorst = Math.max(detourWorst, pathLen(p) / straight);
    // 5. How bent is it -- and, the one that matters, is the bend AVOIDABLE? A line bent around
    //    a claim is dagre earning its keep; a line bent around nothing is clutter.
    const bow = bowOf(p);
    bows.push(bow);
    if (bow > 6 && API.straightenIfSafe(p, boxes, new Set([e.v, e.w]))) avoidableBend++;
  }

  let arrivalInversions = 0;
  for (const [, list] of byTarget)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        if ((list[i].fromX - list[j].fromX) * (list[i].atX - list[j].atX) < 0) arrivalInversions++;

  let departureInversions = 0;
  for (const [, list] of bySource)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        if ((list[i].toX - list[j].toX) * (list[i].atX - list[j].atX) < 0) departureInversions++;

  let edgeCrossings = 0;
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++) {
      let hit = false;
      for (let a = 0; a < paths[i].length - 1 && !hit; a++)
        for (let b = 0; b < paths[j].length - 1; b++)
          if (segInt(paths[i][a], paths[i][a + 1], paths[j][b], paths[j][b + 1])) { hit = true; break; }
      if (hit) edgeCrossings++;
    }

  bows.sort((a, b) => a - b);
  return {
    edges: paths.length,
    hiddenArrowheads, arrivalInversions, departureInversions, avoidableBend,
    bendMedian: +(bows[Math.floor(bows.length / 2)] || 0).toFixed(1),
    bendWorst: +(bows[bows.length - 1] || 0).toFixed(0),
    overshoot: +overshoot.toFixed(0),
    detourWorst: +detourWorst.toFixed(1),
    edgeCrossings,
    nodeOverlaps: API.overlapsAnywhere(g, vis) ? 1 : 0
  };
}

// Metrics where a RISE is a regression, with how much slack is noise rather than news.
const WORSE_IF_UP = { hiddenArrowheads: 0, arrivalInversions: 0, departureInversions: 0,
                      nodeOverlaps: 0,
                      avoidableBend: 2, bendMedian: 2, bendWorst: 40, overshoot: 15,
                      detourWorst: 0.4, edgeCrossings: 0.08 };
// The last entry is THE STATE THE VIEWER OPENS IN -- folded to the section skeleton above 25
// nodes. Sweeping only the depth levels missed it, and it was where two edges out of one node
// crossed on the Gettier map. A state nobody measures is a state that stays broken.
const LEVELS = [["main", 1], ["reasons", 2], ["detail", 3], ["all", null], ["folded", null, true]];
const COLS = ["edges", "hiddenArrowheads", "arrivalInversions", "departureInversions",
              "avoidableBend",
              "bendMedian", "bendWorst", "overshoot", "detourWorst", "edgeCrossings",
              "nodeOverlaps"];
const SHORT = { edges: "edges", hiddenArrowheads: "hidden", arrivalInversions: "cross@node",
                departureInversions: "cross@out", avoidableBend: "avoidBend", bendMedian: "bend~", bendWorst: "bendMax",
                overshoot: "overshoot", detourWorst: "detour", edgeCrossings: "edgeX",
                nodeOverlaps: "overlap" };

/** One map, cropped to its busiest node, as an SVG -- something to actually look at. */
function render(L, file, title) {
  const { g, vis, sizes, geometry } = L;
  const count = new Map();
  for (const e of g.edges()) count.set(e.w, (count.get(e.w) || 0) + 1);
  if (!count.size) return false;
  const busiest = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const c = g.node(busiest);
  if (!c || c.x == null) return false;
  const W = 620, H = 420, x0 = c.x - W / 2, y0 = c.y - H * 0.32;
  const smooth = pts => {
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
    const l = pts[pts.length - 1];
    if (pts.length === 3)
      return `M${pts[0].x},${pts[0].y}Q${pts[1].x},${pts[1].y} ${(pts[1].x + pts[2].x) / 2},${(pts[1].y + pts[2].y) / 2}L${l.x},${l.y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], cc = pts[i + 1];
      const la = Math.hypot(b.x - a.x, b.y - a.y), lc = Math.hypot(cc.x - b.x, cc.y - b.y);
      const t = Math.min(22, la / 2, lc / 2);
      if (!(t > 0.5)) { d += `L${b.x},${b.y}`; continue; }
      d += `L${b.x - (b.x - a.x) / la * t},${b.y - (b.y - a.y) / la * t}Q${b.x},${b.y} ${b.x + (cc.x - b.x) / lc * t},${b.y + (cc.y - b.y) / lc * t}`;
    }
    return d + `L${l.x},${l.y}`;
  };
  let body = "";
  for (const n of vis.nodes) {
    const p = g.node(n.id), s2 = sizes.get(n.id);
    if (!p || !s2 || p.x == null) continue;
    body += `<rect x="${p.x - s2.width / 2}" y="${p.y - s2.height / 2}" width="${s2.width}" height="${s2.height}" rx="7" fill="#fff" stroke="#3f4550" stroke-width="1.3"/>`;
    if (n.expandable)
      body += `<circle cx="${p.x}" cy="${p.y + s2.height / 2}" r="9" fill="#fff" stroke="#8a8a8a" stroke-width="1.2"/>`;
  }
  for (const e of g.edges()) {
    const pts = geometry.get(`${e.v} ${e.w} ${e.name}`);
    if (!pts || pts.length < 2) continue;
    const col = e.name === "attack" ? "#cc3b3b" : e.name === "undercut" ? "#d08018" : "#3a9d5d";
    body += `<path d="${smooth(pts)}" fill="none" stroke="${col}" stroke-width="1.8" marker-end="url(#q-${e.name})"/>`;
  }
  const marks = ["support:#3a9d5d", "attack:#cc3b3b", "undercut:#d08018", "contradictory:#8b5cc7"]
    .map(x => { const [k, v] = x.split(":");
      return `<marker id="q-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${v}"/></marker>`; })
    .join("");
  fs.writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 1.9}" height="${H * 1.9}" viewBox="${x0} ${y0 - 26} ${W} ${H}" font-family="-apple-system,Helvetica,sans-serif">
<defs>${marks}</defs><rect x="${x0}" y="${y0 - 26}" width="${W}" height="${H}" fill="#fbfbfb"/>
<text x="${x0 + 8}" y="${y0 - 10}" font-size="12" font-weight="600">${title}</text>${body}</svg>`);
  return true;
}

const args = process.argv.slice(2);
const only = args.includes("--map") ? args[args.indexOf("--map") + 1] : null;
const writing = args.includes("--baseline");
const renderDir = args.includes("--render") ? args[args.indexOf("--render") + 1] : null;
if (renderDir) fs.mkdirSync(renderDir, { recursive: true });
const results = {};

for (const file of findMaps()) {
  const name = path.basename(file, ".argdown");
  if (only && !name.includes(only)) continue;
  let graph;
  try {
    const res = argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN });
    if (!res.map) continue;
    graph = toGraph(res);
  } catch { continue; }
  for (const [levelName, depth, fold] of LEVELS) {
    const L = layoutAt(graph, depth, fold);
    if (!L) continue;
    results[`${name} @ ${levelName}`] = measure(L);
    if (renderDir && depth === null)
      render(L, path.join(renderDir, name.replace(/[^\w.-]+/g, "-") + ".svg"), `${name} — everything`);
  }
}

const rows = Object.keys(results);
if (!rows.length) { console.error("no maps found"); process.exit(1); }

const label = Math.min(46, Math.max(...rows.map(r => r.length)));
console.log("  " + "map @ level".padEnd(label) +
            COLS.map(c => SHORT[c].padStart(10)).join(""));
for (const r of rows)
  console.log("  " + r.slice(0, label).padEnd(label) +
              COLS.map(c => String(results[r][c]).padStart(10)).join(""));

if (renderDir) console.log(`\nwrote SVGs to ${renderDir} — open them and LOOK.`);
if (writing) {
  fs.writeFileSync(BASELINE, JSON.stringify(results, null, 1) + "\n");
  console.log(`\nrecorded ${rows.length} rows as the baseline.`);
  console.log("Do this only when the change was deliberate and the numbers were read.");
  process.exit(0);
}
if (!fs.existsSync(BASELINE)) {
  console.log("\nno baseline yet — run with --baseline to record one.");
  process.exit(0);
}
const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const worse = [], better = [], missing = [];
for (const r of rows) {
  if (!base[r]) { missing.push(r); continue; }
  for (const c of COLS) {
    const was = base[r][c], now = results[r][c];
    if (typeof was !== "number") continue;
    const slack = WORSE_IF_UP[c];
    if (slack == null) continue;
    const allow = c === "edgeCrossings" ? Math.max(2, was * slack) : slack;
    if (now > was + allow) worse.push(`${r}  ${c}: ${was} -> ${now}`);
    else if (now < was - (allow || 0.001)) better.push(`${r}  ${c}: ${was} -> ${now}`);
  }
}
if (missing.length) console.log(`\n${missing.length} row(s) not in the baseline (new map or level).`);
if (better.length) {
  console.log(`\nBETTER than the baseline (${better.length}):`);
  for (const b of better.slice(0, 12)) console.log("  " + b);
}
if (worse.length) {
  console.log(`\nWORSE than the baseline (${worse.length}):`);
  for (const w of worse) console.log("  " + w);
  console.log("\nIf the change was deliberate, re-record with --baseline.");
  process.exit(1);
}
console.log("\nno metric is materially worse than the baseline.");
