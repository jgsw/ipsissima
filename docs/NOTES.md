# Notes

Working notes on how Ipsissima is built and why it is built that way — moved here from the
writing workspace it grew inside, on 22 Aug 2026, when the project was extracted.

They are the record of decisions that were expensive to reach, and several of them exist because
something failed silently. Read them before changing the thing they describe.

## The name

**Ipsissima**, from *ipsissima verba* — "the very words themselves". Chosen 21 Aug 2026 after
three earlier candidates turned out to be taken (Stemma, Scholion, Sinopia — the last of these a
LINKED-DATA EDITOR for libraries, which is uncomfortably adjacent), and after `Arguido` was
abandoned for meaning "formal suspect" in Portuguese.

Checked before adopting, which is the lesson those four taught: free on npm and PyPI, four dead
repositories on GitHub, no product in a web search, and no standalone meaning in Italian, Spanish
or Portuguese — it is Latin only, the superlative of *ipse*.

The fit is exact, and there is a second layer to it. Gospel scholars set *ipsissima verba* (the
actual words) against *ipsissima vox* (the authentic voice — a faithful report of the sense). That
is the quotation/paraphrase distinction this tool encodes on every claim, already named, in a
discipline that has argued about it for two centuries.

`Ipsissima.html` is the read-write build; `Ipsissima Reader.html` is the same tool without the
editor. Both are written by `rebuild_viewers.mjs`.


## The identity

Settled 28 Aug 2026, after a research pass on the phrase's history. Three decisions, and the
reasons they were expensive:

**The copy no longer opens with the Gospels.** The old first paragraph framed the whole program
with "Scholars of the Gospels set it against *ipsissima vox*" — which made a Christian scholarly
debate the doorway, and put some readers off at the door. The research showed the frame was too
small anyway: Thucydides concedes the distinction at 1.22, hadith science formalised it as
*bi-l-lafẓ* against *bi-l-maʿnā*, and *Masson v. New Yorker* (1991) priced it. The canonical
paragraph (README, site, help, About) now opens with the distinction itself; the full history,
Gospel criticism in its place among the others, is the About window's *The name* tab. Keep it
that way: the history is a chorus, and no single tradition is the frame.

**The strapline is "The very words, and how far a reading stands from them."** It translates the
name and states the product in the copy's own recurring measure ("how far it stands from its
source"). The descriptive line — "Read an argument reconstruction beside the text itself" — is
not a rival; it stays as the subtitle everywhere. (Reworded 28 Aug 2026 from "…the text it is a
reading of": the relative clause made a first-time visitor parse, and *itself* ends the line on
the name's own root.)

**Fidelity is pattern; relation is colour.** The mark is one claim box whose border enters solid
(quotation) and leaves as dash-dot (imputation), quotation marks seated inside — the map's own
semantics, so the app is already wearing the identity. `brand/README.md` has the palette, the
files, and how to regenerate everything generated (the platform icon set is not committed;
`source.png` is). The site sets EB Garamond, self-hosted in `site/assets/fonts/` — the app
promises no third-party requests and the site keeps the same manners — and its `<hr>` is the
fidelity ladder. The favicon needed `site/_includes/head.html` (a copy of minima 2.5.1's) because
the site lives under `/ipsissima/`, where the browser's automatic `/favicon.ico` lookup misses.


## Argdown

`@argdown/cli` 2.0.0 is installed at `app/`
(Node v25, npm 11 — both were already present). It is the **same parser** the VS Code extension
and argdown.org use, so it is ground truth for validity.

```bash
CLI="app/node_modules/.bin/argdown"
"$CLI" map  "<f>.argdown" --format dot > /dev/null    # validate; non-zero exit = syntax error
"$CLI" json "<f>.argdown" --outputDir "$PWD/json"      # statements / relations / tags / sections
"$CLI" map  "<f>.argdown" --format svg --outputDir "$PWD/svg"
"$CLI" web-component "<f>.argdown" --outputDir "$PWD/html"
```

The flag is **`--outputDir`**. `--outDir` is accepted silently, ignored, and the export lands in
the working directory instead.

**Claude: never hand over a .argdown file without running the validator.** The `argdown` skill
(`ipsissima-mcp/src/ipsissima_mcp/docs/`) carries the syntax and the failure modes; `reference.md` beside it is
a full reference in which every rule was tested against the CLI rather than inferred.

Why a skill and not a generator: the failure was Claude's knowledge of the syntax, not missing
tooling. Official tooling already parses, validates, and renders far better than anything written
here would; a bespoke generator would reproduce the same mistakes and drift from the spec. The
only bespoke code is `argument_tool.py`, which addresses co-editing safety, not syntax.

### Viewing a single `.argdown` file

Two self-contained viewers, both built from `app/argdown-viewer.template.html` and both
using the real Argdown parser (never the structure browser's subset parser, which silently drops
`<arguments>`, premise-conclusion structures and undercuts).

```bash
cd app
node build_argdown_viewer.mjs "<file>.argdown"   # -> "<file> (map).html", ~200KB, emailable
node build_argdown_viewer.mjs --standalone       # -> "Ipsissima Reader.html" at the workspace root
```

The per-file build bakes the graph in and must be rebuilt when its source changes; the standalone
bundles `@argdown/core` (via esbuild, a devDependency of `app`) so any file can be
dropped on it and it never goes stale. Verified: the bundled browser parser returns graphs
byte-identical to the Node parser.

The Argdown-to-graph adapter lives once, in `app/argdown-graph.mjs`, shared by both
viewers and by `argdown-live-filter.mjs`. Keep it free of Node imports — esbuild follows even a
dynamic `import("@argdown/node")` and the browser build then fails on `fs`/`path`/`util`.

**Rebuilding after a change.** `rebuild_viewers.mjs` finds every built map and rebuilds it;
`--check` reports staleness without writing. It compares each map against **every input that gets
baked in** — the renderer, the template, `argdown-positions.js`, `argdown-bundle.js` — because a
map that is stale still opens and still draws, and says nothing.

### Justificatory debt — `argdown-exposition.js`

Every relation runs reason → claim. Rank both ends in reading order and subtract. A claim asserted
before its justification arrives leaves the reader holding a promise — a **justificatory debt** —
until the reasons turn up.

**DEBT GOES BELOW THE LINE**, and the reason is worth keeping. The obvious encoding is "up means
the justification reaches forward through the text", and it is quietly wrong: the horizontal axis
IS the text, so *forward* already means rightward, and using height to say it a second time makes
the reader hold two spatial metaphors about the same fact. The vertical axis is a ledger instead —
which is what height conventionally carries, and what this program already called it. Below, a
promise outstanding; above, a claim its reasons have already earned.

Three other shapes were built and measured against the samples before settling on this. A running
BALANCE (debt and credit accumulated across the text) is the most faithful to the metaphor and
discriminates worst — at sparkline size all three samples look alike, because the sum is dominated
by ordinary settle-as-you-go. DEBT ALONE is a sawtooth: the count flips by ±1 constantly and reads
as noise. What ships is the per-bin net, reflected — identical legibility to the version that
preceded it, and the right metaphor.

**Weighted by distance, and that is the whole trick.** Raw counts say nothing — the split is
about 50/50 in every sample, because most support sits a line or two from what it supports and
that is prose, not a finding. Each relation contributes `|reach| / claims`, so a
neighbour-to-neighbour edge barely registers and a reach across half a paper dominates. Measured
that way the samples separate cleanly and `test_exposition.mjs` holds them apart: **Williams 73%
of the way through the text, Horton 42%.** That is the difference between reading them.

Drawn three ways, all from the one module: a sparkline on every band header, one in the footer
beside the claim counts, and the same thing in words — *converges late · argued up to · weight at
73%*. One neutral ink and no green or red anywhere near it: those mean support and attack a few
centimetres away on the same screen, and the side of the axis already carries the distinction.

**Three things had to be right before the mark said anything**, and each was invisible until it
was fixed:

* **Rebasing.** A band's mark was plotted along the WHOLE map's x-axis, so a section covering
  claims 10–20 of 62 put every relation into a sixth of the bins and left the rest at zero — a
  flat line with a blip. Each band is now rebased onto its own stretch, which is what makes it a
  zoom rather than a crop.
* **One line, not two bands.** Forward and backward as separate filled areas from a shared
  midline looked right and failed: turned up loud enough to read, both fill most of the height in
  most bins and the mark becomes a slab. The NET — forward minus backward — is a single curve,
  which is the ordinary shape of a sparkline anyway.
* **A limiter, not a peak scale.** These are weighted sums and are dominated by their largest
  term; against the tallest bin, 3 of Williams's 30 half-bins cleared two-fifths of the height —
  a text chosen for being lopsided, drawn flat. Scaled to the 75th percentile of the non-zero
  magnitudes with a 0.55 power it is 26 of 30, and the papers still look nothing like each other.
  The top quarter of bins clip, which is the bargain a limiter makes.

The axis is dashed and at 0.16 opacity. A sparkline conventionally has none at all; this one keeps
a trace because zero here MEANS something, and with a flat stretch there would be nothing to say
where the middle was.

**The bug this replaced was silent and total.** The renderer decided direction by comparing
CHAPTER indices (`ca > cb`). A single-file article has one chapter, so every relation fell on the
same side of the test, every edge was classed identically, and the direction encoding never varied
at all — on a paper, which is most of what gets reconstructed, the picture simply did not carry
the information. The threshold is now on distance, which keeps the original reason for the
chapter test (excluding line-to-line prose) and works when there is only one file.

Direction chevrons also start earlier in Exposition (74 units against 160). Regular columns give
no clue which way a line runs, so the short edge is exactly the one whose direction is unclear —
the opposite of the argument arrangement, where a short edge needs no explaining.

### The help text is Markdown, and the typeface is ArgVu

**`app/help.md` is the whole of "How to use".** Edit that file, not the template. It is
rendered at startup by a second markdown-it instance — `__MARKDOWN_TRUSTED__`, with `html: true` —
and cut into topics on its `##` headings, from which the contents list is generated. The
distinction from `__MARKDOWN__` is a security boundary, not a convenience: that one draws the
MANUSCRIPT, which is somebody else's file, and must never pass its HTML through.

Four ids in help.md are filled in at runtime and must survive any rewrite: `relkey`, `fidkey`,
`helpstats`, and the `about*` fields. That is also why the panel is built at startup rather than
when it is first opened — `statsLine` writes into one of them on every render.

**ArgVu** (`app/vendor/ArgVu/`) is the Argdown project's own typeface, by Peter Stahmer,
funded by the KIT Debatelab: DejaVu Sans Mono with ligatures for the relation symbols, so `<+`,
`<-`, `<_`, `+>`, `->`, `_>` and `><` draw as single marks and `-----`/`===` as continuous rules.
189 KB as WOFF2, embedded as a data URI so the single file keeps working offline and from
`file://`. `make.mjs` regenerates the WOFF2 from the upstream .otf; `PROVENANCE.md` records where
it came from and why the licence file travels with it. Standard ligatures only — `dlig`, which
turns `:^:` into a logical symbol, is left off deliberately.

The base64 is substituted into the template ONCE, by `templateText()`, and the shell copy carried
for self-export keeps the `__ARGVU_WOFF2__` placeholder — otherwise every build held two copies of
the font, 252 KB of duplication. `exportPage` refills it by reading the typeface back out of the
running page's own stylesheet.

### The desktop app — `app/desktop/`

Built 22 Aug 2026, after the WebKit measurement below said it was possible. Tauri v2: a **4.0 MB
`.app`, 2.2 MB `.dmg`**, against Electron's 96–150 MB for the same 1.9 MB page. Rust 1.98 via
Homebrew `rustup` (keg-only — `export PATH="/opt/homebrew/opt/rustup/bin:$PATH"`).

**The app is the same HTML file.** `desktop/build_desktop.mjs` runs the ordinary
`--standalone --editor` build into `desktop/dist/index.html` and Tauri wraps that. The bridge is
`Build scripts/argdown-host.js`, inlined like every other module: in a browser it detects no host
and every existing path runs unchanged. There is no second frontend, and there must never be.

Verified end to end on 22 Aug: Finder double-click opens the app, which reads the file's FOLDER
for the manuscript; Save writes the `.argdown` back in place; editing the manuscript in another
program reloads the passage in the running app (1,225 → 1,260 words, untouched). Full notes and
the five silent failure modes are in `desktop/README.md`. Two worth repeating here because they
cost the most time:

* **`tauri-plugin-fs`'s `watch` is not a default feature.** Without `features = ["watch"]` there
  is no watch command, `fs.watch` does nothing, and nothing anywhere reports it.
* **A file association needs a declared UTI, not just an extension.** With `CFBundleDocumentTypes`
  alone, `.argdown` gets an anonymous dynamic UTI and LaunchServices will not bind a default
  handler to one. `open -a Ipsissima file.argdown` works; double-clicking does nothing. The
  `UTExportedTypeDeclarations` block in `desktop/src-tauri/Info.plist` is the fix.

**Install with `desktop/install.mjs`, never by hand.** macOS registers a `.app` the moment one
appears on disk, so every build leaves the copy in `target/` known to LaunchServices, and
building a `.dmg` registers the copy inside the mounted image as well — a registration that
outlives the volume, after which double-clicking opens a ghost on a disk that is not mounted and
nothing happens. Two Ipsissimas showed up in Spotlight that way, with no way to tell which was
which. `install.mjs` builds, installs one copy to `~/Applications`, registers it, and unregisters
everything else — in that order, because clearing registrations *before* the build simply lets
the build put the duplicate back. `node install.mjs --status` says what is registered.

The other half of the same problem is answered in the app: **About** (in How to use) reports the
version, the build time, and whether it is running as the application or in a browser. Version
lives in `app/VERSION` and `build_desktop.mjs` copies it into `tauri.conf.json`, so the
page and the bundle cannot disagree.

It is unsigned, so a copy sent to anyone else needs right-click → Open the first time; the
user-facing wording for that is written up in `desktop/INSTALL.md`, for the download page.

### Does it run on WebKit? — measured 21 Aug 2026, and the answer is yes

Asked because a desktop wrapper (Tauri, or any native shell) uses the OS webview, which on macOS
is **WKWebView** — so this decides whether a real app is possible at all. Tested by loading a
built map in Safari 605.1.15 beside the same file in Chromium and comparing:

| | Chromium | WebKit |
|---|---|---|
| nodes / texts / paths drawn | 6 / 18 / 11 | **identical** |
| stats line | 31 claims · 6 sections · 1,225 words | **identical** |
| manuscript pane, marginalia | 982 words, 10 marks | **identical** |
| JS errors | none | **none** |
| `getComputedTextLength("The verdict")` | 61.9px | 56.3px |
| resulting box | w=82 h=71 | w=77 h=71 |

**The only difference is font metrics** — WebKit measures the same string ~9% narrower, so boxes
come out a few pixels narrower. It is proportional and internal to each engine, so the picture is
the same shape; `test_layout_geometry.mjs` already says why this is safe ("`layoutByText` is
pure… font metrics are not the thing that has ever been wrong"). Nothing else in the renderer is
on the Chromium-only edge: zero uses of `:has()`, container queries, paint worklets or
`backdrop-filter`.

**What WebKit does NOT have is the file layer**, and that is the whole porting cost:

```
showDirectoryPicker = undefined      showSaveFilePicker = undefined      webkitdirectory = true
```

So in Safari today, and in any WKWebView shell, Ipsissima silently falls back to its read-only
folder path and Save offers a download. A native shell has to bridge those three calls to the
host's own file API — which is an upgrade, not a workaround: real paths, no per-session
permission prompts, and file WATCHING, which the web has no equivalent of at all.

### Sending a reconstruction to someone who has no folder — `argdown-bundle.js`

`Build scripts/argdown-bundle.js` (added 21 Aug 2026) defines a **bundle**: one file holding the
reconstruction *and* the manuscript it is of. The manuscript is attached as Argdown **line
comments**, which the parser discards, so **a bundle is still a valid `.argdown`** — same
extension, same tools, identical graph. `test_bundle.mjs` checks that against the real parser on
a fixture full of `-->`, block-comment enders and the format's own directives.

Why line comments and not `<!-- -->` or the C block form: an essay containing either delimiter
closes the attachment early and spills prose into the reconstruction. A line comment cannot be
closed by anything but a newline. There is no escaping rule because there is nothing to escape.

Three things read or write one:

* **the builder** — a bundle needs no `--source-root`, because it is its own source root. It
  strips the attachment before parsing, so the essay never lands in the Argdown pane.
* **the Viewer and the Workbench** — open one like a folder. A file on disk beats the copy inside
  the bundle (matched by basename as well as path, since a plain drop has no folder). Save writes
  the attachment back, so a bundle that is commented on stays a bundle.
* **the Export menu** — writes one, and also writes a **self-contained page**: a copy of the
  viewer with the whole reconstruction baked in, assembled in the browser from its own inlined
  scripts. ~1.1 MB for the Akhlaghi reconstruction, most of it the manuscript. That is the
  artifact for a reader who has nothing — they double-click it.

The page export needs `window.__ARGDOWN_SHELL__` (the template, carried as text) and the
`data-part` attribute on every inlined `<script>`; both are added by `build_argdown_viewer.mjs`
for the two standalone builds only.

#### The two routes came apart, and what stops them doing it again — 27 Aug 2026

The paragraph above used to end "what it produces is the same artifact the per-file Node build
produces — deliberately, so there is never a second kind of viewer to keep in step". That was the
intention and it was not true, because **the list of what a page is made of existed twice**: once
as the builder's `parts` object, once as a literal inside the page's `pageParts`. They differed by
two entries, `HELP` and `STAMP`.

The cost was out of all proportion to the cause. `help.md` carries six elements the program writes
into — `helpstats`, `helpArrangeNote`, `relkey`, `fidkey`, `aboutdeps`, `aboutdebug` — so in an
exported page `statsLine` reached `$("helpstats").textContent` on nothing, threw, and **took the
rest of `render` with it**. Reported as four separate faults: the Help panel empty but for "About
Ipsissima", no Notes tab, the Exposition button doing nothing, and no relation key. One forgotten
array entry, and no test, no build warning and nothing on screen said so.

The fix is `app/src/argdown-page.js`, the same shape as `argdown-bundle.js`: a classic script
inlined into every build and `require`d by the builder, holding the section list, the marker
regex, the substitution and the JSON escaping. Two things about it are worth keeping:

* **the page names what it DROPS, not what it keeps.** A keep-list has to be remembered when a
  section is added; a drop-list has to be argued for. An exported page now carries everything the
  page it came from has, minus `PARSER`, `EDITOR`, `EXPORTER` and `SHELL` — four bundles that are
  a hundred kilobytes or more each and that a reading copy has no use for.
* **the build refuses to write a page whose template and section list disagree** (`checkTemplate`),
  so a ninth `INLINE:` marker cannot be added and silently left out of every exported copy.

`app/test_page_parity.mjs` checks both, and counts the help-owned elements the program writes into
— that count is the standing argument for `HELP` never being droppable, recomputed from the files
rather than asserted.

At the same time the **"… with the editor" export was withdrawn.** It shipped CodeMirror and the
parser inside the copy, 1.5 MB, "so they can reply". The objection is not the weight: Ipsissima
*is* the editor, in a browser tab or as an application, and embedding a private copy of the
workbench in every file that goes out makes every such file a fork of the program frozen at the
moment it was sent.

### Argdown in Zettlr exports — which filter, and why

Argdown blocks in a Zettlr markdown file are rendered on export. Six profiles are wired up, and
**three block classes** do different things:

| Class | HTML / Reveal.js | Word / PDF |
|---|---|---|
| `.argdown-live` | **re-flowing map** — fold a Part and the rest moves to fill the gap | static image |
| `.argdown-map` | static map as a zoomable web-component | static image |
| `.argdown` | highlighted source | source |

    ```{.argdown-live caption="..." depth="1"}
    # Part One {isGroup: true}

    [claim]: The thing being argued for.
        + [reason]: Something that supports it.
    ```

`depth` and `folded` set the opening state, so a slide can start at the main claim and open out
as the author talks. Headings become the foldable clusters.

Three filters, in this order on the HTML-family profiles:

| Filter | Claims | Where |
|---|---|---|
| `argdown-live-filter.mjs` | `.argdown-live` | `app/` |
| `@argdown/pandoc-filter` (official) | `.argdown-map` | `app/node_modules/` |
| `argdown.lua` | both, as static images | Zettlr's `lua-filter/` (print profiles only) |

The live filter must run **first**; it leaves `.argdown-map` to the official one. Word and PDF use
only the Lua filter — there is no JavaScript in a Word document, and a Node round-trip per export
is not worth it.

**Why dagre and not Argdown's own renderers.** The sandbox offers Viz.js and Dagre-D3, and they
differ in what they take as input: `VizJsMap` takes a *DOT string* (so re-flowing a filtered map
means regenerating DOT in the browser, and each render replaces the SVG wholesale — no element
identity, so no animation), while `DagreMap` takes an *`IMap` object*, which is the thing you
actually filter. `@argdown/map-views` itself is 2.1 MB, nearly all of it the Graphviz WASM that
only Viz.js needs, so the local build uses `@dagrejs/dagre` (~49 KB, no d3, no lodash) with its
own renderer instead. See the `argdown` skill's `map-semantics.md`.

*Follow-up, 29 Aug 2026: dagre is gone too. The stability project (`docs/STABILITY-PLAN.md`)
replaced its ordering, positions, boxes and routes with the project's own — the document
decides placement, so folding cannot reshuffle it — and by then dagre's whole remaining job
was one ranking pass, now written down in `layoutByArgument`. Zero layout dependencies; the
reasoning above about DOT and element identity still stands, and still shaped what replaced it.*

**The rule that makes it work:** build the map once at full detail and filter it client-side.
Node ids are sequential (`n0`, `n1`, …), so re-running Argdown per view can renumber them — and
those ids are what key the nodes across renders. Re-run per view and the map jump-cuts.

**The trap that cost an hour, recorded so it is not rediscovered.** The Node filter defaults to
`mode: inline` — a flat `<img>`. It reads its settings from document metadata, but only accepts a
value pandoc hands it as `MetaInlines`:

```js
if (value.t === "MetaInlines" && typeof value.c[0].c === "string")
```

A defaults file's own `metadata:` block is delivered as **`MetaString`** and silently ignored: no
warning, exit code 0, and a static picture. The setting therefore lives in its own file,

`app/argdown-pandoc-metadata.yaml`

referenced from `metadata-files:` in each of the three HTML profiles, because a metadata *file* is
parsed as a YAML metadata block and yields `MetaInlines`. Measured: `metadata:` → 0
web-components, `metadata-files:` → 3.

Verified 16 Aug 2026, all six profiles built and the three HTML ones opened in a real browser: the
element upgrades, has a shadow root, carries **Source ⇄ Map**, fullscreen and click-to-zoom
controls, and works inside reveal.js under both the stock theme and a heavily customised one.
Back up your Zettlr profiles before editing them; a broken profile fails at export time, which is
the worst moment to find out.

The map SVG sits in the component's **light DOM** (`div[slot="map"]`), so page JavaScript can
address `argdown-map .node` / `.edge` / `.cluster` directly. That is the opening for adding
fold/unfold controls to an exported deck; see `map-semantics.md` in the `argdown` skill for what
that would and would not get you.

Known limitation: the browser structure map (`_structure.html`) contains its own small parser for
statements, relations and metadata. It agrees with the official parser on the current file
(97 claims both), but it is a subset and does not understand arguments, PCS, frontmatter or
sections. If the argument file starts using those, either extend that parser or drive the map
from the CLI's `json` export instead.
