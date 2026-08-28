/* test_fold_exhaustive.mjs — every small map, every fold state, every node.
 *
 *   node app/test_fold_exhaustive.mjs [N]
 *
 * WHY THIS EXISTS BESIDE `test_fold_invariants.mjs`, which already walks the state space. That
 * one SAMPLES: a seeded random path through one real map, checking the invariants after each
 * action — and, decisively, checking them at the ONE node the action touched. Measured on the
 * 127-node Tooming map that is about 1.15 checks per state, on a map carrying some fifty fold
 * badges. Coverage per state is roughly one in fifty, chosen at random.
 *
 * That finds the defects which are common in the state space and misses the ones which are rare
 * in it and obvious on screen. Two badge defects reported by a reader in one afternoon had both
 * escaped 1,200-step runs at twelve seeds; an exhaustive sweep of one map found them in seconds.
 *
 * So this takes the other half of the trade. Instead of one big map and a random path, it takes
 * EVERY graph shape of N claims — all 21 of them at N=4, all 315 at N=5 — crosses each with
 * every combination of collapsed claims and every depth, and checks EVERY node in every state.
 * At N=4 that is 1,008 states, and it runs in under a second.
 *
 * WHAT IT IS FOR. A defect that survives here has a counterexample with four claims in it, which
 * a person can hold in their head. The first run found one: `n1->n0, n2->n1, n3->n1` with n0
 * shut, where an ALREADY-COLLAPSED claim still offered a minus. Nothing in the corpus showed it
 * and the fix was one line.
 *
 * IT USES `reduceFold`, NOT A DESCRIPTION OF IT. The first version of this harness modelled the
 * click by hand — adding to `expandedNodes`, forgetting that expanding also deletes from
 * `collapsedNodes` — and reported 648 defects in four-node graphs, every one of them its own.
 * That is the same mistake the code under test keeps making, and it is worth the reminder.
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { filterGraph, reduceFold } = require(path.join(HERE, "src", "argdown-live-map.js"));

/** Every connected shape on n claims whose every claim reaches the contention n0. */
function* shapes(n) {
  const slots = [];
  for (let c = 1; c < n; c++) for (let p = 0; p < c; p++) slots.push([c, p]);
  for (let mask = 0; mask < (1 << slots.length); mask++) {
    const edges = [];
    for (let i = 0; i < slots.length; i++)
      if (mask & (1 << i)) edges.push({ from: "n" + slots[i][0], to: "n" + slots[i][1], type: "support" });
    // CONNECTED, NOT SINGLE-ROOTED. Requiring every claim to reach n0 generates only maps with
    // ONE apex — and every reconstruction in the published corpus has between two and five. A
    // paper may argue for more than one thing, the conventions say so explicitly, and the walk
    // seeds from every root, so a second root is a second starting point for everything below.
    // Excluding them excluded the shape the corpus actually has.
    const und = new Map();
    for (const e of edges) {
      if (!und.has(e.from)) und.set(e.from, []);
      if (!und.has(e.to)) und.set(e.to, []);
      und.get(e.from).push(e.to); und.get(e.to).push(e.from);
    }
    const seenU = new Set(["n0"]); const q = ["n0"];
    while (q.length) { const x = q.pop();
      for (const y of und.get(x) || []) if (!seenU.has(y)) { seenU.add(y); q.push(y); } }
    if (seenU.size !== n) continue;      // a fragment is a different map, not this one
    // RELATION TYPES, because they are not interchangeable downstream: the rescue looks for a
    // neighbour of any kind, `contribution` excludes undercuts from the support-only analyses,
    // and an undercut targets an inference rather than a claim. Cycled rather than crossed --
    // crossing them multiplies the shape count by 3^edges for a distinction that is about which
    // KINDS are present, not about which edge has which.
    const kinds = ["support", "attack", "undercut"];
    for (const shift of (WITH_TYPES ? [0, 1, 2] : [0])) {
      yield { groups: [],
              nodes: Array.from({ length: n }, (_, i) => ({ id: "n" + i, label: "n" + i, facet: "claim" })),
              edges: edges.map((e, i) => Object.assign({}, e,
                { type: kinds[(i + shift) % (shift ? kinds.length : 1)] })) };
    }
    continue;
  }
}

const blank = () => ({ collapsedGroups: new Set(), collapsedNodes: new Set(),
                       expandedNodes: new Set(), groupFolded: new Map(),
                       collapsedLanes: new Set(), depth: null, facets: null, byText: false });

const REACH = (() => {
  const i = process.argv.indexOf("--reachable");
  return i < 0 ? 0 : Number(process.argv[i + 1] || 4);
})();
const N = Number(process.argv[2] || 4);
// SECTIONS TOO, because the corpus failures that survived the shapes above all had a
// `toggleGroup` in their trail — and a generator with no sections in it cannot reach them. Each
// claim is put in section A, section B, or none; each combination of shut sections is tried.
// That multiplies the state count, so it is opt-in and the run is longer.
const WITH_GROUPS = process.argv.includes("--groups");
const WITH_BANDS  = process.argv.includes("--bands");
const WITH_TYPES  = process.argv.includes("--types");

// A SECTION IS A CONTIGUOUS RUN OF THE FILE, not an arbitrary subset of the claims. Argdown
// sections are stretches of a document and nothing else can be one, so generating every subset
// spends the budget on shapes no reconstruction can have: at N=5 that is 242 groupings against
// 41 contiguous ones, and 29 million states against a number that finishes. Faithfulness and
// tractability point the same way here, which is not always true and is worth taking when it is.
const GROUPINGS = [];
if (WITH_GROUPS) {
  GROUPINGS.push(...runs(N));
}
function runs(n) {
  const out = [];
  for (let a0 = 0; a0 < n; a0++) for (let a1 = a0; a1 < n; a1++) {
    const g = Array(n).fill(null);
    for (let i = a0; i <= a1; i++) g[i] = "gA";
    out.push(g.slice());
    for (let b0 = a1 + 1; b0 < n; b0++) for (let b1 = b0; b1 < n; b1++) {
      const h = g.slice();
      for (let i = b0; i <= b1; i++) h[i] = "gB";
      out.push(h);
    }
  }
  return out;
}
let shapeCount = 0, states = 0, checks = 0, plus = 0, minus = 0;
const worst = [];

for (const bare of shapes(N)) {
 for (const grouping of (WITH_GROUPS ? GROUPINGS : [null])) {
  const g = grouping
    ? { groups: [{ id: "gA", label: "Section A" }, { id: "gB", label: "Section B" }],
        nodes: bare.nodes.map((n, i) => Object.assign({}, n, { group: grouping[i] })),
        edges: bare.edges }
    : bare;
  shapeCount++;
  const ids = g.nodes.map(n => n.id);
  const shutSets = WITH_GROUPS ? [[], ["gA"], ["gB"], ["gA", "gB"]] : [[]];
  // BANDS ARE THE OTHER ARRANGEMENT, and they suppress by a different route: `collapsedLanes`
  // keyed by `ch:<index>|<section>`, read off each claim's `pos`. A claim needs a position for
  // the by-position view to place it at all, so one is invented here — two chapters, two
  // sections each, in document order, which is the smallest thing that has bands to fold.
  const laned = WITH_BANDS
    ? Object.assign({}, g, { nodes: g.nodes.map((n, i) => Object.assign({}, n,
        { pos: { chapterIndex: i < Math.ceil(N / 2) ? 0 : 1,
                 section: i % 2 ? "b" : "a", chapter: "c.md", line: i + 1 } })) })
    : g;
  const laneSets = WITH_BANDS
    ? [[], ["ch:0"], ["ch:0|a"], ["ch:1"], ["ch:0", "ch:1"]] : [[]];
  const views = WITH_BANDS ? [false, true] : [false];
  for (let cm = 0; cm < (1 << ids.length); cm++) for (const depth of [null, 1, 2])
   for (const shut of shutSets) for (const lanes of laneSets) for (const byText of views) {
    if (byText && !WITH_BANDS) continue;
    if (!byText && lanes.length) continue;          // lanes only mean something by position
    const state = Object.assign(blank(),
      { depth, byText, collapsedGroups: new Set(shut),
        collapsedLanes: new Set(lanes),
        collapsedNodes: new Set(ids.filter((_, i) => cm & (1 << i))) });
    let before;
    const G = laned;
    try { before = filterGraph(G, state); } catch { continue; }
    states++;
    for (const n of before.nodes) {
      if (!n.expandable) continue;                         // no badge, nothing promised
      // A BLOCK CARRIES A BADGE TOO, and it was being skipped. A folded section and a folded
      // band are drawn as one box with a count on it and the same promise attached — and the
      // by-position view has almost no claim badges at all, so skipping blocks left that whole
      // arrangement effectively unchecked. A block is toggled by `toggleGroup`, and a lane's id
      // carries the `lane:` prefix the reducer expects.
      const act = n.kind === "group"
        ? { type: "toggleGroup", id: n.lane ? "lane:" + n.lane : (n.groupId || n.id) }
        : { type: "toggleNode", id: n.id };
      checks++;
      const after = filterGraph(G, reduceFold(G, state, act, before, {}));
      const b = new Set(before.nodes.map(x => x.id)), a = new Set(after.nodes.map(x => x.id));
      const gained = [...a].some(id => !b.has(id)), lost = [...b].some(id => !a.has(id));
      // A collapsed block always shows "+N": opening it must reveal. A claim shows "+" or "−".
      const bad = (n.kind === "group" || n.hidden > 0) ? !gained : !lost;
      if (!bad) continue;
      (n.hidden > 0 ? plus : minus, n.hidden > 0 ? plus++ : minus++);
      if (worst.length < 3) worst.push(
        `  ${n.kind === "group" ? "block +" + n.hidden : n.hidden > 0 ? "+" + n.hidden : "−"} on ${n.id}  ` +
        `edges ${g.edges.map(e => e.from + "->" + e.to).join(" ")}  ` +
        (state.byText ? `[by position] lanes {${[...state.collapsedLanes].join(",")}}  ` : "") +
        `collapsed {${[...state.collapsedNodes].join(",")}} ` +
        `shut {${[...state.collapsedGroups].join(",")}} depth=${depth}  ` +
        (grouping ? `groups ${grouping.map((v, i) => "n" + i + ":" + (v || "-")).join(" ")}  ` : "") +
        `drawn ${before.nodes.map(x => x.id).join(",")}`);
    }
  }
 }
}

if (REACH) {
  /* EVERY STATE A READER CAN ACTUALLY REACH, which is not the same set as every state that can
   * be CONSTRUCTED — and the difference is where the last defects live.
   *
   * The sweep above enumerates `collapsedNodes` subsets directly and leaves `expandedNodes`
   * empty and `groupFolded` empty. No reader ever arrives at a state that way. `reduceFold`
   * writes into all three: expanding a claim deletes its fold, adds it to `expandedNodes`, and
   * then STEPWISE-COLLAPSES its children one at a time, keeping each fold only if the map still
   * represents everything it did. States like that are reachable and were never generated, and
   * the one corpus failure left at the committed seed is nine `toggleNode`s deep.
   *
   * So: breadth-first over action sequences from the opening state, deduplicated by the state
   * itself, checking every badge at every state reached. Exhaustive to the given depth.
   */
  const key = s => JSON.stringify([[...s.collapsedNodes].sort(), [...s.expandedNodes].sort(),
                                   [...s.collapsedGroups].sort(), [...s.collapsedLanes].sort(),
                                   [...(s.groupFolded || new Map())].map(String).sort(), s.depth]);
  let reached = 0, rchecks = 0, rplus = 0, rminus = 0;
  const rworst = [];
  for (const bare of shapes(N)) {
    for (const grouping of (WITH_GROUPS ? GROUPINGS : [null])) {
      const g = grouping
        ? { groups: [{ id: "gA", label: "Section A" }, { id: "gB", label: "Section B" }],
            nodes: bare.nodes.map((n, i) => Object.assign({}, n, { group: grouping[i] })),
            edges: bare.edges }
        : bare;
      const seen = new Set();
      let frontier = [blank()];
      seen.add(key(frontier[0]));
      for (let d = 0; d < REACH; d++) {
        const next = [];
        for (const st of frontier) {
          let vis; try { vis = filterGraph(g, st); } catch { continue; }
          reached++;
          const acts = [];
          for (const n of vis.nodes) {
            if (!n.expandable) continue;
            acts.push(n.kind === "group"
              ? { type: "toggleGroup", id: n.lane ? "lane:" + n.lane : (n.groupId || n.id) }
              : { type: "toggleNode", id: n.id });
          }
          for (const act of acts) {
            const n = vis.nodes.find(x => (act.type === "toggleNode" ? x.id === act.id
                                          : (x.lane ? "lane:" + x.lane : x.groupId || x.id) === act.id));
            const st2 = reduceFold(g, st, act, vis, {});
            let after; try { after = filterGraph(g, st2); } catch { continue; }
            rchecks++;
            const b = new Set(vis.nodes.map(x => x.id)), a = new Set(after.nodes.map(x => x.id));
            const gained = [...a].some(id => !b.has(id)), lost = [...b].some(id => !a.has(id));
            const bad = (n.kind === "group" || n.hidden > 0) ? !gained : !lost;
            if (bad) {
              (n.kind === "group" || n.hidden > 0) ? rplus++ : rminus++;
              if (rworst.length < 4) rworst.push(
                `  ${n.kind === "group" ? "block" : n.hidden > 0 ? "+" + n.hidden : "−"} on ${n.id}  ` +
                `edges ${g.edges.map(e => e.from + "->" + e.to).join(" ")}  ` +
                `collapsed {${[...st.collapsedNodes].join(",")}} expanded {${[...st.expandedNodes].join(",")}} ` +
                `shut {${[...st.collapsedGroups].join(",")}}  drawn ${vis.nodes.map(x => x.id).join(",")}`);
            }
            const k = key(st2);
            if (!seen.has(k)) { seen.add(k); next.push(st2); }
          }
        }
        frontier = next;
        if (!frontier.length) break;
      }
    }
  }
  console.log(`\n== every REACHABLE state of ${N} claims, to depth ${REACH}\n`);
  console.log(`  ${reached.toLocaleString()} states, ${rchecks.toLocaleString()} node-checks`);
  console.log(`  "+" / block badges that reveal nothing: ${rplus}`);
  console.log(`  "−" badges that hide nothing:           ${rminus}`);
  if (rworst.length) { console.log("\n  smallest cases:"); rworst.forEach(w => console.log(w)); }
  console.log();
  process.exit(rplus + rminus ? 1 : 0);
}

console.log(`\n== every map of ${N} claims\n`);
console.log(`  ${shapeCount} shapes, ${states.toLocaleString()} states, ${checks.toLocaleString()} node-checks`);
console.log(`  "+" badges that reveal nothing: ${plus}`);
console.log(`  "−" badges that hide nothing:   ${minus}`);
if (worst.length) { console.log("\n  smallest cases:"); worst.forEach(w => console.log(w)); }
console.log();
process.exit(plus + minus ? 1 : 0);
