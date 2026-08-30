# What Ipsissima records on a claim

Argdown says how to write a map. This says what Ipsissima puts in one, and why. Every field here
is either drawn on screen or checked by `check_argdown.py`; none is decoration.

The one idea behind all of it: **a reconstruction is a claim about someone else's text, so a
reader must be able to check it.** That means every claim says where it came from and how far it
stands from the author's own words.

---

## 1. Provenance — where the claim came from

Attach it as you write. Retro-fitting means re-reading the whole source, and costs more than the
map did.

```argdown
[The state may override freedom]: The law may restrict personal freedom to protect people
from themselves.
    {fidelity: "quotation", pinpoint: "p. 14",
     source: "\"the law may restrict personal freedom to protect people from themselves\""}
```

| field | what it does |
|---|---|
| `chapter` | path to the source file. **Without it a claim cannot be placed in the text at all** — no Manuscript link, no exposition view. Declare it once in front-matter `defaults:` rather than on every claim |
| `source` | the author's exact words, in quotation marks. **The most valuable field there is**: it is verified against the file character by character, and pins the claim to an exact line. Quote wherever you can |
| `section` | only when a claim has *no* quotation and the source prints a heading to name. A verified quotation has already pinned the line |
| `pinpoint` | page or section, for a human reader |
| `note` | prose: why this reading, what was compressed, what was left out |
| `reviewed` | date of the pass. Front-matter `defaults:` |

**Quote exactly what the converted source says, including its errors.** Converted text carries OCR
damage — `on its hack` for "back", `A and B and G` for "C". Quotations are checked character by
character. If the passage you want is damaged, quote a clean span nearby or do not quote at all.
**Never silently correct the source inside quotation marks.**

**If a claim joins two passages that sit far apart, say so** — in the claim text with an elision
(`'…one half… the other half'`) or in its `note:`. Compressing distant material is legitimate and
often captures the meaning better than either passage alone; what it must not do is leave a reader
to discover the join. The checker reports these, so you will be told; it is cheaper to note it as
you write.

---

## 2. Fidelity — whose words are these

Mark every claim. When you are mapping someone else's work, this distinction *is* the scholarship.
The map draws it as the border of the box, so it is visible without opening anything.

| `fidelity:` | means |
|---|---|
| `quotation` | **the claim's own text is the source's exact words** |
| `paraphrase` | close restatement in your words |
| `compression` | several sentences reduced to one claim *(the default if unmarked)* |
| `interpretation` | a reading the text supports but does not state |
| `imputation` | a premise the argument NEEDS and the author never states |

> **`fidelity` describes the CLAIM TEXT, not the `source:` field.** A quotation sitting in
> `source:` does not make the claim a `quotation`. If the claim text is your summary it is a
> `paraphrase`, however exact the supporting quotation is.

**You do not have to get this one right.** `quotation` is the only level with a fact of the
matter, so the checker computes it rather than believing you: it takes the claim's own text, looks
for it in the cited source, and reports every mismatch. Mark your best guess and run the checker.

**And it is more forgiving than it looks.** The comparison normalises **punctuation, quotation
marks, dashes and case**, so none of these stops a claim counting as a quotation:

| still a `quotation` | |
|---|---|
| dropping a leading *"Recall that"* | you may quote from mid-sentence |
| `“curly”` against `"straight"` | and en-dash against hyphen |
| lower-casing an opening capital | to fit the claim into your own syntax |
| removing the parentheses from *"spatial (and sensorimotor) strategies"* | punctuation only |

What it does **not** forgive is changing a word, or joining two passages that are not adjacent —
which is a `splice`, reported separately. Knowing this is worth saying out loud: a reconstruction
that did not know it spent ten pre-emptive corrections downgrading claims that were quotations
all along.

This became a check because instruction did not work. The first test of these instructions got the
marker wrong 8 times in 14; stating the rule explicitly halved the rate on the next paper and did
not remove it; across six reference reconstructions 38 of 126 were wrong, always in the same
direction. A claim carrying an exact quotation *feels* like a quotation.

**`imputation` matters most and is most often left invisible.** A text that dramatises its
conclusion rather than asserting it — a dialogue, a satire, a thought experiment — has an
*imputed* contention. Saying so is not a weakness of the reconstruction; concealing it would be.

---

## 3. Warrant — why a departure is allowed

Every `interpretation` and `imputation` gets one line saying why the reading leaves what the text
says.

| `warrant:` | the reading says |
|---|---|
| `enthymeme` | the argument is invalid without it and plainly relies on it |
| `hyperbole` | read as overstatement rather than as the position |
| `sloppy-phrasing` | read as imprecise expression of a different claim |
| `secret-sign` | read as a signal to knowing readers rather than at face value |
| `other-texts` | supported by what the author says elsewhere |
| `coherence` | chosen because it makes the surrounding text hang together |
| `convention` | the field's standard reading of this passage |

The first three are Stern's: they are the devices by which an interpreter reopens a text that
stated its position plainly, and the reasoning runs backwards — *because* this is implausible, it
is open that it was merely hyperbole. Using one is not forbidden; sometimes the reading is right.
Using one **silently** is, because then the pattern is invisible.

Any short reason is accepted; the vocabulary is a prompt, not a jail. What matters is that it was
written down, because **the pattern across a file is the thing worth seeing** — three claims read
as hyperbole is a decision about the author, and nobody notices making it one claim at a time.

Use `note:` alongside for the prose.

---

## 4. What the reconstruction is trying to be

The same map can be excellent as a report of what a text says and poor as a reading of what it
*should* say. Until the aim is declared there is **no fact about which yours is**.

This is an old distinction with a name. Betz and Brun ask a reconstruction to be both
*systematically correct* — valid, non-circular, free of irrelevant premises — and *exegetically
adequate*, meaning that it accounts for the text it came from; and they argue that the two pull
against each other, which is why one text supports several legitimate reconstructions at once
(Brun and Betz 2016; restated in [DeepA2](https://arxiv.org/abs/2110.01509) §3.1). **The four
fields below are how a file declares where it sits on that trade-off.** Ipsissima checks only the
exegetical half — whether the reading fits the words — and says nothing about whether the argument
reconstructed is any good.

```argdown
===
title: Author YEAR — short title
reconstruction:
    generated: true
    aim: fit
    unit: meaning
    mode: coherence
    strength: ordinary
defaults:
    chapter: "source/paper.md"
    reviewed: "2026-08-27"
===

[A claim]: Statements follow, after a blank line.
    <+ [A reason]: Because of this.
```

| field | values |
|---|---|
| `aim` | `fit` — what the text says · `appropriation` — the best philosophy in it |
| `unit` | `meaning` — which sense of the words · `commitment` — which view is held |
| `mode` | `coherence` · `truth` · `soundness` · `agreement` · `interest` |
| `strength` | `minimal` · `ordinary` · `strong` — how much better than his words the author is assumed to be |

`unit`, `mode` and `strength` are **Tom Stern's three dimensions along which "the principle of
charity" is ambiguous**. They are not bureaucracy and they are not obvious: `coherence` and
`truth` are both called charity and can point opposite ways about the same passage, and a reading
that is charitable at one `strength` is uncharitable at another. Declaring them is what makes
*"this reading is uncharitable"* a claim someone can argue with rather than an appeal to a
principle that names no single thing.

**If you have not read Stern, read §2 of `reconstruction-cheatsheet.md` before choosing these
values.** It sets out each dimension with the example that shows why it matters, and explains
where the `warrant:` vocabulary above comes from — `hyperbole`, `sloppy-phrasing` and
`secret-sign` are Stern's own three devices for reopening a text that said something plainly.

**`generated: true` matters, so do not omit it when a model wrote the file.** It tells the checker
that nobody has judgement invested in the `quotation`/`paraphrase` markers yet, so it may correct
them against the source rather than only reporting them. A hand-built reconstruction is someone's
work and is never written to without being asked. Remove the line once a person has curated the
markers.

---

## 5. Tags

**Tags say whose claim it is.** They do not say how important it is — the map works that out.

A reconstruction mixes claims from several hands: the author's own, views the author sets out in
order to argue against, things the author concedes, and objections that are nobody's but the
reconstructor's. Prose carries that distinction easily ("Queloz argues…", "even granting that…",
"one might object…"). A map loses it, and a reader then cannot tell a position the author holds
from one they are attacking.

| tag | the claim is |
|---|---|
| *(untagged)* | **the author's own, asserted.** The common case, and it costs nothing |
| `#reported` | **a view the author sets out but does not hold** — an opponent's position, a rival hypothesis, the theory under examination |
| `#conceded` | **something the author grants tells against them** — Govier's *counterconsideration*, and the scope limits an author sets on their own thesis |
| `#contested` | **an objection that is not the author's** — a critic's, or the reconstruction's own |
| `#authority` | **a proposition whose force comes from its source, not from its content** — a decided case, a statute, a constitutional instrument. Chiefly for legal texts |
| `#obiter` | **said in a legal judgment, but not a necessary step to the disposal** — the court's own remarks *by the way*. The untagged steps on the route to the order the court made are its *ratio*; this marks what sits off that route |

Each answers a question the structure cannot: nothing about the shape of a graph reveals that a
claim is Hume's rather than the paper's.

### `#authority`, and the thing it half-fixes

An authority is not a reason in the ordinary sense. *The King hath no prerogative but that which
the law of the land allows him* supports the claim it hangs under **because a court decided it in
1611**, not because a reader finds it plausible. Article 9 of the Bill of Rights binds whatever
anyone thinks of it. Drawn as a bare `<+`, both look exactly like evidence, and a reader cannot
tell from the map which supports are arguments and which are citations.

It earns its place on the three tests below: the structure cannot compute it, it recurs wherever a
judgment cites its authorities, and *"show me only what this judgment rests on"* is the first
question a lawyer asks of a case. Tag the **cited proposition**, not the claim it supports.

**What it does not fix, and what to do instead.** Miller exposed `<+` doing three different jobs:
evidential support, institutional authority, and jurisdictional precondition — the last being
something that must hold before a court may rule at all. Argdown has one arrow for all three, and
**this project does not invent syntax**: a map that used a private relation would stop being
Argdown, would not parse anywhere else, and would fail the promise that Ipsissima displays the
language rather than a dialect of it.

So:

- **institutional authority** → tag the cited proposition `#authority`;
- **jurisdictional precondition** → usually a modelling mistake rather than a notation gap. A
  precondition is a *premise* of the step it conditions, so put it in the premise-conclusion
  structure instead of hanging it off the conclusion as support;
- **anything still overloaded** → say so in the claim's `note:`. A limitation a reader is told
  about is a limitation; one they must infer from a flat arrow is a misreading waiting to happen.

That last rule is general. **Where the notation cannot carry a distinction the argument turns on,
the note carries it** — and the reconstruction is more honest for saying which distinction the map
is not drawing.

### Why there is no `#core`

There was, and it did not work. It was a reader's estimate of which claims the argument rests on,
applied by hand — and across the published samples it marked 27% of the claims in one map and 65%
in another, so the chip meant something different in every file. Nothing could check it against
the argument it described.

The map now computes it. The **spine** control draws only claims that hold something up: remove
one and part of the argument loses its route to a contention. That is a different measure from the
*how much* ladder, which reveals the map outward from the contention by distance — a claim five
steps out that holds up twenty others is spine and the ladder shows it last; a claim beside the
contention that holds up nothing is a remark and the ladder shows it first.

`#background` went with it. It turned out to mean two unrelated things: in three of the five
samples it was marking **someone else's view** — Hume's, Williams's, Queloz's — which is now
`#reported`; in the other two it was marking the author's own asides, which need no tag at all.

### When to add a tag of your own

A new tag earns its place when it names something that

1. the structure **cannot compute** — not importance, not centrality, not depth;
2. **recurs** across the map, so a chip is a filter rather than a label; and
3. a reader would actually **want to filter on**.

Field- or text-specific tags are legitimate on that test. A book symposium reconstructing one
author against another may want that author named. What does not earn its place is a second word
for something the map already knows.

## 6. House style for claims

- **Titles are prose.** `[The state may override freedom]`, not `[state-override-freedom]`.
  Argdown titles take spaces, capitals and punctuation, and every published Argdown document uses
  them that way. They are read by people.
- **Never let a negation drop out of a title.** `[Sufficient reason]` for the claim *There is no
  sufficient reason* inverts the node everywhere the title appears.
- **One claim per statement.** If it needs "and" or a semicolon, it is probably two.
- **Record objections as objections**, not as smoothed-over qualifications. A reconstruction with
  no attacks is usually a misreading.
- **Do not invent claims.** If the source raises a point and drops it, record the dropping as a
  `#conceded` claim rather than silently completing the thought.
- **Group with headings** — `# Part {isGroup: true}` — which add structure without adding nodes.

---

## 7. What the checker will tell you

```bash
ipsissima-check FILE.argdown --source-root DIR --format json
```

It reports, and each of these is worth acting on:

- **quotations that do not verify.** An absent quotation is a fabrication, not a typo.
- **the apex** — the claims supporting nothing. These should be the paper's conclusions and
  nothing else. More than one is fine where the paper argues more than one thing; a long apex
  list usually means framing material that was never attached.
- **disconnected claims**, wired to nothing.
- **unwarranted departures** — an `interpretation` or `imputation` with no `warrant`.
- **quotation context** — what each verbatim span was cut away *from*. A quotation can be exact
  and still misreport: a hedge left just outside the quotation marks, a *some* used to support an
  *all*. This is the check the project exists for.
- **claims reaching no contention**, which in a finished map is a cut list.
- **interpretive load** — how much of the route to each contention is the reconstructor's own.

See also `argdown-cheatsheet.md` for the notation and `reconstruction-cheatsheet.md` for the
method.
