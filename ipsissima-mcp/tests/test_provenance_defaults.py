#!/usr/bin/env python3
"""Tests for front-matter provenance defaults.

    python3 .claude/skills/argdown/test_provenance_defaults.py

The point of defaults is to stop `chapter` and `reviewed` being retyped on every claim -- about
15% of the bytes of a finished map. The risk they introduce is that a default silently overrides
something a claim actually said, which would misattribute a quotation to the wrong file and be
invisible in the output. That is the case these tests exist for.

There are TWO readers of the same block: this half parses it out of the file text, because the
CLI's json export drops front matter, while the JS half takes it from the core parser's response.
They have to agree, and `test_argdown_positions.mjs` is what compares them on a real map.
"""
import sys
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


def write(text):
    p = Path("/tmp/_fm_test.argdown")
    p.write_text(text, encoding="utf-8")
    return str(p)


print("read_frontmatter")
f = write('===\ntitle: A paper\ndefaults:\n  chapter: "source/x.md"\n  reviewed: "2026-08-18"\n===\n\n[a]: Claim.\n')
check("a nested defaults block is read",
      prov.read_frontmatter(f).get("defaults"),
      {"chapter": "source/x.md", "reviewed": "2026-08-18"})
check("  and scalars beside it are kept", prov.read_frontmatter(f).get("title"), "A paper")
check("no front matter is not an error", prov.read_frontmatter(write("[a]: Claim.\n")), {})
check("a missing file is not an error", prov.read_frontmatter("/tmp/does-not-exist.argdown"), {})
check("single quotes work too",
      prov.read_frontmatter(write("===\ndefaults:\n  chapter: 'y.md'\n===\n")).get("defaults"),
      {"chapter": "y.md"})
check("comments are skipped",
      prov.read_frontmatter(write('===\ndefaults:\n  # which file\n  chapter: "z.md"\n===\n')).get("defaults"),
      {"chapter": "z.md"})

# INLINE COMMENTS. The scaffolded `reconstruction:` block carries one on every line, and a
# value read as "fit   # fit | appropriation" fails its own vocabulary check. A quoted value is
# taken between the quotes, so a comment after the closing quote goes too -- `.strip('"')` used
# to leave `x.md"  # the source`, which points at no file.
check("an inline comment is not part of the value",
      prov.read_frontmatter(write('===\ndefaults:\n  chapter: "x.md"  # the source\n===\n'))["defaults"],
      {"chapter": "x.md"})
check("  and on an unquoted value too",
      prov.read_frontmatter(write("===\nreconstruction:\n  aim: fit   # fit | appropriation\n===\n"))["reconstruction"],
      {"aim": "fit"})
check("a comment header does not hide the block",
      sorted(prov.read_frontmatter(write('// what this map is\n// and its form\n\n===\ntitle: T\n===\n'))),
      ["title"])

print("project files")
# The single-file case must need NO configuration. Requiring a file to state the reading order
# of one file was a hard error in the viewer builder, and reconstructing one paper is the
# common case.
check("no project file, no cited chapters", prov.read_project("/tmp/nonexistent-dir")["order"], [])
check("no project file falls back to what the map cites",
      prov.read_project("/tmp/nonexistent-dir", ["paper.md"])["order"], ["paper.md"])
check("  and says which rule it used",
      prov.read_project("/tmp/nonexistent-dir", ["paper.md"])["rule"], "cited")
check("citation order is de-duplicated, first-mention wins",
      prov.read_project("/tmp/x", ["b.md", "a.md", "b.md"])["order"], ["b.md", "a.md"])
check("native file: unquoted paths are read",
      prov.parse_project("chapters:\n  - intro.md\n  - a.md\n")["order"], ["intro.md", "a.md"])
check("native file: parts group but do not become chapters",
      prov.parse_project("chapters:\n  - part: One\n    chapters:\n      - a.md\n")["parts"],
      [{"name": "One", "chapters": ["a.md"]}])
# A file listed at TOP LEVEL AFTER a part block is not in that part. Assigning every item to the
# most recent part put a book's Afterword inside Part III -- the reading order was right and only
# the grouping wrong, which shows up as a band drawn round the wrong thing, not as a failure.
_book = """chapters:
  - front.md
  - part: One
    chapters:
      - a.md
      - b.md
  - afterword.md
"""
check("a top-level file after a part block stays outside it",
      prov.parse_project(_book)["parts"], [{"name": "One", "chapters": ["a.md", "b.md"]}])
check("  and the reading order still has all three",
      prov.parse_project(_book)["order"], ["front.md", "a.md", "b.md", "afterword.md"])

check("a key with a value ends the list",
      prov.parse_project("chapters:\n  - a.md\nout: x\n  - never.md\n")["order"], ["a.md"])

print("apply_defaults")


def doc_with(*datas):
    return {"statements": {f"s{i}": {"data": {}, "members": [{"title": f"s{i}", "text": "T.",
                                                             "data": dict(d)}]}
                           for i, d in enumerate(datas)}}


D = {"defaults": {"chapter": "source/x.md", "reviewed": "2026-08-18"}}

d = doc_with({})
prov.apply_defaults(d, D)
check("a bare claim inherits the default",
      prov.merged_statements(d)["s0"]["data"].get("chapter"), "source/x.md")

# THE ONE THAT MATTERS. A map drawing on two sources must keep saying which is which; a default
# that overrode a claim would reattribute its quotations to the wrong file, and the quotation
# checker would then verify them against a text they did not come from.
d = doc_with({"chapter": "source/other.md"})
prov.apply_defaults(d, D)
check("a claim's own chapter is NEVER overridden",
      prov.merged_statements(d)["s0"]["data"]["chapter"], "source/other.md")

d = doc_with({"chapter": "source/other.md"})
prov.apply_defaults(d, D)
check("  and it still inherits the fields it did not set",
      prov.merged_statements(d)["s0"]["data"].get("chapter"), "source/other.md")

d = doc_with({}, {"chapter": "source/other.md"})
prov.apply_defaults(d, D)
m = prov.merged_statements(d)
check("claims are independent of each other",
      (m["s0"]["data"]["chapter"], m["s1"]["data"]["chapter"]),
      ("source/x.md", "source/other.md"))

d = doc_with({"section": "Two points"})
prov.apply_defaults(d, {})
check("no defaults leaves the document alone",
      prov.merged_statements(d)["s0"]["data"], {"section": "Two points"})

d = doc_with({})
prov.apply_defaults(d, {"defaults": {}})
check("an empty defaults block is a no-op",
      prov.merged_statements(d)["s0"]["data"].get("chapter"), None)

print("locate_elsewhere (a chapter that moved)")
# `chapter:` is a path, and a path is the one thing an edit can break outright: ordinary drafting
# leaves every claim where it was -- measured at 100% for typos, rewrites, insertions, deletions
# and reordering -- but moving a section into another file orphans every claim citing the old one
# at once. The tool could previously say only "absent"; now it says where the words went.
import tempfile as _tf, os as _os
_d = _tf.mkdtemp()
_os.makedirs(_os.path.join(_d, "source"), exist_ok=True)
for _n, _t in [("source/one.md", "# One\n\nNothing of interest here at all.\n"),
               ("source/two.md", "# Two\n\nHe argues that we should accept a fully aggregative view.\n"),
               ("source/.raw-extraction.txt", "we should accept a fully aggregative view")]:
    with open(_os.path.join(_d, _n), "w", encoding="utf-8") as _fh:
        _fh.write(_t)
_order = ["source/one.md", "source/two.md"]
_Q = "we should accept a fully aggregative view"

check("a quotation that moved to another file is located",
      (prov.locate_elsewhere(_Q, _d, "source/one.md", _order) or (None,))[0], "source/two.md")
check("  the file it already cites is never suggested back to it",
      prov.locate_elsewhere(_Q, _d, "source/two.md", _order), None)
# A near miss in another file is two passages that resemble each other -- unremarkable in a book
# about one subject -- not evidence of a move. A suggestion must be safe to act on unread.
check("  a NEAR match elsewhere is not reported as a move",
      prov.locate_elsewhere("we should accept a fully aggregated view", _d,
                            "source/one.md", _order), None)
check("  and an absent quotation stays absent",
      prov.locate_elsewhere("a sentence in no file at all", _d, "source/one.md", _order), None)

# ---------------------------------------------------------------------------------------- #
# A CLAIM THAT ELIDES A PARENTHESIS IS STILL THE AUTHOR'S WORDS.
#
# Taken from the Wilson sample, which is where the fault showed. The claim is the source's
# sentence with `, like Williams,` and a 90-character parenthetical dropped — a near quotation by
# any reading. `find_quote` used to step through the source by a QUARTER of the probe's length,
# so the best window it ever compared was misaligned by up to a fifth of the sentence; this one
# scored 74.9% against the 75% threshold and came back `absent`. The map then reported the claim
# as "marked quotation but not in the source", and `--fix` would have rewritten a correct marker.
#
# Two things were wrong with that, and the second is worse. It was WRONG — the words are plainly
# there. And it was UNSTABLE: because the score depended on alignment, adding a line to the file's
# front matter changed the verdict. A licence note at the top of a source file could rewrite a
# fidelity marker two hundred lines below it.
print("\nnear quotations, and alignment")
_SENT = ("If, like Williams, we are persuaded that we have ethical freedom (and that hence that "
         "the point of ethics is not convergence on a set of unchanging moral facts), we may "
         "come to think that it is fecundity of response, rather than homogeneity, that is the "
         "sign of a good case.")
_CLAIM = ("If we are persuaded that we have ethical freedom, we may come to think that it is "
          "fecundity of response, rather than homogeneity, that is the sign of a good case.")
_FILL = "Some quite unremarkable discussion of other matters entirely. " * 30
_body = "---\ntitle: \"A paper\"\n---\n\n" + _FILL + "\n\n" + _SENT + "\n\n" + _FILL

check("a claim that elides a parenthesis is found in the source",
      prov.find_quote(_CLAIM, _body)[0], "near")
# Lines added above it stand in for a licence note, or any other front-matter edit.
check("  and stays found however many lines precede it",
      sorted({prov.find_quote(_CLAIM, ("a note about the licence\n" * n) + _body)[0]
              for n in range(0, 14)}), ["near"])
# A sentence that is genuinely not there must still come back absent: the point is accuracy, not
# leniency, and a search that finds everything is worth nothing.
check("  while a claim that is NOT in the source is still absent",
      prov.find_quote("The author holds that moral facts are fixed by convention alone and "
                      "that no amount of reflection could revise them.", _body)[0], "absent")

# ------------------------------------------- a sketched argument is still a node ---- #
# `title_edges` resolves an ARGUMENT endpoint to that argument's main conclusion, because the
# report is about claims and where they sit in the text. A SKETCHED argument -- `<Title>: prose`
# with no numbered structure -- has no main conclusion, so the lookup returned None and the edge
# was dropped. Silently, and at BOTH ends: its attack on the contention did not count, and the
# reasons hanging off it were reported as reaching no contention at all, which is how a properly
# wired objection came back `inert`.
#
# Measured on the published corpus before the fix: 6 of 47 arguments sketched, 13 relations
# invisible -- all of them in the newest and largest map, and the cheatsheet encourages the
# sketched form, so it was getting worse.

import json as _json                                                         # noqa: E402
import subprocess as _sub                                                    # noqa: E402
import tempfile as _tmp                                                      # noqa: E402
import os as _os                                                             # noqa: E402

SKETCH = """[Contention]: The main thesis holds.
    - <Sketched>
    - <Reconstructed>

<Sketched>: An objection stated in prose, with no numbered structure.
    + [Reason A]: A reason for the sketched objection.

<Reconstructed>

(1) [Reason B]: A reason for the reconstructed objection.
-----
(2) [Reconstructed conclusion]: So the objection stands.
"""

_cli = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)),
                     "..", "..", "app", "node_modules", ".bin", "argdown")
if _os.path.exists(_cli):
    with _tmp.TemporaryDirectory() as _td:
        _f = _os.path.join(_td, "s.argdown")
        open(_f, "w", encoding="utf-8").write(SKETCH)
        _sub.run([_cli, "json", _f, "--outputDir", _td], capture_output=True)
        _js = [x for x in _os.listdir(_td) if x.endswith(".json")]
        _doc = _json.load(open(_os.path.join(_td, _js[0]))) if _js else None

    if _doc:
        _edges = {(a, b, k) for a, b, k in prov.title_edges(_doc)}
        check("a sketched argument's attack on the contention survives",
              ("Sketched", "Contention", "attack") in _edges, True)
        check("  and the reason hanging off it does too",
              ("Reason A", "Sketched", "support") in _edges, True)
        # The reconstructed one always worked; it is here so a fix that broke it would show.
        check("a reconstructed argument still resolves to its main conclusion",
              ("Reconstructed conclusion", "Contention", "attack") in _edges, True)
        check("  and its premise reaches that conclusion",
              ("Reason B", "Reconstructed conclusion", "support") in _edges, True)
        check("nothing reaches the reconstructed argument by its own title",
              any(b == "Reconstructed" for _a, b, _k in _edges), False)
else:
    print("  SKIP  the Argdown CLI is not installed; sketched-argument edges not checked")

print(f"\n{fails} FAILED" if fails else "\nall passed")
sys.exit(1 if fails else 0)
