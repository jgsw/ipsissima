#!/usr/bin/env node
/* test_fold_invariants.mjs — walk the map's state space and check what must always hold.
 *
 * WHY THIS EXISTS. Three visibility bugs reached the author in a row, each found by clicking
 * around: opening a section blanked the map; opening a section unfurled five levels; a pane
 * painted over the others. They were found by hand because the fold logic lived inside a
 * DOM-bound closure where nothing could enumerate the states it produces. `reduceFold` is now
 * pure and exported, and this drives it — the same function the buttons call, not a copy.
 *
 * WHAT IT DOES. From a few starting states it applies every legal action (open/close each
 * section, toggle each claim, each depth setting, expand-all, collapse-all), and after each one
 * checks the invariants below. Depth-1 is exhaustive; beyond that it walks a seeded random path,
 * so a failure is reproducible from the printed seed and action trail.
 *
 * WHAT IT DOES NOT COVER. Geometry. Positions come from measuring real text in a real SVG, so
 * overlap and column order are checked in the browser instead. This harness is about which
 * nodes are visible, which is where every reported bug has actually been.
 *
 *   node test_fold_invariants.mjs [--steps N] [--seed N]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/node";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { filterGraph, reduceFold, membersOfGroup, index, frameFor, textLane, laneChapter } =
  require(path.join(HERE, "src", "argdown-live-map.js"));

/** Is this a band of the by-position view rather than an Argdown section? */
const isLane = id => typeof id === "string" && id.startsWith("lane:");

/** What a fold of `id` stands for, in whichever view is running. */
const membersFor = (graph, id) => isLane(id)
  ? (graph.nodes || []).filter(n => {
      const l = textLane(n), want = id.slice(5);
      return l !== "gutter" && (l === want || laneChapter(l) === want);
    }).map(n => n.id)
  : membersOfGroup(graph, id);

const argv = process.argv.slice(2);
const opt = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const STEPS = opt("--steps", 1500);
const SEED = opt("--seed", 20260817);

/* --------------------------------------------------------------- the invariants */

/** Each takes (graph, before, after, action, ctx) and returns null or a complaint. */
const INVARIANTS = [
  {
    name: "edges are closed over the visible nodes",
    check: (g, before, after) => {
      const ids = new Set(after.nodes.map(n => n.id));
      const bad = after.edges.find(e => !ids.has(e.from) || !ids.has(e.to));
      return bad ? `edge ${bad.from} -> ${bad.to} has an end that is not drawn` : null;
    }
  },
  {
    name: "no node is drawn twice",
    check: (g, before, after) => {
      const seen = new Set();
      for (const n of after.nodes) {
        if (seen.has(n.id)) return `${n.id} appears twice`;
        seen.add(n.id);
      }
      return null;
    }
  },
  {
    name: "a claim is never both folded and hand-opened",
    check: (g, before, after, action, ctx) => {
      const both = [...ctx.state.collapsedNodes].find(id => ctx.state.expandedNodes.has(id));
      return both ? `${both} is in collapsedNodes and expandedNodes at once` : null;
    }
  },
  {
    name: "the main contention is always on screen",
    check: (g, before, after, action, ctx) => {
      if (!after.nodes.length) return null;                 // empty map is its own case
      const shown = represented(g, after);
      const missing = ctx.apex.filter(id => !shown.has(id));
      return missing.length ? `apex ${missing.join(", ")} is not represented` : null;
    }
  },
  {
    name: "opening a section hides no claim outside it",
    when: a => a.type === "toggleGroup",
    check: (g, before, after, action, ctx) => {
      if (!ctx.opening || ctx.state.depth != null) return null;   // see the note above
      const mine = new Set(membersFor(g, action.id));
      const was = represented(g, before), now = represented(g, after);
      const lost = [...was].filter(id => !mine.has(id) && !now.has(id));
      if (!lost.length) return null;
      // A CRUTCH MAY BE WITHDRAWN. The filter lets a held-back claim through when something
      // would otherwise be drawn with nothing attached; opening another section can supply the
      // missing connection properly, and the crutch is then not let through again. Nothing of
      // the argument is lost when that happens — the claims it was holding on are still there,
      // still attached — so the test asks exactly that, rather than counting.
      const att = new Set();
      for (const e of after.edges) { att.add(e.from); att.add(e.to); }
      const real = new Set();
      for (const e of g.edges || []) { real.add(e.from); real.add(e.to); }
      const adrift = after.nodes.filter(n => !att.has(n.id) &&
        (n.members ? n.members.some(m => real.has(m)) : real.has(n.id)) &&
        !ctx.state.collapsedNodes.has(n.id));
      if (!adrift.length && lost.every(id => real.has(id))) return null;
      return `${lost.length} claim(s) outside the section vanished, ` +
             `e.g. ${lost.slice(0, 3).join(", ")}`;
    }
  },
  {
    name: "opening a section reveals one level of it, not several",
    when: a => a.type === "toggleGroup",
    check: (g, before, after, action, ctx) => {
      // A band has no stepwise unfurling to police — it is a stretch of the text, shown or not.
      if (!ctx.opening || isLane(action.id)) return null;
      const mem = new Set(membersOfGroup(g, action.id));
      // A section the reader has already opened claims inside BY HAND is theirs, not the
      // machine's: those stay open deliberately (there is a test for that), and whatever they
      // reveal is not the section over-unfurling. Only police sections nobody has customised.
      if ([...ctx.state.expandedNodes].some(id => mem.has(id))) return null;
      const shownInside = after.nodes.filter(n => mem.has(n.id)).map(n => n.id);
      if (!shownInside.length) return null;
      const depth = depthWithinGroup(g, mem);
      const deeper = shownInside.filter(id => (depth.get(id) || 0) > 0);
      if (!deeper.length) return null;
      // A DEEPER CLAIM IS ALLOWED IF IT IS HOLDING SOMETHING ON. Opening a section marks its
      // members so only the claims it starts from show — but a claim outside the section may
      // have no other neighbour, and hiding its one connection would leave it adrift. The
      // filter lets exactly those through, so the test asks which of the deeper claims are
      // load-bearing for connectivity and complains only about the rest.
      // A DEEPER CLAIM EARNS ITS PLACE BY HOLDING SOMETHING ON. The filter lets one through only
      // when a drawn claim would otherwise have nothing attached — outside the section (a claim
      // whose one neighbour is inside it) or inside it (an entry claim whose one reason is a
      // level down). So the question is simply: take this claim away again, and does anything
      // come adrift?
      //
      // Asked of the DRAWN graph, not the source. A neighbour folded into a block is still a
      // neighbour on screen, and the block's synthetic id is nowhere in the source edges — an
      // earlier version of this test looked there and concluded, wrongly, that seven perfectly
      // well-connected claims were floating.
      const attachedWithout = d => {
        const att = new Set();
        for (const e of after.edges) {
          if (e.from === d || e.to === d) continue;
          att.add(e.from); att.add(e.to);
        }
        return att;
      };
      const alreadyAdrift = new Set();
      {
        const att = new Set();
        for (const e of after.edges) { att.add(e.from); att.add(e.to); }
        for (const n of after.nodes) if (!att.has(n.id)) alreadyAdrift.add(n.id);
      }
      const gratuitous = deeper.filter(d => {
        const att = attachedWithout(d);
        return after.nodes.every(n => n.id === d || att.has(n.id) || alreadyAdrift.has(n.id));
      });
      // A STATED TOLERANCE, not a threshold tuned until the tests went green. The connectivity
      // rescue has to decide what is attached BEFORE it knows the final picture — a neighbour
      // may end up folded into a block, which attaches it, or into the SAME block, which does
      // not — so it is greedy, and can leave one claim on screen that a later rescue made
      // redundant. Measured: one such claim on one section of the Williams map, none anywhere
      // on the book. What this invariant is guarding against is a section dumping its contents
      // on the reader, and two claims of slack cannot hide that.
      const SLACK = 2;
      return gratuitous.length > SLACK
        ? `${gratuitous.length} claim(s) from below the section's entry level are showing for ` +
          `no reason (${shownInside.length} of its ${mem.size} claims are up)`
        : null;
    }
  },
  {
    // Only with no depth limit in force. A depth limit is an explicit instruction to hide
    // anything more than N steps out, and folds compress many steps into one: a section shown
    // as a single block costs one hop, and the same section opened costs one per claim. So
    // expanding under a limit can legitimately push distant material past it. Demanding
    // otherwise would be demanding the depth control away.
    name: "expanding a claim hides nothing that was on screen (no depth limit)",
    when: a => a.type === "toggleNode",
    check: (g, before, after, action, ctx) => {
      if (!ctx.expanding || ctx.state.depth != null) return null;
      const was = represented(g, before), now = represented(g, after);
      const lost = [...was].filter(id => !now.has(id));
      return lost.length ? `expanding ${action.id} hid ${lost.length}: ` +
                           `${lost.slice(0, 3).join(", ")}` : null;
    }
  },
  {
    /* NOTHING FLOATS. A claim drawn with none of its connections drawn is a box the reader
     * cannot relate to anything — and worse, it looks like a claim that stands alone in the
     * argument when in fact its neighbours are merely folded away. Reported from the map: on
     * Horton, opening three sections in a row left four claims adrift at the bottom.
     *
     * The cause is the pass-through rule, which is otherwise right: a folded section is walked
     * THROUGH so that whatever hangs off it still appears. But a claim whose ONLY connection
     * runs through the hidden material has nothing left to show for itself.
     *
     * A claim that is genuinely unconnected in the source is a different thing and must still be
     * drawn — the reconstruction has one, and hiding it would hide a real defect.
     */
    name: "no drawn claim is left with nothing attached to it",
    check: (g, before, after, action, ctx) => {
      // Not under a depth limit. Asking for the top level only is asking for a view with no
      // edges in it, and the map is right to give one — on the book, `depth(0)` draws three
      // Parts and nothing between them, which is the control working, not a fault.
      if (ctx.state.depth != null) return null;
      if (after.nodes.length < 2) return null;
      const real = new Map();
      for (const e of g.edges || []) {
        real.set(e.from, (real.get(e.from) || 0) + 1);
        real.set(e.to, (real.get(e.to) || 0) + 1);
      }
      const connectedInSource = n => (n.members && n.members.length
        ? n.members.some(m => (real.get(m) || 0) > 0)
        : (real.get(n.id) || 0) > 0);
      const attached = new Set();
      for (const e of after.edges) { attached.add(e.from); attached.add(e.to); }
      // A claim the reader COLLAPSED is meant to have nothing attached — that is what
      // collapsing it does, and the badge on it says how much is underneath.
      // Claims only, not folded blocks. A block stands for a whole section, and a section whose
      // connections all run inside itself is honestly drawn alone — that is a fact about the
      // reconstruction, not a fault in the filter. This invariant is about the case that was
      // reported: a single claim, drawn, with its one neighbour folded out of sight.
      const adrift = after.nodes.filter(n => !attached.has(n.id) && connectedInSource(n) &&
                                             n.kind !== "group" &&
                                             !ctx.state.collapsedNodes.has(n.id));
      return adrift.length
        ? `${adrift.length} claim(s) drawn with no connection on screen, though they have one ` +
          `in the file: ${adrift.slice(0, 3).map(n => n.label).join(", ")}`
        : null;
    }
  },
  {
    // THE POINT OF THE BY-POSITION VIEW. Its axis is the text, so a section of the text going
    // missing is the view misreporting its own subject — and the reader cannot tell a hidden
    // section from an empty one. This is a real bug that shipped: on a 42-claim article, two of
    // the eight sections appeared only at "everything", because every claim in them sits three
    // or more steps below a contention in section 1. Depth is now measured from the head of each
    // band, which is what makes this hold.
    name: "no band of the text drops out of the by-position view",
    when: (a, ctx) => ctx.byText,
    check: (g, before, after, action, ctx) => {
      if (!after.nodes.length) return null;
      const folded = ctx.state.collapsedLanes || new Set();
      const shown = new Set(after.nodes.map(n => textLane(n)));
      const want = new Set((g.nodes || []).map(textLane).filter(l => l !== "gutter"));
      // A band the reader shut is meant to be off screen, and so is every band inside a file
      // they shut. Anything else missing is the view losing part of its own subject.
      const missing = [...want].filter(l =>
        !shown.has(l) && !folded.has(l) && !folded.has(laneChapter(l)));
      return missing.length
        ? `${missing.length} band(s) have nothing on screen, e.g. "${missing[0]}"` : null;
    }
  },
  {
    // Only in this direction. OPEN then CLOSE must restore, because closing throws away the
    // stepwise marks that opening created. CLOSE then OPEN deliberately does NOT restore: a
    // section you reopen comes back folded to its entry claims, which is the whole point of
    // stepwise expansion, so requiring an inverse there would be requiring the feature away.
    name: "opening a section then closing it returns the same view",
    when: a => a.type === "toggleGroup",
    check: (g, before, after, action, ctx) => {
      if (!ctx.opening) return null;
      const back = filterGraph(g, reduceFold(g, ctx.state, action, after, {}));
      const a = [...represented(g, before)].sort().join(",");
      const b = [...represented(g, back)].sort().join(",");
      return a === b ? null : `opening then closing ${action.id} does not restore the view`;
    }
  }
];

/* --------------------------------------------------------------- helpers */

/** Underlying claims represented on screen: a folded section stands for its members. */
function represented(graph, vis) {
  const out = new Set();
  for (const n of vis.nodes) {
    if (n.kind === "group" && n.members) n.members.forEach(x => out.add(x));
    else if (n.kind === "group" && n.groupId) membersOfGroup(graph, n.groupId).forEach(x => out.add(x));
    else out.add(n.id);
  }
  return out;
}

/** Give a graph manuscript positions, so the by-position view has something to lane on.
 *
 *  Synthesised rather than read off a built viewer on purpose: the thing under test is what the
 *  filter and the fold do with lanes, and tying that to build output would make the harness fail
 *  for a stale artifact rather than for a bug. Two files, four sections each, and a few claims
 *  left without a position so the gutter is exercised too. */
function withPositions(graph) {
  const nodes = (graph.nodes || []).map((n, i) => {
    if (i % 11 === 7) return Object.assign({}, n, { pos: null });     // no position: the gutter
    const chapterIndex = i < graph.nodes.length / 2 ? 0 : 1;
    const section = (i % 4) + 1 + ". Section " + ((i % 4) + 1);
    return Object.assign({}, n, {
      pos: { chapter: "source/ch" + chapterIndex + ".md", chapterIndex,
             line: i, section, inBook: true, precision: "paraphrase" }
    });
  });
  return Object.assign({}, graph, { nodes });
}

/** How deep each member sits below the section's entry claims (those whose consumer is
 *  outside it). This is what "one level" means when a section is opened. */
function depthWithinGroup(graph, members) {
  const ix = index(graph);
  const entry = [...members].filter(id =>
    (graph.edges || []).filter(e => e.from === id).every(e => !members.has(e.to)) ||
    (graph.edges || []).some(e => e.from === id && !members.has(e.to)));
  const depth = new Map(entry.map(id => [id, 0]));
  const q = [...entry];
  while (q.length) {
    const x = q.shift();
    for (const c of ix.childrenOf.get(x) || [])
      if (members.has(c) && !depth.has(c)) { depth.set(c, depth.get(x) + 1); q.push(c); }
  }
  return depth;
}

function apexOf(graph) {
  const out = new Map((graph.nodes || []).map(n => [n.id, 0]));
  const inn = new Map((graph.nodes || []).map(n => [n.id, 0]));
  for (const e of graph.edges || []) {
    if (out.has(e.from)) out.set(e.from, out.get(e.from) + 1);
    if (inn.has(e.to)) inn.set(e.to, inn.get(e.to) + 1);
  }
  return (graph.nodes || []).filter(n => !out.get(n.id) && inn.get(n.id)).map(n => n.id);
}

function actionsFor(graph, vis, byText) {
  const acts = [{ type: "expandAll" }, { type: "collapseAll" },
                { type: "depth", value: null }, { type: "depth", value: 0 },
                { type: "depth", value: 1 }, { type: "depth", value: 2 }];
  if (byText) {
    // Both levels: the file band and each top-level heading inside it, which is what the view
    // draws and therefore what a reader can click.
    const lanes = new Set();
    for (const n of graph.nodes || []) {
      const l = textLane(n);
      if (l === "gutter") continue;
      lanes.add(l); lanes.add(laneChapter(l));
    }
    for (const l of lanes) acts.push({ type: "toggleGroup", id: "lane:" + l });
    acts.push({ type: "byChapter" });        // the ladder's first rung on a book
  } else {
    for (const g of graph.groups || []) acts.push({ type: "toggleGroup", id: g.id });
  }
  for (const n of vis.nodes) if (n.kind !== "group") acts.push({ type: "toggleNode", id: n.id });
  return acts;
}

/** Deterministic PRNG so a failure is reproducible from its seed. */
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* --------------------------------------------------------------- the walk */

function step(graph, state, action, apex, byText) {
  const before = filterGraph(graph, state);
  const ctx = {
    apex,
    opening: action.type === "toggleGroup" && (isLane(action.id)
      ? state.collapsedLanes.has(action.id.slice(5))
      : state.collapsedGroups.has(action.id)),
    expanding: action.type === "toggleNode" &&
               (before.nodes.find(n => n.id === action.id) || {}).hidden > 0
  };
  const next = reduceFold(graph, state, action, before, {});
  const after = filterGraph(graph, next);
  ctx.state = next;
  ctx.byText = !!byText;
  const fails = [];
  for (const inv of INVARIANTS) {
    if (inv.when && !inv.when(action, ctx)) continue;
    let msg = null;
    try { msg = inv.check(graph, before, after, action, ctx); }
    catch (e) { msg = "threw: " + e.message; }
    if (msg) fails.push({ inv: inv.name, msg });
  }
  return { next, after, fails };
}

function run(name, graph, byText) {
  const apex = apexOf(graph);
  const tops = (graph.groups || []).filter(g => !g.parent).map(g => g.id);
  const base = { collapsedNodes: new Set(), expandedNodes: new Set(), groupFolded: new Map(),
                 collapsedLanes: new Set(), depth: null, facets: null, byText: !!byText };
  const starts = [
    { label: "as the viewer opens",
      state: Object.assign({}, base, { collapsedGroups: new Set(byText ? [] : tops) }) },
    { label: "fully expanded",
      state: Object.assign({}, base, { collapsedGroups: new Set() }) }
  ];

  const seen = new Map();   // invariant -> first failure, with the trail that produced it
  let checks = 0;

  const note = (fails, trail) => {
    for (const f of fails) {
      checks++;
      if (!seen.has(f.inv)) seen.set(f.inv, { msg: f.msg, trail: trail.slice() });
    }
  };

  // Exhaustive at depth 1 from each start.
  for (const s of starts) {
    const vis0 = filterGraph(graph, s.state);
    for (const a of actionsFor(graph, vis0, byText)) {
      const r = step(graph, s.state, a, apex, byText);
      checks++;
      note(r.fails, [s.label, describe(a)]);
    }
  }

  // Then a seeded random walk, which is what finds the bugs that need three clicks.
  const rand = rng(SEED);
  let state = starts[0].state, vis = filterGraph(graph, state), trail = ["as the viewer opens"];
  for (let i = 0; i < STEPS; i++) {
    const acts = actionsFor(graph, vis, byText);
    const a = acts[Math.floor(rand() * acts.length)];
    const r = step(graph, state, a, apex, byText);
    checks++;
    note(r.fails, trail.concat(describe(a)));
    state = r.next; vis = r.after;
    trail.push(describe(a));
    if (trail.length > 12) trail = [trail[0], "…", ...trail.slice(-4)];
  }

  console.log(`\n${name} [${byText ? "by position" : "by argument"}]: ${graph.nodes.length} nodes, ` +
              `${byText ? new Set(graph.nodes.map(textLane)).size + " bands" : graph.groups.length + " sections"} ` +
              `— ${checks} checks over ${STEPS} random steps (seed ${SEED})`);
  if (!seen.size) { console.log("   every invariant held"); return 0; }
  for (const [inv, f] of seen) {
    console.log(`   FAIL  ${inv}`);
    console.log(`         ${f.msg}`);
    console.log(`         after: ${f.trail.join(" -> ")}`);
  }
  return seen.size;
}

const describe = a => a.type === "depth" ? `depth(${a.value})`
                    : a.id ? `${a.type}(${a.id})` : a.type;

/* --------------------------------------------------------------- the graphs */

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

let failed = 0;
for (const [name, file] of FILES) {
  if (!fs.existsSync(file)) { console.log(`\n${name}: not on this machine, skipped`); continue; }
  const res = await argdown.runAsync({ input: fs.readFileSync(file, "utf8"), ...RUN });
  const graph = toGraph(res);
  failed += run(name, graph, false);
  failed += run(name, withPositions(graph), true);
}

console.log(failed ? `\n${failed} invariant(s) violated\n` : "\nall invariants held\n");
let framingFailed = false;
/* ------------------------------------------------------------------ framing
 *
 * THE APEX MUST STAY ON SCREEN. Reported against the Carroll map: fold the sections, reopen
 * them, and the main claim is gone. The fold logic was innocent — `fitTo` floors the zoom so a
 * large map stays legible, then CENTRED a drawing wider than the viewport, which puts the
 * middle on screen and the contention off the edge. `stranded()` missed it because the drawing
 * still overlapped the viewport by hundreds of pixels; only the one node that mattered had left.
 */
{
  const F = frameFor;
  let bad = 0;
  const ok = (name, cond) => {
    if (!cond) bad++;
    console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}`);
  };
  console.log("\nframing: the apex must stay on screen");
  const onScreen = (f, apex, cw, ch) => {
    const px = f.x + apex.x * f.k, py = f.y + apex.y * f.k;
    return px > 0 && px < cw && py > 0 && py < ch;
  };
  const cw = 800, ch = 700, minScale = 0.5;

  const apexLeft = { x: 120, y: 60 };
  let f = F(4000, 600, cw, ch, minScale, apexLeft);
  ok("a map too wide to fit keeps the apex on screen", onScreen(f, apexLeft, cw, ch));
  ok("  and does not pull the drawing's left edge inside the frame", f.x <= 16);

  const apexTop = { x: 300, y: 40 };
  f = F(600, 5000, cw, ch, minScale, apexTop);
  ok("a map too tall to fit keeps the apex on screen", onScreen(f, apexTop, cw, ch));

  const apexRight = { x: 3900, y: 60 };
  f = F(4000, 600, cw, ch, minScale, apexRight);
  ok("an apex at the far right is reached too", onScreen(f, apexRight, cw, ch));
  ok("  without pulling the right edge inside the frame",
     f.x + 4000 * f.k >= cw - 17);

  // A map that DOES fit must be centred exactly as before: the anchoring is for overflow only.
  const small = { x: 200, y: 50 };
  f = F(400, 300, cw, ch, minScale, small);
  ok("a map that fits is still centred", Math.abs(f.x - (cw - 400 * f.k) / 2) < 0.01);
  ok("  and no apex is needed for that", (() => {
    const g = F(400, 300, cw, ch, minScale, null);
    return g.k === f.k && Math.abs(g.x - f.x) < 0.01;
  })());

  if (bad) { console.log(`\n${bad} framing check(s) FAILED`); framingFailed = true; }
  else console.log("  all framing checks passed");
}

process.exit(failed || framingFailed ? 1 : 0);
