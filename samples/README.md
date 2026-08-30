# Sample reconstructions

**One of the corpus's three roles — `docs/CORPUS.md` has the other two.** These are the worked
reconstructions: few, full, real, and the expensive ones. A document that is here only to test a
converter belongs in `fixtures/ingest/`, and a map that is here only to test the renderer belongs
in `fixtures/display/` and needs no source text at all.

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
| **Carroll**, "What the Tortoise Said to Achilles" (1895) | 36 nodes, 3 pages | public domain |
| **Darwin**, natural selection (*Origin*, p. 168) | 13 nodes, 2 paragraphs | public domain |
| **Miller**, *R (Miller) v The Prime Minister* [2019] UKSC 41 | 66 nodes, 25 pages | Open Government Licence |
| **Prescott-Couch**, "The Philosopher as Reverse-Engineer" (2024) | 191 nodes, 17 pages | CC-BY 4.0 |
| **Akhlaghi**, "Transformative experience and the right to revelatory autonomy" (2023) | 93 nodes, 10 pages | CC-BY 4.0 |
| **Tooming & Jakapi**, "Aphantasia as a challenge for Humean abstraction" (2026) | 127 nodes, 9 pages | CC-BY 4.0 |
| **Wilson**, "Williams, Dewey, and the Nature of Value Inquiry" (2026) | 161 nodes, 28 pages | Creative Commons, by the author of Ipsissima |

**The middle column counts nodes, not claims, and the difference is not cosmetic.** A node is a
claim *or* an argument, and an argument with a premise-conclusion structure is a node in its own
right — so the two numbers are never the same, and a table that said "claims" here disagreed with
every folder README it pointed at. Nodes is also the number that can be checked: it is what the
build command at the foot of this file prints.

Read **Carroll** and **Darwin** side by side if you want one thing from this folder. They are the
clearest statement here of the distinction that decides how a reconstruction is wired:

- Carroll's regress is a **reductio**, dramatised and never stated — so the contention is an
  *imputation*, drawn dot-dashed, because the paper needs it and never says it.
- Darwin's premises work **only together**. Variation without struggle preserves nothing; struggle
  without variation has nothing to preserve. So they sit in premise-conclusion structures, and
  drawing them as siblings would claim something false about the argument.

**Miller** is the one that is not philosophy, which is exactly what it is here to test. A judgment
is cited by paragraph and not by page — *Miller (No 2)* at [50] is the whole address of a claim,
and recovering those seventy-one numbers off the page is what four separate fixes in
`pdf_to_source.py` were for. It reasons to a **disposal** rather than to a thesis, so the map is built backwards from the
order the court actually made: the steps the court treated as necessary to reach it are the
*ratio* and carry no tag, and what it said by the way is `#obiter`. The judgment is unanimous, so
the objections are not a dissent's — they are counsel's submissions, reconstructed as arguments
so that the court's answers can be drawn as the **undercuts** they are. It was rebuilt on
30 August 2026 under the legal-judgment rule; the map that stood here before is kept beside it in
`ipsissima-mcp/eval/legal-judgment-rule/`, which is where the two are compared.

**Akhlaghi** is the only map here that uses the whole language — undercuts, contradictions and
explicit relation direction. It was the test arm in a controlled comparison of two sets of
instructions, and its counterpart, built under the older ones, is kept in
`ipsissima-mcp/eval/baseline-instructions/` so the difference can be read rather than taken on
trust. At 93 nodes it was the largest map here until the rebuilds passed it, and it is the one
that found the fold defect now in `KNOWN-ISSUES.md`.

**Tooming & Jakapi** is the one with the cleanest *shape*: a linked three-premise challenge, and
then seven ways out enumerated and closed one by one. It is the best thing here to read if you
want to see what "elimination of alternatives" looks like drawn, and the only sample whose source
is a modern two-column journal PDF — so it is also what the converter's column and heading
detection is tested against.

**Prescott-Couch** is the one built from **two sources at once** — the publisher's HTML for the
structure, the PDF for the page numbers, because each has exactly what the other lacks. It is
also the only sample whose argument is a *critical notice*, so its map has two apexes: the view
being examined, and the critic's own conclusion.

**Wilson** is the long one: three contentions rather than a single thesis, themes that recur and
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
