# Tooming & Jakapi, "Aphantasia as a challenge for Humean abstraction" (2026)

> Tooming, U. and Jakapi, R. (2026) 'Aphantasia as a challenge for Humean abstraction',
> *Neuropsychologia*, 227, 109465. <https://doi.org/10.1016/j.neuropsychologia.2026.109465>
>
> © the authors. Published under a **[Creative Commons Attribution 4.0 International
> licence](https://creativecommons.org/licenses/by/4.0/)**.

**The text in `source/` is theirs and stays under CC-BY 4.0**, which is what allows it to be
here: the licence permits redistribution and adaptation with attribution, and a converted
Markdown extraction is an adaptation. Verified against both Crossref (CC-BY applies to the
version of record, from 20 April 2026) and Unpaywall. **The reconstruction is not theirs** — the
`.argdown` is a reading of their argument by someone else, and every claim in it is marked for
how far it stands from their words. Reuse it under this repository's own licence and do not
attribute its judgements to them.

To rebuild the source: `python3 convert_source.py path/to/paper.pdf`, with the PDF from the DOI
above. The PDF itself is not in this repository — the publisher's typesetting is a separate
matter from the licence on the article.

---

This folder began as a test of the shared converter against a paper unlike the older ones:
modern, two-column, with a clean digital text layer and its own numbered sections. It now carries
a reconstruction as well — 48 nodes, 27 verified quotations, every claim placed in the text.

Build a viewer for it with:

```bash
node app/build_argdown_viewer.mjs \
  "samples/Tooming and Jakapi 2026 - Aphantasia and Humean abstraction/tooming-jakapi-aphantasia.argdown" \
  --source-root "samples/Tooming and Jakapi 2026 - Aphantasia and Humean abstraction"
```

## The reconstruction

**The form is elimination of alternatives**, as in the Williams — but with the setup doing far
more work. Sections 2–3 build a **linked** three-premise challenge (Humean abstraction requires
projective imagination · severe aphantasics cannot project · aphantasics nevertheless think
abstractly), so it is a premise-conclusion structure: remove any one and there is nothing left to
answer. Section 4 then enumerates **seven** ways out and closes each.

The refutations are the opposite shape. Sections 4.1 and 4.2 each offer two *independent*
objections, and the authors say so of the first pair — "Either way, the explanatory challenge …
still stands." Those hang as siblings, because either alone suffices.

**What the map shows that the prose does not.** Three of the seven candidates are disposed of in
a single paragraph before the numbered subsections begin, and read as throat-clearing on the
page. Drawn, they are three of the seven load-bearing refutations. The paper's weight falls on
4.4 — the only response that grants the challenge and tries to survive it, and the only one
needing two arguments and a dilemma to close.

**The joint the paper does not defend.** That the seven responses exhaust the options is never
claimed, and an elimination argument needs it. Section 4 introduces its list as "four possible
responses" plus options that "deserve to be mentioned", never as a complete partition. Recorded
as `[candidates-may-not-exhaust]`, tagged `#dispute`: the observation is textual, the objection
is the reconstruction's.

**Fidelity.** 48 of 48 nodes marked: 27 quotation, 13 paraphrase, 3 compression, 5
interpretation, **no imputations**. The five interpretations are all warranted — two
`enthymeme` (the two arguments the authors make in continuous prose and never number) and three
`coherence`. Interpretive load on the contention is **0**: a route to it runs on reported
material alone, which is what `aim: fit` should look like.

**Provenance.** Every claim carries a `chapter`; 27 are pinned by a verified quotation and the
rest located to a paragraph. `section` is carried only where a claim has no quotation to pin it,
and every one cites the authors' own numbered sections rather than the converter — this is the
first folder here where that is true.

## What the conversion needed

Two lines of config, and nothing else:

```python
starts_at="1. Introduction",                            # Elsevier front matter is not the article
end_marker="CRediT authorship contribution statement",  # back matter and bibliography follow
```

Everything else was detected: two columns and where the gutter runs (x=299.1), the two running
heads, the page numbers, the footnotes, and **all eleven section headings**, because the paper
numbers its own. That last point is worth stating plainly — the Williams and Gettier folders carry
**editorial** headings, and their converters explain at length that the paragraph locator needs
sections a 1963 article does not mark up. Here the sections are the authors' own, so the
reconstruction's `section:` metadata will cite the paper rather than the converter.

8,203 words in 81 blocks, 9 footnotes, **no repairs** — the first paper here to need none. The
stretch detector finds nothing; a modern text layer has no dropped words to rescue.

## What it exposed in the converter

Four real defects, none of which the two older papers could have shown, and every one silent:

| | |
|---|---|
| **Footnote zone latched per page, not per column** | In two columns the reading order returns to the top of the sheet, so a footnote at the foot of the left column swallowed the whole right column — **1,364 words and three section headings**, with a plausible word count and well-formed paragraphs either side. Found only because the numbering jumped 1 → 3. |
| **De-hyphenation destroyed real compounds** | This PDF marks typesetter's breaks with U+00AD and never ends a line with an ASCII hyphen. A blanket rule turned "well-established" into "wellestablished". The converter now trusts soft hyphens where a document uses them, and falls back to the blunt rule for old scans that have none. |
| **Gutter detection was blind to line extents** | Measured on left edges, the widest gap on this page lies *inside* the left column, between its indents and its displayed material. |
| **`end_marker` ended the page, not the article** | The bibliography survived a cut that reported 48 lines dropped. |

Two checks were added so none of these can recur quietly: `split_footnotes` and `heading_gaps`
are pure and covered by `test_pdf_to_source.py`, and the converter now **reports a gap in the
section numbering as a torn conversion** — the paper's own numbering auditing the conversion.

## Rebuilding

```bash
python3 convert_source.py
python3 ../../.claude/skills/argdown/check_argdown.py tooming-jakapi-aphantasia.argdown --source-root .
node ~/Code/ipsissima/app/build_argdown_viewer.mjs \
    tooming-jakapi-aphantasia.argdown --source-root .
```
