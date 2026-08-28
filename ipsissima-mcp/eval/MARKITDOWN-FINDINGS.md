# markitdown — measured 27 Aug 2026

Microsoft's [markitdown](https://github.com/microsoft/markitdown), MIT, evaluated against the
frame `CONVERTER-FINDINGS.md` and `FORMAT-FINDINGS.md` already set up: does it do anything the
current ingest does not, anything it does better, and should it be adopted.

**The answer is no, no, and not at all — with one narrow exception for formats nothing in this
pipeline currently reads.** The measurements are below, including the ones that would have
supported the opposite conclusion had they come out differently.

Nothing in the project was modified. The library was installed into a scratch venv; `pyproject.toml`
and `.venv` are untouched.

## Which markitdown, and a repeat of this file's oldest lesson

`pip install "markitdown[all]"` on this machine installs **markitdown 0.0.2** — a version from
before the project was really written — and reports success. The current release is **0.1.7**.
The cause is that the `[all]` extra pins `youtube-transcript-api~=1.0.0`, which has no release
that resolves here, so pip silently walks backwards until it finds a version whose dependencies
are satisfiable, and 0.0.2 is old enough to ask for nothing.

That is the same failure this file recorded in August about `rapidocr`: **a converter comparison
is a comparison of installations**, and a resolver quietly choosing a two-year-old version is
indistinguishable from a bad tool. Everything below is 0.1.7, installed as
`markitdown[pdf,docx,xlsx,xls,pptx,outlook]==0.1.7`, which drops only the YouTube extra and is
out of scope anyway.

Worth recording separately: markitdown 1.x **does not support Python 3.14**, which is what this
project runs. Every release from 0.6.3 onward declares `Requires-Python >=3.8,<3.14`. Adopting
markitdown's current major line would mean pinning the project back a Python version.

## What it actually does, read from the source

| format | mechanism | structure recovered |
|---|---|---|
| **PDF** | `pdfplumber` per page; if *no* page looks form-like, the whole document is re-extracted with **`pdfminer.high_level.extract_text()`** | **none** — plain text |
| `.docx` | `mammoth` → HTML → `markdownify` | Word paragraph styles only |
| `.epub` | `zipfile` + the HTML converter, concatenated | HTML headings |
| `.html` | `markdownify` (BeautifulSoup) | HTML headings |
| `.pptx`, `.xlsx`, `.msg`, `.ipynb`, `.zip`, `.csv` | format-specific readers | tables, slide markers |
| `.jpg`, `.png`, audio | `exiftool` metadata, **plus an OpenAI call if configured** | n/a |
| Azure Document Intelligence / Content Understanding | **network**, needs an endpoint and credentials | n/a |
| YouTube, Bing, Wikipedia, RSS | **network**, URL inputs | n/a |

The network-dependent paths are all opt-in and inert unless a client or endpoint is passed.
Verified rather than assumed: with `socket.socket.connect`, `connect_ex`, `create_connection`
and `getaddrinfo` all replaced by a raising stub, conversion of a `.pdf`, `.docx`, `.pptx` and
`.xlsx` **all completed normally with no socket opened**. On local files markitdown is offline,
and the LLM features cannot fire by accident.

**There is no OCR anywhere.** markitdown has no answer at all for a scan without a text layer —
the case `probe_pdf.py` puts at ~2% of the library, and on which `pymupdf4llm + rapidocr` returned
10,120 words where plain extraction returned 22.

## The PDF measurement

Six papers, every one with a committed reconstruction whose quotations can be checked. Four arms:
the **committed** source (the control — what is in the repo now), **ingest** (`python -m
ipsissima_mcp.ingest`, the shipping default), **pdf_to_source** (the bespoke arm, run with no
per-paper config), and **markitdown**.

`posn` = lines of at least 120 characters, the paragraph locator's own threshold — the ceiling on
how precisely any claim can ever be placed, fixed at conversion time. `quotes` is the
reconstruction's own quotations checked by the project's own
`argdown_provenance.check_quotations`, not a re-implementation: the thing that decides this in
production is the only thing entitled to decide it here.

| | words | posn | headings | page marks | hyphen breaks | quotes exact |
|---|---|---|---|---|---|---|
| **Akhlaghi**, 10pp born-digital | | | | | | |
| committed | 4,597 | 73 | 8 | 8 | 0 | **80/80** |
| ingest | 4,422 | 57 | 0 | 10 | 0 | 53/80 |
| pdf_to_source | 4,155 | 56 | 5 | 9 | 0 | **80/80** |
| markitdown | 5,509 | **0** | **0** | **0** | 64 | 53/80 |
| **Carroll**, 3pp clean scan | | | | | | |
| committed | 1,582 | 29 | 0 | 3 | 0 | 14/14 |
| ingest | 1,518 | 29 | 0 | 3 | 0 | 14/14 |
| markitdown | 1,714 | **0** | 0 | **0** | 3 | 14/14 |
| **Prescott-Couch**, 17pp | | | | | | |
| committed | 8,642 | 107 | 9 | 15 | 0 | **21/21** |
| ingest | 8,552 | 96 | 0 | 17 | 0 | 12/21 |
| markitdown | 10,466 | **0** | **0** | **0** | 114 | 12/21 |
| **Tooming**, 9pp two-column | | | | | | |
| committed | 8,895 | 85 | 12 | 8 | 0 | **27/27** |
| ingest | 10,852 | 150 | 0 | 9 | 0 | 20/27 |
| pdf_to_source | 8,784 | 84 | 12 | 8 | 0 | **27/27** |
| markitdown | 10,711 | **4** | **0** | **0** | 89 | 20/27 |
| **Gettier**, 4pp bad OCR | | | | | | |
| committed | 1,264 | 15 | 1 | 3 | 0 | 27/27 |
| ingest | 1,441 | 17 | 0 | 4 | 0 | 23/27 |
| markitdown | 1,439 | **0** | 0 | **0** | 0 | 23/27 |
| **Horton**, 16pp | | | | | | |
| committed | 7,597 | 79 | 5 | 16 | 0 | **23/23** |
| ingest | 7,575 | 106 | 0 | 16 | 0 | 18/23 |
| pdf_to_source | 7,575 | 79 | 5 | 16 | 0 | **23/23** |
| markitdown | 7,418 | **0** | **0** | **0** | 109 | 18/23 |

Totals across the six: **388 positions** in the committed sources, 455 from ingest, 336 from
`pdf_to_source` — and **4 from markitdown.** On quotations, 192/192 committed, 180/192
`pdf_to_source`, 140/192 ingest, **140/192 markitdown**.

Conversion is fast — 0.21s to 1.73s — but this is not an advantage: the ingest CLI does the same
papers in 0.21s to 0.53s *including interpreter startup*. Both are sub-second. Speed is not a
differentiator here in either direction.

## Against the four criteria

**1. Paragraph identity — markitdown fails outright.** `pdfminer.extract_text()` breaks at every
*printed* line, so the output is a file in which **no line reaches the locator's 120-character
threshold**: 4 scorable positions across six papers against the current route's 455. This is not
a new discovery; it is the granularity trap this file already recorded on the Carroll — "1,428
correct words and *zero* locatable positions" — and markitdown walks into it on every paper. It
is also unfixable downstream without re-deriving the paragraphs, which is the work `plain_text()`
does with `get_text("dict")` and markitdown does not do at all.

**2. Page numbers — recoverable in principle, and silently conditional in practice.** markitdown
emits no `<!-- p.N begins here -->`, but pdfminer leaves a form feed between sheets, and those are
reliable: 9, 2, 16, 8, 3 and 15 form feeds for PDFs of 10, 3, 17, 9, 4 and 16 sheets. So sheet
boundaries could be reconstructed.

Two things spoil it. First, a form feed gives the **sheet index, not the printed number** —
Horton's pages are printed 514–529, and `paginate.py` exists precisely because "the number is
read, not counted". Second, and worse: markitdown only takes the pdfminer path **when no page in
the document looks form-like**. If any single page does, the whole file is assembled from
pdfplumber chunks joined with `"\n\n"` and every form feed disappears — including from the prose
pages. Constructed and confirmed: a 3-sheet all-prose PDF yields 2 form feeds; the *same* prose
pages with one table page in front yield **0**. The only page signal markitdown offers is
contingent on document content, and its loss is silent.

**3. Section structure — zero, on all six papers.** No heading markup is produced from a PDF
under any circumstance; the PDF path has no heading logic. The current default route also finds
0 from a PDF, so on this criterion markitdown *ties the default* — but it loses to
`pdf_to_source.py`, which found 5, 1, 3, 12, 2 and 5, including the Tooming's full 11-section
hierarchy off a two-column layout.

**4. Verbatim quotation — markitdown ties the default route exactly, and both lose badly to the
bespoke arm.** 140/192 against `pdf_to_source`'s 180/192. The tie is not a coincidence, and
chasing it down produced the most useful thing in this evaluation.

## Hyphenation is nearly the whole deficit — and it indicts the current default too

markitdown and `ingest` scored *identically* on all six papers. Applying the project's own
`dehyphenate()` to each output and re-scoring shows why:

| | raw | de-hyphenated | committed |
|---|---|---|---|
| Akhlaghi, ingest | 53 | 77 | 80 |
| Akhlaghi, markitdown | 53 | 77 | 80 |
| Tooming, ingest | 20 | 27 | 27 |
| Tooming, markitdown | 20 | 27 | 27 |
| Horton, ingest | 18 | 21 | 23 |
| Horton, markitdown | 18 | 21 | 23 |
| Prescott-Couch, ingest | 12 | **12** | 21 |
| Prescott-Couch, markitdown | 12 | **21** | 21 |

**`ingest.plain_text()` never calls `dehyphenate()`.** It joins a block's printed lines with a
space and stops, so the Akhlaghi source it writes contains 61 artefacts of the form `re- garding`,
`accommo- dates`, `plaus- ible`, `high- paying`. The committed source has none, because it was
made by `pdf_to_source.py`, whose `finish()` does call it. Of the 27 quotations the default route
loses on the Akhlaghi, **24 come back from de-hyphenation alone**, and 35 do across the six papers
— taking the default from 140/192 to 175/192. This is a defect in the current code,
found by using markitdown as a control, and it is the single most actionable thing here — but it
is a finding about `ingest.py`, not an argument for markitdown, which fails the same way for the
same reason.

The Prescott-Couch row exposes a second, smaller bug in the same function. `dehyphenate(text,
soft)` trusts soft hyphens when the document has any, and that PDF's pymupdf extraction contains
**4** of them against ~114 ASCII line-end breaks — enough to flip the branch and leave every real
break unrepaired.

## And markitdown cannot be repaired the same way, because pdfminer throws the signal away

The reason `dehyphenate()` is careful is in its own docstring: a justification break is
U+00AD SOFT HYPHEN and a compound hyphen is ASCII, and "a blanket rule that joins on any hyphen
corrupts the compounds — `well-established` came back as `wellestablished`, which is not a word
and is not flagged by anything."

**pymupdf preserves the soft hyphen; pdfminer does not.** The Tooming carries 86 soft hyphens
through the current route and **0** through markitdown. So markitdown's output can only be
de-hyphenated with the blunt ASCII rule, and the blunt rule does exactly the damage the docstring
warns about. Measured against the compounds present in each committed source:

| | compounds | welded by the blunt rule |
|---|---|---|
| Prescott-Couch | 38 | **5** — `anti-realism`, `pseudo-problems`, `reverse-engineer`, `reverse-engineering`, `self-interpreting` |
| Tooming | 34 | 3 — `self-report`, `self-reports`, `well-established` |
| Akhlaghi | 18 | 1 — `high-paying` |
| Horton | 9 | 1 — `one-in` |

Ten real compounds destroyed across the corpus, including the term in the Prescott-Couch paper's
own title. `reverseengineering` is not a word, nothing flags it, and no quotation containing it
will ever verify. **This is the decisive PDF finding**: markitdown's 140/192 is not merely equal
to the current route's, it is *less repairable* than it, because the information needed to repair
it safely was discarded during extraction.

## The `.docx` question: neither recovers structure, and the outputs are byte-identical

Tested with a matched pair built for the purpose — identical words, headings carried two different
ways — because no real document lets you attribute a failure to the mechanism rather than the file.

| | pandoc `--wrap=none` | markitdown |
|---|---|---|
| `semantic.docx` (real `Heading 1`/`Heading 2` styles) | **5 headings**, 178 words | **5 headings**, 178 words |
| `direct.docx` (bold, 16pt, no style at all) | **0 headings**, 173 words | **0 headings**, 173 words |

The two converters' Markdown is **byte-identical apart from a trailing newline**, for both files.
Both emit `**1. Introduction**` for the direct-formatted case: bold preserved, heading not
inferred. Both also discard the font size, so even a downstream "promote a short bold-only
paragraph" heuristic could not recover the *level* distinction from either output.

So the answer to the question posed is **neither**, and `FORMAT-FINDINGS.md`'s reading stands
unchanged: this is not fixable from the file, because a direct-formatted heading is semantically
empty. markitdown offers no route in that pandoc does not, and no route out.

## Tracked changes: a real regression

`ingest.py` **refuses** a `.docx` carrying unresolved tracked changes, on the ground that the
author-round protocol treats a deletion as a decision. On a document where "The right is
~~absolute~~ *pro tanto* and can be outweighed":

| | result |
|---|---|
| `ingest.py` | **REFUSED**, with the count of insertions and deletions |
| `pandoc --track-changes=accept` (default) | The right is pro tanto and can be outweighed. |
| `pandoc --track-changes=reject` | The right is absolute and can be outweighed. |
| `pandoc --track-changes=all` | both, marked with author and date |
| **markitdown** | **The right is pro tanto and can be outweighed.** |

markitdown silently takes the accept side. There is **no option to do otherwise** — grepping the
whole installed package for `w:ins`, `w:del`, `revision` or `track` returns nothing, and
`DocxConverter.convert` passes mammoth only a `style_map`. `FORMAT-FINDINGS.md` calls silent
acceptance "the worst possible default for this workspace", and 98 of 586 `.docx` files scanned
there carry tracked changes. Adopting markitdown for `.docx` would replace a refusal with a
silent, unconfigurable choice.

## `.rtf` and `.tex`: reported as successes, returned as source code

The router sends `.odt`, `.rtf` and `.tex` to pandoc. markitdown handles none of them, but only
one of them *says* so:

| | markitdown |
|---|---|
| `.odt` | `UnsupportedFormatException` — fails loudly, which is correct |
| `.rtf` | **"success", 258 words**: `{\pard \ql \f0 \fs24 \sa180 ... 1. Introduction\par}` |
| `.tex` | **"success", 173 words**: `\section{1. Introduction}\label{introduction}` |

The mechanism is in `PlainTextConverter.accepts()`: `if stream_info.charset is not None: return
True`. Magika detects a charset for any decodable text file, so **any** text-based format —
RTF, LaTeX, BibTeX, XML, source code — is accepted and handed back verbatim, labelled Markdown.
A `.rtf` ingested this way would produce a source file whose "paragraphs" are RTF control words,
in which no quotation could ever verify. Given this project's standing rule that a converter which
mis-handles something quietly is worse than one that says what it did, this is disqualifying on
its own for the pandoc-covered formats.

## EPUB: pandoc wins on every measure

Nozick, *Anarchy, State, and Utopia*, a real 158,000-word monograph:

| | words | lines | positions | headings | time |
|---|---|---|---|---|---|
| `pandoc --wrap=none` | **158,271** | 13,269 | **1,150** | **115** | 1.8s |
| markitdown | 146,951 | 4,296 | 947 | 94 | 1.4s |

markitdown loses 11,320 words (7%), 203 positions (18%) and 21 headings, and saves 0.4 seconds.

## Does it do anything the current approach does not?

Honestly, yes — three things, none of which is about this corpus.

1. **`.msg` (Outlook), `.zip` (recursive), and images/audio.** Genuinely outside pandoc's reach.
   Whether Ipsissima should ever reconstruct an argument from an email is a separate question;
   nothing in the router suggests so.
2. **A pip-installable dependency instead of a 190MB binary.** This is the strongest real
   argument for markitdown and it is an operational one, not a quality one. `ingest.py` currently
   finds pandoc via `PYPANDOC_PANDOC` or a hardcoded `/Applications/Zettlr.app/Contents/
   Resources/pandoc`, i.e. the project depends on a *text editor* being installed. That is
   fragile, and worth solving — but markitdown does not solve it, because it reads only 3 of the
   6 formats the router sends to pandoc (`.docx`, `.epub`, `.html`; not `.odt`, `.rtf`, `.tex`)
   and is worse on one of the three. Pandoc would have to stay anyway.
3. **`.xlsx` from `openpyxl`-written files**, which pandoc 3.10.1 fails to parse — it looks for
   `xl//xl/worksheets/sheet1.xml` when the relationship target is absolute. A pandoc bug rather
   than a missing capability, and spreadsheets are marginal here.

**Does it do anything better? No.** Not one of the four criteria, on any of the six papers, in
either direction. The single number where it leads — Prescott-Couch de-hyphenated, 21 against
ingest's 12 — is a symptom of *its own information loss* (no soft hyphens to trip the current
code's faulty branch) and comes at the cost of 5 welded compounds.

## What could not be tested, and why

- **A scanned PDF with no text layer at all.** markitdown has no OCR, so the outcome is knowable
  without running it (an empty or near-empty file), but the *behaviour* — whether it errors or
  returns a well-formed empty document — was not observed. Given the ~2% of the library in this
  state, someone adopting markitdown should check it.
- **The Azure Document Intelligence and Content Understanding paths**, which are the only ones
  that would produce real PDF structure. They require an Azure endpoint and credentials and send
  the document to a third party. Out of scope by the project's own standing rule about
  copyrighted articles in a personal library, and not tested for that reason rather than a
  technical one.
- **LLM image captioning**, same reason: needs an OpenAI key and a network call.
- **markitdown 1.x.** Cannot be installed on Python 3.14, which is what this project runs. All
  results are 0.1.7. It is possible — untested, and unlikely given the PDF path is the same
  pdfminer call — that a 1.x release improves PDF handling.
- **A `.docx` with equations.** markitdown converts OMML to LaTeX in `pre_process_docx`; pandoc
  also reads OMML. Not compared, and irrelevant to the present corpus.
- **The Gettier's 8 labelled repairs** were not re-scored through `eval_converter.py`, because
  that harness still points at `ROOT/"Argdown samples"` and `../Build scripts`, neither of which
  exists since the reorganisation. Quotation verification against six real reconstructions was
  used instead, and is a stronger test: 192 checks rather than 8.

## Recommendation

**Do not adopt markitdown, for any format.**

For PDFs it is disqualified twice over: it produces **4 locatable positions across six papers
where the current route produces 455**, which alone makes it unusable for a tool whose claims cite
paragraphs; and its extraction discards the soft hyphens that make de-hyphenation safe, so its
quotation deficit is not merely equal to the current route's but harder to repair. It finds no
headings and no page numbers, and its one page signal vanishes silently if any page in the
document looks like a table.

For `.docx` and `.html` it is byte-for-byte what pandoc already gives, minus `--track-changes`,
which this workspace specifically needs. For `.epub` it is measurably worse. For `.odt` it fails
loudly and for `.rtf` and `.tex` it fails **silently**, returning markup as prose.

Two things this evaluation turned up are worth acting on, and neither involves markitdown:

1. **`ingest.plain_text()` should de-hyphenate.** It costs 35 of 192 quotations across the sample,
   24 of them on the Akhlaghi alone. `pdf_to_source.finish()` already does it; the default route
   does not, and the divergence appears to be an oversight rather than a decision.
2. **`dehyphenate()`'s soft-hyphen branch should require more than one soft hyphen.** Four stray
   ones in a 17-page paper currently disable ASCII repair for the whole document.

The one legitimate grievance markitdown surfaces — that ingest depends on Zettlr.app shipping a
pandoc binary — is real and worth fixing, but by packaging pandoc properly, not by adopting a
converter that reads half the formats and loses the structure.
