/* The Mechanism arrangement: one set of rules in two languages, and a page that keeps its word.
 *
 *   node app/test_mechanism_view.mjs
 *
 * TWO IMPLEMENTATIONS, ONE ANSWER. The chain's rules live in ipsissima-mcp's mechanism.py (the
 * checker's census) and are ported to src/argdown-mechanism.js (the page's drawing). Two copies of
 * a rule drift; the positions module learned that, and test_argdown_positions.mjs exists to police
 * it. So the first half runs both on the same planted file and requires the same profile, field
 * for field.
 *
 * THE PAGE'S PROMISES, KEPT UNDER REAL CLICKS. The second half builds a viewer and drives it with
 * Playwright's real input -- never dispatched events, which skip the very path under test. It holds
 * the page to what the rescoped design promised: the arrangement offered only for a map with a
 * chain; the appraisal off until asked for, and off meaning OFF everywhere, the panel included;
 * switching a layer moving nothing else; a chip opening its own arrow even where another arrow's
 * hit stroke runs over it (the defect the first real-click drive found); and a claim reaching its
 * passage. Skipped, not failed, where Chromium is not installed, as test_rendered_dom does.
 *
 * Each browser invariant was mutation-tested when written: the note beside it names the mutation.
 */
import { argdown } from "@argdown/core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
const MV = require("./src/argdown-mechanism.js");
const FIXTURE = path.join(REPO, "ipsissima-mcp", "tests", "mechanism");
const CHAIN = path.join(FIXTURE, "chain.argdown");
// THE VENV AT THE REPOSITORY ROOT, where CI builds it and `run_all_tests.mjs` looks. This looked
// in `ipsissima-mcp/.venv`, which nothing creates, so on CI it fell back to the runner's bare
// `python3`: no PyYAML, the checker could not read the `mechanism:` block, its census came back
// empty, and every field "disagreed" with the page (26 Sep 2026). Locally Homebrew's python3
// happened to have PyYAML, which is why it passed here and failed there.
const VENV = path.join(REPO, ".venv", "bin", "python3");
const PY = fs.existsSync(VENV) ? VENV : "python3";

let fails = 0, checks = 0;
function check(ok, what, detail) {
  checks++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}` + (ok || detail == null ? "" : `\n          ${detail}`));
  if (!ok) fails++;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const graphOf = file => toGraph(argdown.run({ input: fs.readFileSync(file, "utf8"), ...RUN }));
graphOf.fromText = text => toGraph(argdown.run({ input: text, ...RUN }));

/* ------------------------------------------------------------ one answer in two languages */
console.log("the page's model and the checker's census agree");
const G = graphOf(CHAIN);
const M = MV.model(G);
const py = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                        CHAIN, "--format", "json"], { encoding: "utf8" })).shape.chain;
for (const k of Object.keys(py)) {
  if (k === "question") continue;
  const js = k === "gaps" ? M.profile.gaps.map(g => g.message) : M.profile[k];
  check(same(js, py[k]), `\`${k}\` is the same in both`, `python ${JSON.stringify(py[k])}\n          js     ${JSON.stringify(js)}`);
}
// AND ON THE PLANTED EXPLANATORY CHAIN (profile 1.1): conditions, a state with two roles, a
// loop, and the gaps a chain with no intervention reports. Mutation: drop the conditions from
// the page's entries -> `entries` and `routes` differ from the checker's.
{
  const LOOPF = path.join(FIXTURE, "loop.argdown");
  const pyL = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           LOOPF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const ML = MV.model(graphOf(LOOPF));
  const differ = Object.keys(pyL).filter(k => k !== "question" &&
    !same(k === "gaps" ? ML.profile.gaps.map(g => g.message) : ML.profile[k], pyL[k]));
  check(differ.length === 0, "the page and the checker agree on an explanatory chain with a loop",
        differ.map(k => `${k}: python ${JSON.stringify(pyL[k])} js ${JSON.stringify(ML.profile[k])}`).join("\n          "));
}
// AND ON THE PLANTED COLEMAN BOAT (profile 1.4): a joint step and a state across levels.
// Mutation: leave co-causes out of the page's edges -> `entries`, `routes` and `gaps` differ.
const JOINTF = path.join(FIXTURE, "joint.argdown");
{
  const pyJ = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           JOINTF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MJ = MV.model(graphOf(JOINTF));
  const differ = Object.keys(pyJ).filter(k => k !== "question" &&
    !same(k === "gaps" ? MJ.profile.gaps.map(g => g.message) : MJ.profile[k], pyJ[k]));
  check(differ.length === 0 && pyJ.joint.length === 1 && pyJ.spanning.length === 1,
        "the page and the checker agree on a joint step and a state across levels",
        differ.map(k => `${k}: python ${JSON.stringify(pyJ[k])} js ${JSON.stringify(MJ.profile[k])}`).join("\n          "));
}
// AND ON TWO PLANTED CHAINS (profile 1.5): each walked with its own roles, and what couples them.
// Mutation: drop a chain's `roles:` in chainStates -> `chains` differs from the checker's.
const CHAINSF = path.join(FIXTURE, "chains.argdown");
{
  const pyC = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           CHAINSF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MC = MV.model(graphOf(CHAINSF));
  const differ = Object.keys(pyC).filter(k => k !== "question" &&
    !same(k === "gaps" ? MC.profile.gaps.map(g => g.message) : MC.profile[k], pyC[k]));
  check(differ.length === 0 && pyC.chains.length === 2 && pyC.unchained === 1,
        "the page and the checker agree on two chains, their roles and what they share",
        differ.map(k => `${k}: python ${JSON.stringify(pyC[k])} js ${JSON.stringify(MC.profile[k])}`).join("\n          "));
}
// AND ON A GENERAL CLAIM AND ITS CASE (profile 1.6): kinds, the akin step, each chain's kin.
// Mutation: let akinSteps ignore kinds -> `akin_steps` differs from the checker's.
const KINDSF = path.join(FIXTURE, "kinds.argdown");
{
  const pyK = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           KINDSF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MK = MV.model(graphOf(KINDSF));
  const differ = Object.keys(pyK).filter(k => k !== "question" &&
    !same(k === "gaps" ? MK.profile.gaps.map(g => g.message) : MK.profile[k], pyK[k]));
  check(differ.length === 0 && pyK.kinds.length === 2 && pyK.akin_steps.length === 1,
        "the page and the checker agree on kinds across cases and the step they share",
        differ.map(k => `${k}: python ${JSON.stringify(pyK[k])} js ${JSON.stringify(MK.profile[k])}`).join("\n          "));
}
// AND ON A GENERAL CLAIM AND TWO CASES (profile 1.7). Mutation: drop the orientation in
// akinSteps -> `instances` and `akin_steps` differ from the checker's.
const GENERALSF = path.join(FIXTURE, "generals.argdown");
{
  const pyG = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           GENERALSF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MG = MV.model(graphOf(GENERALSF));
  const differ = Object.keys(pyG).filter(k => k !== "question" &&
    !same(k === "gaps" ? MG.profile.gaps.map(g => g.message) : MG.profile[k], pyG[k]));
  // Two alternatives within one case are not two cases. Mutation: drop oneCase -> the pair appears.
  const ALT = MV.model(graphOf.fromText(fs.readFileSync(GENERALSF, "utf8").replace("        smigr:",
    "        nmove:    {label: \"Northern moves to town\", actor: herders, kind: migration}\n        smigr:") + `
[Some moved to town]: Some northern herders moved to town, and that too thinned the forest.
    {causes: {from: nmove, to: nforest, sign: "-", basis: asserted, chain: north}}
    +> [Migration and forests]
`));
  check(!ALT.profile.akin_steps.some(pr => ["nmigr", "nmove"].includes(pr[0][0]) && ["nmigr", "nmove"].includes(pr[1][0])) &&
        ALT.profile.akin_steps.length === 2,
        "two alternatives within one case are not the same step in two cases", JSON.stringify(ALT.profile.akin_steps));
  check(differ.length === 0 && pyG.instances.length === 2 && pyG.akin_steps.length === 1,
        "the page and the checker agree on the general step, its cases, and the chains that are cases",
        differ.map(k => `${k}: python ${JSON.stringify(pyG[k])} js ${JSON.stringify(MG.profile[k])}`).join("\n          "));
}
// AND ON THE PLANTED SYSTEM (profile 1.2): a feedback system, wholes, decides-which. Mutation:
// build the page's adjacency unsorted -> `feedback` or `loops_text` differ from the checker's.
const SYSF = path.join(FIXTURE, "system.argdown");
{
  const pyS = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           SYSF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MS = MV.model(graphOf(SYSF));
  const differ = Object.keys(pyS).filter(k => k !== "question" &&
    !same(k === "gaps" ? MS.profile.gaps.map(g => g.message) : MS.profile[k], pyS[k]));
  check(differ.length === 0, "the page and the checker agree on a feedback system, its wholes and its signs",
        differ.map(k => `${k}: python ${JSON.stringify(pyS[k]).slice(0, 200)} js ${JSON.stringify(MS.profile[k]).slice(0, 200)}`).join("\n          "));
  // THE TEXT'S OWN BOXES. Mutation: keep a part's steps under the part -> the parts stay drawn.
  const C = MV.collapseModel(MS);
  check(!C.ids.some(v => ["expand", "contract", "blur"].includes(v)) && C.ids.includes("strat"),
        "collapsed, the parts are drawn inside their whole", JSON.stringify(C.ids));
  check(C.steps.every(x => !["expand", "contract", "blur"].includes(x.from) && !["expand", "contract", "blur"].includes(x.to)) &&
        C.steps.some(x => x.from === "inst" && x.to === "strat" && x.partTo === "expand"),
        "every step from or to a part becomes the whole's, remembering which part it was");
  check(C.collapsed.inside === 1, "and the step between two parts of the box is counted, not drawn", C.collapsed.inside);
  const CL = MV.layout(C);
  // ONE ARROW PER PAIR OF THE TEXT'S BOXES. A mixed pair is planted: two steps that decide which
  // strategy follows and one that raises. Mutation: turn `merge` off -> two arrows between the boxes.
  const MIX = MV.model(graphOf.fromText(fs.readFileSync(SYSF, "utf8") + `
[Mixed]: Institutions encourage blurring. {causes: {from: inst, to: blur, sign: "+", basis: asserted}}
    +> [Ends]
`));
  const MXL = MV.layout(MV.collapseModel(MIX));
  const between = MXL.edges.filter(e => e.from === "inst" && e.to === "strat" && e.layer === "text");
  check(between.length === 1 && between[0].chip.label.startsWith("decides which ×2 · raises ×1"),
        "at the text's own boxes, the steps between two boxes are one arrow that counts what it holds",
        JSON.stringify(between.map(e => e.chip.label)));
  check(MV.layout(MIX).edges.filter(e => e.from === "inst" && e.to === "blur").length === 1 &&
        MV.layout(MIX).edges.filter(e => e.from === "inst" && e.to === "expand").length === 1,
        "while every state is drawn, nothing is merged");
  check(CL.edges.some(e => e.chip.label.startsWith("decides which")), "a step that decides which says so on its chip",
        JSON.stringify(CL.edges.map(e => e.chip.label)));
}
// AND ON EVERY SAMPLE THAT DECLARES A CHAIN. The planted fixture has no premise-conclusion
// structure, and the J-PAL sample showed what that hid: a step on an intermediary conclusion is
// argued for (its premises infer it), which the checker counted and the page, reading only drawn
// edges, did not -- "1 argued" beside the census's "2" (26 Sep 2026).
const SAMPLES = path.join(REPO, "samples"), SAMPLE_LAYOUTS = [];
for (const dir of fs.readdirSync(SAMPLES)) {
  const d = path.join(SAMPLES, dir);
  if (!fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d).filter(f => f.endsWith(".argdown"))) {
    const file = path.join(d, f);
    if (!/^mechanism:/m.test(fs.readFileSync(file, "utf8"))) continue;
    const pyS = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                             file, "--format", "json"], { encoding: "utf8" })).shape.chain;
    const MS = MV.model(graphOf(file));
    const differ = Object.keys(pyS).filter(k => k !== "question" &&
      !same(k === "gaps" ? MS.profile.gaps.map(g => g.message) : MS.profile[k], pyS[k]));
    check(differ.length === 0, `${dir.slice(0, 40)}: the page and the checker agree on its chain`,
          differ.map(k => `${k}: python ${JSON.stringify(pyS[k])} js ${JSON.stringify(MS.profile[k])}`).join("\n          "));
    SAMPLE_LAYOUTS.push([dir, MV.layout(MS), MS]);
  }
}
// Every appraisal claim in the fixture is wired to something, so the case is planted here: a claim
// with a step and no relation, which Argdown's map selection drops from the drawn nodes.
const lone = toGraph(argdown.run({ input: fs.readFileSync(CHAIN, "utf8") + `
[Nobody asked the judges]: Nobody asked the judges what would move them. #appraisal
    {fidelity: "imputation", warrant: "a missing first link", causes: {from: policy, to: order, sign: "+"}}
`, ...RUN }));
check(!lone.nodes.some(n => n.label === "Nobody asked the judges") &&
      MV.model(lone).steps.some(s => s.claim.title === "Nobody asked the judges"),
      "a claim the map never draws still reaches the chain (read from the parser, not the nodes)");

console.log("\nthe layout");
const L = MV.layout(M);
check(same(L, MV.layout(MV.model(graphOf(CHAIN)))), "is a pure function of the chain: the same file lays out the same");
const laneOf = {}; L.lanes.forEach(l => { laneOf[l.level] = l; });
const inLane = Object.entries(L.nodes).every(([id, p]) => {
  const lv = (M.actors[M.states[id].actor] || {}).level, ln = laneOf[lv];
  return ln && p.y >= ln.y && p.y + p.h <= ln.y + ln.h;
});
check(inLane, "every state sits inside its own level's band");
check(L.edges.every(e => L.nodes[e.from] && L.nodes[e.to]), "every arrow has both ends laid out");
check(Object.keys(L.nodes).includes("risk"), "the appraisal's own states are laid out too, so switching the layer moves nothing");
check(L.edges.some(e => e.back), "a loop is laid out as a loop (a back edge), not unrolled");

// NOTHING SITS ON ANYTHING. The first build put chips under arrowheads and on one another, and ran
// the actors' names under the first column's boxes (J-PAL sample, 26 Sep 2026). Mutation: set
// CHIP_DY to [0] -> the J-PAL sample's chips collide; drop HEAD from the node y -> boxes cover
// the lane heads.
function clashes(L) {
  const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                       Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const chips = L.edges.map(e => ({ x: e.chip.x - e.chip.w / 2, y: e.chip.y - e.chip.h / 2, w: e.chip.w, h: e.chip.h }));
  const boxes = Object.values(L.nodes);
  const heads = L.edges.filter(e => e.stub).map(e => { const [x, y] = e.curve[3];
    return e.back ? { x: x - 7, y: y - 14, w: 14, h: 14 } : { x, y: y - 6, w: 12, h: 12 }; });
  let n = 0;
  chips.forEach((c, i) => { if (boxes.some(b => ov(c, b)) || heads.some(h => ov(c, h)) ||
                                chips.some((d, j) => j !== i && ov(c, d))) n++; });
  const laneOf = {}; L.lanes.forEach(l => { laneOf[l.y] = l; });
  const underHead = Object.values(L.nodes).filter(p => !L.lanes.some(l => p.y >= l.y + 24 && p.y + p.h <= l.y + l.h)).length;
  return { chips: n, underHead };
}
check(same(clashes(L), { chips: 0, underHead: 0 }), "no chip sits on a box, an arrowhead or another chip, and no box on a lane's heading",
      JSON.stringify(clashes(L)));
check(L.edges.every(e => e.kind === "null" ? !e.stub : !!e.stub),
      "every arrow but a null's ends on a short solid stub carrying its head");

// A TRIAL-SHAPED CHAIN, planted: an intervention one lane up, fanning to four stacked states that
// each act on one outcome, and two findings of opposite sign on one step. It is the shape of the
// FAST falls trial (26 Sep 2026), where the first drawing bundled the fan and said "mixed".
const FAN_TEXT = `===
title: "Fan"
mechanism:
    question: "How would the programme reduce falls?"
    actors:
        team: {label: "Therapists", level: meso}
        person: {label: "Stroke survivor", level: micro}
    states:
        prog: {label: "Programme", actor: team, role: intervention}
        a: {label: "Exercise", actor: person}
        b: {label: "Home safety", actor: person}
        c: {label: "Balance", actor: person}
        d: {label: "Mobility", actor: person}
        falls: {label: "Falls", actor: person, role: outcome}
===

[Ends]: The programme is worth offering.
` + ["a", "b", "c", "d"].map(x => `
[P${x}]: The programme changes ${x}. {causes: {from: prog, to: ${x}, sign: "+", basis: study}}
    +> [Ends]

[${x}F]: Change in ${x} lowers falls. {causes: {from: ${x}, to: falls, sign: "-", basis: asserted}}
    +> [Ends]
`).join("") + `
[Exercise raised falls]: An earlier trial found exercise raised falls. {causes: {from: a, to: falls, sign: "+", basis: study}}
    +> [Ends]
`;
const FAN = graphOf.fromText(FAN_TEXT);
const FL = MV.layout(MV.model(FAN));
// Mutation: drop the sign from the group key -> one "mixed" arrow.
check(FL.edges.length === 9, "the planted fan is read whole: nine arrows", FL.edges.length);
check(same(FL.edges.filter(e => e.from === "a" && e.to === "falls").map(e => e.chip.label).sort(), ["lowers", "raises"]),
      "two findings of opposite sign on one step are two arrows, each saying which way",
      JSON.stringify(FL.edges.filter(e => e.from === "a" && e.to === "falls").map(e => e.chip.label)));
// NO ARROW RUNS THROUGH A BOX it does not start or end at. Mutation: drop the `blocked` test ->
// the stacked states' arrows to the outcome leave from their tops and run up through the boxes
// above them; drop the bottom ports altogether -> passes, but the next check fails.
const through = L2 => L2.edges.filter(e => {
  const P = e.curve;
  for (let i = 1; i < 40; i++) {
    const t = i / 40, u = 1 - t, x = u*u*u*P[0][0] + 3*u*u*t*P[1][0] + 3*u*t*t*P[2][0] + t*t*t*P[3][0],
          y = u*u*u*P[0][1] + 3*u*u*t*P[1][1] + 3*u*t*t*P[2][1] + t*t*t*P[3][1];
    if (Object.entries(L2.nodes).some(([id, n]) => id !== e.from && id !== e.to &&
        x > n.x + 2 && x < n.x + n.w - 2 && y > n.y + 2 && y < n.y + n.h - 2)) return true;
  }
  return false;
}).map(e => e.from + ">" + e.to);
check(same(through(FL), []), "no arrow in the fan runs through a box it does not start or end at", JSON.stringify(through(FL)));
// Mutation: drop the bottom ports -> every arrow leaves the intervention's right side.
check(FL.edges.filter(e => e.from === "prog").every(e => e.curve[0][1] === FL.nodes.prog.y + FL.box.h),
      "an intervention fanning to states in the lane below leaves from its bottom edge, one point each");
check(same(clashes(FL), { chips: 0, underHead: 0 }), "and nothing in it sits on anything", JSON.stringify(clashes(FL)));
// Mutation: drop the left-edge cost -> the folded fan's route chip is placed off the drawing.
{
  // FAST's own case: a long state name makes a long route chip, from a port near the left edge.
  const LONG_TEXT = FAN_TEXT
    .replace('a: {label: "Exercise"', 'a: {label: "Balance and strength exercise done"')
    .replace('{causes: {from: a, to: falls, sign: "+", basis: study}}', '{causes: {from: a, to: falls, sign: "+", basis: study, given: ["without home safety"]}}')
    .replace('        falls: {label: "Falls", actor: person, role: outcome}',
             '        falls: {label: "Falls", actor: person, role: outcome}\n        fallers: {label: "Having a fall at all", actor: person, role: outcome}') + `
[Direct]: The programme lowers falls. {causes: {from: prog, to: falls, sign: "-", basis: study, given: ["over 12 months"]}}
    +> [Ends]

[No fewer fallers]: The programme did not change who fell at all. {causes: {from: prog, to: fallers, sign: "0", basis: study}}
    +> [Ends]
`;
  const LONG = MV.model(graphOf.fromText(LONG_TEXT));
  const LF = MV.layout(LONG, { folded: Object.fromEntries(MV.foldable(LONG, "text").map(v => [v, true])) });
  check([FL, LF].every(G2 => G2.edges.every(e => e.chip.x - e.chip.w / 2 >= 4)), "no chip is placed off the drawing's left edge",
        JSON.stringify(LF.edges.map(e => [e.chip.label, Math.round(e.chip.x - e.chip.w / 2)])));
}

// PATTERN IS FIDELITY (F5): an arrow is dashed as the closest of its claims' boxes would be.
// Mutation: make every arrow solid, or dash it by tier again -> fails.
const fidOK = L2 => L2.edges.every(e => {
  const closest = e.steps.map(s => s.fidelity).sort((p, q) => MV.FIDELITY.indexOf(p) - MV.FIDELITY.indexOf(q))[0];
  return e.fidelity === closest;
});
check(fidOK(L) && fidOK(FL), "an arrow's pattern is the fidelity of the closest of its claims, on the boxes' own ladder");
check(same(MV.FIDELITY_DASH, { quotation: "", paraphrase: "6 2", compression: "4 3", interpretation: "2 3", imputation: "7 2 1.5 2" }),
      "and that ladder is the Reasons map's border ladder, dash for dash");
{
  const css = fs.readFileSync(path.join(HERE, "src", "argdown-live-map.js"), "utf8");
  const ladder = Object.fromEntries([...css.matchAll(/\.alm-f-(\w+) \.alm-box\{stroke-dasharray:([\d. ]+)[;}]/g)].map(m => [m[1], m[2]]));
  check(["paraphrase", "compression", "interpretation", "imputation"].every(f => ladder[f] === MV.FIDELITY_DASH[f]),
        "read from the Reasons map's own stylesheet, so the two cannot drift apart", JSON.stringify(ladder));
}

// A FEEDBACK SYSTEM IS A BLOCK, and sequence runs between systems. Laid out by depth-first order
// alone, Wimmer's one system ran across a dozen columns. Mutation: drop the system packing -> the
// planted system's seven states spread over more than three columns.
{
  const SM = MV.model(graphOf(path.join(FIXTURE, "system.argdown")));
  const SL = MV.layout(SM);
  const xs = SM.profile.feedback[0].states.map(v => SL.nodes[v].x);
  check((Math.max(...xs) - Math.min(...xs)) / 300 + 1 <= Math.ceil(Math.sqrt(xs.length)),
        "a feedback system is laid out as a block about the square root of its size wide", JSON.stringify(xs));
  // THE APPRAISAL NEVER RESHAPES THE TEXT. The fixture's only loop through `order` is closed by the
  // appraisal. Mutation: find the blocks from every layer's steps -> the text's own step is drawn
  // as a returning arc.
  const ore = L.edges.find(e => e.from === "order" && e.to === "reoff" && e.layer === "text" && e.kind === "step");
  check(ore && !ore.back, "a loop closed only by the appraisal does not turn the text's own step back on itself");
}

console.log("\nseveral chains (profile 1.5)");
{
  const MC = MV.model(graphOf(CHAINSF));
  const D = MV.chainModel(MC, "drought"), W = MV.chainModel(MC, "water");
  // Mutation: build a chain's model from every step -> each carries all five.
  check(same(D.ids, ["drought", "migration", "forest"]) && same(W.ids, ["forest", "water", "wells"]) &&
        D.steps.length === 2 && W.steps.length === 2,
        "a chain is drawn from its own steps and the states they touch", JSON.stringify([D.ids, W.ids]));
  check(D.states.forest.role === "outcome" && W.states.forest.role === "condition",
        "and each casts the shared state in its own role", JSON.stringify([D.states.forest.role, W.states.forest.role]));
  check(W.question === "What does forest loss do to the water table?" && same(W.chain.shared, { forest: ["drought"] }),
        "and asks its own question, knowing what it shares", JSON.stringify(W.chain));
  check(same(MV.collapseModel(W).chain, W.chain), "the text's own boxes keep the chain being shown");
  // Mutation: keep every actor in a chain's model -> the water chain's micro lane names the families.
  check(same(Object.keys(D.actors).sort(), ["families", "region"]) && same(Object.keys(W.actors).sort(), ["families", "region"]) &&
        same(MV.layout(MV.chainModel(MV.model(graphOf.fromText(fs.readFileSync(CHAINSF, "utf8")
          .replace("families: {label: \"Farming families\", level: micro}", "families: {label: \"Farming families\", level: micro}\n        fishers: {label: \"Fishers\", level: micro}"))), "drought")).lanes.map(l => l.actors), [["The region"], ["Farming families"]]),
        "a chain's lanes name only the actors its states use", JSON.stringify(Object.keys(D.actors)));
}

console.log("\nsteps between states stacked in one column");
// MERTON'S TWO-WAY LOOP (26 Sep 2026): the in-group's definition and the out-group's defence sat in
// one column with a box between; both steps were drawn as returning arcs from the boxes' bottoms,
// down one line and through the boxes, and the reader saw one arrow of the loop. Mutations: treat a
// column step as a returning arc -> it runs through a box; drop the side-by-side offset -> the two
// directions of a pair share one line.
{
  const SM = MV.model(graphOf(SYSF));
  const inside = (e, L) => {
    const P = e.curve, at = (t, k) => { const u = 1 - t; return u*u*u*P[0][k] + 3*u*u*t*P[1][k] + 3*u*t*t*P[2][k] + t*t*t*P[3][k]; };
    return Object.keys(L.nodes).filter(v => v !== e.from && v !== e.to).filter(v => { const b = L.nodes[v];
      return Array.from({ length: 19 }, (_, i) => (i + 1) / 20).some(t => at(t, 0) > b.x + 2 && at(t, 0) < b.x + b.w - 2 && at(t, 1) > b.y + 2 && at(t, 1) < b.y + b.h - 2); });
  };
  const layouts = [MV.layout(SM), MV.layout(MV.collapseModel(SM))];
  const col = layouts.flatMap(L => L.edges.filter(e => e.vertical || e.side).map(e => [e, L]));
  check(col.some(([e]) => e.vertical) && col.some(([e]) => e.side), "the planted system has both kinds: boxes adjacent, and a box between",
        JSON.stringify(col.map(([e]) => e.from + ">" + e.to + (e.side ? " side" : " straight"))));
  const through = col.filter(([e, L]) => inside(e, L).length).map(([e, L]) => e.from + ">" + e.to + " through " + inside(e, L).join(","));
  check(through.length === 0, "no step between two states in one column runs through a box", JSON.stringify(through));
  // Planted: each of two stacked states answers the institutions back -- one adjacent, one with a box between.
  const TW = MV.model(graphOf.fromText(fs.readFileSync(SYSF, "utf8") + `
[Expansion shapes institutions]: Expansion reshapes institutions. {causes: {from: expand, to: inst, sign: "+", basis: asserted}}
    +> [Ends]

[Contraction shapes institutions]: Contraction reshapes institutions. {causes: {from: contract, to: inst, sign: "+", basis: asserted}}
    +> [Ends]
`)), TL = MV.layout(TW);
  const two = TL.edges.filter(e => (e.vertical || e.side) && TL.edges.some(f => f.from === e.to && f.to === e.from && (f.vertical || f.side)));
  const kinds = new Set(two.map(e => e.side ? "side" : "straight"));
  const shared = two.filter(e => two.some(f => f.from === e.to && f.to === e.from && f.curve[0][0] === e.curve[3][0]));
  check(kinds.size === 2 && shared.length === 0 && two.every(e => inside(e, TL).length === 0),
        "a pair running both ways is two arrows, side by side or either side of the column, never down one line",
        JSON.stringify(two.map(e => e.from + ">" + e.to + (e.side ? " side " : " straight ") + e.curve[0][0] + "→" + e.curve[3][0])));
}

console.log("\njoint causes and states across levels (profile 1.4)");
{
  const JM = MV.model(graphOf(JOINTF)), JL = MV.layout(JM);
  const lane = lv => JL.lanes.find(l => l.level === lv);
  const n = JL.nodes.norm;
  // Mutation: place a spanning state in its actor's lane only -> one lane high.
  check(n.y < lane("macro").y + lane("macro").h && n.y + n.h > lane("micro").y + 26 && same(n.levels, ["macro", "micro"]),
        "a state across levels is one box running down through both lanes", JSON.stringify({ n, lanes: JL.lanes.map(l => [l.y, l.h]) }));
  const ids = Object.keys(JL.nodes);
  check(!ids.some((a, i) => ids.slice(i + 1).some(b => {
    const p = JL.nodes[a], q = JL.nodes[b];
    return Math.min(p.x + p.w, q.x + q.w) > Math.max(p.x, q.x) && Math.min(p.y + p.h, q.y + q.h) > Math.max(p.y, q.y); })),
        "and no box is drawn over another");
  // CROWDED COLUMN. On the Coleman-boat reading a spanning box was put first in every lane and
  // covered six states of its top lane that came after it in its column. Planted: a macro state, a
  // micro state and a second spanning state, all in the shared expectation's column. Mutations: put
  // spanning states first in every lane -> boxes overlap; drop the side-by-side split -> the two
  // spanning boxes overlap.
  const CROWD = MV.model(graphOf.fromText(fs.readFileSync(JOINTF, "utf8")
    .replace("        norm:", `        law:     {label: "A law", actor: society}
        habit:   {label: "A habit", actor: person}
        trust:   {label: "Trust", actor: society, levels: [macro, micro]}
        norm:`) + `
[Compliance makes law]: Compliance becomes law. {causes: {from: act, to: law, sign: "+", basis: asserted}}
    +> [Rules become practice]

[Compliance makes habit]: Compliance becomes habit. {causes: {from: act, to: habit, sign: "+", basis: asserted}}
    +> [Rules become practice]

[Compliance makes trust]: Compliance builds trust. {causes: {from: act, to: trust, sign: "+", basis: asserted}}
    +> [Rules become practice]
`));
  const CL = MV.layout(CROWD), cids = Object.keys(CL.nodes);
  const sameCol = ["law", "habit", "trust", "norm"].every(v => Math.abs(CL.nodes[v].x - CL.nodes.norm.x) < 200);
  const clash = cids.flatMap((a, i) => cids.slice(i + 1).filter(b => { const p = CL.nodes[a], q = CL.nodes[b];
    return Math.min(p.x + p.w, q.x + q.w) > Math.max(p.x, q.x) && Math.min(p.y + p.h, q.y + q.h) > Math.max(p.y, q.y); }).map(b => a + "/" + b));
  check(sameCol && clash.length === 0 && CL.nodes.law.y < CL.nodes.norm.y && CL.nodes.habit.y > CL.nodes.norm.y + CL.nodes.norm.h - 1,
        "in a crowded column, a spanning box sits below its top lane's states and above its bottom lane's, and beside another spanning box",
        JSON.stringify({ sameCol, clash }));
  const je = JL.edges.find(e => e.from === "belief" && e.to === "act");
  check(same(je.jointly, ["desire"]) && je.stems.length === 1 && je.stems[0].state === "desire" && !!je.junction,
        "a joint step is one arrow with a stem from its co-cause to a bar", JSON.stringify({ j: je.jointly, stems: je.stems.length }));
  // Mutation: keep only the side route for a stem -> it runs through the belief's box.
  const pts = je.stems[0].path.match(/-?[\d.]+/g).map(Number);
  const P = [[pts[0], pts[1]], [pts[2], pts[3]], [pts[4], pts[5]], [pts[6], pts[7]]];
  const at = (t, k) => { const u = 1 - t; return u*u*u*P[0][k] + 3*u*u*t*P[1][k] + 3*u*t*t*P[2][k] + t*t*t*P[3][k]; };
  const through = ids.filter(v => v !== "desire" && v !== "act").filter(v => {
    const b = JL.nodes[v];
    return Array.from({ length: 19 }, (_, i) => (i + 1) / 20).some(t => at(t, 0) > b.x + 2 && at(t, 0) < b.x + b.w - 2 && at(t, 1) > b.y + 2 && at(t, 1) < b.y + b.h - 2); });
  check(through.length === 0, "the stem goes round the boxes between, not through them", JSON.stringify(through));
  // Mutation: key groups without `jointly` -> the joint step and a solo one merge into one arrow.
  const SOLO = MV.model(graphOf.fromText(fs.readFileSync(JOINTF, "utf8") + `
[Belief alone]: Belief alone moves people. {causes: {from: belief, to: act, sign: "+", basis: asserted}}
    +> [Rules become practice]
`));
  check(MV.layout(SOLO).edges.filter(e => e.from === "belief" && e.to === "act").length === 2,
        "a step that holds only with a co-cause is not merged with one that holds alone");
  // Mutation: drop `jointly` from the routes foldSteps makes -> the route loses its stem.
  const JF = MV.layout(JM, { folded: { belief: true } });
  const route = JF.edges.find(e => e.route && e.from === "rule" && e.to === "act");
  check(!!route && same(route.jointly, ["desire"]) && route.stems.length === 1,
        "a route through a joint step holds only with its co-cause too", JSON.stringify(route && route.jointly));
  // A co-cause with no role of its own: nothing else would keep it on the page.
  const JN = MV.model(graphOf.fromText(fs.readFileSync(JOINTF, "utf8").replace("actor: person, role: condition}", "actor: person}")));
  const JE = MV.layout(JN, { folded: Object.fromEntries(MV.foldable(JN, "text").map(v => [v, true])), ends: true });
  check(JE.edges.length === 1 && !JE.setAside.includes("desire") && JE.edges[0].stems.length === 1,
        "folded to its ends, the co-cause of a route is kept, not set aside", JSON.stringify({ aside: JE.setAside, n: JE.edges.length }));
}

console.log("\npath folding");
// FOLDING DRAWS, IT DOES NOT MOVE (F3). Mutation: lay the folded chain out afresh -> boxes move.
const FM = MV.model(FAN);
const FA = MV.layout(FM, { folded: { a: true } });
check(Object.keys(FL.nodes).every(v => same(FL.nodes[v], FA.nodes[v])), "folding a state moves no box");
check(FA.edges.every(e => e.from !== "a" && e.to !== "a") && same(FA.folded, ["a"]), "the folded state has no arrows of its own");
const viaA = FA.edges.filter(e => e.route).map(e => e.chip.label).sort();
// Mutation: drop mulSign (keep the first step's sign) -> both routes say "raises".
check(same(viaA, ["lowers · via Exercise", "raises · via Exercise"]),
      "each route through it says which way it runs: raises then lowers is lowers", JSON.stringify(viaA));
const lowers = FA.edges.find(e => e.route && e.chip.label.startsWith("lowers"));
// Mutation: take the stronger step's backing -> "evidence".
check(lowers.tier === "asserted" && lowers.steps[0].parts.length === 2,
      "a route is backed only as well as its weakest step, and keeps both steps' claims", lowers.tier);
const ends = MV.layout(FM, { folded: Object.fromEntries(MV.foldable(FM, "text").map(v => [v, true])), ends: true });
check(same(MV.foldable(FM).sort(), ["a", "b", "c", "d"]), "the foldable states are those the chain runs into and out of");
// THE ENDS ARE THE INTERVENTION'S ROUTES TO ITS OUTCOMES. Mutation: drop the `ends` filter -> the
// J-PAL sample's other causes and dead ends stay drawn.
for (const [dir, , SM] of SAMPLE_LAYOUTS) {
  const SE = MV.layout(SM, { folded: Object.fromEntries(MV.foldable(SM, "text").map(v => [v, true])), ends: true });
  const role = v => (SM.states[v] || {}).role;
  check(SE.edges.length > 0 && SE.edges.every(e => role(e.from) === "intervention" && role(e.to) === "outcome") && SE.setAside.length > 0,
        `${dir.slice(0, 40)}: folded to its ends, only the intervention's routes to the outcomes are drawn, the rest set aside`,
        JSON.stringify({ edges: SE.edges.map(e => e.from + ">" + e.to), aside: SE.setAside }));
}
{
  const FE = MV.layout(M, { folded: Object.fromEntries(MV.foldable(M, "text").map(v => [v, true])), ends: true });
  check(FE.noLine && !FE.ends && FE.edges.length > 0 && FE.setAside.length === 0,
        "where no route runs from the intervention to an outcome, nothing is set aside and the page says why", JSON.stringify({ noLine: FE.noLine, n: FE.edges.length }));
}
check(same(ends.edges.map(e => e.chip.label).sort(), ["lowers · 4 routes", "raises · via Exercise"]),
      "folded to the ends, the chain is the intervention's routes to its outcome", JSON.stringify(ends.edges.map(e => e.chip.label)));
{
  // The fixture has a null on order -> reoff and a loop reoff -> prison -> reoff.
  const FX = MV.layout(M, { folded: { reoff: true } }), FP = MV.layout(M, { folded: { prison: true } });
  check(FX.hidden.findings > 0, "a null finding touching a folded state is counted, not silently dropped", JSON.stringify(FX.hidden));
  // The fixture's loop runs back through the appraisal: a rival or appraisal step and the text's
  // own are never joined into one route, and that is counted too.
  check(FP.hidden.crossLayer > 0, "and so is a pair of steps from different voices, never joined", JSON.stringify(FP.hidden));
  const LOOP = MV.model(graphOf.fromText(`===
title: "Loop"
mechanism:
    question: "Does it feed itself?"
    actors:
        p: {label: "People", level: micro}
    states:
        x: {label: "Worry", actor: p, role: intervention}
        y: {label: "Checking", actor: p}
        z: {label: "Relief", actor: p, role: outcome}
===

[Ends]: Worry sustains itself.

[W]: Worry drives checking. {causes: {from: x, to: y, sign: "+"}}
    +> [Ends]

[C]: Checking feeds worry. {causes: {from: y, to: x, sign: "+"}}
    +> [Ends]

[R]: Checking brings relief. {causes: {from: y, to: z, sign: "+"}}
    +> [Ends]
`));
  const LL = MV.layout(LOOP, { folded: { y: true } });
  check(LL.hidden.loops === 1, "and so is a loop that folding would close on one state", JSON.stringify(LL.hidden));
  // Mutation: count any voice into and any voice out as foldable -> `order` is offered.
  check(!MV.foldable(M, "text").includes("order") && MV.foldable(M, "text").includes("work") && MV.foldable(M).includes("order"),
        "a state is foldable only where one voice runs both into it and out of it -- `order` in the appraisal's, not the text's",
        JSON.stringify([MV.foldable(M, "text"), MV.foldable(M)]));
  // Mutation: drop the stranded count -> 0.
  check(MV.layout(M, { folded: { reoff: true } }).hidden.stranded > 0,
        "a step with no route on through a folded state is counted too",
        JSON.stringify(MV.layout(M, { folded: { reoff: true } }).hidden));
}

for (const [dir, SL] of SAMPLE_LAYOUTS)
  check(same(clashes(SL), { chips: 0, underHead: 0 }), `${dir.slice(0, 40)}: nothing sits on anything`, JSON.stringify(clashes(SL)));
for (const [dir, , SM] of SAMPLE_LAYOUTS) {
  const SF = MV.layout(SM, { folded: Object.fromEntries(MV.foldable(SM, "text").map(v => [v, true])) });
  check(SF.edges.every(e => e.chip.x - e.chip.w / 2 >= 4), `${dir.slice(0, 40)}: folded to its ends, every chip is on the drawing`);
}

console.log("\na map with no chain");
const plain = graphOf(path.join(REPO, "samples", "Darwin 1859 - Natural selection", "darwin-natural-selection.argdown"));
check(plain.mechanism === null, "carries no mechanism");
check(MV.model(plain) === null, "and the page builds no model");

/* ------------------------------------------------------------ the page, under real clicks */
let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.executablePath(); }
catch (e) {
  if (process.env.IPS_REQUIRE_BROWSER) { console.log("\nFAIL — Playwright's Chromium is required here and is not installed."); process.exit(1); }
  console.log("\nSKIPPED the browser half — Playwright's Chromium is not installed here.");
  chromium = null;
}
if (chromium) {
  console.log("\nthe page, driven with real clicks");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mechanism-view-"));
  const withChain = path.join(tmp, "chain.html"), without = path.join(tmp, "plain.html");
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), CHAIN, "--source-root", FIXTURE, "-o", withChain], { stdio: "pipe" });
  execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"),
    path.join(REPO, "samples", "Darwin 1859 - Natural selection", "darwin-natural-selection.argdown"), "-o", without], { stdio: "pipe" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));

    await page.goto("file://" + without);
    await page.waitForTimeout(500);
    // Mutation: drop the `mechOffer` call from render -> the button is never offered here either,
    // and the next check (on the chain) fails instead. Drop the `!has` test -> this one fails.
    check(await page.locator("#mechbtn").isHidden(), "a map with no chain is not offered the arrangement");

    await page.goto("file://" + withChain);
    await page.waitForTimeout(700);
    check(await page.locator("#mechbtn").isVisible(), "a map with a chain is offered it");
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(300);
    check(await page.locator("#mech").isVisible() && await page.locator("#map").isHidden(),
          "choosing it shows the chain in place of the map");

    const drawnAppraisal = () => page.evaluate(() => document.querySelectorAll('#mech svg [data-layer="appraisal"]').length);
    const textBoxes = () => page.evaluate(() => [...document.querySelectorAll('#mech svg .st[data-layer="text"]')].map(g => g.getAttribute("transform")));
    // Mutation: start `layers.appraisal` true -> fails.
    check(await drawnAppraisal() === 0, "the appraisal is off by default: nothing of it is drawn");
    // Three appraisal claims carry steps; the fourth supports one of them and asserts none, so it is
// nothing this view could show. The control counts what IT hides.
check(/3 hidden/.test(await page.locator(".amech-tog.appr").innerText()),
      "but its control says how many additions it is hiding");
    check(await page.locator(".amech-banner").isHidden(), "and no banner is shown");
    const before = await textBoxes();

    await page.locator(".amech-tog.appr").click();
    await page.waitForTimeout(150);
    check(await drawnAppraisal() > 0 && await page.locator(".amech-banner").isVisible(),
          "switched on, the appraisal is drawn under a standing banner");
    // Mutation: call `layout` inside `apply` over the visible steps only -> the boxes move.
    check(same(before, await textBoxes()), "switching the layer moves none of the text's own states");

    // The appraisal's view of a text step is named in the panel only while the layer is on.
    const clickChip = async (layer, edge) => page.locator(`#mech .chip[data-layer="${layer}"][data-edge="${edge}"][data-kind="step"]`).first().click();

    // A NULL FINDING AND A SELECTION LINK ARE DRAWN APART from the causal step between the same
    // states. Mutation: drop `kindOf(s)` from the layout's group key -> the null and the selection
    // fold into the "-" arrow and these fail.
    // textContent, not innerText: Playwright's innerText reads nothing from SVG text.
    const chipText = kind => page.evaluate(k => {
      const e = document.querySelector(`#mech .chip[data-layer="text"][data-edge="order>reoff"][data-kind="${k}"] text`);
      return e ? e.textContent : ""; }, kind);
    check((await chipText("step")).startsWith("lowers"), "the text's own step is drawn as its step, in words", await chipText("step"));
    check(/^no effect/.test(await chipText("null")), "the text's null finding is drawn apart, saying so", await chipText("null"));
    check(/selection/.test(await chipText("selection")), "and the selection link apart again", await chipText("selection"));
    check(await page.evaluate(() => { const g = document.querySelector('#mech g[data-kind="null"]');
            const p = g && g.querySelector("path.ed"); return !!p && /amech-bar-/.test(p.getAttribute("marker-end") || "") && !g.querySelector("path.stub"); }),
          "a null finding carries no arrowhead but a bar: nothing is brought about, and nothing passes");
    // ONE MEANING PER CHANNEL (F5). Mutation: give the rival view back its red -> fails.
    const rivalStroke = await page.evaluate(() => { const p = document.querySelector('#mech g[data-layer="rival"] path.ed');
      return p ? getComputedStyle(p).stroke : ""; });
    check(rivalStroke && !/rgb\(204, 59, 59\)|rgb\(176, 48, 48\)/.test(rivalStroke) && !/^rgb\((\d+), (\d+), (\d+)\)$/.test(rivalStroke) ||
          (() => { const m = rivalStroke.match(/rgb\((\d+), (\d+), (\d+)\)/); return m && !(+m[1] > +m[2] + 60 && +m[1] > +m[3] + 60); })(),
          "a rival view is not drawn in red, which means attack everywhere else on the page", rivalStroke);
    await clickChip("text", "order>reoff");
    await page.waitForTimeout(150);
    check(/appraisal on this step/i.test(await page.locator(".amech-side").innerText()),
          "on, the panel names the appraisal of the step");
    await page.locator(".amech-tog.appr").click();
    await page.waitForTimeout(150);
    // Mutation: drop the `layers.appraisal ?` guard before appraisalNotes -> fails.
    const sideOff = await page.locator(".amech-side").innerText();
    check(!/appraisal/i.test(sideOff), "off again, the panel says nothing of it", sideOff.slice(0, 200));
    check(await drawnAppraisal() === 0, "and nothing of it is drawn");

    // THE CHIP OPENS ITS OWN ARROW. The rival view runs beside the text's step order -> reoff, and
    // its hit stroke lay over the text's chip. Mutation: draw chips into the edge group (gE)
    // instead of the chip layer (gC) -> the click lands on the rival arrow, or times out.
    await page.locator(".amech-side button[data-back]").click().catch(() => {});
    await clickChip("text", "order>reoff");
    await page.waitForTimeout(150);
    const side = await page.locator(".amech-side").innerText();
    check(/Fewer reoffend after orders/.test(side) && !/Prison deters/.test(side),
          "the text's chip opens the text's arrow, not the rival beside it", side.slice(0, 200));

    await page.locator(".amech-side button[data-claim]").first().click();
    await page.waitForTimeout(600);
    const marked = await page.evaluate(() => {
      const m = document.querySelector("#mstext mark, #mstext .hl, #mstext [class*=hit]");
      return m ? m.textContent : "";
    });
    check(/Fewer people reoffend/.test(marked), "a claim reaches its passage in the manuscript", marked.slice(0, 120));

    // THE HEAD RIDES A SOLID STUB. Mutation: put marker-end back on the dashed path -> fails.
    check(await page.evaluate(() => { const g = document.querySelector('#mech g[data-layer="rival"][data-kind="step"]');
            const main = g && g.querySelector("path.ed:not(.stub)"), stub = g && g.querySelector("path.stub");
            return !!(stub && stub.getAttribute("marker-end") && !stub.getAttribute("stroke-dasharray") && !main.getAttribute("marker-end")); }),
          "a dashed arrow's head sits on a short solid stub, not wherever the dashes end");

    // FOCUS. Choosing a state fades every step not on a path through it. Mutation: make
    // applyFocus a no-op -> nothing is faded.
    await page.locator(".amech-side button[data-back]").click().catch(() => {});
    await page.locator('#mech .st[data-state="work"]').click();
    await page.waitForTimeout(150);
    const lit = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")).sort());
    check(same(lit, ["order>work", "work>reint"]), "choosing a state leaves only the paths through it", JSON.stringify(lit));
    check(/only the paths through this state/.test(await page.locator(".amech-side").innerText()), "and the panel says so");
    await page.locator(".amech-side button[data-back]").click();
    await page.waitForTimeout(150);
    check(await page.evaluate(() => document.querySelectorAll("#mech svg .dim").length) === 0, "and the whole chain comes back");

    // ONLY WHAT THE TEXT TESTED. Mutation: drop the `show` test from `visible` -> nothing changes.
    const nEdges = () => page.evaluate(() => document.querySelectorAll("#mech svg g[data-edge]:not(.chip)").length);
    const all = await nEdges();
    await page.locator("#mech select[data-show]").selectOption("tested");
    await page.waitForTimeout(150);
    const tested = await nEdges();
    check(tested > 0 && tested < all, "showing only what the text tested hides the asserted steps", `${all} -> ${tested}`);
    await page.locator("#mech select[data-show]").selectOption("all");
    await page.waitForTimeout(150);
    check(await nEdges() === all, "and every step returns");

    // THE DRAWN PATTERN IS THE FIDELITY LADDER. Mutation: dash by tier, or draw everything solid -> fails.
    const ladder = MV.FIDELITY_DASH;
    const drawnDash = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .map(g => [g.getAttribute("data-fidelity"), (g.querySelector("path.ed:not(.stub)").getAttribute("stroke-dasharray") || "")]));
    check(drawnDash.length > 0 && drawnDash.every(([f, d]) => d === ladder[f]) && drawnDash.some(([f]) => f !== "quotation"),
          "every arrow is drawn in its claims' fidelity pattern, as their boxes are", JSON.stringify(drawnDash.slice(0, 6)));

    // FOLDING, DRIVEN. Mutation: drop the data-fold handler -> the state stays drawn.
    await page.locator('#mech .st[data-state="work"]').click();
    await page.waitForTimeout(150);
    await page.locator('.amech-side button[data-fold="work"]').click();
    await page.waitForTimeout(250);
    check(await page.locator('#mech .st[data-state="work"]').count() === 0, "folding a state takes its box off the chain");
    const routeChip = await page.evaluate(() => [...document.querySelectorAll('#mech .chip text')].map(t => t.textContent).find(t => /via/.test(t)) || "");
    check(/raises · via/.test(routeChip), "and draws the route through it, saying so", routeChip);
    check(/Folded/i.test(await page.locator(".amech-side").innerText()), "the panel lists what is folded");
    await page.locator('.amech-side button[data-unfold="*"]').click();
    await page.waitForTimeout(250);
    check(await page.locator('#mech .st[data-state="work"]').count() === 1 && await nEdges() === all, "and Unfold all restores the whole chain");
    await page.locator("#mech [data-foldall]").click();
    await page.waitForTimeout(250);
    check(await page.locator("#mech [data-foldall]").innerText() === "Unfold the chain" &&
          await page.evaluate(() => document.querySelectorAll("#mech svg g[data-route]").length) > 0,
          "Intervention → outcomes folds every state between, and offers the whole chain back");
    await page.locator("#mech [data-foldall]").click();
    await page.waitForTimeout(250);

    await page.locator('#view [data-v="reasons"]').click();
    await page.waitForTimeout(300);
    check(await page.locator("#map").isVisible() && await page.locator("#mech").isHidden(),
          "Reasons brings the map back");

    // AN EXPLANATORY CHAIN, DRIVEN: the loop marked on every state in it, shown alone on a click,
    // the condition drawn apart from an intervention, the ends named for what the text has.
    const loopHtml = path.join(tmp, "loop.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), path.join(FIXTURE, "loop.argdown"), "-o", loopHtml], { stdio: "pipe" });
    await page.goto("file://" + loopHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    // Mutation: drop the badge loop in drawNodes -> no marks.
    const loopMarked = await page.evaluate(() => [...document.querySelectorAll("#mech .loopmark")].map(m => m.closest(".st").getAttribute("data-state")).sort());
    check(same(loopMarked, ["check", "worry"]), "every state in the loop carries the loop's mark", JSON.stringify(loopMarked));
    await page.locator('#mech .st[data-state="check"] .loopmark').click();
    await page.waitForTimeout(200);
    const litL = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")).sort());
    // Mutation: drop the loop branch in focusSets -> everything stays lit.
    check(same(litL, ["check>worry", "worry>check"]), "clicking it shows that loop alone", JSON.stringify(litL));
    check(/Showing one loop/.test(await page.locator(".amech-side").innerText()) && /reflexive/.test(await page.locator(".amech-side").innerText()),
          "and the panel names it, and says it is reflexive");
    await page.locator(".amech-side button[data-back]").click();
    await page.waitForTimeout(200);
    await page.locator(".amech-side button.amech-loop").first().click();
    await page.waitForTimeout(200);
    check(await page.evaluate(() => document.querySelectorAll("#mech svg g[data-edge].dim:not(.chip)").length) > 0,
          "the chain panel's loop row does the same");
    check(await page.evaluate(() => document.querySelector('#mech .st[data-state="worry"]').classList.contains("condition")),
          "a condition is drawn as one");
    // Mutation: hard-code the ends label again -> it says Intervention on a chain with none.
    check(await page.locator("#mech [data-foldall]").innerText() === "Conditions → outcomes",
          "and the ends are named for what this text has: conditions, not an intervention");

    // THE PLANTED SYSTEM, DRIVEN. It opens at the text's own boxes; its feedback system is one
    // lettered mark on each state in it, not a badge per loop; the mark shows the system alone.
    const sysHtml = path.join(tmp, "system.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), SYSF, "-o", sysHtml], { stdio: "pipe" });
    await page.goto("file://" + sysHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    // Mutation: open with keep.boxes false -> the parts are drawn.
    check(await page.locator('#mech .st[data-state="strat"]').count() === 1 && await page.locator('#mech .st[data-state="expand"]').count() === 0,
          "a map that declares wholes opens at the text's own boxes");
    await page.locator("#mech [data-boxes]").click();
    await page.waitForTimeout(400);
    check(await page.locator('#mech .st[data-state="expand"]').count() === 1 && await page.locator("#mech [data-boxes]").innerText() === "The text’s own boxes",
          "and Show every state draws each part, offering the boxes back");
    // Mutation: drop the LOOPS_LISTED filter -> a badge per loop again.
    const sysMarks = await page.evaluate(() => [...document.querySelectorAll("#mech .loopmark > text")].map(m => m.textContent));
    check(sysMarks.length > 0 && sysMarks.every(t => t === "⟳A"), "the feedback system is one lettered mark per state, not a badge per loop",
          JSON.stringify(sysMarks.slice(0, 6)));
    await page.locator('#mech .st[data-state="nego"] .loopmark').click();
    await page.waitForTimeout(200);
    // Mutation: drop the system branch of the side panel -> it shows the chain's profile instead.
    check(/Feedback system A/i.test(await page.locator(".amech-side").innerText()) &&
          /\b17 loops run through them/.test(await page.locator(".amech-side").innerText()),
          "and it shows the system, naming it and how many loops run through it");
    await page.locator(".amech-side button[data-short]").first().click();
    await page.waitForTimeout(200);
    const litS = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")).sort());
    check(same(litS, ["inst>power", "power>inst"]), "its shortest loop is offered, and shown alone", JSON.stringify(litS));

    // THE ABSTRACT'S FOLD DOES NOT COVER THE QUESTION. The J-PAL sample carries an abstract; the
    // fixture does not. Mutation: drop the #stage:has(#abs) rule from the template -> fails.
    const jpal = path.join(tmp, "jpal.html"), JS = path.join(REPO, "samples", "Bates et al 2012 - The Price is Wrong");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), path.join(JS, "bates-2012-price-is-wrong.argdown"),
                          "--source-root", JS, "-o", jpal], { stdio: "pipe" });
    await page.goto("file://" + jpal);
    await page.waitForTimeout(700);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const gap = await page.evaluate(() => {
      // The whole strip, not just the Abstract button: the strip also carries the map's
      // declarations about itself now (27 Sep 2026), and the question must clear all of it.
      const q = document.querySelector("#mech .amech-q"), b = document.querySelector("#orient");
      return b && q && b.offsetParent ? q.getBoundingClientRect().left - b.getBoundingClientRect().right : null; });
    check(gap !== null && gap >= 0, "the Abstract fold leaves the question uncovered", String(gap));

    // THE BOAT ON SCREEN (profile 1.4). Mutations: test only `from` for the "no link" mark -> the
    // co-cause is marked; drop co-causes from the focus walk -> clicking it lights nothing.
    const jointHtml = path.join(tmp, "joint.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), JOINTF, "-o", jointHtml], { stdio: "pipe" });
    await page.goto("file://" + jointHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    check(await page.locator('#mech .st[data-state="desire"] .gapmark').count() === 0,
          "a co-cause is not marked as linked to nothing");
    check(await page.locator('#mech [data-stem="desire"]').count() === 1 && await page.locator("#mech .junction").count() === 1,
          "its stem and bar are drawn");
    await page.locator('#mech .st[data-state="desire"]').click();
    await page.waitForTimeout(200);
    const litJ = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")).sort());
    check(same(litJ, ["act>norm", "belief>act"]), "clicking the co-cause lights the step it joins and what follows", JSON.stringify(litJ));
    await page.locator('#mech [data-edge="belief>act"] path.ed').first().click({ force: true });
    await page.waitForTimeout(200);
    check(/only together with Desire to fit in/.test(await page.locator(".amech-side").innerText()),
          "and the step's panel says it holds only together with it");

    // SEVERAL CHAINS ON SCREEN (profile 1.5). Mutations: open at every chain together -> the
    // first check fails; drop the ⇄ handler -> clicking it leaves the chain as it was.
    const chainsHtml = path.join(tmp, "chains.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), CHAINSF, "-o", chainsHtml], { stdio: "pipe" });
    await page.goto("file://" + chainsHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const drawnStates = () => page.evaluate(() => [...document.querySelectorAll("#mech .st")].map(g => g.getAttribute("data-state")).sort());
    check(same(await drawnStates(), ["drought", "forest", "migration"]) &&
          /Why does drought clear the forest/.test(await page.locator("#mech .amech-q").first().innerText()),
          "it opens at the first chain, asking that chain's question", JSON.stringify(await drawnStates()));
    await page.locator('#mech .st[data-state="forest"] .shared').click();
    await page.waitForTimeout(300);
    check(same(await drawnStates(), ["forest", "water", "wells"]) &&
          await page.locator('#mech .st[data-state="forest"]').evaluate(g => g.classList.contains("condition")),
          "⇄ on the shared state opens the other chain, where it is the condition", JSON.stringify(await drawnStates()));
    await page.locator("#mech select[data-chain]").selectOption("");
    await page.waitForTimeout(300);
    check((await drawnStates()).length === 5 && await page.locator("#mech .shared").count() === 0,
          "and every chain together draws the whole, with no ⇄ to follow");

    // THE SAME KIND ACROSS CASES ON SCREEN (profile 1.6). Mutations: drop the ≈ badge -> the first
    // check fails; drop the open-chain handler -> the chain does not change.
    const kindsHtml = path.join(tmp, "kinds.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), KINDSF, "-o", kindsHtml], { stdio: "pipe" });
    await page.goto("file://" + kindsHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const kinMarked = await page.evaluate(() => [...document.querySelectorAll("#mech .kin")].map(m => m.closest(".st").getAttribute("data-state")).sort());
    check(same(kinMarked, ["forest", "migr"]), "≈ marks each state whose kind another state shares, in whatever chain", JSON.stringify(kinMarked));
    await page.locator('#mech .st[data-state="migr"] .kin').click();
    await page.waitForTimeout(200);
    const kindSide = await page.locator(".amech-side").innerText();
    check(/2 states of one kind/.test(kindSide) && /Herders' migration/.test(kindSide) && /The same step in two cases/i.test(kindSide),
          "clicking it shows the kind: its states, where each is, and the step the cases share", kindSide.slice(0, 200));
    await page.locator(".amech-side button[data-open-chain]").click();
    await page.waitForTimeout(400);
    check(await page.locator("#mech select[data-chain]").inputValue() === "north" &&
          /Herders' migration/i.test(await page.locator(".amech-side h3").first().innerText()),
          "and opens the other case's chain at its state of that kind");

    // THE GENERAL AND ITS CASES ON SCREEN (profile 1.7). Mutation: drop the instance list from the
    // kind panel -> the check fails.
    const genHtml = path.join(tmp, "generals.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), GENERALSF, "-o", genHtml], { stdio: "pipe" });
    await page.goto("file://" + genHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    await page.locator('#mech .st[data-state="migr"] .kin').click();
    await page.waitForTimeout(200);
    const genSide = await page.locator(".amech-side").innerText();
    check(/general\s+Rural-urban migration/i.test(genSide) && /a case\s+Northern herders' migration/i.test(genSide) &&
          /The general step, and its cases/i.test(genSide) &&
          /Northern herders' migration → The north's forest cover is a case of Rural-urban migration → Forest cover/.test(genSide),
          "the kind's panel names the general state, its cases, and each case of the general step", genSide.slice(0, 400));
    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(fails ? `\n${fails} of ${checks} checks failed` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
