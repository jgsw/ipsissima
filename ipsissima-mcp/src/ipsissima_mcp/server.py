#!/usr/bin/env python3
"""Ipsissima-MCP — the tools an assistant needs to turn a document into a reconstruction.

    ipsissima-mcp                 # stdio, which is what an MCP client launches

WHAT THIS SERVER DOES AND DOES NOT DO. It does not reconstruct arguments. The judgement that
turns a paper into a map belongs to the model on the other end of the connection, and the
instructions for it are served as PROMPTS — `docs/extraction-prompt.md`, loaded fresh every run,
so improving a reconstruction means editing prose rather than shipping a release.

What the server provides is everything mechanical around that judgement, and the mechanical half
is most of the cost:

  * working out WHAT WAS ASKED FOR before anything expensive starts (`plan_job`)
  * getting the text out of a PDF, .docx, .epub or HTML with its paragraphs intact
  * saying when a PDF is too damaged to convert mechanically, and handing back page crops
  * checking a finished reconstruction against the text it cites, in a form a fix loop can act on

THE ORDER MATTERS, and one tool enforces it. A reconstruction is the expensive step, and the two
requests "make a map of each article in this folder" and "make one map from the chapters in this
folder" are indistinguishable from the files alone. So `plan_job` returns QUESTIONS as data, and
`extract_text` refuses a multi-source run that has not answered them. Asking is not politeness
here; it is the difference between one reconstruction and six.

VOCABULARY. "Argdown map", "Ipsissima diagram", "argument map", "reconstruct the argument",
"map this paper" all name the same job. The server instructions say so, because users say all
five.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from mcp.server import MCPServer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]                      # the repository root
DOCS = HERE.parents[1] / "docs"             # ipsissima-mcp/docs

sys.path.insert(0, str(HERE))

INSTRUCTIONS = """\
Ipsissima-MCP turns documents into Argdown argument reconstructions that cite the text they are
readings of, and checks finished reconstructions against their sources.

WHAT USERS CALL THIS. "Make an Argdown", "make an Ipsissima diagram", "map the argument",
"reconstruct this paper", "make an argument map" are all the same request. Treat them as such.

THE ORDER OF WORK
  1. `plan_job` — always, before anything expensive. It reports what it found, which route each
     source will take, and what is genuinely ambiguous. If it returns `questions`, PUT THEM TO
     THE USER and do not guess: reconstructing the wrong text, or making one map where six were
     wanted, costs the user real money.
  2. `extract_text` — writes the structured Markdown a reconstruction can point at.
  3. Reconstruct. Use the `reconstruct_argument` prompt. This is your judgement, not a tool.
  4. `check_reconstruction` — repeatedly, until it reports ok. It returns faults with locations
     and fixes; apply the fixes, do not rewrite the map.

EXTRACTION ALONE IS A COMPLETE REQUEST. "Just get me the text" or "extract the markdown" stops
after step 2. Do not go on to reconstruct unless asked.

WHICH FILE TO ASK FOR. Markdown is gold, pandoc-readable formats (.docx, .odt, .html, .epub,
.tex) are silver, PDF is bronze — a PDF only records where ink sat, so paragraphs and headings
have to be inferred. If a user offers a PDF of a document they also have as .docx, say so and
ask for the .docx. `plan_job` detects this and reports it as advice.
"""

server = MCPServer(
    name="ipsissima",
    title="Ipsissima — argument reconstruction",
    version="0.1.0",
    instructions=INSTRUCTIONS,
)


# ------------------------------------------------------------------ helpers ---- #

def _argdown_cli():
    """The Argdown CLI, which is ground truth for whether a file is valid."""
    for cand in (ROOT / "app" / "node_modules" / ".bin" / "argdown",
                 Path.cwd() / "app" / "node_modules" / ".bin" / "argdown"):
        if cand.exists():
            return str(cand)
    from shutil import which
    return which("argdown")


def _run_check(path, source_root=None, fmt="json", extra=()):
    """Run check_argdown as a subprocess.

    A SUBPROCESS RATHER THAN AN IMPORT, deliberately. check_argdown owns a module-level findings
    list and prints as it goes; calling it twice in one process would accumulate the first run's
    faults into the second's report. A process boundary is the cheapest correct isolation, and
    the script is already the supported entry point for the viewer build.
    """
    cmd = [sys.executable, str(HERE / "check_argdown.py"), str(path), "--format", fmt, *extra]
    cli = _argdown_cli()
    if cli:
        cmd += ["--cli", cli]
    if source_root:
        cmd += ["--source-root", str(source_root)]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    return r


# ------------------------------------------------------------------- tools ---- #

@server.tool(
    structured_output=True,
    title="Plan the job",
    description=(
        "ALWAYS CALL THIS FIRST. Reads what the user pointed at — files, folders, or both — and "
        "reports every source found, which conversion route it will take, how big it is, and "
        "what is ambiguous about the request. Writes nothing and converts nothing.\n\n"
        "If the result has `questions`, ask the user those questions before going further. They "
        "are the things that cannot be inferred from the files: whether several sources are one "
        "work or several, and which of two drafts is the current one. `advice` reports a source "
        "available in a better format than the one offered."),
)
def plan_job(sources: list[str], intent: str = "reconstruct",
             out: str | None = None, recursive: bool = True) -> dict[str, Any]:
    """
    Args:
        sources: files and/or folders the user named.
        intent: "reconstruct" for a map, "extract" for the Markdown alone.
        out: where output should go. Proposed if omitted.
        recursive: walk subfolders of any folder given.
    """
    from ipsissima_mcp import sources as srcmod

    plan = srcmod.describe(sources, recursive=recursive)

    if plan["count"] == 0:
        plan["next"] = "nothing to do — no readable source was found"
        return plan

    # A DEFAULT THAT IS SAID OUT LOUD. Writing beside the source is what people expect; writing
    # somewhere clever is what they later cannot find.
    first = Path(plan["sources"][0]["path"])
    plan["proposed_out"] = str(out or (first.parent if plan["count"] > 1 else
                                       first.parent / first.stem))
    plan["layout"] = ("<out>/source/*.md for the extracted text; the .argdown beside it, so the "
                      "reconstruction and the text it cites open together")

    # ---- what it will cost ------------------------------------------------ #
    # AN ESTIMATE, LABELLED AS ONE. Words to tokens is about 4/3 for academic prose; a
    # reconstruction reads the source once and writes a map a fraction of its size, and the
    # check-and-fix rounds are small since check_reconstruction returns faults rather than
    # reports. Better than nothing and worse than measurement, which is what the range says.
    src_tokens = int(plan["total_words"] * 4 / 3)
    plan["estimate"] = dict(
        source_tokens=src_tokens,
        reconstruction_tokens=f"{int(src_tokens * 1.4):,}–{int(src_tokens * 2.6):,} per map",
        maps="1 (or one per source — unanswered)" if plan["questions"] else None,
        caveat="an estimate from word counts, not a measurement of this text")

    if intent == "extract":
        plan["questions"] = [q for q in plan["questions"] if q["id"] != "grouping"]

    plan["next"] = ("ask the user the questions above, then call extract_text with `grouping` set"
                    if plan["questions"] else "call extract_text")
    return plan


@server.tool(
    structured_output=True,
    title="Extract the text",
    description=(
        "Convert sources to the structured Markdown a reconstruction can cite, and write them "
        "to `<out>/source/`. PDFs keep their page numbers as `<!-- p.N begins here -->` "
        "comments, which is what lets Ipsissima's Manuscript view show page numbers.\n\n"
        "Call `plan_job` first. With more than one source this REFUSES to run until `grouping` "
        "is given, because 'one map from these chapters' and 'a map of each of these articles' "
        "are different jobs and choosing wrongly wastes a whole reconstruction."),
)
def extract_text(sources: list[str], out: str, grouping: str | None = None,
                 title: str | None = None, allow_ocr: bool = True,
                 dry_run: bool = False) -> dict[str, Any]:
    """
    Args:
        sources: the files to convert (resolved paths from plan_job).
        out: the folder to write into; `source/` is created inside it.
        grouping: "one-map" or "map-each". Required when there is more than one source.
        title: title for the project file, when one is written.
        allow_ocr: allow OCR when a PDF's text layer looks damaged.
        dry_run: report what would happen and write nothing.
    """
    from ipsissima_mcp import ingest, sources as srcmod

    files, unreadable, skipped = srcmod.resolve(sources)
    if not files:
        return dict(ok=False, error="no readable source in what was given",
                    unreadable=unreadable, skipped=skipped)

    # THE REFUSAL, and it is the point of the tool rather than an obstacle in it. See the module
    # docstring: this is where "ask before spending" stops being advice.
    if len(files) > 1 and grouping not in ("one-map", "map-each"):
        return dict(ok=False, needs_answer="grouping",
                    question=f"{len(files)} sources were given. One map covering all of them "
                             f"(\"one-map\"), or one map each (\"map-each\")?",
                    options=["one-map", "map-each"], sources=[os.path.basename(f) for f in files],
                    why="chapters of one work belong in one map; separate articles belong in "
                        "separate maps, and nothing in the files settles which this is")

    results, failures = [], []
    for p in files:
        try:
            md, notes = ingest.ingest_one(p, allow_ocr=allow_ocr)
        except SystemExit as e:                    # ingest refuses tracked changes this way
            failures.append(dict(path=p, refused=str(e)))
            continue
        trimmed, cut = ingest.extract_for_prompt(md)
        results.append(dict(
            src=p, name=ingest.slug(Path(p).stem) + ".md", md=md, notes=notes,
            words=len(md.split()), prompt_words=len(trimmed.split()),
            headings=len(re.findall(r"(?m)^#{1,6} ", md)),
            locatable_lines=sum(1 for l in md.splitlines() if len(l) >= 120),
            pages=len(re.findall(r"<!-- .*?p\.\s*\d+ begins here -->", md)),
            back_matter_cut=(cut[0] if cut else None)))

    written = []
    if not dry_run and results:
        src_dir = Path(out) / "source"
        src_dir.mkdir(parents=True, exist_ok=True)
        for r in results:
            target = src_dir / r["name"]
            target.write_text(ingest.header(r["src"], r["notes"]) + r["md"].rstrip() + "\n",
                              encoding="utf-8")
            written.append(str(target))
        if len(results) > 1 and grouping == "one-map":
            proj = Path(out) / "argdown-project.yml"
            if not proj.exists():
                proj.write_text(
                    f'title: "{title or Path(out).resolve().name}"\n\n'
                    "# Reading order, in the order the files were given. Paths are relative to\n"
                    "# this file. Edit freely; a re-run will not overwrite it.\n"
                    "chapters:\n"
                    + "".join(f"  - source/{r['name']}\n" for r in results), encoding="utf-8")
                written.append(str(proj))

    return dict(
        ok=True, dry_run=dry_run, grouping=grouping, out=str(out), written=written,
        sources=[{k: v for k, v in r.items() if k != "md"} for r in results],
        failures=failures, unreadable=unreadable, skipped=skipped,
        next=("nothing written (dry run)" if dry_run else
              "reconstruct with the `reconstruct_argument` prompt, then call "
              "check_reconstruction until it reports ok"))


@server.tool(
    structured_output=True,
    title="Assess a PDF",
    description=(
        "How hard will this PDF be to convert, and by which route? Reports whether the text "
        "layer is usable, how damaged it looks, whether OCR will be needed, and — where the PDF "
        "has a DOI — whether a machine-readable version of the same article exists that should "
        "be used instead.\n\n"
        "Returns `difficulty`: `easy` (convert it, nothing else needed), `ocr` (the text layer "
        "is damaged; conversion will try OCR and report what it chose), or `hard` (neither "
        "route produces usable text — call `page_images` and read the pages yourself)."),
)
def assess_pdf(path: str, check_open_access: bool = True) -> dict[str, Any]:
    """
    Args:
        path: the PDF.
        check_open_access: look the DOI up to see whether a structured version exists.
    """
    from ipsissima_mcp import ingest
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")

    import pymupdf
    with pymupdf.open(str(p)) as doc:
        pages = doc.page_count
        meta = doc.metadata or {}
        head = "\n".join(doc[i].get_text() for i in range(min(3, pages)))

    layer = ingest.plain_text(str(p))
    words = len(layer.split())
    soup = len(ingest.SOUP.findall(re.sub(r"\s+", " ", layer)))
    per_page = words / max(pages, 1)

    # THE THRESHOLDS ARE THE ONES ingest ALREADY USES, not new ones. A second opinion about what
    # counts as a damaged text layer is a second implementation of the same rule, and this
    # project has paid for that before.
    if ingest.quality(layer) >= words and words > 200:
        difficulty, note = "easy", "the text layer is clean; no OCR will be attempted"
    elif per_page < 40:
        difficulty, note = ("hard",
                            f"only {per_page:.0f} words a page came off the text layer — this is "
                            f"a scan, or an image-only PDF")
    else:
        difficulty, note = ("ocr",
                            f"{soup} garbled passage(s) in {words} words; conversion will try "
                            f"OCR and keep whichever route scores better")

    out = dict(ok=True, path=str(p), pages=pages, words_in_text_layer=words,
               words_per_page=round(per_page, 1), garbled_passages=soup,
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


@server.tool(
    structured_output=True,
    title="Page images",
    description=(
        "Render pages of a PDF as PNG files so they can be read directly. For the `hard` case "
        "only — a scan whose text layer and OCR both fail.\n\n"
        "CROPS, NOT WHOLE PAGES, wherever you can manage it: proofreading five whole pages to "
        "check three damaged lines was measured at about ten thousand tokens and found nothing "
        "the converter had not already flagged. Give `pages` as narrowly as you can."),
)
def page_images(path: str, pages: list[int], out_dir: str | None = None,
                dpi: int = 200, clip: list[float] | None = None) -> dict[str, Any]:
    """
    Args:
        path: the PDF.
        pages: 1-based page numbers. Keep this list short.
        out_dir: where to write the PNGs (default: alongside the PDF, in `page-images/`).
        dpi: render resolution. 200 is enough to read; 300 for small print.
        clip: [x0, y0, x1, y1] as fractions of the page, to crop rather than render it whole.
    """
    import pymupdf
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")
    if len(pages) > 12:
        return dict(ok=False, error=f"{len(pages)} pages asked for. Render the damaged pages, "
                                    f"not the document — see the tool description.")
    target = Path(out_dir) if out_dir else p.parent / "page-images"
    target.mkdir(parents=True, exist_ok=True)
    written = []
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
            written.append(dict(page=n, file=str(f), width=pix.width, height=pix.height))
    return dict(ok=True, images=written,
                next="read these, then call repair_source with the corrected text")


@server.tool(
    structured_output=True,
    title="Repair extracted text",
    description=(
        "Replace damaged passages in an extracted Markdown file with text read off the page "
        "images. Each repair is `find` → `replace`; `find` must match exactly once, so a repair "
        "that would land in the wrong place fails instead of being applied.\n\n"
        "Line counts are preserved where the replacement has the same number of lines, because "
        "a claim's position in the manuscript is measured in lines."),
)
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
    for r in repairs:
        find, repl = r.get("find", ""), r.get("replace", "")
        n = text.count(find)
        if not find:
            refused.append(dict(**r, why_refused="empty `find`"))
        elif n == 0:
            refused.append(dict(**r, why_refused="not found in the file"))
        elif n > 1:
            refused.append(dict(**r, why_refused=f"matches {n} times; make `find` unique"))
        else:
            text = text.replace(find, repl, 1)
            applied.append(dict(find=find[:80], replace=repl[:80], why=r.get("why"),
                                lines_before=find.count("\n") + 1,
                                lines_after=repl.count("\n") + 1))
    if applied and not dry_run:
        p.write_text(text, encoding="utf-8")
    return dict(ok=not refused, applied=applied, refused=refused, dry_run=dry_run,
                wrote=str(p) if applied and not dry_run else None)


@server.tool(
    structured_output=True,
    title="Check a reconstruction",
    description=(
        "Validate an .argdown file and check it against the text it cites. Returns FAULTS ONLY, "
        "each with where it is and — where one can be worked out — the fix itself.\n\n"
        "Call this after writing a map and after every round of edits, until `ok` is true. "
        "APPLY THE FIXES; do not rewrite the map. A quotation reported as found verbatim in "
        "another chapter is a stale `chapter:` path, not a misquotation, and needs a one-line "
        "edit.\n\n"
        "Without `source_root` this checks only what is true of the .argdown alone: that it "
        "parses, that nothing is wired to nothing, and that departures from the text carry a "
        "warrant. With it, every quotation is verified against the source word for word."),
)
def check_reconstruction(path: str, source_root: str | None = None,
                         full_report: bool = False) -> dict[str, Any]:
    """
    Args:
        path: the .argdown file.
        source_root: the folder holding `source/`. Enables the quotation checks.
        full_report: return the whole prose report — the census as well as the faults.
    """
    p = Path(path).expanduser()
    if not p.exists():
        return dict(ok=False, error=f"no such file: {p}")
    if full_report:
        r = _run_check(p, source_root, fmt="text", extra=["--no-fix"])
        return dict(ok=r.returncode == 0, report=r.stdout, stderr=r.stderr[:800] or None)
    r = _run_check(p, source_root, fmt="json", extra=["--no-fix"])
    try:
        out = json.loads(r.stdout)
    except json.JSONDecodeError:
        return dict(ok=False, error="the checker did not return JSON",
                    stdout=r.stdout[:1500], stderr=r.stderr[:800])
    if not source_root:
        out["note"] = ("no source_root given, so quotations were NOT verified. Pass the folder "
                       "holding `source/` to check them.")
    out["next"] = ("nothing to fix" if out.get("ok") else
                   "apply the fixes above and call this again")
    return out


@server.tool(
    structured_output=True,
    title="Split a manuscript",
    description=(
        "Split a one-file book manuscript into per-chapter Markdown files plus a project file "
        "recording the reading order. Use before reconstructing a book: a single map over "
        "separate chapter files is what lets Ipsissima lay claims out by where they fall in "
        "the text."),
)
def split_manuscript(path: str, out: str, title: str | None = None,
                     dry_run: bool = False) -> dict[str, Any]:
    """
    Args:
        path: the one-file manuscript (Markdown).
        out: the folder to write chapters into.
        title: title for the project file.
        dry_run: report the split and write nothing.
    """
    cmd = [sys.executable, str(HERE / "split_manuscript.py"), str(Path(path).expanduser()),
           "--out", str(out)]
    if title:
        cmd += ["--title", title]
    if dry_run:
        cmd += ["--dry-run"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return dict(ok=r.returncode == 0, report=r.stdout, error=r.stderr[:800] or None)


# ---------------------------------------------------------- Zotero, if present ---- #
# AN ENHANCEMENT, NEVER A DEPENDENCY. Everything above works with no Zotero installed. What a
# library adds is that an item usually holds BOTH a PDF and the publisher's HTML snapshot — the
# snapshot is machine-readable and the PDF has the page numbers, so the pair is better than
# either. The tool is registered only when there is a library to talk to, so a user without one
# is not offered a tool that can only fail.

def _zotero_available():
    return (Path.home() / "Zotero" / "zotero.sqlite").exists()


if _zotero_available():
    @server.tool(
        structured_output=True,
        title="Find a source in Zotero",
        description=(
            "Look an item up in the local Zotero library by DOI, item key or title fragment, and "
            "report what is attached to it and which attachment is the best source.\n\n"
            "An item holding both a PDF and an HTML snapshot is the best case there is: the "
            "snapshot gives structured text with nothing inferred, and the PDF gives the page "
            "numbers. Read-only — nothing is ever written into the Zotero storage tree."),
    )
    def zotero_lookup(doi: str | None = None, key: str | None = None,
                      title: str | None = None) -> dict[str, Any]:
        from ipsissima_mcp import from_zotero
        if not any((doi, key, title)):
            return dict(ok=False, error="give one of doi, key or title")
        try:
            atts = from_zotero.attachments(item_key=key, doi=doi, title=title)
        except Exception as e:
            return dict(ok=False, error=f"could not read the Zotero database: {e}")
        if not atts:
            return dict(ok=False, error="nothing in Zotero matches, or its files are not "
                                        "stored locally")
        best = from_zotero.best(atts)
        kinds = {a.get("contentType") for a in atts}
        return dict(
            ok=True, attachments=atts, best=best,
            pairing=("this item has both an HTML snapshot and a PDF — extract from the snapshot "
                     "and use the PDF for page numbers"
                     if {"text/html", "application/pdf"} <= kinds else None),
            next="call plan_job with the path from `best`")


# ----------------------------------------------------------------- prompts ---- #
# THE INSTRUCTIONS ARE PROSE, LOADED FRESH. Improving a reconstruction should mean editing a
# document, not shipping a release — and the extraction prompt says so in its own first
# paragraph, having been written for this before there was a server to serve it.

def _doc(name):
    p = DOCS / name
    return p.read_text(encoding="utf-8") if p.exists() else f"(missing: {p})"


@server.prompt(
    title="Reconstruct an argument as Argdown",
    description="The full instructions for turning a source text into a checkable .argdown "
                "reconstruction: how to find the form, what fidelity levels mean, how to "
                "record provenance, and the traps that do not announce themselves.",
)
def reconstruct_argument(source_path: str = "", out_path: str = "") -> str:
    tail = ""
    if source_path:
        tail = (f"\n\n---\n\n## This job\n\nThe source is `{source_path}`."
                + (f" Write the reconstruction to `{out_path}`." if out_path else "")
                + "\n\nWhen the map is written, call `check_reconstruction` on it with "
                  "`source_root` set to the folder containing `source/`, and apply the fixes it "
                  "reports until it comes back `ok`. Do not rewrite the map to fix one claim.")
    return _doc("extraction-prompt.md") + tail


@server.prompt(
    title="Extract text only",
    description="Get the structured Markdown out of a document, and stop there — no "
                "reconstruction.",
)
def extract_text_only(sources: str = "") -> str:
    return (
        "Extract the text of "
        + (f"`{sources}`" if sources else "the sources the user named")
        + " to structured Markdown, and stop there. Do NOT reconstruct an argument.\n\n"
        "1. `plan_job` with intent=\"extract\". If it returns questions, ask them.\n"
        "2. If any source is a PDF, `assess_pdf` first — a machine-readable version of the same "
        "article may exist, and a scan may need reading rather than converting.\n"
        "3. `extract_text`.\n"
        "4. Report where the files went, how many words came out, and anything the converter "
        "said it could not do. The converter's notes are the point: a conversion that "
        "mis-handled something quietly is worse than one that says what it did.")


# ---------------------------------------------------------------- resources ---- #
# ON DEMAND, NOT BY DEFAULT. These are reference documents totalling some 19,000 words. Loading
# them into every conversation would cost more than most reconstructions.

for _uri, _file, _desc in (
    ("ipsissima://argdown/syntax", "SKILL.md",
     "Argdown syntax and the failure modes that do not announce themselves. Read when a file "
     "will not parse, or before writing an unfamiliar construction."),
    ("ipsissima://argdown/reference", "reference.md",
     "A full Argdown reference in which every rule was tested against the CLI."),
    ("ipsissima://ipsissima/map-semantics", "map-semantics.md",
     "What the map draws and why: fidelity borders, tags, sections, selection modes."),
    ("ipsissima://ipsissima/order-views", "order-views.md",
     "The two arrangements — order of reasons, order of exposition — and justificatory debt."),
    ("ipsissima://ipsissima/viewer", "viewer.md",
     "Using the Ipsissima viewer and editor: panes, provenance, comments, export."),
    ("ipsissima://ipsissima/integrations", "integrations.md",
     "Pandoc, Quarto and reveal.js routes for putting a map into a document."),
):
    def _make(f):
        def read() -> str:
            return _doc(f)
        return read
    server.resource(_uri, name=_file[:-3], description=_desc,
                    mime_type="text/markdown")(_make(_file))


def main():
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
