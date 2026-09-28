# The Ipsissima profile for Argdown

**Version 1.9 — 28 September 2026.** The machine-readable registry of everything below is
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
| `actors.<id>` | `{label, level}` | A position the text names — "courts", "the household" — at one of the levels. |
| `kinds.<id>` | `{label, general}` | A kind of state that recurs across cases — rural–urban migration, forest cover — named so that states in different cases can say they are of it (*added in 1.6*); `general` names the state that is the general claim, the others being its cases (*1.7*). |
| `states.<id>` | `{label, actor, role, measured, appraisal, note, part_of, levels, kind, measures, method}` | A change in an actor's condition or conduct. `role` is `intervention` (what the text recommends doing), `condition` (a cause it sets out from without recommending it — the explanans of an explanatory text; *added in 1.1*) or `outcome` (what the chain is for, or what the text explains) — or a **list** of these, for a state that is both, such as where a circle starts and what a remedy is for (*1.1*). The chain starts from its interventions and conditions. `measured` says how the text measures it; `appraisal: true` makes it the reconstructor's own state; `note` records which of the text's words were read as one state; `part_of` names a larger state it is a part, facet or instance of (*1.2*); `levels` lists the levels a state holds at when it holds at more than its actor's (*1.4*); `kind` names the declared kind it is a case of (*1.6*); `measures` names the state it is a measure, indicator or estimate of, and `method` how the measure is taken (*1.9*). |

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
| `on` | `level` \| `trend` | Whether the step moves the **level** of its `to` (the default) or its **trend**: the levy slowed obesity's rise rather than lowering it (*added in 1.8*). |
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
| `design` | string | The **design** of the evidence, in the text's words; `experiment`, `replication`, `quasi-experiment`, `observational`, `case study`, `illustration`, `anecdote`, `review` and `simulation` are read. An `illustration` is a hypothetical case (*added in 1.9*). |
| `attribution` | `intentional` \| `mechanical` \| `inadvertent` \| `accidental` \| `complex` | The **type of causing** the step attributes (*added in 1.9*). |
| `stance` | `rejected` \| `unjudged` \| `endorsed` | On a `#reported` or `#contested` step: where the text **stands** on the view it reports (*added in 1.9*). |

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
Whether a list of conditions is independent or conjoint is the reconstructor's reading; where the
text leaves it open, say so in a `note`.

**Evidence and measurement (1.9).** `basis` says what kind of backing a step has; `design` says how,
in the text's own words: a randomised experiment, a replication, an anecdote, a case the text re-reads.
`design: illustration` marks a **hypothetical** case, which shows how a step could go and not that it
does: it is shaded as asserted, never as an example. A state may be a **measure** of another:
`measures: priming, method: "the attitude battery after the treatment"`. Nothing is walked from a
measure to what it measures, and a measure is no dead end. A step into a measure is a claim about
the measurement, which is where a method's artefacts belong (Valentino et al.'s timing experiment;
a crown volume computed from height).

**Rival accounts (1.9).** A text of rival accounts reports them to reject them, to set them out
without judging, or, sometimes, to endorse one. `stance: rejected | unjudged | endorsed` on a
`#reported` or `#contested` step records which. An endorsed step is walked as the text's own too.
Where an outcome has two or more accounts from different claims, and at least one is reported, the
census sets them side by side: each account, whose it is, its stance and type, and any story that
opens its cause. The view shows the same list on the outcome's panel. `attribution` records the
**type** of causing a step attributes, after Stone (1989): `intentional` (purposeful action, intended
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
  own, so phases the text sets out as separate questions can be separate chains; a single cycle
  whose phases are not separate questions still says *when* only in the state's `note:`.
- **Scales, not levels.** `levels` is one list for the whole file, and every chain shares it. The
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
- **Possibility, not probability.** `hedged: true` says the text puts a step as a possibility;
  there is no field for a probabilistic claim ("tends to", "raises the chance of").
- **Every state needs an actor.** A structural state — "the social field" — has to be given one;
  declare the field itself as an actor at its level.
- **A step is a property of the claim that states it.** An objection or a piece of evidence can
  attach to that claim in the argument, never to the step as such, and one step stated by two
  claims is two records joined only by their `from`, `to` and `sign`.
- **Causal language is found by a pattern.** The census's coverage report and the plan's offer of
  the mechanism pass look for causal verbs; a mechanism told as a story (Merton's bank) or reported
  in statistics (a trial's rate ratio) scores low. Both are prompts, not measurements.

## Versioning

**1.9** (28 September 2026) added, from the fourth wave of gap tests (Marti and Gond 2018, Valentino
et al. 2018, Stone 1989): `modifies` on a step (a moderator that strengthens, weakens or reverses it,
or does not); `necessary` and `sufficient` on a step; `design` on a step; `measures` and `method` on a
state; `attribution` on a step (the type of causing, after Stone); and `stance` on a reported step,
with an endorsed step walked as the text's own. The census sets rival accounts of one outcome side by
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
