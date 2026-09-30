#!/usr/bin/env python3
"""Tests for the mechanism checks: the chain a text asserts, and the appraisal layer.

    python3 ipsissima-mcp/tests/test_mechanism.py

WHY PLANTED FIXTURES. Every case here is one the notation spike on the SMF briefing (26 Sep
2026) found or needed, written into a small file where the right answer is known before the code
runs: a chain with a dead end, an unreached outcome, a loop through a classification, a rival
view, and an appraisal layer that must not leak into any measure of the author's argument. The
expectations were written first.

THE CONTROL MATTERS. A file with no `mechanism:` block and no `causes:` step -- which is almost
every file -- must hear nothing from any of this: no CHAIN section, no finding, no `chain` in the
shape. A check that fired on ordinary maps would be switched off within a week.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PKG = HERE.parents[0] / "src" / "ipsissima_mcp"
sys.path.insert(0, str(PKG))

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" +
          ("" if ok else f"\n          got  {got!r}\n          want {want!r}"))


FIXTURE = HERE / "mechanism"
SOURCE = (FIXTURE / "source" / "brief.md").read_text(encoding="utf-8")
CHAIN = (FIXTURE / "chain.argdown").read_text(encoding="utf-8")


def run(text, name="brief.argdown", extra=None, source=None):
    """Write the fixture beside its source, run the checker in json mode, return the report."""
    td = tempfile.mkdtemp(prefix="mechanism-test-")
    os.makedirs(os.path.join(td, "source"))
    open(os.path.join(td, "source", "brief.md"), "w", encoding="utf-8").write(source or SOURCE)
    path = os.path.join(td, name)
    open(path, "w", encoding="utf-8").write(text)
    r = subprocess.run([sys.executable, str(PKG / "check_argdown.py"), path,
                        "--source-root", td, "--format", "json"] + (extra or []),
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit(f"the checker did not return json:\n{r.stdout[-2000:]}\n{r.stderr[-2000:]}")


def by(report, check_name):
    return [f for f in report["findings"] if f["check"] == check_name]


# --------------------------------------------------------------------------- #
print("the control: an ordinary map hears nothing")
plain = run("""===
title: "Plain"
defaults:
    chapter: "source/brief.md"
===

[Recommend]: The government should use more community orders.

[Orders keep people in work]: Community orders keep people in work.
    {fidelity: "quotation"}
    +> [Recommend]
""")
check("no chain in the shape", "chain" in plain["shape"], False)
check("no mechanism finding of any kind",
      [f for f in plain["findings"] if f["check"].startswith(("mechanism", "appraisal"))], [])
check("no CHAIN section in the census", "CHAIN" in plain.get("census", ""), False)

# --------------------------------------------------------------------------- #
print("\nthe chain the text asserts")
rep = run(CHAIN)
chain = rep["shape"].get("chain") or {}
check("the file is still ok: a gap is a finding about the text, not a fault", rep["ok"], True)
check("`causes:` is a field the checker reads", by(rep, "unknown-field"), [])
check("four distinct steps in the text's own layer", chain.get("steps"), 4)
check("asserted by four claims", chain.get("claims"), 4)
# The macro states are the unlinked intervention and the unreached cost: the chain AS THE TEXT
# STATES IT never reaches the macro level, which is itself worth reporting.
check("the text's chain spans meso and micro only", chain.get("levels_spanned"), ["meso", "micro"])
check("the stated lag is kept", chain.get("lags"), ["two years"])
check("light and shadow: one step backed by a study, the rest asserted or argued",
      chain.get("tiers"), {"evidence": 1, "argued": 1, "asserted": 2, "imputed": 0})
check("the step with Gross's `how:` is counted", chain.get("with_how"), 1)
gaps = chain.get("gaps") or []
check("the unlinked intervention is a gap",
      any("intervention `policy` has no step" in g for g in gaps), True)
check("the chain that stops at reintegration is a dead end",
      any("`reint` leads nowhere" in g for g in gaps), True)
check("the cost outcome is unreached", any("`cost` is not reached" in g for g in gaps), True)
check("every gap is an observation (?), never a fault (!)",
      {f["severity"] for f in by(rep, "mechanism-gap")}, {"?"})
check("the chain starts where the text starts it", chain.get("entries"), ["order"])
routes = {(r["start"], r["outcome"]): r for r in chain.get("routes") or []}
check("order -> prison runs through reoffending, two steps",
      (routes.get(("order", "prison")) or {}).get("shortest"), 2)
check("no loop closes in the text", chain.get("loops_text"), [])
loops = chain.get("loops_with_appraisal") or []
check("the appraisal closes two loops", len(loops), 2)
check("one of them runs through the risk score and is reflexive",
      any("risk" in l["states"] and l["reflexive"] for l in loops), True)
check("and each loop keeps its order",
      sorted(l["states"] for l in loops), [["order", "reoff", "risk"], ["reoff", "prison"]])
check("the rival view's step is counted apart from the text's", chain.get("rival_steps"), 1)
check("a null finding is reported, and answers the rival view's step on the same pair",
      chain.get("null_steps"), [{"from": "order", "to": "reoff", "basis": "study", "refutes": ["+"],
                                 "given": [], "periods": [], "routes": 1}])
check("a selection link is reported apart", chain.get("selection_steps"), [["order", "reoff"]])
check("and neither is counted as a step of the chain, nor walked", chain.get("steps"), 4)
check("the text's \"may\" is counted as hedged", chain.get("hedged"), 1)
check("steps are counted by sign", sorted(chain.get("tiers", {}).values()), [0, 1, 1, 2])
check("the rival step does not thicken the text's chain",
      (routes.get(("order", "reoff")) or {}).get("routes"), 1)

# --------------------------------------------------------------------------- #
print("\nthe appraisal never counts as the author's")
check("four appraisal claims, four appraisal steps",
      (chain.get("appraisal_claims"), chain.get("appraisal_steps")), (4, 4))
# The dangerous case: an appraisal claim that something SUPPORTS is drawn on the map and supports
# nothing itself, so without the rule it would be crowned the paper's conclusion.
check("an appraisal claim is never the apex, even one the map draws and nothing sits above",
      [t for t in rep["shape"].get("apex", []) if "risk" in t.lower()], [])
check("the author's recommendation is the only apex", len(rep["shape"].get("apex", [])), 1)
check("nor inert", any("Risk scores" in t for t in rep["shape"].get("inert", [])), False)
check("the fidelity census counts only the author's claims",
      rep["shape"].get("fidelity", {}).get("imputation"), 1)
check("and says how many it left out", rep["shape"].get("appraisal"), 4)
load = rep.get("census", "")
check("the appraisal is not a load-bearing assumption of the author's argument",
      "Crowding feeds reoffending" in load.split("INTERPRETIVE LOAD")[-1].split("CHAIN")[0],
      False)

# --------------------------------------------------------------------------- #
print("\nwhat is a fault")
bad = run(CHAIN.replace('warrant: "performativity",', "")
               .replace("{from: order, to: work,", "{from: court, to: work,")
               .replace("how: {actor: person,", "how: {actor: judge,")
               .replace("causes: {from: reoff, to: prison, sign", "causes: {from: reoff, to: risk, sign"))
msgs = [f["message"] for f in by(bad, "mechanism") + by(bad, "appraisal")]
check("an appraisal claim without a warrant is a fault",
      any("must be marked `fidelity: imputation`" in m for m in msgs), True)
check("an undeclared state is a fault", any("`from: court` is not a declared state" in m
                                            for m in msgs), True)
check("an undeclared actor in `how:` is a fault",
      any("`how: actor: judge` is not a declared actor" in m for m in msgs), True)
check("the text may not assert a step through the appraisal's own state",
      any("declared as the appraisal's own state" in m for m in msgs), True)
check("so the file is not ok", bad["ok"], False)

nohead = run(CHAIN.split("mechanism:")[0] + "===\n" + CHAIN.split("===\n", 2)[2])
check("steps with no `mechanism:` block are a fault",
      any("declares no `mechanism:` block" in f["message"] for f in by(nohead, "mechanism")),
      True)

premise = run(CHAIN + """
<Author's case>: The brief's argument.

<Author's case>

(1) [Orders keep people in work]
(2) [Crowding feeds reoffending]
-----
(3) [Recommend]
""")
check("the author's argument may not rest on an appraisal premise",
      any("uses an #appraisal claim as a premise" in f["message"]
          for f in by(premise, "appraisal")), True)

broken = run(CHAIN.replace("levels: [macro, meso, micro]", "levels: [macro, meso, micro"))
check("front matter that is not valid YAML is named, not silently read as nothing",
      any("not valid YAML" in f["message"] for f in by(broken, "mechanism")), True)

# --------------------------------------------------------------------------- #
print("\nthe mechanism pass: the chain's own material, and what the text's causal talk it covers")
# PHASE C. The pass returns to the source: it may add a claim quoting a step the text states but
# the argument never needed, and it is shown which of the text's causal sentences no step quotes.
MORE_TEXT = SOURCE.rstrip() + """

Keeping a job reduces reoffending. Losing that job again raises the risk.

Short prison terms cause people to lose their jobs.
"""
PASS = CHAIN + """
# The mechanism, as the text states it {isGroup: true}

[Work reduces reoffending]: "Keeping a job reduces reoffending."
    {fidelity: "quotation", causes: {from: work, to: reoff, sign: "-", basis: asserted}}

[Losing the job, read against the text]: "Short prison terms cause people to lose their jobs." #appraisal
    {fidelity: "imputation", warrant: "quoted here only to show an appraisal covers nothing",
     causes: {from: order, to: work, sign: "-"}}
"""
rep2 = run(PASS, source=MORE_TEXT)
ch2 = rep2["shape"].get("chain") or {}
cov = ch2.get("coverage") or {}
check("a mechanism-only claim is the chain's material, not inert",
      "Work reduces reoffending" in rep2["shape"].get("inert", []), False)
check("and is counted as such", rep2["shape"].get("contribution", {}).get("chain"), 1)
check("with no `inert` finding against it",
      [f for f in by(rep2, "inert") if f.get("title") == "Work reduces reoffending"], [])
check("its step joins the chain: reintegration is no longer the only way on from work",
      any("`work`" in g for g in ch2.get("gaps", [])), False)
check("five sentences in the text use causal language", cov.get("causal_sentences"), 5)
check("the three a step quotes are covered", cov.get("covered"), 3)
# Mutation: count `near` as covered again -> covered 4.
check("one more shares a paragraph with a step, and that is reported, not counted as covered",
      cov.get("near"), 1)
check("the other is listed as a candidate, and an appraisal quoting it does not cover it",
      [(u["text"], u["near"]) for u in cov.get("uncovered", [])],
      [("Losing that job again raises the risk.", True),
       ("Short prison terms cause people to lose their jobs.", False)])
check("which is an observation (?), not a fault",
      {f["severity"] for f in by(rep2, "mechanism-coverage")}, {"?"})
check("and the file stays ok", rep2["ok"], True)
check("without the text to hand there is no coverage to report",
      "coverage" in (run(PASS, extra=["--source-root", "/nonexistent"])["shape"].get("chain") or {}),
      False)

# TWO DEFECTS THE J-PAL SAMPLE FOUND (26 Sep 2026). A claim that is the author's words whole, with
# no quotation marks, quotes as surely as a marked span -- and a source's own front matter, where a
# converted paper keeps its abstract, is not running text to be covered.
# Mutations: drop the whole-claim spans -> covered 3; drop the front-matter blanking -> 6 sentences.
FM_TEXT = "---\nabstract: >-\n  Short prison terms cause people to lose their jobs.\n---\n" + MORE_TEXT
rep3 = run(PASS + """
[Losing it again]: Losing that job again raises the risk.
    {fidelity: "quotation", causes: {from: work, to: reoff, sign: "-", basis: asserted}}
""", source=FM_TEXT)
cov3 = (rep3["shape"].get("chain") or {}).get("coverage") or {}
check("the source's front matter is not counted as the text's causal language",
      cov3.get("causal_sentences"), 5)
check("a claim that is a quotation whole covers its sentence, quotation marks or none",
      (cov3.get("covered"), cov3.get("near")), (4, 0))
check("leaving only the sentence nothing of the text's quotes",
      [u["text"] for u in cov3.get("uncovered", [])],
      ["Short prison terms cause people to lose their jobs."])

# --------------------------------------------------------------------------- #
print("\nan explanatory chain: a condition to start from, a state with two roles, a loop")
# PROFILE 1.1 (26 Sep 2026). Merton's essay is mostly a circle, and Wimmer's theory has no
# intervention at all: the roles grew up on policy texts and could not say where an explanation
# starts, nor that prejudice is both where Merton's circle begins and what his remedy is for.
LOOP = (FIXTURE / "loop.argdown").read_text(encoding="utf-8")
rl = run(LOOP)
chl = rl["shape"].get("chain") or {}
gl = [g for g in chl.get("gaps", [])]
# Mutation: drop `conditions` from the entries -> worry is not where the chain starts.
check("a condition is where the chain starts", chl.get("entries"), ["worry"])
# Mutation: require an intervention again -> the no-cause gap fires.
check("a chain with a condition and no intervention has a stated cause",
      any("no stated cause" in g for g in gl), False)
check("a condition the text links to nothing is a gap, named",
      any("the condition `habit` has no step in the text" in g for g in gl), True)
check("a state that is both condition and outcome routes to the other outcome, not to itself",
      sorted((r["start"], r["outcome"]) for r in chl.get("routes", [])), [("worry", "relief")])
check("the loop the text closes is found, and it is reflexive",
      [(l["states"], l["reflexive"]) for l in chl.get("loops_text", [])], [(["worry", "check"], True)])
check("and a list of roles is no fault", [f for f in by(rl, "mechanism") if "role" in f["message"]], [])
bad = run(LOOP.replace("role: outcome}", "role: explanandum}"))
check("an unknown role is named, with the three that are read",
      any("the roles read are `intervention`, `condition` and `outcome`" in f["message"]
          for f in by(bad, "mechanism")), True)

# --------------------------------------------------------------------------- #
print("\nprofile 1.2: a feedback system, the text's own boxes, and decides-which")
# THE WIMMER TEST (26 Sep 2026): simple cycles through one dense system hit the cap of 50 and
# listed nothing a reader could use; the census found a different 50 on each run, because the
# edges were walked in set order; five strategies sat as parts of one box the text drew, with no
# way to say so; and "determine which" had no sign.
SYSTEM = (FIXTURE / "system.argdown").read_text(encoding="utf-8")
rs = run(SYSTEM)
chs = rs["shape"].get("chain") or {}
fb = chs.get("feedback", [])
check("one feedback system binds the field and the actors' conduct", len(fb), 1)
check("with more loops than are listed one by one", fb and fb[0]["loops"] > 4, True)
# (Found directly by breadth-first search; on Wimmer, whose loops pass the cap of 50, taking the
# shortest from the capped sample missed every two-state loop. This fixture stays under the cap.)
check("its shortest loop is found directly: institutions and power, each on the other",
      fb and fb[0]["shortest"][0]["states"], ["inst", "power"])
check("the parts of a whole are listed", chs.get("wholes"), [["strat", ["blur", "contract", "expand"]]])
check("decides-which is a sign, not a fault",
      [f for f in by(rs, "mechanism") if "is not `+`" in f["message"]], [])
env_runs = set()
td = tempfile.mkdtemp(prefix="mechanism-seed-")
sp = os.path.join(td, "system.argdown"); open(sp, "w", encoding="utf-8").write(SYSTEM)
for seed in ("1", "7", "42"):
    r = subprocess.run([sys.executable, str(PKG / "check_argdown.py"), sp, "--format", "json"],
                       capture_output=True, text=True, env={**os.environ, "PYTHONHASHSEED": seed})
    env_runs.add(json.dumps(json.loads(r.stdout)["shape"]["chain"], sort_keys=True))
# Mutation: build adjacency from the edge set unsorted -> the capped walks differ by seed.
check("the census is the same whatever the hash seed", len(env_runs), 1)
for bad, why in ((SYSTEM.replace("part_of: strat}", "part_of: nowhere}", 1), "not a declared state"),
                 (SYSTEM.replace("{label: \"Expansion\", actor: actors, part_of: strat}",
                                 "{label: \"Expansion\", actor: actors, part_of: expand}"), "is `part_of` itself"),
                 (SYSTEM.replace("{label: \"Strategies of boundary making\", actor: actors}",
                                 "{label: \"Strategies of boundary making\", actor: actors, part_of: expand}"), "runs in a circle")):
    check(f"a bad part_of is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nprofile 1.4: a joint effect, and a state across levels")
# THE COLEMAN BOAT (26 Sep 2026). "Belief moves people to act only where they wish to fit in" had
# no notation: two separate arrows claimed each cause suffices alone. And Wimmer's consensus,
# negotiated among individuals and holding as a macro fact, had to be put on one level.
JOINT = (FIXTURE / "joint.argdown").read_text(encoding="utf-8")
rj = run(JOINT)
chj = rj["shape"].get("chain") or {}
check("the joint step is listed with the state it needs", chj.get("joint"), [["belief", "act", "+", ["desire"]]])
# Mutation: leave co-causes out of text_edges -> the condition is "linked to nothing".
check("a co-cause counts as a cause: the condition is not linked to nothing",
      [g for g in chj.get("gaps", []) if "`desire`" in str(g)], [])
check("routes run from the co-cause too", any(r["start"] == "desire" for r in chj.get("routes", [])), True)
check("still one step, not two", chj.get("steps"), 3)
check("the spanning state is listed with its levels", chj.get("spanning"), [["norm", ["macro", "micro"]]])
one = run(JOINT.replace("act:     {label: \"Compliance\", actor: person}", "act:     {label: \"Compliance\", actor: society}")
          .replace("belief:  {label: \"Belief that others comply\", actor: person}", "belief:  {label: \"Belief that others comply\", actor: society}")
          .replace("desire:  {label: \"Desire to fit in\", actor: person, role: condition}", "desire:  {label: \"Desire to fit in\", actor: society, role: condition}"))
# Mutation: read levels_spanned from the actor only -> micro drops out.
check("a spanning state brings its levels into the height", (one["shape"].get("chain") or {}).get("levels_spanned"), ["macro", "micro"])
for bad, why in ((JOINT.replace("jointly: [desire]", "jointly: [wish]"), "`jointly: wish` is not a declared state"),
                 (JOINT.replace("jointly: [desire]", "jointly: [act]"), "names the step's own"),
                 (JOINT.replace("levels: [macro, micro], role", "levels: [macro, mezzo], role"), "names level `mezzo`")):
    check(f"a bad 1.4 annotation is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nprofile 1.5: several chains, coupled by the states they share")
# THE COLEMAN BOAT'S OWN LIMIT (27 Sep 2026): its cases are several boats, one boat's outcome the
# next one's condition, and one `mechanism:` block with one question could say neither.
CHAINS = (FIXTURE / "chains.argdown").read_text(encoding="utf-8")
rc = run(CHAINS)
chc = rc["shape"].get("chain") or {}
cs = {c["id"]: c for c in chc.get("chains", [])}
check("each chain is walked on its own steps", [cs["drought"]["steps"], cs["water"]["steps"]], [2, 2])
check("  in declared order", [c["id"] for c in chc.get("chains", [])], ["drought", "water"])
check("  on the states its steps touch", cs["water"]["states"], ["forest", "water", "wells"])
# Mutation: ignore a chain's `roles:` -> forest is an outcome in both, and the water chain has no start.
check("a chain casts a shared state in a role of its own", [cs["drought"]["roles"]["forest"], cs["water"]["roles"]["forest"]],
      [["outcome"], ["condition"]])
check("  so the second chain starts where the first ends", cs["water"]["entries"], ["forest"])
check("what couples them: the state each shares, with whom", [cs["drought"]["shared"], cs["water"]["shared"]],
      [[["forest", ["water"]]], [["forest", ["drought"]]]])
check("a chain's gaps are its own", cs["water"]["gaps"], ["`wells` leads nowhere in the text: the chain stops there"])
check("the whole is still walked whole", [len(chc["routes"]), chc["steps"]], [2, 5])
check("a step in no chain is counted", chc.get("unchained"), 1)
check("a file with no chains has none, and counts none", [(run(JOINT)["shape"]["chain"]).get(k) for k in ("chains", "unchained")], [[], 0])
for bad, why in ((CHAINS.replace("chain: water}}", "chain: wetlands}}", 1), "`chain: wetlands` is not one of the chains"),
                 (CHAINS.replace("roles: {forest: condition}", "roles: {woodland: condition}"), "gives a role to `woodland`, which is not"),
                 (CHAINS.replace("roles: {forest: condition}", "roles: {forest: explanandum}"), "the role `explanandum`"),
                 (CHAINS.replace(", chain: water}}", "}}"), "chain `water` is declared but no step"),
                 (JOINT.replace("jointly: [desire]}", "jointly: [desire], chain: boat}"), "declares no `chains:`")):
    check(f"a bad 1.5 annotation is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nprofile 1.6: the same kind of state across cases")
# THE COLEMAN BOAT'S NEXT LIMIT (27 Sep 2026): Kenyan herders' migration and the paper's general
# rural-urban migration are two states the text never joins -- one kind in two cases. `part_of`
# would draw them as one box; one state would walk from the case into the general claim.
KINDS = (FIXTURE / "kinds.argdown").read_text(encoding="utf-8")
rk = run(KINDS)
chk = rk["shape"].get("chain") or {}
check("each kind is listed with its states", [[k["id"], k["states"]] for k in chk.get("kinds", [])],
      [["migration", ["kmigr", "migr"]], ["forest", ["kforest", "forest"]]])
# Mutation: let `alike` ignore kinds -> no akin step.
check("the case's step is found to be the general step again", chk.get("akin_steps"),
      [[["kmigr", "kforest"], ["migr", "forest"]]])
# Mutation: walk a kind as though it were one state -> a route runs from drought to `forest`.
check("and nothing is walked between them", sorted((r["start"], r["outcome"]) for r in chk["routes"]),
      [("drought", "kforest"), ("migr", "forest")])
ck = {c["id"]: c for c in chk.get("chains", [])}
check("each chain says which of its states have kin in another", ck["north"]["akin"],
      [["kmigr", "migration", [["general", "migr"]]], ["kforest", "forest", [["general", "forest"]]]])
check("  and a kin is not a shared state", [ck["north"]["shared"], ck["general"]["shared"]], [[], []])
check("a file with no kinds lists none", [(run(CHAINS)["shape"]["chain"]).get(k) for k in ("kinds", "akin_steps")], [[], []])
for bad, why in ((KINDS.replace("kind: migration, role: condition}", "kind: moving, role: condition}"), "`kind: moving`, which is not declared"),
                 (KINDS.replace("        forest:    {label: \"Forest cover\"}", "        forest:    {label: \"Forest cover\"}\n        water: {label: \"Water\"}"), "kind `water` has 0 state(s)")):
    check(f"a bad 1.6 annotation is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nprofile 1.7: the general and its cases")
# THE COLEMAN BOAT'S NEXT LIMIT (27 Sep 2026): a kind was symmetric, so the paper's general claim
# about migration and its Kenyan case were paired as equals; and Merton's general mechanism could
# not be told from its instances.
GENERALS = (FIXTURE / "generals.argdown").read_text(encoding="utf-8")
rg = run(GENERALS)
chg = rg["shape"].get("chain") or {}
check("each kind names its general state", [[k["id"], k["general"]] for k in chg.get("kinds", [])],
      [["migration", "migr"], ["forest", "forest"]])
# Mutation: drop the orientation in _akin_steps -> all three pairs come back as akin.
check("each region's step is a case of the general step", chg.get("instances"),
      [[["migr", "forest"], ["nmigr", "nforest"]], [["migr", "forest"], ["smigr", "sforest"]]])
check("  and the two regions' steps are the same step in two cases, as equals", chg.get("akin_steps"),
      [[["nmigr", "nforest"], ["smigr", "sforest"]]])
cg = {c["id"]: c for c in chg.get("chains", [])}
check("a chain is a case of the chain its general step is in", [cg["north"]["case_of"], cg["south"]["case_of"], cg["general"]["case_of"]],
      [[["general", 1]], [["general", 1]], []])
half = run(GENERALS.replace(", general: forest}", "}"))["shape"]["chain"]
check("a step is a case only where every end that differs is the general state",
      [len(half["instances"]), len(half["akin_steps"])], [0, 3])
ALT = GENERALS.replace("        smigr:", "        nmove:    {label: \"Northern moves to town\", actor: herders, kind: migration}\n        smigr:") + """
[Some moved to town]: Some northern herders moved to town, and that too thinned the forest.
    {causes: {from: nmove, to: nforest, sign: "-", basis: asserted, chain: north}}
    +> [Migration and forests]
"""
# Mutation: drop one_case -> nmigr -> nforest ~ nmove -> nforest comes back as two cases.
check("two alternatives within one case are not the same step in two cases",
      [pr for pr in run(ALT)["shape"]["chain"]["akin_steps"] if pr[0][0] in ("nmigr", "nmove") and pr[1][0] in ("nmigr", "nmove")], [])
check("a kind with no general state pairs its steps as equals, as in 1.6", len(run(KINDS)["shape"]["chain"]["instances"]), 0)
for bad, why in ((GENERALS.replace("general: migr}", "general: migrants}"), "`general: migrants`, which is not a declared state"),
                 (GENERALS.replace("general: migr}", "general: drought}"), "`drought` is not of kind `migration`")):
    check(f"a bad 1.7 annotation is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nthe census, as the gap tests found it (27 Sep 2026)")
# WHAT SIX TEXTS MISREAD, before any construct was added: most wrong readings were the census's,
# not the file's. Each check below names the mutation that makes it fail.
import mechanism as mech  # noqa: E402
rc = run(CHAIN)["shape"]["chain"]
rts = {(r["start"], r["outcome"]): r for r in rc["routes"]}
# Mutation: count every route as `?` in _net -> both fail.
check("a route carries its net sign: order lowers reoffending, which fills prisons, so order lowers prison",
      rts[("order", "prison")]["net"], {"+": 0, "-": 1, "?": 0})
check("  and a one-step route its step's sign", rts[("order", "reoff")]["net"], {"+": 0, "-": 1, "?": 0})
# Mutation: _polarity always None -> fails.
check("a loop carries its polarity from its signs (- then + then - is reinforcing; + then + too)",
      sorted((l["states"], l["polarity"]) for l in rc["loops_with_appraisal"]),
      [(["order", "reoff", "risk"], "reinforcing"), (["reoff", "prison"], "reinforcing")])
check("a balancing loop is named so", mech._polarity(["a", "b"], {("a", "b"): {"+"}, ("b", "a"): {"-"}}), "balancing")
check("  and a loop with a step of both signs has no polarity",
      mech._polarity(["a", "b"], {("a", "b"): {"+", "-"}, ("b", "a"): {"-"}}), None)
check("each lag is kept with its step", rc["timed"], [["order", "reoff", "two years"]])
lines = "\n".join(mech.census(rc))
check("  and printed on a line of its own, never joined with \"; \"",
      "length  order -> reoff: two years" in lines, True)
check("the census says a route of several steps is its own composition", "composed:" in lines, True)
many = dict(rc, routes=[dict(r, outcome=f"o{i}") for i in range(12) for r in rc["routes"][:1]])
# Mutation: drop the "and N more" line -> fails.
check("routes past the listed ten are counted, never cut silently",
      "... and 2 more" in "\n".join(mech.census(many)), True)
check("the intervention is named in the profile", rc["interventions"], ["policy"])
late = dict(many, interventions=["policy"], routes=many["routes"] + [dict(rc["routes"][0], start="policy")])
# Mutation: list routes in walked order -> the intervention's route falls past the ten.
check("the intervention's routes are listed first, never cut behind the rest",
      "route   policy -> " in "\n".join(mech.census(late)), True)
COND = CHAIN.replace('causes: {from: order, to: reoff, sign: "0", basis: study}',
                     'causes: {from: order, to: reoff, sign: "0", basis: study, given: ["among first offenders"]}')
rn = run(COND)["shape"]["chain"]
check("a null keeps its condition", rn["null_steps"][0]["given"], ["among first offenders"])
nl = "\n".join(mech.census(rn))
# Mutation: drop the given lines from the census -> fails.
check("  and the census prints it: not a finding of no effect anywhere",
      ("where its condition holds" in nl, "given   among first offenders" in nl), (True, True))
check("a null says how many routes the text's own steps give between its states",
      "beside  1 route(s)" in nl, True)
PART = CHAIN.replace('reint:   {label: "Reintegrates", actor: person}',
                     'reint:   {label: "Reintegrates", actor: person, part_of: order}')
# Mutation: drop `onward` in _walk -> the dead end comes back.
check("a part whose whole leads on is not a dead end",
      any("`reint` leads nowhere" in g for g in run(PART)["shape"]["chain"]["gaps"]), False)
gl = "\n".join(mech.census(run(GENERALS)["shape"]["chain"]))
# Mutation: print every akin pair -> fails.
check("two cases of one general step are said by their case lines, not listed again as a pair",
      ("nmigr -> nforest  ~  smigr -> sforest" in gl, "and 1 pair(s) of cases of one general step" in gl), (False, True))

PAGED = ("The effect of the long drought is that herders\n\n<!-- p.5 begins here -->\n\nmove to town, "
         "which reduces forest cover.\n\n| drought | leads to | migration |\n|---|---|---|\n\n"
         "The census then counts this sentence as causes go.\n")
# Mutations: drop the after_marker continue -> three sentences; drop the "|" test -> the table row counts.
check("a sentence a page marker cuts is one sentence, and a table row is none",
      [ln for ln, _ in mech._sentences(PAGED)], [1, 10])

print("\nprofile 1.8: one link at two grains (via)")
# G13 (gap tests, 27 Sep 2026): a trial's total effect drawn beside the route the text opens it into
# read as partial mediation the text never claims. `via` says the step IS that route.
VIA = (FIXTURE / "via.argdown").read_text(encoding="utf-8")
FINE = VIA.replace("via: [work, reint]", "")
fine = {(r["start"], r["outcome"]): r["routes"] for r in run(FINE)["shape"]["chain"]["routes"]}
rv = run(VIA)
cv = rv["shape"]["chain"]
vr = {(r["start"], r["outcome"]): r["routes"] for r in cv["routes"]}
check("without `via`, the coarse step and the route through work are two routes", fine[("order", "reoff")], 2)
# Mutation: drop `text_edges - set(opened)` -> 2.
check("with it, the step IS the route: one", vr[("order", "reoff")], 1)
check("the opened step is named, with its route", cv["opened"], [["order", "reoff", ["work", "reint"]]])
check("  and still counted as a step the text asserts", cv["steps"], run(FINE)["shape"]["chain"]["steps"])
check("the census says so", "via     order -> reoff is the route through work, reint" in "\n".join(mech.census(cv)), True)
check("  with no finding when the route is the text's and its signs agree",
      [f["message"] for f in by(rv, "mechanism") if "via" in f["message"] or "nets" in f["message"]], [])
gone = run(VIA.replace('causes: {from: reint, to: reoff, sign: "-", basis: asserted}', 'causes: {from: reint, to: cost, sign: "-", basis: asserted}'))
check("a `via` the text's steps do not give is named, and the step walked as its own",
      (any("no step reint -> reoff" in f["message"] for f in by(gone, "mechanism")), gone["shape"]["chain"]["opened"]), (True, []))
other = run(VIA + """
[Some offenders reoffend more]: "Among the youngest, orders were followed by more reoffending."
    {fidelity: "quotation", causes: {from: order, to: reoff, sign: "+", basis: study, given: ["the youngest offenders"]}}
""")
# Mutation: hold every step on the pair to the route's sign -> a finding against the subgroup's `+`.
check("another finding on the same pair is not held to the route's sign",
      [f["message"] for f in by(other, "mechanism") if "nets" in f["message"]], [])
flip = run(VIA.replace('causes: {from: reint, to: reoff, sign: "-", basis: asserted}', 'causes: {from: reint, to: reoff, sign: "+", basis: asserted}'))
check("a route that nets the other sign is named", any("nets `+`" in f["message"] for f in by(flip, "mechanism")), True)
check("a `via` naming no declared state is a fault",
      any("`via: nowhere` is not a declared state" in f["message"] for f in by(run(VIA.replace("via: [work, reint]", "via: [nowhere]")), "mechanism")), True)

print("\nprofile 1.8: a step on a step (unless, despite, conditions on a state)")
# G1 (gap tests, 27 Sep 2026): Reason's defences block a hazard -> harm step; Yellowstone's elk
# suppressed willows DESPITE hunting; metformin's knockouts and the levy's subgroups are conditions.
BLOCK = (FIXTURE / "blockers.argdown").read_text(encoding="utf-8")
rb = run(BLOCK)
cb = rb["shape"]["chain"]
check("a blocker is named with the step it blocks", cb["blocked"], [["hazard", "harm", "+", ["defence"]]])
check("  and one that failed, apart", cb["despite"], [["hazard", "harm", "+", ["culture"]]])
rtb = {(r["start"], r["outcome"]): r for r in cb["routes"]}
# Mutations: drop unless from _side_edges -> no audit route; drop the flip in _signs -> net +.
check("a blocker is a cause of the outcome, once, of the opposite sign: audits lower harm",
      (rtb[("audit", "harm")]["routes"], rtb[("audit", "harm")]["net"]), (1, {"+": 0, "-": 1, "?": 0}))
check("the failed blocker is walked nowhere, and no gap is found at it",
      [g for g in cb["gaps"] if "culture" in g], [])
check("a condition may name a state and its value", "audit: absent" in [c for _, _, recs in cb["strata"] for _, g, _, _ in recs for c in g], True)
# Mutation: _strata requires three records -> [].
check("a pair whose steps differ by condition is grouped, sign by condition",
      cb["strata"], [["hazard", "harm", [["+", [], "", ""], ["+", ["audit: absent"], "", ""], ["0", ["among trained staff"], "", ""]]]])
bl = "\n".join(mech.census(cb))
check("the census says each", ["unless  hazard -> harm (+) is blocked where defence holds" in bl,
                               "despite hazard -> harm (+) held although culture acted against it" in bl,
                               "strata  hazard -> harm: + unconditioned; + where audit: absent; 0 where among trained staff" in bl],
      [True, True, True])
check("and none of it is a fault", [f["message"] for f in by(rb, "mechanism") if f["severity"] == "!"], [])
for bad, why in ((BLOCK.replace("unless: defence", "unless: moat"), "`unless: moat` is not a declared state"),
                 (BLOCK.replace("despite: culture", "despite: harm"), "`despite: harm` names the step's own"),
                 (BLOCK.replace("{state: audit,", "{state: audits,"), "`given: {state: audits}` is not a declared state")):
    check(f"a bad G1 annotation is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nprofile 1.8: time (period, on: trend)")
# G7 (gap tests, 27 Sep 2026): the badger cull's effect during culling and its null after; the levy
# "dampening of the rate of increase ... rather than a reversal".
TIMES = (FIXTURE / "times.argdown").read_text(encoding="utf-8")
rt = run(TIMES)
ct = rt["shape"]["chain"]
# Mutation: drop the period from _strata's key -> the two nulls merge and the pair is not grouped by time.
check("one pair's findings in two periods are its time course, each with its period",
      ct["strata"], [["order", "reoff", [["-", [], "while the order runs", ""], ["0", [], "", ""], ["0", [], "after the order ends", ""]]]])
check("a null says when it holds", ct["null_steps"][0]["periods"], ["after the order ends"])
check("a step on a trend is named", ct["trends"], [["reoff", "prison", "+"]])
tl = "\n".join(mech.census(ct))
check("the census says each", ["strata  order -> reoff: - while the order runs; 0 unconditioned; 0 after the order ends" in tl,
                               "trend   reoff -> prison (+): moves the trend of prison, not its level" in tl,
                               "(after the order ends)" in tl], [True, True, True])
check("`on` is one of the values read",
      any("`on: rate` is not one of level, trend, being, persistence, character" in f["message"] for f in by(run(TIMES.replace("on: trend", "on: rate")), "mechanism")), True)

print("\nprofile 1.8: magnitude (size, share)")
# G3 (gap tests, 27 Sep 2026): every text gave sizes; Yellowstone's dispute is ONLY about size.
SIZES = (FIXTURE / "sizes.argdown").read_text(encoding="utf-8")
rz = run(SIZES)
cz = rz["shape"]["chain"]
check("a size is kept with its step, set out from its parts",
      cz["sizes"], [["order", "cost", "-", "a third of the cost"],
                    ["order", "reoff", "-", "-0.12 in the reoffending rate (95% CI -0.20 to -0.04) versus short prison terms at two years"]])
check("how much of a step runs by its route is named", cz["mediation"],
      [["order", "cost", "none", ["reoff"]], ["order", "reoff", "partial", ["work", "reint"]]])
# Mutation: let _opened ignore `share` -> the partial route is walked as the whole step, 1 route.
check("a step that runs only partly by its route keeps its direct remainder: two routes",
      {(r["start"], r["outcome"]): r["routes"] for r in cz["routes"]}[("order", "reoff")], 2)
check("  and is not walked as that route", cz["opened"], [])
check("a step that does NOT run through a state needs no route through it",
      [f["message"] for f in by(rz, "mechanism") if "do not give" in f["message"]], [])
zl = "\n".join(mech.census(cz))
check("the census says each", ["runs partly through work, reint" in zl, "does NOT run through reoff" in zl,
                               "size    order -> cost (-): a third of the cost" in zl], [True, True, True])
mixed = dict(cz, routes=[dict(cz["routes"][0], net={"+": 1, "-": 2, "?": 0})])
check("a start that raises by some routes and lowers by others is said to turn on size",
      "which wins is a matter of size" in "\n".join(mech.census(mixed)), True)
for bad, why in ((SIZES.replace("share: partial", "share: half"), "`share: half` is not one of entire, most, partial, none"),
                 (SIZES.replace("via: reoff, share: none", "share: none"), "`share` says how much of a step runs by a route")):
    check(f"a bad G3 annotation is named: {why}", any(why in f["message"] for f in by(run(bad), "mechanism")), True)

print("\nprofile 1.8: regimes and thresholds")
# G2 (gap tests, 27 Sep 2026): dose, place, time since culling, the model -- a regime decides which
# mechanism runs, and the census composed routes across regimes.
REG = (FIXTURE / "regimes.argdown").read_text(encoding="utf-8")
cr = run(REG)["shape"]["chain"]
rr = {(r["start"], r["outcome"]) for r in cr["routes"]}
check("without regimes, order reaches prison through reoffending", ("order", "prison") in rts, True)
# Mutation: ignore regimes in _routes -> the route comes back.
check("with the two steps in two regimes, no route is composed across them", ("order", "prison") in rr, False)
check("  while each step still counts", cr["steps"], rc["steps"])
check("the regimes are named", cr["regimes"], ["at high prison occupancy", "at low prison occupancy"])
check("a threshold is kept with its step", cr["thresholds"], [["order", "work", "+", "only where the order lasts more than six months"]])
rl = "\n".join(mech.census(cr))
check("the census says each", ["regime  2 named" in rl, "thresh  order -> work (+): only past a threshold" in rl], [True, True])
check("a step in no regime holds in all: a route through it and a regimed step is walked",
      mech._routes("a", "c", {("a", "b"), ("b", "c")}, ["a", "b", "c"], None, {("a", "b"): {("", "")}, ("b", "c"): {("r1", "")}})[0], 1)

print("\nwave 4's faults (28 Sep 2026)")
# Mutation: drop the period from _regimes -> the route across periods comes back.
cross = run(TIMES.replace("on: trend}", 'on: trend, period: "after the order ends"}'))["shape"]["chain"]
check("a route is not composed across two periods",
      ("order", "prison") in {(r["start"], r["outcome"]) for r in cross["routes"]}, False)
check("  and a loop is not closed across two periods",
      (mech._loops(["a", "b"], {("a", "b"), ("b", "a")}), mech._loops(["a", "b"], {("a", "b"), ("b", "a")},
       regimes={("a", "b"): {("", "p1")}, ("b", "a"): {("", "p2")}})), ([["a", "b"]], []))
CONT = CHAIN + """
[Work pays the bills]: "Work lowers what the state spends." #contested
    {fidelity: "quotation", causes: {from: work, to: cost, sign: "-", basis: asserted}}
    -> [Recommend]
"""
cc = run(CONT)["shape"]["chain"]
# Mutation: drop "contested" from the layer rule -> the step is the text's and cost is reached.
check("an objection the text voices is a rival view's step, not the text's", cc["rival_steps"], run(CHAIN)["shape"]["chain"]["rival_steps"] + 1)
check("  and an outcome reached only in such a view says so",
      any("`cost` is reached only by the steps of views the text reports" in g for g in cc["gaps"]), True)
NULLCOND = CHAIN.replace('        cost:    {label: "Cost", actor: state, role: outcome}',
                         '        cost:    {label: "Cost", actor: state, role: outcome}\n        season:  {label: "Season of sentencing", actor: courts, role: condition}') + """
[No season effect]: "The season of sentencing made no difference to reoffending."
    {fidelity: "quotation", causes: {from: season, to: reoff, sign: "0", basis: study}}
    +> [Recommend]
"""
# Mutation: drop null_from in _walk -> "the condition `season` has no step".
check("a condition whose only step is a finding of no effect is not unlinked",
      any("`season`" in g for g in run(NULLCOND)["shape"]["chain"]["gaps"]), False)
TOLD = CHAIN.replace('    question: "How would community orders reduce reoffending?"',
                     '    question: "How would community orders reduce reoffending?"\n    chains:\n        told: {label: "The deterrence story the brief reports"}').replace(
    'causes: {from: order, to: reoff, sign: "+", basis: asserted}}\n    -> [Recommend]',
    'causes: {from: order, to: reoff, sign: "+", basis: asserted, chain: told}}\n    -> [Recommend]')
rt = run(TOLD)
told = {c["id"]: c for c in rt["shape"]["chain"]["chains"]}["told"]
# Mutation: drop the rival fallback in _chain_profiles -> 0 steps, and the "declared but no step" query.
check("a chain of steps the text reports is walked on them, and says so", (told["steps"], told["layer"]), (1, "rival"))
check("  with no query that it is empty", [f for f in by(rt, "mechanism") if "declared but no step" in f["message"]], [])
RANK = {"zcond": {"role": "condition"}, "amod": {}, "out": {"role": "outcome"}}
# Mutation: iterate entries alphabetically -> amod first.
check("a declared condition's routes are listed before a state that merely leads out",
      [r["start"] for r in mech._walk(["zcond", "amod", "out"], RANK, {("zcond", "out"), ("amod", "out")}, True)["routes"]],
      ["zcond", "amod"])
rec = lambda given, size: dict(src="a", dst="b", sign="+", given=given, period="", size=size, selects=False)
# Mutation: drop size from _strata's key -> the two sizes merge or vanish.
check("a stratum keeps its size beside its condition",
      mech._strata([rec(["devices: exist"], "stronger"), rec(["devices: absent"], "weaker")]),
      [["a", "b", [["+", ["devices: absent"], "", "weaker"], ["+", ["devices: exist"], "", "stronger"]]]])

ENDS = {"a": {"role": "condition"}, "b": {}}
# Mutation: drop `ends` from the dead-end test -> `b` leads nowhere.
check("what a chain is for is no dead end on the whole map",
      ([g["kind"] for g in mech._walk(["a", "b"], ENDS, {("a", "b")}, False)["gaps"]],
       [g["kind"] for g in mech._walk(["a", "b"], ENDS, {("a", "b")}, False, ends={"b"})["gaps"]]),
      (["dead-end"], []))

print("\nprofile 1.9: moderation, necessity, evidence, rival accounts (wave 4)")
STORIES = (FIXTURE / "stories.argdown").read_text(encoding="utf-8")
rs9 = run(STORIES)
c9 = rs9["shape"]["chain"]
# Mutation: drop `modifies` from the census -> [].
check("a moderator that weakens a step, and one the text finds does not moderate it",
      c9["moderated"], [["aid", "diet", "+", "income", "weakens", ""], ["aid", "diet", "+", "schools", "0", ""]])
check("a necessary cause", c9["necessary"], [["income", "diet", "+"]])
check("a joint set that suffices, and a cause that is not enough alone",
      c9["sufficient"], [["diet", "malnourish", "-", ["schools"], True], ["income", "diet", "+", [], False]])
check("the text's words for its evidence are counted", c9["designs"], [["experiment", 1], ["illustration", 1]])
# Mutation: drop the illustration rule in steps() -> the example step is shaded argued.
check("  and a hypothetical illustration is shaded as asserted, not as an example",
      c9["tiers"], {"evidence": 2, "argued": 0, "asserted": 3, "imputed": 0})
check("a measure of a state is named with its method", c9["measures"], [["survey", "malnourish", "a household survey"]])
# Mutation: drop the measures exemption in _walk -> `survey` leads nowhere.
check("  and is no dead end", any("`survey`" in g for g in c9["gaps"]), False)
# Mutation: drop the moderator from null_from -> "the condition `income` ..." no; schools is no
# role, so test with a moderator that is a condition and has no step of its own.
MODONLY = STORIES.replace("schools: {label: \"School meals\", actor: state}",
                          "schools: {label: \"School meals\", actor: state, role: condition}").replace(
    "jointly: [schools], sufficient: true", "sufficient: true")
check("  a condition that only moderates is not unlinked",
      any("`schools`" in g for g in run(MODONLY)["shape"]["chain"]["gaps"]), False)
check("each attribution is kept with its step and whose it is", c9["attributions"],
      [["adverts", "choice", "+", "mechanical", "firms", "rival", "The radical story"],
       ["choice", "malnourish", "+", "intentional", "homes", "rival", "The conservative story"],
       ["ignorance", "malnourish", "+", "inadvertent", "", "rival", "The liberal story"]])
# Mutation: drop measured_by from steps() -> rests_on is empty.
check("a step's evidence read from a measure, with what the text says bears on the measure",
      c9["rests_on"], [["diet", "malnourish", "-", "survey", ["shame"]]])
check("  and the measured state's own step into its measure is not counted as a bias",
      "malnourish" in c9["rests_on"][0][4] if c9["rests_on"] else None, False)
check("the stances are counted", c9["stances"], [["rejected", 1], ["unjudged", 2]])
# An endorsed report is the author's own claim (James, 29 Sep 2026): named, never read as a stance.
# Mutation: drop the `endorsed` finding -> the step is quietly walked as a rival's.
END = run(STORIES.replace("by: firms}, stance: unjudged", "by: firms}, stance: endorsed"))
check("`stance: endorsed` is named, with the fix: write it in the author's voice",
      [f["fix"][:14] for f in by(END, "mechanism") if "endorses" in f["message"]], ["drop #reported"])
acc = {a["state"]: a["accounts"] for a in c9["accounts"]}
# Mutation: return [] from _accounts -> no accounts.
check("rival accounts of one outcome are set side by side",
      [(a["from"], a["layer"], a["stance"]) for a in acc.get("malnourish", [])],
      [("diet", "text", ""), ("ignorance", "rival", "unjudged"), ("choice", "rival", "rejected")])
check("  with the story that opens another's cause",
      [a["opened_by"] for a in acc.get("malnourish", []) if a["from"] == "choice"], [[["adverts", "The radical story"]]])
cl9 = "\n".join(mech.census(c9))
check("the census says each",
      ["modif   aid -> diet (+): NOT moderated by schools" in cl9, "needed  income -> diet" in cl9,
       "enough  income -> diet: NOT enough on its own" in cl9, "measure survey measures malnourish" in cl9,
       "accounts of malnourish" in cl9, "rival   3 step(s)" in cl9], [True] * 6)
check("the fixture raises no fault", [f["message"] for f in by(rs9, "mechanism") if f["severity"] == "!"], [])
BAD = STORIES.replace("effect: weakens", "effect: dampens").replace(
    "attribution: inadvertent", "attribution: careless").replace(
    "necessary: true, sufficient: false", "necessary: yes, sufficient: false").replace(
    "design: experiment,", "design: experiment, stance: unjudged,").replace(
    "measures: malnourish", "measures: hunger")
bad = [f["message"] for f in by(run(BAD), "mechanism")]
check("an unknown effect, attribution, a non-boolean, a stance on the text's own step and an "
      "undeclared measured state are each named",
      [any("dampens" in m for m in bad), any("careless" in m for m in bad),
       any("`necessary:` is `true` or `false`" in m for m in bad),
       any("`stance` says where the text stands" in m for m in bad),
       any("`measures: hunger`" in m for m in bad)], [True] * 5)


print("\ntwo accounts that cannot both hold (James's verdict on Yellowstone, 29 Sep 2026)")
SIZES = (FIXTURE / "sizes.argdown").read_text(encoding="utf-8")
DISP = SIZES + """
[A strong effect]: "Work strongly aids reintegration."
    {fidelity: "quotation", causes: {from: work, to: reint, sign: "+", basis: study, size: "strong"}}
    +> [Recommend]

[Only a modest effect]: "Work aids reintegration only modestly."
    {fidelity: "quotation", causes: {from: work, to: reint, sign: "+", basis: study, size: "modest"}}
    >< [A strong effect]
"""
cd = run(DISP)["shape"]["chain"]
# Mutation: return [] from _disputed -> nothing is disputed.
check("two steps on one pair whose claims are set against each other are disputed",
      [x for x in cd["disputed"] if x[0] == "work"], [["work", "reint", ["A strong effect", "Only a modest effect"]]])
check("  and the census says they cannot both hold",
      "dispute work -> reint: [A strong effect] and [Only a modest effect]" in "\n".join(mech.census(cd)), True)
check("  as is a rival view against the text's own finding; steps nothing sets against each other are not",
      run(SIZES)["shape"]["chain"]["disputed"], [["order", "reoff", ["No deterrence found", "Prison deters"]]])


print("\na null in words that deny sufficiency (James's verdicts on Merton, 29 Sep 2026)")
LIMIT = CHAIN + """
[Work alone will not do it]: "Work will not itself keep people out of prison."
    {fidelity: "quotation", causes: {from: work, to: reoff, sign: "0", basis: asserted}}
    +> [Recommend]
"""
lim = [f for f in by(run(LIMIT), "mechanism") if "limit an effect" in f["message"]]
# Mutation: drop the NOT_ENOUGH finding -> nothing is queried.
check("a null worded as a limit is queried, with the fix", [f["fix"][:22] for f in lim], ["if the text says the ca"[:22]])
check("  and a plain null is not", [f for f in by(run(CHAIN), "mechanism") if "limit an effect" in f["message"]], [])

print("\nprofile 1.10: what the levels are, and the tree they nest in (James, 30 Sep 2026)")
LV = "    levels: [macro, meso, micro]"
assert LV in CHAIN
def levels_as(extra):
    return CHAIN.replace(LV, LV + "\n" + extra)
od = run(levels_as("    ordering: composition\n    within: {meso: macro, micro: macro}"))
# Mutations: drop `ordering` from the profile -> the first fails; skip `within` -> the second.
check("`ordering:` is in the profile, as the reconstructor's reading",
      od["shape"]["chain"]["ordering"]["kind"], "composition")
check("  and `within:` as a tree, siblings within one whole",
      od["shape"]["chain"]["ordering"]["within"], [["meso", "macro"], ["micro", "macro"]])
check("  and the census says what the levels are",
      any("levels are parts within wholes (composition), as the reconstructor reads them" in l for l in mech.census(od["shape"]["chain"])), True)
st = run(levels_as('    ordering: {kind: space, pinpoint: "p. 3"}'))
check("a pinpoint makes it the text's own", st["shape"]["chain"]["ordering"]["stated"], "p. 3")
msgs = lambda text: [f["message"] for f in by(run(text), "mechanism")]
check("an ordering not in the list is a fault",
      any("is not one of composition" in m for m in msgs(levels_as("    ordering: nesting"))), True)
check("`within:` naming an undeclared level is a fault",
      any("not one of the declared levels" in m for m in msgs(levels_as("    within: {meso: nation}"))), True)
check("a tree the list's order cannot draw is queried, with the order that can",
      [f["fix"] for f in by(run(levels_as("    within: {micro: macro}")), "mechanism") if "outside the run" in f["message"]],
      ["list each level's parts straight after it: levels: [macro, micro, meso]"])
check("`within:` beside an ordering that is not containment is queried",
      any("is not a containment" in m for m in msgs(levels_as("    ordering: sequence\n    within: {meso: macro}"))), True)
check("a map that does not say is told so in the census",
      any("does not say what ordering its levels are" in l for l in mech.census(run(CHAIN)["shape"]["chain"])), True)

print("\nprofile 1.11: process, formation and constitution (Arthur 2023; Hu 2023; James, 30 Sep 2026)")
PROC = (FIXTURE / "process.argdown").read_text(encoding="utf-8")
pr = run(PROC, name="process.argdown")["shape"]["chain"]
# Mutations: drop the cycle from _walk -> the gap checks fail; drop `on` from the formation rows ->
# the fourth; walk a constitution as a step -> the route check fails.
check("a cycle is declared, and whether it comes to rest", pr["form"], {"form": "cycle", "settles": False})
check("  and it is not asked where it starts or what it is for",
      [g for g in pr["gaps"] if "no state has" in g or g.startswith("the outcome")], [])
check("each state's aspect is counted",
      pr["aspects"], [["activity", 2], ["condition", 2], ["development", 1], ["event", 1], ["quantity", 1]])
check("steps that make, keep, erode and transform are listed with what they act on",
      pr["formation"], [["drift", "ties", "-", "persistence"], ["meet", "ties", "+", "persistence"],
                        ["split", "boundary", "which", "character"], ["ties", "boundary", "+", "being"]])
check("constitutive relations are listed, to a state or to an actor",
      [r[:2] for r in pr["constitution"]], [["meet", "group"], ["rite", "boundary"], ["ties", "boundary"]])
check("  caused and constituted at once", pr["both"], [["ties", "boundary"]])
check("  and a rival causal reading of a pair the text holds constitutive",
      pr["readings"], [["rite", "boundary", "rival", "text"]])
check("a constitution is never walked: no route runs from what only constitutes",
      [r for r in pr["routes"] if r["start"] == "rite"], [])
census_p = "\n".join(mech.census(pr))
check("the census says it in verbs",
      all(w in census_p for w in ("keeps   meet -> ties", "erodes  drift -> ties", "makes   ties -> boundary",
                                  "changes split -> boundary", "constit meet partly constitutes group",
                                  "both    ties -> boundary", "reading rite -> boundary", "form    a cycle")), True)
pm = lambda text: [f["message"] for f in by(run(text, name="process.argdown"), "mechanism")]
check("a process with no owner and no levels is a fault",
      any("names no actor" in m for m in pm(PROC.replace("levels: [micro], aspect: activity", "aspect: activity"))), True)
check("an aspect not in the list is queried",
      any("aspect: verb" in m for m in pm(PROC.replace("aspect: event", "aspect: verb"))), True)
check("`on: character` with a + is queried: a change in kind is `which`",
      any("changes what kind of thing" in m for m in pm(PROC.replace("sign: which, on: character", 'sign: "+", on: character'))), True)
check("a constitution naming neither a state nor an actor is a fault",
      any("neither a declared state nor a declared actor" in m for m in pm(PROC.replace("to: group, extent", "to: club, extent"))), True)
check("`settles` without a cycle is queried",
      any("`settles` says whether a cycle" in m for m in pm(PROC.replace("    form: cycle\n", ""))), True)
check("a claim that only constitutes is the chain's material, not inert",
      run(PROC, name="process.argdown")["shape"]["contribution"]["inert"], 0)

print("\nwhat counts as a quoted sentence")
# THE WIMMER DEFECT. Mutations: go back to plain containment -> the first two fail.
import mechanism as mech  # noqa: E402
_n = lambda t: t.lower()
S1, S2 = "alpha beta gamma delta epsilon zeta eta theta iota kappa.", "lambda mu nu xi omicron pi rho sigma tau upsilon."
Q = "gamma delta epsilon zeta eta theta iota kappa. lambda mu nu xi omicron pi rho sigma tau upsilon"
check("a quotation running across two sentences quotes the second, its stop stripped", mech._quoted(S2, Q), True)
check("and the first, which it begins part-way into, where it takes most of it", mech._quoted(S1, Q), True)
check("a quotation inside a sentence quotes it, as before", mech._quoted(S1, "delta epsilon zeta"), True)

print()
if fails:
    sys.exit(f"{fails} check(s) failed")
print("all mechanism checks passed")
