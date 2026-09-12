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

console.log("\nthe control is wired to the filter");
// THE MEASURE AND THE FILTER WERE BOTH RIGHT AND THE BUTTON DID NOTHING. `setState` copies an
// explicit list of keys rather than merging the patch, so `setState({spine: 1})` was dropped in
// silence — and every test above still passed, because they all call `filterGraph` directly.
// A UI control needs its wiring held as well as its behaviour.
const src2 = fs.readFileSync(path.join(HERE, "src", "argdown-live-map.js"), "utf8");
check("the toolbar offers a spine control", /data-act="spine"/.test(src2), true);
check("  clicking it calls setState", /act === "spine"[\s\S]{0,80}setState\(\{ spine/.test(src2), true);
check("  and setState keeps the key", /"spine"\s*in patch/.test(src2), true);
check("  and filterGraph reads it", /spine:\s*state\.spine == null/.test(src2), true);

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

console.log("\na DECLARED contention counts as one (front matter `contentions:`, 10 Sep 2026)");
// The serial genre: [Coda] is the terminus, [Thesis] is used and so never sits at the computed
// apex -- until the front matter raises it. Declared, it must be a contention everywhere the
// word means anything: it scores load like one, it survives the spine like one, and it seeds
// the depth ladder at rung 0 (checked here through loadOf, which walks from the contention set).
const serial = `===
contentions:
    - Thesis
===

[Coda]: The closing corollary.
    <+ [Thesis]: The paper's stated thesis.
        <+ [R1]: A reason for the thesis.
        <+ [R2]: Another reason.
`;
const sg = toGraph(argdown.run({ input: serial, ...RUN }));
check("the declaration resolves to the thesis node",
      sg.contentions.map(id => sg.nodes.find(n => n.id === id).label), ["Thesis"]);
const six = M.index(sg);
check("the declared node is a contention to the index", six.isContention(sg.contentions[0]), true);
const sload = M.loadOf(six);
const byLabel = t => sg.nodes.find(n => n.label === t).id;
// Undeclared, removing [Coda] strands everything (load 3). Declared, the thesis is a
// contention in its own right, so its reasons still reach one when the coda goes -- and the
// thesis itself now scores as what everything beneath it stands on.
check("declared, the coda strands nothing", sload.get(byLabel("Coda")), 0);
check("the declared thesis holds up its two reasons", sload.get(byLabel("Thesis")), 2);

console.log("\nan intermediary conclusion drawn as its own node is NOT a contention (Kant, 12 Sep 2026)");
// A statement that concludes a step AND carries relations of its own gets a node of its own,
// and its carriage into the later steps of the same argument is deliberately not drawn (see
// the `concludes` synthesis in argdown-graph.mjs). "Supports nothing" is then false of the
// picture but true of nothing: on the Kant map the step-3 conclusion of the free-play argument
// sat at rung 0 beside the text's two definitions.
const midSrc = `<Arg>: A two-step argument.

(1) [P1]: A premise.
(2) [P2]: Another premise.
-----
(3) [Mid]: The middle conclusion, with support of its own.
    <+ [Side]: A reason bearing on the middle directly.
(4) [P3]: A further premise.
-----
(5) [End]: The conclusion.
`;
const mg = toGraph(argdown.run({ input: midSrc, ...RUN }));
const mix = M.index(mg);
const mid = mg.nodes.find(n => n.label === "Mid");
const end = mg.nodes.find(n => n.label === "End");
check("the middle conclusion has no drawn outgoing edge", mix.outCount.get(mid.id) || 0, 0);
check("but it is not a contention", mix.isContention(mid.id), false);
check("the main conclusion still is", mix.isContention(end.id), true);

console.log();
if (fails) { console.log(`${fails} FAILED\n`); process.exit(1); }
console.log("all passed\n");
