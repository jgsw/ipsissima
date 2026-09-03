# The values and principles framework

Begun 3 September 2026, at the author's direction, on the branch `values-and-principles`.
Ipsissima was built in three weeks, at speed, and its values were laid down the way values
usually are — one decision at a time, some stated, some enacted, some never noticed. This
directory writes them down, so that they can do two jobs the undocumented versions cannot:

1. **Audit.** Say, of an existing design, coding or documentation choice, whether it is in
   tension with what Ipsissima holds itself to.
2. **Assessment.** Say, of a proposed feature or change, whether it would be an overall
   improvement or a worsening — and by which principles, at what weight.

## The theoretical frame

The frame is the distinction between **means-improvement** and **values-improvement** in James
Wilson, "What makes a health system good?" (*Medicine, Health Care and Philosophy* 26, 2023,
pp. 351–365). Means-improvement maps how a system's flows convert inputs into outputs and asks
whether they could be reconfigured to better achieve the values the system aims to instantiate;
values-improvement specifies and reconciles those values themselves. The two are entangled and
reciprocal — a means-advance can dissolve a values-conflict, and a value that resists diligent
means-improvement is a candidate for re-specification — and neither is ever finished:
open-endedness of goals is a virtue, not a vice, of an institution under continual inquiry.
`THEORY.md` §4 adapts the distinction to a piece of software and reads the project's own history
through it.

## The three steps

- **Step One — done, 3 Sep, reviewed by the author.** A sweep of the repository, the commit
  history, and the project's private record, extracting every explicit and implicit principle;
  each entry carries its provenance, its level of generality, and its weight. `INVENTORY.md` is
  the extraction; `THEORY.md` is the interpretation that orders it.
- **Step Two — done, 3 Sep, reviewed by the author.** Concrete decisions tested against the
  framework, in search of reflective equilibrium (Rawls, "Outline of a Decision Procedure for
  Ethics"): where a choice and a principle disagree, a recommendation, with a stated
  confidence, about which of the two should move. `TENSIONS.md`.
- **Step Three — done, 3 Sep.** The framework revised in the light of Step Two and the
  author's checkpoint rulings (A11 added; A7 amended; F4 respecified and elevated to a sixth
  apex; B6 added; the keystone restated as distinctive rather than supreme), and
  `ALIGNMENT-PLAN.md` — the plan for bringing the codebase into line, carried out on the
  author's instruction the same day, its record kept in the plan's own header.

A fourth document followed at the author's direction: `AUTOMATION.md`, the framework applied
to its own automation — whether an automated test for overall improvement against the values
should exist (it should not, and the framework says why), which checkable slice should be
automated (a promises lint), and how the framework reaches contributors and the author by
different routes, deliberately.

## Whose values are these

A question the checkpoints answered about the framework itself, in both directions:

- **Assistant-introduced principles are not thereby suspect, but their genealogy is kept** —
  the origin field exists because provenance changes interpretation and weight without
  changing whether a principle binds (C1 is the model case).
- **Author-held values are not thereby Ipsissima's** (B6, the author's own ruling, 3 Sep):
  "While I am the author of Ipsissima, it doesn't follow that all my personal values are
  Ipsissima's values — it depends on what is best for the user." The touchstone for admitting
  and weighing any candidate value, whoever introduced it, is the user. Its first application
  re-scoped F4 the day it was stated.

## How provenance is marked, and why this way

**The framework uses Ipsissima's own fidelity ladder on itself.** A principle attributed to this
project is a claim about somebody's words and decisions, exactly as a claim in a reconstruction
is, so each entry in `INVENTORY.md` is marked with the vocabulary from
`ipsissima-mcp/src/ipsissima_mcp/docs/ipsissima-conventions.md`:

| marked | the principle as stated here is |
|---|---|
| **quotation** | the author's own words, quoted, with the date |
| **paraphrase** | a close restatement of something the author said |
| **compression** | several statements or decisions reduced to one principle |
| **interpretation** | a reading the record supports but never states — with a `warrant` |
| **imputation** | something the practice needs that nobody stated — with a `warrant` |

Two further fields the ladder alone cannot carry, both forced by the provenance study of the
no-network principle (the project record's case study — a value introduced by the assistant as
the rationale for a workaround, entrenched by the author's requirements, canonised as a trust
story, and ratified at every step without ever being announced):

- **origin** — who introduced the principle: the author, the assistant (ratified by the author),
  or the practice itself (nobody stated it; the code enacts it). Provenance can change what
  weight a principle deserves, and how it should be interpreted, without changing whether it
  binds — that is what the case study showed, and why this field exists.
- **weight, as case law.** Where two principles have actually collided and the record shows
  which won, the entry cites the case. Where no collision has tested a principle, its weight is
  marked untested rather than guessed — a weight asserted without a case is exactly the kind of
  confident unchecked marker this project exists to catch.

## Two cautions

**This framework is itself an interpretation**, assembled by the assistant from the record, and
should be read with the same suspicion as any other reconstruction: the quotations are checkable;
the compressions and interpretations are claims that can be wrong in both of the usual
directions — too little, and too much.

**The inventory quotes the private record.** Several provenance entries quote the author's own
messages from the project timeline and transcripts, which live outside this repository by
design. The branch is local; before any of this is pushed, those quotations are the author's to
review.
