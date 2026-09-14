#!/usr/bin/env python3
"""Store a reconstruction's artifacts in Zotero, beside the source they read.

    python3 -m ipsissima_mcp.zotero_store FILE.argdown [--export FILE.html] [--check]

THE FOLDER IS HOME; ZOTERO HOLDS COPIES THE MACHINERY KEEPS HONEST (E10, ruled 14 Sep). The
working pair -- the .argdown and the converted source it cites -- stays in the project
folder, where the checker, the app and git live. This module places copies of them (and, when
given, the exported one-file HTML) as stored attachments under the same Zotero item as the
source PDF, so the whole reading survives together, backed up and carried to the reader's
other devices by Zotero's own sync. Zotero already knows each stored file's md5, so staleness
is a measurement, not a guess: `--check` reports which copies are current, stale, or absent
and writes nothing; a plain run is the request that refreshes them ("flag, refresh on
request" -- nothing writes except on the reader's own invocation).

WHICH ITEM. The converted source's front matter carries `zotero: "KEY"` -- the attachment key
read off the storage path at conversion, never passed by hand -- and that attachment's parent
is the bibliographic item the copies belong under. A source with no key, or an attachment
with no parent, is said in a sentence, not guessed around.

THE COPIES ANNOUNCE THEMSELVES. Each attachment's filename is the working file's own, which
is also how an existing copy is recognised on a later run -- matched and refreshed, never
duplicated. The exported HTML opens fully in any real browser (right-click > Show File);
Zotero's built-in snapshot reader deliberately blocks scripts, so inside Zotero it shows only
the static shell -- a fact about Zotero's reader, recorded here so nobody debugs the export.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

try:
    from .zotero_local import ZoteroLocal
except ImportError:
    from zotero_local import ZoteroLocal

CONTENT_TYPES = {".argdown": "text/plain", ".md": "text/markdown", ".markdown": "text/markdown",
                 ".html": "text/html", ".htm": "text/html"}

CHAPTER = re.compile(r'chapter:\s*"([^"]+)"')
ZOTERO_KEY = re.compile(r'(?m)^zotero:\s*"?([A-Z0-9]{8})"?\s*$')


def md5_of(path):
    return hashlib.md5(Path(path).read_bytes()).hexdigest()


def chapters_of(argdown_path):
    """Every distinct chapter path the file cites, resolved against the argdown's folder --
    the same root the checker resolves against."""
    text = Path(argdown_path).read_text(encoding="utf-8")
    seen, out = set(), []
    for m in CHAPTER.finditer(text):
        if m.group(1) not in seen:
            seen.add(m.group(1))
            out.append((Path(argdown_path).parent / m.group(1)).resolve())
    return out


def zotero_key_of_source(path):
    """The `zotero:` key out of a converted source's front matter, or None."""
    try:
        head = Path(path).read_text(encoding="utf-8", errors="replace")[:2000]
    except OSError:
        return None
    m = ZOTERO_KEY.search(head)
    return m.group(1) if m else None


def plan(argdown_path, export=None, z=None):
    """What would be stored where, and what state each copy is in. Reads only."""
    z = z or ZoteroLocal()
    argdown_path = Path(argdown_path).resolve()
    if not argdown_path.exists():
        raise SystemExit(f"no such file: {argdown_path}")
    chapters = chapters_of(argdown_path)
    if not chapters:
        raise SystemExit("This map cites no chapter, so there is no source to say which "
                         "Zotero item the copies belong under. A survey or debate map has "
                         "no home item; nothing to store.")
    keyed = [(c, zotero_key_of_source(c)) for c in chapters]
    keys = {k for _c, k in keyed if k}
    if not keys:
        raise SystemExit(
            "No cited source declares a `zotero:` key in its front matter, so the Zotero "
            "item cannot be identified. A source converted from a PDF inside Zotero's "
            "storage carries the key automatically; for one converted from elsewhere, add "
            '`zotero: "KEY"` (the attachment key) to the source\'s front matter by hand.')
    if len(keys) > 1:
        raise SystemExit(f"The cited sources declare {len(keys)} different Zotero keys "
                         f"({', '.join(sorted(keys))}) -- a multi-item book is not yet "
                         f"supported by this tool; nothing was written.")
    att_key = keys.pop()
    att = z.item(att_key)
    if att is None:
        raise SystemExit(f"Zotero has no item with attachment key {att_key} -- the source's "
                         f"front matter may be from another machine's library.")
    parent_key = (att.get("data") or {}).get("parentItem")
    if not parent_key:
        raise SystemExit(f"Attachment {att_key} has no parent item to hang copies under -- "
                         f"it is a standalone attachment. File it under an item in Zotero "
                         f"first; nothing was written.")
    parent = z.item(parent_key)
    existing = {}
    for ch in z.children(parent_key):
        d = ch.get("data") or {}
        if d.get("itemType") == "attachment" and d.get("filename"):
            existing[d["filename"]] = d

    files = [argdown_path] + [c for c in chapters if c.exists()]
    missing_sources = [str(c) for c in chapters if not c.exists()]
    if export:
        export = Path(export).resolve()
        if not export.exists():
            raise SystemExit(f"no such export: {export}")
        files.append(export)

    rows = []
    for f in files:
        have = existing.get(f.name)
        if not have:
            state = "absent"
        elif have.get("md5") == md5_of(f):
            state = "current"
        else:
            state = "stale"
        rows.append({"path": f, "filename": f.name, "state": state,
                     "existing": have})
    title = ((parent or {}).get("data") or {}).get("title", "")
    return {"parent_key": parent_key, "parent_title": title, "rows": rows,
            "missing_sources": missing_sources, "z": z}


def store(argdown_path, export=None, check_only=False, z=None):
    """Place or refresh the copies. Returns report lines; writes nothing when check_only."""
    p = plan(argdown_path, export, z=z)
    z = p["z"]
    out = [f"Zotero item: {p['parent_title'][:70] or p['parent_key']} ({p['parent_key']})"]
    for s in p["missing_sources"]:
        out.append(f"  ! cited source not on disk, not stored: {s}")
    for row in p["rows"]:
        f, state, have = row["path"], row["state"], row["existing"]
        if state == "current":
            out.append(f"  current   {f.name} -- the copy in Zotero matches this file")
            continue
        if check_only:
            said = ("no copy in Zotero yet" if state == "absent"
                    else "the copy in Zotero is BEHIND this file")
            out.append(f"  {state:<9} {f.name} -- {said} (run without --check to refresh)")
            continue
        if state == "absent":
            ct = CONTENT_TYPES.get(f.suffix.lower(), "text/plain")
            made = z.create_items([{
                "itemType": "attachment", "linkMode": "imported_file",
                "parentItem": p["parent_key"], "title": f.name,
                "filename": f.name, "contentType": ct, "charset": "utf-8"}])
            new_key = ((made.get("success") or {}).get("0")
                       or ((made.get("successful") or {}).get("0") or {}).get("key"))
            if not new_key:
                raise SystemExit("Zotero accepted the attachment but did not name its key: "
                                 + str(made)[:200])
            z.upload_file(new_key, f)
            out.append(f"  stored    {f.name}")
        else:
            z.upload_file(have["key"], f, old_md5=have.get("md5"))
            out.append(f"  refreshed {f.name} -- the stale copy was replaced")
    if not check_only:
        out.append("The copies travel with Zotero's own sync from here; nothing else "
                   "was contacted.")
    return out


def main():
    ap = argparse.ArgumentParser(
        description="Store a reconstruction's files in Zotero beside their source.")
    ap.add_argument("argdown")
    ap.add_argument("--export", help="the exported one-file HTML to store as well")
    ap.add_argument("--check", action="store_true",
                    help="report which copies are current, stale or absent; write nothing")
    a = ap.parse_args()
    for line in store(a.argdown, a.export, check_only=a.check):
        print(line)


if __name__ == "__main__":
    main()
