# The Manuscript view

> **RETIRED 20 Aug 2026 — the Order view (the scatter plot).** The author judged it a curiosity
> rather than a view worth a permanent tab, and it is gone from the viewer. What it was for —
> seeing a claim and its support far apart in the text — the **Manuscript** view shows directly,
> as a long line, with the reach-weighted stroke carrying the emphasis the plot carried with
> distance from the diagonal. The section on it below is kept for the reasoning, not as
> instructions. The viewer's three tabs are now **Argument · Manuscript · Argdown**; the old
> "Map / by argument / by position in text" pair of controls has been merged into that one.

## The exposition-order and Order views (historical name)

Read this when interpreting either view, or when deciding what `--source-root` buys you.
The rule it all rests on — record `chapter` and `section` on every claim as you go — is in
SKILL.md, because that one has to be obeyed before the views can exist.

## Exposition order vs justification order

The sequence in which a text introduces claims and the structure by which they justify one
another are different things, and the interesting places are where they come apart.

Do **not** think of the DAG as the fabula to the text's syuzhet. In narrative theory the fabula
has a determinate order; here there are three things — the text's order, the reconstructor's DAG,
and the author's actual order of reasons, which is exactly what is contested. The DAG is another
arrangement, not the underlying truth. Which is why the fidelity marking above matters: the
justification order is an interpretation and should be legible as one.

`--source-root` also reports this. It places each claim in the manuscript and measures, for every
support edge, how far the support sits from the claim it supports:

- **anticipated** — the claim is stated and its support arrives further on. This is the
  announce-then-argue convention, not a defect; what matters is *how far*, since that is how
  long the reader holds it.
- **prepared** — the support is laid down before the claim it serves; the text builds to it.
  Also not a defect: it asks the reader to follow an unfolding argument instead.
- the report names which convention the text mostly follows, and flags the relations that
  depart from **its own** practice — a better question than conformity to an absolute.
- **claims citing files the manuscript does not list** — read from `_quarto.yml`, which is the
  authoritative reading order. This immediately surfaced 21 claims in the book map sourced to two
  files that are not chapters of the book at all.
- **contribution** — for each claim, does it reach a main contention, and how far away is it.
  Four roles: `apex` (a contention), `supports` (its support chain arrives at one), `engages`
  (it arrives at one, but only via an attack — the objections and their replies), `inert`
  (reaches none at all, by any route). **`inert` is the only one worth alarming about, and in a
  finished argument it is a cut list.** In a map of work in progress it usually is not:
  it is material written down before its place is settled, which is the condition the
  author is mapping their way out of. Running support and attack together instead would put the whole
  `public-ritual-suspect` subtree — 20 claims of perfectly good objection — on a cut list it
  does not belong on.

  On a well-connected map the binary is nearly toothless: nothing on the book map is inert,
  because every claim reaches something. The **distance** is the graded version that
  discriminates, and it spreads 0–6 there.
- **carried longest** — how many claims separate a claim from the first thing that draws on it.

**How a claim is placed**, best precision first: the exact line where one of its quotations was
found · a hand-written `{line: N}` · the **best-matching paragraph of its own section** · the
section heading · the chapter alone.

The paragraph search is what makes the axis usable. Section metadata is far too coarse on its
own: on the book map it put 336 claims at 94 distinct positions, stacked 19 of them on one, and
left 154 of 265 support edges with both ends at the same point. Scoring each paragraph of the
claim's section against the claim's own words gives 275 positions and a worst pile-up of 4.

Two constraints keep it honest, and both matter:

- **The search never leaves the claim's own section.** You said which section the claim belongs
  to; this only asks where in it. So it can refine a position but never contradict your metadata,
  and never move a claim out of the cluster the map draws it in.
- **Nothing is written back.** Positions are recomputed every run. A stored line number is an
  assertion about a manuscript still being edited and goes quietly wrong the first time a
  paragraph moves. Add `{line: N}` by hand only to override — for a claim with no chapter, or
  whose section heading does not match.

### The exposition-ordered view

**Chapter lanes, wrapped like prose.** The first version gave every distinct position its own
column across the whole map, which made the book 269 columns wide and 7 deep — about
66,000 x 1,500px. Technically a picture, useless as one. A chapter is the unit a reader
navigates by, so a chapter is a LANE: its claims run left to right in the order the text makes
them and wrap when they reach the width of a page, and lanes stack downwards in reading order.
Williams comes out 1652 x 2163 (near square), the book 2430 x 8566 in 13 lanes — a column of
chapters to scroll rather than a ribbon to pan.

Claims with no position get the last lane, labelled, rather than a gutter rule at the right.

Direction along the text is carried by **weight and opacity**, never by a dash: dashes already
mean undercut and contradiction, and the first version dashed the "prepared" ones, so a plain
support looked like a different kind of relation the moment the arrangement changed.

`build_argdown_viewer.mjs FILE.argdown --source-root DIR` adds an **exposition order** toggle to
the viewer: the same claims, laid out by where they appear in the text rather than by what
supports what. x is the position in the manuscript, y is depth in the justification DAG, and the
bands behind the nodes are the manuscript's **chapters** — not the reconstruction's sections,
which draw claims from wherever they need them and interleave badly against a text axis.

Read it for the edges. An edge whose support arrives **a chapter or more after** the claim it
bears on is **anticipated**; the other way round is **prepared**. Note that "runs right to left"
is *not* the test — the ordinary way to write a paragraph is to assert and then argue, and on the
book map that accounts for 266 of 394 edges. That is prose, not a finding.

**Neither direction is a fault, and the view must not imply one is.** The standard advice in
analytic philosophy is to announce the thesis and argue afterwards — Pryor's guide: *"You should
make the structure of your paper obvious to the reader. Your reader shouldn't have to exert any
effort to figure it out."* On that convention a claim should precede its support. Williams's
"Internal and external reasons" does the opposite deliberately, signposting the itinerary but
withholding the destination, which asks more of the reader by design. So colour marks direction
in a pair with no good/bad reading, and only REACH gets emphasis — reach is what costs a reader
something whichever way it runs.

Claims with no resolvable position are **not dropped** — they sit in a lane of their own past a
marked rule, with their edges still drawn. Dropping them would silently tear edges and lose real
claims; parking them visibly turns missing metadata into something you can see and fix.

The x-axis is **ordinal**: column 40 is the fortieth place a claim is made, not the fortieth page.
Sequence is meaningful, distance is not.

The **reach** toggle fades each claim by how far it sits from the nearest main contention, so
remote material shows up as a pale region — and in this view, as a pale region *of the book*.
Objections are outlined rather than faded: they reach the thesis by attacking it, so they are not
doing less work, they are doing different work.

### The Order view — exposition against justification

The same build adds an **Order** tab: one point per support relation, x = where the CLAIM sits,
y = where its SUPPORT sits. Above the diagonal the support arrives after the claim; below it, the
text builds up to the claim; on it, the two sit together.

**It plots edges, not claims, and that is the whole trick.** The obvious plot — x = text
position, y = the claim's place in the justification order — cannot be built, because a DAG has
no canonical linear order. Any y you pick is one of many topological sorts, so distance from the
diagonal measures your tie-breaking rule rather than the book. (Tried: a rank correlation between
text order and a depth-then-load ordering came out at rho = +0.001, which looks devastating and
is an artefact of ranking 292 claims by a quantity with 7 distinct values.) A support *relation*,
by contrast, is a fact about two claims, and the text either gives you the reason first or it
does not — so the diagonal is real.

Read the **spread and the reach**, not the count either side. On the book map 171 of 304 supports
sit within 5 claims of what they support; the 36 that reach 25+ are the ones worth looking at,
and they cluster visibly — a vertical spike at the Preface, where claims are stated and supported
right across the book.

**Reach discriminates where the count does not.** On the Williams the two directions are
near-even by count — 23 anticipated against 22 prepared — which would suggest no policy at all.
But the anticipated ones stretch at most 8 claims while the prepared ones reach 50: the local
texture is mixed and the long-range architecture is entirely build-then-conclude. The caption
reports both, and flags when one direction reaches more than twice as far as the other.

The view also names the convention a text follows and, more usefully, the relations that depart
from **its own** practice — which is a better question than conformity to an absolute.



---

## Using these on work in progress

Added 20 Aug 2026, at the author's direction, because the rest of this file is written for a
finished argument and reads wrongly against a draft.

**The declared order is a hypothesis, not a fact.** When a manuscript is still being written, the
point of a structure map is to find pattern and order the author has not been able to trace from
inside the work. The job is to surface connections that are *already there in the argument* but
obscured by the order the files happen to be declared in, or by which file a passage happens to
sit in — so that the author can see that an argument needs to come earlier than it does, or that
a section would work better in another chapter.

So read these views as **candidates to look at**, not as a report card:

| view | the question it answers for a draft |
|---|---|
| justification debt | which claims are asserted long before anything supports them |
| the debt plot | which support relations reach furthest — the outliers, not the diagonal mass |
| CARRIED LONGEST | what the reader is asked to hold, and for how long |
| reach | which material is doing remote work, or none |

**Be tolerant of mess.** Disconnected claims, a long apex list, material that reaches no
contention — in a draft these are the shape of the problem, not evidence of carelessness. The
tool that only works on a tidy argument is no use to the person trying to tidy one.

**Not yet built, and the direct expression of "this section belongs in chapter Y":**
cross-chapter cohesion. For each claim, how many of its argumentative neighbours are in its own
chapter and how many in another; a run of consecutive claims whose edges nearly all cross into
one other chapter is a candidate for moving there. It compares the declared partition against the
argument graph's own clustering, and everything it needs is already on hand.
