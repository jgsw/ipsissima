#!/usr/bin/env python3
"""Put a PDF's page numbers onto text that came from somewhere better.

    python3 paginate.py article.md article.pdf            # report only
    python3 paginate.py article.md article.pdf --write

THE PROBLEM THIS SOLVES. An article in a Zotero library usually exists twice: the publisher's
HTML snapshot, and the PDF. Each has exactly what the other lacks.

  * THE SNAPSHOT HAS THE STRUCTURE. Headings are headings because the document says so, footnotes
    are marked, paragraphs are paragraphs. Nothing is inferred from where ink sat.
  * THE PDF HAS THE PAGE NUMBERS, which are what a reader will cite and what a scholarly
    quotation is pinned to. A web page has no pages.

Taking one and losing the other has been the choice up to now, and it is a bad choice in both
directions: reconstruct from the snapshot and no claim can name a page; reconstruct from the PDF
and the section a claim sits in has to be guessed from type sizes.

HOW. Read each sheet of the PDF, take the opening words of it, and find where those words fall in
the structured text. Insert `<!-- p.N begins here -->` before that line — the same marker the PDF
route already emits and the viewer already reads, so nothing downstream needs to know which route
produced the file.

THE NUMBER IS READ, NOT COUNTED. The Horton paper's config declared it started at 511; the sheets
themselves say 514. Counting labelled every page three short, so a quotation the app offered as
p. 517 was really on p. 520. `pdf_to_source.printed_numbers` already reads them off the page and
takes a majority vote on the offset; this uses it.

MARKERS ARE INSERTED, NEVER SUBSTITUTED, and only ever on their own line before an existing one.
Nothing in the text moves sideways, and a claim's position is still found by matching its words.

WHAT IT REFUSES TO GUESS. A page whose opening words cannot be found in the text gets NO marker,
and is reported. That happens legitimately — a sheet that opens mid-word, a page that is all
figure, a snapshot missing a section the PDF has — and a marker placed by hope is worse than one
missing: it would pin a quotation to a page it is not on.
"""
from __future__ import annotations

import argparse
import difflib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

MARKER = re.compile(r"^\s*<!--\s*(?:.*?\s)?p\.\s*\d+\s+begins here\s*-->\s*$")
#: How many words of a page's opening to match on. Long enough to be unique in an article,
#: short enough to survive a hyphen broken across the page boundary at either end.
PROBE_WORDS = 9


def _norm(s):
    """Lowercase letters and single spaces. Everything a converter might differ on, gone."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()


def page_openings(pdf_path):
    """[(printed_number, opening words)] for each sheet after the first.

    THE FIRST SHEET IS SKIPPED deliberately: its text begins at the top of the document, so a
    marker for it would sit above the title and say nothing. Every other sheet's opening is a
    real boundary inside the prose.
    """
    import pymupdf
    from pdf_to_source import page_offset, printed_numbers

    sheets = []
    with pymupdf.open(str(pdf_path)) as doc:
        for page in doc:
            lines = []
            for b in page.get_text("dict").get("blocks", []):
                for l in b.get("lines", []):
                    txt = " ".join(s.get("text", "") for s in l.get("spans", [])).strip()
                    if txt:
                        lines.append({"text": txt, "y0": l["bbox"][1], "x0": l["bbox"][0]})
            # SORTED DOWN THE PAGE. `get_text("dict")` returns BLOCKS in the order the PDF happens
            # to store them, which is not reading order -- so "the opening words of this sheet"
            # taken from that order can come from halfway down it, and every marker lands in the
            # wrong paragraph. Nothing announced this: the markers were all present and all wrong.
            lines.sort(key=lambda l: (round(l["y0"] / 4), l["x0"]))
            sheets.append((lines, page.rect.height, page.rect.width))

    found = printed_numbers(sheets)
    offset, outliers = page_offset(found, len(sheets))
    out = []
    for i, (lines, height, _w) in enumerate(sheets):
        if i == 0:
            continue
        number = found.get(i) if offset is None else i + offset
        if number is None:
            continue
        # DROP THE RUNNING HEAD. It is the same on every sheet and appears nowhere in a
        # structured version of the article, so probing from it matches nothing -- or, worse,
        # matches the same wrong place every time.
        body = [l for l in lines if l["y0"] > height * 0.06]
        out.append((number, _norm(" ".join(l["text"] for l in body)).split()))
    return out, dict(printed_numbers=len(found), offset=offset, outliers=outliers,
                     sheets=len(sheets))


def _find(hay_words, probe, start_at=0):
    """Where `probe` begins in `hay_words`, at or after `start_at`. -1 if it is not there.

    NEAR MATCHING, because the two conversions differ in small ways everywhere: a hyphen the PDF
    broke across a line, a ligature, a footnote marker the snapshot renders as a link. An exact
    search finds perhaps half the pages of a real article; this finds nearly all of them and
    still refuses anything it is not sure of.
    """
    n = len(probe)
    if n < 4:
        return -1
    best, best_at = 0.0, -1
    joined = probe[:n]
    for i in range(start_at, len(hay_words) - n + 1):
        window = hay_words[i:i + n]
        if window[0] != joined[0] and window[1:2] != joined[1:2]:
            continue                                # cheap gate before the expensive compare
        r = difflib.SequenceMatcher(None, window, joined).ratio()
        if r > best:
            best, best_at = r, i
            if r == 1.0:
                break
    return best_at if best >= 0.75 else -1


def paginate(markdown, pdf_path):
    """Return (markdown with page markers, report)."""
    openings, meta = page_openings(pdf_path)

    lines = markdown.split("\n")
    # A map from word index -> line index, over the text as the reader sees it. Existing markers
    # and fenced comments contribute no words, so a file that already has some is not confused.
    words, word_line = [], []
    in_comment = False
    for li, line in enumerate(lines):
        if MARKER.match(line):
            continue
        stripped = line
        if "<!--" in stripped:
            in_comment = True
        if in_comment:
            if "-->" in stripped:
                in_comment = False
            continue
        for w in _norm(stripped).split():
            words.append(w)
            word_line.append(li)

    placed, missed, cursor = [], [], 0
    inserts = {}
    for number, probe_words in openings:
        # SKIP THE RUNNING HEAD by trying a few starting points into the page's own text: the
        # first line of a sheet is often the journal name and the page number, which appear
        # nowhere in the structured version.
        at = -1
        for skip in (0, 1, 2, 3, 5, 8):
            probe = probe_words[skip:skip + PROBE_WORDS]
            if len(probe) < 4:
                break
            at = _find(words, probe, cursor)
            if at >= 0:
                break
        if at < 0:
            missed.append(number)
            continue
        cursor = at                                  # pages are in order; never search backwards
        li = word_line[at]
        # A PAGE BOUNDARY USUALLY FALLS INSIDE A PARAGRAPH, and a paragraph here is one line. So
        # the marker can only go before or after the line it falls in, and putting it always
        # before means a quotation from the tail of a straddling paragraph is offered under the
        # previous page's number. Whichever side holds most of the line wins, which halves the
        # error and never moves it more than one paragraph.
        same = [k for k in range(len(word_line)) if word_line[k] == li]
        if same and (at - same[0]) > len(same) * 0.5:
            li = li + 1
        inserts.setdefault(li, number)
        placed.append(number)

    out = []
    for li, line in enumerate(lines):
        if li in inserts:
            out.append(f"<!-- p.{inserts[li]} begins here -->")
            out.append("")
        out.append(line)
    return "\n".join(out), dict(placed=placed, missed=missed, **meta)


def main():
    ap = argparse.ArgumentParser(
        description="Put a PDF's page numbers onto text converted from a better source.")
    ap.add_argument("markdown")
    ap.add_argument("pdf")
    ap.add_argument("--write", action="store_true", help="rewrite the markdown in place")
    a = ap.parse_args()

    md = Path(a.markdown).read_text(encoding="utf-8")
    out, rep = paginate(md, a.pdf)
    print(f"  {rep['sheets']} sheet(s); {rep['printed_numbers']} carried a printed number"
          + (f", numbering offset {rep['offset']:+d}" if rep["offset"] is not None else ""))
    if rep["outliers"]:
        print(f"  ! {len(rep['outliers'])} sheet(s) disagreed with the majority: {rep['outliers']}")
    print(f"  placed {len(rep['placed'])} page marker(s)"
          + (f"; pp. {rep['placed'][0]}–{rep['placed'][-1]}" if rep["placed"] else ""))
    if rep["missed"]:
        # NAMED, NOT COUNTED. A page with no marker means a quotation from it will be offered
        # under the previous page's number, and knowing which pages those are is the difference
        # between trusting the pagination and checking it.
        print(f"  ! no marker for p. {', '.join(str(n) for n in rep['missed'])}"
              " -- their opening words were not found in the text")
    if a.write:
        Path(a.markdown).write_text(out, encoding="utf-8")
        print(f"  wrote {a.markdown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
