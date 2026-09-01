# Reconstruct an argument as Argdown

*Served to the client by the MCP `prompts` primitive, and loaded fresh on every run. Edit it
freely — improving a reconstruction should mean editing a document, not shipping a release.*

You are given a source text and asked to reconstruct its argument as an `.argdown` file. Your
output is a **scholarly claim about someone's work**, so it must be checkable, honest about what
is yours, and structurally correct. Those three, in that order, matter more than covering every
sentence.

## Read these first

Three reference documents carry what you need. **Read all three before writing any node** — they
are short, and every round of the check-and-fix loop costs more than reading them does.

| resource | what it gives you |
|---|---|
| `ipsissima://argdown/syntax` | **the whole language.** Do not write Argdown from memory: there is very little of it in the world and confident guesses do not parse |
| `ipsissima://reconstruction/method` | **how to reconstruct.** Finding the conclusion, the Assertibility Question, linked vs convergent, what to do about what is not said |
| `ipsissima://ipsissima/conventions` | **what Ipsissima records.** Provenance, fidelity, warrants, tags, front matter |

Without the MCP server, **two calls** — the three together are about 55 KB, which is over the
inline cap, so one `cat` of all of them spills to a file you then have to read back. See rule 1
below:

```bash
cat ipsissima-mcp/src/ipsissima_mcp/docs/argdown-cheatsheet.md ipsissima-mcp/src/ipsissima_mcp/docs/ipsissima-conventions.md
cat ipsissima-mcp/src/ipsissima_mcp/docs/reconstruction-cheatsheet.md
```

---

## Round trips are the cost of a reconstruction

**Measured across five runs: 37 to 45 tool calls whatever the paper** — 41 for a 266-word passage
and 44 for a 10,751-word judgment. Applying the four rules below took the same passage to **six**.

Be clear about what that buys, because the same measurement settled it. Cutting the calls by 85%
cut the tokens by 31%, not 85%: **the bulk of a reconstruction is the thinking, not the round
trips**, and one deliberative turn on that run emitted 44,411 tokens on its own. So these rules are
worth following and they are not the main cost. **Do not trade a worse reading for a shorter run** —
that is the one saving this document does not want.

One consequence for a long turn: if you are working in a conversation cached for five minutes, a
turn that thinks for longer than that makes the next request rebuild the whole context. Prefer
several ordinary turns to one enormous one.

**1. Read the reference documents in TWO calls, and never with the source.** Served as MCP
resources this is not a problem. On the command line it is: the three documents come to about
55 KB, which is over the tool's inline cap, so one `cat` of all three does not save a call — it
spills to a file you must then read back, and produces a turn long enough to outlive the prompt
cache. **Two `cat`s of about 30 KB each. Not one, not four.**

**And if a call does spill to a file, READ THE FILE.** Do not re-run the command: it will spill
again, and you will have paid twice for nothing. This is not hypothetical and it is not rare — it
is the single most common way this rule gets broken. One run crammed all four documents into a
`cat`, spilled, re-ran *the same `cat`*, spilled again, and wrote 66 KB to disk twice before a
`Read` finally delivered the text. Two calls wasted, by a run that had this paragraph in front of
it.

A spill is not an error. It is the tool telling you where it put the output, and the next thing to
do is open it.

**2. Read the source once, whole, before you start — in as few reads as the CAP allows.** Runs
that read it in nine or fourteen dribbles paid for each one. Read it through, then re-read only the
passage you are quoting.

**Know the cap before you spend a call on it.** `Read` refuses anything over about **25,000
tokens**, and that limit is SEPARATE from the ~30 KB inline cap that makes a `cat` spill to a file
— so a chunk sized against the one is rejected by the other, having read nothing. Two calls were
lost exactly that way on a 434 KB book: 26,681 tokens and 38,631 tokens, both refused before a word
arrived.

So the arithmetic is: **roughly 90 KB of prose per read, and a source of N kilobytes needs at least
N/90 of them.** A book-length manuscript takes six or seven, not three, and no instruction can make
it take fewer. Size the chunks first; do not discover the ceiling by hitting it.

**3. Do not verify quotations one span at a time.** Two runs spent eleven and thirteen calls
checking `source:` spans individually before ever running the checker. **The checker verifies every
span in the file in a single call** and names each one that fails, with the text it actually found.
Eleven calls to save one is not a saving. Write the map with the spans you believe are right, then
let one check tell you about all of them at once.

**4. Never run the checker twice on the same file.** This was between two and three times as many
invocations as there were distinct versions of the map — six to ten wasted round trips a run —
because the faults came from `--format json` and the census came from running it again without.
**`--format json` now carries the census too**, under `census`: apex, tags, provenance, quotations,
contribution, fidelity, interpretive load. One call is the whole picture. Run it again only after
you have *changed* the file.

---

## The order of work

### 1. Find the conclusion, then the form

The conclusion first — the claim the author wants you to accept by the end, not the topic and not
the title. Then name the **form**: elimination of alternatives, refutation by counterexample,
reductio, inference to the best explanation, dilemma, argument from analogy, conductive weighing.

The form is the map's skeleton. **Working section-by-section through the text instead produces a
map that mirrors the table of contents and hides the argument.**

Two qualifications. The form shapes the wiring and is **not recorded** — no field holds it and no
check verifies it. And a text of any length uses several: name the top-level move once, then name
a form for each `<Argument>` you build. A single label at the top describes none of the arguments
inside it.

**If the source is a legal judgment, the conclusion is the disposal** — the order the court
actually made, not the most interesting proposition in it. Work back from there. The steps the
court expressly or impliedly treated as necessary to reach that order are its *ratio*; everything
else it said is `#obiter`, and belongs on the map, tagged, rather than left out. **Obiter still
has to hang off something.** It is not unrelated to the judgment — it bears on some claim in it,
and only fails to hold up the order — so give it the relation it really has. A statement carrying
no relation at all is not a map node in Argdown, so tagging it `#obiter` and leaving it loose puts
it nowhere: it drops out of the map, out of the tag chips, and out of the reader's view entirely,
which is worse than not marking it. A step in a
judgment usually has the shape *rule of law + facts found → legal conclusion*, so a step with no
rule of law among its inputs is usually missing one. Do not try to state *the* ratio as a claim of
its own: which rule a case stands for is settled by later courts, not by this one, and a map that
records the route to the disposal lets a reader read it off without the reconstruction pretending
to fix it.

### 2. Work backwards from the conclusion

For the conclusion, ask what immediate reasons the text gives for it. Then ask the same of each
reason, until you reach what the text simply asserts.

Where the author's intention is unclear, use the **Assertibility Question** — and use it with the
discipline that makes it honest. Generate the candidate reasons, then check whether the author
actually asserts or clearly assumes them. If they do not, **drop the candidate rather than
attribute it**. The method document has this in full.

### 3. Write the map, with provenance attached as you go

One pass. Retro-fitting `chapter`, `source` and `fidelity` means re-reading the source, and a
second pass over a finished map costs more than the map.

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
- **where a step really is deductive, name the rule and formalize it** — `-- Modus ponens
  {uses: [1, 2]} --`, with `{formalization: "p -> q"}` on every line of that step. Naming a rule
  claims the conclusion *follows*, and that claim is now checked: an invalid step is reported as
  a fault with a countermodel, and the map draws the rule name struck through. **Do not reach for
  this by default.** Most philosophical argument is conductive — independent considerations
  weighed, premises that do not entail the conclusion — and a rule name on such a step claims
  something the author never did. Name a rule when the step would be *invalid if a premise were
  removed*, not when it merely reads as tight
- **never write `formalized:` yourself.** It is a hash of the claim's own text, written by
  `check_argdown.py --stamp` once a human has satisfied themselves that the formulas say what the
  claims say. A value invented here would either mark every step of the file as stale or, worse,
  vouch for an agreement nobody made
- **any rule name is accepted, and these eighteen are abbreviated on the map** — modus ponens,
  modus tollens, hypothetical syllogism, disjunctive syllogism, constructive dilemma, destructive
  dilemma, simplification, conjunction, addition, double negation, de Morgan, contraposition,
  universal instantiation, universal generalisation, existential instantiation, existential
  generalisation, biconditional elimination, reductio ad absurdum. Prefer one of these where it
  is the right name; write whatever is right where it is not, and the map reduces it to initials.
  **The name is not checked against the step** — the verdict comes from the `formalization` lines
  alone — so a wrong name is a silent wrong name, and is worth getting right for the reader

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

### 4. Check, and fix what it finds

```
check_reconstruction(path=..., source_root=...)
```

Without the MCP server, the same thing on the command line:

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py FILE.argdown \
    --source-root DIR --no-fix --format json
```

Apply what it reports and run it again. **Fix the claim it names — do not rewrite the map.** A
failing quotation is one claim to re-quote, not a reason to start again.

One call gives you both halves. `findings` is what to fix; `census` is the shape of the finished
map — the apex, the tags, what reaches a contention, the fidelity counts. **Read the census from
that same result rather than running the command again without `--format json`**, which is what
every run measured so far did, and what rule 4 above is about. `--selection-modes` adds the
node-count table at the cost of six more process spawns; you will rarely want it.

`--no-fix` matters and the MCP tool passes it for you. Without it the checker will *correct the
file's own `quotation`/`paraphrase` markers* whenever the front matter says `generated: true` —
which is helpful once you have decided you want it, and disconcerting in the middle of a run
when you did not ask.

**Stop when the `!` findings are gone**, not when the report is empty. `!` is a fault; `?` is
something to look at, and some of those are judgements you are entitled to make differently —
a claim whose text is the author's words but which declares `paraphrase` is reported, and is
sometimes exactly right. `ok` is `true` when no `!` remains; the `?` findings come back beside
it, so read them once before you stop and act on the ones you agree with.

**`ok` alone is not the finish line — read `verified` beside it.** `ok` says nothing was wrong
with what the run looked at. `verified` says whether the quotations were among what it looked at,
and that is true only when you passed `source_root`. **`ok: true, verified: false` means no line
of the map has been compared with any text**, which is not a checked reconstruction however clean
the report reads. Pass the folder holding `source/` and run it again before you stop.

---

## If the text is a draft

Everything above assumes a text that has **finished arguing**: that there is a conclusion the
author wants you to accept, that the hedges are deliberate, that a chapter which reaches no claim
has been misread rather than left unfinished. A working draft satisfies none of that, and applying
the ordinary rules to one does not produce a cautious map — **it produces an invented one**, because
the only way to clear "the paper's own conclusions at the apex" on a chapter with no conclusion is
to write the conclusion yourself.

**Say so in the front matter**, and the checker will stop treating unfinishedness as a fault:

```
===
draft: true
===
```

Then four things change, and only these four:

**1. A chapter with no conclusion gets no conclusion.** Record the material and say in a `note:`
that the text has not reached one. *"This chapter has not yet reached a conclusion"* is often the
most useful sentence a draft map contains, and nothing in the ordinary instructions lets you write
it.

**2. Material that connects to nothing stays unconnected.** Do not invent a relation to tie it in.
The checker reports an orphan as an observation here rather than a fault, because in a draft it is
usually a passage whose place the author has not settled.

**3. Mark the holes, and mark them as yours.** Where the argument plainly needs a premise the text
does not supply, write it as `fidelity: "imputation"` with a `warrant:`, and say in the `note:`
what the text would have to establish. Used this way the imputations become **a list of what is
left to write**, which is worth more to a drafting author than the claims already there.

**4. More than one apex is a result, not a failure.** If the parts do not yet meet, draw them
apart and say so. Forcing a draft into a single contention hides precisely what its author needs
to see.

**What does NOT change**: every check on the words themselves. A quotation still has to be
verbatim, a fidelity marker still has to match the text it describes, provenance is still
required. Those are facts about the words, and they do not become negotiable because the writing
is unfinished — a draft map that misquotes is not a draft, it is wrong.

**And say what you are unsure of.** A draft is being read to find out what it says. A confident map
of an argument that is not there is worse than an honest one full of gaps.

## What a finished reconstruction has

1. **The paper's own conclusions at the apex, and nothing else there.** A paper may argue for
   more than one thing, and where it does the map should say so — two theses drawn as two apex
   claims is a report of the paper, whereas forcing them into one is a claim the paper does not
   make. What does not belong at the apex is loose framing material that was never attached.
2. Every claim placed in the text — a `chapter`, and a verified `source` quotation wherever the
   words allow. *Placed*, not *annotated*: declare the `chapter` once in the front matter's
   `defaults:` and override it only where a claim comes from a different file.
3. Every claim marked for fidelity, and every departure carrying a `warrant`. **An
   `<Argument>` takes a marker like any other claim, and usually should** — assembling premises
   into a numbered structure is your work even where every step is the author's. The checker now
   names every unmarked node, and on a first draft they are almost all arguments.
4. Objections of the right kind, attributed to whoever made them.
5. The author's hedges and scope intact. *Most* is not *all*.
6. Nothing invented. If the source raises a point and drops it, the dropping is recorded.

## What makes a reconstruction bad

| symptom | cause |
|---|---|
| the map mirrors the section headings | worked forwards instead of from the conclusion |
| every objection is an attack on a premise | undercuts not recognised |
| a whole section of the paper has almost no claims | it was reported, not reconstructed |
| the argument is tidier than the paper's | charity over accuracy |
| an author asserts what they set out to refute | a supposition or reductio read as an assertion |
| a claim says *all* where the paper says *most* | scope not preserved |
| a `because` drawn as support | an explanation reconstructed as an argument |
