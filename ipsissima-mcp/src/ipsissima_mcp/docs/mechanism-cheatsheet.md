# Reconstructing a mechanism

How to read the causal chain a text asserts, before marking it. The companion `mechanism-pass.md`
says what to add and in what notation; the profile's §5 defines each key. This sheet is about
reading, and it was revised on 28 September 2026 against gap tests on twelve texts: an RCT, an
interrupted time series, a pair of trials, a biochemical review, a safety model, an ecological
dispute, a climate review, and five works of social and political theory.

---

A marked step is a **claim about someone else's causal claim**: that this text says this brings
that about, this strongly, on this basis. It can be wrong in two directions.

- **Too little**: a step the text states is missed; a hedge is dropped; a null finding or a
  condition disappears; a rival's mechanism is lost because it was only reported.
- **Too much**: the chain is completed where the text stops; an association is drawn as a cause;
  a mechanism the reconstructor finds plausible is attributed to the author.

The second is worse here than in an argument map, because **an arrow says more than the words it
came from**. Readers do not reliably tell "might cause" from "is associated with" (Adams et al.
2017); a solid arrow reads as "causes" whatever the sentence said. So the notation has to carry
the distinctions the reader will not make, and the reconstructor has to supply them honestly.

The governing idea is Powell, Copestake and Remnant's: a causal map is **not a model of what
causes what**, and not quite a model of what the author believes, but **a record of claims with
their provenance** — a repository of evidence someone else can appraise. What a causal claim is
and commits to is Govier's (ch. 10); the strength ladder is Sumner et al.'s; what a mechanism
description commits to is the mechanists' — Machamer, Darden and Craver (2000), Darden (2002),
Craver (2006) — and Gross's. A mechanism, here, is what Illari and Williamson's characterisation
across the sciences makes it: "entities and activities organized in such a way that they are
responsible for the phenomenon" (2012, p. 120) — which fits a policy text's chain as well as a
biochemist's. Each source is named where used.

---

## 1. The method

### Step 0. Is this a causal claim at all?

A sentence states a step **if and only if** it says that a change in one thing brings about,
prevents, or decides a change in another. Much that sounds causal does not.

| the sentence | what it is | mark a step? |
|---|---|---|
| *"Households that paid were more likely to use the net."* | an **association** — a finding about who does what | no, unless the text says paying *makes* them use it; if the text says it is screening, `selects: true` |
| *"Use rose after fees were abolished."* | a **sequence** | no; a step only where the text says *because* |
| *"Fees cut take-up, so free distribution is justified."* | an **argument** containing a step | the step is fee → take-up; the *so* is support, drawn in the Reasons map |
| *"Demand collapsed because households lacked cash."* | an **explanation** | **yes** — this is the pass's own material; the argument sheet's Step 0 set it aside |
| *"The scheme offers mentoring in order to cut reoffending."* | a **goal–means** claim (Hoogerwerf's "final" relation) | yes, if the author holds it: mentoring → reoffending, `basis: asserted` |
| *"Access, here, means take-up."* | a **definition** | no; it decides which states are one (a `note:`) |
| *"Critics argue fees screen out the needy."* | a **reported** causal claim | yes, on a `#reported` claim — never as the author's |

Indicator words — Govier's *produced, led to, brought about, resulted in, was responsible for,
affected, influenced* — are markers, not proof. The words that most need judgement sound causal
without asserting it: *linked to, associated with, tied to, related to, predicts*. Govier calls
*linked* equivocal (pp. 290–2): it borrows a causal claim's authority without its burden. **Do not
resolve the equivocation in the author's favour.** A text that never says more than *linked* has
not stated a step.

### Step 1. Find the explanandum before anything else

Not the topic. **What the chain is for**: what an explanatory text explains, or the ends a
recommendation serves. Write it as the `question:` in the text's own terms before marking a single
step. The mechanists' first rule applies to reading them: characterise the phenomenon first,
because how the phenomenon is characterised constrains which mechanism can explain it (Craver
2006, p. 357; Darden 2002, §2) — a misdescribed phenomenon gets the wrong mechanism.

Then **work backwards** — Darden's (2002) "backward chaining" from a later stage to an earlier
one: what does the text say brings the outcome about, and what brings *that* about? Stop where the text stops. Working forwards through the sections produces a chain of the
table of contents.

- **One question or several?** A text that answers questions apart — three cases worked through in
  turn — has several chains (`chains:`). Do not split one argument to make a diagram smaller.
- **The cause of the problem is not the mechanism of the remedy.** A text may explain a disease by
  diet and propose a tax; the tax works through prices and purchases, not backwards through the
  aetiology (Kelly and Russo 2018). If the text gives the remedy no route, that is a gap.

### Step 2. Read each causal sentence for its strength, and keep it

**What the strength ladder is.** Causal language comes in grades, and the text chose one. Sumner et
al. (2014, p. 2) coded health research, its press releases and the news on "a seven point scale to
rate increasing levels of determinism". From weakest to strongest, with their own examples:

| grade | the text says (grades 2–6 are Sumner's own examples) | what it claims |
|---|---|---|
| 0. no statement | — | nothing about this relation |
| 1. no relation | *"X is not associated with Y"* | that there is no link |
| 2. correlational | *"drinking wine is associated with increased cancer rates"* | that the two go together — nothing about which brings about which |
| 3. ambiguous | *"drinking wine linked to cancer risk"* | a link of unstated kind; *linked*, *predicts*, *tied to* equivocate (Govier's warning about *linked*) |
| 4. conditional causal | *"drinking wine might increase cancer risk"* | that X may bring Y about |
| 5. can cause | *"drinking wine can increase cancer risk"* | that X is able to bring Y about |
| 6. unconditionally causal | *"drinking wine increases cancer risk"* | that X brings Y about |

**Why it matters here.** Sumner et al. found the grade rising as a finding travels from the paper to
the press release to the news, and an arrow drawn on a map rises further still: a reader of a map
sees *causes* whatever grade the sentence had. So the grade is the first thing to read in a causal
sentence, before its states or its sign, and the one a reconstruction most easily loses.

**How the notation carries it.** The notation has three grades of its own, and the claim's words
must carry the rest — which is why a step's claim should quote the causal verb, not paraphrase it.

| grade | in the notation |
|---|---|
| 6. unconditionally causal | a step |
| 5. can cause | a step; the claim keeps *can* |
| 4. conditional causal | a step, `hedged: true` |
| 3. ambiguous | **not a step**, unless the text states the same relation at a causal grade elsewhere (below) |
| 2. correlational | **not a step on its own**; the finding stays in the argument map — unless, again, the text states the relation at a causal grade elsewhere |
| 1. no relation | `sign: "0"` **only** where the text claims *no effect*; a non-significant association is not "no effect" (Altman and Bland 1995; Step 6) |
| 0. no statement | nothing |

**Code a relation by the strongest thing the text says about it** — Sumner's own rule: "the
presence of stronger statements trumped weaker ones". A text often states one finding at several
grades: an evaluation's results say *associated with*, its discussion *suggests the levy can
contribute*, its summary *led to*. Then:

- the step is marked from the strongest **causal** sentence (grade 4 and up), with that sentence's
  words and hedge, and the associational sentence is its evidence — its `basis`, in the argument —
  never a second step;
- the other grades are recorded in the claim's `note:` (or as `echoes`), with where each is made:
  a finding that is *associated with* in the results and *led to* in the summary has been stated
  at two strengths, and the gap between them is a finding about the text;
- if the text **never** rises above *associated with* or *linked to*, even from a designed
  comparison, it has withheld a causal claim, and that caution is the author's to keep: no step.

**The grade is not the design.** Sumner et al. graded language drawn from correlational research,
where *causes* overreaches. A randomised trial or a natural experiment is built to support a causal
claim, and its authors may still word it cautiously. Read the grade from the words and the design
from the methods (Step 3); a mismatch either way is a finding, never something to correct.

**Likelihood and propositions are grades too.** Theory papers state their steps as propositions
for testing — "the more X, the greater the likelihood of Y" — and case papers state them as what
happened. Both are steps; the first is often `hedged`, and the text's own word for its status
("we propose", "we show") belongs in the claim.

Three rules follow.

- **Never inflate.** *Associated with* is not *causes*; *may* is not *does*; *in this sample* is
  not *in general*. Reading up the ladder is the commonest overreach, and a misreport even when
  every word is quoted.
- **Never deflate either.** A text that says *causes* on correlational evidence has made a causal
  claim: mark the step with the basis it has (`statistics`). The mismatch between grade and basis
  is a finding about the text — often the most useful one a policy reader can be shown.
- **Watch the recommendation.** Texts often keep their findings cautious and let their
  recommendations presuppose the cause (in nearly half of 1,170 papers, Haber et al. 2022; Govier's
  diet example, pp. 290–2). A step the recommendation *relies on* and the findings never state is
  an imputation, `warrant: "enthymeme"` (mechanism pass §5) — never a silent upgrade of the finding.

### Step 3. Separate the claim, its basis, and your appraisal

Three different things, and the pass records only the first two.

1. **The step the text asserts** — `from`, `to`, `sign`, and the claim's words.
2. **What the text offers for it** — `basis:`. Recognise the design, not its quality:
   - `study` means a **designed comparison**: cases made, or found, to differ in the cause and
     compared — a randomised trial, a laboratory or field experiment, a natural experiment or
     quasi-experiment (an interrupted time series, a difference-in-differences), a comparison built
     on Mill's Method of Difference. The notation's word is wider than its meaning: in ordinary
     usage an observational cohort is "a study" too, but here it is not;
   - `statistics`: observational data — a cohort, a cross-section, a regression, a national series.
     A large, confounded cohort is still `statistics`;
   - `model`: a simulation or a formal model; `example`: a single case; `testimony`: an authority
     or a consensus; `asserted`: nothing.
   - `design:` then says **how**, in the text's own words: a randomised experiment, a replication, a
     re-reading of someone else's case, an anecdote the text itself calls anecdotal. Texts draw these
     distinctions and `basis` is too coarse for them. **A hypothetical example is not an example**:
     "imagine a manager who …" shows how a step could go, not that it did. Mark it `design:
     illustration`; it is shaded as asserted. Evidence for each period is not evidence for the change
     between them; where the text offers the one and claims the other, say which in `design`.
3. **Whether the basis is good enough** — the appraisal. Separate request, `#appraisal` claims.

Know the critical questions for causal arguments — is the correlation real; is it more than
chance; could the effect run the other way; could a third factor produce both (Govier's four
possibilities, pp. 288–9; Walton, Reed and Macagno) — **so as to recognise when the text answers
them itself**: a text that rules out reverse causation by timing, or a confounder by design, has
said something about its step, and it belongs in the claim, `given:` or `note:`. They are not for
you to answer in this pass.

**Govier's four senses of cause** (pp. 287–8) belong here too. "C causes E" may mean sufficient,
necessary, both, or a **contributory factor**, and the social and biological sciences usually mean
the last. Do not upgrade *a factor* to *the cause*. But read for the other three, because theory
texts state them more often than one expects:

- **Necessity is the commonest.** "Only if", "only when", "sine qua non", "a key assumption … no
  longer holds": mark the step `necessary: true`. A plain `+` draws "only if" as "raises" — more of
  the one, more of the other — which the text did not say.
- **Denied sufficiency is next.** "Necessary, but not sufficient", "may help; it will not
  guarantee", "not solely", "at least in part": `sufficient: false`, and keep the words.
- **Joint sufficiency is rare.** "If all the boundary conditions are met" is one step with
  `jointly:` naming the rest and `sufficient: true`.
- **A list is conjoint unless the text says otherwise.** "More likely if …, if … and if …" leaves
  open whether the conditions act separately or only together. Read it as conjoint — one step, the
  other conditions `jointly` — and say in the `note:` that the text leaves it open. Mark them as
  separate steps only where the text says each works on its own ("any one of", "or").
- **The same condition can be read four ways.** Marti and Gond call their boundary conditions
  necessary, moderating, determining and a precondition, on different pages. Mark what each
  sentence says, and record the drift.

### Step 4. Decide the states, and the grain

A state is a change in an actor's condition or conduct, named as the text names it. **Deciding
which of the text's words are one state is interpretation**: record it in the state's `note:`.

**Grain is also a decision.** The same link may appear at two grains: *fees cut take-up* in the
abstract, a route through cash on hand and screening in section 4; a trial's total effect, then the
mechanism the discussion gives for it. Mark both as the text states them, and give the coarse step
`via:` naming the states between: it **is** that route, not a second one beside it. Marked as two
separate steps, the whole link reads as a direct effect beside an indirect one, which is partial
mediation the text never claimed. Where the text says the route carries only part of the effect,
`share: partial`; where it rules a route out ("AMPK-independent"), `share: none`. Do not invent intermediate
states for a link the text gives only coarsely: a sketch with a black box in it is the text's grain
(Machamer, Darden and Craver 2000 on sketches; Craver 2006, pp. 360–61; Craver and Kaplan 2020, on
why more detail is not always better), and filling the box is appraisal. Gross counts "six
mechanism clusters" in a paper whose authors "do not attempt an enumeration"; the length of a chain
is partly the reconstructor's, and should be recorded as such.

**Filler verbs** — *shapes, drives, fuels, affects, influences, impacts* — often name a step
without saying which way it runs or how (Craver's "filler terms", 2006, p. 360). If the text gives the direction
elsewhere, take it and cite where. If it never does, do not supply one: say so in the `note:`, and
treat the missing sign as a finding.

### Step 5. Place the third things correctly

A condition, a co-cause, a step on the route, a common cause and a selection effect are five
different claims, and each is drawn differently.

| the text says | it is | mark |
|---|---|---|
| *X raises Y by raising M* | a **mediator** — a state on the route | two steps, X → M → Y |
| *Z moderates the relationship between X and Y*, *X raises Y more when Z* | a **moderator** — it changes the step, not Y (Baron and Kenny 1986) | `modifies: {by: Z, effect: strengthens}` where the text names Z as something the chain has; `given: ["…"]` where it is only a qualification in words |
| *Z does not moderate X → Y* | a **null moderation** — a finding | `modifies: {by: Z, effect: "0"}` |
| *X raises Y among A, not among B* | a **stratified** finding | one step per group, each with its `given:` (a state and its value where the group is a state) |
| *X brings Y unless D*, *D stands between X and Y* | a **blocker** — a defence, a knockout | `unless: [D]` on X → Y; `despite: [D]` where D acted and failed |
| *X raises Y only together with W* | a **joint cause** — neither suffices alone | `jointly: [W]` |
| *Z produces both X and Y* | a **confounder** — the text's own rival explanation | Z → X and Z → Y, as the text states them; X → Y, if the text rejects it, on a `#reported` claim |
| *those who got X were already different* | **selection** | `selects: true` — drawn apart, never walked |

Three rules. **Mark a confounder only if the text names it.** A confounder you suspect is
appraisal, however obvious — the pass reports the text's causal account, not the account you would
give. **A moderator is not a cause of the step's end**: making "time to pay" a box with an arrow into
take-up says it brings take-up about in its own right, which is a different and usually unmade
claim. `modifies` puts it on the step instead, and the view draws it as a ring on the arrow. And
**a measure is not a cause**: where the text reports a state through a survey score, a model's
estimate or a biomarker, and the measurement matters to its case (a timing artefact, an estimate
computed from the very variable it is compared with), declare the measure as a state with `measures:`
and `method:`. Steps into it are claims about the measurement; nothing is walked from it. Give the
step whose evidence the measure carries `measured_by:`, so that a bias in the measure is seen to
bear on the step, as a critic's undercut does.

### Step 5b. When, how much, and in which regime

Texts that evaluate or model say more about a step than its direction, and each of these was lost
when the notation could not hold it.

- **When.** A lag says how long; `period:` says when the step holds, in the text's words anchored to
  an event ("during culling", "since Obama's election in 2008"). One step with an effect during an
  intervention and none after it is a time course, not a finding and a contradiction. The census
  never composes a route or a loop across two periods.
- **Level or trend.** An interrupted time series that finds "a dampening of the rate of increase …
  rather than a reversal" has found a step on a **trend**: `on: trend`, and the arrow reads "slows".
- **How much.** Give the size the text gives, with its interval and comparison (`size:`). Two texts
  that agree on the direction and dispute the size draw as agreement without it, and "stronger where
  devices exist, weaker where absent" is a whole result.
- **Which regime.** A mechanism that runs only at a dose, in a place, or in one model is `regime:`;
  one that acts only past a threshold is `threshold:`. Routes are composed within one regime.

### Step 6. Nulls, rivals and reported views

**A null is the text's finding about a step, not the absence of one.** *No significant effect* is
not *no effect* (Altman and Bland 1995). Govier's modus tollens — no correlation, therefore no
causation (pp. 289–90) — holds for a true correlation, not for one study's non-significant
result, and not where the text says effects in two groups cancel. Mark the null as `sign: "0"`
with its basis, in the text's own words ("no significant difference"), facing the rival step it
answers. Where a trial's primary result is null and the text leads with a secondary outcome, mark
each; do not let the secondary stand in for the primary (Boutron et al. 2010 call this spin).

**Rivals and reported views.** A mechanism the text sets out to reject, the view its null answers,
a critic's chain, a literature review's survey: `#reported`, attributed. The test is the argument
sheet's — does the author go on to *use* it? Two mechanisms the author holds together are two
routes, both theirs. A rival the text never mentions is appraisal. Tell two kinds of rival apart:

- **A rival explanation of a finding** — the null was a failure to treat; the measures were taken
  too early; the attitudes were already salient — is an objection to the text's inference. It
  belongs in the argument map, as an attack or an undercut on the finding, and usually needs no step.
- **A rival account of the world** — Stone's three stories of malnutrition, a critic's cascade, a
  reporting bias against performativity — is a mechanism, and is marked as `#reported` steps.

**Say where the text stands on each reported account.** "Reported" is not one thing. The text may
set it out to reject it, or set it out without judging it ("causal theories are neither right nor
wrong"): `stance: rejected | unjudged`. When the author endorses what she reports (Stiles
"demonstrated" the hookworm cause), the claim is hers: write it in her voice, not as `#reported`,
and mark it `hedged` where the reporting works as a hedge, as it often does. The census then sets
each outcome's accounts side by side, with the story that opens another's cause.

**Say what kind of causing each account attributes.** Where a text is about blame, harm or
responsibility, rival stories of one harm often differ only in the type of causing: `intentional`,
`inadvertent`, `mechanical` (guided through another agent), `accidental`, or `complex`, after Stone.
Mark it with `attribution:`, and say whose action or intention it is — `{type: intentional, by:
the eaters}` is not `{type: mechanical, by: the advertisers}`. It is the difference a political
reader most needs to see. Where two stories run through one state, give each story its own chain,
so each can be read alone: drawn together, the radical story's advertisers seemed to set off the
conservative story's knowing choice.

### Step 7. Actors and levels

Actors are positions the text names — "courts", "the household" — at the text's own levels. A
population-level finding is not an individual-level mechanism: reading "areas with more X have
more Y" as "people with X do Y" is Govier's fallacy of division (ch. 9) in causal form. Where the
text moves between levels, that move is a step (the Coleman boat's arrows), marked as the text
makes it. Give a state `levels:` only where the text says it holds at both.

### Step 8. Never close a gap

The chain will stop short: an outcome reached by nothing, an intervention linked to nothing, two
steps that do not meet. **Those are findings about the text.** The policy-theory tradition tells
the analyst to "fill in the links that have remained implicit" (Hoogerwerf 1990) and to infer the
missing warrants (Leeuw 2003). That is where this method parts company with it: a filled link is
the reconstructor's, and in a diagram it looks like the author's.

The one exception mirrors the argument sheet's unstated premise. Ask a version of Fisher's
Assertibility Question — *what would have to happen, between this cause and that outcome, for the
text's claim to be true?* — and use the answer to know **where to look in the text**. If the text
states it, mark it. If the text's own inference relies on it and does not state it, mark it as an
imputation, `warrant: "enthymeme"`. Otherwise it stays out.

**The transitivity trap** (Powell and colleagues): a step in one case and a step in another do
not make a route, even when they share a state. From B → C among pig farmers and C → S among wheat
farmers nothing follows about pig farmers' seed. Steps join only where the text joins them — which
is what `chains:` and `kinds:` are for.

---

## 2. Charity, and where it stops

The argument sheet's rule holds unchanged: **charity governs how you read an unclear sentence; it
never licenses attributing a claim the text does not make.** Causal claims give it three specific
temptations.

- **Strength.** The accurate reading of *associated with* is the weak one; the *interesting*
  reading is causal. Charity in the `interest` mode will pull up the ladder. Resist it.
- **Completeness.** The best-explanation reading of a gappy chain supplies the missing mechanism.
  That is charity in the `soundness` mode, and it writes a better text than the author's.
- **Excuse.** When a text says *causes* on an observational design, it is tempting to read it as
  sloppy phrasing for *is associated with*. Sometimes that is right. It is Stern's device by name:
  if you use it, record `warrant: "sloppy-phrasing"` and say why in the `note:`. Three overclaims
  read as sloppiness is a decision about the author.

When the choice is between the charitable reading and the accurate one, mark the accurate one and
say what is unclear.

---

## 3. Forms worth recognising

Naming the form tells you where the text's case is thin and what its own critical questions are.

| form | skeleton | what to watch when marking |
|---|---|---|
| **correlation to cause** | A and B co-vary; so A causes B | the step's basis is `statistics`; the correlation is its support in the Reasons map |
| **before and after** | B followed A; so A caused B | `example`; never strengthen a post hoc claim |
| **inference to the best explanation** | this mechanism best explains the data | rivals the text considers are `#reported`; rivals it ignores are appraisal |
| **causal slippery slope / domino** | A leads to B leads to … Z | each link has its own basis; a run of `asserted` steps is the finding (Govier pp. 308–10) |
| **aetiology to prevention** | X causes the disease; so removing X prevents it | the prevention route is separate, and usually asserted |
| **it worked there** | it worked in case A; so it will work here | two cases, two chains; `kinds:` relate them, nothing walks between them |
| **causal story** | who did what, meaning to or not, with what result | actors and intentions as the text gives them, with `attribution:`: this is where blame is allocated |
| **boundary conditions** | a process runs only if …; P1…Pn moderate it | `necessary` on the process's steps; `modifies` for each named moderator; the list's independence is a reading |
| **interrupted time series** | the series bent at the intervention | a step `on: trend`, with its `period` and `size` against the counterfactual |
| **tipping point** | past a threshold, the system switches | `threshold:`; the regimes either side as `regime:` |
| **rival stories** | one harm, several accounts, attributed by camp | `#reported` steps with `stance` and `attribution`; the census's accounts line |

Govier's **objectionable cause** (pp. 306–8) includes a variant in which two things the author
dislikes are joined causally. Mark it faithfully and let `basis: asserted` show what holds it up.

---

## 4. What a good mechanism marking shows

1. **The question is the text's**, and the chain runs back from its outcomes.
2. **Every step is one the text states**, or one its inference relies on and is marked as imputed.
3. **Every step keeps its grade**: direct, can, hedged, null — and no association is an arrow.
4. **Every step's basis is what the text offers**, not what the reconstructor thinks of it.
5. **Mediators, moderators, blockers, joint causes, confounders, measures and selection are told
   apart**, and "only if" is not drawn as "raises".
6. **Rivals and reported views are `#reported`**, with the text's stance on each, and every null
   faces what it answers.
7. **Time, size and regime are kept** where the text gives them.
8. **The gaps are left**, and the census can find them.
9. **Every arrow can be traced to words in the source.**

---

## 5. Failure modes, in the order they occur

| symptom | what went wrong |
|---|---|
| the `question:` is the paper's title | the explanandum was not found |
| the chain follows the section order | worked forwards instead of back from the outcome |
| an arrow for *associated with* or *linked to* | the ladder ignored; an association drawn as a cause |
| a hedged paper with no `hedged` steps | hedges dropped |
| a *causes* on observational data marked as an association | deflated out of charity; the overclaim hidden |
| the recommendation's cause promoted into the findings | an enthymeme not marked as one |
| every step `study` where the text reports one study for one step | basis spread beyond where the text puts it |
| a moderator drawn as a box with arrows; selection walked as a route | third things misplaced |
| a non-significant result dropped, or restated as *no effect* | null misreported |
| a rival's mechanism in the author's voice | `#reported` missing |
| a confounder the text never names | appraisal leaked into the pass |
| steps from two cases joined into one route | the transitivity trap |
| an area-level finding drawn as individuals' behaviour | levels crossed without a step |
| the remedy's route is the aetiology reversed | aetiology and prevention conflated |
| every outcome is reached | gaps closed |
| "only if" drawn as a plain raise | necessity lost (`necessary: true`) |
| six moderators drawn as six boxes with arrows into the outcome | moderation misdrawn (`modifies`) |
| a knockout's null reported as "no effect" | a conditional null lost its condition |
| a route through the 1990s mechanism and a 2010 finding | periods composed into one route |
| two texts' different sizes drawn as one arrow | size dropped where the texts disagree only on size |
| a hypothetical example shaded as a case | illustration read as evidence (`design: illustration`) |
| a method's artefact drawn as a cause in the world | measurement drawn as causation (`measures`) |
| every reported story treated as rejected | stance flattened (`stance`) |

---

## 6. Ethics

A mechanism map is read by people deciding what to do, and it is read faster than the text.

**Causal attributions about groups.** "Being X causes Y", where X is a race, a sex, a religion, a
class or a diagnosis, is among the most consequential claims a text can make and the most easily
distorted in a diagram. Keep the text's states and wording: "higher arrest rates among X", not
"X's criminality". **Keep the mediators the text names** — discrimination, poverty, policing,
exposure — because a disparity drawn without its mediators makes the group itself the cause, which
the text may never have said (Kaufman and Cooper 2001; VanderWeele and Robinson 2014). Where the
text itself makes such an attribution without basis, mark it faithfully and let `basis: asserted`
say so; the criticism belongs to the appraisal. Which causes a chain includes is itself political:
foregrounding what individuals can control "downplays environmental and social factors" (Govier,
p. 292, n. 11), and a causal story allocates blame (Stone 1989). Do not remake that choice on the
author's behalf, in either direction, and record the type of causing each story attributes
(`attribution:`) rather than letting the diagram decide it: an arrow from a group to a harm reads
as intent unless something says otherwise.

**Overstatement that feeds policy.** Exaggeration is inherited: where a press release overstated a
causal claim, most news stories repeated it; where it did not, few did (Sumner et al. 2014). A
mechanism map is one more summary. An inflated arrow, a dropped hedge, a null turned into a finding
each travels further than the paper and is harder to correct.

**A reported view as the text's own.** A critic's mechanism, or a theory described in order to be
rejected, drawn in the author's voice says the author holds it. `#reported` is not optional.

**The reader's trust in a drawn arrow.** A sentence carries its hedges; a diagram carries only what
the notation keeps. Readers do not separate "might cause" from "is associated with" unaided (Adams
et al. 2017), and graphs flatten conditional and joint relations (Hoogerwerf 1990, p. 287). Hence
**provenance**: every arrow quotes, or points to, the words it came from (Kim and Andersen 2012;
Powell et al. 2024), so that a doubting reader can check it. **Do not draw what you cannot cite.**
An unmarked appraisal in the chain is the worst case: it lends the author's authority to the
reconstructor's opinion, and the reader cannot see the join.

---

## Sources

- Trudy Govier, *A Practical Study of Argument*, 7th edn (Wadsworth, 2010), ch. 10 and ch. 1 —
  what a causal claim commits to; correlation and cause; *linked*; Mill's methods; causal fallacies.
- Steve Powell, James Copestake and Fiona Remnant, "Causal mapping for evaluators", *Evaluation*
  30 (2024) — maps as records of claims with provenance; with Causal Map's minimalist coding and
  the transitivity trap.
- Hyunjung Kim and David F. Andersen, *System Dynamics Review* 28 (2012) — coding text into causal
  links with an audit trail to the source.
- Petroc Sumner et al., *BMJ* 349 (2014) g7015; Rachel C. Adams et al., *J. Exp. Psychol.: Applied*
  23 (2017) — the strength ladder and what readers make of it. Noah A. Haber et al., *Am. J.
  Epidemiol.* 191 (2022) — recommendations more causal than findings.
- Peter Machamer, Lindley Darden and Carl F. Craver, "Thinking about mechanisms", *Philosophy of
  Science* 67 (2000), 1–25 — mechanisms from set-up to termination conditions; schemata and sketches.
- Lindley Darden, "Strategies for discovering mechanisms: schema instantiation, modular subassembly,
  forward/backward chaining", *Philosophy of Science* 69 (2002), S354–S365 — the phenomenon
  constrains the mechanism; working backwards.
- Carl F. Craver, "When mechanistic models explain", *Synthese* 153 (2006), 355–376 — characterising
  the phenomenon; sketches and filler terms; how-possibly versus how-actually.
- Carl F. Craver and David M. Kaplan, "Are more details better? On the norms of completeness for
  mechanistic explanations", *BJPS* 71 (2020), 287–319 — grain: more detail is not always better.
- Phyllis McKay Illari and Jon Williamson, "What is a mechanism? Thinking about mechanisms across
  the sciences", *European Journal for Philosophy of Science* 2 (2012), 119–135 — a characterisation
  that holds across the sciences.
- Neil Gross, *Sociological Theory* 36 (2018) — the structure of causal chains.
- Andries Hoogerwerf, *Evaluation and Program Planning* 13 (1990); Frans L. Leeuw, *Am. J.
  Evaluation* 24 (2003) — the policy-theory method, and where this one departs from it.
- Douglas Walton, Chris Reed and Fabrizio Macagno, *Argumentation Schemes* (Cambridge, 2008).
- Reuben M. Baron and David A. Kenny, *JPSP* 51 (1986); Douglas G. Altman and J. Martin Bland, *BMJ*
  311 (1995); Isabelle Boutron et al., *JAMA* 303 (2010) — moderators; nulls; spin.
- Michael P. Kelly and Federica Russo, *Sociology of Health & Illness* 40 (2018) — aetiology is not
  prevention.
- Deborah A. Stone, *Political Science Quarterly* 104 (1989); Jay S. Kaufman and Richard S. Cooper,
  *Am. J. Epidemiol.* 154 (2001); Tyler J. VanderWeele and Whitney R. Robinson, *Epidemiology* 25
  (2014) — the ethics of causal attribution.

For the notation these decisions are written in, see `mechanism-pass.md` and the profile, §5.
Marti and Gond (2018), Valentino et al. (2018) and Stone (1989) are the texts behind the 1.9
additions; the earlier gap tests read metformin's mechanisms (Rena et al. 2017), Reason (2000), the
soft drinks levy (Rogers et al. 2023), badger culling (Donnelly et al. 2006; Jenkins et al. 2010),
Yellowstone's cascade (Ripple et al. 2025; MacNulty et al. 2025) and Lenton et al. (2008).
