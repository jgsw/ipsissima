# Argdown syntax reference

Compiled from argdown.org and **verified against `@argdown/cli` 2.0.0** — every construction
below was run through the parser rather than taken on trust. Where a rule is marked VERIFIED it
was tested directly; where it is marked *(from docs)* it is documented but untested here.

---

## Block structure — the thing that actually breaks files

An Argdown document is a sequence of **top-level block elements separated by blank lines**. A
block is a statement, an argument, a heading, a list, or a PCS, together with everything
indented beneath it.

**A relation symbol may not begin a block.** VERIFIED

```argdown
[a]: Parent.

    + [b]: Child.          ← INVALID: the blank line ended the block
```

```argdown
[a]: Parent.
    + [b]: Child.          ← VALID: same block
        + [c]: Grandchild.
    - [d]: Objection.
```

Relations at the same tree level are indented equally; deeper levels indent further.

Comments do **not** break a block. VERIFIED

```argdown
[a]: Parent.
    // this is fine here
    + [b]: Child.
```

---

## Statements

```argdown
This is a bare statement.

[Title]: A statement with a title.
[Title]: Another member of the same equivalence class.
[Title]                                    ← a reference, defines nothing new
```

A title creates an **equivalence class**: every statement sharing that title is treated as the
same claim. Reference an existing class by title alone — including *before* it is defined.
VERIFIED (forward references parse).

Mention a statement inside prose with `@[Title]`.

---

## Arguments

```argdown
<Title>: A one-line description of the argument.
<Title>                                    ← a reference
```

Mention with `@<Title>`.

### Premise-conclusion structures

A PCS is a consecutively numbered list with an inference line before the conclusion.

```argdown
<The Argument>: Gloss.

(1) First premise.
(2) Second premise.
-----
(3) Conclusion.
```

Expanded inference, carrying a rule name and metadata. VERIFIED — and note that the opening `--`
**must** be matched by a closing `--`:

```argdown
(1) All humans are mortal.
(2) Socrates is human.
--
Modus Ponens
{uses: [1,2]}
--
(3) Socrates is mortal.
```

**`--` is therefore not a short form of the simple inference line**, and getting this wrong can
lose a claim without any error. In a multi-step PCS the parser reads the first `--` as opening an
expanded inference and the next line as its rule name. VERIFIED, both outcomes:

```argdown
(1) P.                 (1) P.
(2) Q.                 --
--                     (2) Q.
(3) R.                 (3) R.
--                     --
(4) S.                 (4) S.

parses, exit 0 --      errors: Invalid inference
(3) is SWALLOWED as    syntax. Please end your
the rule name and      inference with two
vanishes from the      hyphens (--)
document
```

The left-hand case is the dangerous one: a four-statement argument silently became three. Use
`-----` at every simple step. VERIFIED:

```argdown
(1) A premise.
(2) Another.
-----
(3) An intermediate conclusion.
(4) A premise introduced after it.
-----
(5) The final conclusion.
```

**A PCS cannot be nested inline beneath a relation.** VERIFIED — this fails:

```argdown
[a]: S.
    + <Arg>: An argument.
        (1) Premise.          ← INVALID
```

Define the argument as its own top-level block and reference it:

```argdown
[a]: S.
    + <Arg>

<Arg>: An argument.

(1) Premise.
(2) Premise.
----
(3) Conclusion.
```

---

## Relations

| Symbol | Meaning | Direction | Verified |
|---|---|---|---|
| `+` | support | outgoing (child supports parent) | yes |
| `-` | attack | outgoing | yes |
| `_` | undercut | outgoing | yes |
| `><` | contradiction | symmetric | yes |
| `<+` | support | explicitly outgoing | yes |
| `+>` | support | incoming (parent supports child) | yes |
| `<-` / `->` | attack, explicit direction | *(from docs)* | — |

The bare `+`, `-`, `_` are outgoing by default: the indented child stands in that relation *to*
its parent.

---

## Metadata

YAML inside braces. Both placements VERIFIED:

```argdown
[a]: Text. {chapter: "x.md", reviewed: "2026-08-15"}

[a]: Text.
    {chapter: "x.md"}
    + [b]: Child.
```

Block form, with a linebreak after the brace *(from docs)*:

```argdown
[Title] {
sources:
    - Source A
    - Source B
}
```

### Provenance fields the tooling reads

| field | meaning |
|---|---|
| `chapter` | path to the source file, relative to `--source-root`. Without it a claim cannot be placed at all. |
| `section` | the heading the claim comes from. Scopes the paragraph search. |
| `source` | where the reconstruction parks the author's exact words; quotations here are checked and located. |
| `fidelity` | `quotation` · `paraphrase` · `compression` · `interpretation` · `imputation`. Drawn as the node border. |
| `warrant` | why the reading departs from the text, on `interpretation` and `imputation`: `enthymeme` · `hyperbole` · `sloppy-phrasing` · `secret-sign` · `other-texts` · `coherence` · `convention`. Any other short value is accepted and listed. |
| `note` | the prose reason. Keep it; `warrant` is the countable slot beside it, not a replacement. |
| `line` | **override only.** Use for a claim with no chapter, or whose section heading does not match. Positions are otherwise computed fresh each run, so a stored line cannot go stale. |

**Metadata is read on arguments too**, not only statements. Assembling premises into a numbered
structure is the reconstructor's work even when every step is the author's, so an `<Argument>`
carries `fidelity` and `warrant` like any other node.

**A claim's metadata is gathered across ALL its members**, first non-null per field. A claim is an
equivalence class: the definition carries `{chapter: ...}` and every bare `+ [claim]` reference
elsewhere carries nothing. Reading only the first member loses the metadata of any claim
referenced before it is defined — which silently unplaced several well-connected claims in the
book map, `iteration` (7 edges, `#core`) among them, and made them look like reconstruction gaps
when the metadata was there all along. VERIFIED.

---

## The project file — optional

A reconstruction of ONE paper needs no project file. Reading order is taken from the chapters the
map cites. For several sources, put `argdown-project.yml` beside them:

```yaml
title: My Book
chapters:
  - intro.md
  - part: Part One
    chapters:
      - a.md
```

Paths are relative to the file. Quoting optional. `_quarto.yml` is read too, with the same
parser, so an existing Quarto project needs nothing new. **No leading underscore in the name** —
`@argdown/node` ignores `**/_*`.

---

## Frontmatter

Document-level configuration between `===` fences at the top of the file. VERIFIED.

```argdown
===
title: Document Title
author: Name
model:
    removeTagsFromText: true
map:
    statementLabelMode: text
selection:
    selectedSections: ["Part One"]
defaults:
    chapter: "source/the-paper.md"
    reviewed: "2026-08-19"
reconstruction:
    aim: fit            # fit | appropriation
    unit: meaning       # meaning | commitment
    mode: coherence     # coherence | truth | soundness | agreement | interest
    strength: ordinary  # minimal | ordinary | strong
===
```

`defaults` and `reconstruction` are read by the tooling, not by the CLI, which ignores keys it
does not know. `defaults` fills in provenance every claim would otherwise repeat; a value on a
claim always wins. `reconstruction` declares what the reconstruction is trying to be — see the
Fidelity section of `SKILL.md`.

**A comment header does not hide the block.** VERIFIED against the CLI: a `===` block placed
after a `//` comment header is honoured exactly as one at the top of the file. The Python reader
anchored at index 0 and silently returned nothing for such a file, so `defaults:` stopped
applying the moment a map was documented and every claim reported "no chapter" — fixed, and
tested in `test_provenance_defaults.py`.

**An inline comment is not part of the value.** `aim: fit   # fit | appropriation` reads as
`fit`, and `chapter: "x.md"  # the source` reads as `x.md`. Quoted values are taken between the
quotes.

Frontmatter drives selection and rendering — the same document can produce several different
maps by changing `selection` and `map` settings, without touching the argument.

---

## Headings, sections and grouping

```argdown
# Level 1
## Level 2
# Heading #tag
# Part One {isGroup: true}
```

All VERIFIED. Headings create **sections**, which the map renderer turns into groups. Tags drive
automatic colouring. A level-*x*+1 heading should sit under a level-*x* heading.

---

## Tags

```argdown
[a]: A claim. #survey
[b]: Another. #(tag with spaces)
```

VERIFIED. Tags appear in the `json` export under `tags` and colour nodes in generated maps —
preferable to encoding the same information in metadata, which renderers ignore.

---

## Lists

```argdown
* [Statement 1]: Text
* [Statement 2]: Text

1. [Statement 1]: Text
2. [Statement 2]: Text
```

Not to be confused with a PCS: PCS statements use `(1)` in round brackets.

---

## Comments

```argdown
// line comment
/* multi-line
   comment */
<!-- HTML-style comment -->
```

All ignored by the parser and safe inside a tree.

---

## Text formatting inside statements

`__bold__` `**bold**` · `_italic_` `*italic*` · `[text](url)` · `#tag` · `:emoji:`

### Escaping — three ways ordinary prose breaks the parser

VERIFIED, all three:

| In your text | What happens | Fix |
|---|---|---|
| an unpaired `_` (a filename, `map0_30`, `snake_case`) | opens an italic range; parse aborts with *Incomplete italic text range* | `\_` |
| `[title]` inside running prose | read as a **statement definition**; parse aborts with *Expecting token of type EOF* | `@[title]` — the mention form |
| `.A.` `.E.` `.~.` `.v.` `.->.` `.<->.` `.P.` `.O.` | **silently** rewritten to ∀ ∃ ¬ ∨ → ↔ 𝗣 𝗢 | break the sequence: `III.A Foo`, not `III.A. Foo` |

The third is the dangerous one: it does not error, it corrupts. Section numbering (`# III.A. …`,
`# IV.E. …`) is where it shows up, and it then silently breaks every `selectedSections` and
`folded=` reference to that heading. Tested 53 candidate sequences against the CLI; exactly these
eight transform.

**Metadata is exempt.** Values inside `{...}` are passed through verbatim, so
`{note: "he said \"x\" about a_b [c] *d*"}` is safe. Put arbitrary quoted prose there rather than
in statement text.

---

## CLI

```bash
CLI="app/node_modules/.bin/argdown"

"$CLI" map  <f>.argdown --format dot > /dev/null    # validate — non-zero exit on error
"$CLI" map  <f>.argdown --format svg --outputDir "$PWD/svg"
"$CLI" json <f>.argdown --outputDir "$PWD/json"        # statements, relations, tags, sections
"$CLI" html <f>.argdown --outputDir "$PWD/html"
"$CLI" web-component <f>.argdown --outputDir "$PWD/html"
```

`--outputDir` is safest as an absolute path; relative paths are resolved against the input file's
directory, not the working directory.

The `json` export gives quick counts:

```bash
python3 -c "import json;d=json.load(open('json/<f>.json'));\
print(len(d['statements']),'statements',len(d['relations']),'relations')"
```

**But do not check connectivity against the JSON.** Its `relations` array omits every edge implied
by a premise-conclusion structure — premise→argument, and (for a supporting argument)
argument→conclusion. VERIFIED on one file: 26 relation lines written in the source produced 15
JSON relations, while the DOT export drew all of them. An orphan check run on the JSON therefore
flags every premise of every argument as an orphan.

Use `check_argdown.py`, which reads the DOT:

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py "<f>.argdown"
```
