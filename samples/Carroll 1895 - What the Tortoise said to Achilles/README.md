# Carroll, "What the Tortoise Said to Achilles" (1895)

*Mind* 4.14 (1895), reprinted *Mind* 104.416 (October 1995), pp. 691–693. Three pages, 1,443
words, entirely dialogue. Open **`carroll-tortoise-achilles (map).html`**.

**This folder is the first test of `extraction-prompt.md`**, and it was built by following that
prompt and nothing else. What the prompt failed to prevent is recorded below, because that is
what the test was for.

## The reconstruction

**The form is reductio ad absurdum, dramatised rather than stated.** Assume that to be compelled
to accept Z one must accept, as a further premise, the rule linking A and B to Z. Adding that
premise leaves the *new* step needing its own rule; the series never terminates; so on that
assumption nobody is ever compelled. But Z does follow from A and B. So the assumption is false.

**The contention is an imputation, and that is the point of interest here.** Carroll states no
conclusion anywhere: the dialogue ends with the narrator leaving for the Bank and two puns. Every
reading of what it *shows* is the reader's. Marking that is not a weakness of the reconstruction;
concealing it would be.

4 quotation · 11 paraphrase · 5 interpretation · 1 imputation, all six departures warranted.
14 of 14 quotations verify. One contention, nothing disconnected, nothing inert.

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
python3 "../../mcp/src/ipsissima_mcp/ingest.py" \
    "<the PDF>" --out .
python3 ../../.claude/skills/argdown/check_argdown.py carroll-tortoise-achilles.argdown --source-root .
node "../../app/build_argdown_viewer.mjs" \
    carroll-tortoise-achilles.argdown --source-root .
```
