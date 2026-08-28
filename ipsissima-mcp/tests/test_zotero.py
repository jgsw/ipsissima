#!/usr/bin/env python3
"""Reading someone else's live database without lying about what is in it.

    python3 ipsissima-mcp/tests/test_zotero.py

SYNTHETIC ON PURPOSE. These build their own SQLite databases, so they run on a machine with no
Zotero at all and they test the mechanism rather than the state of one library. The live library
is the wrong instrument here: the WAL fault below is INVISIBLE whenever Zotero has just
checkpointed, which is most of the time, so a test against the real file passes for the wrong
reason and would have passed before the fix.
"""
import os
import sqlite3
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "ipsissima_mcp"))
import from_zotero as Z                                                      # noqa: E402

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

print("\na literal title is not a pattern")
check("a per-cent sign is escaped", Z._like("50%"), r"%50\%%")
check("  and an underscore", Z._like("a_b"), r"%a\_b%")
check("  and a backslash first, or the escapes escape each other",
      Z._like(r"a\b"), "%a" + "\\\\" + "b%")
check("ordinary text is untouched", Z._like("Hume"), "%Hume%")

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
