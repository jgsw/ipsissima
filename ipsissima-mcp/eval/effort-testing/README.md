# Effort testing

**The question.** A reconstruction is written by a model working at a chosen *effort* level, and
effort is the largest single cost lever the project has. `max` is the most deliberate setting and
the most expensive. If `high` produced a map of the same quality, every reconstruction in this
repository could be made for about a sixth less. So: **is lower effort a safe economy, or does it
buy speed with fidelity?**

That question cannot be answered by looking at one map, because there is nothing to look at it
*against*. This directory holds the same paper reconstructed twice, changing nothing but the
effort level, so that the difference can be read rather than guessed at.

## What is here

**The effort pair** — the same paper at two effort levels:

| | | |
|---|---|---|
| `tooming-max/` | `tooming-jakapi-aphantasia.argdown` | sha1 `974b34945d8e` |
| `tooming-high/` | `tooming-arm-high.argdown` | sha1 `499c08102a82` |

Tooming & Jakapi, *Aphantasia as a challenge for Humean abstraction* (2026), CC-BY 4.0 — the same
paper as `samples/Tooming and Jakapi 2026 …`, whose source text carries the attribution and the
licence note.

**The variance control** — the same paper twice at the *same* effort level, which is what makes
the pair above interpretable, and which turned out to matter more than the pair itself:

| | | |
|---|---|---|
| `darwin-max-run1/` | `darwin-natural-selection.argdown` | sha1 `b74bd81ec1c2` |
| `darwin-max-run2/` | `darwin-natural-selection.argdown` | sha1 `1327dcc6e92d` |

Darwin, *On the Origin of Species* (1859), public domain. Run 1 is the published sample; run 2 was
made on 28 Aug 2026 while measuring a toolchain change and kept for what it says about variance.

**Each arm is a complete folder**, with its own `_quarto.yml` and its own copy of the source, so
that either can be opened in Ipsissima directly and the two put side by side. That costs a
duplicated source file, and buys the thing the directory exists for.

**The filenames differ on purpose.** Each is the name under which that file was checked, so each
still matches its own row in the checker's ledger (`~/.ipsissima/check-log.jsonl`) — and the sha1s
above are the ones the ledger recorded, so the artefacts here are demonstrably the files the
measurements were taken from, not later edits of them.

**`tooming-max/` is a frozen copy, not the sample.** The published sample will be rebuilt again;
this copy must not move, or the comparison stops being a comparison. If they ever need to be
re-synchronised, that is a decision to take deliberately and to note here.

## What the test found

### The headline: −16% tokens, −27% time, and eight faults instead of none

| | tokens | wall | faults on first check |
|---|---|---|---|
| `max` | 207,950 | 24 min | **0** |
| `high` | 174,914 | 18 min | **8** |

The eight break down, from the ledger, as **7 × `! fidelity`** and **1 × `! quotation-context`**:
claims marked `quotation` whose text was not the source's words. The checker caught every one, and
two repair rounds brought `high` to zero faults — the state frozen here.

### The maps are the same size, so this is not a "more for your money" story

The obvious hypothesis — that `max` simply produces a bigger map — is false, and worth killing
first:

| | `max` | `high` |
|---|---|---|
| claims and arguments titled | 110 | 109 |
| premise-conclusion structures | 19 | 20 |
| relation kinds used, of 4 | 3 | 3 |
| has an undercut | yes | yes |
| has a contradiction | no | no |

Two maps of the same scale and the same expressive reach. Whatever the extra effort bought, it was
not quantity.

### What it looked like it bought — but read the variance control before believing it

> **This section's headline did not survive.** It read "`max` stayed twice as close to the author's
> words". Two `max` runs on one paper were later found to differ by as much on the same measure.
> The table below is a fact about these two files; the inference from it to *effort* is not
> supported. See **The variance control** below, and prefer the two signals named there.

| | `max` | `high` |
|---|---|---|
| **fidelity `quotation`** | **55** | **27** |
| fidelity `paraphrase` | 42 | 38 |
| **fidelity `compression`** | **10** | **24** |
| fidelity `interpretation` | 3 | 4 |
| fidelity `imputation` | 0 | 1 |
| verbatim `source:` quotations declared | 108 | 90 |
| words in the file | 7,082 | 7,856 |
| explanatory notes | 39 | 54 |

`quotation` is the highest fidelity a claim can carry, and half of `max`'s claims carry it against
barely a quarter of `high`'s, the difference going mostly into `compression` — the reconstructor's
own summary, which is where a misreading hides. That was the argument. **The variance control
undoes it**: the label turns out to move by as much between two runs of one setting, because it
records how strictly the reconstructor applies the marker rather than how close the map is to the
page.

**The row to look at instead is `source:` — 108 against 90.** Whether a claim carries a checkable
verbatim span at all is far steadier than which fidelity word sits beside it, and that 17% drop is
not reproduced by the control, which moved by one span.

The last two rows say where `high`'s output went: **same map, 774 more words and fifteen more
notes**, explaining the argument rather than quoting it.

Reproduce all of the above from the two frozen files, with the project's own instrument:

```bash
python3 ipsissima-mcp/eval/compare_reconstructions.py \
    ipsissima-mcp/eval/effort-testing/tooming-max/tooming-jakapi-aphantasia.argdown \
    ipsissima-mcp/eval/effort-testing/tooming-high/tooming-arm-high.argdown \
    --source-root-a ipsissima-mcp/eval/effort-testing/tooming-max \
    --source-root-b ipsissima-mcp/eval/effort-testing/tooming-high \
    --label-a max --label-b high
```

### One place `high` scored better, and it is not clearly a win

`compare_reconstructions.py` counts how many of Argdown's seven explicit-direction forms a map
uses, and marks the wider one better: `high` used five to `max`'s three. But look at which:

| | `<+` | `+>` | `<-` | `->` | `<_` |
|---|---|---|---|---|---|
| `max` | 45 | 0 | 20 | 0 | 7 |
| `high` | 12 | 4 | 7 | 9 | 6 |

`max` wrote every relation in the `<` direction — the relation always belongs to the thing it is
indented under. `high` mixed both directions throughout. Argdown means the same thing either way,
so nothing here is wrong; but a document that states relations one way is easier to read than one
that alternates, and the metric as written cannot see that. **Recorded as a finding about the
metric as much as about the arm.**

### Run the checker on them today and they look alike

Both parse, both pass, and today's checker finds 18 observations on `max` and 20 on `high` — all
of them `? fidelity`, the unmarked-fidelity observation added after both arms were written. That
number is *not* the fault count in the table above, and the difference matters: **the eight faults
were what the first check found in `high` and had to be repaired away**, and what is frozen here is
the repaired file. A checker run today sees the two arms after that repair, not before it. The
ledger is the only record of the state that distinguishes them.

### The reading

**`high` is a good default for a draft and a poor one for a shipped sample.** Not because its map
was worse to look at — it is a perfectly reasonable map — but because more of its correctness came
from *the check* than from *the writing*. That distinction is the whole finding, and it matters
because of what the checker can and cannot do:

- A `! fidelity` fault is **mechanical**: a claim says `quotation` and its text is not in the
  source, and a program can see that with certainty. All eight were caught.
- A **misreading** is not mechanical. A compression that quietly gets the author's point wrong
  parses cleanly, checks cleanly, and reads well. Nothing in the toolchain will ever find it.

So the arm that made eight mechanical faults is also the arm whose *remaining* risk the checker is
blind to. **This is the part of the reading the variance control leaves standing**, because it
rests on the fault count and not on the fidelity labels: neither Darwin run made a single such
fault, so eight is not what two runs of one setting look like. The saving is real and the risk is
real, and they are not commensurable —
which is why this is written down rather than settled by the percentage.

**The project's standing choice, on this evidence:** `max` for anything published from `samples/`,
where a map is meant to show the tool at its best and will be read by people who cannot check it
against the paper. `high` is reasonable for a working reconstruction of something you are reading
yourself and can correct as you go.

## Limits, which are substantial

**One paper, one run per arm — and the variance measurement, once taken, cost us the headline.**
See §"The variance control" below. The sentence that stood here on the morning of 28 Aug said the
fidelity gap was "large enough that noise is an unlikely explanation". **That was wrong**, and the
control run showed it the same day. The token figures are a single observation each and should be
treated as one.

**Not controlled for the instructions changing.** Both arms ran within 30 minutes of each other,
on 27 Aug 2026, and the extraction prompt's only recorded modification that day is later than
both. That is evidence, not proof: only the last modification time is knowable after the fact.

**The token, wall-clock and first-check fault figures cannot be recomputed from these files.** The
first two come from the session's own accounting at the time, reproduced from
`../COST-2026-08-27.md`; the third comes from the ledger. Everything in the shape, fidelity and
direction tables *can* be recomputed, and the command above does it.

**A cheaper arm was never tried.** Nothing here says anything about effort levels below `high`.

## The variance control, and what it did to the finding above

`darwin-max-run1/` and `darwin-max-run2/` are the **same passage reconstructed twice at the same
effort level**, `max` both times, from the same source bytes under instructions that differ only
in procedural rules about round trips and not in anything about the reading. Run 1 is the
published sample; run 2 was made on 28 Aug 2026 while testing a change to the toolchain, and is
kept because of what it says here.

| | run 1 | run 2 | | `tooming-max` | `tooming-high` |
|---|---|---|---|---|---|
| claims and arguments titled | 15 | 20 | | 110 | 109 |
| **fidelity `quotation`** | **47%** | **25%** | | **50%** | **29%** |
| verbatim `source:` spans | 13 | 12 | | 108 | 90 |
| relation kinds used | 1 | 2 | | 3 | 3 |

**Two `max` runs on one paper differ by 22 points of quotation share. The effort arms differ by
21.** So the number this README led with cannot tell effort apart from the ordinary variation
between two runs of the *same* setting, and the claim that `max` "stayed twice as close to the
author's words" is not supported by one run per arm.

**What survives, and why it is not the same claim.** Two things in the effort comparison are not
reproduced by the variance pair:

- **First-check faults: 8 against 0.** `high` marked seven claims `quotation` whose text was not
  the source's. Neither Darwin run made a single such fault. This is a *mechanical* error rate, not
  a labelling preference, and it is the one signal here that a checker can confirm absolutely.
- **Verbatim spans: 108 against 90, a 17% drop.** The Darwin pair moved by one span, 13 to 12.
  Whether a claim carries a checkable quotation at all is far steadier than what fidelity level it
  is labelled with.

**Why the label moved so much between two identical settings.** Run 2's report explains its own
number: four claims carrying exact spans are marked `paraphrase` rather than `quotation` because
their text reorders a clause or resolves a pronoun. That is a *stricter* reading of the marker,
not a lazier one — and it is why the verbatim span count barely moved while the label share
halved. **`fidelity: quotation` measures how scrupulously the reconstructor labels; `source:`
measures whether a reader can check the claim.** Only the second is a property of the map.

The lesson generalises past this directory: a metric that moves 22 points between two runs of one
setting cannot carry a 21-point conclusion about two settings.

## Doing this again

The ledger makes a second round much cheaper than the first, because faults, node counts and
timings are recorded automatically for every check. What a new arm needs is:

1. a folder here named `<paper>-<level>/`, complete with `_quarto.yml` and `source/`;
2. the sha1 of the finished `.argdown`, so the row can be tied to the ledger;
3. a row in the tables above, and a sentence saying what changed in the reading.

**The comparison worth running next is not another effort level.** It is `max` against `max` on the
same paper — the variance measurement this directory is missing, and the one that would tell us
how much of the gap above is real.

See also `../COST-2026-08-27.md`, which sets this beside the other six runs and works out where
the tokens actually go.
