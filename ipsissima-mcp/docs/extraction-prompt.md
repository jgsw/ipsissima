# Reconstruct an argument as Argdown

*This is the extraction prompt. It is served to the client by the MCP `prompts` primitive and is
deliberately **self-contained**: assume the reader has not seen any other file in this project.
Edit it freely — it is loaded fresh on every run.*

You are given a source text and asked to reconstruct its argument as an `.argdown` file. Your
output is a scholarly claim about someone's work, so it must be **checkable**, **honest about
what is yours**, and **structurally correct**. Those three, in that order, matter more than
covering every sentence.

---

## 1. Before writing any node

**Find the conclusion first.** What is this text trying to get you to accept? Write it down.

**Then name the FORM.** Almost every philosophical argument is one of a few shapes:

| form | skeleton |
|---|---|
| elimination of alternatives | the candidates are X, Y, Z; none survives; therefore not-P |
| refutation by counterexample | the definition says P; here is a case where P holds and the thing does not |
| reductio ad absurdum | assume P; derive something unacceptable; therefore not-P |
| inference to the best explanation | E is puzzling; H explains it better than the rivals; therefore H |
| dilemma | either P or Q; P is bad; Q is bad; therefore trouble either way |
| transcendental | X is possible only if Y; X is actual; therefore Y |

The form is the map's skeleton. **Working section-by-section through the text instead produces a
map that mirrors the table of contents and hides the argument.** If the text is a dialogue, a
narrative, or a satire, the form is still there — it is just not announced.

### Naming the form is a thinking aid, and it belongs to the ARGUMENT, not the file

Two qualifications, because this instruction is easy to over-read.

**It shapes the wiring; it is not recorded.** No field in the output holds the form and no check
verifies it. Its whole job is to stop you laying claims out in the order the text presents them.
Once the map is wired, the form has done its work — so do not agonise over which label fits, and
do not force a text into one because the list above offers six.

**A text of any length uses several forms, and the file-level label is the weakest claim you can
make.** It describes the *top-level move* and usually describes none of the arguments inside. On
the reference reconstructions in this project the two already come apart:

| map | what its header says | the arguments inside it |
|---|---|---|
| Tooming, 8 pages | "elimination of alternatives" — **one label** | a *linked* three-premise challenge · a **Copy Principle** argument · a **Disanalogy** |
| Darwin, 2 paragraphs | "two conditionals and a conclusion" | Two Conditions · **Selection** · **Divergence** |
| Williams, 12 pages | **"Two parts."** — then names both | **Explanatory** · **Deliberation** |

The Williams is the model: it says the paper has two parts, that the first builds an account
through four numbered propositions and the second is an elimination of alternatives, and it names
them separately. The Tooming is the failure — a single label at the top, and a disanalogy sitting
inside it that the label does not describe.

So: **name the top-level shape once to get the skeleton right, then name a form for each
`<Argument>` you build.** One section may be a reductio and the next an inference to the best
explanation, and a reconstruction that files both under one heading has lost the distinction that
made naming forms useful in the first place.

Say both in the file's opening comment — the top-level shape, then the arguments and what each
is — because that comment is currently the only place either is recorded.

---

## 2. The four rules that are costly and silent

Each of these produces a file that parses cleanly and says something false.

### 2.1 An indented relation runs CHILD → PARENT

```argdown
[thesis]: The claim.          // RIGHT — the objection attacks the thesis
    - [objection]: Why not.

[objection]: Why not.         // WRONG — this says the THESIS attacks the OBJECTION
    - [thesis]
```

**An objection must be nested under what it attacks.** The temptation is to give a big objection
its own top-level block; resist it. If it needs one for its replies, re-open it afterwards:

```argdown
[thesis]
    - [objection]: Why not.

[objection]
    - [reply]: Why that fails.
```

**The tell is the apex list** — the nodes nothing flows out of. Your main contention should be
there. An objection in the apex list is inverted, every time.

### 2.2 Linked vs convergent changes the logic

Sibling `+` relations assert that the reasons are **independent** — knock one out and the rest
still support the conclusion. That is the shape a careless reconstruction falls into and **it is
usually wrong**: most philosophical arguments are linked.

```argdown
[c]: Conclusion.        // CONVERGENT — three independent reasons
    + [p1]: Reason one.
    + [p2]: Reason two.
```

```argdown
[c]: Conclusion.        // LINKED — premises that work only TOGETHER
    + <The Argument>

<The Argument>: One-line gloss. #core

(1) [p1]
(2) [p2]
-----
(3) [c]
```

Ask of every group of reasons: *if I delete this one, does the conclusion still follow?* If not,
they are linked and belong in a premise-conclusion structure.

### 2.3 Make elimination of alternatives visible

Do not bury the candidates inside one premise. Give each its own statement, hang its refutation
off it, and **keep the exhaustiveness claim as its own statement** — "these are the only
candidates" is usually the argument's weakest joint and deserves to be attackable.

### 2.4 One root, not several

If every top-level statement is a separate tree, you have several arguments, not one. Attach the
parts to the main claim by re-opening it later in the file.

---

## 3. Provenance — attach it as you write, never afterwards

Retro-fitting means re-reading the whole source. Every claim gets a metadata block:

```argdown
[some-claim]: The claim, in one sentence. #core
    {chapter: "source/paper.md", fidelity: "quotation",
     source: "\"the author's exact words\"", pinpoint: "p. 14"}
```

- **`chapter`** — path to the source file. **Without it a claim cannot be placed in the text at
  all.** Declare it once in front matter (below) rather than repeating it.
- **`source`** — the author's exact words, in quotation marks, wherever you have them. **This is
  the single most valuable field**: a quotation is verified against the file and gives the claim
  an exact line. Aim to quote for most claims.
- **`section`** — only needed when a claim has no quotation *and* the source prints a heading to
  name. A verified quotation already pins the line; a section can only narrow a finished search.
- **`pinpoint`** — page or section reference for a human reader.

**If a claim joins two passages that sit far apart, say so.** Compressing distant material is a
legitimate thing for a reconstruction to do, and the joined claim often captures the author's
meaning better than either passage alone. What it must not do is leave a reader to discover the
join: mark the elision in the claim text (`'...one half... the other half'`) or record it in the
claim's `note:`. `check_argdown.py` reports claims made mostly of the source's words that join
passages far apart, so you will be told; it is cheaper to note it as you write.

**Quote EXACTLY what the converted source says, including its errors.** Converted text often
carries OCR damage — `on its hack` for "back", `A and B and G` for "C". A quotation is checked
character by character against the file. If a passage you want is damaged, quote a clean span
nearby or do not quote at all; **never silently correct the source inside quotation marks**.

---

## 4. Fidelity — whose words are these?

A reconstruction cannot otherwise distinguish the source's words from yours, and when you are
mapping someone else's work that distinction *is* the scholarship. Mark every claim:

| `fidelity:` | means |
|---|---|
| `quotation` | **the claim's own text is the source's exact words** |
| `paraphrase` | close restatement in your words |
| `compression` | several sentences reduced to one claim *(the default if unmarked)* |
| `interpretation` | a reading the text supports but does not state |
| `imputation` | a premise the argument NEEDS and the author never states |

**`fidelity` describes the CLAIM TEXT, not the `source:` field.** Having a quotation in `source:`
that supports a claim does **not** make the claim a `quotation`; if the claim text is your own
summary it is a `paraphrase`, however exact the supporting quotation is.

**You do not have to get this one right.** `quotation` is the only fidelity level with a fact of
the matter, so the checker computes it rather than believing you: it takes the claim's own text,
looks for it in the cited source, and reports every claim marked `quotation` whose text is not
there. Mark your best guess and run the checker.

This was made a check rather than an instruction because instruction did not work. The first test
of this prompt got the marker wrong 8 times in 14; stating the rule explicitly halved the rate on
the next paper and did not remove it; across the six reference reconstructions 38 of 126 were
wrong, always in the same direction. A claim carrying an exact quotation in `source:` simply
*feels* like a quotation, and no amount of telling you so survives the moment of writing.

**`imputation` is the category that matters most and the one most often left invisible.** A text
that dramatises its conclusion rather than asserting it — a dialogue, a satire, a thought
experiment — has an *imputed* contention, and saying so is not a weakness of your reconstruction;
concealing it would be.

**Every `interpretation` and `imputation` also gets a `warrant`** — one line saying *why* the
reading departs from the text:

| `warrant:` | the reading says |
|---|---|
| `enthymeme` | the argument is invalid without it and plainly relies on it |
| `hyperbole` | read as overstatement rather than as the position |
| `sloppy-phrasing` | read as imprecise expression of a different claim |
| `secret-sign` | read as a signal to knowing readers rather than at face value |
| `other-texts` | supported by what the author says elsewhere |
| `coherence` | chosen because it makes the surrounding text hang together |
| `convention` | the field's standard reading of this passage |

Any short reason is accepted; the vocabulary is a prompt, not a jail. What matters is that it was
written down, because **the pattern across a file is the thing worth seeing** — three claims read
as hyperbole is a decision about the author, and nobody notices making it one claim at a time.

Use `note:` alongside for the prose explanation.

---

## 5. Declare what the reconstruction is trying to be

The same map can be excellent as a report of what a text says and poor as a reading of what it
should say. Until the aim is declared there is **no fact about which yours is**. Front matter:

```argdown
===
title: Author YEAR — short title
reconstruction:
    generated: true     # you wrote this file, not a person — see below
    aim: fit            # fit = what the text says | appropriation = the best philosophy in it
    unit: meaning       # meaning = which sense of the words | commitment = which view is held
    mode: coherence     # coherence | truth | soundness | agreement | interest
    strength: ordinary  # minimal | ordinary | strong — how much better than his words the
                        # author is assumed to be
defaults:
    chapter: "source/paper.md"
    reviewed: "YYYY-MM-DD"
===
```

**`generated: true` matters, so do not omit it.** It tells `check_argdown.py` that nobody has
judgement invested in this file's `quotation`/`paraphrase` markers yet, so it may correct them
against the source rather than only reporting them. A hand-built reconstruction is someone's work
and is never written to without being asked; a file you have just produced is not, and a file
that disagrees with the picture built from it confuses a reader more than it informs them. Remove
the line once a person has curated the markers.

`unit`, `mode` and `strength` are the three dimensions along which the principle of charity is
ambiguous. Declaring them is not bureaucracy: it is what makes "this reading is uncharitable" a
claim someone can argue with.

---

## 6. Writing the file

- **One claim per statement.** If it needs "and" or a semicolon, it is probably two.
- **Stable kebab-case ids**, short and meaningful. **Never let a negation drop out of an id** —
  `[sufficient-reason]` for the claim *There is NOT a sufficient reason* inverts the node
  everywhere the id is read.
- **Record objections as objections** (`-`), not as smoothed-over qualifications. A
  reconstruction with no attacks is usually a misreading.
- **Tag the spine `#core` as you write it**, arguments included (`<The Argument>: gloss #core`).
  Without tags there is no reliable overview view, and retrofitting them means re-reading.
  Useful others: `#background`, `#dispute` (an objection that is not the author's), `#scope` (a
  limit the author sets themselves).
- **Do not invent claims.** If the source raises a point and drops it, record the dropping as a
  `#scope` statement rather than silently completing the thought.
- **Group with headings** — `# Part {isGroup: true}` — which add structure without adding nodes.

### Syntax traps that do not announce themselves

| trap | what happens |
|---|---|
| a blank line inside a relation tree | **severs the tree**; the file fails to parse. Blank lines go *between* top-level blocks, never inside one |
| a lone `--` as an inference line | **silently eats the next statement** as a rule name. Use `-----` |
| an unpaired `_` in statement text | opens an italic range and aborts the parse. Escape as `\_` |
| a bare `[title]` in running prose | parsed as a *definition*. To mention one, write `@[title]` |
| `.A.` `.E.` `.~.` `.v.` `.->.` `.<->.` in any text | silently rewritten to logic symbols. Avoid in headings especially |
| a file of only comments | does not parse. Leave one real statement |

Metadata values are passed through verbatim, so quotes, brackets and underscores are safe inside
`{...}` — which makes metadata the right home for quoted prose.

---

## 7. Before you call it done

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py "<file>.argdown" --source-root "<source dir>"
```

Read the output and fix what it finds. In particular:

- **every quotation must verify.** An `absent` quotation is a fabrication, not a typo.
- **the apex list should be your contention**, and little else.
- **DISCONNECTED** nodes are wired to nothing — attach or remove them.
- **unwarranted departures** — every `interpretation` and `imputation` should say why.
- **the quotation-context report** tells you what each quoted span was cut away *from*: a
  qualifier left outside the quotation marks, a sentence that continues "but…". Verbatim is not
  the same as faithful, and this is where the difference shows.

**Do not report the work as finished until it validates.**
