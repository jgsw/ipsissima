#!/usr/bin/env python3
"""The Python half of the pair, against the shared vectors.

`app/test_validity.mjs` runs the SAME file. Two implementations of one decision procedure will
drift, and this is the thing that stops them: an expectation written once, checked twice.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from ipsissima_mcp.validity import check_step, stamp  # noqa: E402

VECTORS = json.loads((HERE / "validity-vectors.json").read_text())

fails = 0
for case in VECTORS["cases"]:
    got = check_step(case["premises"], case["conclusion"])
    problems = []

    if got["supported"] != case["supported"]:
        problems.append(f"supported={got['supported']}, expected {case['supported']}")
    elif not case["supported"]:
        want = case.get("error_contains")
        if want and want not in got.get("error", ""):
            problems.append(f"error {got.get('error')!r} does not mention {want!r}")
    else:
        for key in ("valid", "irrelevant", "consistent"):
            if key in case and got.get(key) != case[key]:
                problems.append(f"{key}={got.get(key)!r}, expected {case[key]!r}")
        # An invalid step must hand back a countermodel; a valid one must not pretend to have one.
        if got["valid"] and got["countermodel"] is not None:
            problems.append("valid but carries a countermodel")
        if not got["valid"] and got["countermodel"] is None:
            problems.append("invalid but names no countermodel")

    if problems:
        fails += 1
        print(f"  FAIL  {case['name']}")
        for p in problems:
            print(f"          {p}")
    else:
        print(f"  ok    {case['name']}")

# BEFORE the exit, not after it. Written below `sys.exit(1)` these ran only when everything else
# had already passed, and could never fail the suite on their own -- the same slip in both halves.
for v in VECTORS.get("stamps", []):
    got = stamp(v["text"])
    if got != v["stamp"]:
        print(f"  FAIL  stamp {v['name']}: expected {v['stamp']}, got {got}")
        fails += 1

print()
if fails:
    print(f"{fails} check(s) failed")
    sys.exit(1)
print(f"all {len(VECTORS['cases'])} vectors and {len(VECTORS.get('stamps', []))} stamps pass")
