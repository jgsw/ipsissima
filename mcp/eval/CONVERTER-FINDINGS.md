# Converter comparison — measured 20 Aug 2026

> **CORRECTION, later the same day.** The `pymupdf4llm` row below was measured on a machine with
> **no OCR backend installed**, and the "catastrophic failure" it records is an artefact of that,
> not a property of the library. Installing Docling incidentally pulled in `rapidocr`; with it
> present, pymupdf4llm scores **5/8 on the Gettier — the best result of anything tested here,
> including marker.** The corrected table is at the foot of this file under "The survey". The
> original numbers are left standing rather than edited away, because the failure mode is worth
> remembering: a converter comparison is a comparison of *installations*, and an absent optional
> dependency looks exactly like a bad tool.

Run with `eval_converter.py` against the sample papers, scored on each paper's own `repairs=`
list: a hand-labelled record of where the PDF's text layer was wrong, what it should say, and
why — with every word-restoring repair read off a page image at 3.6×. Unlike the reconstruction
harness, **there is a fact of the matter here**: what a page says is not an interpretation.

## The numbers

| | words | positions | time | labelled repairs |
|---|---|---|---|---|
| **Gettier**, 3pp scan, bad OCR | | | | |
| `pdf_to_source.py` | 1,220 | 13 | 0.45s | 8, all by hand |
| `pymupdf4llm` | **345** | 8 | 1.5s | **0/8 — never reached the article** |
| `marker --mode fast` | 1,285 | 20 | 7.5s | 2/8 |
| `marker --mode balanced` | 1,279 | 18 | 31.3s | **2/8, identical** |
| `docling` (IBM, MIT) | 1,286 | 17 | 120.9s | **0/8** |
| **Williams**, 12pp scan | | | | |
| `pdf_to_source.py` | 5,756 | 41 | ~1s | — |
| `pymupdf4llm` | 5,798 | 55 | 1.0s | — |
| `marker --mode fast` | 5,637 | 46 | 40.0s | — |
| `marker --mode balanced` | 5,623 | 48 | 30.4s | — |
| **Tooming**, 8pp two-column | | | | |
| `pdf_to_source.py` | 8,766 | 76 | ~1s | 0 needed |
| `pymupdf4llm` | 10,739 | 147 | 2.4s | — |
| `marker --mode fast` | 10,368 | 143 | **738s** | — |
| `marker --mode balanced` | *0 — contaminated* | — | 267.3s | — |

**The Tooming `balanced` cell is not a marker result and must not be read as one.** That run was
still going when the orphaned `llama-server` from the previous run was killed to release 2.9GB;
the timings put the kill inside its window. It is recorded as contaminated rather than deleted,
because a zero in a results table is exactly the kind of number that later gets quoted as a
finding. Re-run it before citing it. Nothing else here depends on it: `fast` converted the same
paper successfully, and `balanced` showed no quality benefit anywhere it did complete.

`positions` = lines long enough for the paragraph locator to score. It caps how precisely any
claim can ever be placed, and it is fixed at conversion time.

## What was actually learned

**1. pymupdf4llm fails catastrophically on a bad OCR layer, not gracefully.** On the Gettier it
returned 345 words — the JSTOR accessibility notice and citation block — and none of the article
at all. Not a degradation; it never reached the text. On the two papers with a usable layer it is
fine, fast, and gives *finer* granularity than the existing converter.

**2. marker recovers the dangerous failures and none of the visible ones.** Both silently dropped
lines on Gettier p.122 — the class the existing converter can only *detect*, and which cost a
page-image inspection each — come back automatically. Every ligature and glyph error
(`siftcient`, `suffiient`, `V ARIOUS`, the spaced quotes, two dropped footnote markers) is
reproduced uncorrected. 2 of 8, and the 2 are the ones that mattered most.

**3. `balanced` mode is not better, and this was the surprise.** It was installed specifically to
test whether full-page OCR would repair the glyph errors. It repairs none of them — byte-identical
verdicts to `fast`, and `siftcient` survives verbatim. The OCR engine makes the same mistakes on
the same scanned glyphs whichever path reaches it. **Installing llama.cpp bought the ability to
process two-column papers at all, and nothing else.**

It is not reliably faster either, and the variance is wild: Gettier 7.5s `fast` against 31.3s
`balanced`, Williams 40.0s `fast` against 30.4s `balanced`. On the same machine, minutes apart.
Anything that budgets conversion time per page will be wrong.

**4. marker's reading order on two columns is perfect; its heading LEVELS are not.** Section
sequence came out 1, 2, 2.1, 2.2, 3, 4, 4.1–4.4, 5 — exactly right, and the column-order failure
that cost the existing converter 1,364 words never happened. But the levels are scrambled
(h3, h2, h3, h2, h3, h4, h5, h4, h4, h4, h2 for what are all siblings), and `section_span()` ends
a section at the next heading of the same or higher level. That gives **wrong spans for 4 of 11
sections**: sections 2.2 and 3 each swallow everything through to section 5. Deterministically
fixable — derive the level from the numbering depth rather than trusting the visual inference.

**5. Cost is the headline, and it leaks.** 738s against 2.4s and ~1s, plus a 2.9GB resident
`llama-server` — which **outlived the marker process that spawned it** and had to be killed by
hand. Anything shipping marker inside an MCP server has to own that lifecycle, or a colleague
running three papers ends up with three abandoned model servers and no idea why their machine
is swapping.

## What follows for Phase 1

**No converter here removes the hand-repair step.** marker changes *which* repairs are needed —
it takes away the silent dropped-word class and leaves the visible-garble class — but a human
with a page image is still required for a damaged scan. The bespoke `convert_source.py` escape
hatch is not made redundant by any of these.

**Route by damage rather than choosing a default.** The three papers want three different
answers, and which one they want is cheaply detectable *before* conversion:

- a text layer that yields almost nothing (Gettier: 345 words across 3 pages) — the signal is
  trivial and pymupdf4llm's own output announces it;
- a text layer with dropped words — `flag_stretched_lines()` already computes exactly this, from
  the geometry, and it is why the detector exists;
- a clean layer — take the cheap path and stop.

So: cheap converter first, escalate to marker only when the probe says the layer is bad, and fall
through to a bespoke converter when marker's residue is still wrong. That keeps the common case at
one second and spends twelve minutes only where twelve minutes buys something.

**Normalise marker's heading levels on ingest** before any of this reaches the locator.


---

# The survey — other libraries, checked 20 Aug 2026

The question was whether something else beats these before committing to route-by-damage.

## Measured

**Docling** (IBM, MIT, CPU-capable, no model server). On the Gettier: 1,286 words — the right
length, so unlike pymupdf4llm it reached the article — but **0 of 8** repairs, 120.9s. It
reproduces the damage rather than repairing it: where the text layer truncates to
`in which the conditions st`, Docling emits `in which the conditions s`. A slightly different
truncation of the same lost words. It also renders the drop cap as `V ARIOUS`, like everything
else. Slower than marker `fast` (7.5s) on this paper.

Docling remains the best *licensing* answer — MIT against marker's GPL-3.0 plus a RAIL-M weight
licence carrying commercial restrictions, which is a live consideration for a tool meant to be
shared — but it does not solve the problem marker solves.

## Considered and not tested, with reasons

| | why not |
|---|---|
| **GROBID** | Java service (Docker), 2-5s/page, best-in-class for academic *structure* — TEI XML with real section hierarchy. Solves a DIFFERENT problem: it would fix marker's scrambled heading levels, not the OCR layer. Worth revisiting for structure, not for damage. |
| **MinerU** | Strongest on CJK and formula-dense layouts; heavy, GPU-oriented. Neither strength is this corpus. |
| **Nougat** (Meta) | Known to repeat and hallucinate on out-of-distribution pages. Faithfulness is the one thing that cannot be traded here — a converter that invents text defeats the quotation checker downstream. |
| **olmOCR, Zerox, LlamaParse, Mathpix** | Send the PDF to a third party. These are copyrighted articles in a personal Zotero library; that is a licensing and privacy decision, not a technical one, and not one a converter should make silently. |

## What the survey actually established

**Every extractor here trusts the text layer, so none of them repairs a bad one.** pymupdf4llm,
Docling and `pdf_to_source.py` all inherit whatever the OCR left. marker is the only exception,
and only because `fast` mode block-OCRs the regions it flags as garbled — which is precisely why
it is the only tool that recovered the two dropped lines.

That reframes the escalation ladder. The rung above "cheap extractor" is **not a heavier
extractor** — Docling is 16x slower than marker `fast` here and scores worse. The rung above is
**regenerating the text layer**, either selectively (marker) or wholesale (`ocrmypdf --redo-ocr`,
MPL-2.0, which strips the invisible OCR text and re-runs Tesseract over masked page images).

`ocrmypdf` is the one untested candidate that attacks the root cause rather than working around
it, and if it works the cheap extractor becomes viable everywhere — which would remove marker,
its GPL/RAIL licence, its 2.9GB model server and its 738s from the pipeline entirely.


---

# The re-OCR test, and a correction — 20 Aug 2026

## The correction

`pymupdf4llm` was measured without an OCR backend. `rapidocr`, pulled in as a Docling
dependency, is enough to change its behaviour completely on the Gettier: **345 words to 1,358,
and 0/8 to 5/8.** Nothing about the library changed. The earlier finding — reported as
"catastrophic, never reached the article" — was a fact about this machine.

## The corrected scoreboard, Gettier's 8 labelled repairs

| extraction path | words | positions | repairs |
|---|---|---|---|
| `pdf_to_source.py` (hand-repaired) | 1,220 | 13 | 0/8 automatic, 8 by hand |
| plain pymupdf, original PDF | 1,327 | — | 0/8 |
| **`pymupdf4llm` + `rapidocr`, original PDF** | **1,358** | 24 | **5/8** |
| `marker --mode fast` | 1,285 | 20 | 2/8 |
| `marker --mode balanced` | 1,279 | 18 | 2/8 |
| `docling` | 1,286 | 17 | 0/8 |
| plain pymupdf, after `ocrmypdf --redo-ocr` | 1,343 | — | 2/8 |
| `pymupdf4llm`, after `ocrmypdf --redo-ocr` | **207** | 6 | 0/8 |

**No tool gets all eight, and the misses are not the same misses.** pymupdf4llm+rapidocr
recovers the drop cap, both dropped footnote markers, one ffi ligature and *one* of the two
dropped lines. marker recovers *both* dropped lines and no glyph errors. They are complementary,
which means a hand-repair step survives whatever is chosen.

## What ocrmypdf actually did

`--redo-ocr` works, and it works on the thing it was tested for: the regenerated layer contains
`in which the conditions stated in (a) are true for some proposition` and `it is at the same time
false that the person in question knows that proposition` — both dropped lines, in full, from a
4.3s run over masked page images.

But it is not free, and two things came with it:

- **It introduces its own glyph errors.** Tesseract renders `sufficient` as `sufÏcient` — a new
  corruption where the old layer had `siftcient`. Different error, not fewer.
- **It drops the drop cap entirely.** `V ARIOUS` becomes `ARIOUS`, losing a letter rather than
  misplacing a space.
- **It breaks pymupdf4llm.** The PDF/A output ocrmypdf produces takes pymupdf4llm from 1,358
  words to **207**. Whatever layout analysis pymupdf4llm does on the original, it cannot do on
  the rewritten file. So re-OCR and the best extractor are mutually exclusive on this paper.

Williams, whose text layer is adequate, is unaffected either way: 5,798 words before, 6,016
after, no residual corruption and 42 φ in both. Nothing gained, nothing lost.

## The two-column paper, which was marker's remaining argument

| Tooming, 8pp two-column | words | positions | time | headings |
|---|---|---|---|---|
| `pdf_to_source.py` | 8,766 | 76 | ~1s | authors' own, all one level |
| `pymupdf4llm` + `rapidocr` | 10,741 | **148** | **3.4s** | present, correct order, **uniform level** |
| `marker --mode fast` | 10,368 | 143 | **738s** | present, correct order, **levels scrambled** |

pymupdf4llm is **217x faster** than marker on the paper shape that matters most, finds more
positions, and gets the section hierarchy right where marker does not — marker's h3/h2/h3/h2/h4/h5
gives `section_span()` wrong spans for 4 of 11 sections, and pymupdf4llm's uniform `###` does not.

One ingest fix needed: pymupdf4llm wraps heading text in emphasis — `### **2. Hume and
abstraction**` — and `heading_index()` would capture the asterisks, so `section:` matching fails
until they are stripped. Small, deterministic, and the same class of fix marker would have needed
for its levels.

## Where this leaves the design

**The best single tool is the cheap one, correctly installed.** pymupdf4llm with an OCR backend
beats marker on the labelled set at a fraction of the cost, needs no model server, has no
licence encumbrance, and — importantly — escalates *by itself*: it triggers OCR on the Gettier
and not on the Williams, which is route-by-damage implemented inside the library.

That removes the main argument for marker. What marker still uniquely has is the second dropped
line, and that is one line on one paper.

**So the routing question changes shape.** It is no longer "which converter", but:

1. `pymupdf4llm` with `rapidocr` present, everywhere;
2. the existing stretch detector to *report* residual damage, since 3 of 8 known errors survive
   and a converter that fails silently is the thing this whole strand exists to prevent;
3. hand repair for what the detector flags, as now — no tool removes this;
4. `ocrmypdf --redo-ocr` kept as a documented escape hatch for a PDF whose layer is beyond use,
   accepting that it costs the pymupdf4llm path.

**Pin `rapidocr` as an explicit dependency.** It arrived here by accident, as a transitive
dependency of a library that was being evaluated and may not be kept. If Docling is uninstalled,
the pipeline silently returns to 345 words on a scanned paper, with no error anywhere.

---

# How many sources are enough? — measured 20 Aug 2026

Different answers for the two arms, and the cheap one is the one worth widening.

## The converter arm: yes, and it costs nothing

`probe_pdf.py` reports what a PDF's text layer is like **before** converting it, using three tells
that need no human to have read the paper: characters per page, **stretched lines** (an OCR layer
is drawn to fit the printed line it stands for, so a line that lost words is far wider than its
characters warrant), and column count. It reuses `detect_columns` from `pdf_to_source.py` rather
than reimplementing it — a hand-rolled sweep read the two-column Tooming as one-column and the
Williams as two, and that function's docstring already lists three earlier versions of the same
mistake.

On the Gettier it reports **exactly the two dropped lines** and nothing else, which is the whole
labelled set of silent damage, found without labels.

Run over a 50-PDF sample of the 1,996 in the library:

| | |
|---|---|
| clean | 44 |
| damaged (lines that lost words) | 5 |
| no usable text layer | 1 |
| single-column / two-column | 42 / 8 |

So roughly **12% of the library needs attention and 2% needs OCR outright** — on the order of 240
and 40 papers. That is the case for a wider corpus: not more labelled repairs, which are
expensive, but more *layout shapes*, which the probe grades for free.

## What the sample found that the four samples do not cover

**An image-only scan.** Goffman 1952, 13 pages at 10 characters per page — no text layer at all.
Neither the Gettier nor the Williams is this case: both have OCR layers, merely bad ones.

| | words |
|---|---|
| plain pymupdf | **22** |
| `pymupdf4llm` + `rapidocr` | **10,120** in 61.3s |

The strongest validation the recommended stack has had, on the hardest input in the sample, and
none of the four reference folders would have tested it.

## The reconstruction arm: no, not yet

Four is enough, and more would be premature. A reference reconstruction is expensive — the
Tooming was a full day's judgement — and their job is to cover argument *forms*, not papers. The
four cover elimination of alternatives (twice), refutation by counterexample, and a linked
two-condition argument. Missing: reductio, inference to the best explanation, dilemma,
transcendental argument.

**But building those now would repeat the mistake this strand exists to avoid.** The eval harness
was built before knowing what to measure and had to be rewritten once the "gold standard" framing
turned out to be incoherent. Reference reconstructions should be built for forms the generator is
*measured* to get wrong, which needs Phase 2 to exist. Until then a fifth reference is a guess
about where the difficulty lies.


---

# CORRECTION — 20 Aug 2026, on Carroll

**The conclusion above, that pymupdf4llm should be the unconditional PDF route, is wrong.** It
was right about which converter recovers most from a *damaged* text layer. It was wrong to make
that the default, and the reasoning that got it there — "it escalates to OCR by itself, so
route-by-damage is unnecessary as an architecture" — inverted the actual risk.

**It does escalate by itself. It also escalates when it should not.**

On Carroll's "What the Tortoise Said to Achilles" (*Mind* 1995, a reprint of the 1895 paper),
pymupdf4llm OCRed all three pages of a document whose text layer was **clean**, and rapidocr's
output replaced good text with letter-soup:

| route | words | garbled passages |
|---|---|---|
| the PDF's own text layer | **1,428** | **0** |
| pymupdf4llm + rapidocr | 1,222 | **6** |
| `ocrmypdf --redo-ocr` + text layer | 1,364 | 0 |

One of the six destroyed passages sits in the middle of the paper's central exchange. Nothing
reported it. The file looked perfectly well-formed, and the damage was found only by reading it.

**The probe did not catch this either**, and that is a second correction. The stretch detector
finds lines DRAWN WIDER than their characters warrant — the signature of words the OCR *dropped*.
It is blind to words the OCR *replaced*, because a substitution occupies the same width as the
clause it destroyed. `probe_pdf.py` now also reports letter-soup: runs of three or more
single-letter non-words, which English does not produce and garbled OCR is full of.

## The routing rule that gets both papers right

1. **The PDF's own text layer first.** Free, fast, and it cannot invent anything.
2. **Probe the result.** If it is clean, stop — this is what prevents the Carroll disaster.
3. **Only if damaged**, try `pymupdf4llm + rapidocr` and `ocrmypdf --redo-ocr + text layer`,
   score each, take the best, and **report every route tried with its score** so the choice is
   visible and reversible.

**There is no route that wins everywhere**, and the honest form of this finding is that the
choice is paper-dependent. On the Gettier, whose layer really is damaged, pymupdf4llm recovers
5 of 8 known errors against ocrmypdf's 2 — but introduces 5 garbled passages of its own, where
ocrmypdf introduces none. On the Carroll both make a clean document worse.

So route-by-damage was retired too early, and is back.

## And a granularity trap underneath it

The text layer breaks at every PRINTED line, so `get_text()` yields a file in which **no line is
long enough for the paragraph locator to score**: on the Carroll, 1,428 correct words and *zero*
locatable positions. `get_text("blocks")` groups lines back into paragraphs — same words, 29
positions. Faithful text with no usable granularity is not a usable source, and the ceiling is
set at conversion time.
