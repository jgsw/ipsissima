# The manuscript as a reading surface

Opened 15 September 2026, from the author's ruling: *"We need to make not only possible, but
pleasurable for a reader to read a whole article in the manuscript view"* — extraneous
publisher text automatically removed, and *"where it is possible to reconstruct the semantic
structure of the source we should do so in the Markdown"*: footnotes as footnote definitions,
headings as headings, inset quotations as blockquotes. His own framing: *"merely to restate
how ingest is supposed to function"* — a restatement that was needed because the ideal was
being met unevenly. Drafted as G6 ⟨proposed⟩ in `docs/values/INVENTORY.md`, awaiting his
ruling.

## 1. What the measurement showed (Wolff, the same PDF through both converters)

The project has **two PDF pipelines**, and the gap between them is the whole problem:

| | `ingest.py` (plain_text) | `pdf_to_source.py` |
|---|---|---|
| running heads | **25 left in** (title/author alternating) | dropped, counted |
| page footers | **26 left in** (the CUP "Published online by…" line) | dropped, counted |
| copyright block | left in | dropped (after 15 Sep) |
| headings | **none** | all 8 placed |
| footnotes | markers only (definitions since 14 Sep's lift) | zone-lifted to `# Notes` |
| back matter | kept in file, trimmed for prompt | **cut at creation** |

`pdf_to_source.py` is the converter with the machinery — furniture, bands, columns, note
zones, per-choice reporting — built for the bespoke sample pipeline (`convert_source.py`
config culture). `ingest.py`'s PDF route is the simple block reader that `extract_text`
actually uses. The Wolff read as the sheet because it went down the simple road.

## 2. Fixed 15 Sep, both converters

- **`opens_note` heading guard** (pdf_to_source): a body-sized, heading-shaped line low on
  the sheet no longer opens a note zone. On the Wolff, "6 Ceremonies and Western Philosophy"
  had latched the zone and swallowed the heading plus the section's first paragraph into
  footnote 1 — `heading_gaps: [6]` was the only symptom.
- **The copyright-block latch** (pdf_to_source): the open-access licence block prints once
  (invisible to the repeats detector) at apparatus size (so it rode inside the note zone);
  an unmistakable opener line now latches it out, unmarked continuation lines carried by
  size, released by the first body-sized line. A line that IS a bare DOI is furniture too.
- **`strip_publisher_apparatus`** (ingest): the © block, bare DOI lines and "Published
  online by …" footers blanked — blanked, never deleted, the access stamps' own rule — with
  prose about licensing deliberately left alone.
- **Enacted**: the Wolff source re-converted whole through the fixed pdf_to_source (8
  headings, no furniture, notes clean; **66/66 quotations still exact** against the
  restructured text); the Wilson source blanked in place (© block + the lone running-head
  byline; 139/139 exact).

## 3. Ruled and built, 15 Sep — the same day the questions were put

1. **The PDF route is unified.** `ingest.from_pdf` sends a clean text layer through
   `pdf_to_source.convert` first and keeps the plain route as the loud fallback (the OCR
   escalation's shape): a structured result holding fewer than 85% of the raw layer's
   words is refused with the shortfall said, and a converter refusal is quoted, never
   swallowed. Measured on the Wolff through the unified route: 8 headings, 11 blockquotes,
   the footnote defined, 96% of the raw words kept with the difference named.

2. **The back-matter policy, in the author's ruling.** Three classes: the *publisher's
   voice* (stamps, © blocks, the Gutenberg licence) enters neither the file nor the
   prompt; *reader-useful, extraction-irrelevant* matter (reference lists) stays in the
   file and is trimmed from the prompt; *argument-relevant* matter (endnotes) reaches
   both. Enacted: detected back matter is now **kept**, emitted after `# Notes` under its
   own `#` heading — which is exactly where `extract_for_prompt` starts trimming, and
   `# Notes` is deliberately not in its vocabulary, so the order of emission is the
   machinery of the ruling. Verified on the Wolff: the note reaches the prompt, the
   bibliography's 805 words do not, and both reach the reader.

3. **Displayed quotations are blockquotes.** The measured signal: a quotation is a run of
   lines *all* off the page's own margin — the indent a paragraph gives only to its first
   line — read per page, because recto and verso margins differ. Two guards: a single
   indented line is a paragraph opening, and a run with no lowercase continuation is two
   short paragraphs. Before this, `to_blocks` dissolved the Wolff's Wollheim quotations
   into one mega-paragraph with the prose around them; they now stand as eleven `>` blocks,
   and the paragraph a quotation interrupts is never merged into it.

**Still open:** the G6 ruling itself (reworded 15 Sep at the author's ask: *"The author's
text, with its structure, and nothing else"*).
