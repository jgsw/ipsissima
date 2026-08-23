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

| | |
|---|---|
| source, whole file | 8,480 words |
| source, trimmed for the prompt | 5,940 words (back matter cut for the prompt only, never from the file) |
| the reconstruction | 36 claims, 5 premise-conclusion structures, 24 relations |
| verified quotations | 21 of 21 exact |
| check → fix rounds | **2** |

The first check came back with fifteen findings, and every one was a fidelity marker rather than
a structural fault: claims marked `quotation` whose `source:` field held a real quotation while
the claim's own text was a summary. That is the failure mode the fidelity check exists for, and
it is the one a human reviewer would not have caught by eye.

## Rebuilding

The PDF and the snapshot are not in this repository. Get the article from the DOI above.

```bash
node app/build_argdown_viewer.mjs \
  "samples/Prescott-Couch 2024 - The Philosopher as Reverse-Engineer/prescott-couch-reverse-engineer.argdown" \
  --source-root "samples/Prescott-Couch 2024 - The Philosopher as Reverse-Engineer"
```
