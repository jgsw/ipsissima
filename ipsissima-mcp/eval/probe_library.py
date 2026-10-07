#!/usr/bin/env python3
"""Probe every PDF in the Zotero library and write a TSV of the verdicts -- and pick a corpus from it.

    python3 ipsissima-mcp/eval/probe_library.py [--out FILE] [--root DIR] [--jobs N]
    python3 ipsissima-mcp/eval/probe_library.py --pick 3 [--out FILE] [--exclude LIST] > picks.txt

READ-ONLY. Nothing is ever written into the Zotero storage tree; results go to --out.

The point is not the individual verdicts but the DISTRIBUTION: how much of a real library is
clean, how much has silently lost words, how much has no text layer at all. That is what decides
whether the ingestion path needs an OCR escalation at all, and how often it will fire.

AND WHICH PAPERS TO TEST ON. The regression corpus grew from the papers that happened to be
mapped, and a converter tuned to them is tuned to a few publishers' habits. Each PDF is also
classed by what decides how it converts -- who typeset it, whether it is a scan, its columns,
whether it carries an outline, where its notes are -- and `--pick N` takes N from every class
the library has at least five of -- a class is a publisher's house style, or a damaged text layer
-- each pick a different layout where the class has more than one, so the regression set stands
for the library rather than for a reading list.
"""
import argparse
import csv
import glob
import os
import random
import re
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from probe_pdf import probe                                          # noqa: E402

#: Who typeset it, from the DOI's registrant prefix: the publisher decides the layout.
DOI_PREFIX = {
    "10.1007": "Springer", "10.1080": "Taylor & Francis", "10.1111": "Wiley", "10.1002": "Wiley",
    "10.1093": "Oxford UP", "10.1017": "Cambridge UP", "10.1016": "Elsevier", "10.1177": "SAGE",
    "10.1086": "Chicago UP", "10.5840": "PDC", "10.1136": "BMJ", "10.1371": "PLOS", "10.1038": "Nature",
    "10.1163": "Brill", "10.1515": "De Gruyter", "10.1162": "MIT Press", "10.1037": "APA",
    "10.1215": "Duke UP", "10.1146": "Annual Reviews", "10.11647": "Open Book", "10.2307": "JSTOR",
    "10.1353": "Project MUSE", "10.3390": "MDPI", "10.1186": "BMC", "10.1057": "Palgrave",
    "10.4324": "Routledge", "10.1145": "ACM", "10.1109": "IEEE", "10.1126": "Science",
    "10.1073": "PNAS", "10.1056": "NEJM", "10.1001": "JAMA", "10.2139": "SSRN", "10.48550": "arXiv",
    "10.1098": "Royal Society", "10.3389": "Frontiers", "10.1525": "California UP", "10.5040": "Bloomsbury",
}
SIGNATURE = [
    ("JSTOR", r"Stable URL: https?://www\.jstor\.org|JSTOR is a not-for-profit"),
    ("Project MUSE", r"Project MUSE|muse\.jhu\.edu"), ("arXiv", r"arXiv:\d{4}\.\d{4,5}"),
    ("PhilArchive", r"philarchive\.org|philpapers\.org/archive"), ("Google Books", r"Google Books|books\.google"),
]


def publisher(doc):
    text = " ".join(doc[i].get_text() for i in range(min(2, len(doc))))
    meta = " ".join(str(v) for v in (doc.metadata or {}).values())
    for name, pat in SIGNATURE:
        if re.search(pat, text):
            return name
    m = re.search(r"\b(10\.\d{4,5})/", text + " " + meta)
    if m:
        return DOI_PREFIX.get(m.group(1), "other DOI")
    return "unknown"


def notes_kind(doc):
    """Where the notes are: at the foot of the page, gathered at the end, or none seen."""
    foot = end = 0
    for i, page in enumerate(doc):
        h = page.rect.height
        for b in page.get_text("dict").get("blocks", []):
            for l in b.get("lines", []):
                sp = [s for s in l["spans"] if s["text"].strip()]
                if not sp:
                    continue
                t = "".join(s["text"] for s in sp).strip()
                if re.match(r"^(\d{1,3})[.\s\t]\s*[A-Z‘“\"]", t) and l["bbox"][1] > 0.6 * h and len(t) > 25:
                    foot += 1
        if re.search(r"(?m)^\s*(Notes|NOTES|Endnotes)\s*$", page.get_text()) and i > len(doc) * 0.5:
            end += 1
    return "endnotes" if end and foot < 3 else ("footnotes" if foot >= 3 else "none seen")


def classify(path):
    import pymupdf
    try:
        r = probe(path)
        doc = pymupdf.open(path)
        toc = doc.get_toc()
        outline = ("none" if not toc else
                   "pages" if sum(bool(re.fullmatch(r"p\.?\s*\[?\d+\]?|\d+|image \d+", t.strip())) for _l, t, _p in toc) > len(toc) / 2
                   else "sections")
        return dict(verdict=r["verdict"].split(" --")[0], pages=r["pages"], chars_per_page=r["mean_chars"],
                    columns=r["columns"], empty_pages=r["empty_pages"], stretched=len(r["stretched"]),
                    publisher=publisher(doc), outline=outline, notes=notes_kind(doc),
                    producer=re.sub(r"[\t\n]", " ", (doc.metadata or {}).get("producer") or "")[:40], file=path)
    except Exception as e:                                           # noqa: BLE001
        return dict(verdict="unreadable", pages=0, chars_per_page=0, columns=0, empty_pages=0, stretched=0,
                    publisher="", outline="", notes="", producer=type(e).__name__, file=path)


FIELDS = ["verdict", "pages", "chars_per_page", "columns", "empty_pages", "stretched", "publisher",
          "outline", "notes", "producer", "file"]


#: Publishers whose layouts are close enough to test as one: a family is one house style.
FAMILY = {
    "Taylor & Francis": "Taylor & Francis / Routledge", "Routledge": "Taylor & Francis / Routledge",
    "Chicago UP": "US university presses", "Duke UP": "US university presses", "MIT Press": "US university presses",
    "California UP": "US university presses",
    "BMJ": "medicine and science", "BMC": "medicine and science", "PLOS": "medicine and science",
    "Nature": "medicine and science", "NEJM": "medicine and science", "JAMA": "medicine and science",
    "Frontiers": "medicine and science", "MDPI": "medicine and science", "Science": "medicine and science",
    "PNAS": "medicine and science", "Royal Society": "medicine and science", "Annual Reviews": "medicine and science",
    "Brill": "European and book publishers", "De Gruyter": "European and book publishers",
    "Palgrave": "European and book publishers", "Bloomsbury": "European and book publishers",
    "Open Book": "European and book publishers",
    "arXiv": "preprints", "SSRN": "preprints", "PhilArchive": "preprints",
    "APA": "other DOI", "ACM": "other DOI", "IEEE": "other DOI",
}


def stratum(row):
    """The class a PDF is picked from: a damaged text layer is its own class whoever printed it;
    otherwise the publisher's house style. Columns, notes and outline vary WITHIN a class, and
    the picks are spread across them (see `pick`). A PDF with no text layer is not a class here:
    the regression converts without OCR, so it would test only the fallback."""
    if row["verdict"] in ("NO USABLE TEXT LAYER", "SPARSE text layer", "unreadable"):
        return None
    if row["verdict"] in ("GARBLED", "DAMAGED", "CHECK THE MATHEMATICS"):
        return f"text layer: {row['verdict']}"
    return FAMILY.get(row["publisher"], row["publisher"])


def layout(row):
    cols = "2 columns" if str(row["columns"]) not in ("0", "1") else "1 column"
    return (cols, row["notes"], row["outline"])


def pick(rows, n, exclude, seed=20261007):
    """N from every class with at least five members, 6-40 pages, never one already in the
    corpus, each pick a different layout (columns, notes, outline) where the class has one."""
    names = {os.path.basename(e) for e in exclude}
    groups = defaultdict(list)
    for r in rows:
        s = stratum(r)
        if s is None or not (6 <= int(r["pages"] or 0) <= 40) or os.path.basename(r["file"]) in names:
            continue
        groups[s].append(r)
    rnd = random.Random(seed)
    out = []
    for s in sorted(groups):
        g = groups[s]
        if len(g) < 5:
            continue
        rnd.shuffle(g)
        chosen, seen = [], set()
        for r in sorted(g, key=lambda r: -Counter(layout(x) for x in g)[layout(r)]):
            if layout(r) not in seen:
                chosen.append(r)
                seen.add(layout(r))
            if len(chosen) == n:
                break
        out += [(s, r) for r in chosen]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.expanduser("~/Zotero/storage"),
                    help="folder to search for PDFs (recursively, one level of subfolders)")
    ap.add_argument("--out", default="/tmp/library-probe.tsv")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--pick", type=int, help="print N PDFs from each class in --out, for the corpus")
    ap.add_argument("--exclude", help="a list of PDF paths already in the corpus, one a line")
    a = ap.parse_args()
    if a.pick:
        rows = list(csv.DictReader(open(a.out, encoding="utf-8"), delimiter="\t"))
        exclude = [l.strip() for l in open(a.exclude, encoding="utf-8")] if a.exclude else []
        picks = pick(rows, a.pick, exclude)
        sizes = Counter(stratum(r) for r in rows)
        print(f"# {len(picks)} PDF(s) from {len({s for s, _r in picks})} class(es) of {len(rows)} probed")
        last = None
        for s, r in picks:
            if s != last:
                print(f"\n# {s}   ({sizes[s]} in the library)")
                last = s
            print(f"# {' / '.join(layout(r))}, {r['pages']} pp.\n{r['file']}")
        return
    paths = sorted(glob.glob(os.path.join(a.root, "*", "*.pdf")))
    t0 = time.time()
    with open(a.out, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, FIELDS, delimiter="\t")
        w.writeheader()
        with ProcessPoolExecutor(a.jobs) as ex:
            for i, row in enumerate(ex.map(classify, paths, chunksize=8), 1):
                w.writerow(row)
                if i % 200 == 0:
                    fh.flush()
                    print(f"  {i}/{len(paths)}  ({time.time()-t0:.0f}s)", flush=True)
    print(f"done: {len(paths)} PDFs in {time.time()-t0:.0f}s -> {a.out}", flush=True)


if __name__ == "__main__":
    main()
