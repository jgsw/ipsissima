# What of Argdown the viewer actually draws

An audit, 27 August 2026. Ipsissima bundles the official parser unmodified, so the question is
never whether a construct parses. It is whether the picture that comes out says what the file
says. This walks the language element by element, against
[the syntax reference](https://argdown.org/syntax/) and against the lexer's own token list in
`app/node_modules/@argdown/core/dist/lexer.js`, and grades what the viewer does with each.

**Grading.** *Full* means correct with no caveat. Any deficiency at all makes it *partial*. *None*
means the element's distinguishing information is not carried, or is carried wrongly. Where a
construct fails in the parser rather than in Ipsissima, it is marked **upstream** and not graded.

**Totals over 60 elements: 27 full, 16 partial, 14 none**, and 3 that fail in the parser rather
than here. The four gaps that matter most are set out after the tables.

Test files are in the scratchpad for this session; each is named in the evidence column. The two
harnesses used throughout are a probe that prints the model, the map and the graph
`argdown-graph.mjs` hands the renderer, and a sweep that runs a corpus and flags what got lost.
Where the evidence says *in-page*, the claim was checked in a built viewer running in a browser,
by reading the SVG back out of the DOM.

---

## Statements

| Element | Syntax | Support | What is wrong or missing | Evidence |
|---|---|---|---|---|
| Statement definition | `[Title]: text` | full | — | `01-relations` |
| Statement reference | `[Title]` | full | Draws a titled box with no body, which is right — there is no text to draw | `14-nesting` |
| Untitled statement | `Plain text.` | partial | Enters the map only under `statementSelectionMode: all`, and then `toGraph` falls back to `n.title` where Argdown deliberately left `labelTitle` unset, so the box is headed with the placeholder `Untitled 1`. Four of these appear in Argdown's own `welcome to argdown.argdown` | `16-selection` |
| Statement mention | `@[Title]` | partial | The parser leaves the markup in the text and records the reference in `ranges`. `toGraph` reads only the text, so the box shows the literal `@[Contention]`, delimiters and all, and it is inert. `core argument of populism.argdown` has seven | `02-inline`, in-page `10-battery` |
| Equivalence class | two definitions, one title | partial | One node, showing one of the two wordings with no sign the other exists. Recording an alternative formulation is the documented purpose of the construct | `12-comments` |
| Multi-line statement | text over several lines | full | Joined with single spaces | `14-nesting` |
| Bold | `__x__`, `**x**` | none | The parser strips the markers into a `bold` range; `toGraph` never reads `ranges` and the renderer draws SVG `<text>` with `textContent`. The emphasis is gone with no trace. Five instances in `welcome to argdown.argdown` | `02-inline`, in-page `10-battery` |
| Italic | `_x_`, `*x*` | none | As bold | `02-inline` |
| Link | `[text](url)` | none | The URL is discarded with the range; the link text is drawn as ordinary prose and nothing is clickable | `02-inline` |
| Tags | `#tag`, `#(tag with spaces)` | partial | Only `tags[0]` reaches the map, as `facet`; a claim tagged `#alpha #beta` filters and colours as `alpha` only and `beta` is unreachable. `RUN` also sets `removeTagsFromText`, so a tag written mid-sentence leaves a hole — `#42 and #real` renders as "A claim tagged and ." The editor highlights `#tag` but not `#(tag with spaces)` | `02-inline`, `25-num-tag`, in-page `10-battery` |
| Special-character shortcodes | `.~.`, `:happy:` | partial | All 80 codes substitute in the model and all 80 render in the map with non-zero width, in the page's own `system-ui` stack rather than ArgVu. But the editor's linter warns on eight of the twelve logical codes (`.A. .E. .O. .P. .->. .<->. .~. .v.`) wherever they appear, including in ordinary statement text where they are entirely correct, and silently passes `.^. .v_. .<>. .[].` and all 56 emoji codes. The warning guards a real trap — a shortcode in a heading rewrites the heading, `# III.A. The Types` becoming `III∀ The Types` — but it fires in the wrong place | `19-shortcodes` (all 80, in-page), `20-heading-sc`, editor lint run over `19-shortcodes` |
| Escaped characters | `\[`, `\_` | full | `\[sic\]` and `file\_name` come through as written | `12-comments` |
| Statement YAML data | `{k: v}` inline or block | partial | Both forms parse and both reach the graph. Ipsissima reads its own keys (`fidelity`, `note`, `comment`, `chapter`, `section`, `line`, `lineSource`, `source`) and Argdown's `color` and `images` are ignored — see the front-matter rows below | `35-blockmeta`, `13-colour` |

## Arguments

| Element | Syntax | Support | What is wrong or missing | Evidence |
|---|---|---|---|---|
| Argument definition | `<Title>: description` | full | Drawn as an argument node, distinct from a statement | `01-relations` |
| Argument reference | `<Title>` | full | — | `03-pcs` |
| Argument mention | `@<Title>` | partial | As statement mentions: raw `@<Sketch>` in the box. Six in `greenspan.argdown`, two in `core argument of populism.argdown` | `02-inline`, in-page `10-battery` |
| Argument description beside a PCS | separate blocks | full | The description becomes the node's body; the PCS is used for the junction bars | `15-pcsrel` |
| Argument YAML data | `<T> {k: v}` | partial | As statement data | `13-colour` |

## Premise-conclusion structures

| Element | Syntax | Support | What is wrong or missing | Evidence |
|---|---|---|---|---|
| PCS | `(1) … ----- (3) …` | partial | The structure itself is drawn nowhere. `toGraph` reads `res.arguments[].pcs` for two things, neither of them the structure: grouping premises into inference steps, so the renderer can draw a junction bar, and (uncommitted at the time of writing) listing the members and naming the main conclusion, so `argdown-positions` can place an argument in the manuscript. What is drawn discards the numbering, the order, the premise/conclusion roles and the step boundaries. Fourteen reconstructed arguments in `akhlaghi-revelatory-autonomy.argdown` and seventeen in `core argument of populism.argdown` are flattened this way | `03-pcs`, `15-pcsrel`, sweep over both corpora |
| Linked premises | premises of one step | full | Drawn as a junction bar, which is the distinction the notation exists for and which Argdown's own map loses | `03-pcs`, `15-pcsrel` |
| Collapsed inference | `-----` | partial | Not drawn. Its existence is inferred, to bound an inference step | `03-pcs` |
| Expanded inference, one line | `-- Rule {uses: [1,2]} --` | partial | Parses; the rule names and the metadata are on `pcs[].inference` and are read by nothing | `18-inf-c`, `03-pcs` |
| Expanded inference, several lines | `--` / rule / `{data}` / `--` | partial | Parses correctly, and is what Argdown's own examples use. The editor's linter marks **both** `--` lines as **errors** — "A lone `--` opens an expanded inference and eats the next line" — so writing legal Argdown in Ipsissima's editor draws a red underline under it | `18-inf-a`, editor lint run |
| Inference rule names | `-- Modus ponens --` | none | Parsed into `inference.inferenceRules`, never read. Two in `censorship.argdown`, one in `welcome to argdown.argdown` | `03-pcs` |
| Inference metadata | `{uses: [1,2], logic: […]}` | none | Parsed into `inference.data`, never read | `03-pcs` |
| Titled premises and conclusions | `(1) [Title]: text` | full | Become their own nodes, as Argdown's selection rules dictate | `03-pcs`, `15-pcsrel` |
| Relations on PCS statements | `+>`, `<_` under `(3)` | full | Including an undercut written under a conclusion, which lands on the argument node | `15-pcsrel` |
| Inference line of exactly four hyphens with the rule below it | `----` / rule / `----` | **upstream** | A parse error in `@argdown/core` 2.0 — only `--` opens an expanded inference. This is why `greenspan.argdown` reports five syntax errors, and the official CLI reports the same five | `18-inf-b`, `argdown map greenspan.argdown` |

## Relations

| Element | Syntax | Support | What is wrong or missing | Evidence |
|---|---|---|---|---|
| Support | `<+`, `+` | full | Green, solid, arrowhead present | `01-relations`, `22-bare`, in-page |
| Support, forward | `+>` | full | Direction correct | `01-relations` |
| Attack | `<-`, `-` | full | Red, solid | `01-relations`, `22-bare`, in-page |
| Attack, forward | `->` | full | — | `01-relations` |
| Undercut | `<_`, `_` | full | Orange, dashed `5 3`, arrowhead present. Correct against an argument and against a statement | `01-relations`, `22-bare`, `14-nesting`, in-page `10-battery` |
| Undercut, forward | `_>` | full | — | `01-relations` |
| **Contradiction** | `><` | **none** | Argdown's relation type is `contradictory`; the renderer's table (`src/argdown-live-map.js:2239`) is keyed `contradiction`. The lookup misses, falls through to `REL.support`, and the edge is drawn **green and solid**, with `marker-end="url(#alm-arrow-contradictory)"` pointing at a marker that was never defined, so it has no arrowhead either. The legend in *How to use* promises a purple dotted line. `map_quality.mjs:246` has the same mismatch | in-page `10-battery` and in-page `akhlaghi-revelatory-autonomy` (4 edges); `01-relations` |
| Nested relation trees | indentation | full | Re-parenting by indent behaves as the language specifies | `14-nesting` |
| Relations declared away from the definition | title alone, then relations | full | — | `14-nesting` |
| Derived relations | from a PCS conclusion | full | Argdown's derivations reach the map intact | `32-derived` |
| **Entailment** (strict mode) | `<+` between statements | **none** | Arrives as `entails`, misses the table, drawn as plain support with a dangling `alm-arrow-entails`. Three in `welcome to argdown.argdown` | in-page `05-front`; sweep |
| **Contrariety** (strict mode) | `<-` between statements | **none** | Arrives as `contrary`, drawn as plain **support** — green, the colour for a reason. Three in `semmelweiss.argdown` | in-page `05-front`; sweep |
| Contradiction against an argument | `>< <Arg>` | **upstream** | Parse error: contradiction holds between equivalence classes only | `29-xx`, `30-xx2` |

## Structure

| Element | Syntax | Support | What is wrong or missing | Evidence |
|---|---|---|---|---|
| Headings | `#` … `######` | partial | Become map groups by Argdown's `groupDepth` rule, in document order, which is right and is one of the things Ipsissima fixes about Argdown's own output. But a heading that does not become a group leaves no trace anywhere in the viewer, and the section's own tags, colour and remaining data are dropped by `toGraph`, which carries `{id, label, parent, order}` and nothing else | `04-sections`, `33-depth1`, `34-depth3` |
| `{isGroup: true / false}` | on a heading | full | Forces a group on and off correctly | `11-groups` |
| `{isClosed: true}` | on a heading | none | Argdown sets `isClosed` on the group node. `RUN` omits the `transform-closed-groups` step and `toGraph` ignores the flag, so a group the author declared closed opens like any other | `11-groups` |
| Section colour | `{color: …}` on a heading | none | See colour, below | `13-colour` |
| Front matter | `===` … `===` | partial | Parsed and available on `res.frontMatter`. Nothing in the viewer reads it except Ipsissima's own `defaults` block: `title`, `author`, `date` and the rest are never shown — a built map is headed with the filename | `05-front`, in-page `05-front` |
| `model.mode: strict` | front matter | none | The parser honours it. Both relation types it produces are then drawn as support, so the whole point of the mode — that `<-` asserts contrariety — is inverted on the page | in-page `05-front` |
| `map.statementLabelMode` / `argumentLabelMode` | front matter | partial | `title` works (the body empties). `text` does not: Argdown clears `labelTitle`, and `toGraph`'s `n.labelTitle \|\| n.title` puts the title straight back | `07-labelmode`, `17-labeltitle` |
| `group.groupDepth`, `group.regroup` | front matter | full | Both handled inside Argdown's `build-map`, which Ipsissima runs unaltered | `33-depth1`, `34-depth3`, `31-regroup` |
| `selection.*` | front matter | partial | `excludeDisconnected`, `statementSelectionMode` and the rest all take effect, because the selection plugins sit inside `build-map`. But `statementSelectionMode: all` is what admits untitled statements, and every one of them then arrives headed `Untitled 1` — see the first table | `16-selection` |
| `color.colorScheme`, `color.tagColors`, `{color: …}` | front matter and data | none | `RUN`'s process chain is `parse-input, build-model, build-map, export-json`. Argdown's own `export-json` chain also runs **`colorize`**, and without it every `node.color` is `undefined`. `toGraph` reads `n.color` faithfully and therefore always gets null. Running the same file through the full chain produces `#ff0000`, `#7570b3`, `#1b9e77` as declared | `13-colour` under both chains |
| Node images | `{images: […]}`, tag images | none | `add-images` is likewise not in `RUN`, and `toGraph` ignores `n.images` in any case | `13-colour` |
| Unordered list | `* [Item]: text` | full | The marker is consumed; the item is an ordinary statement | `06-lists-quotes` |
| Ordered list | `1. [Item]: text` | full | — | `06-lists-quotes` |
| Nested list | indented `*` under `*` | **upstream** | Parse error: the indented item is read as a relations block | `28-list-only` |
| Line comment | `// …` | full | — | `12-comments` |
| Block comment | `/* … */` | full | — | `12-comments` |
| HTML comment | `<!-- … -->` | full | — | `12-comments` |

## Cross-cutting

| Element | Support | What is wrong or missing | Evidence |
|---|---|---|---|
| Broken metadata YAML | full | Ipsissima's own guard, and it works: `metadataProblems` checks every `{…}` with the same YAML library Argdown uses, the builder refuses to write, and the editor marks the line. This is the failure mode that once emptied a 23-claim map in silence | `23-badyaml` build refused with line, column and the offending text |
| Argdown syntax errors | none | `__ARGDOWN_PARSE__` throws on broken metadata and on a missing map, and never looks at `res.parserErrors` or `res.lexerErrors`. `build_argdown_viewer.mjs` never looks either. A file with a real syntax error produces a truncated document, a blank map, an exit code of 0 and no message anywhere | `24-parsefail`: 1 parser error, `0 nodes, 0 edges`, page written; in-page, `__ARGDOWN_PARSE__` returned 0 nodes without throwing and the error panel stayed empty |

**Not tested.** The pandoc live filter (`argdown-live-filter.mjs`) and the desktop build were not
exercised separately; both go through the same `toGraph` and the same renderer, so the findings
above should carry, but that is inference, not measurement. The Word and Markdown exports were
read rather than run: they annotate the *manuscript*, and never render Argdown statement text, so
no element of the language passes through them.

---

## The gaps that matter

**Contradiction is drawn as support, and so is everything strict mode produces.** Three of
Argdown's six relation types — `contradictory`, `entails`, `contrary` — are missing from the
renderer's four-entry table, and the fallback for a missing entry is `REL.support`. A `><`
therefore draws in the green reserved for "this is a reason for that", and in strict mode so does
a `<-`, which in that mode means the two claims are contrary. The map does not merely omit the
relation; it asserts its opposite. The arrowhead is lost as well, because `marker-end` is built
from the type name and no marker of that name exists, so the line also has no direction. The
whole of it is one missing `y` in a key: the table says `contradiction`, the parser says
`contradictory`.

This is not hypothetical. `akhlaghi-revelatory-autonomy.argdown`, which ships with the project,
uses `><` four times, all four against `[The conditional answer]`, which is the paper's rival
hypothesis and the reason the reconstruction has a shape at all. In the built viewer those four
edges are green. Argdown's own `semmelweiss.argdown` has three `contrary` relations and
`welcome to argdown.argdown` has three `entails`; both draw the same way. The legend in *How to
use* meanwhile shows a purple dotted line and explains that it means the two cannot both be true —
a key for a mark the renderer cannot produce.

**Bold, italic and links are discarded, and mentions leak their markup.** These four share one
cause. The parser resolves every inline construct into a plain `text` plus a list of `ranges`,
and `toGraph` takes `labelText` and drops `ranges` on the floor. For bold and italic that means
the emphasis simply vanishes; for a link it means the URL is gone and the anchor text is left
looking like ordinary prose. For the two mention forms it is worse, because Argdown does *not*
strip those from the text: the box shows `@[Voice of the People]` and `@<Turnover Argument>`
with the sigil and brackets intact, which is the one presentation that is both ugly and wrong,
since it looks like a syntax error the reader should report.

**Corrected 27 August 2026, after the fix.** This entry originally cited nine mentions in
`core argument of populism.argdown` and six in `greenspan.argdown` as evidence. That citation was
wrong, and the way it was wrong is worth keeping: **every one of those mentions is in the free
prose under a section heading**, which never becomes a node, so not one of those files exercises
the defect. The defect is real — a mention in a claim's *own* text did leak its markup — but it
had to be reproduced on a file written for the purpose. That file is now
`fixtures/display/mentions-in-statement-text.argdown`, which is what that directory is for.
The counts for `welcome to argdown.argdown` — five bold and three italic runs, two links — stand.

Mentions are now resolved in `toGraph`, and the `ranges` travel with the node so the emphasis work
still to come has offsets to draw from. One trap found doing it: the two mention types **disagree
about what `stop` means** in `@argdown/core` 2.0 — `statement-mention` is exclusive,
`argument-mention` inclusive — so trusting the range eats a character of neighbouring prose on
half the mentions in a file. The length is computed from the title instead and checked against the
text before anything is cut.

**The premise-conclusion structure is not drawn.** This is the largest single omission by volume:
fourteen reconstructed arguments in the Akhlaghi sample, seventeen in Argdown's populism map, ten
in `semmelweiss.argdown`. An argument with a PCS arrives at the renderer as one box carrying its
prose description, with support edges in from whichever premises happened to be titled. The
numbering is gone, the order is gone, the distinction between an intermediary conclusion and a
premise is gone, and the inference — the rule that was named, and the `{uses: […]}` that says
which premises feed which step — is read by nothing at all. The one thing that does survive is
the best part of it: `toGraph` walks the PCS to number the inference steps, and the renderer draws
the premises of one step joined by a bar, which is a distinction Argdown's own map throws away.
That makes the omission stranger rather than smaller. The information is already being read; it is
being read for one purpose and then dropped. Work in the tree but not yet committed on 27 August
adds a second such reading — the members and the main conclusion, so an argument can be placed in
the manuscript — which makes the point sharper still.

**A syntax error says nothing and shows nothing.** Ipsissima went to considerable trouble over the
YAML failure — `metadataProblems`, one implementation for three consumers, the builder refusing
to write, the note in `argdown-graph.mjs` explaining why. The ordinary case got none of that
attention. `argdown.run` reports syntax errors by returning them, not by throwing, and neither
`__ARGDOWN_PARSE__` nor `build_argdown_viewer.mjs` ever reads `res.parserErrors`. A file with one
bad line therefore parses "successfully" into a document truncated at the fault, the builder prints
`0 nodes, 0 edges`, writes an 875 KB page and exits 0, and the page opens on an empty canvas with
the error panel blank. This is the same class of failure the metadata guard exists to prevent, and
it is wide open next to it.

---

## Smaller things, recorded so they are not rediscovered

The editor's linter marks the legal multi-line expanded inference (`--` on its own line) as an
**error**, and warns on eight of the twelve logical shortcodes wherever they appear, including in
statement text where they are correct — while passing `.^.`, `.v_.`, `.<>.`, `.[].` and all
fifty-six emoji codes. Its tokenizer does not recognise `><` as a relation, does not highlight
`#(a tag with spaces)`, and highlights only `**bold**` of the four emphasis forms.

Only `tags[0]` becomes a node's facet, so a claim carrying two tags can be filtered by one of them
and the other is invisible. And `removeTagsFromText` leaves a gap where a mid-sentence tag was:
`A claim tagged #42 and #real.` renders as `A claim tagged and .`

`statementLabelMode: text` cannot be obeyed, because `toGraph` falls back from the deliberately
cleared `labelTitle` to `title`. The same fallback is why an untitled statement admitted by
`statementSelectionMode: all` is headed `Untitled 1`.

The cheatsheet says `#` followed by a number is not a tag. Against `@argdown/core` 2.0, `#42` is
a tag, and appears in `response.tags`.
