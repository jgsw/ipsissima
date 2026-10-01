# The Ipsissima profile for Argdown

**Version 1.16 — 1 October 2026.** The machine-readable registry of everything below is
[`ipsissima-mcp/src/ipsissima_mcp/profile.json`](../ipsissima-mcp/src/ipsissima_mcp/profile.json);
the checker reports the profile version it validates against.

© 2026 James Wilson. This document and its registry are licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0), so that anyone — Argdown's own tools first — may adopt, adapt or build on the
profile with attribution. The rest of the repository keeps its own licences: MIT for the
application, GPL-3.0-or-later for Ipsissima-MCP, in whose package the registry travels.

## What a profile is, and why this is one

[Argdown](https://argdown.org) is the notation Ipsissima reads and writes. Ipsissima needs to
record more than Argdown's syntax carries: where a claim comes from in a text, how far its
words stand from the author's, whose view it is, what backs a causal step. It records all of it
**without adding any syntax**. Every annotation in this profile sits somewhere Argdown already
provides for data:

- the file's **front matter**, the YAML block between `===` lines;
- a claim's, an argument's or a premise-conclusion line's **`{data}` block**;
- Argdown's own **`#tags`**;
- and, for the text a map reads, the **YAML front matter of the source file**.

So a file written to this profile **is an Argdown file**. It parses with the official parser,
and any Argdown tool draws it as an ordinary argument map, ignoring what it does not know.
Ipsissima reads the same file and draws more. That is the whole design: an annotation layer on
standard Argdown, documented openly, not a dialect of it.

Why not a dialect? Because the notation is someone else's. A private relation or a new symbol
would stop the file being Argdown, would parse nowhere else, and would lock a reader's work
into one program. Ipsissima's values record this as a near-absolute boundary
(`docs/values/INVENTORY.md`, A9 and C6), and the official parser is the ground truth for what a
file says (E2). Where the notation cannot carry a distinction, a key in this profile or a
claim's `note:` carries it.

This document is the **specification**: what each key means, what values it takes, and what
Ipsissima does with it. How to *choose* those values when reconstructing a text is method, and
lives in `ipsissima-mcp/src/ipsissima_mcp/docs/` — above all `ipsissima-conventions.md` (the
claim's record), `extraction-prompt.md` (the reconstruction) and `mechanism-pass.md` (the causal
chain).

## Conformance

A map **conforms to profile 1.0** when:

1. the official Argdown parser accepts it;
2. every key this profile defines has a value of the shape given here;
3. every quotation it makes — a span of 10 or more characters in double quotation marks, in a
   claim's text or its `source:` — is found in the source file it cites, after the folding in
   *Quotation matching* below.

The reference validator is `argdown_check` (the MCP tool) or
`python -m ipsissima_mcp.check_argdown <file> --source-root <folder>`. Its two booleans mean
different things: `ok` is (1) and (2); `verified` says whether (3) was examined, which needs the
source files. A map may be `ok` without being `verified`; a reading is finished only when it is
both.

A key the profile does not define is **allowed**. The parser carries it, Ipsissima ignores it,
and the checker names it — with a suggestion where it looks like a misspelling of a key that is
read (`page:` for `pinpoint:`, `quote:` for `source:`). An unknown key is a note, never a fault.

## 1. The map's front matter

```yaml
===
title: "Bates et al. 2012 -- The Price is Wrong"
reconstruction:
    generated: true
    aim: fit
    unit: meaning
    mode: coherence
    strength: ordinary
defaults:
    chapter: "source/bates-2012-price-is-wrong.md"
===
```

| key | value | meaning |
|---|---|---|
| `title` | string | The map's name: *Author YEAR -- short title* by convention. |
| `reconstruction` | map | The **reading policy** (below). |
| `defaults` | map | Claim metadata stated once, inherited by every claim that does not set the key itself — usually `chapter`. A claim's own value always wins. `defaults.reviewed` records a person's pass over the whole map. |
| `contentions` | list of claim titles | The text's **stated theses**, added to the apex the map computes. Only the author's own; never a persona's. Rarely needed. |
| `text-provenance` | `generated` | The *manuscript itself* was machine-generated (a report written for the purpose). Shown beside the title. Other values are carried verbatim. |
| `author`, `date` | string | For a **survey map** — a map of a pattern of public argument with no source text: who drew it and when. |
| `mechanism` | map | The causal chain the text asserts: §5. |

### The reading policy

| key | values | meaning |
|---|---|---|
| `generated` | `true` \| `false` | A model wrote the map. The checker may then correct its fidelity markers; once a person has reviewed it, it is theirs. |
| `draft` | `true` \| `false` | The text is still being written. Checks that expect a finished argument (a contention, no loose claims) report observations, not faults. |
| `aim` | `fit` \| `appropriation` | `fit`: what the text says. `appropriation`: the best philosophy in it. |
| `unit` | `meaning` \| `commitment` | Whether charity settles which sense of the words, or which view is held. |
| `mode` | `coherence` \| `truth` \| `soundness` \| `agreement` \| `interest` | What charity, where it is extended, maximises. |
| `strength` | `minimal` \| `ordinary` \| `strong` | How much better than their words the author is assumed to be. |
| `method` | `series` \| `parallel` | How the map's mechanism was reconstructed: after the argument, by a pass that changes nothing in it (`series`), or with it, the mechanism entering the argument through bridges (`parallel`) (*added in 1.15*). Recorded so that maps made each way can be told apart and compared. |

`aim` places the map on Betz and Brun's trade-off between systematic correctness and exegetical
adequacy; `unit`, `mode` and `strength` are Tom Stern's three dimensions along which "the
principle of charity" is ambiguous. Ipsissima checks only the exegetical half: whether the
reading fits the words.

## 2. What a claim records

On any claim or argument, in its `{data}` block:

| key | value | meaning |
|---|---|---|
| `chapter` | path | The source file the claim reads, relative to the source root. |
| `section` | string | The heading in that file the claim belongs to. |
| `source` | string | A quotation pinning a claim whose own text has to be a summary. Verified like any quotation. |
| `echoes` | string, or list of strings | Where **else** the text states the claim, in the author's words: the thesis announced in the abstract or the roadmap, say, while the claim is placed where it is argued. Verified like any quotation, and found in another file of the manuscript if not in the claim's own. It never pins the claim; the exposition view draws a faint echo at each place (*added in 1.3*). |
| `pinpoint` | string | Where a reader finds it in print: `p. 12`, `pp. 34, 36`, `[50]`. Checked where the source carries page markers: a quoted claim whose words are not on the page cited is reported, as something to look at and never as a fault, since the markers may be the ones in error. A paragraph running across a break may cite either page. Where the claim's words stand in more than one place, a cited page that holds them decides which the claim is placed at. |
| `line`, `lineSource` | integer, string | Where in the chapter the claim sits when no quotation places it, and how that was arrived at. |
| `fidelity` | the fidelity ladder | How far the claim's **own text** stands from the author's words. |
| `warrant` | string | Why a departure is allowed. Required on `interpretation` and `imputation`. |
| `note` | string | What the notation cannot carry. |
| `reviewed` | date | A person's review of this claim. Never written by a model. |
| `causes` | map, or list of maps | The causal step or steps the claim states: §5. |

### The fidelity ladder

Closest first: **`quotation`** (the claim's entire text is the source's words) · **`paraphrase`**
· **`compression`** (the default) · **`interpretation`** · **`imputation`**. `quotation` is the one
level with a fact of the matter, so it is computed and checked: a claim marked `quotation` whose
text is not in the source is a fault, and on a `generated` map the checker corrects the marker.
Ipsissima draws the ladder as the solidity of a claim's border — solid, then three grades of
dash, then dash-dot — and draws causal arrows in the same patterns: *fidelity is pattern*,
everywhere.

### Warrants

Any short reason is accepted. These seven are the vocabulary the method suggests, after Stern's
account of what makes a text open to a charitable reading: `enthymeme`, `hyperbole`,
`sloppy-phrasing`, `secret-sign`, `other-texts`, `coherence`, `convention`.

### On premise-conclusion lines

| key | where | meaning |
|---|---|---|
| `uses` | an inference line: `-- {uses: [1, 2]} --` | Which premises the step uses. Required once a structure has two or more steps. |
| `formalization` | a premise or conclusion | The line's logical form, in NLTK syntax: `p -> q`. |
| `formalized` | a premise or conclusion | The stamp of the words the formula was read against, written by a person with `check_argdown.py --stamp`. If the claim's words change, the stamp no longer matches and the checker says so. |

On a heading, `isGroup` is Argdown's own: `# Section {isGroup: true}` makes the heading group its
claims. Ipsissima draws the groups as sections and folds them.

An inference line may also name a rule in Argdown's own syntax — `-- Modus ponens {uses: [1, 2]} --`.
Where the rule is one Ipsissima knows and the lines are formalized, the checker tests whether
the step is that rule.

## 3. Tags: whose claim it is

A tag says **whose claim it is**, never how important it is — importance is computed from the
map. An untagged claim is the author's own, asserted.

| tag | the claim is |
|---|---|
| `#reported` | a view the text sets out but does not hold |
| `#conceded` | something the author grants tells against them |
| `#contested` | an objection voiced **in the text** that is not the author's view — never the reconstructor's own |
| `#authority` | a proposition whose force comes from its source, not its content |
| `#obiter` | said in a judgment, but not a necessary step to the disposal |
| `#crux` | a claim the reconstructor settled by choosing among live readings; its `note:` names the road not taken |
| `#appraisal` | the reconstructor's own reading of the text against the world |

`#appraisal` carries rules of its own: such a claim must be `fidelity: imputation` with a
`warrant:`; no argument of the author's may use it as a premise; it is excluded from every measure
of the author's argument; and Ipsissima hides it until the reader asks for it. Any other tag is
the reconstructor's own filing and is simply shown.

## 4. Readings, not only maps

A reconstruction that chooses among readings tags the choice `#crux`. A rival reading that is
local may be `#reported` beside it; one that would re-wire the argument is a **sibling file** —
one file, one reading. This profile adds nothing for comparing readings: two conforming files of
one text are compared as they stand.

## 5. The mechanism: the causal chain a text asserts

Optional, and written by a separate pass only on request. The front matter declares the chain's
cast:

```yaml
mechanism:
    question: "How would free distribution raise use of preventive health products?"
    levels: [macro, meso, micro]
    actors:
        ngo:       {label: "Governments and NGOs distributing products", level: meso}
        household: {label: "Poor household", level: micro}
    states:
        price:  {label: "User fee charged", actor: ngo, role: intervention}
        takeup: {label: "Household takes the product up", actor: household}
        health: {label: "Health of the household", actor: household, role: outcome}
```

| key | value | meaning |
|---|---|---|
| `question` | string | What the chain answers. |
| `chains.<id>` | `{label, question, roles}` | One of **several** chains the text sets out, each answering its own question; `roles` maps a state id to the role it plays in this chain, where that differs from its own (*added in 1.5*). |
| `levels` | list | Levels of social complexity, top first. Default `[macro, meso, micro]`. |
| `ordering` | `composition` \| `space` \| `authority` \| `scale` \| `sequence` \| `systems` \| `mixed` \| `unstated`, or `{kind, pinpoint}` | **What kind of ordering the levels are** — the reconstructor's reading, unless `pinpoint` shows where the text says it (*added in 1.10*). |
| `within` | map of level to level | **Each level's parent**, where the levels nest: a tree, so siblings sit side by side within their parent (*added in 1.10*). |
| `form` | `chain` \| `cycle` | **A cycle** of reproduction and transformation, not a chain from causes to ends: it is not asked where it starts or what it is for. Also on each chain (*added in 1.11*). |
| `settles` | boolean | On a cycle: whether the text says it **comes to rest** (*added in 1.11*). |
| `goal` | `explain` \| `intervene` \| `predict` \| `attribute` | What the chain is **for**: to explain why and how something happened, to find what to do, to predict, or to attribute responsibility. Also on each chain (*added in 1.13*). |
| `contrast` | string | The **foil** the question sets: why this, *rather than* what. Also on each chain (*added in 1.13*). |
| `account` | `regularity` \| `manipulability` \| `mechanism` \| `counterfactual` \| `intra-action`, or a list | The **account of causation** the text reasons with; an arrow means something different under each. The census holds it against the map: `manipulability` with no experimental `design:` among the steps is queried, and so is `intra-action` with nothing said to constitute anything. Also on each chain, held to that chain's own steps (*added in 1.14*). |
| `actors.<id>` | `{label, level}` | A position the text names — "courts", "the household" — at one of the levels. |
| `kinds.<id>` | `{label, general}` | A kind of state that recurs across cases — rural–urban migration, forest cover — named so that states in different cases can say they are of it (*added in 1.6*); `general` names the state that is the general claim, the others being its cases (*1.7*). |
| `states.<id>` | `{label, actor, role, measured, appraisal, note, part_of, levels, kind, measures, method, aspect}` | A change in an actor's condition or conduct — or, since 1.11, a process with no owner, which leaves out `actor` and is placed by its `levels`. `role` is `intervention` (what the text recommends doing), `condition` (a cause it sets out from without recommending it — the explanans of an explanatory text; *added in 1.1*) or `outcome` (what the chain is for, or what the text explains) — or a **list** of these, for a state that is both, such as where a circle starts and what a remedy is for (*1.1*). The chain starts from its interventions and conditions. `measured` says how the text measures it; `appraisal: true` makes it the reconstructor's own state; `note` records which of the text's words were read as one state; `part_of` names a larger state it is a part, facet or instance of (*1.2*); `levels` lists the levels a state holds at when it holds at more than its actor's (*1.4*); `kind` names the declared kind it is a case of (*1.6*); `measures` names the state it is a measure, indicator or estimate of, and `method` how the measure is taken (*1.9*); `aspect` says what kind of occurrence it is — `quantity`, `activity`, `development`, `event` or `condition` (*1.11*); `status` whether it is `actual` (the default), `possible` or `open`, and `actor` may be a **list** for a relation or a doing of several actors together (*1.12*). |

A claim that states a step carries `causes:` — one map, or a list:

```argdown
[Small fees cut take-up]: Relative to free distribution, "charging even very small user fees
substantially reduces adoption".
    {fidelity: "compression", pinpoint: "p. 30",
     causes: {from: price, to: takeup, sign: "-", basis: study}}
```

| key | value | meaning |
|---|---|---|
| `from`, `to` | state ids | Declared states. |
| `sign` | `+` \| `-` \| `"0"` \| `which` | Raises, lowers, a **finding of no effect**, or — since 1.2 — **decides which** of several alternatives follows, rather than raising or lowering a quantity. Quote the zero: YAML reads a bare `0` as a number. |
| `basis` | `study` \| `statistics` \| `model` \| `example` \| `testimony` \| `asserted` | What the **text** offers for the step. The first three count as tested; `example` and `testimony`, and an asserted step the map argues for, as argued. |
| `lag` | string | Timing the text states. |
| `period` | string | **When** the step holds, in the text's words anchored to an event: "during culling", "after the order ends" (*added in 1.8*). |
| `on` | `level` \| `trend` \| `being` \| `persistence` \| `character` \| `possibility` \| `chance` \| `stock` | Whether the step moves the **level** of its `to` (the default) or its **trend**: the levy slowed obesity's rise rather than lowering it (*added in 1.8*). Since 1.11: whether it **makes** or **unmakes** its `to` (`being`, `+` or `-`), **maintains** or **erodes** it (`persistence`), or changes what **kind** of thing it is (`character`, with `sign: which`). Since 1.12: whether it **opens up** or **closes off** the possibility of its `to` (`possibility`, `+` or `-`). Since 1.14: whether it makes its `to` **more** or **less likely** (`chance`, `+` or `-`), or **flows into** or **out of** it, a stock (`stock`, `+` or `-`). |
| `given` | list of strings, or of `{state, value}` | Conditions the text states, in its words. A moderator is a condition, not a state. Since 1.8 a condition may name a declared state and the value it has: `{state: ampk, value: absent}`. |
| `how` | `{actor, situation, habit, response}` | Gross's decomposition of a step, only where the text gives it. |
| `reflexive` | boolean | The step runs through a classification or prediction it acts on. |
| `selects` | boolean | A **selection link**: who ends up on each side, not an effect. |
| `hedged` | boolean | The text puts the step as a possibility. |
| `chain` | chain id, or list of them | Which of the declared chains the step belongs to (*added in 1.5*). |
| `jointly` | state id, or list of them | The step holds **only together with** these states: a joint cause, not two causes each sufficient alone (*added in 1.4*). |
| `unless` | state id, or list of them | The step holds **unless** these states hold: a blocker, such as a defence between a hazard and harm (*added in 1.8*). |
| `despite` | state id, or list of them | The step held **although** these states acted against it: a blocker that failed (*added in 1.8*). |
| `via` | state id, or list of them | The finer route the text opens this step into, in order: the step **is** that route, not a second one beside it (*added in 1.8*). |
| `regime` | string | The **regime** the step holds in, in the text's words: a dose, a place, a model (*added in 1.8*). |
| `threshold` | string | The **threshold** the step acts past, in the text's words: the step switches something rather than moving it smoothly (*added in 1.8*). |
| `share` | `entire` \| `most` \| `partial` \| `none` | How much of the step runs by its `via` route: all of it (the default), most, part, or **none** ("AMPK-independent") (*added in 1.8*). |
| `size` | string, or `{value, unit, ci, versus, at}` | The **magnitude** the text gives for the step, quoted: an effect size with its interval, what it is measured against, and when (*added in 1.8*). |
| `modifies` | `{by, effect, period}`, or a list of them | A state that **moderates** the step: `effect` is `strengthens`, `weakens`, `reverses`, or `"0"` where the text finds it does **not** moderate it (*added in 1.9*). |
| `necessary` | boolean | The step's `to` holds **only if** its `from` does (*added in 1.9*). |
| `sufficient` | boolean | `true`: the cause, with any `jointly` co-causes, brings the effect about **on its own**. `false`: the text says it is **not enough** on its own (*added in 1.9*). |
| `design` | string | The **design** of the evidence, in the text's words; `experiment`, `replication`, `quasi-experiment`, `natural experiment`, `observational`, `case study`, `illustration`, `anecdote`, `review` and `simulation` are read. An `illustration` is a hypothetical case (*added in 1.9*). |
| `attribution` | `intentional` \| `mechanical` \| `inadvertent` \| `accidental` \| `complex`, or `{type, by}` | The **type of causing** the step attributes, and `by` **whose** action or intention it is, an actor (*added in 1.9*). |
| `measured_by` | state id, or list of them | The **measure** the step's evidence is read from, a state with `measures` (*added in 1.9*). |
| `stance` | `rejected` \| `unjudged` | On a `#reported` or `#contested` step: whether the text sets the view out to **reject** it or leaves it **unjudged** (*added in 1.9*). |

**Parts and wholes (1.2).** A state declared `part_of: <id>` is drawn inside that state when the
view shows *the text's own boxes*: every step from or to a part becomes the whole's, and a step
between two parts of one whole is counted rather than drawn. Declare it where the text itself
groups finer states into one — a box in its own diagram, a typology under one heading. A whole may
be part of a larger whole; it may not contain itself. A general mechanism and its cases are not
parts and a whole: since 1.6 and 1.7 they are states of one kind, with the general one named.

**Joint causes (1.4).** "Belief that others comply moves people to comply, but only where they
wish to fit in" is one step with two causes, neither enough alone. Two steps would say each
suffices; `given:` would make the wish a condition in words, not a state the chain can reach.

```argdown
[Belief and desire move people]: Belief that others comply moves people to comply, but only where
they wish to fit in.
    {causes: {from: belief, to: act, sign: "+", basis: asserted, jointly: [desire]}}
```

A co-cause counts as a cause of the step's `to` for routes, loops and gaps — a condition that only
ever acts jointly is linked, not stranded — but the step is counted once. It is drawn as the
Reasons map draws linked premises: a stem from each co-cause to a bar across the arrow.

**A state across levels (1.4).** A state an actor holds at one level but that holds at others too
— the Coleman boat's shared expectation, which is at once many people's belief and a fact about
society; Wimmer's consensus, negotiated between individuals and holding as a field's — declares
them: `levels: [macro, micro]`. It is drawn as one box through every lane from its top level to
its bottom, and it counts toward the chain's height at each. Its actor stays the one that holds it.

**Several chains (1.5).** A text that answers several questions sets out several chains: the
Coleman-boat paper's drought and migration in northern Kenya, its fisheries, its segregation
model. Declare each under `chains:` with its own `label` and `question`, and mark each step with
the chain it belongs to:

```argdown
===
mechanism:
    question: "How do migration and water tables couple through the forest?"
    chains:
        drought: {label: "Drought and migration", question: "Why does drought clear the forest?"}
        water:   {label: "Forest and water", question: "What does forest loss do to the water table?",
                  roles: {forest: condition}}
    ...
===

[Migration clears forest]: Migrants clear forest for farmland.
    {causes: {from: migration, to: forest, sign: "-", basis: asserted, chain: drought}}
```

A chain is its steps: its states are those its steps run through, with any it gives a role to. A
state two chains share is what **couples** them, and a chain may cast it in a role of its own —
forest cover is what the first chain explains and where the second begins, one boat's outcome the
next one's condition. The census walks each chain on its own (its routes, loops and gaps, with its
own roles) as well as the whole, and names what each shares with which other and in what role
there. The view opens at the first chain, laid out alone; a shared state carries ⇄, which opens the
other chain; *every chain together* draws the whole. A step marked with no chain is counted.

**The same kind across cases (1.6).** Two states can be the same kind of thing in different
cases without being one state: the Coleman-boat paper's general rural–urban migration and its
Kenyan herders' migration, which the text never joins. One state would walk from the case into the
general claim, inventing a step; `part_of` would draw them as one box. Declare the kind once, and
let each state say it is of it:

```argdown
===
mechanism:
    kinds:
        migration: {label: "Rural-urban migration"}
    states:
        kmigr: {label: "Herders' migration", actor: herders, kind: migration}
        migr:  {label: "Rural-urban migration", actor: migrants, kind: migration}
    ...
===
```

Nothing is walked between states of one kind: routes, loops and gaps are what they were. What the
census adds is computed, not declared — each kind with its states; each pair of the text's steps
whose ends are each one state or states of one kind, **the same step in two cases**; and, for each
chain, which of its states have kin in another. Where steps say which chain they are in, two steps
in one chain are alternatives within one case, not two cases, and are not paired. The view marks such a state ≈, and a click shows
its kind, with each state of it and the chain it is in.

**The general and its cases (1.7).** A kind is symmetric: its states are pairs of equals. Where one
of them is the text's GENERAL claim and the others are cases of it — the paper's rural–urban
migration and its Kenyan herders' — the kind names it: `migration: {label: "Rural-urban
migration", general: migr}`. The census then orients what it finds. Of two steps the same across
cases, one is the **general step** and the other **a case of it** when each end of the first is
either the other's end or the general state of that end's kind; two cases of it remain the same
step in two cases, as equals. A chain whose steps are cases of a general step in another chain is
reported as a case of that chain. Nothing is declared on a step: Merton's bank and his out-groups
become cases of his general mechanism by their states alone.

**One link at two grains (1.8).** Texts state a link whole and then open it: a trial measures the
levy's total effect on obesity, and the paper explains it through reformulation and sugar bought;
a review says metformin lowers glucose and that this is "mediated entirely" by one enzyme. Marked as
two steps, the whole link reads as a direct route beside the finer one, which is partial mediation
the text never claims. `via: [reform, sugar]` on the whole link says it IS the route through those
states, in order. The census walks it once, as that route, and names it. It asks (`?`) where the
text's steps do not give every hop of the route, and where the route's signs net the other way
from the step's own. The step keeps its claim, basis and lag, and the view labels its arrow "via …",
as it labels a folded route. By default `via` is the whole of the effect. `share: most` or
`share: partial` says the route carries only part of it, and the step keeps a direct remainder
the text has not opened. `share: none` says the effect does **not** run through those states, as a
knockout study finds of a pathway it rules out.

**Magnitude (1.8).** A sign says which way an effect runs, and `size:` says how much, as the text
gives it: in words ("a third of the cost"), or as `{value, unit, ci, versus, at}` for an estimate.
The census lists each size. Where a start raises an outcome by some routes and lowers it by others,
the census says which wins is a matter of size. The view puts a stated value on the step's arrow.
Two texts that agree on direction and dispute only size then no longer draw as agreement.

**A step on a step (1.8).** Three forms that texts give a step's own conditions, each met in the
gap tests on six texts:

- **A blocker.** `unless: defence` on hazard → harm says the harm follows unless the defences hold.
  It is the dual of `jointly`. The census walks the blocker as a cause of the step's `to` with the
  step's sign reversed (more defence, less harm), once, and names it. The view draws a stem from the
  blocker that stops on a bar across its own end, the inhibition mark.
- **A blocker that failed.** `despite: culling` says the step held although culling acted against
  it. `given:` would read as the condition under which the step holds, which says something else.
  It is reported and not walked.
- **A condition naming a state.** A `given` item may be `{state: ampk, value: absent}`: a knockout, a
  subgroup, a place. Where the steps between one pair of states differ by condition (the levy
  lowers obesity in year-6 girls and not in boys), the census groups them, each sign with its
  conditions, and a null that holds under a condition says so rather than "no effect".

**Time (1.8).** A `lag` says how long a step takes. Two more things about time recur in evaluations,
and the lag could not say them:

- **The period in which a step holds.** A trial finds culling lowered TB during culling and
  found no effect after it ended. `period: "during culling"` and `period: "after culling ended"` make
  the two records one step's time course. The census prints them together, each with its period,
  and a null names the period it holds in. A period partitions the chain as a regime does. The census
  composes a route or a loop only from steps that can hold in one period, and a step with no period
  holds in all of them.
- **A step on a trend.** An interrupted time series finds a slower rise against the projected trend,
  "a dampening of the rate of increase … rather than a reversal". `on: trend` with `sign: "-"` says
  the step slows the rise. The view's arrow reads "slows" or "speeds", not "lowers" or "raises".

Each stated `lag` is listed with its own step.

**Regimes and thresholds (1.8).** A regime decides which mechanism runs: metformin acts one way at
the doses used in patients and another at the doses of the laboratory; culling lowers TB inside the
zone and raises it outside. `regime: "at clinical doses"` names the regime a step holds in, in the
text's words. The census then composes a route only where one regime holds every step of it, and a
step in no regime holds in all. `threshold:` says the step acts only past a threshold ("above a
critical warming of about 3°C"). The arrow reads "raises past a threshold", because a plain "raises"
says more of the one gives more of the other, smoothly. Both are words. The threshold's value,
whether reversing the cause reverses the effect, and a loop that holds whichever state obtains are
not yet marked (see Known limits).

**Moderation (1.9).** "Powerful initial backers moderate the relationship between a new theory and
experimentation" is a claim about a step, not a cause of its end. `modifies: {by: backers, effect:
strengthens}` on the step says so; `weakens` and `reverses` are the other directions, and `"0"` records
a text's finding that something does **not** moderate the step (cue type and racial priming). A
`period` dates the moderation. The moderator is not walked as a cause, and a condition that only
moderates is not reported as unlinked. The census lists each; the view sends a dotted stem from the
moderator to a small ring on the arrow. `given:` remains the form for a condition in words, `unless`
for a blocker, and `jointly` for a co-cause without which the step does not run at all.

**Necessary and sufficient (1.9).** "Difficult conditions become problems only when people come to
see them as amenable to human action" is a necessary condition, and a plain `+` drew it as "raises".
`necessary: true` says the step's `to` holds only where its `from` does, and the arrow reads "needed
for". `sufficient: true` says the cause, with its `jointly` co-causes if it has any, brings the effect
about on its own: a joint set that suffices is a step with `jointly` and `sufficient: true`.
`sufficient: false` records the commoner claim, a cause that is "necessary, but not sufficient" or
that "may help; it will not guarantee". "In part" and "not solely" stay in `size` or `share`.
A list of conditions the text leaves open ("more likely if …, if … and if …") is read as
conjoint, one step with the rest `jointly`, and the `note` says the text leaves it open; separate
steps say each condition works alone, which only a text that says so licenses.

**Evidence and measurement (1.9).** `basis` says what kind of backing a step has; `design` says how,
in the text's own words: a randomised experiment, a replication, an anecdote, a case the text re-reads.
`design: illustration` marks a **hypothetical** case, which shows how a step could go and not that it
does: it is shaded as asserted, never as an example. A state may be a **measure** of another:
`measures: priming, method: "the attitude battery after the treatment"`. Nothing is walked from a
measure to what it measures, and a measure is no dead end. A step whose evidence is read from a
measure says so with `measured_by: <measure>`; a step into that measure from anything but what it
measures is a bias, and the census and the view show it bearing on the step as an undercut would:
MacNulty et al.'s case that the volume model overestimates browsed crowns undercuts Ripple et al.'s
cascade. A step into a measure is a claim about
the measurement, which is where a method's artefacts belong (Valentino et al.'s timing experiment;
a crown volume computed from height).

**Rival accounts (1.9).** A text of rival accounts reports them to reject them or to set them out
without judging. `stance: rejected | unjudged` on a `#reported` or `#contested` step records which.
A report the author endorses (Stone on Stiles, who "demonstrated" the hookworm cause) is the
author's own claim, in her voice, and is marked as such, `hedged` where the reporting works as a
hedge; the checker asks when it meets `stance: endorsed`.
Where an outcome has two or more accounts from different claims, and at least one is reported, the
census sets them side by side: each account, whose it is, its stance and type, and any story that
opens its cause. The view shows the same list on the outcome's panel. `attribution` records the
**type** of causing a step attributes, after Stone (1989), and `attribution: {type, by}` names
whose action or intention it is (the eater's knowing choice, or the advertiser's guidance): `intentional` (purposeful action, intended
consequences), `inadvertent` (purposeful action, unintended consequences), `mechanical` (guided
through another agent or a machine), `accidental` (neither), and `complex` (a web of causes with no
single locus). Rival stories of one harm often differ in nothing else, and a strategy that moves a
problem from accident to intent is a move between types.

**Feedback.** Nothing is declared for a loop: loops and feedback systems are computed from the
steps. Past a handful of loops through one system of states, the census names the system and
its shortest loops rather than listing every loop.

A step on a `#reported` or `#contested` claim is a rival view's, reported apart and never walked as
the text's own chain. A chain made only of such steps is walked on them, and the census says so.
A step on an `#appraisal` claim is the reconstructor's.
A null finding and a selection link are reported and drawn, never walked as part of the chain.
A step the text states but the argument never needed gets a claim of its own, quoting the text,
under a heading `# The mechanism, as the text states it {isGroup: true}`.

**What the levels are (1.10).** A `levels:` list says the text orders things, and not by what. The
research maps used one key for composition (organ, cell, molecule), spatial scale (global,
subcontinental, local), a food chain (carnivores, herbivores, plants), separate systems acting on
each other (culling operations, badger populations, cattle herds) and roles side by side within a
whole (elites and citizens within the nation), and a reader of the chart who had not read the paper
could not tell which (James, 30 September 2026). Ylikoski (2024) makes the general point: in the
social sciences "level" is a placeholder for several orderings, and trouble comes when they are run
together. So a map says which:

| `ordering` | the levels are | they nest |
|---|---|---|
| `composition` | parts within wholes | yes |
| `space` | regions within regions | yes |
| `authority` | a chain of command, or units within units | yes |
| `scale` | larger and smaller, contrasted, without containment | no |
| `sequence` | an order along a chain: a food chain, a supply chain | no |
| `systems` | separate systems that act on one another; their order is a convention | no |
| `mixed` | more than one of these in one list | — |
| `unstated` | an ordering the text does not name | — |

It is the reconstructor's reading unless the text says it, when `{kind, pinpoint}` gives the place.
Where the levels nest, `within:` gives each level's parent. Levels of mechanisms are a **tree** of
composition, local to the mechanism (Craver 2025), not strata across all of nature, so nesting is
never read off the order of the list: Valentino's elites and citizens are both within the nation,
and neither within the other.

```yaml
mechanism:
    levels: [nation, elites, citizens]
    ordering: composition
    within: {elites: nation, citizens: nation}
```

The checker says what the levels are in its census, and asks for `ordering:` where a map with more
than one level does not say. It refuses an `ordering` it does not know and a `within:` naming a level
that is not declared, and queries a `within:` beside an ordering that is not a containment, and a
tree the list cannot draw nested -- a level listed outside the run of its whole -- giving the order
that can. The Mechanism chart writes the ordering in words on the drawing, draws the levels as bands
by default, nests them as the declared tree on request, and offers no nesting for levels declared
not to nest; a map that declares nothing can be nested under a banner saying the frames are an
assumption.

**Process, formation and constitution (1.11).** The chart was built as a noun-and-arrow language:
states that are amounts, levels and rates, joined by steps that raise or lower them. Arthur (2023)
shows what such a language cannot see. An economics written in algebra records that companies are
started as "the number of companies started" (p. 639), and so loses *formation*: things coming into
being, being kept going, and changing in kind. Process texts turn on formation. Wimmer explains ethnic
boundaries as "the outcome of a cycle of reproduction and transformation" (2008, p. 1009). Hu's
institutions "produce and maintain race" (2023, p. 11). Wilson moves health-system ethics from a
"distribution-focused paradigm" to "a flow-centric one" (2023, p. 363). Each addition below is
optional, and is used only where the text speaks so.

- **What kind of occurrence a state is.** `aspect:` says, from the text's own grammar:
  - `quantity`: an amount, level or rate;
  - `activity`: ongoing, and complete at every moment;
  - `development`: heading to an end through stages;
  - `event`: it happens at a time;
  - `condition`: a standing arrangement.

  The census says whether a chain is told mostly in nouns or in verbs. The chart draws an activity or
  a development with round ends.
- **Steps that make, keep and transform.** `on: being`, `on: persistence` and `on: character` (see the
  step table). The chip says *makes*, *unmakes*, *maintains*, *erodes* or *transforms*, never
  *raises*.
- **A cycle.** `form: cycle`, on the block or on a chain, and `settles:`. Whatever the cycle's loops
  pass through counts as reached, and the census does not ask for a cause to run from or an end.
- **A process with no owner.** A state may leave out `actor` where `levels:` places it: a cascade of
  scarcity, the dynamics of boundary making.
- **Constitution.** A claim may carry `constitutes:`, one map or a list, as a claim carries `causes:`:

```argdown
[Policing partly forms the category]: Racial profiling and police brutality "partly form the thick
social position that is the category, Black".
    {fidelity: "quotation", pinpoint: "p. 14",
     constitutes: {from: policing, to: position, extent: partial, whole: organised, basis: account,
                   under: "a thick constructivist account of race"}}
```

| key | value | meaning |
|---|---|---|
| `from` | a state id | What makes the whole up. |
| `to` | a state id, or an **actor** id | The whole. An actor is a group or a system that the ongoing states constitute: a thing as a stability of processes. |
| `extent` | `partial` \| `entire` | Part of the whole, or all of it. |
| `whole` | `aggregate` \| `organised` \| `reducible` \| `mutual` | How the whole stands to what makes it up: no more than their sum; dependent on their organisation ("more than mere aggregation", Martínez-Peña and Ylikoski 2024, p. 10); nothing but them; or, since 1.12, **each making the other**: the parts are what they are only within the whole. |
| `basis` | a step's bases, or `account` \| `definition` | Whether a relation constitutes something may be "a conceptual, and … political, question that is not reducible to data-mining" (Hu, p. 14). |
| `under` | string | The account under which it holds, in the text's words. |
| `stance` | `rejected` \| `unjudged` | On a `#reported` or `#contested` claim, as for a step. |

A constitutive relation is **never a step**. It is never walked, never composed with steps into a
route, never shaded by light and shadow, and never drawn as an arrow. A state that makes something up
carries **⊂** at its foot, and a whole made up of drawn states carries **⊃**; the panel lists each
with its claim. Unlike `part_of`, which is a tree, it may run in a circle: a whole shapes the parts
that make it up. It may also hold beside a step on the same pair. The census reports:
- a pair that is caused and constituted at once in the text's own voice ("do not only reflect and
  reinforce … They … partly form", Hu p. 14);
- a pair read causally in a view the text reports and constitutively in its own (Hu p. 8; the orthodox
  and thick accounts of class, p. 22).

A state goes on as what it constitutes, so it is not a dead end when that whole leads on, is what the
chain is for, or is an actor.

**Relations and possibility (1.12).** Two papers from the process-relational turn in
social-ecological research took 1.11 further:
- Hertz, Mancilla García and Schlüter, "From Nouns to Verbs" (*People and Nature* 2020);
- Hertz, Klein, Mancilla García and Schlüter, "Transforming a World That Never Stands Still"
  (*Ecosystems and People* 2025).

They confirmed that a thing is a sequence of events "upheld by" recurrent processes; 1.11's
`constitutes:` to an actor and `on: persistence` say that. They added four things:

- **Possibility.** A process ontology takes as a core concept the "possibility space" of what can
  happen at a moment, which every event reconfigures. `on: possibility` marks a step that **opens up**
  (`+`) or **closes off** (`-`) the possibility of its `to`: what can happen, not what does. A state's
  `status: possible` says it is a possibility the text sets out, not (or not yet) actual.
  `status: open` says the text holds it cannot be specified in advance. That is Hertz et al.'s
  "surplus", "the virtual", as against the possible, which is read off what things now are. Both
  are drawn hollow and in italic, marked ◌ and … (never dashed: on the chart a pattern means
  fidelity).
- **Mutual constitution.** An emergent whole is not "a simple combination, aggregation or particular
  organization of the individual components" (2020). `organised` still assumes the parts are given;
  `whole: mutual` says the whole and what makes it up make each other. The census names a pair each
  of which constitutes the other as **co-constituted**.
- **Relations of several actors.** Where the text makes a doing or a relation belong to several
  actors at once, `actor:` takes a list; the state runs across all their levels. Their example is
  the ayllu, in which people and land "exist together" (after De la Cadena).
- **Loops that keep themselves in being.** The census names a loop in which every step makes or
  maintains the next. Examples are practices "entangled in that they entail each other and thereby
  keep a given cut in place" (2025, Box 1), and Wimmer's stabilising feedbacks.

**Causal reasoning (1.13).** Johansson, Banitz, Grimm, Hertz, Lindkvist, Martínez Peña,
Radosavljevic, Ylikoski and Schlüter, *A Primer to Causal Reasoning About a Complex World* (2024),
confirmed the line 1.11 drew between cause and constitution: "confusing part-whole relations with
causal relations can lead to confused causal analysis" (p. 97). It added four things a map needs to
say:

- **An association is not a cause.** "Association" is "often mistakenly interpreted as a term for a
  causal relation" (p. 71). A correlation in a population has three possible sources (Reichenbach):
  X causes Y, Y causes X, or they have a common cause.
  - `association: true` on a step says the text reports that the two go together and does not say one
    brings the other about. It is drawn as a brown line with no head, and never walked.
  - The census names any **common cause** the text's own steps draw into both ends.
  - A causal step whose own words say "associated", "correlated" or "linked" is queried.
- **A particular case, or a general relation.** Causation is "primarily a relation between individual
  events", and secondarily between kinds and variables (p. 53). They need different evidence. `scope:
  singular | general` on a step says which. The census lists a general step backed only by an
  `example`, a `case study` or an `anecdote`.
- **What the chain is for.** A study's goal may be to predict, intervene, explain or attribute
  responsibility (p. 112), and it shapes which causes are picked out. `goal:` on the block or a chain
  says which. The census queries `intervene` with nothing to do, and `attribute` with no
  `attribution:`.
- **The contrast.** "The contrast helps to pick up a causal difference-maker" (p. 95): why this rather
  than what. `contrast:` on the block or a chain gives the foil.

`design:` reads `natural experiment`. Two more points need no key:
- **Functional explanation.** A text that explains something by what it does ("X persists because
  it does Y") gives a causal history in disguise (pp. 97–98). Map it as a loop: X brings Y about,
  and Y maintains X (`on: persistence`). If the text names no mechanism for the second step, say so
  in the note: a mechanism named is not a mechanism described (p. 100).
- **Cycles and time.** In a diagram of kinds with feedback "there can be no time line" (p. 102). The
  chart no longer calls a declared cycle's left-to-right order a sequence.

**Stocks, chances and accounts (1.14).** Three papers the Primer draws on added four things.

- **A flow into a stock.** Banitz et al. (2022), "Visualization of causation in social-ecological
  systems" (*Ecology and Society* 27(1):31), note that "+" in a loop diagram can
  mean two things: a proportional change ("moves with") or an additive one ("adds to"). Fish
  reproduction adds to the fish population, yet reproduction may fall while the population still
  rises (Fig. 2B). `on: stock` on a step says
  its `from` is a flow into (`+`) or out of (`-`) its `to`. The chip reads "flows into" or "flows out of", in the inflow and outflow terms of Donella Meadows's *Thinking in Systems* ("drains", the first wording, suited a reservoir better than a waiting list; changed on the author's word, 30 Sep 2026).
  The census names any loop that runs through such a step, because that loop's polarity counts
  flows and its states need not move together.
- **A change in chance.** An arrow cannot say "sometimes", "often" or "always" (Banitz et al.).
  General causation is probabilistic (Primer, p. 49). `on: chance` says the step makes its `to`
  more (`+`) or less (`-`) likely. The chip reads "makes likelier" or "makes less likely".
- **The account of causation.** Hertz et al. (2024), "Eliciting the plurality of causal reasoning in
  social-ecological systems research" (*Ecology and Society* 29(1):14, Table 1), name accounts
  research works with: regularity, manipulability, mechanism, and intra-action, the entanglement of
  causes and effects (after Barad). The Primer adds counterfactual dependence (ch. 4). `account:` on the block or a chain says which. The census holds it against the
  map.
- **An extrapolation.** Martínez Peña et al. (2023), "Analysis of causal argumentation in
  social-ecological systems research", separate a paper's main claims from the claims derived from
  them. One derived claim is an extrapolation from a case. The census lists any step the map holds
  both for a particular case (`scope: singular`) and in general: the general claim needs more than
  the case.

**A missing arrow** means the text does not say. It does not mean there is no effect. This is a
deliberate difference from a causal diagram of a system, in which "no arrow" says there is no
direct causal relationship (Banitz et al. 2022, Fig. 2A). The chart maps what a text says, so its
silence is the text's. A finding of no effect is a `"0"` step, drawn as its own line. The Legend
says so.

**Bridges, and the parallel method (1.15).** A text often makes its case partly *by* setting out a
mechanism. A trial on two texts (James, *The Will to Believe*; Wilson, "What makes a health system
good?") reconstructed each both ways: the argument first and then the mechanism, or both together.
The author judged the parallel maps better. Since 1 October 2026 the parallel method is the one in
force (`parallel-pass.md`), reversibly: one setting brings the series method back whole.

- **A bridge** is an argument whose inference line names a causal scheme, in Argdown's own rule
  slot: `-- From consequences {uses: [1, 2]} --`. Its premises state steps, and it carries the
  mechanism into the argument. The schemes are listed in the registry under `bridges`, each with
  its move and its critical questions:
  - From cause to effect; From effect to cause; From correlation to cause;
  - From cases to a general mechanism; From there to here;
  - From a mechanism to what to do; From consequences; From a mechanism to a possibility;
  - From a mechanism against a theory; From a mechanism to a classification;
  - Genealogical debunking; Vindicatory genealogy; From a genealogy to contingency.

  They are Walton, Reed and Macagno's causal and practical schemes (*Argumentation Schemes*, 2008),
  with four the trial needed, and since 1.16 three more (below). No name contains a comma, because Argdown splits a rule list on
  commas.
- **A bridge is never checked for validity.** It is a defeasible causal move, not a deductive rule,
  so the checker does not ask for its formalization. Instead it queries a bridge none of whose
  premises states a step. The Reasons view draws the scheme's short name in italics, with its move
  and questions on hover; before 1.15 it drew the initials of the name, as for an unknown rule.
- **Where the chain stops and the argument takes it on.** A state the chain leads nowhere from is a
  gap, unless a claim stating the step into it is itself a reason in the argument: a premise, a
  carried conclusion, or the source of a relation. Then the census reports it as `handed`, not as a
  gap.

## 6. The source file

The text a map reads is a Markdown file. Its YAML front matter may carry:

| key | meaning |
|---|---|
| `title`, `author`, `source`, `doi`, `url` | The publication. |
| `licence`, `licence_url`, `rights` | What the text may be used for. A redistributed source carries its licence **in the file**, so that attribution travels with it. |
| `abstract` | The text's own abstract; shown on the orientation panel and quotable like any line. |
| `voice` | For a wholly dramatised text — a satire, a dialogue — the reconstructor's sentence on whose voice the mapped argument is in. |
| `facts`, `facts_source` | For a judgment: the facts of the case, and where they come from. |
| `attribution` | For a pasted text: whose it is. |
| `zotero` | The Zotero attachment key the text was converted from. |

In the body: `<!-- p.N begins here -->` marks where printed page N begins. Back matter —
References, Notes, a bibliography — is kept in the file and never quoted as argument. A book is a
**project file** listing its chapters in order (`chapters:`, optionally grouped under `part:`);
a Quarto `book: chapters:` block is read the same way.

### Quotation matching

A quotation must appear in its chapter **verbatim, after folding** what does not change the
words:

- runs of whitespace, line and paragraph breaks and the non-breaking space, as one space;
- single, double, curly and straight quotation marks and guillemets, as one mark;
- en and em dashes, as a hyphen; the ellipsis character, as three stops;
- Markdown emphasis (`*`, `_`, `` ` ``), backslash escapes and the soft hyphen, as nothing.

Nothing else is forgiven: a quotation that differs in a word is a near miss, and the checker
reports the closest passage. Spans shorter than 10 characters are treated as scare quotes, not
citations.

## Known limits

What this profile cannot yet say, found by reading real texts with it. Each says where it arose and
what to do meanwhile; a limit is named here rather than worked round silently (the project's own
rule: name your gaps).

- **A role changes with the phase of a cycle.** In Wimmer (2008, p. 1010) a boundary feature is an
  outcome in one phase and a condition of the next. Since 1.5 a chain may give a state a role of its
  own, so phases the text sets out as separate questions can be separate chains. Since 1.11 a chain
  may be declared a `cycle`, which is not asked where it starts or ends. A cycle whose phases are not
  separate questions still says *when* a state is which only in the state's `note:`.
- **What the chart is built to see.** A mechanism chart is an instrument, and a noun-and-arrow one.
  It shows well what Arthur (2023) calls allocation: how amounts, levels and rates move one another.
  1.11's `aspect`, `on: being | persistence | character`, `form: cycle` and `constitutes` let it show
  formation too. The reconstructor's first safeguard is not a key: keep the text's verbs in the
  states' labels. "Families send a member to the city" turned into "rural–urban migration" is the
  map doing to the text what Arthur says algebra does to the economy.
- **Theories of change, and principles.** A conventional theory of change assumes "a linear causal
  chain of events that can be traced back to a specific origin". That is the shape the chart draws
  best. Complexity-aware and relational ones are organised around phases, principles or heuristics
  instead (Hertz et al. 2025). A principle that guides action is a claim in the argument map, not a
  step.
- **Who enacts, or benefits from, an arrangement.** `attribution: {type, by}` says whose causing a
  step is. There is no mark for who *benefits* from a state of affairs held in place; say it in the
  argument, or as a step to that actor's state.
- **Constitution is marked, not drawn.** A constitutive relation shows as ⊂ and ⊃ at the feet of the
  boxes and in the panel, not as a line between them. "Counts as" (Hu p. 17: acting on the features
  "is the same as" acting on race) is a third relation, neither causal nor constitutive, and belongs
  to the argument map.
- **Scales, not levels.** `levels` is one list for the whole file, and every chain shares it, as
  does its `ordering` (1.10), which says what the list is but cannot give two chains two orderings. The
  Coleman-boat paper talks of "scales rather than levels", with a macro that "is not a fixed-size
  scale": its deforestation example's local, regional and national endpoints all fall into
  `macro`. Name the scale in the state's label.
- **The Coleman boat's own anatomy** — its corners A to D and its situational, action-formation,
  feedback and transformational arrows — has no mark of its own; roles, levels and the steps carry
  most of it, and the rest goes in notes.
- **A feedback that changes a link.** Since 1.8 a state can block a step (`unless`) or fail to
  (`despite`), and since 1.9 a state can strengthen, weaken or reverse one (`modifies`). A *step*
  still cannot act on another step, and nothing acts on a loop or a whole chain: "the rules of the
  game change", or rapid forcing that "overwhelms" a feedback, is said in words (`given:`, `note:`).
- **A step disputed for one period.** Whether an effect existed at all in one period (Valentino et
  al. on the 1990s implicit-explicit effect) is a rival view's step with a `period`; the census does
  not yet set a period's disputed step beside the text's own.
- **Evidence for a change.** Evidence that each period's effect holds is not evidence that the
  effect changed between them. `design` can say which the text offers, in words; nothing checks it.
- **How settled a mechanism is.** A proposition put forward for testing, a mechanism illustrated,
  and one shown in a case are all steps. `hedged` and `design` say part of it.
- **`part_of` is a tree: a state sits in one box.** Where a text's own diagram puts one concept in two
  boxes — Wimmer's Fig. 2 draws the field's distribution of power and, inside its consensus box, the
  degree of power inequality — make two states, each in its box, with the step between them. One
  state in two wholes would count every step through it twice once the boxes are collapsed.
- **A general mechanism and its instances.** Merton gives one mechanism and illustrates it with the
  bank and with ethnic out-groups. Since 1.6, states of one `kind` make the census find the same
  step in each case, and since 1.7 a kind's `general` state makes the general step the one the
  others are cases of. What remains is a general step whose ends are not states the text names —
  a mechanism stated only schematically — which has no general states to point to.
- **A size, not a dose-response.** Since 1.8 a step carries the size the text gives (`size:`), but
  not how the effect varies with the dose of its cause. A dose-response, or "insufficient but not
  null" (Merton on education), stays in the claim's own words. A finding of no effect is `"0"`.
- **A direction that depends on something unstated.** "Empower (or disempower)" has no single sign.
  Where the text names the condition, make two steps with `given:`; where it does not, leave the
  step unsigned and say why in the note.
- **A threshold in words only.** Since 1.8 a step can say it acts past a threshold, and routes keep
  to one regime. A threshold's value and scale, hysteresis (reversing the cause does not reverse
  the effect), and a balancing loop around whichever state holds (Lenton's circulation) are said in
  words, in `threshold:` or the note.
- **Possibility and probability.** `hedged: true` says the text puts a step as a possibility. Since
  1.14, `on: chance` says a step raises or lowers the chance of its effect. A probability's size, and
  the shape of a relation (a curve, saturation), are still said only in words, in `size:` or the note.
- **A state with no owner** (since 1.11) is placed by its `levels:`. A structural state the text does
  attribute to something ("the social field") still takes that as its actor.
- **A step is a property of the claim that states it.** An objection or a piece of evidence can
  attach to that claim in the argument, never to the step as such, and one step stated by two
  claims is two records joined only by their `from`, `to` and `sign`.
- **Causal language is found by a pattern.** The census's coverage report and the plan's offer of
  the mechanism pass look for causal verbs; a mechanism told as a story (Merton's bank) or reported
  in statistics (a trial's rate ratio) scores low. Both are prompts, not measurements.

## Versioning

**1.16** (1 October 2026) added three bridge schemes, after the parallel-pass trial on four texts
(Wilson 2026, Rogers et al. 2023, Merton 1948), in which these moves recurred with no scheme to
name them:
- **From there to here**: a conclusion established in one setting (a study population, a case, a
  thought experiment, another country) carried to another because the mechanism is shared. Its
  questions are Cartwright's and Shan and Williamson's: is the mechanism of action present here,
  are its support factors, is there a counteracting mechanism here that was absent there.
- **Vindicatory genealogy** and **From a genealogy to contingency**: with Genealogical debunking,
  the three directions Queloz (2021, ch. 9) gives a pragmatic genealogy. A genealogy is vindicatory
  first; the registry had only the subverting direction.

Genealogical debunking keeps its name, so every 1.15 file conforms unchanged; its short label
reads "debunking genealogy". The checker also now reports a key a step or a constitutive relation
cannot carry (it was silently never read), and names the escape when a citation inside a quotation
breaks the parse.

**1.15** (1 October 2026) added, after the parallel-pass trial:
- `method` in the reading policy;
- the registry's `bridges`: causal schemes an inference line may name.

The census also lists bridges, queries a bridge with no step among its premises, and reports where
the argument takes the chain on (`taken_up`). A bridge is exempt from the validity check. The
stock chip reads "flows into" and "flows out of" (Meadows), not "adds to" and "drains". Every 1.14
file conforms unchanged.

**1.14** (30 September 2026) added, after Banitz et al. (2022), Hertz et al. (2024) and Martínez
Peña et al. (2023):
- `on: chance` and `on: stock` on a step;
- `account` on the block and on a chain.

The census also names loops through a stock and extrapolations from a case, and holds the
account against the map. Every 1.13 file conforms unchanged.

**1.13** (30 September 2026) added, after Johansson et al. (2024):
- `association` and `scope` on a step;
- `goal` and `contrast` on the block and on a chain;
- `natural experiment` among the designs.

The census also names common causes of reported associations, and queries a general step from one
case and a causal step in the words of an association. Every 1.12 file conforms unchanged.

**1.12** (30 September 2026) added, after Hertz et al. (2020, 2025):
- `on: possibility` on a step;
- `status` on a state (`actual`, `possible`, `open`);
- `whole: mutual` on a constitutive relation;
- `actor` as a list.

The census also names co-constituted pairs and loops that keep themselves in being. Every 1.11
file conforms unchanged.

**1.11** (30 September 2026) added, for process texts and after Arthur (2023) and Hu (2023):
- `aspect` on a state;
- `on: being | persistence | character` on a step;
- `form` and `settles` on the block and on a chain;
- states with no actor, placed by their `levels`;
- `constitutes:` on a claim: a constitutive relation, never walked, to a state or an actor.

Every 1.10 file conforms unchanged.

**1.10** (30 September 2026) added `ordering` (what kind of ordering the levels are, the
reconstructor's reading unless pinpointed) and `within` (the tree the levels nest in), after James's
comparison of banded and nested charts and Ylikoski (2024) and Craver (2025) on levels. Every 1.9 file
conforms unchanged; the census asks for `ordering:` where a map with levels does not say.

**1.9** (28 September 2026) added, from the fourth wave of gap tests (Marti and Gond 2018, Valentino
et al. 2018, Stone 1989): `modifies` on a step (a moderator that strengthens, weakens or reverses it,
or does not); `necessary` and `sufficient` on a step; `design` on a step; `measures` and `method` on a
state; `attribution` on a step (the type of causing, after Stone); and `stance` on a reported step,
an endorsed report being the author's own claim. The census sets rival accounts of one outcome side by
side. Every 1.8 file conforms unchanged.

**1.8** (27 September 2026) added `regime` and `threshold` on a step, `size` and `share` on a step, `period` and `on: trend` on a step, `unless` and `despite` on a step (a blocker, and a blocker that
failed) and conditions that name a state (`given: [{state, value}]`), grouped by the census where
one pair's steps differ by condition. It also added `via` on a step: the finer route the text opens a whole link into,
walked as that route and once, so that a trial's total effect and its mechanism are no longer read
as a direct route beside an indirect one. This was the first construct taken from the gap tests on
six texts. Every 1.7 file conforms unchanged.

**1.7** (27 September 2026) added `general` on a kind: the state that is the general claim, of
which the kind's other states are cases, so that the census reports a case of a general step, and
a chain that is a case of another, rather than pairing them as equals. Every 1.6 file conforms
unchanged.

**1.6** (27 September 2026) added `kinds:` in the mechanism block and `kind` on a state: the same
kind of state in different cases, never walked as one, with the steps two cases share found by
the census — for the Coleman-boat paper's general migration and its Kenyan case. Every 1.5 file
conforms unchanged.

**1.5** (27 September 2026) added `chains:` in the mechanism block and `chain` on a step: several
chains in one text, each walked and drawn on its own, a chain's roles its own, and the states they
share what couples them — for the Coleman-boat paper's several cases (Martínez-Peña and Ylikoski
2024). Every 1.4 file conforms unchanged.

**1.4** (26 September 2026) added `jointly` on a step and `levels` on a state, for the Coleman
boat's situational and transformational steps (Martínez-Peña and Ylikoski 2024): a macro condition
that works only together with individuals' desires, and an aggregate that is at once micro and
macro. Every 1.3 file conforms unchanged.

**1.3** (26 September 2026) added `echoes`, the other places the text states a claim. Every 1.2
file conforms unchanged.

**1.2** (26 September 2026) added `part_of` on states and the `which` sign, both for multilevel
process theories (Wimmer 2008), whose own diagram groups finer states into boxes and whose
conditions decide *which* strategy follows. Every 1.1 file conforms unchanged.

**1.1** (26 September 2026) added the `condition` role and let `role` be a list — for explanatory
texts, which set out from causes they do not recommend and often run in a circle. Every 1.0 file
conforms unchanged.

The profile is versioned `MAJOR.MINOR`. A **minor** version adds a key, a value or a tag;
every file that conformed still conforms. A **major** version renames or removes one, or changes
a meaning; it says how to carry a file across. The registry and this document change in the same
commit, and `tests/test_profile.py` holds the registry to what the checker and the app actually
read — a key the code reads that the profile does not list, or the reverse, fails the test.

## For Argdown's maintainers

The profile needs nothing from Argdown that Argdown does not already provide, and changes
nothing about how an Argdown file is written or read. What it relies on, so that a change to any
of these would be worth knowing about in advance:

- **front matter** between `===` lines, parsed as YAML and returned by `@argdown/core` as
  `frontMatter` — the app reads it there;
- **`{data}` blocks** on statements, arguments, premise-conclusion lines and inference lines, as
  YAML, carried through to the JSON export under `data`;
- **hashtags** in statement text, and **`isGroup`** on headings;
- **rule names** on inference lines (`-- Modus ponens {uses: [1, 2]} --`);
- **the parser's own records** of every statement — including one with no relations, which the
  map's selection drops: a claim that states a causal step and supports nothing is read from the
  parser's records, not from the drawn map.

Two things would help any tool that layers meaning on Argdown in this way, offered as
observations rather than requests. The CLI's `argdown json` export omits the front matter the
core parser returns, so a tool working from the export has to read the file a second time. And
there is no convention yet for namespacing tool-specific data keys, so two such profiles could in
principle claim the same key for different meanings; this profile's keys are listed in full in
its registry so that a collision would at least be visible.

Comments, corrections and objections are welcome as issues on the Ipsissima repository.

## What the profile is not

It is not a new notation, and it asks nothing of Argdown's users. It is
not a ranking of readings: nothing in it scores an author or a reconstruction. And it is not
closed. Keys are added when a reading needs a distinction the notation cannot carry — the
mechanism keys arrived with the J-PAL and FAST readings of September 2026 — and each arrives with
the reason it was needed.
