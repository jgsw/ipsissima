<!--
  help.md — everything behind the "How to use" button.

  EDIT THIS FILE, not the template. It is rendered by the same markdown-it that draws the
  manuscript pane, and inlined into the page by build_argdown_viewer.mjs.

  TWO RULES, and only two:

    * `##` starts a new TOPIC. The contents list is built from these, in this order, so adding a
      topic is adding a heading. `###` and `####` are subheadings inside a topic.
    * Everything above the first `##` stays on the contents page, under the title.

  Raw HTML is allowed here (this is our own text, unlike a manuscript), and four ids are filled
  in by the program at runtime and must survive any rewrite: `relkey`, `fidkey`, `helpstats`,
  and the `about*` ids in the last topic. Deleting one of those does not break the page, but the
  thing it was showing silently stops appearing.

  Fenced ```argdown blocks are set in ArgVu, so the relation symbols draw as arrows.
-->

*ipsissima verba* — the very words themselves. Scholars of the Gospels use it against
*ipsissima vox*, the authentic voice: did he say *these words*, or is this a faithful report of
what he meant? That is the distinction this tool keeps — every claim marked for how far it stands
from the words it came from, and every quotation checkable against the page it was taken from.

New to it? **Take the walkthrough** — the first entry below. Two minutes, and it runs on the
reconstruction you have open. It offers to run again next time; if you said no, it lives here.

## Reading the map

Every box is one claim. Arrows run *from a reason to what it bears on*, so an arrow points at the
claim it is about.

## Moving around

- **Scroll** — zoom in and out
- **Drag** — pan across the map
- **Click a box** — nothing is hidden; click its **⊕** to show or hide the reasons for it
- **Click a section** — fold it into a single block, or open it again
- <kbd>Esc</kbd> — leave full screen, or close this panel

Opening a section shows the claims it starts from, each still folded — one level per click, so a
section of forty claims never lands on you at once.

## The two arrangements

Both are the argument. What differs is what *orders* the claims — the order of reasons, or the
order of exposition.

- **Reasons** — the main claim at the apex, and beneath it what supports or attacks it, level by
  level
- **Exposition** — the same claims, placed where they occur in the text: file by file, section by
  section, in reading order

<p id="helpArrangeNote">They are the same claims twice over. <b>Exposition</b> answers a different
question: not <em>what holds this up</em> but <em>where does the reader meet it</em>. A long arrow
there is a claim and its support far apart in the text.</p>

The **Map**, **Argdown**, **Notes** and **Manuscript** buttons beside them are something else
again — those are panes, and any combination of them can be open at once.

## What the lines mean

<div class="key" id="relkey"></div>

<p id="helpEdgeNote">In <b>Exposition</b> a line also says <em>which way it reaches</em>. Colour
still means what it means above — the arrangement never changes what a line <em>is</em> — but the
weight of the ink says when its support arrives:</p>

- **Solid** — the reasons were already given by the time the claim was made. Nothing is owed.
- **Pale** — the claim is asserted *before* its justification arrives. At the point you meet it,
  it is provisional: you are being asked to carry a promise.
- **Heavier** — the relation reaches a long way across the text, whichever direction it runs.

Weight of ink means the same thing here as it does on a claim's border: how firmly established
this is. A quotation is drawn solid and an imputation dot-dashed, and a justification still owed
is drawn pale for the same reason.

Only relations that reach further than about a twelfth of the reconstruction are marked this way.
Most support sits a line or two from what it supports, and that is not a finding about the text,
it is how prose works. Small arrowheads along a line show its direction where there is room.

## Justificatory debt

A claim has to be justified, and there are only two places its justification can sit: before it in
the text, or after. If it comes after, the reader is asked to accept the claim now and take the
reasons on trust — a **justificatory debt**, carried from the moment the claim is made until the
argument for it arrives.

Neither is a fault. Stating a thesis and then arguing for it is ordinary practice; so is building
the case and letting the conclusion land at the end. What matters is how much a reader is asked to
carry, how far, and whether it is ever discharged.

So each band carries a **sparkline**, and the whole reconstruction has one in the footer beside the
claim count. It is a ledger, read left to right through the text:

- **below the line** — claims asserted here whose reasons come later: debt incurred, and the
  reader carries it until the argument arrives
- **above the line** — claims made here that their reasons have already earned: nothing owed

Debt below, as on any ledger. The horizontal axis is already the text, so *forward* means
rightward; height is left free to say something else, and what it says is what is owed.

Each mark is weighted by how far its relations reach, so line-to-line support barely registers and
a reach across half the paper dominates. A band with nothing long-range to report shows no
sparkline rather than a flat line.

A band's mark is **rebased onto its own stretch of the text**, so a section's sparkline is a
close-up of that section rather than the whole paper with one blip in it. The heights are relative
too — each mark is scaled to itself, so a short section is not a flat line beside a long one.

Beside the footer's mark is the same thing in words — *converges late*, *settled early*, and the
point in the text where the weight of the argument falls. Hovering gives the percentage.

On the reconstructions that come with Ipsissima, Williams's *Internal and External Reasons*
settles at 73% of the way through the text and Horton's *Aggregation, Risk and Reductio* at 42%.
Their sparklines say it without words: Horton opens deep below the line — the claims are stated
first and the reader carries them — and climbs out across the first third. Williams runs near the
line for most of the paper, earning each step as it goes, and then rises sharply at the very end
as the contention arrives already paid for.

## Whose words are these

A reconstruction cannot otherwise distinguish the source's words from the reconstructor's. The
border of each box says which:

<div class="key" id="fidkey"></div>

Hover any box to see its level named. Unmarked claims are drawn plain.

## Whose claim is this

A different question, and the border does not answer it. *Whose words* is one thing; *who is
putting this forward* is another, and a map loses it where prose keeps it easily — "Hume holds…",
"even granting that…", "one might object…". Without it a reader cannot tell a position the author
holds from one the author is attacking.

So a claim may carry a **hashtag**, and three of them recur often enough to mean the same thing in
every reconstruction:

| | the claim is |
|---|---|
| *(no hashtag)* | **the author's own, asserted.** The common case |
| `#reported` | **a view the author sets out but does not hold** — an opponent's position, a rival hypothesis, the theory under examination |
| `#conceded` | **something the author grants tells against them** — a counterconsideration, or a scope limit the author sets on their own thesis |
| `#contested` | **an objection that is not the author's** — a critic's, or the reconstruction's own |

Each names something the shape of the graph cannot: nothing about how a claim is wired reveals
that it is Hume's rather than the paper's. On the Tooming reconstruction thirty claims are
`#reported`, and without the hashtag every one of them would read as something the authors believe.

A file may use any hashtag it likes and Ipsissima will show it — these three are a convention, not
a fixed list. The **hashtags** control lists whatever the file actually contains, and does not
appear at all when it contains none.

## The controls

- **how much** — how many levels of reasons are showing, from the main claim outwards. The number
  on each button is how many claims it puts on screen.
- **sections** — whether the argument's sections are folded into blocks or opened out
- **hashtags** — switch a hashtag off to take those claims off the map. The number is how many
  carry it. This control appears only when the file uses hashtags at all.
- **full claims** — show every claim's whole text, rather than the first few lines with a "more"
  link

## Opening a reconstruction

**Open a file.** Ipsissima reads the folder it sits in, so the manuscript comes with it — you do
not have to find and open the folder yourself. Double-clicking a `.argdown` in Finder or Explorer
does the same thing.

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

```argdown
chapters:
  - "source/01-intro.md"
  - "source/02-cases.md"
```

Without one, the order is the order the reconstruction itself cites them in, which is right for a
single paper and is the reconstructor's own sequence for several.

**Open a folder** instead when there is no `.argdown` yet, or when you want to pick the folder
rather than hunt for the file inside it. It is the same result either way.

**Start a new one** when there is nothing to open. It is on the panel Ipsissima shows when no file
is loaded, and in **File ▸ New Reconstruction** in the app. What appears is a small working
skeleton — a claim, the argument for it, an objection, two premises — with a border of each kind, so
the vocabulary the map draws with is on screen before you have written anything. Type over it. It
unloads whatever is open, and asks first if there is anything unsaved.

**Save** writes the reconstruction back where it came from. **Save as…** writes it somewhere else
and goes on editing *that* file, which is what you want before a substantial revision. In a browser
that cannot choose where to write, Save offers the file as a download instead and says so.

## The claim and its source

**Manuscript** opens the text beside the map. Drag the divider to give it more or less of the
window. The pane is there in both arrangements: beside **Argdown** it is what lets you check a
`source:` quotation against the source without leaving the page.

- **Double-click a claim** — jump to the passage it was drawn from
- <kbd>Shift</kbd>**-click a claim** — the same
- **Right-click a claim** — **Go to source**, from a menu
- **Click a claim** — marks it as the one you are working on
- **Click a passage** — the other way round: every claim drawn from that paragraph lights up on
  the map. If they are folded away they are opened, and if they all fit on screen the map moves
  to them.
- **Click a `[claim]` in the Argdown** — lights it on the map and shows its passage

The note above the passage says how precisely the claim was placed — *found by its quotation* is
exact, *the paragraph it came from* is as close as an unquoted claim can be pinned. A claim
located only to its file has no line to highlight, and says so.

The two marks come off separately. Clicking the map's background clears the mark on the map;
clicking past the passage in the manuscript clears the mark there. Neither touches the other, so
you can keep a claim marked while reading around it in the text.

Clicking a passage answers with *every* claim it produced, not the nearest one. Across the
reference maps 57% of placed claims share a line with another — a claim pinned to its paragraph
carries that paragraph's first line — so "the closest" would be a choice between several the tool
has no way to make.

## Linked and independent reasons

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

## A line behind a claim

…is drawn dashed across it. In **Exposition** a reason several sections away is a long line with
whatever the text put in between sitting on top of it, and a line re-emerging at a box's edge
would otherwise look exactly like a line starting there. The broken stretch says the claim it
crosses has nothing to do with it.

## Writing Argdown

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
- `+` and `-` — support and attack. **Indentation decides direction, and it runs child → parent.**
  A reason is written *underneath* what it bears on.
- `#tag` — a kind of claim. The map colours by these and the **kinds** buttons filter on them.

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

## Writing in the margins

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
clicking one lights the claim and opens its passage.

**Neither becomes a node**, and that is deliberate. A comment is about the argument but is not a
move in it: "try reading Frankfurt on this" drawn as a claim would say the essay contains that
move. An *objection* is different — that is a move, and belongs on the map as `- [an-objection]`.

## Sending it back

The **Export** button in the Notes pane offers four things, and the right one depends entirely on
what the reader on the other end has. All four ask where to put the file rather than dropping it
in Downloads — the annotated essay belongs beside the essay.

- **Word (.docx)** — the essay itself, with the margin marks as **real Word comments** beside the
  passage each one is about. What a student opens without being told how.
- **Markdown (.md)** — the same, with the marks as quoted asides under each paragraph.
- **Reconstruction + essay (.argdown)** — one file holding the reconstruction *and* the text it is
  of. Still an ordinary `.argdown`: the essay travels at the end of it, written as comments the
  parser ignores, so it opens here, stays editable, and saves back as one file. For anyone who has
  this program.
- **Reconstruction as a web page** — a copy of *this page* with the whole thing inside it: map,
  essay, margins. They double-click it. Nothing to install, nothing to unzip, no folder to point
  anything at. It is a reading copy: everything this page does, apart from parsing a new file and
  editing one. Somebody who wants to answer back opens the reconstruction in Ipsissima itself,
  which is a browser tab or an application rather than a copy frozen into the file you sent.

A file that carries its text this way says so — **+ essay** beside the file name in the Argdown
pane. That copy is a snapshot taken when the file was made, so if the real manuscript is open
beside it in a folder, the folder wins.

## Provenance

Metadata in braces records where a claim came from and whose words it is. It is what makes the
**Exposition** arrangement and the source links work.

```argdown
[a-claim]: The claim.
    {chapter: "source/paper.md", fidelity: "quotation",
     source: "\"the author's exact words\"", reviewed: "2026-08-20"}
```

`fidelity` says whose words these are — `quotation`, `paraphrase`, `compression`,
`interpretation`, `imputation` — and the map draws it as the box's border. Press **{…}** in the
Argdown pane to fold all of it away and see the argument's shape.

## Map details

For checking a file.

<div class="stats" id="helpstats"></div>
