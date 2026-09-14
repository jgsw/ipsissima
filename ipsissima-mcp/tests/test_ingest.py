#!/usr/bin/env python3
"""Tests for what ingest refuses to write at creation time.

    python3 ipsissima-mcp/tests/test_ingest.py

Three cuts, all measured on real files before they were written (see ingest.py's docstring):
a saved transcript page that was 97.6% base64 images, and a Project Gutenberg pamphlet whose
file was half licence. The fixtures are synthetic on purpose; the numbers echo the real ones.
The property that matters throughout: every cut is COUNTED AND SAID, and the author's own
words never go.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
from ingest import (strip_data_uris, strip_gutenberg, ingest_one,            # noqa: E402
                    pandoc)

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}"
          + ("" if ok else f"\n          got {got!r} want {want!r}"))


# ---- embedded base64 assets ---------------------------------------------------------- #
print("embedded base64 assets")
BLOB = "iVBORw0KGgo" * 40                                    # 440 chars, over the floor
PAGE = "\n".join([
    "The argument begins with a distinction.",
    f"![A chart of the results](data:image/png;base64,{BLOB})",
    "It ends by denying the distinction was ever needed.",
    "A deliberate inline glyph survives: ![dot](data:image/gif;base64,R0lGODlhAQ==)",
])
out, n, kb = strip_data_uris(PAGE)
check("the asset is found and counted", n, 1)
check("  and reported in kilobytes, which word counts cannot see", kb, len(BLOB) // 1024)
check("  the alt text -- page text -- survives",
      "![A chart of the results](data:,removed-at-ingest)" in out, True)
check("  the author's words around it are untouched",
      out.splitlines()[0] + " " + out.splitlines()[2],
      "The argument begins with a distinction. "
      "It ends by denying the distinction was ever needed.")
check("a short data URI is left alone -- it may be deliberate",
      "R0lGODlhAQ==" in out, True)
check("a page with no assets reports zero", strip_data_uris("plain prose")[1:], (0, 0))

# ---- the Project Gutenberg apparatus ------------------------------------------------- #
print("the Project Gutenberg apparatus")
PG = "\n".join([
    "![](cover.jpg)",
    "::::: {#wrapper}",
    "## The Project Gutenberg eBook of A Modest Fixture",
    "**Release date**: October 1, 1997",
    r"\*\*\* START OF THE PROJECT GUTENBERG EBOOK A MODEST FIXTURE \*\*\*",
    ":::",
    "",
    "It is a melancholy object to walk the streets of this town.",
    "",
    "I shall now humbly propose my own thoughts.",
    "",
    "::: pg-footer",
    r"\*\*\* END OF THE PROJECT GUTENBERG EBOOK A MODEST FIXTURE \*\*\*",
    "Section 1. General Terms of Use",
    "The Foundation's EIN or federal tax identification number is 64-6221541.",
    ":::::",
])
body, note = strip_gutenberg(PG)
check("header and licence go together",
      ("Release date" in body, "tax identification" in body, "cover.jpg" in body),
      (False, False, False))
check("  the text itself is exactly what remains", body.splitlines()[0],
      "It is a melancholy object to walk the streets of this town.")
check("  and its last words too", body.splitlines()[-1],
      "I shall now humbly propose my own thoughts.")
check("  orphaned div fences at the edges go with the apparatus",
      [l for l in body.splitlines() if l.strip().startswith(":")], [])
check("  the cut is counted and said",
      note is not None and "cut at ingest" in note and "words" in note, True)
check("  and the note names the terms that make halving wrong",
      "never their branding without their licence" in note, True)
b2, n2 = strip_gutenberg("A file with no Gutenberg in it at all.\n")
check("a non-Gutenberg file is untouched", (b2, n2),
      ("A file with no Gutenberg in it at all.\n", None))
b3, n3 = strip_gutenberg("prose\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nlicence\n")
check("an END alone still cuts the licence",
      ("licence" in b3, "licence" in (n3 or "")), (False, True))
b4, n4 = strip_gutenberg(
    "*** END OF THE PROJECT GUTENBERG EBOOK X ***\n"
    "text\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\n")
check("markers out of order cut nothing and say so",
      ("text" in b4, "out of order" in (n4 or "")), (True, True))

# ---- the .html route ----------------------------------------------------------------- #
# The article by text density, the chrome never written. Needs pandoc (html_to_source
# renders the found element through it); the suite's environment has it.
print("the .html route")
if not pandoc():
    print("  skip  pandoc not found; the density route cannot render its result")
else:
    PROSE = ("The argument of this essay is that memory functions as a promise made to "
             "the future self, and that the causal picture of recollection cannot make "
             "sense of the reproach we level at the forgetful. ")
    html = f"""<html><head><title>Memory as Promise</title></head><body>
    <nav><a href="/">Home</a><a href="/about">About this publisher</a></nav>
    <div class="related"><a href="/x">Related: ten stories about memory</a></div>
    <article><h1>Memory as Promise</h1>
    {"".join(f"<p>{PROSE}</p>" for _ in range(12))}
    <p><img alt="figure one" src="data:image/png;base64,{BLOB}"></p>
    </article>
    <footer><p>Copyright the publisher. Cookie settings. Newsletter.</p></footer>
    </body></html>"""
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "saved-page.html")
        Path(p).write_text(html, encoding="utf-8")
        md, notes = ingest_one(p)
        check("the article is what gets written",
              "promise made to the future self" in md, True)
        check("  the nav and footer were never written",
              ("About this publisher" in md, "Cookie settings" in md), (False, False))
        check("  the note says how the article was found",
              any("text density" in n for n in notes), True)
        check("  and the embedded figure's bytes are gone, one way or the other",
              BLOB in md, False)

        # The general blanking rule, proven on the route that copies verbatim: a .md file
        # is passed through untouched EXCEPT for the creation-time cuts.
        thru = os.path.join(td, "notes.md")
        Path(thru).write_text(PAGE, encoding="utf-8")
        md3, notes3 = ingest_one(thru)
        check("a passthrough .md still gets its assets blanked, counted and said",
              (BLOB in md3, any("blanked at ingest" in n for n in notes3)), (False, True))

        small = os.path.join(td, "landing.html")
        Path(small).write_text("<html><body><p>Buy access to this article.</p></body></html>",
                               encoding="utf-8")
        md2, notes2 = ingest_one(small)
        check("a page with no article falls back to pandoc, loudly",
              ("Buy access" in md2,
               any("whole saved page was converted" in n for n in notes2)), (True, True))

print()
if fails:
    print(f"{fails} FAILED")
    sys.exit(1)
print("all ingest-cut checks passed")
