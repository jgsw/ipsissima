#!/usr/bin/env python3
"""Tests for multi-witness collation of a damaged scan (collate.py).

    python3 ipsissima-mcp/tests/test_collate.py

THE FIXTURES ARE MADE HERE, NOT COMMITTED. A scan is synthesised from text written for this
test: set in type, rendered to an image, laid on a fresh page as a scan is, and given an
invisible text layer with the kinds of damage real layers carry -- a misread letter, a word
lost at the page edge, letter-soup, an italic word. Nothing copyrighted is read, and the pages
are exactly as damaged as the test says.

The part that needs tesseract is skipped, loudly, where tesseract is not installed; the
alignment, the vote, the lexicon, the projection onto word boxes and the settling of disputes
in the Markdown are tested without it.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
os.environ.setdefault("IPSISSIMA_CACHE", tempfile.mkdtemp(prefix="ipsissima-collate-test-"))
from ipsissima_mcp import collate as c                                         # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}"
          + ("" if ok else f"\n          got {got!r} want {want!r}"))


def T(text):
    return c.typed(text)


# ---- alignment ----------------------------------------------------------------------- #
print("alignment")
x = "the cat sat on the mat and then the dog sat on the log by the door".split()
y = "the cat sat on tbe mat and then the dog sat on the log by the door".split()
eq = c.align(x, y)
check("every token matched but the misread one", [i for i, j in enumerate(eq) if j < 0], [4])
# A block read in another order: the second chain finds it.
a = [f"w{i}" for i in range(60)]
b = a[30:] + a[:30]
eq = c.align(a, b)
check("a block read out of order is still aligned", sum(j >= 0 for j in eq), 60)
check("regions: a run, and an insertion between agreed tokens",
      c.regions([0, 1, -1, -1, 4, 6, 7]), [(2, 4), (5, 5)])

# ---- the lexicon --------------------------------------------------------------------- #
print("the lexicon")
lex = c.Lexicon(["gettier"])
check("a word the witnesses agree on is known", lex.known("Gettier"), True)
check("digits run into letters are damage, worse than an unknown name",
      (lex.bad(T("1Plato")), lex.bad(T("1 Plato")) < lex.bad(T("1Plato"))), (2, True))
check("small capitals half read are damage", lex.bad(T("ANaLysis")) >= 2, True)

# ---- the vote ------------------------------------------------------------------------ #
print("the vote")
# Where the platform has no word list (GitHub's Ubuntu runners), the lexicon is what the
# witnesses agree on over a whole document, as collate() builds it. These tests give it that
# document's vocabulary, so they decide alike with a word list and without one.
doc = c.Lexicon(["gettier"] + "the stated in first case are true".split())
check("two witnesses against one is a majority",
      c.decide({"C": T("tbe"), "A": T("the"), "B": T("the")}, lex)[:2], ("A", "majority"))
if c.system_words():
    check("the lexicon settles a misread word between two",
          c.decide({"C": T("condition"), "B": T("condltion")}, lex)[:2], ("C", "lexicon"))
else:
    print("  skip  the lexicon test needs a system word list")
check("spacing alone is settled by the cleaner spacing",
      c.decide({"C": T("1Plato"), "B": T("1 Plato")}, lex)[:2], ("B", "spacing"))
check("absence is not a reading: a clean clause beats two letters",
      c.decide({"C": T("stated in the first case are true"), "B": T("st")}, doc)[:2],
      ("C", "absence"))
check("two clean words that differ are a dispute",
      c.decide({"C": T("form"), "B": T("from")}, lex)[1], "dispute")

# The whole vote over streams: a misread word settled, a dispute logged by reliability.
C = T("Smith has strong evidence for tbe proposition that Jones owns a Ford and form a view")
B = T("Smith has strong evidence for the proposition that Jones owns a Ford and from a view")
wit = c.Witness("B", B, [i if C[i] == B[i] else -1 for i in range(len(C))])
events, wins = c.vote(C, [wit], doc, ident=lambda s: f"x.{s}")
check("two regions found", len(events), 2)
check("  the misread word goes to the layer by the lexicon",
      (events[0]["chose"], events[0]["why"]), ("B", "lexicon"))
check("  the tie goes to the witness that proved more reliable",
      (events[1]["chose"], events[1]["why"]), ("B", "dispute"))
check("a decision recorded by id is applied before any vote",
      c.vote(C, [wit], lex, decided={"x.13": "form"}, ident=lambda s: f"x.{s}")[0][1]["why"],
      "decided")

# ---- projection onto C's words -------------------------------------------------------- #
print("projection")
Cs = T("in thc beginning")
out = [[t] for t in Cs]
c.project(out, Cs, 1, 2, T("the"))
check("a replacement stays in its word's box", [c.text_of(o) for o in out],
      ["in", "the", "beginning"])
Cs = T("1Plato seems")
out = [[t] for t in Cs]
c.project(out, Cs, 0, 1, T("1 Plato"))
check("a split rides in the same box, spaced", c.text_of(out[0]), "1 Plato")
Cs = T("the conditions though it is")
out = [[t] for t in Cs]
c.project(out, Cs, 2, 2, T("stated here"))
check("an insertion rides on the word before when nothing places it",
      c.text_of(out[1]), "conditions stated here")

# ---- pieces: marks back on their words ------------------------------------------------ #
print("pieces")
line = dict(words=[dict(out=o, x0=i * 10.0, x1=i * 10.0 + 8, it=False, bo=False)
                   for i, o in enumerate(["the", "following", ":1", "‘", "has", "for", "’"])])
check("a mark printed apart is put back on its word",
      [p["text"] for p in c.pieces(line)], ["the", "following:1", "‘has", "for’"])

# ---- corrections into a kept layer's text --------------------------------------------- #
print("patching")
md = "The converter keeps the layer, in which the conditions st though it is at the same time.\n"
new, n, missed = c.patch(md, [dict(before="layer, in which the conditions", text="st",
                                   after="though it is at the", new="stated in (a) are true,")])
check("a lost clause is put back between its neighbours",
      "the conditions stated in (a) are true, though it is" in new, True)
new, n, missed = c.patch("for knowledge:[^2] (b) S knows that",
                         [dict(before="for knowledge :", text="", after="(b) S knows that",
                               new="—")])
check("context may carry a note reference the converter made", n, 1)
new, n, missed = c.patch(md + md, [dict(before="in which the conditions", text="st",
                                        after="though it is", new="x")])
check("a correction found twice is left alone", (n, len(missed)), (0, 1))

# ---- settling disputes in the Markdown ------------------------------------------------ #
print("settling")
md = ("For example, Chisholm has held that the following gives the necessary and "
      "sufficient conditions for knowledge:'\n\n(b) S knows that P IFF (i) S accepts P,\n")
disputes = [dict(n=1, id="2.14.6", text="'", readings={"C": "?", "B": "'"},
                 before="sufficient conditions for knowledge :", after="(b) S knows that")]
new, applied, refused, record = c.settle(md, disputes, {"1": "2"})
check("a decision lands between its neighbours", "knowledge:2\n" in new, True)
check("  and is recorded by id for the next run", record, {"2.14.6": "2"})
new, applied, refused, _ = c.settle(md + md, disputes, {"1": "2"})
check("a reading found twice is refused, not guessed", (len(applied), len(refused)), (0, 1))
_, applied, _, _ = c.settle(md, disputes, {"1": "B"})
check("a witness named is its reading", applied[0].get("change"), "none (already so)")


# ---- a synthetic scan, end to end ---------------------------------------------------- #
PAGES = [
    ("A Note on Witnesses", [
        "When two careful readers copy the same page, each makes mistakes, but they",
        "rarely make the same mistake in the same place. Where they agree, the copy",
        "is almost always right; where they differ, the difference marks the very",
        "place a third reader should look. That is the whole method of collation,",
        "and it needs no reader to be perfect, only independent of the others.",
    ]),
    (None, [
        "The second page continues the argument with a further consideration about",
        "the nature of evidence and the limits of any single witness to a text, and",
        "it ends with a sentence that the damaged layer has lost entirely in its",
        "middle, so that only a fragment of the printed line survives in the layer.",
    ]),
]
TRUTH = " ".join(" ".join(lines) for _t, lines in PAGES)
#: The damage the layer carries: (page, true word, layer's word); "" drops the word.
DAMAGE = [(0, "careful", "carefu1"), (0, "mistake", "rnistake"), (1, "evidence", "evldence"),
          (1, "entirely", ""), (1, "fragment", "frag")]
ITALIC = "collation,"


def make_scan(path, folios=(11, 12), layer=True):
    """Two pages set in type, rendered to images, and laid on a fresh document with a damaged
    invisible layer at the words' own positions -- what a scanned PDF is."""
    import pymupdf
    typeset = pymupdf.open()
    for n, (title, lines) in enumerate(PAGES):
        pg = typeset.new_page(width=420, height=595)
        y = 70
        pg.insert_text((200, 40), str(folios[n]), fontname="tiro", fontsize=10)
        if title:
            pg.insert_text((60, y), title, fontname="tibo", fontsize=15)
            y += 34
        for ln in lines:
            x = 50
            for w in ln.split():
                font = "tiit" if w == ITALIC else "tiro"
                pg.insert_text((x, y), w, fontname=font, fontsize=11)
                x += pymupdf.get_text_length(w + " ", fontname=font, fontsize=11)
            y += 16
    scan = pymupdf.open()
    for n, src in enumerate(typeset):
        pix = src.get_pixmap(dpi=200, colorspace=pymupdf.csGRAY)
        pg = scan.new_page(width=src.rect.width, height=src.rect.height)
        pg.insert_image(pg.rect, pixmap=pix)
        damage = {(p, w): bad for p, w, bad in DAMAGE if p == n}
        for x0, y0, x1, y1, w, *_ in (src.get_text("words") if layer else []):
            w = damage.get((n, w), w)
            if not w:
                continue
            font = "tiit" if w == ITALIC else "tiro"
            pg.insert_text((x0, y1 - 2.5), w, fontname=font, fontsize=11, render_mode=3)
    scan.save(str(path))


print("a synthetic scan, end to end")
if not c.tesseract():
    print("  skip  tesseract is not installed")
else:
    import pymupdf
    with tempfile.TemporaryDirectory() as td:
        pdf = Path(td) / "witnesses.pdf"
        make_scan(pdf)
        col, why = c.collate(pdf)
        check("both sheets are read as scans", (why, col.scanned), (None, [0, 1]))
        got = " ".join(w["out"] for w in col.words if w["out"])
        for _p, word, bad in DAMAGE:
            if word in ("evidence", "careful", "mistake"):
                check(f"  the layer's {bad!r} is mended to {word!r}",
                      (word in got.split(), (bad or "§") in got.split()), (True, False))
        check("  a word the layer lost is kept from the page",
              "entirely" in got.split(), True)
        check("  the C~B agreement is measured", 0.8 < col.agreement["C~B"] < 1.0, True)
        italic = [w["out"] for w in col.words if w["it"]]
        check("  the layer's italic is carried onto the word", italic, [ITALIC])
        check("a sheet whose layer is sound keeps it; the corrections are patches",
              (col.rewrite, len(col.patches) >= 3), (set(), True))
        # The writer, forced, as for a sheet with no sound layer.
        col.rewrite = set(col.scanned)
        dst = Path(td) / "collated.pdf"
        c.write_layer(pdf, dst, col)
        with pymupdf.open(str(dst)) as d:
            text = " ".join(" ".join(p.get_text().split()) for p in d)
            fonts = {s["font"] for p in d for b in p.get_text("dict")["blocks"]
                     for l in b.get("lines", []) for s in l["spans"] if s["text"].strip()}
            sizes = {round(s["size"], 1) for b in d[0].get_text("dict")["blocks"]
                     for l in b.get("lines", []) if "careful" in "".join(
                         s["text"] for s in l["spans"]) for s in l["spans"]}
        check("the collated PDF reads back the mended text",
              all(w in text for w in ("careful", "mistake", "evidence", "entirely")), True)
        check("  italic in the font name, where pdf_to_source looks for it",
              any("Italic" in f for f in fonts), True)
        # Set in 11pt Times; the size is estimated from the ink, so near it, and the SAME for
        # every word of the line however much each was stretched to its box.
        check("  every word of a line reads back at the line's one size",
              (len(sizes), 8.0 < min(sizes) < 14.0), (1, True))
        with pymupdf.open(str(pdf)) as a, pymupdf.open(str(dst)) as b:
            check("  the page images are untouched",
                  [x["xref"] for x in a[0].get_image_info(xrefs=True)] != [] and
                  len(b[0].get_image_info()) == len(a[0].get_image_info()), True)

        # A third witness, with damage of its own, outvotes both other readings.
        wit = Path(td) / "Full text of witnesses.txt"
        wit.write_text(TRUTH.replace("argument", "argurnent") + "\n", encoding="utf-8")
        col3, _ = c.collate(pdf, witness=wit)
        got3 = " ".join(w["out"] for w in col3.words if w["out"])
        check("with a witness, the witness and C outvote the layer, and C and the layer "
              "outvote the witness", ("argument" in got3.split(), "argurnent" in got3,
                                      "careful" in got3.split()), (True, False, True))
        check("  the C~A agreement is measured", col3.agreement.get("C~A", 0) > 0.8, True)

        # The dispute strips: an image per batch, under the inline cap for a small batch.
        if col.disputes:
            paths = c.dispute_strips(pdf, col.disputes[:4], Path(td) / "strips")
            check("dispute strips are written", all(p.exists() for p in paths), True)
        else:
            fake = [dict(n=1, sheet=1, line=[50, 60, 300, 75], boxes=[[50, 60, 90, 75]])]
            paths = c.dispute_strips(pdf, fake, Path(td) / "strips")
            check("dispute strips are written", paths[0].stat().st_size < 200_000, True)

        # Pages missing from a scan: printed 11, 12, then 15, 16.
        gap = Path(td) / "gap.pdf"
        make_scan(gap, folios=(11, 12))
        import pymupdf as pm
        more = Path(td) / "more.pdf"
        make_scan(more, folios=(15, 16))
        with pm.open(str(gap)) as g, pm.open(str(more)) as m:
            g.insert_pdf(m)
            g.save(str(Path(td) / "gapped.pdf"))
        colg, _ = c.collate(Path(td) / "gapped.pdf")
        check("two pages missing from the scan are found from the printed folios",
              [(m["after_sheet"], m["before_sheet"], m["missing"]) for m in colg.missing],
              [(2, 3, 2)])

        from ipsissima_mcp import ingest
        # An image-only scan: nothing to vote with, so its sheets are rewritten from the fresh
        # reading, and what tesseract was unsure of is what is asked about.
        bare = Path(td) / "bare.pdf"
        make_scan(bare, layer=False)
        colb, _ = c.collate(bare)
        check("a sheet with no layer is rewritten from the fresh reading",
              colb.rewrite, {0, 1})
        _, notesb = ingest.ingest_one(str(bare))
        check("  and converts through the collated copy",
              any(n.startswith("collated route") for n in notesb), True)

        # The route ingest takes: the collated copy through the structured converter.
        extras = {}
        md, notes = ingest.ingest_one(str(pdf), collate=True, extras=extras)
        check("ingest's collated route names itself in the notes",
              any(n.startswith("collated route") for n in notes), True)
        check("  and the converted text carries the mended words",
              all(w in md for w in ("careful", "evidence", "entirely")), True)
        check("  and records the collation for the reply", "collation" in extras, True)
        check("  the corrections are made in the kept layer's text",
              any("corrections to them were made in the text" in n for n in notes), True)
        _md, notes1 = ingest.ingest_one(str(pdf))
        check("collation is the default for a scan, damaged or not",
              any(n.startswith("collated route") for n in notes1), True)
        md2, notes2 = ingest.ingest_one(str(pdf), collate=False)
        check("collate=False keeps the old route", any("collated" in n for n in notes2), False)

print()
if fails:
    print(f"{fails} FAILED")
    sys.exit(1)
print("all collation checks passed")
