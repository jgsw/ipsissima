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

Without the MCP server, **read all three in one call**, not three:

```bash
cat ipsissima-mcp/docs/argdown-cheatsheet.md \
    ipsissima-mcp/docs/reconstruction-cheatsheet.md \
    ipsissima-mcp/docs/ipsissima-conventions.md
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

**2. Read the source once, whole, before you start.** Runs that read it in nine or fourteen pieces
paid for each piece. Read it complete, then re-read only the passage you are quoting.

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

---

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
