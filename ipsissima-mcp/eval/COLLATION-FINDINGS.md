# Collating a damaged scan — measured 17–18 Oct 2026

`collate.py` reads a scan's page images again with tesseract (witness **C**, 300 dpi, word
boxes), votes that reading against the PDF's own text layer (**B**) and, where the user has one,
any other OCR text of the same work (**A**), and leaves only the disagreements no vote could
settle for the model to read off the page. These are the measurements it was tuned and judged
on. The prototype it grew from was a 550-page DLI scan with an archive.org text as A: 98.9%
of tokens agreed between C and A, B settled about 1,500 disagreements, a word list about 260,
and about 500 were left.

## How it was measured

Each scan converted twice by `ingest.py`: `--no-ocr` (the text layer, through whatever route it
took before) and `--collate`. Nothing hand-labelled exists for most of these papers, so two
proxies stand in, both counted over the converted body:

* **non-words** — the share of alphabetic tokens of two letters or more that the system word
  list (`/usr/share/dict/words`, with common suffixes) does not know. Proper names count against
  both routes alike, so the difference is the signal, not the level.
* **letter-soup** — `ingest.SOUP`, runs of single lowercase letters, the damage the route was
  first built to escape.

The Gettier is the exception: `convert_source.py` in its sample folder carries eight
hand-labelled repairs, read off the page images for the converter comparison of 20 Aug 2026
(`CONVERTER-FINDINGS.md`), and `eval_converter.score_repairs` scores against them.

Two of the nine are public-domain fixtures (`fixtures/ingest/`); the rest are private, named
here and not quoted.

## The numbers

Collation time is `collate.collated_pdf` alone with an empty cache (rendering, tesseract on eight
cores, the vote, writing the collated PDF); warm is the same with the OCR kept.

| scan | sheets | C~B agree | non-words, layer → collated | soup | disputes left (word / formula) | collation cold / warm |
|---|---|---|---|---|---|---|
| Gettier 1963, JSTOR | 3 | 95.9% | 7.0% → 6.6% | 0 → 0 | 13 (11 / 2) | 2.4 s / 1.2 s |
| Carroll (Paper Capture) | 7 | 97.5% | 9.6% → 8.8% | 3 → 2 | 17 (16 / 1) | 3.9 s / 2.0 s |
| Dewey 1896 *(public)* | 14 | 97.9% | 2.8% → 2.6% | 0 → 0 | 56 (50 / 6) | 8.6 s / 2.5 s |
| Ramsey 1928 *(public)* | 17 | 91.7% | 4.0% → 3.7% | 0 → 0 | 143 (106 / 37) | 8.9 s / 3.0 s |
| Mackie 1965 | 20 | 95.0% | 3.8% → 3.7% | 2 → 0 | 133 (114 / 19) | 22.1 s / 13.7 s |
| Levinson 1980 | 24 | 93.1% | 4.4% → 4.5% | 74 → 6 | 60 (39 / 21) | 13.5 s / 7.8 s |
| Hobsbawm 2012 (letter-spaced layer) | 14 | 18.7% | 30.9% → 4.8% | 3,168 → 101 | 23 (23 / 0) | 10.4 s / 5.7 s |
| Trevor-Roper 2012 (letter-spaced layer) | 28 | 18.8% | 12.1% → 4.6% | 6,151 → 217 | 46 | 20.4 s / 11.5 s |
| Goffman 1952 (image only, 22 words of layer) | 13 | — | 29% → 2.6% | 0 → 0 | 14 unsure words | 12.2 s / 6.8 s |

**The Gettier's labelled repairs**: the text layer as the old route kept it, 0 of 8; collated
against the layer, **6 of 8** (the two half-lines lost at the page edge, both `sufficient`s, a
lost note number, the spaced quotes); a seventh, a note number the layer read as an
apostrophe, is among its 13 disputes. With a third reading added (below), **8 of 8**. The best anything managed in the converter comparison was
pymupdf4llm with rapidocr, 5 of 8.

**A third witness.** Nothing here has an archive.org text, so RapidOCR's own reading of the page
images (an independent engine, PaddleOCR models) stood in for A:

| scan | C~A agree | settled by majority | disputes left, B only → with A |
|---|---|---|---|
| Gettier | 94.0% | 24 | 13 → **2** |
| Dewey 1896 | 96.8% | 49 | 56 → 50 |
| Mackie | 87.9% | 291 | 133 → 108 |

A third witness is worth most where it is good: the Gettier's disputes almost vanish, and a weak
one (Mackie, 88% agreement) still settles 291 places by majority but leaves most of the rest.

**Time, whole extraction.** The collated route also runs the structured converter (headings,
note zones, page markers, the highlight sidecar), which the damaged-scan route never did, and
that is now most of the time: warm, 3.6 s for the Gettier, 15 s for Hobsbawm, 30 s for
Trevor-Roper, 38 s for Mackie (46 s cold). The old route's OCR on the same damaged scans was
the expensive one: pymupdf4llm with rapidocr had run over fifteen minutes on Hobsbawm's 14
pages when it was stopped.

## What the disputes are

What is left is mostly what no vote can settle: quotation marks the layer wrote as `?`, a note
number one engine raised and one did not, small capitals read as capitals by one engine and
lower case by the other, logic and mathematics. Three rules took the obvious ones out before
they reached anyone (Mackie, 460 → 133): quote marks and dashes are not asked about (the
normaliser folds them for quotation-matching anyway; the fresh reading's mark stands); a
difference of case alone goes to the fresh reading unless that is the garbled one; and a short
line in the top or bottom tenth of the page is furniture the converter drops. Each dispute
carries `kind`: a **formula** is one where every reading is symbols and lone letters, where
neither engine may be right and the page needs transcribing rather than choosing.

## What went wrong on the way, and is now guarded

* **Absence read as a reading.** The Gettier's layer lost the middle of three lines at the page
  edge; the fresh reading has them. A vote by "fewer unknown words" preferred the two-letter
  fragment. Now a longer reading that is mostly words wins over a fragment of it.
* **The whole text lost to a header.** Goffman's layer is a 22-word database header over image
  pages; counted as totals, that header beat ten thousand words. Badness is now compared only
  between readings of about the same length, and a layer that holds under a fifth of what the
  fresh reading found on a page is no witness to that page.
* **Order.** A word set very narrow was written large to read back at its line's size, and its
  box rose above the line, which put two lines out of order. The squeeze is now bounded.
* **Columns.** Wide gaps inside one printed line (running heads, tables) are bridged so the line
  reads as one, but never across a column gutter, found by the upright strip few lines cross.
* **Speed.** One `insert_text` per word re-read the page's content stream every time (75 of
  138 s on Mackie); one shape per page, one commit.

## Follow-ups not done here

* Pages missing from a scan are found from the printed folios and reported (tested on a
  synthetic scan; none of these nine has a gap), but the page markers still number by one
  offset, so pinpoints after a gap are off until the converter learns per-run offsets.
* A drop capital the layer did not read stays apart from its word (`V ARIOUS`).

## Made the default, 18 Oct 2026 — and why sound layers are now kept

Ruled 18 Oct 2026: collation is the DEFAULT for every scan, not only one whose layer looks
damaged, and the seven private scans here joined the regression list under "# Damaged scans"
(the two public ones were already in it).

Making it the default put the regression list's ordinary JSTOR scans through it, and the first
design -- rewrite every sheet's layer from the fresh reading -- broke what the converter had right
on them: 30 of 82 documents changed, and the expectations reported footnotes lost (9 to 0),
running heads and table rows read as headings, section headings missing. The text was better
and the structure worse, because pdf_to_source finds headings, note zones and note numbers by
type sizes the layer's own engine wrote. Imitating those sizes recovered much of it but not all.

So the design changed: **a sheet whose layer is a reading of it keeps it**, and the vote's
corrections are made in the converted text (`collate.patch`), each found between its neighbours
and never across a line break; only a sheet with no layer, a letter-spaced one, or one far more
non-words than the fresh reading is rewritten. The route (structured or plain) is chosen as it
always was, by the layer the converter reads. On a kept sheet a dispute leaves the layer's
reading standing unless the layer has nothing there; marks (quotes, dashes) are the layer's.

The regression list then: every expectation that held before still holds (0 broke); 9 known
defects fixed -- among them Wolff's two section titles the layer had cut short ("3 Themes f",
"3.3 A Princ"), which the page images print whole, and Ó Gráda's and Wolff's lines cut off at the
right edge of nearly every line, now whole; the maps lose one quotation, a map that quotes the
layer's misspelling `suffiient` (its own note says the page prints `sufficient`). Expectation
files whose recorded text was the damaged text were updated to the page's. Approved outputs were
re-saved, and the index now records the tesseract version beside PyMuPDF's: a machine without
tesseract (CI) converts as before, and its differences are printed, not failed.

The Gettier's labelled repairs on this design: 5 of 8 (the layer's two `sufficient`s, both lost
half-lines, the lost note number 1); the other three are the layer's own spacing -- `V ARIOUS`,
`follows :3`, `of' justified'` -- which a kept layer keeps.
