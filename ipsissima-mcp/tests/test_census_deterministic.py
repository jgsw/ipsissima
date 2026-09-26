#!/usr/bin/env python3
"""The census is the same on every run of the same file.

    python3 tests/test_census_deterministic.py

Found 26 Sep 2026: three runs of the checker on the unchanged Miller map gave three different
reports. `contribution` walked a set of titles, a set of strings iterates in an order that
Python re-randomises in every interpreter (PYTHONHASHSEED), and every ranked list downstream
printed its ties in that order -- the "most remote" claims at 7 steps, the tag counts, the
positions of claims sharing a line. Nothing was wrong except the order, but a report that
changes when nothing has changed reads as though something did, and no diff of two runs could
be trusted to show only what the edit did.

So: the same sample, once in prose and once as json, under two hash seeds that reshuffled it
before the fix; the output must be byte-identical apart from anything that times the run.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "ipsissima-mcp" / "src" / "ipsissima_mcp"
SAMPLE = REPO / "samples" / "Miller 2019 - Prorogation of Parliament"
MAP = SAMPLE / "miller-2019-uksc-41.argdown"

# Two seeds that gave different reports on this sample before the fix (checked by restoring
# the old code: seed 1 and seed 2 disagree on the order of the four claims at 7 steps).
SEEDS = ("1", "2")

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" +
          ("" if ok else f"\n          got  {got!r}\n          want {want!r}"))


def census(extra):
    """The checker's output under each seed, run side by side: each run is several seconds."""
    runs = []
    for seed in SEEDS:
        # The ledger is switched off: a test run is not a round of anyone's fix loop.
        env = dict(os.environ, PYTHONHASHSEED=seed, IPSISSIMA_CHECK_LOG="off")
        runs.append(subprocess.Popen([sys.executable, str(PKG / "check_argdown.py"), str(MAP),
                                      "--source-root", f"{SAMPLE}/", *extra],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True, env=env))
    out = []
    for r in runs:
        stdout, _ = r.communicate()
        # Nothing on stdout times the run today (the elapsed figure goes to the ledger); this
        # is here so that a timing printed later is not mistaken for nondeterminism.
        out.append((r.returncode, re.sub(r"(?im)^.*\belapsed\b.*$", "", stdout)))
    return out


def first_difference(a, b):
    """Where two outputs part, with a little either side -- the json census is one long line."""
    i = next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
    lo = max(0, i - 60)
    return a[lo:i + 60], b[lo:i + 60]


if not MAP.is_file():
    # A missing sample must not read as a passing check.
    check("the Miller sample is present", MAP.is_file(), True)
else:
    for label, extra in (("prose", ()), ("json", ("--format", "json"))):
        print(f"\nthe {label} census, PYTHONHASHSEED={SEEDS[0]} against {SEEDS[1]}")
        (rc_a, a), (rc_b, b) = census(extra)
        check("the checker ran", (rc_a, rc_b), (0, 0))
        check("  and said something", len(a) > 200, True)
        same = a == b
        if not same:
            x, y = first_difference(a, b)
            print(f"          first difference:\n            {x!r}\n            {y!r}")
        check("  identical output under both seeds", same, True)

print()
print("all passed" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
