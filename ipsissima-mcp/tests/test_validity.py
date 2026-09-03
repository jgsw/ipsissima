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

from ipsissima_mcp.validity import check_step, matches_rule, stamp, stamp_of_claim  # noqa: E402

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

# ---- is the step the rule it names? ---------------------------------------------------------
# The verdict never reads the name, so a valid step wearing the wrong canonical name passed
# quietly (ALIGNMENT-PLAN item 5). These pin `matches_rule`'s three answers: True for an
# instantiation (premise order and commutative operand order free), False for a canonical name
# the step's shape is not, None where the question cannot be put at all.
#
# SHOWN ABLE TO FAIL, 3 Sep 2026: removing the commutative branch in `_match` fails the
# reversed-disjunct and right-conjunct cases; removing `modus tollens` from _RULE_SCHEMAS turns
# the flagship case into a silent None. A harness that has never failed is worth nothing.
SCHEMA_CASES = [
    # name, premises, conclusion, expected
    ("modus ponens named and meant", "modus ponens",
     ["p -> q", "p"], "q", True),
    ("the flagship: a modus ponens labelled modus tollens is flagged", "Modus tollens",
     ["p -> q", "p"], "q", False),
    ("  and a real modus tollens is not", "Modus tollens",
     ["p -> q", "-q"], "-p", True),
    ("schema letters bind whole sub-formulas", "modus ponens",
     ["(a & b) -> (c | d)", "a & b"], "c | d", True),
    ("premise order never matters", "modus ponens",
     ["p", "p -> q"], "q", True),
    ("disjunctive syllogism with the disjuncts reversed", "disjunctive syllogism",
     ["q | p", "-p"], "q", True),
    ("simplification to the right conjunct", "simplification",
     ["p & q"], "q", True),
    ("hypothetical syllogism", "hypothetical syllogism",
     ["p -> q", "q -> r"], "p -> r", True),
    ("  but a chain in the wrong direction is not one", "hypothetical syllogism",
     ["p -> q", "r -> q"], "p -> r", False),
    ("contraposition, both directions", "contraposition",
     ["p -> q"], "-q -> -p", True),
    ("addition's new disjunct binds from the conclusion", "addition",
     ["p"], "p | r", True),
    ("double negation, introduced as well as eliminated", "double negation",
     ["p"], "--p", True),
    ("constructive dilemma with conjoined conditionals", "constructive dilemma",
     [" (p -> q) & (r -> s)", "p | r"], "q | s", True),
    ("a de Morgan under its one-word alias", "DeMorgan",
     ["-(p & q)"], "-p | -q", True),
    ("an extra premise means it is not the two-line rule", "modus ponens",
     ["p -> q", "p", "r"], "q", False),
    ("a name of the reconstructor's own asks nothing", "the null-advice principle",
     ["p -> q", "p"], "q", None),
    ("reductio is recognised and exempt", "reductio ad absurdum",
     ["p -> (q & -q)"], "-p", None),
    ("a formalization the parser cannot read asks nothing", "modus ponens",
     ["p ->"], "q", None),
]
for name, rule, ps, c, want in SCHEMA_CASES:
    got = matches_rule(rule, ps, c)
    if got is not want:
        fails += 1
        print(f"  FAIL  {name}: matches_rule={got!r}, expected {want!r}")
    else:
        print(f"  ok    {name}")

# THE STAMP OF A CLAIM IGNORES ITS TAGS. The browser's parse hands the page tag-less member
# text while the Python JSON can keep a trailing tag, and the first tagged claim ever stamped
# (Carroll's, 3 Sep 2026) was stamped against one string and checked against the other — a
# wavy NOT-checked bar over an unedited step. Shown able to fail: route either caller back to
# bare `stamp` and this disagrees.
if stamp_of_claim("He must accept Z. #reported") == stamp("He must accept Z."):
    print("  ok    a tag is attribution, not content: the stamp ignores it")
else:
    fails += 1
    print("  FAIL  a tag is attribution, not content: the stamp ignores it")
if stamp_of_claim("Plain words with no tag at all here") == stamp("Plain words with no tag at all here"):
    print("  ok      and an untagged claim stamps exactly as before")
else:
    fails += 1
    print("  FAIL    and an untagged claim stamps exactly as before")

print()
if fails:
    print(f"{fails} check(s) failed")
    sys.exit(1)
print(f"all {len(VECTORS['cases'])} vectors, {len(VECTORS.get('stamps', []))} stamps and "
      f"{len(SCHEMA_CASES)} schema cases pass")
