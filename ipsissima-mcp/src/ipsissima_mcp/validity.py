"""Does the step do what its rule name says it does?

An Argdown inference line may name a rule -- ``-- Modus ponens {uses: [1, 2]} --`` -- and until
now nothing checked it. This decides, for a step whose premises and conclusion carry
``formalization:``, whether the conclusion actually follows.

**This is one half of a pair.** ``app/src/argdown-validity.js`` is the other, so that the page
somebody was emailed can re-check a step as they edit it. The two MUST agree, and
``tests/validity-vectors.json`` is the file that makes them: both implementations run it and any
divergence fails the suite. ``docs/VALIDITY-PLAN.md`` records why this is written here rather
than delegated to Z3 -- measured, its WebAssembly build is 33 MB against a 2.5 MB page and needs
COOP/COEP headers a ``file://`` load cannot have.

WHAT IS DECIDED, AND WHAT IS NOT:

* **propositional** -- complete. Truth table over the atoms.
* **monadic predicate** -- complete for the fragment *without equality and without function
  symbols*. Monadic logic has the finite model property: elements sharing a type (the set of
  predicates they satisfy) are indistinguishable to a monadic formula, so one element per
  occupied type suffices and there are only ``2**k`` types.
* **anything else** -- reported unsupported, never guessed at.

The last case is the point. An honest "I cannot decide this" is a different thing from
"invalid", and a checker that conflated them would be worse than no checker.
"""

from __future__ import annotations

import itertools
import re
from itertools import product
from typing import Any

#: 2**(2**4) = 65536 type-subsets is a search; 2**(2**5) is not.
MAX_PREDICATES = 4
#: Beyond this, say so rather than spend a second of somebody's keystroke on it.
MAX_MODELS = 400_000

_TOKEN = re.compile(r"\s*(<->|->|<=>|=>|&&|\|\||[&|().,\-!~]|[A-Za-z_][A-Za-z0-9_]*)")


class FormulaError(ValueError):
    """A formalization that cannot be read. Never a verdict about an argument."""


def lex(src: str) -> list[str]:
    """NLTK's syntax, because that is what `debatelab/argdown-feedback` parses and a
    formalization should mean the same thing in both tools. Negation is ``-`` or ``!``.

    ``~`` IS REJECTED, DELIBERATELY. NLTK reads ``~p`` as an ATOM NAMED "~p" rather than as a
    negation -- verified, it returns a ConstantExpression -- so a step written with ``~`` is
    satisfiable for the wrong reason and an invalid argument passes silently. Accepting it as
    negation here would be worse: the same file would then mean two things in two tools.
    """
    out: list[str] = []
    i = 0
    while i < len(src):
        m = _TOKEN.match(src, i)
        if not m:
            if not src[i:].strip():
                break
            raise FormulaError(f"cannot read `{src[i:].strip()[:12]}`")
        i = m.end()
        tok = m.group(1)
        if tok == "~":
            raise FormulaError('`~` is not negation -- NLTK reads `~p` as an atom called "~p". '
                               "Write `-p` or `!p`.")
        out.append({"&&": "&", "||": "|", "=>": "->", "<=>": "<->"}.get(tok, tok))
    return out


def parse(src: str) -> dict:
    """Recursive descent, lowest precedence first: ``<->`` then ``->`` (right) then ``|`` then
    ``&`` then unary."""
    ts = lex(str(src))
    pos = 0

    def peek():
        return ts[pos] if pos < len(ts) else None

    def is_name(t):
        return t is not None and re.match(r"^[A-Za-z_]", t) is not None

    def eat(t):
        nonlocal pos
        if peek() != t:
            found = f"`{peek()}`" if peek() is not None else "end"
            raise FormulaError(f"expected `{t}`, found {found}")
        pos += 1

    def iff():
        nonlocal pos
        a = imp()
        while peek() == "<->":
            pos += 1
            a = {"t": "iff", "a": a, "b": imp()}
        return a

    def imp():
        nonlocal pos
        a = or_()
        if peek() == "->":
            pos += 1
            return {"t": "imp", "a": a, "b": imp()}     # right associative
        return a

    def or_():
        nonlocal pos
        a = and_()
        while peek() == "|":
            pos += 1
            a = {"t": "or", "a": a, "b": and_()}
        return a

    def and_():
        nonlocal pos
        a = unary()
        while peek() == "&":
            pos += 1
            a = {"t": "and", "a": a, "b": unary()}
        return a

    def unary():
        nonlocal pos
        t = peek()
        if t in ("-", "!"):
            pos += 1
            return {"t": "not", "a": unary()}
        if t in ("all", "exists"):
            pos += 1
            v = peek()
            if not is_name(v):
                raise FormulaError(f"expected a variable after `{t}`")
            pos += 1
            eat(".")
            return {"t": t, "v": v, "a": unary()}
        if t == "(":
            pos += 1
            e = iff()
            eat(")")
            return e
        if is_name(t):
            pos += 1
            if peek() == "(":
                pos += 1
                args = []
                while True:
                    a = peek()
                    if not is_name(a):
                        raise FormulaError(f"expected a term inside `{t}(...)`")
                    args.append(a)
                    pos += 1
                    if peek() == ",":
                        pos += 1
                        continue
                    break
                eat(")")
                return {"t": "pred", "name": t, "args": args}
            return {"t": "atom", "name": t}
        raise FormulaError("formula ended early" if t is None else f"unexpected `{t}`")

    e = iff()
    if pos != len(ts):
        raise FormulaError(f"trailing `{ts[pos]}`")
    return e


def survey(formulas: list[dict]) -> dict:
    """What the formulas are made of: propositional atoms, one-place predicates, constants."""
    atoms: set[str] = set()
    preds: set[str] = set()
    consts: set[str] = set()
    bad: str | None = None

    def walk(n, bound):
        nonlocal bad
        k = n["t"]
        if k == "atom":
            atoms.add(n["name"])
        elif k == "pred":
            if len(n["args"]) != 1 and bad is None:
                bad = (f"`{n['name']}` takes {len(n['args'])} arguments; only one-place "
                       "predicates are decided here")
            preds.add(n["name"])
            for a in n["args"]:
                if a not in bound:
                    consts.add(a)
        elif k == "not":
            walk(n["a"], bound)
        elif k in ("all", "exists"):
            walk(n["a"], bound | {n["v"]})
        else:
            walk(n["a"], bound)
            walk(n["b"], bound)

    for f in formulas:
        walk(f, frozenset())
    return {"atoms": sorted(atoms), "preds": sorted(preds), "consts": sorted(consts), "bad": bad}


def evaluate(n: dict, m: dict, g: dict) -> bool:
    k = n["t"]
    if k == "atom":
        return bool(m["props"][n["name"]])
    if k == "pred":
        a = n["args"][0]
        return (g[a] if a in g else m["consts"][a]) in m["preds"][n["name"]]
    if k == "not":
        return not evaluate(n["a"], m, g)
    if k == "and":
        return evaluate(n["a"], m, g) and evaluate(n["b"], m, g)
    if k == "or":
        return evaluate(n["a"], m, g) or evaluate(n["b"], m, g)
    if k == "imp":
        return (not evaluate(n["a"], m, g)) or evaluate(n["b"], m, g)
    if k == "iff":
        return evaluate(n["a"], m, g) == evaluate(n["b"], m, g)
    if k == "all":
        return all(evaluate(n["a"], m, {**g, n["v"]: d}) for d in m["domain"])
    if k == "exists":
        return any(evaluate(n["a"], m, {**g, n["v"]: d}) for d in m["domain"])
    raise FormulaError(f"unknown node {k}")


def _search_size(sur: dict) -> int:
    k = len(sur["preds"])
    subsets = 1 if k == 0 else 2 ** (2 ** k) - 1
    worst_domain = 1 if k == 0 else 2 ** k
    return subsets * 2 ** len(sur["atoms"]) * worst_domain ** len(sur["consts"])


def _models(sur: dict):
    """ONE ELEMENT PER OCCUPIED TYPE. A "type" is a set of predicates, so with k predicates
    there are 2**k of them. Two elements of the same type satisfy exactly the same monadic
    formulas, so a model that repeats a type decides nothing a model with one of each does not
    -- which is why walking the 2**(2**k) subsets is a decision procedure and not a sampling.

    Equality is what would break it: `exists x. exists y. -(x = y)` tells apart models this
    search deliberately identifies. That is why equality is not in the accepted syntax.
    """
    atoms, preds, consts = sur["atoms"], sur["preds"], sur["consts"]
    k = len(preds)
    n_types = 1 << k
    masks = [None] if k == 0 else range(1, 1 << n_types)

    for mask in masks:
        if k == 0:
            domain, pred_sets = [0], {}
        else:
            domain = [ty for ty in range(n_types) if mask & (1 << ty)]
            pred_sets = {preds[pi]: {d for d in domain if d & (1 << pi)} for pi in range(k)}
        for av in range(1 << len(atoms)):
            props = {a: bool(av & (1 << ai)) for ai, a in enumerate(atoms)}
            for combo in product(domain, repeat=len(consts)):
                yield {"domain": domain, "preds": pred_sets, "props": props,
                       "consts": dict(zip(consts, combo)), "types": preds}


def satisfiable(formulas: list[dict]) -> dict:
    """Returns ``{"supported": True, "model": m|None}`` or ``{"supported": False, "reason": s}``."""
    sur = survey(formulas)
    if sur["bad"]:
        return {"supported": False, "reason": sur["bad"]}
    if len(sur["preds"]) > MAX_PREDICATES:
        return {"supported": False,
                "reason": f"{len(sur['preds'])} predicates is beyond the bounded search "
                          f"(limit {MAX_PREDICATES})"}
    if _search_size(sur) > MAX_MODELS:
        return {"supported": False, "reason": "the search space is too large to decide here"}
    for m in _models(sur):
        if all(evaluate(f, m, {}) for f in formulas):
            return {"supported": True, "model": m}
    return {"supported": True, "model": None}


def describe(m: dict | None) -> dict | None:
    """A countermodel a reader can hold, rather than a bitmask."""
    if m is None:
        return None
    out: dict[str, Any] = {a: m["props"][a] for a in sorted(m["props"])}
    if m["types"]:
        out["domain"] = [f"e{i}" for i, _ in enumerate(m["domain"])]
        for pi, p in enumerate(m["types"]):
            out[p] = [f"e{m['domain'].index(d)}" for d in m["domain"] if d & (1 << pi)]
        for c in sorted(m["consts"]):
            out[c] = f"e{m['domain'].index(m['consts'][c])}"
    return out


def check_step(premises: list[str], conclusion: str) -> dict:
    """Decide a step from its formalization strings.

    Returns ``supported``, and when supported ``valid``, ``countermodel``, and -- only when the
    step is valid -- ``irrelevant`` (1-based premise numbers doing no work) and ``consistent``.
    ``supported: False`` with an ``error`` is a real answer and must never be drawn as invalid.
    """
    asts = []
    for i, p in enumerate(premises):
        try:
            asts.append(parse(p))
        except FormulaError as e:
            return {"supported": False, "error": f"premise {i + 1}: {e}"}
    try:
        concl = parse(conclusion)
    except FormulaError as e:
        return {"supported": False, "error": f"conclusion: {e}"}

    negated = {"t": "not", "a": concl}
    v = satisfiable(asts + [negated])
    if not v["supported"]:
        return {"supported": False, "error": v["reason"]}

    out: dict[str, Any] = {"supported": True, "valid": v["model"] is None,
                           "countermodel": describe(v["model"])}
    # PREMISES THAT DO NO WORK, and premises that cannot all hold. Both are only worth asking of
    # a VALID step: of an invalid one they say nothing a reader can act on.
    if out["valid"]:
        irrelevant = []
        for i in range(len(asts)):
            w = satisfiable(asts[:i] + asts[i + 1:] + [negated])
            if w["supported"] and w["model"] is None:
                irrelevant.append(i + 1)
        out["irrelevant"] = irrelevant
        c = satisfiable(asts)
        out["consistent"] = None if not c["supported"] else c["model"] is not None
    return out


# ---- the stamp: does this formalization still belong to this claim? -------------------------
#
# A ``formalization`` is written BY HAND, once, and nothing afterwards ties it to the sentence it
# stands for. Edit the claim and the formula stays put -- and the checker will decide the step,
# correctly, about formulas that no longer say what the claim says. That is worse than an
# unchecked step, because it wears the badge of having been checked.
#
# FNV-1a, 32 bits, over the text lowercased and with its whitespace collapsed: a re-wrapped line
# or a capitalised first letter is not a change to what the claim SAYS.
#
# WRITTEN IDENTICALLY IN JAVASCRIPT, and both are checked against shared vectors, because a stamp
# that means one thing in the page and another in the checker is worse than no stamp at all.

def stamp(text: str) -> str:
    """A short hash of what the claim says, for noticing that it no longer says it."""
    t = " ".join(str(text or "").lower().split())
    h = 0x811C9DC5
    for b in t.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


# ---- is the step the rule it names? ---------------------------------------------------------
#
# THE VERDICT NEVER READS THE NAME -- `check_step` decides from the formalizations alone, and
# would reach the same answer if the line said `-- Banana --`. So a valid step wearing the wrong
# canonical name passed quietly, and the map then printed the name in the checked style: the one
# self-claim in the system that was drawn as vouched-for without being examined. The fidelity
# markers already taught what happens to labels that feel checked -- wrong 38 times in 126,
# always in the same direction, and instruction alone did not fix them
# (docs/values/INVENTORY.md, A11; ALIGNMENT-PLAN item 5).
#
# WHAT THIS IS AND IS NOT. Matching a schema is bounded second-order pattern matching -- each
# schema letter binds one sub-formula, consistently across the rule -- which is a different and
# far smaller job than the "is it the rule" form-recognition VALIDITY-PLAN.md 6 declined, because
# it only ever runs against the fixed schemas below. It answers for the CANONICAL names alone: a
# name of the reconstructor's own is a label, not a claim to a known form, and is never matched.
# The quantifier rules and reductio are recognised and exempt -- UI/UG/EI/EG turn on variable
# binding this file's fragment does not represent schematically, and a reductio's shape is a
# discharged supposition, not a premise list.

_UNMATCHABLE = frozenset([
    "universal instantiation", "universal generalisation", "universal generalization",
    "existential instantiation", "existential generalisation", "existential generalization",
    "reductio ad absurdum",
])

#: Schemas as (premises, conclusion), several variants where the textbooks state several.
#: `&`, `|` and `<->` match commutatively (see `_match`), so one variant covers both orders.
_RULE_SCHEMAS: dict[str, list[tuple[list[str], str]]] = {
    "modus ponens": [(["P -> Q", "P"], "Q")],
    "modus tollens": [(["P -> Q", "-Q"], "-P")],
    "hypothetical syllogism": [(["P -> Q", "Q -> R"], "P -> R")],
    "disjunctive syllogism": [(["P | Q", "-P"], "Q")],
    "constructive dilemma": [(["P -> Q", "R -> S", "P | R"], "Q | S"),
                             (["(P -> Q) & (R -> S)", "P | R"], "Q | S")],
    "destructive dilemma": [(["P -> Q", "R -> S", "-Q | -S"], "-P | -R"),
                            (["(P -> Q) & (R -> S)", "-Q | -S"], "-P | -R")],
    "simplification": [(["P & Q"], "P")],
    "conjunction": [(["P", "Q"], "P & Q")],
    "addition": [(["P"], "P | Q")],
    "double negation": [(["--P"], "P"), (["P"], "--P")],
    "de morgan": [(["-(P & Q)"], "-P | -Q"), (["-P | -Q"], "-(P & Q)"),
                  (["-(P | Q)"], "-P & -Q"), (["-P & -Q"], "-(P | Q)")],
    "contraposition": [(["P -> Q"], "-Q -> -P"), (["-Q -> -P"], "P -> Q")],
    "biconditional elimination": [(["P <-> Q"], "P -> Q"), (["P <-> Q"], "Q -> P"),
                                  (["P <-> Q", "P"], "Q"), (["P <-> Q", "Q"], "P")],
}

_ALIASES = {"demorgan": "de morgan", "de morgans": "de morgan",
            "de morgan s": "de morgan", "de morgan s law": "de morgan",
            "de morgan s laws": "de morgan", "demorgans": "de morgan"}

_COMMUTES = frozenset(["and", "or", "iff"])


def _canon(name: str) -> str:
    key = " ".join(re.sub(r"[^a-z]+", " ", str(name or "").lower()).split())
    return _ALIASES.get(key, key)


def _match(schema: dict, node: dict, env: dict):
    """Every consistent binding of the schema's letters to sub-formulas of `node`."""
    t = schema["t"]
    if t == "atom":
        name = schema["name"]
        if name in env:
            if env[name] == node:
                yield env
        else:
            yield {**env, name: node}
        return
    if node.get("t") != t:
        return
    if t == "not":
        yield from _match(schema["a"], node["a"], env)
        return
    for got in _match(schema["a"], node["a"], env):
        yield from _match(schema["b"], node["b"], got)
    if t in _COMMUTES:
        for got in _match(schema["a"], node["b"], env):
            yield from _match(schema["b"], node["a"], got)


def _match_all(schemas: list[dict], nodes: list[dict], env: dict):
    if not schemas:
        yield env
        return
    for got in _match(schemas[0], nodes[0], env):
        yield from _match_all(schemas[1:], nodes[1:], got)


def matches_rule(name: str, premises: list[str], conclusion: str):
    """True when the step instantiates the named rule's schema, False when the name is canonical
    and the step does not, None when the question cannot be put -- an unrecognised name, a rule
    this file exempts, or a formalization it cannot read. Premise order never matters."""
    key = _canon(name)
    if key in _UNMATCHABLE or key not in _RULE_SCHEMAS:
        return None
    try:
        ps = [parse(p) for p in premises]
        c = parse(conclusion)
    except FormulaError:
        return None
    for want_ps, want_c in _RULE_SCHEMAS[key]:
        if len(want_ps) != len(ps):
            continue
        sp = [parse(s) for s in want_ps]
        sc = parse(want_c)
        for perm in itertools.permutations(ps):
            for env in _match_all(sp, list(perm), {}):
                if any(True for _ in _match(sc, c, env)):
                    return True
    return False
