# Known issues

## A second contention can be drawn unattached (Reasons view, one fold state)

Found 27 Aug 2026, by adding a sixth sample — which is what a corpus is for.

```bash
node app/test_fold_invariants.mjs --steps 0
```

```
Akhlaghi [by argument]: 93 nodes, 8 sections
   FAIL  no drawn claim is left with nothing attached to it
         1 claim(s): An urgent unexplored ethical challenge
         after: as the viewer opens -> toggleGroup(s2)
```

**What is different about this one.** The two fold defects fixed earlier were both in the
by-position view, and both were fixed by drawing a **through-edge** to the nearest visible claim
rather than importing the missing ones. This is the first in the **by-argument** view, and it is
the first to involve a **second contention**.

The claim is the paper's second thesis. It has exactly two relations in the file — it is the
conclusion of one premise-conclusion structure, and it is attacked by one claim — and both of
those sit in the section being opened. Opening that section leaves it on screen with neither.

**Not diagnosed.** A hand reproduction of `toggleGroup(s2)` from an empty state does not
reproduce it: the claim keeps both edges. So the failing state is the one the harness reaches
from "as the viewer opens", which is not the empty state, and the difference is where the bug
lives. Step 5b's through-edge should still have fired; why it does not is the question.

**Why it is left failing.** Making the suite green by holding the sample out would be gaming: the
map is a legitimate reconstruction of a real paper, it checks clean, and it is exactly the kind of
file a reader will open. The invariant is the one most worth having.

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
