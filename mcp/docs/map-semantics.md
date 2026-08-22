# Argdown map semantics — what appears, and how to control it

The central idea: **the document holds all the detail; the map settings decide how much is
shown.** One `.argdown` file can produce a two-node overview for a slide and a forty-node
reconstruction for a seminar, without the argument being written twice.

Everything below was measured against `@argdown/cli` 2.0.0 on a test file, not inferred.

---

## What becomes a node

| Element | Becomes a node? |
|---|---|
| Argument (`<Title>`) with at least one relation | Yes, always |
| Statement (`[Title]`) with a title | Yes, in the default mode |
| Untitled statement | No, in the default mode |
| Premise inside a PCS, untitled | No |
| Premise inside a PCS, titled | Yes — it is an equivalence class member |

Two-phase selection: a **preselection** round filters by section, tag, title or `isInMap`;
then a **selection** round applies `statementSelectionMode` and drops disconnected nodes.

---

## statementSelectionMode — a weaker dial than it looks

Two measurements. The toy file has 6 statements (4 titled) and 2 arguments; the real file is a
138-statement, 4-argument reconstruction of a journal article.

| Mode | Toy | Real file | What it actually selects |
|---|---|---|---|
| `with-title` *(default)* | 4 | 135 | titled equivalence classes |
| `all` | 6 | 142 | every equivalence class, including untitled |
| `with-relations` | 2 | 136 | statements carrying at least one relation |
| `with-more-than-one-relation` | 0 | 123 | hubs |
| `top-level` | 1 | **135** | statements **not used inside any PCS** |
| `not-used-in-argument` | 0 | 123 | statements that are not premises or conclusions |

**`top-level` is not a "main claim only" view.** On the toy file it happened to return one node,
which made it look like an overview dial; on a real document it returns nearly everything, because
"top-level" means *outside a premise-conclusion structure*, not *at the top of the tree*. Do not
reach for it to make a slide.

```bash
argdown map f.argdown --format svg --statement-selection all --stdout
```

In frontmatter:

```argdown
===
selection:
    statementSelectionMode: with-relations
===
```

**A frontmatter `selection:` block silently overrides the CLI flag.** VERIFIED: on the real file
with `selection.statementSelectionMode: with-title` present, all six `--statement-selection`
values returned 132 nodes; with the block removed, the same six returned
132 / 139 / 133 / 120 / 132 / 120. No warning either way. Decide which mechanism owns the view.

---

## The overview dial that does work: tags

VERIFIED on the real file — 135 nodes down to 18:

```argdown
===
selection:
    selectedTags: ["core"]
===
```

Tag the load-bearing claims `#core` **as you write them**, and tag the arguments too
(`<Master Argument>: gloss #core`) — an untagged argument disappears from a tag view and its
premises are left floating.

`selectedSections` is the other reliable narrowing: `["III.D. The Master Argument"]` took the same
file to 12 nodes. Neither has a CLI flag; both are frontmatter-only.

---

## Narrowing by section or tag

```argdown
===
selection:
    selectedSections: ["Part Two"]
    selectedTags: ["core"]
    excludeDisconnected: true
    includeStatements: ["a-statement-i-always-want"]
    excludeStatements: ["noise"]
    excludeArguments: ["side-issue"]
===
```

VERIFIED: `selectedSections: ["Part Two"]` on a two-section file rendered only the Part Two
statements and dropped Part One entirely. This is the cleanest way to get a per-chapter map out
of a whole-book argument file.

Per-element override, when a single node must be forced in or out:

```argdown
[a]: A claim. {isInMap: false}
```

Use sparingly — it couples the argument to one particular view.

---

## Grouping

Headings create sections; sections become **clusters** in the map.

```argdown
# Part One {isGroup: true}

[a]: ...

## A sub-part {isGroup: true}

[b]: ...
```

VERIFIED: two `{isGroup: true}` headings produced two `subgraph cluster_N` blocks, each labelled
with the heading text, containing the nodes defined under it. Nested headings nest the groups.

Grouping adds **no nodes** — it is pure visual organisation, so it costs nothing in complexity
while giving the reader the book's structure.

---

## Tags and colour

```argdown
[a]: A claim. #core
[b]: A surveyed position. #survey
```

VERIFIED: tags drive automatic node colour — in the test, `#core` → orange, `#contra` → purple,
untagged → green. Tags are also a preselection filter (`selectedTags`).

**Prefer tags to metadata for anything that should be visible.** Renderers colour and filter by
tag; they ignore arbitrary metadata keys. Keep metadata for provenance (`chapter`, `section`,
`source`, `reviewed`) and use tags for kind (`#survey`, `#opponent`, `#core`).

To keep tags out of the printed label:

```argdown
===
model:
    removeTagsFromText: true
===
```

---

## Label modes

```
--statement-labels  hide-untitled | title | text
--argument-labels   hide-untitled | title | text
```

`title` gives compact boxes for an overview; `text` prints the claim. Default shows both title
and text.

---

## explodeArguments

Splits one argument into a node per inferential step, so an attack can be aimed at an
intermediate conclusion rather than the whole argument. Use when teaching where exactly an
objection bites.

---

## Recipes

**Overview for a slide** — the `#core` spine, full text on each node. Frontmatter:

```argdown
===
model:
    removeTagsFromText: true
map:
    statementLabelMode: text
selection:
    selectedTags: ["core"]
===
```

**One chapter's argument** — frontmatter with `selectedSections: ["Part 2 - Ritual"]`. Copy the
heading text **exactly**, and beware that Argdown may have rewritten it: a heading written
`# III.A. Foo` is stored as `III∀ Foo`, and `selectedSections: ["III.A. Foo"]` then matches
nothing. `check_argdown.py` prints the stored section names.

**Full seminar reconstruction** — `--statement-selection all --explodeArguments`.

**Same file, several outputs.** Keep one `.argdown`; never fork the argument to make a simpler
picture. But choose *one* mechanism for switching views: if the frontmatter has a `selection:`
block it wins, and command-line flags become silent no-ops. For a file that must serve several
audiences, leave `selection` out of the frontmatter and pass flags — or keep the alternative
frontmatter blocks in a comment at the top of the file, ready to paste.

---

## The web-component, and the hook for interactive maps

The DOT and SVG exports label every node with a `type` attribute — `statement-map-node` or
`argument-map-node` — and every edge with `type="support"` or `type="attack"`, plus a `tooltip`
carrying the full text. Clusters are `subgraph cluster_N` with the section heading as the label.

In HTML-family exports the Argdown pandoc filter emits a `<argdown-map>` web-component rather
than a picture. VERIFIED in a real browser, 16 Aug 2026, against all three HTML profiles:

| Property | Observed |
|---|---|
| `customElements.get('argdown-map')` | defined — the element upgrades |
| Shadow root | present; Svelte-rendered, with its own scoped styles |
| Built-in controls | **Source ⇄ Map** toggle, fullscreen, click-to-enable zoom/pan |
| Map SVG location | **light DOM**, in `<div slot="map">` |
| Source location | light DOM, `<div slot="source">`, syntax-highlighted |
| Inside reveal.js | works — survives reveal's scaling transform, plain and UCL themes |

**The map SVG being in the light DOM is the thing that matters.** Page-level JavaScript can reach
`argdown-map .node`, `.edge` and `.cluster` with an ordinary `querySelectorAll` — no shadow-root
piercing, no component API required.

But the geometry is fixed at export time, so hiding a node leaves a hole where Graphviz put it.
**For a map that re-flows, use `.argdown-live` instead** — see below.

---

## Re-flowing maps — `.argdown-live`

Layout runs in the browser, so folding a Part makes the rest move to fill the gap.

Argdown offers three renderers, and the difference is **what each takes as input**:

| Class | Input | Layout runs | Can re-flow? |
|---|---|---|---|
| `SvgMapView` | an SVG string | nowhere — baked at export | no |
| `VizJsMap` | a DOT string | Graphviz-WASM, in browser | yes, but each render replaces the SVG wholesale, so nothing can be animated |
| `DagreMap` | an **`IMap` object** | dagre, in browser | yes — and the object is the thing you filter |

Hence the local implementation uses **dagre for layout** (`@dagrejs/dagre`, ~49 KB, no d3 and no
lodash) with its own SVG renderer:
`app/src/argdown-live-map.js`.

**The rule that makes animation possible: build the map ONCE at full detail and filter it
client-side.** Do not re-run Argdown per view. Node ids are assigned sequentially (`n0`, `n1`, …),
so a rebuild can renumber them, and the ids are exactly what keys the nodes across renders. Re-run
per view and the map jump-cuts instead of gliding.

The filter is a pure function (`full graph + view state → visible graph`), tested headlessly by
`test_argdown_live_map.js` — 45 checks, including the invariant that no surviving edge may point
at a node that is no longer drawn.
