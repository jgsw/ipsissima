# Known issues

## A claim can be drawn with no visible connection (Exposition, some fold states)

`app/test_fold_invariants.mjs` fails on the Carroll sample:

```
Carroll [by position]: 20 nodes, 9 bands — 1643 checks over 1500 random steps (seed 20260817)
   FAIL  no drawn claim is left with nothing attached to it
         3 claim(s) drawn with no connection on screen, though they have one in the file:
         euclid-z, achilles-concedes-the-gap, tortoise-may-fail-to-see-it
```

**What it means for a reader.** In the Exposition arrangement, under some combinations of folded
sections, a claim can appear on the map with nothing joining it to anything — while the file says
it does have a relation. A box floating unattached invites the reading "this claim stands alone",
which is exactly the false claim about an argument that a reconstruction must never make.

**Why it surfaced only now.** The invariant has always been checked, but against a corpus of two
maps that never hit it. Replacing that corpus with the published samples exposed it immediately.
The failure reproduces identically in the code this repository was extracted from, so it is not a
consequence of the extraction.

**Why it is left failing.** Making the suite green by relaxing the invariant would hide a real
defect, and this is the invariant most worth having. It is reported here instead.

To see it:

```bash
cd app && node test_fold_invariants.mjs
```

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

Distinct from the Carroll issue above: different view (**by argument**, not by
position), different invariant, and it is a fold-state bug rather than an
edge-drawing one. The section opens to its entry level, but three claims from
deeper in the same section come up with it — so the reader sees a level they
did not ask for. Harmless to the argument, untidy on screen.

Not yet diagnosed. The `[by position]` run over the same file passes every
check, which points at the section-grouping path rather than at the fold
bookkeeping the two views share.
