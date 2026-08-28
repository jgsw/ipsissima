#!/usr/bin/env python3
"""Report what a PDF's text layer is like, BEFORE converting it.

    python3 ipsissima-mcp/eval/probe_pdf.py FILE.pdf [FILE.pdf ...]

WHY THIS AND NOT A BIGGER FIXTURE SET. The converter comparison needed hand-labelled repairs and
those are expensive -- eight of them, each read off a page image. What a wider corpus is actually
for is different: catching LAYOUT SHAPES that break things, and that needs no labels at all,
because the damage announces itself geometrically if something looks.

Five tells, none of which needs a human to have read the paper:

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

  * LETTER SOUP. Words the OCR REPLACED rather than dropped, which the stretch tell cannot see
    because the replacement occupies the same space. The signature is a run of isolated one- and
    two-letter tokens, which English does not produce.

  * DISPLAYED MATHEMATICS. Not damage, and deliberately not reported as damage: an equation and
    a ruined equation look alike to any test that has not read the paper. What it says is that
    the paper HAS displayed mathematics, which a text layer renders badly and no converter here
    can repair -- which is the case this file exists to route to a human.

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
# THE PACKAGE MOVED AND THIS DID NOT. "Build scripts" has not existed since the tooling was
# split into `ipsissima-mcp/src/ipsissima_mcp/`, so this module did not import at all -- it
# raised ModuleNotFoundError on the first line that mattered, and nothing ran it often enough
# to notice.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "src", "ipsissima_mcp"))
from pdf_to_source import detect_columns, sheet_lines            # noqa: E402


def probe(path):
    doc = pymupdf.open(path)
    pages, chars, widths, sheets = len(doc), [], [], []
    lines_all = []
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
                # EVERY LINE FEEDS THE GARBAGE TEST; only long ones feed the stretch test.
                # These two tells want different populations and were sharing one list, so the
                # 25-character floor above -- which exists for the STRETCH test, and is right
                # there -- silently filtered the garbage test as well. A destroyed equation is a
                # SHORT line, so the one damage the floor excludes is exactly the one this file
                # was pointed at: Ramsey's displayed mathematics is letter soup on every page
                # and the probe called the file `clean`.
                lines_all.append(text)
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
    all_text = " ".join(lines_all)
    garbage = len(re.findall(r"(?:\b[b-hj-np-z]\b[ \t]{1,3}){3,}", all_text))

    # DISPLAYED MATHEMATICS, WHICH NEITHER OTHER TELL CAN SEE. A ruined equation is neither
    # stretched -- it is short, and the stretch test only looks at lines of 25 characters or
    # more -- nor letter soup in the prose sense, because it is full of digits, operators and
    # brackets rather than isolated letters. On Ramsey's "A Mathematical Theory of Saving" every
    # displayed line is wreckage:
    #
    #     Tg He) - fa.c)} = Ge -F(ase) + Ua)ar a + U®) a a te
    #
    # and the probe called the file `clean`.
    #
    # WHAT THIS DOES NOT CLAIM. It cannot tell a ruined equation from an intact one: both are
    # mostly one- and two-character tokens, and that is what an equation IS. So it does not
    # report damage. It reports that the paper has displayed mathematics in it, which a text
    # layer renders badly and which no converter in this toolchain can repair -- which is
    # exactly the case this file exists to route to a human.
    # AND IT NEEDS AN OPERATOR, or it is just short prose. "It is to doubt as to the next" is
    # five short words and no more mathematical than the rest of Dewey's 1896 paper, which has
    # none at all and was flagged four times without this. An equation has a relation in it.
    # `-` is deliberately absent: it is a hyphen far more often than a minus sign.
    OPERATOR = re.compile(r"[=×÷∫∑√≤≥≠±∂]|(?<= )[+](?= )")
    maths = 0
    for tx in lines_all:
        toks = tx.split()
        if (len(toks) >= 4 and OPERATOR.search(tx)
                and sum(1 for w in toks if len(w) <= 2) / len(toks) > 0.6):
            maths += 1

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
    elif maths >= max(3, pages // 3):
        verdict = (f"CHECK THE MATHEMATICS -- {maths} displayed line(s). A text layer renders "
                   f"equations badly and this cannot tell a ruined one from a sound one")
    else:
        verdict = "clean"
    return dict(pages=pages, mean_chars=round(mean_chars), empty_pages=empty,
                columns=cols, median_pts_per_char=round(med, 1),
                stretched=stretched, garbage=garbage, maths=maths, verdict=verdict)


def self_test():
    """Enough to prove the module IMPORTS and the tells discriminate.

    THE IMPORT IS THE POINT. This file pointed at "../Build scripts", a directory that stopped
    existing when the tooling was split into a package, so it raised ModuleNotFoundError on
    every run -- and nothing ran it often enough to notice. A tell nobody can execute is worse
    than no tell, because it is still counted on.
    """
    fails = 0

    def check(name, got, want):
        nonlocal fails
        ok = got == want
        if not ok:
            fails += 1
        print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"  got {got!r} want {want!r}"))

    check("the package imports", callable(sheet_lines) and callable(detect_columns), True)

    OPERATOR = re.compile(r"[=×÷∫∑√≤≥≠±∂]|(?<= )[+](?= )")

    def is_maths(tx):
        toks = tx.split()
        return bool(len(toks) >= 4 and OPERATOR.search(tx)
                    and sum(1 for w in toks if len(w) <= 2) / len(toks) > 0.6)

    # Ramsey, as the text layer actually gives it.
    check("a ruined equation is seen",
          is_maths("Tg He) - fa.c)} = Ge -F(ase) + Ua)ar a + U®) a a te"), True)
    check("  and a sound one too, which is why this is not called damage",
          is_maths("x = a + b + c"), True)
    # Dewey 1896 has no mathematics and was flagged four times before the operator was required.
    check("short prose is not mathematics", is_maths("It is to doubt as to the next"), False)
    check("  nor is a hyphenated phrase", is_maths("a well-known case of one as"), False)

    GARBAGE = re.compile(r"(?:\b[b-hj-np-z]\b[ \t]{1,3}){3,}")
    check("letter soup is seen", bool(GARBAGE.search("the e a s b n text")), True)
    check("  and ordinary prose is not", bool(GARBAGE.search("I am a person of note")), False)

    print("\n" + (f"{fails} FAILED" if fails else "all passed"))
    return 1 if fails else 0


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
    if "--self-test" in sys.argv[1:]:
        sys.exit(self_test())
    main(sys.argv[1:])
