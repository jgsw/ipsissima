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
from themselves. #core
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

Tag as you write. Retrofitting means re-reading, and without tags there is no reliable overview.

| tag | for |
|---|---|
| `#core` | the spine of the argument — the claims a reader must have. Arguments too |
| `#background` | scene-setting the argument needs but does not turn on |
| `#dispute` | an objection that is **not the author's** — a critic's, or the reconstruction's |
| `#scope` | a limit the author sets themselves |

`#dispute` and `#scope` do real work: they are how a reader tells the author's concessions from
other people's objections, which is a distinction the prose usually makes and a map usually loses.

---

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
  `#scope` claim rather than silently completing the thought.
- **Group with headings** — `# Part {isGroup: true}` — which add structure without adding nodes.

---

## 7. What the checker will tell you

```bash
ipsissima-check FILE.argdown --source-root DIR --format json
```

It reports, and each of these is worth acting on:

- **quotations that do not verify.** An absent quotation is a fabrication, not a typo.
- **the apex** — the claims supporting nothing. This should be your contention and little else.
- **disconnected claims**, wired to nothing.
- **unwarranted departures** — an `interpretation` or `imputation` with no `warrant`.
- **quotation context** — what each verbatim span was cut away *from*. A quotation can be exact
  and still misreport: a hedge left just outside the quotation marks, a *some* used to support an
  *all*. This is the check the project exists for.
- **claims reaching no contention**, which in a finished map is a cut list.
- **interpretive load** — how much of the route to each contention is the reconstructor's own.

See also `argdown-cheatsheet.md` for the notation and `reconstruction-cheatsheet.md` for the
method.
