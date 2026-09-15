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

## 3. Open, in order

1. **Unify the PDF route.** The recommendation from §1's table: `ingest.from_pdf` should
   ride `pdf_to_source.convert` (auto-config) and keep `plain_text` as the loud fallback,
   the same shape as the OCR escalation. One blocker is policy, not code: pdf_to_source
   **cuts detected back matter at creation** (128 lines on the Wolff — the references),
   where ingest's standing rule keeps everything on disk and trims only the prompt. A
   reconstruction can cite a bibliography entry; whether references belong in the file is
   the author's call, and the wiring waits on it.
2. **Inset quotations → blockquotes.** Unbuilt in both converters: the display band decides
   where blocks *start*, and nothing renders `>`. Needs its own measurement pass (indent
   from both margins, size drop, the bands machinery has the raw material).
3. The G6 ruling itself.
