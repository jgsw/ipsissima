# The text's comparisons, read with the argument

PART OF EVERY RECONSTRUCTION since 22 October 2026 (profile 1.21), on the project's ruling after a
trial on two texts. Tables made while reconstructing were as full as those of a separate pass over
the finished map, the argument was unchanged, and what tabulation added that could be measured was
about 5,000-7,000 tokens a map. Read this with the reconstruction documents, before writing any
node, as the mechanism is read. Where the text compares nothing, the map says so: `frames: none`.

It came out of three pieces of work in October 2026:

- the plan "Tables by design": record coordinates, not tables;
- a census of twelve texts. Every one of them compared things, in four ways on average, and seven
  carried tables of their own, all of which extraction had lost;
- the trials of 20 and 21 October: a separate pass on four finished maps, then the same work done
  while reconstructing, on two texts.

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

## The notation

**`frames:` in the front matter.** One entry per frame. A frame has these keys:

- `kind` (required):
  - `case`: the rows;
  - `dimension`: a column with values;
  - `verdict`: a dimension that is the text's verdict or outcome, shown last and read as what the
    others decide;
  - `account`: rival accounts (unrelated to the mechanism block's `account:`, which says how the
    text reasons about causes).
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
- `rule:` (verdicts only): a rule the text states or reports, as the verdict it gives when the
  dimensions take given values. For example, definition (a)'s "S knows that P iff (i) P is true,
  (ii) S believes that P, and (iii) S is justified in believing that P" becomes
  `rule: {then: yes, when: {holds: yes, believes: yes, justified: yes}, claim: "Definition a"}`.
  The page then shows which rows the rule gets wrong, which is the counterexample. Give only a rule
  the text states, with the claim that states it. A rule here is always "all of these together";
  where the text's rule is any other shape (two of three, any one of), leave it in its claim and
  say in the frame's `note:` why it is not written as a rule.
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

## The order of work, inside the reconstruction's

1. **The text's own tables are rebuilt at extraction.** The extraction notes name each table the text
   cites that did not come through as one, and `argdown_plan` says so before extraction. Rebuild
   each from the page image into the source, as the conventions say. In the census, seven texts in
   twelve had such a table, and it was the frame.
2. **While reading the source whole** (the extraction prompt's rule 2), list what the text sets side
   by side:
   - its tables and figures;
   - its numbered studies, cases and examples;
   - "by contrast", "whereas", "unlike";
   - lists of options, of criteria, of dimensions;
   - hypotheses with predictions;
   - rival explanations of one thing.

   For each, note what the rows are, what the columns are, and what values the text uses. Name the
   text's verdict column if it has one.
3. **With the skeleton** (the extraction prompt's step 1, and the mechanism's skeleton beside it),
   write the `frames:` block. Use the text's labels and values and give each frame a pinpoint. Do
   not add a dimension the text does not use, however natural it seems: that is slotting. A value
   the text leaves unstated is left unstated. The empty cell is the reader's question.
4. **As each claim is written**, add `about:` where it states a cell. Draw a reason's relation to
   each rival account it bears on, where the text states it. Where the text sets rival accounts of
   one thing against each other, declare an `account` frame naming their claims.
5. **A cell the text states that no claim carries** is added as a claim, at the text's own fidelity,
   attached by the relation it really has, usually as support for the claim the comparison serves.
   A claim with no relation drops out of the map. Add nothing for a cell the text leaves empty.
6. **The ordinary check covers it.** `argdown_check` reads the frames. Its census has a FRAMES
   section: each table's size, its empty cells, rows that contradict the verdict, and pairs of rows
   that differ in one dimension. Read it once the map is ok.

**What decides the depth** is the same as for the mechanism. Tabulate the comparisons the text makes
and relies on, not every list it happens to contain.

**Adding tables to a map made before.** A map with no `frames:` was made before the ruling. To give
it tables, read the source again for its comparisons and do steps 3 to 6 on the finished map,
without rewriting its argument. That is the separate pass the trials began with: it reads the
method, the source and the map again, so it costs about as much reading as a reconstruction.

**Record "no frame" where there is none.** Some texts compare nothing: a single proof, a manifesto,
a satire's one persona. Write `frames: none`, say why in a `//` comment, and spend nothing more on
it. A table is worth having only where the text built one.

## What the trials taught (20 and 21 October 2026)

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
- **Keep a study's facts apart from its results** (21 October). A claim about study 1's result goes
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
