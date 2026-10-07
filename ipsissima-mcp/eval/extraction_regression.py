#!/usr/bin/env python3
"""Extraction regression: what does a change to the converter do to every PDF we have?

    python3 ipsissima-mcp/eval/extraction_regression.py                  # working tree vs HEAD
    python3 ipsissima-mcp/eval/extraction_regression.py --base 4b3a160   # vs any commit
    python3 ipsissima-mcp/eval/extraction_regression.py --list my-pdfs.txt --show 6
    python3 ipsissima-mcp/eval/extraction_regression.py --save-golden DIR   # approve today's output
    python3 ipsissima-mcp/eval/extraction_regression.py --golden DIR        # compare with approved
    python3 ipsissima-mcp/eval/extraction_regression.py --self-test

WHY THIS EXISTS. A converter rule is a guess about typography, and every guess that mends one
paper can break another. Measured, not hypothetical: the October 2026 fixes for Sewell (AJS 1992)
and Wilson (MHCP 2023) were each right for their paper, and the first versions of six of them
damaged others -- Robeyns lost six numbered headings, Ó Gráda's tables became headings, Williams's
displayed quotations split, a running head leaked into a footnote. Every one was caught by
converting the whole set with the old converter and the new and reading the differences. This is
that procedure, kept.

IT REPORTS, IT DOES NOT JUDGE. A difference is not a failure: most of what a good fix changes is
other papers getting better (a first page recovered, a page number removed from a paragraph). So
the default run prints, per document, how many words changed and in which ways, and `--show N`
prints the first N changes in context for a person to read. Only `--golden` gives a verdict: there
the reference is an output somebody approved, so any difference needs approving again
(`--save-golden`), and the exit status says whether there was one.

WHAT IS COMPARED. The body from the first page marker on, word by word, with the page markers
taken out first: a marker moving past a heading is not a change of text, and counted as words it
drowned the real changes in noise. Headings, notes and the abstract are compared on their own, and
a document the structured route gave up on (the plain-route fallback) is always reported.

THE INPUTS. The public fixtures in `fixtures/ingest/`; the private corpus, when
IPSISSIMA_PRIVATE_CORPUS points at it (docs/CORPUS.md); and any list file given with `--list` or
IPSISSIMA_EXTRACTION_LIST -- one PDF path a line, `#` for comments. A list of copyrighted papers
belongs in the non-GitHub folder, not here: the repository names only what it may publish.

THE MAPS ARE AN ANSWER KEY (`--maps`). Every quotation a map verifies is a sentence some
extraction of that paper got right, and that a converter must keep quotable. So each map whose
source can be traced to its PDF -- by the `zotero:` key in the source's front matter, or the PDF
named in its header -- is checked against a fresh conversion by each converter, and every
quotation that verified with the old and fails with the new is NAMED. That is a verdict, not a
difference to read: the run fails on one. The count is relative on purpose: many sources were
repaired by hand after converting, so neither converter matches them everywhere; what matters is
that a change loses none of what the last one had. Maps are found in `samples/`, the private
corpus, and the folders in IPSISSIMA_MAPS_DIRS (separated as PATH is).

THE BASELINE is the converter at a git commit, unpacked with `git archive` into a cache keyed by
the commit, and its outputs are cached there too (keyed by the PDF's path, size and mtime), so a
second run against the same baseline converts only with the working tree.
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
MCP = HERE.parent
REPO = MCP.parent
PKG = MCP / "src" / "ipsissima_mcp"
CACHE = Path(os.environ.get("IPSISSIMA_REGRESSION_CACHE",
                            Path.home() / ".cache" / "ipsissima" / "extraction-regression"))
MARKER = re.compile(r"<!--\s*(?:[^\n]*?\s)?p\.\s*-?\d+\s+begins here\s*-->")


# --------------------------------------------------------------------------- the inputs

def pdfs_from(args):
    paths = []
    paths += sorted(str(p) for p in (REPO / "fixtures" / "ingest").glob("*.pdf"))
    priv = os.environ.get("IPSISSIMA_PRIVATE_CORPUS")
    if priv and Path(priv).is_dir():
        paths += sorted(str(p) for p in Path(priv).rglob("*.pdf"))
    for lst in [args.list, os.environ.get("IPSISSIMA_EXTRACTION_LIST")]:
        if lst and Path(lst).is_file():
            for line in Path(lst).read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    paths.append(os.path.expanduser(line))
    seen, out = set(), []
    for p in paths:
        if p not in seen and Path(p).is_file():
            seen.add(p)
            out.append(p)
    if args.only:
        out = [p for p in out if re.search(args.only, p, re.I)]
    return out


def key_of(pdf):
    st = os.stat(pdf)
    return hashlib.sha1(f"{pdf}|{st.st_size}|{int(st.st_mtime)}".encode()).hexdigest()[:16]


# --------------------------------------------------------------------------- converting

def package_at(ref):
    """The converter package as it was at `ref`, unpacked once into the cache."""
    sha = subprocess.run(["git", "-C", str(REPO), "rev-parse", ref], capture_output=True, text=True,
                         check=True).stdout.strip()
    dest = CACHE / sha / "pkg"
    if not (dest / "ipsissima_mcp" / "ingest.py").exists():
        dest.mkdir(parents=True, exist_ok=True)
        tar = subprocess.run(["git", "-C", str(REPO), "archive", sha, "ipsissima-mcp/src/ipsissima_mcp"],
                             capture_output=True, check=True).stdout
        subprocess.run(["tar", "-x", "-C", str(dest), "--strip-components", "2"], input=tar, check=True)
    return sha, dest


def convert(pdf, pkg_dir, out_dir):
    """Convert one PDF with the package in `pkg_dir`; returns (markdown, log). Run as a script, so
    `ingest.py` imports the converter beside it, not whichever is installed."""
    out_dir = Path(out_dir)
    md = next(out_dir.glob("source/*.md"), None) if out_dir.exists() else None
    log = out_dir / "log.txt"
    if md is None:
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.mkdir(parents=True)
        r = subprocess.run([sys.executable, str(Path(pkg_dir) / "ipsissima_mcp" / "ingest.py"), pdf,
                            "--out", str(out_dir), "--no-ocr"], capture_output=True, text=True)
        log.write_text(r.stdout + r.stderr, encoding="utf-8")
        md = next(out_dir.glob("source/*.md"), None)
    return (md.read_text(encoding="utf-8") if md else None,
            log.read_text(encoding="utf-8") if log.exists() else "")


# --------------------------------------------------------------------------- comparing

def parts(md):
    """What is compared: the body's words with page markers taken out, the headings, the notes
    and the abstract's length."""
    if md is None:
        return None
    front = re.match(r"(?s)\A---\n(.*?)\n---\n", md)
    abstract = 0
    if front:
        mo = re.search(r"(?s)^abstract: >-\n(.*?)(?=^\S|\Z)", front.group(1) + "\n", re.M)
        abstract = len(mo.group(1).split()) if mo else 0
    start = md.find("begins here -->")
    body = md[md.rfind("<!--", 0, start):] if start >= 0 else md
    words = MARKER.sub(" ", body).split()
    heads = [l.strip() for l in body.splitlines() if re.match(r"#{1,6} ", l)]
    notes = len(re.findall(r"(?m)^\[\^\d+\]:", body))
    return dict(words=words, heads=heads, notes=notes, abstract=abstract)


def plain_fallback(log):
    return "plain route is used" in (log or "")


def compare(a, b, show=0):
    """The difference between two conversions, as numbers and (with `show`) contexts."""
    if a is None or b is None:
        return dict(missing=True, changed=0, contexts=[])
    sm = difflib.SequenceMatcher(None, a["words"], b["words"], autojunk=False)
    changed, contexts = 0, []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        changed += max(i2 - i1, j2 - j1)
        if len(contexts) < show:
            contexts.append((op, " ".join(a["words"][max(0, i1 - 5):i2 + 3])[:180],
                             " ".join(b["words"][max(0, j1 - 5):j2 + 3])[:180]))
    return dict(missing=False, changed=changed, contexts=contexts,
                heads_gained=[h for h in b["heads"] if h not in a["heads"]],
                heads_lost=[h for h in a["heads"] if h not in b["heads"]],
                notes=(a["notes"], b["notes"]), abstract=(a["abstract"], b["abstract"]))


# --------------------------------------------------------------------------- the maps

def map_roots():
    roots = [REPO / "samples"]
    for r in [os.environ.get("IPSISSIMA_PRIVATE_CORPUS")] + os.environ.get("IPSISSIMA_MAPS_DIRS", "").split(os.pathsep):
        if r and Path(r).is_dir():
            roots.append(Path(r))
    return roots


def pdf_for(source_md, near):
    """The PDF a source was converted from: its Zotero attachment, or the file its header names,
    looked for in Zotero, the ingest fixtures, the private corpus and beside the map."""
    head = source_md.read_text(encoding="utf-8", errors="replace")[:5000]
    z = re.search(r'^zotero:\s*"?(\w{8})', head, re.M)
    if z:
        hit = sorted((Path.home() / "Zotero" / "storage" / z.group(1)).glob("*.pdf"))
        if hit:
            return str(hit[0])
    f = re.search(r"Made by \S+ from (.+?\.pdf)", head)
    if not f:
        return None
    name = f.group(1).strip()
    places = [Path.home() / "Zotero" / "storage", REPO / "fixtures" / "ingest", near]
    priv = os.environ.get("IPSISSIMA_PRIVATE_CORPUS")
    if priv:
        places.append(Path(priv))
    for place in places:
        if place.is_dir():
            hit = next(iter(place.glob("*/" + name)), None) or next(iter(place.glob(name)), None) \
                or next(iter(place.rglob(name)), None) if place != Path.home() / "Zotero" / "storage" \
                else next(iter(place.glob("*/" + name)), None)
            if hit:
                return str(hit)
    return None


def linked_maps(only=None):
    """(map, chapter, pdf) for each map with ONE source file that can be traced to a PDF."""
    out, seen = [], set()
    for root in map_roots():
        for m in sorted(root.rglob("*.argdown")):
            if only and not re.search(only, str(m), re.I):
                continue
            text = m.read_text(encoding="utf-8", errors="replace")
            chapters = set(re.findall(r'\bchapter:\s*"?([^"\n,}]+)"?', text))
            if len(chapters) != 1:
                continue
            chapter = chapters.pop().strip()
            src = m.parent / chapter
            if not src.is_file():
                continue
            pdf = pdf_for(src, m.parent)
            if pdf and str(m) not in seen:
                seen.add(str(m))
                out.append((m, chapter, pdf))
    return out


def quotations(map_path, chapter, md):
    """(checked, the titles whose quotation fails) for the map against `md` as its source."""
    if md is None:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy(map_path, Path(tmp) / map_path.name)
        dest = Path(tmp) / chapter
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(md, encoding="utf-8")
        r = subprocess.run([sys.executable, str(PKG / "check_argdown.py"), str(Path(tmp) / map_path.name),
                            "--source-root", tmp, "--no-fix", "--format", "json"], capture_output=True, text=True)
    try:
        res = json.loads(r.stdout)
    except ValueError:
        return None
    failing = sorted({f.get("title", "?") for f in res.get("findings", []) if f.get("check") == "quotation"})
    return (res.get("shape", {}).get("quotations", {}).get("checked", 0), failing)


def run_maps(args, old_conv, new_conv):
    """Every linked map checked against both converters' outputs; returns how many lost a quotation."""
    maps = linked_maps(args.only)
    print(f"the maps as an answer key: {len(maps)} map(s) traced to their PDF\n")
    # Each PDF converted once by each converter, before any map is checked: two maps of one paper
    # (a trial's two arms) converting it at once wrote into one folder.
    pdfs = sorted({t[2] for t in maps})
    with ThreadPoolExecutor(args.jobs) as ex:
        old_md = dict(zip(pdfs, ex.map(lambda p: old_conv(p)[0], pdfs)))
        new_md = dict(zip(pdfs, ex.map(lambda p: new_conv(p)[0], pdfs)))
        rows = list(ex.map(lambda t: (t, quotations(t[0], t[1], old_md[t[2]]),
                                      quotations(t[0], t[1], new_md[t[2]])), maps))
    lost_maps = 0
    for (m, _c, _p), a, b in rows:
        name = f"{m.parent.name}/{m.name}"[-70:]
        if a is None or b is None:
            print(f"  ?  {name}: could not be checked")
            continue
        lost = [t for t in b[1] if t not in a[1]]
        gained = [t for t in a[1] if t not in b[1]]
        ok_a, ok_b = a[0] - len(a[1]), b[0] - len(b[1])
        mark = "!" if lost else ("+" if gained else " ")
        lost_maps += bool(lost)
        if lost or gained or args.show:
            print(f"  {mark} {ok_a:4d} -> {ok_b:4d} of {b[0]:4d} quotations  {name}")
            for t in lost[: max(args.show, 5)]:
                print(f"        lost:   {t}")
            for t in gained[: args.show]:
                print(f"        gained: {t}")
    print(f"\n{lost_maps} map(s) lost a quotation that verified before.")
    return lost_maps


# --------------------------------------------------------------------------- the run

def report(rows, show):
    differ = 0
    for name, d, fa, fb in rows:
        flags = []
        if d.get("missing"):
            flags.append("NO OUTPUT")
        if fa != fb:
            flags.append(f"plain route {'now' if fb else 'no longer'}")
        if d.get("notes") and d["notes"][0] != d["notes"][1]:
            flags.append(f"notes {d['notes'][0]}->{d['notes'][1]}")
        if d.get("abstract") and d["abstract"][0] != d["abstract"][1]:
            flags.append(f"abstract {d['abstract'][0]}->{d['abstract'][1]} words")
        hg, hl = d.get("heads_gained", []), d.get("heads_lost", [])
        if hg or hl:
            flags.append(f"headings +{len(hg)} -{len(hl)}")
        if not d.get("changed") and not flags:
            continue
        differ += 1
        print(f"  {d.get('changed', 0):6d} words  {name[:60]}" + (f"  [{'; '.join(flags)}]" if flags else ""))
        for h in hl[:show]:
            print(f"           - {h[:100]}")
        for h in hg[:show]:
            print(f"           + {h[:100]}")
        for op, old, new in d.get("contexts", []):
            print(f"           {op}: {old}\n                 -> {new}")
    print(f"\n{differ} of {len(rows)} document(s) differ.")
    return differ


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--base", default="HEAD", help="git commit whose converter is the baseline")
    ap.add_argument("--golden", help="compare with approved outputs in this folder instead")
    ap.add_argument("--save-golden", help="write the working tree's outputs here as approved")
    ap.add_argument("--list", help="a file of PDF paths, one a line")
    ap.add_argument("--only", help="a regular expression the PDF path must match")
    ap.add_argument("--show", type=int, default=0, help="changes to print in context per document")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--maps", action="store_true", help="check every traceable map's quotations against both")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    work = Path(tempfile.mkdtemp(prefix="extraction-regression-"))
    if args.maps:
        try:
            if args.golden:
                sys.exit("--maps compares two converters; give --base, not --golden")
            sha, pkg = package_at(args.base)
            print(f"against the converter at {sha[:10]} ({args.base})")
            return 1 if run_maps(args, lambda p: convert(p, pkg, CACHE / sha / "out" / key_of(p)),
                                 lambda p: convert(p, PKG.parent, work / key_of(p))) else 0
        finally:
            shutil.rmtree(work, ignore_errors=True)
    pdfs = pdfs_from(args)
    if not pdfs:
        sys.exit("no PDFs: the fixtures are missing, and no list or private corpus was given")
    try:
        # The working tree's outputs, converted afresh every run.
        with ThreadPoolExecutor(args.jobs) as ex:
            new = list(ex.map(lambda p: convert(p, PKG.parent, work / key_of(p)), pdfs))
        if args.save_golden:
            dest = Path(args.save_golden)
            dest.mkdir(parents=True, exist_ok=True)
            index = {}
            for p, (md, log) in zip(pdfs, new):
                k = key_of(p)
                (dest / f"{k}.md").write_text(md or "", encoding="utf-8")
                (dest / f"{k}.log").write_text(log, encoding="utf-8")
                index[k] = p
            (dest / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
            print(f"approved {len(pdfs)} output(s) in {dest}")
            return 0
        if args.golden:
            g = Path(args.golden)
            old = [((g / f"{key_of(p)}.md").read_text(encoding="utf-8") if (g / f"{key_of(p)}.md").exists() else None,
                    (g / f"{key_of(p)}.log").read_text(encoding="utf-8") if (g / f"{key_of(p)}.log").exists() else "")
                   for p in pdfs]
            print(f"against the approved outputs in {g}, {len(pdfs)} PDF(s):\n")
        else:
            sha, pkg = package_at(args.base)
            with ThreadPoolExecutor(args.jobs) as ex:
                old = list(ex.map(lambda p: convert(p, pkg, CACHE / sha / "out" / key_of(p)), pdfs))
            print(f"against the converter at {sha[:10]} ({args.base}), {len(pdfs)} PDF(s):\n")
        rows = [(os.path.basename(p), compare(parts(a[0]), parts(b[0]), args.show),
                 plain_fallback(a[1]), plain_fallback(b[1])) for p, a, b in zip(pdfs, old, new)]
        differ = report(rows, args.show)
        return 1 if (args.golden and differ) else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


def self_test():
    """The comparison itself, on planted text: a page marker moving is not a change; a word, a
    heading, a note and the abstract are."""
    fails = 0

    def check(name, got, want):
        nonlocal fails
        ok = got == want
        fails += not ok
        print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n          got {got!r} want {want!r}"))

    A = ("---\nabstract: >-\n  One two three four.\n---\n\n<!-- p.1 begins here -->\n\n# Intro\n\n"
         "The body runs on here.\n\n<!-- p.2 begins here -->\n\nAnd on.\n\n[^1]: A note.\n")
    moved = A.replace("<!-- p.2 begins here -->\n\nAnd on.", "And <!-- p.2 begins here --> on.")
    check("a page marker moving is not a change", compare(parts(A), parts(moved))["changed"], 0)
    d = compare(parts(A), parts(A.replace("runs on", "runs off").replace("# Intro", "# Introduction")
                                  .replace("[^1]: A note.", "").replace("three four", "three")), 2)
    check("a changed word is counted", d["changed"] >= 1, True)
    check("  a heading gained and lost is named", (d["heads_gained"], d["heads_lost"]),
          (["# Introduction"], ["# Intro"]))
    check("  and the notes and the abstract are compared", (d["notes"], d["abstract"]), ((1, 0), (4, 3)))
    check("a fallback to the plain route is seen", plain_fallback("! structured route kept only ... "
                                                                  "so the plain route is used instead"), True)
    print(f"\n{fails} FAILED" if fails else "\nall passed")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
