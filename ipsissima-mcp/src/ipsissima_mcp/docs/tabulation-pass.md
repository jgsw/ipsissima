# The tabulation pass: the comparisons a text makes, recorded so a reader can work them

A TRIAL METHOD, from 20 October 2026, served only when the user asks for it. It runs on a FINISHED
map that checks ok and verified, and adds to it. It does not rewrite it. It came out of two pieces
of work in October 2026:

- the plan "Tables by design": record coordinates, not tables;
- a census of twelve texts. Every one of them compared things, in four ways on average, and seven
  carried tables of their own, all of which extraction had lost.

Read the four reconstruction documents with it. This document says only what the pass adds.

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
  - `account`: rival accounts.
- `label`: the frame's name, in the text's words where it has one.
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
  `rule: {then: yes, when: {true: yes, believes: yes, justified: yes}, claim: "Definition a"}`.
  The page then shows which rows the rule gets wrong, which is the counterexample. Give only a rule
  the text states, with the claim that states it.
- `note`: optional prose.

```yaml
frames:
  case:
    kind: case
    label: "Gettier's cases"
    pinpoint: "pp. 122-123"
    values:
      I: "Case I: the man who will get the job has ten coins"
      II: "Case II: either Jones owns a Ford or Brown is in Barcelona"
  justified: {kind: dimension, label: "(iii) S is justified in believing that P", values: [yes, no]}
  true:      {kind: dimension, label: "(i) P is true", values: [yes, no]}
  believes:  {kind: dimension, label: "(ii) S believes that P", values: [yes, no]}
  knows:     {kind: verdict,   label: "S knows that P", values: [yes, no]}
```

**`about:` on a claim.** It names the cell or cells the claim states: the case, and the value it
gives on one or more dimensions. Use a list where one claim states several cells.

```
[Smith is justified in believing e]: Smith is clearly justified in believing that (e) is true.
    {fidelity: "quotation", pinpoint: "p. 122", about: {case: I, justified: yes}}
```

A claim may also name two `case` frames together, such as `about: {study: s4, question: use}`.
That puts it in the cell where that study meets that question, which is how Bates's ten studies
are set against the questions they answer. An `account` frame is never named in `about:`. Its
cells are the relations drawn to the accounts' claims.

## The order of work

1. **Rebuild the text's own tables first.** The extraction notes name each table the text cites
   that did not come through as one. Rebuild each from the page image into the source, as the
   conventions say. In the census, seven texts in twelve had such a table, and it was the frame.
2. **Find the comparisons.** Read the text for what it sets side by side:
   - its tables and figures;
   - its numbered studies, cases and examples;
   - "by contrast", "whereas", "unlike";
   - lists of options, of criteria, of dimensions;
   - hypotheses with predictions;
   - rival explanations of one thing.

   For each, ask what the rows are, what the columns are, and what values the text uses. Name the
   text's verdict column if it has one.
3. **Declare the frames.** Use the text's labels and values and give a pinpoint. Do not add a
   dimension the text does not use, however natural it seems: that is slotting. A value the text
   leaves unstated is left unstated. The empty cell is the reader's question.
4. **Place the claims.** Add `about:` to each claim that states a cell. Where the text states a
   cell and no claim on the map carries it, add the claim:
   - at the text's own fidelity, quoting the rebuilt table where that is where it stands;
   - attached by the relation it really has, usually as support for the claim the comparison
     serves. A claim with no relation drops out of the map.
5. **Declare the accounts.** Where the text sets rival accounts of one thing against each other,
   declare an `account` frame naming their claims. Where the text says how a finding bears on each,
   draw each relation (the cheatsheet's "draw its relation to each account").
6. **Check.** Run `argdown_check` with the source root until it reports ok and verified. Then read
   the FRAMES section of the census: each table's size, its empty cells, rows that contradict the
   verdict, and pairs of rows that differ in one dimension.

**Record "no frame" where there is none.** Some texts compare nothing: a single proof, a
manifesto, a satire's one persona. Say so in a `//` comment and stop. A table is worth having only
where the text built one.

## What the trial on four maps taught (20 October 2026)

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
  - `true`, `false` and `null` are not words in YAML: never use them as a frame's id or a value.
  - `yes` and `no` are words, as Argdown reads them, and the checker now reads them the same way.
- **Give a verdict where the text gives one.** The page's move "these rows differ in one
  dimension" needs a verdict column and at least two other dimensions. Without them it is noise.

## What the pass must not do

- **Fill a cell the text leaves empty.** Not from the reconstructor's knowledge, not by
  inference, not "obviously". The empty cell is the finding.
- **Add a dimension the text does not use.** Silver's warning about cross-classification, and
  Baldamus's endless dichotomies, both apply.
- **Rank or total the options.** `ordered:` reports the text's own ordering on each criterion. The
  page may say one option is worse on every count the text weighs; it never adds the counts up.
- **Turn a reason into a coordinate.** A claim supports or attacks what it does. `about:` says
  only what the claim is about.
