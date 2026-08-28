# Carroll, "What the Tortoise Said to Achilles" (1895)

> Carroll, L. (1895) 'What the Tortoise Said to Achilles', *Mind*, 4(14), pp. 278-280.
>
> **Public domain.** Carroll died in 1898; the 1895 article is long out of copyright, and the
> converted text in `source/` carries no publisher's rights. **The PDF it was made from is a
> different matter** and is not in this repository: the scan and typesetting of the 1995 *Mind*
> reprint are Oxford University Press's, whatever the age of the words in it. That distinction
> is why `make_source.py` takes a path rather than shipping the file.

*Mind* 4.14 (1895), reprinted *Mind* 104.416 (October 1995), pp. 691–693. Three pages, 1,443
words, entirely dialogue. Open **`carroll-tortoise-achilles (map).html`**.

**Rebuilt 27 August 2026** under the current instructions, from the source and not from the map
it replaced. The account further down of what the *first* attempt got wrong is kept, because the
instructions were changed in response to it and the record of why is worth more than the file it
describes.

## The reconstruction

**The form is reductio ad absurdum, dramatised rather than stated.** Assume that to be compelled
to accept Z one must accept, as a further premise, the rule linking A and B to Z. Adding that
premise leaves the *new* step needing its own rule; the series never terminates; so on that
assumption nobody is ever compelled. But Z does follow from A and B. So the assumption is false.

**The contention is an imputation, and that is the point of interest here.** Carroll states no
conclusion anywhere: the dialogue ends with the narrator leaving for the Bank and two puns. Every
reading of what it *shows* is the reader's. Marking that is not a weakness of the reconstruction;
concealing it would be.

36 nodes, 7 of them arguments. 7 quotation · 14 paraphrase · 7 compression · 6 interpretation ·
2 imputation, and all eight departures warranted `coherence`. **27 of 27 quotations verify.** One
contention, nothing disconnected, nothing inert. Tags: 14 `#reported`, 4 `#conceded`,
3 `#contested`.

**It is the only map in the corpus that uses all seven relation constructs**, and each is earned
rather than collected. The one worth knowing about is the contradiction. Achilles grants that
anyone who accepts A and B must accept Z, and a dozen lines later grants that a reader who accepts
A and B but not C is *as yet* under no logical necessity to accept Z. Neither is a premise of the
other, so no inference bar can hold them — `><` is the only construct that can record it, and the
whole joke turns on that "as yet".

**Having imputed a conclusion, the map argues against itself.** `<A different moral>` is tagged
`#contested` and undercuts the apex argument: it grants the regress, grants that A and B compel Z,
and denies that this licenses any conclusion about the *status of a rule* rather than about a
reasoner who will not infer. A reconstruction whose conclusion is its own should show the reader
where it could be wrong, and this is what that looks like.

### Where the dialogue fights the form

Six places, all noted in the file. The one that cannot be resolved: Achilles's "Quite so" and "You
might… though such obtuseness would certainly be phenomenal" are assents in a conversation, not
claims offered as reasons — and they are load-bearing, because without them the regress cannot
start. They sit as `#conceded` premises, which reads them as more assertoric than the dialogue
makes them. The notes say so rather than hiding it.

## Quoting a damaged source

The publisher's text layer carries OCR substitutions — `on its hack` for "back", `A and B and G`
for "C", `and/)` for "and D". Quotations here were chosen to **avoid** the damaged spans: a
quotation is checked character by character, and silently correcting a source inside quotation
marks is the one thing this apparatus exists to prevent. Where the best sentence was damaged the
claim is a `paraphrase` and the note says why.

The source itself is the PDF's own text layer, reflowed into paragraphs. `ingest.py` tried no OCR
because the layer is clean — and that mattered: pymupdf4llm with rapidocr OCRs this document
regardless and turns 1,428 clean words into 1,222 with six garbled passages, one of them in the
middle of the central exchange.

## What the prompt failed to prevent

**`fidelity: "quotation"` was used on eight claims whose text is a summary**, on the strength of
their carrying a quotation in `source:`. The marker describes the *claim text*, not the supporting
field. The checker caught all eight — it reports words in the claim that appear nowhere in the
cited file — and the prompt now states the rule and the test for it: *could a reader find this
sentence, in these words, in the source?*

**And the map exposed a blind spot in the tooling.** `interpretive_load` measures departures on
the paths *below* a contention and never looked at the contention itself. A map whose conclusion
is an imputation therefore read **0** — the cleanest possible score — while resting on a claim its
author never made. The contention's own fidelity is now reported separately, and this is the only
one of the five sample maps where it fires.

## Rebuilding

```bash
python3 "../../ipsissima-mcp/src/ipsissima_mcp/ingest.py" \
    "<the PDF>" --out .
python3 ../../ipsissima-mcp/src/ipsissima_mcp/check_argdown.py \
    carroll-tortoise-achilles.argdown --source-root . --no-fix --format json
node "../../app/build_argdown_viewer.mjs" \
    carroll-tortoise-achilles.argdown --source-root .
```
