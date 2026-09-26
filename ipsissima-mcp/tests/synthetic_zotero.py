"""A Zotero library built in a temporary folder, for tests that must not read anyone's own.

ONLY THE COLUMNS `from_zotero` READS, laid out as Zotero lays them out: a record is a row in
`items` with fields through `itemData`/`itemDataValues`, a file is a row in `itemAttachments`
whose `path` is `storage:<name>` under `storage/<its key>/`, and the trash is `deletedItems`. A
query that names a column this does not have fails here loudly -- which is the point of building
it from the schema rather than from what the code happens to ask.
"""
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE version (schema TEXT PRIMARY KEY, version INT NOT NULL);
CREATE TABLE items (itemID INTEGER PRIMARY KEY, itemTypeID INT, dateAdded TEXT, key TEXT);
CREATE TABLE deletedItems (itemID INTEGER PRIMARY KEY, dateDeleted TEXT);
CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT);
CREATE TABLE itemDataValues (valueID INTEGER PRIMARY KEY, value UNIQUE);
CREATE TABLE itemData (itemID INT, fieldID INT, valueID INT, PRIMARY KEY (itemID, fieldID));
CREATE TABLE creators (creatorID INTEGER PRIMARY KEY, firstName TEXT, lastName TEXT,
                       fieldMode INT);
CREATE TABLE itemCreators (itemID INT, creatorID INT, creatorTypeID INT, orderIndex INT);
CREATE TABLE itemAttachments (itemID INTEGER PRIMARY KEY, parentItemID INT, linkMode INT,
                              contentType TEXT, path TEXT);
"""


def text_pdf(path, pages=3, first=1):
    """A PDF with a real text layer: prose on every sheet and a printed page number."""
    import pymupdf
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 60), str(first + i))
        page.insert_textbox(pymupdf.Rect(72, 90, 520, 760),
                            " ".join(["the prophecy fulfils itself"] * 40), fontsize=10)
    doc.save(path)


def image_pdf(path, pages=3):
    """A PDF that is ink and no text, as a scan without OCR is: a filled shape on each sheet."""
    import pymupdf
    doc = pymupdf.open()
    for _ in range(pages):
        page = doc.new_page()
        page.draw_rect(pymupdf.Rect(72, 72, 520, 760), color=(0, 0, 0), fill=(0.8, 0.8, 0.8))
    doc.save(path)


class Library:
    def __init__(self, root):
        self.root = Path(root)
        (self.root / "storage").mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / "zotero.sqlite")
        self.db.executescript(SCHEMA)
        self.db.execute("INSERT INTO version VALUES ('userdata', 120)")
        self.ids = {}
        self._clock = 0

    def _item(self, key):
        self._clock += 1
        cur = self.db.execute("INSERT INTO items (itemTypeID, dateAdded, key) VALUES (1, ?, ?)",
                              (f"2026-09-{self._clock:02d} 12:00:00", key))
        self.ids[key] = cur.lastrowid
        return cur.lastrowid

    def _field(self, iid, name, value):
        fid = self.db.execute("SELECT fieldID FROM fields WHERE fieldName=?", (name,)).fetchone()
        fid = fid[0] if fid else self.db.execute(
            "INSERT INTO fields (fieldName) VALUES (?)", (name,)).lastrowid
        vid = self.db.execute("SELECT valueID FROM itemDataValues WHERE value=?",
                              (value,)).fetchone()
        vid = vid[0] if vid else self.db.execute(
            "INSERT INTO itemDataValues (value) VALUES (?)", (value,)).lastrowid
        self.db.execute("INSERT INTO itemData VALUES (?, ?, ?)", (iid, fid, vid))

    def record(self, key, title=None, authors=(), date=None, container=None,
               container_field="publicationTitle", doi=None):
        iid = self._item(key)
        if title:
            self._field(iid, "title", title)
        if date:
            # Zotero's own multipart form: an SQL date, a space, then what was typed.
            self._field(iid, "date", f"{date}-00-00 {date}")
        if container:
            self._field(iid, container_field, container)
        if doi:
            self._field(iid, "DOI", doi)
        for i, last in enumerate(authors):
            cid = self.db.execute("INSERT INTO creators (firstName, lastName, fieldMode) "
                                  "VALUES ('', ?, 0)", (last,)).lastrowid
            self.db.execute("INSERT INTO itemCreators VALUES (?, ?, 1, ?)", (iid, cid, i))
        return key

    def attach(self, key, parent, filename, ctype, make=None, label=None):
        """A stored file. `make(path)` writes it; the default writes a line of text."""
        iid = self._item(key)
        self.db.execute("INSERT INTO itemAttachments VALUES (?, ?, 1, ?, ?)",
                        (iid, self.ids[parent] if parent else None, ctype,
                         f"storage:{filename}"))
        if label:
            self._field(iid, "title", label)
        f = self.root / "storage" / key / filename
        f.parent.mkdir(parents=True, exist_ok=True)
        if make:
            make(str(f))
        else:
            f.write_text("<p>the prophecy fulfils itself</p>\n", encoding="utf-8")
        return str(f)

    def trash(self, key):
        self.db.execute("INSERT INTO deletedItems VALUES (?, '2026-09-26')", (self.ids[key],))

    def close(self):
        self.db.commit()
        self.db.close()
