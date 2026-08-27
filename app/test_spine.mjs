/* test_spine.mjs — how much of the argument collapses without each claim.
 *
 *   node app/test_spine.mjs
 *
 * WHAT THE MEASURE CLAIMS. `loadOf` gives, for every claim, the number of OTHER claims that lose
 * every route to a contention when it is removed. The "spine" filter draws the claims whose load
 * is at least one.
 *
 * WHY IT REPLACED A TAG. `#core` was a reader's estimate of the same thing, applied by hand. It
 * marked 27% of the claims in one published sample and 65% in another, so the chip meant
 * something different in every file, and nothing could check it against the argument it
 * described. This can be checked, and these tests are the checking.
 *
 * WHY NOT DISTANCE FROM THE CONTENTION, which the "how much" ladder already uses: they measure
 * different things. Distance says how far out a claim sits; load says how much rests on it. The
 * last test here holds them apart on a graph built to separate them.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const M = require(path.join(HERE, "src", "argdown-live-map.js"));

let fails = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

/** load, keyed by the claim's own title rather than by node id. */
function loads(src) {
  const g = toGraph(argdown.run({ input: src, ...RUN }));
  const ix = M.index(g);
  const load = M.loadOf(ix);
  const out = {};
  for (const n of g.nodes) out[n.label || n.id] = load.get(n.id) || 0;
  return out;
}

console.log("== what holds the argument up\n");

console.log("a chain: everything below the contention is load-bearing");
// [C] <- [B] <- [A].  Removing B strands A. Removing A strands nobody.
const chain = loads(`[C]: The contention.
    <+ [B]: A reason.
        <+ [A]: A reason for the reason.
`);
check("the contention holds up both", chain["C"], 2);
check("the middle claim holds up the one below it", chain["B"], 1);
check("the leaf holds up nothing", chain["A"], 0);

console.log("\nconvergent reasons hold up nothing: remove one, the rest still reach");
const conv = loads(`[C]: The contention.
    <+ [R1]: One reason.
    <+ [R2]: Another reason.
    <+ [R3]: A third.
`);
check("each convergent reason holds up nothing", [conv["R1"], conv["R2"], conv["R3"]], [0, 0, 0]);
check("  and the contention holds up all three", conv["C"], 3);

console.log("\na claim two routes deep is not load-bearing if there is another route");
// D reaches C through B and also directly. Removing B should strand nothing.
const twoRoutes = loads(`[C]: The contention.
    <+ [B]: A reason.
        <+ [D]: A reason for B.
    <+ [D]
`);
check("the redundant middle holds up nothing", twoRoutes["B"], 0);

console.log("\nload and distance from the contention are different measures");
// [C] <- [Near] (1 step, holds up nothing)
// [C] <- [Mid] <- [Far] <- {three leaves}   Far is 2 steps out and holds up three.
const apart = loads(`[C]: The contention.
    <+ [Near]: One step out, holding nothing up.
    <+ [Mid]: One step out.
        <+ [Far]: Two steps out, and everything below hangs on it.
            <+ [L1]: A leaf.
            <+ [L2]: Another leaf.
            <+ [L3]: A third leaf.
`);
check("a claim beside the contention can hold up nothing", apart["Near"], 0);
check("a claim further out can hold up three", apart["Far"], 3);
check("  so load is not distance", apart["Far"] > apart["Near"], true);

console.log("\nthe spine filter draws what the measure names");
const src = `[C]: The contention.
    <+ [Mid]: A reason.
        <+ [Leaf]: A leaf.
    <+ [Alone]: Another reason, holding nothing up.
`;
const g = toGraph(argdown.run({ input: src, ...RUN }));
const all = M.filterGraph(g, {});
const spine = M.filterGraph(g, { spine: 1 });
const titles = f => f.nodes.map(n => n.label || n.id).sort();
check("everything is drawn without the filter", titles(all).length, 4);
check("the spine keeps the contention and what holds things up",
      titles(spine), ["C", "Mid"]);
check("  and drops the leaves", titles(spine).includes("Leaf"), false);

console.log("\non the published samples");
// The point of the measure is that it discriminates. A filter that keeps everything, or almost
// nothing, would be no use — and `#core` did the first on one sample and nearly the second on
// another.
const SAMPLES = path.resolve(HERE, "..", "samples");
for (const dir of fs.readdirSync(SAMPLES).sort()) {
  const full = path.join(SAMPLES, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  const f = fs.readdirSync(full).find(x => x.endsWith(".argdown"));
  if (!f) continue;
  const gg = toGraph(argdown.run({ input: fs.readFileSync(path.join(full, f), "utf8"), ...RUN }));
  const kept = M.filterGraph(gg, { spine: 1 }).nodes.length;
  const total = gg.nodes.length;
  const frac = kept / total;
  const ok = frac > 0.1 && frac < 0.85;
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${dir.split(" ")[0].padEnd(15)} ` +
              `spine ${String(kept).padStart(2)}/${String(total).padEnd(3)} (${Math.round(frac * 100)}%)`);
}

console.log();
if (fails) { console.log(`${fails} FAILED\n`); process.exit(1); }
console.log("all passed\n");
