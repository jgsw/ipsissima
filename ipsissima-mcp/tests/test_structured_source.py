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
import sys
import tempfile
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

print()
if fails:
    print(f"{fails} FAILED\n")
    sys.exit(1)
print("all passed\n")
