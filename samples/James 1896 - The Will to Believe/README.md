# James, "The Will to Believe" (1896)

> James, W. (1896) 'The Will to Believe', an address to the Philosophical Clubs of Yale and
> Brown Universities; first printed in *The New World*, June 1896, and reprinted as the title
> essay of *The Will to Believe and Other Essays in Popular Philosophy* (1897).
>
> **Public domain.** James died in 1910. The converted text in `source/` was made from the
> Project Gutenberg e-text of the 1897 collection — the essay only, pages 1–31 of the printed
> book — and Gutenberg's own page anchors are what became the page markers.

9,145 words, ten sections, and the first long-form essay in this corpus. 69 nodes, 11 of them
arguments. 44 quotation · 30 compression · 2 interpretation, one of them the single `enthymeme`
the essay's logic needs. **74 of 74 quotations verify.** Tags: `#reported` for Clifford's rule
and the psychology objection, `#conceded` for the Pascal's-wager concession, `#contested` for
the two objections James answers.

## The reconstruction

**The essay argues in series — thesis, application, corollary — and that shape is why this map
exists.** Section IV states what James calls "the thesis I defend":

> Our passional nature not only lawfully may, but must, decide an option between propositions,
> whenever it is a genuine option that cannot by its nature be decided on intellectual grounds.

The rest of the essay *uses* that thesis: it is applied to the religious hypothesis (the
agnostic veto is irrational), and a closing page draws the practical corollary (respect one
another's mental freedom). A used conclusion is an intermediate one, so the computed apex —
claims that support nothing — is the closing corollary alone, and every contention-relative
measure would crown the coda while the famous thesis ranked as an intermediate.

**This is the map the front matter's `contentions:` declaration was built for.** The
declaration names the three theses; it is additive — the computed apex keeps its place beside
them — and the map's depth ladder opens on the thesis, with its six supporting arguments one
step away. The thesis claim is titled in prose, `[Passional nature must decide genuine
options]`, so it announces itself on the map rather than hiding behind a label. Most maps need
no declaration, and the conventions say when this one kind does.

**The groups are the argument's forms, not the essay's sections.** The thesis is held up by six
convergent arguments — suspension of belief is itself a passional decision; the evidentialist
rule is itself a passion; "believe truth" and "shun error" are separable laws; objective
certitude is never actually had; faith can create its own facts; moral questions cannot wait
for proof — and attacked by the two views James sets out in order to answer. His hedges
survive: "Indeed we may wait if we will… but if we do so, we do so at our peril as much as if
we believed."

## What making it taught the tooling

- The Gutenberg HTML carried its page numbers as inline `.pagenum` spans in the middle of
  sentences; the first extraction reported `pages: 0` and one span split an otherwise verbatim
  sentence in two. The converter now lifts those anchors out into proper page markers, which is
  why this source shows 31 pages and the once-split sentence is quoted whole.
- One near-miss quotation (98% match) came down to an inner quotation written `'…'` against the
  source's escaped `\"…\"`; the checker's normaliser now folds single and double quotes
  together.

The map was generated end to end by a model driving Ipsissima-MCP and verified by
`check_reconstruction`; it declares `generated: true` and carries no `reviewed:` stamp, because
no full human pass has been made — which is exactly what those two fields are for.

## Rebuilding

```bash
python3 ../../ipsissima-mcp/src/ipsissima_mcp/check_argdown.py \
    will-to-believe-1896.argdown --source-root . --no-fix --format json
node "../../app/build_argdown_viewer.mjs" \
    will-to-believe-1896.argdown --source-root .
```
