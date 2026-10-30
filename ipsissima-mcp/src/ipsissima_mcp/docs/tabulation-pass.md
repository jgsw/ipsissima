# The text's comparisons, read with the argument

PART OF EVERY RECONSTRUCTION. Read this with the reconstruction documents, before writing any
node. Where the text compares nothing, the map says so: `frames: none`. Tables made while
reconstructing have proved as full as those of a separate pass, at about 5,000–7,000 tokens a map;
of twelve texts read for their comparisons, every one compared things, in four ways on average.

This document says only what the comparisons add to the method.

## What it is for

An argument map records what supports and attacks what. It does not record what each claim is
*about*: which study, which case, which option, and what the text says of it on which dimension.
So a reader cannot do any of the following with a map alone:

- set Gettier's two cases beside the three conditions they satisfy;
- set Stone's fifteen stories beside the type each is pushed into;
- set Bates's ten studies beside the questions each answers.

These are what the reader works with:

- **Classify**: guess where a case falls, then look.
- **Difference**: find two rows alike in all but one dimension.
- **Contradiction**: find a row that meets every condition and still gets the verdict "no".
- **Empty cell**: a combination the text never fills.

The pass records the text's own comparisons, and only the text's.

## Two families

1. **Case tables.**
   - Rows are cases: studies, examples, thought experiments, jurisdictions, options, frameworks.
   - Columns are the text's dimensions, each with the values the text uses. One column may be the
     verdict or outcome the text gives each case.
   - Options against criteria are a case table whose columns are criteria.
   - A typology is a case table whose verdict column is the type.
   - A definition with counterexamples is a case table whose verdict contradicts the rule.
2. **Account tables.**
   - Columns are the rival accounts of one thing.
   - Rows are the evidence, and cells are the relations already drawn: support, attack.
   - The weigh panel derives these from `#reported` rivals. Declaring the accounts says which claims
     are accounts *of the same thing*, so the panel need not guess. A declared frame does not hide
     the map's other rivals: an objection and the text's reply to it stay in the weigh panel beside
     the declared accounts, unless they repeat one of them. So declare only rival accounts of one
     thing, not every objection the text answers.
   - **Rival accounts are rival answers to one of the text's questions.** Name it with
     `question:`. Find them question by question: for each question under `questions:`, ask whether
     the text sets two or more answers to it against each other and weighs them. A text announces
     some ("this has been explained in two ways"); it poses others as a question with answers set
     "in contrast", or as a worry met by a rival explanation. Both are sets.
   - **Members explain or predict.** Each says why or how something happens, or what will happen.
     The finding they are weighed against is evidence, a row, not a member, even where it answers
     a whether-question: "the treatment had no effect" is what the accounts are tested on, not a
     third account.
   - **A worry and the finding that answers it are a claim and its rebuttal, not a set.** Where
     the text raises a worry ("recipients would sell it on") and a finding answers it ("they kept
     it"), draw the attack and declare nothing. It is a set only where the answer is itself a
     rival explanation.
   - **A member is an answer the text weighs in its body**: one it sets evidence for or against,
     or tests against the others, as an answer to this question, its own answer included. These
     are not members; record them as claims:
     - a possibility it names in passing, or only in a summary or a conclusion ("X also plays a
       role");
     - an answer to a neighbouring question (why so few take something up, where the question is
       why price matters);
     - a list of possibilities it does not weigh, which is not a set at all.
   - **One rivalry, one frame.** Where the same rival answers meet under two of the text's
     questions, declare them once, under the question the text tests them on. Do not split one
     rivalry into a frame for the prediction and another for the explanation.
   - **An artefact the design rules out is not an account.** Where the text answers explanations of
     its result as a flaw of method (a failure to treat, a measure that primed everyone), they are
     threats: a case table of them, with how the text meets each.

## The notation

**`frames:` in the front matter.** One entry per frame. A frame has these keys:

- `kind` (required):
  - `case`: the rows;
  - `dimension`: a column with values;
  - `verdict`: a dimension that is the text's verdict or outcome, shown last and read as what the
    others decide;
  - `account`: rival accounts.
- `label`: the frame's name, in the text's words where it has one. **Whose words they are is
  shown by quotation marks inside the value**, as `source:` does: `label: "\"(i) P is true\""` claims
  the text's words, and the checker verifies them against the map's chapter;
  `label: "Gettier's cases"` is your own name for the frame, and claims nothing. The same holds for
  a value's label. (YAML's own quotation marks are syntax and do not count.)
- `pinpoint`: where the text sets out the comparison. A frame the text never states is not the
  text's frame.
- `values` (required):
  - for a `case` frame, a map from id to label (the text's name for the case);
  - for a `dimension` or `verdict`, a list of the text's words (`[yes, no]`, `[deep, shallow]`,
    `[intended, unintended]`) or a map from id to label;
  - for an `account`, a map from id to `{claim: "<the account's title>"}`.
- `ordered: true` (dimensions only): the values are listed from what the text counts best to what
  it counts worst. This lets the page say when one case is worse on every count the text weighs.
  It is never used to add anything up.
- `comparable: false` (dimensions only): the text says this column's cells do not measure one thing
  across the cases, as when each country defines "recidivism" its own way. The page shows the
  cells and compares no case with another on them. Give the text's words in the frame's `note:`.
- `rule:` (verdicts only): a rule the text states or reports, as the verdict it gives when the
  dimensions take given values. For example, definition (a)'s "S knows that P iff (i) P is true,
  (ii) S believes that P, and (iii) S is justified in believing that P" becomes
  `rule: {then: yes, when: {holds: yes, believes: yes, justified: yes}, claim: "Definition a"}`.
  The page then shows which rows the rule gets wrong, which is the counterexample. Give only a rule
  the text states, with the claim that states it. A rule here is always "all of these together", and
  it is read both ways, as "if and only if": the page names a row that meets the conditions and
  gets another verdict, and a row that gets the verdict without meeting them. Where the text's rule
  is any other shape (two of three, any one of), or runs one way only ("only if"; "if"), leave it
  in its claim and say in the frame's `note:` why it is not written as a rule.
- `question:` (account frames only): the id of the declared question the accounts answer
  (`question: q2`). The census lists the questions with rival answers declared, and those without.
- `note`: optional prose.

**`frames: none`** records that you read the text for its comparisons and found none. Give the
reason in a `//` comment under the front matter. A map with no `frames:` at all was made before the
comparisons were part of every reconstruction.

**`about:` on a claim.** It names the cell or cells the claim states: the case, and the value it
gives on one or more dimensions. Use a list where one claim states several cells.

The whole of it on Gettier 1963. The conditions' labels are Gettier's words, so they carry inner
quotation marks; the cases' labels are summaries, so they do not. The truth condition's id is
`holds`, not `true`: see *Ids that YAML reads as something else*, below.

```argdown
===
frames:
    case:
        kind: case
        label: "Gettier's cases"
        pinpoint: "pp. 122-123"
        values:
            I: "Case I: the man who will get the job has ten coins"
            II: "Case II: either Jones owns a Ford or Brown is in Barcelona"
    holds:     {kind: dimension, label: "\"(i) P is true\"", pinpoint: "p. 121", values: [yes, no]}
    believes:  {kind: dimension, label: "\"(ii) S believes that P\"", pinpoint: "p. 121", values: [yes, no]}
    justified: {kind: dimension, label: "\"(iii) S is justified in believing that P\"", pinpoint: "p. 121", values: [yes, no]}
    knows:
        kind: verdict
        label: "\"S knows that P\""
        pinpoint: "p. 122"
        values: [yes, no]
        rule: {then: yes, when: {holds: yes, believes: yes, justified: yes}, claim: "Definition a"}
===

[Definition a]: S knows that P iff (i) P is true, (ii) S believes that P, and (iii) S is justified
in believing that P. {fidelity: "quotation", pinpoint: "p. 121"}
    <- [Smith does not know e]: It is equally clear that Smith does not know that (e) is true.
        {fidelity: "quotation", pinpoint: "p. 122", about: {case: I, knows: no}}
        <+ [Smith is justified in believing e]: Smith is clearly justified in believing that (e)
          is true. {fidelity: "quotation", pinpoint: "p. 122", about: {case: I, justified: yes}}
```

A claim may also name two `case` frames together, such as `about: {study: s4, issue: use}`.
That puts it in the cell where that study meets that issue, which is how Bates's ten studies
are set against the questions they answer. (Ids are yours to choose; do not call a frame
`question`, which a claim already uses for the question layer. And "study" here is the text's word
for any study: as a step's `basis`, `study` means a designed comparison only.) An `account` frame is never named in `about:`. Its
cells are the relations drawn to the accounts' claims.

**What the text says of a cell instead of a value** (profile 1.23). Two reserved values may stand
in `about:` on a dimension or a verdict, beside the frame's own:

- `impossible`: the text says the combination cannot occur ("no small state can seek unlimited
  aims": `about: {state: small, aims: impossible}`);
- `indeterminate`: the text says it cannot be told ("what great powers do abroad is unclear").

Alone, on an account frame, `about: {why: indeterminate}` marks a reason the text says does not
tell the accounts apart ("the survey fits either story"). Draw its relations to the accounts as
well, as the text states them. A said cell is not silence: the table fills it in words, and never
compares it with another row.

## Reading a text's comparisons

A cell is a claim about someone else's comparison: that this text puts this case here, on this
dimension, with this value. Like a causal arrow, a cell says more than the words it came from. A
filled grid looks complete, and an empty cell asks to be filled (Silver calls this "slotting").
So a reconstruction can go wrong in two directions. It can lose a comparison the text makes, or it
can complete one the text left open. The second is worse, because it cannot be seen.

**What kind of table is it?** Collier, LaPorte and Seawright's template, and Elman's three goals,
give the questions to ask:
- **What is the overarching concept?** It is the frame's label. If the text names none, the label
  is yours, so give it no inner quotation marks.
- **What are the rows?**
  - *Types*, defined by the dimensions (descriptive: "what constitutes this type?").
  - *Cases*, assigned to types or verdicts (classificatory: "what is this a case of?").
  - *Predicted outcomes* (explanatory: "if the theory is right, what do I expect?").

  Types and cases are different rows. Where a text defines types and then places cases in them,
  that is two frames: the types, and the cases with the type as their verdict. An ideal type with
  no case is a row, not a gap (Bailey). Where the text draws a distinction within one type only
  (individual or collective, within "repositioning"), the subtypes are a frame of their own:
  left in the first, the other types' cells would read as the text's silence.
- **What decides the verdict?** Only where the text says so:
  - "iff (i), (ii) and (iii)" is a rule (`rule:`);
  - a list of dimensions is not.

  Goertz's test helps. A text that excludes a case for lacking an attribute treats the attribute
  as necessary: map that exclusion as a claim. The rule built from it is your interpretation and
  needs a warrant. A family-resemblance concept ("any three of four"), or several combinations
  joined by "or", cannot be written as `rule:`. Leave it in its claim, with the frame's `note:`
  saying why.

**What is a value?** The text's word, at the text's strength.
- **A value keeps the text's grade.** "Clearly justified" is yes. "Probably" is a hedge, and
  "weak", "partly" or "some signs of" are the gray zone. Where the text grades a case, the grade is
  the value (`[yes, partly, no]`, in its words). Where it hedges without grading, the hedge stays in
  the claim's words.
- **A value keeps the text's negative pole.** Where the text's "no" is several things (pluralism,
  monism, syndicalism), the values say so (Goertz).
- **Turning a number into a category is your act,** unless the text does it. If the text reports
  an odds ratio and never says "benefit", a cell `effect: benefit` is an interpretation, with a
  warrant (Cochrane Handbook, ch. 12).
- **A value is comparable across the rows only if the text measures them alike.** Where it says
  the measure differs from case to case, mark the dimension `comparable: false`.
- **Never code non-significance as "no effect".** "No significant difference" keeps its words
  (Altman and Bland; Ogilvie et al.).
- **The claim that carries a cell is its context unit.** It should say the value plainly, and
  quote where it can, because the quotation is what shows the value preserves the text's reading
  (Krippendorff's semantic validity).

**What is silence, and what is a statement?** Only silence is an empty cell. When the text says
something about a cell other than a value, that is a statement, and it is mapped as a claim:
- "this finding cannot tell the two accounts apart" (Heuer): `about: {<accounts>: indeterminate}`;
- "no small state can be an unlimited revisionist" (Elman's logical compression): the cell is
  `impossible`;
- "it is unclear what they would do" (Mearsheimer, in Elman): the cell is `indeterminate`;
- "we found no case of this kind" (empirical compression): a claim, with a note naming the
  combination, since no row holds it;
- "we have no evidence that…" (Heuer): an attack on the account it names, not silence.

Ragin writes an empty row as "?". Filling it, even with the obvious value, is a simplifying
assumption, and such assumptions should not be grafted onto a conclusion "in a mechanistic
fashion because, after all, we *do* care". Leave it empty.

**What a reader does, the extractor does not do.**
- **No expansion.** Do not reconstruct the full property space behind a partial typology, and do
  not tease out the dimensions behind a list of types. Lazarsfeld called this substruction, and
  Elman calls it reverse engineering, done without assuming the author had it in mind. It is how a
  reader finds what the text omitted, so record the typology as the text gives it.
- **No matching.** The census shows pairs of rows that differ in one dimension (Mill's matched
  cases). Never add a row to make one.
- **No test labels.** Whether a finding is a hoop or a smoking gun "involves different assumptions
  and interpretations" (Collier 2011). Keep the text's words where it names a test itself.
- **No allocation.** A study with mixed results is not filed under the account it "best supports"
  (Ogilvie et al.). Draw each relation the text states.

**Rival accounts: work across the row.** As each finding is written, ask of every declared account
whether the text relates the finding to it. Evidence that fits every account has no diagnostic
value (Heuer), and a table cannot show that unless the relations are drawn. The text's own
assumptions are rows too, where it states them. Declare accounts as the text words them: do not
merge two it keeps apart, or split one it treats as one.

A sketch, in summary words, of Snow 1855 on cholera. He asks how the disease is communicated, and
weighs the received answer, effluvia in the air, against his own, water fouled by the sick: one
question, two answers he compares, one frame. The deaths round the pump are what he weighs them
on: a row, not a third account.

```argdown
===
questions:
    q1: {text: "How is cholera communicated?"}
frames:
    spread:
        kind: account
        label: "How cholera is communicated"
        question: q1
        values:
            air: {claim: "Cholera spreads through the air"}
            water: {claim: "Cholera spreads through water"}
===

[Cholera spreads through water]: Cholera is passed on in water fouled by the sick.
    {fidelity: "compression", question: {id: q1, move: answers}}
    <+ [Deaths clustered round one pump]: The deaths of the outbreak clustered round one pump.
        {fidelity: "compression"}

[Cholera spreads through the air]: Cholera is communicated by effluvia in the air. #reported
    {fidelity: "compression"}
    <- [Deaths clustered round one pump]
```

**Keep what the text says about its own scheme.**
- **The dimensions behind a type's name.** Where the text says what makes a type, place the type by
  those dimensions. A frame of vivid names alone invites reification (Elman; Bailey).
- **An author's caution about a type** ("some signs of institutional clustering").
- **A text's own counts** ("most studies found"). These are its claims; never rebuild them from the
  cells (Cochrane Handbook, ch. 12).
- **Its grouping and order of studies.** The rows follow the text (SWiM).
- **A study's characteristics apart from its results.** They are separate frames.
- **A contradictory row.** Two cases in the same cells with different verdicts is a finding, not a
  slip. Record both (Ragin).
- **Imagined cases.** A thought experiment or counterfactual case is a row, and its label or note
  says it is imagined.
- **A placement that moves.** Where the text moves a case from one value to another ("from
  inadvertence to intent"), or two sides place it differently, cross the cases with a frame of the
  stages or the sides, so that each value has its own cell.

## What the comparisons add at each step

The steps are the extraction prompt's (*The order of work*); this says what the comparisons add.

- **2. Reading the source:** list what the text sets side by side:
  - its tables and figures;
  - its numbered studies, cases and examples;
  - "by contrast", "whereas", "unlike";
  - lists of options, of criteria, of dimensions;
  - hypotheses with predictions;
  - rival explanations of one thing.

  For each, note what the rows are, what the columns are, and what values the text uses. Name the
  text's verdict column if it has one.
- **3(b). The skeleton:** write the `frames:` block, with the form that brings it. Use the text's
  labels and values and give each frame a pinpoint. Do not add a dimension the text does not use,
  however natural it seems: that is slotting. A value the text leaves unstated is left unstated.
- **4. The lost tables:** the extraction notes name each table the text cites that did not come
  through as one, and `argdown_plan` says so before extraction. Rebuild from the page image, into
  the source, each table a frame uses (the conventions say how). In the census, seven texts in
  twelve had such a table, and it was the frame. Leave a table no frame uses.
- **5. Filling the map:** add `about:` to each claim that states a cell, as it is written. Draw a
  reason's relation to each rival account it bears on, where the text states it. A cell the text
  states that no claim carries is added as a claim, at the text's own fidelity, attached by the
  relation it really has, usually as support for the claim the comparison serves. A claim with no
  relation drops out of the map. Add nothing for a cell the text leaves empty.
- **8. Before you stop:** read the census's FRAMES section: each table's size, its empty cells, rows
  that contradict the verdict, and pairs of rows that differ in one dimension.

**What decides the depth** is the same as for the mechanism. Tabulate the comparisons the text makes
and relies on, not every list it happens to contain.

**Adding tables to a map made before.** A map with no `frames:` was made before the ruling. To give
it tables, read the source again for its comparisons and add steps 3(b), 4, 5 and 8 to the finished
map, without rewriting its argument. That is the separate pass the trials began with: it reads the
method, the source and the map again, so it costs about as much reading as a reconstruction.

**Record "no frame" where there is none.** Some texts compare nothing: a single proof, a manifesto,
a satire's one persona. Write `frames: none`, say why in a `//` comment, and spend nothing more on
it. A table is worth having only where the text built one.

## What the trial maps taught

The trial maps were Gettier 1963, Stone 1989, Valentino et al. 2018 and Bates et al. 2011.

- **Rebuild only the tables a frame uses.** Stone's 2×2 and Bates's Table 1 were the frame.
  Valentino's regression tables carry coefficients no frame reads, so they were left alone.
- **Expect the cost to follow where the cells live.**
  - Gettier's cells were all claims already: 13 placements, no new claims.
  - Stone's case placements were in the text, not the map: 22 new claims.
- **Draw the relations the text states.** The pass found eight it had not drawn: the IE model
  "found no support", two studies "tried to distinguish" the effects. Without them an accounts
  table cannot tell anything apart.
- **Place a study's findings by the study.** One study's two findings, each bearing on one
  account, are one row that tells the accounts apart once they are grouped by the study they are
  `about`.
- **Ids that YAML reads as something else.**
  - `true`, `false` and `null` are not words in YAML: never use them as a frame's id or a value
    (the Gettier example above calls the truth condition `holds`).
  - `yes` and `no` are words, as Argdown reads them, and the checker now reads them the same way.
- **Keep a study's facts apart from its results.** A claim about study 1's result goes
  in the cell where study 1 meets that result; the study's product and country are a cell of their
  own (`about: [{study: s1, issue: takeup}, {study: s1, product: "deworming medicine"}]`).
  Written as one map, the product is read as a value of the result row, and the checker asks
  whether the text gives one result four products.
- **Give every column a pinpoint**, not only the rows: where does the text use this dimension?
- **Give a verdict where the text gives one.** The page's move "these rows differ in one
  dimension" needs a verdict column and at least two other dimensions. Without them it is noise.

## What tabulation must not do

- **Fill a cell the text leaves empty.** Not from the reconstructor's knowledge, not by
  inference, not "obviously". The empty cell is the finding.
- **Add a dimension the text does not use.** A form invites its slots to be filled, and a
  cross-classification can always take one more dichotomy (Daniel Silver, "Figure It Out!",
  *Sociological Methods & Research* 49, 2020, pp. 878–889).
- **Rank or total the options.** `ordered:` reports the text's own ordering on each criterion. The
  page may say one option is worse on every count the text weighs; it never adds the counts up.
- **Turn a reason into a coordinate.** A claim supports or attacks what it does. `about:` says
  only what the claim is about.

## Sources

- Richards J. Heuer Jr, *Psychology of Intelligence Analysis* (CIA Center for the Study of
  Intelligence, 1999), ch. 8: diagnosticity; working across the matrix; absence of evidence.
- Gary Goertz, *Social Science Concepts: A User's Guide* (Princeton University Press, 2006), ch. 2:
  necessary-and-sufficient against family-resemblance structures; the negative pole; the gray zone.
- Colin Elman, "Explanatory typologies in qualitative studies of international politics",
  *International Organization* 59 (2005), 293–326: compression and expansion of property space,
  after Paul F. Lazarsfeld and Allen H. Barton; reification; puzzle relabelling.
- David Collier, Jody LaPorte and Jason Seawright, "Putting typologies to work", *Political Research
  Quarterly* 65 (2012), 217–232: the template for a typology, and its errors.
- Kenneth D. Bailey, *Typologies and Taxonomies* (Sage, 1994), ch. 1: types and cases; monothetic
  and polythetic classes; ideal and polar types.
- Charles C. Ragin, *The Comparative Method* (University of California Press, 1987), chs 6–7, and
  *Redesigning Social Inquiry* (University of Chicago Press, 2008), ch. 8: the truth table; limited
  diversity; remainders and simplifying assumptions; counterfactual and matched cases.
- Klaus Krippendorff, *Content Analysis*, 4th edn (Sage, 2019): coding, context units, semantic
  validity.
- Douglas Walton, Chris Reed and Fabrizio Macagno, *Argumentation Schemes* (Cambridge, 2008),
  schemes 14–17: argument from verbal classification and its critical questions.
- Joanne E. McKenzie and Sue E. Brennan, ch. 12 of the *Cochrane Handbook for Systematic Reviews of
  Interventions*, 2nd edn (Wiley, 2019); Mhairi Campbell et al., "Synthesis without meta-analysis
  (SWiM) in systematic reviews", *BMJ* 368 (2020), l6890; David Ogilvie et al., "The harvest
  plot", *BMC Medical Research Methodology* 8 (2008), 8: tables of studies; vote counting; the
  ambiguous null.
- David Collier, "Understanding process tracing", *PS: Political Science & Politics* 44 (2011),
  823–830: the four tests, and that assigning one is a judgement.
- Daniel Silver, "Figure It Out!", *Sociological Methods & Research* 49 (2020), 868–905:
  cross-classification and slotting; W. Baldamus on cross-classification's missing stopping rule,
  cited through Silver (p. 880).
