#!/usr/bin/env python3
"""Turn a document into a source file the reconstruction tooling can use.

    python3 -m ipsissima_mcp.ingest FILE [FILE ...] --out DIR
    python3 ingest.py paper.pdf --out "Papers/My paper" [--title "..."] [--dry-run]

ONE FILE IS THE COMMON CASE and needs nothing else: no project file, no configuration. Give it a
path and it writes `DIR/source/<slug>.md`. Several inputs additionally get an
`argdown-project.yml` recording the reading order, which is the one thing several files have and
one file does not.

WHAT IT WILL NOT DO. It does not insert headings. A converted source is what the document
contains and nothing more -- a reader cannot otherwise tell the work's own structure from the
converter's guess at it, and `section` metadata is optional precisely so this can be true. Where
pymupdf4llm detects a heading from the typography it is kept, because that is a reading of the
page rather than an invention; where a document has none, the file has none.

EVERY CHOICE IS REPORTED. The house rule throughout this toolchain is that a converter which
mis-handles something quietly is worse than one that says what it did. So the run prints what it
routed where, what it cut, and what it could not do.

FORMAT ROUTING, and the reasons are measured -- see `eval/CONVERTER-FINDINGS.md` and
`eval/FORMAT-FINDINGS.md`:

  .pdf                     pymupdf4llm + rapidocr. Best of everything tested on the labelled
                           repair set (5/8 against marker's 2/8), two orders of magnitude
                           cheaper, and it escalates to OCR by itself on a damaged scan.
  .docx .odt .epub .html   pandoc, ALWAYS `--wrap=none`. At the default 72-column wrap a
                           171,000-word book yielded ONE line long enough for the paragraph
                           locator to score. Same words, same headings, unusable.
  .md .markdown .txt       copied through untouched.

THREE THINGS THAT BITE, all silent, all handled here:

  * `rapidocr` MUST be installed. Without an OCR backend, pymupdf4llm returns the cover page of
    a scanned paper and nothing else -- 345 words of a 1,220-word article, no error, a
    well-formed file. That was measured on this machine and written up as a failure of the
    library before the cause was found.
  * TRACKED CHANGES. pandoc defaults to `--track-changes=accept`. On a real document that is
    2,466 words against 2,482 rejecting and 2,849 showing all -- three documents from one file.
    Ingest REFUSES a .docx carrying unresolved changes rather than silently picking a side.
  * BACK MATTER stays in the file on disk and is trimmed only for the prompt. Cutting it from
    the file would be the one operation here that loses text, and because references sit at the
    end, keeping them costs nothing and keeps every line number stable.
"""
import argparse
import os
import re
import subprocess
import sys
import zipfile

PANDOC_CANDIDATES = (
    os.environ.get("PYPANDOC_PANDOC") or "",
    "/Applications/Zettlr.app/Contents/Resources/pandoc",
    "pandoc",
)
PANDOC_FORMATS = {".docx": "docx", ".odt": "odt", ".epub": "epub",
                  ".html": "html", ".htm": "html", ".rtf": "rtf", ".tex": "latex"}
PASSTHROUGH = {".md", ".markdown", ".txt"}
BACK_MATTER = re.compile(
    r"(?im)^#{1,3}\s*(references|bibliography|works\s+cited|notes\s+and\s+references|"
    r"acknowledge?ments|funding|declaration|competing\s+interests|"
    r"credit\s+authorship|appendix)\b")
# A heading pandoc or pymupdf4llm wrapped in emphasis: `### **2. Hume and abstraction**`.
# `heading_index()` captures the asterisks, so `section:` matching fails until they go.
EMPHASISED = re.compile(r"^(#{1,6}\s+)[*_]{1,3}(.+?)[*_]{1,3}\s*$")


def pandoc():
    for c in PANDOC_CANDIDATES:
        if c and (os.path.isabs(c) and os.path.exists(c)
                  or not os.path.isabs(c) and _which(c)):
            return c
    return None


def _which(name):
    for d in os.environ.get("PATH", "").split(os.pathsep):
        if os.path.exists(os.path.join(d, name)):
            return True
    return False


def slug(text, limit=64):
    s = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_]+", "-", s).strip("-")[:limit].rstrip("-") or "source"


def tidy_headings(md):
    """Unwrap emphasis around heading text. Returns (text, count)."""
    out, n = [], 0
    for line in md.splitlines():
        mo = EMPHASISED.match(line)
        if mo:
            out.append(mo.group(1) + mo.group(2).strip())
            n += 1
        else:
            out.append(line)
    return "\n".join(out), n


def tracked_changes(path):
    """Insertions and deletions in a .docx, which pandoc would silently accept."""
    try:
        doc = zipfile.ZipFile(path).read("word/document.xml").decode("utf8", "replace")
    except Exception:
        return 0, 0
    return doc.count("<w:ins "), doc.count("<w:del ")


# Runs of three or more single-letter non-words, LOWERCASE and not separated by full stops.
# Both exclusions are there because both fired: `J.J.C.` (Smart's initials in a bibliography)
# and `W. S. F.` are initials, and `B E R` is a letterspaced running head. None is OCR damage,
# and on this paper the initials alone triggered a 28-page re-OCR that gained three words.
# Genuine letter-soup is lowercase and space-separated -- `t e t t s`, `e a s bulando`.
SOUP = re.compile(r"(?:\b[b-hj-np-z]\b[ \t]{1,3}){3,}")


def quality(text):
    """Higher is better: words recovered, less a heavy penalty for letter-soup."""
    flat = re.sub(r"\s+", " ", text)
    return len(flat.split()) - 60 * len(SOUP.findall(flat))


def plain_text(path):
    """The PDF's own text layer, reflowed into paragraphs, with the page-marker convention.

    BLOCKS, NOT LINES. A PDF text layer breaks at every PRINTED line, so `get_text()` returns a
    file in which no line is long enough for the paragraph locator to score: on the Carroll,
    1,428 correct words and **zero** locatable positions. `get_text("blocks")` groups lines into
    the paragraphs they came from -- same words, 29 positions. The locator's finest unit is the
    line, so this decides how precisely any claim in this source can ever be placed, and it
    cannot be retro-fitted without redoing the reconstruction.
    """
    import fitz
    from pdf_to_source import join_spans
    out = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, 1):
            out.append(f"<!-- p.{i} begins here -->")
            # READ AS `dict` AND GROUPED BY BLOCK, which gives the same paragraphs `blocks` gives
            # while keeping the SPANS. A footnote marker is only recognisable as a span set
            # smaller than the body of its own line, and `get_text("blocks")` has already
            # flattened that away -- so the markers were being lost here for the sake of an API
            # that was otherwise equivalent. The grouping, which the note above says decides how
            # precisely any claim in this source can be placed, is unchanged.
            for block in page.get_text("dict").get("blocks", []):
                parts = []
                for l in block.get("lines", []):
                    spans = l.get("spans", [])
                    if spans:
                        parts.append(join_spans(spans))
                text = " ".join(" ".join(parts).split())
                if text:
                    out.append(text)
    return "\n\n".join(out)


def from_pdf(path, allow_ocr=True):
    """The text layer first; OCR only if the text layer is bad, and only if it beats it.

    THIS IS NOT WHAT THE FIRST VERSION DID, and the correction matters. pymupdf4llm was chosen
    on measurement -- best of everything tried on the Gettier's labelled repairs -- and it was
    then made the unconditional route on the strength of "it escalates to OCR by itself".

    It does escalate by itself. It also escalates when it should not. On Carroll's "What the
    Tortoise Said to Achilles" it OCRed all three pages of a document whose text layer was
    CLEAN, and rapidocr's output replaced good text with letter-soup: 1,428 clean words became
    1,222 words with six garbled passages, one of them in the middle of the paper's central
    exchange. Nothing reported it; the file looked fine.

    So the text layer goes first, because it is free and cannot invent anything. OCR is tried
    only when the layer looks damaged, and is used only if it scores better. There is no route
    that wins everywhere -- on the Gettier, whose layer really is damaged, pymupdf4llm recovers
    five of eight known errors and ocrmypdf two, while on the Carroll both make things worse.
    Every route tried is reported with its score so the choice is visible and reversible.
    """
    notes = []
    best_name, best = "text layer", plain_text(path)
    if quality(best) >= len(best.split()) and len(best.split()) > 200:
        notes.append(f"text layer clean ({len(best.split())} words); no OCR attempted")
        return best, notes

    notes.append(f"! text layer looks damaged "
                 f"({len(SOUP.findall(best))} garbled passage(s), {len(best.split())} words)")
    if not allow_ocr:
        notes.append("  --no-ocr given, keeping the text layer as it is")
        return best, notes

    tried = {"text layer": quality(best)}
    try:
        import rapidocr                                    # noqa: F401
        import pymupdf4llm
        cand = pymupdf4llm.to_markdown(path, show_progress=False)
        tried["pymupdf4llm+rapidocr"] = quality(cand)
        if quality(cand) > quality(best):
            best_name, best = "pymupdf4llm+rapidocr", cand
    except ImportError:
        notes.append("  ! rapidocr not installed, so that route was not tried")
    if _which("ocrmypdf"):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            out = os.path.join(td, "redo.pdf")
            r = subprocess.run(["ocrmypdf", "--redo-ocr", "--quiet", path, out],
                               capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(out):
                cand = plain_text(out)
                tried["ocrmypdf+text layer"] = quality(cand)
                if quality(cand) > quality(best):
                    best_name, best = "ocrmypdf+text layer", cand
    # ESCALATE ONLY FOR A REAL GAIN. Picking the maximum meant re-OCRing a 28-page article
    # because one route scored three words higher out of 11,728 -- a tie, bought with the risk
    # of new glyph errors, which ocrmypdf demonstrably introduces (`sufficient` -> `sufÏcient`
    # on the Gettier). Keep the text layer unless something beats it by a margin that matters.
    floor = quality(plain_text(path)) * 1.02
    if best_name != "text layer" and quality(best) < floor:
        notes.append(f"  {best_name} scored {quality(best)} against the text layer's "
                     f"{quality(plain_text(path))} -- too close to be worth re-OCRing")
        best_name, best = "text layer", plain_text(path)
    notes.append("  routes tried: "
                 + ", ".join(f"{k} {v}" for k, v in sorted(tried.items(), key=lambda x: -x[1])))
    notes.append(f"  chose {best_name}")
    return best, notes


def from_pandoc(path, ext):
    p = pandoc()
    if not p:
        raise SystemExit("pandoc not found. Set PYPANDOC_PANDOC, or install it.")
    notes = []
    if ext == ".docx":
        ins, dele = tracked_changes(path)
        if ins or dele:
            raise SystemExit(
                f"REFUSED: {os.path.basename(path)} carries {ins} tracked insertion(s) and "
                f"{dele} deletion(s).\n"
                "pandoc would silently ACCEPT them, committing to one side of every edit. "
                "Resolve them in Word\nfirst, or take a copy and accept/reject deliberately. "
                "This is refused rather than flagged because\nthe author-round protocol treats "
                "a tracked deletion as a decision, not as noise.")
    r = subprocess.run([p, "--to=markdown", "--wrap=none", "--track-changes=all",
                        path, "-o", "-"], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"pandoc failed on {os.path.basename(path)}: "
                         f"{(r.stderr or '').strip()[:200]}")
    notes.append(f"pandoc {ext[1:]} --wrap=none")
    return r.stdout, notes


def ingest_one(path, allow_ocr=True):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        md, notes = from_pdf(path, allow_ocr=allow_ocr)
    elif ext in PANDOC_FORMATS:
        md, notes = from_pandoc(path, ext)
    elif ext in PASSTHROUGH:
        md, notes = open(path, encoding="utf-8", errors="replace").read(), ["copied verbatim"]
    else:
        raise SystemExit(f"no route for {ext or 'a file with no extension'}: {path}")
    md, fixed = tidy_headings(md)
    if fixed:
        notes.append(f"{fixed} heading(s) unwrapped from emphasis")
    return md, notes


def extract_for_prompt(md):
    """The trimmed view for an extraction prompt, and what was cut.

    THE FILE ON DISK KEEPS EVERYTHING. This is a view, not an edit: back matter is dropped to
    save tokens, and because references sit at the end, nothing before them moves. Cutting the
    file itself would shift every line number after the cut and quietly invalidate provenance.
    """
    mo = BACK_MATTER.search(md)
    if not mo:
        return md, None
    cut = md[mo.start():]
    return md[:mo.start()].rstrip() + "\n", (mo.group(0).strip(), len(cut.split()))


def header(src, notes):
    lines = ["<!-- CONVERTED TEXT - NOT THE PUBLISHED DOCUMENT.",
             f"     Made by ingest.py from {os.path.basename(src)}.",
             "     No heading was inserted; any `#` below is the document's own, or was",
             "     detected from its typography. No wording is altered.",
             "     Back matter is kept here and trimmed only when text is sent to a model."]
    for n in notes:
        lines.append(f"     {n}")
    return "\n".join(lines) + " -->\n\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--title")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-ocr", action="store_true",
                    help="never OCR, even if the text layer looks damaged")
    a = ap.parse_args()

    results = []
    for path in a.inputs:
        if not os.path.exists(path):
            raise SystemExit(f"no such file: {path}")
        md, notes = ingest_one(path, allow_ocr=not a.no_ocr)
        name = slug(os.path.splitext(os.path.basename(path))[0]) + ".md"
        trimmed, cut = extract_for_prompt(md)
        results.append(dict(src=path, name=name, md=md, notes=notes,
                            words=len(md.split()), prompt_words=len(trimmed.split()), cut=cut))

    print(f"== ingest -> {a.out}")
    for r in results:
        print(f"\n   {os.path.basename(r['src'])[:62]}")
        print(f"      -> source/{r['name']}   {r['words']} words")
        for n in r["notes"]:
            print(f"      {n}")
        lines = [l for l in r["md"].splitlines() if len(l) >= 120]
        heads = len(re.findall(r"(?m)^#{1,6} ", r["md"]))
        print(f"      {heads} heading(s), {len(lines)} line(s) long enough to locate a claim")
        if r["cut"]:
            print(f"      prompt extract stops at {r['cut'][0]!r}, "
                  f"saving {r['cut'][1]} words ({r['prompt_words']} sent)")
        else:
            print(f"      no back matter found; the prompt gets all {r['prompt_words']} words")

    if a.dry_run:
        print("\n   --dry-run: nothing written")
        return

    src_dir = os.path.join(a.out, "source")
    os.makedirs(src_dir, exist_ok=True)
    for r in results:
        with open(os.path.join(src_dir, r["name"]), "w", encoding="utf-8") as fh:
            fh.write(header(r["src"], r["notes"]) + r["md"].rstrip() + "\n")

    if len(results) > 1:
        proj = os.path.join(a.out, "argdown-project.yml")
        if os.path.exists(proj):
            print(f"\n   kept the existing argdown-project.yml")
        else:
            title = a.title or os.path.basename(os.path.abspath(a.out))
            with open(proj, "w", encoding="utf-8") as fh:
                fh.write(f'title: "{title}"\n\n'
                         "# Reading order, in the order the files were given. Paths are relative\n"
                         "# to this file. Edit freely; a re-run will not overwrite it.\n"
                         "chapters:\n"
                         + "".join(f"  - source/{r['name']}\n" for r in results))
            print(f"\n   wrote argdown-project.yml ({len(results)} sources)")
    else:
        print("\n   one source: no project file needed, and none written")
    print(f"   wrote {len(results)} file(s) to {src_dir}")


if __name__ == "__main__":
    main()
