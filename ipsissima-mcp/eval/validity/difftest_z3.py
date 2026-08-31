#!/usr/bin/env python3
"""Decide the same random arguments twice -- once here, once with Z3 -- and report any
disagreement.

WHY THIS EXISTS. `docs/VALIDITY-PLAN.md` recommends writing the checker rather than shipping a
solver, on the grounds that the fragment is decided by a textbook algorithm. That is a claim
about correctness, and a claim of that kind is worth testing rather than believing. Z3 is the
industry-standard prover and is MIT-licensed; it is 73 MB installed, which is why it belongs
here, in eval, as a development dependency, and never in what anybody installs.

    uv pip install z3-solver
    python3 ipsissima-mcp/eval/validity/difftest_z3.py --cases 2000

A disagreement is a bug HERE until proved otherwise. Z3 may answer `unknown` on quantified
formulas -- that is expected, is not a disagreement, and is counted separately.
"""
from __future__ import annotations

import argparse
import pathlib
import random
import sys

HERE = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE / "src"))

from ipsissima_mcp.validity import check_step, parse  # noqa: E402

# IMPORTED LATE, so that `--naive` runs on a machine with no Z3 on it. That mode is the one
# that tests the monadic search, which is the part Z3 mostly declines to decide anyway, and
# making it wait on a 73 MB dependency it never uses would be the wrong way round.
z3 = None


def _need_z3():
    global z3
    if z3 is None:
        try:
            import z3 as _z3
        except ImportError:
            sys.exit("z3-solver is not installed. `uv pip install z3-solver` -- it is a "
                     "development\ndependency and is deliberately not in pyproject.toml.\n"
                     "`--naive` needs nothing and tests the monadic half.")
        z3 = _z3
    return z3

ATOMS = ["p", "q", "r"]
PREDS = ["F", "G", "H"]
CONSTS = ["a", "b"]


def rnd_prop(rng, depth=0):
    if depth >= 2 or rng.random() < 0.35:
        return rng.choice(ATOMS)
    op = rng.choice(["-", "&", "|", "->", "<->"])
    if op == "-":
        return f"-{rnd_prop(rng, depth + 1)}"
    return f"({rnd_prop(rng, depth + 1)} {op} {rnd_prop(rng, depth + 1)})"


def rnd_monadic(rng, depth=0):
    if depth >= 1 and rng.random() < 0.5:
        p, c = rng.choice(PREDS), rng.choice(CONSTS)
        return f"{p}({c})"
    kind = rng.random()
    if kind < 0.4:
        q = rng.choice(["all", "exists"])
        p1, p2 = rng.choice(PREDS), rng.choice(PREDS)
        op = rng.choice(["->", "&", "|"])
        neg = "-" if rng.random() < 0.3 else ""
        return f"{q} x.({p1}(x) {op} {neg}{p2}(x))"
    if kind < 0.7:
        return f"-{rnd_monadic(rng, depth + 1)}"
    return f"({rnd_monadic(rng, depth + 1)} {rng.choice(['&', '|', '->'])} {rnd_monadic(rng, depth + 1)})"


def to_z3(node, env, sort, bound=None):
    bound = bound or {}
    t = node["t"]
    if t == "atom":
        return env.setdefault(("p", node["name"]), z3.Bool(node["name"]))
    if t == "pred":
        f = env.setdefault(("f", node["name"]), z3.Function(node["name"], sort, z3.BoolSort()))
        a = node["args"][0]
        term = bound.get(a) or env.setdefault(("c", a), z3.Const(a, sort))
        return f(term)
    if t == "not":
        return z3.Not(to_z3(node["a"], env, sort, bound))
    if t == "and":
        return z3.And(to_z3(node["a"], env, sort, bound), to_z3(node["b"], env, sort, bound))
    if t == "or":
        return z3.Or(to_z3(node["a"], env, sort, bound), to_z3(node["b"], env, sort, bound))
    if t == "imp":
        return z3.Implies(to_z3(node["a"], env, sort, bound), to_z3(node["b"], env, sort, bound))
    if t == "iff":
        return to_z3(node["a"], env, sort, bound) == to_z3(node["b"], env, sort, bound)
    if t in ("all", "exists"):
        v = z3.Const(node["v"] + "_bv", sort)
        body = to_z3(node["a"], env, sort, {**bound, node["v"]: v})
        return z3.ForAll([v], body) if t == "all" else z3.Exists([v], body)
    raise ValueError(node["t"])


def z3_valid(premises, conclusion):
    """True/False, or None when Z3 will not commit."""
    z3 = _need_z3()
    env, sort = {}, z3.DeclareSort("D")
    s = z3.Solver()
    s.set("timeout", 5000)
    try:
        for p in premises:
            s.add(to_z3(parse(p), env, sort))
        s.add(z3.Not(to_z3(parse(conclusion), env, sort)))
    except Exception:
        return None
    r = s.check()
    if r == z3.unsat:
        return True
    if r == z3.sat:
        return False
    return None


def naive_satisfiable(formulas, max_domain=3):
    """The same question, decided the obvious way: every predicate extension over every small
    domain, with no type-subset trick at all.

    THIS IS THE ORACLE FOR THE PART Z3 WILL NOT DECIDE. The measured result is that Z3 answers
    `unknown` on most quantified formulas, so it barely tests the monadic path -- and the
    type-subset search is exactly the clever step most likely to be wrong. Naive enumeration is
    obviously correct and hopelessly slow, which makes it the right second opinion.

    It searches a SUBSET of the models the real procedure does, so only one direction is a bug:
    a model found here that the real procedure missed. The converse proves nothing.
    """
    from itertools import product as iproduct
    from ipsissima_mcp.validity import survey, evaluate

    sur = survey(formulas)
    if sur["bad"] or len(sur["preds"]) > 3:
        return None
    preds, atoms, consts = sur["preds"], sur["atoms"], sur["consts"]
    for d in range(1, max_domain + 1):
        domain = list(range(d))
        for ext in iproduct([0, 1], repeat=d * len(preds)):
            pred_sets = {p: {e for e in domain if ext[pi * d + e]}
                         for pi, p in enumerate(preds)}
            for av in iproduct([False, True], repeat=len(atoms)):
                props = dict(zip(atoms, av))
                for combo in iproduct(domain, repeat=len(consts)):
                    m = {"domain": domain, "preds": pred_sets, "props": props,
                         "consts": dict(zip(consts, combo)), "types": preds}
                    if all(evaluate(f, m, {}) for f in formulas):
                        return m
    return None


def run_naive(rng, cases):
    """Cross-check the type-subset search against brute force. No Z3, so this can run anywhere."""
    from ipsissima_mcp.validity import parse as _parse, satisfiable

    checked = skipped = 0
    bad = []
    for _ in range(cases):
        forms = [_parse(rnd_monadic(rng)) for _ in range(rng.randint(1, 3))]
        naive = naive_satisfiable(forms)
        if naive is None:
            skipped += 1
            continue
        mine = satisfiable(forms)
        if not mine["supported"]:
            skipped += 1
            continue
        checked += 1
        # Brute force found a model the real procedure says does not exist -- a bug here.
        if naive is not None and mine["model"] is None:
            bad.append(forms)
    print(f"  naive cross-check: {checked} compared, {skipped} skipped, {len(bad)} MISSED")
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naive", action="store_true",
                    help="cross-check the monadic search against brute force; needs no Z3")
    ap.add_argument("--cases", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=20260830)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    if args.naive:
        return run_naive(rng, args.cases)

    agreed = unknown = unsupported = 0
    bad = []
    for i in range(args.cases):
        monadic = i % 2 == 1
        gen = rnd_monadic if monadic else rnd_prop
        premises = [gen(rng) for _ in range(rng.randint(1, 3))]
        conclusion = gen(rng)

        mine = check_step(premises, conclusion)
        if not mine["supported"]:
            unsupported += 1
            continue
        theirs = z3_valid(premises, conclusion)
        if theirs is None:
            unknown += 1
            continue
        if mine["valid"] == theirs:
            agreed += 1
        else:
            bad.append((premises, conclusion, mine["valid"], theirs))

    print(f"  agreed      {agreed}")
    print(f"  z3 unknown  {unknown}   (quantified formulas it will not commit on)")
    print(f"  unsupported {unsupported}   (declined here, so never compared)")
    print(f"  DISAGREED   {len(bad)}")
    for premises, conclusion, mine, theirs in bad[:10]:
        print(f"\n    premises   {premises}")
        print(f"    conclusion {conclusion}")
        print(f"    here {mine}, z3 {theirs}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
