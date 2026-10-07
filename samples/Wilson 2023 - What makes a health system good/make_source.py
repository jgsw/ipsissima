#!/usr/bin/env python3
"""Rebuild the source text of Wilson, "What makes a health system good?" (2023).

THE ROUTE IS IPSISSIMA'S OWN, UNMODIFIED. `ingest.py` converts the PDF exactly as `extract_text`
does, and this script only adds the bibliographic front matter a sample carries. That is the
point of this sample as much as its argument: the paper was the converter's test case in October
2026, when it came out of the automatic route with a 33-word abstract, two of its seven headings
and Culyer's numbered steps promoted to headings of their own. The fixes it prompted -- headings
set in a larger face, a full-width abstract, tab-set list items, a page number sharing a line with
the running head, compounds broken at a line end in a soft-hyphen document -- are in
`pdf_to_source.py` and were checked against the converter's regression set before they went in.
Nothing here repairs this paper by hand.

NO WORDING IS ALTERED, AND THIS SCRIPT CHECKS IT: it refuses to write unless the body it writes
has the same words, in the same order, as the converter's.

    python3 make_source.py path/to/s11019-023-10149-9.pdf

The PDF is not in this repository: the typesetting is the publisher's. The article is open access
under CC BY 4.0, https://doi.org/10.1007/s11019-023-10149-9.
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD = HERE.parents[1] / "ipsissima-mcp" / "src" / "ipsissima_mcp"
WANTED = HERE / "source" / "wilson-2023-what-makes-a-health-system-good.md"

FRONT = """title: "What makes a health system good? From cost-effectiveness analysis to ethical improvement in health systems"
author: "James Wilson"
source: "Medicine, Health Care and Philosophy 26 (2023), pp. 351-365"
url: "https://doi.org/10.1007/s11019-023-10149-9"
licence: "CC-BY-4.0"
licence_url: "https://creativecommons.org/licenses/by/4.0/"
rights: "© The Author(s) 2023. Open access under a Creative Commons Attribution 4.0 International License."
"""


def main():
    if len(sys.argv) < 2 or not Path(sys.argv[1]).expanduser().exists():
        sys.exit("Give it the published PDF:\n    python3 make_source.py path/to/paper.pdf")
    pdf = Path(sys.argv[1]).expanduser()
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(BUILD / "ingest.py"), str(pdf), "--out", tmp, "--no-ocr"],
                       check=True, stdout=subprocess.DEVNULL)
        made = next(Path(tmp, "source").glob("*.md")).read_text(encoding="utf-8")
    head, body = re.match(r"(?s)\A---\n(.*?)\n---\n(.*)\Z", made).groups()
    # THE ZOTERO KEY IS THE CONVERTER'S, NOT THE ARTICLE'S: it names an attachment in one person's
    # library. Everything else the converter wrote into the front matter -- the abstract -- stays.
    head = "\n".join(l for l in head.splitlines() if not l.startswith("zotero:"))
    out = "---\n" + FRONT + head + "\n---\n" + body
    if body.split() != re.match(r"(?s)\A---\n.*?\n---\n(.*)\Z", out).group(1).split():
        sys.exit("refusing to write: the body's words differ from the converter's")
    WANTED.parent.mkdir(parents=True, exist_ok=True)
    WANTED.write_text(out, encoding="utf-8")
    print(f"wrote {WANTED} ({len(body.split())} words)")


if __name__ == "__main__":
    main()
