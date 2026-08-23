#!/usr/bin/env python3
"""Rebuild the Carroll source from its PDF.

WHY THIS EXISTS. The source was made by running `ingest.py` by hand, and was then the only sample
that could not be regenerated -- so an improvement to the shared ingest could not reach it, and
nothing recorded what had produced it. This records the one command that did.

NOTHING PAPER-SPECIFIC IN THE CONVERSION. The default route -- the PDF's own text layer, reflowed
into the paragraphs its blocks came from -- is right for a short, clean, single-column document,
which is exactly what this is. The text layer is clean, so no OCR is attempted or wanted.

TWO PIECES OF BOOKKEEPING, both because the file in Zotero is named badly:

  * `ingest.py` slugs the output name from the PDF's filename, which reads 1995. The paper is
    1895. The reconstruction cites `carroll-1895-...`, so the file is renamed to that -- the
    date in the name is the paper's, not the scan's.
  * `--out` is the PAPER folder, not the source folder: `ingest.py` appends `source/` itself.
    Passing `source/` produced `source/source/`.

    python3 make_source.py
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD = HERE.parents[1] / "ipsissima-mcp" / "src" / "ipsissima_mcp"
PDF = Path("/Users/jameswilson/Zotero/storage/HK8L96QV/"
           "CARROLL - 1995 - WHAT THE TORTOISE SAID TO ACHILLES.pdf")
WANTED = HERE / "source" / "carroll-1895-what-the-tortoise-said-to-achilles.md"

if __name__ == "__main__":
    if not PDF.exists():
        sys.exit(f"the source PDF is not where this expects it:\n  {PDF}\n"
                 "It lives in Zotero, and nothing is ever written back there.")
    subprocess.run([sys.executable, str(BUILD / "ingest.py"), str(PDF),
                    "--out", str(HERE), "--no-ocr"], check=True)
    made = [p for p in (HERE / "source").glob("carroll*.md") if p != WANTED]
    if len(made) != 1:
        sys.exit(f"expected one new file in source/, found {len(made)}: {[p.name for p in made]}")
    made[0].replace(WANTED)
    print(f"\n  renamed to {WANTED.name} -- the date in the name is the PAPER'S, not the scan's")
