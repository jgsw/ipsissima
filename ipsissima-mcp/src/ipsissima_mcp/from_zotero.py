#!/usr/bin/env python3
"""Get an article's text from Zotero, by the best route its attachments allow.

THE ACQUISITION PROBLEM IS ALREADY SOLVED, and not by us. Publishers serve full text as HTML and
EPUB to a logged-in reader, and sit behind a Cloudflare challenge that no script may pass. Zotero's
connector is not a script: it is the reader's own browser, with the reader's own session, and it
saves the page. So the file is on disk before this toolchain is asked anything.

WHAT ORDER, AND WHY. Measured across this library:

  EPUB           the publisher's own XHTML. Sections, footnotes and often PAGE NUMBERS, all
                 marked up. 27 items have one.
  HTML snapshot  the article as served. 1,206 items have one, and a 70-item sample converted 46
                 clean full articles at a median of 7,526 words -- in aesthetics, bioethics and
                 applied philosophy, exactly where the Crossref/Unpaywall/Europe PMC route
                 returned nothing at all (5 of 45).
  PDF            the last resort, and the only one that has to recover structure from ink. On a
                 45-paper corpus it refused 28 outright.

So the PDF is what you fall back to, not what you start from -- which inverts how this toolchain
began. `zotero_get_item_children` reports what an item has; this decides what to do with it.
"""
from __future__ import annotations

import argparse
import sqlite3
import shutil
import tempfile
from pathlib import Path

ZOTERO = Path.home() / "Zotero"
STORAGE = ZOTERO / "storage"

#: Best first. The number is only for reporting; the order of the list is what decides.
ROUTES = [("application/epub+zip", "epub"), ("text/html", "html"), ("application/pdf", "pdf")]


def _db():
    """A COPY of the Zotero database. Never the live file: Zotero holds it open, and a reader
    that locks it can stop the application writing."""
    tmp = Path(tempfile.mkdtemp()) / "z.sqlite"
    shutil.copy(ZOTERO / "zotero.sqlite", tmp)
    return sqlite3.connect(tmp)


def attachments(item_key=None, doi=None, title=None):
    """Every local attachment of the matching item(s): [{key, kind, path, title, journal}]."""
    db = _db()
    where, args = [], []
    if item_key:
        where.append("parent.key = ?"); args.append(item_key)
    if doi:
        where.append("LOWER(doiv.value) = LOWER(?)"); args.append(doi)
    if title:
        where.append("titlev.value LIKE ?"); args.append(f"%{title}%")
    sql = """
      SELECT att.key, ia.contentType, ia.path, titlev.value, pubv.value, parent.key
      FROM itemAttachments ia
      JOIN items att ON att.itemID = ia.itemID
      JOIN items parent ON parent.itemID = ia.parentItemID
      LEFT JOIN itemData dT ON dT.itemID=parent.itemID AND dT.fieldID=(SELECT fieldID FROM fields WHERE fieldName='title')
      LEFT JOIN itemDataValues titlev ON titlev.valueID=dT.valueID
      LEFT JOIN itemData dP ON dP.itemID=parent.itemID AND dP.fieldID=(SELECT fieldID FROM fields WHERE fieldName='publicationTitle')
      LEFT JOIN itemDataValues pubv ON pubv.valueID=dP.valueID
      LEFT JOIN itemData dD ON dD.itemID=parent.itemID AND dD.fieldID=(SELECT fieldID FROM fields WHERE fieldName='DOI')
      LEFT JOIN itemDataValues doiv ON doiv.valueID=dD.valueID
      WHERE ia.path LIKE 'storage:%'
    """ + ("".join(" AND " + w for w in where))
    out = []
    for akey, ctype, path, ttl, pub, pkey in db.execute(sql, args):
        f = STORAGE / akey / path.split("storage:", 1)[1]
        if not f.exists():
            continue
        kind = next((k for ct, k in ROUTES if ct == ctype), None)
        out.append(dict(key=akey, parent=pkey, kind=kind, ctype=ctype, path=str(f),
                        title=ttl or "", journal=pub or ""))
    return out


def best(atts):
    """The attachment to read, by the order in ROUTES."""
    for _ct, kind in ROUTES:
        for a in atts:
            if a["kind"] == kind:
                return a
    return None


def convert(att, out=None):
    """Convert one attachment by whichever route suits it. Returns (markdown_or_None, report)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    if att["kind"] == "html":
        import html_to_source as H
        return H.convert(att["path"])
    if att["kind"] == "epub":
        import epub_to_source as E
        meta, docs, skipped = E.convert(att["path"], out)
        md = "\n\n".join(d["markdown"] for d in docs)
        return md, {"title": meta.get("title"), "words": len(md.split()),
                    "documents": len(docs), "skipped": len(skipped)}
    return None, {"why": "only a PDF is attached — use pdf_to_source.py, which has to recover "
                         "the structure from the page and may need a per-paper config"}


def main():
    ap = argparse.ArgumentParser(description="Read an article from Zotero, best format first.")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--key", help="Zotero item key")
    g.add_argument("--doi")
    g.add_argument("--title", help="a fragment of the title")
    ap.add_argument("--out", help="write the markdown here")
    ap.add_argument("--list", action="store_true", help="just show what is attached")
    a = ap.parse_args()

    atts = attachments(item_key=a.key, doi=a.doi, title=a.title)
    if not atts:
        print("  nothing in Zotero matches, or its files are not stored locally")
        return 1
    print(f"  {atts[0]['title'][:64]}")
    print(f"  {atts[0]['journal'][:50]}")
    for x in atts:
        print(f"     {x['kind'] or x['ctype']:6} {Path(x['path']).name[:54]}")
    if a.list:
        return 0
    pick = best(atts)
    print(f"\n  reading the {pick['kind']}")
    md, rep = convert(pick, a.out if pick["kind"] == "epub" else None)
    if md is None:
        print("  " + rep.get("why", "could not be read"))
        return 1
    print(f"  {rep.get('words', 0):,} words")
    if a.out and pick["kind"] != "epub":
        Path(a.out).write_text(md, encoding="utf-8")
        print(f"  wrote {a.out}")
    elif not a.out:
        print()
        print(md[:600])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
