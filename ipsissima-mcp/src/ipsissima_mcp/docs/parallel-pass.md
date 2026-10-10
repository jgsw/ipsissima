# Argument and mechanism, reconstructed together

THE METHOD IN FORCE FOR A TEXT'S MECHANISM, since 1 October 2026. Adopted on the author's word
after a trial on two texts (James, *The Will to Believe*; Wilson, "What makes a health system
good?"), in which he judged the parallel maps better than the series ones. It is reversible by one
setting: `IPSISSIMA_MECHANISM_METHOD=series`, or the extension's "Mechanism method" option, serves
the series method (`mechanism-series`) instead, unchanged.

Since profile 1.17 it is part of EVERY reconstruction: the mechanism is read with the argument,
and mapped as far as the argument relies on it (*How far to map it*, below). James: arguments that
need no understanding of mechanisms are "the exception rather than the default". If the user wants
the argument alone, record `depth: none` with that as the reason.

Read these with it:
- the four reconstruction documents (`extraction-prompt` first);
- `mechanism-method`, on how to read a causal claim;
- `mechanism-series`, whose §§2–7 are the notation for states and steps, which this method uses
  unchanged.

This document says what is different.

## Why together

A text often makes its case partly *by* setting out a mechanism. Done in series, the argument is
reconstructed first, and the mechanism pass may not touch it. Three things are then lost:

- **The mechanism's argumentative work.** Across eighteen maps, the largest link between the two
  views was a claim stating a step that supports a claim stating none: a mechanism used as a reason
  for a conclusion that is not itself causal. The series rule left those links unmarked, or left the
  step outside the argument altogether.
- **The steps an inference relies on.** The series pass could find them and mark them as
  imputations, but had to leave them in its own section, never as the premises they are.
- **The reasons a text gives by naming consequences.** "One feels less tempted than ever to lend the
  doctrine a respectful ear", after the Inquisition; "then only shall we bring about the intellectual
  republic". These were read as notes, or as the mechanism's alone.

In the trial the parallel reading also found causal passages the series pass had missed. Two of
them were halves of arguments. One concession in the series argument was attached to the wrong
claim. Interpretive load stayed at zero: everything added was the author's words.

## The order of work

1. **Triage.** Read the source whole. For each section, note whether it justifies, explains, or
   both, and where the text's case rests on what brings what about. This is where the bridges will
   be.
2. **Two skeletons, together.** Before any claim, write down both:
   - the contention or contentions and the top-level form (as the extraction prompt says);
   - the mechanism's `question`, `goal` and `contrast`, its levels, actors, outcome states and
     chains.

   Let each decide things in the other:
   - the contention usually supplies the mechanism's question, contrast and intervention ("What does
     deciding by passion, rather than waiting for evidence, bring about?");
   - an outcome state is often a contention's subject;
   - a chain is often a premise.
3. **Fill both.** The argument by the extraction prompt's method; the steps by the mechanism
   notation (`mechanism-series` §§2–7). The series pass's ban on wiring is replaced by the bridge rule
   below.
4. **The bridge pass.** For each bridge, check its precondition and ask its questions of the map.
   Where a step the argument relies on is missing, add it as a premise, `fidelity: "imputation"`,
   `warrant: "enthymeme"`. Where the text answers a question itself, the answer is in the map. Where
   it does not, that is a finding, never a gap to close.
5. **Write `method: parallel`** in the reading policy (`reconstruction:`), then `argdown_check` with
   `source_root` until ok and verified.
6. **Answer the census's `? island` and `? pieces`** (*What meets*, below): find the link the text
   makes, declare the kind, give the piece its own chain, or record with `apart:` that the text keeps
   it apart.

## How far to map it

The skeletons (step 2) are the cheap first look. Before filling the mechanism, decide its `depth` in
the `mechanism:` block, by what the argument relies on -- never by how often the text uses causal
words (the planner's count read Merton at 2 causal sentences per thousand words, and Merton is a
mechanism throughout):

| `depth` | when | what is marked |
|---|---|---|
| `full` (the default) | the text's case rests on what brings what about, or the mechanism is itself a subject | the chain as the text asserts it, as in this document |
| `sketch` | the mechanism does work in the argument at a few points, and mapping the rest would cost more than it shows | the question, actors and chains; steps only where the argument relies on them, with their bridges. A state with no step is left open, not queried as a gap |
| `none` | the text argues from definitions, texts or principles, and says nothing of what brings what about; or the user wants the argument alone | nothing but the block: `mechanism: {depth: none, depth_reason: "..."}` |

`sketch` and `none` say why in `depth_reason:`, one line. A parallel map with no `mechanism:` block
is queried: the decision has not been recorded.

## How a mechanism enters the argument

A claim that states a step enters the argument in one of two ways, and a chain as a whole in a
third.

- **As the support of a claim it bears on**, where the text uses it as a reason for that claim:
  `[Value for money leaves no room to flex]` under `[Cost-effective is brittle]`.
- **As a premise of a BRIDGE**: an argument whose inference line names the causal scheme it uses.
  The name goes in Argdown's own rule slot, so the file stays plain Argdown:

  ```argdown
  <Faith can create its own facts>

  (1) [Personal relations depend on precursive faith]
  (2) [Faith creates its own verification]
  (3) [Social organisms rest on mutual trust]
  -- From cases to a general mechanism {uses: [1, 2, 3]} --
  (4) [Some facts need a preliminary faith]
  (5) [The veto withholds the faith that would make the fact]
  -- From consequences {uses: [4, 5]} --
  (6) [Where faith helps create the fact, forbidding it is insane]
  ```

A bridge is a defeasible causal move, not a deductive rule. The checker never asks it for a
formalization, and the Reasons view draws its short name in italics, with its questions on hover.
Write a scheme's name exactly. A name with a comma in it is two rule names to Argdown, so no
scheme's name has one.

| scheme | the move | what to ask of it |
|---|---|---|
| From cause to effect | the steps bring the effect about, so it will or does occur | how strong is each step; does anything stated block it (`unless`, `despite`, a rival route, a regime) |
| From effect to cause | the mechanism best explains what was observed | which rival accounts the text sets out; how thorough the account is |
| From correlation to cause | two things go together, so one brings the other about | a common cause; the other direction; mediation and range; the measure itself |
| From cases to a general mechanism | the steps hold in these cases, so the general step holds | are the cases kinds of the general step; how many; is a general claim drawn from one case |
| From there to here | a conclusion established in one setting (a study population, a case, a thought experiment, another country) holds in another, because the mechanism is shared | is the mechanism of action present here; are its support factors (`jointly`, `given`) said to hold here; is there a counteracting mechanism here that was absent there; what did a stipulated case stipulate that the world lacks; does a consideration keep its weight and polarity here |
| From a mechanism to what to do | a route runs from an action to a valued outcome, so the action should be taken | other goals; other routes to the goal; can it be done; other consequences |
| From consequences | a route runs to a good or bad outcome, so the policy, rule or view is good or bad | does the route exist; other consequences; the criterion of good or bad |
| From a mechanism to a possibility | the mechanism has a lever, so things can be otherwise | does anything block the lever; is the outcome only possible |
| From a mechanism against a theory | a mechanism the theory denies or ignores holds, so the theory fails | does it hold where the theory claims to |
| From a mechanism to a classification | what the mechanism does makes the case one of a kind | does it establish each condition |
| Genealogical debunking | a view is produced by a cause that does not track its truth | could that cause track the truth; does the critique reach the critic |
| Vindicatory genealogy | a practice or view came about because it meets needs we have, so it merits confidence | does its formation give reasons to prefer it over rivals, including giving it up; whose needs, and do we share and endorse them; do the needs still hold for us; is the story's order historical or the order complications are added |
| From a genealogy to contingency | a practice or view came about by a process that gives no reason to prefer it, so it could as well have been otherwise | does the formation really give no reason; is contingency being taken as a reason against it; would a rival have met the same needs |

These are Walton, Reed and Macagno's causal and practical schemes (*Argumentation Schemes*, 2008),
with the four the first trial needed and three the second added (profile 1.16). A genealogy has
three directions (Queloz 2021, ch. 9): it vindicates, it shows contingency, or it debunks; it is
vindicatory first, so do not reach for debunking by default. "From there to here" is the move a
text makes whenever it carries a finding across settings -- from a trial to a population, a
bank to race relations, history to ethics, Mexico to the UK. A move that fits none is named in words in the argument's `note:`,
and the plain `-----` is kept.

The questions are not yours to answer. They tell you where to look in the text. Often the census
answers one already: an `unless` on the route, a rival chain, a one-case query.

**A chain as one node (profile 1.20).** Where the text argues about its account *as a whole* --
cites evidence for the account, sets it against a rival, or draws a conclusion from it -- give that
account a claim of its own, in the text's words, with `mechanism:` naming the chain:

```argdown
[The levy works by price]: The levy cuts sugar by making drinks dearer. {mechanism: price}
    + [A trial found prices rose]: ...
    - [The habit story]: Habit, not price, decides what shoppers drink. #reported {mechanism: habit}
```

A rival account is a `#reported` claim standing for the rival's chain, which attacks the text's. As
a bridge's premise, such a claim brings the chain's steps with it. Use it only where the text
treats the account as one thing; where it argues step by step, the steps' own claims carry it, as
above. `mechanism: true` stands for the whole mechanism of a map with no chains. The census lists
each one (`account`), with its steps and how they are backed.

## What the chart shows, and what meets

James's two principles for the Mechanism view (8 October 2026):

- **No state is shown unless it is in a mechanism or a flow.** The chart draws only states a step
  touches, as cause, effect, co-cause, blocker, moderator or measure. A state whose only tie is
  that it makes something up is listed in the panel, not drawn. So is a starting point the text
  links to nothing; the census reports it as a gap.
  - **A definition of what every state is, is not a state.** Wilson 2023 says "I use the idea of a
    flow in a broad sense, to refer to a process by which inputs are transformed into outputs
    within a system" (p. 352). Nearly every state of that map is a flow in that sense. Say it once
    with `idiom: {term: flows, means: "...", pinpoint: "p. 352"}` on the block; the chart shows it
    under its question.
- **Mechanisms shown together meet at a state.** The census asks two questions:
  - `? island`: a chain meets no other chain, by a state or a kind;
  - `? pieces`: a chain's steps fall into pieces that meet at no state.

  Each disconnected piece is one of four things. Say which, and act on it:

  1. **A link the text makes and the map missed.** Sewell's *durability of a structure* stopped
     where the text goes on: depth is what capitalism's chain explains, durability is the other face
     of transformation, and deep, powerful structures shape whole societies. **Look first for this**,
     in the text around the piece. Mark the steps the text states. A step the argument relies on and
     no claim states is an imputation, by the usual rule.
  2. **A definition or framing made a state.** Take it off the chain: an `idiom:`, or a claim in the
     argument.
  3. **Cases of one kind with no kind declared.** Three examples of one claim are three pieces until
     a `kind:` joins them. Declare it only where the text treats them as the same kind of thing.
  4. **A contrast or an illustration**, related to the rest by argument, not by cause: the
     photocopier against the clinicians ("Human beings are not replaceable"). Keep it apart, and say
     so: `apart: "..."` on the chain.

  Never invent a link to answer the question: a piece the text keeps apart stays apart, and
  `apart:` records why. The chart offers *Together* only for chains that meet, and stands a chain's
  pieces side by side with a rule between them.

## Six things the trial taught

1. **An explanation is not a reason.** "A `because` drawn as support" is still the commonest error,
   and the parallel method invites it. Wire a step only where the text uses it to make the reader
   accept something. A sentence that explains how a thing came about, and argues nothing, stays a
   step with no relation. In the trial, three such steps in each text were left unwired, rightly.
2. **A reframing is not a reason either.** Some passages offer "a new and fruitful way of viewing
   things" rather than a case: "more about making sense of what we're probably already doing, than
   forcing the reader to agree" (the author, on his own values section). Where the notation can only
   draw such a passage as support, say so in the `note:`, or leave it unwired.
3. **Mark each step at the text's grain, not the argument's.** Read for its use in an argument, "the
   values at the heart of the practice may make limited care distressing" was first marked
   norms → distress. That composed with "sidelining the norms erodes them" into a route saying that
   sidelining the norms *lowers* distress: the opposite of the text. The cause was the limited care,
   with the norms as the condition. After adding a step, read the CHAIN census for the routes it
   creates, and question any that runs against a step the text states.
4. **Put a step in the chain whose question it answers.** A step wired in for one argument may
   belong to a different question. Surgical volume and centralisation were filed under leanness and
   brittleness, which invited reading them as about brittleness, which the text never says. Give
   such a step the chain it answers, or a chain of its own.
5. **No mechanism appendix.** Define each step-bearing claim in the section where the text, and the
   argument, use it. A separate "mechanism as the text states it" section pulled claims away from
   their use and sent edges across the map. Only a step the argument never uses may stand on its own,
   still in its section.
6. **Showing the cases is a virtue, even when it shows weakness.** Drawing a generalisation's cases
   as its premises can make an argument look less sound: "a few cases is not a huge number from which
   to infer the general principle. But it at least has the virtue of making this weakness
   perspicuous" (the author, on James). Do not leave cases out to make the inference look stronger.

## Slips the checker catches (the trial, 1 October 2026)

- **`basis` says what the text offers**: study, statistics, model, example, testimony or
  asserted. `argued` is the census's word for a step whose claim has support in the map; never
  write it.
- **A note goes on the claim**, beside `fidelity:`, never inside `causes:`. A key a step cannot
  carry is a fault: it would never be read.
- **A citation inside a quotation** (`studies [38]`) is read by Argdown as a claim reference and
  breaks the parse. Escape it, `\[38\]`; the quotation still verifies.
- **The planner's causal census counts causal vocabulary**, and essays carry causation in
  narrative and metaphor: it read Merton at 2 causal sentences per 1,000 words. Judge from the
  reading, not the count.

## What the census reports

- **bridge**: each bridge, its scheme, and how many of its premises state a step. A bridge none of
  whose premises states a step is queried, because it bridges nothing. Under each, its **questions**:
  how many the map records something on, how many nothing, and how many only a reader can answer,
  with each question it records nothing on named (`- nothing recorded: ...`). That is the bridge
  pass's checklist: go back to the source for each. Where the text answers it -- a blocker, a rival
  account, another route -- mark it (`unless:`, `#reported`, the step itself), and the line goes.
  Where the text is silent, leave it: the silence is the finding. The probes are the registry's
  (`bridges`, each question's `asks`), and the Reasons view shows the same answers when a bridge's
  name is clicked.
  In a **draft** (`draft: true` in the reading policy) each question is also judged -- answered,
  partly, not answered, with the grounds -- since the author asked to be told. Those are for the
  author: report them, and change nothing in the map on their account.
- **account**: each claim that stands for a chain (1.20), with its steps and how they are backed.
- **handed**: a state the chain stops at, whose step is a reason in the argument. The text goes on,
  by argument rather than by cause. Unlike a gap, it is not queried.
- **? gap**: a state the chain stops at and nothing argues from. As before, a finding about the text,
  never something to close.
- **? island** and **? pieces**: a chain that meets no other, and one in pieces (*What meets*,
  above). `apart` reports one the text keeps apart, with its reason.
- **told as**: the block's `idiom:`.

## Going back

Everything the series method did is still there. `mechanism-series` serves it, and
`IPSISSIMA_MECHANISM_METHOD=series` makes it the method in force again. A map records how it was
made (`method: series | parallel`), so maps made each way can be compared and the switch judged.
