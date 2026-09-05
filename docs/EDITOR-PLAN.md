# The editor programme: measurements, what shipped, and one design note

Opened 5 September 2026, at the author's direction — the Second Thoughts episode's editor
work (`docs/values/SECOND-THOUGHTS.md`), warranted by the T2 ruling: the tool cannot be
tolerant of invalid syntax, because a file that does not parse cannot be drawn, so what it
owes the writer is *prevention and repair*, never leniency. The cross-pane navigation audit
came first (`NAVIGATION.md`); the quick wins — title completion, safe auto-closing, Enter
holding the level — landed the same day. This file records the two measured pieces and the
one design that is deliberately not built.

## 1. Parse errors: the catalogue, and what it decided

Eighteen classroom-shaped mistakes were run against the real parser before a word of
translation was written. The results overturned the brief in both directions.

| the mistake | what the parser says | verdict |
|---|---|---|
| `+ [a]` at top level | "Invalid relation syntax. This may either be caused by a) an invalid relation parent or b) invalid indentation…" | teaches already — untouched |
| `(1)` outside any argument | "Incomplete premise-conclusion-structure (pcs). A pcs has to consist of at least one premise…" | untouched |
| two premises, no `----` | "Missing inference. Use four hyphens (----) between two numbered statements…" | untouched |
| a relation after a blank line | "Invalid paragraph start. Argdown paragraphs may not start with an outgoing support relation…" | untouched |
| `----` with nothing above | "Invalid inference position. An inference may only occur within a premise-conclusion-structure…" | untouched |
| `[a] text` — the missing colon | "Expecting token of type --> EOF <-- but found --> '…' <--" | **translated** |
| `[a]: One. [b]: Two.` — two claims, one line | the same EOF shape | **translated** |
| `[claim: text` — bracket never closed | **parses**, as ordinary prose: one anonymous statement, no claim defined, nothing said | **the fourth trap** |
| `<arg: text` | parses as prose, the same way | the trap's `<` variant |
| `+[b]` (no space), tab indents, a deep indent jump, the undercut `_ [b]`, an unclosed quote | all parse — legal Argdown | nothing to do |

The rule that fell out, held by `test_parse_failure.mjs`:

- **Translate exactly one shape** — chevrotain's EOF message, the only one a classroom meets
  and cannot read — and keep the parser's own words on the end, because the translation is
  ours and the authority is not (`friendlyParseMessage`, `argdown-graph.mjs`).
- **The parser's long messages pass through untouched.** Rewording them would be a second
  opinion on the official parser's words.
- **What parses silently into something else is a trap, not an error**, and is flagged only
  in shapes that cannot be prose — the shapes that must *not* fire (a `[sic: aside]`, a
  `<+` relation line) are tested alongside the one that must.

## 2. Selection-to-claim: the brief, the friction, the design

**The brief.** A class of fifty, the web page, a short text: each student must produce one
properly-cited quotation claim. Whatever that takes, times fifty, is the cost of the
assignment.

**The friction, measured** in the built workbench (Darwin baked in, 5 Sep). One quotation
claim by hand took nine steps: drag-select the passage; copy; click into the editor; find the
insertion point; type `[`, a fresh title, `]: `; paste the words as the claim text; open a
metadata line and indent it; type `fidelity: "quotation", source: "` and then the escape
convention — `\"…\"`, a backslash-quote wrapping nothing in the editor teaches; paste again
inside it; know whether `chapter:` is needed and what path it takes. Two pastes, one escaping
convention, one path convention — and every step a chance to break the byte-fidelity the
checker verifies, on the very level (`quotation`) where breakage is measured. The measurement
also caught a live defect: the selecting drag itself fired the passage-click handler, lighting
ten claims and moving the camera wherever they could be framed — the map lurching mid-selection.

**The design, shipped the same day.** Select words in the Manuscript pane and a **Quote this
passage** button appears in the pane's header — only while a selection exists, and only where
an editor exists to write into. One click, and the machine writes the part the machine can
see:

- a title slugged from the first five words, made unique against the map's titles;
- the claim text = the selected words, whitespace collapsed (the source file's line breaks
  are layout, not text, and the quotation check normalises the same way);
- `fidelity: "quotation"`, the `source:` recorded verbatim behind its escapes;
- `chapter:` only where the front matter's `defaults:` does not already say it — declare
  once, the conventions rule;
- appended after a blank line, the Argdown pane opened if closed — the one selection-side
  gesture that summons a pane, because writing into the file is the very thing it asks for
  (`NAVIGATION.md`'s doctrine) — and the title left *selected, ready to be renamed*.

The drag-guard shipped with it: while words are selected, the lighting gesture stands down.
Verified end to end: a claim written by the gesture passes `check_argdown.py --source-root`
on the Darwin sample — 13/13 quotations exact, the new claim placed to its own line — and
the whole path is held by rendered-DOM checks driven with a real mouse drag.

**Deliberately not in v1.** A paraphrase variant (a second button is a vocabulary decision
the guided mode should own); `pinpoint:` (printed page numbers need the page map); a
selection crossing block boundaries is joined with single spaces and left to the writer's
judgement; `{` or `}` inside the selected words will break the metadata line, and the lint
says so on the line.

**The measurement that gates what comes next.** The design above was measured against the
tool, not against people. Before the gesture grows (paraphrase, pinpoint, the guided mode),
the class-of-fifty brief should be run for real at whatever scale is available — one novice,
one text, watched, is enough to start; fifty student files collected and run through
`check_argdown.py` would make the checker itself the instrument.

## 3. The guided build-from-a-text mode — a design note, nothing more

**Status: design-note only, at the author's direction (5 Sep).** Not to be built until
selection-to-claim has met real hands (§2's measurement) and the author has ruled on the open
questions below.

**The shape.** A guided mode on the walkthrough's pattern — P6's exemplar: attention claimed
once, easily exited, always recallable — carrying the reading method the writing-centre
tradition sets out (UNC Writing Center, "Philosophy"; Fisher and Govier behind it), with
selection-to-claim as its one primitive:

1. **Find the conclusion.** "Select the sentence the text is finally arguing for." The
   selection becomes the apex claim, by the §2 gesture.
2. **Find the premises.** "What has to hold for that to follow? Select each place the text
   says one." Each selection becomes a claim; the mode offers the relation to the apex.
3. **Find the evidence.** The same gesture at the examples and observations the text uses,
   offered as support for the premises they support.
4. **Name the unspoken assumption.** The one step with *no* selection to make — and exactly
   where the fidelity vocabulary should arrive: the mode teaches `imputation` and
   `warrant: "enthymeme"` at the moment their subject matter first exists, instead of in a
   conventions file the novice will never read.
5. **Walk the result.** Hand off to the existing walkthrough machinery on the map just
   built, so the mode ends where reading begins.

**Principles it must keep.** G3 — the judgement stays human: the mode never proposes *which*
sentence is the conclusion, never ranks candidate premises, never supplies the assumption;
it asks the questions and works the gesture. B2 and P6 — every step dismissible, the whole
mode exitable and recallable; a scaffold, not a rail. B1 — tested against the novice before
the adept. And the two-promises doctrine for every gesture it adds.

**Open questions for the author.**

- Where does it live: under **How to use** beside the walkthrough, or as a third door on the
  cold-start panel ("start from a text…")? The second is more discoverable and more
  presumptuous.
- Does step 4 belong in v1, or is imputation a second lesson? The UNC sequence includes it;
  a first assignment might not.
- Should the mode write the `reconstruction:` reading-policy block, and if so when — up
  front (honest, but jargon-first) or at the end (earned, but easily skipped)?
- What the real measurement is, before building: one watched novice, or the class of fifty
  with their files as the corpus.

## 4. Standing

Shipped, each held by tests: the navigation audit and its three fixes; title completion,
safe auto-closing, indent-holding (`b449f40`); the parse-error translation and the fourth
trap; selection-to-claim with its drag-guard. Gated: everything in §3, and §2's growth
items, on the measurement and the author's rulings.
