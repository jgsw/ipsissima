/* The diagram comparison's measures, on a planted map and figure: a direct step, a route, a reversed
 * step, a missing one, a moderator, a flow the map does and does not mark as a stock's, and a loop
 * with and against its mark. Mutations: drop the route search -> "route" reads missing; ignore the
 * loop's polarity -> the reinforcing mark reads as agreeing.
 * Then what the blind comparisons (9 Oct 2026) taught it: a step stated `via` others is a summary, not
 * an extra arrow; an association, a part's step, a box read through its drawn parts, a null step and a
 * moderator each get their own verdict; a loop with a node no state stands for is not looked for.
 * Mutations: drop the null test -> D4 reads missing; drop the moderator-first test -> the knob reads
 * direct; let a loop with an unpaired node through -> it reads closed. */
import { argdown } from "@argdown/core";
import { createRequire } from "module";
import { toGraph, RUN } from "./argdown-graph.mjs";
import { compare } from "./diagram_compare.mjs";
const MV = createRequire(import.meta.url)("./src/argdown-mechanism.js");
let fails = 0;
const check = (ok, what, detail) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok ? "" : `\n          ${detail}`)); if (!ok) fails++; };
const M = MV.model(toGraph(argdown.run({ input: `===
mechanism:
    levels: [one]
    actors:
        p: {label: "P", level: one}
    states:
        s: {label: "A stock", actor: p, role: outcome}
        i: {label: "Inflow", actor: p}
        g: {label: "Gap", actor: p}
        x: {label: "X", actor: p, role: condition}
        y: {label: "Y", actor: p}
        z: {label: "Z", actor: p}
        k: {label: "A knob", actor: p}
===

[Aim]: A.

[F]: The inflow fills the stock. {causes: {from: i, to: s, sign: "+", on: stock, basis: asserted}}
    +> [Aim]

[G]: A fuller stock narrows the gap. {causes: {from: s, to: g, sign: "-", basis: asserted}}
    +> [Aim]

[H]: A wider gap opens the inflow, the more so with the knob. {causes: {from: g, to: i, sign: "+", modifies: {by: k, effect: strengthens}, basis: asserted}}
    +> [Aim]

[R]: X raises Y, and Y raises Z. {causes: [{from: x, to: y, sign: "+", basis: asserted}, {from: y, to: z, sign: "+", basis: asserted}]}
    +> [Aim]
`, ...RUN })));
const fig = { id: "Fig. 1", nodes: [], align: { S: "s", I: "i", G: "g", X: "x", Z: "z", Y: "y", K: "k", Q: "y" },
  links: [{ from: "I", to: "S", kind: "flow", sign: "+" }, { from: "X", to: "Z", kind: "causal", sign: "+" },
          { from: "Z", to: "Y", kind: "causal" }, { from: "X", to: "Q", kind: "causal", sign: "-" },
          { from: "K", to: "I", kind: "information" }, { from: "G", to: "Z", kind: "causal" }],
  loops: [{ nodes: ["S", "G", "I"], label: "B" }, { nodes: ["S", "G", "I"], label: "R" }] };
const R = compare(M, fig);
const v = R.links.map(l => l.verdict);
check(JSON.stringify(v) === JSON.stringify(["direct", "route", "reversed", "direct", "moderates", "missing"]),
      "each link read as direct, a route, reversed, a moderator or missing", JSON.stringify(v));
check(R.links[0].stock === true, "a flow the map marks on: stock is said to be one", JSON.stringify(R.links[0]));
check(R.links[3].signAgrees === false, "a sign the map gives against the figure's is caught", JSON.stringify(R.links[3]));
check(R.loops[0].closed && R.loops[0].agrees === true && R.loops[1].agrees === false,
      "a loop the map closes agrees with B and not with R", JSON.stringify(R.loops));
const M2 = MV.model(toGraph(argdown.run({ input: `===
mechanism:
    levels: [one]
    actors:
        p: {label: "P", level: one}
    states:
        w: {label: "A whole", actor: p, role: condition}
        wp: {label: "A part of it", actor: p, part_of: w}
        t: {label: "T", actor: p}
        m: {label: "M", actor: p}
        y: {label: "Y", actor: p, role: outcome}
        n: {label: "N", actor: p}
        k: {label: "Knob", actor: p}
===

[Aim]: A.

[P]: The part moves T. {causes: {from: wp, to: t, sign: "+", basis: asserted}}
    +> [Aim]

[Q]: T moves M, M moves Y, and T moves Y only through M. {causes: [{from: t, to: m, sign: "+", basis: asserted}, {from: m, to: y, sign: "+", basis: asserted}, {from: t, to: y, via: [m], share: entire, basis: asserted}]}
    +> [Aim]

[S]: The whole goes with Y. {causes: {from: w, to: y, association: true, basis: asserted}}
    +> [Aim]

[U]: T makes no difference to N. {causes: {from: t, to: n, sign: "0", basis: asserted}}
    +> [Aim]

[V]: The knob raises T, and strengthens the part's step to it. {causes: [{from: k, to: t, sign: "+", basis: asserted}, {from: wp, to: t, sign: "+", modifies: {by: k, effect: strengthens}, basis: asserted}]}
    +> [Aim]
`, ...RUN })));
const fig2 = { id: "Fig. 2", align: { W: "w", T: "t", M: "m", Y: "y", N: "n", K: "k", P1: "wp" },
  nodes: [{ id: "BOX" }, { id: "P1", inside: "BOX" }, { id: "X" }],
  links: [{ from: "W", to: "T" }, { from: "W", to: "Y", kind: "association" }, { from: "T", to: "N" },
          { from: "K", to: "T", kind: "moderator" }, { from: "BOX", to: "T" }, { from: "T", to: "M" }],
  loops: [{ nodes: ["T", "M", "X"], label: "B" }] };
const R2 = compare(M2, fig2);
const v2 = R2.links.map(l => l.verdict);
check(JSON.stringify(v2) === JSON.stringify(["by a part", "association", "null", "moderates", "by a part", "direct"]),
      "a part's step, an association, no effect, a moderator and a box read through its parts each have their verdict", JSON.stringify(v2));
check(R2.summaries.length === 1 && R2.summaries[0].via[0] === "m" && !R2.extraSteps.some(e => e.from === "t" && e.to === "y"),
      "a step stated through others is a summary, not an extra arrow", JSON.stringify({ s: R2.summaries, e: R2.extraSteps }));
check(R2.loops[0].closed === null, "a loop with a node no state stands for is not looked for", JSON.stringify(R2.loops));
console.log(fails ? `\n${fails} failed` : "\nall diagram-comparison checks passed");
process.exit(fails ? 1 : 0);
