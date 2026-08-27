# Known issues

**Two open defects. The suite finds the first and not the second.** `run_all_tests.mjs` reports
one failing suite — the first defect below — and CI allows exactly that one. The second is
reachable at other seeds and the committed run does not reach it, so a green line for everything
else means "no regression against what the renderer did yesterday", not "the invariants hold".

Searching seeds in CI would make the badge red for a second defect nobody is about to fix, which
teaches a reader to ignore it. The arrangement is a gate that allows one named failure, plus this
page — and this page has to be read.

---

## 1. A second contention drawn unattached (Reasons view)

Found by the committed run, so CI is red on it.

```bash
node app/test_fold_invariants.mjs --steps 1500
```

```
Akhlaghi [by argument]: 93 nodes, 8 sections
   FAIL  no drawn claim is left with nothing attached to it
         1 claim(s): An urgent unexplored ethical challenge
         after: as the viewer opens -> toggleGroup(s2)
```

One action from the opening state. The claim is the paper's **second thesis**; it has exactly two
relations in the file — it is the conclusion of one premise-conclusion structure and is attacked
by one claim — and both sit in the section being opened. Opening that section leaves it on screen
with neither.

This is the first of these in the **by-argument** view; the two fixed in August were both
by-position. Step 5b's through-edge should have fired and does not, and why is the question.

**It matters more since 27 Aug 2026**, when the instructions were changed to say that a paper may
argue for more than one thing. Second contentions will now be commoner, and this is the defect
that greets them.

## 2. A claim can vanish when you expand another (both views, deep fold states)

**Not found by the committed seed.** Other seeds reach it:

```bash
node app/test_fold_invariants.mjs --steps 1500 --seed 1
```

```
Carroll [by argument]: 20 nodes, 5 sections
   FAIL  expanding a claim hides nothing that was on screen (no depth limit)
         expanding n19 hid 5: n10, n13, n11
         after: … -> collapseAll -> toggleGroup(s2) -> toggleNode(n19)
```

Opening a claim should only ever add. In a deep enough fold state — the reproducers all pass
through `collapseAll` followed by opening a section and then a node — expanding one claim can take
others off the screen. Nothing is lost from the file and pressing the control again brings them
back, but a map that removes claims when you ask it for more is telling you something false while
you are reading it.

**Not diagnosed.** It is about the fold *bookkeeping* rather than about which claims get drawn:
the state after `collapseAll` is not the union of the individual collapses, and expanding out of
it takes a different path back.

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
