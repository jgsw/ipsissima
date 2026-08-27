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

### 4. Check, and fix what it finds

```
check_reconstruction(argdown_path, source_root, format="json")
```

Apply the fixes it reports and run it again until it comes back `ok`. **Fix the claim it names —
do not rewrite the map.** A failing quotation is one claim to re-quote, not a reason to start
again.

---

## What a finished reconstruction has

1. The paper's own conclusion at the apex, and little else there.
2. Every claim placed in the text — a `chapter`, and a verified `source` quotation wherever the
   words allow.
3. Every claim marked for fidelity, and every departure carrying a `warrant`.
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
