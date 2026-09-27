#!/usr/bin/env python3
"""Exposition coverage: what of the text's own order the map has nothing in.

    python3 ipsissima-mcp/tests/test_exposition.py

The census's EXPOSITION block feeds the method's exposition step (extraction-prompt.md, step 4),
and the step has a budget: a minute or so, not a second pass. So the block has two jobs, and a
test for each. It must FIND what the step is for -- an abstract or introduction with nothing
mapped, a paper's opening mapped far more thinly than its body, a contention stated long before it
is argued -- each with the sentence to judge it by. And it must NOT turn a sparsely mapped long
text into a to-do list: a gap is measured against the map's own density, and everything outside
the step is counted in one line for an optional full pass.
"""
import io
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
import argdown_provenance as prov                                 # noqa: E402
import check_argdown as ca                                        # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" +
          ("" if ok else f"\n          got  {got!r}\n          want {want!r}"))


PROSE = " and the argument continues through a sentence of ordinary prose here" * 4
PAPER = [
    "# A paper on fees", "",
    "## Abstract", "",
    "We argue that small fees sharply reduce the take-up of useful health products among the "
    "poor." + PROSE, "",
    "## 1. Introduction", "",
    "Charging for health products is widely advocated, and this introduction sets the scene "
    "for the evidence." + PROSE, "",
    "## 2. Evidence", "",
    "Ten randomised trials show a large drop in take-up when any price is charged at all." + PROSE,
    "", "A second paragraph of evidence, from the trials in Kenya and Zambia." + PROSE, "",
    "## 3. A survey of other views", "",
    "Many others have written on cost-sharing, and this section surveys them at some length." + PROSE,
    ""] + sum([[f"The survey goes on to its view number {i}, which the paper does not use." + PROSE * 2, ""]
               for i in range(2, 9)], []) + [
    "## 4. Conclusion", "",
    "So small fees sharply reduce the take-up of useful health products among the poor, and "
    "policy should follow." + PROSE, "",
    "## References", "", "Smith 2010, on fees and take-up among the poor." + PROSE, "",
]
root = tempfile.mkdtemp()
Path(root, "p.md").write_text("\n".join(PAPER), encoding="utf-8")
at = lambda s: next(i + 1 for i, l in enumerate(PAPER) if s in l)   # noqa: E731


def claim(text, **data):
    return {"members": [{"text": text, "data": dict(chapter="p.md", **data)}], "data": {}}


DOC = {"statements": {
    "fees": claim("Small fees sharply reduce the take-up of useful health products.",
                  line=at("So small fees sharply")),
    "trials": claim("Ten trials show a drop in take-up.", line=at("Ten randomised")),
    "kenya": claim("The Kenya and Zambia trials agree.", line=at("A second paragraph")),
}}

print("the band rule, in Python")
b = prov.bands_of(PAPER)
check("the sections that divide the text are the bands, the references among them as back matter",
      [(x["heading"], x["back"]) for x in b["bands"]],
      [("Abstract", False), ("1. Introduction", False), ("2. Evidence", False),
       ("3. A survey of other views", False), ("4. Conclusion", False), ("References", True)])

print("\nthe coverage")
cov = prov.exposition_coverage(DOC, root, None, ["fees"])
gaps = {g["heading"]: g for g in cov["files"]["p.md"]["gaps"]}
check("the abstract and introduction, with nothing mapped, are gaps the step is for",
      [(h, gaps[h]["announcing"]) for h in ("Abstract", "1. Introduction")],
      [("Abstract", True), ("1. Introduction", True)])
check("  each with the sentence it opens on",
      gaps["Abstract"]["first"].startswith("We argue that small fees"), True)
check("the survey is a gap too, but not one the step is for", gaps.get("3. A survey of other views", {}).get("announcing"), False)
check("the references are never a gap", "References" in gaps, False)
check("the contention is announced in the abstract, well before its place at the end",
      [(a["title"], a["line"]) for a in cov["announced"]], [("fees", at("We argue that"))])
DOC2 = {"statements": dict(DOC["statements"], fees=claim(
    "Small fees sharply reduce the take-up of useful health products.",
    line=at("So small fees sharply"),
    echoes="We argue that small fees sharply reduce the take-up of useful health products among the poor."))}
cov2 = prov.exposition_coverage(DOC2, root, None, ["fees"])
check("once the echo is recorded the announcement is no longer reported, and the abstract is mapped",
      (cov2["announced"], "Abstract" in {g["heading"] for g in cov2["files"]["p.md"]["gaps"]}),
      ([], False))

DOC3 = {"statements": dict(DOC["statements"], fees=claim(
    "Small fees sharply reduce the take-up of useful health products.",
    line=at("So small fees sharply"),
    echoes="So small fees sharply reduce the take-up of useful health products among the poor"))}
check("a contention with an echo recorded ANYWHERE is not reported again: it is announced once",
      prov.exposition_coverage(DOC3, root, None, ["fees"])["announced"], [])

print("\nthe report, and its budget")
ca.FINDINGS.clear()
ca.SHAPE.clear()
with redirect_stdout(io.StringIO()) as out:
    ca.exposition_report(prov, DOC, root, None, ["fees"])
text = out.getvalue()
found = sorted({f["check"] for f in ca.FINDINGS})
check("the step's items are things to look at, never faults",
      {f["severity"] for f in ca.FINDINGS}, {"?"})
check("  one finding per kind, not one per section", found,
      ["exposition-announced", "exposition-gap"])
check("  and the announcement's fix is the echo to write",
      next(f["fix"] for f in ca.FINDINGS if f["check"] == "exposition-announced").startswith(
          'if that sentence states the claim (not its denial, not a question), add echoes: ["We argue'),
      True)
check("the survey is counted for the optional full pass, not listed as the step",
      "for a full exposition pass only (optional): 1 more section(s)" in text, True)
check("the census says how many items the step has", ca.SHAPE["exposition"]["step"], 3)

ca.FINDINGS.clear()
ca.SHAPE.clear()
full = {"statements": {k: claim(v, line=at(v[:20])) for k, v in [
    ("a", "We argue that small fees sharply reduce the take-up"),
    ("b", "Charging for health products is widely advocated"),
    ("c", "Ten randomised trials show a large drop in take-up"),
    ("d", "Many others have written on cost-sharing"),
    ("e", "So small fees sharply reduce the take-up")]}}
# The abstract states the contention, so the covered map records it as an echo of it.
full["statements"]["e"]["members"][0]["data"]["echoes"] = (
    "We argue that small fees sharply reduce the take-up of useful health products among the poor.")
with redirect_stdout(io.StringIO()) as out:
    ca.exposition_report(prov, full, root, None, ["e"])
check("a map with every section covered prints nothing at all -- no tokens in the census",
      (out.getvalue(), ca.FINDINGS), ("", []))

print("\nan opening with nothing mapped, and one merely thinner than the body")
OPEN = ["# An essay", "",
        "The essay opens with a long paragraph of scene-setting before its first section." + PROSE * 3, "",
        "A second opening paragraph that states the essay's thesis in so many words." + PROSE * 2, "",
        "## 1. The case", "", "The case is made here, in the body, at length." + PROSE * 2, "",
        "## 2. More of it", "", "And more of the case is made here, in the body too." + PROSE * 2, ""]
Path(root, "open.md").write_text("\n".join(OPEN), encoding="utf-8")
lo = lambda s: next(i + 1 for i, l in enumerate(OPEN) if s in l)   # noqa: E731
body_only = {"statements": {k: {"members": [{"text": k, "data": {"chapter": "open.md", "line": lo(v)}}], "data": {}}
                            for k, v in [("b1", "The case is made"), ("b2", "And more of the case")]}}
ca.FINDINGS.clear(); ca.SHAPE.clear()
with redirect_stdout(io.StringIO()):
    ca.exposition_report(prov, body_only, root, None, [])
check("an opening with nothing mapped is part of the step",
      [f["check"] for f in ca.FINDINGS], ["exposition-opening"])
anchored = {"statements": dict(body_only["statements"], **{
    k: {"members": [{"text": k, "data": {"chapter": "open.md", "line": lo(v)}}], "data": {}}
    for k, v in [("o1", "The essay opens"), ("o2", "A second opening")]})}
ca.FINDINGS.clear(); ca.SHAPE.clear()
with redirect_stdout(io.StringIO()):
    ca.exposition_report(prov, anchored, root, None, [])
check("  but an opening the step has anchored claims in is left alone, however thin its ratio",
      ca.FINDINGS, [])

print("\na sparse map of a long text is not a to-do list")
LONG = ["# A book chapter", ""]
for i in range(1, 21):
    LONG += [f"## {i}. Part {i}", "", f"Part {i} holds a paragraph of ordinary prose." + PROSE * 3, ""]
Path(root, "long.md").write_text("\n".join(LONG), encoding="utf-8")
sparse = {"statements": {"only": {"members": [{"text": "One claim.", "data": {
    "chapter": "long.md", "line": LONG.index(next(l for l in LONG if l.startswith("Part 20"))) + 1}}],
    "data": {}}}}
cl = prov.exposition_coverage(sparse, root)
check("nineteen unmapped parts of a map with one claim in twenty expect under two claims each, "
      "so none is a gap", cl["files"]["long.md"]["gaps"], [])

print(f"\n{'FAILED' if fails else 'all passed'} ({fails} failed)")
sys.exit(1 if fails else 0)
