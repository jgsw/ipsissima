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
- **Only what a step touches is drawn** (James's principle, 8 Oct 2026). A state whose only tie is
  that it makes something up, or a starting point the text links to nothing, is not laid out.
- **Pieces that meet at no state stand side by side.** The columns of each piece are its own, the
  pieces in the order of their first column, and a rule (`rules` in the layout) stands midway
  between them. "Together" is offered only for chains that meet (`chainGroups`).
- **A label with no clear place widens the space it sits in** (M9). It widens the column gap where
  it lies, among those its arrow crosses, or the gap between two boxes stacked in one band. Failing
  both, it tries a wider set of places beside its line.
- **A level's heading is never under a box** (M1). Where a state running through several levels
  crosses a lane's heading strip, the heading starts past it, in the first stretch wide enough for
  the level's name, and the actors after the name are cut to the room left (in full on hover).
- **An AND gate's inputs** enter its flat back at their own points, the co-cause further from the
  arrow at the outer point, each led in along the arrow's direction (M5).

- **What the diagram comparison changed** (James's decisions, 9 Oct 2026; the study is in the
  private research folder, `diagram-comparison/`):
  - a step stated `via` others is no arrow where its route is drawn (`summaries`, listed in the panel);
  - the sign is the arrow's end -- a head, or a T-bar for "lowers" -- and a chip that only repeats it
    is `quiet`: not drawn, not placed, so it takes no room; a null ends in a hollow circle;
  - a level nothing reaches is `hidden`: no band, no heading;
  - the core path (`corePath`, `coreModel`) is a model of its own, laid out afresh; long chains open
    at it (`coreByDefault`); in it, a moderator the text gives no cause stands in its step's column;
  - a stock and its flows are drawn as such; an outflow is drawn from the stock out to the flow;
  - each loop has one mark (`centres`), placed after routing, clear of boxes, lines, gates and rings;
  - a loop that is most of a small chain is laid out as a ring, turned so its links out face their
    targets, and undone if any arrow would then cross a box;
  - the text's own boxes are compartments: a whole and its parts share a column, framed;
  - a condition on a declared state is written on the arrow and its state drawn, tied as a moderator;
  - small multiples (`multiplesModel`): one copy of the chain per value, set apart as pieces are;
  - an arrow moved by the spreading of heads is re-routed if it then crosses a box, and an arc down a
    crowded column bulges no wider than the gap beside it.
- **What the redraw against the figures changed** (9 Oct 2026, `diagram-comparison/REDRAW.html`):
  - a chip's distance from its own line costs in `placeChips`' second pass, and a chip still more than
    14px from it gets a dotted `leader` to the nearest point of the line;
  - the depth-first walk that sets the columns cuts a loop at an arrow of information, never at a pipe
    (`on: stock`), so inflow, stock and outflow run left to right;
  - the core path keeps each loop the text closes through two of its states (short loops first, ten
    added states at most);
  - a numbered step whose words only repeat the sign shows its number alone (`markOnly`).

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
