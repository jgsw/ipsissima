# Known issues

**Two open items, both below and both bounded.** One fold case survives at a committed seed on
the Akhlaghi map; one departure crossing on the Wilson map is accepted by measurement rather than
fixed. Nothing else is outstanding.

The fold invariants hold at eight seeds and 1,200 steps on the published corpus and a private one,
the every-badge pass included; and both exhaustive modes are clean — every reachable state of a
five-claim map, and every constructed state of a five-claim map with sections.

Three instruments now cover this, and `docs/FOLDING.md` says what each is for and why none of
them replaces the others. The short version: the walk finds that something is wrong, delta-
debugging a dumped failure says what, and enumeration holds the ground afterwards.

---

## A fold badge can be a promise the map does not keep

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

### The `−` half — one case left

**43 claims carried a minus on the Akhlaghi map's default view and 8 hid nothing**, *Revelatory
Non-Interference* among them. Both halves of the badge are now measured against the **drawn
picture** rather than the walk's raw set, and the connectivity rescue no longer overrides a hand
fold — a claim left with nothing attached because the reader folded it is not adrift, which is the
exemption depth limits already had.

Measured after: **0 and 0 across 1,680 shapes and 322,560 fold states with sections**
(`node app/test_fold_exhaustive.mjs 4 --groups`), and 0 on the published corpus at seeds 1 and 2.

**One case remains**, at the committed seed: `n9` on Akhlaghi after nine successive hand folds,
no section toggles. Since the exhaustive harness is clean at four claims with sections, reaching
it needs a bigger generator rather than a longer hunt in the big map — N=5 with sections, then
bands. `docs/FOLDING.md` says why that is the right direction.

### A metric that was accidentally right

Found while fixing the above, and worth its own note. `map_quality.mjs` computed a badge position
for **every** node and counted an arrowhead near it as hidden. That was correct only while
`expandable` meant "has children at all" and nearly every node had a badge. The moment badges were
drawn only where they do something, the metric reported `hiddenArrowheads: 0 → 3` on maps whose
drawing had not changed at all — a correctness regression that was not one.

`badgeCentres` in the renderer has always filtered on `expandable`. The metric now says the same
thing. **A measurement that agrees with the code only by coincidence will report the fix as the
regression**, which is the most expensive kind of wrong.

## A departure crossing accepted on Wilson — 28 Aug 2026

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

---

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
