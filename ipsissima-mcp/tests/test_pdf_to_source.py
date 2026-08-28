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
from pdf_to_source import (detect_columns, detect_bands, split_footnotes,   # noqa: E402
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
check("no numbers at all means fall back to the config", page_offset({}, 3), (None, []))

print("note_opening")
check("a plain number opens a note", note_opening("1 Plato seems to say"), ("1", "Plato seems to say"))
check("  as does one already marked up", note_opening("[^12] Arguably"), ("12", "Arguably"))
check("  a dotted number only when asked", note_opening("5. See Horton"), None)
check("  and then it does", note_opening("5. See Horton", dotted=True), ("5", "See Horton"))
check("a year is not a note number", note_opening("1963 was the year"), None)
check("a heading is not a note unless dotted forms are allowed",
      note_opening("2. Hume and abstraction"), None)

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
check("  including one that falls at a line end",
      dehyphenate("well- established", True), "well- established")
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

print(f"\n{fails} FAILED" if fails else "\nall passed")
sys.exit(1 if fails else 0)
