#!/usr/bin/env python3
"""Tests for the four reading checks: quotation context, warrants, policy, interpretive load.

    python3 .claude/skills/argdown/test_reading_checks.py

WHY A FIXTURE AND NOT A REAL MAP. Three of the four structures under test are cases where the
quotation is ACCURATE and the report is nevertheless false -- Stern's "misreporting". No real
reconstruction in this repo contains one, which is the point of them; so they have to be planted
in a source written for the purpose, where the right answer is known independently of whatever
the code happens to do. `test_misreporting/` is that source, and its header records the expected
verdict for every claim. Those expectations were written BEFORE the code that produces them.

The control matters as much as the hits. `[clean-control]` quotes a whole sentence honestly and
must produce SILENCE: a check that fires on an ordinary quotation would be turned off within a
week, and then the three real cases would go unreported too.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
# The package this exercises, one level up and over — the tests no longer sit beside it.
PKG = HERE.parents[0] / "src" / "ipsissima_mcp"
sys.path.insert(0, str(PKG))
import argdown_provenance as prov                                   # noqa: E402

CLI = HERE / ".." / ".." / "app" / "node_modules" / ".bin" / "argdown"
FIXTURE = HERE / "test_misreporting" / "misreporting.argdown"
ROOT = HERE / "test_misreporting"

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" +
          ("" if ok else f"\n          got  {got!r}\n          want {want!r}"))


def load():
    with tempfile.TemporaryDirectory() as td:
        r = subprocess.run([str(CLI), "json", str(FIXTURE), "--outputDir", td],
                           capture_output=True, text=True)
        files = [f for f in os.listdir(td) if f.endswith(".json")]
        if not files:
            sys.exit(f"could not export the fixture: {r.stderr or r.stdout}")
        doc = json.load(open(os.path.join(td, files[0]), encoding="utf-8"))
    prov.apply_defaults(doc, prov.read_frontmatter(str(FIXTURE)))
    return doc


doc = load()
quotes = prov.check_quotations(doc, str(ROOT))
ctx = {c["title"]: c for c in prov.quotation_context(doc, str(ROOT), quotes)}

print("front matter after a comment header")
# The fixture opens with a `//` block, as every reconstruction in this repo does. `re.match`
# anchored at index 0 returned {} for such a file, so `defaults:` silently stopped applying and
# every claim reported "no chapter". VERIFIED against the CLI: it honours the block either way.
check("a block that follows comments is still read",
      sorted(prov.read_frontmatter(str(FIXTURE))), ["defaults", "reconstruction", "title"])
check("  and its defaults reach the claims",
      prov.merged_statements(doc)["thesis"]["data"].get("chapter"), "source/treatise.md")

print("\nquotation verdicts")
status = {q["title"]: q["status"] for q in quotes}
check("an accurate quotation is exact", status.get("hedged-knowledge"), "exact")
# Stern's fourth case -- the interpreter's words substituted inside the quotation marks -- needs
# nothing new. It does not match, and the existing checker already calls it.
check("words replaced inside the span are caught by the old check",
      status.get("present-age"), "near")

print("\nthe control: an honest quotation must be silent")
c = ctx["clean-control"]
check("runs to the end of its sentence", c["complete"], True)
check("no dropped qualifier", c["dropped"], None)
check("no corrective continuation", c["continues"], None)
check("no oversized elision", c["gap"], 0)
check("no imported terms", c["absent_terms"], [])

print("\nStern's first case: the author's own correction left outside the quotation")
c = ctx["hedged-knowledge"]
check("the continuation is reported", bool(c["continues"]), True)
check("  and it is the corrective clause",
      c["continues"].startswith("or, more coarsely and clearly"), True)
check("nothing is wrongly dropped from the front", c["dropped"], None)

print("\nStern's second case: a quantifier dropped, and a contrast cut")
c = ctx["all-drives"]
check("the dropped quantifier is named", c["dropped"], "some")
check("the contrastive continuation is reported",
      c["continues"].startswith("whereas"), True)

print("\nStern's third case: a term imported into the report")
check("the absent term is named", ctx["will-to-power"]["absent_terms"], ["power"])
# `mixed` against a source saying `mixes` was reported as absent until stemming was added, and
# an inflection is the same term.
check("an inflection is not reported as absent", ctx["far-elision"]["absent_terms"], [])
# Argdown tags live in the statement text. Reading them as the claim's own vocabulary made this
# fire on nearly every quotation-fidelity claim in all three sample reconstructions.
check("a tag is not a word of the claim",
      any("core" in c["absent_terms"] for c in ctx.values()), False)

print("\nelisions")
check("an over-long elision is reported", ctx["far-elision"]["gap"] > prov.MAX_ELISION, True)
# An elided quotation has no single sentence; taking one span from the first part's start to the
# last part's end returned everything between them, headings included.
check("each half is read in its own sentence",
      ctx["far-elision"]["sentence"] != ctx["far-elision"]["sentence_last"], True)
check("  and the first half's sentence is the first one",
      ctx["far-elision"]["sentence"].startswith("Our knowledge"), True)

print("\nfidelity derived from the source, not believed")
# 38 of 126 `quotation` markers across the reference maps were wrong, always in the same
# direction. Instruction halved the rate and did not remove it, so the field is computed.
_over, _under = prov.fidelity_disputes(doc, str(ROOT))
check("a claim whose text IS the source's words is not flagged",
      "hedged-knowledge" in _over, False)
check("a claim marked `quotation` whose text is a summary IS flagged",
      "will-to-power" in _over or "far-elision" in _over, True)
# A light rewording is still the source's words; only summarising is not.
check("the test allows near-misses, not just exact matches",
      prov.find_quote("Our knowledge might be false", open(
          ROOT / "source" / "treatise.md", encoding="utf-8").read())[0], "exact")

# THE SERVICE THE VIEWER BUILD CALLS. One implementation of the rule, two callers: the checker
# reports it to a human, the build uses it to draw the border. Reimplementing the near-match in
# JavaScript is the drift hazard test_argdown_positions.mjs exists to police.
print("\nderived-fidelity service (--derive-fidelity)")
_r = subprocess.run([sys.executable, str(PKG / "check_argdown.py"), str(FIXTURE),
                     "--source-root", str(ROOT), "--derive-fidelity"],
                    capture_output=True, text=True)
_d = json.loads(_r.stdout.strip() or "{}")
check("returns a verdict per adjudicable claim", bool(_d), True)
check("a summary marked `quotation` is demoted", _d.get("will-to-power"), "paraphrase")
check("verbatim text is called `quotation`", _d.get("clean-control"), "quotation")
# A claim too short to test is left alone rather than guessed at: a six-word claim can coincide
# with the source by accident, and calling that a quotation would be worse than asking.
check("a claim below the length floor gets no verdict",
      "hedged-knowledge" in _d, False)
# Judgements about the READING are never touched: only quotation/paraphrase is a fact.
check("an imputation is left alone", "leap" in _d, False)
check("an interpretation is left alone", "thesis-two" in _d, False)
check("output is valid JSON on a file with no source root",
      json.loads(subprocess.run([sys.executable, str(PKG / "check_argdown.py"), str(FIXTURE),
                                 "--derive-fidelity"], capture_output=True,
                                text=True).stdout.strip() or "null"), {})

print("\n--fix, and what it may not touch")
import shutil, tempfile
_tmp = tempfile.mkdtemp()
shutil.copytree(str(ROOT), os.path.join(_tmp, "src"))
_f = os.path.join(_tmp, "src", "misreporting.argdown")
_before = open(_f, encoding="utf-8").read()
# A file that has NOT declared itself generated is someone's work and is never written to.
subprocess.run([sys.executable, str(PKG / "check_argdown.py"), _f,
                "--source-root", os.path.join(_tmp, "src")], capture_output=True)
check("a file with no `generated:` marker is never written to",
      open(_f, encoding="utf-8").read(), _before)
# With --fix it corrects, and only the two adjudicable levels.
subprocess.run([sys.executable, str(PKG / "check_argdown.py"), _f,
                "--source-root", os.path.join(_tmp, "src"), "--fix"], capture_output=True)
_after = open(_f, encoding="utf-8").read()
check("--fix changes the file when asked", _after != _before, True)
check("  and never touches interpretation",
      _after.count('"interpretation"'), _before.count('"interpretation"'))
check("  nor imputation", _after.count('"imputation"'), _before.count('"imputation"'))
check("  and leaves it clean on a re-run",
      "whose OWN TEXT" in subprocess.run(
          [sys.executable, str(PKG / "check_argdown.py"), _f, "--source-root",
           os.path.join(_tmp, "src")], capture_output=True, text=True).stdout, False)
# The demotion target follows the evidence: a verified quotation means paraphrase, none means
# compression -- so the tool never has to guess which weaker level applies.
check("a demoted claim carrying a verified quotation becomes `paraphrase`",
      'fidelity: "paraphrase"' in _after, True)

print("\nunmarked splices")
# A claim can quote accurately twice and still misreport, by joining two separated passages as
# though the author wrote one. The machinery for MARKED elisions already existed; this is the
# same measurement where nothing declares the join.
_sp = {t for t, _, _, _ in prov.spliced_claims(doc, str(ROOT))}
check("a claim marking its elision is not flagged", "far-elision" in _sp, False)
check("an ordinary single-passage claim is not flagged", "clean-control" in _sp, False)
# The discriminator: a paraphrase that borrows a phrase here and there is a paraphrase.
# Only claims made mostly OF the source's words can misreport by splicing.
check("mostly-own-words claims are left alone", "thesis" in _sp, False)

print("\nwarrants")
unwarranted, census, odd = prov.warrant_gaps(doc)
check("a departure with no warrant is reported",
      [(u["title"], u["fidelity"]) for u in unwarranted], [("leap", "imputation")])
check("  and whether it at least carries a note", unwarranted[0]["note"], False)
check("warrants given are counted", census, {"coherence": 1, "enthymeme": 1})
check("compression is not a departure and owes nothing", odd, [])

print("\nreading policy")
policy, unknown = prov.reconstruction_policy(str(FIXTURE))
check("the block is read", policy.get("aim"), "fit")
check("all four dimensions", sorted(policy), ["aim", "mode", "strength", "unit"])
check("documented values raise nothing", unknown, [])

print("\ninterpretive load")
il = prov.interpretive_load(doc)
loads = {c["contention"]: c["load"] for c in il["contentions"]}
# The whole point of the measure: one contention can be reached on reported material, the other
# cannot be reached at all without claims the author never made.
check("a contention with a clean route reads 0", loads.get("thesis"), 0)
check("a contention held up by the reconstructor reads above 0", loads.get("thesis-two"), 1)
path = {c["contention"]: c["path"] for c in il["contentions"]}["thesis-two"]
check("  and the cheapest route is shown", path[0], "bridge")
check("the census counts every level", {k: v for k, v in il["census"].items() if v},
      {"quotation": 6, "compression": 1, "interpretation": 1, "imputation": 2})
check("no cycles in a DAG", il["cycles"], [])
# An objection holds nothing up. Requiring only "nothing supports it" listed every objection in
# all three sample reconstructions as though it were a premise the reading rests on.
check("load-bearing means it holds something up",
      [(l["title"], l["supports"]) for l in il["leaves"]], [("leap", 1)])
check("an assumption that is itself argued for is not load-bearing",
      any(l["title"] == "bridge" for l in il["leaves"]), False)

print(f"\n{fails} FAILED" if fails else "\nall passed")
sys.exit(1 if fails else 0)
