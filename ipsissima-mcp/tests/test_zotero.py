#!/usr/bin/env python3
"""Reading someone else's live database without lying about what is in it.

    python3 ipsissima-mcp/tests/test_zotero.py

SYNTHETIC ON PURPOSE. These build their own SQLite databases, so they run on a machine with no
Zotero at all and they test the mechanism rather than the state of one library. The live library
is the wrong instrument here: the WAL fault below is INVISIBLE whenever Zotero has just
checkpointed, which is most of the time, so a test against the real file passes for the wrong
reason and would have passed before the fix.
"""
import contextlib
import os
import sqlite3
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import from_zotero as Z                                                      # noqa: E402
import synthetic_zotero                                                      # noqa: E402

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))


print("the write-ahead log is part of the database\n")
# THROUGH `_db` ITSELF, not a reimplementation of it: pointing ZOTERO_DATA_DIR at a synthetic
# library is what makes this a test of the shipped code path rather than of a copy of it.
with tempfile.TemporaryDirectory() as td:
    live = Path(td) / "zotero.sqlite"
    db = sqlite3.connect(live)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE items (itemID INTEGER PRIMARY KEY)")
    db.execute("INSERT INTO items VALUES (1)")
    db.commit()
    db.execute("PRAGMA wal_checkpoint(FULL)")
    # The row that exists only in the WAL: committed, not yet checkpointed. This is the state a
    # library is in for the seconds after Zotero's connector saves a paper — and it is why a
    # test against the REAL library passes for the wrong reason, since the fault is invisible
    # whenever Zotero has just checkpointed, which is most of the time.
    db.execute("INSERT INTO items VALUES (2)")
    db.commit()

    os.environ["ZOTERO_DATA_DIR"] = td

    def main_file_only():
        """What the old code saw: `shutil.copy` of the main file and nothing else."""
        with tempfile.TemporaryDirectory() as t2:
            dst = Path(t2) / "z.sqlite"
            shutil.copy(live, dst)
            c = sqlite3.connect(dst)
            try:
                return c.execute("SELECT count(*) FROM items").fetchone()[0]
            finally:
                c.close()

    with Z._db() as copy:
        through_db = copy.execute("SELECT count(*) FROM items").fetchone()[0]

    check("the main file alone cannot see the uncheckpointed row", main_file_only(), 1)
    check("  and `_db` recovers it, because it copies the WAL too", through_db, 2)
    check("  which is the whole difference the fix makes", through_db - main_file_only(), 1)

    # THE COPY IS RELEASED. This was `tempfile.mkdtemp()` with no cleanup, so every lookup left
    # 56 MB behind until the machine was rebooted. Measured by what `_db` leaves on disk.
    with Z._db() as copy:
        held = Path(copy.execute("PRAGMA database_list").fetchone()[2]).parent
        check("the copy exists while it is in use", held.exists(), True)
    check("  and is gone once the call returns", held.exists(), False)

    db.close()
    del os.environ["ZOTERO_DATA_DIR"]


@contextlib.contextmanager
def library():
    """A synthetic library that `from_zotero` reads through its own ZOTERO_DATA_DIR path."""
    old = os.environ.get("ZOTERO_DATA_DIR")
    with tempfile.TemporaryDirectory() as td:
        lib = synthetic_zotero.Library(td)
        os.environ["ZOTERO_DATA_DIR"] = td
        try:
            yield lib
        finally:
            if old is None:
                del os.environ["ZOTERO_DATA_DIR"]
            else:
                os.environ["ZOTERO_DATA_DIR"] = old


def keys(entries):
    return [e["key"] for e in entries]


print("\na literal title is not a pattern")
# THROUGH THE LOOKUP, not through an escaping helper: the title match was a LIKE, where `%` and
# `_` are wildcards, and "50%" matched every item in the library. What matters is what a search
# returns, whichever way the matching is done.
with library() as lib:
    lib.record("PCT00001", "Right 50% of the time", ["Hume"])
    lib.attach("PCTHTML1", "PCT00001", "a.html", "text/html")
    lib.record("OTHER001", "Wrong most of the time", ["Hume"])
    lib.attach("OTHHTML1", "OTHER001", "b.html", "text/html")
    lib.record("UNDER001", "The aXb problem", ["Reid"])
    lib.attach("UNDHTML1", "UNDER001", "c.html", "text/html")
    lib.close()
    check("a per-cent sign matches only itself",
          [r["key"] for r in Z.lookup(title="50%")["records"]], ["PCT00001"])
    check("  and an underscore is not any character", Z.lookup(title="a_b")["ok"], False)
    check("ordinary text still matches, case aside",
          [r["key"] for r in Z.lookup(title="wrong MOST")["records"]], ["OTHER001"])
    check("  and punctuation aside", [r["key"] for r in Z.lookup(title="axb")["records"]],
          ["UNDER001"])

# THE MERTON, AS IT WAS ON 26 SEP 2026. The 1948 record with no file; the JSTOR scan dropped in
# on its own; the 2010 reprint with a clean Gale HTML and an image-only PDF. Around them, the
# records that must NOT be taken for the same work.
MERTON = "The Self-Fulfilling Prophecy"


def merton(lib, scan_parent=None, scan_name="Merton_1948_Self-Fulfilling_Prophecy.pdf"):
    lib.record("RD7RL3YD", MERTON, ["Merton"], date="1948", container="The Antioch Review",
               doi="10.2307/4609267")
    scan = lib.attach("5CFLMNN2", scan_parent, scan_name, "application/pdf",
                      make=lambda p: synthetic_zotero.text_pdf(p, first=193))
    # The type-specific container field, as Zotero stores a web page's: read as `publicationTitle`
    # alone, this reprint would have no container and its printing could not be told apart.
    lib.record("KLNGK6S9", "Self-fulfilling prophecy", ["Merton"], date="2010",
               container="Literature Resource Center", container_field="websiteTitle")
    html = lib.attach("ULF282D5", "KLNGK6S9", "LitRC.html", "text/html")
    image = lib.attach("IMGSCAN1", "KLNGK6S9", "LitRC.pdf", "application/pdf",
                       make=synthetic_zotero.image_pdf)
    # Same title, another author: a different work, however alike the words.
    lib.record("DECOY001", MERTON, ["Jussim"], date="1986")
    lib.attach("DECHTML1", "DECOY001", "jussim.html", "text/html")
    # Same author, another title that merely begins alike.
    lib.record("DECOY002", "Self-Fulfilling Prophecies in Schools", ["Merton"])
    lib.attach("DECHTML2", "DECOY002", "schools.html", "text/html")
    # A gold copy in the trash, which would outrank everything if the trash were the library.
    lib.record("TRASHED1", MERTON, ["Merton"], date="1948")
    lib.attach("TRASHMD1", "TRASHED1", "merton.md", "text/markdown")
    lib.trash("TRASHED1")
    return scan, html, image


print("\nthe other records of the same work are found")
with library() as lib:
    scan, html, image = merton(lib)
    lib.close()
    out = Z.lookup(key="RD7RL3YD")
    check("the record with no file is still an answer", out["ok"], True)
    check("  it has nothing of its own", out["attachments"], [])
    rel = {r["record"]["key"]: r for r in out["related"]}
    check("the reprint and the dropped-in scan are its siblings", sorted(rel),
          ["5CFLMNN2", "KLNGK6S9"])
    check("  the reprint by title and author, case and 'The' aside",
          rel["KLNGK6S9"]["matched_by"], "the same title and author")
    check("  the scan by the filename, having no title of its own",
          "carries the title" in rel["5CFLMNN2"]["matched_by"], True)
    check("the reprint is said to be a different printing", rel["KLNGK6S9"]["edition"],
          "different")
    note = rel["KLNGK6S9"]["edition_note"]
    check("  naming both printings and the risk",
          all(w in note for w in ("2010", "Literature Resource Center", "1948",
                                  "The Antioch Review", "wording may differ")), True)
    check("the scan's printing cannot be told", rel["5CFLMNN2"]["edition"], "unknown")
    check("ranked gold/silver/bronze, the image-only PDF last",
          [(e["key"], e["tier"]) for e in out["ranked"]],
          [("ULF282D5", "silver"), ("5CFLMNN2", "bronze"), ("IMGSCAN1", "image-only")])
    check("  and the image-only PDF says what it is",
          out["ranked"][-1]["note"].startswith("image-only PDF"), True)
    check("the best copy is the reprint's HTML", out["best"]["path"], html)
    check("the pairing: extract from the HTML", out["pairing"]["extract_from"], html)
    check("  and page it by the scan, not the image-only PDF",
          out["pairing"]["page_numbers_from"], scan)
    check("`next` names both, and add_page_numbers",
          all(w in out["next"] for w in (html, scan, "add_page_numbers", "extract_text")), True)
    check("  and says the two records may not be one printing",
          "same printing" in out["next"], True)
    check("the same answer by DOI, whatever its case",
          Z.lookup(doi="10.2307/4609267".upper())["pairing"], out["pairing"])

print("\nlooked up from the scan, once it hangs on the record")
with library() as lib:
    scan, html, image = merton(lib, scan_parent="RD7RL3YD",
                               scan_name="4609267.pdf")
    lib.close()
    out = Z.lookup(key="5CFLMNN2")
    check("an attachment's key finds its record", [r["key"] for r in out.get("records", [])],
          ["RD7RL3YD"])
    check("  whose own file is the scan", keys(out["attachments"]), ["5CFLMNN2"])
    check("the HTML is no longer missed", out["pairing"]["extract_from"], html)
    check("  and the scan pages it", out["pairing"]["page_numbers_from"], scan)
    check("the caveat says the two are different printings",
          "different printings" in out["pairing"]["caveat"], True)
    check("  and it reaches `next`", "Different printings" in out["next"]
          or "different printings" in out["next"], True)
    # The one limit worth stating: a file dropped in on its own, named by JSTOR's number rather
    # than the title, has nothing to be matched by -- the case the user closed by moving it.
    check("attachments() keeps its meaning: this record's files only",
          keys(Z.attachments(item_key="RD7RL3YD")), ["5CFLMNN2"])

print("\na dropped-in file named by number cannot be found, and says why not")
with library() as lib:
    merton(lib, scan_name="4609267.pdf")
    lib.close()
    out = Z.lookup(key="5CFLMNN2")
    check("the scan alone is its own record", [r["key"] for r in out["records"]], ["5CFLMNN2"])
    check("  with no title to look for siblings by",
          "no title" in " ".join(out.get("notes", [])), True)
    check("  so it is offered as it is", out["best"]["key"], "5CFLMNN2")
    rel = {r["record"]["key"] for r in Z.lookup(key="RD7RL3YD")["related"]}
    check("and the record looks past it", rel, {"KLNGK6S9"})

print("\nwhat counts as the same work")
with library() as lib:
    lib.record("ANCHOR01", "Moral Luck: A Defence", ["Williams"], date="1976",
               container="Proceedings of the Aristotelian Society")
    lib.record("SUBTITL1", "Moral luck: an essay", ["Williams"], date="1981",
               container="Moral Luck", container_field="bookTitle")
    lib.attach("SUBHTML1", "SUBTITL1", "ml.html", "text/html")
    lib.record("NOAUTH01", "Moral Luck: A Défence")
    lib.attach("NOAHTML1", "NOAUTH01", "ml2.html", "text/html")
    lib.record("NOAUTH02", "Scanned chapter")
    lib.attach("NOAPDF01", "NOAUTH02", "Williams - Moral Luck.pdf", "application/pdf",
               make=synthetic_zotero.text_pdf)
    lib.record("OTHER002", "Moral Luck", ["Nagel"], date="1979")
    lib.attach("OTHHTML2", "OTHER002", "nagel.html", "text/html")
    lib.record("ONEWORD1", "Justice", ["Rawls"])
    lib.record("UNTITLE1")
    lib.attach("UNTPDF01", "UNTITLE1", "Rawls on Justice.pdf", "application/pdf",
               make=synthetic_zotero.text_pdf)
    lib.close()
    rel = {r["record"]["key"]: r for r in Z.lookup(key="ANCHOR01")["related"]}
    check("siblings: the subtitle variant, the authorless record, the matching filename",
          sorted(rel), ["NOAUTH01", "NOAUTH02", "SUBTITL1"])
    check("  the subtitle variant, by author and main title",
          rel["SUBTITL1"]["matched_by"], "the same author and main title; the subtitles differ")
    check("  the authorless one says authorship was not compared",
          "not compared" in rel["NOAUTH01"]["matched_by"], True)
    check("  the titled but authorless record, by its file",
          "no author to compare" in rel["NOAUTH02"]["matched_by"], True)
    check("a bookTitle is a container: the subtitle variant is another printing",
          rel["SUBTITL1"]["edition"], "different")
    check("a one-word title is not looked for in filenames",
          Z.lookup(key="ONEWORD1")["ok"], False)

print("\none record, both copies")
with library() as lib:
    lib.record("ONEREC01", "Of Miracles", ["Hume"])
    # A .md dropped into Zotero is recorded as text/plain: the extension is what says it is gold.
    md = lib.attach("ONEMD001", "ONEREC01", "miracles.md", "text/plain")
    lib.attach("ONEHTM01", "ONEREC01", "miracles.html", "text/html")
    pdf = lib.attach("ONEPDF01", "ONEREC01", "miracles.pdf", "application/pdf",
                     make=synthetic_zotero.text_pdf)
    lib.close()
    out = Z.lookup(title="miracles")
    check("Markdown is gold and first", [e["tier"] for e in out["ranked"]],
          ["gold", "silver", "bronze"])
    check("the pair is Markdown and PDF", (out["pairing"]["extract_from"],
                                           out["pairing"]["page_numbers_from"]), (md, pdf))
    check("  with no caveat, being one record", "caveat" in out["pairing"], False)
    check("best() agrees with the ranking", Z.best(out["attachments"])["path"], md)

print("\nthe record looked up pages the text")
with library() as lib:
    lib.record("CITED001", "Of the Standard of Taste", ["Hume"], date="1757")
    cited = lib.attach("CITEDPDF", "CITED001", "taste-1757.pdf", "application/pdf",
                       make=synthetic_zotero.text_pdf)
    lib.record("LATER001", "Of the standard of taste", ["Hume"], date="1987")
    later = lib.attach("LATERHTM", "LATER001", "taste.html", "text/html")
    lib.attach("LATERPDF", "LATER001", "taste-1987.pdf", "application/pdf",
               make=synthetic_zotero.text_pdf)
    lib.close()
    out = Z.lookup(key="CITED001")
    # THE PAGES CITED ARE THE PRINTING LOOKED UP. The sibling's own PDF would pair more
    # neatly with its HTML, and put the wrong edition's page numbers on every quotation.
    check("the text from the sibling, the pages from the record looked up",
          (out["pairing"]["extract_from"], out["pairing"]["page_numbers_from"]),
          (later, cited))
    check("a year apart is another printing, with no container to compare",
          out["related"][0]["edition"], "different")

print("\nwhen there is nothing to pair")
with library() as lib:
    lib.record("SCANONLY", "A Treatise", ["Hume"])
    scan = lib.attach("SCANPDF1", "SCANONLY", "treatise.pdf", "application/pdf",
                      make=synthetic_zotero.image_pdf)
    lib.record("HTMLONLY", "An Enquiry", ["Hume"])
    lib.attach("ENQHTML1", "HTMLONLY", "enquiry.html", "text/html")
    lib.attach("ENQSCAN1", "HTMLONLY", "enquiry.pdf", "application/pdf",
               make=synthetic_zotero.image_pdf)
    lib.record("NOFILES1", "A Dialogue", ["Hume"])
    lib.close()
    out = Z.lookup(key="SCANONLY")
    check("an image-only PDF alone sends the reader to assess_pdf",
          out["next"].startswith(f"call assess_pdf on {scan}"), True)
    check("  and is not paired", out["pairing"], None)
    out = Z.lookup(key="HTMLONLY")
    check("HTML with only a scan beside it: no pairing", out["pairing"], None)
    check("  and `next` says the scan cannot give page numbers",
          "cannot read page numbers" in out["next"], True)
    out = Z.lookup(key="NOFILES1")
    check("a record with no file anywhere says so",
          (out["ok"], "no record of this work has a file" in out["error"]), (False, True))
    check("an unknown key is not a match", Z.lookup(key="NOSUCHKY")["error"],
          "nothing in Zotero matches")

print("\nthe data directory is not assumed")
old = os.environ.get("ZOTERO_DATA_DIR")
os.environ["ZOTERO_DATA_DIR"] = "/somewhere/else"
check("an explicit override wins", str(Z.data_dir()), "/somewhere/else")
check("  and storage follows it", str(Z.storage_dir()), "/somewhere/else/storage")
if old is None:
    del os.environ["ZOTERO_DATA_DIR"]
else:
    os.environ["ZOTERO_DATA_DIR"] = old

print("\na schema this file has not been read against is refused")
with tempfile.TemporaryDirectory() as td:
    p = Path(td) / "v.sqlite"
    c = sqlite3.connect(p)
    c.execute("CREATE TABLE version (schema TEXT, version INTEGER)")
    c.execute("INSERT INTO version VALUES ('userdata', ?)", (Z.SCHEMA_MAX,))
    c.commit()
    Z._check_schema(c)                       # at the ceiling: fine
    check("the checked version passes", True, True)
    c.execute("UPDATE version SET version=?", (Z.SCHEMA_MAX + 1,))
    c.commit()
    try:
        Z._check_schema(c)
        check("a newer schema is refused", False, True)
    except SystemExit as e:
        check("a newer schema is refused", "SCHEMA_MAX" in str(e), True)
    c.close()
# A database with no version table at all is left to the queries rather than refused.
with tempfile.TemporaryDirectory() as td:
    p = Path(td) / "n.sqlite"
    c = sqlite3.connect(p)
    c.execute("CREATE TABLE items (itemID INTEGER)")
    c.commit()
    Z._check_schema(c)
    check("  a database with no version table is not refused", True, True)
    c.close()

print()
if fails:
    print(f"{fails} FAILED\n")
    sys.exit(1)
print("all passed\n")
