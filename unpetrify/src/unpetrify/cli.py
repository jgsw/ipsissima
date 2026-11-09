#!/usr/bin/env python3
"""Get the text out of a document, from the command line.

    unpetrify paper.pdf                       # writes paper.md beside the PDF
    unpetrify *.pdf -o ~/Texts                # one .md each, into ~/Texts
    unpetrify scan.pdf --stdout > scan.md     # one source, Markdown to stdout

THE PLAIN ROUTE, for anyone who wants the text and nothing else. `python3 -m unpetrify.ingest`
remains for the layout an argument map wants -- `<out>/source/<slug>.md`, and a project file when
there are several sources -- and does the same conversion.

WHAT COMES OUT. The document's own words, in Markdown: paragraphs joined across line and page
breaks, headings where the document or its typography marks one, footnotes lifted to the end,
`<!-- p.N begins here -->` where each PDF sheet begins. A comment at the top says what was done
to the text and what could not be done. THE REPORT IS THE POINT: a conversion that mishandled
something quietly is worse than one that says what it did, so it is printed every time (to
stderr, so `--stdout` stays clean).

NEVER INTO ZOTERO'S STORAGE. A PDF opened from Zotero's own folder has its text written to the
temp folder instead, named for the attachment, and the report says where.
"""
import argparse
import os
import sys
from pathlib import Path

from . import tools


def report(r, written, out=sys.stderr):
    print(f"\n   {os.path.basename(r['src'])[:62]}", file=out)
    print(f"      {r['words']} words, {r['pages'] or 'no'} page marker(s), "
          f"{r['headings']} heading(s)", file=out)
    for n in r["notes"]:
        print(f"      {n}", file=out)
    for w in written:
        print(f"      -> {w}", file=out)


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="unpetrify",
        description="Convert PDFs (scans included), EPUB, .docx and HTML to Markdown that keeps "
                    "paragraphs, headings, footnotes and page numbers.")
    ap.add_argument("inputs", nargs="+", help="the documents to convert")
    ap.add_argument("-o", "--out", help="folder to write into (default: beside each source)")
    ap.add_argument("--stdout", action="store_true",
                    help="write the Markdown of ONE source to stdout instead of a file")
    ap.add_argument("--no-ocr", action="store_true",
                    help="never OCR, even if the text layer looks damaged (collation too, "
                         "unless --collate is also given)")
    ap.add_argument("--collate", action=argparse.BooleanOptionalAction, default=None,
                    help="read a scan's page images again and vote against its text layer "
                         "(the default for any scan, where tesseract is installed); "
                         "--no-collate never")
    ap.add_argument("--witness", help="another OCR text of the same work (.txt, or an HTML "
                                      "page such as archive.org's 'Full text of'), for the vote")
    ap.add_argument("--figures", choices=["section", "omit"],
                    help="a figure's caption: gathered under '# Figures' (the default), or left "
                         "out altogether")
    a = ap.parse_args(argv)
    if a.stdout and len(a.inputs) != 1:
        ap.error("--stdout takes exactly one source")
    if a.witness and len(a.inputs) != 1:
        ap.error("a witness belongs to one scan; give that one PDF on its own")
    if a.figures:
        os.environ["IPSISSIMA_FIGURES"] = a.figures

    refused = 0
    for path in a.inputs:
        if not os.path.exists(path):
            print(f"no such file: {path}", file=sys.stderr)
            refused += 1
            continue
        try:
            r = tools.convert_one(path, allow_ocr=not a.no_ocr, collate=a.collate,
                                  witness=a.witness)
        except SystemExit as e:                    # ingest refuses tracked changes this way
            print(f"\n   {os.path.basename(path)}: refused -- {e}", file=sys.stderr)
            refused += 1
            continue
        if a.stdout:
            from . import ingest
            sys.stdout.write(ingest.front_matter(r["src"], r["md"], r.get("extras"))
                             + ingest.header(r["src"], r["notes"]) + r["md"].rstrip() + "\n")
            report(r, [])
            continue
        written = tools.write_one(r, Path(a.out) if a.out else tools.default_out_dir(path))
        report(r, written)
        disputes = r.get("extras", {}).get("collation", {}).get("disputes")
        if disputes:
            print(f"      {disputes} collation dispute(s) left where the readings disagreed: "
                  f"settle them with unpetrify-mcp's collation_disputes and settle_disputes",
                  file=sys.stderr)
    return 1 if refused else 0


if __name__ == "__main__":
    sys.exit(main())
