# Known issues

**One open defect.** The suite is green at the committed seed and finds it at three of five
others, so green here means "no regression against yesterday", not "the invariants hold". The
reproducer is one command.

---

## A claim can vanish when you expand another (both views, deep fold states)

```bash
node app/test_fold_invariants.mjs --steps 1200 --seed 1 --dump /tmp/fail.json
```

```
Carroll [by argument]: 20 nodes, 5 sections
   FAIL  expanding a claim hides nothing that was on screen (no depth limit)
         expanding n19 hid 5: n10, n13, n11
```

### Diagnosed 27 Aug 2026, and it is not what it looks like

The first guess was that the safety guard on stepwise folding measured the wrong thing —
`keepsEverything` compares `representedBy`, which counts a claim as still shown when it is a
member of a drawn block. That guess was **wrong**, and the way it was wrong is worth recording:
the test's own invariant uses the same notion, so guard and invariant already agreed. Tightening
the guard to compare drawn-as-itself fixed nothing and made stepwise folding refuse more folds,
which moved the state space and made the failure appear at *every* seed instead of three.

**The real cause.** Replayed from the dumped state, expanding `n19` loses `group:s4` — a block
that was standing for five claims. Nothing collapsed those five; the block simply stopped being
drawn, because the walk no longer reaches anything inside `s4`.

It stops reaching because **walking THROUGH a suppressed node goes further than drawing it.** A
node held back by an opened section is walked through, so the traversal continues past it into
whatever hangs off it. Expanding that node makes it *drawn*, and the walk then proceeds from its
children — which stop at the first one in `collapsedNodes`. `s4` lay beyond that stop.

So expanding a claim converts a pass-through into a stop, and the reach of the walk **shrinks**.
That is the asymmetry, and no guard on the stepwise folds can see it: the state delta shows
`collapsedNodes` unchanged. The loss is caused by the expansion itself.

### Where a fix probably lies

Not in the guard. Either

- the walk's reach must be made **monotone under expansion** — expanding a node keeps whatever
  its pass-through was carrying, which means remembering what a suppression was reaching for; or
- a collapsed group must stop being **contingent on the walk**. A block that stands for five
  claims disappears when nothing routes into its section, which is what makes representation
  non-monotone in the first place. A group that is collapsed could be drawn because it is
  collapsed, not because something reached it.

The second is the deeper fix and the larger change.

### Tools

`--dump FILE` writes the exact failing state as JSON; `--trail` prints untruncated trails. **A
trail is not a reproducer** — replaying one from a fresh start does not reach the same place,
because `actionsFor` offers different actions in different states. Two hours went into learning
that. Use the dump.

---

## Fixed 27 Aug 2026

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
