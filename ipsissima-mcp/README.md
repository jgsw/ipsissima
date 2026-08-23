# Ipsissima-MCP

Ask your assistant for an argument map of a paper, and get one that cites the text it is a
reading of.

Ipsissima-MCP is an [MCP](https://modelcontextprotocol.io) server. It does the mechanical half of
building a reconstruction — getting a document into structured Markdown with its paragraphs and
page numbers intact, and checking a finished reconstruction against its sources word for word.
The judgement half, turning a paper into an argument, is done by the assistant you are already
talking to; this server hands it the instructions and then checks its work.

The result opens in [Ipsissima](../README.md), which shows the map, the passage each claim was
drawn from, and how far each claim stands from the source's own words.

---

## Install

You need **Python 3.10+**, **Node** (for the Argdown parser), and ideally
[**pandoc**](https://pandoc.org/installing.html).

```bash
git clone <this repository> && cd ipsissima
python3 -m venv .venv && .venv/bin/pip install -e ipsissima-mcp
cd app && npm install && cd ..
```

A virtual environment is not fussiness: a Homebrew or system Python will refuse `pip install`
outright ([PEP 668](https://peps.python.org/pep-0668/)).

`rapidocr` installs with it and is **not optional**. Without an OCR backend, a scanned paper
converts silently to its cover page and nothing reports it — measured at 345 words of a
1,220-word article, no error, a perfectly well-formed Markdown file. See
`eval/CONVERTER-FINDINGS.md`.

### Tell your assistant about it

**Claude Code**

```bash
claude mcp add ipsissima -- /absolute/path/to/ipsissima/.venv/bin/ipsissima-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ipsissima": {
      "command": "/absolute/path/to/ipsissima/.venv/bin/ipsissima-mcp"
    }
  }
}
```

Use the absolute path. The server finds the Argdown parser and its own documents relative to
where it is installed, not to where the client happens to be running.

---

## Using it

Ask in your own words. All of these work, and all mean the same thing:

> Make an Argdown from the attached article.
> Make an Ipsissima diagram of this paper.
> Map the argument in `~/papers/rawls-1971.pdf`.

**One article.** The assistant extracts the text, reconstructs the argument, and checks it until
the checker is satisfied. You get a folder with `source/the-paper.md` and a `.argdown` beside it.
Open the folder in Ipsissima.

**Several articles, separate maps.**

> Make separate Argdown maps for each article in `~/papers/to-read`. Put them in a new folder,
> with the extracted texts and the Argdowns side by side.

**A book.**

> My manuscript is in `~/book`. Create a single Argdown map using the latest draft of each
> chapter.

**Text only, no reconstruction.**

> Just extract the markdown from these PDFs — don't make a map.

### It will ask before it spends

A reconstruction is the expensive step, and *"a map of each of these articles"* and *"one map
from these chapters"* look identical from the files alone. So the server reports what is
ambiguous rather than guessing, and refuses to convert several sources until the question is
answered. If you are asked which of two drafts is current, or whether you want one map or six,
that is the server declining to spend your money on a coin toss.

---

## Which file to give it

**This is the single most useful thing on this page.** The same paper can arrive in three very
different states, and the difference is permanent — a manuscript converted badly stays badly
converted for every claim that ever cites it.

### 1. Markdown is gold

Already structured; nothing is recovered because nothing was lost. If you draft in Markdown,
Ipsissima reads your **live file**, so the Manuscript view is always your current draft.

### 2. Anything pandoc reads is silver

`.docx`, `.odt`, `.html`, `.epub`, `.tex`. The document's own structure survives: a heading is a
heading because the document says so, not because something guessed from the type size.

**If you are not writing in Markdown**, the best workflow is to export to Markdown yourself with
pandoc and keep that file as the manuscript:

```bash
pandoc --wrap=none -o chapter-3.md chapter-3.docx
```

No pandoc installed? The web version at **<https://pandoc.org/app/>** does the same job in a
browser. When you want Ipsissima to show a newer draft, export again and save over the same
Markdown file — the map is watching it, and the Manuscript view will update by itself.

### 3. PDF is bronze

A PDF records where ink sat on a page. Paragraphs, headings, columns, footnotes and reading order
all have to be **inferred from geometry**, and inference has a hit rate.

So: **do not give it a PDF of your own draft.** You have the `.docx`. If a folder holds
`chapter-3.pdf` beside `chapter-3.docx`, the server will say so before converting anything.

For published articles you do not have in any other form, PDFs are handled, and handled
carefully:

- Where the article has a DOI, the server checks whether a **machine-readable version exists**
  (Europe PMC and other open-access routes) and prefers it. That turns a bronze source into a
  gold one for the cost of one lookup.
- Otherwise it converts, and **assesses the difficulty first**. A clean text layer is converted
  mechanically. A damaged one is OCRed, and every route tried is scored and reported so the
  choice is visible.
- Where neither works — an old scan, a strange typeface, essentially photographs of text — it
  says so, renders the damaged passages as images, and asks the assistant to read them. You get
  a usable result either way; what changes is how much it costs.

**Age is a good predictor.** A PDF made in the last decade is usually fine. One from twenty-odd
years ago, or a scan of a photocopy, is where the difficult cases live.

**Page numbers survive.** Where the source is paginated, page breaks are kept in the Markdown as
comments, and Ipsissima's Manuscript view shows the page number beside the text.

---

## Zotero makes it better, and is not required

Everything above works with no Zotero installed. If you do have it, the server notices, reads it
**read-only** (never the live database — a copy, because Zotero holds the file open), and can:

- build maps from items in your library, found by DOI, item key or title;
- use an item's **HTML snapshot** for the text and its **PDF for the page numbers** — the best
  combination there is, and the reason a snapshot is worth keeping. Each has exactly what the
  other lacks: a web page has no pages, and a PDF has no idea what a heading is. The page number
  is *read off each sheet*, not counted from one, because a paper whose front matter says it
  starts at 511 can print 514 on its first sheet;
- find snapshots you had forgotten were there, which read far better than the PDF beside them.

Nothing is ever written into your Zotero storage.

---

## What the server offers

| tool | |
|---|---|
| `plan_job` | reads the request; reports the sources, the routes, the cost, and what is ambiguous |
| `extract_text` | documents to structured Markdown, with page markers |
| `assess_pdf` | how hard is this PDF, and does a machine-readable version exist? |
| `page_images` | crops of damaged passages, for the cases a converter cannot do |
| `repair_source` | apply corrections read off those crops |
| `add_page_numbers` | the PDF's pagination onto text taken from the snapshot |
| `check_reconstruction` | validity, provenance and fidelity — faults with fixes, not a report |
| `split_manuscript` | a one-file book into chapters plus a project file |
| `zotero_lookup` | only when a library is present |

**Prompts** — `reconstruct_argument` (the full instructions, read off disk every run) and
`extract_text_only`. **Resources** — the Argdown reference, the map semantics, the order views,
the viewer guide, served on demand rather than loaded into every conversation.

---

## The command line is still there

The server did not replace it, and for a one-off it is often quicker:

```bash
.venv/bin/ipsissima-ingest paper.pdf --out "samples/Author 2026 - Title"
.venv/bin/ipsissima-check reconstruction.argdown --source-root .
.venv/bin/ipsissima-split book.md --out chapters/
```

`ipsissima-check` has two modes worth knowing. Bare, it prints the full report — the apex, the
sections, the tag census, the debt. `--only-problems` prints just what is wrong, and
`--format json` prints the same as data. The short forms exist because a check-and-fix loop reads
this file every round: on the Darwin sample the full report is 687 words and 10.5 seconds, and
the short one is 221 words and 2.4.

### The pieces

| | |
|---|---|
| `server.py` | the MCP server |
| `sources.py` | what a source is, which route it takes, and what is ambiguous about a request |
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
node app/run_all_tests.mjs        # everything, and the suite that matters
```

The MCP server's own tests drive it over a real stdio session, because the thing most likely to
break is the contract with the client rather than the logic behind it.

## Evaluation

`eval/` holds the harness and the findings from choosing a converter. `CONVERTER-FINDINGS.md` is
worth reading before replacing anything in the PDF route: `marker`, `docling` and a local
`llama.cpp` were all measured and removed — about 3.9 GB between them — because `pymupdf4llm`
with `rapidocr` beat them all on the labelled test set at a fraction of the cost.
