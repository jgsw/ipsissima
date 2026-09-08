# argdown-pandoc

Interactive [Argdown](https://argdown.org) argument maps in [Pandoc](https://pandoc.org)
exports — and a CLI for rendering `.argdown` files to SVG, PNG, or PDF figures.

Maps are drawn by the [Ipsissima](https://github.com/jgsw/ipsissima) viewer's own layout
code, so what a reader gets is what the author saw on screen: in HTML and reveal.js the
**live map itself** (pan, zoom, fold sections, a control bar, and an "explode" panel that
opens any compound argument as a premise–conclusion staircase); in Word, LaTeX and the other
print formats a **static figure of the identical drawing**, at the same fold state, with
every claim in full.

This is a different animal from the official `@argdown/pandoc-filter`, which ships a
Graphviz picture or web component: here the exported map is the running viewer, its folding
travels with the document, and print output matches the screen.

## Install

```bash
npm install -g argdown-pandoc
```

HTML and reveal.js exports work with that alone. The static formats (docx, LaTeX/PDF, odt,
pptx…) render headlessly in Chromium, which is deliberately not pulled in by default:

```bash
npm install -g playwright && npx playwright install chromium
```

## The Pandoc filter

```bash
pandoc paper.md --filter argdown-pandoc -o paper.html
pandoc slides.md -t revealjs -s --filter argdown-pandoc -o slides.html
pandoc paper.md --filter argdown-pandoc -o paper.docx
pandoc paper.md --filter argdown-pandoc --pdf-engine=xelatex -o paper.pdf
```

Write a map as a fenced block…

````markdown
```{.argdown-map caption="The paper's argument"}
[Main claim]: The thing argued for.
    + [Support]: A reason in its favour.
    - [Objection]: A reason against.
```
````

…or embed an `.argdown` file, with the alt text as the caption (a path containing spaces
goes in angle brackets — Pandoc's own syntax for such targets):

```markdown
![The paper's argument](maps/paper.argdown)
![](<maps/my paper.argdown>){depth="2"}
```

`.argdown-map` and `.argdown-live` are synonyms. A bare ```` ```argdown ```` block is shown
as syntax-highlighted source, never rendered.

### Folding

With no attributes a map opens at the fold the Ipsissima App would open it at (top-level
sections folded past 25 claims; the deepest depth rung keeping ≤ 40 claims in view). To pin
an exact state, copy a *fold state identifier* from the App onto the block:

```markdown
![](maps/paper.argdown){fold="ipsfold1 map=6b2c91e4 view=arg depth=2 folds=n12"}
```

The identifier encodes the whole fold state and carries a fingerprint of the map's
structure, so a state pasted against the wrong (or since-edited) file **fails the export
with a sentence saying so** instead of silently drawing nonsense. Coarser controls:
`depth="2"`, `folded="s1,s2"`.

### Attribute reference

| Attribute | Formats | Meaning |
| --- | --- | --- |
| `fold="ipsfold1 …"` | all | exact fold state, copied from the App |
| `depth`, `folded` | all | coarse fold controls (ignored when `fold=` given) |
| `caption`, `title` | all | figure caption / alt text |
| `claims="full"` / `"short"` | live / static | full text everywhere; static defaults to `full` (paper has no "more" to click), live to `short` |
| `controls="false"` | live | hide the control bar |
| `height="460px"` | live | fixed height (default 480px, 440px on slides) |
| `height="full"` | live | fill the window/slide below the map |
| `height="screen"` | reveal.js | genuine full screen: the map overlays the whole window while its slide is current |
| `src="file.argdown"` | all | render this file instead of the block body |
| `format="svg"` | pptx | keep the vector SVG instead of the default PNG (PowerPoint-only decks) |
| anything else | static | passed through to the Image element (`width`, …) |

On reveal.js a map **fills the slide below it by default**; give an explicit `height=` to
opt out.

## The CLI — figures for LaTeX (and anything else)

```bash
argdown-map paper.argdown -o figures/map.pdf --fold "ipsfold1 map=6b2c91e4 view=arg depth=2"
argdown-map paper.argdown -o map.svg
argdown-map paper.argdown -o map.png --scale 3
```

then, in a plain LaTeX document:

```latex
\includegraphics[width=\textwidth]{figures/map.pdf}
```

PDF output is printed by Chromium (vector, selectable text) — no `rsvg-convert`,
Inkscape, or other system tool needed. `--claims short` restores the App's on-screen text
clipping; `--depth` and `--folded` work as in the filter.

## Zettlr

Zettlr exports run through Pandoc defaults files, so the filter drops straight in: add it
under `filters:` in the profiles at `~/Library/Application Support/Zettlr/defaults/` (macOS):

```yaml
filters:
  - type: json
    path: "/absolute/path/to/argdown-pandoc"   # `which argdown-pandoc`
```

Note that Zettlr, as a GUI app, may spawn pandoc without your shell's PATH — name the
filter (or a one-line `#!/bin/sh` wrapper that execs your absolute `node`) by absolute path.

In Zettlr's editor, a *bare* fence (` ```argdown-map `, no braces) displays with Argdown
highlighting; the brace syntax needed for attributes does not. The file-embedding image
syntax avoids the problem entirely — there is no pasted source to highlight.

## PowerPoint and Google Slides

Neither can run HTML on a slide — no embedded viewer is possible there. If you want the
live map in a talk, export the talk itself to reveal.js; that is what it is for.

`pptx` output gets a **high-resolution PNG** figure by default rather than SVG, because a
.pptx is also what people feed Google Slides, and Slides rejects SVG (an "Unsupported image
type" since 2021, on security grounds) — an SVG-bearing deck would import with its maps
missing. Add `format="svg"` to a block to keep vector graphics for a deck that will only
ever open in real PowerPoint (2016+).

For Google Slides directly, render a PNG and Insert → Image:

```bash
argdown-map paper.argdown -o map.png --scale 3
```

At `--scale 3` the figure stays crisp when projected. (Vector-into-Slides is technically
possible by laundering the SVG through WMF or LibreOffice into a pptx, but it is a fiddly
third-party workflow; a 3x PNG is the dependable route.) A slide can also simply link out
to a published HTML export, where the reader gets the live map.

## How it stays honest

The renderer under `vendor/` is copied verbatim from the Ipsissima repo's `app/` by
`sync-vendor.mjs` (run automatically at packing), so this package cannot drift from the
App — a rebuilt App is a rebuilt export. Set `IPSISSIMA_APP=/path/to/ipsissima/app` to
render with a live checkout instead of the vendored copies.

## License

MIT. Part of the [Ipsissima](https://github.com/jgsw/ipsissima) project; the Argdown
language and parser are [Christian Voigt's](https://github.com/christianvoigt/argdown).
