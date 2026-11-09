"""What the PDF tools do, apart from any server that offers them.

TWO SERVERS REGISTER THESE, and that is why they live here and not in either. Unpetrify's own
server offers them to anyone who wants text out of a document; Ipsissima's offers the same
functions under its own descriptions, as steps in making a map. One implementation means a fix to
how a scan is read reaches both, and neither can drift from the other.

Each function returns what its tool returns -- a dict, or a dict followed by images -- so a
server only has to name it. The descriptions a client sees are each server's business, not these
functions': Unpetrify's wording is in `unpetrify/server.py`, and Ipsissima writes its own.
"""
import json
import os
import re
from pathlib import Path
from typing import Any

from . import ingest


# ------------------------------------------------------- converting one file ---- #

def convert_one(path, allow_ocr=True, collate=None, witness=None):
    """Convert one source; returns the record both servers report and write from.

    Raises SystemExit where ingest refuses a file (a .docx carrying tracked changes) -- the
    caller decides whether that ends the run or is one failure among several.
    """
    extras = {}
    is_pdf = Path(path).suffix.lower() == ".pdf"
    md, notes = ingest.ingest_one(path, allow_ocr=allow_ocr, extras=extras,
                                  collate=collate if is_pdf else None,
                                  witness=str(Path(witness).expanduser())
                                  if witness and is_pdf else None)
    trimmed, cut = ingest.extract_for_prompt(md)
    pages = len(re.findall(r"<!-- .*?p\.\s*\d+ begins here -->", md))
    # SHEET NUMBERS, NOT FOLIOS. A PDF's markers count its sheets from 1; the printed page a
    # reader cites can start anywhere (a JSTOR cover makes sheet 2 into p. 121). The first
    # run to hit this hand-derived every pinpoint from page images without being told to.
    if pages and is_pdf:
        # NO COMMENT MARKS IN A NOTE: a note copied into a source's header comment closed it
        # at the `-->`, and the census read the rest of the header as the author's text
        # (Lenton gap test, 27 Sep 2026).
        notes.append("the page markers (p.N begins here) number the PDF's sheets; the printed page a "
                     "reader cites can differ (covers, front matter). Check one page "
                     "before writing pinpoint: values")
    return dict(
        src=path, name=ingest.slug(Path(path).stem) + ".md", md=md, notes=notes, extras=extras,
        words=len(md.split()), prompt_words=len(trimmed.split()),
        headings=len(re.findall(r"(?m)^#{1,6} ", md)),
        locatable_lines=sum(1 for l in md.splitlines() if len(l) >= 120),
        pages=pages,
        back_matter_cut=(cut[0] if cut else None))


def write_one(r, dest_dir, geometry=True):
    """Write a `convert_one` record into `dest_dir`; returns the paths written.

    `geometry=False` leaves out the word-geometry sidecar: it is for an app placing highlights
    (Ipsissima's, into Zotero), and beside a plain conversion it is a file nobody asked for."""
    written = []
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = dest_dir / r["name"]
    fm = ingest.front_matter(r["src"], r["md"], r.get("extras"))
    if fm:
        r["notes"].append(ingest.front_matter_note(
            ingest.front_matter_keys(r["src"], r["md"], r.get("extras"))))
    hdr = ingest.header(r["src"], r["notes"])
    target.write_text(fm + hdr + r["md"].rstrip() + "\n", encoding="utf-8")
    written.append(str(target))
    if geometry and r.get("extras", {}).get("geometry"):
        side = dest_dir / (r["name"] + ".geometry.json")
        side.write_text(r["extras"]["geometry"], encoding="utf-8")
        written.append(str(side))
        r["notes"].append("word-geometry sidecar written beside the text -- it is "
                          "what lets a highlight made in the app land in Zotero at "
                          "exact rectangles")
    # Line numbers in the notes count the TEXT BODY; the written file opens with this
    # header. Left unsaid, a note's "line 73" was found at line 87 and read as wrong.
    head_lines = (fm + hdr).count(chr(10))
    if any(re.search(r"\bline\s+\d", n) for n in r["notes"]):
        r["notes"].append(f"(line numbers above count the text body; the written file "
                          f"opens with a {head_lines}-line header, so "
                          f"add {head_lines} when opening it)")
    return written


def reply_of(r):
    """A record as a tool reply: a head of the text, not the text.

    The Markdown is kept out of the reply -- a book-length source arriving in the conversation
    twice over is what that was always for -- but stripping it to nothing assumed the caller
    could open the file instead, and that holds only while the model and the server sit on the
    same disk. Six hundred characters is enough to see that the headings survived and the page
    markers are there, and nowhere near enough to work from. That asymmetry is the point: it
    diagnoses, it does not substitute.

    THE GEOMETRY STAYS ON DISK TOO. The word-geometry sidecar is for an app, not the model, and
    it is already written beside the text. Left in `extras` it rode back whole: 25 Sep 2026, a
    twelve-page bulletin came back as 235,414 characters and the Miller fixture as 396,684, past
    the client's result limit, so `next` never reached the model at all.
    """
    d = {k: v for k, v in r.items() if k != "md"}
    d["head"] = r["md"][:600]
    if "geometry" in d.get("extras", {}):
        d["extras"] = {k: v for k, v in d["extras"].items() if k != "geometry"}
    return d


def settle_first(results):
    """The instruction that comes before anything else, where a collation left disputes.

    A COLLATION THAT LEFT DISPUTES IS NOT FINISHED. They are few and small, and settled before
    anything quotes the text they sit in."""
    disputed = [(r["src"], r["extras"]["collation"]["disputes"]) for r in results
                if r.get("extras", {}).get("collation", {}).get("disputes")]
    return "".join(
        f"FIRST, {n} collation dispute(s) in {os.path.basename(src)}: call collation_disputes "
        f"on that PDF, read the lines it shows, and settle_disputes. " for src, n in disputed)


# ------------------------------------------------------------------- tools ---- #

def assess_pdf(path: str, check_open_access: bool = True) -> dict[str, Any]:
    """
    Args:
        path: the PDF.
        check_open_access: look the DOI up to see whether a structured version exists.
    """
    from . import ingest
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")

    import pymupdf
    from . import collate
    with pymupdf.open(str(p)) as doc:
        pages = doc.page_count
        meta = doc.metadata or {}
        head = "\n".join(doc[i].get_text() for i in range(min(3, pages)))
        scanned = sum(1 for page in doc if collate.is_scanned(page))

    layer = ingest.plain_text(str(p))
    words = len(layer.split())
    soup = len(ingest.SOUP.findall(re.sub(r"\s+", " ", layer)))
    per_page = words / max(pages, 1)

    # THE THRESHOLDS ARE THE ONES ingest ALREADY USES, not new ones. A second opinion about what
    # counts as a damaged text layer is a second implementation of the same rule, and this
    # project has paid for that before.
    if ingest.quality(layer) >= words and words > 200:
        difficulty, note = "easy", "the text layer is clean; no OCR will be attempted"
    elif per_page < ingest.IMAGE_ONLY_WORDS_PER_PAGE:
        difficulty, note = ("hard",
                            f"only {per_page:.0f} words a page came off the text layer — this is "
                            f"a scan, or an image-only PDF")
    else:
        difficulty, note = ("ocr",
                            f"{soup} garbled passage(s) in {words} words; conversion will try "
                            f"OCR and keep whichever route scores better")

    # ABSENCE IS NOT GARBLE, and the garble count cannot see it. A page-edge truncation loses
    # characters cleanly -- three printed lines merged, middles missing, every surviving word a
    # word -- and this tool reported `easy, 0 garbled` on exactly that file. The glued-header
    # pattern is the visible symptom; the fix is the page-image route, and the note says so.
    suspects = ingest.page_edge_suspects(layer)
    if suspects:
        note += (f"; BUT {len(suspects)} line(s) look like a page header glued to body text -- "
                 f"possible page-edge truncation (characters missing, nothing garbled). After "
                 f"extracting, render those page tops with page_images and repair_source what "
                 f"is lost")

    # Ligatures are damage the garble count cannot see either: every word containing one is a
    # real word, but a quotation typed with ordinary letters will fail against it. ingest
    # expands them at conversion, so the count here is a forecast, not a fault -- it keeps
    # "text layer clean" honest on a file where 67 spans would otherwise silently not match.
    ligatures = len(ingest.LIGATURES.findall(layer))
    if ligatures:
        note += (f"; {ligatures} typographic ligature(s) (fi, fl, ...) in the text layer -- "
                 f"extract_text will expand them to plain letters so quotations match")

    # A SCAN IS READ AGAIN WHERE IT CAN BE, whatever its layer looks like: an old layer is often
    # wrong without being garbled (the Gettier: `siftcient`, a half-line lost at the page edge,
    # and "easy, 0 garbled").
    can_collate = bool(scanned and collate.tesseract())
    if scanned:
        note += (f"; {scanned} of {pages} sheet(s) are page images -- extract_text will read "
                 f"them again and vote the readings against the layer (collation)"
                 if can_collate else
                 f"; {scanned} of {pages} sheet(s) are page images -- installing tesseract "
                 f"would let extract_text read them again and vote the readings against the "
                 f"layer")
    out = dict(ok=True, path=str(p), pages=pages, words_in_text_layer=words,
               words_per_page=round(per_page, 1), garbled_passages=soup,
               page_edge_suspects=len(suspects), ligatures=ligatures,
               scanned_pages=scanned, collation_available=can_collate,
               difficulty=difficulty, note=note,
               metadata={k: v for k, v in meta.items() if k in ("title", "author", "creator")})

    doi = None
    m = re.search(r"\b10\.\d{4,9}/[-._;()/:A-Za-z0-9]+\b", head)
    if m:
        doi = m.group(0).rstrip(".,;)")
        out["doi"] = doi
    if doi and check_open_access:
        out["machine_readable"] = _open_access_routes(doi)
        if out["machine_readable"].get("full_text_available"):
            out["note"] += (". A machine-readable version of this article exists — see "
                            "`machine_readable`. Prefer it: nothing has to be inferred from it.")
    out["next"] = {
        "easy": "call extract_text",
        "ocr": "call extract_text; read its notes to see which route won",
        "hard": "call page_images and transcribe the pages yourself, then repair_source",
    }[difficulty]
    if can_collate:
        out["next"] = ("call extract_text -- the scan will be read again and collated; then "
                       "settle what is left with collation_disputes and settle_disputes")
    return out


def _open_access_routes(doi):
    """Is this article available somewhere structured? Europe PMC first, then Unpaywall.

    WHY THIS IS WORTH A NETWORK CALL. A PDF is the worst input this toolchain takes and the one
    people reach for first, because it is what a publisher hands them. The same article, as
    JATS XML from Europe PMC or as the publisher's own HTML, needs no inference at all. One
    lookup can turn a bronze source into a gold one.
    """
    import urllib.parse
    import urllib.request
    found = dict(doi=doi, full_text_available=False, routes=[])
    try:
        q = urllib.parse.quote(f'DOI:"{doi}"')
        u = (f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}"
             f"&resultType=core&format=json")
        with urllib.request.urlopen(u, timeout=12) as fh:
            d = json.load(fh)
        for r in (d.get("resultList", {}).get("result") or [])[:1]:
            if r.get("hasTextMinedTerms") == "Y" or r.get("isOpenAccess") == "Y":
                pmcid = r.get("pmcid")
                if pmcid:
                    found["full_text_available"] = True
                    found["routes"].append(dict(
                        source="Europe PMC", format="JATS XML", id=pmcid,
                        url=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML",
                        note="structured full text; no inference needed"))
    except Exception as e:
        found["europe_pmc_error"] = str(e)[:120]
    return found


#: A crop this size or smaller rides back INSIDE the tool result as an image the model can see
#: directly. The measured p. 122 crop that repaired the Gettier truncation was 35 KB; a whole
#: page at 300 dpi is not a crop and stays a path. The gate is what keeps a twelve-page call
#: from flooding the client's context -- every inlined image is spent from it, which is the
#: point of inlining, and the reason not to inline everything.
INLINE_IMAGE_CAP = 200_000


def _page_images_dir(pdf: Path) -> Path:
    """Where page_images writes when no `out_dir` is given.

    NEVER INSIDE ZOTERO'S STORAGE. Beside the PDF is right for a working folder, but most PDFs
    this server reads are Zotero attachments, and "beside" was `storage/<KEY>/page-images/`:
    a folder Zotero did not make, inside a tree this package promises to leave untouched
    (Ipsissima's zotero_lookup is read-only for the same reason), syncing up with the
    attachment if file sync is on. Found on the Dewey *Logic* run, 17 Oct 2026. Those renders
    go to the temp folder instead.
    """
    key = zotero_storage_key(pdf)
    if key:
        import tempfile
        return Path(tempfile.gettempdir()) / "unpetrify-page-images" / key
    return pdf.parent / "page-images"


def zotero_storage_key(path) -> str | None:
    """The attachment key, where `path` sits inside Zotero's storage folder; else None.

    A storage folder is recognised by its shape -- an eight-character key folder under
    `storage/`, beside `zotero.sqlite` -- so it is caught wherever the data directory lives.
    Nothing here writes into that tree: not page images, not extracted text.
    """
    path = Path(path)
    key, storage = path.parent, path.parent.parent
    if (re.fullmatch(r"[A-Z0-9]{8}", key.name) and storage.name == "storage"
            and (storage.parent / "zotero.sqlite").exists()):
        return key.name
    return None


def default_out_dir(src) -> Path:
    """Where extracted text goes when nobody said: beside the source, as people expect --
    except inside Zotero's storage, which gets a temp folder named for the attachment."""
    src = Path(src).expanduser()
    key = zotero_storage_key(src)
    if key:
        import tempfile
        return Path(tempfile.gettempdir()) / "unpetrify-text" / key
    return src.parent


def page_images(path: str, pages: list[int], out_dir: str | None = None,
                dpi: int = 200, clip: list[float] | None = None) -> Any:
    """
    Args:
        path: the PDF.
        pages: 1-based page numbers. Keep this list short.
        out_dir: where to write the PNGs (default: alongside the PDF, in `page-images/` -- or the temp folder for a Zotero attachment, never its storage folder).
        dpi: render resolution. 200 is enough to read; 300 for small print.
        clip: [x0, y0, x1, y1] as fractions of the page, to crop rather than render it whole.
    """
    from mcp.server.mcpserver.utilities.types import Image
    import pymupdf
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")
    if len(pages) > 12:
        return dict(ok=False, error=f"{len(pages)} pages asked for. Render the damaged pages, "
                                    f"not the document — see the tool description.")
    target = Path(out_dir) if out_dir else _page_images_dir(p)
    target.mkdir(parents=True, exist_ok=True)
    written, inline = [], []
    with pymupdf.open(str(p)) as doc:
        for n in pages:
            if not 1 <= n <= doc.page_count:
                continue
            page = doc[n - 1]
            rect = page.rect
            box = None
            if clip and len(clip) == 4:
                box = pymupdf.Rect(rect.x0 + clip[0] * rect.width,
                                rect.y0 + clip[1] * rect.height,
                                rect.x0 + clip[2] * rect.width,
                                rect.y0 + clip[3] * rect.height)
            pix = page.get_pixmap(dpi=dpi, clip=box)
            f = target / f"{p.stem}-p{n:03d}.png"
            pix.save(str(f))
            size = f.stat().st_size
            inlined = size <= INLINE_IMAGE_CAP
            if inlined:
                inline.append(Image(path=str(f)))
            written.append(dict(page=n, file=str(f), width=pix.width, height=pix.height,
                                bytes=size, inlined=inlined))
    result = dict(ok=True, images=written,
                  next=("the image(s) follow in this result -- read them, then call "
                        "repair_source with the corrected text" if inline else
                        "read the files at `images`, then call repair_source with the "
                        "corrected text; a crop under 200 KB would have come back inline"))
    return [result, *inline] if inline else result


def repair_source(path: str, repairs: list[dict[str, Any]], dry_run: bool = False) -> dict[str, Any]:
    """
    Args:
        path: the extracted Markdown file.
        repairs: [{"find": "...", "replace": "...", "why": "..."}]
        dry_run: report what would change and write nothing.
    """
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")
    text = p.read_text(encoding="utf-8")
    applied, refused = [], []
    known_keys = {"find", "replace", "why", "note"}
    for r in repairs:
        find, repl = r.get("find", ""), r.get("replace", "")
        # `note` is accepted as a synonym for `why`, and any OTHER key is named rather than
        # dropped -- a run passed `note:` believing it was stored, and silence about unknown
        # keys is the same fault the checker's unknown-field finding exists to prevent.
        r = dict(r)
        if r.get("why") is None and r.get("note") is not None:
            r["why"] = r["note"]
        ignored = sorted(set(r) - known_keys)
        n = text.count(find)
        if not find:
            refused.append(dict(**r, why_refused="empty `find`"))
        elif n == 0:
            refused.append(dict(**r, why_refused="not found in the file"))
        elif n > 1:
            refused.append(dict(**r, why_refused=f"matches {n} times; make `find` unique"))
        else:
            text = text.replace(find, repl, 1)
            # The echo is display, not the edit: the full strings landed. Say so when cut,
            # because an unmarked truncation reads as a truncated REPAIR.
            applied.append(dict(find=find[:80] + ("…" if len(find) > 80 else ""),
                                replace=repl[:80] + ("…" if len(repl) > 80 else ""),
                                why=r.get("why"),
                                **({"ignored_keys": ignored} if ignored else {}),
                                lines_before=find.count("\n") + 1,
                                lines_after=repl.count("\n") + 1))
    if applied and not dry_run:
        p.write_text(text, encoding="utf-8")
    return dict(ok=not refused, applied=applied, refused=refused, dry_run=dry_run,
                wrote=str(p) if applied and not dry_run else None)


def _collation_cache(pdf: Path):
    from . import collate
    cache = collate.cache_dir(pdf)
    return collate, cache, collate.load_disputes(cache)


def collation_disputes(path: str, first: int = 1, count: int = 8,
                       kind: str | None = None) -> Any:
    """
    Args:
        path: the PDF that was extracted.
        first: the first dispute number to show (1-based).
        count: how many to show, at most 16.
        kind: "word" or "formula" to show only that kind; a formula dispute is symbols and lone letters, where neither reading may be right.
    """
    from mcp.server.mcpserver.utilities.types import Image
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")
    collate, cache, data = _collation_cache(p)
    if not data:
        return dict(ok=False, error="this PDF has not been through the collated route: call "
                                    "extract_text on it first (with collate=true for a scan "
                                    "whose layer looks clean)")
    open_ = [d for d in data["disputes"] if not d.get("settled")
             and (kind is None or d.get("kind", "word") == kind)]
    batch = [d for d in open_ if d["n"] >= first][:max(1, min(count, 16))]
    if not batch:
        return dict(ok=True, total=len(data["disputes"]), open=len(open_), disputes=[],
                    next="no open disputes from there on" + (
                        f"; the first open one is #{open_[0]['n']}" if open_ else ""))
    paths = collate.dispute_strips(p, batch, cache / "strips")
    inline = [Image(path=str(f)) for f in paths if f.stat().st_size <= INLINE_IMAGE_CAP]
    rest = [d for d in open_ if d["n"] > batch[-1]["n"]]
    result = dict(
        ok=True, total=len(data["disputes"]), open=len(open_),
        disputes=[dict(n=d["n"], sheet=d["sheet"], kind=d.get("kind", "word"),
                       readings=d["readings"], stands=d["text"],
                       before=d["before"], after=d["after"]) for d in batch],
        images=[str(f) for f in paths], inlined=len(inline) == len(paths),
        missing_pages=data["report"].get("missing_pages"),
        next=("read the boxed words in the image(s) and call settle_disputes with "
              "{n: \"A\"|\"B\"|\"C\"|the text the page prints}; an empty string deletes. "
              + (f"Then call this again with first={rest[0]['n']}"
                 + (f", kind={kind!r}" if kind else "") + f" ({len(rest)} more)."
                 if rest else "That is the last batch.")))
    return [result, *inline] if inline else result


def settle_disputes(markdown_path: str, pdf_path: str, decisions: dict[str, str],
                    dry_run: bool = False) -> dict[str, Any]:
    """
    Args:
        markdown_path: the extracted Markdown (in source/).
        pdf_path: the PDF it was extracted from.
        decisions: {dispute number: "A" | "B" | "C" | the printed text}.
        dry_run: report what would change and write nothing.
    """
    md_p, pdf_p = Path(markdown_path).expanduser(), Path(pdf_path).expanduser()
    for f in (md_p, pdf_p):
        if not f.exists():
            return dict(ok=False, error=f"no such file: {f}")
    collate, cache, data = _collation_cache(pdf_p)
    if not data:
        return dict(ok=False, error="no collation recorded for this PDF")
    md = md_p.read_text(encoding="utf-8")
    new, applied, refused, record = collate.settle(md, data["disputes"], decisions)
    if not dry_run:
        if new != md:
            md_p.write_text(new, encoding="utf-8")
        collate.record_decisions(cache, record)
        settled = {a["dispute"] for a in applied}
        for d in data["disputes"]:
            if d["n"] in settled:
                d["settled"] = record.get(d["id"], d["text"])
                d["text"] = d["settled"]
        collate._atomic_text(cache / "disputes.json",
                             json.dumps(data, indent=1, ensure_ascii=False))
    left = sum(1 for d in data["disputes"] if not d.get("settled"))
    return dict(ok=not refused, applied=applied, refused=refused, dry_run=dry_run,
                open=left, wrote=str(md_p) if new != md and not dry_run else None)


def add_page_numbers(markdown_path: str, pdf_path: str,
                     dry_run: bool = False) -> dict[str, Any]:
    """
    Args:
        markdown_path: the extracted Markdown to add markers to.
        pdf_path: the PDF of the same article, for its pagination.
        dry_run: report what would be placed and write nothing.
    """
    from . import paginate as pg
    md_p, pdf_p = Path(markdown_path).expanduser(), Path(pdf_path).expanduser()
    for f in (md_p, pdf_p):
        if not f.exists():
            return dict(ok=False, error=f"no such file: {f}")
    out, rep = pg.paginate(md_p.read_text(encoding="utf-8"), str(pdf_p))
    if not dry_run and rep["placed"]:
        md_p.write_text(out, encoding="utf-8")
    return dict(ok=True, dry_run=dry_run,
                pages_marked=len(rep["placed"]),
                first_page=rep["placed"][0] if rep["placed"] else None,
                last_page=rep["placed"][-1] if rep["placed"] else None,
                unplaced=rep["missed"], numbering_offset=rep["offset"],
                sheets=rep["sheets"], numbers_read=rep["printed_numbers"],
                disagreeing_sheets=rep["outliers"],
                wrote=str(md_p) if rep["placed"] and not dry_run else None,
                note=("markers land at the paragraph boundary nearest each page break: the "
                      "structured text has no page concept, so that is the finest resolution "
                      "there is"))
