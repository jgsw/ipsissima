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
                    lift_footnote_definitions, front_matter, pandoc,
                    strip_publisher_apparatus)

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

# ---- the journal's voice, blanked --------------------------------------------------- #
# The author's ruling (15 Sep): the manuscript pane must make reading the whole article
# pleasurable, so the journal's apparatus never reads as the text. Blanked, never deleted:
# a claim's place is a line number.
print("publisher apparatus")
APP = "\n".join([
    "The author's own first sentence stands.",
    "doi:10.1017/S0031819126101314 © The Author(s), 2026. Published by Cambridge University "
    "Press on behalf of The Royal Institute of Philosophy. This is an Open Access article, "
    "distributed under the terms of the Creative Commons Attribution licence. "
    "Philosophy 101 2026 511",
    "https://doi.org/10.1017/S0031819125000014 Published online by Cambridge University Press",
    "doi:10.1017/S0031819125000014",
    "A sentence discussing the Creative Commons movement in the author's own voice.",
])
out, n = strip_publisher_apparatus(APP)
check("the copyright block, the footer, and the bare DOI are blanked", n, 3)
check("  and no line is lost", len(out.splitlines()), len(APP.splitlines()))
check("  the author's prose stands, licensing talk included",
      (out.splitlines()[0], out.splitlines()[4]),
      ("The author's own first sentence stands.",
       "A sentence discussing the Creative Commons movement in the author's own voice."))
check("  nothing of the journal's voice survives",
      [l for l in out.splitlines() if "Author(s)" in l or "Published online" in l], [])

# ---- footnote definitions lifted from page-bottom blocks ----------------------------- #
# The span rule marks the REFERENCES; the note's own text arrives as a paragraph opening
# with its bare number (measured on the Wolff, reported by the author 15 Sep). A number
# defines a footnote only if it has already appeared as a reference, is not yet defined,
# and opens a later block -- so years, dotted headings and stray numerals ride through.
print("footnote definitions")
FN = "\n".join([
    "The honour and privilege of the position.[^1] More prose follows here.",
    "",
    "In 2026 the Institute expanded. 2 kg of programmes were printed.",
    "",
    "1 For comments and questions I am grateful to many colleagues.",
    "",
    "1. Introduction",
])
out, n = lift_footnote_definitions(FN)
check("the referenced note's block becomes a definition",
      "[^1]: For comments and questions I am grateful to many colleagues." in out, True)
check("  and exactly one was lifted", n, 1)
check("  a year and a measurement are untouched",
      ("In 2026 the Institute expanded. 2 kg" in out), True)
check("  a dotted numbered heading is not a footnote", "1. Introduction" in out, True)
out2, n2 = lift_footnote_definitions("A bare\n\n1 numbered paragraph with no reference.\n")
check("a number never referenced defines nothing", n2, 0)
out3, n3 = lift_footnote_definitions(
    "Text.[^1]\n\n[^1]: A real definition pandoc wrote.\n\n1 A later numbered line.\n")
check("an existing definition is not doubled", n3, 0)
out4, n4 = lift_footnote_definitions(
    "Text.[^2]\n\n[^2] The note whose own number was superscript too.\n")
check("the bracketed spelling of a note's own number is lifted",
      "[^2]: The note whose own number was superscript too." in out4 and n4 == 1, True)

# ---- the zotero key, read off the storage path --------------------------------------- #
print("the zotero key at the door")
check("a Zotero storage path yields front matter with its key",
      front_matter("/Users/x/Zotero/storage/AB12CD34/paper.pdf", "plain text"),
      '---\nzotero: "AB12CD34"\n---\n\n')
check("  an ordinary path yields nothing",
      front_matter("/Users/x/Papers/paper.pdf", "plain text"), "")
check("  a file that already opens with front matter is left exactly as it is",
      front_matter("/Users/x/Zotero/storage/AB12CD34/notes.md", "---\ntitle: t\n---\nx"),
      "")

# ---- the abstract, carried out of the converter and into the front matter ----------- #
# The converter found it and wrote it; ingest stripped the converter's front matter and
# wrote its own with only the key, so the abstract reached nobody (the Wilson, 15 Sep 2026).
print("the abstract in the front matter")
from ingest import front_matter_keys, front_matter_note                     # noqa: E402
import ingest as _ingest                                                     # noqa: E402
ABS = ("For Bernard Williams, ethical inquiry is fundamentally about sense-making: it starts "
       "from what we already care about, and is always local. What is required is less a shift "
       "from scientistic to humanistic conceptions of philosophy, than for philosophers "
       "working in value inquiry to better align their aspirations for theory with what it can "
       "actually deliver.")
fm = front_matter("/Users/x/Zotero/storage/AB12CD34/paper.pdf", "plain text",
                  {"abstract": ABS})
check("an abstract in extras is written as a folded block after the key",
      fm.startswith('---\nzotero: "AB12CD34"\nabstract: >-\n  For Bernard'), True)
check("  wrapped, indented, and closed", fm.endswith("actually deliver.\n---\n\n"), True)
check("  and it reads back as one paragraph",
      " ".join(l.strip() for l in fm.split("abstract: >-\n")[1].split("\n---")[0].splitlines()),
      ABS)
check("  a paper outside Zotero still gets its abstract",
      front_matter("/Users/x/Papers/paper.pdf", "plain text", {"abstract": ABS})
      .startswith("---\nabstract: >-\n"), True)
check("  and the note says both were written",
      front_matter_note(front_matter_keys("/Users/x/Zotero/storage/AB12CD34/paper.pdf",
                                          "plain text", {"abstract": ABS})),
      "front matter written with the zotero: attachment key, read off the storage path -- "
      "the item the reader's highlights hang on, and the one zotero_store follows; and the "
      "paper's abstract, which the app shows on the orientation panel and a claim may quote")

# The hand-over itself: what the converter reports as `abstract` lands in `extras`.
_orig_convert = None
try:
    import pdf_to_source as _p2s                                               # noqa: E402
    _orig_convert = _p2s.convert
    def _fake_convert(cfg):
        cfg.out.write_text("---\ntitle: \"t\"\nabstract: >-\n  gone\n---\n\n<!-- hdr -->\n\n"
                           "# 1 Body\n\nText.\n", encoding="utf-8")
        return dict(headings_placed=["1 Body"], quotes=0, notes=0, furniture={},
                    back_matter_kept=False, back_headings=[], heading_gaps=[], suspicious=[],
                    boundaries_detected=dict(front=3, back=None), abstract=ABS)
    _p2s.convert = _fake_convert
    ex = {}
    body, notes = _ingest.from_pdf_structured("x.pdf", ex)
    check("the converter's abstract is handed over in extras", ex.get("abstract"), ABS)
    check("  the converter's own front matter is still stripped from the body",
          body.startswith("# 1 Body"), True)
    check("  and the note says the abstract was kept, and where",
          any(n.startswith("abstract kept (") and "front matter" in n for n in notes), True)
finally:
    if _orig_convert is not None:
        _p2s.convert = _orig_convert

# ---- the unified PDF route: structured first, plain as the loud fallback ------------- #
# The route itself ran against a real PDF when it was built; what these hold is the CHOICE:
# the word-count floor that decides when the structured converter's answer is trusted, and
# that every refusal is said. Stubbed, because the choice is the unit under test.
print("the PDF route's choice")
import ingest as _ingest                                                     # noqa: E402
_orig = (_ingest.plain_text, _ingest.from_pdf_structured)
PLAIN = " ".join(["word"] * 300)
try:
    _ingest.plain_text = lambda p: PLAIN
    _ingest.from_pdf_structured = lambda p, extras=None: (" ".join(["word"] * 280), ["structured note"])
    md, notes = _ingest.from_pdf("x.pdf")
    check("a structured result near the layer's word count is used",
          (len(md.split()), any("structured note" in n for n in notes)), (280, True))
    check("  and the difference is accounted for aloud",
          any("difference measured furniture" in n for n in notes), True)
    _ingest.from_pdf_structured = lambda p, extras=None: (" ".join(["word"] * 100), ["structured note"])
    md, notes = _ingest.from_pdf("x.pdf")
    check("one that lost too many words is refused, and the plain route used",
          (md == PLAIN, any("more than furniture explains" in n for n in notes)),
          (True, True))
    _ingest.from_pdf_structured = lambda p, extras=None: (None, "the page uses more than two indent levels")
    md, notes = _ingest.from_pdf("x.pdf")
    check("a converter refusal is quoted, not swallowed",
          (md == PLAIN, any("structured route declined" in n for n in notes)), (True, True))
finally:
    _ingest.plain_text, _ingest.from_pdf_structured = _orig

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
