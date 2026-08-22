/* test_exposition.mjs — the shape-of-the-text measure.
 *
 * TWO KINDS OF CHECK, and both are needed.
 *
 * The first half is synthetic: texts whose shape is known because it was built in. A paper that
 * states everything up front and argues afterwards must come out leaning positive; one that
 * argues its way to a conclusion at the end must come out leaning negative and late. If those
 * fail the measure is simply wrong.
 *
 * The second half runs the REAL reconstructions, and exists because the measure was designed
 * against them. Williams's contention arrives at the end and Horton's claims are stated at the
 * start; that difference is the thing the exposition arrangement exists to show, and it is worth
 * a regression test that it keeps being visible. The assertion is on the ORDER, not on the exact
 * percentages — a change to the placement rules may move both numbers, and should; a change that
 * stops the two texts being distinguishable is a bug.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const EX = require(path.join(HERE, "src", "argdown-exposition.js"));
const P = require(path.join(HERE, "src", "argdown-positions.js"));
const SAMPLES = path.resolve(HERE, "..", "samples");

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

/** A synthetic reconstruction: `n` claims at known lines, and edges given as [reasonIdx, claimIdx]. */
function fake(n, pairs) {
  const nodes = [];
  for (let i = 0; i < n; i++)
    nodes.push({ id: "c" + i, pos: { chapterIndex: 0, line: (i + 1) * 10 } });
  const edges = pairs.map(([r, c]) => ({ from: "c" + r, to: "c" + c, type: "support" }));
  return { nodes, edges };
}

console.log("ranking");
{
  const g = fake(4, []);
  const r = EX.ranks(g.nodes);
  check("every placed claim gets a rank, in reading order", [r.n, r.rank.c0, r.rank.c3], [4, 0, 3]);
  const withGhost = { nodes: g.nodes.concat([{ id: "x", pos: { chapterIndex: 0, line: null } }]) };
  check("a claim with no line takes no rank", EX.ranks(withGhost.nodes).n, 4);
  check("  and one with no position at all is ignored too",
        EX.ranks(g.nodes.concat([{ id: "y" }])).n, 4);
}

console.log("reach");
{
  const g = fake(10, [[8, 1], [9, 2]]);          // support at 8,9 holds up claims at 1,2
  const rs = EX.reaches(g.edges, EX.ranks(g.nodes).rank);
  check("support that comes later reads positive", rs.map(r => r.reach), [7, 7]);
  check("  and is recorded at the CLAIM's position", rs.map(r => r.at), [1, 2]);
  const back = EX.reaches(fake(10, [[1, 8]]).edges, EX.ranks(g.nodes).rank);
  check("support already given reads negative", back[0].reach, -7);
  check("an edge with an unplaced end is dropped",
        EX.reaches([{ from: "c0", to: "nope" }], EX.ranks(g.nodes).rank).length, 0);
}

console.log("the verdict on texts whose shape is known");
{
  // Everything asserted in the first fifth, argued for across the rest.
  const upfront = fake(20, [[10,0],[12,1],[14,2],[16,3],[18,1],[19,0]]);
  const vU = EX.verdict(EX.reaches(upfront.edges, EX.ranks(upfront.nodes).rank), 20);
  check("claims asserted on credit: leans to debt", vU.lean > 0.5, true);
  check("  and settles early", vU.where, "settles early");
  check("  and is described as asserting on credit",
        /asserts, then argues/.test(vU.how), true);

  // Everything argued through the piece, the conclusion at the end.
  const buildup = fake(20, [[1,18],[3,18],[5,19],[7,19],[9,18],[11,19]]);
  const vB = EX.verdict(EX.reaches(buildup.edges, EX.ranks(buildup.nodes).rank), 20);
  check("claims earned before they are made: leans away from debt", vB.lean < -0.5, true);
  check("  and settles late", vB.where, "settles late");
  check("  and is described as earning its claims first",
        /argues, then asserts/.test(vB.how), true);

  // Line-to-line support only, and spread over the WHOLE piece — real prose, no finding at all.
  // (Bunching the same local edges into the first half is a different fixture entirely: an early
  // centroid is then the right answer, which is what the first version of this test got wrong.)
  const local = fake(20, Array.from({ length: 19 }, (_, i) => [i + 1, i]));
  const vL = EX.verdict(EX.reaches(local.edges, EX.ranks(local.nodes).rank), 20);
  check("local support alone does not pretend to a shape", Math.abs(vL.centre - 0.5) < 0.2, true);
  check("nothing at all gives no verdict rather than a false one",
        EX.verdict([], 20).centre, null);
}

console.log("weighting: distance, not counts");
{
  // Eleven local edges pointing one way, one long edge the other. Counts say "forward";
  // the weighting has to say the long one dominates, because that is the one a reader feels.
  const g = fake(40, [...Array.from({ length: 11 }, (_, i) => [i + 1, i]), [0, 39]]);
  const rs = EX.reaches(g.edges, EX.ranks(g.nodes).rank);
  const fwdCount = rs.filter(r => r.reach > 0).length;
  check("raw counts would call it forward-leaning", fwdCount > rs.length / 2, true);
  check("  the weighted verdict is not fooled", EX.verdict(rs, 40).lean < 0, true);
}

console.log("the sparkline");
{
  const ys = paths => paths.line.split(" ").map(p => Number(p.split(",")[1]));
  const g = fake(20, [[1,18],[3,18],[5,19]]);
  const rs = EX.reaches(g.edges, EX.ranks(g.nodes).rank);
  const paths = EX.sparkPaths(rs, 20, { width: 100, height: 12 });
  check("geometry is produced", [paths.width, paths.height, paths.mid], [100, 12, 6]);
  check("  as one line and the area under it", [typeof paths.line, typeof paths.area],
        ["string", "string"]);
  check("nothing to draw returns null rather than a flat line", EX.sparkPaths([], 20), null);

  // The line has to move the RIGHT way, or it is decoration. Smaller y is higher on screen.
  // DEBT HANGS BELOW THE LINE. Larger y is lower on screen, so a claim asserted ahead of its
  // reasons must push y past the midline, and a claim already earned must pull it above.
  const upfront = fake(20, [[10,0],[12,1],[14,2],[16,3],[18,1]]);
  const uy = ys(EX.sparkPaths(EX.reaches(upfront.edges, EX.ranks(upfront.nodes).rank), 20,
                              { width: 100, height: 12 }));
  check("claims asserted ahead of their reasons draw BELOW the line", Math.max(...uy) > 6, true);
  check("  and never above it", Math.min(...uy) >= 5.99, true);

  const buildup = fake(20, [[1,18],[3,18],[5,19],[7,19]]);
  const by = ys(EX.sparkPaths(EX.reaches(buildup.edges, EX.ranks(buildup.nodes).rank), 20,
                              { width: 100, height: 12 }));
  check("claims their reasons have already earned draw ABOVE it", Math.min(...by) < 6, true);
  check("  and never below it", Math.max(...by) <= 6.01, true);

  // The whole point of the rebasing: a band's mark must fill its own width, not sit in a sliver.
  const late = fake(60, [[52,50],[55,51],[58,53],[44,50]]);
  const lp = EX.sparkPaths(EX.reaches(late.edges, EX.ranks(late.nodes).rank), 60,
                           { width: 100, height: 12 });
  const lys = ys(lp);
  check("a band covering a slice of the text still uses its full height",
        Math.max(...lys) - Math.min(...lys) > 4, true);

  const svg = EX.sparkline(rs, 20, { width: 100, height: 12 });
  check("the markup form is an svg", /^<svg class="alm-spark"/.test(svg), true);
  check("  and carries no colour of its own — the stylesheet owns that",
        /fill="|stroke="/.test(svg), false);
}

console.log("the real reconstructions");
{
  const load = (dir, ad) => {
    const root = path.join(SAMPLES, dir);
    const g = toGraph(argdown.run({ input: fs.readFileSync(path.join(root, ad), "utf8"), ...RUN }));
    const sources = {};
    for (const n of g.nodes) if (n.chapter && !(n.chapter in sources)) {
      const p = path.join(root, n.chapter);
      sources[n.chapter] = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    }
    const cited = [];
    for (const n of g.nodes) if (n.chapter && !cited.includes(n.chapter)) cited.push(n.chapter);
    const { byId } = P.positions(g.nodes, sources,
      "chapters:\n" + cited.map(c => `  - "${c}"`).join("\n") + "\n");
    for (const n of g.nodes) if (byId[n.id]) n.pos = byId[n.id];
    const r = EX.ranks(g.nodes);
    return EX.verdict(EX.reaches(g.edges, r.rank), r.n);
  };
  // CARROLL against DARWIN. The Tortoise dialogue keeps asserting and then justifying — Achilles
  // states the next step and only then defends it — so it leans towards debt. Darwin's paragraph
  // is the opposite shape: variation, then struggle, then the conclusion those two earn, with
  // every premise linked. Two public-domain texts, and the measure has to tell them apart.
  const c = load("Carroll 1895 - What the Tortoise said to Achilles",
                 "carroll-tortoise-achilles.argdown");
  const d = load("Darwin 1859 - Natural selection", "darwin-natural-selection.argdown");
  console.log(`        Carroll lean ${c.lean.toFixed(2)}  ·  Darwin lean ${d.lean.toFixed(2)}`);
  check("Carroll asserts and then justifies — leans to debt", c.lean > 0.1, true);
  check("Darwin earns its conclusion first — leans away from it", d.lean < -0.3, true);
  check("  and the two are told apart by a margin a reader could see",
        c.lean - d.lean > 0.5, true);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
