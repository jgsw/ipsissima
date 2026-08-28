#!/usr/bin/env node
/* test_fold_state_id.mjs — the fold state identifier round-trips, and refuses what it must.
 *
 * WHY THIS EXISTS. The identifier's whole promise is "send the map and this line, and the state
 * can be rebuilt instead of guessed at". That promise is three claims, each checkable: decoding
 * an encoded state draws THE SAME PICTURE as the state it came from; re-encoding the decoded
 * state gives back the identical string, so equality of strings is equality of states; and a
 * string presented against the wrong map, or damaged in transit, is refused with a sentence
 * rather than applied as nonsense. The walk drives the same reduceFold the buttons call, so the
 * states exercised here are states a reader can actually reach.
 *
 *   node test_fold_state_id.mjs [--steps N] [--seed N]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/node";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { filterGraph, reduceFold, encodeFoldState, decodeFoldState, mapFingerprint,
        textLane, laneChapter } = require(path.join(HERE, "src", "argdown-live-map.js"));

const argv = process.argv.slice(2);
const opt = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const STEPS = opt("--steps", 250);
const SEED = opt("--seed", 7);

/* The walker below is the invariant harness's, cut to what a round-trip needs — the action
 * vocabulary and the synthetic positions come from test_fold_invariants.mjs and should change
 * with it. Importing them is not possible because that file runs its suite on import. */

const rng = seed => { let s = seed >>> 0;
                      return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

function withPositions(graph) {
  const nodes = (graph.nodes || []).map((n, i) => {
    if (i % 11 === 7) return Object.assign({}, n, { pos: null });
    const chapterIndex = i < graph.nodes.length / 2 ? 0 : 1;
    const section = (i % 4) + 1 + ". Section " + ((i % 4) + 1);
    return Object.assign({}, n, {
      pos: { chapter: "source/ch" + chapterIndex + ".md", chapterIndex,
             line: i, section, inBook: true, precision: "paraphrase" }
    });
  });
  return Object.assign({}, graph, { nodes });
}

function actionsFor(graph, vis, byText) {
  const acts = [{ type: "expandAll" }, { type: "collapseAll" },
                { type: "depth", value: null }, { type: "depth", value: 0 },
                { type: "depth", value: 1 }, { type: "depth", value: 2 }];
  if (byText) {
    const lanes = new Set();
    for (const n of graph.nodes || []) {
      const l = textLane(n);
      if (l === "gutter") continue;
      lanes.add(l); lanes.add(laneChapter(l));
    }
    for (const l of lanes) acts.push({ type: "toggleGroup", id: "lane:" + l });
    acts.push({ type: "byChapter" });
  } else {
    for (const g of graph.groups || []) acts.push({ type: "toggleGroup", id: g.id });
  }
  for (const n of vis.nodes) if (n.kind !== "group") acts.push({ type: "toggleNode", id: n.id });
  return acts;
}

/** The drawn picture, as a comparable string: node ids and edges, nothing positional. */
const visSig = vis => JSON.stringify({
  n: vis.nodes.map(n => n.id).sort(),
  e: (vis.edges || []).map(e => e.from + ">" + e.to + ":" + (e.type || "")).sort()
});

let failed = 0;
const ok = (name, cond, detail) => {
  if (!cond) { failed++; console.log(`   FAIL  ${name}${detail ? "\n         " + detail : ""}`); }
};

function walk(name, graph, byText) {
  const state = { collapsedGroups: new Set(), collapsedNodes: new Set(),
                  expandedNodes: new Set(), groupFolded: new Map(),
                  collapsedLanes: new Set(), depth: null, facets: null, byText: !!byText };
  const rand = rng(SEED);
  let cur = state, vis = filterGraph(graph, cur), checks = 0;
  for (let i = 0; i < STEPS; i++) {
    const acts = actionsFor(graph, vis, byText);
    const a = acts[Math.floor(rand() * acts.length)];
    cur = reduceFold(graph, cur, a, vis, {});
    vis = filterGraph(graph, cur);

    const snap = Object.assign({}, cur, { byText: !!byText });
    const enc = encodeFoldState(graph, snap);
    let dec;
    try { dec = decodeFoldState(graph, enc); }
    catch (e) { ok(`decode of an encoded state (step ${i})`, false, `${e.message}\n         ${enc}`); break; }

    checks++;
    ok(`same picture after round-trip (step ${i})`, visSig(filterGraph(graph, dec)) === visSig(vis), enc);
    ok(`canonical re-encode (step ${i})`, encodeFoldState(graph, dec) === enc, enc);
    if (failed) break;
  }
  console.log(`${name} [${byText ? "by position" : "by argument"}]: ` +
              `${checks} states round-tripped over ${STEPS} steps (seed ${SEED})`);
}

/* ------------------------------------------------------------------ the corpus walks */

function sampleFiles() {
  const root = path.join(HERE, "..", "samples");
  const out = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(root, dir.name)))
      if (f.endsWith(".argdown")) out.push([dir.name.split(" ")[0], path.join(root, dir.name, f)]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

const graphs = [];
for (const [name, file] of sampleFiles()) {
  const res = await argdown.runAsync({ input: fs.readFileSync(file, "utf8"), ...RUN });
  const graph = toGraph(res);
  graphs.push([name, graph]);
  walk(name, graph, false);
  walk(name, withPositions(graph), true);
}

/* ------------------------------------------------------------------ the refusals
 *
 * Small and synthetic on purpose: each is one property of the format, not a map. */

console.log("\nrefusals and edge cases");

const tiny = {
  nodes: [{ id: "n1", facet: "method" }, { id: "n2" }, { id: "n3", facet: "method" }],
  edges: [{ from: "n2", to: "n1", type: "support" }, { from: "n3", to: "n1", type: "attack" }],
  groups: [{ id: "s1", label: "One" }]
};
const empty = { collapsedGroups: new Set(), collapsedNodes: new Set(), expandedNodes: new Set(),
                groupFolded: new Map(), collapsedLanes: new Set(),
                depth: null, facets: null, byText: false };

ok("an empty state is two fields and nothing else",
   encodeFoldState(tiny, empty) === `ipsfold1 map=${mapFingerprint(tiny)} view=arg`,
   encodeFoldState(tiny, empty));

{ // Every optional field at once, including the ones the samples cannot reach: depth 0, an
  // empty facet set (which hides every faceted claim and is NOT the same as no facet filter),
  // a spine threshold, and a groupFolded mark.
  const full = { collapsedGroups: new Set(["s1"]), collapsedNodes: new Set(["n2"]),
                 expandedNodes: new Set(["n3"]), groupFolded: new Map([["n1", new Set(["s1"])]]),
                 collapsedLanes: new Set(), depth: 0, facets: new Set(), spine: 2, byText: false };
  const enc = encodeFoldState(tiny, full);
  const dec = decodeFoldState(tiny, enc);
  ok("depth 0, spine, an empty facet set and a gf mark all survive",
     encodeFoldState(tiny, dec) === enc, enc);
  ok("an empty facet set decodes as an empty set, not as null",
     dec.facets instanceof Set && dec.facets.size === 0);
  ok("a named facet round-trips",
     (() => { const f = Object.assign({}, full, { facets: new Set(["method"]) });
              return encodeFoldState(tiny, decodeFoldState(tiny, encodeFoldState(tiny, f)))
                     === encodeFoldState(tiny, f); })());
}

const threw = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const good = encodeFoldState(tiny, empty);

ok("a wrap between tokens is forgiven",
   visSig(filterGraph(tiny, decodeFoldState(tiny, good.replace(/ /g, "\n  ")))) ===
   visSig(filterGraph(tiny, empty)));
ok("the wrong map is refused, naming both fingerprints",
   graphs.length > 0 && threw(() => decodeFoldState(graphs[0][1], good), /different map/));
ok("a damaged id is refused as damage, not applied",
   threw(() => decodeFoldState(tiny, good + " folds=zz9"), /not a claim/));
ok("a field from the future is refused",
   threw(() => decodeFoldState(tiny, good + " zz=9"), /unknown field/));
ok("text that is not an identifier says so",
   threw(() => decodeFoldState(tiny, "hello there"), /starts with "ipsfold1"/));

if (failed) { console.log(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nthe identifier round-trips and refuses correctly");
