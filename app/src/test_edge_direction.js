/* Headless tests for the two pieces of edge-direction geometry in argdown-live-map.js.
 *
 *   node app/src/test_edge_direction.js
 *
 * WHY THIS EXISTS. Ten of the twenty-five arrowheads on the Darwin map were drawn at distance
 * 0.0px from a fold badge's centre and were therefore invisible under it, and nothing caught it:
 * the layout was correct, the path was correct, the marker was correct, and the picture was
 * wrong. The fix is arithmetic, so the check can be arithmetic too.
 *
 * The invariant that matters is one line: AFTER TRIMMING, THE ENDPOINT IS OUTSIDE THE DISC. The
 * rest of these cases are the ways that can be got wrong -- an endpoint dragged past the start,
 * a path emptied of points, a degenerate segment dividing by zero, a badge the line never goes
 * near being charged for anyway.
 */
const { clearOfBadge, offsetPastBadge, circleCrossing, directionFractions,
        arrivalPorts, departurePorts, slotOffsets, straightenIfSafe, segmentHitsBox,
        BADGE_R, BADGE_CLEAR, BADGE_SIDE } = require("./argdown-live-map.js");

let failures = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}` +
              (ok ? "" : `\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
}
function ok(name, cond, detail) {
  if (!cond) failures++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}` + (cond ? "" : `\n          ${detail}`));
}

const R = BADGE_R + BADGE_CLEAR;
const dist = (p, c) => Math.hypot(p.x - c.x, p.y - c.y);
const last = a => a[a.length - 1];

console.log("straightenIfSafe");
/* THE `)(` SHAPE. dagre routes an edge towards the middle of its target's bottom edge; the port
   then moves the arrival out to a corner, and the interior points stay where they were, so the
   line bulges inward and comes back out. Two arrivals at one box made a pair of facing brackets
   under it. Straightening has to run AFTER the port is applied, which is the whole point. */
const clearOfEverything = [];
{
  const bulged = [{ x: 100, y: 400 }, { x: 300, y: 300 }, { x: 300, y: 200 }, { x: 180, y: 100 }];
  const out = straightenIfSafe(bulged, clearOfEverything, new Set());
  ok("a bulging path with nothing in the way is straightened", !!out);
  if (out) {
    const a = out[0], b = out[out.length - 1];
    const off = out.slice(1, -1).map(p =>
      Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y));
    ok("  and every interior point lands on the straight line", Math.max(...off) < 0.001,
       `worst offset ${Math.max(...off).toFixed(2)}`);
    ok("  while both ends stay exactly where they were",
       a.x === 100 && a.y === 400 && b.x === 180 && b.y === 100);
  }
}
{
  // A claim sitting on the direct line is a reason dagre bent the edge in the first place.
  const bulged = [{ x: 100, y: 400 }, { x: 300, y: 300 }, { x: 300, y: 200 }, { x: 180, y: 100 }];
  const blocker = [{ id: "b", x0: 110, x1: 190, y0: 230, y1: 290 }];
  check("a path whose straight run crosses a claim is left bent",
        straightenIfSafe(bulged, blocker, new Set()), null);
  check("  unless that claim is one of its own two ends",
        straightenIfSafe(bulged, blocker, new Set(["b"])) === null, false);
}
{
  // Genuinely near-straight: on the line from (100,400) to (180,100), y=300 falls at x=126.7,
  // so 128 is about 1.2 units off -- well under the 6-unit threshold. (The first version of this
  // fixture used 141, which is 13.8 off, and the code was right to straighten it.)
  const nearlyStraight = [{ x: 100, y: 400 }, { x: 128, y: 300 }, { x: 180, y: 100 }];
  check("an already-straight path is left alone rather than re-pointed",
        straightenIfSafe(nearlyStraight, clearOfEverything, new Set()), null);
  check("a two-point path has no interior to straighten",
        straightenIfSafe([{ x: 0, y: 0 }, { x: 10, y: 10 }], clearOfEverything, new Set()), null);
}

console.log("segmentHitsBox");
{
  const box = { id: "x", x0: 100, x1: 200, y0: 100, y1: 200 };
  ok("a segment through the middle hits", segmentHitsBox({ x: 0, y: 150 }, { x: 300, y: 150 }, box, 0));
  ok("one passing well clear does not",
     !segmentHitsBox({ x: 0, y: 400 }, { x: 300, y: 400 }, box, 0));
  ok("one stopping short does not",
     !segmentHitsBox({ x: 0, y: 150 }, { x: 80, y: 150 }, box, 0));
  ok("the margin counts as a hit",
     segmentHitsBox({ x: 0, y: 96 }, { x: 300, y: 96 }, box, 6));
}

console.log("slotOffsets");
check("one arrival sits at the left-hand slot", slotOffsets(1, 80, 20).map(Math.round), [-72]);
check("two are seated one each side", slotOffsets(2, 80, 20).map(Math.round), [-72, 72]);
check("four are spread evenly", slotOffsets(4, 80, 20).map(Math.round), [-72, -37, 37, 72]);
ok("no slot ever falls under the badge",
   [1, 2, 3, 5, 8].every(n => slotOffsets(n, 80, 20).every(o => Math.abs(o) >= 20)),
   JSON.stringify(slotOffsets(5, 80, 20).map(Math.round)));
ok("a narrow box still yields usable slots",
   slotOffsets(3, 24, 20).every(o => Number.isFinite(o)),
   JSON.stringify(slotOffsets(3, 24, 20)));

console.log("arrivalPorts");
/* THE CROSSING THE AUTHOR SPOTTED. Two claims feed one box; the left-hand one was landing to the
   right of the badge and the right-hand one to the left, so they crossed just below the node for
   no reason at all. Seating arrivals in the order their sources sit in cannot produce that. */
function twoArrivals(leftEndsRight) {
  const nodes = { tgt: { x: 300, y: 100, width: 160, height: 54 },
                  L:   { x: 100, y: 300, width: 100, height: 54 },
                  R:   { x: 520, y: 300, width: 100, height: 54 } };
  // As dagre left them: the left source arriving right of centre, and vice versa.
  const pts = { L: [{ x: 100, y: 273 }, { x: leftEndsRight ? 340 : 260, y: 127 }],
                R: [{ x: 520, y: 273 }, { x: leftEndsRight ? 260 : 340, y: 127 }] };
  const g = { nodes: () => Object.keys(nodes), node: id => nodes[id],
              edges: () => [{ v: "L", w: "tgt", name: "support" },
                            { v: "R", w: "tgt", name: "support" }],
              edge: e => ({ points: pts[e.v] }) };
  const sizes = new Map(Object.entries(nodes).map(([k, v]) => [k, { width: v.width, height: v.height }]));
  const vis = { nodes: Object.keys(nodes).map(id => ({ id })) };
  return { g, vis, sizes };
}
{
  const { g, vis, sizes } = twoArrivals(true);
  const ports = arrivalPorts(g, vis, sizes, BADGE_SIDE);
  const L = ports.get("L tgt support"), R = ports.get("R tgt support");
  ok("the left-hand source is seated left of the right-hand one", L && R && L.x < R.x,
     `L at ${L && Math.round(L.x)}, R at ${R && Math.round(R.x)}`);
  ok("  and both clear the badge",
     Math.abs(L.x - 300) >= BADGE_SIDE && Math.abs(R.x - 300) >= BADGE_SIDE,
     `offsets ${Math.round(L.x - 300)}, ${Math.round(R.x - 300)}`);
  ok("  both land on the box's bottom edge", L.y === 127 && R.y === 127);
}
{
  // A single arrival is left to the badge rules; ports must not seize it.
  const { g, vis, sizes } = twoArrivals(true);
  g.edges = () => [{ v: "L", w: "tgt", name: "support" }];
  check("one arrival is left alone", arrivalPorts(g, vis, sizes, BADGE_SIDE).size, 0);
}
{
  /* THE CORNER DIVE. Seating used to re-space the fan evenly across the whole face, so a
     nearly-vertical arrival was flung to the box's far corner to fill a slot -- on the Miller
     map, <Deriving the limit>'s conclusion dived 136 units left, across its own departure fan
     (reported from use). Ports now PERMUTE the landing points dagre already chose, the same
     economy departurePorts has always used, so an edge already in its correct place barely
     moves. The order and the badge clearance are still owed, and still paid. */
  const { g, vis, sizes } = twoArrivals(false);        // already in order: L at 260, R at 340
  const ports = arrivalPorts(g, vis, sizes, BADGE_SIDE);
  const L = ports.get("L tgt support"), R = ports.get("R tgt support");
  ok("an arrival already in its place stays close to it",
     Math.abs(L.x - 260) <= BADGE_SIDE && Math.abs(R.x - 340) <= BADGE_SIDE,
     `L moved to ${Math.round(L.x)}, R to ${Math.round(R.x)}`);
  ok("  order and badge clearance still hold",
     L.x < R.x && Math.abs(L.x - 300) >= BADGE_SIDE && Math.abs(R.x - 300) >= BADGE_SIDE);
  // Both piled on one point: they must come apart, not share an arrowhead.
  const piled = twoArrivals(false);
  const pts = { L: [{ x: 100, y: 273 }, { x: 310, y: 127 }],
                R: [{ x: 520, y: 273 }, { x: 312, y: 127 }] };
  piled.g.edge = e => ({ points: pts[e.v] });
  const p2 = arrivalPorts(piled.g, piled.vis, piled.sizes, BADGE_SIDE);
  ok("two arrivals on one point are pulled apart",
     Math.abs(p2.get("L tgt support").x - p2.get("R tgt support").x) >= 10,
     `${Math.round(p2.get("L tgt support").x)} vs ${Math.round(p2.get("R tgt support").x)}`);
}
{
  // AN ARRIVAL NEED NOT BE EXACTLY ON THE BOTTOM EDGE. dagre clips a steeply-approaching edge to
  // the box boundary, so it meets the lower-left or lower-right SIDE instead. Requiring the edge
  // itself skipped five of the eight arrivals at the Gettier map's apex -- and left them crossing.
  const { g, vis, sizes } = twoArrivals(true);
  const sides = { L: [{ x: 100, y: 273 }, { x: 225, y: 110 }],   // lower-left corner of the box
                  R: [{ x: 520, y: 273 }, { x: 375, y: 110 }] };  // lower-right corner
  g.edge = e => ({ points: sides[e.v] });
  const ports = arrivalPorts(g, vis, sizes, BADGE_SIDE);
  check("an arrival on the box's lower SIDE is seated too", ports.size, 2);
  ok("  and still in source order",
     ports.get("L tgt support").x < ports.get("R tgt support").x);
}
{
  // The exposition view sends edges in from every side, including the top, where a bottom-edge
  // slot would mean nothing.
  const { g, vis, sizes } = twoArrivals(true);
  const above = { L: [{ x: 100, y: 20 }, { x: 260, y: 73 }],      // arriving at the TOP edge
                  R: [{ x: 520, y: 20 }, { x: 340, y: 73 }] };
  g.edge = e => ({ points: above[e.v] });
  check("an arrival at the top of the box is left alone",
        arrivalPorts(g, vis, sizes, BADGE_SIDE).size, 0);
}

console.log("departurePorts");
/* THE MIRROR CASE, AND THE ONE THAT WAS MISSED. Seating where lines LAND while leaving where
   they LEAVE to dagre still lets two edges out of one node cross a few units above it. On the
   Gettier map as it opens, both section blocks feeding the two Cases did exactly that: 2 of 2
   departure pairs crossed, while every arrival was correctly ordered. */
function twoDepartures(leftGoesRight) {
  const nodes = { src: { x: 300, y: 300, width: 160, height: 54 },
                  L:   { x: 100, y: 100, width: 100, height: 54 },
                  R:   { x: 520, y: 100, width: 100, height: 54 } };
  // As dagre left them: the edge heading LEFT starting from the right of the node, and vice versa.
  const pts = { L: [{ x: leftGoesRight ? 340 : 260, y: 273 }, { x: 100, y: 127 }],
                R: [{ x: leftGoesRight ? 260 : 340, y: 273 }, { x: 520, y: 127 }] };
  const g = { nodes: () => Object.keys(nodes), node: id => nodes[id],
              edges: () => [{ v: "src", w: "L", name: "support" },
                            { v: "src", w: "R", name: "support" }],
              edge: e => ({ points: pts[e.w] }) };
  const sizes = new Map(Object.entries(nodes).map(([k, v]) => [k, { width: v.width, height: v.height }]));
  return { g, vis: { nodes: Object.keys(nodes).map(id => ({ id })) }, sizes };
}
{
  const { g, vis, sizes } = twoDepartures(true);
  const out = departurePorts(g, vis, sizes);
  const L = out.get("src L support"), R = out.get("src R support");
  ok("the edge heading left leaves from the left of the node", L && R && L.x < R.x,
     `L at ${L && Math.round(L.x)}, R at ${R && Math.round(R.x)}`);
  ok("  and both leave from the node's TOP edge", L.y === 273 && R.y === 273,
     `y ${L && L.y}, ${R && R.y}`);
  ok("  both within the box", Math.abs(L.x - 300) <= 80 && Math.abs(R.x - 300) <= 80);
}
{
  // One outgoing edge has no one to cross; dagre's own point is left alone.
  const { g, vis, sizes } = twoDepartures(true);
  g.edges = () => [{ v: "src", w: "L", name: "support" }];
  check("a single departure is left alone", departurePorts(g, vis, sizes).size, 0);
}
{
  // A fan already in the right order must not be touched at all. Re-spacing one evenly "fixed"
  // orderings that were not broken and turned a 1-unit bow into 78 on the Williams folded view.
  const { g, vis, sizes } = twoDepartures(false);
  check("a fan already in order is not moved", departurePorts(g, vis, sizes).size, 0);
}
{
  // And when it IS out of order, the fix reuses the positions dagre chose rather than inventing
  // new ones, so nothing moves further than it must.
  const { g, vis, sizes } = twoDepartures(true);
  const out = departurePorts(g, vis, sizes);
  const xs = [...out.values()].map(v => v.x).sort((a, b) => a - b);
  check("the fix permutes dagre's own departure points", xs, [260, 340]);
}
{
  // The exposition view sends edges out of every side; a top-edge slot means nothing there.
  const { g, vis, sizes } = twoDepartures(true);
  const below = { L: [{ x: 260, y: 327 }, { x: 100, y: 500 }],
                  R: [{ x: 340, y: 327 }, { x: 520, y: 500 }] };
  g.edge = e => ({ points: below[e.w] });
  check("a departure from the BOTTOM of a node is left alone", departurePorts(g, vis, sizes).size, 0);
}

console.log("offsetPastBadge");
/* The arrowhead stays ON the boundary and moves aside, rather than stopping short of it. The
   side is decided by where the line comes FROM, so it never crosses the badge to get there. */
{
  const badge = { x: 100, y: 200 };            // bottom-centre of a 150-wide box
  const from = (x) => offsetPastBadge([{ x, y: 280 }, { x: 100, y: 200 }], badge, 75, BADGE_SIDE);
  ok("an edge arriving from the left lands left of the badge",
     last(from(60)).x === 100 - BADGE_SIDE, `x=${last(from(60)).x}`);
  ok("  and one from the right lands right of it",
     last(from(150)).x === 100 + BADGE_SIDE, `x=${last(from(150)).x}`);
  ok("  both stay exactly on the bottom edge",
     last(from(60)).y === 200 && last(from(150)).y === 200);
  // THE WHOLE ARROWHEAD, not just its tip. The marker is markerUnits="strokeWidth", so it
  // spans 3 x stroke-width either side of the line -- 8.4 units on a far-reaching edge, which
  // is drawn heavier. An offset that clears only the tip leaves a bite out of the head.
  for (const sw of [1.8, 2.8]) {
    const inner = Math.abs(last(from(60)).x - badge.x) - 3 * sw;
    ok(`  the whole arrowhead clears the badge at stroke-width ${sw}`, inner >= BADGE_R,
       `inner edge ${inner.toFixed(1)} from centre, badge radius ${BADGE_R}`);
  }
}
{
  const badge = { x: 100, y: 200 };
  const clear = [{ x: 60, y: 280 }, { x: 160, y: 200 }];
  check("an arrival already clear of the badge is untouched",
        offsetPastBadge(clear, badge, 75, BADGE_SIDE), clear);
}
/* A node too narrow to hold the offset has nowhere to slide to; the caller trims instead. */
check("a node too narrow to slide along returns null",
      offsetPastBadge([{ x: 60, y: 280 }, { x: 100, y: 200 }], { x: 100, y: 200 }, 22, BADGE_SIDE),
      null);
check("no badge, nothing to do",
      offsetPastBadge([{ x: 0, y: 0 }, { x: 9, y: 0 }], null, 75, BADGE_SIDE), null);

console.log("clearOfBadge (the fallback, for nodes too narrow to slide along)");

/* The real case, exactly as it comes off the map: dagre routes bottom-to-top and lands the
   edge ON the badge centre, which is where the node's bottom edge is. */
{
  const badge = { x: 100, y: 200 };
  const pts = [{ x: 100, y: 300 }, { x: 100, y: 250 }, { x: 100, y: 200 }];
  const out = clearOfBadge(pts, badge, R);
  ok("an arrowhead landing on the badge centre is pushed outside it",
     dist(last(out), badge) >= R - 1e-9, `distance ${dist(last(out), badge)} < ${R}`);
  check("and stops exactly on the clearance circle", Math.round(last(out).y), 212);
  ok("the input array is not mutated", pts.length === 3 && last(pts).y === 200);
}

/* Approaching at an angle: the crossing is on the segment, not on either axis. */
{
  const badge = { x: 0, y: 0 };
  const out = clearOfBadge([{ x: 60, y: 60 }, { x: 0, y: 0 }], badge, R);
  ok("an angled approach is trimmed to the circle, not to a bounding box",
     Math.abs(dist(last(out), badge) - R) < 1e-6, `distance ${dist(last(out), badge)}`);
}

/* The common case has to stay free: most edges never go near a badge. */
{
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  ok("a path that never enters the disc is returned untouched",
     clearOfBadge(pts, { x: 500, y: 500 }, R) === pts);
}

/* A node with no badge, and the degenerate inputs a real graph produces. */
check("no badge, no trim", clearOfBadge([{ x: 0, y: 0 }, { x: 9, y: 0 }], null, R),
      [{ x: 0, y: 0 }, { x: 9, y: 0 }]);
check("a one-point path is left alone", clearOfBadge([{ x: 1, y: 1 }], { x: 1, y: 1 }, R),
      [{ x: 1, y: 1 }]);
check("a zero radius is a no-op", clearOfBadge([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 1, y: 1 }, 0),
      [{ x: 0, y: 0 }, { x: 1, y: 1 }]);

/* Trailing points inside the disc are dropped -- but never to fewer than two, and never so far
   that the edge is turned round. A short edge wholly inside the disc keeps its endpoint: there
   is no honest place to put the arrowhead, and a path with one point draws nothing at all. */
{
  const badge = { x: 0, y: 0 };
  const out = clearOfBadge([{ x: 40, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 0 }],
                           badge, R);
  check("several trailing points inside the disc collapse to one crossing", out.length, 2);
  ok("and the crossing is on the circle", Math.abs(dist(last(out), badge) - R) < 1e-6);
}
{
  const badge = { x: 0, y: 0 };
  const pts = [{ x: 3, y: 0 }, { x: 1, y: 0 }];
  const out = clearOfBadge(pts, badge, R);
  check("an edge wholly inside the disc is left as it was", out, pts);
  ok("at least two points always survive", out.length >= 2);
}

console.log("circleCrossing");
check("a segment that misses the circle crosses nothing",
      circleCrossing({ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 50, y: 0 }, 10), null);
check("a zero-length segment does not divide by zero",
      circleCrossing({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 0 }, 10), null);
{
  const hit = circleCrossing({ x: 100, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 12);
  check("and an ordinary crossing is where it should be", hit, { x: 12, y: 0 });
}

console.log("directionFractions");
check("a short edge gets no intermediate mark: its head is legible", directionFractions(60), []);
check("and one just under the threshold still gets none", directionFractions(160), []);
check("a travelling edge gets one, at the middle", directionFractions(300), [0.5]);
check("a long one gets two, evenly spaced", directionFractions(1171).map(f => Math.round(f * 100)),
      [33, 67]);
ok("the count never grows beyond two, however long the edge",
   directionFractions(1e6).length === 2);
ok("thresholds are overridable, so a caller can tune without editing this file",
   directionFractions(100, { one: 50, two: 1e9 }).length === 1);

/* The measured shape of the real map: on the Darwin dagre layout the edges are 54-107 units
   with three long ones at 669, 1171 and 1172. The policy has to leave the first group alone
   and mark the second, or it is either noise or nothing. */
{
  const short = [54, 60, 68, 69, 69, 75, 85, 93, 107];
  const long = [669, 1171, 1172];
  ok("no chevrons on any of the map's ordinary edges",
     short.every(l => directionFractions(l).length === 0), JSON.stringify(short.map(directionFractions)));
  ok("two chevrons on every one of its map-crossing edges",
     long.every(l => directionFractions(l).length === 2));
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
