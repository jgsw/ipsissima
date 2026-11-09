# Unpetrify

Get the text out of a PDF, scanned ones included, as Markdown you can read, search and quote
from. It keeps the paragraphs, headings, footnotes and page numbers, and it tells you what it
could not do.

```bash
unpetrify paper.pdf          # writes paper.md beside the PDF
```

A PDF records where ink sat on a page. Paragraphs, columns, headings, footnotes and reading
order are not in the file; they have to be inferred from geometry. Most converters infer them
quietly. When they get it wrong, you get a well-formed file of the wrong text, and nothing tells
you. Unpetrify does the inference carefully, and it reports every choice it made, so you know
whether to look.

It is the converter inside [Ipsissima-MCP](../ipsissima-mcp/README.md), which reads papers into
argument maps that cite their text. Unpetrify offers it on its own, for anyone who only wants the
text.

## What comes out

- **Paragraphs joined across line and page breaks.** Hyphenation at a line end is undone, and
  ligatures (ﬁ, ﬂ) become plain letters, so a quotation typed by hand matches the text.
- **Headings** where the document marks them, or where its typography does. None is invented.
- **Footnotes lifted to the end.** They no longer interrupt sentences that run across a page.
- **Running heads, page numbers and download stamps removed.** The lines they sat on are kept,
  so nothing below them moves.
- **`<!-- p.N begins here -->` where each PDF page begins.** These count the PDF's sheets. The
  page a reader cites can differ (a cover, front matter), so check one page before citing by
  page.
- **A comment at the top of the file** that says what was done to the text and what could not
  be done.

**Scans are read again.** Where [tesseract](https://tesseract-ocr.github.io/) is installed
(`brew install tesseract`, or your system's package), every scanned page is OCRed afresh. The
new reading is then voted, word by word, against the old text layer, and against any other OCR
of the same work you give it with `--witness`. A majority settles a disagreement; failing that,
a word list does. What neither can settle is left as a **dispute**: the more reliable reading
stands, and the place is logged for someone to look at. The OCR is kept in your cache folder,
keyed by the file's contents, so a second conversion takes seconds.

**EPUB, .docx and HTML** go through [pandoc](https://pandoc.org/installing.html), which you
need to install for those formats. A publisher's HTML or EPUB is better than its PDF: the
structure is stated rather than inferred.

## Install

You need **Python 3.11 or later**.

**From a checkout of this repository** (Unpetrify is not on PyPI yet):

```bash
uv tool install ./unpetrify       # puts `unpetrify` and `unpetrify-mcp` on your PATH
```

Or in a virtual environment: `python3 -m venv .venv && .venv/bin/pip install -e unpetrify`.

**OCR is not optional.** `rapidocr` installs with the package. Without an OCR backend, a scanned
paper converts silently to its cover page and nothing reports it.

## The command

```bash
unpetrify paper.pdf                       # paper.md beside the PDF
unpetrify *.pdf -o ~/Texts                # one .md each, into ~/Texts
unpetrify scan.pdf --stdout > scan.md     # one source, Markdown to stdout
unpetrify scan.pdf --witness "Full text of ....html"   # a third reading for the vote
```

The report goes to stderr, so `--stdout` stays clean. Other options: `--no-ocr`,
`--collate` / `--no-collate`, `--figures section|omit`, and `--geometry`, which also writes
every word's box on the page beside the text (what Ipsissima uses to place highlights in Zotero).

**A PDF inside Zotero's storage folder is never written beside.** Its text goes to a temporary
folder named for the attachment, and the report says where.

## The MCP server

`unpetrify-mcp` serves the same conversion to an assistant. To add it to Claude Code:

```bash
claude mcp add unpetrify -- unpetrify-mcp
```

For Claude Desktop, build the bundle with `node unpetrify/build_mcpb.mjs` (from a checkout that
has run `npm install` in `app/`) and double-click `unpetrify/build/unpetrify-<version>.mcpb`.

| tool | |
|---|---|
| `extract_text` | documents to Markdown, written to disk; the reply carries the converter's notes |
| `read_text` | read a written file back in parts, for an assistant with no file access of its own |
| `assess_pdf` | how hard is this PDF to convert, and does a machine-readable version exist? |
| `page_images` | crops of damaged passages, for an assistant to read |
| `repair_source` | apply corrections read off those crops |
| `collation_disputes` | where a re-read scan's readings disagreed: every reading, and the printed lines as images |
| `settle_disputes` | apply what those images say, to the text and to the scan's record |
| `add_page_numbers` | a PDF's page numbers onto text taken from a better source |

## The pieces

| | |
|---|---|
| `cli.py` | the `unpetrify` command |
| `server.py` | the MCP server |
| `tools.py` | what the tools do; Ipsissima-MCP's server registers the same functions |
| `ingest.py` | the front door: any supported document to Markdown (`python -m unpetrify.ingest` writes the `source/` layout an argument map uses) |
| `pdf_to_source.py` | a printed article to Markdown: columns, de-hyphenation, paragraphs from the printed indent, journal furniture, footnotes, page numbers |
| `collate.py` | a damaged scan read again by tesseract and voted against its text layer |
| `structured_source.py`, `epub_to_source.py`, `html_to_source.py`, `tei_to_source.py` | the routes that take a publisher's own structure |
| `paginate.py` | a PDF's page numbers onto text from another source |

## Tests

```bash
python3 unpetrify/tests/test_server.py
```

Each file in `tests/` runs on its own. `node app/run_all_tests.mjs` runs them with the rest of
the repository. The converter's regression set is `ipsissima-mcp/eval/extraction_regression.py`.

## Licence

GPL-3.0-or-later. The PDF machinery is built on PyMuPDF, which is AGPL-3.0 or commercial;
[`docs/LICENCE-AUDIT.md`](../docs/LICENCE-AUDIT.md) has the full account.
