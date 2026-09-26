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

print()
if fails:
    sys.exit(f"{fails} check(s) failed")
print("all mechanism checks passed")
