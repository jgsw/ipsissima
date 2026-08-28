# Closing the gaps: a plan

*Companion to `ARGDOWN-SUPPORT.md`, which establishes what is missing. This says what to do about
it, in what order, and why that order.*

The audit found 16 partial and 14 absent elements over 60. That sounds like thirty pieces of work
and it is not: **the gaps cluster around five causes**, and four of the five are one change each.
Sorting the list by element hides that; sorting it by cause is what makes it tractable.

## The ordering principle

Not by effort, and not by how many elements a fix closes. **By what the reader is told.**

1. **The map asserts something false.** Worst, always. A reader who sees a green arrow believes
   the file said "this supports that". If it said the opposite, the picture is not incomplete —
   it is a lie, and the reader has no way to find out.
2. **The map is silent about something the file says.** A loss, but an honest one, and a reader
   who knows the language can go and read the file.
3. **The map is silent about its own failure.** Between the two: nothing false is asserted, but
   the reader is not told to distrust what they see.
4. **The editor is wrong about the language.** Annoying, misleading to someone learning Argdown,
   and it cannot corrupt a map.

That ordering puts a one-character key fix above a fortnight of layout work, which is the right
answer even though it looks unbalanced.

---

## Tier 0 — done, 27 August 2026

**Three relation types were drawn as support.** The renderer's table said `contradiction`; the
parser says `contradictory`, and strict mode adds `entails` and `contrary`, neither of which was
present either. Every lookup fell through to `REL.support`, so a `><` drew in the green that means
"this is a reason for that", and in strict mode *every relation in the file* did, including its
attacks. The arrowhead was lost too, because markers are generated from the same table.

Fixed, and pinned by `app/test_relation_colours.mjs`, which asks Argdown what it emits rather than
comparing against a hand-written list — so a seventh relation type would fail the test rather than
quietly draw green.

**A related fault found while fixing it, and worse.** `RUN` is spread into every parse and a
spread is shallow, so `RUN.model` was one object shared across every parse in the process, and
Argdown merges a file's front matter into it. One file with `mode: strict` therefore left the
whole process in strict mode. `rebuild_viewers.mjs` builds every viewer in one process; the editor
re-parses on every pause in typing. Fixed by making the mutable members getters.

---

## Tier 1 — a syntax error must not produce a blank page

**Cause.** `argdown.run` reports syntax errors by *returning* them. Neither `__ARGDOWN_PARSE__`
nor `build_argdown_viewer.mjs` reads `res.parserErrors` or `res.lexerErrors`. So a file with one
bad line parses "successfully" into a document truncated at the fault, and the build writes an
875 KB page reporting `0 nodes, 0 edges` and exits 0.

**Why this is Tier 1 and not Tier 2.** An empty canvas is not a silence, it is a statement: it
says *this file has no argument in it*. A reader who has just been handed a reconstruction has no
reason to doubt that.

**The work.** Small, and mostly already designed — the metadata-YAML guard next to it is the
model, and its shape can be copied wholesale. Read the two error arrays; treat a parse error the
way `metadataProblems` is treated: the builder refuses to write, the editor marks the line, the
viewer keeps the last good map rather than blanking. The one new decision is what the *viewer*
does mid-edit, and the answer is already established by the YAML guard: half the keystrokes in a
line leave a file invalid, so a parse error while typing must never blank the map.

**Test.** `app/test_parse_failure.mjs` exists and already holds the YAML half. Add the ordinary
syntax-error case to it; the harness is there.

**Estimate.** Half a day. No layout work, no new UI.

---

## Tier 2a — the premise-conclusion structure

**The largest omission by volume**, and the root of the SCP complaints from use testing. Fourteen
reconstructed arguments in the Akhlaghi sample, ten in `semmelweiss.argdown`, nineteen in the
rebuilt Tooming. Each arrives as one box carrying its prose description. Numbering, order, the
premise/conclusion distinction, the named inference rule and `{uses: […]}` are all dropped.

**What makes this tractable rather than a rewrite:** `toGraph` *already walks the PCS*. It does it
to number inference steps, so the renderer can join the premises of one step with a bar — and as
of `dc18d06` it walks it again to find an argument's main conclusion and place it in the
manuscript. **The data is read twice and thrown away twice.** The work is to carry it, not to
recover it.

**The design is already specified by use testing**, and should be followed rather than reinvented:

- a **box around the premises** of a linked argument, so it reads as a group that works together
  rather than as separate reasons — the Rationale convention
- premises of one step **fold and unfold as one**, because individually they assert nothing. A
  premise that is itself supported by a further argument still unfolds separately: that is a level
  down, not a violation of one-level-at-a-time
- the **inference bar** kept, and the rule name shown on it where the file names one
- the current PCS marker **redrawn**: the curved lines meeting the horizontal bar look wrong at
  shallow angles, which is a geometry problem rather than a semantic one

**Sequencing.** This must come *after* the open fold defect is closed, not before. Both live in
`argdown-live-map.js`; more importantly, "these premises fold as one" is a new fold rule, and
adding fold rules on top of a fold bug is how the current defect got its history — read the
account in `KNOWN-ISSUES.md` of the repair that fixed one symptom and caused another.

**Test.** `fixtures/display/` exists for exactly this and is empty. The first fixtures should be
written here: a PCS with numbered premises, a named rule and `{uses: […]}`; an SCP whose premises
are *not* all bracketed (the Greenspan case); a premise that is itself supported. None needs a
source text or a licence.

**Estimate.** The largest item on this list. A week, most of it layout and fold interaction.

**Mostly done, 27 August 2026.** The structure is carried and drawn. Three things the design did
not anticipate came out of doing it, and each changed what got built.

**The SCP complaint was a map asserting something FALSE, not a map keeping quiet** — which moves
it above everything else in this tier by the ordering principle at the top of this file. An
untitled premise is not selected into the map under Argdown's default `statementSelectionMode`,
so it becomes no node, no arrow and no trace. An argument standing on three premises of which one
is bracketed therefore drew with exactly **one** arrow into it, and the map said the argument had
one reason. Argdown's own `greenspan.argdown` is worse: `<Turnover Argument>` has five premises,
none bracketed, so the whole structure was invisible and the argument arrived as a lone box.
`fixtures/display/scp-unbracketed-premises.argdown` holds all three shapes.

**So the enclosure could not be the whole answer.** A box round the premises presupposes premises
that are boxes, and in exactly the case that was reported broken there are none to gather. What
the argument's own box now draws is the lines of the structure that **have no box of their own** —
numbered as the file numbers them, in order, premises and conclusions distinguished, with the
inference bar above each conclusion and the rule name on it. Lines that *are* nodes are not
repeated, because the same claim drawn twice is worse than the omission. A gap in the numbering
is information: it says that line is on the map as a box. Measured on Argdown's own maps: 27
lines restored on `censorship.argdown`, 23 on the populism map.

**"Premises fold as one" turned out to be already true, so no fold rule was added.** Checked in
the browser against `fixtures/display/pcs-supported-premise.argdown`: a premise with no reasons
of its own has **no fold control at all**, so it cannot be folded individually; folding the
argument takes all its premises together; and the premise that *is* supported keeps its own badge
for the level below. That is precisely the specified behaviour. Adding a rule to enforce it would
have been new machinery in the one place KNOWN-ISSUES.md warns about, to make true something
already true — the mistake that file records being made once before.

**The marker was redrawn as a rake.** Every member used to be moved to the junction *point*, so a
premise well to the side ran almost parallel to the bar and its last units lay along it: the two
strokes merged and there was no visible join. Members now land at their own places along the bar,
evenly spaced and inset from its ends so the bar overhangs its outermost member, and turn onto it
square through a short stub. Two things were tried and dropped: keeping each member's own offset
and clamping it (two premises on one side clamp to the same end and land on one point — the same
convergence, moved to the end of the bar), and adding the stub unconditionally (a premise sitting
directly under its argument has no room for one, and the line drew a hook away from the bar and
back). The stub is now added only where there is room, which is only where the approach is
shallow enough to need it.

**Still not done in this tier:** the rule name is lost on a step with only one drawn premise,
because there is no bar to write it on — seven of the twenty-five steps in the reference maps.
`{uses: […]}` is carried to the renderer and shown in no way a reader can see.

**A gap in the measurement, worth knowing before the next change here.** `map_quality.mjs`
estimates node size from the label's *length* and never calls `sizeOf`, so it cannot see a box
grow. It reported byte-identical numbers across this change, and that is correct rather than
reassuring: the risk this work actually created — taller argument boxes colliding — is invisible
to it. It was checked in a browser instead, on the real maps at full expansion: 93 nodes on
Akhlaghi and 56 on the populism map, **zero box overlaps**, and every one of the ten enclosures
drawn contained exactly its own premises and nothing else.

## Tier 2b — one dropped field, four elements

**Cause, and it is a single line.** The parser resolves every inline construct into plain `text`
plus a list of `ranges`. `toGraph` keeps `labelText` and drops `ranges`.

That one omission accounts for **bold, italic, links, statement mentions and argument mentions** —
five elements, one fix at the source. Two behave differently and are worth separating:

- **Bold, italic, links** simply vanish. Emphasis is lost; a link's URL is lost and its anchor text
  is left looking like prose. A loss, honestly made.
- **Mentions leak their markup.** Argdown does *not* strip these from the text, so a box shows
  `@[Voice of the People]` with sigil and brackets intact. This is the one presentation that is
  both ugly and wrong, because it looks like a syntax error the reader should report. Seven of
  them in `core argument of populism.argdown`, six in `greenspan.argdown`.

**The work.** Carry `ranges` through `toGraph`, then render them. The rendering is where the cost
is: node labels are SVG `<text>` drawn via `textContent`, and rich runs need `<tspan>` with the
line-breaking redone per run. A mention should become the thing it mentions — a clickable
reference that selects that node — which is a genuine feature rather than a repair, and should be
allowed to be one.

**Suggested split.** Do the *mentions* first and alone: strip the markup and render the plain
title even before it is clickable. That removes the wrong presentation in an afternoon. Bold,
italic and links wait for the `<tspan>` work.

**Estimate.** Mentions, half a day. Rich text, three days.

## Tier 2c — tags, and two small truths

- **Only `tags[0]` becomes a facet**, so a claim with two tags can be filtered by one and the
  other does not exist. The facet model assumes one tag per node; either it carries a list, or the
  limitation is documented where a user writing tags will meet it. Prefer the list.
- **`removeTagsFromText` leaves a hole.** `A claim tagged #42 and #real.` renders as
  `A claim tagged and .` — strip the surrounding space with the tag.
- **`statementLabelMode: text` cannot be obeyed**, because `toGraph` falls back from a
  deliberately cleared `labelTitle` to `title`. The same fallback is why an untitled statement
  shows as `Untitled 1`.

**Estimate.** A day for all three.

---

## Tier 3 — the editor's view of the language

The linter marks the **legal** multi-line expanded inference as an error, and warns on eight of
the twelve logical shortcodes wherever they appear — including in statement text, where they are
correct — while passing `.^.`, `.v_.`, `.<>.`, `.[].` and all fifty-six emoji codes. Its
tokenizer does not recognise `><` as a relation, does not highlight `#(a tag with spaces)`, and
highlights only `**bold**` of the four emphasis forms.

**These are one job, not four**, and the audit has already done the hard part by establishing what
the language actually is. The linter should be rebuilt against `argdown-cheatsheet.md` and the
lexer's own token list rather than against recollection — which is the same discipline the
cheatsheet itself was written under, and the reason it is trustworthy.

Two corrections belong to the cheatsheet rather than the code: `#` followed by a number **is** a
tag in `@argdown/core` 2.0, and the cheatsheet says it is not.

**Done, 27 August 2026.** `--` is drawn and linted as what it is: legal Argdown opening an
expanded inference, a *warning* about the unpaired case rather than an error, at the same severity
`check_argdown.py` already gave it. `><` is recognised as a relation. `#(a tag with spaces)` is
highlighted, and so are all four emphasis forms rather than only `**bold**`.

The shortcode gap turned out to be **the same bug in two languages**: the checker's `SHORTCODES`
and the linter's regex both listed eight of the twelve, and both were missing the same four —
`.^.` `.v_.` `.<>.` `.[].`. A heading containing one is silently rewritten by the parser, which
breaks every `selectedSections` and `folded=` reference to it. Both are corrected, and
`test_relation_colours.mjs` now asks the *parser* for the list rather than comparing the two
copies against each other, which would have agreed while both were wrong.

Still open in this tier: the tokenizer's remaining blind spots, and the cheatsheet correction —
`#42` **is** a tag against `@argdown/core` 2.0.

---

## What to do first, in one line each

| | work | why now |
|---|---|---|
| 1 | ~~relation colours~~ | **done** — the map was asserting the opposite of the file |
| 2 | close the open **fold defect** | everything in Tier 2a is built on the fold logic |
| 3 | **parse errors** must not blank the page | a blank canvas is a false statement, and the fix is copied from next door |
| 4 | **mentions** stop leaking markup | half a day, removes a presentation that reads as a bug |
| 5 | ~~**PCS** drawn properly~~ | **mostly done** — the SCP case was drawing three premises as one reason, which was false rather than merely missing |
| 6 | ~~the **linter** rebuilt against the cheatsheet~~ | **done** — it was calling legal syntax an error, and missing four shortcodes the checker missed too |
| 7 | rich text, tags, label modes | real, smaller, and none of them says anything false |

Items 3, 4 and 6 do not touch the fold logic and can run beside item 2.
