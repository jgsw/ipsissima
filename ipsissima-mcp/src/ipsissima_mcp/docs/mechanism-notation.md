# The mechanism notation — states, steps, and what the census reports

The notation both mechanism methods use: how a text's cast (actors, states, levels, chains) is
declared in the `mechanism:` block, how a claim marks the step it states (`causes:`), and how the
census reads the result. How to READ a text's causal claims before marking them is
`mechanism-method`; how the mechanism enters the argument is `mechanism` (the parallel method, in
force) or `mechanism-series`.

## What it is for

Ipsissima's argument map says what holds a claim up. The Mechanism arrangement says what the text
says **happens**: the chain of steps it sets out from a cause — often the action it recommends — to
the outcomes it cares about; which actors take them, at which levels of social complexity, in what
order, under what conditions; and which of those steps the text actually backs. The chain is in
Gross's sense (Sociological Theory 36, 2018), not Pearl's: steps enacted by actors, loops allowed.

## 1. Declare the cast

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
        cash:    {label: "Household has cash on hand", actor: household}
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
- **A Coleman boat** — the macro-micro-macro diagram, and any text that argues by it — has its own
  drawing: read `argdown_method("coleman")`.
- **`chains:`** where the text answers SEVERAL questions, each with a chain of its own: a paper
  that works through several cases (the Coleman-boat paper's drought and migration, its
  fisheries, its segregation model), or a theory whose phases the text sets out as separate
  questions. Declare each with a `label` and the `question` it answers, and mark every step with
  `chain: <id>` (a list, for a step two chains share). One question with one chain needs none of
  this. Do not split a single argument into chains to make a busy
  diagram smaller — a chain is a question the TEXT answers apart.
- **`kinds:`** where the same KIND of state recurs across cases the text keeps apart: a general
  claim about rural–urban migration and a case of herders' migration; forest cover in one study
  and in another. Declare the kind once, and give each such state `kind: <id>`. Keep them two
  states: making them one would walk from the case into the general claim, a step the text never
  takes. Use a kind only where the text itself treats the two as the same kind of thing — the
  same word is not enough. Where one of them is the text's GENERAL claim and the others cases of
  it (a general mechanism and the examples it is illustrated by), name it: `general: <state>`.
  Leave it out where the cases are equals. (A state's `kind:` names one of these; a frame's `kind:`,
  in the tables, says what sort of frame it is. The two are unrelated.)
- **Levels** default to macro, meso and micro. A text with its own levels — a multilevel theory
  that names individuals, networks, organisations, the state, the field — declares them, top first.
- **Say what the levels are**: `ordering:` is `composition` (parts within wholes), `space`
  (regions within regions), `authority` (a chain of command), `scale` (larger and smaller, without
  containment), `sequence` (a food chain, a supply chain), `systems` (separate systems acting on one
  another), `mixed`, or `unstated` where the text orders its levels without saying by what. It is
  your reading unless the text says it: then `{kind, pinpoint}`. If you cannot tell what the levels
  are doing, write `unstated` and say so to the user: that is a finding about the text.
- **Keep the text's verbs**. Where the text says what happens as a doing — "families send a
  member to the city", "patients wait in ambulances" — label the state with the verb, not a noun
  ("rural–urban migration", "ambulance waiting times"). Where the text's own grammar makes it clear,
  give it `aspect:`:
  - `quantity`: an amount, level or rate;
  - `activity`: ongoing, and complete at every moment;
  - `development`: heading to an end through stages;
  - `event`: it happens at a time;
  - `condition`: a standing arrangement.

  Leave `aspect:` out where you would be guessing.

  **But not on a loop that runs either way**. Where the text says a loop can run in both
  directions -- Meadows's coffee cools or warms toward the room, and she labels her states "stored
  energy in body", not "low energy level" -- give the state a label without a direction, and give a
  flow that runs whichever way the gap points `on: stock` with `sign: which`.
- **A cycle**. Where the text describes a cycle of reproduction and transformation rather
  than a chain from causes to ends — Wimmer's boundary making, iterative improvement — declare it as
  a chain with `form: cycle` (one chain, where the whole map is the cycle). Add `settles: true` or
  `false` only where the text says whether it comes to rest.
- **What the chain is for, and against what**: `goal:` is `explain`, `intervene`, `predict`
  or `attribute` (responsibility), where the text makes it plain. `contrast:` gives the foil its
  question sets ("why here, rather than there"). The block's `question:` is the one question its
  chain answers, in words. It is not the question layer (`questions:` in the front matter, and a
  claim's `question: {id, move}`; the conventions, §6), though where the chain answers one of the
  text's declared questions it should use the same words.
- **Possibility**: a step that opens up or closes off what *can* happen is `on: possibility` (`+` or
  `-`). Do not mark a merely hedged step this way: `hedged: true` says the text is unsure whether the
  step holds.
- **Several actors together**: where the text makes a doing or a relation belong to several
  actors at once — people and land, fishers and their species — give `actor:` a list.
- **A process with no owner**: a cascade, a flow, the dynamics of a field. It may leave out
  `actor` and give `levels:` instead. Where the text does attribute it to something, use that as its
  actor.
- **What the states are told as**. Where the text defines the kind of thing nearly every state is
  ("I use the idea of a flow … to refer to a process by which inputs are transformed into outputs"),
  say so once, in the mechanism's `question:` or a state's `note:`. Never make it a state: no step
  reaches it, and the chart draws only what a step touches.

**When the text says more**, read `argdown_method("rarer-marks")`: where its levels nest; where one
state plays different roles in two chains; where a state is only a
possibility, or an outcome the text says cannot be specified in advance; where it says when a step
holds, what blocks it, or the regime or threshold it holds in; where it reads a state through a
measure; where a step runs through a prediction or a classification it acts on; and where it says
what an actor faces and does (Gross's decomposition).

## 2. Mark the steps

**Making, keeping and changing in kind**. A step that brings its effect into being or ends
it is `on: being` (`+` makes, `-` unmakes). One that keeps its effect going or wears it away is
`on: persistence` (`+` maintains or reproduces, `-` erodes). One that changes what kind of thing its
effect is, is `on: character` with `sign: which`. Use these where the text's verb is *produce,
create, maintain, sustain, reproduce, erode, transform*: "raises" would turn the verb into a noun.

**An association is not a step**. Where the text reports only that two things go together
("associated with", "correlated with", "linked to"), mark `association: true`. The checker queries a
causal step in those words. Mark the step as causal only if the text says one brings the other about.
Say whether a step is about a particular case or a general relation (`scope: singular | general`)
where the difference matters: a general claim needs more than one case.

**Stocks and chances**. Where the `from` is a flow into or out of the `to`, mark
`on: stock`: births *flow into* a population (`+`), a catch *flows out of* it (`-`), an inflow and an outflow in Meadows's terms. The stock need not move
with the flow, so a loop through it says less than its sign suggests, and the census names such
loops. Where the text says the step raises or lowers the *chance* of its effect ("raises the risk
of", "makes more likely", "tends to"), mark `on: chance`.

**An extrapolation**. If the text finds a step in one case and then claims it in general,
mark both, with `scope: singular` and `scope: general`. The census lists the pair: the general claim
is derived and needs more than the case.

**A functional explanation is a loop**. "X persists because it does Y" means X brings Y
about and Y maintains X (`on: persistence`). If the text names the second step's mechanism without
describing it, say so in the note.

**Constitution is not a step**. Where the text says something *constitutes*, *partly
forms*, *makes up* or *defines* something else, mark it with `constitutes:`, never with `causes:`:
`{from, to, extent, whole, basis}`. Its `to` may be an actor, such as a group or a system the
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
| `selects` | `true` where the link holds because of WHO ends up on each side, not because one brings the other about (below) |
| `hedged` | `true` where the text puts the step as a possibility — "fees *may* worsen targeting" |
| `jointly` | states the step holds **only together with**: `jointly: [desire]` where belief moves people to act "only where they wish to fit in" |
| `on` | `trend` where the step moves the trend of its `to`, not its level: the levy slowed obesity's rise |
| `size` | the magnitude the text gives, quoted: `"a third of the cost"`, or `{value: -1.6, unit: "percentage points", ci: "95% CI -2.3 to -0.9", versus: "the counterfactual", at: "Nov 2019"}` |
| `via` | the finer route the text opens this link into, in order: `via: [reform, sugar]` where the levy's effect on obesity runs through reformulation and sugar bought |
| `modifies` | a state that **moderates** the step: `{by: backers, effect: strengthens}`; `weakens`, `reverses`, or `"0"` where the text finds it does not moderate it |
| `necessary` | `true` where the text says the effect holds **only if** the cause does: "only when", "sine qua non" |
| `sufficient` | `true` where the cause (with its `jointly` co-causes) brings the effect about **on its own**; `false` where the text says it is **not enough** alone |
| `design` | the design of the evidence, in the text's words: `experiment`, `replication`, `anecdote`, `case study`, `illustration` (a hypothetical case) |
| `attribution` | the **type** of causing the step attributes: `intentional`, `inadvertent`, `mechanical`, `accidental`, `complex`; as `{type, by: actor}` to say whose |
| `stance` | on a `#reported` or `#contested` step: `rejected` or `unjudged` |

- **A joint cause is one step, not two.** Where the text says two things bring something about only
  together — a belief and a desire, a rule and the means to enforce it, an opportunity and a motive —
  mark the step from one with `jointly:` naming the others. Two separate steps would say each is
  enough alone. Where the text gives the second only as a qualification in words ("in a tight labour
  market"), it is a `given:`, not a state. Pick as `from` the cause the text leads with.
- **A change of trend is not a change of level.** Where a finding is a change of trend ("slowed the
  rise", "a dampening of the rate of increase rather than a reversal"), give the step `on: trend`: a
  plain `-` would say the level fell.
- **Give the size the text gives.** Where the text reports how much, put it in `size:` in its
  words or as an estimate with its interval and comparison. Two texts that agree on the direction and
  dispute the size draw as agreement without it.
- **A condition can name a state.** A knockout, a subgroup or a place can be a condition that names
  a declared state: `given: [{state: ampk, value: absent}]`. Mark each subgroup's finding as its own
  step with its condition, and the census groups them.
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
  drinkers cut food instead — mark two steps from the same state, and say whose response each is in
  its claim. Do not invent a "moderator" state.

## 3. Never close a gap to complete the chain

The checker reports where the text's chain stops, where an outcome is never reached, and where the
recommended action is linked to nothing. **Those are findings about the text.** A step the text does
not state and its argument does not need stays out, however obvious. Closing it would turn the
author's gap into the reconstructor's invention — and a reader asking what the text shows could no
longer tell.

The reconstructor's own view of the chain — a confounder, a loop the text leaves open, how a policy
would actually reach the people it names — is the **appraisal**, a separate request, written as
`#appraisal` claims. Not in this pass.

## 4. Check, and read the coverage

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
  does, mark it (§2), on the claim that states it. If it states none — a "because" in a methods paragraph, "increasing" as a
  mere description — leave it.


## For a dense, multilevel text

Annotate section by section, and declare the text's own levels. Expect many actors, loops that
return through institutions, and strategies that are alternatives rather than steps; mark each
alternative as its own step from the same situation. Where the text says what an actor faces and
does, which in a text of that kind it usually does, `rarer-marks` has Gross's decomposition: that is
where the chain becomes intelligible.
