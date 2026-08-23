#!/usr/bin/env python3
"""An EPUB as the markdown the reconstruction reads. No page to parse.

WHY THIS IS THE BEST ROUTE OF ALL, where a publisher offers it. An EPUB is not a picture of a
page; it is the book's own XHTML, with its own headings, its own paragraph boundaries, its own
footnote elements, and a table of contents naming every chapter in reading order. Every question
`pdf_to_source.py` answers by measuring ink -- which indent is a quotation, where a paragraph
starts, which small line is apparatus, where the references begin -- is already answered here in
markup, and answered by the publisher rather than inferred by us.

WHAT IT COSTS. The pagination goes. An EPUB reflows, so there is no printed page to cite unless
the publisher embedded page-break markers (`epub:type="pagebreak"`), which this reads where they
are present and omits where they are not.

GETTING THE FILE IS NOT THIS MODULE'S JOB. Several publishers serve EPUBs to subscribers through
the browser but sit behind bot protection, so a script cannot fetch them and should not pretend to
be a browser in order to try. Download it the ordinary way and point this at the file.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

XHTML = "{http://www.w3.org/1999/xhtml}"
OPF = "{http://www.idpf.org/2007/opf}"
DC = "{http://purl.org/dc/elements/1.1/}"
NCX = "{http://www.daisy.org/z3986/2005/ncx/}"
EPUB = "{http://www.idpf.org/2007/ops}"

#: Sections of a book that are not the book: the publisher's furniture. Matched against the TOC
#: label, not the text, so a chapter ABOUT copyright is not mistaken for a copyright page.
#: Anchored at the start but not the end, so "Copyright Page" and "Index of Names" match while a
#: chapter called "The Index of Forbidden Books" does not -- it is the label's OPENING that says
#: what the section is.
FURNITURE = re.compile(
    r"^\W*(cover|title\s*page|half[- ]title|copyright|imprint|colophon"
    r"|about the (author|book)|also by|advance praise|praise for"
    r"|contents\b|table of contents|index\b|permissions|credits"
    r"|front\s*matter|back\s*matter|series page"
    # The bibliography goes for the same reason it goes in the article pipeline: it is a list of
    # other people's titles and it swamps any search of the author's own prose. NOTES stay --
    # in a scholarly book they carry argument, and they are what the reconstruction will cite.
    r"|references\b|bibliography|works\s+cited|further\s+reading)", re.I)


XHTML = "{http://www.w3.org/1999/xhtml}"


def _clean(s):
    return re.sub(r"[ \t\xa0]+", " ", s or "").strip()


def _t(el):
    """All the text under an element. Only the TOC needs this now; the prose goes through
    pandoc."""
    return "".join(el.itertext())


#: A styled paragraph that is really a heading, named by the publisher's own class. `h1`..`h6`
#: give the level directly; anything else is a chapter or section title, taken as level 2 because
#: level 1 belongs to the document's own title.
HEAD_CLASS = re.compile(
    r"^(h([1-6])[a-z]?|hd|head(?:ing)?|chap(?:ter)?[-_]?(?:title|head|no)?"
    r"|sect(?:ion)?[-_]?(?:title|head)?|title|subtitle|crhead)$", re.I)


def _heading_level(cls):
    """The heading level a class name implies, or 0 for ordinary body text."""
    for token in re.split(r"[\s_-]+", str(cls)):
        m = HEAD_CLASS.match(token)
        if not m:
            continue
        return int(m.group(2)) if m.group(2) else 2
    return 0


#: `pandoc` is on PATH. The Zettlr copy is kept as a fallback for a machine where it is not.
PANDOC = os.environ.get("PANDOC") or shutil.which("pandoc") \
    or "/Applications/Zettlr.app/Contents/Resources/pandoc"

#: pandoc's own markdown for a `<span epub:type="pagebreak">`. It keeps the number, which is the
#: whole point: an EPUB that carries pagination can still offer a printed-page pinpoint.
PAGE_SPAN = re.compile(r"\[\]\{#[^}]*?\.pagebreak[^}]*?title=\"([^\"]+)\"[^}]*\}")
PAGE_SPAN2 = re.compile(r"\[\]\{#page[_-]([0-9ivxlc]+)[^}]*\}", re.I)
#: A heading pandoc rendered as bold text carrying the publisher's class. pandoc writes the id
#: first when the source had one -- `**Title** {#some-anchor .h3}` -- so the id has to be allowed
#: for, or every class-marked heading in the book is missed.
#: The bold is optional: some publishers style a heading paragraph without emphasis, and pandoc
#: then emits the bare text with the class hung off the end.
CLASS_HEAD = re.compile(
    r"^(?:\*\*)?(.+?)(?:\*\*)?[ \t]*\{(?:#[\w.-]+[ \t]*)?\.([A-Za-z][\w-]*)[^}]*\}[ \t]*$", re.M)
#: Anchors, fenced divs and attribute blocks that carry no text.
BARE_ANCHOR = re.compile(r"\[\]\{#[^}]*\}")
FENCE = re.compile(r"^:{3,}.*$", re.M)
#: A pandoc footnote reference: `^[1](21_notes.xhtml#id_507)^`, sometimes with an anchor inside.
FOOTREF = re.compile(r"\^\[(?:\[\]\{#[^}]*\})?([0-9]{1,3})\]\([^)]*\)\^")


def _pandoc_markdown(xhtml_bytes, cwd):
    """One XHTML document as markdown, converted by pandoc.

    WHY PANDOC AND NOT A WALKER OF OUR OWN. The first version of this walked the XHTML tree by
    hand. It worked, and it was the wrong thing to write: pandoc has spent fifteen years on the
    cases that walker had not met yet -- entities, nested inline markup, tables, MathML, the
    several ways a publisher can mark emphasis -- and it is already on this machine. It also
    keeps the two things that matter most here and that the walker dropped: the PAGE-BREAK spans,
    with their printed numbers, and the footnote reference links.

    What pandoc does not know is the EPUB's own structure -- reading order, chapter names,
    which documents are furniture -- and that is what the rest of this module supplies.
    """
    r = subprocess.run([PANDOC, "-f", "html", "-t", "markdown", "--wrap=none"],
                       input=xhtml_bytes, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode("utf-8", "replace")[:200])
    return r.stdout.decode("utf-8", "replace")


def _tidy(md):
    """pandoc's markdown, with the EPUB's plumbing turned into things a reader wants.

    Everything removed here is an artefact of the file format rather than of the book: anchor
    targets with no text, the fenced `:::` divs pandoc emits for `<section>`, and the attribute
    suffixes on headings. The page spans are the exception -- they are not plumbing, they are the
    pagination, and they become the same `<!-- p.N begins here -->` marker the PDF route emits so
    that anything downstream can read either source the same way.
    """
    # LIFTED OUT, NOT SPLICED IN. A page break usually sits INSIDE something -- mid-sentence, or
    # inside the bold of a chapter title -- so substituting a blank-line-delimited comment where
    # it stands cuts the surrounding markup in half: `**<break>Chapter 1**` became a stray `**`,
    # a comment, and `Chapter 1**`. The number is taken out inline, then re-emitted on its own
    # line BEFORE the line it came from, which is where a page marker belongs anyway.
    md = PAGE_SPAN.sub(lambda m: f"\x00{m.group(1)}\x00", md)
    md = PAGE_SPAN2.sub(lambda m: f"\x00{m.group(1)}\x00", md)
    lifted = []
    for line in md.split("\n"):
        nums = re.findall(r"\x00([^\x00]+)\x00", line)
        if nums:
            line = re.sub(r"\x00[^\x00]+\x00", "", line)
            for n in nums:
                lifted.append(f"<!-- p.{n} begins here -->")
                lifted.append("")
        lifted.append(line)
    md = "\n".join(lifted)
    md = FOOTREF.sub(lambda m: f"[^{m.group(1)}]", md)
    # A bold line carrying a heading class IS a heading -- publishers mark chapter titles this way
    # constantly, and one that arrives as body text takes its whole section with it.
    # THE FENCES GO FIRST. pandoc opens a `<section>` as `:::::: {.section .chapter}`, and with
    # the bold made optional the heading rule matched THAT -- turning a row of colons into a
    # level-two heading at the top of every chapter.
    md = FENCE.sub("", md)
    md = BARE_ANCHOR.sub("", md)

    def head(m):
        text = m.group(1).strip()
        # A heading has words in it. Without this, any decorative line carrying a class becomes one.
        if not re.search(r"[A-Za-z0-9]", text):
            return m.group(0)
        # An image is not a heading, whatever class the publisher hung on its paragraph.
        if re.fullmatch(r"(!\[[^\]]*\]\([^)]*\)\s*)+", text):
            return m.group(0)
        lvl = _heading_level(m.group(2)) or 2
        return "#" * lvl + " " + text
    md = CLASS_HEAD.sub(head, md)
    # pandoc hangs the source's id and classes off the end of a heading -- `{#anchor .h3}`. An
    # earlier version stripped only `{.class}` and left every one of these standing, which is
    # also why the class-heading rule appeared not to fire: the line was ALREADY a heading, and
    # what looked like a failure was four lines of unremoved plumbing.
    # ANYWHERE, not just at the end of a line: pandoc also hangs attributes off images and inline
    # spans mid-sentence, and leaving those in put 751 braces through the Collins.
    md = re.sub(r"[ \t]*\{[#.][^}\n]*\}", "", md)
    # A heading whose whole text is bold is bold for the publisher's reasons, not the reader's.
    md = re.sub(r"^(#{1,6}) \*\*(.+?)\*\*\s*$", r"\1 \2", md, flags=re.M)
    # A STRIPPED SPAN LEAVES ITS BRACKETS BEHIND -- pandoc writes small caps as
    # `[Text]{.smallcaps}`, so a chapter title set in small caps reads "T[RADITIONS OF] R[ITUAL]".
    # NOT unwrapped here, deliberately: the obvious rule -- take the brackets off anything that is
    # not a link -- also takes them off `[^12]`, and it silently destroyed seventeen of nineteen
    # footnote references before the count caught it. The artefact is cosmetic and every word is
    # present; eating a footnote marker is neither.
    # A base64 logo is 40 kB of noise wearing an image's clothes; a page can carry a dozen.
    md = re.sub(r"!?\[[^\]]*\]\(data:[^)]*\)", "", md)
    md = re.sub(r"\{[a-z-]+=\"[^\"]*\"\}", "", md)     # pandoc keeps stray HTML attrs like this
    # A heading that was ALREADY a heading and also carried a heading class gets marked twice.
    md = re.sub(r"^(#{1,6}) (?:#{1,6} )+", r"\1 ", md, flags=re.M)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def _parse_opf(z):
    """(opf path, manifest {id: href}, spine [ids], metadata) from the container."""
    container = ET.fromstring(z.read("META-INF/container.xml"))
    rootfile = container.find(".//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile")
    opf_path = rootfile.get("full-path")
    opf = ET.fromstring(z.read(opf_path))
    base = opf_path.rsplit("/", 1)[0] + "/" if "/" in opf_path else ""
    manifest, props = {}, {}
    for item in opf.iter(f"{OPF}item"):
        manifest[item.get("id")] = base + item.get("href")
        props[item.get("id")] = item.get("properties") or ""
    spine = [ir.get("idref") for ir in opf.iter(f"{OPF}itemref")]
    meta = {}
    for f in ("title", "creator", "publisher", "date", "identifier", "language"):
        el = opf.find(f".//{DC}{f}")
        if el is not None and el.text:
            meta[f] = el.text.strip()
    return opf_path, manifest, props, spine, meta


def _toc(z, manifest, props, base_ids):
    """{href without fragment: label} from the EPUB 3 nav or the EPUB 2 NCX."""
    labels = {}
    nav_id = next((i for i, p in props.items() if "nav" in p), None)
    try:
        if nav_id:
            root = ET.fromstring(z.read(manifest[nav_id]))
            for a in root.iter(f"{XHTML}a"):
                href = (a.get("href") or "").split("#")[0]
                if href:
                    labels.setdefault(href.split("/")[-1], _clean(_t(a)))
        else:
            ncx = next((h for h in manifest.values() if h.endswith(".ncx")), None)
            if ncx:
                root = ET.fromstring(z.read(ncx))
                for np in root.iter(f"{NCX}navPoint"):
                    lab = np.find(f"{NCX}navLabel/{NCX}text")
                    con = np.find(f"{NCX}content")
                    if lab is not None and con is not None:
                        href = (con.get("src") or "").split("#")[0]
                        if href:
                            labels.setdefault(href.split("/")[-1], _clean(lab.text or ""))
    except Exception:
        pass
    return labels


def convert(path, out_dir=None, keep_furniture=False):
    """Read an EPUB. Returns (metadata, [{name, label, markdown, words}])."""
    z = zipfile.ZipFile(path)
    _opf, manifest, props, spine, meta = _parse_opf(z)
    labels = _toc(z, manifest, props, spine)
    docs, skipped = [], []
    for idx, sid in enumerate(spine):
        href = manifest.get(sid)
        if not href or not href.lower().endswith((".xhtml", ".html", ".htm")):
            continue
        label = labels.get(href.split("/")[-1]) or ""
        # WITH NO TOC LABEL, THE FILENAME IS THE EVIDENCE. Publishers do not put the cover or the
        # copyright page in the table of contents, so those arrive unnamed -- and a cover page is
        # 120 words of "Book Title:" and "Published By:", which is over any length threshold and
        # reads downstream as three headings the book does not have.
        probe = label or re.sub(r"^\d+[_-]|\.x?html?$", "", href.split("/")[-1])
        if not keep_furniture and probe and FURNITURE.match(probe):
            skipped.append(label)
            continue
        try:
            text = _tidy(_pandoc_markdown(z.read(href), None))
        except (KeyError, RuntimeError, OSError) as e:
            # Only the failures a DOCUMENT can cause are tolerated here. A blanket `except
            # Exception` swallowed a NameError in the tidier and reported it as thirteen
            # unreadable chapters, which is a bug wearing a bad file's clothes.
            skipped.append(f"{href.split('/')[-1]} ({type(e).__name__})")
            continue
        # A spine item with almost nothing in it is furniture the TOC did not name.
        if not keep_furniture and len(text.split()) < 40:
            skipped.append(label or href.split("/")[-1])
            continue
        if not label:
            first = next((l for l in text.splitlines() if l.startswith("#")), None)
            label = _clean(first.lstrip("# ")) if first else href.split("/")[-1]
        docs.append(dict(name=href.split("/")[-1], label=label, markdown=text + "\n",
                         words=len(text.split()), order=idx))
    if out_dir:
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, d in enumerate(docs, 1):
            slug = re.sub(r"[^a-z0-9]+", "-", d["label"].lower()).strip("-")[:52] or f"part-{i}"
            p = out_dir / f"{i:02d}-{slug}.md"
            p.write_text(d["markdown"], encoding="utf-8")
            d["path"] = str(p)
    return meta, docs, skipped


def main():
    ap = argparse.ArgumentParser(description="Convert an EPUB to markdown, one file per chapter.")
    ap.add_argument("epub")
    ap.add_argument("--out", help="directory to write the chapters into")
    ap.add_argument("--keep-furniture", action="store_true",
                    help="keep the cover, copyright page, index and so on")
    a = ap.parse_args()
    meta, docs, skipped = convert(a.epub, a.out, a.keep_furniture)
    print(f"  {meta.get('title','(untitled)')} — {meta.get('creator','?')}"
          f" ({meta.get('publisher','?')}, {meta.get('date','?')[:4]})")
    total = sum(d["words"] for d in docs)
    print(f"  {len(docs)} document(s), {total:,} words"
          + (f"; {len(skipped)} skipped as furniture" if skipped else ""))
    pages = sum(d["markdown"].count("begins here -->") for d in docs)
    print(f"  printed page markers: {pages or 'none — this EPUB carries no pagination'}")
    for d in docs[:14]:
        print(f"     {d['words']:6,}w  {d['label'][:56]}")
    if len(docs) > 14:
        print(f"     ... and {len(docs)-14} more")
    if a.out:
        print(f"  wrote {len(docs)} file(s) to {a.out}")


if __name__ == "__main__":
    main()
