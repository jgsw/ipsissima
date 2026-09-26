# The Ipsissima profile for Argdown

**Version 1.0 — 26 September 2026.** The machine-readable registry of everything below is
[`ipsissima-mcp/src/ipsissima_mcp/profile.json`](../ipsissima-mcp/src/ipsissima_mcp/profile.json);
the checker reports the profile version it validates against.

© 2026 James Wilson. This document and its registry are licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0), so that anyone — Argdown's own tools first — may adopt, adapt or build on the
profile with attribution. The rest of the repository keeps its own licences: MIT for the
application, GPL-3.0-or-later for Ipsissima-MCP, in whose package the registry travels.

## What a profile is, and why this is one

[Argdown](https://argdown.org) is the notation Ipsissima reads and writes. Ipsissima needs to
record more than Argdown's syntax carries: where a claim comes from in a text, how far its
words stand from the author's, whose view it is, what backs a causal step. It records all of it
**without adding any syntax**. Every annotation in this profile sits somewhere Argdown already
provides for data:

- the file's **front matter**, the YAML block between `===` lines;
- a claim's, an argument's or a premise-conclusion line's **`{data}` block**;
- Argdown's own **`#tags`**;
- and, for the text a map reads, the **YAML front matter of the source file**.

So a file written to this profile **is an Argdown file**. It parses with the official parser,
and any Argdown tool draws it as an ordinary argument map, ignoring what it does not know.
Ipsissima reads the same file and draws more. That is the whole design: an annotation layer on
standard Argdown, documented openly, not a dialect of it.

Why not a dialect? Because the notation is someone else's. A private relation or a new symbol
would stop the file being Argdown, would parse nowhere else, and would lock a reader's work
into one program. Ipsissima's values record this as a near-absolute boundary
(`docs/values/INVENTORY.md`, A9 and C6), and the official parser is the ground truth for what a
file says (E2). Where the notation cannot carry a distinction, a key in this profile or a
claim's `note:` carries it.

This document is the **specification**: what each key means, what values it takes, and what
Ipsissima does with it. How to *choose* those values when reconstructing a text is method, and
lives in `ipsissima-mcp/src/ipsissima_mcp/docs/` — above all `ipsissima-conventions.md` (the
claim's record), `extraction-prompt.md` (the reconstruction) and `mechanism-pass.md` (the causal
chain).

## Conformance

A map **conforms to profile 1.0** when:

1. the official Argdown parser accepts it;
2. every key this profile defines has a value of the shape given here;
3. every quotation it makes — a span of 10 or more characters in double quotation marks, in a
   claim's text or its `source:` — is found in the source file it cites, after the folding in
   *Quotation matching* below.

The reference validator is `argdown_check` (the MCP tool) or
`python -m ipsissima_mcp.check_argdown <file> --source-root <folder>`. Its two booleans mean
different things: `ok` is (1) and (2); `verified` says whether (3) was examined, which needs the
source files. A map may be `ok` without being `verified`; a reading is finished only when it is
both.

A key the profile does not define is **allowed**. The parser carries it, Ipsissima ignores it,
and the checker names it — with a suggestion where it looks like a misspelling of a key that is
read (`page:` for `pinpoint:`, `quote:` for `source:`). An unknown key is a note, never a fault.

## 1. The map's front matter

```yaml
===
title: "Bates et al. 2012 -- The Price is Wrong"
reconstruction:
    generated: true
    aim: fit
    unit: meaning
    mode: coherence
    strength: ordinary
defaults:
    chapter: "source/bates-2012-price-is-wrong.md"
===
```

| key | value | meaning |
|---|---|---|
| `title` | string | The map's name: *Author YEAR -- short title* by convention. |
| `reconstruction` | map | The **reading policy** (below). |
| `defaults` | map | Claim metadata stated once, inherited by every claim that does not set the key itself — usually `chapter`. A claim's own value always wins. `defaults.reviewed` records a person's pass over the whole map. |
| `contentions` | list of claim titles | The text's **stated theses**, added to the apex the map computes. Only the author's own; never a persona's. Rarely needed. |
| `text-provenance` | `generated` | The *manuscript itself* was machine-generated (a report written for the purpose). Shown beside the title. Other values are carried verbatim. |
| `author`, `date` | string | For a **survey map** — a map of a pattern of public argument with no source text: who drew it and when. |
| `mechanism` | map | The causal chain the text asserts: §5. |

### The reading policy

| key | values | meaning |
|---|---|---|
| `generated` | `true` \| `false` | A model wrote the map. The checker may then correct its fidelity markers; once a person has reviewed it, it is theirs. |
| `draft` | `true` \| `false` | The text is still being written. Checks that expect a finished argument (a contention, no loose claims) report observations, not faults. |
| `aim` | `fit` \| `appropriation` | `fit`: what the text says. `appropriation`: the best philosophy in it. |
| `unit` | `meaning` \| `commitment` | Whether charity settles which sense of the words, or which view is held. |
| `mode` | `coherence` \| `truth` \| `soundness` \| `agreement` \| `interest` | What charity, where it is extended, maximises. |
| `strength` | `minimal` \| `ordinary` \| `strong` | How much better than their words the author is assumed to be. |

`aim` places the map on Betz and Brun's trade-off between systematic correctness and exegetical
adequacy; `unit`, `mode` and `strength` are Tom Stern's three dimensions along which "the
principle of charity" is ambiguous. Ipsissima checks only the exegetical half: whether the
reading fits the words.

## 2. What a claim records

On any claim or argument, in its `{data}` block:

| key | value | meaning |
|---|---|---|
| `chapter` | path | The source file the claim reads, relative to the source root. |
| `section` | string | The heading in that file the claim belongs to. |
| `source` | string | A quotation pinning a claim whose own text has to be a summary. Verified like any quotation. |
| `pinpoint` | string | Where a reader finds it in print: `p. 12`, `pp. 34, 36`, `[50]`. Shown, not checked. |
| `line`, `lineSource` | integer, string | Where in the chapter the claim sits when no quotation places it, and how that was arrived at. |
| `fidelity` | the fidelity ladder | How far the claim's **own text** stands from the author's words. |
| `warrant` | string | Why a departure is allowed. Required on `interpretation` and `imputation`. |
| `note` | string | What the notation cannot carry. |
| `reviewed` | date | A person's review of this claim. Never written by a model. |
| `causes` | map, or list of maps | The causal step or steps the claim states: §5. |

### The fidelity ladder

Closest first: **`quotation`** (the claim's entire text is the source's words) · **`paraphrase`**
· **`compression`** (the default) · **`interpretation`** · **`imputation`**. `quotation` is the one
level with a fact of the matter, so it is computed and checked: a claim marked `quotation` whose
text is not in the source is a fault, and on a `generated` map the checker corrects the marker.
Ipsissima draws the ladder as the solidity of a claim's border — solid, then three grades of
dash, then dash-dot — and draws causal arrows in the same patterns: *fidelity is pattern*,
everywhere.

### Warrants

Any short reason is accepted. These seven are the vocabulary the method suggests, after Stern's
account of what makes a text open to a charitable reading: `enthymeme`, `hyperbole`,
`sloppy-phrasing`, `secret-sign`, `other-texts`, `coherence`, `convention`.

### On premise-conclusion lines

| key | where | meaning |
|---|---|---|
| `uses` | an inference line: `-- {uses: [1, 2]} --` | Which premises the step uses. Required once a structure has two or more steps. |
| `formalization` | a premise or conclusion | The line's logical form, in NLTK syntax: `p -> q`. |
| `formalized` | a premise or conclusion | The stamp of the words the formula was read against, written by a person with `check_argdown.py --stamp`. If the claim's words change, the stamp no longer matches and the checker says so. |

On a heading, `isGroup` is Argdown's own: `# Section {isGroup: true}` makes the heading group its
claims. Ipsissima draws the groups as sections and folds them.

An inference line may also name a rule in Argdown's own syntax — `-- Modus ponens {uses: [1, 2]} --`.
Where the rule is one Ipsissima knows and the lines are formalized, the checker tests whether
the step is that rule.

## 3. Tags: whose claim it is

A tag says **whose claim it is**, never how important it is — importance is computed from the
map. An untagged claim is the author's own, asserted.

| tag | the claim is |
|---|---|
| `#reported` | a view the text sets out but does not hold |
| `#conceded` | something the author grants tells against them |
| `#contested` | an objection voiced **in the text** that is not the author's view — never the reconstructor's own |
| `#authority` | a proposition whose force comes from its source, not its content |
| `#obiter` | said in a judgment, but not a necessary step to the disposal |
| `#crux` | a claim the reconstructor settled by choosing among live readings; its `note:` names the road not taken |
| `#appraisal` | the reconstructor's own reading of the text against the world |

`#appraisal` carries rules of its own: such a claim must be `fidelity: imputation` with a
`warrant:`; no argument of the author's may use it as a premise; it is excluded from every measure
of the author's argument; and Ipsissima hides it until the reader asks for it. Any other tag is
the reconstructor's own filing and is simply shown.

## 4. Readings, not only maps

A reconstruction that chooses among readings tags the choice `#crux`. A rival reading that is
local may be `#reported` beside it; one that would re-wire the argument is a **sibling file** —
one file, one reading. This profile adds nothing for comparing readings: two conforming files of
one text are compared as they stand.

## 5. The mechanism: the causal chain a text asserts

Optional, and written by a separate pass only on request. The front matter declares the chain's
cast:

```yaml
mechanism:
    question: "How would free distribution raise use of preventive health products?"
    levels: [macro, meso, micro]
    actors:
        ngo:       {label: "Governments and NGOs distributing products", level: meso}
        household: {label: "Poor household", level: micro}
    states:
        price:  {label: "User fee charged", actor: ngo, role: intervention}
        takeup: {label: "Household takes the product up", actor: household}
        health: {label: "Health of the household", actor: household, role: outcome}
```

| key | value | meaning |
|---|---|---|
| `question` | string | What the chain answers. |
| `levels` | list | Levels of social complexity, top first. Default `[macro, meso, micro]`. |
| `actors.<id>` | `{label, level}` | A position the text names — "courts", "the household" — at one of the levels. |
| `states.<id>` | `{label, actor, role, measured, appraisal, note}` | A change in an actor's condition or conduct. `role` is `intervention` (where the chain starts) or `outcome` (what it is for); `measured` says how the text measures it; `appraisal: true` makes it the reconstructor's own state; `note` records which of the text's words were read as one state. |

A claim that states a step carries `causes:` — one map, or a list:

```argdown
[Small fees cut take-up]: Relative to free distribution, "charging even very small user fees
substantially reduces adoption".
    {fidelity: "compression", pinpoint: "p. 30",
     causes: {from: price, to: takeup, sign: "-", basis: study}}
```

| key | value | meaning |
|---|---|---|
| `from`, `to` | state ids | Declared states. |
| `sign` | `+` \| `-` \| `"0"` | Raises, lowers, or a **finding of no effect**. Quote the zero: YAML reads a bare `0` as a number. |
| `basis` | `study` \| `statistics` \| `model` \| `example` \| `testimony` \| `asserted` | What the **text** offers for the step. The first three count as tested; `example` and `testimony`, and an asserted step the map argues for, as argued. |
| `lag` | string | Timing the text states. |
| `given` | list of strings | Conditions the text states, in its words. A moderator is a condition, not a state. |
| `how` | `{actor, situation, habit, response}` | Gross's decomposition of a step, only where the text gives it. |
| `reflexive` | boolean | The step runs through a classification or prediction it acts on. |
| `selects` | boolean | A **selection link**: who ends up on each side, not an effect. |
| `hedged` | boolean | The text puts the step as a possibility. |

A step on a `#reported` claim is the rival view's; on an `#appraisal` claim, the reconstructor's.
A null finding and a selection link are reported and drawn, never walked as part of the chain.
A step the text states but the argument never needed gets a claim of its own, quoting the text,
under a heading `# The mechanism, as the text states it {isGroup: true}`.

## 6. The source file

The text a map reads is a Markdown file. Its YAML front matter may carry:

| key | meaning |
|---|---|
| `title`, `author`, `source`, `doi`, `url` | The publication. |
| `licence`, `licence_url`, `rights` | What the text may be used for. A redistributed source carries its licence **in the file**, so that attribution travels with it. |
| `abstract` | The text's own abstract; shown on the orientation panel and quotable like any line. |
| `voice` | For a wholly dramatised text — a satire, a dialogue — the reconstructor's sentence on whose voice the mapped argument is in. |
| `facts`, `facts_source` | For a judgment: the facts of the case, and where they come from. |
| `attribution` | For a pasted text: whose it is. |
| `zotero` | The Zotero attachment key the text was converted from. |

In the body: `<!-- p.N begins here -->` marks where printed page N begins. Back matter —
References, Notes, a bibliography — is kept in the file and never quoted as argument. A book is a
**project file** listing its chapters in order (`chapters:`, optionally grouped under `part:`);
a Quarto `book: chapters:` block is read the same way.

### Quotation matching

A quotation must appear in its chapter **verbatim, after folding** what does not change the
words:

- runs of whitespace, line and paragraph breaks and the non-breaking space, as one space;
- single, double, curly and straight quotation marks and guillemets, as one mark;
- en and em dashes, as a hyphen; the ellipsis character, as three stops;
- Markdown emphasis (`*`, `_`, `` ` ``), backslash escapes and the soft hyphen, as nothing.

Nothing else is forgiven: a quotation that differs in a word is a near miss, and the checker
reports the closest passage. Spans shorter than 10 characters are treated as scare quotes, not
citations.

## Versioning

The profile is versioned `MAJOR.MINOR`. A **minor** version adds a key, a value or a tag;
every file that conformed still conforms. A **major** version renames or removes one, or changes
a meaning; it says how to carry a file across. The registry and this document change in the same
commit, and `tests/test_profile.py` holds the registry to what the checker and the app actually
read — a key the code reads that the profile does not list, or the reverse, fails the test.

## For Argdown's maintainers

The profile needs nothing from Argdown that Argdown does not already provide, and changes
nothing about how an Argdown file is written or read. What it relies on, so that a change to any
of these would be worth knowing about in advance:

- **front matter** between `===` lines, parsed as YAML and returned by `@argdown/core` as
  `frontMatter` — the app reads it there;
- **`{data}` blocks** on statements, arguments, premise-conclusion lines and inference lines, as
  YAML, carried through to the JSON export under `data`;
- **hashtags** in statement text, and **`isGroup`** on headings;
- **rule names** on inference lines (`-- Modus ponens {uses: [1, 2]} --`);
- **the parser's own records** of every statement — including one with no relations, which the
  map's selection drops: a claim that states a causal step and supports nothing is read from the
  parser's records, not from the drawn map.

Two things would help any tool that layers meaning on Argdown in this way, offered as
observations rather than requests. The CLI's `argdown json` export omits the front matter the
core parser returns, so a tool working from the export has to read the file a second time. And
there is no convention yet for namespacing tool-specific data keys, so two such profiles could in
principle claim the same key for different meanings; this profile's keys are listed in full in
its registry so that a collision would at least be visible.

Comments, corrections and objections are welcome as issues on the Ipsissima repository.

## What the profile is not

It is not a new notation, and it asks nothing of Argdown's users. It is
not a ranking of readings: nothing in it scores an author or a reconstruction. And it is not
closed. Keys are added when a reading needs a distinction the notation cannot carry — the
mechanism keys arrived with the J-PAL and FAST readings of September 2026 — and each arrives with
the reason it was needed.
