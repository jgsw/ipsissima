#!/usr/bin/env python3
"""Compare two reconstructions of the SAME source, made under different instructions.

    python3 ipsissima-mcp/eval/compare_reconstructions.py \
        path/to/a.argdown path/to/b.argdown --source-root-a DIR --source-root-b DIR \
        --label-a max --label-b high

The two paths are positional. `--source-root-*` is the folder each map's `chapter:` paths are
relative to, which for a reconstruction folder is the folder itself. The labels head the columns
and default to A and B.

WHAT THIS IS FOR. The instructions a model is given are a claim — that telling it the whole
language and the whole method produces better maps, first time, for fewer tokens. That is a claim
worth measuring rather than believing, and measuring it needs the same source reconstructed twice
under different instructions, then compared on things that are facts rather than impressions.

WHAT IT MEASURES, and why each one:

  EXPRESSIVE RANGE   which of Argdown's seven relation constructs the map uses. The corpus built
                     under the old instructions used two, and contained no undercut at all — an
                     objection that grants the premises and denies the inference. If wider
                     instructions do not widen this, they have not done their job.
  TITLE STYLE        prose titles or kebab-case ids. The old instructions asked for kebab-case;
                     Argdown's own examples and every published document use prose.
  PROVENANCE         how much of the map can be checked against the source at all.
  FAULTS             what the checker still finds. Fewer is better, but a map with no findings
                     and no undercuts has bought cleanliness by saying less.
  SHAPE              nodes, arguments, premise-conclusion structures, apex size, spine.

WHAT IT CANNOT MEASURE is whether the reading is any good. Two maps can be equally valid, equally
well-provenanced, and one of them can be a misreport. That judgement is a human's, and this tool
exists to put the mechanical facts beside it rather than in place of it.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHECK = ROOT / "ipsissima-mcp" / "src" / "ipsissima_mcp" / "check_argdown.py"
PY = str(ROOT / ".venv" / "bin" / "python") if (ROOT / ".venv" / "bin" / "python").exists() \
     else sys.executable

#: The seven relation constructs, as written. Bare `+`/`-` are counted separately because they
#: mean the same as `<+`/`<-` and the house style prefers the explicit form.
RELATIONS = [
    ("<+", r"^\s*<\+\s"), ("+>", r"^\s*\+>\s"),
    ("<-", r"^\s*<-\s"),  ("->", r"^\s*->\s"),
    ("<_", r"^\s*<_\s"),  ("_>", r"^\s*_>\s"),
    ("><", r"^\s*><\s"),
    ("bare +", r"^\s*\+(?![>])\s"), ("bare -", r"^\s*-(?![->])\s"),
]


def check(path, source_root):
    """The checker's findings as data, plus whether it parses at all."""
    r = subprocess.run([PY, str(CHECK), str(path), "--source-root", str(source_root),
                        "--no-fix", "--format", "json"],
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"ok": False, "findings": [{"check": "harness", "severity": "!",
                                           "message": "checker produced no JSON"}]}


def census(path):
    """Facts readable off the file itself, without a parser."""
    text = Path(path).read_text(encoding="utf-8")
    # Comments carry prose about the reconstruction and would inflate every count.
    body = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)

    rel = {name: len(re.findall(pat, body, re.M)) for name, pat in RELATIONS}
    titles = re.findall(r"\[([^\]]{2,80})\]\s*:", body) + re.findall(r"<([^>]{2,80})>\s*:", body)
    kebab = sum(1 for t in titles if "-" in t and " " not in t)
    prose = sum(1 for t in titles if " " in t)
    return {
        "words": len(body.split()),
        "relations": rel,
        "constructs_used": sum(1 for k, v in rel.items()
                               if v and k not in ("bare +", "bare -")),
        # THE MEASURE THAT MATTERS. `<+` and a bare `+` mean the same relation, so counting
        # written forms flatters a map that varies its punctuation. What the corpus was missing
        # was whole KINDS: no undercut anywhere, no contradiction anywhere. A reconstruction that
        # cannot say "that does not follow" is missing a move, not a spelling.
        "kinds_used": sum(1 for names in (("<+", "+>", "bare +"), ("<-", "->", "bare -"),
                                          ("<_", "_>"), ("><",))
                          if any(rel[n] for n in names)),
        "has_undercut": bool(rel["<_"] or rel["_>"]),
        "has_contradiction": bool(rel["><"]),
        "titles": len(titles), "kebab": kebab, "prose_titles": prose,
        "pcs": len(re.findall(r"^\s*-{4,}\s*$", body, re.M))
               + len(re.findall(r"^\s*--\s.*\s--\s*$", body, re.M)),
        "tags": dict(sorted(
            {t: len(re.findall(r"#" + re.escape(t) + r"\b", body))
             for t in set(re.findall(r"#([a-zA-Z][\w-]*)", body))}.items())),
        "fidelity": dict(sorted(
            {f: len(re.findall(r'fidelity:\s*"' + f + '"', body))
             for f in ("quotation", "paraphrase", "compression", "interpretation", "imputation")
             }.items())),
        "warrants": len(re.findall(r"warrant:", body)),
        "quotations_declared": len(re.findall(r"source:\s*\"", body)),
        "notes": len(re.findall(r"note:", body)),
    }


def row(label, a, b, better=None):
    """One comparison line. `better` is 'high', 'low' or None."""
    mark = ""
    if better and isinstance(a, (int, float)) and isinstance(b, (int, float)) and a != b:
        win = (a > b) if better == "high" else (a < b)
        mark = "  A" if win else "  B"
    print(f"  {label:<34} {str(a):>16}  {str(b):>16}{mark}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a"), ap.add_argument("b")
    ap.add_argument("--source-root-a", required=True)
    ap.add_argument("--source-root-b", required=True)
    ap.add_argument("--label-a", default="A"), ap.add_argument("--label-b", default="B")
    x = ap.parse_args()

    ca, cb = census(x.a), census(x.b)
    ka, kb = check(x.a, x.source_root_a), check(x.b, x.source_root_b)

    print(f"\n{'':36}{x.label_a:>16}  {x.label_b:>16}")
    print("  " + "-" * 68)
    print("\n  SHAPE")
    row("words in the file", ca["words"], cb["words"])
    row("claims and arguments titled", ca["titles"], cb["titles"])
    row("premise-conclusion structures", ca["pcs"], cb["pcs"])

    print("\n  EXPRESSIVE RANGE")
    row("relation KINDS used (of 4)", ca["kinds_used"], cb["kinds_used"], "high")
    row("    has an undercut", str(ca["has_undercut"]), str(cb["has_undercut"]))
    row("    has a contradiction", str(ca["has_contradiction"]), str(cb["has_contradiction"]))
    row("explicit-direction forms (of 7)", ca["constructs_used"], cb["constructs_used"], "high")
    for name, _ in RELATIONS:
        if ca["relations"][name] or cb["relations"][name]:
            row(f"    {name}", ca["relations"][name], cb["relations"][name])

    print("\n  STYLE")
    row("prose titles", ca["prose_titles"], cb["prose_titles"], "high")
    row("kebab-case ids", ca["kebab"], cb["kebab"], "low")
    row("tags used", ", ".join(ca["tags"]) or "(none)", ", ".join(cb["tags"]) or "(none)")

    print("\n  PROVENANCE")
    row("source quotations declared", ca["quotations_declared"], cb["quotations_declared"], "high")
    row("warrants given", ca["warrants"], cb["warrants"], "high")
    row("notes", ca["notes"], cb["notes"])
    for f in ("quotation", "paraphrase", "compression", "interpretation", "imputation"):
        if ca["fidelity"][f] or cb["fidelity"][f]:
            row(f"    fidelity {f}", ca["fidelity"][f], cb["fidelity"][f])

    print("\n  WHAT THE CHECKER STILL FINDS")
    row("parses and passes", str(ka.get("ok")), str(kb.get("ok")))
    row("findings", len(ka.get("findings", [])), len(kb.get("findings", [])), "low")
    kinds = sorted({f["check"] for f in ka.get("findings", []) + kb.get("findings", [])})
    for k in kinds:
        row(f"    {k}",
            sum(1 for f in ka.get("findings", []) if f["check"] == k),
            sum(1 for f in kb.get("findings", []) if f["check"] == k), "low")
    print()


if __name__ == "__main__":
    main()
