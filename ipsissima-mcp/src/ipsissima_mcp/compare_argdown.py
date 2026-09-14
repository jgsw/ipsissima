#!/usr/bin/env python3
"""Compare two reconstructions of the same source text.

    python3 compare_argdown.py A.argdown B.argdown --source-root DIR [--format json]

One file asserts one reading (Formation episode, ruled 14 Sep 2026): two defensible readings
of a text are two .argdown files, and this tool is how they disagree in the open. A teacher
holding fifty student maps of one handout, or a scholar holding their own reading beside a
rival's, wants to know: where do these maps read the same passages, where does each go that
the other does not, and where do they read the same words differently?

WHAT ANCHORS THE COMPARISON, AND WHAT NEVER DOES. The two maps share exactly one thing: the
text. So every comparison here is anchored on verified quotations -- each map's claims are
placed at the passages they quote, and the maps are compared BY PASSAGE, never by guessing
whether two claim texts "mean the same thing". Semantic matching of one reconstructor's words
against another's would be a judgement about both readings, and judgements about readings are
not the machine's to make (the same line check_argdown draws: facts are checked, readings are
reported). The cost of that honesty is stated in the report: a claim with no verified
quotation cannot be placed, and the comparison says how many claims it could not see.

THE UNIT IS THE PARAGRAPH. Quotations anchor at a line; lines are too fine (two quotes from
one sentence would read as different places) and chapters too coarse. A paragraph -- a
blank-line-delimited block of the source -- is the unit a reader would call "the same
passage", and it is stable under the converters' line-wrapping because it is re-derived from
the file each run.

WHAT A DIVERGENCE IS. Three kinds are flagged, all computable from what the maps declare:
  crux      -- one map marks a passage `#crux` (a choice among live readings, Formation wave
               1) and the other reads the same passage without noting any choice. The second
               map may not know the ground is contested.
  voice     -- one map tags its claim on a passage `#reported` (set out, not held) and the
               other asserts from the same passage: the maps disagree about WHO is speaking,
               which is an interpretive disagreement about the text, not a wiring choice.
  distance  -- one map's claim on a passage declares fidelity at the checked end
               (quotation/paraphrase) and the other's at the interpretive end
               (interpretation/imputation): the same words carrying very different loads.
Everything else -- different wiring, different emphasis, different apexes -- is REPORTED
side by side without a verdict: which reading is better is exactly the argument the two
files exist to have.
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import argdown_provenance as prov                                  # noqa: E402
from check_argdown import find_cli, export_json                    # noqa: E402

CHECKED = ("quotation", "paraphrase")
INTERPRETIVE = ("interpretation", "imputation")


def paragraph_map(path):
    """line number (1-based) -> paragraph index (1-based), plus each paragraph's line span.

    A paragraph is a maximal run of non-blank lines. Page-marker comments
    (`<!-- p.N begins here -->`) are the converter's furniture, not prose, but they sit on
    their own lines inside the text and splitting on them would cut real paragraphs in two --
    so they count as blank instead.
    """
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            lines = fh.read().split("\n")
    except OSError:
        return {}, []
    line_para, spans = {}, []
    current = None
    for i, ln in enumerate(lines, start=1):
        blank = not ln.strip() or re.fullmatch(r"\s*<!--.*?-->\s*", ln)
        if blank:
            current = None
            continue
        if current is None:
            spans.append([i, i])
            current = len(spans)
        else:
            spans[current - 1][1] = i
        line_para[i] = current
    return line_para, spans


def read_map(cli, path, source_root):
    """Everything the comparison needs from one .argdown file."""
    doc = export_json(cli, path) or {}
    fm = prov.read_frontmatter(path) or {}
    prov.apply_defaults(doc, fm)
    merged = prov.merged_statements(doc)

    # Tags come from the parser's own export, per equivalence class -- the raw-text scan the
    # census uses exists only to survive an unparsable file, which export_json already failed.
    tags = {t: set(st.get("tags") or []) for t, st in (doc.get("statements") or {}).items()}

    declared = fm.get("contentions") if isinstance(fm.get("contentions"), list) else []
    roles = prov.contribution(doc, declared=declared) if merged else {}
    apex = sorted(t for t, r in roles.items() if r.get("role") == "apex" or r.get("apex"))

    quotes = prov.check_quotations(doc, source_root) if source_root else []
    exact = [q for q in quotes if q["status"] == "exact"]

    chapters = sorted({r["data"].get("chapter") for r in merged.values()
                       if r["data"].get("chapter")})
    policy = fm.get("reconstruction") if isinstance(fm.get("reconstruction"), dict) else {}
    return dict(doc=doc, fm=fm, merged=merged, tags=tags, apex=apex, quotes=quotes,
                exact=exact, chapters=chapters, policy=policy)


def anchors(m, source_root, para_maps):
    """title -> set of (chapter, paragraph). Only verified quotations place a claim."""
    out = {}
    for q in m["exact"]:
        ch = q["chapter"]
        if ch not in para_maps:
            para_maps[ch] = paragraph_map(os.path.join(source_root, ch))
        line_para, _spans = para_maps[ch]
        para = line_para.get(q["line"])
        if para is None:
            continue
        out.setdefault(q["title"], set()).add((ch, para))
    return out


def side(m, title):
    """One map's declared reading of a claim, as the report shows it."""
    data = m["merged"].get(title, {}).get("data", {})
    return dict(title=title,
                fidelity=data.get("fidelity"),
                tags=sorted(m["tags"].get(title, ())),
                note=data.get("note"))


def divergences(shared, a, b):
    found = []
    for (ch, para), (ta, tb) in sorted(shared.items()):
        for at in sorted(ta):
            for bt in sorted(tb):
                sa, sb = side(a, at), side(b, bt)
                pair = dict(chapter=ch, paragraph=para, a=sa, b=sb)
                if ("crux" in sa["tags"]) != ("crux" in sb["tags"]):
                    found.append(dict(kind="crux", **pair))
                if ("reported" in sa["tags"]) != ("reported" in sb["tags"]):
                    found.append(dict(kind="voice", **pair))
                fa, fb = sa["fidelity"], sb["fidelity"]
                if (fa in CHECKED and fb in INTERPRETIVE) or \
                        (fa in INTERPRETIVE and fb in CHECKED):
                    found.append(dict(kind="distance", **pair))
    return found


def compare(path_a, path_b, source_root):
    # LOUDLY, before anything else: a map that is not there would otherwise flow through as a
    # map citing no chapters, and "not readings of the same source" is the wrong sentence for
    # a typo in a path.
    for p in (path_a, path_b):
        if not os.path.isfile(p):
            sys.exit(f"compare_argdown: no such file: {p}")
    cli = find_cli(None)
    a, b = read_map(cli, path_a, source_root), read_map(cli, path_b, source_root)
    name_a = os.path.basename(path_a)
    name_b = os.path.basename(path_b)

    shared_chapters = sorted(set(a["chapters"]) & set(b["chapters"]))
    result = dict(a=name_a, b=name_b,
                  chapters=dict(a=a["chapters"], b=b["chapters"], shared=shared_chapters),
                  same_source=bool(shared_chapters))
    if not shared_chapters:
        return result, a, b

    para_maps = {}
    anch_a = anchors(a, source_root, para_maps)
    anch_b = anchors(b, source_root, para_maps)
    paras_a = {p for ps in anch_a.values() for p in ps if p[0] in shared_chapters}
    paras_b = {p for ps in anch_b.values() for p in ps if p[0] in shared_chapters}

    shared = {}
    for p in paras_a & paras_b:
        ta = {t for t, ps in anch_a.items() if p in ps}
        tb = {t for t, ps in anch_b.items() if p in ps}
        shared[p] = (ta, tb)

    def pol(m):
        return {k: m["policy"].get(k) for k in ("aim", "unit", "mode", "strength")}

    result.update(
        policies=dict(a=pol(a), b=pol(b),
                      differ=sorted(k for k in ("aim", "unit", "mode", "strength")
                                    if pol(a)[k] != pol(b)[k])),
        apex=dict(a=a["apex"], b=b["apex"]),
        placed=dict(a=len(anch_a), b=len(anch_b)),
        unplaced=dict(a=len(a["merged"]) - len(anch_a),
                      b=len(b["merged"]) - len(anch_b)),
        shared_passages=[dict(chapter=ch, paragraph=para,
                              a=[side(a, t) for t in sorted(ta)],
                              b=[side(b, t) for t in sorted(tb)])
                         for (ch, para), (ta, tb) in sorted(shared.items())],
        only_a=sorted([list(p) for p in paras_a - paras_b]),
        only_b=sorted([list(p) for p in paras_b - paras_a]),
        divergences=divergences(shared, a, b),
    )
    return result, a, b


def render(r):
    out = []
    say = out.append
    say(f"Two readings compared: {r['a']}  vs  {r['b']}")
    if not r["same_source"]:
        say("")
        say("   These maps cite no chapter in common: not readings of the same source.")
        say(f"   {r['a']} cites {r['chapters']['a'] or 'nothing'}; "
            f"{r['b']} cites {r['chapters']['b'] or 'nothing'}.")
        say("   There is nothing to anchor a comparison on.")
        return "\n".join(out)

    say(f"   shared source: {', '.join(r['chapters']['shared'])}")
    say("")
    say("   READING POLICIES (each file's declared reading):")
    for k in ("aim", "unit", "mode", "strength"):
        va, vb = r["policies"]["a"][k], r["policies"]["b"][k]
        mark = "  <-- the readings declare themselves differently" if va != vb else ""
        say(f"      {k:<9} {str(va):<14} {str(vb):<14}{mark}")
    say("")
    say("   APEX (what each map takes the text to be finally arguing):")
    say(f"      {r['a']}: " + ("; ".join(r["apex"]["a"]) or "(none computed)"))
    say(f"      {r['b']}: " + ("; ".join(r["apex"]["b"]) or "(none computed)"))
    say("")
    na, nb = len(r["only_a"]), len(r["only_b"])
    say(f"   GROUND: {len(r['shared_passages'])} passage(s) read by both, "
        f"{na} by {r['a']} alone, {nb} by {r['b']} alone.")
    say(f"      (a passage = a paragraph of the source; claims are placed by their verified")
    say(f"      quotations, and {r['unplaced']['a']} claim(s) of {r['a']} and "
        f"{r['unplaced']['b']} of {r['b']} carry none, so the comparison cannot see them)")
    for kind, label in (("crux", "CRUX -- one map marks the reading contested here, "
                                 "the other does not:"),
                        ("voice", "VOICE -- the maps disagree about who is speaking:"),
                        ("distance", "DISTANCE -- the same passage read at very different "
                                     "fidelity:")):
        rows = [d for d in r["divergences"] if d["kind"] == kind]
        if not rows:
            continue
        say("")
        say(f"   {label}")
        for d in rows:
            say(f"      {d['chapter']} ¶{d['paragraph']}:")
            for nm, s in ((r["a"], d["a"]), (r["b"], d["b"])):
                bits = [s["fidelity"] or "unmarked"] + ["#" + t for t in s["tags"]]
                say(f"         {nm}: [{s['title']}] ({', '.join(bits)})")
    say("")
    say("   No verdict is offered on which reading is better: that is the argument the two")
    say("   files exist to have, and it is theirs.")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("map_a")
    ap.add_argument("map_b")
    ap.add_argument("--source-root", required=True,
                    help="folder holding the shared source/ the two maps cite")
    ap.add_argument("--format", choices=("prose", "json"), default="prose")
    a = ap.parse_args()
    result, _ma, _mb = compare(a.map_a, a.map_b, a.source_root)
    if a.format == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(render(result))
    sys.exit(0 if result["same_source"] else 2)


if __name__ == "__main__":
    main()
