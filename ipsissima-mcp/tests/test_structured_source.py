#!/usr/bin/env python3
"""The routes that take a publisher's own structure rather than recovering it from ink.

    python3 ipsissima-mcp/tests/test_structured_source.py

WHY THESE TWO CHECKS AND NOT OTHERS. Both were real, both were silent, and both produced a
perfectly well-formed Markdown file of the wrong document — which is the only failure mode this
toolchain treats as unacceptable, because there is nothing for a reader to notice.

  * A class the heading list did not recognise was promoted to a level-two heading anyway
    (`_heading_level(...) or 2`). On an EPUB that is nearly harmless: pandoc emits few classed
    paragraphs. On a publisher's saved HTML page EVERY paragraph carries a class, and an
    *Analysis* article came out as fourteen headings, nine of which were entire paragraphs.
  * The HTML route cut back matter from the FILE while the PDF route kept it. On the same paper
    that took 8,407 words down to 5,864, and what went was the footnotes — which in philosophy
    carry argument, are referred to from the body, and are exactly what a claim may need to cite.
"""
import re
import shutil
import sys
import tempfile
from xml.etree import ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src" / "ipsissima_mcp"))

import html_to_source                                                    # noqa: E402
from epub_to_source import _tidy                                         # noqa: E402

fails = 0


def check(name, got, want):
    ok = got == want
    global fails
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}")
    if not ok:
        print(f"        got  {got!r}\n        want {want!r}")


print("== the publisher's own structure")

print("\na class only makes a heading when it names one")
# pandoc's markdown for `<p class="X">text</p>` is `text {.X}`.
check("an ordinary body class is left as prose",
      _tidy("The Tortoise said he would not accept it. {.chapter-para}"),
      "The Tortoise said he would not accept it.")
check("  and so is any other class the list does not know",
      _tidy("A paragraph of argument. {.para .first-child}"),
      "A paragraph of argument.")
check("a section-title class IS a heading",
      _tidy("1. Why replace the Socratic Question? {.section-title}"),
      "## 1. Why replace the Socratic Question?")
check("  and a levelled one gives its own level",
      _tidy("A sub-heading {.h3}"), "### A sub-heading")
check("  chapter titles too, which is what the rule was written for",
      _tidy("**Chapter One** {.chapter-title}"), "## Chapter One")
# The attribute block is stripped a few lines later whatever happens; what matters is that no
# `#` was added.
check("a decorative line carrying a heading class is not a heading",
      _tidy("*** {.section-title}"), "***")
check("  nor is a bare image",
      _tidy("![](fig1.png) {.chapter-title}"), "![](fig1.png)")

print("\nback matter stays in the file")
HTML = """<html><head><meta name="citation_title" content="A Paper"></head><body>
<div class="content"><div class="article-body">
  <h2 class="section-title">1. The argument</h2>
  <p class="chapter-para">%s</p>
  <h2 class="backfootnotegroup-title">Footnotes</h2>
  <p class="footnote">A footnote that carries an argument the body refers to.</p>
  <h2 class="backreferences-title">References</h2>
  <p class="ref">Someone 2020, A Book.</p>
</div></div></body></html>""" % ("body words " * 200)

with tempfile.TemporaryDirectory() as td:
    f = Path(td) / "page.html"
    f.write_text(HTML, encoding="utf-8")

    md, rep = html_to_source.convert(str(f))
    check("the default keeps the footnotes, as the PDF route does",
          "carries an argument" in md, True)
    check("  and the references", "Someone 2020" in md, True)
    check("  and says so rather than reporting a cut", rep["back_matter_elements_cut"], 0)
    check("the real heading survives", "## 1. The argument" in md, True)
    check("  and the body paragraph is NOT a heading",
          any(l.startswith("#") and "body words" in l for l in md.splitlines()), False)

    md, rep = html_to_source.convert(str(f), cut_back_matter_too=True)
    check("asked to cut, it cuts", "Someone 2020" in md, False)
    check("  and the body is still there", "body words" in md, True)
    check("  and reports how much went", rep["back_matter_elements_cut"] > 0, True)

    # A landing page is not an article, and must be refused rather than half-converted.
    thin = Path(td) / "thin.html"
    thin.write_text("<html><body><div><p>Abstract only.</p></div></body></html>", encoding="utf-8")
    md, rep = html_to_source.convert(str(thin))
    check("a paywall notice is refused, not half-converted", md, None)
    check("  and says why", "landing page" in rep.get("why", ""), True)

print("\nthe PDF's page numbers on the snapshot's text")
# THE COMBINATION THE ZOTERO STORY RESTS ON: structure from the publisher's HTML, pagination
# from the PDF, because each has exactly what the other lacks. Tested without a PDF by driving
# the placement directly — building a real PDF here would test pymupdf, not this.
import paginate                                                          # noqa: E402

PAGES = [
    (369, "suggested that rather than asking what knowledge is we should ask what the "
          "concept does for us".split()),
    (370, "different ways by thinkers such as hume nietzsche and fricker most recently".split()),
    (999, "these words appear nowhere in the article at all not one of them".split()),
]
BODY = "\n".join([
    "# A Paper",
    "",
    "Craig suggested that rather than asking what knowledge is we should ask what the concept "
    "does for us and why we have it.",
    "",
    "The idea has been taken up in different ways by thinkers such as Hume, Nietzsche and "
    "Fricker most recently.",
    "",
])
_real = paginate.page_openings
paginate.page_openings = lambda _pdf: (PAGES, dict(printed_numbers=3, offset=368, outliers=[],
                                                   sheets=4))
try:
    out, rep = paginate.paginate(BODY, "unused.pdf")
finally:
    paginate.page_openings = _real

check("a page whose opening is found gets a marker", 369 in rep["placed"], True)
check("  and so does the next", 370 in rep["placed"], True)
check("a page that cannot be found is REFUSED, not guessed", rep["placed"].count(999), 0)
check("  and named, so the gap can be checked", rep["missed"], [999])
check("the marker is the one the viewer already reads",
      any(l.strip() == "<!-- p.369 begins here -->" for l in out.splitlines()), True)
check("no line of the text is lost",
      [l for l in out.splitlines() if l.strip() and not l.startswith("<!-- p.")],
      [l for l in BODY.splitlines() if l.strip()])
check("markers are in page order down the file",
      [int(re.search(r"p\.(\d+)", l).group(1)) for l in out.splitlines() if l.startswith("<!-- p.")],
      sorted(int(re.search(r"p\.(\d+)", l).group(1))
             for l in out.splitlines() if l.startswith("<!-- p."))) 

# ---------------------------------------------- a book that arrives at the wrong level ---- #
# BOTH OF THESE WERE FOUND ON ONE FILE: Russell's `Problems of Philosophy` from Project
# Gutenberg, which is the obvious source for out-of-copyright philosophy and so is worth getting
# right once rather than per book.

from epub_to_source import FURNITURE                                         # noqa: E402
from split_manuscript import heading_re, split                               # noqa: E402

print("Project Gutenberg's wrapper is not the book")
# The licence is ~2,900 words of boilerplate carrying the same vocabulary as the book around it.
# It survived as a chapter, which is 2,900 words a reconstruction could quote as Russell's.
for label in ("THE FULL PROJECT GUTENBERG LICENSE", "THE FULL PROJECT GUTENBERG\u2122 LICENSE",
              "Project Gutenberg License", "*** START OF THE PROJECT GUTENBERG EBOOK ***"):
    check(f"  dropped: {label[:44]}", bool(FURNITURE.match(label)), True)
# Narrow on purpose: a chapter genuinely ABOUT Project Gutenberg keeps its place.
check("  a chapter about Project Gutenberg is kept",
      bool(FURNITURE.match("Project Gutenberg and the Public Domain")), False)
check("  and an ordinary chapter is kept",
      bool(FURNITURE.match("CHAPTER I. APPEARANCE AND REALITY")), False)

print("\nchapters are not always `#`")
# AN EPUB KEEPS ITS PUBLISHER'S HEADING LEVELS. Gutenberg sets the book title as h1 and every
# chapter as h2, so a fifteen-chapter book split into two files -- valid Markdown, all the words
# present, and thirteen exposition bands the reader should have had simply absent.
BOOK = """# THE PROBLEMS OF PHILOSOPHY

Front prose.

## CHAPTER I. APPEARANCE AND REALITY

Is there any knowledge so certain that no reasonable man could doubt it?

## CHAPTER II. THE EXISTENCE OF MATTER

In this chapter we have to ask ourselves whether there is any such thing as matter.

## CHAPTER III. THE NATURE OF MATTER

We have found that it is possible to doubt whether matter exists.
"""
with tempfile.TemporaryDirectory() as td:
    book = Path(td) / "book.md"
    book.write_text(BOOK, encoding="utf-8")
    at1 = split(str(book), 1)[1]
    at2 = split(str(book), 2)[1]
    # At level 2 the book's own `#` title and the prose under it fall before the first chapter
    # heading, and become a Front matter section -- prose before the first heading is still
    # prose, which is deliberate and is why the count is chapters + 1.
    chapters2 = [s["title"] for s in at2 if s["title"] != "Front matter"]
    check("  a Gutenberg book splits into one file at level 1", len(at1), 1)
    check("  and into its chapters at level 2", chapters2,
          ["CHAPTER I. APPEARANCE AND REALITY", "CHAPTER II. THE EXISTENCE OF MATTER",
           "CHAPTER III. THE NATURE OF MATTER"])
    check("  the title and its prose are kept as front matter, not dropped",
          [s["title"] for s in at2][0], "Front matter")
    check("  which is the count that says the level was wrong", len(at2) > len(at1) * 2, True)

check("a level-3 heading is not matched at level 2",
      bool(heading_re(2).match("### Deeper")), False)
check("  and a level-2 heading is", bool(heading_re(2).match("## Chapter")), True)

# ------------------------------------------------- the whole route, over the real book ---- #
# THE FIXTURES ABOVE PROVE THE RULES; ONLY THE REAL FILE PROVES THE ROUTE. REVIEW.md 4 said it
# plainly -- "the EPUB route has no sample" and "a book is the case split_manuscript exists for,
# and the corpus has no book" -- and the values audit carried it forward as the last confessed
# E2 gap (docs/values/TENSIONS.md, T8). The Russell fixture is that book: EPUB in, a folder of
# Markdown out, one file split into its fifteen chapters. Skipped with a notice when the
# fixture or pandoc is missing, so a bare checkout still runs everything above.
#
# SHOWN ABLE TO FAIL, 3 Sep 2026: pointing the licence assertion at a phrase the book does
# contain fails it, and splitting at level 1 instead of 2 fails the chapter count with 1.
print("\nthe EPUB route, end to end over the Russell fixture")
RUSSELL = HERE.parent.parent / "fixtures" / "ingest" / "russell-1912-problems-of-philosophy.epub"
if not RUSSELL.exists() or not shutil.which("pandoc"):
    print("  skip  fixture or pandoc not on this machine")
else:
    from epub_to_source import convert as epub_convert                       # noqa: E402
    with tempfile.TemporaryDirectory() as td:
        meta, docs, skipped = epub_convert(str(RUSSELL), out_dir=td)
        whole = "\n\n".join(d["markdown"] for d in docs)
        words = sum(d["words"] for d in docs)
        check("the book arrives, whole", words > 20000, True)
        check("  and Gutenberg's licence does not",
              "FULL PROJECT GUTENBERG" in whole.upper(), False)
        check("  because the furniture was skipped, visibly", len(skipped) > 0, True)
        check("the famous first sentence survives conversion",
              "so certain that no reasonable man could doubt it" in whole, True)
        book = Path(td) / "book.md"
        book.write_text(whole, encoding="utf-8")
        secs = split(str(book), 2)[1]
        chapters = [s["title"] for s in secs if s["title"].upper().startswith("CHAPTER")]
        check("split at level 2 finds all fifteen chapters", len(chapters), 15)
        check("  in order, Appearance and Reality first",
              chapters[0].upper().endswith("APPEARANCE AND REALITY"), True)
        check("  and the Value of Philosophy last",
              chapters[-1].upper().endswith("THE VALUE OF PHILOSOPHY"), True)

# ------------------------------------------------------------------------- TEI ---- #
# PANDOC WRITES TEI AND DOES NOT READ IT (`--list-input-formats` offers docbook, jats and
# endnotexml, and no tei), so a TEI book had no route in at all and the only way was its PDF --
# the exact inversion this file's own docstring complains about. Open Book Publishers ship TEI
# for every title under CC-BY, and they are one of the few places a whole philosophy book is
# openly licensed, so the gap was worth closing rather than working around.

from tei_to_source import convert_one                                        # noqa: E402
from ingest import is_tei                                                    # noqa: E402

TEI_NS = "http://www.tei-c.org/ns/1.0"
CHAPTER = f"""<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="{TEI_NS}"><text><body>
  <div><head>1. Introduction</head>
    <p>A claim that <hi rendition="simple:italic">does matter</hi> here.<note n="1">A note.</note></p>
    <div><head>1.1 A section</head>
      <p>See <ref target="https://example.org/x">the paper</ref> and <ref target="ch1.xml#a1">1.4</ref>.</p>
      <quote>A block quotation.</quote>
    </div>
  </div>
</body></text></TEI>"""

body = ET.fromstring(CHAPTER).find(f"{{{TEI_NS}}}text/{{{TEI_NS}}}body")
md, n_notes = convert_one(body)

check("the chapter title is a level-one heading", md.splitlines()[0], "# 1. Introduction")
check("  and a nested div is one level deeper", "## 1.1 A section" in md, True)
check("emphasis survives", "*does matter*" in md, True)
check("a real URL stays a link", "[the paper](https://example.org/x)" in md, True)
# An internal target points inside the publisher's own bundle and means nothing outside it.
check("  an internal anchor keeps its text and loses the link",
      "1.4" in md and "ch1.xml" not in md, True)
check("a quotation becomes a block quote", "> A block quotation." in md, True)
# A FOOTNOTE IS NOT INLINE PROSE: left in place it welds the note into the middle of the sentence
# carrying the marker, which is how a quotation comes to contain a citation and fail to verify.
check("the footnote is lifted out of the sentence", "[^1]" in md and "A note." in md, True)
check("  and defined at the foot", md.rstrip().endswith("[^1]: A note."), True)
check("  and counted", n_notes, 1)
check("the note's text is not left inline",
      "here.[^1]" in md.replace("\n", " "), True)

print("\nTEI is told from other XML by its namespace, not its extension")
with tempfile.TemporaryDirectory() as td:
    x = Path(td) / "c.xml"
    x.write_text(CHAPTER, encoding="utf-8")
    check("  a TEI file is recognised", is_tei(str(x)), True)
    j = Path(td) / "j.xml"
    j.write_text('<?xml version="1.0"?><article xmlns="http://jats.nlm.nih.gov"/>', encoding="utf-8")
    check("  and JATS is not taken for it", is_tei(str(j)), False)
    # `.zip` is also how a .docx, an .odt and an .epub arrive, and those belong to pandoc.
    z = Path(td) / "d.docx"
    import zipfile as _z
    with _z.ZipFile(z, "w") as zf:
        zf.writestr("word/document.xml", "<w:document/>")
    check("  a .docx is not taken for a TEI bundle", is_tei(str(z)), False)

print()
if fails:
    print(f"{fails} FAILED\n")
    sys.exit(1)
print("all passed\n")
