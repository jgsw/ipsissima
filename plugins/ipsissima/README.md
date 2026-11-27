# Ipsissima

Ask Claude for an argument map of a paper, and get one that cites the text it is a reading of.

This plugin adds the Ipsissima-MCP server. It gets a document (PDF, EPUB, .docx or an HTML
article) into structured Markdown with its paragraphs and page numbers intact. It serves the
method for reading that text into one Argdown file holding several of its structures: the
argument and its reasons, the causal chain the text says happens, the questions it asks, and the
comparisons it draws. Then it checks the finished map against its sources word for word, with
every quotation verified character by character.

The server does not reconstruct arguments itself. Claude does that reading; the server hands it
the instructions and checks its work. The maps open in
[Ipsissima](https://jgsw.github.io/ipsissima/), a free desktop and web app that shows the map
beside the passage each claim was drawn from.

## Install

In Claude Code:

```
/plugin install ipsissima --marketplace jgsw/ipsissima
```

## Try it

- "Make an argument map of ~/Papers/gettier-1963.pdf"
- "Map the debate over whether knowledge is justified true belief"
- "Check my map smith-2024.argdown against its source"

## Requirements

- [uv](https://docs.astral.sh/uv/), which starts the server. The plugin runs
  `uvx ipsissima-mcp==0.5.0`, so the first start downloads that exact release of
  [ipsissima-mcp](https://pypi.org/project/ipsissima-mcp/) and its dependencies from PyPI.
- [Node.js](https://nodejs.org), any current version, for checking maps.
- Optional: [Tesseract](https://github.com/tesseract-ocr/tesseract) and
  [OCRmyPDF](https://ocrmypdf.readthedocs.io) to read scanned PDFs, and
  [Pandoc](https://pandoc.org) for .docx, .odt, EPUB and HTML files. Without them those inputs
  are refused with a reason, not guessed at.

## What it runs, reads, writes and sends

- **Runs** the `ipsissima-mcp` Python package from PyPI, pinned to the version above. Locally it
  calls Node.js (the Argdown parser bundled in the package), and Tesseract, OCRmyPDF and Pandoc
  when they are installed and a document needs them.
- **Reads** only the files you or Claude name in a request, and, for the two Zotero tools, your
  Zotero library: `zotero_lookup` reads the Zotero database (`zotero.sqlite`) on your computer.
- **Writes** the Markdown text of a document beside it, or into a folder you name; page images,
  when asked for, in a `page-images/` folder beside the PDF (a temporary folder for a Zotero
  attachment, never Zotero's storage); OCR readings in your user cache folder
  (`~/Library/Caches/ipsissima` on macOS); and a
  run ledger, `~/.ipsissima/check-log.jsonl`, holding each check's file name, counts and timing
  but none of its content (set `IPSISSIMA_CHECK_LOG=off` to stop it). `zotero_store` adds a map
  to your Zotero library through Zotero's own local API, on `127.0.0.1:23119`, and only after
  Zotero has asked you to allow it.
- **Sends** a request over the internet in two cases only, both when a tool is used:
  - `assess_pdf` looks a paper's DOI up at [Europe PMC](https://europepmc.org) to see whether a
    machine-readable copy exists. It sends the DOI and nothing else. Pass
    `check_open_access: false` to skip it.
  - `check_for_updates` asks the GitHub releases API for the latest version number. It sends
    nothing about you or your documents.

There is no telemetry, no account and no background network activity. Your documents and maps
never leave your computer through this plugin.

## Licence and support

GPL-3.0-or-later. Source, issues and the full manual are at
[github.com/jgsw/ipsissima](https://github.com/jgsw/ipsissima); the server's own README is
[ipsissima-mcp/README.md](https://github.com/jgsw/ipsissima/blob/main/ipsissima-mcp/README.md).
