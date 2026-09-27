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
      chain.get("null_steps"), [{"from": "order", "to": "reoff", "basis": "study", "refutes": ["+"]}])
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
