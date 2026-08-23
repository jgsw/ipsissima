#!/usr/bin/env python3
"""Score an Argdown reconstruction against a hand-built REFERENCE one.

    python3 mcp/eval/eval_reconstruction.py" CAND.argdown \
        --reference REF.argdown --source-root DIR [--json]

THERE IS NO GOLD STANDARD HERE, AND THE WORD IS BANNED FROM THIS FILE. Reconstruction is
interpretation: what a text's argument IS is exactly what is contested, and the same map can be
excellent as a report of what a paper says and poor as a reading of what it should say. A file
that claimed to be the correct carving would contradict the whole `reconstruction:` apparatus,
which exists because a map's quality is relative to a declared aim. The reference files are
CONSIDERED READINGS, not answer keys.

So the metrics are in three kinds, and only the first is load-bearing:

  1. NOT COMPARATIVE AT ALL, and unaffected by anyone's interpretation. A fabricated quotation is
     wrong whatever your reading; a disconnected node is a defect whatever your reading; an
     unmarked departure is unaccountable whatever your reading. Quotation integrity, hygiene,
     provenance coverage and fidelity discipline need no reference file and are where the real
     signal is.

  2. COMPARATIVE BUT NOT EVALUATIVE -- shape. Whether support is wired LINKED or CONVERGENT is a
     claim about the argument, not a matter of taste: Darwin's premises work only together, and
     Gettier's two cases are independent because deleting Case II leaves Case I still refuting
     the definition. Both are checkable against the text. A candidate that differs here has
     something to answer -- but so might the reference. The output is "these differ, look", never
     a percentage.

  3. DIAGNOSTIC ONLY -- claim overlap. Reported because a near-zero overlap means something went
     badly wrong, and printed with the matches so a human can see what was counted. It measures
     AGREEMENT WITH ONE READING, which is not quality, and it must never be read as a grade.

Three uses that do not require the reference to be correct, only fixed:
  * a tripwire for gross failure (overlap near zero, apex exploded, quotations failing);
  * REGRESSION -- when the prompt changes, did the output drift? The reference is a fixed point,
    not a correct point;
  * SELF-CONSISTENCY -- run the generator N times on one paper and compare its runs with each
    other, no reference involved. A generator that produces a different argument each time is
    unreliable regardless of which reading is right, and this is probably the most important
    single fact about an LLM extractor. Needs Phase 2 to exist before it can be built.

The checks that are NOT fuzzy are the ones worth failing a run over, and they are separated out:

  * QUOTATION INTEGRITY -- every quoted span verified against the source. Not a comparison with
    the reference at all, and for a tool that reconstructs other people's published arguments
    this is the one hard gate.
  * HYGIENE -- disconnected nodes, apex count, support cycles. A reconstruction with four apexes
    is four disconnected trees whatever its claims say.
  * PROVENANCE COVERAGE -- can each claim be placed in the text at all.
  * FIDELITY DISCIPLINE -- are departures from the text marked, and do they say why.

A reference file scored against ITSELF must come out perfect on every metric. That is the
harness's own test, and `--self-test` runs it across the whole sample folder.
"""

import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MCP = os.path.normpath(os.path.join(HERE, ".."))          # the ipsissima-mcp package
ROOT = os.path.normpath(os.path.join(MCP, ".."))          # the repository
SKILL = os.path.join(MCP, "src", "ipsissima_mcp")
CLI = os.path.join(ROOT, "app", "node_modules", ".bin", "argdown")
sys.path.insert(0, SKILL)
import argdown_provenance as prov                                     # noqa: E402

# Two reconstructions rarely word a claim identically. MEASURED on the reference set at 0.60:
# every file matches itself 100%, and all twelve cross-paper permutations match 0% -- clean
# separation, with nothing in between to tune against.
#
# BE HONEST ABOUT WHAT THAT SHOWS. It shows the metric can tell one paper from another, which is
# a low bar; nothing here has yet shown it can tell a GOOD reconstruction of a paper from a
# mediocre one, because no mediocre reconstruction exists to test against. The first real
# generated map is what calibrates this, and until then treat recall as a tripwire for gross
# failure rather than as a grade. The metrics that do NOT depend on the threshold -- quotations,
# hygiene, provenance, fidelity -- are the ones to lean on meanwhile.
MATCH = 0.60


def load(path):
    """Parse an .argdown to the JSON export, with front-matter defaults applied."""
    with tempfile.TemporaryDirectory() as td:
        r = subprocess.run([CLI, "json", path, "--outputDir", td],
                           capture_output=True, text=True)
        files = [f for f in os.listdir(td) if f.endswith(".json")]
        if not files:
            raise SystemExit(f"{path} does not parse:\n{r.stderr or r.stdout}")
        doc = json.load(open(os.path.join(td, files[0]), encoding="utf-8"))
    prov.apply_defaults(doc, prov.read_frontmatter(path))
    return doc


def norm_text(t):
    """Statement text, stripped of tags and punctuation, for comparison."""
    t = re.sub(r"(?<!\S)\#[A-Za-z][\w-]*", " ", t or "")
    return " ".join(re.findall(r"[a-z0-9]+", t.lower()))


def claims(doc):
    return {t: norm_text(r["text"]) for t, r in prov.merged_statements(doc).items()
            if norm_text(r["text"])}


def match_claims(cand, ref):
    """Greedy best-first pairing of candidate claims to reference claims."""
    pairs, used = [], set()
    scored = []
    for gt, gx in ref.items():
        for ct, cx in cand.items():
            r = difflib.SequenceMatcher(None, gx, cx).ratio()
            if r >= MATCH:
                scored.append((r, gt, ct))
    for r, gt, ct in sorted(scored, key=lambda s: -s[0]):
        if gt in used or ct in used:
            continue
        used.add(gt)
        used.add(ct)
        pairs.append((r, gt, ct))
    missed = [g for g in ref if g not in used]
    extra = [c for c in cand if c not in used]
    return pairs, missed, extra


def shape(doc):
    """How support is wired: through premise-conclusion structures, or as siblings.

    THE DISTINCTION THAT DECIDES THE LOGIC. Sibling `+` relations assert that the reasons are
    INDEPENDENT. That is the shape a careless reconstruction falls into and most philosophical
    arguments are not it -- so a candidate that scores well on claims and badly here has
    recovered the content and lost the argument.
    """
    pcs = sum(len(prov.pcs_edges(a)) for a in (doc.get("arguments") or {}).values())
    rel = doc.get("relations") or []
    return dict(
        arguments=len(doc.get("arguments") or {}),
        linked_edges=pcs,
        support=sum(1 for r in rel if r.get("relationType") == "support"),
        attack=sum(1 for r in rel if r.get("relationType") == "attack"),
        undercut=sum(1 for r in rel if r.get("relationType") == "undercut"),
    )


def hygiene(path):
    """Apex, disconnected and cycles -- measured on the DOT, which is where the real edges are."""
    r = subprocess.run([CLI, "map", path, "--format", "dot", "--stdout"],
                       capture_output=True, text=True)
    nodes = set(re.findall(r"(?<!-> )\b(n\d+)\s*\[[^\n]*?label=", r.stdout))
    edges = re.findall(r"(n\d+)\s*->\s*(n\d+)", r.stdout)
    src = {a for a, _ in edges}
    dst = {b for _, b in edges}
    return dict(nodes=len(nodes), edges=len(edges),
                apex=len([n for n in nodes if n not in src]),
                disconnected=len([n for n in nodes if n not in src and n not in dst]))


def score(cand_path, ref_path, source_root):
    cand, ref = load(cand_path), load(ref_path)
    cc, rc = claims(cand), claims(ref)
    pairs, missed, extra = match_claims(cc, rc)

    quotes = prov.check_quotations(cand, source_root) if source_root else []
    exact = sum(1 for q in quotes if q["status"] == "exact")
    merged = prov.merged_statements(cand)
    il = prov.interpretive_load(cand)
    unwarranted, warrants, _ = prov.warrant_gaps(cand)
    departures = sum(il["census"].get(k, 0) for k in prov.DEPARTURES)

    return dict(
        claims=dict(reference=len(rc), candidate=len(cc), matched=len(pairs),
                    overlap=len(pairs) / len(rc) if rc else 0.0,
                    precision=len(pairs) / len(cc) if cc else 0.0,
                    missed=missed, extra=extra,
                    pairs=[(round(r, 2), g, c) for r, g, c in pairs]),
        shape=dict(candidate=shape(cand), reference=shape(ref)),
        hygiene=dict(hygiene(cand_path), ref_apex=hygiene(ref_path)["apex"]),
        quotations=dict(checked=len(quotes), exact=exact,
                        failed=[f"{q['status']}: {q['title']}" for q in quotes
                                if q["status"] != "exact"]),
        provenance=dict(
            total=len(merged),
            with_chapter=sum(1 for r in merged.values() if r["data"].get("chapter")),
            placeable=sum(1 for r in merged.values()
                          if r["data"].get("section") or r["data"].get("source"))),
        fidelity=dict(marked=il["marked"], total=il["total"], census=il["census"],
                      departures=departures, unwarranted=len(unwarranted),
                      warrants=warrants),
    )


def report(s, cand_path, ref_path):
    """Printed in order of how much the number can be trusted, not in order of interest.

    The comparative metrics come LAST on purpose. A reader who sees "overlap 48%" at the top of a
    report reads it as a mark out of a hundred, and it is not one -- it is agreement with one
    considered reading of a text whose argument is exactly what is in dispute.
    """
    print(f"\n== {os.path.basename(cand_path)}")
    print(f"   against the reference reading in {os.path.basename(ref_path)}")

    # ---- 1. what needs no reference, and no interpretation ---------------- #
    q = s["quotations"]
    print(f"\n   QUOTATIONS -- the hard gate. A fabricated quotation is wrong on any reading.")
    print(f"      {q['exact']}/{q['checked']} verify verbatim against the source")
    for f in q["failed"][:8]:
        print(f"      ! {f}")

    h = s["hygiene"]
    print(f"\n   HYGIENE   {h['nodes']} nodes, {h['edges']} edges, "
          f"apex {h['apex']}, disconnected {h['disconnected']}")
    if h["disconnected"]:
        print(f"      ! {h['disconnected']} disconnected node(s) -- a claim wired to nothing is")
        print("        a defect whatever the reading")
    if h["apex"] != 1 and h["apex"] != h.get("ref_apex"):
        print(f"      ? {h['apex']} apex nodes against the reference's {h.get('ref_apex')}. More")
        print("        than one can be right -- the Darwin reference has two contentions -- but a")
        print("        long apex list usually means framing material was never attached, or an")
        print("        objection is inverted, which parses fine and is the costliest error here.")

    p_ = s["provenance"]
    print(f"\n   PROVENANCE  {p_['with_chapter']}/{p_['total']} cite a chapter, "
          f"{p_['placeable']}/{p_['total']} can be placed within it")

    f = s["fidelity"]
    print(f"\n   FIDELITY  {f['marked']}/{f['total']} marked "
          + (", ".join(f"{v} {k}" for k, v in f["census"].items() if v) or "none"))
    if f["departures"]:
        print(f"      {f['departures']} departure(s) from the text, "
              f"{f['unwarranted']} without a warrant")

    # ---- 2. comparative, but a question rather than a score --------------- #
    cs, rs = s["shape"]["candidate"], s["shape"]["reference"]
    print(f"\n   SHAPE -- linked vs convergent is a claim about the argument, not a taste.")
    print(f"      Sibling supports assert the reasons are INDEPENDENT. Differences here are")
    print(f"      worth reading; they do not say which side is right.")
    print(f"      {'':22}{'candidate':>10}{'reference':>11}")
    for k in ("arguments", "linked_edges", "support", "attack", "undercut"):
        print(f"      {k:<22}{cs[k]:>10}{rs[k]:>11}"
              + ("   <-- differs" if cs[k] != rs[k] else ""))

    # ---- 3. diagnostic only ----------------------------------------------- #
    c = s["claims"]
    print(f"\n   CLAIM OVERLAP -- DIAGNOSTIC, not a grade. Two competent readers carve one")
    print(f"      argument at different joints; this measures agreement with ONE reading.")
    print(f"      reference {c['reference']}, candidate {c['candidate']}, matched {c['matched']}"
          f"  ({c['overlap']:.0%} / {c['precision']:.0%})")
    if c["overlap"] < 0.25:
        print("      ! near-zero overlap is a tripwire: usually the wrong paper, a collapsed")
        print("        parse, or an extraction that found nothing.")
    if c["missed"]:
        print(f"      {len(c['missed'])} reference claim(s) with no counterpart: "
              + ", ".join(c["missed"][:6]) + (" …" if len(c["missed"]) > 6 else ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("candidate", nargs="?")
    ap.add_argument("--reference")
    ap.add_argument("--source-root")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--self-test", action="store_true",
                    help="score every reference file against itself; all must be perfect")
    a = ap.parse_args()

    if a.self_test:
        import glob
        fails = 0
        print("SELF-TEST -- every reference file scored against itself must be perfect.")
        for d in sorted(glob.glob(os.path.join(ROOT, "Argdown samples", "*/"))):
            fs = glob.glob(os.path.join(d, "*.argdown"))
            if not fs:
                continue
            s = score(fs[0], fs[0], d)
            c, q = s["claims"], s["quotations"]
            ok = (c["overlap"] == 1.0 and c["precision"] == 1.0
                  and q["exact"] == q["checked"] and s["hygiene"]["disconnected"] == 0)
            fails += not ok
            print(f"  {'ok  ' if ok else 'FAIL'}  {os.path.basename(d.rstrip('/'))[:44]:46}"
                  f" overlap {c['overlap']:.0%}  quotations {q['exact']}/{q['checked']}"
                  f"  apex {s['hygiene']['apex']}")
        print("\nall passed" if not fails else f"\n{fails} FAILED")
        return 1 if fails else 0

    if not a.candidate or not a.reference:
        ap.error("need CANDIDATE and --reference (or --self-test)")
    s = score(a.candidate, a.reference,
              os.path.abspath(os.path.expanduser(a.source_root)) if a.source_root else None)
    if a.json:
        print(json.dumps(s, indent=2))
    else:
        report(s, a.candidate, a.reference)
    return 0


if __name__ == "__main__":
    sys.exit(main())
