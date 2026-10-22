# The rarer marks of the mechanism notation

Read this when the text says one of the things below. Each mark is used only where the text says
it; most maps need none of them. The notation itself is `mechanism-notation`.

## In the `mechanism:` block

- **Levels that nest.** Where the levels are parts within wholes, regions within regions or a chain
  of command, `within:` gives each level its parent, as a tree: `{elites: nation, citizens:
  nation}`. Never read it off the order of the list, and list each level's parts straight after it.
- **One state, two roles.** Where a state one chain explains is where another begins, give it that
  role in the second chain: `roles: {forest: condition}`.
- **What is not actual.** A state the text sets out only as a possibility (an option, a path not
  yet taken) is `status: possible`. An outcome the text says cannot be specified in advance is
  `status: open`. `hedged: true` on a step says the text is unsure whether the step holds;
  `status: possible` says the state itself is not actual.
- **A measure is not a cause.** Where the text reports a state through a measure — a survey score,
  an estimate computed by a model, a marker — and the measure matters to the argument (a method's
  artefact, a critique that the estimate is biased), declare the measure as its own state with
  `measures: <state>` and `method:`, in the text's words. Steps into the measure are claims about
  the measurement. Never draw a step from the measure to what it measures.

## On a step (`causes:`)

| field | says |
|---|---|
| `period` | when the step holds, in the text's words anchored to an event: `"after culling ended"` |
| `unless` | a state that **blocks** the step where it holds: `unless: defence` on hazard → harm |
| `regime` | the regime the step holds in, in the text's words: `"at clinical doses"`, `"outside the cull zone"` |
| `threshold` | the threshold the step acts past, in the text's words: `"above about 3°C of local warming"` |
| `measured_by` | the measure the step's evidence is read from (a state with `measures`) |
| `reflexive` | `true` where the step runs through a classification, a prediction or a model the step itself acts on |
| `how` | Gross's decomposition, **only where the text gives it**: `{actor, situation, habit, response}` |

- **Time is not only a lag.** Where the text reports one step in two periods (an effect during an
  intervention, none after it), mark each record with its `period:`. The census sets them side by
  side as the step's time course.
- **A blocker is not a second cause.** Where the text says X brings about Y *unless* D holds (the
  defences between a hazard and harm), mark X → Y with `unless: D`, not a separate D → Y step. The
  census walks D as a cause of the opposite sign. Where the text says the step held *despite*
  something, that is the claim's words, not a blocker: `given:` would say the step holds only where
  it holds.
- **Keep a regime's steps to their regime.** Where the text says a mechanism runs only at a dose,
  in a place or in one model, give each such step its `regime:`. The census will not compose a route
  across two regimes. Where a step acts only past a threshold, say so in `threshold:`; a plain sign
  would say the effect grows smoothly with its cause.
- **A bias in a measure bears on the evidence.** Give the step whose evidence a measure carries
  `measured_by: <measure>`. A step into that measure, other than from what it measures, is then
  drawn as an undercut of the evidence, not as a fact about the world.
- **A step that acts on itself.** Where a step runs through a prediction, a classification or a
  model that the step itself changes (Merton's self-fulfilling prophecy; a theory that makes the
  market it describes), mark it `reflexive: true`. The census names loops through such steps.
- **What an actor faces and does.** Where the text says what an actor faces, the habit it brings
  and how it responds, give the step `how: {actor, situation, habit, response}`, each in the text's
  words. Where two groups respond differently to the same situation, mark two steps from the same
  state, with `how:` naming each actor.
