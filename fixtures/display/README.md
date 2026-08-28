# Maps that exist to be drawn

**Hand-written Argdown, with no source text at all.** This is the set that removes the worst of
the corpus bottleneck.

A rendering defect — a premise-conclusion structure that flattens to one box, a fold that loses a
group, an undercut drawn in the colour of support — needs *a map with that shape in it*. It does
not need a paper, an author, a licence, or a conversion. Waiting for a real article to turn up
that happens to contain four nested undercuts is why several of these defects went unreproduced
for months.

So a fixture here is written to be **pathological**, and it should be the smallest map that still
exhibits the thing.

## The rules

1. **One defect per file**, and the filename says which.
2. **A comment at the top** saying what the map is for, what should be seen, and what goes wrong
   when the defect is present. The file has to explain itself: a `.argdown` with a strange shape
   and no comment reads as a mistake.
3. **No `source:`, no `chapter:`, no manuscript.** If a fixture needs provenance it belongs in
   `samples/` and it needs a real text.
4. **It must parse.** A fixture that does not is testing the parser, not the renderer, and
   `test_parse_failure.mjs` already owns that.

## What is wanted

The gaps the syntax audit found, in the order they matter — see `docs/ARGDOWN-SUPPORT.md`:

- a premise-conclusion structure with numbered premises, an inference rule, and `{uses: […]}`
- an SCP argument whose premises are **not** all in square brackets
- undercuts attacking an argument that is itself attacking the contention
- statement mentions (`@[…]`) and argument mentions (`@<…>`)
- bold, italic and links in statement text
- a strict-mode map, which renames every relation
- deep nesting, for the fold invariants

Argdown's own sample maps cover several of these and are listed in
`fixtures/private-corpus.json`, because they belong to that project rather than to this one.
