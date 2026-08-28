# Prescott-Couch, "The Philosopher as Reverse-Engineer" (2024)

> Prescott-Couch, A. (2024) 'The Philosopher as Reverse-Engineer', *Analysis*, 84(2),
> pp. 368–384. <https://doi.org/10.1093/analys/anad008>
>
> © the author. Published under a **[Creative Commons Attribution 4.0 International
> licence](https://creativecommons.org/licenses/by/4.0/)**.

**The text in `source/` is the author's and stays under CC-BY 4.0.** The licence permits
redistribution and adaptation with attribution, and a converted Markdown extraction is an
adaptation; verified against Crossref, which records CC-BY as applying to the version of record.
**The reconstruction is not the author's** — the `.argdown` is a reading of his argument by
somebody else, and every claim in it is marked for how far it stands from his words. Do not
attribute its judgements to him.

---

## Why this folder is here

**It is the first sample built from two sources at once**, and that is what it exists to show.

An article in a library usually exists twice, and each copy has exactly what the other lacks:

| | the publisher's HTML snapshot | the PDF |
|---|---|---|
| headings | five, marked as headings by the document | none the converter could detect |
| paragraphs | the document's own | inferred from where the ink sat |
| **page numbers** | **none — a web page has no pages** | **369–384, printed on every sheet** |

So the source here is made from both:

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/html_to_source.py snapshot.html --out source/prescott-couch-2024-philosopher-as-reverse-engineer.md
python3 ipsissima-mcp/src/ipsissima_mcp/paginate.py source/prescott-couch-2024-philosopher-as-reverse-engineer.md paper.pdf --write
```

Fifteen of the sixteen page boundaries are placed. The sixteenth is not: p. 384 opens with the
funding statement, which the snapshot puts elsewhere, so it gets **no marker and is named in the
report** rather than guessed at. A marker placed by hope would pin a quotation to a page it is
not on.

The page numbers are **read off each sheet, not counted from one**. This paper's sheets carry
their number inside the running head — `book symposium | 369` — and the earlier version of the
detector wanted a line of nothing but digits, so it found none of the seventeen.

## The reconstruction

**The form is convergent objection to a scope claim**, which is the characteristic shape of a
book symposium and is on nobody's list of argument forms. Prescott-Couch does not try to refute
Matthieu Queloz's Pragmatic Genealogy. He grants that the method is valuable and argues that
three separate claims made *for* it are too strong:

1. **§2 — it cannot replace Socratic questioning.** Sophisticated Socratic questioning already
   contains pragmatic questioning (Paul and Hall on causation); many pragmatic questions
   presuppose Socratic answers (Möllers on the separation of powers). Then the section's real
   weight, a **dilemma**: a genealogy of justice gives the *job description* of justice and not
   how the job should be done — and escaping that by asking which norm *contents* serve human
   needs begs the central questions of moral and political philosophy.
2. **§3 — it is not required, and cannot do some of the work.** A refutation by counterexample
   (Beitz does historically local functional analysis without any state-of-nature story), then
   the paper's most original claim: genealogies are **atomistic**, so they cannot see the
   *indirect* practical roles a concept has by belonging to a theory that helps us as a whole.
3. **§4 — the humanism is not earned.** Self-effacement answers the wrong worry; Williams's
   conditions on intrinsic value fall to a counterexample and look ad hoc; the later account of
   blame faces a dilemma of its own.

Each line is independent, and the verdict survives losing any one — so they hang as siblings,
never as a chain. Drawing them as a sequence, in section order, would misreport the argument.

**Two apexes, and that is right for the genre.** [`pragmatic-question`] is Queloz's proposal, the
thing under examination; [`weltanschauung-constrains`] is Prescott-Couch's own conclusion. A map
of a critical notice properly has the target at the top with the objections running into it.

### What the map shows and the paper does not

Drawn side by side, **§3's atomism argument and §4's neglect-of-constitutive-relations argument
are the same objection arriving twice**: a method that examines concepts one at a time cannot see
relations that hold between them. The two sit in different sections, are addressed to different
claims, and the paper never connects them. That convergence is recorded as
[`atomism-and-constitution-converge`], marked `imputation`, and tagged `#dispute` — it is the
reconstruction's, not the author's.

The other thing a section-by-section reading loses is that **§5 is not a summary**. It says the
limits matter *because* they point at an outlook that forces a choice between the apologist and
the engineer, and that is a different claim from "the method has limits".

## What it cost

Measured end to end, because a corpus has to be affordable to be worth having:

**Rebuilt 27 August 2026** under the current instructions, from the source rather than from the
map it replaced.

| | |
|---|---|
| source, whole file | 8,658 words |
| the reconstruction | **191 nodes**, 31 of them arguments, 201 edges, 14 sections |
| verified quotations | **156 of 156 exact**, and nothing sits against any of them |
| fidelity | 190/190 marked — 55 quotation, 96 paraphrase, 32 compression, 5 interpretation, 2 imputation, every departure warranted |
| tags | 58 `#reported`, 22 `#conceded`, 10 `#contested` |
| check → fix rounds | **3 states, 7 calls** |

**The paper argues two things and the map says so.** That philosophers should turn to Pragmatic
Genealogy *sometimes, for certain goals*; and that the Weltanschauung behind it, "supposed to be
liberating", feels constraining. The limits verdict is an *intermediate* conclusion, not the
apex — the paper uses it once more, to say the limits "point to concerns about the broader
Weltanschauung", so it is not where the paper stops.

**The version this replaced had no objections at all.** There are 28, of four kinds: 7 undercuts,
4 contradictions, 17 attacks — and **7 of the attacks are the author's own conceded
counterconsiderations**. On p. 378 the author undercuts his own objection, granting that Queloz
never claimed genealogy was *necessary*, and then withdraws: *"I, therefore, leave this as a
hypothesis."* A map of a critical notice that shows no objections is a reconstruction that did not
look.

**What the genre invites, and the map refuses.** The tempting reconstruction of a critical notice
is *what the method under discussion is* — Queloz's two aspects, Craig on knowledge,
self-effacement, Williams on intrinsic value. All of that is here, but as 58 `#reported` claims
wired as premises of four reported arguments the paper then attacks. Prescott-Couch argues for no
method; he argues that one has limits.

### Where working backwards fought the paper's own order

**Section 1 is unreachable from the verdict.** Its three motivations are reasons *for* Pragmatic
Genealogy, and nothing in them supports "the method has limits" — so working back from the stated
conclusion leaves the whole section unattached, which is exactly what the apex census caught. It
connects only through the *second* contention, because §1 is where the Weltanschauung is stated in
full, eleven pages before the conclusion restates it as a slogan.

**Three of the paper's "therefore"s are restatements.** *"That is,"*, *"It is better to…"* and
*"The point is that"* each look like a further inference and are the same claim in other words.
The thin-step check caught all three.

## Rebuilding

The PDF and the snapshot are not in this repository. Get the article from the DOI above.

```bash
node app/build_argdown_viewer.mjs \
  "samples/Prescott-Couch 2024 - The Philosopher as Reverse-Engineer/prescott-couch-reverse-engineer.argdown" \
  --source-root "samples/Prescott-Couch 2024 - The Philosopher as Reverse-Engineer"
```
