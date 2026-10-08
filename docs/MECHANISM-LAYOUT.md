# How the Mechanism chart is laid out: the rules, and how they are held

The Reasons map became stable when its layout had written rules with a measure for each
(docs/STABILITY-PLAN.md, `app/map_quality.mjs`). The Mechanism chart had none, and it showed:
James's review of 30 Sep 2026 found badges on the lane headings (the Coleman boat in general),
labels on labels and on badges, the two inputs of an AND gate crossing on their way in (Reason's
high-reliability organizations), a cut-off AND gate in the key, and oversized arrowheads that
arrive at an angle (the law school rankings). They had one cause: **the layout placed the boxes
and the labels, and the badges, pills, gap words, gates and headings were added afterwards by
the drawing, so nothing could keep clear of them.**

## The rules

Each rule has an identifier, a measure, and a kind. A **hard** rule must hold on every chain of
every map, and a test fails if it does not. A **soft** rule is a number compared with a recorded
baseline, which a change may not make materially worse.

| | Rule | Measure | Kind |
|---|---|---|---|
| **M1** | **Nothing sits on anything.** No box, badge, pill, gap word, label, AND gate, ring, square, bar, arrowhead or lane heading overlaps another, except a mark on its own box's border, and an arrowhead or gate on its own arrow. | Pairs of drawn rectangles that intersect by more than 1px. | hard |
| **M2** | **A line runs through no box it does not start or end at.** Arrows and stems alike. | Points sampled along each line that fall inside another box. | hard |
| **M3** | **Every mark is on the drawing.** Nothing is cut off by the drawing's edge. | Rectangles outside the drawing's bounds. | hard |
| **M4** | **An arrowhead is one size, and arrives straight.** The head is the same size whatever the line's weight. It sits on a straight run-in (the stub), and the curve meets the run-in along its own direction, so the head never hooks round a bend. The point where it enters is clear of that edge's marks. | The angle between the curve's last direction and the stub's; head size is constant by construction. | hard |
| **M5** | **The inputs to an AND gate come in apart.** Each cause enters the gate's flat back at its own point, on the side it comes from, running in along the arrow's direction; no input crosses another or the arrow's own line before the gate. | Crossings between a gate's inputs, and between an input and the arrow before the gate. | hard |
| **M6** | **A label belongs to its line.** It sits on its line or just beside it, and no other line runs through it. | Other lines through a label. | soft |
| **M7** | **Lines cross as little as the order allows.** Arrows leave and arrive in the order of where they go and come from. | Crossings between arrows. | soft |
| **M8** | **No detours.** A line is not much longer than the way it has to go. | Path length over straight distance, above 2.5. | soft |
| **M9** | **Room is made, not squeezed.** Where something must be drawn between two boxes (an arrow between stacked boxes, its label, the badges and pills on their edges), the gap between them grows to hold it, rather than the things being drawn over one another. | Not measured directly: M1 fails where it is broken. | principle |
| **M10** | **Opening or folding moves nothing it need not.** Folding moves no box; opening a label moves only what is below it. | Existing checks in `test_mechanism_view.mjs`. | hard |
| **M11** | **One source of geometry.** Every mark is placed by `layout`, and the drawing draws what `layout` returns, so the checks measure what is drawn. | The page test compares drawn positions with the layout's. | hard |
| **M12** | **A box holds its words.** No line of a state's label runs past its box: a word longer than the line is broken, at its own hyphen where it has one. | Lines longer than the box's width holds; the page test holds that estimate to what the browser draws. | hard |

## How they are held

- `audit(G)` in `app/src/argdown-mechanism.js` takes a finished layout and returns every breach of
  M1 to M5 and M12, and the M6 to M8 numbers. It is pure, like `layout`, so it runs without a browser.
- `app/test_mechanism_view.mjs` requires no hard breach on every chain of every fixture and every
  public sample, opened and folded to its ends, with the text's boxes and with every state.
- `app/mechanism_quality.mjs` prints the table for any folder of maps (the private research corpus
  with `--dir`), lists every hard breach, and compares the soft numbers with
  `app/mechanism-quality-baseline.json`.
- The page test checks what the layout estimates against what the browser draws: every label's
  words fit its rectangle, and every heading fits the width the layout reserved for it.

## How the layout keeps them

- **Every mark is placed by `layout`** (M11): the badges on a box's top edge and foot, the "more"
  pill, the "no link" words, the heads, the AND gates, and the lane headings' extents. Labels,
  gates and rings are placed clear of all of them.
- **Room is made in a second pass** (M9). `layout` runs once, collects what had no room -- a side
  too short for the heads arriving at it, a column gap too narrow for a label or a "no link" -- and
  runs again with those boxes taller and those gaps wider. Rows joined by an arrow between them are
  `STACK_GAP` apart.
- **Arrows are routed** (M2). An arrow that would cross a box on its way to a later column goes
  level through the free gap of each column between, joined by curves, and leaves its box from the
  side of where it is heading. A returning arc runs under everything at the shallowest depth clear
  of the boxes between, out of a box's side where another box stands below it. A stem (co-cause,
  blocker, moderator, measure) tries the near ways, ways under and over, out of the box's side, and
  through the column gaps, and takes the shortest that crosses nothing.
- **A level's heading is never under a box** (M1). Where a state running through several levels
  crosses a lane's heading strip, the heading starts past it, in the first stretch wide enough for
  the level's name, and the actors after the name are cut to the room left (in full on hover).
- **An AND gate's inputs** enter its flat back at their own points, the co-cause further from the
  arrow at the outer point, each led in along the arrow's direction (M5).

## Where it stands (30 Sep 2026)

On the 280 pictures of the fixtures, the public samples and the private research corpus:

| | before | after |
|---|---|---|
| M1 overlaps | 1,475 | 2 |
| M2 lines through boxes | 1,354 | 14 |
| M3 off the drawing | 35 | 0 |
| M5 gate inputs crossing | not measured | 2 |

The fixtures and public samples have none, and the test suite holds them there. The eighteen left
are stems in the densest research charts (Marti and Gond, Reason, the Coleman boat, Badger culling).

**The cost:** arrows that ran behind boxes now go round them, in the open, and cross more lines
(M7). The baseline records today's numbers; bringing them down is the next piece of work, and it is
about the ORDER of states in each column (as the Reasons map's canonical order was), not routing.
