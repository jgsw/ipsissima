/* argdown-live-map.js — a reflowing, foldable argument map.
 *
 * Argdown's own exports bake the layout in at export time: hiding a node leaves a hole where
 * Graphviz put it. This runs the layout in the browser instead, so collapsing a Part makes the
 * map re-lay-out around it and the nodes glide to their new positions.
 *
 * Classic script, no build step. Sets window.ArgdownLiveMap; the layout is its own
 * (`layoutByArgument` / `layoutByText`), with no engine underneath. Both hosts — the book structure map and the pandoc
 * export filter — inline the two files and call createLiveMap.
 *
 * INPUT is a normalised graph, not Argdown's own IMap, so each host writes a small adapter and
 * this file stays agnostic about where the argument came from:
 *
 *   nodes:  [{ id, label, detail, kind, facet, group }]
 *   edges:  [{ from, to, type }]        from = the reason, to = what it bears on
 *   groups: [{ id, label, parent }]     optional, nestable
 *
 * `type` is one of Argdown's `relationType` values -- "support" | "attack" | "undercut" |
 * "contradictory", or strict mode's "entails" | "contrary". `facet` is whatever the host
 * wants the filter chips to switch on — real Argdown tags in exports, the `kind:` metadata in
 * the structure map. Argdown's IMap nodes carry no tags, so this has to come from the adapter.
 */
/** @param {any} global */
(function (global) {
"use strict";

/* ------------------------------------------------------------------ graph indexing */

/** Adjacency built once per graph. Edges run reason -> claim, so a node's "children" (the
 *  things arguing for or against it) are the sources of its incoming edges, and a root — the
 *  main claim — is a node that bears on nothing, i.e. has no outgoing edge. */
function index(graph) {
  const nodes  = graph.nodes  || [];
  const edges  = graph.edges  || [];
  const groups = graph.groups || [];
  const byId    = new Map(nodes.map(n => [n.id, n]));
  const groupById = new Map(groups.map(g => [g.id, g]));
  const childrenOf = new Map();   // claim id -> [reason id]
  const outCount   = new Map();

  for (const n of nodes) { childrenOf.set(n.id, []); outCount.set(n.id, 0); }
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;   // tolerate dangling refs
    childrenOf.get(e.to).push(e.from);
    outCount.set(e.from, outCount.get(e.from) + 1);
  }
  return { nodes, edges, groups, byId, groupById, childrenOf, outCount };
}

/** Every group id from a node up to the outermost, innermost first. */
function groupChain(ix, nodeId) {
  const chain = [];
  let g = ix.byId.get(nodeId) && ix.byId.get(nodeId).group;
  const guard = new Set();
  while (g && ix.groupById.has(g) && !guard.has(g)) {
    guard.add(g); chain.push(g);
    g = ix.groupById.get(g).parent;
  }
  return chain;
}

/* ------------------------------------------------------------------ load */

/** How much of the argument collapses without each claim. id -> number of OTHER claims that
 *  lose every route to a contention when this one is removed.
 *
 *  WHY THIS RATHER THAN A HAND-APPLIED `#core` TAG. The tag was the reader's estimate of the
 *  same thing, and it did not survive contact: across the published samples it marked 27% of the
 *  claims in one map and 65% in another, so a chip labelled `core` meant something different in
 *  every file. It also could not be checked against the argument it was describing.
 *
 *  WHY NOT DISTANCE FROM THE CONTENTION, which the "how much" ladder already uses. They measure
 *  different things and both are worth having. Distance says how far out a claim sits; load says
 *  how much rests on it. A claim five steps out that holds up twenty others is the spine of the
 *  argument and the ladder reveals it last; a claim one step from the contention that holds up
 *  nothing is a remark, and the ladder reveals it first.
 *
 *  A contention scores high, and should: removing it strands everything that reached only
 *  through it. Transitive by construction — "collapses" means the whole subtree that loses its
 *  footing, not the immediate neighbours.
 */
function loadOf(ix) {
  const contentions = ix.nodes.filter(n => (ix.outCount.get(n.id) || 0) === 0).map(n => n.id);
  // Which claims can reach a contention at all, with `skip` taken out of the graph. Walked DOWN
  // from the contentions through `childrenOf`, which is the reverse of the direction a reason
  // points — reaching a contention and being reachable from one are the same relation read
  // backwards, and the adjacency for the second is already built.
  const reachable = skip => {
    const seen = new Set();
    const q = [];
    for (const c of contentions) if (c !== skip) { seen.add(c); q.push(c); }
    while (q.length) {
      const x = q.shift();
      for (const c of (ix.childrenOf.get(x) || [])) {
        if (c === skip || seen.has(c)) continue;
        seen.add(c); q.push(c);
      }
    }
    return seen;
  };
  const base = reachable(null);
  const load = new Map();
  for (const n of ix.nodes) {
    const without = reachable(n.id);
    let lost = 0;
    for (const id of base) if (id !== n.id && !without.has(id)) lost++;
    load.set(n.id, lost);
  }
  return load;
}

/* ------------------------------------------------------------------ input hygiene */

/** Make a graph safe to lay out, and say what was wrong with it.
 *
 *  This exists because the map is meant to be handed to other people along with their own
 *  Argdown files, and a renderer that hangs or throws on a malformed one is worse than useless
 *  — a group cycle used to spin forever inside filterGraph, with no clue on screen. Every walk
 *  here is individually guarded too, but relying on that alone means one unguarded loop added
 *  later is a hang; this makes the shapes impossible instead of merely survivable.
 *
 *  Nothing is invented and nothing legitimate is dropped: the only things removed are
 *  references that cannot mean anything. Returns { graph, problems } and the caller decides
 *  whether to surface `problems` — createLiveMap warns once on the console rather than
 *  swallowing them, because a silently repaired file teaches its author nothing.
 */
function sanitiseGraph(graph) {
  const problems = [];
  const src = graph || {};
  const rawNodes = Array.isArray(src.nodes) ? src.nodes : [];
  const rawEdges = Array.isArray(src.edges) ? src.edges : [];
  const rawGroups = Array.isArray(src.groups) ? src.groups : [];

  const nodes = [], byId = new Set();
  for (const n of rawNodes) {
    if (!n || n.id == null) { problems.push("a node with no id was dropped"); continue; }
    if (byId.has(n.id)) { problems.push(`duplicate node id "${n.id}" — kept the first`); continue; }
    byId.add(n.id);
    nodes.push(n);
  }

  const groups = [], groupIds = new Set();
  for (const g of rawGroups) {
    if (!g || g.id == null) { problems.push("a group with no id was dropped"); continue; }
    if (groupIds.has(g.id)) { problems.push(`duplicate group id "${g.id}" — kept the first`); continue; }
    groupIds.add(g.id);
    groups.push(Object.assign({}, g));
  }
  const groupById = new Map(groups.map(g => [g.id, g]));

  // Parents: must exist, must not be the group itself, must not close a cycle.
  for (const g of groups) {
    if (g.parent == null) continue;
    if (!groupById.has(g.parent)) {
      problems.push(`group "${g.id}" names a parent "${g.parent}" that does not exist`);
      g.parent = null; continue;
    }
    if (g.parent === g.id) {
      problems.push(`group "${g.id}" is its own parent`);
      g.parent = null; continue;
    }
    // Report the ring, not just its two ends: the walk stops back where it started, so naming
    // `g.id` and the node it landed on printed the same group twice and explained nothing.
    const path = [g.id];
    const seen = new Set(path);
    let p = g.parent;
    while (p && groupById.has(p) && !seen.has(p)) { seen.add(p); path.push(p); p = groupById.get(p).parent; }
    if (p && seen.has(p)) {
      problems.push(`groups ${path.map(x => `"${x}"`).join(" -> ")} -> "${p}" enclose each ` +
                    `other — the link from "${g.id}" was cut`);
      g.parent = null;
    }
  }

  const cleanNodes = nodes.map(n => {
    if (n.group != null && !groupById.has(n.group)) {
      problems.push(`node "${n.id}" is in a group "${n.group}" that does not exist`);
      return Object.assign({}, n, { group: null });
    }
    return n;
  });

  const edges = [];
  for (const e of rawEdges) {
    if (!e || e.from == null || e.to == null) { problems.push("an edge with no ends was dropped"); continue; }
    if (!byId.has(e.from) || !byId.has(e.to)) continue;      // dangling: already tolerated, quietly
    if (e.from === e.to) { problems.push(`"${e.from}" supports itself — the loop was dropped`); continue; }
    edges.push(e);
  }

  // Manuscript-level facts ride through. The sanitiser REBUILDS the graph object rather than
  // editing it, so anything not named here is silently dropped — which is how the word counts
  // came out blank on every band the first time, with no error anywhere to say why.
  return { graph: { nodes: cleanNodes, edges, groups, words: graph.words || null }, problems };
}

/* ------------------------------------------------------------------ text position */

/** Order two manuscript positions. A position is { chapterIndex, line } as produced by
 *  argdown-positions.js; a claim placed to a chapter but not to a line (`chapter-only`) sorts
 *  to the top of its chapter, which is the most it can honestly claim. */
function posBefore(a, b) {
  if (!a || !b) return !!a;
  if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex < b.chapterIndex;
  return (a.line == null ? -1 : a.line) < (b.line == null ? -1 : b.line);
}

/** A sort key that compares as a string, for grouping nodes into columns. */
function posKey(p) {
  if (!p) return null;
  const pad = n => String(n).padStart(7, "0");
  return pad(p.chapterIndex) + ":" + pad(p.line == null ? 0 : p.line);
}

/** Which band of the exposition view a node belongs in: its file, then its top-level heading.
 *
 *  ONE DEFINITION, because two things need it and they must not drift: `layoutByText` draws the
 *  bands, and `filterGraph` decides what a fold hides and where the depth setting is measured
 *  from. While the layout owned it privately the filter could not so much as name a band, which
 *  is why folding a section and metering depth by section were both out of reach.
 *
 *  Sub-headings deliberately get no band of their own — one lane per file and per top-level
 *  section. A lane per subsection shreds a long chapter into slivers and stops being a picture
 *  of the manuscript's shape.
 */
function textLane(node) {
  if (!node) return "gutter";
  // A folded band is a node standing for a band, and belongs in the band it stands for — not in
  // the lane its earliest claim would put it in, which for a folded CHAPTER is that chapter's
  // first section, i.e. inside itself.
  if (typeof node.lane === "string") return node.lane;
  if (!node.pos) return "gutter";
  return "ch:" + node.pos.chapterIndex + (node.pos.section ? "|" + node.pos.section : "");
}

/** How many words of manuscript a band covers.
 *
 *  `words` is what `argdown-positions.wordCounts` produced, keyed by the chapter PATH; a lane is
 *  keyed by chapter INDEX, which is all the layout ever needs. `chapterOfIndex` bridges the two
 *  and is built once per call from the nodes, since only they know which index is which path.
 *  Returns null rather than 0 when the count is unknown — a section nobody counted and a section
 *  with nothing in it must not look the same.
 */
function bandWords(words, lane, chapterOfIndex) {
  if (!words || !lane || lane === "gutter") return null;
  const bar = lane.indexOf("|");
  const idx = Number(lane.slice(3, bar < 0 ? lane.length : bar));
  const path = chapterOfIndex ? chapterOfIndex.get(idx) : null;
  if (path == null) return null;
  if (bar < 0) return words.byChapter && words.byChapter[path] != null
    ? words.byChapter[path] : null;
  const sec = lane.slice(bar + 1);
  const inFile = words.bySection && words.bySection[path];
  return inFile && inFile[sec] != null ? inFile[sec] : null;
}

/** The file-level band enclosing a lane. `ch:3|2. Method` -> `ch:3`. */
function laneChapter(lane) {
  const i = lane.indexOf("|");
  return i < 0 ? lane : lane.slice(0, i);
}

/* ------------------------------------------------------------------ the filter */

/** PURE: full graph + view state -> the graph that should be on screen.
 *
 *  Exported on its own so it can be tested in Node without a browser, which is the only
 *  practical way to be sure the fold logic is right.
 *
 *  state = { collapsedGroups:Set, collapsedNodes:Set, depth:number|null, facets:Set|null }
 */
/** The drawn picture for a fold state.
 *
 *  A THIN DRIVER OVER ONE PASS. `filterOnce` walks the graph and repairs what it can; where a
 *  claim is left with nothing attached AND no drawn claim to draw a through-edge to, it names
 *  the neighbour that would reconnect it and this runs the pass again with that neighbour
 *  forced in. Re-running rather than patching the finished output is what keeps ONE description
 *  of how a picture is built: the rescued claim goes through group collapse and edge rewiring
 *  like everything else, instead of being assembled a second way here.
 *
 *  It terminates because `force` only ever grows and is bounded by the node count; the guard is
 *  for a future change, not for any graph we have. On five of the six samples it runs once.
 */
function filterGraph(graph, state) {
  let force = null, out = filterOnce(graph, state, force);
  for (let pass = 0; pass < 8 && out.rescues && out.rescues.length; pass++) {
    force = new Set(force || []);
    let grew = false;
    for (const id of out.rescues) if (!force.has(id)) { force.add(id); grew = true; }
    if (!grew) break;
    out = filterOnce(graph, state, force);
  }
  delete out.rescues;
  return out;
}

function filterOnce(graph, state, force) {
  const ix = index(graph);
  const S = {
    collapsedGroups: state.collapsedGroups || new Set(),
    collapsedNodes:  state.collapsedNodes  || new Set(),
    // Nodes the reader opened by hand. These beat the depth limit — without that, clicking "+"
    // on a claim whose children are hidden BY THE DEPTH SETTING appears to do nothing at all,
    // which was the main reason the little circles felt arbitrary.
    expandedNodes:   state.expandedNodes   || new Set(),
    // Nodes folded BECAUSE THEIR SECTION WAS OPENED, each mapped to the section in question.
    // Distinct from collapsedNodes, and the distinction is the whole point: a collapsed node
    // hides all its reasons, whereas one of these hides only the reasons INSIDE that section
    // and lets the rest of the map through.
    //
    // Two bugs came of not having it. Folding every member of an opened section cut the map off
    // at the apex (six blocks became one). Folding only members whose reasons stay inside the
    // section left the others open, and traversal poured through them: opening Part 1 of the
    // book unfurled five levels instead of one. Neither is fixable by choosing a better SET of
    // nodes to collapse, because "hide the section's internals" and "hide everything below
    // this claim" are different operations and only one of them was available.
    groupFolded:     state.groupFolded     || new Map(),
    // Bands of the exposition view the reader has folded shut. A parallel set to
    // collapsedGroups on purpose: the manuscript's headings and the Argdown file's headings are
    // different divisions of the same material and need not agree, so folding "2. Method" in the
    // by-position view must fold what THAT band draws, not whatever Argdown section overlaps it.
    collapsedLanes:  state.collapsedLanes  || new Set(),
    depth:           state.depth == null ? null : state.depth,
    // Whether we are drawing the by-position view. It changes what depth is measured FROM; see
    // the section seeds below.
    byText:          !!state.byText,
    facets:          state.facets || null,
    // SPINE. When set, only claims holding up at least this many others are drawn — plus the
    // contentions, which are what "holding up" is measured towards. See `loadOf`.
    spine:           state.spine == null ? null : state.spine
  };

  // EACH VIEW FOLDS BY ITS OWN DIVISIONS. The Argdown file's headings and the manuscript's
  // sections are two different cuts of the same material and need not line up at all, so
  // carrying an Argdown fold into the by-position view put blocks named after one division
  // inside bands named after the other — and left bands empty whose claims had been swept into
  // a block sitting three bands higher, under the position of its earliest claim. Three of the
  // eight sections of a real article disappeared that way, which is the complaint that started
  // this. The folds are ignored here, not cleared: switching back to the argument view finds
  // the reader's sections exactly as they left them.
  if (S.byText) { S.collapsedGroups = new Set(); S.groupFolded = new Map(); }

  // 1. Facet filter first — it changes what counts as a root.
  //    The spine filter rides with it, for the same reason: both answer "which claims", not
  //    "how much", so both have to be settled before anything asks what the roots are.
  const facetOk = n => !S.facets || !n.facet || S.facets.has(n.facet);
  const load    = S.spine == null ? null : loadOf(ix);
  const spineOk = n => S.spine == null
    || (load.get(n.id) || 0) >= S.spine
    || (ix.outCount.get(n.id) || 0) === 0;      // a contention is always spine
  const passes  = new Set(ix.nodes.filter(n => facetOk(n) && spineOk(n)).map(n => n.id));
  const kids    = id => (ix.childrenOf.get(id) || []).filter(c => passes.has(c));

  // Which sections enclose each node, so "is this reason inside the section I folded" is a
  // set lookup rather than a walk up the tree per edge.
  const chainOf = new Map(ix.nodes.map(n => [n.id, new Set(groupChain(ix, n.id))]));
  const EMPTY = new Set();


  // 2a. Work out the seeds FIRST, ignoring depth and folds. A cycle has no root at all and a
  //     facet filter can strand a component, so those need seeding too — but that search must
  //     not see the limits, or a node hidden on purpose looks like an unreachable fragment and
  //     gets re-seeded straight back into view.
  const roots = ix.nodes.filter(n => passes.has(n.id) &&
    ix.edges.every(e => e.from !== n.id || !passes.has(e.to))).map(n => n.id);
  const reached = new Set();
  const reach = start => {
    const q = [start];
    while (q.length) {
      const x = q.shift();
      if (reached.has(x)) continue;
      reached.add(x);
      for (const c of kids(x)) if (!reached.has(c)) q.push(c);
    }
  };
  const seeds = [];
  for (const r of roots) if (!reached.has(r)) { seeds.push(r); reach(r); }

  // 2a-bis. IN THE BY-POSITION VIEW, DEPTH IS MEASURED FROM THE HEAD OF EACH SECTION.
  //
  //  "How much" means how much of the ARGUMENT, and in the argument view that is exactly right:
  //  start at the contention and work down. Carried over unchanged to the view whose axis is the
  //  TEXT, it hid whole sections of the paper. Measured on a 42-claim article: nothing from
  //  sections 2 or 3 appeared at any setting below "everything", because every claim in them sits
  //  three or more steps below a contention that lives in section 1. A section of the article
  //  going missing from the view whose subject IS the article is a misreport of the article, and
  //  the reader has no way to tell it from a section that had nothing in it.
  //
  //  So each band gets its own origin and the setting means "how far into each section" — which
  //  is the question a reader of this view is actually asking. The origin is the band's own
  //  local root: the claim (or claims) in it that nothing else IN THE SAME BAND supports, i.e.
  //  what the section is arguing for. That is cheap, needs no global depth to compute, and is
  //  the right unit — a section usually has one claim it is making. Where a band has no local
  //  root at all (its claims support each other in a ring) the earliest-placed claim stands in,
  //  because a band with no origin would drop out of the view entirely.
  if (S.byText) {
    // Rank every claim by its distance from the paper's own contentions. Used ONLY to choose
    // which claim heads each band — never to hide anything — so it is computed without regard to
    // folds or the depth limit.
    const rank = new Map(roots.map(id => [id, 0]));
    const rq = roots.slice();
    while (rq.length) {
      const x = rq.shift();
      for (const c of kids(x)) if (!rank.has(c)) { rank.set(c, rank.get(x) + 1); rq.push(c); }
    }
    const lanes = new Map();
    for (const id of passes) {
      const lane = textLane(ix.byId.get(id));
      if (lane === "gutter") continue;
      if (!lanes.has(lane)) lanes.set(lane, []);
      lanes.get(lane).push(id);
    }
    const parentsIn = (id, mine) =>
      ix.edges.some(e => e.from === id && passes.has(e.to) && mine.has(e.to));
    for (const ids of lanes.values()) {
      const mine = new Set(ids);
      // ONE head per band, not every local root. Both were measured on a 42-claim article: every
      // local root seeds 21 of the 42 claims, so the first rung of the ladder is already half the
      // map and the rung above it is the whole thing — a ladder with no rungs. Taking the single
      // best local root gives 8 -> 25 -> 33 -> 38 -> 42, and the eight it picks are the claims
      // each section is actually making.
      const local = ids.filter(id => !parentsIn(id, mine));
      const head = (local.length ? local : ids).slice().sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a) : Infinity;
        const rb = rank.has(b) ? rank.get(b) : Infinity;
        if (ra !== rb) return ra - rb;                     // nearest the contention leads
        const pa = posKey(ix.byId.get(a).pos), pb = posKey(ix.byId.get(b).pos);
        return pa == null ? 1 : pb == null ? -1 : pa < pb ? -1 : pa > pb ? 1 : 0;
      })[0];
      if (head != null && !seeds.includes(head)) { seeds.push(head); reach(head); }
    }
  }

  let guard = 0;
  while (guard++ < 10000) {
    const left = [...passes].filter(id => !reached.has(id));
    if (!left.length) break;
    left.sort((a, b) => kids(b).length - kids(a).length);   // most connected makes the best root
    seeds.push(left[0]); reach(left[0]);
  }

  // 2b. Now walk down from those seeds, stopping at folded nodes and at the depth limit.
  //     A folded section is walked THROUGH, not walked into. Its own claims are not drawn, but
  //     the traversal keeps going so that anything beyond them still is: on the Williams map
  //     three whole sections hang off claims deep inside "The verdict", and simply stopping at
  //     the fold deleted them from the map. Hiding a section must hide the section, not
  //     everything the section happens to stand in front of.
  //  ONE WALK, RUN MORE THAN ONCE. The body below is the only thing that knows what a fold
  //  does; asking "would folding this claim change anything?" any other way means a second
  //  description of the same rules, and this file already records what that costs. So the walk
  //  became a function, and the question is answered by running it.
  const runWalk = (alsoCollapsed) => {
  const visible = new Set();
  const dist    = new Map(seeds.map(id => [id, 0]));
  const walked  = new Set();   // id|fold keys already processed
  const queue   = seeds.map(id => ({ id, fold: null }));
  while (queue.length) {
    const { id, fold } = queue.shift();
    const key = id + "|" + (fold || "");
    if (walked.has(key) || (fold && visible.has(id))) continue;
    walked.add(key);
    // A CLAIM THE READER OPENED BY HAND IS DRAWN, EVEN WHERE ITS SECTION HOLDS IT BACK.
    //
    // `reduceFold` already says this twice -- opening a section skips its hand-opened members
    // when it lays down the marks, and expanding a claim deletes the mark it carries -- but the
    // walk overruled both, because suppression is inherited from the PARENT's active set and
    // not only from the node's own mark. So a claim could be exempt by the state machine and
    // suppressed by the walk anyway, which is how clicking "+" on a claim made THAT CLAIM
    // disappear: it was on screen only because the connectivity rescue had forced it in, and
    // expanding it removed the reason for the rescue. Found on Gettier once the stop above was
    // in place; the same shape as the crutch-withdrawal the rescue's own comments predict.
    //
    // Drawing hand-COLLAPSED suppressed claims as well was tried, on the argument that a fold
    // with no badge on screen is a trap. It is much worse: it puts a section's deeper levels on
    // screen the moment the section opens: "opening a section reveals one level of it, not
    // several" went from silent to 12 violations over five seeds, e.g. a section showing four
    // claims from below its entry level of the seven it has. Only the OPENED mark is exempt --
    // which is the one that invariant already carves out for.
    if (!fold || S.expandedNodes.has(id)) {
      if (visible.has(id)) continue;
      visible.add(id);
    }
    // A CLAIM THE READER FOLDED STOPS THE WALK WHETHER OR NOT IT IS DRAWN -- for exactly the
    // reason the depth limit below does, which is the same lesson learned twice.
    //
    // This check used to sit inside the `if (!fold)` above, so a claim the reader had shut was
    // honoured only when it happened to be DRAWN. Held back by an opened section instead, it was
    // walked THROUGH, and the walk poured past the reader's own fold into whatever hung off it.
    // Two things followed, and only the second was ever reported. The map showed material behind
    // a claim the reader had shut -- opening a section brought back the subtree of a claim that
    // was still visibly collapsed. And because pass-through reached FURTHER than drawing,
    // expanding a claim turned a pass-through into a stop and the reach of the walk SHRANK:
    // Carroll, section 2 opened with n3 shut, expanding n19 lost the whole of s4, five claims
    // that a block on screen had been standing for. That is the vanishing defect in
    // KNOWN-ISSUES.md, and no guard on the stepwise folds could see it, because the loss is
    // caused by the expansion itself and the state delta shows `collapsedNodes` unchanged.
    //
    // MAKING THE GUARD STRICTER WAS TRIED FIRST AND WAS WRONG -- see the note in KNOWN-ISSUES:
    // guard and invariant already agreed, so tightening it fixed nothing and refused more folds.
    // The asymmetry is in the walk, not in what the walk is measured by, and the cure is to give
    // both branches the same stopping rule rather than to police the difference afterwards.
    // Measured over 1,200 fold states at each of twelve seeds: violations of this invariant
    // 10 -> 0 on the published corpus and 15 -> 0 with a private one added. It bites only where
    // the reader has folded something by hand -- with `collapsedNodes` empty it is a no-op --
    // which is why no fixture and no quality metric moves.
    if (S.collapsedNodes.has(id) || id === alsoCollapsed) continue;
    // The depth limit applies whether or not this node is drawn. Exempting the passed-through
    // ones let a folded section reach PAST the limit and show material the reader had asked to
    // hide -- and then unfolding it correctly took that material away, which read as expanding
    // something making the map smaller.
    if (S.depth != null && dist.get(id) >= S.depth && !S.expandedNodes.has(id)) continue;
    // Which folded sections we are inside: the ones we arrived under, plus any this node
    // itself carries. A node can sit in several at once -- a subsection inside a Part -- so
    // this is a set, not one id. Keeping only the innermost lost the outer mark when the
    // subsection was closed again, and its claims came back unfolded.
    //
    // A CLAIM THE READER OPENED BY HAND FORWARDS NO INHERITED SUPPRESSION -- the other half of
    // the exemption above, and it was missing. The draw half says an opened claim is on screen
    // whatever its section says; but the walk still forwarded the chain the claim was REACHED
    // under, so everything below it stayed hidden as if the reader had never opened it, and the
    // "+N" it was drawn with revealed nothing when clicked. Worse, the draw half is what armed
    // it: drawing on a suppressed arrival marks the claim visible, so the clean arrival that
    // used to do the forwarding is deduplicated away, and which parent reaches it first decides
    // what a click does. Reported from use on the Wilson map (a fold state identifier, nine
    // folds deep); then found one click deep on five published maps -- open a section, and an
    // entry claim with a second, within-section parent offers a "+1" that does nothing.
    // Expanding is the reader saying "proceed from here", so the walk now does: the claim's own
    // marks still apply (reduceFold deletes them on expansion, so there are none to carry), and
    // only the chain it was carried in under is dropped.
    const active = new Set(fold && !S.expandedNodes.has(id) ? fold.split("\u0000") : []);
    for (const g of S.groupFolded.get(id) || EMPTY) active.add(g);
    for (const c of kids(id)) {
      const chain = chainOf.get(c) || EMPTY;
      const still = [...active].filter(g => chain.has(g));
      if (!dist.has(c)) dist.set(c, (dist.get(id) || 0) + 1);
      queue.push({ id: c, fold: still.length ? still.sort().join("\u0000") : null });
    }
  }
  return { visible, dist };
  };
  const { visible, dist } = runWalk(null);
  // THE WALK'S OWN ANSWER, KEPT BEFORE THE RESCUE EDITS IT. `visible` gains the forced claims a
  // few lines below, and the badge question is asked by re-running the walk -- which does not
  // apply the rescue. Comparing the post-rescue set against a pre-rescue one makes the second
  // look smaller by however many claims were forced in, and a fold that changes nothing then
  // reads as a fold that removes something. That is the last of the badge defects, and its
  // counterexample is five claims: `n8->n9, n8->n79, n9->n79` beside a SEPARATE component
  // `n17->n80` whose two claims carry `groupFolded` marks. n8 has two parents, so folding n9
  // takes nothing away -- and the rescue, firing on the other component entirely, made it look
  // as though it did.
  const walkedOnly = new Set(visible);

  // 2c. NOTHING FLOATS — and the claims are no longer smuggled in to achieve it.
  //
  //  There used to be a rescue here: when a folded section left a claim drawn with nothing
  //  attached, the one held-back neighbour that would reconnect it was let through. It worked,
  //  and it cost more than it was worth. The rescue is greedy and recomputed on every render, so
  //  the set it picks shifts as the reader folds things — and a claim on screen only because it
  //  was rescued VANISHES when the rescue stops being needed. Its own comment predicted this.
  //
  //  Step 5b does the same job by drawing the connection instead of importing the claims, which
  //  cannot have that failure mode: a set of nodes that never grows can never shrink. Measured
  //  over 1,200 random fold states on seven reconstructions, removing this cut invariant
  //  violations from 23 to 10 and eliminated one whole class of them — a section opening to
  //  reveal several of its levels at once, which was the second bug in KNOWN-ISSUES.md and which
  //  turned out to be this rescue's doing all along.
  // Which block a claim will be DRAWN as, if any. Needed here as well as in step 4, because
  // "is this claim attached" has to be asked of the picture that will actually be drawn: two
  // claims inside one collapsed section are joined by an edge that becomes a self-edge and is
  // dropped, so having each other as neighbours attaches neither.
  const collapsedRepr = id => {
    const chain = groupChain(ix, id).filter(g => S.collapsedGroups.has(g));
    return chain.length ? "group:" + chain[chain.length - 1] : id;
  };
  // A claim the previous pass could not reconnect any other way. Added here, after the walk and
  // before groups are collapsed, so it is drawn by the ordinary machinery rather than bolted on.
  if (force) for (const id of force) if (passes.has(id)) visible.add(id);

  // 3. What did we hide? Drives the "+3" affordance on a node with a folded subtree.
  //
  // A RESCUED CLAIM PROMISES NOTHING, and must not be given a badge. The line above puts `force`
  // claims into `visible` so that nothing is drawn floating -- they are there to keep a
  // connection honest, not because the reader has opened a path to them. The walk never reached
  // them and still does not proceed FROM them, so expanding one reveals nothing at all.
  //
  // Counting them here gave a badge reading "+1" that did nothing when clicked, which is worse
  // than no badge: the badge is a PROMISE -- it is drawn as "+N" and its tooltip says "Show N
  // claims" -- so a click that changes nothing is the interface contradicting itself, and a
  // reader cannot tell it from a dead control. Reported from use on the Akhlaghi map, where
  // collapsing "The conditional answer" gave its supporter a badge for a claim two stops away.
  //
  // Found by sweeping 4,230 fold states of that map and asking of every badge whether expanding
  // it revealed anything: 6 did not, and all 6 were rescued claims.
  // WHAT IS DRAWN, which is not what the walk reached. A claim inside a collapsed section is on
  // screen as that section's block, so revealing it changes nothing a reader can see. Both
  // halves of the badge are measured against this, and both were wrong before they were.
  const drawnSet = s => {
    const out = new Set();
    for (const id of s) out.add(collapsedRepr(id));
    return out;
  };
  const drawnNow = drawnSet(walkedOnly);   // like for like: neither side has the rescue in it

  const forced = force ? new Set(force) : null;
  const hiddenBelow = new Map();
  for (const id of visible) {
    if (forced && forced.has(id)) continue;
    // A CHILD ALREADY STANDING BEHIND A BLOCK IS NOT HIDDEN. It used to be enough that a child
    // was outside `visible`; but if revealing it would only put it inside a section block that
    // is already on screen, the picture does not change and the badge promised nothing it can
    // give. Found by exhausting every four-claim map WITH SECTIONS -- 5,940 cases, the smallest
    // being `n1->n0, n2->n1, n3->n0` with n0 and n2 in a shut section: n1 offered "+1" for a
    // claim that would have appeared inside the block beside it.
    const n = kids(id).filter(c => !visible.has(c) && !drawnNow.has(collapsedRepr(c))).length;
    if (n) hiddenBelow.set(id, n);
  }

  // 3b. And what would FOLDING hide? The other half of the same promise.
  //
  // A claim with children and nothing hidden below it is drawn with a MINUS, and the tooltip
  // offers to fold them away. On the Akhlaghi map 43 claims carried one and 8 of them hid
  // nothing at all when clicked.
  //
  // A RECONSTRUCTION IS A DAG, NOT A TREE. Collapsing one parent cannot remove a claim that
  // another parent still holds up, so "has children" -- which is what the badge was drawn from
  // -- does not mean "folding me will do something". Nor does anything simpler: a rule based on
  // who a claim's parents are was measured across six maps and four fold states, and it removed
  // every dead badge AND three working ones, all of them under a depth limit, where a claim's
  // visibility depends on the walk continuing rather than on its parentage. Losing a control
  // that works is the worse error.
  //
  // So ask the walk, which is the only thing that knows. One extra walk per candidate, each
  // O(V+E), on the tens of claims that could carry a minus -- a few thousand operations, which
  // is nothing beside the layout that follows.
  //
  // AND THE COMPARISON IS OF WHAT IS DRAWN, not of what the walk reached. A claim inside a
  // collapsed section is already standing behind that section's block, so losing it changes
  // nothing a reader can see -- and counting it left one dead minus behind on the Akhlaghi map,
  // reachable by shutting two sections and then looking at n44. Mapping both sets through
  // `collapsedRepr` asks the question about the picture instead.
  const foldable = new Set();
  for (const id of visible) {
    if (hiddenBelow.has(id)) continue;                    // it is a "+", not a "−"
    // ALREADY SHUT IS NOT FOLDABLE. Folding a claim the reader has already folded is a no-op --
    // `reduceFold` adds it to a set it is in. It can still be DRAWN with children visible, when
    // those children are held up by another parent too, and it then showed a minus that did
    // nothing. Found by exhausting every four-node shape: `n1->n0, n2->n1, n3->n1` with n0 shut
    // is the smallest map in the world that exhibits it.
    if (S.collapsedNodes.has(id)) continue;
    if (!kids(id).some(c => visible.has(c))) continue;    // nothing below it is drawn
    if (drawnSet(runWalk(id).visible).size < drawnNow.size) foldable.add(id);
  }

  // Which file each chapter index names. Only the nodes know, and both the word-count lookup
  // and the layout need it.
  const chapterOfIndex = new Map();
  for (const n of ix.nodes)
    if (n.pos && !chapterOfIndex.has(n.pos.chapterIndex))
      chapterOfIndex.set(n.pos.chapterIndex, n.pos.chapter);

  // 4. Collapse groups. A node inside a collapsed group is represented by the group itself —
  //    the OUTERMOST collapsed one, so nesting behaves when several levels are folded.
  const collapsedFor = new Map();
  for (const id of visible) {
    const r = collapsedRepr(id);
    if (r !== id) collapsedFor.set(id, r);
  }
  // The same for a folded band of the by-position view. Outermost wins, exactly as above: with a
  // chapter shut, folding a section inside it must not carve a second block out of the one the
  // chapter already stands for.
  if (S.collapsedLanes.size) {
    for (const id of visible) {
      if (collapsedFor.has(id)) continue;
      const lane = textLane(ix.byId.get(id));
      if (lane === "gutter") continue;
      const chap = laneChapter(lane);
      const hit = S.collapsedLanes.has(chap) ? chap
                : S.collapsedLanes.has(lane) ? lane : null;
      if (hit) collapsedFor.set(id, "lane:" + hit);
    }
  }
  const repr = id => collapsedFor.get(id) || id;

  const outNodes = [];
  const folded   = new Map();   // synthetic id -> the nodes it stands for
  const foldedPos = new Map();  // synthetic id -> earliest text position it covers
  const foldedEnd = new Map();  // synthetic id -> latest, so a block can say how far it reaches
  const foldedLine = new Map(); // synthetic id -> earliest .argdown line it covers
  for (const id of visible) {
    const r = repr(id);
    if (r === id) {
      const n = ix.byId.get(id);
      outNodes.push({
        id: n.id, label: n.label || n.id, detail: n.detail || "",
        kind: n.kind || "statement", facet: n.facet || null, color: n.color || null,
        steps: n.steps == null ? null : n.steps,   // inference steps, if this is an argument
        // The premise-conclusion structure itself. Carried onto the drawn node because the
        // renderer draws the lines that have no box of their own, and it cannot know which
        // those are without the list.
        pcs: n.pcs || null,
        note: n.note || null,          // the reconstructor's marginalia
        comment: n.comment || null,    // someone else's, on the argument
        fidelity: n.fidelity || null,
        // THE TWO HALVES OF FIDELITY'S ANSWER, and both were dropped here. `fidelity` says how
        // far the claim is from the author's words, which is only half a report: `source` is the
        // words themselves and `warrant` is what licensed the distance. The graph carried them
        // and this projection did not, so the map had no way to show either.
        source: n.source || null,      // the author's exact words, which no box draws
        warrant: n.warrant || null,    // why a departure from them was taken
        order: n.order == null ? null : n.order,
        docLine: n.docLine == null ? null : n.docLine,   // line in the .argdown, for seating
        pos: n.pos || null,            // where in the manuscript; see argdown-positions.js
        group: firstVisibleGroup(ix, n.group, S),
        hidden: hiddenBelow.get(id) || 0,
        collapsed: S.collapsedNodes.has(id),
        // A BADGE IS A PROMISE, so it is drawn only where the promise can be kept: either
        // something is hidden below and expanding will reveal it, or folding will actually
        // take something away. `some(c => passes.has(c))` -- "does this have children at all"
        // -- was neither of those, and drew a dead control on both halves.
        expandable: (hiddenBelow.get(id) || 0) > 0 || foldable.has(id)
      });
    } else {
      if (!folded.has(r)) folded.set(r, []);
      folded.get(r).push(id);
      // A folded section stands at the point its EARLIEST claim occupies, so collapsing a
      // section in the exposition view leaves the block where the reader first meets it
      // rather than dropping it into the gutter for want of a position of its own.
      const p = ix.byId.get(id).pos;
      if (p && (!foldedPos.has(r) || posBefore(p, foldedPos.get(r)))) foldedPos.set(r, p);
      if (p && (!foldedEnd.has(r) || posBefore(foldedEnd.get(r), p))) foldedEnd.set(r, p);
      const dl = ix.byId.get(id).docLine;
      if (dl != null && (!foldedLine.has(r) || dl < foldedLine.get(r))) foldedLine.set(r, dl);
    }
  }
  for (const [synth, members] of folded) {
    const isLane = synth.startsWith("lane:");
    const gid = synth.slice(isLane ? 5 : 6);
    const g   = isLane ? null : ix.groupById.get(gid);
    const count = members.length;
    // THE BADGE COUNTS ONE LEVEL, ALWAYS. It used to show the total a section stood for, while
    // a folded claim showed only its immediate reasons — so a block marked "+118" opened onto
    // two claims and looked broken. What the circle promises is what the next click reveals:
    // for a section, the claims it is entered at (those bearing on something outside it, or on
    // nothing). The total is still on the block itself, where it reads as a size.
    const inside = new Set(members);
    const entry = members.filter(id =>
      ix.edges.some(e => e.from === id && !inside.has(e.to)) ||
      !ix.edges.some(e => e.from === id));
    // A folded band is named by the band, not by the id it is keyed on: the section's own
    // heading where it has one, and otherwise the file, which is what the band would have been
    // captioned with had it stayed open.
    const laneName = !isLane ? null
      : gid === "gutter" ? "no position in the text"
      : gid.indexOf("|") >= 0 ? gid.slice(gid.indexOf("|") + 1)
      : chapterLabel((ix.byId.get(members[0]).pos || {}).chapter);
    // A shut band shows its size in claims AND in words. In the by-chapter view of a book the
    // blocks are the whole picture, so a count that lived only on the band would be a count the
    // reader could not see at the one setting where they most want it.
    const laneWords = isLane ? bandWords(graph.words, gid, chapterOfIndex) : null;
    outNodes.push({
      id: synth, label: laneName || (g && g.label) || gid,
      detail: count + (count === 1 ? " claim" : " claims") +
              (laneWords ? " · " + laneWords.toLocaleString() + " words" : ""),
      kind: "group", facet: null, order: (g && g.order != null) ? g.order : null,
      pos: foldedPos.get(synth) || null,
      posEnd: foldedEnd.get(synth) || null,
      docLine: foldedLine.has(synth) ? foldedLine.get(synth) : null,
      group: isLane ? null : firstVisibleGroup(ix, g && g.parent, S),
      hidden: entry.length || count, collapsed: true, expandable: true,
      groupId: isLane ? null : gid,
      lane: isLane ? gid : null,       // textLane reads this, so the block sits in its own band
      members: members.slice()         // representedBy reads this; a lane has no members() walk
    });
  }

  // 5. Rewire edges through the representatives; drop self-edges and duplicates.
  const seen = new Set();
  const outEdges = [];
  for (const e of ix.edges) {
    if (!visible.has(e.from) || !visible.has(e.to)) continue;
    const a = repr(e.from), b = repr(e.to);
    if (a === b) continue;
    const key = a + " " + b + " " + (e.type || "support");
    if (seen.has(key)) continue;
    seen.add(key);
    // The inference step survives only while BOTH ends are themselves. Once either is folded
    // into a block the edge no longer runs premise-to-argument, and joining it to its fellows
    // would draw a linkage between things that are not on screen.
    const own = a === e.from && b === e.to;
    const linked = own && e.step != null;
    outEdges.push({ from: a, to: b, type: e.type || "support",
                    step: linked ? e.step : null,
                    // The rule travels with the step and dies with it. A bar that survives into
                    // a folded picture would be naming an inference whose premises are no longer
                    // on screen, which says more than the drawing can show.
                    rule: linked ? (e.rule || null) : null,
                    // The line number dies the same death, one condition earlier: it names a
                    // line of one argument's structure, and once either end stands for a block
                    // the edge is no line of anything.
                    line: own && e.line != null ? e.line : null });
  }

  // 5b. NOTHING FLOATS, PART TWO: THE CONNECTION IS DRAWN, NOT THE MISSING CLAIMS.
  //
  //  Step 2c rescues a claim stranded by a FOLD, by letting the one held-back neighbour through.
  //  It cannot help the other way a box ends up adrift, which is a claim the walk never reached
  //  at all: a band head is seeded into the visible set so that no band of the text drops out of
  //  the view whose subject is the text (step 2a-bis), and that seeding happens before the walk
  //  and knows nothing about folds. Collapse the claim its band argues towards and the head is
  //  left on screen attached to nothing.
  //
  //  ADDING THE MISSING CLAIMS BACK WAS TRIED AND REVERTED. It fixes this outright, and it
  //  breaks something worse: a claim on screen only because it was rescued vanishes as soon as
  //  the rescue stops being needed, so EXPANDING a node could hide one. A spare box costs a
  //  little clutter; a claim disappearing when you open something costs trust.
  //
  //  So no node is added. The EDGE is — one edge, from the adrift claim to the nearest claim
  //  that is drawn, along the relations the file actually has, passing through whatever is
  //  folded away in between. That satisfies both rules at once and cannot violate the third,
  //  because a set of nodes that never grows can never shrink. It is also the more honest
  //  picture: the reader sees that the connection exists and that something is folded out of it,
  //  rather than seeing a claim that appears to stand alone.
  const rescues = [];
  const attached = new Set();
  for (const e of outEdges) { attached.add(e.from); attached.add(e.to); }
  const adrift = outNodes.filter(n => n.kind !== "group" && !attached.has(n.id));
  if (adrift.length) {
    // Undirected adjacency over the FILE's relations, carrying each hop's direction and type so
    // the through-edge can be drawn the right way round.
    const near = new Map();
    for (const e of ix.edges) {
      if (!near.has(e.from)) near.set(e.from, []);
      if (!near.has(e.to)) near.set(e.to, []);
      near.get(e.from).push({ other: e.to, out: true, type: e.type || "support" });
      near.get(e.to).push({ other: e.from, out: false, type: e.type || "support" });
    }
    const drawn = new Set(outNodes.map(n => n.id));
    for (const n of adrift) {
      // Breadth-first, so the edge lands on the NEAREST drawn claim rather than an arbitrary
      // one: the shortest route is the one a reader would have followed on the unfolded map.
      const seenIds = new Set([n.id]);
      let frontier = (near.get(n.id) || []).map(h => ({ hop: h, at: h.other }));
      let found = null;
      let hops = 0;
      while (frontier.length && !found && hops++ < 40) {
        const next = [];
        for (const f of frontier) {
          if (seenIds.has(f.at)) continue;
          seenIds.add(f.at);
          const r = drawn.has(f.at) ? f.at : (visible.has(f.at) ? repr(f.at) : null);
          if (r && r !== n.id && drawn.has(r)) { found = { to: r, hop: f.hop }; break; }
          for (const h of near.get(f.at) || []) next.push({ hop: f.hop, at: h.other });
        }
        frontier = next;
      }
      if (!found) {
        // NOTHING DRAWN IS REACHABLE AT ALL, which is a different situation from the one a
        // through-edge fixes and needs the other tool. It happens when a claim's WHOLE COMPONENT
        // sits inside the section being opened: the section's entry claim is drawn, every claim
        // it relates to is held back, and there is no third party to draw a line to.
        //
        // The old repair for this (step 2c, removed 23 Aug) let one held-back neighbour through,
        // and did it BEFORE groups were collapsed — so it had to guess what the finished picture
        // would look like, guessed wrong, and let claims through that step 4 would have
        // represented anyway. That is what made a section appear to open several of its levels
        // at once. Here the picture is finished, so the question is settled rather than guessed,
        // and this fires only where a through-edge cannot.
        // NOT UNDER A DEPTH LIMIT. A reader who asked for two levels asked for the edges to
        // stop, and at depth 0 a lone contention with nothing attached is not adrift — it is
        // exactly what was asked for. The old repair carried this exclusion and dropping it
        // broke three fixtures the moment this one shipped.
        if (S.depth != null) continue;
        // NOR WHERE THE READER EMPTIED THIS CLAIM BY HAND, which is the same reasoning again.
        // Folding a claim means hiding everything reachable only through it; a claim left with
        // nothing attached BECAUSE IT WAS FOLDED is not adrift, it is exactly what was asked
        // for. Rescuing it puts back the one thing the reader just took away — and because the
        // rescue re-runs the whole pass, the fold appeared to do nothing at all. That is the
        // residue documented in docs/FOLDING.md: `n1->n0, n2->n1, n3->n1`, fold n1 and then n0,
        // and n1 comes straight back.
        if (S.collapsedNodes.has(n.id)) continue;
        const rescue = (near.get(n.id) || [])
          .map(h => h.other)
          .find(o => ix.byId.has(o) && !visible.has(o));
        if (rescue != null) rescues.push(rescue);
        continue;
      }
      const a = found.hop.out ? n.id : found.to;
      const b = found.hop.out ? found.to : n.id;
      const key = a + " " + b + " " + found.hop.type;
      if (seen.has(key)) continue;
      seen.add(key);
      outEdges.push({ from: a, to: b, type: found.hop.type, step: null, through: true });
    }
  }

  // 6. Groups that survive: still referenced, and not themselves folded away.
  const used = new Set(outNodes.map(n => n.group).filter(Boolean));
  for (const g of ix.groups) {
    if (!used.has(g.id)) continue;
    // Guarded, like every other walk up the group tree here: a file whose sections are each
    // other's parent is nonsense, but it is nonsense a shared tool will be handed, and this
    // loop had no guard — it span forever on a two-group cycle and hung the page.
    let p = g.parent;
    const seenParents = new Set([g.id]);
    while (p && !seenParents.has(p)) {
      seenParents.add(p);
      used.add(p);
      p = ix.groupById.has(p) ? ix.groupById.get(p).parent : null;
    }
  }
  const outGroups = ix.groups
    .filter(g => used.has(g.id) && !isInsideCollapsed(ix, g.id, S))
    .map(g => ({ id: g.id, label: g.label || g.id,
                 parent: firstVisibleGroup(ix, g.parent, S) }));

  // The manuscript's word counts ride along with the filtered graph rather than being looked up
  // from the full one: the layout and the toolbar both draw them, and neither is handed the
  // original. Passed through untouched — filtering claims does not change how long a section is.
  return { nodes: outNodes, edges: outEdges, groups: outGroups, rescues,
           words: graph.words || null, chapterOfIndex };
}

/** The nearest enclosing group that is still drawn as a cluster (not folded into a node). */
function firstVisibleGroup(ix, gid, S) {
  let g = gid, guard = new Set();
  while (g && ix.groupById.has(g) && !guard.has(g)) {
    guard.add(g);
    if (S.collapsedGroups.has(g)) return null;      // it became a node; nothing to nest in
    if (!isInsideCollapsed(ix, g, S)) return g;
    g = ix.groupById.get(g).parent;
  }
  return null;
}

function isInsideCollapsed(ix, gid, S) {
  let g = ix.groupById.get(gid), guard = new Set();
  while (g && g.parent && !guard.has(g.parent)) {
    guard.add(g.parent);
    if (S.collapsedGroups.has(g.parent)) return true;
    g = ix.groupById.get(g.parent);
  }
  return S.collapsedGroups.has(gid);
}

/** Every node inside this group, nested subgroups included. */
function membersOfGroup(graph, gid) {
  const parentOf = new Map((graph.groups || []).map(g => [g.id, g.parent]));
  const inside = g => {
    const seen = new Set();
    while (g && !seen.has(g)) { if (g === gid) return true; seen.add(g); g = parentOf.get(g); }
    return false;
  };
  return (graph.nodes || []).filter(n => n.group && inside(n.group)).map(n => n.id);
}


/* ===================== the exposition-ordered layout, pure ====================
 * Hoisted out of createLiveMap so it can be checked without a browser, the same move
 * that made the fold logic testable. Its only DOM-shaped input is `sizes` — a map of
 * node id to {width, height} — which the renderer gets by measuring real text and a
 * test can supply deterministically. Everything else is arithmetic.
 * ========================================================================== */
/* ------------------------------------------------------ the exposition-ordered layout
 *
 * The same nodes, laid out by WHERE THEY APPEAR IN THE TEXT rather than by what supports
 * what. Order of exposition and order of justification are different structures, and the
 * interesting places are where they come apart — which you cannot see in a map whose x-axis
 * is the argument's own shape.
 *
 *   x = position in the manuscript, as a column per distinct position, left to right
 *   y = depth in the justification DAG, banded so a row means the same thing across columns
 *
 * The x-axis is ORDINAL, not metric: column 40 is the fortieth place a claim is made, not
 * the fortieth page. Distances between columns therefore mean nothing, and the view does not
 * pretend otherwise — what it shows is sequence, and which way each edge runs.
 *
 * WHICH WAY EACH EDGE RUNS IS THE POINT — but not which way is better. Edges run reason ->
 * claim, so an edge whose source sits later in the text than its target is a claim the reader
 * meets BEFORE its support: ANTICIPATED. That is the announce-then-argue convention analytic
 * philosophy teaches, so it is not a fault, and the opposite (PREPARED) is not one either.
 * Both are invisible in the ordinary map, which is the reason for this one. Emphasis goes to
 * REACH, not to direction: reach is what the reader has to carry either way.
 *
 * Dagre is not used here. It ranks by graph structure, which is precisely the axis this view
 * replaces, and it cannot be told to put a node in a given rank. Instead this computes the
 * grid directly and returns a DAGRE-SHAPED object — node(), edge(), edges(), graph() — so
 * drawNodes, drawEdges and drawGroups are reused untouched.
 */
function layoutByText(vis, sizes, wrapWidth, aspect) {
  const GUTTER_GAP = 90;     // the visible break before the no-position lane
  const COL_GAP = 26, ROW_GAP = 18;
  // Lanes are the main structure now, so they get room. It must also exceed the padding their
  // boxes carry — 12 below one lane plus 24 above the next for its label — or consecutive lanes
  // overlap by a couple of pixels, which reads as a rendering fault rather than a tight gap.
  const BAND_GAP = 56;

  // 1. Depth in the DAG, from the roots of what is currently visible. This is the y-axis, and
  //    it is recomputed per render because folding changes which nodes are roots.
  const kids = new Map(vis.nodes.map(n => [n.id, []]));
  const outDeg = new Map(vis.nodes.map(n => [n.id, 0]));
  for (const e of vis.edges) {
    if (!kids.has(e.from) || !kids.has(e.to)) continue;
    kids.get(e.to).push(e.from);
    outDeg.set(e.from, outDeg.get(e.from) + 1);
  }
  const depth = new Map();
  const queue = vis.nodes.filter(n => outDeg.get(n.id) === 0).map(n => n.id);
  for (const id of queue) depth.set(id, 0);
  for (let i = 0; i < queue.length; i++) {
    for (const c of kids.get(queue[i]) || []) {
      if (depth.has(c)) continue;
      depth.set(c, depth.get(queue[i]) + 1);
      queue.push(c);
    }
  }
  // A cycle, or a component the facet filter stranded, leaves nodes unvisited. Bottom row.
  let maxD = 0;
  for (const d of depth.values()) maxD = Math.max(maxD, d);
  for (const n of vis.nodes) if (!depth.has(n.id)) depth.set(n.id, maxD + 1);

  // 2. Columns: one per distinct position, in reading order, then the gutter.
  //
  //    A COLUMN IS ONE PLACE IN THE TEXT, and that is what a stack of claims means: they were
  //    all reconstructed from the same line. It is worth seeing — six claims off one paragraph
  //    of Williams is a dense paragraph, and the picture should say so.
  //
  //    But a claim located only to its CHAPTER has no line, and `posKey` reads a missing line as
  //    line 0. Every such claim therefore landed in ONE column at the head of its chapter, in a
  //    pile that asserted two things that are not true: that they come from the same place, and
  //    that the place is the chapter's first line. On Carroll that was 5 of 20 claims — the
  //    reconstructor's own commentary, which has no position in the text at all. They are given
  //    a column each instead, so they tile along the head of the chapter. Still an approximation,
  //    but it no longer claims co-location it cannot know.
  const keyOf = new Map();
  const keys = new Set();
  let unlocated = 0;
  for (const n of vis.nodes) {
    let k = posKey(n.pos);
    if (k && n.pos.line == null) k += "#" + (unlocated++);
    keyOf.set(n.id, k);
    if (k) keys.add(k);
  }
  const cols = [...keys].sort();
  const colOf = new Map(cols.map((k, i) => [k, i]));
  const gutter = cols.length;                        // the lane for claims with no position
  const hasGutter = vis.nodes.some(n => !keyOf.get(n.id));
  const colIndex = id => keyOf.get(id) == null ? gutter : colOf.get(keyOf.get(id));

  // 3. LANES, one per SECTION, each wrapping onto as many rows as it needs.
  //
  //    The first version gave every distinct position in the manuscript its own column across
  //    the whole map, so the book came out 269 columns wide and 7 deep — about 66,000px by
  //    1,500. Technically a picture; useless as one, because nothing that thin can be taken in.
  //
  //    A chapter is the unit a reader navigates by, so a chapter is a LANE: its claims run left
  //    to right in the order the text makes them, and wrap like a line of prose when they reach
  //    the width of the page. Lanes stack downwards in reading order. The result is a column of
  //    chapters to scroll rather than a ribbon to pan — a better fit for a screen, and closer
  //    to how the thing being mapped is actually read.
  const byIdAll = new Map(vis.nodes.map(n => [n.id, n]));
  //    A LANE IS A SECTION, not a whole chapter. Chapters alone were too coarse: a journal
  //    article is one file, so every claim in it landed in a single lane and the section
  //    structure the author navigates by disappeared. Lanes now stack by file, and within a
  //    file by TOP-LEVEL heading. Sub-headings get no lane of their own — that fragments the
  //    picture without helping anyone find their place.
  //
  //    `pos.section` is baked in at build time, where the sources are; a map built without
  //    them simply has none, and falls back to one lane per chapter as before.
  //    The rule itself is `textLane`, module-level, because the filter needs the same one to
  //    decide what folding a band hides.
  //
  //    A SHUT SECTION IS DRAWN IN ITS CHAPTER'S ROW, beside its sibling sections, not in a band
  //    of its own. A band always costs a full row — its label strip, its content, and the gap
  //    to the next — so shutting the sections of a book bought nothing while each block still
  //    had a row to itself: 371 claims folded to 73 blocks and the picture got THINNER, 1:6
  //    becoming 1:19, because 81 bands still made 81 rows. Laid along the chapter's row the
  //    same 73 blocks come out about 1:2, which is a page. The block carries its section's name,
  //    so nothing is lost by not drawing a box round it.
  const laneOfNode = id => {
    const n = byIdAll.get(id);
    return n && typeof n.lane === "string" ? laneChapter(n.lane) : textLane(n);
  };
  //    Which chapters HAVE sections — asked of the manuscript, not of the lanes, so that a
  //    chapter whose sections are all shut still gets its band and its name. The lanes cannot
  //    answer it: with the sections shut there are no section lanes left to count.
  const sectionedChapters = new Set(vis.nodes.map(n => textLane(n))
    .filter(l => l !== "gutter" && l.indexOf("|") >= 0).map(laneChapter));
  const colLane = new Map();
  for (const n of vis.nodes) {
    const k = keyOf.get(n.id);
    if (k != null && !colLane.has(k)) colLane.set(k, laneOfNode(n.id));
  }
  const laneOfCol = k => colLane.get(k) || ("ch:" + Number(k.slice(0, k.indexOf(":"))));

  // A column is one distinct position; its claims stack, deepest last.
  const colNodes = new Map();
  for (const n of vis.nodes) {
    const k = keyOf.get(n.id) == null ? "gutter" : keyOf.get(n.id);
    if (!colNodes.has(k)) colNodes.set(k, []);
    colNodes.get(k).push(n.id);
  }
  for (const ids of colNodes.values())
    ids.sort((a, b) => (depth.get(a) - depth.get(b)) ||
                       ((kids.get(b) || []).length - (kids.get(a) || []).length) ||
                       String(a).localeCompare(String(b)));

  const colSize = new Map();
  for (const [k, ids] of colNodes) {
    let w = 0, h = 0;
    for (const id of ids) {
      const sz = sizes.get(id);
      w = Math.max(w, sz.width);
      h += sz.height + ROW_GAP;
    }
    colSize.set(k, { w, h: Math.max(0, h - ROW_GAP) });
  }

  const laneKeys = [];
  for (const k of cols) { const l = laneOfCol(k); if (!laneKeys.includes(l)) laneKeys.push(l); }
  if (hasGutter) laneKeys.push("gutter");

  // How far a lane runs before wrapping. Aim at a page rather than a ribbon: fold the total
  // column width into a block SHAPED LIKE THE WINDOW IT WILL BE FITTED INTO, with a floor so
  // small maps are not wrapped for nothing and a ceiling so large ones do not go back to being
  // a ribbon.
  //
  //   Wrapping at width W puts about totalW/W rows on the page, so the block is W wide and
  //   (totalW/W)·rowH tall, and asking for W/height = aspect gives W = sqrt(totalW·rowH·aspect).
  //
  // The ratio used to be the constant 1.6 and the caller passed nothing, so a map was laid out
  // for a 4:3 page whatever it was about to be shown on — too wide for a tall window, too tall
  // for a wide one, and in both cases the fitted map lost the scale it could have had. It is a
  // heuristic and stays one: with many small bands the height is set by the NUMBER of bands,
  // which no wrap width can reduce. Folding is the answer there, not arithmetic.
  const totalW = [...colSize.values()].reduce((a, c) => a + c.w + COL_GAP, 0);
  const typicalH = ([...colSize.values()].reduce((a, c) => a + c.h, 0) / (colSize.size || 1)) || 120;
  const ratio = Math.min(4, Math.max(0.6, aspect || 1.6));
  const wrapAt = Math.max(wrapWidth || 0, 900,
                          Math.min(2400, Math.sqrt(totalW * (typicalH + BAND_GAP) * ratio)));

  // A file that is divided into sections gets a band of its own AROUND its section bands, so the
  // reader can see which file they are in and fold the whole of it. That outer band needs a strip
  // of its own to write its name in, above the first section it holds — hence the extra room here
  // rather than in the box-building below, where moving the box would put it over the claims.
  const CHAPTER_HEAD = 26;
  const sectioned = sectionedChapters;
  // Room for the outer box to sit in. Without it the file band's top-left corner lands at
  // (-6, -6) and is clipped away: the frame the map is fitted into starts at the origin, so
  // anything laid out above or left of it is simply not drawn.
  const MARGIN = sectioned.size ? 26 : 16;
  const place = new Map();
  const laneBox = new Map();
  let y = MARGIN, maxRight = 0, lastChapter = null;
  for (const lane of laneKeys) {
    const mine = (lane === "gutter" ? ["gutter"] : cols.filter(k => laneOfCol(k) === lane))
                 .filter(k => colNodes.has(k));
    if (!mine.length) continue;
    const chap = lane === "gutter" ? "gutter" : laneChapter(lane);
    if (chap !== lastChapter && sectioned.has(chap)) y += CHAPTER_HEAD;
    lastChapter = chap;
    const left = MARGIN + (lane === "gutter" ? GUTTER_GAP : 0);
    const top = y;
    let x = left, rowH = 0;
    for (const k of mine) {
      const cs = colSize.get(k);
      if (x > left && x + cs.w > wrapAt) { x = left; y += rowH + ROW_GAP * 2; rowH = 0; }
      let cy = y;
      for (const id of colNodes.get(k)) {
        const sz = sizes.get(id);
        place.set(id, { x: x + cs.w / 2, y: cy + sz.height / 2,
                        width: sz.width, height: sz.height });
        cy += sz.height + ROW_GAP;
      }
      rowH = Math.max(rowH, cs.h);
      x += cs.w + COL_GAP;
      maxRight = Math.max(maxRight, x);
    }
    y += rowH;
    laneBox.set(lane, { top, bottom: y, left });
    y += BAND_GAP;
  }

  // 4. One band per lane, named for the chapter it holds.
  const expoGroups = [];
  const chapExtent = new Map();     // chapter lane -> the box its section bands need
  for (const lane of laneKeys) {
    if (!laneBox.has(lane)) continue;
    const ids = vis.nodes.filter(n => laneOfNode(n.id) === lane).map(n => n.id);
    // A band shut into a single block needs no band drawn round it: the block already carries
    // the band's name and its size, so the box adds a second copy of the caption and a frame
    // round one node. The block is its own handle — clicking it opens the band again.
    if (ids.length === 1 && ids[0] === "lane:" + lane) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const chapters = new Set();
    let inBook = true;
    // The heading comes off the LANE ID, which is what the band is, rather than off the claims
    // inside it. A folded file sits in its own band carrying the position of its first claim, so
    // reading the section back off the members would caption the whole file with its first
    // section — the band would be lying about its own extent at exactly the moment it is shut.
    const section = lane === "gutter" || lane.indexOf("|") < 0
                  ? null : lane.slice(lane.indexOf("|") + 1);
    // A chapter's OWN row inside a chapter that has sections: it holds the blocks of the shut
    // ones. It gets no band — the chapter band around it says which chapter this is, and the
    // blocks say which sections — but its extent has to reach the chapter band, or the band
    // would be drawn around the open sections only and leave the shut ones outside it.
    const ownRow = !section && lane !== "gutter" && sectionedChapters.has(lane);
    for (const id of ids) {
      const q = place.get(id); if (!q) continue;
      x0 = Math.min(x0, q.x - q.width / 2 - 12); x1 = Math.max(x1, q.x + q.width / 2 + 12);
      y0 = Math.min(y0, q.y - q.height / 2 - 24); y1 = Math.max(y1, q.y + q.height / 2 + 12);
      const n = byIdAll.get(id);
      if (n && n.pos) { chapters.add(n.pos.chapter); inBook = n.pos.inBook; }
    }
    if (!(x0 < x1)) continue;
    const names = [...chapters];
    // THE SECTION IS THE LABEL WHERE THERE IS ONE. A lane is now a top-level heading, so
    // labelling it with the filename says nothing: a one-file article came out as six lanes all
    // captioned with the same slug. The file gets its own band around them instead, below.
    // A NAMED SECTION KEEPS ITS NAME, whatever is true of the file holding it. The not-in-project
    // note used to win, so every section of such a file was captioned "not listed in the project
    // file" — the same words on the outer band and on each band inside it, which said nothing
    // about any of them. The note belongs on the file band, which is what it is about.
    const label = lane === "gutter" ? `no position in the text (${ids.length})`
                : section ? section
                : !inBook ? `not listed in the project file — ${names.length} file${names.length === 1 ? "" : "s"}`
                : chapterLabel(names[0]);
    if (section || ownRow) {
      const c = chapExtent.get(laneChapter(lane)) ||
                { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity,
                  names: new Set(), inBook: true };
      c.x0 = Math.min(c.x0, x0 - 10); c.x1 = Math.max(c.x1, x1 + 10);
      c.y0 = Math.min(c.y0, y0 - 24); c.y1 = Math.max(c.y1, y1 + 10);
      names.forEach(n => c.names.add(n));
      c.inBook = c.inBook && inBook;
      chapExtent.set(laneChapter(lane), c);
    }
    if (ownRow) continue;                       // its extent counted, no box of its own
    const wc = bandWords(vis.words, lane, vis.chapterOfIndex);
    expoGroups.push({ id: "lane:" + lane, label,
                      parent: section ? "lane:" + laneChapter(lane) : null, fold: true,
                      words: wc,
                      title: (section ? section + "\n" : "") + (names.join("\n") || label) +
                             (wc ? "\n" + wc.toLocaleString() + " words" : "") });
    place.set("lane:" + lane, { x: (x0 + x1) / 2, y: (y0 + y1) / 2,
                                width: x1 - x0, height: y1 - y0 });
  }

  // 5. The file bands, drawn AROUND the section bands they hold. Pushed to the FRONT of the list
  //    so they are painted first and the sections sit on top of them: the reader clicking inside
  //    a section must get the section, and clicking the file's own label strip must get the file.
  //    A file with no sections gets none of this — its single band is already the file, and a box
  //    drawn round one box says nothing.
  const chapGroups = [];
  for (const [chap, c] of chapExtent) {
    if (!(c.x0 < c.x1)) continue;
    const names = [...c.names];
    const cwc = bandWords(vis.words, chap, vis.chapterOfIndex);
    chapGroups.push({ id: "lane:" + chap, parent: null, fold: true, words: cwc,
                      label: c.inBook ? chapterLabel(names[0])
                           : `not listed in the project file — ${names.length} file${names.length === 1 ? "" : "s"}`,
                      title: names.join("\n") + (cwc ? "\n" + cwc.toLocaleString() + " words" : "") });
    place.set("lane:" + chap, { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2,
                                width: c.x1 - c.x0, height: c.y1 - c.y0 });
  }
  expoGroups.unshift(...chapGroups);

  // THE SHAPE OF EACH BAND, carried on the band so its header can draw it.
  //
  // A relation belongs to the band where its CLAIM sits, not where its reason does: the question
  // the sparkline answers is where the argument is being spent, and that is the claim's end. A
  // file band takes everything in its sections, so the file's mark is the sum of theirs.
  //
  // Every band is scaled to its OWN busiest bin rather than to the map's. Comparing bands by
  // height would be the obvious alternative and is worse: a two-claim section would then be a
  // flat line beside a forty-claim one, which says only that it is small — something the reader
  // can already see from the band.
  if (typeof ArgdownExposition !== "undefined") {
    const EXP = ArgdownExposition;
    const rk = EXP.ranks(vis.nodes);
    const all = EXP.reaches(vis.edges, rk.rank);
    const laneById = new Map(vis.nodes.map(n => [n.id, textLane(n)]));
    for (const gr of expoGroups) {
      const lane = gr.id.slice(5);
      const mine = all.filter(x => {
        const l = laneById.get(x.to) || "";
        return l === lane || l.indexOf(lane + "|") === 0;
      });
      /** @type {any} */ (gr).spark = EXP.sparkPaths(mine, rk.n);
      const v = EXP.verdict(mine, rk.n);
      if (v.centre != null) gr.title = (gr.title || gr.label) + "\n" + v.text;
    }
  }

  // 6. Edges. Anchored on the box boundary so the arrowhead lands on the edge of the target
  //    rather than under it, and bowed away from the straight line — forward edges above,
  //    debt below — so the two populations separate instead of overprinting.
  //
  //    WHAT COUNTS AS DEBT, and why it is not simply "runs right to left". Edges run
  //    reason -> claim, and the ordinary way to write a paragraph is to assert and then
  //    argue: on the book map 266 of 394 edges reach back a line or two, which is not a
  //    finding, it is prose.
  //
  //    IT USED TO BE MEASURED IN CHAPTERS, to get past that. That worked on the book and was
  //    silently useless everywhere else: a single-file article has ONE chapter, so every
  //    relation fell on the same side of the test, every edge was classed the same way, and
  //    the direction encoding never varied at all. On a paper — which is most of what gets
  //    reconstructed — the picture simply did not carry the information.
  //
  //    So the threshold is now on DISTANCE rather than on chapter boundaries: a relation is
  //    remarked on when it reaches further than `significant()` of the whole reconstruction,
  //    which excludes line-to-line prose for the original reason and still works when there
  //    is only one file. Attacks are excluded as before — an objection is not owed to the
  //    claim it attacks.
  const EX = (typeof ArgdownExposition !== "undefined") ? ArgdownExposition : null;
  const edgeList = [], edgeData = new Map();
  const reachLimit = EX ? EX.significant(cols.length) : Math.max(3, cols.length * 0.08);
  for (const e of vis.edges) {
    const a = place.get(e.from), b = place.get(e.to);
    if (!a || !b) continue;
    const ra = colIndex(e.from), rb = colIndex(e.to);
    const reach = (ra == null || rb == null) ? null : ra - rb;
    const debt = (e.type || "support") !== "support" || reach == null ||
                 Math.abs(reach) < reachLimit
      ? null : reach > 0;
    const p0 = boundary(a, b), p1 = boundary(b, a);
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    // Bow proportional to length, capped: a long reach across the book arcs clearly, a
    // neighbour-to-neighbour edge stays almost straight.
    const bow = Math.min(70, 12 + len * 0.08) * (debt === true ? 1 : -1);
    const mid = { x: (p0.x + p1.x) / 2 - (dy / len) * bow,
                  y: (p0.y + p1.y) / 2 + (dx / len) * bow };
    // How far the edge reaches, in columns. This — not its direction — is what the emphasis
    // tracks: a support that arrives forty claims away taxes the reader whichever way round
    // the two sit. Threshold is relative, so it means the same on a paper and on a book.
    const span = Math.abs(colIndex(e.from) - colIndex(e.to));
    const key = { v: e.from, w: e.to, name: e.type || "support" };
    edgeList.push(key);
    edgeData.set(e.from + " " + e.to + " " + key.name,
                 { points: [p0, mid, p1], debt: debt, span: span,
                   step: e.step == null ? null : e.step,
                   line: e.line == null ? null : e.line,
                   far: span >= Math.max(5, cols.length * 0.1) });
  }

  // The canvas is the union of everything drawn, bands included. Sizing it from the columns
  // alone was right while a band was only ever a backdrop behind claims it was measured from;
  // a file band is drawn wider and taller than its contents, and would have hung over the edge.
  let width = maxRight + 16, height = y + 16;
  for (const q of place.values()) {
    width  = Math.max(width,  q.x + q.width  / 2 + 16);
    height = Math.max(height, q.y + q.height / 2 + 16);
  }
  return {
    expoGroups,
    node: id => place.get(id),
    edge: e => edgeData.get(e.v + " " + e.w + " " + e.name) || { points: [] },
    edges: () => edgeList,
    graph: () => ({ width, height }),
    // Read by the toolbar, so the reader is told how much of the map is off the axis rather
    // than left to notice a lane at the edge and guess what it means.
    expo: { columns: cols.length,
            unplaced: vis.nodes.filter(n => !keyOf.get(n.id)).length,
            debt: edgeList.filter(k => edgeData.get(
              k.v + " " + k.w + " " + k.name).debt === true).length,
            support: edgeList.filter(k => edgeData.get(
              k.v + " " + k.w + " " + k.name).debt !== null).length,
            height: height }
  };
}

/** A chapter path as a band label: the filename, without its folder or extension. The full
 *  relative path stays in the tooltip, since two chapters can share a basename. */
function chapterLabel(chapter) {
  return String(chapter || "").replace(/^.*\//, "").replace(/\.(md|qmd)$/i, "");
}


/* ===== the by-argument layout, owned outright =====
 *
 * dagre used to stand here. By the end of the stability project (docs/STABILITY-PLAN.md) it
 * decided none of what a reader sees -- order, positions and boxes came from the home columns,
 * routes from the router -- and its remaining job was a ranking pass. So the ranking pass is
 * now written down, dagre is gone from the bundle, and the whole drawing pipeline is readable
 * end to end. What this must do:
 *
 *   ranks    longest path down from the apexes: a premise sits strictly below every claim it
 *            supports or attacks. A cycle -- which no published map has, but a reader can
 *            write -- breaks at the edge that would close it, instead of hanging.
 *   rows     each rank is a row; its height is its tallest claim; rows are RANKSEP apart,
 *            plus headroom above any row where section boxes begin, so a box's label strip
 *            never lies over the row above.
 *   boxes    a section's box is the hull of its members: 16 aside, 26 above for the label
 *            strip drawGroups draws, 12 below -- the same language the text layout speaks.
 *   x        assignHomeColumns, below: the document decides, not the traffic.
 *   routes   drawn for this arrangement: boundary-anchored, one waypoint per crossed rank,
 *            stepping around any claim the straight run would pierce.
 *
 * Returns the same shape layoutByText returns -- node(), edge(), edges(), graph() -- which is
 * all the renderer and the quality instruments ever read.
 */
function layoutByArgument(vis, sizes, opt) {
  const o = opt || {};
  const RANKSEP = o.ranksep || 46, NODESEP = o.nodesep || 22, MARGIN = 16;
  const BOX_TOP = 26, BOX_BOTTOM = 12;

  // Ranks. Consumers of a claim are the claims its edges point at.
  const onScreen = new Set(vis.nodes.map(n => n.id));
  const consumers = new Map(vis.nodes.map(n => [n.id, []]));
  for (const e of vis.edges)
    if (consumers.has(e.from) && onScreen.has(e.to)) consumers.get(e.from).push(e.to);
  const rank = new Map(), onPath = new Set();
  const rankOf = id => {
    if (rank.has(id)) return rank.get(id);
    if (onPath.has(id)) return 0;                    // a cycle: break it here, do not hang
    onPath.add(id);
    let r = 0;
    for (const c of consumers.get(id) || []) r = Math.max(r, rankOf(c) + 1);
    onPath.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const n of vis.nodes) rankOf(n.id);

  // Which rows each section's members occupy, nested sections included.
  const visGroups = new Map(vis.groups.map(x => [x.id, x]));
  const directNodes = new Map(), directGroups = new Map();
  for (const n of vis.nodes) {
    const k = n.group && visGroups.has(n.group) ? n.group : null;
    if (k) { if (!directNodes.has(k)) directNodes.set(k, []); directNodes.get(k).push(n.id); }
  }
  for (const gr of vis.groups) {
    const k = gr.parent && visGroups.has(gr.parent) ? gr.parent : null;
    if (k) { if (!directGroups.has(k)) directGroups.set(k, []); directGroups.get(k).push(gr.id); }
  }
  const groupRows = new Map();
  const rowsOfGroup = gid => {
    if (groupRows.has(gid)) return groupRows.get(gid);
    const rows = new Set();
    groupRows.set(gid, rows);                        // set first, so a cyclic parent cannot loop
    for (const id of directNodes.get(gid) || []) rows.add(rank.get(id));
    for (const sub of directGroups.get(gid) || []) for (const r of rowsOfGroup(sub)) rows.add(r);
    return rows;
  };
  for (const gr of vis.groups) rowsOfGroup(gr.id);

  // Headroom: how many box tops open above each row -- a section and its subsection starting
  // on the same row stack two label strips there. Footroom likewise for box bottoms.
  const topsAt = new Map(), bottomsAt = new Map();
  const chainAbove = gid => {
    const rows = groupRows.get(gid);
    if (!rows || !rows.size) return 0;
    const top = Math.min(...rows);
    const parent = (visGroups.get(gid) || {}).parent;
    const pRows = parent && groupRows.get(parent);
    return 1 + (pRows && pRows.size && Math.min(...pRows) === top ? chainAbove(parent) : 0);
  };
  for (const gr of vis.groups) {
    const rows = groupRows.get(gr.id);
    if (!rows || !rows.size) continue;
    const top = Math.min(...rows), bottom = Math.max(...rows);
    topsAt.set(top, Math.max(topsAt.get(top) || 0, chainAbove(gr.id)));
    bottomsAt.set(bottom, (bottomsAt.get(bottom) || 0) + 1);
  }

  // Rows to y. Rank 0 -- the contentions -- at the top.
  let maxRank = 0;
  for (const r of rank.values()) maxRank = Math.max(maxRank, r);
  const rowHeight = new Map();
  for (const n of vis.nodes) {
    const r = rank.get(n.id), h = (sizes.get(n.id) || { height: 54 }).height;
    rowHeight.set(r, Math.max(rowHeight.get(r) || 0, h));
  }
  const rowY = new Map();
  let y = MARGIN;
  for (let r = 0; r <= maxRank; r++) {
    if (!rowHeight.has(r)) continue;
    y += (topsAt.get(r) || 0) * BOX_TOP;
    rowY.set(r, y + rowHeight.get(r) / 2);
    y += rowHeight.get(r) + (bottomsAt.get(r) ? BOX_BOTTOM : 0) + RANKSEP;
  }

  // The node records. x comes from the columns pass; boxes from their members after it.
  const nodeMap = new Map();
  for (const n of vis.nodes) {
    const sz = sizes.get(n.id) || { width: 120, height: 54 };
    nodeMap.set(n.id, { x: 0, y: rowY.get(rank.get(n.id)) || MARGIN,
                        width: sz.width, height: sz.height });
  }
  for (const gr of vis.groups) nodeMap.set(gr.id, { x: 0, y: 0, width: 0, height: 0 });

  const edgeList = [], edgeData = new Map();
  let gw = MARGIN, gh = MARGIN;
  const g = {
    node: id => nodeMap.get(id),
    edge: e => edgeData.get(e.v + " " + e.w + " " + e.name),
    edges: () => edgeList,
    graph: () => ({ width: gw, height: gh, nodesep: NODESEP, ranksep: RANKSEP })
  };

  assignHomeColumns(g, vis);

  // Box verticals, inner sections first so a parent hulls its children's finished boxes.
  // assignHomeColumns has already set each box's x and width from the same hull.
  const deepFirst = [...vis.groups].sort((a, b) => {
    const d = id => { let n = 0, p = (visGroups.get(id) || {}).parent;
      while (p) { n++; p = (visGroups.get(p) || {}).parent; } return n; };
    return d(b.id) - d(a.id);
  });
  for (const gr of deepFirst) {
    let y0 = Infinity, y1 = -Infinity;
    for (const id of directNodes.get(gr.id) || []) {
      const p = nodeMap.get(id);
      y0 = Math.min(y0, p.y - p.height / 2); y1 = Math.max(y1, p.y + p.height / 2);
    }
    for (const sub of directGroups.get(gr.id) || []) {
      const p = nodeMap.get(sub);
      if (p.height) { y0 = Math.min(y0, p.y - p.height / 2); y1 = Math.max(y1, p.y + p.height / 2); }
    }
    if (y0 === Infinity) continue;
    const p = nodeMap.get(gr.id);
    p.height = (y1 + BOX_BOTTOM) - (y0 - BOX_TOP);
    p.y = (y0 - BOX_TOP) + p.height / 2;
  }

  // Routes, drawn for this arrangement. One waypoint per rank the edge crosses, x on the
  // straight run; endpoints on the box boundary, aimed at the first bend; and where the
  // straight run would pierce a claim, the waypoints inside that claim's rows step around
  // its nearer side. Two passes, because one detour can uncover another.
  const boxes = [];
  for (const n of vis.nodes) {
    const p = nodeMap.get(n.id);
    boxes.push({ id: n.id, x0: p.x - p.width / 2, x1: p.x + p.width / 2,
                 y0: p.y - p.height / 2, y1: p.y + p.height / 2 });
  }
  const M = 10;
  for (const e of vis.edges) {
    const vP = nodeMap.get(e.from), wP = nodeMap.get(e.to);
    if (!vP || !wP) continue;
    const rv = rank.get(e.from), rw = rank.get(e.to);
    const inner = [];
    const step = rv > rw ? -1 : 1;
    for (let r = rv + step; r !== rw && inner.length < 200; r += step)
      if (rowY.has(r)) inner.push({ x: 0, y: rowY.get(r) });
    const pts = [{ x: vP.x, y: vP.y }, ...inner, { x: wP.x, y: wP.y }];
    const last = pts.length - 1;
    for (let i = 1; i < last; i++)
      pts[i].x = pts[0].x + (pts[last].x - pts[0].x) * (i / last);
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (const b of boxes) {
        if (b.id === e.from || b.id === e.to) continue;
        let hit = false;
        for (let i = 0; i < last && !hit; i++)
          if (segmentHitsBox(pts[i], pts[i + 1], b, 4)) hit = true;
        if (!hit) continue;
        const t = ((b.y0 + b.y1) / 2 - pts[0].y) / ((pts[last].y - pts[0].y) || 1);
        const ideal = pts[0].x + (pts[last].x - pts[0].x) * Math.max(0, Math.min(1, t));
        const side = Math.abs(ideal - (b.x0 - M)) <= Math.abs(ideal - (b.x1 + M))
          ? b.x0 - M : b.x1 + M;
        for (let i = 1; i < last; i++)
          if (pts[i].y > b.y0 - 1 && pts[i].y < b.y1 + 1 && pts[i].x !== side) {
            pts[i].x = side;
            moved = true;
          }
      }
      if (!moved) break;
    }
    pts[0] = boundary(vP, pts[1] || wP);
    pts[last] = boundary(wP, pts[last - 1] || vP);
    const key = { v: e.from, w: e.to, name: e.type || "support" };
    edgeList.push(key);
    edgeData.set(key.v + " " + key.w + " " + key.name,
                 { points: pts, step: e.step == null ? null : e.step,
                   line: e.line == null ? null : e.line,
                   through: !!e.through, rule: e.rule || null,
                   validity: e.validity || null, countermodel: e.countermodel || null });
  }

  for (const p of nodeMap.values()) {
    gw = Math.max(gw, p.x + p.width / 2 + MARGIN);
    gh = Math.max(gh, p.y + p.height / 2 + MARGIN);
  }
  return g;
}

/* ===== stable order: home columns =====
 *
 * The stability plan's Phase 2b (docs/STABILITY-PLAN.md). Where the seating pass above
 * PERMUTES what dagre arranged, this pass replaces the horizontal arrangement outright:
 * dagre still decides ranks, heights and routes, and every visible block then takes an x that
 * is a function of the DOCUMENT and the visible membership alone -- never of the order dagre
 * happened to choose for this particular subset. Folding can remove a claim's neighbours; it
 * can no longer reshuffle them.
 *
 * HOW. One recursive packing over the section tree, in canonical order -- the seating pass's
 * own key, [section ordinal, source line] -- with a per-row cursor inside each container:
 * a claim occupies its own rank row; a section occupies every rank row between its first and
 * its last, so nothing that is not a member can be dealt an x inside its box. Vertically
 * disjoint blocks may share x, exactly as dagre stacks them. Section boxes are rebuilt as the
 * hull of their members plus a pad, because the box now follows the members rather than the
 * members being confined to dagre's box -- which is also why this pass has no unfit bands, no
 * overlap veto and no fallback: single-path, by construction, which Phase 2a measured to be
 * the property that matters more than any particular choice of geometry.
 *
 * Since 29 Aug 2026 this is the only arrangement: the flag it shipped behind, and the
 * dagre-arranged path it was measured against, both retired the day dagre did.
 */
function assignHomeColumns(g, vis, stats) {
  const visGroups = new Map(vis.groups.map(x => [x.id, x]));
  const byId = new Map(vis.nodes.map(n => [n.id, n]));

  // Direct children of each container, "" standing for the top level -- a node whose group is
  // not on screen is a top-level block for drawing purposes.
  const childrenOf = new Map();
  const add = (parent, id) => {
    const k = parent && visGroups.has(parent) ? parent : "";
    if (!childrenOf.has(k)) childrenOf.set(k, []);
    childrenOf.get(k).push(id);
  };
  for (const n of vis.nodes) add(n.group, n.id);
  for (const gr of vis.groups) add(gr.parent, gr.id);

  // The seating pass's canonical key, with a last-resort tie broken by the order the graph was
  // built in -- which is fixed once per file, so ties resolve the same way in every state.
  const HI = Infinity;
  const seq = new Map();
  vis.nodes.forEach((n, i) => seq.set(n.id, i));
  vis.groups.forEach((gr, i) => seq.set(gr.id, i));
  const keyCache = new Map();
  const keyOf = id => {
    if (keyCache.has(id)) return keyCache.get(id);
    let k = null;
    const n = byId.get(id);
    if (n) {
      k = [n.order == null ? HI : n.order, n.docLine == null ? HI : n.docLine];
    } else {
      for (const c of childrenOf.get(id) || []) {
        const ck = keyOf(c);
        if (ck && (k == null || ck[0] < k[0] || (ck[0] === k[0] && ck[1] < k[1]))) k = ck;
      }
      const gr = visGroups.get(id);
      if (gr && gr.order != null) k = [gr.order, k ? k[1] : HI];
      if (k == null) k = [HI, HI];
    }
    keyCache.set(id, k);
    return k;
  };
  const before = (a, b) => {
    const ka = keyOf(a), kb = keyOf(b);
    return ka[0] !== kb[0] ? ka[0] - kb[0]
         : ka[1] !== kb[1] ? ka[1] - kb[1]
         : (seq.get(a) || 0) - (seq.get(b) || 0);
  };

  // A row is a rank: dagre gives every node of a rank the same y.
  const rowKeys = [...new Set(vis.nodes.map(n => {
    const p = g.node(n.id);
    return p && p.y != null ? Math.round(p.y) : null;
  }).filter(y => y != null))].sort((a, b) => a - b);
  const rowIx = new Map(rowKeys.map((y, i) => [y, i]));
  const rowOf = id => {
    const p = g.node(id);
    return p && p.y != null ? (rowIx.get(Math.round(p.y)) ?? 0) : 0;
  };

  const GAP = (typeof g.graph === "function" && g.graph() && g.graph().nodesep) || 22;
  const PAD = 16;

  // Measure, then place: relative x per block within its container, width per container.
  const relX = new Map(), widthOf = new Map(), rowsOf = new Map();
  const measure = container => {
    const kids = (childrenOf.get(container) || []).slice().sort(before);
    const cursor = new Map();
    const rows = new Set();
    let maxX = 0;
    for (const id of kids) {
      if (visGroups.has(id)) {
        const w = measure(id);
        let rs = [...(rowsOf.get(id) || [])];
        if (!rs.length) {                       // an empty section still needs a shelf to sit on
          const p = g.node(id);
          rs = [p && p.y != null ? (rowIx.get(Math.round(p.y)) ?? 0) : 0];
        }
        // A section spans every row between its first and its last, occupied or not, so a
        // claim from outside can never be dealt an x inside its box.
        const lo = Math.min(...rs), hi = Math.max(...rs);
        let x = 0;
        for (let r = lo; r <= hi; r++) x = Math.max(x, cursor.get(r) || 0);
        relX.set(id, x);
        for (let r = lo; r <= hi; r++) { cursor.set(r, x + w + GAP); rows.add(r); }
        maxX = Math.max(maxX, x + w);
      } else {
        const p = g.node(id);
        if (!p || p.width == null) continue;
        const r = rowOf(id);
        const x = cursor.get(r) || 0;
        relX.set(id, x);
        cursor.set(r, x + p.width + GAP);
        rows.add(r);
        maxX = Math.max(maxX, x + p.width);
      }
    }
    if (container !== "") {
      rowsOf.set(container, rows);
      widthOf.set(container, maxX + PAD * 2);
      return maxX + PAD * 2;
    }
    return maxX;
  };
  measure("");

  const shift = new Map();
  const place = (container, base) => {
    for (const id of childrenOf.get(container) || []) {
      const rel = relX.get(id);
      if (rel == null) continue;
      if (visGroups.has(id)) {
        place(id, base + rel + PAD);
        const p = g.node(id);
        if (p) { p.width = widthOf.get(id); p.x = base + rel + p.width / 2; }
      } else {
        const p = g.node(id);
        if (!p || p.x == null) continue;
        const nx = base + rel + p.width / 2;
        if (nx !== p.x) shift.set(id, nx - p.x);
        p.x = nx;
        if (stats) stats.assigned = (stats.assigned || 0) + 1;
      }
    }
  };
  place("", 16);
}

/** Where each fold badge is drawn, in graph coordinates.
 *
 *  paintNode puts the circle at (width/2, height) inside a box translated to
 *  (x - width/2, y - height/2), so its centre is (x, y + height/2) -- and the height has to come
 *  from `sizes`, the same measurement the box itself is drawn with, rather than from the
 *  layout's idea of the node, which for a cluster is not the same number.
 *
 *  At module scope because `edgeGeometry` needs it, and `edgeGeometry` is shared with the
 *  quality measurements, which have no renderer to borrow a closure from.
 */
function badgeCentres(g, vis, sizes) {
  const out = new Map();
  if (!sizes) return out;
  for (const n of vis.nodes) {
    if (!n.expandable) continue;
    const p = g.node(n.id), s = sizes.get(n.id);
    if (p && s) out.set(n.id, { x: p.x, y: p.y + s.height / 2 });
  }
  return out;
}


/** How far the interior of a path strays from the straight line between its ends. */
function bowOf(p) {
  if (!p || p.length < 3) return 0;
  const a = p[0], b = p[p.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let m = 0;
  for (let i = 1; i < p.length - 1; i++)
    m = Math.max(m, Math.abs((b.x - a.x) * (a.y - p[i].y) - (a.x - p[i].x) * (b.y - a.y)) / len);
  return m;
}


/** WHERE EVERY LINE ACTUALLY GOES: the final points of every edge, keyed as the renderer keys
 *  them. One definition, used by the drawing code and by the quality measurements alike.
 *
 *  This is deliberately not left inside `drawEdges`. Every metric written while chasing the
 *  layout defects -- bend, detour, overshoot, arrival order, arrowhead occlusion -- had to know
 *  where the lines end up, and each one re-derived it from the layout by hand. That is two
 *  implementations of the same rule, and it went wrong in exactly the way the toolchain notes
 *  warn about: a measurement that filtered arrivals differently from the code reported zero
 *  crossings on a map that visibly had them. Anything that wants to know where a line goes now
 *  asks this.
 *
 *  The ORDER of the three steps is itself load-bearing and was got wrong once: the arrival point
 *  must be settled before the line is straightened, or the straightening cannot see the bulge
 *  that moving the arrival introduces.
 */
function edgeGeometry(g, vis, sizes) {
  const out = new Map();
  const badges = badgeCentres(g, vis, sizes);
  const ports = arrivalPorts(g, vis, sizes, BADGE_SIDE);
  const leaves = departurePorts(g, vis, sizes);
  const boxes = boxesOf(g, vis);
  const settle = (p, a, b) => straightenIfSafe(p, boxes, new Set([a, b])) || p;

  // Pass 1: seat the ARRIVAL of every edge, and note what its departure would become.
  const draft = new Map();
  for (const e of g.edges()) {
    const key = e.v + " " + e.w + " " + e.name;
    const raw = (g.edge(e) || {}).points || [];
    if (raw.length < 2) { out.set(key, raw); continue; }
    const badge = badges.get(e.w);
    const half = (sizes && sizes.get(e.w) ? sizes.get(e.w).width : 0) / 2;
    // A node with several incoming edges seats them left to right in the order they come from,
    // which is what stops two of them crossing beneath it. Where no port applies, the
    // single-arrival rules keep the arrowhead clear of the fold badge: sliding aside must clear
    // the arrowhead's WIDTH, trimming back only its tip.
    const port = ports.get(key);
    let pts;
    if (port) {
      pts = raw.map(p => ({ x: p.x, y: p.y }));
      pts[pts.length - 1] = port;
    } else {
      pts = offsetPastBadge(raw, badge, half, BADGE_SIDE)
            || clearOfBadge(raw, badge, BADGE_R + BADGE_CLEAR);
    }
    draft.set(key, { e, pts, leave: leaves.get(key) });
  }

  // Pass 2: decide about departures PER SOURCE, all of them or none.
  //
  // Seating a departure uncrosses two lines, but it leaves dagre's interior points where they
  // were, so where a claim blocks the straight run the line can bow further than before. Judging
  // that edge by edge was worse than either choice: reverting SOME of a node's departures while
  // seating the rest destroys the very ordering the seating exists to create, and the book map
  // came back with a crossing at three of its five levels. The order is a property of the whole
  // fan, so the decision has to be too.
  const bySource = new Map();
  for (const [key, d] of draft) {
    if (!d.leave) continue;
    if (!bySource.has(d.e.v)) bySource.set(d.e.v, []);
    bySource.get(d.e.v).push(key);
  }
  const seatThese = new Set();
  for (const [, keys] of bySource) {
    // ASK WHETHER THE FINISHED LINES ACTUALLY CROSS, not whether dagre's raw points were out of
    // order. The two differ, because seating the arrival and straightening both move things: on
    // two maps a source whose raw order was inverted came out correctly ordered anyway, and
    // seating it bought no crossing while bowing a line from 1 unit to 78.
    const plain = keys.map(key => {
      const d = draft.get(key);
      return { toX: g.node(d.e.w).x, at: settle(d.pts, d.e.v, d.e.w)[0].x };
    });
    const crosses = plain.some((a, i) =>
      plain.slice(i + 1).some(b => (a.toX - b.toX) * (a.at - b.at) < 0));
    if (!crosses) continue;
    let worst = 0;
    for (const key of keys) {
      const d = draft.get(key);
      const moved = d.pts.map(q => ({ x: q.x, y: q.y }));
      moved[0] = d.leave;
      worst = Math.max(worst, bowOf(settle(moved, d.e.v, d.e.w)) -
                              bowOf(settle(d.pts, d.e.v, d.e.w)));
    }
    if (worst <= DEPARTURE_BOW_ALLOWANCE) keys.forEach(k => seatThese.add(k));
  }

  // Pass 3: build the final path. Straighten LAST, once both ends are settled -- straightening
  // before an endpoint is final cannot see the bulge that moving it introduces.
  for (const [key, d] of draft) {
    let pts = d.pts;
    if (d.leave && seatThese.has(key)) {
      pts = pts.map(q => ({ x: q.x, y: q.y }));
      pts[0] = d.leave;
    }
    out.set(key, settle(pts, d.e.v, d.e.w));
  }
  return out;
}


/** The node boxes of a layout, as obstacles. */
/** The drawn curve as a polyline, matching what `smooth` actually paints.
 *
 *  Not the layout's polyline: a three-point edge is painted as a quadratic that cuts well inside
 *  its own middle point, so testing the polyline would report the line passing through boxes it
 *  misses and missing boxes it crosses. Computed rather than measured off the DOM — the maths is
 *  four lines and it keeps the whole thing testable in Node, where the hidden-span rule can be
 *  checked without a browser.
 *
 *  Corners on the many-point form are left square: `smooth` rounds them by at most CORNER_R,
 *  which cannot change whether a span sits inside a node-sized box.
 */
function drawnPolyline(pts, steps) {
  if (!pts || pts.length < 2) return pts || [];
  if (pts.length !== 3) return pts.slice();
  const n = Math.max(6, steps || 24);
  const [p0, c, p2] = pts;
  const end = { x: (c.x + p2.x) / 2, y: (c.y + p2.y) / 2 };
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * end.x,
               y: u * u * p0.y + 2 * u * t * c.y + t * t * end.y });
  }
  out.push(p2);
  return out;
}

/** PURE: which stretches of a drawn edge disappear behind a node that is not its own end.
 *
 *  WHY THIS EXISTS. 55% of the edges in the by-position view pass under at least one box, and
 *  the worst passes under ten — the layout stacks claims in text order, so a reason four
 *  sections away is a long near-vertical line with everything in between sitting on top of it.
 *  An occluded line is clipped by the box and resumes on the far side, and a line that resumes
 *  at a box's edge looks exactly like a line that STARTS at that box: the reader reads a
 *  relation between claims that are not related at all.
 *
 *  Interrupting a line at an object and resuming it elsewhere IS the cue for "two lines", so no
 *  amount of restyling the ends will fix it. What fixes it is giving the eye back the
 *  continuity, which is the draughtsman's hidden-line convention: what lies behind is drawn,
 *  and drawn dashed. The spans this returns are painted over the nodes, faint and broken.
 *
 *  Rerouting was the alternative and is not available here: with 55% of edges affected there is
 *  no clear lane to route into, and moving the lines would cost the property the view exists
 *  for — that horizontal distance means distance through the text.
 *
 *  Returns an array of point-runs. Runs shorter than `minRun` are dropped: a line grazing a
 *  corner needs no explaining, and marking it adds ink that means nothing.
 */
const SPAN_STEP = 7;                 // page units between samples; see the note inside
function hiddenSpans(poly, boxes, minRun) {
  const runs = [];
  if (!poly || poly.length < 2 || !boxes || !boxes.length) return runs;
  // Only boxes the edge could possibly touch. Without this the test is every sample against
  // every box on the map, which on the book is 394 edges x 370 boxes x 30 samples EVERY render
  // — and a render happens on every fold, every depth change and every pan-to-fit.
  let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity;
  for (const p of poly) {
    if (p.x < ax0) ax0 = p.x; if (p.x > ax1) ax1 = p.x;
    if (p.y < ay0) ay0 = p.y; if (p.y > ay1) ay1 = p.y;
  }
  const near = boxes.filter(b => b.x1 >= ax0 && b.x0 <= ax1 && b.y1 >= ay0 && b.y0 <= ay1);
  if (!near.length) return runs;
  // SAMPLE AT A FIXED SPACING, not at the polyline's own vertices. Two boxes with a visible gap
  // between them merged into one run whenever no vertex happened to fall in the gap, and the
  // dash was then painted straight across a stretch where the line is in plain view — the
  // opposite of what this is for. Vertex density is an accident of the layout; the question is
  // about distance on the page, so it has to be asked at a spacing in page units.
  const dense = [];
  for (let i = 0; i < poly.length; i++) {
    if (i) {
      const a = poly[i - 1], b = poly[i];
      const steps = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / SPAN_STEP);
      for (let k = 1; k <= steps; k++)
        dense.push({ x: a.x + (b.x - a.x) * k / (steps + 1),
                     y: a.y + (b.y - a.y) * k / (steps + 1) });
    }
    dense.push(poly[i]);
  }
  const inside = p => near.some(b => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1);
  let run = null;
  for (const p of dense) {
    if (inside(p)) { (run || (run = [])).push(p); }
    else if (run) { runs.push(run); run = null; }
  }
  if (run) runs.push(run);
  const min = minRun == null ? 10 : minRun;
  return runs.filter(r => {
    let len = 0;
    for (let i = 1; i < r.length; i++) len += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
    return len >= min;
  });
}

/* The premise-conclusion block drawn inside an argument's own box. */
const PCS_NUM_W = 24;    // the gutter the line numbers sit in
const PCS_BAR_H = 11;    // vertical room for an inference bar above a conclusion line
const PCS_GAP   = 7;     // between the argument's prose and the structure below it
const GROUP_LABEL_SIZE = 17.6;  // an open section's name: 1.6x the claim-title size, so the
                                // heading stands out of the crowd it heads -- see drawGroups

/** PURE: the rows of a premise-conclusion structure as the argument's own box draws them.
 *
 *  EVERY LINE IS A ROW. The box is the one place the whole numbered structure can be read in
 *  order, and it earned that job the hard way, one omission at a time. An UNTITLED line is not
 *  selected into the map at all -- under Argdown's default `statementSelectionMode` it becomes
 *  no node, no arrow and no trace -- so an argument standing on five premises of which one was
 *  bracketed once drew with exactly ONE arrow into it and the map said it had one reason. Then
 *  titled lines were left out as "already on the map", and a structure whose premises were all
 *  titled read as starting at line (5), with its titled conclusions -- and their inference
 *  bars -- missing entirely (the Cribb Master Argument, reported from use, twice).
 *
 *  A LINE WHOSE CLAIM HAS A BOX IS A REFERENCE, drawn bracketed -- `(1) [Title]` -- which is
 *  how the file itself writes one. The brackets are the account of the double appearance: this
 *  row is not a second drawing of the claim, it is the structure naming which box plays this
 *  line, and the claim's own arrow carries the same number (see `line` on the edges). An
 *  unbracketed row is a claim that lives nowhere else.
 *
 *  THE NUMBERS ARE THE FILE'S OWN, never derived: a reader checking the map against the source
 *  needs (4) to mean the line the file calls (4), and the same numbers now appear on the
 *  arrows, where an invented numbering would disagree in two places at once.
 *
 *  A conclusion carries `bar`, because an inference bar is what says the lines above it are
 *  premises rather than more assertions, and `rule` where the file named one; `ref` marks the
 *  bracketed form, and `refLabel` names the box it points at so a renderer can light it up.
 */
function pcsRows(pcs) {
  if (!Array.isArray(pcs) || !pcs.length) return [];
  const rows = [];
  for (const l of pcs) {
    if (!l) continue;
    const concl = l.role === "intermediary-conclusion" || l.role === "main-conclusion";
    rows.push({ n: l.n, role: l.role, concl, bar: concl, ref: !!l.drawn,
                refLabel: l.drawn ? String(l.title || "") : null,
                text: l.drawn ? "[" + String(l.title || "") + "]" : String(l.text || ""),
                rule: concl ? (l.rule || null) : null,
                verdict: concl ? (l.verdict || null) : null });
  }
  return rows;
}

/** PURE: where the linked premises of one inference step should meet before the arrow goes on.
 *
 *  WHY A JUNCTION AT ALL. Argdown draws two quite different things with the same arrow. Premises
 *  inside one inference step are LINKED — none of them carries any force without the others, and
 *  knocking one out destroys the step. A `+` relation is INDEPENDENT — knock it out and the rest
 *  still stand. Flattened onto a map they were indistinguishable: six premises of one step and
 *  six separate pro reasons both arrived as six arrows into a box. That is not a shortcoming of
 *  the drawing, it is the drawing asserting something false about the argument.
 *
 *  So the linked ones are gathered onto a bar and go on as ONE arrow, which is the convention
 *  argument mapping has used since Rationale: what is joined must hold together.
 *
 *    target   the box the step concludes to, {x, y, width, height}
 *    arrivals the last point of each member edge — where it currently meets the target
 *    gap      how far outside the box the bar sits
 *
 *  Returns {j, tip, bar:[a,b]} — the meeting point, the point on the box the single arrow lands
 *  on, and the two ends of the bar drawn across the junction. Null if there is nothing to join.
 */
function junctionGeometry(target, arrivals, gap, avoidCentre) {
  if (!target || !arrivals || arrivals.length < 2) return null;
  let ax = 0, ay = 0;
  for (const p of arrivals) { ax += p.x; ay += p.y; }
  ax /= arrivals.length; ay /= arrivals.length;
  // WHICH FACE the premises come in through, as an axis-aligned normal — not the raw direction
  // from the box's centre to them. The raw direction is what a first version used, and on a wide
  // box a mean arrival a few pixels off-centre tilted the bar by fifteen degrees, so the thing
  // meant to read as "these are one move" read as a stray stroke. Comparing the offsets in units
  // of the box's own half-extents is the standard test for which side a ray leaves by.
  const rx = (ax - target.x) / (target.width / 2 || 1);
  const ry = (ay - target.y) / (target.height / 2 || 1);
  const along = Math.abs(rx) > Math.abs(ry);
  const dx = along ? Math.sign(rx) || 1 : 0;
  const dy = along ? 0 : Math.sign(ry) || 1;
  const tip = boundary(target, { x: ax, y: ay });
  // KEEP CLEAR OF THE FOLD BADGE. It is a filled circle sitting on the middle of the bottom
  // edge, drawn above the edges — so a junction that arrives at the centre of that face has its
  // arrowhead swallowed and its bar crowded. `avoidCentre` is the radius to stay outside; the
  // junction slides along the face to the side the premises are already on.
  const r = avoidCentre || 0;
  if (r) {
    if (!along && Math.abs(tip.x - target.x) < r) {
      const room = target.width / 2 - r - 4;
      const side = (ax - target.x) >= 0 ? 1 : -1;
      if (room > 0) tip.x = target.x + side * Math.min(r + 4, room);
    } else if (along && Math.abs(tip.y - target.y) < r) {
      const room = target.height / 2 - r - 4;
      const side = (ay - target.y) >= 0 ? 1 : -1;
      if (room > 0) tip.y = target.y + side * Math.min(r + 4, room);
    }
  }
  const j = { x: tip.x + dx * (gap == null ? 20 : gap),
              y: tip.y + dy * (gap == null ? 20 : gap) };
  const j0x = j.x, j0y = j.y;
  // THE BAR IS AS WIDE AS THE FAN IT GATHERS. A fixed length read as a tick beside the arrow
  // rather than as a beam collecting the lines — the premises came in from three feet apart and
  // the mark acknowledging them was 40px wide wherever they were. Measured across the arrivals,
  // along the bar's own direction, so six premises spread across the map get a bar that visibly
  // spans them; clamped at both ends so one distant premise cannot stretch it across the page.
  const bx = -dy, by = dx;                       // unit vector along the bar
  let lo = Infinity, hi = -Infinity;
  for (const p of arrivals) {
    const t = (p.x - j0x) * bx + (p.y - j0y) * by;
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  const spread = (hi - lo) / 2;
  const half = Math.min(Math.max(target.width / 2, 30), Math.max(12, spread * 0.85));
  // `dir` runs ALONG the bar and `out` points away from the box, towards the premises. Both are
  // returned rather than recovered by the caller: they are already computed here, and a second
  // derivation from the bar's two endpoints loses the sign of `out` whenever the bar is
  // symmetric about the junction -- which it always is.
  return { j, tip, dir: { x: bx, y: by }, out: { x: dx, y: dy }, half,
           bar: [{ x: j.x - dy * half, y: j.y + dx * half },
                 { x: j.x + dy * half, y: j.y - dx * half }] };
}

/** PURE: where each member of a junction LANDS on the bar, and where its line turns onto it.
 *
 *  THE BAR IS A RAKE, NOT A POINT, and that is the whole of this repair. Every member used to be
 *  moved to the junction point `j`, so all of them converged on one spot. A premise sitting well
 *  to the side then ran almost PARALLEL to the bar on the way in, and its last few units lay
 *  along the bar itself: the two strokes merged, and the picture showed a bar that simply carried
 *  on off to the right with no visible join at all. Seen at 7x on `pcs-supported-premise`, the
 *  arriving line and the bar were not distinguishable.
 *
 *  Each member now lands at its own place along the bar and turns onto it PERPENDICULARLY,
 *  through a short stub. A shallow arrival stays shallow -- that is where the premise actually
 *  is, and bending the long run of the edge to disguise it would be a lie about the layout -- but
 *  it now meets the bar at a right angle instead of grazing it, which is what makes the join
 *  read as a join.
 *
 *  Returns one { land, lift } per arrival IN THE ORDER GIVEN: `land` is the point on the bar,
 *  `lift` the point just outside it where the line turns.
 */
function junctionFeet(geo, arrivals, approach, lines) {
  if (!geo || !arrivals || !arrivals.length) return [];
  const a = approach == null ? 12 : approach;
  const { j, dir, half } = geo;
  /* READING ORDER FIRST, ARRIVAL ORDER OTHERWISE.
   *
   * Where the members are numbered lines of one structure -- `lines` gives each arrival's line
   * number -- the feet go in that order along the bar, left to right (top to bottom on a side
   * face), because that is how a reader takes a premise list and it is the order the box lists
   * them in. The first version ordered feet by where each arrival already was, so the members
   * never crossed on the way in -- and on the Cribb master argument that put premise (3) left
   * of premise (1), which reads as the map shuffling the argument (reported from use). A short
   * braid below the bar is the cheaper falsehood: the numbers at the feet say which line is
   * which, whereas a bar out of order says the structure is.
   *
   * Arrival order remains for junctions whose members carry no numbering, where there is no
   * reading order to honour and the no-crossing rule is the only claim worth making.
   */
  const numbered = Array.isArray(lines) && lines.length === arrivals.length &&
                   lines.every(l => l != null) && new Set(lines).size === lines.length;
  // `dir` may point either way along the bar; reading order needs the axis-positive way round
  // (rightwards, or downwards on a vertical bar -- junctionGeometry keeps dir axis-aligned).
  const read = dir.x > 1e-9 || (Math.abs(dir.x) <= 1e-9 && dir.y > 0) ? 1 : -1;
  const order = numbered
    ? arrivals.map((p, i) => ({ i, t: lines[i] * read }))
              .sort((u, v) => u.t - v.t)
    : arrivals.map((p, i) => ({ i, t: (p.x - j.x) * dir.x + (p.y - j.y) * dir.y }))
              .sort((u, v) => u.t - v.t);
  const n = order.length, out = new Array(n);
  for (let k = 0; k < n; k++) {
    // EVENLY SPACED across the bar. Keeping each member's own offset and clamping it to the bar
    // was tried first: two premises on the same side both clamp to the same end and land on one
    // point, which is the convergence this exists to remove, moved to the end of the bar.
    // INSET FROM THE ENDS, so the bar overhangs its outermost member. Spanning the full width
    // put the outer members exactly on the bar's tips, where a line arriving shallow still reads
    // as the bar carrying on rather than as something meeting it -- the same illusion this
    // function exists to break, moved from the middle to the ends. A rake's beam sticks out past
    // its outermost tine, and for the same reason.
    const inset = Math.min(6, half * 0.25);
    const span = Math.max(0, half - inset);
    const t = n === 1 ? 0 : -span + (2 * span * k) / (n - 1);
    const land = { x: j.x + dir.x * t, y: j.y + dir.y * t };
    out[order[k].i] = { land,
                        lift: { x: land.x + geo.out.x * a, y: land.y + geo.out.y * a } };
  }
  return out;
}

/** PURE: how many times a route reverses horizontal direction — the measure of a slalom.
 *
 *  The seat router dodges each box it crosses to the nearer side OF THAT BOX, decided box by
 *  box. On a short hop that is the right economy; on a long climb through a column of stacked
 *  claims the nearer side alternates, and the route comes out weaving left-right-left the
 *  whole way up -- six reversals on the Miller map's <Deriving the limit> conclusion edge,
 *  drawn as a slalom between the very boxes it was avoiding (reported from use). Nothing
 *  short of a reversal count can see this: every individual dodge is locally sensible, and
 *  the bend metrics score corners one at a time.
 *
 *  Reversals smaller than 8 units are ignored; those are the stub turns and port seats every
 *  well-drawn edge has.
 */
function slalomFlips(pts) {
  let flips = 0, last = 0;
  for (let i = 1; i < (pts || []).length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    if (Math.abs(dx) < 8) continue;
    const s = Math.sign(dx);
    if (last && s !== last) flips++;
    last = s;
  }
  return flips;
}

/** PURE: an edge's route rebuilt for where it actually ends, or null to keep its own.
 *
 *  Two callers, one shape of fault. A junction MEMBER's foot is assigned in reading order
 *  (see junctionFeet) after its route was laid, so the old dodge can be a fossil -- on the
 *  Cribb master argument, premise (3)'s line swung out LEFT around the Rigour Argument to
 *  reach a foot that was no longer there, then cut back across the very box it had dodged.
 *  And a long edge that SLALOMS (see slalomFlips) has a route whose every dodge was locally
 *  sensible and collectively absurd. Both get the same repair: the straight run where nothing
 *  is in the way, otherwise one elbow round the flank of the whole stack of blockers, and
 *  accepted ONLY when the result is clean. A rebuild that still crosses something returns
 *  null and the original route stands, fossil bends and all, because an honest detour beats
 *  a new lie.
 */
function retargetTail(pts, land, boxes, skip) {
  if (!pts || pts.length < 2 || !boxes) return null;
  const a = pts[0], M = 10;
  const others = boxes.filter(b => !(skip && skip.has(b.id)));
  const clean = route => {
    for (let i = 0; i < route.length - 1; i++)
      for (const b of others)
        if (segmentHitsBox(route[i], route[i + 1], b, 4)) return false;
    return true;
  };
  // The straight run first: most retargeted members have nothing in the way at all.
  if (clean([a, land])) return [a, land];
  // Something blocks. Go round the WHOLE STACK of blockers with one elbow: across at a height
  // clear of them on the start's side, up (or down) their flank, across to the foot. Two
  // candidate flanks, nearer one first -- "nearer" measured against where the straight run
  // crosses the stack, which is the seat router's own tie-breaker.
  const blockers = others.filter(b => segmentHitsBox(a, land, b, 4));
  if (!blockers.length) return null;             // blocked only by its own elbows: give up
  const lo = Math.max(...blockers.map(b => b.y1)) + M;
  const hi = Math.min(...blockers.map(b => b.y0)) - M;
  const up = a.y > land.y;
  const nearY = Math.max(Math.min(up ? lo : hi, a.y), Math.min(a.y, land.y));
  const farY  = Math.max(Math.min(up ? hi : lo, Math.max(a.y, land.y)), Math.min(a.y, land.y));
  const midY = (Math.min(...blockers.map(b => b.y0)) + Math.max(...blockers.map(b => b.y1))) / 2;
  const t = (midY - a.y) / ((land.y - a.y) || 1);
  const ideal = a.x + (land.x - a.x) * Math.max(0, Math.min(1, t));
  const flanks = [Math.min(...blockers.map(b => b.x0)) - M,
                  Math.max(...blockers.map(b => b.x1)) + M]
    .sort((u, v) => Math.abs(u - ideal) - Math.abs(v - ideal));
  for (const side of flanks) {
    const route = [a, { x: side, y: nearY }, { x: side, y: farY }, land];
    if (clean(route)) return route;
  }
  return null;
}

/** PURE: the enclosure round the premises of one inference step, or null if it cannot be drawn.
 *
 *  THE RATIONALE CONVENTION, and the reason use testing asked for it: premises that work together
 *  are drawn inside one box, so the group reads as a SINGLE MOVE rather than as several separate
 *  reasons. The bar already asserts the linkage; the enclosure asserts it at a glance and at any
 *  zoom, which a thin line between distant boxes does not.
 *
 *  IT IS REFUSED RATHER THAN FORCED WHERE IT WOULD ENCLOSE A STRANGER. The premises of one step
 *  need not be adjacent -- dagre seats by rank and crossing count, and knows nothing about which
 *  argument a claim belongs to -- so their bounding box can easily contain a claim that has
 *  nothing to do with the step. Drawing it anyway would say that claim IS one of the premises,
 *  which is the same class of falsehood as the missing-premise defect this whole change exists to
 *  repair. A missing enclosure costs the reader a cue; a wrong one tells them something untrue,
 *  and the ordering principle in ARGDOWN-SUPPORT-PLAN.md puts the second far below the first.
 *
 *  `boxes` are dagre nodes ({x, y, width, height}, centred); `others` are the drawn boxes in
 *  `boxesOf`'s edge form ({x0, x1, y0, y1}). The two shapes differ because that is what each call
 *  site already has, and converting either would be a copy that could drift.
 */
function premiseHull(boxes, others, pad) {
  if (!boxes || boxes.length < 2) return null;
  const m = pad == null ? 9 : pad;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    if (!b || !(b.width > 0) || b.x == null || b.y == null) return null;
    x0 = Math.min(x0, b.x - b.width / 2);  x1 = Math.max(x1, b.x + b.width / 2);
    y0 = Math.min(y0, b.y - b.height / 2); y1 = Math.max(y1, b.y + b.height / 2);
  }
  if (!isFinite(x0) || !isFinite(y0)) return null;
  const r = { x: x0 - m, y: y0 - m, width: (x1 - x0) + m * 2, height: (y1 - y0) + m * 2 };
  for (const o of others || []) {
    if (o.x1 <= r.x || o.x0 >= r.x + r.width) continue;
    if (o.y1 <= r.y || o.y0 >= r.y + r.height) continue;
    return null;                                    // it would swallow something else
  }
  return r;
}

function boxesOf(g, vis) {
  const boxes = [];
  for (const n of (vis && vis.nodes) || []) {
    const p = g.node(n.id);
    if (p && p.x != null && p.width) boxes.push({ id: n.id, x0: p.x - p.width / 2,
                                                 x1: p.x + p.width / 2, y0: p.y - p.height / 2,
                                                 y1: p.y + p.height / 2 });
  }
  return boxes;
}

/** Does the segment a->b pass through the box? Slab clipping, with a margin so a line grazing
 *  a corner does not count. */
function segmentHitsBox(a, b, box, m) {
  const x0 = box.x0 - m, x1 = box.x1 + m, y0 = box.y0 - m, y1 = box.y1 + m;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-(b.x - a.x), a.x - x0], [b.x - a.x, x1 - a.x],
                        [-(b.y - a.y), a.y - y0], [b.y - a.y, y1 - a.y]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}

/** Straighten one path if the straight run is free of claims. Returns new points, or null.
 *
 *  `bow` is how far, in units, an interior point may sit off the straight line before this is
 *  worth doing at all -- below that the line already reads as straight and re-pointing it only
 *  churns the drawing.
 */
function straightenIfSafe(pts, boxes, skip, bow) {
  if (!pts || pts.length < 3) return null;
  const last = pts.length - 1, a = pts[0], b = pts[last];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return null;
  let off = 0;
  for (let i = 1; i < last; i++)
    off = Math.max(off, Math.abs((b.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (b.y - a.y)) / len);
  if (off < (bow == null ? 6 : bow)) return null;
  const out = pts.map((p, i) => ({ x: a.x + (b.x - a.x) * (i / last),
                                   y: a.y + (b.y - a.y) * (i / last) }));
  out[0] = { x: a.x, y: a.y };
  out[last] = { x: b.x, y: b.y };
  for (let i = 0; i < last; i++)
    for (const box of boxes) {
      if (skip && skip.has(box.id)) continue;
      if (segmentHitsBox(out[i], out[i + 1], box, 4)) return null;
    }
  return out;
}

function overlapsAnywhere(g, vis) {
  const boxes = [];
  for (const n of vis.nodes) {
    const p = g.node(n.id);
    if (!p || p.x == null || !p.width) continue;
    boxes.push([p.x - p.width / 2, p.x + p.width / 2, p.y - p.height / 2, p.y + p.height / 2]);
  }
  boxes.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[j][0] >= boxes[i][1] - 0.5) break;          // sorted: nothing further can touch
      if (Math.min(boxes[i][3], boxes[j][3]) - Math.max(boxes[i][2], boxes[j][2]) > 0.5) return true;
    }
  }
  return false;
}

/** The point on `from`'s rectangle where the line towards `to` leaves it. */
function boundary(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!dx && !dy) return { x: from.x, y: from.y };
  const hw = from.width / 2 + 2, hh = from.height / 2 + 2;
  const t = Math.min(Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity,
                     Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/* ===== making the direction of an edge visible ===== */
/* An arrow that cannot be seen is not an arrow. Two ways that happened, both measured on the
 * Darwin map before any of this was written:
 *
 * (a) THE FOLD BADGE EATS THE ARROWHEAD. dagre lays the map out bottom-to-top, so a support
 *     edge arrives at the BOTTOM-CENTRE of its target -- and the fold badge is a FILLED circle
 *     of r=9 centred exactly there. Nodes are painted after edges, so the circle wins. Ten of
 *     that map's twenty-five arrowheads ended at distance 0.0px from a badge centre: not nearly
 *     hidden, exactly hidden. It is worst on the folded overview, where every block has a badge.
 *
 * (b) A LONG EDGE STATES ITS DIRECTION ONLY AT ONE END. In the exposition view an edge bows
 *     right across the map -- 1171 units against a typical 60 on the same map -- and a reader
 *     tracing one across the screen has nothing to tell them which way it runs until they get
 *     there, by which time they have already had to guess.
 *
 * The fix for (a) is to treat the badge as part of the target's SILHOUETTE. The edge was already
 * anchored on the box boundary "so the arrowhead lands on the edge of the target rather than
 * under it"; the badge is drawn ON that boundary, so the boundary is not where the drawing
 * stops. Two alternatives were rejected: sliding the arrowhead sideways along the bottom edge
 * needs the last segment re-routed and puts several incoming edges on top of each other at a
 * node with more than one, and painting edges over nodes runs lines through the text.
 *
 * The fix for (b) is to repeat the arrowhead along the line as open chevrons -- open, not solid,
 * so they read as "still going this way" and are never mistaken for the end.
 *
 * Both are pure and exported, because what went wrong here is geometry, and geometry is exactly
 * what a headless harness can hold down.
 */

/** The fold badge's radius. paintNode draws the circle; these two must stay in step. */
const BADGE_R = 9;
/** Gap between the badge's edge and the arrowhead's TIP, used when trimming along the path.
 *  The marker is markerUnits="strokeWidth" with markerWidth 6 and refX 9 of a 10-wide viewBox,
 *  so its tip overshoots the path's end by 0.6 x stroke-width -- 1.7 units on the heaviest
 *  edge. 3 clears that with room to spare. */
const BADGE_CLEAR = 3;
/** How much extra bow is worth paying to uncross a node's departures. Generous, because a
 *  crossing is far more distracting than a gently bowed line -- but not unlimited.
 *
 *  MEASURED, not guessed -- and RE-MEASURED on 28 Aug 2026, when a bigger corpus moved it.
 *  Departure crossings surviving across every map at every level: 3 at 45, 1 at 120, 1 at 250,
 *  0 at 400, 0 unbounded. On the six maps this was first tuned against, 120 left none and cost
 *  nothing, which is what the note here used to say. The seventh -- Wilson at "+ detail", denser
 *  since it was rebuilt -- is the first fan where the trade is real: buying that last crossing
 *  costs, on that one row and nowhere else, worst bend 225 -> 294, overshoot 120 -> 160 and
 *  detour 1.6 -> 2.0. A line twice as long as its direct route is worse to look at than the one
 *  crossing it removes, so 120 stands and the crossing is recorded in the baseline. KNOWN-ISSUES
 *  carries the table.
 *
 *  The earlier readings that suggested a trade-off at 45 came from deciding edge by edge rather
 *  than per source. That is a different fault, and it is fixed. */
const DEPARTURE_BOW_ALLOWANCE = 120;
/** How far to the side of the badge an arrival point is moved, which is a DIFFERENT measurement
 *  and was wrongly sharing the one above.
 *
 *  Trimming backs the arrowhead away along the path, so what has to clear the badge is the TIP.
 *  Sliding sideways puts the arrowhead alongside the badge, so what has to clear it is the
 *  arrowhead's WIDTH -- and the marker is as wide as it is long. At markerHeight 6 on a 10-wide
 *  viewBox with markerUnits="strokeWidth", the head spans 3 x stroke-width either side of the
 *  line: 5.4 units normally and 8.4 on a far-reaching edge, which is drawn heavier.
 *
 *  So an offset of 12 left the head overlapping the circle by about two units on an ordinary
 *  edge and five on a heavy one -- visible, and exactly what it looked like: an arrowhead with a
 *  bite out of it. 9 + 8.4 + 2 rounds to 20. */
const BADGE_SIDE = 20;

/** Where a segment first crosses a circle, or null if it never does. */
function circleCrossing(a, b, centre, r) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const A = vx * vx + vy * vy;
  if (A < 1e-9) return null;
  const fx = a.x - centre.x, fy = a.y - centre.y;
  const B = 2 * (vx * fx + vy * fy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  for (const t of [(-B - root) / (2 * A), (-B + root) / (2 * A)]) {
    if (t >= 0 && t <= 1) return { x: a.x + vx * t, y: a.y + vy * t };
  }
  return null;
}

/** Move an edge's arrival point ALONG the target's bottom edge, clear of the fold badge.
 *
 *  Preferred over trimming, which was the first fix: an arrowhead stopped short of the node
 *  reads as not quite arriving, and it only looks right on the edges that needed it, so a map
 *  ends up with two kinds of arrival. Sliding sideways keeps every arrowhead ON the boundary,
 *  which is where the anchoring rule always intended them to land.
 *
 *  The side is chosen by where the line is COMING FROM, so it never crosses the badge to reach
 *  its new home. `halfWidth` is the target's own half-width: on a node too narrow to hold the
 *  offset there is nowhere to slide to, and the caller falls back to trimming.
 */
function offsetPastBadge(points, centre, halfWidth, radius) {
  if (!centre || !points || points.length < 2 || !(radius > 0)) return null;
  const end = points[points.length - 1], prev = points[points.length - 2];
  const dx = end.x - centre.x, dy = end.y - centre.y;
  if (dx * dx + dy * dy >= radius * radius) return points;      // already clear
  const room = halfWidth - 8;                                   // keep off the rounded corner
  if (!(room > radius)) return null;                            // too narrow: let the caller trim
  const side = Math.sign(prev.x - centre.x) || Math.sign(end.x - centre.x) || 1;
  const pts = points.slice();
  pts[pts.length - 1] = { x: centre.x + side * Math.min(radius, room), y: centre.y };
  return pts;
}


/** Where n incoming edges should meet the bottom of a box: left to right, clear of the badge.
 *
 *  Returns offsets from the box's centre, in order. The badge occupies the middle, so the usable
 *  bottom edge is two runs -- left of it and right of it -- and the slots are spread across both
 *  as though they were one, which keeps them evenly spaced and never puts one under the circle.
 */
function slotOffsets(n, halfWidth, side) {
  const edge = Math.max(side + 2, halfWidth - 8);
  const lenL = edge - side, lenR = edge - side;          // the two usable runs, each side
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const d = t * (lenL + lenR);
    out.push(d <= lenL ? -edge + d : side + (d - lenL));
  }
  return out;
}


/** Assign every node's incoming edges to arrival points ordered by where they come FROM.
 *
 *  WHY: two edges meeting the same box would otherwise arrive in whatever order dagre's routing
 *  happened to leave them, and on the Gettier map the claim coming from the LEFT landed right of
 *  the badge while the one from the RIGHT landed left, so they crossed just below the node for no
 *  reason. Sorting the arrivals by the source's x and seating them left to right cannot produce
 *  such a crossing: the order along the bottom edge now matches the order the sources sit in.
 *
 *  Only BOTTOM arrivals are touched, which is the whole of the "by argument" view -- dagre lays
 *  it out bottom-to-top. The exposition view sends edges in from every side, where a bottom-edge
 *  slot would mean nothing, and those are left alone.
 */
function arrivalPorts(g, vis, sizes, side) {
  const out = new Map(), byTarget = new Map();
  for (const e of g.edges()) {
    const pts = (g.edge(e) || {}).points;
    const box = g.node(e.w), s = sizes && sizes.get(e.w), src = g.node(e.v);
    if (!pts || pts.length < 2 || !box || !s || !src || box.x == null || src.x == null) continue;
    // ARRIVING AT THE BOTTOM does not mean arriving exactly ON the bottom edge. dagre clips an
    // edge to the box boundary, so one coming steeply from the side meets the lower-LEFT or
    // lower-RIGHT of the box instead: at the apex of the Gettier map five of eight arrivals sat
    // between 294 and 311 with the bottom edge at 316. Testing for the edge itself silently left
    // those five where they were, which both preserved the crossing and -- because the crossing
    // count applied the same test -- reported the problem as solved.
    const bottom = box.y + s.height / 2;
    const end = pts[pts.length - 1];
    if (end.y < box.y - 1 || Math.abs(end.x - box.x) > s.width / 2 + 2) continue;
    if (!byTarget.has(e.w)) byTarget.set(e.w, []);
    byTarget.get(e.w).push({ key: e.v + " " + e.w + " " + e.name, fromX: src.x, endX: end.x,
                             box, s, bottom });
  }
  for (const [, list] of byTarget) {
    if (list.length < 2) continue;                       // one arrival: the badge rule handles it
    /* PERMUTE THE POSITIONS DAGRE ALREADY CHOSE, rather than re-spacing the fan evenly.
     *
     * The mirror of departurePorts' own rule, learned late: spreading the slots across the
     * whole face seats a nearly-vertical arrival at the box's far corner, which manufactures
     * the very diagonal the seating exists to prevent -- on the Miller map, <Deriving the
     * limit>'s conclusion dived 136 units left to reach a slot, across its own departure fan
     * (reported from use). The EXISTING landing points, sorted and dealt out in source order,
     * fix exactly the same crossings while moving as little as possible.
     *
     * What even spacing was quietly buying is still owed: an arrowhead's width between
     * neighbours, and the fold badge's stretch of the face kept clear. The nudge passes below
     * pay it where they can; where they cannot -- too many arrivals, or everything piled on
     * the middle -- the even spread returns, because separated-and-clear beats
     * faithful-and-unreadable.
     */
    const half = list[0].s.width / 2;
    const edge = Math.max(side + 2, half - 8);
    const GAP = 12;
    let slots = list.map(a => Math.max(-edge, Math.min(edge, a.endX - a.box.x)))
                    .sort((u, v) => u - v);
    slots = slots.map(o => Math.abs(o) >= side ? o : (o >= 0 ? side : -side));
    for (let i = 1; i < slots.length; i++)
      if (slots[i] - slots[i - 1] < GAP) slots[i] = slots[i - 1] + GAP;
    for (let i = slots.length - 1; i >= 0; i--) {
      const cap = i === slots.length - 1 ? edge : slots[i + 1] - GAP;
      if (slots[i] > cap) slots[i] = cap;
    }
    const bad = slots.some((o, i) => o < -edge - 1e-6 || o > edge + 1e-6 ||
                                     Math.abs(o) < side - 1e-6 ||
                                     (i > 0 && o - slots[i - 1] < GAP - 1e-6));
    if (bad) slots = slotOffsets(list.length, half, side);
    list.sort((a, b) => a.fromX - b.fromX);
    list.forEach((a, i) => out.set(a.key, { x: a.box.x + slots[i], y: a.bottom }));
  }
  return out;
}


/** Seat every node's OUTGOING edges along its top, ordered by where they are going.
 *
 *  The mirror of `arrivalPorts`, and it was missing: fixing where lines LAND while leaving where
 *  they LEAVE to dagre still lets two edges out of one node cross each other a few units above
 *  it. On the Gettier map as it opens, both of the section blocks that feed the two Cases did
 *  exactly that -- 2 of 2 departure pairs crossed -- while the arrivals were all in order.
 *
 *  Only TOP departures are seated, which is the whole of the "by argument" view, since dagre lays
 *  it out bottom-to-top. There is no badge on a node's top edge, so the full width is usable.
 */
function departurePorts(g, vis, sizes) {
  const out = new Map(), bySource = new Map();
  for (const e of g.edges()) {
    const pts = (g.edge(e) || {}).points;
    const box = g.node(e.v), s = sizes && sizes.get(e.v), tgt = g.node(e.w);
    if (!pts || pts.length < 2 || !box || !s || !tgt || box.x == null || tgt.x == null) continue;
    const start = pts[0];
    if (start.y > box.y + 1 || Math.abs(start.x - box.x) > s.width / 2 + 2) continue;
    if (!bySource.has(e.v)) bySource.set(e.v, []);
    bySource.get(e.v).push({ key: e.v + " " + e.w + " " + e.name, toX: tgt.x, at: start.x,
                             box, s, top: box.y - s.height / 2 });
  }
  for (const [, list] of bySource) {
    if (list.length < 2) continue;                 // one departure: leave dagre's point alone
    // PERMUTE THE POSITIONS DAGRE ALREADY CHOSE, rather than re-spacing the fan evenly.
    //
    // Even spacing fixes the order and moves every line to do it, including the ones that were
    // already right: on two maps that turned a 1-unit bow into 78 and bought no crossing that a
    // gentler fix would not also have bought. Sorting the EXISTING departure points and dealing
    // them out in target order fixes exactly the same orderings while moving as little as
    // possible -- an edge already in its correct place does not move at all.
    const byTarget = list.slice().sort((a, b) => a.toX - b.toX);
    const slots = list.map(d => d.at).sort((a, b) => a - b);
    if (byTarget.every((d, i) => d.at === slots[i])) continue;   // already in order
    byTarget.forEach((d, i) => out.set(d.key, { x: slots[i], y: d.top }));
  }
  return out;
}


/** Trim the tail of an edge so its arrowhead lands OUTSIDE the target's fold badge.
 *
 *  The fallback for a node too narrow to slide along. See offsetPastBadge.
 *
 *  Returns the input array untouched when the path never enters the disc, so the ordinary case
 *  costs one distance test. Never returns fewer than two points: an edge with no path at all is
 *  a worse failure than an arrowhead in the wrong place, and if the whole final approach lies
 *  inside the disc there is nothing sensible to trim to, so the old endpoint stands.
 */
function clearOfBadge(points, centre, radius) {
  if (!centre || !points || points.length < 2 || !(radius > 0)) return points;
  const inside = p => (p.x - centre.x) ** 2 + (p.y - centre.y) ** 2 < radius * radius;
  if (!inside(points[points.length - 1])) return points;
  const pts = points.slice();
  while (pts.length > 2 && inside(pts[pts.length - 2])) pts.pop();
  const hit = circleCrossing(pts[pts.length - 2], pts[pts.length - 1], centre, radius);
  if (hit) pts[pts.length - 1] = hit;
  return pts;
}

/** How many intermediate direction marks a line of this length wants, and where along it.
 *
 *  FRACTIONS, NOT FIXED SPACING. The marks exist to say which way the line runs, and two say it
 *  as well as fifteen would while leaving the line itself legible. Thresholds are in graph
 *  units, where a node box is roughly 60 tall and 150 wide: the first mark appears only on an
 *  edge that visibly travels, and never on one joining neighbours, which already show their
 *  direction at the head.
 */
function directionFractions(length, opt) {
  const o = Object.assign({ one: 160, two: 430 }, opt || {});
  if (!(length > o.one)) return [];
  return length > o.two ? [1 / 3, 2 / 3] : [0.5];
}


/** Which underlying claims a view represents: a folded section stands for all its members.
 *  This is the quantity that must never shrink when the reader expands something. */
function representedBy(graph, vis) {
  const out = new Set();
  for (const n of (vis && vis.nodes) || []) {
    // `members` is carried on every folded block; the walk is the fallback for blocks built
    // before it was, and for hosts that hand us a vis they assembled themselves.
    if (n.kind === "group" && n.members) n.members.forEach(x => out.add(x));
    else if (n.kind === "group" && n.groupId) membersOfGroup(graph, n.groupId).forEach(x => out.add(x));
    else out.add(n.id);
  }
  return out;
}

/** Would this state still show everything `had` showed? */
function keepsEverything(graph, state, had) {
  const now = representedBy(graph, filterGraph(graph, state));
  for (const id of had) if (!now.has(id)) return false;
  return true;
}

/** THE FOLD STATE MACHINE, pure.
 *
 *  Extracted from createLiveMap so it can be driven without a browser. Three visibility bugs
 *  reached the author in a row because this logic lived inside a DOM-bound closure, where
 *  nothing could enumerate the states it produces; `test_fold_invariants.mjs` now walks its
 *  state space and checks the invariants after every action. The controls in createLiveMap are
 *  thin wrappers over this, so the harness exercises the shipping logic and not a copy.
 *
 *    graph   the full graph
 *    state   { collapsedGroups, collapsedNodes, expandedNodes, groupFolded, depth, facets }
 *    action  { type: "toggleGroup"|"toggleNode"|"depth"|"expandAll"|"collapseAll", ... }
 *    vis     the CURRENT filterGraph output; toggleNode needs to know what is on screen
 *    opt     { stepwiseExpand }
 */
function reduceFold(graph, state, action, vis, opt) {
  const stepwise = !opt || opt.stepwiseExpand !== false;
  const S = {
    collapsedGroups: new Set(state.collapsedGroups || []),
    collapsedNodes:  new Set(state.collapsedNodes  || []),
    expandedNodes:   new Set(state.expandedNodes   || []),
    groupFolded:     new Map([...(state.groupFolded || [])].map(([k, v]) => [k, new Set(v)])),
    collapsedLanes:  new Set(state.collapsedLanes || []),
    depth:           state.depth == null ? null : state.depth,
    byText:          !!state.byText,
    facets:          state.facets ? new Set(state.facets) : null
  };
  const childrenOf = id => (graph.edges || []).filter(e => e.to === id).map(e => e.from);

  if (action.type === "expandAll") {
    S.collapsedGroups = new Set(); S.collapsedNodes = new Set();
    S.expandedNodes = new Set(); S.groupFolded = new Map();
    S.collapsedLanes = new Set(); S.depth = null;
    return S;
  }
  if (action.type === "expandGroups") {
    // Open every section, and drop the stepwise marks they owned. Deliberately does NOT touch
    // the depth setting: "how much" and "sections" are separate scales now, and a control that
    // silently reset the other one is what made the old expand-all feel arbitrary.
    S.collapsedGroups = new Set();
    S.groupFolded = new Map();
    S.collapsedLanes = new Set();
    return S;
  }
  if (action.type === "byChapter") {
    // The first rung of the by-position ladder on a manuscript of several files: every top-level
    // section shut into a block, the files themselves open. A book laid out claim by claim is a
    // ribbon nobody can take in — 371 claims over 81 bands — and the chapter is the unit a reader
    // of a book navigates by. Clears the depth limit for the reason every other rung does: the
    // rungs are one scale, and two of them in force at once makes both look broken.
    S.collapsedLanes = new Set((graph.nodes || [])
      .map(textLane).filter(l => l !== "gutter" && l.indexOf("|") >= 0));
    S.depth = null;
    S.collapsedNodes = new Set(); S.expandedNodes = new Set(); S.groupFolded = new Map();
    return S;
  }
  if (action.type === "collapseAll") {
    // Whichever view is on screen, this folds the divisions THAT VIEW draws. Folding the Argdown
    // headings while the reader is looking at the manuscript's sections would appear to do
    // nothing, or worse, something arbitrary — the two sets of headings need not line up.
    if (S.byText) {
      S.collapsedLanes = new Set((graph.nodes || [])
        .map(textLane).filter(l => l !== "gutter"));
    } else {
      S.collapsedGroups = new Set((graph.groups || []).map(g => g.id));
    }
    S.groupFolded = new Map();
    return S;
  }
  if (action.type === "depth") {
    // A depth choice is a fresh baseline for the whole map; leaving per-node folds in place
    // makes the buttons look broken.
    S.depth = action.value == null ? null : action.value;
    S.collapsedNodes = new Set(); S.expandedNodes = new Set(); S.groupFolded = new Map();
    // Band folds go too: "by chapter" is the first rung of this same ladder, so leaving the
    // bands shut when the reader climbs off it would make the rung above look like it did
    // nothing at all.
    S.collapsedLanes = new Set();
    return S;
  }
  if (action.type === "toggleGroup") {
    // A band of the by-position view. No stepwise unfurling: the `groupFolded` dance below exists
    // to open an Argdown section one level at a time, and a band is not a level of the argument
    // — it is a stretch of the text, which is either shown or not.
    if (typeof action.id === "string" && action.id.startsWith("lane:")) {
      const lane = action.id.slice(5);
      S.collapsedLanes.has(lane) ? S.collapsedLanes.delete(lane) : S.collapsedLanes.add(lane);
      return S;
    }
    const opening = S.collapsedGroups.has(action.id);
    opening ? S.collapsedGroups.delete(action.id) : S.collapsedGroups.add(action.id);
    if (!opening) {
      // Re-folding the section: drop only the marks IT owns. A member may also be marked by an
      // enclosing section, and that mark must survive -- otherwise closing a subsection unfolds
      // claims the Part around it was still holding.
      for (const [id, gids] of [...S.groupFolded]) {
        if (!gids.has(action.id)) continue;
        const rest = new Set(gids); rest.delete(action.id);
        rest.size ? S.groupFolded.set(id, rest) : S.groupFolded.delete(id);
      }
      return S;
    }
    if (!stepwise) return S;
    // Opening: every member hides its WITHIN-SECTION reasons, so the section shows the claims
    // it starts from and one level only, while its edges out of the section still carry.
    // Claims the reader opened by hand stay open.
    for (const id of membersOfGroup(graph, action.id)) {
      if (S.expandedNodes.has(id)) continue;
      S.groupFolded.set(id, new Set(S.groupFolded.get(id) || []).add(action.id));
    }
    return S;
  }
  if (action.type === "toggleNode") {
    const n = (vis && vis.nodes || []).find(x => x.id === action.id);
    if (n && n.hidden > 0) {
      S.collapsedNodes.delete(action.id);
      S.groupFolded.delete(action.id);            // reveal what its section was holding back
      S.expandedNodes.add(action.id);
      if (stepwise) {
        // Its reasons appear folded, and no further -- BUT stepwise folding is a convenience
        // for legibility and must never cost the reader anything. Heuristics for "which
        // children are safe to fold" were tried twice and both leaked: a reason can be on
        // screen through another parent, and a reason can be invisible yet load-bearing,
        // carrying the only route to a whole section. So each fold is now TRIED, and kept only
        // if the map still represents everything it did before.
        const had = representedBy(graph, vis);
        for (const c of childrenOf(action.id)) {
          if (S.expandedNodes.has(c) || S.collapsedNodes.has(c)) continue;
          S.collapsedNodes.add(c);
          if (!keepsEverything(graph, S, had)) S.collapsedNodes.delete(c);
        }
      }
    } else {
      S.collapsedNodes.add(action.id);
      S.expandedNodes.delete(action.id);
    }
    return S;
  }
  return S;
}

/** Depth of the deepest node, so a host can size its depth control honestly. */
function maxDepth(graph) {
  const ix = index(graph);
  const roots = ix.nodes.filter(n => ix.outCount.get(n.id) === 0).map(n => n.id);
  const dist = new Map(roots.map(id => [id, 0]));
  const queue = roots.slice();
  let max = 0;
  while (queue.length) {
    const id = queue.shift();
    for (const c of ix.childrenOf.get(id) || []) {
      if (dist.has(c)) continue;
      dist.set(c, dist.get(id) + 1);
      max = Math.max(max, dist.get(c));
      queue.push(c);
    }
  }
  return max;
}

/* ------------------------------------------------------------------ rendering */

const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs) => {
  const e = document.createElementNS(NS, name);
  for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  return e;
};

/* THE KEYS ARE ARGDOWN'S OWN `relationType` STRINGS, and that is the whole point. `toGraph`
 * passes `e.relationType` through untouched, so a name here that Argdown never emits matches
 * nothing and every lookup below falls through to `REL.support` -- drawing the relation in the
 * green reserved for "this is a reason for that", which is the one thing it is not.
 *
 * `contradiction` was such a name. Argdown emits `contradictory`, so all four `><` relations in
 * the Akhlaghi sample drew as support, and their `marker-end` pointed at an arrowhead that was
 * never defined because the markers are generated FROM this table.
 *
 * STRICT MODE renames all three. `model.mode: strict` emits `entails`, `contrary` and
 * `contradictory` and never emits `support` or `attack` at all -- so before these were added,
 * every relation in a strict map drew green, including its attacks. They take the colour of the
 * relation they are the strict form of: same meaning to a reader, so same colour.
 */
/* HOW LOGIC TEXTS WRITE A RULE NAME ON AN INFERENCE LINE. "Hypothetical syllogism, Modus ponens"
 * is 38 characters and the bar it sits on is rarely that wide, so it was arriving as
 * "Hypothetical syllogism, Modu…" -- which names nothing. Abbreviated it is "HS, MP", which is
 * what a logic text would print, and the full name is one hover away.
 *
 * An unknown name is reduced to its initials only if it has several words; a one-word rule
 * (Barbara, Celarent) is already short and its initial would be nothing at all. */
const RULE_SHORT = {
  "modus ponens": "MP", "modus tollens": "MT",
  "hypothetical syllogism": "HS", "disjunctive syllogism": "DS",
  "constructive dilemma": "CD", "destructive dilemma": "DD",
  "universal instantiation": "UI", "existential generalisation": "EG",
  "existential generalization": "EG", "universal generalisation": "UG",
  "universal generalization": "UG", "existential instantiation": "EI",
  "double negation": "DN", "de morgan": "DeM", "de morgan's": "DeM",
  "contraposition": "Contrap", "simplification": "Simp", "conjunction": "Conj",
  "addition": "Add", "biconditional elimination": "BE", "reductio ad absurdum": "RAA"
};
function shortRule(name) {
  return String(name).split(",").map(part => {
    const t = part.trim();
    const known = RULE_SHORT[t.toLowerCase().replace(/\.$/, "")];
    if (known) return known;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length > 1 ? words.map(w => w[0].toUpperCase()).join("") : t;
  }).join(", ");
}

const REL = {
  support:       { color: "#3a9d5d", dash: null },
  attack:        { color: "#cc3b3b", dash: null },
  undercut:      { color: "#d08018", dash: "5 3" },
  contradictory: { color: "#8b5cc7", dash: "2 3" },
  entails:       { color: "#3a9d5d", dash: null },
  contrary:      { color: "#cc3b3b", dash: null }
};

const DEFAULTS = {
  maxLabelWidth: 190,
  fontSize: 12,
  titleSize: 11,
  padX: 10,
  padY: 8,
  ranksep: 46,
  nodesep: 22,
  duration: 350,
  minScale: 0.5,
  maxLines: 4,          // lines of claim text before a box offers "▼ more"
  // true for the lot, false for none, or {depth, facets, actions} to drop the parts a host
  // already provides — the structure map has its own depth control and does not want two.
  controls: true,
  fitOnRender: true,
  // Opening a fold reveals ONE level, not the whole subtree beneath it. A section holding 34
  // claims dumped out at once is unreadable, and the reader has lost the structure they clicked
  // in order to see. Set false for the old reveal-everything behaviour.
  stepwiseExpand: true
};

function createLiveMap(container, graph, options) {
  const opt = Object.assign({}, DEFAULTS, options || {});
  // Repair anything that cannot be drawn, and SAY SO. A silently mended file teaches its
  // author nothing, and this map is meant to be handed around with other people's Argdown.
  const cleaned = sanitiseGraph(graph);
  graph = cleaned.graph;
  if (cleaned.problems.length && typeof console !== "undefined" && console.warn)
    console.warn("argdown-live-map: the graph needed repair before it could be drawn:\n  - " +
                 cleaned.problems.join("\n  - "));
  let state = {
    collapsedGroups: new Set(options && options.collapsedGroups || []),
    collapsedNodes:  new Set(options && options.collapsedNodes  || []),
    expandedNodes:   new Set(options && options.expandedNodes   || []),
    groupFolded:     new Map(options && options.groupFolded     || []),
    collapsedLanes:  new Set(options && options.collapsedLanes  || []),
    depth:           options && options.depth != null ? options.depth : null,
    facets:          options && options.facets ? new Set(options.facets) : null
  };
  let textOpen = new Set();          // nodes showing their claim in full
  let allText = !!(options && options.allText);
  let lastVis = { nodes: [], edges: [], groups: [] };
  // The exposition-ordered view needs a manuscript position on the nodes, which only a host
  // holding the source files can supply. Without them the toggle is not offered at all, rather
  // than offered and silently doing nothing.
  const positioned = (graph.nodes || []).some(n => n.pos);
  // A manuscript of several files behaves differently in the by-position view: it opens folded
  // to its chapters, and its "how much" ladder gains a rung below the claims. One file needs
  // neither — folding its sections and showing one claim from each come to nearly the same
  // picture, and a rung that changes almost nothing is worse than no rung.
  const multiFile = new Set((graph.nodes || [])
    .filter(n => n.pos).map(n => n.pos.chapterIndex)).size > 1;
  let expo = positioned && !!(options && options.expositionOrder);
  // The filter needs to know which view it is filtering FOR: it measures depth from the head of
  // each section in the by-position view and from the contention in the argument view. Kept on
  // `state` rather than passed at each call so that `countAtDepth` — which builds a throwaway
  // state to put numbers on the buttons — cannot quietly disagree with what gets drawn.
  state.byText = expo;
  let expoOpened = false;
  if (expo && multiFile) {
    expoOpened = true;
    Object.assign(state, reduceFold(graph, state, { type: "byChapter" }, null, opt));
  }

  container.classList.add("alm");
  container.innerHTML = "";
  injectStyle();

  const svg      = el("svg", { class: "alm-svg" });
  const defs     = el("defs");
  const viewport = el("g", { class: "alm-viewport" });
  const gGroups  = el("g", { class: "alm-layer-groups" });
  // The enclosure round the premises of one inference step. Its own layer, between the sections
  // and the edges, because it is a BACKDROP: the member lines have to run over it to the bar,
  // and a section's box has to stay legible underneath it.
  const gHulls   = el("g", { class: "alm-layer-hulls" });
  const gEdges   = el("g", { class: "alm-layer-edges" });
  const gNodes   = el("g", { class: "alm-layer-nodes" });
  const gMeasure = el("g", { class: "alm-measure" });
  for (const k in REL) defs.appendChild(marker(k));
  // ABOVE the nodes, and only ever holds the dashed stretches of edges that pass behind one.
  // It has to sit on top: the whole point is that the reader sees the line continue across a
  // node instead of appearing to start at it.
  const gUnder = el("g", { class: "alm-layer-under" });
  viewport.append(gGroups, gHulls, gEdges, gNodes, gUnder);
  svg.append(defs, viewport, gMeasure);
  container.appendChild(svg);

  const parts = opt.controls === true ? { depth: true, facets: true, actions: true }
              : opt.controls ? Object.assign({ depth: true, facets: true, actions: true }, opt.controls)
              : null;
  const toolbar = parts ? buildToolbar(parts) : null;
  if (toolbar) container.appendChild(toolbar);

  const view = { x: 0, y: 0, k: 1 };
  let userMoved = false;   // has the reader taken the camera? see render()
  // Has the map ever been framed against a container that actually had a size? See `fitTo` and
  // the size watcher near the end of this file.
  let framedForReal = false;
  // A camera handed in by the host. `userMoved` comes with it, because a restored camera is by
  // definition one the reader chose — without that flag the first render would re-fit over it.
  let honourCamera = false;
  if (options && options.view) {
    view.x = options.view.x; view.y = options.view.y; view.k = options.view.k;
    userMoved = options.userMoved !== false;
    honourCamera = true;
    // AND THE MAP COUNTS AS FRAMED. The size watcher below re-frames until `fitTo` has run
    // against a real container — and honouring a handed-back camera means `fitTo` never runs,
    // so the watcher fired and threw the reader's camera away again. A camera supplied by the
    // host IS a framing: it came from a map that had already been measured.
    framedForReal = true;
  }


  let fitTimer = null;
  // The fold control the reader last pressed, and where it was on the screen. Set by the
  // controls, consumed by the very next render. See `holdStill`.
  let pin = null;
  let glideDur = (opt && opt.duration) || 350;  // this render's shared clock; see the --alm-dur note
  const drawn = new Map();     // node id -> <g>
  const drawnEdge = new Map();
  const drawnDir  = new Map();   // chevrons, keyed like drawnEdge // key    -> <path>
  const drawnLineNo = new Map(); // line numbers, keyed like drawnEdge // key -> <text>
  const drawnUnder = new Map();  // hidden-line stretches, keyed the same // key -> <g>
  const drawnJoin  = new Map();  // linked-premise junctions // "to|step" -> <g>
  const drawnHull  = new Map();  // the enclosure round one step's premises // "to|step" -> <rect>
  const drawnGroup = new Map();
  let lastFit = null;
  let lastG = null;          // the layout the last render produced; `focus` reads positions off it
  let lit = new Set();       // claims marked because something outside the map pointed at them

  /* ------------------------------------------------------------ measurement */

  const measureCache = new Map();
  /* A MEASUREMENT TAKEN WHILE THE SVG WAS NOT BEING RENDERED.
   *
   * `getComputedTextLength()` returns 0 inside a `display:none` container -- and the container is
   * display:none whenever the map pane is off, which is a layout the app offers on purpose
   * ("Check": the Argdown against the source, no map). Editing there re-renders the map into a
   * hidden stage: every word then measures 0, so no line ever exceeds the wrap width, every claim
   * collapses to one line, and every box comes out a few pixels wide with its text spilling
   * across the page. Cached, that survived the pane being shown again, so the map came back as a
   * column of slivers and stayed that way until reload.
   *
   * So a zero width for real text is not a measurement, it is the absence of one. It is never
   * cached, and this flag says the layout must be redone once there is something to measure
   * against. */
  let measuredBlind = false;

  /** Discard measurements taken blind, now that the container can be measured against.
   *  Returns true if anything needed doing. */
  function remeasureIfBlind(){
    if (!measuredBlind) return false;
    if (container.clientWidth <= 40 || container.clientHeight <= 120) return false;
    measuredBlind = false;
    measureCache.clear();
    return true;
  }

  /** Wrap a label to the box width. Measured with getComputedTextLength against a real text
   *  node in this SVG, so it respects whatever font the host page is using. */
  function measure(text, size, bold) {
    const key = size + "|" + (bold ? "b" : "n") + "|" + text;
    if (measureCache.has(key)) return measureCache.get(key);
    const probe = el("text", { "font-size": size, "font-weight": bold ? "600" : "400" });
    gMeasure.appendChild(probe);
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      probe.textContent = test;
      if (probe.getComputedTextLength() > opt.maxLabelWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    let width = 0;
    for (const l of lines) { probe.textContent = l; width = Math.max(width, probe.getComputedTextLength()); }
    gMeasure.removeChild(probe);
    const out = { lines: lines.length ? lines : [""], width: Math.ceil(width) };
    // Real text that measures nothing means the SVG is not being rendered — see `measuredBlind`.
    // Returned so this pass can finish, but not remembered.
    if (!width && String(text).trim()) { measuredBlind = true; return out; }
    measureCache.set(key, out);
    return out;
  }

  /** A claim clipped mid-sentence is a claim you cannot read, so the box grows to fit its text.
   *  Beyond `maxLines` it is clipped and the node offers a control to see the rest — otherwise
   *  one long claim sets the height of its whole rank and pushes everything else off screen. */
  function sizeOf(n) {
    const title = measure(n.label, opt.titleSize, true);
    const full  = n.detail ? measure(n.detail, opt.fontSize, false) : { lines: [], width: 0 };
    const open  = allText || textOpen.has(n.id);
    const clip  = !open && full.lines.length > opt.maxLines;
    const body  = clip ? { lines: full.lines.slice(0, opt.maxLines), width: full.width } : full;
    const lh    = opt.fontSize + 4, th = opt.titleSize + 4;

    /* THE PREMISE-CONCLUSION STRUCTURE, ONE LINE PER LINE OF THE ARGUMENT.
     *
     * WRAPPING EVERY PREMISE IN FULL WAS THE FIRST VERSION AND IT IS WRONG. A premise is a whole
     * sentence; five of them wrapped to two or three lines each is a box tall enough to shove its
     * neighbours off the map, and the height then reports the length of the PROSE rather than the
     * shape of the argument -- which is the one thing this block is drawn to show. Measured on
     * the Greenspan fixture, <All Bare>: 11 wrapped lines against 4 clipped.
     *
     * So each line is clipped to one, and the box says how many premises there are, in what
     * order, which of them is a conclusion and what rule licenses the step. The words are one
     * click away on the control the claim text already has -- and open, the rows wrap in full.
     */
    const rows = pcsRows(n.pcs);
    const rowSize = opt.fontSize - 1, rowLh = rowSize + 3;
    const rowsOut = rows.map(r => {
      const m = open && r.text ? measure(r.text, rowSize, false) : null;
      return Object.assign({}, r, {
        lines: m ? m.lines : [r.text],
        width: m ? m.width
                 : Math.min(textWidth(r.text, rowSize, "400"), opt.maxLabelWidth)
      });
    });
    let pcsH = 0, pcsW = 0;
    for (const r of rowsOut) {
      pcsW = Math.max(pcsW, r.width + PCS_NUM_W);
      pcsH += r.lines.length * rowLh + (r.bar ? PCS_BAR_H : 0);
    }
    if (rowsOut.length) pcsH += PCS_GAP;
    // The text control now serves the structure as well as the claim text, so a box carrying a
    // structure always offers it -- otherwise a clipped premise would have no way to be read.
    const more = clip || rowsOut.length > 0 || (open && full.lines.length > opt.maxLines);
    return {
      title, body, clipped: clip, expandable: more, pcs: rowsOut, pcsHeight: pcsH,
      width:  Math.max(title.width, body.width, pcsW) + opt.padX * 2,
      // The badge is drawn for every expandable node, hidden children or not, and its circle
      // has r=9 centred ON the bottom edge. Reserving space only when something was hidden
      // let the circle overlap the last line of an expanded node.
      height: title.lines.length * th + body.lines.length * lh + opt.padY * 2 + pcsH +
              (n.expandable ? 15 : 0) + (more ? 11 : 0)
    };
  }

  /** Trim a group's name to its own box.
   *
   *  Group labels were written at a fixed offset with no regard for the width of the box
   *  they name, so a long Part title simply ran on past its border and collided with the
   *  next group along. Measure with the same canvas the node text uses, and cut with an
   *  ellipsis; the full name stays available in the tooltip.
   */
  const widthCache = new Map();
  /** Width of a single unwrapped line. `measure` wraps to opt.maxLabelWidth, which is not
   *  what a one-line group label needs. */
  function textWidth(text, size, weight) {
    const key = size + "|" + weight + "|" + text;
    if (widthCache.has(key)) return widthCache.get(key);
    const probe = el("text", { "font-size": size, "font-weight": weight });
    probe.textContent = text;
    gMeasure.appendChild(probe);
    let w;
    try { w = probe.getComputedTextLength(); }
    catch (e) { w = String(text).length * size * 0.55; }   // headless / detached
    probe.remove();
    widthCache.set(key, w);
    return w;
  }

  /** Cut a single line to fit, with an ellipsis. The size and weight are parameters because the
   *  premise-conclusion rows are lighter and smaller than a group's name, and measuring them
   *  against the group label's metrics cut them in the wrong place. The defaults are the group
   *  label's, so every existing caller is unchanged. */
  function fitLabel(text, maxWidth, size, weight) {
    const sz = size == null ? 11 : size, wt = weight == null ? "600" : weight;
    if (!(maxWidth > 20)) return text;
    if (textWidth(text, sz, wt) <= maxWidth) return text;
    let lo = 1, hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (textWidth(text.slice(0, mid) + "…", sz, wt) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + "…";
  }

  /* ------------------------------------------------------------ layout + draw */

  function render(fit) {
    const vis = filterGraph(graph, state);
    lastVis = vis;                 // toggleNode reads this to decide show-vs-hide
    if (!vis.nodes.length) { clearAll(); return; }

    // A folded block sits at the position of its EARLIEST claim, which is the only honest
    // single point for it — but a block whose claims run across five chapters then looks as
    // though it belongs to the first. Say how far it actually reaches, on the block itself,
    // so the chapter band behind it cannot be misread as its extent.
    if (expo) {
      for (const n of vis.nodes) {
        if (n.kind !== "group" || !n.pos || !n.posEnd) continue;
        if (n.posEnd.chapterIndex === n.pos.chapterIndex) continue;
        n.detail += ` · ${chapterLabel(n.pos.chapter)} → ${chapterLabel(n.posEnd.chapter)}`;
      }
    }

    const sizes = new Map();
    for (const n of vis.nodes) sizes.set(n.id, sizeOf(n));

    // The shape of the space the map is about to be fitted into. Measured the same way fitTo
    // measures it — clientWidth/Height less the floating toolbar — so the layout is aiming at
    // the box it will actually land in rather than at a constant.
    const paneAspect = (() => {
      const cw = container.clientWidth || 800;
      const bar = toolbar ? toolbar.offsetHeight + 14 : 0;
      const ch = Math.max(80, (container.clientHeight || 500) - bar);
      return cw / ch;
    })();

    let g;
    if (expo) {
      g = layoutByText(vis, sizes, 0, paneAspect);
    } else {
      g = layoutByArgument(vis, sizes, opt);
    }

    // MOTION THAT READS AS MOTION (stability plan, Phase 4). The glide duration was one fixed
    // number, tuned for small adjustments — and under home columns a fold can slide a whole
    // flank of the map a thousand units in formation, which at 350ms reads as a lurch. So the
    // duration now scales with the largest move this render will make, shared by every node,
    // box, edge fade and the camera alike through the `--alm-dur` custom property the styles
    // already read: ONE clock, so the formation arrives together — per-node durations were
    // considered and rejected, because a flank that slides as one must land as one. Set before
    // any transform changes, or the browser would start the transition on the old clock.
    let effDur = opt.duration;
    if (lastG) {
      let maxMove = 0;
      for (const n of vis.nodes) {
        const now = g.node(n.id), was = lastG.node ? lastG.node(n.id) : null;
        if (now && was && was.x != null)
          maxMove = Math.max(maxMove, Math.abs(now.x - was.x), Math.abs(now.y - was.y));
      }
      if (maxMove > 500)
        effDur = Math.min(opt.duration * 2, Math.round(opt.duration * maxMove / 500));
    }
    svg.style.setProperty("--alm-dur", effDur + "ms");
    glideDur = effDur;

    drawGroups(g, vis);
    drawEdges(g, vis, sizes);
    drawNodes(g, vis, sizes);

    const gl = g.graph();
    // WHERE THE APEX SITS, so a map too big to fit can be anchored on its contention rather
    // than on its middle. dagre lays this out bottom-to-top, so the apex is the node with the
    // smallest y; taking the minimum needs no graph analysis and survives every filter.
    let apex = null;
    for (const n of vis.nodes) {
      const nd = g.node(n.id);
      if (!nd) continue;
      if (!apex || nd.y < apex.y) apex = { x: nd.x, y: nd.y };
    }
    lastG = g;
    lastFit = { w: gl.width || 1, h: gl.height || 1, apex };
    // Re-frame on its own unless the reader has taken the camera: mid-talk a fold should leave
    // the result centred without a second click, but while drafting a deliberate pan or zoom
    // must survive the next fold.
    // A CAMERA HANDED BACK BY THE HOST WINS THIS RENDER. Rebuilding the map after an edit
    // otherwise re-frames it twice over: `fit` is false and `userMoved` is true, but the map has
    // just grown by a claim, so `stranded` decides the old camera shows too little and re-fits —
    // and the reader, who was reading one corner, is thrown to a view of the whole thing.
    // Honoured once, so the next fold or depth change behaves normally.
    //
    // A PIN BEATS THE RE-FRAMING, including the `stranded` rescue. The reader has just pointed
    // at one thing and asked for it to change; holding that thing still is a better answer than
    // any framing of the whole, and it cannot strand them, because the point it holds is a point
    // that was on the screen. An explicit refit (`fit`) and a camera handed back by the host
    // still win — neither comes from a fold control, so neither ever has a pin to argue with.
    const held = pin && !fit && !honourCamera && applyPin(pin);
    pin = null;
    if (opt.fitOnRender && !honourCamera && !held && (fit || !userMoved || stranded(lastFit)))
      fitTo(lastFit.w, lastFit.h, lastFit.apex);
    // The restored camera still has to be PUT ON THE PAGE. `fitTo` is what normally writes the
    // transform, so skipping it left the viewport with no transform at all and the map drawn at
    // the origin, unscaled.
    else if (honourCamera) applyView();
    honourCamera = false;
    if (toolbar) syncToolbar(vis, g.expo);
    if (opt.onStateChange) opt.onStateChange(getState(), vis);
  }





  function drawNodes(g, vis, sizes) {
    const keep = new Set();
    for (const n of vis.nodes) {
      const p = g.node(n.id); if (!p) continue;
      keep.add(n.id);
      const s = sizes.get(n.id);
      let box = drawn.get(n.id);
      const fresh = !box;
      if (fresh) {
        box = el("g", { class: "alm-n", "data-id": n.id });
        gNodes.appendChild(box);
        drawn.set(n.id, box);
      }
      // TWO `alm-k-` classes: one for what the node is (`argument` / `statement` / `group`) and
      // one for its tag. They used to be the same thing because the adapter overwrote the type
      // with the tag; now that they are distinct, both are emitted, so tag-driven styling in
      // existing maps keeps working and argument-ness becomes stylable for the first time.
      box.setAttribute("class", "alm-n alm-k-" + n.kind
                       + (n.facet && n.facet !== n.kind ? " alm-k-" + n.facet : "")
                       + (n.fidelity ? " alm-f-" + n.fidelity : "")
                       + (n.collapsed ? " is-collapsed" : "")
                       // Lit from outside — the reader clicked the passage this claim came from.
                       // Set here rather than by a separate pass so it survives every re-render.
                       + (lit.has(n.id) || (n.members || []).some(m => lit.has(m)) ? " is-lit" : ""));
      paintNode(box, n, s, fresh);
      // Existing nodes glide (CSS transition on transform); new ones appear in place.
      //
      // THE STYLE PROPERTY, NOT THE `transform` ATTRIBUTE, and the difference is the whole
      // animation. Blink maps the SVG presentation attribute onto the CSS property, so changing
      // the attribute starts the transition and the map glides in a browser. WebKit does not:
      // the attribute change takes effect at once and the node jumps. That is why folding felt
      // smooth on the web page and snapped in the desktop app, which is WKWebView on macOS.
      //
      // Measured, in a real WKWebView, sampling halfway through a 600ms transition: by attribute
      // the element had already moved the full 300px; by style it had moved 148. Chrome animates
      // both. Setting the style property is therefore the spelling that works in both engines,
      // and is geometrically identical to the attribute given `transform-origin: 0 0`.
      box.style.transform =
        `translate(${p.x - s.width / 2}px,${p.y - s.height / 2}px)`;
      if (fresh) {
        box.style.opacity = "0";
        requestAnimationFrame(() => { box.style.opacity = "1"; });
      }
    }
    for (const [id, box] of drawn) {
      if (keep.has(id)) continue;
      drawn.delete(id);
      box.style.opacity = "0";
      setTimeout(() => box.remove(), glideDur);
    }
  }

  function paintNode(box, n, s, fresh) {
    box.innerHTML = "";
    /* HOVER TEXT MUST ADD SOMETHING. The tooltip used to open with the claim's own text --
     * which is what the box directly under the pointer is already drawing. Measured on the
     * Miller map: at the folded default every one of its four visible tooltips was a verbatim
     * repeat of the box, and opened, seven of eighteen still were. A tooltip that says what the
     * reader can already see teaches them that tooltips are not worth reading, which costs the
     * ones that do carry something.
     *
     * So the text appears only when the box CLIPPED it, and what the box can never show goes in
     * regardless: the author's own words, how far the claim is from them, and what licensed the
     * distance. A claim drawn in full with no provenance gets no tooltip at all, which is the
     * honest outcome -- there is nothing to add.
     *
     * The tooltip goes in FIRST. As the last child it was unreliable: browsers take the first
     * <title> child of the hovered element, and the fold badge appended before it carries one
     * of its own, so the fidelity note was shadowed rather than shown.
     */
    const title = el("title");
    const FID = { quotation: "the source's own words",
                  paraphrase: "paraphrase — close restatement, the reconstructor's words",
                  compression: "compression — several sentences reduced to one claim",
                  interpretation: "interpretation — a reading the text supports but does not state",
                  imputation: "imputation — a premise the argument needs but the author never states" };
    // Stern's dimensions, glossed. Unknown values are shown as written rather than dropped:
    // the field is a prompt, not a vocabulary, and an unusual reason is the one worth reading.
    const WARRANT = { enthymeme: "the argument is invalid without it and plainly relies on it",
                      hyperbole: "read as overstatement rather than as the position",
                      "sloppy-phrasing": "read as imprecise expression of a different claim",
                      "secret-sign": "read as a signal to knowing readers rather than at face value",
                      "other-texts": "supported by what the author says elsewhere",
                      coherence: "chosen because it makes the surrounding text hang together",
                      convention: "the field's standard reading of this passage" };
    /* WHEN A QUOTATION IS NOT NEWS. The author's exact words are worth a tooltip because the box
     * draws the reconstructor's claim instead -- except where the claim IS the quotation, which
     * is the whole point of `fidelity: quotation` and true of half the claims on this map.
     * Measured before this test existed: of fourteen tooltips carrying a quotation, seven shared
     * more than 92% of their words with the box under the pointer. So the quotation is dropped
     * when it says the same thing, and the fidelity line -- "the source's own words" -- is left
     * to make the point, which it makes more briefly than the words themselves can.
     *
     * Word overlap rather than string equality: a claim ends its sentence where the quotation
     * runs on, drops a citation, or closes a bracket the source left open, and none of those
     * make it a different claim. */
    const norm = t => String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ")
                        .replace(/\s+/g, " ").trim();
    // SYMMETRIC, and that is the whole of it. Containment was the first test and it was wrong in
    // the direction that matters: a reconstruction whose claim CONTAINS its quotation has padded
    // the author's words, and `[61]` of Miller is exactly that -- the court wrote "the decision
    // was unlawful" and the claim says "the decision to advise Her Majesty to prorogue Parliament
    // was unlawful". Suppressing the quotation there hides the padding, which is the one thing a
    // reader checking fidelity is looking for. Only near-EQUALITY is silence worth keeping.
    const saysTheSame = (a, b) => {
      const A = norm(a), B = norm(b);
      if (!A || !B) return false;
      if (A === B) return true;
      const aw = new Set(A.split(" ")), bw = new Set(B.split(" "));
      let shared = 0;
      for (const w of bw) if (aw.has(w)) shared++;
      const union = aw.size + bw.size - shared;
      return union > 0 && shared / union >= 0.92;
    };
    const bits = [];
    // `n.detail` IS the claim's whole text: `sizeOf` measures that and clips it. There used to be
    // an `n.full` here, carried from the workspace this program was extracted from and set by
    // nothing in it -- measured across the corpus, 714 nodes of 714 lacked it. Reading it first
    // cost seven claims their hover text for a day, because a dead field looks exactly like a
    // live one until something depends on it alone.
    if (s.clipped && n.detail) bits.push(n.detail);
    // The author's exact words, which the map never draws -- it draws the reconstructor's claim.
    if (n.source && !saysTheSame(n.detail, n.source))
      bits.push("\u201c" + String(n.source).replace(/^["\u201c]|["\u201d]$/g, "") + "\u201d");
    if (n.fidelity && FID[n.fidelity]) bits.push("[" + FID[n.fidelity] + "]");
    if (n.warrant)
      bits.push("warranted as " + n.warrant +
                (WARRANT[n.warrant] ? " — " + WARRANT[n.warrant] : ""));
    title.textContent = bits.join("\n\n");
    if (bits.length) box.appendChild(title);
    const r = el("rect", { class: "alm-box", width: s.width, height: s.height, rx: 7, ry: 7 });
    if (n.color) r.setAttribute("stroke", n.color);   // adapter may colour per node
    box.appendChild(r);
    let y = opt.padY + opt.titleSize;
    for (const l of s.title.lines) {
      const t = el("text", { class: "alm-title", x: s.width / 2, y, "text-anchor": "middle",
                             "font-size": opt.titleSize, "font-weight": "600" });
      t.textContent = l; box.appendChild(t); y += opt.titleSize + 4;
    }
    for (const l of s.body.lines) {
      y += opt.fontSize;
      const t = el("text", { class: "alm-text", x: s.width / 2, y: y - 3, "text-anchor": "middle",
                             "font-size": opt.fontSize });
      t.textContent = l; box.appendChild(t); y += 1;
    }
    /* THE PREMISE-CONCLUSION STRUCTURE, drawn as the file wrote it.
     *
     * LEFT-ALIGNED AND NUMBERED, where the claim text above it is centred. That is not a
     * decorative difference: these lines are an ORDERED LIST whose numbers are referred to by
     * `{uses: [1,2]}` and by the reader checking the map against the source, and a centred list
     * has no column for its numbers to line up in. The prose above is one statement and centres
     * correctly; the structure below is several, and reads as a list because it is one.
     *
     * The bar goes ABOVE the line it licenses, which is where Argdown's own notation puts it and
     * where two centuries of logic notation puts it. The rule name sits at the right-hand end of
     * the bar, so a step with no named rule simply has a plain bar rather than a gap.
     */
    if (s.pcs && s.pcs.length) {
      const rowSize = opt.fontSize - 1, rowLh = rowSize + 3;
      const x0 = opt.padX, x1 = s.width - opt.padX;
      const open = allText || textOpen.has(n.id);
      let py = opt.padY + s.title.lines.length * (opt.titleSize + 4) +
               s.body.lines.length * (opt.fontSize + 4) + PCS_GAP;
      for (const r of s.pcs) {
        if (r.bar) {
          const by = py + PCS_BAR_H / 2;
          let barEnd = x1;
          if (r.rule) {
            const v = r.verdict && r.verdict.state;
            // ROOM FOR THE BADGE FIRST. The name is right-anchored at the box edge, so an
            // invalid step has to give the badge its 15px before the label is fitted -- fitting
            // first and shifting after would truncate a name that had room all along.
            const pad = v === "invalid" ? 15 : 0;
            const shortName = shortRule(r.rule);
            const label = fitLabel(shortName, (x1 - x0) * 0.62 - pad, 8.5, "400");
            const rt = el("text", { class: "alm-pcs-rule" + (v ? " alm-v-" + v : ""),
                                    x: x1 - pad, y: by + 3,
                                    "text-anchor": "end", "font-size": 8.5 });
            rt.textContent = label;
            // The expansion, and the verdict in words. Both are things the abbreviation does
            // NOT show, which is the only reason a tooltip earns its place.
            const rtip = el("title");
            rtip.textContent = r.rule
              + (v === "valid" ? "\n\nChecked: the conclusion follows from the premises."
               : v === "invalid" ? "\n\nChecked: the conclusion does NOT follow."
               : v === "unformalized" ? "\n\nNot checked: the lines of this step carry no "
                                        + "`formalization:`, so the claim is unexamined."
               : "");
            rt.appendChild(rtip);
            box.appendChild(rt);
            if (v === "invalid") {
              const g = el("g", { class: "alm-verdict" });
              g.append(el("circle", { r: 6, cx: x1 - 6, cy: by }),
                       el("text", { x: x1 - 6, y: by, dy: 3.2, "text-anchor": "middle",
                                    "font-size": 8.5 }));
              g.querySelector("text").textContent = "!";
              const ttl = el("title");
              ttl.textContent = "The conclusion does not follow from the premises, on the "
                + "formalizations given."
                + (r.verdict.countermodel
                     ? "  Countermodel: " + Object.keys(r.verdict.countermodel)
                         .map(k => k + " = " + JSON.stringify(r.verdict.countermodel[k])).join(", ")
                     : "");
              g.appendChild(ttl);
              box.appendChild(g);
            }
            barEnd = x1 - pad - textWidth(label, 8.5, "400") - 5;
          }
          box.appendChild(el("path", { class: "alm-pcs-bar",
                                       d: `M${x0},${by}L${Math.max(x0 + 12, barEnd)},${by}` }));
          py += PCS_BAR_H;
        }
        const g = el("g", { class: "alm-pcs-row" + (r.concl ? " is-conclusion" : "") +
                                   (r.ref ? " is-ref" : "") });
        /* The whole line on hover WHEN IT WAS CUT, because a clipped premise is otherwise
         * unreadable and the reader should not have to open the box to find out what it says.
         * Open, the rows wrap in full and repeating them adds nothing -- so what stays is the
         * one thing the row cannot say about itself, that it is a reference to a claim with a
         * box of its own. Filled in after the lines are drawn, since only then is it known
         * whether anything was actually cut. */
        const rowTip = el("title");
        const refNote = r.ref
          ? "A reference: this claim has its own box on the map — " +
            (r.role === "premise" ? "its arrow into this argument carries this number."
                                  : "the arrow out to it carries this number.")
          : "";
        const rowFull = "(" + r.n + ") " +
          (r.role === "premise" ? "premise" :
           r.role === "main-conclusion" ? "conclusion" : "intermediate conclusion") +
          " — " + r.text;
        // POINTING AT THE BOX A REFERENCE NAMES. The brackets say "this claim lives elsewhere";
        // hovering the row shows WHERE, by lighting the claim's own box up. Resolved at hover
        // time against what is currently drawn, because folds change both halves of the pairing.
        // Any stale glow is swept first, so a repaint mid-hover cannot leave one stranded.
        if (r.ref && r.refLabel) {
          g.addEventListener("mouseenter", () => {
            for (const s2 of svg.querySelectorAll(".is-ref-target"))
              s2.classList.remove("is-ref-target");
            const target = lastVis.nodes.find(x => x.label === r.refLabel);
            const tb = target && drawn.get(target.id);
            if (tb) tb.classList.add("is-ref-target");
          });
          g.addEventListener("mouseleave", () => {
            for (const s2 of svg.querySelectorAll(".is-ref-target"))
              s2.classList.remove("is-ref-target");
          });
          /* GOING TO THE CLAIM, AND GETTING BACK.
           *
           * Lighting the box up says where the claim lives, which is no use at all when it
           * lives off screen -- on Miller, premise (2) of `The route to the order` sits some
           * two thousand pixels from the argument that numbers it. So the row travels there.
           *
           * The return trip is the half that matters. A reader who is moved somewhere they did
           * not choose, with no way back, has been lost rather than helped, so the excursion
           * leaves a control behind naming the argument it came from. Centring back on the
           * ARGUMENT rather than restoring the old camera is deliberate: a fold or a relayout
           * between the two clicks would make saved coordinates point at nothing, and "back to
           * the argument" is the thing the reader actually means.
           */
          g.style.cursor = "pointer";
          g.addEventListener("click", ev => {
            const target = lastVis.nodes.find(x => x.label === r.refLabel);
            if (!target) return;
            ev.stopPropagation();
            excursion = { id: n.id, label: n.label };
            showReturn();
            setLit([target.id]);
            centreOn([target.id]);
          });
        }
        g.appendChild(rowTip);
        const num = el("text", { class: "alm-pcs-num", x: x0, y: py + rowSize,
                                 "font-size": rowSize });
        num.textContent = "(" + r.n + ")";
        g.appendChild(num);
        let rowCut = false;
        for (const l of r.lines) {
          const t = el("text", { class: "alm-pcs-text", x: x0 + PCS_NUM_W, y: py + rowSize,
                                 "font-size": rowSize });
          t.textContent = open ? l : fitLabel(l, x1 - x0 - PCS_NUM_W, rowSize, "400");
          if (t.textContent !== l) rowCut = true;
          g.appendChild(t);
          py += rowLh;
        }
        rowTip.textContent = [rowCut ? rowFull : "", refNote].filter(Boolean).join("\n\n");
        if (!rowTip.textContent) rowTip.remove();
        box.appendChild(g);
      }

      /* EXPLODE. A four-step structure asks the reader to hold four numbered cross-references in
       * their head at once; drawn as a staircase -- one small argument per step, each
       * intermediate conclusion a box between them -- it can simply be followed. That is the
       * form this program exists to give people who do not read numbered premises fluently.
       *
       * IT OPENS A PANEL RATHER THAN REDRAWING THE MAP. Exploding in place would need a
       * per-argument state living beside the fold state, encoded in the `ipsfold1` string,
       * surviving relayout, and a camera rule for a region that doubles in width. A panel needs
       * none of that -- and, free of the map's density budget, it can carry what the map has to
       * leave out: every line in full, the rule unabbreviated, the verdict and its countermodel.
       *
       * `⊞` and not `+`: the map already uses `+3` for "three hidden claims here", and this
       * hides nothing -- the same claims are drawn another way.
       */
      const steps = s.pcs.filter(r => r.bar).length;
      if (steps > 1 && opt.onExplode) {
        const w = 26, h = 13, bx = s.width - opt.padX - w, by = s.height - h - 5;
        const ex = el("g", { class: "alm-explode" });
        ex.append(el("rect", { x: bx, y: by, width: w, height: h, rx: 6.5 }),
                  el("text", { x: bx + w / 2, y: by + 9.5, "text-anchor": "middle",
                               "font-size": 9 }));
        ex.querySelector("text").textContent = "\u229e " + steps;
        const et = el("title");
        et.textContent = "Show these " + steps + " steps as separate arguments";
        ex.appendChild(et);
        ex.addEventListener("click", ev => { ev.stopPropagation(); opt.onExplode(n, ev); });
        box.appendChild(ex);
      }
    }

    // "show more / show less" for the claim text itself, at the foot of the text block.
    if (s.expandable) {
      const open = allText || textOpen.has(n.id);
      const ty = opt.padY + s.title.lines.length * (opt.titleSize + 4) +
                 s.body.lines.length * (opt.fontSize + 4) + (s.pcsHeight || 0) + 7;
      const more = el("g", { class: "alm-more" });
      const label = el("text", { x: s.width / 2, y: ty, "text-anchor": "middle", "font-size": 9 });
      label.textContent = open ? "▲ less" : "▼ more";
      more.append(el("rect", { x: s.width / 2 - 26, y: ty - 9, width: 52, height: 12,
                               rx: 6, ry: 6, fill: "transparent" }), label);
      // Showing a claim's full text re-lays the map exactly as a fold does, so it is held still
      // for the same reason — on the box's TOP edge, where its title is, since the text it is
      // about to grow runs downwards from there.
      more.addEventListener("click", ev => {
        ev.stopPropagation(); holdStill([n.id], "top"); toggleText(n.id);
      });
      box.appendChild(more);
    }

    /* MARGINALIA, drawn as folded corners — ONE PER HAND, AND ON OPPOSITE SIDES.
     *
     * A note is about a claim but is not a claim, so it must not be a box on the map: a tutor's
     * "try reading Anscombe on this" rendered as a node would say the essay contains that move,
     * which is the one thing a reconstruction must never do. A corner is visibly attached and
     * visibly not part of the argument.
     *
     * WHY TWO CORNERS RATHER THAN ONE. The two hands do different work — the RECONSTRUCTOR's own
     * aside about why a claim was read that way, and someone else's COMMENT on the reading — and
     * a single mark could only ever show one of them. A claim carrying both showed the comment's
     * colour and hid the note behind a tooltip, so the reader had no way to see, at a glance,
     * which claims the tutor had written on. Note goes LEFT, comment goes RIGHT, and a claim with
     * both is marked on both sides.
     *
     * The fold follows the box's own corner radius rather than cutting across it, because at this
     * size a square tip visibly overhangs the rounded corner.
     */
    const markSide = (kind, text, onLeft) => {
      const w = s.width, k = 18, rx = 7;
      const g = el("g", { class: "alm-margin is-" + kind });
      g.append(el("path", { class: "alm-margin-fold",
        d: onLeft ? `M${k},0 L${rx},0 A${rx},${rx} 0 0 0 0,${rx} L0,${k} Z`
                  : `M${w - k},0 L${w - rx},0 A${rx},${rx} 0 0 1 ${w},${rx} L${w},${k} Z` }));
      // A HIT AREA LARGER THAN THE MARK. On a map zoomed out to show a whole reconstruction the
      // fold is a few real pixels across, and the thing you are trying to click is the smallest
      // thing on screen. This is invisible and roughly twice the size.
      g.append(el("rect", { class: "alm-margin-hit", x: onLeft ? 0 : w - k - 8, y: 0,
                            width: k + 8, height: k + 8, fill: "transparent" }));
      const t = el("title");
      t.textContent = (kind === "note" ? "RECONSTRUCTOR\u2019S NOTE — " : "COMMENT — ") + text;
      g.appendChild(t);
      if (opt.onMargin)
        g.addEventListener("click", ev => { ev.stopPropagation(); opt.onMargin(n); });
      box.appendChild(g);
    };
    if (n.note) markSide("note", n.note, true);
    if (n.comment) markSide("comment", n.comment, false);

    if (n.expandable) {
      const badge = el("g", { class: "alm-toggle" });
      const cy = s.height;
      const hidden = n.hidden > 0;
      const t = el("text", { x: s.width / 2, y: cy + 3.5, "text-anchor": "middle",
                             "font-size": 10 });
      t.textContent = hidden ? "+" + n.hidden : "−";
      // A HIT AREA LARGER THAN THE BADGE, and larger BY A FIXED NUMBER OF SCREEN PIXELS.
      //
      // The badge is 18 units across, so on a reconstruction fitted whole — the 127-claim map
      // this was reported on sits at the 0.5 zoom floor — it is a 9-pixel target, and a reader
      // trying to fold an isolated claim gets the pointer only when they are exactly on it.
      // Simply drawing a bigger circle does not fix that: it is in graph units, so it shrinks
      // with everything else and the target is still 9 pixels at the zoom where it matters.
      //
      // The reach therefore comes from a transparent stroke with `vector-effect:non-scaling-
      // stroke`, which is measured in screen pixels whatever the zoom: 8px of extra radius at
      // every scale. Half of the badge already hangs below the box, so half of the added reach
      // is over empty canvas; the half that is over the box costs the bottom-centre of the claim
      // its select-click, which is the corner a reader aiming at this control aims through
      // anyway. Drawn FIRST so the visible circle keeps its own hover and colour rules.
      badge.append(el("circle", { class: "alm-toggle-hit", cx: s.width / 2, cy, r: 9 }),
                   el("circle", { cx: s.width / 2, cy, r: 9 }), t);
      const one = n.hidden === 1;
      const what = n.kind === "group" ? (one ? "claim in this group" : "claims in this group")
                                      : (one ? "reason for or against this"
                                             : "reasons for and against this");
      const tip = el("title");
      tip.textContent = hidden ? `Show ${n.hidden} ${what}`
                               : `Hide the ${n.kind === "group" ? "claims in this group"
                                                                : "reasons for and against this"}`;
      badge.appendChild(tip);
      badge.classList.add(hidden ? "is-closed" : "is-open");
      // A BUTTON THAT ONLY A MOUSE CAN PRESS IS NOT A BUTTON. The badge is the fold control, and
      // it was reachable by pointer alone -- which put the whole of folding out of reach of
      // anyone working by keyboard, in a program whose subject is careful reading.
      badge.setAttribute("tabindex", "0");
      badge.setAttribute("role", "button");
      badge.setAttribute("aria-expanded", hidden ? "false" : "true");
      badge.setAttribute("aria-label", tip.textContent);
      badge.addEventListener("keydown", ev => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        badge.dispatchEvent(new MouseEvent("click", { bubbles: false }));
      });
      badge.addEventListener("click", ev => {
        setLit(marksFor(n));
        ev.stopPropagation();
        // KEEP THIS BADGE WHERE IT IS. Opening a section's block replaces the block with the
        // section's own box, so that box is named as the stand-in; a claim's badge survives its
        // own fold and needs none. A band's block and its band share an id, so one name covers
        // both ends there.
        //
        // A SECTION HOLDS ITS TOP, AND HOLDS IT WHERE THE READER PRESSED. Opening a block turns
        // it into a band that may be a thousand pixels tall, and the default here -- hold the
        // bottom, hold the node's centre -- then pushed the band's header clean off the top of
        // the pane: measured on Miller, opening "By what standard" from a depth-2 state put the
        // header at y = -231 and slid the map 314px sideways and 288px up. The top edge is what
        // the reader is looking at in both directions, and their pointer is on it.
        if (n.kind === "group")
          holdStillAt([n.id, n.groupId || n.id], "top", ev);
        else
          holdStill([n.id]);
        // A folded band carries no groupId — its own id IS the handle (`lane:ch:2|3. Method`),
        // and reduceFold routes on the prefix.
        if (n.kind === "group") toggleGroup(n.groupId || n.id);
        else toggleNode(n.id);
      });
      box.appendChild(badge);
    }
    // SHIFT-CLICK, OR RIGHT-CLICK, ASKS WHERE THIS CLAIM CAME FROM. Two gestures for one thing
    // because neither is guessable on its own: shift-click is the convention but invisible, and
    // right-click is where a reader looks for "what else can I do with this". A plain click is
    // left alone — it is the fold control, and the most-used gesture must not acquire a
    // modifier's worth of ambiguity.
    // A SHIFT-CLICK MUST NOT START A SELECTION. Shift-clicking is the browser's own
    // extend-the-selection gesture, so using it as a shortcut painted the whole map blue on the
    // way to doing the useful thing. Cancelling the mousedown stops the selection before it
    // starts; the click still arrives.
    // EVERY GESTURE ON A CLAIM HAD A KEY EXCEPT BY POINTER. Selecting a claim, and asking which
    // passage it came from, were shift-click and right-click and nothing else -- so the two
    // things this program is FOR were mouse-only. The claim is a button now, with its label read
    // from the claim's own text, and the same two actions on Enter and Shift-Enter.
    box.setAttribute("tabindex", "0");
    box.setAttribute("role", "button");
    box.setAttribute("aria-label", String(n.label || n.id));
    box.addEventListener("keydown", ev => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        setLit(marksFor(n));
        // Shift-Enter matches shift-click: go to the passage rather than merely select.
        if (ev.shiftKey && opt.onLocate) return opt.onLocate(n);
        if (opt.onSelect) opt.onSelect(n);
        return;
      }
      // The context-menu key, and its keyboard equivalent, offer the same choices right-click
      // does. Positioned on the claim itself, since there is no pointer to put it under.
      if ((ev.key === "ContextMenu" || (ev.key === "F10" && ev.shiftKey)) && opt.onMenu) {
        ev.preventDefault();
        setLit(marksFor(n));
        const r = box.getBoundingClientRect();
        opt.onMenu(n, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
                        preventDefault() {}, stopPropagation() {} });
      }
    });
    box.addEventListener("mousedown", ev => { if (ev.shiftKey) ev.preventDefault(); });
    // ANY DELIBERATE TOUCH OF A CLAIM MAKES IT THE CURRENT ONE. Marking only on "open" was the
    // first thought and reads as arbitrary: closing a claim, or asking where it came from, is
    // just as much a way of saying "this is the one I am working on".
    box.addEventListener("click", ev => {
      setLit(marksFor(n));
      if ((ev.shiftKey || ev.altKey) && opt.onLocate) { ev.stopPropagation(); return opt.onLocate(n); }
      if (opt.onSelect) opt.onSelect(n);
    });
    // Double-click does it too, for anyone who would rather not hold a key down. The two plain
    // clicks underneath it fold and unfold, which cancel out, so the claim is left as it was.
    box.addEventListener("dblclick", ev => {
      if (!opt.onLocate) return;
      ev.preventDefault(); ev.stopPropagation();
      setLit(marksFor(n));
      opt.onLocate(n);
    });
    // Right-click hands the claim to the host, which puts a menu up. Going STRAIGHT to the
    // source on right-click was the first attempt and was wrong: everywhere else a right-click
    // offers choices, and a right-click that acts is a right-click you cannot take back.
    box.addEventListener("contextmenu", ev => {
      if (!opt.onMenu) return;
      ev.preventDefault(); ev.stopPropagation();
      setLit(marksFor(n));
      opt.onMenu(n, ev);
    });
  }


  function drawEdges(g, vis, sizes) {
    const keep = new Set();
    const geometry = edgeGeometry(g, vis, sizes);
    // Every drawn box, once, so the hidden-span test does not rebuild them per edge.
    const allBoxes = boxesOf(g, vis);
    const joins = planJoins(g, vis, geometry, allBoxes);
    for (const e of g.edges()) {
      const key = e.v + " " + e.w + " " + e.name;
      keep.add(key);
      const pts = geometry.get(key);
      if (!pts || pts.length < 2) continue;
      let path = drawnEdge.get(key);
      const fresh = !path;
      if (fresh) {
        path = el("path", { class: "alm-e" });
        gEdges.appendChild(path);
        drawnEdge.set(key, path);
      }
      const rel = REL[e.name] || REL.support;
      // A SLALOM IS RELAID BEFORE IT IS DRAWN. Members are exempt -- planJoins already relays
      // the ones whose feet moved -- and so is travel that is mostly sideways, where the flank
      // rebuild's left-or-right elbow has no meaning. Rebuilt in place: this array is the one
      // the geometry map holds, and everything below (the number, the hidden spans) reads it.
      if (!joins.member.has(key) && pts.length > 2 && slalomFlips(pts) >= 2) {
        const a = pts[0], z = pts[pts.length - 1];
        if (Math.abs(z.y - a.y) > Math.abs(z.x - a.x)) {
          const r = retargetTail(pts, z, allBoxes, new Set([e.v, e.w]));
          if (r) pts.splice(0, pts.length, ...r);
        }
      }
      path.setAttribute("d", smooth(pts));
      path.setAttribute("stroke", rel.color);
      if (rel.dash) path.setAttribute("stroke-dasharray", rel.dash);
      // A member of a junction stops at the bar and loses its arrowhead: the single arrow that
      // leaves the bar is the one that reaches the conclusion, and that is the whole claim being
      // made — these premises arrive together or not at all.
      if (joins.member.has(key)) path.removeAttribute("marker-end");
      else path.setAttribute("marker-end", `url(#alm-arrow-${e.name})`);
      // Justification debt: in the exposition view, an edge whose reason sits later in the
      // text than the claim it bears on. These are what the view exists to show, so they are
      // drawn heavier and the merely-forward edges recede. Both classes come off in the
      // ordinary map, where "backwards along the text" is not a property the layout shows.
      // Direction is marked but not scored; REACH is what gets the weight. See the CSS note.
      const info = g.edge(e);
      // A THROUGH-EDGE IS NOT THE RELATION IT LOOKS LIKE. It says "these two are connected, by a
      // route that runs through claims folded out of the view" — drawn like an ordinary edge it
      // would assert a direct relation the file does not contain, which is precisely the kind of
      // false claim about an argument this program exists to prevent. So it keeps the relation's
      // colour, which is true, and loses its solidity, which is not.
      path.classList.toggle("is-through", info.through === true);
      if (info.through === true) path.setAttribute("stroke-dasharray", "1.5 4");
      path.classList.toggle("is-anticipated", info.debt === true);
      path.classList.toggle("is-prepared", info.debt === false);
      path.classList.toggle("is-far", info.far === true);
      drawDirectionMarks(key, path, rel, info);
      drawLineNo(key, pts, rel, info, joins.member.has(key));
      drawUnder(key, pts, rel, e.v, e.w, allBoxes);
      // Paths cannot be CSS-interpolated, so instead of tweening the line we re-path at once
      // and fade it back in while the nodes are still gliding. Reads as a redraw, not a jump.
      path.style.opacity = "0";
      requestAnimationFrame(() => { path.style.opacity = "1"; });
    }
    for (const [key, holder] of drawnDir) {
      if (keep.has(key)) continue;
      drawnDir.delete(key);
      holder.remove();
    }
    for (const [key, t] of drawnLineNo) {
      if (keep.has(key)) continue;
      drawnLineNo.delete(key);
      t.remove();
    }
    for (const [key, path] of drawnEdge) {
      if (keep.has(key)) continue;
      drawnEdge.delete(key);
      path.style.opacity = "0";
      setTimeout(() => path.remove(), glideDur);
    }
    for (const [key, holder] of drawnUnder) {
      if (keep.has(key)) continue;
      drawnUnder.delete(key);
      holder.remove();
    }
    drawJoins(joins);
  }

  /** The boxes drawn behind the nodes: in the ordinary map the reconstruction's own sections, in
   *  the by-position view the manuscript's files and the top-level headings inside them. Both are
   *  foldable, and in both views a box is entered by clicking it.
   *
   *  Re-appended on EVERY pass rather than only on creation, because the order of the array is
   *  now load-bearing: a file band and the section bands inside it overlap, and whichever is
   *  painted last takes the click. Appending only on creation left that order to the accident of
   *  which box the layout produced first. */
  function drawGroups(g, vis) {
    const groups = expo ? (g.expoGroups || []) : vis.groups;
    const keep = new Set();
    for (const gr of groups) {
      const p = g.node(gr.id); if (!p || !p.width) continue;
      keep.add(gr.id);
      // A band that holds other bands is clickable ONLY along the strip it writes its name in.
      // Its box spans the full width while the sections inside it are as wide as their claims,
      // so the space beside a short section is bare file band — and clicking there to reach a
      // claim would have folded the entire file. The strip is where its name is, which is also
      // where a reader who means the file will aim.
      const strip = groups.some(o => o.parent === gr.id);
      let box = drawnGroup.get(gr.id);
      if (!box) {
        // `data-id` for the same reason the claim boxes carry one: so a section's box can be
        // named from outside the renderer — by a test, and by anything that has to point at it.
        box = el("g", { class: "alm-g", "data-id": gr.id });
        // THE NAME IS BIGGER THAN THE CLAIMS IT HEADS. At 11px -- the claim-title size -- an
        // open section's name sat level with the statements inside it, and a reader scanning
        // for where they were could not pick the heading out of the crowd (reported from use,
        // tried at 1.6x and kept). 22px of strip holds it; fitLabel is told the size, or it
        // would truncate against the old one and cut the name short of the room it has.
        box.append(el("rect", { class: "alm-gbox", rx: 10, ry: 10 }),
                   el("rect", { class: "alm-ghit" }),
                   el("rect", { class: "alm-gfold" }),
                   el("text", { class: "alm-glabel", "font-size": GROUP_LABEL_SIZE,
                                "font-weight": "600" }),
                   el("g", { class: "alm-spark" }),
                   el("text", { class: "alm-gwords", "font-size": 10, "text-anchor": "end" }));
        box.appendChild(el("title"));
        // AND THE BAND KEEPS A WAY TO FOLD ITSELF, because taking the click away would
        // otherwise make a section harder to shut than it was. Right-click is the gesture that
        // offers choices rather than acting, which is the rule the claim boxes already follow.
        if (gr.fold !== false)
          box.addEventListener("contextmenu", ev => {
            if (!opt.onMenu) return;
            ev.preventDefault(); ev.stopPropagation();
            opt.onMenu({ id: gr.id, groupId: gr.id, kind: "group",
                         label: gr.label, hidden: gr.hidden }, ev);
          });
        if (gr.fold !== false)
          box.querySelector(".alm-gfold").addEventListener("click", ev => {
            ev.stopPropagation(); setLit([]);
            // The section's box is about to become a block. Hold the box's bottom edge, which is
            // where the block's own badge will land, so the control that undoes this click is
            // under the pointer that made it.
            holdStillAt([gr.id, "group:" + gr.id], "top", ev);
            toggleGroup(gr.id);
          });
        drawnGroup.set(gr.id, box);
      }
      gGroups.appendChild(box);          // painting order = array order; see the note above
      box.classList.toggle("is-fixed", gr.fold === false);
      box.classList.toggle("is-strip", strip);
      const x = p.x - p.width / 2, y = p.y - p.height / 2;
      // Select by class, not position: a <title> child was appended for the tooltip, so
      // firstChild/lastChild no longer name the rect and the text.
      const rect = box.querySelector(".alm-gbox");
      const hit  = box.querySelector(".alm-ghit");
      const label = box.querySelector(".alm-glabel");
      rect.setAttribute("width", p.width); rect.setAttribute("height", p.height);
      hit.setAttribute("width", p.width);
      hit.setAttribute("height", strip ? Math.min(22, p.height) : p.height);
      // THE HEADER IS THE FOLD CONTROL; THE BAND IS CANVAS. Folding used to be a click anywhere
      // in the band, which meant there was nowhere inside a section to start a drag -- and on a
      // map with everything open there is very little else left, so panning became a hunt for a
      // gap. The 22px strip that already carries the name and the chevron does the folding now.
      // The band-wide hit stays, because it is what a right-click has to land on, and because a
      // pointerdown on it must still reach the pan handler underneath.
      const fold = box.querySelector(".alm-gfold");
      fold.setAttribute("width", p.width);
      fold.setAttribute("height", Math.min(22, p.height));
      // HOW LONG THIS PART OF THE MANUSCRIPT IS, at the other end of the same strip. Written
      // first, because the space it takes is space the name cannot have: a name truncated to
      // make room reads as a long name, whereas a count overlapping a name reads as a fault.
      // Dropped entirely on a band too narrow to hold both — it is still on the tooltip.
      const words = box.querySelector(".alm-gwords");
      const wtext = gr.words ? gr.words.toLocaleString() + " words" : "";
      const wroom = wtext ? textWidth(wtext, 10, 400) + 14 : 0;
      // WHAT THE NAME ACTUALLY NEEDS, measured rather than assumed. The old rule kept a 60px
      // floor for the name and gave the rest away, which truncated "What the court did not
      // decide" to make room for a word count nobody had asked for. The extras yield instead.
      const nameText = gr.label + (gr.fold === false ? "" : "  \u25be");
      const nameRoom = textWidth(nameText, GROUP_LABEL_SIZE, "600") + 12;
      const showWords = !!wtext && p.width - 20 - wroom >= nameRoom;
      words.textContent = showWords ? wtext : "";
      // Baselines chosen so the big name and the small count sit on one optical line.
      words.setAttribute("x", p.width - 10); words.setAttribute("y", 17);
      label.setAttribute("x", 10); label.setAttribute("y", 20);

      // THE BAND'S SHAPE, between its name and its word count. Above the line is support that
      // arrives after the claim it holds up; below is support already given. Dropped, like the
      // word count, on a band too narrow to hold it — and dropped when the band has nothing to
      // say, which `sparkPaths` reports by returning null rather than a flat line.
      const spark = box.querySelector(".alm-spark");
      spark.textContent = "";
      const sroom = gr.spark ? gr.spark.width + 16 : 0;
      const showSpark = !!gr.spark &&
                        p.width - 20 - (showWords ? wroom : 0) - sroom >= nameRoom;
      if (showSpark) {
        const sx = p.width - 10 - (showWords ? wroom : 0) - gr.spark.width;
        spark.setAttribute("transform", `translate(${sx},${(22 - gr.spark.height) / 2})`);
        spark.appendChild(el("line", { class: "alm-spark-axis", x1: 0, y1: gr.spark.mid,
                                       x2: gr.spark.width, y2: gr.spark.mid }));
        spark.appendChild(el("polygon", { class: "alm-spark-fill", points: gr.spark.area }));
        spark.appendChild(el("polyline", { class: "alm-spark-line", points: gr.spark.line }));
      }
      // AND IF IT STILL DOES NOT FIT, SHRINK RATHER THAN CUT. Suppressing the extras is not
      // always enough: a band is only as wide as what it holds, and "What the court did not
      // decide" is a longer name than its one claim is wide. A name cut to "What the court did
      // not d…" has stopped naming anything, whereas the same name a few points smaller still
      // reads. The floor is 11px, below which shrinking would be its own kind of illegible, and
      // only then does it truncate.
      const labelRoom = p.width - 20 - (showWords ? wroom : 0) - (showSpark ? sroom : 0);
      const natural = textWidth(nameText, GROUP_LABEL_SIZE, "600");
      // Scaled to 96% of the exact ratio: at exactly the ratio the fitted width lands on the
      // boundary, and fitLabel rounds against it and cuts the last letter anyway -- which is how
      // "…did not decide" first came back as "…did not decid…" after being shrunk to fit it.
      const labelSize = natural > labelRoom && natural > 0
        ? Math.max(11, GROUP_LABEL_SIZE * (labelRoom / natural) * 0.96)
        : GROUP_LABEL_SIZE;
      label.setAttribute("font-size", labelSize);
      label.textContent = fitLabel(nameText, labelRoom, labelSize);
      /* THE SAME RULE AS EVERY OTHER TOOLTIP: say what the band could not. The name went on
       * hover unconditionally, which on the great majority of bands -- the ones wide enough for
       * their own name -- was the header repeating itself to anyone who paused over it.
       *
       * The word count is the half that was actually going missing. The comment above says it
       * is "still on the tooltip" when a narrow band drops it, and it was not: the tooltip held
       * the name alone, so on exactly the bands where the count could not be drawn there was
       * nowhere left to read it. */
      const gbits = [];
      if (label.textContent !== nameText) gbits.push(gr.title || gr.label);
      if (wtext && !showWords) gbits.push(wtext);
      box.querySelector("title").textContent = gbits.join(" — ");
      box.style.transform = `translate(${x}px,${y}px)`;      // style, not attribute: see above
    }
    for (const [id, box] of drawnGroup) {
      if (keep.has(id)) continue;
      drawnGroup.delete(id);
      box.style.opacity = "0";
      setTimeout(() => box.remove(), glideDur);
    }
  }

  /** Mark, or unmark, the claims being talked about — WITHOUT re-laying the map out.
   *
   *  The marks are a class on boxes that are already drawn, so repainting them is a walk over
   *  the drawn set. Going through `render` instead would re-filter, re-measure and re-position
   *  the whole map to change a stroke colour, and on a book that is a visible stutter every time
   *  a claim is clicked. `drawNodes` sets the same class from the same set, so a full render
   *  arrives at the same picture; this is the cheap path, not a second rule.
   */
  /** What to mark when the reader touches `n`.
   *
   *  A claim marks itself. A FOLDED BLOCK marks the claims it stands for, because the block is
   *  about to stop existing: clicking its badge opens it, and a mark on the block would vanish
   *  with it — leaving the reader having just opened something and nothing showing what. Marking
   *  the members survives the fold in both directions, since a block counts as marked when any
   *  of its members is.
   */
  const marksFor = n => (n.members && n.members.length ? n.members.slice() : [n.id]);

  function applyLit() {
    const byId = new Map(lastVis.nodes.map(n => [n.id, n]));
    for (const [id, box] of drawn) {
      const n = byId.get(id);
      box.classList.toggle("is-lit",
        lit.has(id) || !!(n && (n.members || []).some(m => lit.has(m))));
    }
  }
  function setLit(ids) { lit = new Set(ids || []); applyLit(); }

  /** Work out which edges belong to a linked inference step, and where each bar goes.
   *
   *  Only steps with TWO OR MORE edges on screen get a bar. A step whose other premise is an
   *  intermediate conclusion — internal to the argument and not drawn — arrives as a single
   *  line, and a bar gathering one line would claim a linkage the reader cannot see. Seven of
   *  the twenty-five steps in the reference maps are like that; they keep an ordinary arrow.
   *
   *  Mutates the geometry: each member's last point is moved back to the bar, which is what
   *  makes the lines meet rather than merely pass close to one another.
   */
  function planJoins(g, vis, geometry, allBoxes) {
    const member = new Set(), bars = new Map();
    const groups = new Map();
    for (const e of g.edges()) {
      const info = g.edge(e);
      const step = info && info.step;
      if (step == null) continue;
      const pts = geometry.get(e.v + " " + e.w + " " + e.name);
      if (!pts || pts.length < 2) continue;
      const k = e.w + "|" + step;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ key: e.v + " " + e.w + " " + e.name, pts, name: e.name,
                           from: e.v, rule: (info && info.rule) || null,
                           validity: (info && info.validity) || null,
                           countermodel: (info && info.countermodel) || null,
                           line: info && info.line != null ? info.line : null });
    }
    for (const [k, list] of groups) {
      if (list.length < 2) continue;
      const id = k.slice(0, k.lastIndexOf("|"));
      const target = g.node(id);
      const node = vis.nodes.find(n => n.id === id);
      // 13 is the badge's radius plus a little; see the note in junctionGeometry.
      const geo = junctionGeometry(target, list.map(m => m.pts[m.pts.length - 1]), 20,
                                   node && node.expandable ? 13 : 0);
      if (!geo) continue;
      // Each member finishes on the bar rather than at the junction point; see `junctionFeet`.
      // Only the last few units of the edge change -- the long run stays whatever dagre routed.
      const feet = junctionFeet(geo, list.map(m => m.pts[m.pts.length - 1]), null,
                                list.map(m => m.line));
      // WHERE EACH MEMBER LANDS, WITH THE LINE IT IS. The box lists the structure by number and
      // the members arrive as anonymous lines; the number at each foot is what lets a reader
      // stand at the bar and read off which arrival is which row. Collected here because the
      // foot is decided here, and drawn in drawJoins with the bar it belongs to.
      const arrivals = [];
      list.forEach((m, i) => {
        member.add(m.key);
        const f = feet[i];
        const land = f ? f.land : geo.j;
        if (m.line != null) arrivals.push({ x: land.x, y: land.y, line: m.line });
        // A FOOT FAR FROM WHERE THE ROUTE WAS HEADING invalidates the route's dodges -- see
        // retargetTail. Rebuilt in place, because this array is the one the geometry map holds
        // and the one the edge is drawn from. Vertical junctions only: the rebuild dodges by
        // x-shift, which on a side-face junction would shove the line along its own length.
        if (f && geo.out.y !== 0) {
          const old = m.pts[m.pts.length - 1];
          if (Math.hypot(old.x - f.land.x, old.y - f.land.y) > 15) {
            const r = retargetTail(m.pts, f.land, allBoxes, new Set([m.from, id]));
            if (r) m.pts.splice(0, m.pts.length, ...r);
          }
        }
        if (!f) { m.pts[m.pts.length - 1] = geo.j; return; }
        // ONLY WHERE THERE IS ROOM FOR THE STUB. A premise sitting directly under its argument
        // has a short, near-vertical route whose second-to-last point is already inside the
        // twelve units the stub wants, so turning out to `lift` and back to `land` drew a hook
        // -- the line went DOWN away from the bar and then up onto it. Visible at 7x on
        // `pcs-supported-premise` as a small tick beside the arrow stem.
        //
        // Such an edge needs no help in any case: it is arriving perpendicular already, which is
        // the whole point of the stub. So the stub is added where the approach is shallow enough
        // to need it and skipped where it is not.
        const prev = m.pts[m.pts.length - 2];
        const room = prev ? (prev.x - f.land.x) * geo.out.x + (prev.y - f.land.y) * geo.out.y
                          : Infinity;
        if (room >= 14) { m.pts[m.pts.length - 1] = f.lift; m.pts.push(f.land); }
        else m.pts[m.pts.length - 1] = f.land;
      });
      /* THE RULE IS NAMED ONCE, ON WHICHEVER BAR ACTUALLY STANDS FOR THE STEP.
       *
       * A step can end up drawn in two places at once, and the first version named it in both.
       * Where a step's premises are titled they get boxes and arrive here as a junction; where
       * its CONCLUSION is untitled it has no box, so the argument draws the conclusion inside
       * itself with an inference bar above it. The observatory fixture is exactly that shape,
       * and "Modus ponens" appeared twice ten pixels apart -- which reads as two inferences
       * rather than as one seen from two sides.
       *
       * So the junction yields to the box. The bar above the conclusion is the better place: it
       * has the conclusion under it, which is what a rule licenses, whereas the junction only
       * has the premises going in.
       */
      const step = Number(k.slice(k.lastIndexOf("|") + 1));
      // `!l.drawn` used to gate this, when a drawn conclusion had no row. pcsRows now draws
      // every conclusion -- a titled one as a reference -- so the box always has the bar, and
      // the junction always yields to it when the step's conclusion line exists at all.
      const inBox = node && Array.isArray(node.pcs) && node.pcs.some(l =>
        l && l.step === step &&
        (l.role === "main-conclusion" || l.role === "intermediary-conclusion"));
      const named = inBox ? null : list.find(m => m.rule);
      // The enclosure round this step's premises. `others` deliberately includes the ARGUMENT
      // itself: a hull that reached up over its own conclusion would read as the conclusion
      // being one of its premises, which is the shape of circularity.
      const mine = new Set(list.map(m => m.from));
      const hull = premiseHull(list.map(m => g.node(m.from)),
                               (allBoxes || []).filter(b => !mine.has(b.id)));
      // THE COUNT IS THE STEP'S, NOT THE FAN'S. An untitled premise has no box and no arrow,
      // so it never reaches this junction -- it is a row inside the argument. A bar announcing
      // "4 premises" over a step that uses five is the map miscounting its own argument;
      // `inside` is how many of the step's premises sit in the box, so the tooltip can say
      // where the missing arrivals are.
      const inside = node && Array.isArray(node.pcs)
        ? node.pcs.filter(l => l && l.role === "premise" && l.step === step && !l.drawn).length
        : 0;
      bars.set(k, { geo, name: list[0].name, count: list.length + inside, inside, hull,
                    arrivals, rule: named ? named.rule : null,
                    validity: named ? named.validity : null,
                    countermodel: named ? named.countermodel : null });
    }
    return { member, bars };
  }

  function drawJoins(joins) {
    for (const [k, holder] of drawnJoin) {
      if (joins.bars.has(k)) continue;
      drawnJoin.delete(k); holder.remove();
    }
    // An enclosure goes when its step does, and also when the step survives but the enclosure
    // has become impossible -- a fold can move a stranger into the middle of it.
    for (const [k, r] of drawnHull) {
      const info = joins.bars.get(k);
      if (info && info.hull) continue;
      drawnHull.delete(k); r.remove();
    }
    for (const [k, info] of joins.bars) {
      if (!info.hull) continue;
      let r = drawnHull.get(k);
      if (!r) {
        r = el("rect", { class: "alm-hull", rx: 10, ry: 10 });
        r.appendChild(el("title"));
        gHulls.appendChild(r);
        drawnHull.set(k, r);
      }
      r.setAttribute("x", info.hull.x);
      r.setAttribute("y", info.hull.y);
      r.setAttribute("width", info.hull.width);
      r.setAttribute("height", info.hull.height);
      const t = r.querySelector("title");
      if (t) t.textContent = info.count + " premises of one inference step" +
                             (info.inside ? " (" + info.inside + " of them written inside the " +
                                            "argument's box)" : "") +
                             (info.rule ? " — " + info.rule : "");
    }
    for (const [k, info] of joins.bars) {
      let holder = drawnJoin.get(k);
      if (!holder) {
        holder = el("g", { class: "alm-join" });
        holder.append(el("path", { class: "alm-join-stem" }),
                      el("path", { class: "alm-join-bar" }),
                      el("title"));
        gEdges.appendChild(holder);
        drawnJoin.set(k, holder);
      }
      const { j, tip, bar } = info.geo;
      const rel = REL[info.name] || REL.support;
      const stem = holder.querySelector(".alm-join-stem");
      stem.setAttribute("d", `M${j.x},${j.y}L${tip.x},${tip.y}`);
      stem.setAttribute("stroke", rel.color);
      stem.setAttribute("marker-end", `url(#alm-arrow-${info.name})`);
      const line = holder.querySelector(".alm-join-bar");
      line.setAttribute("d", `M${bar[0].x},${bar[0].y}L${bar[1].x},${bar[1].y}`);
      line.setAttribute("stroke", rel.color);
      /* THE RULE THE FILE NAMED, on the bar that is the step. `inference.inferenceRules` was
       * parsed and read by nothing at all -- two rules named in Argdown's own `censorship`
       * sample, one in `welcome to argdown`, and every one of them invisible.
       *
       * Set BESIDE the bar rather than along it. Text on the bar has to rotate with it, and a
       * bar that runs vertically -- which is most of them, since dagre lays the map out
       * bottom-to-top -- then carries a rule name turned on its side. Horizontal beside the end
       * of the bar reads at any angle the bar takes, which is the same reason the junction's own
       * geometry works in axis-aligned normals rather than in the raw direction.
       */
      let rt = holder.querySelector(".alm-join-rule");
      if (info.rule) {
        if (!rt) { rt = el("text", { class: "alm-join-rule", "font-size": 9 }); holder.appendChild(rt); }
        // PAST THE END OF THE BAR AND ON THE BOX'S SIDE OF IT. Sitting level with the bar, the
        // label lay across the member arriving at that end and across its direction chevron --
        // three marks in one place. The far end is where the bar stops and the box has not yet
        // begun, and `-out` is the only direction from there with nothing else in it.
        const { out, half } = info.geo;
        const far = bar[0].x >= bar[1].x ? bar[0] : bar[1];
        // The way out along the bar, taken from the bar itself rather than from `dir` -- `dir`
        // may point either way round and guessing its sign from x put the label back on top of
        // the members on a vertical bar.
        const ux = half > 0 ? (far.x - j.x) / half : 1;
        const uy = half > 0 ? (far.y - j.y) / half : 0;
        rt.setAttribute("x", far.x + ux * 5 - out.x * 6);
        rt.setAttribute("y", far.y + uy * 5 - out.y * 6 + 3);
        const anchorEnd = (Math.sign(far.x - j.x) || 1) < 0;
        rt.setAttribute("text-anchor", anchorEnd ? "end" : "start");
        rt.setAttribute("fill", rel.color);
        rt.textContent = shortRule(info.rule);
        let rtip = rt.querySelector("title");
        if (!rtip) { rtip = el("title"); rt.appendChild(rtip); }
        rtip.textContent = info.rule;

        /* WHAT THE NAME'S CLAIM CAME TO -- and only one of the four states is loud.
         *
         * A rule name asserts the conclusion FOLLOWS. Three things can be true of that
         * assertion and a fourth is the absence of it:
         *   valid          decided, and it holds. The quietest possible positive mark.
         *   invalid        decided, and it does not. The one state worth interrupting for.
         *   unformalized   claimed, with nothing to check it against.
         *   (no rule)      no claim made, so no mark at all -- every map today.
         *
         * The valid state is deliberately almost nothing. `#core` was removed from this
         * project for marking 27%-65% of claims and thereby meaning nothing; if every sound
         * step wore a tick, the ticks would be the noise and the one broken step would be
         * harder to find rather than easier. Mark the exception.
         */
        const shift = info.validity === "invalid" ? 13 : 0;
        rt.setAttribute("x", Number(rt.getAttribute("x")) + (anchorEnd ? -shift : shift));

        let vb = holder.querySelector(".alm-verdict");
        if (info.validity === "invalid") {
          if (!vb) {
            vb = el("g", { class: "alm-verdict" });
            vb.append(el("circle", { r: 6.5 }), el("text", { "text-anchor": "middle",
                                                             "font-size": 9, dy: 3.2 }));
            vb.appendChild(el("title"));
            holder.appendChild(vb);
            // THE COUNTERMODEL NEEDS SOMEWHERE TO LIVE. It is the most useful thing the check
            // produces -- the concrete way the premises hold while the conclusion fails -- and
            // it is far too big for a bar. A click target is where it belongs.
            vb.addEventListener("click", ev => {
              ev.stopPropagation();
              const open = holder.classList.toggle("alm-v-open");
              const d = holder.querySelector(".alm-verdict-detail");
              if (d) d.style.display = open ? "" : "none";
            });
          }
          const bx = Number(rt.getAttribute("x")) + (anchorEnd ? 7 : -7);
          const by = Number(rt.getAttribute("y")) - 3;
          vb.querySelector("circle").setAttribute("cx", bx);
          vb.querySelector("circle").setAttribute("cy", by);
          const vt = vb.querySelector("text");
          vt.setAttribute("x", bx); vt.setAttribute("y", by); vt.textContent = "!";
          vb.querySelector("title").textContent =
            "The conclusion does not follow from the premises, on the formalizations given. "
            + "Click for the countermodel.";

          let dt = holder.querySelector(".alm-verdict-detail");
          if (!dt) {
            dt = el("text", { class: "alm-verdict-detail", "font-size": 8.5 });
            dt.style.display = "none";
            holder.appendChild(dt);
          }
          dt.setAttribute("x", rt.getAttribute("x"));
          dt.setAttribute("y", Number(rt.getAttribute("y")) + 11);
          dt.setAttribute("text-anchor", anchorEnd ? "end" : "start");
          dt.textContent = info.countermodel
            ? Object.keys(info.countermodel).map(k =>
                k + " = " + JSON.stringify(info.countermodel[k])).join(", ")
            : "";
        } else if (vb) {
          vb.remove();
          const d = holder.querySelector(".alm-verdict-detail");
          if (d) d.remove();
        }
      } else if (rt) rt.remove();
      // The state rides on the holder so one CSS rule can style the name, and so a map can be
      // asked how many of its named steps hold up without re-deciding any of them.
      holder.setAttribute("class", "alm-join" + (info.validity ? " alm-v-" + info.validity : "")
                          + (holder.classList.contains("alm-v-open") ? " alm-v-open" : ""));
      /* THE LINE NUMBER AT EACH FOOT. The box lists the structure as numbered rows and the
       * members arrive as anonymous lines; this is the pairing, written where the pairing
       * happens. Placed on the far side of the bar from the box (`out` points that way), and
       * nudged along the bar so the digit sits beside the arriving line rather than on it.
       * Rebuilt each pass because the membership of a junction changes as folds do.
       */
      for (const old of holder.querySelectorAll(".alm-join-no")) old.remove();
      const { out: jOut, dir: jDir } = info.geo;
      for (const a of info.arrivals || []) {
        const nt = el("text", { class: "alm-join-no", "font-size": 8,
                                x: a.x + jOut.x * 9 + jDir.x * 5,
                                y: a.y + jOut.y * 9 + jDir.y * 5 + 2.5,
                                "text-anchor": "middle" });
        nt.setAttribute("fill", rel.color);
        nt.textContent = "(" + a.line + ")";
        holder.appendChild(nt);
      }
      holder.querySelector("title").textContent =
        info.count + " premises of one inference step — linked, so all of them are needed" +
        (info.inside ? "\n\n" + info.inside + " of them " +
                       (info.inside === 1 ? "has" : "have") + " no box of " +
                       (info.inside === 1 ? "its" : "their") + " own and " +
                       (info.inside === 1 ? "is" : "are") +
                       " written inside the argument's box instead" : "");
      // NOT the rule. It is drawn beside this very bar, and the label carries the unabbreviated
      // name on its own hover -- which is where a reader who wants to know what `HS` stands for
      // will already be pointing.
    }
  }

  /** The line number an edge is, written at the argument's end of it.
   *
   *  AN EDGE THAT EMBODIES A LINE OF A STRUCTURE SAYS WHICH. The argument's box lists its whole
   *  premise-conclusion structure as numbered rows, boxed claims included (as bracketed
   *  references); the arrows to and from those boxes are those same lines, and without the
   *  number the reader pairs arrow with row by matching titles across the map -- the work the
   *  numbering exists to spare. A premise's number sits at its ARRIVAL, a conclusion's at its
   *  DEPARTURE: both are the argument's end of the line, which is where the box with the
   *  matching row is.
   *
   *  Members of a junction are excluded here because their number is drawn at their foot on the
   *  bar (see drawJoins), where the arrival actually happens; and a through-edge never carries
   *  a number at all, because it is not the relation it looks like.
   */
  function drawLineNo(key, pts, rel, info, isMember) {
    const want = info && info.line != null && !isMember && info.through !== true &&
                 pts && pts.length >= 2;
    let t = drawnLineNo.get(key);
    if (!want) { if (t) { drawnLineNo.delete(key); t.remove(); } return; }
    if (!t) {
      t = el("text", { class: "alm-line-no", "font-size": 8, "text-anchor": "middle" });
      gEdges.appendChild(t);
      drawnLineNo.set(key, t);
    }
    // `step` is only ever set on edges INTO an argument, so it is what tells an arriving
    // premise from a departing conclusion.
    const arriving = info.step != null;
    const p = arriving ? pts[pts.length - 1] : pts[0];
    const q = arriving ? pts[pts.length - 2] : pts[1];
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;         // along the edge, away from the box
    t.setAttribute("x", p.x + ux * 14 - uy * 6);
    t.setAttribute("y", p.y + uy * 14 + ux * 6 + 2.5);
    t.setAttribute("fill", rel.color);
    t.textContent = "(" + info.line + ")";
  }

  /** Draw the stretches of an edge that disappear behind a node, DASHED and over the top.
   *
   *  The hidden-line convention: a line that continues behind something is drawn, and drawn
   *  broken. Without it a line re-emerging at a box's edge is indistinguishable from a line that
   *  starts there, and the reader sees a relation between two claims that have none — the more
   *  so in the by-position view, where the layout is the text's order and long near-vertical
   *  lines cross whatever the text happens to have put in between.
   *
   *  Faint and hairline on purpose. It has to cross the claim's own words, and the job is to
   *  carry the eye from one side to the other, not to be read.
   */
  function drawUnder(key, pts, rel, from, to, boxes) {
    let holder = drawnUnder.get(key);
    const others = boxes.filter(b => b.id !== from && b.id !== to);
    const spans = others.length
      ? hiddenSpans(drawnPolyline(pts, 28), others, 10) : [];
    if (!spans.length) { if (holder) { holder.remove(); drawnUnder.delete(key); } return; }
    if (!holder) {
      holder = el("g", { class: "alm-under" });
      gUnder.appendChild(holder);
      drawnUnder.set(key, holder);
    }
    holder.textContent = "";
    for (const run of spans) {
      holder.appendChild(el("path", {
        class: "alm-underline",
        d: run.map((p, i) => (i ? "L" : "M") + p.x + "," + p.y).join(""),
        stroke: rel.color
      }));
    }
  }

  /** Repeat the arrowhead along a long edge, as open chevrons.
   *
   *  Positions come off the RENDERED path, not off the polyline the layout returned: the drawn
   *  line is a quadratic through those points and cuts every corner, so a mark placed on the
   *  polyline sits beside the line it is meant to be on -- most visibly on the three-point bowed
   *  edges of the exposition view, where the whole middle of the line is corner. Which fractions
   *  to use is policy and lives in the pure `directionFractions`; where those fractions land is
   *  geometry, and the browser already knows.
   *
   *  Degrades to nothing without a DOM: `getTotalLength` is what the whole thing rests on, and
   *  an edge with no intermediate marks is the behaviour this file had for its first year.
   */
  function drawDirectionMarks(key, path, rel, info) {
    let holder = drawnDir.get(key);
    const drop = () => { if (holder) { holder.remove(); drawnDir.delete(key); } };
    if (typeof path.getTotalLength !== "function") return drop();
    let len = 0;
    try { len = path.getTotalLength(); } catch (_) { return drop(); }
    // A LOWER BAR IN EXPOSITION. The default threshold suits the argument arrangement, where a
    // short edge between neighbours needs no explaining. Laid out by position the same short
    // edge is exactly the one whose direction is unclear — regular columns give no clue which
    // way a line runs — so the marks start earlier there.
    const at = directionFractions(len, expo ? { one: 74, two: 260 } : null);
    if (!at.length) return drop();
    if (!holder) {
      holder = el("g", { class: "alm-dir" });
      gEdges.appendChild(holder);
      drawnDir.set(key, holder);
    }
    holder.textContent = "";
    // The heavier stroke of a far-reaching edge carries to its chevrons, so emphasis stays one
    // property of one line rather than two things that can disagree.
    holder.setAttribute("class", "alm-dir" + (info && info.far === true ? " is-far" : "") +
                        (info && info.debt === true ? " is-anticipated" : ""));
    for (const f of at) {
      const a = path.getPointAtLength(len * f);
      const b = path.getPointAtLength(Math.min(len, len * f + 1));
      const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      holder.appendChild(el("path", { d: "M-4,-3.4L0,0L-4,3.4", stroke: rel.color,
                                      transform: `translate(${a.x},${a.y}) rotate(${deg})` }));
    }
    holder.style.opacity = "0";
    requestAnimationFrame(() => { holder.style.opacity = "1"; });
  }

  function clearAll() {
    for (const m of [drawn, drawnEdge, drawnGroup, drawnDir, drawnLineNo, drawnJoin, drawnHull]) {
      for (const [, e] of m) e.remove();
      m.clear();
    }
  }

  /** Draw dagre's polyline: straight runs, corners rounded to a bounded radius.
   *
   *  WHY NOT A QUADRATIC THROUGH EVERY MIDPOINT, which is what this did before. That scheme is
   *  smooth in the mathematical sense -- it is C1 continuous -- and still looks kinked, because
   *  the radius it rounds a corner with is set by the SHORTER adjacent segment. dagre routes a
   *  multi-rank edge through dummy nodes about half a rank apart, so the first corner out of a
   *  node is turned within ~20 units while the turn itself is close to a right angle. Measured
   *  across the two real maps: the median tightest radius actually drawn was 6.9 units on the
   *  book-sized map and 4.7 on the smaller one. That is the "very acute angle" a reader sees.
   *
   *  Rounding each corner to a capped radius instead gives every corner the same generosity and
   *  leaves the runs between them straight: the same measurement goes to 15.7 and 11.0.
   *
   *  THREE-POINT PATHS ARE LEFT ALONE. The exposition view builds each edge as start, a bowed
   *  midpoint, end -- one long arc, deliberately. Rounding that to a capped radius would replace
   *  the arc with two straight lines and a small corner, which is the opposite of what it is for.
   */
  const CORNER_R = 22;
  function smooth(pts) {
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
    const last = pts[pts.length - 1];
    if (pts.length === 3) {                       // the bowed arc: quadratic through the midpoint
      const mx = (pts[1].x + pts[2].x) / 2, my = (pts[1].y + pts[2].y) / 2;
      return `M${pts[0].x},${pts[0].y}Q${pts[1].x},${pts[1].y} ${mx},${my}L${last.x},${last.y}`;
    }
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const la = Math.hypot(b.x - a.x, b.y - a.y), lc = Math.hypot(c.x - b.x, c.y - b.y);
      const t = Math.min(CORNER_R, la / 2, lc / 2);
      if (!(t > 0.5) || !la || !lc) { d += `L${b.x},${b.y}`; continue; }
      const px = b.x - (b.x - a.x) / la * t, py = b.y - (b.y - a.y) / la * t;
      const qx = b.x + (c.x - b.x) / lc * t, qy = b.y + (c.y - b.y) / lc * t;
      d += `L${px},${py}Q${b.x},${b.y} ${qx},${qy}`;
    }
    d += `L${last.x},${last.y}`;
    return d;
  }

  function marker(kind) {
    const m = el("marker", { id: "alm-arrow-" + kind, viewBox: "0 0 10 10", refX: 9, refY: 5,
                             markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
    m.appendChild(el("path", { d: "M0,0L10,5L0,10z", fill: REL[kind].color }));
    return m;
  }

  /* ------------------------------------------------------------ zoom / pan */

  function applyView() {
    // Style rather than attribute, for the reason given at the node glide above -- and it
    // matters twice here, because the camera sets a `transition` on this element and in WebKit
    // an attribute change ignored it, so every fit and zoom-to jumped.
    //
    // `transform-origin: 0 0` in the stylesheet is what makes this identical to the attribute.
    // A CSS transform on an SVG element takes its origin from the reference box and defaults to
    // the middle of it; the attribute always uses the local origin. Translation does not care,
    // but this one carries a scale, and with the default origin the map would zoom about its
    // own centre instead of the point under the pointer. Checked against the attribute in
    // WKWebView: same x, y, width and height to the pixel.
    viewport.style.transform =
      `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  }
  /** Is there still anything on screen? A fold removes nodes without moving the camera, so
   *  collapsing the root of a wide map AFTER panning leaves the one surviving node outside
   *  the viewport and the canvas simply goes blank. Re-frame in that case and only that case,
   *  so a deliberate pan survives every fold that does not strand the reader. */
  function stranded(size) {
    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 500;
    const x0 = view.x, y0 = view.y;
    const x1 = x0 + size.w * view.k, y1 = y0 + size.h * view.k;
    const overlapX = Math.min(x1, cw) - Math.max(x0, 0);
    const overlapY = Math.min(y1, ch) - Math.max(y0, 0);
    return overlapX < 40 || overlapY < 40;
  }

  /* ---------------------------------------------- keeping the clicked control still
   *
   * EVERY FOLD RE-LAYS THE WHOLE MAP. dagre is given a different set of nodes and answers with a
   * different arrangement, so the box whose badge was just pressed is somewhere else afterwards
   * — and the reader, who is looking at their pointer, has to find it again. Measured over 130
   * clicks on the 127-claim Tooming and Jakapi reconstruction, sections open, camera taken: the
   * badge moved a median of 110px and a worst of 4,665px, which is off the screen and gone. 67
   * of those 130 clicks moved it more than 100px. "Open a claim and shut it again" cost two
   * hunts across the map.
   *
   * So the camera follows: the control that was clicked is put back where it was on the screen.
   * Nothing about WHAT is drawn changes — this only writes view.x and view.y — so the fold state
   * machine and its invariants are untouched by it.
   */

  /** Where a drawn box's fold badge sits on the screen, from the LAYOUT rather than from the DOM.
   *
   *  getBoundingClientRect was the obvious way and is wrong here: boxes glide on a 350ms
   *  transition, so a rect read during one reports where the node still is and not where it is
   *  going — and "open it and quickly close it again", the case this exists for, is exactly the
   *  case where the previous glide has not finished. `lastG` holds the settled answer.
   *
   *  `edge` is which edge of the box the control sits on: the fold badge is drawn at the
   *  bottom-centre, and a section's own box has no badge at all, so its bottom-centre is what
   *  the block that replaces it is measured against. The claim-text "more" link is anchored on
   *  the TOP instead, because that is where its title is and the text grows downwards from it.
   */
  function controlPoint(id, edge) {
    const p = lastG && lastG.node(id);
    if (!p || p.x == null || p.y == null || !p.height) return null;
    // The CONTAINER's rect, not the svg's. An SVG root can report a zero-width rect while its
    // children draw perfectly well -- the single-map build does exactly that -- and the only
    // use of this origin is to agree with the on-screen check and cancel out of applyPin's
    // delta, so it must be the rect of the pane the reader is actually looking at.
    const r = container.getBoundingClientRect();
    const gy = edge === "top" ? p.y - p.height / 2 : p.y + p.height / 2;
    return { x: r.left + view.x + p.x * view.k, y: r.top + view.y + gy * view.k };
  }

  /** Remember where the control the reader just pressed is, so the next render can put it back.
   *
   *  `ids` is that control's own node first, then whatever will STAND IN for it once the fold
   *  has happened — a section's block (`group:s2`) becomes the section's box (`s2`) when it is
   *  opened, and the other way round when it is shut. The first id that resolves wins, at each
   *  end independently, so one list covers both directions.
   */
  /** As `holdStill`, but the point held is WHERE THE READER PRESSED rather than the control's
   *  own centre.
   *
   *  WHY THE DIFFERENCE MATTERS. A section's header runs the whole width of its band, so a
   *  press near one end can be hundreds of pixels from the band's centre. Holding the centre
   *  then keeps the wrong thing still: the block lands where the CENTRE was, the reader's
   *  pointer is somewhere else entirely, and the camera slides the length of the band to make
   *  it so. Measured on Miller folding "By what standard" from a depth-2 state: the block came
   *  to rest 64px from the pointer and the whole map moved 314px sideways to put it there.
   *
   *  Anchoring on the press costs nothing when the two coincide -- a badge is small, and its
   *  centre IS where you pressed -- so this is the general rule and `holdStill` is the case
   *  with no pointer to consult, such as the keyboard.
   */
  function holdStillAt(ids, edge, at) {
    holdStill(ids, edge);
    if (pin && at && typeof at.clientX === "number") { pin.x = at.clientX; pin.y = at.clientY; }
  }

  function holdStill(ids, edge) {
    pin = null;
    const r = container.getBoundingClientRect();
    // A DEGENERATE RECT MUST NOT VETO EVERY PIN. This read the svg's own rect, and an SVG root
    // can report zero width while its children draw fine -- which the single-map build does, so
    // its on-screen check failed every click, no pin was ever set, and every fold re-framed the
    // whole map: the exact hunt-for-your-badge the pin exists to prevent, shipped for however
    // long that build has had a zero-width rect. Found by the stability project's Phase 4
    // verification, which is why verification is a phase and not a hope.
    const measurable = r.right - r.left > 40 && r.bottom - r.top > 40;
    for (const id of ids) {
      const at = controlPoint(id, edge);
      if (!at) continue;
      // ONLY IF IT IS ON THE SCREEN. A pointer is by definition over the control it pressed, but
      // the keyboard is not: tab moves focus through badges whatever the camera shows, nothing
      // here scrolls to follow, and Enter on a badge off the edge of the pane would otherwise
      // pin the view to a point nobody can see — and, because a pin overrides it, skip the
      // re-framing that used to rescue exactly that case.
      if (measurable &&
          (at.x < r.left || at.x > r.right || at.y < r.top || at.y > r.bottom)) return;
      pin = { ids, edge, x: at.x, y: at.y };
      return;
    }
  }

  /* GLIDE THE CAMERA IN STEP WITH THE BOXES, not before them. The boxes take `--alm-dur` to
   * travel and the viewport transform is applied instantly, so moving the camera on its own
   * slid the whole map sideways and then let the nodes catch up — the badge was under the
   * pointer at the start and at the end and nowhere near it in between. With the same duration
   * and the same easing on both, and only the translation changing, the two interpolations
   * compose to a constant: the badge is under the pointer for every frame of the move.
   *
   * Temporary, never permanent: a transition left on the viewport makes dragging and wheel-zoom
   * feel like treacle, so it is taken off again as soon as the move is over. Written once here
   * because fitTo, centreOn, applyPin and spotlight all need exactly this and the four copies
   * had already begun to be four chances to change one and not the others.
   */
  function glide() {
    viewport.style.transition = `transform ${glideDur}ms cubic-bezier(.4,0,.2,1)`;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { viewport.style.transition = ""; }, glideDur + 40);
  }

  /** Put it back. Returns false if nothing it named survived the fold, so the caller can fall
   *  through to the ordinary re-framing rather than leave the camera nowhere. */
  function applyPin(p) {
    let now = null;
    for (const id of p.ids) { now = controlPoint(id, p.edge); if (now) break; }
    if (!now) return false;
    view.x += p.x - now.x;
    view.y += p.y - now.y;
    // The reader named a point to hold, which is a camera they chose; a later fold must not
    // undo it. Same reasoning as `centreOn`.
    userMoved = true;
    glide();
    applyView();
    return true;
  }

  function fitTo(w, h, apex) {
    // clientWidth/Height, not getBoundingClientRect: the rect is measured AFTER any CSS
    // transform, and reveal.js scales the whole slide to the window. Fitting to the scaled
    // numbers leaves the map a fraction of its proper size on a slide.
    const cw = container.clientWidth || 800;
    // The toolbar floats over the bottom of the map, so fit into what is left above it or the
    // lowest row of nodes ends up hidden behind the buttons.
    const bar = toolbar ? toolbar.offsetHeight + 14 : 0;
    const ch = Math.max(80, (container.clientHeight || 500) - bar);
    // Was that a real measurement, or the fallback? The distinction is what lets the observer
    // below know whether this framing is worth keeping.
    if (container.clientWidth > 40 && container.clientHeight > 120) framedForReal = true;
    // Floor the zoom. A book-scale map fitted whole lands around 0.4, where the strokes wash
    // out and nothing can be read — at which point "you can see all of it" is worth nothing.
    // Better to stay legible and let the reader pan, or fold a Part away.
    const f = frameFor(w, h, cw, ch, opt.minScale, apex);
    view.k = f.k; view.x = f.x; view.y = f.y;
    glide();                      // rather than cutting to the new frame
    userMoved = false;
    applyView();
  }

  /** PUBLIC: fill the frame with these nodes, and say where they ended up.
   *
   *  DIFFERENT FROM `centreOn` IN THE ONE WAY THAT MATTERS: it changes the zoom. `centreOn`
   *  deliberately does not, because it serves a reader who chose their own zoom to read at and
   *  would lose it to a search result. This serves the walkthrough, which is *pointing* — "that
   *  badge, there" is not sayable at a zoom where the badge is nine pixels across — and the
   *  walkthrough puts the reader's camera back when it is done.
   *
   *  Everything else is borrowed rather than rewritten: `reveal` unfolds whatever is hiding the
   *  targets, `frameFor` decides the scale (the same floor, the same 1.4 ceiling, so a two-claim
   *  map cannot be blown up to nonsense), and `glide` runs the move on the same curve and the
   *  same duration as every other camera move in here.
   *
   *  `opts.pad` is slack in GRAPH units around the targets, so the thing being pointed at is not
   *  jammed against the edge of the pane. `opts.topOnly` crops the target box to its first N
   *  units of height: a section band in the Exposition view is hundreds of units tall and the
   *  thing worth looking at — its name and its sparkline — is the top twenty of them.
   *
   *  Returns false when nothing named is drawn, so a caller can skip a step rather than talk
   *  about something the reader cannot see.
   */
  function spotlight(ids, opts) {
    opts = opts || {};
    const want = new Set(ids || []);
    if (!want.size || !lastG) return false;
    // ONLY CLAIMS ARE UNFOLDED, and the distinction is not fussiness. `reveal` counts an id as
    // shown by looking for it among the drawn NODES, so handing it the id of a section band —
    // which is a group and lives nowhere in that list — sends it down its own escape hatch and
    // it expands the entire map to go looking. Pointing at the header of a band that is already
    // on the screen would have blown the Exposition view open to 127 boxes.
    if (opts.reveal !== false) {
      const claims = [...want].filter(id => (graph.nodes || []).some(n => n.id === id));
      if (claims.length) reveal(claims);
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, found = 0;
    for (const id of want) {
      // The node itself if it is drawn; otherwise whatever block stands in for it, exactly as
      // `centreOn` resolves it — a claim inside a folded section has no box of its own.
      let p = lastG.node(id);
      if (!p) {
        const rep = lastVis.nodes.find(n => (n.members || []).includes(id));
        if (rep) p = lastG.node(rep.id);
      }
      if (!p || p.x == null) continue;
      found++;
      x0 = Math.min(x0, p.x - p.width / 2); x1 = Math.max(x1, p.x + p.width / 2);
      y0 = Math.min(y0, p.y - p.height / 2); y1 = Math.max(y1, p.y + p.height / 2);
    }
    if (!found) return false;
    if (opts.topOnly) y1 = Math.min(y1, y0 + opts.topOnly);
    const pad = opts.pad == null ? 40 : opts.pad;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const cw = container.clientWidth || 800;
    const bar = toolbar ? toolbar.offsetHeight + 14 : 0;
    const ch = Math.max(80, (container.clientHeight || 500) - bar);
    const f = frameFor(x1 - x0, y1 - y0, cw, ch, opt.minScale);
    view.k = f.k;
    view.x = cw / 2 - ((x0 + x1) / 2) * view.k;
    view.y = ch / 2 - ((y0 + y1) / 2) * view.k;
    // The walkthrough asked for this camera; a fold performed as part of the tour must not
    // re-frame it away underneath. Same reasoning as `centreOn`.
    userMoved = true;
    glide();
    applyView();
    return true;
  }
  function attachZoom() {
    let dragging = false, sx = 0, sy = 0, down = null;
    // THE WHEEL BELONGS TO THE WHOLE PANE, not to the drawing inside it. Attached to the SVG,
    // zooming was refused over anything in the container that is not part of the SVG — which is
    // the floating toolbar, a strip across the bottom that is 20 of 345 sampled points, about a
    // sixteenth of the map. It also made the zoom depend on the SVG root's own empty area being
    // hit-tested, which is a thing engines are entitled to differ about, and the report this
    // fixes is of a pointer showing the pan cursor over background that would not zoom.
    // Listening on the container removes the dependence: the rectangle the reader sees as "the
    // map" is the rectangle the wheel works over.
    container.addEventListener("wheel", ev => {
      // ONE EXCEPTION. On a narrow window the toolbar becomes a strip that scrolls sideways
      // (see the max-width:560px rule), and a wheel over a thing that scrolls belongs to that
      // thing. Asked of the element rather than of the media query, so the two cannot drift.
      const bar = ev.target && ev.target.closest && ev.target.closest(".alm-bar");
      if (bar && bar.scrollWidth > bar.clientWidth + 1) return;
      ev.preventDefault();
      // The SVG's own box, not the container's: `view` is written into the SVG's coordinate
      // system, and the two differ the moment a host gives the container a border or padding.
      const r = svg.getBoundingClientRect();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = Math.max(0.15, Math.min(4, view.k * f));
      view.x = mx - (mx - view.x) * (k / view.k);
      view.y = my - (my - view.y) * (k / view.k);
      view.k = k; userMoved = true; viewport.style.transition = ""; applyView();
    }, { passive: false });
    svg.addEventListener("pointerdown", ev => {
      // A SECTION'S BACKGROUND IS CANVAS. `.alm-g` was in this list, so a pointerdown anywhere
      // inside a section refused to pan -- which on a fully unfolded map left almost nowhere to
      // drag from. Only the things that DO something on a press are excluded now: the boxes,
      // the fold toggles, and the section's own 22px fold strip.
      if (ev.target.closest(".alm-n, .alm-toggle, .alm-gfold")) return;
      // THE LEFT BUTTON ONLY. Without this a right-click started a pan -- and, worse, the
      // preventDefault below suppressed the contextmenu event that was supposed to follow it,
      // so "Fold section" could never appear. A dispatched contextmenu event still worked,
      // which is exactly why dispatching one was not a test of anything.
      if (ev.button !== 0) return;
      // The pointer now goes down on top of a section's words rather than on bare background,
      // so the browser starts selecting them and the map fills with blue. Cancelling the
      // default here stops the selection without making the map unselectable everywhere --
      // a blanket user-select:none would also take away copying a claim, which is not this
      // gesture's business to remove.
      ev.preventDefault();
      dragging = true; sx = ev.clientX - view.x; sy = ev.clientY - view.y;
      down = { x: ev.clientX, y: ev.clientY };
      userMoved = true; viewport.style.transition = "";
      svg.setPointerCapture(ev.pointerId); svg.classList.add("is-panning");
    });
    svg.addEventListener("pointermove", ev => {
      if (!dragging) return;
      view.x = ev.clientX - sx; view.y = ev.clientY - sy; applyView();
    });
    // A CLICK ON THE BACKGROUND PUTS THE MARK OUT — but a PAN must not, and both arrive here as
    // a pointerup on the same element. Distance decides: under a few pixels is a click, anything
    // more was a drag. Measured on the pointer rather than read off `dragging`, which is true
    // for both.
    const stop = ev => {
      if (dragging && down && ev &&
          Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 4) setLit([]);
      dragging = false; down = null; svg.classList.remove("is-panning");
    };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);
  }

  /* ------------------------------------------------------------ controls */

  /* The toolbar, kept deliberately thin.
   *
   * The controls answer two separate questions and used to be jumbled together, so the reader
   * had to work out which button belonged to which. They are now two labelled groups:
   *
   *   HOW MUCH   how many levels of reasons are showing (a progression, not a set of options)
   *   SECTIONS   whether the argument's sections are folded into blocks or opened out
   *
   * "expand all" and "fold all groups" were the ends of those two scales wearing different
   * clothes; they are gone, and the scales say so themselves. Counts ride on the buttons, so
   * the reader can see what a click will cost before making it.
   */
  function buildToolbar(parts) {
    const bar = document.createElement("div");
    bar.className = "alm-bar";
    // ORDER IS AN ARGUMENT ABOUT WHAT THESE CONTROLS ARE. "how much", "claims" and "sections" all
    // answer the same question -- how much of this do I want on screen -- at three grains: how far
    // out from the contention, how much of each claim's own words, and whether the sections are
    // shut. They belong together and in that order. "kinds" is a different question entirely
    // (which claims, not how much) and so goes last.
    bar.innerHTML =
      (parts.depth ? '<span class="alm-grp" data-role="depth"></span>' : "") +
      (parts.actions ? '<span class="alm-grp alm-seg" data-role="claims">' +
        '<b title="How much of each claim\'s own words to show">claims</b>' +
        '<button data-act="text" data-full="0" title="The first few lines, with a “more” link">' +
        'short</button>' +
        '<button data-act="text" data-full="1" title="Every claim in full">full</button>' +
        '</span>' : "") +
      '<span class="alm-grp alm-seg" data-role="sections"></span>' +
      // SPINE sits with "kinds" rather than with "how much", because it answers WHICH claims
      // rather than how many levels of them — a claim deep in the argument can be spine and a
      // claim beside the contention need not be.
      '<span class="alm-grp alm-seg" data-role="spine">' +
        '<b title="Show every claim, or only those the argument rests on">spine</b>' +
        '<button data-act="spine" data-on="0" title="Every claim">all</button>' +
        '<button data-act="spine" data-on="1" ' +
        'title="Only claims that hold something up: remove one and part of the argument ' +
        'loses its route to a contention">load-bearing</button>' +
      '</span>' +
      (parts.facets ? '<span class="alm-grp" data-role="facets"></span>' : "");
    // `input`, not `change`: the map should follow the thumb as it is dragged, which is the whole
    // reason a ladder is worth making draggable.
    bar.addEventListener("input", ev => {
      const r = /** @type {any} */ (ev.target).closest("input.alm-range"); if (!r) return;
      const rungs = r.parentNode._rungs || [];
      const cur = rungs[+r.value]; if (!cur) return;
      if (cur.key === "chapters") return apply({ type: "byChapter" });
      return apply({ type: "depth", value: cur.key === "all" ? null : +cur.key });
    });
    bar.addEventListener("click", ev => {
      const b = /** @type {any} */ (ev.target).closest("button"); if (!b) return;
      const act = b.dataset.act;
      if (act === "text")     return setState({ allText: b.dataset.full === "1" });
      if (act === "spine")    return setState({ spine: b.dataset.on === "1" ? 1 : null });
      if (act === "sections") return apply({ type: b.dataset.open === "1" ? "expandGroups"
                                                                          : "collapseAll" });
      if (b.dataset.depth != null) {
        if (b.dataset.depth === "chapters") return apply({ type: "byChapter" });
        const d = b.dataset.depth === "all" ? null : +b.dataset.depth;
        return apply({ type: "depth", value: d });
      }
      if (b.dataset.facet != null) {
        const all = facetValues();
        const cur = state.facets ? new Set(state.facets) : new Set(all);
        cur.has(b.dataset.facet) ? cur.delete(b.dataset.facet) : cur.add(b.dataset.facet);
        return setState({ facets: [...cur] });
      }
    });
    return bar;
  }

  function facetValues() {
    return [...new Set((graph.nodes || []).map(n => n.facet).filter(Boolean))].sort();
  }

  function syncToolbar(vis, info) {
    const depthBox = /** @type {any} */ (toolbar.querySelector('[data-role="depth"]'));
    if (depthBox) {
      // Rebuilt when the axis changes, because the first rung MEANS something different in each
      // view and saying "main claim" over eight of them is just wrong. In the argument view the
      // levels count down from the paper's contention; in the by-position view they count out
      // from the claim each section is making, so that no section of the article can vanish.
      const mode = expo ? (multiFile ? "text-book" : "text") : "argument";
      // A SLIDER, BECAUSE IT IS A LADDER. These rungs are a single progression from the main
      // claim outwards -- each one shows everything the one before it did and more -- and a row
      // of buttons said the opposite: five separate options, of which one happened to be lit.
      // The slider says "you are at this point on a scale" in its shape, before anything is
      // read, and the arrow keys then step it for free. The rung's name and the count it will
      // cost stay beside it, because the cost is what the reader is deciding about.
      if (!depthBox.childElementCount || depthBox.dataset.mode !== mode) {
        const md = maxDepth(graph);
        const labels = expo ? ["section claims", "+ reasons", "+ detail"]
                            : ["main claim", "+ reasons", "+ detail"];
        const rungs = [];
        if (expo && multiFile)
          rungs.push({ key: "chapters", label: "by chapter",
                       title: "Each section shut into one block, so a whole manuscript can be " +
                              "taken in at once" });
        for (let d = 0; d <= Math.min(md, 2); d++)
          rungs.push({ key: String(d), label: labels[d] || "level " + d });
        rungs.push({ key: "all", label: "everything" });
        depthBox.innerHTML =
          '<b title="' + (expo
            ? "How far into each section of the text — every section stays represented"
            : "How many levels of reasons are showing") + '">how much</b>' +
          '<input type="range" class="alm-range" min="0" max="' + (rungs.length - 1) +
          '" step="1" value="0" aria-label="how much of the argument is showing">' +
          '<span class="alm-rung"></span>';
        /** @type {any} */ (depthBox)._rungs = rungs;
        /** @type {any} */ (depthBox).dataset.mode = mode;
      }
      // Say what the current rung shows, so the reader can judge a move before making it.
      const byChapterNow = expo && state.collapsedLanes.size > 0;
      const rungs = depthBox._rungs || [];
      const range = /** @type {any} */ (depthBox.querySelector("input.alm-range"));
      const readout = depthBox.querySelector(".alm-rung");
      if (range && readout && rungs.length) {
        const want = byChapterNow ? "chapters"
                   : (state.depth == null ? "all" : String(state.depth));
        let idx = rungs.findIndex(r => r.key === want);
        // WITH BANDS SHUT BY HAND the ladder is off its rungs entirely. Rather than light a rung
        // that is not in force, the slider sits where it last was and the readout says so.
        const offLadder = idx < 0;
        if (offLadder) idx = rungs.length - 1;
        range.value = String(idx);
        const cur = rungs[idx];
        const n = cur.key === "chapters" ? countByChapter()
                                         : countAtDepth(cur.key === "all" ? null : +cur.key);
        readout.innerHTML = '<em>' + cur.label + '</em>' +
                            (n == null ? "" : ' <i>' + n + '</i>');
        readout.classList.toggle("alm-off", offLadder);
        range.title = cur.title || "";
        range.setAttribute("aria-valuetext",
                           cur.label + (n == null ? "" : ", " + n + " claims"));
      }
    }

    const sectionBox = /** @type {any} */ (toolbar.querySelector('[data-role="sections"]'));
    if (sectionBox) {
      // WHICH sections: the ones the view on screen actually draws. In the argument view those
      // are the Argdown file's own headings; in the by-position view they are the manuscript's,
      // which are a different division of the same material. Reporting one while showing the
      // other made the pair of buttons read as broken — "folded" lit up over an unfolded map.
      const lanes = expo
        ? [...new Set((graph.nodes || []).map(textLane).filter(l => l !== "gutter"))]
        : null;
      const groups = expo ? lanes : (graph.groups || []).filter(g => !g.parent).map(g => g.id);
      // On a book the "by chapter" rung IS this switch, so showing both would be one axis with
      // two controls that have to be kept agreeing. The rung wins: it sits on the same scale as
      // the rest of "how much", which is where the reader is already choosing how much to see.
      // Nor is it worth offering on a source with a single band — a paper with no headings of
      // its own. "Folded" there means the whole map becomes one block, which the reader can do
      // by clicking the band and is not a setting anybody wants on a toolbar.
      sectionBox.hidden = !groups.length || (expo && (multiFile || groups.length < 2));
      if (groups.length) {
        if (!sectionBox.childElementCount)
          sectionBox.innerHTML =
            '<b title="Whether the sections are folded into blocks">sections</b>' +
            '<button data-act="sections" data-open="0">folded</button>' +
            '<button data-act="sections" data-open="1">open</button>';
        const anyFolded = expo ? state.collapsedLanes.size > 0
                               : groups.some(id => state.collapsedGroups.has(id));
        sectionBox.querySelector('[data-open="0"]').classList.toggle("on", anyFolded);
        sectionBox.querySelector('[data-open="1"]').classList.toggle("on", !anyFolded);
        /** @type {any} */ (sectionBox.querySelector('[data-open="0"]')).dataset.count =
          String(groups.length);
      }
    }

    const fBox = toolbar.querySelector('[data-role="facets"]');
    if (fBox) {
      const vals = facetValues();
      if (!fBox.childElementCount && vals.length) {
        const total = {};
        for (const n of graph.nodes || []) if (n.facet) total[n.facet] = (total[n.facet] || 0) + 1;
        // HASHTAGS, NOT "KINDS". Testers did not know what a "kind" was, and the word named
        // nothing in the file: what the buttons list is whatever `#tags` the .argdown actually
        // carries. The control already appears only when there are some -- `vals.length` above.
        fBox.innerHTML = '<b title="Hashtags the file uses. Switch one off to take those claims '
          + 'off the map. See Help for what #reported, #conceded and #contested mean.">hashtags</b>'
          + vals.map(v => `<button data-facet="${v}" data-count="${total[v] || 0}">${v}</button>`).join("");
      }
      fBox.querySelectorAll("button").forEach(b =>
        b.classList.toggle("on", !state.facets || state.facets.has(b.dataset.facet)));
    }

    // Both halves are lit or unlit together, like `sections`: a radio pair says which of the two
    // is in force, and a single button that is merely "off" says nothing about what is.
    toolbar.querySelectorAll('[data-act="text"]').forEach(
      /** @param {any} b */ b =>
        b.classList.toggle("on", (b.dataset.full === "1") === !!allText));
    // The same radio-pair rule for spine, and the count of what it would leave rides on the
    // button so the reader can see what a click costs before making it.
    const spineOn = state.spine != null;
    toolbar.querySelectorAll('[data-act="spine"]').forEach(
      /** @param {any} b */ b => b.classList.toggle("on", (b.dataset.on === "1") === spineOn));
    const spineBtn = /** @type {any} */ (toolbar.querySelector('[data-act="spine"][data-on="1"]'));
    if (spineBtn) {
      try {
        const load = loadOf(index(graph));
        let n = 0;
        for (const nd of (graph.nodes || []))
          if ((load.get(nd.id) || 0) >= 1) n++;
        spineBtn.textContent = "load-bearing " + n;
      } catch (e) { /* a graph too odd to measure keeps the plain label */ }
    }
  }

  /** How many blocks the by-chapter rung puts on screen — the number on its button. */
  function countByChapter() {
    try {
      return filterGraph(graph, reduceFold(graph, state, { type: "byChapter" }, lastVis, opt))
             .nodes.length;
    } catch (e) { return null; }
  }

  /** How many claims a given depth setting puts on screen — the number on the button. */
  function countAtDepth(d) {
    try {
      return filterGraph(graph, Object.assign({}, state, {
        depth: d, collapsedNodes: new Set(), expandedNodes: new Set(),
        groupFolded: new Map(), collapsedLanes: new Set()
      })).nodes.length;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ public API */

  // (membersOfGroup, module-level, replaced the closure that used to live here — toggleGroup now
  //  needs it, and one copy of the walk is enough.)

  /** Both controls defer to reduceFold, the pure state machine, so what the reader clicks and
   *  what the invariant harness drives are the same code. */
  function apply(action) {
    setState(reduceFold(graph, state, action, lastVis, opt));
  }

  function toggleGroup(id) { apply({ type: "toggleGroup", id }); }

  /** The circle means one thing only: SHOW or HIDE what argues for and against this claim.
   *  It is driven by what is actually on screen, not by which internal set the node happens to
   *  be in — so "+" always reveals and "−" always hides, whichever mechanism was hiding them. */
  function toggleNode(id) { apply({ type: "toggleNode", id }); }

  /** Whether this node shows its claim in full or clipped to a few lines. */
  function toggleText(id) {
    textOpen.has(id) ? textOpen.delete(id) : textOpen.add(id);
    measureCache.clear();
    render(false);
  }

  function getState() {
    return { collapsedGroups: [...state.collapsedGroups], collapsedNodes: [...state.collapsedNodes],
             expandedNodes: [...state.expandedNodes], groupFolded: [...state.groupFolded],
             collapsedLanes: [...state.collapsedLanes],
             depth: state.depth, facets: state.facets ? [...state.facets] : null, allText,
             // `spine` and `byText` were missing from this snapshot, which meant a host that
             // rebuilt the map — the live editor, after a keystroke — silently lost the spine
             // setting: exactly the dropped-in-silence failure setState's own comment warns
             // about. `byText` rides along so the snapshot is the whole fold state in one
             // shape, the one the fold state identifier encodes.
             spine: state.spine, byText: state.byText,
             // WHERE THE CAMERA IS. A host that rebuilds the map — a live editor redrawing after
             // a keystroke — can hand this straight back and the reader keeps their place
             // instead of being thrown to a fresh fit on every edit.
             view: { x: view.x, y: view.y, k: view.k }, userMoved: userMoved,
             expositionOrder: expo };
  }
  function setState(patch, refit) {
    if ("collapsedGroups" in patch) state.collapsedGroups = new Set(patch.collapsedGroups);
    if ("collapsedNodes"  in patch) state.collapsedNodes  = new Set(patch.collapsedNodes);
    if ("expandedNodes"   in patch) state.expandedNodes   = new Set(patch.expandedNodes);
    if ("groupFolded"     in patch) state.groupFolded     = new Map(patch.groupFolded);
    if ("collapsedLanes"  in patch) state.collapsedLanes  = new Set(patch.collapsedLanes);
    if ("facets"          in patch) state.facets          = patch.facets ? new Set(patch.facets) : null;
    // SPINE. `setState` copies an explicit list rather than merging the patch, so a key missing
    // from it is dropped in silence — which is what happened when the control was first wired:
    // the button changed nothing and said nothing.
    if ("spine"           in patch) state.spine           = patch.spine;
    if ("allText"         in patch) { allText = !!patch.allText; textOpen.clear(); measureCache.clear(); }
    // Switching axis moves every node at once. Re-frame rather than leave the reader looking
    // at whatever happens to be under the old camera position.
    if ("expositionOrder" in patch) {
      expo = positioned && !!patch.expositionOrder; state.byText = expo; refit = true;
      // A BOOK OPENS FOLDED TO ITS CHAPTERS. Laid out claim by claim it is a ribbon: every band
      // is its own row, so 81 bands make 81 rows however wide the page, and the fitted map is a
      // sliver. Done once, on first entry, so a reader who then opens a chapter and switches
      // axes and comes back does not find their chapter shut again.
      if (expo && multiFile && !expoOpened) {
        expoOpened = true;
        Object.assign(state, reduceFold(graph, state, { type: "byChapter" }, lastVis, opt));
      }
    }
    if ("depth" in patch) {
      state.depth = patch.depth;
      // A depth choice is a fresh baseline for the whole map. Leaving per-node opens and folds
      // in place makes the depth buttons look broken — you press "main claim" and stray
      // branches stay on screen.
      if (!("collapsedNodes" in patch)) state.collapsedNodes = new Set();
      if (!("expandedNodes"  in patch)) state.expandedNodes  = new Set();
    }
    render(!!refit);
  }

  // First paint happens last: measure() and friends are `const`, so anything that calls them
  // has to run after their declarations rather than at the top of this function.
  attachZoom();
  // FIT ON OPENING, unless a camera came with the options. A host that rebuilds the map after
  // every edit hands the reader's own camera back, and forcing a fit over it is what made the
  // picture jump and re-zoom while they were typing.
  render(!(options && options.view));

  /** Put the drawn thing that stands for `id` on screen, whatever is currently hiding it.
   *
   *  A claim can be out of sight for four different reasons — the depth limit, its own fold, a
   *  folded Argdown section, a folded band of the text — and a reader who has just clicked the
   *  passage it came from does not care which. So this clears each of them for that claim and
   *  re-renders, then CHECKS: if the claim is still not drawn, it falls back to opening
   *  everything. The check is what makes the targeted version safe to have — without it a fifth
   *  reason invented later would silently do nothing.
   */
  function reveal(ids) {
    const want = new Set(ids);
    // THE CLAIM ITSELF, not a block standing for it. A claim inside a folded section IS hidden —
    // you cannot read it — so counting it as already shown would leave the reader looking at a
    // lit block and no way to see what was actually found.
    const drawnNow = () => new Set(lastVis.nodes.map(n => n.id));
    if ([...want].every(id => drawnNow().has(id))) return false;
    const ix = index(graph);
    state.depth = null;
    for (const id of want) {
      state.collapsedNodes.delete(id);
      state.groupFolded.delete(id);
      for (const g of groupChain(ix, id)) state.collapsedGroups.delete(g);
      const n = ix.byId.get(id);
      if (n) {
        const lane = textLane(n);
        state.collapsedLanes.delete(lane);
        state.collapsedLanes.delete(laneChapter(lane));
      }
    }
    render(false);
    if ([...want].every(id => drawnNow().has(id))) return true;
    Object.assign(state, reduceFold(graph, state, { type: "expandAll" }, lastVis, opt));
    render(false);
    return true;
  }

  /** Slide the camera so `ids` sit in the middle, at the zoom the reader is already using.
   *  Deliberately does NOT re-fit: someone who has zoomed in to read has chosen that zoom, and
   *  changing it to frame a result takes away the thing they were looking at. */
  /* WHERE THE READER CAME FROM, while they are away from it. Null when they are not. */
  let excursion = null;
  let returnEl = null;

  /* TWO THINGS A READER MIGHT WANT, and until now only one of them was offered. Having travelled
   * to a claim, they may want to go back -- or they may have arrived where they meant to be and
   * simply want the offer to stop following them around. A control that can only be accepted is
   * a control the reader cannot answer, so the pill carries its own dismissal.
   *
   * The two halves highlight separately on hover, because a single pill that does one of two
   * things depending on which end you press must say so before you press it. */
  let returnGo = null;
  function showReturn() {
    if (!returnEl) {
      returnEl = document.createElement("div");
      returnEl.className = "alm-return";

      returnGo = document.createElement("button");
      returnGo.type = "button";
      returnGo.className = "alm-return-go";
      returnGo.addEventListener("click", ev => {
        ev.stopPropagation();
        const back = excursion;
        hideReturn();
        if (back) { setLit([back.id]); centreOn([back.id]); }
      });

      const x = document.createElement("button");
      x.type = "button";
      x.className = "alm-return-x";
      x.textContent = "\u00d7";
      x.title = "Dismiss — stay where you are";
      x.setAttribute("aria-label", "Dismiss, and stay where you are");
      x.addEventListener("click", ev => { ev.stopPropagation(); hideReturn(); });

      returnEl.append(returnGo, x);
      container.appendChild(returnEl);
    }
    // `destroy()` empties the container, so an instance reused for a second document would hold
    // a reference to a node that is no longer in the page -- and setting text on a detached
    // element fails silently, which is the worst way for a control to be missing.
    if (returnEl.parentNode !== container) container.appendChild(returnEl);
    returnGo.textContent = "\u2190 back to " +
      (excursion && excursion.label ? excursion.label : "the argument");
    returnEl.hidden = false;
  }

  function hideReturn() {
    excursion = null;
    if (returnEl) returnEl.hidden = true;
  }

  function centreOn(ids, onlyIfTheyFit) {
    if (!lastG) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, found = 0;
    for (const id of ids) {
      // The claim itself if it is drawn; otherwise whatever block stands for it.
      let p = lastG.node(id);
      if (!p) {
        const rep = lastVis.nodes.find(n => (n.members || []).includes(id));
        if (rep) p = lastG.node(rep.id);
      }
      if (!p || p.x == null) continue;
      found++;
      x0 = Math.min(x0, p.x - p.width / 2); x1 = Math.max(x1, p.x + p.width / 2);
      y0 = Math.min(y0, p.y - p.height / 2); y1 = Math.max(y1, p.y + p.height / 2);
    }
    if (!found) return false;
    const cw = container.clientWidth || 800;
    const bar = toolbar ? toolbar.offsetHeight + 14 : 0;
    const ch = Math.max(80, (container.clientHeight || 500) - bar);
    // WOULD THEY ALL FIT? That, not how many there are, is what decides whether moving the
    // camera helps. Two claims side by side are worth framing; six scattered across a book have
    // a midpoint that is nowhere near any of them, and centring on it moves the reader away
    // from everything they asked about. Counting was the first rule and got both wrong.
    if (onlyIfTheyFit &&
        ((x1 - x0) * view.k > cw * 0.9 || (y1 - y0) * view.k > ch * 0.9)) return false;
    view.x = cw / 2 - ((x0 + x1) / 2) * view.k;
    view.y = ch / 2 - ((y0 + y1) / 2) * view.k;
    userMoved = true;             // the reader asked for this camera; a fold must not undo it
    glide();
    applyView();
    return true;
  }

  /** PUBLIC: "these claims are the ones being talked about." Unfolds whatever is hiding them,
   *  marks them, and moves the camera onto them when they all fit on screen at the reader's
   *  current zoom. Returns whether the camera moved, so a host can say "off screen" rather than
   *  leave the reader wondering where the answer went. */
  function markClaims(ids, opts) {
    const want = new Set(ids || []);
    if (!want.size) { setLit([]); return false; }
    lit = want;                    // set before `reveal`, whose render paints from it
    // `reveal` renders when it had to unfold something. When it did not, repainting the marks
    // is enough — re-rendering would re-lay the map out to change a stroke.
    if (!reveal(want)) applyLit();
    return centreOn([...want], !(opts && opts.centreAlways));
  }

  /* THE FIRST FRAMING CAN LAND BEFORE THE PAGE HAS A SIZE.
   *
   *  `createLiveMap` draws and frames immediately, and if the host is still laying itself out
   *  the container measures 0 — so `fitTo` falls back to a floor of 80px of height, decides the
   *  map cannot possibly fit, and anchors it at the minimum zoom in a corner. That is what a
   *  six-box map at scale 0.5 in an 826x790 pane was: not a layout fault, a framing done against
   *  a container that did not exist yet.
   *
   *  It went unnoticed for a long time because opening the source pane called `redraw()`, which
   *  re-framed everything as a side effect. Removing that (it was yanking the camera whenever a
   *  claim was clicked) took the accidental repair away and left the original bug visible. So
   *  the repair is made deliberate and narrow: watch the container, and re-frame ONLY until the
   *  map has been framed against a container with a real size. After that, resizing — including
   *  opening, closing and dragging the source pane — leaves the reader's view alone.
   */
  let sizeWatch = null;
  if (typeof ResizeObserver === "function") {
    sizeWatch = new ResizeObserver(() => {
      // FIRST, AND WHATEVER THE CAMERA SAYS. A map measured blind has boxes of the wrong SIZE,
      // not merely the wrong position, and no amount of re-framing fixes a box three pixels wide.
      // This has to come before the `framedForReal` test, because a camera handed back by the
      // host sets that flag — which is precisely the case where the map was re-rendered into a
      // hidden pane and needs measuring again.
      if (remeasureIfBlind()) { render(true); return; }
      if (framedForReal || !lastFit || container.clientHeight <= 120) return;
      fitTo(lastFit.w, lastFit.h, lastFit.apex);
    });
    sizeWatch.observe(container);
  }

  return {
    setState, getState, toggleGroup, toggleNode,
    markClaims, spotlight,
    fit: () => fitTo(lastFit.w, lastFit.h),
    // The host calls this when a pane opens or closes. If the last render was measured blind, the
    // sizes have to be thrown away first — otherwise this redraws the slivers exactly as they are.
    redraw: () => { remeasureIfBlind(); render(true); },
    destroy: () => {
      if (sizeWatch) { sizeWatch.disconnect(); sizeWatch = null; }
      container.innerHTML = ""; container.classList.remove("alm");
    }
  };
}

/* ------------------------------------------------------------------ styles */

let styled = false;
function injectStyle() {
  if (styled || document.getElementById("alm-style")) { styled = true; return; }
  styled = true;
  const s = document.createElement("style");
  s.id = "alm-style";
  s.textContent = `
.alm{position:relative;width:100%;height:100%;min-height:320px}
/* Insurance, and not idle: hosts hide a pane with the hidden attribute, which works only via the
   user-agent rule [hidden]{display:none}. Any class selector here that sets display would
   silently outrank it and leave this pane painted over the others -- which is exactly what
   happened to the Order view when its container became a flex column.
   NB no backticks in this block: it lives inside a template literal, and one ends the string. */
.alm[hidden]{display:none}
.alm-svg{width:100%;height:100%;display:block;cursor:grab;touch-action:none;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.alm-svg.is-panning{cursor:grabbing}
.alm-measure{visibility:hidden;pointer-events:none}
.alm-viewport,.alm-n,.alm-g{transform-origin:0 0}
.alm-n{cursor:pointer;transition:transform var(--alm-dur,350ms) cubic-bezier(.4,0,.2,1),
  opacity 220ms ease}
/* Nodes stay neutral and the RELATIONS carry the colour. Green-bordered boxes next to green
   support arrows read as if every claim were itself a "support", which is the wrong signal. */
.alm-n .alm-box{fill:var(--alm-node-bg,#fff);stroke:var(--alm-node-line,#5b6472);stroke-width:1.5}
.alm-n.alm-k-opponent .alm-box{stroke:#cc3b3b}
.alm-n.alm-k-survey .alm-box{stroke:#9a9a9a;stroke-dasharray:4 3}
.alm-n.alm-k-survey .alm-title{font-style:italic}
/* A FOLDED SECTION IS MADE OF CLAIMS, so it is drawn like one. It used to be cream on brown
   while everything inside it was white on slate, and testers read the difference as meaning
   something -- then found it meant only "this is a section rather than an argument", which is
   a distinction about the file rather than about the reasoning, and not one they wanted. Two
   boxes that differ in colour should differ in kind; these do not.
   The DASH stays, and now carries the whole distinction on its own: it says the box stands for
   more than it shows, which is the one thing a reader does need to know.
   It was also wrong in dark mode and could not be fixed there: the group rule outranks the
   prefers-color-scheme:dark rule that repaints the ordinary box, so a folded section stayed
   cream on a dark map. Inheriting the fill fixes both at once.
   (No back-ticks in this comment -- the stylesheet is a template literal.) */
.alm-n.alm-k-group .alm-box{stroke-dasharray:4 3}
/* FIDELITY -- whose words the claim is in. Orthogonal to kind, so it takes the border while
   colour keeps carrying argumentative role. Solid = the source's own words; the line breaks
   up as the reconstruction moves further from them, and imputation -- a premise the
   argument needs but the author never states -- is the most broken of all. */
.alm-n.alm-f-quotation .alm-box{stroke-width:2.5}
.alm-n.alm-f-paraphrase .alm-box{stroke-dasharray:6 2}
.alm-n.alm-f-compression .alm-box{stroke-dasharray:4 3}
.alm-n.alm-f-interpretation .alm-box{stroke-dasharray:2 3}
.alm-n.alm-f-imputation .alm-box{stroke-dasharray:7 2 1.5 2;stroke-width:1.2}
.alm-n.alm-f-imputation .alm-title{font-style:italic}
.alm-n.is-collapsed .alm-box{stroke-width:2}
.alm-n .alm-title{fill:var(--alm-fg,#1a1a1a)}
.alm-n .alm-text{fill:var(--alm-fg-dim,#555)}
/* THE PREMISE-CONCLUSION STRUCTURE inside an argument's box. The numbers are quieter than the
   text they index -- they are an apparatus for referring to the lines, not part of what the
   argument says -- and a conclusion is set in the claim's own ink because it is the thing being
   asserted, where a premise is what is being granted. */
.alm-n .alm-pcs-num{fill:var(--alm-fg-faint,#9a9a9a);font-variant-numeric:tabular-nums}
.alm-n .alm-pcs-text{fill:var(--alm-fg-dim,#555)}
.alm-n .alm-pcs-row.is-conclusion .alm-pcs-text{fill:var(--alm-fg,#1a1a1a)}
/* The inference bar. Solid and full-width, because what it says -- everything above this line
   is a reason, what is below it is what follows -- is a claim about the argument's structure and
   not an ornament. */
.alm-n .alm-pcs-bar{stroke:var(--alm-fg-faint,#9a9a9a);stroke-width:1;fill:none}
.alm-n .alm-pcs-rule{fill:var(--alm-fg-faint,#9a9a9a);font-style:italic}
/* A REFERENCE ROW points at a box elsewhere on the map. Set in the numbers' quiet ink -- it is
   apparatus, not assertion; the assertion lives in the box it names -- and hovering it lights
   that box up (is-ref-target below), which is the whole account of the double appearance. */
.alm-n .alm-pcs-row.is-ref .alm-pcs-text{fill:var(--alm-fg-faint,#9a9a9a)}
.alm-n .alm-pcs-row.is-ref:hover .alm-pcs-text{fill:var(--alm-accent,#3a7bd5)}
/* The line number an edge carries, at the argument's end of it and at each junction foot:
   the same numerals as the rows they pair with, in the relation's own ink. */
.alm-line-no,.alm-join-no{pointer-events:none;font-variant-numeric:tabular-nums;opacity:.9}
.alm-n:hover .alm-box{stroke-width:2.5}
/* The circle is the one control that says "show / hide what argues for this". A closed one is
   filled and inviting; an open one is quiet, because most of the time you leave it alone. */
.alm-toggle{cursor:pointer}
.alm-toggle circle{fill:var(--alm-node-bg,#fff);stroke:#8a8a8a;stroke-width:1.2}
.alm-toggle text{fill:#444;pointer-events:none;font-weight:600}
.alm-toggle.is-closed circle{fill:var(--alm-accent,#3a7bd5);stroke:var(--alm-accent,#3a7bd5)}
.alm-toggle.is-closed text{fill:#fff}
.alm-toggle:hover circle{stroke:#222;stroke-width:2}
/* The badge's reach, in SCREEN pixels rather than graph units -- see paintNode. NO BACKTICKS IN
   THIS BLOCK: it lives inside a template literal and one ends the string.
   It has to beat the three rules above, all of which name .alm-toggle circle, so it names the
   class as well and sits after them. pointer-events:all rather than relying on a transparent
   paint counting as painted, which is true but is not the sort of thing to rest a control on. */
.alm-toggle circle.alm-toggle-hit{fill:transparent;stroke:transparent;stroke-width:16;
  vector-effect:non-scaling-stroke;pointer-events:all}
.alm-more{cursor:pointer}
.alm-more text{fill:var(--alm-accent,#3a7bd5);pointer-events:none}
.alm-more:hover text{text-decoration:underline}
.alm-e{fill:none;stroke-width:1.8;transition:opacity var(--alm-dur,350ms) ease}
/* EXPOSITION VIEW. An edge whose support arrives after the claim it bears on is ANTICIPATED:
   the reader is told the claim and asked to hold it until the support lands. That is the
   announce-then-argue convention analytic philosophy actually teaches -- Pryor's guide tells
   students to make the structure obvious and not to make the reader work it out -- so it is
   not a defect and gets no extra weight, and its opposite gets no penalty.
   Emphasis belongs to REACH instead, which is what costs a reader something whichever
   direction it runs. Colour still distinguishes the two, faintly, so the direction is legible
   without being scored.
   NB any dimming must use stroke-opacity, NOT opacity: the draw code sets element.style.opacity
   to fade an edge in, and an inline style beats any rule on the same property. */
.alm-e.is-far{stroke-width:2.8}
/* DIRECTION MARKS. Open chevrons repeating the arrowhead along a long line, because one head at
   the far end is not enough to follow an edge that crosses the map, and because the head itself
   is the thing most likely to be crowded. Open rather than solid so they read as "still going
   this way" and are never taken for the end of the line. Non-interactive: they sit on top of the
   stroke and must not eat its hover or its clicks. */
.alm-dir{fill:none;pointer-events:none;transition:opacity var(--alm-dur,350ms) ease}
.alm-dir path{fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.alm-dir.is-far path{stroke-width:2.4}
/* Direction of the relation along the text was carried by a DASH, which was a mistake: dashes
   already mean undercut and contradiction, so a plain support looked like a different kind of
   relation the moment the arrangement changed. It is carried by weight now — a reach that runs
   against the text is drawn a shade heavier — and the arrangement is named in the top bar, so
   nothing has to be inferred from the stroke. */
/* THE BAND SPARKLINE. One ink colour and no green or red anywhere near it: those two mean
   support and attack a few centimetres away on the same screen, and the side of the axis is
   already carrying the whole distinction here.

   THE AXIS IS ALMOST NOT THERE, and that is deliberate. A sparkline conventionally has no axis
   at all -- the rises and falls speak for themselves -- and a solid rule through the middle of
   this one competed with the signal instead of supporting it. It is kept, dashed and faint,
   only because the zero here MEANS something: it is the line between support that arrives after
   a claim and support already given, and with both bands empty in a stretch there would
   otherwise be nothing to say where the middle was. */
.alm-spark{pointer-events:none}
.alm-spark-fill{fill:var(--alm-spark,#5a6474);fill-opacity:.34;stroke:none}
.alm-spark-line{fill:none;stroke:var(--alm-spark,#5a6474);stroke-width:1;stroke-opacity:.85}
.alm-spark-axis{stroke:var(--alm-spark,#5a6474);stroke-opacity:.16;stroke-width:.75;
  stroke-dasharray:2 3}

/* THE TWO DIRECTIONS, told apart by weight of ink. NO BACKTICKS IN THIS BLOCK -- it lives inside
   a template literal and one ends the string.

   FULL INK MEANS ALREADY JUSTIFIED. is-prepared is a claim whose reasons were given before it
   was made: nothing is owed, and it is drawn solid. is-anticipated is a claim asserted ahead of
   its justification, drawn pale, because at the point a reader meets it that is exactly what it
   is -- provisional, accepted on a promise.

   IT WAS THE OTHER WAY ROUND, on the reasoning that an unpaid promise is the thing worth
   noticing and so should catch the eye. Followed through, that is perverse: a paper which earns
   every claim before making it -- the best case -- would render almost entirely washed out.

   And ink weight already means groundedness here. A quotation gets a solid border; an
   imputation, a premise the argument needs and the author never states, gets a dot-dashed one.
   Pale for an unpaid justification joins that grammar instead of starting a second one.

   Both keep the colour that says whether they support or attack; only the value changes. */
.alm-e.is-prepared{stroke-opacity:1}
.alm-e.is-anticipated{stroke-opacity:.45}
.alm-dir.is-anticipated path{stroke-opacity:.45}
.alm-bar .alm-note{opacity:.7;font-variant-numeric:tabular-nums}
.alm-g{cursor:pointer;transition:transform var(--alm-dur,350ms) cubic-bezier(.4,0,.2,1),
  opacity 220ms ease}
.alm-gbox{fill:var(--alm-group-bg,rgba(0,0,0,.035));stroke:var(--alm-group-line,#b9b2a3);
  stroke-width:1;stroke-dasharray:5 4}
/* Chapter bands in the exposition view: a ruler, not a control. Nothing to click, so nothing
   that looks clickable. */
.alm-g.is-fixed{cursor:default}
.alm-g.is-fixed .alm-gbox{stroke-dasharray:none;stroke-opacity:.5}
.alm-g.is-fixed:hover .alm-gbox{stroke-width:1}
/* The hidden-line convention, drawn over the nodes: broken, hairline, and the edge's own colour
   so the eye joins it to the visible line on either side. Never takes a click. */
/* The bar that gathers the linked premises of one inference step. Heavier than the lines it
   joins, because it is the thing that says they are one move and not several. */
/* The folded corner that says something is written in the margin here. Two colours, because the
   reconstructor's own note and someone else's comment on the argument are different things and a
   file that goes back to a student has to keep them apart. */
.alm-margin{cursor:pointer}
.alm-margin-fold{fill:#8a6d1f;opacity:.72}
.alm-margin.is-comment .alm-margin-fold{fill:#b5179e;opacity:.82}
.alm-margin:hover .alm-margin-fold{opacity:1}
/* The hit area sits above the fold so the whole corner is clickable, not just the ink. */
.alm-margin-hit{cursor:pointer}
.alm-join-bar{fill:none;stroke-width:3.6;stroke-linecap:round}
/* The rule name beside the bar. Italic and small: it names the LICENCE for the step, which is a
   remark about the argument rather than a move in it. */
.alm-join-rule{font-style:italic;opacity:.85;pointer-events:none}
/* WHAT BECAME OF THE CLAIM THE RULE NAME MAKES. Four states, and only one is loud.

   NO NEW COLOUR. All four of the relation colours are spoken for -- green support, red attack,
   orange undercut, purple contradictory -- so a red "invalid" badge would read as an attack on
   the step rather than a remark about it. The name keeps its relation colour and the DECORATION
   carries the verdict; the badge takes --alm-accent, which is already this map's voice for
   the program talking about the map rather than for anything in the argument. */
.alm-pcs-rule.alm-v-valid{font-style:normal;opacity:1;text-decoration:underline;
  text-decoration-thickness:.5px;text-underline-offset:2px}
.alm-pcs-rule.alm-v-invalid{text-decoration:line-through;opacity:1;font-style:normal}
.alm-pcs-rule.alm-v-unformalized{opacity:.5;text-decoration:underline;
  text-decoration-style:dotted;text-underline-offset:2px}
.alm-v-valid .alm-join-rule{font-style:normal;opacity:1;text-decoration:underline;
  text-decoration-thickness:.5px;text-underline-offset:2px}
.alm-v-invalid .alm-join-rule{text-decoration:line-through;opacity:1;font-style:normal}
/* Claimed, and nothing to check it against -- the state the fidelity history says will be the
   common one at first. Hollow rather than absent: it is a claim, it is simply unexamined. */
.alm-v-unformalized .alm-join-rule{opacity:.5;text-decoration:underline;
  text-decoration-style:dotted;text-underline-offset:2px}
.alm-explode{cursor:pointer}
.alm-explode rect{fill:var(--alm-node-bg,#fff);stroke:var(--alm-accent,#3a7bd5)}
.alm-explode text{fill:var(--alm-accent,#3a7bd5);font-weight:600;pointer-events:none}
.alm-explode:hover rect{fill:var(--alm-accent,#3a7bd5)}
.alm-explode:hover text{fill:#fff}
.alm-verdict{cursor:pointer}
.alm-verdict circle{fill:var(--alm-accent,#3a7bd5)}
.alm-verdict text{fill:#fff;font-weight:600;pointer-events:none}
.alm-verdict:hover circle{fill:#2b5fa8}
/* The countermodel, folded away until the badge is clicked. Monospace, because it is a list of
   assignments and a reader compares them column-wise. */
.alm-verdict-detail{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  fill:var(--alm-accent,#3a7bd5);opacity:.9;pointer-events:none}
/* The enclosure round the premises of one inference step: the Rationale convention, which draws
   what works together as one thing. A WASH WITH NO BORDER, deliberately -- a section's group box
   is already a dashed rectangle, and a second bordered rectangle a few pixels away would read as
   another section rather than as a different kind of grouping altogether. It takes no clicks:
   the fold control belongs to the argument, and a second thing to click here would be a second
   answer to a question that has one. */
.alm-hull{fill:var(--alm-hull,rgba(58,157,93,.075));stroke:none;pointer-events:none}
.alm-layer-hulls{pointer-events:none}
.alm-join-stem{fill:none;stroke-width:1.6}
/* A connection whose middle is folded away. Faint, because what it reports is real but partial:
   the two claims ARE related, and the claims that carry the relation are not on screen. */
.alm-e.is-through{opacity:.42;stroke-width:1}
.alm-underline{fill:none;stroke-width:1.2;stroke-dasharray:2.5 3;stroke-linecap:round;opacity:.6}
.alm-layer-under{pointer-events:none}
/* Lit from outside: the reader clicked the passage this claim was drawn from. A ring rather
   than a fill, so the fidelity border and the kind colour both still read. */
/* THE FOCUS RING MUST NOT TOUCH THE BORDER, and that is not a matter of taste. The box's stroke
   already carries FIDELITY -- solid for a quotation, dashed for an interpretation, dot-dashed
   for an imputation -- so a focus style that thickens or dashes it says something false about
   whose words the claim is in. An outline sits outside the shape and encodes nothing else. */
.alm-n:focus,.alm-toggle:focus{outline:none}
.alm-n:focus-visible,.alm-toggle:focus-visible{
  outline:2.5px solid var(--alm-accent,#3a7bd5);outline-offset:3px;border-radius:3px}
.alm-n.is-lit .alm-box{stroke:var(--alm-accent,#3a7bd5);stroke-width:2.4}
.alm-n.is-lit{filter:drop-shadow(0 0 6px rgba(58,123,213,.45))}
/* The box a hovered reference row names. Same voice as is-lit -- both mean "this one, here" --
   kept as its own class so a hover cannot fight the marks the reader has pinned. */
.alm-n.is-ref-target .alm-box{stroke:var(--alm-accent,#3a7bd5);stroke-width:2.4}
.alm-n.is-ref-target{filter:drop-shadow(0 0 6px rgba(58,123,213,.45))}
.alm-glabel{fill:var(--alm-fg-dim,#6b6b6b);pointer-events:none}
.alm-gwords{fill:var(--alm-fg-dim,#6b6b6b);opacity:.75;pointer-events:none;
  font-variant-numeric:tabular-nums}
.alm-g:hover .alm-gbox{stroke-width:1.8}
/* The box is a backdrop; the hit rect is what takes the click, so a band that holds other bands
   can offer only its name strip without changing what it looks like. */
.alm-gbox{pointer-events:none}
.alm-return{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:6;
  display:flex;align-items:stretch;border-radius:14px;max-width:60%;overflow:hidden;
  border:1px solid var(--alm-accent,#3a7bd5);background:var(--alm-bar-bg,rgba(255,255,255,.95));
  box-shadow:0 1px 6px rgba(0,0,0,.13)}
.alm-return[hidden]{display:none}
.alm-return button{font:12px system-ui,sans-serif;cursor:pointer;border:0;background:transparent;
  color:var(--alm-accent,#3a7bd5)}
.alm-return-go{padding:5px 10px 5px 12px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;min-width:0}
/* The dismissal is smaller and quieter than the offer: it is the second thing a reader wants. */
.alm-return-x{padding:5px 10px 5px 8px;font-size:13px;line-height:1;opacity:.62;
  border-left:1px solid rgba(58,123,213,.35)}
.alm-return-go:hover,.alm-return-x:hover{background:var(--alm-accent,#3a7bd5);color:#fff}
.alm-return-x:hover{opacity:1}
.alm-ghit{fill:transparent}
.alm-gfold{fill:transparent;cursor:pointer}
.alm-g.is-fixed .alm-gfold{pointer-events:none}
.alm-g.is-fixed .alm-ghit{pointer-events:none}
.alm-bar{position:absolute;left:8px;bottom:8px;display:flex;flex-wrap:wrap;gap:.5rem;
  align-items:center;font:11px system-ui,sans-serif;background:var(--alm-bar-bg,rgba(255,255,255,.92));
  border:1px solid var(--alm-group-line,#ddd);border-radius:7px;padding:.35rem .5rem;
  color:var(--alm-fg,#222)}
.alm-bar .alm-grp{display:flex;gap:.25rem;align-items:center}
/* THE "HOW MUCH" LADDER. Sized against the text beside it rather than left at the UA default,
   which is wide enough to push the rest of the bar off a narrow window on its own. */
.alm-bar input.alm-range{width:6.5rem;margin:0 .15rem;accent-color:var(--alm-accent,#3a7bd5);
  cursor:pointer;vertical-align:middle}
.alm-bar input.alm-range:focus-visible{outline:2px solid var(--alm-accent,#3a7bd5);
  outline-offset:2px;border-radius:3px}
.alm-bar .alm-rung{display:inline-flex;gap:.3rem;align-items:baseline;white-space:nowrap;
  min-width:6.2rem}
.alm-bar .alm-rung em{font-style:normal;font-weight:600}
/* The count rides beside the name, so the cost of a move is visible before it is made. */
.alm-bar .alm-rung i{font-style:normal;opacity:.6;font-variant-numeric:tabular-nums}
/* Bands shut by hand put the ladder off its rungs; the readout says so rather than claiming a
   setting that is not in force. */
.alm-bar .alm-rung.alm-off em{opacity:.5;font-weight:400}
.alm-bar .alm-rung.alm-off::after{content:"(bands set by hand)";opacity:.55}
/* ON A PHONE THE BAR WOULD COVER THE MAP. Wrapping is right on a wide window -- the groups stay
   whole and read as groups -- but at 375px it takes three rows and half the height. Capped to the
   viewport and scrolled sideways instead, which keeps it one row deep however much is in it.
   The rule lives HERE, with the bar it styles, because this sheet is injected after the host
   page's and a copy over there would lose to it. */
@media (max-width:560px){
  .alm-bar{max-width:calc(100vw - 1.6rem);flex-wrap:nowrap;overflow-x:auto;
    scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .alm-bar::-webkit-scrollbar{display:none}
  .alm-bar .alm-grp{flex:0 0 auto}
}
/* display:flex above beats the UA rule for [hidden], so setting .hidden on a group did nothing
   and a control the code had decided not to offer stayed on the toolbar. */
.alm-bar .alm-grp[hidden]{display:none}
.alm-bar b{font-weight:600;opacity:.6;margin-right:.15rem;text-transform:uppercase;
  letter-spacing:.05em;font-size:9px}
.alm-bar button{font:inherit;padding:.15rem .45rem;border:1px solid var(--alm-group-line,#ccc);
  background:transparent;border-radius:5px;cursor:pointer;color:inherit}
.alm-bar button:hover{border-color:#888}
.alm-bar button.on{border-color:var(--alm-accent,#3a7bd5);
  box-shadow:inset 0 0 0 1px var(--alm-accent,#3a7bd5)}
/* Counts ride on the buttons so a click can be judged before it is made — how many claims this
   step puts on screen, how many of this kind there are. Tabular figures so the row does not
   jitter as they change, and quiet enough to read past. */
.alm-bar button[data-count]:not([data-count=""])::after{content:attr(data-count);
  margin-left:.35rem;opacity:.5;font-variant-numeric:tabular-nums;font-size:10px}
.alm-bar button.on[data-count]::after{opacity:.75}
/* TWO KINDS OF CONTROL, TOLD APART BY SHAPE.
 *
 *   a SEGMENTED group  — "claims", "sections" — is one setting with two values. Exactly one is
 *                        in force, always; clicking the other moves the setting.
 *   a group of PILLS   — "kinds" — is a set of independent switches. Any number may be on, and
 *                        turning one off takes those claims off the map.
 *
 * They behaved differently from the start and looked identical, so which one you were using had
 * to be learned by clicking and watching. Now the segmented pair is joined into a single sunken
 * control, the way a radio switch is drawn everywhere else, and the pills stay separate. */
.alm-bar .alm-seg{gap:0;border:1px solid var(--alm-group-line,#ccc);border-radius:6px;
  overflow:hidden;padding:0}
.alm-bar .alm-seg b{padding:0 .4rem 0 .45rem}
.alm-bar .alm-seg button{border:0;border-radius:0;border-left:1px solid var(--alm-group-line,#ccc);
  padding:.15rem .5rem}
.alm-bar .alm-seg button.on{background:var(--alm-accent,#3a7bd5);color:#fff;box-shadow:none}
.alm-bar .alm-seg button.on[data-count]::after{opacity:.8}
.alm-bar .alm-seg button:hover:not(.on){background:rgba(0,0,0,.05)}
@media (prefers-color-scheme:dark){
  .alm-n .alm-box{fill:var(--alm-node-bg,#23262b)}
  .alm-toggle circle{fill:var(--alm-node-bg,#23262b)}
  .alm-explode rect{fill:var(--alm-node-bg,#23262b)}
  .alm-n .alm-title{fill:var(--alm-fg,#e8e8e8)}
  .alm-n .alm-text{fill:var(--alm-fg-dim,#aaa)}
  .alm-n .alm-pcs-text{fill:var(--alm-fg-dim,#aaa)}
  .alm-n .alm-pcs-row.is-conclusion .alm-pcs-text{fill:var(--alm-fg,#e8e8e8)}
  .alm-n .alm-pcs-num,.alm-n .alm-pcs-rule{fill:var(--alm-fg-faint,#7d7d7d)}
  .alm-n .alm-pcs-bar{stroke:var(--alm-fg-faint,#7d7d7d)}
  .alm-bar{background:var(--alm-bar-bg,rgba(30,32,36,.94))}
}`;
  document.head.appendChild(s);
}

/* ------------------------------------------------------------------ export */

/** Where to put the camera: scale and translation for a drawing of w x h in a cw x ch box.
 *
 *  PURE, and exported, because the bug it exists to prevent is arithmetic rather than DOM.
 *  The zoom is FLOORED at minScale so a book-scale map stays legible instead of washing out
 *  — and the framing then centred a drawing wider than the viewport, which puts the MIDDLE
 *  on screen and pushes the contention off the edge. Reported against the Carroll map: fold
 *  the sections, reopen them, and the main claim is simply gone with nothing to say where.
 *
 *  `stranded()` did not catch it. The drawing still overlapped the viewport by hundreds of
 *  pixels; only the one node that matters had left it. So when a dimension overflows, the
 *  apex goes there instead of the centre, clamped so the drawing's own edges never pull
 *  inside the frame.
 */
function frameFor(w, h, cw, ch, minScale, apex) {
  const want = Math.min(cw / (w + 32), ch / (h + 32), 1.4);
  const k = Math.max(minScale, want);
  let x = (cw - w * k) / 2;
  let y = (ch - h * k) / 2;
  if (apex && want < minScale) {
    const clamp = (v, lo, hi) => Math.max(Math.min(v, lo), hi);
    if (w * k > cw) x = clamp(cw / 2 - apex.x * k, 16, cw - 16 - w * k);
    if (h * k > ch) y = clamp(ch / 2 - apex.y * k, 16, ch - 16 - h * k);
  }
  return { k, x, y };
}


/* ------------------------------------------------------------------ the fold state identifier
 *
 * One line of text that names a fold state exactly, so a folding bug can be REPORTED as the
 * map plus this line and REBUILT instead of guessed at. The dump taught the lesson ("a trail
 * is not a reproducer"); this is the same lesson for the field, where nobody is running the
 * harness. It is an ENCODING, not a hash: a hash would identify the state and reconstruct
 * nothing. Equality of strings is equality of states, because the encoding is canonical —
 * every list sorted, every empty field omitted, one space between tokens.
 *
 *   ipsfold1 map=6b2c91e4 view=arg depth=2 folds=n12,n9 gf=n7:s2+s3
 *
 * `map=` is a fingerprint of the graph's STRUCTURE — node ids, edges, group ids — because
 * node ids are positional and the same ids on a different map would silently mean different
 * claims. Decoding against the wrong file refuses with both fingerprints rather than drawing
 * nonsense. Every id is percent-escaped, because lane names carry `|` and section paths carry
 * anything the author wrote.
 */

/** FNV-1a, 32 bits, as 8 hex digits. A mismatch alarm, not security. */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

/** The structural identity of a graph: what the identifier's ids are relative to. */
function mapFingerprint(graph) {
  const nodes = (graph.nodes || []).map(n => n.id).sort();
  const edges = (graph.edges || []).map(e => e.from + ">" + e.to + ":" + (e.type || "")).sort();
  const groups = (graph.groups || []).map(g => g.id).sort();
  return fnv1a(nodes.join(",") + "|" + edges.join(",") + "|" + groups.join(","));
}

const encId = id => encodeURIComponent(String(id));

/** Accepts the live state (Sets and a Map) and the dump's shape (arrays) alike, because the
 *  invariant harness and the About window must speak the same format or there are two. */
function encodeFoldState(graph, state) {
  const list = v => (v == null ? [] : Array.from(v));
  const sorted = v => list(v).map(encId).sort().join(",");
  const out = ["ipsfold1", "map=" + mapFingerprint(graph),
               "view=" + (state.byText ? "pos" : "arg")];
  if (state.depth != null) out.push("depth=" + state.depth);
  if (state.spine != null) out.push("spine=" + state.spine);
  const push = (key, v) => { const s = sorted(v); if (s) out.push(key + "=" + s); };
  push("sects", state.collapsedGroups);
  push("folds", state.collapsedNodes);
  push("opens", state.expandedNodes);
  const gf = list(state.groupFolded)
    .map(([k, v]) => [encId(k), list(v).map(encId).sort().join("+")])
    .filter(([, v]) => v)     // an empty active set suppresses nothing and is the same as absent
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => k + ":" + v).join(";");
  if (gf) out.push("gf=" + gf);
  push("lanes", state.collapsedLanes);
  // `facets` is three-valued: null means every facet (omitted), a set means only those, and an
  // EMPTY set really does hide every faceted claim — so it encodes as `facets=` with no value.
  if (state.facets != null) out.push("facets=" + sorted(state.facets));
  return out.join(" ");
}

/** The inverse. Returns a state in its NATIVE shape — Sets, and a Map of Sets — which is what
 *  `filterGraph` reads directly and what `setState` copies from; or throws one plain sentence
 *  saying what is wrong. Splitting on any whitespace forgives a line wrap between tokens; a
 *  wrap INSIDE a token cannot be forgiven and the id error below is what names it. */
function decodeFoldState(graph, text) {
  const toks = String(text).trim().split(/\s+/);
  if (toks[0] !== "ipsfold1")
    throw new Error('not a fold state identifier — it starts with "ipsfold1"');
  const nodeIds = new Set((graph.nodes || []).map(n => n.id));
  const groupIds = new Set((graph.groups || []).map(g => g.id));
  const laneIds = new Set();
  for (const n of graph.nodes || []) {
    const l = textLane(n);
    if (l !== "gutter") { laneIds.add(l); laneIds.add(laneChapter(l)); }
  }
  const facetIds = new Set((graph.nodes || []).map(n => n.facet).filter(Boolean));
  const seen = new Set();
  const fields = {};
  for (const t of toks.slice(1)) {
    const eq = t.indexOf("=");
    if (eq < 0) throw new Error('unrecognised token "' + t + '" — every field is key=value');
    const key = t.slice(0, eq);
    if (seen.has(key)) throw new Error('the field "' + key + '" appears twice');
    seen.add(key);
    fields[key] = t.slice(eq + 1);
  }
  const own = mapFingerprint(graph);
  if (fields.map !== own)
    throw new Error("this state belongs to a different map — it names " + fields.map +
                    " and this file is " + own);
  if (fields.view !== "arg" && fields.view !== "pos")
    throw new Error('view must be "arg" or "pos", not "' + fields.view + '"');
  const num = (key, min) => {
    if (!(key in fields)) return null;
    const n = Number(fields[key]);
    if (!Number.isInteger(n) || n < min)
      throw new Error(key + " must be an integer, not \"" + fields[key] + "\"");
    return n;
  };
  const ids = (key, known, what) => {
    if (!(key in fields)) return [];
    if (fields[key] === "") return [];
    return fields[key].split(",").map(s => {
      const id = decodeURIComponent(s);
      if (!known.has(id))
        throw new Error('"' + id + '" is not ' + what + " of this map — the fingerprint " +
                        "matches, so the identifier was probably damaged in transit");
      return id;
    });
  };
  const gf = [];
  if (fields.gf) for (const entry of fields.gf.split(";")) {
    const c = entry.indexOf(":");
    if (c < 0) throw new Error('gf entries are node:section+section — got "' + entry + '"');
    const k = decodeURIComponent(entry.slice(0, c));
    if (!nodeIds.has(k)) throw new Error('"' + k + '" is not a claim of this map');
    gf.push([k, entry.slice(c + 1).split("+").map(s => {
      const g = decodeURIComponent(s);
      if (!groupIds.has(g)) throw new Error('"' + g + '" is not a section of this map');
      return g;
    })]);
  }
  const known = ["map", "view", "depth", "spine", "sects", "folds", "opens", "gf", "lanes", "facets"];
  for (const key of seen) if (!known.includes(key))
    throw new Error('unknown field "' + key + '" — this identifier may come from a newer build');
  return {
    collapsedGroups: new Set(ids("sects", groupIds, "a section")),
    collapsedNodes:  new Set(ids("folds", nodeIds, "a claim")),
    expandedNodes:   new Set(ids("opens", nodeIds, "a claim")),
    groupFolded:     new Map(gf.map(([k, v]) => [k, new Set(v)])),
    collapsedLanes:  new Set(ids("lanes", laneIds, "a band")),
    depth:           num("depth", 0),
    spine:           num("spine", 0),
    byText:          fields.view === "pos",
    facets:          "facets" in fields ? new Set(ids("facets", facetIds, "a facet")) : null
  };
}

const API = { createLiveMap, filterGraph, frameFor, maxDepth, index, loadOf,
              membersOfGroup, reduceFold,
              encodeFoldState, decodeFoldState, mapFingerprint,
              layoutByText, posKey, sanitiseGraph, overlapsAnywhere, textLane, laneChapter,
              hiddenSpans, drawnPolyline, segmentHitsBox, boxesOf, junctionGeometry,
              junctionFeet, retargetTail, slalomFlips, pcsRows, premiseHull,
              layoutByArgument, clearOfBadge, offsetPastBadge,
              arrivalPorts, departurePorts, slotOffsets, straightenIfSafe, bowOf,
              edgeGeometry,
              directionFractions,
              circleCrossing,
              BADGE_R, BADGE_CLEAR, BADGE_SIDE };
if (typeof module !== "undefined" && module.exports) module.exports = API;
/** @type {any} */ (global).ArgdownLiveMap = API;

})(typeof globalThis !== "undefined" ? globalThis : this);
