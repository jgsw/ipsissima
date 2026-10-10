<!--
  help.md — everything behind the "How to use" button.

  EDIT THIS FILE, not the template. It is rendered by the same markdown-it that draws the
  manuscript pane, and inlined into the page by build_argdown_viewer.mjs.

  THE RULES:

    * `#` starts a GROUP. It is a label in the contents and not a page — there is nothing to read
      at that level. Groups divide by WHAT THE READER IS ASKING, not by which control does it,
      because somebody consulting the help has a question and does not yet know the control.
    * `##` starts a new TOPIC, and its title is the reader's question or task, in the reader's
      words ("Is a step valid?", not "The validity check"). The contents list is built from these,
      in this order, so adding a topic is adding a heading. `###` and `####` are subheadings.
    * Everything above the first heading stays on the contents page, under the search box.
    * Everyday first, specialist after: a group opens with what a new reader needs, and design
      reasoning, where it helps at all, is a closing line — not the opening of an instruction.

  ADDING A TOPIC means putting it under the right `#`, and nothing else. If a topic genuinely
  belongs in no group, that is a sign the groups are wrong rather than that the topic needs one
  of its own.

  LINKS. `<a data-help="Topic title">…</a>` opens that topic; the same attribute works on
  anything in the page. A title named in a link, in `openHelpTopic("…")`, or in a "How to use ▸
  …" path must be a `##` here — app/test_teaching_text.mjs holds all three, so renaming a topic
  means renaming its links in the same commit.

  ONE HELP, TWO BUILDS. `<div data-build="editor"></div>`, empty, at the top of a topic leaves the
  whole topic out of the Reader, which cannot edit; wrapped round a passage (with blank lines
  inside it so its markdown is read), it leaves out just that passage.

  SEARCH WORDS. `<p class="also" hidden>…</p>` under a heading lists the words a reader reaches
  for that the topic may not use — "dashed" for the page that draws its dashes rather than naming
  them. The search weighs them like the title; nobody sees them.

  Raw HTML is allowed here (this is our own text, unlike a manuscript), and six ids are used by
  the program and must survive any rewrite: `relkey`, `fidkey`, `helpkeypane` and `helpstats` are
  filled in at runtime, `keyfloat` has its click attached, and `helpArrangeNote` is emphasised
  while Exposition is showing. The `srow` rows of "What's on the screen?" are drawn by
  `drawScreenIndex` from their `data-draw` key. Deleting one of those does not break the page,
  but the thing it was showing (or doing) silently stops.

  Fenced ```argdown blocks are set in ArgVu, so the relation symbols draw as arrows.
-->

Ipsissima makes complex reasoning intelligible through maps you can check at every step — a
reading of one text, a survey of a whole debate, or an argument of your own.

New to it? **Take the walkthrough**, the first entry below: two minutes, on the map you have open.
Looking for something? Type in the box above; it reads every topic, not only their titles.

# Start here

## What's on the screen?

<p class="also" hidden>marks, symbols, icons, glyphs, what does this mean, legend</p>

Every mark the map draws, with what it means and where to read more. Right-click a claim and
choose **What does this mean?** to come back here.

<div class="screen">
<div class="srow" data-draw="box"><b>A box</b> is one claim: its title in bold, its words below. <b>▼ more</b> shows the rest of them. <a data-help="Moving around and folding">Moving around and folding</a></div>
<div class="srow" data-draw="borders"><b>Its border</b> says whose words these are: solid for the author's own, dissolving to dot-dash for a premise the reconstructor supplied. <a data-help="How close to the author's words?">How close to the author's words?</a></div>
<div class="srow" data-draw="pile"><b>A box with another behind it</b>, saying how many claims it holds, is a folded section. <a data-help="Moving around and folding">Moving around and folding</a></div>
<div class="srow" data-draw="badge"><b>+3 under a box</b>: three reasons are folded there, and pressing it shows them. <b>−</b> puts them away. <a data-help="Moving around and folding">Moving around and folding</a></div>
<div class="srow" data-draw="lines"><b>The lines</b>: green supports, red objects, dashed orange undercuts a step, dotted violet contradicts. <a data-help="What the lines mean">What the lines mean</a></div>
<div class="srow" data-draw="bar"><b>Lines gathered on a bar</b> are premises that work only together. <a data-help="Reading an argument's box">Reading an argument's box</a></div>
<div class="srow" data-draw="argument"><b>A box of numbered lines</b> is an argument, step by step. A number on a line is that line's row in the box. <a data-help="Reading an argument's box">Reading an argument's box</a></div>
<div class="srow" data-draw="stair"><b>⊞ and a number</b> at an argument's foot opens it one step at a time. <a data-help="Following a long argument">Following a long argument</a></div>
<div class="srow" data-draw="rule"><b>A rule's name by a bar</b> (MP) says the step was checked and follows. <b>A red !</b> says it does not. <a data-help="Is a step valid?">Is a step valid?</a></div>
<div class="srow" data-draw="chip"><b>A hashtag on a box</b> says whose claim it is: a view reported, a point conceded, an objection. <a data-help="Whose claim is this?">Whose claim is this?</a></div>
<div class="srow" data-draw="corners"><b>A folded corner</b>: top left, the reconstructor's note; top right, a comment. <a data-help="Comments and notes">Comments and notes</a></div>
<div class="srow" data-draw="hatch"><b>Hatched in violet</b>: the reconstructor's own appraisal, shown only while it is switched on. <a data-help="The reconstructor's appraisal">The reconstructor's appraisal</a></div>
<div class="srow" data-draw="behind"><b>A line broken where it crosses a box</b> passes behind a claim it has nothing to do with. <a data-help="Reading in the text's order">Reading in the text's order</a></div>
<div class="srow" data-draw="strip"><b>Along the top</b>: the abstract, and what the map says about itself — who wrote it, whether a person has read it, where the reading is contested. <a data-help="What a map says about itself">What a map says about itself</a></div>
<div class="srow" data-draw="controls"><b>Along the bottom</b>: the controls — how much of the argument is showing, and which claims. <a data-help="The controls">The controls</a></div>
<div class="srow" data-draw="key"><b>The key</b>, floating in a corner, lists every marking, with this map's drawn bright. <a data-help="The key">The key</a></div>
<div class="srow" data-draw="cards"><b>In Exposition</b>: a band for each section of the text, and a card for each paragraph, numbered ¶ 4. <a data-help="Reading in the text's order">Reading in the text's order</a></div>
<div class="srow" data-draw="chain"><b>In Mechanism</b>: the chain of states. A solid navy box is what the text recommends doing, a double border what the chain is for, R or B a loop. <a data-help="Reading a causal chain">Reading a causal chain</a></div>
</div>

## Moving around and folding

<p class="also" hidden>zoom, pan, drag, scroll, fold, unfold, collapse, expand, badge, +3, section, block, pile, fit, full screen, main claim</p>

Every box is one claim. Arrows run *from a reason to what it bears on*, so an arrow points at the
claim it is about.

- **Scroll** — zoom in and out; <kbd>Cmd/Ctrl =</kbd> and <kbd>Cmd/Ctrl −</kbd> do the same from the
  keyboard, in all three arrangements
- **Drag** — pan across the map, from anywhere including the inside of a section
- **Fit**, in the title bar (<kbd>Cmd/Ctrl-0</kbd>) — the whole map in the window again
- **Click a box** — it becomes the current claim, and nothing is hidden. The badge under it
  folds: **+3** says three reasons are hidden there and shows them; **−** puts them away again
- **Click a section's header** — the named strip along its top: fold the section into a single
  block, or open it again
- **Right-click inside a section** — **Fold section**, from a menu

**A folded section** is drawn as a pile: a box with a second outline behind it, the section's
title, and how many claims it holds. The badge under it opens it. Opening a section shows the
claims it starts from, each still folded — one level per click, so a section of forty claims
never lands on you at once.

**How a large map opens.** A map of more than 25 claims opens with the section that holds its
main claim open and the others folded, at a size you can read: if the section is too wide for
that, it opens a rung lower on **how much**, the slider at the left of the controls, which says
which rung the map is on. Move it up when you want more. Nothing is decided for you after that:
the rung is yours from the first thing you fold, move or switch.

Folding and unfolding **hold still**: whatever you pressed stays where it was under the pointer
while the rest of the map moves around it.

**The controls along the bottom** fold away with the **⌄** at their end, leaving a small chip that
brings them back; the choice is remembered. In a browser, **Full screen** in the title bar gives
the map the whole window, and <kbd>Esc</kbd> leaves it.

*Why only the header folds a section:* a map with everything open is nearly all section
background, and a click anywhere in it would leave nowhere to start a drag from.

## The key

<p class="also" hidden>legend, key card, markings</p>

The markings a map draws with most — borders, lines and hashtags — in one place, assembled from
the reconstruction you have open, with the ones this map actually uses drawn bright and the rest
dimmed. Each heading opens its own page here.

<div id="helpkeypane"></div>

<p><button class="plain" id="keyfloat" type="button">Float this key over the map</button></p>

When a map uses several of these at once, this key also offers itself once, floating over a
corner of the map. The button above floats it again whenever you want it — in any build — and
in the application **Help ▸ Show the Key** and the map's right-click menu do the same. The
**–** in its corner folds it to just its header, and that choice stands: a folded key stays on
screen, across maps and reopenings, until the **×** closes it for good. Closing it is
remembered too; this page is its permanent home either way.

## Laying out the panes

<p class="also" hidden>layout, panes, read along, split, side by side, divider</p>

The **Map**, **Argdown**, **Notes** and **Manuscript** buttons in the title bar are panes, and any
combination of them can be open at once. Drag the divider between the map and the panes to give
either more of the window.

**Layout**, beside them, sets them for a job in one step:

- **Read** — the map only
- **Read along** — the map in text order beside the Manuscript, and **Follow** switched on, so the
  map keeps pace with your reading (see <a data-help="Reading in the text's order">Reading in the
  text's order</a>)
- **Edit** — the map beside the Argdown
- **Check** — the Argdown beside the text, no map: for checking quotations against the source
- **Comment** — the map beside the margin notes

**Texts on the left**, at the foot of the menu, puts the panes on the left of the map instead of
the right. On a narrow screen the menu also carries the three arrangements, which the title bar
has no room for.

## Seeing where a claim comes from

<p class="also" hidden>source, passage, quotation, manuscript, go to source, jump</p>

**Manuscript** opens the text beside the map. The pane is there in every arrangement: beside
**Argdown** it is what lets you check a `source:` quotation against the source without leaving the
page.

- **Double-click a claim** — jump to the passage it was drawn from
- <kbd>Shift</kbd>**-click a claim** — the same, and so is <kbd>Shift</kbd>+<kbd>Enter</kbd> on
  a claim reached by keyboard
- **Right-click a claim** — **Go to source**, from a menu
- **Click a claim** — marks it as the one you are working on
- **Click a passage** — the other way round: every claim drawn from that paragraph lights up on
  the map. If they are folded away they are opened, and if they all fit on screen the map moves
  to them.
- <kbd>Shift</kbd>**-click a passage** — the same, and the map *reframes* on the lit claims,
  zooming out as far as it needs to hold them all. The plain click moves the camera only when
  the claims fit at your current zoom, so this is the gesture for a crowded screen, and the note
  at the top of the Manuscript pane names it whenever it would help.
- **Click a `[claim]` in the Argdown** — lights it on the map and, when the Manuscript pane is
  open, shows its passage

Selecting a claim shows it in whatever panes are already open, and opens none: which panes you
work with is your business. Going to its passage — double-click, shift-click, or **Go to source**
— is the one request that opens a pane, because the Manuscript is the very thing it asks for. On a
map that reads no text there are no passages, and the gesture says so.

The note above the passage says how precisely the claim was placed. *Found by its quotation* is
exact. That includes a claim whose own text is the author's words, with or without quotation
marks. *The paragraph it came from* is as close as an unquoted claim can be pinned. A claim
quoted from a footnote is shown where the text marks the note, and says *from note 3*.
Clicking the note itself lights the claim too. A claim located only to its file has no line to
highlight, and says so.

The two marks come off separately. Clicking the map's background clears the mark on the map;
clicking past the passage in the manuscript clears the mark there, so you can keep a claim
marked while reading around it in the text.

*Why a passage lights every claim it produced, not the nearest:* across the reference maps 57% of
placed claims share a line with another, so "the closest" would be a choice the tool has no way
to make.

## Finding your way in a long text

<p class="also" hidden>contents, headings, table of contents, chapters</p>

A long article or a book is navigated by its own structure, and the Manuscript pane knows it:
**Contents**, at the right of the pane's header, floats the file's headings over the text
beneath it, so any section is one click away from wherever you are. Click a heading to go
there; the section you are reading is marked as you scroll, and where the source records
printed pages, each entry carries the page it falls on. The list's own **×**, the button again,
or Escape folds it away.

The headings are the document's own, never invented: a `#` in the source is there because the
document said so. A file with fewer than two headings offers no Contents at all. A text in
several files has a menu at the left of the header for choosing which file to show.

# Reading an argument

## Three arrangements of the same claims

<p class="also" hidden>reasons, exposition, mechanism, arrangement, view, main claim</p>

Reasons and Exposition are both the argument. What differs is what *orders* the claims — the
order of reasons, or the order of exposition.

- **Reasons** — the main claim at the top, and beneath it what supports or attacks it, level by
  level
- **Exposition** — the same claims, placed where they occur in the text: file by file, section by
  section, in reading order. See <a data-help="Reading in the text's order">Reading in the text's
  order</a>
- **Mechanism** — offered only when a map declares one: not the argument but what the text says
  *happens* — the chain of steps from a cause, often the action it recommends, to the outcomes it
  is for. See <a data-help="Reading a causal chain">Reading a causal chain</a>

<p id="helpArrangeNote">They are the same claims twice over. <b>Exposition</b> answers a different
question: not <em>what holds this up</em> but <em>where does the reader meet it</em>. A long arrow
there is a claim and its support far apart in the text.</p>

In the application, **View ▸ Reasons**, **Exposition** and **Mechanism** switch between them, on
<kbd>Cmd/Ctrl-1</kbd>, <kbd>2</kbd> and <kbd>3</kbd>.

## Reading an argument's box

<p class="also" hidden>premises, conclusion, bar, linked, numbered, argument box, independent</p>

Argdown draws two different things with the same arrow, and the map tells them apart. Premises
inside one inference step of a **premise-conclusion structure** are *linked*: none of them carries
any weight without the others, and knocking one out destroys the step. They are gathered onto a
**bar** and go on as a single arrow.

An ordinary `+` or `-` relation is *independent*: knock it out and the rest still stand. Those
keep their own arrows. So a fan of separate arrows means several reasons; a bar means one move
that needs all of them.

A step whose other premise is an intermediate conclusion — internal to the argument, and not
drawn — arrives as a single line and keeps a plain arrow, because a bar gathering one line would
claim a linkage you cannot see.

An argument's box lists its whole structure, every line under the file's own number. A line
whose claim has a box of its own appears as a **bracketed reference** — `(1) [Its Title]` —
exactly as the file writes one: the row is not a second copy of the claim but the structure
naming which box plays that line, and hovering the row lights that box up. The claim's arrow
carries the **same number**, written at the argument's end of it — at its foot on the bar for a
linked premise, beside the arrow for a conclusion leaving the box — so the numbers on the map
and the numbers in the box are one numbering. An unbracketed row is a claim that appears
nowhere else.

**Clicking a bracketed row travels to that claim**, unfolding whatever hides it and moving the
map, and leaves a control naming the argument it came from. The control takes you back to that
**argument** — not to where the camera was, which a fold in between could have made point at
nothing.

## What the lines mean

<p class="also" hidden>arrows, lines, colours, green, red, orange, violet, support, attack, undercut, contradiction</p>

<div class="key" id="relkey"></div>

<p id="helpEdgeNote">In <b>Exposition</b>, with <b>Shape</b> switched on in the control bar, a line
also says <em>which way it reaches</em>. Colour still means what it means above — the arrangement
never changes what a line <em>is</em> — but the weight of the ink says when its support
arrives:</p>

- **Solid** — the reasons were already given by the time the claim was made.
- **Pale** — the claim is asserted *before* its justification arrives: at the point you meet
  it, its reasons are still to come.
- **Heavier** — the relation reaches a long way across the text, whichever direction it runs.

Weight of ink means the same thing here as it does on a claim's border: how settled this is *at
this point in the reading*.

Only relations that reach further than about a twelfth of the reconstruction are marked this way.
Most support sits a line or two from what it supports, and that is not a finding about the text,
it is how prose works. Small arrowheads along a line show its direction where there is room.

## Following a long argument

<p class="also" hidden>staircase, steps, step by step, chain of reasoning</p>

An argument that reaches its conclusion in several steps is drawn as one box of numbered lines.
That is the compact form and the right default, but it asks you to hold several cross-references
at once: that (2)(3)(4) give (5), that (5) with (6) give (7), and so on.

So an argument with a premise-conclusion structure carries a **⊞** control at the foot of its
box, with the number of steps beside it. It opens the same argument as a **staircase**: one small
argument per step, each intermediate conclusion in a box of its own between them, the rule
spelled out and the verdict beside it.

A **one-step** argument has the control too, and it offers something different: there is no chain
to follow, so what the panel adds is what the box has no room for. On the map a premise is
clipped to a single line; here every one of them is written out in full, with the rule named and
the verdict in words.

- **Full text** — every line as the file writes it. What the source actually says
- **Compact** — the same chain drawn from the claims' short names, so a step and the conclusion
  it reaches sit side by side and the whole shape fits on a screen

The short names are the *reconstructor's*, not the source's, so **Compact** is the view to think
with and **Full text** the one to check against.

A step whose only input is the conclusion above it gets no box; it becomes a label on the arrow,
which is what such a step is: *and therefore*.

**Click any claim in the panel** to dismiss it and go to that claim on the map. Claims that exist
only inside the argument are not clickable — there is nowhere to go. <kbd>Esc</kbd>, the **×**,
or a click outside the panel all close it. The panel's two save buttons keep the staircase as a
picture (SVG or PNG).

## Is a step valid?

<p class="also" hidden>validity, valid, invalid, logic, rule, formalization, countermodel, red exclamation</p>

A premise-conclusion structure can name the rule its step relies on, and naming one is a claim
that the conclusion **follows**. Ipsissima checks that claim where it can.

```argdown
(1) [advice-unlawful]
(2) [founded-on-null-is-null]
-- Modus ponens {uses: [1, 2]} --
(3) [order-is-null]
```

The rule name is drawn beside the bar, abbreviated the way a logic text abbreviates it. The full
name is on the label's hover. These abbreviate:

| | | | |
|---|---|---|---|
| `MP` modus ponens | `MT` modus tollens | `HS` hypothetical syllogism | `DS` disjunctive syllogism |
| `CD` constructive dilemma | `DD` destructive dilemma | `Simp` simplification | `Conj` conjunction |
| `Add` addition | `DN` double negation | `DeM` de Morgan | `Contrap` contraposition |
| `UI` universal instantiation | `UG` universal generalisation | `EI` existential instantiation | `EG` existential generalisation |
| `BE` biconditional elimination | `RAA` reductio ad absurdum | | |

**That list is a convenience, not a vocabulary.** Any name at all may be written: an unrecognised
name of several words is reduced to its initials, and a one-word name is drawn as it stands.

**And the name is not what the map's mark vouches for.** The verdict comes from the
`formalization` lines alone — the map would reach the same answer if the line said `-- Banana --`.
What the name does on the map is *ask the question*: a step with no rule named is not checked at
all. The label itself is examined elsewhere: the checker (`ipsissima-check`, or `argdown_check`
when an assistant runs it) matches a single textbook name against that rule's actual schema and
reports a valid step wearing the wrong one — a *modus ponens* labelled `Modus tollens` comes back
flagged. A name of your own, and a line naming two rules at once (a compound step), are labels
rather than claims to a known form, and are not examined by anything.

Checking needs the claims to say what they *are*, which they do with `formalization`:

```argdown
[advice-unlawful]: That advice was null and of no effect. {formalization: "u -> na"}
```

Given those, the step is decided and the bar says which of four things is true:

| the mark | what it means |
|---|---|
| the rule name, plain | **checked, and the conclusion follows.** The quietest possible positive mark |
| a red **!** badge | **checked, and it does not follow.** The one state worth interrupting for |
| the rule name, hollow | **a rule is named but nothing checks it** — the lines carry no `formalization`, so the claim is unexamined |
| no rule name | **nothing was claimed.** Not a fault: most steps name no rule |

Named-but-unchecked is drawn differently from nothing-claimed on purpose. A step that asserts
*modus ponens* and has never been tested is not in the same position as one that asserts nothing.

**Click the red badge** for the countermodel — the concrete way the premises can all hold while
the conclusion fails.

This is a check on **validity**, not on truth and not on whether the step really is the rule it
names. A step can be perfectly valid and still misread the author entirely; that is what the
fidelity border and the `warrant` are for.

### And whether the formula still belongs to the claim

A `formalization` is written once, by hand, and nothing afterwards ties it to the sentence it
stands for. Edit the claim, leave the formula, and the step is still decided — correctly — about
formulas that no longer say what the claim says.

So a claim may record the words it was formalized against:

```argdown
[a-claim]: If the advice was unlawful the Order is null.
    {formalization: "u -> na", formalized: "3d2a90f1"}
```

`formalized` is a short hash of the claim's text. Edit the claim and it no longer matches, and
the rule name is drawn with a **wavy underline** — *not checked: a claim of this step has been
edited since it was formalized*. Re-read the formalization against the claim as it now stands,
then record that you have:

```bash
ipsissima-check my-map.argdown --stamp
```

**It records your agreement; it cannot check it.** Nothing can tell whether `u -> na` is a fair
rendering of an English sentence — that is the judgement the whole design leaves to you. What the
stamp does is make sure the judgement is not quietly inherited by a sentence you have since
rewritten. Capitalisation and line-wrapping are ignored, so re-flowing a file raises nothing.

## Reading in the text's order

<p class="also" hidden>exposition, text order, bands, paragraphs, cards, echoes, follow, rows, column, pages</p>

In **Exposition** every section of the text has a band, including a section with nothing in the
map placed in it. That band is drawn empty and dotted, with its word count and *nothing in the
map is placed here*, so that a gap in the reconstruction reads as a gap and not as a section the
text does not have. References, notes and other back matter get no empty band. Text that comes
before the first heading, such as an abstract or an untitled introduction, has a band of its own
called *before the first heading*. That is a description, not one of the text's headings.

The bands are the headings that actually divide the text. A heading with almost nothing under
it, such as a title page's heading, does not count, and neither does back matter or a heading
that is only a link. A text that no heading divides is banded by its **printed pages** instead:
*p. 101*, *p. 102*. That is the printer's division, not the author's, and the band's tooltip says
so. A run of pages with nothing mapped in it is one empty band, *pp. 11–34*.

Claims drawn from the same paragraph are stacked in the order the paragraph makes them, top to
bottom. A claim placed only by matching its paragraph, with no words of its own to find there,
goes below the ones that were found.

**The précis.** The first rung of *how much* in Exposition is the **précis**: one claim for each
section, chosen to be what that section argues, in the order the text makes them. Read down,
it is the paper in a sentence per section. The choice passes over arguments (they have no words
of their own), claims read from a note, the reconstructor's imputations and views the text
reports only to answer. A paper opens at its précis the first time you turn to Exposition, and
you climb from there. Reasons keeps the depth it had.

**Following the reading.** With the Manuscript open beside Exposition, **Follow** in the
Manuscript's header makes the map keep pace with the text (**Layout ▸ Read along** sets this up
in one step). As you scroll, the claims drawn from the passage you are reading are lit and brought
into view: the passage a third of the way down the pane, or the nearest one above it that
produced a claim the map is showing. Nothing is unfolded; a claim in a folded section is shown by
the block that stands for it, and at the précis the section's one claim stays lit while you read
the section. Clicking a passage lights, as well, any claim the passage *announces* (see echoes,
below), even though that claim is placed where it is argued.

**Two flows.** Exposition can flow in **rows** or down a **column**. The choice is *flow* on
the control bar.

**Rows.** Each paragraph that has claims drawn from it is a faint **card**, with its claims top to
bottom in the order the paragraph makes them. Its number is at the foot: **¶ 4** is the fourth
paragraph of its section, so you can find it in the text. The numbers also show paragraphs that
gave no claim: from ¶ 2 to ¶ 5, two paragraphs were passed over. Read down a card, then along to
the next, and at the end of a row on to the next row, as you would lines of text.

Where a paragraph's claims set out a mechanism — they state causal steps, in a map that has one —
the card says so at the right of its foot: **↝ 3 steps**. Click it to see those steps drawn as the
Mechanism view draws them, at the place in the text where they are set out, as an author puts a
diagram beside the passage that explains it, with each step in words beneath. **Open in the
Mechanism view** shows them in their chain, beside the steps the rest of the text gives.

**The column.** Every claim has a row of its own, top to bottom in the order the text runs, so the
map reads the way the Manuscript beside it does. The relations move into the margins as arcs. On
the left are reasons the reader has **already met** when they reach the claim; on the right are
reasons **still to come**. The wider an arc swings, the further it reaches. On a narrow pane (a
phone, or the map beside an open Manuscript on a laptop) the column opens at the top of the text,
at a size that can be read, and scrolls like a page.

**Pages.** On a pane wide enough for two, the column is cut into **pages** set side by side, like
a journal's columns. Each page is as tall as the pane at a size that can be read, so you read it
top to bottom without scrolling, then go on to the top of the next, panning across when you
reach the edge. A section that runs over a page break carries on under its name, marked
*(continued)*. **Zoom, and the pages are cut again** once you stop: still each as tall as the pane,
so there are more and shorter pages zoomed in, fewer and longer zoomed out. **Fit** puts back the
pages the column opened with.

A relation to the page beside is drawn through the gap between them. A relation to a page further
off would cross everything in between, so it is drawn as a **connector**: a short stub at each
end, labelled with the claim at the other end. Point at either claim, or at a stub, and the whole
line appears. Select either claim and its connectors stay drawn. Click a stub to go to the other
end.

**A line behind a claim** is drawn dashed across it. A reason several sections away is a long line
with whatever the text put in between sitting on top of it, and a line re-emerging at a box's edge
would otherwise look exactly like a line starting there. The broken stretch says the claim it
crosses has nothing to do with it.

**Echoes.** A claim can record, in `echoes:`, the other places the text states it: its thesis
announced in the abstract or the roadmap, say, while the claim itself is placed where it is
argued. Exposition draws a small dotted **echo** at each of those places, tied to the claim by a
faint dotted line. Click an echo to go to its claim. An echo is not a claim: it carries no
relation, folds nothing, and Reasons never shows it. The checker verifies each echo against the
text, and lists (`ipsissima-check --echo-candidates` on the command line) places where a claim's
words recur, for you to confirm or not.

Claims that have no place in the text come **last**, in a lane of their own called *no position
in the text*. They are the claims whose quotation could not be found, which declare no line, and
whose words match no paragraph. Most of them are the reconstructor's imputations and
interpretations, which have no words in the text to be placed by. A claim quoted from a
**footnote** is placed where the text marks the note, beside the sentence the note glosses.

When a claim's words stand in **more than one place** (in the abstract and in the results, say,
or twice in the body), it is placed in the text proper rather than a file's front matter or a
converter's note. It goes on the page its `pinpoint` cites, if its words are on that page, and
outside the abstract. Otherwise it goes at the earliest. The other places are what
`--echo-candidates` offers as echoes.

## Where do the reasons fall?

<p class="also" hidden>shape, sparkline, before, after, anticipated, prepared</p>

A claim has to be justified, and there are only two places its justification can sit: before it
in the text, or after. If it comes after, the reader holds the claim while its reasons are still
to come; if before, the reader has held the *materials* without yet knowing what they were for.

Neither is a fault, and each asks something of a reader in its own way. Stating a thesis and
then arguing for it is ordinary practice; so is building the case first. This view measures
where each claim's support falls and how far away it sits; it does not score either habit.

This is an author's question about a text more than a reader's, so it is a layer you turn on:
**Shape**, on the control bar in Exposition. Off, the default, the lines are drawn plain and
no sparklines are shown. On, each band carries a **sparkline**, and the whole reconstruction
has one in the footer beside the claim count, read left to right through the text:

- **below the line** — support *anticipated*: claims stated here whose reasons are still to come
- **above the line** — support *prepared*: claims made here whose reasons were already given

The horizontal axis is already the text, so *forward* means rightward; height is left free to
say something else, and what it says is which side of a claim its reasons fall.

Each mark is weighted by how far its relations reach, so line-to-line support barely registers and
a reach across half the paper dominates. A band with nothing long-range to report shows no
sparkline rather than a flat line.

A band's mark is **rebased onto its own stretch of the text**, so a section's sparkline is a
close-up of that section rather than the whole paper with one blip in it. The heights are relative
too — each mark is scaled to itself, so a short section is not a flat line beside a long one.

Beside the footer's mark is the same thing in words — *converges late*, *settled early*, and the
point in the text where the weight of the argument falls. Hovering gives the percentage.

Two of the samples that come with Ipsissima sit at opposite ends. Swift's *A Modest Proposal*
has done its justifying 14% of the way through: the proposal is made first and argued for
afterwards, so most of its mark sits below the line. Darwin's *Natural selection* is not done
until 68%: most of its reasons are given before the claims they support, so most of its mark
sits above the line.

## Reading a causal chain

<p class="also" hidden>mechanism, causal, cause, effect, chain, loop, intervention, outcome</p>

The Mechanism arrangement draws the causal chain a text sets out: from a cause, through the states
it says change, to the outcomes it is for. Levels of social complexity run top to bottom (macro,
meso, micro, or the text's own) and sequence runs left to right. Every state is a box and every
arrow is one or more claims in the map.

Where a chain starts is drawn by what the text does with it. A **solid navy** box is an
*intervention* — what the text recommends doing. A **tinted** box is a *condition* — a cause an
explanatory text sets out from without recommending anything. An outcome — what the chain is for,
or what the text explains — has a **double border**. A state can be more than one of these:
in a vicious circle, the state where the circle starts can also be what the remedy is for.

**Loops.** Where the text closes a loop, the arrow that closes it dips under the chain and returns,
marked ↻ — or, between two states drawn one above the other, the steps run down one side of the
column and back up the other, so a loop between them reads as a circuit — and **every state in the
loop carries a ↻ badge** (numbered when there is more than one loop). Click a badge, or the loop in
the panel, to see that loop alone, its steps and claims listed in order. A loop marked *reflexive*
runs through a belief, a prediction or a classification that the loop itself acts on — a prophecy
that fulfils itself. Where many loops run through the same states — a theory whose every part
feeds back on every other — they are shown as one **feedback system**, marked ⟳A on each of its
states: click it to see the system alone, with its shortest loops offered one by one.

**The text's own boxes.** Where a map says that some states are parts of a larger one — the boxes
of the author's own diagram, a typology under one heading — the chain opens with each part drawn
inside its whole, at the level the text itself draws. At that level the steps of one voice between
two boxes are drawn as **one arrow**, whose label counts what it holds — *decides which ×18 ·
raises ×17* — and whose panel lists them kind by kind. **Show every state** draws the parts, and
every step, apart; **The text's own boxes** puts them back. A feedback system is laid out as a
compact block: left to right means "comes after" between systems, not inside one, where every
state leads round to every other. An arrow's label **decides which** says that a state
settles which of several alternatives follows, rather than raising or lowering anything.

**Several chains.** A text that answers several questions — a paper working through several
cases — can set out a chain for each. The view then opens at the first, drawn on its own and
asking its own question; **Chain** at the top switches between them, or shows *every chain
together*. A state two chains share carries **⇄**: click it to open the other chain, where the
same state may play a different part — what one chain explains can be where the next begins.

**The same kind in different cases.** A state marked **≈** is the same kind of thing as a state in
another case — a general claim's rural–urban migration and one region's herders' migration — but
not the same state: nothing runs from one to the other. Click ≈ to see every state of that kind,
which chain each is in (with a button to open it), and any step the cases share. Where the text
makes one of them the **general** claim and the others its cases, the panel says so, and lists each
step that is a case of the general step.

**Joint causes and states across levels.** Where the text says two things bring something about
only *together* — a belief and a desire, say — the step is one arrow, and a **stem** runs from the
second cause into an **AND gate** on the arrow near its head: the effect passes the gate only with
every cause coming in. The step's panel says *only together with*.
A state the text puts at more than one level at once — an expectation that is both many people's
belief and a fact about their society — is drawn as one tall box through every level it holds at.

**Thresholds and regimes.** An arrow that reads **raises past a threshold** is a step the text
says acts only once its cause passes a threshold, not one that grows smoothly with it. A step's
panel names the regime it holds in where the text gives one (a dose, a place, a model). The
checker never joins steps from two regimes into one route.

**Sizes.** Where the text gives how much, a step's arrow carries the value after its direction
("lowers · −0.12"). Its panel gives the size in full, with its interval and what it was measured
against, and says where a link runs only partly through a route, or not through it at all.

**Trends and periods.** An arrow that reads **slows** or **speeds** is a step on a trend: the
text finds that one thing slowed or sped the change in another, not that it lowered or raised it.
A step's panel gives the period it holds in where the text names one ("after culling ended").

**A blocker.** Where the text says a step holds *unless* something else does (defences between a
hazard and harm), a stem runs from that state and stops on a short bar across its own end, the
mark of a blocker. The step's panel says *unless*, and also *despite* where the text says the
step held although something acted against it.

**Reading a drawing for the first time.** *Read this drawing*, in the bar under the chain, steps
through the marks this chain uses, lighting one example of each and saying what it means.

**An arrow of several steps.** An arrow labelled "×2" or more holds several of the text's steps
between the same two states. Click it, then *Draw each step apart* to give each its own arrow.

**Disputed.** Where two accounts of one step are set against each other in the argument — two
texts that agree on the direction and dispute the size, say — each arrow says **disputed**.

**Evidence read from a measure.** A **dashed stem** to a small **square** on an arrow says the
step's evidence is read from that measure. It is orange where the text says something biases the
measure, which undercuts the step.

**A moderator.** Where the text says something strengthens, weakens or reverses a step, rather than
bringing about its end, a **dotted stem** runs from that state to a small **ring** on the arrow. The
step's panel says what it does, and also where the text finds that something does *not* moderate
the step.

**Needed for, enough for.** An arrow that reads **needed for** is a necessary condition: the text
says the effect holds only where its cause does, which a plain *raises* would misstate. **Enough
for** says the cause, with any co-causes, brings the effect about on its own; **not alone** says the
text denies that it does.

**Measures.** A box marked **≙** is a measure of another state: a survey score, an estimate, a
marker. It is a reading of that state, not a cause of it, and its panel says which state it
measures and how.

**Making, keeping, changing.** Some arrows say what a step does to something's existence rather than
its amount:
- **makes** and **unmakes**: it brings something into being or ends it;
- **maintains** and **erodes**: it keeps something going or wears it away;
- **transforms**: it changes what kind of thing it is.

**opens up** and **closes off** say the step changes what *can* happen, not what does. A **hollow
box in italic** is not (yet) actual. **◌** marks a possibility the text sets out; **…** marks what the
text says cannot be specified in advance.

A box with **round ends** is an ongoing doing, an activity or a development, and not an amount. Where
the map declares its chain a **cycle**, the panel says so, and whether the text says the cycle comes
to rest; the chart does not ask where a cycle starts or ends.

**Associated.** A brown line with no head says the text reports that two things go together, and
does not say one brings the other about. It is never followed as a route. The census names any
state the text says causes both, which may be where the association comes from.

**Flows into, flows out of, likelier.** "Flows into" and "flows out of" mark an inflow to or an outflow from a stock, in Donella Meadows's terms (*Thinking in Systems*). The stock
need not move with the flow: fewer births can still leave a larger population. "Makes likelier"
says a step changes the chance of its effect, not whether it happens.

**No arrow.** Where two states have no arrow between them, the text does not say. That is not a
finding of no effect. A "no effect" line says the text finds none.

**Bridges.** In the Reasons map, an argument whose step names a causal scheme draws the scheme's
short name in italics on its inference bar: "consequences", "means → end", "cases → general",
"cause → effect". Such a step, a bridge, carries the mechanism into the argument: its premises are
steps the text states. Hover the name to see what move it makes and what to ask of it; **click it**
to see the steps its premises state, drawn as the Mechanism view draws them, and, under each of the
scheme's questions, what the map records on it — a blocker, a rival account, another route to the
same outcome — or that it records nothing there, which is where the text may be silent or the map may
have missed what it says. Some questions only a reader can answer, and the panel says which. It
reports; whether the move succeeds is yours to judge. **Open in the Mechanism view** goes to the
first of the steps, in its chain. A bridge is never checked for validity, as a deductive rule is. In the Mechanism view, **Taken on by the
argument** lists the states where the chain stops but a claim stating the step into them is a reason
in the argument. The text goes on there, by argument rather than by cause.

**A chain as one node.** A claim that stands for a whole chain — the account a text gives, argued
for as one thing, or a rival account it rejects — carries **↝ n** at the foot of its box in Reasons,
n the chain's steps. Click it to see the chain drawn, how its steps are backed, and each step in
words; **Open in the Mechanism view** shows it there, where the claim is named above the chain it
stands for. A bridge whose premise is such a claim reads the chain's steps.

**In a draft.** Where the map says the text is still being written (`draft: true`), a bridge's
panel also says how well each question is answered — **answered**, **partly**, **not answered** —
and why: a blocker or rival account counts as answered where the argument takes it up, as a reason
or by answering it; backing by how many steps are tested or argued for.

**Sketched, or not mapped.** A map may map its text's mechanism only as far as the argument relies on
it. A **sketch** names the question, the actors and the chains, and marks steps only where the
argument uses them; the Mechanism panel says so, with the reason, and the states left without a step
are left open on purpose. A map that considered the mechanism and did not map it says so in the
Mechanism view, with the reason: the text argues from definitions, say, or the reader wanted the
argument alone.

**In order of explanation.** A chain's steps normally run in time, left to right. A chain marked as
running **in order of explanation** -- the stages of a genealogy, each adding a complication -- says
so above the chart, because left to right is otherwise read as history.

**What makes something up.** A box marked **⊂** makes up something else, and a box marked **⊃** is
made up of other boxes. This is what a thing is made of, not a cause of it, so it is never drawn as an
arrow and never followed as part of a route. The box's panel lists each relation with its claim: how
much of the whole it makes up, and whether the text treats the whole as no more than its parts or as
depending on how they are organised. A text can say the same pair is both caused and made up at once;
then there is an arrow, and the marks as well.

**Rival accounts and their types.** A rival arrow can carry the *type* of causing its story
attributes, and whose it is: *intended by* the eaters, *guided by* the advertisers, *inadvertent*,
*accident*, or *complex*. Where each story has a chain of its own, *Draw this story alone* in the
outcome's panel draws it by itself.
Where an outcome has several accounts, the outcome's panel lists them side by side: whose each is,
whether the text rejects it, leaves it unjudged or endorses it, and which story opens another's
cause. A story the text endorses is drawn as its own.

**A link the text opens into a route.** A text often states a link whole and then says how it
runs: a trial's total effect, then the mechanism through which it came about. The map marks the
whole link `via` the states between, and its arrow is labelled *via* the first of them, as a folded
route is. It is the same route, counted once, not a second route beside the finer one.

### What an arrow says

Each arrow is drawn the way the rest of Ipsissima draws things:

- its **pattern** is how close its claims stand to the author's words — solid for a quotation,
  dissolving to dash-dot for an imputation — exactly as on a claim's box;
- its **weight** is what the text offers for the step: heavy for a study, statistics or a model,
  medium for a step the text argues, thin for one it only asserts;
- its **colour** is whose step it is: navy for the text's own, slate for a rival view the text
  reports, violet for the reconstructor's appraisal, teal for a *selection* link — an association
  that holds because of who ends up on each side, not an effect.

Its **end** says which way the effect runs: an arrowhead where more of the first brings more of
the second (or where the text gives a cause with no direction), a red **bar** where more of the
first brings less of the second. These are effects, not the support and attack of the Reasons map.
An arrow carries a label only where it says more than that: a count of the claims it holds, a delay,
a condition ("where it is Latin America"), a verb such as *closes off* or *makes likelier*, or the
name and number the text gives the step. **Labels: Full** writes every arrow's word. A line ending
in a hollow circle, marked **no effect**, is a finding that nothing is brought about — often the
text's answer to a rival view's arrow beside it. Where the map declares the kinds of link the text
tells apart (ecological and social, say), each kind has its own colour, named in the Legend. Where the text finds no effect only under a condition (a
knockout, a subgroup, a place), the chain's panel gives the condition beside it, since a null that
holds only there is no finding that the first never affects the second. The panel also names each
loop **reinforcing** or **balancing** when every step on it has one sign, and lists each stated
timing with its own step. The **Legend** beside the chain shows each kind of line this map uses.

### Studying the chain

Click an arrow to see its claims, and a claim to reach its passage in the text. **Click a state**
to see only the paths through it — what leads to it and what it leads to — with the rest faded.
**Back to the whole chain**, or <kbd>Esc</kbd>, brings everything back. **Show only what the text
tested** keeps the steps backed by a study, statistics or a model.

**Only what is in a mechanism is drawn.** A state appears on the chart only where a step touches
it. What something makes up, where a state of it is in no step, is listed in the panel under
*What makes it up*. A step the text says runs **only through** others is not drawn beside them:
it is listed in the panel under *Stated through others*, and hovering it lights its route.

**The core path.** A long chain opens at its **core path**: the run of steps the text says most
about, from where the chain starts to its outcome, with whatever holds or moderates each step,
drawn as a thin arrow onto it. The loops that run through it are kept, so a stock's feedback still shows. **Show: every step** draws the rest; **Show: the core path** comes
back to it, on any chain that has one.

**A label away from its arrow** is tied to it by a thin dotted line, where the arrow's own stretch
had no room for it.

**Stocks, flows and loops.** A state that something flows into or out of is drawn as a **stock**, a
heavier square box, and the flows as **pipes**, each flow's state marked with a valve. Where the text
draws attention to where its system stops, a **cloud** marks each open end of a flow: where an inflow
comes from, or an outflow goes, outside what is mapped. Hover a cloud for the text's words. Each loop
has **one mark at its centre**, R where it reinforces and B where it balances, numbered where there
are several; clicking it shows that loop alone. Where a loop is most of a chain, its states are laid
out round a ring.

**The text's own boxes.** Where the text groups states into a whole, the whole is drawn as a
**compartment** round its parts, and every arrow keeps its own ends, part to part. **Show every
state** draws the parts apart.

**One panel per condition.** Where a chain's steps hold under different values of one state — a
cause that works in one place and not another — **Show: one panel per …** draws a small chart for
each value, side by side.

**Marks on a box.** ✱ marks a state the text says is unobserved; ⊘ an outcome that stops the process
short, drawn grey; a small line sketch, the behaviour over time the text gives the state (growing,
oscillating, levelling off). A square frame round a state says the text's analysis holds it fixed;
one round two, that they cannot be held fixed apart.

**Chains together.** A text that answers several questions has a chain for each, in the **Chain**
menu. Chains that meet at a state they share can be drawn together: **Every chain together** where
all of them meet, and a **Together** entry for each group of them otherwise. A chain that meets no
other is drawn on its own. Where one chain's steps fall into separate pieces, the pieces stand side
by side with a thin rule between them, so you can see they meet at no state.

A state's name is cut at three lines; **▼ more** on the foot of its box shows the whole of it, and
the rows below move down to make room. **▲ less** puts it back. A long label on an arrow is cut
too, and says itself whole when you hover on it. **Labels: Full**, in the bar, shows every state's
and every arrow's label whole at once, as **Claims: Full** does in Reasons; **Short** cuts them
again.

**−** and **+** zoom the chain out and in, and the size between them, pressed, puts it back to its
actual size; so do <kbd>Cmd/Ctrl −</kbd> and <kbd>Cmd/Ctrl =</kbd>, and a pinch or
<kbd>Cmd/Ctrl</kbd> with the scroll wheel, which zooms at the pointer. The plain scroll wheel
scrolls the chain. **Fit to width** scales a wide chain to the window.

The top line of the drawing says **what the levels are**: parts within wholes, regions within
regions, a chain of command, larger and smaller, a food chain, separate systems — and whether that is
what the text says or the reconstructor's reading. Where the map does not say, the line says so.

**Nest the levels** draws each level as a frame inside the one it is part of, instead of as a band
beneath it; **Levels as bands** puts them back. Nesting says each level is part of the one around
it: right for an organ in an organism, wrong for a herbivore under a carnivore, so bands are the
default. Where the map says its levels nest, the frames follow what it declares, so two groups
within one society sit side by side; where it says they do not, nesting is not offered; where it
says nothing, the frames are drawn under a note that they are an assumption.

The panel beside the chain gives its shape — how many steps, across how many levels, over how
long — and its **gaps**: where the text's chain stops, or never reaches an outcome. A gap is a
finding about the text, not a fault in the map.

### Folding

A long chain can be folded. Click a state, then **Fold into its arrows**: the state leaves the
drawing, and each pair of steps through it becomes one route, labelled *via* the state. A route
says what its steps add up to and never more — raises then lowers is lowers; it is backed only as
well as its weakest step; it stands as far from the words as its most distant claim — and
clicking it lists every step's own claims.

**Intervention → outcomes** does this for the whole chain at once: it folds everything between
the intervention and its outcomes, and sets aside what lies off that line — other causes the text
names, places its chain stops — naming them in the panel. **Unfold the chain** puts it back.
Nothing moves when you fold: every state keeps its place, so unfolding returns exactly what you
saw.

## Studying a map

<p class="also" hidden>study, quiz, predict, test yourself</p>

Unfolding a map shows you the argument; **study mode** makes you reach for it first. Start it
from **Study** at the head of the map's control bar, or from **Study this map** at the top of
this panel. The map folds to its main claim, and a small card asks one question of the topmost
claim that still has reasons folded beneath it: *what do you think holds this up — and would
anything speak against it?* Answer in your own head, then press the badge under it — the **+3**
that counts what is folded there — and compare what you expected with what the map says.

The card never asks you to type, never scores you, and never records your answer: whether your
expectation and the map agree is your judgement to make, not the tool's.

Where the reconstructor has marked a claim's reading as a **crux** (`#crux`) — one reading among
live alternatives — the card says so at that step, and the claim's note names the readings not
taken.

The mode follows you rather than steering you: unfold any badge, in any order, and the card
moves on. **Study** again, <kbd>Esc</kbd> or the **×** ends it at any time, and the map stays
folded exactly as you left it — your unfolds are the study. The one exception: ending the mode
before you have unfolded anything puts the map back as it was, so pressing the wrong button costs
nothing.

*Why reach before looking:* recalling an argument beats re-reading it, and predicting a reason
beats being handed one. On a contested text a machine grading your answer would be grading you
against one reading among several, which is why nothing here does.

# Whose words, whose view

## How close to the author's words?

<p class="also" hidden>border, borders, dashed, dotted, dot-dash, outline, fidelity, quotation, paraphrase, compression, interpretation, imputation</p>

A reconstruction cannot otherwise distinguish the source's words from the reconstructor's. The
border of each box says which:

<div class="key" id="fidkey"></div>

Unmarked claims are drawn plain.

**Hover text says what the box could not.** A claim drawn in full, with nothing recorded about
where it came from, has no tooltip at all. What a tooltip does carry:

- the claim's own text, **only where the box clipped it**
- the author's **exact words**, which the map never draws — it draws the reconstructor's claim.
  Suppressed only where the two say the *same* thing, which is what `fidelity: quotation` means.
  Where the claim is longer than the quotation it is shown, because that is the reconstruction
  putting words in the author's mouth and it is exactly what you would want to see
- the **fidelity** level, named
- the **warrant** — why a departure from the author's words was licensed

The same rule everywhere: a section header gives its full name on hover only when the band was
too narrow to draw it; a premise row gives its full text only when the row was cut.

How these are written in the file: <a data-help="Recording where a claim came from">Recording
where a claim came from</a>.

## Whose claim is this?

<p class="also" hidden>hashtag, tags, reported, conceded, contested, crux, authority, obiter</p>

A different question, and the border does not answer it. *Whose words* is one thing; *who is
putting this forward* is another, and a map loses it where prose keeps it easily — "Hume holds…",
"even granting that…", "one might object…". Without it a reader cannot tell a position the author
holds from one the author is attacking.

So a claim may carry a **hashtag**, and these recur often enough to mean the same thing in every
reconstruction:

| | the claim is |
|---|---|
| *(no hashtag)* | **the author's own, asserted.** The common case |
| `#reported` | **a view the author sets out but does not hold** — an opponent's position, a rival hypothesis, the theory under examination |
| `#conceded` | **something the author grants tells against them** — a counterconsideration, or a scope limit the author sets on their own thesis |
| `#contested` | **an objection voiced in the text that is not the author's view** — a critic's, an interlocutor's, or one the author raises against their own position and answers. Never the author's own view, even where it opposes a persona or a position the text sets out; and never the reconstruction's own objection, which is a rival reading (`#crux`, with the rival set out as `#reported`) or, where one was asked for, the appraisal |
| `#appraisal` | **the reconstructor's own reading of the text against the world** — written only when asked for, and hidden until its switch is turned on (see <a data-help="The reconstructor's appraisal">The reconstructor's appraisal</a>) |
| `#authority` | **a proposition whose force comes from its source, not its content** — a decided case, a statute. Chiefly in legal texts |
| `#crux` | **a point where the text underdetermines the reading** — the reconstructor chose among live alternatives, and the claim's note names the road not taken (see <a data-help="What a map says about itself">What a map says about itself</a>) |

Each names something the shape of the graph cannot: nothing about how a claim is wired reveals
that it is Hume's rather than the paper's. On the Tooming reconstruction thirty claims are
`#reported`, and without the hashtag every one of them would read as something the authors believe.

`#authority` also stands in for something the notation cannot draw. A green arrow means one claim
supports another, and it means the same whether the support is a reason a reader can weigh or a
precedent that binds regardless of what anyone thinks of it. *The King hath no prerogative but that
which the law of the land allows him* holds up the claim above it **because a court decided it in
1611**. On the Miller map nine claims carry it.

A file may use any hashtag it likes and Ipsissima will show it — these are a convention, not
a fixed list. Miller's `#obiter`, for what the court said by the way and did not need for its
decision, is one of a map's own. The **hashtags** switches in the control bar list whatever the
file actually contains, and do not appear at all when it contains none. Switch one off to take
those claims off the map; the bar says how many claims the switches are hiding.

## The reconstructor's appraisal

<p class="also" hidden>appraisal, hatched, violet, reconstructor</p>

The appraisal is off until you ask for it. It is the reconstructor's own reading of the text
against the world — a confounder the author never mentions, a step the text leaves out, a loop it
leaves open — and never something the text says.

Its switch is **Appraisal**, in the map's control bar beside the hashtags, and in Mechanism's bar
below the chain, and it is **one switch**: turned on in one arrangement, it is on in all three. It
says how many additions it is hiding; switched on, a banner stays across the view and every
addition is drawn hatched in violet, on the argument map and on the chain alike.

While it is off the additions are nowhere on the page — not on the map, not in the margins — and
none of them is ever counted as the author's: an appraisal claim is never crowned the main claim,
and the spine and the depth ladder are measured towards the author's own theses alone.

## What a map says about itself

<p class="also" hidden>machine-written, AI, generated, reviewed, crux, abstract, facts, voice, reconstruction block, questions, reframe, dissolve</p>

Along the top of the map, beside the **Abstract**, a map can say what kind of thing it is. Each of
these opens this page when clicked.

**The questions the text works on.** A map may name the questions its text works on, and say what
its claims do to each: answer it, reframe it, split it, or dissolve it. A paper that shows a question
has no answer to give -- "does philosophy belong with the humanities or the sciences?" -- is not
arguing with either answer, and the map no longer has to draw it as if it were. The **questions**
pill lists them, each with the claims that move on it; click a claim to go to it on the map.

**When the text itself was machine-written.** A map may declare, in its front matter, that the
text it reads was generated by an AI assistant:

```argdown
===
title: A generated-text reading
text-provenance: generated
===
```

Ipsissima shows that declaration beside the map's title. The borders and checks then say what
they always say — that the map is faithful to the text. Whether the text is *true* is a
different question, and the label is there so nobody mistakes the first assurance for the
second.

**When the map itself was machine-written.** A map whose front matter declares
`reconstruction: generated:` and records no `reviewed:` shows **machine-written map**; one whose
front matter records `reviewed:` — a person's pass over the map, dated — shows **map read by a
person** instead. The second label records that someone looked, and deliberately claims no more:
checking a long map against its source is hard, so a recorded pass is limited reassurance, not a
proof. The quotation checks are mechanical and hold either way; whether the *reading* is fair
remains a judgement, and the label says whose.

**A reading that names its cruxes.** A claim tagged `#crux` marks a point where the text
underdetermines the reading and the reconstructor chose among live alternatives — the claim's
note names the road not taken. A map declaring any shows **one reading · N cruxes**: it is one
reading among defensible readings, and it says so at exactly the points where that matters.

**The abstract, the facts, the voice.** The panel behind **Abstract** carries whatever the
manuscript's own front matter offers as an orientation to the text — the article's **abstract**,
or for a judgment its **facts of the case**, which somebody else usually wrote and which the
panel credits:

```yaml
---
facts: |
  What happened, before any of it was argued about.
facts_source: "Headnote, [2019] UKSC 41"
---
```

One more kind, for the rare text that needs it: **the voice**. A satire or a dialogue can be
mapped in perfect fidelity — every quotation verbatim, every border green — while the argument
belongs to a persona the author invents to be seen through. The tags on the claims say so one
by one; a `voice:` line in the source's front matter says it once, of the whole, in the
reconstructor's own sentence, and it takes the panel ahead of an abstract because a warning
against misreading outranks a courtesy summary. None of these is part of the reconstruction,
and the panel says so. A file offering none of them has no panel.

**The reading the map declares.** A new map begins with a `reconstruction:` block at the top of
the Argdown. It says which kind of reading the map is trying to be, so that someone who finds a
reading unfair has something definite to disagree with:

```yaml
reconstruction:
    aim: fit
    unit: meaning
    mode: coherence
    strength: ordinary
```

- **aim** — `fit`: what the text says, by its author's own standards — would the author
  recognise these thoughts as theirs? Or `appropriation`: the best argument that can be made
  *with* the text, for a debate of today.
- **unit** — what a hard choice is between: `meaning`, two senses of one sentence; or
  `commitment`, two things the author says that cannot both be held.
- **mode** — what makes one reading *better*: `coherence` with the author's other commitments,
  `truth`, `soundness` (the argument works), `agreement` with what the reader takes to be
  reasonable, or `interest`.
- **strength** — how much better than their words the author is assumed to be: `minimal`,
  `ordinary` (the working default) or `strong`.

The last three are the three ways "read it charitably" is ambiguous, after Tom Stern: coherence
and truth are both called charity, and can point opposite ways about the same passage. A map
written by a machine also records `generated: true` in the same block.

## Comparing two readings

<p class="also" hidden>compare, comparison, two maps, other reading, difference</p>

One text legitimately supports more than one reconstruction, and two defensible readings are
two `.argdown` files. To see where they differ, open one of them and choose the other: in the
desktop application from **File ▸ Compare with Another Reading…**, which shows the Manuscript
if it is not already up; in the web page from the small two-pages glyph at the right of the
Manuscript's header. The text is the one thing the two readings share, so the text is where
their disagreement is drawn: each passage's margin shows whether **both** maps read it, only
**this** one, or only the **other** — and a passage the two read *differently* carries a **⚑**
whose hover says how. Three kinds of difference are flagged, all from what the maps themselves
declare:

- one map marks the reading **contested** (`#crux`) where the other notes no choice;
- the maps disagree about **who is speaking** — one reads the passage as the author's own
  voice, the other as a view the author sets out (`#reported`);
- the same words are read at the **checked** end of the fidelity ladder by one map
  (quotation, paraphrase) and the **interpretive** end by the other.

Hovering a striped passage names the claims each map draws from it. Nothing is judged and
nothing is written: which reading is better is the argument the two files exist to have, and
**End comparison** removes every stripe, both files untouched. A file that places no claim in
this manuscript is refused with an explanation — maps citing no text in common are not readings
of the same source, and there is nothing to compare them on.

# Making and editing a map

## Opening a map, and where its text is found

<p class="also" hidden>open, file, folder, text not found, missing text, bundle</p>

**Open a file.** In the application, Ipsissima reads the folder the file sits in, so the text
comes with it — you do not have to find and open the folder yourself — and double-clicking a
`.argdown` in Finder or Explorer does the same thing. In a web browser a page cannot read a
folder it was not handed, so a lone file opens as the map alone: drop the whole **folder**, or
use **Open… ▸ Open a folder…**, to bring the text too. A **bundle** — a single `.argdown` that
carries its text inside it — needs neither.

**Where it looks for the text.** Nothing is guessed. Each claim says which file it came from, in
its own metadata:

```argdown
[a-claim]: The claim.
    {chapter: "source/paper.md"}
```

That path is read **relative to the folder the `.argdown` is in**, so `source/paper.md` means a
`source` folder sitting beside the reconstruction. If a cited file is not there, the claim still
appears on the map; it simply has no passage to show, and the Exposition arrangement says how many
claims could not be placed.

Two folders are never searched: `Old versions` and anything beginning with a dot. A folder holding
several `.argdown` files opens the one you actually chose.

**Reading order**, when a reconstruction cites more than one file, comes from a project file
beside it — `argdown-project.yml`, or `_quarto.yml` if you already keep one:

```yaml
chapters:
  - "source/01-intro.md"
  - "source/02-cases.md"
```

Without one, the order is the order the reconstruction itself cites them in, which is right for a
single paper and is the reconstructor's own sequence for several.

**Open a folder** instead when there is no `.argdown` yet, or when you want to pick the folder
rather than hunt for the file inside it. It is the same result either way. **Open…** in the title
bar brings back the opening panel, with every door on it.

## Starting a new map

<p class="also" hidden>new, blank, skeleton, debate map, start</p>

<div data-build="editor"></div>

**Start a new one** when there is nothing to open. The panel Ipsissima shows when no file is
loaded offers both kinds — **New reconstruction** and **New debate map** — and in the
app they are **File ▸ New Reconstruction** and **File ▸ New Debate Map**. Either way, what
appears is a small working skeleton to type over; it unloads whatever is open, and asks first
if there is anything unsaved.

The reconstruction skeleton — a claim, the argument for it, an objection, two premises — carries
a border of each kind, so the vocabulary the map draws with is on screen before you have written
anything. The debate-map skeleton carries none, which is its own lesson: a debate map surveys a
pattern of public argument rather than reading one text, so no claim cites a source, and the map
stands instead on the fairness of the person who drew it — whose name goes in the front matter —
with tags marking which side each claim belongs to.

The reconstruction skeleton begins with a `reconstruction:` block, saying which kind of reading
the map is trying to be; <a data-help="What a map says about itself">What a map says about
itself</a> explains each line.

## Starting from a pasted text

<p class="also" hidden>paste, pasted, new from text, guide</p>

<div data-build="editor"></div>

**New from text…** — the third door on the opening panel, and **File ▸ New from Text…** in the
app — is for when what you have is a passage and the map does not exist yet. The door is never
far away once something is open: **Open…** brings the opening panel back, doors and all. Paste
the text, say whose it is, and press Begin. The pasted text becomes the manuscript, carried
*inside* your file: saving produces one `.argdown` with the text embedded, which opens anywhere
and can be handed to anyone whole. Whose-text-you-said appears in the panel at the top-left of the
map, and one thing is true of everything that follows: **quotations are checked against this
pasted copy, not against the original** — which is why the door asks for the edition.

A guide then takes you through building the map, one question at a time, with selecting-and-
quoting as the only gesture:

1. **Find the conclusion** — select the sentence the text is finally arguing for.
2. **Find the premises** — each selection becomes a claim, already connected to your conclusion.
3. **Find the evidence** — the same gesture; you say which reason each piece supports.
4. **Are there any unspoken assumptions?** *No* is a fine answer. A *yes* becomes an
   `imputation` with its `warrant` — the one claim with nothing to select.
5. **The declaration** — the top of your file has carried, from the start, a `reconstruction:`
   block saying which reading yours tries to be. The last step is when it is worth reading.

The guide asks; it never answers. Which sentence *is* the conclusion, what the assumption says,
whether the reading is fair — those stay yours. The **–** folds the guide to its header; the
**×** or <kbd>Esc</kbd> puts it away for good, and the map and text stay exactly as they are.

The pasted text itself is never edited in place — no manuscript is. A bad paste is corrected
wholesale: reach the door again — **File ▸ New from Text…** in the app, **Open…** then *New
from text…* on the web — and with a pasted text open it offers both intents, guessing at
neither: **Replace the text, keep the map**, which re-places every claim and re-checks every
border against the corrected copy, or **Start fresh from this text**, which begins again.

## Bringing in a paper or a PDF

<p class="also" hidden>pdf, epub, word, docx, convert, converter, import, mcp, claude, assistant</p>

Ipsissima reads a text as Markdown: a `source` folder beside the `.argdown`, with a `.md` file for
each paper or chapter. Getting a PDF, an EPUB, a Word file or a web article into that form is the
other half of the work, and a separate program does it: **Ipsissima-MCP**.

It is an **MCP server** — a set of tools an AI assistant can use — so you ask the assistant you
are already talking to: *make an argument map of this paper*. It converts the document into
structured Markdown with its paragraphs and printed page numbers intact (this conversion is the
*converter* that other pages here mention), and checks the finished reconstruction against the
text word for word. The reconstruction itself is the assistant's judgement, and yours to check:
a map written that way says so, **machine-written map**, until someone records that they have
read it (see <a data-help="What a map says about itself">What a map says about itself</a>).

You can also stop after the conversion — *just get me the text* — and reconstruct by hand here.
In Claude Desktop, Ipsissima-MCP installs with a double-click on its `.mcpb` bundle, from the
releases page; any other MCP client can run it too, and its README says how. Without an assistant
at all, **New from text…** starts a map from a passage pasted from anywhere.

## Quoting and paraphrasing from the text

<p class="also" hidden>quote, paraphrase, select, selection, new claim</p>

<div data-build="editor"></div>

**Select a passage** in the Manuscript while you are writing the map, and two buttons appear above
the text. They are the fidelity vocabulary's first lesson:

- **Quote this passage** writes a new claim whose text *is* the selected words —
  `fidelity: quotation`, the source recorded verbatim, the chapter cited where the front matter
  does not already say it — with the claim's title arriving selected, ready to be renamed.
- **Paraphrase it** writes the same provenance but not your words: the restatement is yours to
  make, so the claim's text arrives as a selected placeholder, ready to be written over.

Either way, while words are selected, clicking does not light claims or move the map: a drag that
selects is not a click that asks. **Quote this passage** opens the Argdown pane it writes into.

*Writing the map* means a map you are building by hand, or a machine-written one
(`reconstruction: generated`) that you have already edited here — the first edit is how you say
you mean to. On a machine-written map you have only read, selecting a passage offers no writing
doors: reading is not editing, and the row above the text stays clear for the one door reading
may want, **Highlight in Zotero** (see <a data-help="Your Zotero highlights">Your Zotero
highlights</a>).

## Writing Argdown

<p class="also" hidden>syntax, argdown, write, edit, undercut, contradiction, premise, conclusion</p>

Argdown is line-oriented. Four things make up a reconstruction:

```argdown
[a-claim]: The claim, written out.
    + [a-reason]: Something that supports it.
    - [an-objection]: Something that attacks it.
```

- `[name]: text` — a **statement**: a claim, named so it can be referred to again. Write the text
  once; afterwards `[name]` on its own points at it.
- `<Name>: text` — an **argument**: a named inference, which can carry a premise-conclusion
  structure.
- `+` and `-` — **support** and **attack**. **Indentation decides direction, and it runs child →
  parent.** A reason is written *underneath* what it bears on.
- `#tag` — a **hashtag**: whose claim this is (see <a data-help="Whose claim is this?">Whose
  claim is this?</a>).

Two more relations, for the two things support and attack cannot say:

```argdown
<The inference>
    _> <What the race-course shows>

[Accepting A and B compels Z]
    >< [Neither reader is compelled]
```

- `_>` — an **undercut**: the claim or argument above denies that the step goes through, whatever
  its premises. Written `<_` the other way up. Drawn dashed and orange.
- `><` — a **contradiction**: the two cannot both be true. Drawn dotted and violet.

The editor helps with the mechanics, so the argument gets your attention instead:

- **Typing `[` or `<` offers every title the map already defines** — statements after `[`,
  arguments after `<` — because pointing at a claim again is how the structure is built, and
  a title retyped from memory is a title misspelled. Pick one with the arrow keys and
  <kbd>Enter</kbd>, or just keep typing.
- **`[`, `{`, `(` and `"` close themselves** behind the caret; typing the closing character
  skips over it. `<` does not, deliberately — `<+` and `<-` open relation lines.
- **<kbd>Enter</kbd> keeps your indentation level**, because a level is a claim's place in the
  argument, not a style choice; a blank line ends a block, so after one the margin returns.
  <kbd>Tab</kbd> indents by four, the house step.
- **Where a line does not parse, the margin says so on the line**, with the real Argdown
  parser doing the judging — plus warnings for the traps that parse cleanly and mean the
  wrong thing, which are worse.
- **A mechanism is checked as you write it.** Inside a step's `{causes: …}`, or the front matter's
  `mechanism:` block, a key the profile does not know (`sgn:`), a value not in its list
  (`on: stocks`), or a state, actor, chain or level that is not declared (`from: droght`) is marked
  where it is written, with what it may have meant — the same faults, in the same words, that the
  checker reports. A query (the checker asks; it may be right as it is) is marked more quietly.
- **Completion knows the vocabulary.** Inside `{causes:`, the keys with what each means; after
  `from:`, `to:`, `via:`, `unless:` and the like, the declared states with their labels; after
  `sign:` or `on:`, the values, with what each draws. <kbd>Ctrl-Space</kbd> asks for the list.
  Rest the pointer on a state's id to see its label, actor and role, or on a key to see its meaning.
- **Under each step, a line says in words what it means** — “Drought” raises “Migration” ·
  asserted · chain: drought — in the words the Mechanism view will draw it with. A step that means
  something other than what you meant shows it there, at once. With **{…}** folding the metadata
  away, the claims and what each step says are left on one screen. **↳ steps** in the Argdown pane
  switches these lines off and on.

**THE MOST EXPENSIVE MISTAKE IN THE LANGUAGE** is writing a relation the wrong way up. Both
parse; only one is what you meant.

<pre class="hx">[thesis]: The claim.          <span class="ok">RIGHT — the objection attacks the thesis</span>
    - [objection]: Why not.

[objection]: Why not.         <span class="bad">WRONG — this says the THESIS attacks the OBJECTION</span>
    - [thesis]</pre>

The tell is on the map: an objection with nothing flowing out of it is inverted, every time. If
you want an objection to have its own block for replies, re-open it afterwards rather than nesting
the thesis under it.

A **premise-conclusion structure** numbers the steps. Premises of one step are *linked* — all
needed — which is why the map gathers them onto a bar:

```argdown
<The Argument>: what it shows.

(1) [first-premise]
(2) [second-premise]
-----
(3) [conclusion]
```

An inference line can also name the rule it relies on and say **which lines it uses**:

```argdown
(1) [jurisdiction]
(2) [advice-unlawful]
(3) [founded-on-null-is-null]
-- Modus ponens {uses: [2, 3]} --
(4) [order-is-null]
-- {uses: [1, 4]} --
(5) [not-prorogued]
```

`uses` matters because a premise is written where the text reaches it, which need not be where
the argument needs it. Here (1) is stated first and used *third*. Without `uses` the map assigns
each step the premises standing immediately above it, which would make (1) an input to the first
step, where it does no work at all. Declared, `uses` wins; whatever it leaves unclaimed is filled
in by position.

A rule name is a claim that the conclusion follows, and Ipsissima checks it — see
<a data-help="Is a step valid?">Is a step valid?</a>

The Argdown pane's **1,2,3** switches line numbers on and off, and **{…}** folds every claim's
metadata away so the argument's shape shows. In the app, **Edit ▸ Find in the Argdown…**
(<kbd>Cmd/Ctrl-F</kbd>) searches it.

### What breaks a file without saying so

- **`--` instead of `-----`** — a lone double hyphen opens an *expanded inference* and eats the
  next line as its name. The claim below it vanishes from the map, the file still parses, and
  nothing is reported. Always `-----`.
- **an underscore inside a word** — `map_0_30` opens an italic range. Unpaired it stops the file
  parsing; paired it quietly italicises and mangles the name. Escape it as `\_`.
- **`.A.` `.E.` `.v.` `.->.`** — symbol shortcodes, substituted *anywhere*, headings included. A
  heading `# III.A. The Types` becomes `III∀ The Types`, and every reference to it then fails to
  match. Write `III.A` with no trailing dot.
- **a bare `[name]` in prose** — read as *defining* that statement, not mentioning it. To mention
  one inside a sentence, write `@[name]`.
- **a file name beginning with `_`** — silently ignored by the Argdown tools. Name it
  `my-map.argdown`, not `_map.argdown`.

The editor marks the first three as you type. The rest show up on the map: check the **Argdown**
pane against what you expected to see.

## Recording where a claim came from

<p class="also" hidden>metadata, fidelity, warrant, pinpoint, page, source, chapter, echoes</p>

Metadata in braces records where a claim came from and whose words it is. It is what makes the
**Exposition** arrangement and the source links work.

```argdown
[a-claim]: The claim.
    {chapter: "source/paper.md", fidelity: "quotation", pinpoint: "p. 12",
     source: "\"the author's exact words\"", reviewed: "2026-08-20"}
```

- `chapter` — the file the claim was drawn from, relative to the `.argdown`
- `fidelity` — whose words these are: `quotation`, `paraphrase`, `compression`,
  `interpretation`, `imputation`. The map draws it as the box's border
- `source` — the author's exact words, which the checker finds in the text
- `pinpoint` — the printed page, `p. 12` or `pp. 12–13`; the checker reports a quotation whose
  words are not on the page it cites
- `echoes` — the other places the text states the claim (see <a data-help="Reading in the text's
  order">Reading in the text's order</a>)
- `note` and `comment` — the reconstructor's note and a reader's comment (see
  <a data-help="Comments and notes">Comments and notes</a>)
- `formalization` — what a claim *is*, in the notation the validity check reads (see
  <a data-help="Is a step valid?">Is a step valid?</a>)

Press **{…}** in the Argdown pane to fold all of it away and see the argument's shape.

Two of the fidelity levels are departures from the text and owe a reason, which `warrant` gives:

```argdown
[a-claim]: A premise the argument needs.
    {fidelity: "imputation", warrant: "enthymeme"}
```

| `warrant` | the reading is taken because |
|---|---|
| `enthymeme` | the argument is invalid without it and plainly relies on it |
| `hyperbole` | it reads as overstatement rather than as the position |
| `sloppy-phrasing` | it reads as imprecise expression of a different claim |
| `secret-sign` | it reads as a signal to knowing readers rather than at face value |
| `other-texts` | the author says so elsewhere |
| `coherence` | it makes the surrounding text hang together |
| `convention` | it is the field's standard reading of this passage |

The list is a **prompt, not a vocabulary**. Any other value is accepted and shown as written: the
point is that a reason was recorded, not that it fell into a taxonomy. An `imputation` with a
warrant is a reading; one without is a guess.

## Comments and notes

<p class="also" hidden>comment, comments, note, notes, margin, annotate, annotation, delete</p>

Two hands write in the margin of a reconstruction, and the map keeps them apart:

```argdown
[a-claim]: The essay's central move.
    {comment: "Interesting. Try reading Frankfurt on this to deepen it."}
    {note: "The essay never states this premise; it is imputed."}
```

- `comment` <span style="color:#b5179e">■</span> — a remark *on* the argument: a tutor reading a
  student's essay. It marks the claim's **top-right** corner.
- `note` <span style="color:#8a6d1f">■</span> — the reconstructor's own: why a reading was taken,
  what the map cannot show. It marks the **top-left** corner.

A claim carrying both is marked on both sides. Both appear in the **Notes** pane too, where
clicking one lights the claim and opens its passage. The pane's filter shows all of them, or
comments or notes alone.

<div data-build="editor">

**Writing a comment.** Right-click a claim and choose **Add comment**, or **Edit comment** on one
that has one; the comment is written into the `.argdown` for you. **Delete comment**, in the same
menu, asks first, and Undo (<kbd>Cmd/Ctrl-Z</kbd>) brings it back. **Delete all comments**, at the
foot of the Notes pane's list, clears them all, and Undo brings those back too.

</div>

**Neither becomes a claim on the map.** A comment is about the argument but is not a move in it:
"try reading Frankfurt on this" drawn as a claim would say the essay contains that move. An
*objection* is different — that is a move, and belongs on the map as `- [an-objection]`.

## Saving and undoing

<p class="also" hidden>save, save as, undo, redo, edited, unsaved</p>

<div data-build="editor"></div>

**Save** (<kbd>Cmd/Ctrl-S</kbd>) writes the reconstruction back where it came from. **Save as…**
writes it somewhere else and goes on editing *that* file, which is what you want before a
substantial revision. In a browser that cannot choose where to write, Save offers the file as a
download instead and says so. Until you save, **● edited** beside the title says there are
changes the file does not have yet.

**Undo** (<kbd>Cmd/Ctrl-Z</kbd>) and **Redo** (<kbd>Cmd/Ctrl-Shift-Z</kbd>) take back an edit and
put it back: a claim typed, a quotation made from the text, a comment added or deleted. They are
in the title bar, and in the application's Edit menu. Opening another file starts a fresh history.

# Sharing and storing

## Sending a map to someone

<p class="also" hidden>export, share, send, word, docx, markdown, download, web page</p>

The **Export** button in the Notes pane offers four things (in the application also **File ▸
Export…**, and on the web in a claim's right-click menu), and the right one depends entirely on
what the reader on the other end has. All four ask where to put the file rather than dropping it
in Downloads — the annotated text belongs beside the text.

- **Word (.docx)** — the text itself, with the margin marks as **real Word comments** beside the
  passage each one is about. What a student opens without being told how.
- **Markdown (.md)** — the same, with the marks as quoted asides under each paragraph.
- **Reconstruction with its text (.argdown)** — one file holding the reconstruction *and* the text
  it is of. Still an ordinary `.argdown`: the text travels at the end of it, written as comments
  the parser ignores, so it opens here, stays editable, and saves back as one file. For anyone who
  has this program.
- **Reconstruction as a web page** — a copy of *this page* with the whole thing inside it: map,
  text, margins. They double-click it. Nothing to install, nothing to unzip, no folder to point
  anything at. It is a reading copy: everything this page does, apart from parsing a new file and
  editing one.

A file that carries its text this way says so — **+ text** beside the file name in the Argdown
pane. That copy is a snapshot taken when the file was made, so if the real manuscript is open
beside it in a folder, the folder wins.

## Your Zotero highlights

<p class="also" hidden>zotero, highlights, highlight, annotations, library</p>

If you read and mark your library in **Zotero**, your marks can appear here too — without ever
becoming a second copy. A text converted out of your Zotero library carries the name of the
attachment it came from in its own front matter (`zotero:`, written by the converter from the
path it actually read), and in the **desktop application** the Manuscript header then offers a
**Zotero highlights** button. Pressing it asks Zotero — running on this same computer — for
your highlights of exactly this file, and paints each one **on the very words you marked**,
in its Zotero colour — a wash for a highlight, an underline for an underline — starting and
stopping where your pen did, even in the middle of a long paragraph. A note, which has no
words of its own, appears as a bar in the left gutter at the beginning of its printed page,
and so does any mark whose words this conversion cannot pin down. The exact words, any
comment, and the printed page ride the hover. Pressing the button again puts them away.

The marks stay **Zotero's**: Ipsissima displays them and keeps no copy, so there is nothing to
drift out of sync. The button is the **only** thing that makes the application speak to Zotero,
and that conversation never leaves your machine. A highlight whose words cannot be found in this
converted text is **counted, not dropped** — the note at the top of the Manuscript pane says how
many placed and how many did not. (An area highlight — a rectangle over a figure — carries no
words to find, and is counted separately.)

If the button reports that Zotero is not answering: Zotero has to be running, and *Allow other
applications on this computer to communicate with Zotero* switched on in its
Settings ▸ Advanced.

The conversation runs the other way too. Select a passage in a text that came from Zotero and
a button appears above it: **Highlight in Zotero** (beside Quote and Paraphrase when you are
writing the map, on its own when you are reading one). The mark is created *in Zotero*, on the
PDF itself, at the exact rectangles where those words are printed — the conversion wrote a
small geometry file beside the text for precisely this — and it lives only there: press
**Zotero highlights** and it comes back like any mark you made in Zotero's own reader.
Zotero asks your permission the first time, by name, revocably. A conversion made before
this feature carries no geometry file; the button says so and writes nothing — reconvert
the PDF to enable it.

## Storing the reconstruction in Zotero

<p class="also" hidden>zotero, store, attach, sync</p>

**File ▸ Store in Zotero…**, in the application, places this reconstruction under the very item
its source came from, as **one attachment**: the `.argdown` as a bundle, every cited source
carried inside it — still a valid Argdown file, so a double-click in Zotero opens it here, text
and map together, and Zotero's own sync carries it to your other devices. Nothing is stored
except on this gesture, and the first time Zotero itself asks — a dialog naming Ipsissima, with
*Allow*, *Always Allow* and *Deny* — and the grant stays revocable in Zotero's Settings ▸
Advanced. Choosing plain *Allow* grants one write's worth of trust, so a store of several steps
may ask more than once; *Always Allow* is the natural answer for a workflow you have adopted, and
Ipsissima and its MCP tools share the one grant. Storing again replaces the stored copy, never
duplicates it, and a copy someone else changed in the meantime is refused rather than
overwritten.

# Reference

## The controls

<p class="also" hidden>bar, controls, slider, switch, how much, spine, sections, hashtags, untagged</p>

Along the bottom of the map, left to right:

- **Study** — study mode: see <a data-help="Studying a map">Studying a map</a>. Lit while it
  is on; press it again to end it.
- **how much** — a slider: how many levels of reasons are showing, from the main claim
  outwards. Its rungs are *main claim*, *+ reasons*, *+ detail* and *everything*; the name of the
  rung you are on sits beside it, with the number of boxes it puts on screen. In Exposition the
  first rung is the *précis*, one claim per section, and a text in several files adds *by
  chapter*, every file shut into one block. The arrow keys step it.
- **claims** — **Short** gives the first few lines with a "more" link; **Full** gives every
  claim's whole text.
- **flow**, in Exposition only — **Rows** lays the paragraphs side by side, wrapping like lines of
  prose; **Column** gives every claim a row of its own, top to bottom as the text runs.
- **Shape**, in Exposition only — whether each claim's reasons come before it or after, and how
  far they reach: see <a data-help="Where do the reasons fall?">Where do the reasons fall?</a>
  Off until you ask for it.
- **sections** — **Folded** shuts every section into a block, **Open** opens every one. When some
  are folded and some open, neither is lit, and resting on *sections* says how many are folded.
- **spine** — **All** shows every claim; **Load-bearing** shows only those the argument rests on —
  remove one and part of the argument loses its route to the main claim. The number is how many
  qualify.
- **hashtags** — switch a hashtag off to take those claims off the map. The number is how many
  carry it. This control appears only when the file uses hashtags at all.
- **Untagged**, at the end of the same row — every claim the file did not tag. **This is usually
  the switch that changes the picture.** Most reconstructions tag sparingly, so switching the
  hashtags off one by one leaves the bulk of the map exactly where it was; switching *Untagged*
  off leaves only the claims that carry a tag, which is how you see the authorities, or the
  reported views, on their own. On the Miller map that is 22 claims out of 66.
- **Appraisal** — the reconstructor's own additions: see <a data-help="The reconstructor's
  appraisal">The reconstructor's appraisal</a>
- **⌄** — folds the bar away to a small chip, which brings it back

While switches hide claims, the bar says how many: *12 claims hidden by switches*. Switching
everything off, hashtags and untagged alike, leaves the map empty. That is the filter doing what
it was told rather than a fault, and the controls all read *off* so you can see why.

**how much** and **spine** answer different questions and both are worth having. *how much* is
distance: how far out from the main claim a claim sits. *spine* is load: how much rests on it. A
claim five steps out that holds up twenty others is the spine of the argument and the distance
ladder reveals it last.

In the title bar: the three arrangements (<a data-help="Three arrangements of the same
claims">Three arrangements of the same claims</a>), the four panes and **Layout** (<a
data-help="Laying out the panes">Laying out the panes</a>), **Open…**, **Fit**, **Full screen**
on the web, and **How to use**. When the window is narrow the buttons drop their words before
anything drops off the screen; resting on one says what it is.

## Keyboard and mouse

<p class="also" hidden>keyboard, shortcuts, keys, mouse, escape</p>

**On the map**

- **Scroll** to zoom, **drag** to pan, **Fit** to see it all
- <kbd>Cmd/Ctrl =</kbd> and <kbd>Cmd/Ctrl −</kbd> zoom in and out, and <kbd>Cmd/Ctrl-0</kbd> fits —
  in Reasons, Exposition and Mechanism alike (in a browser, not while you are in the Argdown or the
  Manuscript, where they zoom the page as usual)
- <kbd>Tab</kbd> moves between claims and their badges; <kbd>Enter</kbd> or <kbd>Space</kbd>
  selects a claim or presses a badge
- <kbd>Shift</kbd>+<kbd>Enter</kbd> on a claim, **double-click** or <kbd>Shift</kbd>**-click** —
  go to its passage in the text
- <kbd>Shift</kbd>+<kbd>F10</kbd> or the context-menu key on a claim — the same menu a
  right-click opens
- The arrow keys step the **how much** slider once it has focus

**Everywhere**

- <kbd>Esc</kbd> puts away one thing at a time — a dialog, a menu, the key, this panel, the
  abstract, a comparison, the guide, full screen — the topmost first
- <kbd>Cmd/Ctrl-S</kbd> saves and <kbd>Cmd/Ctrl-Z</kbd> undoes, where the build can edit

**In the application**

| | |
|---|---|
| <kbd>Cmd/Ctrl-1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Reasons, Exposition, Mechanism |
| <kbd>Cmd/Ctrl-Alt-1</kbd> to <kbd>4</kbd> | the Map, Argdown, Notes and Manuscript panes |
| <kbd>Cmd/Ctrl-0</kbd> | fit the map to the window |
| <kbd>Cmd/Ctrl =</kbd>, <kbd>Cmd/Ctrl −</kbd> | zoom in, zoom out |
| <kbd>Cmd/Ctrl-O</kbd>, <kbd>Cmd/Ctrl-Shift-O</kbd> | open a file, open a folder |
| <kbd>Cmd/Ctrl-N</kbd>, <kbd>Cmd/Ctrl-Shift-N</kbd> | a new reconstruction, a new debate map |
| <kbd>Cmd/Ctrl-S</kbd>, <kbd>Cmd/Ctrl-Shift-S</kbd> | save, save as |
| <kbd>Cmd/Ctrl-Z</kbd>, <kbd>Cmd/Ctrl-Shift-Z</kbd> | undo, redo |
| <kbd>Cmd/Ctrl-E</kbd> | export |
| <kbd>Cmd/Ctrl-F</kbd> | find in the Argdown |
| <kbd>Cmd/Ctrl-/</kbd> | How to use |

## Map details

<p class="also" hidden>statistics, counts, numbers</p>

For checking a file.

<div class="stats" id="helpstats"></div>
