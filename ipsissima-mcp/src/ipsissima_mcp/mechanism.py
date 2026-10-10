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
#: WHAT A MODERATOR DOES TO A STEP (profile 1.9, G1): Marti and Gond's six boundary conditions
#: "moderate the relationship between" a theory and experimentation; Valentino et al. find that
#: cue type does NOT moderate racial priming. `"0"` is that finding, quoted as the sign's zero is.
EFFECTS = ("strengthens", "weakens", "reverses", "0")
#: THE TYPE OF A CAUSAL ATTRIBUTION (profile 1.9, N-i): Stone's typology, built from whether the
#: action was purposeful and whether its consequences were intended. `mechanical` is her "guided
#: through an intervening agent"; `complex` her web of causes with no single locus.
ATTRIBUTIONS = ("intentional", "mechanical", "inadvertent", "accidental", "complex")
#: WHERE A TEXT STANDS ON A VIEW IT REPORTS (profile 1.9, G11). `#reported` said only "set out,
#: not held"; Stone reports stories she calls "neither right nor wrong", and others she rejects.
#: A report the author ENDORSES is not a third stance: it is a claim in her own voice, hedged where
#: the reporting works as a hedge (James, 29 Sep 2026) -- so `endorsed` is named, not read.
STANCES = ("rejected", "unjudged")
#: THE TEXT'S OWN WORDS FOR ITS EVIDENCE (profile 1.9, G10), where `basis` is too coarse. These
#: few are read; anything else is kept as written. `illustration` is a hypothetical case: it
#: shows how a step could go, not that it does, and is never shaded as evidence.
DESIGNS = ("experiment", "replication", "quasi-experiment", "natural experiment", "observational",
           "case study", "illustration", "anecdote", "review", "simulation")
#: CAUSAL REASONING, AFTER JOHANSSON ET AL. (2024), A Primer to Causal Reasoning About a Complex World
#: (profile 1.13, 30 Sep 2026). What a chain is FOR: to explain why and how something happened, to
#: find what to do to bring an effect about, to predict, or to attribute responsibility -- "what
#: cause was decisive in bringing about an effect?" (p. 112).
GOALS = ("explain", "intervene", "predict", "attribute")

#: HOW FAR THE MECHANISM IS MAPPED (profile 1.17). Under the parallel method every text's mechanism
#: is considered (James, 1 Oct 2026: arguments that need no understanding of mechanisms are "the
#: exception rather than the default"), but not every text repays a full pass. `full` marks the
#: chain as the text asserts it; `sketch` names the question, actors and chains and marks steps
#: only where the argument relies on them, so a state with no step is no gap; `none` records that
#: the mechanism was considered and not mapped. The last two say why, in `depth_reason`.
DEPTHS = ("full", "sketch", "none")

#: THE ORDER A CHAIN'S STEPS ARE TOLD IN (profile 1.17). A pragmatic genealogy is a dynamic model whose
#: stages come in the order complications are added -- "later primarily means less idealized"
#: (Queloz 2021, p. 16) -- not the order of history; the chart lays every chain out left to right,
#: and every reader takes that as time. Mistaking one for the other is the first genetic fallacy
#: Cohen and Nagel named. `time` is the default.
CHAIN_ORDERS = ("time", "explanation")


def _order(block):
    """A block's or a chain's declared `order`, or None."""
    o = block.get("order") if isinstance(block, dict) else None
    return None if o is None else str(o)


def depth_of(block):
    """(depth, reason) of a mechanism block: `full` unless it says otherwise."""
    if not isinstance(block, dict) or block.get("depth") is None:
        return "full", None
    r = block.get("depth_reason")
    return str(block.get("depth")), (None if r is None else str(r))

#: THE METHOD IN FORCE FOR A TEXT'S MECHANISM (1.15). `parallel`: the argument and the mechanism
#: are read together, and the mechanism enters the argument through bridges (parallel-pass.md;
#: adopted 1 Oct 2026 on the author's word, after the trial of 30 Sep in which he judged the
#: parallel maps better). `series`: the argument first, finished and checked, then the mechanism
#: pass, which changes nothing in it (mechanism-pass.md; ruled 26 Sep 2026). REVERSIBLE BY ONE
#: SETTING, as the author asked: IPSISSIMA_MECHANISM_METHOD=series (the extension's "Mechanism
#: method" option sets it) puts every document, offer and instruction back as it was.
MECHANISM_METHODS = ("parallel", "series")
DEFAULT_MECHANISM_METHOD = "parallel"


def mechanism_method():
    """The method in force: the environment's choice if it names one, else the default."""
    v = os.environ.get("IPSISSIMA_MECHANISM_METHOD", "").strip().lower()
    return v if v in MECHANISM_METHODS else DEFAULT_MECHANISM_METHOD


def _bridge_schemes():
    """The causal schemes an inference line may name (profile 1.15), from the registry that ships
    beside this module -- read, not restated, so the two cannot disagree."""
    try:
        import json
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "profile.json"),
                  encoding="utf-8") as fh:
            return {d["name"].lower(): d for d in json.load(fh)["bridges"]["schemes"]}
    except (OSError, ValueError, KeyError):
        return {}


#: BRIDGES FROM THE MECHANISM INTO THE ARGUMENT (profile 1.15, after the parallel-pass trial of
#: 30 Sep 2026). An inference line naming one of these says a step-bearing claim is a premise of
#: a causal move -- "From consequences", "Genealogical debunking" -- not that a deductive rule
#: holds. Never checked for validity; held to having a step among its premises.
BRIDGES = _bridge_schemes()


def _relation_keys():
    """{"causes": keys, "constitutes": keys}: the keys a step and a constitutive relation may
    carry, from the registry -- so a key added to the profile is known here at once."""
    try:
        import json
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "profile.json"),
                  encoding="utf-8") as fh:
            p = json.load(fh)
        return {k: frozenset(x for x in p[k] if x != "summary") for k in ("causes", "constitutes")}
    except (OSError, ValueError, KeyError):
        return {}


#: UNKNOWN KEYS WERE SILENT (1 Oct 2026). A `note:` written inside a step, or a misspelt
#: `sgn:`, passed every check and was simply never read. The keys are the profile's own.
RELATION_KEYS = _relation_keys()


def _declaration_keys():
    """{"block", "states", "actors", "chains", "kinds", "channels"}: the keys each part of the
    `mechanism:` block may carry, from the registry, as RELATION_KEYS has them for steps."""
    try:
        import json
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "profile.json"),
                  encoding="utf-8") as fh:
            m = json.load(fh)["mechanism"]
        out = {"block": frozenset(k for k in m if k != "summary"), "channels": frozenset({"label"})}
        for part in ("states", "actors", "chains", "kinds"):
            out[part] = frozenset(m[part]["keys"])
        return out
    except (OSError, ValueError, KeyError):
        return {}


#: UNKNOWN KEYS IN THE FRONT MATTER WERE SILENT TOO (10 Oct 2026), as a step's were until 1.16: a
#: misspelt `lable:` on a state, or a step's `design:` written on a state, was never read and
#: nothing said so. Found once in 64 maps when the editor began to check the vocabulary as it is
#: written (NOTES-integration.md, item 1).
DECLARATION_KEYS = _declaration_keys()


def _unknown_in(d, part):
    """(key, nearest known key or None) for each key of `d` that part `part` of the block may not carry."""
    import difflib
    known = DECLARATION_KEYS.get(part)
    if not known or not isinstance(d, dict):
        return []
    out = []
    for k in d:
        if str(k) not in known:
            near = difflib.get_close_matches(str(k), sorted(known), n=1, cutoff=0.6)
            out.append((str(k), near[0] if near else None))
    return out


def _unknown_keys(c, kind):
    """(key, nearest known key or None) for each key of relation `c` the profile does not know."""
    import difflib
    known = RELATION_KEYS.get(kind)
    if not known or not isinstance(c, dict):
        return []
    out = []
    for k in c:
        if str(k) not in known:
            near = difflib.get_close_matches(str(k), sorted(known), n=1, cutoff=0.6)
            out.append((str(k), near[0] if near else None))
    return out


def bridge_scheme(rule_names):
    """The bridge scheme an inference line names, or None. A line naming anything else as well
    is not a bridge: a compound of a scheme and a deductive rule is the validity check's."""
    names = [str(r).strip().lower() for r in (rule_names or []) if str(r).strip()]
    return BRIDGES[names[0]] if len(names) == 1 and names[0] in BRIDGES else None


def bridges_of(doc, step_titles):
    """Every bridge in the file: (argument, step number, scheme name, input titles, inputs that
    state a step). Inputs are the declared `uses` where given, else the run since the last
    conclusion plus the conclusion carried from the step before, as the validity check reads them."""
    out = []
    for title, arg in (doc.get("arguments") or {}).items():
        pcs = arg.get("pcs") or []
        run, prev, step = [], None, 1
        for n, entry in enumerate(pcs, start=1):
            if entry.get("role") == "premise":
                run.append(n)
                continue
            inf = entry.get("inference") or {}
            scheme = bridge_scheme(inf.get("inferenceRules"))
            if scheme:
                declared = (inf.get("data") or {}).get("uses")
                inputs = [int(u) for u in declared] if isinstance(declared, list) else run + ([prev] if prev else [])
                titles = [pcs[i - 1].get("title") for i in inputs if 1 <= i <= len(pcs)]
                titles = [t for t in titles if t]
                out.append((title, step, scheme["name"], titles, [t for t in titles if t in step_titles]))
            prev, run, step = n, [], step + 1
    return out
#: HOW THE TEXT REASONS ABOUT CAUSES (profile 1.14): the account of causation it works with -- regular
#: succession, manipulation, a mechanism, counterfactual difference, or intra-action, where relations
#: constitute what they relate (Hertz et al. 2024, "Eliciting the plurality of causal reasoning", Table 1;
#: counterfactual dependence from the Primer, ch. 4).
#: What an arrow means differs with each.
ACCOUNTS = ("regularity", "manipulability", "mechanism", "counterfactual", "intra-action")
EXPERIMENTAL = ("experiment", "replication", "quasi-experiment", "natural experiment")
#: WHAT A STEP IS ABOUT: a particular case ("the assassination caused the war") or a general
#: relation between kinds or variables ("exercise increases fitness"). They need different evidence:
#: a general claim cannot be read off one case without background knowledge (pp. 44-47).
SCOPES = ("singular", "general")
#: WORDS THAT REPORT AN ASSOCIATION, NOT A CAUSE. "Association" is "often mistakenly interpreted as a
#: term for a causal relation" (p. 71). A step in these words is queried.
# Lower case only: "the Association of Ambulance Chief Executives" is a name, not a finding (the
# health-system map, 30 Sep 2026).
ASSOCIATED = re.compile(r"\b(associat(ed|ion|ions)|correlat(ed|es|ion|ions)|linked (to|with)|co-?occur\w*|go(es)? together)\b")

#: WORDS THAT DENY SUFFICIENCY, NOT EFFECT. "Will not itself destroy", "do not quietly vanish",
#: "perhaps not exorcized": Merton limits a remedy's effect, and three nulls read him as finding
#: none (James's verdicts on the Merton map, 29 Sep 2026). A null in such words is queried.
NOT_ENOUGH = re.compile(r"\b(itself|by itself|alone|on its own|single-handedly|quietly|entirely|completely|"
                        r"fully|wholly|not enough|not sufficient|insufficient|no guarantee|not guarantee|"
                        r"exorci[sz]ed|cure-all|panacea)\b", re.I)

# PROCESS, FORMATION AND CONSTITUTION (profile 1.11, 30 Sep 2026). The chart was built as a noun-
# and-arrow language: states that are amounts, levels and rates, joined by steps that raise or lower
# them. Arthur (2023, "Economics in Nouns and Verbs") names what such a language cannot see --
# formation: things coming into being, being kept going, changing in kind -- and Wimmer, Hu,
# Martinez-Pena and Ylikoski and Wilson (2023) each needed it (NOTES-process.md and
# NOTES-constitution.md in the research folder). What 1.11 adds, each optional and each read from
# the text's own words:
#: WHAT KIND OF OCCURRENCE A STATE IS. A `quantity` is an amount, level or rate (a noun); an
#: `activity` goes on and is complete at every moment ("fishers diversify"); a `development` heads
#: to an end through stages (a theory becoming self-fulfilling); an `event` happens at a time; a
#: `condition` is a standing arrangement. Recorded from the text's grammar, not the reconstructor's
#: metaphysics, so the census can say whether a chain is told in nouns or in verbs.
ASPECTS = ("quantity", "activity", "development", "event", "condition")
#: BEHAVIOUR OVER TIME (1.19, after Meadows): the shape the text says a state follows, drawn as a sketch
#: on its box. Half of Meadows's figures are such graphs, and her prose explains a structure by them.
BEHAVIOURS = ("grows", "declines", "levels off", "s-shaped", "oscillates", "overshoot and collapse", "steady")
#: A RELATION THAT RISES AND FALLS (1.19): Meadows's fish breed most at middling density.
SHAPES = ("peak", "trough")
NOUN_ASPECTS = ("quantity", "condition")
#: WHAT A STEP ACTS ON. `level` and `trend` since 1.8; since 1.11 a step may MAKE or UNMAKE its `to`
#: (`being`, + and -), MAINTAIN or ERODE it (`persistence`: Hu's institutions "produce and maintain
#: race", Wimmer's "stabilizing" feedbacks), or change what KIND of thing it is (`character`,
#: `sign: which`: Arthur's structural change, Wimmer's "transformative" feedbacks).
ONS = ("level", "trend", "being", "persistence", "character", "possibility", "chance", "stock")
#: (profile 1.14) `chance`: the step raises or lowers the CHANCE of its `to` -- "increases the risk of",
#: "makes more likely". General causation is probabilistic, p(B|A) > p(B) (Johansson et al. 2024,
#: p. 49), and an arrow alone cannot say "sometimes, often, or always" (Banitz et al. 2022, "Visualization
#: of causation in social-ecological systems").
#: `stock`: the step FLOWS INTO (+) or FLOWS OUT OF (-) its `to`, a stock -- an inflow or an outflow (Meadows). The two
#: need not move together: "fish reproduction adds to the fish population", yet reproduction may fall
#: while the population rises (Banitz et al. 2022, Fig. 2B), so a loop's polarity through such a
#: step says less than it seems to.
#: WHAT CAN HAPPEN, NOT WHAT DOES (profile 1.12). A step may OPEN or CLOSE a possibility (`on:
#: possibility`, + and -): Hertz et al. (2020) make the "possibility space" -- what can enter an
#: event at a moment, reconfigured by every event -- a core concept of a process ontology, and
#: Wilson (2023, p. 361) has means-improvement shape values-improvement "by opening up new
#: possibilities".
FORMATION = ("being", "persistence", "character", "possibility")
#: WHETHER A STATE IS ACTUAL (profile 1.12). `possible`: a possibility the text sets out, not (or not
#: yet) actual -- an option, a path open to the actors. `open`: what the text says cannot be specified
#: in advance -- the "surplus" of a process of individuation, "the virtual" (Hertz et al. 2025, after
#: Deleuze), as against the possible, which is read off what things now are.
STATUSES = ("actual", "possible", "open")
#: THE FORM OF A CHAIN. A `cycle` is a cycle of reproduction and transformation (Wimmer p. 1009:
#: variables "dependent" or "independent" depending on "which phase in the cycle"); it is not asked
#: where it starts or what it is for. `settles` says whether the text says it comes to rest.
FORMS = ("chain", "cycle")
#: HOW A WHOLE STANDS TO WHAT CONSTITUTES IT: no more than their sum; dependent on their
#: organisation ("more than mere aggregation", Martinez-Pena and Ylikoski p. 10; Wilson's "fallacy
#: of composition", p. 359); or nothing but them (reduction: the kettle's boiling).
WHOLES = ("aggregate", "organised", "reducible", "mutual")
#: `mutual` (profile 1.12): the whole and what makes it up make each other -- the parts are what
#: they are only within it. Hertz et al. (2020) deny that an emergent whole is "a simple combination,
#: aggregation or particular organization of the individual components"; Hertz et al. (2025) put
#: the locus of causality "neither in parts, nor in wholes, but in the 'organization' of performative
#: relations". `organised` still assumes given parts; `mutual` does not.
EXTENTS = ("partial", "entire")
#: A CONSTITUTIVE RELATION'S BASIS may be an account's judgement or a definition as well as what a
#: step's may be: which relations constitute race is "not reducible to data-mining" (Hu, p. 14).
CONSTITUTION_BASES = BASES + ("account", "definition")


def form_of(block):
    """(form, settles, problems) that a mechanism block or a chain declares (profile 1.11)."""
    block = block if isinstance(block, dict) else {}
    problems = []
    form = block.get("form")
    form = "chain" if form is None else str(form)
    if form not in FORMS:
        problems.append(("!", f"`form: {form}` is not `chain` or `cycle`", {}))
        form = "chain"
    settles = block.get("settles")
    if settles is not None and not isinstance(settles, bool):
        problems.append(("!", f"`settles:` is `true` or `false`, not `{settles}`", {}))
        settles = None
    elif settles is not None and form != "cycle":
        problems.append(("?", "`settles` says whether a cycle comes to rest, and this is not declared "
                              "`form: cycle`", {}))
    return form, settles, problems


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


# WHAT KIND OF ORDERING THE LEVELS ARE (profile 1.10). A `levels:` list says only that the text
# orders things, not by what: across twelve research maps the same key carried composition,
# spatial scale, a food chain, separate systems and roles side by side within a whole (Ylikoski
# 2024: "level" is a placeholder for several orderings; Craver 2025: levels of mechanisms are a
# tree of composition). A reader of the chart who had not read the paper could not tell which
# (James, 30 Sep 2026). `ordering:` says it; `within:` gives each level its parent, for the tree.
ORDERINGS = {
    "composition": "parts within wholes",
    "space": "regions within regions",
    "authority": "a chain of command",
    "scale": "larger and smaller, not containing",
    "sequence": "an order along a chain",
    "systems": "separate systems",
    "mixed": "more than one ordering",
    "unstated": "an ordering the text does not name",
}
NESTING = ("composition", "space", "authority")


def level_order(block, levels):
    """(ordering, problems): what `ordering:` and `within:` declare about the levels.

    `ordering` is {"kind", "stated", "within"}: the kind of ordering or None; the pinpoint where the
    text says so, or None when it is the reconstructor's reading; and `within` as sorted
    [child, parent] pairs. The tree must be drawable in the list's own order -- every level's
    descendants straight after it -- or nesting would draw a part outside its whole."""
    problems = []
    block = block if isinstance(block, dict) else {}
    raw = block.get("ordering")
    kind, stated = None, None
    if isinstance(raw, dict):
        kind, stated = raw.get("kind"), raw.get("pinpoint")
    elif raw is not None:
        kind = raw
    if kind is not None:
        kind = str(kind)
        if kind not in ORDERINGS:
            problems.append(("!", f"`ordering: {kind}` is not one of {', '.join(ORDERINGS)}",
                             {"fix": "name the kind of ordering the levels are, or `unstated`"}))
            kind = None
    within = block.get("within")
    pairs = []
    if within is not None:
        if not isinstance(within, dict):
            problems.append(("!", "`within:` must map a level to the level it is within", {}))
        else:
            for c, par in within.items():
                c, par = str(c), str(par)
                bad = [x for x in (c, par) if x not in levels]
                if bad:
                    problems.append(("!", f"`within: {{{c}: {par}}}` names `{bad[0]}`, which is not one "
                                          f"of the declared levels", {}))
                    continue
                if c == par:
                    problems.append(("!", f"`within:` puts `{c}` within itself", {}))
                    continue
                pairs.append([c, par])
    parent = {c: par for c, par in pairs}
    # A cycle, or a tree the list's order cannot draw.
    for lv in levels:
        seen, p = set(), parent.get(lv)
        while p is not None and p not in seen:
            seen.add(p); p = parent.get(p)
        if p is not None:
            problems.append(("!", f"`within:` runs in a circle through `{lv}`", {}))
            parent, pairs = {}, []
            break
    def anc(lv):
        out, p = [], parent.get(lv)
        while p is not None and len(out) < 50:
            out.append(p); p = parent.get(p)
        return out
    for i, lv in enumerate(levels):
        j = i
        while j + 1 < len(levels) and lv in anc(levels[j + 1]):
            j += 1
        if any(lv in anc(x) for x in levels[j + 1:]):
            want = []
            def walk(x):
                want.append(x)
                for y in levels:
                    if parent.get(y) == x:
                        walk(y)
            for x in levels:
                if x not in parent:
                    walk(x)
            problems.append(("?", f"`within:` puts a level outside the run of its whole: in the order "
                                  f"`levels:` lists them the tree cannot be drawn nested",
                             {"fix": f"list each level's parts straight after it: levels: [{', '.join(want)}]"}))
            break
    if pairs and kind is not None and kind not in NESTING:
        problems.append(("?", f"`within:` says the levels nest, but `ordering: {kind}` "
                              f"({ORDERINGS[kind]}) is not a containment",
                         {"fix": "drop `within:`, or say the ordering is composition, space or authority"}))
    return {"kind": kind, "stated": None if stated is None else str(stated),
            "within": sorted(pairs, key=lambda q: levels.index(q[0]))}, problems


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
        # A PROCESS WITH NO OWNER (profile 1.11): a cascade of scarcity, the dynamics of boundary
        # making. Such a state names no actor and is placed by its own `levels:`.
        # SEVERAL ACTORS TOGETHER (profile 1.12): a relation, or a doing no one of them does alone --
        # the ayllu, where people and land "exist together" (Hertz et al. 2020, after De la Cadena).
        who = _as_list(s.get("actor"))
        if not who and _as_list(s.get("levels")):
            pass
        elif not who:
            problems.append(("!", f"state `{sid}` names no actor: name one, or give its `levels:` "
                                  f"where it is a process with no owner", {"state": str(sid)}))
        for a in who:
            if a not in actors:
                problems.append(("!", f"state `{sid}` names actor `{a}`, which is not "
                                      f"declared under `actors:`", {"state": str(sid)}))
        if s.get("status") is not None and str(s.get("status")) not in STATUSES:
            problems.append(("?", f"state `{sid}` has `status: {s.get('status')}`; the statuses read are "
                                  f"{', '.join(STATUSES)}", {"state": str(sid)}))
        if s.get("aspect") is not None and str(s.get("aspect")) not in ASPECTS:
            problems.append(("?", f"state `{sid}` has `aspect: {s.get('aspect')}`; the aspects read are "
                                  f"{', '.join(ASPECTS)}", {"state": str(sid)}))
        # 1.19: BEHAVIOUR, OBSERVED, DEAD END -- the diagram comparison's findings 6, 18 and 20.
        if s.get("behaviour") is not None and str(s.get("behaviour")) not in BEHAVIOURS:
            problems.append(("!", f"state `{sid}` has `behaviour: {s.get('behaviour')}`; the behaviours read are "
                                  f"{', '.join(BEHAVIOURS)}", {"state": str(sid)}))
        for key in ("observed", "dead_end"):
            if s.get(key) is not None and not isinstance(s.get(key), bool):
                problems.append(("!", f"state `{sid}`: `{key}:` is `true` or `false`, not `{s.get(key)}`", {"state": str(sid)}))
        # A STATE ACROSS LEVELS (profile 1.4): Wimmer's consensus, reached in micro-level
        # negotiation and holding as a macro-level fact; the Coleman boat's transformational step.
        for lv in _as_list(s.get("levels")):
            if lv not in levels:
                problems.append(("!", f"state `{sid}` names level `{lv}`, which is not one of the "
                                      f"declared levels", {"state": str(sid)}))
        # A MEASURE OF A STATE (profile 1.9, G10): an indicator or estimate, not a cause of it.
        # Valentino's timing experiment moves the MEASURED priming; Yellowstone's crown volume is
        # computed from height; metformin's markers stand for its states. Three texts in four
        # waves needed the relation, and drawn as a step it composed routes through a method.
        meas = s.get("measures")
        if meas is not None and meas not in states:
            problems.append(("!", f"state `{sid}` `measures: {meas}`, which is not a declared state",
                             {"state": str(sid)}))
        elif meas is not None and meas == sid:
            problems.append(("!", f"state `{sid}` `measures` itself", {"state": str(sid)}))
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
    for sev, msg, where in form_of(m)[2]:
        problems.append((sev, msg, where))
    if _order(m) is not None and _order(m) not in CHAIN_ORDERS:
        problems.append(("!", f"`order: {_order(m)}` is not one of {', '.join(CHAIN_ORDERS)}", {}))
    for _cid, _ch in ((m.get("chains") or {}).items() if isinstance(m.get("chains"), dict) else ()):
        if _order(_ch) is not None and _order(_ch) not in CHAIN_ORDERS:
            problems.append(("!", f"chain `{_cid}`: `order: {_order(_ch)}` is not one of {', '.join(CHAIN_ORDERS)}",
                             {"chain": str(_cid)}))
    _d, _why = depth_of(m)
    if _d not in DEPTHS:
        problems.append(("!", f"`depth: {_d}` is not one of {', '.join(DEPTHS)}", {}))
    elif _d != "full" and not _why:
        problems.append(("?", f"`depth: {_d}` says the mechanism is not mapped in full, and no "
                              f"`depth_reason:` says why", {"fix": "add a one-line `depth_reason:`"}))
    if m.get("goal") is not None and str(m.get("goal")) not in GOALS:
        problems.append(("?", f"`goal: {m.get('goal')}` is not one of {', '.join(GOALS)}", {}))
    for a in _as_list(m.get("account")):
        if a not in ACCOUNTS:
            problems.append(("?", f"`account: {a}` is not one of {', '.join(ACCOUNTS)}", {}))
    # CHANNELS (1.19): the kinds of link the text tells apart, each in its own words -- ecological
    # against social (the Coleman-boat paper), signalling against metabolic (Rena et al.).
    chs = m.get("channels")
    if chs is not None and not isinstance(chs, dict):
        problems.append(("!", "`channels:` maps an id to `{label}`", {}))
    problems.extend(_boundary_problems(m, {}, ""))
    for cid, ch in (chains.items() if isinstance(chains, dict) else ()):
        ch = ch if isinstance(ch, dict) else {}
        problems.extend(_boundary_problems(ch, {"chain": str(cid)}, f"chain `{cid}`: "))
        # CONDITIONED ON (1.19, Knight and Winship): the states this chain's analysis holds fixed; a
        # list inside the list is states that cannot be conditioned on apart.
        for item in _as_list(ch.get("conditioned")) if not isinstance(ch.get("conditioned"), list) else ch.get("conditioned"):
            for sid in (item if isinstance(item, list) else [item]):
                if str(sid) not in states:
                    problems.append(("!", f"chain `{cid}`: `conditioned:` names `{sid}`, which is not a declared state",
                                     {"chain": str(cid)}))
        for sev, msg, _ in form_of(ch)[2]:
            problems.append((sev, f"chain `{cid}`: {msg}", {"chain": str(cid)}))
        if ch.get("goal") is not None and str(ch.get("goal")) not in GOALS:
            problems.append(("?", f"chain `{cid}`: `goal: {ch.get('goal')}` is not one of {', '.join(GOALS)}", {"chain": str(cid)}))
        for a in _as_list(ch.get("account")):
            if a not in ACCOUNTS:
                problems.append(("?", f"chain `{cid}`: `account: {a}` is not one of {', '.join(ACCOUNTS)}", {"chain": str(cid)}))
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
    # KEYS THE PROFILE DOES NOT KNOW, in the block and in each thing it declares: never read.
    _dym = lambda near: f" -- did you mean `{near}`?" if near else ""
    for k, near in _unknown_in(m, "block"):
        problems.append(("!", f"`{k}` is not a key the `mechanism:` block can carry, so it is never "
                              f"read" + _dym(near), {}))
    for part, noun, a in (("states", "state", "a state"), ("actors", "actor", "an actor"),
                          ("chains", "chain", "a chain"), ("kinds", "kind", "a kind"),
                          ("channels", "channel", "a channel")):
        coll = m.get(part)
        for xid, x in (coll.items() if isinstance(coll, dict) else ()):
            for k, near in _unknown_in(x, part):
                problems.append(("!", f"{noun} `{xid}`: `{k}` is not a key {a} can carry, so it is "
                                      f"never read" + _dym(near), {noun: str(xid)}))
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
                stance = "" if c.get("stance") is None else str(c.get("stance"))
                imputed = d.get("fidelity") == "imputation"
                basis = c.get("basis")
                # `sign: 0` arrives from YAML as an int, `sign: "0"` as a string: one meaning.
                sign = None if c.get("sign") is None else str(c.get("sign"))
                tier = "imputed" if imputed else _TIER_OF_BASIS.get(basis, "asserted")
                # A HYPOTHETICAL ILLUSTRATION IS NOT AN EXAMPLE (wave 4): it shows how a step could
                # go, not that it did, and is shaded as what the text asserts.
                if not imputed and str(c.get("design")) == "illustration":
                    tier = "asserted"
                if tier == "asserted" and supports.get(title):
                    tier = "argued"
                given = c.get("given") or []
                given = given if isinstance(given, list) else [given]
                mods = c.get("modifies")
                mods = [m for m in (mods if isinstance(mods, list) else [mods] if mods else [])]
                out.append(dict(
                    unknown=_unknown_keys(c, "causes"),
                    title=title, kind=kind, tags=sorted(tags),
                    text=" ".join(m.get("text") or "" for m in (node.get("members") or [])),
                    layer=layer,
                    reported=layer == "rival", stance=stance,
                    fidelity=d.get("fidelity"), warrant=d.get("warrant"),
                    src=c.get("from"), dst=c.get("to"), sign=sign,
                    # NULL: the text finds NO effect here -- a finding, not an absence (trial of
                    # 26 Sep: the J-PAL bulletin's central results are nulls, and without a form
                    # for them the chain drew only the rival steps they refute).
                    null=(sign == "0"),
                    # SELECTION: a link that holds because of WHO ends up on each side -- the
                    # screening effect -- not because one state brings the other about.
                    selects=bool(c.get("selects")),
                    # AN ASSOCIATION (profile 1.13): the text reports that the two go together and does
                    # not say one brings the other about -- reported, drawn without a head, never walked.
                    assoc=bool(c.get("association")),
                    # SCOPE (1.13): a particular case, or a general relation.
                    scope="" if c.get("scope") is None else str(c.get("scope")),
                    hedged=bool(c.get("hedged")),
                    # 1.19: the step's NAME and MARK in the text's words, its CHANNEL, a SHAPE that
                    # rises and falls, and a NET flow that runs whichever way the gap points.
                    name="" if c.get("name") is None else str(c.get("name")),
                    mark="" if c.get("mark") is None else str(c.get("mark")),
                    channel="" if c.get("channel") is None else str(c.get("channel")),
                    shape="" if c.get("shape") is None else str(c.get("shape")),
                    net=c.get("net"),
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
                    # MODIFIES (1.9, G1): the states that strengthen, weaken or reverse the step,
                    # or that the text finds do not moderate it -- each {by, effect, period}.
                    modifies=[dict(by=str(m.get("by")) if isinstance(m, dict) and m.get("by") is not None else "",
                                   effect=str(m.get("effect")) if isinstance(m, dict) and m.get("effect") is not None else "",
                                   period=str(m.get("period")) if isinstance(m, dict) and m.get("period") is not None else "")
                              for m in mods],
                    # NECESSARY and SUFFICIENT (1.9, G5): "only if", and whether the cause (with
                    # its co-causes) brings the effect about on its own -- or, `false`, does not.
                    necessary=c.get("necessary"), sufficient=c.get("sufficient"),
                    # MEASURED BY (1.9): the measure the step's evidence is read from. A step into
                    # that measure -- a bias in it -- bears on the evidence, not on the world:
                    # MacNulty's point against Ripple (James's verdict, 29 Sep 2026).
                    measured_by=_as_list(c.get("measured_by")),
                    # DESIGN (1.9, G10): the text's own words for the evidence.
                    design="" if c.get("design") is None else str(c.get("design")),
                    # ATTRIBUTION (1.9, N-i): what kind of causing the step is.
                    # ...and WHOSE: "intended" by the eater, or guided by the advertiser (James's
                    # verdict on Stone's stories, 29 Sep 2026): `{type, by}`, `by` an actor.
                    attribution=_attr(c.get("attribution"))[0], attribution_by=_attr(c.get("attribution"))[1],
                    supports=supports.get(title, 0), raw=c))
    return out


def constitutions(doc, appraisal):
    """Every constitutive relation asserted in the file (profile 1.11), one record per relation.

    NOT A STEP. "X (partly) constitutes Y" says what Y is made up of, not what brings it about: it is
    never walked, never composed with steps into a route, and never shaded by light and shadow. Hu
    (2023) turns on the difference -- acting on a feature that constitutes race is acting on race,
    acting on one merely caused by it is not (p. 16) -- and holds of one pair that it is related
    both ways at once ("do not only reflect and reinforce ... They ... partly form", p. 14). So the
    relation is carried by a claim, as a step is: it has a page, words and a fidelity, and a voice.
    Its `to` may be an ACTOR: a group or a system is what the ongoing states constitute (the process
    view's "things are stabilities of processes"). Cycles are allowed -- a whole shapes the parts
    that make it up -- which is why this is not `part_of`, a tree."""
    import argdown_provenance as prov
    out = []
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            d = _data(node)
            if "constitutes" not in d:
                continue
            tags = prov.node_tags(node)
            layer = ("appraisal" if title in appraisal
                     else "rival" if ("reported" in tags or "contested" in tags) else "text")
            raw = d["constitutes"]
            for c in (raw if isinstance(raw, list) else [raw]):
                c = c if isinstance(c, dict) else {}
                txt = lambda k: "" if c.get(k) is None else str(c.get(k))
                out.append(dict(title=title, layer=layer, src=c.get("from"), dst=c.get("to"),
                                extent=txt("extent"), whole=txt("whole"), basis=c.get("basis"),
                                under=txt("under"), stance=txt("stance"), raw=c))
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
    # Its actor's level -- or, since 1.12, each of its actors' levels, top first.
    who = _as_list(state.get("actor")) if isinstance(state, dict) else []
    lvs = {(actors.get(a) or {}).get("level") for a in who} - {None}
    return [lv for lv in levels if lv in lvs]


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
          ends=(), cycle=False, constituted=None):
    """Where a chain starts, what it reaches, its gaps and its routes: the walk the census makes of
    the whole text's chain, and -- since profile 1.5 -- of each of its chains, on the states that
    chain touches and the roles it gives them.

    `cycle` (profile 1.11): the chain is declared a cycle, so it is not asked where it starts or
    what it is for, and every state its loops pass through counts as reached. `constituted` maps a
    state to the wholes it constitutes, each a state or an actor ("actor:" + id)."""
    constituted = constituted or {}
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
    # A CYCLE HAS NO START: whatever its loops pass through, and all that leads on from there, is
    # reached (profile 1.11).
    if cycle:
        for comp in _systems(ids, text_edges):
            for v in comp:
                reached |= _reach(v, text_edges)
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
        # AND A STATE GOES ON AS WHAT IT CONSTITUTES (1.11): a group or a system its states make up,
        # or a whole that leads on or is what the chain is for.
        onward = onward or any(w.startswith("actor:") or w in outcomes or any(a == w for a, _ in text_edges)
                               for w in constituted.get(i, ()))
        # AND WHAT A CHAIN IS FOR IS NO DEAD END on the whole map: the badger follow-up's outcome,
        # an outcome only in its own chain, was reported as the chain stopping (gap tests, 27 Sep).
        # A MEASURE STOPS WHERE IT IS READ (1.9): nothing is expected to follow from an estimate.
        # A DEAD END THE TEXT SETS OUT (1.19) stops by design: Marti and Gond's symbolic use goes nowhere.
        if (i in used and i not in outcomes and i not in ends and not (states[i] or {}).get("appraisal")
                and not (states[i] or {}).get("measures") and (states[i] or {}).get("dead_end") is not True
                and not onward and not any(a == i for a, _ in text_edges)):
            gaps.append(dict(kind="dead-end", state=i,
                             message=f"`{i}` leads nowhere in the text: the chain stops there"))
    if has_block and not cycle and not interventions and not conditions:
        gaps.append(dict(kind="no-intervention", state=None,
                         message="no state has `role: intervention` or `role: condition`, so the "
                                 "chain has no stated cause to run from"))
    if has_block and not cycle and not outcomes:
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


def _cases_of(edge, steps, instances):
    """How many cases of a general step the map shows: the singular steps on the same pair of
    states, one per claim, and the steps that are cases of it by kind (profile 1.7's instances)."""
    same = {s["title"] for s in steps if s["scope"] == "singular" and (s["src"], s["dst"]) == edge}
    return len(same) + len({tuple(case) for gen, case in instances if tuple(gen) == edge})


def _chains(block):
    """The chains a mechanism block declares (profile 1.5), in declared order: {id: {label,
    question, roles}}, with anything malformed read as absent (declared() names it)."""
    raw = (block or {}).get("chains") if isinstance(block, dict) else None
    out = {}
    for cid, ch in (raw.items() if isinstance(raw, dict) else ()):
        ch = ch if isinstance(ch, dict) else {}
        roles = ch.get("roles") if isinstance(ch.get("roles"), dict) else {}
        # ITS FORM (1.11): its own where it declares one, the whole block's otherwise.
        own = ch.get("form") is not None
        form, settles, _ = form_of(ch if own else block)
        out[str(cid)] = dict(label=None if ch.get("label") is None else str(ch.get("label")),
                             question=None if ch.get("question") is None else str(ch.get("question")),
                             roles={str(k): v for k, v in roles.items()},
                             form=form, settles=settles,
                             # ITS GOAL (1.13), its own or the block's, and the CONTRAST its question sets:
                             # why this rather than what (Primer, pp. 94-95).
                             goal=_goal(ch) or _goal(block),
                             contrast=None if ch.get("contrast") is None else str(ch.get("contrast")),
                             # ITS ACCOUNT OF CAUSATION (1.14), its own or the block's.
                             account=_account_of(ch) or _account_of(block), own_account=bool(_account_of(ch)),
                             # ITS ORDER (1.17), its own or the block's.
                             order=_order(ch) or _order(block) or "time",
                             # KEPT APART BY THE TEXT (1.18): why this chain, or its pieces, join no other.
                             apart=_apart(ch),
                             # ITS BOUNDARY (1.19), its own or the block's: where the text says what
                             # it maps is open to what it does not.
                             boundary=_boundary(ch) or _boundary(block))
    return out


def _apart(block):
    """A block's or a chain's `apart:`, the reason the text keeps it apart, or None (1.18)."""
    a = block.get("apart") if isinstance(block, dict) else None
    return None if a is None or str(a).strip() == "" else str(a)


def _boundary(block):
    """A block's or a chain's `boundary:` (1.19): the text's own words drawing attention to where
    the system it maps stops -- that the boundary is a choice, or that what is outside acts on what
    is inside (Meadows's clouds). {says, pinpoint} or None; a bare string is what it says. Every
    system has a boundary, so this is set only where the text says so; the view then draws clouds
    at the open ends of its flows."""
    b = block.get("boundary") if isinstance(block, dict) else None
    if b is None:
        return None
    if not isinstance(b, dict):
        return None if str(b).strip() == "" else dict(says=str(b), pinpoint=None)
    g = lambda k: None if b.get(k) is None or str(b.get(k)).strip() == "" else str(b.get(k))
    return dict(says=g("says"), pinpoint=g("pinpoint"))


def _boundary_problems(b, where, tag):
    """The faults in one `boundary:` (1.19)."""
    raw = b.get("boundary") if isinstance(b, dict) else None
    if raw is None:
        return []
    out = []
    if isinstance(raw, dict):
        extra = sorted(set(map(str, raw)) - {"says", "pinpoint"})
        if extra:
            out.append(("!", f"{tag}`boundary:` takes `says` and `pinpoint`, not `{extra[0]}`", where))
    elif isinstance(raw, list):
        out.append(("!", f"{tag}`boundary:` is the text's words, or `{{says, pinpoint}}`", where))
        return out
    got = _boundary(b)
    if not got or not got["says"]:
        out.append(("!", f"{tag}`boundary:` says nothing: give the text's words", where))
    elif not got["pinpoint"]:
        out.append(("?", f"{tag}`boundary:` has no pinpoint: the words are the text's, so say where",
                    dict(where, fix="write it as `boundary: {says: \"...\", pinpoint: \"p. N\"}`")))
    return out


def _idiom(block):
    """The block's `idiom:` (1.18): what the map's states are told AS, in the text's words -- Wilson
    2023's flows, "a process by which inputs are transformed into outputs within a system". A
    definition of the kind of thing every state is, said once for the chart, never drawn as a state.
    {term, means, pinpoint} or None; a bare string is the term."""
    i = block.get("idiom") if isinstance(block, dict) else None
    if i is None:
        return None
    if not isinstance(i, dict):
        return dict(term=str(i), means=None, pinpoint=None)
    g = lambda k: None if i.get(k) is None else str(i.get(k))
    return dict(term=g("term"), means=g("means"), pinpoint=g("pinpoint"))


def _parts(states):
    """Each part and the whole the text groups it in (`part_of`), as a pair: a part meets its whole,
    for the pieces a picture falls into (1.18) -- Wilson's Trusted Research Environments are part of
    means-improvement, not a piece of their own."""
    return {(str(i), str(s.get("part_of"))) for i, s in states.items()
            if isinstance(s, dict) and s.get("part_of") is not None}


def _pieces(ids, links, kind_of=None):
    """The separate pieces a picture's states fall into (1.18): states joined by a step (a co-cause
    or blocker included) or by a kind they share. Each piece in declared order, the pieces in the
    order of their first state; [] where there is one piece or none. James's principle: mechanisms
    shown together meet at a state, and a piece that meets nothing is a question for the reading."""
    kind_of = kind_of or {}
    ids = list(ids)
    nb = {i: set() for i in ids}
    for a, b in links:
        if a in nb and b in nb and a != b:
            nb[a].add(b)
            nb[b].add(a)
    for i in ids:
        for j in ids:
            if i != j and kind_of.get(i) is not None and kind_of.get(i) == kind_of.get(j):
                nb[i].add(j)
    seen, out = set(), []
    for i in ids:
        if i in seen:
            continue
        comp, stack = set(), [i]
        while stack:
            x = stack.pop()
            if x in comp:
                continue
            comp.add(x)
            stack.extend(nb[x] - comp)
        seen |= comp
        out.append([j for j in ids if j in comp])
    return out if len(out) > 1 else []


def _account_of(block):
    return [a for a in _as_list((block or {}).get("account") if isinstance(block, dict) else None) if a in ACCOUNTS]


def _goal(block):
    g = (block or {}).get("goal") if isinstance(block, dict) else None
    return str(g) if g is not None and str(g) in GOALS else None


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

    if block is None and not all_steps and not constitutions(doc, appraisal):
        return findings, None
    if block is None and all_steps:
        findings.append(("!", "mechanism",
                         f"{len(all_steps)} step(s) are marked with `causes:` but the front "
                         f"matter declares no `mechanism:` block, so no state they name exists",
                         {"fix": "declare `mechanism:` with its levels, actors and states"}))
    for sev, msg, where in problems:
        findings.append((sev, "mechanism", msg, where))
    ordering, order_problems = level_order(block, levels)
    for sev, msg, where in order_problems:
        findings.append((sev, "mechanism", msg, where))
    form, settles, _ = form_of(block)

    # ---- what constitutes what (profile 1.11): never walked ---- #
    all_const = constitutions(doc, appraisal)
    if block is None and all_const:
        findings.append(("!", "mechanism", f"{len(all_const)} relation(s) are marked with `constitutes:` but "
                         f"the front matter declares no `mechanism:` block", {}))
    for c in all_const:
        where = {"title": c["title"]}
        for k, near in _unknown_keys(c["raw"], "constitutes"):
            findings.append(("!", "mechanism", f"`{k}` is not a key a constitutive relation can "
                             f"carry, so it is never read" + (f" -- did you mean `{near}`?" if near else ""),
                             where))
        if c["src"] is None:
            findings.append(("!", "mechanism", "a constitutive relation has no `from:`", where))
        elif c["src"] not in states:
            findings.append(("!", "mechanism", f"`constitutes: {{from: {c['src']}}}` is not a declared state", where))
        if c["dst"] is None:
            findings.append(("!", "mechanism", "a constitutive relation has no `to:`", where))
        elif c["dst"] not in states and c["dst"] not in actors:
            findings.append(("!", "mechanism", f"`constitutes: {{to: {c['dst']}}}` is neither a declared state "
                             f"nor a declared actor", where))
        elif c["dst"] == c["src"]:
            findings.append(("!", "mechanism", f"`{c['src']}` is said to constitute itself", where))
        if c["extent"] and c["extent"] not in EXTENTS:
            findings.append(("?", "mechanism", f"`extent: {c['extent']}` is not `partial` or `entire`", where))
        if c["whole"] and c["whole"] not in WHOLES:
            findings.append(("?", "mechanism", f"`whole: {c['whole']}` is not one of {', '.join(WHOLES)}", where))
        if c["basis"] is not None and c["basis"] not in CONSTITUTION_BASES:
            findings.append(("?", "mechanism", f"basis `{c['basis']}` is not one of "
                             f"{', '.join(CONSTITUTION_BASES)}", where))
        if c["stance"] and c["stance"] not in STANCES:
            findings.append(("!", "mechanism", f"`stance: {c['stance']}` is not one of {', '.join(STANCES)}", where))
        elif c["stance"] and c["layer"] != "rival":
            findings.append(("?", "mechanism", "`stance` says where the text stands on a view it reports, and "
                             "this claim is not tagged #reported or #contested", where))
        for end in ("src", "dst"):
            if c["layer"] != "appraisal" and c[end] in states and (states[c[end]] or {}).get("appraisal"):
                findings.append(("!", "mechanism", f"a relation the text asserts runs through `{c[end]}`, "
                                 f"which is declared as the appraisal's own state", where))
    const_ok = [c for c in all_const if c["src"] in states and (c["dst"] in states or c["dst"] in actors)
                and c["dst"] != c["src"]]
    constituted = {}
    for c in const_ok:
        if c["layer"] == "text":
            w = c["dst"] if c["dst"] in states else "actor:" + str(c["dst"])
            constituted.setdefault(c["src"], [])
            if w not in constituted[c["src"]]:
                constituted[c["src"]].append(w)

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
        for m in s["modifies"]:
            if not m["by"] or m["by"] not in states:
                findings.append(("!", "mechanism", f"`modifies: {{by: {m['by'] or '?'}}}` is not a "
                                 f"declared state", {"title": s["title"],
                                                     "fix": "name the moderating state in `by`"}))
            elif m["by"] in (s["src"], s["dst"]):
                findings.append(("?", "mechanism", f"`modifies: {{by: {m['by']}}}` names the step's "
                                 f"own `from` or `to`", {"title": s["title"]}))
            if m["effect"] not in EFFECTS:
                findings.append(("?", "mechanism", f"`effect: {m['effect'] or '(none)'}` is not one of "
                                 f"strengthens, weakens, reverses or \"0\" (does not moderate)",
                                 {"title": s["title"]}))
        for key in ("necessary", "sufficient"):
            if s[key] is not None and not isinstance(s[key], bool):
                findings.append(("!", "mechanism", f"`{key}:` is `true` or `false`, not "
                                 f"`{s[key]}`", {"title": s["title"]}))
        if s["necessary"] is True and s["sign"] in ("-", "0"):
            findings.append(("?", "mechanism", f"a step marked `necessary` says {s['dst']} holds only "
                             f"where {s['src']} does, which a `{s['sign']}` step contradicts",
                             {"title": s["title"]}))
        if s["sufficient"] is True and s["sign"] == "0":
            findings.append(("?", "mechanism", "a finding of no effect cannot be `sufficient`",
                             {"title": s["title"]}))
        for mb in s["measured_by"]:
            if mb not in states:
                findings.append(("!", "mechanism", f"`measured_by: {mb}` is not a declared state",
                                 {"title": s["title"]}))
            elif not (states[mb] or {}).get("measures"):
                findings.append(("?", "mechanism", f"`measured_by: {mb}` names a state that `measures` "
                                 f"nothing", {"title": s["title"],
                                              "fix": f"give `{mb}` a `measures:` naming what it measures"}))
        if s["attribution_by"] and s["attribution_by"] not in actors:
            findings.append(("!", "mechanism", f"`attribution: {{by: {s['attribution_by']}}}` is not a "
                             f"declared actor", {"title": s["title"]}))
        if s["attribution"] and s["attribution"] not in ATTRIBUTIONS:
            findings.append(("?", "mechanism", f"`attribution: {s['attribution']}` is not one of "
                             f"{', '.join(ATTRIBUTIONS)}", {"title": s["title"]}))
        if s["stance"] == "endorsed":
            findings.append(("?", "mechanism", "a report the text endorses is a claim in its own voice, "
                             "not a stance on someone else's", {"title": s["title"],
                             "fix": "drop #reported and `stance`, and mark the step `hedged: true` if "
                                    "the reporting works as a hedge"}))
        elif s["stance"] and s["stance"] not in STANCES:
            findings.append(("!", "mechanism", f"`stance: {s['stance']}` is not one of "
                             f"{', '.join(STANCES)}", {"title": s["title"]}))
        elif s["stance"] and not s["reported"]:
            findings.append(("?", "mechanism", "`stance` says where the text stands on a view it "
                             "reports, and this claim is not tagged #reported or #contested",
                             {"title": s["title"]}))
        if s["design"] == "illustration" and s["basis"] in ("study", "statistics", "model"):
            findings.append(("?", "mechanism", f"`design: illustration` is a hypothetical case, and "
                             f"`basis: {s['basis']}` says the text tested the step", {"title": s["title"]}))
        if s["channel"] and s["channel"] not in (block.get("channels") or {} if isinstance(block, dict) else {}):
            findings.append(("!", "mechanism", f"`channel: {s['channel']}` is not declared under `channels:`",
                             {"title": s["title"], "fix": f"declare it: `channels: {{{s['channel']}: {{label: \"...\"}}}}`"}))
        if s["shape"] and s["shape"] not in SHAPES:
            findings.append(("!", "mechanism", f"`shape: {s['shape']}` is not one of {', '.join(SHAPES)}", {"title": s["title"]}))
        elif s["shape"] and s["sign"] in ("+", "-", "0"):
            findings.append(("!", "mechanism", f"`shape: {s['shape']}` says the step rises and falls, and `sign: {s['sign']}` "
                             f"gives it one direction", {"title": s["title"], "fix": "leave the sign out, or give `sign: which`"}))
        if s["net"] is not None and not isinstance(s["net"], bool):
            findings.append(("!", "mechanism", f"`net:` is `true` or `false`, not `{s['net']}`", {"title": s["title"]}))
        elif s["net"] and s["on"] != "stock":
            findings.append(("!", "mechanism", "`net: true` is a flow that runs whichever way the gap points, "
                             "and the step does not flow into a stock", {"title": s["title"], "fix": "add `on: stock`"}))
        if len(s["mark"]) > 6:
            findings.append(("?", "mechanism", f"`mark: {s['mark']}` is drawn in a small circle on the arrow: "
                             f"six characters at most", {"title": s["title"], "fix": "put the words in `name:`"}))
        if s["on"] not in ONS:
            findings.append(("!", "mechanism", f"`on: {s['on']}` is not one of {', '.join(ONS)}",
                             {"title": s["title"]}))
        elif s["on"] == "character" and s["sign"] in ("+", "-", "0"):
            findings.append(("?", "mechanism", f"`on: character` says the step changes what kind of thing "
                             f"{s['dst']} is, not how much of it there is, and `sign: {s['sign']}` says how much",
                             {"title": s["title"], "fix": "give it `sign: which`"}))
        elif s["on"] in ("being", "persistence", "possibility", "chance", "stock") and s["sign"] == "which":
            findings.append(("?", "mechanism", f"`on: {s['on']}` takes `+` ({ {'being': 'makes', 'persistence': 'maintains', 'possibility': 'opens', 'chance': 'makes likelier', 'stock': 'flows into'}[s['on']] }) "
                             f"or `-` ({ {'being': 'unmakes', 'persistence': 'erodes', 'possibility': 'closes', 'chance': 'makes less likely', 'stock': 'flows out of'}[s['on']] }), not `which`",
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
                             f"shaded as asserted" + (
                                 # `argued` IS THE CENSUS'S WORD (trial, 1 Oct 2026, twice): a step
                                 # counts as argued when its claim has supports, which the census
                                 # works out; the map says only what the text offers.
                                 ". `argued` is the census's tier for a step whose claim has "
                                 "support in the map, worked out from the map: write what the text "
                                 "offers (`asserted` if it offers nothing more)"
                                 if s["basis"] == "argued" else ""),
                             {"title": s["title"]}))
        for k, near in s.get("unknown") or []:
            findings.append(("!", "mechanism",
                             f"`{k}` is not a key a step can carry, so it is never read"
                             + (f" -- did you mean `{near}`?" if near else
                                (" -- a note goes on the claim, beside `fidelity:`, not inside "
                                 "`causes:`" if k == "note" else "")),
                             {"title": s["title"]}))
        if s["sign"] not in (None,) + SIGNS:
            findings.append(("?", "mechanism",
                             f"sign `{s['sign']}` is not `+`, `-`, `0` (no effect) or `which` "
                             f"(decides which)", {"title": s["title"]}))
        if s["null"] and NOT_ENOUGH.search(s["text"] or ""):
            findings.append(("?", "mechanism", f"a finding of no effect ({s['src']} -> {s['dst']}), in words that "
                             f"limit an effect rather than deny it (\"{NOT_ENOUGH.search(s['text']).group(0)}\")",
                             {"title": s["title"],
                              "fix": "if the text says the cause is not enough on its own, mark it with its sign "
                                     "and `sufficient: false`; keep `\"0\"` only for a finding of no effect"}))
        if s["null"] and s["selects"]:
            findings.append(("?", "mechanism",
                             "a step cannot be both a null finding and a selection link",
                             {"title": s["title"]}))
        if s["assoc"] and (s["selects"] or s["null"]):
            findings.append(("?", "mechanism", "an association is neither a selection link nor a finding of no "
                             "effect: keep one", {"title": s["title"]}))
        if s["scope"] and s["scope"] not in SCOPES:
            findings.append(("?", "mechanism", f"`scope: {s['scope']}` is not `singular` or `general`",
                             {"title": s["title"]}))
        # "ASSOCIATED WITH" IS NOT "CAUSES" (1.13). A step whose own words report an association, and
        # which is not marked as one, may say more than the text does.
        m_ = ASSOCIATED.search(s["text"] or "")
        if m_ and not s["assoc"] and not s["null"] and not s["selects"]:
            findings.append(("?", "mechanism", f"{s['src']} -> {s['dst']} is a causal step, in words that report an "
                             f"association (\"{m_.group(0)}\")", {"title": s["title"],
                             "fix": "if the text reports only that the two go together, mark `association: true`; "
                                    "keep the step if the text says one brings the other about"}))
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
    causal = [s for s in ok if not s["null"] and not s["selects"] and not s["assoc"]]
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
    # A MODERATOR IS LINKED BY WHAT IT MODERATES (1.9): Marti and Gond's boundary conditions have
    # no step of their own, and are not stranded for that.
    null_from |= {m["by"] for s in text_all for m in s["modifies"] if m["by"] in states}
    rival_edges = {(s["src"], s["dst"]) for s in causal if s["layer"] == "rival"}
    chain_ends = {i for ch in chains.values() for i, r in ch["roles"].items() if "outcome" in _as_list(r)}
    W = _walk(ids, states, text_edges, block is not None, sign_of, regime_of, null_from, rival_edges, chain_ends,
              cycle=form == "cycle", constituted=constituted)
    entries, gaps, used = W["entries"], W["gaps"], W["used"]
    # WHERE THE CHAIN STOPS AND THE ARGUMENT TAKES IT ON (1.15). A state the chain leads nowhere
    # from is a gap in the mechanism -- unless a claim stating the step into it is itself a reason
    # in the argument: a premise, a carried conclusion, or the source of a relation. Then the text
    # does go on, by argument rather than by cause (the parallel-pass trial: Wilson's inquisition,
    # breakdown and centralisation were all of this kind). Reported apart, never as a gap to close.
    reasons = {a for a, b, k in prov.title_edges(prov.without_appraisal(doc))}
    gap_states = {g["state"] for g in gaps}
    taken_up = sorted({(s["dst"], s["title"]) for s in text_all if s["dst"] in gap_states and s["title"] in reasons})
    handed = {st for st, _ in taken_up}
    # A SKETCH HAS GAPS BY DESIGN (1.17): its states are named and its steps marked only where the
    # argument relies on them, so a state with no step is the sketch's choice, not the text's.
    sketch = depth_of(block)[0] == "sketch"
    for g in gaps:
        if g["state"] in handed or sketch:
            continue
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
                                                [s for s in causal if s["layer"] == "rival"], null_from,
                                                constituted)
    sign_pool = _signs(pool_all, states)

    spans = {lv for i in used for lv in levels_of(states[i], actors, levels)}
    profile = dict(
        question=(block or {}).get("question"),
        levels=levels, levels_spanned=[lv for lv in levels if lv in spans],
        # WHAT THE LEVELS ARE (1.10): the kind of ordering, where the text says so, and the tree.
        ordering=ordering,
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
        tiers=tiers, gaps=[g["message"] for g in gaps], taken_up=[list(t) for t in taken_up],
        rival_steps=sum(1 for s in ok if s["layer"] == "rival"),
        null_steps=_nulls(text_all, ok, text_edges, ids),
        selection_steps=sorted({(s["src"], s["dst"]) for s in text_all if s["selects"]}),
        hedged=sum(1 for s in text_all if s["hedged"]),
        appraisal_claims=len(appraisal),
        appraisal_steps=sum(1 for s in ok if s["layer"] == "appraisal"),
        with_how=sum(1 for s in text if isinstance(s["how"], dict)),
        with_given=sum(1 for s in text if s["given"]),
        chains=chain_profiles, unchained=unchained,
        # ONE PICTURE IN PIECES (1.18), where the map declares no chains: its states joined by a step
        # or a kind. With chains, each chain says its own pieces, and islands among them.
        pieces=[] if chains else _pieces([i for i in ids if roles_of(states[i]) or any(i in e for e in text_edges)],
                                         text_edges | _parts(states), kind_of),
        apart=_apart(block), idiom=_idiom(block), boundary=_boundary(block),
        kinds=kinds, akin_steps=akin_steps, instances=instances,
        moderated=sorted({(s["src"], s["dst"], s["sign"] or "", m["by"], m["effect"], m["period"])
                          for s in text_all for m in s["modifies"] if m["by"] in states}),
        necessary=sorted({(s["src"], s["dst"], s["sign"] or "") for s in text_all if s["necessary"] is True}),
        sufficient=sorted({(s["src"], s["dst"], s["sign"] or "", tuple(s["jointly"]), s["sufficient"])
                           for s in text_all if isinstance(s["sufficient"], bool)}),
        designs=sorted([d, n] for d, n in _count(s["design"] for s in text_all if s["design"]).items()),
        measures=sorted([i, str(st["measures"]), str(st.get("method") or "")] for i, st in states.items()
                        if isinstance(st, dict) and st.get("measures") in states and st.get("measures") != i),
        attributions=sorted({(s["src"], s["dst"], s["sign"] or "", s["attribution"], s["attribution_by"], s["layer"], s["title"])
                             for s in ok if s["attribution"]}),
        stances=sorted([k, n] for k, n in _count(s["stance"] for s in ok if s["reported"] and s["stance"]).items()),
        accounts=_accounts(ids, ok),
        disputed=_disputed(ok, prov.title_edges(prov.without_appraisal(doc))),
        rests_on=[[a, b, sg, mb, list(bias)] for a, b, sg, mb, bias in sorted({
            (s["src"], s["dst"], s["sign"] or "", mb,
             # a step from the measured state into its measure is the measure working, not a bias
             tuple(sorted({r["src"] for r in ok if r["dst"] == mb and not r["null"] and not r["selects"] and not r["assoc"]
                           and r["src"] != (states.get(mb) or {}).get("measures")})))
            for s in text_all for mb in s["measured_by"] if mb in states})],
        # PROCESS, FORMATION AND CONSTITUTION (profile 1.11).
        form=dict(form=form, settles=settles),
        aspects=sorted([a, n] for a, n in _count(str(st.get("aspect")) for st in states.values()
                                                 if isinstance(st, dict) and str(st.get("aspect")) in ASPECTS).items()),
        formation=sorted({(s["src"], s["dst"], s["sign"] or "", s["on"]) for s in text_all if s["on"] in FORMATION}),
        constitution=sorted({(c["src"], c["dst"], c["extent"], c["whole"], c["under"], c["layer"], c["title"])
                             for c in const_ok}),
        # CAUSED AND CONSTITUTED AT ONCE, in the text's own voice (Hu p. 14: policing does "not only
        # reflect and reinforce" racial injustice but "partly form[s]" the category).
        both=sorted({(c["src"], c["dst"]) for c in const_ok if c["layer"] == "text"
                     and (c["src"], c["dst"]) in {(s["src"], s["dst"]) for s in text}}),
        # TWO READINGS OF ONE PAIR in different voices: causal in a view the text reports, constitutive
        # in its own, or the other way round (Hu p. 8; p. 22's orthodox and thick accounts of class).
        readings=sorted({(c["src"], c["dst"], s["layer"], c["layer"]) for c in const_ok for s in causal
                         if (s["src"], s["dst"]) == (c["src"], c["dst"]) and s["layer"] != c["layer"]
                         and "appraisal" not in (s["layer"], c["layer"])}),
        # WHAT IS NOT (YET) ACTUAL (1.12), and WHAT MAKES EACH OTHER UP.
        statuses=sorted([i, str(st.get("status"))] for i, st in states.items()
                        if isinstance(st, dict) and str(st.get("status")) in ("possible", "open")),
        mutual=sorted({tuple(sorted((c["src"], c["dst"]))) for c in const_ok if c["layer"] == "text"
                       and any(d["layer"] == "text" and (d["src"], d["dst"]) == (c["dst"], c["src"]) for d in const_ok)}),
        # A LOOP THAT KEEPS ITSELF IN BEING (1.12): every hop a step that makes or maintains its next --
        # Wimmer's "stabilizing" feedbacks, the entanglements that "keep a given cut in place" (Hertz et
        # al. 2025), Bickhard's recursive self-maintenance.
        sustaining=[l for l in loops_text if _sustains(l, text)],
        # CAUSAL REASONING (1.13, after Johansson et al. 2024).
        goal=_goal(block), contrast=None if (block or {}).get("contrast") is None else str(block.get("contrast")),
        account=_account_of(block),
        # A CHANGE IN CHANCE, AND A FLOW INTO A STOCK (1.14): neither says the `to` moves with the `from`.
        chances=sorted({(s["src"], s["dst"], s["sign"] or "") for s in text_all if s["on"] == "chance"}),
        stocks=sorted({(s["src"], s["dst"], s["sign"] or "") for s in text_all if s["on"] == "stock"}),
        # A LOOP THROUGH A STOCK: its polarity counts flows, not co-movement (Banitz et al. 2022).
        stock_loops=[l for l in loops_text if any(s["on"] == "stock" and (s["src"], s["dst"]) in set(zip(l, l[1:] + l[:1]))
                                                  for s in text)],
        # FOUND IN A CASE, CLAIMED IN GENERAL: a derived claim, extrapolated from the case (Martinez-Pena et
        # al. 2023, "Analysis of causal argumentation in social-ecological systems research").
        extrapolated=sorted({(s["src"], s["dst"]) for s in text_all if s["scope"] == "general"}
                            & {(s["src"], s["dst"]) for s in text_all if s["scope"] == "singular"}),
        associations=sorted({(s["src"], s["dst"], s["sign"] or "", s["layer"]) for s in ok if s["assoc"]
                             and s["layer"] != "appraisal"}),
        # REICHENBACH'S THIRD POSSIBILITY: a state the text's own steps lead from into both ends of an
        # association is a common cause, drawn -- the association may be its work (Primer, pp. 82-83).
        common_causes=sorted([a, b, sorted({z for z in ids if (z, a) in text_edges and (z, b) in text_edges})]
                             for a, b in {(s["src"], s["dst"]) for s in ok if s["assoc"] and s["layer"] != "appraisal"}
                             if any((z, a) in text_edges and (z, b) in text_edges for z in ids)),
        scopes=sorted([k, n] for k, n in _count(s["scope"] for s in text_all if s["scope"] in SCOPES).items()),
        # A GENERAL CLAIM FROM ONE CASE: "causal relations cannot be inferred only from singular case
        # studies" without background knowledge (Primer, p. 46).
        # ...BUT ONLY WHERE THE MAP SHOWS ONE CASE AT MOST. A general step drawn by a "From cases"
        # bridge from the soldiers', the priest's and the king's cases (Sewell 1992, p. 11) is backed
        # by three, each a step of its own: a singular step on the same pair, or a case of it by kind.
        one_case=sorted({(s["src"], s["dst"], s["title"]) for s in text_all if s["scope"] == "general"
                         and (s["basis"] == "example" or s["design"] in ("case study", "anecdote"))
                         and _cases_of((s["src"], s["dst"]), text_all, instances) <= 1}),
    )
    # THE ACCOUNT THE TEXT REASONS WITH (1.14), held against what the map shows it doing.
    # A chain that declares its own account is held to its own steps.
    for who, acc, mine, where in [("", profile["account"], text_all, {})] + [
            (f"chain `{cid}`: ", ch["account"], [s for s in text_all if cid in s["chain"]], {"chain": cid})
            for cid, ch in chains.items() if ch.get("own_account")]:
        if "manipulability" in acc and not any(s["design"] in EXPERIMENTAL for s in mine):
            findings.append(("?", "mechanism", f"{who}`account: manipulability`, and no step's evidence is an "
                             "experiment, a quasi-experiment or a natural experiment (`design:`)", where))
        if "intra-action" in acc and not const_ok:
            findings.append(("?", "mechanism", f"{who}`account: intra-action`, and nothing is said to constitute "
                             "anything (`constitutes:`): relations that make what they relate are constitutive", where))
    if profile["goal"] == "intervene" and not W["interventions"]:
        findings.append(("?", "mechanism", "`goal: intervene`, and no state has `role: intervention`: what does the "
                         "text say to do?", {}))
    if profile["goal"] == "attribute" and not any(s["attribution"] for s in ok):
        findings.append(("?", "mechanism", "`goal: attribute`, and no step says what kind of causing it attributes "
                         "(`attribution:`)", {}))
    for cp in chain_profiles:
        if not cp["steps"] and depth_of(block)[0] != "sketch":
            findings.append(("?", "mechanism", f"chain `{cp['id']}` is declared but no step of the "
                             f"text's own is marked `chain: {cp['id']}`", {"chain": cp["id"]}))
    # BRIDGES (1.15): a named causal scheme with no step among its premises bridges nothing.
    step_titles = {s["title"] for s in all_steps} | {c["title"] for c in constitutions(doc, appraisal)}
    for arg, step, scheme, inputs, with_steps in bridges_of(doc, step_titles):
        if not with_steps:
            findings.append(("?", "mechanism", f"<{arg}> step {step} names the bridge `{scheme}`, and none of its "
                             f"premises states a step: a bridge carries the mechanism into the argument", {"title": arg}))
    profile_bridges = sorted([arg, step, scheme, len(inputs), len(with_steps)] for arg, step, scheme, inputs, with_steps
                             in bridges_of(doc, step_titles))
    # THERE AND HERE (1.17): a "From there to here" bridge carries a conclusion from one setting to
    # another because the mechanism is shared. Its first question -- is the mechanism of action present
    # here? -- the census can ask of the map: the premises' steps, grouped by the setting each holds in
    # (`regime:`), and those with no counterpart in another setting. Frick's vaccine case and the world
    # it is meant to bear on: the herd-immunity loop is a step of one and not the other.
    transfers = []
    for arg, step, scheme, inputs, _w in bridges_of(doc, step_titles):
        if scheme != "From there to here":
            continue
        by = {}
        for st in all_steps:
            if st["title"] in inputs and st["src"] in states and st["dst"] in states:
                by.setdefault(st["regime"], set()).add((str(st["src"]), str(st["dst"]), st["sign"] or ""))
        regimes = sorted(by)
        unmatched = []
        if len(regimes) >= 2:
            for r in regimes:
                others = set().union(*(by[o] for o in regimes if o != r))
                unmatched += [[r, a, b, sg] for a, b, sg in sorted(by[r]) if (a, b, sg) not in others]
        transfers.append([arg, step, regimes, sorted(unmatched)])
    if profile is not None:
        _d, _why = depth_of(block)
        profile = {**profile, "bridges": profile_bridges, "depth": _d, "depth_reason": _why,
                   "transfers": sorted(transfers)}
        # WHAT THE MAP SAYS TO EACH BRIDGE'S QUESTIONS (10 Oct 2026): see bridge_questions.
        profile["bridge_questions"] = [
            [arg, step, scheme, bridge_questions(ok, states, block, sorted(transfers), arg, step, scheme, inputs)]
            for arg, step, scheme, inputs, _w in bridges_of(doc, step_titles)]
    return findings, profile


_TIER_SAID = {"evidence": "tested", "argued": "argued for", "asserted": "asserted",
              "imputed": "imputed by the reconstructor"}


def _formation_word(on, sign):
    """The chart's one-word verb for a step that makes, keeps, changes in kind, changes a chance, or
    flows -- argdown-mechanism.js's formationWord."""
    if on == "character":
        return "transforms"
    words = {"possibility": ("opens up", "closes off"), "being": ("makes", "unmakes"),
             "persistence": ("maintains", "erodes"), "chance": ("makes likelier", "makes less likely"),
             "stock": ("flows into", "flows out of")}
    if on in words and sign in ("+", "-"):
        return words[on][0 if sign == "+" else 1]
    return None


def step_verb(s):
    """The verb the chart draws a step with -- argdown-mechanism.js's verbOf, word for word."""
    if s["null"]:
        return "no effect"
    if s["selects"]:
        return "selection effect"
    if s["assoc"]:
        return "associated"
    if s["shape"] == "peak":
        return "rises, then falls"
    if s["shape"] == "trough":
        return "falls, then rises"
    if s["net"] is True:
        return "net flow"
    sign = s["sign"] or ""
    if sign and _formation_word(s["on"], sign):
        return _formation_word(s["on"], sign)
    if s["on"] == "trend" and sign in ("+", "-"):
        return "speeds" if sign == "+" else "slows"
    if s["necessary"] is True and s["sufficient"] is True:
        return "needed and enough for"
    if s["necessary"] is True:
        return "needed for"
    if s["sufficient"] is True:
        return "enough for"
    return {"": "link", "+": "raises", "-": "lowers", "0": "no effect", "which": "decides which"}.get(sign, sign)


def _uniq(xs):
    out = []
    for x in xs:
        if x is not None and x not in out:
            out.append(x)
    return out


def bridge_questions(ok, states, block, transfers, arg, step, scheme, inputs):
    """WHAT THE MAP SAYS TO A BRIDGE'S QUESTIONS (10 Oct 2026; NOTES-integration.md, Proposal A).

    Each scheme's question names in `asks` what in the map bears on it -- a blocker, a rival account,
    another route -- and this reads it off the map for one bridge: [question, asks, status, said],
    status `recorded` (the map records something on it), `none` (the map records nothing: the text
    may be silent, or the map may have missed it) or `reader` (only a reader can answer). It
    REPORTS; it does not judge whether the move succeeds. argdown-mechanism.js's bridgeQuestions
    gives the same answers, and test_mechanism_view.mjs holds the two together."""
    sch = BRIDGES.get(str(scheme).lower())
    if not sch:
        return []
    want = set(inputs)
    P = [s for s in ok if s["title"] in want]
    TX = [s for s in ok if s["layer"] == "text" and not s["null"] and not s["selects"] and not s["assoc"]]
    blk = block if isinstance(block, dict) else {}
    lab = lambda v: "\u201c" + str((states.get(v) if isinstance(states.get(v), dict) else {}).get("label") or v) + "\u201d"
    froms, tos = _uniq([s["src"] for s in P]), _uniq([s["dst"] for s in P])

    def said(x):
        v = step_verb(x)
        return lab(x["src"]) + (" \u2192 " + lab(x["dst"]) + ": " + v if v in ("no effect", "selection effect", "associated")
                                else " " + v + " " + lab(x["dst"]))

    def is_outcome(v):
        return "outcome" in roles_of(states.get(v))

    def onward(keep):
        return _uniq([said(y) for y in TX if y["title"] not in want and y["src"] in froms and y["dst"] not in tos and keep(y["dst"])])

    def given_on(x):
        return [g for g in x["given_raw"] if isinstance(g, dict) and str(g.get("state")) in states]

    def backing():
        out = []
        for t in TIERS:
            xs = [x for x in P if x["tier"] == t]
            if xs:
                bases = _uniq([x["basis"] for x in xs if x["basis"]])
                out.append(f"{_TIER_SAID.get(t, t)}: {len(xs)}" + (f" ({', '.join(bases)})" if bases and t == "evidence" else ""))
        return out

    def counter():
        out = []
        for x in P:
            out += [said(x) + " unless " + lab(u) for u in x["unless"]]
            out += [said(x) + " despite " + lab(u) for u in x["despite"]]
            if x["regime"]:
                out.append(said(x) + ", regime: " + x["regime"])
            if x["threshold"]:
                out.append(said(x) + " past a threshold: " + x["threshold"])
        for y in ok:
            if y["title"] in want or y["dst"] not in tos:
                continue
            if y["layer"] == "rival":
                out.append("a view the text reports: " + said(y))
            elif y["layer"] == "text" and y["src"] not in froms and any(
                    x["dst"] == y["dst"] and x["sign"] and y["sign"] and {x["sign"], y["sign"]} == {"+", "-"} for x in P):
                out.append(said(y))
        return _uniq(out)

    def rivals():
        return _uniq([said(y) + (f" ({y['stance']})" if y["stance"] else "") for y in ok
                      if y["layer"] == "rival" and (y["dst"] in tos or y["dst"] in froms)])

    def stops():
        if not P:
            return []
        seen, ends, queue = set(), [], list(tos)
        while queue:
            v = queue.pop(0)
            if v in seen:
                continue
            seen.add(v)
            on = [x for x in TX if x["src"] == v and x["dst"] != v]
            if not on:
                ends.append(v)
            queue += [x["dst"] for x in on if x["dst"] not in seen]
        return ([f"the chain goes on to {', '.join(lab(v) for v in ends)}, and stops there"] if ends
                else ["the chain closes on itself: every state it reaches leads on"])

    def common():
        out = []
        for x in P:
            for c in states:
                if c in (x["src"], x["dst"]):
                    continue
                if any(y["src"] == c and y["dst"] == x["src"] for y in TX) and any(y["src"] == c and y["dst"] == x["dst"] for y in TX):
                    out.append(f"{lab(c)} leads to both {lab(x['src'])} and {lab(x['dst'])}")
        return _uniq(out)

    def reverse():
        out = []
        for x in P:
            back = next((y for y in ok if y["src"] == x["dst"] and y["dst"] == x["src"]), None)
            if back:
                out.append(said(back) + " as well")
        return _uniq(out)

    def mediated():
        out = []
        for x in P:
            if x["via"]:
                out.append(said(x) + " through " + " \u2192 ".join(lab(v) for v in x["via"]))
            if x["regime"]:
                out.append(said(x) + ", regime: " + x["regime"])
            if x["threshold"]:
                out.append(said(x) + " past a threshold: " + x["threshold"])
            if x["period"]:
                out.append(said(x) + ": " + x["period"])
            if x["scope"]:
                out.append(said(x) + ": " + ("a single case" if x["scope"] == "singular" else "a general relation"))
        return _uniq(out)

    def measure():
        return _uniq([said(x) + ", read from " + ", ".join(lab(v) for v in x["measured_by"]) for x in P if x["measured_by"]])

    raw_kinds = blk.get("kinds") if isinstance(blk.get("kinds"), dict) else {}

    def kinds():
        out = []
        for v in froms + tos:
            k = (states.get(v) if isinstance(states.get(v), dict) else {}).get("kind")
            if k is None:
                continue
            kd = next((dict(label=(x or {}).get("label") if isinstance(x, dict) else None,
                            general=None if not isinstance(x, dict) or x.get("general") is None else str(x.get("general")))
                       for kid, x in raw_kinds.items() if str(kid) == str(k)), None)
            name = (kd and kd["label"]) or k
            tail = (f", whose general claim is {lab(kd['general'])}" if kd and kd["general"] and kd["general"] != v
                    else ", its general claim" if kd and kd["general"] == v else "")
            out.append(f"{lab(v)} is of the kind \u201c{name}\u201d{tail}")
        return _uniq(out)

    def howmany():
        if not P:
            return []
        settings = _uniq([x["regime"] for x in P if x["regime"]])
        ks = _uniq([str((states.get(v) if isinstance(states.get(v), dict) else {}).get("kind"))
                    for v in froms + tos if (states.get(v) if isinstance(states.get(v), dict) else {}).get("kind") is not None])
        return [f"{len(P)} step{'' if len(P) == 1 else 's'}"
                + (f", in {len(settings)} setting{'' if len(settings) == 1 else 's'}: {'; '.join(settings)}" if settings else "")
                + (f", across {len(ks)} kind{'' if len(ks) == 1 else 's'}" if ks else "")]

    def onecase():
        return [said(x) + " is about a single case" for x in P if x["scope"] == "singular"]

    def here():
        t = next((r for r in transfers if r[0] == arg and r[1] == step), None)
        if not t or len(t[2]) < 2:
            return []
        if t[3]:
            return ["only " + (f"under \u201c{u[0]}\u201d" if u[0] else "where no setting is named")
                    + f": {lab(u[1])} \u2192 {lab(u[2])}" + (f" ({u[3]})" if u[3] else "") for u in t[3]]
        return [f"each step has its counterpart in every setting the premises name ({'; '.join(t[2])})"]

    def support():
        out = []
        for x in P:
            if x["jointly"]:
                out.append(said(x) + " only together with " + ", ".join(lab(v) for v in x["jointly"]))
            gon = given_on(x)
            for g in gon:
                out.append(said(x) + " given " + lab(str(g.get("state"))) + (f" = {g['value']}" if g.get("value") not in (None, "") else ""))
            texts = {_cond(g) for g in gon}
            out += [said(x) + " given " + g for g in x["given"] if g not in texts]
        return _uniq(out)

    def blockers():
        out = []
        for y in ok:
            if y["title"] in want or (y["layer"] == "text" and y["src"] in froms):
                out += [said(y) + " unless " + lab(u) for u in y["unless"]]
        return _uniq(out)

    def possible():
        out = []
        for v in froms + tos:
            st = (states.get(v) if isinstance(states.get(v), dict) else {}).get("status")
            if st in ("possible", "open"):
                out.append(lab(v) + (" cannot be specified in advance, the text says" if st == "open" else " is a possibility the text sets out"))
        return _uniq(out)

    def scope():
        out = []
        for x in P:
            if x["scope"]:
                out.append(said(x) + ": " + ("a single case" if x["scope"] == "singular" else "a general relation"))
            if x["regime"]:
                out.append(said(x) + ", regime: " + x["regime"])
            if x["period"]:
                out.append(said(x) + ": " + x["period"])
            out += [said(x) + " given " + g for g in x["given"]]
        return _uniq(out)

    def order():
        ids = _uniq([c for x in P for c in x["chain"]])
        cs = [(cid, c) for cid, c in _chains(block).items() if cid in ids and c["order"] == "explanation"]
        if cs:
            return [f"the chain \u201c{c['label'] or cid}\u201d runs in order of explanation, not of time" for cid, c in cs]
        return ["the map's chains run in order of explanation, not of time"] if (_order(block) or "time") == "explanation" else []

    probes = dict(backing=backing, counter=counter, rivals=rivals, stops=stops, common=common, reverse=reverse,
                  mediated=mediated, measure=measure, kinds=kinds, howmany=howmany, onecase=onecase, here=here,
                  support=support, blockers=blockers, possible=possible, scope=scope, order=order,
                  route=lambda: ["; ".join(_uniq([said(x) for x in P]))] if P else [],
                  otherroutes=lambda: _uniq([said(y) for y in TX if y["title"] not in want and y["dst"] in tos and y["src"] not in froms]),
                  elsewhere=lambda: onward(lambda v: True), goals=lambda: onward(is_outcome),
                  sideeffects=lambda: onward(lambda v: not is_outcome(v)))
    out = []
    for i, q in enumerate(sch["questions"]):
        asks = (sch.get("asks") or [None] * len(sch["questions"]))[i]
        if not asks or asks not in probes:
            out.append([q, None, "reader", []])
            continue
        got = probes[asks]()
        out.append([q, asks, "recorded" if got else "none", got])
    return out


def _sustains(loop, steps_):
    """Whether every hop of `loop` is a step of `steps_` that makes or maintains its next (+)."""
    hops = list(zip(loop, loop[1:] + loop[:1]))
    return all(any(s["src"] == a and s["dst"] == b and s["on"] in ("being", "persistence") and s["sign"] == "+"
                   for s in steps_) for a, b in hops)


def _attr(a):
    """(type, by) from `attribution:`, a type or `{type, by}`."""
    if isinstance(a, dict):
        return ("" if a.get("type") is None else str(a.get("type")),
                "" if a.get("by") is None else str(a.get("by")))
    return ("" if a is None else str(a), "")


def _count(xs):
    out = {}
    for x in xs:
        out[x] = out.get(x, 0) + 1
    return out


def _disputed(ok, edges):
    """[from, to, [title, title]] for each pair of steps on one pair of states whose claims the
    argument sets against each other (`><` or an attack): two accounts that cannot both hold.

    DRAWN SIDE BY SIDE, TWO ACCOUNTS READ AS TWO FINDINGS. Ripple's "relatively strong" cascade and
    MacNulty's "modest and spatially variable" one were two arrows with two sizes, and nothing said
    that both cannot be true (James's verdict, 29 Sep 2026). The argument already says it."""
    against = {(a, b) for a, b, kind in edges if kind in ("attack", "contradictory")}
    by = {}
    for s in ok:
        if not s["selects"] and not s.get("assoc"):
            by.setdefault((s["src"], s["dst"]), set()).add(s["title"])
    out = set()
    for (a, b), titles in by.items():
        for x in titles:
            for y in titles:
                if x < y and ((x, y) in against or (y, x) in against):
                    out.add((a, b, x, y))
    return sorted([a, b, [x, y]] for a, b, x, y in out)


def _accounts(ids, ok):
    """Each outcome that more than one account explains, where at least one is a view the text
    reports: [{state, accounts: [{from, title, layer, stance, attribution, opened_by}]}].

    RIVAL ACCOUNTS OF ONE OUTCOME, SIDE BY SIDE (profile 1.9, G11). Stone tells three stories of
    malnutrition -- the liberal, the conservative, the radical -- and the census never set them
    together; nor did it see that the radical story opens the conservative story's cause
    (advertising -> choice). An account is a claim's step into the state; what opens it is another
    claim's step into that account's cause (wave 4, 28 Sep 2026)."""
    steps_ = [s for s in ok if not s["null"] and not s["selects"] and not s.get("assoc") and s["layer"] != "appraisal"]
    out = []
    for i in ids:
        into = [s for s in steps_ if s["dst"] == i]
        seen, accs = set(), []
        for s in into:
            k = (s["src"], s["title"])
            if k in seen:
                continue
            seen.add(k)
            opened = sorted({(r["src"], r["title"]) for r in steps_
                             if r["dst"] == s["src"] and r["title"] != s["title"]})
            accs.append({"from": s["src"], "title": s["title"], "layer": s["layer"],
                         "stance": s["stance"], "attribution": s["attribution"], "by": s["attribution_by"],
                         "opened_by": [list(x) for x in opened]})
        if len({a["title"] for a in accs}) > 1 and any(a["layer"] == "rival" or a["stance"] for a in accs):
            out.append({"state": i, "accounts": accs})
    return out


def _chain_profiles(chains, states, text, ids, reflexive, kind_of=None, instances=(), rival=(), null_from=(),
                    constituted=None):
    kind_of = kind_of or {}
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
        W = _walk(cids, cstates, edges, True, csigns, _regimes(mine, states), null_from,
                  cycle=c["form"] == "cycle", constituted=constituted)
        best = {(s["src"], s["dst"], s["sign"]) for s in mine}
        out.append(dict(id=cid, label=c["label"], question=c["question"], layer=layer,
                        steps=len(best), claims=len({s["title"] for s in mine}), states=cids,
                        roles={i: sorted(roles_of(cstates[i])) for i in cids if roles_of(cstates[i])},
                        entries=W["entries"], routes=W["routes"],
                        loops=[dict(states=l, reflexive=reflexive(l, mine), polarity=_polarity(l, csigns))
                               for l in _loops(cids, edges, regimes=_regimes(mine, states))],
                        gaps=[g["message"] for g in W["gaps"]], shared=[],
                        pieces=_pieces(cids, edges | _parts(states), kind_of)))
        for i in cids:
            member.setdefault(i, []).append(cid)
    # WHAT COUPLES THEM: every state a chain shares with another, and which others.
    for cp in out:
        cp["shared"] = [[i, [o for o in member[i] if o != cp["id"]]] for i in cp["states"]
                        if len(member[i]) > 1]
    # AND WHAT IS AKIN (profile 1.6): a state of this chain whose kind a DIFFERENT state has in
    # another chain -- a weaker tie than a shared state, and reported as one.
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
        # ITS FORM (1.11): a chain or a cycle, and whether the text says the cycle comes to rest.
        cp["form"] = dict(form=chains[cp["id"]].get("form", "chain"), settles=chains[cp["id"]].get("settles"))
        cp["goal"] = chains[cp["id"]].get("goal")
        cp["contrast"] = chains[cp["id"]].get("contrast")
        cp["account"] = chains[cp["id"]].get("account") or []
        cp["order"] = chains[cp["id"]].get("order", "time")
        # AN ISLAND (1.18): a chain that meets no other, by a state or by a kind; and whether the
        # text keeps it apart, which answers that and its pieces.
        cp["island"] = len(out) > 1 and not cp["shared"] and not cp["akin"]
        cp["apart"] = chains[cp["id"]].get("apart")
        cp["boundary"] = chains[cp["id"]].get("boundary")
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
        if s["selects"] or s.get("assoc"):
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
    if p.get("depth") == "sketch":
        lines.append("      depth   a SKETCH: the question, actors and chains, with steps marked only where "
                     "the argument relies on them; a state with no step is not queried"
                     + (f" -- {p['depth_reason']}" if p.get("depth_reason") else ""))
    if p.get("question"):
        lines.append(f"      question: {p['question']}")
    if p.get("contrast"):
        lines.append(f"              rather than: {p['contrast']}")
    if p.get("account"):
        lines.append("      account " + ", ".join(p["account"]) + " -- how the text reasons about causes; what an arrow means "
                     "differs with each")
    if p.get("goal"):
        lines.append(f"      goal    {p['goal']}: " + {"explain": "why and how something happened",
                     "intervene": "what to do to bring an effect about", "predict": "what will happen",
                     "attribute": "what cause was decisive, and whose"}[p["goal"]])
    lines.append(f"      height  {tall} of {len(p['levels'])} level(s)"
                 + (f": {', '.join(p['levels_spanned'])}" if tall else "")
                 + ("  (tall: expect to need several kinds of evidence)" if tall >= 3 else ""))
    od = p.get("ordering") or {}
    if od.get("kind"):
        lines.append(f"      levels are {ORDERINGS[od['kind']]} ({od['kind']}), "
                     + (f"as the text says ({od['stated']})" if od.get("stated") else "as the reconstructor reads them")
                     + ("; within: " + ", ".join(f"{c} in {par}" for c, par in od["within"]) if od.get("within") else ""))
    elif len(p["levels"]) > 1:
        lines.append("      levels  the map does not say what ordering its levels are (`ordering:`)")
    fm = p.get("form") or {}
    if fm.get("form") == "cycle":
        lines.append("      form    a cycle: not asked where it starts or what it is for -- "
                     + {True: "the text says it comes to rest", False: "the text says it does not come to rest",
                        None: "the text does not say whether it comes to rest"}[fm.get("settles")])
    if p.get("aspects"):
        n = dict(p["aspects"])
        nouns = sum(v for k, v in n.items() if k in NOUN_ASPECTS)
        verbs = sum(v for k, v in n.items() if k not in NOUN_ASPECTS)
        told = ("mostly in nouns" if nouns > 2 * verbs else "mostly in verbs" if verbs > 2 * nouns
                else "in nouns and verbs")
        lines.append(f"      aspect  {sum(n.values())} of {p['states']} state(s) say what kind of occurrence they are: "
                     + ", ".join(f"{k} {v}" for k, v in p["aspects"])
                     + f" -- told {told} (nouns: quantities and conditions; verbs: activities, "
                       f"developments and events)")
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
    for a, b, sg, by, eff, pd in p.get("moderated", []):
        what = {"strengthens": f"stronger where {by} holds", "weakens": f"weaker where {by} holds",
                "reverses": f"reversed where {by} holds",
                "0": f"NOT moderated by {by}, the text finds"}.get(eff, f"modified by {by} ({eff})")
        lines.append(f"      modif   {a} -> {b}{' (' + sg + ')' if sg else ''}: {what}"
                     + (f" ({pd})" if pd else ""))
    for a, b, sg in p.get("necessary", []):
        lines.append(f"      needed  {a} -> {b}: {b} only where {a} holds -- necessary, which says "
                     f"nothing of how much {a} brings")
    for a, b, sg, with_, suff in p.get("sufficient", []):
        cause = a + (" with " + ", ".join(with_) if with_ else "")
        lines.append(f"      enough  {cause} -> {b}: " + ("brings it about on its own" if suff else
                     "NOT enough on its own, the text says"))
    for a, b, sg, on in p.get("formation", []):
        what = {("being", "+"): "makes", ("being", "-"): "unmakes", ("persistence", "+"): "maintains",
                ("persistence", "-"): "erodes"}.get((on, sg), "transforms" if on == "character" else f"acts on the {on} of")
        if on == "possibility":
            what = "opens" if sg == "+" else "closes" if sg == "-" else f"acts on the possibility of"
        gloss = {"opens": f"opens up the possibility of {b}", "closes": f"closes off the possibility of {b}",
                 "makes": f"brings {b} into being", "unmakes": f"brings {b} to an end",
                 "maintains": f"keeps {b} going", "erodes": f"wears {b} away",
                 "transforms": f"changes what kind of thing {b} is"}.get(what, "")
        tag = {"maintains": "keeps", "transforms": "changes"}.get(what, what)
        lines.append(f"      {tag[:7]:<7} {a} -> {b}: {gloss or what} -- not more or less of it")
    for a, b, sg in p.get("chances", []):
        lines.append(f"      chance  {a} -> {b}: makes {b} " + {"+": "more likely", "-": "less likely"}.get(sg, "more or less likely")
                     + " -- a change in its chance, not in whether it happens")
    for a, b, sg in p.get("stocks", []):
        lines.append(f"      {'outflow' if sg == '-' else 'inflow ':<7} {a} -> {b}: " + ("flows out of" if sg == "-" else "flows into")
                     + f" {b}, a stock -- {b} need not move with {a}")
    for a, b, ext, whole, under, layer, title in p.get("constitution", []):
        lines.append(f"      constit {a} {'partly ' if ext == 'partial' else ''}constitutes {b}"
                     + (f", {'no more than their sum' if whole == 'aggregate' else 'through its organisation' if whole == 'organised' else 'and is nothing but them' if whole == 'reducible' else 'each making the other' if whole == 'mutual' else whole}" if whole else "")
                     + (f", on {under}" if under else "")
                     + f" ({title}{'; reported' if layer == 'rival' else '; the appraisal' if layer == 'appraisal' else ''})"
                     + " -- what makes it up, not a cause: never walked")
    for a, b in p.get("mutual", []):
        lines.append(f"      mutual  {a} and {b} make each other up: co-constituted, neither given before the other")
    for l in p.get("sustaining", []):
        lines.append("      sustain " + " -> ".join(l + l[:1]) + ": every step makes or maintains the next -- "
                     "a loop that keeps itself in being")
    by_status = {}
    for i, stt in p.get("statuses", []):
        by_status.setdefault(stt, []).append(i)
    for stt, ids_ in sorted(by_status.items()):
        lines.append(f"      {stt:<7} {', '.join(ids_)} -- "
                     + ("possibilities the text sets out, not (yet) actual: a route through them is a possible route"
                        if stt == "possible" else "what the text says cannot be specified in advance"))
    for a, b in p.get("both", []):
        lines.append(f"      both    {a} -> {b} is a step and {a} constitutes {b}: caused and constituted at once")
    for a, b, sl, cl in p.get("readings", []):
        voice = {"text": "the text's own", "rival": "a view the text reports"}
        lines.append(f"      reading {a} -> {b}: causal in {voice.get(sl, sl)}, constitutive in {voice.get(cl, cl)}")
    for a, b, sg, layer in p.get("associations", []):
        lines.append(f"      assoc   {a} ~ {b}{' (' + sg + ')' if sg else ''}: the text reports they go together, not that one "
                     f"brings the other about{' (a view it reports)' if layer == 'rival' else ''} -- never walked")
    for a, b, zs in p.get("common_causes", []):
        lines.append(f"              common cause drawn for {a} ~ {b}: {', '.join(zs)} -- the association may be its work")
    if p.get("scopes"):
        lines.append("      scope   " + ", ".join(f"{n} {k}" for k, n in p["scopes"]) + " (a particular case, or a general relation)")
    for l in p.get("stock_loops", []):
        lines.append("      stock   " + " -> ".join(l + l[:1]) + ": runs through a flow into a stock -- its polarity counts "
                     "flows, and the states need not move together")
    for a, b in p.get("extrapolated", []):
        lines.append(f"      extrap  {a} -> {b} is found in a particular case and also claimed in general: a derived claim, "
                     f"which needs more than the case")
    for a, b, title in p.get("one_case", []):
        lines.append(f"      ? one   {a} -> {b} is general, and backed by one case ({title}): a general claim needs more than the case")
    for st, of, how in p.get("measures", []):
        lines.append(f"      measure {st} measures {of}" + (f" ({how})" if how else "")
                     + " -- a reading of it, not a cause: steps into it are about the measurement")
    if p.get("designs"):
        lines.append("      design  " + "; ".join(
            f"{d}: {n}" + (" (hypothetical: shaded as asserted)" if d == "illustration" else "")
            for d, n in p["designs"]))
    by_pair = {}
    for a, b, sg, att, who, layer, title in p.get("attributions", []):
        by_pair.setdefault((a, b), []).append(f"{att}{' by ' + who if who else ''} ({title}{'; reported' if layer == 'rival' else ''})")
    for (a, b), atts in sorted(by_pair.items()):
        lines.append(f"      attrib  {a} -> {b}: " + "; ".join(atts))
    for a, b, sg, mb, bias in p.get("rests_on", []):
        lines.append(f"      rests   {a} -> {b}: its evidence is read from the measure {mb}"
                     + (f", which {' and '.join(bias)} bear{'s' if len(bias) == 1 else ''} on -- a bias in "
                        f"the measure undercuts the step" if bias else ""))
    for a, b, (x, y) in p.get("disputed", []):
        lines.append(f"      dispute {a} -> {b}: [{x}] and [{y}] are set against each other in the argument "
                     f"-- they cannot both hold")
    for acc in p.get("accounts", []):
        lines.append(f"      accounts of {acc['state']}, side by side:")
        for x in acc["accounts"]:
            who = "the text's own" if x["layer"] == "text" and not x["stance"] else \
                  "reported" + (f", {x['stance']}" if x["stance"] else "")
            lines.append(f"              {x['from']} ({x['title']}; {who}"
                         + (f"; {x['attribution']}" + (f" by {x['by']}" if x.get("by") else "") if x["attribution"] else "") + ")"
                         + (" -- opened by " + "; ".join(f"{f} ({t})" for f, t in x["opened_by"])
                            if x["opened_by"] else ""))
    for st, lvs in p.get("spanning", []):
        lines.append(f"      span    {st} runs across {', '.join(lvs)}")
    for w, parts in p.get("wholes", []):
        lines.append(f"      whole   {w}: {', '.join(parts)} -- drawn as one box at the text's own level")
    idi = p.get("idiom")
    if idi and idi.get("term"):
        lines.append(f"      told as {idi['term']}" + (f": {idi['means']}" if idi.get("means") else "")
                     + (f" ({idi['pinpoint']})" if idi.get("pinpoint") else "")
                     + " -- what the states are, said once for the chart")
    def _pieces_line(what, pcs, apart):
        if apart:
            return [f"      apart   {what} is kept apart by the text: {apart}"]
        if not pcs:
            return []
        return [f"      ? pieces {what} falls into {len(pcs)} pieces that meet at no state: "
                + " | ".join(", ".join(x) for x in pcs)
                + " -- cases of one kind (`kind:`), questions of their own (chains), or kept apart "
                  "by the text (`apart:`)?"]
    if not p.get("chains"):
        lines += _pieces_line("the chain", p.get("pieces"), p.get("apart"))
    by_id = {ch["id"]: ch for ch in p.get("chains", [])}
    for ch in p.get("chains", []):
        lines.append(f"      chain   {ch['id']}" + (f" \"{ch['label']}\"" if ch.get("label") else "")
                     + f": {ch['steps']} step{'' if ch['steps'] == 1 else 's'}, "
                     f"{len(ch['routes'])} route{'' if len(ch['routes']) == 1 else 's'} to an outcome, "
                     f"{len(ch['loops'])} loop{'' if len(ch['loops']) == 1 else 's'}, "
                     f"{len(ch['gaps'])} gap{'' if len(ch['gaps']) == 1 else 's'}"
                     + (" -- a cycle" if (ch.get("form") or {}).get("form") == "cycle" else "")
                     + (" -- in order of explanation, not of time" if ch.get("order") == "explanation" else "")
                     + (f" -- to {ch['goal']}" if ch.get("goal") else "")
                     + (f" -- by {', '.join(ch['account'])}" if ch.get("account") else "")
                     + (" -- all in views the text reports" if ch.get("layer") == "rival" else ""))
        if ch.get("question"):
            lines.append(f"              question: {ch['question']}"
                         + (f" (rather than: {ch['contrast']})" if ch.get("contrast") else ""))
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
        # JAMES'S PRINCIPLE (8 Oct 2026): mechanisms shown together meet at a state. A chain that
        # meets no other, and one in pieces, are questions for the reading -- the map may have
        # stopped where the text goes on (Sewell's durability), or the text may keep them apart.
        if ch.get("island") and not ch.get("apart"):
            lines.append(f"      ? island chain {ch['id']} meets no other chain, by a state or a kind -- does the text "
                         f"link it? If it keeps it apart, say why in the chain's `apart:`")
        lines += _pieces_line(f"chain {ch['id']}", ch.get("pieces"), ch.get("apart"))
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
    handed = {}
    for st, title in p.get("taken_up", []):
        handed.setdefault(st, []).append(title)
    for g in p["gaps"]:
        st = g.split("`")[1] if g.count("`") >= 2 else None
        if st in handed:
            lines.append(f"      handed  `{st}`: the chain stops here, and the argument takes it on -- "
                         + "; ".join(f"[{t}] is a reason there" for t in handed[st]))
        elif p.get("depth") == "sketch":
            lines.append(f"      open    {g} -- left open by the sketch")
        else:
            lines.append(f"      ? gap   {g}")
    qs_of = {(a, st): qs for a, st, _sch, qs in p.get("bridge_questions", [])}
    for arg, step, scheme, n_in, n_steps in p.get("bridges", []):
        lines.append(f"      bridge  <{arg}> step {step}: {scheme}, {n_steps} of {n_in} premise(s) stating a step")
        # ITS QUESTIONS, as the map answers them: the ones it records nothing on are named, since
        # those are where the text may be silent -- or the map may have missed what it says.
        qs = qs_of.get((arg, step), [])
        if qs:
            n_rec = sum(1 for q in qs if q[2] == "recorded")
            n_none = [q for q in qs if q[2] == "none"]
            n_read = sum(1 for q in qs if q[2] == "reader")
            lines.append(f"              questions: {n_rec} the map records something on, {len(n_none)} nothing"
                         + (f", {n_read} for the reader" if n_read else ""))
            for q in n_none:
                lines.append(f"              - nothing recorded: {q[0]}")
    for arg, step, regimes, unmatched in p.get("transfers", []):
        name = lambda r: f"`{r}`" if r else "(no regime)"
        if len(regimes) < 2:
            lines.append(f"      transfer <{arg}> step {step}: its premises' steps name "
                         f"{'no setting' if not regimes or regimes == [''] else 'one setting, ' + name(regimes[0])}"
                         " -- give each step its `regime:` to compare there with here")
            continue
        lines.append(f"      transfer <{arg}> step {step}: settings {' and '.join(name(r) for r in regimes)}"
                     + ("; every step has a counterpart in the other" if not unmatched else ""))
        for r, a, b, sg in unmatched:
            lines.append(f"               only in {name(r)}: {a} -> {b}" + (f" ({sg})" if sg else ""))
    cov = p.get("coverage")
    if cov:
        lines.append(f"      cover   {cov['covered']} of {cov['causal_sentences']} sentences in the "
                     f"text that use causal language are quoted by a step"
                     + (f"; {cov['in_argument']} more are quoted by claims of the argument "
                        f"that carry no step" if cov.get("in_argument") else "")
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
    stance = dict(p.get("stances") or [])
    if p["rival_steps"]:
        lines.append(f"      rival   {p['rival_steps']} step(s) in views the text reports "
                     f"(#reported)" + (": " + ", ".join(f"{stance[k]} {k}" for k in ("rejected", "unjudged")
                                                      if stance.get(k)) if stance.get("rejected") or stance.get("unjudged") else ""))
    if p["appraisal_claims"]:
        lines.append(f"      appraisal  {p['appraisal_claims']} claim(s), {p['appraisal_steps']} "
                     f"step(s) -- the reconstructor's own, excluded from every measure of the "
                     f"author's argument")
    return lines


def step_titles(doc):
    """Titles of every claim or argument that asserts a step (`causes:`) or, since 1.11, a
    constitutive relation (`constitutes:`)."""
    out = set()
    for kind in ("statements", "arguments"):
        for title, node in (doc.get(kind) or {}).items():
            d = _data(node)
            if "causes" in d or "constitutes" in d:
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
    spans = _spans(prov, doc, source_root, quotes, titles)
    # A SENTENCE THE ARGUMENT QUOTES WAS READ, even where no step carries it. Stone's paper is
    # almost all causal talk reported as stories, and 6 of 109 "covered" measured the genre, not
    # the reading (wave 4, 28 Sep 2026). Such sentences are counted apart and left out of the
    # candidates, which are then the causal sentences no claim of the map quotes at all.
    appraisal = prov.appraisal_titles(doc)
    others = {t for t, _ in prov.iter_members(doc)} - titles - set(appraisal)
    argued = _spans(prov, doc, source_root, quotes, others)
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
    total, covered, near, in_argument, uncovered = 0, 0, 0, 0, []
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
            if any(_quoted(norm, q) for q in argued.get(ch, [])):
                in_argument += 1
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
    return dict(causal_sentences=total, covered=covered, near=near, in_argument=in_argument,
                uncovered=uncovered[:40], uncovered_count=len(uncovered))


def _spans(prov, doc, source_root, quotes, titles):
    """{chapter: [normalised quotation]} for the claims named: their exact quotations, and the
    claim's own words where it is a quotation whole."""
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
    return spans
