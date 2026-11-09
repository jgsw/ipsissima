#!/usr/bin/env python3
"""A TEI book as the markdown a reconstruction reads. The publisher's own structure, again.

WHY THIS EXISTS AND PANDOC DOES NOT DO IT. `ingest.py` sends `.docx`, `.odt`, `.epub`, `.html`,
`.rtf` and `.tex` to pandoc, which is the right answer for all six. It cannot send TEI: pandoc
3.10 writes TEI and does not read it (`pandoc --list-input-formats` offers `docbook`, `jats` and
`endnotexml`, and no `tei`). So a TEI book had no route at all, and the only way in was the PDF —
which is the inversion `structured_source.py` exists to complain about: recovering from ink what
the publisher already had in markup.

Open Book Publishers ship TEI for every title, under CC-BY, and they are one of the few places a
whole philosophy book is openly licensed. That is worth a reader.

WHAT TEI GIVES, and it is the good case: `div` nests to make sections, `head` names each one, `p`
is a paragraph the publisher declared rather than one we inferred from an indent, `note` is a
footnote with its own number, `quote` is a block quotation, and `hi rendition="simple:italic"` is
emphasis. Every question `pdf_to_source.py` answers by measuring is answered here in markup.

WHAT IT COSTS. The pagination, as with an EPUB. TEI can carry `<pb n="…"/>` page beginnings and
this reads them where they are present, but a book typeset from XML often has none.

    python3 tei_to_source.py BOOK.zip --out DIR
    python3 tei_to_source.py chapter.xml --out DIR
"""
from __future__ import annotations

import argparse
import os
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

TEI = "{http://www.tei-c.org/ns/1.0}"

#: Files in an OBP-style bundle that are not the book. Matched on the STEM, so `ch1.xml` and
#: `chapter-3.xml` are never caught by accident. `entire-book.xml` is excluded because it is the
#: same text again -- reading both would double every word in the corpus.
FURNITURE = {"contents", "index", "copyright", "dedication", "title", "bibliography",
             "acknowledgements", "acknowledgments", "entire-book", "cover", "halftitle"}


def _tag(e):
    return e.tag.replace(TEI, "") if isinstance(e.tag, str) else ""


def _text(e, notes):
    """One element's inline text, as markdown. Recurses; collects footnotes as it goes."""
    out = []
    if e.text:
        out.append(e.text)
    for child in e:
        t = _tag(child)
        if t == "note":
            # A FOOTNOTE IS NOT INLINE PROSE. Left in place it welds the note's text into the
            # middle of the sentence that carries the marker, which is how a quotation comes to
            # contain a citation and then fails to verify against anything.
            n = child.get("n") or str(len(notes) + 1)
            notes.append((n, " ".join(_text(child, []).split())))
            out.append(f"[^{n}]")
        elif t == "hi":
            inner = _text(child, notes).strip()
            rend = (child.get("rendition") or child.get("rend") or "")
            if inner:
                out.append(f"**{inner}**" if "bold" in rend else f"*{inner}*")
        elif t == "ref":
            inner = _text(child, notes)
            target = child.get("target") or ""
            # Internal anchors point at the bundle's own files and mean nothing outside it, so
            # the text is kept and the link dropped. A real URL is kept as a link.
            out.append(f"[{inner}]({target})" if target.startswith("http") else inner)
        elif t in ("anchor", "graphic", "figure", "label", "byline", "pb"):
            pass                                     # invisible, or handled by the caller
        else:
            out.append(_text(child, notes))
        if child.tail:
            out.append(child.tail)
    return "".join(out)


def _table(el, notes):
    rows = []
    for r in el.iter(f"{TEI}row"):
        rows.append([" ".join(_text(c, notes).split()) for c in r.iter(f"{TEI}cell")])
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    head, body = rows[0], rows[1:]
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * width]
    out += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(out)


def convert_one(root, depth=0):
    """One TEI `body` as markdown, plus its footnote definitions."""
    notes, out = [], []

    def walk(el, level):
        for child in el:
            t = _tag(child)
            if t == "div":
                walk(child, level + 1)
            elif t == "head":
                text = " ".join(_text(child, notes).split())
                if text:
                    out.append("#" * min(level, 6) + " " + text)
            elif t == "p":
                text = " ".join(_text(child, notes).split())
                if text:
                    out.append(text)
            elif t == "quote":
                text = " ".join(_text(child, notes).split())
                if text:
                    out.append("> " + text)
            elif t == "table":
                tb = _table(child, notes)
                if tb:
                    out.append(tb)
            elif t == "pb":
                n = child.get("n")
                if n:
                    out.append(f"<!-- p.{n} begins here -->")
            elif t in ("anchor", "graphic", "figure", "byline", "label", "bibl"):
                continue
            else:
                walk(child, level)

    # DEPTH 0, so the first `div` inside the body lands its `head` at `#`. Each chapter is its
    # own file, so its title is that file's level-one heading -- and `split_manuscript.py` looks
    # for `#` by default, so starting at `##` would hand it a book with no chapters in it.
    walk(root, depth)
    if notes:
        out.append("")
        out += [f"[^{n}]: {text}" for n, text in notes]
    return "\n\n".join(out).strip() + "\n", len(notes)


def documents(path):
    """(name, body element) for each chapter, from a .zip bundle or a single .xml."""
    path = Path(path)
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            names = [n for n in sorted(z.namelist())
                     if n.lower().endswith(".xml") and "/" not in n
                     and Path(n).stem.lower() not in FURNITURE]
            for n in names:
                root = ET.fromstring(z.read(n))
                body = root.find(f".//{TEI}body")
                if body is not None:
                    yield Path(n).stem, body
    else:
        root = ET.parse(path).getroot()
        body = root.find(f".//{TEI}body")
        if body is not None:
            yield path.stem, body


def main():
    ap = argparse.ArgumentParser(description="Convert a TEI book to markdown, one file per chapter.")
    ap.add_argument("book", help="a .zip of TEI chapters, or a single .xml")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    out_dir = Path(a.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    written, total_words, total_notes = [], 0, 0
    for i, (name, body) in enumerate(documents(a.book), 1):
        text, n_notes = convert_one(body)
        words = len(text.split())
        if words < 40:
            print(f"   skipped {name}: {words} words")
            continue
        # The first `#` heading names the chapter; fall back to the file's own stem.
        head = re.search(r"^#+\s+(.*)$", text, re.M)
        title = head.group(1) if head else name
        fn = f"{i:02d}-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50] + ".md"
        (out_dir / fn).write_text(text, encoding="utf-8")
        written.append((fn, words, n_notes, title))
        total_words += words
        total_notes += n_notes

    print(f"\n  {len(written)} chapter(s), {total_words:,} words, {total_notes} footnote(s)")
    for fn, words, n, title in written:
        print(f"     {words:>7,}w  {n:>3} notes  {title[:56]}")
    marks = sum((out_dir / fn).read_text(encoding="utf-8").count("<!-- p.") for fn, *_ in written)
    print(f"  printed page markers: {marks or 'none — this TEI carries no <pb/>'}")
    print(f"  wrote {len(written)} file(s) to {out_dir}")


if __name__ == "__main__":
    main()
