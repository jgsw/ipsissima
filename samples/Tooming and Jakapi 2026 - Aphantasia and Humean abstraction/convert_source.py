#!/usr/bin/env python3
"""Convert the Tooming and Jakapi PDF to the markdown the reconstruction cites.

SOURCE. *Neuropsychologia* 227 (2026) 109465, doi:10.1016/j.neuropsychologia.2026.109465. The
article is **CC-BY 4.0**, which is why its text and this reconstruction can be here at all.

    python3 convert_source.py path/to/paper.pdf

The PDF is not in this repository -- the publisher's typesetting is theirs, and the licence
covers the article, not the PDF as an artefact. Download it from the DOI above; the converted
Markdown in `source/` is what ships, and this script is the record of how it was made.

A CLEAN, MODERN TEXT LAYER, and the first paper here that has one. No OCR damage, no repairs, and
the stretch detector finds nothing: everything below is layout, not restoration. The two older
papers in this folder needed their words rescued; this one only needs its page read correctly.

WHAT THIS PAPER NEEDED, over and above what pdf_to_source.py works out for itself:

  * `starts_at` -- an Elsevier first page runs title, authors, affiliation, keywords and abstract
    full width and in a different layout, and none of it is the article. Cutting at the first
    heading is cleaner than trying to parse it.
  * `end_marker` -- the back matter (CRediT statement, acknowledgements, declarations, and the
    bibliography) is not prose the reconstruction will ever cite.

Everything else was detected: two columns and where the gutter runs, the running heads, the page
numbers, the footnotes, and -- because this paper numbers its own sections -- ALL ELEVEN HEADINGS.
That last one matters more than it looks. The older folders here carry EDITORIAL headings, and
their converters say so at length, because the paragraph locator needs sections and a 1963 article
has none marked up. Here the headings are the authors' own.

    python3 convert_source.py
"""

import sys
from pathlib import Path

# Find the shared converter by walking up, rather than counting directories. A fixed
# `parents[2]` breaks the moment the folder is moved or copied somewhere else, and breaks with an
# ImportError that says nothing about why.
_here = Path(__file__).resolve()
for _p in _here.parents:
    _build = _p / "ipsissima-mcp" / "src" / "ipsissima_mcp"
    if _build.is_dir():
        sys.path.insert(0, str(_build))
        break
else:
    sys.exit("cannot find ipsissima-mcp/src/ipsissima_mcp above " + str(_here))
from pdf_to_source import Config, convert, print_report          # noqa: E402

HERE = Path(__file__).resolve().parent

# WHAT IS NO LONGER HERE. The converter now reads the printed page numbers off the sheets,
# promotes headings the paper set in capitals, and finds where the front and back matter
# stop -- so the values that used to state those things have been removed. Each was checked
# by dropping it and confirming the output was byte-identical. What remains is what the
# page genuinely cannot tell us.
CFG = Config(
    pdf=Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else None,
    out=HERE / "source" / "tooming-jakapi-2026-aphantasia-humean-abstraction.md",
    end_marker="CRediT authorship contribution statement",   # back matter and bibliography follow
    title="Aphantasia as a challenge for Humean abstraction",
    author="Uku Tooming and Roomet Jakapi",
    source="Neuropsychologia 227 (2026) 109465",
)

if __name__ == "__main__":
    if CFG.pdf is None or not CFG.pdf.exists():
        sys.exit("Give it the published PDF:\n"
                 "    python3 convert_source.py path/to/paper.pdf\n"
                 "  doi:10.1016/j.neuropsychologia.2026.109465 (CC-BY 4.0)")
    print(f"wrote {CFG.out}")
    print_report(convert(CFG))
