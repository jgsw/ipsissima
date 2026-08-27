# Known issues

## A claim can vanish when you expand another one (both views, deep fold states)

**The one open defect.** `app/test_fold_invariants.mjs` finds it on the published samples:

```bash
node app/test_fold_invariants.mjs --steps 1500 --seed 1
```

```
Carroll [by argument]: 20 nodes, 5 sections
   FAIL  expanding a claim hides nothing that was on screen (no depth limit)
         expanding n19 hid 5: n10, n13, n11
         after: … -> collapseAll -> toggleGroup(s2) -> toggleNode(n19)
```

**What it means for a reader.** Opening a claim should only ever add. In a deep enough fold
state — the reproducers all pass through `collapseAll` followed by opening a section and then a
node — expanding one claim can take others off the screen. Nothing is lost from the file, and
pressing the same control again brings them back, but a map that removes claims when you ask it
for more is telling you something false about the argument while you are reading it.

**THE SUITE'S DEFAULT SEED DOES NOT FIND THIS, and that is worth saying plainly.** The committed
run is `--steps 1500 --seed 20260817`, which is green. Seeds 1 and 7 fail at the same step count.
So the green tick is a regression gate — it holds the renderer to what it does today — and not a
proof that these invariants hold. Searching seeds in CI would turn the build permanently red for
one defect, which teaches a reader to ignore it; the honest arrangement is a fast gate plus this
entry.

**Not diagnosed.** Distinct from the two below in that it is about the fold *bookkeeping* rather
than about which claims get drawn: the state after `collapseAll` is not simply the union of the
individual collapses, and expanding out of it takes a different path back.

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
