---
name: argdown
description: Write, edit and validate Argdown (.argdown) files in this repository — argument reconstruction from prose into premises and conclusions. Use whenever creating or editing a .argdown file, building an argument map, or when the author mentions Argdown, argument maps, argument reconstruction, or Ipsissima. ALWAYS validate with check_argdown.py before reporting the work as done.
---

# Argdown, in this repository

**This file is the toolchain and the workflow.** What the language is and how to reconstruct an
argument live in three documents beside it, and are not repeated here:

| read | for |
|---|---|
| `argdown-cheatsheet.md` | **the whole syntax.** Read it before writing Argdown. Do not write it from memory |
| `reconstruction-cheatsheet.md` | **the method** — finding the conclusion, the Assertibility Question, linked vs convergent, charity and its limit |
| `ipsissima-conventions.md` | **what Ipsissima records** — provenance, fidelity, warrants, tags, front matter |

Those three used to be duplicated inside this file and inside `extraction-prompt.md`, in versions
that had drifted apart. They now exist once.

---

## The non-negotiable: validate, never assume

**Never declare a `.argdown` file finished without running the checker.** Writing Argdown from
memory produces files that look right and fail to parse — a 380-line file was once delivered with
83 tree-breaking blank lines.

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/check_argdown.py "<file>.argdown" \
    --source-root "<manuscript dir>" --format json
```

`--format json` gives the faults with their locations and fixes, and nothing else: 221 words
rather than 687 on the Darwin sample, and 2.4s rather than 10.5. Bare, it prints the full census —
apex, sections, tags, debt — which is what a person wants once and a fix loop wants never.

**Parsing clean is necessary, not sufficient.** A file can parse perfectly and be four
disconnected trees with a corrupted heading. The checker is what catches that.

The raw validate, if all you need is the exit code:

```bash
app/node_modules/.bin/argdown map "<file>.argdown" --format dot > /dev/null
```

That is the same parser the VS Code extension and argdown.org use, so a file that passes here
passes for the author. Install with `cd app && npm install`.

---

## Starting a reconstruction

One command builds the folder, writes the converter, `_quarto.yml`, a skeleton and a README stub,
converts the source, and prints the report:

```bash
python3 ipsissima-mcp/src/ipsissima_mcp/new_reconstruction.py \
    "/path/to/paper.pdf" "Author YEAR - Short title" \
    [--start "1. Introduction"] [--end "References"]
```

Run it bare first, read the report, then re-run with `--start`/`--end` — those two are the only
things a page cannot tell you. Re-running never overwrites the converter or the `.argdown`.

**Read the conversion report rather than the converter.** It works out columns, indent bands,
running heads, footers, page numbers and footnotes for itself and reports every one. Two things it
will not do, both deliberate: it refuses to guess when a page uses more than two indent levels,
and it never invents a missing word.

---

## Four rules that keep a reconstruction cheap

Each was learned by paying for its absence.

1. **Detector first, images second.** Run the conversion, read the stretch report, and render page
   images ONLY for the lines it flags — a crop, not the page. Proofreading five whole pages to
   check three damaged lines cost about ten thousand tokens and found nothing the detector had not
   already pointed at. On a clean text layer, render nothing.
2. **Do not read another reconstruction to learn the house style.** It is in
   `ipsissima-conventions.md`, on one screen. The Williams file is 33 KB.
3. **A short README by default** — the form, the fidelity exceptions, the conversion liberties,
   and what the Manuscript view showed. Three folders already carry the long teaching essay.
4. **Reconstruct in one pass, with provenance attached as you write.** Retro-fitting `chapter` and
   `section` means re-reading the source.

**Where the money actually goes.** Measured on the Gettier and Darwin maps: orientation reading
and conversion dominated, and the reconstruction — the only part needing judgement — was the
smallest slice. So the mechanical half is worth automating, not delegating to a weaker model; the
judgement half is where a strong model earns its place.

---

## Showing a map to the author

The author reads maps in a browser, not a terminal.

```bash
cd app
node build_argdown_viewer.mjs "path/to/file.argdown" --source-root "path/to/manuscript"
node build_argdown_viewer.mjs --standalone      # -> "Ipsissima Reader.html" at the root
```

**ALWAYS build with `--source-root` when the map reconstructs a text on disk.** Without it the map
still draws and the Manuscript tab is greyed out with the reason attached, but nothing else says
anything is missing. The flag can only place a claim that carries a `chapter` — so the metadata
has to be there BEFORE the build.

A per-file viewer bakes in its graph AND the renderer, so it goes stale the moment either changes
— silently: the page opens, the map draws, and it draws the old way. Do not try to remember which
viewers exist:

```bash
node app/rebuild_viewers.mjs           # rebuild them all
node app/rebuild_viewers.mjs --check   # just say what is stale
```

---

## Before sharing anything: run everything

```bash
node app/run_all_tests.mjs
```

Twenty suites, including **map quality against a recorded baseline**, which is the one that
watches how the maps *look*, and **the documented examples**, which holds every Argdown example in
`docs/` to parsing. Non-zero exit if any fails.

**Before changing anything in the renderer, read the loop in `viewer.md`**: measure, change,
measure, look. Every layout defect in this thing was found by the author's eye rather than by a
test, and that section exists so the next one is not.

---

## Fidelity on arguments

`<Argument>` nodes carry fidelity like any other claim, and usually should: assembling premises
into a numbered structure is the reconstructor's work even when every step is the author's. An
argument with no `fidelity` hovers bare, which is what it should do — but it is usually a sign the
marker was forgotten rather than that none applies.

---

## Files beside this one — read on demand, not by default

| file | read it when |
|---|---|
| `argdown-cheatsheet.md` | **before writing any Argdown** |
| `reconstruction-cheatsheet.md` | **before reconstructing any argument** |
| `ipsissima-conventions.md` | attaching provenance, fidelity or tags |
| `map-semantics.md` | deciding what the map should draw — borders, tags, selection modes |
| `order-views.md` | interpreting the Manuscript view, or explaining what `--source-root` buys |
| `viewer.md` | changing the renderer, or describing the viewer's controls |
| `integrations.md` | putting a map into a document via pandoc, Quarto or reveal.js |
