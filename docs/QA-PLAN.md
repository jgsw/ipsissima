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
| 19 R | the exported picture cut off down its right-hand edge: a classic scrollbar took fifteen pixels out of the column *after* the layout had measured it, and the canvas was sized from that column | artifacts (added 2 Sep — see below) |
| 20 | the export test had begun picking the *smallest* panel on the map, having sorted the ⊞ controls by `textContent` length: a one-step control's tooltip is longer than a four-step one's | — |

Counting by instrument: **invariants 6, artifacts 6, gestures 4, mutation 1, unit 1, two
unclassified** [measured, by the author of the table — the counterfactual is a judgement in each
case].

**Defect 19 is the same lesson as 3, 4, 10 and 11 — a number computed against the wrong
rectangle — and it got through the artifacts instrument because that instrument was reading the
file rather than looking at it.** Every check there asked what the SVG *said*: does it parse, are
its colours legal, does it carry the panel's words. None asked whether the drawing fitted on its
canvas, so a file that was correct in every particular and sliced down one edge passed cleanly.
The check added for it renders the file and measures the ink's distance from each edge, which is
a question about the picture rather than about the text of it. **Defect 20 is the cost of a
selector that encoded an assumption about lengths**: it turned green while testing something
smaller than it was meant to.

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

## 4. Instrument A — invariants over the rendered map — **BUILT 1 Sep 2026**

`app/test_rendered_dom.mjs`, registered in the runner and in CI. A headless browser opens a built
viewer, drives it into a state, and asserts against what is actually on the page.

**As measured on the day it was built:** 7 maps, 8 explode panels, both colour schemes, 80 checks
in **54.6s**, of which 9.0s is building the viewers fresh so the renderer under test is the working
tree's [measured]. Playwright is a devDependency (Apache-2.0 [reported]); its Chromium is 554MB of
cache [measured] and is never shipped.

**Since 2 Sep: 24 panels and 156 checks in 104.5s [measured].** Nothing was added to the harness;
giving one-step arguments a ⊞ control tripled the number of panels it has to open, and two maps in
the corpus — Carroll and Prescott-Couch — went from having no explode panel to test at all to
having one. An instrument's reach grows with the feature it happens to be pointed at.

**It found a real defect on its first full run over the corpus.** `.alm-e` — an edge — carried no
`pointer-events: none`, so wherever an edge crossed a section's 22px fold strip the click landed
on the line and the section did not fold. Reported on Prescott-Couch and Tooming, in both colour
schemes, at the exact centre of the strip. Fixed by scoping `pointer-events: none` to the edge and
not to the edge layer, which also holds the join bars and verdict badges — those are controls.

**And it produced six false positives before it found that one**, all from the same invariant:
controls sitting under the map's own fixed chrome, which is by design and not a fault. Scoping the
check to the map itself is the difference between an instrument and a thing everyone learns to
ignore. **[judgement] Expect this of every new invariant; budget for the calibration.**

**Three states per map, and NOT the fold state space** — the opening view, sections open, and
claims full, each of them something a reader does with the bar. Walking the fold space is
`test_fold_invariants.mjs`'s job and it does it far more cheaply without a browser; what is wanted
here is a few real pictures, painted. **[judgement]**

`encodeFoldState` / `decodeFoldState` are exported and could drive this from the seeded walk, so
a deeper state space is available cheaply if a defect ever escapes into one. Not built, because
nothing yet says it is needed.

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

Of the nine listed, six are built. Not yet built: the section-name legibility check, the
contention-on-screen check in rendered coordinates, and the overlap check is present but has only
ever been exercised by its own mutation — no real map has yet overlapped.

---

### Run it against a corpus that is not the good one — 1 Sep 2026

`--corpus DIR` points the harness at any tree of `.argdown` files. **[judgement] Do this before
believing a green run means much.** The seven public samples are careful maps made by one person
to one house style, and they are not a sample of what people write.

Pointed at the private corpus — thirteen maps including Argdown's own demo files, two newspaper
columns and a book-length reconstruction — it produced **78 failures, and every one was a fault
in the invariant.** The hover check compared only the first forty characters of a tooltip block
against the box; a clipped claim's tooltip carries the FULL sentence while the box draws a PREFIX
of it, so the openings match and the extension reads as a repeat.

**The public corpus could not have found this**, and the reason is worth keeping: every one of
those seven maps carries `fidelity` or `source`, which puts a second block in the tooltip and
makes the check pass — for the wrong reason. A corpus of careful maps hides the defects that only
careless ones provoke. Fixed to compare whole blocks; the private corpus then ran clean at 13
maps, 129 checks, 85s [measured].

**And it found a real one the public corpus does not contain.** In `welcome to argdown` a box is
drawn on the map titled `Untitled 2` — the Argdown parser's placeholder for a statement written
without a name, standing where a heading the author chose should be. The same defect was reported
independently in the compact panel and fixed there; on the map it is unfixed, because changing a
node's drawn title touches layout, claim search and how references resolve.

### The facet filter, which had no coverage at all — 1 Sep 2026

The fold invariants pass `facets: null` throughout, so the hashtag filter — and the empty-map
state it can reach — was never exercised by anything. That is how the `untagged` switch came to be
built on top of a latent fault in `render`, which returned before `syncToolbar` when nothing
passed and left the bar lit over a blank map.

The harness now drives the filter. **Asserted as a CHANGE rather than as a property of one
picture**, and the reason is worth keeping: the obvious form — *with untagged off, everything
drawn carries a hashtag* — cannot be written honestly, because the contention stays on screen
deliberately and the DOM cannot say which box is the contention (nodes carry `data-id`; edges
carry no identity at all). A first attempt guessed *at most one untagged box survives* and failed
on Akhlaghi, which has two contentions.

What is exact, and holds on any map without a threshold: switching the tag off must remove
something, everything it removes must be untagged, no untagged claim may appear, and something
must still be drawn.

**Two of my own assertions were wrong before the code was.** The check first ran in whatever state
the map was left in, which differs between the colour passes because the self-test reloads — so it
compared folded blocks in one and open claims in the other and disagreed with itself. And it
forbade claims from *appearing*, which they do and should: removing the untagged claims shortens
chains and unstrands components, so the walk surfaces tagged claims that were buried below the
depth limit — nine of them on Akhlaghi. That is the control doing exactly what it is for.

Proved against the real defect rather than a synthetic one: replacing the `S.untagged` term in
`facetOk` with `true` — the bug the control exists to fix — fails this on every map that uses
hashtags, in both schemes [measured].

### The mutation self-test, which is part of the instrument

**[judgement] The most valuable thing built here, and the least expected.** Rather than mutate by
hand once and write "mutation-tested" in a comment, `--selftest` injects each defect into a real
page and requires the matching invariant to report it. It runs on every invocation and prints
`N invariants proved able to fail` beside the check count.

It has already caught three faults **in itself**, which is three more than the invariants have
caught in the renderer:

- the overlap mutation moved nothing. Appending a second `translate` to an `.alm-n` changes the
  style string and does not move the box, so the harness reported the invariant as broken when the
  MUTATION was broken. A clone in the same place needs no arithmetic and cannot lie.
- the panel-scroll mutation was too weak: +300px does not overflow the compact layout, whose boxes
  are half the panel each. It now measures off the wrap.
- the first version silently ran **two of seven** mutations, because it restored the page by
  reloading and most mutations then had nothing to break. That is exactly the failure mode the
  self-test exists to prevent, hiding inside the self-test. The printed count is what exposed it.

Undoing in place rather than reloading took the self-test from **310 of the suite's 330 seconds to
under one** [measured].

## 5. Instrument B — real gestures — **one check built**

A deliberately small, deliberately slow tier: a real pointer and a real keyboard, driven through
the browser, for the handful of interactions where synthesis is known to lie.

- **built:** a real `mouse.click` on a section's header strip folds it. This is the gesture that
  has broken twice, and it is what proves the `pointer-events` fix above with a real press and
  release rather than with `elementFromPoint`, which only asks what the pointer *would* hit
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

## 6. Instrument C — the export as a checked artifact — **BUILT 1 Sep 2026**

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
- **a look at the picture, not the text of it** — the file is rendered and the ink's distance from
  each of the four edges measured. Added 2 September for defect 19, which every check above passed
  cleanly: the SVG was well-formed, legally painted and said exactly what the panel said, and was
  sliced down its right-hand edge. The background rect is stripped and the alpha channel measured,
  so this reads the same in either colour scheme. The condition that produced 19 — a scrollbar
  claiming the column *after* the layout measured it — is staged in the browser rather than waited
  for, since headless Chromium draws overlay scrollbars and will not do it on request.

The round-trip is the important one. **[judgement]** It is cheap, it needs no baseline, and it
states the actual contract of an export: *the same words, no more and no fewer.*

`app/test_export_artifacts.mjs`, registered in the runner and in CI, with `librsvg2-bin` added to
the CI image. **31 checks**, six of them mutations, on both panel layouts, the one-step layout,
the staged narrowing and the PNG [measured, 2 Sep].

**The organising idea, which is worth stating separately from the checks:** *the engine that wrote
the file is the wrong engine to check it with.* Three of the four export defects were invisible in
the browser that produced them — the malformed XML rendered perfectly under `innerHTML`, and the
`rgba()` fills render perfectly in every browser there is. So the file is read back through a
strict XML parse, and through **librsvg in another process** — an independent implementation of
the kind of renderer the file will actually meet.

The round-trip needed one calibration, the same species as instrument A's six: stripping tags and
comparing raw left `General&apos;s` against `General's`, so the check reported the export as both
writing a word too often and failing to write it. Entities are the file's spelling of a character,
not a different word. **[judgement] Two instruments, two rounds of false positives before either
found anything — that ratio is the honest cost of a new invariant and should be planned for.**

Not built from this section: the ink-coverage baseline. librsvg either renders the file or does
not, and "does not" has been the only failure mode so far; a size-and-coverage baseline can wait
until something renders successfully but wrongly.

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

## 8. What is not a test: the visual diff report — **BUILT 1 Sep 2026**

The author's question was partly about his own time — *"testing all these as a human clicking
around on maps will be time consuming and unlikely to pull out all problems"*. None of the above
answers that directly. This does.

`npm run qa:diff` renders every corpus map on `main` and on the branch and prints **which maps
changed and by how much**. Not a gate; not a baseline to approve. A reading list, so that the
clicking-around is aimed at the four maps a change actually touched instead of spread thinly over
eleven. The comparison ref goes into a git WORKTREE, so nothing in the working copy is touched and
it is safe to run with edits in progress; the pixels are counted in a canvas, so there is no image
dependency.

**It found its own worst flaw on the first run.** Photographing only the opening view reported
**0.00% across twelve commits of real renderer work** — rule names, verdict marks and everything
inside a section are simply not on screen when the sections are folded. A tool that says nothing
changed about a fortnight of changes is worse than no tool, because it tells the reader not to
look. It now shoots two states per map and reports the worse of them, naming which.

Verified against `4077a1d~1`, the commit that set section names larger: 7 of 7 maps changed,
attributed to the OPEN state for six of them, and Darwin — which has no sections at all — moved
least and not in that state [measured]. That internal consistency is the evidence the numbers
mean something.

**[judgement] Explicitly not a pass/fail visual regression gate.** Screenshot gates on a
force-directed map with real fonts will produce false failures on every machine that is not the one
that recorded them, and the cost of that is the whole team learning to ignore a red build.

---

## 9. Two smaller things, both cheap

**A dead-field lint at the graph → renderer boundary — BUILT 1 Sep 2026.**
`app/test_dead_fields.mjs`, in the runner. One side measured (`toGraph` run over the corpus, its
actual keys collected), the other read out of the projection where a graph node becomes a drawn
one. **And it catches the real thing:** `n.full` put back into the projection is reported as
`read but never written: full` — the first counterfactual in this document demonstrated against
an actual historical defect rather than a synthetic mutation.

It needed the same calibration as the other two. Its first run reported `comment` and `pos` as
dead, and both are alive: `comment` is optional and no corpus map carries one, and `pos` is
written by a LATER STAGE, `build_argdown_viewer.mjs`, after `toGraph` has returned. So the rule
is not "does this corpus show it" but "does anything write it" — measured keys, or an assignment
anywhere in `app/`. **Three instruments, three rounds of false positives.**

The original argument, for the record: `n.full` was read three times and written
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
| 1 | rendered invariants | 6 | **built** — Playwright, 54.6s [measured] |
| 2 | export artifact checks | 5 | **built** — `librsvg2-bin` in CI |
| 3 | the dead-field lint | 1, and the class | **built** — catches the real `n.full` |
| 4 | real gestures | 4 | slow, brittle, keep small |
| 5 | mutation as a merge rule | 1, and every future instrument | a note per test |
| 6 | the visual diff report | 0 — it saves time, it does not find bugs | **built** — `npm run qa:diff` |

**[judgement] Items 1 and 2 together would have caught eleven of the eighteen**, including six of
the eight the author had to find himself. That is the case for doing them first and letting the
rest follow the evidence.

One honest caveat on all of it: this table is a counterfactual. Each "caught by" is a judgement
about a test that does not exist yet, made by the person who wrote the defect. The way to hold it
accountable is item 5 — build the instrument, then reintroduce the defect and watch it fail.
