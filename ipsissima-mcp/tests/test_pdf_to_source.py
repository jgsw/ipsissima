#!/usr/bin/env python3
"""Tests for the page-geometry detection in pdf_to_source.py.

    python3 ipsissima-mcp/tests/test_pdf_to_source.py

Both cases below were real bugs, and both were the same KIND of bug: a confident wrong answer
with nothing to signal it. The column test read min and max across the page's midline, so two
straddling lines out of 731 hid the most bimodal histogram imaginable and a two-column paper was
read as one. The band test was computed over every line on the sheet, so a following article
sharing the last sheet bridged the gap between two of this article's indent levels.

The fixtures are synthetic on purpose -- a detector should be checkable without a PDF -- but the
numbers are taken from the two real papers.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
from pdf_to_source import (detect_columns, sheet_splits, column_frames, heads_a_block, detect_bands, split_footnotes,   # noqa: E402
                            heading_gaps, note_opening, join_spans, to_blocks,
                            printed_numbers, page_offset, detect_furniture, resolve_bands,
                            find_boundaries, looks_like_heading, title_case)

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))


def lines(*groups, right=250.0):
    """Fixture lines. `right` is the column's RIGHT MARGIN, which is what every line in a column
    shares -- an indented line is shorter, not shifted. The detector looks for a band no line's
    [x0, x1] span reaches, so a fixture giving only left edges cannot express a gutter, and one
    giving every line the same WIDTH makes the indented ones overhang into it."""
    return [{"x0": float(x), "x1": right, "text": "x" * 40} for x, n in groups for _ in range(n)]


print("detect_columns")
# The Williams: 297 lines at the left margin, 285 at the right, nothing between -- plus the few
# straddling lines that defeated the previous test.
williams = (lines((63, 148), (65, 149), (88, 30), right=251)
            + lines((267, 138), (269, 147), (285, 21), right=455))
split = detect_columns(williams, 522)
check("a two-column page is found", split is not None and 90 < split < 260, True)
check("  and a few full-width lines in the gutter do not hide it",
      detect_columns(williams + lines((63, 3), right=455), 522) is not None, True)
# The Tooming: the widest EMPTY RUN OF LEFT EDGES on that paper lies between the left column's
# indents and its displayed material -- inside a column, not between two.
tooming = (lines((38, 451), (50, 70), (185, 11), right=290)
           + lines((307, 404), (319, 117), right=558))
check("  a wide gap between indents inside one column is not a gutter",
      abs(detect_columns(tooming, 595) - 297) < 15, True)

# The Gettier: one column, but with a deep hanging column for the numbered conditions. The mass
# test is what stops that being read as a second column.
gettier = lines((67, 60), (77, 12), (83, 7), (225, 6), (254, 2), right=450)
check("a deep hanging indent is not a second column", detect_columns(gettier, 450), None)
check("too little text to judge is not guessed at", detect_columns(lines((60, 5)), 450), None)
check("  one full-width title does not hide a gutter",
      detect_columns(williams + lines((63, 1), right=455), 522) is not None, True)

# A MIRRORED LAYOUT (Hedström and Ylikoski 2010, Annual Reviews): the text block left of centre on
# the odd pages, right of it on the even, so the gutter is at 229 on one and 302 on the other.
# Mutation: return [split] * len(pages) always -> the odd pages keep 302 and read across both columns.
recto = lines((46, 50), (58, 6), right=223) + lines((235, 50), (247, 6), right=411)
verso = lines((120, 50), (132, 6), right=296) + lines((308, 50), (320, 6), right=485)
title = lines((46, 30), right=485)
pages = [title, recto, verso, recto, verso, recto, verso]
med = detect_columns(pages, 531)
sp = sheet_splits(pages, 531, med)
check("a mirrored layout: each page splits at its own gutter, a page with none at the paper's",
      (all(220 < x < 236 for x in sp[1::2]), all(296 < x < 310 for x in sp[2::2]), sp[0] == med), (True, True, True))
check("  and one gutter throughout is left as it was",
      sheet_splits([recto] * 4, 531, detect_columns([recto] * 4, 531)) == [detect_columns([recto] * 4, 531)] * 4, True)

# AND ITS LEFT MARGIN MOVES: Reason 2000's odd pages start at 48, its even at 138, where a boxed
# panel at 60 outnumbers the body's lines. Mutation: read the left margin from the left edges ->
# the even pages shift by 12, not 90.
odd = lines((48, 50), right=258) + lines((275, 50), right=485)
even = lines((60, 13), right=335) + lines((138, 8), right=347) + lines((365, 53), right=575)
offs, shifts = column_frames([odd, odd, even], [266, 266, 357])
check("a mirrored page's block is shifted onto the paper's margin, read from its right column",
      (offs[266], offs[357], shifts.get(266, 0), shifts[357]), (227, 227, 0, 90))
# BACK MATTER AT THE NOTES' SIZE is not a note carried over (Rogowski et al.'s "Contributors").
check("a back-matter heading opens a block; a running head, a table and a name do not",
      [heads_a_block(t) for t in ("Contributors", "Declaration of interests", "ACKNOWLEDGEMENTS",
                                  "Table 1", "Charles Weingartner", "Notes")],
      [True, True, False, False, False, False])

print("detect_bands")
b = detect_bands(lines((67, 60), (77, 12), (83, 7), (225, 6)))
check("margin is the commonest left edge", b["margin"], 67)
check("  the lower near level is the displayed block", round(b["display"]), 77)
check("  the higher near level starts a paragraph", round(b["paragraph"]), 83)
check("  and the far one is a hanging column", round(b["hanging"]), 225)
check("  two levels is not ambiguous", b["ambiguous"], False)

b1 = detect_bands(lines((65, 100), (88, 40)))
check("one indent means no displayed blocks", (b1["display"], round(b1["paragraph"])), (None, 88))

# The Williams again: three near levels, and no counting rule separates them. "Most lines" picks
# 88.5 here and would pick the DISPLAY band on the Gettier, so the honest answer is to refuse.
b3 = detect_bands(lines((65, 200), (77, 56), (88, 60), (100, 12)))
check("three near levels refuse to be guessed", b3["ambiguous"], True)

# Contamination: a following article's indents must not merge two levels into one.
clean = detect_bands(lines((67, 60), (77, 12), (83, 7)))
dirty = detect_bands(lines((67, 60), (77, 12), (80, 3), (81, 3), (83, 7)))
check("levels 3pt apart stay separate", (round(clean["display"]), round(clean["paragraph"])), (77, 83))
check("  but a bridged gap collapses them -- which is why bands are measured after filtering",
      dirty["display"] is None or round(dirty["paragraph"]) != 83, True)

print("split_footnotes")
# Reading order on a two-column page: LEFT column top to bottom, then RIGHT column from the top
# again. A footnote at the foot of the left column must not swallow the right column, which is
# the whole of the second column of every page of a nine-page paper.
H = 800.0


def row(x0, y0, text, col=0, small=False, printed=1):
    """One extracted line. `small` means "set below the article's body size" -- the only signal
    a paper carries when it sets its notes LEFT of the display band rather than right of it."""
    return (printed, x0, y0, H, text, col, small)


body = [row(40, 100, "Left column opening."),
        row(40, 600, "1 A footnote at the foot of the left column."),
        row(40, 120, "2. Hume and abstraction", col=1),
        row(40, 200, "The section that heading introduces.", col=1)]
flow, notes = split_footnotes(body, 30)
check("a left-column footnote does not swallow the right column",
      [t for _p, _x, t in flow],
      ["Left column opening.", "2. Hume and abstraction", "The section that heading introduces."])
check("  and the footnote itself is still lifted", len(notes), 1)

# Within one column it must still latch: everything under the first marker is note material.
same = [row(40, 100, "Body."),
        row(40, 600, "1 First note."),
        row(40, 640, "runover of the first note"),
        row(40, 680, "2 Second note.")]
flow2, notes2 = split_footnotes(same, 30)
check("inside one column the zone still latches", (len(flow2), len(notes2)), (1, 3))

# THE NOTE BEFORE THE FIRST ONE FOUND: set a little high and at near-body size, "19 Ralph Nader"
# was left inside the sentence that runs over the page while 20 below it was lifted (Stone, JSTOR
# scan, 28 Sep 2026). The number sequence decides; a body line numbered otherwise stays.
stone = [row(54, 500, "The Ford Pinto automobile case is especially notable because the court"),
         row(65, 551, "19 Ralph Nader, Unsafe at Any Speed (New York: Bantam Books, 1973)."),
         row(65, 563, "20 Jonathan Schell, The Fate of the Earth (New York: Avon Books, 1982).",
             small=True),
         row(54, 575, "and a runover line of note twenty", small=True)]
flow3, notes3 = split_footnotes(stone, 60, margin=54)
check("a note numbered just before the first note found is lifted with it",
      [t[:9] for _p, _x, t in notes3], ["19 Ralph ", "20 Jonath", "and a run"])
check("  and the sentence it interrupted is left whole", len(flow3), 1)
other = [stone[0], row(65, 551, "17 Ralph Nader, Unsafe at Any Speed (New York: Bantam Books, 1973).")] + stone[2:]
check("  a line numbered out of sequence is not",
      len(split_footnotes(other, 60, margin=54)[0]), 2)
# A HEADED BLOCK AT THE NOTES' SIZE is back matter, not a note carried over (Rogowski et al., the
# Lancet, p. 11). Mutation: drop the heads_a_block guard -> all three rows are lifted.
lancet = [row(262, 500, "benefits."),
          row(262, 526, "Contributors", small=True),
          row(262, 535, "CBBR: primary acquisition of data, analysis concept, analysis, and", small=True),
          row(262, 544, "interpretation of data. Primary drafting of the manuscript.", small=True)]
check("a block headed Contributors at the foot of a column stays in the flow",
      len(split_footnotes(lancet, 300)[1]), 0)
check("  while one with no heading, low on the page, is still a note carried over",
      len(split_footnotes(lancet[:1] + lancet[2:], 300)[1]), 2)
check("high-up numbered text is not a footnote",
      len(split_footnotes([row(40, 100, "1 Not a note, too high.")], 30)[1]), 0)

# THE NUMBER HANGS INTO THE MARGIN, so the tenth note starts further left than the ninth. Measured
# on the Tooming: notes 1-9 at x0 43.7, notes 10-25 at 40.7, display band 43.7, margin 38. A flat
# 2pt tolerance took the first nine and left the other sixteen in the running prose.
E, M = 43.7, 38
check("a two-digit note, hanging left of the band, is still a note",
      len(split_footnotes([row(40.7, 600, "10 See also Kind (2025).")], E, margin=M)[1]), 1)
check("  a one-digit note that far left is not -- the slack is the number's width",
      len(split_footnotes([row(40.7, 600, "1 See also Kind (2025).")], E, margin=M)[1]), 0)
check("  and the floor never reaches the margin, where continuation lines live",
      len(split_footnotes([row(38, 600, "10 A continuation line that opens with a number.")],
                          E, margin=M)[1]), 0)

# WHERE THE PAPER GIVES NO INDENT SIGNAL AT ALL. The Horton sets its notes at x0 96, LEFT of a
# display band at 116, and distinguishes them by size (8pt against 10pt). Its notes also start
# at 0.60 of the sheet, above the bottom-30% strip, and put a full stop after the number.
check("a smaller-set note left of the display band is lifted",
      len(split_footnotes([row(96, 480, "5. See Horton, \u201cAggregation.\u201d", small=True)],
                          116, margin=80)[1]), 1)
check("  the same line at body size is not -- size is what distinguishes it",
      len(split_footnotes([row(96, 480, "5. See Horton, \u201cAggregation.\u201d")],
                          116, margin=80)[1]), 0)
check("  a body-sized numbered heading at the foot stays in the flow",
      len(split_footnotes([row(101, 600, "2. Hume and abstraction")], 116, margin=80)[1]), 0)
check("  and a small line high on the page is still not a note",
      len(split_footnotes([row(96, 240, "5. See Horton.", small=True)], 116, margin=80)[1]), 0)

# The unnumbered first note is keyed to the TITLE, so left in the flow it lands in the middle of
# the article's opening sentences -- on the Horton it cut one clean in half.
check("the unnumbered star note is lifted too",
      len(split_footnotes([row(96, 480, "* For helpful comments, I am grateful to Nilanjan Das.",
                               small=True)], 116, margin=80)[1]), 1)
check("  but a star at body size is not a note",
      len(split_footnotes([row(96, 480, "* For helpful comments, I am grateful to Nilanjan Das.")],
                          116, margin=80)[1]), 0)

# A NOTE TOO LONG FOR ITS PAGE CONTINUES AT THE FOOT OF THE NEXT ONE, above that page's own
# notes and carrying no number: it resumes mid-sentence, in lower case. Horton's footnote 1 does
# exactly this, and six lines of Kamm and Voorhoeve citations were landing inside a sentence
# about what is new in the reductio.
runover = [row(80, 100, "Body text of the new page."),
           row(80, 376, "Rights, Responsibilities, and Permissible Harm (Oxford, 2007),", small=True),
           row(80, 400, "84-86; Voorhoeve, \u201cHow Should We Aggregate\u201d;", small=True),
           row(96, 440, "2. For discussion of fully aggregative views, see Scheffler.", small=True)]
flow3, notes3 = split_footnotes(runover, 116, margin=80)
check("a carried-over note above the first numbered one is lifted",
      [t for _p, _x, t in flow3], ["Body text of the new page."])
check("  and all three note lines travel together", len(notes3), 3)

# The runover starts at 0.47 of the sheet on the Horton, ABOVE any bottom-of-page strip. The
# backward walk is anchored on the first numbered note and stops at the first body-sized line,
# so it needs no height test of its own -- and a height test breaks exactly this case.
high = [row(80, 100, "Body text."),
        row(80, 370, "a runover line that starts above the halfway mark", small=True),
        row(96, 440, "2. A numbered note.", small=True)]
check("the walk back is not stopped by a height threshold",
      len(split_footnotes(high, 116, margin=80)[1]), 2)

# What keeps that safe is CONTIGUITY: a body-sized line between the two ends the walk.
gap = [row(80, 380, "a small aside set below body size", small=True),
       row(80, 400, "Ordinary body text at full size."),
       row(96, 440, "2. A numbered note.", small=True)]
f4, n4 = split_footnotes(gap, 116, margin=80)
check("a body-sized line stops the walk back", len(n4), 1)
check("  so the small aside above it stays in the flow", len(f4), 2)

print("to_blocks (footnote sequence)")
# A footnote's runover is full of numbers that open a line and are not note numbers: a volume, a
# page range, a year. Note 1 of the Horton continues "46 (2018): 160-74. For responses ..." and
# that read as note 46, cutting note 1 in half.
rows = [(1, 96, "1. For influential partially aggregative views, see Kamm,"),
        (1, 80, "46 (2018): 160\u201374. For responses to these criticisms, see Kamm,"),
        (2, 80, "Rights, Responsibilities, and Permissible Harm (Oxford, 2007), 484\u201386."),
        (2, 96, "2. For discussion of fully aggregative views, see Scheffler.")]
blocks = to_blocks(rows, {"margin": 80, "display": 116, "paragraph": 101, "hanging": None},
                   {}, None, notes=True)
check("a page range mid-note does not open note 46", len(blocks), 2)
check("  note 1 keeps its runover, across the page break too",
      blocks[0]["text"].count("For responses") == 1 and "484\u201386." in blocks[0]["text"], True)
check("  and the next note still opens on its own number",
      blocks[1]["text"].startswith("2. For discussion"), True)

print("resolve_bands (choosing, rather than refusing)")
# `detect_bands` declines to guess above two indent levels. That was right for six hand-configured
# papers and wrong for a corpus: on 45 modern articles it refused 28 -- every failure, in every
# field. The dominant near-margin level is where ordinary paragraphs begin, because a paper is
# mostly ordinary paragraphs; measured leads on the refusing papers ran 318 lines against 21,
# 331 against 17, 309 against 66.
def bands(margin, *levels):
    return dict(margin=margin, levels=list(levels), display=None, paragraph=None,
                hanging=None, ambiguous=True)

got, why = resolve_bands(bands(42, (50.0, 17), (55.5, 85), (64.5, 5), (84.1, 2)))
check("the level with the most lines is the paragraph indent", got["paragraph"], 55.5)
check("  the shallowest is where a displayed block can still be caught", got["display"], 50.0)
check("  and the paper is no longer refused", got["ambiguous"], False)
check("  the lead over the next level is reported, so a close call is visible", why["lead"], 5.0)

# `display` is only ever tested for lines SHALLOWER than `paragraph` -- `to_blocks` checks
# `paragraph` first -- so a dominant level that is itself the shallowest leaves nothing for it.
got, why = resolve_bands(bands(42, (50.0, 90), (64.5, 5), (84.1, 2)))
check("a dominant level that is also the shallowest takes both", 
      (got["paragraph"], got["display"]), (50.0, 50.0))

# One level is not an ambiguity; it is an answer, and must be left alone.
got, why = resolve_bands(bands(42, (55.5, 85)))
check("a single level is not resolved", (got["paragraph"], why), (None, None))
check("  and stays flagged for the caller to handle", got["ambiguous"], True)

# A level far to the right is a hanging column -- a definition's numbered conditions, a
# bibliography's runover -- and however many lines it has it is not where paragraphs begin. It is
# excluded before any counting, which here leaves ONE near level: not an ambiguity, and so not
# this function's to settle. `detect_bands` names a single level the paragraph indent itself.
got, why = resolve_bands(bands(42, (55.5, 20), (300.0, 400)))
check("a deep hanging column never becomes the paragraph indent", got["paragraph"], None)
check("  and with one near level left there is nothing to resolve", why, None)
# But among levels that ARE near, the line count decides even against a much deeper one.
got, why = resolve_bands(bands(42, (55.5, 20), (96.0, 300), (300.0, 400)))
check("the dominant NEAR level wins, ignoring the far column", got["paragraph"], 96.0)

print("find_boundaries (a cut that leaves nothing is not a cut)")
def rows(*texts, margin=80):
    return [(1, margin, 500, 1000.0, t, 0, False) for t in texts]
r = rows(*["Abstract", "References"] + ["Body text here."] * 3)
first, last = find_boundaries(r, 80, 10.0, [10.0] * len(r))
check("a cut that would leave almost nothing is discarded", (first, last), (0, len(r)))

print("title_case (a caps heading, re-cased)")
check("small words stay small", title_case("THE MEANING AND THE LIMITS"), "The Meaning and the Limits")
check("  but not the first word", title_case("THE REDUCTIO"), "The Reductio")
check("  nor the first after a numeral", title_case("II. THE REDUCTIO"), "II. The Reductio")
check("roman numerals are left as printed", title_case("III. APPLYING IT"), "III. Applying It")

print("detect_furniture (running heads)")


def head_sheet(*texts, height=1000.0):
    """A sheet whose running head sits in the top band, over a line of body text."""
    lines = [dict(text=t, y0=90, x0=80, x1=200, width=120, size=9.0) for t in texts]
    lines.append(dict(text="Body text of this page.", y0=300, x0=80, x1=400,
                      width=320, size=10.0))
    return (lines, height)


# A TWO-SIDED RUNNING HEAD CANNOT REACH HALF THE SHEETS: the first page carries a title block
# instead of a head, so verso and recto split the remainder unevenly. On the Horton's 16 sheets
# that is 8 and 7 -- and a threshold of half dropped the side with 8 while keeping the side with
# 7, which then ran on into the paragraph below it eight times over.
pages = [head_sheet()]                                   # p.1: a title block, no head
for i in range(1, 16):
    pages.append(head_sheet("Horton", "Aggregation, Risk, and Reductio") if i % 2
                 else head_sheet("Ethics", "July 2020"))
is_furn, heads, _footers = detect_furniture(pages)
check("the recto side of an alternating head is furniture",
      is_furn("Aggregation, Risk, and Reductio", 90, 1000.0), "running head")
check("  and so is the verso side, which is one page short of half",
      is_furn("July 2020", 90, 1000.0), "running head")
check("  including the journal's name on its own", is_furn("Ethics", 90, 1000.0), "running head")
check("body text is not furniture, however often a page has some",
      is_furn("Body text of this page.", 300, 1000.0), None)
check("  and a head's words are safe once they are out of the top band",
      is_furn("July 2020", 500, 1000.0), None)

# A VERSO HEAD IN TWO PARTS ON ONE LINE: "760 / Changing Rhetorical Norms ..." at the left and the
# authors at the right. `alone` kept it as text -- the paragraph-number rule -- and it ran into the
# prose seven times (Valentino et al., 28 Sep 2026).
pages = [head_sheet()]
for i in range(1, 14):
    pages.append(head_sheet(f"{757 + i} / Changing Rhetorical Norms", "N. Valentino and others")
                 if i % 2 else head_sheet("Volume 80", f"July 2018 / {757 + i}"))
is_furn, heads, _footers = detect_furniture(pages)
check("a repeated head with words in it is a head though its other half is beside it",
      is_furn("760 / Changing Rhetorical Norms", 90, 1000.0, alone=False), "running head")
check("  but a bare number with text beside it is still a paragraph number",
      is_furn("30.", 90, 1000.0, alone=False), None)

print("split_at_pages (the marker where the page begins, not after the paragraph)")
from pdf_to_source import split_at_pages                                      # noqa: E402
b = dict(page=759, pages={759, 760}, text="or with one that did not discuss welfare at all. They "
         "found no differences.", breaks=[(760, "discuss welfare at all. They found")])
check("a paragraph across a page break is cut where the new page's first row begins",
      split_at_pages(b), [(759, "or with one that did not"),
                          (760, "discuss welfare at all. They found no differences.")])
b = dict(page=4, pages={4, 5}, text="the argument continues here and ends.",
         breaks=[(5, "tinues here and ends.")])
check("  the second half of a hyphenated word cuts at the next space",
      split_at_pages(b), [(4, "the argument continues"), (5, "here and ends.")])
b = dict(page=4, pages={4, 5}, text="a row the repairs changed beyond finding.",
         breaks=[(5, "nowhere in the text")])
check("  and a row that cannot be found leaves the block whole",
      split_at_pages(b), [(4, "a row the repairs changed beyond finding.")])

print("printed_numbers / page_offset")
def sheet(number):
    """One sheet carrying its page number centred at the foot, as a journal prints it."""
    lines = [] if number is None else [dict(text=str(number), y0=900, x0=200, x1=210,
                                            width=10, size=10.0)]
    return (lines, 1000, 700)


found = printed_numbers([sheet(514), sheet(515), sheet(516)])
check("the number printed on each sheet is read", found, {0: 514, 1: 515, 2: 516})
check("  and gives the offset", page_offset(found, 3), (514, []))
# The first sheet of an article carries no running head, so its number is inferred, not read.
part = {1: 515, 2: 516}
check("a missing first number is inferred from the rest", page_offset(part, 3), (514, []))
# One stray number must not renumber the article.
stray = {0: 514, 1: 515, 2: 516, 3: 9}
check("a stray number is an outlier, not a new numbering",
      page_offset(stray, 4), (514, [3]))
# THE MANUSCRIPT (Marti and Gond, 28 Sep 2026): a few numbers near the end of 55 unnumbered sheets
# voted for an offset that put 52 sheets at page 0 or below. Mutation: drop the guard -> (-50, []).
check("an offset that numbers most sheets zero or below is not pagination",
      page_offset({52: 2, 53: 3, 54: 4}, 55), (None, []))
check("  while a cover sheet or two before page 1 still is", page_offset({2: 1, 3: 2, 4: 3}, 20), (-1, []))
check("no numbers at all means fall back to the config", page_offset({}, 3), (None, []))

print("note_opening")
check("a plain number opens a note", note_opening("1 Plato seems to say"), ("1", "Plato seems to say"))
check("  as does one already marked up", note_opening("[^12] Arguably"), ("12", "Arguably"))
check("  a dotted number only when asked", note_opening("5. See Horton"), None)
check("  and then it does", note_opening("5. See Horton", dotted=True), ("5", "See Horton"))
check("a year is not a note number", note_opening("1963 was the year"), None)
check("a heading is not a note unless dotted forms are allowed",
      note_opening("2. Hume and abstraction"), None)

print("opens_note refuses a heading-shaped line")
# "6 Ceremonies and Western Philosophy" stood in the bottom third of its sheet at body size,
# matched the bare-number spelling, and latched the note zone -- swallowing the heading and
# the section's first paragraph into footnote 1 (Wolff, 15 Sep). A body-sized line that is
# also heading-shaped is the heading; a real note carries sentence punctuation.
from pdf_to_source import opens_note                                          # noqa: E402
row = lambda text, small: (11, 76.0, 700.0, 842.0, text, 0, small)
check("a low body-sized section heading does not open a note",
      opens_note(row("6 Ceremonies and Western Philosophy", False), None, 0.70, 43), False)
check("  the same words at apparatus size still do",
      bool(opens_note(row("6 Ceremonies and Western Philosophy", True), None, 0.70, 43)), True)
check("  a body-sized note with a full stop still opens",
      bool(opens_note(row("6 See Smith (2010), ch. 2 for the argument.", False),
                      None, 0.70, 43)), True)
check("  a small numbered note is untouched by the guard",
      bool(opens_note(row("1 For comments I thank many colleagues.", True), None, 0.70, 43)),
      True)

print("displayed quotations (G6's structure half)")
# The signal measured on the Wolff: a quotation is a run of lines ALL off the page's own
# margin -- the indent a paragraph gives only to its first line. Two guards: one indented
# line IS a paragraph opening, and a run with no lowercase continuation is two short
# paragraphs, not a quotation.
from pdf_to_source import mark_displayed_quotes                               # noqa: E402
FLOW = [
    (1, 53, "First paragraph opens indented."),          # 0: a paragraph's own first line
    (1, 43, "and continues at the margin."),             # 1
    (1, 53, "The quoted passage begins here"),           # 2: the run
    (1, 53, "and continues in lower case,"),             # 3
    (1, 53, "ending where the printer ended it."),       # 4
    (1, 43, "The paragraph resumes at the margin."),     # 5
    (1, 43, "More margin prose to anchor the mode."),    # 6
    (1, 43, "And more, so the margin wins the count."),  # 7
    (1, 53, "One short indented paragraph."),            # 8: two openings in a row --
    (1, 53, "Another short indented paragraph."),        # 9: no lowercase evidence
]
check("the run is marked, the paragraph openings are not",
      mark_displayed_quotes(FLOW), {2, 3, 4})
check("  a single indented line is never a quotation",
      mark_displayed_quotes(FLOW[:2] + FLOW[5:8]), set())

BANDS = {"margin": 43, "display": None, "paragraph": 53, "hanging": None}
rows4 = [r + ((i in {2, 3, 4}),) for i, r in enumerate(FLOW)]
bl = to_blocks(rows4, BANDS, {}, None)
kinds = [b["kind"] for b in bl]
check("the run becomes ONE quote block", kinds.count("quote"), 1)
check("  carrying the whole quotation",
      [b["text"] for b in bl if b["kind"] == "quote"],
      ["The quoted passage begins here and continues in lower case, "
       "ending where the printer ended it."])
after = bl[[i for i, b in enumerate(bl) if b["kind"] == "quote"][0] + 1]
check("  and the resuming paragraph is NOT merged into it",
      after["text"].startswith("The paragraph resumes"), True)

print("hanging_blocks (a bibliography's inverted indent)")
from pdf_to_source import hanging_blocks                                      # noqa: E402
BIB = [
    (23, 43, "Catherine M. Bell, Ritual (New York, NY: Oxford"),
    (23, 53, "University Press, 2009)."),
    (23, 43, "Daniel A. Bell and Wang Pei, Just Hierarchy (Princeton, NJ: Princeton"),
    (23, 53, "University Press, 2020)."),
    (24, 66, "David Miller, Strangers in Our Midst (Cambridge, MA: Harvard"),   # verso:
    (24, 76, "University Press, 2016)."),                                       # margin 66
    (24, 66, "Iris Murdoch, The Sovereignty of the Good (London: Routledge)."),
]
hb = [b["text"] for b in hanging_blocks(BIB)]
check("each entry is one block, ended by the next entry's margin line",
      hb, ["Catherine M. Bell, Ritual (New York, NY: Oxford University Press, 2009).",
           "Daniel A. Bell and Wang Pei, Just Hierarchy (Princeton, NJ: Princeton "
           "University Press, 2020).",
           "David Miller, Strangers in Our Midst (Cambridge, MA: Harvard "
           "University Press, 2016).",
           "Iris Murdoch, The Sovereignty of the Good (London: Routledge)."])

print("join_spans (superscript footnote markers)")


def spans(*pairs):
    return [dict(text=t, size=z) for t, z in pairs]


# THE ONLY HONEST SIGNAL IS THE SPAN'S SIZE. By the time the line is a string, a marker is a bare
# digit welded to the preceding word -- `following:1` -- and indistinguishable from the last digit
# of a year. A text-level rule that matches digits against note numbers turned 1963 into 196[^3],
# 2026 into 202[^6], and a DOI's 10946 into 1094[^5]. Those are the cases below.
check("a smaller digit after the body text is a marker",
      join_spans(spans(("of thought.", 7.97), ("1", 5.98))), "of thought.[^1]")
check("  a two-digit marker too",
      join_spans(spans(("Zeman,", 7.97), ("12", 5.98))), "Zeman,[^12]")
check("a year in one span is never split",
      join_spans(spans(("Gettier 1963 was the year", 7.97))), "Gettier 1963 was the year")
check("  nor a year that happens to be its own span at body size",
      join_spans(spans(("Gettier ", 7.97), ("1963", 7.97))), "Gettier 1963")
check("  and a four-digit superscript is not a marker",
      join_spans(spans(("text", 7.97), ("1963", 5.98))), "text1963")
check("marking off leaves the line exactly as extracted",
      join_spans(spans(("of thought.", 7.97), ("1", 5.98)), mark_footnotes=False), "of thought.1")
check("a single span is never touched -- there is nothing to compare it with",
      join_spans(spans(("1", 5.98))), "1")
# A SUBSCRIPT IS SMALL AND LOWERED; a marker is small and raised (Valentino's "b1", 28 Sep 2026).
check("a small digit set below the line is a subscript, not a marker",
      join_spans([dict(text="where b", size=10.0, origin=(72, 500.0)),
                  dict(text="1", size=7.0, origin=(110, 502.5))]), "where b1")
check("  and one set above it is still a marker",
      join_spans([dict(text="as argued.", size=10.0, origin=(72, 500.0)),
                  dict(text="1", size=7.0, origin=(130, 496.0))]), "as argued.[^1]")

# THE NOTE'S OWN NUMBER AS A LINE OF ITS OWN. The extractor can hand a footnote's superscript
# number back as a separate line -- a different block, same baseline, a few points left of the
# note's text (the Wilson: `1` at 6.3pt, x0 75.8, y0 553.9; the text at 10pt, x0 92.1, y0
# 554.4). Neither line then opens a note, all eight merged into one paragraph, and no `[^n]:`
# definition was written. The weld has to happen while the geometry is still in hand.
print("join_note_numbers (a superscript number standing as its own line)")
from pdf_to_source import join_note_numbers                                  # noqa: E402


def line(text, x0, y0, size, width=None):
    w = width if width is not None else 5.2 * len(text) * size / 10
    return dict(x0=x0, y0=y0, x1=x0 + w, width=w, size=size, text=text)


page = [line("become ubiquitous even amongst their defenders.[^1]", 65.8, 457.1, 11.0),
        line("1", 75.8, 553.9, 6.3, width=3.5),
        line("For one recent representative, much discussed example, see Heller", 92.1, 554.4, 10.0),
        line("(2023).", 65.8, 565.4, 10.0)]
got = [l["text"] for l in join_note_numbers(page)]
check("the number is welded onto the note's first line",
      got[1], "1 For one recent representative, much discussed example, see Heller")
check("  and the number's own line is gone", len(got), 3)
check("  the body line before it is untouched", got[0].endswith("defenders.[^1]"), True)
check("  and the note now opens as note 1", note_opening(got[1])[0], "1")
# A reference mark split off the END of a body line sits to the RIGHT of its text: not a note.
split_mark = [line("even amongst their defenders.", 65.8, 457.1, 11.0, width=200),
              line("1", 268.0, 456.6, 6.3, width=3.5)]
check("a mark to the right of its line is left alone",
      [l["text"] for l in join_note_numbers(split_mark)], ["even amongst their defenders.", "1"])
# A lone paragraph number in a judgment's margin is body-sized: not a superscript, not a note.
para = [line("12", 30.0, 300.0, 11.0, width=12), line("The claimant contends that", 60.0, 300.0, 11.0)]
check("a body-sized number beside its paragraph is left alone",
      [l["text"] for l in join_note_numbers(para)], ["12", "The claimant contends that"])
# Same baseline, other column: too far away to be this line's number.
far = [line("3", 40.0, 500.0, 6.3, width=3.5), line("A second-column line", 320.0, 500.4, 10.0)]
check("a number a column away is left alone",
      [l["text"] for l in join_note_numbers(far)], ["3", "A second-column line"])

# THE LICENCE BLOCK, AND THE DOI ON THE OPENER'S OWN BASELINE. CUP prints `doi:…` to the LEFT
# of `© The Author(s)` on the same line, so it precedes the opener in reading order and a
# forward-only latch never saw it; it became the first line of the notes paragraph.
print("licence_lines (the copyright latch, with the line beside the opener)")
from pdf_to_source import licence_lines                                      # noqa: E402
first_page = [line("pretation, criticism and argument. In Williams’s words, viewing", 42.8, 503.3, 11.0),
              line("doi:10.1017/S0031819126101314", 42.8, 544.1, 8.5),
              line("© The Author(s), 2026. Published by Cambridge", 179.8, 544.1, 8.5),
              line("University Press on behalf of The Royal Institute of Philosophy. This is an Open", 42.8, 556.0, 8.5),
              line("re-use, distribution and reproduction, provided the original article is properly cited.", 42.8, 591.9, 8.5),
              line("Philosophy 101 2026", 42.8, 603.1, 10.0),
              line("A body-sized line releases the latch.", 42.8, 620.0, 11.0)]
drop = licence_lines(first_page, 11.0)
# The journal-volume line rides with the block: at 10pt under an 11pt body it is apparatus,
# and the latch holds until a BODY-sized line, exactly as the call site's note says.
check("the opener and the small lines after it are dropped",
      [l["text"][:12] for l in first_page if id(l) in drop],
      ["doi:10.1017/", "© The Author", "University P", "re-use, dist", "Philosophy 1"])
check("  the DOI beside the opener goes with it, though it comes first",
      any(l["text"].startswith("doi:") for l in first_page if id(l) in drop), True)
check("  the body line above stands, and a body-sized line below releases the latch",
      [l["text"][:10] for l in first_page if id(l) not in drop], ["pretation,", "A body-siz"])
check("a page with no opener drops nothing", licence_lines(first_page[:1], 11.0), set())

print("heading_gaps")
check("a complete sequence has no gaps", heading_gaps(["1. Intro", "2. Middle", "3. End"]), [])
check("a torn conversion is reported", heading_gaps(["1. Intro", "3. End"]), [2])
check("subsection numbers are not top-level", heading_gaps(["1. Intro", "1.1. Sub", "2. Next"]), [])
check("one heading cannot show a gap", heading_gaps(["3. Only"]), [])

# ---- the publisher's access stamps --------------------------------------------------- #
# NOT A TIDINESS FEATURE. These lines carry the DOWNLOADER'S IDENTITY, and a reconstruction is
# built to be shared with the manuscript inside it — so leaving one in tells every reader of
# every map which institution's subscription the paper came through. The check that matters most
# is the last one: blanking must not DELETE the line, because a claim's position in the
# manuscript is found by line and everything below a deleted line moves up.
print("publisher access stamps")
from ingest import strip_access_stamps                                       # noqa: E402

STAMPED = "\n".join([
    "The Tortoise said to Achilles that he would not accept it.",
    "Downloaded from academic.oup.com/mind/article/104/416/691/1 by "
    "A University Library user on 20 August 2026",
    "This content downloaded from 144.82.114.32 on Wed, 20 Aug 2026 09:12:44 UTC",
    "All use subject to https://about.jstor.org/terms",
    "Downloaded by [A University] at 03:12 20 August 2026",
    "Brought to you by | Some Other University",
    "And so the argument went on for ever.",
])
out, removed = strip_access_stamps(STAMPED)
check("every stamp is found", len(removed), 5)
check("  and no line is lost", len(out.splitlines()), len(STAMPED.splitlines()))
check("  the article's own first line is untouched",
      out.splitlines()[0], "The Tortoise said to Achilles that he would not accept it.")
check("  and its last", out.splitlines()[-1], "And so the argument went on for ever.")
check("  no institution name survives",
      [l for l in out.splitlines() if "Universit" in l], [])
check("prose that merely mentions downloading is left alone",
      strip_access_stamps("The data were downloaded from a public archive by the authors.")[1], [])

# ----------------------------------------------------------------- the abstract ---- #
# IT WAS ALWAYS FOUND AND ALWAYS THROWN AWAY. `find_boundaries` reads the front matter in order
# to CUT it, so the abstract's position was already known; everything before the cut was then
# discarded, abstract included. It is the one paragraph written to say what the paper argues, and
# someone opening an unfamiliar map has nothing else that does.

from pdf_to_source import find_abstract, ABSTRACT_HEAD                       # noqa: E402


def frow(text, small=False):
    return (0, 30.0, 0.0, 10.0, text, 0, small)


# TWO LAYOUTS. A modern journal runs the word into the text; requiring the line to BE the word
# found nothing at all on those, which is how Etiévant came back with no abstract.
check("the word alone opens an abstract", bool(ABSTRACT_HEAD.match("Abstract")), True)
check("  spaced out, as papers set it", bool(ABSTRACT_HEAD.match("A B S T R A C T")), True)
check("  and run into the text, which is the common case",
      ABSTRACT_HEAD.match("Abstract: Vaccine safety programs").group(1),
      "Vaccine safety programs")

BODY = ("Vaccine safety surveillance programs monitor possible short-term rare adverse events "
        "following vaccination and usually have access only to data on vaccinated individuals.")
ROWS = [frow("Journal of Causal Inference 2026"), frow("Received December 19, 2024"),
        frow("Abstract: " + BODY), frow("We provide a complete formal treatment of the design."),
        frow("a footnote about funding", small=True),
        frow("Keywords: adverse events; causal inference"),
        frow("MSC 2020: 62D10"), frow("1 Introduction"), frow("Programs such as the VSD.")]

got = find_abstract(ROWS, 7, [10.0] * len(ROWS), 10.0)
check("the abstract starts on the line that names it", got.startswith("Vaccine safety"), True)
check("  and runs on into the next line",
      got.endswith("complete formal treatment of the design."), True)
# Keywords, a received date and an article-info block all follow an abstract and none is one.
check("  and stops at the next piece of apparatus", "Keywords" in got, False)
check("  ignoring apparatus-sized lines inside it", "funding" in got, False)

check("a paper with no abstract gets none",
      find_abstract([frow("1 Introduction"), frow("Programs such as the VSD.")], 1,
                    [10.0, 10.0], 10.0), None)
# A heading with nothing under it, or a stray line reading "abstract", is not an abstract.
check("  nor does a heading with nothing under it",
      find_abstract([frow("Abstract"), frow("1 Introduction")], 2, [10.0, 10.0], 10.0), None)

# AN ABSTRACT SET SMALLER THAN THE BODY, which is how CUP's Philosophy (and most journals)
# print it: every line of the Wilson's was apparatus-sized, the old "small means not the
# abstract" test skipped them all, and the paper's own statement of its thesis was lost.
# The lines share one shape; a first-page footnote at yet another size is still left out.
SMALL = [frow("Williams, Dewey, and the Nature of"), frow("JAMES WILSON"),
         frow("Abstract", small=True),
         frow("For Bernard Williams, ethical inquiry is fundamentally about sense-making: "
              "it starts from what we already care about, and is always local.", small=True),
         frow("What is required is less a shift from scientistic to humanistic conceptions "
              "of philosophy, than for philosophers working in value inquiry to better align "
              "their aspirations for theory with what it can actually deliver.", small=True),
         frow("1 Department of Philosophy, UCL", small=True),
         frow("1. Philosophy, Disciplines and Interdisciplinarity"),
         frow("Philosophy is the oldest academic discipline.")]
got = find_abstract(SMALL, 6, [18.0, 11.0, 9.0, 9.0, 9.0, 8.0, 11.0, 11.0], 11.0)
check("an abstract set smaller than the body is still found",
      got is not None and got.startswith("For Bernard Williams"), True)
check("  whole, to its last sentence", got.endswith("what it can actually deliver."), True)
check("  without the affiliation footnote of yet another size", "Department" in got, False)

# ------------------------------------------------------ a structured abstract ---- #
# NO "ABSTRACT" TO FOLLOW. Trial reports (BMJ, Lancet, JAMA, PLOS Medicine) print the abstract
# as labelled sections -- OBJECTIVE, DESIGN, ... RESULTS, CONCLUSION -- often with no word
# "Abstract" over it, and the front cut lands on the first label because a caps line at the
# margin is what a heading looks like. On Clemson et al. 2026 (BMJ) the report said "front
# matter was cut but no abstract was found" and the app offered no Abstract fold.

from pdf_to_source import abstract_label, find_structured_abstract, STRUCTURED_STOP  # noqa: E402

check("a caps label alone on its line is a label", abstract_label("OBJECTIVE"), "OBJECTIVE")
check("  and run into the text in capitals",
      abstract_label("RESULTS Between two dates, forty people"), "RESULTS")
check("  and before a colon, in any case", abstract_label("Background: Falls are common"),
      "Background")
check("  and compound, as JAMA prints them",
      abstract_label("DESIGN, SETTING, AND PARTICIPANTS This cohort study"),
      "DESIGN, SETTING, AND PARTICIPANTS")
check("  and PLOS's whole-line form", abstract_label("Methods and findings"),
      "Methods and findings")
# BMJ's 2019 house style sets the labels in title case, whole-line: "Main outcome measures"
# matched only as far as "Main outcome", and with "measures" left over it was not a label at all.
check("  and BMJ's title-case 'Main outcome measures'", abstract_label("Main outcome measures"),
      "Main outcome measures")
# The words are ordinary English; how the line is SET is what makes a label.
check("prose opening with a label word is not a label",
      abstract_label("Results of the survey were mixed"), None)
check("  nor a wrapped line in lower case", abstract_label("methods"), None)
check("  nor a longer word that begins with one", abstract_label("DESIGNER NOTES"), None)
check("the trial registration is a stop, not a label",
      (abstract_label("TRIAL REGISTRATION"), bool(abstract_label("TRIAL REGISTRATION",
                                                                 STRUCTURED_STOP))),
      (None, True))


def srow(text, x=141.0, page=1, col=0):
    return (page, x, 0.0, 10.0, text, col, False)


# RUN-IN LABELS, the Lancet/PLOS form, with a funding line after: kept to the conclusion.
RUNIN = [srow("A trial of something", x=141), srow("Background: Falls are common after a "
                                                   "stroke and cost the health service a great "
                                                   "deal every year."),
         srow("Methods: We randomly assigned two hundred people to one of two arms."),
         srow("Findings: The rate of falls was lower in the intervention arm."),
         srow("Interpretation: A tailored programme can prevent falls."),
         srow("Funding: A national research council."),
         srow("Introduction"), srow("Falls are common.")]
got = find_structured_abstract(RUNIN, 6, [10.0] * len(RUNIN))
check("run-in labels make a structured abstract",
      got is not None and got.startswith("Background: Falls"), True)
check("  ending at its conclusion, before the funding line",
      got.endswith("can prevent falls."), True)
# A PAPER'S OWN SECTIONS carry the same words. Background and Methods with no results or
# conclusion label is an article opening, not an abstract, and the prose reading is left to it.
OWN = [srow("BACKGROUND"), srow("Falls are common after a stroke and cost a great deal."),
       srow("METHODS"), srow("We randomly assigned two hundred people to one of two arms "
                             "and followed them for a year to count their falls.")]
check("the article's own Background and Methods are not an abstract",
      find_structured_abstract(OWN, 0, [10.0] * len(OWN)), None)
# A label seen twice is the article's own section, and ends the abstract there.
TWICE = RUNIN[:5] + [srow("Results: this must not be read as the abstract's."),
                     srow("Background: the article's own first section begins here.")]
got = find_structured_abstract(TWICE, 0, [10.0] * len(TWICE))
check("a label seen a second time ends it", "own first section" in (got or ""), False)
# The run must open no later than the article's detected start. (AT it is allowed: that is
# where the front cut lands when it mistakes the first caps label for a heading.)
check("  and labels after the article's start are the article's",
      find_structured_abstract([srow("A title"), srow("Some prose opens the paper.")]
                               + RUNIN[1:5], 1, [10.0] * 6) is not None, False)
check("  but a run the front cut landed on is still the abstract",
      find_structured_abstract([srow("A title")] + RUNIN[1:5], 1, [10.0] * 5) is not None,
      True)

# EACH WAY IT CAN END, ALONE. Labels set larger than their text (9pt over 8pt) so that keeping
# them is the labels' doing and not their size's, and no registration line, so the ending under
# test is the only one there is.
LAB = [("A title", 14.0), ("OBJECTIVE", 9.0),
       ("To test whether a home programme works for people after a stroke.", 8.0),
       ("RESULTS", 9.0), ("Falls were fewer by a third in the arm that had the programme.", 8.0),
       ("CONCLUSION", 9.0), ("The programme prevented falls in people at home after a stroke.",
                             8.0)]
AFTER = ("Prose that follows the abstract and is not the abstract's own.", 8.0)


def labelled(extra=()):
    spec = LAB + list(extra)
    rows = [srow(s[0], page=s[2] if len(s) > 2 else 1) for s in spec]
    return find_structured_abstract(rows, 0, [s[1] for s in spec]) or ""


got = labelled()
check("labels set larger than their text are kept in it",
      [lab for lab in ("OBJECTIVE", "RESULTS", "CONCLUSION") if lab not in got], [])
check("a line of another size inside the column is not the abstract's",
      "stamp" in labelled([("a download stamp in the margin", 6.0)]), False)
check("it ends at a caps heading that is not a label",
      "not the abstract's" in labelled([("WHAT THIS STUDY ADDS", 8.0), AFTER]), False)
check("  and at the article's Introduction",
      "not the abstract's" in labelled([("Introduction", 8.0), AFTER]), False)
check("  and at prose set larger than its labels",
      "larger" in labelled([("Article prose set larger than the abstract begins here and runs "
                             "on.", 10.0)] * 4), False)
check("  and it does not run on past the next sheet",
      "not the abstract's" in labelled([AFTER[:2] + (3,)]), False)
# Elsevier prints its copyright line in the abstract's column, at its size, after the
# conclusion; on Zahl et al. 2024 it ran on as the abstract's last sentence.
check("  and at the publisher's copyright line",
      "Published by" in labelled([("© 2023 The Author(s). Published by an imagined "
                                   "press on behalf of a society.", 8.0)]), False)
# Social Science & Medicine opens on "Rationale:"; without it Harari and Lee lost a section.
check("Social Science & Medicine's 'Rationale:' opens one",
      abstract_label("Rationale: Quantitative research has"),
      "Rationale")
# Boaz et al. 2015: the article opens on "BACKGROUND" right after an abstract that had none.
check("a bare label after the conclusion is the article's heading, not the abstract's",
      labelled([("BACKGROUND", 9.0)]).endswith("after a stroke."), True)
# Run-in labels make their whole line as large as the bold label, and the article's body can be
# that size too (Boaz et al. 2015: 10pt label lines, 9pt text, a 10pt article after it).
RUN10 = [srow("Objective: To test whether a home programme works."),
         srow("for people after a stroke, in a trial of two arms."),
         srow("Results: Falls were fewer by a third with the programme."),
         srow("Conclusions: The programme prevented falls in people."),
         srow("at home after a stroke."), srow("BACKGROUND"),
         srow("Article prose begins here, set as large as the labels."),
         srow("and runs on for the rest of the page.")]
got = find_structured_abstract(RUN10, 0, [10.0, 9.0, 10.0, 10.0, 9.0, 10.0, 10.0, 10.0]) or ""
check("the article's body, as large as run-in label lines, is not the abstract's",
      (got.endswith("at home after a stroke."), "Article prose" in got), (True, False))
# WHERE THE ARTICLE STARTS is where the abstract ended, or the next heading past apparatus.
from pdf_to_source import read_structured_abstract                            # noqa: E402

rows = [srow(s[0]) for s in LAB] + [srow("Introduction"), srow(AFTER[0])]
check("an abstract ended by the article's heading puts the cut on that heading",
      read_structured_abstract(rows, 0, [s[1] for s in LAB] + [8.0, 8.0])[1], len(LAB))
rows = [srow(s[0]) for s in LAB] + [srow("BACKGROUND"), srow(AFTER[0])]
check("  and a bare label left over is that heading (Boaz: the article set larger)",
      read_structured_abstract(rows, 0, [s[1] for s in LAB] + [9.0, 10.0])[1], len(LAB))
# Past apparatus to the next heading -- in any column, since Elsevier sets the abstract right of
# the article-info block and "Introduction" back at the margin (Zahl et al. 2024).
rows = ([srow(s[0], x=203) for s in LAB]
        + [srow("\u00a9 2023 The Author(s). Published by an imagined press.", x=203),
           srow("a margin line set large", x=500), srow("1. Introduction", x=37),
           srow(AFTER[0], x=37)])
check("past the copyright line, the cut is the next heading, whatever its column",
      read_structured_abstract(rows, 0, [s[1] for s in LAB] + [8.0, 12.0, 8.0, 8.0])[1],
      len(LAB) + 2)
# BMJ prints the registry number on a line of its own: capitals, but no heading.
rows = ([srow(s[0]) for s in LAB] + [srow("TRIAL REGISTRATION"), srow("ACTRN00000000000000."),
                                     srow("Introduction", x=141), srow(AFTER[0])])
check("  and a registry number is not that heading",
      read_structured_abstract(rows, 0, [s[1] for s in LAB] + [9.0, 8.0, 8.5, 8.0])[1],
      len(LAB) + 2)
check("  nor is the abstract's own text, however it is set, in the abstract's column",
      read_structured_abstract([srow(s[0]) for s in LAB]
                               + [srow("TRIAL REGISTRATION"), srow("A registry, 2019."),
                                  srow("Article prose set larger.")], 0,
                               [s[1] for s in LAB] + [9.0, 8.0, 10.0])[1], len(LAB) + 2)
from pdf_to_source import past_structured_abstract                           # noqa: E402

check("the front cut moves past a structured abstract",
      past_structured_abstract(8, 400, 500, ("an abstract", 122)), 122)
check("  but never back from a cut already past it",
      past_structured_abstract(40, 400, 500, ("an abstract", 30)), 40)
check("  nor to where it would leave almost nothing of the article",
      past_structured_abstract(8, 150, 500, ("an abstract", 122)), 8)
check("  and with no abstract, or no word on where it ended, the cut is as it was",
      (past_structured_abstract(8, 400, 500, None),
       past_structured_abstract(0, 400, 500, ("an abstract", None))), (8, None))
# A line of data inside the abstract has a numbered heading's shape; it is not the article.
rows = ([srow(s[0]) for s in LAB[:3]] + [srow("PARTICIPANTS"),
                                         srow("5325 Scottish households, 54 807 English"),
                                         srow("households as controls.")]
        + [srow(s[0]) for s in LAB[3:]] + [srow("Introduction")])
got = read_structured_abstract(rows, 0, [s[1] for s in LAB[:3]] + [9.0, 8.0, 8.0]
                               + [s[1] for s in LAB[3:]] + [8.0])
check("a line of data that looks like a numbered heading does not end the abstract",
      (got[0].endswith("after a stroke."), got[1]), (True, len(rows) - 1))
# Autism in Adulthood: keywords, a lay summary, then "Background" set small over a drop cap.
rows = ([srow(s[0]) for s in LAB] + [srow("Keywords: falls, stroke"), srow("Community Brief"),
                                     srow("A lay summary of the study."), srow("Background"),
                                     srow("\u2018\u2018W"), srow(AFTER[0])])
check("past the keywords, a label word standing alone is the article's first heading",
      read_structured_abstract(rows, 0, [s[1] for s in LAB] + [8.0, 6.0, 8.0, 6.0, 26.0, 8.0])[1],
      len(LAB) + 3)
check("an abstract the page ran out under says nothing about the cut",
      read_structured_abstract([srow(s[0]) for s in LAB], 0, [s[1] for s in LAB])[1], None)
check("two labels and a word each is not an abstract",
      find_structured_abstract([srow("RESULTS"), srow("None."), srow("CONCLUSION"),
                                srow("None.")], 0, [9.0, 8.0, 9.0, 8.0]), None)

# THE WHOLE CONVERTER, ON A PAGE SHAPED LIKE BMJ'S. The abstract runs in one column BESIDE the
# author affiliations (smaller, further left), with a "What is already known" box under it in
# the same page column; the text layer interleaves them line by line. No word "Abstract" at all.
# The wording is invented -- the fixture is the LAYOUT, not any paper's text.
import tempfile                                                               # noqa: E402
import pymupdf                                                                # noqa: E402
from pdf_to_source import Config, convert                                    # noqa: E402

PROSE = ("Falls are a frequent and costly event in later life, and people who have had a stroke "
         "fall more often than their peers of the same age. The programme tested here combines "
         "exercise woven into daily routines with a review of hazards in the home and coaching "
         "for getting about in the local area. Each part has been tried alone before and none "
         "has reduced falls on its own, which is the reason for testing them together here. ")


def wrap(text, width):
    out, line = [], ""
    for w in text.split():
        if line and len(line) + 1 + len(w) > width:
            out.append(line)
            line = w
        else:
            line = (line + " " + w).strip()
    return out + [line] if line else out


SECTIONS = [("OBJECTIVE", "To test whether a home exercise and safety programme reduces "
             "falls in people living at home after a stroke."),
            ("DESIGN", "Two armed, randomised trial with masked assessors."),
            ("SETTING", "Four community health services in two regions."),
            ("PARTICIPANTS", "Adults over fifty who had a stroke within the last five years "
             "and could walk ten metres with or without an aid."),
            ("INTERVENTION", "Six months of habit based exercise, a home hazard review, and "
             "coaching for community mobility; the control arm received usual care."),
            ("MAIN OUTCOME MEASURES", "The primary outcome was the rate of falls over one "
             "year.")]
RIGHT = [("RESULTS", "Two hundred people were enrolled. The rate of falls was a third lower "
          "in the intervention arm than in the control arm over the year of follow up."),
         ("CONCLUSION", "A tailored home programme prevented falls in people living at home "
          "after a stroke.")]
AFFIL = ["1 School of Health", "Sciences, An Imagined", "University, Somewhere", "2 Department of",
         "Rehabilitation, Another", "Imagined University", "Correspondence to: A Author",
         "Accepted: 01 March 2026", "Cite this as: an imagined", "journal 2026;1:e1"] * 3

doc = pymupdf.open()
p1 = doc.new_page(width=595, height=842)
p1.insert_text((141, 70), "A home exercise and safety programme after stroke", fontsize=17)
p1.insert_text((141, 115), "A Author, B Author, C Author", fontsize=11)
y = 183.0
for label, text in SECTIONS:
    for line in [label] + wrap(text, 44):
        p1.insert_text((141, y), line, fontsize=8.7)
        y += 11
for i, a in enumerate(AFFIL[:int((y - 170) / 9)]):
    p1.insert_text((34, 170 + 9 * i), a, fontsize=7.5)     # beside the abstract, interleaving
yb = 555.0
p1.insert_text((38, yb), "WHAT IS ALREADY KNOWN ON THIS TOPIC", fontsize=10)
for line in wrap("Nothing yet shown to work prevents falls after a stroke, and three earlier "
                 "trials of single measures found no effect on the rate of falls.", 70):
    yb += 12
    p1.insert_text((38, yb), line, fontsize=8.5)
y = 168.0
for label, text in RIGHT:
    for line in [label] + wrap(text, 44):
        p1.insert_text((360, y), line, fontsize=8.7)
        y += 11
for line in ["TRIAL REGISTRATION", "An imagined trials registry 000000001."]:
    p1.insert_text((360, y), line, fontsize=8.7)
    y += 11
y += 14
p1.insert_text((360, y), "Introduction", fontsize=9.5)
for line in wrap(PROSE * 3, 44):
    y += 11
    if y > 780:
        break
    p1.insert_text((360, y), line, fontsize=8.7)
for _ in range(3):
    pg = doc.new_page(width=595, height=842)
    lines = wrap(PROSE * 12, 44)
    for n, line in enumerate(lines[:120]):
        x, yy = (141, 70 + 11 * n) if n < 60 else (360, 70 + 11 * (n - 60))
        pg.insert_text((x, yy), line, fontsize=8.7)
with tempfile.TemporaryDirectory() as tmp:
    pdf = Path(tmp) / "trial.pdf"
    doc.save(pdf)
    report = convert(Config(pdf=pdf, out=Path(tmp) / "source" / "trial.md"))
    written = (Path(tmp) / "source" / "trial.md").read_text(encoding="utf-8")
got = report.get("abstract") or ""
check("a BMJ-shaped structured abstract with no 'Abstract' is found",
      got.startswith("OBJECTIVE To test whether a home exercise"), True)
check("  with its labels kept in the text",
      all(f" {lab} " in got for lab in ("DESIGN", "SETTING", "MAIN OUTCOME MEASURES",
                                        "RESULTS", "CONCLUSION")), True)
check("  across both columns, to the conclusion's last sentence",
      got.endswith("living at home after a stroke."), True)
check("  without the affiliations it was interleaved with",
      [w for w in ("School", "Imagined", "Correspondence", "Accepted") if w in got], [])
check("  or the box beside it", "ALREADY KNOWN" in got or "earlier trials" in got, False)
check("  and stops at the trial registration", "registry" in got, False)
check("  and it is written to the front matter", "\nabstract: >-\n  OBJECTIVE To test" in written,
      True)
# THE FRONT CUT GOES PAST IT, not onto its first label (the author's ruling, 26 Sep 2026). Cut
# at the label, the abstract stayed in the body as well, with DESIGN, SETTING and the rest
# promoted to headings of the article.
article = written.split("\n---\n", 1)[1]
article = "\n".join(l for l in article.splitlines()
                    if l.strip() and not l.startswith(("<!--", " ")) and "-->" not in l)
check("the article starts at its Introduction, past the abstract",
      article.startswith("Introduction Falls are a frequent"), True)
check("  with none of the abstract, its labels, or the registration left in the body",
      [w for w in ("OBJECTIVE", "# Design", "RESULTS", "A tailored home programme",
                   "TRIAL REGISTRATION", "registry", "Correspondence") if w in article], [])
check("  and the report counts the cut", report["boundaries_detected"]["front"] > 20, True)

# ------------------------------------------------------- a numbered paragraph ---- #
# A JUDGMENT IS CITED BY ITS PARAGRAPH NUMBER -- "Miller (No 2) at [50]" -- so losing the numbers
# loses the only address a claim in such a document has. All 71 were lost on the Miller, in FOUR
# different ways, and each had to be found separately because each hid the next:
#
#   1. a lone number matches no indent band, so it fell through to "merge into the previous
#      block" and was swallowed by the paragraph ABOVE the one it numbers;
#   2. a number opening a page is the page's first line and has no letters, so the running-head
#      test dropped it -- 8 of them;
#   3. a number low on a sheet normalises to "#" exactly as the printed page number does, so the
#      footer test dropped it -- 1 more;
#   4. "64. Article 9 provides:" has the shape of "2. Hume and abstraction", so a short numbered
#      paragraph was promoted to a section heading.
#
# What tells a paragraph number from a page number is that the paragraph's first line is BESIDE
# it, on the same line. What tells it from a heading is that it arrived as its own row.

from pdf_to_source import PARA_NUMBER, detect_furniture                      # noqa: E402

check("a margin paragraph number is recognised", bool(PARA_NUMBER.match("30.")), True)
check("  in either punctuation", bool(PARA_NUMBER.match("(4)")), True)
check("  and bare", bool(PARA_NUMBER.match("7")), True)
# Bounded at three digits so a year, a page range or a sum on a line of its own is not mistaken.
check("a year on its own line is not a paragraph number", bool(PARA_NUMBER.match("2019")), False)
check("prose is not", bool(PARA_NUMBER.match("30. It is important")), False)


def line(y, x, text, size=13.0):
    return dict(x0=x, y0=y, x1=x + 40, width=40, size=size, text=text)


# Miller's real geometry: numbers at the margin (x=72) with their prose beside them (x=108);
# the printed page number centred and alone (x=295, y=794) on a 842pt sheet.
PAGES = []
for n in range(4):
    PAGES.append(([line(70.8, 72, f"{n * 3 + 1}."),
                   line(70.8, 108, "The machinery for leaving the Union is contained"),
                   line(400.0, 72, f"{n * 3 + 2}."),
                   line(400.0, 108, "Parliamentary sittings are normally divided"),
                   line(738.0, 72, f"{n * 3 + 3}."),
                   line(738.0, 108, "Before considering the question of justiciability"),
                   line(794.0, 295, str(n + 3))], 842.0))

is_furniture, heads, footers = detect_furniture(PAGES)


def furniture_for(lines, height, want):
    """As `convert` calls it: `alone` says nothing is printed to the right on the same line."""
    for l in lines:
        if l["text"] != want:
            continue
        alone = not any(o is not l and abs(o["y0"] - l["y0"]) <= 0.6 * l["size"]
                        and o["x0"] > l["x0"] for o in lines)
        return is_furniture(l["text"], l["y0"], height, alone=alone)
    return "not found"


lines0 = PAGES[1][0]
check("the printed page number is still furniture", furniture_for(lines0, 842.0, "4"), "page number")
check("a paragraph number at the page TOP is not", furniture_for(lines0, 842.0, "4."), None)
check("  nor one at the page FOOT", furniture_for(lines0, 842.0, "6."), None)
check("  nor one in the middle", furniture_for(lines0, 842.0, "5."), None)

# ------------------------------------------------------------- where the article ends ---- #
# TWO FAULTS IN ONE LOOP, and together they cost 37% of the Dewey. `BACK_MATTER` matched the bare
# singular "reference", which on a scan whose OCR splits prose into short fragments leaves a line
# that IS that word; and the loop that used it had neither the "last third" bound its own comment
# claimed nor a `break`, so the EARLIEST match anywhere in the paper won. The output was
# well-formed Markdown and a third of the article simply was not in it.

from pdf_to_source import BACK_MATTER, find_boundaries                       # noqa: E402

check("a real bibliography heading is found", bool(BACK_MATTER.match("References")), True)
check("  in capitals too", bool(BACK_MATTER.match("REFERENCES")), True)
check("  and the other names for it", bool(BACK_MATTER.match("Bibliography")), True)
check("the bare singular is NOT a heading", bool(BACK_MATTER.match("reference")), False)
check("  which is what a fragmented 'with reference to' leaves behind",
      bool(BACK_MATTER.match("Reference")), False)
check("  and the phrase itself never matched", bool(BACK_MATTER.match("with reference to")), False)


def rows_with(*texts):
    """(printed, x0, y0, height, text, col, small) — only `text` matters to the back-matter scan."""
    return [(0, 30.0, float(i), 10.0, t, 0, False) for i, t in enumerate(texts)]


# A false match in the FIRST two-thirds must not cut the article at all.
early = rows_with(*(["body text"] * 20 + ["reference"] + ["body text"] * 40))
check("a stray match early in the paper does not end the article",
      find_boundaries(early, 30, 10, [10] * len(early))[1], len(early))

# A real heading in the last third does end it, at the heading.
late = rows_with(*(["body text"] * 40 + ["References"] + ["Smith, J. (1999)."] * 8))
check("a bibliography in the last third ends the article there",
      find_boundaries(late, 30, 10, [10] * len(late))[1], 40)

# Two back-matter headings: the article ends at the EARLIER of them.
both = rows_with(*(["body text"] * 40 + ["Acknowledgements"] + ["Thanks."] * 3
                   + ["References"] + ["Smith, J. (1999)."] * 8))
check("  and at the first of two, not the last",
      find_boundaries(both, 30, 10, [10] * len(both))[1], 40)

# ------------------------------------------------------------------ reading order ---- #
# SORTING BY y0 ALONE IS NOT READING ORDER. A typesetter's line is one `y`; an OCR'd line is a
# row of word-fragments each carrying its own baseline. On the Dewey those spread 3.5pt within
# one printed line -- wider than the gap between successive `y` values -- so the extractor's own
# order survived and the article came out interleaved right-to-left. Two of 169 sentences
# verified. Valid Markdown, every word present, and unreadable.

from pdf_to_source import reading_order                                      # noqa: E402


def frag(y, x, text, size=7.5):
    return dict(y0=y, x0=x, x1=x + 40, width=40, size=size, text=text)


# The real geometry, from page 3 of the Dewey: one printed line whose fragments span 3.5pt,
# followed by the next line 9.6pt below.
SCAN = [frag(64.08, 156.9, "is looking, and not a"),
        frag(65.14, 74.9, "act of seeing;"),
        frag(65.29, 31.6, "with the"),
        frag(65.58, 261.2, "sensation of"),
        frag(67.62, 145.6, "it"),
        frag(75.11, 65.7, "The sensory quale gives the value")]

check("a scanned line is read left to right, not by baseline",
      [l["text"] for l in reading_order(SCAN)],
      ["with the", "act of seeing;", "it", "is looking, and not a", "sensation of",
       "The sensory quale gives the value"])
check("  and the next printed line stays after it, not merged into the band",
      reading_order(SCAN)[-1]["text"], "The sensory quale gives the value")

# A clean digital PDF has no jitter: every line is its own band and nothing moves.
CLEAN = [frag(100.0, 72.0, "First line."), frag(112.0, 72.0, "Second line."),
         frag(124.0, 72.0, "Third line.")]
check("a clean PDF is left exactly as it was",
      [l["text"] for l in reading_order(CLEAN)],
      ["First line.", "Second line.", "Third line."])

# The band must not swallow a genuine next line. 9.6pt advance against 7.5pt glyphs gives a
# 4.5pt tolerance, so two lines one advance apart stay apart.
TIGHT = [frag(100.0, 200.0, "b"), frag(104.6, 72.0, "next line")]
check("two lines a full advance apart are not banded together",
      [l["text"] for l in reading_order(TIGHT)], ["b", "next line"])

check("no lines is not an error", reading_order([]), [])

# --------------------------------------------------------------- de-hyphenation ---- #
# WHICH HYPHEN IS THE TYPESETTER'S. Two conventions mark a word broken across a printed line:
# U+00AD SOFT HYPHEN in a modern PDF, and a bare ASCII hyphen in an older scan whose text layer
# predates the convention. Joining on the wrong one is silent either way -- an unjoined break
# leaves "estab- lished", and a wrongly joined compound leaves "wellestablished".
#
# The rule USED to be `any soft hyphen anywhere`, which a single pasted passage could satisfy.
# These hold the comparison that replaced it, and the welding it is there to prevent.

from pdf_to_source import dehyphenate, trust_soft_hyphens as rule           # noqa: E402

check("a document with no soft hyphens uses the blunt rule", rule(0, 40), False)
check("  and one that breaks its lines with soft hyphens trusts them", rule(86, 0), True)
check("a handful of soft hyphens does NOT outvote a hundred ASCII breaks",
      rule(4, 114), False)
check("  which is the case that produced a hundred broken words", rule(4, 114), False)
check("the tie goes to soft, because welding is the worse failure", rule(5, 5), True)
check("no hyphens of either kind is not a soft document", rule(0, 0), False)

check("the soft rule joins a soft break",
      dehyphenate("estab\u00ad lished", True), "established")
check("  and leaves a real compound alone",
      dehyphenate("well-established", True), "well-established")
# The compound's own hyphen at a line end stays, and since 7 Oct 2026 the gap closes too: "well-
# established" had kept the line break's space, so "most cost- effective" never verified (Wilson 2023).
check("  including one that falls at a line end",
      dehyphenate("well- established", True), "well-established")
check("the blunt rule joins a line-end ASCII break",
      dehyphenate("estab- lished", False), "established")
check("  and that is exactly why it must not be used on a soft document",
      dehyphenate("well- established", False), "wellestablished")

# THE DOCUMENT'S OWN EVIDENCE. Measured on Robeyns -- 95,478 words, no soft hyphens, so the blunt
# branch runs over the whole book -- the rule welded `wellknown`, `nonideal` and `decisionmaking`.
# Each of those compounds is written WITH its hyphen elsewhere in the same book, mid-line, where
# no line break can be responsible. Collecting those pairs first prevents all three.
from pdf_to_source import keep_hyphen                                        # noqa: E402

BOOK = "It is a well-known result. Non-ideal theory and decision-making both matter."
keep = keep_hyphen(BOOK)
check("compounds written mid-line are collected", ("well", "known") in keep, True)
check("  and a break is NOT mistaken for one", ("con", "trolling") in keep_hyphen("con-\n\ntrolling"), False)

check("a compound the document hyphenates keeps its hyphen at a break",
      dehyphenate("a well- known result", False, keep), "a well-known result")
check("  and so does one seen only in another sentence",
      dehyphenate("in decision- making", False, keep), "in decision-making")
check("an ordinary broken word is still joined",
      dehyphenate("estab- lished", False, keep), "established")
check("  and a pair the document never hyphenates is joined too",
      dehyphenate("con- trolling", False, keep), "controlling")
check("case does not defeat it", dehyphenate("A Well- Known result", False, keep),
      "A Well-Known result")

# THE ZOTERO KEY IS IN THE PATH, or it is nowhere. A PDF converted out of Zotero's storage
# carries its attachment key as a path segment, and that key is how the desktop viewer asks
# Zotero for the reader's own highlights on exactly this file (docs/ANNOTATIONS-PLAN.md).
# Anything that is not a storage path yields no key rather than a guess.
from pdf_to_source import zotero_key_of                                      # noqa: E402

check("a storage path yields its attachment key",
      zotero_key_of("/Users/x/Zotero/storage/AB12CD34/paper.pdf"), "AB12CD34")
check("  and Windows separators too",
      zotero_key_of(r"C:\Users\x\Zotero\storage\AB12CD34\paper.pdf"), "AB12CD34")
check("an ordinary path yields none",
      zotero_key_of("/Users/x/Documents/paper.pdf"), None)
check("a lowercase segment is not a key",
      zotero_key_of("/x/storage/ab12cd34/paper.pdf"), None)
check("a nine-character segment is not a key",
      zotero_key_of("/x/storage/AB12CD345/paper.pdf"), None)


print("a paragraph across a page break, converted whole")
# End to end, since `split_at_pages` alone passed while the emitting loop still printed each block
# whole: the marker must stand where the new page begins, not after the paragraph.
doc = pymupdf.open()
first = ("Ten sentences of ordinary prose run down this page and the last of them does not end "
         "here but goes on over the page break into the next sheet where") 
second = ("the sentence ends at last. A second sentence follows it on the new page, and then the "
          "paragraph closes.")
for n, part in enumerate((first * 6, second)):
    pg = doc.new_page(width=595, height=842)
    for k, line in enumerate(wrap(part, 70)):
        pg.insert_text((72, 100 + 14 * k), line, fontsize=10)
with tempfile.TemporaryDirectory() as tmp:
    pdf = Path(tmp) / "break.pdf"
    doc.save(pdf)
    convert(Config(pdf=pdf, out=Path(tmp) / "source" / "break.md"))
    written = (Path(tmp) / "source" / "break.md").read_text(encoding="utf-8")
body = written[written.index("p.1 begins here"):]
check("the p.2 marker comes before the words printed on p.2",
      body.index("p.2 begins here") < body.index("the sentence ends at last"), True)
check("  and after the words printed on p.1", body.index("into the next sheet where") <
      body.index("p.2 begins here"), True)


print("\nthe Sewell fixes (AJS 1992 through JSTOR, 2 Oct 2026)")
from pdf_to_source import (is_cover_sheet, opens_note, title_heading_map,          # noqa: E402
                           HEADING_RUNS_ON, dash_words, dehyphenate, LICENCE, IMPRINT_SHAPE)

def nrow(x0, y0, text, small=False, printed=1):
    return (printed, x0, y0, H, text, 0, small)


COVER = ("A Theory of Structure: Duality, Agency, and Transformation\nAuthor(s): A. Author\n"
         "Source: An Imagined Journal, Vol. 98, No. 1 (Jul., 1992), pp. 1-29\n"
         "Published by: An Imagined Press\nStable URL: https://www.jstor.org/stable/0000000\n"
         "Accessed: 05-09-2021 09:10 UTC\nJSTOR is a not-for-profit service that helps scholars ...\n"
         "Your use of the JSTOR archive indicates your acceptance of the Terms & Conditions of Use")
# Mutation: drop the cover test from convert -> "Published by:" opens the front-matter cut again.
check("a repository cover sheet is recognised", is_cover_sheet(COVER), True)
check("  but not an article page carrying only the download footer",
      is_cover_sheet("Body prose of the article. " * 40 + "This content downloaded from 1.2.3.4 on Sun"),
      False)

# A superscript 1 read as an apostrophe keys the first note, as an asterisk does.
# Mutation: take the apostrophe out of STAR_NOTE -> the acknowledgements stay in the sentence.
check("a first note keyed by a misread superscript 1 opens the note zone",
      opens_note(nrow(54, 600, "' This article has benefited from many readers.", small=True), 60, 0.70, 54),
      True)
check("  but a body line opening with an apostrophe does not",
      opens_note(nrow(54, 300, "' This sentence is body prose.", small=False), 60, 0.70, 54), False)

# A small quotation ending just above the notes is not a note carried over.
# Mutation: drop indented_past from the walk -> the quotation's last lines go into note 8.
quoted = [nrow(54, 300, "As Bourdieu puts it, in his characteristically ornate style,"),
          nrow(77, 415, "The mental structures which construct the world of objects", small=True),
          nrow(77, 435, "structures. The mind born of the world of objects does not", small=True),
          nrow(77, 445, "tivity confronting an objectivity: the objective universe is", small=True),
          nrow(54, 479, "8 Some of Bourdieu's more recent work deals with change.", small=True),
          nrow(54, 490, "study of the French professoriat in the events of 1968.", small=True)]
fq, nq = split_footnotes(quoted, 77, margin=54)
check("a display quotation set as small as the notes stays in the flow",
      ([t[:12] for _p, _x, t in fq], [t[:12] for _p, _x, t in nq]),
      (["As Bourdieu ", "The mental s", "structures. ", "tivity confr"], ["8 Some of Bo", "study of the"]))
carried = [nrow(54, 420, "and the runover of a note from the page before.", small=True)] + quoted[4:]
check("  while a note carried over at the notes' own edge is still lifted",
      len(split_footnotes([nrow(54, 300, "Body.")] + carried, 77, margin=54)[1]), 3)

# The paragraph that resumes after a quotation opens at the paragraph indent, off the margin too.
# Mutation: drop the shared-edge test -> "In many respects" joins the blockquote.
RESUME = [(15, 56, "Margin prose to anchor the page's margin here."),
          (15, 56, "More margin prose, so the margin wins the count."),
          (15, 79, "jects which are the product of objectifying operations"),
          (15, 79, "to the very structures which the mind applies to it."),
          (15, 79, "reflecting metaphors. [Bourdieu 1977, p. 91]"),
          (15, 66, "In many respects, Bourdieu's theory of practice is"),
          (15, 56, "with the conception of the duality of structure for"),
          (15, 56, "this paper. Bourdieu recognizes the mutual reproduction")]
check("a quotation's run ends where its left edge does", mark_displayed_quotes(RESUME), {2, 3, 4})

# A capitals heading under the running head is a heading, not a second head.
# Mutation: drop the topmost test -> "VARIETIES OF STRUCTURES" is dropped as a running head.
caps_page = ([dict(text="American Journal of Sociology", y0=52, x0=58, x1=180, width=122, size=8.0),
              dict(text="VARIETIES OF STRUCTURES", y0=76, x0=57, x1=180, width=123, size=9.0),
              dict(text="The concept of structure I elaborate in this article is", y0=89, x0=57,
                   x1=335, width=278, size=8.0)], 666.0)
aj_page = ([dict(text="American Journal of Sociology", y0=52, x0=58, x1=180, width=122, size=8.0),
            dict(text="Body prose of an ordinary page of the article.", y0=76, x0=57, x1=335,
                 width=278, size=8.0)], 666.0)
is_f, _h, _f = detect_furniture([head_sheet(), caps_page, aj_page, aj_page])
check("a capitals heading under the page's running head is not furniture",
      (is_f("VARIETIES OF STRUCTURES", 76, 666.0), is_f("American Journal of Sociology", 52, 666.0)),
      (None, "running head"))

# Title-case subheadings, set at body size and flush, with space above.
# Mutation: return {} from title_heading_map -> they run into the paragraph below.
def trow(page, y, text, small=False):
    return (page, 56, y, 666.0, text, 0, small)
SUBS = [trow(5, 240, "of the social sciences that historians do in"),
        trow(5, 252, "practice, and historical anthropologists as well."),
        trow(5, 288, "What Is Structure?"),
        trow(5, 300, "But in spite of its promise, the theory suffers"),
        trow(5, 312, "from serious gaps that have persisted through the"),
        trow(5, 324, "theory's restatements and its many applications."),
        trow(5, 336, "Short last line of a paragraph"),
        trow(5, 348, "Then the next paragraph opens here and ends."),
        trow(6, 76, "Agency", small=True),
        trow(6, 88, "Such enactments of structures imply a concept")]
found = title_heading_map(SUBS, [8.0] * 9 + [8.0], 8.0)
check("a short title-case line with space above it is a subheading", sorted(found),
      ["Agency", "What Is Structure?"])

# One heading on two lines; and the dash a scan sets as a hyphen.
check("a heading line ending on a connective runs on",
      [bool(HEADING_RUNS_ON.search(t)) for t in ("THE DUALITY OF STRUCTURE: A CRITIQUE AND",
                                                 "THE TRANSFORMATION OF DUAL STRUCTURES: OUT OF",
                                                 "VARIETIES OF STRUCTURES")], [True, True, False])
DOC = ('a synonym "pattern"-but all such; the soul and the body; one can see; the agency of '
       'actors; con- cepts that are broken; a body and a soul- can be used')
w = dash_words(DOC)
named = []
out = dehyphenate(DOC, False, set(), w, named)
# Mutation: drop the dash flag -> nothing is named; the joins themselves never change.
check("a line-end join that may have been a dash is named, not decided",
      (named, "soulcan" in out, "concepts" in out), (["soul-can"], True, True))
check("  only in a document that sets its dashes as hyphens",
      dash_words(DOC.replace('"pattern"-but', "pattern \u2014 but")), None)
# A word is never broken before a digit; an identifier or a page range is.
check("a break before a digit keeps its hyphen",
      dehyphenate("grant BNS- 870064 and pp. 118- 22, a con- cept", False), "grant BNS-870064 and pp. 118-22, a concept")

# The imprint: a price code and the volume line are the journal's; a note's last line is not.
check("an older imprint's price code and volume line are licence furniture",
      [bool(LICENCE.search(t)) for t in ("0002-9602/93/9801-0001$01.50",
                                         "AJS Volume 98 Number 1 (July 1992): 1-29",
                                         "870064, and by a fellowship from the Foundation.")],
      [True, True, False])
first_page = ([dict(text="' This article has benefited from many readers, and support from grant BNS-", y0=560, x0=54, x1=340, width=286, size=7.0),
               dict(text="870064, and by a fellowship from the Foundation.", y0=569, x0=54, x1=250, width=196, size=7.0),
               dict(text="\u00a9 1992 by An Imagined Press. All rights reserved.", y0=578, x0=54, x1=250, width=196, size=7.0)], 666.0)
is_f2, _h2, _f2 = detect_furniture([first_page, head_sheet(), head_sheet()])
# Mutation: drop IMPRINT_SHAPE from the adjacency rule -> the note's last line is dropped.
check("a note's last line above the copyright line is not taken for the imprint",
      is_f2("870064, and by a fellowship from the Foundation.", 569, 666.0), None)
check("  and only a citation-shaped line above a licence is its imprint",
      [bool(IMPRINT_SHAPE.search(t)) for t in ("Ethics 130 ( July 2020): 514-529",
                                               "870064, and by a fellowship from the Foundation.")],
      [True, False])


print("\nthe Wilson 2023 fixes (Medicine, Health Care and Philosophy, Springer; 7 Oct 2026)")
from pdf_to_source import size_heading_map, LIST_TAB, near_right                    # noqa: E402

# Inside the abstract only a heading opens the article; a long abstract line does not.
# Mutation: drop `not in_abstract` -> the cut lands on the abstract's third line.
def frow(y, text, size=10.0, small=False, page=351):
    return (page, 51, y, 790.0, text, 0, small)
FRONT = [frow(156, "James Wilson"), frow(188, "Accepted: 31 March 2023 / Published online: 12 May 2023", small=True),
         frow(226, "Abstract"), frow(238, "Fair allocation of scarce healthcare resources has been much studied within philosophy and bioethics, but"),
         frow(251, "focused on a narrow range of cases. The Covid-19 pandemic provided significant new challenges, making powerfully"),
         frow(263, "visible the extent to which health systems can be fragile, and how scarcities within crucial elements of interlinked care"),
         frow(375, "Keywords Operations research · Cost-effectiveness analysis"), frow(421, "Introduction", size=12.0)]
FRONT += [frow(440 + 12 * k, "Body text of the introduction that runs on at an ordinary length here.") for k in range(60)]
first, _last = find_boundaries(FRONT, 51, 10.0, [r[4] and (12.0 if r[4] == "Introduction" else 10.0) for r in FRONT])
check("the article starts at its first heading, past a long abstract", FRONT[first][4], "Introduction")

# A page number at one end of the running head's line is not a paragraph number.
# Mutation: drop near_right -> the far head counts as "beside" and the number is kept.
check("a running head across the page is not beside the page number",
      near_right(dict(x0=51, x1=63, text="352"), dict(x0=516, text="J. Wilson")), False)
check("  while a paragraph's first line is", near_right(dict(x0=51, x1=63, text="64"), dict(x0=80, text="Article 9")), True)

# Headings in a larger face: one heading over two lines, a colon allowed; noise and table cells not.
def srow(page, y, text):
    return (page, 306, y, 790.0, text, 0, False)
SZ = [srow(4, 140, "under the four assumptions."), srow(4, 159, "Four assumptions of cost-effectiveness based"),
      srow(4, 171, "improvement"), srow(4, 190, "Using cost-effectiveness analysis as the sole factor"),
      srow(6, 290, "they are rarely discussed."), srow(6, 309, "1.1 Healthcare improvement:"),
      srow(6, 321, "A preliminary account"), srow(6, 340, "Regardless of how a health system is financed,"),
      srow(7, 100, "260,522 - 20.8"), srow(7, 112, "Millers, bakers"), srow(7, 124, "Shopkeepers 15,347")]
SZS = [10, 12, 12, 10, 10, 12, 12, 10, 10, 12, 10]
BODY = [srow(9, 60 + 12 * k, "Ordinary body text of a later page that runs on at length.") for k in range(80)]
heads, tails = size_heading_map(SZ + BODY, SZS + [10] * 80, 10.0)
# Mutation: return ({}, set()) -> none found; drop stands_apart -> the table cell is a heading.
check("larger-type headings are found, each over its two lines",
      (sorted(heads), sorted(tails)),
      (sorted(["Four assumptions of cost-effectiveness based", "improvement", "1.1 Healthcare improvement:",
               "A preliminary account"]), ["A preliminary account", "improvement"]))
check("  and a lone size, or a cell after a row of figures, is not a heading size",
      size_heading_map(SZ[:4] + SZ[8:] + BODY, SZS[:4] + SZS[8:] + [10] * 80, 10.0)[0], {})

# A list item set with a tab is a list item: not a heading, and a block of its own.
# Mutation: drop LIST_TAB from to_blocks -> item 3 joins item 2, and "3." becomes a heading.
LB = to_blocks([(357, 51, "2.\t Order all the interventions in order of cost-effectiveness."),
                (357, 51, "3.\t In funding interventions, start by funding the most cost-"),
                (357, 67, "effective, and keep moving to the right of the shelf."),
                (357, 51, "In a partial approach, the cost-effectiveness of some is investigated.")],
               dict(margin=51, display=None, paragraph=62, hanging=None), {}, None)
check("a tab-set list item opens a block, takes its continuation, and is not a heading",
      [(b["kind"], b["text"][:12]) for b in LB],
      [("display", "2.\t Order al"), ("display", "3.\t In fundi"), ("display", "In a partial")][:2] + [("body", "In a partial")])
check("  and its hanging lines are not a quotation",
      mark_displayed_quotes([(357, 51, "Margin prose anchoring the page."), (357, 51, "More margin prose."),
                             (357, 51, "3.\t In funding interventions, start by funding"),
                             (357, 67, "the most cost-effective, and keep moving to"),
                             (357, 67, "the right of the shelf until the money runs out.")]), set())

# In a document broken with soft hyphens, a line-end ASCII hyphen is the word's own.
# Mutation: drop the soft-mode rule -> "cost- effective"; drop the suspension guard -> "memory-and".
check("a soft-hyphen document keeps a line-end hyphen and closes the gap",
      dehyphenate("most cost- effective; signif\u00ad icant; memory- and justice-making", True),
      "most cost-effective; significant; memory- and justice-making")

# A heading's second line counts only after a heading.
# Mutation: drop orphan_tail -> the same words in prose become "# capability approach?".
OT = to_blocks([(128, 77, "3.7 Which notion of wellbeing is used in the"), (128, 150, "capability approach?"),
                (219, 85, "The answer to that question flows from the description of economics."),
                (219, 71, "the humanities. What can these heterodox economists expect from the"),
                (219, 71, "capability approach?")],
               dict(margin=71, display=None, paragraph=85, hanging=None),
               {"3.7 Which notion of wellbeing is used in the": "x", "capability approach?": "x"}, None,
               tails=frozenset({"capability approach?"}))
check("a heading's continuation is a heading only straight after one",
      [b["kind"] for b in OT], ["own-heading", "own-heading", "body"])


# The author block at the foot of the first page is the journal's, not the note it sits under.
# Mutation: return set() from author_block -> the name and address stay inside note 1.
from pdf_to_source import author_block                                             # noqa: E402
AB = [(351, 52, 610, 790.0, "[^1] As Norman Daniels put it, whenever a healthcare system denies", 0, True),
      (351, 55, 631, 790.0, "some individuals who can plausibly claim they are owed them in", 0, True),
      (351, 51, 668, 790.0, "Ann Author", 0, True), (351, 65, 678, 790.0, "a.author@example.ac.uk", 0, True),
      (351, 51, 698, 790.0, "[^1]", 0, True),
      (351, 65, 698, 790.0, "Department of Philosophy, An Imagined University,", 0, True),
      (351, 65, 708, 790.0, "Some Street, AB1 2CD London, UK", 0, True),
      (351, 311, 675, 790.0, "principle; losers as well as winners have plausible claims", 0, True),
      (352, 51, 60, 790.0, "I use the concept of health system improvement", 0, False)]
check("the first page's author block is set aside, and nothing of the note with it",
      sorted(author_block(AB)), [2, 3, 4, 5, 6])
check("  but only where a line is an email address and nothing else",
      author_block([r for r in AB if "@" not in r[4]]), set())


print("\nheadings from the PDF's own outline (7 Oct 2026)")
from pdf_to_source import outline_entries, outline_heading_map, OUTLINE_SKIP        # noqa: E402

# A repository's outline is page bookmarks and the issue's contents; neither is a heading.
# Mutation: drop OUTLINE_SKIP -> "p. [333]" and the issue contents are offered as headings.
check("page bookmarks and an issue's contents are not headings",
      [bool(OUTLINE_SKIP.search(t)) for t in ("121", "p. [333]", "image 4", "Issue Table of Contents",
                                              "Front Matter [pp. i-i]", "Blocked Exchanges [pp. 4-31]",
                                              "Introduction", "2.1 The immune system")],
      [True, True, True, True, True, True, False, False])
_doc = pymupdf.open()
for _ in range(3):
    _doc.new_page()
_doc.set_toc([[1, "\ufeffA title", 1], [1, "p. 2", 2], [2, "\ufeffIntroduction", 2], [2, "Methods", 3]])
check("an outline's entries keep their level, lose the byte-order mark, and know their sheet",
      outline_entries(_doc, 0), [(1, "A title", 0), (2, "Introduction", 1), (2, "Methods", 2)])

def orow(page, text):
    return (page, 51, 0, 790.0, text, 0, False)
OR = [orow(10, "INTRODUCTION"), orow(10, "A title"), orow(10, "Body of the first page runs on here."),
      orow(10, "Introduction"), orow(11, "The introduction begins and runs on."),
      orow(12, "Four assumptions of cost-effectiveness based"), orow(12, "improvement"),
      orow(12, "Using cost-effectiveness analysis as the sole factor.")]
# Mutation: drop the first-line test -> JSTOR's "V ARIOUS attempts ..." is a heading (Gettier);
# drop its length floor -> the Lancet's "Methods" is lost.
# The Lancet's side heading, interrupting "meas-" / "ures", is still found.
check("a paragraph's first line is not a heading; a heading that interrupts a sentence is",
      outline_heading_map([(1, "Various attempts have been made in recent years to state", 0),
                           (2, "Search strategy", 1), (2, "Methods", 1)],
                          [orow(5, "By A. AUTHOR"), orow(5, "Various attempts have been made in recent years to state"),
                           orow(5, "and sufficient conditions follow."),
                           orow(6, "adjusted meas-"), orow(6, "Search strategy"), orow(6, "ures of association."),
                           orow(6, "Methods"), orow(6, "reviewer (HK).")],
                          lambda sh: 5 + sh)[0],
      {4: (1, "Search strategy"), 6: (1, "Methods")})
oh, ot, found, total = outline_heading_map(
    [(2, "A title", 0), (3, "Introduction", 0), (3, "Four assumptions of cost-effectiveness based improvement", 2),
     (3, "Not in this text at all", 2)], OR, lambda sh: 10 + sh)
# Mutation: drop the order floor -> "Introduction" matches the label above the title.
# Mutation: absolute levels -> the outline's 2 and 3 become "##" and "###", the title not a "#".
check("each entry is found after the last, a wrapped heading across its lines, and depths are relative",
      (oh, sorted(ot), found, total),
      ({1: (1, "A title"), 3: (2, "Introduction"),
        5: (2, "Four assumptions of cost-effectiveness based improvement")},
       [6], 3, 4))

# Mutation: compare letters with the section number -> neither the unnumbered outline over a
# numbered page (Marchionni and Reijula 2019) nor Wiley's "1 | INTRODUCTION" over "1", "|",
# "INTRODUCTION" (Arya 2021) is found. Mutation: leave the number rows out -> "1 |" is left
# behind as a paragraph, and the heading starts at "INTRODUCTION".
def lrow(page, y, text):
    return (page, 51, y, 790.0, text, 0, False)
# Mutation: strip the number on the first try -> the list's unnumbered "B1: ..." is taken.
check("an entry is matched with its number before it is matched without",
      outline_heading_map([(1, "2.7.1 B1: The purpose of the theory", 0)],
                          [lrow(3, 100, "B1: The purpose of the theory"), lrow(3, 112, "B2: The selection of dimensions"),
                           lrow(3, 300, "2.7.1 B1: The purpose of the theory"), lrow(3, 312, "Text.")],
                          lambda sh: 3 + sh)[0], {2: (1, "2.7.1 B1: The purpose of the theory")})
check("an outline without the printed numbers, and Wiley's 'N | TITLE', are found",
      outline_heading_map([(1, "Introduction", 0), (1, "2 | WHY IT MATTERS", 0), (2, "2.1 | The pizza-effect", 0)],
                          [lrow(3, 100, "1 Introduction"), lrow(3, 112, "Body text of the introduction runs on."),
                           lrow(3, 200, "2"), lrow(3, 200, "|"), lrow(3, 200, "WHY IT MATTERS"),
                           lrow(3, 212, "Body text again runs on."),
                           lrow(3, 300, "2.1"), lrow(3, 300, "|"), lrow(3, 300, "The pizza-effect"), lrow(3, 312, "More text.")],
                          lambda sh: 3 + sh)[:2],
      ({0: (1, "Introduction"), 2: (1, "2 | WHY IT MATTERS"), 6: (2, "2.1 | The pizza-effect")}, {3, 4, 7, 8}))

# Mutation: key the outline's headings by text -> the running head on p. 11 and the contents
# line on p. 9 are headings too. Mutation: drop the continuation join -> "Two Immune
# Systems." starts a paragraph. The mark is on the block, not its text, so a heading `finish`
# later dehyphenates is still found (Devanesan's "immune sys-" / "tems.").
from pdf_to_source import to_blocks                                                   # noqa: E402
_ob = to_blocks([(9, 51, "Introduction"), (9, 51, "A contents line runs on here."),
                 (10, 51, "4.1 Interaction Between the"), (10, 51, "Two Immune Systems."), (10, 51, "Body text follows."),
                 (11, 51, "Introduction"), (11, 51, "More body text.")],
                dict(margin=51, hanging=None, paragraph=None, display=None), {}, None,
                outline={2: (2, "4.1 Interaction Between the Two Immune Systems")},
                outline_tails={3})
# Mutation: let a lower-case line run into the outline heading -> "### Search strategy ...
# ures of association" (Rogowski et al. 2025, the Lancet's side-column headings).
_ob2 = to_blocks([(3, 51, "Unadjusted and adjusted meas-"), (3, 51, "Search strategy"),
                  (3, 51, "ures of association were taken."), (3, 63, "Then a new paragraph.")],
                 dict(margin=51, hanging=None, paragraph=62, display=None), {}, None,
                 outline={1: (2, "Search strategy")})
check("a side heading that splits a paragraph follows it, and takes none of its words",
      [(b.get("outline"), b["text"]) for b in _ob2],
      [(None, "Unadjusted and adjusted meas- ures of association were taken."),
       (2, "Search strategy"), (None, "Then a new paragraph.")])
# Mutation: only a lower-case line goes back -> "using the ### Data analysis Office of Health".
_ob3 = to_blocks([(3, 51, "using the"), (3, 51, "Data analysis"), (3, 70, "Office of Health Assessment.")],
                 dict(margin=51, hanging=60, paragraph=None, display=None), {}, None,
                 outline={1: (2, "Data analysis")})
check("a sentence a side heading interrupts goes on past it, capital or not",
      [b["text"] for b in _ob3], ["using the Office of Health Assessment.", "Data analysis"])
check("an outline heading is the row it was found at, with its continuation, and nothing else",
      [(b["kind"], b.get("outline"), b["text"].split()[-1]) for b in _ob],
      [("body", None, "here."), ("own-heading", 2, "Systems."), ("body", None, "text.")])

print("\nthe face: bold at the body's own size (7 Oct 2026)")
from pdf_to_source import face_of, Face                                              # noqa: E402

# Mutation: ignore the font's name -> Minion-Black, flagged as nothing, is not bold.
check("a line's face is read from its flags and from its font's name",
      [face_of([dict(text="2. The Scope", flags=16, font="Palatino")]),
       face_of([dict(text="Results", flags=0, font="Minion-Black")]),
       face_of([dict(text="Abstract.", flags=18, font="P-BoldItalic"), dict(text=" This article", flags=2, font="P-Italic")])],
      [dict(bold=1.0, italic=0.0), dict(bold=1.0, italic=0.0), dict(bold=9 / 21, italic=1.0)])
check("  and a size that knows its face is still the size", (Face(9.5, True) + 1, Face(9.5, True).bold), (10.5, True))

def brow(page, y, text, small=False, x=66):
    return (page, x, y, 790.0, text, 0, small)
B, BS = [], []
def put(row, size):
    B.append(row); BS.append(size)
for pg, head in ((4, "2. The Scope of Literary Perspectives: From Single Experiences"), (10, "6. Concluding Remarks")):
    put(brow(pg, 300, "a change in the reader."), Face(9.0))
    put(brow(pg, 312, "[1.2.3.4] Project MUSE (2024) Utrecht University Library", small=True, x=3), Face(8.0))
    put(brow(pg, 310, head), Face(9.5, True))
    if pg == 4:
        put(brow(pg, 322, "to the Character's Heart"), Face(9.5, True))
    put(brow(pg, 340, "So far, I have discussed the scope of literary perspectives."), Face(9.0))
for pg in (1, 7):     # the stamp recurs, as a stamp does
    put(brow(pg, 312, "[1.2.3.4] Project MUSE (2024) Utrecht University Library", small=True, x=3), Face(8.0))
put(brow(12, 100, "(0.0990)"), Face(9.0)); put(brow(12, 112, "State-Level Controls"), Face(9.5, True))
put(brow(12, 124, "Percent Smokers"), Face(9.0))
put(brow(13, 100, "as the table shows."), Face(9.0)); put(brow(13, 112, "Table 1 Three Definitions"), Face(9.5, True))
put(brow(13, 124, "Quality is"), Face(9.0))
for k in range(80):
    put(brow(20, 60 + 12 * k, "Ordinary body text of a later page that runs on at length."), Face(9.0))
heads, tails = size_heading_map(B, BS, 9.0)
# Mutation: drop the bold face -> nothing found; let the stamp end the paragraph -> section 6
# lost; drop the figures test -> "State-Level Controls"; drop CAPTION -> "Table 1 ...".
check("bold headings at body size are found, past a stamp, and not in a table or its title",
      (sorted(heads), sorted(tails)),
      (sorted(["2. The Scope of Literary Perspectives: From Single Experiences", "to the Character's Heart",
               "6. Concluding Remarks"]), ["to the Character's Heart"]))
# Mutation: let small type on the line itself be passed over -> Ramsey's "kof)" is a heading.
R = [brow(5, 90, "denote the rate."), brow(5, 100, "hice", small=True, x=292), brow(5, 100, "kof)", x=334),
     brow(5, 112, "Now let us denote by U(z) the total rate."),
     brow(6, 90, "denote the rate."), brow(6, 100, "hice", small=True, x=292), brow(6, 100, "kof)", x=334),
     brow(6, 112, "Now let us denote by U(z) the total rate.")]
check("  small type on the line itself is part of the line",
      size_heading_map(R + B[-80:], [Face(9.0), Face(7.0), Face(10.6), Face(9.0)] * 2 + BS[-80:], 9.0)[0], {})

# A FIGURE'S WORDS ARE THE FIGURE'S (8 Oct 2026): Meadows's "heat from furnace heat to outside room
# temperature" and Knight and Winship's "T M Y" were run into the prose. Mutations: return the lines
# unfiltered from split_figures -> the labels stay; drop the caption's size test -> the sentence
# opening with "Figure 15 shows" is lifted out as a caption; run page-sized drawings in with the
# rest -> nothing is lifted (Hedström and Ylikoski 2010).
print("\na figure's labels and caption come out of the text, a sentence about it stays")
import pdf_to_source as _P  # noqa: E402
_fd = pymupdf.open()
_fp = _fd.new_page(width=595, height=842)
for k, line in enumerate(["The thermostat turns the furnace on whenever the room is too cold for comfort,",
                          "and off again when the room has warmed up to the setting chosen for it."]):
    _fp.insert_text((72, 100 + 14 * k), line, fontsize=11)
_fp.draw_rect(pymupdf.Rect(-12, -40, 607, 870), color=(1, 1, 1))  # a page-sized clip, as Annual Reviews sets one
_fp.draw_rect(pymupdf.Rect(220, 160, 330, 220), color=(0, 0, 0))
_fp.draw_line((120, 190), (220, 190), color=(0, 0, 0), width=3)
_fp.draw_line((330, 190), (430, 190), color=(0, 0, 0), width=3)
_fp.insert_text((235, 195), "room temperature", fontsize=9)
_fp.insert_text((122, 182), "heat from furnace", fontsize=9)
_fp.insert_text((340, 182), "heat to outside", fontsize=9)
_fp.insert_text((72, 245), "Figure 15. Room temperature regulated by a thermostat and furnace.", fontsize=9)
for k, line in enumerate(["Figure 15 shows the loop that holds the room near its goal, and the leak that",
                          "drains it all the while toward the temperature outside the house itself."]):
    _fp.insert_text((72, 280 + 14 * k), line, fontsize=11)
_P.FIGURES.clear()
_fl = [l["text"] for l in _P.sheet_lines(_fp)]
check("the labels drawn in a figure, and its caption, are not in the text",
      [t for t in _fl if t in ("room temperature", "heat from furnace", "heat to outside") or t.startswith("Figure 15. Room")], [])
check("  the caption is kept, apart", [f["caption"] for f in _P.FIGURES],
      ["Figure 15. Room temperature regulated by a thermostat and furnace."])
check("  and a sentence of the text that names the figure stays in the text",
      any(t.startswith("Figure 15 shows the loop") for t in _fl), True)

# A CAPTION IN THE BODY'S OWN SIZE, punctuated as a caption, inside a region that runs on below it
# (the Coleman-boat paper; Wimmer's Fig. 2 with a rule under its caption). Mutations: drop
# FIG_CAPTION_MARKED from the size test, or drop `within` -> nothing is lifted.
_gp = _fd.new_page(width=595, height=842)
for k in range(6):
    _gp.insert_text((72, 90 + 14 * k), "Ordinary body text of the article that runs on across the column at length.", fontsize=11)
_gp.draw_rect(pymupdf.Rect(150, 200, 400, 300), color=(0, 0, 0))
_gp.insert_text((170, 250), "Macro-level association", fontsize=8)
_gp.insert_text((150, 320), "Fig. 1. The social-ecological expansion of the diagram.", fontsize=11)
_gp.draw_rect(pymupdf.Rect(140, 190, 410, 345), color=(0, 0, 0))   # a frame round figure and caption
_P.FIGURES.clear()
_gl = [l["text"] for l in _P.sheet_lines(_gp)]
check("a caption in the body's size, punctuated as one and inside its region, is lifted with the figure's words",
      ([t for t in _gl if "Macro-level" in t or t.startswith("Fig. 1.")], [f["caption"] for f in _P.FIGURES]),
      ([], ["Fig. 1. The social-ecological expansion of the diagram."]))

# A FIGURE ACROSS BOTH COLUMNS, ITS CAPTION SET IN TWO (Rena et al.'s Fig. 2, 9 Oct 2026): the cut
# to the caption's column left the right half's labels and the caption's right half in the text, and
# a blind reconstruction read them. A body line level with the caption in the other column is not the
# caption's. Mutation: never find the level line -> the right label and half stay in the text.
_hp = _fd.new_page(width=595, height=790)
for k in range(8):
    _hp.insert_text((51, 520 + 14 * k), "Body text of the left column, set at the body's size.", fontsize=10)
    _hp.insert_text((306, 520 + 14 * k), "Body text of the right column, set at the body's size.", fontsize=10)
_hp.draw_rect(pymupdf.Rect(134, 70, 462, 460), color=(0, 0, 0))
_hp.insert_text((150, 120), "Glucose", fontsize=8)
_hp.insert_text((410, 120), "Adenylate cyclase", fontsize=7)
_hp.insert_text((51, 480), "Fig. 2 The multiple mechanism via which metformin", fontsize=8.5)
_hp.insert_text((51, 490), "affects liver metabolism. (1) Uptake by OCT1.", fontsize=8.5)
_hp.insert_text((306, 480), "lowering cAMP by another mechanism. (7) Glucagon", fontsize=8.5)
_hp.insert_text((306, 490), "raises cAMP and activates PKA.", fontsize=8.5)
_P.FIGURES.clear()
_P.DOC_BODY[0] = 10.0
_hl = [l["text"] for l in _P.sheet_lines(_hp)]
_P.DOC_BODY[0] = None
check("a figure across both columns loses its labels on both sides, and its two-column caption whole",
      ([t for t in _hl if t in ("Glucose", "Adenylate cyclase") or t.startswith(("lowering cAMP", "raises cAMP", "Fig. 2"))],
       [f["caption"] for f in _P.FIGURES]),
      ([], ["Fig. 2 The multiple mechanism via which metformin affects liver metabolism. (1) Uptake by OCT1. "
            "lowering cAMP by another mechanism. (7) Glucagon raises cAMP and activates PKA."]))
check("  and the body text below it stays, in both columns",
      sum(t.startswith("Body text of the") for t in _hl), 16)

# A SPACE AFTER A LIGATURE THAT THE NEXT LETTER STARTS ON TOP OF IS NOT A SPACE (Meadows, 8 Oct 2026);
# one with a real gap is. Mutation: drop the gap test -> "staﬀ members" is joined.
class _Raw:
    def __init__(self, chars): self.chars = chars
    def get_text(self, kind): return {"blocks": [{"lines": [{"spans": [{"chars": self.chars}]}]}]}
def _chars(spec):
    out, x = [], 0.0
    for c, w, back in spec:
        out.append({"c": c, "bbox": (x, 0, x + w, 10)})
        x += w - back
    return out
_spur = _chars([("a", 5, 0), ("\ufb01", 5, 0), (" ", 2.5, 2.5), ("c", 5, 0)])   # the space is kerned back
_real = _chars([("f", 3, 0), ("\ufb00", 6, 0), (" ", 2.5, 0), ("m", 6, 0)])      # a real word space
_b1 = [{"lines": [{"spans": [{"text": "a\ufb01 c", "size": 11}]}]}]
_b2 = [{"lines": [{"spans": [{"text": "f\ufb00 m", "size": 11}]}]}]
_P.close_ligature_spaces(_Raw(_spur), _b1); _P.close_ligature_spaces(_Raw(_real), _b2)
check("a space a ligature's next letter overlaps is closed; a real word space is kept",
      (_b1[0]["lines"][0]["spans"][0]["text"], _b2[0]["lines"][0]["spans"][0]["text"]), ("a\ufb01c", "f\ufb00 m"))

print(f"\n{fails} FAILED" if fails else "\nall passed")
sys.exit(1 if fails else 0)
