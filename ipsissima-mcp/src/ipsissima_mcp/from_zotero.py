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

ONE WORK, SEVERAL RECORDS. The best copy is often not on the record that was looked up. Merton's
"The Self-Fulfilling Prophecy" (26 Sep 2026) sat on three: the 1948 Antioch Review record, with
no file; an untitled record made by dropping the JSTOR scan into Zotero; and a record for the
2010 reprint whose Gale HTML was clean and whose own PDF was an image-only scan. A lookup of one
record found nothing, and a lookup of the scan never mentioned the HTML -- which was the right
source all along (G2 in docs/values/INVENTORY.md), paired with the scan's page numbers. So
`lookup` asks the whole library for the same work, and says when a sibling is a different
printing, because a reprint's wording can differ from the text being cited.
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
import unicodedata
from pathlib import Path

#: The newest `userdata` schema this file has been read against. Zotero's layout is not a public
#: interface, and every query below names columns in it. Refusing above a checked ceiling turns a
#: silently wrong answer into a message; see `_check_schema`.
SCHEMA_MAX = 129

#: Best first: the order of the list is what decides. Markdown is gold, what pandoc reads is
#: silver, a PDF is bronze (G2) -- a heading in the first two is a heading because the document
#: says so, and in the third because something guessed from the type size.
ROUTES = ["markdown", "epub", "html", "docx", "pdf"]
TIERS = {"markdown": "gold", "epub": "silver", "html": "silver", "docx": "silver",
         "pdf": "bronze"}

#: What an attachment is. The content type Zotero recorded first; the file's extension only where
#: Zotero recorded something generic, which it does for a file dropped in by hand.
KINDS = {"text/markdown": "markdown", "text/x-markdown": "markdown",
         "application/epub+zip": "epub", "text/html": "html",
         "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
         "application/pdf": "pdf"}
EXTENSIONS = {".md": "markdown", ".markdown": "markdown", ".epub": "epub", ".html": "html",
              ".htm": "html", ".docx": "docx", ".pdf": "pdf"}

#: Fewer words a page than this off a PDF's own text layer is a scan with nothing under it -- the
#: line `assess_pdf` calls "hard". ONE NUMBER, held here and read there: two opinions about what
#: counts as image-only would sooner or later rank a PDF above the tool that then refuses it.
IMAGE_ONLY_WORDS_PER_PAGE = 40

#: The fields a record's container can be stored under. Zotero keeps the TYPE-SPECIFIC field (a
#: chapter's `bookTitle`, a web page's `websiteTitle`), not the base `publicationTitle` they map
#: to, so asking for the base name alone reads a reprint in an anthology as having no container.
CONTAINERS = ("publicationTitle", "bookTitle", "websiteTitle", "proceedingsTitle",
              "encyclopediaTitle", "dictionaryTitle", "blogTitle", "forumTitle",
              "programTitle")


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


def _kind(ctype, filename):
    return KINDS.get(ctype or "") or EXTENSIONS.get(Path(filename).suffix.lower())


def _library(db):
    """Every live record and every stored attachment, read once: ({key: record}, {att: record}).

    THE WHOLE LIBRARY, NOT A FILTERED QUERY. Finding the other records of a work means comparing
    titles after folding case, accents and punctuation, and SQL has no fold for that; a query
    narrowed first by LIKE would miss exactly the sibling whose title is punctuated differently.
    One pass over a copy the size of this library costs less than the copy itself.
    """
    # THE TRASH IS NOT THE LIBRARY. A deleted attachment, or a live attachment hanging off a
    # deleted parent, is still joined by every table below -- Zotero marks rather than removes.
    # Eleven items in this library were reachable through a deleted parent, and returning one
    # means offering a file the user believes they threw away.
    gone = {r[0] for r in db.execute("SELECT itemID FROM deletedItems")}
    items = {iid: dict(key=key, added=added or "")
             for iid, key, added in db.execute("SELECT itemID, key, dateAdded FROM items")
             if iid not in gone}
    names = ("title", "date", "DOI") + CONTAINERS
    fields = {}
    for iid, name, value in db.execute(
            "SELECT d.itemID, f.fieldName, v.value FROM itemData d "
            "JOIN fields f ON f.fieldID = d.fieldID "
            "JOIN itemDataValues v ON v.valueID = d.valueID "
            f"WHERE f.fieldName IN ({','.join('?' * len(names))})", names):
        fields.setdefault(iid, {})[name] = value or ""
    creators = {}
    for iid, last in db.execute(
            "SELECT ic.itemID, c.lastName FROM itemCreators ic "
            "JOIN creators c ON c.creatorID = ic.creatorID ORDER BY ic.itemID, ic.orderIndex"):
        if last:
            creators.setdefault(iid, []).append(last)

    def record(iid, key):
        f = fields.get(iid, {})
        year = re.match(r"\d{4}", f.get("date", ""))
        return dict(key=key, title=f.get("title", ""), authors=creators.get(iid, []),
                    year=year.group(0) if year else "", doi=f.get("DOI", ""),
                    container=next((f[c] for c in CONTAINERS if f.get(c)), ""),
                    attachments=[])

    rows = list(db.execute("SELECT itemID, parentItemID, contentType, path FROM itemAttachments"))
    attached = {r[0] for r in rows}
    records = {items[i]["key"]: record(i, items[i]["key"]) for i in items if i not in attached}
    owner = {}
    storage = storage_dir()
    for iid, parent, ctype, path in rows:
        if iid not in items or (parent is not None and parent not in items):
            continue
        key = items[iid]["key"]
        if parent is None:
            # A FILE DROPPED INTO ZOTERO ON ITS OWN is a record of the work too: the JSTOR scan
            # of the Merton was one. It stands for itself, with no title or author to compare
            # -- the attachment's own title is a filename, not the work's -- so it can be found
            # only by what its file is called.
            rec = records[key] = record(None, key)
            rec["standalone"] = True
        else:
            rec = records.get(items[parent]["key"])
            if rec is None:
                continue
        owner[key] = rec["key"]
        if not (path or "").startswith("storage:"):
            continue
        f = storage / key / path.split("storage:", 1)[1]
        if not f.exists():
            continue
        rec["attachments"].append(dict(
            key=key, parent=items[parent]["key"] if parent is not None else None,
            record=rec["key"], kind=_kind(ctype, f.name), ctype=ctype, path=str(f),
            filename=f.name, added=items[iid]["added"],
            label=fields.get(iid, {}).get("title", ""),
            title=rec["title"], journal=rec["container"]))
    for rec in records.values():
        # DETERMINISTIC, so `best()` returns the same attachment on every run of one library.
        # Without it the order is whatever the query plan happened to produce, and a re-saved
        # snapshot could win or lose from run to run. Newest first: where a page has been saved
        # twice, the later save is the one the reader meant.
        rec["attachments"].sort(key=lambda a: a["key"])
        rec["attachments"].sort(key=lambda a: a["added"], reverse=True)
    return records, owner


def _fold(s):
    """Lowercase letters and digits in single spaces: case, accents and punctuation gone.

    PUNCTUATION BECOMES A SPACE, not nothing, so "Self-Fulfilling" and "Self Fulfilling" agree,
    and so do a filename's underscores and a title's spaces.
    """
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return " ".join(re.sub(r"[\W_]+", " ", s).split())


def _title(t):
    """A title for comparing: folded, and without a leading "The", which one printing keeps and
    another's cataloguer drops."""
    return re.sub(r"^the ", "", _fold(t))


def _main_title(t):
    return _title((t or "").split(":", 1)[0])


def _anchors(records, owner, key=None, doi=None, title=None):
    """The records asked for. Every given criterion must hold, as the SQL `WHERE` it replaces."""
    out = []
    for rec in records.values():
        # An attachment's key names the record it hangs on: the key a reader has to hand is as
        # often the PDF's, from its storage folder, as the record's.
        if key and rec["key"] not in (key, owner.get(key)):
            continue
        if doi and rec["doi"].lower() != doi.lower():
            continue
        # A LITERAL FRAGMENT, NOT A PATTERN. This was a LIKE, where `%` and `_` are wildcards:
        # unescaped, a search for "50%" matched every item in the library and "a_b" matched
        # "aXb". Substring containment has no wildcards to escape. The folded comparison is the
        # second chance, so "self fulfilling" still finds "Self-Fulfilling".
        if title and not (title.lower() in rec["title"].lower()
                          or (_fold(title) and _fold(title) in _fold(rec["title"]))):
            continue
        out.append(rec)
    return sorted(out, key=lambda r: r["key"])


def _same_work(anchor, cand):
    """Why `cand` is another record of `anchor`'s work, as a phrase -- or None if it is not."""
    want = _title(anchor["title"])
    if not want:
        return None
    mine = {_fold(a) for a in anchor["authors"]}
    theirs = {_fold(a) for a in cand["authors"]}
    got = _title(cand["title"])
    if got:
        # A SHARED TITLE WITH DIFFERENT AUTHORS IS A DIFFERENT WORK. "Introduction" and "Moral
        # Luck" are each several papers; only where one side names nobody is a title all there
        # is to go on, and the phrase then says so.
        if mine and theirs and not mine & theirs:
            return None
        if got == want:
            return ("the same title and author" if mine and theirs else
                    "the same title (one record names no author, so authorship was not compared)")
        if mine and theirs and _main_title(cand["title"]) == _main_title(anchor["title"]):
            return "the same author and main title; the subtitles differ"
    if got and theirs:
        return None
    # AN UNTITLED OR AUTHORLESS RECORD HAS ONLY ITS FILENAMES TO GO ON. The main title as well
    # as the whole one, since a filename usually drops the subtitle; two words at least, since
    # a one-word title ("Justice") is inside too many filenames to mean anything there.
    wants = {w for w in (want, _main_title(anchor["title"])) if len(w.split()) >= 2}
    for a in cand["attachments"]:
        for name in (Path(a["filename"]).stem, a["label"]):
            if any(f" {w} " in f" {_title(name)} " for w in wants):
                return (f"its file {a['filename']!r} carries the title; the record has no "
                        f"{'title' if not got else 'author'} to compare")
    return None


def _printing(rec):
    return ", ".join(x for x in (rec["year"], rec["container"]) if x) or "no date or container"


def _edition(anchor, cand):
    """('same' | 'different' | 'unknown', sentence) -- is `cand` the printing `anchor` is?

    SAID, BECAUSE THE WORDS MAY DIFFER. A reprint is usually the same text, and sometimes a
    revised one; a quotation checked against the wrong printing fails, or worse passes against
    words the cited edition does not have.
    """
    ay, cy = anchor["year"], cand["year"]
    ac, cc = _fold(anchor["container"]), _fold(cand["container"])
    if (ay and cy and ay != cy) or (ac and cc and ac != cc):
        return "different", (f"a different edition or a reprint ({_printing(cand)}; the record "
                             f"looked up is {_printing(anchor)}), so its wording may differ")
    if (ay and cy) or (ac and cc):
        return "same", f"the same printing as far as the records say ({_printing(cand)})"
    return "unknown", (f"whether this is the same printing cannot be told: {_printing(cand)} on "
                       f"this record, {_printing(anchor)} on the one looked up")


def text_layer(path):
    """Words a page on the PDF's own text layer, or None if the file cannot be read."""
    try:
        import pymupdf
        with pymupdf.open(path) as doc:
            pages = doc.page_count
            words = sum(len(page.get_text().split()) for page in doc)
    except Exception:
        return None
    return round(words / max(pages, 1), 1)


#: Ranking order. An image-only PDF is bronze with no text under it: it goes last among the
#: text sources, and its tier says why rather than leaving the reader to find out by converting.
TIER_ORDER = ["gold", "silver", "bronze", "image-only", None]
RELATIONS = {"this record": 0, "same": 1, "unknown": 2, "different": 3}


def _graded(att, relation, note=None):
    out = dict(att, tier=TIERS.get(att["kind"]), relation=relation)
    if note:
        out["edition_note"] = note
    if att["kind"] == "pdf":
        wpp = text_layer(att["path"])
        out["words_per_page"] = wpp
        if wpp is not None and wpp < IMAGE_ONLY_WORDS_PER_PAGE:
            out["tier"] = "image-only"
            out["note"] = (f"image-only PDF: {wpp:g} words a page on its text layer, so its "
                           f"text and page numbers would have to come from OCR")
    return out


def _rank(entries):
    """Tier first, as G2 orders them; within a tier, the record looked up before its siblings,
    and a sibling of the same printing before one whose wording may differ."""
    return sorted(entries, key=lambda e: (
        TIER_ORDER.index(e["tier"]), RELATIONS[e["relation"]],
        ROUTES.index(e["kind"]) if e["kind"] in ROUTES else len(ROUTES)))


def _summary(rec):
    return {k: rec[k] for k in ("key", "title", "authors", "year", "container")}


def _where(e):
    return f"{e['path']} (the {e['kind']} on record {e['record']})"


def lookup(key=None, doi=None, title=None):
    """What the library holds of this work, best copy first, and what to do with it.

    `attachments` and `best` keep their old meaning for the record looked up; `related` and
    `ranked` are the rest of the library's copies of the same work.
    """
    with _db() as db:
        records, owner = _library(db)
    anchors = _anchors(records, owner, key=key, doi=doi, title=title)
    if not anchors:
        return dict(ok=False, error="nothing in Zotero matches")
    mine = {r["key"] for r in anchors}
    related, notes = [], []
    for anchor in anchors:
        if not _title(anchor["title"]):
            notes.append(f"record {anchor['key']} has no title, so no other record of the same "
                         f"work could be looked for")
            continue
        for cand in sorted(records.values(), key=lambda r: r["key"]):
            if cand["key"] in mine or not cand["attachments"]:
                continue
            why = _same_work(anchor, cand)
            if why:
                mine.add(cand["key"])
                edition, note = _edition(anchor, cand)
                related.append(dict(record=_summary(cand), matched_by=why, edition=edition,
                                    edition_note=note, of=anchor["key"],
                                    attachments=[_graded(a, edition, note)
                                                 for a in cand["attachments"]]))
    own = [_graded(a, "this record") for r in anchors for a in r["attachments"]]
    ranked = _rank(own + [a for rel in related for a in rel["attachments"]])
    out = dict(ok=True, records=[_summary(r) for r in anchors], attachments=own,
               related=related, ranked=ranked,
               best=ranked[0] if ranked and ranked[0]["tier"] else None)
    if notes:
        out["notes"] = notes
    if not ranked:
        out.update(ok=False, error="Zotero has the record, but no record of this work has a "
                                   "file stored locally")
        return out
    out["pairing"], out["next"] = _advice(ranked, records)
    return out


def _advice(ranked, records):
    """(pairing, next): the structured copy to extract from, and the PDF to paginate it by."""
    structured = [e for e in ranked if e["tier"] in ("gold", "silver")]
    paged = [e for e in ranked if e["tier"] == "bronze"]
    scans = [e for e in ranked if e["tier"] == "image-only"]
    if structured and paged:
        s, p = structured[0], paged[0]
        pairing = dict(extract_from=s["path"], page_numbers_from=p["path"])
        say = (f"call argdown_plan and extract_text with {_where(s)}, then add_page_numbers "
               f"with the extracted Markdown and pdf_path {_where(p)}")
        if s["record"] != p["record"]:
            # TWO RECORDS MAY BE TWO PRINTINGS. add_page_numbers finds each sheet's opening
            # words in the text, so a page where the reprint's wording differs gets no marker
            # and is named in its report -- a gap, never a wrong page; the caveat is for the
            # quotations, which must be the words of the printing cited.
            srec, prec = records[s["record"]], records[p["record"]]
            edition, _note = _edition(prec, srec)
            both = (f"the structured copy ({_printing(srec)}) and the PDF ({_printing(prec)})")
            if edition == "different":
                pairing["caveat"] = (f"{both} are different printings, so the wording may "
                                     f"differ: check quotations against the PDF, and expect "
                                     f"add_page_numbers to leave unmarked any page whose "
                                     f"opening words differ")
            elif edition == "unknown":
                pairing["caveat"] = (f"{both} are on records that do not say whether they are "
                                     f"the same printing: check a quotation or two against "
                                     f"the PDF")
            if "caveat" in pairing:
                say += ". " + pairing["caveat"][0].upper() + pairing["caveat"][1:]
        return pairing, say
    if structured:
        s = structured[0]
        say = f"call argdown_plan with {_where(s)}"
        if s.get("edition_note"):
            say += f"; it is on another record, {s['edition_note']}"
        if scans:
            say += (f". The only PDF ({scans[0]['path']}) is image-only, so add_page_numbers "
                    f"cannot read page numbers from it and the text will carry none")
        else:
            say += ". No record of this work has a PDF, so the text will carry no page numbers"
        return None, say
    if paged:
        return None, (f"call argdown_plan with {_where(paged[0])}. No record of this work has a "
                      f"structured copy (Markdown, EPUB, HTML, .docx), so the text comes from "
                      f"the PDF")
    if scans:
        return None, (f"call assess_pdf on {scans[0]['path']}: it is image-only, with no text "
                      f"layer, and no record of this work has anything better")
    return None, "none of the stored files is a text source this toolchain reads"


def attachments(item_key=None, doi=None, title=None):
    """Every local attachment of the matching record(s): [{key, kind, path, title, journal}]."""
    with _db() as db:
        records, owner = _library(db)
    return [a for r in _anchors(records, owner, key=item_key, doi=doi, title=title)
            for a in r["attachments"]]


def best(atts):
    """The attachment to read, by the order in ROUTES."""
    for kind in ROUTES:
        for a in atts:
            if a["kind"] == kind:
                return a
    return None


def convert(att, out=None):
    """Convert one attachment by whichever route suits it. Returns (markdown_or_None, report)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    if att["kind"] == "markdown":
        md = Path(att["path"]).read_text(encoding="utf-8")
        return md, {"words": len(md.split())}
    if att["kind"] == "html":
        import html_to_source as H
        return H.convert(att["path"])
    if att["kind"] == "epub":
        import epub_to_source as E
        meta, docs, skipped = E.convert(att["path"], out)
        md = "\n\n".join(d["markdown"] for d in docs)
        return md, {"title": meta.get("title"), "words": len(md.split()),
                    "documents": len(docs), "skipped": len(skipped)}
    if att["kind"] == "docx":
        return None, {"why": "a .docx — use ingest.py (extract_text), which reads it through "
                             "pandoc"}
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
