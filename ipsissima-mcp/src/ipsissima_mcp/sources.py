#!/usr/bin/env python3
"""What a source is, which route it takes, and what is ambiguous about a request.

WHY THIS IS A MODULE AND NOT PART OF THE SERVER. Deciding what someone meant by "the articles in
this folder" is the only genuinely hard thing the server does, and it is worth being able to test
it without an MCP client attached. Everything here is pure: paths in, a description out, nothing
written and nothing converted.

THE HIERARCHY, which is the whole point of the file:

  1. MARKDOWN IS GOLD. Already structured, already the format a reconstruction cites. Nothing is
     recovered because nothing was lost. When you are drafting in Markdown, Ipsissima reads your
     live file and the Manuscript view is always the current draft.
  2. PANDOC-READABLE IS SILVER -- .docx, .odt, .html, .tex, .epub. The publisher's or the
     author's own structure survives; headings are headings because the document says so.
  3. PDF IS BRONZE, and the gap is not small. A PDF records where ink sat on a page. Paragraphs,
     headings and reading order all have to be INFERRED from geometry, and inference has a hit
     rate. A PDF of a document you also have as .docx is strictly worse and there is no case for
     using it.

The practical consequence, and the reason this runs before anything is converted: if a folder
holds `chapter-3.pdf` beside `chapter-3.docx`, someone is about to reconstruct from the wrong
one. Saying so costs nothing and saves a conversion that will read worse for ever.
"""
import os
import re
from datetime import datetime, timezone

# Route by extension. The tiers are the hierarchy above; `rank` sorts them best-first.
TIERS = {
    "markdown": dict(rank=1, metal="gold", exts={".md", ".markdown"},
                     why="already structured; nothing is inferred"),
    "pandoc":   dict(rank=2, metal="silver",
                     exts={".docx", ".odt", ".html", ".htm", ".epub", ".tex", ".rtf"},
                     why="the document's own structure survives the conversion"),
    "pdf":      dict(rank=3, metal="bronze", exts={".pdf"},
                     why="structure has to be inferred from where the ink sat"),
    "plain":    dict(rank=2, metal="silver", exts={".txt"},
                     why="no structure to lose, and none to recover"),
}
EXT_TIER = {e: t for t, spec in TIERS.items() for e in spec["exts"]}
SOURCE_EXTS = set(EXT_TIER)

# Folders that are never a manuscript. Machinery only -- a stranger's folder names are their
# business, and a walker that skips "Submission" because one author kept drafts there is a
# walker that silently loses somebody else's chapter.
SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".argument-history",
             "source", "__MACOSX"}

# `chapter-3 v2.docx`, `intro (draft 4).md`, `paper-2026-08-14.docx`, `ch1 final.docx`.
# Deliberately conservative: it decides only what to ASK about, never what to use.
_VERSION = re.compile(
    r"""(?ix)
    ^(?P<stem>.*?)
    (?:[\s._-]*(?:
        v(?:er(?:sion)?)?[\s._-]*\d+(?:\.\d+)*      # v2, ver 3, version 1.2
      | \(?\s*draft\s*\d*\s*\)?                     # draft, draft 4, (draft 2)
      | \d{4}-\d{2}-\d{2}                           # 2026-08-14
      | \b(?:final|latest|clean|rev\d*|copy)\b
    ))+\s*$""")


def tier_of(path):
    """('markdown'|'pandoc'|'pdf'|'plain'|None, spec) for a path."""
    ext = os.path.splitext(path)[1].lower()
    name = EXT_TIER.get(ext)
    return name, (TIERS[name] if name else None)


def _stem_key(path):
    """The name with any version marker taken off, lowercased. Groups drafts of one thing."""
    stem = os.path.splitext(os.path.basename(path))[0]
    m = _VERSION.match(stem)
    base = (m.group("stem") if m and m.group("stem").strip() else stem)
    return re.sub(r"[\s._-]+", " ", base).strip().lower()


def _mtime(path):
    try:
        return os.stat(path).st_mtime
    except OSError:
        return 0.0


def _words(path, cap=400_000):
    """Word count, cheaply. PDFs are not opened -- pages are the estimate that costs nothing."""
    name, _ = tier_of(path)
    if name == "pdf":
        try:
            import pymupdf
            with pymupdf.open(path) as d:
                # ~450 words a page for a journal article; an estimate labelled as one.
                return d.page_count * 450, True
        except Exception:
            return 0, True
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return len(fh.read(cap).split()), False
    except OSError:
        return 0, False


def resolve(paths, recursive=True, max_files=500):
    """Expand what the user pointed at into a list of source files.

    A DIRECTORY IS WALKED, a file is taken as given, and anything that is neither is reported
    rather than dropped -- "I gave you six things and got four maps" is the sort of quiet loss
    this whole project exists to refuse.
    """
    found, unreadable, skipped = [], [], []
    seen = set()

    def take(p):
        ap = os.path.abspath(p)
        if ap in seen:
            return
        seen.add(ap)
        if os.path.splitext(ap)[1].lower() in SOURCE_EXTS:
            found.append(ap)
        else:
            skipped.append(dict(path=ap, why="no converter for this extension"))

    for raw in paths:
        p = os.path.abspath(os.path.expanduser(raw))
        if os.path.isfile(p):
            take(p)
        elif os.path.isdir(p):
            for root, dirs, files in os.walk(p):
                dirs[:] = sorted(d for d in dirs
                                 if d not in SKIP_DIRS and not d.startswith("."))
                if not recursive:
                    dirs[:] = []
                for f in sorted(files):
                    if f.startswith("."):
                        continue
                    if len(found) >= max_files:
                        break
                    take(os.path.join(root, f))
        else:
            unreadable.append(dict(path=p, why="no such file or directory"))
    return found, unreadable, skipped


def describe(paths, recursive=True):
    """The full reading of a request: every source, its route, and everything ambiguous.

    Returns a dict the server hands almost straight back to the caller. `questions` is the part
    that matters: each entry is something the assistant should PUT TO THE USER rather than
    decide, because deciding it wrongly means paying for a reconstruction of the wrong text.
    """
    files, unreadable, skipped = resolve(paths, recursive=recursive)
    sources, by_stem = [], {}
    for p in files:
        name, spec = tier_of(p)
        n, est = _words(p)
        rec = dict(path=p, name=os.path.basename(p), tier=name, metal=spec["metal"],
                   rank=spec["rank"], why=spec["why"], words=n, words_estimated=est,
                   modified=datetime.fromtimestamp(_mtime(p), timezone.utc)
                   .strftime("%Y-%m-%d"))
        sources.append(rec)
        by_stem.setdefault(_stem_key(p), []).append(rec)

    questions, advice = [], []

    # ---- the same document, in two formats -------------------------------- #
    # THE ONE PIECE OF ADVICE THIS PROJECT MOST WANTS TO GIVE. Converting the PDF when the .docx
    # is right beside it buys a worse manuscript for ever, and nobody does it on purpose.
    for stem, group in sorted(by_stem.items()):
        best = min(group, key=lambda r: r["rank"])
        worse = [r for r in group if r["rank"] > best["rank"]]
        if worse:
            advice.append(dict(
                kind="better-format-available", stem=stem, use=best["name"],
                instead_of=[r["name"] for r in worse],
                message=f"{best['name']} ({best['metal']}) and {', '.join(r['name'] for r in worse)} "
                        f"look like one document in several formats. Use the {best['metal']} one: "
                        f"{best['why']}."))

    # ---- several drafts of one chapter ------------------------------------ #
    for stem, group in sorted(by_stem.items()):
        same_tier = [r for r in group if r["rank"] == min(g["rank"] for g in group)]
        if len(same_tier) > 1:
            newest = max(same_tier, key=lambda r: _mtime(r["path"]))
            questions.append(dict(
                id=f"draft:{stem}",
                question=f"{len(same_tier)} files look like drafts of “{stem}”. "
                         f"Which should be reconstructed?",
                options=[r["name"] for r in same_tier],
                suggested=newest["name"],
                why=f"{newest['name']} was modified most recently ({newest['modified']}), but a "
                    f"file's date is not always its draft order."))

    # ---- one map, or one per source --------------------------------------- #
    # NEVER GUESSED. A book's chapters want one map; a folder of articles wants one each; and
    # the two requests look identical from here. Getting it wrong costs a whole reconstruction.
    if len(sources) > 1:
        questions.append(dict(
            id="grouping",
            question=f"{len(sources)} sources. One map covering all of them, or one map each?",
            options=["one-map", "map-each"],
            suggested=None,
            why="chapters of one work belong in one map; separate articles belong in separate "
                "maps. Nothing in the files themselves settles which this is."))

    total = sum(r["words"] for r in sources)
    return dict(
        sources=sorted(sources, key=lambda r: r["path"]),
        count=len(sources), total_words=total,
        unreadable=unreadable, skipped=skipped,
        questions=questions, advice=advice,
        hierarchy_note="Markdown is gold, pandoc-readable is silver, PDF is bronze. Where you "
                       "have a document in more than one format, give Ipsissima the best one.")
