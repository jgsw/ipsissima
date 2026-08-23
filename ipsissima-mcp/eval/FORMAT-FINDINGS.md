# Non-PDF ingestion — measured 20 Aug 2026

Tested with pandoc 3.10.1 (inside Zettlr.app; **not on `PATH`**, so `PYPANDOC_PANDOC` must point
at it) against real files from the library and the workspace, not toy documents.

**The assumption that pandoc handles these is right.** It reads `docx`, `epub`, `odt`, `html`,
`latex`, `rtf`, `markdown` and thirty more. The structured formats are also the *easy* case: no
layout to misread, no OCR, no column order. Every hard problem in this pipeline is a PDF problem.

**But "nothing will be necessary" is wrong in four ways, and three of them are silent.**

## 1. `--wrap=none` is mandatory, not a preference

The paragraph locator only scores lines of at least 120 characters (`MIN_PARA`). Pandoc's default
wraps at 72. Measured on a 171,000-word epub:

| | lines | **usable positions** |
|---|---|---|
| `--wrap=none` | 4,485 | **1,376** |
| pandoc default | 22,113 | **1** |

Same words, same headings, and a file that looks perfectly good. One locatable position in a
book. Nothing warns you.

## 2. Markdown is not exempt — granularity is still a decision

The same ceiling applies to a `.md` that arrives already written. One line per paragraph gives one
position per paragraph: fine for a forty-paragraph article, useless for a short passage. This is
exactly why the Darwin converter breaks its two paragraphs at Darwin's own semicolons and hinges,
turning 2 positions into 9 for 14 claims.

**The granularity decision is made at ingest whatever the input format**, and retro-fitting it
means redoing the reconstruction.

## 3. Tracked changes: pandoc silently picks a side

`--track-changes` defaults to **`accept`**. On a real edited document from the workspace:

| mode | words |
|---|---|
| `accept` (the default) | 2,466 |
| `reject` | 2,482 |
| `all` | 2,849 |

Three different documents out of one file. **For this workspace that is the worst possible
default**, because the whole author-round protocol rests on tracked changes carrying the author's
decisions — the standing rule is that a deletion or replacement is a decision and may never be
silently reverted. Ingesting a draft with unresolved changes as though it were settled text
commits to one side of every edit, invisibly.

98 of the 586 `.docx` files scanned in the workspace and research folders carry tracked changes.

**Ingest must detect and report them, not silently accept.** The check is cheap: `<w:ins ` or
`<w:del ` in `word/document.xml`.

## 4. Heading recovery from `.docx` is unreliable, and it is the author's fault, not pandoc's

Pandoc maps Word **Heading styles** to markdown headings. Many real academic drafts do not use
them — the 21,000-word paper tested here uses **no paragraph styles at all**, its headings set by
direct formatting, which is semantically invisible. Pandoc correctly produced zero headings.

Not fixable from the file; inferring headings from bold-and-larger is the PDF problem again. It
matters less than it used to: `section` is now optional, and `resolve_lines` falls back to a
whole-file paragraph search.

## What does work well

**Footnotes.** 177 Word footnotes converted to 177 `[^n]:` reference-style bodies with the
markers left inline, so the reference keeps its position in the text and the body lands at the
end — the same shape as the `# Notes` convention the PDF converter already uses.

## EPUB, specifically

31 in the library. Chapter structure survives as headings (42 in the book tested). But pandoc
concatenates the whole book into **one file**, and the `chapter` provenance field expects a file
*path* — so a monograph becomes a single "chapter" and the exposition-order view loses its bands.
For a book, split on top-level headings at ingest and write a `_quarto.yml` listing the parts.
DRM-protected epubs will not open at all.

## The ingest router, then

Simpler than the PDF case suggested:

```
.pdf                    -> probe_pdf.py, then pymupdf4llm (+rapidocr where the probe says so)
.docx/.odt/.epub/.html  -> pandoc --wrap=none, and:
                             * refuse or flag if tracked changes are present
                             * split epub on top-level headings, write _quarto.yml
                             * report heading count; zero is legal but worth saying
.md                     -> pass through, but make the granularity decision explicitly
```
