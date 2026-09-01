# Where the tests stop, and what got through

Written 1 September 2026, after a fortnight in which eighteen defects were introduced and fixed
in the renderer and **the suite caught none of them**. Eight reached the author, who found them by
clicking around a map. The question this answers: what to build so that the next fortnight's work
does not depend on him doing that again.

Numbers are marked. **[measured]** was taken on this machine on the date above; **[reported]**
comes from a project's own documentation; **[judgement]** is a design call and is where to argue.

---

## 1. The verdict

**The testing philosophy is not the problem. Its reach is.**

`docs/FOLDING.md` and `docs/viewer.md` already set out a discipline that works: make the logic
pure, exhaust it on small cases, sample it on real ones, shrink real failures to minimal ones, and
mutation-test every instrument so that a harness which has never failed is never trusted. Twenty
three suites run on every push [measured]. That discipline found and killed a whole class of fold
defects that had previously been whack-a-mole.

It stops at the DOM. Everything `createLiveMap` does *after* it computes a layout — what it paints,
where the paint lands, what a pointer does to it, and what the export writes out — has no
instrument at all. That is precisely where the last fortnight's work has been, and precisely where
all eighteen defects lived.

So: **three new instruments, on the far side of that boundary, built to the same rules.** Ordered
by defects-caught per unit of cost, they are rendered invariants, real gestures, and artifact
checks. Plus one thing that is not a test at all — a visual diff *report*, which is the only item
here aimed at the author's own time rather than at correctness.

---

## 2. The evidence

Every defect of 31 August – 1 September, what it was, and which proposed instrument would have
caught it. `R` marks the eight the author reported; the rest were caught before he saw them, most
of them late and by luck.

| # | defect | caught by |
|---|---|---|
| 1 R | right-click "Fold section" never appeared — `preventDefault()` on `pointerdown` with no button check, cancelling the default action that raises `contextmenu` | gestures |
| 2 | shrinking the band's hit area freed the drag and took the right-click with it | gestures |
| 3 R | the camera pin held the node's centre, not the point pressed | invariants |
| 4 R | and then held the node's bottom, not its top | invariants |
| 5 | `test_fold_camera.mjs` passed while asserting nothing: an open section is a band in `vis.groups`, not a node, so every lookup returned `undefined` | mutation |
| 6 R | long section titles truncated | invariants |
| 7 R | dragging inside a section selected text | gestures |
| 8 R | the ⊞ control did nothing when clicked | gestures |
| 9 | a white ⊞ pill on a dark map | invariants (dark in the matrix) |
| 10 R | arrows in the compact view started in mid-air — drawn from the row's bounds, not the box's | invariants |
| 11 | an edge segment drawn straight through a step box, striking out its verdict line | invariants |
| 12 R | seven clipped claims lost their hover text: `n.full` is read in three places and set in none | invariants |
| 13 | the quotation test suppressed by containment, hiding a claim that had padded its source | unit, on a pure function |
| 14 | the exported SVG was malformed XML — unescaped quotes from `font-family` | artifacts |
| 15 | step headings lost `text-transform: uppercase` in the export | artifacts |
| 16 | the `::before` arrow on carried lines vanished from the export | artifacts |
| 17 R | `Step 4` written twice, the edge layer being walked as well as copied | artifacts |
| 18 R | `rgba()` fills, which SVG 1.1 has no colour for | artifacts |

Counting by instrument: **invariants 6, artifacts 5, gestures 4, mutation 1, unit 1, one
unclassified** [measured, by the author of the table — the counterfactual is a judgement in each
case].

Two things that table says out loud:

**The defects cluster.** Six are one bug — "a number computed against the wrong rectangle" — in
four different places. An instrument that checks *drawn geometry against drawn geometry* would
have caught all six without knowing anything about the features involved.

**Synthetic events lie.** Defects 1, 2, 7 and 8 are all gestures, and all four survived checks I
had run, because a dispatched `contextmenu` never goes through `pointerdown` and a dispatched
`click` never goes through a drag. This is already written down as a standing instruction; it is
not yet written down as a program.

---

## 3. What the suite covers now

Twenty three suites, twenty five entries in the runner [measured]. They divide cleanly:

- **pure logic, exhausted** — `reduceFold` over every state of a five-claim map, `frameFor`,
  `layoutByText` over awkward fixtures and seeded random graphs, the validity vectors run by both
  the JavaScript and the Python halves against a Z3 differential test
- **real files, sampled** — the fold invariants walked over five published maps at eight seeds
- **the parser boundary** — what Argdown does and does not preserve

What none of them touch: a rendered `<svg>`, a `getBoundingClientRect`, a `<title>`, a pointer, or
a file the program wrote. `test_layout_geometry.mjs` says so itself: *"Two things it does not
cover, honestly: real font metrics, and the visual result. Those still want a browser."*

That sentence has been true and unacted on since the geometry harness was written. This plan is
the action.

---

## 4. Instrument A — invariants over the rendered map

A headless browser opens a built viewer, drives it into a state, and asserts against what is
actually on the page. **[judgement] This is the item that pays for itself; if only one thing is
built, build this.**

The states come free. `encodeFoldState` / `decodeFoldState` already exist, are already exported,
and already have a generator behind them in `test_fold_invariants.mjs`. The same seeded walk that
drives the fold logic can drive the renderer, so this instrument inherits a state space rather
than inventing one.

The invariants, each traceable to a defect above:

- **every edge endpoint lands on the box it belongs to**, within a pixel (10)
- **no edge segment's interior lies inside a box** (11)
- **no two drawn boxes overlap**, and nothing is drawn outside the reported canvas
- **every claim whose text is clipped can have the rest** — from a tooltip or a control (12)
- **no tooltip repeats what its own box already draws** (the hover principle, made executable)
- **every control drawn is hit-testable at its own centre** — `elementFromPoint` returns it or a
  child of it (2, 8)
- **a section's name is legible**: drawn in full, or shrunk, or truncated *and* recoverable (6)
- **the contention is on screen** after any fold — the existing invariant, now measured in
  rendered coordinates rather than layout ones (3, 4)
- **every assertion runs in both colour schemes** (9)

Cost: one dev dependency (Playwright, Apache-2.0 [reported], compatible with GPL-3.0 as a
devDependency), a browser download in CI, and perhaps 60–90 seconds of CI time [judgement,
unmeasured]. The corpus is 11 `.argdown` files [measured]; at a handful of fold states each this
is not a large matrix.

---

## 5. Instrument B — real gestures

A deliberately small, deliberately slow tier: a real pointer and a real keyboard, driven through
the browser, for the handful of interactions where synthesis is known to lie.

- right-click inside a section → the menu appears → **Fold section** folds it
- press and drag inside a section → the map pans and **no text is selected**
- click a bracketed premise row → the map travels → the return pill appears → its **×** dismisses
  without moving the camera → its arrow goes back
- click ⊞ → the panel opens → a claim inside it travels and dismisses → Escape closes it
- fold and unfold a section → what was under the pointer is still under the pointer

**[judgement] Keep this list short and let it grow only when a gesture defect escapes.** It is the
slowest, most brittle tier, and its value is concentrated in a few interactions where the browser's
own event ordering is the thing under test. Everything that can be an invariant should be one
instead.

---

## 6. Instrument C — the export as a checked artifact

Anything the program writes out is a file someone else's software will read, and this fortnight
produced four defects in one afternoon of writing one. Each export gets:

- **a strict XML parse** — `DOMParser` with `image/svg+xml`, which is what a `.svg` on disk gets,
  and which is not what `innerHTML` gives you (14, 18)
- **a legality check on every paint value**: no `rgba()`, no `var()`, nothing a 1.1 renderer
  cannot name (18)
- **a render through librsvg** (`rsvg-convert`, already on this machine [measured]), compared
  against a stored baseline for size and ink coverage rather than pixel equality
- **a text round-trip**: the multiset of strings in the file equals the multiset the panel draws.
  This single assertion catches 15, 16 and 17 — a lost uppercase, a dropped glyph and a duplicated
  label are all multiset differences.

The round-trip is the important one. **[judgement]** It is cheap, it needs no baseline, and it
states the actual contract of an export: *the same words, no more and no fewer.*

---

## 7. The rule that governs all three

**Every new invariant must be shown to fail.** Break the thing it checks, watch it complain,
restore it. `docs/viewer.md` already demands this of the geometry harness — *"A harness that has
never failed is worth nothing"* — and defect 5 is what happens when the rule is not applied: a
camera test that passed on the day it was written because it was asserting about `undefined`.

**[judgement] This should be a precondition of merging an instrument, not a virtue.** A one-line
note in the test file naming the mutation that makes it fail is enough, and makes the claim
auditable later.

---

## 8. What is not a test: the visual diff report

The author's question was partly about his own time — *"testing all these as a human clicking
around on maps will be time consuming and unlikely to pull out all problems"*. None of the above
answers that directly. This does.

`npm run qa:diff` renders every corpus map, in both arrangements, at a fixed size, on `main` and
on the branch, and prints **which maps changed and by how much**. Not a gate; not a baseline to
approve. A reading list, so that the clicking-around is aimed at the four maps a change actually
touched instead of spread thinly over eleven.

**[judgement] Explicitly not a pass/fail visual regression gate.** Screenshot gates on a
force-directed map with real fonts will produce false failures on every machine that is not the one
that recorded them, and the cost of that is the whole team learning to ignore a red build.

---

## 9. Two smaller things, both cheap

**A dead-field lint at the graph → renderer boundary.** `n.full` was read three times and written
never, from the first commit of the repository, and looked alive for as long as something stood
behind it in an `||`. One script comparing the keys `toGraph` emits against the keys the renderer
reads would have found it in a second, and would find the next one. Measured cost of not having
it: seven claims lost their hover text for a day.

**The CI's known-failure allowance may be stale.** `.github/workflows/tests.yml` and
`KNOWN-ISSUES.md` both describe one suite that is expected to fail; the suite now reports
`everything passed` locally [measured]. Either the failure is fixed and two files should say so, or
it needs the private corpus to appear and that should be written down. An expectation that has
quietly become untrue is the same species of bug as `n.full`.

---

## 10. The order, and what it costs

| | build | catches (of 18) | cost |
|---|---|---|---|
| 1 | rendered invariants | 6 | one dependency, ~60–90s CI [judgement] |
| 2 | export artifact checks | 5 | no new dependency; `rsvg-convert` in CI |
| 3 | the dead-field lint | 1, and the class | an afternoon |
| 4 | real gestures | 4 | slow, brittle, keep small |
| 5 | mutation as a merge rule | 1, and every future instrument | a note per test |
| 6 | the visual diff report | 0 — it saves time, it does not find bugs | a script and a baseline render |

**[judgement] Items 1 and 2 together would have caught eleven of the eighteen**, including six of
the eight the author had to find himself. That is the case for doing them first and letting the
rest follow the evidence.

One honest caveat on all of it: this table is a counterfactual. Each "caught by" is a judgement
about a test that does not exist yet, made by the person who wrote the defect. The way to hold it
accountable is item 5 — build the instrument, then reintroduce the defect and watch it fail.
