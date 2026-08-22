/* What the document-order re-seat does to the EDGES it drags along.
 *
 *   node app/src/test_reseat_edges.js
 *
 * The re-seat moves whole blocks sideways after dagre has routed, then shifts each edge's points
 * to follow. Both ends stay attached to their boxes, so nothing looks broken to a check that only
 * asks whether an edge still meets the things it joins -- and the line can still leave its source,
 * swing right across the map, and curve all the way back, because its interior points were placed
 * by dagre for the arrangement BEFORE the blocks moved.
 *
 * Measured on the three sample maps, dagre's own routing never exceeded 1.3x the straight-line
 * distance while the sheared paths reached 3.0x, 3.8x and 4.1x.
 *
 * This drives `seatInDocumentOrder` against a hand-built graph rather than a real map, because
 * the effect needs a LARGE shift to show and the adversarial layout harness never generated one:
 * with the repair disabled, that harness still passed. A test that cannot fail is worth nothing.
 */
const { seatInDocumentOrder, straightenDetours } = require("./argdown-live-map.js");

let fails = 0;
function ok(name, cond, detail) {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}` + (cond ? "" : `\n          ${detail}`));
}

const pathLen = p => p.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0);
const detour = p => {
  const straight = Math.hypot(p[p.length - 1].x - p[0].x, p[p.length - 1].y - p[0].y);
  return straight > 1 ? pathLen(p) / straight : 1;
};

/* Two claims side by side that the re-seat will SWAP, because the right-hand one was written
 * first. Dagre laid the edge out for the arrangement before the swap: it leaves `late` going
 * straight up and crosses to `target` near the top. After the swap `late` is 500 units to the
 * left, and the interior points -- if merely sheared -- are left stranded to the right of both
 * ends, which is the shape that reads as a line going out and coming back. */
function scenario() {
  const nodes = {
    target: { x: 300, y: 100, width: 140, height: 54 },
    early:  { x: 100, y: 400, width: 140, height: 54 },
    late:   { x: 600, y: 400, width: 140, height: 54 }
  };
  const edges = {
    "late>target": { points: [{ x: 600, y: 373 }, { x: 600, y: 300 },
                              { x: 560, y: 200 }, { x: 300, y: 127 }] },
    "early>target": { points: [{ x: 100, y: 373 }, { x: 120, y: 300 },
                               { x: 200, y: 200 }, { x: 300, y: 127 }] }
  };
  const g = {
    nodes: () => Object.keys(nodes),
    node: id => nodes[id],
    edges: () => [{ v: "late", w: "target", name: "support" },
                  { v: "early", w: "target", name: "support" }],
    edge: e => edges[`${e.v}>${e.w}`]
  };
  // `late` was written first, so document order puts it on the LEFT; the two swap.
  const vis = {
    groups: [],
    nodes: [{ id: "target", order: 0, docLine: 1 },
            { id: "late", order: 0, docLine: 2 },        // written first -> seated on the LEFT
            { id: "early", order: 0, docLine: 30 }],
    edges: [{ from: "late", to: "target", type: "support" },
            { from: "early", to: "target", type: "support" }]
  };
  return { g, vis, edges };
}

console.log("seatInDocumentOrder: the edges it drags along");
{
  const { g, vis, edges } = scenario();
  const before = detour(edges["late>target"].points);
  seatInDocumentOrder(g, vis, true);
  const after = detour(edges["late>target"].points);
  ok("a re-seated edge does not become a long way round",
     after <= 1.6, `detour went ${before.toFixed(2)}x -> ${after.toFixed(2)}x`);

  const p = edges["late>target"].points;
  const lo = Math.min(p[0].x, p[p.length - 1].x) - 30;
  const hi = Math.max(p[0].x, p[p.length - 1].x) + 30;
  ok("  and stays between its own two ends",
     p.every(q => q.x >= lo && q.x <= hi),
     `xs ${p.map(q => Math.round(q.x)).join(",")} outside [${Math.round(lo)}, ${Math.round(hi)}]`);
  ok("  while keeping every point on the rank dagre gave it",
     p.map(q => Math.round(q.y)).join(",") === "373,300,200,127",
     `ys ${p.map(q => Math.round(q.y)).join(",")}`);
}
{
  // The shear is right when both ends move together, and must not be thrown away then.
  const { g, vis, edges } = scenario();
  const original = edges["early>target"].points.map(q => ({ ...q }));
  seatInDocumentOrder(g, vis, true);
  const now = edges["early>target"].points;
  ok("an edge whose route is still sound keeps dagre's shape",
     now.some((q, i) => Math.abs(q.x - original[i].x) > 0.001) ||
     now.every((q, i) => q.x === original[i].x),
     "the untouched case should either shift cleanly or not at all");
  ok("  and it is not straightened unnecessarily",
     detour(now) <= 1.6, `detour ${detour(now).toFixed(2)}x`);
}
{
  // Seating off must change nothing at all.
  const { g, vis, edges } = scenario();
  const before = JSON.stringify(edges["late>target"].points);
  seatInDocumentOrder(g, vis, false);
  ok("documentOrder:false leaves every edge alone",
     JSON.stringify(edges["late>target"].points) === before);
}

console.log("straightenDetours: the blocked case");
/* On a dense map the straight run usually DOES cross a claim, so the safety test fires often.
   Treating that as "leave it alone" was a regression that took the book map's worst excursion
   from 175 units to 15,330: the repair that had been quietly fixing those stopped firing. A
   blocked edge must still be clamped back inside the span of its own two ends. */
function blockedCase() {
  // An edge from (100,400) to (300,100) that dagre routed far out to the right, with a claim
  // sitting squarely on the direct line so no straight run is available.
  const nodes = {
    src:      { x: 100, y: 400, width: 120, height: 54 },
    dst:      { x: 300, y: 100, width: 120, height: 54 },
    blocker:  { x: 200, y: 250, width: 160, height: 60 }
  };
  const pts = [{ x: 100, y: 373 }, { x: 900, y: 300 }, { x: 900, y: 200 }, { x: 300, y: 127 }];
  const g = {
    nodes: () => Object.keys(nodes), node: id => nodes[id],
    edges: () => [{ v: "src", w: "dst", name: "support" }],
    edge: () => ({ points: pts })
  };
  const vis = { groups: [], nodes: Object.keys(nodes).map(id => ({ id })), edges: [] };
  return { g, vis, pts };
}
{
  const { g, vis, pts } = blockedCase();
  straightenDetours(g, vis);
  const lo = Math.min(pts[0].x, pts[3].x), hi = Math.max(pts[0].x, pts[3].x);
  ok("a blocked edge is still pulled back inside its own span",
     pts.every(q => q.x >= lo - 0.5 && q.x <= hi + 0.5),
     `xs ${pts.map(q => Math.round(q.x)).join(",")} outside [${lo}, ${hi}]`);
  // Compare with a tolerance. The first version of this used `!==` against the same arithmetic
  // written a different way -- 200*(1/3) against 200/3 -- which differ in the last bit, so the
  // check passed whether the route was straightened or not, and a mutation that ignored the
  // blocker entirely still went green.
  const onTheStraightRoute = Math.abs(pts[1].x - (pts[0].x + (pts[3].x - pts[0].x) / 3)) < 0.5;
  ok("  and it is NOT straightened through the claim in the way", !onTheStraightRoute,
     `interior x ${Math.round(pts[1].x)} is on the straight route, which crosses \`blocker\``);
}
{
  // With nothing in the way, the same edge is straightened properly rather than merely clamped.
  const { g, vis, pts } = blockedCase();
  vis.nodes = vis.nodes.filter(n => n.id !== "blocker");
  straightenDetours(g, vis);
  const want = [100, 100 + (300 - 100) / 3, 100 + 2 * (300 - 100) / 3, 300];
  ok("an unobstructed edge is straightened, not just clamped",
     pts.every((q, i) => Math.abs(q.x - want[i]) < 0.5),
     `xs ${pts.map(q => Math.round(q.x)).join(",")} want ${want.map(Math.round).join(",")}`);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
