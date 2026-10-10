/* test_mechanism_lint.mjs — the editor's mechanism checks against the checker's, word for word.
 *
 *   node app/test_mechanism_lint.mjs                 # the public maps: fixtures, samples, the faults file
 *   node app/test_mechanism_lint.mjs --dir FOLDER    # and every map under FOLDER (the private corpus)
 *
 * ONE RULE, TWO LANGUAGES, HELD TOGETHER. argdown-mechanism-lint.js ports mechanism.py's local rules
 * so the editor can mark them where they are written. A port drifts; this is what stops it. On every
 * map with a mechanism it runs both and requires:
 *   - every finding the editor shows is one the checker gives, in the same words;
 *   - every finding the checker gives is shown by the editor, unless it is one of the census's
 *     questions about the whole chain, which the editor deliberately leaves to the checker (GLOBAL
 *     below). A new local rule in mechanism.py fails here until it is ported or listed.
 * And it checks the locator: every finding lands on the key, value or token it names.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { spawn } from "child_process";
import { argdown } from "@argdown/core";
import { toGraph, RUN } from "./argdown-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const require = createRequire(import.meta.url);
const L = require(path.join(HERE, "src", "argdown-mechanism-lint.js"));
const MV = require(path.join(HERE, "src", "argdown-mechanism.js"));
const CHECK = path.join(REPO, "ipsissima-mcp", "src", "ipsissima_mcp", "check_argdown.py");
// THE CHECKER'S OWN PYTHON, as test_mechanism_view.mjs finds it: a bare `python3` without PyYAML
// cannot read the `mechanism:` block, and every finding would then "disagree".
const VENV = path.join(REPO, ".venv", "bin", "python3");
const PY = fs.existsSync(VENV) ? VENV : "python3";

let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok && detail) console.log(`        ${String(detail).split("\n").join("\n        ")}`);
};

/** The census's questions about the whole chain: the checker's, not the editor's. */
const GLOBAL = [
  // Kept narrow on purpose: a broad pattern here would excuse a local rule nobody ported. Each is a
  // question the census asks of the whole chain or the whole map, and the editor leaves it there.
  /^chain `[^`]+` is declared but no step of the text's own is marked /,
  /^`goal: (intervene|attribute)`, and no /,
  /^<[^>]+> step \d+ names the bridge `[^`]+`, and none of its premises states a step/,
  /^the reading policy says `method: parallel`/,
  /^`depth: none` says the mechanism is not mapped, and \d+ step/,
  // A `via` route set against the other steps the map gives.
  /^`via` opens .+ into a route the text's steps do not give/,
  // An account of causation set against what the whole chain does.
  /^(chain `[^`]+`: )?`account: [^`]+`, and /,
];

function parse(text) {
  const res = argdown.run({ input: text, ...RUN });
  return toGraph(res);
}

/** The checker's mechanism findings for a file, as "sev message" strings. */
function pyFindings(file) {
  return new Promise(resolve => {
    const p = spawn(PY, [CHECK, file, "--format", "json", "--no-fix"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", d => { out += d; });
    p.on("close", () => {
      try {
        const j = JSON.parse(out);
        const msgs = (j.findings || []).filter(f => f.check === "mechanism").map(f => f.severity + " " + f.message);
        msgs.bridgeQuestions = ((j.shape && j.shape.chain) || {}).bridge_questions || [];
        msgs.chainClaims = ((j.shape && j.shape.chain) || {}).chain_claims || [];
        resolve(msgs);
      } catch (e) { resolve(null); }
    });
  });
}

const argv = process.argv.slice(2);
const dirs = [path.join(REPO, "ipsissima-mcp", "tests", "mechanism"), path.join(REPO, "samples")];
for (let i = 0; i < argv.length; i++) if (argv[i] === "--dir") dirs.push(path.resolve(argv[++i]));
const SKIP = new Set(["node_modules", "Old versions", ".argument-history", "mechanism-spike"]);
function findMaps(dir) {
  const out = [];
  const walk = d => {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); }
      else if (e.name.endsWith(".argdown") && !e.name.includes("blind-original")) out.push(path.join(d, e.name));
    }
  };
  walk(dir);
  return out.sort();
}

/* THE FAULTS FILE: one of each local fault, so the parity is tested where the corpus is clean. */
const FAULTS = `===
mechanism:
  levels: [macro, micro]
  ordering: stacking
  within: {micro: nowhere}
  form: spiral
  settles: maybe
  order: backwards
  depth: half
  goal: amuse
  account: [regularity, vibes]
  channels: [eco]
  boundary: {says: "", where: "p. 2"}
  colour: blue
  kinds:
    lonely: {label: "A kind of one", general: ghost}
  actors:
    herders: {label: Herders, level: micro}
    state: {label: The state, level: galactic}
  states:
    drought: {lable: Drought, actor: herders, role: cause, aspect: weather, status: maybe, behaviour: wobbles, observed: sometimes}
    migration: {label: Migration, actor: [herders, nomads], levels: [micro, mezzo], measures: nothing, part_of: migration}
    income: {label: Income, kind: lonely}
    a: {label: A, actor: herders, part_of: b}
    b: {label: B, actor: herders, part_of: a}
    census: {label: Census count, actor: state}
  chains:
    one:
      label: One
      question: Why?
      roles: {drought: start, ghost: outcome}
      conditioned: [drought, [spectre]]
      form: loop
      goal: amuse
      account: telepathy
      order: sideways
      boundary: Out there
===

[Drought drives migration]: Drought drives people off the land, all by itself. {causes: {from: drought, to: migraton, sgn: "+", sign: "0", basis: argued, chain: two, via: [drought, ghost], share: some, unless: [phantom], despite: drought, jointly: [spook], modifies: {by: ghost, effect: doubles}, necessary: maybe, sufficient: true, measured_by: [census, drought], attribution: {type: magic, by: nobody}, stance: endorsed, design: illustration, channel: social, shape: zigzag, net: perhaps, mark: "PROPOSITION-7", on: stocks, given: [{state: phantom, value: 1}], scope: universal, how: {actor: wizard, mood: grim}, note: "a note"}}

[Associated]: Drought is associated with migration. {causes: {from: drought, to: migration, sign: "+", basis: study, selects: true, association: true, on: character, shape: peak}}

[Stance]: Some say drought brings rain. {causes: {from: drought, to: income, sign: which, on: being, stance: rejected, net: true}}

[Made of]: Migration makes up income. {constitutes: {from: migration, to: income, extent: some, whole: heap, basis: hunch, stance: doubted, colour: red}}

[Made of nothing]: Something. {constitutes: {to: migration}}

[Self-made]: Income makes itself. {constitutes: {from: income, to: income, stance: rejected}}

[Account of nothing]: An account of a chain never declared. {mechanism: ghosts}

[Account of a list]: An account that names two chains at once. {mechanism: [one, two]}
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mechlint-"));
const faultsFile = path.join(tmp, "faults.argdown");
fs.writeFileSync(faultsFile, FAULTS);

// A DRAFT, so the verdicts on a bridge's questions are given and compared too.
const draftFile = path.join(tmp, "bridge-questions-draft.argdown");
fs.writeFileSync(draftFile, fs.readFileSync(path.join(REPO, "ipsissima-mcp", "tests", "mechanism", "bridge-questions.argdown"), "utf8")
  .replace(/^title: (.*)$/m, "title: $1\nreconstruction:\n    draft: true"));
const files = [faultsFile, draftFile, ...dirs.flatMap(findMaps)].filter(f => {
  const t = fs.readFileSync(f, "utf8");
  return /causes:|constitutes:|^mechanism:/m.test(t);
});

console.log(`== the editor's mechanism checks against the checker (${files.length} maps)\n`);

/* --------------------------------------------------------------- unit checks, before the corpus */
console.log("-- pieces");
check("did you mean: sgn -> sign", L.nearest("sgn", Object.keys(L.PROFILE.causes)) === "sign");
check("did you mean: nothing near xyzzy", L.nearest("xyzzy", Object.keys(L.PROFILE.causes)) === null);
check("py() prints Python's values", L.py(true) === "True" && L.py(null) === "None" && L.py(["a", 1]) === "['a', 1]");
{
  const t = FAULTS, g = parse(t);
  const fs_ = L.findings(g);
  const at = (msg) => { const f = fs_.find(x => x.msg.startsWith(msg)); return f ? t.slice(...Object.values(L.locate(t, f.at))) : null; };
  check("a misspelt key is marked on the key", at("`sgn` is not a key") === "sgn", at("`sgn` is not a key"));
  check("an undeclared state is marked on its id", at("`to: migraton`") === "migraton", at("`to: migraton`"));
  check("an id in a list is marked on itself", at("`via: ghost`") === "ghost", at("`via: ghost`"));
  check("a state's bad actor is marked in the front matter", at("state `migration` names actor `nomads`") === "nomads", at("state `migration` names actor `nomads`"));
  check("a misspelt key on a state is marked on the key, with what it may have meant", at("state `drought`: `lable` is not a key a state can carry, so it is never read -- did you mean `label`?") === "lable", at("state `drought`: `lable`"));
  check("an actor's bad level is marked on its level", at("actor `state` has level") === "galactic", at("actor `state` has level"));
  check("a chain's role for an undeclared state is marked on the id", at("chain `one` gives a role to `ghost`") === "ghost", at("chain `one` gives a role to `ghost`"));
  check("a bad value in a block-style map is marked on the value", at("`ordering: stacking`") === "stacking", at("`ordering: stacking`"));
  check("an account of an undeclared chain is marked on the chain it names", at("`mechanism: ghosts`") === "ghosts", at("`mechanism: ghosts`"));
  check("a relation with no from is marked on its key", at("a constitutive relation has no `from:`") === "constitutes", at("a constitutive relation has no `from:`"));
  // Completion and hover at real places in the faults file.
  const p1 = t.indexOf("to: migraton") + 4;
  const c1 = L.complete(t, p1, g);
  check("after to:, the declared states with their labels", c1 && c1.options.some(o => o.label === "migration" && o.detail === "Migration"), JSON.stringify(c1 && c1.options.slice(0, 3)));
  const p2 = t.indexOf("on: stocks") + 4;
  const c2 = L.complete(t, p2, g);
  check("after on:, the values the profile lists", c2 && c2.options.some(o => o.label === "stock") && c2.options.some(o => o.label === "trend"), JSON.stringify(c2 && c2.options.map(o => o.label)));
  const p3 = t.indexOf("sgn:");
  const c3 = L.complete(t, p3 + 1, g);
  check("writing a key inside causes, the step's keys with their meanings", c3 && c3.options.some(o => o.label === "sign" && /raises/.test(o.info)), JSON.stringify(c3 && c3.options.slice(0, 2)));
  const p4 = t.indexOf("chain: two") + 7;
  const c4 = L.complete(t, p4, g);
  check("after chain:, the declared chains", c4 && c4.options.length === 1 && c4.options[0].label === "one", JSON.stringify(c4 && c4.options));
  const p5 = t.indexOf("      label: One");
  const c5 = L.complete(t, p5 + 6, g);
  check("inside a chain in the front matter, a chain's keys", c5 && c5.options.some(o => o.label === "conditioned"), JSON.stringify(c5 && c5.options.map(o => o.label)));
  const p6 = t.indexOf("actor: herders, role") + 8;
  const c6 = L.complete(t, p6, g);
  check("a state's actor: offers the declared actors", c6 && c6.options.some(o => o.label === "herders"), JSON.stringify(c6 && c6.options));
  const p7 = t.indexOf("{mechanism: ghosts}") + "{mechanism: gh".length;
  const c7 = L.complete(t, p7, g);
  check("after a claim's mechanism:, the declared chains", c7 && c7.options.some(o => o.label === "one") && c7.options.some(o => o.label === "true"), JSON.stringify(c7 && c7.options));
  const h1 = L.hover(t, t.indexOf("from: drought, to: migration, sign: \"+\", basis: study") + 22, g);
  check("hover on a state id gives its label and actor", h1 && /Migration/.test(h1) && /Herders, nomads/.test(h1), h1);
  const h2 = L.hover(t, t.indexOf("basis: argued") + 1, g);
  check("hover on a key gives its meaning", h2 && /What the text offers/.test(h2), h2);
}

/* --------------------------------------------------------------- parity, map by map */
console.log("\n-- parity with mechanism.py");
const pool = 6;
let i = 0, missing = [], extra = [], located = 0, unlocated = [], bqDiffer = [], bqCount = 0, draftVerdicts = 0, ccDiffer = [], ccCount = 0;
async function one(file) {
  const text = fs.readFileSync(file, "utf8");
  let g;
  try { g = parse(text); } catch (e) { return; }
  const js = L.findings(g);
  const jsMsgs = js.map(f => f.sev + " " + f.msg);
  const py = await pyFindings(file);
  const name = path.relative(REPO, file).startsWith("..") ? path.basename(file) : path.relative(REPO, file);
  if (!py) { check(name + ": the checker ran", false); return; }
  const left = py.slice();
  const ex = [];
  for (const m of jsMsgs) { const k = left.indexOf(m); if (k >= 0) left.splice(k, 1); else ex.push(m); }
  const miss = left.filter(m => !GLOBAL.some(re => re.test(m.slice(2))));
  if (ex.length) extra.push(name + ":\n  " + ex.join("\n  "));
  // AND THE BRIDGES' QUESTIONS: what the map says to each, the page's answer and the checker's.
  let M = null;
  try { M = MV.model(g); } catch (e) { M = null; }
  const jq = M ? M.profile.bridge_questions : [];
  bqCount += jq.length;
  if (JSON.stringify(jq) !== JSON.stringify(py.bridgeQuestions || [])) bqDiffer.push(name);
  // AND THE CLAIMS THAT STAND FOR A CHAIN (1.20): which chain, how many steps, how backed.
  const jc = M ? M.profile.chain_claims : [];
  ccCount += jc.length;
  if (JSON.stringify(jc) !== JSON.stringify(py.chainClaims || [])) ccDiffer.push(name);
  if (file === draftFile) draftVerdicts = jq.flatMap(b => b[3].map(q => q[4])).filter(Boolean).length;
  if (miss.length) missing.push(name + ":\n  " + miss.join("\n  "));
  // Every finding lands somewhere real: a claim's finding on its claim, a front-matter one inside the front matter.
  for (const f of js) {
    const r = L.locate(text, f.at);
    const ok = r && r.to > r.from && r.from >= 0 && r.to <= text.length;
    if (ok) located++; else unlocated.push(name + ": " + f.msg);
  }
}
async function run() {
  const workers = Array.from({ length: pool }, async () => { while (i < files.length) await one(files[i++]); });
  await Promise.all(workers);
}
await run();
check("every finding the editor shows, the checker gives in the same words", !extra.length, extra.slice(0, 8).join("\n"));
check("every local finding the checker gives, the editor shows", !missing.length, missing.slice(0, 8).join("\n"));
check(`every finding is placed in the text (${located})`, !unlocated.length, unlocated.slice(0, 5).join("\n"));
check(`what the map says to each bridge's questions, the page and the checker alike (${bqCount} bridges)`, !bqDiffer.length, bqDiffer.join(", "));
check(`claims that stand for a chain, the page and the checker alike (${ccCount})`, !ccDiffer.length && ccCount >= 2, ccDiffer.join(", ") || String(ccCount));
check(`and a draft's verdicts on them, alike (${draftVerdicts} verdicts)`, draftVerdicts > 20 && !bqDiffer.includes("bridge-questions-draft.argdown"), String(draftVerdicts));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failed` : "\neverything passed");
process.exit(fails ? 1 : 0);
