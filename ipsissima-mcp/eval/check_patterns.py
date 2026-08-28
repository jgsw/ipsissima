#!/usr/bin/env python3
"""What the checker keeps finding — read out of the ledger `check_argdown.py` appends to.

    python3 ipsissima-mcp/eval/check_patterns.py [--log PATH] [--since YYYY-MM-DD]

WHY THIS EXISTS. "Which mistakes does a model actually make writing Argdown?" cannot be answered
from the corpus. Every map in `samples/` passed the checker before it was committed, so the
corpus records the destination and never the route. The mistakes happen inside the fix loop and
are edited away within minutes, and the evidence that would improve the instructions is destroyed
by the process that would have used it.

So the checker appends one line per run, and this reads them back. What it can show:

  ROUNDS        how many checks one file took before it came back clean. A file that took six
                rounds is an instruction problem, not a model problem.
  RECURRENCE    which checks fire most often across all files. A check that fires on nearly every
                first draft is naming something the instructions do not say clearly enough.
  FIRST ROUND   what the FIRST check of a file found, which is the honest measure of how good a
                map is before any feedback. Later rounds are contaminated by the checker itself.
  PARSE FAILURES  how often a draft did not parse at all, and it should be rare.

WHAT IT CANNOT SHOW is anything about the map's quality. A file that passes in one round can be a
misreport. This counts mechanical faults, which are the cheap half.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys

DEFAULT = os.environ.get("IPSISSIMA_CHECK_LOG") or os.path.join(
    os.path.expanduser("~"), ".ipsissima", "check-log.jsonl")


def load(path, since=None):
    if not os.path.exists(path):
        sys.exit(f"no ledger at {path}\n"
                 "It fills as reconstructions are checked; there is nothing to read yet.")
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if since and r.get("at", "") < since:
                continue
            rows.append(r)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", default=DEFAULT)
    ap.add_argument("--since", metavar="YYYY-MM-DD")
    a = ap.parse_args()
    rows = load(a.log, a.since)
    if not rows:
        sys.exit("the ledger is empty for that range.")

    print(f"\n  {len(rows)} checks over {len({r['file'] for r in rows})} files"
          f"  ({a.log})\n")

    # ---- rounds: one fix loop is one file with a changing content hash ---- #
    # A REPEATED HASH IS NOT A ROUND. Re-running the checker without editing is common --
    # the viewer build does it -- and counting those as rounds would flatter nothing and
    # mislead everything.
    by_file = collections.defaultdict(list)
    for r in rows:
        by_file[r["file"]].append(r)
    print("  ROUNDS TO CLEAN (distinct versions checked, first fault count -> last)")
    multi = []
    for f, rs in sorted(by_file.items()):
        seen, versions = set(), []
        for r in rs:
            if r.get("sha") not in seen:
                seen.add(r.get("sha"))
                versions.append(r)
        first, last = versions[0], versions[-1]
        multi.append(len(versions))
        flag = "" if last["faults"] == 0 else "   still failing"
        print(f"    {len(versions):>2} x  {f[:46]:<48}{first['faults']:>3} -> "
              f"{last['faults']:<3}{flag}")
    if multi:
        print(f"\n    mean {sum(multi)/len(multi):.1f} versions per file, "
              f"worst {max(multi)}")

    # ---- what fires, and how often -------------------------------------- #
    print("\n  RECURRENCE (every check, every round)")
    tally = collections.Counter()
    for r in rows:
        for k, n in (r.get("checks") or {}).items():
            tally[k] += n
    if not tally:
        print("    nothing has ever been found.")
    for k, n in tally.most_common():
        files = sum(1 for f, rs in by_file.items()
                    if any(k in (r.get("checks") or {}) for r in rs))
        print(f"    {n:>4}  {k:<28} on {files} file(s)")

    # ---- the first look at each file, which is the uncontaminated one ---- #
    print("\n  FIRST CHECK OF EACH FILE (before any feedback)")
    firsts = collections.Counter()
    clean_first = 0
    for f, rs in by_file.items():
        first = rs[0]
        if first["faults"] == 0:
            clean_first += 1
        for k, n in (first.get("checks") or {}).items():
            if k.startswith("!"):
                firsts[k] += n
    print(f"    {clean_first}/{len(by_file)} files were clean on the first check")
    for k, n in firsts.most_common(10):
        print(f"    {n:>4}  {k}")

    bad = [r for r in rows if not r.get("parsed", True)]
    print(f"\n  PARSE FAILURES: {len(bad)} of {len(rows)} runs"
          + (f"  ({', '.join(sorted({r['file'] for r in bad}))})" if bad else ""))

    el = [r["elapsed"] for r in rows if isinstance(r.get("elapsed"), (int, float))]
    if el:
        print(f"  TIME IN THE CHECKER: {sum(el):.0f}s total, {sum(el)/len(el):.1f}s mean, "
              f"{max(el):.1f}s worst\n")


if __name__ == "__main__":
    main()
