# Documents that exist to be converted

**Small on purpose.** What is tested here is whether a converter recovers paragraphs, headings,
page numbers and words faithfully, and a two-page article tests that exactly as well as a
forty-page one at a twentieth of the cost to hold, read and re-run.

Nothing here needs an argument worth reconstructing, and nothing here needs a map. **A fixture
whose prose is dull is a better fixture**, because whoever reads the test output is looking at
the structure rather than at what the structure says.

The licence rule is `samples/`'s rule, for the same reason: a fixture carries a whole converted
document. Public domain, licensed for redistribution, or ours. What cannot be published is named
in `fixtures/private-corpus.json` instead — see `docs/CORPUS.md`.

## What a fixture is for

Coverage of the **failure modes**, which are format-specific and mostly known:

| | |
|---|---|
| two columns | a line straddling the midline hides the gutter |
| running heads and footers | repeat on every sheet and are not the article |
| printed page numbers | differ from sheet numbers, and provenance cites the printed one |
| footnotes | a numbered line low on the page, and everything under it |
| ligatures and soft hyphens | decide whether a quotation will ever verify |
| ASCII hyphens at line ends | the same question with the opposite answer — see `trust_soft_hyphens` |
| headings that are only large text | no style behind them, and no converter recovers them |
| equations and tables | survive as something, or silently destroy the page's structure |
| no text layer at all | the OCR path, and whether it is worth taking |

## What is here

**`russell-1912-problems-of-philosophy.epub`** — Project Gutenberg 5827, public domain, 156 KB.

An exception to "small on purpose", and it earns it: what this fixture tests is the route from an
EPUB to a *book of chapters*, and that cannot be tested on something with two chapters in it.
Gutenberg lumps Russell's fifteen chapters into three XHTML documents and sets them as `<h2>`
under an `<h1>` book title — so it exercises both halves of the gap found on it, that the EPUB
converter splits by document rather than by chapter, and that `split_manuscript` looked only at
`#`. It also carries Gutenberg's licence, which is furniture the converter now knows to drop.

Covers: **headings**, and the level-mismatch that is invisible from the inside — every word
present, valid Markdown, and thirteen chapters missing.

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/epub_to_source.py \
    fixtures/ingest/russell-1912-problems-of-philosophy.epub --out /tmp/russell
cat /tmp/russell/*.md > /tmp/russell-whole.md
python3 ipsissima-mcp/src/ipsissima_mcp/split_manuscript.py /tmp/russell-whole.md \
    --out /tmp/russell-chapters --level 2
```

Run it without `--level 2` first: the splitter now says the level is wrong rather than quietly
writing two files.

---

**`dewey-1896-reflex-arc.pdf`** — *The Psychological Review* III(4), 1896, pp. 357-370, public
domain, 848 KB. Pages 374-387 of the Internet Archive's scan of the bound volume
(`psychologicalrev03ameruoft`, marked NOT_IN_COPYRIGHT), copied out with their text layer
untouched.

The most productive fixture of the batch, because its text layer breaks a printed line into
**word-sized fragments** — one justified line arrives as five pieces whose `y0` values differ by
up to 5.2 points, following the skew of the page. Everything downstream that assumes a line is a
line comes apart on it, and none of it comes apart loudly.

Covers: **ASCII hyphens at line ends** (111 of them, no soft hyphens anywhere, so
`trust_soft_hyphens` correctly takes the blunt branch); **printed page numbers** that differ from
sheet numbers *and* are themselves OCR-damaged, so 357 and 370 read as `35` and `37`; and a row
the table above does not have — **a text layer whose lines are not lines**.

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/pdf_to_source.py \
    fixtures/ingest/dewey-1896-reflex-arc.pdf /tmp/dewey.md
python3 ipsissima-mcp/src/ipsissima_mcp/ingest.py \
    fixtures/ingest/dewey-1896-reflex-arc.pdf --out /tmp/dewey-ingest
```

The two disagree by 2,358 words and by 43 percentage points of verifiable text. See
`ipsissima-mcp/eval/INGEST-2026-08.md`.

---

**`ramsey-1928-mathematical-theory-of-saving.pdf`** — *The Economic Journal* 38(152), 1928,
pp. 543-559, doi:10.2307/2224098, public domain, 2.7 MB. Pages 16-32 of the Internet Archive's
microfilm scan of the issue (`sim_economic-journal_1928-12_38_152`). Ramsey died in 1930 and the
issue was published in 1928, so the work is out of copyright in both the UK and the US.

The largest file here and the one to drop first if the directory has to shrink — its weight is
34 layered microfilm images, and they are kept unrecompressed because the page image is what a
human reads a repair off.

Covers: **equations**, in the form the row does not anticipate. The prose converts well; the
mathematics is destroyed *in the scan's own OCR layer*, before any converter sees it, so no
choice of converter recovers it. Ramsey's first-order condition arrives as `v(a) = ag (*) >>` /
`Ww` / `er` / `ME` / `Sapien a`. Also covers **running heads** (49 dropped) and **printed page
numbers**, both of which `pdf_to_source.py` gets exactly right here.

---

**`miller-2019-uksc-41.pdf`** — *R (on the application of Miller) v The Prime Minister*
[2019] UKSC 41, 25 pp, 296 KB. Crown copyright, reusable under the **Open Government Licence**:
the Court's own terms page says you may re-use Crown copyright material from that site under the
OGL provided it is reproduced accurately. Downloaded from `supremecourt.uk`, not from the
National Archives — see the note below.

**The National Archives route is also fine, and was checked.** That site publishes judgments under
the **Open Justice Licence v2** rather than the OGL
(<https://caselaw.nationalarchives.gov.uk/open-justice-licence/version/2>), which was flagged as a
possible obstacle and is not one: it permits reproduction and re-use of judgment text, which is
all a fixture or a reconstruction does. Its `robots.txt` disallows `ClaudeBot`, `anthropic-ai` and
`Claude-Web` by name, so the XML was not fetched from there — that is a crawling restriction, not
a licensing one, and the two should not be confused.

Born-digital, one image, a clean text layer. It is here because **a judgment is cited by
paragraph number**, and its 71 numbered paragraphs are set as a two-column line: the number at
x0 72 and the text at x0 108, sharing one `y0`. That is not the shape of an article, and it is
the shape provenance depends on.

Covers: a row the table does not have — **a numbered paragraph as the unit of citation** — and
**ASCII hyphens at line ends** with the opposite answer to Dewey's: all three line-end hyphens in
this document are real compounds (`well-advanced`, `Self-Employed`, `run-up`), so the blunt rule
is wrong on every one of them.

---

**`robeyns-2017-wellbeing-freedom-social-justice.pdf`** — Ingrid Robeyns, *Wellbeing, Freedom and
Social Justice: The Capability Approach Re-Examined*, Open Book Publishers 2017,
doi:10.11647/OBP.0130, **CC-BY 4.0**, 268 pp, 1.87 MB. The publisher's own file — Adobe InDesign
CC 13.0, December 2017 — retrieved from OAPEN, which hosts it because openbookpublishers.com sits
behind a WAF challenge. Licence confirmed in Crossref, in DOAB, and in Thoth's own record.

The same exception Russell claims, for the same reason: the book path cannot be tested on
something that is not a book. What it adds to Russell is a *professionally typeset* one, where
the chapter titles are large text with no structure behind them.

Covers: **headings that are only large text** — the case `docs/CORPUS.md` names as still wanted,
and which this answers for PDF rather than `.docx`. pymupdf4llm finds **zero** headings in 268
pages, and `split_manuscript` then writes the whole 95,550-word book into one section called
"Front matter" and says nothing.

---

**`robeyns-2017-tei-chapters.zip`** — Open Book Publishers, CC-BY 4.0, 181 KB. The five chapter
files from the book's own TEI bundle; the images and the duplicate `entire-book.xml` are left out.

The reason this is here rather than only the PDF: **pandoc writes TEI and does not read it.**
`pandoc --list-input-formats` offers `docbook`, `jats` and `endnotexml`, and no `tei`, so a TEI
book had no route into the toolchain at all and the only way in was its PDF — recovering from ink
what the publisher already had in markup, which is the inversion `structured_source.py` exists to
complain about. `tei_to_source.py` now reads it: 5 chapters, 78,426 words, 106 footnotes, every
section heading and every emphasis from the publisher's own markup.

Covers: **headings**, **footnotes**, **block quotations**, and the fact that an extension is not a
format — `.xml` may be TEI, JATS or DocBook, and `.zip` is also how a `.docx` arrives, so both are
told apart by the namespace inside.

**`etievant-2026-sccs-causal-framework.pdf`** — *Journal of Causal Inference*, CC-BY 4.0, 731 KB.
Chosen for being diagram- and equation-heavy. Clean text layer, 7,936 words, 511 mathematical
glyphs surviving the conversion — and **zero headings**, because the plain-text route does not
recover them. That last number is the point of keeping it.

Covers: **equations and tables**, and the heading gap on the text-layer route.

---

## Wanted, licence verified, and not here

Three documents were selected for this set, cleared on licence, and could not be fetched from a
script. **Two of the three are now above**, obtained another way; one remains. They are **not** in
`fixtures/private-corpus.json`: every entry in that file answers "why private", and the honest
answer here is "it is not private, it was unreachable". A person with a browser can add the last.

| | licence, as verified | where it stands |
|---|---|---|
| *Miller* as **XML** (Akoma Ntoso), from `caselaw.nationalarchives.gov.uk/uksc/2019/41` | the site's API catalogue advertises the **Open Justice Licence v2**, *not* the OGL — check that before committing the XML | **Still wanted.** `robots.txt` there disallows `ClaudeBot`, `anthropic-ai` and `Claude-Web` by name. The PDF above is the same judgment from a publisher that permits fetching, so the *judgment* is covered and **the structured-XML route is not**. |
| Etiévant, Gail & Follmann, 'A causal framework for the self-controlled case series design', *J. Causal Inference* 14(1), doi:10.1515/jci-2024-0074 | **CC-BY 4.0**, confirmed in Crossref and DOAJ | **Here now**, as `etievant-2026-sccs-causal-framework.pdf`, added by hand. No script could fetch it: every De Gruyter host answers `HTTP 202` with an empty body and `x-amzn-waf-action: challenge`, and it is in neither Europe PMC, PMC nor arXiv. |
| Robeyns as **XML** | CC-BY 4.0; Thoth's record lists an XML edition as one of the published formats | **Here now**, and better than asked for: the publisher's own **TEI** bundle, above, rather than a generic XML export. Same AWS WAF challenge on `books.openbookpublishers.com`. |

The one thing the WAF cases share is worth knowing before writing a downloader: **a bot challenge
here is a `202` with a zero-byte body**, which every naive fetcher records as success. `curl -o`
writes an empty file and exits 0.


## Adding one

Name the file for what it is, and put a line in this README saying **which row above it covers**.
A fixture nobody can explain is one nobody dares delete.
