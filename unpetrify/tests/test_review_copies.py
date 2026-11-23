#!/usr/bin/env python3
"""Review copies and proofs: line numbers, watermarks, query tags, maths, refusals.

    python3 unpetrify/tests/test_review_copies.py

Five faults found by MINDproofer's tests on a MIND review copy (ScholarOne), two nEdit snapshots
and OUP first proofs (23 Nov 2026), each of which lost or corrupted text without failing:

  1. the front cut ran from the cover sheet's "Keywords:" to "1. ...", taking the title, the
     abstract and two pages of introduction;
  2. margin line numbers and the watermark were welded into the text ("# 21 1. Internality",
     "13 12 11 10 For Review Only This solution has");
  3. a formula's lone letters (`x x x`, a truth table's `p q r`) were counted as letter-soup, so
     an exact text layer was called damaged and replaced by OCR;
  4. a proof's query tags and pilcrows sat inside paragraphs ("This AQ3 ¶ book defends") and
     stopped a hyphenated word being rejoined across them;
  5. refusals arrived only as SystemExit, and a .docx with tracked changes could only be refused.

The fixtures are synthetic on purpose -- the real files are confidential manuscripts -- but the
geometry is the real files': a US Letter sheet, line numbers right-aligned at x 75, text at x 90,
a 48pt watermark at about 51 degrees in pale blue.
"""
import math
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "unpetrify"))
from pdf_to_source import Config, convert, find_boundaries, side_by_side       # noqa: E402
from ingest import garbled_passages, plain_text, SOUP, ingest_one, pandoc      # noqa: E402
from errors import Refused                                                     # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))


PROSE = ("The question is whether a boundary belongs to what it bounds, and the answer given "
         "here is that it belongs to one side only. ") * 3
WORDS = PROSE.split()


def wrapped(words, per=13):
    return [" ".join(words[i:i + per]) for i in range(0, len(words), per)]


def watermark(pg):
    """ScholarOne's: 48pt, pale blue, turned about 51 degrees, across the middle of the sheet."""
    pg.insert_text((190, 560), "For Review Only", fontsize=48, color=(0.84, 0.95, 1.0),
                   morph=(pymupdf.Point(190, 560), pymupdf.Matrix(-51)))


def numbered(pg, rows, y=80.0, step=16.0):
    """Lines of text at x 90, each with its line number right-aligned at x 75 -- numbers
    restarting on every sheet, as ScholarOne's do. `rows` are (text, size, x) or None for an
    empty line, which ScholarOne numbers too."""
    n = 0
    for r in rows:
        n += 1
        num = str(n)
        pg.insert_text((75 - pymupdf.get_text_length(num, fontsize=12), y), num, fontsize=12)
        if r:
            text, size, x = r
            pg.insert_text((x, y), text, fontsize=size)
        y += step
    return y


def review_copy(path):
    doc = pymupdf.open()
    cover = doc.new_page(width=612, height=792)
    watermark(cover)
    cover.insert_text((180, 176), "Boundaries of Processes", fontsize=11)
    for k, (a, b) in enumerate([("Journal:", "MIND"), ("Manuscript ID", "MIND-2025-001.R2"),
                                ("Manuscript Type:", "Article"),
                                ("Keywords:", "boundary, process, rest, physics")]):
        cover.insert_text((150, 210 + 19 * k), a, fontsize=8.5)
        cover.insert_text((240, 210 + 19 * k), b, fontsize=8.5)
    # The manuscript's first page: title, an unlabelled abstract set small and indented, and the
    # introduction at body size -- no "Abstract", no "Introduction".
    p = doc.new_page(width=612, height=792)
    watermark(p)
    rows = [("Boundaries of Processes", 16, 170), None]
    rows += [(t, 11, 112) for t in wrapped(("This paper argues that every interval of process "
                                            "is half-open. " * 6).split(), 12)]
    rows += [None]
    rows += [(("INTRO-" if i == 0 else "") + t, 12, 90)
             for i, t in enumerate(wrapped(WORDS * 2))]
    numbered(p, rows)
    p.insert_text((303, 745), "1", fontsize=12)
    # Sections, each opening with a numbered heading that has a line number beside it.
    for s, title in enumerate(["Internality and externality", "External ends", "References"], 1):
        p = doc.new_page(width=612, height=792)
        watermark(p)
        head = title if title == "References" else f"{s}. {title}"
        rows = [(head, 16, 90), None]
        if title == "References":
            rows += [(f"Author{k}, A. (19{60 + k}) A Book About Things. Oxford.", 12, 90) for k in range(8)]
        else:
            rows += [(t, 12, 90) for t in wrapped(WORDS * 3)]
        numbered(p, rows)
        p.insert_text((303, 745), str(s + 1), fontsize=12)
    doc.save(path)


with tempfile.TemporaryDirectory() as td:
    pdf, out = os.path.join(td, "review.pdf"), Path(td) / "review.md"
    review_copy(pdf)
    rep = convert(Config(pdf=Path(pdf), out=out))
    md = out.read_text(encoding="utf-8")
    body = md.split("-->", 1)[1]
    print("a ScholarOne review copy")
    check("the introduction is kept (no front cut past it)", "INTRO-" in body, True)
    check("the unlabelled abstract is kept", "every interval of process is half-open" in body, True)
    check("the submission system's cover sheet is dropped, and said",
          rep["furniture"].get("submission system's cover sheet"), 1)
    check("no line number is welded to a heading",
          re.findall(r"(?m)^#+ \d+ \d", body), [])
    check("the numbered headings come through",
          bool(re.search(r"(?m)^# 1\.? Internality and externality$", body)), True)
    check("no run of bare line numbers survives", re.findall(r"(?m)^\d+(?: \d+)+$", body), [])
    check("no line number inside the prose",
          re.findall(r"one side only\. \d+ The", body), [])
    check("the watermark is gone", "Review Only" in body, False)
    check("every line number is counted as dropped (20 + 19 + 19 + 10)", rep["furniture"].get("margin line number"), 68)
    # Four, not five: the cover sheet is skipped whole before its lines are read.
    check("the watermarks are counted as dropped", rep["furniture"].get("watermark"), 4)
    check("the references are found as back matter", rep["back_matter_kept"] > 0, True)

# THE GUARD ON ITS OWN: no cover sheet to skip, and a front cut that would take body prose.
print("the front cut never takes running prose")
R = []                        # (printed, x0, y0, height, text, col, small)
S = []
R.append((1, 90, 80, 792, "Keywords: boundary, process", 0, True)); S.append(9.0)
for k, t in enumerate(wrapped(WORDS * 2)):
    R.append((1, 90, 100 + 16 * k, 792, t, 0, False)); S.append(12.0)
R.append((2, 90, 80, 792, "1. Internality", 0, False)); S.append(16.0)
for k in range(60):
    R.append((2, 90, 100 + 12 * k, 792, " ".join(WORDS[:13]), 0, False)); S.append(12.0)
why = {}
first, _last = find_boundaries(R, 90, 12.0, S, why=why)
check("eight lines of body prose before the heading: not cut", first, 0)
check("and the refusal is reported", why.get("front_kept", 0) >= 6, True)
# The cut it was written for still happens: apparatus, then the heading, nothing between.
R2 = [(1, 90, 80, 792, "Abstract", 0, True), (1, 90, 96, 792, "A short abstract of the paper.", 0, True),
      (1, 90, 112, 792, "Keywords: one, two", 0, True)] + R[-61:]
S2 = [9.0, 9.0, 9.0] + S[-61:]
first, _last = find_boundaries(R2, 90, 12.0, S2, why=(why := {}))
check("abstract and keywords before '1.': cut at the heading", first, 3)
check("and nothing is reported as kept", why.get("front_kept"), None)


# TWO COLUMNS NO GUTTER SEPARATES. Lorant and Bhopal's layer is wider than its print, so each
# left-column line reaches into the right column: no gutter, the page read across both at once.
print("columns the layer does not separate")
L = lambda x0, x1, y: dict(x0=x0, x1=x1, y0=y, size=9, text="x" * 50)       # noqa: E731
overlapping = [([L(68, 352, 100 + 11 * k) for k in range(40)] + [L(333, 610, 101 + 11 * k) for k in range(40)],
                862, 648)]
single = [([L(68, 580, 100 + 11 * k) for k in range(40)] + [L(68, 300, 560)], 862, 648)]
check("two overlapping columns: nearly every long line has a partner", side_by_side(overlapping) > 0.9, True)
check("one column: none has", side_by_side(single), 0.0)


def proof(path):
    """An OUP first proof: query tags and pilcrows in the margin beside the line they query, the
    pilcrow white; a word hyphenated at a line end with a tag beside the next line."""
    doc = pymupdf.open()
    lines = wrapped(WORDS * 2, 9)
    lines[3] = lines[3] + " metaphys-"
    lines[4] = "ical " + lines[4]
    for s in range(3):
        pg = doc.new_page(width=442, height=663)
        y = 80
        for k, t in enumerate(lines):
            pg.insert_text((70, y), t, fontsize=10)
            if k in (2, 4):
                pg.insert_text((43, y - 3), f"AQ{s * 2 + (k == 4) + 1}", fontsize=6, color=(0, 0, 1))
                pg.insert_text((54, y + 3), "¶", fontsize=6, color=(1, 1, 1))
            y += 13
    doc.save(path)


with tempfile.TemporaryDirectory() as td:
    pdf, out = os.path.join(td, "proof.pdf"), Path(td) / "proof.md"
    proof(pdf)
    rep = convert(Config(pdf=Path(pdf), out=out))
    body = out.read_text(encoding="utf-8").split("-->", 1)[1]
    print("an OUP first proof")
    check("no query tag in the text", re.findall(r"\bAQ\d", body), [])
    check("no pilcrow in the text", "¶" in body, False)
    check("a word broken beside a tag is rejoined", "metaphysical" in body, True)
    check("the tags and pilcrows are counted", rep["furniture"].get("margin query tag or pilcrow"), 12)


def maths(path, soup=False):
    """Three hundred words of prose and a truth table whose variables are lone italic letters."""
    doc = pymupdf.open()
    pg = doc.new_page(width=442, height=663)
    y = 60
    for t in wrapped(WORDS * 4, 11):
        pg.insert_text((50, y), t, fontsize=9)
        y += 11
    for k, v in enumerate("pqr"):
        pg.insert_text((60 + 30 * k, y + 10), v, fontsize=9, fontname="tiit")
    pg.insert_text((150, y + 10), "→", fontsize=9, fontname="symb")
    if soup:
        pg.insert_text((50, y + 30), "the t e t t s bulando of a damaged layer", fontsize=9)
    doc.save(path)


with tempfile.TemporaryDirectory() as td:
    print("the damage test leaves the maths out")
    clean, damaged = os.path.join(td, "clean.pdf"), os.path.join(td, "damaged.pdf")
    maths(clean)
    maths(damaged, soup=True)
    check("the old count would have called the truth table damage",
          len(SOUP.findall(re.sub(r"\s+", " ", plain_text(clean)))) > 0, True)
    check("italic variables are not letter-soup", garbled_passages(clean), 0)
    check("real letter-soup still is", garbled_passages(damaged), 1)
    md, notes = ingest_one(clean, allow_ocr=False)
    check("so the clean layer is read as clean", any("looks damaged" in n for n in notes), False)


def tracked_docx(path):
    w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = (f'<w:document xmlns:w="{w}"><w:body><w:p>'
            '<w:r><w:t xml:space="preserve">The view is </w:t></w:r>'
            '<w:del w:id="1" w:author="A" w:date="2026-01-01T00:00:00Z"><w:r><w:delText>false</w:delText></w:r></w:del>'
            '<w:ins w:id="2" w:author="A" w:date="2026-01-01T00:00:00Z"><w:r><w:t>true</w:t></w:r></w:ins>'
            '<w:r><w:t>.</w:t></w:r></w:p></w:body></w:document>')
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                   '</Types>')
        z.writestr("_rels/.rels",
                   '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                   '</Relationships>')
        z.writestr("word/document.xml", body)


print("refusals")
try:
    ingest_one("/nowhere/file.weird")
    got = None
except ValueError as e:
    got = type(e).__name__
check("a refusal is a ValueError a server can catch", got, "Refused")
check("and still a SystemExit for older callers", issubclass(Refused, SystemExit), True)
if not pandoc():
    print("  skip  pandoc not found; the tracked-changes route cannot run")
else:
    with tempfile.TemporaryDirectory() as td:
        docx = os.path.join(td, "tracked.docx")
        tracked_docx(docx)
        try:
            ingest_one(docx)
            got = "converted"
        except Refused as e:
            got = "refused" if "tracked" in str(e) and "tracked='accept'" in str(e) else str(e)
        check("tracked changes are refused by default, and the way out named", got, "refused")
        md, notes = ingest_one(docx, tracked="accept")
        check("accept: the insertion, not the deletion", ("true" in md, "false" in md), (True, False))
        check("accept: and the notes say every change was taken",
              any("ACCEPTED" in n for n in notes), True)
        md, notes = ingest_one(docx, tracked="reject")
        check("reject: the deletion, not the insertion", ("false" in md, "true" in md), (True, False))
        try:
            ingest_one(docx, tracked="maybe")
            got = None
        except Refused:
            got = "refused"
        check("an unknown choice is refused", got, "refused")

print()
if fails:
    print(f"{fails} FAILED")
    sys.exit(1)
print("all review-copy checks passed")
