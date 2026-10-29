# Reconstruct an argument as Argdown

*Served to the client by the MCP `prompts` primitive, and loaded fresh on every run. Edit it
freely — improving a reconstruction should mean editing a document, not shipping a release.*

You are given a source text and asked to reconstruct its argument as an `.argdown` file. Your
output is a **scholarly claim about someone's work**, so it must be checkable, honest about what
is yours, and structurally correct. Those three, in that order, matter more than covering every
sentence.

## What the file is for

The file is read by people who question it, not only look at it. It holds several layers of the
text, and each feeds a way into it in Ipsissima. A choice you make here decides whether a reader's
question there has an answer:

| layer | the way in it feeds | so record |
|---|---|---|
| the argument: claims, reasons, objections | **What if…?** supposes a claim false and fades what loses its support; **Study** asks where premises lead; **Which claim would cost the most?** | linked and convergent as the text has them, since a supposition follows them exactly; every objection with the reply the text gives it |
| rival accounts (`#reported`, `#contested`) | **Weigh the accounts**: each account with the reasons the text gives for it and against it | each reason's relation to *every* account it bears on, where the text states it. Nothing more: a reason the text gives only against the rival stays only against the rival |
| the order of telling (provenance) | the **Exposition** view and the walkthrough | provenance on every claim |
| the causal chain | the **Mechanism** view | as far as the argument relies on it (`argdown_method("mechanism")`) |
| the text's question | the question the map opens on, and Study's first card | `questions:` in the front matter (id to `{text, pinpoint}`), in the text's words where it asks one; a claim that moves on one says how, `question: {id: q1, move: answers}`: answers, reframes, splits or dissolves (the conventions, §6) |
| a set the text says cannot all hold | **These cannot all hold**: which would you give up, and what would it cost? | the same `inconsistent:` name on each member (the conventions, §6); a pair that contradicts is drawn `><` instead |
| the text's comparisons | the **Tables** panel, and **Weigh the accounts** where it declares rival accounts | `frames:` and `about:`, read with every argument (`argdown_method("tabulation")`); `frames: none` where the text compares nothing |

Three duties govern every layer (B11 of the project's values):

1. **Every layer answers for its distance from the text.** Fidelity and warrant apply to a step
   in a chain or a cell in a table as they do to a claim. A frame's label, a value's label and a
   question's text are the text's words only where they carry quotation marks inside the value
   (`label: "\"(i) P is true\""`), and are then verified; otherwise they are yours.
2. **A layer records only what the text supplies.** An absence stays an absence. Where the text
   gives no reason against its own account, the grid shows an empty cell, and that empty cell is
   the reader's best question. Do not fill it with a reason the text does not give. "Nothing to
   draw" and `depth: none` with its reason are results, not failures.
3. **A layer earns its place by what a reader can do with it.** Record what makes the questions
   above answerable. Do not add structure that no way in uses.

## Read these first

Three reference documents carry what you need for the argument. **Read all three before writing
any node**: every round of the check-and-fix loop costs more than reading them does. The order of
work below adds two more, the mechanism and the comparisons, read with them.

| resource | what it gives you |
|---|---|
| `ipsissima://argdown/syntax` | **the whole language.** Do not write Argdown from memory: there is very little of it in the world and confident guesses do not parse |
| `ipsissima://reconstruction/method` | **how to reconstruct.** Finding the conclusion, the Assertibility Question, linked vs convergent, what to do about what is not said |
| `ipsissima://ipsissima/conventions` | **what Ipsissima records.** Provenance, fidelity, warrants, tags, front matter |

Through the MCP server, `argdown_method("all")` serves these, the mechanism and the comparisons
together, in two or three calls.

**Some texts need one more**, read with the rest before writing any node:

| when the text is… | read |
|---|---|
| a court judgment | `argdown_method("judgments")` |
| a working draft | `argdown_method("drafts")` |
| wholly dramatised: a satire, a dialogue, a persona's case | `argdown_method("dramatised")` |
| deductive at a step you would name a rule for, or wants formal logic | `argdown_method("formal")` |
| built on the macro-micro-macro (Coleman) diagram | `argdown_method("coleman")` |
| causal, and says more than the notation's ordinary marks hold: nested levels, a possibility, a measure, a blocker, a regime or threshold, a step that acts on itself, what an actor faces and does | `argdown_method("rarer-marks")` |

Working from the command line rather than through the MCP server? `SKILL.md`, beside these
documents, has the commands, the read sizes and the traps.

---

## Round trips cost something; the thinking costs most

Measured across five runs, a reconstruction took 37 to 45 tool calls whatever the paper, and the
rules below took one passage to six. That cut the tokens by 31%, not 85%: **the bulk of a
reconstruction is the thinking**, and one deliberative turn on that run emitted 44,411 tokens. So
follow these rules, and **do not trade a worse reading for a shorter run**.

1. **Read each method document once**, before the source, and never fetch it again.
2. **Read the source once, whole, before you start**, in as few reads as your tools allow; then
   re-read only the passage you are quoting.
3. **Do not verify quotations one span at a time.** The checker verifies every span in one call,
   and names each that fails with the text it found.
4. **Never run the checker twice on an unchanged file.** One call carries the faults and, once
   none remains, the census.

If a turn would think for longer than your conversation's cache lasts (five minutes on some
setups), prefer several ordinary turns to one enormous one.

---

## The order of work

One order for every layer of the map. The mechanism and tabulation documents say what their layer
adds at these steps, by these numbers; they have no order of their own.

### 1. Read the method

The documents above, before the source. With them, the mechanism, under the method in force:
`argdown_method("mechanism")` (the parallel method, by default: the causal chain is read with the
argument, as far as the argument relies on it), with `mechanism-method` and `mechanism-notation`;
and the comparisons, `argdown_method("tabulation")`. Under the series method
(`IPSISSIMA_MECHANISM_METHOD=series`) the mechanism is instead a separate pass, run only when the
user asks for it, on the finished map.

### 2. Read the source, whole and once

As you read, note four things:
- what the text asks;
- what it concludes;
- what it sets side by side: its tables, its numbered cases and studies, "by contrast", options and
  criteria, rival accounts of one thing;
- where its case rests on what brings what about: for each section, whether it justifies,
  explains, or both.

### 3. The skeleton, before any claim

**(a) The question, and its answer.** The text's question goes under `questions:`, in its words
where it asks one. The conclusion is its answer: the claim the author wants you to accept by the
end, not the topic and not the title. A paper may conclude more than one thing; the method says how
to tell a second conclusion from an intermediate one.

**(b) The form, and the frame that comes with it.** Name the form: elimination of alternatives,
refutation by counterexample, reductio, inference to the best explanation, dilemma, argument from
analogy, conductive weighing. Several forms bring a comparison with them (the method's table of
forms says which). Declare it under `frames:` now, with the other comparisons the text sets out,
or write `frames: none` and say why in a `//` comment.

The form is the map's skeleton. **Working section by section through the text instead produces a
map that mirrors the table of contents and hides the argument.**

**On a refutation, put the failure claim at the apex.** When the thesis is that a target fails,
join the failure claims into a contention the counterexamples support, and draw the reported
target as ATTACKING that contention (`<- [Target]` beneath it) — never the reverse, and not
`><`: an attacked or contradicted node with no outgoing edge still "supports nothing", and the
computed apex then comes out as the very thing the paper demolishes.

Two qualifications. The form shapes the wiring and is **not recorded** — no field holds it and no
check verifies it. And a text of any length uses several: name the top-level move once, then name
a form for each `<Argument>` you build. A single label at the top describes none of the arguments
inside it.

**If the source is a court judgment**, read `argdown_method("judgments")` first: the conclusion is
the disposal, and *obiter* has its own rule.

**(c) The mechanism's skeleton.** Its question, contrast, actors, states and chains, and how far to
map it: `depth` is `full`, `sketch`, or `none` with its reason. Judge that by what the argument
relies on, never by how often the text uses causal words. If the user wants the argument alone,
record `depth: none` with that as the reason.

Let each part decide things in the others: the contention usually supplies the mechanism's
question, and the frame often is the form.

### 4. Rebuild the lost tables the frames use

Extraction names each table the text cites that did not come through as a table. Now you know which
of them a frame uses. Rebuild those from their pages (`page_images`, `repair_source`), before you
write the claims that quote their cells. A table no frame uses is left as it is.

### 5. Fill the map, backwards from the conclusion

For the conclusion, ask what immediate reasons the text gives for it. Then ask the same of each
reason, until you reach what the text simply asserts. Where the author's intention is unclear, use
the **Assertibility Question**, and use it with the discipline that makes it honest: generate the
candidate reasons, then check whether the author actually asserts or clearly assumes them. If they
do not, **drop the candidate rather than attribute it.**

**One pass, everything attached as each claim is written:** its provenance and fidelity; `about:`
where it states a cell; `causes:` where it states a step; `question:` where it moves on a declared
question; `echoes:` where the text states it elsewhere. Retro-fitting any of them means re-reading
the source, and a second pass over a finished map costs more than the map.

Use the **whole language**, not the part of it you are sure of:

- an objection that denies a premise is an **attack** (`<-`)
- an objection that grants the premises and denies that they license the conclusion is an
  **undercut** (`<_`) — *"even if that were so, it would not show…"*. Philosophical objections are
  undercuts far more often than reconstructions record
- two claims that cannot both be true are a **contradiction** (`><`)
- reasons that work only together go in one premise-conclusion structure; reasons that each stand
  alone hang as siblings
- **in a structure with more than one step, every inference line says what it uses** —
  `-- {uses: [1, 3, 4]} --`, naming the lines by the numbers the file gives them. With a single
  step there is nothing to declare. With two or more, leaving it out makes the map read the
  inputs off the order of the lines, which is a guess, and a wrong one wherever a step reaches
  back to an earlier premise or skips one belonging to a sibling step. The bar the map draws
  asserts the claims gathered onto it stand or fall together — `uses` is what makes that
  assertion yours rather than the layout's
- **name a rule only where a step really is deductive** — where it would be *invalid if a premise
  were removed*. Most philosophical argument is conductive, and a rule name claims the conclusion
  *follows*, which the checker then tests. How to name and formalize a rule:
  `argdown_method("formal")`. **Never write `formalized:` yourself**: it is a person's stamp

**And where the language runs out, say so rather than inventing.** `<+` is one arrow doing several
jobs: a reason a reader can weigh, a precedent or statute that binds whatever anyone thinks of it,
and a condition that must hold before the question can be reached at all. Argdown does not
distinguish them and **this project does not add syntax** — a private relation would stop the file
being Argdown and would not open anywhere else.

So use what the language does have. A cited authority gets `#authority` on the **cited
proposition**. A precondition is usually a *premise* of the step it conditions rather than a
support hanging off its conclusion, so put it in the premise-conclusion structure. And when a
distinction the argument turns on still cannot be drawn, **write it in the claim's `note:`** — a
limitation the reader is told about is a limitation, while one they must infer from a flat arrow
is a misreading waiting to happen.

**And where the text underdetermines the reading, say which reading this is.** A claim you
settled by choosing among live interpretations is a **crux**: tag it `#crux`, and let its `note:`
name the reading followed and the road not taken. A local rival may be reported beside it; a rival
that would re-wire the argument is a sibling file (the conventions, §5, have the rule). A map of an
old or contested text with no cruxes is usually claiming a determinacy the text does not have.

**Record where the text announces what it argues, as you write.** A text states its thesis more
than once: announced in the abstract or the roadmap, argued in the body, restated at the end.
Place the claim where it is argued, and put the other places in its `echoes:` (the author's
words, verbatim, one span or a list), so a reader of the Exposition view meets the thesis where
the text first states it. You have the whole text in mind already (rule 2), so this costs a line,
not a pass. An echo is a *statement* of the claim, never a question, a promise to discuss it,
or its denial by someone the author answers. Do it for the contentions and for what each
section argues; do not hunt for every restatement.

**A wholly dramatised text** (a satire, a dialogue, a persona's case set out to be seen through)
is mapped by its own rules: read `argdown_method("dramatised")`.

### 6. The bridge pass

Where the mechanism enters the argument through a bridge (a causal scheme named on an inference
line), check its precondition and look in the text for what its questions ask. Mark what the text
answers; leave what it does not, since its silence is the finding. The mechanism document has the
schemes and their questions.

### 7. Check, and fix what it finds

```
argdown_check(path=..., source_root=...)
```

Apply what it reports and run it again. **Fix the claim it names — do not rewrite the map.** A
failing quotation is one claim to re-quote, not a reason to start again.

`findings` is what to fix. While a `!` fault remains, that is all the reply carries, with the
census's EXPOSITION block as `exposition`: the census would change with your fixes, so it waits.
Once no `!` remains, `census` comes with the findings: the shape of the finished map — the apex,
the tags, what reaches a contention, the fidelity counts. Read it from that same result (rule 4).

**Stop when the `!` findings are gone**, not when the report is empty. `!` is a fault; `?` is
something to look at, and some of those are judgements you are entitled to make differently —
a claim whose text is the author's words but which declares `paraphrase` is reported, and is
sometimes exactly right. `ok` is `true` when no `!` remains; the `?` findings come back beside
it, so read them once before you stop and act on the ones you agree with.

**And take the exposition step, in the same edit as your first round of fixes.** The map is built
from the conclusion backwards, which is right, and it leaves the text's own order thin in
predictable places. The `EXPOSITION` block names them from your first check (as `exposition` while faults remain), each with
the sentence you need to judge it. So this needs no second reading of the source, and done
alongside the fixes it costs no extra round trip: the next check verifies both.

- a **contention the text states well before the place it is argued**, with no echo recorded:
  if the sentence states the claim, add it to the claim's `echoes:`;
- an **abstract, introduction, summary or conclusion with nothing mapped**, or a paper's
  **opening with nothing mapped**: where it restates a claim, add an echo;
  where it asserts something the argument uses, add the claim; where it argues nothing the map
  needs, leave it. *Adds anchors, never argument*: this step does not rewire the map.

That is the whole step: measured at a minute or so of judgement on four or fewer items, and
one edit. Nothing else depends on it, so **if you have been asked for speed above the Exposition
view, skip it.** The block's
last line counts what only a **full exposition pass** would take up: every other unmapped
section, and a book's chapter openings. That pass is optional, because on a long text it means
reading pages again. Take it only when the map is for close reading; the checker can then
propose every place a claim's words recur (`SKILL.md` has the command).

### 8. Before you stop

**`ok` alone is not the finish line — read `verified` beside it.** `ok` says nothing was wrong
with what the run looked at. `verified` says whether the quotations were among what it looked at,
and that is true only when you passed `source_root`. **`ok: true, verified: false` means no line
of the map has been compared with any text**, which is not a checked reconstruction however clean
the report reads. Pass the folder holding `source/` and run it again before you stop.

Once the map is `ok` and `verified`, read the census's layers once each, and act on what the text
supports:
- **CHAIN:** answer each `? island` and `? pieces` (the mechanism document, *What meets*): find the
  link the text makes, or record with `apart:` that it keeps the piece apart. Never invent a link.
- **FRAMES:** a case declared and placed nowhere, or a cell given two values. Does the text say
  both? An empty cell stays empty. Then the rival accounts: for each question the census lists
  without them, does the text set two or more answers against each other and weigh them? Declare
  those it does as an account frame with `question:` (the tabulation document, *Two families*), and
  leave the rest. Do the same for a rival's step the census says no frame sets beside its rivals.
- **QUESTIONS:** a question no claim moves on. Mark the claim that does, or drop the question.

Then check the map against the list below, and stop.

---

## If the text is a draft

A working draft has not finished arguing, and the ordinary rules would invent its conclusions.
Declare `draft: true` in the reading policy and read `argdown_method("drafts")`.

## What a finished reconstruction has

1. **The paper's own conclusions at the apex, and nothing else there.** A paper may argue for
   more than one thing, and where it does the map should say so — two theses drawn as two apex
   claims is a report of the paper, whereas forcing them into one is a claim the paper does not
   make. What does not belong at the apex is loose framing material that was never attached.
2. Every claim placed in the text — a `chapter`, and the author's words quoted verbatim **in
   the claim's own text** wherever they allow; `source:` pins a claim whose text has to be a
   summary. Both are verified, but only the claim text is ever drawn, so a map whose spans all
   hide in `source:` shows the reader none of the words. *Placed*, not *annotated*: declare the
   `chapter` once in the front matter's `defaults:` and override it only where a claim comes
   from a different file.
3. Every claim marked for fidelity, and every departure carrying a `warrant`. **An
   `<Argument>` takes a marker like any other claim, and usually should** — assembling premises
   into a numbered structure is your work even where every step is the author's. The checker now
   names every unmarked node, and on a first draft they are almost all arguments.
4. Objections of the right kind, attributed to whoever made them.
5. The author's hedges and scope intact. *Most* is not *all*.
6. Nothing invented. If the source raises a point and drops it, the dropping is recorded.
7. **Every layer accounted for.**
   - The text's question, under `questions:`, where it asks one.
   - Its comparisons, as `frames:` with claims placed by `about:`, or `frames: none` with its
     reason.
   - Its mechanism, as a `mechanism:` block with its `depth` (`none` with its reason, where the
     argument relies on no mechanism), and `method: parallel` in the reading policy.
8. **Nothing beside it that is not part of it.** If you wrote a scratch map to try the checker's
   conventions, delete it before you finish: the folder handed over holds the `.argdown` and
   `source/`, and a leftover probe wears the same extension as the real map.

## What makes a reconstruction bad

| symptom | cause |
|---|---|
| the map mirrors the section headings | worked forwards instead of from the conclusion |
| every objection is an attack on a premise | undercuts not recognised |
| a whole section of the paper has almost no claims | it was reported, not reconstructed — or, if it is the abstract or introduction, the exposition step was skipped |
| the argument is tidier than the paper's | charity over accuracy |
| an author asserts what they set out to refute | a supposition or reductio read as an assertion |
| a claim says *all* where the paper says *most* | scope not preserved |
| a `because` drawn as support | an explanation reconstructed as an argument |
