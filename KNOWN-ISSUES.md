# Known issues

**One open item, below and measured.** Residual claim movement on fold clicks: reading order
can no longer invert — the map draws in stable document order by construction — but positions
still drift as neighbourhoods fold away, and the plan (`docs/STABILITY-PLAN.md`) holds the
numbers and the direction. Nothing else is outstanding: the last fold case is closed, the
Wilson departure crossing closed when the arrangement it lived in was retired, and both
entries below record how honestly rather than triumphantly.

The fold invariants hold on the published corpus at seeds 1–8, at 1,200 and 3,000 steps alike,
and at the committed defaults — re-measured 29 Aug 2026, with the `+N` badge invariant actually
running for the first time (see Fixed 29 Aug 2026 below) — the every-badge pass included; and
both exhaustive modes are clean — every reachable state of a five-claim map, and every
constructed state of a five-claim map with sections.

Three instruments now cover this, and `docs/FOLDING.md` says what each is for and why none of
them replaces the others. The short version: the walk finds that something is wrong, delta-
debugging a dumped failure says what, and enumeration holds the ground afterwards.

---

## Claims cross the map when a fold is clicked — measured 29 Aug 2026, open

A fold badge is a local request, and the claims that stay on screen should hold still enough
that the reader's mental map survives the click. Measured — after a reader watched a claim
glide across the whole Wilson map on one fold — they do not: **nearly half of all
picture-changing local clicks send at least one surviving claim across the midline**, on one
map 93 in 100 with a median worst move of two-thirds of the map's width, and the worst single
jump is five and a half times the width. dagre recomputes its global order from scratch for
every node set, so a one-node change can flip the whole arrangement; the document-order seating
only restores order within bands whose membership just changed, and the glide animation was
built on an assumption of small moves that nothing checked.

Not a fold defect — the same walk on the engine before and after the badge fixes produces
bit-identical crossing rates, and the badge defects themselves moved nothing at all (their
pictures did not change, which is what was wrong with them). The two families are separate
halves of the click contract: the fold suite checks a click changes what it promises,
`map_quality.mjs`'s **`@ transitions` rows** (added the same day, baselined) check it changes
it legibly.

Open, with a plan: `docs/STABILITY-PLAN.md` — attribution first, then a canonical left-to-right
order that filtered views project rather than re-derive, gated on the fold suite and the static
quality baseline throughout.

**Phase 2a landed the same day**, and the numbers above are now history: the seating pass packs
every band single-path in document order (its overlap veto had been silently handing 7% of
bands back to dagre's per-state order, and those bands carried three-quarters of the crossing
claims). Crossing claims on the attribution walk fell **13,490 → 5,325**, and order flips —
claims swapping left-right in a surviving row — fell from a quarter of all crossings to **2%**.
What remains is position drift with order intact (63%) and genuine re-ranking (25%), which is
what the plan's Phase 2b home columns exist for. The price — 25 static rows worse, notably
relic-route crossings and detours on the deep views — is written down per row in the plan and
re-baselined deliberately; 2b re-routes those edges and re-opens every one of those numbers.

**Phase 2b is built, routed and ON by default the same day** (`stableOrder: true`): every
block's x is a function of the document and the visible membership alone, and every route is
drawn for that arrangement rather than sheared from dagre's. Order flips and order-changing
recompositions are **zero by construction — and zero in 292,252 measured assignments**;
crossing claims fell 13,490 → 2,512 over the day, −81%. What keeps this item open is the
remainder: compression drift (order intact, positions sliding as a claim's neighbourhood folds
away) and genuine re-ranking still move claims past the midline on some clicks — worst on
Darwin — against the plan's target of none. The plan holds the trade table, the flip record,
and the engine question that follows from it.

**Phase 4 closed the reader's half of the residue — 29 Aug.** The camera now provably holds
the clicked control still (the pin machinery existed but had never run in the single-map
builds: its on-screen guard read the svg's own rect, which reports zero width there, and vetoed
every pin — found by end-to-end verification, fixed by measuring the pane instead), and the
glide clock scales with the size of the move so a big slide lands as one motion. The metric was
re-aimed to match: `anchorCross` measures movement relative to the clicked control, which is
what an anchored reader can actually feel. Re-baselined: wilson **0.00**, prescott 0.03,
tooming 0.05; what remains above zero is honest compression on small maps (darwin 0.58 — on 23
claims, folding any block moves neighbours by half the map, in formation) and the quiet-click
rank shift (carroll 0.17), whose known future shape — canonical ranks from the full map — the
plan records.

## A departure crossing accepted on Wilson — 28 Aug 2026, closed under it 29 Aug

`cross@out` counts pairs of edges that leave one node and cross each other just above it, and its
target is zero. After the samples were rebuilt with the new extraction prompt it is **one**, on
`wilson-williams-dewey @ detail`, at *Distinguishing the humanities from the science*: a support
edge and an attack edge whose departure points run in the opposite order to their destinations.

`departurePorts` would fix it by permuting those two departure points. `edgeGeometry` declines,
because seating a departure leaves dagre's interior points where they were and the line has to bow
to get back — and here that bow exceeds `DEPARTURE_BOW_ALLOWANCE`. Re-measured over the whole
corpus, the crossings that survive at 45 / 120 / 250 / 400 / unbounded are **3 / 1 / 1 / 0 / 0**,
and raising the allowance to 400 buys the last one at a price paid entirely on that one row:

| `wilson @ detail` | allowance 120 | allowance 400 |
| --- | --- | --- |
| `cross@out` | **1** | **0** |
| worst bend | 225 | 294 |
| overshoot | 120 | 160 |
| detour | 1.6× | 2.0× |

A line twice as long as its direct route is worse to look at than one crossing, so the allowance
stays at 120. **The crossing is recorded, not forgiven**: the baseline is per row and per metric,
so this row going to 2 — or any other row leaving zero — still fails the suite.

The earlier note on the allowance ("the crossings buy nothing") was measured on six maps, and held
for those six. It is the first constant in this renderer that a *larger corpus* moved rather than a
code change, which is worth remembering when the corpus grows again.

**Closed 29 Aug 2026, and not by a fix.** The stability project retired dagre's arrangement —
order, positions and routes are now the project's own (`docs/STABILITY-PLAN.md`) — and
`cross@out` on `wilson @ detail` is **0** in the new layout: the crossing lived in an
arrangement that no longer exists. That is the Akhlaghi lesson's shape again — the ground moved
under the entry — so this records the change of ground, not a repair. The metric row and its
baseline continue to guard the new arrangement, where the target is zero and zero is what it
measures.

---

## Fixed 31 Aug 2026

### A titled intermediary conclusion was nowhere at all

Reported from use, on the private Cribb map: the Master Argument's box listed premises (5) and
(7) and nothing else — no inference bars, no conclusions, and the reader could not recover the
two-step structure from the screen in any fold state, fully unfolded included.

**The defect sat in the join of two halves that were each defensible alone.** Argdown's map
maker connects an argument to a statement node in exactly two cases: the statement is the LAST
line of its structure (the main conclusion), or it is a PREMISE of it. A titled intermediary
conclusion is neither, so it got no edge in either direction. And `pcsRows` suppressed every
titled line's row on the assumption it "arrives as an arrow" — true for premises and the main
conclusion, false here. Net: the claim floated as its own box, held up by its *other*
supporters, while the argument concluding it stood beside it unconnected, and the box's
structure lost its bars because both bar-carrying rows were suppressed. Six arguments on the
Cribb map alone, the book's central inference among them; Miller carried two and Wilson one.

Two repairs, one per half. `toGraph` now synthesises the missing edge, argument → statement,
exactly as Argdown draws the main conclusion, marked `concludes` with the step. And `pcsRows`
draws **every line as a row**, boxed claims as the bracketed reference the file itself writes —
`(1) [Its Title]` — so the bars return and the structure reads complete and in order. The first
cut of this kept titled premises as gaps in the numbering ("a gap says that line is a box"),
and the gap doctrine did not survive its first reader: a structure whose early premises were
all titled still *began* at line (5), and nothing tied the surrounding boxes to the numbers
they were. So the numbering now closes the loop instead: every edge that embodies a line of a
structure carries that line's number at the argument's end of it — at each member's foot on the
junction bar, beside the arrow for an unjoined premise or a conclusion leaving the box — and
hovering a reference row lights up the box it names. The junction and hull tooltips also count
the step's premises rather than the fan's arrivals, which had a bar over a five-premise step
announcing four.

Synthesised edges change a map's structural fingerprint, so fold-state identifiers minted
before this fix are refused against rebuilt maps — by design, since the ids would otherwise
name a different picture. Quality baseline re-recorded: Miller's `@ all` view improved
materially (edge crossings 54 → 23) at the cost of modest bend/overshoot on its near views,
which is the price of drawing edges that ought to exist.

### The words did not survive the label mode

Found in the same reading session: on the same map, every box was a bare title — nothing on
screen or in a tooltip let a reader unpack what "Unsafe Without Philosophy" actually amounts
to. The map's front matter sets `statementLabelMode: "title"` and `argumentLabelMode: "title"`
(the only file in the corpus that does), which tells Argdown to put nothing but the title on a
map node; the adapter read the words off `labelText` alone, so the box, its tooltip and the
claims toggle all had nothing behind the title.

A label mode is an export style for Argdown's own outputs. The adapter's contract is now that
the claim's words are always carried — when `labelText` is empty, `toGraph` reads the
definition, exactly where `wordsOf` reads it for a bare reference line — because a field that
is carried can be drawn, and the viewer's claims toggle is what decides how much of it shows.
A claim referred to but never defined stays empty: its title is already everything the file
says. `test_label_modes.mjs` holds the contract, both modes on and off.

## Fixed 29 Aug 2026

### Expanding a claim the reader opened revealed nothing

Reported from use, as the `.argdown` plus a fold state identifier — the first field report to
arrive in the form the Tools section asks for, and the form worked: paste, restore, and the
failure was on screen. On the Wilson map, nine hand folds deep at depth 2, `n96` wore a `+1`
that did nothing when clicked. No delta-debugging was needed, because the class turned out to be
one click wide: open one section on five of the seven published maps and some entry claim offers
a `+N` that reveals nothing (`n9` on Carroll, `n1` on Miller among them).

**The defect was the missing half of the 28 Aug exemption, and that exemption is what armed
it.** The vanishing-claim fix taught the walk to *draw* a hand-opened claim whatever its section
says — but not to stop *forwarding* the suppression chain the claim was reached under, so
everything below a hand-opened claim stayed hidden as if the reader had never opened it. And the
draw half set the trap for the rest: drawing on a suppressed arrival marks the claim visible,
which deduplicates away the clean arrival that used to do the forwarding — so which parent
reaches the claim first decided what a click did. Measured across the corpus in one-click
states: **0** lying badges at the commit before the draw-exemption, **5** at every commit since,
**0** after the fix. The fix is one line, beside the line it completes: a claim the reader
opened by hand forwards no inherited suppression, for the same reason it is drawn.

**And the walk's own check for this had never run.** The invariant `a badge offering N claims
reveals at least one when clicked` was gated on `ctx.opening`, which `step` sets only for
toggleGroup — for every toggleNode it was false, and the invariant had been dead since the day
it was written. A dead check reads exactly like a passing one: eight seeds were called clean
while five maps carried a dead `+1` one click from the opening view. Gated on `ctx.expanding`
now, the resurrected check finds the old defect within 400 steps at seed 1 and prints the
identifier to rebuild it. The exhaustive harness asks the same question without the gate, which
is why its counts were honest all along — its generated shapes simply never armed the
first-arrival race.

Re-measured with the invariant alive: seeds 1–8 at 1,200 and 3,000 steps and the committed
defaults clean, both exhaustive modes clean, every suite passing.

## A fold badge can be a promise the map does not keep — fixed 27–28 Aug 2026

A badge is a **contract**. It is drawn as `+N` or `−`, and its tooltip says "Show N claims". A
click that changes nothing is the interface contradicting itself, and a reader cannot tell it
from a dead control.

```bash
node app/test_fold_invariants.mjs --steps 800 --seed 1
```

### The `+N` half — fixed 27 Aug 2026

`filterGraph` **forces** claims onto the screen that the walk never reached, so that nothing is
drawn floating. That happens on the line immediately before the badge count is computed, and the
count then ran over every visible node, rescued ones included. A rescued claim is there to keep a
connection honest, not because the reader has opened a path to it — the walk still does not
proceed *from* it — so expanding one revealed nothing.

Reported from use on the Akhlaghi map: collapse *The conditional answer* and its supporter *The
answer meets the adequacy conditions* offers `+1` for a claim two stops away.

Found by sweeping **4,230 fold states** of that map and asking of every badge whether expanding it
revealed anything: 6 did not, and all 6 were rescued claims. After the fix, **0 of 4,230**. The
invariant `a badge offering N claims reveals at least one when clicked` now holds.

### The `−` half — fixed 28 Aug 2026, in the commit that recorded it as open

**43 claims carried a minus on the Akhlaghi map's default view and 8 hid nothing**, *Revelatory
Non-Interference* among them. Both halves of the badge are now measured against the **drawn
picture** rather than the walk's raw set, and the connectivity rescue no longer overrides a hand
fold — a claim left with nothing attached because the reader folded it is not adrift, which is the
exemption depth limits already had.

Measured after: **0 and 0 across 1,680 shapes and 322,560 fold states with sections**
(`node app/test_fold_exhaustive.mjs 4 --groups`), and 0 on the published corpus at seeds 1 and 2.

**The last case** — `n9` on Akhlaghi after nine successive hand folds, no section toggles — is
closed, and the record should be honest about how. The paragraph that stood here said "one case
remains" **in the very commit whose other half fixed it**: delta-debugging the dump took the
Akhlaghi map from 93 claims to five, and the defect was in the fix above — `drawnNow` was
computed from `visible` *after* the connectivity rescue had added to it, while `runWalk` answers
from *before* any rescue, so a fold that changed nothing read as a fold that removed something.
The one-line correction landed alongside this text, and `docs/FOLDING.md` in the same commit
already told the finished story while this file still said one case remained. Both badge
invariants were themselves introduced in that commit, so **no committed build has ever failed
them** — the failing state existed only in the working tree, mid-fix.

Re-measured 29 Aug 2026 on the current samples: seeds 1–8 at 1,200 and 3,000 steps and the
committed defaults are all clean, and the recording commit itself is clean at those defaults.
The samples had been rebuilt with a new extraction prompt two days before, but that is not what
closed it: the Akhlaghi `.argdown` has not changed since the stale paragraph was written.

### A metric that was accidentally right

Found while fixing the above, and worth its own note. `map_quality.mjs` computed a badge position
for **every** node and counted an arrowhead near it as hidden. That was correct only while
`expandable` meant "has children at all" and nearly every node had a badge. The moment badges were
drawn only where they do something, the metric reported `hiddenArrowheads: 0 → 3` on maps whose
drawing had not changed at all — a correctness regression that was not one.

`badgeCentres` in the renderer has always filtered on `expandable`. The metric now says the same
thing. **A measurement that agrees with the code only by coincidence will report the fix as the
regression**, which is the most expensive kind of wrong.

## Fixed 27 Aug 2026

### A claim can vanish when you expand another (both views) — fixed

```
Carroll [by argument]: 20 nodes, 5 sections
   FAIL  expanding a claim hides nothing that was on screen (no depth limit)
         expanding n19 hid 5: n10, n13, n11
```

Expanding a claim dropped a collapsed block that was standing for five others. The diagnosis in
this file was right and is worth keeping: **walking THROUGH a suppressed node went further than
drawing it.** A node held back by an opened section was walked through, so traversal continued
past it; expanding it made it *drawn*, the walk then proceeded from its children and stopped at
the first one in `collapsedNodes`, and everything beyond that stop was lost. Expanding converted
a pass-through into a stop and the reach of the walk **shrank**.

The wrong first guess is also worth keeping. Tightening `keepsEverything` to compare
drawn-as-itself fixed nothing and made stepwise folding refuse more folds — guard and invariant
already agreed, and no guard on the stepwise folds can see this anyway, because the loss is
caused by the expansion itself and the state delta shows `collapsedNodes` unchanged.

**The cause, exactly.** The `collapsedNodes` stop lived inside the walk's `if (!fold)` branch, so
a claim the reader had shut was honoured only when it happened to be drawn. The fix is one line
moved: the stop now sits beside the depth limit, outside that branch, so both branches stop where
the reader said to stop. **The same lesson had already been learned once in this very loop** —
the comment above the depth check records exempting passed-through nodes letting a folded section
reach past the limit, "which read as expanding something making the map smaller". That is this
bug, described in advance, against the other limit. `collapsedNodes` never got the same treatment.

Of the two directions this file proposed, the first — make the walk's reach monotone under
expansion — turned out to be not the larger change but the smaller one, and it needs no memory of
what a suppression was reaching for: give the two branches the same stopping rule and the
asymmetry has nowhere to live.

The second — draw a collapsed group **because it is collapsed**, not because the walk reached it
— was **not** taken, and looking at the other failures is what settled it. It would not have
worked. On Darwin, `expanding n12 hid 4: n1, n9, n2` loses claims out of `group:s2`, which is
drawn *before and after*: the block simply shrinks from ten members to six. Same on
Prescott-Couch, where `group:s2` goes from three members to two. Drawing the block
unconditionally would have changed nothing, because the block was never the thing that
disappeared — what shrank is the set of members the walk reached, and that is what a block stands
for. The Carroll case where a whole block vanishes is the same fault with the member count
happening to reach zero. Groups were the symptom; the walk was the seat of it.

**A second defect, uncovered by the first fix and fixed with it.** Once the walk stopped at shut
claims, Gettier produced `expanding n1 hid 1: n1` — clicking "+" on a claim made *that claim*
disappear. It was on screen only because the connectivity rescue had forced it in, and expanding
it removed the reason for the rescue: the crutch-withdrawal the rescue's own comments predict.
The cure is the exemption `reduceFold` already believes in and the walk overruled. Opening a
section skips its hand-opened members when it lays down the marks, and expanding a claim deletes
the mark it carries — but suppression is **inherited from the parent's active set**, not only
from the node's own mark, so a claim could be exempt by the state machine and suppressed by the
walk anyway. A claim the reader opened by hand is now drawn whatever its section says.

Doing the same for hand-*collapsed* claims was tried, on the argument that a fold with no badge
on screen is a trap. It is much worse: it puts a section's deeper levels on screen the moment the
section opens, and "opening a section reveals one level of it, not several" went from silent to
**12** violations over five seeds. Only the opened mark is exempt — the one that invariant
already carves out for.

Measured over 1,200 fold states at each of twelve seeds, this invariant's violations:

| corpus | before | after |
|---|---|---|
| published samples | 10 (8 of 12 seeds) | **0** |
| plus a private corpus | 15 (10 of 12 seeds) | **0** |

Over the first five seeds alone, 4 → 0 and 7 → 0. The change bites only where the reader has
folded something by hand — with `collapsedNodes` empty it is a no-op — so no fixture and no map
quality metric moves, and all 25 suites pass.

### A second contention drawn unattached — fixed

In the by-argument view, opening a section left the paper's second contention on screen with
nothing joined to it. Its **entire connected component** was inside the section being opened, so
the through-edge repair added in August had nothing to draw a line to: the BFS walked the whole
component and found nothing drawn.

Two repairs had existed and each covered only half the problem. The old step 2c let a held-back
neighbour through, and ran **before** groups were collapsed, so it guessed at the finished picture
and guessed wrong often enough to make sections appear to open several levels at once. Step 5b
draws a through-edge and needs a drawn claim to reach.

They are now one repair, in one place, with the finished picture in hand: try a through-edge
first, because it adds no nodes and so cannot make anything vanish; only where no drawn claim is
reachable at all, name the neighbour that would reconnect it and **run the pass again** with that
neighbour forced in. Re-running rather than patching the output keeps one description of how a
picture is built — the rescued claim goes through group collapse and edge rewiring like everything
else.

One exclusion, restored from the old repair after it broke three fixtures: **nothing is rescued
under a depth limit.** At depth 0 a lone contention with nothing attached is not adrift; it is
what was asked for.

Measured across five seeds and 1,200 steps: floating-claim violations 5 → **0**, on the published
corpus and on a private one.

---

## Fixed 23 Aug 2026


Kept here because both were load-bearing entries for a while and the reasoning is worth having.

### A claim drawn with no visible connection (Exposition) — fixed

In the by-position view, every band of the text is given a **head** — the claim that band argues
for — seeded into the visible set so that no band of the text can drop out of the view whose
subject *is* the text. The seeding happened before the walk and took no account of folds, so
collapsing the claim a band argued *towards* left its head on screen attached to nothing. A box
adrift reads as a claim that stands alone, which is exactly the false claim about an argument a
reconstruction must never make.

**The fix draws the connection instead of importing the claims.** Adding the missing claims back
was tried first and reverted: it worked, and it broke something worse, because a claim on screen
only because it was rescued vanishes as soon as the rescue stops being needed — so *expanding*
could hide one. Instead the map now draws a **through-edge**: one faint, finely broken line from
the adrift claim to the nearest claim that is drawn, along the relations the file actually has,
passing through whatever is folded away in between.

That satisfies both rules at once and cannot violate the third, because a set of nodes that never
grows can never shrink. It is also the more honest picture — the reader sees that the connection
exists and that something is folded out of the middle of it, rather than seeing a claim that
appears to stand alone. It keeps the relation's colour, which is true, and loses its solidity,
which is not.

### Opening a section revealing more than one level of it (Reasons) — fixed

This turned out to be the *first* bug's old fix causing the second. A rescue in the filter let
held-back claims through whenever something would otherwise be drawn unattached; those claims
came from below the section's entry level, so opening a section appeared to unfurl several levels
of it at once.

Replacing the rescue with through-edges removed the mechanism and the symptom together. Measured
over 1,200 random fold states on seven reconstructions, including four not in this repository:
invariant violations fell from **23 to 10**, and this class went to **zero**. The renderer lost
41 lines.

---

## Tools

`--dump FILE` writes the exact failing state as JSON; `--trail` prints untruncated trails. **A
trail is not a reproducer** — replaying one from a fresh start does not reach the same place,
because `actionsFor` offers different actions in different states. Two hours went into learning
that. Use the dump.

Every failure also prints a **fold state identifier** — one line that names the pre-action
state, rebuildable in the app itself: About → Debug → The fold state, paste, Restore, then
perform the trail's last step by hand. The same line is what to ask a reader for when they
report a folding bug, alongside the `.argdown`. `docs/FOLDING.md` has the full story.
