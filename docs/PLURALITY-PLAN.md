# The plurality programme: two readings of one text, disagreeing in the open

Opened 14 September 2026 — wave 2 of the Formation queue (`docs/values/FORMATION.md` §6),
warranted by the T4 ruling: plurality over hedging. One file asserts one reading; two
defensible readings of a text are two `.argdown` files; and the machinery this programme
builds is how they disagree in the open instead of each presenting itself as *the*
interpretation. The classroom is the design target it inherits: fifty students hand the
teacher fifty files of one handout, and those files are both the plurality the Kant worry
wants and the empirical dataset the Formation episode's questions ultimately need.

## 1. The comparator — built, 14 Sep

**Status: shipped**, `ipsissima-mcp/src/ipsissima_mcp/compare_argdown.py`, held by
`tests/test_compare.py` (registered in `run_all_tests.mjs` as "two readings, compared").

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/compare_argdown.py A.argdown B.argdown \
    --source-root DIR [--format json]
```

**What anchors the comparison, and what never does.** The two maps share exactly one thing —
the text — so every comparison is anchored on verified quotations: each map's claims are
placed at the passages they quote, and the maps are compared *by passage*. The tool never
guesses whether two claim texts "mean the same thing": semantic matching of one
reconstructor's words against another's would be a judgement about both readings, and
judgements about readings are not the machine's to make (G3, and the same line
`check_argdown` draws). The cost is stated in every report: a claim with no verified
quotation cannot be placed, and the report counts how many claims it could not see.

**The unit is the paragraph** — a blank-line-delimited block of the source (page-marker
comments count as blank). Lines are too fine, chapters too coarse; a paragraph is what a
reader calls "the same passage", and it is re-derived from the file each run so converter
line-wrapping cannot move it.

**What the report says:**

- **Identity** — readings of the same source are maps citing a chapter in common. No new
  front-matter key was needed: *the cited chapters are the identity*, which is one less
  thing to declare and one less thing to get wrong. Maps with no shared chapter are refused
  with a sentence, not compared.
- **Reading policies side by side** — aim, unit, mode, strength; differences named. Two
  files declaring different modes have *announced* different readings, and the report leads
  with that.
- **Apexes** — what each map takes the text to be finally arguing.
- **Ground** — passages read by both, by A alone, by B alone.
- **Three divergence kinds**, all computed from what the maps declare, none a verdict:
  - **crux** — one map marks a passage `#crux` and the other reads the same passage without
    noting any choice: the second map may not know the ground is contested.
  - **voice** — one map's claim on a passage is `#reported` and the other's is asserted:
    the maps disagree about *who is speaking*, an interpretive disagreement about the text.
  - **distance** — one map reads a passage at the checked end (quotation/paraphrase), the
    other at the interpretive end (interpretation/imputation): the same words carrying very
    different loads.
- **The refusal to judge**, in the report's own last line: which reading is better is the
  argument the two files exist to have, and it is theirs.

## 2. The App surface — ruled 14 Sep, and the first surface built the same day

**The rulings.** The manuscript-as-common-ground surface first (candidate 1). The classroom
aggregate (candidate 4) is deferred in the author's words: "I can see that the classroom
aggregate could be very useful; but I don't yet have a class of students with whom to test
it" — it waits for the field data it would itself serve. And on the end state: "I suspect
that the two maps side by side may be the final resting place; but even when it's built it
would also be useful to use the manuscript as a common ground" — so candidate 2 remains the
likely destination, and what is built now is not thrown away by it.

**What shipped** (held by rendered-DOM checks: a real second file handed to the control, ×
to end, and the refusal). A **Compare…** control in the Manuscript pane's header — offered
only where the page carries the parser to read a second file (the standalone, the Reader,
the application; a baked per-map viewer rightly never shows it: a control that cannot work
is clutter, not teaching). Opening another reading of the same text paints each paragraph's
standing in the margin: a stripe for read-by-both, read-by-this-map, read-by-the-other; a
⚑ where the two read the same words *differently*, with the hover naming the divergence in
the comparator's three kinds (crux declared on one side only; #reported on one side only —
a disagreement about who is speaking; the checked end of the fidelity ladder against the
interpretive end). Hovering names the claims each map draws from the passage. Placement
rides the page's own machinery (`locateInPage`), never text-matching between the two maps'
claims; the layer clears with one click, both files untouched; a file placing no claim in
this manuscript is refused with the not-readings-of-the-same-source sentence rather than
painted as an empty layer. The help topic "Comparing two readings" documents it.

*Moved, 15 Sep:* the labelled header button read as one of the everyday controls, and
comparing is an occasional errand. The application now offers it from **File ▸ Compare with
Another Reading…** (the header carries nothing there); the web page, having no menu, keeps
an unlabelled glyph at the end of the Manuscript's header. Both ring the same `startCompare`.

## 2a. The candidates, as originally put

The comparator serves whoever has files and a shell — the teacher with fifty maps, the
scholar with two. What the App should draw is a design with real alternatives, and it is
deliberately not built ahead of a ruling (D7). The candidates, with what each costs:

1. **The manuscript as common ground.** Open a second map against the same source and the
   Manuscript pane shows each passage's standing — read by both, by one, differently by
   each (the divergence kinds as markers in the text's own margin). This is the most
   Ipsissima-shaped answer: the text is the one thing the readings share, so the text is
   where their disagreement is legible. It builds on machinery the page already has
   (in-page quotation verification, passage lighting), and it keeps P6 discipline available
   — the markers are a layer the reader can turn off.
2. **Two maps side by side.** The fullest view and the heaviest: two graphs, two cameras,
   one selection model, and C2's single-file promise now hosting two documents. Probably
   the right end state for the scholar's use; probably not the first thing to build.
3. **The report as a page.** Render the comparator's JSON as a readable page (or an export)
   — cheapest, useful today for the teacher, but it lives beside the App rather than in it.
4. **The classroom aggregate.** Not pairwise: N files against one text, and the Manuscript
   shows *how many* readings touch each passage and where they diverge — "which paragraph
   did the class read differently" is a seminar instrument, and it may be the most valuable
   surface of the four. It is also the one that turns the teacher's fifty files into the
   field data the Formation episode wants.

**The questions, as ruled (14 Sep):** surface 1 first — built; 4 deferred until a class
exists; 2 the likely end state, with 1 kept beside it. Cross-folder identity stays
uninvented ahead of the need.

## 3. Standing

Wave 2 is whole: the comparator (CLI, §1) and the manuscript-as-common-ground surface
(App, §2) are both shipped and tested. Ahead, in their own time: the two-maps-side-by-side
end state, and the classroom aggregate when there is a classroom.
