# Holding the map still: a plan for eliminating node crossings

*Written 29 August 2026, the day a reader watched a claim glide across the whole map on one
fold click — and the day measurement showed that this was not an incident but the normal
behaviour of the renderer. Companion to `docs/FOLDING.md`, which owns what is drawn; this owns
where it is drawn, and above all where it is drawn NEXT.*

## The problem, measured

A fold badge is a local request: one thing more, one thing less. The claims that stay on screen
should hold still enough that the reader's mental map survives the click. They do not:

| map | side-cross per click | median worst move | worst single jump |
|---|---|---|---|
| akhlaghi | 0.26 | 0.18 | **5.57× the map's width** |
| carroll | 0.14 | 0.23 | 1.26 |
| darwin | **0.93** | **0.66** | 1.98 |
| miller | 0.39 | 0.28 | 1.18 |
| prescott-couch | 0.30 | 0.16 | 1.37 |
| tooming | 0.49 | 0.32 | 1.29 |
| wilson | 0.26 | 0.11 | 1.01 |

(`node app/map_quality.mjs`, the `@ transitions` rows: a seeded walk of each map, scoring only
`toggleNode`/`toggleGroup` clicks, movement in fractions of the picture's own width.) Corpus-wide,
**almost half of all picture-changing local clicks send at least one surviving claim across the
midline.** Two maps also move claims on clicks that change no node at all (`quietMove` 0.23–0.24
— the edge set changed under them). The renderer glides nodes between layouts so that motion
reads as continuity; the animation was built on the assumption that moves are small, and until
today nothing measured whether they are.

Two facts that scope the project:

- **This is not the fold logic's doing.** The same walk on the engine before and after the
  28–29 Aug fold fixes produces bit-identical crossing rates. Layout consumes `filterGraph`
  output and writes nothing back; the instability lives entirely downstream of the fold code.
- **This is dagre's global re-answer, not the seating pass.** With `seatInDocumentOrder`
  disabled the jumps are the same scale. dagre recomputes its crossing-minimisation order from
  scratch for every node set; a one-node change can flip the global order, and the seating pass
  only restores document order *within bands whose membership just changed*.

## What done means

All numbers from the committed `@ transitions` baseline, on every published map:

1. `sideCross` = **0.00** — no surviving claim crosses the midline on a local click;
2. `move~` ≤ 0.05 and `moveMax` ≤ 0.25 — the map may breathe, not teleport;
3. `quietMove` ≤ 0.05 — a click that changes nothing visible moves nothing visible;
4. **no fold regression**: the invariants suite at the committed defaults and seeds 1–8, both
   exhaustive modes, and the fixture suites all stay green, untouched;
5. within-picture quality (`edgeX`, `cross@node`, `cross@out`, bends, detour) stays inside its
   baseline slack — or the trade is written down per row and re-baselined deliberately, the way
   `DEPARTURE_BOW_ALLOWANCE` was decided.

Anything that meets 1–3 by breaking 5 badly has just moved the incoherence from time into
space, and the table decides, not the principle.

## Phase 1 — attribute the movement — DONE 29 Aug 2026

Every crossing claim in the walk (300 steps × seeds 1–3 × seven maps, 13,490 crossings
attributed), tagged with its cause. Rank identity is measured as distance from the apex row, so
a rank inserted elsewhere — which shifts every y wholesale — does not read as everything
re-ranking:

- **rank change** — the claim's row genuinely moved relative to the contention;
- **order flip** — same surviving row-mates, their left-to-right order changed;
- **recomposition, order changed** — row-mates changed and the order among survivors changed;
- **slot drift** — order among survivors fully preserved; the positions slid under it.

| map | crossings | rank change | order flip | recomp+order | slot drift |
|---|---|---|---|---|---|
| akhlaghi | 842 | 35% | 12% | 19% | 34% |
| carroll | 310 | 54% | 3% | 2% | 41% |
| darwin | 432 | 22% | **0%** | **0%** | **78%** |
| miller | 2,386 | 27% | 23% | 24% | 26% |
| prescott-couch | 3,931 | 11% | **36%** | **44%** | 9% |
| tooming | 2,811 | 26% | 25% | 27% | 22% |
| wilson | 2,778 | 27% | 23% | 17% | 33% |
| **corpus** | **13,490** | **23%** | **25%** | **27%** | **24%** |

**Three findings, and the second reshapes 2b.**

1. **No single cause dominates — the corpus splits almost evenly four ways**, and the per-map
   texture is wild: Darwin crosses with *zero* order flips (78% slot drift — order stays put,
   positions slide), Prescott-Couch is 80% order-related. A fix must handle both regimes.
2. **Order stability is not enough.** Slot drift — a quarter of all crossings, three-quarters
   on Darwin — is movement with the left-to-right order *fully preserved*. So 2b as first
   drafted (canonical order, left-packed) would still cross claims whenever left-neighbours
   fold away and everything slides over. **2b must assign home columns, not packed order**: a
   claim's x derives from its canonical index over the whole map, so its column survives any
   subset. That also tames the horizontal component of rank changes (23%) — a re-ranked claim
   keeps its column and moves only vertically, which is the legitimate part of the move.
3. **2a's ceiling is about half** — order flips (25%) plus the order half of recomposition
   (≤27%). Worth its day: it halves the problem for two files of code. It cannot reach the
   target alone, so it is a waypoint, not a candidate endpoint.

Gate passed: proceed to Phase 2, 2a first, with 2b specified as home columns.

## Phase 2 — the canonical order (the core of the project)

**Principle: a filtered view's left-to-right order must be a projection of one fixed order, not
a fresh global optimisation.** The file already defines that order — document order, the same
total order `seatInDocumentOrder` believes in, hierarchical by construction (sections are
contiguous stretches of it). A claim's horizontal *neighbourhood* is then a property of the map,
and folding can only remove neighbours, never reshuffle them.

Two implementations, tried in this sequence:

**2a. Order-constrained seating — DONE 29 Aug 2026, and the diagnosis moved under it.** The
plan guessed the pass needed wider jurisdiction; instrumenting it (an optional `stats` argument)
showed jurisdiction was already universal — zero blocks lacked an order key, zero ties fell to
dagre's x. The instability lived in three places nobody had measured:

1. **The overlap veto.** A chained band is not one row: banding chains blocks by *vertical*
   overlap, so a band can hold members that never share a row — dagre stacked them — and its
   slot gaps can then be *negative*. Re-packing across a negative gap collided, the veto fired
   on 7% of bands that needed moving, and each vetoed band kept dagre's per-state order. Those
   bands accounted for roughly **three-quarters of all crossing claims** (measured by forcing
   seats through: 4,769 → 1,211 crossings on the 100-step walk).
2. **Any two-path packing.** Retrying vetoed bands with a second packing bought *nothing*
   (4,769 → 4,853): which branch ran depended on the state, and a band that flips between two
   geometries is the same instability in new clothes. **Stability is single-path or it is
   nothing** — the sharpest lesson of the phase.
3. **Span shortage.** Document order can need more width than dagre's crossing-minimal
   arrangement had; with one packing and a span clamp, 1,483 bands stayed unfit.

The shipped pass: one packing for every band — blocks left-to-right in document order, each at
the leftmost x clear of everything it shares height with (vertically disjoint blocks stack, as
dagre stacked them), anchored at the band's left edge, gap read from the layout's own nodesep.
Top-level bands may grow rightward (nothing out there but margin); inner bands may tighten
their gap to a floor of 10 before giving up. Unfit bands — the only remaining dagre-order
fallback — fell from 1,483 to **308 of ~71,000** on the 300-step walk.

**Measured, claims crossing on the attribution walk (300 steps × seeds 1–3):**

| | before 2a | after 2a |
|---|---|---|
| crossing claims | 13,490 | **5,325 (−61%)** |
| order flip share | 25% | **2%** |
| recomposition + order | 27% | 10% |
| slot drift + rank change | 47% | 88% of what remains |

Per action (`@ transitions` rows): `sideCross` wilson 0.26 → **0.06**, tooming 0.49 → 0.36,
prescott 0.30 → 0.23, akhlaghi 0.26 → 0.19; `move~` tooming 0.32 → **0.08**. Carroll, Miller
and Darwin barely move per action — their crossings were never order flips, which is exactly
what Phase 1's table said and why 2b exists.

**The price, written down (criterion 5).** 25 static rows worsened, 11 improved. The notable
costs: `prescott @ reasons` edge crossings 0 → 30, `@ detail` 26 → 60, `@ all` 99 → 143;
`tooming @ all` 109 → 177; `darwin @ all/folded` detour 1.1× → 2.2× and overshoot 0 → 123;
`bendWorst` up to 439 on `akhlaghi @ all`; akhlaghi's worst single jump 5.57 → 6.53. Alongside:
`prescott @ detail` bendWorst 236 → **61** and `@ all` 496 → 344, `wilson @ folded` 144 → 74,
`carroll @ all` crossings 40 → 35. The 2.2× darwin detour is past the 2.0× the bow-allowance
decision refused — recorded, not hidden; the difference is that this price buys reading-order
coherence on every map rather than one row's crossing, and that every one of these rows is a
*relic route*: dagre's polylines sheared around an arrangement they were not drawn for. 2b
re-routes for the canonical arrangement and re-opens each of these numbers. The baseline is
re-recorded with this table as the deliberate record; the rows stand to be re-judged at the 2b
gate, and reverting is one commit if the interim price reads too high.

**2b. Home columns, dagre demoted to ranking — BUILT 29 Aug 2026, behind `stableOrder`,
default off pending the flip decision.** `assignHomeColumns` in the renderer, exported beside
the seating pass and selected by `stableOrder` in `DEFAULTS`: one recursive packing over the
section tree in canonical order — the seating's own `[section ordinal, source line]` key, ties
broken by build order — with a per-row cursor inside each container. A claim occupies its rank
row; a section occupies every row between its first and its last, so nothing that is not a
member can be dealt an x inside its box; section boxes are rebuilt as the member hull plus a
pad, because the box now follows the members. dagre keeps ranks, heights and routes; the routes
are dragged along by the same shared shear-and-repair the seating uses
(`settleEdgesAfterShift`). No unfit bands, no overlap veto, no fallback — the 2a lesson
(single-path or nothing) applied wholesale. `map_quality.mjs --stable` measures it with the
same instrument against the same baseline.

**Measured, attribution walk (300 steps × seeds 1–3):**

| | before 2a | after 2a | 2b (`--stable`) |
|---|---|---|---|
| crossing claims | 13,490 | 5,325 | **2,512 (−81%)** |
| order flips | 25% | 2% | **0 — zero, in 292,252 assignments** |
| recomposition + order | 27% | 10% | **0** |
| residual | — | drift 63% / rank 25% | drift 72% / rank 28% |

Per action, 2b vs the 2a baseline: `sideCross` tooming 0.36 → **0.13**, prescott 0.23 →
**0.11**, darwin 0.91 → **0.56**, carroll 0.14 → 0.06, miller 0.37 → 0.29, akhlaghi 0.19 →
0.15, wilson 0.06 → 0.09; `move~` at or under 0.14 on six of seven maps (darwin 0.46).
`nodeOverlaps` 0 on all 42 rows. The residual crossings are compression drift — order intact,
positions sliding as a claim's neighbourhood folds away — and genuine re-ranking; neither can
invert reading order any more, by construction.

**The static price of 2b, against the 2a baseline: 27 rows worse, 25 better.** The better side
undoes 2a's worst damage — `darwin @ all/folded` detour 2.2× → **1.2×**, overshoot 123 → 47.
The worse side concentrates on the **opening (`folded`) views**: `wilson @ folded` bendWorst
74 → 179 and overshoot 0 → 122, `tooming @ folded` similar, `prescott @ folded` crossings
2 → 11 — all of them dagre's relic routes sheared across a block arrangement they were not
drawn for, now at the one level every reader sees first. Rendered and looked at: boxes clean,
no pathology, but the routes are the remaining debt — which the routing pass below then paid.

**The routing pass — 29 Aug 2026.** Under `stableOrder`, every edge is now drawn *for* the
home-column arrangement instead of sheared from dagre's (`routeForHomeColumns`): endpoints
follow their own boxes, interior points keep dagre's y — every point stays on its rank — and
take the straight run's x; where the straight run passes through a claim's box, the waypoints
inside that box's rows step to its nearer side, two passes. `straightenDetours` deliberately
does not run on these edges — it would clamp the detours drawn on purpose back into the boxes
they avoid. Measured against the 2a baseline: 48 rows better (`akhlaghi @ all` bendWorst 439 →
153, `@ detail` overshoot 148 → **0**), 23 rows worse, still concentrated on the folded views —
and rendered, those read as the honest cost of canonical placement: through-traffic genuinely
weaving around wide blocks, shallow fan-out intersections in open channel, no pathology. That
residue is the price of the document deciding placement instead of the traffic.

**Flipped 29 Aug 2026, the author's call.** `stableOrder: true` in `DEFAULTS`; `map_quality`
measures the shipped default and `--classic` keeps dagre's arrangement measurable beside it;
the baseline re-recorded on the default, the full suite green, and the fold sweep clean at
seeds 1–8. Reading order can no longer invert on any fold click, anywhere, by construction.

**2c. ELK, the sanctioned fallback.** ELK's layered mode has what dagre lacks — order
constraints and an interactive mode that takes previous positions as input — and it costs a
WASM-class dependency where `docs/NOTES.md` chose 49 KB of dagre over 2.1 MB of map-views. The
author's call, 29 Aug 2026: **the display is mission-critical, so if 2b proves difficult or
infeasible, the larger file is preferable to living with the movement.** So ELK is not off the
table; it is sequenced last because 2a and 2b are days where an engine swap is weeks, not
because the size rules it out. If 2b fails its trade table, prototype ELK behind the same
`stableOrder` flag and put it through the identical gates before any default flips.

## Phase 3 — the by-position view

Its lanes already pin claims to stretches of the text, which is most of a canonical order
already. Extend the transitions walk to `byText` first (one flag in `measureTransitions`),
measure, and fix residuals with the same principle. Expected to be mostly clean; do not assume
it.

## Phase 4 — perceived stability, independent of layout — DONE 29 Aug 2026

Two renderer-only moves, and the first turned into a bug hunt that paid for the whole phase.

**Anchor the click.** The machinery already existed — `holdStill`/`applyPin` record the clicked
control's screen point and pan the camera so the next render puts it back, and every pointer
fold path already called it. **It had never been running in the single-map builds.** Verified
end to end in the built Wilson viewer: every fold click re-framed the whole map, the exact
hunt-for-your-badge the pin exists to prevent. Instrumenting `holdStill` found the cause in one
click: it read `svg.getBoundingClientRect()` for its is-this-control-on-screen guard, an SVG
root can report a **zero-width rect while its children draw perfectly well** — this build does —
and a degenerate rect vetoed every pin ever requested. The fix measures against the *container*
(the pane the reader actually sees), uses the same origin in `controlPoint`, and lets a
degenerate rect skip the guard rather than the pin. Re-verified: expanding a claim now holds its
badge at the same screen x to the pixel and within 8px vertically (the clicked box's own height
change), against 184px hunts before. Verification is a phase and not a hope; this is why.

**Motion that reads as motion.** The styles already routed every glide — nodes, boxes, edge
fades — through one `--alm-dur` custom property. The renderer now sets it per render, scaled by
the largest move that render will make (base 350ms, up to 2× for slides past 500 units), and
the camera glide and removal timers run on the same clock. **One clock, deliberately: per-node
durations were considered and rejected, because a flank that slides in formation must land in
formation.** Verified live: a big reveal runs at 626ms, a small one at 350ms.

**And the metric now measures what the anchored reader can feel.** `sideCross` compared claims
against the map's midline — right when claims could swap sides of each other, wrong once order
became invariant, because folding a wide section moves the midline itself past claims holding
perfect formation. The `@ transitions` rows now measure every claim's offset **relative to the
clicked control** (`anchorCross`), looked up under both of a section's drawn identities exactly
as the renderer's own hold does. Re-measured and re-baselined: wilson **0.00**, prescott 0.03,
tooming 0.05, akhlaghi 0.13, `move~` at or under 0.10 everywhere but Darwin — whose honest 0.58
is large-fraction compression on a 23-claim map, where folding any block moves neighbours by
half the map toward the anchor: coherent closing motion, big only because the map is small.

## Fold integrity, structurally

The clause "without deleterious effects on the folding code" is enforced by architecture before
it is enforced by tests: **no layout code reads or writes fold state** — `filterGraph` decides
*what*, layout decides *where*, and the one place geometry feeds back (`frameFor`, framing the
apex) reads positions only. Keep that rule; any Phase 2 change that wants fold-state input is
wrong by construction. The test gates are then the ordinary ones — the full suite, the fold
invariants at seeds 1–8 with the resurrected badge check, both exhaustive modes — run before
any flag flips, plus the transitions baseline, which may only move toward zero.

## Compression drift, understood — 29 Aug 2026

What remains after the flip and the ranker deserved a name and a judgement, and it got both.
The layout's guarantee is document order packed compactly, so a claim's x is determined by what
stands to its left and how wide it is. Fold something, and the packing closes over it:
measured on Wilson, folding section s3 (a 1,494-wide box) from the open view slides **all 115
surviving claims to its right left by exactly 1,516 units each — min, median and max identical
— with zero order inversions among the 132 survivors.** That is the whole phenomenon: a rigid,
uniform slide of one flank, closing over the folded material. It is *informative* motion — the
map visibly closes around the removed thing, everything moves in formation, nothing passes
anything — where dagre's reshuffles moved claims through each other in opposing directions.

Two consequences. First, part of the residual metric was measuring the **landmark, not the
claims**: `sideCross` compared positions against the map's midline, and folding s3 moves the
midline itself by 758 — a claim holding perfect formation gets counted as "crossing" because
the midline ran past *it*. Darwin's stubborn 0.56 was mostly this: on a 23-claim map, any
folded block is a large fraction of total width. Second, "eliminate the drift in graph
coordinates" is the wrong target: with no compression, folded views go sparse, the viewer
zooms to fit, and everything moves on screen anyway — **screen-space stability is governed by
the camera, not the layout**, which is why Phase 4 exists and why the metric should measure
what a reader anchored to the click would feel. The one residue not defended by any of this:
a click that changes no visible claim but changes the edge set can re-rank a claim and move
its row (`quietMove` 0.34 on Carroll) — a real jump-cut, one map, with a known future shape
(canonical ranks from the full map, compressed per view — the vertical twin of home columns)
if it ever grows.

Decided: live with the drift at the layout level; anchor the camera (Phase 4); re-aim the
metric at anchor-relative movement so the open target measures the reader's experience.

## The engine question: dagre, ELK, or neither — 29 Aug 2026

Raised by the author after the flip: the project's philosophy is to build on well-maintained,
leading tools (pandoc, CodeMirror, markdown-it), dagre was chosen before layout was understood
well enough to know it mattered, and dagre is by now minimally maintained — one active
maintainer, more than a year since the last release. ELK (Eclipse Layout Kernel) is the
maintained leader: Eclipse-governed, stewarded by the Kiel research group that publishes on it,
with Mermaid shipping an official `@mermaid-js/layout-elk`. So: what would a transition cost,
and what would it buy?

**What dagre still does here, after this project.** The list shrank all year and collapsed
today. Under `stableOrder`, dagre no longer decides horizontal order (canonical), positions
(home columns), section boxes (member hulls), or routes (`routeForHomeColumns` plus the
geometry pipeline). What remains: **ranks, rank heights, and the y of edge waypoints** — one
ranking pass. The 36 KB of dagre in the bundle is being used as a ranker.

**What ELK would buy.** Governance and maintenance; first-class compound layout (dagre's
clusters are its most fragile corner — the renderer catches its "Not possible to find
intersection" crash and falls back); `considerModelOrder`, which is document order as a native
constraint — our canonical order upstreamed rather than bolted on; port constraints that could
subsume the departure/arrival seating machinery; real routing options (orthogonal, splines);
a web-worker story for very large maps. One caution on its famous feature: ELK's *interactive*
mode stabilises against the previous layout, which is heuristic continuity — a weaker property
than ours. Two readers reaching the same fold state along different paths could see different
pictures, which breaks the promise the fold state identifier makes (equal states, equal
screens). Stability-by-construction stays bespoke under any engine.

**What ELK would cost.** Size: elkjs bundles at roughly 1.4 MB minified against dagre's 36 KB —
though the honest denominator is the editor's current 2.6 MB single file (the Reader 2.25 MB),
so the file grows by half, not by thirty times. An async, promise-based API where the renderer
lays out synchronously in the render path — a refactor of `createLiveMap` and every fixture
that drives it. A GWT-transpiled artifact whose internals cannot be read the way this project
has repeatedly needed to read dagre's. And the full instrument migration: baselines re-cut,
adversarial fixtures re-tuned, and the transition metric re-proven from scratch, because
`considerModelOrder` under subset changes is a behaviour to measure, not a guarantee — if it
falls short, home columns run on top of ELK anyway, and the bundle carries a crossing
minimiser and router the project deliberately overrides. Estimated at one and a half to two and
a half weeks with the metric suite as the safety net (adapter 2–3 days, async refactor 1–2,
geometry adaptation 1–2, baselines and fixtures 1–2, stability re-proof 1).

**Recommendation, three horizons.**

1. **Now: nothing.** dagre-as-ranker plus home columns is small, measured, and gated; ranking
   is stable thirty-year-old math with no security surface, and the vendored 36 KB is not a
   live risk the way an unmaintained parser would be.
2. **Next natural step — own the ranker, drop dagre entirely. DONE, 29 Aug 2026, the author's
   call.** `layoutByArgument` in the renderer: longest-path ranks (a premise strictly below
   every claim it supports, cycles broken rather than hung), rank rows with headroom where
   section boxes open, boxes as member hulls, then the home columns and the router as before —
   the same return shape `layoutByText` already used, which is all the pipeline ever read.
   dagre is gone from the source, the bundle, the vendor directory and `package.json`; the
   whole drawing pipeline is readable end to end, and the seating pass, the shear, and the
   dagre fallback chain retired with it. **The gate table came back better, not merely inside
   slack: 47 rows improved against the dagre-ranked baseline, 8 worsened**, worst bends roughly
   halved corpus-wide, transitions improved again (`move~` at or under 0.10 on six of seven
   maps) — and `cross@out` on `wilson @ detail` reads **0**: the accepted departure crossing
   lived in dagre's arrangement and retired with it (KNOWN-ISSUES records the closure as a
   change of ground, not a repair). This serves the maintained-tools philosophy better than the
   big engine would, because the philosophy applies where a tool owns a job (pandoc owns
   conversion; CodeMirror owns editing) — and layout is no longer an outsourced job: the
   *document* decides placement, and the instruments guard it.
3. **The ELK trigger.** Adopt ELK when requirements grow to engine-class features that bespoke
   code should not chase: orthogonal routing as a product feature, ports as first-class UI,
   maps large enough to need worker-side layout, or a layered layout for the by-position view.
   The trade was pre-approved in spirit by the author's size ruling; what it waits on is a
   feature that earns it, not permission.

## Order of work

1. Phase 1 attribution table (de-risks everything after).
2. Phase 2a, measured; keep whatever it buys.
3. Phase 2b behind the flag; corpus trade table (transitions vs static quality, per map);
   decision recorded in this file the way the bow allowance was.
4. Flip the default if the table says so; seed sweep; re-baseline both metric families
   deliberately.
5. Phase 3, then Phase 4.

The first three steps are self-contained and reversible; nothing before step 4 changes what any
reader sees.
