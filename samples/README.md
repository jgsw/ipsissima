# Sample reconstructions

Worked examples: someone else's published argument, reconstructed in Argdown, with the text it
was drawn from sitting beside it. Each folder is self-contained — the converted source, the
`.argdown`, and the script that made the source — so opening one in Ipsissima gives you the map,
the manuscript, and the link between them.

Open a folder in Ipsissima (**File ▸ Open**, or double-click the `.argdown`) and it reads the
folder around it.

## What may go in here

**Only texts that are out of copyright, licensed for redistribution, or ours.** A reconstruction
quotes its source in fragments, which is ordinary scholarly quotation; a sample folder carries the
*whole converted article*, which is not. That distinction is what this policy is about, and it is
the only rule this directory has:

| | |
|---|---|
| **Public domain** | fine — Carroll and Darwin below |
| **Creative Commons, or another licence permitting redistribution** | fine, with the licence named |
| **Our own work** | fine |
| **Anything else** | **no** — however useful it would be as an example |

Reconstructions of in-copyright articles live in the author's private corpus and are not
published here. If you want one of those as a sample, the answer is to reconstruct something
openly licensed instead.

## The samples

| | | |
|---|---|---|
| **Carroll**, "What the Tortoise Said to Achilles" (1895) | 20 claims, 3 pages | public domain |
| **Darwin**, natural selection (*Origin*, p. 168) | 22 claims, 2 paragraphs | public domain |
| **Prescott-Couch**, "The Philosopher as Reverse-Engineer" (2024) | 36 claims, 17 pages | CC-BY 4.0 |
| **Akhlaghi**, "Transformative experience and the right to revelatory autonomy" (2023) | 82 claims, 10 pages | CC-BY 4.0 |
| **Tooming & Jakapi**, "Aphantasia as a challenge for Humean abstraction" (2026) | 48 claims, 9 pages | CC-BY 4.0 |
| **Wilson**, "Williams, Dewey, and the Nature of Value Inquiry" (2026) | 37 claims, 28 pages | Creative Commons, by the author of Ipsissima |

Read **Carroll** and **Darwin** side by side if you want one thing from this folder. They are the
clearest statement here of the distinction that decides how a reconstruction is wired:

- Carroll's regress is a **reductio**, dramatised and never stated — so the contention is an
  *imputation*, drawn dot-dashed, because the paper needs it and never says it.
- Darwin's premises work **only together**. Variation without struggle preserves nothing; struggle
  without variation has nothing to preserve. So they sit in premise-conclusion structures, and
  drawing them as siblings would claim something false about the argument.

**Akhlaghi** is the only map here that uses the whole language — undercuts, contradictions and
explicit relation direction. It was the test arm in a controlled comparison of two sets of
instructions, and its counterpart, built under the older ones, is kept in
`ipsissima-mcp/eval/baseline-instructions/` so the difference can be read rather than taken on
trust. It is also the largest map in the corpus at 93 nodes, and the one that found the fold
defect now in `KNOWN-ISSUES.md`.

**Tooming & Jakapi** is the one with the cleanest *shape*: a linked three-premise challenge, and
then seven ways out enumerated and closed one by one. It is the best thing here to read if you
want to see what "elimination of alternatives" looks like drawn, and the only sample whose source
is a modern two-column journal PDF — so it is also what the converter's column and heading
detection is tested against.

**Prescott-Couch** is the one built from **two sources at once** — the publisher's HTML for the
structure, the PDF for the page numbers, because each has exactly what the other lacks. It is
also the only sample whose argument is a *critical notice*, so its map has two apexes: the view
being examined, and the critic's own conclusion.

**Wilson** is the long one: four contentions rather than a single thesis, themes that recur and
modulate. It is what the layout and folding behaviour is hardest on, and what the exposition
sparkline has most to say about.

Every one of these is run by the test suite. `app/test_fold_invariants.mjs` walks this folder
rather than naming files, so **adding a sample strengthens the suite by itself** — which is the
point of the "Wanted" section below.

## Wanted

More samples, and the constraint above is the whole difficulty: they must be openly licensed
*and* machine-readable *and* worth reconstructing. Good hunting grounds are Creative Commons
articles in philosophy journals and the open-access literature in PubMed Central. Contributions
welcome — a folder here needs a `.argdown`, a `source/` directory, the script that converted it,
a README naming the licence, and nothing that could not be redistributed.

## The pattern every folder follows

```
<paper>/
  convert_source.py     a Config block and a note saying what liberties THIS paper needed;
                        the machinery is shared, in ipsissima-mcp/
  source/
    <paper>.md          the text the reconstruction cites
  <paper>.argdown       the reconstruction
  README.md             what the argument does, what this folder is here to show, and —
                        where the text is not public domain — the licence, in full, with the
                        attribution the licence requires
```

**Attribution goes in the source file too, not only the README.** Ipsissima can save a
reconstruction and its manuscript as a single file and send it to someone; at that point the
`.md` is the only thing carrying the licence, and a README left behind on disk is not
attribution.

Built viewers (`<paper> (map).html`) are not committed — they are generated, half a megabyte
each, and go stale the moment the renderer changes. Build one with:

```bash
node app/build_argdown_viewer.mjs "samples/<paper>/<paper>.argdown" --source-root "samples/<paper>"
```
