# The viewer, the renderer, and their harnesses

Read this when changing the renderer, debugging a map that draws wrongly, or explaining the
viewer's controls. Building a viewer is a two-line command and stays in SKILL.md.

## Checking the fold logic systematically

Three visibility bugs reached the author in a row — a section that blanked the map, a section
that unfurled five levels, a pane that painted over the others — because the fold logic lived
inside a DOM-bound closure where nothing could enumerate the states it produces. It no longer
does. **`reduceFold` is pure and exported**, the map's controls are thin wrappers over it, and:

```bash
node app/test_fold_invariants.mjs" [--steps N] [--seed N]
```

walks the state space of both real maps — every section opened and closed, every claim toggled,
every depth setting, expand-all, collapse-all — and checks after each action that:

- edges stay closed over the visible nodes, and no node is drawn twice
- no claim is both folded and hand-opened
- **the main contention is always on screen**
- **opening a section hides no claim outside it**
- **opening a section reveals one level of it, not several**
- **expanding a claim hides nothing that was on screen**
- opening a section then closing it returns the same view

Depth 1 is exhaustive; beyond that it walks a seeded random path, so a failure prints the seed
and the exact action trail that produced it. Run it after any change to folding, across a few
seeds — the nested-section bug only appeared under one.

Two invariants are deliberately scoped, and the reasons are worth keeping: **close-then-open is
not required to restore** (a reopened section comes back folded to its entry claims, which is
what stepwise expansion is for), and **the "nothing disappears" rules apply only with no depth
limit** (a limit is an instruction to hide distant material, and folds compress many steps into
one, so expanding under a limit can legitimately push things past it).

It does **not** cover geometry — see the next section.


## Checking the geometry systematically

`layoutByText` is pure — its only DOM-shaped input is a map of node id to `{width, height}`,
which the renderer fills by measuring real text and a test can supply deterministically. So the
arithmetic is checkable headlessly, and font metrics, which have never been the thing that was
wrong, stay out of it.

```bash
node app/test_layout_geometry.mjs" [--cases N] [--seed N]
```

After every layout it checks that every visible node is placed at finite coordinates, **no two
boxes overlap**, **x follows the manuscript** (a claim later in the text is never drawn left of
an earlier one), unplaced claims sit past the gutter rule and placed ones never do, chapter bands
do not interleave, every edge has a finite path anchored on both boxes, and the reported canvas
contains everything drawn.

It runs that over three populations, and the second and third are the point:

- **awkward fixtures** — empty, one node, no edges, a pure cycle, a self-loop, duplicate ids,
  dangling edges, a group with a missing parent, groups that enclose each other, everything in
  the gutter, a 4,000-character label, Arabic and Japanese and emoji, out-of-book chapters
- **seeded random graphs**, so the shapes are not only the ones imagined
- **real Argdown source** through the real parser: deep chains, 200-way fans, a PCS with no
  conclusion, intermediary conclusions, undercuts, contradictions, shortcode headings, nested
  groups, duplicate definitions

**It has been mutation-tested.** Removing the row gap, reversing the column order and moving the
gutter each make it fail with the right complaint; restoring them makes it pass. A harness that
has never failed is worth nothing, so if you extend it, break the thing you are testing and
watch it complain before you trust it.

Two things it does not cover, honestly: real font metrics, and the visual result. Those still
want a browser.

## The viewer's interface

Designed to stay out of the way — the author's benchmark is Zettlr, not Word. Chrome is quiet,
nothing reflows as the window changes, and anything explanatory lives behind **How to use**
rather than in a status bar competing for attention.

**Top bar.** Filename · Map / Order / Source · the arrangement (`by argument` / `by position in
text`, shown only when the build had a `--source-root`) · Fit · Full screen · How to use. The
bar never wraps: the title gives up width first, then labels drop, before anything moves to a
second line.

**Full screen** hides the page's own chrome rather than calling the Fullscreen API — that is
what "stop everything else competing" actually needs, and it behaves identically everywhere.
<kbd>Esc</kbd> leaves it, and closes the How-to-use panel first if both are open, so one press
undoes one thing.

**The map's own bar** is two labelled scales and one filter, not a row of unrelated verbs:

| | |
|---|---|
| `how much` | levels of reasons showing, main claim outwards. **The number on each button is how many claims it puts on screen.** |
| `sections` | folded into blocks, or opened out |
| `kinds` | switch a kind off to take it off the map; the number is how many there are |
| `full claims` | whole text per claim rather than the first lines plus a "more" link |

`expand all` and `fold all groups` are gone — they were the ends of those two scales wearing
different clothes. So is `reach`, which never earned its place, and the second `fit`.

**Fidelity is discoverable three ways**: the border style (as before), the level named in the
tooltip on hover, and a key in How to use that draws the actual strokes — "long dash versus
short dash" is not something anyone can hold in their head from prose.

Node and relation counts moved out of the footer into a disclosure inside How to use. They are a
debugging aid, not something a reader needs while reading.

Icons are drawn in the template rather than pulled from a set, so the page stays self-contained
and nothing is asserted about another project's path data.

## Two things the geometry harness now covers that it did not

**Both arrangements.** It used to test only `layoutByText`. The "by argument" path is dagre plus
a document-order re-seat, and that re-seat shifts whole blocks sideways *after* dagre has
routed — blocks banded by vertical overlap, so a block moved within one band can land on a block
from another. Eleven pairs of claims ended up on top of each other on the Williams map before
anyone noticed. `seatInDocumentOrder` is hoisted and exported now, the harness builds the dagre
layout exactly as the renderer does, and the re-seat itself **vetoes any shift that would cause
an overlap** — reading order is worth having, but not at the price of an unreadable picture.

**dagre refusing to lay a map out.** It throws `Not possible to find intersection inside of the
rectangle` on some compound shapes, which in a viewer means a blank page. There are two
fallbacks now: the same layout without clusters, then the text-ordered layout, which is ours and
which the harness holds to never throwing. Each says on the console what happened. The harness
counts the shapes dagre refuses rather than failing on them.

## The badge counts one level, always

The circle on a folded block used to show the **total** it stood for while a folded claim showed
only its immediate reasons — so a block marked `+118` opened onto two claims and looked broken.
It is now what the next click reveals: for a section, the claims it is entered at (those bearing
on something outside it, or on nothing). The total is still written on the block, where it reads
as a size rather than a promise.


## Showing a map to the author

The author reads maps in a browser, not a terminal. Two self-contained viewers, both built from
one template (`argdown-tools/argdown-viewer.template.html`) and both using the **real** parser:

```bash
cd app
# THE DEFAULT for any map of a real text — --source-root is not optional, see below
node build_argdown_viewer.mjs "path/to/file.argdown" --source-root "path/to/manuscript"
node build_argdown_viewer.mjs --standalone             # -> "Ipsissima Reader.html" at the root
```

**ALWAYS build with `--source-root` when the map reconstructs a text you have on disk.** The
author's standing preference (17 Aug 2026): every map you make should carry the Manuscript view, and
the only maps that legitimately lack it are other people's, whose sources are not here. Without
the flag you get a viewer with the exposition-order toggle absent and the Order tab greyed out,
and nothing else says anything is missing.

That in turn means the metadata has to be there BEFORE the build: `--source-root` can only locate
a claim that carries a `chapter`, and can only refine it to a paragraph if it also carries a
`section`. **Record both on every claim as you reconstruct** — retro-fitting provenance to a
finished map means re-reading the whole source. `check_argdown.py` reports the coverage on every
run, so an omission shows up immediately rather than at build time.

- **Per-file** bakes the graph in at build time. Small and emailable. **Rebuild it whenever the
  `.argdown` changes** — it cannot know its source moved on. The Argdown source is baked in beside
  the graph and shown in the Source pane, so what the reader is looking at is always what drew the
  map.
- **Standalone** bundles `@argdown/core` into the page; drop any `.argdown` on it. Never stale,
  nothing to regenerate. Built once, at the workspace root. VERIFIED: the bundled browser parser
  produced byte-identical graphs to the Node parser on both test files.

Both open folded to the section skeleton when a map exceeds 25 nodes, and carry the live map's
built-in depth control and tag-facet chips — which is the payoff for tagging `#core` as you write.

**Direction survives the badge, and survives length.** An arrow that cannot be seen is not an
arrow, and two things were hiding them. dagre lays the map out bottom-to-top, so a support edge
arrives at the BOTTOM-CENTRE of its target — which is exactly where the fold badge is drawn, a
filled circle of r=9 — and nodes are painted after edges. Measured before the fix: **10 of 25
arrowheads on the Darwin map, and 19 of 62 on the expanded Williams, ended at distance 0.0 from a
badge centre.** Not nearly hidden, exactly hidden. Separately, a long edge only stated its
direction at the end you had not got to yet.

So the badge counts as part of the target's silhouette — the stroke stops `BADGE_R + BADGE_CLEAR`
short of its centre, and the arrowhead sits just outside the circle pointing at it — and an edge
long enough to travel repeats the arrowhead as one or two open chevrons along its length
(`directionFractions`: none under 160 units, one to 430, two beyond). Both are pure functions,
exported and covered by `test_edge_direction.js`, because what went wrong was arithmetic.

Two behaviours of the renderer worth knowing, because they are what make a large map readable:

- **Opening a fold reveals one level, not the whole subtree.** Clicking a section holding 34
  claims shows the claims it starts from, each still folded; the next click descends one more
  level. (`stepwiseExpand`, default on. `expand all` remains the escape hatch.)
  **A claim whose reasons lead OUT of the section is never folded by this**, because folding it
  would hide material outside the section — and when that claim is the map's apex, "outside the
  section" is the whole argument. Opening "The verdict" on the Williams map used to leave one
  node on screen out of six blocks. The rule is `foldableInGroup`, and the invariant the tests
  hold it to is: *opening a section hides no claim outside it.*
- **Claims are seated left-to-right in the order they were written, at every level.** Neither
  Argdown's map builder nor dagre preserves document order — Argdown emitted section III.C third
  out of a file where it is seventh, and dagre's crossing-minimisation then put III.A to the
  *right* of III.B. The renderer re-seats blocks into dagre's own slots, keeping every slot,
  width and gap dagre computed and only permuting which block sits in which.

  The key is a **pair: section ordinal first, then line in the .argdown**, and both halves are
  needed. Section order alone cannot separate two claims in the SAME section — which is how
  Williams's own numbered propositions (i) (ii) (iii) (iv) came out as iv, iii, ii, i. Line
  alone breaks the outer level, because a file that defines a claim early and files it under a
  later section (the book map does this throughout, by re-opening claims) would drag that whole
  section leftwards. Measured on the book map: 273 side-by-side pairs out of document order with
  seating off, 14 with it on; on the Williams map, 41 against 6. The residue is sections whose
  boxes overlap vertically, where there is no single right answer.

  (`documentOrder`, default on.) **A block with neither key is left alone**, so a host that
  supplies neither keeps dagre's ordering.

**Do not point the Structure Browser at a general `.argdown` file.** Its `parseArgdown()` handles a
deliberate subset — `[id]: text`, `+`, `-`, indentation, metadata, headings — and everything else
hits `if (!m) continue;`. It silently drops `<Arguments>`, premise-conclusion structures and `_`
undercuts. On a file with a Master Argument that is a confidently-drawn, materially wrong map. It
is the right tool for the book's `_argument.argdown`, whose shape it was written for.

The adapter from Argdown's output to the renderer's graph lives once, in
`argdown-tools/argdown-graph.mjs`, and is shared by the pandoc filter and both viewers so a file
draws identically whichever route it took. Keep it free of Node imports — esbuild follows even a
dynamic `import("@argdown/node")` and the browser build then fails on `fs`/`path`/`util`.

## Changing the layout without breaking it

Every layout defect in this renderer was found by the author looking at a picture: arrowheads
hidden under fold badges, corners turned inside twenty units, lines detouring four times the
direct distance, arrivals crossing beneath a node, lines bulging out and back. Each was fixed and
given a regression test, so none can return — but **none of them was caught by anything**, and
the next one of the same family would not have been either. This is the loop that replaces that.

### The loop

```bash
node app/map_quality.mjs"                  # where things stand
#   ... make the change ...
node app/map_quality.mjs"                  # what moved
node app/map_quality.mjs --render /tmp/m"  # and LOOK
node app/map_quality.mjs --baseline"       # only when deliberate
```

It measures every real map at every depth level — the "+ detail" detours the author noticed were
absent from the default view, so one state is not enough — and compares against a recorded
baseline, failing when anything gets materially worse. It runs as part of `run_all_tests.mjs`.

The metrics are the objective traces of the faults above: `hidden` (arrowheads inside a badge),
`cross@node` (two arrivals whose order disagrees with their sources), **`avoidBend`** (lines bent
more than 6 units whose straight run is actually free — the direct measure of "unnecessary
bends"), `bend~`/`bendMax`, `overshoot`, `detour`, `edgeX`, `overlap`.

`avoidBend` is the one to watch. A line bent around a claim is dagre earning its keep; a line
bent around nothing is clutter, and that distinction is what the eye was picking up each time.

### One definition of where a line goes

`edgeGeometry(g, vis, sizes)` in `argdown-live-map.js` returns the final points of every edge,
and both the renderer and the measurements use it. Do not re-derive edge geometry anywhere else.
The order inside it — seat the arrival, *then* straighten — is load-bearing and was wrong once:
straightening before the arrival point is final cannot see the bulge that moving the arrival
introduces.

### Four ways a measurement lied here, all worth checking for

Metrics went wrong four times in one session, each time hiding the defect they were written to
find. **A measurement is code, and it needs the same suspicion as the code it measures.**

- **A flag that did nothing.** `--no-repair` was read into a variable and never used, so "the
  repair makes no difference" was reported from two identical runs. *Assert that a switch changes
  the number before trusting either value.*
- **A filtered denominator.** The crossing metric only counted arrivals exactly on the bottom
  edge — the subset already fixed — and reported zero on a map that visibly crossed. *The
  denominator is the tell: "0 of 11" where 69 edges arrive is a bug in the metric.*
- **Floating point in a mutation test.** `!==` compared `200*(1/3)` against `200/3`, which differ
  in the last bit, so the test passed whichever branch ran. *Compare with a tolerance.*
- **A fixture that did not exercise the case.** A "nearly straight" path was 13.8 units off the
  line, above the threshold, so the code was right to change it. *Check the fixture triggers the
  branch you think it does.*

**Mutation-test every new metric and every new invariant**: break the thing it watches and see it
complain. An invariant added to the adversarial layout harness passed with the fix disabled,
because nothing it generates produces a large enough shift — which is why `test_reseat_edges.js`
drives the function directly instead.

### And then look

Numbers are necessary and not sufficient. The crossing metric that read zero on a crossed map was
caught by rendering the picture and disbelieving the number. `--render` writes an SVG per map,
cropped to its busiest node, which is where crowding shows first.


---

## The apex must stay on screen — fixed 20 Aug 2026

**Reported against the Carroll map:** fold the sections, reopen them, and the main claim is gone.

**The fold logic was innocent.** `fitTo` floors the zoom at `minScale` so a large map stays
legible instead of washing out — and then *centred* the drawing. A drawing wider than the
viewport at the floored scale therefore shows its MIDDLE, and the contention, which sits at one
edge, goes off screen. Nothing said where it went.

`stranded()` did not catch it, and could not: the drawing still overlapped the viewport by
hundreds of pixels. Only the one node that mattered had left.

The framing arithmetic is now `frameFor(w, h, cw, ch, minScale, apex)` — **pure, module-level and
exported**, because the bug is arithmetic rather than DOM and a DOM-bound version cannot be
tested. When a dimension overflows, the apex goes there instead of the centre, clamped so the
drawing's own edges never pull inside the frame. A map that fits is centred exactly as before.

Seven checks in `test_fold_invariants.mjs`, including the two that matter for regressions: an
apex at the far *right* is reached too, and a map that fits is still centred.

**The apex is found as the node with the smallest `y`** — dagre lays out bottom-to-top, so that
is the contention, and taking the minimum needs no graph analysis and survives every filter.


---

## How the two entry points relate — and why the build asks Python a question

`check_argdown.py` and `build_argdown_viewer.mjs` are **independent entry points on the same
file**. The checker has always been strictly read-only; the builder reads the `.argdown`, parses
it, and bakes a graph into a page. Nothing chained them, which is why a verdict the checker
printed never reached the picture a reader actually looks at.

```
.argdown ──> check_argdown.py            reports to a human, writes nothing
         └─> build_argdown_viewer.mjs ──> argdown-graph.mjs ──> fidelity ──> border
                     │
                     └── asks check_argdown.py --derive-fidelity ──┘
```

**`quotation` is now checked at build time rather than believed.** The builder shells out to
`check_argdown.py --derive-fidelity`, which returns JSON of the derived level per claim, and
overrides the border before baking. Declared by hand the marker was wrong 38 times in 126 across
the reference maps, always in the same direction, and a solid border then tells a reader they are
looking at the author's words when they are looking at a summary.

Three constraints shaped this, and each rules something out:

- **The rule is not reimplemented in JavaScript.** It leans on difflib's near-match, which has no
  clean JS equivalent, and one rule in two languages is the drift hazard
  `test_argdown_positions.mjs` already exists to police. So the build asks rather than works it
  out again — at the cost of the build now needing `python3`, which the rest of the toolchain
  needs anyway.
- **Only `quotation` and `paraphrase` are ever adjudicated.** `interpretation` and `imputation`
  are judgements about the *reading*, not facts about the words, and nothing here may touch them.
- **Nothing is written back to the `.argdown`.** It is the reconstructor's file; the tool knows a
  claim is *not* a quotation but not which weaker level applies, so writing one in would impose a
  judgement it cannot justify. And a value stored there would go stale the moment the source is
  edited — the reason the line backfill was dropped.

The consequence worth stating plainly: **the picture is now right even when the file is wrong.**
The checker still reports the discrepancy so the file can be corrected, but a reader of the map
is no longer misled while it waits.

A claim shorter than 30 characters gets no verdict either way. A short claim can coincide with
its source by accident, and calling that a quotation would be worse than asking.
