#!/usr/bin/env python3
"""Unpetrify as an MCP server: the text out of a document, for an assistant to read.

    unpetrify-mcp                 # stdio, which is what an MCP client launches

The same conversion as the `unpetrify` command, offered as tools. The functions are in `tools.py`
and Ipsissima-MCP registers them too, under descriptions that speak of argument maps; the ones
here speak only of getting text out, because that is all this server is for.

`read_text` IS WHAT A PLAIN CHAT NEEDS. Ipsissima's extract_text writes to disk and expects the
model to open the file, which holds in a coding assistant and nowhere else: an assistant in a
chat window has no file tool, and a bridged one sits on a different disk. So the text written here
can be read back through the server, in parts small enough for a tool result.
"""
import sys
from pathlib import Path
from typing import Any

from mcp.server import MCPServer

try:
    from unpetrify import tools
except ImportError:                       # run as a file: `python src/unpetrify/server.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from unpetrify import tools

INSTRUCTIONS = """\
Unpetrify gets the text out of documents -- PDFs above all, scanned ones included, and EPUB,
.docx and HTML -- as Markdown that keeps paragraphs, headings, footnotes and page numbers, and
it says what it could not do.

THE ORDER OF WORK
  1. `assess_pdf` for a PDF: how hard it is, which route it will take, and whether a
     machine-readable version of the same article exists that would be better.
  2. `extract_text`: converts and writes `<slug>.md` (beside the source unless `out` is given).
  3. `read_text` on each written file, part by part -- or open the file yourself if you can.
     Read the notes at the top of the file: they say what the conversion did and could not do.
  4. Only where step 2 says so: settle collation disputes (`collation_disputes`, then
     `settle_disputes`), or, for a scan nothing could read, `page_images` and `repair_source`.

CITING. `<!-- p.N begins here -->` marks where each PDF sheet begins. Sheets are counted from 1;
the printed page a reader cites can differ (a cover, front matter), so check one page before
citing by page. Quote from the extracted text, not from memory of the document.
"""

PART_CHARS = 80_000


def _version():
    from importlib.metadata import PackageNotFoundError, version
    try:
        return version("unpetrify")
    except PackageNotFoundError:
        return "0+unknown"


server = MCPServer(
    name="unpetrify",
    title="Unpetrify — text out of PDFs",
    version=_version(),
    instructions=INSTRUCTIONS,
)


@server.tool(
    structured_output=True,
    title="Extract the text",
    description=(
        "Convert documents -- PDF (scans included), EPUB, .docx, HTML, Markdown -- to Markdown "
        "that keeps paragraphs, headings, footnotes and, for a PDF, page markers "
        "(`<!-- p.N begins here -->`). Writes `<slug>.md` for each source, beside it unless "
        "`out` is given (never into Zotero's storage folder: those go to a temp folder).\n\n"
        "THE TEXT IS WRITTEN TO DISK, NOT RETURNED; the reply carries a short `head` of each "
        "file and the converter's `notes`. Read the text with `read_text`, or open the files at "
        "`written` if you can. Do not work from `head`."),
)
def extract_text(sources: list[str], out: str | None = None, allow_ocr: bool = True,
                 dry_run: bool = False, collate: bool | None = None,
                 witness: str | None = None) -> dict[str, Any]:
    """
    Args:
        sources: the files to convert.
        out: the folder to write into (default: beside each source).
        allow_ocr: allow OCR when a PDF's text layer looks damaged.
        dry_run: report what would happen and write nothing.
        collate: read a scan's page images again and vote the reading against its text layer. Left unset (or true), this happens for every scan where tesseract is installed; false never.
        witness: another OCR text of the same work -- a .txt, or a saved HTML page such as archive.org's "Full text of" -- to vote with. One PDF source only.
    """
    files = [str(Path(s).expanduser()) for s in sources]
    missing = [f for f in files if not Path(f).is_file()]
    if missing:
        return dict(ok=False, error=f"no such file(s): {missing}")
    if witness:
        if len([f for f in files if f.lower().endswith(".pdf")]) != 1:
            return dict(ok=False, error="a witness belongs to one scan; give that one PDF on its "
                                        "own with the witness")
        if not Path(witness).expanduser().exists():
            return dict(ok=False, error=f"no such witness file: {witness}")

    results, failures, written = [], [], []
    for f in files:
        try:
            r = tools.convert_one(f, allow_ocr=allow_ocr, collate=collate, witness=witness)
        except SystemExit as e:                    # ingest refuses tracked changes this way
            failures.append(dict(path=f, refused=str(e)))
            continue
        results.append(r)
        if not dry_run:
            written += tools.write_one(r, Path(out).expanduser() if out
                                       else tools.default_out_dir(f))
    texts = [w for w in written if w.endswith(".md")]
    return dict(
        ok=not failures, dry_run=dry_run, written=written,
        sources=[tools.reply_of(r) for r in results], failures=failures,
        next=("nothing written (dry run)" if dry_run else tools.settle_first(results) +
              (f"call read_text on {texts[0]!r}" + (f" and the {len(texts) - 1} other file(s) "
                                                    f"in `written`" if len(texts) > 1 else "")
               + " -- or open the files yourself -- and read the notes at the top first"
               if texts else "nothing was converted")))


@server.tool(
    structured_output=True,
    title="Read extracted text",
    description=(
        "Read a Markdown file extract_text wrote, in parts of about 80,000 characters, cut at "
        "paragraph breaks. `parts` says how many there are; ask for each in turn. For when you "
        "cannot open the file yourself."),
)
def read_text(path: str, part: int = 1) -> dict[str, Any]:
    """
    Args:
        path: a file from extract_text's `written`.
        part: which part, from 1.
    """
    p = Path(path).expanduser()
    if not p.is_file():
        return dict(ok=False, error=f"no such file: {p}")
    text = p.read_text(encoding="utf-8")
    cuts, at = [0], 0
    while len(text) - at > PART_CHARS:
        brk = text.rfind("\n\n", at, at + PART_CHARS)
        at = brk + 2 if brk > at else at + PART_CHARS
        cuts.append(at)
    cuts.append(len(text))
    parts = len(cuts) - 1
    if not 1 <= part <= parts:
        return dict(ok=False, error=f"part {part} asked for; there are {parts}")
    return dict(ok=True, path=str(p), part=part, parts=parts,
                text=text[cuts[part - 1]:cuts[part]],
                next=(f"call read_text again with part={part + 1}" if part < parts
                      else "that is the whole file"))


server.tool(
    structured_output=True,
    title="Assess a PDF",
    description=(
        "How hard will this PDF be to convert, and by which route? Reports whether the text "
        "layer is usable, how damaged it looks, whether OCR will be needed, and — where the PDF "
        "has a DOI — whether a machine-readable version of the same article exists that should "
        "be used instead.\n\n"
        "Returns `difficulty`: `easy` (convert it, nothing else needed), `ocr` (the text layer "
        "is damaged; conversion will try OCR and report what it chose), or `hard` (neither "
        "route produces usable text — call `page_images` and read the pages yourself)."),
)(tools.assess_pdf)

server.tool(
    structured_output=False,
    title="Page images",
    description=(
        "Render pages of a PDF as PNG files so they can be read directly. For the `hard` case "
        "only — a scan whose text layer and OCR both fail.\n\n"
        "CROPS, NOT WHOLE PAGES, wherever you can manage it: proofreading five whole pages to "
        "check three damaged lines was measured at about ten thousand tokens and found nothing "
        "the converter had not already flagged. Give `pages` as narrowly as you can, and crop "
        "with `clip` -- [x0, y0, x1, y1] as FRACTIONS of the page, so [0, 0, 1, 0.15] is the "
        "top 15%.\n\n"
        "A crop small enough (under ~200 KB) comes back INSIDE this result as an image, so you "
        "can read it directly even when this server runs on another machine; larger renders "
        "are written to disk and returned as paths only, and the JSON says which happened."),
)(tools.page_images)

server.tool(
    structured_output=True,
    title="Repair extracted text",
    description=(
        "Replace damaged passages in an extracted Markdown file with text read off the page "
        "images. Each repair is `find` → `replace`; `find` must match exactly once, so a repair "
        "that would land in the wrong place fails instead of being applied.\n\n"
        "Line counts are preserved where the replacement has the same number of lines, so "
        "anything that cites the text by line stays put."),
)(tools.repair_source)

server.tool(
    structured_output=False,
    title="Collation disputes",
    description=(
        "The places where the independent readings of a scan disagreed and no vote could settle "
        "it -- left by extract_text's collated route, which reads a damaged scan's page images "
        "again and votes that reading against the PDF's own text layer (and any witness "
        "given). Each dispute comes with every witness's reading (C: the fresh OCR; B: the "
        "PDF's text layer; A: the witness), the one that now stands in the text, and its "
        "neighbours; the printed lines they sit on come back as images, many to an image, the "
        "disputed words boxed in red and numbered.\n\n"
        "READ EACH LINE IN THE IMAGE and decide what the page prints, then call "
        "settle_disputes with the decisions. Work in batches (`count` of 8 to 12 keeps each "
        "image small enough to come back inline). A dispute already settled is not shown again."),
)(tools.collation_disputes)

server.tool(
    structured_output=True,
    title="Settle collation disputes",
    description=(
        "Apply what the page images say to the disputes collation_disputes showed. Each "
        "decision names a dispute by number and gives either a witness (\"A\", \"B\", \"C\") "
        "or the text the page prints. The extracted Markdown is edited where that dispute's "
        "reading stands -- found between its neighbours, so a decision never lands in the "
        "wrong place; one that cannot be found exactly once is refused with what to give "
        "repair_source instead. Decisions are also kept with the scan's collation, so a later "
        "extract_text of the same PDF applies them before anything else."),
)(tools.settle_disputes)

server.tool(
    structured_output=True,
    title="Add the PDF's page numbers",
    description=(
        "Put a PDF's page numbers onto text extracted from a better source. THE COMBINATION "
        "WORTH ASKING FOR when an article exists twice — the publisher's HTML snapshot has the "
        "structure (headings are headings because the document says so), and the PDF has the "
        "page numbers, which are what a reader cites.\n\n"
        "Inserts `<!-- p.N begins here -->` markers. The number is READ off each sheet, not "
        "counted from one: a paper starting at p. 511 by its own front matter can print 514 on "
        "its first sheet, and counting then puts every quotation three pages out.\n\n"
        "A page whose opening words cannot be found in the text gets no marker and is named in "
        "the report. That is deliberate — a marker placed by hope would pin a quotation to a "
        "page it is not on."),
)(tools.add_page_numbers)


def main():
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
