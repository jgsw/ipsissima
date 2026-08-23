#!/usr/bin/env python3
"""Probe every PDF in the Zotero library and write a TSV of the verdicts.

    python3 mcp/eval/probe_library.py" [--out FILE] [--root DIR]

READ-ONLY. Nothing is ever written into the Zotero storage tree; results go to --out.

The point is not the individual verdicts but the DISTRIBUTION: how much of a real library is
clean, how much has silently lost words, how much has no text layer at all. That is what decides
whether the ingestion path needs an OCR escalation at all, and how often it will fire.
"""
import argparse
import glob
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from probe_pdf import probe                                          # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.expanduser("~/Zotero/storage"),
                    help="folder to search for PDFs (recursively, one level of subfolders)")
    ap.add_argument("--out", default="/tmp/library-probe.tsv")
    a = ap.parse_args()
    paths = sorted(glob.glob(os.path.join(a.root, "*", "*.pdf")))
    t0 = time.time()
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write("verdict\tpages\tchars_per_page\tcolumns\tempty_pages\tstretched\tfile\n")
        for i, p in enumerate(paths, 1):
            try:
                r = probe(p)
                fh.write(f"{r['verdict'].split(' --')[0]}\t{r['pages']}\t{r['mean_chars']}\t"
                         f"{r['columns']}\t{r['empty_pages']}\t{len(r['stretched'])}\t"
                         f"{os.path.basename(p)}\n")
            except Exception as e:
                fh.write(f"unreadable\t0\t0\t0\t0\t0\t{os.path.basename(p)}\t{type(e).__name__}\n")
            if i % 100 == 0:
                fh.flush()
                print(f"  {i}/{len(paths)}  ({time.time()-t0:.0f}s)", flush=True)
    print(f"done: {len(paths)} PDFs in {time.time()-t0:.0f}s -> {a.out}", flush=True)


if __name__ == "__main__":
    main()
