/* Headless tests for the pure filter in argdown-live-map.js.
 *
 *   node app/src/test_argdown_live_map.js
 *
 * The filter is the part that can silently go wrong — a fold that drops a whole branch, or an
 * edge left pointing at a node that is no longer on screen — and it is the one part that needs
 * no browser to check. Run it after any change to the fold logic.
 */
const { filterGraph, maxDepth } = require("./argdown-live-map.js");

/* A miniature of the book's shape: one main claim, two Parts as groups, a survey claim to
 * filter on, and an attack so the relation types are exercised. */
const GRAPH = {
  groups: [{ id: "p1", label: "Part One" }, { id: "p2", label: "Part Two" }],
  nodes: [
    { id: "root", label: "Cultural naturalism", facet: "claim" },
    { id: "a1", label: "Symbols are natural", group: "p1", facet: "claim" },
    { id: "a2", label: "But meaning resists", group: "p1", facet: "claim" },
    { id: "a3", label: "Durkheim's account",  group: "p1", facet: "survey" },
    { id: "b1", label: "Ritual sustains value", group: "p2", facet: "claim" },
    { id: "b2", label: "Anomie is its failure", group: "p2", facet: "claim" }
  ],
  edges: [
    { from: "a1", to: "root", type: "support" },
    { from: "a2", to: "root", type: "attack"  },
    { from: "b1", to: "root", type: "support" },
    { from: "a3", to: "a1",   type: "support" },
    { from: "b2", to: "b1",   type: "support" }
  ]
};

let failures = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}` +
              (ok ? "" : `\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
}
const ids = v => v.nodes.map(n => n.id).sort();
const S = (o = {}) => Object.assign(
  { collapsedGroups: new Set(), collapsedNodes: new Set(), expandedNodes: new Set(),
    depth: null, facets: null }, o);

/** The invariant that matters most: never leave an edge pointing at something not drawn. */
function checkClosed(name, vis) {
  const present = new Set(vis.nodes.map(n => n.id));
  const bad = vis.edges.filter(e => !present.has(e.from) || !present.has(e.to));
  check(name + ": edges closed over visible nodes", bad, []);
}

console.log("\nmaxDepth");
check("deepest chain is 2", maxDepth(GRAPH), 2);

console.log("\nunfiltered");
{
  const v = filterGraph(GRAPH, S());
  check("all six nodes", ids(v), ["a1", "a2", "a3", "b1", "b2", "root"]);
  check("all five edges", v.edges.length, 5);
  check("both groups survive", v.groups.map(g => g.id).sort(), ["p1", "p2"]);
  check("nothing marked hidden", v.nodes.filter(n => n.hidden).length, 0);
  checkClosed("unfiltered", v);
}

console.log("\ndepth");
{
  const v0 = filterGraph(GRAPH, S({ depth: 0 }));
  check("depth 0 -> main claim only", ids(v0), ["root"]);
  check("depth 0 -> no edges", v0.edges.length, 0);
  check("depth 0 -> root reports 3 hidden", v0.nodes[0].hidden, 3);
  checkClosed("depth 0", v0);

  const v1 = filterGraph(GRAPH, S({ depth: 1 }));
  check("depth 1 -> main reasons", ids(v1), ["a1", "a2", "b1", "root"]);
  check("depth 1 -> three edges", v1.edges.length, 3);
  check("depth 1 -> a1 hides one", v1.nodes.find(n => n.id === "a1").hidden, 1);
  checkClosed("depth 1", v1);

  const v9 = filterGraph(GRAPH, S({ depth: 9 }));
  check("depth beyond the graph == everything", ids(v9), ids(filterGraph(GRAPH, S())));
}

console.log("\nfold a node's subtree");
{
  const v = filterGraph(GRAPH, S({ collapsedNodes: new Set(["a1"]) }));
  check("a3 is gone", ids(v), ["a1", "a2", "b1", "b2", "root"]);
  check("a1 marked collapsed", v.nodes.find(n => n.id === "a1").collapsed, true);
  check("a1 reports one hidden", v.nodes.find(n => n.id === "a1").hidden, 1);
  check("four edges remain", v.edges.length, 4);
  checkClosed("folded node", v);
}

console.log("\nfold a group");
{
  const v = filterGraph(GRAPH, S({ collapsedGroups: new Set(["p1"]) }));
  check("Part One became one node", ids(v), ["b1", "b2", "group:p1", "root"].sort());
  const g = v.nodes.find(n => n.id === "group:p1");
  check("folded node is labelled with the heading", g.label, "Part One");
  check("folded node counts what it hides", g.detail, "3 claims");
  check("folded node keeps its group id", g.groupId, "p1");
  check("p1 no longer drawn as a cluster", v.groups.map(x => x.id), ["p2"]);
  // a1->root (support) and a2->root (attack) both survive as distinct relations;
  // a3->a1 was internal to the group and must not become a self-edge.
  check("internal edge dropped, both externals kept", v.edges.length, 4);
  check("no self-edge", v.edges.filter(e => e.from === e.to), []);
  checkClosed("folded group", v);
}

console.log("\nfold both groups");
{
  const v = filterGraph(GRAPH, S({ collapsedGroups: new Set(["p1", "p2"]) }));
  check("two folded nodes plus the root", ids(v), ["group:p1", "group:p2", "root"]);
  check("no clusters left", v.groups, []);
  checkClosed("both folded", v);
}

console.log("\nopening a node past the depth limit");
{
  // The bug this guards: at depth 1 a claim shows "+1", but clicking it only toggled a
  // collapsed-set the node was not in, so nothing happened and the control looked broken.
  const base = filterGraph(GRAPH, S({ depth: 1 }));
  check("a1 reports one hidden at depth 1", base.nodes.find(n => n.id === "a1").hidden, 1);

  const opened = filterGraph(GRAPH, S({ depth: 1, expandedNodes: new Set(["a1"]) }));
  check("opening a1 reveals its child past the depth limit", ids(opened),
        ["a1", "a2", "a3", "b1", "root"]);
  check("a1 now reports nothing hidden", opened.nodes.find(n => n.id === "a1").hidden, 0);
  check("its sibling stays shut", opened.nodes.find(n => n.id === "b1").hidden, 1);
  checkClosed("expanded past depth", opened);

  // ...and closing it again must actually close it.
  const shut = filterGraph(GRAPH, S({ depth: 1, collapsedNodes: new Set(["a1"]) }));
  check("closing it again hides the child", ids(shut), ["a1", "a2", "b1", "root"]);
}

console.log("\nfacet filter");
{
  const v = filterGraph(GRAPH, S({ facets: new Set(["claim"]) }));
  check("survey claim removed", ids(v), ["a1", "a2", "b1", "b2", "root"]);
  check("its edge removed too", v.edges.length, 4);
  checkClosed("facet", v);

  const only = filterGraph(GRAPH, S({ facets: new Set(["survey"]) }));
  check("survey alone still renders", ids(only), ["a3"]);
  checkClosed("survey only", only);
}

console.log("\ncombined: depth + facet + fold");
{
  const v = filterGraph(GRAPH, S({
    depth: 1, facets: new Set(["claim"]), collapsedGroups: new Set(["p2"])
  }));
  check("root, Part One's two, Part Two folded", ids(v), ["a1", "a2", "group:p2", "root"]);
  checkClosed("combined", v);
}

console.log("\nawkward inputs");
{
  check("empty graph", filterGraph({ nodes: [], edges: [] }, S()).nodes, []);

  const dangling = { nodes: [{ id: "x", label: "X" }], edges: [{ from: "x", to: "ghost" }] };
  const v = filterGraph(dangling, S());
  check("edge to a missing node is dropped", v.edges, []);
  check("the real node survives", ids(v), ["x"]);

  // A cycle has no root at all; nothing may vanish because of that.
  const cyclic = {
    nodes: [{ id: "c1", label: "C1" }, { id: "c2", label: "C2" }],
    edges: [{ from: "c1", to: "c2", type: "support" }, { from: "c2", to: "c1", type: "attack" }]
  };
  check("a pure cycle still renders both nodes", ids(filterGraph(cyclic, S())), ["c1", "c2"]);
  checkClosed("cycle", filterGraph(cyclic, S()));

  // Two claims sharing a reason: the shared node must survive folding one parent.
  const shared = {
    nodes: [{ id: "r", label: "R" }, { id: "p", label: "P" }, { id: "q", label: "Q" },
            { id: "s", label: "S" }],
    edges: [{ from: "p", to: "r" }, { from: "q", to: "r" },
            { from: "s", to: "p" }, { from: "s", to: "q" }]
  };
  const sv = filterGraph(shared, S({ collapsedNodes: new Set(["p"]) }));
  check("shared reason survives via the other parent", ids(sv), ["p", "q", "r", "s"]);
  checkClosed("shared", sv);
}

/* ---- stepwise expansion: opening a fold reveals ONE level, not the whole subtree ----
 *
 * These assert the STATE that createLiveMap's toggleGroup/toggleNode now produce, since the
 * toggles themselves need a DOM. The rule they encode: when something is opened, whatever it
 * reveals is itself folded, so the next click descends exactly one more level. */
{
  // g1 holds a four-deep chain; the section is folded to start with.
  const deep = {
    nodes: [{ id: "root", label: "root" },
            { id: "a", label: "a", group: "g1" }, { id: "b", label: "b", group: "g1" },
            { id: "c", label: "c", group: "g1" }, { id: "d", label: "d", group: "g1" }],
    edges: [{ from: "a", to: "root" }, { from: "b", to: "a" },
            { from: "c", to: "b" }, { from: "d", to: "c" }],
    groups: [{ id: "g1", label: "Section", parent: null }]
  };
  const inGroup = gid => deep.nodes.filter(n => n.group === gid).map(n => n.id);
  const childIds = id => deep.edges.filter(e => e.to === id).map(e => e.from);

  const folded = filterGraph(deep, S({ collapsedGroups: new Set(["g1"]) }));
  check("section folded shows the root and one group box", ids(folded), ["group:g1", "root"]);

  // OLD behaviour, kept as the contrast: clearing the group alone reveals the lot.
  check("clearing the group alone would reveal everything",
        ids(filterGraph(deep, S())), ["a", "b", "c", "d", "root"]);

  // NEW: toggleGroup folds every member as it opens the section.
  const afterGroup = S({ collapsedNodes: new Set(inGroup("g1")) });
  check("opening a section reveals only its entry claim",
        ids(filterGraph(deep, afterGroup)), ["a", "root"]);
  check("that claim advertises what is still hidden",
        filterGraph(deep, afterGroup).nodes.find(n => n.id === "a").hidden, 1);

  // NEW: toggleNode un-folds one node and folds what it reveals.
  const n2 = new Set(inGroup("g1")); n2.delete("a"); childIds("a").forEach(c => n2.add(c));
  const afterNode = S({ collapsedNodes: n2, expandedNodes: new Set(["a"]) });
  check("opening a claim descends exactly one level",
        ids(filterGraph(deep, afterNode)), ["a", "b", "root"]);
  checkClosed("stepwise", filterGraph(deep, afterNode));

  // Re-folding and re-opening the section must not undo the reader's own expansions:
  // foldNext skips anything sitting in expandedNodes.
  const foldNext = (collapsed, list, expanded) => {
    for (const id of list) if (!expanded.has(id)) collapsed.add(id);
    return collapsed;
  };
  const expanded = new Set(["a", "b"]);          // reader has opened a, then b
  let collapsed = foldNext(new Set(), inGroup("g1"), expanded);   // now re-opens the section
  check("re-opening a section leaves hand-opened claims open",
        ids(filterGraph(deep, S({ collapsedNodes: collapsed, expandedNodes: expanded }))),
        ["a", "b", "c", "root"]);
  check("but its unopened claims stay folded",
        filterGraph(deep, S({ collapsedNodes: collapsed, expandedNodes: expanded }))
          .nodes.find(n => n.id === "c").hidden, 1);
}


/* ---------------------------------------------------------------------------
   Expanding must never make other parts of the map disappear.

   Reported from the Williams map twice over. First: with every section folded, clicking the
   circle on "The verdict" left ONE node on screen out of six blocks — the apex of that map
   sits in that section, and folding it stopped the traversal at the root. Then, after a first
   fix: opening Part 1 of the book unfurled five levels instead of one.

   Both come of there being only one kind of fold. `groupFolded` is the second: it hides a
   section's own claims while the walk still passes THROUGH them to whatever lies beyond, which
   is what "hide this section" should have meant all along.

   The state space is swept properly by argdown-tools/test_fold_invariants.mjs; this fixture
   pins the shape so a regression is legible here too.
--------------------------------------------------------------------------- */
{
  const { reduceFold, membersOfGroup } = require("./argdown-live-map.js");
  const g = {
    nodes: [
      { id: "apex",  label: "apex",  group: "g1" },
      { id: "vsub",  label: "vsub",  group: "g1" },
      { id: "other", label: "other", group: "g2" },
      { id: "deep",  label: "deep",  group: "g2" }
    ],
    edges: [
      { from: "vsub",  to: "apex",  type: "support" },   // reason inside g1
      { from: "other", to: "apex",  type: "support" },   // reason OUTSIDE g1
      { from: "deep",  to: "other", type: "support" }
    ],
    groups: [{ id: "g1", label: "Verdict" }, { id: "g2", label: "Other" }]
  };
  const represented = vis => {
    const out = new Set();
    for (const n of vis.nodes) {
      if (n.kind === "group" && n.groupId) membersOfGroup(g, n.groupId).forEach(x => out.add(x));
      else out.add(n.id);
    }
    return out;
  };
  const start = { collapsedGroups: new Set(["g1", "g2"]), collapsedNodes: new Set(),
                  expandedNodes: new Set(), groupFolded: new Map(), depth: null, facets: null };
  const before = filterGraph(g, start);
  check("as opened, two section blocks", ids(before), ["group:g1", "group:g2"]);

  const opened = reduceFold(g, start, { type: "toggleGroup", id: "g1" }, before, {});
  const after = filterGraph(g, opened);

  check("opening a section shows its entry claim", ids(after).includes("apex"), true);
  check("and the other section survives as a block", ids(after).includes("group:g2"), true);
  check("the section's deeper claim is folded away, and advertised",
        after.nodes.find(n => n.id === "apex").hidden, 1);
  check("nothing outside the opened section is lost",
        [...represented(before)].filter(x => !membersOfGroup(g, "g1").includes(x))
          .every(x => represented(after).has(x)), true);
  check("only one level of the section is on screen",
        after.nodes.filter(n => membersOfGroup(g, "g1").includes(n.id)).length, 1);

  // Closing it again restores the block, and drops the marks it owned.
  const closed = reduceFold(g, opened, { type: "toggleGroup", id: "g1" }, after, {});
  check("closing the section restores the original view",
        ids(filterGraph(g, closed)), ["group:g1", "group:g2"]);
  check("and leaves no fold marks behind", closed.groupFolded.size, 0);
}

console.log(failures ? `\n${failures} FAILURE(S)\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
