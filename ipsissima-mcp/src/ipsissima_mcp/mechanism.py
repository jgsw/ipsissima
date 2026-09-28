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
#: Routes the census prints before it says how many more there are.
ROUTES_LISTED = 10


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
        # A STATE ACROSS LEVELS (profile 1.4): Wimmer's consensus, reached in micro-level
        # negotiation and holding as a macro-level fact; the Coleman boat's transformational step.
        for lv in _as_list(s.get("levels")):
            if lv not in levels:
                problems.append(("!", f"state `{sid}` names level `{lv}`, which is not one of the "
                                      f"declared levels", {"state": str(sid)}))
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
    # SEVERAL CHAINS (profile 1.5). A text that answers several questions -- the Coleman-boat paper's
    # drought and migration, its fisheries, its segregation model -- gives each its own chain; a
    # state two chains share is what couples them, and a chain may cast a state in a role of its
    # own, since one chain's outcome is the next one's condition.
    # THE SAME KIND ACROSS CASES (profile 1.6). Kenyan herders' migration and the paper's general
    # rural-urban migration are two states, not one: the text never joins them, and walking from
    # one to the other would invent a step. Nor is either part of the other. A kind says they are
    # the same kind of thing in different cases -- and nothing more.
    kinds = m.get("kinds")
    if kinds is not None and not isinstance(kinds, dict):
        problems.append(("!", "`kinds:` must map ids to kinds, each with a `label`", {}))
    kinds = kinds if isinstance(kinds, dict) else {}
    of_kind = {}
    for sid, st in states.items():
        k = st.get("kind") if isinstance(st, dict) else None
        if k is None:
            continue
        if str(k) not in {str(x) for x in kinds}:
            problems.append(("!", f"state `{sid}` is `kind: {k}`, which is not declared under "
                                  f"`mechanism: kinds:`", {"state": str(sid)}))
        else:
            of_kind.setdefault(str(k), []).append(sid)
    # THE GENERAL AND ITS CASES (profile 1.7). A kind may name its general state: the paper's claim
    # about rural-urban migration in general, of which the Kenyan herders' is a case.
    for kid, k in kinds.items():
        gen = k.get("general") if isinstance(k, dict) else None
        if gen is None:
            continue
        if gen not in states:
            problems.append(("!", f"kind `{kid}` is `general: {gen}`, which is not a declared state",
                             {"kind": str(kid)}))
        elif gen not in of_kind.get(str(kid), []):
            problems.append(("!", f"kind `{kid}` is `general: {gen}`, but `{gen}` is not of kind "
                                  f"`{kid}` -- give it `kind: {kid}`", {"kind": str(kid)}))
    for kid in kinds:
        if len(of_kind.get(str(kid), [])) < 2:
            problems.append(("?", f"kind `{kid}` has {len(of_kind.get(str(kid), []))} state(s): a "
                                  f"kind says that two or more states are the same kind of thing",
                             {"kind": str(kid)}))
    chains = m.get("chains")
    if chains is not None and not isinstance(chains, dict):
        problems.append(("!", "`chains:` must map ids to chains, each with a `label` and a `question`", {}))
    for cid, ch in (chains.items() if isinstance(chains, dict) else ()):
        ch = ch if isinstance(ch, dict) else {}
        roles = ch.get("roles") or {}
        if not isinstance(roles, dict):
            problems.append(("!", f"chain `{cid}`: `roles:` must map state ids to roles", {"chain": str(cid)}))
            continue
        for sid, r in roles.items():
            if sid not in states:
                problems.append(("!", f"chain `{cid}` gives a role to `{sid}`, which is not a "
                                      f"declared state", {"chain": str(cid)}))
            bad = roles_of({"role": r}) - set(ROLES)
            if bad:
                problems.append(("?", f"chain `{cid}` gives `{sid}` the role `{sorted(bad)[0]}`; the "
                                      f"roles read are `intervention`, `condition` and `outcome`",
                                 {"chain": str(cid)}))
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
                     # AN OBJECTION THE TEXT VOICES IS NOT THE TEXT'S CHAIN (#contested, 28 Sep
                     # 2026): Valentino's "high salience blocks priming" was walked as the
                     # authors' own step, though they raise it only to deny it.
                     else "rival" if ("reported" in tags or "contested" in tags) else "text")
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
                given = given if isinstance(given, list) else [given]
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
                    given=[_cond(g) for g in given], given_raw=given,
                    how=c.get("how"), reflexive=bool(c.get("reflexive")),
                    # JOINTLY (profile 1.4): the states together with which alone the step holds.
                    jointly=_as_list(c.get("jointly")),
                    # CHAIN (profile 1.5): which of the text's chains the step belongs to.
                    chain=_as_list(c.get("chain")),
                    # VIA (profile 1.8): the states of the finer route the text opens this step
                    # into -- the step IS that route, not a second one beside it.
                    via=_as_list(c.get("via")),
                    # SHARE (1.8): how much of the step runs by its `via` route -- entire (the
                    # default), most, partial, or none ("AMPK-independent").
                    share=(str(c.get("share")) if c.get("share") is not None
                           else "entire" if c.get("via") else ""),
                    # SIZE (1.8, G3): the magnitude the text gives, quoted.
                    size=_size(c.get("size")),
                    # REGIME and THRESHOLD (1.8, G2): the regime the step holds in, in the text's
                    # words, and the threshold it acts past.
                    regime="" if c.get("regime") is None else str(c.get("regime")),
                    threshold="" if c.get("threshold") is None else str(c.get("threshold")),
                    # UNLESS and DESPITE (profile 1.8): a state that blocks the step where it holds,
                    # and one that acted against it and failed -- G1's commonest forms.
                    unless=_as_list(c.get("unless")), despite=_as_list(c.get("despite")),
                    # PERIOD and ON (profile 1.8, G7): when the step holds, in the text's words
                    # anchored to an event, and whether it moves the level of `to` or its trend.
                    period="" if c.get("period") is None else str(c.get("period")),
                    on="level" if c.get("on") is None else str(c.get("on")),
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


def _as_list(v):
    if v is None:
        return []
    return [str(x) for x in (v if isinstance(v, list) else [v])]


def levels_of(state, actors, levels):
    """The levels a state is drawn across: its own `levels:` (profile 1.4) if it declares them,
    otherwise its actor's level."""
    own = [lv for lv in _as_list((state or {}).get("levels") if isinstance(state, dict) else None) if lv in levels]
    if own:
        return sorted(set(own), key=levels.index)
    lv = (actors.get((state or {}).get("actor")) or {}).get("level") if isinstance(state, dict) else None
    return [lv] if lv else []


def _wholes(states):
    """Each whole, and the states declared `part_of` it (immediate parts only)."""
    out = {}
    for sid, st in states.items():
        w = st.get("part_of") if isinstance(st, dict) else None
        if w in states and w != sid:
            out.setdefault(w, []).append(sid)
    return out


def _loops(ids, edges, cap=LOOP_CAP, regimes=None):
    """Every simple cycle, in order along the loop, each listed once from its first state.

    CYCLES, NOT COMPONENTS. The first version reported strongly connected components, and two
    loops sharing a state -- reoffending -> prison -> reoffending, and reoffending -> risk score ->
    sentence -> reoffending -- came back as one sorted blob of four states: a loop count that was
    wrong and a loop whose order, the whole point of drawing it, was gone."""
    order = {v: i for i, v in enumerate(ids)}
    adj = _adjacency(edges, ids)
    out = []
    regimes = regimes or {}

    # A LOOP IS IN ONE REGIME AND ONE PERIOD, as a route is (28 Sep 2026).
    def walk(start, v, path, allowed):
        for w in adj.get(v, []):
            if len(out) >= cap:
                return
            now = _narrow(allowed, regimes.get((v, w)) or {("", "")})
            if now is None:
                continue
            if w == start:
                out.append(path[:])
            elif w in order and order[w] > order[start] and w not in path:
                path.append(w)
                walk(start, w, path, now)
                path.pop()

    for s in ids:
        walk(s, s, [s], (None, None))
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


def _cond(g):
    """A condition as the census prints it: the text's words, or -- since 1.8 -- a declared state
    and the value it has (`{state: ampk, value: absent}` -> "ampk: absent")."""
    if isinstance(g, dict):
        return str(g.get("state")) + (f": {g['value']}" if g.get("value") is not None else "")
    return str(g)


def _size(x):
    """A step's size as the census prints it: the text's words, or `{value, unit, ci, versus, at}`
    set out in that order ("-1.6 percentage points (95% CI -2.3 to -0.9) versus the counterfactual
    at Nov 2019")."""
    if x is None:
        return ""
    if not isinstance(x, dict):
        return str(x)
    out = " ".join(str(x[k]) for k in ("value", "unit") if x.get(k) is not None)
    if x.get("ci") is not None:
        out += f" ({x['ci']})"
    if x.get("versus") is not None:
        out += f" versus {x['versus']}"
    if x.get("at") is not None:
        out += f" at {x['at']}"
    return out.strip()


SHARES = ("entire", "most", "partial", "none")
_FLIP = {"+": "-", "-": "+"}


def _signs(steps_, states):
    """Each edge's signs among `steps_`, a co-cause's edge taking the sign of its step and a
    blocker's the opposite sign (more of what blocks a raising step, less of its effect)."""
    out = {}
    for s in steps_:
        out.setdefault((s["src"], s["dst"]), set()).add(s["sign"] or "?")
        for j in s["jointly"]:
            if j in states and j != s["dst"]:
                out.setdefault((j, s["dst"]), set()).add(s["sign"] or "?")
        for u in s["unless"]:
            if u in states and u != s["dst"]:
                out.setdefault((u, s["dst"]), set()).add(_FLIP.get(s["sign"], "?"))
    return out


def _regimes(steps_, states):
    """Each edge's (regime, period) pairs among `steps_`: "" for a step stated in no regime or
    period, which holds in all.

    A PERIOD PARTITIONS ROUTES AS A REGIME DOES. The census walked Obama's 2008 election through
    the 1990s rejection of explicit messages to opinion -- the very steps Valentino et al. find no
    longer hold (wave 4, 28 Sep 2026)."""
    out = {}
    for s in steps_:
        for a in [s["src"]] + [j for j in s["jointly"] + s["unless"] if j in states and j != s["dst"]]:
            out.setdefault((a, s["dst"]), set()).add((s["regime"], s["period"]))
    return out


def _narrow(allowed, pairs):
    """The regimes and periods a route may still be in after a step stated in `pairs`, or None when
    the step fits none of them. `allowed` is (regimes, periods), each None while unconstrained.
    The two are narrowed apart: a step in one regime and no period holds in every period."""
    rs, ps = {r for r, _ in pairs}, {p for _, p in pairs}
    ar, ap = allowed
    nr = ar if "" in rs else (rs if ar is None else ar & rs)
    np_ = ap if "" in ps else (ps if ap is None else ap & ps)
    if (nr is not None and not nr) or (np_ is not None and not np_):
        return None
    return (nr, np_)


def _side_edges(steps_, states):
    """The edges a step's co-causes and blockers add: each is a cause of the step's `to`."""
    return {(j, s["dst"]) for s in steps_ for j in s["jointly"] + s["unless"]
            if j in states and j != s["dst"]}


def _net(signs, hops):
    """The NET SIGN of a run of steps: `+` or `-` where every step has the one sign, `?` where any
    is unsigned, decides-which, or carries both signs (the text's steps disagree, or differ by a
    condition). Metformin's 98 routes to glucose, 41 of them net `+` through the feedback the text
    invokes, were printed with no sign at all (gap tests, 27 Sep 2026)."""
    neg = 0
    for h in hops:
        sg = signs.get(h) or set()
        if len(sg) != 1 or next(iter(sg)) not in ("+", "-"):
            return "?"
        neg += next(iter(sg)) == "-"
    return "-" if neg % 2 else "+"


def _polarity(loop, signs):
    """A loop's polarity from its signs: `reinforcing`, `balancing`, or None when not every step
    has one sign. Lenton's text names every feedback positive or negative; the census listed eight
    loops with neither, though the signs were there to multiply."""
    return {"+": "reinforcing", "-": "balancing"}.get(_net(signs, list(zip(loop, loop[1:] + loop[:1]))))


def _routes(start, goal, edges, ids=(), signs=None, regimes=None):
    """(number of simple routes, shortest, longest, net signs), each route counted in steps and
    the net signs counted as {"+": n, "-": n, "?": n}.

    ONE REGIME TO A ROUTE (1.8, G2). A dose, a place or a model decides which mechanism runs, and
    the census composed routes across them: metformin's low-dose step chained to its high-dose one.
    A route is walked only where one regime holds all its steps; a step in no regime holds in all."""
    adj = _adjacency(edges, list(ids) or sorted({x for e in edges for x in e}))
    lengths, net = [], {"+": 0, "-": 0, "?": 0}
    regimes = regimes or {}

    def walk(v, path, allowed):
        for w in adj.get(v, []):
            # The cap is checked per successor, as the page checks it, so both stop at the same
            # count: checked only on entry this counted 201 where the page counted 200.
            if len(lengths) >= ROUTE_CAP:
                return
            now = _narrow(allowed, regimes.get((v, w)) or {("", "")})
            if now is None:
                continue
            if w == goal:
                lengths.append(len(path))
                run = path + [w]
                net[_net(signs or {}, list(zip(run, run[1:])))] += 1
            elif w not in path:
                walk(w, path + [w], now)

    walk(start, [start], (None, None))
    return (len(lengths), min(lengths), max(lengths), net) if lengths else (0, None, None, net)


def _opened(steps_, edges):
    """{(from, to): via} for each step whose `via` names a route `edges` give, hop by hop.

    ONE LINK AT TWO GRAINS (G13). The gap tests met it in five of six texts and misread it in most:
    the trial's total effect drawn as a direct route beside the route the text opens it into, which
    reads as partial mediation the text never claims ("mediated entirely by AMPK"). A step with a
    `via` the text's own steps give is walked as that route, once (27 Sep 2026)."""
    out = {}
    for s in steps_:
        # Only a step that runs ENTIRELY by its route is that route; part of it, or none, leaves a
        # direct remainder the text has not opened.
        if s["via"] and s["share"] == "entire" and s["src"] is not None and s["dst"] is not None:
            run = [s["src"]] + s["via"] + [s["dst"]]
            if all(h in edges for h in zip(run, run[1:])):
                out[(s["src"], s["dst"])] = list(s["via"])
    return out


def _walk(ids, states, text_edges, has_block, signs=None, regimes=None, null_from=(), rival_edges=(),
          ends=()):
    """Where a chain starts, what it reaches, its gaps and its routes: the walk the census makes of
    the whole text's chain, and -- since profile 1.5 -- of each of its chains, on the states that
    chain touches and the roles it gives them."""
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
    # A CAUSE WHOSE ONLY STEP IS A NULL IS NOT UNLINKED: the text says what it brings about --
    # nothing (Valentino's randomised timing of the attitude measure, 28 Sep 2026).
    for i in interventions:
        if i not in null_from and not any(a == i for a, _ in text_edges):
            gaps.append(dict(kind="unlinked-intervention", state=i,
                             message=f"the intervention `{i}` has no step in the text: nothing "
                                     f"says how it brings about anything"))
    for c in conditions:
        if c not in null_from and not any(a == c for a, _ in text_edges):
            gaps.append(dict(kind="unlinked-condition", state=c,
                             message=f"the condition `{c}` has no step in the text: nothing "
                                     f"says what it brings about"))
    # AN OUTCOME THE TEXT REPORTS OTHERS' ACCOUNTS OF IS REACHED -- in those views. Stone's three
    # stories of malnutrition left it "not reached" (wave 4, 28 Sep 2026).
    rival_reached = set()
    for a, _ in rival_edges:
        rival_reached |= _reach(a, rival_edges) - {a}
    for o in outcomes:
        if o not in reached:
            gaps.append(dict(kind="unreached-outcome", state=o,
                             message=(f"the outcome `{o}` is reached only by the steps of views the "
                                      f"text reports, not by its own" if o in rival_reached else
                                      f"the outcome `{o}` is not reached by the text's steps from "
                                      f"where its chain starts")))
    for i in ids:
        # A PART GOES ON AS ITS WHOLE. A state declared `part_of` another stops nowhere when the
        # whole leads on, or is what the chain is for: the metformin pass had a false dead end at
        # every part whose whole carried the next step (gap tests, 27 Sep 2026).
        whole = (states[i] or {}).get("part_of")
        onward = (whole is not None and whole != i
                  and (any(a == whole for a, _ in text_edges) or whole in outcomes))
        # AND WHAT A CHAIN IS FOR IS NO DEAD END on the whole map: the badger follow-up's outcome,
        # an outcome only in its own chain, was reported as the chain stopping (gap tests, 27 Sep).
        if (i in used and i not in outcomes and i not in ends and not (states[i] or {}).get("appraisal")
                and not onward and not any(a == i for a, _ in text_edges)):
            gaps.append(dict(kind="dead-end", state=i,
                             message=f"`{i}` leads nowhere in the text: the chain stops there"))
    if has_block and not interventions and not conditions:
        gaps.append(dict(kind="no-intervention", state=None,
                         message="no state has `role: intervention` or `role: condition`, so the "
                                 "chain has no stated cause to run from"))
    if has_block and not outcomes:
        gaps.append(dict(kind="no-outcome", state=None,
                         message="no state has `role: outcome`, so nothing says what the chain is "
                                 "for"))
    routes = []
    # THE TEXT'S OWN STARTING POINTS FIRST: an intervention, then a declared condition, each in the
    # order the file declares them; then what merely leads out. Listed alphabetically, a theory's
    # own route fell behind its moderators' in two papers running (wave 4, 28 Sep 2026).
    rank = {v: i for i, v in enumerate(ids)}
    for e in sorted(entries, key=lambda v: (v not in interventions, v not in conditions, rank[v])):
        for o in outcomes:
            if o == e:        # a state that is both where the circle starts and what it explains
                continue
            n, lo, hi, net = _routes(e, o, text_edges, ids, signs, regimes)
            if n:
                routes.append(dict(start=e, outcome=o, routes=n, shortest=lo, longest=hi, net=net))
    return dict(entries=entries, gaps=gaps, used=used, outcomes=outcomes, routes=routes,
                interventions=interventions)


def _kinds(block, states):
    """The kinds a block declares (profile 1.6), in declared order, each with its label and the
    declared states of that kind, in declared order."""
    raw = (block or {}).get("kinds") if isinstance(block, dict) else None
    out = []
    for kid, k in (raw.items() if isinstance(raw, dict) else ()):
        k = k if isinstance(k, dict) else {}
        members = [i for i, st in states.items()
                   if isinstance(st, dict) and st.get("kind") is not None and str(st.get("kind")) == str(kid)]
        gen = k.get("general")
        out.append(dict(id=str(kid), label=None if k.get("label") is None else str(k.get("label")),
                        states=members, general=str(gen) if gen is not None and str(gen) in members else None))
    return out


def _akin_steps(edges, kind_of, general=None, chains_of=None):
    """THE SAME STEP IN TWO CASES, computed rather than declared: two of the text's steps whose
    ends are each the same state or states of the same kind, and which are not one step. Merton's
    bank and his out-groups are one mechanism twice; the Coleman-boat paper's general migration
    and its Kenyan herders' are one kind of state in two cases. Nothing is walked between them."""
    def alike(x, y):
        return x == y or (kind_of.get(x) is not None and kind_of.get(x) == kind_of.get(y))
    # A GENERAL STEP AND ITS CASE (profile 1.7): of two akin steps, one generalises the other when
    # each of its ends is either the other's end or the general state of that end's kind.
    general = general or {}
    # TWO CASES ARE TWO CHAINS. Where steps say which chain they are in, two steps that share one
    # are alternatives within one case, not the same step in two: the Coleman-boat reading's
    # fishers who follow the fish and fishers who diversify locally were paired as two cases.
    chains_of = chains_of or {}
    def one_case(e, f):
        return bool(chains_of.get(e, set()) & chains_of.get(f, set()))
    def over(e, f):
        return all(x == y or general.get(kind_of.get(y)) == x for x, y in zip(e, f))
    es = sorted(set(edges))
    akin, instances = [], []
    for i, (a, b) in enumerate(es):
        for c, d in es[i + 1:]:
            if alike(a, c) and alike(b, d):
                if over((a, b), (c, d)):
                    instances.append([[a, b], [c, d]])
                elif over((c, d), (a, b)):
                    instances.append([[c, d], [a, b]])
                elif not one_case((a, b), (c, d)):
                    akin.append([[a, b], [c, d]])
    return akin, sorted(instances)


def _chains(block):
    """The chains a mechanism block declares (profile 1.5), in declared order: {id: {label,
    question, roles}}, with anything malformed read as absent (declared() names it)."""
    raw = (block or {}).get("chains") if isinstance(block, dict) else None
    out = {}
    for cid, ch in (raw.items() if isinstance(raw, dict) else ()):
        ch = ch if isinstance(ch, dict) else {}
        roles = ch.get("roles") if isinstance(ch.get("roles"), dict) else {}
        out[str(cid)] = dict(label=None if ch.get("label") is None else str(ch.get("label")),
                             question=None if ch.get("question") is None else str(ch.get("question")),
                             roles={str(k): v for k, v in roles.items()})
    return out


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

    chains = _chains(block)
    for s in all_steps:
        for c in s["chain"]:
            if c not in chains:
                findings.append(("!", "mechanism",
                                 f"`chain: {c}` is not one of the chains declared under "
                                 f"`mechanism: chains:`" if chains else
                                 f"`chain: {c}` names a chain, but the front matter declares no "
                                 f"`chains:`", {"title": s["title"]}))
        for v in s["via"]:
            if v not in states:
                findings.append(("!", "mechanism", f"`via: {v}` is not a declared state",
                                 {"title": s["title"]}))
            elif v in (s["src"], s["dst"]):
                findings.append(("?", "mechanism", f"`via: {v}` names the step's own `from` or "
                                 f"`to`", {"title": s["title"]}))
        for key in ("unless", "despite"):
            for u in s[key]:
                if u not in states:
                    findings.append(("!", "mechanism", f"`{key}: {u}` is not a declared state",
                                     {"title": s["title"]}))
                elif u in (s["src"], s["dst"]):
                    findings.append(("?", "mechanism", f"`{key}: {u}` names the step's own "
                                     f"`from` or `to`", {"title": s["title"]}))
        if s["share"] and s["share"] not in SHARES:
            findings.append(("!", "mechanism", f"`share: {s['share']}` is not one of "
                             f"{', '.join(SHARES)}", {"title": s["title"]}))
        elif s["raw"].get("share") is not None and not s["via"]:
            findings.append(("?", "mechanism", "`share` says how much of a step runs by a route, "
                             "and this step names none in `via`", {"title": s["title"]}))
        if s["on"] not in ("level", "trend"):
            findings.append(("!", "mechanism", f"`on: {s['on']}` is not `level` or `trend`",
                             {"title": s["title"]}))
        for g in s["given_raw"]:
            if isinstance(g, dict) and g.get("state") not in states:
                findings.append(("!", "mechanism", f"`given: {{state: {g.get('state')}}}` is not a "
                                 f"declared state", {"title": s["title"],
                                                      "fix": "name a declared state, or give the "
                                                             "condition in the text's words"}))
        for j in s["jointly"]:
            if j not in states:
                findings.append(("!", "mechanism", f"`jointly: {j}` is not a declared state",
                                 {"title": s["title"]}))
            elif j in (s["src"], s["dst"]):
                findings.append(("?", "mechanism", f"`jointly: {j}` names the step's own "
                                 f"`from` or `to`", {"title": s["title"]}))
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
    # A CO-CAUSE IS A CAUSE. "A and C jointly bring about B" makes C a cause of B as surely as A, so
    # the routes, loops and dead ends run through it; only the step count keeps the one step.
    # A BLOCKER IS A CAUSE TOO, of the opposite sign: more defence, less harm (1.8).
    text_edges |= _side_edges(text, states)
    # A STEP THE TEXT OPENS INTO A ROUTE IS WALKED AS THAT ROUTE (profile 1.8).
    opened = _opened(text, text_edges)
    for s in text:
        if not s["via"] or s["share"] == "none" or not all(v in states for v in s["via"]):
            continue
        run = [s["src"]] + s["via"] + [s["dst"]]
        missing = [f"{a} -> {b}" for a, b in zip(run, run[1:]) if (a, b) not in text_edges]
        if missing:
            findings.append(("?", "mechanism", f"`via` opens {s['src']} -> {s['dst']} into a route "
                             f"the text's steps do not give: no step {', '.join(missing)}",
                             {"title": s["title"],
                              "fix": "mark the finer steps the text states, or drop `via`; until "
                                     "then the step is walked as a step of its own"}))
    ids = list(states)
    sign_of = _signs(text, states)
    for s in text:
        # Only the step that names the route is held to its sign: a subgroup's `+` on the same pair
        # is another finding, not a claim about the route (levy map, 27 Sep 2026).
        if s["via"] and s["share"] == "entire" and (s["src"], s["dst"]) in opened and s["sign"] in ("+", "-"):
            run = [s["src"]] + opened[(s["src"], s["dst"])] + [s["dst"]]
            net = _net(sign_of, list(zip(run, run[1:])))
            if net in ("+", "-") and net != s["sign"]:
                findings.append(("?", "mechanism", f"{s['src']} -> {s['dst']} is `{s['sign']}`, "
                                 f"but the route it opens into nets `{net}`",
                                 {"title": s["title"]}))
    text_edges = text_edges - set(opened)
    regime_of = _regimes(text, states)
    null_from = {s["src"] for s in text_all if s["null"]}
    rival_edges = {(s["src"], s["dst"]) for s in causal if s["layer"] == "rival"}
    chain_ends = {i for ch in chains.values() for i, r in ch["roles"].items() if "outcome" in _as_list(r)}
    W = _walk(ids, states, text_edges, block is not None, sign_of, regime_of, null_from, rival_edges, chain_ends)
    entries, gaps, used = W["entries"], W["gaps"], W["used"]
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
    loops_text = _loops(ids, text_edges, regimes=regime_of)
    feedback = []
    for comp in _systems(ids, text_edges):
        members = set(comp)
        inside = [l for l in loops_text if set(l) <= members]
        shortest = _shortest_loops(comp, text_edges, ids)
        feedback.append(dict(states=comp, loops=len(inside), capped=len(loops_text) >= LOOP_CAP,
                             shortest=[dict(states=l, reflexive=reflexive(l, text),
                                            polarity=_polarity(l, sign_of)) for l in shortest]))
    loops_all = _loops(ids, {(s["src"], s["dst"]) for s in pool_all} - set(opened))
    routes = W["routes"]
    kinds = _kinds(block, states)
    kind_of = {i: str(st.get("kind")) for i, st in states.items()
               if isinstance(st, dict) and st.get("kind") is not None and any(k["id"] == str(st.get("kind")) for k in kinds)}
    general = {k["id"]: k["general"] for k in kinds if k["general"]}
    chains_of = {}
    for s in text:
        chains_of.setdefault((s["src"], s["dst"]), set()).update(s["chain"])
    akin_steps, instances = _akin_steps({(s["src"], s["dst"]) for s in text}, kind_of, general, chains_of)
    chain_profiles, unchained = _chain_profiles(chains, states, text, ids, reflexive, kind_of, instances,
                                                [s for s in causal if s["layer"] == "rival"], null_from)
    sign_pool = _signs(pool_all, states)

    spans = {lv for i in used for lv in levels_of(states[i], actors, levels)}
    profile = dict(
        question=(block or {}).get("question"),
        levels=levels, levels_spanned=[lv for lv in levels if lv in spans],
        states=len(states), steps=len(best),
        claims=len({s["title"] for s in text}),
        lags=sorted({str(s["lag"]) for s in text if s["lag"]}),
        # EACH LAG WITH ITS STEP. Joined into one line with "; ", Lenton's timings -- which contain
        # "; " themselves -- could not be read back, and Yellowstone's four periods of two texts
        # sat in one unordered list (gap tests, 27 Sep 2026).
        timed=sorted({(s["src"], s["dst"], str(s["lag"])) for s in text if s["lag"]}),
        entries=entries, routes=routes, interventions=W["interventions"],
        loops_text=[dict(states=l, reflexive=reflexive(l, text), polarity=_polarity(l, sign_of))
                    for l in loops_text],
        feedback=feedback,
        wholes=sorted([k, sorted(v)] for k, v in _wholes(states).items()),
        joint=sorted({(s["src"], s["dst"], s["sign"] or "", tuple(s["jointly"])) for s in text if s["jointly"]}),
        opened=sorted([a, b, v] for (a, b), v in opened.items()),
        blocked=sorted({(s["src"], s["dst"], s["sign"] or "", tuple(s["unless"])) for s in text if s["unless"]}),
        despite=sorted({(s["src"], s["dst"], s["sign"] or "", tuple(s["despite"])) for s in text_all if s["despite"]}),
        strata=_strata(text_all),
        sizes=sorted({(s["src"], s["dst"], s["sign"] or "", s["size"]) for s in text_all if s["size"]}),
        mediation=sorted([a, b, sh, list(v)] for a, b, sh, v in
                         {(s["src"], s["dst"], s["share"], tuple(s["via"])) for s in text if s["via"]}),
        regimes=sorted({s["regime"] for s in text_all if s["regime"]}),
        thresholds=sorted({(s["src"], s["dst"], s["sign"] or "", s["threshold"]) for s in text_all if s["threshold"]}),
        trends=sorted({(s["src"], s["dst"], s["sign"] or "") for s in text_all if s["on"] == "trend"}),
        spanning=sorted([i, levels_of(states[i], actors, levels)] for i in ids
                        if len(levels_of(states[i], actors, levels)) > 1),
        loops_with_appraisal=[dict(states=l, reflexive=reflexive(l, pool_all),
                                   polarity=_polarity(l, sign_pool)) for l in loops_all],
        tiers=tiers, gaps=[g["message"] for g in gaps],
        rival_steps=sum(1 for s in ok if s["layer"] == "rival"),
        null_steps=_nulls(text_all, ok, text_edges, ids),
        selection_steps=sorted({(s["src"], s["dst"]) for s in text_all if s["selects"]}),
        hedged=sum(1 for s in text_all if s["hedged"]),
        appraisal_claims=len(appraisal),
        appraisal_steps=sum(1 for s in ok if s["layer"] == "appraisal"),
        with_how=sum(1 for s in text if isinstance(s["how"], dict)),
        with_given=sum(1 for s in text if s["given"]),
        chains=chain_profiles, unchained=unchained,
        kinds=kinds, akin_steps=akin_steps, instances=instances,
    )
    for cp in chain_profiles:
        if not cp["steps"]:
            findings.append(("?", "mechanism", f"chain `{cp['id']}` is declared but no step of the "
                             f"text's own is marked `chain: {cp['id']}`", {"chain": cp["id"]}))
    return findings, profile


def _chain_profiles(chains, states, text, ids, reflexive, kind_of=None, instances=(), rival=(), null_from=()):
    """Each declared chain's own walk (profile 1.5), and how many of the text's steps sit in none.

    A chain is its steps: the states it touches are those its steps run through (a co-cause
    among them), with any state it gives a role to. It is walked with its OWN roles -- a state's
    role in the chain where the chain declares one, its declared role otherwise -- so that
    forest cover can be what one boat explains and where the next begins."""
    out = []
    member = {}
    for cid, c in chains.items():
        mine = [s for s in text if cid in s["chain"]]
        # A CHAIN OF STORIES THE TEXT REPORTS IS WALKED ON THOSE STEPS, and says so: Stone's
        # malnutrition stories made a chain of "0 steps" (wave 4, 28 Sep 2026).
        layer = "text"
        if not mine:
            mine = [s for s in rival if cid in s["chain"]]
            layer = "rival" if mine else "text"
        edges = {(s["src"], s["dst"]) for s in mine}
        edges |= _side_edges(mine, states)
        edges -= set(_opened(mine, edges))
        touched = {x for e in edges for x in e} | {k for k in c["roles"] if k in states}
        cids = [i for i in ids if i in touched]
        cstates = {i: ({**(states[i] or {}), "role": c["roles"][i]} if i in c["roles"]
                       else states[i]) for i in cids}
        csigns = _signs(mine, states)
        W = _walk(cids, cstates, edges, True, csigns, _regimes(mine, states), null_from)
        best = {(s["src"], s["dst"], s["sign"]) for s in mine}
        out.append(dict(id=cid, label=c["label"], question=c["question"], layer=layer,
                        steps=len(best), claims=len({s["title"] for s in mine}), states=cids,
                        roles={i: sorted(roles_of(cstates[i])) for i in cids if roles_of(cstates[i])},
                        entries=W["entries"], routes=W["routes"],
                        loops=[dict(states=l, reflexive=reflexive(l, mine), polarity=_polarity(l, csigns))
                               for l in _loops(cids, edges, regimes=_regimes(mine, states))],
                        gaps=[g["message"] for g in W["gaps"]], shared=[]))
        for i in cids:
            member.setdefault(i, []).append(cid)
    # WHAT COUPLES THEM: every state a chain shares with another, and which others.
    for cp in out:
        cp["shared"] = [[i, [o for o in member[i] if o != cp["id"]]] for i in cp["states"]
                        if len(member[i]) > 1]
    # AND WHAT IS AKIN (profile 1.6): a state of this chain whose kind a DIFFERENT state has in
    # another chain -- a weaker tie than a shared state, and reported as one.
    kind_of = kind_of or {}
    for cp in out:
        akin = []
        for i in cp["states"]:
            if i not in kind_of:
                continue
            there = [[o["id"], j] for o in out if o["id"] != cp["id"] for j in o["states"]
                     if j != i and kind_of.get(j) == kind_of[i]]
            if there:
                akin.append([i, kind_of[i], there])
        cp["akin"] = akin
    # A CHAIN THAT IS A CASE OF ANOTHER (profile 1.7): how many of its steps are cases of a general
    # step in each other chain.
    edges_of = {c: {(s["src"], s["dst"]) for s in text if c in s["chain"]} for c in chains}
    for cp in out:
        mine = edges_of[cp["id"]]
        cp["case_of"] = [[o["id"], n] for o in out if o["id"] != cp["id"]
                         for n in [len({tuple(case) for gen, case in instances
                                        if tuple(case) in mine and tuple(gen) in edges_of[o["id"]]})] if n]
    unchained = len({(s["src"], s["dst"], s["sign"]) for s in text if not s["chain"]}) if chains else 0
    return out, unchained


def _strata(text_all):
    """Each pair of states whose steps differ by condition: [from, to, [[sign, conditions], ...]].

    A STEP THAT DIFFERS BY SUBGROUP OR PLACE. The levy lowers obesity in year-6 girls and not in
    boys; culling lowers TB inside the zone and raises it outside. Kept as separate records, the
    census printed a mixed sign and a null "the text finds no effect"; grouped, it says where each
    holds (gap tests, 27 Sep 2026). Only a pair with two or more records and a condition on one."""
    by = {}
    for s in text_all:
        if s["selects"]:
            continue
        by.setdefault((s["src"], s["dst"]), set()).add((s["sign"] or "", tuple(s["given"]), s["period"], s["size"]))
    # A PERIOD IS A CONDITION OF TIME (G7): the badger cull's effect during culling and its null
    # after it are one step's time course, not a finding and a contradiction.
    # AND A SIZE STAYS WITH ITS CONDITION: printed apart, "stronger where devices exist" and the
    # 1990s' "diminished" against 2010's "large and stable" -- a paper's whole result -- could not
    # be read (wave 4, 28 Sep 2026).
    return sorted([a, b, sorted([sg, list(g), pd, sz] for sg, g, pd, sz in recs)] for (a, b), recs in by.items()
                  if len(recs) > 1 and any(g or pd for _, g, pd, _ in recs))


def _nulls(text_all, ok, text_edges=(), ids=()):
    """The text's null findings, each saying whether it answers a rival view's step on the same
    pair of states -- the dispute the J-PAL bulletin is about, made visible.

    WITH ITS CONDITIONS, AND THE ROUTES IT FACES. Most nulls the gap tests met hold only where
    something holds -- a knockout, a subgroup, a place -- and the census printed each as "the text
    finds no effect", the opposite of a knockout's point. And a null may answer a route the text's
    own steps compose rather than any one step (27 Sep 2026)."""
    out, seen = [], set()
    for s in text_all:
        if not s["null"] or (s["src"], s["dst"]) in seen:
            continue
        seen.add((s["src"], s["dst"]))
        against = sorted({r["sign"] for r in ok if r["layer"] == "rival" and not r["null"]
                          and (r["src"], r["dst"]) == (s["src"], s["dst"]) and r["sign"]})
        given, periods = [], []
        for t in text_all:
            if t["null"] and (t["src"], t["dst"]) == (s["src"], s["dst"]):
                given += [str(g) for g in t["given"] if str(g) not in given]
                if t["period"] and t["period"] not in periods:
                    periods.append(t["period"])
        n = _routes(s["src"], s["dst"], text_edges, ids)[0] if s["src"] != s["dst"] else 0
        out.append(dict(**{"from": s["src"], "to": s["dst"]}, basis=s["basis"],
                        refutes=against, given=given, periods=periods, routes=n))
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
    if p.get("timed"):
        for a, b, lag in p["timed"]:
            lines.append(f"      length  {a} -> {b}: {lag}")
    else:
        lines.append("      length  no timing stated in any step")
    # THE INTERVENTION'S ROUTES FIRST: listed in the order they were walked, a text's own
    # recommendation fell past the listed ten behind routes from conditions (gap tests, 27 Sep 2026).
    shown = sorted(p["routes"], key=lambda r: r["start"] not in p.get("interventions", []))
    if shown:
        for r in shown[:ROUTES_LISTED]:
            span = (f"{r['shortest']} step{'' if r['shortest'] == 1 else 's'}"
                    if r["shortest"] == r["longest"]
                    else f"{r['shortest']} to {r['longest']} steps")
            many = "+" if r["routes"] >= ROUTE_CAP else ""
            net = r.get("net") or {}
            nets = [f"{net[k]} {w}" for k, w in (("+", "raise"), ("-", "lower"),
                                                 ("?", "of no one sign")) if net.get(k)]
            lines.append(f"      route   {r['start']} -> {r['outcome']}: {r['routes']}{many} "
                         f"route{'' if r['routes'] == 1 else 's'}, {span}"
                         + (", every step of which must hold" if (r['longest'] or 0) > 1 else "")
                         + (f"; net: {', '.join(nets)}" if nets else ""))
            # WHICH WINS IS A MATTER OF SIZE: a net sign alone told a reader that metformin both
            # lowers and raises glucose (gap tests, 27 Sep 2026).
            if net.get("+") and net.get("-"):
                lines.append("              raises by some routes and lowers by others: which wins "
                             "is a matter of size" + (", and the text gives sizes on "
                                                      f"{len(p.get('sizes', []))} step(s)"
                                                      if p.get("sizes") else ", which the text does not give"))
        # NEVER CUT SILENTLY. Six of Yellowstone's ten were listed with no word of the rest, and
        # the four left out held the papers' central route (gap tests, 27 Sep 2026).
        if len(p["routes"]) > ROUTES_LISTED:
            lines.append(f"      route   ... and {len(p['routes']) - ROUTES_LISTED} more "
                         f"(every route is in --format json)")
        if any((r["longest"] or 0) > 1 for r in p["routes"]):
            lines.append("              composed: a route of several steps is the census's walk "
                         "through the text's steps, not a claim the text makes whole")
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
                             + (f"  ({l['polarity']})" if l.get("polarity") else "")
                             + ("  (reflexive)" if l["reflexive"] else ""))
        for l in p["loops_text"]:
            if any(set(l["states"]) <= b for b in inbig):
                continue
            lines.append("      loop    " + " -> ".join(l["states"] + l["states"][:1])
                         + (f"  ({l['polarity']})" if l.get("polarity") else "")
                         + ("  (reflexive: runs through a classification or representation)"
                            if l["reflexive"] else ""))
    else:
        lines.append("      loop    none closed in the text")
    text_loops = [l["states"] for l in p["loops_text"]]
    for l in p["loops_with_appraisal"]:
        if l["states"] not in text_loops:
            lines.append("      loop    " + " -> ".join(l["states"] + l["states"][:1])
                         + "  (closed only by the appraisal"
                         + (f"; {l['polarity']}" if l.get("polarity") else "")
                         + ("; reflexive" if l["reflexive"] else "") + ")")
    for a, b, via in p.get("opened", []):
        lines.append(f"      via     {a} -> {b} is the route through {', '.join(via)}: walked once, "
                     f"as that route")
    for a, b, sh, via in p.get("mediation", []):
        if sh in ("most", "partial"):
            lines.append(f"      via     {a} -> {b} runs {'mostly' if sh == 'most' else 'partly'} "
                         f"through {', '.join(via)}; the rest by a way the text does not open")
        elif sh == "none":
            lines.append(f"      via     {a} -> {b} does NOT run through {', '.join(via)}, the text says")
    if p.get("regimes"):
        lines.append(f"      regime  {len(p['regimes'])} named: {'; '.join(p['regimes'])} -- routes are "
                     f"composed within one regime, never across")
    for a, b, sg, th in p.get("thresholds", []):
        lines.append(f"      thresh  {a} -> {b}{' (' + sg + ')' if sg else ''}: only past a threshold -- {th}")
    for a, b, sg, sz in p.get("sizes", []):
        lines.append(f"      size    {a} -> {b}{' (' + sg + ')' if sg else ''}: {sz}")
    for a, b, sg, by in p.get("blocked", []):
        lines.append(f"      unless  {a} -> {b}{' (' + sg + ')' if sg else ''} is blocked where "
                     f"{' or '.join(by)} holds")
    for a, b, sg, by in p.get("despite", []):
        lines.append(f"      despite {a} -> {b}{' (' + sg + ')' if sg else ''} held although "
                     f"{' and '.join(by)} acted against it")
    for a, b, recs in p.get("strata", []):
        lines.append(f"      strata  {a} -> {b}: " + "; ".join(
            (f"{sg or 'unsigned'} " + " ".join(x for x in ("where " + " and ".join(g) if g else "", pd) if x)
             if g or pd else f"{sg or 'unsigned'} unconditioned") + (f" ({sz})" if sz else "")
            for sg, g, pd, sz in recs))
    for a, b, sg in p.get("trends", []):
        lines.append(f"      trend   {a} -> {b}{' (' + sg + ')' if sg else ''}: moves the trend of {b}, "
                     f"not its level -- {'slows its rise' if sg == '-' else 'speeds it' if sg == '+' else 'changes it'}")
    for a, b, sg, with_ in p.get("joint", []):
        lines.append(f"      joint   {a} -> {b}{' (' + sg + ')' if sg else ''} only together with {', '.join(with_)}")
    for st, lvs in p.get("spanning", []):
        lines.append(f"      span    {st} runs across {', '.join(lvs)}")
    for w, parts in p.get("wholes", []):
        lines.append(f"      whole   {w}: {', '.join(parts)} -- drawn as one box at the text's own level")
    by_id = {ch["id"]: ch for ch in p.get("chains", [])}
    for ch in p.get("chains", []):
        lines.append(f"      chain   {ch['id']}" + (f" \"{ch['label']}\"" if ch.get("label") else "")
                     + f": {ch['steps']} step{'' if ch['steps'] == 1 else 's'}, "
                     f"{len(ch['routes'])} route{'' if len(ch['routes']) == 1 else 's'} to an outcome, "
                     f"{len(ch['loops'])} loop{'' if len(ch['loops']) == 1 else 's'}, "
                     f"{len(ch['gaps'])} gap{'' if len(ch['gaps']) == 1 else 's'}"
                     + (" -- all in views the text reports" if ch.get("layer") == "rival" else ""))
        if ch.get("question"):
            lines.append(f"              question: {ch['question']}")
        for st, others in ch["shared"]:
            here = "/".join(ch["roles"].get(st, [])) or "no role"
            there = "; ".join(f"{o}: " + ("/".join(by_id[o]["roles"].get(st, [])) or "no role")
                              for o in others)
            lines.append(f"              shares  {st} ({here} here) with {there}")
        for st, k, there in ch.get("akin", []):
            lines.append(f"              akin    {st} is {k}, as " +
                         "; ".join(f"{j} in {o}" for o, j in there))
        for o, n in ch.get("case_of", []):
            lines.append(f"              case of {o}: {n} of its steps {'is a case' if n == 1 else 'are cases'} "
                         f"of a general step there")
    for k in p.get("kinds", []):
        if len(k["states"]) > 1:
            lines.append(f"      kind    {k['id']}" + (f" \"{k['label']}\"" if k.get("label") else "")
                         + f": {', '.join(k['states'])}"
                         + (f" ({k['general']} the general, the rest its cases)" if k.get("general") else "")
                         + " -- not the same state: nothing is walked between them")
    # TWO CASES OF ONE GENERAL STEP ARE SAID BY THEIR CASE LINES. Listed as pairs as well, Lenton's
    # nine elements printed 98 "akin" lines beside the 19 that mattered (gap tests, 27 Sep 2026).
    general_of = {}
    for g, c in p.get("instances", []):
        general_of.setdefault(tuple(c), set()).add(tuple(g))
    among_cases = 0
    for (a, b), (c, d) in p.get("akin_steps", []):
        if general_of.get((a, b), set()) & general_of.get((c, d), set()):
            among_cases += 1
            continue
        lines.append(f"      akin    {a} -> {b}  ~  {c} -> {d}: the same step in two cases")
    if among_cases:
        lines.append(f"      akin    and {among_cases} pair(s) of cases of one general step, not "
                     f"listed: the case lines below say it")
    for (a, b), (c, d) in p.get("instances", []):
        lines.append(f"      case    {c} -> {d} is a case of the general step {a} -> {b}")
    if p.get("unchained"):
        lines.append(f"      chain   {p['unchained']} step(s) of the text's own belong to no chain")
    t = p["tiers"]
    lines.append(f"      light   {t['evidence']} backed by a study, statistics or a model; "
                 f"{t['argued']} argued; {t['asserted']} asserted only; {t['imputed']} imputed")
    for n in p.get("null_steps", []):
        where = n.get("given") or []
        lines.append(f"      null    {n['from']} -> {n['to']}: the text finds no effect"
                     + (" where its condition holds" if where else "")
                     + (f" ({'; '.join(n['periods'])})" if n.get("periods") else "")
                     + (f" ({n['basis']})" if n["basis"] else "")
                     + (f", against the rival view's {'/'.join(n['refutes'])}"
                        if n["refutes"] else ""))
        for g in where:
            lines.append(f"              given   {g}")
        if n.get("routes"):
            lines.append(f"              beside  {n['routes']} route(s) the text's own steps give "
                         f"from {n['from']} to {n['to']}")
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


_MARKER_LINE = re.compile(r"^<!--\s*p\.\s*\d+\s+begins here\s*-->$")
_ENDS = re.compile(r"[.!?:][\"'\u201d\u2019)\]]*$")


def _sentences(text):
    """(line, sentence) for every sentence of running text: headings, the converter's comments,
    footnote definitions and the back matter left out."""
    raw_lines = text.split("\n")
    text = re.sub(r"<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    # THE SOURCE'S OWN FRONT MATTER IS NOT RUNNING TEXT. A converted paper carries its abstract
    # there, and read as prose it put the J-PAL abstract's four causal sentences on line 1 as
    # "uncovered", beside the same sentences in the body (26 Sep 2026). Blanked, lines kept.
    fm = re.match(r"---\n.*?\n---\n", text, flags=re.S)
    if fm:
        text = "\n" * fm.group(0).count("\n") + text[fm.end():]
    out, para, start = [], [], None
    lines = text.split("\n")
    # A SENTENCE A PAGE BREAK CUTS IS ONE SENTENCE. The converter sets each page marker on a line
    # of its own between blank lines, so the half before it and the half after were two
    # paragraphs, each counted as a causal sentence (gap tests, 27 Sep 2026). Where a marker
    # stands between two runs of text and the first stops mid-sentence, the paragraph goes on.
    after_marker = set()
    for i, raw in enumerate(raw_lines):
        if _MARKER_LINE.match(raw.strip()):
            b, j = i - 1, i + 1
            while b >= 0 and not raw_lines[b].strip():
                b -= 1
            while j < len(raw_lines) and not raw_lines[j].strip():
                j += 1
            after_marker.update(range(b + 1, j))
    for i, raw in enumerate(lines + [""], 1):
        line = raw.strip()
        if _STOP_HEADING.match(line):
            break
        if not line and para and (i - 1) in after_marker and not _ENDS.search(para[-1]):
            continue
        # A TABLE IS NOT A SENTENCE: Lenton's Table 1 counted as one "causal sentence" whole.
        if (not line or line.startswith("#") or line.startswith("[^") or line.startswith("===")
                or line.startswith("|")):
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
