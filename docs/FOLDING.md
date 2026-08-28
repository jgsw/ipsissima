# Why folding keeps breaking

*Written 27 August 2026, after a day in which a reader found two fold defects that twelve seeds
of the property test had missed. The question was: why does this keep happening, and what would
end it? Every number below is measured, and the commands are given.*

---

## Your hypothesis, tested

> *Is the basic problem that the argdown as written is not actually a DAG, but we can only
> display it via dagre as a DAG?*

**No — and the near miss is more useful than the hypothesis.** Across nine reconstructions,
including Argdown's own samples:

| map | nodes | edges | **cycles** | multi-parent claims | roots |
|---|---|---|---|---|---|
| Akhlaghi | 93 | 104 | **0** | 9 | 2 |
| Carroll | 20 | 19 | **0** | 0 | 1 |
| Darwin | 23 | 25 | **0** | 4 | 2 |
| Prescott-Couch | 37 | 38 | **0** | 3 | 2 |
| Tooming | 127 | 141 | **0** | 14 | 2 |
| Wilson | 42 | 48 | **0** | 8 | 4 |
| populism | 56 | 60 | **0** | 4 | 1 |
| semmelweiss | 22 | 27 | **0** | 5 | 5 |
| greenspan | 9 | 8 | **0** | 0 | 1 |

**Not one cycle anywhere.** These are DAGs, and dagre is not being asked to draw something the
file is not.

But look at the last two columns. **They are not trees.** Up to fourteen claims in one map have
more than one parent, and up to five have none.

**Folding is a tree operation.** "Collapse this claim" means "hide what is below it" — which is
exactly defined on a tree, where every claim hangs from one place, and *under-defined* on a DAG,
where a claim can be held up by two parents at once. Collapse one of them and the claim stays,
held by the other. Nothing is wrong with the map, the parser, or dagre. The operation the
interface offers does not have a unique meaning on the structure the file describes.

That is the first cause, and it is a **design** gap rather than a bug: nowhere in this repository
is it written down what folding a claim in a DAG is supposed to do. `viewer.md` lists the
invariants — which are the tests — and the invariants are all statements about what must *not*
happen. There is no statement of what folding *is*.

## The second cause: nine mechanisms, and no one place that says what is visible

A claim can be off the screen for any of these reasons, and they compose:

1. the facet filter excluded it
2. it is not reachable from a seed — and the seeds are computed **ignoring folds**
3. its section is folded, and a folded section is *walked through* rather than walked into
4. the reader folded it by hand
5. the reader folded an ancestor
6. it is past the depth limit
7. it is inside a collapsed group and drawn as that group's block instead
8. it is inside a collapsed band in the by-position view
9. — and then **two passes put things back**: the connectivity rescue, which re-runs the whole
   filter with a claim forced in so that nothing is drawn floating, and the through-edge repair

Nine reasons to be hidden and two to be un-hidden, some of which are exemptions from others
(`expandedNodes` exempts a claim from both its section's suppression *and* the depth limit).
**Visibility is not a predicate anywhere. It is the outcome of a traversal with interacting
guards, followed by repairs that can undo them.**

The already-open defect in `KNOWN-ISSUES.md` is precisely a seam between two of these:
**walking through a suppressed claim reached further than drawing it**, so expanding a claim
turned a pass-through into a stop and the reach of the walk *shrank*. That is not a mistake anyone
makes reading one rule. It is what happens when nine rules are only ever read one at a time.

## The third cause, and the one that actually explains the whack-a-mole

**The property test checks one node per state.**

`test_fold_invariants.mjs` walks the state space and checks the invariants after each action — at
the node the action touched:

```js
const was = before.nodes.find(n => n.id === action.id);
```

Measured on the 127-node Tooming map: **923 checks over 800 random steps** — about 1.15 checks per
state, on a map carrying roughly fifty fold badges at any moment. **Coverage per state is about
one in fifty, and which one is chosen at random.**

That is why the two badge defects survived 1,200-step runs at twelve seeds and were then found in
seconds by sweeping one map exhaustively: the sweep asked the question of *every* badge in *every*
state — about 200,000 node-checks against the walk's 1,200.

There is a fourth cause hiding inside the third. **Until today every invariant was negative**:
edges stay closed, nothing vanishes, no claim is drawn twice, a section reveals only one level.
Not one of them said that anything must *happen*. A control that does nothing violates none of
them, which is exactly why a dead badge was invisible to the whole suite while being obvious to a
reader in about four seconds.

---

## What would end it

### 1. Say what folding means

One paragraph, in `viewer.md`, deciding the DAG question: does collapsing a claim hide *everything
below it*, or *everything reachable only through it*? The code implements the second, implicitly
and inconsistently. Writing it down makes the badge derivable rather than guessable.

### 2. Derive the badge from the model, never from a proxy

Both badge defects were the same mistake in different clothes. The badge was computed from
something *near* the truth — `hidden` from "children not currently visible", `expandable` from
"has children at all" — rather than from the thing it promises. With a model, both are one
definition:

> a fold control is drawn when `visible(state)` differs from `visible(state + this fold)`

That is what the fix now does for the `−` half, by re-running the walk. It should be what the
`+` half does too.

### 3. Check every node, not the one that was clicked

**The single highest-value change to the existing test, and close to free.** It costs no extra
state exploration — the states are already being generated — and raises coverage per state from
one in fifty to one in one. Both of today's defects would have been caught the first time it ran.

### 4. Exhaust small maps instead of sampling large ones

This is the recommendation that matters, and it is now demonstrated rather than argued.

`app/test_fold_exhaustive.mjs` takes **every graph shape** of N claims — all 21 at N=4, all 315 at
N=5 — crosses each with every combination of collapsed claims and every depth, and checks every
node in every state:

```bash
node app/test_fold_exhaustive.mjs 4     # 21 shapes, 1,008 states, under a second
node app/test_fold_exhaustive.mjs 5     # 315 shapes, 30,240 states
```

**Its first run found a defect in the fix written an hour earlier**, with this counterexample:

```
n1->n0, n2->n1, n3->n1     collapsed {n0}
```

A claim the reader had *already folded* still offered a minus. Four claims, three edges, one fold.
Nothing in the published corpus had shown it in a day of looking, and the repair was one line.

The corpus maps are **too large to reason about and too particular to generalise from**. A
127-node map has more fold states than there are atoms worth counting, so any walk of it is a
sample; and when it fails, it fails at a specific claim in a specific paper, which teaches you
about that paper. A four-claim map has 1,008 states, all of which can be visited, and its
counterexamples are shapes — *a claim with two parents, one of them shut* — which is a sentence
about folding rather than a fact about Akhlaghi.

**Whack-a-mole ends when the space is small enough to enumerate.** It does not end by finding more
moles in the big map.

### 5. Keep both instruments, and know what each is for

Neither replaces the other, and today showed both edges of the trade:

| | finds | misses |
|---|---|---|
| **random walk, one big map** | defects common in deep fold states; anything needing real section structure, bands, or a manuscript | anything rare in the space or specific to one claim — it checks one node per state |
| **exhaustive, tiny maps** | anything that is a *shape*, immediately, with a counterexample a person can hold in their head | anything needing size: groups, bands, the by-position view, the rescue as it behaves at scale |

---

## What was done, 27 August 2026

All four recommendations are implemented, and implementing them found two more defects — which is
the strongest evidence available that they were the right ones.

**1. The semantics are written down.** `viewer.md` now opens with what folding means: *hiding
everything reachable **only** through the folded claim*, with the three consequences that follow
and were each a defect before they were a rule.

**2. Both halves of the badge are measured against the drawn picture.** `foldable` re-runs the
walk with the claim collapsed; `hiddenBelow` no longer counts a child that would only appear
inside a section block already on screen. That second one was found by the new harness, not by
reasoning — see below.

**3. The walk now checks every badge, periodically.** Checking every node in every state costs a
`filterGraph` per badge, about 380 ms per state on the 127-node map — four hundred seconds a seed.
So the **states** are sampled instead of the nodes: every fortieth state is examined exhaustively.
Coverage per state on Akhlaghi went from 1.15 checks to 1.68.

**4. The exhaustive harness ships and is in the suite.** `test_fold_exhaustive.mjs`, at N=4.

### The two defects the recommendations found

**An already-folded claim still offered a minus.** Counterexample `n1->n0, n2->n1, n3->n1` with n0
shut — four claims, one fold. Folding a claim that is already folded is a no-op; nothing had
checked.

**A claim already standing behind a section block was counted as hidden.** This is the one worth
reading. Adding sections to the generator turned up **5,940 cases** at N=4, smallest being
`n1->n0, n2->n1, n3->n0` with n0 and n2 in a shut section: `n1` offered "+1" for a claim that would
have appeared inside the block already beside it. **It is the same mistake as the `−` half, on the
other half, and I had fixed one and not seen the other.** Measuring both against the drawn picture
rather than the walk's raw set closes both.

Result: **0 and 0 across 1,680 shapes and 322,560 states with sections**, 276,312 node-checks.

### The rescue, diagnosed

The residue named in the first draft of this report is explained. `filterGraph` is a **driver over
`filterOnce`**: where a claim is left with nothing attached, `filterOnce` names the neighbour that
would reconnect it and the driver **runs the whole pass again** with that neighbour forced in.
Folding the contention left it alone, the rescue put a claim straight back, and the fold appeared
to do nothing.

The fix is the semantics applied consistently: **the rescue does not override a fold.** A claim
left with nothing attached *because the reader folded it* is not adrift — it is what was asked
for. The identical exemption already existed for depth limits, with the identical reasoning, three
lines above.

## The generator, extended — and what it taught

**Sections became contiguous runs.** An Argdown section is a stretch of the document and nothing
else can be one, so generating every subset spent the budget on shapes no reconstruction can have.
At N=5 that is 41 contiguous groupings against 242 arbitrary ones — and 29 million states against
a number that finishes. Faithfulness and tractability pointed the same way, which is not always
true and is worth taking when it is.

**Bands were added**, and adding them exposed a hole in the harness itself: the by-position view
has almost no *claim* badges (measured: `expandable: 0` on a plain by-position state) because in
that arrangement the badges are on **blocks** — and the generator was skipping every node with
`kind === "group"`. The whole second arrangement was effectively unchecked. **The harness had the
same shape of bug as the code it was testing**: it checked a proxy — claims — rather than the
thing that carries the promise, which is a badge wherever it is drawn.

| run | shapes | states | node-checks | `+` | `−` |
|---|---|---|---|---|---|
| N=4 | 21 | 1,008 | 1,344 | 0 | 0 |
| N=4, sections | 525 | 100,800 | 93,696 | 0 | 0 |
| N=4, sections + bands | 525 | 604,800 | 648,636 | 0 | 0 |
| **N=5, sections** | **15,750** | **6,048,000** | **9,510,044** | **0** | **0** |

## And then the constructed states ran out of answers

Nine and a half million states, clean — and the corpus still failed at the committed seed, on `n9`
after **nine successive `toggleNode`s**. That gap is the most useful thing in this document.

**The sweep enumerates states that can be CONSTRUCTED. A reader only ever reaches states that can
be REACHED, and they are not the same set.** The sweep sets `collapsedNodes` directly and leaves
`expandedNodes` empty and `groupFolded` empty. No reader arrives that way. `reduceFold` writes to
all three: expanding a claim deletes its fold, adds it to `expandedNodes`, and then **stepwise-
collapses its children one at a time**, keeping each fold only where the map still represents
everything it did. Those states are reachable and were never generated.

So the harness gained a third mode: **breadth-first over action sequences, deduplicated by state**
— every state a reader can actually arrive at, checking every badge at each.

```bash
node app/test_fold_exhaustive.mjs 5 --reachable 8
```

It **saturates**, which is the property worth having: 4,724 states at depth 6 and 4,925 at depth 8,
because that is the whole reachable space of a five-claim map. Not a sample of it — all of it.
Clean.

## Growing the generator was half the answer

It found two real defects — an already-folded claim still offering a minus, and a claim already
standing behind a section block counted as hidden — and then it **saturated**. Clean at six claims,
clean with sections, bands, multiple roots and mixed relation types, across nine and a half million
constructed states and every reachable state of a five-claim map. And the corpus kept failing.

That is not a failure of the method. **Enumeration told me where the bug was not**, which is worth
having and is what a whack-a-mole loop never gives you. But it could not tell me where it was,
because the generator can only produce shapes somebody thought to generate.

## The third instrument: shrink the real failure

`test_fold_invariants.mjs --dump` writes the exact failing state. Delta-debugging from there —
drop one claim, keep the drop if the failure survives, repeat to a fixed point — took the Akhlaghi
map from **93 claims to five**:

```
edges:  n8->n9, n8->n79, n9->n79        n8 has two parents
        n17->n80                        a SEPARATE component
groupFolded: n17:s2, n80:s2             marks left by an OPENED section
```

Two things the generator could not have produced: **two disconnected components** — it required
weak connectivity — and **`groupFolded` set with no collapsed group**.

### And the defect was in the fix

`drawnNow` was computed from `visible` **after** the connectivity rescue had added to it, while
`runWalk(id)` returns the set from **before** any rescue. A set with rescues was being compared
against one without, so the second looked smaller by however many claims had been forced in, and
a fold that changed nothing read as a fold that removed something.

The counterexample says it exactly: `n8` has two parents, so folding `n9` takes nothing away —
**and the rescue, firing on the other component entirely, made it look as though it did.** One
line: keep the walk's own answer before the rescue edits it, and compare like with like.

## Where it stands

**All 28 suites pass**, corpus seeds 1–8 clean with the private corpus, and both exhaustive modes
clean. Every invariant in this file now holds.

| instrument | finds | costs |
|---|---|---|
| **random walk, one big map** | defects common in deep fold states; needs real sections, bands and a manuscript | checks one node per state unless the every-badge pass fires |
| **exhaustive, tiny maps** | anything that is a *shape*, with a counterexample a person can hold in their head | only produces shapes somebody thought to generate |
| **delta-debugging a real failure** | the shape nobody thought of — straight to a minimal case | needs a failing case to start from, so it cannot replace the other two |

The order matters. The walk finds that something is wrong. The shrinker says what. Enumeration
then holds the ground, because a shape once minimised is a shape the generator can be taught.
