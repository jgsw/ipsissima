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

**The paraphrase door, added on the author's word (5 Sep).** The same gesture, the other
fidelity: **Paraphrase it** writes the provenance — `fidelity: "paraphrase"`, the selected
words verbatim in `source:` so the reading can be checked against them — and *not* the
claim's text, because the restatement is the reader's judgement and the machine must not
fake a first draft of it (G3). What arrives selected is therefore the human's half in both
doors: the title for a quotation, whose text is already done, and the placeholder for a
paraphrase. The two buttons are the fidelity vocabulary's first lesson, met at the gesture
rather than in a conventions file.

**Deliberately not in v1.** `pinpoint:` (printed page numbers need the page map); a
selection crossing block boundaries is joined with single spaces and left to the writer's
judgement; `{` or `}` inside the selected words will break the metadata line, and the lint
says so on the line.

**The gate, reframed by the author (5 Sep).** There is no class of fifty to hand. The aim is
to build the tool to a level of ease and intelligibility at which teachers can be
*recommended* it, choose it for their own classes, and generate the real-world data. The
class-of-fifty brief therefore stays as the design target every choice is tested against —
what would this cost, times fifty, with no one at the front of the room who knows the tool —
and the field data arrives when teachers adopt it. What still beats any self-measurement is
one early pair of real hands: one novice, one text, watched.

## 3. The guided build-from-a-text mode — built, 5 Sep, on the author's word

**Status: shipped.** The author ratified the ingest reading, ruled that the paste door asks
whose text this is, and gave the word; everything below is now the record of what was built,
held by rendered-DOM checks that fill the door and make the selections with a real mouse.
Two live findings from building it: the walkthrough used to offer itself on top of the
guide's first step — its scrim made the Manuscript unselectable, the one gesture the guide
runs on — and now stands down while the guide is up (its own last step hands over to the
tour instead); and a map with no claims yet used to lose its manuscript, because the pane
followed only the claims' citations — it now follows the front matter's `defaults:`
declaration too, which serves any reconstruction begun before its first claim.

**The shape.** A guided mode on the walkthrough's pattern — P6's exemplar: attention claimed
once, easily exited, always recallable — carrying the reading method the writing-centre
tradition sets out (UNC Writing Center, "Philosophy"; Fisher and Govier behind it), with
selection-to-claim as its one primitive:

1. **Find the conclusion.** "Select the sentence the text is finally arguing for." The
   selection becomes the apex claim, by the §2 gesture — quote it or paraphrase it, which is
   already the first fidelity lesson.
2. **Find the premises.** "What has to hold for that to follow? Select each place the text
   says one." Each selection becomes a claim; the mode offers the relation to the apex.
3. **Find the evidence.** The same gesture at the examples and observations the text uses,
   offered as support for the premises they support.
4. **Ask about the unspoken** *(ruled 5 Sep: a question, never an obligation)*. "Are there
   any unspoken assumptions — something the argument needs that the text never says?" *No*
   is an acceptable answer and ends the step. A *yes* is the moment the mode teaches
   `imputation` and `warrant: "enthymeme"` — the fidelity vocabulary arriving exactly when
   its subject matter does, instead of in a conventions file the novice will never read.
5. **Walk the result.** Hand off to the existing walkthrough machinery on the map just
   built, so the mode ends where reading begins.

**Ruled, 5 Sep.** The mode lives as a **third door on the cold-start panel** — "start from a
text…", beside *start a reconstruction* and *start a debate map*. And it writes the
`reconstruction:` reading-policy block **first**, so the file is honest from its first save
— but draws the reader's attention to it only at the **end**, when they have made enough
readings for aim, unit, mode and strength to mean something: written up front, explained
when earned.

**How the text gets in — the author's question, and the proposed resolution.** The
Manuscript view has been read-only by rule, and a classroom cannot be assumed to have
Ipsissima-MCP for converting sources. The resolution: the rule survives untouched once it is
stated precisely. What C4 and the read-only pane protect is that a cited text is never
*edited in place* — the author's words cannot drift a character at a time under the
reconstructor's hands. *Bringing a text in* is ingest, not editing, and the tool already
owns the mechanism: the bundle. The third door opens on a paste panel — "paste the passage
you are working from" — and the pasted text becomes an embedded chapter of a bundle (the
`+ essay` machinery), read-only from that moment on, with `defaults: chapter:` set and the
reading-policy block written. Save produces one `.argdown` carrying text and map together —
which is also the classroom's collection mechanism: each student hands the teacher one file.

Three consequences worth stating:

- **Markdown is a non-problem at classroom scale.** Pasted plain text already *is* the
  Markdown the tool needs — paragraphs separated by blank lines. The MCP remains the route
  for PDFs, page numbers and whole books; the guided mode's texts are handout-sized.
- **Correction is wholesale, never in place.** A paste with a typo is fixed by *replacing
  the text* — a visible act, offered from the same door — not by editing the manuscript. The
  no-drift rule keeps its point, and any quotations already taken show their breakage
  against the replaced text, which is the checker doing its job.
- **The checks verify against the paste.** A pasted text has whatever fidelity the paste had
  to its original; the tool can verify claim-against-paste, never paste-against-edition. The
  door says so in one honest line, exactly as `text-provenance:` says its sentence: the
  borders vouch for the map's reading of *this* text.

**Resolved.** The paste door asks "whose text is this?" (the author's ruling): the answer is
written into the chapter's front matter as `attribution:`, shown by the same orientation
panel that carries an abstract, and folded into the map's own title. The mode itself is
built — the door, the five steps, the wholesale-replace path, and the walkthrough hand-off.

## 4. Standing

Shipped, each held by tests: the navigation audit and its three fixes; title completion,
safe auto-closing, indent-holding (`b449f40`); the parse-error translation and the fourth
trap; selection-to-claim with its drag-guard, and the paraphrase door beside it; the guided
mode entire — the paste door with its attribution question, the five steps, replace-the-
text-keep-the-map, the walkthrough hand-off (all 5 Sep, on the author's word). A guided
file's claims verify: run against the checker, coverage full, quotations exact, the
imputation warranted.

**The door after the cold start (the author's ask, 5 Sep).** An earlier version of this
section claimed the web could not reach the door once a file was open. Wrong, and the
correction is the design: on the web, **Open…** already reopens the cold-start panel — the
page's one File surface, dismissible by clicking off it — with all three doors on it, so
"start from a text" was reachable all along. What was genuinely missing was that the door
*conflated two intents*: with a pasted text open it went straight to replace mode, and a
fresh from-text start became unreachable — on the web and in the app alike. Now, when a
pasted text is open, the door offers both and guesses at neither: **Replace the text, keep
the map** (the claims re-placed, the borders re-checked) or **Start fresh from this text**.
With no pasted text open there is one intent, and one Begin.

Not in v1: `pinpoint:`.
