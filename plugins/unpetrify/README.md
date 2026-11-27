# Unpetrify

Get the text out of a PDF, scanned ones included, as Markdown you can read, search and quote
from. It keeps the paragraphs, headings, footnotes and page numbers, and it tells you what it
could not do.

A PDF records where ink sat on a page. Paragraphs, columns, headings, footnotes and reading
order are not in the file; they have to be inferred from geometry. Most converters infer them
quietly, and when they get it wrong you get a well-formed file of the wrong text. Unpetrify does
the inference carefully and reports every choice it made, so you know whether to look. It also
reads EPUB, .docx, .odt and HTML.

This plugin adds the Unpetrify MCP server, so Claude can convert a document, read the result in
parts, look at page images where the text is in doubt, and repair what the conversion got wrong.
It is the converter inside [Ipsissima](https://jgsw.github.io/ipsissima/), offered on its own for
anyone who only wants the text.

## Install

In Claude Code:

```
/plugin install unpetrify --marketplace jgsw/ipsissima
```

## Try it

- "Get the text out of ~/Papers/scan-of-chapter-3.pdf"
- "Is this PDF's text layer any good?"
- "Convert these three EPUBs to Markdown and tell me what you had to guess"

## Requirements

- [uv](https://docs.astral.sh/uv/), which starts the server. The plugin runs
  `uvx --from unpetrify==0.1.0 unpetrify-mcp`, so the first start downloads that exact release of
  [unpetrify](https://pypi.org/project/unpetrify/) and its dependencies from PyPI.
- Optional: [Tesseract](https://github.com/tesseract-ocr/tesseract) and
  [OCRmyPDF](https://ocrmypdf.readthedocs.io) to read scanned PDFs, and
  [Pandoc](https://pandoc.org) for .docx, .odt, EPUB and HTML files. Without them those inputs
  are refused with a reason, not guessed at.

## What it runs, reads, writes and sends

- **Runs** the `unpetrify` Python package from PyPI, pinned to the version above, and locally
  Tesseract, OCRmyPDF and Pandoc when they are installed and a document needs them.
- **Reads** only the files you or Claude name in a request.
- **Writes** the Markdown text of a document beside it, or into a folder you name; page images,
  when asked for, in a `page-images/` folder beside the PDF; and OCR readings in your user cache
  folder (`~/Library/Caches/ipsissima` on macOS).
- **Sends** one kind of request over the internet: `assess_pdf` looks a paper's DOI up at
  [Europe PMC](https://europepmc.org) to see whether a machine-readable copy exists. It sends
  the DOI and nothing else. Pass `check_open_access: false` to skip it.

There is no telemetry, no account and no background network activity. Your documents never leave
your computer through this plugin.

## Licence and support

GPL-3.0-or-later. Source, issues and the full manual are at
[github.com/jgsw/ipsissima](https://github.com/jgsw/ipsissima/tree/main/unpetrify).
