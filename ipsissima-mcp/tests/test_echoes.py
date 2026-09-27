#!/usr/bin/env python3
"""Echoes: the other places a text states a claim -- verified when recorded, proposed when not.

    python3 ipsissima-mcp/tests/test_echoes.py

`echoes:` records, as the author's words, where else the text states a claim: its thesis
announced in the abstract, say, and argued three sections later. The exposition view draws a
faint echo there. Two things can go wrong, and each has a test here. An echo that is not in the
text would draw a mark pointing at words nobody wrote, so echoes are verified like quotations.
And an echo read as a QUOTATION would move the claim itself to wherever it is echoed -- the very
thing the field exists to avoid -- so echoes are kept out of everything that pins a claim.
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
import argdown_provenance as prov                                 # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" +
          ("" if ok else f"\n          got  {got!r}\n          want {want!r}"))


PROSE = " and the argument continues through a sentence of ordinary prose" * 3
PAPER = "\n".join([
    "---", "abstract: We argue that small fees sharply reduce take-up among the poor.", "---", "",
    "# 1. Introduction", "",
    "We argue that small fees sharply reduce take-up among the poor." + PROSE, "",
    "# 2. Evidence", "",
    "Ten trials show that small fees sharply reduce the take-up of useful products among the "
    "poor, whatever the product." + PROSE, "",
    "# 3. Conclusion", "",
    "So small fees sharply reduce take-up among the poor, and the policy should follow." + PROSE,
    "", "# References", "",
    "Smith 2010, on small fees and take-up among the poor, in a journal of development." + PROSE,
    ""])
BOOK_INTRO = "Chapter five will show that the reconstruction survives its hardest case." + PROSE


def doc_with(data, text="Small fees sharply reduce the take-up of useful products among the poor."):
    return {"statements": {"fees": {"members": [{"text": text, "data": data}], "data": {}}}}


root = tempfile.mkdtemp()
Path(root, "p.md").write_text(PAPER, encoding="utf-8")
Path(root, "intro.md").write_text(BOOK_INTRO, encoding="utf-8")

print("reading the field")
check("a single string is one span", prov.echo_spans("the words of the author"),
      ["the words of the author"])
check("a list is several, and quotation marks round a span are optional",
      prov.echo_spans(['"the words of the author"', "“and more of them here”"]),
      ["the words of the author", "and more of them here"])
check("a span too short to be told from coincidence is dropped", prov.echo_spans(["too short"]),
      [])

print("\nverifying what is recorded")
res = prov.check_echoes(doc_with({"chapter": "p.md", "echoes": [
    "We argue that small fees sharply reduce take-up among the poor.",
    "words that appear nowhere in the paper at all"]}), root)
check("an echo in the text is found, at its line -- not in the front matter's copy", [(r["status"], r["line"]) for r in res][0],
      ("exact", 7))
check("  and one not in the text is reported, not drawn", res[1]["status"] in ("absent", "near"),
      True)
res = prov.check_echoes(doc_with({"chapter": "p.md", "echoes":
    ["Chapter five will show that the reconstruction survives its hardest case."]}), root)
check("an echo in ANOTHER file is found there: a book's introduction announces its chapters",
      [(r["status"], r["chapter"]) for r in res], [("exact", "intro.md")])

Path(root, "fm.md").write_text("---\ntitle: A paper\nabstract: >-\n  Wolves restored the willows along "
                                "the northern streams of the park.\n---\n\n# 1. Introduction\n\n" + PROSE,
                                encoding="utf-8")
res = prov.check_echoes(doc_with({"chapter": "fm.md", "echoes":
    ["Wolves restored the willows along the northern streams of the park."]}), root)
# Mutation: return "absent" at the end of _find_in_text again -> fails.
check("an echo of an abstract kept ONLY in the front matter is found there, the one copy there is",
      [(r["status"], r["line"]) for r in res], [("exact", 4)])

print("\nan echo never pins the claim")
doc = doc_with({"chapter": "p.md",
                "echoes": ["We argue that small fees sharply reduce take-up among the poor."]},
               text="The fees reduce the adoption of products by the poorest households.")
check("check_quotations does not see an echo",
      [q for q in prov.check_quotations(doc, root)], [])
where = prov.resolve_lines(doc, root, prov.check_quotations(doc, root))["fees"]
check("so the claim is not moved to where it is echoed", where["line"] == 2, False)

print("\nproposing what might be recorded")
doc = doc_with({"chapter": "p.md"})
cands = prov.echo_candidates(doc, root)
lines = sorted(c["line"] for c in cands)
check("the introduction and the conclusion are proposed as places the claim recurs", lines,
      [7, 15])
check("  the earlier one first -- an announcement is what the view most needs",
      cands[0]["where"], "earlier")
check("  with the sentence to quote", cands[0]["sentence"].startswith("We argue that small fees"),
      True)
check("the reference list is never proposed", any(c["line"] == 19 for c in cands), False)
doc = doc_with({"chapter": "p.md", "echoes": [
    "We argue that small fees sharply reduce take-up among the poor."]})
check("an echo already recorded is not proposed again",
      sorted(c["line"] for c in prov.echo_candidates(doc, root)), [15])

print(f"\n{'FAILED' if fails else 'all passed'} ({fails} failed)")
sys.exit(1 if fails else 0)
