#!/usr/bin/env python3
"""Convert Wilson, "Williams, Dewey, and the Nature of Value Inquiry" (Philosophy, 2026).

WHY NOT `pdf_to_source.py`. It refuses this paper, and the refusal is correct. The article is set
with DIFFERENT MARGINS on recto and verso -- x0=42.8 on one side of the spread, 65.8 on the other
-- each with its own paragraph indent, so the band detector sees four left edges where there are
two, and no counting rule separates them. Naming bands globally would misfile every paragraph on
one side of the book.

WHY NOT `ingest.py`'s default either, unmodified. Its blocks reflow handles the two margins
without caring about them, and gives good granularity -- but it leaves the running heads and the
DOI footer inline, and finds no headings.

**AND THE HEADINGS CANNOT BE FOUND BY TYPOGRAPHY AT ALL.** They are set in the same 11pt as the
body text. The only thing marking them is that the author numbers them, which is what this file
keys on. The words are the author's; only the `#` is added.

So this converter is the shared blocks reflow plus two paper-specific repairs, which is what a
per-paper `convert_source.py` is for.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] /
                       "mcp" / "src" / "ipsissima_mcp"))
from ingest import plain_text                                    # noqa: E402
from pdf_to_source import dehyphenate                            # noqa: E402

HERE = Path(__file__).resolve().parent
PDF = Path("/Users/jameswilson/Zotero/storage/V6S9E36C/"
           "Wilson - 2026 - Williams, Dewey, and the Nature of Value Inquiry.pdf")
OUT = HERE / "source" / "wilson-2026-williams-dewey-nature-of-value-inquiry.md"

# Repeated on every page, and not the article.
FURNITURE = (re.compile(r"^James Wilson$"),
             re.compile(r"^Williams, Dewey, and the Nature of Value Inquiry$"),
             re.compile(r"^Williams, Dewey, and the Nature of$"),
             re.compile(r"^Value Inquiry$"),
             re.compile(r"^https://doi\.org/"),
             re.compile(r"^Downloaded from"),
             re.compile(r"^\d{1,3}$"))
HEADING = re.compile(r"^(\d)\.\s+([A-Z][^.]{6,70})$")
BACK_MATTER = re.compile(r"^References$")

HEADER = """---
title: "Williams, Dewey, and the Nature of Value Inquiry"
author: "James Wilson"
source: "Philosophy (2026)"
---

<!-- CONVERTED TEXT - NOT THE PUBLISHED ARTICLE.
     Made by this folder's convert_source.py from the author's own PDF.
     (a) Typographic normalisation only: words broken across printed lines are
         rejoined. No wording is altered and nothing is inserted.
     (b) Paragraphs are reflowed from the PDF's own blocks, because the article sets recto
         and verso at different margins and the shared left-edge band detector cannot
         resolve that. Page markers are kept.
     (c) The eight `#` headings are the AUTHOR'S OWN, numbered by him and set in the same
         11pt as the body text -- typography does not distinguish them, the numbering does.
         Only the `#` is added.
     (d) Dropped: running heads, page numbers, the DOI footer, and everything from the
         References onwards. -->

"""


def main():
    text = plain_text(str(PDF))
    # REJOIN WORDS BROKEN ACROSS PRINTED LINES. The blocks reflow preserves the typesetter's
    # line breaks as spaces, so `human- ities`, `ambi- tion` and `confi- dence` survive into the
    # source -- where they defeat quotation matching and read badly. `dehyphenate` is the shared
    # rule, and knows the trap: this PDF uses no soft hyphens, so the blunt "join on a hyphen at
    # a line end" rule applies, which would corrupt real compounds in a document that does.
    soft = "\u00ad" in text
    text = dehyphenate(text, soft)
    out, dropped, heads, cut = [], 0, 0, False
    for block in text.split("\n\n"):
        b = " ".join(block.split())
        if not b:
            continue
        if b.startswith("<!-- p."):
            out.append(b)
            continue
        if BACK_MATTER.match(b):
            cut = True
        if cut:
            dropped += 1
            continue
        if any(f.match(b) for f in FURNITURE):
            dropped += 1
            continue
        mo = HEADING.match(b)
        if mo:
            out.append(f"# {b}")
            heads += 1
            continue
        out.append(b)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(HEADER + "\n\n".join(out).strip() + "\n", encoding="utf-8")
    body = [l for l in "\n\n".join(out).splitlines() if len(l) >= 120]
    print(f"wrote {OUT}")
    print(f"  {len(' '.join(out).split())} words, {heads} of the author's headings promoted")
    print(f"  {dropped} furniture/back-matter blocks dropped")
    print(f"  {len(body)} lines long enough to locate a claim")


if __name__ == "__main__":
    main()
