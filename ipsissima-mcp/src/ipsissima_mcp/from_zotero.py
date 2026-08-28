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
import contextlib
import glob
import os
import re
import sqlite3
import shutil
import tempfile
from pathlib import Path

#: The newest `userdata` schema this file has been read against. Zotero's layout is not a public
#: interface, and every query below names columns in it. Refusing above a checked ceiling turns a
#: silently wrong answer into a message; see `_check_schema`.
SCHEMA_MAX = 129

#: Best first. The number is only for reporting; the order of the list is what decides.
ROUTES = [("application/epub+zip", "epub"), ("text/html", "html"), ("application/pdf", "pdf")]


def data_dir():
    """Where Zotero actually keeps its data.

    NOT `~/Zotero`, WHICH IS ONLY THE DEFAULT. A relocated data directory used to fail
    invisibly rather than loudly: `_zotero_available()` in the server gates tool REGISTRATION,
    so the result was not an error but a server with no Zotero tool in it and nothing saying
    why. Honours `ZOTERO_DATA_DIR`, then the profile's own `extensions.zotero.dataDir`, then
    the default.
    """
    env = os.environ.get("ZOTERO_DATA_DIR")
    if env:
        return Path(env).expanduser()
    for prefs in glob.glob(str(Path.home() / "Library" / "Application Support" / "Zotero"
                               / "Profiles" / "*" / "prefs.js")):
        try:
            text = Path(prefs).read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        m = re.search(r'user_pref\("extensions\.zotero\.dataDir",\s*"((?:[^"\\]|\\.)*)"\)', text)
        if m:
            return Path(m.group(1).encode().decode("unicode_escape")).expanduser()
    return Path.home() / "Zotero"


def storage_dir():
    return data_dir() / "storage"


def _check_schema(db):
    """Refuse a layout this file has not been read against, rather than answer wrongly."""
    try:
        row = db.execute("SELECT version FROM version WHERE schema='userdata'").fetchone()
    except sqlite3.Error:
        return                                  # no version table: leave it to the queries
    if row and row[0] > SCHEMA_MAX:
        raise SystemExit(
            f"Zotero's userdata schema is version {row[0]}; this has been checked against "
            f"{SCHEMA_MAX}.\nThe queries here name columns in a layout that is not a public "
            "interface, so a newer one may\nreturn the wrong rows rather than fail. Check "
            "`attachments()` against the new schema and raise\nSCHEMA_MAX in from_zotero.py.")


@contextlib.contextmanager
def _db():
    """A COPY of the Zotero database. Never the live file: Zotero holds it open, and a reader
    that locks it can stop the application writing.

    THE WRITE-AHEAD LOG IS PART OF THE DATABASE. Copying `zotero.sqlite` alone gets a database
    with no WAL to recover, so every transaction Zotero has committed but not yet checkpointed
    is simply absent -- measured on this library, 2000 rows of 2001. That is not an abstract
    loss: it is exactly the workflow this module's own docstring describes, where the connector
    has just saved a paper. The tool then reports "nothing in Zotero matches", which is a claim
    about the library and not about our copy of it.

    MAIN FILE FIRST, then the WAL: copied the other way round, the WAL can be checkpointed away
    between the two reads and the copy is the older of the two states rather than the newer.
    Opened WITHOUT `immutable`, because immutable is precisely the flag that says "assume no
    WAL" -- it is what zotero-mcp uses, and it is why they have the same blind spot.

    RELEASED WHEN DONE. This used to be `tempfile.mkdtemp()` with no cleanup, so every lookup
    left 56 MB behind until the machine was rebooted.
    """
    src = data_dir() / "zotero.sqlite"
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "z.sqlite"
        shutil.copy(src, tmp)
        wal = src.with_name("zotero.sqlite-wal")
        if wal.exists():
            shutil.copy(wal, tmp.with_name("z.sqlite-wal"))
        db = sqlite3.connect(tmp)
        try:
            _check_schema(db)
            yield db
        finally:
            db.close()


def _like(fragment):
    """A user's literal string, made safe for LIKE.

    `%` AND `_` ARE WILDCARDS IN A PATTERN and ordinary characters in a title. Interpolated
    unescaped, a search for "50%" matched every item in the library and a search for "a_b"
    matched "aXb" -- silently, and as though those were the answer.
    """
    return "%" + fragment.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def attachments(item_key=None, doi=None, title=None):
    """Every local attachment of the matching item(s): [{key, kind, path, title, journal}]."""
    where, args = [], []
    if item_key:
        where.append("parent.key = ?"); args.append(item_key)
    if doi:
        where.append("LOWER(doiv.value) = LOWER(?)"); args.append(doi)
    if title:
        where.append("titlev.value LIKE ? ESCAPE '\\'"); args.append(_like(title))
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
        -- THE TRASH IS NOT THE LIBRARY. A deleted attachment, or a live attachment hanging off a
        -- deleted parent, is still joined by every table above -- Zotero marks rather than
        -- removes. Eleven items in this library are currently reachable through a deleted
        -- parent, and returning one means offering a file the user believes they threw away.
        AND att.itemID NOT IN (SELECT itemID FROM deletedItems)
        AND parent.itemID NOT IN (SELECT itemID FROM deletedItems)
    """ + ("".join(" AND " + w for w in where)) + """
      -- DETERMINISTIC, so `best()` returns the same attachment on every run of one library.
      -- Without it the order is whatever the query plan happened to produce, and a re-saved
      -- snapshot could win or lose from run to run. Newest first: where a page has been saved
      -- twice, the later save is the one the reader meant.
      ORDER BY att.dateAdded DESC, att.key
    """
    out = []
    storage = storage_dir()
    with _db() as db:
        rows = list(db.execute(sql, args))
    for akey, ctype, path, ttl, pub, pkey in rows:
        f = storage / akey / path.split("storage:", 1)[1]
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
