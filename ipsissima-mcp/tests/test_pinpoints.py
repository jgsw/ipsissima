#!/usr/bin/env python3
"""Pinpoints: does a quoted claim's pinpoint cite the page its words are on?

    python3 ipsissima-mcp/tests/test_pinpoints.py

`pinpoint` was written for a human reader and never checked. The words of a quoted claim are
in the text, so their page is a fact wherever the source carries page markers, and a pinpoint
that disagrees with it is either a slip or an estimate -- or the page markers are wrong, which
only the printed pages can settle. So the checker reports, never faults, and says which.

Three things it must not do, each with a case here. It must not call a paragraph that runs
across a page break "off" for citing the page it begins on: the markers sit between paragraphs,
so a paragraph beside one may be on either page (every apparent mismatch in the samples was
this). It must not check a note against the page a converter moved it to. And it must not check
pinpoints against a source numbered differently -- pages 1-3 against a journal's 691-693 -- but
say once that it cannot.
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


PROSE = " and the argument continues through a sentence of ordinary prose" * 3
PAPER = [
    "# A paper", "",
    "<!-- p.5 begins here -->", "",
    "The paper opens by stating that small fees reduce take-up among the poor." + PROSE, "",
    "<!-- p.6 begins here -->", "",
    "Ten trials show that the effect is large in every country studied." + PROSE, "",
    "A second paragraph on the sixth page, wholly on it and beside no marker." + PROSE, "",
    "A third paragraph, so that the sixth page has a middle as well as edges." + PROSE, "",
    "<!-- p.7 begins here -->", "",
    "The paragraph the seventh page turns in begins with these very words." + PROSE, "",
    "A paragraph in the middle of the seventh page, beside no marker at all." + PROSE, "",
    "One more paragraph so that the seventh page ends away from its marker." + PROSE, "",
    "<!-- p.8 begins here -->", "",
    "A plain paragraph on the eighth page, not beside the marker above it." + PROSE, "",
    "The words that a careless pinpoint puts four pages too early stand here." + PROSE, "",
    "# Notes", "",
    "1 The note printed at the foot of the fifth page, lifted here by the converter.", "",
]
OTHER = ["<!-- p.1 begins here -->", "",
         "A text numbered by the file's own pages rather than by the journal's." + PROSE, "",
         "<!-- p.2 begins here -->", "",
         "Its second page, which the journal printed as page one hundred and two." + PROSE, ""]
root = tempfile.mkdtemp()
Path(root, "p.md").write_text("\n".join(PAPER), encoding="utf-8")
Path(root, "o.md").write_text("\n".join(OTHER), encoding="utf-8")
at = lambda s: next(i + 1 for i, l in enumerate(PAPER) if s in l)   # noqa: E731


def claim(text, pinpoint, chapter="p.md", **data):
    return {"members": [{"text": text, "data": dict(chapter=chapter, pinpoint=pinpoint, **data)}],
            "data": {}}


DOC = {"statements": {
    "onpage": claim('Ten trials: "the effect is large in every country studied".', "p. 6"),
    "across": claim('It says "the seventh page turns in begins with these very words".', "p. 6"),
    "off": claim('It says "a careless pinpoint puts four pages too early".', "p. 5"),
    "noted": claim('The note: "printed at the foot of the fifth page".', "p. 5 n. 1"),
    "section": claim('It says "a paragraph in the middle of the seventh page".', "§ 2"),
    "loose": claim("The paper holds that careless pinpoints come four pages early.", "p. 5"),
    "unpaged": claim('It says "which the journal printed as page one hundred and two".', "p. 102",
                     chapter="o.md"),
}}

print("the pages a line may be on")
lines = ["intro", "<!-- p.9 begins here -->", "", "<!-- p.10 begins here -->", "",
         "a paragraph under two markers", "", "a paragraph between", "", "a paragraph above one",
         "", "<!-- p.11 begins here -->", "<!-- a converter's note -->", "after"]
r = prov.page_ranges(lines)
check("a paragraph under stacked markers may have begun on the page before the first",
      r[5], (8, 10))
check("  one beside no marker is on its page alone", r[7], (10, 10))
check("  one just above a marker may run on to it", r[9], (10, 11))
check("  and a converter's one-line comment does not separate a paragraph from its marker",
      r[13], (10, 11))
check("nothing before the first marker has a page", r[0], None)

print("\nthe check")
quotes = prov.check_quotations(DOC, root)
mism, checked, unpaged = prov.pinpoint_check(DOC, root, quotes)
check("quoted claims citing a page the source carries are checked -- not the section pinpoint, "
      "not the claim placed by paragraph, not the differently numbered file", checked, 4)
check("only the careless pinpoint is reported", [m["title"] for m in mism], ["off"])
check("  with the page its words are on, and their line",
      (mism[0]["pages"], mism[0]["line"]), ([8, 8], at("a careless pinpoint")))
check("a paragraph across a break may cite the page it begins on",
      any(m["title"] == "across" for m in mism), False)
check("a note is not checked against the page a converter moved it to",
      any(m["title"] == "noted" for m in mism), False)
check("a file numbered differently from the pinpoints is reported once, as that",
      unpaged, {"o.md": ([1, 2], [102])})

print("\nthe report")
ca.FINDINGS.clear()
with redirect_stdout(io.StringIO()) as out:
    ca.pinpoint_report(prov, DOC, root, quotes)
text = out.getvalue()
found = [(f["check"], f["severity"], f.get("title"), f.get("fix")) for f in ca.FINDINGS]
check("each is a thing to look at, never a fault", {f[1] for f in found}, {"?"})
check("the careless pinpoint, with the pinpoint the words are on -- if the markers are right",
      [f for f in found if f[0] == "pinpoint"],
      [("pinpoint", "?", "off", 'pinpoint: "p. 8", if the page markers are right')])
check("the differently numbered file, once", [f[0] for f in found if f[0] == "pinpoint-pages"],
      ["pinpoint-pages"])
check("  and the prose says how many were checked", "PINPOINTS (4 quoted claim(s)" in text, True)

print("\nmany in one file is a pattern")
many = {"statements": {f"c{i}": claim('It says "a careless pinpoint puts four pages too early".',
                                      "p. 5") for i in range(3)}}
ca.FINDINGS.clear()
with redirect_stdout(io.StringIO()):
    ca.pinpoint_report(prov, many, root, prov.check_quotations(many, root))
pattern = [f for f in ca.FINDINGS if f["check"] == "pinpoint" and not f.get("title")]
check("three off in one file adds one finding saying to check the page markers first",
      len(pattern), 1)
check("  with how far off they are", "off by +3 page(s)" in pattern[0]["message"], True)

print(f"\n{'FAILED' if fails else 'all passed'} ({fails} failed)")
sys.exit(1 if fails else 0)
