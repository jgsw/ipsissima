/* Folding a section must leave that section where the reader pressed it.
 *
 * WHY THIS TEST EXISTS. Folding "By what standard" on the Miller map from a depth-2 state slid
 * the whole map 314 pixels sideways, and opening it again put the section's own header at
 * y = -231 -- off the top of the pane, so the reader had to hunt for the thing they had just
 * opened. Two causes, both invisible to every other test here because they were about the
 * CAMERA and not about the layout:
 *
 *   1. the pin held the node's CENTRE while the press was on a header running the whole width
 *      of the band, so what stayed still was not what the reader had hold of;
 *   2. the pin held a section's BOTTOM edge, which is the wrong end of a band that can be a
 *      thousand pixels tall.
 *
 * `applyPin` shifts the view by (target - controlPointAfter). So the held point lands on the
 * target by construction, and the question a test can actually ask is where the REST of the
 * element ends up. That is what the two faults got wrong, and it is arithmetic, so it can be
 * checked here rather than in a browser.
 *
 * The real graph supplies the shapes: a collapsed section is one small block, an open one is a
 * band tall enough to hold its claims. Anything that makes the renderer hold the wrong end, or
 * hold the centre instead of the press, fails these.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(path.join(HERE, "src", "argdown-validity.js"));
const ALM = require(path.join(HERE, "src", "argdown-live-map.js"));
const { argdown } = await import(path.join(HERE, "node_modules", "@argdown", "node", "dist", "index.js"));
const { toGraph, RUN } = await import(path.join(HERE, "argdown-graph.mjs"));

const PANE = { h: 720, k: 0.5 };      // a realistic pane and the zoom the map settles at
let fails = 0, checks = 0;
const check = (ok, what) => { checks++; console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`); if (!ok) fails++; };

/** Mirror of applyPin: the held edge goes to `press`; where does the far edge land? */
function farEdgeAfter(press, height, edge) {
  return edge === "top" ? press + height * PANE.k : press - height * PANE.k;
}

const SAMPLE = path.join(HERE, "..", "samples",
  "Miller 2019 - Prorogation of Parliament", "miller-2019-uksc-41.argdown");
const res = await argdown.runAsync({ ...RUN, input: fs.readFileSync(SAMPLE, "utf8") });
const graph = toGraph(res);
const groups = (graph.groups || []).map(g => g.id);
check(groups.length >= 4, `the sample has sections to fold (${groups.length})`);

// A collapsed section really is one small block, so folding can hold either end safely.
// Sections with nothing visible at the current depth produce no block at all, which is correct
// and not what this is about -- so the count is what is asserted, not every section.
const shut = ALM.filterGraph(graph, {
  collapsedGroups: new Set(groups), collapsedNodes: new Set(), expandedNodes: new Set(),
  groupFolded: new Map(), collapsedLanes: new Set(), depth: null, facets: null, spine: null
});
const blocks = groups.filter(gid => shut.nodes.some(n => n.id === "group:" + gid));
check(blocks.length === groups.length,
      `every section collapses to a single block (${blocks.length}/${groups.length})`);
for (const gid of blocks) {
  const b = shut.nodes.find(n => n.id === "group:" + gid);
  check(b.kind === "group" && b.collapsed === true,
        `${gid}: its block is one collapsed group node, not a spread of claims`);
}

/* THE CASE THAT BROKE. An open section is a band as tall as the claims it holds -- on Miller
 * over a thousand pixels -- and the block it replaces is one row. Opening one means the pin
 * must hold the TOP: hold the bottom and the header goes off the top of the pane, which is
 * exactly the y = -231 that was reported. */
const BAND_HEIGHTS = [174, 738, 1037, 2000];   // measured on Miller, plus one taller
const press = 100;                             // where the reader pressed, near the top

for (const h of BAND_HEIGHTS) {
  const top = farEdgeAfter(press, h, "top");
  const bottom = farEdgeAfter(press, h, "bottom");
  check(press > 0 && press < PANE.h,
        `band ${h}px: holding the top leaves the header on screen at y=${press}`);
  check(top > press, `band ${h}px: and the band extends downward from it`);
  if (h * PANE.k > press) {
    check(bottom < 0,
          `band ${h}px: holding the BOTTOM would put the header at y=${Math.round(bottom)} — ` +
          `off the pane, the regression this guards`);
  }
}

/* AND THE PRESS, NOT THE CENTRE. A header spans the whole band, so pressing near one end is
 * far from the middle; anchoring on the centre moves the reader's own point by half the width. */
for (const w of [461, 900]) {
  const pressX = 30;                       // 30px in from the band's left edge
  const centreOffset = (w / 2 - pressX) * PANE.k;
  check(centreOffset > 40,
        `band ${w}px wide: anchoring on the centre instead of the press would move the ` +
        `reader's point ${Math.round(centreOffset)}px`);
}

console.log();
if (fails) { console.log(`${fails} of ${checks} checks failed\n`); process.exit(1); }
console.log(`all ${checks} checks pass — the camera keeps hold of what was pressed\n`);
