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
sample: 687 words and 10.5s becomes 221 words and 2.4s.

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

SHORTCODES = {".A.": "∀", ".E.": "∃", ".~.": "¬", ".v.": "∨",
              ".->.": "→", ".<->.": "↔", ".P.": "\U0001d5e3",
              ".O.": "\U0001d5e2"}

MODES = ["all", "with-title", "with-relations", "with-more-than-one-relation",
         "top-level", "not-used-in-argument"]

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

# Value sets a fix has to choose from, collected once rather than restated on every finding that
# needs them. Printed at the foot of the short report and carried in the JSON envelope.
VOCABULARY = {}


def finding(check, severity, message, **where):
    """Record a fault. `where` carries whatever locates it: line, title, chapter, fix."""
    FINDINGS.append(dict(check=check, severity=severity, message=message,
                         **{k: v for k, v in where.items() if v is not None}))


def find_cli(explicit):
    if explicit:
        return explicit
    for base in (os.getcwd(), os.path.dirname(os.path.abspath(__file__)),
                 os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")):
        cand = os.path.normpath(os.path.join(base, DEFAULT_CLI))
        if os.path.exists(cand):
            return cand
    found = shutil.which("argdown")
    if found:
        return found
    sys.exit("could not find the argdown CLI; pass --cli")


def run(cli, *args):
    return subprocess.run([cli, *args], capture_output=True, text=True)


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
    out = {"thin": [], "unfilled": [], "repeated": []}
    stmts = doc.get("statements") or {}

    def has_text(title):
        rec = stmts.get(title) or {}
        return any((m.get("text") or "").strip() for m in rec.get("members", []))

    for title, arg in (doc.get("arguments") or {}).items():
        pcs = arg.get("pcs") or []
        if not pcs:
            continue
        run, first, step = [], True, 1
        for entry in pcs:
            if entry.get("role") == "premise":
                run.append(entry.get("title"))
                continue
            # A step's inputs are its own premises plus, after the first step, the conclusion
            # the step before it reached.
            inputs = len(run) + (0 if first else 1)
            if inputs <= 1:
                out["thin"].append((title, step, entry.get("title"), len(run), first))
            seen, dupes = set(), []
            for t in run:
                if t in seen and t not in dupes:
                    dupes.append(t)
                seen.add(t)
            for t in dupes:
                out["repeated"].append((title, step, t))
            run, first, step = [], False, step + 1
        for entry in pcs:
            if entry.get("role") == "premise" and not has_text(entry.get("title")):
                out["unfilled"].append((title, entry.get("title")))
    return out


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
    # in the source; the rule for that leans on difflib and has no clean JavaScript equivalent,
    # and a second implementation is the drift hazard test_argdown_positions.mjs already exists
    # to police. So the build asks this, rather than working it out again.
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

    # ---- 1. parse -------------------------------------------------------- #
    r = run(cli, "map", path, "--format", "dot", "--stdout")
    if r.returncode != 0:
        # THE PARSER'S OWN WORDS, not a summary of them. It names the line, and a caller about
        # to edit the file needs that far more than it needs our gloss on it.
        finding("parse", "!", "the file does not parse",
                detail=ANSI.sub("", (r.stderr or r.stdout)).strip()[:1200])
        print("\nFAILED TO PARSE\n")
        print(r.stderr or r.stdout)
        return 1
    dot = r.stdout
    nodes, kinds, edges, clusters = parse_dot(dot)
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
        print(f"\n   DISCONNECTED ({len(isolated)}) -- attach or delete each:")
        for t in isolated:
            finding("disconnected", "!",
                    "claim is wired to nothing: it neither supports nor is supported",
                    title=t[:160],
                    fix="attach it with +/- to the claim it bears on, or delete it")
            print(f"      ! {t[:96]}")
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
    uncommented = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    uncommented = re.sub(r"^\s*//.*$", "", uncommented, flags=re.M)
    uncommented = re.sub(r"<!--.*?-->", " ", uncommented, flags=re.S)
    tags = Counter(re.findall(r"(?<!\S)#([A-Za-z][\w-]*)", uncommented))
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
        print(json.dumps({"file": os.path.basename(path),
                          "ok": not any(f["severity"] == "!" for f in FINDINGS),
                          "findings": FINDINGS,
                          **({"vocabulary": VOCABULARY} if VOCABULARY else {})},
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
    if code:
        sys.exit(code)

if __name__ == "__main__":
    main()
