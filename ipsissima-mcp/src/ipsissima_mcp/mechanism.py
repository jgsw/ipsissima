"""The mechanism a text asserts: the chain of steps it says runs from a cause to its outcomes.

Ruled 26 Sep 2026, after a notation spike on three policy briefs. A reconstruction may carry,
beside its argument, the CAUSAL CHAIN the text sets out -- in Gross's sense (Sociological Theory
36, 2018), not Pearl's: steps enacted by actors at levels of social complexity, in sequence,
under stated conditions, with loops allowed. The argument map says what holds a claim up; the
chain says what the text says HAPPENS, and which of those happenings it actually backs.

THE NOTATION. Front matter declares the chain's cast once:

    mechanism:
        question: "How would ... ?"
        levels: [macro, meso, micro]          # top to bottom; this is the default
        actors:
            courts:   {label: "Courts and judges", level: meso}
        states:
            community: {label: "Community sentence instead of short custody", actor: courts}
            reoffending: {label: "Reoffending", actor: offender, role: outcome,
                          measured: "reconviction"}
            risk: {label: "Assessed risk", actor: offender, appraisal: true}

and a claim (or argument) that asserts a step says so in its metadata, one map or a list:

    {fidelity: "quotation", causes: {from: community, to: reoffending, sign: "-",
     basis: study, lag: "within five years", given: ["..."],
     how: {actor: offender, situation: "...", habit: "...", response: "..."}}}

`sign` may be "0": the text finds NO effect -- a finding, reported against the rival step it
answers and never walked. `selects: true` marks a selection link (who ends up on each side), also
reported and never walked. `hedged: true` marks a step the text puts as a possibility. All three
came out of the first trial of the mechanism pass (J-PAL bulletin, two blind annotators, 26 Sep
2026), whose central results are nulls the notation could not otherwise hold.

`causes:`, not `link:` -- the spike used `link:` and the checker's own typo detector read it as
`line:`. `basis` says what the TEXT offers for the step, which the argument map cannot say:
study, statistics, model, example, testimony, asserted. `how` is Gross's pragmatist
decomposition (2009): an actor, facing a problem situation, mobilising a habit, making a response.

THE APPRAISAL LAYER. A claim tagged #appraisal is the reconstructor's own reading of the chain
against the world -- a confounder, a missing link, a loop the text leaves open. It must be an
imputation with a warrant, it may touch states flagged `appraisal: true`, and no step the TEXT
asserts may. Every author-side measure is computed without it (see
argdown_provenance.without_appraisal).

WHAT THIS MODULE DOES NOT DO. It estimates no effects and identifies nothing: no do-calculus, no
probabilities of a chain firing. It reports the chain's STRUCTURE -- Gross's dimensions -- and its
LIGHT AND SHADOW: which steps the text backs with evidence, which it only argues or asserts, and
which the reconstructor supplied.
"""

import os
import re

DEFAULT_LEVELS = ["macro", "meso", "micro"]
BASES = ("study", "statistics", "model", "example", "testimony", "asserted")
#: WHAT A STATE IS TO THE CHAIN. `intervention`: the action the text recommends or the cause it
#: manipulates. `condition` (added in profile 1.1, 26 Sep 2026): a cause the text sets out from
#: without recommending it -- the explanans of an explanatory text. `outcome`: what the chain is
#: for -- the end a recommendation serves, or what an explanatory text explains. Merton's
#: prejudice is both the outcome his remedy is for and where his circle begins, which one role
#: could not say, so `role` may be a list.
ROLES = ("intervention", "condition", "outcome")

#: THE SIGNS. `+` raises, `-` lowers, `"0"` a finding of no effect -- and, since profile 1.2,
#: `which`: the step DECIDES WHICH of several alternatives follows, rather than raising or lowering
#: a quantity. Wimmer's institutions "determine which" strategy actors pursue; written unsigned,
#: dozens of his steps were drawn as a bare "link" that said nothing (26 Sep 2026).
SIGNS = ("+", "-", "0", "which")

#: Past this many loops through one system of states, the census names the SYSTEM and its
#: shortest loops rather than listing every loop: Wimmer's feedback is one densely connected
#: system, and listing its simple cycles hit the cap of 50 and said nothing a reader could use.
#: Below it every loop is listed, in order -- which is why cycles replaced components at first.
LOOPS_LISTED = 4


def roles_of(state):
    """The set of roles a state declares; `role` may be one name or a list of them."""
    r = (state or {}).get("role") if isinstance(state, dict) else None
    if r is None:
        return set()
    return {str(x) for x in (r if isinstance(r, list) else [r])}


#: Light and shadow, best first. `argued` also covers an asserted step the map gives support to.
TIERS = ("evidence", "argued", "asserted", "imputed")
_TIER_OF_BASIS = {"study": "evidence", "statistics": "evidence", "model": "evidence",
                  "example": "argued", "testimony": "argued", "asserted": "asserted"}
#: Enough routes to say "many"; counting every simple path in a dense chain is exponential.
ROUTE_CAP = 200


def read_block(frontmatter_text):
    """The `mechanism:` block, parsed as real YAML -- or (None, why) if it cannot be.

    THE HAND PARSER CANNOT READ IT, and was right not to try. argdown_provenance reads front
    matter with a deliberately small parser that understands `defaults:` and one flat list; the
    mechanism block is nested maps written in flow style, which that parser turned into
    `levels: must be a list` and no states at all on the first run. The app reads the same block
    through Argdown's own YAML, so reading it here with a YAML library is also what keeps the two
    halves agreeing. PyYAML is declared in pyproject.toml; it was already installed with
    rapidocr."""
    if not frontmatter_text:
        return None, None
    try:
        import yaml
    except ImportError:
        return None, "PyYAML is not installed, so the `mechanism:` block cannot be read"
    try:
        data = yaml.safe_load(frontmatter_text)
    except yaml.YAMLError as e:
        return None, f"the front matter is not valid YAML: {str(e).splitlines()[0]}"
    if not isinstance(data, dict):
        return None, None
    return data.get("mechanism"), None


def _data(node):
    """A node's metadata, first non-empty across the record and its members."""
    out = dict(node.get("data") or {})
    for m in node.get("members") or []:
        for k, v in (m.get("data") or {}).items():
            out.setdefault(k, v)
    return out


def declared(fm):
    """(mechanism block or None, levels, actors, states, problems) from the front matter."""
    m = (fm or {}).get("mechanism")
    if m is None:
        return None, DEFAULT_LEVELS, {}, {}, []
    problems = []
    if not isinstance(m, dict):
        return None, DEFAULT_LEVELS, {}, {}, [
            ("!", "`mechanism:` in the front matter must be a block of `levels`, `actors` and "
                  "`states`", {})]
    levels = m.get("levels") or DEFAULT_LEVELS
    if not isinstance(levels, list):
        problems.append(("!", "`levels:` must be a list, top level first", {}))
        levels = DEFAULT_LEVELS
    levels = [str(x) for x in levels]
    actors = m.get("actors") or {}
    states = m.get("states") or {}
    for name, block in (("actors", actors), ("states", states)):
        if not isinstance(block, dict):
            problems.append(("!", f"`{name}:` must map ids to their descriptions", {}))
    actors = actors if isinstance(actors, dict) else {}
    states = states if isinstance(states, dict) else {}
    for aid, a in actors.items():
        a = a if isinstance(a, dict) else {}
        if a.get("level") not in levels:
            problems.append(("!", f"actor `{aid}` has level `{a.get('level')}`, which is not "
                                  f"one of the declared levels ({', '.join(levels)})",
                             {"actor": str(aid)}))
    for sid, s in states.items():
        s = s if isinstance(s, dict) else {}
        if s.get("actor") not in actors:
            problems.append(("!", f"state `{sid}` names actor `{s.get('actor')}`, which is not "
                                  f"declared under `actors:`", {"state": str(sid)}))
        whole = s.get("part_of")
        if whole is not None and whole not in states:
            problems.append(("!", f"state `{sid}` is `part_of: {whole}`, which is not a declared "
                                  f"state", {"state": str(sid)}))
        elif whole == sid:
            problems.append(("!", f"state `{sid}` is `part_of` itself", {"state": str(sid)}))
        bad = roles_of(s) - set(ROLES)
        if bad:
            problems.append(("?", f"state `{sid}` has role `{sorted(bad)[0]}`; the roles read "
                                  f"are `intervention`, `condition` and `outcome`", {"state": str(sid)}))
    # A WHOLE MAY NOT CONTAIN ITSELF, however far round: the view collapses parts into their
    # outermost whole, and a cycle has none.
    for sid in states:
        seen, cur = {sid}, (states.get(sid) or {}).get("part_of") if isinstance(states.get(sid), dict) else None
        while cur in states and isinstance(states.get(cur), dict):
            if cur in seen:
                problems.append(("!", f"`part_of` runs in a circle through `{sid}`", {"state": str(sid)}))
                break
            seen.add(cur)
            cur = states[cur].get("part_of")
    return m, levels, actors, states, problems


def steps(doc, appraisal):
    """Every step asserted in the file, one record per step, with its claim's standing."""
    import argdown_provenance as prov
    supports = {}
    for a, b, kind in prov.title_edges(prov.without_appraisal(doc)):
        if kind == "support":
            supports[b] = supports.get(b, 0) + 1
    out = []
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            d = _data(node)
            if "causes" not in d:
                continue
            tags = prov.node_tags(node)
            layer = ("appraisal" if title in appraisal
                     else "rival" if "reported" in tags else "text")
            raw = d["causes"]
            for c in (raw if isinstance(raw, list) else [raw]):
                c = c if isinstance(c, dict) else {}
                imputed = d.get("fidelity") == "imputation"
                basis = c.get("basis")
                # `sign: 0` arrives from YAML as an int, `sign: "0"` as a string: one meaning.
                sign = None if c.get("sign") is None else str(c.get("sign"))
                tier = "imputed" if imputed else _TIER_OF_BASIS.get(basis, "asserted")
                if tier == "asserted" and supports.get(title):
                    tier = "argued"
                given = c.get("given") or []
                out.append(dict(
                    title=title, kind=kind, layer=layer, tags=sorted(tags),
                    fidelity=d.get("fidelity"), warrant=d.get("warrant"),
                    src=c.get("from"), dst=c.get("to"), sign=sign,
                    # NULL: the text finds NO effect here -- a finding, not an absence (trial of
                    # 26 Sep: the J-PAL bulletin's central results are nulls, and without a form
                    # for them the chain drew only the rival steps they refute).
                    null=(sign == "0"),
                    # SELECTION: a link that holds because of WHO ends up on each side -- the
                    # screening effect -- not because one state brings the other about.
                    selects=bool(c.get("selects")),
                    hedged=bool(c.get("hedged")),
                    basis=basis, tier=tier, lag=c.get("lag"),
                    given=given if isinstance(given, list) else [given],
                    how=c.get("how"), reflexive=bool(c.get("reflexive")),
                    supports=supports.get(title, 0), raw=c))
    return out


def _reach(start, edges):
    seen, q = {start}, [start]
    while q:
        s = q.pop()
        for a, b in edges:
            if a == s and b not in seen:
                seen.add(b)
                q.append(b)
    return seen


LOOP_CAP = 50


def _systems(ids, edges):
    """The feedback systems: sets of states each reachable from every other (Tarjan), in the
    declared order, two or more states each. Reported beside the loops, not instead of them."""
    adj = _adjacency(edges, ids)
    index, low, on, stack, out, n = {}, {}, set(), [], [], [0]

    def strong(v):
        index[v] = low[v] = n[0]; n[0] += 1
        stack.append(v); on.add(v)
        for w in adj.get(v, []):
            if w not in index:
                strong(w); low[v] = min(low[v], low[w])
            elif w in on:
                low[v] = min(low[v], index[w])
        if low[v] == index[v]:
            comp = []
            while True:
                w = stack.pop(); on.discard(w); comp.append(w)
                if w == v:
                    break
            if len(comp) > 1:
                out.append(sorted(comp, key=ids.index))
    for v in ids:
        if v not in index:
            strong(v)
    return sorted(out, key=lambda c: ids.index(c[0]))


def _wholes(states):
    """Each whole, and the states declared `part_of` it (immediate parts only)."""
    out = {}
    for sid, st in states.items():
        w = st.get("part_of") if isinstance(st, dict) else None
        if w in states and w != sid:
            out.setdefault(w, []).append(sid)
    return out


def _loops(ids, edges, cap=LOOP_CAP):
    """Every simple cycle, in order along the loop, each listed once from its first state.

    CYCLES, NOT COMPONENTS. The first version reported strongly connected components, and two
    loops sharing a state -- reoffending -> prison -> reoffending, and reoffending -> risk score ->
    sentence -> reoffending -- came back as one sorted blob of four states: a loop count that was
    wrong and a loop whose order, the whole point of drawing it, was gone."""
    order = {v: i for i, v in enumerate(ids)}
    adj = _adjacency(edges, ids)
    out = []

    def walk(start, v, path):
        for w in adj.get(v, []):
            if len(out) >= cap:
                return
            if w == start:
                out.append(path[:])
            elif w in order and order[w] > order[start] and w not in path:
                path.append(w)
                walk(start, w, path)
                path.pop()

    for s in ids:
        walk(s, s, [s])
    return out


def _adjacency(edges, ids):
    """Successors of each state IN DECLARED ORDER. The edges arrive as a set, whose order moves
    with Python's string hashing from run to run; while every route and loop was found that did not
    matter, but past a cap WHICH routes and loops are found depends on it, and the same file gave a
    different census on each run (Wimmer, 26 Sep 2026). The page walks in the same order."""
    rank = {v: i for i, v in enumerate(ids)}
    adj = {}
    for a, b in edges:
        adj.setdefault(a, []).append(b)
    for a in adj:
        adj[a] = sorted(set(adj[a]), key=lambda v: (rank.get(v, len(rank)), str(v)))
    return adj


def _shortest_loops(comp, edges, ids, k=3):
    """The k shortest loops through a feedback system, found directly -- not from the capped
    sample of all loops, which can miss them. Each is started at its earliest-declared state."""
    members, rank = set(comp), {v: i for i, v in enumerate(ids)}
    adj = _adjacency([(a, b) for a, b in edges if a in members and b in members], ids)
    found = {}
    for v in comp:
        prev, q, hit = {v: None}, [v], None
        while q and hit is None:
            nq = []
            for x in q:
                for w in adj.get(x, []):
                    if w == v:
                        hit = x
                        break
                    if w not in prev:
                        prev[w] = x
                        nq.append(w)
                if hit is not None:
                    break
            q = nq
        if hit is None:
            continue
        path, x = [], hit
        while x is not None:
            path.append(x)
            x = prev[x]
        path.reverse()
        i = min(range(len(path)), key=lambda j: rank[path[j]])
        loop = path[i:] + path[:i]
        found[tuple(loop)] = loop
    return sorted(found.values(), key=lambda l: (len(l), [rank[v] for v in l]))[:k]


def _routes(start, goal, edges, ids=()):
    """(number of simple routes, shortest, longest), each route counted in steps."""
    adj = _adjacency(edges, list(ids) or sorted({x for e in edges for x in e}))
    lengths = []

    def walk(v, seen):
        for w in adj.get(v, []):
            # The cap is checked per successor, as the page checks it, so both stop at the same
            # count: checked only on entry this counted 201 where the page counted 200.
            if len(lengths) >= ROUTE_CAP:
                return
            if w == goal:
                lengths.append(len(seen))
            elif w not in seen:
                walk(w, seen | {w})

    walk(start, {start})
    return (len(lengths), min(lengths), max(lengths)) if lengths else (0, None, None)


def analyse(fm, doc):
    """(findings, profile) for a file. Findings are (severity, check, message, where).

    `profile` is None when the file declares no mechanism and asserts no step -- which is most
    files, and they should hear nothing from this module at all."""
    import argdown_provenance as prov
    findings = []
    block, levels, actors, states, problems = declared(fm)
    appraisal = prov.appraisal_titles(doc)
    all_steps = steps(doc, appraisal)

    # ---- the appraisal layer's own rules, whether or not there is a chain ---- #
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            if title not in appraisal:
                continue
            d = _data(node)
            if d.get("fidelity") != "imputation" or not d.get("warrant"):
                findings.append(("!", "appraisal",
                                 "an #appraisal claim is the reconstructor's own reading, so it "
                                 "must be marked `fidelity: imputation` and say why in a "
                                 "`warrant:`",
                                 {"title": title,
                                  "fix": "add `fidelity: \"imputation\"` and a one-line warrant"}))
    for name, arg in (doc.get("arguments") or {}).items():
        if name in appraisal:
            continue
        for entry in arg.get("pcs") or []:
            if entry.get("title") in appraisal:
                findings.append(("!", "appraisal",
                                 f"the author's argument <{name}> uses an #appraisal claim as a "
                                 f"premise -- the text's argument cannot rest on the "
                                 f"reconstructor's appraisal",
                                 {"title": entry.get("title"),
                                  "fix": "keep the appraisal outside the author's arguments: "
                                         "attach it with +> or -> instead"}))

    if block is None and not all_steps:
        return findings, None
    if block is None:
        findings.append(("!", "mechanism",
                         f"{len(all_steps)} step(s) are marked with `causes:` but the front "
                         f"matter declares no `mechanism:` block, so no state they name exists",
                         {"fix": "declare `mechanism:` with its levels, actors and states"}))
    for sev, msg, where in problems:
        findings.append((sev, "mechanism", msg, where))

    for s in all_steps:
        for end in ("src", "dst"):
            sid = s[end]
            label = "from" if end == "src" else "to"
            if sid is None:
                findings.append(("!", "mechanism", f"a step has no `{label}:`",
                                 {"title": s["title"]}))
            elif sid not in states:
                findings.append(("!", "mechanism",
                                 f"`{label}: {sid}` is not a declared state",
                                 {"title": s["title"],
                                  "fix": f"declare `{sid}` under mechanism: states:, or correct "
                                         f"the id"}))
            elif s["layer"] != "appraisal" and (states[sid] or {}).get("appraisal"):
                findings.append(("!", "mechanism",
                                 f"a step the text asserts runs through `{sid}`, which is "
                                 f"declared as the appraisal's own state -- the text cannot "
                                 f"assert a step through something only the reconstructor "
                                 f"introduced",
                                 {"title": s["title"]}))
        if s["basis"] is not None and s["basis"] not in BASES:
            findings.append(("?", "mechanism",
                             f"basis `{s['basis']}` is not one of {', '.join(BASES)}; the step is "
                             f"shaded as asserted",
                             {"title": s["title"]}))
        if s["sign"] not in (None,) + SIGNS:
            findings.append(("?", "mechanism",
                             f"sign `{s['sign']}` is not `+`, `-`, `0` (no effect) or `which` "
                             f"(decides which)", {"title": s["title"]}))
        if s["null"] and s["selects"]:
            findings.append(("?", "mechanism",
                             "a step cannot be both a null finding and a selection link",
                             {"title": s["title"]}))
        if isinstance(s["how"], dict):
            extra = set(s["how"]) - {"actor", "situation", "habit", "response"}
            if extra:
                findings.append(("?", "mechanism",
                                 f"`how:` reads actor, situation, habit and response; "
                                 f"{', '.join(sorted(extra))} is ignored", {"title": s["title"]}))
            if s["how"].get("actor") and s["how"]["actor"] not in actors:
                findings.append(("!", "mechanism",
                                 f"`how: actor: {s['how']['actor']}` is not a declared actor",
                                 {"title": s["title"]}))

    # ---- the chain, in the text's own layer ------------------------------ #
    ok = [s for s in all_steps if s["src"] in states and s["dst"] in states]
    # ONLY CAUSAL STEPS CARRY THE CHAIN. A null finding says nothing is carried; a selection link
    # says the association is not an effect. Both are reported, neither is walked.
    causal = [s for s in ok if not s["null"] and not s["selects"]]
    text_all = [s for s in ok if s["layer"] == "text"]
    text = [s for s in causal if s["layer"] == "text"]
    text_edges = {(s["src"], s["dst"]) for s in text}
    ids = list(states)
    interventions = [i for i in ids if "intervention" in roles_of(states[i])]
    conditions = [i for i in ids if "condition" in roles_of(states[i])]
    outcomes = [i for i in ids if "outcome" in roles_of(states[i])]
    # WHERE THE TEXT'S CHAIN STARTS. The intervention if the text links it; otherwise every state
    # the text leads out of and never into. Reachability from an unlinked intervention reported
    # every outcome unreached on the spike, burying the two gaps that mattered under the one
    # already named.
    # A CONDITION IS A STARTING POINT TOO: an explanatory text sets out from causes it does not
    # recommend, and in a chain that is all loop -- Merton's circle, Wimmer's process -- no state
    # is led out of and never into, so without it nothing would count as where the chain starts.
    entries = sorted({i for i in interventions + conditions if any(a == i for a, _ in text_edges)}
                     | {i for i in ids if any(a == i for a, _ in text_edges)
                        and not any(b == i for _, b in text_edges)})
    reached = set()
    for e in entries:
        reached |= _reach(e, text_edges)
    used = {x for e in text_edges for x in e}

    gaps = []
    for i in interventions:
        if not any(a == i for a, _ in text_edges):
            gaps.append(dict(kind="unlinked-intervention", state=i,
                             message=f"the intervention `{i}` has no step in the text: nothing "
                                     f"says how it brings about anything"))
    for c in conditions:
        if not any(a == c for a, _ in text_edges):
            gaps.append(dict(kind="unlinked-condition", state=c,
                             message=f"the condition `{c}` has no step in the text: nothing "
                                     f"says what it brings about"))
    for o in outcomes:
        if o not in reached:
            gaps.append(dict(kind="unreached-outcome", state=o,
                             message=f"the outcome `{o}` is not reached by the text's steps from "
                                     f"where its chain starts"))
    for i in ids:
        if (i in used and i not in outcomes and not (states[i] or {}).get("appraisal")
                and not any(a == i for a, _ in text_edges)):
            gaps.append(dict(kind="dead-end", state=i,
                             message=f"`{i}` leads nowhere in the text: the chain stops there"))
    if block is not None and not interventions and not conditions:
        gaps.append(dict(kind="no-intervention", state=None,
                         message="no state has `role: intervention` or `role: condition`, so the "
                                 "chain has no stated cause to run from"))
    if block is not None and not outcomes:
        gaps.append(dict(kind="no-outcome", state=None,
                         message="no state has `role: outcome`, so nothing says what the chain is "
                                 "for"))
    for g in gaps:
        findings.append(("?", "mechanism-gap", g["message"],
                         {"state": g["state"],
                          "fix": "a gap in the TEXT is a finding, not a fault: leave it. Close it "
                                 "only if the text's own argument needs the step (an "
                                 "`imputation` with `warrant: enthymeme`), never to complete the "
                                 "chain"}))

    # light and shadow, per distinct SIGNED step: its best-backed claim decides. Keyed by sign as
    # well, since fee -> health (-) and fee -> health (+, under a condition) are two steps.
    best = {}
    for s in text:
        k = (s["src"], s["dst"], s["sign"])
        if k not in best or TIERS.index(s["tier"]) < TIERS.index(best[k]):
            best[k] = s["tier"]
    tiers = {t: sum(1 for v in best.values() if v == t) for t in TIERS}

    def reflexive(loop, pool):
        hops = set(zip(loop, loop[1:] + loop[:1]))
        return any(s["reflexive"] and (s["src"], s["dst"]) in hops for s in pool)

    pool_all = [s for s in causal if s["layer"] != "rival"]
    loops_text = _loops(ids, text_edges)
    feedback = []
    for comp in _systems(ids, text_edges):
        members = set(comp)
        inside = [l for l in loops_text if set(l) <= members]
        shortest = _shortest_loops(comp, text_edges, ids)
        feedback.append(dict(states=comp, loops=len(inside), capped=len(loops_text) >= LOOP_CAP,
                             shortest=[dict(states=l, reflexive=reflexive(l, text)) for l in shortest]))
    loops_all = _loops(ids, {(s["src"], s["dst"]) for s in pool_all})
    routes = []
    for e in entries:
        for o in outcomes:
            if o == e:        # a state that is both where the circle starts and what it explains
                continue
            n, lo, hi = _routes(e, o, text_edges, ids)
            if n:
                routes.append(dict(start=e, outcome=o, routes=n, shortest=lo, longest=hi))

    level_of = {i: ((actors.get((states[i] or {}).get("actor")) or {}).get("level")) for i in ids}
    profile = dict(
        question=(block or {}).get("question"),
        levels=levels, levels_spanned=[lv for lv in levels if lv in {level_of[i] for i in used}],
        states=len(states), steps=len(best),
        claims=len({s["title"] for s in text}),
        lags=sorted({str(s["lag"]) for s in text if s["lag"]}),
        entries=entries, routes=routes,
        loops_text=[dict(states=l, reflexive=reflexive(l, text)) for l in loops_text],
        feedback=feedback,
        wholes=sorted([k, sorted(v)] for k, v in _wholes(states).items()),
        loops_with_appraisal=[dict(states=l, reflexive=reflexive(l, pool_all))
                              for l in loops_all],
        tiers=tiers, gaps=[g["message"] for g in gaps],
        rival_steps=sum(1 for s in ok if s["layer"] == "rival"),
        null_steps=_nulls(text_all, ok),
        selection_steps=sorted({(s["src"], s["dst"]) for s in text_all if s["selects"]}),
        hedged=sum(1 for s in text_all if s["hedged"]),
        appraisal_claims=len(appraisal),
        appraisal_steps=sum(1 for s in ok if s["layer"] == "appraisal"),
        with_how=sum(1 for s in text if isinstance(s["how"], dict)),
        with_given=sum(1 for s in text if s["given"]),
    )
    return findings, profile


def _nulls(text_all, ok):
    """The text's null findings, each saying whether it answers a rival view's step on the same
    pair of states -- the dispute the J-PAL bulletin is about, made visible."""
    out, seen = [], set()
    for s in text_all:
        if not s["null"] or (s["src"], s["dst"]) in seen:
            continue
        seen.add((s["src"], s["dst"]))
        against = sorted({r["sign"] for r in ok if r["layer"] == "rival" and not r["null"]
                          and (r["src"], r["dst"]) == (s["src"], s["dst"]) and r["sign"]})
        out.append(dict(**{"from": s["src"], "to": s["dst"]}, basis=s["basis"],
                        refutes=against))
    return out


def census(profile):
    """The CHAIN section of the checker's census, as lines."""
    p = profile
    tall = len(p["levels_spanned"])
    lines = [f"   CHAIN -- {p['steps']} distinct step(s) the text asserts, by {p['claims']} "
             f"claim(s); {p['states']} state(s) declared"]
    if p.get("question"):
        lines.append(f"      question: {p['question']}")
    lines.append(f"      height  {tall} of {len(p['levels'])} level(s)"
                 + (f": {', '.join(p['levels_spanned'])}" if tall else "")
                 + ("  (tall: expect to need several kinds of evidence)" if tall >= 3 else ""))
    lines.append("      length  " + ("lags stated: " + "; ".join(p["lags"]) if p["lags"]
                                     else "no timing stated in any step"))
    if p["routes"]:
        for r in p["routes"][:6]:
            span = (f"{r['shortest']} step{'' if r['shortest'] == 1 else 's'}"
                    if r["shortest"] == r["longest"]
                    else f"{r['shortest']} to {r['longest']} steps")
            many = "+" if r["routes"] >= ROUTE_CAP else ""
            lines.append(f"      route   {r['start']} -> {r['outcome']}: {r['routes']}{many} "
                         f"route{'' if r['routes'] == 1 else 's'}, {span}"
                         + (", every step of which must hold" if (r['longest'] or 0) > 1 else ""))
    else:
        lines.append("      route   no outcome is reached by the text's steps")
    if p["loops_text"]:
        big = [f for f in p.get("feedback", []) if f["loops"] > LOOPS_LISTED]
        inbig = [set(f["states"]) for f in big]
        for f in big:
            lines.append(f"      system  {len(f['states'])} states bound in one feedback system, "
                         f"{f['loops']}{'+' if f['capped'] else ''} loops through them: "
                         + ", ".join(f["states"]))
            for l in f["shortest"]:
                lines.append("        e.g.  " + " -> ".join(l["states"] + l["states"][:1])
                             + ("  (reflexive)" if l["reflexive"] else ""))
        for l in p["loops_text"]:
            if any(set(l["states"]) <= b for b in inbig):
                continue
            lines.append("      loop    " + " -> ".join(l["states"] + l["states"][:1])
                         + ("  (reflexive: runs through a classification or representation)"
                            if l["reflexive"] else ""))
    else:
        lines.append("      loop    none closed in the text")
    text_loops = [l["states"] for l in p["loops_text"]]
    for l in p["loops_with_appraisal"]:
        if l["states"] not in text_loops:
            lines.append("      loop    " + " -> ".join(l["states"] + l["states"][:1])
                         + "  (closed only by the appraisal"
                         + ("; reflexive" if l["reflexive"] else "") + ")")
    for w, parts in p.get("wholes", []):
        lines.append(f"      whole   {w}: {', '.join(parts)} -- drawn as one box at the text's own level")
    t = p["tiers"]
    lines.append(f"      light   {t['evidence']} backed by a study, statistics or a model; "
                 f"{t['argued']} argued; {t['asserted']} asserted only; {t['imputed']} imputed")
    for n in p.get("null_steps", []):
        lines.append(f"      null    {n['from']} -> {n['to']}: the text finds no effect"
                     + (f" ({n['basis']})" if n["basis"] else "")
                     + (f", against the rival view's {'/'.join(n['refutes'])}"
                        if n["refutes"] else ""))
    for a, b in p.get("selection_steps", []):
        lines.append(f"      select  {a} -> {b}: a selection link, not an effect -- not walked")
    if p.get("hedged"):
        lines.append(f"      hedged  {p['hedged']} step(s) the text puts as a possibility (\"may\")")
    for g in p["gaps"]:
        lines.append(f"      ? gap   {g}")
    cov = p.get("coverage")
    if cov:
        lines.append(f"      cover   {cov['covered']} of {cov['causal_sentences']} sentences in the "
                     f"text that use causal language are quoted by a step"
                     + (f"; {cov['near']} more share a paragraph with one (weaker)"
                        if cov.get("near") else ""))
        if cov["uncovered_count"]:
            lines.append(f"              the other {cov['uncovered_count']} are candidates, not "
                         f"faults -- does each state a step the chain lacks?")
            for u in cov["uncovered"][:8]:
                lines.append(f"              line {u['line']:>4}{'*' if u.get('near') else ' '} "
                             f"{u['text'][:86]}")
            if cov["uncovered_count"] > 8:
                lines.append(f"              ... and {cov['uncovered_count'] - 8} more")
    if p["rival_steps"]:
        lines.append(f"      rival   {p['rival_steps']} step(s) in views the text reports "
                     f"(#reported)")
    if p["appraisal_claims"]:
        lines.append(f"      appraisal  {p['appraisal_claims']} claim(s), {p['appraisal_steps']} "
                     f"step(s) -- the reconstructor's own, excluded from every measure of the "
                     f"author's argument")
    return lines


def step_titles(doc):
    """Titles of every claim or argument that asserts a step (`causes:`)."""
    out = set()
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            if "causes" in _data(node):
                out.add(title)
    return out


# ------------------------------------------------------------------ coverage (Phase C)
#
# WHY A COVERAGE AID. The gap report says what the text's chain leaves out -- and that is a finding
# about the TEXT only if the annotation captured every step the text states. Annotating the
# argument map alone does not: extraction keeps what serves as a reason and drops the rest, and
# much of a mechanism is the rest (on the J-PAL bulletin, the section on WHY small fees deter was
# left out as "explains rather than argues"). So the pass returns to the source, and this lists the
# sentences there that use causal language and that no step quotes or is placed at. They are
# CANDIDATES, not faults: a sentence may use "because" and state no step the chain needs. What the
# list guarantees is that nothing was passed over unseen, and the census says how much of the
# text's causal talk the chain rests on.

CAUSAL = re.compile(
    r"\b(because|therefore|thereby|consequently|as a result|hence|"
    r"results? in|resulted in|resulting in|leads? to|led to|leading to|"
    r"causes?|caused|causing|due to|owing to|"
    r"drives?|driven|driving|reduces?|reduced|reducing|increases?|increased|increasing|"
    r"raises?|raised|raising|lowers?|lowered|lowering|prevents?|prevented|preventing|"
    r"contributes? to|contributed to|contributing to|so that|in order to|"
    r"enables?|enabled|enabling|encourages?|encouraged|encouraging|"
    r"deters?|deterred|deterring|discourages?|discouraged|"
    r"promotes?|promoted|promoting|undermines?|undermined|undermining|"
    r"more likely|less likely|effects? of|impacts? on|in turn)\b", re.I)
_STOP_HEADING = re.compile(r"^#+\s*(notes|references|bibliography|further reading|works cited|"
                           r"endnotes|acknowledg)", re.I)
# Two fixed-width lookbehinds, because Python's `re` refuses a variable-width one: a stop, or a
# stop followed by a closing quote or bracket.
_SENT_END = re.compile(r"(?:(?<=[.!?])|(?<=[.!?][\"'\u201d\u2019)]))\s+(?=[A-Z\"\u201c(\[])")


def _sentences(text):
    """(line, sentence) for every sentence of running text: headings, the converter's comments,
    footnote definitions and the back matter left out."""
    text = re.sub(r"<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    # THE SOURCE'S OWN FRONT MATTER IS NOT RUNNING TEXT. A converted paper carries its abstract
    # there, and read as prose it put the J-PAL abstract's four causal sentences on line 1 as
    # "uncovered", beside the same sentences in the body (26 Sep 2026). Blanked, lines kept.
    fm = re.match(r"---\n.*?\n---\n", text, flags=re.S)
    if fm:
        text = "\n" * fm.group(0).count("\n") + text[fm.end():]
    out, para, start = [], [], None
    lines = text.split("\n")
    for i, raw in enumerate(lines + [""], 1):
        line = raw.strip()
        if _STOP_HEADING.match(line):
            break
        if not line or line.startswith("#") or line.startswith("[^") or line.startswith("==="):
            if para:
                joined = " ".join(para)
                for sent in _SENT_END.split(joined):
                    if len(sent.split()) >= 5:
                        out.append((start, sent.strip()))
                para, start = [], None
            continue
        if start is None:
            start = i
        para.append(line.lstrip("> ").strip())
    return out


def _quoted(sent, q):
    """Does quotation `q` quote sentence `sent` (both normalised, lower-case)?

    WHOLE, OR THE HALF OF IT WHERE THE QUOTATION STARTS OR ENDS. The first version asked only
    whether one contained the other, with the quotation's closing stop stripped and the
    sentence's kept -- so a quotation running across two sentences quoted neither, and one that
    began part-way into a sentence never matched it. Found by the Wimmer pass (26 Sep 2026),
    which counted some six quoted sentences among the "uncovered"."""
    s, q = sent.strip(' ."'), q.strip(' ."')
    if not s or not q:
        return False
    if q in s or (len(s) > 20 and s in q):
        return True
    need = max(30, len(s) // 2)
    # The quotation begins inside the sentence and runs on past its end.
    head, start = q[:30], 0
    while len(head) == 30:
        at = s.find(head, start)
        if at < 0:
            break
        if q.startswith(s[at:]) and len(s) - at >= need:
            return True
        start = at + 1
    # The quotation ends inside the sentence, having begun before it.
    tail, start = q[-30:], 0
    while len(tail) == 30:
        at = s.find(tail, start)
        if at < 0:
            break
        if q.endswith(s[:at + 30]) and at + 30 >= need:
            return True
        start = at + 1
    return False


def coverage(doc, source_root, steps_all):
    """How much of the text's causal language the chain's steps quote or are placed at.

    Returns None when there is nothing to measure. Steps in the text's own layer and in rival
    views count; the appraisal's do not, since the reconstructor quoting a sentence is not the
    text's chain capturing it."""
    import argdown_provenance as prov
    titles = {s["title"] for s in steps_all if s["layer"] in ("text", "rival")}
    if not titles or not source_root:
        return None
    quotes = prov.check_quotations(doc, source_root)
    spans = {}
    for q in quotes:
        if q["title"] in titles and q["status"] == "exact" and q.get("chapter"):
            spans.setdefault(q["chapter"], []).append(prov.normalise(q["quote"])[0].lower())
    # A CLAIM THAT IS A QUOTATION WHOLE QUOTES TOO. Most of a verbatim map's claims are the
    # author's words with no quotation marks round them -- `fidelity: quotation` says so, and the
    # checker holds the marker to the text -- so counting marked spans alone reported 5 of 77
    # causal sentences covered on the J-PAL reprint, 29 of the rest being the exact words of claims
    # that carry the step. The claim's own text counts, but only where it is in the chapter.
    texts = {}
    for title, m in prov.iter_members(doc):
        d = m.get("data") or {}
        if title in titles and d.get("fidelity") == "quotation" and d.get("chapter"):
            body = re.sub(r"(?<!\S)#[A-Za-z][\w-]*", " ", m.get("text") or "")
            n = prov.normalise(body)[0].lower().strip(' ."')
            if len(n) >= 20:
                texts.setdefault(d["chapter"], []).append(n)
    for ch, ns in texts.items():
        try:
            with open(os.path.join(source_root, ch), encoding="utf-8", errors="replace") as fh:
                whole = prov.normalise(fh.read())[0].lower()
        except OSError:
            continue
        spans.setdefault(ch, []).extend(n for n in ns if n in whole)
    placed = {}
    try:
        pos = prov.text_positions(doc, source_root, quotes)
    except Exception:
        pos = {}
    for t in titles:
        p = pos.get(t) or {}
        if p.get("chapter") and p.get("line"):
            placed.setdefault(p["chapter"], set()).add(p["line"])
    chapters = sorted({(m.get("data") or {}).get("chapter")
                       for _, m in prov.iter_members(doc) if (m.get("data") or {}).get("chapter")})
    total, covered, near, uncovered = 0, 0, 0, []
    for ch in chapters:
        try:
            with open(os.path.join(source_root, ch), encoding="utf-8", errors="replace") as fh:
                raw = fh.read()
        except OSError:
            continue
        sents = _sentences(raw)
        para_lines = sorted({ln for ln, _ in sents})
        for ln, sent in sents:
            if not CAUSAL.search(sent):
                continue
            total += 1
            norm = prov.normalise(sent)[0].lower()
            if any(_quoted(norm, q) for q in spans.get(ch, [])):
                covered += 1
                continue
            # ONLY A QUOTATION COVERS. Being placed in the same paragraph as a step was counted as
            # covering at first, and on a source converted with page-long paragraphs one placed
            # claim covered a whole page: both trial annotators of the J-PAL bulletin found 66-67
            # of 76 "covered" and said their own reading had done the work. It is reported apart.
            nxt = [x for x in para_lines if x > ln]
            is_near = any(ln <= p < (nxt[0] if nxt else 10 ** 9) for p in placed.get(ch, ()))
            near += int(is_near)
            uncovered.append(dict(chapter=ch, line=ln, text=sent[:220], near=is_near))
    if not total:
        return None
    return dict(causal_sentences=total, covered=covered, near=near, uncovered=uncovered[:40],
                uncovered_count=len(uncovered))
