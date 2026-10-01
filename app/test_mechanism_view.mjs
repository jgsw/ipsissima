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
// AND ON A LINK OPENED INTO A ROUTE (profile 1.8). Mutation: keep opened edges in the walk ->
// `routes` and `opened` differ; drop `stated` in the chip -> no "via" on the arrow.
const VIAF = path.join(FIXTURE, "via.argdown");
{
  const pyV = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           VIAF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MVV = MV.model(graphOf(VIAF));
  const differ = Object.keys(pyV).filter(k => k !== "question" &&
    !same(k === "gaps" ? MVV.profile.gaps.map(g => g.message) : MVV.profile[k], pyV[k]));
  check(differ.length === 0 && pyV.opened.length === 1,
        "the page and the checker agree on a link the text opens into a route, walked once",
        differ.map(k => `${k}: python ${JSON.stringify(pyV[k])} js ${JSON.stringify(MVV.profile[k])}`).join("\n          "));
  const arrow = MV.layout(MVV).edges.filter(e => e.from === "order" && e.to === "reoff" && /lowers/.test(e.chip.label));
  // The appraisal's own order -> reoff step is drawn apart, and has no route of the text's.
  check(arrow.filter(e => / · via Stays in work \+1/.test(e.chip.label)).length === 1 && arrow.length === 2,
        "the opened link's arrow says which route it is, as a folded route's does", JSON.stringify(arrow.map(e => e.chip.label)));
}
// AND ON A BLOCKER, A FAILED ONE, AND STEPS THAT DIFFER BY CONDITION (profile 1.8, G1). Mutations:
// drop the flip in signsOf -> `routes` differ; draw no T-bar -> the drawing check fails.
const BLOCKF = path.join(FIXTURE, "blockers.argdown");
{
  const pyB = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           BLOCKF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MB = MV.model(graphOf(BLOCKF));
  const differ = Object.keys(pyB).filter(k => k !== "question" &&
    !same(k === "gaps" ? MB.profile.gaps.map(g => g.message) : MB.profile[k], pyB[k]));
  check(differ.length === 0 && pyB.blocked.length === 1 && pyB.strata.length === 1,
        "the page and the checker agree on a blocker, a failed one, and a step that differs by condition",
        differ.map(k => `${k}: python ${JSON.stringify(pyB[k])} js ${JSON.stringify(MB.profile[k])}`).join("\n          "));
  const blocked = MV.layout(MB).edges.filter(e => e.blockers.length);
  check(blocked.length === 1 && blocked[0].from === "hazard" && blocked[0].stems.length === 1 &&
        blocked[0].stems[0].blocks && !!blocked[0].stems[0].tbar && !blocked[0].junction,
        "a blocker is drawn as a stem ending in a bar, not a co-cause's junction", JSON.stringify(blocked.map(e => [e.key, e.stems])));
}
// AND ON PROCESS, FORMATION AND CONSTITUTION (profile 1.11): a cycle that does not settle, states
// that say what kind of occurrence they are, steps that make, keep, erode and transform, a process
// with no owner, and constitutive relations (to an actor; both at once; a rival causal reading).
// Mutations: drop the cycle's reach in walkChain -> `gaps` differ; drop `readings` -> it differs;
// key formation steps with the plain ones -> the chip says "raises"; draw ⊂ as a step -> an edge
// appears between meet and the group's states.
{
  const PROCF = path.join(FIXTURE, "process.argdown");
  const pyP = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           PROCF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MP = MV.model(graphOf(PROCF));
  const differ = Object.keys(pyP).filter(k => k !== "question" &&
    !same(k === "gaps" ? MP.profile.gaps.map(g => g.message) : MP.profile[k], pyP[k]));
  check(differ.length === 0 && pyP.form.form === "cycle" && pyP.form.settles === false && pyP.formation.length === 4 &&
        pyP.constitution.length === 3 && pyP.both.length === 1 && pyP.readings.length === 1 && pyP.aspects.length === 5,
        "the page and the checker agree on cycles, aspects, making and keeping, and constitution",
        differ.map(k => `${k}: python ${JSON.stringify(pyP[k])} js ${JSON.stringify(MP.profile[k])}`).join("\n          "));
  check(!pyP.gaps.some(g => /no state has `role|^the outcome /.test(g)),
        "a cycle is not asked where it starts or whether its outcome is reached", JSON.stringify(pyP.gaps));
  // With nothing leading into the loop from outside, only the cycle's own reach gets to the outcome.
  const inner = fs.readFileSync(PROCF, "utf8").replace(/\[Drift erodes ties\][^\n]*\n[^\n]*\n/, "")
                  .replace(/\[The split transforms the boundary\][^\n]*\n[^\n]*\n/, "");
  const MI = MV.model(graphOf.fromText(inner));
  check(!MI.profile.gaps.some(g => /^the outcome /.test(g.message)),
        "in a cycle, what the loop leads to is reached though nothing leads into the loop",
        JSON.stringify(MI.profile.gaps.map(g => g.message)));
  const LP = MV.layout(MP, { marks: MV.markSpec(MP, MP).marks });
  const word = (a, b) => LP.edges.filter(e => e.from === a && e.to === b).map(e => e.chip.label.split(" ·")[0]);
  check(same(word("meet", "ties"), ["maintains"]) && same(word("drift", "ties"), ["erodes"]) &&
        word("ties", "boundary").includes("makes") && same(word("split", "boundary"), ["transforms"]),
        "a step that makes, keeps, erodes or transforms says so in a verb on its arrow",
        JSON.stringify(LP.edges.map(e => [e.from, e.to, e.chip.label])));
  check(!LP.edges.some(e => e.from === "meet" && e.to !== "ties" && e.to !== "size") &&
        !LP.edges.some(e => e.from === "rite" && e.layer === "text"),
        "a constitutive relation is never drawn as an arrow", JSON.stringify(LP.edges.map(e => [e.from, e.to, e.layer])));
  const foot = v => (LP.nodes[v].badges || []).filter(b => b.edge === "foot").map(b => b.kind);
  check(foot("meet").includes("constitutes") && foot("boundary").includes("constituted") && foot("rite").includes("constitutes"),
        "what makes something up, and what is made up, carry ⊂ and ⊃ at their foot", JSON.stringify({ meet: foot("meet"), boundary: foot("boundary"), rite: foot("rite") }));
  check(!!LP.nodes.drift, "a process with no owner is drawn, at its own level", JSON.stringify(Object.keys(LP.nodes)));
  // A state whose only tie is what it makes up is still drawn, before its whole (the health-system
  // map's flows were left out, and their ⊂ with them). Mutation: drop constitutions from `used`.
  const onlyMakes = fs.readFileSync(PROCF, "utf8").replace(/\[The rite only causes the boundary\][^\n]*\n[^\n]*\n/, "");
  const MO = MV.model(graphOf.fromText(onlyMakes)), LO = MV.layout(MO, { marks: MV.markSpec(MO, MO).marks });
  check(!!LO.nodes.rite && (LO.nodes.rite.badges || []).some(b => b.kind === "constitutes") &&
        LO.nodes.rite.x < LO.nodes.boundary.x && !LO.edges.some(e => e.from === "rite"),
        "a state that only makes something up is drawn, with its ⊂, before its whole, and with no arrow",
        JSON.stringify({ rite: LO.nodes.rite && [LO.nodes.rite.x, LO.nodes.rite.badges], boundary: LO.nodes.boundary && LO.nodes.boundary.x }));
}
// AND ON PROCESS-RELATIONAL TEXTS (profile 1.12): a doing of several actors together, a loop that
// keeps itself in being, steps that open and close possibilities, states not (yet) actual, and a
// whole and its part that make each other up. Mutations: drop `sustaining` -> it differs; read only
// the first actor's level -> the spanning check fails; key possibility steps with plain ones -> the
// chip says "lowers".
{
  const RELF = path.join(FIXTURE, "relations.argdown");
  const pyR = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           RELF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MR = MV.model(graphOf(RELF));
  const differ = Object.keys(pyR).filter(k => k !== "question" &&
    !same(k === "gaps" ? MR.profile.gaps.map(g => g.message) : MR.profile[k], pyR[k]));
  check(differ.length === 0 && pyR.sustaining.length === 1 && pyR.mutual.length === 1 && pyR.statuses.length === 2 &&
        pyR.formation.filter(r => r[3] === "possibility").length === 2,
        "the page and the checker agree on possibility, status, mutual constitution and loops that keep themselves going",
        differ.map(k => `${k}: python ${JSON.stringify(pyR[k])} js ${JSON.stringify(MR.profile[k])}`).join("\n          "));
  const LR = MV.layout(MR, { marks: MV.markSpec(MR, MR).marks });
  const word = (a, b) => LR.edges.filter(e => e.from === a && e.to === b).map(e => e.chip.label.split(" ·")[0]);
  check(same(word("quota", "grafting"), ["closes off"]) && word("grafting", "surplus")[0].startsWith("opens up"),
        "a step on a possibility says it opens it up or closes it off", JSON.stringify(LR.edges.map(e => [e.from, e.to, e.chip.label])));
  const two = MV.model(graphOf.fromText(fs.readFileSync(RELF, "utf8").replace("actor: [fishers, fish]", "actor: [fishers, fishery]")));
  check(two.profile.spanning.some(r => r[0] === "fishing" && same(r[1], ["practice", "beings"])),
        "a state of several actors runs across all their levels", JSON.stringify(two.profile.spanning));
  const top = v => (LR.nodes[v].badges || []).filter(b => b.edge === "top").map(b => b.kind);
  check(top("grafting").includes("possible") && top("surplus").includes("open") && !top("fishing").some(k => k === "possible" || k === "open"),
        "what is not (yet) actual is marked ◌ or … by the layout, and nothing else is", JSON.stringify({ grafting: top("grafting"), surplus: top("surplus") }));
}
// AND ON CAUSAL REASONING (profile 1.13, after Johansson et al. 2024): an association with a common
// cause drawn, singular and general steps, a general step from one case, a goal and a contrast.
// Mutations: walk associations as steps -> `routes` and the no-arrow check fail; drop common_causes
// -> it differs; give associations a head -> the head check fails.
{
  const REAF = path.join(FIXTURE, "reasoning.argdown");
  const pyA = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           REAF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MA = MV.model(graphOf(REAF));
  const differ = Object.keys(pyA).filter(k => k !== "question" &&
    !same(k === "gaps" ? MA.profile.gaps.map(g => g.message) : MA.profile[k], pyA[k]));
  check(differ.length === 0 && pyA.associations.length === 1 && same(pyA.common_causes, [["cousins", "cash", ["trust"]]]) &&
        pyA.goal === "explain" && pyA.contrast === "in banks and stock" && pyA.one_case.length === 1,
        "the page and the checker agree on associations, common causes, scope, goal and contrast",
        differ.map(k => `${k}: python ${JSON.stringify(pyA[k])} js ${JSON.stringify(MA.profile[k])}`).join("\n          "));
  check(!pyA.routes.some(r => r.start === "cousins"), "an association is never walked as a route", JSON.stringify(pyA.routes));
  const LA = MV.layout(MA);
  const assoc = LA.edges.filter(e => e.from === "cousins" && e.to === "cash");
  check(assoc.length === 1 && assoc[0].kind === "association" && !assoc[0].head && /^associated/.test(assoc[0].chip.label),
        "an association is drawn as a line with no head, labelled associated", JSON.stringify(assoc.map(e => [e.kind, e.head, e.chip.label])));
}
// AND ON STOCKS, CHANCES AND ACCOUNTS (profile 1.14): a stock with an inflow and an outflow, a loop
// through the inflow, a step on a chance, an account on the block and a chain, an extrapolation.
// Mutations: drop stock_loops from the page -> it differs; give "stock" no word -> the chip says
// "raises"/"lowers".
{
  const STOF = path.join(FIXTURE, "stocks.argdown");
  const pyT = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           STOF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MT = MV.model(graphOf(STOF));
  const differ = Object.keys(pyT).filter(k => k !== "question" &&
    !same(k === "gaps" ? MT.profile.gaps.map(g => g.message) : MT.profile[k], pyT[k]));
  check(differ.length === 0 && pyT.stocks.length === 2 && pyT.chances.length === 1 && pyT.stock_loops.length === 1 &&
        pyT.extrapolated.length === 1 && same(pyT.account, ["regularity", "intra-action"]),
        "the page and the checker agree on stocks, chances, stock loops, accounts and extrapolations",
        differ.map(k => `${k}: python ${JSON.stringify(pyT[k])} js ${JSON.stringify(MT.profile[k])}`).join("\n          "));
  const LT = MV.layout(MT);
  const word = (a, b) => LT.edges.filter(e => e.from === a && e.to === b).map(e => e.chip.label.replace(/ ↻$/, ""));
  check(same(word("births", "population"), ["flows into"]) && same(word("catch", "population"), ["flows out of"]) &&
        same(word("population", "collapse"), ["makes less likely"]),
        "a flow says it flows into or out of its stock, and a chance step says likelier or less likely",
        JSON.stringify(LT.edges.map(e => [e.from, e.to, e.chip.label])));
}
// AND ON BRIDGES (profile 1.15): a step that is a premise of a named causal scheme takes the
// chain on into the argument; a bridge with no step premise. Mutations: drop the PCS walk from
// graph.mechanism.reasons -> `taken_up` differs; drop bridgeScheme's single-name rule -> `bridges`.
{
  const BRF = path.join(FIXTURE, "bridges.argdown");
  const pyB = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           BRF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MB = MV.model(graphOf(BRF));
  const differ = Object.keys(pyB).filter(k => k !== "question" &&
    !same(k === "gaps" ? MB.profile.gaps.map(g => g.message) : MB.profile[k], pyB[k]));
  check(differ.length === 0 && pyB.taken_up.length === 1 && pyB.bridges.length === 3,
        "the page and the checker agree on bridges and on where the argument takes the chain on",
        differ.map(k => `${k}: python ${JSON.stringify(pyB[k])} js ${JSON.stringify(MB.profile[k])}`).join("\n          "));
}
// AND ON WAVE 4's CONSTRUCTS (profile 1.9): a moderator, necessity and sufficiency, a design, a
// measure, attributions, stances and rival accounts of one outcome. Mutations: drop accountsOf ->
// `accounts` differs; drop the moderator stems -> the ring check fails; drop the "needed for"
// word -> the chip says "raises".
const STORIESF = path.join(FIXTURE, "stories.argdown");
{
  const pyS = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           STORIESF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MS = MV.model(graphOf(STORIESF));
  const differ = Object.keys(pyS).filter(k => k !== "question" &&
    !same(k === "gaps" ? MS.profile.gaps.map(g => g.message) : MS.profile[k], pyS[k]));
  check(differ.length === 0 && pyS.moderated.length === 2 && pyS.accounts.length === 1 && pyS.measures.length === 1,
        "the page and the checker agree on moderation, necessity, evidence, measures and rival accounts",
        differ.map(k => `${k}: python ${JSON.stringify(pyS[k])} js ${JSON.stringify(MS.profile[k])}`).join("\n          "));
  const LS = MV.layout(MS);
  const mod = LS.edges.filter(e => e.from === "aid" && e.to === "diet");
  check(mod.length === 1 && mod[0].stems.filter(sm => sm.ring).map(sm => [sm.state, sm.ring.effect]).length === 2,
        "each moderator is drawn as a stem to a ring on the arrow it moderates", JSON.stringify(mod.map(e => e.stems)));
  const need = LS.edges.filter(e => e.from === "income" && e.to === "diet");
  check(need.length === 1 && /^needed for · not alone/.test(need[0].chip.label),
        "a necessary cause that is not enough alone says so on its arrow", JSON.stringify(need.map(e => e.chip)));
  // A step in two periods is two arrows, each with its period and its own ring (Valentino).
  // Mutation: drop the period from the edge key -> one arrow, one ring.
  const TWO = MV.model(graphOf.fromText(fs.readFileSync(STORIESF, "utf8").replace(
    'modifies: [{by: income, effect: weakens}, {by: schools, effect: "0"}]}}',
    'period: "the 1990s", modifies: {by: income, effect: weakens}}}\n\n[Later]: Later.\n    {causes: {from: aid, to: diet, sign: "+", basis: study, period: "2010-2012", modifies: {by: income, effect: "0"}}}\n    +> [Feed the poor]')));
  const two = MV.layout(TWO).edges.filter(e => e.from === "aid" && e.to === "diet");
  check(two.length === 2 && two.every(e => e.stems.filter(sm => sm.ring).length === 1) &&
        two.some(e => / · the 1990s/.test(e.chip.label)) && two.some(e => / · 2010-2012/.test(e.chip.label)),
        "a step in two periods is two arrows, each naming its period and carrying its own moderator", JSON.stringify(two.map(e => e.chip.label)));
  // A state that only blocks or only moderates is still drawn, with its stem (James's verdicts on
  // the defences and on Marti and Gond's devices, 29 Sep 2026). Mutation: drop unless/modifies
  // from the layout's ordering -> neither box is drawn and no stem hangs from it.
  const ALONE = MV.layout(MV.model(graphOf.fromText(`===
mechanism:
    levels: [org, floor]
    actors:
        org: {label: "Org", level: org}
        staff: {label: "Staff", level: floor}
    states:
        hazard: {label: "Hazard", actor: staff, role: condition}
        defence: {label: "Defences hold", actor: org}
        devices: {label: "Devices", actor: org}
        loss: {label: "Loss", actor: staff, role: outcome}
===

[Aim]: A.

[H]: Hazards bring losses unless defended.
    {causes: {from: hazard, to: loss, sign: "+", basis: asserted, unless: defence, modifies: {by: devices, effect: strengthens}}}
    +> [Aim]
`)));
  const hl = ALONE.edges.filter(e => e.from === "hazard" && e.to === "loss")[0];
  check(!!ALONE.nodes.defence && !!ALONE.nodes.devices && hl && hl.stems.some(sm => sm.tbar) && hl.stems.some(sm => sm.ring),
        "a state that only blocks or only moderates is drawn, with its stem", JSON.stringify(Object.keys(ALONE.nodes)));
  // A step's time course reads in time order, and a null names its period (the badgers, James's
  // verdicts, 29 Sep 2026). Mutation: drop timeOf from the port sort -> "no effect" leaves above.
  const CULL = MV.layout(MV.model(graphOf.fromText(`===
mechanism:
    levels: [gov, farms]
    actors:
        govt: {label: "Government", level: gov}
        herds: {label: "Herds", level: farms}
    states:
        proactive: {label: "Proactive culling", actor: govt, role: condition}
        tbout: {label: "TB outside", actor: herds, role: outcome}
===

[Aim]: A.

[During]: During culling TB rose outside.
    {causes: {from: proactive, to: tbout, sign: "+", basis: study, period: "during culling"}}
    +> [Aim]

[After]: After culling it did not.
    {causes: {from: proactive, to: tbout, sign: "0", basis: study, period: "after culling ended"}}
    +> [Aim]
`)));
  const dur = CULL.edges.find(e => e.kind !== "null"), aft = CULL.edges.find(e => e.kind === "null");
  check(!!dur && !!aft && /after culling ended/.test(aft.chip.label) && (dur.curve[0][1] < aft.curve[0][1] || (dur.curve[0][1] === aft.curve[0][1] && dur.curve[0][0] < aft.curve[0][0])),
        "a null names its period, and a step's periods leave in time order, earliest first as a reader reads",
        JSON.stringify(CULL.edges.map(e => [e.chip.label, e.curve[0]])));
  // An arrow that holds several steps opens into one arrow each (James's verdict on "raises ×2").
  // Mutation: ignore opts.expand in layout -> still one arrow.
  const TWOMOD = MV.model(graphOf.fromText(`===
mechanism:
    levels: [field, actors]
    actors:
        field: {label: "Field", level: field}
        people: {label: "People", level: actors}
    states:
        theory: {label: "A new theory", actor: people, role: condition}
        devices: {label: "Devices", actor: field}
        backers: {label: "Backers", actor: people}
        exper: {label: "Experimentation", actor: people, role: outcome}
===

[Aim]: A.

[P2]: Devices moderate it.
    {causes: {from: theory, to: exper, sign: "+", basis: asserted, modifies: {by: devices, effect: strengthens}}}
    +> [Aim]

[P3]: Backers moderate it.
    {causes: {from: theory, to: exper, sign: "+", basis: asserted, modifies: {by: backers, effect: strengthens}}}
    +> [Aim]
`));
  const one = MV.layout(TWOMOD).edges.filter(e => e.from === "theory" && e.to === "exper");
  const opened = MV.layout(TWOMOD, { expand: { [one[0].base]: true } }).edges.filter(e => e.from === "theory" && e.to === "exper");
  check(one.length === 1 && one[0].steps.length === 2 && opened.length === 2 &&
        opened.every(e => e.expanded && e.steps.length === 1 && e.stems.filter(sm => sm.ring).length === 1),
        "an arrow of several steps opens into one arrow each, each with its own moderator",
        JSON.stringify(opened.map(e => [e.chip.label, e.stems.length])));
  // The evidence rests on a measure the text says is biased (MacNulty against Ripple). Mutation:
  // drop the rests stems -> no square on the arrow.
  const rest = LS.edges.filter(e => e.from === "diet" && e.to === "malnourish")[0];
  check(!!rest && rest.stems.some(sm => sm.square && sm.square.biased && sm.state === "survey"),
        "a step whose evidence rests on a biased measure carries a stem to a square, in the gap colour",
        JSON.stringify(rest && rest.stems));
  const att = LS.edges.filter(e => e.from === "choice" && e.to === "malnourish");
  check(att.length === 1 && / · intended by poor households$/.test(att[0].chip.label), "an attribution's type, and whose it is, is on its arrow", JSON.stringify(att.map(e => e.chip)));
}
// AND ON TIME (profile 1.8, G7): periods and a step on a trend. Mutation: drop the period from
// strataOf's key -> `strata` differ; drop the trend words -> the chip says "raises".
const TIMESF = path.join(FIXTURE, "times.argdown");
{
  const pyT = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           TIMESF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MT = MV.model(graphOf(TIMESF));
  const differ = Object.keys(pyT).filter(k => k !== "question" &&
    !same(k === "gaps" ? MT.profile.gaps.map(g => g.message) : MT.profile[k], pyT[k]));
  check(differ.length === 0 && pyT.trends.length === 1 && pyT.strata.length === 1,
        "the page and the checker agree on periods and on a step on a trend",
        differ.map(k => `${k}: python ${JSON.stringify(pyT[k])} js ${JSON.stringify(MT.profile[k])}`).join("\n          "));
  const tr = MV.layout(MT).edges.filter(e => e.from === "reoff" && e.to === "prison");
  check(tr.length === 1 && /^(▲ )?speeds/.test(tr[0].chip.glyph ? tr[0].chip.glyph + " " + tr[0].chip.label : tr[0].chip.label),
        "a step on a trend says it speeds or slows, not raises or lowers", JSON.stringify(tr.map(e => e.chip)));
}
// AND ON MAGNITUDE (profile 1.8, G3): sizes, and how much of a step runs by its route. Mutation:
// let openedOf ignore `share` -> `routes` and `opened` differ; drop sizeTag -> no value on the arrow.
const SIZESF = path.join(FIXTURE, "sizes.argdown");
{
  const pyZ = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           SIZESF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MZ = MV.model(graphOf(SIZESF));
  const differ = Object.keys(pyZ).filter(k => k !== "question" &&
    !same(k === "gaps" ? MZ.profile.gaps.map(g => g.message) : MZ.profile[k], pyZ[k]));
  check(differ.length === 0 && pyZ.sizes.length === 2 && pyZ.mediation.length === 2,
        "the page and the checker agree on sizes and on how much of a step runs by its route",
        differ.map(k => `${k}: python ${JSON.stringify(pyZ[k])} js ${JSON.stringify(MZ.profile[k])}`).join("\n          "));
  const sz = MV.layout(MZ).edges.filter(e => e.from === "order" && e.to === "reoff" && / · -0\.12/.test(e.chip.label));
  check(sz.length === 1 && !/via/.test(sz[0].chip.label),
        "a step's stated value is on its arrow, and a partial route is not labelled as the step", JSON.stringify(MV.layout(MZ).edges.map(e => e.chip.label)));
}
{
  // Two accounts that cannot both hold (Yellowstone). Mutation: drop disputedKey from the chip ->
  // neither arrow says "disputed"; drop disputedOf -> the profiles differ.
  const DTXT = fs.readFileSync(SIZESF, "utf8") + `
[A strong effect]: "Work strongly aids reintegration."
    {fidelity: "quotation", causes: {from: work, to: reint, sign: "+", basis: study, size: "strong"}}
    +> [Recommend]

[Only a modest effect]: "Work aids reintegration only modestly."
    {fidelity: "quotation", causes: {from: work, to: reint, sign: "+", basis: study, size: "modest"}}
    >< [A strong effect]
`;
  const DM = MV.model(graphOf.fromText(DTXT));
  const tmpD = path.join(os.tmpdir(), "disputed-" + process.pid + ".argdown");
  fs.writeFileSync(tmpD, DTXT);
  const pyD = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           tmpD, "--format", "json"], { encoding: "utf8" })).shape.chain;
  fs.unlinkSync(tmpD);
  const darrows = MV.layout(DM).edges.filter(e => e.from === "work" && e.to === "reint" && / · disputed/.test(e.chip.label));
  check(same(DM.profile.disputed, pyD.disputed) && pyD.disputed.length === 2 && darrows.length === 2,
        "two accounts set against each other are disputed in the checker and on both their arrows",
        JSON.stringify([pyD.disputed, DM.profile.disputed, MV.layout(DM).edges.map(e => e.chip.label)]));
}
// AND ON REGIMES AND A THRESHOLD (profile 1.8, G2). Mutation: ignore regimes in routes -> `routes`
// differ; drop the threshold words -> the chip reads a plain "raises".
const REGF = path.join(FIXTURE, "regimes.argdown");
{
  const pyR = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                           REGF, "--format", "json"], { encoding: "utf8" })).shape.chain;
  const MR = MV.model(graphOf(REGF));
  const differ = Object.keys(pyR).filter(k => k !== "question" &&
    !same(k === "gaps" ? MR.profile.gaps.map(g => g.message) : MR.profile[k], pyR[k]));
  check(differ.length === 0 && pyR.regimes.length === 2 && !pyR.routes.some(r => r.start === "order" && r.outcome === "prison"),
        "the page and the checker agree on regimes: no route is composed across two",
        differ.map(k => `${k}: python ${JSON.stringify(pyR[k])} js ${JSON.stringify(MR.profile[k])}`).join("\n          "));
  const th = MV.layout(MR).edges.filter(e => e.from === "order" && e.to === "work");
  check(th.length === 1 && /^raises past a threshold/.test(th[0].chip.label),
        "a step past a threshold says so on its arrow", JSON.stringify(th.map(e => e.chip.label)));
}
// AND ON WAVE 4'S FAULTS (28 Sep 2026): periods partition routes and loops; an objection the text
// voices is a rival view; a condition with only a null is linked; a chain of reported steps is
// walked on them. Each variant is written to a file so the checker reads the same text.
{
  const chainTxt = fs.readFileSync(CHAIN, "utf8"), timesTxt = fs.readFileSync(path.join(FIXTURE, "times.argdown"), "utf8");
  const variants = {
    "periods": timesTxt.replace("on: trend}", 'on: trend, period: "after the order ends"}'),
    "contested": chainTxt + '\n[Work pays the bills]: "Work lowers what the state spends." #contested\n    {fidelity: "quotation", causes: {from: work, to: cost, sign: "-", basis: asserted}}\n    -> [Recommend]\n',
    "null-condition": chainTxt.replace('        cost:    {label: "Cost", actor: state, role: outcome}',
      '        cost:    {label: "Cost", actor: state, role: outcome}\n        season:  {label: "Season of sentencing", actor: courts, role: condition}') +
      '\n[No season effect]: "The season of sentencing made no difference to reoffending."\n    {fidelity: "quotation", causes: {from: season, to: reoff, sign: "0", basis: study}}\n    +> [Recommend]\n',
    "reported-chain": chainTxt.replace('    question: "How would community orders reduce reoffending?"',
      '    question: "How would community orders reduce reoffending?"\n    chains:\n        told: {label: "The deterrence story the brief reports"}').replace(
      'causes: {from: order, to: reoff, sign: "+", basis: asserted}}\n    -> [Recommend]',
      'causes: {from: order, to: reoff, sign: "+", basis: asserted, chain: told}}\n    -> [Recommend]')
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mech-wave4-"));
  for (const [name, text] of Object.entries(variants)) {
    const f = path.join(dir, name + ".argdown");
    fs.writeFileSync(f, text);
    const pyX = JSON.parse(execFileSync(PY, [path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py"),
                                             f, "--format", "json"], { encoding: "utf8" })).shape.chain;
    const MX = MV.model(graphOf.fromText(text));
    const differ = Object.keys(pyX).filter(k => k !== "question" &&
      !same(k === "gaps" ? MX.profile.gaps.map(g => g.message) : MX.profile[k], pyX[k]));
    check(differ.length === 0, `the page and the checker agree on wave 4's case: ${name}`,
          differ.map(k => `${k}: python ${JSON.stringify(pyX[k])} js ${JSON.stringify(MX.profile[k])}`).join("\n          "));
  }
  fs.rmSync(dir, { recursive: true, force: true });
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

/* A LABEL TOO LONG FOR ITS BOX (James, 29 Sep 2026): cut at three lines, it hid what the state
 * was; and a state the text links to nothing, on the last column, had its "✕ no link in the text"
 * cut off by the drawing's edge ("✕ no l", on Valentino's second chain). */
const LONG_SRC = `===
mechanism:
    levels: [people]
    actors:
        p: {label: "People", level: people}
    states:
        a: {label: "A start", actor: p, role: intervention}
        b: {label: "The acceptability of explicitly hostile racial rhetoric, the norm of egalitarianism eroded over a decade", actor: p}
        c: {label: "Below it", actor: p, role: outcome}
        d: {label: "A message", actor: p, role: condition}
===

[Aim]: A.

[S1]: a raises b.
    {causes: {from: a, to: b, sign: "+", basis: asserted}}
    +> [Aim]

[S2]: a raises c.
    {causes: {from: a, to: c, sign: "+", basis: asserted}}
    +> [Aim]

[S3]: a raises d.
    {causes: {from: a, to: d, sign: "+", basis: asserted}}
    +> [Aim]
`;
console.log("\nlong labels, and room for what is said beside a box");
{
  const LM = MV.model(graphOf.fromText(LONG_SRC));
  const shut = MV.layout(LM, {}), open = MV.layout(LM, { open: { b: true } });
  const col = L0 => ["b", "c", "d"].map(v => L0.nodes[v]).sort((x, y) => x.y - y.y);
  check(shut.nodes.b.more && !shut.nodes.b.open && shut.nodes.b.lines.length === 3 && /…$/.test(shut.nodes.b.lines[2]) &&
        shut.nodes.b.h === shut.box.h,
        "a label longer than three lines is cut at three, and offers the rest", JSON.stringify(shut.nodes.b.lines));
  check(!shut.nodes.c.more, "a short one offers nothing");
  const below = v => col(open).filter(n => n.y > open.nodes[v].y);
  // Mutation: keep every row ROW apart -> the opened box runs over the one below it.
  check(open.nodes.b.open && open.nodes.b.lines.length > 3 && open.nodes.b.lines.join(" ") === LM.states.b.label &&
        open.nodes.b.h > shut.nodes.b.h,
        "opened, the box holds its whole label and is taller", JSON.stringify(open.nodes.b.lines));
  const stack = col(open);
  check(stack.every((n, i) => i === 0 || n.y >= stack[i - 1].y + stack[i - 1].h + 20),
        "and what was below it moves down: nothing in its column is overlapped", JSON.stringify(stack.map(n => [n.y, n.h])));
  check(below("b").every(n => n.y - col(shut).find(m => m.x === n.x && m.w === n.w && Math.abs(m.y - n.y) < 400).y >= 0) &&
        open.height > shut.height, "the lane grows with it, and so does the drawing", `${shut.height} -> ${open.height}`);
  check(same(MV.layout(LM, { open: { b: true } }), open), "the layout is still a pure function of what is opened");
  // Mutation: keep the 40px margin -> the words run past the drawing's right edge.
  check(shut.nodes.d.unlinked && shut.width >= shut.nodes.d.x + shut.nodes.d.w + 10 + 120,
        "a state the text links to nothing, on the last column, has the drawing's room for saying so",
        `${shut.nodes.d.x + shut.nodes.d.w} of ${shut.width}`);
  check(!shut.nodes.b.unlinked && !shut.nodes.a.unlinked, "and no other state is said to be unlinked");
}

/* NESTED LEVELS (30 Sep 2026): a choice, never the default, and a tree, not a chain read off the
 * list (Craver 2025; Ylikoski 2024). Mutations: nest from the list's order whatever the tree says
 * -> the siblings check fails; drop the contiguity test -> the refusal check fails. */
console.log("\nnested levels");
{
  const T = MV.nestTree(["nation", "elites", "citizens"], { parent: { elites: "nation", citizens: "nation" } });
  check(T && T.depth.elites === 1 && T.depth.citizens === 1 && T.last.nation === 2 && T.last.elites === 1,
        "a tree makes siblings: elites and citizens each one deep, inside the nation", JSON.stringify(T));
  const C = MV.nestTree(["a", "b", "c"], "chain");
  check(C && C.depth.c === 2 && C.last.a === 2, "a chain puts each level inside the one before");
  check(MV.nestTree(["a", "b", "c"], { parent: { c: "a" } }) === null,
        "a tree the list's order cannot draw (a child after a non-descendant) is refused, and the bands kept");
  check(MV.nestTree(["a", "b"], null) === null && MV.layout(M, {}).frames === null, "and bands are the default");
  const JM = MV.model(graphOf(JOINTF));
  const NL = MV.layout(JM, { nest: "chain" });
  const inside = (i, o) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;
  check(NL.frames && NL.frames.every((f, i) => i === 0 || inside(f, NL.frames[i - 1])),
        "nested, each frame lies inside the one around it", JSON.stringify(NL.frames));
  check(MV.audit(NL).hard.length === 0, "and the nested chart keeps every hard rule", JSON.stringify(MV.audit(NL).hard.slice(0, 3)));
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
// A CHIP SITS WHERE ITS LINE RUNS ALONE (27 Sep 2026). On the J-PAL sample 31 of 42 chips had
// another line through them; the second placement pass brings it to 22. Mutation: skip the second
// pass -> 31, and this fails.
{
  const bz = (a, b, c, d, t) => { const u = 1 - t; return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d; };
  const crossed = L => {
    const S = L.edges.map(e => { const P = e.curve; return Array.from({ length: 33 }, (_, u) => [bz(P[0][0], P[1][0], P[2][0], P[3][0], u / 32), bz(P[0][1], P[1][1], P[2][1], P[3][1], u / 32)]); });
    return L.edges.filter((e, i) => { const b = { x: e.chip.x - e.chip.w / 2 - 2, y: e.chip.y - 11, w: e.chip.w + 4, h: 22 };
      return S.some((sm, j) => j !== i && sm.some(([x, y]) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)); }).length;
  };
  const bates = SAMPLE_LAYOUTS.find(([dir]) => /Bates/.test(dir));
  check(!!bates && crossed(bates[1]) <= 24, "a chip is placed where no other line runs through it, wherever there is room",
        bates && `${crossed(bates[1])} of ${bates[1].edges.length} chips crossed`);
}
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
    check(/^(▼ )?lowers/.test(await chipText("step")), "the text's own step is drawn as its step, in words", await chipText("step"));
    // Mutation: drop the glyph -> fails. ▲ raises, ▼ lowers: read at a glance in a crowd.
    check((await chipText("step")).startsWith("▼ "), "and its chip leads with the direction glyph", await chipText("step"));
    // HOVER TIES A CHIP TO ITS LINE. Mutation: drop the mouseenter handler -> nothing fades.
    await page.locator('#mech .chip[data-layer="text"][data-edge="order>reoff"][data-kind="step"]').hover();
    await page.waitForTimeout(150);
    const hov = await page.evaluate(() => ({ on: document.querySelector("#mech svg").classList.contains("hovering"),
      hot: [...document.querySelectorAll("#mech g.hot[data-edge]")].map(g => g.getAttribute("data-edge")) }));
    check(hov.on && hov.hot.includes("order>reoff"), "hovering a chip lights its line and fades the rest", JSON.stringify(hov));
    await page.mouse.move(2, 2);
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
    check(await page.locator('#mech [data-stem="desire"]').count() === 1 && await page.locator('#mech .gate[data-gate="and"]').count() === 1,
          "its stem and AND gate are drawn");
    await page.locator('#mech .st[data-state="desire"]').click();
    await page.waitForTimeout(200);
    const litJ = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
      .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")).sort());
    check(same(litJ, ["act>norm", "belief>act"]), "clicking the co-cause lights the step it joins and what follows", JSON.stringify(litJ));
    await page.locator('#mech [data-edge="belief>act"] path.ed').first().click({ force: true });
    await page.waitForTimeout(200);
    check(/only together with Desire to fit in/.test(await page.locator(".amech-side").innerText()),
          "and the step's panel says it holds only together with it");

    // THE GUIDE, BY REAL CLICKS (James's verdict: a reader who has not read the conventions is
    // lost). Mutations: drop the bar button's handler -> the panel never shows the guide; drop the
    // edge from a guide step -> nothing is lit.
    const storiesHtml = path.join(tmp, "stories.html");
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), STORIESF, "-o", storiesHtml], { stdio: "pipe" });
    await page.goto("file://" + storiesHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    await page.locator('#mech .amech-bar [data-guide-go="0"]').click();
    await page.waitForTimeout(200);
    check(/Boxes and bands/i.test(await page.locator(".amech-side").innerText()), "Read this drawing opens on the boxes and bands");
    const titles = [];
    for (let i = 0; i < 14; i++) {
      const next = page.locator('.amech-side button:text-is("Next")');
      if (!(await next.count())) break;
      await next.click();
      await page.waitForTimeout(150);
      titles.push((await page.locator(".amech-side h3").first().innerText()).toLowerCase());
      if (/a moderator/.test(titles[titles.length - 1])) {
        const lit = await page.evaluate(() => [...document.querySelectorAll("#mech svg g[data-edge]:not(.chip)")]
          .filter(g => !g.classList.contains("dim")).map(g => g.getAttribute("data-edge")));
        check(lit.length === 1 && lit[0] === "aid>diet", "its moderator step lights the one arrow that has a ring", JSON.stringify(lit));
      }
    }
    check(["an arrow is a step the text asserts", "a view the text reports", "only together", "a moderator", "evidence read from a measure", "needed, enough, not alone"]
            .every(x => titles.includes(x)) && !titles.includes("unless"),
          "the guide steps through the marks this drawing has, and only those", JSON.stringify(titles));
    // AN ARROW OF SEVERAL STEPS OPENS ON A CLICK (James's verdict on "raises ×2"). Mutation: drop
    // the data-expand handler -> still one arrow.
    const twoSrc = path.join(tmp, "twomod.argdown"), twoHtml = path.join(tmp, "twomod.html");
    fs.writeFileSync(twoSrc, `===
mechanism:
    levels: [field, actors]
    actors:
        field: {label: "Field", level: field}
        people: {label: "People", level: actors}
    states:
        theory: {label: "A new theory", actor: people, role: condition}
        devices: {label: "Devices", actor: field}
        backers: {label: "Backers", actor: people}
        exper: {label: "Experimentation", actor: people, role: outcome}
===

[Aim]: A.

[P2]: Devices moderate it.
    {causes: {from: theory, to: exper, sign: "+", basis: asserted, modifies: {by: devices, effect: strengthens}}}
    +> [Aim]

[P3]: Backers moderate it.
    {causes: {from: theory, to: exper, sign: "+", basis: asserted, modifies: {by: backers, effect: strengthens}}}
    +> [Aim]
`);
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), twoSrc, "-o", twoHtml], { stdio: "pipe" });
    await page.goto("file://" + twoHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const arrowsOf = () => page.locator('#mech svg g[data-edge="theory>exper"]:not(.chip)').count();
    const before2 = await arrowsOf();
    await page.locator('#mech g.chip[data-edge="theory>exper"]').first().click({ force: true });
    await page.waitForTimeout(200);
    await page.locator('.amech-side [data-expand]').click();
    await page.waitForTimeout(300);
    check(before2 === 1 && await arrowsOf() === 2 && await page.locator('#mech circle.ring[data-moderator]').count() === 2,
          "clicking Draw each step apart opens the arrow into two, each with its ring", String(before2));

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
    // THE WHOLE LABEL, ZOOM, AND THE FOLD STATE OF THE CHART (29 Sep 2026). Mutations: drop the
    // pill's click handler -> the box stays three lines; drop the zoom handler -> the size stays;
    // leave `mech` out of the identifier -> the restore opens Reasons.
    const longSrc = path.join(tmp, "long.argdown"), longHtml = path.join(tmp, "long.html");
    fs.writeFileSync(longSrc, LONG_SRC);
    execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), longSrc, "-o", longHtml], { stdio: "pipe" });
    await page.goto("file://" + longHtml);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const boxOf = v => page.evaluate(v => { const r = document.querySelector(`#mech .st[data-state="${v}"] rect.box`).getBoundingClientRect();
                                            return { y: r.top, h: r.height }; }, v);
    const b0 = await boxOf("b"), low0 = await boxOf(b0.y < (await boxOf("c")).y ? "c" : "d");
    check(await page.locator('#mech .st[data-state="b"] .more').count() === 1 &&
          await page.locator('#mech .st[data-state="c"] .more').count() === 0,
          "a box whose label is cut carries a ▼ more pill, and no other does");
    await page.locator('#mech .st[data-state="b"] .more').click();
    await page.waitForTimeout(300);
    const b1 = await boxOf("b");
    const texts = await page.evaluate(() => [...document.querySelectorAll('#mech .st[data-state="b"] > text')].map(t => t.textContent));
    check(b1.h > b0.h + 10 && texts.join(" ").includes("over a decade") &&
          (await page.locator('#mech .st[data-state="b"] .more').textContent()).includes("less"),
          "clicking it shows the whole label in a taller box, and offers ▲ less", `${b0.h} -> ${b1.h}: ${texts.join(" / ")}`);
    const lowName = b0.y < (await boxOf("c")).y ? "c" : "d";
    check((await boxOf(lowName)).y > low0.y, "and the box below makes room");
    const svgW = () => page.evaluate(() => document.querySelector("#mech svg").getBoundingClientRect().width);
    const w0 = await svgW();
    await page.locator('#mech [data-zoom="in"]').click();
    await page.waitForTimeout(150);
    const w1 = await svgW();
    check(Math.abs(w1 / w0 - 1.2) < 0.02 && (await page.locator('#mech [data-zoom="1"]').innerText()) === "120%",
          "+ zooms the chart in a step, and says the size", `${w0} -> ${w1}`);
    await page.locator("#mech .amech-stage").hover();
    await page.keyboard.press("Control+Equal");
    await page.waitForTimeout(150);
    check((await page.locator('#mech [data-zoom="1"]').innerText()) === "144%", "and so does Ctrl = on the keyboard",
          await page.locator('#mech [data-zoom="1"]').innerText());
    await page.keyboard.press("Control+Minus");
    await page.waitForTimeout(150);
    // The fold state names the chart as it is, and puts it back on a fresh page.
    await page.locator("#helpbtn").click();
    await page.locator("#help button", { hasText: "About Ipsissima" }).click();
    await page.waitForTimeout(200);
    const line = await page.locator("#foldstateid").innerText();
    check(/\bview=mech\b/.test(line) && /\bmmore=b\b/.test(line) && /\bzoom=1\.2\b/.test(line),
          "the fold state names the Mechanism chart, the opened box and the zoom", line);
    await page.goto("file://" + longHtml);
    await page.waitForTimeout(600);
    await page.locator("#helpbtn").click();
    await page.locator("#help button", { hasText: "About Ipsissima" }).click();
    await page.locator("#about button", { hasText: /^Debug$/ }).click();
    await page.locator("#foldstatein").fill(line);
    await page.locator("#foldstatego").click();
    await page.waitForTimeout(500);
    check(await page.locator("#mech").isVisible() &&
          (await page.locator('#mech .st[data-state="b"] .more').textContent()).includes("less") &&
          (await page.locator('#mech [data-zoom="1"]').innerText()) === "120%",
          "and Restore on a fresh page puts the chart back: the arrangement, the opened box and the zoom",
          await page.locator("#foldstateerr").innerText().catch(() => ""));

    // WHAT THE LEVELS ARE, ON THE PAGE (profile 1.10). Mutations: nest from the list whatever
    // `within:` says -> the tree check fails; offer the switch for `systems` -> the third fails;
    // show the banner for a declared tree -> the second fails.
    const LVL = "    levels: [macro, meso, micro]";
    const chainText = fs.readFileSync(CHAIN, "utf8");
    const levelsPage = async (extra, name) => {
      const src = path.join(tmp, name + ".argdown"), out = path.join(tmp, name + ".html");
      fs.writeFileSync(src, chainText.replace(LVL, LVL + "\n" + extra));
      execFileSync("node", [path.join(HERE, "build_argdown_viewer.mjs"), src, "--source-root", FIXTURE, "-o", out], { stdio: "pipe" });
      await page.goto("file://" + out);
      await page.waitForTimeout(600);
      await page.locator("#mechbtn").click();
      await page.waitForTimeout(400);
    };
    await page.goto("file://" + withChain);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const capOf = () => page.locator("#mech svg text.caption").textContent();
    check(/does not say what ordering/.test(await capOf()), "a map that does not say what its levels are is said not to, on the drawing");
    await page.locator("#mech [data-nest]").click();
    await page.waitForTimeout(300);
    check(await page.locator("#mech .amech-nestbanner").isVisible() && await page.locator("#mech rect.frame").count() === 3,
          "nesting it draws frames, under a banner saying they are an assumption");
    await levelsPage("    ordering: composition\n    within: {meso: macro, micro: macro}", "tree");
    check(/parts within wholes, as the reconstructor reads them/.test(await capOf()), "a declared ordering is said in words");
    await page.locator("#mech [data-nest]").click();
    await page.waitForTimeout(300);
    const fr = await page.evaluate(() => [...document.querySelectorAll("#mech rect.frame")].map(r => [r.getAttribute("data-level"), +r.getAttribute("x")]));
    const xOf = lv => (fr.find(f => f[0] === lv) || [])[1];
    check(fr.length === 3 && xOf("meso") === xOf("micro") && xOf("meso") > xOf("macro") &&
          !(await page.locator("#mech .amech-nestbanner").isVisible()),
          "a declared tree nests as a tree -- siblings side by side, one deep -- with no banner", JSON.stringify(fr));
    await levelsPage("    ordering: systems", "systems");
    check(await page.locator("#mech [data-nest]").count() === 0 && /separate systems/.test(await capOf()),
          "levels declared as separate systems are not offered nesting");

    // WHAT THE LAYOUT ESTIMATES, HELD TO WHAT THE BROWSER DRAWS (M11). The audit measures the
    // layout's geometry; these say that geometry is what is on screen. Mutations: draw a badge at
    // a fixed offset again -> the first fails; shrink the chip width estimate -> the second.
    await page.goto("file://" + withChain);
    await page.waitForTimeout(600);
    await page.locator("#mechbtn").click();
    await page.waitForTimeout(400);
    const fit = await page.evaluate(() => {
      const svg = document.querySelector("#mech svg");
      const bad = [];
      for (const chip of svg.querySelectorAll("g.chip")) {
        const r = chip.querySelector("rect").getBBox();
        for (const t of chip.querySelectorAll("text")) { const b = t.getBBox();
          if (b.x < r.x - 0.5 || b.x + b.width > r.x + r.width + 0.5) bad.push("chip " + chip.getAttribute("data-edge") + ": " + t.textContent); }
      }
      const heads = [...svg.querySelectorAll("text.lane-l")].map(t => t.getBBox().width);
      return { bad, heads };
    });
    check(fit.bad.length === 0, "every label's words fit the rectangle the layout gave it", fit.bad.join("; "));
    const est = MV.layout(MV.model(G), { marks: MV.markSpec(MV.model(G), MV.model(G)).marks }).lanes.map(l => l.head.w - 8);
    check(fit.heads.every((w, i) => w <= est[i] + 2), "every heading fits the width the layout reserved for it",
          JSON.stringify({ drawn: fit.heads.map(Math.round), reserved: est.map(Math.round) }));

    check(errors.length === 0, "no page errors", errors.join("; "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(fails ? `\n${fails} of ${checks} checks failed` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
