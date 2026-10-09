# The mechanism pass — marking the chain a text asserts

> **THE SERIES METHOD.** Since 1 October 2026 the method in force is the parallel one
> (`parallel-pass.md`, served as `mechanism`): the argument and the mechanism are read together, and
> the mechanism enters the argument through bridges. This document is still served, as
> `mechanism-series`, for two reasons. **Its §§2–7, the notation for states and steps, are what the
> parallel method uses unchanged.** And the series method comes back whole if
> `IPSISSIMA_MECHANISM_METHOD=series` is set. Under the parallel method, §1, "What it may and may not
> change", and §4's separate section do not apply.

A SEPARATE PASS, AND ONLY ON REQUEST. It runs when a reader has asked for the mechanism of a text —
"map its mechanism too", or yes to `argdown_plan`'s offer — and never as part of an ordinary
reconstruction. It takes a map that is already finished (`argdown_check` reports `ok` and
`verified`) and adds to it. Ruled 26 Sep 2026.

This document says what to mark and in what notation. How to READ a text's causal claims — their
strength, necessity and sufficiency, moderators, time and size, rival accounts — is the mechanism
cheatsheet, `argdown_method("mechanism-method")`: read it first.

## What it is for

Ipsissima's argument map says what holds a claim up. The Mechanism arrangement says what the text
says **happens**: the chain of steps it sets out from a cause — often the action it recommends — to
the outcomes it cares about; which actors take them, at which levels of social complexity, in what
order, under what conditions; and which of those steps the text actually backs. The chain is in
Gross's sense (Sociological Theory 36, 2018), not Pearl's: steps enacted by actors, loops allowed.

The pass exists because the argument map alone cannot supply the chain. Reconstruction keeps what
serves as a reason for the contention and leaves the rest, and much of a mechanism is the rest:

- an **explanation** that argues nothing — why people are so sensitive to small fees — is left out;
- a step can live only in an **inference**: an arrow from "fewer return to prison" to "less
  pressure on prisons" with no claim stating it;
- a **compression** can fold three steps into one sentence and lose the states between them.

So the pass goes back to the SOURCE. An annotation made from the map alone would report as the
author's gaps what extraction had discarded — the one error Ipsissima exists to prevent.

## What it may and may not change

It may **add**:

1. the `mechanism:` block in the front matter;
2. `causes:` in the metadata of claims that already state a step;
3. **mechanism-only claims**: steps the text states and the argument never needed, each in the
   text's own words, under a section of their own;
4. a claim stating a step the text's own **inference** relies on, marked as an imputation.

It may **not**: change any claim's words, fidelity or tags; add, remove or rewire any support,
attack or undercut among the existing claims; wire a mechanism-only claim into the argument; or
write any `#appraisal`. The argument map must come out of the pass exactly as it went in, apart
from the metadata and the new section — check it with `argdown_check`: the apex, contribution and
interpretive load must be unchanged.

## 1. Read the source again, all of it

Not the map. List every passage that says something brings something about: what the recommended
action will do, why it will, what happens to whom and in what order, what it depends on, and what
goes wrong. Explanatory sections and asides count; footnotes count when they carry the reasoning.

## 2. Declare the cast

```yaml
mechanism:
    question: "How would free distribution raise use of preventive health products?"
    levels: [macro, meso, micro]          # top to bottom; declare the text's own if it has them
    ordering: composition                 # what the levels are (1.10): see below
    actors:
        ngo:       {label: "Governments and NGOs distributing products", level: meso}
        household: {label: "Poor household", level: micro}
    states:
        price:   {label: "User fee charged", actor: ngo, role: intervention}
        takeup:  {label: "Household takes the product up", actor: household,
                  note: "the text's 'take-up', 'adoption' and 'access' read as one state"}
        use:     {label: "Product used", actor: household,
                  measured: "surveyors' observation: nets hung, chlorine in the water"}
        health:  {label: "Health of the household", actor: household, role: outcome}
```

- **Actors** are positions the text names — "the offender", "courts", "employers" — not individuals.
- **A state** is a change in an actor's condition or conduct. Name it as the text does.
- **Deciding which states are one is interpretation.** Where the text uses several words for what
  you take to be one state, say so in the state's `note:`, as above. Where you split what the text
  runs together, say that too. These decisions are where two annotators most often part company.
- **Roles:** `intervention` for the action the text **recommends**; `condition` for a cause the
  text **sets out from without recommending it** — the explanans of an explanatory text (the
  institutional environment of a theory, the situation of a narrative); `outcome` for what the
  chain is **for** — the ends a recommendation serves (health, access, reoffending), or what an
  explanatory text explains — not every state it measures along the way. Take-up, use and cost per
  person are usually steps on the way, not outcomes. Most policy chains have one intervention and
  two to five outcomes; if you are marking more, ask of each what the text says the policy is for.
  A state may take a **list** of roles where it is honestly both: Merton's prejudice is where his
  circle starts (`condition`) and what his remedy is for (`outcome`) — `role: [condition, outcome]`.
  An explanatory text with no recommendation has no intervention, and that is not a gap.
- **`measured:`** when the text says how a state is measured, especially by a proxy it concedes.
- **`part_of:`** where the text itself groups finer states into one: a box in its own diagram that
  several states sit inside (Wimmer's strategies box and the five strategies), or a typology under
  one heading. Declare the whole as a state and each finer state `part_of` it. NOT for a general
  mechanism and the cases it is illustrated by (Merton's bank and his out-groups): those are
  `kinds:` with a `general:` state (below), since a case is not a part of the general claim. The view then opens
  at the text's own boxes, with every state one click away. Do not invent a whole the text does not
  draw or name.
- **`levels:`** on a state that holds at more than its actor's level: an aggregate that is at once
  many individuals' belief and a fact about the society (the Coleman boat's transformational step),
  a consensus negotiated between individuals that holds as the field's. `levels: [macro, micro]`
  draws it across both. Its `actor` stays the one that holds it. Use it where the text says the
  state is at both levels, not merely that it is caused at one and felt at another — that is a step.
- **`chains:`** where the text answers SEVERAL questions, each with a chain of its own: a paper
  that works through several cases (the Coleman-boat paper's drought and migration, its
  fisheries, its segregation model), or a theory whose phases the text sets out as separate
  questions. Declare each with a `label` and the `question` it answers, and mark every step with
  `chain: <id>` (a list, for a step two chains share). Where a state one chain explains is where
  another begins, give it that role in the second: `roles: {forest: condition}`. One question
  with one chain needs none of this. Do not split a single argument into chains to make a busy
  diagram smaller — a chain is a question the TEXT answers apart.
- **`kinds:`** where the same KIND of state recurs across cases the text keeps apart: a general
  claim about rural–urban migration and a case of herders' migration; forest cover in one study
  and in another. Declare the kind once, and give each such state `kind: <id>`. Keep them two
  states: making them one would walk from the case into the general claim, a step the text never
  takes. Use a kind only where the text itself treats the two as the same kind of thing — the
  same word is not enough. Where one of them is the text's GENERAL claim and the others cases of
  it (a general mechanism and the examples it is illustrated by), name it: `general: <state>`.
  Leave it out where the cases are equals.
- **Levels** default to macro, meso and micro. A text with its own levels — a multilevel theory
  that names individuals, networks, organisations, the state, the field — declares them, top first.
- **Say what the levels are** (*1.10*): `ordering:` is `composition` (parts within wholes), `space`
  (regions within regions), `authority` (a chain of command), `scale` (larger and smaller, without
  containment), `sequence` (a food chain, a supply chain), `systems` (separate systems acting on one
  another), `mixed`, or `unstated` where the text orders its levels without saying by what. It is
  your reading unless the text says it: then `{kind, pinpoint}`. Where the levels nest, `within:`
  gives each its parent, as a tree — `{elites: nation, citizens: nation}`, never read off the order of
  the list — and the list puts each level's parts straight after it. If you cannot tell what the
  levels are doing, write `unstated` and say so to the user: that is a finding about the text.
- **Keep the text's verbs** (*1.11*). Where the text says what happens as a doing — "families send a
  member to the city", "patients wait in ambulances" — label the state with the verb, not a noun
  ("rural–urban migration", "ambulance waiting times"). Where the text's own grammar makes it clear,
  give it `aspect:`:
  - `quantity`: an amount, level or rate;
  - `activity`: ongoing, and complete at every moment;
  - `development`: heading to an end through stages;
  - `event`: it happens at a time;
  - `condition`: a standing arrangement.

  Leave `aspect:` out where you would be guessing.

  **But not on a loop that runs either way** (*1.19*). Where the text says a loop can run in both
  directions -- Meadows's coffee cools or warms toward the room, and she labels her states "stored
  energy in body", not "low energy level" -- give the state a label without a direction, and give a
  flow that runs whichever way the gap points `on: stock, net: true` (with `sign: which`).
- **A cycle** (*1.11*). Where the text describes a cycle of reproduction and transformation rather
  than a chain from causes to ends — Wimmer's boundary making, iterative improvement — declare
  `form: cycle`, on the block or on the chain. Add `settles: true` or `false` only where the text says
  whether it comes to rest.
- **What the chain is for, and against what** (*1.13*): `goal:` is `explain`, `intervene`, `predict`
  or `attribute` (responsibility), where the text makes it plain. `contrast:` gives the foil its
  question sets ("why here, rather than there").
- **How the text reasons about causes** (*1.14*): `account:` is `regularity` (regular succession),
  `manipulability` (change the cause and the effect changes), `mechanism`, `counterfactual` (what
  would have happened otherwise) or `intra-action` (relations that make what they relate). Give it,
  as a list if need be, only where the text's method or theory makes it plain. The checker holds
  `manipulability` to an experimental `design:` and `intra-action` to a `constitutes:`.
- **Possibility** (*1.12*):
  - a step that opens up or closes off what *can* happen is `on: possibility` (`+` or `-`);
  - a state the text sets out only as a possibility (an option, a path not yet taken) is
    `status: possible`;
  - an outcome the text says cannot be specified in advance is `status: open`.

  Do not mark a merely hedged step this way: `hedged: true` says the text is unsure whether the step
  holds; `possible` says the state itself is not actual.
- **Several actors together** (*1.12*): where the text makes a doing or a relation belong to several
  actors at once — people and land, fishers and their species — give `actor:` a list.
- **A process with no owner** (*1.11*): a cascade, a flow, the dynamics of a field. It may leave out
  `actor` and give `levels:` instead. Where the text does attribute it to something, use that as its
  actor.
- **What the states are told as** (*1.18*). Where the text defines the kind of thing nearly every
  state is ("I use the idea of a flow … to refer to a process by which inputs are transformed into
  outputs"), give it once on the block, as `idiom: {term, means, pinpoint}`. Never make it a state:
  no step reaches it, and the chart draws only what a step touches.
- **What a state's own keys add** (*1.19*), each only where the text says it:
  - `behaviour:` the behaviour over time the text says a state follows -- `grows`, `declines`,
    `levels off`, `s-shaped`, `oscillates`, `overshoot and collapse`, `steady` (Meadows's "inventory
    oscillates", "the population levels off"). It is drawn as a sketch, so it is no graph of numbers.
  - `observed: false` where the text says a state is unobserved (Knight and Winship's U*, Bias*).
  - `dead_end: true` on an outcome the text sets out as stopping the process short (Marti and Gond's
    symbolic use of a theory, which "will not lead to effective performativity"). Give it the step
    that leads to it, so it is drawn; the checker then does not ask why it leads nowhere.
  - On a chain, `conditioned:` the states its analysis holds fixed, and a list inside the list for
    states the text says cannot be held fixed apart: `conditioned: [hours, [policy, care]]`.
  - On a chain or the block, `boundary: {says, pinpoint}` only where the text itself draws attention
    to where its system stops -- that the line is drawn by choice, or that things outside it act on
    what is inside. Quote it. Every system has a boundary; do not set the key because yours does.
- **The kinds of link** (*1.19*). Where the text tells kinds of link apart and the difference is its
  point -- the Coleman-boat paper's ecological against social mechanisms, Rena et al.'s signalling
  against metabolic conversion -- declare them once, `channels: {eco: {label: "ecological"}}`, in its
  words, and mark each step with `channel:`. Not for a distinction you are making yourself.
- **What the text keeps apart** (*1.18*). Where a chain meets no other, or its steps fall into pieces
  that meet at no state, and the text keeps them apart (a contrast case, separate examples), say why
  in `apart:` on the chain (or on the block, for a map with no chains). First look for a link the
  text makes; see `parallel-pass.md`, *What meets*.

## 3. Mark the steps

**Names, numbers, shapes** (*1.19*). Where the text names a step -- the kind of mechanism it is
("situational", "transformational"), the question it asks, the feedback it is ("path dependency") --
give `name:` in its words; where it numbers its steps (Marti and Gond's P1 to P9, Rena's 1 to 10),
`mark:`. A relation the text says rises and then falls ("scarcer fish don't breed much, nor do
crowded fish") is `shape: peak` (or `trough`), with no sign.

**Making, keeping and changing in kind** (*1.11*). A step that brings its effect into being or ends
it is `on: being` (`+` makes, `-` unmakes). One that keeps its effect going or wears it away is
`on: persistence` (`+` maintains or reproduces, `-` erodes). One that changes what kind of thing its
effect is, is `on: character` with `sign: which`. Use these where the text's verb is *produce,
create, maintain, sustain, reproduce, erode, transform*: "raises" would turn the verb into a noun.

**An association is not a step** (*1.13*). Where the text reports only that two things go together
("associated with", "correlated with", "linked to"), mark `association: true`. The checker queries a
causal step in those words. Mark the step as causal only if the text says one brings the other about.
Say whether a step is about a particular case or a general relation (`scope: singular | general`)
where the difference matters: a general claim needs more than one case.

**Stocks and chances** (*1.14*). Where the `from` is a flow into or out of the `to`, mark
`on: stock`: births *flow into* a population (`+`), a catch *flows out of* it (`-`), an inflow and an outflow in Meadows's terms. The stock need not move
with the flow, so a loop through it says less than its sign suggests, and the census names such
loops. Where the text says the step raises or lowers the *chance* of its effect ("raises the risk
of", "makes more likely", "tends to"), mark `on: chance`.

**An extrapolation** (*1.14*). If the text finds a step in one case and then claims it in general,
mark both, with `scope: singular` and `scope: general`. The census lists the pair: the general claim
is derived and needs more than the case.

**A functional explanation is a loop** (*1.13*). "X persists because it does Y" means X brings Y
about and Y maintains X (`on: persistence`). If the text names the second step's mechanism without
describing it, say so in the note.

**Constitution is not a step** (*1.11*). Where the text says something *constitutes*, *partly
forms*, *makes up* or *defines* something else, mark it with `constitutes:`, never with `causes:`:
`{from, to, extent, whole, basis, under}`. Its `to` may be an actor, such as a group or a system the
states make up. A text may say one pair is related both ways at once (Hu: policing does "not only
reflect and reinforce" racial injustice but "partly form[s]" the category). Then mark both, a
`causes:` and a `constitutes:` on the same claim. Moving between scales by "zooming out" (the macro
outcome *is* the micro conduct seen at a larger scale) is constitution, `whole: aggregate` or
`organised`, not a step. Where the text says the whole and its parts make each other (the parts
are what they are only within the whole), use `whole: mutual`, and mark both directions if the text
says both. "Counts as" (acting on X is acting on Y) is neither: leave it to the
argument map.

On a claim that states a step, add `causes:` — one map, or a list when the claim states several:

```argdown
[Small fees cut take-up]: Relative to free distribution, "charging even very small user fees
substantially reduces adoption".
    {fidelity: "compression", pinpoint: "p. 1",
     causes: {from: price, to: takeup, sign: "-", basis: study}}
```

| field | says |
|---|---|
| `from`, `to` | declared states |
| `sign` | `+` or `-`; `"0"` where the text finds **no effect** (below); `which` where the step **decides which** of several alternatives follows — institutions that "determine which" strategy actors pursue — rather than raising or lowering a quantity |
| `basis` | what the TEXT offers for the step: `study` (a study or trial it reports), `statistics` (data it cites), `model` (a model's estimate), `example` (a case or a country), `testimony` (an authority's word, a consensus), `asserted` (nothing) |
| `lag` | timing the text states: `"within five years"` |
| `given` | conditions the text states, in its words: `["as part of a broader rehabilitation agenda"]` |
| `how` | Gross's decomposition, **only where the text gives it**: `{actor, situation, habit, response}` |
| `reflexive` | `true` where the step runs through a classification, a prediction or a model the step itself acts on |
| `selects` | `true` where the link holds because of WHO ends up on each side, not because one brings the other about (below) |
| `hedged` | `true` where the text puts the step as a possibility — "fees *may* worsen targeting" |
| `jointly` | states the step holds **only together with**: `jointly: [desire]` where belief moves people to act "only where they wish to fit in" |
| `period` | when the step holds, in the text's words anchored to an event: `"after culling ended"` |
| `on` | `trend` where the step moves the trend of its `to`, not its level: the levy slowed obesity's rise |
| `unless` | a state that **blocks** the step where it holds: `unless: defence` on hazard → harm |
| `despite` | a state that acted against the step and **failed**: `despite: culling` |
| `regime` | the regime the step holds in, in the text's words: `"at clinical doses"`, `"outside the cull zone"` |
| `threshold` | the threshold the step acts past, in the text's words: `"above about 3°C of local warming"` |
| `size` | the magnitude the text gives, quoted: `"a third of the cost"`, or `{value: -1.6, unit: "percentage points", ci: "95% CI -2.3 to -0.9", versus: "the counterfactual", at: "Nov 2019"}` |
| `share` | with `via`: how much of the step runs by the route, `entire` (the default), `most`, `partial` or `none` |
| `via` | the finer route the text opens this link into, in order: `via: [reform, sugar]` where the levy's effect on obesity runs through reformulation and sugar bought |
| `modifies` | a state that **moderates** the step: `{by: backers, effect: strengthens}`; `weakens`, `reverses`, or `"0"` where the text finds it does not moderate it |
| `necessary` | `true` where the text says the effect holds **only if** the cause does: "only when", "sine qua non" |
| `sufficient` | `true` where the cause (with its `jointly` co-causes) brings the effect about **on its own**; `false` where the text says it is **not enough** alone |
| `design` | the design of the evidence, in the text's words: `experiment`, `replication`, `anecdote`, `case study`, `illustration` (a hypothetical case) |
| `attribution` | the **type** of causing the step attributes: `intentional`, `inadvertent`, `mechanical`, `accidental`, `complex`; as `{type, by: actor}` to say whose |
| `measured_by` | the measure the step's evidence is read from (a state with `measures`) |
| `stance` | on a `#reported` or `#contested` step: `rejected` or `unjudged` |

- **A joint cause is one step, not two.** Where the text says two things bring something about only
  together — a belief and a desire, a rule and the means to enforce it, an opportunity and a motive —
  mark the step from one with `jointly:` naming the others. Two separate steps would say each is
  enough alone. Where the text gives the second only as a qualification in words ("in a tight labour
  market"), it is a `given:`, not a state. Pick as `from` the cause the text leads with.
- **Time is not only a lag.** Where the text reports one step in two periods (an effect during an
  intervention, none after it), mark each record with its `period:`, in the text's words anchored to
  the event. Where a finding is a change of trend ("slowed the rise", "a dampening of the rate of
  increase rather than a reversal"), give the step `on: trend`: a plain `-` would say the level fell.
- **Keep a regime's steps to their regime.** Where the text says a mechanism runs only at a dose,
  in a place or in one model, give each such step its `regime:` in the text's words. The census will
  not compose a route across two regimes. Where a step acts only past a threshold, say so in
  `threshold:`; a plain sign would say the effect grows smoothly with its cause.
- **Give the size the text gives.** Where the text reports how much, put it in `size:` in its
  words or as an estimate with its interval and comparison. Two texts that agree on the direction and
  dispute the size draw as agreement without it. Where a link runs only partly through a state, say
  `share: partial` beside its `via`; where the text says it does not run through a state at all,
  `share: none`.
- **A blocker is not a second cause.** Where the text says X brings about Y *unless* D holds (the
  defences between a hazard and harm), mark X → Y with `unless: D`, not a separate D → Y step. Where
  it says the step held *despite* D, use `despite: D`: `given:` would say the step holds only where D
  holds. A knockout, a subgroup or a place can be a condition that names a state:
  `given: [{state: ampk, value: absent}]`. Mark each subgroup's finding as its own step with its
  condition, and the census groups them.
- **A link the text opens is one route, not two.** Where the text states a link whole (a trial's
  total effect, "metformin lowers glucose") and elsewhere says how it runs ("mediated entirely by
  AMPK"; reformulation, then less sugar bought), mark the finer steps and give the whole link
  `via:` naming the states between, in order. Without it the whole link reads as a direct route
  beside the finer one, which is partial mediation the text never claims. Where the text says the
  link runs only partly through a state, leave out `via` and say so in the note.
- A claim tagged `#reported` keeps its tag: its steps are the rival view's, drawn apart.
- **A finding of no effect is a step with `sign: "0"`**, with the basis the text gives it. A policy
  text's central results are often nulls — paying does not raise use; fees do not target the needy —
  and they are usually aimed at a rival view's step on the same pair of states. Mark both: the rival's
  `+` on its `#reported` claim, the text's `"0"` on the claim that reports the finding. The
  arrangement draws the null apart, without an arrowhead, and the census reports it against the rival
  step it answers. A null carries nothing: it is never walked as part of the chain.
- **A selection effect is not a step.** Where an association holds because of who ends up on each
  side — charging screens out households that were unlikely to use the product anyway, so owners who
  paid use it more — mark `selects: true` on it. It is reported and drawn apart, and never walked. The
  text usually says which it is ("a screening effect"); where it does not, mark the step as the text
  presents it and say in the claim's `note:` that it could be selection.
- **Two findings with opposite signs on one pair of states are two steps** — fee → use `+` among
  owners (screening, or given a condition) and `-` overall. Mark both; state the condition in `given:`.
  They are counted apart.
- **A moderator changes a step; it is not a cause of the step's end.** Where the text names the
  moderator as something the chain has — "powerful initial backers moderate the relationship between a
  new theory and experimentation" — declare it as a state and put `modifies: {by: backers, effect:
  strengthens}` on the step it moderates. Where the text finds that something does *not* moderate a
  step, that is a finding too: `effect: "0"`. Where the moderator is only a qualification in words
  ("demand fell less steeply when households had time to pay"), it stays a `given:` on the step. Mark
  it as a cause of its own only where the text says it brings something about in its own right.
- **"Only if" is not "raises".** "Problems arise only when conditions are seen as changeable" is a
  necessary condition: mark the step `necessary: true`. Where the text denies that a cause is enough
  ("necessary, but not sufficient"; "may help; it will not guarantee"), add `sufficient: false`. Where
  it says a set of conditions together brings the effect about, mark one step with `jointly:` naming
  the rest and `sufficient: true`. Where a list of conditions ("more likely if …, if … and if …")
  leaves open whether they act separately or only together, read it as conjoint: one step, the rest
  `jointly`, and say in the claim's `note:` that the text leaves it open. Separate steps only where
  the text says each works alone.
- **Say how the text knows, in its words.** `basis` is the kind of backing; `design` is the design:
  a randomised experiment, a replication, a re-reading of someone else's case, an anecdote. A
  **hypothetical** example ("imagine a manager who …") is `design: illustration`: it shows how a step
  could go, not that it does, and it is shaded as asserted. Where the evidence is for each period and
  not for the change between them, say so in `design:` in the text's words.
- **A measure is not a cause.** Where the text reports a state through a measure — a survey score, an
  estimate computed by a model, a marker — and the measure matters to the argument (a method's
  artefact, a critique that the estimate is biased), declare the measure as its own state with
  `measures: <state>` and `method:`. Steps into the measure are claims about the measurement. Never
  draw a step from the measure to what it measures. Give the step whose evidence the measure carries
  `measured_by: <measure>`, so that a bias in the measure bears on that step.
- **Say where the text stands on a story it reports.** A `#reported` step is a view the text sets
  out; `stance:` says whether it sets it out to reject it or leaves it unjudged. A report the author
  endorses is her own claim: drop `#reported` and write it in her voice, `hedged: true` where the
  reporting works as a hedge. For a text about blame, harm or
  responsibility, give each step its `attribution:` — the type of causing it attributes. Rival stories
  of one harm often differ only in that; name whose action or intention it is, `{type, by: actor}`,
  and where rival stories share a state, give each story its own chain so each can be drawn alone.
- **Hedged steps.** A step the text puts as a possibility ("may", "might", "could") is the text's own,
  marked `hedged: true`. A step the text sets out only to reject is the rival's (`#reported`).
- Where two groups respond differently to the same situation — heavy drinkers cut down, dependent
  drinkers cut food instead — mark two steps from the same state, with `how:` naming each actor.
  Do not invent a "moderator" state.

## 4. Add what the argument never needed

A step the text states and no claim carries gets a claim of its own, under

```argdown
# The mechanism, as the text states it {isGroup: true}

[Cash constrains purchase]: "a lack of cash on hand explains at least part of the drop in demand
seen with user fees"
    {fidelity: "quotation", pinpoint: "p. 8",
     causes: {from: cash, to: takeup, sign: "+", basis: study}}
```

Quote the text: these claims are verified like every other. They support nothing and attack
nothing, which is right — they are the chain's material, not the argument's, and the checker counts
them apart. Argdown leaves them off the Reasons map; the Mechanism arrangement draws them.

## 5. Steps carried by an inference

Where the text's own inference relies on a causal step no claim states — the argument runs from "fewer
reoffend" to "less pressure on prisons" and nothing says reoffenders fill the prisons — add a claim
stating it, `fidelity: "imputation"`, `warrant: "enthymeme"`, in the mechanism section. **Only**
where the text's inference relies on it.

## 6. Never close a gap to complete the chain

The checker reports where the text's chain stops, where an outcome is never reached, and where the
recommended action is linked to nothing. **Those are findings about the text.** A step the text does
not state and its argument does not need stays out, however obvious. Closing it would turn the
author's gap into the reconstructor's invention — and a reader asking what the text shows could no
longer tell.

The reconstructor's own view of the chain — a confounder, a loop the text leaves open, how a policy
would actually reach the people it names — is the **appraisal**, a separate request, written as
`#appraisal` claims. Not in this pass.

## 7. Check, and read the coverage

Run `argdown_check` with `source_root` until `ok` and `verified`. Then read the CHAIN section of the
census:

- **the profile** — steps, levels, lags, routes, loops — and **light and shadow**: how many steps the
  text backs with a study, statistics or a model;
- **the gaps**, which you leave;
- **the nulls and selection links**: each null should face the rival step it answers, where there is
  one;
- **the coverage**: the sentences in the text that use causal language and that no step QUOTES. Those
  sharing a paragraph with a step are marked `*` and counted apart, never as covered: a converted
  source can run a whole page as one paragraph. They are candidates, not faults. For each: does it state a step the chain lacks? If it
  does, mark it (§3 or §4). If it states none — a "because" in a methods paragraph, "increasing" as a
  mere description — leave it.

Then report back: the profile, the gaps, how much of the text's causal language the chain covers,
and the decisions about which states are one.

## For a dense, multilevel text

Annotate section by section, and declare the text's own levels. Expect many actors, loops that
return through institutions, and strategies that are alternatives rather than steps; mark each
alternative as its own step from the same situation. Keep `how:` for where the text actually says
what an actor faces and does — in a text of that kind it usually does, and that is where the chain
becomes intelligible.
