#!/usr/bin/env python3
"""One converter for turning a printed article into the markdown a reconstruction cites.

WHY THIS EXISTS. The Williams and Gettier folders each grew their own converter, and between
them they solved the same eight problems twice: ligatures, de-hyphenation across line breaks,
paragraphs from the printed indent, editorial headings, journal furniture, footnotes, page
markers, and keeping the raw extraction for audit. Writing the second one -- and debugging it
through seven cycles -- cost more than the reconstruction it existed to serve. The machinery
lives here now; a paper's own `convert_source.py` shrinks to a config block and keeps doing the
one job it should keep, which is DOCUMENTING THAT PAPER'S OWN LIBERTIES.

WHAT IT WORKS OUT FOR ITSELF, so nobody has to read page geometry off a coordinate dump again:

  columns      one or two, from the gap in the distribution of left edges
  left bands   the margin, a displayed-proposition indent, an ordinary paragraph indent, and a
               deep hanging column -- clustered from the x0 histogram. A page can have two of
               these or four; assuming two is what glued every displayed definition in the
               Gettier to the paragraph after it.
  furniture    running heads and page numbers at the top of a page, and whatever repeats in the
               bottom band across pages, which is where a download footer lives
  footnotes    a numbered line low on the page, and everything under it -- lifted to the end,
               because they interrupt sentences that run across a page break
  damage       lines whose OCR text is stretched far wider than its characters warrant, which is
               what a scan that silently DROPPED WORDS looks like from the outside

EVERY ONE OF THOSE IS REPORTED, not just done. A generic converter that mis-segments quietly is
worse than a bespoke one debugged in the open, so `convert()` returns a report naming the bands
it found, the furniture it dropped, the footnotes it lifted, the headings it placed, the repairs
it applied and the lines it still finds suspicious. Read it once and you know whether to look.

WHAT IT WILL NOT DO. It cannot know what a dropped word was. `Repair` entries are supplied by
whoever checked the page image, each with its reason, and the detector's job is only to say WHERE
to look. A plausible-looking completion of a philosopher's sentence, silently inserted, is the
exact failure the fidelity markers exist to prevent.

    python3 pdf_to_source.py <file.pdf> <out.md>          # detect only, report, write nothing
"""

import re
import statistics
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

# A numbered section heading: "3", "3.1" or "3.1.2", then a capitalised phrase with no sentence
# punctuation in it. Specific enough that ordinary prose does not match -- a body line would have
# to open with a number and contain no full stop -- and it is what makes a modern paper's own
# section structure available to the paragraph locator instead of an editorial invention.
NUMBERED = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+([A-Z][^.]{2,60})$")

LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st"}


@dataclass
class Config:
    """Everything about ONE paper. Anything left at its default is worked out from the page."""
    pdf: Path
    out: Path
    raw: Path = None                      # defaults to `.raw-extraction.txt` beside `out`
    first_sheet: int = 0                  # skip a JSTOR cover page by setting this to 1
    first_page: int = None                # printed page number of `first_sheet`
    end_marker: str = None                # stop here: a sign-off with another article below it
    headings: list = field(default_factory=list)      # [(anchor fragment, editorial title)]
    own_headings: dict = field(default_factory=dict)  # {printed run-in heading: title}
    repairs: list = field(default_factory=list)       # [(page, wrong, right, why)]
    verified_complete: tuple = ()         # lines the detector flags that are NOT damaged
    furniture: tuple = ()                 # extra regexes, for what detection cannot see
    keep_footnotes_inline: bool = False
    #: Turn superscript digits into Markdown footnote references, and the lifted notes into
    #: definitions. Only fires where the PDF still carries real font sizes; a scan gives no
    #: usable signal and is left exactly as it was. See join_spans.
    markdown_footnotes: bool = True
    number_headings: bool = True          # promote "3.1 Hume on abstraction" to a heading
    starts_at: str = None                 # skip front matter until this text appears
    page_label: str = ""                  # e.g. "Analysis", for the page-marker comments
    title: str = ""
    author: str = ""
    source: str = ""
    stretch_limit: float = 11.0           # points per character; body median is ~4.5
    columns: int = None                   # None = detect; 1 or 2 to force
    bands: dict = None                    # override detection: {display, paragraph, hanging}


# --------------------------------------------------------------------------- extraction

#: How many footnote markers the last `join_spans` pass turned into Markdown references. A
#: module-level tally rather than a return value because the line reader is called deep inside
#: the page walk and threading a count back out would touch every caller.
FOOTNOTE_MARKS = []


def join_spans(spans, mark_footnotes=True):
    """Join a line's spans, turning superscript digits into Markdown footnote references.

    WHY THIS IS DONE AT THE SPAN LEVEL AND NOWHERE ELSE. A footnote marker arrives in the text
    as a bare digit welded to the preceding word — `following:1` — and by then it is
    indistinguishable from the last digit of a year or a DOI. Measured on this corpus, a
    text-level rule that asks "does this digit match a note number?" converts `1963` into
    `196[^3]` and `2026` into `202[^6]`. The only honest signal is the one the PDF still has at
    this point: a span set smaller than the body of its own line.

    THAT SIGNAL DOES NOT SURVIVE OCR. On a scanned page every size is estimated, and the body
    size of one paragraph wanders by two points from line to line — the Gettier scan runs 7.96
    to 9.86 — so nothing can be called "smaller than the body" with a straight face. There, no
    marker is found, nothing is changed, and the report says so. A born-digital paper gives the
    signal cleanly: the Tooming PDF sets markers at 5.98 against a body of 7.97.
    """
    if not mark_footnotes or len(spans) < 2:
        return "".join(s["text"] for s in spans)
    body = max(s.get("size", 0) for s in spans)
    out = []
    for s in spans:
        t = s["text"]
        bare = t.strip()
        if (bare.isdigit() and 1 <= len(bare) <= 3
                and s.get("size", 0) and s["size"] < body - 0.5):
            FOOTNOTE_MARKS.append(bare)
            out.append(t.replace(bare, "[^%s]" % bare, 1))
        else:
            out.append(t)
    return "".join(out)


def clean(text):
    """Ligatures, and the control bytes a scan can wrap a line in.

    The NULs matter more than they look: a JSTOR footer arrives as '\\x00143.58...UTC\\x00',
    str.strip() does not remove NUL, and an anchored regex therefore never matches it. The line
    prints looking perfectly ordinary and survives every filter.
    """
    for lig, rep in LIGATURES.items():
        text = text.replace(lig, rep)
    return "".join(ch for ch in text if ch >= " " or ch in "\t\n\u00ad")


def sheet_lines(page, mark_footnotes=True):
    """Lines of one sheet with their geometry, sorted by y -- NOT in block order.

    Block order is what interleaves the following article into the middle of this one when the
    two share a sheet: the extractor can return the neighbour's block first.
    """
    out = []
    for b in page.get_text("dict").get("blocks", []):
        for l in b.get("lines", []):
            spans = l.get("spans", [])
            if not spans:
                continue
            text = clean(join_spans(spans, mark_footnotes)).strip()
            if not text:
                continue
            out.append(dict(x0=l["bbox"][0], y0=l["bbox"][1], x1=l["bbox"][2],
                            width=l["bbox"][2] - l["bbox"][0],
                            size=max(s.get("size", 0) for s in spans), text=text))
    return sorted(out, key=lambda l: l["y0"])


# --------------------------------------------------------------------------- detection

def gutter_on_page(spans, page_width):
    """The widest band no line on ONE page reaches, or None. See detect_columns for why."""
    if len(spans) < 12:
        return None
    lo = min(a for a, _ in spans)
    hi = max(b for _, b in spans)
    n = max(1, int(hi - lo) + 1)
    covered = [0] * n
    for a, b in spans:
        for i in range(int(a - lo), min(n, int(b - lo) + 1)):
            covered[i] += 1
    quiet = max(1, len(spans) * 0.03)
    best, at, run = 0, None, 0
    for i, c in enumerate(covered + [len(spans)]):
        if c <= quiet:
            run += 1
            continue
        if run:
            s0, s1 = (i - run) + lo, i + lo
            mid = (s0 + s1) / 2
            left = sum(1 for a, _ in spans if a < mid)
            if s1 - s0 > best and min(left, len(spans) - left) > len(spans) * 0.25:
                best, at = s1 - s0, mid
        run = 0
    return at if best > page_width * 0.012 else None


def resolve_bands(bands):
    """Choose `display` and `paragraph` when clustering found more than two candidates.

    WHY CHOOSING BEATS REFUSING. `detect_bands` declines to guess above two levels, and the
    refusal was right when the corpus was six hand-configured papers: a wrong band glues a
    displayed quotation to the paragraph before it, and a loud question is better than a quiet
    mistake. But on 45 papers drawn from five fields it refused 28 -- every failure, in every
    field -- and a converter that declines two thirds of modern journal articles is not usable
    unattended whatever its reasons. So the refusal stays for a CONFIGURED paper, and this
    supplies an answer for one that has none, marked in the report as chosen rather than measured.

    THE RULE, AND THE EVIDENCE FOR IT. Measured across the refusing papers, one near-margin level
    almost always dominates: 318 lines against 21, 331 against 17, 309 against 66. That level is
    where ordinary paragraphs begin, because a paper is mostly ordinary paragraphs. The others are
    displayed quotations, lists, and the odd deep indent.

    WHAT `display` IS FOR, WHICH IS LESS THAN IT LOOKS. `to_blocks` tests `paragraph` FIRST, so a
    line only reaches the `display` test when it is shallower than the paragraph indent. The two
    bands do not really name two kinds of thing; between them they answer one question -- does
    this line START a block, or continue the one before it -- and the margin answers the rest. So
    `display` is set to the shallowest indent, which is the only place that test can ever fire.

    NOT USED WHERE THE LEVELS ARE ALREADY CLEAR, and never over a paper's own config.
    """
    near = [(c, n) for c, n in bands["levels"] if c <= bands["margin"] + 100]
    if len(near) < 2:
        return bands, None
    dominant = max(near, key=lambda t: t[1])
    shallowest = min(near, key=lambda t: t[0])
    runner_up = max((t for t in near if t is not dominant), key=lambda t: t[1], default=(0, 0))
    out = dict(bands)
    out["paragraph"] = dominant[0]
    out["display"] = shallowest[0] if shallowest[0] < dominant[0] else dominant[0]
    out["ambiguous"] = False
    return out, dict(paragraph=dominant, display=out["display"], others=len(near) - 1,
                     # How safe the choice was. A dominant level with twice the lines of anything
                     # else is a paragraph indent; a narrow lead is a coin toss worth reporting.
                     lead=round(dominant[1] / max(runner_up[1], 1), 1))


def detect_columns(pages, page_width):
    """Where the second column starts, or None for a single-column setting.

    THE GUTTER IS WHERE NO LINE REACHES -- measured with whole line EXTENTS, and PER PAGE. Three
    earlier versions were each wrong in a way nothing announced:

      * splitting at the page midline is decided by outliers. On the Williams, whose histogram is
        as bimodal as it gets, a handful of straddling lines closed the gap to 9.9pt and a
        two-column paper was read as one.
      * searching for a near-empty run of LEFT EDGES is blind to what the lines actually cover.
        On the Tooming the widest such run lies between the left column's indents (x0 ~50) and
        its displayed material (x0 ~185) -- the middle of a column, not a gutter. Splitting there
        filed fifteen lines of the left column into the right.
      * measuring coverage across the WHOLE PAPER at once is defeated by the front matter. A
        journal article's first page runs its title, authors, abstract and keywords full width;
        those lines span the gutter, and with every page thrown into one histogram they raise the
        floor enough to hide it.

    So each page is asked separately and the answer is the median of the pages that have one. A
    two-column paper has a gutter on most of its pages; a title page that does not simply
    abstains.
    """
    if pages and isinstance(pages[0], dict):
        pages = [pages]
    found = [g for g in (gutter_on_page([(l["x0"], l.get("x1", l["x0"])) for l in pg], page_width)
                         for pg in pages) if g is not None]
    if len(found) < max(1, len(pages) * 0.5):
        return None
    return statistics.median(found)


def order_columns(lines, split, offset):
    """One page's lines in reading order -- left column top to bottom, then right -- with the
    right column's left edges SHIFTED into the left column's frame.

    The shift is what makes everything downstream work on a two-column paper. An indent means
    "so far in from THIS column's margin", but `detect_bands` sees one histogram: unshifted, the
    right column's margin (x=269 on the Williams, 283 lines of it) arrives as just another indent
    level, and the paragraph indent it reports is really the other column's margin. Every
    paragraph break on the right-hand half of every page is then wrong.
    """
    if split is None:
        return [dict(l, col=0) for l in lines]
    left = [dict(l, col=0) for l in lines if l["x0"] < split]
    right = [dict(l, col=1, x0=l["x0"] - offset) for l in lines if l["x0"] >= split]
    return sorted(left, key=lambda l: l["y0"]) + sorted(right, key=lambda l: l["y0"])


def column_offset(lines, split):
    """How far the right column sits from the left, measured margin to margin."""
    def margin(sel):
        xs = [round(l["x0"]) for l in lines if sel(l["x0"])]
        return Counter(xs).most_common(1)[0][0] if xs else 0
    return margin(lambda x: x >= split) - margin(lambda x: x < split)


def detect_bands(lines):
    """The left edges a page actually uses, and what each one means.

    Pass the lines that SURVIVE furniture and end-marker filtering, not everything on the sheet.
    A following article sharing the last sheet contributes its own indents to the histogram and
    can bridge the gap between two of this article's levels, collapsing them into one.

    A page has two of these or four, and guessing two is the mistake that glues every displayed
    definition to the paragraph after it -- because a paragraph RESUMING after a display is set
    flush to the margin, exactly like a continuation line.

      margin     continuation lines, and the line that resumes after a display
      display    a displayed proposition, and (usually) the footnotes
      paragraph  the first line of an ordinary paragraph
      hanging    a deep second column, e.g. the numbered conditions of a definition
    """
    xs = [round(l["x0"], 1) for l in lines]
    if not xs:
        return dict(margin=0, display=None, paragraph=None, hanging=None,
                    ambiguous=False, levels=[])
    margin = Counter(round(x) for x in xs).most_common(1)[0][0]
    # Cluster everything measurably right of the margin, allowing 3pt of scanner jitter.
    levels, run = [], []
    for x in sorted(v for v in xs if v > margin + 3):
        if run and x - run[-1] > 3:
            levels.append(run); run = []
        run.append(x)
    if run:
        levels.append(run)
    levels = [(statistics.median(g), len(g)) for g in levels if len(g) > 1]

    hanging = next((c for c, _ in levels if c > margin + 100), None)
    near = [(c, n) for c, n in levels if c <= margin + 100]
    display = paragraph = None
    if len(near) == 1:
        paragraph = near[0][0]                       # one indent only: no displayed blocks
    elif len(near) == 2:
        display, paragraph = near[0][0], near[-1][0]
    # THREE OR MORE, AND IT WILL NOT GUESS. There is no heuristic here that survives both papers:
    # "the level with the most lines is the paragraph indent" is right on the Williams (60 lines
    # at 88.5 against 56 at 77.3) and wrong on the Gettier (12 displayed lines against 7
    # paragraph starts). Ordering by position is wrong on the Williams the other way. Rather than
    # pick one and be silently wrong on half the corpus, the levels are reported and the paper's
    # own config is asked to name them -- a loud question instead of a quiet mistake.
    return dict(margin=margin, display=display, paragraph=paragraph, hanging=hanging,
                ambiguous=len(near) > 2,
                levels=[(round(c, 1), n) for c, n in levels])


#: The journal's own imprint: a copyright assertion, or the ISSN/price code that follows it.
LICENCE = re.compile(r"All rights reserved|\u00a9\s*\d{4}\s+by\s|\b\d{4}-\d{4}/\d{4}/")


def printed_numbers(sheets):
    """The page number each sheet actually carries, read off the page. {sheet index: number}.

    WORTH READING RATHER THAN COUNTING, because the number is what a reader will cite. The Horton
    config declares `first_page=511`; the pages themselves say 514 at the foot of the first sheet
    and 515, 516, ... in the running heads after it. Counting from the config labelled every page
    three short, so a quotation the app offered as p. 517 was really on p. 520.
    """
    found = {}
    for i, (lines, height, _w) in enumerate(sheets):
        for l in lines:
            t = l["text"].strip()
            if not (l["y0"] < height * 0.14 or l["y0"] > height * 0.88):
                continue
            if re.fullmatch(r"\d{1,4}", t):
                found[i] = int(t)
                break
            # A NUMBER INSIDE THE RUNNING HEAD, which is how a great many journals set it:
            # `book symposium  |  369` on a recto, `370  |  book symposium` on a verso. Requiring
            # a line of nothing but digits missed every page of an Analysis article -- seventeen
            # sheets, no numbers, and the pagination silently unavailable.
            #
            # Only at the very start or the very end of the line, and only where what remains is
            # short: that is a running head. `Table 3 shows that 47 of the` is not, and neither
            # is a section number sitting in a heading further down the page, which the band
            # check has already excluded.
            m = re.fullmatch(r"(\d{1,4})\s*[|·•—–-]?\s*(.{0,48}?)|(.{0,48}?)\s*[|·•—–-]?\s*(\d{1,4})",
                             t)
            if m and any(m.groups()):
                num = m.group(1) or m.group(4)
                rest = (m.group(2) if m.group(1) else m.group(3)) or ""
                # A bare year, or a lone number already handled above, is not what this is for;
                # and a "running head" with digits in it is a table row.
                if num and not re.search(r"\d", rest):
                    found[i] = int(num)
                    break
    return found


def page_offset(found, sheet_count):
    """(offset, outliers) such that sheet i is printed page i + offset, by majority vote.

    A majority rather than the first hit: one stray number -- an equation tag at the head of a
    page, a figure caption -- should not renumber the article.
    """
    if not found:
        return None, []
    votes = Counter(n - i for i, n in found.items())
    offset, _n = votes.most_common(1)[0]
    return offset, sorted(i for i, n in found.items() if n - i != offset)


def detect_furniture(pages, extra=()):
    """Running heads, page numbers and the download footer -- as predicates, not a fixed list.

    Two signals, because neither alone is enough. A RUNNING HEAD is the first line of a page and
    is set in capitals or is bare digits -- repetition does not identify it, since each page's
    head can differ ("ANALYSIS 23.6 JUNE 1963" then "122 ANALYSIS"). A FOOTER is whatever repeats
    in the bottom band across pages, which is what a download stamp does and what body text never
    does.
    """
    tops, top_rep, bottoms = set(), Counter(), Counter()
    for lines, height in pages:
        if not lines:
            continue
        # The TOP BAND by y, not the first few entries of the list: once a two-column page has
        # been put into reading order, the head sitting over the right column is no longer near
        # the front of it, and a slice-based rule stops seeing it.
        for l in (x for x in lines if x["y0"] <= height * 0.12):
            # Two signals, because neither alone is enough. A head that REPEATS is a head --
            # "U. Tooming and R. Jakapi" on all nine pages, mixed case, which the capitals test
            # below never sees. A head that appears ONCE and is set in capitals is also a head:
            # "ANALYSIS 23.6 JUNE 1963" and "122 ANALYSIS" each occur on one page only.
            top_rep[re.sub(r"[\d.]+", "#", l["text"])] += 1
            letters = re.sub(r"[^A-Za-z]", "", l["text"])
            if len(l["text"]) <= 60 and (not letters or letters.isupper()):
                tops.add(l["text"])
        for l in lines:
            if l["y0"] > height * 0.86:
                bottoms[re.sub(r"[\d.]+", "#", l["text"])] += 1
    repeated = {k for k, n in bottoms.items() if n >= max(2, len(pages) * 0.6)}
    # A TWO-SIDED RUNNING HEAD CANNOT REACH HALF THE SHEETS, and requiring it to was why one of
    # the two sides always survived. The article's FIRST page carries a title block instead of a
    # head, so the verso and recto sides split the remainder unevenly: on the Horton's 16 sheets
    # "Horton / Aggregation, Risk, and Reductio" appears 8 times and "Ethics / July 2020" only 7,
    # and a threshold of len(pages) * 0.5 = 8 dropped the first and kept the second. "July 2020"
    # then ran on into the paragraph below it -- "July 2020 that you should choose (2) for each
    # pair in Villain 3" -- eight times over.
    #
    # The floor is what the layout actually permits: with the first page excluded, the smaller
    # side of an alternating head appears (len(pages) - 1) // 2 times. Body text cannot collide
    # with this: it would have to repeat verbatim in the TOP BAND of that many separate pages.
    repeated_tops = {k for k, n in top_rep.items() if n >= max(2, (len(pages) - 1) // 2)}
    extra_rx = [re.compile(p) for p in extra]
    # THE LINE DIRECTLY ABOVE A LICENCE LINE BELONGS TO IT. A journal's imprint prints as a small
    # block -- "Ethics 130 ( July 2020): 514-529" and then the copyright and price code -- of
    # which only the second half says anything a pattern could recognise. The first half looks
    # exactly like a citation, which is what it would be anywhere else on the page. Taken by
    # adjacency instead: same page, directly above, within a line or two. On the Horton that line
    # sat in the note zone of page 514 and spliced itself into the middle of footnote 1, between
    # "see F. M. Kamm, Intricate Ethics:" and its own subtitle.
    imprint = set()
    for _lines, _h in pages:
        ordered = sorted(_lines, key=lambda x: x["y0"])
        for k, l in enumerate(ordered):
            if k and LICENCE.search(l["text"]) and l["y0"] - ordered[k - 1]["y0"] < _h * 0.05:
                imprint.add(ordered[k - 1]["text"])

    def is_furniture(text, y0, height):
        if text in tops or (y0 <= height * 0.14
                            and re.sub(r"[\d.]+", "#", text) in repeated_tops):
            return "running head"
        if re.fullmatch(r"\d{1,4}", text):
            return "page number"
        if y0 > height * 0.86 and re.sub(r"[\d.]+", "#", text) in repeated:
            return "page footer"
        # THE JOURNAL'S LICENCE LINE, which prints once, on the article's first page, and so is
        # invisible to the repeats detector. It sits INSIDE the note zone, between the last
        # footnote of the page and the page number, which is how it came to be lifted as though
        # it were a footnote of its own -- and how it cut footnote 1 off from its own runover on
        # the page after. No author's prose says "All rights reserved".
        if LICENCE.search(text) or text in imprint:
            return "journal licence"
        if any(rx.match(text) for rx in extra_rx):
            return "declared furniture"
        return None

    return is_furniture, sorted(tops | repeated_tops), sorted(repeated)


def flag_stretched(lines, limit, skip_texts):
    """Lines whose OCR text is far wider than its characters warrant: dropped words.

    An OCR text layer is stretched to fit the printed line it stands for, so a line that lost
    half its words is drawn at three times the normal points-per-character. This FINDS them; it
    cannot say what is missing. Nothing else about them is anomalous -- the file opens, the text
    extracts, the exit code is 0.
    """
    out = []
    for l in lines:
        t = l["text"]
        if t in skip_texts:
            continue
        if l["width"] / max(len(t), 1) > limit:
            out.append((round(l["width"] / max(len(t), 1), 1), t))
    return out


# --------------------------------------------------------------------------- assembly

#: A footnote's own leading number, in EITHER spelling: as printed at the foot of the page
#: (`1 Plato seems...`), or after the superscript rule has already rewritten it
#: (`[^1] Plato seems...`). Papers set the note's own number as a superscript too, so marking
#: references necessarily changes how a note block opens.
#:
#: ONE PATTERN, SHARED BY THE DETECTOR AND THE RENDERER. When those two carried separate regexes
#: they drifted the moment the marker rule landed: the detector still wanted `1 ` at the head of
#: the line, found `[^1] `, and stopped recognising notes at all -- on the Tooming paper nine
#: lifted footnotes became zero, and the nine notes stayed inline in the body, silently adding
#: 311 words of apparatus to the prose. Nothing failed; the text was just wrong.
NOTE_OPENING = re.compile(r"^(?:\[\^([1-9]\d?)\]|([1-9]\d?))\s+(.*)$", re.S)
#: The same, for a journal that puts a full stop after the note's number ("5. See Horton, ...").
#: KEPT SEPARATE, AND OFFERED ONLY TO APPARATUS-SIZED LINES, because at body size this is also
#: the shape of a numbered section heading: admitting `1. Introduction` as a note would latch the
#: note zone open at the head of a section and swallow the rest of the column.
NOTE_OPENING_DOTTED = re.compile(r"^(?:\[\^([1-9]\d?)\]|([1-9]\d?))[.)]\s+(.*)$", re.S)


#: The unnumbered first note -- acknowledgements, funding, a dedication -- keyed to a symbol
#: rather than a digit. It carries no number, so it gets no `[^n]:` definition and is simply
#: parked under `# Notes` with the rest. Left in the flow it does real damage, because it is
#: keyed to the TITLE and so lands in the middle of the article's first sentences: on the Horton
#: it cut "contrast with fully aggregative moral views, and ... with nonaggregative moral views"
#: in half with 40 words of thanks to an audience at Cardiff.
STAR_NOTE = re.compile(r"^[*\u2020\u2021]\s+[A-Z\"'(]")


def note_opening(text, dotted=False):
    """(number, rest) if the line opens with a footnote's own number, else None."""
    m = NOTE_OPENING.match(text) or (NOTE_OPENING_DOTTED.match(text) if dotted else None)
    return (m.group(1) or m.group(2), m.group(3)) if m else None


#: Where an article's BACK MATTER starts. These are section headings, not phrases that might turn
#: up in prose, so the line has to BE one -- short, and the whole of itself. "References" inside a
#: sentence about someone's references is not a bibliography.
BACK_MATTER = re.compile(
    r"^\W{0,3}(?:"
    r"references?|bibliography|works\s+cited|literature\s+cited"
    r"|acknowledge?ments?|acknowledgements"
    r"|appendix(?:\s+[A-Z0-9]+)?|appendices"
    r"|notes?|endnotes?|footnotes?"
    r"|funding(?:\s+(?:information|statement))?"
    r"|declarations?(?:\s+of\s+(?:competing|conflicting)\s+interests?)?"
    r"|conflicts?\s+of\s+interest"
    r"|credit\s+authorship\s+contribution\s+statement"
    r"|author\s+contributions?|data\s+availability(?:\s+statement)?"
    r"|supplementary\s+(?:material|data|information)"
    r"|about\s+the\s+authors?|biographical\s+note"
    r")\W{0,3}$", re.I)

#: Front matter, on an article's first page: the apparatus that comes before the prose.
FRONT_MATTER = re.compile(
    r"^\W{0,3}(?:a\s*b\s*s\s*t\s*r\s*a\s*c\s*t|keywords?|key\s+words?|"
    r"article\s+info(?:rmation)?|a\s+r\s+t\s+i\s+c\s+l\s+e|highlights?|"
    r"received:?|accepted:?|published(?:\s+online)?:?)\b", re.I)


def looks_like_heading(text, x0, margin, size, body_size):
    """Is this line a heading the PAPER set, rather than a sentence?

    THREE SIGNALS, ALL REQUIRED, because each alone has a large false-positive class:

      * it sits at the MARGIN. An indented line starts a paragraph or a displayed block.
      * it is SHORT and does not end like a sentence. A heading is a label, not a statement,
        and does not close with a full stop -- though it may end in a colon or a digit.
      * it is set in CAPITALS, or larger than the body. Either says "this is not running text".

    Deliberately does NOT accept title case: "The Sub-Humean Model" and "He Said That" are the
    same shape, and a run-in title-case sentence at the head of a paragraph is common enough in
    older journals that accepting it would promote prose to a heading.
    """
    t = (text or "").strip()
    if not t or len(t) > 70 or abs(x0 - margin) > 3:
        return False
    if t.endswith((".", ",", ";", "?", "!")) and not re.search(r"\b[IVXLC]+\.$", t):
        return False
    letters = re.sub(r"[^A-Za-z]", "", t)
    if len(letters) < 2:
        return False
    return letters.isupper() or (body_size and size >= body_size + 0.9)


def title_case(text):
    """A caps heading, put back into the case a reader expects, with the paper's own words kept.

    Small words stay small EXCEPT at the start, and anything that is not plain letters -- roman
    numerals, initials, acronyms -- is left exactly as printed, because lowering "II" or "AI"
    would be a change to the text rather than to its presentation.
    """
    small = {"a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "of", "on", "or",
             "the", "to", "with", "vs", "via"}
    out, seen_word = [], False
    for w in re.split(r"(\s+)", text.strip()):
        if not w.strip():
            out.append(w)
            continue
        core = re.sub(r"[^A-Za-z]", "", w)
        if not core or re.fullmatch(r"[IVXLCDM]+", core) or len(core) == 1:
            out.append(w)                       # numerals, initials: as printed
            continue                            # and NOT counted as the first word: the word
                                                # after "II." still opens the heading, so
                                                # "II. THE REDUCTIO" is not "II. the Reductio"
        if seen_word and core.lower() in small:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:].lower())
        seen_word = True
    return "".join(out).strip()


def caps_heading_map(rows, margin, body_size, sizes, declared):
    """{printed text: the case to print it in} for the headings the paper set in capitals.

    A CAPS HEADING IS A TYPOGRAPHIC FACT, not a judgement, so naming them one at a time in a
    config is work the page can do. Only repeated structure counts: a line must share its shape
    with at least one other -- same case, same margin -- before it is read as a heading, because
    a single all-caps line is as likely to be a title, a running head that escaped, or a shout.

    Anything already declared is left alone: the author's own wording wins over the mechanical
    re-casing, which is why this returns a map rather than rewriting anything itself.
    """
    found = {}
    for i, (_p, x0, _y, _h, text, _c, small) in enumerate(rows):
        t = (text or "").strip()
        if small or t in declared or not looks_like_heading(t, x0, margin, sizes[i], body_size):
            continue
        if not re.sub(r"[^A-Za-z]", "", t).isupper():
            continue                    # larger-than-body headings are left to the caller
        found.setdefault(t, 0)
        found[t] += 1
    # One of a kind is not a structure. Two or more lines sharing the shape is a paper's sections.
    keep = [t for t in found if len(found) > 1]
    return {t: title_case(t) for t in keep}


def find_boundaries(rows, margin, body_size, sizes):
    """(first, last) row indices of the ARTICLE, front and back matter excluded.

    `rows` are (printed, x0, y0, height, text, col, small) in reading order.

    WHY THIS IS WORTH AUTOMATING. Across the sample papers `starts_at` and `end_marker` were most
    of the hand-written config, and neither is a judgement about the argument: one is where the
    abstract stops and the other is where the bibliography starts. Both are announced by the paper
    itself, in a small and stable vocabulary.

    THE FRONT CUT IS THE CONSERVATIVE ONE. It only fires when front-matter apparatus was actually
    SEEN -- an abstract, keywords, a received-date -- and then cuts at the first heading or
    body-sized paragraph after it. A paper that opens straight into its argument is left alone,
    because on such a paper there is nothing to cut and a wrong guess costs the first paragraph.
    """
    first, last = 0, len(rows)

    # ---- back matter: the first line on the last third of the paper that IS a section heading
    for i in range(len(rows) - 1, -1, -1):
        printed, x0, y0, height, text, _col, small = rows[i]
        t = text.strip()
        if not BACK_MATTER.match(t):
            continue
        # THE VOCABULARY IS DOING THE WORK, and `BACK_MATTER` is anchored at both ends, so the
        # line has to BE the heading rather than contain those words inside a sentence. Two tests
        # that seemed like sensible corroboration were both wrong on a real corpus:
        #
        #   * "not apparatus-sized" -- but a bibliography is USUALLY set smaller than the body,
        #     heading and all, so this skipped the References line on 17 of 30 papers.
        #   * "at the page margin" -- but in a two-column setting the references begin in the
        #     SECOND column, whose x0 is nowhere near the page margin. That was another 8.
        #
        # What is left is the anchored vocabulary and a length cap, which is enough: no sentence
        # in a paper consists of the single word "References".
        if len(t) > 70:
            continue
        last = i
    # ---- front matter: only where the paper announced some
    seen_front = False
    for i, (printed, x0, y0, height, text, _col, small) in enumerate(rows[:160]):
        t = text.strip()
        if FRONT_MATTER.match(t):
            seen_front = True
            continue
        if not seen_front:
            continue
        # APPARATUS IS NEVER THE START OF THE ARTICLE. A first page carries its footnotes like any
        # other, and they are long -- so the "first full-width paragraph" fallback below fired on
        # footnote 1 and cut the introduction off with the front matter.
        if small:
            continue
        # A NUMBERED HEADING COUNTS TOO. `looks_like_heading` wants capitals or a larger size, and
        # "1. Introduction" is neither; it is a heading all the same, and on a modern article it
        # is usually the first one.
        if (looks_like_heading(t, x0, margin, sizes[i], body_size)
                or NUMBERED.match(t) or len(t) > 120):
            first = i
            break
    # A CUT THAT LEAVES (ALMOST) NOTHING IS NOT A CUT. Both ends are guesses from a vocabulary,
    # and on a paper that opens with a long structured abstract or repeats "References" as a
    # running head they can cross, or meet, and take the article with them. Detected boundaries
    # are only ever an improvement on reading the whole file, so where they would not be, they
    # are discarded and the whole file is read -- which is the behaviour they replaced.
    last = min(last, len(rows))
    if last - first < max(40, len(rows) * 0.25):
        return 0, len(rows)
    return first, last


def to_blocks(rows, bands, own_headings, end_marker, notes=False, number_headings=True,
              caps_headings=None):
    """Lines into blocks, by left edge. See `detect_bands` for what the edges mean.

    Three rules beyond the bands, each of which was a bug first:
      * a lower-case first letter NEVER starts a block, whatever the indent -- this is what stops
        a drop cap, whose first lines are indented to clear the big letter, from reading as two
        paragraphs, and the runover of a displayed proposition from reading as a new one;
      * a margin-level line after a DISPLAY starts a new paragraph, because that is how a printer
        sets a paragraph resuming after displayed matter -- and the same after a HEADING, whose
        first paragraph is usually set flush. Without that second case a section heading absorbs
        the section: "2. Hume and abstraction" came out inside the paragraph that follows it,
        while "1. Introduction" survived only because its first paragraph happened to be
        indented, which is exactly the kind of luck that hides a bug for one paper;
      * inside a footnote block the marker is the only delimiter, since a runover there sits at
        the margin and can begin with a capital ("New York, 1957), p. 16.").
    """
    blocks = []
    expected = 1                      # the next footnote number the sequence is looking for
    for page, x0, text in rows:
        if notes:
            # A NEW NOTE STARTS ONLY AT THE NUMBER THE SEQUENCE IS EXPECTING. Notes run 1, 2,
            # 3 ... through the article, and a footnote's runover is full of numbers that open a
            # line and are not note numbers at all: on the Horton, note 1 continues
            # "46 (2018): 160-74. For responses to these criticisms, ..." -- a volume and a page
            # range -- which read as "note 46" and cut note 1 in half, one line before the page
            # break that already threatened it. Matching against the expected number instead of
            # against the shape of a number costs nothing and cannot be fooled by a citation.
            _op = note_opening(text, dotted=True)
            _opens = bool(_op and _op[1].strip() and int(_op[0]) == expected)
            if _opens or STAR_NOTE.match(text) or not blocks:
                if _opens:
                    expected += 1
                blocks.append(dict(page=page, pages={page}, kind="note", text=text))
            else:
                blocks[-1]["text"] += " " + text
                blocks[-1]["pages"].add(page)
            continue
        # A HEADING THE PAPER SET IN CAPITALS. `own_headings` names these by hand, one config
        # entry per heading, and on the Horton that was four lines of config for four headings
        # the page announces perfectly clearly. Detected ones arrive here already carrying the
        # case they should be printed in -- see `caps_heading_map`.
        if caps_headings and text in caps_headings:
            own_headings = dict(own_headings)
            own_headings[text] = caps_headings[text]
        if (text in own_headings or (end_marker and end_marker in text)
                or (number_headings and NUMBERED.match(text))):
            # A heading has to START a block. Recognising one after assembly is too late: these
            # sit at the margin like a continuation line, so the indent rule swallows them into
            # the paragraph above and there is nothing left to promote.
            kind = "own-heading"
        elif blocks and ((bands["hanging"] and x0 > bands["hanging"] - 5) or text[:1].islower()):
            blocks[-1]["text"] += " " + text
            blocks[-1]["pages"].add(page)
            continue
        elif bands["paragraph"] and x0 > bands["paragraph"] - 2:
            kind = "body"
        elif bands["display"] and x0 > bands["display"] - 2:
            kind = "display"
        elif blocks and blocks[-1]["kind"] not in ("display", "own-heading"):
            blocks[-1]["text"] += " " + text
            blocks[-1]["pages"].add(page)
            continue
        else:
            kind = "body"
        blocks.append(dict(page=page, pages={page}, kind=kind, text=text))
    return blocks


def dehyphenate(text, soft):
    """Rejoin words broken across a printed line -- without destroying real compound hyphens.

    WHICH HYPHEN IS THE TYPESETTER'S? In a modern PDF, the two are different characters: a break
    inserted to justify a line is U+00AD SOFT HYPHEN, and an ASCII hyphen is part of the word.
    The Tooming has 86 of the first and never once ends a line with the second. A blanket rule
    that joins on any hyphen therefore corrupts the compounds: "well-established" broken at its
    own hyphen came back as "wellestablished", which is not a word and is not flagged by
    anything.

    So: if a document uses soft hyphens at all, trust them and leave ASCII hyphens alone. Old
    scans have none -- their text layers predate the convention -- and there an ASCII hyphen at a
    line end IS the break, so the blunt rule is right and is what gets used.
    """
    if soft:
        text = re.sub(r"\u00ad\s*", "", text)
        return text
    return re.sub(r"(\w)-\s+(\w)", r"\1\2", text)


def finish(blocks, repairs, applied, soft=False):
    """De-hyphenate, collapse whitespace, then repair.

    Repairs run LAST and on the assembled block, because a repair can straddle a printed line
    break -- and they are scoped to every page a block SPANS, not the page it starts on, because
    the block carrying the worst of them began on one page and ended on the next.
    """
    for b in blocks:
        b["text"] = re.sub(r"\s+", " ", dehyphenate(b["text"], soft)).strip()
        for page, wrong, right, _why in repairs:
            if page in b["pages"] and wrong in b["text"] + " ":
                b["text"] = (b["text"] + " ").replace(wrong, right).strip()
                applied[wrong] += 1
    return blocks


# --------------------------------------------------------------------------- the whole job

def note_floor(display_edge, margin, number):
    """How far LEFT of the display band a note's first line may start.

    THE NUMBER HANGS INTO THE MARGIN, so a footnote's first line starts further left the longer
    its number is -- and the measured drop is about 3pt per extra digit (Tooming: notes 1-9 at
    x0 43.7, notes 10-25 at 40.7, against a display band at 43.7). A fixed 2pt tolerance
    therefore admits every note up to the ninth and rejects every note from the tenth on. It did
    exactly that, silently: sixteen footnotes stayed in the running prose, their text reading as
    the author's own, and the only visible trace was a stray digit welded to a word.

    Clamped to sit strictly right of the margin, because the margin is where CONTINUATION lines
    live -- and a floor at or below it would pull the whole tail of the page into the notes.
    """
    floor = display_edge - (2 + 4 * (len(number) - 1))
    return max(floor, margin + 0.5) if margin is not None else floor


def opens_note(row, display_edge, low, margin):
    """True if this row is a footnote's own FIRST line -- the one carrying its number."""
    _printed, x0, y0, height, text, _col, small = row
    if small and y0 > height * 0.50 and STAR_NOTE.match(text):
        return True
    op = note_opening(text, dotted=small)
    # A SMALLER LINE IS ALLOWED TO SIT HIGHER UP THE PAGE. `low` assumes the notes are a
    # footer-sized strip; a paper that runs eight footnotes on one page starts them at 0.60 of
    # the sheet (Horton), and the bottom-30% test alone rejects every one of them.
    return bool(op
                and y0 > height * (0.50 if small else low)
                and re.match(r"^[A-Z\"'(]", op[1])
                and (small or not display_edge
                     or x0 > note_floor(display_edge, margin, op[0])))


def is_runover(row):
    """True if this row is apparatus-sized, and so could be the tail of a carried-over note.

    A note too long for its page continues at the foot of the NEXT one, ABOVE that page's own
    notes and carrying no number of its own -- it resumes mid-sentence, in lower case. Every
    signal the opening line has, it lacks. Left in the flow it is worse than a stray note,
    because it reads as the continuation of whatever body paragraph the page break interrupted:
    on the Horton, footnote 1 runs over onto page 515 and six lines of Kamm and Voorhoeve
    citations ended up inside a sentence about what is new in the reductio.

    SIZE IS THE WHOLE TEST HERE, DELIBERATELY -- no height threshold. Position is already carried
    by the caller, which only ever walks BACKWARDS from the page's first numbered note and stops
    at the first body-sized line; the run it collects is therefore contiguous with the note block
    by construction. Asking each line to be low on the page as well breaks exactly the case this
    exists for: a page carrying a long runover plus four notes of its own starts its apparatus at
    0.47 of the sheet, so a 0.50 test cut the runover in half and left the first two lines in the
    prose.
    """
    return bool(row[6])


def split_footnotes(body, display_edge, low=0.70, margin=None):
    """Separate footnotes from the flow. Returns (flow, notes).

    THE ZONE LATCHES PER PAGE AND COLUMN, NOT PER PAGE. In a two-column setting the reading order
    returns to the TOP of the sheet for the second column, so a page-wide latch opened by a
    footnote at the foot of the left column swallows the entire right column after it. On a
    nine-page paper that silently removed three section headings and 1,364 words, and the only
    visible symptom was that the section numbering jumped from 1 to 3.

    Rows are decided per page and column but emitted in the ORDER THEY ARRIVED, so the caller
    sees exactly the sequence it passed in, minus the notes.
    """
    lifted = [False] * len(body)
    columns = {}
    for i, row in enumerate(body):
        columns.setdefault((row[0], row[5]), []).append(i)

    for idxs in columns.values():
        cut = next((k for k, i in enumerate(idxs)
                    if opens_note(body[i], display_edge, low, margin)), None)
        if cut is None:
            # A column with no numbered note may still END in one carried over from the page
            # before -- a note long enough to fill the foot of this page on its own. Here there
            # is no numbered note to anchor to, so the column's LAST line must at least be low
            # on the page before any of it is read as apparatus.
            k = len(idxs)
            if idxs and body[idxs[-1]][2] > body[idxs[-1]][3] * 0.50:
                while k > 0 and is_runover(body[idxs[k - 1]]):
                    k -= 1
            cut = k if k < len(idxs) else None
        else:
            # Walk back off the first numbered note through whatever apparatus-sized lines sit
            # directly above it. A body-sized line stops the scan, which is what keeps a small
            # display quotation lower down the page from being swallowed with the notes.
            while cut > 0 and is_runover(body[idxs[cut - 1]]):
                cut -= 1
        if cut is not None:
            for i in idxs[cut:]:
                lifted[i] = True

    flow = [(body[i][0], body[i][1], body[i][4]) for i in range(len(body)) if not lifted[i]]
    notes = [(body[i][0], body[i][1], body[i][4]) for i in range(len(body)) if lifted[i]]
    return flow, notes


def convert(cfg):
    cfg.raw = cfg.raw or cfg.out.parent / ".raw-extraction.txt"
    doc = pymupdf.open(cfg.pdf)
    cfg.out.parent.mkdir(parents=True, exist_ok=True)
    cfg.raw.write_text("\n\n".join(f"===== sheet {i} =====\n" + doc[i].get_text()
                                   for i in range(doc.page_count)), encoding="utf-8")

    FOOTNOTE_MARKS.clear()
    sheets = [(sheet_lines(doc[i], cfg.markdown_footnotes), doc[i].rect.height, doc[i].rect.width)
              for i in range(cfg.first_sheet, doc.page_count)]
    every = [l for lines, _, _ in sheets for l in lines]
    if not every:
        raise SystemExit(f"no text layer in {cfg.pdf}")
    # A SCAN WITH A RIGHTS STAMP ON IT IS NOT A TEXT LAYER. One paper in the sample corpus -- a
    # 1992 article scanned by its publisher -- yielded ONE line across fifty-four pages, the
    # copyright notice, and the converter dutifully wrote a nine-word "article". Nine words is
    # not a conversion, and emitting it silently is worse than refusing: the file looks converted
    # and nothing downstream can tell that the paper is missing.
    words = sum(len(l["text"].split()) for l in every)
    per_page = words / max(len(sheets), 1)
    if per_page < 30 and len(sheets) > 2:
        raise SystemExit(
            f"this PDF has almost no text layer: {words} word(s) across {len(sheets)} pages "
            f"({per_page:.0f} per page).\n"
            "  It is a scan of the page images, so there is nothing here to reflow. Run OCR over\n"
            "  it first -- `ingest.py` will do that -- or find a born-digital copy.")

    split = detect_columns([l for l, _, _ in sheets], sheets[0][2]) if cfg.columns is None else (
        None if cfg.columns == 1 else sheets[0][2] / 2)
    offset = column_offset(every, split) if split is not None else 0
    sheets = [(order_columns(l, split, offset), h, w) for l, h, w in sheets]
    is_furniture, heads, footers = detect_furniture([(l, h) for l, h, _ in sheets], cfg.furniture)

    declared = cfg.first_page if cfg.first_page is not None else cfg.first_sheet + 1
    # THE PAGE'S OWN NUMBER WINS OVER THE CONFIG'S COUNT. `first_page` is hand-set and cannot be
    # checked by reading the file; the number printed on the sheet can be, and it is the one a
    # reader will cite. Where they disagree the printed number is used and the report says so
    # loudly -- silently keeping a config that is three pages out would make every pinpoint the
    # app offers wrong in a way nobody could see without opening the PDF.
    seen_numbers = printed_numbers(sheets)
    offset, page_outliers = page_offset(seen_numbers, len(sheets))
    first_page = declared if offset is None else offset
    page_numbers_from = "the config" if offset is None else "the pages themselves"
    applied, suspicious, dropped, body = Counter(), [], Counter(), []
    body_sizes = []                     # the size of each row, parallel to `body`
    # THE BODY SIZE, MEASURED OVER THE WHOLE ARTICLE AND NOT PER PAGE. Size is the only signal a
    # paper like the Horton carries for its footnotes: they sit at x0 96, LEFT of the display
    # band at 116, so the indent rule can never see them, and all 27 went into the committed
    # source as running prose -- 80 of the 84 note lines reading as though the author wrote them.
    # Measured per page it fails exactly where it is needed: the opening sheets are MOSTLY
    # apparatus, so the page's own modal size IS 8pt, nothing there is "smaller than the body",
    # and the first four notes stay in the text. Across the article the body wins outright.
    _sz = Counter(round(l["size"], 1) for _ls, _h, _w in sheets for l in _ls)
    doc_size = max(_sz, key=lambda v: (_sz[v], v)) if _sz else 0
    ratios = []
    stop = False
    for n, (lines, height, _w) in enumerate(sheets):
        if stop:                       # the end marker ends the ARTICLE, not just its page
            dropped["after the end marker"] += len(lines)
            continue
        printed = first_page + n
        ratios += [l["width"] / max(len(l["text"]), 1) for l in lines]
        skip = {w.strip() for _p, w, _r, _y in cfg.repairs} | set(cfg.verified_complete)
        suspicious += [(printed,) + s for s in
                       flag_stretched(lines, cfg.stretch_limit,
                                      {t for t in skip} | {l["text"] for l in lines
                                                           if is_furniture(l["text"], l["y0"], height)}
                                      )]
        for l in lines:
            why = is_furniture(l["text"], l["y0"], height)
            if why:
                dropped[why] += 1
                continue
            body.append((printed, l["x0"], l["y0"], height, l["text"], l.get("col", 0),
                         bool(doc_size) and round(l["size"], 1) < doc_size - 0.6))
            body_sizes.append(round(l["size"], 1))
            if cfg.end_marker and cfg.end_marker in l["text"]:
                # Everything from here is back matter. `break` alone leaves the REST OF THE PAPER
                # standing: it ends this sheet's loop and the next sheet is read in full, which
                # is how a bibliography survived a cut that reported 48 lines dropped.
                dropped["below the end marker"] += sum(1 for x in lines if x["y0"] > l["y0"])
                stop = True
                break

    # BOUNDARIES BEFORE BANDS, and the order is load-bearing.
    #
    # A bibliography is set with a HANGING INDENT: every line after the first of each entry sits
    # further in than the body ever does. Measured with the references still in, that is an extra
    # indent level -- often two, with the acknowledgements and the author biography -- and the
    # band detector refuses to guess above two. On a 45-paper corpus drawn from five fields it
    # refused 30 times, always for this reason, and the levels it printed were mostly citations.
    #
    # The margin is read first, from everything, because it is the one measurement a bibliography
    # cannot distort: it is the commonest left edge on the page and the body supplies most of it.
    provisional = detect_bands([dict(x0=x0, text=t) for _p, x0, _y, _h, t, _c, _s in body])
    bands = provisional

    # BOUNDARIES: the paper's own, unless the config names them. A declared marker always wins --
    # it is a person saying where the article is, and no detector should overrule that -- but with
    # none given the paper is asked instead of the author. Across the samples these two values
    # were most of the hand-written config and neither is a judgement about the argument.
    auto_front = auto_back = None
    if not cfg.starts_at or not cfg.end_marker:
        af, ab = find_boundaries(body, bands["margin"], doc_size, body_sizes)
        if not cfg.starts_at and af:
            auto_front = af
        if not cfg.end_marker and ab < len(body):
            auto_back = ab

    if cfg.starts_at:
        for i, row in enumerate(body):
            if cfg.starts_at in row[4]:
                dropped["front matter"] = i
                body, body_sizes = body[i:], body_sizes[i:]
                break
    elif auto_front:
        dropped["front matter (detected)"] = auto_front
        body, body_sizes = body[auto_front:], body_sizes[auto_front:]
        if auto_back is not None:
            auto_back -= auto_front

    if auto_back is not None and auto_back < len(body):
        dropped["back matter (detected)"] = len(body) - auto_back
        auto_back_text = body[auto_back][4]
        body, body_sizes = body[:auto_back], body_sizes[:auto_back]

    # NOW the bands, on the article alone. The margin is kept from the provisional pass, where it
    # was measured over the whole document: a cut that went wrong should not be able to move it.
    bands = detect_bands([dict(x0=x0, text=t) for _p, x0, _y, _h, t, _c, _s in body])
    bands["margin"] = provisional["margin"]
    bands.update({k: v for k, v in (cfg.bands or {}).items()})
    # More than two levels and no config: choose, and say so, rather than decline the paper.
    band_guess = None
    if bands.get("ambiguous") and not cfg.bands:
        bands, band_guess = resolve_bands(bands)
    if bands.get("ambiguous") and not cfg.bands:
        raise SystemExit(
            "the page uses more than two indent levels and this cannot be resolved by counting.\n"
            f"  margin {bands['margin']}, levels found (x0, lines): {bands['levels']}\n"
            "  Name them in the paper's Config, e.g. bands={'display': 77, 'paragraph': 88},\n"
            "  after looking at which is a displayed block and which starts a paragraph.")

    # Footnotes: a numbered line low on the page, and everything under it on that page.
    if cfg.keep_footnotes_inline:
        flow, notes = [(p, x, t) for p, x, _y, _h, t, _c, _s in body], []
    else:
        flow, notes = split_footnotes(body, bands["display"], margin=bands["margin"])

    soft = any("\u00ad" in row[4] for row in body)
    auto_caps = {}
    if not cfg.own_headings:
        auto_caps = caps_heading_map(body, bands["margin"], doc_size, body_sizes,
                                     set(cfg.own_headings or {}))
    # ONE MAP, USED BY BOTH HALVES. `to_blocks` decides what STARTS a block and the loop below
    # decides what is PRINTED as a heading, and they have to agree: with the detected headings
    # given only to the first, all four of the Horton's became their own blocks and then none of
    # them was emitted with a `#`.
    headings_now = dict(cfg.own_headings or {})
    headings_now.update(auto_caps)
    blocks = finish(to_blocks(flow, bands, headings_now, cfg.end_marker,
                              number_headings=cfg.number_headings, caps_headings=auto_caps),
                    cfg.repairs, applied, soft)
    note_blocks = finish(to_blocks(notes, bands, {}, None, notes=True),
                         cfg.repairs, applied, soft)

    out, used, seen = [], [], set()
    for b in blocks:
        mo = cfg.number_headings and NUMBERED.match(b["text"])
        if mo:
            out.append(f"# {mo.group(1)} {mo.group(2)}".rstrip())
            used.append(mo.group(0))
            continue
        if b["text"] in headings_now:
            out.append(f"# {headings_now[b['text']]}")
            used.append(headings_now[b["text"]])
            continue
        for frag, head in cfg.headings:
            if head not in used and frag in b["text"]:
                out.append(f"# {head}")
                used.append(head)
                break
        if b["page"] not in seen:
            out.append(f"<!-- {(cfg.page_label + ' ').lstrip()}p.{b['page']} begins here -->")
            seen.add(b["page"])
        out.append(b["text"])
    if note_blocks:
        # Say WHICH pages they were printed at the foot of. Generated rather than written by
        # hand, so the note cannot come to disagree with where the footnotes actually were.
        pages = sorted({p for b in note_blocks for p in b["pages"]})
        where = ", ".join(f"p. {p}" for p in pages)
        out.append("# Notes")
        out.append(f"<!-- Footnotes, printed at the foot of {where}. Lifted here because they "
                   "fall inside a sentence that runs across the page break. -->")
        # MARKDOWN FOOTNOTE DEFINITIONS, but only where the flow actually carries references to
        # them. Writing `[^1]:` into a scan whose markers were never found would leave a
        # definition pointing at nothing, and a renderer would file it under a heading no reader
        # asked for. Where there are no markers, the notes stay exactly as they were printed.
        seen_marks = set(FOOTNOTE_MARKS)
        for b in note_blocks:
            t = b["text"]
            op = note_opening(t, dotted=True)   # a lifted note is apparatus by construction
            out.append(f"[^{op[0]}]: {op[1]}" if (op and op[0] in seen_marks) else t)

    report = dict(
        words=sum(len(b["text"].split()) for b in blocks), blocks=len(blocks),
        notes=len(note_blocks), marks=len(FOOTNOTE_MARKS), columns=2 if split else 1,
        column_split=round(split, 1) if split else None, bands=bands,
        headings_placed=used,
        headings_missing=[h for _f, h in cfg.headings if h not in used]
                         + [h for h in cfg.own_headings.values() if h not in used],
        furniture=dict(dropped), running_heads=heads, footers=footers,
        band_guess=band_guess,
        caps_detected=auto_caps,
        boundaries_detected=dict(front=auto_front, back=auto_back),
        first_page=first_page, declared_first_page=declared,
        page_numbers_from=page_numbers_from, page_outliers=page_outliers,
        last_page=first_page + len(sheets) - 1,
        heading_gaps=heading_gaps(used),
        repairs_applied=sum(applied.values()), repairs_total=len(cfg.repairs),
        repairs_missing=[w for _p, w, _r, _y in cfg.repairs if not applied[w]],
        stretch_median=round(statistics.median(ratios), 1), suspicious=suspicious)

    cfg.out.write_text(header(cfg, report) + "\n\n".join(out) + "\n", encoding="utf-8")
    return report


def heading_gaps(used):
    """Top-level section numbers that are missing from a numbered paper.

    The paper numbers its own sections, so it will say when the conversion has torn: three
    headings and the text under them once vanished into a footnote block and the only visible
    symptom was that the map jumped from section 1 to section 3. Nothing else noticed -- the word
    count was plausible, every paragraph was well formed, and 1,364 words were simply gone.
    """
    tops = []
    for h in used:
        mo = NUMBERED.match(h)
        if mo and "." not in mo.group(1):
            tops.append(int(mo.group(1)))
    if len(tops) < 2:
        return []
    return [n for n in range(min(tops), max(tops) + 1) if n not in tops]


def header(cfg, r):
    """The provenance header, GENERATED from what actually happened.

    Hand-written, this drifts from the code the first time the code changes and nobody notices.
    Generated, the file cannot claim a liberty it did not take, or hide one it did.
    """
    b = r["bands"]
    edges = ", ".join(f"{k} {round(b[k])}" for k in ("margin", "display", "paragraph", "hanging")
                      if b[k] is not None)
    lines = [
        "---", f'title: "{cfg.title}"', f'author: "{cfg.author}"', f'source: "{cfg.source}"',
        "---", "",
        "<!-- CONVERTED TEXT - NOT THE PUBLISHED ARTICLE.",
        f"     Made by pdf_to_source.py from {cfg.pdf.name}.",
        f"     (a) {r['repairs_applied']} repair(s) applied, each listed with its reason and the",
        "         evidence for it in the paper's own convert_source.py. Where a repair restores",
        "         words the text layer lost, they were read off the page image, not inferred.",
        "     (b) Typographic normalisation only: ligatures expanded, control bytes removed,",
        "         words de-hyphenated across line breaks. No wording is altered.",
        f"     (c) Paragraphs reflowed from the printed left edges ({edges}).",
        f"     (d) Dropped: " + (", ".join(f"{k} ({n})" for k, n in r["furniture"].items())
                                 or "nothing") + ".",
    ]
    if r["notes"]:
        lines.append(f"     (e) {r['notes']} footnote(s) moved to the end, under `# Notes`.")
        if r.get("marks"):
            lines.append(f"         {r['marks']} superscript marker(s) written as `[^n]` "
                         "references, and the notes as Markdown definitions.")
        else:
            lines.append("         No superscript markers were found -- on a scanned page the "
                         "font sizes carry no usable signal -- so the numbers are left as "
                         "printed.")
    elif r.get("marks"):
        # MARKERS WITHOUT NOTES IS A REAL STATE, NOT AN ODDITY: the markers are found from the
        # font sizes on every page, whereas lifting the notes needs the config to say where the
        # note block is. Reporting the count only when both happened hid 50 markers on the first
        # Tooming run and made a working rule look like a broken one.
        lines.append(f"     (e) {r['marks']} superscript marker(s) written as `[^n]` references. "
                     "No note block was found at the foot of any page, so they have no "
                     "definitions -- check that this paper prints its notes as footnotes.")
    if r.get("band_guess"):
        g = r["band_guess"]
        lines.append(
            f"     (c2) THE INDENTS WERE CHOSEN, NOT MEASURED. This page uses {g['others'] + 1} "
            f"indent levels and no config names them, so the level with the most lines "
            f"(x0 {g['paragraph'][0]}, {g['paragraph'][1]} lines) was taken as the paragraph "
            f"indent -- a {g['lead']}x lead over the next."
            + ("" if g["lead"] >= 2 else " THAT LEAD IS NARROW: check that displayed quotations "
                                         "have not been run into the paragraphs before them."))
    if r.get("caps_detected"):
        lines.append("     (f) " + ", ".join(f"`# {h}`" for h in r["caps_detected"].values())
                     + " were set in CAPITALS by the paper and are promoted, re-cased. "
                     + "The words are the paper's; only the case is changed.")
    if cfg.own_headings:
        lines.append("     (f) " + ", ".join(f"`# {h}`" for h in cfg.own_headings.values())
                     + " are the AUTHOR'S OWN run-in headings, promoted.")
    # HEADINGS ARE THE PAPER'S OR THEY ARE NOT THERE. The converter used to insert editorial
    # ones to give the paragraph locator a `section` to scope its search. That is no longer
    # done: a reader cannot otherwise tell the paper's structure from the converter's guess at
    # it, and the scoping turned out to be a safety rail rather than a precondition -- measured
    # on the Williams, 20 of 21 section-only claims land on the same paragraph when the search
    # runs over the whole file. What pins a claim is a `source:` quotation.
    if cfg.headings:
        lines += ["         SOME `#` HEADINGS ARE EDITORIAL - this converter still inserts them,",
                  "         which is no longer the house rule. See `headings=` in its config."]
    else:
        lines += ["         Every `#` heading below is the paper's own. None was inserted.",
                  "         (`# Notes` above, where present, is the footnote container.)"]
    if r.get("page_numbers_from") == "the pages themselves":
        note = (f"     (g) Pages numbered {r['first_page']}-{r['last_page']}, read off the sheets "
                "themselves rather than counted from the config.")
        if r["first_page"] != r["declared_first_page"]:
            note += (f"\n         THE CONFIG DISAGREES: `first_page={r['declared_first_page']}` "
                     f"would have labelled them {r['declared_first_page']}-"
                     f"{r['declared_first_page'] + (r['last_page'] - r['first_page'])}. The "
                     "printed numbers are used, because they are what a reader cites. Correct "
                     "`first_page` in this paper's convert_source.py to silence this.")
        if r.get("page_outliers"):
            note += (f"\n         {len(r['page_outliers'])} sheet(s) carry a number that breaks "
                     f"the sequence: {r['page_outliers'][:6]}. The majority was used.")
        lines.append(note)
    elif r.get("first_page"):
        lines.append(f"     (g) Pages numbered {r['first_page']}-{r['last_page']}, COUNTED from "
                     "the config -- no sheet carries a printed number to check it against.")
    lines += [f"     {cfg.raw.name} beside this file is the untouched extraction. -->", ""]
    return "\n".join(lines) + "\n"

def print_report(r):
    print(f"  {r['words']} words in {r['blocks']} blocks, {r['notes']} footnotes"
          + (f", 2 columns split at x={r['column_split']}" if r["columns"] == 2 else ""))
    b = r["bands"]
    print(f"  left edges: " + ", ".join(f"{k}={round(b[k])}" for k in
          ("margin", "display", "paragraph", "hanging") if b[k] is not None)
          + f"   (clusters {b['levels']})")
    print(f"  furniture dropped: " + (", ".join(f"{k} x{n}" for k, n in r["furniture"].items())
                                      or "none"))
    if r["running_heads"]:
        print(f"    running heads: {r['running_heads']}")
    if r["footers"]:
        print(f"    repeating footer: {r['footers']}")
    if r.get("heading_gaps"):
        print(f"    ! NUMBERED SECTIONS MISSING: {r['heading_gaps']} -- the conversion has torn")
    print(f"  headings placed: {len(r['headings_placed'])}"
          + (f"  ! MISSING {r['headings_missing']}" if r["headings_missing"] else ""))
    print(f"  repairs applied: {r['repairs_applied']}/{r['repairs_total']}"
          + (f"  ! NOT FOUND {r['repairs_missing']}" if r["repairs_missing"] else ""))
    print(f"  stretch detector: body median {r['stretch_median']} pts/char")
    if r["suspicious"]:
        print("    ! LOOK AT THESE ON THE PAGE IMAGE - they may have lost words:")
        for page, ratio, text in r["suspicious"]:
            print(f"      p.{page} {ratio:5.1f}  {text[:60]}")
    else:
        print("    no unrepaired line exceeds the limit")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__.strip().splitlines()[-1].strip())
    r = convert(Config(pdf=Path(sys.argv[1]), out=Path(sys.argv[2])))
    print(f"wrote {sys.argv[2]}")
    print_report(r)
