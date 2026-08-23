# Known issues

## A claim can be drawn with no visible connection (Exposition, some fold states)

`app/test_fold_invariants.mjs` fails on two of the five samples:

```
Carroll [by position]: 20 nodes, 9 bands
   FAIL  no drawn claim is left with nothing attached to it
         3 claim(s) drawn with no connection on screen, though they have one in the file:
         euclid-z, achilles-concedes-the-gap, tortoise-may-fail-to-see-it

Prescott-Couch [by position]: 37 nodes, 9 bands
   FAIL  no drawn claim is left with nothing attached to it
         1 claim(s): constitutive-relations-neglected
         after: as the viewer opens -> toggleNode(n0)
```

**What it means for a reader.** In the Exposition arrangement, under some combinations of folded
sections, a claim can appear on the map with nothing joining it to anything — while the file says
it does have a relation. A box floating unattached invites the reading "this claim stands alone",
which is exactly the false claim about an argument that a reconstruction must never make.

**Why it is left failing.** Making the suite green by relaxing the invariant would hide a real
defect, and this is the invariant most worth having.

### The mechanism, diagnosed 23 Aug 2026

The Prescott-Couch case is a **one-click reproducer**, which the Carroll case never was, and it
makes the cause legible.

In the by-position view every band of the text is given a **head** — the claim that band is
arguing for — and that head is seeded into the visible set so that no band of the text can drop
out of the view whose subject *is* the text. (`filterGraph`, step 2a-bis in
[argdown-live-map.js](app/src/argdown-live-map.js).) The seeding happens **before** the walk and
takes no account of folds.

So:

- `constitutive-relations-neglected` (`n25`) is its band's head, and is drawn.
- Its only relation in the file is `n25 → n3` (`humanism-not-reconciled`).
- Collapsing `n0` (`limits-not-uselessness`) stops the walk before `n3`, so `n3` is not drawn.
- `n25` is therefore on screen with nothing attached.

There is already a rescue for the *other* way this happens — a claim held back by an opened
section's marks is let through so its neighbour reconnects (step 2c, "NOTHING FLOATS"). It does
not fire here, and correctly so: `n3` is not fold-suppressed, it was simply never reached.

### What was tried, and why it is not in the tree

**Extending the rescue to seeded claims** — for a claim on screen only because it was seeded, let
through the one hidden neighbour that reconnects it. This fixes Prescott-Couch outright and takes
Carroll from three adrift claims to one.

It was reverted, because it breaks a different invariant on Darwin:

```
   FAIL  expanding a claim hides nothing that was on screen (no depth limit)
         expanding n2 hid 1: n1
```

The rescue is greedy and is recomputed on every render, so a claim that exists on screen *only*
because it was rescued vanishes as soon as the rescue stops being needed — which is what
expanding a node does. That is the failure the code comment beside the existing rescue already
predicts: *"a claim rescued in one state but not the next VANISHES — a spare claim on screen
costs a little clutter; a claim disappearing costs trust."* Trading a floating box for a
disappearing claim is not a fix.

### Where a real fix probably lies

Two constraints have to hold together, and each has an invariant of its own:

1. every band of the text shows something (unless the reader folded that band);
2. every drawn claim has a drawn connection;

and a third rules out the easy escapes: nothing may vanish when the reader *expands* something.

That points away from post-hoc rescue and towards either **choosing band heads with the fold
state in view** — seed a band only when the walk leaves it empty, and prefer a head the walk can
reach — or **drawing an explicit "through" edge** to the nearest visible ancestor, so the reader
can see that the connection exists and is folded away. The second is more honest and is the
larger change: edges are currently only built between visible nodes.

To see it:

```bash
node app/test_fold_invariants.mjs --steps 0
```

`--steps 0` runs the exhaustive single-action pass only, which is enough for both cases.

## Opening a section can reveal more than one level of it (Reasons view)

Found 22 Aug 2026, running the fold invariants against a private corpus rather
than the public samples. It does **not** reproduce on anything in `samples/`,
so the repro below needs a corpus of your own:

```
IPSISSIMA_CORPUS=<your reconstructions> node app/test_fold_invariants.mjs --steps 40 --seed 7

horton-aggregation-risk-reductio [by argument]: 40 nodes, 6 sections
   FAIL  opening a section reveals one level of it, not several
         3 claim(s) from below the section's entry level are showing for no reason
         (5 of its 8 claims are up)
         after: as the viewer opens -> toggleGroup(s2)
```

Distinct from the issue above: different view (**by argument**, not by
position), different invariant, and it is a fold-state bug rather than an
edge-drawing one. The section opens to its entry level, but three claims from
deeper in the same section come up with it — so the reader sees a level they
did not ask for. Harmless to the argument, untidy on screen.

Not yet diagnosed. The `[by position]` run over the same file passes every
check, which points at the section-grouping path rather than at the fold
bookkeeping the two views share.
