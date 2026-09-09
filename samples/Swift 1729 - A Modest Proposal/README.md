# Swift, *A Modest Proposal* (1729)

> Swift, J. (1729) *A Modest Proposal for preventing the children of poor people in Ireland,
> from being a burden on their parents or country, and for making them beneficial to the
> publick*. Dublin.
>
> **Public domain.** The converted text in `source/` was made from Project Gutenberg e-text
> #1080 and keeps Gutenberg's front and back matter, blanked and trimmed by the converter's
> ordinary rules.

**Read the front matter's note before the map.** The pamphlet is a satire, and its surface
argument — that the poor of Ireland should sell their year-old children as food — is monstrous
*by design*. Nobody in this map asserts it: the proposer's entire case is tagged `#reported`,
the view an author sets out to be seen through, and what Swift is actually arguing is never
stated in the text at all. This sample exists because that structure is the hardest test the
fidelity apparatus has: a text whose every sentence is in one voice and whose meaning is in
another.

3,400 words of pamphlet. 53 nodes, 7 of them arguments. 47 of 47 quotations verify, in the
proposer's own 1729 spellings. `unit: commitment` — the question this text poses is which view
is held, not what the words mean.

## The reconstruction

**The persona's conclusion is not an apex.** The proposer's case is mapped in full — the
arithmetic of the poor, the child as commodity, the six advantages, the dismissal of the "other
expedients" — and it funnels into a reductio: the proposal is what the projectors' way of
reckoning the poor comes to when carried through; the proposal is monstrous; so the reckoning
is monstrous. The monstrousness premise is an `imputation` — Swift never says it; the proposer
says the reverse; every reader supplies it — and the census marks it load-bearing, which is
true.

**Both contentions are imputations, and the map says so in its numbers.** Swift's two real
claims — that Ireland's poor are already being devoured under the present order, and that the
honest remedies are known and refused — stand at the apex marked `imputation` with warrants,
and the interpretive load prints, for each, that *every route passes through the
reconstructor*. A map of a text that never states its conclusion should say exactly that, and
this one does.

**The asides where Swift's voice breaks through the mask** — the landlords who "have already
devoured most of the parents", the country "which would be glad to eat up our whole nation",
the poor "every day dying, and rotting … as fast as can be reasonably expected" — are drawn
untagged under Swift's argument, with notes carrying the attribution the notation cannot: the
words are the persona's, the charge is the author's.

This is the corpus's test case for dramatised texts — the conventions' policy for satire,
dialogue and thought experiment (persona `#reported`; voice-breaks untagged with a note; the
author's contentions imputed at the apex, counting in their own interpretive load) was worked
out across five independent reconstructions of this pamphlet, of which this map was the
strongest reading.

## Rebuilding

```bash
python3 ../../ipsissima-mcp/src/ipsissima_mcp/check_argdown.py \
    swift-modest-proposal.argdown --source-root . --no-fix --format json
node "../../app/build_argdown_viewer.mjs" \
    swift-modest-proposal.argdown --source-root .
```
