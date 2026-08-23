#!/usr/bin/env python3
"""Report what a PDF's text layer is like, BEFORE converting it.

    python3 mcp/eval/probe_pdf.py" FILE.pdf [FILE.pdf ...]

WHY THIS AND NOT A BIGGER FIXTURE SET. The converter comparison needed hand-labelled repairs and
those are expensive -- eight of them, each read off a page image. What a wider corpus is actually
for is different: catching LAYOUT SHAPES that break things, and that needs no labels at all,
because the damage announces itself geometrically if something looks.

Three tells, none of which needs a human to have read the paper:

  * TEXT-LAYER COVERAGE. Characters per page. A scanned page with no OCR yields almost nothing,
    and a paper whose text layer covers only its cover sheet is the failure that produced 345
    words from a 1,220-word article and was written up as a bad library rather than a missing
    dependency.

  * STRETCHED LINES. An OCR text layer is stretched to fit the printed line it stands for, so a
    line that lost words is drawn far wider than its characters warrant. This is the tell that
    caught the Gettier's two dropped lines -- 15 points per character against a body median of
    4.5 -- and it is the only signal that finds silently missing text. `pdf_to_source.py` has
    carried it for months; this exposes it on any file, before any conversion decision.

  * COLUMNS. Counted from the horizontal gap in the line extents. Two columns are where reading
    order goes wrong, and a reading-order error is invisible in a word count.

The verdict is advisory and deliberately coarse. It exists so a router can escalate on evidence
rather than on the operator's guess, and so a paper that needs a human gets one.
"""
import os
import re
import statistics
import sys

import pymupdf

# REUSE THE TESTED COLUMN DETECTOR, do not write a second one. A hand-rolled occupancy sweep here
# read the two-column Tooming as one and the single-column Williams as two -- and `detect_columns`
# carries a docstring listing three earlier versions of exactly that mistake, each wrong in a way
# nothing announced. It is covered by test_pdf_to_source.py. One rule, one implementation.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "Build scripts"))
from pdf_to_source import detect_columns, sheet_lines            # noqa: E402


def probe(path):
    doc = pymupdf.open(path)
    pages, chars, widths, sheets = len(doc), [], [], []
    page_width = doc[0].rect.width if len(doc) else 0
    for page in doc:
        d = page.get_text("dict")
        n = 0
        for block in d.get("blocks", []):
            for line in block.get("lines", []):
                text = "".join(s.get("text", "") for s in line.get("spans", []))
                if len(text.strip()) < 4:
                    continue
                x0, _, x1, _ = line["bbox"]
                n += len(text)
                # SHORT LINES ARE NOT EVIDENCE OF DAMAGE. Running heads, page numbers and
                # headings are centred, set wide, and legitimately high in points-per-character:
                # on the Gettier "122 ANALYSIS" and "ANALYSIS 23.6 JUNE 1963" both scored above
                # the threshold and are simply furniture. The tell only means something on a
                # line long enough to be body text.
                if len(text.strip()) >= 25:
                    widths.append(((x1 - x0) / len(text), text))

        chars.append(n)
        sheets.append(sheet_lines(page))
    doc.close()

    # GARBAGE, WHICH THE STRETCH TEST CANNOT SEE. The stretch tell finds lines DRAWN WIDER than
    # their characters warrant -- the geometric signature of words the OCR dropped. It is blind
    # to words the OCR REPLACED, because the replacement occupies the space: `e a s bulando`
    # is the same width as the clause it destroyed. Carroll's "What the Tortoise Said to
    # Achilles" came back `clean` from this probe with a dozen passages reduced to letter
    # soup, and was only caught by reading it.
    #
    # The tell for substitution is a run of isolated one- and two-letter tokens, which ordinary
    # English does not produce: "a" and "I" occur alone, but not four in a row.
    all_text = " ".join(t for _, t in widths)
    garbage = len(re.findall(r"(?:\b[b-hj-np-z]\b[ \t]{1,3}){3,}", all_text))

    per_char = [w for w, _ in widths]
    med = statistics.median(per_char) if per_char else 0
    stretched = [(w, t) for w, t in widths if med and w > med * 2.5]
    empty = sum(1 for c in chars if c < 100)
    mean_chars = statistics.mean(chars) if chars else 0
    split = detect_columns(sheets, page_width) if sheets else None
    cols = 2 if split else 1

    if empty >= max(1, pages // 2):
        verdict = "NO USABLE TEXT LAYER -- needs OCR"
    elif mean_chars < 400:
        verdict = "SPARSE text layer -- probably a scan, needs OCR"
    elif stretched and garbage:
        verdict = (f"DAMAGED -- {len(stretched)} line(s) lost words, "
                   f"{garbage} passage(s) turned to letter soup")
    elif stretched:
        verdict = f"DAMAGED -- {len(stretched)} line(s) look like they lost words"
    elif garbage:
        verdict = f"GARBLED -- {garbage} passage(s) of letter soup; the OCR replaced words"
    else:
        verdict = "clean"
    return dict(pages=pages, mean_chars=round(mean_chars), empty_pages=empty,
                columns=cols, median_pts_per_char=round(med, 1),
                stretched=stretched, garbage=garbage, verdict=verdict)


def main(paths):
    print(f"{'file':<42}{'pp':>4}{'chars/pp':>10}{'cols':>6}{'blank':>7}  verdict")
    for p in paths:
        try:
            r = probe(p)
        except Exception as e:
            print(f"{p.split('/')[-1][:40]:<42}  {type(e).__name__}: {e}"[:110])
            continue
        name = p.split("/")[-1]
        print(f"{name[:40]:<42}{r['pages']:>4}{r['mean_chars']:>10}{r['columns']:>6}"
              f"{r['empty_pages']:>7}  {r['verdict']}")
        for w, t in r["stretched"][:3]:
            print(f"    {w:>5.1f} pts/char (median {r['median_pts_per_char']}): {t.strip()[:62]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
