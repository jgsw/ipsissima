# Ipsissima-MCP

Turn a document into something a reconstruction can cite — and check the reconstruction against
it afterwards.

A reconstruction in [Ipsissima](../README.md) points at a text: every claim can record which file
and which words it came from, and the map draws the difference between a quotation and a gloss.
That only works if the text exists as structured Markdown with its paragraphs intact. Getting a
published article into that state is most of the work, and it is what this package does.

**The name is ahead of the code.** An MCP server over these tools — so an assistant can ingest a
paper, check a reconstruction and derive provenance without a human running commands — is the next
step. Today this is a Python package with a command line that already does the work.

## Install

```bash
pip install -e mcp
```

`rapidocr` is a hard dependency and not an optional extra. Without an OCR backend, `pymupdf4llm`
handed a scan whose text layer is unusable returns **the cover page and nothing else** — no error,
no warning, and a perfectly well-formed Markdown file. That is measured, not hypothetical:
345 words of a 1,220-word paper. See `eval/CONVERTER-FINDINGS.md`.

## What it does

```bash
# A PDF, an EPUB, an HTML article, or a list of them, into a source folder
ipsissima-ingest paper.pdf --out "samples/Author 2026 - Title"

# Check a finished reconstruction against the text it cites
ipsissima-check reconstruction.argdown --source-root .

# Split a one-file book manuscript into chapters plus a project file
ipsissima-split book.md --out chapters/
```

### The pieces

| | |
|---|---|
| `ingest.py` | the front door: any supported document to a source folder |
| `pdf_to_source.py` | a printed article to Markdown — ligatures, de-hyphenation, paragraphs from the printed indent, journal furniture, footnotes, page numbers |
| `structured_source.py` | the inversion: when the publisher's own HTML or EPUB is available, take the structure rather than recovering it from ink positions |
| `epub_to_source.py`, `html_to_source.py` | those two routes |
| `from_zotero.py` | acquisition, by whichever route an item's attachments allow |
| `new_reconstruction.py` | scaffold a reconstruction folder from a PDF in one command |
| `split_manuscript.py` | a one-file manuscript into per-chapter files and a project file |
| `check_argdown.py` | check a reconstruction: are the quotations verbatim, do the pinpoints hold, is anything misreported |
| `argdown_provenance.py` | where in the text each claim came from — the Python half of a pair with `app/src/argdown-positions.js` |
| `rationale_to_argdown.py` | convert a Rationale `.rtnl` map |

### One rule that is not obvious

**`check_argdown.py` and `app/src/argdown-positions.js` implement the same rule in two
languages**, because the viewer needs it in the browser and the checker needs it here.
`app/test_argdown_positions.mjs` exists solely to police the drift between them, and it is the
reason the viewer's build shells out to Python rather than reimplementing near-matching in
JavaScript.

## Tests

```bash
python3 mcp/tests/test_pdf_to_source.py
python3 mcp/tests/test_provenance_defaults.py
python3 mcp/tests/test_reading_checks.py
python3 mcp/eval/eval_reconstruction.py --self-test
```

All four also run as part of `node app/run_all_tests.mjs`, which is the suite that matters.

## Evaluation

`eval/` holds the harness and the findings from choosing a converter. `CONVERTER-FINDINGS.md` is
worth reading before replacing anything in the PDF route: `marker`, `docling` and a local
`llama.cpp` were all measured and removed — about 3.9 GB between them — because `pymupdf4llm`
with `rapidocr` beat them all on the labelled test set at a fraction of the cost.
