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
| **Wilson**, "Williams, Dewey, and the Nature of Value Inquiry" (2026) | 37 claims, 28 pages | Creative Commons, by the author of Ipsissima |

Read **Carroll** and **Darwin** side by side if you want one thing from this folder. They are the
clearest statement here of the distinction that decides how a reconstruction is wired:

- Carroll's regress is a **reductio**, dramatised and never stated — so the contention is an
  *imputation*, drawn dot-dashed, because the paper needs it and never says it.
- Darwin's premises work **only together**. Variation without struggle preserves nothing; struggle
  without variation has nothing to preserve. So they sit in premise-conclusion structures, and
  drawing them as siblings would claim something false about the argument.

**Wilson** is the long one: four contentions rather than a single thesis, themes that recur and
modulate. It is what the layout and folding behaviour is hardest on, and what the exposition
sparkline has most to say about.

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
  README.md             what the argument does, and what this folder is here to show
```

Built viewers (`<paper> (map).html`) are not committed — they are generated, half a megabyte
each, and go stale the moment the renderer changes. Build one with:

```bash
node app/build_argdown_viewer.mjs "samples/<paper>/<paper>.argdown" --source-root "samples/<paper>"
```
