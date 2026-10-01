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


#: The zip-based formats, and the archive members whose text is the document. A .epub, .docx
#: or .odt opened as text is a ZIP read as UTF-8 noise: measured on a 264 KB Gutenberg epub,
#: the raw read reported 11,302 "words" -- labelled exact -- where the text held 6,683, and
#: the token estimate inherited the fiction.
ZIP_TEXT_MEMBERS = {".epub": (".xhtml", ".html", ".htm"),
                    ".docx": ("word/document.xml",),
                    ".odt": ("content.xml",)}


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
    ext = os.path.splitext(path)[1].lower()
    if ext in ZIP_TEXT_MEMBERS:
        # Count the archive's own text, tags stripped -- markup and entities cost a few
        # percent, which is closer than compressed noise by an order of magnitude, so this is
        # a count rather than an estimate. The fallback for a damaged archive IS an estimate,
        # and says so.
        import zipfile
        try:
            words, read = 0, 0
            with zipfile.ZipFile(path) as z:
                for member in z.namelist():
                    if not any(member.lower().endswith(s) for s in ZIP_TEXT_MEMBERS[ext]):
                        continue
                    raw = z.read(member)[:cap]
                    words += len(re.sub(rb"<[^>]+>", b" ", raw).split())
                    read += len(raw)
                    if read >= cap:
                        break
            return words, False
        except Exception:
            return os.path.getsize(path) // 6, True
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


#: CAUSAL LANGUAGE, PER THOUSAND WORDS OF RUNNING TEXT, above which the plan offers the mechanism
#: pass. Measured 26 Sep 2026 with mechanism.CAUSAL over every sample in the repository and the
#: private corpus: the three policy briefs of the causal-diagrams research ran 11.5-13.3 and
#: Darwin's natural selection 10.3; every philosophy paper ran 7.2 or below (Nagel on death the
#: highest, Carroll 3.0), and a polemic or a speech lower still. Nine sits in the gap.
CAUSAL_PER_KW = 9.0
#: ...and a floor, so that a paragraph that happens to say "because" twice offers nothing.
CAUSAL_MIN_SENTENCES = 8
#: How much is read. A policy text shows its hand early; a book's first chapters are enough.
_SAMPLE_CHARS, _SAMPLE_PAGES = 120_000, 25
_BACK_MATTER = re.compile(r"^(\d+\.?\s*)?(notes|endnotes|references|bibliography|works cited)\s*$", re.I)


def _sample_text(path):
    """Running text enough to judge, cheaply. None where nothing can be read without converting."""
    name, _ = tier_of(path)
    ext = os.path.splitext(path)[1].lower()
    try:
        if name == "pdf":
            import pymupdf
            pages = []
            with pymupdf.open(path) as d:
                for i in range(min(d.page_count, _SAMPLE_PAGES)):
                    lines = [l.strip() for l in d[i].get_text().split("\n") if l.strip()]
                    # THE BACK MATTER STOPS THE SAMPLE, as a heading does in Markdown. Unstopped,
                    # four pages of endnotes took the SMF brief from 11.5 to 8.3 and under the bar.
                    end = next((j for j, l in enumerate(lines) if len(l) < 30 and _BACK_MATTER.match(l)),
                               None)
                    # A PDF's lines break mid-sentence; each page is one paragraph for this purpose.
                    pages.append(" ".join(lines[:end]))
                    if end is not None:
                        break
            return "\n\n".join(pages)
        if ext in ZIP_TEXT_MEMBERS:
            import zipfile
            parts, read = [], 0
            with zipfile.ZipFile(path) as z:
                for member in z.namelist():
                    if not any(member.lower().endswith(x) for x in ZIP_TEXT_MEMBERS[ext]):
                        continue
                    raw = z.read(member)[:_SAMPLE_CHARS].decode("utf-8", "replace")
                    # Paragraph ends survive as blank lines; the rest of the markup goes.
                    raw = re.sub(r"</(w:p|p|h\d|li|div|text:p|text:h)>", "\n\n", raw)
                    parts.append(re.sub(r"<[^>]+>", " ", raw))
                    read += len(raw)
                    if read >= _SAMPLE_CHARS:
                        break
            return "\n\n".join(parts)
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read(_SAMPLE_CHARS)
        if ext in (".html", ".htm"):
            text = re.sub(r"<[^>]+>", " ", re.sub(r"</(p|h\d|li|div)>", "\n\n", text, flags=re.I))
        return text
    except Exception:
        return None


def causal_signal(path):
    """How much of a source's running text says that something brings something about.

    A SIGNAL FOR AN OFFER, NEVER A VERDICT. It decides only whether the plan mentions the mechanism
    pass; the reader decides whether to have it. Counted with the same pattern the checker's
    coverage aid uses, over the same sentences, so the offer and the later coverage report agree
    about what causal language is."""
    from ipsissima_mcp import mechanism
    text = _sample_text(path)
    if not text:
        return None
    sents = mechanism._sentences(text)
    words = sum(len(s.split()) for _, s in sents)
    n = sum(1 for _, s in sents if mechanism.CAUSAL.search(s))
    per_kw = round(1000 * n / words, 1) if words else 0.0
    return dict(causal_sentences=n, sentences=len(sents), words_read=words, per_1000_words=per_kw,
                looks_causal=per_kw >= CAUSAL_PER_KW and n >= CAUSAL_MIN_SENTENCES)


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
                   .strftime("%Y-%m-%d"),
                   causal=causal_signal(p))
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

    # ---- two files carrying one text --------------------------------------- #
    # A RECORD CAN CARRY THE WRONG ATTACHMENT. Ripple et al.'s Zotero record held a second copy of
    # MacNulty et al.'s comment, and the plan printed identical statistics for the two "papers"
    # without a word (gap tests, 27 Sep 2026). Two files alike in words, sentences and causal
    # sentences are almost certainly one text: asked, never assumed.
    alike = {}
    for r in sources:
        c = r["causal"] or {}
        if r["words"] and (c.get("sentences") or 0) >= 5:
            alike.setdefault((r["words"], c.get("sentences"), c.get("causal_sentences")), []).append(r)
    for key, group in sorted(alike.items()):
        if len(group) > 1:
            questions.append(dict(
                id="same-text:" + group[0]["name"],
                question=f"{' and '.join(r['name'] for r in group)} read as the same text "
                         f"({key[0]} words, {key[1]} sentences). Are they really different works?",
                options=[r["name"] for r in group] + ["they differ"],
                suggested=None,
                why="identical counts almost always mean one document under two names -- often "
                    "a reference manager's record carrying another work's file. Open each and "
                    "check its title before converting both."))

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

    # ---- the mechanism: always considered (parallel), or offered (series) ---- #
    # SERIES, DECIDED 26 SEP 2026: the pass runs only on request, on a finished and verified map. A text
    # that says, sentence after sentence, what brings what about is the one where a reader is
    # likely to want it and unlikely to know it exists -- so the plan SAYS it exists. An offer,
    # not a question: nothing waits on the answer, and the map is made the same way either way.
    offers = []
    mech_plan = None
    causal = [r for r in sources if (r["causal"] or {}).get("looks_causal")]
    from ipsissima_mcp import mechanism
    if mechanism.mechanism_method() == "parallel" and sources:
        # ALWAYS CONSIDERED (1.17, James, 1 Oct 2026). The count of causal vocabulary missed all
        # three essays of the parallel-pass trial -- Merton read 2 causal sentences per thousand
        # words and is a mechanism from start to finish -- because essays carry causation in
        # narrative and metaphor. So under the parallel method the mechanism is part of every
        # reconstruction, its cost kept down by the skeleton: map it only as far as the argument
        # needs it, and say how far (`depth`). The count stays, as a hint.
        rates = {r["name"]: (r["causal"] or {}).get("per_1000_words") for r in sources}
        mech_plan = dict(
            method="parallel", considered="always",
            causal_hint=rates,
            message=("The mechanism will be read together with the argument (the parallel method): "
                     "what the text says brings what about, and where that does work in the "
                     "argument. It is mapped only as far as the argument relies on it -- in full, "
                     "as a sketch, or recorded as not mapped, with the reason. Say if you want the "
                     "argument alone."),
            how=("read argdown_method `mechanism` with the reconstruction documents; sketch the "
                 "mechanism's skeleton beside the argument's; then set `mechanism: depth:` -- `full`, "
                 "`sketch`, or `none` with a `depth_reason:` -- by what the argument relies on, not by "
                 "the causal count, which misses causation told in narrative and metaphor. If the user "
                 "wants the argument alone, `depth: none` with that as the reason"))
    elif causal:
        names = [r["name"] for r in causal]
        lead = (f"{', '.join(names)} {'sets' if len(names) == 1 else 'set'} out what brings what "
                f"about -- causal language in {max(r['causal']['per_1000_words'] for r in causal):g} "
                f"sentences per thousand words, where an argumentative paper runs under 7. ")
        offers.append(dict(
            id="mechanism", sources=names, method="series",
            message=lead + ("Once the map checks ok and verified, Ipsissima can also mark the "
                            "causal chain the text asserts -- actors, steps, what each step "
                            "rests on, and where the chain stops -- and draw it in the "
                            "Mechanism view. It is a separate pass that re-reads the source, "
                            "and it changes nothing in the argument."),
            how="only if the user says yes: argdown_method with `mechanism`, after the map "
                "checks ok and verified"))

    total = sum(r["words"] for r in sources)
    return dict(
        sources=sorted(sources, key=lambda r: r["path"]),
        count=len(sources), total_words=total,
        unreadable=unreadable, skipped=skipped,
        questions=questions, advice=advice, offers=offers,
        **({"mechanism": mech_plan} if mech_plan else {}),
        hierarchy_note="Markdown is gold, pandoc-readable is silver, PDF is bronze. Where you "
                       "have a document in more than one format, give Ipsissima the best one.")
