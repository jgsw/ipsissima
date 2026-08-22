---
name: argdown
description: Write, edit and validate Argdown (.argdown) files — argument reconstruction in the Argdown language from argdown.org. Use whenever creating or editing a .argdown file, reconstructing an argument from prose into premises and conclusions, building an argument map, or when the author mentions Argdown, argument maps, argument reconstruction, or asks to formalise the structure of an argument. ALWAYS validate with the local Argdown CLI before reporting the work as done.
---

# Argdown

Argdown is a Markdown-like language for argument reconstruction. It looks simple and is easy to
get subtly wrong — the parser is strict about paragraph structure in ways that are not obvious.

## The non-negotiable: validate, never assume

**Never declare an .argdown file finished without running the CLI over it.** Writing Argdown from
memory produces files that look right and fail to parse. This happened: a 380-line file was
delivered with 83 tree-breaking blank lines and was rejected by the first line of the VS Code
extension's validation.

```bash
python3 .claude/skills/argdown/check_argdown.py "<file>.argdown"
```

That wraps the CLI and adds the checks that catch the mistakes parsing does not: disconnected
nodes, what the apex actually is, silently-rewritten section headings, node counts per selection
mode, and the tag census. **Parsing clean is necessary, not sufficient** — a file can parse
perfectly and still be four disconnected trees with a corrupted heading.

The raw validate, if you only need the exit code:

```bash
CLI="app/node_modules/.bin/argdown"
"$CLI" map "<file>.argdown" --format dot > /dev/null   # exits non-zero on syntax errors
```

Installed at `app/` (`@argdown/cli`, Node ≥ 18).
If missing: `cd app && npm install @argdown/cli`.

The CLI is the ground truth. It is the same parser the VS Code extension and argdown.org use,
so a file that passes here passes for the author.

## The pipeline, and what it costs

**Converting an article is mechanical and must not be re-invented per paper.** It was, twice, and
writing the second converter cost more than the reconstruction it existed to serve. The machinery
lives in `mcp/src/ipsissima_mcp/pdf_to_source.py`; a paper's own
`convert_source.py` is a config block and a docstring saying what liberties THIS paper needed.
The Gettier one went from 384 lines to 82 that way, and reproduces its source byte for byte.

```python
from pdf_to_source import Config, convert, print_report
print_report(convert(Config(pdf=..., out=..., first_page=121, page_label="Analysis",
                            end_marker="Wayne State University", headings=[...],
                            own_headings={"Case I:": "Case I"}, repairs=[...])))
```

It works out columns, the left-edge bands, running heads, footers, page numbers and footnotes for
itself, and **reports every one** — read the report rather than the code. Two things it will not
do, both deliberate: it refuses to guess when a page uses more than two indent levels (no counting
rule survives both papers, so it prints the levels and asks), and it never invents a missing word.

**Start a paper with one command.** It builds the folder, writes the converter, `_quarto.yml`, a
skeleton and a README stub, converts, and prints the report:

```bash
python3 "mcp/src/ipsissima_mcp/new_reconstruction.py" \
    "/path/to/paper.pdf" "Author YEAR - Short title" \
    [--start "1. Introduction"] [--end "References"]
```

Run it bare first, read the report, then re-run with `--start`/`--end` — those two are the only
things a page cannot tell you. Re-running never overwrites the converter or the `.argdown`.

**Declare provenance once, in front matter.** `chapter` is the same on every claim of a
single-source map and `reviewed` is the date of the pass; together they are about 15% of a
finished file, retyped per claim and stale the moment a file is renamed:

```argdown
===
defaults:
  chapter: "source/the-paper.md"
  reviewed: "2026-08-18"
===
```

Anything written on a claim still wins, so a map drawing on two sources says which is which where
it matters. **`section` is only needed where a claim has no `source:` quotation** — a verified
quotation already pins the exact line, and a section can only narrow a search that is finished.
Measured on the Darwin map: 15% smaller, byte-identical results.

**Four rules that keep a reconstruction cheap. Each was learned by paying for its absence:**

1. **Detector first, images second.** Run the conversion, read the stretch report, and render page
   images ONLY for the lines it flags — a crop, not the page. Proofreading five whole pages to
   check three damaged lines cost about ten thousand tokens and found nothing the detector had not
   already pointed at. On a clean text layer, render nothing.
2. **Do not read another reconstruction to learn the house style.** The Williams file is 33 KB and
   the conventions fit on one screen: `[id]: text #tag` then an indented metadata block with
   `chapter`, `section`, `fidelity`, `source`, `reviewed`. Read a *section* of one if unsure.
3. **A short README by default** — the form, the fidelity exceptions, the conversion liberties, and
   what the Manuscript view showed. Three folders already carry the long teaching essay; a fourth adds
   cost and no information.
4. **Reconstruct in one pass, with provenance attached as you write.** Retro-fitting `chapter` and
   `section` means re-reading the source, and a second pass over a finished map costs more than
   the map. `check_argdown.py` prints the coverage; check it before calling the work done.

**Where the money actually goes.** Measured on the Gettier and Darwin maps: orientation reading and
conversion dominated, and the reconstruction — the only part needing judgement — was the smallest
slice. So the mechanical half is worth automating, not delegating to a weaker model; the
judgement half is where a strong model earns its place.

## Fidelity — whose words are these?

A reconstruction cannot otherwise distinguish the source's words from yours. Tolerable when
mapping your own thinking; **not** tolerable when mapping someone else's paper, where the
reconstruction is itself a scholarly claim. Five levels:

| level | meaning | how it is marked |
|---|---|---|
| quotation | the source's exact words, or a light rewording of them — **derived, not declared: see below** | `{chapter: "...", pinpoint: "p.14"}` |
| paraphrase | close restatement in your words | `{fidelity: "paraphrase"}` |
| compression | several sentences reduced to one claim | default when unmarked |
| interpretation | a reading the text supports but does not state | `{fidelity: "interpretation"}` |
| imputation | a premise the argument NEEDS but the author never states | `{fidelity: "imputation"}` |

`imputation` is the category that matters most and the one most often left invisible.

**`quotation` is checked, not believed.** It is the one level with a fact of the matter — either
the claim's own words are in the source or they are not — so `check_argdown.py --source-root`
computes it and reports every claim marked `quotation` whose text is not there, and every claim
whose text IS the source's words but which claims less. Both directions occur.

This became a check because instruction failed. Across the six reference reconstructions **38 of
126 `quotation` markers were wrong**, almost always in the same direction: a claim carrying an
exact quotation in its `source:` field feels like a quotation even when its own text is a
summary, and a solid border then tells a reader of the map that they are looking at the author's
words. Stating the rule in the extraction prompt halved the rate on the next paper and did not
remove it.

The test allows a light rewording — Darwin's "If during the long course of ages…" with the "If"
dropped to make the claim stand alone is still the source's words. It is the difference between
rewording and *summarising* that the check enforces.

**Generated files are corrected; hand-built ones are only reported on.** A reconstruction someone
has worked on is their work and is never written to unasked. A file carrying
`reconstruction: {generated: true}` is different — nobody has judgement invested in whether a
given node is a quotation or a paraphrase, and a file that disagrees with the picture built from
it confuses a reader more than it informs them. So `check_argdown.py` corrects those by default;
`--fix` forces it on any file and `--no-fix` off.

The correction picks its target from the evidence rather than guessing: a demoted claim carrying
a **verified quotation** becomes `paraphrase` (it is a rewording of a specific passage), one
carrying none becomes `compression` (it stands in for gathered material). `interpretation` and
`imputation` are judgements about the reading and are never touched.

Belt and braces: the viewer build derives the border independently, so even an uncorrected file
draws the right picture.

Fidelity cannot be a tag: the adapter reads `tags[0]` only, so a second tag collides with
`#core`/`#objection`. It lives in metadata, and the renderer gives it the **border**, since
colour is already carrying argumentative role:

| quotation | paraphrase | compression | interpretation | imputation |
|---|---|---|---|---|
| solid, thicker | long dash | short dash | dotted | dot-dash, italic title |

The line breaks up as the reconstruction moves further from the source's words. An unmarked
claim is drawn as the plain default, so only deliberate marking shows.

**Quotation is the one level that is checkable, so make it checkable.** Put verbatim material in
quotation marks and give the claim a `chapter`, then:

```bash
python3 .claude/skills/argdown/check_argdown.py "<file>.argdown" --source-root "<manuscript dir>"
```

reads each cited source and reports every quotation that is not there — `exact`, `near` (drift,
with the closest match shown) or `absent`. Run on the book map it found three real provenance
errors on the first pass: a quotation attributed to an empty file, a phrase attributed to a
chapter it is not in, and an invented full stop that turned a mid-sentence fragment into a
sentence. A fidelity marker that is merely asserted is worth very little; this one is falsifiable.

### Verbatim is not the same as faithful

Passing that check establishes less than it looks like. Tom Stern's four illustrations of
**misreporting** — using an author's words to make it seem he is saying something he certainly
is not — quote *accurately* in three cases out of four, and all three would come back `exact`:

- a hedged claim quoted while the author's own unhedged correction, in the same sentence, is
  left just outside the quotation marks;
- a partial claim ("**some** drives do x") quoted in support of a universal one, with the
  "whereas some drives do the exact opposite" that follows it dropped;
- a passage quoted as evidence for a term the passage never uses.

His structural point is that misreporting *advertises* a commitment to meaning through a
recognised meaning-seeking technique — direct quotation — while sacrificing it: the importance
of the currency is assumed in the act of debasing it. A verbatim checker verifies the currency.
It cannot see the debasement, because the debasement is entirely a matter of what the span was
cut away **from**. (His fourth case, words replaced inside the span, needs nothing new: it does
not match, and comes back `near`.)

So `--source-root` also reports, for every quotation that *is* verbatim:

| reported | what it means |
|---|---|
| a leading qualifier outside the span | `some`, `might`, `not` — the word whose loss changes the claim |
| a corrective continuation | the sentence goes on `but…`, `or rather…`, `whereas…` |
| an oversized elision | the two halves of a `…` quotation sit more than ~200 characters apart |
| a term imported into the report | on a `fidelity: quotation` claim, a word of the claim that is nowhere in the cited file |

**None of these is a verdict**, and a quotation that runs to the end of its own sentence says
nothing at all — which is most of them. Measured: 84 quotations across the three sample
reconstructions produced no qualifier or continuation reports whatsoever; the book map produced
two, both quotations that stop just before the author's own "but". Tuned for precision on
purpose: a flag nobody reads is worse than no flag.

### A departure owes a reason: `warrant`

`fidelity` records how *far* a claim sits from the source's words. It does not record **why**
the reading left them, and that is where the reconstructor's own philosophy enters. Mark every
`interpretation` and `imputation` with a one-line `warrant`:

```argdown
[bridge]: What a thing expresses itself as is what that thing is.
    {fidelity: "imputation", warrant: "enthymeme",
     note: "The step the treatise never states and the reading needs."}
```

| warrant | the reading says |
|---|---|
| `enthymeme` | the argument is invalid without it and plainly relies on it |
| `hyperbole` | read as overstatement rather than as the position |
| `sloppy-phrasing` | read as imprecise expression of a different claim |
| `secret-sign` | read as a signal to knowing readers rather than at face value |
| `other-texts` | supported by what the author says elsewhere |
| `coherence` | chosen because it makes the surrounding text hang together |
| `convention` | the field's standard reading of this passage |

A **prompt, not a jail** — any short reason is accepted and simply listed. What matters is that
it was written down, because *the pattern across a file* is the thing worth seeing. Three claims
read as hyperbole is a decision about the author, and nobody notices making it one claim at a
time. Stern's point is that these devices generate the very "openness" a charitable reading then
fills: *because* a claim looks false, it becomes open that it was hyperbole. Keep `note` for the
prose; `warrant` is the slot that can be counted.

### What is this reconstruction trying to be?

The same map can be excellent as a report of what a text says and poor as a reading of what it
should say. Until the aim is declared there is **no fact about which the file is**, and so none
about whether its departures are earned. Declare it once, in front matter:

```argdown
===
reconstruction:
    aim: fit            # fit | appropriation
    unit: meaning       # meaning | commitment
    mode: coherence     # coherence | truth | soundness | agreement | interest
    strength: ordinary  # minimal | ordinary | strong
===
```

`unit`, `mode` and `strength` are Stern's three dimensions of charity, along which the principle
is ambiguous: whether you are disambiguating *words* or fixing a *commitment*; what "best light"
means, given that the coherent reading of a text and the true one are not the same reading; and
how much better than his words the author is assumed to be. The block is scaffolded **commented
out** by `new_reconstruction.py`, because a value nobody chose would sit in the file looking like
a decision — which is the failure it exists to prevent.

`check_argdown.py` then reports the **tension** between what the file declares and what it
contains: a file declaring `aim: fit` whose contentions cannot be reached without imputations is
not thereby wrong, but it has something to answer. It asks for the block only once the map marks
fidelity at all — a map of your own thinking is not yet in this game.

### Interpretive load — whose argument is this?

Per contention, the fewest of the reconstructor's own claims (`interpretation` or `imputation`)
that **any** support route down to a leaf must pass through.

- **0** — some route to the contention runs on reported material alone. Not a score, and not a
  claim that the route is the interesting one.
- **above 0** — *every* route passes through claims the author never made. Stern's "third
  thing", neither the philosopher's words nor the interpreter's own view, made measurable.

A reconstruction whose whole contribution *is* a reading should read above zero everywhere, and
declaring `aim: appropriation` says so. Reported alongside it:

- **load-bearing assumptions** — a departure that nothing supports *and* that something rests
  on. Both halves matter: requiring only "nothing supports it" listed every objection in all
  three samples as though it were a premise the reading rests on, and an objection holds nothing
  up. On the Williams this correctly finds the three candidate meanings plus one imputation —
  which is exactly the joint of an elimination argument.
- **inferences drawn by the reconstructor** — `<Argument>` nodes marked as departures. An
  argument node never appears in the edge graph, so it can never be a leaf and would otherwise
  go unreported.
- **support cycles** — a claim that supports itself by some route. Nothing else here looks for
  this.

## The traps that do NOT announce themselves

The parser is loud about syntax and silent about these. All measured against `@argdown/cli` 2.0.0.

**A FILENAME BEGINNING WITH `_` IS SILENTLY IGNORED — and whether it is depends on where you
run the command from.** `@argdown/node` 2.0.3 defaults to `ignore: ["**/_*", "**/_*/**"]`, and
glob matches that pattern relative to the CURRENT WORKING DIRECTORY. So a file called
`_argument.argdown` is invisible when it sits under the directory you run from, and visible when
it does not. The error is `No Argdown files found at: '<the exact path you just passed>'`, which
reads like the file is missing when you are looking straight at it.

The book's `_argument.argdown` works only because it lives outside this repo. **Name new files
without a leading underscore** — `williams-internal-external.argdown`, not `_argument.argdown` —
and if the book map is ever moved inside a folder you run argdown from, it will stop being found
with no other warning. (`_quarto.yml` is safe: the provenance tools read it directly and never
glob for it.)

**Symbol shortcodes rewrite your text, including headings.** Eight sequences are substituted
wherever they appear:

| `.A.` → ∀ | `.E.` → ∃ | `.~.` → ¬ | `.v.` → ∨ | `.->.` → → | `.<->.` → ↔ | `.P.` → 𝗣 | `.O.` → 𝗢 |

So `# III.A. The Nonrivalrousness of Types` silently becomes `III∀ The Nonrivalrousness of Types`.
Nothing warns you; the file parses; and every `selectedSections: ["III.A. ..."]` and
`folded="III.A. ..."` reference to that heading then fails to match. Section numbering is exactly
where this bites. **Write `III.A The ...` (no trailing dot) or `III A. The ...`.**
`check_argdown.py` flags every occurrence.

**`--` is not the simple inference line — and misusing it can delete a claim silently.** A lone
`--` *opens* an expanded inference whose body is the next line (the rule name), closed by a second
`--`. So in a multi-step PCS:

- one line between the two `--` markers → **parses clean, exit 0, and that line is consumed as the
  inference's rule name.** VERIFIED: a four-statement PCS written this way came back with three,
  the intermediate conclusion gone from the document entirely. Nothing warns you.
- two or more lines → `Invalid inference syntax. Please end your inference with two hyphens (--)`.

Use `-----` at every simple step:

```argdown
(1) Premise.
(2) Premise.
-----                       ← `--` here would silently eat (3) as a rule name
(3) Intermediate conclusion.
(4) A further premise.
-----
(5) Conclusion.
```

**`_` opens an italic range; an unpaired one aborts the parse.** Any prose containing an
underscore — a filename, an identifier like `map0_30`, a variable — must escape it as `\_`.

**A bare `[title]` inside running text is read as a statement definition**, not a reference. To
*mention* a statement in prose, use `@[title]`.

**Metadata values are passed through verbatim.** Inside `{...}`, underscores, asterisks, brackets
and escaped quotes are all safe. That makes metadata the right home for arbitrary quoted prose —
source notes, authorial glosses — that would need escaping in statement text.

**An indented relation runs CHILD → PARENT, and getting it backwards parses fine.** This is the
most costly error in the language, because nothing catches it but a careful reading of the map.
It bit three times in one session.

```argdown
[thesis]: The claim.          // RIGHT: the objection attacks the thesis
    - [objection]: Why not.

[objection]: Why not.         // WRONG: this says the THESIS attacks the OBJECTION
    - [thesis]
```

The temptation is to give a big objection its own top-level block — it feels like a first-class
citizen, and its replies want to nest under it. Resist it: **an objection must be nested under
what it attacks.** If it needs its own block for replies, re-open it afterwards:

```argdown
[thesis]
    - [objection]: Why not.

[objection]
    - [reply]: Why that fails.
```

**The tell is the apex list.** `check_argdown.py` prints the nodes nothing flows out of. An
objection there is inverted, every time — it is receiving attacks instead of delivering them.
Read that list before believing any map, including one an agent hands you.

Useful exports once it validates:

```bash
"$CLI" json           "<f>.argdown" --outputDir "$PWD/json"   # statements, relations, tags, sections
"$CLI" map            "<f>.argdown" --format svg --outputDir "$PWD/svg"
"$CLI" web-component  "<f>.argdown" --outputDir "$PWD/html"   # interactive map + text
```

The flag is **`--outputDir`**, not `--outDir`. `--outDir` is accepted silently and ignored, and
the export lands in the working directory instead — an easy hour to lose.

Use `json` to check the parse matches intent — statement count, relation count, and the
support/attack split are a fast sanity check that nothing was dropped.

## The rule that breaks files

**A FILE OF ONLY COMMENTS DOES NOT PARSE.** A document whose every line is a `//` comment --
a skeleton waiting to be filled in, a map whose claims were all commented out to bisect a
problem -- fails with `Expecting {linebreak}{linebreak} (Empty Line) but found ''`, reported at
**1:1** wherever you actually are. Front matter does not count as content. Leave one real
statement in the file.

**A relation may not start a paragraph.** Blank lines end a paragraph, so a blank line between a
statement and its indented children severs the tree and the file fails to parse.

```argdown
[a]: Parent.        // WRONG — blank line orphans the child

    + [b]: Child.
```

```argdown
[a]: Parent.        // RIGHT — contiguous block, no blank lines inside the tree
    + [b]: Child.
        + [c]: Grandchild.
    - [d]: Objection.
```

Blank lines belong **between** top-level blocks, never inside one. Comments (`//`, `/* */`) may
appear anywhere, including inside a tree, without breaking it.

## Verified rules

Each of these was tested against the CLI, not inferred:

| Construction | Status |
|---|---|
| Metadata on the statement line — `[a]: Text {k: "v"}` | valid |
| Metadata on its own indented line beneath the statement | valid |
| Tags — `[a]: Text #survey` | valid |
| Headings, and `# Heading #tag`, and `# H {isGroup: true}` | valid |
| Frontmatter between `===` fences | valid |
| Undercut `_`, contradiction `><`, `<+` outgoing, `+>` incoming | valid |
| Forward reference — `+ [b]` before `[b]` is defined | valid |
| Argument with a premise-conclusion structure, defined at top level | valid |
| Tag on an argument — `<Arg>: Gloss. #core` | valid (and needed, or arguments vanish from a tag view) |
| Multi-step PCS with `-----` at each inference | valid |
| Arbitrary prose inside metadata — `{note: "he said \"x\" a_b [c]"}` | valid, passed through verbatim |
| Mention in prose — `@[title]` | valid |
| **PCS nested inline underneath a relation** | **INVALID** — define the argument separately and reference it |
| **A lone `--` as a simple inference line** | **WRONG, and often silent** — it opens an expanded inference; the next line is eaten as the rule name. Use `-----` |
| **Bare `[title]` inside running text** | **INVALID** — parsed as a definition; use `@[title]` |
| **Unpaired `_` in statement text** | **INVALID** — opens an italic range; escape as `\_` |
| `.A.` `.E.` `.~.` `.v.` `.->.` `.<->.` `.P.` `.O.` in any text | **silently rewritten** to logic symbols |
| Frontmatter `selection:` vs `--statement-selection` | frontmatter **silently wins** |
| `selectedTags` / `selectedSections` as CLI flags | do not exist — frontmatter only |

## Write for detail; control what is shown

The document is the argument in full; the map settings decide how much of it appears. **Never
simplify the file to get a simpler picture** — reconstruct at full detail, then use selection
settings to produce the view you want.

**Tags are the fold-up dial. `statementSelectionMode` is not.** On a real document, measured on a
138-statement reconstruction:

| Dial | Result |
|---|---|
| `selectedTags: ["core"]` | **135 nodes → 18** — the argument's spine |
| `selectedSections: ["III.D. The Master Argument"]` | 135 → 12 — one section |
| `--statement-selection top-level` | 135 → **135** — no use as an overview |

`top-level` does *not* mean "the main contention alone". It means "statements not used inside any
premise-conclusion structure", which on a real file is nearly everything. (The "1 node" figure in
older notes was measured on a six-statement toy and does not generalise.)

So: **tag load-bearing claims `#core` as you write them, including the arguments** —
`<Master Argument>: gloss #core`. Without tags there is no reliable overview view, and retrofitting
them means re-reading the whole file.

**A frontmatter `selection:` block silently overrides the CLI flag.** With one present, every
`--statement-selection` value returns an identical map. Either leave `selection` out of the
frontmatter and drive views from the command line, or put it in and accept that the file is frozen
at one view. Pick deliberately; the failure is invisible.

There is **no CLI flag for `selectedTags` or `selectedSections`** — those are frontmatter-only.

Other dials: `# Heading {isGroup: true}` makes clusters, which add structure without adding nodes;
`explodeArguments` gives a node per inferential step, for showing where an objection bites.

Full detail, all measured against the CLI: **`map-semantics.md`** beside this file. Read it
before building any map that has to serve more than one audience.

## Statements vs arguments — pick deliberately

- `[Title]: text` is a **statement** — a claim. Use when recording *what is asserted*.
- `<Title>: text` is an **argument** — a piece of reasoning, which can carry a premise-conclusion
  structure. Use when reconstructing *how* a conclusion is reached.

A map of statements alone shows what supports what. Adding arguments with PCS shows the
inferential machinery. Most drafting work wants statements; teaching and close reconstruction
want arguments with premises.

```argdown
[claim]: The conclusion being argued for.
    + <The Argument>

<The Argument>: One-line gloss.

(1) First premise.
(2) Second premise.
-----
(3) The conclusion.
```

## Reconstructing from prose

**Name the argument's FORM before writing any nodes.** Most philosophical arguments are one of a
few shapes — elimination of alternatives, reductio, inference to the best explanation, dilemma,
transcendental argument. The shape determines the map's skeleton. Working section-by-section
through the text instead produces a map that mirrors the table of contents and hides the argument.

1. **Find the conclusion first.** What is the passage trying to get you to accept?
2. **Then find the form**, and make it structurally visible (see the two rules below).
3. **One claim per statement.** If it needs "and" or a semicolon, it is probably two.
4. **Use the author's own words** where possible, compressed but not reworded into your idiom.
5. **Record objections as objections** (`-`), not as smoothed-over qualifications. A reconstruction
   with no attacks is usually a misreading.
6. **Give every statement a stable `[id]`** — short, kebab-case, meaningful. **Never let a
   negation drop out of an id**: `[sufficient-reason-to-grant]` for the claim *There is NOT a
   sufficient reason to grant…* inverts the node everywhere the id is read.
7. **Attach provenance in metadata, on EVERY claim, as you go** — never as a later pass:
   `{chapter: "...", section: "...", source: "...", reviewed: "YYYY-MM-DD"}`.
   - `chapter` — path to the source file, relative to the manuscript folder. **Without it a
     claim cannot be placed in the text at all**, and it falls out of every order-of-exposition
     question into the no-position lane.
   - `section` — the heading it came from. This is what lets the claim be located to the
     PARAGRAPH rather than the top of a section, and it is the difference between a usable
     axis and a staircase.
   - `source` — the author's exact words, in quotation marks, where you have them. Quotations
     are verified against the file and give the claim an exact line.

   Two of these are load-bearing rather than decorative: the author's standing preference is
   that every map of a text they hold carries the Manuscript view, and `chapter` + `section` are its
   only inputs. The **by-position view** reads the source's own top-level headings rather than
   this metadata — it bands the map one lane per file and one lane per `#` heading, both
   labelled and both foldable by clicking the grey box — so a source with no headings gets one
   lane however good the metadata is. Depth there is measured from the head of each band, not
   from the paper's contention, so **no section of the text can drop out of the view whose
   subject is the text**; "how much" reads "section claims / + reasons / + detail / everything".
   A manuscript of **several files** gains a rung below those — **"by chapter"**, which it also
   opens on: every section shut into one block, laid along its chapter's row rather than each in
   a band of its own. A band costs a whole row, so shutting sections without moving them made the
   book thinner, not shorter (1:6 became 1:19); laid along the row the same blocks come out about
   1:2, and the book fits at 42% instead of 8%. Every band carries its **word count** — the
   project's, each file's, each section's — which is what the retired `_structure.html` was for.

   **To check a renderer change, do not rebuild the maps.** Build only the standalone
   (`build_argdown_viewer.mjs --standalone`, ~1s against ~2.5min for all of them) and drop a
   reconstruction's FOLDER on `Ipsissima Reader.html`: it locates the claims in the page with the
   same module the build uses. It cannot derive fidelity — that is `check_argdown.py` — so its
   borders are as declared, and it says so.

   **A line that passes behind a claim is drawn dashed across it.** In a text-ordered layout a
   reason four sections away is a long near-vertical line with whatever the text put in between
   sitting on top of it: 55% of edges pass behind at least one claim and the worst passes behind
   ten. An occluded line is clipped by the box and resumes on the far side — and a line resuming
   at a box's edge looks exactly like a line STARTING there, so the reader sees a relation
   between claims that have none. Interrupting a line and resuming it elsewhere is the cue for
   "two lines", so the fix is to give the eye back the continuity: the draughtsman's hidden-line
   convention, what lies behind is drawn, and drawn broken. Rerouting is not available — with
   more than half the edges affected there is no clear lane to route into, and moving the lines
   would cost the property the view exists for, that horizontal distance is distance through the
   text.

   **The manuscript sits beside the map, and the two are linked both ways.** `--source-root`
   bakes the source text in, so **Text** opens it alongside any of the three views.
   Double-click, shift-click, or right-click → *Go to source* on a claim jumps to the passage it
   was drawn from, with a note saying how precisely it was placed. Clicking a passage answers
   with **every** claim drawn from that paragraph — unfolding them if they are hidden, and
   moving the camera only when they all fit at the reader's zoom. Plural on purpose: 57% of
   placed claims share a line with another (a claim pinned to its paragraph carries that
   paragraph's first line), so "the nearest claim" would be a choice between several that
   nothing in the file settles. `[claim-id]` references in the Argdown pane are links to the
   same two things.

   **Linked premises are drawn linked.** Argdown's two ways of supporting a claim look the same
   once flattened onto a map: the premises of one inference step of a PCS are *linked* (all
   needed, knock one out and the step is gone), while each `+` relation is *independent*. The
   adapter now numbers each premise with its inference step — read off `res.arguments[t].pcs`,
   whose roles are `premise` / `intermediary-conclusion` / `main-conclusion` — and the renderer
   gathers a step's premises onto a **bar** that goes on as one arrow. Steps with a single
   visible premise (the other being an undrawn intermediate conclusion) keep a plain arrow.
   Across the reference maps: 13 arguments, 25 steps, **14 bars**.

   Two things this fixed on the way. `kind` used to be `tag || type`, so every tagged
   `<Argument>` — all 13 — reached the renderer indistinguishable from a statement; `kind` is now
   what the node IS and `facet` keeps the tag, with both emitted as `alm-k-` classes so existing
   tag styling still works. And **`inference.inferenceRules` is where a named argument form would
   live** (`-- {uses: ["modus ponens"]} --`); the corpus has none, so nothing is drawn for it
   yet — but the bar is where such a label belongs when the author starts writing them.

   **Marginalia: `note` for your own hand, `comment` for someone else's.** Both are metadata,
   both reach the map as a folded corner on the claim and a row in the Notes pane, and **neither
   becomes a node** — a remark about an argument is not a move in it, and "try reading Frankfurt
   on this" drawn as a claim would say the text contains that move. An objection IS a move and
   stays a node. The two are drawn apart (gold / magenta) because a file goes back to the person
   whose argument it is, and they must be able to tell the reconstructor's reasoning from a
   reader's comment on it. `//` and `/* */` comments are stripped by the parser and never reach
   the map at all.

   **`check_argdown.py` now reports the PCS shapes that are usually slips**, under
   `== PREMISE-CONCLUSION SHAPES ==`. The bar makes this worth having: it asserts that a step's
   premises stand or fall together, and that assertion comes from the FILE, so a badly-shaped
   structure now misreports the argument rather than merely looking untidy.

   | reported | what it means |
   |---|---|
   | **a step with one input** | one premise, or nothing but the previous conclusion — the bar links nothing. Sometimes right (a definitional move); more often a premise is missing |
   | **a premise with no text** | referenced in a structure, defined nowhere, so the map draws an empty box |
   | **a premise listed twice in one step** | the same claim numbered twice among one inference's premises |

   Two shapes are deliberately NOT checked. A PCS with no `----` is already an Argdown syntax
   error ("Missing inference"), and an argument nothing uses is already in the apex and
   disconnected-node lists — a second voice saying either would be noise. Measured across the
   seven samples and the book: **7 reports, all of them the one-input shape, no false positives.** Retro-fitting them to a finished map means re-reading the whole source, so the
   cost of skipping this is paid later and paid in full. `check_argdown.py` prints the coverage
   on every run — check it before you call a reconstruction done.
8. **Do not invent claims.** If a section has not been read, leave it undeclared rather than
   guessing what it argues. If the source raises a point and drops it, record the dropping as a
   `#scope` statement rather than silently completing the thought.

### Linked vs convergent support — the choice that changes the logic

```argdown
[c]: Conclusion.        // CONVERGENT: three INDEPENDENT reasons.
    + [p1]: Reason one. // Knock out two and the third still supports c.
    + [p2]: Reason two.
    + [p3]: Reason three.
```

```argdown
[c]: Conclusion.        // LINKED: premises that work only TOGETHER.
    + <The Argument>    // Knock out one and the argument collapses.

<The Argument>: Gloss.

(1) [p1]
(2) [p2]
(3) [p3]
-----
(4) [c]
```

Sibling `+` relations assert convergence. That is the default a careless reconstruction falls
into, and it is usually wrong: most philosophical arguments are linked. **If the premises only do
their work jointly, they belong in a premise-conclusion structure, not in a list of siblings.**

### Make elimination of alternatives visible

When the argument runs "the candidates are X, Y and Z; none survives; therefore not-P", do **not**
bury the candidates inside the text of one premise. Give each its own statement and attach its
refutation to it:

```argdown
[thesis]
    - [candidate-x]: (a) The first way the thesis might fail.
        - [refutation-of-x]
    - [candidate-y]: (b) The second.
        - [refutation-of-y]
    - [candidate-z]: (c) The third.
        - [refutation-of-z]
```

Keep the exhaustiveness claim ("these three are the only candidates") as its own statement too —
it is usually the argument's weakest joint and deserves to be visible and attackable.

## One root, not several

If every top-level statement is a separate root, the file is several disconnected trees rather
than one argument. Attach the parts to the main claim by re-opening it later in the file:

```argdown
[main-claim]
    + [part-one-contention]
    + [part-two-contention]
```

**Check connectivity against the DOT export, not the JSON.** The JSON `relations` array omits
edges implied by a premise-conclusion structure: a premise feeding an argument, and a supporting
argument reaching its conclusion, are both absent from it. Measured on one file, 26 relation lines
in the source produced 15 JSON relations and 141 DOT edges. An orphan check run on the JSON
therefore reports every premise of every argument as an orphan — all false. `check_argdown.py`
reads the DOT and gets this right.

Two things to read off its output:

- **DISCONNECTED** — a node wired to nothing. In a finished reconstruction, a defect: attach it
  or delete it. **In a map of work in progress it is often just where the author has got to** —
  a claim written down before its place is known. Report it; do not scold. The tool exists to
  help find the structure, and a draft that already had it would not need mapping.
- **APEX** — nodes that support nothing. The main contention should be here. A long apex list
  means framing or scope material was never attached to the argument — which in a draft is
  information about the draft, not an accusation. Note that a downstream
  corollary (`[thesis] +> [what-follows-from-it]`) legitimately sits *above* the thesis.

## Fidelity on arguments

`<Argument>` nodes carry fidelity like any other claim, and usually should: assembling premises
into a numbered structure is the reconstructor's work even when every step is the author's. An
argument with no `fidelity` in its metadata hovers bare, which is what it should do — but it is
usually a sign the marker was forgotten rather than that none applies.

## Showing a map to the author

The author reads maps in a browser, not a terminal.

```bash
cd app
node build_argdown_viewer.mjs "path/to/file.argdown" --source-root "path/to/manuscript"
node build_argdown_viewer.mjs --standalone             # -> "Ipsissima Reader.html" at the root
```

**ALWAYS build with `--source-root` when the map reconstructs a text on disk.** The author's
standing preference (17 Aug 2026): every map you make carries the Manuscript view. Without the flag
the map still draws and the Manuscript tab is greyed out with the reason attached, but nothing else
says anything is missing. The flag can only place a claim that carries a `chapter`, and
only refine it to a paragraph if it also carries a `section` — so the metadata has to be there
BEFORE the build.

The per-file viewer bakes its graph AND THE RENDERER in at build time, so it goes stale the
moment either changes — silently: the page opens, the map draws, and it draws the old way. Do not
try to remember which viewers exist. After editing `argdown-live-map.js`:

```bash
node app/rebuild_viewers.mjs"           # rebuild them all
node app/rebuild_viewers.mjs" --check   # just say what is stale
```

It finds every `.argdown` with a built map beside it — across the samples, the book, and
`Documents/Research` — plus the standalone and the book's `_structure.html`, and passes
`--source-root` wherever a `_quarto.yml` sits beside the source. This exists because the
instruction to rebuild everything was already written down and I still missed three maps,
including the author's own book: what was missing was any way to enumerate them.

Interface, fold behaviour, arrowhead and layout rules, and the test harnesses: **`viewer.md`**.

## Before sharing anything: run everything

```bash
node app/run_all_tests.mjs"
```

Nine suites — fold logic, edge direction, re-seat routes, fold invariants, layout geometry,
provenance parity, page geometry, provenance defaults, reading checks — plus **map quality
against a recorded baseline**, which is the one that watches how the maps LOOK. Non-zero exit if
any fails.

**Before changing anything in the renderer, read the loop in `viewer.md`**: measure, change,
measure, look. Every layout defect in this thing was found by the author's eye rather than by a
test, and that section exists so the next one is not.

## Files beside this one — read on demand, not by default

| file | read it when |
|---|---|
| `order-views.md` | interpreting the Manuscript view, or explaining what `--source-root` buys |
| `viewer.md` | changing the renderer, debugging a map that draws wrongly, or describing the viewer's controls |
| `integrations.md` | converting a Rationale `.rtnl` map, embedding Argdown in a Zettlr export, or co-editing a file the author also edits |
| `reference.md` | checking a syntax detail; every rule in it was tested against the CLI |
| `map-semantics.md` | deciding what becomes a node, or getting several views out of one document |
| `ROADMAP.md` | what is built and what remains |
| `PIPELINE-PLAN.md` | building the paper-to-map pipeline, or deploying it as an MCP |

Scripts: `check_argdown.py` (run this, not the bare CLI), `argdown_provenance.py` (quotation
checking and text positions), `rationale_to_argdown.py`. The converter and the renderer live in
`mcp/src/ipsissima_mcp/`.

**This file is loaded on every Argdown task; the six above are not.** Keep it to what must be
obeyed before anything else can be got right — the traps, the rules, the reconstruction procedure —
and put the explanations next door.
