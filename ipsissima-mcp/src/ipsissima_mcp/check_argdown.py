#!/usr/bin/env python3
"""Validate an .argdown file and report on the structure it actually produces.

Running the CLI only tells you the file parses. This additionally answers the
questions that catch real mistakes:

  * does it parse, and how big is the resulting map?
  * are there DISCONNECTED nodes (a claim wired to nothing)?
  * which nodes are TERMINAL (supporting nothing) -- the apex should be the
    main contention, and a long terminal list usually means loose framing
    material that was never attached;
  * do any SECTION HEADINGS contain a symbol shortcode that Argdown silently
    rewrites (`III.A.` becomes `III` + the "for all" sign, which then breaks
    every `selectedSections` and `folded=` reference to it);
  * how many nodes survive each selection mode, so the fold-up view can be
    checked rather than assumed.

Connectivity is measured on the DOT export, NOT the JSON. The JSON `relations`
array omits edges implied by a premise-conclusion structure, so an orphan check
run against the JSON reports every premise of every argument as an orphan.

TWO READERS, TWO OUTPUTS. The prose report is written for a person reading it
once. A check-and-fix loop is a different reader -- it has the map in context
already and needs to know which line to change -- so `--only-problems` and
`--format json` drop the census and print the faults, each with its location and,
where the checker can work one out, the correction itself. Measured on the Darwin
sample: 682 words and 4.6s becomes 372 words and 2.0s.

BUT THE LOOP WANTS THE CENSUS TOO, AND WAS PAYING A WHOLE ROUND TRIP FOR IT.
Dropping the census from json made the reconstructors run the command TWICE on
the same unchanged file: once with `--format json` for the faults, once without
for the apex, the tags, the contribution and the fidelity counts, which are facts
about the finished map that a fix loop plainly wants. Measured across five runs:
between two and three times as many checker invocations as distinct file states,
6 to 10 wasted round trips per reconstruction. So `--format json` now carries the
census as well, under `census`, and the second call is simply unnecessary. It is
the same text the prose report prints, not a re-rendering of it, so the two cannot
drift apart. 3.2 KB on Darwin and 6.4 KB on the largest map in the corpus -- far
less than a round trip costs. `--no-census` turns it off for a caller that really
only wants the faults.

Usage:
    python3 check_argdown.py FILE.argdown [--cli PATH_TO_ARGDOWN]
    python3 check_argdown.py FILE.argdown --source-root DIR --format json
"""

import argparse
import contextlib
import copy
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter

#: THE PARSER'S OWN TABLE, all twelve. Four were missing -- `.^.` `.v_.` `.<>.` `.[].` -- and
#: the editor's linter was missing the same four, so a heading containing one was rewritten and
#: neither implementation said a word. Read them out of `RUN.model.shortcodes` after a parse if
#: this ever needs checking again; there are 40 in total, the rest being emoji.
SHORTCODES = {".A.": "∀", ".E.": "∃", ".~.": "¬", ".v.": "∨",
              ".->.": "→", ".<->.": "↔", ".P.": "\U0001d5e3",
              ".O.": "\U0001d5e2", ".^.": "∧", ".v_.": "⊻",
              ".<>.": "◇", ".[].": "◻"}

MODES = ["all", "with-title", "with-relations", "with-more-than-one-relation",
         "top-level", "not-used-in-argument"]

#: The parser bundled into this package: one self-contained file, run with `node`. Shipping it
#: is what lets the server be installed on its own -- before it, using the checker meant cloning
#: the repository and running `npm install` in `app/`, a directory with nothing to do with it.
BUNDLED_CLI = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "vendor", "argdown-cli.mjs")

#: A real Argdown CLI in a source checkout. Still accepted, no longer required.
DEFAULT_CLI = ("app/node_modules/.bin/argdown")

# ---------------------------------------------------------------- findings ---- #
# WHY THIS EXISTS AT ALL. The prose report is written for a person reading it once. The
# check-and-fix loop is a different reader: a model that has just written a map, has the whole
# thing in context already, and needs to know WHICH LINE to change. Handing it 700 words of
# census every round is how a fix loop comes to cost more than the reconstruction did -- and,
# worse, a report that opens with what is right invites rewriting what is wrong from scratch.
#
# So every fault the run detects is also recorded here, structured, with the location and -- as
# often as the checker can manage it -- the correction itself. `--format json` prints these and
# nothing else. The prose is unchanged for the human who wants it.
#
# `severity` is the existing convention of this file made explicit: `!` was always a fault and
# `?` always a thing to look at.
FINDINGS = []

#: What the run found out about the map's shape, for the ledger.
SHAPE = {"parsed": True}

# Value sets a fix has to choose from, collected once rather than restated on every finding that
# needs them. Printed at the foot of the short report and carried in the JSON envelope.
VOCABULARY = {}


def finding(check, severity, message, **where):
    """Record a fault. `where` carries whatever locates it: line, title, chapter, fix."""
    FINDINGS.append(dict(check=check, severity=severity, message=message,
                         **{k: v for k, v in where.items() if v is not None}))


# ------------------------------------------------------------------ ledger ---- #
# WHY A LOG AT ALL. The question "which mistakes does a model actually make writing Argdown"
# cannot be answered from the corpus, because every map in the corpus passed before it was
# committed. The failures happen in the fix loop and are then edited away, leaving no trace, so
# the evidence for improving the instructions is destroyed by the very process that would use
# it. One line per run, appended, is enough to recover it.
#
# NO CONTENT, ever -- the basename, the counts, and the check names. The ledger lives outside
# any repository so it survives a clone and is never committed by accident.
LEDGER = os.environ.get("IPSISSIMA_CHECK_LOG") or os.path.join(
    os.path.expanduser("~"), ".ipsissima", "check-log.jsonl")


def record(path, elapsed, nodes=None, edges=None, parsed=True):
    """Append one run to the ledger. Never raises: a log that breaks a check is worse than none."""
    if str(LEDGER).lower() in ("off", "0", "none", ""):
        return
    try:
        import hashlib
        with open(path, "rb") as fh:
            digest = hashlib.sha1(fh.read()).hexdigest()[:12]
        counts = {}
        for f in FINDINGS:
            counts[f"{f['severity']} {f['check']}"] = counts.get(f"{f['severity']} {f['check']}", 0) + 1
        os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
        with open(LEDGER, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({
                "at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
                "file": os.path.basename(path),
                # The content hash is what makes ROUNDS visible: the same name with a new hash
                # is the next round of one fix loop, and the same hash twice is a re-run.
                "sha": digest,
                "elapsed": round(elapsed, 2),
                "parsed": parsed, "nodes": nodes, "edges": edges,
                "faults": sum(1 for f in FINDINGS if f["severity"] == "!"),
                "looks": sum(1 for f in FINDINGS if f["severity"] == "?"),
                "checks": counts,
            }, ensure_ascii=False) + "\n")
    except Exception:
        pass


def find_node():
    """A `node` binary, whether or not this process has a login shell's PATH.

    IT USUALLY DOES NOT. The server's ordinary home is a desktop application that launched it,
    and a GUI process on macOS inherits launchd's PATH -- `/usr/bin:/bin:/usr/sbin:/sbin` -- not
    the one your terminal has. Homebrew puts node in `/opt/homebrew/bin`, which is on neither. So
    `shutil.which("node")` returns None on a machine with a perfectly good Node, and the honest
    error message that follows tells the user to install what they already have. Measured on this
    machine before it was written, with the PATH a GUI app actually gets.

    The same trap, for cargo, is documented in app/desktop/rust-path.mjs. Version managers are
    searched last and newest-first: they are the least likely to be the only Node present and the
    most likely to hold several.
    """
    found = shutil.which("node")
    if found:
        return found

    names = ("node.exe", "node") if os.name == "nt" else ("node",)
    fixed = ["/opt/homebrew/bin",                        # Homebrew, Apple Silicon
             "/usr/local/bin",                           # Homebrew on Intel; nodejs.org installer
             "/usr/bin", "/opt/local/bin",               # distributions, MacPorts
             r"C:\Program Files\nodejs",                 # the Windows installer
             os.path.join(os.path.expanduser("~"), ".volta", "bin"),
             os.path.join(os.path.expanduser("~"), ".asdf", "shims")]
    for d in fixed:
        for n in names:
            cand = os.path.join(d, n)
            if os.path.exists(cand):
                return cand

    # nvm and fnm keep one directory per installed version; take the highest, by version rather
    # than by string, so that 20 does not lose to 8.
    import glob
    pools = [os.path.join(os.path.expanduser("~"), ".nvm", "versions", "node", "*", "bin"),
             os.path.join(os.path.expanduser("~"), ".local", "share", "fnm", "node-versions",
                          "*", "installation", "bin")]

    def version_key(d):
        m = re.search(r"v?(\d+)\.(\d+)\.(\d+)", d)
        return tuple(int(g) for g in m.groups()) if m else (0, 0, 0)

    for pool in pools:
        for d in sorted(glob.glob(pool), key=version_key, reverse=True):
            for n in names:
                cand = os.path.join(d, n)
                if os.path.exists(cand):
                    return cand
    return None


def find_cli(explicit):
    """How to run Argdown, as an argv prefix.

    A TUPLE RATHER THAN A PATH, because the answer is now usually two words. The parser that
    ships with this package is a JavaScript file, so running it is `node .../argdown-cli.mjs`
    and not an executable of its own. A tuple is also hashable, which `export_json` needs.

    THE BUNDLED COPY IS PREFERRED even in a source checkout that has the real CLI. It is what
    every installed copy will use, so it should be the one exercised by ordinary work rather
    than a path only developers take; `test_argdown_shim.mjs` is where the two are compared.
    """
    if explicit:
        explicit = str(explicit)
        return (_node_or_die(), explicit) if explicit.endswith(".mjs") else (explicit,)

    if os.path.exists(BUNDLED_CLI):
        node = find_node()
        if node:
            return (node, BUNDLED_CLI)

    # A real CLI, for a checkout whose node_modules are installed -- and the fallback when the
    # bundle is present but Node is not, so that the message below is about the right thing.
    for base in (os.getcwd(), os.path.dirname(os.path.abspath(__file__)),
                 os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")):
        cand = os.path.normpath(os.path.join(base, DEFAULT_CLI))
        if os.path.exists(cand):
            return (cand,)
    found = shutil.which("argdown")
    if found:
        return (found,)
    if os.path.exists(BUNDLED_CLI):
        sys.exit("this needs Node to read Argdown files, and none could be found -- not on the "
                 "PATH,\nnor anywhere Node is usually installed.\n"
                 "Install it from https://nodejs.org (any current version), then try again.")
    sys.exit("could not find the argdown CLI; pass --cli")


def _node_or_die():
    node = find_node()
    if not node:
        sys.exit("--cli names a .mjs parser, which needs Node, and there is no `node` on the "
                 "PATH.\nInstall it from https://nodejs.org, then try again.")
    return node


def run(cli, *args):
    return subprocess.run([*cli, *args], capture_output=True, text=True)


def parse_dot(dot):
    nodes, kinds = {}, {}
    # NOT line-anchored. Graphviz puts the FIRST node on the same line as the graph preamble
    # ("graph [bgcolor = ...]  n0 [label=..."), so a `^` here silently drops n0 -- which is the
    # main contention, and its loss made the apex check report nothing at all.
    # `(?<!-> )` keeps the target of an edge ("n2 -> n1 [type=...]") from being read as a node,
    # and requiring `label=` in the attributes is the second guard on the same confusion.
    for m in re.finditer(r"(?<!-> )\b(n\d+)\s*\[([^\n]*?)\];", dot):
        body = m.group(2)
        if "label=" not in body:
            continue
        tt = re.search(r'tooltip="((?:[^"\\]|\\.)*)"', body)
        ty = re.search(r'type="([^"]+)"', body)
        nodes[m.group(1)] = tt.group(1) if tt else "?"
        kinds[m.group(1)] = ty.group(1) if ty else "?"
    edges = re.findall(r"(n\d+)\s*->\s*(n\d+)", dot)
    # Cluster labels are HTML-like: label = <<FONT ...>text</FONT>>;
    clusters = []
    for m in re.finditer(r"subgraph cluster_\d+\s*\{\s*label\s*=\s*<(.*?)>;", dot, re.S):
        inner = re.sub(r"<[^>]*>", "", m.group(1))
        clusters.append(unescape_dot(inner).strip())
    return nodes, kinds, edges, clusters


# The CLI colours its errors for a terminal. A caller reading the JSON is not a terminal, and
# the escape sequences are both noise and a decoding hazard downstream.
ANSI = re.compile(r"\x1b\[[0-9;]*m")


def parser_message(raw):
    """The parser's complaint, without the JavaScript stack behind it.

    THE STACK IS THE BULK AND NONE OF THE SIGNAL. A YAML error inside a metadata block -- the
    mistake a model writing Argdown actually makes -- comes back as three useful lines naming
    the line, the column and the offending character, followed by some 950 characters of
    node_modules paths. Truncating at 1200 kept the noise and sometimes cut the caret line that
    says WHERE. Cutting at the first stack frame keeps the diagnosis and drops the trace.
    """
    text = ANSI.sub("", raw or "").strip()
    cut = re.search(r"\n\s+at\s+\S", text)
    if cut:
        text = text[:cut.start()].rstrip()
    return text[:1200]


def unescape_dot(s):
    return re.sub(r"&#x([0-9A-Fa-f]+);", lambda m: chr(int(m.group(1), 16)), s)


_JSON_CACHE = {}


def export_json(cli, path):
    """The Argdown JSON export, or None. Both provenance sections need it.

    MEMOISED, because five sections of one run each asked for it and each spawned a fresh Node
    process to get an identical answer. Measured on the Darwin map: 12 CLI spawns accounted for
    5.66s of a 6.7s run, and three of them were this function. The key carries the file's mtime
    so a caller that edits between calls -- `--fix` does -- still sees its own writes.
    """
    try:
        stamp = os.stat(path).st_mtime_ns
    except OSError:
        stamp = None
    key = (cli, path, stamp)
    if key not in _JSON_CACHE:
        with tempfile.TemporaryDirectory() as td:
            r = run(cli, "json", path, "--outputDir", td)
            files = ([f for f in os.listdir(td) if f.endswith(".json")]
                     if r.returncode == 0 else [])
            if not files:
                _JSON_CACHE[key] = None
                return None
            with open(os.path.join(td, files[0]), encoding="utf-8") as fh:
                _JSON_CACHE[key] = json.load(fh)
    # A COPY EVERY TIME, because callers mutate what they get: `apply_defaults` writes the
    # frontmatter's defaults onto every statement in place. Before memoising, each caller held
    # its own freshly-parsed document and could not see another's edits; handing out the cached
    # object would quietly make the second caller's view depend on what the first one did.
    return copy.deepcopy(_JSON_CACHE[key])


def coverage_report(cli, path, source_root=None):
    """Can this map support the exposition-order and Order views at all?

    `chapter` is what lets a claim be placed in the manuscript; `section` is what lets it be
    refined from the top of a section to the paragraph it came from. A map missing them is not
    broken -- it simply cannot answer any question about where the argument sits in the text,
    and that is far cheaper to hear now than after the reconstruction is finished.
    """
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import argdown_provenance as prov
    except ImportError:
        return
    doc = export_json(cli, path)
    if doc:
        prov.apply_defaults(doc, prov.read_frontmatter(path))
    if not doc:
        return
    merged = prov.merged_statements(doc)
    if not merged:
        return
    have_ch = sum(1 for r in merged.values() if r["data"].get("chapter"))
    pinned = set()
    if source_root:
        pinned = {q["title"] for q in prov.check_quotations(doc, source_root)
                  if q["status"] == "exact"}
    have_sec = sum(1 for t, r in merged.items()
                   if r["data"].get("section") or t in pinned)
    n = len(merged)
    # `section` IS NO LONGER REQUIRED, and saying otherwise sends a reader off to add editorial
    # headings to a source that should not have them. A claim with a chapter is now located by
    # searching the whole file when it has neither section nor quotation; section only narrows a
    # search, and a verified quotation finishes it outright.
    print(f"\n   PROVENANCE COVERAGE: {have_ch}/{n} claims cite a chapter"
          + (f", {len(pinned)} pinned by a verified quotation" if pinned else "")
          + (f", {have_sec - len(pinned)} narrowed by a section"
             if have_sec > len(pinned) else ""))
    if not have_ch:
        finding("provenance-coverage", "!",
                "no claim cites a chapter, so the map cannot be placed in any text: the "
                "exposition-order view and the Order tab will both be unavailable",
                fix='add a `defaults:` block to the frontmatter with chapter: "source/<file>.md"')
        print("      ! no claim can be placed in a text. The exposition-order view and the")
        print("        Order tab will both be unavailable. Add {chapter: \"...\", "
              "section: \"...\"}")
        print("        as you reconstruct -- retro-fitting it means re-reading the source.")
    elif have_ch < n:
        missing = [t for t, r in merged.items() if not r["data"].get("chapter")]
        for t in missing:
            finding("provenance-coverage", "!",
                    "claim cites no chapter and will sit in the no-position lane", title=t)
        print(f"      ! {len(missing)} claims carry no chapter and will sit in the "
              f"no-position lane:")
        for t in missing[:8]:
            print(f"           {t[:66]}")
        if len(missing) > 8:
            print(f"           … and {len(missing) - 8} more")
    else:
        print("      every claim can be placed. See TEXT POSITIONS below for how precisely: a")
        print("      quotation gives an exact line, everything else is located to a paragraph")
        print("      by matching the claim's own words against the source.")

    # ---- and the cited files have to EXIST ------------------------------- #
    # COUNTING THE STRING WAS NOT CHECKING THE PATH. Everything above asks whether a claim
    # carries a `chapter`; nothing above asks whether that chapter is anywhere. The only code
    # that ever opened a cited file was the quotation check, which runs on quoted spans only --
    # so a map whose claims are all paraphrase and interpretation cited a file nobody opened,
    # and came back `ok` with no findings at all. One `defaults:` line satisfies coverage for a
    # whole map, and it is exactly the line new_reconstruction.py teaches people to write, so
    # the cheapest way to pass was to write a path and never look at it.
    #
    # WHY IT RUNS WITHOUT --source-root. A missing file is a fault in the map whether or not
    # anyone asked for the quotations to be verified, and refusing to look for it until a flag
    # is passed makes the silence conditional on the caller remembering. With no root given,
    # resolve against the .argdown's own directory -- the layout new_reconstruction.py builds
    # and every sample in this repository uses.
    #
    # ONE STAT PER DISTINCT CHAPTER, not per claim: a map cites one or two files and a hundred
    # claims, and a hundred identical findings is not a report.
    if have_ch:
        root = source_root or os.path.dirname(os.path.abspath(path))
        cited = {}
        for t, r in merged.items():
            ch = r["data"].get("chapter")
            if ch:
                cited.setdefault(ch, []).append(t)
        missing = {ch: ts for ch, ts in cited.items()
                   if not os.path.isfile(os.path.join(root, ch))}
        if missing:
            for ch, ts in sorted(missing.items()):
                finding("chapter-missing", "!",
                        f"{len(ts)} claim(s) cite `{ch}`, which is not a file: nothing in this "
                        f"map can be checked against the text it says it is a reading of",
                        chapter=ch, resolved=os.path.join(root, ch),
                        fix=("correct the `chapter:` path, or extract the source to where it "
                             "points" if source_root else
                             "pass --source-root DIR if the sources live outside the .argdown's "
                             "own folder; otherwise correct the `chapter:` path, or extract the "
                             "source to where it points"))
            print(f"\n   CITED FILES: {len(missing)} of {len(cited)} cited chapter(s) do not "
                  f"exist" + ("" if source_root else " (resolved beside the .argdown; pass "
                                                      "--source-root if they live elsewhere)"))
            for ch, ts in sorted(missing.items())[:6]:
                print(f"      ! {ch} — cited by {len(ts)} claim(s), no such file")
                print(f"           looked in {os.path.join(root, ch)}")
        else:
            print(f"\n   CITED FILES: all {len(cited)} exist.")


def quotation_context_report(prov, doc, source_root, quotes):
    """What each verbatim quotation was taken away from.

    VERBATIM IS NOT THE SAME AS FAITHFUL, and the gap between them is the whole reason this
    section exists. Stern's four illustrations of "misreporting" quote accurately in three
    cases out of four; all three would pass the check above. What makes them misreports is
    entirely a matter of what the span was cut away FROM -- an author's own correction left
    just outside the quotation marks, a quantifier dropped from the front, a term imported
    that the passage never uses.

    So nothing here is a verdict on a quotation. Each line is a fact about where the span sits
    in its own sentence, printed so the reconstructor can look at what they cut. A quotation
    that runs to the end of its sentence says nothing at all, which is most of them.
    """
    ctx = prov.quotation_context(doc, source_root, quotes)
    if not ctx:
        return
    flagged = [c for c in ctx
               if c["dropped"] or c["continues"] or c["gap"] or c["absent_terms"]]
    whole = sum(1 for c in ctx if c["complete"])
    inside = len(ctx) - whole
    print(f"\n   QUOTATION CONTEXT ({len(ctx)} verbatim span{'' if len(ctx) == 1 else 's'}: "
          f"{whole} run{'s' if whole == 1 else ''} to the end of "
          f"{'its' if whole == 1 else 'their'} own sentence, "
          f"{inside} stop{'s' if inside == 1 else ''} inside one)")
    if not flagged:
        print("      nothing sits against any of them -- no dropped qualifier, no continuation")
        print("      that corrects them, no oversized elision.")
        return
    print("      Verbatim is not the same as faithful: what a span was cut away from cannot be")
    print("      checked by matching it. These are facts about the cut, not verdicts.")
    for c in sorted(flagged, key=lambda c: c["title"]):
        # STERN'S CASES, IN THE MACHINE-READABLE FORM TOO. These are the findings this project
        # most wants a reader to act on -- a quotation can be verbatim and still misreport --
        # and reporting them only in the prose meant `--format json` came back `ok` on a map
        # carrying four of them.
        bits = []
        if c["dropped"]:
            bits.append(f'a leading "{c["dropped"]}" sits just outside the quotation')
        if c["continues"]:
            bits.append(f'the sentence continues against it: "{c["continues"][:90]}"')
        if c["gap"]:
            bits.append(f"the elision bridges {c['gap']} characters of source")
        if c["absent_terms"]:
            bits.append("marked `quotation`, but these words of the claim are not in the cited "
                        "file: " + ", ".join(c["absent_terms"][:5]))
        finding("quotation-context", "!", "; ".join(bits), title=c["title"],
                sentence=c["sentence"][:200],
                fix=("widen the quotation to take in what it was cut away from, or mark the "
                     "claim `paraphrase` and say in a `note:` what was left out"))
        print(f"      ! [{c['title']}]")
        if c["dropped"]:
            print(f"           a leading \u201c{c['dropped']}\u201d sits just OUTSIDE the "
                  f"quotation")
        if c["continues"]:
            print(f"           the sentence continues against it: "
                  f"\u201c{c['continues'][:78]}\u201d")
        if c["gap"]:
            print(f"           the elision bridges {c['gap']} characters of source")
        if c["absent_terms"]:
            n = len(c["absent_terms"])
            print(f"           marked `quotation`; {n} word{'' if n == 1 else 's'} of the claim "
                  f"{'is' if n == 1 else 'are'} not in the cited file: "
                  f"{', '.join(c['absent_terms'][:5])}")
        print(f"           source: {c['sentence'][:88]}")
        if c.get("sentence_last"):
            print(f"              ...: {c['sentence_last'][:88]}")


def pcs_shapes(doc):
    """PURE: premise-conclusion structures whose shape is usually a slip.

    WHY THIS EXISTS. The map now draws the premises of one inference step gathered onto a bar,
    which asserts that they stand or fall together. That assertion comes from the FILE, not from
    anything the tool discovered -- so the moment the bar went in, a badly-shaped PCS started
    making a claim about the argument rather than just looking untidy. These are the shapes that
    are almost always a mistake, and each is reported as a question, because each has a rare
    legitimate reading.

    Deliberately NOT checked here:
      * a PCS with no `----` at all -- Argdown itself rejects that ("Missing inference"), and
        the syntax errors are already reported above.
      * an argument nothing uses -- the apex and disconnected-node lists already say so, and a
        second voice saying it would be noise.

    Returns {"thin": [...], "unfilled": [...], "repeated": [...]}, each a list of tuples ready
    to print.
    """
    out = {"thin": [], "unfilled": [], "repeated": [], "diverged": [], "undeclared": []}
    stmts = doc.get("statements") or {}

    def has_text(title):
        rec = stmts.get(title) or {}
        return any((m.get("text") or "").strip() for m in rec.get("members", []))

    for title, arg in (doc.get("arguments") or {}).items():
        pcs = arg.get("pcs") or []
        if not pcs:
            continue
        run, first, step = [], True, 1
        prev_concl = None
        declared_anywhere = False
        for n, entry in enumerate(pcs, start=1):
            if entry.get("role") == "premise":
                run.append((n, entry.get("title")))
                continue
            # A step's inputs are its own premises plus, after the first step, the conclusion
            # the step before it reached -- UNLESS the file says otherwise. `-- {uses: [1,3]} --`
            # names the lines outright, and a declaration beats a position: the map draws the
            # declared set onto one bar, so the checker has to measure the same set the reader
            # is shown. Position is still what fills in when nothing is declared.
            positional = [x for x, _ in run] + ([prev_concl] if not first and prev_concl else [])
            declared = ((entry.get("inference") or {}).get("data") or {}).get("uses")
            declared = [int(u) for u in declared] if isinstance(declared, list) else None
            if declared is not None:
                declared_anywhere = True
                if sorted(declared) != sorted(positional):
                    # WHAT THE FILE SAYS AGAINST WHAT ITS SHAPE SAYS. Not an error -- reaching
                    # back past the run is exactly what `uses` is for -- but the two readings
                    # differ, and a premise the declaration drops keeps its positional step
                    # rather than vanishing, so the reader should be told which lines moved.
                    orphans = [x for x in positional if x not in declared]
                    out["diverged"].append((title, step, entry.get("title"),
                                            sorted(declared), sorted(positional), orphans))
            inputs = len(declared) if declared is not None else len(positional)
            if inputs <= 1:
                out["thin"].append((title, step, entry.get("title"), len(run), first))
            seen, dupes = set(), []
            for _, t in run:
                if t in seen and t not in dupes:
                    dupes.append(t)
                seen.add(t)
            for t in dupes:
                out["repeated"].append((title, step, t))
            prev_concl = n
            run, first, step = [], False, step + 1
        # A single-step structure has nothing to declare: everything above the bar feeds the
        # conclusion below it. From two steps up, silence leaves the inputs to be guessed.
        if step - 1 > 1 and not declared_anywhere:
            out["undeclared"].append((title, step - 1))
        for entry in pcs:
            if entry.get("role") == "premise" and not has_text(entry.get("title")):
                out["unfilled"].append((title, entry.get("title")))
    return out


#: Wording that marks a claim as a CONDITION ON THE QUESTION BEING REACHABLE rather than a reason
#: to believe the answer. Deliberately narrow. `unless` and `provided that` are not here: they are
#: ordinary English and would fire on half a philosophy paper, and a check that cries wolf on a
#: hundred claims teaches the reader to skip it.
PRECONDITION = re.compile(
    r"\b(precondition|prerequisite|condition precedent"
    # JURISDICTION AND STANDING ONLY. `power` and `authority` were here and had to go: "Music
    # has the power to express feeling that cannot be captured in words" is not a jurisdictional
    # precondition, and it was the check's only hit on the whole corpus. A term that is legal
    # jargon in one register and ordinary English in another cannot carry this test.
    r"|(?:no|has|have|had|lacks?|lacked|without)\s+(?:the\s+)?(?:jurisdiction|standing)\s+to"
    r"|jurisdiction\s+to\s+(?:hear|entertain|decide|adjudicate)"
    r"|standing\s+to\s+(?:sue|bring|challenge)"
    r"|(?:must|has to)\s+(?:first|be\s+satisfied)"
    r"|only\s+(?:then|if)\s+(?:can|does|is|may)"
    r"|before\s+(?:the\s+)?(?:court|question|issue)\s+\w+\s+(?:be|can))\b", re.I)


def preconditions_as_support(doc):
    """PURE: support relations whose supporting claim reads as a PRECONDITION.

    THE THIRD JOB `<+` IS DOING. Argdown has one support arrow and it carries at least three
    different things: a reason a reader can weigh, an authority that binds whatever anyone thinks
    of it, and a condition that must hold before the question can be reached at all. The first is
    what the arrow means. The second is now marked with `#authority` on the cited proposition.
    This is the third, and it is a MODELLING error rather than a notation gap: a precondition is a
    premise of the step it conditions, not a reason hanging off the step's conclusion. Drawn as a
    bare support it says the court was more likely to be right because it had jurisdiction, which
    is not what anybody means.

    WHY THIS CAN BE CHECKED AT ALL. The JSON's `relations` omits edges implied by a
    premise-conclusion structure -- the checker's own census says so -- so a support relation
    appearing here is by construction a HANGING support and not a premise already inside a PCS.
    The check therefore never fires on a precondition that has been modelled correctly.

    Reported as a question, never a fault. The wording test is a guess about meaning, and there
    are real supports that talk this way: a claim ABOUT whether a precondition was met is a
    perfectly ordinary reason.
    """
    # The same local import every other consumer of provenance here uses: this module is run as a
    # script from several directories, so the sibling is found by path rather than by package.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import argdown_provenance as prov
    except ImportError:
        return []
    nodes = prov.merged_nodes(doc)
    out = []
    for rel in doc.get("relations") or []:
        if rel.get("relationType") != "support":
            continue
        src = rel.get("from")
        text = (nodes.get(src) or {}).get("text") or ""
        hit = PRECONDITION.search(text)
        if hit:
            out.append((src, rel.get("to"), hit.group(0)))
    return out


def precondition_report(doc):
    """Print what `preconditions_as_support` found. Silent when there is nothing."""
    found = preconditions_as_support(doc)
    if not found:
        return
    print(f"\n   SUPPORTS THAT READ AS PRECONDITIONS ({len(found)})")
    print("      A precondition is not a reason. `<+` says this claim gives you ground to believe")
    print("      the one above it; a condition on whether the question can be asked at all says")
    print("      something else, and Argdown draws them identically. Where the condition really is")
    print("      part of the step, it belongs among that step's PREMISES rather than hanging off")
    print("      its conclusion. Where the reading is genuinely that the condition supports the")
    print("      claim, leave it and say so in a note.")
    for src, dst, phrase in found:
        finding("precondition-as-support", "?",
                f"supports [{dst}] with wording that reads as a condition on the question rather "
                f"than a reason for the answer ({phrase!r})",
                title=src,
                fix="move it into the premise-conclusion structure of the step it conditions, or "
                    "keep it and record in a `note:` why it is a reason and not a precondition")
        print(f"      ? [{src[:40]}] -> [{str(dst)[:40]}]  ({phrase})")


def _formalization(doc, entry):
    """A line's formalization, from the line or from the statement the line refers to.

    `(2) [The advice was unlawful]` is a REFERENCE and carries no inline data of its own.
    Ipsissima's house style defines a claim once and refers to it, so reading only the line
    found nothing at all on the first real map this was pointed at.
    """
    own = (entry.get("data") or {}).get("formalization")
    if isinstance(own, str) and own.strip():
        return own
    title = entry.get("title")
    rec = ((doc.get("statements") or {}).get(title)
           or (doc.get("arguments") or {}).get(title) or {})
    for m in rec.get("members") or []:
        f = (m.get("data") or {}).get("formalization")
        if isinstance(f, str) and f.strip():
            return f
    f = (rec.get("data") or {}).get("formalization")
    return f if isinstance(f, str) and f.strip() else None


def validity_checks(doc):
    """Steps that NAME an inference rule, and whether the conclusion actually follows.

    THE RULE NAME IS THE TRIGGER, and that is the whole design. `reconstruction-cheatsheet.md`
    is emphatic that most philosophical argument is CONDUCTIVE -- independent considerations
    weighed, premises that do not entail the conclusion -- so a validity check run over every
    step would report most good reconstructions as invalid for failing to be something they
    never claimed to be. A bare `-----` claims nothing. `-- Modus ponens --` claims deductive
    validity, and is the only thing here that invites the test.

    Decided by `validity.py`, whose JS twin decides the same thing in the page as somebody
    edits. See `docs/VALIDITY-PLAN.md`.
    """
    # The same local import every other sibling here uses: this module is run as a script at
    # least as often as it is imported, and `from .validity import` fails outright when it is.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from validity import check_step

    out = {"invalid": [], "unformalized": [], "idle": [], "inconsistent": [], "undecided": []}
    for title, arg in (doc.get("arguments") or {}).items():
        pcs = arg.get("pcs") or []
        if not pcs:
            continue
        run, first, step, prev = [], True, 1, None
        for n, entry in enumerate(pcs, start=1):
            if entry.get("role") == "premise":
                run.append(n)
                continue
            inf = entry.get("inference") or {}
            rules = inf.get("inferenceRules") or []
            declared = (inf.get("data") or {}).get("uses")
            positional = list(run) + ([prev] if not first and prev else [])
            inputs = ([int(u) for u in declared] if isinstance(declared, list) else positional)
            if rules:
                named = ", ".join(rules)
                forms = {i: _formalization(doc, pcs[i - 1])
                         for i in inputs if 1 <= i <= len(pcs)}
                concl = _formalization(doc, entry)
                missing = [str(i) for i in inputs if not forms.get(i)]
                if not concl:
                    missing.append("the conclusion")
                if missing:
                    out["unformalized"].append((title, step, named, missing))
                else:
                    r = check_step([forms[i] for i in inputs], concl)
                    if not r["supported"]:
                        out["undecided"].append((title, step, named, r.get("error")))
                    elif not r["valid"]:
                        out["invalid"].append((title, step, named, entry.get("title"),
                                               r["countermodel"]))
                    else:
                        if r.get("irrelevant"):
                            out["idle"].append((title, step,
                                                [inputs[i - 1] for i in r["irrelevant"]]))
                        if r.get("consistent") is False:
                            out["inconsistent"].append((title, step))
            prev = n
            run, first, step = [], False, step + 1
    return out


def validity_report(doc):
    """Print what `validity_checks` found. Silent when no step names a rule."""
    found = validity_checks(doc)
    if not any(found.values()):
        return
    print("\n== NAMED INFERENCE RULES ==")

    if found["invalid"]:
        print(f"\n   THE CONCLUSION DOES NOT FOLLOW ({len(found['invalid'])})")
        print("      The step names a rule, every line carries a formalization, and there is a")
        print("      way for the premises to hold while the conclusion fails. The countermodel")
        print("      below is that way; it is a fact about the formalizations, so if it looks")
        print("      wrong the formalization is where to look first.")
        for title, step, named, concl, cm in found["invalid"]:
            finding("invalid-step", "!",
                    f"step {step} is named `{named}` but its conclusion does not follow from "
                    f"its premises",
                    title=title, conclusion=concl,
                    fix="correct the formalizations, add the premise the step is missing, or "
                        "drop the rule name if the step was never meant to be deductive")
            print(f"      ! <{title}> step {step} (`{named}`) -> [{concl}]")
            print(f"          countermodel: {cm}")

    if found["idle"]:
        print(f"\n   A PREMISE THE STEP DOES NOT NEED ({len(found['idle'])})")
        print("      The step is valid without it. Sometimes that is right -- a premise kept for")
        print("      the reader rather than for the inference -- and sometimes it means the")
        print("      formalization has lost what the premise was actually doing.")
        for title, step, lines in found["idle"]:
            print(f"      ? <{title}> step {step} does not need line(s) {lines}")

    if found["inconsistent"]:
        print(f"\n   PREMISES THAT CANNOT ALL HOLD ({len(found['inconsistent'])})")
        print("      Anything follows from them, so the step is valid for a reason that is not")
        print("      the one the rule name claims.")
        for title, step in found["inconsistent"]:
            print(f"      ! <{title}> step {step}")

    if found["unformalized"]:
        print(f"\n   A RULE NAMED, AND NOTHING TO CHECK IT AGAINST ({len(found['unformalized'])})")
        print("      Naming a rule claims the conclusion follows. Without `formalization:` on")
        print("      every line of the step, that claim is exactly as checkable as the")
        print("      `quotation` markers were before this program started deriving them.")
        for title, step, named, missing in found["unformalized"]:
            print(f"      ? <{title}> step {step} (`{named}`): no formalization on "
                  f"{', '.join(missing)}")

    if found["undecided"]:
        print(f"\n   NAMED, FORMALIZED, AND NOT DECIDABLE HERE ({len(found['undecided'])})")
        print("      Not a verdict about the argument. The formalization is outside the fragment")
        print("      this decides -- see docs/VALIDITY-PLAN.md for what that fragment is.")
        for title, step, named, why in found["undecided"]:
            print(f"      ? <{title}> step {step} (`{named}`): {why}")


def pcs_report(doc):
    """Print what `pcs_shapes` found. Silent when a file has no premise-conclusion structures."""
    found = pcs_shapes(doc)
    if not any(found.values()):
        return
    print("\n== PREMISE-CONCLUSION SHAPES ==")

    if found["thin"]:
        print(f"\n   STEPS WITH ONE INPUT ({len(found['thin'])})")
        print("      An inference bar with a single claim above it links nothing: the step rests")
        print("      on one thing, so the map draws it as a plain arrow and no bar. Sometimes")
        print("      that is right -- a definitional move, or an immediate consequence. More")
        print("      often a premise is missing, and the reconstruction is licensing a step it")
        print("      has not shown the licence for.")
        for title, step, concl, prems, first in found["thin"]:
            how = ("only one premise" if first
                   else "nothing but the conclusion of the step before"
                   if prems == 0 else f"{prems} premise and the step before")
            finding("thin-step", "?",
                    f"inference step {step} rests on {how} -- an inference bar with a single "
                    "claim above it links nothing, so the map draws a plain arrow. Sometimes "
                    "right; more often a premise is missing",
                    title=title, conclusion=concl,
                    fix="add the premise the step actually needs, or drop the bar if the move "
                        "really is immediate")
            print(f"      ? <{title}> step {step} -> [{concl}]: {how}")

    if found["unfilled"]:
        print(f"\n   PREMISES WITH NO TEXT ({len(found['unfilled'])})")
        print("      Referenced in a structure but never written anywhere, so the map draws an")
        print("      empty box and the step rests on a name.")
        for title, prem in found["unfilled"]:
            print(f"      ! <{title}> uses [{prem}], which is defined nowhere")

    if found["repeated"]:
        print(f"\n   A PREMISE LISTED TWICE IN ONE STEP ({len(found['repeated'])})")
        print("      The same claim numbered twice among the premises of a single inference.")
        for title, step, prem in found["repeated"]:
            print(f"      ! <{title}> step {step} lists [{prem}] more than once")

    if found["diverged"]:
        print(f"\n   DECLARED INPUTS DIFFER FROM THE SHAPE ({len(found['diverged'])})")
        print("      The step says `uses` one set of lines; its position in the structure says")
        print("      another. The map follows what is declared, so this is a note rather than a")
        print("      fault -- reaching back past the run is what `uses` is for. But a line the")
        print("      declaration leaves out keeps the step its position gave it rather than")
        print("      dropping off the map, so check that is what was meant.")
        for title, step, concl, declared, positional, orphans in found["diverged"]:
            finding("declared-inputs-differ", "?",
                    f"inference step {step} declares lines {declared} but sits among "
                    f"{positional} -- the map draws the declared set",
                    title=title, conclusion=concl,
                    fix="correct the `uses` list, or leave it if the step really does reach "
                        "past its own run")
            extra = f"; {orphans} left where position put them" if orphans else ""
            print(f"      ? <{title}> step {step} -> [{concl}]: "
                  f"uses {declared}, sits among {positional}{extra}")

    if found["undeclared"]:
        print(f"\n   MULTI-STEP ARGUMENTS THAT DECLARE NOTHING ({len(found['undeclared'])})")
        print("      With one step there is nothing to say. With two or more, the inputs are")
        print("      being read off the order of the lines, which is a guess -- and a wrong one")
        print("      wherever a step reaches back to an earlier premise. Write")
        print("      `-- {uses: [1, 3, 4]} --` so the bar the reader sees is the file's claim.")
        for title, steps in found["undeclared"]:
            print(f"      ? <{title}> has {steps} steps and no `uses` on any of them")


def fidelity_report(cli, path):
    """Whose words, whose reasons, and whose argument -- none of which needs the manuscript.

    Runs on EVERY invocation, unlike the quotation checks: fidelity, warrants and the declared
    reading policy are facts about the .argdown alone, and a reconstruction should be able to
    hear about them while it is still being written.
    """
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import argdown_provenance as prov
    except ImportError:
        return
    doc = export_json(cli, path)
    if not doc:
        return
    prov.apply_defaults(doc, prov.read_frontmatter(path))

    il = prov.interpretive_load(doc)
    census = {k: v for k, v in il["census"].items() if v}
    policy, unknown = prov.reconstruction_policy(path)

    # ---- a value that is not a level, named rather than dropped ----------- #
    # BEFORE THE CENSUS, because a file whose every marker is misspelled has an empty census and
    # returns below having said only "no node carries a marker" -- true of what was counted, and
    # no help at all to the person who wrote `reported` five times.
    #
    # THE ASYMMETRY THIS FIXES. `warrant` answers a value it does not know by printing its
    # vocabulary; `fidelity` answered by ignoring it. So the vocabulary was discoverable by
    # leaving the field out and undiscoverable by guessing at it, which is the wrong way round --
    # a guess is what someone makes when they do not know the list, and silence tells them
    # nothing except that the guess was accepted. Measured cost of that asymmetry on one run:
    # three probe rounds, all silent.
    wrong = prov.bad_fidelity(doc) if hasattr(prov, "bad_fidelity") else []
    if wrong:
        VOCABULARY["fidelity"] = list(prov.FIDELITY_LEVELS)
        print(f"\n   FIDELITY: {len(wrong)} node(s) declare a value that is not a level, so the "
              f"marker is ignored and the claim counts as unmarked:")
        for title, value in wrong:
            finding("fidelity", "!",
                    f"`fidelity: {value}` is not a fidelity level, so the marker is ignored and "
                    f"the claim counts as unmarked",
                    title=title, value=value,
                    fix="use one of: " + ", ".join(prov.FIDELITY_LEVELS))
        for title, value in wrong[:10]:
            print(f"      ! {value:<18} {title[:50]}")
        if len(wrong) > 10:
            print(f"           \u2026 and {len(wrong) - 10} more")
        print("        vocabulary: " + ", ".join(prov.FIDELITY_LEVELS))

    # ---- fidelity census first: it decides whether the rest applies ------- #
    if not census:
        print(f"\n   FIDELITY: no node of {il['total']} carries a marker.")
        print("      Mark at least the departures -- `interpretation` for a reading the text")
        print("      supports but does not state, `imputation` for a premise the argument needs")
        print("      and the author never gives. Until then there is nothing to measure, and")
        print("      the reading policy below is not asked for either.")
        if policy:
            shown = " \u00b7 ".join(f"{k} {policy[k]}" for k in
                                    ("aim", "unit", "mode", "strength") if policy.get(k))
            print(f"   READING POLICY: {shown} (declared, but nothing is marked against it)")
        return
    print(f"\n   FIDELITY: {il['marked']}/{il['total']} nodes marked -- "
          + ", ".join(f"{v} {k}" for k, v in census.items()))

    # ---- nodes carrying no marker at all, which are nearly always arguments --- #
    # A CENSUS IS NOT A CHECK, and this one was only a census. On the rebuilt Tooming 18 of 128
    # nodes carried no fidelity marker and every one was an `<Argument>` -- the count was
    # printed, in prose, on a report the fix loop does not read. So the loop stopped at `ok`
    # with a fifth of the map unmarked and nothing had said so.
    #
    # `?` and not `!`: an argument really can have no marker to give. But assembling premises
    # into a numbered structure is the reconstructor's work even where every step is the
    # author's, so an unmarked argument is far more often forgotten than judged.
    # EXCLUDING THE ONES JUST NAMED. `unmarked` is built on `fidelity_of`, which maps a bad
    # value to None, so without this filter a claim marked `reported` is reported as carrying no
    # marker -- a statement about the file that is not true, and one that sends the reader to add
    # a marker that is already there.
    bare = [t for t in (prov.unmarked(doc) if hasattr(prov, "unmarked") else [])
            if t not in {title for title, _ in wrong}]
    if bare:
        print(f"      {len(bare)} node(s) carry NO fidelity marker:")
        for title in bare[:10]:
            finding("fidelity", "?",
                    "carries no `fidelity` marker. An <Argument> takes one like any other claim, "
                    "and usually should: assembling premises into a numbered structure is the "
                    "reconstructor's work even where every step is the author's",
                    title=title,
                    fix="mark it, or say in a `note:` why none applies")
            print(f"      ? [{title[:64]}]")
        if len(bare) > 10:
            for title in bare[10:]:
                finding("fidelity", "?",
                        "carries no `fidelity` marker", title=title,
                        fix="mark it, or say in a `note:` why none applies")
            print(f"      \u2026 and {len(bare) - 10} more")

    unwarranted, warrants, odd = prov.warrant_gaps(doc)
    if warrants:
        print("      warrants given: "
              + ", ".join(f"{k} {v}" for k, v in sorted(warrants.items())))
    if unwarranted:
        n = len(unwarranted)
        print(f"      ! {n} departure{'' if n == 1 else 's'} from the text "
              f"give{'s' if n == 1 else ''} no `warrant` -- the one-line")
        print("        reason the reading leaves what the text actually says:")
        # ONE LINE EACH, and the vocabulary hoisted out of them. Nine claims missing a warrant
        # is the common case, and repeating the seven permitted values nine times is most of
        # what the caller would be charged for reading the answer.
        VOCABULARY["warrant"] = sorted(prov.WARRANTS)
        for u in unwarranted:
            finding("warrant", "!",
                    f"marked `{u['fidelity']}` -- a departure from the text -- but gives no "
                    f"`warrant` for it",
                    title=u["title"], fidelity=u["fidelity"], fix="add a `warrant:`")
        for u in unwarranted[:10]:
            tail = "" if u["note"] else "   (no note either)"
            print(f"           {u['fidelity']:<14} {u['title'][:40]:42}{tail}".rstrip())
        if n > 10:
            print(f"           \u2026 and {n - 10} more")
        print("        vocabulary: " + ", ".join(sorted(prov.WARRANTS)))
    for o in odd:
        finding("warrant", "?",
                f"carries a `warrant` but is marked `{o['fidelity'] or 'unmarked'}` -- a "
                "warrant explains a DEPARTURE from the text, so either the marker understates "
                "the claim or the warrant is not needed",
                title=o["title"], fidelity=o["fidelity"],
                fix="mark the departure the warrant is for, or drop the warrant")
        print(f"      ? [{o['title']}] carries a warrant but is marked "
              f"`{o['fidelity'] or 'unmarked'}` -- a warrant explains a DEPARTURE")

    # ---- the declared reading policy ------------------------------------- #
    # ASKED FOR ONLY ONCE FIDELITY IS TRACKED. A policy governs how far a reading may depart
    # from someone else's words; a map of the author's own thinking is not yet in that game,
    # and the book map -- 379 nodes, no markers -- was being told to declare a charity policy
    # for its own author's argument.
    if policy:
        shown = " \u00b7 ".join(f"{k} {policy[k]}" for k in
                                ("aim", "unit", "mode", "strength") if policy.get(k))
        print(f"\n   READING POLICY: {shown or '(empty block)'}")
        for k, v in unknown:
            opts = prov.POLICY_VALUES.get(k)
            finding("reading-policy", "?",
                    f"`{k}: {v}` is outside the documented vocabulary",
                    key=k, value=v,
                    fix=(f"use one of: {' | '.join(opts)}" if opts
                         else "check the key against the documented reading policy"))
            print(f"      ? `{k}: {v}` is outside the documented vocabulary"
                  + (f" ({' | '.join(opts)})" if opts else ""))
    else:
        print("\n   READING POLICY: not declared.")
        print("      The same map can be excellent as a report of what a text says and poor as")
        print("      a reading of what it should say. Until the aim is declared there is no")
        print("      fact about which this file is, so nothing can be said about whether the")
        print("      departures below are earned. Add to the front matter:")
        print("         reconstruction:")
        print("             aim: fit            # fit | appropriation")
        print("             unit: meaning       # meaning | commitment")
        print("             mode: coherence     # coherence | truth | soundness | agreement | interest")
        print("             strength: ordinary  # minimal | ordinary | strong")

    # ---- interpretive load ----------------------------------------------- #
    if il["cycles"]:
        print(f"\n      ! SUPPORT CYCLE through {', '.join(il['cycles'][:4])} -- a claim that")
        print("        supports itself by some route. Nothing else here looks for this.")
    cont = il["contentions"]
    if not cont:
        return
    print("\n   INTERPRETIVE LOAD -- of the argument reaching each contention, how much is the")
    print("      reconstructor's own. Zero means SOME route runs on reported material alone; it")
    print("      is not a score, and a reconstruction whose contribution IS a reading should")
    print("      read above zero everywhere.")
    for c in cont:
        if c.get("fidelity") in prov.DEPARTURES:
            print(f"      ! {c['contention'][:30]:30} the CONTENTION ITSELF is marked "
                  f"`{c['fidelity']}`.")
            print(f"      {'':32} Whatever the load below it, this map's conclusion is the")
            print(f"      {'':32} reconstructor's, not the author's.")
        if c["load"] is None:
            print(f"      {c['contention'][:30]:32} -   nothing supports it")
        elif c["load"] == 0:
            print(f"      {c['contention'][:30]:32} 0   a route runs on reported material: "
                  f"{' <- '.join(c['path'][:3])}")
        else:
            print(f"      {c['contention'][:30]:32} {c['load']}   EVERY route passes through the "
                  f"reconstructor")
            print(f"      {'':32}     cheapest: {' <- '.join(c['path'][:4])}")

    held = [c for c in cont if c["load"]]
    if held and (policy or {}).get("aim") == "fit":
        print(f"      ! declared `aim: fit`, but {len(held)} of {len(cont)} contentions cannot be")
        print("        reached without claims the author never made. Under `fit` that is a")
        print("        tension to answer, not a fault -- either the departures are warranted,")
        print("        or the aim is closer to `appropriation` than the block says.")
    elif held and (policy or {}).get("aim") == "appropriation":
        print("      (declared `aim: appropriation`, so a load above zero is the declared "
              "practice.)")

    if il["leaves"]:
        print("      load-bearing assumptions -- a departure from the text that nothing supports")
        print("      and that something rests on, most leaned-on first:")
        for l in il["leaves"][:8]:
            n = l["supports"]
            print(f"           {l['fidelity']:<14} holds up {n:>2} claim{'' if n == 1 else 's'}"
                  f"  {l['title'][:40]}")
        if len(il["leaves"]) > 8:
            print(f"           \u2026 and {len(il['leaves']) - 8} more")
    if il.get("inferences"):
        print(f"      inferences drawn by the reconstructor ({len(il['inferences'])}): "
              + ", ".join(il["inferences"][:6])
              + (" \u2026" if len(il["inferences"]) > 6 else ""))


def provenance_report(cli, path, source_root, fix=None):
    """Verify quotations against their sources, and measure justification debt.

    Both need the manuscript, not just the .argdown, which is why they are opt-in behind
    --source-root rather than part of the default run.
    """
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import argdown_provenance as prov
    except ImportError as e:
        print(f"\n   PROVENANCE: unavailable ({e})")
        return

    with tempfile.TemporaryDirectory() as td:
        r = run(cli, "json", path, "--outputDir", td)
        files = [f for f in os.listdir(td) if f.endswith(".json")] if r.returncode == 0 else []
        if not files:
            print("\n   PROVENANCE: could not export JSON, skipping")
            return
        doc = json.load(open(os.path.join(td, files[0]), encoding="utf-8"))
    prov.apply_defaults(doc, prov.read_frontmatter(path))

    quotes = prov.check_quotations(doc, source_root)
    counts = Counter(q["status"] for q in quotes)
    print(f"\n   QUOTATIONS ({len(quotes)} checked against the sources): "
          + ", ".join(f"{v} {k}" for k, v in counts.most_common()))
    for q in quotes:
        if q["status"] == "exact":
            continue
        # THE FIX FIRST, WHERE THERE IS ONE. A quotation found verbatim in another chapter is
        # not a misquotation at all -- it is a stale path -- and saying so turns a round of
        # "re-read the source and re-quote" into a one-word edit.
        finding("quotation", "!",
                f"quotation does not verify against the source ({q['status']})",
                title=q["title"], quote=q["quote"], chapter=q.get("chapter"),
                detail=q.get("detail"),
                fix=(f'chapter: "{q["moved_to"]}"' if q.get("moved_to") else None),
                found_in=q.get("moved_to"), found_line=q.get("moved_line"))
        print(f"      ! [{q['status']}] {q['title']}")
        print(f"           \u201c{q['quote'][:74]}\u201d")
        print(f"           cites {q['chapter']}")
        if q.get("detail"):
            print(f"           {q['detail'][:92]}")
        # THE CORRECTION, NOT JUST THE COMPLAINT. `chapter:` is a path, and a path is the one
        # thing an edit to the manuscript can break outright: move a section to another file and
        # every claim citing the old one is orphaned. The other chapters are right here, so the
        # answer is too.
        if q.get("moved_to"):
            print(f"           FOUND VERBATIM IN {q['moved_to']}, line {q['moved_line']}")
            print(f"           fix: chapter: \"{q['moved_to']}\"")
    if counts.get("exact") and len(counts) == 1:
        print("      every quotation appears verbatim in the source it cites.")
    moved = [q for q in quotes if q.get("moved_to")]
    if moved:
        files = sorted({q["moved_to"] for q in moved})
        print(f"      {len(moved)} quotation(s) were found in a DIFFERENT chapter "
              f"({', '.join(f[:44] for f in files[:3])}"
              f"{'...' if len(files) > 3 else ''}).")
        print("      That is what moving a section between files looks like: the words are "
              "still in the book,")
        print("      but not in the file the claim names. Correcting `chapter:` restores them.")

    quotation_context_report(prov, doc, source_root, quotes)

    # ---- claims that join distant passages without marking the join -------- #
    splices = prov.spliced_claims(doc, source_root)
    if splices:
        print(f"\n   SPLICED CLAIMS ({len(splices)}) -- say so in a `note:`")
        print("      These join two passages that sit far apart in the source, using mostly the")
        print("      source's own words. That is often a good compression and not a fault: the")
        print("      claim may capture the meaning better than either passage alone. What it")
        print("      should not do is leave a reader to discover the join. Record it in the")
        print("      claim's `note:`, or mark the elision in the text.")
        for title, gap, left, right in splices:
            finding("splice", "?",
                    f"joins two passages {gap} characters apart in the source, using mostly "
                    "the source's own words -- often a good compression, but a reader should "
                    "not have to discover the join",
                    title=title, gap=gap,
                    fix="record the join in the claim's `note:`, or mark the elision in the text")
        for title, gap, left, right in splices[:8]:
            print(f"      ? [{title}] joins passages {gap} characters apart")
            print(f"           \u2026{left}  |  {right}\u2026")
        if len(splices) > 8:
            print(f"      \u2026 and {len(splices) - 8} more")

    # ---- is `quotation` true of the claim, or only of its `source:` field? ---- #
    # DERIVED, NOT TAKEN ON TRUST. `quotation` is the one fidelity level with a fact of the
    # matter, and asking for it produced a marker wrong 38 times in 126 across the reference
    # maps -- almost always in the same direction, because a claim carrying an exact quotation
    # in `source:` feels like a quotation even when its own text is a summary. Clarifying the
    # instruction halved the rate on the next paper and did not remove it, so the field is
    # checked rather than believed.
    over, under = prov.fidelity_disputes(doc, source_root)

    # ---- correcting the file, where nobody has judgement invested in it ---- #
    # A HAND-BUILT reconstruction is someone's work and is never written to without being asked.
    # A GENERATED one is different: the user has nothing invested in whether a given node is a
    # quotation or a paraphrase, and a file that disagrees with the picture built from it
    # confuses more than it informs. So the default follows the file's own declaration.
    policy = (prov.reconstruction_policy(path)[0] or {})
    generated = str(policy.get("generated", "")).lower() in ("true", "yes", "1")
    if fix is None:
        fix = generated
    if fix and (over or under):
        rewrites = prov.fidelity_rewrites(doc, source_root, quotes)
        done = prov.apply_fidelity_rewrites(path, rewrites)
        if done:
            print(f"\n   FIDELITY CORRECTED IN THE FILE ({len(done)} marker(s)"
                  + (", because it declares `generated: true`" if generated and fix else "")
                  + ")")
            for cid in done[:10]:
                was, now = rewrites[cid]
                print(f"      {(was or '(unmarked)'):<14} -> {now:<12} {cid[:44]}")
            if len(done) > 10:
                print(f"      \u2026 and {len(done) - 10} more")
            print("      Re-run to confirm; interpretation and imputation were not touched.")
            return

    if over or under:
        print(f"\n   FIDELITY vs THE SOURCE")
    if over:
        print(f"      ! {len(over)} claim(s) marked `quotation` whose OWN TEXT is not in the "
              f"source.")
        print("        The `source:` field may hold a real quotation; the claim itself is a")
        print("        summary, and a solid border tells a reader otherwise. Mark `paraphrase`:")
        for t in over:
            finding("fidelity", "!",
                    "marked `quotation`, but the claim's own text is not in the source -- the "
                    "`source:` field may hold a real quotation while the claim itself is a "
                    "summary, and the map draws a solid border that tells a reader otherwise",
                    title=t, fix="mark it `paraphrase` or `compression`")
        for t in over[:10]:
            print(f"           {t[:64]}")
        if len(over) > 10:
            print(f"           \u2026 and {len(over) - 10} more")
    if under:
        for t in under:
            finding("fidelity", "?",
                    "the claim's own text IS the source's words, but it declares less than "
                    "`quotation` -- harmless, and sometimes deliberate, but it is free "
                    "precision given up",
                    title=t, fix="mark it `quotation`, unless the understatement is deliberate")
        print(f"      ? {len(under)} claim(s) whose text IS the source's words but which claim "
              f"less.")
        print("        Harmless, and sometimes deliberate — but it is free precision given up:")
        for t in under[:6]:
            print(f"           {t[:64]}")

    pos = prov.text_positions(doc, source_root, quotes)
    prec = Counter(p["precision"] for p in pos.values())
    outside = sorted({(t, p["chapter"]) for t, p in pos.items() if not p["in_book"]})
    print(f"\n   TEXT POSITIONS: {len(pos)} claims placed "
          f"({', '.join(f'{v} by {k}' for k, v in prec.most_common())})")
    if outside:
        files_ = sorted({c for _, c in outside})
        print(f"      ! {len(outside)} claims cite files the manuscript does not list "
              f"in _quarto.yml:")
        for f in files_:
            n = sum(1 for _, c in outside if c == f)
            print(f"           {n:>3} claims  {f}")

    debts, unplaced = prov.justification_debt(doc, source_root, quotes)
    fwd = sorted([d for d in debts if d["chapters"] > 0], key=lambda d: -d["chapters"])
    back = sorted([d for d in debts if d["chapters"] < 0], key=lambda d: d["chapters"])
    same = len(debts) - len(fwd) - len(back)
    # NEITHER DIRECTION IS A FAULT. The standard advice in analytic philosophy is to announce
    # the thesis and argue for it afterwards -- Pryor's writing guide tells students to make the
    # structure obvious and that the reader "shouldn't have to exert any effort to figure it
    # out". On that convention a claim SHOULD precede its support. The older wording here
    # ("debt", "paid later", "outstanding") scored one convention against the other; it now
    # names them instead.
    print(f"\n   ORDER OF EXPOSITION: {len(debts)} support edges placed -- "
          f"{same} within one chapter, {len(fwd)} anticipated (claim first), "
          f"{len(back)} prepared (support first)")
    if fwd:
        print("      reaching furthest -- the claim is stated, its support arrives later:")
        for d in fwd[:8]:
            print(f"        +{d['chapters']:>2} ch  {d['supported'][:34]:36} <- {d['support'][:34]}")
    if back:
        print("      support laid down furthest ahead of the claim it serves:")
        for d in back[:4]:
            print(f"        {d['chapters']:>3} ch  {d['support'][:34]:36} -> {d['supported'][:34]}")
    reaching = len(fwd) + len(back)
    if reaching >= 5:
        share = len(fwd) / reaching
        if share >= 0.75:
            print(f"      -> of the {reaching} that cross a chapter, {len(fwd)} announce the "
                  f"claim first: the roadmap convention.")
            print(f"         The {len(back)} prepared ones are the departures from its own "
                  f"practice.")
        elif share <= 0.25:
            print(f"      -> of the {reaching} that cross a chapter, {len(back)} lay the "
                  f"support down first: the text builds to its claims.")
            print(f"         The {len(fwd)} anticipated ones are the departures from its own "
                  f"practice.")
        else:
            print(f"      -> the text uses both conventions ({len(fwd)} anticipated, "
                  f"{len(back)} prepared).")
    if unplaced:
        print(f"      ({len(unplaced)} claims could not be placed in the text: no chapter, "
              f"or a section heading that does not match)")

    # ---- what earns its place ------------------------------------------- #
    contrib = prov.contribution(doc)
    roles = Counter(c["role"] for c in contrib.values())
    apex = sorted(t for t, c in contrib.items() if c["apex"])
    print(f"\n   CONTRIBUTION: {roles.get('supports', 0)} claims support a contention, "
          f"{roles.get('engages', 0)} engage one by objecting,")
    print(f"      {roles.get('inert', 0)} reach none at all, of {len(contrib)}.")
    print(f"      the contentions are: {', '.join(apex) if apex else '(none found)'}")
    inert = sorted((t for t, c in contrib.items() if c["role"] == "inert"),
                   key=lambda t: (-contrib[t]["load"], t))
    if inert:
        print(f"      ! {len(inert)} claims reach NO contention by any route -- not by "
              f"supporting one, not by")
        print(f"        objecting to one. In a finished argument that is a cut list; in a draft "
              f"it is usually")
        print(f"        material whose place is not settled yet. Largest first, by how much "
              f"rests on them:")
        for t in inert:
            finding("inert", "?",
                    "reaches no contention by any route -- it neither supports one nor objects "
                    "to one, so nothing in the argument depends on it",
                    title=t,
                    fix="attach it to what it bears on, or delete it")
        for t in inert[:12]:
            p = pos.get(t)
            where = (f"{os.path.basename(p['chapter'])[:34]} line {p['line']}"
                     if p and p.get("line") else "unplaced")
            print(f"           {contrib[t]['load']:>3} beneath  {t[:34]:36} {where}")
        if len(inert) > 12:
            print(f"           … and {len(inert) - 12} more")
    else:
        print("      no claim is inert: every one reaches a contention by some route.")

    # The graded version, which is the one that discriminates once nothing is inert.
    steps = Counter(c["dist"] for c in contrib.values() if c["dist"] is not None)
    if steps:
        print("      steps to the nearest contention: "
              + ", ".join(f"{k}:{steps[k]}" for k in sorted(steps)))
        remote = sorted((t for t, c in contrib.items() if (c["dist"] or 0) >= 6),
                        key=lambda t: (-contrib[t]["dist"], -contrib[t]["load"]))
        if remote:
            print(f"      the {len(remote)} most remote (6+ steps out -- doing the least "
                  f"direct work):")
            for t in remote[:8]:
                p = pos.get(t)
                where = (f"{os.path.basename(p['chapter'])[:32]} line {p['line']}"
                         if p and p.get("line") else "unplaced")
                print(f"           {contrib[t]['dist']} steps  {t[:32]:34} {where}")

    gaps = prov.first_use(doc, source_root, quotes)
    long_carry = [g for g in gaps if g["gap"] >= 20]
    if long_carry:
        print(f"\n   CARRIED LONGEST: {len(long_carry)} claims are stated 20+ claims before "
              f"anything draws on them")
        for g in long_carry[:8]:
            print(f"        +{g['gap']:>3} claims  {g['claim'][:34]:36} "
                  f"stated {g['stated']}/{g['total']}, first used {g['first_used']}")


def _parse_args():
    """Read the command line, and serve `--derive-fidelity` if that is all that was wanted.

    Returns (args, cli, path), or (None, None, None) when the run is already finished --
    `--derive-fidelity` is a service for the viewer build, not a report, and answers on stdout
    in its own format.
    """
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--cli")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--fix", dest="fix", action="store_true", default=None,
                    help="correct `quotation`/`paraphrase` markers in the file against the "
                         "source. ON BY DEFAULT for a file declaring `generated: true`, since "
                         "nobody has judgement invested in a marker a model just wrote and a "
                         "file that disagrees with its own picture confuses more than it "
                         "informs. Never touches interpretation or imputation.")
    ap.add_argument("--no-fix", dest="fix", action="store_false",
                    help="never write to the file, even if it declares itself generated")
    ap.add_argument("--derive-fidelity", action="store_true",
                    help="print JSON of the DERIVED fidelity per claim and exit. The viewer "
                         "build calls this so the border it draws is checked rather than "
                         "believed, without a second implementation of the rule in JavaScript.")
    ap.add_argument("--source-root", metavar="DIR",
                    help="the manuscript folder. Enables the provenance checks: verifies every "
                         "quotation against the source it cites, and reports how far each "
                         "claim's support sits from the claim in the text.")
    # ---- the two modes the check-and-fix loop runs in --------------------- #
    ap.add_argument("--format", dest="fmt", choices=("text", "json"), default="text",
                    help="`json` prints the FAULTS ONLY, structured, with a location and a "
                         "suggested fix on each -- for a caller that is going to edit the file "
                         "rather than read a report. Implies --only-problems.")
    ap.add_argument("--only-problems", action="store_true",
                    help="drop the census sections (apex, sections, tags, selection modes, "
                         "debt, contribution) and print just what is wrong. These are what a "
                         "second, third and fourth pass over one file pay for repeatedly.")
    ap.add_argument("--selection-modes", dest="modes", action="store_true", default=None,
                    help="count the nodes surviving each statement-selection mode. Six more "
                         "CLI runs, about 2.8s, and nothing in it can fail -- so it is on for "
                         "a plain run and off whenever the output is being consumed.")
    ap.add_argument("--no-selection-modes", dest="modes", action="store_false")
    ap.add_argument("--no-census", dest="census", action="store_false", default=True,
                    help="omit the census from --format json. The census is there so a fix loop "
                         "need not run the checker a second time on the same file; drop it only "
                         "if you truly want nothing but the faults.")
    a = ap.parse_args()
    if a.fmt == "json":
        a.only_problems = True
    if a.modes is None:
        a.modes = not a.only_problems
    a.quiet = a.only_problems or a.fmt == "json"
    cli = find_cli(a.cli)
    path = os.path.abspath(a.file)

    # ---- 0. the derived-fidelity service, for the viewer build ------------ #
    # ONE IMPLEMENTATION, TWO CALLERS. The renderer needs to know whether a claim's own text is
    # in the source, and asks this rather than working it out again.
    #
    # THE STATED REASON FOR THAT HAS EXPIRED. It read "the rule leans on difflib and has no clean
    # JavaScript equivalent", which described the rule `_is_verbatim` REPLACED -- a 0.75
    # similarity score over a window. The rule now is: fold whitespace and case, strip
    # punctuation, ask whether the claim is a contiguous substring of the source. No difflib.
    #
    # Measured 27 Aug 2026 over the whole published corpus: a four-line JavaScript port on top of
    # `ArgdownPositions.normalise` -- already inlined in every viewer, already cross-checked
    # against this module by test_argdown_positions.mjs -- agreed with this service on 251 of 251
    # adjudicated claims (79 quotation, 172 paraphrase). So the choice of where the rule lives is
    # open again, and it matters: this is the only place fidelity is ever derived, and only a
    # per-file build with --source-root calls it. The app, the standalone viewer and a bundle
    # build all draw the border the file declares.
    if a.derive_fidelity:
        if not a.source_root:
            print("{}")
            return None, None, None
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import argdown_provenance as prov
        doc = export_json(cli, path)
        if not doc:
            print("{}")
            return None, None, None
        prov.apply_defaults(doc, prov.read_frontmatter(path))
        root = os.path.abspath(os.path.expanduser(a.source_root))
        got = prov.derived_quotation(doc, root)
        declared = prov.fidelity_of(doc)
        out = {}
        for title, verbatim in got.items():
            # Only ever adjudicate between `quotation` and `paraphrase`. `interpretation` and
            # `imputation` are judgements about the reading, not facts about the words, and
            # nothing here is entitled to touch them.
            if declared.get(title) in ("interpretation", "imputation", "compression"):
                continue
            if verbatim is True:
                out[title] = "quotation"
            elif verbatim is False:
                out[title] = "paraphrase"
        print(json.dumps(out))
        return None, None, None

    return a, cli, path

def _report(cli, path, a):
    """The report itself. Returns a process exit code.

    SPLIT OUT OF `main` so the whole thing can be run with its prose sent nowhere. `--format
    json` and `--only-problems` still need every check to RUN -- that is where the faults are
    detected -- and only the census prose is unwanted, so redirecting is both simpler and
    safer than threading a `quiet` flag through fifty print sites and getting one wrong.
    """
    print(f"== {os.path.basename(path)}")

    # IS THIS A DRAFT? Almost every check here is an expectation about a text that has FINISHED
    # arguing: that the map reaches a contention, that every claim is wired to something. A draft
    # satisfies none of them and cannot be made to without inventing what the author has not
    # written -- and a reconstructor faced with a fault it can only clear by invention will
    # invent. Measured on a book-length draft where nine chapters of eleven reached no conclusion
    # at all: under the ordinary rules that is nine manufactured apexes and no way for the author
    # to tell which were his.
    #
    # So `draft: true` in the front matter does not silence anything. It moves the findings that
    # are about UNFINISHEDNESS from fault to observation, and says so in their wording. What the
    # checker can still be certain about -- a quotation that is not verbatim, a broken metadata
    # block, a fidelity marker that does not match the words -- is unaffected, because none of
    # those becomes true or false depending on how done the writing is.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import argdown_provenance as _prov
        _fm = _prov.read_frontmatter(path) or {}
    except ImportError:
        _fm = {}
    draft = str(_fm.get("draft", "")).lower() in ("true", "1")
    if draft:
        print("   DRAFT: the frontmatter says this text is still being written. Findings about "
              "unfinishedness\n      are reported as observations rather than faults; every "
              "check on the words themselves\n      is unchanged.")

    # ---- 1. parse -------------------------------------------------------- #
    r = run(cli, "map", path, "--format", "dot", "--stdout")
    if r.returncode != 0:
        # THE PARSER'S OWN WORDS, not a summary of them. It names the line, and a caller about
        # to edit the file needs that far more than it needs our gloss on it.
        finding("parse", "!", "the file does not parse",
                detail=parser_message(r.stderr or r.stdout))
        print("\nFAILED TO PARSE\n")
        print(r.stderr or r.stdout)
        SHAPE["parsed"] = False
        return 1
    dot = r.stdout
    nodes, kinds, edges, clusters = parse_dot(dot)
    SHAPE.update(nodes=len(nodes), edges=len(edges))
    print(f"   parses OK -- {len(nodes)} nodes "
          f"({Counter(kinds.values()).get('argument-map-node', 0)} arguments), "
          f"{len(edges)} edges, {len(clusters)} clusters")

    # ---- 2. connectivity, measured on the DOT ---------------------------- #
    src = {x for x, _ in edges}
    dst = {y for _, y in edges}
    isolated = [nodes[n] for n in nodes if n not in src and n not in dst]
    terminal = [nodes[n] for n in nodes if n not in src]

    print(f"\n   APEX ({len(terminal)} node(s) that support nothing):")
    for t in terminal:
        print(f"      * {t[:96]}")
    if isolated:
        # IN A DRAFT AN ORPHAN IS A RESULT. A claim wired to nothing in a finished reconstruction
        # is a fault: either it belongs somewhere or it should go. In a text still being written
        # it is far more likely to be a passage whose place the AUTHOR has not settled, and
        # telling the reconstructor to attach or delete it invites exactly the invention this
        # whole mode exists to prevent.
        #
        # DEFENSIVE, AND SAY SO: no case could be constructed that reaches this branch. Argdown's
        # default statement selection drops a claim with no relations BEFORE the map is exported,
        # so a genuinely isolated claim never appears in `nodes` and `isolated` stays empty --
        # it was empty on every sample, on the book-length draft, and on files written to provoke
        # it. The branch is correct if it is ever reached and it is not known to be reachable.
        # The draft switch's real work is in the prompt, not here.
        print(f"\n   DISCONNECTED ({len(isolated)}) -- " +
              ("material not yet joined to the argument:" if draft else "attach or delete each:"))
        for t in isolated:
            if draft:
                finding("disconnected", "?",
                        "claim is wired to nothing: it neither supports nor is supported. In a "
                        "draft this is usually material whose place is not settled yet",
                        title=t[:160],
                        fix="leave it if the text has not placed it; attach it once it has")
            else:
                finding("disconnected", "!",
                        "claim is wired to nothing: it neither supports nor is supported",
                        title=t[:160],
                        fix="attach it with +/- to the claim it bears on, or delete it")
            print(f"      {'?' if draft else '!'} {t[:96]}")
    else:
        print("\n   DISCONNECTED: none")

    # ---- 3. shortcode collisions ----------------------------------------- #
    text = open(path, encoding="utf-8").read()
    hits = []
    for lineno, line in enumerate(text.splitlines(), 1):
        for code, sym in SHORTCODES.items():
            if code in line:
                hits.append((lineno, code, sym, line.strip()[:70]))
    if hits:
        print(f"\n   SYMBOL SHORTCODES ({len(hits)}) -- Argdown rewrites these silently:")
        for lineno, code, sym, snippet in hits:
            finding("symbol-shortcode", "!",
                    f"`{code}` is rewritten to `{sym}` by the parser, which breaks every "
                    f"selectedSections and folded= reference to this heading",
                    line=lineno, text=snippet,
                    fix=f"remove or space out the `{code}` so it is not read as a shortcode")
            print(f"      ! line {lineno}: {code} -> {sym}   {snippet}")
    else:
        print("   SYMBOL SHORTCODES: none")

    # ---- 3b. lone `--`, which can silently eat an intermediate conclusion --- #
    # `--` opens an EXPANDED inference and consumes the following line as its
    # rule name. With one line before the closing `--` this parses clean and the
    # claim disappears from the document. Nothing else catches it.
    lone = [(i, l) for i, l in enumerate(text.splitlines(), 1)
            if re.fullmatch(r"\s*--\s*", l)]
    if lone:
        print(f"\n   LONE `--` ({len(lone)}) -- expanded-inference markers.")
        print("      Intentional pairs are fine. But a `--` meant as a simple")
        print("      inference line SILENTLY eats the next statement as a rule name.")
        print("      If these were meant as inference lines, write ----- instead.")
        for i, l in lone:
            finding("lone-dashes", "?",
                    "a bare `--` opens an EXPANDED inference and silently eats the next "
                    "statement as its rule name; a deliberate pair is fine",
                    line=i, fix="if this was meant as an inference line, write ----- instead")
            print(f"      ? line {i}")
    else:
        print("   LONE `--`: none")

    if clusters:
        print(f"\n   SECTIONS ({len(clusters)}):")
        for c in clusters:
            print(f"      - {c}")

    # ---- 4. selection modes ---------------------------------------------- #
    has_selection = re.search(r"^selection:", text, re.M) is not None
    # SIX MORE PROCESS SPAWNS, ~2.8s of a ~4s run, and a census rather than a check: nothing in
    # it can come back wrong. So it is skipped whenever the output is being consumed rather than
    # read -- which is every round of a fix loop.
    if a.modes:
        print("\n   SELECTION MODES (node counts):")
        if has_selection:
            print("      ! the frontmatter has a `selection:` block, which OVERRIDES")
            print("        --statement-selection; the counts below will all be equal.")
        for m in MODES:
            rr = run(cli, "map", path, "--format", "dot", "--stdout",
                     "--statement-selection", m)
            n = len(re.findall(r"^\s*n\d+ \[", rr.stdout, re.M)) if rr.returncode == 0 else -1
            print(f"      {m:<30} {n}")

    # ---- 5. tag census ---------------------------------------------------- #
    # COMMENTS FIRST. The parser strips them, so a `#tag` written inside one is not a tag —
    # but this census read the raw file and counted it, so an explanatory comment mentioning
    # three tags reported three tags that do not exist. Found when a reconstruction had to
    # rewrite its own header comment to stop the census inventing them.
    #
    # AND QUOTED STRINGS, which is the SAME BUG in the place the first fix did not look. A
    # `note:` or `source:` is metadata, and the parser does not read tags out of it: checked
    # against @argdown/core, a document whose note says "#notatag" yields exactly the tags in
    # its statement text and no others. This census counted them, so a note explaining why a
    # claim is tagged reported the tag twice. Found on the Miller map when `#authority` came
    # back as 4 on a file that carries it twice.
    #
    # A census that reads the raw file will keep finding these. It is kept as a text scan
    # because it must work on a file the parser cannot parse — which is exactly when a
    # reconstructor most wants to know what is in it — so every place the parser ignores a
    # `#` has to be subtracted by hand, and this is the second.
    uncommented = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    uncommented = re.sub(r"^\s*//.*$", "", uncommented, flags=re.M)
    uncommented = re.sub(r"<!--.*?-->", " ", uncommented, flags=re.S)
    uncommented = re.sub(r'"(?:[^"\\]|\\.)*"', ' ', uncommented)

    # ONCE PER CLAIM, NOT ONCE PER MENTION — the third and last way this census disagreed with
    # the parser. A statement defined once and referred to again carries its tags in the text
    # every time, and Argdown still has one statement with one set of tags. Counting raw
    # occurrences made Prescott-Couch report 22 conceded, 10 contested and 58 reported where the
    # parser has 15, 7 and 52: fourteen claims are written out more than once there, and the 16
    # repeats are exactly the 16 the count was over by.
    #
    # What a reader wants from this line is HOW MANY CLAIMS a chip would select, which is the
    # parser's number. So tags are gathered per title and counted as a set.
    seen_tag = set()
    loose = Counter()
    for line in uncommented.split("\n"):
        found = re.findall(r"(?<!\S)#([A-Za-z][\w-]*)", line)
        if not found:
            continue
        where = re.search(r"\[([^\]]+)\]|<([^>]+)>", line)
        if where:
            title = where.group(1) or where.group(2)
            for t in found:
                seen_tag.add((title, t))
        else:
            loose.update(found)          # a tag with no claim on its line: count each one
    tags = Counter(t for _, t in seen_tag) + loose
    if tags:
        print("\n   TAGS (drive the overview view via selection.selectedTags):")
        for t, c in tags.most_common():
            print(f"      #{t:<14} {c}")
    else:
        print("\n   TAGS: none -- without tags there is no reliable overview view.")

    # ---- 5b. provenance coverage, on EVERY run ---------------------------- #
    # The convention "record chapter and section on every claim" is worth little asserted. This
    # is the falsifiable form: it runs without --source-root, so a map that cannot support the
    # Order view says so while the reconstruction is still in progress, rather than at build
    # time when fixing it means re-reading the whole source.
    coverage_report(cli, path,
                    os.path.abspath(os.path.expanduser(a.source_root))
                    if a.source_root else None)

    # ---- 5c. provenance: quotations, debt, contribution ------------------- #
    if a.source_root:
        provenance_report(cli, path, os.path.abspath(os.path.expanduser(a.source_root)),
                          fix=a.fix)
    else:
        print("\n   (pass --source-root DIR to verify quotations and measure justification "
              "debt)")

    # ---- 5d. fidelity, warrants, reading policy, interpretive load -------- #
    # LAST, and on every run. These are facts about the .argdown alone, so they need no
    # --source-root; they come after the source checks because they are what was MADE of the
    # text, and reading them before it inverts the reconstruction's own order.
    fidelity_report(cli, path)

    # ---- 5e. the shape of the premise-conclusion structures --------------- #
    # After fidelity, because these are questions about the ARGUMENT rather than about whose
    # words it is made of, and the map now draws the answer as a bar.
    doc_for_pcs = export_json(cli, path)
    if doc_for_pcs:
        pcs_report(doc_for_pcs)
        # The same export again, and the same subject: what this step claims. A named rule is
        # the only place in a file that asserts a conclusion FOLLOWS, so it is the only place
        # worth deciding.
        validity_report(doc_for_pcs)
        # Same export, same question — what is this arrow actually claiming? — so it reads the
        # document already in hand rather than exporting it a second time.
        precondition_report(doc_for_pcs)

    # ---- 6. JSON cross-check --------------------------------------------- #
    with tempfile.TemporaryDirectory() as td:
        rr = run(cli, "json", path, "--outputDir", td)
        files = [f for f in os.listdir(td) if f.endswith(".json")] if rr.returncode == 0 else []
        if files:
            d = json.load(open(os.path.join(td, files[0])))
            print(f"\n   JSON: {len(d['statements'])} statements, "
                  f"{len(d['arguments'])} arguments, {len(d['relations'])} relations "
                  f"{dict(Counter(r['relationType'] for r in d['relations']))}")
            print("      (fewer relations than the map has edges is EXPECTED: the JSON")
            print("       omits edges implied by a premise-conclusion structure.)")


def main():
    a, cli, path = _parse_args()
    if a is None:
        return
    started = __import__("time").time()

    # ---- the report, with its prose sent nowhere when nobody asked for prose ---- #
    sink = io.StringIO() if a.quiet else None
    try:
        if sink is not None:
            with contextlib.redirect_stdout(sink):
                code = _report(cli, path, a)
        else:
            code = _report(cli, path, a)
    except Exception:
        # A CRASH MUST NOT SWALLOW THE REPORT. Anything already written explains how far the
        # run got, and in json mode it is the only trace there is.
        if sink is not None:
            sys.stdout.write(sink.getvalue())
        raise

    if a.fmt == "json":
        # THE CENSUS RIDES ALONG, because without it the caller runs this command again on a file
        # it has not touched. `sink` already holds the prose the report wrote; it is passed
        # through verbatim rather than re-rendered, so the json census and the prose census cannot
        # disagree. SELECTION MODES is the one section missing, because json mode implies
        # `--only-problems` and that skips six process spawns worth 2.8s of a 4s run; pass
        # `--selection-modes` to buy it back.
        census = sink.getvalue().strip() if (a.census and sink is not None) else ""
        # `verified` IS NOT `ok`, AND CONFLATING THEM WAS THE BUG. `ok` says no fault was found
        # among the things this run looked at. Whether the quotations were among those things
        # depends entirely on --source-root, and without it the answer was still `ok: true` with
        # "nothing to fix" beside it -- a claim the checker is not entitled to make about files
        # it never opened. Two booleans, so a caller can tell "clean" from "unexamined".
        print(json.dumps({"file": os.path.basename(path),
                          "ok": not any(f["severity"] == "!" for f in FINDINGS),
                          "verified": bool(a.source_root),
                          "findings": FINDINGS,
                          **({"vocabulary": VOCABULARY} if VOCABULARY else {}),
                          **({"census": census} if census else {})},
                         indent=2, ensure_ascii=False))
    elif a.quiet:
        print(f"== {os.path.basename(path)}")
        if not FINDINGS:
            print("   nothing to fix.")
        for f in FINDINGS:
            where = f.get("title") or (f"line {f['line']}" if f.get("line") else "")
            print(f"   {f['severity']} [{f['check']}] {where}".rstrip())
            print(f"       {f['message']}")
            if f.get("fix"):
                print(f"       fix: {f['fix']}")
        for name, values in sorted(VOCABULARY.items()):
            print(f"   {name} must be one of: {', '.join(values)}")
    record(path, __import__("time").time() - started, nodes=SHAPE.get("nodes"),
           edges=SHAPE.get("edges"), parsed=SHAPE.get("parsed", True))
    if code:
        sys.exit(code)

if __name__ == "__main__":
    main()
